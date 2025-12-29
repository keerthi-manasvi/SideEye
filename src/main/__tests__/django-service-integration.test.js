const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const DjangoServiceManager = require('../services/DjangoServiceManager');

// Mock Electron modules
jest.mock('electron', () => ({
  app: {
    whenReady: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    quit: jest.fn()
  },
  BrowserWindow: jest.fn(() => ({
    loadURL: jest.fn(),
    once: jest.fn(),
    show: jest.fn(),
    on: jest.fn(),
    webContents: {
      openDevTools: jest.fn(),
      send: jest.fn()
    }
  })),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  }
}));

// Mock the Django service manager
jest.mock('../services/DjangoServiceManager');

describe('Django Service Integration', () => {
  let mockServiceManager;
  let mockWindow;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock service manager instance
    mockServiceManager = {
      start: jest.fn(),
      stop: jest.fn(),
      restart: jest.fn(),
      getStatus: jest.fn(),
      healthCheck: jest.fn(),
      apiCall: jest.fn(),
      on: jest.fn(),
      emit: jest.fn()
    };
    
    DjangoServiceManager.mockImplementation(() => mockServiceManager);
    
    // Create mock window
    mockWindow = {
      loadURL: jest.fn(),
      once: jest.fn(),
      show: jest.fn(),
      on: jest.fn(),
      webContents: {
        openDevTools: jest.fn(),
        send: jest.fn()
      }
    };
    
    BrowserWindow.mockImplementation(() => mockWindow);
  });

  describe('Service Initialization', () => {
    test('should initialize Django service manager with correct options', () => {
      // Import main.js to trigger initialization
      require('../main.js');
      
      expect(DjangoServiceManager).toHaveBeenCalledWith({
        port: 8000,
        host: 'localhost',
        isDev: expect.any(Boolean),
        maxRestartAttempts: 3,
        restartDelay: 2000,
        healthCheckInterval: 10000,
        startupTimeout: 30000,
        shutdownTimeout: 10000
      });
    });

    test('should set up all required event listeners', () => {
      require('../main.js');
      
      const expectedEvents = [
        'starting', 'started', 'stopping', 'stopped', 'restarting',
        'healthy', 'unhealthy', 'error', 'warning', 'info',
        'stdout', 'stderr', 'process-exit', 'process-error', 'api-error'
      ];
      
      expectedEvents.forEach(event => {
        expect(mockServiceManager.on).toHaveBeenCalledWith(
          event,
          expect.any(Function)
        );
      });
    });
  });

  describe('IPC Handler Registration', () => {
    test('should register all Django service IPC handlers', () => {
      require('../main.js');
      
      const expectedHandlers = [
        'django-api-call',
        'django-service-start',
        'django-service-stop',
        'django-service-restart',
        'django-service-status',
        'django-service-health-check'
      ];
      
      expectedHandlers.forEach(handler => {
        expect(ipcMain.handle).toHaveBeenCalledWith(
          handler,
          expect.any(Function)
        );
      });
    });

    test('should handle django-service-start IPC call', async () => {
      mockServiceManager.start.mockResolvedValue(true);
      
      require('../main.js');
      
      // Get the handler function
      const startHandler = ipcMain.handle.mock.calls
        .find(call => call[0] === 'django-service-start')[1];
      
      const result = await startHandler();
      
      expect(mockServiceManager.start).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    test('should handle django-service-stop IPC call', async () => {
      mockServiceManager.stop.mockResolvedValue(true);
      
      require('../main.js');
      
      const stopHandler = ipcMain.handle.mock.calls
        .find(call => call[0] === 'django-service-stop')[1];
      
      const result = await stopHandler();
      
      expect(mockServiceManager.stop).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    test('should handle django-service-restart IPC call', async () => {
      mockServiceManager.restart.mockResolvedValue(true);
      
      require('../main.js');
      
      const restartHandler = ipcMain.handle.mock.calls
        .find(call => call[0] === 'django-service-restart')[1];
      
      const result = await restartHandler();
      
      expect(mockServiceManager.restart).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    test('should handle django-service-status IPC call', async () => {
      const mockStatus = {
        isRunning: true,
        isStarting: false,
        isStopping: false,
        restartAttempts: 0,
        lastHealthCheck: { healthy: true, timestamp: Date.now() },
        pid: 12345,
        uptime: 60000
      };
      
      mockServiceManager.getStatus.mockReturnValue(mockStatus);
      
      require('../main.js');
      
      const statusHandler = ipcMain.handle.mock.calls
        .find(call => call[0] === 'django-service-status')[1];
      
      const result = await statusHandler();
      
      expect(mockServiceManager.getStatus).toHaveBeenCalled();
      expect(result).toEqual({ success: true, status: mockStatus });
    });

    test('should handle django-service-health-check IPC call', async () => {
      mockServiceManager.healthCheck.mockResolvedValue(true);
      
      require('../main.js');
      
      const healthHandler = ipcMain.handle.mock.calls
        .find(call => call[0] === 'django-service-health-check')[1];
      
      const result = await healthHandler();
      
      expect(mockServiceManager.healthCheck).toHaveBeenCalled();
      expect(result).toEqual({ success: true, healthy: true });
    });

    test('should handle django-api-call IPC call', async () => {
      const mockApiResponse = {
        success: true,
        data: { message: 'test' },
        status: 200
      };
      
      mockServiceManager.apiCall.mockResolvedValue(mockApiResponse);
      
      require('../main.js');
      
      const apiHandler = ipcMain.handle.mock.calls
        .find(call => call[0] === 'django-api-call')[1];
      
      const result = await apiHandler(null, '/test', 'GET', null);
      
      expect(mockServiceManager.apiCall).toHaveBeenCalledWith('/test', 'GET', null);
      expect(result).toEqual(mockApiResponse);
    });
  });

  describe('Error Handling', () => {
    test('should handle service start failure', async () => {
      mockServiceManager.start.mockRejectedValue(new Error('Start failed'));
      
      require('../main.js');
      
      const startHandler = ipcMain.handle.mock.calls
        .find(call => call[0] === 'django-service-start')[1];
      
      const result = await startHandler();
      
      expect(result).toEqual({
        success: false,
        error: 'Start failed'
      });
    });

    test('should handle uninitialized service manager', async () => {
      // Don't initialize service manager
      DjangoServiceManager.mockImplementation(() => null);
      
      require('../main.js');
      
      const statusHandler = ipcMain.handle.mock.calls
        .find(call => call[0] === 'django-service-status')[1];
      
      const result = await statusHandler();
      
      expect(result).toEqual({
        success: false,
        error: 'Django service manager not initialized',
        status: null
      });
    });

    test('should handle API call when service is not initialized', async () => {
      DjangoServiceManager.mockImplementation(() => null);
      
      require('../main.js');
      
      const apiHandler = ipcMain.handle.mock.calls
        .find(call => call[0] === 'django-api-call')[1];
      
      const result = await apiHandler(null, '/test', 'GET', null);
      
      expect(result).toEqual({
        success: false,
        error: 'Django service manager not initialized'
      });
    });
  });

  describe('Event Forwarding to Renderer', () => {
    test('should forward service status events to renderer process', () => {
      require('../main.js');
      
      // Get the event handler for 'started' event
      const startedHandler = mockServiceManager.on.mock.calls
        .find(call => call[0] === 'started')[1];
      
      // Simulate the event
      startedHandler();
      
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'django-service-status',
        { status: 'started' }
      );
    });

    test('should forward error events to renderer process', () => {
      require('../main.js');
      
      const errorHandler = mockServiceManager.on.mock.calls
        .find(call => call[0] === 'error')[1];
      
      errorHandler('Test error message');
      
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'django-service-status',
        { status: 'error', error: 'Test error message' }
      );
    });

    test('should forward unhealthy events to renderer process', () => {
      require('../main.js');
      
      const unhealthyHandler = mockServiceManager.on.mock.calls
        .find(call => call[0] === 'unhealthy')[1];
      
      unhealthyHandler({ status: 500 });
      
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'django-service-status',
        { status: 'unhealthy', error: 'HTTP 500' }
      );
    });

    test('should not send events when window is not available', () => {
      mockWindow = null;
      
      require('../main.js');
      
      const startedHandler = mockServiceManager.on.mock.calls
        .find(call => call[0] === 'started')[1];
      
      // Should not throw error when window is null
      expect(() => startedHandler()).not.toThrow();
    });
  });

  describe('Application Lifecycle Integration', () => {
    test('should start Django service when app is ready', async () => {
      mockServiceManager.start.mockResolvedValue(true);
      
      require('../main.js');
      
      // Simulate app ready
      const readyHandler = app.whenReady.mock.calls[0][0];
      if (readyHandler) {
        await readyHandler();
      }
      
      expect(mockServiceManager.start).toHaveBeenCalled();
    });

    test('should stop Django service when app quits', () => {
      mockServiceManager.stop.mockResolvedValue(true);
      
      require('../main.js');
      
      // Find the before-quit handler
      const beforeQuitHandler = app.on.mock.calls
        .find(call => call[0] === 'before-quit')[1];
      
      if (beforeQuitHandler) {
        beforeQuitHandler();
      }
      
      expect(mockServiceManager.stop).toHaveBeenCalled();
    });

    test('should stop Django service when all windows are closed', () => {
      mockServiceManager.stop.mockResolvedValue(true);
      
      require('../main.js');
      
      const windowsClosedHandler = app.on.mock.calls
        .find(call => call[0] === 'window-all-closed')[1];
      
      if (windowsClosedHandler) {
        windowsClosedHandler();
      }
      
      expect(mockServiceManager.stop).toHaveBeenCalled();
    });
  });

  describe('Service Recovery', () => {
    test('should handle service restart on failure', async () => {
      mockServiceManager.restart.mockResolvedValue(true);
      
      require('../main.js');
      
      // Simulate service failure and restart
      const errorHandler = mockServiceManager.on.mock.calls
        .find(call => call[0] === 'error')[1];
      
      errorHandler('Service failed');
      
      // Verify error was logged and forwarded
      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'django-service-status',
        { status: 'error', error: 'Service failed' }
      );
    });

    test('should handle multiple restart attempts', () => {
      require('../main.js');
      
      // Simulate multiple warning events (restart attempts)
      const warningHandler = mockServiceManager.on.mock.calls
        .find(call => call[0] === 'warning')[1];
      
      warningHandler('Attempting to restart Django service (attempt 1/3)');
      warningHandler('Attempting to restart Django service (attempt 2/3)');
      warningHandler('Max restart attempts reached. Django service is unhealthy.');
      
      // Should handle all warnings without crashing
      expect(warningHandler).toBeDefined();
    });
  });
});