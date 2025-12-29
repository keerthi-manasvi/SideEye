import React, { useState, useEffect } from 'react';
import './ServiceStatus.css';

const ServiceStatus = () => {
  const [serviceStatus, setServiceStatus] = useState({
    isRunning: false,
    isStarting: false,
    isStopping: false,
    restartAttempts: 0,
    lastHealthCheck: null,
    pid: null,
    uptime: 0
  });
  const [statusMessage, setStatusMessage] = useState('Checking service status...');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Set up service status listener
    if (window.electronAPI?.djangoService?.onStatusUpdate) {
      window.electronAPI.djangoService.onStatusUpdate((data) => {
        setStatusMessage(`Service status: ${data.status}`);
        if (data.error) {
          setError(data.error);
        } else {
          setError(null);
        }
      });
    }

    // Get initial status
    checkServiceStatus();

    // Set up periodic status checks
    const statusInterval = setInterval(checkServiceStatus, 5000);

    return () => {
      clearInterval(statusInterval);
      if (window.electronAPI?.djangoService?.removeStatusListener) {
        window.electronAPI.djangoService.removeStatusListener();
      }
    };
  }, []);

  const checkServiceStatus = async () => {
    if (!window.electronAPI?.djangoService?.getStatus) {
      setError('Django service API not available');
      return;
    }

    try {
      const result = await window.electronAPI.djangoService.getStatus();
      if (result.success) {
        setServiceStatus(result.status);
        setError(null);
      } else {
        setError(result.error || 'Failed to get service status');
      }
    } catch (err) {
      setError(`Error checking service status: ${err.message}`);
    }
  };

  const handleStartService = async () => {
    if (!window.electronAPI?.djangoService?.start) {
      setError('Django service API not available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.djangoService.start();
      if (result.success) {
        setStatusMessage('Service start initiated');
        await checkServiceStatus();
      } else {
        setError(result.error || 'Failed to start service');
      }
    } catch (err) {
      setError(`Error starting service: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopService = async () => {
    if (!window.electronAPI?.djangoService?.stop) {
      setError('Django service API not available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.djangoService.stop();
      if (result.success) {
        setStatusMessage('Service stop initiated');
        await checkServiceStatus();
      } else {
        setError(result.error || 'Failed to stop service');
      }
    } catch (err) {
      setError(`Error stopping service: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestartService = async () => {
    if (!window.electronAPI?.djangoService?.restart) {
      setError('Django service API not available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.djangoService.restart();
      if (result.success) {
        setStatusMessage('Service restart initiated');
        await checkServiceStatus();
      } else {
        setError(result.error || 'Failed to restart service');
      }
    } catch (err) {
      setError(`Error restarting service: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHealthCheck = async () => {
    if (!window.electronAPI?.djangoService?.healthCheck) {
      setError('Django service API not available');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.djangoService.healthCheck();
      if (result.success) {
        setStatusMessage(`Health check: ${result.healthy ? 'Healthy' : 'Unhealthy'}`);
        await checkServiceStatus();
      } else {
        setError(result.error || 'Health check failed');
      }
    } catch (err) {
      setError(`Error during health check: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = () => {
    if (serviceStatus.isStarting || serviceStatus.isStopping) return 'orange';
    if (serviceStatus.isRunning) return 'green';
    return 'red';
  };

  const getStatusText = () => {
    if (serviceStatus.isStarting) return 'Starting...';
    if (serviceStatus.isStopping) return 'Stopping...';
    if (serviceStatus.isRunning) return 'Running';
    return 'Stopped';
  };

  const formatUptime = (uptime) => {
    if (!uptime) return 'N/A';
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="service-status">
      <div className="service-status-header">
        <h3>Django Service Status</h3>
        <div className={`status-indicator ${getStatusColor()}`}>
          {getStatusText()}
        </div>
      </div>

      <div className="service-status-details">
        <div className="status-row">
          <span className="status-label">Process ID:</span>
          <span className="status-value">{serviceStatus.pid || 'N/A'}</span>
        </div>
        <div className="status-row">
          <span className="status-label">Uptime:</span>
          <span className="status-value">{formatUptime(serviceStatus.uptime)}</span>
        </div>
        <div className="status-row">
          <span className="status-label">Restart Attempts:</span>
          <span className="status-value">{serviceStatus.restartAttempts}</span>
        </div>
        <div className="status-row">
          <span className="status-label">Last Health Check:</span>
          <span className="status-value">
            {serviceStatus.lastHealthCheck ? (
              <>
                {formatTimestamp(serviceStatus.lastHealthCheck.timestamp)} - 
                {serviceStatus.lastHealthCheck.healthy ? ' Healthy' : ' Unhealthy'}
              </>
            ) : 'Never'}
          </span>
        </div>
      </div>

      <div className="service-status-message">
        <p>{statusMessage}</p>
        {error && <p className="error-message">Error: {error}</p>}
      </div>

      <div className="service-controls">
        <button 
          onClick={handleStartService}
          disabled={isLoading || serviceStatus.isRunning || serviceStatus.isStarting}
          className="btn btn-start"
        >
          {isLoading ? 'Starting...' : 'Start Service'}
        </button>
        
        <button 
          onClick={handleStopService}
          disabled={isLoading || !serviceStatus.isRunning || serviceStatus.isStopping}
          className="btn btn-stop"
        >
          {isLoading ? 'Stopping...' : 'Stop Service'}
        </button>
        
        <button 
          onClick={handleRestartService}
          disabled={isLoading || serviceStatus.isStarting || serviceStatus.isStopping}
          className="btn btn-restart"
        >
          {isLoading ? 'Restarting...' : 'Restart Service'}
        </button>
        
        <button 
          onClick={handleHealthCheck}
          disabled={isLoading || !serviceStatus.isRunning}
          className="btn btn-health"
        >
          {isLoading ? 'Checking...' : 'Health Check'}
        </button>
      </div>
    </div>
  );
};

export default ServiceStatus;