const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('veryfy', {
  isDesktop: true,
  getPrerequisites: () => ipcRenderer.invoke('device:prerequisites'),
  scanDevice: () => ipcRenderer.invoke('device:scan'),
  getCloudStatus: () => ipcRenderer.invoke('cloud:status'),
  saveInspection: (inspection) => ipcRenderer.invoke('cloud:save-inspection', inspection),
  listInspections: () => ipcRenderer.invoke('cloud:list-inspections'),
  onDeviceState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('device:state', listener);
    return () => ipcRenderer.removeListener('device:state', listener);
  },
});
