// Guard for testing outside Electron
if (typeof require !== 'undefined') {
    try {
        var { app, BrowserWindow, Menu, shell, dialog, ipcMain, nativeImage } = require('electron');
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

// Keep a global reference of the window objects
let mainWindow;
let chatWindow;

// AI Assistant avatar management
let aiAvatarImage = null;
let aiAvatarSmallDataUrl = null;

// Load AI Assistant avatar from NativeImage
function loadAIAvatarImage() {
    try {
        const logoPath = path.join(__dirname, 'assets', 'logo.png');
        console.log('Loading AI avatar from:', logoPath);
        
        // Check if file exists first
        const fs = require('fs');
        if (!fs.existsSync(logoPath)) {
            console.warn('⚠️ Avatar file not found at:', logoPath);
            return false;
        }
        
        aiAvatarImage = nativeImage.createFromPath(logoPath);
        
        if (!aiAvatarImage.isEmpty()) {
            // Create a 64x64 version for avatars - larger but still reasonable size
            const smallAvatar = aiAvatarImage.resize({ width: 64, height: 64, quality: 'good' });
            aiAvatarSmallDataUrl = smallAvatar.toDataURL();
            
            console.log('✅ AI avatar loaded successfully via NativeImage (original:', aiAvatarImage.getSize(), ', small:', smallAvatar.getSize(), ')');
            return true;
        } else {
            console.warn('⚠️ NativeImage is empty, falling back to relative path');
            return false;
        }
    } catch (error) {
        console.error('❌ Failed to load AI avatar via NativeImage:', error);
        // Ensure we don't have a partial/corrupted data URL
        aiAvatarSmallDataUrl = null;
        return false;
    }
}


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

    // SECURITY FIX: Set Content Security Policy headers
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; " +
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; " +
                    "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; " +
                    "img-src 'self' data: https:; " +
                    "connect-src 'self' https: http: ws: wss:; " +
                    "font-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; " +
                    "object-src 'none'; " +
                    "base-uri 'self';"
                ],
                'X-Frame-Options': ['DENY'],
                'X-Content-Type-Options': ['nosniff'],
                'Referrer-Policy': ['strict-origin-when-cross-origin']
            }
        });
    });
    
    // Load the application
    const appPath = path.join(__dirname, 'public', 'index.html');
    mainWindow.loadFile(appPath);

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
        // Close chat window if open
        if (chatWindow) {
            chatWindow.close();
        }
    });

    // Handle window open requests
    mainWindow.webContents.setWindowOpenHandler(({ url, frameName }) => {
        // Allow AI Assistant chat windows
        if (url === 'about:blank' || frameName === 'aiChatWindow') {
            return {
                action: 'allow',
                overrideBrowserWindowOptions: {
                    width: 800,
                    height: 600,
                    minWidth: 400,
                    minHeight: 300,
                    resizable: true,
                    frame: true,
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                        preload: path.join(__dirname, 'preload.js'),
                        webSecurity: true
                    },
                    title: 'AI Assistant - Time Buddy'
                }
            };
        }
        
        // Handle external links
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
    // Load AI avatar image early
    loadAIAvatarImage();
    
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

// Create AI Chat window
function createChatWindow(options = {}) {
    console.log('🪟 createChatWindow called with options:', options);
    
    // Don't create multiple chat windows
    if (chatWindow && !chatWindow.isDestroyed()) {
        console.log('🔄 Existing chat window found, focusing it');
        chatWindow.focus();
        return chatWindow;
    }
    
    console.log('📝 Creating new BrowserWindow for chat');
    chatWindow = new BrowserWindow({
        width: options.width || 800,
        height: options.height || 600,
        minWidth: 400,
        minHeight: 300,
        parent: mainWindow,
        modal: false,
        icon: path.join(__dirname, 'assets', 'logo.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true
        },
        titleBarStyle: process.platform === 'darwin' ? 'default' : 'default',
        title: 'AI Assistant - Time Buddy',
        show: false
    });

    // Use placeholder emoji - avatar will be loaded dynamically
    const logoPlaceholder = '🤖';
    
    // Create chat window HTML content
    const chatHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>AI Assistant - Time Buddy</title>
    <!-- Markdown and Syntax Highlighting -->
    <script src="https://cdn.jsdelivr.net/npm/marked@12.0.0/marked.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/sql.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/vs2015.min.css">
    
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #1e1e1e; 
            color: #cccccc; 
            height: 100vh; 
            display: flex; 
            flex-direction: column;
            font-size: 13px;
            line-height: 1.4;
        }
        .messages-container {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .message {
            display: flex;
            gap: 12px;
            max-width: 100%;
        }
        .message.user { flex-direction: row-reverse; }
        .message-avatar {
            font-size: 32px;
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 46px;
            height: 46px;
        }
        .ai-avatar-logo {
            width: 40px !important;
            height: 40px !important;
            border-radius: 50%;
            background-color: rgba(107, 70, 193, 0.1);
            padding: 3px;
            box-sizing: border-box;
            transition: transform 0.2s ease;
        }
        .ai-avatar-logo:hover {
            transform: scale(1.1);
        }
        .message-content {
            background: #2d2d30;
            padding: 10px 14px;
            border-radius: 8px;
            max-width: 85%;
            line-height: 1.4;
            font-size: 13px;
        }
        .message.user .message-content {
            background: #007acc;
        }
        .message-content h1, .message-content h2, .message-content h3 {
            margin: 6px 0;
            color: #ffffff;
        }
        .message-content h1 { font-size: 16px; }
        .message-content h2 { font-size: 15px; }
        .message-content h3 { font-size: 14px; }
        .message-content ul, .message-content ol {
            margin: 6px 0;
            padding-left: 18px;
        }
        .message-content li { margin: 2px 0; }
        .message-content code {
            background: #1e1e1e;
            padding: 1px 4px;
            border-radius: 3px;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 12px;
        }
        .message-content pre {
            background: #1e1e1e;
            padding: 8px;
            border-radius: 4px;
            overflow-x: auto;
            margin: 6px 0;
            font-size: 12px;
            border: 1px solid #333;
        }
        
        /* Syntax highlighting for code blocks */
        .message-content code[class*="language-"] {
            color: #d4d4d4;
        }
        
        /* SQL/InfluxQL syntax highlighting */
        .message-content .language-sql,
        .message-content .language-influxql {
            color: #9cdcfe;
        }
        
        /* Add keyword highlighting using CSS */
        .message-content pre code {
            display: block;
            white-space: pre;
        }
        .message-content strong { color: #ffffff; }
        .input-container {
            border-top: 1px solid #454545;
            padding: 16px;
            display: flex;
            gap: 12px;
            align-items: flex-end;
        }
        .input-field {
            flex: 1;
            background: #2d2d30;
            border: 1px solid #454545;
            color: #cccccc;
            padding: 12px 16px;
            border-radius: 8px;
            resize: none;
            font-size: 14px;
            font-family: inherit;
            min-height: 44px;
            max-height: 120px;
        }
        .send-button {
            background: #007acc;
            border: none;
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .send-button:hover { background: #005a9e; }
        .send-button:disabled { background: #454545; cursor: not-allowed; }
        .status-message {
            text-align: center;
            color: #888;
            font-style: italic;
            margin: 20px;
        }
        .sample-prompts {
            margin-top: 16px;
            padding: 12px;
            border-radius: 6px;
            background-color: rgba(255, 255, 255, 0.03);
        }
        .sample-prompt {
            padding: 6px 10px;
            margin: 4px 0;
            background-color: rgba(107, 70, 193, 0.1);
            border: 1px solid rgba(107, 70, 193, 0.2);
            border-radius: 12px;
            cursor: pointer;
            font-size: 12px;
            color: #cccccc;
            transition: all 0.2s;
        }
        .sample-prompt:hover {
            background-color: rgba(107, 70, 193, 0.2);
        }
        
        /* AI Chat Message Loading Indicator */
        .message-loading {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 0;
        }
        
        .message-loading span {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: #007acc;
            animation: messageLoading 1.4s infinite ease-in-out both;
        }
        
        .message-loading span:nth-child(1) { animation-delay: -0.32s; }
        .message-loading span:nth-child(2) { animation-delay: -0.16s; }
        .message-loading span:nth-child(3) { animation-delay: 0s; }
        
        @keyframes messageLoading {
            0%, 80%, 100% { 
                transform: scale(0);
                opacity: 0.5;
            } 
            40% { 
                transform: scale(1);
                opacity: 1;
            }
        }
    </style>
</head>
<body>
    <div class="messages-container" id="messages">
        <div class="ai-welcome-message" style="text-align: center; padding: 24px; border-radius: 8px; background-color: rgba(255, 255, 255, 0.05); margin-bottom: 16px;">
            <div class="welcome-icon" style="margin-bottom: 16px;">
                <div class="message-avatar" style="margin: 0 auto; font-size: 32px; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center;">
                    ${logoPlaceholder}
                </div>
            </div>
            <h4 style="color: #ffffff; margin: 0 0 8px 0; font-size: 16px; font-weight: 500;">Hi! I'm your AI Assistant</h4>
            <p style="color: #cccccc; margin: 0; font-size: 13px; line-height: 1.4;">I can help you analyze time series data, find anomalies, and answer questions about your metrics.</p>
        </div>
    </div>
    <div class="input-container">
        <textarea 
            id="chatInput" 
            class="input-field" 
            placeholder="Ask me about your metrics..."
            rows="1"
        ></textarea>
        <button id="sendBtn" class="send-button" disabled>Send</button>
    </div>
    
    <script>
        const input = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendBtn');
        const messages = document.getElementById('messages');
        
        // Auto-resize textarea
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
            sendBtn.disabled = !input.value.trim();
        });
        
        // Send on Enter
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        sendBtn.addEventListener('click', sendMessage);
        
        function sendMessage() {
            const message = input.value.trim();
            if (!message) return;
            
            // Add user message to chat
            addMessage('user', message);
            
            // Show AI loading indicator
            showAILoading();
            
            // Send to main window via IPC
            window.electronAPI.sendChatMessage(message);
            
            // Clear input
            input.value = '';
            input.style.height = 'auto';
            sendBtn.disabled = true;
        }
        
        function addMessage(sender, text, data = null) {
            const messageEl = document.createElement('div');
            messageEl.className = \`message \${sender}\`;
            
            // Check if text contains HTML (like sample prompts)
            const hasSamplePrompts = text && text.includes('<div class="sample-prompts">');
            let processedContent;
            
            if (hasSamplePrompts) {
                // Split text into main content and sample prompts
                const parts = text.split('<div class="sample-prompts">');
                const mainContent = parts[0];
                const promptsHtml = '<div class="sample-prompts">' + parts[1];
                
                // Process main content for markdown if it's an assistant message
                let processedMainContent;
                if (sender === 'assistant' && containsMarkdown(mainContent)) {
                    processedMainContent = renderMarkdown(mainContent);
                } else {
                    processedMainContent = escapeHtml(mainContent);
                }
                
                // Combine processed content with sample prompts  
                processedContent = processedMainContent + promptsHtml;
            } else if (sender === 'assistant' && containsMarkdown(text)) {
                console.log('🎨 Pop-out rendering markdown for assistant message');
                processedContent = renderMarkdown(text);
            } else {
                processedContent = escapeHtml(text);
            }
            
            const avatarEl = document.createElement('div');
            avatarEl.className = 'message-avatar';
            
            if (sender === 'assistant') {
                // Use avatar data URL if available, otherwise fallback to emoji
                // Load avatar via IPC to avoid embedding massive data URL in HTML
                window.electronAPI.getAIAvatar().then(result => {
                    if (result.success && result.dataUrl) {
                        avatarEl.innerHTML = \`<img src="\${result.dataUrl}" alt="Time Buddy" class="ai-avatar-logo" style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(107, 70, 193, 0.1); padding: 3px; box-sizing: border-box;">\`;
                    } else {
                        avatarEl.textContent = '${logoPlaceholder}';
                    }
                }).catch(() => {
                    avatarEl.textContent = '${logoPlaceholder}';
                });
            } else {
                avatarEl.textContent = '👤';
            }
            
            const contentEl = document.createElement('div');
            contentEl.className = 'message-content';
            contentEl.innerHTML = processedContent;
            
            if (data && data.error) {
                const errorEl = document.createElement('div');
                errorEl.style.cssText = 'color: #e74c3c; margin-top: 8px; font-size: 12px;';
                errorEl.textContent = data.error;
                contentEl.appendChild(errorEl);
            }
            
            messageEl.appendChild(avatarEl);
            messageEl.appendChild(contentEl);
            
            messages.appendChild(messageEl);
            messages.scrollTop = messages.scrollHeight;
        }
        
        // Check if text contains markdown formatting
        function containsMarkdown(text) {
            if (!text) return false;
            
            const markdownPatterns = [
                /#{1,6}\\s+.+/,           // Headers (# ## ###)
                /\\*\\*.+?\\*\\*/,           // Bold (**text**)
                /\\*.+?\\*/,               // Italic (*text*)
                /\`{1,3}.+?\`{1,3}/,       // Code (\`code\` or \`\`\`code\`\`\`)
                /^\\s*[\\*\\-\\+]\\s+/m,      // Unordered lists (* - +)
                /^\\s*\\d+\\.\\s+/m,         // Ordered lists (1. 2.)
                /\\[.+?\\]\\(.+?\\)/,        // Links [text](url)
            ];
            
            const hasMarkdown = markdownPatterns.some(pattern => pattern.test(text));
            console.log('Pop-out markdown check:', { hasMarkdown, textPreview: text.substring(0, 100) });
            return hasMarkdown;
        }
        
        // Simple markdown to HTML converter
        function renderMarkdown(text) {
            // Configure marked.js with highlight.js for syntax highlighting
            if (typeof marked !== 'undefined' && typeof hljs !== 'undefined') {
                const renderer = new marked.Renderer();
                renderer.code = function(code, lang, escaped) {
                    // Map custom query languages to appropriate highlighters
                    const languageMap = {
                        'influxql': 'sql',
                        'promql': 'javascript',
                        'prometheus': 'javascript'
                    };
                    
                    const mappedLang = languageMap[lang] || lang;
                    
                    if (mappedLang && hljs.getLanguage(mappedLang)) {
                        try {
                            const result = hljs.highlight(code, { language: mappedLang }).value;
                            // Add inline styles as fallback in case CSS doesn't load
                            return \`<pre style="background: #1e1e1e; padding: 12px; border-radius: 4px; overflow-x: auto;"><code class="hljs language-\${mappedLang}" style="color: #d4d4d4; font-family: 'Courier New', Consolas, monospace;">\${result}</code></pre>\`;
                        } catch (err) {
                            console.warn('Syntax highlighting failed for language:', mappedLang, err);
                        }
                    }
                    
                    const autoResult = hljs.highlightAuto(code).value;
                    return \`<pre style="background: #1e1e1e; padding: 12px; border-radius: 4px; overflow-x: auto;"><code class="hljs" style="color: #d4d4d4; font-family: 'Courier New', Consolas, monospace;">\${autoResult}</code></pre>\`;
                };
                
                marked.setOptions({
                    renderer: renderer,
                    breaks: true,
                    gfm: true
                });
                
                try {
                    return marked.parse(text);
                } catch (err) {
                    console.error('Markdown parsing failed, falling back to simple HTML:', err);
                    return fallbackMarkdown(text);
                }
            } else {
                console.warn('marked.js or highlight.js not available, using fallback');
                return fallbackMarkdown(text);
            }
        }
        
        function fallbackMarkdown(text) {
            let html = text;
            
            // Headers
            html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
            html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
            html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
            
            // Bold and italic
            html = html.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
            html = html.replace(/\\*(.*?)\\*/g, '<em>$1</em>');
            
            // Code blocks
            html = html.replace(/\`\`\`(\\w+)?\\n([\\s\\S]*?)\`\`\`/g, (match, lang, code) => {
                const languageClass = lang ? \` class="language-\${lang}"\` : '';
                const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                return \`<pre><code\${languageClass}>\${escapedCode.trim()}</code></pre>\`;
            });
            
            // Inline code
            html = html.replace(/\`(.*?)\`/g, '<code>$1</code>');
            
            // Line breaks
            html = html.replace(/\\n\\n/g, '</p><p>');
            html = html.replace(/\\n/g, '<br>');
            
            return html;
        }
        
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
        
        // Show AI typing indicator
        function showAILoading() {
            // Remove any existing loading indicator
            const existingLoading = document.querySelector('.ai-loading-message');
            if (existingLoading) {
                existingLoading.remove();
            }
            
            const loadingEl = document.createElement('div');
            loadingEl.className = 'message assistant ai-loading-message';
            
            const avatarEl = document.createElement('div');
            avatarEl.className = 'message-avatar';
            // Load avatar via IPC to avoid embedding massive data URL in HTML
            window.electronAPI.getAIAvatar().then(result => {
                if (result.success && result.dataUrl) {
                    avatarEl.innerHTML = \`<img src="\${result.dataUrl}" alt="Time Buddy" class="ai-avatar-logo" style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(107, 70, 193, 0.1); padding: 3px; box-sizing: border-box;">\`;
                } else {
                    avatarEl.textContent = '${logoPlaceholder}';
                }
            }).catch(() => {
                avatarEl.textContent = '${logoPlaceholder}';
            });
            
            const contentEl = document.createElement('div');
            contentEl.className = 'message-content';
            contentEl.innerHTML = \`
                <div class="message-loading">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            \`;
            
            loadingEl.appendChild(avatarEl);
            loadingEl.appendChild(contentEl);
            
            messages.appendChild(loadingEl);
            messages.scrollTop = messages.scrollHeight;
        }
        
        // Hide AI typing indicator
        function hideAILoading() {
            const loadingEl = document.querySelector('.ai-loading-message');
            if (loadingEl) {
                loadingEl.remove();
            }
        }
        
        // Listen for messages from main window
        window.electronAPI.onChatMessage((message) => {
            // Hide AI loading indicator before adding response
            hideAILoading();
            addMessage('assistant', message);
        });
        
        // Listen for conversation loading
        window.electronAPI.onLoadConversation((conversation) => {
            // Preserve the welcome message, only clear other content
            const welcomeMessage = messages.querySelector('.ai-welcome-message');
            messages.innerHTML = '';
            
            // Restore welcome message
            if (welcomeMessage) {
                messages.appendChild(welcomeMessage);
            }
            
            // Load existing messages
            if (conversation && conversation.messages && conversation.messages.length > 0) {
                conversation.messages.forEach(msg => {
                    const sender = msg.sender || (msg.role === 'user' ? 'user' : 'assistant');
                    const text = msg.text || msg.content;
                    addMessage(sender, text, msg.data);
                });
            } else {
                // If no messages, ensure welcome message is visible
                if (!messages.querySelector('.ai-welcome-message')) {
                    const welcomeHTML = \`
                        <div class="ai-welcome-message" style="text-align: center; padding: 24px; border-radius: 8px; background-color: rgba(255, 255, 255, 0.05); margin-bottom: 16px;">
                            <div class="welcome-icon" style="margin-bottom: 16px;">
                                <div class="message-avatar" style="margin: 0 auto; font-size: 32px; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center;">
                                    🤖
                                </div>
                            </div>
                            <h4 style="color: #ffffff; margin: 0 0 8px 0; font-size: 16px; font-weight: 500;">Hi! I'm your AI Assistant</h4>
                            <p style="color: #cccccc; margin: 0; font-size: 13px; line-height: 1.4;">I can help you analyze time series data, find anomalies, and answer questions about your metrics.</p>
                        </div>
                    \`;
                    messages.insertAdjacentHTML('afterbegin', welcomeHTML);
                    
                    // Load avatar in the newly created welcome message
                    const newWelcomeAvatar = messages.querySelector('.ai-welcome-message .message-avatar');
                    if (newWelcomeAvatar && window.electronAPI && window.electronAPI.getAIAvatar) {
                        window.electronAPI.getAIAvatar().then(result => {
                            if (result.success && result.dataUrl) {
                                newWelcomeAvatar.innerHTML = \`<img src="\${result.dataUrl}" alt="Time Buddy" class="ai-avatar-logo" style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(107, 70, 193, 0.1); padding: 3px; box-sizing: border-box;">\`;
                            }
                        }).catch(() => {
                            // Keep the placeholder emoji if loading fails
                        });
                    }
                }
            }
            
            // Check if AI is currently processing in main window and show loading if so
            window.electronAPI.checkAIProcessing().then(isProcessing => {
                if (isProcessing) {
                    showAILoading();
                }
            }).catch(error => {
                console.log('Could not check AI processing state:', error);
            });
        });
        
        // Handle sample prompt clicks using event delegation
        messages.addEventListener('click', (e) => {
            if (e.target.classList.contains('sample-prompt')) {
                const onclick = e.target.getAttribute('onclick');
                if (onclick) {
                    // Extract message from onclick attribute: AIAgent.sendMessage('message')
                    const match = onclick.match(/sendMessage\\('([^']+)'\\)/);
                    if (match) {
                        const messageText = match[1];
                        // Set input value and send message
                        input.value = messageText;
                        sendMessage();
                    }
                }
            }
        });
        
        // Focus input when window loads
        window.addEventListener('load', () => {
            input.focus();
            
            // Load avatar in welcome message
            const welcomeAvatar = document.querySelector('.ai-welcome-message .message-avatar');
            if (welcomeAvatar && window.electronAPI && window.electronAPI.getAIAvatar) {
                window.electronAPI.getAIAvatar().then(result => {
                    if (result.success && result.dataUrl) {
                        welcomeAvatar.innerHTML = \`<img src="\${result.dataUrl}" alt="Time Buddy" class="ai-avatar-logo" style="width: 40px; height: 40px; border-radius: 50%; background-color: rgba(107, 70, 193, 0.1); padding: 3px; box-sizing: border-box;">\`;
                    }
                }).catch(() => {
                    // Keep the placeholder emoji if loading fails
                });
            }
        });
    </script>
</body>
</html>`;

    // Load HTML content
    console.log('🔄 Loading HTML content into chat window');
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(chatHTML)}`;
    console.log('📏 Data URL length:', dataUrl.length, 'characters');
    chatWindow.loadURL(dataUrl);

    // Add error handling for load failures
    chatWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('❌ Chat window failed to load:', errorCode, errorDescription);
    });

    chatWindow.webContents.on('did-finish-load', () => {
        console.log('✅ Chat window finished loading content');
        // Fallback: show window after content loads if ready-to-show hasn't fired
        setTimeout(() => {
            if (!chatWindow.isVisible()) {
                console.log('⚠️ Fallback: showing window after timeout (ready-to-show did not fire)');
                chatWindow.show();
                chatWindow.focus();
            }
        }, 500);
    });

    // Show window when ready
    chatWindow.once('ready-to-show', () => {
        console.log('🪟 Chat window ready-to-show event triggered, showing window');
        chatWindow.show();
        chatWindow.focus();
        console.log('✅ Chat window shown and focused');
    });

    // Handle window closed
    chatWindow.on('closed', () => {
        // Notify main window that chat window is closed
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('chat-window-closed');
        }
        chatWindow = null;
    });

    // Prevent navigation
    chatWindow.webContents.on('will-navigate', (event, navigationUrl) => {
        event.preventDefault();
    });

    return chatWindow;
}

// Grafana API proxy handler using Electron's net module
ipcMain.handle('grafana-api-request', async (event, options) => {
    const { net } = require('electron');
    const { URL } = require('url');
    
    try {
        const { grafanaUrl, path, method, headers, body, timeout = 30000, proxyConfig } = options;
        
        if (!grafanaUrl) {
            throw new Error('Missing Grafana URL');
        }
        
        // Construct full URL
        const fullUrl = `${grafanaUrl}${path}`;
        console.log(`Proxying ${method} request to: ${fullUrl}`);
        
        // Check if we need to use SOCKS proxy
        if (proxyConfig && proxyConfig.host) {
            // Use traditional https/http module with SOCKS proxy
            const { SocksProxyAgent } = require('socks-proxy-agent');
            const https = require('https');
            const http = require('http');
            
            console.log('Using SOCKS5 proxy:', proxyConfig.host + ':' + proxyConfig.port);
            
            // Build proxy URL
            let proxyUrl = 'socks5://';
            if (proxyConfig.username && proxyConfig.password) {
                proxyUrl += `${encodeURIComponent(proxyConfig.username)}:${encodeURIComponent(proxyConfig.password)}@`;
            }
            proxyUrl += `${proxyConfig.host}:${proxyConfig.port}`;
            
            // Create SOCKS proxy agent
            const socksAgent = new SocksProxyAgent(proxyUrl);
            
            // Parse URL to determine protocol
            const parsedUrl = new URL(fullUrl);
            const isHttps = parsedUrl.protocol === 'https:';
            const requestModule = isHttps ? https : http;
            
            // Create request options
            const requestOptions = {
                method: method || 'GET',
                headers: headers || {},
                agent: socksAgent,
                rejectUnauthorized: false, // Allow self-signed certificates
                timeout: timeout
            };
            
            return new Promise((resolve, reject) => {
                const req = requestModule.request(fullUrl, requestOptions, (res) => {
                    let responseData = '';
                    
                    res.on('data', (chunk) => {
                        responseData += chunk.toString();
                    });
                    
                    res.on('end', () => {
                        // Try to parse JSON response
                        let parsedData = responseData;
                        try {
                            if (responseData && res.headers['content-type']?.includes('application/json')) {
                                parsedData = JSON.parse(responseData);
                            }
                        } catch (e) {
                            // Keep as string if not valid JSON
                        }
                        
                        resolve({
                            status: res.statusCode,
                            statusText: res.statusMessage || '',
                            headers: res.headers,
                            data: parsedData
                        });
                    });
                });
                
                req.on('error', (error) => {
                    console.error('SOCKS proxy request error:', error);
                    
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
                    } else if (error.message.includes('SOCKS')) {
                        status = 502;
                        message = 'SOCKS proxy error: ' + error.message;
                    }
                    
                    reject({
                        status,
                        statusText: message,
                        error: message,
                        originalError: error.message
                    });
                });
                
                req.on('timeout', () => {
                    req.destroy();
                    reject({
                        status: 504,
                        statusText: 'Request timeout',
                        error: 'Request was aborted due to timeout'
                    });
                });
                
                // Write body if present
                if (body) {
                    if (typeof body === 'object') {
                        req.write(JSON.stringify(body));
                    } else {
                        req.write(body);
                    }
                }
                
                req.end();
            });
        }
        
        // Use Electron's net module for non-proxy requests
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

// IPC handlers for chat window
ipcMain.handle('open-chat-window', async (event, options) => {
    console.log('🪟 IPC: open-chat-window called with options:', options);
    
    // SECURITY FIX: Validate options before creating window
    const validatedOptions = {};
    if (options && typeof options === 'object') {
        if (options.conversation && typeof options.conversation === 'object') {
            validatedOptions.conversation = {
                messages: Array.isArray(options.conversation.messages) ? 
                    options.conversation.messages.slice(0, 100).map(msg => ({
                        sender: typeof msg.sender === 'string' ? msg.sender.substring(0, 20) : 'user',
                        text: typeof msg.text === 'string' ? msg.text.substring(0, 10000) : '',
                        // Strip out data objects for security
                        data: null
                    })) : []
            };
        }
    }
    
    console.log('🪟 Creating chat window with validated options:', validatedOptions);
    const window = createChatWindow(validatedOptions);
    
    if (!window) {
        console.error('❌ Failed to create chat window - window is null/undefined');
        return { success: false, error: 'Failed to create window' };
    }
    
    console.log('✅ Chat window created successfully, ID:', window.id);
    
    // Send conversation data to the chat window once it's ready
    if (validatedOptions.conversation && validatedOptions.conversation.messages) {
        window.webContents.once('dom-ready', () => {
            console.log('🔄 Sending conversation data to chat window');
            window.webContents.send('load-conversation', validatedOptions.conversation);
        });
    }
    
    // Return a simple success response instead of the window object
    return { success: true, windowId: window.id };
});

ipcMain.handle('close-chat-window', async (event) => {
    if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.close();
        return { success: true };
    }
    return { success: false, error: 'No chat window to close' };
});

ipcMain.handle('send-chat-message', async (event, message) => {
    // SECURITY FIX: Validate message before forwarding
    if (typeof message !== 'string') {
        throw new Error('Invalid message type');
    }
    if (message.length > 10000) {
        throw new Error('Message too long');
    }
    
    // Forward message to main window
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('chat-message-from-popup', message);
    }
});

ipcMain.handle('send-chat-response', async (event, response) => {
    // SECURITY FIX: Validate response before forwarding
    if (typeof response !== 'string') {
        throw new Error('Invalid response type');
    }
    if (response.length > 50000) {
        throw new Error('Response too long');
    }
    
    // Forward response to chat window
    if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.webContents.send('chat-response', response);
    }
});

// Show loading indicator in chat window
ipcMain.handle('show-chat-loading', async (event) => {
    if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.webContents.executeJavaScript('showAILoading()');
    }
});

// Hide loading indicator in chat window
ipcMain.handle('hide-chat-loading', async (event) => {
    if (chatWindow && !chatWindow.isDestroyed()) {
        chatWindow.webContents.executeJavaScript('hideAILoading()');
    }
});

// Check if AI is currently processing in main window
ipcMain.handle('check-ai-processing', async (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        return await mainWindow.webContents.executeJavaScript('window.AIAgent && window.AIAgent.state && window.AIAgent.state.isProcessing');
    }
    return false;
});

// IPC handler to get AI Assistant avatar data URL
ipcMain.handle('get-ai-avatar', async (event) => {
    if (aiAvatarSmallDataUrl) {
        return { success: true, dataUrl: aiAvatarSmallDataUrl };
    } else {
        // Fallback to relative path
        return { success: false, fallbackPath: 'images/logo.png' };
    }
});