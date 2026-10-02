'use strict';
// Bibliothèque d'aliments. Les valeurs sont gardées exactement comme saisies.

const Foods = (() => {
  let editing = null;   // aliment ouvert dans la fiche, null = nouveau

  function render(query, wanted) {
    const q = norm(query);
    const list = DB.foods.filter(f => (!q || norm(f.name).includes(q)) && hasTags(f, wanted)).sort(byName);
    $('#foodCount').textContent = DB.foods.length || '';
    $('#foodGrid').innerHTML = list.map(f => `
      <button class="card" data-id="${f.id}">
        <div class="thumb">${thumbHtml(f)}</div>
        <div class="card-body">
          <div class="name">${esc(f.name)}</div>
          ${f.unit ? `
          <div class="mut small">par pièce (${fmt(f.unit)} g) · ${fmt(f.kcal)} kcal pour ${fmt(f.ref)} g</div>
          <div class="kcal"><b>${fmt1(perPiece(f).kcal)}</b> kcal <span class="mut small">la pièce</span></div>
          ${macrosHtml(perPiece(f), fmt1)}` : `
          <div class="mut small">pour ${fmt(f.ref)} g</div>
          <div class="kcal"><b>${fmt(f.kcal)}</b> kcal</div>
          ${macrosHtml(f)}`}
          ${tagsHtml(f.tags)}
        </div>
      </button>`).join('');
    const empty = $('#foodEmpty');
    empty.hidden = list.length > 0;
    empty.textContent = DB.foods.length ? 'Aucun aliment ne correspond à la recherche ou aux filtres.' : 'La bibliothèque est vide. Ajoute ton premier aliment.';
  }

  $('#foodNut').innerHTML = `<tr><th></th><th>Valeur</th></tr>` + NUTRIENTS.map(n => `
    <tr class="${n.parent ? 'sub' : ''}">
      <td>${n.label}${n.required ? ' <span class="req">*</span>' : ''}</td>
      <td><span class="ref"><input name="${n.k}" inputmode="decimal" ${n.required ? 'required' : 'placeholder="inconnu"'}><b>${n.unit}</b></span></td>
    </tr>`).join('');

  const usedIn = food => DB.dishes.filter(d => d.items.some(i => i.food === food.id));

  const m = modal('foodOverlay', {
    onSubmit() {
      const el = m.form.elements;
      const name = el.name.value.trim().replace(/\s+/g, ' ');
      if (!name) return m.error('Le nom est obligatoire.');
      if (DB.foods.some(f => f !== editing && norm(f.name) === norm(name))) return m.error(`« ${name} » existe déjà dans la bibliothèque.`);
      const ref = parseNum(el.ref.value);
      if (!(ref > 0)) return m.error('La quantité de référence doit être un nombre supérieur à 0.');
      const unit = parseNum(el.unit.value);
      if (Number.isNaN(unit) || unit === 0) return m.error('Le poids d\'une pièce doit être un nombre supérieur à 0, ou rester vide.');
      const values = {};
      for (const n of NUTRIENTS) {
        const v = parseNum(el[n.k].value);
        if (Number.isNaN(v)) return m.error(`${n.label} : nombre invalide (ex. 12,5).`);
        if (n.required && v == null) return m.error(`${n.label} est obligatoire.`);
        values[n.k] = v;
      }
      for (const n of NUTRIENTS) {
        if (n.parent && values[n.k] != null && values[n.parent] != null && values[n.k] > values[n.parent]) {
          return m.error(`${n.label} ne peut pas dépasser ${NUTRIENTS.find(p => p.k === n.parent).label.toLowerCase()}.`);
        }
      }
      const image = photo.get(), tags = tagBox.get(), now = new Date().toISOString();
      if (editing) {
        // Plus de poids à la pièce : les ingrédients comptés en pièces passent en grammes, au même poids
        if (editing.unit && unit == null) {
          for (const d of usedIn(editing)) for (const i of d.items) {
            if (i.food === editing.id && i.mode === 'piece') Object.assign(i, { mode: 'g', qty: i.qty * editing.unit });
          }
          for (const e of DB.entries) {
            if (e.kind === 'food' && e.ref === editing.id && e.mode === 'piece') Object.assign(e, { mode: 'g', qty: e.qty * editing.unit });
          }
        }
        Object.assign(editing, { name, tags, ref, unit, ...values, image, updated: now });
      } else {
        DB.foods.push({ id: crypto.randomUUID(), name, tags, ref, unit, ...values, image, created: now, updated: now });
      }
      save(); m.close(); App.render();
    },
    onDelete() {
      const dishes = usedIn(editing);
      if (dishes.length) return m.error(`Impossible : utilisé dans ${dishes.map(d => `« ${d.name} »`).join(', ')}. Retire-le d'abord de ces plats.`);
      freezeEntries('food', editing.id);
      DB.foods = DB.foods.filter(f => f !== editing);
      save(); m.close(); App.render();
    }
  });
  const photo = photoField($('#foodPhoto'), m.error);
  const tagBox = tagField($('#foodTags'), () => DB.foods);

  function open(food) {
    editing = food || null;
    const el = m.form.elements;
    m.form.reset();
    el.name.value = food?.name || '';
    el.ref.value = food ? inputVal(food.ref) : '100';
    el.unit.value = inputVal(food?.unit);
    for (const n of NUTRIENTS) el[n.k].value = inputVal(food?.[n.k]);
    photo.set(food?.image);
    tagBox.set(food?.tags);
    m.open(food ? 'Modifier l\'aliment' : 'Nouvel aliment', !!food);
  }

  $('#foodGrid').addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (card) open(foodById(card.dataset.id));
  });

  return { render, open, modal: m };
})();
