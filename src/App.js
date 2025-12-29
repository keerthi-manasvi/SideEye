import React, { useState, useEffect } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import SettingsPanel from './components/SettingsPanel';
import TaskList from './components/TaskList';
import PrivacyControls from './components/PrivacyControls';
import ErrorBoundary from './components/ErrorBoundary';
import useOfflineMode from './hooks/useOfflineMode';
import errorHandlerService from './services/ErrorHandlerService';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [isElectron, setIsElectron] = useState(false);
  const [systemHealth, setSystemHealth] = useState(null);
  
  // Use offline mode hook
  const {
    isOnline,
    isBackendOnline,
    isFullyOnline,
    queuedRequests,
    makeOfflineCapableRequest,
    getOfflineStatus
  } = useOfflineMode();

  useEffect(() => {
    // Check if running in Electron
    setIsElectron(window.electronAPI !== undefined);
    
    // Setup error handling
    setupErrorHandling();
    
    // Check system health periodically
    checkSystemHealth();
    const healthInterval = setInterval(checkSystemHealth, 60000); // Every minute
    
    return () => {
      clearInterval(healthInterval);
    };
  }, []);

  const setupErrorHandling = () => {
    // Register error callbacks for different error types
    errorHandlerService.registerErrorCallback('api_error', (error) => {
      console.warn('API Error detected:', error);
      // Could show user notification here
    });

    errorHandlerService.registerErrorCallback('component_error', (error) => {
      console.warn('Component Error detected:', error);
    });

    // Register global error callback
    errorHandlerService.registerErrorCallback('*', (error) => {
      if (error.severity === 'critical') {
        console.error('Critical error detected:', error);
        // Could trigger emergency recovery here
      }
    });
  };

  const checkSystemHealth = async () => {
    try {
      const result = await makeOfflineCapableRequest('/system-health/', 'GET', null, {
        queueIfOffline: false
      });
      
      if (result.success) {
        setSystemHealth(result.data);
      } else if (!result.offline) {
        console.warn('System health check failed:', result.error);
      }
    } catch (error) {
      errorHandlerService.handleAPIError(error, '/system-health/', 'GET');
    }
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <ErrorBoundary>
            <Dashboard />
          </ErrorBoundary>
        );
      case 'settings':
        return (
          <ErrorBoundary>
            <SettingsPanel />
          </ErrorBoundary>
        );
      case 'tasks':
        return (
          <ErrorBoundary>
            <TaskList />
          </ErrorBoundary>
        );
      case 'privacy':
        return (
          <ErrorBoundary>
            <PrivacyControls />
          </ErrorBoundary>
        );
      default:
        return (
          <ErrorBoundary>
            <Dashboard />
          </ErrorBoundary>
        );
    }
  };

  const getConnectionStatusIndicator = () => {
    if (!isOnline) {
      return { text: 'Offline', color: '#ff4444' };
    } else if (!isBackendOnline) {
      return { text: 'Backend Unavailable', color: '#ff8800' };
    } else if (queuedRequests > 0) {
      return { text: `${queuedRequests} Queued`, color: '#ffaa00' };
    } else {
      return { text: 'Online', color: '#44ff44' };
    }
  };

  const connectionStatus = getConnectionStatusIndicator();

  return (
    <ErrorBoundary>
      <div className="App">
        <header className="App-header">
          <nav className="navigation">
            <div className="nav-brand">
              <h1>SideEye</h1>
              <div 
                className="connection-status" 
                style={{ 
                  color: connectionStatus.color, 
                  fontSize: '0.8rem',
                  marginLeft: '10px'
                }}
              >
                {connectionStatus.text}
              </div>
            </div>
            <div className="nav-links">
              <button 
                className={currentView === 'dashboard' ? 'active' : ''}
                onClick={() => setCurrentView('dashboard')}
              >
                Dashboard
              </button>
              <button 
                className={currentView === 'tasks' ? 'active' : ''}
                onClick={() => setCurrentView('tasks')}
              >
                Tasks
              </button>
              <button 
                className={currentView === 'settings' ? 'active' : ''}
                onClick={() => setCurrentView('settings')}
              >
                Settings
              </button>
              <button 
                className={currentView === 'privacy' ? 'active' : ''}
                onClick={() => setCurrentView('privacy')}
              >
                Privacy
              </button>
            </div>
          </nav>
        </header>
        
        <main className="App-main">
          {renderCurrentView()}
        </main>
        
        <footer className="App-footer">
          <p>
            {isElectron ? 'Running in Electron' : 'Running in Browser'} | 
            Privacy-focused local processing
            {systemHealth && systemHealth.status !== 'healthy' && (
              <span style={{ color: '#ff8800', marginLeft: '10px' }}>
                | System: {systemHealth.status}
              </span>
            )}
          </p>
        </footer>
      </div>
    </ErrorBoundary>
  );
}

export default App;