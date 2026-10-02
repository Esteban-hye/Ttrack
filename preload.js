const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('ttrack', {
  load: () => ipcRenderer.invoke('data:load'),
  save: data => ipcRenderer.invoke('data:save', data),
  pickImage: () => ipcRenderer.invoke('image:pick'),
  pasteImage: () => ipcRenderer.invoke('image:paste'),
  // Glisser-déposer : le chemin du fichier n'est lisible qu'ici
  dropImage: file => ipcRenderer.invoke('image:file', webUtils.getPathForFile(file)),
  missingImages: names => ipcRenderer.invoke('image:missing', names),
  cloud: {
    status: () => ipcRenderer.invoke('cloud:status'),
    testServer: cfg => ipcRenderer.invoke('cloud:testserver', cfg),
    setServer: cfg => ipcRenderer.invoke('cloud:setserver', cfg),
    signUp: (email, pwd) => ipcRenderer.invoke('cloud:signup', email, pwd),
    signIn: (email, pwd) => ipcRenderer.invoke('cloud:signin', email, pwd),
    signOut: () => ipcRenderer.invoke('cloud:signout'),
    pull: since => ipcRenderer.invoke('cloud:pull', since),
    push: records => ipcRenderer.invoke('cloud:push', records),
    pushImages: names => ipcRenderer.invoke('cloud:pushimages', names),
    pullImages: names => ipcRenderer.invoke('cloud:pullimages', names),
    wipe: () => ipcRenderer.invoke('cloud:wipe'),
    state: () => ipcRenderer.invoke('cloud:state'),
    saveState: state => ipcRenderer.invoke('cloud:savestate', state)
  },
  update: {
    info: () => ipcRenderer.invoke('update:info'),
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    setAuto: on => ipcRenderer.invoke('update:auto', on),
    onStatus: cb => ipcRenderer.on('update:status', (_e, s) => cb(s))
  }
});
