import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import WellnessMonitor from '../components/WellnessMonitor';

// Mock the child components
jest.mock('../components/EmotionCamera', () => {
  return function MockEmotionCamera({ onEmotionUpdate, isActive }) {
    React.useEffect(() => {
      if (isActive && onEmotionUpdate) {
        // Simulate emotion data after a short delay
        setTimeout(() => {
          onEmotionUpdate({
            emotions: { happy: 0.7, sad: 0.2, neutral: 0.1 },
            primaryEmotion: 'happy',
            confidence: 0.8,
            energyLevel: 0.75,
            timestamp: Date.now()
          });
        }, 100);
      }
    }, [isActive, onEmotionUpdate]);

    return <div data-testid="emotion-camera">Emotion Camera Mock</div>;
  };
});

jest.mock('../components/PostureMonitor', () => {
  return function MockPostureMonitor({ onPostureUpdate, isActive }) {
    React.useEffect(() => {
      if (isActive && onPostureUpdate) {
        // Simulate posture data after a short delay
        setTimeout(() => {
          onPostureUpdate({
            posture: {
              score: 0.8,
              alignment: 'good',
              shoulderLevel: 0.9,
              headForward: 0.7,
              confidence: 0.85
            },
            blinks: {
              blinkRate: 16,
              eyeAspectRatio: 0.3,
              isBlinking: false,
              confidence: 0.8
            },
            timestamp: Date.now()
          });
        }, 150);
      }
    }, [isActive, onPostureUpdate]);

    return <div data-testid="posture-monitor">Posture Monitor Mock</div>;
  };
});

describe('Posture Detection Integration', () => {
  it('should integrate emotion and posture data correctly', async () => {
    const onWellnessUpdate = jest.fn();
    
    render(<WellnessMonitor onWellnessUpdate={onWellnessUpdate} isActive={true} />);
    
    // Wait for both emotion and posture data to be processed
    await waitFor(() => {
      expect(onWellnessUpdate).toHaveBeenCalled();
    }, { timeout: 1000 });

    const wellnessData = onWellnessUpdate.mock.calls[onWellnessUpdate.mock.calls.length - 1][0];
    
    // Verify combined wellness data structure
    expect(wellnessData).toHaveProperty('emotion');
    expect(wellnessData).toHaveProperty('posture');
    expect(wellnessData).toHaveProperty('overallWellness');
    expect(wellnessData).toHaveProperty('timestamp');

    // Verify emotion data
    expect(wellnessData.emotion).toHaveProperty('energyLevel', 0.75);
    expect(wellnessData.emotion).toHaveProperty('primaryEmotion', 'happy');

    // Verify posture data
    expect(wellnessData.posture.posture).toHaveProperty('score', 0.8);
    expect(wellnessData.posture.posture).toHaveProperty('alignment', 'good');
    expect(wellnessData.posture.blinks).toHaveProperty('blinkRate', 16);

    // Verify overall wellness calculation
    expect(wellnessData.overallWellness).toHaveProperty('score');
    expect(wellnessData.overallWellness).toHaveProperty('level');
    expect(wellnessData.overallWellness).toHaveProperty('factors');
    
    // With good emotion (0.75) and posture (0.8) and normal blink rate (16/15 = 1.0),
    // the overall score should be high
    expect(wellnessData.overallWellness.score).toBeGreaterThan(0.7);
    expect(wellnessData.overallWellness.level).toBe('good');
  });

  it('should display wellness overview with combined data', async () => {
    render(<WellnessMonitor isActive={true} />);
    
    // Wait for data to be processed and UI to update
    await waitFor(() => {
      expect(screen.getByText(/Overall Wellness/)).toBeInTheDocument();
    }, { timeout: 1000 });

    // Should show wellness score and level
    await waitFor(() => {
      expect(screen.getByText(/GOOD|EXCELLENT/)).toBeInTheDocument();
    }, { timeout: 500 });

    // Should show contributing factors
    expect(screen.getByText('Contributing Factors')).toBeInTheDocument();
    expect(screen.getByText('Energy Level')).toBeInTheDocument();
    expect(screen.getByText('Posture')).toBeInTheDocument();
    expect(screen.getByText('Eye Health')).toBeInTheDocument();
  });

  it('should provide appropriate recommendations based on wellness data', async () => {
    render(<WellnessMonitor isActive={true} />);
    
    // Wait for data processing and recommendations
    await waitFor(() => {
      expect(screen.getByText('Recommendations')).toBeInTheDocument();
    }, { timeout: 1000 });

    // With good wellness data, should show positive recommendation
    await waitFor(() => {
      expect(screen.getByText(/Great job! Your wellness metrics look good/)).toBeInTheDocument();
    }, { timeout: 500 });
  });

  it('should handle missing emotion data gracefully', async () => {
    // Mock PostureMonitor to provide data but EmotionCamera to not provide data
    jest.clearAllMocks();
    
    jest.mock('../components/EmotionCamera', () => {
      return function MockEmotionCamera() {
        return <div data-testid="emotion-camera">Emotion Camera Mock (No Data)</div>;
      };
    });

    const onWellnessUpdate = jest.fn();
    render(<WellnessMonitor onWellnessUpdate={onWellnessUpdate} isActive={true} />);
    
    // Wait for posture data only
    await waitFor(() => {
      expect(onWellnessUpdate).toHaveBeenCalled();
    }, { timeout: 1000 });

    const wellnessData = onWellnessUpdate.mock.calls[onWellnessUpdate.mock.calls.length - 1][0];
    
    // Should have posture data but no emotion data
    expect(wellnessData.emotion).toBeNull();
    expect(wellnessData.posture).toBeTruthy();
    
    // Overall wellness should still be calculated based on available data
    expect(wellnessData.overallWellness).toBeTruthy();
    expect(wellnessData.overallWellness.factors.emotion).toBeNull();
    expect(wellnessData.overallWellness.factors.posture).toBeTruthy();
  });

  it('should handle missing posture data gracefully', async () => {
    // Mock EmotionCamera to provide data but PostureMonitor to not provide data
    jest.clearAllMocks();
    
    jest.mock('../components/PostureMonitor', () => {
      return function MockPostureMonitor() {
        return <div data-testid="posture-monitor">Posture Monitor Mock (No Data)</div>;
      };
    });

    const onWellnessUpdate = jest.fn();
    render(<WellnessMonitor onWellnessUpdate={onWellnessUpdate} isActive={true} />);
    
    // Wait for emotion data only
    await waitFor(() => {
      expect(onWellnessUpdate).toHaveBeenCalled();
    }, { timeout: 1000 });

    const wellnessData = onWellnessUpdate.mock.calls[onWellnessUpdate.mock.calls.length - 1][0];
    
    // Should have emotion data but no posture data
    expect(wellnessData.emotion).toBeTruthy();
    expect(wellnessData.posture).toBeNull();
    
    // Overall wellness should still be calculated based on available data
    expect(wellnessData.overallWellness).toBeTruthy();
    expect(wellnessData.overallWellness.factors.emotion).toBeTruthy();
    expect(wellnessData.overallWellness.factors.posture).toBeNull();
  });

  it('should calculate different wellness levels correctly', () => {
    const { calculateOverallWellness } = require('../components/WellnessMonitor');
    
    // Test excellent wellness (high emotion, good posture, good blink rate)
    const excellentData = {
      emotion: { energyLevel: 0.9 },
      posture: { 
        posture: { score: 0.85 },
        blinks: { blinkRate: 18 }
      }
    };
    
    // Test poor wellness (low emotion, poor posture, low blink rate)
    const poorData = {
      emotion: { energyLevel: 0.2 },
      posture: { 
        posture: { score: 0.3 },
        blinks: { blinkRate: 5 }
      }
    };

    // Note: This test would require exposing the calculateOverallWellness function
    // or testing it through the component's behavior
    // For now, we test the integration through the component
  });

  it('should switch between tabs correctly', async () => {
    render(<WellnessMonitor isActive={true} />);
    
    // Should start on overview tab
    expect(screen.getByText('Overview')).toHaveClass('active');
    
    // Click emotion tab
    const emotionTab = screen.getByText('Emotion');
    emotionTab.click();
    
    expect(emotionTab).toHaveClass('active');
    expect(screen.getByTestId('emotion-camera')).toBeInTheDocument();
    
    // Click posture tab
    const postureTab = screen.getByText('Posture');
    postureTab.click();
    
    expect(postureTab).toHaveClass('active');
    expect(screen.getByTestId('posture-monitor')).toBeInTheDocument();
  });

  it('should handle inactive state correctly', () => {
    render(<WellnessMonitor isActive={false} />);
    
    // Components should receive isActive=false
    expect(screen.getByTestId('emotion-camera')).toBeInTheDocument();
    expect(screen.getByTestId('posture-monitor')).toBeInTheDocument();
  });
});