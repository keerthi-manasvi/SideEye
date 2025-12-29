/**
 * Complete Emotion-to-Action Workflow Integration Tests
 * 
 * Tests the full pipeline from emotion detection through to workspace actions:
 * 1. Emotion detection from webcam
 * 2. Energy level calculation
 * 3. Task reordering based on energy
 * 4. Music playlist recommendations
 * 5. Theme changes
 * 6. Notification generation
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from '../components/Dashboard';
import { EmotionDetectionEngine } from '../services/EmotionDetectionEngine';
import { PostureDetectionEngine } from '../services/PostureDetectionEngine';

// Mock external dependencies
jest.mock('../services/EmotionDetectionEngine');
jest.mock('../services/PostureDetectionEngine');
jest.mock('../hooks/useEmotionDetection');
jest.mock('../hooks/usePostureDetection');

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Complete Emotion-to-Action Workflow Integration', () => {
  let mockEmotionEngine;
  let mockPostureEngine;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup emotion detection mock
    mockEmotionEngine = {
      initialize: jest.fn().mockResolvedValue(true),
      detectEmotions: jest.fn(),
      isInitialized: true
    };
    EmotionDetectionEngine.mockImplementation(() => mockEmotionEngine);
    
    // Setup posture detection mock
    mockPostureEngine = {
      initialize: jest.fn().mockResolvedValue(true),
      detectPosture: jest.fn(),
      detectBlinks: jest.fn(),
      isInitialized: true
    };
    PostureDetectionEngine.mockImplementation(() => mockPostureEngine);
    
    // Mock successful API responses
    fetch.mockImplementation((url) => {
      if (url.includes('/api/emotions/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, energy_level: 0.8 })
        });
      }
      if (url.includes('/api/tasks/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            tasks: [
              { id: 1, title: 'Complex Analysis', complexity: 0.9, energy_required: 0.8 },
              { id: 2, title: 'Email Review', complexity: 0.3, energy_required: 0.4 }
            ]
          })
        });
      }
      if (url.includes('/api/playlists/recommend')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            playlist: {
              name: 'Energizing Focus Music',
              url: 'https://youtube.com/playlist?list=test',
              reason: 'High energy detected - upbeat music for productivity'
            }
          })
        });
      }
      if (url.includes('/api/themes/recommend')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            theme: {
              name: 'Bright Focus',
              colors: { primary: '#007acc', background: '#ffffff' },
              reason: 'High energy - bright theme for alertness'
            }
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });

  test('Complete workflow: High energy emotion leads to appropriate actions', async () => {
    // Step 1: Setup high energy emotion detection
    mockEmotionEngine.detectEmotions.mockResolvedValue({
      emotions: {
        happy: 0.8,
        neutral: 0.2,
        sad: 0.0,
        angry: 0.0,
        surprised: 0.0,
        fearful: 0.0,
        disgusted: 0.0
      },
      confidence: 0.9
    });
    
    mockPostureEngine.detectPosture.mockResolvedValue({
      score: 0.8,
      alignment: 'good'
    });
    
    mockPostureEngine.detectBlinks.mockResolvedValue({
      rate: 15,
      healthy: true
    });

    // Step 2: Render dashboard and wait for initialization
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    });

    // Step 3: Simulate emotion detection cycle
    await act(async () => {
      // Trigger emotion detection
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Step 4: Verify emotion data was sent to backend
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/emotions/'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('happy')
        })
      );
    });

    // Step 5: Verify task reordering was requested
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/tasks/'),
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    // Step 6: Verify music recommendation was requested
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/playlists/recommend'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('0.8') // energy level
        })
      );
    });

    // Step 7: Verify theme recommendation was requested
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/themes/recommend'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('happy')
        })
      );
    });
  });

  test('Complete workflow: Low energy emotion leads to different actions', async () => {
    // Step 1: Setup low energy emotion detection
    mockEmotionEngine.detectEmotions.mockResolvedValue({
      emotions: {
        happy: 0.1,
        neutral: 0.3,
        sad: 0.6,
        angry: 0.0,
        surprised: 0.0,
        fearful: 0.0,
        disgusted: 0.0
      },
      confidence: 0.85
    });
    
    mockPostureEngine.detectPosture.mockResolvedValue({
      score: 0.4,
      alignment: 'poor'
    });

    // Mock low energy API responses
    fetch.mockImplementation((url) => {
      if (url.includes('/api/emotions/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, energy_level: 0.3 })
        });
      }
      if (url.includes('/api/tasks/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            tasks: [
              { id: 2, title: 'Email Review', complexity: 0.3, energy_required: 0.4 },
              { id: 1, title: 'Complex Analysis', complexity: 0.9, energy_required: 0.8 }
            ]
          })
        });
      }
      if (url.includes('/api/playlists/recommend')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            playlist: {
              name: 'Calming Ambient',
              url: 'https://youtube.com/playlist?list=calm',
              reason: 'Low energy detected - calming music for recovery'
            }
          })
        });
      }
      if (url.includes('/api/themes/recommend')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            theme: {
              name: 'Soft Dark',
              colors: { primary: '#4a90e2', background: '#2d2d2d' },
              reason: 'Low energy - darker theme for comfort'
            }
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });

    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    });

    // Simulate emotion detection cycle
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Verify appropriate low-energy responses
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/playlists/recommend'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('0.3') // low energy level
        })
      );
    });
  });

  test('Workflow handles camera access denial gracefully', async () => {
    // Mock camera access denial
    mockEmotionEngine.initialize.mockRejectedValue(new Error('Camera access denied'));
    
    render(<Dashboard />);
    
    // Should fall back to manual mode
    await waitFor(() => {
      expect(screen.getByText(/manual mode/i)).toBeInTheDocument();
    });

    // Manual energy input should still trigger actions
    const energySlider = screen.getByRole('slider');
    await userEvent.click(energySlider);
    
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/tasks/'),
        expect.any(Object)
      );
    });
  });

  test('Workflow continues with partial failures', async () => {
    // Setup normal emotion detection
    mockEmotionEngine.detectEmotions.mockResolvedValue({
      emotions: { happy: 0.7, neutral: 0.3 },
      confidence: 0.9
    });

    // Mock partial API failures
    fetch.mockImplementation((url) => {
      if (url.includes('/api/emotions/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, energy_level: 0.7 })
        });
      }
      if (url.includes('/api/playlists/recommend')) {
        return Promise.resolve({
          ok: false,
          status: 500
        });
      }
      if (url.includes('/api/themes/recommend')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            theme: { name: 'Default', colors: {} }
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });

    render(<Dashboard />);
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Should continue with theme changes even if music fails
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/themes/recommend'),
        expect.any(Object)
      );
    });
  });

  test('Emotion confidence affects action triggering', async () => {
    // Low confidence emotion detection
    mockEmotionEngine.detectEmotions.mockResolvedValue({
      emotions: { happy: 0.8, neutral: 0.2 },
      confidence: 0.3 // Low confidence
    });

    render(<Dashboard />);
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Should not trigger actions with low confidence
    await waitFor(() => {
      const emotionCalls = fetch.mock.calls.filter(call => 
        call[0].includes('/api/emotions/')
      );
      expect(emotionCalls.length).toBe(0);
    });
  });
});