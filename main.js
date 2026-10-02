const { app, BrowserWindow, ipcMain, dialog, protocol, net, clipboard, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { autoUpdater } = require('electron-updater');
// Les tests utilisent un faux serveur en mémoire
const sync = process.env.TTRACK_FAKE_CLOUD ? require('./scripts/fake-cloud') : require('./sync');

// Dossier de données alternatif (tests uniquement)
if (process.env.TTRACK_USERDATA) app.setPath('userData', process.env.TTRACK_USERDATA);

// aliments.json : aliments, plats, journal, objectifs. images/ : les photos. reglages.json : serveur et mises à jour.
// sync.bin : connexion au cloud, chiffrée par Windows. sync-etat.json : ce qui a déjà été synchronisé.
const FILE = () => path.join(app.getPath('userData'), 'aliments.json');
const IMAGES = () => path.join(app.getPath('userData'), 'images');
const IMAGE_NAME = /^[\w-]+\.(png|jpe?g|webp|gif)$/i;
let win = null;

// Les photos sont servies par ttimg://<nom> pour ne pas exposer le disque à la page
protocol.registerSchemesAsPrivileged([{ scheme: 'ttimg', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

function createWindow() {
  win = new BrowserWindow({
    width: 1300, height: 860, minWidth: 900, minHeight: 600,
    title: 'Ttrack',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#0c1512',
    autoHideMenuBar: true,
    show: !process.env.TTRACK_HIDDEN,
    // Fenêtre cachée des tests : elle doit continuer à se dessiner pour les captures
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: !process.env.TTRACK_HIDDEN }
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.setAppUserModelId('com.ttrack.app');
if (!process.env.TTRACK_USERDATA && !app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => {
  protocol.handle('ttimg', req => {
    const name = decodeURIComponent(new URL(req.url).hostname);
    if (!IMAGE_NAME.test(name)) return new Response('', { status: 404 });
    return net.fetch(pathToFileURL(path.join(IMAGES(), name)).toString());
  });
  settings = loadSettings();
  startCloud();
  createWindow();
  startUpdates();
});
app.on('window-all-closed', () => app.quit());

// ---- Bibliothèque d'aliments ----
function writeAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', content);
  fs.renameSync(file + '.tmp', file);
}
let backedUp = false;

ipcMain.handle('data:load', () => {
  let data = {};
  if (fs.existsSync(FILE())) {
    try { data = JSON.parse(fs.readFileSync(FILE(), 'utf8')); }
    catch {
      // Fichier illisible : on le met de côté plutôt que de l'écraser
      fs.renameSync(FILE(), FILE().replace(/\.json$/, `.illisible-${Date.now()}.json`));
    }
  }
  const foods = data.foods || [], dishes = data.dishes || [];
  const entries = data.entries || [], goals = data.goals || [];
  const measures = data.measures || [], steps = data.steps || [], profile = data.profile || [];
  // Photos qui ne servent plus (aliment ou plat supprimé, photo remplacée)
  const used = new Set([...foods, ...dishes].map(x => x.image).filter(Boolean));
  if (fs.existsSync(IMAGES())) {
    for (const name of fs.readdirSync(IMAGES())) if (!used.has(name)) fs.rmSync(path.join(IMAGES(), name), { force: true });
  }
  return { foods, dishes, entries, goals, measures, steps, profile };
});

ipcMain.handle('data:save', (_e, { foods, dishes, entries, goals, measures, steps, profile }) => {
  // Une copie de la version précédente à chaque lancement
  if (!backedUp && fs.existsSync(FILE())) { fs.copyFileSync(FILE(), FILE() + '.bak'); backedUp = true; }
  writeAtomic(FILE(), JSON.stringify({ version: 4, foods, dishes, entries, goals, measures, steps, profile }, null, 2));
  return true;
});

// ---- Photos ----
function storeImage(buffer, ext) {
  fs.mkdirSync(IMAGES(), { recursive: true });
  const name = `${crypto.randomUUID()}.${ext.toLowerCase().replace('jpeg', 'jpg')}`;
  fs.writeFileSync(path.join(IMAGES(), name), buffer);
  return name;
}
function imageFromFile(file) {
  const ext = path.extname(file || '').slice(1);
  if (!IMAGE_NAME.test('x.' + ext)) return null;
  return storeImage(fs.readFileSync(file), ext);
}
ipcMain.handle('image:pick', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    title: 'Choisir une photo', properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
  });
  return canceled || !filePaths?.length ? null : imageFromFile(filePaths[0]);
});
ipcMain.handle('image:file', (_e, file) => imageFromFile(file));
ipcMain.handle('image:missing', (_e, names) => names.filter(n => IMAGE_NAME.test(n) && !fs.existsSync(path.join(IMAGES(), n))));
ipcMain.handle('image:paste', async () => {
  for (const item of await clipboard.read()) {
    const type = item.types.find(t => /^image\/(png|jpeg|webp|gif)$/.test(t));
    if (type) return storeImage(Buffer.from(await (await item.getType(type)).arrayBuffer()), type.slice(6));
  }
  return null;
});

// ---- Réglages (reglages.json) ----
const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'reglages.json');
let settings = null;
const stripBom = s => s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
const readJson = (file, fallback) => { try { return JSON.parse(stripBom(fs.readFileSync(file, 'utf8'))); } catch { return fallback; } };
function loadSettings() {
  const s = { autoUpdate: true, ...readJson(SETTINGS_FILE(), {}) };
  if ('server' in s) return s;
  // Pas encore de serveur enregistré : on reprend celui configuré dans l'ancien Ttrack
  const old = readJson(path.join(app.getPath('userData'), 'ttrack.json'), {});
  s.server = old.server?.url ? { url: old.server.url, key: old.server.key } : null;
  writeAtomic(SETTINGS_FILE(), JSON.stringify(s, null, 2));
  return s;
}
const saveSettings = patch => { settings = { ...settings, ...patch }; writeAtomic(SETTINGS_FILE(), JSON.stringify(settings, null, 2)); };

// ---- Cloud (Supabase, données chiffrées sur le PC avant l'envoi) ----
// sync.bin a le même format que dans l'ancien Ttrack : une connexion existante est reprise telle quelle.
const SECRET = () => path.join(app.getPath('userData'), 'sync.bin');
const STATE = () => path.join(app.getPath('userData'), 'sync-etat.json');
function saveSecret() {
  const s = sync.secret();
  if (!s) return fs.rmSync(SECRET(), { force: true });
  const json = JSON.stringify(s);
  writeAtomic(SECRET(), safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(json) : json);
}
function startCloud() {
  sync.setOnSession(saveSecret);
  if (!settings.server) return;
  sync.setServer(settings.server);
  try {
    if (fs.existsSync(SECRET())) {
      const raw = fs.readFileSync(SECRET());
      sync.restore(JSON.parse(safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf8')));
    }
  } catch {}
}
const call = fn => async (...args) => {
  try { return { ok: true, data: await fn(...args) }; }
  catch (e) { return { ok: false, error: String(e?.message || e) }; }
};
const account = r => { saveSecret(); return { email: r.email, recoveryKey: r.recoveryKey }; };
const resetState = () => writeAtomic(STATE(), '{}');
ipcMain.handle('cloud:status', () => ({ server: settings.server ? { url: settings.server.url } : null, ...sync.status() }));
ipcMain.handle('cloud:testserver', call((_e, cfg) => sync.testServer(cfg)));
ipcMain.handle('cloud:setserver', (_e, cfg) => {
  sync.signOut(); saveSecret(); resetState();
  saveSettings({ server: cfg });
  sync.setServer(cfg || {});
  return true;
});
ipcMain.handle('cloud:signup', call(async (_e, email, pwd) => { resetState(); return account(await sync.signUp(email, pwd)); }));
ipcMain.handle('cloud:signin', call(async (_e, email, pwd) => { resetState(); return account(await sync.signIn(email, pwd)); }));
ipcMain.handle('cloud:signout', () => { sync.signOut(); saveSecret(); resetState(); return true; });
ipcMain.handle('cloud:pull', call((_e, since) => sync.pull(since)));
ipcMain.handle('cloud:push', call((_e, records) => sync.push(records)));
ipcMain.handle('cloud:pushimages', call((_e, names) => sync.pushImages(names, IMAGES())));
ipcMain.handle('cloud:pullimages', call((_e, names) => sync.pullImages(names, IMAGES())));
ipcMain.handle('cloud:wipe', call(async () => { await sync.wipe(); resetState(); }));
ipcMain.handle('cloud:state', () => readJson(STATE(), {}));
ipcMain.handle('cloud:savestate', (_e, state) => { writeAtomic(STATE(), JSON.stringify(state)); return true; });

// ---- Mises à jour (GitHub Releases) ----
// electron-builder dépose app-update.yml dans les ressources quand une cible de publication est configurée.
const updatesConfigured = () => {
  try { return app.isPackaged && fs.existsSync(path.join(process.resourcesPath, 'app-update.yml')); } catch { return false; }
};
let lastUpdate = { status: 'idle' };
const sendUpdate = (status, info = {}) => { lastUpdate = { status, ...info }; try { win?.webContents.send('update:status', lastUpdate); } catch {} };
const errText = e => String(e?.message || e).split('\n')[0];
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.on('checking-for-update', () => sendUpdate('checking'));
autoUpdater.on('update-available', i => sendUpdate(autoUpdater.autoDownload ? 'downloading' : 'available', { version: i.version, percent: 0 }));
autoUpdater.on('update-not-available', () => sendUpdate('none'));
autoUpdater.on('download-progress', p => sendUpdate('downloading', { version: lastUpdate.version, percent: Math.round(p.percent) }));
autoUpdater.on('update-downloaded', i => sendUpdate('downloaded', { version: i.version }));
autoUpdater.on('error', e => sendUpdate('error', { message: errText(e) }));

// Mises à jour automatiques : recherche au lancement puis toutes les 6 heures, téléchargement en arrière-plan,
// installation à la fermeture de l'appli (ou tout de suite avec le bouton Installer)
function startUpdates() {
  autoUpdater.autoDownload = settings.autoUpdate;
  if (!updatesConfigured()) return;
  const check = () => { if (settings.autoUpdate) autoUpdater.checkForUpdates().catch(() => {}); };
  setTimeout(check, 4000);
  setInterval(check, 6 * 3600e3);
}
ipcMain.handle('update:info', () => ({ ...lastUpdate, installed: require('./package.json').version, configured: updatesConfigured(), auto: settings.autoUpdate }));
ipcMain.handle('update:check', async () => {
  if (!updatesConfigured()) return false;
  try { await autoUpdater.checkForUpdates(); } catch (e) { sendUpdate('error', { message: errText(e) }); }
  return true;
});
ipcMain.handle('update:download', () => { autoUpdater.downloadUpdate().catch(() => {}); return true; });
ipcMain.handle('update:install', () => { autoUpdater.quitAndInstall(); });
ipcMain.handle('update:auto', (_e, on) => { saveSettings({ autoUpdate: !!on }); autoUpdater.autoDownload = !!on; return true; });
