const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('iveryfy', {
  isDesktop: true,
  getPrerequisites: () => ipcRenderer.invoke('device:prerequisites'),
  scanDevice: () => ipcRenderer.invoke('device:scan'),
  getCloudStatus: () => ipcRenderer.invoke('cloud:status'),
  signIn: (email, password) => ipcRenderer.invoke('auth:sign-in', { email, password }),
  signOut: () => ipcRenderer.invoke('auth:sign-out'),
  getAuthStatus: () => ipcRenderer.invoke('auth:status'),
  saveInspection: (inspection) => ipcRenderer.invoke('cloud:save-inspection', inspection),
  listInspections: () => ipcRenderer.invoke('cloud:list-inspections'),
  onAuthState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('auth:state', listener);
    return () => ipcRenderer.removeListener('auth:state', listener);
  },
  onDeviceState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('device:state', listener);
    return () => ipcRenderer.removeListener('device:state', listener);
  },
});
