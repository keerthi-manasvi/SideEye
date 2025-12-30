/**
 * Theme Service
 * Handles dynamic theme changes based on emotions and user preferences
 */
class ThemeService {
  constructor() {
    this.currentTheme = 'default';
    this.emotionThemes = {
      happy: {
        name: 'Bright & Energetic',
        colors: {
          primary: '#FFD700',
          secondary: '#FF6B35',
          background: '#FFF8DC',
          text: '#333333',
          accent: '#32CD32'
        }
      },
      sad: {
        name: 'Calm & Soothing',
        colors: {
          primary: '#4682B4',
          secondary: '#87CEEB',
          background: '#F0F8FF',
          text: '#2F4F4F',
          accent: '#6495ED'
        }
      },
      angry: {
        name: 'Cool & Balanced',
        colors: {
          primary: '#2E8B57',
          secondary: '#20B2AA',
          background: '#F0FFF0',
          text: '#2F4F4F',
          accent: '#3CB371'
        }
      },
      neutral: {
        name: 'Clean & Professional',
        colors: {
          primary: '#61dafb',
          secondary: '#282c34',
          background: '#ffffff',
          text: '#333333',
          accent: '#0066cc'
        }
      },
      surprised: {
        name: 'Vibrant & Dynamic',
        colors: {
          primary: '#FF69B4',
          secondary: '#DA70D6',
          background: '#FFF0F5',
          text: '#4B0082',
          accent: '#FF1493'
        }
      },
      fearful: {
        name: 'Warm & Comforting',
        colors: {
          primary: '#DEB887',
          secondary: '#F4A460',
          background: '#FDF5E6',
          text: '#8B4513',
          accent: '#CD853F'
        }
      },
      disgusted: {
        name: 'Fresh & Clean',
        colors: {
          primary: '#98FB98',
          secondary: '#90EE90',
          background: '#F5FFFA',
          text: '#006400',
          accent: '#32CD32'
        }
      }
    };
    
    this.listeners = [];
    this.autoThemeEnabled = true;
  }

  /**
   * Add a theme change listener
   */
  addListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * Remove a theme change listener
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  /**
   * Notify all listeners of theme change
   */
  notifyListeners(theme) {
    this.listeners.forEach(listener => {
      try {
        listener(theme);
      } catch (error) {
        console.error('Error in theme listener:', error);
      }
    });
  }

  /**
   * Apply theme based on emotion
   */
  applyEmotionTheme(emotion, confidence = 1.0) {
    if (!this.autoThemeEnabled || confidence < 0.6) {
      return;
    }

    const theme = this.emotionThemes[emotion] || this.emotionThemes.neutral;
    this.applyTheme(theme, emotion);
  }

  /**
   * Apply a specific theme
   */
  applyTheme(theme, emotionContext = null) {
    this.currentTheme = theme.name;
    
    // Apply CSS custom properties
    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([property, value]) => {
      root.style.setProperty(`--theme-${property}`, value);
    });

    // Apply theme class to body
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${emotionContext || 'custom'}`);

    // Notify listeners
    this.notifyListeners({
      name: theme.name,
      colors: theme.colors,
      emotion: emotionContext,
      timestamp: Date.now()
    });

    console.log(`Applied theme: ${theme.name}${emotionContext ? ` (${emotionContext})` : ''}`);
  }

  /**
   * Get available themes
   */
  getAvailableThemes() {
    return Object.entries(this.emotionThemes).map(([emotion, theme]) => ({
      id: emotion,
      name: theme.name,
      emotion: emotion,
      colors: theme.colors,
      preview: this.generateThemePreview(theme)
    }));
  }

  /**
   * Generate theme preview
   */
  generateThemePreview(theme) {
    return {
      primarySwatch: theme.colors.primary,
      secondarySwatch: theme.colors.secondary,
      backgroundSwatch: theme.colors.background,
      textSwatch: theme.colors.text
    };
  }

  /**
   * Enable/disable automatic theme changes
   */
  setAutoThemeEnabled(enabled) {
    this.autoThemeEnabled = enabled;
    console.log(`Auto theme changes ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get current theme info
   */
  getCurrentTheme() {
    return {
      name: this.currentTheme,
      autoEnabled: this.autoThemeEnabled,
      timestamp: Date.now()
    };
  }

  /**
   * Reset to default theme
   */
  resetToDefault() {
    this.applyTheme(this.emotionThemes.neutral, 'neutral');
  }

  /**
   * Create custom theme
   */
  createCustomTheme(name, colors) {
    const customTheme = {
      name: name,
      colors: {
        primary: colors.primary || '#61dafb',
        secondary: colors.secondary || '#282c34',
        background: colors.background || '#ffffff',
        text: colors.text || '#333333',
        accent: colors.accent || '#0066cc'
      }
    };

    return customTheme;
  }

  /**
   * Save user theme preferences
   */
  saveThemePreferences(preferences) {
    try {
      localStorage.setItem('sideeyeThemePreferences', JSON.stringify({
        autoThemeEnabled: preferences.autoThemeEnabled ?? this.autoThemeEnabled,
        preferredThemes: preferences.preferredThemes || {},
        customThemes: preferences.customThemes || [],
        lastTheme: preferences.lastTheme || this.currentTheme,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error saving theme preferences:', error);
    }
  }

  /**
   * Load user theme preferences
   */
  loadThemePreferences() {
    try {
      const saved = localStorage.getItem('sideeyeThemePreferences');
      if (saved) {
        const preferences = JSON.parse(saved);
        this.autoThemeEnabled = preferences.autoThemeEnabled ?? true;
        
        // Apply last theme if available
        if (preferences.lastTheme && preferences.lastTheme !== 'default') {
          const emotion = Object.keys(this.emotionThemes).find(
            e => this.emotionThemes[e].name === preferences.lastTheme
          );
          if (emotion) {
            this.applyEmotionTheme(emotion, 1.0);
          }
        }
        
        return preferences;
      }
    } catch (error) {
      console.error('Error loading theme preferences:', error);
    }
    
    return null;
  }

  /**
   * Get theme suggestion based on emotion and energy
   */
  getThemeSuggestion(emotion, energyLevel, confidence) {
    if (confidence < 0.5) {
      return null;
    }

    const baseTheme = this.emotionThemes[emotion] || this.emotionThemes.neutral;
    
    // Modify theme based on energy level
    const adjustedTheme = this.adjustThemeForEnergy(baseTheme, energyLevel);
    
    return {
      theme: adjustedTheme,
      reason: this.getThemeReasonText(emotion, energyLevel),
      confidence: confidence,
      emotion: emotion,
      energyLevel: energyLevel
    };
  }

  /**
   * Adjust theme colors based on energy level
   */
  adjustThemeForEnergy(baseTheme, energyLevel) {
    // For high energy, make colors more vibrant
    // For low energy, make colors more muted
    const energyFactor = energyLevel;
    
    const adjustedTheme = {
      ...baseTheme,
      colors: { ...baseTheme.colors }
    };

    if (energyLevel > 0.7) {
      // High energy - more vibrant
      adjustedTheme.name = `${baseTheme.name} (Energized)`;
    } else if (energyLevel < 0.3) {
      // Low energy - more muted
      adjustedTheme.name = `${baseTheme.name} (Calm)`;
    }

    return adjustedTheme;
  }

  /**
   * Get explanation text for theme suggestion
   */
  getThemeReasonText(emotion, energyLevel) {
    const energyText = energyLevel > 0.7 ? 'high energy' : 
                      energyLevel < 0.3 ? 'low energy' : 'balanced energy';
    
    const emotionText = {
      happy: 'positive mood',
      sad: 'reflective state',
      angry: 'intense feelings',
      neutral: 'focused state',
      surprised: 'excited state',
      fearful: 'need for comfort',
      disgusted: 'need for freshness'
    }[emotion] || 'current mood';

    return `Based on your ${emotionText} and ${energyText} level`;
  }

  /**
   * Dispose of the service
   */
  dispose() {
    this.listeners = [];
    // Reset to default theme
    this.resetToDefault();
  }
}

// Create singleton instance
const themeService = new ThemeService();

// Load preferences on initialization
themeService.loadThemePreferences();

export default themeService;