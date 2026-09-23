const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const sync = require('./sync');

// Dossier de données alternatif (tests et captures d'écran uniquement)
if (process.env.TTRACK_USERDATA) app.setPath('userData', process.env.TTRACK_USERDATA);

const FILE = () => path.join(app.getPath('userData'), 'ttrack.json');
const SECRET = () => path.join(app.getPath('userData'), 'sync.bin');
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1000, minHeight: 680,
    title: 'Ttrack',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#0c1512',
    autoHideMenuBar: true,
    show: !process.env.TTRACK_HIDDEN,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  return win;
}

app.setAppUserModelId('com.ttrack.app');
if (!process.env.TTRACK_USERDATA && !app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => {
  createWindow();
  if (app.isPackaged && updatesConfigured()) setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 4000);
});
app.on('window-all-closed', () => app.quit());

// ---- Données locales ----
// ttrack.json : aliments, plats, journal (lisible, facile à sauvegarder).
// sync.bin : identifiants de synchronisation, protégés par Windows (DPAPI).
function writeAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', content);
  fs.renameSync(file + '.tmp', file);
}
let backedUp = false;

ipcMain.handle('data:load', () => {
  let data = null;
  if (fs.existsSync(FILE())) {
    try { data = JSON.parse(fs.readFileSync(FILE(), 'utf8')); }
    catch {
      // Fichier illisible : on le met de côté plutôt que de l'écraser
      fs.renameSync(FILE(), FILE().replace(/\.json$/, `.illisible-${Date.now()}.json`));
    }
  }
  if (data) {
    try {
      if (fs.existsSync(SECRET())) {
        const raw = fs.readFileSync(SECRET());
        data.sync = JSON.parse(safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf8'));
      }
    } catch { data.sync = null; }
  }
  return data;
});

ipcMain.handle('data:save', (_e, d) => {
  const { sync: s, ...rest } = d;
  // Une copie de la version précédente à chaque lancement
  if (!backedUp && fs.existsSync(FILE())) { fs.copyFileSync(FILE(), FILE() + '.bak'); backedUp = true; }
  writeAtomic(FILE(), JSON.stringify(rest));
  if (s) writeAtomic(SECRET(), safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(JSON.stringify(s)) : JSON.stringify(s));
  else fs.rmSync(SECRET(), { force: true });
  return true;
});

// ---- Sauvegarde manuelle (fichier JSON) ----
ipcMain.handle('backup:export', async (_e, content, filename) => {
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title: 'Exporter les données Ttrack', defaultPath: filename, filters: [{ name: 'Sauvegarde Ttrack', extensions: ['json'] }]
  });
  if (canceled || !filePath) return false;
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
});
ipcMain.handle('backup:import', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(win, {
    title: 'Importer une sauvegarde Ttrack', properties: ['openFile'], filters: [{ name: 'Sauvegarde Ttrack', extensions: ['json'] }]
  });
  if (canceled || !filePaths?.length) return null;
  try { return JSON.parse(fs.readFileSync(filePaths[0], 'utf8')); } catch { return { error: 'invalid' }; }
});

// ---- Mises à jour (GitHub Releases) ----
// electron-builder retire le champ "build" du package.json empaqueté : on se fie au fichier
// app-update.yml qu'il dépose dans les ressources quand une cible de publication est configurée.
const updatesConfigured = () => {
  try { return app.isPackaged && fs.existsSync(path.join(process.resourcesPath, 'app-update.yml')); } catch { return false; }
};
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
const sendUpdate = (status, info) => { try { win?.webContents.send('update:status', { status, info }); } catch {} };
autoUpdater.on('checking-for-update', () => sendUpdate('checking'));
autoUpdater.on('update-available', i => sendUpdate('available', { version: i.version }));
autoUpdater.on('update-not-available', () => sendUpdate('none'));
autoUpdater.on('download-progress', p => sendUpdate('downloading', { percent: Math.round(p.percent) }));
autoUpdater.on('update-downloaded', i => sendUpdate('downloaded', { version: i.version }));
autoUpdater.on('error', e => sendUpdate('error', { message: String(e?.message || e) }));

ipcMain.handle('update:check', async () => {
  if (!updatesConfigured()) return { configured: false, version: app.getVersion() };
  try { await autoUpdater.checkForUpdates(); } catch (e) { sendUpdate('error', { message: String(e?.message || e) }); }
  return { configured: true, version: app.getVersion() };
});
ipcMain.handle('update:install', () => { autoUpdater.quitAndInstall(); });
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:open', (_e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });
ipcMain.handle('app:copy', (_e, text) => { clipboard.writeText(String(text)); return true; });

// ---- Synchronisation ----
const syncCall = fn => async (...args) => {
  try { return { ok: true, data: await fn(...args) }; }
  catch (e) { return { ok: false, error: String(e?.message || e) }; }
};
ipcMain.handle('sync:signup', syncCall((_e, email, pwd) => sync.signUp(email, pwd)));
ipcMain.handle('sync:signin', syncCall((_e, email, pwd) => sync.signIn(email, pwd)));
ipcMain.handle('sync:recover', syncCall((_e, email, pwd, rk, newPwd) => sync.recover(email, pwd, rk, newPwd)));
ipcMain.handle('sync:restore', (_e, saved) => sync.restore(saved));
ipcMain.handle('sync:signout', () => { sync.signOut(); return true; });
ipcMain.handle('sync:status', () => sync.status());
ipcMain.handle('sync:setserver', (_e, cfg) => { sync.setServer(cfg); return true; });
ipcMain.handle('sync:testserver', syncCall((_e, cfg) => sync.testServer(cfg)));
ipcMain.handle('sync:pull', syncCall((_e, since) => sync.pull(since)));
ipcMain.handle('sync:push', syncCall((_e, records) => sync.push(records)));
ipcMain.handle('sync:wipe', syncCall(() => sync.wipe()));

module.exports = { getWindow: () => win };
