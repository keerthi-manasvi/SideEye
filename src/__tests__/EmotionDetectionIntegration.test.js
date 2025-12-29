import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Dashboard from '../components/Dashboard';

// Mock the emotion detection components
jest.mock('../components/EmotionCamera', () => {
  return function MockEmotionCamera({ onEmotionUpdate, isActive }) {
    React.useEffect(() => {
      if (isActive && onEmotionUpdate) {
        // Simulate emotion detection after a short delay
        setTimeout(() => {
          onEmotionUpdate({
            emotions: { happy: 0.8, sad: 0.2 },
            primaryEmotion: 'happy',
            confidence: 0.8,
            energyLevel: 0.7,
            timestamp: Date.now()
          });
        }, 100);
      }
    }, [isActive, onEmotionUpdate]);

    return (
      <div data-testid="emotion-camera">
        <h3>Emotion Detection</h3>
        <p>Status: {isActive ? 'Active' : 'Inactive'}</p>
      </div>
    );
  };
});

jest.mock('../components/ManualEmotionInput', () => {
  return function MockManualEmotionInput({ onEmotionUpdate, isActive }) {
    React.useEffect(() => {
      if (isActive && onEmotionUpdate) {
        // Simulate manual emotion input
        onEmotionUpdate({
          emotions: { neutral: 0.9, happy: 0.1 },
          primaryEmotion: 'neutral',
          confidence: 1.0,
          energyLevel: 0.5,
          timestamp: Date.now(),
          isManual: true
        });
      }
    }, [isActive, onEmotionUpdate]);

    return (
      <div data-testid="manual-emotion-input">
        <h3>Manual Emotion Input</h3>
        <p>Status: {isActive ? 'Active' : 'Inactive'}</p>
      </div>
    );
  };
});

// Mock navigator.mediaDevices
const mockGetUserMedia = jest.fn();
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: mockGetUserMedia
  }
});

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  writable: true,
  value: {
    callDjangoAPI: jest.fn()
  }
});

describe('Emotion Detection Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should render EmotionCamera when camera access is granted', async () => {
    // Mock successful camera access
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }]
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('emotion-camera')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('manual-emotion-input')).not.toBeInTheDocument();
  });

  test('should render ManualEmotionInput when camera access is denied', async () => {
    // Mock camera access denied
    const error = new Error('Permission denied');
    error.name = 'NotAllowedError';
    mockGetUserMedia.mockRejectedValue(error);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('manual-emotion-input')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('emotion-camera')).not.toBeInTheDocument();
  });

  test('should update emotion state when camera detection is active', async () => {
    // Mock successful camera access
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }]
    });

    render(<Dashboard />);

    // Wait for camera status to be determined
    await waitFor(() => {
      expect(screen.getByTestId('emotion-camera')).toBeInTheDocument();
    });

    // Start monitoring
    const startButton = screen.getByText('Start Monitoring');
    fireEvent.click(startButton);

    // Wait for emotion update
    await waitFor(() => {
      expect(screen.getByText('happy')).toBeInTheDocument();
      expect(screen.getByText('80.0%')).toBeInTheDocument(); // confidence
      expect(screen.getByText('70.0%')).toBeInTheDocument(); // energy level
    });

    // Verify the button text changed
    expect(screen.getByText('Stop Monitoring')).toBeInTheDocument();
  });

  test('should update emotion state when manual input is active', async () => {
    // Mock camera access denied
    const error = new Error('Permission denied');
    error.name = 'NotAllowedError';
    mockGetUserMedia.mockRejectedValue(error);

    render(<Dashboard />);

    // Wait for manual input to be shown
    await waitFor(() => {
      expect(screen.getByTestId('manual-emotion-input')).toBeInTheDocument();
    });

    // Start monitoring
    const startButton = screen.getByText('Start Monitoring');
    fireEvent.click(startButton);

    // Wait for emotion update from manual input
    await waitFor(() => {
      expect(screen.getByText('neutral')).toBeInTheDocument();
      expect(screen.getByText('100.0%')).toBeInTheDocument(); // confidence
      expect(screen.getByText('50.0%')).toBeInTheDocument(); // energy level
    });
  });

  test('should display correct system status', async () => {
    // Mock successful camera access
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }]
    });

    // Mock Django service response
    window.electronAPI.callDjangoAPI.mockResolvedValue({ success: true });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('connected')).toBeInTheDocument(); // camera status
      expect(screen.getByText('ready')).toBeInTheDocument(); // tensorflow status
    });
  });

  test('should handle Django service failure gracefully', async () => {
    // Mock successful camera access
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }]
    });

    // Mock Django service failure
    window.electronAPI.callDjangoAPI.mockRejectedValue(new Error('Service unavailable'));

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('disconnected')).toBeInTheDocument(); // django status
    });
  });

  test('should refresh system status when refresh button is clicked', async () => {
    // Mock successful camera access
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }]
    });

    render(<Dashboard />);

    const refreshButton = screen.getByText('Refresh Status');
    fireEvent.click(refreshButton);

    // Verify that getUserMedia is called again
    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledTimes(2); // Once on mount, once on refresh
    });
  });

  test('should stop monitoring when stop button is clicked', async () => {
    // Mock successful camera access
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }]
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('emotion-camera')).toBeInTheDocument();
    });

    // Start monitoring
    const startButton = screen.getByText('Start Monitoring');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Stop Monitoring')).toBeInTheDocument();
    });

    // Stop monitoring
    const stopButton = screen.getByText('Stop Monitoring');
    fireEvent.click(stopButton);

    expect(screen.getByText('Start Monitoring')).toBeInTheDocument();
  });

  test('should display wellness metrics placeholder', () => {
    render(<Dashboard />);

    expect(screen.getByText('Wellness Metrics')).toBeInTheDocument();
    expect(screen.getByText('Posture Score:')).toBeInTheDocument();
    expect(screen.getByText('Blink Rate:')).toBeInTheDocument();
    expect(screen.getByText('Session Time:')).toBeInTheDocument();
  });

  test('should handle emotion updates with different confidence levels', async () => {
    // Mock successful camera access
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }]
    });

    // Create a custom mock that allows us to control the emotion data
    jest.doMock('../components/EmotionCamera', () => {
      return function MockEmotionCamera({ onEmotionUpdate, isActive }) {
        React.useEffect(() => {
          if (isActive && onEmotionUpdate) {
            // Simulate low confidence detection
            setTimeout(() => {
              onEmotionUpdate({
                emotions: { sad: 0.3, neutral: 0.7 },
                primaryEmotion: 'sad',
                confidence: 0.3,
                energyLevel: 0.2,
                timestamp: Date.now()
              });
            }, 100);
          }
        }, [isActive, onEmotionUpdate]);

        return (
          <div data-testid="emotion-camera">
            <h3>Emotion Detection</h3>
            <p>Status: {isActive ? 'Active' : 'Inactive'}</p>
          </div>
        );
      };
    });

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('emotion-camera')).toBeInTheDocument();
    });

    // Start monitoring
    const startButton = screen.getByText('Start Monitoring');
    fireEvent.click(startButton);

    // Wait for emotion update with low confidence
    await waitFor(() => {
      expect(screen.getByText('sad')).toBeInTheDocument();
      expect(screen.getByText('30.0%')).toBeInTheDocument(); // low confidence
      expect(screen.getByText('20.0%')).toBeInTheDocument(); // low energy
    });
  });
});