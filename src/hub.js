'use strict';
// Hub : la journée. Ce qui a été mangé, le total comparé à l'objectif, et l'ajout d'aliments ou de plats.

const Hub = (() => {
  let day = today();
  let kind = 'all';     // filtre du panneau d'ajout : all, food, dish
  let saveTimer = null;
  const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); };

  // ---- Résumé du jour ----
  function renderSummary() {
    const t = dayTotals(day), goal = goalFor(day);
    const val = k => t?.sum[k] ?? null;
    const star = k => t && t.missing[k].size && t.sum[k] != null
      ? `<span class="partial" title="Inconnu pour : ${esc([...t.missing[k]].join(', '))}">*</span>` : '';
    const bar = (v, g) => {
      if (!(g > 0)) return '';
      const pct = (v || 0) / g * 100;
      return `<div class="bar"><div class="${pct > 100 ? 'over' : ''}" style="width:${Math.min(pct, 100)}%"></div></div>`;
    };
    const kcal = val('kcal'), gk = goal?.kcal;
    const rest = gk > 0 ? gk - (kcal || 0) : null;
    $('#daySummary').innerHTML = `
      <div class="kcal-head">
        <div><span class="big">${fmt1(kcal ?? 0)}</span> kcal${star('kcal')}
          ${gk > 0 ? `<span class="mut"> / ${fmt(gk)} kcal</span>` : ''}</div>
        <div class="mut">${rest == null ? 'Objectif pas encore défini' : rest >= 0 ? `reste <b>${fmt1(rest)}</b> kcal` : `<span class="over-txt">dépassé de <b>${fmt1(-rest)}</b> kcal</span>`}</div>
      </div>
      ${bar(kcal, gk)}
      <div class="goal-grid">
        ${NUTRIENTS.filter(n => n.k !== 'kcal' && !n.parent).map(p => `
          <div class="goal-group">${NUTRIENTS.filter(n => n === p || n.parent === p.k).map(n => `
            <div class="goal ${n.parent ? 'sub' : ''}">
              <div class="goal-top"><span>${n.label}</span>
                <span><b>${val(n.k) == null ? '–' : fmt1(val(n.k)) + ' g'}</b>${star(n.k)}${goal?.[n.k] > 0 ? `<span class="mut"> / ${fmt(goal[n.k])} g</span>` : ''}</span></div>
              ${bar(val(n.k), goal?.[n.k])}
            </div>`).join('')}
          </div>`).join('')}
      </div>
      ${t && NUTRIENTS.some(n => t.missing[n.k].size && t.sum[n.k] != null) ? '<div class="mut small">* valeur inconnue pour certains aliments : le total est incomplet (survoler pour voir lesquels).</div>' : ''}`;
  }

  // ---- Liste du jour ----
  const unitButtons = (e, src) => {
    const opts = e.kind === 'dish' ? [['dish', 'plat'], ['g', 'g']] : src.unit ? [['g', 'g'], ['piece', 'pièce']] : null;
    if (!opts) return '<div class="seg-none">g</div>';
    return `<div class="seg">${opts.map(([v, l]) => `<button type="button" data-mode="${v}" class="${e.mode === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  };
  const calcText = e => {
    const { sum } = entryValues(e);
    return `${fmt1(sum.grams)} g · <b>${fmt1(sum.kcal)} kcal</b> · <span class="m prot">P ${fmt1(sum.prot)}</span> <span class="m carb">G ${fmt1(sum.carb)}</span> <span class="m fat">L ${fmt1(sum.fat)}</span>`;
  };

  function renderList() {
    const list = dayEntries(day);
    $('#dayCount').textContent = list.length ? `· ${list.length}` : '';
    $('#dayList').innerHTML = list.length ? list.map(e => {
      const src = entrySource(e);
      return `
      <div class="entry${src ? '' : ' frozen'}" data-id="${e.id}">
        <div class="ing-thumb">${src ? thumbHtml(src) : `<span>${esc(e.name.charAt(0).toUpperCase())}</span>`}</div>
        <div class="entry-name"><span>${esc(entryName(e))}</span>${e.kind === 'dish' ? '<span class="kind">plat</span>' : ''}${src ? '' : '<span class="mut small">retiré de la bibliothèque</span>'}</div>
        ${src ? `<input class="ing-qty" value="${esc(inputVal(e.qty))}" inputmode="decimal">${unitButtons(e, src)}` : '<span></span><span></span>'}
        <div class="entry-calc small">${calcText(e)}</div>
        <button type="button" class="icon-btn" data-remove title="Retirer de la journée">✕</button>
      </div>`;
    }).join('') : '<div class="mut ing-empty">Rien pour ce jour. Ajoute un aliment ou un plat avec le panneau de droite.</div>';
  }

  $('#dayList').addEventListener('input', ev => {
    if (!ev.target.classList.contains('ing-qty')) return;
    const row = ev.target.closest('.entry'), e = DB.entries.find(x => x.id === row.dataset.id);
    const q = parseNum(ev.target.value);
    ev.target.classList.toggle('bad', !(q > 0));
    if (!(q > 0)) return;
    e.qty = q;
    row.querySelector('.entry-calc').innerHTML = calcText(e);
    renderSummary(); saveSoon();
  });
  // Entrée dans une quantité : retour à la recherche pour enchaîner
  $('#dayList').addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && ev.target.classList.contains('ing-qty')) { ev.preventDefault(); $('#addSearch').focus(); }
  });
  $('#dayList').addEventListener('click', ev => {
    const row = ev.target.closest('.entry');
    if (!row) return;
    const e = DB.entries.find(x => x.id === row.dataset.id);
    if (ev.target.closest('[data-remove]')) {
      DB.entries = DB.entries.filter(x => x !== e);
      save(); render(); return;
    }
    const mode = ev.target.closest('[data-mode]')?.dataset.mode;
    if (!mode || mode === e.mode) return;
    // Conversion en gardant le même poids (arrondi pour les pièces et les plats)
    const src = entrySource(e), grams = entryValues(e).sum.grams;
    if (mode === 'g') e.qty = grams;
    else if (mode === 'piece') e.qty = Math.max(1, Math.round(grams / src.unit));
    else { const whole = totals(src.items).sum.grams; e.qty = whole ? Math.round(grams / whole * 100) / 100 || 1 : 1; }
    e.mode = mode;
    save(); render();
  });

  // ---- Ajout ----
  function candidates() {
    const q = norm($('#addSearch').value);
    const match = x => !q || norm(x.name).includes(q) || (x.tags || []).some(t => norm(t).includes(q));
    const foods = kind === 'dish' ? [] : DB.foods.filter(match).map(x => ({ kind: 'food', x }));
    const dishes = kind === 'food' ? [] : DB.dishes.filter(match).map(x => ({ kind: 'dish', x }));
    return [...foods, ...dishes].sort((a, b) => byName(a.x, b.x));
  }
  function renderAdd() {
    const list = candidates();
    $('#addList').innerHTML = list.length ? list.map(({ kind: k, x }) => `
      <button class="add-item" data-kind="${k}" data-id="${x.id}">
        <div class="ing-thumb">${thumbHtml(x)}</div>
        <div class="add-name"><span>${esc(x.name)}</span>${k === 'dish' ? '<span class="kind">plat</span>' : ''}</div>
        <span class="mut small">${k === 'food' ? (x.unit ? `${fmt1(perPiece(x).kcal)} kcal / pièce` : `${fmt(x.kcal)} kcal / ${fmt(x.ref)} g`) : `${fmt1(totals(x.items).sum.kcal)} kcal`}</span>
      </button>`).join('')
      : `<div class="mut small ing-empty">${DB.foods.length || DB.dishes.length ? 'Rien ne correspond.' : 'La bibliothèque est vide : ajoute d\'abord des aliments.'}</div>`;
  }
  function add(k, id) {
    const src = k === 'food' ? foodById(id) : dishById(id);
    const mode = k === 'dish' ? 'dish' : src.unit ? 'piece' : 'g';
    const qty = mode === 'g' ? src.ref : 1;
    const e = { id: crypto.randomUUID(), date: day, kind: k, ref: id, qty, mode, name: src.name, created: new Date().toISOString() };
    DB.entries.push(e);
    save(); render();
    const input = $(`#dayList .entry[data-id="${e.id}"] .ing-qty`);
    input.focus(); input.select();
  }
  $('#addList').addEventListener('click', ev => {
    const b = ev.target.closest('.add-item');
    if (b) add(b.dataset.kind, b.dataset.id);
  });
  $('#addSearch').addEventListener('input', renderAdd);
  $('#addSearch').addEventListener('keydown', ev => {
    if (ev.key !== 'Enter') return;
    ev.preventDefault();
    const first = candidates()[0];
    if (first) { add(first.kind, first.x.id); $('#addSearch').value = ''; renderAdd(); }
  });
  $('#addKind').addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    kind = b.dataset.v;
    for (const x of $('#addKind').children) x.classList.toggle('on', x === b);
    renderAdd();
  });

  // ---- Navigation entre les jours ----
  function setDay(d) { if (d) { day = d; render(); } }
  $('#prevDay').addEventListener('click', () => setDay(addDays(day, -1)));
  $('#nextDay').addEventListener('click', () => setDay(addDays(day, 1)));
  $('#todayBtn').addEventListener('click', () => setDay(today()));
  $('#dayPick').addEventListener('change', ev => setDay(ev.target.value));

  function render() {
    const label = dateLabel(day);
    $('#dayLabel').textContent = (day === today() ? 'Aujourd\'hui · ' : '') + label.charAt(0).toUpperCase() + label.slice(1);
    $('#dayPick').value = day;
    $('#todayBtn').hidden = day === today();
    renderSummary(); renderList(); renderAdd();
    Body.renderSteps();
  }

  return { render, get day() { return day; }, setDay };
})();
