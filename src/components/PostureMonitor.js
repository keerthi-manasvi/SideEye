import React, { useEffect, useState } from 'react';
import usePostureDetection from '../hooks/usePostureDetection';
import './PostureMonitor.css';

const PostureMonitor = ({ onPostureUpdate, isActive = false, videoElement = null }) => {
  const {
    isInitialized,
    isRunning,
    currentPosture,
    wellnessAlerts,
    error,
    startDetection,
    stopDetection,
    setTargetFPS,
    getStatus,
    getWellnessStats,
    updateThresholds,
    clearWellnessAlerts,
    dismissAlert,
    videoRef,
    canvasRef
  } = usePostureDetection();

  const [showSettings, setShowSettings] = useState(false);
  const [targetFPS, setTargetFPSState] = useState(5);
  const [thresholds, setThresholds] = useState({
    posture: {
      goodPosture: 0.7,
      poorPosture: 0.4,
      alertThreshold: 0.3
    },
    blink: {
      normalBlinkRate: 15,
      lowBlinkRate: 8,
      eyeAspectRatioThreshold: 0.25
    }
  });

  // Update parent component when posture changes
  useEffect(() => {
    if (onPostureUpdate && currentPosture.timestamp) {
      onPostureUpdate(currentPosture);
    }
  }, [currentPosture, onPostureUpdate]);

  // Use external video element if provided, otherwise use internal ref
  useEffect(() => {
    if (videoElement && videoRef.current !== videoElement) {
      videoRef.current = videoElement;
    }
  }, [videoElement, videoRef]);

  // Auto-start detection when component becomes active and initialized
  useEffect(() => {
    if (isActive && isInitialized && !isRunning) {
      handleStartDetection();
    } else if (!isActive && isRunning) {
      handleStopDetection();
    }
  }, [isActive, isInitialized, isRunning]);

  const handleStartDetection = async () => {
    try {
      await startDetection();
    } catch (error) {
      console.error('Failed to start posture detection:', error);
    }
  };

  const handleStopDetection = () => {
    stopDetection();
  };

  const handleFPSChange = (newFPS) => {
    setTargetFPSState(newFPS);
    setTargetFPS(newFPS);
  };

  const handleThresholdChange = (category, key, value) => {
    const newThresholds = {
      ...thresholds,
      [category]: {
        ...thresholds[category],
        [key]: parseFloat(value)
      }
    };
    setThresholds(newThresholds);
    updateThresholds(newThresholds);
  };

  const getPostureStatusColor = (alignment) => {
    switch (alignment) {
      case 'good': return '#4CAF50';
      case 'fair': return '#FF9800';
      case 'poor': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getBlinkRateStatus = (blinkRate) => {
    if (blinkRate >= thresholds.blink.normalBlinkRate) return 'normal';
    if (blinkRate >= thresholds.blink.lowBlinkRate) return 'low';
    return 'very-low';
  };

  const getBlinkRateColor = (status) => {
    switch (status) {
      case 'normal': return '#4CAF50';
      case 'low': return '#FF9800';
      case 'very-low': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const formatDuration = (ms) => {
    const minutes = Math.floor(ms / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const renderWellnessAlerts = () => {
    if (wellnessAlerts.length === 0) return null;

    return (
      <div className="wellness-alerts">
        <div className="alerts-header">
          <h4>Wellness Alerts</h4>
          <button onClick={clearWellnessAlerts} className="clear-alerts-btn">
            Clear All
          </button>
        </div>
        {wellnessAlerts.map((alert, index) => (
          <div key={index} className={`alert ${alert.severity}`}>
            <div className="alert-content">
              <span className="alert-icon">
                {alert.type === 'posture_alert' ? '🏃' : '👁️'}
              </span>
              <span className="alert-message">{alert.message}</span>
            </div>
            <button 
              onClick={() => dismissAlert(index)}
              className="dismiss-alert-btn"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    );
  };

  const renderPostureData = () => {
    if (!currentPosture.timestamp) {
      return (
        <div className="posture-data no-data">
          <p>No posture data available</p>
        </div>
      );
    }

    const blinkStatus = getBlinkRateStatus(currentPosture.blinks.blinkRate);
    const wellnessStats = getWellnessStats();

    return (
      <div className="posture-data">
        <div className="posture-status">
          <h4>Posture Analysis</h4>
          <div className="status-display">
            <div 
              className="status-indicator"
              style={{ backgroundColor: getPostureStatusColor(currentPosture.posture.alignment) }}
            >
              {currentPosture.posture.alignment.toUpperCase()}
            </div>
            <div className="status-details">
              <div className="detail-item">
                <span>Score: {(currentPosture.posture.score * 100).toFixed(1)}%</span>
              </div>
              <div className="detail-item">
                <span>Shoulder Level: {(currentPosture.posture.shoulderLevel * 100).toFixed(1)}%</span>
              </div>
              <div className="detail-item">
                <span>Head Position: {(currentPosture.posture.headForward * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="blink-analysis">
          <h4>Blink Rate Analysis</h4>
          <div className="blink-display">
            <div 
              className="blink-rate"
              style={{ color: getBlinkRateColor(blinkStatus) }}
            >
              {currentPosture.blinks.blinkRate} blinks/min
            </div>
            <div className="blink-status">
              Status: <span style={{ color: getBlinkRateColor(blinkStatus) }}>
                {blinkStatus.replace('-', ' ').toUpperCase()}
              </span>
            </div>
            {currentPosture.blinks.isBlinking && (
              <div className="blink-indicator">
                <span className="blink-flash">BLINK DETECTED</span>
              </div>
            )}
          </div>
        </div>

        <div className="wellness-stats">
          <h4>Session Statistics</h4>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Avg Posture</span>
              <span className="stat-value">{(wellnessStats.averagePostureScore * 100).toFixed(1)}%</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Good Posture</span>
              <span className="stat-value">{wellnessStats.goodPosturePercentage.toFixed(1)}%</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Avg Blinks</span>
              <span className="stat-value">{wellnessStats.averageBlinkRate.toFixed(1)}/min</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Session Time</span>
              <span className="stat-value">{formatDuration(wellnessStats.sessionDuration)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSettings = () => {
    if (!showSettings) return null;

    return (
      <div className="posture-settings">
        <h4>Detection Settings</h4>
        
        <div className="setting-group">
          <label>Target FPS: {targetFPS}</label>
          <input
            type="range"
            min="1"
            max="10"
            value={targetFPS}
            onChange={(e) => handleFPSChange(parseInt(e.target.value))}
            disabled={!isInitialized}
          />
        </div>

        <div className="setting-group">
          <h5>Posture Thresholds</h5>
          <div className="threshold-inputs">
            <label>
              Good Posture:
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={thresholds.posture.goodPosture}
                onChange={(e) => handleThresholdChange('posture', 'goodPosture', e.target.value)}
              />
            </label>
            <label>
              Poor Posture:
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={thresholds.posture.poorPosture}
                onChange={(e) => handleThresholdChange('posture', 'poorPosture', e.target.value)}
              />
            </label>
            <label>
              Alert Threshold:
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={thresholds.posture.alertThreshold}
                onChange={(e) => handleThresholdChange('posture', 'alertThreshold', e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="setting-group">
          <h5>Blink Rate Thresholds</h5>
          <div className="threshold-inputs">
            <label>
              Normal Blink Rate (per min):
              <input
                type="number"
                min="5"
                max="30"
                value={thresholds.blink.normalBlinkRate}
                onChange={(e) => handleThresholdChange('blink', 'normalBlinkRate', e.target.value)}
              />
            </label>
            <label>
              Low Blink Rate (per min):
              <input
                type="number"
                min="1"
                max="20"
                value={thresholds.blink.lowBlinkRate}
                onChange={(e) => handleThresholdChange('blink', 'lowBlinkRate', e.target.value)}
              />
            </label>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="posture-monitor">
      <div className="monitor-header">
        <h3>Posture & Wellness Monitor</h3>
        <div className="monitor-controls">
          <button 
            onClick={isRunning ? handleStopDetection : handleStartDetection}
            disabled={!isInitialized}
            className={isRunning ? 'stop-btn' : 'start-btn'}
          >
            {isRunning ? 'Stop' : 'Start'} Monitoring
          </button>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="settings-btn"
          >
            ⚙️ Settings
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠</span>
          {error}
        </div>
      )}

      {renderWellnessAlerts()}

      <div className="monitor-content">
        {!videoElement && (
          <div className="canvas-container">
            <canvas
              ref={canvasRef}
              className="posture-overlay"
              width="640"
              height="480"
            />
            {!isRunning && (
              <div className="canvas-placeholder">
                <p>Start monitoring to see posture analysis</p>
              </div>
            )}
          </div>
        )}

        <div className="analysis-panel">
          {renderPostureData()}
          {renderSettings()}
          
          <div className="status-indicators">
            <div className={`status-indicator ${isInitialized ? 'active' : ''}`}>
              Models Loaded
            </div>
            <div className={`status-indicator ${isRunning ? 'active' : ''}`}>
              Monitoring Active
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostureMonitor;