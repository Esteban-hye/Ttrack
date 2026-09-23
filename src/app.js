'use strict';
const api = window.ttrack;

// ================= Utilitaires =================
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pad = n => String(n).padStart(2, '0');
const ds = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toDate = s => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const todayStr = () => ds(new Date());
const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate() + n); return ds(d); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = s => { const t = String(s ?? '').replace(/\s/g, '').replace(',', '.'); if (t === '') return NaN; const n = Number(t); return isFinite(n) ? n : NaN; };
const numOr0 = s => { const n = num(s); return isFinite(n) ? n : 0; };
const fmt = (v, d = 1) => (Math.round((v || 0) * 10 ** d) / 10 ** d).toLocaleString('fr-FR', { maximumFractionDigits: d });
const kc = v => Math.round(v || 0).toLocaleString('fr-FR');
const eurFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const eur = v => eurFmt.format(v || 0);
const inputVal = v => (v || v === 0) && isFinite(v) ? String(Math.round(v * 100) / 100).replace('.', ',') : '';
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const WD = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

function dayLabel(s) {
  const t = todayStr();
  const d = toDate(s);
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`;
  if (s === t) return `Aujourd'hui · ${base}`;
  if (s === addDays(t, -1)) return `Hier · ${base}`;
  if (s === addDays(t, 1)) return `Demain · ${base}`;
  return `${WD[d.getDay()]} ${base}`;
}

const ICONS = {
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  apple: '<path d="M12 7c-1.5-1.5-5-2-6.5.5S4 14 6 17.5 10 22 12 21c2 1 4-0.5 6-3.5s2.5-8 .5-10.5S13.5 5.5 12 7z"/><path d="M12 7c0-2 1-4 3-5"/>',
  bowl: '<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M7 21h10"/><path d="M9 7c0-1.5 1-2 1-3.5M13 7c0-1.5 1-2 1-3.5"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-5 4 3 5-7"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 8 5-5 5 5M12 3v12"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  sortUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  sortDown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  drop: '<path d="M12 2.7s-7 7.6-7 12.3a7 7 0 0 0 14 0c0-4.7-7-12.3-7-12.3z"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4.1 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.3 1.1 1.2 2.3 2.5 2.8z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>'
};
const ic = n => `<svg class="i" viewBox="0 0 24 24">${ICONS[n] || ''}</svg>`;
let logoN = 0;
const logo = () => {
  const g = 'tlg' + (++logoN);
  return `<svg viewBox="0 0 512 512" width="100%" height="100%"><defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#34d399"/><stop offset="1" stop-color="#0f8456"/></linearGradient></defs><circle cx="256" cy="256" r="240" fill="url(#${g})"/><circle cx="256" cy="256" r="178" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="30"/><path d="M256 78a178 178 0 1 1-168 118" fill="none" stroke="#fff" stroke-width="30" stroke-linecap="round"/><path d="M168 176h176v46h-64v128h-48V222h-64z" fill="#fff"/></svg>`;
};
function paintIcons(root = document) {
  $$('[data-i]', root).forEach(el => { el.outerHTML = ic(el.dataset.i); });
  $$('[data-logo]', root).forEach(el => { el.innerHTML = logo(); });
}
function toast(msg, undo) {
  $$('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'toast';
  t.append(msg);
  if (undo) {
    const b = document.createElement('button');
    b.textContent = 'Annuler';
    b.onclick = () => { t.remove(); undo(); };
    t.append(b);
  }
  document.body.appendChild(t);
  setTimeout(() => t.remove(), undo ? 6000 : 2600);
}

// ================= Nutriments =================
const NUTS = [
  { k: 'kcal', l: 'Calories', u: 'kcal', d: 0 },
  { k: 'prot', l: 'Protéines', u: 'g', d: 1, c: '--prot' },
  { k: 'carb', l: 'Glucides', u: 'g', d: 1, c: '--carb' },
  { k: 'fat', l: 'Lipides', u: 'g', d: 1, c: '--fat' },
  { k: 'fiber', l: 'Fibres', u: 'g', d: 1, c: '--fiber', opt: true },
  { k: 'sugar', l: 'dont sucres', u: 'g', d: 1, opt: true },
  { k: 'salt', l: 'Sel', u: 'g', d: 2, opt: true }
];
const NK = NUTS.map(n => n.k);
const zero = () => Object.fromEntries(NK.map(k => [k, 0]));
const addN = (a, b, f = 1) => { for (const k of NK) a[k] += (b?.[k] || 0) * f; return a; };
const scaleN = (b, f) => addN(zero(), b, f);
const roundN = n => Object.fromEntries(NK.map(k => [k, Math.round((n[k] || 0) * 100) / 100]));
const macroLine = n => `<span class="pl">P ${fmt(n.prot)}</span> · <span class="gl">G ${fmt(n.carb)}</span> · <span class="ll">L ${fmt(n.fat)}</span>`;
const macroChips = n => `<div class="macrochips">${['prot', 'carb', 'fat'].map(k => { const m = NUTS.find(x => x.k === k); return `<span class="chip"><i style="background:var(${m.c})"></i>${m.l[0]} ${fmt(n[k])} g</span>`; }).join('')}</div>`;
// Barre de répartition des calories entre protéines, glucides et lipides
function macroSplit(n) {
  const p = n.prot * 4, c = n.carb * 4, f = n.fat * 9, t = p + c + f;
  if (!t) return '<div class="macro-split"></div>';
  return `<div class="macro-split" title="Part des calories : protéines ${Math.round(p / t * 100)} %, glucides ${Math.round(c / t * 100)} %, lipides ${Math.round(f / t * 100)} %"><i style="width:${p / t * 100}%;background:var(--prot)"></i><i style="width:${c / t * 100}%;background:var(--carb)"></i><i style="width:${f / t * 100}%;background:var(--fat)"></i></div>`;
}

// ================= Données =================
const DEFAULT_MEALS = ['Petit-déjeuner', 'Déjeuner', 'Dîner', 'Collation'];
const emptyData = () => ({
  version: 1,
  settings: { theme: 'dark', goals: { kcal: 2200, prot: 140, carb: 250, fat: 70, fiber: 0, water: 2 }, meals: [...DEFAULT_MEALS], u: 0 },
  foods: [], dishes: [], entries: [], weights: [], water: [],
  tomb: {}, dirty: {}, sync: null, server: null, welcomeDone: false
});
const SYNC_ARRAYS = { food: 'foods', dish: 'dishes', entry: 'entries', weight: 'weights', water: 'water' };
let D = emptyData();

const markDirty = id => { D.dirty[id] = 1; };
// Toujours strictement postérieur à la version connue : une modification locale gagne même si l'horloge de l'autre PC avance
const nextU = prev => Math.max(Date.now(), (prev || 0) + 1);
const stamp = o => { o.u = nextU(o.u); markDirty(o.id); return o; };
const stampSettings = () => { D.settings.u = nextU(D.settings.u); markDirty('settings'); };
function markDeleted(id, kind) {
  const prev = D[SYNC_ARRAYS[kind]].find(o => o.id === id);
  D.tomb[id] = { u: nextU(prev?.u), kind };
  markDirty(id);
}
function removeItem(kind, id) {
  markDeleted(id, kind);
  const key = SYNC_ARRAYS[kind];
  D[key] = D[key].filter(o => o.id !== id);
}
function restoreItem(kind, item) {
  delete D.tomb[item.id];
  D[SYNC_ARRAYS[kind]].push(stamp(item));
}

async function persist(noSync) {
  try { await api.save(D); } catch (e) { toast('Erreur de sauvegarde : ' + e.message); }
  if (!noSync && D.sync?.email) scheduleSync();
}

const food = id => D.foods.find(f => f.id === id);
const dish = id => D.dishes.find(d => d.id === id);
const base = f => (f.unit === 'pc' ? 1 : 100);
const unitName = (u, q = 1) => (u === 'pc' ? (q > 1 ? 'pièces' : 'pièce') : u === 'portion' ? (q > 1 ? 'portions' : 'portion') : u);
const qtyTxt = (q, u) => `${fmt(q, u === 'g' || u === 'ml' ? 0 : 2)} ${unitName(u, q)}`;
const perTxt = f => (f.unit === 'pc' ? 'pour 1 pièce' : `pour 100 ${f.unit}`);
const foodDefault = f => (f.portion > 0 ? f.portion : base(f));
const foodNut = (f, q) => scaleN(f.n, q / base(f));
// Prix saisi « montant pour une quantité » (ex. 2,49 € pour 500 g) ; null si inconnu
const hasPrice = f => f?.price?.amount > 0 && f.price.qty > 0;
const foodCost = (f, q) => (hasPrice(f) ? Math.round(f.price.amount * q / f.price.qty * 10000) / 10000 : null);
const priceTxt = f => (!hasPrice(f) ? '' : f.unit === 'pc' ? `${eur(f.price.amount / f.price.qty)} / pièce` : `${eur(f.price.amount / f.price.qty * 1000)} / ${f.unit === 'ml' ? 'L' : 'kg'}`);
// Somme des coûts connus ; « partial » si au moins un élément n'a pas de prix
function sumCost(list) {
  let cost = 0, known = 0;
  for (const e of list) if (e.cost != null) { cost += e.cost; known++; }
  return { cost, known, partial: known > 0 && known < list.length };
}
const costTxt = c => (c.known ? `${eur(c.cost)}${c.partial ? '*' : ''}` : '');
const PARTIAL_TIP = '* certains éléments n\'ont pas de prix';
function portionTxt(f) {
  const q = foodDefault(f);
  if (f.portionName) return `${f.portionName} (${qtyTxt(q, f.unit)})`;
  return qtyTxt(q, f.unit);
}
// Totaux d'un plat : poids brut (ingrédients en g/ml) ou poids une fois cuit s'il est renseigné
function dishInfo(d) {
  const n = zero();
  let w = 0, missing = 0, cost = 0, priced = 0;
  for (const it of d.items) {
    const f = food(it.food);
    if (!f) { missing++; continue; }
    addN(n, foodNut(f, it.qty));
    if (f.unit !== 'pc') w += it.qty;
    const c = foodCost(f, it.qty);
    if (c != null) { cost += c; priced++; }
  }
  const portions = d.portions > 0 ? d.portions : 1;
  return {
    n, raw: w, weight: d.cooked > 0 ? d.cooked : w, missing, portions, per: scaleN(n, 1 / portions),
    cost: priced ? cost : null, costPer: priced ? cost / portions : null, costPartial: priced > 0 && priced < d.items.length - missing
  };
}

const meals = () => D.settings.meals.map((name, i) => ({ i, name })).filter(m => m.name);
const dayEntries = date => D.entries.filter(e => e.date === date);
const sumEntries = list => list.reduce((a, e) => addN(a, e.n), zero());

// ================= Navigation =================
let page = 'journal';
let day = todayStr();
let selMeal = 0;
let qTab = 'recent';
let statDays = 7;
const charts = {};
const TITLES = { journal: 'Journal', foods: 'Aliments', dishes: 'Plats', stats: 'Statistiques', settings: 'Réglages' };

function autoMeal() {
  const h = new Date().getHours();
  const want = h < 10 ? 0 : h < 15 ? 1 : h < 18 ? 3 : 2;
  const ok = meals();
  return ok.some(m => m.i === want) ? want : ok[0]?.i ?? 0;
}

function go(p) {
  page = p;
  $$('#nav button[data-page]').forEach(b => b.classList.toggle('on', b.dataset.page === p));
  $$('section.page').forEach(s => { s.hidden = s.id !== 'page-' + p; });
  $('#pageTitle').textContent = TITLES[p];
  const journal = p === 'journal';
  $('#dayBar').hidden = !journal; $('#todayBtn').hidden = !journal; $('#copyDay').hidden = !journal;
  $('#statRange').hidden = p !== 'stats';
  const lbl = { journal: 'Aliment', foods: 'Aliment', dishes: 'Plat' }[p];
  $('#quickAdd').hidden = !lbl;
  if (lbl) $('#quickAdd').innerHTML = ic('plus') + lbl;
  $('#content').scrollTop = 0;
  render();
}
function applyTheme() {
  document.documentElement.dataset.theme = D.settings.theme;
  const dark = D.settings.theme === 'dark';
  $('#themeToggle').innerHTML = ic(dark ? 'sun' : 'moon') + (dark ? 'Thème clair' : 'Thème sombre');
}
function render() {
  applyTheme();
  ({ journal: renderJournal, foods: renderFoods, dishes: renderDishes, stats: renderStats, settings: renderSettings })[page]();
}

// ================= Journal =================
function ring(value, goal) {
  const r = 52, c = 2 * Math.PI * r;
  const p = goal > 0 ? Math.min(value / goal, 1) : 0;
  const fill = p > 0 ? `<circle cx="60" cy="60" r="${r}" class="rf ${goal > 0 && value > goal * 1.02 ? 'over' : ''}" stroke-dasharray="${c * p} ${c}" transform="rotate(-90 60 60)"/>` : '';
  return `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="${r}" class="rb"/>${fill}</svg>`;
}
function mbar(key, value) {
  const m = NUTS.find(x => x.k === key), goal = D.settings.goals[key] || 0;
  const w = goal > 0 ? Math.min(value / goal * 100, 100) : 0;
  return `<div class="mbar"><div class="top"><span><i class="dot" style="background:var(${m.c})"></i>${m.l}</span><span><b>${fmt(value, 0)}</b>${goal ? ` / ${fmt(goal, 0)}` : ''} g</span></div>
    <div class="prog"><i style="width:${w}%;background:var(${m.c})"></i></div></div>`;
}

function renderJournal() {
  $('#dayLabel').textContent = dayLabel(day);
  $('#dayPick').value = day;
  const list = dayEntries(day);
  const t = sumEntries(list), g = D.settings.goals;
  const left = (g.kcal || 0) - t.kcal;
  const dayCost = sumCost(list);
  const water = waterOf(day), wGoal = (g.water || 0) * 1000, streak = streakDays();

  // Accueil tant que la base d'aliments est vide
  const wc = $('#welcomeCard');
  if (!D.foods.length && !D.dishes.length && !D.welcomeDone) {
    wc.innerHTML = `<div class="card welcome"><h3>Bienvenue dans Ttrack</h3>
      <p>Enregistre tes aliments avec leurs valeurs (calories, protéines, glucides, lipides), compose des plats, puis clique dessus pour remplir ta journée.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn pri" data-welcome="starter">Ajouter des aliments courants</button>
        <button class="btn" data-welcome="food">Créer mon premier aliment</button>
        <button class="btn" data-welcome="sync">J'utilise déjà Ttrack sur un autre PC</button>
        <button class="btn" data-welcome="skip">Masquer</button>
      </div></div>`;
  } else wc.innerHTML = '';

  $('#summary').innerHTML = `
    <div class="ringbox">${ring(t.kcal, g.kcal)}<div class="center"><b>${kc(t.kcal)}</b><span>${g.kcal ? `sur ${kc(g.kcal)} kcal` : 'kcal'}</span></div></div>
    <div class="macros">
      <div class="remain">
        ${g.kcal ? `<div class="${left < 0 ? 'over' : ''}">${left < 0 ? 'Dépassement' : 'Restant'}<br><b>${kc(Math.abs(left))} kcal</b></div>` : ''}
        <div>Consommé<br><b>${kc(t.kcal)} kcal</b></div>
        <div>Aliments<br><b>${list.length}</b></div>
        ${dayCost.known ? `<div title="${dayCost.partial ? PARTIAL_TIP : ''}">Coût<br><b>${costTxt(dayCost)}</b></div>` : ''}
      </div>
      ${mbar('prot', t.prot)}${mbar('carb', t.carb)}${mbar('fat', t.fat)}
      <div class="minor">
        <span>Fibres <b>${fmt(t.fiber)} g</b>${g.fiber ? ` / ${fmt(g.fiber, 0)} g` : ''}</span>
        <span>Sucres <b>${fmt(t.sugar)} g</b></span>
        <span>Sel <b>${fmt(t.salt, 2)} g</b></span>
        ${streak > 1 ? `<span class="streak" title="Jours d'affilée avec au moins un repas saisi">${ic('flame')}<b>${streak}</b> jours d'affilée</span>` : ''}
      </div>
      <div class="water">
        <span class="wl">${ic('drop')}Eau <b>${fmt(water / 1000, 2)} L</b>${wGoal ? ` / ${fmt(wGoal / 1000, 1)} L` : ''}</span>
        <div class="prog"><i style="width:${wGoal ? Math.min(water / wGoal * 100, 100) : 0}%;background:#38bdf8"></i></div>
        <button class="btn sm" data-water="-250" title="Retirer un verre" ${water ? '' : 'disabled'}>−</button>
        <button class="btn sm" data-water="250">+ verre</button>
        <button class="btn sm" data-water="500">+ 50 cl</button>
      </div>
    </div>`;

  $('#meals').innerHTML = meals().map(m => {
    const es = list.filter(e => e.meal === m.i).sort((a, b) => (a.at || a.u) - (b.at || b.u));
    const s = sumEntries(es), c = sumCost(es);
    return `<div class="card meal" data-meal-box="${m.i}">
      <header><h4>${esc(m.name)}</h4>${c.known ? `<span class="cost-chip" title="Coût du repas${c.partial ? ' · ' + PARTIAL_TIP : ''}">${costTxt(c)}</span>` : ''}
        ${es.length ? `<div class="mk"><b>${kc(s.kcal)}</b> kcal<br>${macroLine(s)}</div>` : '<span class="mk"></span>'}
        ${es.some(e => e.kind === 'food') ? `<button class="icon-btn" data-meal-dish="${m.i}" title="Enregistrer ce repas comme plat">${ic('save')}</button>` : ''}
        <button class="icon-btn" data-meal-add="${m.i}" title="Ajouter à ce repas">${ic('plus')}</button>
      </header>
      ${es.map(e => `<div class="entry" data-entry="${e.id}">
        <div class="nm">${esc(e.name)}<small>${e.kind === 'quick' ? 'saisie rapide' : qtyTxt(e.qty, e.unit)}</small></div>
        <div class="mac">${macroLine(e.n)}</div>
        <div class="entry-right">${dayCost.known ? `<span class="cost">${e.cost != null ? eur(e.cost) : '–'}</span>` : ''}<span class="kc">${kc(e.n.kcal)} kcal</span>
          <span class="act"><button class="icon-btn del" data-del-entry="${e.id}" title="Supprimer">${ic('trash')}</button></span></div>
      </div>`).join('') || '<div class="none">Rien pour l\'instant</div>'}
    </div>`;
  }).join('');

  renderQuick();
}

// ---- Eau et série ----
// Une ligne par jour avec un identifiant fixe : les deux PC mettent à jour la même
const waterOf = date => D.water.find(w => w.date === date)?.ml || 0;
function addWater(date, delta) {
  const id = 'water-' + date;
  let w = D.water.find(x => x.id === id);
  if (!w) { delete D.tomb[id]; w = { id, date, ml: 0 }; D.water.push(w); }
  w.ml = Math.max(0, w.ml + delta);
  stamp(w); persist(); render();
}
// Jours consécutifs avec au moins une entrée, jusqu'à aujourd'hui (ou hier si rien n'est encore saisi aujourd'hui)
function streakDays() {
  const dates = new Set(D.entries.map(e => e.date));
  let d = todayStr();
  if (!dates.has(d)) d = addDays(d, -1);
  let n = 0;
  while (dates.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

// ---- Panneau d'ajout rapide ----
function recentItems() {
  const seen = new Set(), out = [];
  const sorted = [...D.entries].sort((a, b) => (b.at || b.u) - (a.at || a.u));
  for (const e of sorted) {
    if (e.kind === 'quick' || !e.ref) continue;
    const key = e.kind + ':' + e.ref;
    if (seen.has(key)) continue;
    const item = e.kind === 'food' ? food(e.ref) : dish(e.ref);
    if (!item) continue;
    seen.add(key);
    out.push({ kind: e.kind, item });
    if (out.length >= 30) break;
  }
  return out;
}
function quickItems() {
  const q = norm($('#qSearch').value.trim());
  const all = [...D.dishes.map(item => ({ kind: 'dish', item })), ...D.foods.map(item => ({ kind: 'food', item }))];
  if (q) {
    const words = q.split(/\s+/);
    const hit = x => { const s = norm(x.item.name + ' ' + (x.item.brand || '')); return words.every(w => s.includes(w)); };
    const starts = x => norm(x.item.name).startsWith(words[0]);
    return all.filter(hit).sort((a, b) => (starts(b) - starts(a)) || (!!b.item.fav - !!a.item.fav) || a.item.name.localeCompare(b.item.name, 'fr')).slice(0, 60);
  }
  const byName = (a, b) => a.item.name.localeCompare(b.item.name, 'fr');
  if (qTab === 'recent') return recentItems();
  if (qTab === 'fav') return all.filter(x => x.item.fav).sort(byName);
  if (qTab === 'foods') return all.filter(x => x.kind === 'food').sort(byName);
  return all.filter(x => x.kind === 'dish').sort(byName);
}
function tileHtml({ kind, item }, first) {
  let sub, kcal, cost;
  if (kind === 'food') { sub = portionTxt(item); kcal = foodNut(item, foodDefault(item)).kcal; cost = foodCost(item, foodDefault(item)); }
  else { const di = dishInfo(item); sub = `1 portion${di.portions > 1 ? ` sur ${fmt(di.portions)}` : ''}`; kcal = di.per.kcal; cost = di.costPer; }
  if (cost != null) sub += ' · ' + eur(cost);
  return `<div class="tile ${first ? 'first' : ''}" data-add="${kind}:${item.id}" title="Clic : ajouter ${esc(sub)}${first ? ' (Entrée)' : ''}">
    <div class="tx"><b>${esc(item.name)}${kind === 'dish' ? '<span class="badge">PLAT</span>' : ''}</b><small>${esc(sub)}${item.brand ? ' · ' + esc(item.brand) : ''}</small></div>
    <span class="kc">${kc(kcal)} kcal</span>
    <button class="icon-btn" data-addq="${kind}:${item.id}" title="Choisir la quantité">${ic('sliders')}</button>
  </div>`;
}
function renderQuick() {
  const ms = meals();
  if (!ms.some(m => m.i === selMeal)) selMeal = ms[0]?.i ?? 0;
  $('#qMeal').innerHTML = ms.map(m => `<button data-v="${m.i}" class="${m.i === selMeal ? 'on' : ''}">${esc(m.name)}</button>`).join('');
  const searching = !!$('#qSearch').value.trim();
  $$('#qTabs button').forEach(b => b.classList.toggle('on', !searching && b.dataset.v === qTab));
  const items = quickItems();
  const emptyMsg = searching ? `Aucun résultat. <a href="#" data-new-food-from-search>Créer « ${esc($('#qSearch').value.trim())} »</a>`
    : { recent: 'Les aliments ajoutés récemment apparaîtront ici.', fav: 'Aucun favori : cliquer sur l\'étoile d\'un aliment ou d\'un plat.', foods: 'Aucun aliment.', dishes: 'Aucun plat : les créer dans la page Plats.' }[qTab];
  $('#qList').innerHTML = items.map((x, i) => tileHtml(x, searching && i === 0)).join('') || `<div class="empty">${emptyMsg}</div>`;
}

function newEntry(kind, item, qty, unit, meal = selMeal, date = day) {
  let n, name = item.name;
  if (kind === 'food') n = foodNut(item, qty);
  else {
    const di = dishInfo(item);
    n = unit === 'portion' ? scaleN(di.n, qty / di.portions) : scaleN(di.n, di.weight ? qty / di.weight : 0);
  }
  const e = stamp({ id: uid(), date, meal, kind, ref: item.id, name, qty, unit, n: roundN(n), cost: costFor(kind, item, qty, unit), at: Date.now() });
  D.entries.push(e);
  return e;
}
function addAndNotify(e) {
  persist(); render();
  const mealName = D.settings.meals[e.meal] || '';
  toast(`${e.name} ajouté${mealName ? ' · ' + mealName : ''} (${kc(e.n.kcal)} kcal)`, () => { removeItem('entry', e.id); persist(); render(); });
}
function quickAddDefault(kind, id) {
  const item = kind === 'food' ? food(id) : dish(id);
  if (!item) return;
  const e = kind === 'food' ? newEntry('food', item, foodDefault(item), item.unit) : newEntry('dish', item, 1, 'portion');
  addAndNotify(e);
}

// Coût d'une quantité d'aliment ou de plat (null si le prix n'est pas connu)
function costFor(kind, item, qty, unit) {
  if (kind === 'food') return foodCost(item, qty);
  const di = dishInfo(item);
  if (di.cost == null) return null;
  const c = unit === 'portion' ? di.cost * qty / di.portions : di.weight ? di.cost * qty / di.weight : null;
  return c == null ? null : Math.round(c * 10000) / 10000;
}

// Choix de la quantité (ajout ou modification d'une entrée)
function qtyModal(kind, item, entry) {
  const isFood = kind === 'food';
  const di = isFood ? null : dishInfo(item);
  let unit = entry ? entry.unit : isFood ? item.unit : 'portion';
  const initQty = entry ? entry.qty : isFood ? foodDefault(item) : 1;
  const nutFor = q => isFood ? foodNut(item, q) : unit === 'portion' ? scaleN(di.n, q / di.portions) : scaleN(di.n, di.weight ? q / di.weight : 0);
  const presets = isFood
    ? [...(item.portion > 0 ? [[item.portion, item.portionName || 'Portion']] : []), ...(item.unit === 'pc' ? [[1, '1'], [2, '2'], [3, '3']] : [[50, ''], [100, ''], [150, ''], [200, ''], [250, '']])]
    : [];
  modal({
    title: entry ? 'Modifier' : 'Ajouter', submit: entry ? 'Enregistrer' : 'Ajouter',
    body: `<div><b style="font-size:16px">${esc(item.name)}</b><div class="mut" style="font-size:12px">${isFood ? `${kc(item.n.kcal)} kcal ${perTxt(item)}` : `${kc(di.per.kcal)} kcal par portion · ${fmt(di.portions)} portion${di.portions > 1 ? 's' : ''}${di.weight ? ` · ${fmt(di.weight, 0)} g au total` : ''}`}</div></div>
      ${!isFood && di.weight ? `<div class="seg" data-unit-seg style="align-self:flex-start"><button type="button" data-v="portion" class="${unit === 'portion' ? 'on' : ''}">Portions</button><button type="button" data-v="g" class="${unit === 'g' ? 'on' : ''}">Grammes</button></div>` : ''}
      <div class="row">
        <label class="f"><span>Quantité (<span data-unit-lbl>${unitName(unit, 2)}</span>)</span><input name="qty" inputmode="decimal" value="${inputVal(initQty)}"></label>
        <label class="f">Repas<select name="meal">${meals().map(m => `<option value="${m.i}" ${m.i === (entry ? entry.meal : selMeal) ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
      </div>
      ${presets.length ? `<div class="presets">${presets.map(([q, l]) => `<button type="button" data-q="${q}">${l && !/^\d+$/.test(l) ? esc(l) + ' · ' : ''}${qtyTxt(q, item.unit)}</button>`).join('')}</div>` : ''}
      ${!isFood ? `<div class="presets" data-dish-presets></div>` : ''}
      <div class="preview" data-preview></div>`,
    onMount: form => {
      const upd = () => {
        const q = numOr0(form.qty.value), n = nutFor(q);
        const cost = costFor(kind, item, q, unit);
        $('[data-preview]', form).classList.toggle('with-cost', cost != null);
        $('[data-preview]', form).innerHTML = `${cost != null ? `<div><b>${eur(cost)}</b>coût</div>` : ''}<div><b>${kc(n.kcal)}</b>kcal</div><div><b class="pl">${fmt(n.prot)}</b>protéines</div><div><b class="gl">${fmt(n.carb)}</b>glucides</div><div><b class="ll">${fmt(n.fat)}</b>lipides</div>`;
      };
      const dishPresets = () => {
        const box = $('[data-dish-presets]', form);
        if (!box) return;
        const ps = unit === 'portion' ? [0.5, 1, 1.5, 2] : [100, 200, 300, 400];
        box.innerHTML = ps.map(q => `<button type="button" data-q="${q}">${qtyTxt(q, unit)}</button>`).join('');
      };
      form.qty.oninput = upd;
      form.addEventListener('click', e => {
        const b = e.target.closest('[data-q]');
        if (b) { form.qty.value = inputVal(+b.dataset.q); upd(); form.qty.focus(); }
      });
      $$('[data-unit-seg] button', form).forEach(b => b.onclick = () => {
        if (b.dataset.v === unit) return;
        const cur = numOr0(form.qty.value);
        // Conversion portions <-> grammes pour garder la même quantité mangée
        const per = di.weight / di.portions;
        form.qty.value = inputVal(b.dataset.v === 'g' ? Math.round(cur * per) : Math.round(cur / per * 100) / 100);
        unit = b.dataset.v;
        $$('[data-unit-seg] button', form).forEach(x => x.classList.toggle('on', x === b));
        $('[data-unit-lbl]', form).textContent = unitName(unit, 2);
        dishPresets(); upd();
      });
      dishPresets(); upd();
      setTimeout(() => form.qty.select(), 40);
    },
    onSubmit: form => {
      const q = num(form.qty.value);
      if (!(q > 0)) return 'Quantité invalide.';
      const meal = +form.meal.value;
      if (entry) {
        entry.qty = q; entry.unit = unit; entry.meal = meal; entry.n = roundN(nutFor(q)); entry.cost = costFor(kind, item, q, unit);
        stamp(entry); persist(); render(); toast('Modifié');
      } else {
        selMeal = meal;
        addAndNotify(newEntry(kind, item, q, unit, meal));
      }
    }
  });
}

// Saisie rapide : calories et macros sans créer d'aliment
function quickEntryModal(entry) {
  const n = entry?.n || zero();
  modal({
    title: entry ? 'Modifier la saisie rapide' : 'Saisie rapide', submit: entry ? 'Enregistrer' : 'Ajouter',
    body: `<label class="f">Nom<input name="name" value="${esc(entry?.name || '')}" placeholder="Ex. : repas au restaurant"></label>
      <div class="row">
        <label class="f">Calories (kcal)<input name="kcal" inputmode="decimal" value="${inputVal(entry ? n.kcal : '')}"></label>
        <label class="f">Protéines (g)<input name="prot" inputmode="decimal" value="${inputVal(entry ? n.prot : '')}"></label>
        <label class="f">Glucides (g)<input name="carb" inputmode="decimal" value="${inputVal(entry ? n.carb : '')}"></label>
        <label class="f">Lipides (g)<input name="fat" inputmode="decimal" value="${inputVal(entry ? n.fat : '')}"></label>
      </div>
      <div class="row"><label class="f">Prix (€)<input name="cost" inputmode="decimal" value="${entry?.cost != null ? inputVal(entry.cost) : ''}" placeholder="facultatif"></label>
      <label class="f">Repas<select name="meal">${meals().map(m => `<option value="${m.i}" ${m.i === (entry ? entry.meal : selMeal) ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label></div>`,
    onSubmit: form => {
      const price = num(form.cost.value);
      if (form.cost.value.trim() && !(price >= 0)) return 'Prix invalide.';
      const cost = form.cost.value.trim() ? Math.round(price * 100) / 100 : null;
      const vals = { prot: numOr0(form.prot.value), carb: numOr0(form.carb.value), fat: numOr0(form.fat.value) };
      let kcal = num(form.kcal.value);
      if (!isFinite(kcal)) kcal = vals.prot * 4 + vals.carb * 4 + vals.fat * 9;
      if (!(kcal > 0)) return 'Indiquer au moins les calories.';
      const nn = roundN({ ...zero(), ...vals, kcal });
      const name = form.name.value.trim() || 'Saisie rapide';
      if (entry) { Object.assign(entry, { name, n: nn, cost, meal: +form.meal.value }); stamp(entry); persist(); render(); toast('Modifié'); }
      else {
        const e = stamp({ id: uid(), date: day, meal: +form.meal.value, kind: 'quick', ref: null, name, qty: 1, unit: 'quick', n: nn, cost, at: Date.now() });
        D.entries.push(e); addAndNotify(e);
      }
    }
  });
}

function editEntry(e) {
  if (e.kind === 'quick') return quickEntryModal(e);
  const item = e.kind === 'food' ? food(e.ref) : dish(e.ref);
  if (item) return qtyModal(e.kind, item, e);
  // Aliment ou plat supprimé depuis : on repart des valeurs enregistrées, ajustées proportionnellement
  const ghost = { id: e.ref, name: e.name, unit: e.unit };
  ghost.n = scaleN(e.n, base(ghost) / e.qty);
  if (e.cost != null) ghost.price = { amount: e.cost, qty: e.qty };
  qtyModal('food', ghost, e);
}

function copyDayModal() {
  const days = [...new Set(D.entries.map(e => e.date))].filter(d => d !== day).sort().reverse().slice(0, 30);
  if (!days.length) { toast('Aucun autre jour à recopier'); return; }
  modal({
    title: 'Recopier un jour', submit: 'Recopier',
    body: `<p class="mut" style="margin:0;font-size:13px">Les repas du jour choisi sont ajoutés à « ${esc(dayLabel(day))} ».</p>
      <label class="f">Jour à recopier<select name="src">${days.map(d => { const t = sumEntries(dayEntries(d)); return `<option value="${d}">${esc(dayLabel(d))} · ${kc(t.kcal)} kcal</option>`; }).join('')}</select></label>
      <label class="f">Repas<select name="meal"><option value="all">Toute la journée</option>${meals().map(m => `<option value="${m.i}">${esc(m.name)}</option>`).join('')}</select></label>`,
    onSubmit: form => {
      const src = dayEntries(form.src.value).filter(e => form.meal.value === 'all' || e.meal === +form.meal.value);
      if (!src.length) return 'Rien à recopier pour ce repas.';
      const now = Date.now();
      src.forEach((e, i) => D.entries.push(stamp({ ...structuredClone(e), id: uid(), date: day, at: now + i, u: 0 })));
      persist(); render(); toast(`${plural(src.length, 'élément')} recopié${src.length > 1 ? 's' : ''}`);
    }
  });
}

function mealToDishModal(mealIdx) {
  const es = dayEntries(day).filter(e => e.meal === mealIdx && e.kind === 'food' && food(e.ref));
  if (!es.length) return;
  dishModal(null, { name: D.settings.meals[mealIdx] + ' du ' + toDate(day).toLocaleDateString('fr-FR'), items: es.map(e => ({ food: e.ref, qty: e.qty })), portions: 1 });
}

// ================= Aliments =================
// ---- Tri des aliments et des plats ----
// Aliments : valeurs pour 100 g / 100 ml / 1 pièce. Plats : valeurs par portion.
const SORTS = {
  name: { l: 'Nom', dir: 1 },
  kcal: { l: 'Calories', dir: -1 },
  prot: { l: 'Protéines', dir: -1 },
  carb: { l: 'Glucides', dir: -1 },
  fat: { l: 'Lipides', dir: -1 },
  density: { l: 'Protéines / 100 kcal', dir: -1 },
  price: { l: 'Prix', dir: 1 },
  protEuro: { l: 'Protéines par €', dir: -1 }
};
const sortState = { foods: { k: 'name', dir: 1 }, dishes: { k: 'name', dir: 1 } };
const density = n => (n.kcal > 0 ? n.prot * 100 / n.kcal : 0);
function metrics(kind, item) {
  let n, price;
  if (kind === 'food') { n = item.n; price = hasPrice(item) ? foodCost(item, base(item)) : null; }
  else { const di = dishInfo(item); n = di.per; price = di.costPartial ? null : di.costPer; }
  return { name: item.name, kcal: n.kcal, prot: n.prot, carb: n.carb, fat: n.fat, density: density(n), price, protEuro: price > 0 ? n.prot / price : null };
}
function sortItems(kind, list) {
  const { k, dir } = sortState[kind];
  const m = new Map(list.map(x => [x, metrics(kind === 'foods' ? 'food' : 'dish', x)]));
  return list.sort((a, b) => {
    const va = m.get(a)[k], vb = m.get(b)[k];
    if (k === 'name') return dir * va.localeCompare(vb, 'fr');
    // Sans prix : toujours en fin de liste
    if (va == null || vb == null) return (va == null) - (vb == null);
    return dir * (va - vb) || a.name.localeCompare(b.name, 'fr');
  });
}
function sortControls(kind) {
  const s = sortState[kind];
  return `<label class="sortbox">Trier par <select data-sort-sel="${kind}">${Object.entries(SORTS).map(([k, o]) => `<option value="${k}" ${k === s.k ? 'selected' : ''}>${o.l}</option>`).join('')}</select>
    <button type="button" class="icon-btn" data-sort-dir="${kind}" title="${s.dir > 0 ? 'Croissant' : 'Décroissant'}">${ic(s.dir > 0 ? 'sortUp' : 'sortDown')}</button></label>`;
}
function setSort(kind, k, toggle) {
  const s = sortState[kind];
  if (toggle && s.k === k) s.dir = -s.dir;
  else { s.k = k; s.dir = SORTS[k].dir; }
  render();
}
const th = (k, label, cls = '') => {
  const s = sortState.foods, on = s.k === k;
  return `<th class="sortable ${cls} ${on ? 'on' : ''}" data-sort-col="${k}" title="Trier par ${SORTS[k].l.toLowerCase()}">${label}${on ? (s.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
};

let fFilter = 'all';
const fSel = new Set(); // aliments cochés pour une suppression groupée
let fVisible = [];
function renderFoods() {
  const q = norm($('#fSearch').value.trim());
  const list = sortItems('foods', D.foods.filter(f => (fFilter === 'all' || f.fav) && (!q || norm(f.name + ' ' + (f.brand || '')).includes(q))));
  fVisible = list.map(f => f.id);
  for (const id of [...fSel]) if (!food(id)) fSel.delete(id);
  const allOn = list.length > 0 && list.every(f => fSel.has(f.id));
  $('#fCount').textContent = plural(list.length, 'aliment');
  $('#fSort').innerHTML = sortControls('foods');
  $('#fBulk').innerHTML = fSel.size ? `<span class="mut">${plural(fSel.size, 'sélectionné')}</span>
    <button class="btn sm" data-fsel-clear>Désélectionner</button>
    <button class="btn sm danger" data-fsel-del>${ic('trash')}Supprimer (${fSel.size})</button>` : '';
  $$('#fFilter button').forEach(b => b.classList.toggle('on', b.dataset.v === fFilter));
  $('#fTable').innerHTML = list.length ? `<thead><tr><th class="cb"><input type="checkbox" data-fsel-all title="Tout sélectionner" ${allOn ? 'checked' : ''}></th><th></th>${th('name', 'Aliment')}${th('kcal', 'Calories', 'r')}${th('prot', 'Protéines', 'r')}${th('carb', 'Glucides', 'r')}${th('fat', 'Lipides', 'r')}${th('density', 'P / 100 kcal', 'r')}<th>Portion habituelle</th>${th('price', 'Prix', 'r')}<th></th></tr></thead>
    <tbody>${list.map(f => `<tr class="clickable" data-edit-food="${f.id}">
      <td class="cb"><input type="checkbox" data-fsel="${f.id}" ${fSel.has(f.id) ? 'checked' : ''}></td>
      <td style="width:1%"><button class="icon-btn star ${f.fav ? 'on' : ''}" data-fav="food:${f.id}" title="Favori">${ic('star')}</button></td>
      <td><b>${esc(f.name)}</b><small>${f.brand ? esc(f.brand) + ' · ' : ''}${perTxt(f)}</small></td>
      <td class="r"><b>${kc(f.n.kcal)}</b> kcal</td>
      <td class="r pl">${fmt(f.n.prot)} g</td><td class="r gl">${fmt(f.n.carb)} g</td><td class="r ll">${fmt(f.n.fat)} g</td>
      <td class="r">${f.n.kcal ? fmt(density(f.n)) + ' g' : '–'}</td>
      <td>${f.portion > 0 ? esc(portionTxt(f)) : '<span class="mut">–</span>'}</td>
      <td class="r">${hasPrice(f) ? `${priceTxt(f)}<small>${eur(foodCost(f, foodDefault(f)))} la portion${f.n.prot ? ` · ${fmt(f.n.prot / foodCost(f, base(f)), 0)} g prot./€` : ''}</small>` : '<span class="mut">–</span>'}</td>
      <td class="acts"><button class="icon-btn" data-addq="food:${f.id}" title="Ajouter au journal">${ic('plus')}</button><button class="icon-btn" data-edit-food="${f.id}" title="Modifier">${ic('edit')}</button><button class="icon-btn del" data-del-food="${f.id}" title="Supprimer">${ic('trash')}</button></td>
    </tr>`).join('')}</tbody>`
    : `<tbody><tr><td class="empty">${D.foods.length ? 'Aucun aliment ne correspond.' : 'Aucun aliment. Cliquer sur « Aliment » en haut à droite, ou ajouter les aliments courants depuis les Réglages.'}</td></tr></tbody>`;
}

// Suppression groupée : les aliments utilisés dans un plat sont conservés
async function deleteSelectedFoods() {
  const sel = [...fSel].map(food).filter(Boolean);
  const used = sel.filter(f => D.dishes.some(x => x.items.some(it => it.food === f.id)));
  const del = sel.filter(f => !used.includes(f));
  if (!del.length) {
    modal({ title: 'Suppression impossible', body: `<p style="margin:0">${used.length > 1 ? 'Ces aliments sont tous utilisés' : 'Cet aliment est utilisé'} dans un plat. Les retirer des plats d'abord.</p>`, submit: 'OK', cancel: false, onSubmit: () => {} });
    return;
  }
  const names = del.slice(0, 8).map(f => '« ' + esc(f.name) + ' »').join(', ') + (del.length > 8 ? ` et ${del.length - 8} autre(s)` : '');
  if (!await confirmModal(`Supprimer ${plural(del.length, 'aliment')}`, `${names}.<br><br>Les journées passées gardent leurs valeurs.${used.length ? `<br><br><span class="mut">${plural(used.length, 'aliment')} utilisé${used.length > 1 ? 's' : ''} dans un plat ne ${used.length > 1 ? 'seront' : 'sera'} pas supprimé${used.length > 1 ? 's' : ''} : ${used.map(f => esc(f.name)).join(', ')}.</span>` : ''}`)) return;
  for (const f of del) { removeItem('food', f.id); fSel.delete(f.id); }
  persist(); render();
  toast(`${plural(del.length, 'aliment')} supprimé${del.length > 1 ? 's' : ''}`, () => { for (const f of del) restoreItem('food', f); persist(); render(); });
}

function foodModal(f, preset = {}) {
  const v = f || { unit: 'g', n: zero(), ...preset };
  // Champs facultatifs laissés vides quand ils valent 0
  const nv = k => (f && (v.n[k] || !NUTS.find(x => x.k === k).opt) ? inputVal(v.n[k]) : '');
  modal({
    title: f ? 'Modifier l\'aliment' : 'Nouvel aliment', submit: f ? 'Enregistrer' : 'Créer',
    body: `<div class="offbar"><button type="button" class="btn sm" data-off>${ic('search')}Remplir depuis Open Food Facts</button><span class="mut">recherche par nom ou par code-barres, valeurs à vérifier</span></div>
      <div class="row"><label class="f" style="flex:2">Nom<input name="name" value="${esc(v.name || '')}" placeholder="Ex. : Flocons d'avoine"></label>
        <label class="f">Marque<input name="brand" value="${esc(v.brand || '')}" placeholder="facultatif"></label></div>
      <div class="row"><label class="f auto">Unité<div class="seg" data-unit>${[['g', 'Grammes'], ['ml', 'Millilitres'], ['pc', 'Pièce']].map(([u, l]) => `<button type="button" data-v="${u}" class="${v.unit === u ? 'on' : ''}">${l}</button>`).join('')}</div></label></div>
      <div class="section-lbl">Valeurs nutritionnelles <span data-per>${perTxt(v)}</span></div>
      <div class="row">
        <label class="f">Calories (kcal)<input name="kcal" inputmode="decimal" value="${nv('kcal')}" placeholder="auto"></label>
        <label class="f">Protéines (g)<input name="prot" inputmode="decimal" value="${nv('prot')}"></label>
        <label class="f">Glucides (g)<input name="carb" inputmode="decimal" value="${nv('carb')}"></label>
        <label class="f">Lipides (g)<input name="fat" inputmode="decimal" value="${nv('fat')}"></label>
      </div>
      <div class="row">
        <label class="f">Fibres (g)<input name="fiber" inputmode="decimal" value="${nv('fiber')}" placeholder="facultatif"></label>
        <label class="f">dont sucres (g)<input name="sugar" inputmode="decimal" value="${nv('sugar')}" placeholder="facultatif"></label>
        <label class="f">Sel (g)<input name="salt" inputmode="decimal" value="${nv('salt')}" placeholder="facultatif"></label>
      </div>
      <p class="mut" data-kcal-hint style="margin:-4px 0 0;font-size:12px"></p>
      <div class="section-lbl">Portion habituelle <span class="mut" style="text-transform:none;letter-spacing:0;font-weight:400">quantité ajoutée d'un clic</span></div>
      <div class="row">
        <label class="f"><span>Quantité (<span data-ulbl>${unitName(v.unit, 2)}</span>)</span><input name="portion" inputmode="decimal" value="${v.portion > 0 ? inputVal(v.portion) : ''}" placeholder="${base(v)}"></label>
        <label class="f" style="flex:2">Nom de la portion<input name="portionName" value="${esc(v.portionName || '')}" placeholder="Ex. : 1 bol, 1 tranche, 1 pot"></label>
      </div>
      <div class="section-lbl">Prix <span class="mut" style="text-transform:none;letter-spacing:0;font-weight:400">facultatif · pour calculer le coût des repas</span></div>
      <div class="row">
        <label class="f">Prix payé (€)<input name="priceAmount" inputmode="decimal" value="${hasPrice(v) ? inputVal(v.price.amount) : ''}" placeholder="Ex. : 2,49"></label>
        <label class="f"><span>Pour (<span data-ulbl>${unitName(v.unit, 2)}</span>)</span><input name="priceQty" inputmode="decimal" value="${hasPrice(v) ? inputVal(v.price.qty) : ''}" placeholder="Ex. : ${v.unit === 'pc' ? 6 : 500}"></label>
        <div class="auto mut" data-price-hint style="font-size:12px;padding-bottom:10px;min-width:150px"></div>
      </div>
      <label class="check"><input type="checkbox" name="fav" ${v.fav ? 'checked' : ''}> Favori</label>`,
    onMount: form => {
      let unit = v.unit;
      const hint = () => {
        const p = numOr0(form.prot.value), c = numOr0(form.carb.value), l = numOr0(form.fat.value), k = num(form.kcal.value);
        const calc = p * 4 + c * 4 + l * 9;
        $('[data-kcal-hint]', form).textContent = !calc ? '' : !isFinite(k) ? `Calories calculées depuis les macros : ${kc(calc)} kcal` : Math.abs(calc - k) > Math.max(25, k * 0.15) ? `Attention : les macros donnent ${kc(calc)} kcal` : '';
      };
      ['kcal', 'prot', 'carb', 'fat'].forEach(k => form[k].addEventListener('input', hint));
      const priceHint = () => {
        const tmp = { unit, price: { amount: num(form.priceAmount.value), qty: num(form.priceQty.value) } };
        const p = numOr0(form.portion.value) || base(tmp);
        $('[data-price-hint]', form).innerHTML = hasPrice(tmp) ? `${priceTxt(tmp)}<br>${eur(foodCost(tmp, p))} la portion` : '';
      };
      ['priceAmount', 'priceQty', 'portion'].forEach(k => form[k].addEventListener('input', priceHint));
      $$('[data-unit] button', form).forEach(b => b.onclick = () => {
        unit = b.dataset.v;
        $$('[data-unit] button', form).forEach(x => x.classList.toggle('on', x === b));
        $('[data-per]', form).textContent = perTxt({ unit });
        $$('[data-ulbl]', form).forEach(s => { s.textContent = unitName(unit, 2); });
        form.portion.placeholder = base({ unit });
        form.priceQty.placeholder = 'Ex. : ' + (unit === 'pc' ? 6 : 500);
        priceHint();
      });
      Object.defineProperty(form, '_unit', { get: () => unit });
      $('[data-off]', form).onclick = () => offModal(form.name.value.trim(), p => {
        form.name.value = p.name; form.brand.value = p.brand;
        $(`[data-unit] button[data-v="${p.unit}"]`, form).click();
        for (const k of NK) form[k].value = p.n[k] ? inputVal(p.n[k]) : '';
        if (p.portion) form.portion.value = inputVal(p.portion);
        hint(); priceHint();
      });
      hint(); priceHint();
    },
    onSubmit: form => {
      const name = form.name.value.trim();
      if (!name) return 'Nom obligatoire.';
      const n = zero();
      for (const k of NK) n[k] = numOr0(form[k].value);
      if (!isFinite(num(form.kcal.value))) n.kcal = Math.round(n.prot * 4 + n.carb * 4 + n.fat * 9);
      if (n.kcal < 0 || NK.some(k => n[k] < 0)) return 'Valeurs négatives impossibles.';
      if (!n.kcal && !n.prot && !n.carb && !n.fat) return 'Indiquer au moins les calories ou les macros.';
      const dup = D.foods.find(x => x.id !== f?.id && norm(x.name) === norm(name) && norm(x.brand) === norm(form.brand.value.trim()));
      if (dup) return 'Un aliment porte déjà ce nom.';
      const portion = num(form.portion.value);
      const pa = form.priceAmount.value.trim(), pq = form.priceQty.value.trim();
      let price = null;
      if (pa || pq) {
        price = { amount: num(pa), qty: num(pq) };
        if (!(price.amount >= 0)) return 'Prix invalide.';
        if (!(price.qty > 0)) return `Indiquer pour quelle quantité (${unitName(form._unit, 2)}) ce prix est payé.`;
        if (!price.amount) price = null;
      }
      const data = { name, brand: form.brand.value.trim(), unit: form._unit, n: roundN(n), portion: portion > 0 ? portion : 0, portionName: form.portionName.value.trim(), price, fav: form.fav.checked };
      if (f) { Object.assign(f, data); stamp(f); }
      else D.foods.push(stamp({ id: uid(), ...data }));
      // Les entrées déjà saisies sans prix reçoivent le coût correspondant
      let filled = 0;
      if (price && f) for (const e of D.entries) if (e.kind === 'food' && e.ref === f.id && e.cost == null && e.unit === f.unit) { e.cost = foodCost(f, e.qty); stamp(e); filled++; }
      persist(); render(); toast((f ? 'Aliment modifié' : 'Aliment créé') + (filled ? ` · coût ajouté à ${plural(filled, 'entrée')} du journal` : ''));
    }
  });
}

// Recherche dans Open Food Facts : un clic sur un résultat remplit la fiche aliment
function offModal(initial, onPick) {
  let results = [];
  modal({
    title: 'Open Food Facts', submit: 'Rechercher', wide: true,
    body: `<p class="mut" style="margin:0;font-size:12px">Base collaborative et gratuite d'aliments du commerce. La recherche est envoyée à openfoodfacts.org. Les valeurs sont données pour 100 g ou 100 ml.</p>
      <input name="q" value="${esc(initial)}" placeholder="Ex. : skyr nature, ou le code-barres 3017620422003">
      <div class="offlist" data-off-list></div>`,
    onMount: form => {
      $('[data-off-list]', form).onclick = e => {
        const r = e.target.closest('[data-off-pick]');
        if (!r) return;
        onPick(results[+r.dataset.offPick]);
        $('[data-close]', form).click();
      };
      if (initial) setTimeout(() => form.requestSubmit(), 50);
    },
    onSubmit: async form => {
      const box = $('[data-off-list]', form), q = form.q.value.trim();
      if (!q) return 'Saisir un nom ou un code-barres.';
      box.innerHTML = '<div class="empty">Recherche…</div>';
      const res = await api.offSearch(q);
      if (!res.ok) { box.innerHTML = ''; return res.error === 'offline' ? 'Pas de connexion à Open Food Facts.' : res.error === 'timeout' ? 'Open Food Facts ne répond pas, réessayer.' : res.error === 'busy' ? 'Open Food Facts est surchargé : réessayer dans une minute (la recherche par code-barres marche souvent quand même).' : 'Erreur : ' + res.error; }
      results = res.items;
      box.innerHTML = results.map((p, i) => `<div class="offrow" data-off-pick="${i}">
        <div class="tx"><b>${esc(p.name)}</b><small>${esc([p.brand, p.quantity, p.code].filter(Boolean).join(' · '))}</small></div>
        <span class="kc">${kc(p.n.kcal)} kcal</span><span class="mac">${macroLine(p.n)}</span></div>`).join('')
        || '<div class="empty">Aucun produit trouvé.</div>';
      return KEEP_OPEN;
    }
  });
}

// ================= Plats =================
function renderDishes() {
  const q = norm($('#dSearch').value.trim());
  const list = sortItems('dishes', D.dishes.filter(d => !q || norm(d.name).includes(q)));
  $('#dCount').textContent = plural(list.length, 'plat');
  $('#dSort').innerHTML = sortControls('dishes');
  $('#dGrid').innerHTML = list.map(d => {
    const di = dishInfo(d);
    return `<div class="card dish">
      <div class="head"><b>${esc(d.name)}<small>${plural(d.items.length, 'ingrédient')} · ${fmt(di.portions)} portion${di.portions > 1 ? 's' : ''}${di.weight ? ` · ${fmt(di.weight, 0)} g` : ''}</small></b>
        <button class="icon-btn star ${d.fav ? 'on' : ''}" data-fav="dish:${d.id}" title="Favori">${ic('star')}</button></div>
      <div class="big">${kc(di.per.kcal)} <small>kcal / portion</small>${di.costPer != null ? `<span class="cost-chip" style="float:right;margin-top:6px" title="${di.costPartial ? PARTIAL_TIP : 'Coût par portion'}">${eur(di.costPer)}${di.costPartial ? '*' : ''} / portion</span>` : ''}</div>
      ${macroChips(di.per)}
      ${macroSplit(di.per)}
      <div class="mut" style="font-size:12px;margin-top:-4px">${fmt(density(di.per))} g de protéines pour 100 kcal${di.costPer > 0 && !di.costPartial ? ` · ${fmt(di.per.prot / di.costPer, 0)} g par €` : ''}</div>
      <ul>${d.items.slice(0, 6).map(it => { const f = food(it.food); return `<li><span>${f ? esc(f.name) : '<i>aliment supprimé</i>'}</span><span>${f ? qtyTxt(it.qty, f.unit) : ''}</span></li>`; }).join('')}${d.items.length > 6 ? `<li><span>+ ${d.items.length - 6} autre(s)</span></li>` : ''}</ul>
      ${di.missing ? `<div class="err" style="margin:0">${plural(di.missing, 'ingrédient')} supprimé${di.missing > 1 ? 's' : ''} : non compté${di.missing > 1 ? 's' : ''}</div>` : ''}
      <div class="foot"><button class="btn pri sm" data-addq="dish:${d.id}">${ic('plus')}Ajouter au journal</button>
        <button class="icon-btn" data-dup-dish="${d.id}" title="Dupliquer">${ic('copy')}</button>
        <button class="icon-btn" data-edit-dish="${d.id}" title="Modifier">${ic('edit')}</button>
        <button class="icon-btn del" data-del-dish="${d.id}" title="Supprimer">${ic('trash')}</button></div>
    </div>`;
  }).join('') || `<div class="card empty" style="grid-column:1/-1">${D.dishes.length ? 'Aucun plat ne correspond.' : 'Aucun plat. Un plat regroupe plusieurs aliments (ex. : bol de porridge, pâtes bolognaise) pour les ajouter en un clic.'}</div>`;
}

const ingTxt = (f, q) => `${kc(foodNut(f, q).kcal)} kcal${hasPrice(f) ? `<small class="mut" style="display:block">${eur(foodCost(f, q))}</small>` : ''}`;
function dishModal(d, preset) {
  const v = structuredClone(d || preset || { name: '', items: [], portions: 1 });
  modal({
    title: d ? 'Modifier le plat' : 'Nouveau plat', submit: d ? 'Enregistrer' : 'Créer', wide: true,
    body: `<div class="row"><label class="f" style="flex:3">Nom du plat<input name="name" value="${esc(v.name)}" placeholder="Ex. : Porridge banane"></label>
        <label class="f">Nombre de portions<input name="portions" inputmode="decimal" value="${inputVal(v.portions || 1)}"></label>
        <label class="f">Poids cuit total (g)<input name="cooked" inputmode="decimal" value="${v.cooked > 0 ? inputVal(v.cooked) : ''}" placeholder="facultatif"></label></div>
      <div class="section-lbl">Ingrédients</div>
      <div class="ing-search"><input data-ing-q placeholder="Rechercher un aliment à ajouter…" autocomplete="off"><div class="ing-drop" data-ing-drop hidden></div></div>
      <div class="ing-list" data-ing-list></div>
      <div class="grid g2" style="gap:10px" data-totals></div>
      <label class="f">Notes<textarea name="notes" placeholder="Recette, astuces… (facultatif)">${esc(v.notes || '')}</textarea></label>
      <label class="check"><input type="checkbox" name="fav" ${v.fav ? 'checked' : ''}> Favori</label>`,
    onMount: form => {
      const list = $('[data-ing-list]', form), qi = $('[data-ing-q]', form), drop = $('[data-ing-drop]', form);
      let hl = 0, results = [];
      const totals = () => {
        const di = dishInfo({ ...v, portions: numOr0(form.portions.value) || 1, cooked: numOr0(form.cooked.value) });
        const costLbl = c => (c != null ? ` · ${eur(c)}${di.costPartial ? '*' : ''}` : '');
        const box = (lbl, n) => `<div class="totals-box"><div class="lbl">${lbl}</div><div><b>${kc(n.kcal)}</b>kcal</div><div><b class="pl">${fmt(n.prot)}</b>prot.</div><div><b class="gl">${fmt(n.carb)}</b>gluc.</div><div><b class="ll">${fmt(n.fat)}</b>lip.</div></div>`;
        $('[data-totals]', form).innerHTML = box(`Total${di.weight ? ` · ${fmt(di.weight, 0)} g` : ''}${costLbl(di.cost)}`, di.n) + box(`Par portion${costLbl(di.costPer)}`, di.per)
          + (di.costPartial ? `<div class="mut" style="font-size:12px;grid-column:1/-1">${PARTIAL_TIP} : coût incomplet</div>` : '');
      };
      const draw = () => {
        list.innerHTML = v.items.map((it, i) => {
          const f = food(it.food);
          return `<div class="ing"><span class="nm">${f ? esc(f.name) : '<i>aliment supprimé</i>'}</span>
            <input data-ing-qty="${i}" inputmode="decimal" value="${inputVal(it.qty)}"><span class="mut">${f ? unitName(f.unit, 2) : ''}</span>
            <span class="kc" data-ing-kc="${i}">${f ? ingTxt(f, it.qty) : ''}</span>
            <button type="button" class="icon-btn del" data-ing-del="${i}">${ic('x')}</button></div>`;
        }).join('') || '<div class="mut" style="font-size:13px">Aucun ingrédient pour l\'instant.</div>';
        totals();
      };
      const search = () => {
        const q = norm(qi.value.trim());
        if (!q) { drop.hidden = true; return; }
        results = D.foods.filter(f => norm(f.name + ' ' + (f.brand || '')).includes(q)).sort((a, b) => (norm(b.name).startsWith(q) - norm(a.name).startsWith(q)) || a.name.localeCompare(b.name, 'fr')).slice(0, 12);
        hl = 0;
        drop.innerHTML = results.map((f, i) => `<div data-pick="${f.id}" class="${i === 0 ? 'hl' : ''}"><span>${esc(f.name)}${f.brand ? ` <small>${esc(f.brand)}</small>` : ''}</span><small>${kc(f.n.kcal)} kcal ${perTxt(f)}</small></div>`).join('')
          + `<div data-pick-new><span>${ic('plus')} Créer « ${esc(qi.value.trim())} »</span></div>`;
        drop.hidden = false;
      };
      const pick = id => {
        const f = food(id);
        if (!f) return;
        v.items.push({ food: f.id, qty: foodDefault(f) });
        qi.value = ''; drop.hidden = true; draw();
        const inputs = $$('[data-ing-qty]', list); inputs[inputs.length - 1]?.select();
      };
      qi.oninput = search;
      qi.onkeydown = e => {
        if (drop.hidden) return;
        const rows = $$('[data-pick]', drop);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); hl = Math.max(0, Math.min(rows.length - 1, hl + (e.key === 'ArrowDown' ? 1 : -1))); rows.forEach((r, i) => r.classList.toggle('hl', i === hl)); }
        if (e.key === 'Enter') { e.preventDefault(); if (results[hl]) pick(results[hl].id); }
        if (e.key === 'Escape') { e.stopPropagation(); drop.hidden = true; }
      };
      drop.onmousedown = e => {
        e.preventDefault();
        const p = e.target.closest('[data-pick]');
        if (p) return pick(p.dataset.pick);
        if (e.target.closest('[data-pick-new]')) {
          const name = qi.value.trim();
          drop.hidden = true;
          const before = new Set(D.foods.map(f => f.id));
          foodModal(null, { name });
          // Une fois l'aliment créé, il est ajouté au plat
          const wait = setInterval(() => {
            if ($$('.modal-bg').length > 1) return;
            clearInterval(wait);
            const created = D.foods.find(f => !before.has(f.id));
            if (created) pick(created.id);
          }, 200);
        }
      };
      qi.onblur = () => setTimeout(() => { drop.hidden = true; }, 150);
      list.addEventListener('input', e => {
        const i = e.target.dataset.ingQty;
        if (i === undefined) return;
        v.items[i].qty = numOr0(e.target.value);
        const f = food(v.items[i].food);
        if (f) $(`[data-ing-kc="${i}"]`, list).innerHTML = ingTxt(f, v.items[i].qty);
        totals();
      });
      list.addEventListener('click', e => {
        const b = e.target.closest('[data-ing-del]');
        if (b) { v.items.splice(+b.dataset.ingDel, 1); draw(); }
      });
      form.portions.oninput = totals; form.cooked.oninput = totals;
      form.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.ingQty !== undefined) { e.preventDefault(); qi.focus(); } });
      draw();
    },
    onSubmit: form => {
      const name = form.name.value.trim();
      if (!name) return 'Nom obligatoire.';
      const items = v.items.filter(it => it.qty > 0);
      if (!items.length) return 'Ajouter au moins un ingrédient.';
      const portions = num(form.portions.value);
      if (!(portions > 0)) return 'Nombre de portions invalide.';
      const cooked = num(form.cooked.value);
      const data = { name, items, portions, cooked: cooked > 0 ? cooked : 0, notes: form.notes.value.trim(), fav: form.fav.checked };
      if (d) { Object.assign(d, data); stamp(d); }
      else D.dishes.push(stamp({ id: uid(), ...data }));
      persist(); render(); toast(d ? 'Plat modifié' : 'Plat créé');
    }
  });
}

// ================= Statistiques =================
function destroyCharts() { Object.values(charts).forEach(c => c.destroy()); for (const k in charts) delete charts[k]; }
function chartBase() {
  Chart.defaults.color = cssVar('--mut');
  Chart.defaults.borderColor = cssVar('--bd');
  Chart.defaults.font.family = '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif';
}
function renderStats() {
  $$('#statRange button').forEach(b => b.classList.toggle('on', +b.dataset.v === statDays));
  const end = todayStr(), start = addDays(end, -(statDays - 1));
  const dates = Array.from({ length: statDays }, (_, i) => addDays(start, i));
  const byDay = new Map(dates.map(d => [d, zero()]));
  for (const e of D.entries) if (byDay.has(e.date)) addN(byDay.get(e.date), e.n);
  const logged = dates.filter(d => byDay.get(d).kcal > 0);
  const avg = logged.reduce((a, d) => addN(a, byDay.get(d)), zero());
  const nLogged = logged.length || 1;
  for (const k of NK) avg[k] /= nLogged;
  const g = D.settings.goals;
  const inTarget = g.kcal ? logged.filter(d => Math.abs(byDay.get(d).kcal - g.kcal) <= g.kcal * 0.1).length : 0;
  const protOk = g.prot ? logged.filter(d => byDay.get(d).prot >= g.prot * 0.95).length : 0;
  const periodEntries = D.entries.filter(e => e.date >= start && e.date <= end);
  const pc = sumCost(periodEntries);
  const kpi = (lbl, val, sub) => `<div class="card kpi"><div class="lbl">${lbl}</div><div class="val">${val}</div><div class="sub">${sub}</div></div>`;
  $('#sKpis').innerHTML = logged.length
    ? kpi('Moyenne par jour', `${kc(avg.kcal)} kcal`, g.kcal ? `objectif ${kc(g.kcal)} kcal · écart ${avg.kcal - g.kcal > 0 ? '+' : ''}${kc(avg.kcal - g.kcal)}` : '')
      + kpi('Jours dans l\'objectif', `${inTarget} / ${logged.length}`, 'à ±10 % des calories visées')
      + kpi('Protéines moyennes', `${fmt(avg.prot, 0)} g`, g.prot ? `objectif atteint ${plural(protOk, 'jour')}` : '')
      + (pc.known
        ? kpi('Coût moyen par jour', `${eur(pc.cost / nLogged)}${pc.partial ? '*' : ''}`, `${eur(pc.cost)} sur la période · ${logged.length}/${statDays} jours saisis`)
        : kpi('Jours saisis', `${logged.length} / ${statDays}`, `P ${fmt(avg.prot, 0)} · G ${fmt(avg.carb, 0)} · L ${fmt(avg.fat, 0)} g en moyenne`))
    : `<div class="card empty" style="grid-column:1/-1">Aucune donnée sur les ${statDays} derniers jours.</div>`;
  $('#sGoalLbl').textContent = g.kcal ? `objectif ${kc(g.kcal)} kcal` : '';

  destroyCharts(); chartBase();
  const lbls = dates.map(d => statDays > 31 ? `${d.slice(8)}/${d.slice(5, 7)}` : `${WD[toDate(d).getDay()].slice(0, 3)} ${+d.slice(8)}`);
  const acc = cssVar('--acc'), over = cssVar('--over');
  charts.kcal = new Chart($('#chKcal'), {
    type: 'bar',
    data: { labels: lbls, datasets: [
      { label: 'Calories', data: dates.map(d => Math.round(byDay.get(d).kcal)), backgroundColor: dates.map(d => g.kcal && byDay.get(d).kcal > g.kcal * 1.1 ? over : acc), borderRadius: 5, maxBarThickness: 34 },
      ...(g.kcal ? [{ type: 'line', label: 'Objectif', data: dates.map(() => g.kcal), borderColor: cssVar('--mut'), borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0 }] : [])
    ] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } },
      onClick: (_e, els) => { if (els[0]) { day = dates[els[0].index]; go('journal'); } } }
  });
  const pk = avg.prot * 4, ck = avg.carb * 4, fk = avg.fat * 9;
  charts.macro = new Chart($('#chMacro'), {
    type: 'doughnut',
    data: { labels: ['Protéines', 'Glucides', 'Lipides'], datasets: [{ data: [pk, ck, fk].map(Math.round), backgroundColor: [cssVar('--prot'), cssVar('--carb'), cssVar('--fat')], borderWidth: 0 }] },
    options: { maintainAspectRatio: false, cutout: '64%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } },
      tooltip: { callbacks: { label: c => { const t = pk + ck + fk || 1; return ` ${c.label} : ${Math.round(c.raw / t * 100)} % (${kc(c.raw)} kcal)`; } } } } }
  });
  charts.prot = new Chart($('#chProt'), {
    type: 'bar',
    data: { labels: lbls, datasets: [
      { label: 'Protéines (g)', data: dates.map(d => Math.round(byDay.get(d).prot)), backgroundColor: cssVar('--prot'), borderRadius: 5, maxBarThickness: 34 },
      ...(g.prot ? [{ type: 'line', label: 'Objectif', data: dates.map(() => g.prot), borderColor: cssVar('--mut'), borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0 }] : [])
    ] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } }
  });

  // Coût
  $('#sCostRow').hidden = !pc.known;
  if (pc.known) {
    const costDay = new Map(dates.map(d => [d, 0]));
    for (const e of periodEntries) if (e.cost != null) costDay.set(e.date, costDay.get(e.date) + e.cost);
    $('#sCostLbl').textContent = pc.partial ? PARTIAL_TIP : '';
    charts.cost = new Chart($('#chCost'), {
      type: 'bar',
      data: { labels: lbls, datasets: [{ label: 'Coût', data: dates.map(d => Math.round(costDay.get(d) * 100) / 100), backgroundColor: cssVar('--carb'), borderRadius: 5, maxBarThickness: 34 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + eur(c.raw) } } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { callback: v => eur(v) } } } }
    });
    $('#sCostMeals').innerHTML = meals().map(m => {
      const c = sumCost(periodEntries.filter(e => e.meal === m.i));
      return `<div><span>${esc(m.name)}</span><b>${c.known ? eur(c.cost / nLogged) : '–'}</b></div>`;
    }).join('') + `<div><span><b style="color:var(--txt)">Journée</b></span><b>${eur(pc.cost / nLogged)}</b></div>`;
  }

  // Poids
  const ws = [...D.weights].sort((a, b) => a.date.localeCompare(b.date));
  if (!$('#wDate').value) $('#wDate').value = todayStr();
  charts.weight = new Chart($('#chWeight'), {
    type: 'line',
    data: { labels: ws.map(w => `${w.date.slice(8)}/${w.date.slice(5, 7)}`), datasets: [{ label: 'Poids (kg)', data: ws.map(w => w.kg), borderColor: acc, backgroundColor: cssVar('--acc-soft'), fill: true, tension: .3, pointRadius: 3 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } } } }
  });
  $('#wList').innerHTML = [...ws].reverse().slice(0, 30).map((w, i, arr) => {
    const prev = arr[i + 1];
    const diff = prev ? w.kg - prev.kg : 0;
    return `<div><span>${toDate(w.date).toLocaleDateString('fr-FR')}</span><b>${fmt(w.kg)} kg</b><span class="mut" style="width:60px;text-align:right">${prev ? (diff > 0 ? '+' : '') + fmt(diff) : ''}</span><button class="icon-btn del" data-del-weight="${w.id}">${ic('x')}</button></div>`;
  }).join('');

  // Aliments et plats les plus fréquents
  const top = new Map();
  for (const e of D.entries) {
    if (e.date < start || e.date > end) continue;
    const k = e.kind === 'quick' ? 'quick:' + e.name : e.kind + ':' + e.ref;
    const t = top.get(k) || { name: e.name, kind: e.kind, count: 0, kcal: 0, prot: 0, cost: 0 };
    t.count++; t.kcal += e.n.kcal; t.prot += e.n.prot; t.cost += e.cost || 0;
    top.set(k, t);
  }
  const rows = [...top.values()].sort((a, b) => b.kcal - a.kcal).slice(0, 12);
  const totalK = [...top.values()].reduce((a, t) => a + t.kcal, 0) || 1;
  $('#sTop').innerHTML = rows.length ? `<thead><tr><th>Aliment ou plat</th><th class="r">Fois</th><th class="r">Calories apportées</th><th class="r">Part</th><th class="r">Protéines</th>${pc.known ? '<th class="r">Coût</th>' : ''}</tr></thead>
    <tbody>${rows.map(t => `<tr><td>${esc(t.name)}${t.kind === 'dish' ? ' <span class="chip">plat</span>' : ''}</td><td class="r">${t.count}</td><td class="r">${kc(t.kcal)} kcal</td><td class="r">${Math.round(t.kcal / totalK * 100)} %</td><td class="r pl">${fmt(t.prot, 0)} g</td>${pc.known ? `<td class="r">${t.cost ? eur(t.cost) : '–'}</td>` : ''}</tr>`).join('')}</tbody>`
    : '<tbody><tr><td class="empty">Rien sur la période.</td></tr></tbody>';
}

// ================= Réglages =================
function renderSettings() {
  const g = D.settings.goals, f = $('#goalForm');
  for (const k of ['kcal', 'prot', 'carb', 'fat', 'fiber', 'water']) if (document.activeElement !== f[k]) f[k].value = g[k] ? inputVal(g[k]) : '';
  goalHint();
  $('#mealInputs').innerHTML = [0, 1, 2, 3, 4, 5].map(i => `<label class="f">Repas ${i + 1}<input name="m${i}" value="${esc(D.settings.meals[i] || '')}" placeholder="${i < 4 ? esc(DEFAULT_MEALS[i]) : 'facultatif'}"></label>`).join('');
  $$('#setTheme button').forEach(b => b.classList.toggle('on', b.dataset.v === D.settings.theme));
  syncUi();
  api.version().then(v => { $('#appVersion').textContent = v; }).catch(() => {});
}
function goalHint() {
  const f = $('#goalForm');
  const p = numOr0(f.prot.value), c = numOr0(f.carb.value), l = numOr0(f.fat.value), k = numOr0(f.kcal.value);
  const m = p * 4 + c * 4 + l * 9;
  $('#goalHint').textContent = m ? `Les macros représentent ${kc(m)} kcal${k ? ` (${Math.round(m / k * 100)} % de l'objectif)` : ''} : protéines ${Math.round(p * 4 / m * 100)} %, glucides ${Math.round(c * 4 / m * 100)} %, lipides ${Math.round(l * 9 / m * 100)} %.` : '';
}

// Aliments courants : identifiants fixes pour éviter les doublons quand deux PC les ajoutent
const STARTER = [
  ['riz', 'Riz blanc cuit', 'g', 130, 2.7, 28, 0.3, 0.4, 0.1, 0, 150, 'Assiette'],
  ['pates', 'Pâtes cuites', 'g', 131, 5, 25, 1.1, 1.8, 0.6, 0, 200, 'Assiette'],
  ['patate', 'Pomme de terre cuite', 'g', 86, 1.9, 19, 0.1, 1.8, 0.9, 0, 200, ''],
  ['patdouce', 'Patate douce cuite', 'g', 90, 2, 21, 0.2, 3.3, 6.5, 0.1, 200, ''],
  ['avoine', 'Flocons d\'avoine', 'g', 372, 13.5, 58.7, 7, 10, 1, 0, 50, 'Bol'],
  ['paincomplet', 'Pain complet', 'g', 247, 13, 41, 3.4, 7, 6, 1.2, 40, 'Tranche'],
  ['baguette', 'Baguette', 'g', 273, 9, 55, 1.2, 2.7, 2.5, 1.3, 60, '1/4 de baguette'],
  ['poulet', 'Blanc de poulet cuit', 'g', 165, 31, 0, 3.6, 0, 0, 0.2, 150, ''],
  ['steak5', 'Steak haché 5 % (cru)', 'g', 125, 21, 0, 4.5, 0, 0, 0.2, 100, 'Steak'],
  ['saumon', 'Saumon', 'g', 208, 20, 0, 13, 0, 0, 0.1, 125, 'Pavé'],
  ['thon', 'Thon au naturel', 'g', 116, 26, 0, 1, 0, 0, 0.8, 100, 'Boîte égouttée'],
  ['jambon', 'Jambon blanc', 'g', 110, 20, 1, 3, 0, 1, 1.9, 40, 'Tranche'],
  ['oeuf', 'Œuf', 'pc', 72, 6.3, 0.4, 4.8, 0, 0.2, 0.1, 1, 'Œuf moyen'],
  ['lait', 'Lait demi-écrémé', 'ml', 46, 3.3, 4.8, 1.6, 0, 4.8, 0.1, 250, 'Verre'],
  ['skyr', 'Skyr nature', 'g', 63, 11, 4, 0.2, 0, 4, 0.1, 150, 'Pot'],
  ['fromblanc', 'Fromage blanc 0 %', 'g', 45, 7.5, 3.8, 0.1, 0, 3.8, 0.1, 100, ''],
  ['emmental', 'Emmental', 'g', 380, 28, 0, 29, 0, 0, 0.5, 30, 'Portion'],
  ['whey', 'Whey protéine', 'g', 380, 78, 6, 5, 0, 4, 0.5, 30, 'Dose'],
  ['banane', 'Banane', 'g', 89, 1.1, 23, 0.3, 2.6, 12, 0, 120, 'Banane moyenne'],
  ['pomme', 'Pomme', 'g', 52, 0.3, 14, 0.2, 2.4, 10, 0, 150, 'Pomme moyenne'],
  ['orange', 'Orange', 'g', 47, 0.9, 12, 0.1, 2.4, 9, 0, 150, 'Orange moyenne'],
  ['brocoli', 'Brocoli cuit', 'g', 35, 2.4, 7.2, 0.4, 3.3, 1.4, 0, 150, ''],
  ['haricots', 'Haricots verts cuits', 'g', 31, 1.8, 7, 0.1, 3.4, 1.4, 0, 150, ''],
  ['tomate', 'Tomate', 'g', 18, 0.9, 3.9, 0.2, 1.2, 2.6, 0, 120, 'Tomate moyenne'],
  ['avocat', 'Avocat', 'g', 160, 2, 9, 15, 7, 0.7, 0, 100, 'Demi-avocat'],
  ['lentilles', 'Lentilles cuites', 'g', 116, 9, 20, 0.4, 8, 1.8, 0, 150, ''],
  ['amandes', 'Amandes', 'g', 579, 21, 22, 50, 12.5, 4.4, 0, 30, 'Poignée'],
  ['cacahuete', 'Beurre de cacahuète', 'g', 588, 25, 20, 50, 6, 9, 0.5, 15, 'Cuillère à soupe'],
  ['huileolive', 'Huile d\'olive', 'g', 884, 0, 0, 100, 0, 0, 0, 10, 'Cuillère à soupe'],
  ['beurre', 'Beurre', 'g', 717, 0.9, 0.1, 81, 0, 0.1, 0, 10, 'Noisette'],
  ['choco70', 'Chocolat noir 70 %', 'g', 598, 7.8, 46, 43, 11, 24, 0, 20, '2 carreaux'],
  ['coca', 'Coca-Cola', 'ml', 42, 0, 10.6, 0, 0, 10.6, 0, 330, 'Canette']
];
// Demande confirmation avant d'ajouter la liste d'aliments courants
function confirmStarter() {
  const missing = STARTER.filter(([key, name]) => !food('std-' + key) && !D.foods.some(f => norm(f.name) === norm(name)));
  if (!missing.length) { toast('Les aliments courants sont déjà tous présents'); return; }
  modal({
    title: 'Ajouter les aliments courants', submit: `Ajouter ${plural(missing.length, 'aliment')}`,
    body: `<p style="margin:0">${plural(missing.length, 'aliment')} de base ${missing.length > 1 ? 'vont être ajoutés' : 'va être ajouté'} à ta liste, avec des valeurs moyennes que tu pourras modifier :</p>
      <p class="mut" style="margin:0;font-size:12.5px;max-height:150px;overflow-y:auto">${missing.map(s => esc(s[1])).join(' · ')}</p>
      <p class="mut" style="margin:0;font-size:12px">Ceux que tu as déjà ne sont pas ajoutés en double. Tu pourras les retirer ensuite dans Aliments (cases à cocher puis « Supprimer »).</p>`,
    onSubmit: () => { loadStarter(); }
  });
}
function loadStarter() {
  let added = 0;
  for (const [key, name, unit, kcal, prot, carb, fat, fiber, sugar, salt, portion, portionName] of STARTER) {
    const id = 'std-' + key;
    if (food(id) || D.foods.some(f => norm(f.name) === norm(name))) continue;
    D.foods.push(stamp({ id, name, brand: '', unit, n: { kcal, prot, carb, fat, fiber, sugar, salt }, portion, portionName, fav: false }));
    added++;
  }
  persist(); render();
  toast(added ? `${plural(added, 'aliment')} ajouté${added > 1 ? 's' : ''}` : 'Les aliments courants sont déjà présents');
}

async function exportJson() {
  const { sync: _s, dirty: _d, server: _v, ...rest } = D;
  const r = await api.exportBackup(JSON.stringify({ app: 'ttrack', exported: new Date().toISOString(), ...rest }, null, 1), `ttrack-${todayStr()}.json`);
  if (r) toast('Sauvegarde exportée');
}
async function importJson() {
  const data = await api.importBackup();
  if (!data) return;
  if (data.error || data.app !== 'ttrack') { toast('Fichier non reconnu'); return; }
  let added = 0;
  for (const key of Object.values(SYNC_ARRAYS)) {
    for (const o of data[key] || []) {
      if (!o?.id || D[key].some(x => x.id === o.id) || D.tomb[o.id]) continue;
      D[key].push(stamp(o)); added++;
    }
  }
  persist(); render();
  toast(added ? `${plural(added, 'élément')} importé${added > 1 ? 's' : ''}` : 'Rien de nouveau dans ce fichier');
}

// ================= Synchronisation =================
const syncState = { busy: false, last: null, error: null, timer: null, pending: null };

function markEverythingDirty() {
  for (const key of Object.values(SYNC_ARRAYS)) for (const o of D[key]) { if (!o.u) o.u = Date.now(); markDirty(o.id); }
  if (!D.settings.u) D.settings.u = Date.now();
  markDirty('settings');
  for (const id of Object.keys(D.tomb)) markDirty(id);
}
function collectRecords() {
  const out = [];
  for (const id of Object.keys(D.dirty)) {
    if (id === 'settings') { out.push({ id, kind: 'settings', u: D.settings.u, deleted: false, data: { ...D.settings } }); continue; }
    const t = D.tomb[id];
    if (t) { out.push({ id, kind: t.kind, u: t.u, deleted: true, data: null }); continue; }
    for (const [kind, key] of Object.entries(SYNC_ARRAYS)) {
      const o = D[key].find(x => x.id === id);
      if (o) { out.push({ id, kind, u: o.u, deleted: false, data: o }); break; }
    }
  }
  return out;
}
function applyRemote(rows) {
  let changed = 0;
  for (const r of rows) {
    if (r.kind === 'settings') {
      if (r.data && (r.data.u || 0) > (D.settings.u || 0)) { D.settings = { ...D.settings, ...r.data }; delete D.dirty.settings; changed++; }
      continue;
    }
    const key = SYNC_ARRAYS[r.kind];
    if (!key) continue;
    const arr = D[key], i = arr.findIndex(o => o.id === r.id);
    const localU = i >= 0 ? (arr[i].u || 0) : (D.tomb[r.id]?.u || 0);
    if (r.u <= localU) continue;
    if (r.deleted) {
      if (i >= 0) arr.splice(i, 1);
      D.tomb[r.id] = { u: r.u, kind: r.kind };
    } else {
      if (i >= 0) arr[i] = r.data; else arr.push(r.data);
      delete D.tomb[r.id];
    }
    delete D.dirty[r.id];
    changed++;
  }
  return changed;
}

const SUPABASE_SQL = `create table if not exists public.ttrack_meta (
  user_id uuid primary key references auth.users on delete cascade,
  salt text not null,
  wrapped_key text not null,
  recovery_wrapped text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ttrack_records (
  user_id uuid not null references auth.users on delete cascade,
  id text not null,
  kind text not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  payload text,
  primary key (user_id, id)
);
create index if not exists ttrack_records_user_updated on public.ttrack_records (user_id, updated_at);

alter table public.ttrack_meta enable row level security;
alter table public.ttrack_records enable row level security;

drop policy if exists ttrack_meta_own on public.ttrack_meta;
create policy ttrack_meta_own on public.ttrack_meta
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists ttrack_records_own on public.ttrack_records;
create policy ttrack_records_own on public.ttrack_records
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);`;
const serverHost = () => (D.server?.url || '').replace('https://', '').replace('.supabase.co', '');

function serverWizard() {
  let step = D.server ? 1 : 0;
  const draw = form => {
    $$('[data-step]', form).forEach(p => { p.hidden = +p.dataset.step !== step; });
    $('[data-wizard-back]', form).hidden = step === 0;
    $('footer .btn.pri', form).textContent = step < 2 ? 'Continuer' : 'Tester et enregistrer';
  };
  modal({
    title: 'Configurer le serveur de synchronisation', submit: 'Continuer', wide: true,
    extraFooter: '<button type="button" class="btn left" data-wizard-back>Retour</button>',
    body: `
      <div data-step="0">
        <p style="margin:0 0 12px">La synchronisation passe par une base de données personnelle et gratuite chez Supabase. Les données y sont déposées chiffrées : le service ne peut pas les lire.</p>
        <p style="margin:0 0 12px"><b>Tu as déjà un projet Supabase pour Tmoney ?</b> Tu peux le réutiliser : Ttrack a ses propres tables. Passe directement à l'étape suivante et ouvre ce projet.</p>
        <ol style="margin:0;padding-left:20px;line-height:1.9">
          <li>Sinon : créer un compte sur <a href="#" data-open="https://supabase.com">supabase.com</a>.</li>
          <li><b>New project</b>, nom <b>ttrack</b>, région Europe, plan <b>Free</b>, puis attendre 1 à 2 minutes.</li>
        </ol>
      </div>
      <div data-step="1" hidden>
        <p style="margin:0 0 12px">Dans le projet Supabase : menu <b>SQL Editor</b> → <b>New query</b>, coller le texte ci-dessous puis <b>Run</b>. Cela crée les deux tables de Ttrack.</p>
        <button type="button" class="btn pri" data-copy-sql>Copier le SQL</button>
        <span class="mut" data-copied style="margin-left:10px;font-size:12px"></span>
        <pre style="max-height:180px;overflow:auto;background:var(--card-2);border:1px solid var(--bd);border-radius:10px;padding:12px;font-size:11px;margin-top:12px">${esc(SUPABASE_SQL)}</pre>
        <p class="mut" style="margin:12px 0 0;font-size:12px">Nouveau projet uniquement : <b>Authentication</b> → <b>Sign In / Providers</b> → désactiver <b>Confirm email</b>.</p>
      </div>
      <div data-step="2" hidden>
        <p style="margin:0 0 12px">Dans le projet Supabase : <b>Project Settings</b> → <b>API Keys</b>.</p>
        <label class="f">Adresse du projet (Project URL)<input name="url" placeholder="https://xxxxxxxx.supabase.co" value="${esc(D.server?.url || '')}"></label>
        <label class="f" style="margin-top:12px">Clé publishable (ou anon public)<input name="key" placeholder="sb_publishable_..." value="${esc(D.server?.key || '')}"></label>
        <p class="mut" style="margin:10px 0 0;font-size:12px">Ne jamais utiliser la clé <b>secret</b> ou <b>service_role</b>.</p>
      </div>`,
    onMount: form => {
      draw(form);
      $('[data-wizard-back]', form).onclick = () => { step--; draw(form); };
      $('[data-copy-sql]', form).onclick = async () => {
        try { await api.copyText(SUPABASE_SQL); $('[data-copied]', form).textContent = 'Copié'; }
        catch { $('[data-copied]', form).textContent = 'Copie impossible : sélectionner le texte ci-dessous'; }
      };
      $$('[data-open]', form).forEach(a => a.onclick = e => { e.preventDefault(); api.openExternal(a.dataset.open); });
    },
    onSubmit: async form => {
      if (step < 2) { step++; draw(form); return KEEP_OPEN; }
      const cfg = { url: form.url.value.trim().replace(/\/+$/, ''), key: form.key.value.trim() };
      const res = await api.syncTestServer(cfg);
      const err = res.ok ? res.data.error : 'other';
      if (err) return {
        url: 'Adresse invalide : elle ressemble à https://xxxxxxxx.supabase.co',
        key: 'Clé refusée par le serveur : reprendre la clé publishable dans API Keys.',
        tables: 'Tables absentes : revenir à l\'étape précédente et exécuter le SQL dans le SQL Editor.',
        unreachable: 'Serveur injoignable : vérifier l\'adresse et la connexion internet.',
        other: 'Erreur : ' + (res.data?.detail || res.error || 'inconnue')
      }[err];
      D.server = cfg;
      await api.syncSetServer(cfg);
      await persist(true);
      renderSettings();
      toast('Serveur enregistré');
    }
  });
}

function syncBadge() {
  const b = $('#syncBadge');
  const on = !!D.sync?.email;
  b.hidden = !on;
  if (!on) return;
  b.className = 'sync-badge ' + (syncState.busy ? 'busy' : syncState.error ? 'err' : '');
  b.innerHTML = `<i></i><span>${syncState.busy ? 'Synchronisation…' : syncState.error ? (syncState.error === 'hors ligne' ? 'Hors ligne' : 'Erreur de synchro') : 'Synchronisé'}</span>`;
  b.title = syncState.error || (syncState.last ? 'Dernière synchro : ' + new Date(syncState.last).toLocaleTimeString('fr-FR') : '');
}
function syncUi() {
  syncBadge();
  if (page !== 'settings') return;
  const on = !!D.sync?.email, hasServer = !!D.server?.url;
  $('#syncServer').textContent = hasServer ? serverHost() : 'Non configuré';
  $('#syncAccount').textContent = on ? D.sync.email : hasServer ? 'Non connecté' : 'Configurer d\'abord le serveur';
  $('#syncNow').hidden = !on;
  $('#syncWipeRow').hidden = !on;
  $('#syncButtons').innerHTML = on ? '<button class="btn" data-sync="out">Se déconnecter</button>'
    : hasServer ? '<button class="btn pri" data-sync="signup">Créer un compte</button><button class="btn" data-sync="signin">Se connecter</button>' : '';
  $('#syncState').textContent = !on ? 'Synchronisation désactivée'
    : syncState.busy ? 'Synchronisation en cours…'
    : syncState.error ? `Erreur : ${syncState.error}`
    : syncState.last ? `À jour · dernière synchro à ${new Date(syncState.last).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : 'En attente';
}

async function syncNow(silent = true) {
  if (!D.sync?.email || syncState.busy) return;
  syncState.busy = true; syncState.error = null; syncUi();
  try {
    const pulled = await api.syncPull(D.sync.lastPull || null);
    if (!pulled.ok) throw new Error(pulled.error);
    const changed = applyRemote(pulled.data);
    const toPush = collectRecords();
    if (toPush.length) {
      const pushed = await api.syncPush(toPush);
      if (!pushed.ok) throw new Error(pushed.error);
      // On ne libère que ce qui n'a pas bougé pendant l'envoi
      const after = new Map(collectRecords().map(r => [r.id, r.u]));
      for (const r of toPush) if (!after.has(r.id) || after.get(r.id) === r.u) delete D.dirty[r.id];
    }
    const maxU = pulled.data.reduce((a, r) => Math.max(a, r.u), 0);
    if (maxU) D.sync.lastPull = new Date(maxU - 60000).toISOString();
    // La session a pu être renouvelée : on garde la plus récente pour le prochain lancement
    const st = await api.syncStatus();
    if (st?.session && D.sync) D.sync.session = st.session;
    syncState.last = Date.now();
    await persist(true);
    if (changed && !$('.modal-bg')) render();
    if (!silent) toast(changed ? `Synchronisé · ${plural(changed, 'élément')} mis à jour` : 'Synchronisé');
  } catch (e) {
    const msg = String(e.message || e);
    syncState.error = msg === 'offline' ? 'hors ligne' : msg;
    if (!silent) toast('Synchronisation impossible : ' + syncState.error);
  } finally {
    syncState.busy = false; syncUi();
  }
}
const scheduleSync = () => { clearTimeout(syncState.pending); syncState.pending = setTimeout(() => syncNow(true), 2500); };
let focusBound = false;
function startSyncLoop() {
  clearInterval(syncState.timer);
  syncState.timer = setInterval(() => syncNow(true), 30000);
  if (!focusBound) { focusBound = true; window.addEventListener('focus', () => syncNow(true)); }
}
async function afterSignIn(res, extra) {
  D.sync = { email: res.email, mk: res.mk, session: res.session, lastPull: null };
  D.welcomeDone = true;
  markEverythingDirty();
  await persist(true);
  await syncNow(false);
  startSyncLoop();
  render();
  if (extra) extra();
}

function syncAuthModal(mode) {
  const signup = mode === 'signup';
  modal({
    title: signup ? 'Créer un compte de synchronisation' : 'Connexion', submit: signup ? 'Créer le compte' : 'Se connecter',
    body: `<label class="f">Email<input name="email" type="email" autocomplete="off"></label>
      <label class="f">Mot de passe<input name="pwd" type="password" autocomplete="off"></label>
      ${signup ? `<label class="f">Confirmation<input name="pwd2" type="password" autocomplete="off"></label>
        <p class="mut" style="margin:0;font-size:12px">Ce mot de passe chiffre les données envoyées : il n'est jamais transmis en clair. Une clé de secours sera affichée après la création.<br>Déjà un compte Tmoney sur ce serveur ? Même email, même mot de passe : Ttrack s'y ajoute.</p>`
        : `<p class="mut" style="margin:0;font-size:12px">Les données de ce PC seront fusionnées avec celles du compte.</p>
           <button type="button" class="btn sm" style="align-self:flex-start" data-sync="recover">Mot de passe oublié</button>`}`,
    onSubmit: async form => {
      const email = form.email.value.trim(), pwd = form.pwd.value;
      if (!/^\S+@\S+\.\S+$/.test(email)) return 'Email invalide.';
      if (pwd.length < 8) return 'Mot de passe : 8 caractères minimum.';
      if (signup && pwd !== form.pwd2.value) return 'Les mots de passe ne correspondent pas.';
      await api.syncSetServer(D.server);
      const res = signup ? await api.syncSignUp(email, pwd) : await api.syncSignIn(email, pwd);
      if (!res.ok) return {
        'offline': 'Pas de connexion internet.',
        'no-server': 'Serveur non configuré.',
        'confirm-email': 'Compte créé : confirmer l\'email reçu, puis se connecter.',
        'no-vault': 'Ce compte n\'utilise pas encore Ttrack : choisir « Créer un compte » avec le même email.',
        'account-exists': 'Ce compte utilise déjà Ttrack : choisir « Se connecter ».',
        'bad-key': 'Mot de passe incorrect pour le déchiffrement.',
        'Invalid login credentials': 'Email ou mot de passe incorrect.'
      }[res.error] || ('Erreur : ' + res.error);
      await afterSignIn(res.data, signup ? () => showRecoveryKey(res.data.recoveryKey) : null);
      toast(signup ? 'Compte créé' : 'Connecté');
    }
  });
}
function showRecoveryKey(key) {
  modal({
    title: 'Clé de secours', submit: 'J\'ai noté la clé', cancel: false,
    body: `<p style="margin:0">Seul moyen de récupérer les données en ligne en cas de mot de passe oublié. Elle ne sera plus affichée.</p>
      <div style="letter-spacing:2px;font-size:20px;text-align:center;user-select:all;background:var(--card-2);border:1px solid var(--bd);border-radius:10px;padding:14px;font-variant-numeric:tabular-nums">${esc(key)}</div>
      <p class="mut" style="margin:0;font-size:12px">À conserver hors de ce PC : gestionnaire de mots de passe, papier, autre appareil.</p>`,
    onSubmit: () => {}
  });
}
function syncRecoverModal() {
  modal({
    title: 'Mot de passe oublié', submit: 'Récupérer',
    body: `<p class="mut" style="margin:0;font-size:12px">Nécessite la clé de secours affichée à la création du compte, ainsi qu'un nouveau mot de passe défini depuis l'email de réinitialisation Supabase.</p>
      <label class="f">Email<input name="email" type="email"></label>
      <label class="f">Mot de passe actuel<input name="pwd" type="password"></label>
      <label class="f">Clé de secours<input name="rk" placeholder="XXXX-XXXX-XXXX-..."></label>
      <label class="f">Nouveau mot de passe (facultatif)<input name="newPwd" type="password"></label>`,
    onSubmit: async form => {
      await api.syncSetServer(D.server);
      const res = await api.syncRecover(form.email.value.trim(), form.pwd.value, form.rk.value.trim(), form.newPwd.value || null);
      if (!res.ok) return res.error === 'bad-recovery' ? 'Clé de secours incorrecte.' : 'Erreur : ' + res.error;
      await afterSignIn(res.data);
      toast('Accès récupéré');
    }
  });
}

// ================= Modales =================
const KEEP_OPEN = Symbol('keep');
function modal({ title, body, submit = 'Enregistrer', danger = false, wide = false, cancel = true, extraFooter = '', onSubmit, onMount }) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<form class="modal ${wide ? 'wide' : ''}" novalidate><header><h3>${title}</h3><button type="button" class="icon-btn" data-close>${ic('x')}</button></header>
    <div class="body">${body}<div class="err" data-err></div></div>
    <footer>${extraFooter}${cancel ? '<button type="button" class="btn" data-close>Annuler</button>' : ''}<button class="btn ${danger ? 'danger' : 'pri'}">${submit}</button></footer></form>`;
  document.body.appendChild(bg);
  const form = $('form', bg);
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape' && bg === $$('.modal-bg').pop()) close(); };
  document.addEventListener('keydown', onKey);
  $$('[data-close]', bg).forEach(b => b.onclick = close);
  bg.addEventListener('mousedown', e => { if (e.target === bg) close(); });
  let busy = false;
  form.onsubmit = async e => {
    e.preventDefault();
    if (busy) return;
    busy = true;
    const btn = $('footer .btn:last-child', bg); btn.disabled = true;
    try {
      const res = await onSubmit(form);
      if (res === KEEP_OPEN) return;
      if (typeof res === 'string') { $('[data-err]', bg).textContent = res; return; }
      close();
    } finally { busy = false; btn.disabled = false; }
  };
  onMount?.(form);
  setTimeout(() => { if (!form.contains(document.activeElement)) $('input:not([type=hidden]):not([type=checkbox]),select', form)?.focus(); }, 30);
  return form;
}
const confirmModal = (title, text, action = 'Supprimer') => new Promise(res => {
  let ok = false;
  const f = modal({ title, body: `<p style="margin:0">${text}</p>`, submit: action, danger: true, onSubmit: () => { ok = true; } });
  new MutationObserver((_, obs) => { if (!document.body.contains(f)) { obs.disconnect(); res(ok); } }).observe(document.body, { childList: true });
});

// ================= Événements =================
function bindEvents() {
  $$('#nav button[data-page]').forEach(b => b.onclick = () => go(b.dataset.page));
  $('#themeToggle').onclick = () => { D.settings.theme = D.settings.theme === 'dark' ? 'light' : 'dark'; stampSettings(); persist(); render(); };
  $$('#setTheme button').forEach(b => b.onclick = () => { D.settings.theme = b.dataset.v; stampSettings(); persist(); render(); });

  // Journal
  $('#prevDay').onclick = () => { day = addDays(day, -1); render(); };
  $('#nextDay').onclick = () => { day = addDays(day, 1); render(); };
  $('#todayBtn').onclick = () => { day = todayStr(); render(); };
  $('#dayPick').onchange = e => { if (e.target.value) { day = e.target.value; render(); } };
  $('#copyDay').onclick = copyDayModal;
  $('#quickAdd').onclick = () => (page === 'dishes' ? dishModal() : foodModal());
  $('#qMeal').onclick = e => { const b = e.target.closest('button'); if (b) { selMeal = +b.dataset.v; renderQuick(); } };
  $('#qTabs').onclick = e => { const b = e.target.closest('button'); if (b) { qTab = b.dataset.v; $('#qSearch').value = ''; renderQuick(); } };
  $('#qSearch').oninput = renderQuick;
  $('#qSearch').onkeydown = e => {
    if (e.key === 'Enter') { e.preventDefault(); const t = $('#qList .tile'); if (t) { const [k, id] = t.dataset.add.split(':'); e.shiftKey ? qtyModal(k, k === 'food' ? food(id) : dish(id)) : quickAddDefault(k, id); $('#qSearch').value = ''; renderQuick(); } }
    if (e.key === 'Escape') { $('#qSearch').value = ''; renderQuick(); }
  };
  $('#qNewFood').onclick = () => foodModal(null, { name: $('#qSearch').value.trim() });
  $('#qQuick').onclick = () => quickEntryModal();

  // Aliments / plats
  $('#fSearch').oninput = renderFoods;
  $$('#fFilter button').forEach(b => b.onclick = () => { fFilter = b.dataset.v; renderFoods(); });
  $('#dSearch').oninput = renderDishes;

  // Statistiques
  $$('#statRange button').forEach(b => b.onclick = () => { statDays = +b.dataset.v; renderStats(); });
  $('#wForm').onsubmit = e => {
    e.preventDefault();
    const kg = num($('#wKg').value), date = $('#wDate').value || todayStr();
    if (!(kg > 20 && kg < 400)) { toast('Poids invalide'); return; }
    const same = D.weights.find(w => w.date === date);
    if (same) { same.kg = kg; stamp(same); } else D.weights.push(stamp({ id: uid(), date, kg }));
    $('#wKg').value = '';
    persist(); renderStats(); toast('Poids enregistré');
  };

  // Réglages
  $('#goalForm').oninput = goalHint;
  $('#goalForm').onsubmit = e => {
    e.preventDefault();
    const f = e.target, g = {};
    for (const k of ['kcal', 'prot', 'carb', 'fat', 'fiber', 'water']) {
      const v = f[k].value.trim() === '' ? 0 : num(f[k].value);
      if (!(v >= 0)) { $('#goalErr').textContent = 'Valeur invalide.'; return; }
      g[k] = v;
    }
    $('#goalErr').textContent = '';
    D.settings.goals = g; stampSettings(); persist(); toast('Objectifs enregistrés');
  };
  $('#mealForm').onsubmit = e => {
    e.preventDefault();
    const names = [0, 1, 2, 3, 4, 5].map(i => e.target['m' + i].value.trim());
    while (names.length && !names[names.length - 1]) names.pop();
    if (!names.some(Boolean)) { toast('Au moins un repas est nécessaire'); return; }
    D.settings.meals = names; stampSettings(); persist(); toast('Repas enregistrés');
  };
  $('#loadStarter').onclick = confirmStarter;
  $('#expJson').onclick = exportJson;
  $('#impJson').onclick = importJson;
  const UPD = {
    checking: () => 'Recherche en cours…',
    none: () => 'Application à jour',
    available: i => `Version ${i.version} disponible, téléchargement…`,
    downloading: i => `Téléchargement : ${i.percent} %`,
    downloaded: i => `Version ${i.version} téléchargée`,
    error: i => `Erreur : ${i.message}`
  };
  api.onUpdate(({ status, info }) => {
    $('#updDetail').textContent = (UPD[status] || (() => status))(info || {});
    $('#updInstallRow').hidden = status !== 'downloaded';
    if (status === 'downloaded') toast('Mise à jour prête à installer');
  });
  $('#updCheck').onclick = async () => {
    $('#updDetail').textContent = 'Recherche en cours…';
    const r = await api.checkUpdate();
    if (!r.configured) $('#updDetail').textContent = 'Mode développement : mises à jour inactives';
  };
  $('#updInstall').onclick = () => api.installUpdate();
  $('#syncNow').onclick = () => syncNow(false);

  document.addEventListener('change', e => {
    const s = e.target.closest('[data-sort-sel]');
    if (s) setSort(s.dataset.sortSel, s.value);
  });
  document.addEventListener('click', e => {
    const dir = e.target.closest('[data-sort-dir]'), col = e.target.closest('[data-sort-col]');
    if (dir) { sortState[dir.dataset.sortDir].dir *= -1; render(); }
    else if (col) setSort('foods', col.dataset.sortCol, true);
  });
  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-fsel],[data-fsel-all],[data-fsel-clear],[data-fsel-del],[data-water],[data-add],[data-addq],[data-entry],[data-del-entry],[data-meal-add],[data-meal-dish],[data-fav],[data-edit-food],[data-del-food],[data-edit-dish],[data-del-dish],[data-dup-dish],[data-del-weight],[data-welcome],[data-sync],[data-new-food-from-search]');
    if (!el) return;
    const d = el.dataset;
    if (d.fsel) { el.checked ? fSel.add(d.fsel) : fSel.delete(d.fsel); renderFoods(); }
    else if (d.fselAll !== undefined) { for (const id of fVisible) el.checked ? fSel.add(id) : fSel.delete(id); renderFoods(); }
    else if (d.fselClear !== undefined) { fSel.clear(); renderFoods(); }
    else if (d.fselDel !== undefined) deleteSelectedFoods();
    else if (d.water) addWater(day, +d.water);
    else if (d.addq) {
      e.stopPropagation();
      const [k, id] = d.addq.split(':');
      if (page !== 'journal') day = todayStr();
      qtyModal(k, k === 'food' ? food(id) : dish(id));
    }
    else if (d.add) {
      const [k, id] = d.add.split(':');
      quickAddDefault(k, id);
    }
    else if (d.delEntry) {
      e.stopPropagation();
      const item = D.entries.find(x => x.id === d.delEntry);
      removeItem('entry', d.delEntry); persist(); render();
      toast(`${item.name} retiré`, () => { restoreItem('entry', item); persist(); render(); });
    }
    else if (d.entry) editEntry(D.entries.find(x => x.id === d.entry));
    else if (d.mealAdd !== undefined) { selMeal = +d.mealAdd; renderQuick(); $('#qSearch').focus(); }
    else if (d.mealDish !== undefined) mealToDishModal(+d.mealDish);
    else if (d.fav) {
      e.stopPropagation();
      const [k, id] = d.fav.split(':');
      const item = k === 'food' ? food(id) : dish(id);
      item.fav = !item.fav; stamp(item); persist(); render();
    }
    else if (d.delFood) {
      e.stopPropagation();
      const f = food(d.delFood);
      const used = D.dishes.filter(x => x.items.some(it => it.food === f.id));
      if (used.length) { modal({ title: 'Suppression impossible', body: `<p style="margin:0">« ${esc(f.name)} » est utilisé dans ${used.length > 1 ? 'les plats' : 'le plat'} : ${used.map(x => '« ' + esc(x.name) + ' »').join(', ')}.</p><p class="mut" style="margin:0;font-size:13px">Le retirer de ces plats d'abord.</p>`, submit: 'OK', cancel: false, onSubmit: () => {} }); return; }
      if (!await confirmModal('Supprimer l\'aliment', `Suppression de « ${esc(f.name)} ». Les journées passées gardent leurs valeurs.`)) return;
      removeItem('food', f.id); persist(); render();
      toast('Aliment supprimé', () => { restoreItem('food', f); persist(); render(); });
    }
    else if (d.editFood) foodModal(food(d.editFood));
    else if (d.editDish) dishModal(dish(d.editDish));
    else if (d.dupDish) { const src = dish(d.dupDish); dishModal(null, { ...structuredClone(src), name: src.name + ' (copie)', fav: false }); }
    else if (d.delDish) {
      const x = dish(d.delDish);
      if (!await confirmModal('Supprimer le plat', `Suppression de « ${esc(x.name)} ». Les journées passées gardent leurs valeurs.`)) return;
      removeItem('dish', x.id); persist(); render();
      toast('Plat supprimé', () => { restoreItem('dish', x); persist(); render(); });
    }
    else if (d.delWeight) { removeItem('weight', d.delWeight); persist(); renderStats(); }
    else if (d.newFoodFromSearch !== undefined) { e.preventDefault(); foodModal(null, { name: $('#qSearch').value.trim() }); }
    else if (d.welcome) {
      if (d.welcome === 'starter') confirmStarter();
      else if (d.welcome === 'food') foodModal();
      else if (d.welcome === 'sync') go('settings');
      else { D.welcomeDone = true; persist(true); render(); }
    }
    else if (d.sync) {
      const a = d.sync;
      if (a === 'server') serverWizard();
      else if (a === 'signup' || a === 'signin') syncAuthModal(a);
      else if (a === 'recover') { $$('.modal-bg').forEach(x => x.remove()); syncRecoverModal(); }
      else if (a === 'wipe') {
        if (!await confirmModal('Effacer les données en ligne', 'Toutes les lignes envoyées au serveur seront supprimées définitivement.<br><br>Les données de ce PC sont conservées.', 'Effacer')) return;
        const res = await api.syncWipe();
        if (!res.ok) { toast('Échec : ' + res.error); return; }
        D.sync.lastPull = null;
        await persist(true);
        toast('Données en ligne effacées');
        renderSettings();
      }
      else if (a === 'out') {
        if (!await confirmModal('Se déconnecter', 'Les données restent sur ce PC. La synchronisation sera arrêtée.', 'Se déconnecter')) return;
        await api.syncSignOut();
        D.sync = null; clearInterval(syncState.timer);
        persist(true); renderSettings(); syncBadge();
      }
    }
  });

  document.addEventListener('keydown', e => {
    if ($('.modal-bg')) return;
    const k = e.key.toLowerCase();
    const typing = /^(input|textarea|select)$/i.test(document.activeElement?.tagName);
    if (e.ctrlKey && k === 'n') { e.preventDefault(); $('#quickAdd').hidden ? foodModal() : $('#quickAdd').click(); }
    if (e.ctrlKey && k === 'f') { e.preventDefault(); if (page !== 'journal') go('journal'); $('#qSearch').focus(); $('#qSearch').select(); }
    if (page === 'journal' && !typing && (k === 'arrowleft' || k === 'arrowright')) { day = addDays(day, k === 'arrowleft' ? -1 : 1); render(); }
  });
  // Changement de jour à minuit si l'application reste ouverte
  let lastToday = todayStr();
  setInterval(() => { const t = todayStr(); if (t !== lastToday) { if (day === lastToday) { day = t; if (page === 'journal' && !$('.modal-bg')) render(); } lastToday = t; } }, 60000);
}

// ================= Démarrage =================
function migrate(d) {
  const b = emptyData();
  const out = { ...b, ...d, settings: { ...b.settings, ...(d.settings || {}), goals: { ...b.settings.goals, ...(d.settings?.goals || {}) } } };
  for (const key of Object.values(SYNC_ARRAYS)) out[key] = Array.isArray(out[key]) ? out[key] : [];
  out.tomb = out.tomb || {}; out.dirty = out.dirty || {};
  return out;
}

(async function init() {
  paintIcons();
  const data = await api.load();
  if (data) D = migrate(data);
  else { D = emptyData(); D.settings.u = Date.now(); await persist(true); }
  selMeal = autoMeal();
  $('#app').hidden = false;
  bindEvents();
  go('journal');
  if (D.server?.url) await api.syncSetServer(D.server);
  if (D.server?.url && D.sync?.session && await api.syncRestore(D.sync)) { startSyncLoop(); syncNow(true); }
})();
