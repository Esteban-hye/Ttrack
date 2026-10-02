'use strict';
// Bibliothèque de plats : des aliments de la bibliothèque, en grammes ou en pièces.
// Les totaux sont recalculés à partir des aliments : modifier un aliment met à jour ses plats.

const Dishes = (() => {
  let editing = null;   // plat ouvert dans la fiche, null = nouveau
  let rows = [];        // ingrédients en cours d'édition : { food, qty, mode, text }
  let hl = 0;           // ligne surlignée dans la liste de choix

  function render(query, wanted) {
    const q = norm(query);
    const list = DB.dishes.filter(d => (!q || norm(d.name).includes(q)) && hasTags(d, wanted)).sort(byName);
    $('#dishCount').textContent = DB.dishes.length || '';
    $('#dishGrid').innerHTML = list.map(d => {
      const { sum } = totals(d.items);
      return `
      <button class="card" data-id="${d.id}">
        <div class="thumb">${thumbHtml(d)}</div>
        <div class="card-body">
          <div class="name">${esc(d.name)}</div>
          <div class="mut small">${d.items.length} ingrédient${d.items.length > 1 ? 's' : ''} · ${fmt1(sum.grams)} g</div>
          <div class="kcal"><b>${fmt1(sum.kcal)}</b> kcal</div>
          ${macrosHtml(sum, fmt1)}
          ${tagsHtml(d.tags)}
        </div>
      </button>`;
    }).join('');
    const empty = $('#dishEmpty');
    empty.hidden = list.length > 0;
    empty.textContent = DB.dishes.length ? 'Aucun plat ne correspond à la recherche ou aux filtres.'
      : DB.foods.length ? 'Aucun plat pour l\'instant. Crée ton premier plat.' : 'Ajoute d\'abord des aliments dans l\'onglet Aliments : un plat se compose d\'aliments de la bibliothèque.';
  }

  // ---- Ingrédients ----
  const unitLabel = (row, food) => row.mode === 'piece' ? (row.qty > 1 ? 'pièces' : 'pièce') : 'g';

  function renderRows() {
    const box = $('#ingRows');
    if (!rows.length) { box.innerHTML = '<div class="mut small ing-empty">Aucun ingrédient. Cherche un aliment ci-dessus pour l\'ajouter.</div>'; renderTotals(); return; }
    box.innerHTML = rows.map((r, i) => {
      const food = foodById(r.food);
      return `
      <div class="ing" data-i="${i}">
        <div class="ing-thumb">${thumbHtml(food)}</div>
        <div class="ing-name">${esc(food.name)}</div>
        <input class="ing-qty${r.qty > 0 ? '' : ' bad'}" value="${esc(r.text)}" inputmode="decimal">
        ${food.unit ? `<div class="seg"><button type="button" data-mode="g" class="${r.mode === 'g' ? 'on' : ''}">g</button><button type="button" data-mode="piece" class="${r.mode === 'piece' ? 'on' : ''}">pièce</button></div>`
          : '<div class="seg-none">g</div>'}
        <div class="ing-calc mut small"></div>
        <button type="button" class="icon-btn" data-remove title="Retirer">✕</button>
      </div>`;
    }).join('');
    rows.forEach((_, i) => renderCalc(i));
    renderTotals();
  }

  // Grammes et kcal d'une ligne, mis à jour pendant la frappe
  function renderCalc(i) {
    const r = rows[i], food = foodById(r.food), el = $(`#ingRows .ing[data-i="${i}"] .ing-calc`);
    if (!(r.qty > 0)) { el.textContent = 'quantité invalide'; return; }
    const g = ingGrams(r, food);
    el.textContent = `${r.mode === 'piece' ? `${fmt1(g)} g · ` : ''}${fmt1(food.kcal * g / food.ref)} kcal`;
  }

  function renderTotals() {
    const valid = rows.filter(r => r.qty > 0);
    const { sum, missing } = totals(valid);
    const per100 = v => v == null || !sum.grams ? null : v * 100 / sum.grams;
    const star = k => missing[k].length && sum[k] != null ? `<span class="partial" title="Inconnu pour : ${esc(missing[k].join(', '))}">*</span>` : '';
    const withUnit = (v, u) => v == null ? '–' : `${fmt1(v)} ${u}`;
    const anyPartial = NUTRIENTS.some(n => missing[n.k].length);
    $('#dishTotals').innerHTML = `
      <tr><th></th><th>Plat entier</th><th>Pour 100 g</th></tr>
      <tr class="weight"><td>Poids total</td><td>${fmt1(sum.grams)} g</td><td></td></tr>` +
      NUTRIENTS.map(n => `
      <tr class="${n.parent ? 'sub' : ''}">
        <td>${n.label}</td>
        <td>${withUnit(sum[n.k], n.unit)}${star(n.k)}</td>
        <td>${withUnit(per100(sum[n.k]), n.unit)}</td>
      </tr>`).join('') +
      (anyPartial ? `<tr class="note"><td colspan="3">* une partie des aliments n'a pas cette valeur, le total est incomplet (survoler pour voir lesquels). – = inconnu pour tous.</td></tr>` : '');
  }

  $('#ingRows').addEventListener('input', e => {
    if (!e.target.classList.contains('ing-qty')) return;
    const i = +e.target.closest('.ing').dataset.i, r = rows[i];
    r.text = e.target.value;
    r.qty = parseNum(r.text);
    e.target.classList.toggle('bad', !(r.qty > 0));
    renderCalc(i); renderTotals();
  });
  $('#ingRows').addEventListener('click', e => {
    const line = e.target.closest('.ing');
    if (!line) return;
    const r = rows[+line.dataset.i], food = foodById(r.food);
    if (e.target.closest('[data-remove]')) { rows.splice(+line.dataset.i, 1); renderRows(); return; }
    const mode = e.target.closest('[data-mode]')?.dataset.mode;
    if (!mode || mode === r.mode) return;
    // Pièces → grammes : même poids exact. Grammes → pièces : nombre de pièces le plus proche.
    if (r.qty > 0) r.qty = mode === 'g' ? r.qty * food.unit : Math.max(1, Math.round(r.qty / food.unit));
    else r.qty = mode === 'g' ? food.ref : 1;
    r.mode = mode; r.text = inputVal(r.qty);
    renderRows();
  });

  // ---- Choix d'un aliment ----
  const search = $('#ingSearch'), list = $('#ingList');
  const matches = () => { const q = norm(search.value); return DB.foods.filter(f => !q || norm(f.name).includes(q)).sort(byName); };
  function renderList() {
    const found = matches();
    hl = Math.min(hl, Math.max(0, found.length - 1));
    list.innerHTML = found.length ? found.map((f, i) => `
      <div class="pick-item${i === hl ? ' hl' : ''}" data-id="${f.id}">
        <div class="ing-thumb">${thumbHtml(f)}</div>
        <span>${esc(f.name)}</span>
        <span class="mut small">${fmt(f.kcal)} kcal / ${fmt(f.ref)} g${f.unit ? ` · pièce ${fmt(f.unit)} g` : ''}</span>
      </div>`).join('')
      : `<div class="mut small pick-none">${DB.foods.length ? 'Aucun aliment trouvé.' : 'La bibliothèque d\'aliments est vide.'}</div>`;
    list.hidden = false;
    list.querySelector('.hl')?.scrollIntoView({ block: 'nearest' });
  }
  function addFood(food) {
    const existing = rows.findIndex(r => r.food === food.id);
    if (existing < 0) {
      const piece = !!food.unit;
      rows.push({ food: food.id, mode: piece ? 'piece' : 'g', qty: piece ? 1 : food.ref, text: inputVal(piece ? 1 : food.ref) });
      renderRows();
    }
    // Déjà dans le plat : on va directement à sa quantité
    const i = existing < 0 ? rows.length - 1 : existing;
    search.value = ''; list.hidden = true;
    const qty = $(`#ingRows .ing[data-i="${i}"] .ing-qty`);
    qty.focus(); qty.select();
  }
  search.addEventListener('focus', () => { hl = 0; renderList(); });
  search.addEventListener('input', () => { hl = 0; renderList(); });
  search.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 150));
  search.addEventListener('keydown', e => {
    const found = matches();
    if (e.key === 'ArrowDown') { e.preventDefault(); hl = Math.min(hl + 1, found.length - 1); renderList(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); hl = Math.max(hl - 1, 0); renderList(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (found[hl]) addFood(found[hl]); }
    else if (e.key === 'Escape' && !list.hidden) { e.stopPropagation(); list.hidden = true; }
  });
  list.addEventListener('mousedown', e => {
    const item = e.target.closest('.pick-item');
    if (item) { e.preventDefault(); addFood(foodById(item.dataset.id)); }
  });
  // Entrée dans une quantité : retour à la recherche pour enchaîner les ingrédients
  $('#ingRows').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.classList.contains('ing-qty')) { e.preventDefault(); search.focus(); }
  });

  // ---- Fiche ----
  const m = modal('dishOverlay', {
    onSubmit() {
      const name = m.form.elements.name.value.trim().replace(/\s+/g, ' ');
      if (!name) return m.error('Le nom est obligatoire.');
      if (DB.dishes.some(d => d !== editing && norm(d.name) === norm(name))) return m.error(`« ${name} » existe déjà dans les plats.`);
      if (!rows.length) return m.error('Ajoute au moins un ingrédient.');
      const bad = rows.find(r => !(r.qty > 0));
      if (bad) return m.error(`Quantité invalide pour « ${foodById(bad.food).name} » (ex. 120 ou 1,5).`);
      const items = rows.map(({ food, qty, mode }) => ({ food, qty, mode }));
      const image = photo.get(), tags = tagBox.get(), now = new Date().toISOString();
      if (editing) Object.assign(editing, { name, tags, items, image, updated: now });
      else DB.dishes.push({ id: crypto.randomUUID(), name, tags, items, image, created: now, updated: now });
      save(); m.close(); App.render();
    },
    onDelete() {
      freezeEntries('dish', editing.id);
      DB.dishes = DB.dishes.filter(d => d !== editing);
      save(); m.close(); App.render();
    }
  });
  const photo = photoField($('#dishPhoto'), m.error);
  const tagBox = tagField($('#dishTags'), () => DB.dishes);

  function open(dish) {
    editing = dish || null;
    m.form.reset();
    m.form.elements.name.value = dish?.name || '';
    rows = (dish?.items || []).map(i => ({ ...i, text: inputVal(i.qty) }));
    search.value = ''; list.hidden = true;
    renderRows();
    photo.set(dish?.image);
    tagBox.set(dish?.tags);
    m.open(dish ? 'Modifier le plat' : 'Nouveau plat', !!dish);
  }

  $('#dishGrid').addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (card) open(DB.dishes.find(d => d.id === card.dataset.id));
  });

  return { render, open, modal: m };
})();
