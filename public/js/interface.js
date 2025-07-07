/**
 * VS Code-like Interface Manager
 * Handles tabs, panels, activity bar, and layout management
 */

const Interface = {
    // State management
    activeTab: 'untitled-1',
    tabCounter: 1,
    tabs: new Map(),
    activePanel: 'results',
    activeSidebarView: 'connections',
    panelVisible: true,
    
    // Initialize the interface
    initialize() {
        this.initializeActivityBar();
        this.initializeTabs();
        this.initializePanels();
        this.initializeKeyboardShortcuts();
        this.createInitialTab();
        
        // Set initial state
        this.switchSidebarView('connections');
        this.switchPanel('results');
        
        // Force initial content load
        setTimeout(() => {
            this.updateSidebarContent('connections');
        }, 100);
    },

    // Activity Bar Management
    initializeActivityBar() {
        const activityItems = document.querySelectorAll('.activity-item');
        activityItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const view = item.dataset.view;
                this.switchSidebarView(view);
            });
        });
    },

    switchSidebarView(view) {
        // Update active activity item
        document.querySelectorAll('.activity-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-view="${view}"]`).classList.add('active');

        // Update active sidebar panel
        document.querySelectorAll('.sidebar-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`${view}Panel`).classList.add('active');

        this.activeSidebarView = view;

        // Update panel content based on view
        this.updateSidebarContent(view);
    },

    updateSidebarContent(view) {
        console.log('Updating sidebar content for view:', view);
        switch (view) {
            case 'connections':
                this.loadConnections();
                this.loadDataSources();
                break;
            case 'explorer':
                this.refreshSchemaExplorer();
                break;
            case 'dashboards':
                this.refreshDashboards();
                break;
            case 'history':
                this.loadHistory();
                break;
        }
    },

    // Tab Management
    initializeTabs() {
        // Handle new tab button
        document.querySelector('.new-tab-button').addEventListener('click', () => {
            this.createNewTab();
        });

        // Initialize existing tab
        this.tabs.set('untitled-1', {
            id: 'untitled-1',
            label: 'Untitled-1',
            content: '',
            queryType: 'influxql',
            saved: false,
            filePath: null
        });
    },

    createInitialTab() {
        // Create the initial tab content if it doesn't exist
        const existingContainer = document.querySelector(`[data-tab-id="untitled-1"].editor-container`);
        if (!existingContainer) {
            this.createTabContent('untitled-1');
        }
        this.switchTab('untitled-1');
    },

    createNewTab() {
        this.tabCounter++;
        const tabId = `untitled-${this.tabCounter}`;
        
        // Create tab data
        this.tabs.set(tabId, {
            id: tabId,
            label: `Untitled-${this.tabCounter}`,
            content: '',
            queryType: 'influxql',
            saved: false,
            filePath: null
        });

        // Create tab DOM element
        this.createTabElement(tabId);
        this.createTabContent(tabId);
        
        // Switch to new tab
        this.switchTab(tabId);
    },

    createTabElement(tabId) {
        const tabBar = document.getElementById('tabBar');
        const newTabButton = document.querySelector('.new-tab-button');
        
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.dataset.tabId = tabId;
        
        tab.innerHTML = `
            <span class="tab-label">${this.tabs.get(tabId).label}</span>
            <button class="tab-close" onclick="Interface.closeTab('${tabId}')">×</button>
        `;
        
        tab.addEventListener('click', (e) => {
            if (!e.target.classList.contains('tab-close')) {
                this.switchTab(tabId);
            }
        });
        
        tabBar.insertBefore(tab, newTabButton);
    },

    createTabContent(tabId) {
        const tabContent = document.querySelector('.tab-content');
        const container = document.createElement('div');
        container.className = 'editor-container';
        container.dataset.tabId = tabId;
        
        container.innerHTML = `
            <div class="editor-toolbar">
                <div class="query-type-selector">
                    <button class="query-type-button active" data-type="influxql">InfluxQL</button>
                    <button class="query-type-button" data-type="promql">PromQL</button>
                </div>
                <div class="editor-options">
                    <div class="option-group">
                        <label>From (hours ago):</label>
                        <input type="number" class="small-input time-from" value="1" min="0" step="0.1">
                    </div>
                    <div class="option-group">
                        <label>To (hours ago):</label>
                        <input type="number" class="small-input time-to" value="0" min="0" step="0.1">
                    </div>
                    <div class="option-group">
                        <button class="execute-button" onclick="Interface.executeQuery('${tabId}')" disabled>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                            Execute
                        </button>
                    </div>
                </div>
            </div>
            <div class="code-editor-container">
                <textarea placeholder="Enter your query here..." class="query-editor"></textarea>
            </div>
        `;
        
        tabContent.appendChild(container);
        
        // Initialize query type buttons
        container.querySelectorAll('.query-type-button').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setQueryType(tabId, btn.dataset.type);
            });
        });
        
        // Initialize CodeMirror for this tab
        this.initializeCodeMirror(tabId);
    },

    initializeCodeMirror(tabId) {
        const container = document.querySelector(`[data-tab-id="${tabId}"] .code-editor-container`);
        const textarea = container.querySelector('textarea');
        
        const editor = CodeMirror.fromTextArea(textarea, {
            mode: 'text/x-sql',
            theme: 'monokai',
            lineNumbers: true,
            matchBrackets: true,
            autoCloseBrackets: true,
            indentUnit: 2,
            tabSize: 2,
            lineWrapping: true,
            extraKeys: {
                'Ctrl-Space': 'autocomplete',
                'Ctrl-Enter': () => this.executeQuery(tabId),
                'Cmd-Enter': () => this.executeQuery(tabId)
            }
        });

        // Store editor reference
        const tabData = this.tabs.get(tabId);
        tabData.editor = editor;
        
        // Listen for changes
        editor.on('change', () => {
            tabData.content = editor.getValue();
            this.markTabUnsaved(tabId);
        });
    },

    switchTab(tabId) {
        // Update active tab
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab-id="${tabId}"]`).classList.add('active');

        // Update active editor container
        document.querySelectorAll('.editor-container').forEach(container => {
            container.classList.remove('active');
        });
        document.querySelector(`[data-tab-id="${tabId}"].editor-container`).classList.add('active');

        this.activeTab = tabId;
        
        // Refresh CodeMirror
        const tabData = this.tabs.get(tabId);
        if (tabData && tabData.editor) {
            setTimeout(() => tabData.editor.refresh(), 1);
        }

        // Update execute button state
        this.updateExecuteButton(tabId);
    },

    closeTab(tabId) {
        const tabData = this.tabs.get(tabId);
        
        // Don't close if it's the last tab
        if (this.tabs.size === 1) {
            this.createNewTab();
        }
        
        // Check if tab has unsaved changes
        if (!tabData.saved && tabData.content.trim()) {
            if (!confirm('This tab has unsaved changes. Close anyway?')) {
                return;
            }
        }
        
        // Remove tab and content
        document.querySelector(`[data-tab-id="${tabId}"].tab`).remove();
        document.querySelector(`[data-tab-id="${tabId}"].editor-container`).remove();
        this.tabs.delete(tabId);
        
        // Switch to another tab if this was active
        if (this.activeTab === tabId) {
            const remainingTabs = Array.from(this.tabs.keys());
            if (remainingTabs.length > 0) {
                this.switchTab(remainingTabs[0]);
            }
        }
    },

    setQueryType(tabId, type) {
        const container = document.querySelector(`[data-tab-id="${tabId}"]`);
        
        // Update button states
        container.querySelectorAll('.query-type-button').forEach(btn => {
            btn.classList.remove('active');
        });
        container.querySelector(`[data-type="${type}"]`).classList.add('active');
        
        // Update tab data
        const tabData = this.tabs.get(tabId);
        tabData.queryType = type;
        
        // Update CodeMirror mode
        if (tabData.editor) {
            const mode = type === 'promql' ? 'text/x-sql' : 'text/x-sql'; // Would need PromQL mode
            tabData.editor.setOption('mode', mode);
        }
        
        this.updateExecuteButton(tabId);
    },

    markTabUnsaved(tabId) {
        const tab = document.querySelector(`[data-tab-id="${tabId}"].tab`);
        const label = tab.querySelector('.tab-label');
        const tabData = this.tabs.get(tabId);
        
        if (!label.textContent.endsWith(' •')) {
            label.textContent += ' •';
            tabData.saved = false;
        }
    },

    markTabSaved(tabId) {
        const tab = document.querySelector(`[data-tab-id="${tabId}"].tab`);
        const label = tab.querySelector('.tab-label');
        const tabData = this.tabs.get(tabId);
        
        if (label.textContent.endsWith(' •')) {
            label.textContent = label.textContent.slice(0, -2);
        }
        tabData.saved = true;
    },

    // Panel Management
    initializePanels() {
        document.querySelectorAll('.panel-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchPanel(tab.dataset.panel);
            });
        });

        document.querySelector('.panel-close').addEventListener('click', () => {
            this.togglePanel();
        });
    },

    switchPanel(panelName) {
        // Update active panel tab
        document.querySelectorAll('.panel-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-panel="${panelName}"]`).classList.add('active');

        // Update active panel content
        document.querySelectorAll('.panel-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(`${panelName}Panel`).classList.add('active');

        this.activePanel = panelName;
    },

    togglePanel() {
        const panelArea = document.querySelector('.panel-area');
        if (this.panelVisible) {
            panelArea.style.display = 'none';
            this.panelVisible = false;
        } else {
            panelArea.style.display = 'flex';
            this.panelVisible = true;
        }
    },

    // Connection Management
    loadConnections() {
        console.log('Loading connections...');
        const connectionList = document.getElementById('connectionList');
        if (!connectionList) {
            console.error('Connection list element not found');
            // Force create the element if it doesn't exist
            const connectionsPanel = document.getElementById('connectionsPanel');
            if (connectionsPanel) {
                console.log('Creating missing connectionList element');
                const newConnectionList = document.createElement('div');
                newConnectionList.id = 'connectionList';
                newConnectionList.className = 'connection-list';
                connectionsPanel.appendChild(newConnectionList);
                this.loadConnections(); // Retry
            }
            return;
        }
        
        const connections = Storage.getSavedConnections();
        console.log('Found connections:', connections);
        console.log('connectionList element:', connectionList);
        
        // Check if connections is truly empty (handles both {} and null/undefined)
        const hasConnections = connections && typeof connections === 'object' && Object.keys(connections).length > 0;
        
        if (!hasConnections) {
            console.log('No connections found, showing empty state');
            const html = `
                <div class="empty-state" style="padding: 20px; text-align: center; background-color: #2d2d30; margin: 10px; border-radius: 4px; min-height: 100px; display: block !important; visibility: visible !important; position: relative; z-index: 999;">
                    <div style="margin-bottom: 16px; color: #cccccc; font-size: 14px;">No connections configured</div>
                    <button class="primary-button" onclick="showNewConnectionDialog()" style="font-size: 13px; padding: 10px 16px; background-color: #007acc; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; display: inline-block !important; visibility: visible !important;">
                        Add Your First Connection
                    </button>
                </div>
            `;
            connectionList.innerHTML = html;
            connectionList.style.display = 'block';
            connectionList.style.visibility = 'visible';
            connectionList.style.height = 'auto';
            connectionList.style.overflow = 'visible';
            console.log('Set connectionList innerHTML to:', html);
            
            // Also add button to sidebar header as backup
            const sidebarHeader = document.querySelector('#connectionsPanel .sidebar-header');
            if (sidebarHeader && !sidebarHeader.querySelector('.backup-add-btn')) {
                const backupBtn = document.createElement('button');
                backupBtn.className = 'backup-add-btn';
                backupBtn.innerHTML = '+ Add Connection';
                backupBtn.style.cssText = 'background: #007acc; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 11px; margin-left: 10px;';
                backupBtn.onclick = showNewConnectionDialog;
                sidebarHeader.appendChild(backupBtn);
                console.log('Added backup button to header');
            }
            return;
        }
        
        let html = '';
        for (const [id, connection] of Object.entries(connections)) {
            const isConnected = GrafanaConfig.connectionId === id;
            html += `
                <div class="connection-item ${isConnected ? 'active connected' : ''}" data-connection-id="${id}">
                    <div>
                        <div style="font-weight: 500;">${Utils.escapeHtml(connection.name)}</div>
                        <div style="font-size: 11px; color: #858585;">${Utils.escapeHtml(connection.url)}</div>
                    </div>
                    <div class="connection-status"></div>
                </div>
            `;
        }
        
        connectionList.innerHTML = html;
        
        // Add click handlers
        connectionList.querySelectorAll('.connection-item').forEach(item => {
            item.addEventListener('click', () => {
                this.connectToConnection(item.dataset.connectionId);
            });
        });
    },

    loadDataSources() {
        const datasourceList = document.getElementById('datasourceList');
        
        if (!GrafanaConfig.connected) {
            datasourceList.innerHTML = '<div class="empty-state">Connect to Grafana first</div>';
            return;
        }
        
        // This would be populated by the existing datasource loading logic
        datasourceList.innerHTML = '<div class="empty-state">Loading data sources...</div>';
    },

    // Execute Query
    executeQuery(tabId) {
        const tabData = this.tabs.get(tabId || this.activeTab);
        if (!tabData || !tabData.editor) return;
        
        const query = tabData.editor.getValue();
        if (!query.trim()) {
            this.showToast('Please enter a query', 'error');
            return;
        }
        
        // Update global state for compatibility with existing code
        GrafanaConfig.currentQueryType = tabData.queryType;
        
        // Switch to results panel
        this.switchPanel('results');
        
        // Call existing query execution logic
        if (typeof Queries !== 'undefined' && Queries.executeQuery) {
            // Temporarily set the global query editor value
            const originalGetQueryValue = Editor.getQueryValue;
            Editor.getQueryValue = () => query;
            
            Queries.executeQuery().then(() => {
                // Restore original function
                Editor.getQueryValue = originalGetQueryValue;
            }).catch(() => {
                Editor.getQueryValue = originalGetQueryValue;
            });
        }
    },

    updateExecuteButton(tabId) {
        const container = document.querySelector(`[data-tab-id="${tabId}"]`);
        if (!container) {
            console.warn('Container not found for tab:', tabId);
            return;
        }
        
        const executeBtn = container.querySelector('.execute-button');
        if (!executeBtn) {
            console.warn('Execute button not found for tab:', tabId);
            return;
        }
        
        if (GrafanaConfig.connected && GrafanaConfig.currentDatasourceId) {
            executeBtn.disabled = false;
        } else {
            executeBtn.disabled = true;
        }
    },

    // Helper methods
    showToast(message, type = 'info') {
        const toast = document.getElementById('authStatus');
        toast.textContent = message;
        toast.className = `auth-status-toast show ${type}`;
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    },

    // Keyboard shortcuts
    initializeKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey)) {
                switch (e.key) {
                    case 'n':
                        e.preventDefault();
                        this.createNewTab();
                        break;
                    case 'w':
                        e.preventDefault();
                        this.closeTab(this.activeTab);
                        break;
                    case 't':
                        e.preventDefault();
                        this.createNewTab();
                        break;
                    case '1':
                    case '2':
                    case '3':
                    case '4':
                        e.preventDefault();
                        const views = ['connections', 'explorer', 'dashboards', 'history'];
                        const viewIndex = parseInt(e.key) - 1;
                        if (views[viewIndex]) {
                            this.switchSidebarView(views[viewIndex]);
                        }
                        break;
                }
            }
        });
    },

    // Placeholder methods to be implemented
    refreshSchemaExplorer() {
        const container = document.getElementById('schemaContainer');
        container.innerHTML = '<div class="empty-state">Select a data source to explore schema</div>';
    },

    refreshDashboards() {
        // Dashboard refresh logic
    },

    loadHistory() {
        // History loading logic
    },

    connectToConnection(connectionId) {
        // Connection logic - integrate with existing Connections module
        if (typeof Connections !== 'undefined' && Connections.connectWithStoredConnection) {
            Connections.connectWithStoredConnection(connectionId);
        }
    },

    // Handle connection form submission with proper authentication flow
    async handleConnectionSave(name, url, username, password) {
        if (!name || !url || !username || !password) {
            this.showToast('Please fill in all fields', 'error');
            return false;
        }

        try {
            // Create connection object
            const connection = {
                id: Date.now().toString(),
                name: name,
                url: url,
                username: username
            };

            // Save to storage (without password)
            Storage.saveConnectionToStorage(connection);

            // Try to connect immediately
            const success = await this.attemptConnection(connection, password);
            
            if (success) {
                this.loadConnections();
                this.showToast(`Connected to ${name}`, 'success');
                return true;
            } else {
                this.showToast('Connection saved but authentication failed. Try connecting manually.', 'info');
                this.loadConnections();
                return true;
            }
        } catch (error) {
            this.showToast('Failed to save connection: ' + error.message, 'error');
            return false;
        }
    },

    async attemptConnection(connection, password) {
        try {
            // Use existing Connections module for authentication
            if (typeof Connections !== 'undefined' && Connections.connectToGrafana) {
                await Connections.connectToGrafana(connection.url, connection.username, password, connection.id);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Connection attempt failed:', error);
            return false;
        }
    }
};

// Dialog management
function showNewConnectionDialog() {
    console.log('Showing new connection dialog...');
    const dialog = document.getElementById('connectionDialog');
    if (dialog) {
        dialog.classList.add('active');
        console.log('Dialog shown');
    } else {
        console.error('Connection dialog not found');
        Interface.showToast('Connection dialog not found', 'error');
    }
}

function hideConnectionDialog() {
    document.getElementById('connectionDialog').classList.remove('active');
    
    // Clear form
    document.getElementById('connectionName').value = '';
    document.getElementById('connectionUrl').value = '';
    document.getElementById('connectionUsername').value = '';
    document.getElementById('connectionPassword').value = '';
}

async function saveConnection() {
    const name = document.getElementById('connectionName').value.trim();
    const url = document.getElementById('connectionUrl').value.trim();
    const username = document.getElementById('connectionUsername').value.trim();
    const password = document.getElementById('connectionPassword').value;
    
    const success = await Interface.handleConnectionSave(name, url, username, password);
    
    if (success) {
        hideConnectionDialog();
    }
}

// Global functions for compatibility
function refreshDataSources() {
    Interface.loadDataSources();
}

function refreshSchema() {
    Interface.refreshSchemaExplorer();
}

function clearQueryHistory() {
    if (confirm('Clear all query history?')) {
        Storage.clearHistory();
        Interface.loadHistory();
    }
}

function addNewVariable() {
    Interface.switchPanel('variables');
    // Variable creation logic
}

function createNewTab() {
    Interface.createNewTab();
}

function closeTab(tabId) {
    Interface.closeTab(tabId);
}

function togglePanel() {
    Interface.togglePanel();
}