import PostureDetectionEngine from '../PostureDetectionEngine';

// Mock TensorFlow and PoseNet
jest.mock('@tensorflow-models/posenet', () => ({
  load: jest.fn(() => Promise.resolve({
    estimateSinglePose: jest.fn()
  }))
}));

jest.mock('@tensorflow/tfjs', () => ({}));

describe('PostureDetectionEngine', () => {
  let engine;
  let mockVideoElement;
  let mockCanvasElement;
  let mockCanvasContext;

  beforeEach(() => {
    engine = new PostureDetectionEngine();
    
    // Mock video element
    mockVideoElement = {
      paused: false,
      ended: false,
      videoWidth: 640,
      videoHeight: 480
    };

    // Mock canvas context
    mockCanvasContext = {
      clearRect: jest.fn(),
      strokeRect: jest.fn(),
      fillText: jest.fn(),
      beginPath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn()
    };

    // Mock canvas element
    mockCanvasElement = {
      width: 640,
      height: 480,
      getContext: jest.fn(() => mockCanvasContext)
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const result = await engine.initialize();
      expect(result).toBe(true);
      expect(engine.isInitialized).toBe(true);
    });

    it('should handle initialization failure', async () => {
      const posenet = require('@tensorflow-models/posenet');
      posenet.load.mockRejectedValueOnce(new Error('Model load failed'));

      const onError = jest.fn();
      engine.setOnError(onError);

      const result = await engine.initialize();
      expect(result).toBe(false);
      expect(engine.isInitialized).toBe(false);
      expect(onError).toHaveBeenCalledWith('initialization_failed', expect.any(Error));
    });
  });

  describe('detection lifecycle', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should start detection successfully', async () => {
      await engine.startDetection(mockVideoElement, mockCanvasElement);
      expect(engine.isRunning).toBe(true);
    });

    it('should stop detection', async () => {
      await engine.startDetection(mockVideoElement, mockCanvasElement);
      engine.stopDetection();
      expect(engine.isRunning).toBe(false);
    });

    it('should throw error if not initialized', async () => {
      const uninitializedEngine = new PostureDetectionEngine();
      await expect(uninitializedEngine.startDetection(mockVideoElement, mockCanvasElement))
        .rejects.toThrow('Engine not initialized');
    });
  });

  describe('posture analysis', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should analyze good posture correctly', () => {
      const mockPose = {
        keypoints: [
          { position: { x: 320, y: 200 }, score: 0.9 }, // nose
          { position: { x: 300, y: 210 }, score: 0.8 }, // leftEye
          { position: { x: 340, y: 210 }, score: 0.8 }, // rightEye
          { position: { x: 290, y: 220 }, score: 0.7 }, // leftEar
          { position: { x: 350, y: 220 }, score: 0.7 }, // rightEar
          { position: { x: 280, y: 300 }, score: 0.9 }, // leftShoulder
          { position: { x: 360, y: 300 }, score: 0.9 }, // rightShoulder
        ],
        score: 0.8
      };

      const result = engine.analyzePosture(mockPose);
      
      expect(result.score).toBeGreaterThan(0);
      expect(result.alignment).toBeDefined();
      expect(result.shoulderLevel).toBeGreaterThanOrEqual(0);
      expect(result.headForward).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle missing keypoints gracefully', () => {
      const mockPose = {
        keypoints: [
          { position: { x: 320, y: 200 }, score: 0.1 }, // low confidence nose
        ],
        score: 0.3
      };

      const result = engine.analyzePosture(mockPose);
      
      expect(result.score).toBe(0);
      expect(result.alignment).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    it('should classify posture alignment correctly', () => {
      // Test good posture
      const goodPosturePose = {
        keypoints: [
          { position: { x: 320, y: 200 }, score: 0.9 }, // nose
          null, null, null, null,
          { position: { x: 300, y: 300 }, score: 0.9 }, // leftShoulder
          { position: { x: 340, y: 300 }, score: 0.9 }, // rightShoulder (level shoulders)
        ],
        score: 0.8
      };

      const goodResult = engine.analyzePosture(goodPosturePose);
      expect(goodResult.alignment).toBe('good');

      // Test poor posture
      const poorPosturePose = {
        keypoints: [
          { position: { x: 400, y: 200 }, score: 0.9 }, // nose (head forward)
          null, null, null, null,
          { position: { x: 300, y: 300 }, score: 0.9 }, // leftShoulder
          { position: { x: 340, y: 350 }, score: 0.9 }, // rightShoulder (uneven)
        ],
        score: 0.8
      };

      const poorResult = engine.analyzePosture(poorPosturePose);
      expect(poorResult.alignment).toBe('poor');
    });
  });

  describe('blink analysis', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should analyze blink rate', () => {
      const mockPose = {
        keypoints: [
          null, // nose
          { position: { x: 300, y: 210 }, score: 0.8 }, // leftEye
          { position: { x: 340, y: 210 }, score: 0.8 }, // rightEye
        ],
        score: 0.8
      };

      const result = engine.analyzeBlinkRate(mockPose);
      
      expect(result.blinkRate).toBeGreaterThanOrEqual(0);
      expect(result.eyeAspectRatio).toBeGreaterThanOrEqual(0);
      expect(typeof result.isBlinking).toBe('boolean');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle missing eye keypoints', () => {
      const mockPose = {
        keypoints: [
          { position: { x: 320, y: 200 }, score: 0.9 }, // nose only
        ],
        score: 0.8
      };

      const result = engine.analyzeBlinkRate(mockPose);
      
      expect(result.blinkRate).toBe(0);
      expect(result.eyeAspectRatio).toBe(0);
      expect(result.isBlinking).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should calculate blink rate from history', () => {
      // Add some blinks to history
      const now = Date.now();
      engine.blinkHistory = [
        { timestamp: now - 30000, eyeAspectRatio: 0.2 }, // 30 seconds ago
        { timestamp: now - 45000, eyeAspectRatio: 0.15 }, // 45 seconds ago
        { timestamp: now - 90000, eyeAspectRatio: 0.18 }, // 90 seconds ago (should be filtered out)
      ];

      const blinkRate = engine.calculateBlinkRate();
      expect(blinkRate).toBe(2); // Only 2 blinks in the last minute
    });
  });

  describe('wellness alerts', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should trigger posture alert after extended poor posture', () => {
      const onPostureDetected = jest.fn();
      engine.setOnPostureDetected(onPostureDetected);

      const poorPostureData = {
        posture: { score: 0.2 }, // Below alert threshold
        blinks: { blinkRate: 15 },
        timestamp: Date.now()
      };

      // Simulate poor posture for 5+ minutes
      engine.poorPostureStartTime = Date.now() - 6 * 60 * 1000;
      engine.lastPostureAlert = 0; // No recent alerts

      engine.checkWellnessAlerts(poorPostureData);

      expect(onPostureDetected).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'posture_alert',
          severity: 'warning'
        })
      );
    });

    it('should trigger blink alert after extended low blink rate', () => {
      const onPostureDetected = jest.fn();
      engine.setOnPostureDetected(onPostureDetected);

      const lowBlinkData = {
        posture: { score: 0.8 },
        blinks: { blinkRate: 5 }, // Below low blink threshold
        timestamp: Date.now()
      };

      // Simulate low blink rate for 3+ minutes
      engine.lowBlinkRateStartTime = Date.now() - 4 * 60 * 1000;
      engine.lastBlinkAlert = 0; // No recent alerts

      engine.checkWellnessAlerts(lowBlinkData);

      expect(onPostureDetected).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'blink_alert',
          severity: 'warning'
        })
      );
    });

    it('should respect alert cooldown period', () => {
      const onPostureDetected = jest.fn();
      engine.setOnPostureDetected(onPostureDetected);

      const poorPostureData = {
        posture: { score: 0.2 },
        blinks: { blinkRate: 15 },
        timestamp: Date.now()
      };

      // Set recent alert
      engine.poorPostureStartTime = Date.now() - 6 * 60 * 1000;
      engine.lastPostureAlert = Date.now() - 2 * 60 * 1000; // 2 minutes ago (within cooldown)

      engine.checkWellnessAlerts(poorPostureData);

      expect(onPostureDetected).not.toHaveBeenCalled();
    });

    it('should reset alert timers when conditions improve', () => {
      engine.poorPostureStartTime = Date.now() - 6 * 60 * 1000;
      engine.lowBlinkRateStartTime = Date.now() - 4 * 60 * 1000;

      const goodWellnessData = {
        posture: { score: 0.8 }, // Good posture
        blinks: { blinkRate: 18 }, // Good blink rate
        timestamp: Date.now()
      };

      engine.checkWellnessAlerts(goodWellnessData);

      expect(engine.poorPostureStartTime).toBeNull();
      expect(engine.lowBlinkRateStartTime).toBeNull();
    });
  });

  describe('utility functions', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should get keypoint by name', () => {
      const keypoints = [
        { position: { x: 320, y: 200 }, score: 0.9 }, // nose (index 0)
        { position: { x: 300, y: 210 }, score: 0.8 }, // leftEye (index 1)
      ];

      const nose = engine.getKeypoint(keypoints, 'nose');
      const leftEye = engine.getKeypoint(keypoints, 'leftEye');
      const missing = engine.getKeypoint(keypoints, 'rightEye');

      expect(nose).toEqual(keypoints[0]);
      expect(leftEye).toEqual(keypoints[1]);
      expect(missing).toBeNull();
    });

    it('should calculate shoulder alignment', () => {
      const levelShoulders = {
        leftShoulder: { position: { x: 300, y: 300 }, score: 0.9 },
        rightShoulder: { position: { x: 340, y: 300 }, score: 0.9 }
      };

      const unevenShoulders = {
        leftShoulder: { position: { x: 300, y: 300 }, score: 0.9 },
        rightShoulder: { position: { x: 340, y: 320 }, score: 0.9 }
      };

      const levelResult = engine.calculateShoulderAlignment(
        levelShoulders.leftShoulder, 
        levelShoulders.rightShoulder
      );
      const unevenResult = engine.calculateShoulderAlignment(
        unevenShoulders.leftShoulder, 
        unevenShoulders.rightShoulder
      );

      expect(levelResult.levelness).toBeGreaterThan(unevenResult.levelness);
      expect(levelResult.heightDifference).toBeLessThan(unevenResult.heightDifference);
    });

    it('should calculate head forward posture', () => {
      const goodAlignment = {
        nose: { position: { x: 320, y: 200 }, score: 0.9 },
        leftShoulder: { position: { x: 300, y: 300 }, score: 0.9 },
        rightShoulder: { position: { x: 340, y: 300 }, score: 0.9 }
      };

      const forwardHead = {
        nose: { position: { x: 400, y: 200 }, score: 0.9 }, // Head forward
        leftShoulder: { position: { x: 300, y: 300 }, score: 0.9 },
        rightShoulder: { position: { x: 340, y: 300 }, score: 0.9 }
      };

      const goodResult = engine.calculateHeadForwardPosture(
        goodAlignment.nose,
        goodAlignment.leftShoulder,
        goodAlignment.rightShoulder
      );

      const forwardResult = engine.calculateHeadForwardPosture(
        forwardHead.nose,
        forwardHead.leftShoulder,
        forwardHead.rightShoulder
      );

      expect(goodResult).toBeGreaterThan(forwardResult);
    });

    it('should update thresholds', () => {
      const newThresholds = {
        posture: {
          goodPosture: 0.8,
          poorPosture: 0.5
        },
        blink: {
          normalBlinkRate: 20
        }
      };

      engine.updateThresholds(newThresholds);

      expect(engine.postureThresholds.goodPosture).toBe(0.8);
      expect(engine.postureThresholds.poorPosture).toBe(0.5);
      expect(engine.blinkThresholds.normalBlinkRate).toBe(20);
      // Should preserve existing thresholds not specified
      expect(engine.postureThresholds.alertThreshold).toBe(0.3);
    });

    it('should get status information', () => {
      const status = engine.getStatus();
      
      expect(status).toHaveProperty('isInitialized');
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('targetFPS');
      expect(status).toHaveProperty('postureHistoryLength');
      expect(status).toHaveProperty('blinkHistoryLength');
    });

    it('should set target FPS within valid range', () => {
      engine.setTargetFPS(15); // Above max
      expect(engine.targetFPS).toBe(10);

      engine.setTargetFPS(0); // Below min
      expect(engine.targetFPS).toBe(1);

      engine.setTargetFPS(7); // Valid range
      expect(engine.targetFPS).toBe(7);
    });
  });

  describe('history management', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    it('should update posture history', () => {
      const wellnessData = {
        posture: {
          score: 0.8,
          alignment: 'good'
        },
        blinks: {
          isBlinking: false
        },
        timestamp: Date.now()
      };

      engine.updateHistory(wellnessData);

      expect(engine.postureHistory).toHaveLength(1);
      expect(engine.postureHistory[0].score).toBe(0.8);
      expect(engine.postureHistory[0].alignment).toBe('good');
    });

    it('should update blink history when blinking', () => {
      const wellnessData = {
        posture: {
          score: 0.8,
          alignment: 'good'
        },
        blinks: {
          isBlinking: true,
          eyeAspectRatio: 0.2
        },
        timestamp: Date.now()
      };

      engine.updateHistory(wellnessData);

      expect(engine.blinkHistory).toHaveLength(1);
      expect(engine.blinkHistory[0].eyeAspectRatio).toBe(0.2);
    });

    it('should limit history length', () => {
      // Add more than max history length
      for (let i = 0; i < engine.maxHistoryLength + 5; i++) {
        const wellnessData = {
          posture: {
            score: 0.8,
            alignment: 'good'
          },
          blinks: {
            isBlinking: false
          },
          timestamp: Date.now() + i
        };
        engine.updateHistory(wellnessData);
      }

      expect(engine.postureHistory).toHaveLength(engine.maxHistoryLength);
    });

    it('should clean old blink history', () => {
      const now = Date.now();
      engine.blinkHistory = [
        { timestamp: now - 30000, eyeAspectRatio: 0.2 }, // 30 seconds ago
        { timestamp: now - 150000, eyeAspectRatio: 0.15 }, // 2.5 minutes ago (should be removed)
      ];

      const wellnessData = {
        posture: { score: 0.8, alignment: 'good' },
        blinks: { isBlinking: true, eyeAspectRatio: 0.18 },
        timestamp: now
      };

      engine.updateHistory(wellnessData);

      // Should have 2 blinks: the recent one and the new one
      expect(engine.blinkHistory).toHaveLength(2);
      expect(engine.blinkHistory.every(blink => blink.timestamp > now - 120000)).toBe(true);
    });
  });
});