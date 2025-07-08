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
app.setName('Grafana Query IDE');

// Debug: Log user data paths
console.log('User data path:', app.getPath('userData'));
console.log('App name:', app.getName());

// Keep a global reference of the window object
let mainWindow;
let serverProcess;
const SERVER_PORT = 3000;

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

// Start the Express server
async function startServer() {
    const portAvailable = await isPortAvailable(SERVER_PORT);
    
    if (!portAvailable) {
        console.log(`Port ${SERVER_PORT} is already in use, assuming server is running`);
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const serverPath = path.join(__dirname, 'server.js');
        serverProcess = spawn('node', [serverPath], {
            stdio: 'pipe',
            env: { ...process.env, PORT: SERVER_PORT }
        });

        serverProcess.stdout.on('data', (data) => {
            console.log('Server:', data.toString());
            if (data.toString().includes('listening on port')) {
                resolve();
            }
        });

        serverProcess.stderr.on('data', (data) => {
            const errorStr = data.toString();
            console.error('Server Error:', errorStr);
            
            // If port is already in use, resolve anyway (server already running)
            if (errorStr.includes('EADDRINUSE')) {
                console.log('Server already running, continuing...');
                resolve();
            }
        });

        serverProcess.on('error', (error) => {
            console.error('Failed to start server:', error);
            // Don't reject - the server might already be running
            console.log('Server start failed, but continuing anyway...');
            resolve();
        });

        // Timeout after 5 seconds
        setTimeout(() => {
            console.log('Server startup timeout, assuming server is ready...');
            resolve(); // Resolve anyway, the server might be starting
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
        icon: path.join(__dirname, 'assets', 'icon.png'),
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
    mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);

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
            label: 'Help',
            submenu: [
                {
                    label: 'About Grafana Query IDE',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'About Grafana Query IDE',
                            message: 'Grafana Query IDE',
                            detail: 'A powerful desktop IDE for executing InfluxQL and PromQL queries through the Grafana API.\n\nVersion: 0.0.1\nBuilt with Electron'
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
    const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: filename,
        filters: [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });
    
    if (!result.canceled) {
        const fs = require('fs').promises;
        await fs.writeFile(result.filePath, content);
        return result.filePath;
    }
    return null;
});

ipcMain.handle('load-file', async (event, filePath) => {
    const fs = require('fs').promises;
    const content = await fs.readFile(filePath, 'utf8');
    return content;
});