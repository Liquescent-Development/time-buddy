// Guard for testing outside Electron
if (typeof require !== 'undefined') {
    try {
        var { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
    } catch (error) {
        if (require.main === module) {
            console.log('This file should be run with Electron, not Node.js directly');
            process.exit(1);
        }
        // If required as module during testing, export empty object
        module.exports = {};
        return;
    }
}
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');

// Set app name early for macOS menu bar
app.setName('Time Buddy');

// Debug: Log user data paths
console.log('User data path:', app.getPath('userData'));
console.log('App name:', app.getName());

// Keep a global reference of the window object
let mainWindow;
let serverProcess;
let mockServerProcess;
const SERVER_PORT = 3000;
const MOCK_SERVER_PORT = 3001;

// Check for demo mode command line argument
const isDemoMode = process.argv.includes('--demo') || process.argv.includes('-d');

// Enable live reload for development (optional)
if (process.env.NODE_ENV === 'development') {
    try {
        require('electron-reload')(__dirname, {
            electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
            hardResetMethod: 'exit'
        });
    } catch (error) {
        console.log('electron-reload not available, continuing without auto-reload');
    }
}

// Check if port is available
function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(port, () => {
            server.once('close', () => {
                resolve(true);
            });
            server.close();
        });
        server.on('error', () => {
            resolve(false);
        });
    });
}

// Start the Express server(s)
async function startServer() {
    if (isDemoMode) {
        // In demo mode, start both the regular frontend server and mock Grafana server
        await startFrontendServer();
        await startMockServer();
    } else {
        // In normal mode, just start the frontend server
        await startFrontendServer();
    }
}

// Start the frontend server (serves the UI)
async function startFrontendServer() {
    const portAvailable = await isPortAvailable(SERVER_PORT);
    
    if (!portAvailable) {
        console.log(`Port ${SERVER_PORT} is already in use, assuming frontend server is running`);
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        try {
            // In production, server.js is unpacked from asar
            const serverPath = app.isPackaged 
                ? path.join(__dirname, '..', 'app.asar.unpacked', 'server.js')
                : path.join(__dirname, 'server.js');
            
            console.log(`Starting frontend server: ${serverPath}`);
            
            // Require the server directly instead of spawning it
            process.env.PORT = SERVER_PORT;
            process.env.NODE_ENV = 'production';
            
            require(serverPath);
            
            // Give the server a moment to start
            setTimeout(() => {
                console.log('Frontend server started successfully');
                resolve();
            }, 1000);
            
        } catch (error) {
            console.error('Failed to start server:', error);
            resolve(); // Don't block the app
        }
    });
}

// Start the mock Grafana server (for demo mode)
async function startMockServer() {
    const portAvailable = await isPortAvailable(MOCK_SERVER_PORT);
    
    if (!portAvailable) {
        console.log(`Port ${MOCK_SERVER_PORT} is already in use, assuming mock server is running`);
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        // In production, mock_server.js is unpacked from asar
        const mockServerPath = app.isPackaged 
            ? path.join(__dirname, '..', 'app.asar.unpacked', 'mock_server.js')
            : path.join(__dirname, 'mock_server.js');
        
        console.log(`Starting mock Grafana server: ${mockServerPath}`);
        
        // Use the Node.js runtime that comes with Electron
        const nodePath = process.platform === 'darwin' 
            ? path.join(path.dirname(process.execPath), '..', 'Frameworks', 'Electron Framework.framework', 'Versions', 'A', 'Resources', 'node')
            : 'node';
        
        mockServerProcess = spawn(nodePath, [mockServerPath], {
            stdio: 'pipe',
            env: { ...process.env, PORT: MOCK_SERVER_PORT }
        });

        mockServerProcess.stdout.on('data', (data) => {
            console.log('Mock Server:', data.toString());
            if (data.toString().includes('Mock Grafana Server')) {
                resolve();
            }
        });

        mockServerProcess.stderr.on('data', (data) => {
            const errorStr = data.toString();
            console.error('Mock Server Error:', errorStr);
            
            // If port is already in use, resolve anyway
            if (errorStr.includes('EADDRINUSE')) {
                console.log('Mock server already running, continuing...');
                resolve();
            }
        });

        mockServerProcess.on('error', (error) => {
            console.error('Failed to start mock server:', error);
            console.log('Mock server start failed, but continuing anyway...');
            resolve();
        });

        // Timeout after 5 seconds
        setTimeout(() => {
            console.log('Mock server startup timeout, assuming server is ready...');
            resolve();
        }, 5000);
    });
}

// Create the main application window
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 1000,
        minWidth: 1200,
        minHeight: 800,
        icon: path.join(__dirname, 'assets', 'logo.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true
        },
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        show: false // Don't show until ready
    });

    // Load the application
    const baseUrl = `http://localhost:${SERVER_PORT}`;
    const url = isDemoMode ? `${baseUrl}?demo=true` : baseUrl;
    mainWindow.loadURL(url);
    
    // Log demo mode status
    if (isDemoMode) {
        console.log('🎭 Starting in demo mode with mock data');
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        
        // Focus on window
        if (process.platform === 'darwin') {
            app.dock.show();
        }
        mainWindow.focus();
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Prevent navigation to external sites
    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        if (parsedUrl.origin !== `http://localhost:${SERVER_PORT}`) {
            event.preventDefault();
        }
    });

    // Development tools
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }
}

// Create application menu
function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Query',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('menu-new-query');
                        }
                    }
                },
                {
                    label: 'Save Query',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('menu-save-query');
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Import Connection',
                    click: async () => {
                        const result = await dialog.showOpenDialog(mainWindow, {
                            properties: ['openFile'],
                            filters: [
                                { name: 'JSON Files', extensions: ['json'] }
                            ]
                        });
                        
                        if (!result.canceled && result.filePaths.length > 0) {
                            mainWindow.webContents.send('menu-import-connection', result.filePaths[0]);
                        }
                    }
                },
                {
                    label: 'Export Connection',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('menu-export-connection');
                        }
                    }
                },
                { type: 'separator' },
                process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectall' },
                { type: 'separator' },
                {
                    label: 'Find',
                    accelerator: 'CmdOrCtrl+F',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('menu-find');
                        }
                    }
                }
            ]
        },
        {
            label: 'Query',
            submenu: [
                {
                    label: 'Execute Query',
                    accelerator: 'CmdOrCtrl+Enter',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('menu-execute-query');
                        }
                    }
                },
                {
                    label: 'Format Query',
                    accelerator: 'CmdOrCtrl+Shift+F',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('menu-format-query');
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Clear Results',
                    accelerator: 'CmdOrCtrl+Shift+C',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('menu-clear-results');
                        }
                    }
                }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
                { type: 'separator' },
                {
                    label: 'Toggle Schema Explorer',
                    accelerator: 'CmdOrCtrl+E',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('menu-toggle-schema');
                        }
                    }
                },
                {
                    label: 'Toggle Query History',
                    accelerator: 'CmdOrCtrl+H',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.send('menu-toggle-history');
                        }
                    }
                }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                ...(process.platform === 'darwin' ? [
                    { type: 'separator' },
                    { role: 'front' }
                ] : [
                    { role: 'close' }
                ])
            ]
        },
        {
            label: 'Demo',
            submenu: [
                {
                    label: 'Toggle Demo Mode',
                    accelerator: 'CmdOrCtrl+Shift+D',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.webContents.executeJavaScript(`
                                if (typeof Demo !== 'undefined') {
                                    if (Demo.enabled) {
                                        Demo.disable();
                                    } else {
                                        Demo.enable();
                                    }
                                }
                            `);
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'About Demo Mode',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'Demo Mode',
                            message: 'Demo Mode Information',
                            detail: 'Demo mode provides mock data for:\n\n• Sample connections and data sources\n• Pre-built query examples\n• Mock schema data (metrics, measurements, fields, tags)\n• Sample dashboard queries\n• Query history and variables\n• File explorer with sample files\n\nPerfect for testing features or recording demos without exposing real data!'
                        });
                    }
                }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About Time Buddy',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'About Time Buddy',
                            message: 'Time Buddy',
                            detail: 'Your time series metric friend\n\nA powerful desktop IDE for executing InfluxQL and PromQL queries through the Grafana API.\n\nVersion: 0.1.0\nBuilt with Electron'
                        });
                    }
                },
                {
                    label: 'Learn More',
                    click: () => {
                        shell.openExternal('https://github.com/yourusername/grafana-query-ide');
                    }
                }
            ]
        }
    ];

    // macOS specific menu adjustments
    if (process.platform === 'darwin') {
        template.unshift({
            label: app.getName(),
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// App event handlers
app.whenReady().then(async () => {
    try {
        // Check if server was already started by electron-start.js
        if (process.env.ELECTRON_SERVER_STARTED === 'true') {
            console.log('Server already started by electron-start.js, skipping server startup...');
        } else {
            console.log('Starting Express server...');
            await startServer();
            console.log('Server started, creating main window...');
        }
        
        createMainWindow();
        createMenu();
        
        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createMainWindow();
            }
        });
    } catch (error) {
        console.error('Failed to start application:', error);
        dialog.showErrorBox('Startup Error', 'Failed to start the application server.');
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
    if (mockServerProcess) {
        mockServerProcess.kill();
    }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (event, navigationUrl) => {
        event.preventDefault();
        shell.openExternal(navigationUrl);
    });
});

// IPC handlers for file operations
ipcMain.handle('save-file', async (event, content, filename) => {
    // Determine file type from filename extension
    const ext = filename.toLowerCase().split('.').pop();
    
    let filters = [];
    if (ext === 'isql') {
        filters = [
            { name: 'InfluxQL Query Files', extensions: ['isql'] },
            { name: 'All Files', extensions: ['*'] }
        ];
    } else if (ext === 'promql') {
        filters = [
            { name: 'PromQL Query Files', extensions: ['promql'] },
            { name: 'All Files', extensions: ['*'] }
        ];
    } else if (ext === 'json') {
        filters = [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
        ];
    } else {
        filters = [
            { name: 'Query Files', extensions: ['isql', 'promql'] },
            { name: 'All Files', extensions: ['*'] }
        ];
    }
    
    const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: filename,
        filters: filters
    });
    
    if (!result.canceled) {
        const fs = require('fs').promises;
        await fs.writeFile(result.filePath, content);
        return result.filePath;
    }
    return null;
});

// Write file directly to a specific path (no dialog)
ipcMain.handle('write-file', async (event, filePath, content) => {
    const fs = require('fs').promises;
    try {
        await fs.writeFile(filePath, content);
        return true;
    } catch (error) {
        throw new Error(`Failed to write file: ${error.message}`);
    }
});

ipcMain.handle('load-file', async (event, filePath) => {
    const fs = require('fs').promises;
    const content = await fs.readFile(filePath, 'utf8');
    return content;
});

ipcMain.handle('select-directory', async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
        return { filePaths: result.filePaths, canceled: false };
    }
    return { canceled: true };
});

ipcMain.handle('read-directory', async (event, dirPath) => {
    const fs = require('fs').promises;
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const files = [];
        
        for (const entry of entries) {
            if (entry.isFile() && (
                entry.name.endsWith('.isql') || 
                entry.name.endsWith('.promql') || 
                entry.name.endsWith('.sql')
            )) {
                files.push({
                    name: entry.name,
                    path: require('path').join(dirPath, entry.name),
                    isFile: true
                });
            }
        }
        
        return files;
    } catch (error) {
        throw new Error(`Failed to read directory: ${error.message}`);
    }
});

ipcMain.handle('read-file-content', async (event, filePath) => {
    const fs = require('fs').promises;
    try {
        const content = await fs.readFile(filePath, 'utf8');
        return content;
    } catch (error) {
        throw new Error(`Failed to read file: ${error.message}`);
    }
});