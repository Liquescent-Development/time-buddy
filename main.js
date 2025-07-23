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

// Set app name early for macOS menu bar
app.setName('Time Buddy');

// Debug: Log user data paths
console.log('User data path:', app.getPath('userData'));
console.log('App name:', app.getName());

// Keep a global reference of the window object
let mainWindow;

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
    const appPath = path.join(__dirname, 'public', 'index.html');
    const url = isDemoMode ? `file://${appPath}?demo=true` : `file://${appPath}`;
    mainWindow.loadFile(appPath, isDemoMode ? { query: { demo: 'true' } } : {});
    
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
        // Only allow file:// protocol navigation within the app
        if (!navigationUrl.startsWith('file://')) {
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
app.whenReady().then(() => {
    createMainWindow();
    createMenu();
    
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
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

// Grafana API proxy handler using Electron's net module
ipcMain.handle('grafana-api-request', async (event, options) => {
    const { net } = require('electron');
    const { URL } = require('url');
    
    try {
        const { grafanaUrl, path, method, headers, body, timeout = 30000 } = options;
        
        if (!grafanaUrl) {
            throw new Error('Missing Grafana URL');
        }
        
        // Construct full URL
        const fullUrl = `${grafanaUrl}${path}`;
        console.log(`Proxying ${method} request to: ${fullUrl}`);
        
        // Create request options
        const requestOptions = {
            method: method || 'GET',
            url: fullUrl,
            // Electron's net module doesn't validate certificates by default
            // which is perfect for self-signed certs
        };
        
        // Create the request
        const request = net.request(requestOptions);
        
        // Set headers
        if (headers) {
            Object.entries(headers).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    request.setHeader(key, value);
                }
            });
        }
        
        // Set timeout
        const timeoutId = setTimeout(() => {
            request.abort();
        }, timeout);
        
        return new Promise((resolve, reject) => {
            let responseData = '';
            let responseHeaders = {};
            let statusCode = 0;
            
            request.on('response', (response) => {
                statusCode = response.statusCode;
                responseHeaders = response.headers;
                
                response.on('data', (chunk) => {
                    responseData += chunk.toString();
                });
                
                response.on('end', () => {
                    clearTimeout(timeoutId);
                    
                    // Try to parse JSON response
                    let parsedData = responseData;
                    try {
                        if (responseData && response.headers['content-type']?.includes('application/json')) {
                            parsedData = JSON.parse(responseData);
                        }
                    } catch (e) {
                        // Keep as string if not valid JSON
                    }
                    
                    resolve({
                        status: statusCode,
                        statusText: response.statusMessage || '',
                        headers: responseHeaders,
                        data: parsedData
                    });
                });
            });
            
            request.on('error', (error) => {
                clearTimeout(timeoutId);
                console.error('Request error:', error);
                
                // Map common errors to HTTP-like status codes
                let status = 500;
                let message = error.message;
                
                if (error.message.includes('ECONNREFUSED')) {
                    status = 502;
                    message = 'Connection refused. Check if the URL is correct and the server is running.';
                } else if (error.message.includes('ENOTFOUND')) {
                    status = 502;
                    message = 'Host not found. Check if the URL is correct.';
                } else if (error.message.includes('ETIMEDOUT')) {
                    status = 504;
                    message = 'Request timeout';
                } else if (error.message.includes('abort')) {
                    status = 504;
                    message = 'Request timeout';
                }
                
                reject({
                    status,
                    statusText: message,
                    error: message,
                    originalError: error.message
                });
            });
            
            request.on('abort', () => {
                clearTimeout(timeoutId);
                reject({
                    status: 504,
                    statusText: 'Request timeout',
                    error: 'Request was aborted due to timeout'
                });
            });
            
            // Write body if present
            if (body) {
                if (typeof body === 'object') {
                    request.write(JSON.stringify(body));
                } else {
                    request.write(body);
                }
            }
            
            request.end();
        });
    } catch (error) {
        console.error('Grafana API request error:', error);
        throw error;
    }
});