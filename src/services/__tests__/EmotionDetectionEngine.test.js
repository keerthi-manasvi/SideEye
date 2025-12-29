import EmotionDetectionEngine from '../EmotionDetectionEngine';

// Mock face-api.js
jest.mock('face-api.js', () => ({
  nets: {
    tinyFaceDetector: {
      loadFromUri: jest.fn().mockResolvedValue(true)
    },
    faceLandmark68Net: {
      loadFromUri: jest.fn().mockResolvedValue(true)
    },
    faceRecognitionNet: {
      loadFromUri: jest.fn().mockResolvedValue(true)
    },
    faceExpressionNet: {
      loadFromUri: jest.fn().mockResolvedValue(true)
    }
  },
  detectAllFaces: jest.fn(),
  TinyFaceDetectorOptions: jest.fn()
}));

// Mock navigator.mediaDevices
const mockGetUserMedia = jest.fn();
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: mockGetUserMedia
  }
});

// Mock HTMLVideoElement
const mockVideoElement = {
  srcObject: null,
  onloadedmetadata: null,
  play: jest.fn().mockResolvedValue(undefined),
  paused: false,
  ended: false,
  videoWidth: 640,
  videoHeight: 480
};

// Mock HTMLCanvasElement
const mockCanvasElement = {
  width: 0,
  height: 0,
  getContext: jest.fn().mockReturnValue({
    clearRect: jest.fn(),
    strokeRect: jest.fn(),
    fillText: jest.fn(),
    strokeStyle: '',
    lineWidth: 0,
    fillStyle: '',
    font: ''
  })
};

// Mock MediaStream
const mockStream = {
  getTracks: jest.fn().mockReturnValue([
    { stop: jest.fn() }
  ])
};

describe('EmotionDetectionEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new EmotionDetectionEngine();
    jest.clearAllMocks();
    
    // Reset process.env for tests
    process.env.PUBLIC_URL = '/test';
  });

  afterEach(() => {
    if (engine.isRunning) {
      engine.stopDetection();
    }
  });

  describe('Initialization', () => {
    test('should initialize successfully with all models loaded', async () => {
      const result = await engine.initialize();
      
      expect(result).toBe(true);
      expect(engine.isInitialized).toBe(true);
      
      // Verify all models were loaded
      const faceapi = require('face-api.js');
      expect(faceapi.nets.tinyFaceDetector.loadFromUri).toHaveBeenCalledWith('/test/models');
      expect(faceapi.nets.faceLandmark68Net.loadFromUri).toHaveBeenCalledWith('/test/models');
      expect(faceapi.nets.faceRecognitionNet.loadFromUri).toHaveBeenCalledWith('/test/models');
      expect(faceapi.nets.faceExpressionNet.loadFromUri).toHaveBeenCalledWith('/test/models');
    });

    test('should handle initialization failure gracefully', async () => {
      const faceapi = require('face-api.js');
      faceapi.nets.tinyFaceDetector.loadFromUri.mockRejectedValueOnce(new Error('Model load failed'));
      
      const mockOnError = jest.fn();
      engine.setOnError(mockOnError);
      
      const result = await engine.initialize();
      
      expect(result).toBe(false);
      expect(engine.isInitialized).toBe(false);
      expect(mockOnError).toHaveBeenCalledWith('initialization_failed', expect.any(Error));
    });

    test('should not initialize twice', async () => {
      await engine.initialize();
      const faceapi = require('face-api.js');
      jest.clearAllMocks();
      
      await engine.initialize();
      
      // Models should not be loaded again
      expect(faceapi.nets.tinyFaceDetector.loadFromUri).not.toHaveBeenCalled();
    });
  });

  describe('Camera Access and Detection Start', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should start detection successfully with camera access', async () => {
      mockGetUserMedia.mockResolvedValueOnce(mockStream);
      
      const promise = engine.startDetection(mockVideoElement, mockCanvasElement);
      
      // Simulate video metadata loaded
      setTimeout(() => {
        if (mockVideoElement.onloadedmetadata) {
          mockVideoElement.onloadedmetadata();
        }
      }, 10);
      
      await promise;
      
      expect(engine.isRunning).toBe(true);
      expect(mockVideoElement.srcObject).toBe(mockStream);
      expect(mockVideoElement.play).toHaveBeenCalled();
      expect(mockCanvasElement.width).toBe(640);
      expect(mockCanvasElement.height).toBe(480);
    });

    test('should handle camera access denial', async () => {
      const cameraError = new Error('Permission denied');
      cameraError.name = 'NotAllowedError';
      mockGetUserMedia.mockRejectedValueOnce(cameraError);
      
      const mockOnError = jest.fn();
      engine.setOnError(mockOnError);
      
      await expect(engine.startDetection(mockVideoElement, mockCanvasElement))
        .rejects.toThrow('Permission denied');
      
      expect(engine.isRunning).toBe(false);
      expect(mockOnError).toHaveBeenCalledWith('camera_access_denied', cameraError);
    });

    test('should throw error if not initialized', async () => {
      const uninitializedEngine = new EmotionDetectionEngine();
      
      await expect(uninitializedEngine.startDetection(mockVideoElement, mockCanvasElement))
        .rejects.toThrow('Engine not initialized');
    });

    test('should not start detection if already running', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);
      
      // Start detection first time
      const promise1 = engine.startDetection(mockVideoElement, mockCanvasElement);
      setTimeout(() => mockVideoElement.onloadedmetadata?.(), 10);
      await promise1;
      
      // Try to start again
      jest.clearAllMocks();
      await engine.startDetection(mockVideoElement, mockCanvasElement);
      
      expect(mockGetUserMedia).not.toHaveBeenCalled();
    });
  });

  describe('Emotion Detection Processing', () => {
    beforeEach(async () => {
      await engine.initialize();
      mockGetUserMedia.mockResolvedValue(mockStream);
    });

    test('should process emotions correctly with valid detection', async () => {
      const mockDetection = {
        detection: {
          box: { x: 100, y: 100, width: 200, height: 200 }
        },
        expressions: {
          happy: 0.8,
          sad: 0.1,
          angry: 0.05,
          surprised: 0.03,
          fearful: 0.01,
          disgusted: 0.01,
          neutral: 0.0
        }
      };

      const faceapi = require('face-api.js');
      faceapi.detectAllFaces.mockReturnValue({
        withFaceLandmarks: jest.fn().mockReturnValue({
          withFaceExpressions: jest.fn().mockResolvedValue([mockDetection])
        })
      });

      const mockOnEmotionDetected = jest.fn();
      engine.setOnEmotionDetected(mockOnEmotionDetected);

      // Start detection
      const promise = engine.startDetection(mockVideoElement, mockCanvasElement);
      setTimeout(() => mockVideoElement.onloadedmetadata?.(), 10);
      await promise;

      // Wait for detection loop to run
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockOnEmotionDetected).toHaveBeenCalled();
      const emotionData = mockOnEmotionDetected.mock.calls[0][0];
      
      expect(emotionData.primaryEmotion).toBe('happy');
      expect(emotionData.confidence).toBe(0.8);
      expect(emotionData.energyLevel).toBeGreaterThan(0.5); // Happy should give high energy
      expect(emotionData.emotions).toEqual(expect.objectContaining({
        happy: expect.any(Number),
        sad: expect.any(Number)
      }));
    });

    test('should handle no face detected', async () => {
      const faceapi = require('face-api.js');
      faceapi.detectAllFaces.mockReturnValue({
        withFaceLandmarks: jest.fn().mockReturnValue({
          withFaceExpressions: jest.fn().mockResolvedValue([])
        })
      });

      const mockOnEmotionDetected = jest.fn();
      engine.setOnEmotionDetected(mockOnEmotionDetected);

      // Start detection
      const promise = engine.startDetection(mockVideoElement, mockCanvasElement);
      setTimeout(() => mockVideoElement.onloadedmetadata?.(), 10);
      await promise;

      // Wait for detection loop to run
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should not call emotion detected callback when no face is found
      expect(mockOnEmotionDetected).not.toHaveBeenCalled();
    });

    test('should skip low confidence detections', async () => {
      const mockDetection = {
        detection: {
          box: { x: 100, y: 100, width: 200, height: 200 }
        },
        expressions: {
          happy: 0.3, // Below confidence threshold
          sad: 0.2,
          angry: 0.2,
          surprised: 0.1,
          fearful: 0.1,
          disgusted: 0.05,
          neutral: 0.05
        }
      };

      const faceapi = require('face-api.js');
      faceapi.detectAllFaces.mockReturnValue({
        withFaceLandmarks: jest.fn().mockReturnValue({
          withFaceExpressions: jest.fn().mockResolvedValue([mockDetection])
        })
      });

      const mockOnEmotionDetected = jest.fn();
      engine.setOnEmotionDetected(mockOnEmotionDetected);

      // Start detection
      const promise = engine.startDetection(mockVideoElement, mockCanvasElement);
      setTimeout(() => mockVideoElement.onloadedmetadata?.(), 10);
      await promise;

      // Wait for detection loop to run
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should not call emotion detected callback for low confidence
      expect(mockOnEmotionDetected).not.toHaveBeenCalled();
    });
  });

  describe('Energy Level Calculation', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should calculate high energy for happy emotions', () => {
      const emotions = {
        happy: 0.9,
        sad: 0.05,
        angry: 0.02,
        surprised: 0.02,
        fearful: 0.005,
        disgusted: 0.005,
        neutral: 0.01
      };

      const energyLevel = engine.calculateEnergyLevel(emotions);
      expect(energyLevel).toBeGreaterThan(0.7);
    });

    test('should calculate low energy for sad emotions', () => {
      const emotions = {
        happy: 0.05,
        sad: 0.8,
        angry: 0.05,
        surprised: 0.05,
        fearful: 0.025,
        disgusted: 0.025,
        neutral: 0.0
      };

      const energyLevel = engine.calculateEnergyLevel(emotions);
      expect(energyLevel).toBeLessThan(0.4);
    });

    test('should calculate medium energy for neutral emotions', () => {
      const emotions = {
        happy: 0.1,
        sad: 0.1,
        angry: 0.1,
        surprised: 0.1,
        fearful: 0.1,
        disgusted: 0.1,
        neutral: 0.4
      };

      const energyLevel = engine.calculateEnergyLevel(emotions);
      expect(energyLevel).toBeGreaterThan(0.3);
      expect(energyLevel).toBeLessThan(0.7);
    });
  });

  describe('Temporal Smoothing', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should apply smoothing filter to reduce noise', () => {
      // Add some emotion history
      engine.emotionHistory = [
        {
          emotions: { happy: 0.8, sad: 0.2 },
          confidence: 0.9,
          timestamp: Date.now() - 200
        },
        {
          emotions: { happy: 0.6, sad: 0.4 },
          confidence: 0.8,
          timestamp: Date.now() - 100
        },
        {
          emotions: { happy: 0.9, sad: 0.1 },
          confidence: 0.95,
          timestamp: Date.now()
        }
      ];

      const smoothedEmotions = engine.applySmoothingFilter();
      
      expect(smoothedEmotions.happy).toBeGreaterThan(0.6);
      expect(smoothedEmotions.happy).toBeLessThan(0.9);
      expect(smoothedEmotions.sad).toBeGreaterThan(0.1);
      expect(smoothedEmotions.sad).toBeLessThan(0.4);
    });

    test('should handle empty emotion history', () => {
      engine.emotionHistory = [];
      const smoothedEmotions = engine.applySmoothingFilter();
      expect(smoothedEmotions).toEqual({});
    });
  });

  describe('Detection Control', () => {
    beforeEach(async () => {
      await engine.initialize();
      mockGetUserMedia.mockResolvedValue(mockStream);
    });

    test('should stop detection and clean up resources', async () => {
      // Start detection
      const promise = engine.startDetection(mockVideoElement, mockCanvasElement);
      setTimeout(() => mockVideoElement.onloadedmetadata?.(), 10);
      await promise;

      expect(engine.isRunning).toBe(true);

      // Stop detection
      engine.stopDetection();

      expect(engine.isRunning).toBe(false);
      expect(mockVideoElement.srcObject).toBe(null);
      expect(mockStream.getTracks()[0].stop).toHaveBeenCalled();
    });

    test('should update target FPS', async () => {
      engine.setTargetFPS(15);
      expect(engine.targetFPS).toBe(15);

      // Test clamping
      engine.setTargetFPS(50);
      expect(engine.targetFPS).toBe(30); // Max 30 FPS

      engine.setTargetFPS(-5);
      expect(engine.targetFPS).toBe(1); // Min 1 FPS
    });

    test('should provide correct status information', async () => {
      let status = engine.getStatus();
      expect(status.isInitialized).toBe(true);
      expect(status.isRunning).toBe(false);
      expect(status.hasCamera).toBe(false);

      // Start detection
      const promise = engine.startDetection(mockVideoElement, mockCanvasElement);
      setTimeout(() => mockVideoElement.onloadedmetadata?.(), 10);
      await promise;

      status = engine.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.hasCamera).toBe(true);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should handle detection errors gracefully', async () => {
      const faceapi = require('face-api.js');
      faceapi.detectAllFaces.mockReturnValue({
        withFaceLandmarks: jest.fn().mockReturnValue({
          withFaceExpressions: jest.fn().mockRejectedValue(new Error('Detection failed'))
        })
      });

      const mockOnError = jest.fn();
      engine.setOnError(mockOnError);

      mockGetUserMedia.mockResolvedValue(mockStream);

      // Start detection
      const promise = engine.startDetection(mockVideoElement, mockCanvasElement);
      setTimeout(() => mockVideoElement.onloadedmetadata?.(), 10);
      await promise;

      // Wait for detection loop to run and encounter error
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockOnError).toHaveBeenCalledWith('detection_error', expect.any(Error));
    });

    test('should handle paused or ended video gracefully', async () => {
      mockGetUserMedia.mockResolvedValue(mockStream);
      
      // Start detection
      const promise = engine.startDetection(mockVideoElement, mockCanvasElement);
      setTimeout(() => mockVideoElement.onloadedmetadata?.(), 10);
      await promise;

      // Simulate paused video
      mockVideoElement.paused = true;

      const faceapi = require('face-api.js');
      const mockDetectAllFaces = jest.fn();
      faceapi.detectAllFaces = mockDetectAllFaces;

      // Wait for detection loop to run
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should not attempt detection on paused video
      expect(mockDetectAllFaces).not.toHaveBeenCalled();
    });
  });

  describe('Primary Emotion Detection', () => {
    beforeEach(async () => {
      await engine.initialize();
    });

    test('should correctly identify primary emotion', () => {
      const emotions = {
        happy: 0.1,
        sad: 0.8,
        angry: 0.05,
        surprised: 0.03,
        fearful: 0.01,
        disgusted: 0.01,
        neutral: 0.0
      };

      const primaryEmotion = engine.getPrimaryEmotion(emotions);
      expect(primaryEmotion).toBe('sad');
    });

    test('should default to neutral when all emotions are zero', () => {
      const emotions = {
        happy: 0,
        sad: 0,
        angry: 0,
        surprised: 0,
        fearful: 0,
        disgusted: 0,
        neutral: 0
      };

      const primaryEmotion = engine.getPrimaryEmotion(emotions);
      expect(primaryEmotion).toBe('neutral');
    });
  });
});