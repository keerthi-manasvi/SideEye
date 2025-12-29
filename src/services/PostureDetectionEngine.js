import * as posenet from '@tensorflow-models/posenet';
import * as tf from '@tensorflow/tfjs';

class PostureDetectionEngine {
  constructor() {
    this.isInitialized = false;
    this.isRunning = false;
    this.videoElement = null;
    this.canvasElement = null;
    this.posenetModel = null;
    this.detectionInterval = null;
    this.targetFPS = 5; // Lower FPS for posture detection to save resources
    this.onPostureDetected = null;
    this.onError = null;
    
    // Posture analysis state
    this.postureHistory = [];
    this.blinkHistory = [];
    this.maxHistoryLength = 20; // Keep last 20 readings
    
    // Health thresholds
    this.postureThresholds = {
      goodPosture: 0.7,
      poorPosture: 0.4,
      alertThreshold: 0.3 // Trigger alert if below this for extended time
    };
    
    this.blinkThresholds = {
      normalBlinkRate: 15, // blinks per minute
      lowBlinkRate: 8, // Alert threshold
      eyeAspectRatioThreshold: 0.25 // EAR threshold for blink detection
    };
    
    // Wellness alert state
    this.poorPostureStartTime = null;
    this.lowBlinkRateStartTime = null;
    this.alertCooldownMs = 5 * 60 * 1000; // 5 minutes between alerts
    this.lastPostureAlert = 0;
    this.lastBlinkAlert = 0;
  }

  /**
   * Initialize the posture detection engine
   */
  async initialize() {
    try {
      console.log('Initializing PostureDetectionEngine...');
      
      // Load PoseNet model
      this.posenetModel = await posenet.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        inputResolution: { width: 640, height: 480 },
        multiplier: 0.75 // Balance between accuracy and performance
      });
      
      this.isInitialized = true;
      console.log('PostureDetectionEngine initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize PostureDetectionEngine:', error);
      if (this.onError) {
        this.onError('initialization_failed', error);
      }
      return false;
    }
  }

  /**
   * Start posture and blink detection
   * @param {HTMLVideoElement} videoElement - Video element for pose detection
   * @param {HTMLCanvasElement} canvasElement - Canvas for drawing results
   */
  async startDetection(videoElement, canvasElement) {
    if (!this.isInitialized) {
      throw new Error('Engine not initialized. Call initialize() first.');
    }

    if (this.isRunning) {
      console.warn('Posture detection already running');
      return;
    }

    try {
      this.videoElement = videoElement;
      this.canvasElement = canvasElement;
      
      // Start detection loop
      this.isRunning = true;
      this.startDetectionLoop();
      
      console.log('Posture detection started successfully');
    } catch (error) {
      console.error('Failed to start posture detection:', error);
      if (this.onError) {
        this.onError('detection_start_failed', error);
      }
      throw error;
    }
  }

  /**
   * Stop posture detection
   */
  stopDetection() {
    this.isRunning = false;
    
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }

    console.log('Posture detection stopped');
  }

  /**
   * Main detection loop
   */
  startDetectionLoop() {
    const intervalMs = 1000 / this.targetFPS;
    
    this.detectionInterval = setInterval(async () => {
      if (!this.isRunning || !this.videoElement) {
        return;
      }

      try {
        await this.detectPostureAndBlinks();
      } catch (error) {
        console.error('Error in posture detection loop:', error);
        if (this.onError) {
          this.onError('detection_error', error);
        }
      }
    }, intervalMs);
  }

  /**
   * Perform posture and blink detection on current video frame
   */
  async detectPostureAndBlinks() {
    if (!this.videoElement || this.videoElement.paused || this.videoElement.ended) {
      return;
    }

    try {
      // Get pose estimation
      const pose = await this.posenetModel.estimateSinglePose(this.videoElement, {
        flipHorizontal: false,
        decodingMethod: 'single-person'
      });

      if (pose.score < 0.3) {
        // Low confidence pose detection, skip this frame
        return;
      }

      // Analyze posture
      const postureAnalysis = this.analyzePosture(pose);
      
      // Detect blinks using facial landmarks (if available from face-api.js)
      const blinkAnalysis = this.analyzeBlinkRate(pose);
      
      // Combine results
      const wellnessData = {
        posture: postureAnalysis,
        blinks: blinkAnalysis,
        timestamp: Date.now(),
        confidence: pose.score
      };

      // Update history
      this.updateHistory(wellnessData);
      
      // Check for wellness alerts
      this.checkWellnessAlerts(wellnessData);
      
      // Draw detection results
      this.drawDetectionResults(pose, wellnessData);
      
      // Notify listeners
      if (this.onPostureDetected) {
        this.onPostureDetected(wellnessData);
      }

    } catch (error) {
      console.error('Error detecting posture:', error);
      throw error;
    }
  }

  /**
   * Analyze posture from pose keypoints
   * @param {Object} pose - PoseNet pose estimation result
   */
  analyzePosture(pose) {
    const keypoints = pose.keypoints;
    
    // Get key body parts for posture analysis
    const nose = this.getKeypoint(keypoints, 'nose');
    const leftShoulder = this.getKeypoint(keypoints, 'leftShoulder');
    const rightShoulder = this.getKeypoint(keypoints, 'rightShoulder');
    const leftEar = this.getKeypoint(keypoints, 'leftEar');
    const rightEar = this.getKeypoint(keypoints, 'rightEar');

    if (!nose || !leftShoulder || !rightShoulder) {
      return {
        score: 0,
        alignment: 'unknown',
        shoulderLevel: 0,
        headForward: 0,
        confidence: 0
      };
    }

    // Calculate shoulder alignment
    const shoulderAlignment = this.calculateShoulderAlignment(leftShoulder, rightShoulder);
    
    // Calculate head forward posture
    const headForward = this.calculateHeadForwardPosture(nose, leftShoulder, rightShoulder);
    
    // Calculate overall posture score
    const postureScore = this.calculatePostureScore(shoulderAlignment, headForward);
    
    // Determine posture classification
    let alignment = 'good';
    if (postureScore < this.postureThresholds.poorPosture) {
      alignment = 'poor';
    } else if (postureScore < this.postureThresholds.goodPosture) {
      alignment = 'fair';
    }

    return {
      score: postureScore,
      alignment: alignment,
      shoulderLevel: shoulderAlignment.levelness,
      headForward: headForward,
      confidence: Math.min(nose.score, leftShoulder.score, rightShoulder.score)
    };
  }

  /**
   * Analyze blink rate using eye landmarks
   * @param {Object} pose - PoseNet pose estimation result
   */
  analyzeBlinkRate(pose) {
    const keypoints = pose.keypoints;
    
    // Get eye keypoints
    const leftEye = this.getKeypoint(keypoints, 'leftEye');
    const rightEye = this.getKeypoint(keypoints, 'rightEye');

    if (!leftEye || !rightEye) {
      return {
        blinkRate: 0,
        eyeAspectRatio: 0,
        isBlinking: false,
        confidence: 0
      };
    }

    // Calculate eye aspect ratio (simplified version)
    // Note: PoseNet doesn't provide detailed eye landmarks like face-api.js
    // This is a simplified approximation
    const eyeAspectRatio = this.calculateSimplifiedEAR(leftEye, rightEye);
    
    // Detect blink based on EAR threshold
    const isBlinking = eyeAspectRatio < this.blinkThresholds.eyeAspectRatioThreshold;
    
    // Calculate blink rate from history
    const blinkRate = this.calculateBlinkRate();

    return {
      blinkRate: blinkRate,
      eyeAspectRatio: eyeAspectRatio,
      isBlinking: isBlinking,
      confidence: Math.min(leftEye.score, rightEye.score)
    };
  }

  /**
   * Get keypoint by name from pose keypoints
   * @param {Array} keypoints - Array of pose keypoints
   * @param {string} name - Keypoint name
   */
  getKeypoint(keypoints, name) {
    const keypointMap = {
      'nose': 0,
      'leftEye': 1,
      'rightEye': 2,
      'leftEar': 3,
      'rightEar': 4,
      'leftShoulder': 5,
      'rightShoulder': 6,
      'leftElbow': 7,
      'rightElbow': 8,
      'leftWrist': 9,
      'rightWrist': 10,
      'leftHip': 11,
      'rightHip': 12,
      'leftKnee': 13,
      'rightKnee': 14,
      'leftAnkle': 15,
      'rightAnkle': 16
    };

    const index = keypointMap[name];
    if (index !== undefined && keypoints[index] && keypoints[index].score > 0.3) {
      return keypoints[index];
    }
    return null;
  }

  /**
   * Calculate shoulder alignment
   * @param {Object} leftShoulder - Left shoulder keypoint
   * @param {Object} rightShoulder - Right shoulder keypoint
   */
  calculateShoulderAlignment(leftShoulder, rightShoulder) {
    const heightDiff = Math.abs(leftShoulder.position.y - rightShoulder.position.y);
    const shoulderWidth = Math.abs(leftShoulder.position.x - rightShoulder.position.x);
    
    // Calculate levelness (0 = perfectly level, 1 = very uneven)
    const levelness = Math.min(1, heightDiff / (shoulderWidth * 0.1));
    
    return {
      levelness: 1 - levelness, // Invert so 1 = good, 0 = bad
      heightDifference: heightDiff
    };
  }

  /**
   * Calculate head forward posture
   * @param {Object} nose - Nose keypoint
   * @param {Object} leftShoulder - Left shoulder keypoint
   * @param {Object} rightShoulder - Right shoulder keypoint
   */
  calculateHeadForwardPosture(nose, leftShoulder, rightShoulder) {
    // Calculate average shoulder position
    const avgShoulderX = (leftShoulder.position.x + rightShoulder.position.x) / 2;
    const avgShoulderY = (leftShoulder.position.y + rightShoulder.position.y) / 2;
    
    // Calculate head forward distance
    const headForwardDistance = Math.abs(nose.position.x - avgShoulderX);
    const shoulderToHeadDistance = Math.abs(nose.position.y - avgShoulderY);
    
    // Normalize head forward ratio (0 = good alignment, 1 = very forward)
    const headForwardRatio = Math.min(1, headForwardDistance / (shoulderToHeadDistance * 0.3));
    
    return 1 - headForwardRatio; // Invert so 1 = good, 0 = bad
  }

  /**
   * Calculate overall posture score
   * @param {Object} shoulderAlignment - Shoulder alignment data
   * @param {number} headForward - Head forward posture score
   */
  calculatePostureScore(shoulderAlignment, headForward) {
    // Weighted combination of posture factors
    const shoulderWeight = 0.4;
    const headWeight = 0.6;
    
    return (shoulderAlignment.levelness * shoulderWeight) + (headForward * headWeight);
  }

  /**
   * Calculate simplified Eye Aspect Ratio
   * @param {Object} leftEye - Left eye keypoint
   * @param {Object} rightEye - Right eye keypoint
   */
  calculateSimplifiedEAR(leftEye, rightEye) {
    // This is a simplified version since PoseNet doesn't provide detailed eye landmarks
    // In a real implementation, you'd use face-api.js landmarks for accurate EAR calculation
    const eyeDistance = Math.sqrt(
      Math.pow(rightEye.position.x - leftEye.position.x, 2) +
      Math.pow(rightEye.position.y - leftEye.position.y, 2)
    );
    
    // Normalize based on typical eye distance (this is approximate)
    const normalizedEAR = Math.min(1, eyeDistance / 100);
    
    return normalizedEAR;
  }

  /**
   * Calculate blink rate from blink history
   */
  calculateBlinkRate() {
    if (this.blinkHistory.length < 2) {
      return 0;
    }

    // Count blinks in the last minute
    const oneMinuteAgo = Date.now() - 60000;
    const recentBlinks = this.blinkHistory.filter(blink => blink.timestamp > oneMinuteAgo);
    
    return recentBlinks.length;
  }

  /**
   * Update posture and blink history
   * @param {Object} wellnessData - Current wellness data
   */
  updateHistory(wellnessData) {
    // Update posture history
    this.postureHistory.push({
      score: wellnessData.posture.score,
      alignment: wellnessData.posture.alignment,
      timestamp: wellnessData.timestamp
    });

    // Keep history within limits
    if (this.postureHistory.length > this.maxHistoryLength) {
      this.postureHistory.shift();
    }

    // Update blink history if a blink is detected
    if (wellnessData.blinks.isBlinking) {
      this.blinkHistory.push({
        timestamp: wellnessData.timestamp,
        eyeAspectRatio: wellnessData.blinks.eyeAspectRatio
      });

      // Keep blink history for last 2 minutes
      const twoMinutesAgo = Date.now() - 120000;
      this.blinkHistory = this.blinkHistory.filter(blink => blink.timestamp > twoMinutesAgo);
    }
  }

  /**
   * Check for wellness alerts and trigger notifications
   * @param {Object} wellnessData - Current wellness data
   */
  checkWellnessAlerts(wellnessData) {
    const now = Date.now();
    
    // Check poor posture alert
    if (wellnessData.posture.score < this.postureThresholds.alertThreshold) {
      if (!this.poorPostureStartTime) {
        this.poorPostureStartTime = now;
      } else if (now - this.poorPostureStartTime > 5 * 60 * 1000) { // 5 minutes of poor posture
        if (now - this.lastPostureAlert > this.alertCooldownMs) {
          this.triggerPostureAlert(wellnessData.posture);
          this.lastPostureAlert = now;
        }
      }
    } else {
      this.poorPostureStartTime = null;
    }

    // Check low blink rate alert
    if (wellnessData.blinks.blinkRate < this.blinkThresholds.lowBlinkRate) {
      if (!this.lowBlinkRateStartTime) {
        this.lowBlinkRateStartTime = now;
      } else if (now - this.lowBlinkRateStartTime > 3 * 60 * 1000) { // 3 minutes of low blink rate
        if (now - this.lastBlinkAlert > this.alertCooldownMs) {
          this.triggerBlinkAlert(wellnessData.blinks);
          this.lastBlinkAlert = now;
        }
      }
    } else {
      this.lowBlinkRateStartTime = null;
    }
  }

  /**
   * Trigger posture alert
   * @param {Object} postureData - Current posture data
   */
  triggerPostureAlert(postureData) {
    console.log('Triggering posture alert:', postureData);
    
    if (this.onPostureDetected) {
      this.onPostureDetected({
        type: 'posture_alert',
        message: 'Poor posture detected for extended period. Consider adjusting your sitting position.',
        severity: 'warning',
        data: postureData,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Trigger blink rate alert
   * @param {Object} blinkData - Current blink data
   */
  triggerBlinkAlert(blinkData) {
    console.log('Triggering blink alert:', blinkData);
    
    if (this.onPostureDetected) {
      this.onPostureDetected({
        type: 'blink_alert',
        message: 'Low blink rate detected. Take a break to rest your eyes.',
        severity: 'warning',
        data: blinkData,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Draw detection results on canvas
   * @param {Object} pose - PoseNet pose result
   * @param {Object} wellnessData - Wellness analysis data
   */
  drawDetectionResults(pose, wellnessData) {
    if (!this.canvasElement) return;

    const ctx = this.canvasElement.getContext('2d');
    ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);

    // Draw pose skeleton
    this.drawPoseSkeleton(ctx, pose);
    
    // Draw posture status
    this.drawPostureStatus(ctx, wellnessData.posture);
    
    // Draw blink status
    this.drawBlinkStatus(ctx, wellnessData.blinks);
  }

  /**
   * Draw pose skeleton on canvas
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} pose - PoseNet pose result
   */
  drawPoseSkeleton(ctx, pose) {
    const keypoints = pose.keypoints;
    
    // Draw keypoints
    keypoints.forEach(keypoint => {
      if (keypoint.score > 0.3) {
        ctx.beginPath();
        ctx.arc(keypoint.position.x, keypoint.position.y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#00ff00';
        ctx.fill();
      }
    });

    // Draw skeleton connections
    const connections = [
      ['leftShoulder', 'rightShoulder'],
      ['leftShoulder', 'leftElbow'],
      ['rightShoulder', 'rightElbow'],
      ['leftElbow', 'leftWrist'],
      ['rightElbow', 'rightWrist'],
      ['nose', 'leftEye'],
      ['nose', 'rightEye']
    ];

    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;

    connections.forEach(([startName, endName]) => {
      const start = this.getKeypoint(keypoints, startName);
      const end = this.getKeypoint(keypoints, endName);
      
      if (start && end) {
        ctx.beginPath();
        ctx.moveTo(start.position.x, start.position.y);
        ctx.lineTo(end.position.x, end.position.y);
        ctx.stroke();
      }
    });
  }

  /**
   * Draw posture status on canvas
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} postureData - Posture analysis data
   */
  drawPostureStatus(ctx, postureData) {
    ctx.fillStyle = postureData.alignment === 'good' ? '#00ff00' : 
                   postureData.alignment === 'fair' ? '#ffff00' : '#ff0000';
    ctx.font = '16px Arial';
    ctx.fillText(
      `Posture: ${postureData.alignment} (${(postureData.score * 100).toFixed(1)}%)`,
      10, 30
    );
  }

  /**
   * Draw blink status on canvas
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} blinkData - Blink analysis data
   */
  drawBlinkStatus(ctx, blinkData) {
    ctx.fillStyle = blinkData.blinkRate >= this.blinkThresholds.normalBlinkRate ? '#00ff00' : '#ff0000';
    ctx.font = '16px Arial';
    ctx.fillText(
      `Blink Rate: ${blinkData.blinkRate}/min`,
      10, 55
    );
    
    if (blinkData.isBlinking) {
      ctx.fillStyle = '#ffff00';
      ctx.fillText('BLINK', 10, 80);
    }
  }

  /**
   * Set callback for posture detection events
   * @param {Function} callback - Function to call when posture data is available
   */
  setOnPostureDetected(callback) {
    this.onPostureDetected = callback;
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
      targetFPS: this.targetFPS,
      postureHistoryLength: this.postureHistory.length,
      blinkHistoryLength: this.blinkHistory.length
    };
  }

  /**
   * Update target FPS
   * @param {number} fps - New target FPS
   */
  setTargetFPS(fps) {
    this.targetFPS = Math.max(1, Math.min(10, fps)); // Clamp between 1-10 FPS
    
    if (this.isRunning) {
      // Restart detection loop with new FPS
      this.stopDetection();
      this.startDetection(this.videoElement, this.canvasElement);
    }
  }

  /**
   * Get posture history for analysis
   */
  getPostureHistory() {
    return [...this.postureHistory];
  }

  /**
   * Get blink history for analysis
   */
  getBlinkHistory() {
    return [...this.blinkHistory];
  }

  /**
   * Update health thresholds
   * @param {Object} newThresholds - New threshold values
   */
  updateThresholds(newThresholds) {
    if (newThresholds.posture) {
      this.postureThresholds = { ...this.postureThresholds, ...newThresholds.posture };
    }
    if (newThresholds.blink) {
      this.blinkThresholds = { ...this.blinkThresholds, ...newThresholds.blink };
    }
  }
}

export default PostureDetectionEngine;