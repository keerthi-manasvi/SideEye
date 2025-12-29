import { useState, useEffect, useRef, useCallback } from 'react';
import PostureDetectionEngine from '../services/PostureDetectionEngine';

/**
 * React hook for managing posture and blink detection
 * Provides easy integration with React components
 */
const usePostureDetection = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentPosture, setCurrentPosture] = useState({
    posture: {
      score: 0,
      alignment: 'unknown',
      shoulderLevel: 0,
      headForward: 0,
      confidence: 0
    },
    blinks: {
      blinkRate: 0,
      eyeAspectRatio: 0,
      isBlinking: false,
      confidence: 0
    },
    timestamp: null
  });
  const [wellnessAlerts, setWellnessAlerts] = useState([]);
  const [error, setError] = useState(null);

  const engineRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Initialize the posture detection engine
  const initialize = useCallback(async () => {
    try {
      setError(null);
      
      if (!engineRef.current) {
        engineRef.current = new PostureDetectionEngine();
        
        // Set up event handlers
        engineRef.current.setOnPostureDetected((postureData) => {
          if (postureData.type === 'posture_alert' || postureData.type === 'blink_alert') {
            // Handle wellness alerts
            setWellnessAlerts(prev => [...prev, postureData]);
          } else {
            // Handle regular posture data
            setCurrentPosture(postureData);
          }
        });
        
        engineRef.current.setOnError((errorType, errorDetails) => {
          console.error('Posture detection error:', errorType, errorDetails);
          
          switch (errorType) {
            case 'initialization_failed':
              setError('Failed to load posture detection models. Please check your internet connection.');
              break;
            case 'detection_start_failed':
              setError('Failed to start posture detection. Please try again.');
              break;
            case 'detection_error':
              setError('Error during posture detection. The system will continue trying.');
              break;
            default:
              setError(`Posture detection error: ${errorType}`);
          }
        });
      }

      const success = await engineRef.current.initialize();
      setIsInitialized(success);
      
      if (success) {
        console.log('Posture detection engine initialized successfully');
      }
      
      return success;
    } catch (error) {
      console.error('Failed to initialize posture detection:', error);
      setError('Failed to initialize posture detection engine');
      return false;
    }
  }, []);

  // Start posture detection
  const startDetection = useCallback(async () => {
    if (!engineRef.current || !isInitialized) {
      throw new Error('Engine not initialized');
    }

    if (!videoRef.current || !canvasRef.current) {
      throw new Error('Video and canvas elements must be provided');
    }

    try {
      setError(null);
      await engineRef.current.startDetection(videoRef.current, canvasRef.current);
      setIsRunning(true);
    } catch (error) {
      console.error('Failed to start posture detection:', error);
      setIsRunning(false);
      throw error;
    }
  }, [isInitialized]);

  // Stop posture detection
  const stopDetection = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stopDetection();
      setIsRunning(false);
    }
  }, []);

  // Set target FPS
  const setTargetFPS = useCallback((fps) => {
    if (engineRef.current) {
      engineRef.current.setTargetFPS(fps);
    }
  }, []);

  // Get engine status
  const getStatus = useCallback(() => {
    if (engineRef.current) {
      return engineRef.current.getStatus();
    }
    return {
      isInitialized: false,
      isRunning: false,
      targetFPS: 5,
      postureHistoryLength: 0,
      blinkHistoryLength: 0
    };
  }, []);

  // Get posture history
  const getPostureHistory = useCallback(() => {
    if (engineRef.current) {
      return engineRef.current.getPostureHistory();
    }
    return [];
  }, []);

  // Get blink history
  const getBlinkHistory = useCallback(() => {
    if (engineRef.current) {
      return engineRef.current.getBlinkHistory();
    }
    return [];
  }, []);

  // Update health thresholds
  const updateThresholds = useCallback((newThresholds) => {
    if (engineRef.current) {
      engineRef.current.updateThresholds(newThresholds);
    }
  }, []);

  // Clear wellness alerts
  const clearWellnessAlerts = useCallback(() => {
    setWellnessAlerts([]);
  }, []);

  // Dismiss specific alert
  const dismissAlert = useCallback((alertIndex) => {
    setWellnessAlerts(prev => prev.filter((_, index) => index !== alertIndex));
  }, []);

  // Get wellness statistics
  const getWellnessStats = useCallback(() => {
    const postureHistory = getPostureHistory();
    const blinkHistory = getBlinkHistory();
    
    if (postureHistory.length === 0) {
      return {
        averagePostureScore: 0,
        goodPosturePercentage: 0,
        averageBlinkRate: 0,
        totalBlinks: blinkHistory.length,
        sessionDuration: 0
      };
    }

    const averagePostureScore = postureHistory.reduce((sum, reading) => sum + reading.score, 0) / postureHistory.length;
    const goodPostureCount = postureHistory.filter(reading => reading.alignment === 'good').length;
    const goodPosturePercentage = (goodPostureCount / postureHistory.length) * 100;
    
    // Calculate session duration
    const firstReading = postureHistory[0];
    const lastReading = postureHistory[postureHistory.length - 1];
    const sessionDuration = lastReading.timestamp - firstReading.timestamp;
    
    // Calculate average blink rate (blinks per minute)
    const sessionMinutes = sessionDuration / (1000 * 60);
    const averageBlinkRate = sessionMinutes > 0 ? blinkHistory.length / sessionMinutes : 0;

    return {
      averagePostureScore: averagePostureScore,
      goodPosturePercentage: goodPosturePercentage,
      averageBlinkRate: averageBlinkRate,
      totalBlinks: blinkHistory.length,
      sessionDuration: sessionDuration
    };
  }, [getPostureHistory, getBlinkHistory]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.stopDetection();
      }
    };
  }, []);

  // Auto-initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  return {
    // State
    isInitialized,
    isRunning,
    currentPosture,
    wellnessAlerts,
    error,
    
    // Actions
    initialize,
    startDetection,
    stopDetection,
    setTargetFPS,
    getStatus,
    getPostureHistory,
    getBlinkHistory,
    updateThresholds,
    clearWellnessAlerts,
    dismissAlert,
    getWellnessStats,
    
    // Refs for video and canvas elements
    videoRef,
    canvasRef
  };
};

export default usePostureDetection;