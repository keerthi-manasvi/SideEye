import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FeedbackModal from '../FeedbackModal';

describe('FeedbackModal', () => {
  const mockOnClose = jest.fn();
  const mockOnFeedbackSubmit = jest.fn();
  
  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    suggestionType: 'music',
    suggestionData: {
      playlistName: 'Focus Jazz',
      genre: 'Jazz',
      reason: 'Based on your current calm state'
    },
    emotionContext: {
      primaryEmotion: 'neutral',
      confidence: 0.8,
      energyLevel: 0.6
    },
    onFeedbackSubmit: mockOnFeedbackSubmit
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders modal when open', () => {
    render(<FeedbackModal {...defaultProps} />);
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Music Recommendation')).toBeInTheDocument();
    expect(screen.getByText(/Focus Jazz/)).toBeInTheDocument();
    expect(screen.getByText(/neutral.*80.*60/)).toBeInTheDocument();
  });

  test('does not render when closed', () => {
    render(<FeedbackModal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('displays correct title for different suggestion types', () => {
    const { rerender } = render(<FeedbackModal {...defaultProps} suggestionType="theme" />);
    expect(screen.getByText('Theme Suggestion')).toBeInTheDocument();
    
    rerender(<FeedbackModal {...defaultProps} suggestionType="task" />);
    expect(screen.getByText('Task Recommendation')).toBeInTheDocument();
    
    rerender(<FeedbackModal {...defaultProps} suggestionType="unknown" />);
    expect(screen.getByText('AI Suggestion')).toBeInTheDocument();
  });

  test('displays suggestion data correctly for music', () => {
    render(<FeedbackModal {...defaultProps} />);
    
    expect(screen.getByText('Playlist: Focus Jazz (Jazz)')).toBeInTheDocument();
  });

  test('displays suggestion data correctly for theme', () => {
    const themeProps = {
      ...defaultProps,
      suggestionType: 'theme',
      suggestionData: {
        themeName: 'Dark Blue',
        colorPalette: 'Cool Blues'
      }
    };
    
    render(<FeedbackModal {...themeProps} />);
    
    expect(screen.getByText('Theme: Dark Blue (Cool Blues)')).toBeInTheDocument();
  });

  test('displays suggestion data correctly for task', () => {
    const taskProps = {
      ...defaultProps,
      suggestionType: 'task',
      suggestionData: {
        taskName: 'Code Review',
        energyLevel: 'high'
      }
    };
    
    render(<FeedbackModal {...taskProps} />);
    
    expect(screen.getByText('Task: Code Review (Energy level: high)')).toBeInTheDocument();
  });

  test('handles accept button click', async () => {
    render(<FeedbackModal {...defaultProps} />);
    
    const acceptButton = screen.getByLabelText('Accept this suggestion');
    fireEvent.click(acceptButton);
    
    await waitFor(() => {
      expect(mockOnFeedbackSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          response: 'accepted',
          rating: 5,
          suggestionType: 'music',
          suggestionData: defaultProps.suggestionData,
          emotionContext: defaultProps.emotionContext
        })
      );
    });
  });

  test('handles reject button click', async () => {
    render(<FeedbackModal {...defaultProps} />);
    
    const rejectButton = screen.getByLabelText('Reject this suggestion');
    fireEvent.click(rejectButton);
    
    await waitFor(() => {
      expect(mockOnFeedbackSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          response: 'rejected',
          rating: 0,
          suggestionType: 'music'
        })
      );
    });
  });

  test('handles star rating interaction', async () => {
    const user = userEvent.setup();
    render(<FeedbackModal {...defaultProps} />);
    
    const threeStarButton = screen.getByLabelText('3 stars');
    await user.click(threeStarButton);
    
    expect(threeStarButton).toHaveAttribute('aria-checked', 'true');
    
    // Check that stars 1-3 are active
    expect(screen.getByLabelText('1 star')).toHaveClass('active');
    expect(screen.getByLabelText('2 stars')).toHaveClass('active');
    expect(screen.getByLabelText('3 stars')).toHaveClass('active');
    expect(screen.getByLabelText('4 stars')).not.toHaveClass('active');
    expect(screen.getByLabelText('5 stars')).not.toHaveClass('active');
  });

  test('handles feedback text input', async () => {
    const user = userEvent.setup();
    render(<FeedbackModal {...defaultProps} />);
    
    const textArea = screen.getByLabelText(/Additional feedback/);
    await user.type(textArea, 'This is great feedback');
    
    expect(textArea).toHaveValue('This is great feedback');
  });

  test('handles alternative preference input', async () => {
    const user = userEvent.setup();
    render(<FeedbackModal {...defaultProps} />);
    
    const input = screen.getByLabelText(/What would you prefer instead/);
    await user.type(input, 'classical music');
    
    expect(input).toHaveValue('classical music');
  });

  test('submits enhanced feedback with learning data', async () => {
    const user = userEvent.setup();
    render(<FeedbackModal {...defaultProps} />);
    
    // Fill out form with detailed feedback
    await user.click(screen.getByLabelText('4 stars'));
    await user.type(screen.getByLabelText(/Additional feedback/), 'Too bright colors for my current mood');
    await user.type(screen.getByLabelText(/What would you prefer instead/), 'darker, more muted colors');
    
    // Submit as rejected
    fireEvent.click(screen.getByLabelText('Reject this suggestion'));
    
    await waitFor(() => {
      expect(mockOnFeedbackSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          response: 'rejected',
          rating: 4,
          feedback: 'Too bright colors for my current mood',
          alternativePreference: 'darker, more muted colors',
          confidence: 'low',
          specificFeedback: expect.objectContaining({
            whatDidntWork: expect.objectContaining({
              rejectedAspect: expect.any(String),
              preferredAlternative: 'darker, more muted colors'
            }),
            improvements: expect.arrayContaining(['reduce_brightness'])
          })
        })
      );
    });
  });

  test('extracts learning insights from feedback text', async () => {
    const user = userEvent.setup();
    render(<FeedbackModal {...defaultProps} />);
    
    // Test different feedback patterns
    const feedbackTexts = [
      'too bright and energetic',
      'wrong genre for my mood',
      'energy level doesnt match',
      'too dark for daytime'
    ];
    
    for (const feedbackText of feedbackTexts) {
      await user.clear(screen.getByLabelText(/Additional feedback/));
      await user.type(screen.getByLabelText(/Additional feedback/), feedbackText);
      
      fireEvent.click(screen.getByLabelText('Reject this suggestion'));
      
      await waitFor(() => {
        const lastCall = mockOnFeedbackSubmit.mock.calls[mockOnFeedbackSubmit.mock.calls.length - 1][0];
        expect(lastCall.specificFeedback.improvements).toBeDefined();
        expect(Array.isArray(lastCall.specificFeedback.improvements)).toBe(true);
      });
      
      // Reset for next iteration
      mockOnFeedbackSubmit.mockClear();
    }
  });

  test('provides different learning data for accepted vs rejected feedback', async () => {
    const { rerender } = render(<FeedbackModal {...defaultProps} />);
    
    // Test accepted feedback
    fireEvent.click(screen.getByLabelText('Accept this suggestion'));
    
    await waitFor(() => {
      const acceptedCall = mockOnFeedbackSubmit.mock.calls[0][0];
      expect(acceptedCall.confidence).toBe('high');
      expect(acceptedCall.specificFeedback.whatWorked).toBeDefined();
      expect(acceptedCall.specificFeedback.whatDidntWork).toBeNull();
    });
    
    mockOnFeedbackSubmit.mockClear();
    
    // Test rejected feedback with alternative
    rerender(<FeedbackModal {...defaultProps} isOpen={true} />);
    
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/What would you prefer instead/), 'classical music');
    
    fireEvent.click(screen.getByLabelText('Reject this suggestion'));
    
    await waitFor(() => {
      const rejectedCall = mockOnFeedbackSubmit.mock.calls[0][0];
      expect(rejectedCall.confidence).toBe('low');
      expect(rejectedCall.specificFeedback.whatWorked).toBeNull();
      expect(rejectedCall.specificFeedback.whatDidntWork).toBeDefined();
    });
  });

  test('handles learning data for different suggestion types', () => {
    const musicProps = {
      ...defaultProps,
      suggestionType: 'music',
      suggestionData: { genre: 'jazz', playlistName: 'Smooth Jazz' }
    };
    
    const themeProps = {
      ...defaultProps,
      suggestionType: 'theme',
      suggestionData: { themeName: 'Dark Blue', colorPalette: 'Cool Blues' }
    };
    
    // Test music learning data
    const { rerender } = render(<FeedbackModal {...musicProps} />);
    fireEvent.click(screen.getByLabelText('Accept this suggestion'));
    
    waitFor(() => {
      const musicCall = mockOnFeedbackSubmit.mock.calls[0][0];
      expect(musicCall.specificFeedback.whatWorked.genre).toBe('jazz');
      expect(musicCall.specificFeedback.whatWorked.energyMatch).toBeDefined();
    });
    
    mockOnFeedbackSubmit.mockClear();
    
    // Test theme learning data
    rerender(<FeedbackModal {...themeProps} />);
    fireEvent.click(screen.getByLabelText('Accept this suggestion'));
    
    waitFor(() => {
      const themeCall = mockOnFeedbackSubmit.mock.calls[0][0];
      expect(themeCall.specificFeedback.whatWorked.colorPalette).toBe('Cool Blues');
      expect(themeCall.specificFeedback.whatWorked.themeName).toBe('Dark Blue');
    });
  });

  test('handles ask me later button', async () => {
    render(<FeedbackModal {...defaultProps} />);
    
    const laterButton = screen.getByText('Ask Me Later');
    fireEvent.click(laterButton);
    
    await waitFor(() => {
      expect(mockOnFeedbackSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          response: 'deferred'
        })
      );
    });
  });

  test('closes modal on close button click', () => {
    render(<FeedbackModal {...defaultProps} />);
    
    const closeButton = screen.getByLabelText('Close feedback modal');
    fireEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('closes modal on cancel button click', () => {
    render(<FeedbackModal {...defaultProps} />);
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('closes modal on overlay click', () => {
    render(<FeedbackModal {...defaultProps} />);
    
    const overlay = screen.getByRole('dialog').parentElement;
    fireEvent.click(overlay);
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('does not close modal on content click', () => {
    render(<FeedbackModal {...defaultProps} />);
    
    const modalContent = screen.getByRole('dialog');
    fireEvent.click(modalContent);
    
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  test('closes modal on escape key press', () => {
    render(<FeedbackModal {...defaultProps} />);
    
    const overlay = screen.getByRole('dialog').parentElement;
    fireEvent.keyDown(overlay, { key: 'Escape' });
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('disables buttons when submitting', async () => {
    mockOnFeedbackSubmit.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    
    render(<FeedbackModal {...defaultProps} />);
    
    const acceptButton = screen.getByLabelText('Accept this suggestion');
    fireEvent.click(acceptButton);
    
    // Check that buttons are disabled during submission
    expect(screen.getByLabelText('Close feedback modal')).toBeDisabled();
    expect(screen.getByLabelText('Reject this suggestion')).toBeDisabled();
    expect(screen.getByText('Cancel')).toBeDisabled();
    expect(screen.getByText('Submitting...')).toBeInTheDocument();
  });

  test('resets form when modal reopens', () => {
    const { rerender } = render(<FeedbackModal {...defaultProps} isOpen={false} />);
    
    // Open modal and fill form
    rerender(<FeedbackModal {...defaultProps} isOpen={true} />);
    
    const textArea = screen.getByLabelText(/Additional feedback/);
    fireEvent.change(textArea, { target: { value: 'test feedback' } });
    
    // Close and reopen modal
    rerender(<FeedbackModal {...defaultProps} isOpen={false} />);
    rerender(<FeedbackModal {...defaultProps} isOpen={true} />);
    
    // Form should be reset
    expect(screen.getByLabelText(/Additional feedback/)).toHaveValue('');
  });

  test('handles missing suggestion data gracefully', () => {
    const propsWithoutData = {
      ...defaultProps,
      suggestionData: null
    };
    
    render(<FeedbackModal {...propsWithoutData} />);
    
    expect(screen.getByText('No suggestion data available')).toBeInTheDocument();
  });

  test('handles missing emotion context gracefully', () => {
    const propsWithoutEmotion = {
      ...defaultProps,
      emotionContext: null
    };
    
    render(<FeedbackModal {...propsWithoutEmotion} />);
    
    expect(screen.getByText('No emotion context available')).toBeInTheDocument();
  });

  test('shows correct placeholder text for different suggestion types', () => {
    const { rerender } = render(<FeedbackModal {...defaultProps} suggestionType="music" />);
    expect(screen.getByPlaceholderText(/jazz, classical, rock/)).toBeInTheDocument();
    
    rerender(<FeedbackModal {...defaultProps} suggestionType="theme" />);
    expect(screen.getByPlaceholderText(/dark theme, blue colors/)).toBeInTheDocument();
    
    rerender(<FeedbackModal {...defaultProps} suggestionType="task" />);
    expect(screen.getByPlaceholderText(/What would you prefer/)).toBeInTheDocument();
  });

  test('has proper accessibility attributes', () => {
    render(<FeedbackModal {...defaultProps} />);
    
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'feedback-modal-title');
    
    const radioGroup = screen.getByRole('radiogroup');
    expect(radioGroup).toHaveAttribute('aria-label', 'Rating');
    
    const stars = screen.getAllByRole('radio');
    expect(stars).toHaveLength(5);
    stars.forEach((star, index) => {
      expect(star).toHaveAttribute('aria-label', `${index + 1} star${index > 0 ? 's' : ''}`);
    });
  });
});