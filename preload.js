const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('ttrack', {
  load: () => ipcRenderer.invoke('data:load'),
  save: data => ipcRenderer.invoke('data:save', data),
  pickImage: () => ipcRenderer.invoke('image:pick'),
  pasteImage: () => ipcRenderer.invoke('image:paste'),
  // Glisser-déposer : le chemin du fichier n'est lisible qu'ici
  dropImage: file => ipcRenderer.invoke('image:file', webUtils.getPathForFile(file)),
  update: {
    info: () => ipcRenderer.invoke('update:info'),
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    setAuto: on => ipcRenderer.invoke('update:auto', on),
    onStatus: cb => ipcRenderer.on('update:status', (_e, s) => cb(s))
  }
});
