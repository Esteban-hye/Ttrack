const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ttrack', {
  load: () => ipcRenderer.invoke('data:load'),
  save: data => ipcRenderer.invoke('data:save', data),
  exportBackup: (content, filename) => ipcRenderer.invoke('backup:export', content, filename),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  offSearch: query => ipcRenderer.invoke('off:search', query),
  version: () => ipcRenderer.invoke('app:version'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdate: cb => ipcRenderer.on('update:status', (_e, data) => cb(data)),
  openExternal: url => ipcRenderer.invoke('app:open', url),
  copyText: text => ipcRenderer.invoke('app:copy', text),
  syncSignUp: (email, pwd) => ipcRenderer.invoke('sync:signup', email, pwd),
  syncSignIn: (email, pwd) => ipcRenderer.invoke('sync:signin', email, pwd),
  syncRecover: (email, pwd, rk, newPwd) => ipcRenderer.invoke('sync:recover', email, pwd, rk, newPwd),
  syncRestore: saved => ipcRenderer.invoke('sync:restore', saved),
  syncSignOut: () => ipcRenderer.invoke('sync:signout'),
  syncStatus: () => ipcRenderer.invoke('sync:status'),
  syncSetServer: cfg => ipcRenderer.invoke('sync:setserver', cfg),
  syncTestServer: cfg => ipcRenderer.invoke('sync:testserver', cfg),
  syncPull: since => ipcRenderer.invoke('sync:pull', since),
  syncPush: records => ipcRenderer.invoke('sync:push', records),
  syncWipe: () => ipcRenderer.invoke('sync:wipe')
});
