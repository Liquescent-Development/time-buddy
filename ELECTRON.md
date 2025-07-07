# Grafana Query IDE - Desktop Application

This document describes the desktop version of Grafana Query IDE built with Electron.

## Features

### Desktop-Specific Features
- **Native Desktop Application**: Runs as a standalone app on macOS, Windows, and Linux
- **Integrated Server**: Express server runs automatically within the app
- **Menu Bar Integration**: Native menus with keyboard shortcuts
- **File Operations**: Import/export connections and queries using native file dialogs
- **No Browser Required**: Fully self-contained desktop application
- **Auto-Updater Ready**: Framework for automatic updates (future enhancement)

### Keyboard Shortcuts
- `Ctrl+Enter` (Cmd+Enter on Mac): Execute query
- `Ctrl+N` (Cmd+N on Mac): New query (clear editor)
- `Ctrl+S` (Cmd+S on Mac): Save current query to file
- `Ctrl+Shift+F` (Cmd+Shift+F on Mac): Format query
- `Ctrl+F` (Cmd+F on Mac): Find in editor
- `Ctrl+E` (Cmd+E on Mac): Toggle schema explorer
- `Ctrl+H` (Cmd+H on Mac): Toggle query history
- `Ctrl+Shift+C` (Cmd+Shift+C on Mac): Clear results

### Menu Features
- **File Menu**: New query, save query, import/export connections
- **Edit Menu**: Standard editing operations (undo, redo, copy, paste, find)
- **Query Menu**: Execute, format, and clear operations
- **View Menu**: Toggle panels, zoom controls, developer tools
- **Window Menu**: Standard window management
- **Help Menu**: About dialog and documentation links

## Development

### Prerequisites
- Node.js 14 or higher
- npm or yarn

### Install Dependencies
```bash
npm install
```

### Development Mode
Start the app in development mode with auto-reload:
```bash
npm run electron-dev
```

Alternative development command (using concurrently):
```bash
npm run electron-dev-alt
```

### Testing Setup
Validate the Electron configuration:
```bash
node test-electron.js
```

## Building

### Build for Current Platform
```bash
npm run build
```

### Build for Specific Platforms
```bash
npm run build-mac     # macOS DMG
npm run build-win     # Windows installer
npm run build-linux  # Linux AppImage
```

### Build for All Platforms
```bash
npm run build-all
```

### Quick Development Build
```bash
npm run pack  # Creates unpackaged directory
```

## File Structure

```
grafana-query-ide/
├── main.js              # Electron main process
├── preload.js           # Preload script for security
├── electron-start.js    # Development startup script
├── build.js            # Custom build script
├── test-electron.js    # Setup validation script
├── server.js           # Express server (embedded)
├── assets/             # App icons and resources
│   ├── icon.png        # Linux icon (512x512)
│   ├── icon.ico        # Windows icon
│   ├── icon.icns       # macOS icon
│   └── README.md       # Icon creation guide
├── public/             # Web application files
└── dist/               # Built applications (created during build)
```

## Configuration

### App Configuration
The app configuration is in `package.json` under the `build` key:

```json
{
  "build": {
    "appId": "com.grafana.query-ide",
    "productName": "Grafana Query IDE",
    "mac": {
      "category": "public.app-category.developer-tools"
    },
    "win": {
      "target": "nsis"
    },
    "linux": {
      "target": "AppImage",
      "category": "Development"
    }
  }
}
```

### Security
- **Context Isolation**: Enabled for security
- **Node Integration**: Disabled in renderer
- **Preload Script**: Secure API exposure via contextBridge
- **CSP**: Content Security Policy applied
- **External Links**: Opened in default browser, not in app

## Architecture

```
┌─────────────────┐
│   Electron App  │
│                 │
│  ┌───────────┐  │     ┌─────────────────┐
│  │  Renderer │  │────▶│ Grafana Instance│
│  │ (Web App) │  │     │   (Your API)    │
│  └───────────┘  │     │                 │
│         │        │     │ • Data Sources  │
│         ▼        │     │ • Authentication│
│  ┌───────────┐  │     │ • Query API     │
│  │   Main    │  │     │                 │
│  │ (Express  │  │     │                 │
│  │  Server)  │  │     │                 │
│  └───────────┘  │     │                 │
└─────────────────┘     └─────────────────┘
    Port 3000 Internal       External API
```

The desktop app runs a local Express server on port 3000 internally, which proxies requests to your Grafana instance to handle CORS and SSL certificates.

## Platform-Specific Notes

### macOS
- **DMG Distribution**: Creates a drag-and-drop installer
- **Code Signing**: Requires Apple Developer account for distribution
- **Gatekeeper**: Users may need to allow the app in Security preferences
- **Dock Integration**: App appears in dock and application switcher

### Windows
- **NSIS Installer**: Creates a Windows installer executable
- **Code Signing**: Recommended for distribution to avoid security warnings
- **Registry**: Installer can create registry entries for file associations
- **Start Menu**: App appears in Start Menu after installation

### Linux
- **AppImage**: Single portable executable file
- **Desktop Integration**: Integrates with desktop environment menus
- **Dependencies**: Includes all required dependencies
- **Permissions**: May need to mark as executable after download

## Troubleshooting

### Common Issues

#### Port 3000 in Use
If port 3000 is already in use:
```bash
# Find what's using the port
lsof -ti:3000

# Kill the process
kill $(lsof -ti:3000)
```

#### Build Failures
- Ensure all dependencies are installed: `npm install`
- Clear node_modules and reinstall if needed
- Check that Python and build tools are available for native modules

#### App Won't Start
- Check console output for errors
- Ensure server.js is present and working
- Verify all required files exist with `node test-electron.js`

#### Icons Not Showing
- Icons are optional; app will use default Electron icon if missing
- See `assets/README.md` for icon creation instructions
- Icons must be in correct formats for each platform

### Development Tips

#### Debug Mode
- Press `Ctrl+Shift+I` (or `Cmd+Option+I` on Mac) to open DevTools
- Use `console.log()` in renderer process for debugging
- Check main process output in terminal

#### Hot Reload
The development mode includes automatic reloading when files change. If you need to restart:
```bash
# Stop the app (Ctrl+C) and restart
npm run electron-dev
```

#### Testing Web Features
All web application features should work identically in the desktop version. Test:
- Connection management
- Query execution
- Schema exploration
- Variable management
- Query history
- Data visualization

## Future Enhancements

### Planned Features
- **Auto-Updater**: Automatic app updates
- **Multiple Windows**: Support for multiple query windows
- **Themes**: Additional dark/light theme options
- **Plugin System**: Support for custom extensions
- **Offline Mode**: Local query caching and offline analysis
- **Export Formats**: Additional data export formats
- **Custom Keybindings**: User-configurable keyboard shortcuts

### Contributing
To contribute to the desktop version:
1. Ensure changes work in both web and desktop modes
2. Test keyboard shortcuts and menu integration
3. Verify builds work on target platforms
4. Update this documentation for new features

## Distribution

### Preparing for Distribution
1. **Add Icons**: Create proper icons for all platforms in `assets/`
2. **Code Signing**: Set up code signing certificates for macOS/Windows
3. **Auto-Updater**: Implement update server for automatic updates
4. **Testing**: Test builds on all target platforms
5. **Documentation**: Update user documentation

### Release Process
1. Update version in `package.json`
2. Run full test suite: `node test-electron.js`
3. Build for all platforms: `npm run build-all`
4. Test built applications on each platform
5. Create release notes and publish

---

**Need Help?**
- Check the main README.md for web application documentation
- Review `test-electron.js` output for configuration issues
- Open an issue for desktop-specific problems