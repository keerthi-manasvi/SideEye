class ErrorHandlerService {
  constructor() {
    this.errorLog = [];
    this.maxLogSize = 1000;
    this.errorCallbacks = new Map();
    this.recoveryStrategies = new Map();
    this.setupGlobalErrorHandlers();
  }

  setupGlobalErrorHandlers() {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.logError({
        type: 'unhandled_promise_rejection',
        error: event.reason,
        timestamp: Date.now(),
        url: window.location.href
      });
      
      // Prevent the default browser behavior
      event.preventDefault();
    });

    // Handle global JavaScript errors
    window.addEventListener('error', (event) => {
      console.error('Global JavaScript error:', event.error);
      this.logError({
        type: 'javascript_error',
        error: event.error,
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        timestamp: Date.now(),
        url: window.location.href
      });
    });

    // Handle resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        console.error('Resource loading error:', event.target);
        this.logError({
          type: 'resource_error',
          element: event.target.tagName,
          source: event.target.src || event.target.href,
          timestamp: Date.now(),
          url: window.location.href
        });
      }
    }, true);
  }

  logError(errorData) {
    const errorEntry = {
      id: Date.now() + Math.random(),
      ...errorData,
      userAgent: navigator.userAgent,
      timestamp: errorData.timestamp || Date.now()
    };

    // Add to local log
    this.errorLog.unshift(errorEntry);
    
    // Maintain log size
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxLogSize);
    }

    // Store in localStorage for persistence
    try {
      const recentErrors = this.errorLog.slice(0, 50); // Store only recent errors
      localStorage.setItem('sideeye_error_log', JSON.stringify(recentErrors));
    } catch (e) {
      console.warn('Failed to persist error log:', e);
    }

    // Send to backend if available
    this.reportErrorToBackend(errorEntry);

    // Trigger error callbacks
    this.triggerErrorCallbacks(errorEntry);

    return errorEntry.id;
  }

  async reportErrorToBackend(errorEntry) {
    try {
      if (window.electronAPI?.djangoService?.apiCall) {
        await window.electronAPI.djangoService.apiCall('/errors/', 'POST', {
          error_id: errorEntry.id,
          error_type: errorEntry.type,
          error_message: errorEntry.error?.message || errorEntry.message,
          error_stack: errorEntry.error?.stack,
          timestamp: new Date(errorEntry.timestamp).toISOString(),
          user_agent: errorEntry.userAgent,
          url: errorEntry.url,
          additional_data: {
            filename: errorEntry.filename,
            lineno: errorEntry.lineno,
            colno: errorEntry.colno,
            element: errorEntry.element,
            source: errorEntry.source
          }
        });
      }
    } catch (e) {
      console.warn('Failed to report error to backend:', e);
    }
  }

  registerErrorCallback(type, callback) {
    if (!this.errorCallbacks.has(type)) {
      this.errorCallbacks.set(type, []);
    }
    this.errorCallbacks.get(type).push(callback);
  }

  unregisterErrorCallback(type, callback) {
    if (this.errorCallbacks.has(type)) {
      const callbacks = this.errorCallbacks.get(type);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  triggerErrorCallbacks(errorEntry) {
    const callbacks = this.errorCallbacks.get(errorEntry.type) || [];
    const globalCallbacks = this.errorCallbacks.get('*') || [];
    
    [...callbacks, ...globalCallbacks].forEach(callback => {
      try {
        callback(errorEntry);
      } catch (e) {
        console.error('Error in error callback:', e);
      }
    });
  }

  registerRecoveryStrategy(errorType, strategy) {
    this.recoveryStrategies.set(errorType, strategy);
  }

  async attemptRecovery(errorType, errorData) {
    const strategy = this.recoveryStrategies.get(errorType);
    if (strategy) {
      try {
        return await strategy(errorData);
      } catch (e) {
        console.error(`Recovery strategy failed for ${errorType}:`, e);
        return false;
      }
    }
    return false;
  }

  // Specific error handling methods
  handleAPIError(error, endpoint, method, data) {
    const errorId = this.logError({
      type: 'api_error',
      error,
      endpoint,
      method,
      data,
      timestamp: Date.now()
    });

    // Attempt recovery based on error type
    if (error.message.includes('fetch') || error.message.includes('Network')) {
      return this.handleNetworkError(error, { endpoint, method, data });
    }

    if (error.message.includes('timeout')) {
      return this.handleTimeoutError(error, { endpoint, method, data });
    }

    return { recovered: false, errorId };
  }

  async handleNetworkError(error, context) {
    console.log('Attempting network error recovery...');
    
    // Check if backend service is running
    try {
      if (window.electronAPI?.djangoService?.healthCheck) {
        const healthResult = await window.electronAPI.djangoService.healthCheck();
        
        if (!healthResult.healthy) {
          // Try to restart the service
          console.log('Backend unhealthy, attempting restart...');
          const restartResult = await window.electronAPI.djangoService.restart();
          
          if (restartResult.success) {
            // Wait a moment for service to be ready
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Verify service is now healthy
            const verifyResult = await window.electronAPI.djangoService.healthCheck();
            if (verifyResult.healthy) {
              // Retry the original request
              if (context.endpoint) {
                const retryResult = await window.electronAPI.djangoService.apiCall(
                  context.endpoint,
                  context.method,
                  context.data
                );
                
                if (retryResult.success) {
                  console.log('Network error recovery successful');
                  return { recovered: true, result: retryResult };
                }
              }
            }
          }
        } else {
          // Service is healthy, might be a temporary network issue
          console.log('Backend service is healthy, retrying request...');
          if (context.endpoint) {
            // Wait a moment and retry
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const retryResult = await window.electronAPI.djangoService.apiCall(
              context.endpoint,
              context.method,
              context.data
            );
            
            if (retryResult.success) {
              console.log('Network error recovery successful on retry');
              return { recovered: true, result: retryResult };
            }
          }
        }
      }
      
      // Check if we should enable offline mode
      if (!navigator.onLine) {
        console.log('Device is offline, enabling offline mode');
        this.enableOfflineMode(context);
        return { recovered: false, offlineMode: true };
      }
      
    } catch (e) {
      console.warn('Network error recovery failed:', e);
    }

    return { recovered: false };
  }

  async handleTimeoutError(error, context) {
    console.log('Attempting timeout error recovery...');
    
    // For timeout errors, try the request again with a longer timeout
    try {
      if (context.endpoint && window.electronAPI?.djangoService?.apiCall) {
        // Wait a moment before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const retryResult = await window.electronAPI.djangoService.apiCall(
          context.endpoint,
          context.method,
          context.data
        );
        
        if (retryResult.success) {
          console.log('Timeout error recovery successful');
          return { recovered: true, result: retryResult };
        }
      }
    } catch (e) {
      console.warn('Timeout error recovery failed:', e);
    }

    return { recovered: false };
  }

  handleComponentError(error, componentName, props) {
    return this.logError({
      type: 'component_error',
      error,
      componentName,
      props: JSON.stringify(props, null, 2),
      timestamp: Date.now()
    });
  }

  handleServiceError(error, serviceName, operation) {
    return this.logError({
      type: 'service_error',
      error,
      serviceName,
      operation,
      timestamp: Date.now()
    });
  }

  // Error analysis and reporting
  getErrorStats() {
    const stats = {
      total: this.errorLog.length,
      byType: {},
      recent: 0,
      critical: 0
    };

    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    this.errorLog.forEach(error => {
      // Count by type
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      
      // Count recent errors
      if (error.timestamp > oneHourAgo) {
        stats.recent++;
      }
      
      // Count critical errors
      if (this.isCriticalError(error)) {
        stats.critical++;
      }
    });

    return stats;
  }

  isCriticalError(error) {
    const criticalTypes = ['unhandled_promise_rejection', 'javascript_error'];
    const criticalMessages = ['Cannot read property', 'is not a function', 'ReferenceError'];
    
    if (criticalTypes.includes(error.type)) {
      return true;
    }
    
    const message = error.error?.message || error.message || '';
    return criticalMessages.some(pattern => message.includes(pattern));
  }

  getRecentErrors(limit = 10) {
    return this.errorLog.slice(0, limit);
  }

  clearErrorLog() {
    this.errorLog = [];
    try {
      localStorage.removeItem('sideeye_error_log');
    } catch (e) {
      console.warn('Failed to clear error log from localStorage:', e);
    }
  }

  exportErrorLog() {
    const exportData = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      errors: this.errorLog,
      stats: this.getErrorStats()
    };

    return JSON.stringify(exportData, null, 2);
  }

  // Enable offline mode functionality
  enableOfflineMode(context) {
    console.log('Enabling offline mode for context:', context);
    
    // Trigger offline mode callbacks
    this.triggerErrorCallbacks({
      type: 'offline_mode_enabled',
      context,
      timestamp: Date.now()
    });
    
    // Store offline context for recovery when back online
    try {
      const offlineData = {
        timestamp: Date.now(),
        context,
        reason: 'network_error'
      };
      localStorage.setItem('sideeye_offline_context', JSON.stringify(offlineData));
    } catch (e) {
      console.warn('Failed to store offline context:', e);
    }
  }

  // Handle memory pressure and cleanup
  handleMemoryPressure() {
    console.log('Handling memory pressure - cleaning up resources');
    
    try {
      // Reduce error log size
      if (this.errorLog.length > 100) {
        this.errorLog = this.errorLog.slice(0, 100);
        console.log('Reduced error log size due to memory pressure');
      }
      
      // Clear old localStorage entries
      const keysToCheck = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sideeye_temp_')) {
          keysToCheck.push(key);
        }
      }
      
      keysToCheck.forEach(key => {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          const age = Date.now() - (data.timestamp || 0);
          if (age > 24 * 60 * 60 * 1000) { // 24 hours
            localStorage.removeItem(key);
          }
        } catch (e) {
          localStorage.removeItem(key); // Remove corrupted entries
        }
      });
      
      // Force garbage collection if available
      if (window.gc) {
        window.gc();
      }
      
      return true;
    } catch (e) {
      console.error('Memory pressure handling failed:', e);
      return false;
    }
  }

  // Handle service degradation
  handleServiceDegradation(serviceName, error) {
    console.log(`Handling service degradation for ${serviceName}:`, error);
    
    const degradationData = {
      type: 'service_degradation',
      serviceName,
      error,
      timestamp: Date.now(),
      recoveryActions: this.getServiceRecoveryActions(serviceName)
    };
    
    this.logError(degradationData);
    
    // Attempt service-specific recovery
    return this.attemptServiceRecovery(serviceName, error);
  }

  getServiceRecoveryActions(serviceName) {
    const recoveryActions = {
      'emotion_detection': [
        'Switch to manual emotion input',
        'Reduce detection frequency',
        'Clear emotion cache',
        'Reset camera permissions'
      ],
      'music_recommendation': [
        'Use cached playlists',
        'Switch to manual playlist selection',
        'Clear YouTube API cache',
        'Use offline music preferences'
      ],
      'theme_management': [
        'Use default theme',
        'Disable automatic theme switching',
        'Clear theme cache',
        'Reset CLI hooks'
      ],
      'task_management': [
        'Use manual task sorting',
        'Disable energy-based recommendations',
        'Clear task cache',
        'Switch to simple task list'
      ],
      'notification': [
        'Disable automatic notifications',
        'Use basic notification system',
        'Clear notification queue',
        'Reset rate limiting'
      ]
    };
    
    return recoveryActions[serviceName] || [
      'Restart service',
      'Clear service cache',
      'Use fallback functionality',
      'Check service configuration'
    ];
  }

  async attemptServiceRecovery(serviceName, error) {
    console.log(`Attempting recovery for service: ${serviceName}`);
    
    try {
      // Service-specific recovery strategies
      switch (serviceName) {
        case 'emotion_detection':
          return await this.recoverEmotionDetection(error);
        case 'music_recommendation':
          return await this.recoverMusicRecommendation(error);
        case 'theme_management':
          return await this.recoverThemeManagement(error);
        case 'task_management':
          return await this.recoverTaskManagement(error);
        case 'notification':
          return await this.recoverNotificationService(error);
        default:
          return await this.genericServiceRecovery(serviceName, error);
      }
    } catch (recoveryError) {
      console.error(`Service recovery failed for ${serviceName}:`, recoveryError);
      return false;
    }
  }

  async recoverEmotionDetection(error) {
    // Clear emotion detection cache
    try {
      const cacheKeys = Object.keys(localStorage).filter(key => 
        key.includes('emotion') || key.includes('camera')
      );
      cacheKeys.forEach(key => localStorage.removeItem(key));
      
      // Reset camera permissions if needed
      if (error.message.includes('permission') || error.message.includes('camera')) {
        console.log('Camera permission issue detected - user intervention required');
        return false; // Requires user action
      }
      
      console.log('Emotion detection recovery completed');
      return true;
    } catch (e) {
      console.error('Emotion detection recovery failed:', e);
      return false;
    }
  }

  async recoverMusicRecommendation(error) {
    // Clear music cache and reset to defaults
    try {
      const musicKeys = Object.keys(localStorage).filter(key => 
        key.includes('music') || key.includes('playlist') || key.includes('youtube')
      );
      musicKeys.forEach(key => localStorage.removeItem(key));
      
      console.log('Music recommendation recovery completed');
      return true;
    } catch (e) {
      console.error('Music recommendation recovery failed:', e);
      return false;
    }
  }

  async recoverThemeManagement(error) {
    // Reset theme to default and clear CLI hooks
    try {
      const themeKeys = Object.keys(localStorage).filter(key => 
        key.includes('theme') || key.includes('cli')
      );
      themeKeys.forEach(key => localStorage.removeItem(key));
      
      console.log('Theme management recovery completed');
      return true;
    } catch (e) {
      console.error('Theme management recovery failed:', e);
      return false;
    }
  }

  async recoverTaskManagement(error) {
    // Clear task cache and reset to manual sorting
    try {
      const taskKeys = Object.keys(localStorage).filter(key => 
        key.includes('task') || key.includes('energy')
      );
      taskKeys.forEach(key => localStorage.removeItem(key));
      
      console.log('Task management recovery completed');
      return true;
    } catch (e) {
      console.error('Task management recovery failed:', e);
      return false;
    }
  }

  async recoverNotificationService(error) {
    // Clear notification queue and reset rate limiting
    try {
      const notificationKeys = Object.keys(localStorage).filter(key => 
        key.includes('notification') || key.includes('rate_limit')
      );
      notificationKeys.forEach(key => localStorage.removeItem(key));
      
      console.log('Notification service recovery completed');
      return true;
    } catch (e) {
      console.error('Notification service recovery failed:', e);
      return false;
    }
  }

  async genericServiceRecovery(serviceName, error) {
    // Generic recovery for unknown services
    try {
      // Clear any cache related to the service
      const serviceKeys = Object.keys(localStorage).filter(key => 
        key.toLowerCase().includes(serviceName.toLowerCase())
      );
      serviceKeys.forEach(key => localStorage.removeItem(key));
      
      console.log(`Generic recovery completed for service: ${serviceName}`);
      return true;
    } catch (e) {
      console.error(`Generic recovery failed for service ${serviceName}:`, e);
      return false;
    }
  }

  // Enhanced error reporting with user-friendly messages
  getUserFriendlyErrorMessage(error) {
    const errorType = error.type || 'unknown';
    const errorMessage = error.error?.message || error.message || '';
    
    const friendlyMessages = {
      'network_error': 'Connection issue detected. The app will continue working offline.',
      'api_error': 'Service temporarily unavailable. Your data is safe and will sync when connection is restored.',
      'component_error': 'A display issue occurred. The app is attempting to recover automatically.',
      'javascript_error': 'An unexpected error occurred. The app is working to resolve this.',
      'resource_error': 'Failed to load a resource. The app will use cached data instead.',
      'unhandled_promise_rejection': 'A background operation failed. The app will retry automatically.',
      'service_degradation': 'Some features may be temporarily limited. Core functionality remains available.',
      'memory_error': 'System resources are low. The app is optimizing performance.',
      'permission_error': 'Permission required for this feature. Please check your browser settings.',
      'offline_mode_enabled': 'You are now working offline. Changes will sync when connection is restored.'
    };
    
    // Check for specific error patterns
    if (errorMessage.includes('camera') || errorMessage.includes('permission')) {
      return 'Camera access is needed for emotion detection. Please allow camera permissions in your browser.';
    }
    
    if (errorMessage.includes('fetch') || errorMessage.includes('Network')) {
      return 'Connection lost. The app is working offline and will reconnect automatically.';
    }
    
    if (errorMessage.includes('memory') || errorMessage.includes('Maximum call stack')) {
      return 'System resources are low. The app is optimizing performance and clearing unnecessary data.';
    }
    
    if (errorMessage.includes('Loading chunk')) {
      return 'App update detected. Please refresh the page to get the latest version.';
    }
    
    return friendlyMessages[errorType] || 'An issue occurred, but the app is working to resolve it automatically.';
  }

  // Load error log from localStorage on initialization
  loadPersistedErrors() {
    try {
      const storedErrors = localStorage.getItem('sideeye_error_log');
      if (storedErrors) {
        this.errorLog = JSON.parse(storedErrors);
        console.log(`Loaded ${this.errorLog.length} persisted errors`);
      }
    } catch (e) {
      console.warn('Failed to load persisted error log:', e);
    }
  }
}

// Create singleton instance
const errorHandlerService = new ErrorHandlerService();

// Load persisted errors
errorHandlerService.loadPersistedErrors();

// Register default recovery strategies
errorHandlerService.registerRecoveryStrategy('api_error', async (errorData) => {
  // Default API error recovery
  return errorHandlerService.handleAPIError(errorData.error, errorData.endpoint, errorData.method, errorData.data);
});

export default errorHandlerService;