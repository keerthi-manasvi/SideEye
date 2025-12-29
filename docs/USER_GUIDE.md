# SideEye Workspace - User Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Features Overview](#features-overview)
3. [Installation](#installation)
4. [First Run Setup](#first-run-setup)
5. [Using SideEye](#using-sideeye)
6. [Configuration](#configuration)
7. [Troubleshooting](#troubleshooting)
8. [Privacy & Security](#privacy--security)
9. [Updates](#updates)
10. [Support](#support)

## Getting Started

SideEye Workspace is a privacy-focused biometric monitoring application that automatically optimizes your workspace environment based on your emotional state, energy levels, and wellness metrics. All processing happens locally on your machine to ensure complete privacy.

### Key Features

- 🎭 **Real-time Emotion Detection** - Uses your webcam to detect emotions and energy levels
- 🏃 **Posture & Wellness Monitoring** - Tracks posture and blink rates for health reminders
- 📋 **Smart Task Management** - Automatically sorts tasks based on your current energy level
- 🎵 **Intelligent Music Recommendations** - Suggests playlists based on your mood and preferences
- 🎨 **Adaptive Theme System** - Changes your workspace colors based on emotions
- 🔔 **Contextual Notifications** - Provides motivational or wellness reminders
- 🔒 **Complete Privacy** - All data processing happens locally, nothing leaves your machine

## Installation

### System Requirements

- **Operating System**: Windows 10+, macOS 10.14+, or Linux (Ubuntu 18.04+)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 2GB free space
- **Camera**: Webcam for emotion detection (optional, can use manual mode)
- **Python**: 3.7+ (automatically installed if needed)

### Download & Install

#### Windows

1. Download `SideEye-Workspace-Setup-1.0.0.exe` from the releases page
2. Run the installer and follow the setup wizard
3. The installer will automatically install Python dependencies
4. Launch SideEye Workspace from the Start Menu or Desktop

#### macOS

1. Download `SideEye-Workspace-1.0.0.dmg` from the releases page
2. Open the DMG file and drag SideEye Workspace to Applications
3. Launch the app (you may need to allow it in System Preferences > Security)
4. Python dependencies will be installed on first run

#### Linux

1. Download the appropriate package:
   - `SideEye-Workspace-1.0.0.AppImage` (Universal)
   - `sideeye-workspace_1.0.0_amd64.deb` (Debian/Ubuntu)
   - `sideeye-workspace-1.0.0.x86_64.rpm` (RedHat/CentOS)
2. Install using your package manager or run the AppImage directly
3. Ensure Python 3.7+ is installed on your system

## First Run Setup

When you first launch SideEye Workspace, you'll be guided through a setup wizard:

### 1. Welcome Screen

- Introduction to SideEye features
- Privacy policy acknowledgment

### 2. Camera Permissions

- Grant camera access for emotion detection
- Option to skip and use manual mode

### 3. Music Preferences

- Select your preferred music genres
- Configure energy-to-music mappings
- Connect to YouTube (optional)

### 4. Theme Preferences

- Choose preferred color palettes
- Set up emotion-to-theme mappings
- Configure CLI integrations (advanced)

### 5. Notification Settings

- Set notification frequency and tone
- Configure wellness reminder intervals

### 6. Privacy Settings

- Set data retention period
- Configure local data storage options

## Using SideEye

### Dashboard Overview

The main dashboard displays:

- **Current Emotion**: Real-time emotion detection results
- **Energy Level**: Your current energy state (0-100%)
- **Wellness Metrics**: Posture score and blink rate
- **Active Recommendations**: Current music/theme suggestions
- **Task List**: Energy-sorted task recommendations

### Emotion Detection

- **Automatic Mode**: Uses webcam for real-time detection
- **Manual Mode**: Set your emotion and energy manually
- **Privacy**: All processing happens locally using TensorFlow.js

### Task Management

1. Add tasks through the task panel
2. Assign complexity levels (1-5)
3. SideEye automatically sorts based on your energy
4. High energy = complex/creative tasks
5. Low energy = routine/administrative tasks

### Music Integration

1. Configure preferred genres in Settings
2. SideEye suggests playlists based on emotions
3. Provide feedback to improve recommendations
4. YouTube integration for playlist discovery

### Theme System

1. Set up preferred color palettes
2. Configure CLI hooks for external tools
3. Themes change automatically based on emotions
4. Supports terminal, IDE, and system themes

### Notifications

- **Motivational**: Encouraging messages during low productivity
- **Wellness**: Posture and eye strain reminders
- **Sarcastic**: Humorous alerts (if enabled)
- **Rate Limited**: Maximum 2 per 5 minutes, wellness 1 per hour

## Configuration

### Settings Panel

Access through the gear icon in the top-right corner:

#### General

- User name and preferences
- Language settings
- Startup behavior

#### Emotion Detection

- Camera selection and quality
- Detection sensitivity
- Confidence thresholds
- Manual mode settings

#### Music & Audio

- Preferred genres and artists
- Volume control integration
- YouTube API configuration
- Playlist caching settings

#### Themes & Appearance

- Color palette preferences
- CLI hook configurations
- Theme switching behavior
- External tool integrations

#### Notifications

- Frequency and timing
- Message tone and style
- Wellness reminder settings
- Do not disturb periods

#### Privacy & Data

- Data retention policies
- Export/import settings
- Local storage encryption
- Analytics preferences (all local)

### Advanced Configuration

#### CLI Hooks

Configure commands to execute when themes change:

```json
{
  "terminal": "echo 'set theme dark' > ~/.terminal_theme",
  "vscode": "code --install-extension theme-extension",
  "vim": "echo 'colorscheme dark' > ~/.vimrc_theme"
}
```

#### Custom Emotion Mappings

Define custom emotion-to-action mappings:

```json
{
  "happy": {
    "music": ["upbeat", "pop"],
    "theme": "bright",
    "tasks": "creative"
  },
  "focused": {
    "music": ["ambient", "lo-fi"],
    "theme": "minimal",
    "tasks": "complex"
  }
}
```

## Troubleshooting

### Common Issues

#### Camera Not Working

1. Check camera permissions in system settings
2. Ensure no other apps are using the camera
3. Try switching to manual mode in Settings
4. Restart the application

#### Python Dependencies Failed

1. Ensure Python 3.7+ is installed
2. Run `npm run postinstall` in the app directory
3. Check the logs in `%APPDATA%/SideEye Workspace/logs/`
4. Try manual installation: `pip install -r backend/requirements.txt`

#### Django Service Won't Start

1. Check if port 8000 is available
2. Verify Python dependencies are installed
3. Check Django logs in the backend directory
4. Try restarting the application

#### Music Recommendations Not Working

1. Check internet connection for YouTube API
2. Verify API key configuration
3. Try clearing playlist cache in Settings
4. Check if preferred genres are configured

#### Theme Changes Not Applied

1. Verify CLI hooks are configured correctly
2. Check if external tools support the commands
3. Test hooks manually in terminal
4. Review error logs for failed executions

### Log Files

- **Application Logs**: `%APPDATA%/SideEye Workspace/logs/app.log`
- **Django Logs**: `backend/sideeye.log`
- **Error Logs**: `%APPDATA%/SideEye Workspace/logs/error.log`

### Reset Configuration

To reset all settings:

1. Close SideEye Workspace
2. Delete `%APPDATA%/SideEye Workspace/config/`
3. Restart the application
4. Complete first-run setup again

## Privacy & Security

### Data Processing

- **Local Only**: All biometric data processed locally using TensorFlow.js
- **No Cloud**: No data transmitted to external servers
- **Encrypted Storage**: Optional local database encryption
- **Automatic Cleanup**: Configurable data retention periods

### Permissions

- **Camera**: Required for emotion detection (optional)
- **Microphone**: Not used by the application
- **Network**: Only for YouTube API and updates (optional)
- **File System**: Local configuration and data storage only

### Data Export

Export your data anytime:

1. Go to Settings > Privacy & Data
2. Click "Export Data"
3. Choose export format (JSON, CSV)
4. Save to desired location

### Secure Deletion

To completely remove all data:

1. Go to Settings > Privacy & Data
2. Click "Delete All Data"
3. Confirm deletion
4. Uninstall the application

## Updates

### Automatic Updates

- SideEye checks for updates on startup
- Updates are downloaded in the background
- You'll be notified when an update is ready
- Updates install on next restart

### Manual Updates

1. Go to Help > Check for Updates
2. Download and install if available
3. Restart the application

### Update Settings

- Enable/disable automatic updates
- Choose update channel (stable/beta)
- Configure download behavior

## Support

### Getting Help

- **Documentation**: Check this user guide first
- **FAQ**: See docs/FAQ.md for common questions
- **Issues**: Report bugs on GitHub Issues
- **Discussions**: Join community discussions on GitHub

### Reporting Issues

When reporting issues, please include:

1. Operating system and version
2. SideEye Workspace version
3. Steps to reproduce the issue
4. Error messages or logs
5. Screenshots if applicable

### Contributing

SideEye Workspace is open source! Contributions welcome:

- **Code**: Submit pull requests on GitHub
- **Documentation**: Improve guides and help docs
- **Testing**: Report bugs and test new features
- **Translations**: Help translate the interface

### Contact

- **GitHub**: https://github.com/sideeye-team/sideeye-workspace-app
- **Email**: support@sideeye-workspace.com
- **Community**: Join our Discord server

---

**Version**: 1.0.0  
**Last Updated**: December 2024  
**License**: MIT License
