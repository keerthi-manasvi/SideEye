const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Django API communication
  callDjangoAPI: (endpoint, method, data) => 
    ipcRenderer.invoke('django-api-call', endpoint, method, data),
  
  // Django service management
  djangoService: {
    start: () => ipcRenderer.invoke('django-service-start'),
    stop: () => ipcRenderer.invoke('django-service-stop'),
    restart: () => ipcRenderer.invoke('django-service-restart'),
    getStatus: () => ipcRenderer.invoke('django-service-status'),
    healthCheck: () => ipcRenderer.invoke('django-service-health-check'),
    
    // Listen to service status updates
    onStatusUpdate: (callback) => {
      ipcRenderer.on('django-service-status', (event, data) => callback(data));
    },
    
    // Remove status update listener
    removeStatusListener: () => {
      ipcRenderer.removeAllListeners('django-service-status');
    }
  },
  
  // Auto-updater functionality
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('updater-check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('updater-download-update'),
    installUpdate: () => ipcRenderer.invoke('updater-install-update'),
    getVersion: () => ipcRenderer.invoke('updater-get-version'),
    
    // Listen to updater status updates
    onStatusUpdate: (callback) => {
      ipcRenderer.on('updater-status', (event, data) => callback(event, data));
    },
    
    // Remove updater status listener
    removeStatusListener: (callback) => {
      ipcRenderer.removeListener('updater-status', callback);
    }
  },
  
  // Convenience methods for updater (backward compatibility)
  checkForUpdates: () => ipcRenderer.invoke('updater-check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('updater-download-update'),
  installUpdate: () => ipcRenderer.invoke('updater-install-update'),
  getVersion: () => ipcRenderer.invoke('updater-get-version'),
  onUpdaterStatus: (callback) => {
    ipcRenderer.on('updater-status', (event, data) => callback(event, data));
  },
  removeUpdaterListener: (callback) => {
    ipcRenderer.removeListener('updater-status', callback);
  },
  
  // System information
  platform: process.platform,
  
  // Window controls
  minimize: () => ipcRenderer.invoke('window-minimize'),
  maximize: () => ipcRenderer.invoke('window-maximize'),
  close: () => ipcRenderer.invoke('window-close')
});