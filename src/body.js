'use strict';
// Corps : pas du jour (Hub), poids, masse grasse et IMC (Stats), taille (Paramètres).

const Body = (() => {
  const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const charts = {};
  const intText = n => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });

  // ---- Pas du jour (Hub) ----
  const stepsInput = $('#stepsInput');
  function renderSteps() {
    if (document.activeElement !== stepsInput) stepsInput.value = stepsFor(Hub.day) ?? '';
    $('#stepsErr').textContent = '';
  }
  function saveSteps() {
    const raw = stepsInput.value.replace(/\s/g, '');
    const err = $('#stepsErr');
    const i = DB.steps.findIndex(s => s.date === Hub.day);
    if (!raw) {
      if (i >= 0) { DB.steps.splice(i, 1); save(); }
      err.textContent = ''; return;
    }
    if (!/^\d+$/.test(raw) || +raw > 200000) return err.textContent = 'Nombre de pas invalide.';
    err.textContent = '';
    if (i >= 0) { if (DB.steps[i].steps === +raw) return; DB.steps[i].steps = +raw; }
    else DB.steps.push({ id: crypto.randomUUID(), date: Hub.day, steps: +raw });
    stepsInput.value = raw;
    save();
  }
  stepsInput.addEventListener('change', saveSteps);
  stepsInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveSteps(); stepsInput.blur(); } });

  // ---- Mesures (Stats) ----
  const form = $('#measureForm');
  form.elements.date.value = today();
  form.addEventListener('submit', e => {
    e.preventDefault();
    const err = $('#measureErr'), date = form.elements.date.value;
    const weight = parseNum(form.elements.weight.value), fat = parseNum(form.elements.fat.value);
    if (!date) return err.textContent = 'Choisis une date.';
    if (Number.isNaN(weight) || (weight != null && (weight < 20 || weight > 400))) return err.textContent = 'Poids invalide (en kg, ex. 75,4).';
    if (Number.isNaN(fat) || (fat != null && (fat < 1 || fat > 75))) return err.textContent = 'Masse grasse invalide (en %, ex. 18,5).';
    if (weight == null && fat == null) return err.textContent = 'Renseigne au moins le poids ou la masse grasse.';
    err.textContent = '';
    const old = DB.measures.find(m => m.date === date);
    if (old) Object.assign(old, { weight, fat });
    else DB.measures.push({ id: crypto.randomUUID(), date, weight, fat });
    form.elements.weight.value = ''; form.elements.fat.value = '';
    save(); App.render();
  });

  function renderList() {
    const list = [...DB.measures].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
    $('#measureList').innerHTML = list.length ? list.map(m => `
      <div class="measure" data-id="${m.id}">
        <span>${dateLabel(m.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
        <b>${m.weight == null ? '–' : fmt(m.weight) + ' kg'}</b>
        <span>${m.fat == null ? '–' : fmt(m.fat) + ' %'}</span>
        <span class="mut">${bmi(m.weight) == null ? '' : 'IMC ' + fmt1(bmi(m.weight))}</span>
        <button type="button" class="icon-btn" data-del title="Supprimer">✕</button>
      </div>`).join('') : '<div class="mut small">Aucune mesure pour l\'instant.</div>';
  }
  // Suppression en deux clics
  $('#measureList').addEventListener('click', e => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = 'Confirmer'; return; }
    DB.measures = DB.measures.filter(m => m.id !== b.closest('.measure').dataset.id);
    save(); App.render();
  });

  // Une petite courbe sur les jours de la période (pointillé entre deux mesures espacées)
  function lineChart(key, canvas, days, data, unit, color, bars = false) {
    charts[key]?.destroy();
    const tick = css('--mut'), grid = css('--bd');
    charts[key] = new Chart(canvas, {
      type: bars ? 'bar' : 'line',
      data: {
        labels: days.map(d => dateLabel(d, days.length <= 7 ? { weekday: 'short', day: 'numeric', month: 'numeric' } : { day: 'numeric', month: 'numeric' })),
        datasets: [{
          data, borderColor: color, backgroundColor: bars ? color + 'cc' : color, borderRadius: 4,
          tension: .25, pointRadius: days.length > 62 ? 2 : 3, spanGaps: true,
          segment: { borderDash: c => c.p1DataIndex - c.p0DataIndex > 1 ? [5, 5] : undefined }
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { title: i => dateLabel(days[i[0].dataIndex]), label: c => ` ${unit === 'pas' ? intText(c.raw) : fmt1(c.raw)} ${unit}` } } },
        scales: {
          x: { ticks: { color: tick, maxRotation: 0, autoSkip: true }, grid: { color: grid } },
          y: { beginAtZero: bars, grace: '5%', ticks: { color: tick }, grid: { color: grid } }
        }
      }
    });
  }
  // Dernière valeur de la période et évolution depuis la première
  function info(vals, unit, digits = fmt1) {
    const known = vals.filter(v => v != null);
    if (!known.length) return 'aucune mesure sur la période';
    const last = known[known.length - 1], diff = last - known[0], u = unit ? ' ' + unit : '';
    return `${digits(last)}${u}` + (known.length > 1 ? ` · ${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${fmt1(Math.abs(diff))}${u} sur la période` : '');
  }

  function renderStats(days) {
    renderList();
    const m = new Map(DB.measures.map(x => [x.date, x]));
    const weights = days.map(d => m.get(d)?.weight ?? null);
    const fats = days.map(d => m.get(d)?.fat ?? null);
    const bmis = weights.map(w => w == null ? null : Math.round(bmi(w) * 10) / 10 || null);
    const steps = days.map(stepsFor);
    lineChart('weight', $('#chWeight'), days, weights, 'kg', css('--acc'));
    lineChart('fat', $('#chFat'), days, fats, '%', css('--fat'));
    lineChart('bmi', $('#chBmi'), days, height() ? bmis : days.map(() => null), '', css('--prot'));
    lineChart('steps', $('#chSteps'), days, steps, 'pas', css('--carb'), true);
    $('#weightInfo').textContent = info(weights, 'kg');
    $('#fatInfo').textContent = info(fats, '%');
    $('#bmiInfo').textContent = height() ? info(bmis, '') : 'renseigne ta taille dans les Paramètres';
    const known = steps.filter(v => v != null);
    $('#stepsInfo').textContent = known.length ? `moyenne ${intText(known.reduce((a, b) => a + b, 0) / known.length)} pas sur ${known.length} jour${known.length > 1 ? 's' : ''} saisi${known.length > 1 ? 's' : ''}` : 'aucun jour saisi sur la période';
  }

  // ---- Taille (Paramètres) ----
  const heightInput = $('#heightInput');
  function renderHeight() { if (document.activeElement !== heightInput) heightInput.value = inputVal(height()); }
  heightInput.addEventListener('change', () => {
    const v = parseNum(heightInput.value), err = $('#heightErr');
    if (Number.isNaN(v) || (v != null && (v < 50 || v > 250))) return err.textContent = 'Taille invalide (en cm, ex. 178).';
    err.textContent = '';
    if (DB.profile[0]) DB.profile[0].height = v;
    else DB.profile.push({ id: 'profile', height: v });
    save(); App.render();
  });
  heightInput.addEventListener('keydown', e => { if (e.key === 'Enter') heightInput.blur(); });

  return { renderSteps, renderStats, renderHeight };
})();
