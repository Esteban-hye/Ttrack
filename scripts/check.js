// Test au clic des bibliothèques d'aliments et de plats, dans un dossier de données temporaire, avec captures d'écran.
// Lancer : npm run check [-- dossier-des-captures]
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ttrack-check-'));
process.env.TTRACK_USERDATA = tmp;
process.env.TTRACK_HIDDEN = '1';
process.env.TTRACK_FAKE_CLOUD = '1';
const { app, clipboard, ClipboardItem } = require('electron');
require('../main.js');
const fake = require('./fake-cloud');

const out = path.resolve(process.argv.slice(2).find(a => !a.startsWith('-') && !a.endsWith('check.js')) || path.join(tmp, 'captures'));
fs.mkdirSync(out, { recursive: true });
const wait = ms => new Promise(r => setTimeout(r, ms));

// Petites aides disponibles dans chaque étape
const HELPERS = `
  const tick = (ms = 80) => new Promise(r => setTimeout(r, ms));
  const all = s => [...document.querySelectorAll(s)];
  const set = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const fill = (form, n, v) => set(document.querySelector(form + ' [name="' + n + '"]'), v);
  const tags = async (id, list) => { const i = document.querySelector('#' + id + ' input'); for (const t of list) { i.value = t; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); } };
  const submit = async form => { document.querySelector(form + ' button.pri').click(); await tick(); };
  const cards = grid => all(grid + ' .card .name').map(e => e.textContent);
  const err = form => document.querySelector(form + ' .err').textContent;
  const f = []; const check = (ok, msg) => { if (!ok) f.push(msg); };`;

const errors = [];
app.on('browser-window-created', (_e, w) => {
  w.setSize(1300, 860);
  w.webContents.on('console-message', e => { if (e.level === 'error') errors.push(e.message); });
  w.webContents.once('did-finish-load', async () => {
    const shot = async name => { await w.webContents.executeJavaScript('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))'); await wait(600); fs.writeFileSync(path.join(out, name + '.png'), (await w.webContents.capturePage()).toPNG()); };
    const step = async js => { const code = `(async () => { ${HELPERS} ${js}; return f; })()`; try { errors.push(...await w.webContents.executeJavaScript(code)); } catch (e) { fs.writeFileSync(path.join(out, 'etape-ratee.js'), code); throw e; } };
    try {
      await wait(500);
      await step(`
        check(!$('#page-hub').hidden && $('#tabs .on').textContent === 'Hub', 'le Hub doit être l\\'onglet de départ');
        // ---- Aliments ----
        $('#tabs [data-page="foods"]').click(); await tick();
        check($('#foodEmpty').textContent.includes('vide'), 'message bibliothèque vide absent');
        $('#add').click(); await tick();
        check(!$('#foodOverlay').hidden, 'la fiche aliment ne s\\'ouvre pas');
        fill('#foodForm', 'name', 'Skyr nature'); await tags('foodTags', ['Laitier', 'Protéiné']);
        fill('#foodForm', 'kcal', '57'); fill('#foodForm', 'prot', '10,3'); fill('#foodForm', 'carb', '3,6'); fill('#foodForm', 'sugar', '3,6'); fill('#foodForm', 'fat', '0,2');
        await submit('#foodForm');
        check($('#foodOverlay').hidden, 'la fiche reste ouverte après enregistrement');
        check($('#foodGrid .m.prot').textContent === 'P 10,3', 'protéines mal affichées');
        check(all('#foodGrid .tag').length === 2, 'tags absents de la carte');
        // erreurs de saisie
        $('#add').click(); await tick();
        fill('#foodForm', 'name', 'skyr NATURE'); fill('#foodForm', 'kcal', '1');
        await submit('#foodForm'); check(err('#foodForm').includes('existe déjà'), 'doublon non détecté');
        fill('#foodForm', 'name', 'Banane'); fill('#foodForm', 'ref', '0');
        await submit('#foodForm'); check(err('#foodForm').includes('référence'), 'référence 0 acceptée');
        fill('#foodForm', 'ref', '100'); fill('#foodForm', 'unit', 'x');
        await submit('#foodForm'); check(err('#foodForm').includes('pièce'), 'poids de pièce invalide accepté');
        fill('#foodForm', 'unit', '120'); fill('#foodForm', 'kcal', '89'); fill('#foodForm', 'carb', '22,8'); fill('#foodForm', 'sugar', '30');
        await submit('#foodForm'); check(err('#foodForm').includes('dépasser'), 'sucres > glucides acceptés');
        fill('#foodForm', 'sugar', '12,2'); fill('#foodForm', 'prot', '1,1'); fill('#foodForm', 'fat', '0,3'); fill('#foodForm', 'fiber', '2,6');
        await tags('foodTags', ['Fruit', 'laitier']);  // "laitier" doit reprendre l'orthographe "Laitier"
        await submit('#foodForm');
        check(cards('#foodGrid').join() === 'Banane,Skyr nature', 'tri ou ajout incorrect : ' + cards('#foodGrid'));
        const banane = $('#foodGrid .card').textContent.replace(/\\s+/g, ' ');
        check(banane.includes('par pièce (120 g)') && banane.includes('106,8 kcal la pièce') && banane.includes('P 1,3'), 'carte en pièces : ' + banane);
        // filtres
        check(all('#foodFilters .chip').map(c => c.textContent).join() === 'Fruit,Laitier,Protéiné', 'filtres : ' + all('#foodFilters .chip').map(c => c.textContent));
        $('#foodFilters [data-tag="Fruit"]').click(); await tick();
        check(cards('#foodGrid').join() === 'Banane', 'filtre Fruit : ' + cards('#foodGrid'));
        $('#foodFilters [data-tag="Laitier"]').click(); await tick();
        check(cards('#foodGrid').join() === 'Banane', 'filtre Fruit + Laitier : ' + cards('#foodGrid'));
        $('#foodFilters [data-tag="Fruit"]').click(); await tick();
        check(cards('#foodGrid').length === 2, 'filtre Laitier : 2 attendus');
        $('#foodFilters [data-clear]').click(); await tick();
      `);
      await shot('1-aliments');
      await step(`
        // ---- Plats ----
        $('#tabs [data-page="dishes"]').click(); await tick();
        check(!$('#page-dishes').hidden && $('#add').textContent.includes('plat'), 'onglet Plats non affiché');
        check($('#dishFilters').textContent.includes('Ajoute des tags'), 'les filtres des plats montrent les tags des aliments');
        $('#add').click(); await tick();
        await submit('#dishForm'); check(!$('#dishOverlay').hidden && !DB.dishes.length, 'plat sans nom accepté');
        fill('#dishForm', 'name', 'Bol skyr banane'); await tags('dishTags', ['Petit-déj']);
        await submit('#dishForm'); check(err('#dishForm').includes('ingrédient'), 'plat sans ingrédient accepté');
        const s = $('#ingSearch'); s.focus(); set(s, 'ban'); await tick();
        check(all('#ingList .pick-item').length === 1, 'recherche d\\'ingrédient : 1 attendu');
        s.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); await tick();
        check($('#ingRows .ing .seg .on')?.dataset.mode === 'piece', 'banane : devrait être en pièces');
        set($('#ingRows .ing-qty'), '2');
        check($('#ingRows .ing-calc').textContent.startsWith('240 g'), 'calcul 2 bananes : ' + $('#ingRows .ing-calc').textContent);
        s.focus(); set(s, 'skyr'); await tick();
        $('#ingList .pick-item').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); await tick();
        const qty = all('#ingRows .ing-qty')[1];
        check(qty.value === '100', 'skyr : 100 g par défaut attendu, reçu ' + qty.value);
        set(qty, '150'); await tick();
        const tot = all('#dishTotals tr').map(r => [...r.cells].map(c => c.textContent.trim()).join(' ').replace(/\\s+/g, ' '));
        check(tot.some(t => t.startsWith('Poids total 390 g')), 'poids total : ' + tot.join(' | '));
        check(tot.some(t => t.startsWith('Énergie 299,1 kcal')), 'énergie totale : ' + tot.join(' | '));
        check(tot.some(t => t.startsWith('Fibres 6,2 g*')), 'fibres partielles non signalées : ' + tot.join(' | '));
        // passage pièces → grammes : même poids exact
        all('#ingRows .ing')[0].querySelector('[data-mode="g"]').click(); await tick();
        check(all('#ingRows .ing-qty')[0].value === '240', 'pièces → g : ' + all('#ingRows .ing-qty')[0].value);
        all('#ingRows .ing')[0].querySelector('[data-mode="piece"]').click(); await tick();
        check(all('#ingRows .ing-qty')[0].value === '2', 'g → pièces : ' + all('#ingRows .ing-qty')[0].value);
        set(all('#ingRows .ing-qty')[1], 'abc');
        await submit('#dishForm'); check(err('#dishForm').includes('Quantité invalide'), 'quantité invalide acceptée');
        set(all('#ingRows .ing-qty')[1], '150');
      `);
      // Photo du plat par le presse-papiers (le texte copié par l'utilisateur est remis ensuite)
      const savedText = await clipboard.readText().catch(() => '');
      const png = fs.readFileSync(path.join(__dirname, '..', 'build', 'icon.png'));
      await clipboard.write([new ClipboardItem({ 'image/png': new Blob([png], { type: 'image/png' }) })]);
      await step(`$('#dishPhoto .paste').click(); await tick(400); check($('#dishPhoto img'), 'photo collée absente');`);
      if (savedText) await clipboard.writeText(savedText); else clipboard.clear();
      await shot('2-fiche-plat');
      await step(`
        await submit('#dishForm'); await tick(300);
        check($('#dishOverlay').hidden, 'fiche plat restée ouverte : ' + err('#dishForm'));
        const card = $('#dishGrid .card');
        check(card && card.textContent.includes('2 ingrédients') && card.textContent.includes('390 g') && card.textContent.includes('299,1'), 'carte plat : ' + card?.textContent.replace(/\\s+/g, ' '));
        check(card.querySelector('img')?.naturalWidth > 0, 'photo non affichée sur la carte du plat');
      `);
      await shot('3-plats');
      await step(`
        // ---- Hub ----
        $('#tabs [data-page="hub"]').click(); await tick();
        check(!$('#page-hub').hidden && $('#libActions').hidden, 'Hub non affiché');
        check($('#dayLabel').textContent.startsWith("Aujourd'hui"), 'jour par défaut : ' + $('#dayLabel').textContent);
        check($('#dayList').textContent.includes('Rien pour ce jour'), 'journée vide attendue');
        check($('#daySummary').textContent.includes('Objectif pas encore défini'), 'message objectif absent');
        const s = $('#addSearch'); set(s, 'bol'); await tick();
        check(all('#addList .add-item').length === 1, 'recherche Hub : 1 attendu');
        s.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); await tick();
        check(all('#dayList .entry').length === 1, 'plat non ajouté à la journée');
        check($('#daySummary .big').textContent === '299,1', 'total après plat : ' + $('#daySummary .big').textContent);
        $('#addKind [data-v="food"]').click(); set(s, 'skyr'); await tick();
        all('#addList .add-item')[0].click(); await tick();
        const q = all('#dayList .ing-qty')[1];
        check(q.value === '100', 'skyr : 100 g par défaut, reçu ' + q.value);
        set(q, '200'); await tick();
        check($('#daySummary .big').textContent === '413,1', 'total après skyr 200 g : ' + $('#daySummary .big').textContent);
        all('#dayList .entry')[0].querySelector('[data-mode="g"]').click(); await tick();
        check(all('#dayList .ing-qty')[0].value === '390', 'plat → g : ' + all('#dayList .ing-qty')[0].value);
        set(all('#dayList .ing-qty')[0], '130'); await tick();
        check($('#daySummary .big').textContent === '213,7', 'tiers de plat : ' + $('#daySummary .big').textContent);
        // ---- Objectifs (Paramètres) ----
        $('#settingsBtn').click(); await tick();
        check(!$('#page-settings').hidden && $('#settingsBtn').classList.contains('on') && $('#libActions').hidden, 'paramètres non affichés');
        const gf = n => document.querySelector('#goalForm [name="' + n + '"]');
        const saveGoal = async () => { $('#goalSave').click(); await tick(); };
        check(gf('from').value === today(), 'date par défaut de l\\'objectif');
        set(gf('kcal'), 'abc'); await saveGoal();
        check($('#goalErr').textContent.includes('invalide'), 'objectif invalide accepté');
        set(gf('kcal'), ''); await saveGoal();
        check($('#goalErr').textContent.includes('au moins'), 'objectif vide accepté');
        gf('from').value = addDays(today(), -10); set(gf('kcal'), '2000'); set(gf('prot'), '150'); await saveGoal();
        check(all('#goalList .goal-row').length === 1 && $('#goalList').textContent.includes('en cours'), 'premier objectif : ' + $('#goalList').textContent);
        gf('from').value = addDays(today(), -10); set(gf('kcal'), '1900'); set(gf('prot'), '150'); await saveGoal();
        check(all('#goalList .goal-row').length === 1 && DB.goals[0].kcal === 1900, 'même date : l\\'objectif doit être remplacé');
        gf('from').value = addDays(today(), -1); set(gf('kcal'), '2200'); await saveGoal();
        check(all('#goalList .goal-row').length === 2 && all('#goalList .goal-row')[0].textContent.includes('en cours'), 'deuxième objectif');
        $('#goalList .goal-row [data-edit]').click(); await tick();
        check(gf('kcal').value === '2200' && !$('#goalCancel').hidden, 'modifier : valeurs non chargées');
        set(gf('kcal'), '2100'); await saveGoal();
        check(DB.goals.length === 2 && goalFor(today()).kcal === 2100 && goalFor(today()).prot == null, 'modification de l\\'objectif');
        all('#goalList .goal-row')[1].querySelector('[data-edit]').click(); await tick();
        set(gf('kcal'), '2000'); await saveGoal();
        check(goalFor(addDays(today(), -5)).kcal === 2000, 'ancien objectif non modifié');
        $('#tabs [data-page="hub"]').click(); await tick();
        check($('#daySummary').textContent.includes('reste') && $('#daySummary .bar > div').style.width.startsWith('10.176'), 'barre objectif : ' + $('#daySummary .bar > div')?.style.width);
        $('#prevDay').click(); await tick();
        check($('#dayList').textContent.includes('Rien pour ce jour') && !$('#todayBtn').hidden, 'veille : vide attendu');
        $('#todayBtn').click(); await tick();
        check(all('#dayList .entry').length === 2, 'retour à aujourd\\'hui');
        // un jour passé pour les stats : une banane avant-hier
        DB.entries.push({ id: 'p1', date: addDays(today(), -2), kind: 'food', ref: DB.foods.find(x => x.name === 'Banane').id, qty: 1, mode: 'piece', name: 'Banane' });
      `);
      await shot('4-hub');
      await step(`
        // ---- Stats ----
        $('#tabs [data-page="stats"]').click(); await tick(300);
        const ch = () => Chart.getChart($('#chLine'));
        const real = () => ch().data.datasets.filter(d => !d.goal), goals = () => ch().data.datasets.filter(d => d.goal);
        check(ch().data.labels.length === 7 && real().length === 2, 'semaine : 7 jours et 2 courbes attendus');
        check(goals().length === 2 && JSON.stringify(goals()[0].data) === '[2000,2000,2000,2000,2000,2100,2100]', 'courbe objectif kcal : ' + JSON.stringify(goals()[0]?.data));
        check(JSON.stringify(goals()[1].data) === '[150,150,150,150,150,null,null]', 'courbe objectif protéines : ' + JSON.stringify(goals()[1]?.data));
        $('#series [data-goals]').click(); await tick();
        check(goals().length === 0, 'masquer les objectifs');
        $('#series [data-goals]').click(); await tick();
        const k = real()[0].data;
        check(k[6] === 213.7 && k[4] === 106.8 && k[5] === null && k[0] === null, 'courbe kcal : ' + JSON.stringify(k));
        $('#series [data-k="prot"]').click(); await tick();
        check(real().length === 1, 'masquer protéines');
        $('#series [data-k="kcal"]').click(); await tick();
        check(real().length === 1, 'la dernière courbe doit rester affichée');
        $('#series [data-k="fat"]').click(); await tick();
        check(real().map(d => d.label).join() === 'Énergie,Matières grasses', 'courbes : ' + real().map(d => d.label));
        $('#range [data-v="month"]').click(); await tick();
        check(ch().data.labels.length === 30, 'mois : 30 jours');
        $('#range [data-v="custom"]').click(); await tick();
        const from = $('#rangeFrom'); from.value = addDays(today(), -2); from.dispatchEvent(new Event('change')); await tick();
        check(ch().data.labels.length === 3, 'entre deux dates : 3 jours, reçu ' + ch().data.labels.length);
        check($('#dishTop').textContent.includes('Bol skyr banane') && $('#dishTop').textContent.includes('1×'), 'camembert plats : ' + $('#dishTop').textContent);
        const leg = all('#foodTop .leg').map(l => l.textContent.replace(/\s+/g, ' ').trim());
        check(leg.length === 2 && leg.every(l => l.includes('2×')), 'camembert aliments : ' + leg.join(' | '));
        $('#range [data-v="week"]').click(); await tick(300);
      `);
      await shot('5-stats');
      await step(`
        // ---- Pas du jour ----
        $('#tabs [data-page="hub"]').click(); await tick();
        const steps = v => { const i = $('#stepsInput'); i.value = v; i.dispatchEvent(new Event('change')); };
        steps('abc'); await tick();
        check($('#stepsErr').textContent.includes('invalide'), 'pas invalides acceptés');
        steps('8 500'); await tick();
        check(stepsFor(today()) === 8500 && $('#stepsErr').textContent === '', 'pas non enregistrés : ' + stepsFor(today()));
        $('#prevDay').click(); await tick();
        check($('#stepsInput').value === '', 'pas de la veille : vide attendu, reçu ' + $('#stepsInput').value);
        steps('12000'); await tick();
        $('#todayBtn').click(); await tick();
        check($('#stepsInput').value === '8500' && DB.steps.length === 2, 'pas : retour à aujourd\\'hui ' + $('#stepsInput').value);
        // ---- Taille ----
        $('#settingsBtn').click(); await tick();
        const height = v => { const i = $('#heightInput'); i.value = v; i.dispatchEvent(new Event('change')); };
        height('20'); await tick();
        check($('#heightErr').textContent.includes('invalide'), 'taille invalide acceptée');
        // ---- Mesures ----
        $('#tabs [data-page="stats"]').click(); await tick(200);
        check($('#bmiInfo').textContent.includes('taille'), 'IMC sans taille : ' + $('#bmiInfo').textContent);
        const mf = $('#measureForm'), add = async (d, w, g) => { mf.elements.date.value = d; mf.elements.weight.value = w; mf.elements.fat.value = g; mf.querySelector('.btn.pri').click(); await tick(150); };
        await add(today(), '5', '');
        check($('#measureErr').textContent.includes('Poids invalide'), 'poids invalide accepté');
        await add(today(), '', '');
        check($('#measureErr').textContent.includes('au moins'), 'mesure vide acceptée');
        await add(addDays(today(), -3), '80', '20');
        await add(today(), '78,5', '19,2');
        check(DB.measures.length === 2 && all('#measureList .measure').length === 2, 'mesures : 2 attendues');
        check($('#weightInfo').textContent === '78,5 kg · −1,5 kg sur la période', 'info poids : ' + $('#weightInfo').textContent);
        check($('#fatInfo').textContent === '19,2 % · −0,8 % sur la période', 'info masse grasse : ' + $('#fatInfo').textContent);
        await add(today(), '78,4', '');
        const t = DB.measures.find(m => m.date === today());
        check(DB.measures.length === 2 && t.weight === 78.4 && t.fat === null, 'même date : la mesure doit être remplacée');
        const wd = Chart.getChart($('#chWeight')).data.datasets[0].data;
        check(wd[3] === 80 && wd[6] === 78.4 && wd[0] === null, 'courbe poids : ' + JSON.stringify(wd));
        // IMC une fois la taille connue
        $('#settingsBtn').click(); await tick();
        height('180'); await tick();
        check(DB.profile[0].height === 180, 'taille non enregistrée');
        $('#tabs [data-page="stats"]').click(); await tick(200);
        check($('#bmiInfo').textContent === '24,2 · −0,5 sur la période', 'info IMC : ' + $('#bmiInfo').textContent);
        const sd = Chart.getChart($('#chSteps')).data.datasets[0].data;
        check(sd[6] === 8500 && sd[5] === 12000 && $('#stepsInfo').textContent.includes('2 jours saisis'), 'pas dans les stats : ' + JSON.stringify(sd) + ' ' + $('#stepsInfo').textContent);
        // suppression en deux clics
        const del = all('#measureList .measure [data-del]')[1]; del.click(); await tick();
        check(DB.measures.length === 2, 'mesure supprimée dès le premier clic');
        all('#measureList .measure [data-del]')[1].click(); await tick();
        check(DB.measures.length === 1 && DB.measures[0].date === today(), 'mesure non supprimée');
        $('main').scrollTop = 99999;
      `);
      await shot('8-corps');
      await step(`$('main').scrollTop = 0;`);
      await step(`$('#settingsBtn').click(); await tick();`);
      await shot('6-parametres');
      await step(`
        // modifier un aliment met à jour le plat
        $('#tabs [data-page="foods"]').click(); await tick();
        all('#foodGrid .card')[0].click(); await tick();
        fill('#foodForm', 'unit', '100'); await submit('#foodForm');
        $('#tabs [data-page="dishes"]').click(); await tick();
        check($('#dishGrid .card').textContent.includes('350 g'), 'plat non recalculé après modif de la banane');
        // supprimer un aliment utilisé : refusé
        $('#tabs [data-page="foods"]').click(); await tick();
        all('#foodGrid .card')[0].click(); await tick();
        $('#foodForm .del').click(); $('#foodForm .del').click(); await tick();
        check(err('#foodForm').includes('utilisé dans'), 'suppression d\\'un aliment utilisé non bloquée');
        $('#foodForm .cancel').click();
        // supprimer le plat (deux clics), puis l'aliment
        $('#tabs [data-page="dishes"]').click(); await tick();
        $('#dishGrid .card').click(); await tick();
        $('#dishForm .del').click(); await tick();
        check(all('#dishGrid .card').length === 1, 'plat supprimé dès le premier clic');
        $('#dishForm .del').click(); await tick();
        check(all('#dishGrid .card').length === 0, 'plat non supprimé');
        $('#tabs [data-page="foods"]').click(); await tick();
        all('#foodGrid .card')[0].click(); await tick();
        $('#foodForm .del').click(); $('#foodForm .del').click(); await tick();
        check(cards('#foodGrid').join() === 'Skyr nature', 'banane non supprimée');
        // le journal garde les valeurs du plat supprimé (recalculé avant avec la pièce de banane à 100 g)
        $('#tabs [data-page="hub"]').click(); await tick();
        check($('#dayList').textContent.includes('retiré de la bibliothèque') && $('#daySummary .big').textContent === '211,9', 'journal après suppression : ' + $('#daySummary .big').textContent);
      `);
      // ---- Séances ----
      await step(`
        $('#tabs [data-page="workout"]').click(); await tick();
        check(!$('#page-workout').hidden && $('#libActions').hidden, 'onglet Séances non affiché');
        check(all('#week .day-col').length === 7 && $('#tplList').textContent.includes('Aucune séance'), 'planning ou liste vide incorrects');
        check($('#loads').textContent.includes('Renseigne'), 'charges sans matériel : ' + $('#loads').textContent);
        // matériel : 2 barres de 2 kg, disques 0,5 / 1 / 2 kg par 4
        const chg = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
        chg($('#barKg'), 'abc'); await tick();
        check($('#equipErr').textContent.includes('barre invalide'), 'poids de barre invalide accepté');
        chg($('#barCount'), '2'); chg($('#barKg'), '2'); await tick();
        for (const [kg, n] of [['0,5', '4'], ['1', '4'], ['2', '4']]) {
          $('#addPlate').click(); await tick();
          const r = all('#plateRows .plate-row').pop();
          chg(r.querySelector('[data-f="kg"]'), kg); chg(r.querySelector('[data-f="count"]'), n); await tick();
        }
        check(DB.equipment[0].plates.length === 3 && $('#equipErr').textContent === '', 'disques non enregistrés : ' + JSON.stringify(DB.equipment));
        check(Workouts.loads(true).map(l => l.kg).join() === '2,3,4,5,6,7,8,9', 'charges par paire : ' + Workouts.loads(true).map(l => l.kg));
        check(Workouts.loads(false).at(-1).kg === 16 && $('#loads').textContent.includes("jusqu'à 16 kg"), 'charge max d\\'un haltère');
        check(Workouts.mountText(6) === 'barre + 2 kg de chaque côté' && Workouts.mountText(5) === 'barre + 1 + 0,5 kg de chaque côté', 'montage : ' + Workouts.mountText(5));
        check(all('#loadList option').length === 8, 'charges proposées dans les champs de poids');
        // séance favorite
        $('#newWorkout').click(); await tick();
        check(!$('#workoutOverlay').hidden && all('#exRows .exr:not(.head)').length === 1, 'fiche séance : 1 exercice vide attendu');
        const ex = (i, f, v) => set(all('#exRows .exr:not(.head)')[i].querySelector('[data-f="' + f + '"]'), v);
        fill('#workoutForm', 'name', 'Bras maison');
        ex(0, 'name', 'Curl biceps'); ex(0, 'weight', '6'); ex(0, 'reps', 'abc');
        await submit('#workoutForm'); check(err('#workoutForm').includes('répétitions invalides'), 'répétitions invalides acceptées');
        ex(0, 'reps', '8 - 12');
        $('#addExercise').click(); await tick();
        ex(1, 'name', 'Dips'); ex(1, 'reps', 'max'); ex(1, 'sets', '3'); ex(1, 'rest', '90');
        check($('#wkSummary').textContent.includes('6 séries'), 'résumé : ' + $('#wkSummary').textContent);
        await submit('#workoutForm');
        check($('#workoutOverlay').hidden && DB.workouts.length === 1 && DB.workouts[0].exercises[0].reps === '8-12' && DB.workouts[0].exercises[1].weight === null, 'séance non enregistrée : ' + err('#workoutForm'));
        check($('#tplList').textContent.includes('Bras maison') && $('#tplList').textContent.includes('2 exercices'), 'liste des séances : ' + $('#tplList').textContent);
        // glisser la favorite sur le 1er jour de la semaine
        const drag = async (from, to) => {
          const dt = new DataTransfer();
          from.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
          to.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
          to.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
          from.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt })); await tick();
        };
        await drag($('#tplList .tpl'), all('#week .day-col')[0]);
        check(DB.sessions.length === 1 && all('#week .day-col')[0].querySelectorAll('.sess').length === 1, 'glisser-déposer : séance non posée');
        check(!$('#sessionBox').hidden && all('#sessionBox .ex').length === 2 && all('#sessionBox .ex')[0].querySelectorAll('.set').length === 3, 'séance ouverte : 2 exercices, 3 séries attendus');
        check(all('#sessionBox .ex')[0].querySelector('[data-f="weight"]').value === '6', 'poids prévu non repris');
        check(all('#sessionBox .ex')[0].querySelector('.mount').textContent === 'barre + 2 kg de chaque côté', 'montage affiché dans la séance');
        // marquer faite sans rien noter : refusé
        $('#sessionBox [data-done]').click(); await tick();
        check($('#sessErr').textContent.includes('au moins une série') && !DB.sessions[0].done, 'séance vide marquée faite');
        const reps = all('#sessionBox .ex')[0].querySelectorAll('[data-f="reps"]');
        ['15', '15', '13'].forEach((v, i) => chg(reps[i], v)); await tick();
        chg(all('#sessionBox .ex')[0].querySelector('[data-f="reps"]'), 'x'); await tick();
        check(all('#sessionBox .ex')[0].querySelector('[data-f="reps"]').classList.contains('bad') && DB.sessions[0].exercises[0].log[0].reps === 15, 'répétition invalide acceptée');
        chg(all('#sessionBox .ex')[0].querySelector('[data-f="reps"]'), '15');
        all('#sessionBox .ex')[0].querySelector('[data-add-set]').click(); await tick();
        check(DB.sessions[0].exercises[0].log.length === 4, 'ajout d\\'une série');
        all('#sessionBox .ex')[0].querySelectorAll('[data-del-set]')[3].click(); await tick();
        check(DB.sessions[0].exercises[0].log.length === 3, 'retrait d\\'une série');
        $('#sessionBox [data-done]').click(); await tick();
        check(DB.sessions[0].done && all('#week .sess.done').length === 1, 'séance non marquée faite');
        check($('#history').textContent.includes('Curl biceps : 6 kg × 15 / 15 / 13'), 'carnet : ' + $('#history').textContent.replace(/\\s+/g, ' '));
        // la même séance deux jours plus tard : poids repris et « dernière fois »
        await drag($('#tplList .tpl'), all('#week .day-col')[2]);
        check(DB.sessions.length === 2 && $('#sessionBox .last')?.textContent.includes('6 kg × 15 / 15 / 13'), 'dernière fois absente : ' + $('#sessionBox').textContent.replace(/\\s+/g, ' ').slice(0, 300));
      `);
      await shot('9-seances');
      await step(`
        const drag = async (from, to) => {
          const dt = new DataTransfer();
          from.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
          to.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
          to.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
          from.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt })); await tick();
        };
        // déplacer la 2e séance d'un jour
        const second = DB.sessions.find(s => !s.done);
        await drag($('#week .sess:not(.done)'), all('#week .day-col')[3]);
        check(second.date === all('#week .day-col')[3].dataset.date, 'déplacement d\\'une séance');
        // modifier la favorite ne change pas le carnet
        $('#tplList .tpl').click(); await tick();
        fill('#workoutForm', 'name', 'Bras'); await submit('#workoutForm');
        check(DB.sessions.every(s => s.name === 'Bras maison') && $('#tplList').textContent.includes('Bras'), 'renommer la favorite a changé le carnet');
        // retirer la séance prévue (deux clics)
        $('#week .sess:not(.done)').click(); await tick();
        $('#sessionBox [data-remove]').click(); await tick();
        check(DB.sessions.length === 2, 'séance retirée dès le premier clic');
        $('#sessionBox [data-remove]').click(); await tick();
        check(DB.sessions.length === 1 && $('#sessionBox').hidden, 'séance non retirée');
        // semaine suivante puis retour
        $('#nextWeek').click(); await tick();
        check(!$('#thisWeek').hidden && !all('#week .sess').length, 'semaine suivante');
        $('#thisWeek').click(); await tick();
        check(all('#week .sess').length === 1, 'retour à cette semaine');
      `);
      // ---- Cloud (faux serveur en mémoire) ----
      const IDLE = `const idle = async () => { await tick(60); while (Cloud.busy) await tick(60); };`;
      await step(`${IDLE}
        $('#settingsBtn').click(); await tick();
        check($('#cloudServer').textContent === 'Non configuré' && $('#cloudLogin').hidden && $('#cloudBtn').hidden, 'cloud : état initial');
        $('#cloudServerBtn').click(); await tick();
        const sf = $('#cloudServerForm'); sf.elements.url.value = 'pas une adresse'; sf.elements.key.value = 'cle';
        sf.querySelector('.btn.pri').click(); await tick(150);
        check(sf.querySelector('.err').textContent.includes('Adresse invalide'), 'cloud : adresse invalide acceptée');
        sf.elements.url.value = 'https://test.supabase.co'; sf.querySelector('.btn.pri').click(); await tick(200);
        check(sf.hidden && $('#cloudServer').textContent === 'https://test.supabase.co' && !$('#cloudLogin').hidden, 'cloud : serveur non enregistré');
        const lf = $('#cloudLogin'); lf.elements.email.value = 'test@ttrack.fr'; lf.elements.password.value = 'mauvais';
        lf.querySelector('.btn.pri').click(); await tick(150);
        check(lf.querySelector('.err').textContent === 'Email ou mot de passe incorrect.', 'cloud : mauvais mot de passe : ' + lf.querySelector('.err').textContent);
        lf.elements.email.value = 'test@ttrack.fr'; lf.elements.password.value = 'bon-mot-de-passe';
        lf.querySelector('.btn.pri').click(); await tick(200); await idle();
        check($('#cloudAccount').textContent === 'test@ttrack.fr' && $('#cloudLogin').hidden && !$('#cloudSignOut').hidden, 'cloud : connexion');
        check($('#cloudState').textContent.startsWith('Synchronisé'), 'cloud : état ' + $('#cloudState').textContent);
        check($('#cloudBtn').classList.contains('ok') && !$('#cloudBtn').hidden, 'cloud : icône');
      `);
      await shot('7-cloud');
      const rec = id => fake.store.records.get('v2:' + id);
      const skyrId = await w.webContents.executeJavaScript(`DB.foods.find(f => f.name === 'Skyr nature').id`);
      const counts = k => [...fake.store.records.values()].filter(r => r.kind === k && !r.deleted).length;
      if (rec(skyrId)?.data?.name !== 'Skyr nature' || counts('v2entry') !== 3 || counts('v2goal') !== 2 || counts('v2measure') !== 1 || counts('v2steps') !== 2 || counts('v2profile') !== 1 || counts('v2workout') !== 1 || counts('v2session') !== 1 || counts('v2equip') !== 1) errors.push(`cloud : envoi initial incorrect (${counts('v2food')} aliments, ${counts('v2entry')} entrées, ${counts('v2goal')} objectifs)`);
      const pushesBefore = fake.store.pushes;
      // « L'autre PC » ajoute une pomme et supprime l'objectif le plus ancien
      const oldGoal = await w.webContents.executeJavaScript(`[...DB.goals].sort((a, b) => a.from.localeCompare(b.from))[0].id`);
      const later = Date.now() + 1000;
      fake.store.records.set('v2:pomme-1', { id: 'v2:pomme-1', kind: 'v2food', u: later, deleted: false, data: { id: 'pomme-1', name: 'Pomme', tags: ['Fruit'], ref: 100, unit: 150, kcal: 52, fat: 0.2, sat: null, carb: 14, sugar: 10, fiber: 2.4, prot: 0.3, salt: null, image: '', u: later } });
      fake.store.records.set('v2:' + oldGoal, { id: 'v2:' + oldGoal, kind: 'v2goal', u: later, deleted: true, data: null });
      await step(`${IDLE}
        await Cloud.run(); await idle();
        check(DB.foods.some(f => f.name === 'Pomme') && DB.goals.length === 1, 'cloud : réception de l\\'autre PC (' + DB.foods.map(f => f.name) + ', ' + DB.goals.length + ' objectifs)');
        $('#tabs [data-page="foods"]').click(); await tick();
        check(cards('#foodGrid').join() === 'Pomme,Skyr nature', 'cloud : la pomme n\\'apparaît pas : ' + cards('#foodGrid'));
      `);
      if (fake.store.pushes !== pushesBefore) errors.push('cloud : des données reçues ont été renvoyées inutilement');
      // Modifications ici : kcal du skyr, suppression de la pomme, photo du skyr
      const savedText2 = await clipboard.readText().catch(() => '');
      await clipboard.write([new ClipboardItem({ 'image/png': new Blob([fs.readFileSync(path.join(__dirname, '..', 'build', 'icon.png'))], { type: 'image/png' }) })]);
      await step(`${IDLE}
        all('#foodGrid .card')[1].click(); await tick();
        fill('#foodForm', 'kcal', '58'); $('#foodPhoto .paste').click(); await tick(400);
        await submit('#foodForm');
        all('#foodGrid .card')[0].click(); await tick();
        $('#foodForm .del').click(); $('#foodForm .del').click(); await tick();
        await Cloud.run(); await idle();
      `);
      if (savedText2) await clipboard.writeText(savedText2); else clipboard.clear();
      const img = await w.webContents.executeJavaScript(`DB.foods.find(f => f.name === 'Skyr nature').image`);
      if (rec(skyrId)?.data?.kcal !== 58) errors.push('cloud : modification non envoyée');
      if (!rec('pomme-1')?.deleted) errors.push('cloud : suppression non envoyée');
      if (!img || !fake.store.images.has(img)) errors.push('cloud : photo non envoyée');
      // Photo absente de ce PC (comme sur un autre PC) : elle est récupérée
      fs.rmSync(path.join(tmp, 'images', img), { force: true });
      await step(`${IDLE} await Cloud.run(); await idle();`);
      if (!fs.existsSync(path.join(tmp, 'images', img))) errors.push('cloud : photo non récupérée');
      await step(`${IDLE}
        $('#settingsBtn').click(); await tick();
        $('#cloudSignOut').click(); await tick(150);
        check(!$('#cloudLogin').hidden && $('#cloudAccount').textContent === 'Non connecté', 'cloud : déconnexion');
      `);
      if (fs.existsSync(path.join(tmp, 'sync.bin'))) errors.push('cloud : connexion encore enregistrée après déconnexion');

      await wait(300);
      const saved = JSON.parse(fs.readFileSync(path.join(tmp, 'aliments.json'), 'utf8'));
      const skyr = saved.foods[0];
      if (saved.foods.length !== 1 || saved.dishes.length !== 0 || saved.entries.length !== 3 || !saved.entries.find(e => e.kind === 'dish').snap || skyr.prot !== 10.3 || skyr.fiber !== null || skyr.unit !== null || skyr.tags.join() !== 'Laitier,Protéiné') {
        errors.push('fichier enregistré incorrect : ' + JSON.stringify(saved));
      }
    } catch (e) { errors.push(String(e?.stack || e)); }
    console.log(errors.length ? 'ÉCHECS :\n- ' + errors.join('\n- ') : 'Tout est bon.');
    console.log('Captures : ' + out);
    app.exit(errors.length ? 1 : 0);
  });
});
