// Captures d'écran de contrôle avec des données de démonstration, dans un dossier de données temporaire.
// Lancer : npm run shot [-- dossier]   (les images vont dans shots/ par défaut)
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ttrack-shot-'));
process.env.TTRACK_USERDATA = tmp;
process.env.TTRACK_HIDDEN = '1';
const { app } = require('electron');
require('../main.js');

const out = path.resolve(process.argv.find((a, i) => i > 1 && !a.startsWith('-') && !a.endsWith('shot.js')) || path.join(__dirname, '..', 'shots'));
fs.mkdirSync(out, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));

const DEMO = `(() => {
  loadStarter();
  const f = id => food('std-' + id);
  D.dishes.push(stamp({ id: 'd1', name: 'Porridge banane', items: [{ food: 'std-avoine', qty: 60 }, { food: 'std-lait', qty: 250 }, { food: 'std-banane', qty: 120 }, { food: 'std-cacahuete', qty: 15 }], portions: 1, cooked: 0, notes: '', fav: true }));
  D.dishes.push(stamp({ id: 'd2', name: 'Poulet riz brocoli', items: [{ food: 'std-poulet', qty: 450 }, { food: 'std-riz', qty: 540 }, { food: 'std-brocoli', qty: 450 }, { food: 'std-huileolive', qty: 20 }], portions: 3, cooked: 0, notes: '', fav: true }));
  f('skyr').fav = true; f('whey').fav = true;
  for (let i = 13; i >= 0; i--) {
    const d = addDays(todayStr(), -i);
    newEntry('dish', dish('d1'), 1, 'portion', 0, d);
    newEntry('dish', dish('d2'), i % 3 ? 1 : 1.5, 'portion', 1, d);
    if (i) newEntry('food', f('pates'), 250 + (i % 4) * 40, 'g', 2, d);
    if (i) newEntry('food', f('steak5'), 125, 'g', 2, d);
    newEntry('food', f('skyr'), 150, 'g', 3, d);
    if (i % 2) newEntry('food', f('amandes'), 30, 'g', 3, d);
    if (i % 3 === 0) D.weights.push(stamp({ id: 'w' + i, date: d, kg: 78.4 - (13 - i) * 0.12 }));
  }
  persist(); render();
})()`;

const errors = [];
app.on('browser-window-created', (_e, w) => {
  w.webContents.on('console-message', (e, level, message) => {
    const lvl = e?.level ?? level, msg = e?.message ?? message;
    if (lvl === 'error' || lvl === 3) errors.push(msg);
  });
  w.webContents.once('did-finish-load', async () => {
    const run = js => w.webContents.executeJavaScript(js);
    const shot = async name => { await wait(700); fs.writeFileSync(path.join(out, name + '.png'), (await w.webContents.capturePage()).toPNG()); };
    try {
      await wait(600);
      await shot('0-accueil');
      await run(DEMO);
      // Parcours au clic : chaque vérification ratée est notée comme erreur
      const fails = await run(`(async () => {
        const f = [], check = (ok, msg) => { if (!ok) f.push(msg); }, tick = () => new Promise(r => setTimeout(r, 50));
        go('journal'); day = addDays(todayStr(), 1); render();
        check(dayEntries(day).length === 0, 'demain devrait être vide');
        selMeal = 0; renderQuick();
        document.querySelector('#qTabs [data-v="foods"]').click();
        document.querySelector('#qList .tile').click(); await tick();
        check(dayEntries(day).length === 1, 'clic sur une tuile : 1 entrée attendue');
        const q = document.querySelector('#qSearch'); q.value = 'skyr'; q.dispatchEvent(new Event('input'));
        q.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); await tick();
        const sk = dayEntries(day).find(e => e.name === 'Skyr nature');
        check(sk && sk.qty === 150 && Math.round(sk.n.kcal) === 95, 'recherche + Entrée : skyr 150 g / 95 kcal');
        document.querySelector('[data-del-entry="' + sk.id + '"]').click(); await tick();
        check(!dayEntries(day).some(e => e.id === sk.id), 'suppression');
        document.querySelector('.toast button').click(); await tick();
        check(dayEntries(day).some(e => e.id === sk.id) && !D.tomb[sk.id], 'annulation de la suppression');
        document.querySelector('[data-entry="' + sk.id + '"]').click(); await tick();
        const fm = document.querySelector('.modal-bg form'); fm.qty.value = '300'; fm.requestSubmit(); await tick();
        check(Math.round(sk.n.kcal) === 189 && sk.qty === 300, 'modification de quantité : 189 kcal attendus, obtenu ' + sk.n.kcal);
        qtyModal('dish', dish('d2')); await tick();
        const dm = document.querySelector('.modal-bg form');
        dm.querySelector('[data-unit-seg] [data-v="g"]').click(); await tick();
        check(dm.qty.value === '487', 'conversion 1 portion -> grammes : 487 attendu, obtenu ' + dm.qty.value);
        dm.requestSubmit(); await tick();
        const gE = dayEntries(day).find(e => e.kind === 'dish' && e.unit === 'g');
        check(gE && Math.abs(gE.n.kcal - 593) < 3, 'plat au gramme ~593 kcal, obtenu ' + gE?.n.kcal);
        const before = dayEntries(day).length;
        day = addDays(day, 1); render(); copyDayModal(); await tick();
        const cm = document.querySelector('.modal-bg form'); cm.src.value = addDays(day, -1); cm.requestSubmit(); await tick();
        check(dayEntries(day).length === before, 'recopie d\\'un jour');
        check(Object.keys(D.dirty).length > 0, 'modifications marquées pour la synchro');
        const saved = await window.ttrack.load();
        check(saved.entries.length === D.entries.length && saved.foods.length === D.foods.length, 'sauvegarde sur disque');
        day = todayStr(); render();
        return f;
      })()`);
      errors.push(...fails);
      for (const p of ['journal', 'foods', 'dishes', 'stats', 'settings']) { await run(`go('${p}')`); await shot('1-' + p); }
      await run(`go('journal'); qtyModal('dish', dish('d2'))`); await shot('2-quantite');
      await run(`document.querySelector('.modal-bg').remove(); dishModal(dish('d1'))`); await shot('2-plat');
      await run(`document.querySelector('.modal-bg').remove(); foodModal(food('std-skyr'))`); await shot('2-aliment');
      await run(`document.querySelector('.modal-bg').remove(); D.settings.theme = 'light'; go('journal')`); await shot('3-journal-clair');
      await run(`go('stats')`); await shot('3-stats-clair');
    } catch (e) { errors.push(String(e)); }
    fs.writeFileSync(path.join(out, 'errors.txt'), errors.join('\n') || 'aucune erreur');
    console.log('Captures dans', out, errors.length ? '\nERREURS :\n' + errors.join('\n') : '\naucune erreur');
    app.quit();
  });
});
app.on('quit', () => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} });
