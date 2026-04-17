const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('snake3dDesktop', {
  getConfig: () => ipcRenderer.invoke('snake3d:get-config'),
  saveConfig: (config) => ipcRenderer.invoke('snake3d:save-config', config),
  applyGraphicsSettings: (graphics) => ipcRenderer.invoke('snake3d:apply-graphics-settings', graphics),
  getUpdateState: () => ipcRenderer.invoke('snake3d:get-update-state'),
  checkForUpdates: () => ipcRenderer.invoke('snake3d:check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('snake3d:install-update'),
  onUpdateState: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const handler = (_event, state) => callback(state);
    ipcRenderer.on('snake3d:update-state', handler);
    return () => ipcRenderer.removeListener('snake3d:update-state', handler);
  }
});
