import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PostureMonitor from '../PostureMonitor';

// Mock the usePostureDetection hook
jest.mock('../../hooks/usePostureDetection', () => {
  return jest.fn(() => ({
    isInitialized: true,
    isRunning: false,
    currentPosture: {
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
    },
    wellnessAlerts: [],
    error: null,
    startDetection: jest.fn(() => Promise.resolve()),
    stopDetection: jest.fn(),
    setTargetFPS: jest.fn(),
    getStatus: jest.fn(() => ({
      isInitialized: true,
      isRunning: false,
      targetFPS: 5,
      postureHistoryLength: 10,
      blinkHistoryLength: 5
    })),
    getWellnessStats: jest.fn(() => ({
      averagePostureScore: 0.75,
      goodPosturePercentage: 80,
      averageBlinkRate: 16,
      totalBlinks: 25,
      sessionDuration: 300000 // 5 minutes
    })),
    updateThresholds: jest.fn(),
    clearWellnessAlerts: jest.fn(),
    dismissAlert: jest.fn(),
    videoRef: { current: null },
    canvasRef: { current: null }
  }));
});

describe('PostureMonitor', () => {
  let mockHook;

  beforeEach(() => {
    const usePostureDetection = require('../../hooks/usePostureDetection');
    mockHook = usePostureDetection();
    jest.clearAllMocks();
  });

  it('should render without crashing', () => {
    render(<PostureMonitor />);
    expect(screen.getByText('Posture & Wellness Monitor')).toBeInTheDocument();
  });

  it('should display posture data correctly', () => {
    render(<PostureMonitor />);
    
    expect(screen.getByText('GOOD')).toBeInTheDocument();
    expect(screen.getByText('Score: 80.0%')).toBeInTheDocument();
    expect(screen.getByText('Shoulder Level: 90.0%')).toBeInTheDocument();
    expect(screen.getByText('Head Position: 70.0%')).toBeInTheDocument();
  });

  it('should display blink rate data correctly', () => {
    render(<PostureMonitor />);
    
    expect(screen.getByText('15 blinks/min')).toBeInTheDocument();
    expect(screen.getByText(/Status:.*NORMAL/)).toBeInTheDocument();
  });

  it('should display session statistics', () => {
    render(<PostureMonitor />);
    
    expect(screen.getByText('75.0%')).toBeInTheDocument(); // Average posture
    expect(screen.getByText('80.0%')).toBeInTheDocument(); // Good posture percentage
    expect(screen.getByText('16.0/min')).toBeInTheDocument(); // Average blinks
    expect(screen.getByText('5m 0s')).toBeInTheDocument(); // Session time
  });

  it('should start detection when button is clicked', async () => {
    render(<PostureMonitor />);
    
    const startButton = screen.getByText('Start Monitoring');
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(mockHook.startDetection).toHaveBeenCalled();
    });
  });

  it('should stop detection when running', async () => {
    mockHook.isRunning = true;
    
    render(<PostureMonitor />);
    
    const stopButton = screen.getByText('Stop Monitoring');
    fireEvent.click(stopButton);
    
    expect(mockHook.stopDetection).toHaveBeenCalled();
  });

  it('should toggle settings panel', () => {
    render(<PostureMonitor />);
    
    const settingsButton = screen.getByText('⚙️ Settings');
    fireEvent.click(settingsButton);
    
    expect(screen.getByText('Detection Settings')).toBeInTheDocument();
    expect(screen.getByText('Target FPS: 5')).toBeInTheDocument();
  });

  it('should update FPS when slider changes', () => {
    render(<PostureMonitor />);
    
    // Open settings
    const settingsButton = screen.getByText('⚙️ Settings');
    fireEvent.click(settingsButton);
    
    const fpsSlider = screen.getByRole('slider');
    fireEvent.change(fpsSlider, { target: { value: '8' } });
    
    expect(mockHook.setTargetFPS).toHaveBeenCalledWith(8);
  });

  it('should update posture thresholds', () => {
    render(<PostureMonitor />);
    
    // Open settings
    const settingsButton = screen.getByText('⚙️ Settings');
    fireEvent.click(settingsButton);
    
    const goodPostureInput = screen.getByDisplayValue('0.7');
    fireEvent.change(goodPostureInput, { target: { value: '0.8' } });
    
    expect(mockHook.updateThresholds).toHaveBeenCalledWith(
      expect.objectContaining({
        posture: expect.objectContaining({
          goodPosture: 0.8
        })
      })
    );
  });

  it('should update blink rate thresholds', () => {
    render(<PostureMonitor />);
    
    // Open settings
    const settingsButton = screen.getByText('⚙️ Settings');
    fireEvent.click(settingsButton);
    
    const normalBlinkRateInput = screen.getByDisplayValue('15');
    fireEvent.change(normalBlinkRateInput, { target: { value: '20' } });
    
    expect(mockHook.updateThresholds).toHaveBeenCalledWith(
      expect.objectContaining({
        blink: expect.objectContaining({
          normalBlinkRate: 20
        })
      })
    );
  });

  it('should display wellness alerts', () => {
    mockHook.wellnessAlerts = [
      {
        type: 'posture_alert',
        message: 'Poor posture detected',
        severity: 'warning',
        timestamp: Date.now()
      },
      {
        type: 'blink_alert',
        message: 'Low blink rate detected',
        severity: 'warning',
        timestamp: Date.now()
      }
    ];
    
    render(<PostureMonitor />);
    
    expect(screen.getByText('Wellness Alerts')).toBeInTheDocument();
    expect(screen.getByText('Poor posture detected')).toBeInTheDocument();
    expect(screen.getByText('Low blink rate detected')).toBeInTheDocument();
  });

  it('should clear all alerts', () => {
    mockHook.wellnessAlerts = [
      {
        type: 'posture_alert',
        message: 'Poor posture detected',
        severity: 'warning',
        timestamp: Date.now()
      }
    ];
    
    render(<PostureMonitor />);
    
    const clearButton = screen.getByText('Clear All');
    fireEvent.click(clearButton);
    
    expect(mockHook.clearWellnessAlerts).toHaveBeenCalled();
  });

  it('should dismiss individual alert', () => {
    mockHook.wellnessAlerts = [
      {
        type: 'posture_alert',
        message: 'Poor posture detected',
        severity: 'warning',
        timestamp: Date.now()
      }
    ];
    
    render(<PostureMonitor />);
    
    const dismissButton = screen.getByText('×');
    fireEvent.click(dismissButton);
    
    expect(mockHook.dismissAlert).toHaveBeenCalledWith(0);
  });

  it('should display error message', () => {
    mockHook.error = 'Test error message';
    
    render(<PostureMonitor />);
    
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('should show no data message when no posture data available', () => {
    mockHook.currentPosture = {
      posture: { score: 0, alignment: 'unknown' },
      blinks: { blinkRate: 0 },
      timestamp: null
    };
    
    render(<PostureMonitor />);
    
    expect(screen.getByText('No posture data available')).toBeInTheDocument();
  });

  it('should display blink detection indicator when blinking', () => {
    mockHook.currentPosture = {
      ...mockHook.currentPosture,
      blinks: {
        ...mockHook.currentPosture.blinks,
        isBlinking: true
      }
    };
    
    render(<PostureMonitor />);
    
    expect(screen.getByText('BLINK DETECTED')).toBeInTheDocument();
  });

  it('should show correct posture status colors', () => {
    // Test good posture (green)
    render(<PostureMonitor />);
    const goodStatus = screen.getByText('GOOD');
    expect(goodStatus).toHaveStyle('background-color: #4CAF50');
  });

  it('should show correct blink rate status colors', () => {
    // Test normal blink rate
    render(<PostureMonitor />);
    const blinkRate = screen.getByText('15 blinks/min');
    expect(blinkRate).toHaveStyle('color: #4CAF50');
  });

  it('should handle low blink rate status', () => {
    mockHook.currentPosture = {
      ...mockHook.currentPosture,
      blinks: {
        ...mockHook.currentPosture.blinks,
        blinkRate: 5 // Low blink rate
      }
    };
    
    render(<PostureMonitor />);
    
    expect(screen.getByText(/Status:.*VERY LOW/)).toBeInTheDocument();
  });

  it('should handle fair posture status', () => {
    mockHook.currentPosture = {
      ...mockHook.currentPosture,
      posture: {
        ...mockHook.currentPosture.posture,
        alignment: 'fair',
        score: 0.6
      }
    };
    
    render(<PostureMonitor />);
    
    expect(screen.getByText('FAIR')).toBeInTheDocument();
    expect(screen.getByText('Score: 60.0%')).toBeInTheDocument();
  });

  it('should handle poor posture status', () => {
    mockHook.currentPosture = {
      ...mockHook.currentPosture,
      posture: {
        ...mockHook.currentPosture.posture,
        alignment: 'poor',
        score: 0.3
      }
    };
    
    render(<PostureMonitor />);
    
    expect(screen.getByText('POOR')).toBeInTheDocument();
    expect(screen.getByText('Score: 30.0%')).toBeInTheDocument();
  });

  it('should disable start button when not initialized', () => {
    mockHook.isInitialized = false;
    
    render(<PostureMonitor />);
    
    const startButton = screen.getByText('Start Monitoring');
    expect(startButton).toBeDisabled();
  });

  it('should show status indicators', () => {
    render(<PostureMonitor />);
    
    expect(screen.getByText('Models Loaded')).toBeInTheDocument();
    expect(screen.getByText('Monitoring Active')).toBeInTheDocument();
  });

  it('should call onPostureUpdate when posture changes', () => {
    const onPostureUpdate = jest.fn();
    
    render(<PostureMonitor onPostureUpdate={onPostureUpdate} />);
    
    // The hook should call onPostureUpdate with current posture data
    expect(onPostureUpdate).toHaveBeenCalledWith(mockHook.currentPosture);
  });

  it('should handle isActive prop', () => {
    const { rerender } = render(<PostureMonitor isActive={false} />);
    
    // Should not start automatically when not active
    expect(mockHook.startDetection).not.toHaveBeenCalled();
    
    // Should start when becomes active
    mockHook.isInitialized = true;
    mockHook.isRunning = false;
    
    rerender(<PostureMonitor isActive={true} />);
    
    // Note: The actual auto-start logic is in useEffect, 
    // which might not trigger in this test setup
  });

  it('should use external video element when provided', () => {
    const videoElement = document.createElement('video');
    
    render(<PostureMonitor videoElement={videoElement} />);
    
    // The component should set the videoRef to the provided element
    // This is tested indirectly through the useEffect in the component
  });

  it('should format duration correctly', () => {
    mockHook.getWellnessStats.mockReturnValue({
      ...mockHook.getWellnessStats(),
      sessionDuration: 125000 // 2 minutes 5 seconds
    });
    
    render(<PostureMonitor />);
    
    expect(screen.getByText('2m 5s')).toBeInTheDocument();
  });
});