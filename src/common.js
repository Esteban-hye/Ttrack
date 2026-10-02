'use strict';
// Outils partagés par les aliments et les plats.

// Ordre de l'étiquette nutritionnelle européenne. Valeur vide = inconnue (≠ 0).
const NUTRIENTS = [
  { k: 'kcal', label: 'Énergie', unit: 'kcal', required: true },
  { k: 'fat', label: 'Matières grasses', unit: 'g' },
  { k: 'sat', label: 'dont acides gras saturés', unit: 'g', parent: 'fat' },
  { k: 'carb', label: 'Glucides', unit: 'g' },
  { k: 'sugar', label: 'dont sucres', unit: 'g', parent: 'carb' },
  { k: 'fiber', label: 'Fibres', unit: 'g' },
  { k: 'prot', label: 'Protéines', unit: 'g' },
  { k: 'salt', label: 'Sel', unit: 'g' }
];

const DB = { foods: [], dishes: [], entries: [], goals: [], measures: [], steps: [], profile: [] };
// Enregistre sur ce PC, puis synchronise peu après si le cloud est connecté
const save = () => { window.ttrack.save(DB); if (typeof Cloud !== 'undefined') Cloud.soon(); };

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const byName = (a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
// Valeur saisie : affichée telle quelle. Valeur calculée : arrondie au dixième.
const fmt = n => n == null ? '–' : n.toLocaleString('fr-FR', { maximumFractionDigits: 6 });
const fmt1 = n => n == null ? '–' : (Math.round(n * 10) / 10).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const inputVal = n => n == null ? '' : fmt(n).replace(/\s/g, '');
const imgUrl = name => `ttimg://${encodeURIComponent(name)}`;
const foodById = id => DB.foods.find(f => f.id === id);
const dishById = id => DB.dishes.find(d => d.id === id);

// "12,5" ou "12.5" → 12.5 ; vide → null ; invalide → NaN
function parseNum(s) {
  const t = String(s).replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  return /^(\d+(\.\d*)?|\.\d+)$/.test(t) ? Number(t) : NaN;
}

const thumbHtml = x => x.image ? `<img src="${imgUrl(x.image)}" alt="">` : `<span>${esc(x.name.charAt(0).toUpperCase())}</span>`;
const macrosHtml = (v, f = fmt) => `<div class="macros">
  <span class="m prot">P ${f(v.prot)}</span><span class="m carb">G ${f(v.carb)}</span><span class="m fat">L ${f(v.fat)}</span></div>`;

// ---- Ingrédients d'un plat ----
// Un ingrédient compte en grammes, ou en pièces si l'aliment a un poids à la pièce.
const ingGrams = (ing, food) => ing.mode === 'piece' ? ing.qty * food.unit : ing.qty;

// Totaux d'une liste d'ingrédients. missing[k] = aliments dont la valeur k est inconnue.
function totals(items) {
  const sum = { grams: 0 }, missing = {};
  for (const n of NUTRIENTS) { sum[n.k] = null; missing[n.k] = []; }
  for (const ing of items) {
    const food = foodById(ing.food);
    if (!food) continue;
    const g = ingGrams(ing, food);
    sum.grams += g;
    for (const n of NUTRIENTS) {
      if (food[n.k] == null) missing[n.k].push(food.name);
      else sum[n.k] = (sum[n.k] || 0) + food[n.k] * g / food.ref;
    }
  }
  return { sum, missing };
}

// ---- Journal ----
// Une entrée : { id, date, kind: 'food'|'dish', ref, qty, mode, name }.
// mode : 'g' ou 'piece' pour un aliment, 'dish' (nombre de plats) ou 'g' pour un plat.
// Les valeurs sont calculées depuis la bibliothèque : corriger un aliment corrige aussi les jours passés.
// Si l'aliment ou le plat est supprimé, l'entrée garde une copie figée de ses valeurs (snap).

const pad = n => String(n).padStart(2, '0');
const dateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => dateStr(new Date());
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return dateStr(d); };
const dayDiff = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const dateLabel = (s, opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) => new Date(s + 'T12:00:00').toLocaleDateString('fr-FR', opts);

const entrySource = e => e.kind === 'food' ? foodById(e.ref) : dishById(e.ref);
const entryName = e => entrySource(e)?.name ?? e.name;

// Grammes et valeurs d'une entrée, avec les aliments dont une valeur est inconnue
function entryValues(e) {
  const src = entrySource(e);
  if (!src) return e.snap || { sum: { grams: 0 }, missing: {} };
  if (e.kind === 'food') return totals([{ food: src.id, qty: e.qty, mode: e.mode }]);
  const t = totals(src.items);
  const factor = e.mode === 'g' ? (t.sum.grams ? e.qty / t.sum.grams : 0) : e.qty;
  const sum = { grams: t.sum.grams * factor };
  for (const n of NUTRIENTS) sum[n.k] = t.sum[n.k] == null ? null : t.sum[n.k] * factor;
  return { sum, missing: t.missing };
}

const dayEntries = date => DB.entries.filter(e => e.date === date);

// Totaux d'un jour ; null s'il n'y a rien de saisi ce jour-là
function dayTotals(date) {
  const list = dayEntries(date);
  if (!list.length) return null;
  const sum = { grams: 0 }, missing = {};
  for (const n of NUTRIENTS) { sum[n.k] = null; missing[n.k] = new Set(); }
  for (const e of list) {
    const v = entryValues(e);
    sum.grams += v.sum.grams;
    for (const n of NUTRIENTS) {
      if (v.sum[n.k] != null) sum[n.k] = (sum[n.k] || 0) + v.sum[n.k];
      for (const name of v.missing[n.k] || []) missing[n.k].add(name);
    }
  }
  return { sum, missing };
}

// Fige les valeurs des entrées qui utilisent un aliment ou un plat sur le point d'être supprimé
function freezeEntries(kind, id) {
  for (const e of DB.entries) if (e.kind === kind && e.ref === id) { e.snap = entryValues(e); e.name = entryName(e); }
}

// Corps : une mesure par jour { id, date, weight (kg), fat (%) } ; pas : { id, date, steps } ; profil : [{ id: 'profile', height (cm) }]
const height = () => DB.profile[0]?.height || null;
const bmi = kg => height() && kg ? kg / (height() / 100) ** 2 : null;
const stepsFor = date => DB.steps.find(s => s.date === date)?.steps ?? null;

// Objectifs : chaque réglage s'applique à partir de sa date (from), jusqu'au réglage suivant
const goalFor = date => DB.goals.filter(g => g.from <= date).sort((a, b) => a.from.localeCompare(b.from)).pop() || null;

// ---- Fiche (fenêtre de saisie) ----
function modal(overlayId, { onSubmit, onDelete }) {
  const overlay = document.getElementById(overlayId), form = overlay.querySelector('form');
  const del = form.querySelector('.del'), err = form.querySelector('.err');
  const m = {
    form, overlay,
    get isOpen() { return !overlay.hidden; },
    open(title, deletable) {
      form.querySelector('.title').textContent = title;
      err.textContent = '';
      del.hidden = !deletable; del.textContent = 'Supprimer'; del.classList.remove('armed');
      overlay.hidden = false;
      form.elements.name.focus();
    },
    close() { overlay.hidden = true; },
    error(msg) { err.textContent = msg; }
  };
  form.addEventListener('submit', e => { e.preventDefault(); err.textContent = ''; onSubmit(); });
  form.querySelector('.cancel').addEventListener('click', m.close);
  overlay.addEventListener('mousedown', e => { if (e.target === overlay) m.close(); });
  // Suppression en deux clics
  del.addEventListener('click', () => {
    if (!del.classList.contains('armed')) { del.classList.add('armed'); del.textContent = 'Confirmer la suppression'; return; }
    onDelete();
  });
  return m;
}

// ---- Tags ----
// Tous les tags d'une liste (aliments ou plats), triés, sans doublon de casse ou d'accent.
function allTags(items) {
  const seen = new Map();
  for (const x of items) for (const t of x.tags || []) if (!seen.has(norm(t))) seen.set(norm(t), t);
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
}
const tagsHtml = tags => tags?.length ? `<div class="tags">${tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : '';
// L'élément porte-t-il tous les tags choisis dans le filtre ?
const hasTags = (x, wanted) => wanted.every(w => (x.tags || []).some(t => norm(t) === norm(w)));

// Saisie de tags : Entrée ou virgule pour ajouter, ✕ ou Retour arrière pour retirer.
// Un tag déjà utilisé ailleurs garde son orthographe existante.
function tagField(container, getItems) {
  const listId = container.id + 'List';
  container.innerHTML = `<div class="tag-input"><span class="chips"></span><input list="${listId}" placeholder="ajouter un tag…"></div><datalist id="${listId}"></datalist>`;
  const chips = container.querySelector('.chips'), input = container.querySelector('input'), dl = container.querySelector('datalist');
  let tags = [];
  const draw = () => {
    chips.innerHTML = tags.map((t, i) => `<span class="tag">${esc(t)}<button type="button" data-i="${i}" title="Retirer">✕</button></span>`).join('');
    dl.innerHTML = allTags(getItems()).filter(t => !tags.some(x => norm(x) === norm(t))).map(t => `<option value="${esc(t)}">`).join('');
  };
  const add = raw => {
    const t = raw.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!t || tags.some(x => norm(x) === norm(t))) return;
    tags.push(allTags(getItems()).find(x => norm(x) === norm(t)) || t);
    draw();
  };
  const commit = () => { input.value.split(',').forEach(add); input.value = ''; };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
    else if (e.key === 'Backspace' && !input.value && tags.length) { tags.pop(); draw(); }
  });
  // Choix dans les suggestions : ajouté directement
  input.addEventListener('input', e => { if (e.inputType === 'insertReplacementText' || !e.inputType) commit(); });
  input.addEventListener('blur', commit);
  chips.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { tags.splice(+b.dataset.i, 1); draw(); } });
  container.addEventListener('click', e => { if (e.target === container.firstElementChild) input.focus(); });
  return { get: () => (commit(), [...tags]), set: t => { tags = [...(t || [])]; input.value = ''; draw(); } };
}

// ---- Photo : clic, glisser-déposer ou Ctrl+V ----
function photoField(container, onError) {
  container.innerHTML = `
    <div class="photo" tabindex="0" title="Cliquer pour choisir, glisser une image ou Ctrl+V"></div>
    <div class="photo-actions">
      <button type="button" class="btn sm pick">Choisir…</button>
      <button type="button" class="btn sm paste">Coller</button>
      <button type="button" class="btn sm danger unpick" hidden>Retirer</button>
    </div>`;
  const box = container.querySelector('.photo'), unpick = container.querySelector('.unpick');
  let name = '';
  const set = n => {
    name = n || '';
    box.innerHTML = name ? `<img src="${imgUrl(name)}" alt="">` : '<span>Photo<br><small>cliquer, glisser ou Ctrl+V</small></span>';
    box.classList.toggle('has', !!name);
    unpick.hidden = !name;
  };
  const pick = async () => { const n = await window.ttrack.pickImage(); if (n) set(n); };
  const paste = async () => { const n = await window.ttrack.pasteImage(); if (n) set(n); else onError('Le presse-papiers ne contient pas d\'image.'); };
  box.addEventListener('click', pick);
  box.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  container.querySelector('.pick').addEventListener('click', pick);
  container.querySelector('.paste').addEventListener('click', paste);
  unpick.addEventListener('click', () => set(''));
  box.addEventListener('dragover', e => { e.preventDefault(); box.classList.add('drag'); });
  box.addEventListener('dragleave', () => box.classList.remove('drag'));
  box.addEventListener('drop', async e => {
    e.preventDefault(); box.classList.remove('drag');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const n = await window.ttrack.dropImage(file);
    if (n) set(n); else onError('Format non pris en charge (PNG, JPG, WEBP ou GIF).');
  });
  // Ctrl+V quand la fiche est ouverte : une image copiée devient la photo, du texte se colle normalement
  document.addEventListener('paste', e => {
    if (container.closest('.overlay').hidden) return;
    if (![...e.clipboardData.items].some(i => i.type.startsWith('image/'))) return;
    e.preventDefault();
    paste();
  });
  set('');
  return { get: () => name, set };
}
