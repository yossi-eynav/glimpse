// Bridge for the selection window (contracts/ipc.md). CommonJS because the renderer is sandboxed.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('selection', {
  getDraft: () => ipcRenderer.invoke('selection:getDraft'),
  pick: () => ipcRenderer.invoke('selection:pick'),
  cancelPick: () => ipcRenderer.invoke('selection:cancelPick'),
  remove: (id) => ipcRenderer.invoke('selection:remove', String(id)),
  clearDraft: () => ipcRenderer.invoke('selection:clear'),
  commit: () => ipcRenderer.invoke('selection:commit'),
  discard: () => ipcRenderer.invoke('selection:discard'),
  onDraftChanged: (cb) => {
    const listener = (_event, view) => cb(view);
    ipcRenderer.on('selection:draftChanged', listener);
    return () => ipcRenderer.removeListener('selection:draftChanged', listener);
  },
});
