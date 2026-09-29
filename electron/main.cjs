const path = require('path');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { DeviceBridge } = require('./device-bridge.cjs');
const { SupabaseService } = require('./supabase.cjs');

let mainWindow;
let deviceBridge;
let supabaseService;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: '#f5f8fa',
    title: 'VeryFY | Device Inspection',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpc() {
  ipcMain.handle('device:prerequisites', () => deviceBridge.checkPrerequisites());
  ipcMain.handle('device:scan', () => deviceBridge.scan());
  ipcMain.handle('cloud:status', () => supabaseService.status());
  ipcMain.handle('cloud:save-inspection', (_event, inspection) => supabaseService.saveInspection(inspection));
  ipcMain.handle('cloud:list-inspections', () => supabaseService.listInspections());
}

app.whenReady().then(() => {
  deviceBridge = new DeviceBridge();
  supabaseService = new SupabaseService();
  registerIpc();
  createWindow();
  deviceBridge.start((state) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('device:state', state);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  deviceBridge?.stop();
  if (process.platform !== 'darwin') app.quit();
});
