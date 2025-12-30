# Build Resources

This directory contains assets needed for building the SideEye Workspace application.

## Required Files

### Icons
- `icon.ico` ✅ - Windows icon (present)
- `icon.png` ✅ - Linux icon (present) 
- `icon.icns` ❌ - macOS icon (needs to be created)

### DMG Background
- `dmg-background.png` ❌ - macOS DMG installer background image (needs to be created)

## Missing Files

### icon.icns
Convert the existing `icon.png` to macOS ICNS format. You can use:
- Online converters like CloudConvert
- macOS built-in tools: `sips -s format icns icon.png --out icon.icns`
- Third-party tools like IconUtil

### dmg-background.png
Create a background image for the macOS DMG installer. Recommended specifications:
- Size: 540x380 pixels
- Format: PNG with transparency support
- Design should match the app's branding
- Should provide clear visual guidance for drag-and-drop installation

## Entitlements
- `entitlements.mac.plist` ✅ - macOS app entitlements (present)

The entitlements file includes permissions for:
- Camera access (for biometric monitoring)
- Microphone access (for workspace automation)
- Network access (for API communication)
- File system access (for user data)
- JIT compilation (for TensorFlow.js)