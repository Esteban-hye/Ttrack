'use strict';
// Cloud : synchronisation entre PC. Le chiffrement et le serveur sont gérés côté système (sync.js).
//
// Chaque aliment, plat, entrée du journal et objectif est une ligne « v2:<id> ».
// sync-etat.json garde, pour chaque ligne, l'empreinte de la dernière version synchronisée :
// une empreinte différente = modifiée ici, une ligne disparue = supprimée ici.
// En cas de modification des deux côtés entre deux synchros, la version de ce PC l'emporte.

const Cloud = (() => {
  const KINDS = { v2food: 'foods', v2dish: 'dishes', v2entry: 'entries', v2goal: 'goals' };
  const api = window.ttrack.cloud;
  let state = { lastPull: null, hashes: {}, images: [] };
  let status = { server: null, signedIn: false, email: null };
  let busy = false, again = false, timer = null, lastOk = null, lastErr = null;

  // Empreinte FNV-1a d'un texte
  const hash = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36) + s.length.toString(36); };
  const rid = x => 'v2:' + x.id;
  const ERRORS = {
    offline: 'Pas de connexion internet.', 'no-server': 'Serveur non configuré.', 'not-signed-in': 'Pas connecté.',
    'bad-key': 'Mot de passe incorrect.', 'no-vault': 'Aucun compte Ttrack sur ce serveur avec cet email : crée un compte.',
    'confirm-email': 'Confirme ton adresse email (lien reçu par mail), puis connecte-toi.',
    'account-exists': 'Ce compte existe déjà : utilise « Se connecter ».',
    'Invalid login credentials': 'Email ou mot de passe incorrect.'
  };
  const errText = e => ERRORS[e] || (/fetch|network/i.test(e) ? ERRORS.offline : e);

  // ---- Synchronisation ----
  async function run() {
    if (!status.signedIn) return;
    if (busy) { again = true; return; }
    // Pas pendant qu'une fiche est ouverte : elle travaille sur l'objet en cours de modification
    if (Foods.modal.isOpen || Dishes.modal.isOpen) { soon(); return; }
    busy = true; renderState();
    try {
      let changed = false, touched = false;
      // 1. Ce qui vient du serveur
      const pulled = await api.pull(state.lastPull);
      if (!pulled.ok) throw new Error(pulled.error);
      let maxU = 0;
      for (const r of pulled.data) {
        const coll = KINDS[r.kind];
        if (!coll) continue;
        maxU = Math.max(maxU, r.u);
        const list = DB[coll], id = r.id.slice(3), i = list.findIndex(x => x.id === id), local = list[i];
        const localDirty = local && state.hashes[r.id]?.h !== hash(JSON.stringify(local));
        if (local && localDirty) continue;
        // Supprimé ici depuis la dernière synchro, et pas modifié ailleurs : la suppression sera envoyée
        if (!local && !r.deleted && state.hashes[r.id]?.h === hash(JSON.stringify(r.data))) continue;
        if (r.deleted) {
          if (local) { list.splice(i, 1); changed = true; }
          delete state.hashes[r.id];
        } else {
          if (local && hash(JSON.stringify(local)) === hash(JSON.stringify(r.data))) { state.hashes[r.id] = { h: hash(JSON.stringify(local)), k: r.kind }; continue; }
          if (local) list[i] = r.data; else list.push(r.data);
          state.hashes[r.id] = { h: hash(JSON.stringify(r.data)), k: r.kind };
          changed = true;
        }
      }
      // 10 minutes de marge si les horloges des PC ne sont pas tout à fait à l'heure
      if (maxU) state.lastPull = new Date(maxU - 10 * 60e3).toISOString();

      // 2. Ce qui a changé ici
      const out = [], next = {}, seen = new Set();
      for (const [kind, coll] of Object.entries(KINDS)) {
        for (const x of DB[coll]) {
          const id = rid(x);
          seen.add(id);
          if (state.hashes[id]?.h === hash(JSON.stringify(x))) continue;
          x.u = Date.now(); touched = true;
          out.push({ id, kind, u: x.u, data: x });
          next[id] = { h: hash(JSON.stringify(x)), k: kind };
        }
      }
      const gone = Object.keys(state.hashes).filter(id => !seen.has(id));
      for (const id of gone) out.push({ id, kind: state.hashes[id].k, u: Date.now(), deleted: true });
      if (out.length) {
        const pushed = await api.push(out);
        if (!pushed.ok) throw new Error(pushed.error);
        Object.assign(state.hashes, next);
        for (const id of gone) delete state.hashes[id];
      }

      // 3. Photos : on récupère celles qui manquent ici, on envoie celles pas encore envoyées
      const used = [...new Set([...DB.foods, ...DB.dishes].map(x => x.image).filter(Boolean))];
      const missing = await window.ttrack.missingImages(used);
      if (missing.length) {
        const got = await api.pullImages(missing);
        if (!got.ok) throw new Error(got.error);
        if (got.data) changed = true;
      }
      const sent = new Set(state.images);
      const stillMissing = new Set(await window.ttrack.missingImages(used));
      const toSend = used.filter(n => !sent.has(n) && !stillMissing.has(n));
      if (toSend.length) {
        const r = await api.pushImages(toSend);
        if (!r.ok) throw new Error(r.error);
      }
      state.images = used.filter(n => sent.has(n) || toSend.includes(n));

      await api.saveState(state);
      if (changed || touched) await window.ttrack.save(DB);
      if (changed) App.render();
      lastOk = new Date(); lastErr = null;
    } catch (e) {
      lastErr = errText(String(e.message || e));
    } finally {
      busy = false; renderState();
      if (again) { again = false; soon(500); }
    }
  }
  // Une synchro peu après chaque modification
  function soon(ms = 4000) { clearTimeout(timer); if (status.signedIn) timer = setTimeout(run, ms); }

  // ---- Paramètres ----
  const el = s => $(s);
  function renderState() {
    const btn = el('#cloudBtn');
    btn.hidden = !status.server;
    btn.classList.toggle('ok', status.signedIn && !lastErr);
    btn.classList.toggle('err', status.signedIn && !!lastErr);
    const st = !status.server ? 'Serveur non configuré' : !status.signedIn ? 'Pas connecté' : busy ? 'Synchronisation…'
      : lastErr ? `Erreur : ${lastErr}` : lastOk ? `Synchronisé à ${lastOk.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'En attente';
    btn.title = 'Cloud : ' + st;
    el('#cloudState').textContent = st;
    el('#cloudServer').textContent = status.server ? status.server.url : 'Non configuré';
    el('#cloudAccount').textContent = status.signedIn ? status.email : status.server ? 'Non connecté' : 'Configure d\'abord le serveur';
    el('#cloudSignOut').hidden = !status.signedIn;
    el('#cloudLogin').hidden = !status.server || status.signedIn;
    el('#cloudNow').disabled = !status.signedIn || busy;
    el('#cloudWipeRow').hidden = !status.signedIn;
  }
  async function refresh() {
    status = await api.status();
    state = { lastPull: null, hashes: {}, images: [], ...(await api.state()) };
    renderState();
  }

  el('#cloudServerBtn').addEventListener('click', () => {
    const f = el('#cloudServerForm');
    f.hidden = !f.hidden;
    if (!f.hidden) { f.elements.url.value = status.server?.url || ''; f.elements.key.value = ''; f.querySelector('.err').textContent = ''; f.elements.url.focus(); }
  });
  el('#cloudServerCancel').addEventListener('click', () => { el('#cloudServerForm').hidden = true; });
  el('#cloudServerForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, err = f.querySelector('.err');
    const cfg = { url: f.elements.url.value.trim().replace(/\/+$/, ''), key: f.elements.key.value.trim() };
    err.textContent = 'Vérification…';
    const t = await api.testServer(cfg);
    const msg = !t.ok ? errText(t.error) : t.data.error && ({ url: 'Adresse invalide : elle ressemble à https://xxxx.supabase.co', key: 'Clé refusée par le serveur.', unreachable: 'Serveur injoignable.', tables: 'Les tables Ttrack n\'existent pas sur ce serveur.' }[t.data.error] || t.data.detail || t.data.error);
    if (msg) return err.textContent = msg;
    await api.setServer(cfg);
    f.hidden = true;
    await refresh();
  });
  async function login(kind) {
    const f = el('#cloudLogin'), err = f.querySelector('.err');
    const email = f.elements.email.value.trim(), pwd = f.elements.password.value;
    if (!email || !pwd) return err.textContent = 'Email et mot de passe obligatoires.';
    if (kind === 'signUp' && pwd.length < 8) return err.textContent = 'Mot de passe : 8 caractères minimum.';
    err.textContent = kind === 'signUp' ? 'Création du compte…' : 'Connexion…';
    const r = await api[kind](email, pwd);
    if (!r.ok) return err.textContent = errText(r.error);
    err.textContent = ''; f.reset();
    el('#cloudRecovery').hidden = !r.data.recoveryKey;
    el('#cloudRecovery').innerHTML = r.data.recoveryKey ? `<b>Clé de secours :</b> <code>${esc(r.data.recoveryKey)}</code><br><span class="small">Note-la et garde-la : elle permet de récupérer tes données si tu perds ton mot de passe. Elle ne sera plus affichée.</span>` : '';
    await refresh();
    run();
  }
  el('#cloudLogin').addEventListener('submit', e => { e.preventDefault(); login('signIn'); });
  el('#cloudSignUp').addEventListener('click', () => login('signUp'));
  el('#cloudSignOut').addEventListener('click', async () => { await api.signOut(); lastOk = lastErr = null; await refresh(); });
  el('#cloudNow').addEventListener('click', () => run());
  el('#cloudBtn').addEventListener('click', () => App.go('settings'));
  // Effacer le serveur : en deux clics, puis ce PC se déconnecte pour ne pas tout renvoyer
  el('#cloudWipe').addEventListener('click', async () => {
    const b = el('#cloudWipe');
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = 'Confirmer'; return; }
    b.classList.remove('armed'); b.textContent = 'Effacer';
    const r = await api.wipe();
    if (!r.ok) { lastErr = errText(r.error); renderState(); return; }
    await api.signOut(); lastOk = lastErr = null;
    await refresh();
  });

  async function start() {
    await refresh();
    if (status.signedIn) run();
    setInterval(() => { if (status.signedIn) run(); }, 2 * 60e3);
  }

  return { start, run, soon, get busy() { return busy; } };
})();
