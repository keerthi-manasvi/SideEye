import React from 'react';
import './ErrorBoundary.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
      isRecovering: false,
      recoveryStatus: null,
      offlineMode: false
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      errorId: Date.now().toString(36) + Math.random().toString(36).substr(2)
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Report error to logging service if available
    this.reportError(error, errorInfo);

    // Check if we're offline
    this.checkOfflineStatus();

    // Attempt automatic recovery for certain error types
    this.attemptAutomaticRecovery(error, errorInfo);
  }

  reportError = (error, errorInfo) => {
    try {
      // Log to console for development
      console.group(`🚨 Error Report [${this.state.errorId}]`);
      console.error('Error:', error);
      console.error('Component Stack:', errorInfo.componentStack);
      console.error('Error Stack:', error.stack);
      console.groupEnd();

      // Send to backend logging if available
      if (window.electronAPI?.djangoService?.apiCall) {
        window.electronAPI.djangoService.apiCall('/errors/', 'POST', {
          error_id: this.state.errorId,
          error_message: error.message,
          error_stack: error.stack,
          component_stack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
          url: window.location.href,
          retry_count: this.state.retryCount
        }).catch(err => {
          console.warn('Failed to report error to backend:', err);
        });
      }
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: prevState.retryCount + 1
    }));
  };

  handleReload = () => {
    window.location.reload();
  };

  handleReportIssue = () => {
    const errorReport = {
      errorId: this.state.errorId,
      message: this.state.error?.message,
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      retryCount: this.state.retryCount
    };

    // Copy error report to clipboard
    navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2))
      .then(() => {
        alert('Error report copied to clipboard. Please share this with support.');
      })
      .catch(() => {
        // Fallback: show error report in alert
        alert(`Error Report:\n${JSON.stringify(errorReport, null, 2)}`);
      });
  };

  getErrorSeverity = () => {
    const error = this.state.error;
    if (!error) return 'low';

    // Determine severity based on error type and message
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      return 'medium'; // Network/loading issues
    }
    if (error.message.includes('Network Error') || error.message.includes('fetch')) {
      return 'medium'; // API/network issues
    }
    if (error.name === 'TypeError' && error.message.includes('Cannot read property')) {
      return 'high'; // Data structure issues
    }
    if (error.name === 'ReferenceError') {
      return 'high'; // Code issues
    }
    
    return 'medium'; // Default severity
  };

  checkOfflineStatus = () => {
    const isOffline = !navigator.onLine;
    this.setState({ offlineMode: isOffline });
    
    if (isOffline) {
      console.warn('Application is offline - some recovery options may be limited');
    }
  };

  attemptAutomaticRecovery = async (error, errorInfo) => {
    // Don't attempt recovery if already recovering or too many retries
    if (this.state.isRecovering || this.state.retryCount >= 3) {
      return;
    }

    this.setState({ isRecovering: true, recoveryStatus: 'attempting' });

    try {
      // Automatic recovery for specific error types
      if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
        // For chunk loading errors, wait a moment and try to reload
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (this.state.retryCount === 0) {
          // First attempt: try to recover without full reload
          this.setState({ 
            isRecovering: false, 
            recoveryStatus: 'success',
            hasError: false,
            error: null,
            errorInfo: null
          });
          return;
        }
      }

      // Network error recovery with service restart
      if (error.message.includes('fetch') || error.message.includes('Network')) {
        const recovered = await this.attemptNetworkRecovery();
        if (recovered) {
          this.setState({ 
            isRecovering: false, 
            recoveryStatus: 'success',
            hasError: false,
            error: null,
            errorInfo: null
          });
          return;
        }
      }

      // Memory error recovery
      if (error.message.includes('memory') || error.message.includes('Maximum call stack')) {
        const recovered = await this.attemptMemoryRecovery();
        if (recovered) {
          this.setState({ 
            isRecovering: false, 
            recoveryStatus: 'success',
            hasError: false,
            error: null,
            errorInfo: null
          });
          return;
        }
      }

      // Component state corruption recovery
      if (error.name === 'TypeError' && error.message.includes('Cannot read property')) {
        const recovered = await this.attemptStateRecovery();
        if (recovered) {
          this.setState({ 
            isRecovering: false, 
            recoveryStatus: 'success',
            hasError: false,
            error: null,
            errorInfo: null
          });
          return;
        }
      }

      // Enhanced graceful degradation for critical services
      if (this.shouldEnableGracefulDegradation(error)) {
        const degradationResult = await this.enableGracefulDegradation(error);
        if (degradationResult.success) {
          this.setState({ 
            isRecovering: false, 
            recoveryStatus: 'degraded',
            hasError: false,
            error: null,
            errorInfo: null,
            degradationMode: degradationResult.mode,
            degradationMessage: degradationResult.message
          });
          return;
        }
      }

      // If we get here, automatic recovery failed
      this.setState({ 
        isRecovering: false, 
        recoveryStatus: 'failed' 
      });

    } catch (recoveryError) {
      console.error('Automatic recovery failed:', recoveryError);
      this.setState({ 
        isRecovering: false, 
        recoveryStatus: 'failed' 
      });
    }
  };

  attemptNetworkRecovery = async () => {
    try {
      // Check if backend service is available
      if (window.electronAPI?.djangoService?.healthCheck) {
        const healthResult = await window.electronAPI.djangoService.healthCheck();
        
        if (healthResult.healthy) {
          console.log('Backend service is healthy - network recovery successful');
          return true;
        } else {
          // Try to restart the service
          console.log('Backend service unhealthy - attempting restart');
          const restartResult = await window.electronAPI.djangoService.restart();
          
          if (restartResult.success) {
            // Wait for service to be ready
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Verify service is now healthy
            const verifyResult = await window.electronAPI.djangoService.healthCheck();
            if (verifyResult.healthy) {
              console.log('Backend service restart successful');
              return true;
            }
          }
        }
      }
      
      // Check general network connectivity
      if (navigator.onLine) {
        console.log('Network connectivity available - recovery possible');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Network recovery failed:', error);
      return false;
    }
  };

  attemptMemoryRecovery = async () => {
    try {
      // Force garbage collection if available
      if (window.gc) {
        window.gc();
      }
      
      // Clear non-essential caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }
      
      // Clear localStorage of non-essential data
      const keysToKeep = ['sideeye_user_preferences', 'sideeye_error_log'];
      const keysToRemove = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !keysToKeep.includes(key)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      console.log('Memory recovery completed - cleared caches and non-essential data');
      return true;
    } catch (error) {
      console.error('Memory recovery failed:', error);
      return false;
    }
  };

  attemptStateRecovery = async () => {
    try {
      // Reset component state to initial values
      const initialState = {
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
        retryCount: this.state.retryCount + 1,
        isRecovering: false,
        recoveryStatus: null,
        offlineMode: !navigator.onLine
      };
      
      // Clear any corrupted local storage data
      try {
        const testKey = 'sideeye_state_test';
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
      } catch (storageError) {
        console.warn('localStorage appears corrupted, clearing all data');
        localStorage.clear();
      }
      
      console.log('Component state recovery completed');
      return true;
    } catch (error) {
      console.error('State recovery failed:', error);
      return false;
    }
  };

  shouldEnableGracefulDegradation = (error) => {
    // Check if error affects critical services that should degrade gracefully
    const criticalServiceErrors = [
      'emotion_detection',
      'music_recommendation', 
      'theme_management',
      'task_management',
      'notification_service'
    ];

    const errorMessage = error.message.toLowerCase();
    const errorStack = error.stack?.toLowerCase() || '';

    // Check if error is related to critical services
    return criticalServiceErrors.some(service => 
      errorMessage.includes(service) || 
      errorStack.includes(service) ||
      errorMessage.includes('camera') ||
      errorMessage.includes('youtube') ||
      errorMessage.includes('api')
    );
  };

  enableGracefulDegradation = async (error) => {
    try {
      const errorMessage = error.message.toLowerCase();
      let degradationMode = 'partial';
      let message = 'Some features are temporarily limited';

      // Determine degradation strategy based on error type
      if (errorMessage.includes('camera') || errorMessage.includes('emotion')) {
        // Emotion detection degradation
        degradationMode = 'emotion_manual';
        message = 'Emotion detection unavailable - switched to manual mode';
        
        // Enable manual emotion input mode
        if (window.electronAPI?.djangoService?.apiCall) {
          await window.electronAPI.djangoService.apiCall('/preferences/', 'PATCH', {
            emotion_detection_mode: 'manual',
            degradation_reason: 'camera_error'
          });
        }
      } else if (errorMessage.includes('youtube') || errorMessage.includes('music')) {
        // Music recommendation degradation
        degradationMode = 'music_offline';
        message = 'Music recommendations unavailable - using cached playlists';
        
        // Switch to offline music mode
        if (window.electronAPI?.djangoService?.apiCall) {
          await window.electronAPI.djangoService.apiCall('/preferences/', 'PATCH', {
            music_mode: 'offline',
            degradation_reason: 'youtube_api_error'
          });
        }
      } else if (errorMessage.includes('theme') || errorMessage.includes('cli')) {
        // Theme management degradation
        degradationMode = 'theme_basic';
        message = 'Theme switching unavailable - using default theme';
        
        // Switch to basic theme mode
        if (window.electronAPI?.djangoService?.apiCall) {
          await window.electronAPI.djangoService.apiCall('/preferences/', 'PATCH', {
            theme_mode: 'basic',
            degradation_reason: 'cli_hook_error'
          });
        }
      } else if (errorMessage.includes('task') || errorMessage.includes('energy')) {
        // Task management degradation
        degradationMode = 'task_manual';
        message = 'Energy-based task sorting unavailable - using manual sorting';
        
        // Switch to manual task mode
        if (window.electronAPI?.djangoService?.apiCall) {
          await window.electronAPI.djangoService.apiCall('/preferences/', 'PATCH', {
            task_sorting_mode: 'manual',
            degradation_reason: 'energy_analysis_error'
          });
        }
      } else if (errorMessage.includes('notification') || errorMessage.includes('alert')) {
        // Notification service degradation
        degradationMode = 'notification_basic';
        message = 'Smart notifications unavailable - using basic alerts';
        
        // Switch to basic notification mode
        if (window.electronAPI?.djangoService?.apiCall) {
          await window.electronAPI.djangoService.apiCall('/preferences/', 'PATCH', {
            notification_mode: 'basic',
            degradation_reason: 'notification_service_error'
          });
        }
      }

      // Store degradation state in localStorage for persistence
      try {
        const degradationState = {
          mode: degradationMode,
          message: message,
          timestamp: new Date().toISOString(),
          originalError: error.message
        };
        localStorage.setItem('sideeye_degradation_state', JSON.stringify(degradationState));
      } catch (storageError) {
        console.warn('Failed to store degradation state:', storageError);
      }

      console.log(`Graceful degradation enabled: ${degradationMode}`);
      
      return {
        success: true,
        mode: degradationMode,
        message: message
      };
    } catch (degradationError) {
      console.error('Failed to enable graceful degradation:', degradationError);
      return {
        success: false,
        error: degradationError.message
      };
    }
  };

  getRecoveryActions = () => {
    const error = this.state.error;
    const severity = this.getErrorSeverity();
    
    const actions = [];

    // Always offer retry for first few attempts
    if (this.state.retryCount < 3) {
      actions.push({
        label: 'Try Again',
        action: this.handleRetry,
        primary: true,
        description: 'Attempt to recover from the error'
      });
    }

    // Network-related errors
    if (error?.message.includes('fetch') || error?.message.includes('Network')) {
      actions.push({
        label: 'Check Connection',
        action: () => {
          if (window.electronAPI?.djangoService?.healthCheck) {
            window.electronAPI.djangoService.healthCheck()
              .then(result => {
                if (result.healthy) {
                  alert('Backend service is healthy. Try refreshing the page.');
                } else {
                  alert('Backend service is not responding. Please restart the application.');
                }
              });
          }
        },
        description: 'Check if the backend service is running'
      });
    }

    // Chunk loading errors (common in development)
    if (error?.name === 'ChunkLoadError') {
      actions.push({
        label: 'Reload Page',
        action: this.handleReload,
        description: 'Reload the page to fetch updated code'
      });
    }

    // High severity errors
    if (severity === 'high') {
      actions.push({
        label: 'Report Issue',
        action: this.handleReportIssue,
        description: 'Copy error details to share with support'
      });
    }

    // Always offer page reload as last resort
    if (!actions.some(a => a.action === this.handleReload)) {
      actions.push({
        label: 'Reload Application',
        action: this.handleReload,
        description: 'Reload the entire application'
      });
    }

    return actions;
  };

  getRecoverySuggestions = () => {
    const error = this.state.error;
    const suggestions = [];

    if (!error) return suggestions;

    // Network/API related suggestions
    if (error.message.includes('fetch') || error.message.includes('Network')) {
      suggestions.push('Check your internet connection');
      suggestions.push('Verify the backend service is running');
      if (this.state.offlineMode) {
        suggestions.push('Wait for internet connection to be restored');
      }
    }

    // Chunk loading error suggestions
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      suggestions.push('Clear your browser cache and reload');
      suggestions.push('Check if you have the latest version of the application');
      suggestions.push('Try using a different browser or incognito mode');
    }

    // JavaScript error suggestions
    if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      suggestions.push('This appears to be a code issue - please report it');
      suggestions.push('Try refreshing the page to reset the application state');
    }

    // Memory/performance related suggestions
    if (error.message.includes('memory') || error.message.includes('Maximum call stack')) {
      suggestions.push('Close other browser tabs to free up memory');
      suggestions.push('Restart your browser');
      suggestions.push('Check if your system has sufficient memory available');
    }

    // Permission/security related suggestions
    if (error.message.includes('permission') || error.message.includes('blocked')) {
      suggestions.push('Check browser permissions for this application');
      suggestions.push('Disable browser extensions that might interfere');
      suggestions.push('Try running in incognito/private mode');
    }

    // General suggestions if no specific ones apply
    if (suggestions.length === 0) {
      suggestions.push('Try refreshing the page');
      suggestions.push('Clear browser cache and cookies');
      suggestions.push('Check browser console for additional error details');
    }

    return suggestions;
  };

  render() {
    if (this.state.hasError) {
      const severity = this.getErrorSeverity();
      const actions = this.getRecoveryActions();
      const error = this.state.error;

      return (
        <div className={`error-boundary error-boundary--${severity}`}>
          <div className="error-boundary__container">
            <div className="error-boundary__icon">
              {severity === 'high' ? '🚨' : severity === 'medium' ? '⚠️' : 'ℹ️'}
            </div>
            
            <div className="error-boundary__content">
              <h2 className="error-boundary__title">
                {severity === 'high' ? 'Critical Error' : 
                 severity === 'medium' ? 'Something went wrong' : 
                 'Minor Issue Detected'}
              </h2>
              
              <p className="error-boundary__message">
                {error?.message || 'An unexpected error occurred in the application.'}
              </p>

              {this.state.retryCount > 0 && (
                <p className="error-boundary__retry-info">
                  Retry attempts: {this.state.retryCount}
                </p>
              )}

              {this.state.isRecovering && (
                <div className="error-boundary__recovery-status error-boundary__recovery-status--attempting">
                  <span className="error-boundary__loading"></span>
                  Attempting automatic recovery...
                </div>
              )}

              {this.state.recoveryStatus === 'success' && (
                <div className="error-boundary__recovery-status error-boundary__recovery-status--success">
                  ✅ Automatic recovery successful
                </div>
              )}

              {this.state.recoveryStatus === 'failed' && (
                <div className="error-boundary__recovery-status error-boundary__recovery-status--failed">
                  ❌ Automatic recovery failed - manual intervention required
                </div>
              )}

              {this.state.recoveryStatus === 'degraded' && (
                <div className="error-boundary__recovery-status error-boundary__recovery-status--degraded">
                  🔧 {this.state.degradationMessage || 'System running in degraded mode'}
                </div>
              )}

              {this.state.offlineMode && (
                <div className="error-boundary__offline-indicator">
                  Application is currently offline - some recovery options may be limited
                </div>
              )}

              <div className="error-boundary__actions">
                {actions.map((action, index) => (
                  <button
                    key={index}
                    onClick={action.action}
                    className={`error-boundary__button ${action.primary ? 'error-boundary__button--primary' : ''} ${action.danger ? 'error-boundary__button--danger' : ''} ${action.warning ? 'error-boundary__button--warning' : ''}`}
                    title={action.description}
                    disabled={this.state.isRecovering}
                  >
                    {action.label}
                  </button>
                ))}
              </div>

              {this.getRecoverySuggestions().length > 0 && (
                <div className="error-boundary__suggestions">
                  <h4>Recovery Suggestions:</h4>
                  <ul>
                    {this.getRecoverySuggestions().map((suggestion, index) => (
                      <li key={index}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}

              {process.env.NODE_ENV === 'development' && (
                <details className="error-boundary__details">
                  <summary>Error Details (Development)</summary>
                  <div className="error-boundary__error-info">
                    <h4>Error ID: {this.state.errorId}</h4>
                    <h4>Error Stack:</h4>
                    <pre>{error?.stack}</pre>
                    <h4>Component Stack:</h4>
                    <pre>{this.state.errorInfo?.componentStack}</pre>
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;