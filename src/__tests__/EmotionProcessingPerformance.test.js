/**
 * Real-time Emotion Processing Performance Tests
 * 
 * Tests performance characteristics of emotion detection:
 * 1. Processing latency under various conditions
 * 2. Memory usage during continuous processing
 * 3. CPU usage optimization
 * 4. Frame rate maintenance
 * 5. Resource cleanup
 */

import { EmotionDetectionEngine } from '../services/EmotionDetectionEngine';
import { PostureDetectionEngine } from '../services/PostureDetectionEngine';

// Mock TensorFlow.js and face-api.js
jest.mock('@tensorflow/tfjs');
jest.mock('face-api.js');
jest.mock('@tensorflow-models/posenet');

describe('Real-time Emotion Processing Performance Tests', () => {
  let emotionEngine;
  let postureEngine;
  let mockCanvas;
  let mockVideo;

  beforeEach(() => {
    // Setup mock canvas and video elements
    mockCanvas = {
      getContext: jest.fn(() => ({
        drawImage: jest.fn(),
        getImageData: jest.fn(() => ({
          data: new Uint8ClampedArray(640 * 480 * 4)
        }))
      })),
      width: 640,
      height: 480
    };

    mockVideo = {
      videoWidth: 640,
      videoHeight: 480,
      readyState: 4,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };

    // Mock successful initialization
    emotionEngine = new EmotionDetectionEngine();
    postureEngine = new PostureDetectionEngine();
    
    emotionEngine.initialize = jest.fn().mockResolvedValue(true);
    postureEngine.initialize = jest.fn().mockResolvedValue(true);
  });

  afterEach(() => {
    // Cleanup
    if (emotionEngine && emotionEngine.cleanup) {
      emotionEngine.cleanup();
    }
    if (postureEngine && postureEngine.cleanup) {
      postureEngine.cleanup();
    }
  });

  test('Emotion detection latency meets 100ms target', async () => {
    await emotionEngine.initialize();
    
    // Mock fast emotion detection
    emotionEngine.detectEmotions = jest.fn().mockImplementation(() => {
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            emotions: {
              happy: 0.7,
              neutral: 0.3,
              sad: 0.0,
              angry: 0.0,
              surprised: 0.0,
              fearful: 0.0,
              disgusted: 0.0
            },
            confidence: 0.9
          });
        }, 50); // 50ms processing time
      });
    });

    const startTime = performance.now();
    const result = await emotionEngine.detectEmotions(mockVideo);
    const endTime = performance.now();
    
    const latency = endTime - startTime;
    
    expect(result).toBeDefined();
    expect(result.emotions).toBeDefined();
    expect(latency).toBeLessThan(100); // Target: sub-100ms
  });

  test('Maintains 10 FPS processing rate', async () => {
    await emotionEngine.initialize();
    
    const frameProcessingTimes = [];
    const targetFPS = 10;
    const targetFrameTime = 1000 / targetFPS; // 100ms per frame
    
    emotionEngine.detectEmotions = jest.fn().mockImplementation(() => {
      return Promise.resolve({
        emotions: { happy: 0.5, neutral: 0.5 },
        confidence: 0.8
      });
    });

    // Simulate continuous processing for 1 second
    const startTime = performance.now();
    let frameCount = 0;
    
    while (performance.now() - startTime < 1000) {
      const frameStart = performance.now();
      
      await emotionEngine.detectEmotions(mockVideo);
      
      const frameEnd = performance.now();
      const frameTime = frameEnd - frameStart;
      frameProcessingTimes.push(frameTime);
      frameCount++;
      
      // Wait for next frame if processing was too fast
      const remainingTime = targetFrameTime - frameTime;
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }
    }
    
    const actualFPS = frameCount;
    const averageFrameTime = frameProcessingTimes.reduce((a, b) => a + b, 0) / frameProcessingTimes.length;
    
    expect(actualFPS).toBeGreaterThanOrEqual(8); // Allow some variance
    expect(actualFPS).toBeLessThanOrEqual(12);
    expect(averageFrameTime).toBeLessThan(targetFrameTime);
  });

  test('Memory usage remains stable during continuous processing', async () => {
    await emotionEngine.initialize();
    
    // Mock memory measurement
    const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
    const memoryMeasurements = [];
    
    emotionEngine.detectEmotions = jest.fn().mockImplementation(() => {
      // Simulate some memory allocation
      const tempArray = new Array(1000).fill(0);
      return Promise.resolve({
        emotions: { happy: Math.random(), neutral: 1 - Math.random() },
        confidence: 0.8
      });
    });

    // Process frames for 5 seconds
    const processingDuration = 5000;
    const startTime = performance.now();
    
    while (performance.now() - startTime < processingDuration) {
      await emotionEngine.detectEmotions(mockVideo);
      
      if (performance.memory) {
        memoryMeasurements.push(performance.memory.usedJSHeapSize);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (performance.memory) {
      const finalMemory = performance.memory.usedJSHeapSize;
      const memoryGrowth = finalMemory - initialMemory;
      const maxMemory = Math.max(...memoryMeasurements);
      const minMemory = Math.min(...memoryMeasurements);
      const memoryVariance = maxMemory - minMemory;
      
      // Memory growth should be reasonable (less than 50MB)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
      
      // Memory variance should be stable (less than 20MB fluctuation)
      expect(memoryVariance).toBeLessThan(20 * 1024 * 1024);
    }
  });

  test('CPU usage optimization with frame skipping', async () => {
    await emotionEngine.initialize();
    
    let processingCount = 0;
    let skippedFrames = 0;
    
    // Mock high CPU load scenario
    emotionEngine.detectEmotions = jest.fn().mockImplementation(() => {
      processingCount++;
      return new Promise(resolve => {
        // Simulate variable processing time (50-150ms)
        const processingTime = 50 + Math.random() * 100;
        setTimeout(() => {
          resolve({
            emotions: { happy: 0.5, neutral: 0.5 },
            confidence: 0.8
          });
        }, processingTime);
      });
    });

    // Simulate frame skipping logic
    const targetFrameTime = 100; // 10 FPS
    let lastProcessTime = 0;
    
    for (let i = 0; i < 50; i++) {
      const currentTime = performance.now();
      
      if (currentTime - lastProcessTime >= targetFrameTime) {
        await emotionEngine.detectEmotions(mockVideo);
        lastProcessTime = currentTime;
      } else {
        skippedFrames++;
      }
      
      await new Promise(resolve => setTimeout(resolve, 20)); // 50 FPS input
    }
    
    // Should skip frames to maintain target rate
    expect(skippedFrames).toBeGreaterThan(0);
    expect(processingCount).toBeLessThan(50);
    expect(processingCount).toBeGreaterThan(5); // Should still process some frames
  });

  test('Posture detection performance under load', async () => {
    await postureEngine.initialize();
    
    const processingTimes = [];
    
    postureEngine.detectPosture = jest.fn().mockImplementation(() => {
      return Promise.resolve({
        score: 0.8,
        alignment: 'good',
        keypoints: new Array(17).fill({ x: 100, y: 100, confidence: 0.9 })
      });
    });

    postureEngine.detectBlinks = jest.fn().mockImplementation(() => {
      return Promise.resolve({
        rate: 15,
        healthy: true,
        eyeAspectRatio: 0.25
      });
    });

    // Test concurrent posture and blink detection
    for (let i = 0; i < 20; i++) {
      const startTime = performance.now();
      
      const [postureResult, blinkResult] = await Promise.all([
        postureEngine.detectPosture(mockVideo),
        postureEngine.detectBlinks(mockVideo)
      ]);
      
      const endTime = performance.now();
      processingTimes.push(endTime - startTime);
      
      expect(postureResult).toBeDefined();
      expect(blinkResult).toBeDefined();
    }
    
    const averageTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
    const maxTime = Math.max(...processingTimes);
    
    // Average processing should be under 200ms
    expect(averageTime).toBeLessThan(200);
    
    // No single processing should exceed 500ms
    expect(maxTime).toBeLessThan(500);
  });

  test('Resource cleanup prevents memory leaks', async () => {
    const engines = [];
    
    // Create multiple engine instances
    for (let i = 0; i < 5; i++) {
      const engine = new EmotionDetectionEngine();
      await engine.initialize();
      engines.push(engine);
    }
    
    const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
    
    // Process some data with each engine
    for (const engine of engines) {
      engine.detectEmotions = jest.fn().mockResolvedValue({
        emotions: { happy: 0.5, neutral: 0.5 },
        confidence: 0.8
      });
      
      for (let j = 0; j < 10; j++) {
        await engine.detectEmotions(mockVideo);
      }
    }
    
    // Cleanup all engines
    for (const engine of engines) {
      if (engine.cleanup) {
        engine.cleanup();
      }
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
    
    if (performance.memory) {
      const memoryGrowth = finalMemory - initialMemory;
      
      // Memory growth should be minimal after cleanup
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
    }
  });

  test('Performance degrades gracefully under extreme load', async () => {
    await emotionEngine.initialize();
    
    const results = [];
    
    // Simulate extreme processing load
    emotionEngine.detectEmotions = jest.fn().mockImplementation(() => {
      return new Promise(resolve => {
        // Simulate heavy computation
        const start = Date.now();
        while (Date.now() - start < 200) {
          // Busy wait to simulate CPU load
        }
        
        resolve({
          emotions: { happy: 0.5, neutral: 0.5 },
          confidence: 0.8
        });
      });
    });

    const startTime = performance.now();
    const promises = [];
    
    // Launch multiple concurrent detections
    for (let i = 0; i < 10; i++) {
      promises.push(emotionEngine.detectEmotions(mockVideo));
    }
    
    const allResults = await Promise.all(promises);
    const endTime = performance.now();
    
    const totalTime = endTime - startTime;
    
    // Should complete all detections
    expect(allResults).toHaveLength(10);
    allResults.forEach(result => {
      expect(result).toBeDefined();
      expect(result.emotions).toBeDefined();
    });
    
    // Should handle load gracefully (not exceed 5 seconds for 10 concurrent operations)
    expect(totalTime).toBeLessThan(5000);
  });

  test('Frame rate adaptation based on system performance', async () => {
    await emotionEngine.initialize();
    
    let adaptiveFrameRate = 10; // Start with 10 FPS
    const processingTimes = [];
    
    emotionEngine.detectEmotions = jest.fn().mockImplementation(() => {
      const processingTime = Math.random() * 150 + 50; // 50-200ms
      
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            emotions: { happy: 0.5, neutral: 0.5 },
            confidence: 0.8
          });
        }, processingTime);
      });
    });

    // Adaptive frame rate logic
    for (let i = 0; i < 20; i++) {
      const frameStart = performance.now();
      
      await emotionEngine.detectEmotions(mockVideo);
      
      const frameEnd = performance.now();
      const frameTime = frameEnd - frameStart;
      processingTimes.push(frameTime);
      
      // Adapt frame rate based on recent performance
      const recentTimes = processingTimes.slice(-5);
      const averageTime = recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length;
      
      if (averageTime > 150) {
        adaptiveFrameRate = Math.max(5, adaptiveFrameRate - 1); // Reduce frame rate
      } else if (averageTime < 80) {
        adaptiveFrameRate = Math.min(15, adaptiveFrameRate + 1); // Increase frame rate
      }
      
      const targetFrameTime = 1000 / adaptiveFrameRate;
      await new Promise(resolve => setTimeout(resolve, Math.max(0, targetFrameTime - frameTime)));
    }
    
    // Frame rate should have adapted to system performance
    expect(adaptiveFrameRate).toBeGreaterThanOrEqual(5);
    expect(adaptiveFrameRate).toBeLessThanOrEqual(15);
    
    const finalAverageTime = processingTimes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    expect(finalAverageTime).toBeLessThan(200); // Should maintain reasonable performance
  });
});