// Synchronisation entre plusieurs PC via Supabase.
// Les données sont chiffrées sur le poste avant l'envoi : le serveur ne stocke que du texte illisible.
// Tables propres à Ttrack (ttrack_meta, ttrack_records) : le même projet Supabase peut servir à Tmoney.
const crypto = require('crypto');

let CFG = { url: '', key: '' };
const setServer = cfg => {
  CFG = { url: String(cfg?.url || '').trim().replace(/\/+$/, ''), key: String(cfg?.key || '').trim() };
  session = null; MK = null;
  return CFG;
};

let session = null; // { access_token, refresh_token, expires_at, user_id, email }
let MK = null;      // clé maîtresse (Buffer 32 octets), jamais transmise au serveur

const b64 = b => Buffer.from(b).toString('base64');
const ub64 = s => Buffer.from(s, 'base64');
const derive = (password, salt) => crypto.pbkdf2Sync(String(password), salt, 300000, 32, 'sha256');

function seal(key, buf) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  return b64(Buffer.concat([iv, c.update(buf), c.final(), c.getAuthTag()]));
}
function open(key, str) {
  const raw = ub64(str);
  const d = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(raw.length - 16));
  return Buffer.concat([d.update(raw.subarray(12, raw.length - 16)), d.final()]);
}
// Clé de secours : 24 caractères lisibles, groupés par 4
function makeRecoveryKey() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const chars = [...crypto.randomBytes(24)].map(b => abc[b % abc.length]);
  return chars.join('').match(/.{4}/g).join('-');
}
const recoveryKeyToKey = (rk, salt) => derive(rk.replace(/-/g, '').toUpperCase(), salt);

async function api(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
  if (!CFG.url || !CFG.key) throw new Error('no-server');
  const h = { apikey: CFG.key, 'Content-Type': 'application/json', ...headers };
  if (auth && session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
  let res;
  try {
    res = await fetch(CFG.url + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new Error('offline');
  }
  const txt = await res.text();
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
  if (!res.ok) {
    const err = new Error(data?.msg || data?.error_description || data?.message || data?.hint || `HTTP ${res.status}`);
    err.status = res.status;
    err.code = data?.error_code || data?.code;
    throw err;
  }
  return data;
}

function setSession(t) {
  session = {
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: Date.now() + (t.expires_in || 3600) * 1000,
    user_id: t.user?.id || session?.user_id,
    email: t.user?.email || session?.email
  };
}
async function ensure() {
  if (!session) throw new Error('not-signed-in');
  if (Date.now() > session.expires_at - 60000) {
    const t = await api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', auth: false, body: { refresh_token: session.refresh_token } });
    setSession(t);
  }
}

const meta = () => api(`/rest/v1/ttrack_meta?user_id=eq.${session.user_id}&select=*`).then(r => r?.[0] || null);
const passwordLogin = async (email, password) => setSession(await api('/auth/v1/token?grant_type=password', { method: 'POST', auth: false, body: { email, password } }));

// ---- Compte ----
// Un compte Supabase existant (celui de Tmoney par exemple) peut être réutilisé : on lui ajoute simplement une clé Ttrack.
async function signUp(email, password) {
  try {
    const t = await api('/auth/v1/signup', { method: 'POST', auth: false, body: { email, password } });
    if (!t.access_token) throw new Error('confirm-email');
    setSession(t);
  } catch (e) {
    if (!/already registered|user_already_exists/i.test(e.message + ' ' + (e.code || ''))) throw e;
    await passwordLogin(email, password);
    if (await meta()) throw new Error('account-exists');
  }
  const salt = crypto.randomBytes(16);
  MK = crypto.randomBytes(32);
  const recoveryKey = makeRecoveryKey();
  await api('/rest/v1/ttrack_meta', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
    body: {
      user_id: session.user_id,
      salt: b64(salt),
      wrapped_key: seal(derive(password, salt), MK),
      recovery_wrapped: seal(recoveryKeyToKey(recoveryKey, salt), MK)
    }
  });
  return { email: session.email, recoveryKey, mk: b64(MK), session };
}

async function signIn(email, password) {
  await passwordLogin(email, password);
  const m = await meta();
  if (!m) throw new Error('no-vault');
  try { MK = open(derive(password, ub64(m.salt)), m.wrapped_key); } catch { throw new Error('bad-key'); }
  return { email: session.email, mk: b64(MK), session };
}

// Mot de passe oublié : la clé de secours redonne la clé maîtresse, puis on redéfinit le mot de passe
async function recover(email, password, recoveryKey, newPassword) {
  await passwordLogin(email, password);
  const m = await meta();
  if (!m) throw new Error('no-vault');
  const salt = ub64(m.salt);
  try { MK = open(recoveryKeyToKey(recoveryKey, salt), m.recovery_wrapped); } catch { throw new Error('bad-recovery'); }
  if (newPassword) {
    await api('/auth/v1/user', { method: 'PUT', body: { password: newPassword } });
    await api(`/rest/v1/ttrack_meta?user_id=eq.${session.user_id}`, { method: 'PATCH', body: { wrapped_key: seal(derive(newPassword, salt), MK) } });
  }
  return { email: session.email, mk: b64(MK), session };
}

function restore(saved) {
  if (!saved?.session || !saved?.mk) return false;
  session = saved.session;
  MK = ub64(saved.mk);
  return true;
}
function signOut() { session = null; MK = null; }
// La session est rafraîchie en cours de route : l'interface la récupère pour la conserver
const status = () => ({ signedIn: !!(session && MK), email: session?.email || null, session });

// ---- Données ----
async function pull(since) {
  await ensure();
  const filter = since ? `&updated_at=gt.${encodeURIComponent(since)}` : '';
  const rows = await api(`/rest/v1/ttrack_records?user_id=eq.${session.user_id}&select=id,kind,updated_at,deleted,payload${filter}&limit=100000`);
  return (rows || []).map(r => {
    let data = null;
    if (!r.deleted && r.payload) {
      try { data = JSON.parse(open(MK, r.payload).toString('utf8')); } catch { return null; }
    }
    return { id: r.id, kind: r.kind, u: new Date(r.updated_at).getTime(), deleted: r.deleted, data };
  }).filter(Boolean);
}

async function push(records) {
  await ensure();
  if (!records.length) return 0;
  const rows = records.map(r => ({
    user_id: session.user_id,
    id: r.id,
    kind: r.kind,
    updated_at: new Date(r.u || Date.now()).toISOString(),
    deleted: !!r.deleted,
    payload: r.deleted ? null : seal(MK, Buffer.from(JSON.stringify(r.data), 'utf8'))
  }));
  for (let i = 0; i < rows.length; i += 300) {
    await api('/rest/v1/ttrack_records', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: rows.slice(i, i + 300)
    });
  }
  return rows.length;
}

// Vérifie l'adresse, la clé et la présence des tables, avec un message clair pour chaque cas
async function testServer(cfg) {
  const url = String(cfg?.url || '').trim().replace(/\/+$/, ''), key = String(cfg?.key || '').trim();
  if (!/^https:\/\/[^\s/]+\.supabase\.co$/.test(url)) return { error: 'url' };
  if (!key) return { error: 'key' };
  for (const table of ['ttrack_records', 'ttrack_meta']) {
    let res;
    try { res = await fetch(`${url}/rest/v1/${table}?limit=1`, { headers: { apikey: key } }); } catch { return { error: 'unreachable' }; }
    if (res.status === 401 || res.status === 403) {
      if (/api key/i.test(await res.text())) return { error: 'key' };
    } else if (res.status === 404) {
      return { error: 'tables' };
    } else if (!res.ok) {
      const t = await res.text();
      if (/does not exist|PGRST205|schema cache/i.test(t)) return { error: 'tables' };
      return { error: 'other', detail: t.slice(0, 200) };
    }
  }
  return { ok: true };
}

async function wipe() {
  await ensure();
  await api(`/rest/v1/ttrack_records?user_id=eq.${session.user_id}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
}

module.exports = { signUp, signIn, recover, restore, signOut, status, pull, push, wipe, setServer, testServer };
