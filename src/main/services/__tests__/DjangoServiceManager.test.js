const DjangoServiceManager = require('../DjangoServiceManager');
const { spawn } = require('child_process');
const fetch = require('node-fetch');
const { EventEmitter } = require('events');

// Mock dependencies
jest.mock('child_process');
jest.mock('node-fetch');

describe('DjangoServiceManager', () => {
  let serviceManager;
  let mockProcess;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock process
    mockProcess = new EventEmitter();
    mockProcess.pid = 12345;
    mockProcess.kill = jest.fn();
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    
    spawn.mockReturnValue(mockProcess);
    
    // Create service manager instance
    serviceManager = new DjangoServiceManager({
      port: 8000,
      host: 'localhost',
      isDev: false,
      maxRestartAttempts: 2,
      restartDelay: 100,
      healthCheckInterval: 500,
      startupTimeout: 2000,
      shutdownTimeout: 1000
    });
  });

  afterEach(async () => {
    if (serviceManager) {
      await serviceManager.stop();
    }
  });

  describe('Service Lifecycle', () => {
    test('should start Django service successfully', async () => {
      // Mock successful health check
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' })
      });

      const startPromise = serviceManager.start();
      
      // Simulate process startup
      setTimeout(() => {
        mockProcess.emit('spawn');
      }, 50);

      const result = await startPromise;
      
      expect(result).toBe(true);
      expect(serviceManager.isRunning).toBe(true);
      expect(spawn).toHaveBeenCalledWith(
        expect.stringMatching(/python/),
        ['manage.py', 'runserver', '8000'],
        expect.objectContaining({
          cwd: expect.stringContaining('backend'),
          stdio: ['pipe', 'pipe', 'pipe']
        })
      );
    });

    test('should handle startup timeout', async () => {
      // Mock health check that never succeeds
      fetch.mockRejectedValue(new Error('Connection refused'));

      const result = await serviceManager.start();
      
      expect(result).toBe(false);
      expect(serviceManager.isRunning).toBe(false);
    });

    test('should stop Django service gracefully', async () => {
      // Start service first
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' })
      });

      await serviceManager.start();
      
      // Mock graceful shutdown
      const stopPromise = serviceManager.stop();
      
      // Simulate process exit
      setTimeout(() => {
        mockProcess.emit('exit', 0, 'SIGTERM');
      }, 50);

      const result = await stopPromise;
      
      expect(result).toBe(true);
      expect(serviceManager.isRunning).toBe(false);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    test('should force kill process if graceful shutdown fails', async () => {
      // Start service first
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' })
      });

      await serviceManager.start();
      
      const stopPromise = serviceManager.stop();
      
      // Don't emit exit event to simulate hanging process
      // The timeout should trigger SIGKILL
      
      const result = await stopPromise;
      
      expect(result).toBe(true);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      // SIGKILL should be called after timeout
      setTimeout(() => {
        expect(mockProcess.kill).toHaveBeenCalledWith('SIGKILL');
      }, 1100);
    });

    test('should restart service successfully', async () => {
      // Mock successful health checks
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' })
      });

      // Start service first
      await serviceManager.start();
      
      const restartPromise = serviceManager.restart();
      
      // Simulate process exit and restart
      setTimeout(() => {
        mockProcess.emit('exit', 0, 'SIGTERM');
      }, 50);

      const result = await restartPromise;
      
      expect(result).toBe(true);
      expect(serviceManager.isRunning).toBe(true);
    });
  });

  describe('Health Monitoring', () => {
    test('should perform health check successfully', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' })
      });

      // Start service first
      await serviceManager.start();
      
      const isHealthy = await serviceManager.healthCheck();
      
      expect(isHealthy).toBe(true);
      expect(serviceManager.lastHealthCheck.healthy).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/health/',
        expect.objectContaining({
          method: 'GET',
          timeout: 5000
        })
      );
    });

    test('should detect unhealthy service', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' })
      });

      // Start service first
      await serviceManager.start();
      
      const isHealthy = await serviceManager.healthCheck();
      
      expect(isHealthy).toBe(false);
      expect(serviceManager.lastHealthCheck.healthy).toBe(false);
      expect(serviceManager.lastHealthCheck.status).toBe(500);
    });

    test('should handle health check connection errors', async () => {
      fetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      // Start service first (mock initial health check success)
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' })
      });
      await serviceManager.start();
      
      // Reset mock for actual test
      fetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      
      const isHealthy = await serviceManager.healthCheck();
      
      expect(isHealthy).toBe(false);
      expect(serviceManager.lastHealthCheck.healthy).toBe(false);
      expect(serviceManager.lastHealthCheck.error).toBe('ECONNREFUSED');
    });
  });

  describe('Automatic Restart Logic', () => {
    test('should attempt automatic restart on process exit', async () => {
      // Mock successful health checks
      fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' })
      });

      await serviceManager.start();
      
      // Simulate unexpected process exit
      mockProcess.emit('exit', 1, null);
      
      // Wait for restart attempt
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(serviceManager.restartAttempts).toBe(1);
    });

    test('should stop attempting restart after max attempts', async () => {
      // Mock health check failures
      fetch.mockRejectedValue(new Error('Connection refused'));

      // Start with successful health check
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' })
      });
      await serviceManager.start();
      
      // Reset mock to fail subsequent calls
      fetch.mockRejectedValue(new Error('Connection refused'));
      
      // Simulate multiple process exits
      mockProcess.emit('exit', 1, null);
      await new Promise(resolve => setTimeout(resolve, 150));
      
      mockProcess.emit('exit', 1, null);
      await new Promise(resolve => setTimeout(resolve, 150));
      
      mockProcess.emit('exit', 1, null);
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(serviceManager.restartAttempts).toBe(2); // Max attempts reached
    });
  });

  describe('API Communication', () => {
    test('should make successful API call', async () => {
      const mockResponse = { data: 'test' };
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      // Start service first
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' })
      });
      await serviceManager.start();
      
      // Reset mock for API call
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });
      
      const result = await serviceManager.apiCall('/test', 'GET');
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
      expect(result.status).toBe(200);
    });

    test('should handle API call errors', async () => {
      // Start service first
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' })
      });
      await serviceManager.start();
      
      // Mock API call failure
      fetch.mockRejectedValueOnce(new Error('Network error'));
      
      const result = await serviceManager.apiCall('/test', 'GET');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });

    test('should reject API calls when service is not running', async () => {
      await expect(serviceManager.apiCall('/test', 'GET'))
        .rejects.toThrow('Django service is not running');
    });

    test('should include request body for POST requests', async () => {
      const testData = { key: 'value' };
      
      // Start service first
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' })
      });
      await serviceManager.start();
      
      // Mock API call
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ created: true })
      });
      
      await serviceManager.apiCall('/test', 'POST', testData);
      
      expect(fetch).toHaveBeenLastCalledWith(
        'http://localhost:8000/api/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData),
          timeout: 10000
        })
      );
    });
  });

  describe('Event Emission', () => {
    test('should emit starting and started events', async () => {
      const startingHandler = jest.fn();
      const startedHandler = jest.fn();
      
      serviceManager.on('starting', startingHandler);
      serviceManager.on('started', startedHandler);
      
      // Mock successful health check
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' })
      });

      await serviceManager.start();
      
      expect(startingHandler).toHaveBeenCalled();
      expect(startedHandler).toHaveBeenCalled();
    });

    test('should emit error events on startup failure', async () => {
      const errorHandler = jest.fn();
      serviceManager.on('error', errorHandler);
      
      // Mock health check failure
      fetch.mockRejectedValue(new Error('Connection refused'));
      
      await serviceManager.start();
      
      expect(errorHandler).toHaveBeenCalledWith(
        expect.stringContaining('Failed to start Django service')
      );
    });

    test('should emit process output events', async () => {
      const stdoutHandler = jest.fn();
      const stderrHandler = jest.fn();
      
      serviceManager.on('stdout', stdoutHandler);
      serviceManager.on('stderr', stderrHandler);
      
      // Mock successful health check
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' })
      });

      await serviceManager.start();
      
      // Simulate process output
      mockProcess.stdout.emit('data', Buffer.from('Django server started'));
      mockProcess.stderr.emit('data', Buffer.from('Warning message'));
      
      expect(stdoutHandler).toHaveBeenCalledWith('Django server started');
      expect(stderrHandler).toHaveBeenCalledWith('Warning message');
    });
  });

  describe('Development Mode', () => {
    test('should skip service management in development mode', async () => {
      const devServiceManager = new DjangoServiceManager({
        isDev: true
      });
      
      const result = await devServiceManager.start();
      
      expect(result).toBe(true);
      expect(spawn).not.toHaveBeenCalled();
    });
  });

  describe('Status Reporting', () => {
    test('should return correct status information', async () => {
      const status = serviceManager.getStatus();
      
      expect(status).toEqual({
        isRunning: false,
        isStarting: false,
        isStopping: false,
        restartAttempts: 0,
        lastHealthCheck: null,
        pid: null,
        uptime: 0
      });
    });

    test('should return running status after successful start', async () => {
      // Mock successful health check
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'healthy' })
      });

      await serviceManager.start();
      
      const status = serviceManager.getStatus();
      
      expect(status.isRunning).toBe(true);
      expect(status.pid).toBe(12345);
      expect(status.uptime).toBeGreaterThan(0);
    });
  });
});