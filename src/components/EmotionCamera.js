import React, { useEffect, useState } from 'react';
import useEmotionDetection from '../hooks/useEmotionDetection';
import './EmotionCamera.css';

const EmotionCamera = ({ onEmotionUpdate, isActive = false }) => {
  const {
    isInitialized,
    isRunning,
    currentEmotion,
    error,
    cameraStatus,
    startDetection,
    stopDetection,
    checkCameraAvailability,
    setTargetFPS,
    videoRef,
    canvasRef
  } = useEmotionDetection();

  const [showVideo, setShowVideo] = useState(true);
  const [targetFPS, setTargetFPSState] = useState(10);

  // Update parent component when emotion changes
  useEffect(() => {
    if (onEmotionUpdate && currentEmotion.timestamp) {
      onEmotionUpdate(currentEmotion);
    }
  }, [currentEmotion, onEmotionUpdate]);

  // Auto-start detection when component becomes active and initialized
  useEffect(() => {
    if (isActive && isInitialized && !isRunning && cameraStatus === 'granted') {
      handleStartDetection();
    } else if (!isActive && isRunning) {
      handleStopDetection();
    }
  }, [isActive, isInitialized, isRunning, cameraStatus]);

  // Check camera availability on mount
  useEffect(() => {
    checkCameraAvailability();
  }, [checkCameraAvailability]);

  const handleStartDetection = async () => {
    try {
      await startDetection();
    } catch (error) {
      console.error('Failed to start detection:', error);
    }
  };

  const handleStopDetection = () => {
    stopDetection();
  };

  const handleFPSChange = (newFPS) => {
    setTargetFPSState(newFPS);
    setTargetFPS(newFPS);
  };

  const renderCameraStatus = () => {
    switch (cameraStatus) {
      case 'granted':
        return (
          <div className="camera-status granted">
            <span className="status-icon">✓</span>
            Camera Access Granted
          </div>
        );
      case 'denied':
        return (
          <div className="camera-status denied">
            <span className="status-icon">✗</span>
            Camera Access Denied
            <p className="status-help">
              Please enable camera permissions in your browser settings to use emotion detection.
            </p>
          </div>
        );
      case 'unavailable':
        return (
          <div className="camera-status unavailable">
            <span className="status-icon">⚠</span>
            No Camera Available
            <p className="status-help">
              No camera device was found. Please connect a camera to use emotion detection.
            </p>
          </div>
        );
      default:
        return (
          <div className="camera-status checking">
            <span className="status-icon">⟳</span>
            Checking Camera Availability...
          </div>
        );
    }
  };

  const renderEmotionData = () => {
    if (!currentEmotion.timestamp) {
      return (
        <div className="emotion-data no-data">
          <p>No emotion data available</p>
        </div>
      );
    }

    const emotions = currentEmotion.emotions;
    const sortedEmotions = Object.entries(emotions)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3); // Show top 3 emotions

    return (
      <div className="emotion-data">
        <div className="primary-emotion">
          <h4>Primary Emotion</h4>
          <div className="emotion-display">
            <span className="emotion-name">{currentEmotion.primaryEmotion}</span>
            <span className="emotion-confidence">
              {(currentEmotion.confidence * 100).toFixed(1)}%
            </span>
          </div>
        </div>
        
        <div className="energy-level">
          <h4>Energy Level</h4>
          <div className="energy-bar">
            <div 
              className="energy-fill"
              style={{ width: `${currentEmotion.energyLevel * 100}%` }}
            />
          </div>
          <span className="energy-value">
            {(currentEmotion.energyLevel * 100).toFixed(1)}%
          </span>
        </div>

        <div className="emotion-breakdown">
          <h4>Emotion Breakdown</h4>
          {sortedEmotions.map(([emotion, value]) => (
            <div key={emotion} className="emotion-item">
              <span className="emotion-label">{emotion}</span>
              <div className="emotion-bar">
                <div 
                  className="emotion-fill"
                  style={{ width: `${value * 100}%` }}
                />
              </div>
              <span className="emotion-value">{(value * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="emotion-camera">
      <div className="camera-header">
        <h3>Emotion Detection</h3>
        <div className="camera-controls">
          <button 
            onClick={showVideo ? handleStopDetection : handleStartDetection}
            disabled={!isInitialized || cameraStatus !== 'granted'}
            className={isRunning ? 'stop-btn' : 'start-btn'}
          >
            {isRunning ? 'Stop' : 'Start'} Detection
          </button>
          <button 
            onClick={() => setShowVideo(!showVideo)}
            className="toggle-video-btn"
          >
            {showVideo ? 'Hide' : 'Show'} Video
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠</span>
          {error}
        </div>
      )}

      <div className="camera-content">
        <div className="video-container">
          {showVideo && cameraStatus === 'granted' ? (
            <div className="video-wrapper">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="emotion-video"
              />
              <canvas
                ref={canvasRef}
                className="detection-overlay"
              />
              {!isRunning && (
                <div className="video-overlay">
                  <p>Click "Start Detection" to begin</p>
                </div>
              )}
            </div>
          ) : (
            <div className="video-placeholder">
              {renderCameraStatus()}
            </div>
          )}
        </div>

        <div className="emotion-panel">
          {renderEmotionData()}
          
          <div className="detection-settings">
            <h4>Settings</h4>
            <div className="setting-item">
              <label htmlFor="fps-slider">Target FPS: {targetFPS}</label>
              <input
                id="fps-slider"
                type="range"
                min="1"
                max="30"
                value={targetFPS}
                onChange={(e) => handleFPSChange(parseInt(e.target.value))}
                disabled={!isInitialized}
              />
            </div>
            <div className="status-indicators">
              <div className={`status-indicator ${isInitialized ? 'active' : ''}`}>
                Models Loaded
              </div>
              <div className={`status-indicator ${isRunning ? 'active' : ''}`}>
                Detection Running
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmotionCamera;