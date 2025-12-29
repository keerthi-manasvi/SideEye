# SideEye Workspace

A privacy-focused biometric monitoring application that automatically optimizes your workspace environment based on your emotional state, energy levels, and wellness metrics.

![SideEye Workspace](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 🌟 Features

- **🎭 Real-time Emotion Detection** - Uses TensorFlow.js for local facial emotion analysis
- **🏃 Posture & Wellness Monitoring** - Tracks posture and blink rates with health alerts
- **📋 Smart Task Management** - Automatically sorts tasks based on current energy levels
- **🎵 Intelligent Music Recommendations** - Suggests playlists based on mood and preferences
- **🎨 Adaptive Theme System** - Changes workspace colors based on emotional state
- **🔔 Contextual Notifications** - Provides motivational and wellness reminders
- **🔒 Complete Privacy** - All processing happens locally, no data leaves your machine

## 🚀 Quick Start

### Installation

#### Download Pre-built Releases

- **Windows**: Download `SideEye-Workspace-Setup-1.0.0.exe`
- **macOS**: Download `SideEye-Workspace-1.0.0.dmg`
- **Linux**: Download `.AppImage`, `.deb`, or `.rpm` package

#### Development Setup

```bash
# Clone the repository
git clone https://github.com/sideeye-team/sideeye-workspace-app.git
cd sideeye-workspace-app

# Install dependencies
npm install

# Install Python dependencies
npm run postinstall

# Run first-time setup
npm run first-run-setup

# Start development environment
npm run dev
```

### System Requirements

- **OS**: Windows 10+, macOS 10.14+, Linux (Ubuntu 18.04+)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 2GB free space
- **Camera**: Webcam for emotion detection (optional)
- **Python**: 3.7+ (auto-installed if needed)

## 🏗️ Architecture

SideEye uses a hybrid architecture combining:

- **Electron** - Cross-platform desktop application framework
- **React** - Modern UI with real-time updates
- **Django** - Local background service for business logic
- **TensorFlow.js** - Privacy-focused machine learning inference
- **SQLite** - Local data storage

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Electron UI   │◄──►│  Django Service  │◄──►│  External APIs  │
│                 │    │                  │    │                 │
│ • React App     │    │ • Business Logic │    │ • YouTube API   │
│ • TensorFlow.js │    │ • Data Storage   │    │ • CLI Tools     │
│ • Camera Access │    │ • API Endpoints  │    │ • Theme Systems │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 📖 Documentation

- **[User Guide](docs/USER_GUIDE.md)** - Complete user documentation
- **[API Documentation](backend/api/README.md)** - Backend API reference
- **[Development Guide](docs/DEVELOPMENT.md)** - Setup and contribution guide
- **[Privacy Policy](docs/PRIVACY.md)** - Data handling and privacy information

## 🛠️ Development

### Prerequisites

- Node.js 16+ and npm
- Python 3.7+
- Git

### Development Commands

```bash
# Start development environment (Django + Electron)
npm run dev

# Start only React development server
npm run react-dev

# Start only Django development server
npm run django-dev

# Run tests
npm test

# Build for production
npm run build

# Package for distribution
npm run dist

# Package for all platforms
npm run dist-all
```

### Project Structure

```
sideeye-workspace-app/
├── src/                    # Frontend source code
│   ├── components/         # React components
│   ├── hooks/             # Custom React hooks
│   ├── services/          # Frontend services
│   └── main/              # Electron main process
├── backend/               # Django backend
│   ├── api/               # Django REST API
│   ├── sideeye_backend/   # Django project settings
│   └── requirements.txt   # Python dependencies
├── scripts/               # Build and setup scripts
├── docs/                  # Documentation
├── build-resources/       # Icons and build assets
└── public/               # Static assets and ML models
```

## 🔒 Privacy & Security

SideEye is designed with privacy as a core principle:

- **Local Processing**: All biometric data processed locally using TensorFlow.js
- **No Cloud Dependencies**: Core functionality works completely offline
- **Data Ownership**: All data stored locally, you maintain full control
- **Transparent**: Open source code, audit-friendly
- **Configurable**: Adjustable data retention and privacy settings

## 🎯 Use Cases

### Remote Workers

- Automatic workspace optimization based on energy levels
- Wellness reminders for posture and eye strain
- Productivity insights and task management

### Developers

- IDE theme switching based on focus state
- Terminal color adaptation for different moods
- Break reminders during intense coding sessions

### Content Creators

- Music recommendations for different creative states
- Environment optimization for recording/streaming
- Energy-based content planning

### Students

- Study environment optimization
- Focus state monitoring and improvement
- Break scheduling based on attention levels

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Ways to Contribute

- **Code**: Submit pull requests for new features or bug fixes
- **Documentation**: Improve guides, tutorials, and API docs
- **Testing**: Report bugs and test new features
- **Design**: UI/UX improvements and accessibility enhancements
- **Translations**: Help translate the interface

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📊 Roadmap

### Version 1.1 (Q1 2025)

- [ ] Mobile companion app
- [ ] Advanced analytics dashboard
- [ ] Plugin system for custom integrations
- [ ] Multi-monitor support

### Version 1.2 (Q2 2025)

- [ ] Team collaboration features
- [ ] Advanced ML models for better accuracy
- [ ] Voice command integration
- [ ] Cloud sync (optional, encrypted)

### Version 2.0 (Q3 2025)

- [ ] AI-powered productivity coaching
- [ ] Integration with popular productivity tools
- [ ] Advanced biometric monitoring
- [ ] Customizable automation workflows

## 🐛 Known Issues

- Camera initialization may be slow on some Linux distributions
- Windows Defender may flag the installer (false positive)
- macOS may require manual permission grants for camera access
- Some CLI integrations require manual configuration

See [Issues](https://github.com/sideeye-team/sideeye-workspace-app/issues) for the complete list.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [TensorFlow.js](https://www.tensorflow.org/js) for machine learning capabilities
- [face-api.js](https://github.com/justadudewhohacks/face-api.js) for facial recognition
- [Electron](https://www.electronjs.org/) for cross-platform desktop development
- [Django](https://www.djangoproject.com/) for robust backend architecture
- [React](https://reactjs.org/) for modern UI development

## 📞 Support

- **Documentation**: Check the [User Guide](docs/USER_GUIDE.md)
- **Issues**: Report bugs on [GitHub Issues](https://github.com/sideeye-team/sideeye-workspace-app/issues)
- **Discussions**: Join [GitHub Discussions](https://github.com/sideeye-team/sideeye-workspace-app/discussions)
- **Email**: support@sideeye-workspace.com

---

**Made with ❤️ by the SideEye Team**

_Empowering productivity through intelligent workspace automation while respecting your privacy._
