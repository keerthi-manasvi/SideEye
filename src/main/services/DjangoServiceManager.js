const { spawn } = require('child_process');
const path = require('path');
const fetch = require('node-fetch');
const { EventEmitter } = require('events');

class DjangoServiceManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      port: options.port || 8000,
      host: options.host || 'localhost',
      maxRestartAttempts: options.maxRestartAttempts || 3,
      restartDelay: options.restartDelay || 2000,
      healthCheckInterval: options.healthCheckInterval || 10000,
      startupTimeout: options.startupTimeout || 30000,
      shutdownTimeout: options.shutdownTimeout || 10000,
      isDev: options.isDev || false,
      ...options
    };
    
    this.process = null;
    this.isRunning = false;
    this.isStarting = false;
    this.isStopping = false;
    this.restartAttempts = 0;
    this.healthCheckTimer = null;
    this.startupTimer = null;
    this.lastHealthCheck = null;
    
    // Bind methods to preserve context
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.restart = this.restart.bind(this);
    this.healthCheck = this.healthCheck.bind(this);
    this.handleProcessExit = this.handleProcessExit.bind(this);
    this.handleProcessError = this.handleProcessError.bind(this);
  }

  /**
   * Start the Django service
   * @returns {Promise<boolean>} Success status
   */
  async start() {
    if (this.isRunning || this.isStarting) {
      this.emit('warning', 'Django service is already running or starting');
      return true;
    }

    if (this.options.isDev) {
      this.emit('info', 'Development mode: Django service managed externally');
      return true;
    }

    this.isStarting = true;
    this.emit('starting');

    try {
      await this._spawnDjangoProcess();
      await this._waitForServiceReady();
      
      this.isRunning = true;
      this.isStarting = false;
      this.restartAttempts = 0;
      
      this._startHealthMonitoring();
      this.emit('started');
      
      return true;
    } catch (error) {
      this.isStarting = false;
      this.emit('error', `Failed to start Django service: ${error.message}`);
      return false;
    }
  }

  /**
   * Stop the Django service
   * @returns {Promise<boolean>} Success status
   */
  async stop() {
    if (!this.isRunning && !this.process) {
      return true;
    }

    this.isStopping = true;
    this.emit('stopping');

    try {
      this._stopHealthMonitoring();
      
      if (this.startupTimer) {
        clearTimeout(this.startupTimer);
        this.startupTimer = null;
      }

      if (this.process) {
        await this._gracefulShutdown();
      }

      this.isRunning = false;
      this.isStopping = false;
      this.process = null;
      
      this.emit('stopped');
      return true;
    } catch (error) {
      this.isStopping = false;
      this.emit('error', `Failed to stop Django service: ${error.message}`);
      return false;
    }
  }

  /**
   * Restart the Django service
   * @returns {Promise<boolean>} Success status
   */
  async restart() {
    this.emit('restarting');
    
    const stopped = await this.stop();
    if (!stopped) {
      return false;
    }

    // Wait a moment before restarting
    await new Promise(resolve => setTimeout(resolve, this.options.restartDelay));
    
    return await this.start();
  }

  /**
   * Check if the Django service is healthy
   * @returns {Promise<boolean>} Health status
   */
  async healthCheck() {
    if (!this.isRunning) {
      return false;
    }

    try {
      const response = await fetch(`http://${this.options.host}:${this.options.port}/api/health/`, {
        method: 'GET',
        timeout: 5000
      });
      
      const isHealthy = response.ok;
      this.lastHealthCheck = {
        timestamp: Date.now(),
        healthy: isHealthy,
        status: response.status
      };
      
      if (isHealthy) {
        this.emit('healthy');
      } else {
        this.emit('unhealthy', { status: response.status });
      }
      
      return isHealthy;
    } catch (error) {
      this.lastHealthCheck = {
        timestamp: Date.now(),
        healthy: false,
        error: error.message
      };
      
      this.emit('unhealthy', { error: error.message });
      return false;
    }
  }

  /**
   * Get the current status of the service
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      isStarting: this.isStarting,
      isStopping: this.isStopping,
      restartAttempts: this.restartAttempts,
      lastHealthCheck: this.lastHealthCheck,
      pid: this.process ? this.process.pid : null,
      uptime: this.isRunning ? Date.now() - this.startTime : 0
    };
  }

  /**
   * Make an API call to the Django service
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {Object} data - Request data
   * @returns {Promise<Object>} API response
   */
  async apiCall(endpoint, method = 'GET', data = null) {
    if (!this.isRunning) {
      throw new Error('Django service is not running');
    }

    const url = `http://${this.options.host}:${this.options.port}/api${endpoint}`;
    
    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000
      };
      
      if (data && method !== 'GET') {
        options.body = JSON.stringify(data);
      }
      
      const response = await fetch(url, options);
      const result = await response.json();
      
      return {
        success: true,
        data: result,
        status: response.status
      };
    } catch (error) {
      this.emit('api-error', { endpoint, method, error: error.message });
      
      // If it's a connection error, trigger health check
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        this._handleConnectionError();
      }
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Private methods

  async _spawnDjangoProcess() {
    const djangoPath = path.join(__dirname, '../../../backend');
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    this.process = spawn(pythonCmd, ['manage.py', 'runserver', `${this.options.port}`], {
      cwd: djangoPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false
    });

    this.process.stdout.on('data', (data) => {
      const message = data.toString().trim();
      this.emit('stdout', message);
    });

    this.process.stderr.on('data', (data) => {
      const message = data.toString().trim();
      this.emit('stderr', message);
    });

    this.process.on('exit', this.handleProcessExit);
    this.process.on('error', this.handleProcessError);

    this.startTime = Date.now();
  }

  async _waitForServiceReady() {
    return new Promise((resolve, reject) => {
      const checkReady = async () => {
        try {
          const response = await fetch(`http://${this.options.host}:${this.options.port}/api/health/`, {
            method: 'GET',
            timeout: 2000
          });
          
          if (response.ok) {
            resolve();
          } else {
            setTimeout(checkReady, 1000);
          }
        } catch (error) {
          setTimeout(checkReady, 1000);
        }
      };

      this.startupTimer = setTimeout(() => {
        reject(new Error('Django service startup timeout'));
      }, this.options.startupTimeout);

      checkReady();
    });
  }

  async _gracefulShutdown() {
    return new Promise((resolve) => {
      if (!this.process) {
        resolve();
        return;
      }

      const shutdownTimer = setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
        }
        resolve();
      }, this.options.shutdownTimeout);

      this.process.on('exit', () => {
        clearTimeout(shutdownTimer);
        resolve();
      });

      // Try graceful shutdown first
      this.process.kill('SIGTERM');
    });
  }

  _startHealthMonitoring() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      const isHealthy = await this.healthCheck();
      
      if (!isHealthy && this.isRunning) {
        this.emit('warning', 'Health check failed');
        this._handleUnhealthyService();
      }
    }, this.options.healthCheckInterval);
  }

  _stopHealthMonitoring() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  async _handleUnhealthyService() {
    if (this.restartAttempts < this.options.maxRestartAttempts) {
      this.restartAttempts++;
      this.emit('info', `Attempting to restart Django service (attempt ${this.restartAttempts}/${this.options.maxRestartAttempts})`);
      
      const restarted = await this.restart();
      if (!restarted) {
        this.emit('error', 'Failed to restart unhealthy Django service');
      }
    } else {
      this.emit('error', 'Max restart attempts reached. Django service is unhealthy.');
    }
  }

  _handleConnectionError() {
    if (this.isRunning) {
      this.emit('warning', 'Connection error detected, checking service health');
      // Trigger immediate health check
      setTimeout(() => this.healthCheck(), 100);
    }
  }

  handleProcessExit(code, signal) {
    this.emit('process-exit', { code, signal });
    
    if (this.isRunning && !this.isStopping) {
      this.emit('warning', `Django process exited unexpectedly (code: ${code}, signal: ${signal})`);
      this.isRunning = false;
      
      // Attempt automatic restart
      if (this.restartAttempts < this.options.maxRestartAttempts) {
        this.restartAttempts++;
        this.emit('info', `Attempting automatic restart (attempt ${this.restartAttempts}/${this.options.maxRestartAttempts})`);
        
        setTimeout(() => {
          this.start();
        }, this.options.restartDelay);
      } else {
        this.emit('error', 'Max restart attempts reached after process exit');
      }
    }
  }

  handleProcessError(error) {
    this.emit('process-error', error);
    
    if (this.isStarting) {
      this.isStarting = false;
    }
    
    if (this.isRunning) {
      this.isRunning = false;
    }
  }
}

module.exports = DjangoServiceManager;