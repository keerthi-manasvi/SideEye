import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EmotionCamera from '../EmotionCamera';

// Mock the useEmotionDetection hook
jest.mock('../../hooks/useEmotionDetection', () => {
  return jest.fn(() => ({
    isInitialized: true,
    isRunning: false,
    currentEmotion: {
      emotions: { happy: 0.8, sad: 0.2 },
      primaryEmotion: 'happy',
      confidence: 0.8,
      energyLevel: 0.7,
      timestamp: Date.now()
    },
    error: null,
    cameraStatus: 'granted',
    startDetection: jest.fn().mockResolvedValue(undefined),
    stopDetection: jest.fn(),
    checkCameraAvailability: jest.fn().mockResolvedValue(true),
    setTargetFPS: jest.fn(),
    videoRef: { current: null },
    canvasRef: { current: null }
  }));
});

describe('EmotionCamera', () => {
  let mockOnEmotionUpdate;
  let mockHook;

  beforeEach(() => {
    mockOnEmotionUpdate = jest.fn();
    const useEmotionDetection = require('../../hooks/useEmotionDetection');
    mockHook = useEmotionDetection();
    jest.clearAllMocks();
  });

  test('renders emotion camera component', () => {
    render(<EmotionCamera onEmotionUpdate={mockOnEmotionUpdate} />);
    
    expect(screen.getByText('Emotion Detection')).toBeInTheDocument();
    expect(screen.getByText('Start Detection')).toBeInTheDocument();
    expect(screen.getByText('Hide Video')).toBeInTheDocument();
  });

  test('displays camera status when granted', () => {
    render(<EmotionCamera onEmotionUpdate={mockOnEmotionUpdate} />);
    
    expect(screen.getByText('Camera Access Granted')).toBeInTheDocument();
  });

  test('displays camera status when denied', () => {
    const useEmotionDetection = require('../../hooks/useEmotionDetection');
    useEmotionDetection.mockReturnValue({
      ...mockHook,
      cameraStatus: 'denied'
    });

    render(<EmotionCamera onEmotionUpdate={mockOnEmotionUpdate} />);
    
    expect(screen.getByText('Camera Access Denied')).toBeInTheDocument();
    expect(screen.getByText(/Please enable camera permissions/)).toBeInTheDocument();
  });

  test('displays camera status when unavailable', () => {
    const useEmotionDetection = require('../../hooks/useEmotionDetection');
    useEmotionDetection.mockReturnValue({
      ...mockHook,
      cameraStatus: 'unavailable'
    });

    render(<EmotionCamera onEmotionUpdate={mockOnEmotionUpdate} />);
    
    expect(screen.getByText('No Camera Available')).toBeInTheDocument();
    expect(screen.getByText(/No camera device was found/)).toBeInTheDocument();
  });

  test('displays emotion data correctly', () => {
    render(<EmotionCamera onEmotionUpdate={mockOnEmotionUpdate} />);
    
    expect(screen.getByText('Primary Emotion')).toBeInTheDocument();
    expect(screen.getByText('happy')).toBeInTheDocument();
    expect(screen.getByText('80.0%')).toBeInTheDocument(); // confidence
    expect(screen.getByText('Energy Level')).toBeInTheDocument();
    expect(screen.getByText('70.0%')).toBeInTheDocument(); // energy level
    expect(screen.getByText('Emotion Breakdown')).toBeInTheDocument();
  });

  test('displays no data message when no emotion data available', () => {
    const useEmotionDetection = require('../../hooks/useEmotionDetection');
    useEmotionDetection.mockReturnValue({
      ...mockHook,
      currentEmotion: {
        emotions: {},
        primaryEmotion: 'neutral',
        confidence: 0,
        energyLevel: 0,
        timestamp: null
      }
    });

    render(<EmotionCamera onEmotionUpdate={mockOnEmotionUpdate} />);
    
    expect(screen.getByText('No emotion data available')).toBeInTheDocument();
  });

  test('calls onEmotionUpdate when emotion changes', () => {
    const { rerender } = render(<EmotionCamera onEmotionUpdate={mockOnEmotionUpdate} />);
    
    const newEmotionData = {
      emotions: { sad: 0.9, happy: 0.1 },
      primaryEmotion: 'sad',
      confidence: 0.9,
      energyLevel: 0.3,
      timestamp: Date.now()
    };

    const useEmotionDetection = require('../../hooks/useEmotionDetection');
    useEmotionDetection.mockReturnValue({
      ...mockHook,
      currentEmotion: newEmotionData
    });

    rerender(<EmotionCamera onEmotionUpdate={mockOnEmotionUpdate} />);
    
    expect(mockOnEmotionUpdate).toHaveBeenCalledWith(newEmotionData);
  });

  test('starts detection when start button is clicked', async () => {
    render(<EmotionCamera onEmotionUpdate={mockOnEmotionUpdate} />);
    
    const startButton = screen.getByText('Start Detection');
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(mockHook.startDetection).toHaveBeenCalled();
    });
  });

  test('stops detection when stop button is clicked', async () => {
    const useEmotionDetection = require('../../hooks/useEmotionDetection');
    useEmotionDetection.mockReturnValue({
      ...mockHook,
      isRunning: true
    });

    render(<EmotionCamera onEmotionUpdate={mockOnEmotionUpdate} />);
    
    const stopButton = screen.getByText('Stop Detection');
    fireEvent.click(stopButton);
    
    expect(mockHook.stopDetection).toHaveBeenCalled();
  });

  test('toggles video visibility', () => {
    render(<EmotionCamera onEmotionUpdate={mockOnEmotionUpdate} />);
    
    const toggleButton = screen.getByText('Hide Video');
    fireEvent.click(toggleButton);
    
    expect(screen.getByText('Show Video')).toBeInTheDocument();
  });

  test('updates FPS when slider changes', () => {
    render(<EmotionCamera onEmotionUpdate={mockOnEmotionUpdate} />);
    
    const fpsSlider = screen.getByLabelText(/Target FPS/);
    fireEvent.change(fpsSlider, { target: { value: '15' } });
    
    expect(mockHook.setTargetFPS).toHaveBeenCalledWith(15);
  });

  test('disables start button when not initialized', () => {
    const useEmotionDetection = require('../../hooks/useEmotionDetection');
    useEmotionDetection.mockReturnValue({
      ...mockHook,
      isInitialized: false
    });

    render(<EmotionCamera onEmotionUpdate={mockOnEmotionUpdate} />);
    
    const startButton = screen.getByText('Start Detection');
    expect(startButton).toBeDisabled();
  });

  test('disables start button when camera access denied', () => {
    const useEmotionDetection = require('../../hooks/useEmotionDetection');
    useEmotionDetection.mockReturnValue({
      ...mockHook,
      cameraStatus: 'denied'
    });

    render(<EmotionCamera onEmotionUpdate={mockOnEmotionUpdate} />);
    
    const startButton = screen.getByText('Start Detection');
    expect(startButton).toBeDisabled();
  });

  test('displays error message when error occurs', () => {
    const useEmotionDetection = require('../../hooks/useEmotionDetection');
    useEmotionDetection.mockReturnValue({
      ...mockHook,
      error: 'Failed to initialize emotion detection models'
    });

    render(<EmotionCamera onEmotionUpdate={mockOnEmotionUpdate} />);
    
    expect(screen.getByText('Failed to initialize emotion detection models')).toBeInTheDocument();
  });

  test('auto-starts detection when isActive becomes true', async () => {
    const { rerender } = render(
      <EmotionCamera onEmotionUpdate={mockOnEmotionUpdate} isActive={false} />
    );
    
    rerender(
      <EmotionCamera onEmotionUpdate={mockOnEmotionUpdate} isActive={true} />
    );
    
    await waitFor(() => {
      expect(mockHook.startDetection).toHaveBeenCalled();
    });
  });

  test('auto-stops detection when isActive becomes false', () => {
    const useEmotionDetection = require('../../hooks/useEmotionDetection');
    useEmotionDetection.mockReturnValue({
      ...mockHook,
      isRunning: true
    });

    const { rerender } = render(
      <EmotionCamera onEmotionUpdate={mockOnEmotionUpdate} isActive={true} />
    );
    
    rerender(
      <EmotionCamera onEmotionUpdate={mockOnEmotionUpdate} isActive={false} />
    );
    
    expect(mockHook.stopDetection).toHaveBeenCalled();
  });

  test('displays status indicators correctly', () => {
    const useEmotionDetection = require('../../hooks/useEmotionDetection');
    useEmotionDetection.mockReturnValue({
      ...mockHook,
      isInitialized: true,
      isRunning: true
    });

    render(<EmotionCamera onEmotionUpdate={mockOnEmotionUpdate} />);
    
    const modelsIndicator = screen.getByText('Models Loaded');
    const detectionIndicator = screen.getByText('Detection Running');
    
    expect(modelsIndicator).toHaveClass('status-indicator', 'active');
    expect(detectionIndicator).toHaveClass('status-indicator', 'active');
  });

  test('shows video overlay when not running', () => {
    render(<EmotionCamera onEmotionUpdate={mockOnEmotionUpdate} />);
    
    expect(screen.getByText('Click "Start Detection" to begin')).toBeInTheDocument();
  });

  test('handles emotion breakdown display', () => {
    render(<EmotionCamera onEmotionUpdate={mockOnEmotionUpdate} />);
    
    // Should show top emotions in breakdown
    expect(screen.getByText('happy')).toBeInTheDocument();
    expect(screen.getByText('sad')).toBeInTheDocument();
    
    // Should show percentages
    const emotionValues = screen.getAllByText(/\d+\.\d%/);
    expect(emotionValues.length).toBeGreaterThan(0);
  });
});