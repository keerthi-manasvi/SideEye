import React, { useState } from 'react';
import './ManualEmotionInput.css';

const ManualEmotionInput = ({ onEmotionUpdate, isActive = false }) => {
  const [selectedEmotion, setSelectedEmotion] = useState('neutral');
  const [energyLevel, setEnergyLevel] = useState(0.5);
  const [confidence, setConfidence] = useState(1.0);

  const emotions = [
    { key: 'happy', label: 'Happy', emoji: '😊' },
    { key: 'sad', label: 'Sad', emoji: '😢' },
    { key: 'angry', label: 'Angry', emoji: '😠' },
    { key: 'surprised', label: 'Surprised', emoji: '😲' },
    { key: 'fearful', label: 'Fearful', emoji: '😨' },
    { key: 'disgusted', label: 'Disgusted', emoji: '🤢' },
    { key: 'neutral', label: 'Neutral', emoji: '😐' }
  ];

  const handleEmotionChange = (emotion) => {
    setSelectedEmotion(emotion);
    updateEmotion(emotion, energyLevel, confidence);
  };

  const handleEnergyChange = (newEnergyLevel) => {
    setEnergyLevel(newEnergyLevel);
    updateEmotion(selectedEmotion, newEnergyLevel, confidence);
  };

  const handleConfidenceChange = (newConfidence) => {
    setConfidence(newConfidence);
    updateEmotion(selectedEmotion, energyLevel, newConfidence);
  };

  const updateEmotion = (emotion, energy, conf) => {
    if (!isActive || !onEmotionUpdate) return;

    // Create emotion probabilities with selected emotion as dominant
    const emotionProbs = {};
    emotions.forEach(({ key }) => {
      if (key === emotion) {
        emotionProbs[key] = conf;
      } else {
        // Distribute remaining probability among other emotions
        emotionProbs[key] = (1 - conf) / (emotions.length - 1);
      }
    });

    const emotionData = {
      emotions: emotionProbs,
      primaryEmotion: emotion,
      confidence: conf,
      energyLevel: energy,
      timestamp: Date.now(),
      isManual: true
    };

    onEmotionUpdate(emotionData);
  };

  // Auto-update when component becomes active
  React.useEffect(() => {
    if (isActive) {
      updateEmotion(selectedEmotion, energyLevel, confidence);
    }
  }, [isActive]);

  return (
    <div className="manual-emotion-input">
      <div className="manual-header">
        <h3>Manual Emotion Input</h3>
        <p>Camera access denied. Please manually select your current emotional state.</p>
      </div>

      <div className="emotion-selector">
        <h4>Current Emotion</h4>
        <div className="emotion-grid">
          {emotions.map(({ key, label, emoji }) => (
            <button
              key={key}
              className={`emotion-button ${selectedEmotion === key ? 'selected' : ''}`}
              onClick={() => handleEmotionChange(key)}
              disabled={!isActive}
            >
              <span className="emotion-emoji">{emoji}</span>
              <span className="emotion-label">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="manual-controls">
        <div className="control-group">
          <label htmlFor="energy-slider">
            Energy Level: {(energyLevel * 100).toFixed(0)}%
          </label>
          <input
            id="energy-slider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={energyLevel}
            onChange={(e) => handleEnergyChange(parseFloat(e.target.value))}
            disabled={!isActive}
            className="energy-slider"
          />
          <div className="slider-labels">
            <span>Low Energy</span>
            <span>High Energy</span>
          </div>
        </div>

        <div className="control-group">
          <label htmlFor="confidence-slider">
            Confidence: {(confidence * 100).toFixed(0)}%
          </label>
          <input
            id="confidence-slider"
            type="range"
            min="0.1"
            max="1"
            step="0.01"
            value={confidence}
            onChange={(e) => handleConfidenceChange(parseFloat(e.target.value))}
            disabled={!isActive}
            className="confidence-slider"
          />
          <div className="slider-labels">
            <span>Uncertain</span>
            <span>Very Sure</span>
          </div>
        </div>
      </div>

      <div className="current-state">
        <h4>Current State Summary</h4>
        <div className="state-display">
          <div className="state-item">
            <span className="state-label">Emotion:</span>
            <span className="state-value">
              {emotions.find(e => e.key === selectedEmotion)?.emoji} {selectedEmotion}
            </span>
          </div>
          <div className="state-item">
            <span className="state-label">Energy:</span>
            <span className="state-value">{(energyLevel * 100).toFixed(0)}%</span>
          </div>
          <div className="state-item">
            <span className="state-label">Confidence:</span>
            <span className="state-value">{(confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      <div className="manual-tips">
        <h4>Tips for Manual Input</h4>
        <ul>
          <li>Update your emotion state regularly for better workspace automation</li>
          <li>Energy level affects task recommendations and music suggestions</li>
          <li>Higher confidence values will trigger more responsive system changes</li>
          <li>Consider your overall mood, not just momentary feelings</li>
        </ul>
      </div>
    </div>
  );
};

export default ManualEmotionInput;