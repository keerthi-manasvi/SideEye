import React, { useState, useEffect } from 'react';
import './FeedbackModal.css';

const FeedbackModal = ({ 
  isOpen, 
  onClose, 
  suggestionType, 
  suggestionData, 
  emotionContext,
  onFeedbackSubmit 
}) => {
  const [feedback, setFeedback] = useState('');
  const [rating, setRating] = useState(0);
  const [alternativePreference, setAlternativePreference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setFeedback('');
      setRating(0);
      setAlternativePreference('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (response) => {
    setIsSubmitting(true);
    
    const feedbackData = {
      response,
      rating: response === 'accepted' ? Math.max(rating, 4) : rating,
      feedback,
      alternativePreference: response === 'rejected' ? alternativePreference : null,
      suggestionType,
      suggestionData,
      emotionContext,
      timestamp: new Date().toISOString(),
      // Enhanced learning data
      confidence: response === 'accepted' ? 'high' : response === 'rejected' ? 'low' : 'medium',
      specificFeedback: {
        whatWorked: response === 'accepted' ? getWhatWorked() : null,
        whatDidntWork: response === 'rejected' ? getWhatDidntWork() : null,
        improvements: getImprovementSuggestions()
      }
    };

    try {
      await onFeedbackSubmit(feedbackData);
      onClose();
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getWhatWorked = () => {
    // Extract what worked from the suggestion for learning
    switch (suggestionType) {
      case 'music':
        return {
          genre: suggestionData?.genre,
          energyMatch: emotionContext?.energyLevel,
          emotionMatch: emotionContext?.primaryEmotion
        };
      case 'theme':
        return {
          colorPalette: suggestionData?.colorPalette,
          themeName: suggestionData?.themeName,
          energyLevel: emotionContext?.energyLevel
        };
      default:
        return suggestionData;
    }
  };

  const getWhatDidntWork = () => {
    // Extract what didn't work for learning
    if (!alternativePreference) return null;
    
    return {
      rejectedAspect: suggestionType === 'music' ? 'genre_mismatch' : 'color_mismatch',
      preferredAlternative: alternativePreference,
      contextMismatch: {
        emotion: emotionContext?.primaryEmotion,
        energy: emotionContext?.energyLevel
      }
    };
  };

  const getImprovementSuggestions = () => {
    // Generate improvement suggestions based on feedback
    const improvements = [];
    
    if (feedback.toLowerCase().includes('too bright')) {
      improvements.push('reduce_brightness');
    }
    if (feedback.toLowerCase().includes('too dark')) {
      improvements.push('increase_brightness');
    }
    if (feedback.toLowerCase().includes('wrong genre')) {
      improvements.push('better_genre_matching');
    }
    if (feedback.toLowerCase().includes('energy')) {
      improvements.push('improve_energy_correlation');
    }
    
    return improvements;
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const getSuggestionTitle = () => {
    switch (suggestionType) {
      case 'music':
        return 'Music Recommendation';
      case 'theme':
        return 'Theme Suggestion';
      case 'task':
        return 'Task Recommendation';
      default:
        return 'AI Suggestion';
    }
  };

  const getSuggestionDescription = () => {
    if (!suggestionData) return 'No suggestion data available';
    
    switch (suggestionType) {
      case 'music':
        return `Playlist: ${suggestionData.playlistName || 'Unknown'} (${suggestionData.genre || 'Various genres'})`;
      case 'theme':
        return `Theme: ${suggestionData.themeName || 'Unknown'} (${suggestionData.colorPalette || 'Default colors'})`;
      case 'task':
        return `Task: ${suggestionData.taskName || 'Unknown'} (Energy level: ${suggestionData.energyLevel || 'N/A'})`;
      default:
        return JSON.stringify(suggestionData);
    }
  };

  const getEmotionDescription = () => {
    if (!emotionContext) return 'No emotion context available';
    
    return `Current emotion: ${emotionContext.primaryEmotion || 'Unknown'} (${Math.round((emotionContext.confidence || 0) * 100)}% confidence, ${Math.round((emotionContext.energyLevel || 0) * 100)}% energy)`;
  };

  if (!isOpen) return null;

  return (
    <div 
      className="feedback-modal-overlay" 
      onClick={handleOverlayClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
    >
      <div className="feedback-modal">
        <div className="feedback-modal-header">
          <h3 id="feedback-modal-title">{getSuggestionTitle()}</h3>
          <button 
            className="close-button" 
            onClick={onClose}
            aria-label="Close feedback modal"
            disabled={isSubmitting}
          >
            ×
          </button>
        </div>

        <div className="feedback-modal-content">
          <div className="suggestion-info">
            <h4>AI Suggestion</h4>
            <p className="suggestion-description">{getSuggestionDescription()}</p>
            <p className="emotion-context">{getEmotionDescription()}</p>
          </div>

          <div className="feedback-section">
            <h4>How do you feel about this suggestion?</h4>
            
            <div className="response-buttons">
              <button 
                className="accept-button"
                onClick={() => handleSubmit('accepted')}
                disabled={isSubmitting}
                aria-label="Accept this suggestion"
              >
                👍 Accept
              </button>
              <button 
                className="reject-button"
                onClick={() => handleSubmit('rejected')}
                disabled={isSubmitting}
                aria-label="Reject this suggestion"
              >
                👎 Reject
              </button>
            </div>

            <div className="rating-section">
              <label htmlFor="rating-input">Rate this suggestion (1-5 stars):</label>
              <div className="star-rating" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`star ${rating >= star ? 'active' : ''}`}
                    onClick={() => setRating(star)}
                    disabled={isSubmitting}
                    aria-label={`${star} star${star > 1 ? 's' : ''}`}
                    role="radio"
                    aria-checked={rating === star}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div className="feedback-text-section">
              <label htmlFor="feedback-text">Additional feedback (optional):</label>
              <textarea
                id="feedback-text"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Tell us what you think about this suggestion..."
                disabled={isSubmitting}
                rows={3}
              />
            </div>

            <div className="alternative-section">
              <label htmlFor="alternative-preference">
                What would you prefer instead? (optional):
              </label>
              <input
                id="alternative-preference"
                type="text"
                value={alternativePreference}
                onChange={(e) => setAlternativePreference(e.target.value)}
                placeholder={
                  suggestionType === 'music' 
                    ? "e.g., jazz, classical, rock..." 
                    : suggestionType === 'theme'
                    ? "e.g., dark theme, blue colors..."
                    : "What would you prefer?"
                }
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        <div className="feedback-modal-footer">
          <button 
            className="cancel-button" 
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            className="submit-later-button"
            onClick={() => handleSubmit('deferred')}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Ask Me Later'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;