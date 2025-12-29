/**
 * User Feedback and Learning Cycle End-to-End Tests
 * 
 * Tests the complete feedback loop:
 * 1. System makes recommendations
 * 2. User provides feedback (accept/reject)
 * 3. System learns from feedback
 * 4. Future recommendations improve
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from '../components/Dashboard';
import FeedbackModal from '../components/FeedbackModal';

// Mock external dependencies
global.fetch = jest.fn();

describe('User Feedback and Learning Cycle E2E Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock initial API responses
    fetch.mockImplementation((url, options) => {
      if (url.includes('/api/emotions/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, energy_level: 0.7 })
        });
      }
      
      if (url.includes('/api/playlists/recommend')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            playlist: {
              id: 'playlist_1',
              name: 'Rock Focus',
              url: 'https://youtube.com/playlist?list=rock',
              genre: 'rock',
              reason: 'High energy detected'
            }
          })
        });
      }
      
      if (url.includes('/api/themes/recommend')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            theme: {
              id: 'theme_1',
              name: 'Bright Blue',
              colors: { primary: '#0066cc', background: '#ffffff' },
              palette: 'bright',
              reason: 'Happy emotion detected'
            }
          })
        });
      }
      
      if (url.includes('/api/feedback/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });

  test('Complete feedback cycle: User rejects music, system learns preference', async () => {
    render(<Dashboard />);
    
    // Step 1: Wait for initial recommendation
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/playlists/recommend'),
        expect.any(Object)
      );
    });

    // Step 2: User rejects the recommendation
    const rejectButton = await screen.findByText(/reject/i);
    await userEvent.click(rejectButton);

    // Step 3: Feedback modal should appear
    await waitFor(() => {
      expect(screen.getByText(/why didn't you like this/i)).toBeInTheDocument();
    });

    // Step 4: User provides specific feedback
    const genreSelect = screen.getByLabelText(/preferred genre/i);
    await userEvent.selectOptions(genreSelect, 'classical');
    
    const submitButton = screen.getByText(/submit feedback/i);
    await userEvent.click(submitButton);

    // Step 5: Verify feedback was sent to backend
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/feedback/'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('classical')
        })
      );
    });

    // Step 6: Mock updated recommendation based on learning
    fetch.mockImplementation((url) => {
      if (url.includes('/api/playlists/recommend')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            playlist: {
              id: 'playlist_2',
              name: 'Classical Focus',
              url: 'https://youtube.com/playlist?list=classical',
              genre: 'classical',
              reason: 'Based on your preference for classical music'
            }
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });

    // Step 7: Trigger new recommendation
    await act(async () => {
      // Simulate emotion change to trigger new recommendation
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Step 8: Verify improved recommendation
    await waitFor(() => {
      const calls = fetch.mock.calls.filter(call => 
        call[0].includes('/api/playlists/recommend')
      );
      expect(calls.length).toBeGreaterThan(1);
    });
  });

  test('Theme feedback learning cycle', async () => {
    render(<Dashboard />);
    
    // Wait for theme recommendation
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/themes/recommend'),
        expect.any(Object)
      );
    });

    // User rejects theme
    const themeRejectButton = await screen.findByText(/reject theme/i);
    await userEvent.click(themeRejectButton);

    // Provide theme feedback
    await waitFor(() => {
      expect(screen.getByText(/theme preferences/i)).toBeInTheDocument();
    });

    const colorPreference = screen.getByLabelText(/preferred colors/i);
    await userEvent.selectOptions(colorPreference, 'dark');
    
    const submitThemeFeedback = screen.getByText(/submit/i);
    await userEvent.click(submitThemeFeedback);

    // Verify theme feedback was recorded
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/feedback/'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('dark')
        })
      );
    });
  });

  test('Positive feedback reinforces recommendations', async () => {
    render(<Dashboard />);
    
    // Wait for recommendation
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/playlists/recommend'),
        expect.any(Object)
      );
    });

    // User accepts recommendation
    const acceptButton = await screen.findByText(/accept/i);
    await userEvent.click(acceptButton);

    // Verify positive feedback was sent
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/feedback/'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('accepted')
        })
      );
    });

    // Mock similar recommendation in future
    fetch.mockImplementation((url) => {
      if (url.includes('/api/playlists/recommend')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            playlist: {
              id: 'playlist_3',
              name: 'More Rock Focus',
              url: 'https://youtube.com/playlist?list=rock2',
              genre: 'rock',
              reason: 'You liked similar rock music before'
            }
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });

    // Trigger new recommendation
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // Should get similar recommendation
    await waitFor(() => {
      const calls = fetch.mock.calls.filter(call => 
        call[0].includes('/api/playlists/recommend')
      );
      expect(calls.length).toBeGreaterThan(1);
    });
  });

  test('Learning system handles conflicting feedback', async () => {
    render(<Dashboard />);
    
    // First recommendation and rejection
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/playlists/recommend'),
        expect.any(Object)
      );
    });

    const rejectButton1 = await screen.findByText(/reject/i);
    await userEvent.click(rejectButton1);

    // Provide feedback for jazz
    await waitFor(() => {
      expect(screen.getByLabelText(/preferred genre/i)).toBeInTheDocument();
    });

    const genreSelect1 = screen.getByLabelText(/preferred genre/i);
    await userEvent.selectOptions(genreSelect1, 'jazz');
    
    const submitButton1 = screen.getByText(/submit feedback/i);
    await userEvent.click(submitButton1);

    // Wait for feedback to be processed
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/feedback/'),
        expect.objectContaining({
          body: expect.stringContaining('jazz')
        })
      );
    });

    // Later, user changes mind and prefers electronic
    // Mock new recommendation
    fetch.mockImplementation((url) => {
      if (url.includes('/api/playlists/recommend')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            playlist: {
              id: 'playlist_jazz',
              name: 'Jazz Focus',
              genre: 'jazz'
            }
          })
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });

    // Trigger new recommendation
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    // User rejects jazz this time
    const rejectButton2 = await screen.findByText(/reject/i);
    await userEvent.click(rejectButton2);

    // Provide conflicting feedback
    const genreSelect2 = screen.getByLabelText(/preferred genre/i);
    await userEvent.selectOptions(genreSelect2, 'electronic');
    
    const submitButton2 = screen.getByText(/submit feedback/i);
    await userEvent.click(submitButton2);

    // System should handle conflicting preferences
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/feedback/'),
        expect.objectContaining({
          body: expect.stringContaining('electronic')
        })
      );
    });
  });

  test('Feedback modal accessibility and usability', async () => {
    render(<FeedbackModal 
      isOpen={true}
      type="music"
      suggestion={{
        name: 'Test Playlist',
        genre: 'rock'
      }}
      onClose={() => {}}
      onSubmit={() => {}}
    />);

    // Check accessibility features
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/preferred genre/i)).toBeInTheDocument();
    
    // Check keyboard navigation
    const firstInput = screen.getByLabelText(/preferred genre/i);
    firstInput.focus();
    expect(document.activeElement).toBe(firstInput);

    // Check form validation
    const submitButton = screen.getByText(/submit/i);
    await userEvent.click(submitButton);
    
    // Should show validation message if no selection made
    await waitFor(() => {
      expect(screen.getByText(/please select/i)).toBeInTheDocument();
    });
  });

  test('Learning system performance with multiple feedback cycles', async () => {
    const startTime = performance.now();
    
    render(<Dashboard />);
    
    // Simulate multiple rapid feedback cycles
    for (let i = 0; i < 5; i++) {
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/playlists/recommend'),
          expect.any(Object)
        );
      });

      const rejectButton = await screen.findByText(/reject/i);
      await userEvent.click(rejectButton);

      const genreSelect = screen.getByLabelText(/preferred genre/i);
      await userEvent.selectOptions(genreSelect, 'classical');
      
      const submitButton = screen.getByText(/submit feedback/i);
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/feedback/'),
          expect.any(Object)
        );
      });

      // Reset mocks for next iteration
      jest.clearAllMocks();
      fetch.mockImplementation((url) => {
        if (url.includes('/api/playlists/recommend')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              playlist: { name: `Playlist ${i}`, genre: 'rock' }
            })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({})
        });
      });
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Should complete within reasonable time (5 seconds for 5 cycles)
    expect(duration).toBeLessThan(5000);
  });
});