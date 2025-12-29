import { renderHook, act } from '@testing-library/react';
import usePostureDetection from '../usePostureDetection';

// Mock the PostureDetectionEngine
jest.mock('../../services/PostureDetectionEngine', () => {
  return jest.fn().mockImplementation(() => ({
    initialize: jest.fn(() => Promise.resolve(true)),
    startDetection: jest.fn(() => Promise.resolve()),
    stopDetection: jest.fn(),
    setOnPostureDetected: jest.fn(),
    setOnError: jest.fn(),
    setTargetFPS: jest.fn(),
    getStatus: jest.fn(() => ({
      isInitialized: true,
      isRunning: false,
      targetFPS: 5,
      postureHistoryLength: 0,
      blinkHistoryLength: 0
    })),
    getPostureHistory: jest.fn(() => []),
    getBlinkHistory: jest.fn(() => []),
    updateThresholds: jest.fn()
  }));
});

describe('usePostureDetection', () => {
  let mockEngine;

  beforeEach(() => {
    const PostureDetectionEngine = require('../../services/PostureDetectionEngine');
    mockEngine = new PostureDetectionEngine();
    jest.clearAllMocks();
  });

  it('should initialize on mount', async () => {
    const { result } = renderHook(() => usePostureDetection());

    expect(result.current.isInitialized).toBe(false);
    
    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(mockEngine.initialize).toHaveBeenCalled();
    expect(result.current.isInitialized).toBe(true);
  });

  it('should start detection', async () => {
    const { result } = renderHook(() => usePostureDetection());

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Mock video and canvas refs
    result.current.videoRef.current = document.createElement('video');
    result.current.canvasRef.current = document.createElement('canvas');

    await act(async () => {
      await result.current.startDetection();
    });

    expect(mockEngine.startDetection).toHaveBeenCalledWith(
      result.current.videoRef.current,
      result.current.canvasRef.current
    );
    expect(result.current.isRunning).toBe(true);
  });

  it('should stop detection', async () => {
    const { result } = renderHook(() => usePostureDetection());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    act(() => {
      result.current.stopDetection();
    });

    expect(mockEngine.stopDetection).toHaveBeenCalled();
    expect(result.current.isRunning).toBe(false);
  });

  it('should handle posture detection data', async () => {
    const { result } = renderHook(() => usePostureDetection());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const mockPostureData = {
      posture: {
        score: 0.8,
        alignment: 'good',
        shoulderLevel: 0.9,
        headForward: 0.7,
        confidence: 0.85
      },
      blinks: {
        blinkRate: 15,
        eyeAspectRatio: 0.3,
        isBlinking: false,
        confidence: 0.8
      },
      timestamp: Date.now()
    };

    // Simulate posture detection callback
    act(() => {
      const onPostureDetected = mockEngine.setOnPostureDetected.mock.calls[0][0];
      onPostureDetected(mockPostureData);
    });

    expect(result.current.currentPosture).toEqual(mockPostureData);
  });

  it('should handle wellness alerts', async () => {
    const { result } = renderHook(() => usePostureDetection());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const mockAlert = {
      type: 'posture_alert',
      message: 'Poor posture detected',
      severity: 'warning',
      timestamp: Date.now()
    };

    // Simulate alert callback
    act(() => {
      const onPostureDetected = mockEngine.setOnPostureDetected.mock.calls[0][0];
      onPostureDetected(mockAlert);
    });

    expect(result.current.wellnessAlerts).toHaveLength(1);
    expect(result.current.wellnessAlerts[0]).toEqual(mockAlert);
  });

  it('should handle errors', async () => {
    const { result } = renderHook(() => usePostureDetection());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Simulate error callback
    act(() => {
      const onError = mockEngine.setOnError.mock.calls[0][0];
      onError('detection_error', new Error('Test error'));
    });

    expect(result.current.error).toBe('Error during posture detection. The system will continue trying.');
  });

  it('should set target FPS', async () => {
    const { result } = renderHook(() => usePostureDetection());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    act(() => {
      result.current.setTargetFPS(8);
    });

    expect(mockEngine.setTargetFPS).toHaveBeenCalledWith(8);
  });

  it('should get status', async () => {
    const { result } = renderHook(() => usePostureDetection());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const status = result.current.getStatus();
    expect(mockEngine.getStatus).toHaveBeenCalled();
    expect(status).toEqual({
      isInitialized: true,
      isRunning: false,
      targetFPS: 5,
      postureHistoryLength: 0,
      blinkHistoryLength: 0
    });
  });

  it('should update thresholds', async () => {
    const { result } = renderHook(() => usePostureDetection());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const newThresholds = {
      posture: { goodPosture: 0.8 },
      blink: { normalBlinkRate: 20 }
    };

    act(() => {
      result.current.updateThresholds(newThresholds);
    });

    expect(mockEngine.updateThresholds).toHaveBeenCalledWith(newThresholds);
  });

  it('should clear wellness alerts', async () => {
    const { result } = renderHook(() => usePostureDetection());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Add some alerts first
    const mockAlert = {
      type: 'posture_alert',
      message: 'Test alert',
      severity: 'warning',
      timestamp: Date.now()
    };

    act(() => {
      const onPostureDetected = mockEngine.setOnPostureDetected.mock.calls[0][0];
      onPostureDetected(mockAlert);
    });

    expect(result.current.wellnessAlerts).toHaveLength(1);

    act(() => {
      result.current.clearWellnessAlerts();
    });

    expect(result.current.wellnessAlerts).toHaveLength(0);
  });

  it('should dismiss specific alert', async () => {
    const { result } = renderHook(() => usePostureDetection());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Add multiple alerts
    const alerts = [
      { type: 'posture_alert', message: 'Alert 1', severity: 'warning', timestamp: Date.now() },
      { type: 'blink_alert', message: 'Alert 2', severity: 'warning', timestamp: Date.now() + 1 }
    ];

    act(() => {
      const onPostureDetected = mockEngine.setOnPostureDetected.mock.calls[0][0];
      alerts.forEach(alert => onPostureDetected(alert));
    });

    expect(result.current.wellnessAlerts).toHaveLength(2);

    act(() => {
      result.current.dismissAlert(0); // Dismiss first alert
    });

    expect(result.current.wellnessAlerts).toHaveLength(1);
    expect(result.current.wellnessAlerts[0].message).toBe('Alert 2');
  });

  it('should calculate wellness statistics', async () => {
    const { result } = renderHook(() => usePostureDetection());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // Mock history data
    const mockPostureHistory = [
      { score: 0.8, alignment: 'good', timestamp: Date.now() - 60000 },
      { score: 0.6, alignment: 'fair', timestamp: Date.now() - 30000 },
      { score: 0.9, alignment: 'good', timestamp: Date.now() }
    ];

    const mockBlinkHistory = [
      { timestamp: Date.now() - 45000 },
      { timestamp: Date.now() - 30000 },
      { timestamp: Date.now() - 15000 }
    ];

    mockEngine.getPostureHistory.mockReturnValue(mockPostureHistory);
    mockEngine.getBlinkHistory.mockReturnValue(mockBlinkHistory);

    const stats = result.current.getWellnessStats();

    expect(stats.averagePostureScore).toBeCloseTo(0.77, 1);
    expect(stats.goodPosturePercentage).toBeCloseTo(66.67, 1);
    expect(stats.totalBlinks).toBe(3);
    expect(stats.sessionDuration).toBeGreaterThan(0);
    expect(stats.averageBlinkRate).toBeGreaterThan(0);
  });

  it('should handle empty history in wellness statistics', async () => {
    const { result } = renderHook(() => usePostureDetection());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    mockEngine.getPostureHistory.mockReturnValue([]);
    mockEngine.getBlinkHistory.mockReturnValue([]);

    const stats = result.current.getWellnessStats();

    expect(stats.averagePostureScore).toBe(0);
    expect(stats.goodPosturePercentage).toBe(0);
    expect(stats.averageBlinkRate).toBe(0);
    expect(stats.totalBlinks).toBe(0);
    expect(stats.sessionDuration).toBe(0);
  });

  it('should cleanup on unmount', async () => {
    const { result, unmount } = renderHook(() => usePostureDetection());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    unmount();

    expect(mockEngine.stopDetection).toHaveBeenCalled();
  });

  it('should handle initialization failure', async () => {
    mockEngine.initialize.mockResolvedValueOnce(false);

    const { result } = renderHook(() => usePostureDetection());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    expect(result.current.isInitialized).toBe(false);
  });

  it('should handle start detection failure', async () => {
    mockEngine.startDetection.mockRejectedValueOnce(new Error('Start failed'));

    const { result } = renderHook(() => usePostureDetection());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    result.current.videoRef.current = document.createElement('video');
    result.current.canvasRef.current = document.createElement('canvas');

    await expect(act(async () => {
      await result.current.startDetection();
    })).rejects.toThrow('Start failed');

    expect(result.current.isRunning).toBe(false);
  });

  it('should throw error when starting detection without video/canvas elements', async () => {
    const { result } = renderHook(() => usePostureDetection());

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await expect(act(async () => {
      await result.current.startDetection();
    })).rejects.toThrow('Video and canvas elements must be provided');
  });

  it('should throw error when starting detection before initialization', async () => {
    const { result } = renderHook(() => usePostureDetection());

    // Don't wait for initialization
    result.current.videoRef.current = document.createElement('video');
    result.current.canvasRef.current = document.createElement('canvas');

    await expect(act(async () => {
      await result.current.startDetection();
    })).rejects.toThrow('Engine not initialized');
  });
});