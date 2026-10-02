// Faux serveur en mémoire, avec la même interface que sync.js. Utilisé par npm run check (TTRACK_FAKE_CLOUD=1).
// store permet au test de jouer « l'autre PC » : lire ce qui a été envoyé, ajouter des lignes.
const fs = require('fs');
const path = require('path');

const store = { records: new Map(), images: new Map(), pushes: 0 };
const KINDS = ['v2food', 'v2dish', 'v2entry', 'v2goal'];
let server = null, user = null, onSession = () => {};
const copy = x => JSON.parse(JSON.stringify(x));
const need = () => { if (!user) throw new Error('not-signed-in'); };

module.exports = {
  store,
  setServer: cfg => { server = cfg?.url ? cfg : null; user = null; },
  setOnSession: fn => { onSession = fn; },
  restore: saved => { user = saved?.email ? { email: saved.email } : null; return !!user; },
  signOut: () => { user = null; },
  status: () => ({ signedIn: !!user, email: user?.email || null }),
  secret: () => user ? { email: user.email, mk: 'faux', session: {} } : null,
  testServer: async cfg => /^https:\/\/[^\s/]+\.supabase\.co$/.test(cfg?.url || '') ? { ok: true } : { error: 'url' },
  signUp: async email => { if (!server) throw new Error('no-server'); user = { email }; onSession(); return { email, recoveryKey: 'ABCD-EFGH-JKLM-NPQR-STUV-WXYZ' }; },
  signIn: async (email, pwd) => { if (pwd !== 'bon-mot-de-passe') throw new Error('Invalid login credentials'); user = { email }; onSession(); return { email }; },
  async pull(since) {
    need();
    const t = since ? Date.parse(since) : 0;
    return [...store.records.values()].filter(r => KINDS.includes(r.kind) && r.u > t).map(copy);
  },
  async push(records) {
    need();
    for (const r of records) store.records.set(r.id, copy({ ...r, data: r.deleted ? null : r.data }));
    store.pushes++;
    return records.length;
  },
  async pushImages(names, dir) {
    need();
    for (const n of names) if (fs.existsSync(path.join(dir, n))) store.images.set(n, fs.readFileSync(path.join(dir, n)));
    return names.length;
  },
  async pullImages(names, dir) {
    need();
    fs.mkdirSync(dir, { recursive: true });
    for (const n of names) if (store.images.has(n)) fs.writeFileSync(path.join(dir, n), store.images.get(n));
    return names.length;
  },
  async wipe() { need(); store.records.clear(); store.images.clear(); }
};
