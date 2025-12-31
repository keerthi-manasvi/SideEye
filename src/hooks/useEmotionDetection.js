import { useState, useEffect, useRef, useCallback } from 'react';
import EmotionDetectionEngine from '../services/EmotionDetectionEngine';

/**
 * React hook for managing emotion detection
 * Provides easy integration with React components
 */
const useEmotionDetection = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState({
    emotions: {},
    primaryEmotion: 'neutral',
    confidence: 0,
    energyLevel: 0,
    timestamp: null
  });
  const [error, setError] = useState(null);
  const [cameraStatus, setCameraStatus] = useState('unknown'); // 'unknown', 'granted', 'denied', 'unavailable'

  const engineRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Initialize the emotion detection engine
  const initialize = useCallback(async () => {
    try {
      setError(null);
      
      if (!engineRef.current) {
        engineRef.current = new EmotionDetectionEngine();
        
        // Set up event handlers
        engineRef.current.setOnEmotionDetected((emotionData) => {
          setCurrentEmotion(emotionData);
        });
        
        engineRef.current.setOnError((errorType, errorDetails) => {
          console.error('Emotion detection error:', errorType, errorDetails);
          
          switch (errorType) {
            case 'camera_access_denied':
              setCameraStatus('denied');
              setError('Camera access denied. Please enable camera permissions.');
              break;
            case 'initialization_failed':
              setError('Failed to load emotion detection models. Please check your internet connection.');
              break;
            case 'detection_error':
              setError('Error during emotion detection. The system will continue trying.');
              break;
            default:
              setError(`Emotion detection error: ${errorType}`);
          }
        });
      }

      const success = await engineRef.current.initialize();
      setIsInitialized(success);
      
      if (success) {
        console.log('Emotion detection engine initialized successfully');
      }
      
      return success;
    } catch (error) {
      console.error('Failed to initialize emotion detection:', error);
      setError('Failed to initialize emotion detection engine');
      return false;
    }
  }, []);

  // Start emotion detection
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
      setCameraStatus('granted');
    } catch (error) {
      console.error('Failed to start emotion detection:', error);
      setCameraStatus('denied');
      setIsRunning(false);
      throw error;
    }
  }, [isInitialized]);

  // Stop emotion detection
  const stopDetection = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stopDetection();
      setIsRunning(false);
    }
  }, []);

  // Check camera availability
  const checkCameraAvailability = useCallback(async () => {
    try {
      // First check if any video input devices are available
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (videoDevices.length === 0) {
        setCameraStatus('unavailable');
        return false;
      }

      // Try to access the camera to check permissions and actual connectivity
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        
        // Check if the stream is actually active
        const videoTracks = stream.getVideoTracks();
        if (videoTracks.length > 0 && videoTracks[0].readyState === 'live') {
          setCameraStatus('granted');
          stream.getTracks().forEach(track => track.stop());
          return true;
        } else {
          setCameraStatus('unavailable');
          stream.getTracks().forEach(track => track.stop());
          return false;
        }
      } catch (error) {
        if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          setCameraStatus('unavailable');
        } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setCameraStatus('denied');
        } else {
          setCameraStatus('unavailable');
        }
        return false;
      }
    } catch (error) {
      console.error('Error checking camera availability:', error);
      setCameraStatus('unavailable');
      return false;
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
      hasCamera: false,
      targetFPS: 10
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.dispose(); // Use dispose instead of stopDetection
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
    currentEmotion,
    error,
    cameraStatus,
    
    // Actions
    initialize,
    startDetection,
    stopDetection,
    checkCameraAvailability,
    setTargetFPS,
    getStatus,
    
    // Refs for video and canvas elements
    videoRef,
    canvasRef
  };
};

export default useEmotionDetection;