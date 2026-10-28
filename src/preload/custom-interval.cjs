// Bridge for the custom interval prompt (contracts/ipc.md). CommonJS because the renderer is sandboxed.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('customInterval', {
  getCurrent: () => ipcRenderer.invoke('interval:getCurrent'),
  submit: (value, unit) => ipcRenderer.invoke('interval:submit', Number(value), String(unit)),
  cancel: () => ipcRenderer.invoke('interval:cancel'),
});
