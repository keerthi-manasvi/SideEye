const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const isDev = require('electron-is-dev');
const DjangoServiceManager = require('./services/DjangoServiceManager');

let mainWindow;
let djangoServiceManager;

// Auto-updater configuration
if (!isDev) {
  // Configure auto-updater
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  
  // Auto-updater event handlers
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update...');
    if (mainWindow) {
      mainWindow.webContents.send('updater-status', { status: 'checking' });
    }
  });

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version);
    if (mainWindow) {
      mainWindow.webContents.send('updater-status', { 
        status: 'available', 
        version: info.version,
        releaseNotes: info.releaseNotes 
      });
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('Update not available');
    if (mainWindow) {
      mainWindow.webContents.send('updater-status', { status: 'not-available' });
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
    if (mainWindow) {
      mainWindow.webContents.send('updater-status', { 
        status: 'error', 
        error: err.message 
      });
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
    console.log(logMessage);
    if (mainWindow) {
      mainWindow.webContents.send('updater-status', { 
        status: 'downloading', 
        progress: progressObj 
      });
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded');
    if (mainWindow) {
      mainWindow.webContents.send('updater-status', { 
        status: 'downloaded',
        version: info.version 
      });
    }
  });

  // Check for updates on startup (delayed)
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 3000);
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false
  });

  // Load the app
  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../../build/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function initializeDjangoService() {
  // Initialize Django service manager
  djangoServiceManager = new DjangoServiceManager({
    port: 8000,
    host: 'localhost',
    isDev: isDev,
    maxRestartAttempts: 3,
    restartDelay: 2000,
    healthCheckInterval: 10000,
    startupTimeout: 30000,
    shutdownTimeout: 10000
  });

  // Set up event listeners for service manager
  djangoServiceManager.on('starting', () => {
    console.log('Django service is starting...');
    if (mainWindow) {
      mainWindow.webContents.send('django-service-status', { status: 'starting' });
    }
  });

  djangoServiceManager.on('started', () => {
    console.log('Django service started successfully');
    if (mainWindow) {
      mainWindow.webContents.send('django-service-status', { status: 'started' });
    }
  });

  djangoServiceManager.on('stopping', () => {
    console.log('Django service is stopping...');
    if (mainWindow) {
      mainWindow.webContents.send('django-service-status', { status: 'stopping' });
    }
  });

  djangoServiceManager.on('stopped', () => {
    console.log('Django service stopped');
    if (mainWindow) {
      mainWindow.webContents.send('django-service-status', { status: 'stopped' });
    }
  });

  djangoServiceManager.on('restarting', () => {
    console.log('Django service is restarting...');
    if (mainWindow) {
      mainWindow.webContents.send('django-service-status', { status: 'restarting' });
    }
  });

  djangoServiceManager.on('healthy', () => {
    console.log('Django service health check passed');
  });

  djangoServiceManager.on('unhealthy', (data) => {
    console.warn('Django service health check failed:', data);
    if (mainWindow) {
      mainWindow.webContents.send('django-service-status', { 
        status: 'unhealthy', 
        error: data.error || `HTTP ${data.status}` 
      });
    }
  });

  djangoServiceManager.on('error', (error) => {
    console.error('Django service error:', error);
    if (mainWindow) {
      mainWindow.webContents.send('django-service-status', { 
        status: 'error', 
        error: error 
      });
    }
  });

  djangoServiceManager.on('warning', (message) => {
    console.warn('Django service warning:', message);
  });

  djangoServiceManager.on('info', (message) => {
    console.log('Django service info:', message);
  });

  djangoServiceManager.on('stdout', (data) => {
    console.log(`Django: ${data}`);
  });

  djangoServiceManager.on('stderr', (data) => {
    console.error(`Django Error: ${data}`);
  });

  djangoServiceManager.on('process-exit', (data) => {
    console.log(`Django process exited with code ${data.code}, signal: ${data.signal}`);
  });

  djangoServiceManager.on('process-error', (error) => {
    console.error('Django process error:', error);
  });

  djangoServiceManager.on('api-error', (data) => {
    console.error(`Django API error on ${data.method} ${data.endpoint}:`, data.error);
  });
}

async function startDjangoService() {
  if (!djangoServiceManager) {
    initializeDjangoService();
  }
  
  try {
    const started = await djangoServiceManager.start();
    if (!started) {
      console.error('Failed to start Django service');
    }
    return started;
  } catch (error) {
    console.error('Error starting Django service:', error);
    return false;
  }
}

async function stopDjangoService() {
  if (djangoServiceManager) {
    try {
      const stopped = await djangoServiceManager.stop();
      if (!stopped) {
        console.error('Failed to stop Django service gracefully');
      }
      return stopped;
    } catch (error) {
      console.error('Error stopping Django service:', error);
      return false;
    }
  }
  return true;
}

// App event handlers
app.whenReady().then(() => {
  startDjangoService();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopDjangoService();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopDjangoService();
});

// IPC handlers for Django service communication
ipcMain.handle('django-api-call', async (event, endpoint, method = 'GET', data = null) => {
  if (!djangoServiceManager) {
    return {
      success: false,
      error: 'Django service manager not initialized'
    };
  }
  
  try {
    return await djangoServiceManager.apiCall(endpoint, method, data);
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// IPC handlers for Django service management
ipcMain.handle('django-service-start', async (event) => {
  try {
    const started = await startDjangoService();
    return { success: started };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('django-service-stop', async (event) => {
  try {
    const stopped = await stopDjangoService();
    return { success: stopped };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('django-service-restart', async (event) => {
  if (!djangoServiceManager) {
    return { success: false, error: 'Django service manager not initialized' };
  }
  
  try {
    const restarted = await djangoServiceManager.restart();
    return { success: restarted };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('django-service-status', async (event) => {
  if (!djangoServiceManager) {
    return { 
      success: false, 
      error: 'Django service manager not initialized',
      status: null 
    };
  }
  
  try {
    const status = djangoServiceManager.getStatus();
    return { success: true, status };
  } catch (error) {
    return { success: false, error: error.message, status: null };
  }
});

ipcMain.handle('django-service-health-check', async (event) => {
  if (!djangoServiceManager) {
    return { success: false, error: 'Django service manager not initialized', healthy: false };
  }
  
  try {
    const healthy = await djangoServiceManager.healthCheck();
    return { success: true, healthy };
  } catch (error) {
    return { success: false, error: error.message, healthy: false };
  }
});

// IPC handlers for auto-updater functionality
ipcMain.handle('updater-check-for-updates', async (event) => {
  if (isDev) {
    return { success: false, error: 'Updates not available in development mode' };
  }
  
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('updater-download-update', async (event) => {
  if (isDev) {
    return { success: false, error: 'Updates not available in development mode' };
  }
  
  try {
    await autoUpdater.downloadUpdate();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('updater-install-update', async (event) => {
  if (isDev) {
    return { success: false, error: 'Updates not available in development mode' };
  }
  
  try {
    autoUpdater.quitAndInstall();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('updater-get-version', async (event) => {
  return { 
    success: true, 
    version: app.getVersion(),
    isDev: isDev 
  };
});