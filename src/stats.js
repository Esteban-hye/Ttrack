'use strict';
// Stats : courbe des valeurs par jour sur une période, et ce qui est le plus mangé.

const Stats = (() => {
  const COLORS = { kcal: '--acc', prot: '--prot', carb: '--carb', fat: '--fat', fiber: '--fiber', sugar: '--sugar', sat: '--sat', salt: '--salt' };
  const PIE = ['#22c57f', '#5b9dff', '#f5b724', '#ff6b9a', '#a38bff', '#f97316', '#2dd4bf', '#94a3b8'];
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  let range = 'week';
  let from = addDays(today(), -6), to = today();   // période choisie à la main
  const shown = new Set(['kcal', 'prot']);         // courbes affichées
  let showGoals = true;                             // courbes d'objectif
  let line = null, pieDishes = null, pieFoods = null;

  function period() {
    if (range === 'week') return [addDays(today(), -6), today()];
    if (range === 'month') return [addDays(today(), -29), today()];
    return from <= to ? [from, to] : [to, from];
  }

  function renderSeries() {
    $('#series').innerHTML = NUTRIENTS.map(n => `
      <button class="chip series-chip${shown.has(n.k) ? ' on' : ''}" data-k="${n.k}" style="--c:var(${COLORS[n.k]})">
        <i></i>${n.label.replace('dont acides gras saturés', 'Saturés').replace('dont sucres', 'Sucres')}</button>`).join('') +
      `<button class="chip series-chip goal-chip${showGoals ? ' on' : ''}" data-goals style="--c:var(--mut)"><i></i>Objectifs</button>`;
  }

  function renderLine(days, rows) {
    const fmtDay = d => dateLabel(d, days.length <= 7 ? { weekday: 'short', day: 'numeric', month: 'numeric' } : { day: 'numeric', month: 'numeric' });
    const sets = NUTRIENTS.filter(n => shown.has(n.k)).map(n => ({
      label: n.label, unit: n.unit,
      data: rows.map(r => r?.sum[n.k] == null ? null : Math.round(r.sum[n.k] * 10) / 10),
      borderColor: css(COLORS[n.k]), backgroundColor: css(COLORS[n.k]),
      yAxisID: n.k === 'kcal' ? 'kcal' : 'g',
      tension: .25, pointRadius: days.length > 62 ? 0 : 3, pointHoverRadius: 5,
      // Jours sans saisie : pas de point, juste un pointillé entre les jours saisis
      spanGaps: true, segment: { borderDash: c => c.p0.skip || c.p1.skip || c.p1DataIndex - c.p0DataIndex > 1 ? [5, 5] : undefined }
    }));
    // Objectif en vigueur chaque jour : en escalier, pointillé, de la même couleur que sa courbe
    if (showGoals) {
      for (const n of NUTRIENTS.filter(n => shown.has(n.k))) {
        const data = days.map(d => goalFor(d)?.[n.k] ?? null);
        if (data.every(v => v == null)) continue;
        sets.push({
          label: 'Objectif ' + n.label.toLowerCase(), unit: n.unit, data, goal: true,
          borderColor: css(COLORS[n.k]) + '99', backgroundColor: css(COLORS[n.k]),
          yAxisID: n.k === 'kcal' ? 'kcal' : 'g', borderDash: [8, 5], borderWidth: 1.5,
          pointRadius: 0, pointHoverRadius: 0, stepped: 'middle', spanGaps: false
        });
      }
    }
    const tick = css('--mut'), grid = css('--bd');
    const hasK = shown.has('kcal'), hasG = [...shown].some(k => k !== 'kcal');
    line?.destroy();
    line = new Chart($('#chLine'), {
      type: 'line',
      data: { labels: days.map(fmtDay), datasets: sets },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: {
            title: items => dateLabel(days[items[0].dataIndex]),
            label: c => ` ${c.dataset.label} : ${c.raw == null ? (c.dataset.goal ? 'aucun' : 'rien de saisi') : fmt1(c.raw) + ' ' + c.dataset.unit}`
          } }
        },
        scales: {
          x: { ticks: { color: tick, maxRotation: 0, autoSkip: true }, grid: { color: grid } },
          kcal: { display: hasK, position: 'left', beginAtZero: true, ticks: { color: tick }, grid: { color: grid }, title: { display: true, text: 'kcal', color: tick } },
          g: { display: hasG, position: hasK ? 'right' : 'left', beginAtZero: true, ticks: { color: tick }, grid: { display: !hasK, color: grid }, title: { display: true, text: 'g', color: tick } }
        }
      }
    });
    // Moyenne des jours saisis, pour les courbes affichées
    const logged = rows.filter(Boolean);
    $('#avgLine').innerHTML = !logged.length ? 'Rien de saisi sur cette période.'
      : `Moyenne sur ${logged.length} jour${logged.length > 1 ? 's' : ''} saisi${logged.length > 1 ? 's' : ''} (sur ${days.length}) : ` +
        NUTRIENTS.filter(n => shown.has(n.k)).map(n => {
          const vals = logged.map(r => r.sum[n.k]).filter(v => v != null);
          return `${n.label.toLowerCase()} <b>${vals.length ? fmt1(vals.reduce((a, b) => a + b, 0) / vals.length) + ' ' + n.unit : '–'}</b>`;
        }).join(' · ');
  }

  // Nombre de fois où chaque plat / aliment a été mangé sur la période
  function counts(days) {
    const inRange = new Set(days), dishes = new Map(), foods = new Map();
    const bump = (map, key, name) => { const c = map.get(key) || { name, n: 0 }; c.n++; map.set(key, c); };
    for (const e of DB.entries) {
      if (!inRange.has(e.date)) continue;
      if (e.kind === 'food') bump(foods, e.ref, entryName(e));
      else {
        bump(dishes, e.ref, entryName(e));
        for (const i of dishById(e.ref)?.items || []) { const f = foodById(i.food); if (f) bump(foods, f.id, f.name); }
      }
    }
    const top = map => {
      const all = [...map.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'fr'));
      if (all.length <= PIE.length) return all;
      const rest = all.slice(PIE.length - 1).reduce((s, c) => s + c.n, 0);
      return [...all.slice(0, PIE.length - 1), { name: 'Autres', n: rest }];
    };
    return { dishes: top(dishes), foods: top(foods) };
  }

  function renderPie(old, canvas, legend, data) {
    old?.destroy();
    if (!data.length) { canvas.parentElement.hidden = true; legend.innerHTML = '<div class="mut">Rien de mangé sur cette période.</div>'; return null; }
    canvas.parentElement.hidden = false;
    const total = data.reduce((s, c) => s + c.n, 0);
    legend.innerHTML = data.map((c, i) => `
      <div class="leg"><i style="background:${PIE[i]}"></i><span>${esc(c.name)}</span><b>${c.n}×</b><span class="mut">${fmt1(c.n / total * 100)} %</span></div>`).join('');
    return new Chart(canvas, {
      type: 'doughnut',
      data: { labels: data.map(c => c.name), datasets: [{ data: data.map(c => c.n), backgroundColor: PIE.slice(0, data.length), borderColor: css('--card'), borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: false, cutout: '55%',
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ` ${c.label} : ${c.raw} fois` } } } }
    });
  }

  function render() {
    const [a, b] = period();
    const days = Array.from({ length: dayDiff(a, b) + 1 }, (_, i) => addDays(a, i));
    $('#customRange').hidden = range !== 'custom';
    $('#rangeFrom').value = from; $('#rangeTo').value = to;
    $('#rangeLabel').textContent = `du ${dateLabel(a, { day: 'numeric', month: 'long' })} au ${dateLabel(b, { day: 'numeric', month: 'long', year: 'numeric' })}`;
    renderSeries();
    renderLine(days, days.map(dayTotals));
    const c = counts(days);
    pieDishes = renderPie(pieDishes, $('#chDishes'), $('#dishTop'), c.dishes);
    pieFoods = renderPie(pieFoods, $('#chFoods'), $('#foodTop'), c.foods);
  }

  $('#range').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    range = b.dataset.v;
    for (const x of $('#range').children) x.classList.toggle('on', x === b);
    render();
  });
  $('#rangeFrom').addEventListener('change', e => { if (e.target.value) { from = e.target.value; render(); } });
  $('#rangeTo').addEventListener('change', e => { if (e.target.value) { to = e.target.value; render(); } });
  // Clic sur une courbe de la liste : affichée / masquée (au moins une reste affichée)
  $('#series').addEventListener('click', e => {
    if (e.target.closest('[data-goals]')) { showGoals = !showGoals; render(); return; }
    const b = e.target.closest('[data-k]');
    if (!b) return;
    if (shown.has(b.dataset.k)) { if (shown.size > 1) shown.delete(b.dataset.k); }
    else shown.add(b.dataset.k);
    render();
  });

  return { render };
})();
