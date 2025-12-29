import * as faceapi from 'face-api.js';

class EmotionDetectionEngine {
  constructor() {
    this.isInitialized = false;
    this.isRunning = false;
    this.videoElement = null;
    this.canvasElement = null;
    this.stream = null;
    this.detectionInterval = null;
    this.targetFPS = 10;
    this.onEmotionDetected = null;
    this.onError = null;
    this.confidenceThreshold = 0.5;
    
    // Emotion state tracking
    this.lastEmotions = [];
    this.emotionHistory = [];
    this.maxHistoryLength = 30; // Keep last 30 readings for smoothing
  }

  /**
   * Initialize the emotion detection engine
   * Loads face-api.js models and sets up detection pipeline
   */
  async initialize() {
    try {
      console.log('Initializing EmotionDetectionEngine...');
      
      // Load face-api.js models from public directory
      const MODEL_URL = process.env.PUBLIC_URL + '/models';
      
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
      ]);
      
      this.isInitialized = true;
      console.log('EmotionDetectionEngine initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize EmotionDetectionEngine:', error);
      if (this.onError) {
        this.onError('initialization_failed', error);
      }
      return false;
    }
  }

  /**
   * Start emotion detection with webcam
   * @param {HTMLVideoElement} videoElement - Video element to display webcam feed
   * @param {HTMLCanvasElement} canvasElement - Canvas for drawing detection results
   */
  async startDetection(videoElement, canvasElement) {
    if (!this.isInitialized) {
      throw new Error('Engine not initialized. Call initialize() first.');
    }

    if (this.isRunning) {
      console.warn('Detection already running');
      return;
    }

    try {
      this.videoElement = videoElement;
      this.canvasElement = canvasElement;

      // Request camera access
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: this.targetFPS }
        }
      });

      this.videoElement.srcObject = this.stream;
      
      // Wait for video to be ready
      await new Promise((resolve) => {
        this.videoElement.onloadedmetadata = () => {
          resolve();
        };
      });

      await this.videoElement.play();

      // Set canvas dimensions to match video
      this.canvasElement.width = this.videoElement.videoWidth;
      this.canvasElement.height = this.videoElement.videoHeight;

      // Start detection loop
      this.isRunning = true;
      this.startDetectionLoop();
      
      console.log('Emotion detection started successfully');
    } catch (error) {
      console.error('Failed to start emotion detection:', error);
      if (this.onError) {
        this.onError('camera_access_denied', error);
      }
      throw error;
    }
  }

  /**
   * Stop emotion detection and release resources
   */
  stopDetection() {
    this.isRunning = false;
    
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    console.log('Emotion detection stopped');
  }

  /**
   * Main detection loop - runs at target FPS
   */
  startDetectionLoop() {
    const intervalMs = 1000 / this.targetFPS;
    
    this.detectionInterval = setInterval(async () => {
      if (!this.isRunning || !this.videoElement) {
        return;
      }

      try {
        await this.detectEmotions();
      } catch (error) {
        console.error('Error in detection loop:', error);
        if (this.onError) {
          this.onError('detection_error', error);
        }
      }
    }, intervalMs);
  }

  /**
   * Perform emotion detection on current video frame
   */
  async detectEmotions() {
    if (!this.videoElement || this.videoElement.paused || this.videoElement.ended) {
      return;
    }

    try {
      // Detect faces with landmarks and expressions
      const detections = await faceapi
        .detectAllFaces(this.videoElement, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceExpressions();

      if (detections.length === 0) {
        // No face detected
        this.handleNoFaceDetected();
        return;
      }

      // Use the first detected face (primary user)
      const detection = detections[0];
      const emotions = detection.expressions;
      
      // Calculate confidence as the highest emotion probability
      const confidence = Math.max(...Object.values(emotions));
      
      if (confidence < this.confidenceThreshold) {
        // Low confidence detection, skip this frame
        return;
      }

      // Process and smooth emotions
      const processedEmotions = this.processEmotions(emotions, confidence);
      
      // Draw detection results on canvas
      this.drawDetectionResults(detection);
      
      // Notify listeners
      if (this.onEmotionDetected) {
        this.onEmotionDetected(processedEmotions);
      }

    } catch (error) {
      console.error('Error detecting emotions:', error);
      throw error;
    }
  }

  /**
   * Process raw emotion data and apply smoothing
   * @param {Object} rawEmotions - Raw emotion probabilities from face-api.js
   * @param {number} confidence - Detection confidence
   */
  processEmotions(rawEmotions, confidence) {
    // Add current emotions to history
    this.emotionHistory.push({
      emotions: rawEmotions,
      confidence: confidence,
      timestamp: Date.now()
    });

    // Keep history within limits
    if (this.emotionHistory.length > this.maxHistoryLength) {
      this.emotionHistory.shift();
    }

    // Apply temporal smoothing using weighted average
    const smoothedEmotions = this.applySmoothingFilter();
    
    // Calculate energy level based on emotion combination
    const energyLevel = this.calculateEnergyLevel(smoothedEmotions);
    
    // Determine primary emotion
    const primaryEmotion = this.getPrimaryEmotion(smoothedEmotions);

    const result = {
      emotions: smoothedEmotions,
      primaryEmotion: primaryEmotion,
      confidence: confidence,
      energyLevel: energyLevel,
      timestamp: Date.now()
    };

    return result;
  }

  /**
   * Apply temporal smoothing to reduce noise in emotion detection
   */
  applySmoothingFilter() {
    if (this.emotionHistory.length === 0) {
      return {};
    }

    const emotionKeys = Object.keys(this.emotionHistory[0].emotions);
    const smoothedEmotions = {};

    // Calculate weighted average for each emotion
    emotionKeys.forEach(emotion => {
      let weightedSum = 0;
      let totalWeight = 0;

      this.emotionHistory.forEach((reading, index) => {
        // More recent readings get higher weight
        const weight = (index + 1) / this.emotionHistory.length;
        const confidenceWeight = reading.confidence;
        const finalWeight = weight * confidenceWeight;

        weightedSum += reading.emotions[emotion] * finalWeight;
        totalWeight += finalWeight;
      });

      smoothedEmotions[emotion] = totalWeight > 0 ? weightedSum / totalWeight : 0;
    });

    return smoothedEmotions;
  }

  /**
   * Calculate energy level based on emotion combination
   * @param {Object} emotions - Smoothed emotion probabilities
   */
  calculateEnergyLevel(emotions) {
    // High energy emotions: happy, surprised, angry
    // Low energy emotions: sad, fearful, disgusted
    // Neutral: neutral
    
    const highEnergyEmotions = ['happy', 'surprised', 'angry'];
    const lowEnergyEmotions = ['sad', 'fearful', 'disgusted'];
    
    let energyScore = 0;
    
    highEnergyEmotions.forEach(emotion => {
      if (emotions[emotion]) {
        energyScore += emotions[emotion] * 1.0;
      }
    });
    
    lowEnergyEmotions.forEach(emotion => {
      if (emotions[emotion]) {
        energyScore -= emotions[emotion] * 0.8;
      }
    });
    
    // Neutral contributes slightly to energy
    if (emotions.neutral) {
      energyScore += emotions.neutral * 0.3;
    }
    
    // Normalize to 0-1 range
    energyScore = Math.max(0, Math.min(1, (energyScore + 1) / 2));
    
    return energyScore;
  }

  /**
   * Get the primary (dominant) emotion
   * @param {Object} emotions - Emotion probabilities
   */
  getPrimaryEmotion(emotions) {
    let maxEmotion = 'neutral';
    let maxValue = 0;

    Object.entries(emotions).forEach(([emotion, value]) => {
      if (value > maxValue) {
        maxValue = value;
        maxEmotion = emotion;
      }
    });

    return maxEmotion;
  }

  /**
   * Handle case when no face is detected
   */
  handleNoFaceDetected() {
    // Clear canvas
    if (this.canvasElement) {
      const ctx = this.canvasElement.getContext('2d');
      ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
    }

    // Could notify listeners about no face detected
    // For now, we'll just skip this frame
  }

  /**
   * Draw detection results on canvas overlay
   * @param {Object} detection - Face detection result
   */
  drawDetectionResults(detection) {
    if (!this.canvasElement) return;

    const ctx = this.canvasElement.getContext('2d');
    ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

    // Draw face bounding box
    const box = detection.detection.box;
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    // Draw emotion labels
    const emotions = detection.expressions;
    const primaryEmotion = this.getPrimaryEmotion(emotions);
    const confidence = Math.max(...Object.values(emotions));

    ctx.fillStyle = '#00ff00';
    ctx.font = '16px Arial';
    ctx.fillText(
      `${primaryEmotion} (${(confidence * 100).toFixed(1)}%)`,
      box.x,
      box.y - 10
    );
  }

  /**
   * Set callback for emotion detection events
   * @param {Function} callback - Function to call when emotions are detected
   */
  setOnEmotionDetected(callback) {
    this.onEmotionDetected = callback;
  }

  /**
   * Set callback for error events
   * @param {Function} callback - Function to call when errors occur
   */
  setOnError(callback) {
    this.onError = callback;
  }

  /**
   * Get current engine status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.isRunning,
      hasCamera: this.stream !== null,
      targetFPS: this.targetFPS
    };
  }

  /**
   * Update target FPS
   * @param {number} fps - New target FPS
   */
  setTargetFPS(fps) {
    this.targetFPS = Math.max(1, Math.min(30, fps)); // Clamp between 1-30 FPS
    
    if (this.isRunning) {
      // Restart detection loop with new FPS
      this.stopDetection();
      this.startDetection(this.videoElement, this.canvasElement);
    }
  }
}

export default EmotionDetectionEngine;