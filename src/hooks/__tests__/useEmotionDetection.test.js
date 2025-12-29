import { renderHook, act } from '@testing-library/react';
import useEmotionDetection from '../useEmotionDetection';

// Mock the EmotionDetectionEngine
jest.mock('../../services/EmotionDetectionEngine', () => {
  return jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(true),
    startDetection: jest.fn().mockResolvedValue(undefined),
    stopDetection: jest.fn(),
    setOnEmotionDetected: jest.fn(),
    setOnError: jest.fn(),
    setTargetFPS: jest.fn(),
    getStatus: jest.fn().mockReturnValue({
      isInitialized: true,
      isRunning: false,
      hasCamera: false,
      targetFPS: 10
    })
  }));
});

// Mock navigator.mediaDevices
const mockEnumerateDevices = jest.fn();
const mockGetUserMedia = jest.fn();

Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    enumerateDevices: mockEnumerateDevices,
    getUserMedia: mockGetUserMedia
  }
});

describe('useEmotionDetection', () => {
  let mockEngine;

  beforeEach(() => {
    const EmotionDetectionEngine = require('../../services/EmotionDetectionEngine');
    mockEngine = new EmotionDetectionEngine();
    jest.clearAllMocks();
  });

  test('should initialize on mount', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useEmotionDetection());

    expect(result.current.isInitialized).toBe(false);
    
    await waitForNextUpdate();
    
    expect(mockEngine.initialize).toHaveBeenCalled();
    expect(mockEngine.setOnEmotionDetected).toHaveBeenCalled();
    expect(mockEngine.setOnError).toHaveBeenCalled();
  });

  test('should handle successful initialization', async () => {
    mockEngine.initialize.mockResolvedValue(true);
    
    const { result, waitForNextUpdate } = renderHook(() => useEmotionDetection());
    
    await waitForNextUpdate();
    
    expect(result.current.isInitialized).toBe(true);
    expect(result.current.error).toBe(null);
  });

  test('should handle initialization failure', async () => {
    mockEngine.initialize.mockResolvedValue(false);
    
    const { result, waitForNextUpdate } = renderHook(() => useEmotionDetection());
    
    await waitForNextUpdate();
    
    expect(result.current.isInitialized).toBe(false);
  });

  test('should start detection successfully', async () => {
    mockEngine.initialize.mockResolvedValue(true);
    
    const { result, waitForNextUpdate } = renderHook(() => useEmotionDetection());
    
    await waitForNextUpdate();
    
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
    expect(result.current.cameraStatus).toBe('granted');
  });

  test('should handle detection start failure', async () => {
    mockEngine.initialize.mockResolvedValue(true);
    mockEngine.startDetection.mockRejectedValue(new Error('Camera access denied'));
    
    const { result, waitForNextUpdate } = renderHook(() => useEmotionDetection());
    
    await waitForNextUpdate();
    
    result.current.videoRef.current = document.createElement('video');
    result.current.canvasRef.current = document.createElement('canvas');
    
    await act(async () => {
      try {
        await result.current.startDetection();
      } catch (error) {
        // Expected to throw
      }
    });
    
    expect(result.current.isRunning).toBe(false);
    expect(result.current.cameraStatus).toBe('denied');
  });

  test('should stop detection', async () => {
    mockEngine.initialize.mockResolvedValue(true);
    
    const { result, waitForNextUpdate } = renderHook(() => useEmotionDetection());
    
    await waitForNextUpdate();
    
    act(() => {
      result.current.stopDetection();
    });
    
    expect(mockEngine.stopDetection).toHaveBeenCalled();
    expect(result.current.isRunning).toBe(false);
  });

  test('should check camera availability - granted', async () => {
    mockEnumerateDevices.mockResolvedValue([
      { kind: 'videoinput', deviceId: 'camera1' }
    ]);
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }]
    });
    
    const { result, waitForNextUpdate } = renderHook(() => useEmotionDetection());
    
    await waitForNextUpdate();
    
    let cameraAvailable;
    await act(async () => {
      cameraAvailable = await result.current.checkCameraAvailability();
    });
    
    expect(cameraAvailable).toBe(true);
    expect(result.current.cameraStatus).toBe('granted');
  });

  test('should check camera availability - denied', async () => {
    mockEnumerateDevices.mockResolvedValue([
      { kind: 'videoinput', deviceId: 'camera1' }
    ]);
    const error = new Error('Permission denied');
    error.name = 'NotAllowedError';
    mockGetUserMedia.mockRejectedValue(error);
    
    const { result, waitForNextUpdate } = renderHook(() => useEmotionDetection());
    
    await waitForNextUpdate();
    
    let cameraAvailable;
    await act(async () => {
      cameraAvailable = await result.current.checkCameraAvailability();
    });
    
    expect(cameraAvailable).toBe(false);
    expect(result.current.cameraStatus).toBe('denied');
  });

  test('should check camera availability - unavailable', async () => {
    mockEnumerateDevices.mockResolvedValue([]);
    
    const { result, waitForNextUpdate } = renderHook(() => useEmotionDetection());
    
    await waitForNextUpdate();
    
    let cameraAvailable;
    await act(async () => {
      cameraAvailable = await result.current.checkCameraAvailability();
    });
    
    expect(cameraAvailable).toBe(false);
    expect(result.current.cameraStatus).toBe('unavailable');
  });

  test('should handle emotion updates', async () => {
    mockEngine.initialize.mockResolvedValue(true);
    
    const { result, waitForNextUpdate } = renderHook(() => useEmotionDetection());
    
    await waitForNextUpdate();
    
    // Simulate emotion detection callback
    const mockEmotionData = {
      emotions: { happy: 0.8, sad: 0.2 },
      primaryEmotion: 'happy',
      confidence: 0.8,
      energyLevel: 0.7,
      timestamp: Date.now()
    };
    
    act(() => {
      // Get the callback that was set on the engine
      const onEmotionDetectedCallback = mockEngine.setOnEmotionDetected.mock.calls[0][0];
      onEmotionDetectedCallback(mockEmotionData);
    });
    
    expect(result.current.currentEmotion).toEqual(mockEmotionData);
  });

  test('should handle error callbacks', async () => {
    mockEngine.initialize.mockResolvedValue(true);
    
    const { result, waitForNextUpdate } = renderHook(() => useEmotionDetection());
    
    await waitForNextUpdate();
    
    act(() => {
      // Get the error callback that was set on the engine
      const onErrorCallback = mockEngine.setOnError.mock.calls[0][0];
      onErrorCallback('camera_access_denied', new Error('Camera denied'));
    });
    
    expect(result.current.cameraStatus).toBe('denied');
    expect(result.current.error).toBe('Camera access denied. Please enable camera permissions.');
  });

  test('should set target FPS', async () => {
    mockEngine.initialize.mockResolvedValue(true);
    
    const { result, waitForNextUpdate } = renderHook(() => useEmotionDetection());
    
    await waitForNextUpdate();
    
    act(() => {
      result.current.setTargetFPS(15);
    });
    
    expect(mockEngine.setTargetFPS).toHaveBeenCalledWith(15);
  });

  test('should get engine status', async () => {
    mockEngine.initialize.mockResolvedValue(true);
    mockEngine.getStatus.mockReturnValue({
      isInitialized: true,
      isRunning: true,
      hasCamera: true,
      targetFPS: 15
    });
    
    const { result, waitForNextUpdate } = renderHook(() => useEmotionDetection());
    
    await waitForNextUpdate();
    
    const status = result.current.getStatus();
    
    expect(status).toEqual({
      isInitialized: true,
      isRunning: true,
      hasCamera: true,
      targetFPS: 15
    });
  });

  test('should cleanup on unmount', async () => {
    mockEngine.initialize.mockResolvedValue(true);
    
    const { result, waitForNextUpdate, unmount } = renderHook(() => useEmotionDetection());
    
    await waitForNextUpdate();
    
    unmount();
    
    expect(mockEngine.stopDetection).toHaveBeenCalled();
  });

  test('should throw error when starting detection without refs', async () => {
    mockEngine.initialize.mockResolvedValue(true);
    
    const { result, waitForNextUpdate } = renderHook(() => useEmotionDetection());
    
    await waitForNextUpdate();
    
    await act(async () => {
      try {
        await result.current.startDetection();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('Video and canvas elements must be provided');
      }
    });
  });

  test('should throw error when starting detection without initialization', async () => {
    mockEngine.initialize.mockResolvedValue(false);
    
    const { result, waitForNextUpdate } = renderHook(() => useEmotionDetection());
    
    await waitForNextUpdate();
    
    result.current.videoRef.current = document.createElement('video');
    result.current.canvasRef.current = document.createElement('canvas');
    
    await act(async () => {
      try {
        await result.current.startDetection();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('Engine not initialized');
      }
    });
  });
});