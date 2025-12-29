import React, { useState, useEffect } from 'react';
import EmotionCamera from './EmotionCamera';
import PostureMonitor from './PostureMonitor';
import './WellnessMonitor.css';

const WellnessMonitor = ({ onWellnessUpdate, isActive = true }) => {
  const [emotionData, setEmotionData] = useState(null);
  const [postureData, setPostureData] = useState(null);
  const [combinedWellnessData, setCombinedWellnessData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Combine emotion and posture data when either updates
  useEffect(() => {
    if (emotionData || postureData) {
      const combined = {
        emotion: emotionData,
        posture: postureData,
        timestamp: Date.now(),
        overallWellness: calculateOverallWellness(emotionData, postureData)
      };
      
      setCombinedWellnessData(combined);
      
      if (onWellnessUpdate) {
        onWellnessUpdate(combined);
      }
    }
  }, [emotionData, postureData, onWellnessUpdate]);

  const calculateOverallWellness = (emotion, posture) => {
    if (!emotion && !posture) return null;

    let wellnessScore = 0;
    let factors = 0;

    // Factor in emotion/energy level (40% weight)
    if (emotion && emotion.energyLevel !== undefined) {
      wellnessScore += emotion.energyLevel * 0.4;
      factors += 0.4;
    }

    // Factor in posture score (35% weight)
    if (posture && posture.posture && posture.posture.score !== undefined) {
      wellnessScore += posture.posture.score * 0.35;
      factors += 0.35;
    }

    // Factor in blink rate health (25% weight)
    if (posture && posture.blinks && posture.blinks.blinkRate !== undefined) {
      const blinkHealthScore = Math.min(1, posture.blinks.blinkRate / 15); // Normalize to 15 blinks/min
      wellnessScore += blinkHealthScore * 0.25;
      factors += 0.25;
    }

    if (factors === 0) return null;

    const normalizedScore = wellnessScore / factors;
    
    return {
      score: normalizedScore,
      level: getWellnessLevel(normalizedScore),
      factors: {
        emotion: emotion ? emotion.energyLevel : null,
        posture: posture && posture.posture ? posture.posture.score : null,
        blinkHealth: posture && posture.blinks ? Math.min(1, posture.blinks.blinkRate / 15) : null
      }
    };
  };

  const getWellnessLevel = (score) => {
    if (score >= 0.8) return 'excellent';
    if (score >= 0.6) return 'good';
    if (score >= 0.4) return 'fair';
    if (score >= 0.2) return 'poor';
    return 'critical';
  };

  const getWellnessColor = (level) => {
    switch (level) {
      case 'excellent': return '#4CAF50';
      case 'good': return '#8BC34A';
      case 'fair': return '#FF9800';
      case 'poor': return '#FF5722';
      case 'critical': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const renderOverview = () => {
    if (!combinedWellnessData || !combinedWellnessData.overallWellness) {
      return (
        <div className="wellness-overview no-data">
          <h3>Overall Wellness</h3>
          <p>Start monitoring to see your wellness overview</p>
        </div>
      );
    }

    const wellness = combinedWellnessData.overallWellness;

    return (
      <div className="wellness-overview">
        <h3>Overall Wellness</h3>
        
        <div className="wellness-score">
          <div 
            className="score-circle"
            style={{ borderColor: getWellnessColor(wellness.level) }}
          >
            <span className="score-value">{(wellness.score * 100).toFixed(0)}%</span>
            <span 
              className="score-level"
              style={{ color: getWellnessColor(wellness.level) }}
            >
              {wellness.level.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="wellness-factors">
          <h4>Contributing Factors</h4>
          <div className="factors-grid">
            {wellness.factors.emotion !== null && (
              <div className="factor-item">
                <span className="factor-label">Energy Level</span>
                <div className="factor-bar">
                  <div 
                    className="factor-fill"
                    style={{ 
                      width: `${wellness.factors.emotion * 100}%`,
                      backgroundColor: '#2196F3'
                    }}
                  />
                </div>
                <span className="factor-value">{(wellness.factors.emotion * 100).toFixed(0)}%</span>
              </div>
            )}
            
            {wellness.factors.posture !== null && (
              <div className="factor-item">
                <span className="factor-label">Posture</span>
                <div className="factor-bar">
                  <div 
                    className="factor-fill"
                    style={{ 
                      width: `${wellness.factors.posture * 100}%`,
                      backgroundColor: '#4CAF50'
                    }}
                  />
                </div>
                <span className="factor-value">{(wellness.factors.posture * 100).toFixed(0)}%</span>
              </div>
            )}
            
            {wellness.factors.blinkHealth !== null && (
              <div className="factor-item">
                <span className="factor-label">Eye Health</span>
                <div className="factor-bar">
                  <div 
                    className="factor-fill"
                    style={{ 
                      width: `${wellness.factors.blinkHealth * 100}%`,
                      backgroundColor: '#FF9800'
                    }}
                  />
                </div>
                <span className="factor-value">{(wellness.factors.blinkHealth * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>
        </div>

        {renderWellnessRecommendations()}
      </div>
    );
  };

  const renderWellnessRecommendations = () => {
    if (!combinedWellnessData || !combinedWellnessData.overallWellness) return null;

    const wellness = combinedWellnessData.overallWellness;
    const recommendations = [];

    // Energy/emotion recommendations
    if (wellness.factors.emotion !== null && wellness.factors.emotion < 0.4) {
      recommendations.push({
        type: 'energy',
        icon: '⚡',
        message: 'Consider taking a short break or listening to energizing music',
        priority: 'medium'
      });
    }

    // Posture recommendations
    if (wellness.factors.posture !== null && wellness.factors.posture < 0.5) {
      recommendations.push({
        type: 'posture',
        icon: '🏃',
        message: 'Adjust your sitting position and check your posture',
        priority: 'high'
      });
    }

    // Eye health recommendations
    if (wellness.factors.blinkHealth !== null && wellness.factors.blinkHealth < 0.6) {
      recommendations.push({
        type: 'eyes',
        icon: '👁️',
        message: 'Take a break to rest your eyes and blink more frequently',
        priority: 'high'
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        type: 'positive',
        icon: '✅',
        message: 'Great job! Your wellness metrics look good',
        priority: 'low'
      });
    }

    return (
      <div className="wellness-recommendations">
        <h4>Recommendations</h4>
        {recommendations.map((rec, index) => (
          <div key={index} className={`recommendation ${rec.priority}`}>
            <span className="rec-icon">{rec.icon}</span>
            <span className="rec-message">{rec.message}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="wellness-monitor">
      <div className="monitor-header">
        <h2>Wellness Monitor</h2>
        <div className="tab-navigation">
          <button 
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={activeTab === 'emotion' ? 'active' : ''}
            onClick={() => setActiveTab('emotion')}
          >
            Emotion
          </button>
          <button 
            className={activeTab === 'posture' ? 'active' : ''}
            onClick={() => setActiveTab('posture')}
          >
            Posture
          </button>
        </div>
      </div>

      <div className="monitor-content">
        {activeTab === 'overview' && renderOverview()}
        
        {activeTab === 'emotion' && (
          <EmotionCamera 
            onEmotionUpdate={setEmotionData}
            isActive={isActive}
          />
        )}
        
        {activeTab === 'posture' && (
          <PostureMonitor 
            onPostureUpdate={setPostureData}
            isActive={isActive}
          />
        )}
      </div>
    </div>
  );
};

export default WellnessMonitor;