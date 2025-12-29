import React, { useState, useEffect, useCallback } from 'react';
import './Dashboard.css';
import WellnessMonitor from './WellnessMonitor';
import ManualEmotionInput from './ManualEmotionInput';
import FeedbackModal from './FeedbackModal';
import ServiceStatus from './ServiceStatus';

const Dashboard = () => {
  const [systemStatus, setSystemStatus] = useState({
    camera: 'disconnected',
    django: 'disconnected',
    tensorflow: 'loading'
  });

  const [currentEmotion, setCurrentEmotion] = useState({
    primary: 'neutral',
    confidence: 0,
    energy: 0
  });

  const [wellnessData, setWellnessData] = useState({
    postureScore: 0,
    blinkRate: 0,
    sessionTime: 0
  });

  const [isMonitoring, setIsMonitoring] = useState(false);
  const [emotionHistory, setEmotionHistory] = useState([]);
  const [feedbackModal, setFeedbackModal] = useState({
    isOpen: false,
    suggestionType: null,
    suggestionData: null,
    emotionContext: null
  });
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // Check system status on component mount
    checkSystemStatus();
    
    // Start session timer
    const sessionStart = Date.now();
    const timer = setInterval(() => {
      setWellnessData(prev => ({
        ...prev,
        sessionTime: Date.now() - sessionStart
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const checkSystemStatus = async () => {
    // Check Django service
    try {
      if (window.electronAPI) {
        const response = await window.electronAPI.callDjangoAPI('/health/', 'GET');
        setSystemStatus(prev => ({
          ...prev,
          django: response.success ? 'connected' : 'disconnected'
        }));
      }
    } catch (error) {
      console.log('Django service not yet available');
    }

    // Check camera access
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setSystemStatus(prev => ({ ...prev, camera: 'connected' }));
      stream.getTracks().forEach(track => track.stop()); // Stop the stream
    } catch (error) {
      setSystemStatus(prev => ({ ...prev, camera: 'denied' }));
    }

    // TensorFlow.js will be loaded in future tasks
    setSystemStatus(prev => ({ ...prev, tensorflow: 'ready' }));
  };

  const handleWellnessUpdate = useCallback((wellnessData) => {
    // Update emotion data if available
    if (wellnessData.emotion) {
      const newEmotion = {
        primary: wellnessData.emotion.primaryEmotion,
        confidence: wellnessData.emotion.confidence,
        energy: wellnessData.emotion.energyLevel,
        timestamp: Date.now()
      };
      
      setCurrentEmotion(newEmotion);
      
      // Add to emotion history (keep last 50 entries)
      setEmotionHistory(prev => {
        const updated = [...prev, newEmotion].slice(-50);
        return updated;
      });
    }

    // Update wellness metrics if available
    if (wellnessData.posture) {
      setWellnessData(prev => ({
        ...prev,
        postureScore: wellnessData.posture.posture ? wellnessData.posture.posture.score : prev.postureScore,
        blinkRate: wellnessData.posture.blinks ? wellnessData.posture.blinks.blinkRate : prev.blinkRate
      }));
    }

    // Update TensorFlow status when we receive data
    setSystemStatus(prev => ({ ...prev, tensorflow: 'ready' }));
  }, []);

  const handleEmotionUpdate = useCallback((emotionData) => {
    const newEmotion = {
      primary: emotionData.primaryEmotion,
      confidence: emotionData.confidence,
      energy: emotionData.energyLevel,
      timestamp: Date.now()
    };
    
    setCurrentEmotion(newEmotion);
    
    // Add to emotion history (keep last 50 entries)
    setEmotionHistory(prev => {
      const updated = [...prev, newEmotion].slice(-50);
      return updated;
    });

    // Update TensorFlow status when we receive emotion data
    setSystemStatus(prev => ({ ...prev, tensorflow: 'ready' }));
  }, []);

  const handleFeedbackSubmit = useCallback(async (feedbackData) => {
    try {
      if (window.electronAPI) {
        const response = await window.electronAPI.callDjangoAPI(
          '/feedback/', 
          'POST', 
          feedbackData
        );
        
        if (response.success) {
          addNotification('Feedback submitted successfully!', 'success');
        } else {
          addNotification('Failed to submit feedback. Please try again.', 'error');
        }
      } else {
        // Browser mode - save to localStorage
        const existingFeedback = JSON.parse(localStorage.getItem('sideeyeFeedback') || '[]');
        existingFeedback.push(feedbackData);
        localStorage.setItem('sideeyeFeedback', JSON.stringify(existingFeedback));
        addNotification('Feedback saved locally!', 'success');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      addNotification('Error submitting feedback. Please try again.', 'error');
    }
  }, []);

  const addNotification = useCallback((message, type = 'info') => {
    const notification = {
      id: Date.now(),
      message,
      type,
      timestamp: Date.now()
    };
    
    setNotifications(prev => [...prev, notification]);
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  }, []);

  const showFeedbackModal = useCallback((suggestionType, suggestionData) => {
    setFeedbackModal({
      isOpen: true,
      suggestionType,
      suggestionData,
      emotionContext: currentEmotion
    });
  }, [currentEmotion]);

  const closeFeedbackModal = useCallback(() => {
    setFeedbackModal({
      isOpen: false,
      suggestionType: null,
      suggestionData: null,
      emotionContext: null
    });
  }, []);

  const getEmotionTrend = useCallback(() => {
    if (emotionHistory.length < 2) return 'stable';
    
    const recent = emotionHistory.slice(-5);
    const avgEnergy = recent.reduce((sum, e) => sum + e.energy, 0) / recent.length;
    const firstEnergy = recent[0].energy;
    const lastEnergy = recent[recent.length - 1].energy;
    
    if (lastEnergy > firstEnergy + 0.1) return 'improving';
    if (lastEnergy < firstEnergy - 0.1) return 'declining';
    return 'stable';
  }, [emotionHistory]);

  const dismissNotification = useCallback((notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  const handleStartMonitoring = () => {
    setIsMonitoring(true);
  };

  const handleStopMonitoring = () => {
    setIsMonitoring(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected':
      case 'ready':
        return '#4CAF50';
      case 'loading':
        return '#FF9800';
      case 'disconnected':
      case 'denied':
        return '#F44336';
      default:
        return '#9E9E9E';
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Workspace Dashboard</h2>
        <p>Real-time biometric monitoring and workspace automation</p>
      </div>

      <div className="dashboard-grid">
        <div className="status-card">
          <h3>System Status</h3>
          <div className="status-items">
            <div className="status-item">
              <span className="status-label">Camera:</span>
              <span 
                className="status-indicator"
                style={{ color: getStatusColor(systemStatus.camera) }}
              >
                {systemStatus.camera}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">Django Service:</span>
              <span 
                className="status-indicator"
                style={{ color: getStatusColor(systemStatus.django) }}
              >
                {systemStatus.django}
              </span>
            </div>
            <div className="status-item">
              <span className="status-label">TensorFlow.js:</span>
              <span 
                className="status-indicator"
                style={{ color: getStatusColor(systemStatus.tensorflow) }}
              >
                {systemStatus.tensorflow}
              </span>
            </div>
          </div>
        </div>

        <div className="emotion-card">
          <h3>Current State</h3>
          <div className="emotion-display">
            <div className="emotion-primary">
              <span className="emotion-label">Emotion:</span>
              <span className="emotion-value">{currentEmotion.primary}</span>
            </div>
            <div className="emotion-metrics">
              <div className="metric">
                <span>Confidence:</span>
                <span>{(currentEmotion.confidence * 100).toFixed(1)}%</span>
              </div>
              <div className="metric">
                <span>Energy Level:</span>
                <span>{(currentEmotion.energy * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="wellness-card">
          <h3>Wellness Metrics</h3>
          <div className="wellness-metrics">
            <div className="metric">
              <span>Posture Score:</span>
              <span>{wellnessData.postureScore > 0 ? (wellnessData.postureScore * 100).toFixed(1) + '%' : '--'}</span>
            </div>
            <div className="metric">
              <span>Blink Rate:</span>
              <span>{wellnessData.blinkRate > 0 ? wellnessData.blinkRate + '/min' : '-- bpm'}</span>
            </div>
            <div className="metric">
              <span>Session Time:</span>
              <span>{wellnessData.sessionTime > 0 ? Math.floor(wellnessData.sessionTime / 60000) + ':' + String(Math.floor((wellnessData.sessionTime % 60000) / 1000)).padStart(2, '0') : '--:--'}</span>
            </div>
          </div>
        </div>

        <div className="actions-card">
          <h3>Quick Actions</h3>
          <div className="action-buttons">
            <button onClick={checkSystemStatus}>Refresh Status</button>
            <button 
              onClick={isMonitoring ? handleStopMonitoring : handleStartMonitoring}
            >
              {isMonitoring ? 'Stop' : 'Start'} Monitoring
            </button>
            <button onClick={checkSystemStatus}>Calibrate Camera</button>
          </div>
        </div>
      </div>

      {/* Enhanced Emotion Visualization */}
      {emotionHistory.length > 0 && (
        <div className="emotion-visualization">
          <h3>Emotion Trends</h3>
          <div className="emotion-trend-info">
            <div className="trend-indicator">
              <span className="trend-label">Trend:</span>
              <span className={`trend-value ${getEmotionTrend()}`}>
                {getEmotionTrend()}
              </span>
            </div>
            <div className="history-stats">
              <span>Last {emotionHistory.length} readings</span>
            </div>
          </div>
          <div className="emotion-history-chart">
            {emotionHistory.slice(-10).map((emotion, index) => (
              <div 
                key={emotion.timestamp} 
                className="emotion-bar"
                style={{ 
                  height: `${emotion.energy * 100}%`,
                  backgroundColor: emotion.primary === 'happy' ? '#4CAF50' : 
                                 emotion.primary === 'sad' ? '#2196F3' :
                                 emotion.primary === 'angry' ? '#F44336' :
                                 emotion.primary === 'surprised' ? '#FF9800' :
                                 emotion.primary === 'fearful' ? '#9C27B0' :
                                 emotion.primary === 'disgusted' ? '#795548' : '#9E9E9E'
                }}
                title={`${emotion.primary} (${(emotion.energy * 100).toFixed(1)}% energy)`}
                aria-label={`Emotion reading ${index + 1}: ${emotion.primary} with ${(emotion.energy * 100).toFixed(1)}% energy level`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="notifications-container" role="alert" aria-live="polite">
          {notifications.map((notification) => (
            <div 
              key={notification.id} 
              className={`notification ${notification.type}`}
              role="alert"
            >
              <span className="notification-message">{notification.message}</span>
              <button 
                className="notification-dismiss"
                onClick={() => dismissNotification(notification.id)}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Django Service Management */}
      <ServiceStatus />

      {/* Demo Feedback Modal Trigger */}
      <div className="demo-actions">
        <h3>Demo AI Suggestions</h3>
        <div className="demo-buttons">
          <button 
            onClick={() => showFeedbackModal('music', {
              playlistName: 'Focus Jazz',
              genre: 'Jazz',
              reason: 'Based on your current calm state'
            })}
            className="demo-button"
          >
            Test Music Suggestion
          </button>
          <button 
            onClick={() => showFeedbackModal('theme', {
              themeName: 'Dark Blue',
              colorPalette: 'Cool Blues',
              reason: 'Matches your focused energy level'
            })}
            className="demo-button"
          >
            Test Theme Suggestion
          </button>
        </div>
      </div>

      {/* Wellness Monitoring - Integrated emotion and posture detection */}
      {systemStatus.camera === 'denied' ? (
        <ManualEmotionInput 
          onEmotionUpdate={handleEmotionUpdate}
          isActive={isMonitoring}
        />
      ) : (
        <WellnessMonitor 
          onWellnessUpdate={handleWellnessUpdate}
          isActive={isMonitoring}
        />
      )}

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={feedbackModal.isOpen}
        onClose={closeFeedbackModal}
        suggestionType={feedbackModal.suggestionType}
        suggestionData={feedbackModal.suggestionData}
        emotionContext={feedbackModal.emotionContext}
        onFeedbackSubmit={handleFeedbackSubmit}
      />
    </div>
  );
};

export default Dashboard;