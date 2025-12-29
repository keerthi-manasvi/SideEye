import React, { useState, useEffect, useCallback } from 'react';
import './SettingsPanel.css';

const SettingsPanel = () => {
  const [settings, setSettings] = useState({
    // Music preferences
    preferredGenres: [],
    musicEnabled: true,
    musicEnergyMappings: {
      high: ['electronic', 'rock', 'pop'],
      medium: ['jazz', 'indie', 'alternative'],
      low: ['classical', 'ambient', 'acoustic']
    },
    
    // Theme preferences
    preferredThemes: [],
    themeEnabled: true,
    themeEmotionMappings: {
      happy: ['bright', 'colorful', 'light'],
      sad: ['blue', 'cool', 'muted'],
      angry: ['red', 'dark', 'high-contrast'],
      neutral: ['balanced', 'default', 'minimal']
    },
    
    // Notification settings
    notificationFrequency: 5,
    wellnessReminders: true,
    notificationTone: 'balanced',
    maxNotificationsPerHour: 12,
    
    // Privacy settings
    dataRetention: 30,
    cameraEnabled: true,
    dataExportEnabled: true
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  const predefinedGenres = [
    'jazz', 'classical', 'electronic', 'rock', 'pop', 'indie', 'alternative',
    'ambient', 'acoustic', 'hip-hop', 'r&b', 'country', 'folk', 'blues'
  ];

  const predefinedThemes = [
    'dark', 'light', 'blue', 'green', 'purple', 'warm', 'cool', 'minimal',
    'colorful', 'high-contrast', 'muted', 'bright'
  ];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      if (window.electronAPI) {
        const response = await window.electronAPI.callDjangoAPI('/preferences/', 'GET');
        if (response.success && response.data) {
          setSettings(prev => ({ ...prev, ...response.data }));
        }
      } else {
        // Browser mode - load from localStorage
        const savedSettings = localStorage.getItem('sideeyeSettings');
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          setSettings(prev => ({ ...prev, ...parsed }));
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSettingChange = useCallback((key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
    setSaveStatus(null); // Clear save status when settings change
  }, []);

  const handleArraySettingChange = useCallback((key, value, isAdd = true) => {
    setSettings(prev => {
      const currentArray = prev[key] || [];
      if (isAdd && !currentArray.includes(value)) {
        return { ...prev, [key]: [...currentArray, value] };
      } else if (!isAdd) {
        return { ...prev, [key]: currentArray.filter(item => item !== value) };
      }
      return prev;
    });
    setSaveStatus(null);
  }, []);

  const handleMappingChange = useCallback((mappingKey, emotionOrEnergy, values) => {
    setSettings(prev => ({
      ...prev,
      [mappingKey]: {
        ...prev[mappingKey],
        [emotionOrEnergy]: values
      }
    }));
    setSaveStatus(null);
  }, []);

  const handleSaveSettings = useCallback(async () => {
    setIsSaving(true);
    setSaveStatus(null);
    
    try {
      if (window.electronAPI) {
        const response = await window.electronAPI.callDjangoAPI(
          '/preferences/', 
          'POST', 
          settings
        );
        if (response.success) {
          setSaveStatus({ type: 'success', message: 'Settings saved successfully!' });
        } else {
          setSaveStatus({ type: 'error', message: 'Failed to save settings. Please try again.' });
        }
      } else {
        // Browser mode - save to localStorage
        localStorage.setItem('sideeyeSettings', JSON.stringify(settings));
        setSaveStatus({ type: 'success', message: 'Settings saved locally!' });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveStatus({ type: 'error', message: 'Error saving settings. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  }, [settings]);

  const handleResetSettings = useCallback(() => {
    if (window.confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      setSettings({
        preferredGenres: [],
        musicEnabled: true,
        musicEnergyMappings: {
          high: ['electronic', 'rock', 'pop'],
          medium: ['jazz', 'indie', 'alternative'],
          low: ['classical', 'ambient', 'acoustic']
        },
        preferredThemes: [],
        themeEnabled: true,
        themeEmotionMappings: {
          happy: ['bright', 'colorful', 'light'],
          sad: ['blue', 'cool', 'muted'],
          angry: ['red', 'dark', 'high-contrast'],
          neutral: ['balanced', 'default', 'minimal']
        },
        notificationFrequency: 5,
        wellnessReminders: true,
        notificationTone: 'balanced',
        maxNotificationsPerHour: 12,
        dataRetention: 30,
        cameraEnabled: true,
        dataExportEnabled: true
      });
      setSaveStatus(null);
    }
  }, []);

  const handleExportData = useCallback(async () => {
    try {
      let dataToExport = { settings };
      
      if (window.electronAPI) {
        // Get additional data from Django API
        const emotionResponse = await window.electronAPI.callDjangoAPI('/emotions/', 'GET');
        const feedbackResponse = await window.electronAPI.callDjangoAPI('/feedback/', 'GET');
        
        if (emotionResponse.success) dataToExport.emotions = emotionResponse.data;
        if (feedbackResponse.success) dataToExport.feedback = feedbackResponse.data;
      } else {
        // Browser mode - get data from localStorage
        const emotionData = localStorage.getItem('sideeyeEmotions');
        const feedbackData = localStorage.getItem('sideeyeFeedback');
        
        if (emotionData) dataToExport.emotions = JSON.parse(emotionData);
        if (feedbackData) dataToExport.feedback = JSON.parse(feedbackData);
      }
      
      const dataStr = JSON.stringify(dataToExport, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `sideeye-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setSaveStatus({ type: 'success', message: 'Data exported successfully!' });
    } catch (error) {
      console.error('Error exporting data:', error);
      setSaveStatus({ type: 'error', message: 'Error exporting data. Please try again.' });
    }
  }, [settings]);

  if (isLoading) {
    return (
      <div className="settings-panel">
        <div className="settings-header">
          <h2>Settings</h2>
          <p>Loading your preferences...</p>
        </div>
        <div className="loading-spinner" role="status" aria-label="Loading settings">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>Settings</h2>
        <p>Configure your SideEye workspace preferences</p>
        {saveStatus && (
          <div className={`save-status ${saveStatus.type}`} role="alert">
            {saveStatus.message}
          </div>
        )}
      </div>

      <div className="settings-sections">
        <div className="settings-section">
          <h3>Music Preferences</h3>
          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={settings.musicEnabled}
                onChange={(e) => handleSettingChange('musicEnabled', e.target.checked)}
                disabled={isSaving}
              />
              Enable automatic music suggestions
            </label>
          </div>
          
          <div className="setting-item">
            <label>Quick Genre Selection:</label>
            <div className="genre-tags">
              {predefinedGenres.map(genre => (
                <button
                  key={genre}
                  type="button"
                  className={`genre-tag ${settings.preferredGenres.includes(genre) ? 'selected' : ''}`}
                  onClick={() => handleArraySettingChange('preferredGenres', genre, !settings.preferredGenres.includes(genre))}
                  disabled={isSaving}
                  aria-pressed={settings.preferredGenres.includes(genre)}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>

          <div className="setting-item">
            <label>Custom Genres (comma-separated):</label>
            <input
              type="text"
              placeholder="Add custom genres..."
              value={settings.preferredGenres.filter(g => !predefinedGenres.includes(g)).join(', ')}
              onChange={(e) => {
                const customGenres = e.target.value.split(',').map(g => g.trim()).filter(g => g);
                const predefinedSelected = settings.preferredGenres.filter(g => predefinedGenres.includes(g));
                handleSettingChange('preferredGenres', [...predefinedSelected, ...customGenres]);
              }}
              disabled={isSaving}
            />
          </div>

          <div className="setting-item">
            <label>Energy Level Music Mappings:</label>
            {Object.entries(settings.musicEnergyMappings).map(([energy, genres]) => (
              <div key={energy} className="mapping-item">
                <span className="mapping-label">{energy.charAt(0).toUpperCase() + energy.slice(1)} Energy:</span>
                <input
                  type="text"
                  value={genres.join(', ')}
                  onChange={(e) => handleMappingChange('musicEnergyMappings', energy, 
                    e.target.value.split(',').map(g => g.trim()).filter(g => g)
                  )}
                  placeholder={`Genres for ${energy} energy...`}
                  disabled={isSaving}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <h3>Theme Preferences</h3>
          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={settings.themeEnabled}
                onChange={(e) => handleSettingChange('themeEnabled', e.target.checked)}
                disabled={isSaving}
              />
              Enable automatic theme changes
            </label>
          </div>

          <div className="setting-item">
            <label>Quick Theme Selection:</label>
            <div className="theme-tags">
              {predefinedThemes.map(theme => (
                <button
                  key={theme}
                  type="button"
                  className={`theme-tag ${settings.preferredThemes.includes(theme) ? 'selected' : ''}`}
                  onClick={() => handleArraySettingChange('preferredThemes', theme, !settings.preferredThemes.includes(theme))}
                  disabled={isSaving}
                  aria-pressed={settings.preferredThemes.includes(theme)}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>

          <div className="setting-item">
            <label>Custom Themes (comma-separated):</label>
            <input
              type="text"
              placeholder="Add custom themes..."
              value={settings.preferredThemes.filter(t => !predefinedThemes.includes(t)).join(', ')}
              onChange={(e) => {
                const customThemes = e.target.value.split(',').map(t => t.trim()).filter(t => t);
                const predefinedSelected = settings.preferredThemes.filter(t => predefinedThemes.includes(t));
                handleSettingChange('preferredThemes', [...predefinedSelected, ...customThemes]);
              }}
              disabled={isSaving}
            />
          </div>

          <div className="setting-item">
            <label>Emotion Theme Mappings:</label>
            {Object.entries(settings.themeEmotionMappings).map(([emotion, themes]) => (
              <div key={emotion} className="mapping-item">
                <span className="mapping-label">{emotion.charAt(0).toUpperCase() + emotion.slice(1)}:</span>
                <input
                  type="text"
                  value={themes.join(', ')}
                  onChange={(e) => handleMappingChange('themeEmotionMappings', emotion, 
                    e.target.value.split(',').map(t => t.trim()).filter(t => t)
                  )}
                  placeholder={`Themes for ${emotion} emotion...`}
                  disabled={isSaving}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <h3>Notifications</h3>
          <div className="setting-item">
            <label htmlFor="notification-frequency">Notification Frequency (minutes):</label>
            <input
              id="notification-frequency"
              type="number"
              min="1"
              max="60"
              value={settings.notificationFrequency}
              onChange={(e) => handleSettingChange('notificationFrequency', 
                parseInt(e.target.value) || 5
              )}
              disabled={isSaving}
            />
          </div>
          
          <div className="setting-item">
            <label htmlFor="max-notifications">Max Notifications per Hour:</label>
            <input
              id="max-notifications"
              type="number"
              min="1"
              max="60"
              value={settings.maxNotificationsPerHour}
              onChange={(e) => handleSettingChange('maxNotificationsPerHour', 
                parseInt(e.target.value) || 12
              )}
              disabled={isSaving}
            />
          </div>

          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={settings.wellnessReminders}
                onChange={(e) => handleSettingChange('wellnessReminders', e.target.checked)}
                disabled={isSaving}
              />
              Enable wellness reminders
            </label>
          </div>

          <div className="setting-item">
            <label htmlFor="notification-tone">Notification Tone:</label>
            <select
              id="notification-tone"
              value={settings.notificationTone}
              onChange={(e) => handleSettingChange('notificationTone', e.target.value)}
              disabled={isSaving}
            >
              <option value="motivational">Motivational</option>
              <option value="balanced">Balanced</option>
              <option value="sarcastic">Sarcastic</option>
            </select>
          </div>
        </div>

        <div className="settings-section">
          <h3>Privacy & Data</h3>
          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={settings.cameraEnabled}
                onChange={(e) => handleSettingChange('cameraEnabled', e.target.checked)}
                disabled={isSaving}
              />
              Enable camera access for emotion detection
            </label>
          </div>

          <div className="setting-item">
            <label htmlFor="data-retention">Data Retention (days):</label>
            <input
              id="data-retention"
              type="number"
              min="1"
              max="365"
              value={settings.dataRetention}
              onChange={(e) => handleSettingChange('dataRetention', 
                parseInt(e.target.value) || 30
              )}
              disabled={isSaving}
            />
          </div>

          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={settings.dataExportEnabled}
                onChange={(e) => handleSettingChange('dataExportEnabled', e.target.checked)}
                disabled={isSaving}
              />
              Enable data export functionality
            </label>
          </div>

          <div className="setting-item">
            <button 
              onClick={handleExportData}
              className="export-button"
              disabled={isSaving || !settings.dataExportEnabled}
            >
              Export My Data
            </button>
            <p className="setting-description">
              Download all your SideEye data including settings, emotion history, and feedback.
            </p>
          </div>
        </div>
      </div>

      <div className="settings-actions">
        <button 
          onClick={handleSaveSettings} 
          className="save-button"
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
        <button 
          onClick={handleResetSettings}
          className="reset-button"
          disabled={isSaving}
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;