# Deployment Guide

This guide covers building, packaging, and distributing SideEye Workspace across different platforms.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Build Process](#build-process)
- [Platform-Specific Packaging](#platform-specific-packaging)
- [Code Signing](#code-signing)
- [Distribution](#distribution)
- [CI/CD Pipeline](#cicd-pipeline)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Development Environment

- Node.js 16+ and npm
- Python 3.7+
- Git
- Platform-specific tools (see below)

### Platform-Specific Requirements

#### Windows

- Windows 10+ (for building)
- Windows SDK (for code signing)
- Visual Studio Build Tools (for native modules)

#### macOS

- macOS 10.14+ (for building)
- Xcode Command Line Tools
- Apple Developer Account (for code signing and notarization)

#### Linux

- Ubuntu 18.04+ or equivalent
- Build essentials (`build-essential` package)
- FPM for package creation (`gem install fpm`)

## Build Process

### 1. Environment Setup

```bash
# Clone repository
git clone https://github.com/sideeye-team/sideeye-workspace-app.git
cd sideeye-workspace-app

# Install dependencies
npm install
npm run postinstall

# Verify setup
npm run first-run-setup
```

### 2. Development Build

```bash
# Start development environment
npm run dev

# Run tests
npm test
cd backend && python manage.py test && cd ..

# Build React app
npm run react-build
```

### 3. Production Build

```bash
# Full production build
npm run build

# This will:
# 1. Build React app for production
# 2. Package with Electron Builder
# 3. Create distribution files in dist/
```

## Platform-Specific Packaging

### Windows

```bash
# Build for Windows only
npm run dist-win

# Output files:
# - dist/SideEye-Workspace-Setup-1.0.0.exe (NSIS installer)
# - dist/SideEye-Workspace-1.0.0-win.zip (portable)
```

#### Windows Installer Features

- NSIS installer with custom UI
- Desktop and Start Menu shortcuts
- Automatic Python dependency installation
- Uninstaller with data cleanup options
- Registry entries for file associations

### macOS

```bash
# Build for macOS only
npm run dist-mac

# Output files:
# - dist/SideEye-Workspace-1.0.0.dmg (disk image)
# - dist/SideEye-Workspace-1.0.0-mac.zip (archive)
```

#### macOS Package Features

- DMG with custom background and layout
- Code signing and notarization
- Gatekeeper compatibility
- Automatic dependency management

### Linux

```bash
# Build for Linux only
npm run dist-linux

# Output files:
# - dist/SideEye-Workspace-1.0.0.AppImage (universal)
# - dist/sideeye-workspace_1.0.0_amd64.deb (Debian/Ubuntu)
# - dist/sideeye-workspace-1.0.0.x86_64.rpm (RedHat/CentOS)
```

#### Linux Package Features

- AppImage for universal compatibility
- Native package formats (deb, rpm)
- Desktop file integration
- Icon and MIME type registration

### Cross-Platform Build

```bash
# Build for all platforms (requires platform-specific tools)
npm run dist-all

# Build specific combinations
electron-builder -mwl  # macOS, Windows, Linux
electron-builder -ml   # macOS, Linux only
electron-builder -mw   # macOS, Windows only
```

## Code Signing

### Windows Code Signing

1. **Obtain Code Signing Certificate**

   - Purchase from trusted CA (DigiCert, Sectigo, etc.)
   - Or use EV certificate for immediate trust

2. **Configure Environment**

   ```bash
   # Set environment variables
   export CSC_LINK="path/to/certificate.p12"
   export CSC_KEY_PASSWORD="certificate_password"
   ```

3. **Build with Signing**
   ```bash
   npm run dist-win
   ```

### macOS Code Signing and Notarization

1. **Apple Developer Setup**

   - Apple Developer Account
   - Developer ID Application certificate
   - App-specific password for notarization

2. **Configure Environment**

   ```bash
   # Set environment variables
   export APPLE_ID="your-apple-id@example.com"
   export APPLE_ID_PASS="app-specific-password"
   export APPLE_TEAM_ID="your-team-id"
   ```

3. **Build with Signing and Notarization**
   ```bash
   npm run dist-mac
   ```

The build process will automatically:

- Sign the application
- Create a notarized DMG
- Staple the notarization ticket

## Distribution

### GitHub Releases

1. **Automated Release** (Recommended)

   ```bash
   # Tag and push
   git tag v1.0.0
   git push origin v1.0.0

   # GitHub Actions will automatically:
   # - Build for all platforms
   # - Create GitHub release
   # - Upload distribution files
   ```

2. **Manual Release**

   ```bash
   # Build all platforms
   npm run dist-all

   # Create GitHub release manually
   # Upload files from dist/ directory
   ```

### Auto-Updates

The application includes auto-update functionality:

1. **GitHub Releases** (Default)

   - Updates are served from GitHub Releases
   - Automatic update checking on startup
   - Background downloads with user notification

2. **Custom Update Server**
   ```json
   // In package.json build config
   "publish": {
     "provider": "generic",
     "url": "https://your-update-server.com/releases/"
   }
   ```

### Distribution Channels

#### Official Channels

- GitHub Releases (primary)
- Microsoft Store (Windows)
- Mac App Store (macOS)
- Snap Store (Linux)
- Flathub (Linux)

#### Third-Party Channels

- Chocolatey (Windows)
- Homebrew (macOS)
- AUR (Arch Linux)

## CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/build.yml
name: Build and Release

on:
  push:
    tags: ["v*"]
  pull_request:
    branches: [main]

jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: "16"
          cache: "npm"

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: "3.9"

      - name: Install dependencies
        run: |
          npm ci
          npm run postinstall

      - name: Run tests
        run: |
          npm test
          cd backend && python -m pytest && cd ..

      - name: Build application
        run: npm run dist
        env:
          CSC_LINK: ${{ secrets.CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_ID_PASS: ${{ secrets.APPLE_ID_PASS }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: dist-${{ matrix.os }}
          path: dist/

  release:
    if: startsWith(github.ref, 'refs/tags/')
    needs: build
    runs-on: ubuntu-latest

    steps:
      - name: Download artifacts
        uses: actions/download-artifact@v3

      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: dist-*/*
          generate_release_notes: true
```

### Environment Variables

Set these secrets in your GitHub repository:

```bash
# Windows Code Signing
CSC_LINK=<base64-encoded-certificate>
CSC_KEY_PASSWORD=<certificate-password>

# macOS Code Signing
APPLE_ID=<apple-id-email>
APPLE_ID_PASS=<app-specific-password>
APPLE_TEAM_ID=<apple-team-id>

# Optional: Custom update server
GH_TOKEN=<github-token>
```

## Troubleshooting

### Common Build Issues

#### Python Dependencies

```bash
# Error: Python not found
# Solution: Ensure Python 3.7+ is installed and in PATH

# Error: pip install fails
# Solution: Update pip and setuptools
python -m pip install --upgrade pip setuptools
```

#### Node.js Dependencies

```bash
# Error: Native module compilation fails
# Solution: Install build tools
npm install -g windows-build-tools  # Windows
xcode-select --install               # macOS
sudo apt-get install build-essential # Linux
```

#### Electron Builder Issues

```bash
# Error: Code signing fails
# Solution: Verify certificate and environment variables

# Error: Notarization fails (macOS)
# Solution: Check Apple ID credentials and app-specific password

# Error: Out of memory during build
# Solution: Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
```

### Platform-Specific Issues

#### Windows

- **Antivirus False Positives**: Submit to antivirus vendors for whitelisting
- **SmartScreen Warnings**: Build reputation through code signing and downloads
- **Permission Issues**: Run installer as administrator if needed

#### macOS

- **Gatekeeper Blocks**: Ensure proper code signing and notarization
- **Quarantine Attribute**: Users may need to remove quarantine manually
- **Rosetta 2**: Test on both Intel and Apple Silicon Macs

#### Linux

- **Missing Dependencies**: Include all required libraries in package
- **Permission Issues**: Ensure proper file permissions in packages
- **Desktop Integration**: Test .desktop file and icon installation

### Debug Build Issues

```bash
# Enable verbose logging
DEBUG=electron-builder npm run dist

# Build without packaging (faster for debugging)
npm run pack

# Test specific platform
electron-builder --linux --x64
electron-builder --win --x64
electron-builder --mac --x64
```

### Performance Optimization

```bash
# Reduce bundle size
npm run analyze  # Analyze bundle size

# Optimize images and assets
npm run optimize-assets

# Enable compression
# Add to electron-builder config:
"compression": "maximum"
```

## Release Checklist

Before releasing a new version:

- [ ] Update version in package.json
- [ ] Update CHANGELOG.md
- [ ] Run full test suite
- [ ] Test on all target platforms
- [ ] Verify auto-update functionality
- [ ] Check code signing certificates
- [ ] Update documentation
- [ ] Create release notes
- [ ] Tag release in Git
- [ ] Monitor release deployment
- [ ] Test download and installation
- [ ] Update website and documentation

## Security Considerations

- **Code Signing**: Always sign releases for security and trust
- **Dependency Scanning**: Regularly scan for vulnerable dependencies
- **Update Security**: Use HTTPS for all update communications
- **Privacy**: Ensure no sensitive data in build artifacts
- **Permissions**: Request minimal system permissions

## Support

For deployment issues:

- Check [GitHub Issues](https://github.com/sideeye-team/sideeye-workspace-app/issues)
- Review [Electron Builder docs](https://www.electron.build/)
- Contact the development team

---

**Last Updated**: December 2024  
**Version**: 1.0.0
