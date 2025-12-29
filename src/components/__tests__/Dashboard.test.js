import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Dashboard from '../Dashboard';

// Mock child components
jest.mock('../WellnessMonitor', () => {
  return function MockWellnessMonitor({ onWellnessUpdate, isActive }) {
    return (
      <div data-testid="wellness-monitor">
        <button 
          onClick={() => onWellnessUpdate({
            emotion: {
              primaryEmotion: 'happy',
              confidence: 0.8,
              energyLevel: 0.7
            },
            posture: {
              posture: { score: 0.9 },
              blinks: { blinkRate: 15 }
            }
          })}
        >
          Trigger Wellness Update
        </button>
        <span>Active: {isActive.toString()}</span>
      </div>
    );
  };
});

jest.mock('../ManualEmotionInput', () => {
  return function MockManualEmotionInput({ onEmotionUpdate, isActive }) {
    return (
      <div data-testid="manual-emotion-input">
        <button 
          onClick={() => onEmotionUpdate({
            primaryEmotion: 'neutral',
            confidence: 0.6,
            energyLevel: 0.5
          })}
        >
          Trigger Emotion Update
        </button>
        <span>Active: {isActive.toString()}</span>
      </div>
    );
  };
});

jest.mock('../FeedbackModal', () => {
  return function MockFeedbackModal({ isOpen, onClose, suggestionType, onFeedbackSubmit }) {
    if (!isOpen) return null;
    return (
      <div data-testid="feedback-modal">
        <span>Type: {suggestionType}</span>
        <button onClick={onClose}>Close Modal</button>
        <button onClick={() => onFeedbackSubmit({ response: 'accepted' })}>
          Submit Feedback
        </button>
      </div>
    );
  };
});

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn()
  }
});

// Mock window.electronAPI
const mockElectronAPI = {
  callDjangoAPI: jest.fn()
};

describe('Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    navigator.mediaDevices.getUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }]
    });
    mockElectronAPI.callDjangoAPI.mockResolvedValue({ success: true });
    window.electronAPI = mockElectronAPI;
  });

  afterEach(() => {
    delete window.electronAPI;
  });

  test('renders dashboard with initial state', () => {
    render(<Dashboard />);
    
    expect(screen.getByText('Workspace Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Real-time biometric monitoring and workspace automation')).toBeInTheDocument();
    expect(screen.getByText('System Status')).toBeInTheDocument();
    expect(screen.getByText('Current State')).toBeInTheDocument();
    expect(screen.getByText('Wellness Metrics')).toBeInTheDocument();
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
  });

  test('displays initial system status', () => {
    render(<Dashboard />);
    
    expect(screen.getByText('Camera:')).toBeInTheDocument();
    expect(screen.getByText('Django Service:')).toBeInTheDocument();
    expect(screen.getByText('TensorFlow.js:')).toBeInTheDocument();
  });

  test('displays initial emotion state', () => {
    render(<Dashboard />);
    
    expect(screen.getByText('Emotion:')).toBeInTheDocument();
    expect(screen.getByText('neutral')).toBeInTheDocument();
    expect(screen.getByText('Confidence:')).toBeInTheDocument();
    expect(screen.getByText('Energy Level:')).toBeInTheDocument();
  });

  test('displays initial wellness metrics', () => {
    render(<Dashboard />);
    
    expect(screen.getByText('Posture Score:')).toBeInTheDocument();
    expect(screen.getByText('Blink Rate:')).toBeInTheDocument();
    expect(screen.getByText('Session Time:')).toBeInTheDocument();
  });

  test('handles wellness update correctly', async () => {
    render(<Dashboard />);
    
    const triggerButton = screen.getByText('Trigger Wellness Update');
    fireEvent.click(triggerButton);
    
    await waitFor(() => {
      expect(screen.getByText('happy')).toBeInTheDocument();
      expect(screen.getByText('80.0%')).toBeInTheDocument(); // confidence
      expect(screen.getByText('70.0%')).toBeInTheDocument(); // energy
      expect(screen.getByText('90.0%')).toBeInTheDocument(); // posture score
      expect(screen.getByText('15/min')).toBeInTheDocument(); // blink rate
    });
  });

  test('handles emotion update correctly', async () => {
    // Mock camera access denied to trigger manual input
    navigator.mediaDevices.getUserMedia.mockRejectedValue(new Error('Permission denied'));
    
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByTestId('manual-emotion-input')).toBeInTheDocument();
    });
    
    const triggerButton = screen.getByText('Trigger Emotion Update');
    fireEvent.click(triggerButton);
    
    await waitFor(() => {
      expect(screen.getByText('neutral')).toBeInTheDocument();
      expect(screen.getByText('60.0%')).toBeInTheDocument(); // confidence
      expect(screen.getByText('50.0%')).toBeInTheDocument(); // energy
    });
  });

  test('tracks emotion history and displays trends', async () => {
    render(<Dashboard />);
    
    const triggerButton = screen.getByText('Trigger Wellness Update');
    
    // Trigger multiple emotion updates
    fireEvent.click(triggerButton);
    fireEvent.click(triggerButton);
    fireEvent.click(triggerButton);
    
    await waitFor(() => {
      expect(screen.getByText('Emotion Trends')).toBeInTheDocument();
      expect(screen.getByText('Trend:')).toBeInTheDocument();
      expect(screen.getByText('stable')).toBeInTheDocument();
    });
  });

  test('displays emotion history chart', async () => {
    render(<Dashboard />);
    
    const triggerButton = screen.getByText('Trigger Wellness Update');
    fireEvent.click(triggerButton);
    
    await waitFor(() => {
      const chart = document.querySelector('.emotion-history-chart');
      expect(chart).toBeInTheDocument();
      
      const bars = document.querySelectorAll('.emotion-bar');
      expect(bars.length).toBeGreaterThan(0);
    });
  });

  test('handles start/stop monitoring', () => {
    render(<Dashboard />);
    
    const startButton = screen.getByText('Start Monitoring');
    fireEvent.click(startButton);
    
    expect(screen.getByText('Stop Monitoring')).toBeInTheDocument();
    
    const stopButton = screen.getByText('Stop Monitoring');
    fireEvent.click(stopButton);
    
    expect(screen.getByText('Start Monitoring')).toBeInTheDocument();
  });

  test('passes monitoring state to child components', () => {
    render(<Dashboard />);
    
    // Initially not monitoring
    expect(screen.getByText('Active: false')).toBeInTheDocument();
    
    const startButton = screen.getByText('Start Monitoring');
    fireEvent.click(startButton);
    
    // Now monitoring
    expect(screen.getByText('Active: true')).toBeInTheDocument();
  });

  test('handles refresh status button', async () => {
    render(<Dashboard />);
    
    const refreshButton = screen.getByText('Refresh Status');
    fireEvent.click(refreshButton);
    
    await waitFor(() => {
      expect(mockElectronAPI.callDjangoAPI).toHaveBeenCalledWith('/health/', 'GET');
    });
  });

  test('shows demo feedback modal triggers', () => {
    render(<Dashboard />);
    
    expect(screen.getByText('Demo AI Suggestions')).toBeInTheDocument();
    expect(screen.getByText('Test Music Suggestion')).toBeInTheDocument();
    expect(screen.getByText('Test Theme Suggestion')).toBeInTheDocument();
  });

  test('opens feedback modal for music suggestion', async () => {
    render(<Dashboard />);
    
    const musicButton = screen.getByText('Test Music Suggestion');
    fireEvent.click(musicButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('feedback-modal')).toBeInTheDocument();
      expect(screen.getByText('Type: music')).toBeInTheDocument();
    });
  });

  test('opens feedback modal for theme suggestion', async () => {
    render(<Dashboard />);
    
    const themeButton = screen.getByText('Test Theme Suggestion');
    fireEvent.click(themeButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('feedback-modal')).toBeInTheDocument();
      expect(screen.getByText('Type: theme')).toBeInTheDocument();
    });
  });

  test('closes feedback modal', async () => {
    render(<Dashboard />);
    
    const musicButton = screen.getByText('Test Music Suggestion');
    fireEvent.click(musicButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('feedback-modal')).toBeInTheDocument();
    });
    
    const closeButton = screen.getByText('Close Modal');
    fireEvent.click(closeButton);
    
    await waitFor(() => {
      expect(screen.queryByTestId('feedback-modal')).not.toBeInTheDocument();
    });
  });

  test('handles feedback submission', async () => {
    render(<Dashboard />);
    
    const musicButton = screen.getByText('Test Music Suggestion');
    fireEvent.click(musicButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('feedback-modal')).toBeInTheDocument();
    });
    
    const submitButton = screen.getByText('Submit Feedback');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockElectronAPI.callDjangoAPI).toHaveBeenCalledWith(
        '/feedback/',
        'POST',
        expect.objectContaining({ response: 'accepted' })
      );
    });
  });

  test('shows notifications after feedback submission', async () => {
    render(<Dashboard />);
    
    const musicButton = screen.getByText('Test Music Suggestion');
    fireEvent.click(musicButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('feedback-modal')).toBeInTheDocument();
    });
    
    const submitButton = screen.getByText('Submit Feedback');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Feedback submitted successfully!')).toBeInTheDocument();
    });
  });

  test('handles feedback submission error', async () => {
    mockElectronAPI.callDjangoAPI.mockResolvedValue({ success: false });
    
    render(<Dashboard />);
    
    const musicButton = screen.getByText('Test Music Suggestion');
    fireEvent.click(musicButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('feedback-modal')).toBeInTheDocument();
    });
    
    const submitButton = screen.getByText('Submit Feedback');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to submit feedback. Please try again.')).toBeInTheDocument();
    });
  });

  test('dismisses notifications', async () => {
    render(<Dashboard />);
    
    const musicButton = screen.getByText('Test Music Suggestion');
    fireEvent.click(musicButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('feedback-modal')).toBeInTheDocument();
    });
    
    const submitButton = screen.getByText('Submit Feedback');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Feedback submitted successfully!')).toBeInTheDocument();
    });
    
    const dismissButton = screen.getByLabelText('Dismiss notification');
    fireEvent.click(dismissButton);
    
    await waitFor(() => {
      expect(screen.queryByText('Feedback submitted successfully!')).not.toBeInTheDocument();
    });
  });

  test('handles camera access denied', async () => {
    navigator.mediaDevices.getUserMedia.mockRejectedValue(new Error('Permission denied'));
    
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByTestId('manual-emotion-input')).toBeInTheDocument();
      expect(screen.queryByTestId('wellness-monitor')).not.toBeInTheDocument();
    });
  });

  test('handles camera access granted', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByTestId('wellness-monitor')).toBeInTheDocument();
      expect(screen.queryByTestId('manual-emotion-input')).not.toBeInTheDocument();
    });
  });

  test('updates session time', async () => {
    jest.useFakeTimers();
    
    render(<Dashboard />);
    
    // Fast-forward time
    jest.advanceTimersByTime(65000); // 1 minute 5 seconds
    
    await waitFor(() => {
      expect(screen.getByText('1:05')).toBeInTheDocument();
    });
    
    jest.useRealTimers();
  });

  test('handles Django service connection status', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('connected')).toBeInTheDocument();
    });
  });

  test('handles Django service connection failure', async () => {
    mockElectronAPI.callDjangoAPI.mockRejectedValue(new Error('Connection failed'));
    
    render(<Dashboard />);
    
    await waitFor(() => {
      // Should still show disconnected status
      expect(screen.getByText('disconnected')).toBeInTheDocument();
    });
  });

  test('shows correct status colors', () => {
    render(<Dashboard />);
    
    const statusIndicators = document.querySelectorAll('.status-indicator');
    expect(statusIndicators.length).toBeGreaterThan(0);
    
    // Check that status indicators have color styles applied
    statusIndicators.forEach(indicator => {
      expect(indicator).toHaveStyle('color: rgb(76, 175, 80)'); // connected/ready color
    });
  });

  test('handles browser mode fallback', async () => {
    delete window.electronAPI;
    
    render(<Dashboard />);
    
    const musicButton = screen.getByText('Test Music Suggestion');
    fireEvent.click(musicButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('feedback-modal')).toBeInTheDocument();
    });
    
    const submitButton = screen.getByText('Submit Feedback');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Feedback saved locally!')).toBeInTheDocument();
    });
  });
});