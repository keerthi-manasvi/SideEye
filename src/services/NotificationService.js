/**
 * Notification Service
 * Handles notifications, reminders, and AI suggestions
 */
import themeService from './ThemeService';

class NotificationService {
  constructor() {
    this.notifications = [];
    this.listeners = [];
    this.reminderTimers = new Map();
    this.lastEmotionCheck = null;
    this.notificationQueue = [];
    this.isProcessingQueue = false;
  }

  /**
   * Add a notification listener
   */
  addListener(callback) {
    this.listeners.push(callback);
  }

  /**
   * Remove a notification listener
   */
  removeListener(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  /**
   * Notify all listeners of a new notification
   */
  notifyListeners(notification) {
    this.listeners.forEach(listener => {
      try {
        listener(notification);
      } catch (error) {
        console.error('Error in notification listener:', error);
      }
    });
  }

  /**
   * Show a notification
   */
  showNotification(message, type = 'info', duration = 5000, actions = []) {
    const notification = {
      id: Date.now() + Math.random(),
      message,
      type, // 'info', 'success', 'warning', 'error', 'suggestion'
      timestamp: Date.now(),
      duration,
      actions,
      dismissed: false
    };

    this.notifications.push(notification);
    this.notifyListeners(notification);

    // Auto-dismiss after duration
    if (duration > 0) {
      setTimeout(() => {
        this.dismissNotification(notification.id);
      }, duration);
    }

    return notification.id;
  }

  /**
   * Dismiss a notification
   */
  dismissNotification(notificationId) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.dismissed = true;
      this.notifyListeners({ ...notification, action: 'dismissed' });
    }
  }

  /**
   * Process emotion data and trigger appropriate notifications/suggestions
   */
  async processEmotionData(emotionData, userPreferences = {}) {
    try {
      this.lastEmotionCheck = Date.now();

      // Send emotion data to Django backend for analysis
      if (window.electronAPI) {
        const response = await window.electronAPI.callDjangoAPI('/emotions/analyze/', 'POST', {
          emotions: emotionData.emotions,
          energy_level: emotionData.energyLevel,
          confidence: emotionData.confidence,
          posture_score: 0.8, // Default value, should come from posture detection
          blink_rate: 15.0,   // Default value, should come from blink detection
          context: {
            timestamp: emotionData.timestamp,
            primary_emotion: emotionData.primaryEmotion
          }
        });

        if (response.success && response.data.notifications) {
          // Process notifications from backend
          response.data.notifications.scheduled.forEach(notification => {
            this.showNotification(
              notification.message,
              'suggestion',
              8000,
              notification.actions || []
            );
          });
        }
      }

      // Local emotion-based notifications
      this.checkEmotionBasedNotifications(emotionData, userPreferences);

    } catch (error) {
      console.error('Error processing emotion data:', error);
    }
  }

  /**
   * Check for emotion-based notifications (local processing)
   */
  checkEmotionBasedNotifications(emotionData, userPreferences) {
    const { primaryEmotion, energyLevel, confidence } = emotionData;

    // Theme suggestion based on emotion
    if (confidence > 0.7) {
      const themeSuggestion = themeService.getThemeSuggestion(primaryEmotion, energyLevel, confidence);
      if (themeSuggestion && Math.random() < 0.3) { // 30% chance to suggest theme
        this.showNotification(
          `🎨 ${themeSuggestion.reason}, would you like to try the "${themeSuggestion.theme.name}" theme?`,
          'suggestion',
          8000,
          [
            { label: 'Apply Theme', action: 'apply_theme', data: themeSuggestion },
            { label: 'Not Now', action: 'dismiss' }
          ]
        );
      }
    }

    // Low energy notification
    if (energyLevel < 0.3 && confidence > 0.6) {
      this.showNotification(
        "Your energy seems low. Consider taking a short break or listening to some energizing music.",
        'suggestion',
        7000,
        [
          { label: 'Play Music', action: 'suggest_music' },
          { label: 'Dismiss', action: 'dismiss' }
        ]
      );
    }

    // High stress/negative emotion notification
    if ((primaryEmotion === 'angry' || primaryEmotion === 'sad') && confidence > 0.7) {
      this.showNotification(
        "You seem stressed. Would you like me to suggest some calming activities?",
        'suggestion',
        8000,
        [
          { label: 'Breathing Exercise', action: 'breathing_exercise' },
          { label: 'Calming Music', action: 'calming_music' },
          { label: 'Change Theme', action: 'suggest_calming_theme' },
          { label: 'Not Now', action: 'dismiss' }
        ]
      );
    }

    // Productivity boost for high energy
    if (energyLevel > 0.8 && primaryEmotion === 'happy') {
      this.showNotification(
        "You're in a great mood! Perfect time to tackle challenging tasks.",
        'info',
        5000,
        [
          { label: 'Show Tasks', action: 'show_tasks' },
          { label: 'Thanks', action: 'dismiss' }
        ]
      );
    }
  }

  /**
   * Set up wellness reminders
   */
  setupWellnessReminders(preferences = {}) {
    const defaultReminders = {
      posture: { interval: 30 * 60 * 1000, enabled: true }, // 30 minutes
      hydration: { interval: 60 * 60 * 1000, enabled: true }, // 1 hour
      eyeBreak: { interval: 20 * 60 * 1000, enabled: true }, // 20 minutes (20-20-20 rule)
      movement: { interval: 45 * 60 * 1000, enabled: true }  // 45 minutes
    };

    const reminders = { ...defaultReminders, ...preferences.reminders };

    // Clear existing reminders
    this.reminderTimers.forEach(timer => clearInterval(timer));
    this.reminderTimers.clear();

    // Set up new reminders
    Object.entries(reminders).forEach(([type, config]) => {
      if (config.enabled) {
        const timer = setInterval(() => {
          this.showWellnessReminder(type);
        }, config.interval);
        
        this.reminderTimers.set(type, timer);
      }
    });

    console.log('Wellness reminders set up:', Object.keys(reminders).filter(k => reminders[k].enabled));
  }

  /**
   * Show wellness reminder
   */
  showWellnessReminder(type) {
    const reminders = {
      posture: {
        message: "Time for a posture check! Sit up straight and adjust your position.",
        actions: [
          { label: 'Done', action: 'dismiss' },
          { label: 'Remind Later', action: 'snooze_posture' }
        ]
      },
      hydration: {
        message: "Stay hydrated! Time to drink some water.",
        actions: [
          { label: 'Had Water', action: 'dismiss' },
          { label: 'Remind Later', action: 'snooze_hydration' }
        ]
      },
      eyeBreak: {
        message: "Give your eyes a break! Look at something 20 feet away for 20 seconds.",
        actions: [
          { label: 'Done', action: 'dismiss' },
          { label: 'Skip', action: 'dismiss' }
        ]
      },
      movement: {
        message: "Time to move! Stand up and stretch for a few minutes.",
        actions: [
          { label: 'Stretched', action: 'dismiss' },
          { label: 'Remind Later', action: 'snooze_movement' }
        ]
      }
    };

    const reminder = reminders[type];
    if (reminder) {
      this.showNotification(
        reminder.message,
        'reminder',
        10000, // Longer duration for reminders
        reminder.actions
      );
    }
  }

  /**
   * Handle notification actions
   */
  async handleNotificationAction(notificationId, action) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (!notification) return;

    switch (action) {
      case 'dismiss':
        this.dismissNotification(notificationId);
        break;

      case 'apply_theme':
        this.applyTheme(notification);
        this.dismissNotification(notificationId);
        break;

      case 'suggest_calming_theme':
        this.suggestCalmingTheme();
        this.dismissNotification(notificationId);
        break;

      case 'suggest_music':
        await this.suggestMusic();
        this.dismissNotification(notificationId);
        break;

      case 'calming_music':
        await this.suggestMusic('calming');
        this.dismissNotification(notificationId);
        break;

      case 'breathing_exercise':
        this.startBreathingExercise();
        this.dismissNotification(notificationId);
        break;

      case 'show_tasks':
        this.showTasks();
        this.dismissNotification(notificationId);
        break;

      case 'snooze_posture':
      case 'snooze_hydration':
      case 'snooze_movement':
        this.snoozeReminder(action.replace('snooze_', ''));
        this.dismissNotification(notificationId);
        break;

      default:
        console.log('Unknown notification action:', action);
    }
  }

  /**
   * Apply theme from notification
   */
  applyTheme(notification) {
    const actionData = notification.actions?.find(a => a.action === 'apply_theme')?.data;
    if (actionData && actionData.theme) {
      themeService.applyTheme(actionData.theme, actionData.emotion);
      this.showNotification(
        `✨ Applied "${actionData.theme.name}" theme!`,
        'success',
        3000
      );
    }
  }

  /**
   * Suggest calming theme
   */
  suggestCalmingTheme() {
    const calmingThemes = ['sad', 'neutral', 'fearful']; // These have calming color schemes
    const randomTheme = calmingThemes[Math.floor(Math.random() * calmingThemes.length)];
    const themeSuggestion = themeService.getThemeSuggestion(randomTheme, 0.3, 1.0);
    
    if (themeSuggestion) {
      this.showNotification(
        `🎨 Try the "${themeSuggestion.theme.name}" theme for a calming effect`,
        'suggestion',
        8000,
        [
          { label: 'Apply Theme', action: 'apply_theme', data: themeSuggestion },
          { label: 'Not Now', action: 'dismiss' }
        ]
      );
    }
  }

  /**
   * Suggest music based on current emotion
   */
  async suggestMusic(mood = 'auto') {
    try {
      if (window.electronAPI) {
        const emotionContext = this.lastEmotionCheck ? {
          emotions: { neutral: 1.0 }, // Simplified for now
          energy_level: 0.5
        } : null;

        const response = await window.electronAPI.callDjangoAPI('/music/recommend/', 'POST', {
          emotions: emotionContext?.emotions || { neutral: 1.0 },
          energy_level: emotionContext?.energy_level || 0.5,
          max_recommendations: 3,
          mood_override: mood !== 'auto' ? mood : undefined
        });

        if (response.success && response.data.recommendations) {
          const playlist = response.data.recommendations[0];
          this.showNotification(
            `🎵 Suggested playlist: ${playlist.title}`,
            'suggestion',
            8000,
            [
              { label: 'Play', action: 'play_music', data: playlist },
              { label: 'Skip', action: 'dismiss' }
            ]
          );
        }
      } else {
        // Fallback for browser mode
        this.showNotification(
          "🎵 Music suggestion: Try some focus music or nature sounds",
          'suggestion',
          5000
        );
      }
    } catch (error) {
      console.error('Error suggesting music:', error);
      this.showNotification(
        "Unable to suggest music right now. Try again later.",
        'error',
        3000
      );
    }
  }

  /**
   * Start breathing exercise
   */
  startBreathingExercise() {
    this.showNotification(
      "🫁 Breathing Exercise: Breathe in for 4 seconds...",
      'info',
      4000
    );

    setTimeout(() => {
      this.showNotification(
        "🫁 Hold for 4 seconds...",
        'info',
        4000
      );
    }, 4000);

    setTimeout(() => {
      this.showNotification(
        "🫁 Breathe out for 6 seconds...",
        'info',
        6000
      );
    }, 8000);

    setTimeout(() => {
      this.showNotification(
        "✨ Great! Repeat this cycle a few more times.",
        'success',
        5000
      );
    }, 14000);
  }

  /**
   * Show tasks (placeholder - would integrate with task management)
   */
  showTasks() {
    // This would typically trigger a view change or open a task panel
    this.showNotification(
      "📋 Opening task list...",
      'info',
      2000
    );
    
    // Emit event for app to handle
    window.dispatchEvent(new CustomEvent('show-tasks'));
  }

  /**
   * Snooze a reminder
   */
  snoozeReminder(type) {
    const snoozeTime = 10 * 60 * 1000; // 10 minutes
    
    setTimeout(() => {
      this.showWellnessReminder(type);
    }, snoozeTime);

    this.showNotification(
      `⏰ ${type} reminder snoozed for 10 minutes`,
      'info',
      2000
    );
  }

  /**
   * Get current notifications
   */
  getNotifications() {
    return this.notifications.filter(n => !n.dismissed);
  }

  /**
   * Clear all notifications
   */
  clearAllNotifications() {
    this.notifications.forEach(n => n.dismissed = true);
    this.notifyListeners({ action: 'clear_all' });
  }

  /**
   * Cleanup - stop all timers
   */
  dispose() {
    this.reminderTimers.forEach(timer => clearInterval(timer));
    this.reminderTimers.clear();
    this.listeners = [];
    this.notifications = [];
  }
}

// Create singleton instance
const notificationService = new NotificationService();

export default notificationService;