// Convertit build/icon.svg en build/icon.png (512x512, fond transparent). Lancer : npm run icon
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const svg = fs.readFileSync(path.join(__dirname, '..', 'build', 'icon.svg'), 'utf8')
  .replace('<svg ', '<svg width="512" height="512" ');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const w = new BrowserWindow({ width: 512, height: 512, show: false, frame: false, transparent: true, webPreferences: { offscreen: true } });
  let loaded = false;
  w.webContents.on('paint', (_e, _d, img) => {
    if (!loaded) return;
    fs.writeFileSync(path.join(__dirname, '..', 'build', 'icon.png'), img.resize({ width: 512, height: 512 }).toPNG());
    app.quit();
  });
  await w.loadURL('data:text/html,' + encodeURIComponent(`<html><body style="margin:0;background:transparent;overflow:hidden">${svg}</body></html>`));
  setTimeout(() => { loaded = true; w.webContents.invalidate(); }, 400);
});
