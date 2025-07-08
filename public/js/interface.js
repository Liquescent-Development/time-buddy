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
        this.initializeResizers();
        this.createInitialTab();
        
        // Set initial state
        this.switchSidebarView('connections');
        this.switchPanel('results');
        
        // Force initial content load
        setTimeout(() => {
            this.updateSidebarContent('connections');
            
            // Ensure CodeMirror is initialized for the active tab
            this.ensureCodeMirrorInitialized();
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
        
        // Deactivate all panel sections first (except results panel)
        document.querySelectorAll('.panel-section:not(#resultsPanel)').forEach(section => {
            section.classList.remove('active');
        });

        this.activeSidebarView = view;

        // Update panel content based on view
        this.updateSidebarContent(view);
    },

    updateSidebarContent(view) {
        console.log('Updating sidebar content for view:', view);
        switch (view) {
            case 'connections':
                // Activate connection panel sections
                document.querySelectorAll('#connectionsPanel .panel-section').forEach(section => {
                    section.classList.add('active');
                });
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
        console.log('Creating initial tab...');
        // Create the initial tab content if it doesn't exist
        const existingContainer = document.querySelector(`[data-tab-id="untitled-1"].editor-container`);
        console.log('Existing container found:', !!existingContainer);
        if (!existingContainer) {
            console.log('Creating tab content for untitled-1');
            this.createTabContent('untitled-1');
        }
        console.log('Switching to untitled-1 tab');
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
        console.log('createTabContent called for:', tabId);
        const tabContent = document.querySelector('.tab-content');
        console.log('tabContent element found:', !!tabContent);
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
        
        // Initialize CodeMirror for this tab after DOM is ready
        console.log('About to initialize CodeMirror for tab:', tabId);
        setTimeout(() => {
            console.log('Timeout executed, calling initializeCodeMirror for tab:', tabId);
            this.initializeCodeMirror(tabId);
        }, 50);
    },

    initializeCodeMirror(tabId) {
        const container = document.querySelector(`[data-tab-id="${tabId}"] .code-editor-container`);
        if (!container) {
            console.error('CodeMirror container not found for tab:', tabId);
            return;
        }
        
        const textarea = container.querySelector('textarea');
        if (!textarea) {
            console.error('Textarea not found for tab:', tabId);
            return;
        }
        
        console.log('Initializing CodeMirror for tab:', tabId);
        console.log('Current query type:', GrafanaConfig.currentQueryType);
        console.log('CodeMirror available:', typeof CodeMirror);
        console.log('PromQL mode available:', CodeMirror.modes && CodeMirror.modes.promql);
        
        try {
            let mode = GrafanaConfig.currentQueryType === 'promql' ? 'promql' : 'sql';
            
            // Fallback to basic modes if custom modes aren't available
            if (mode === 'promql' && (!CodeMirror.modes || !CodeMirror.modes.promql)) {
                console.warn('PromQL mode not available, falling back to text/x-sql');
                mode = 'text/x-sql';
            }
            console.log('Using mode:', mode);
            
            const editor = CodeMirror.fromTextArea(textarea, {
            mode: mode,
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
            
            // Always set global reference initially, switchTab will update it if needed
            GrafanaConfig.queryEditor = editor;
            console.log('Set global queryEditor for tab:', tabId);
            
            // Listen for changes
            editor.on('change', () => {
                tabData.content = editor.getValue();
                this.markTabUnsaved(tabId);
            });
            
            console.log('CodeMirror successfully initialized for tab:', tabId);
            
        } catch (error) {
            console.error('Failed to initialize CodeMirror for tab:', tabId, error);
        }
    },
    
    ensureCodeMirrorInitialized() {
        console.log('Ensuring CodeMirror is initialized...');
        console.log('Active tab:', this.activeTab);
        console.log('Available tabs:', Array.from(this.tabs.keys()));
        
        if (!this.activeTab) {
            console.log('No active tab, creating initial tab');
            this.createInitialTab();
            return;
        }
        
        const tabData = this.tabs.get(this.activeTab);
        if (!tabData) {
            console.log('No tab data found for active tab');
            return;
        }
        
        if (!tabData.editor) {
            console.log('No editor found for active tab, initializing...');
            this.initializeCodeMirror(this.activeTab);
        } else {
            console.log('Editor already exists for tab:', this.activeTab);
            // Make sure global reference is set
            GrafanaConfig.queryEditor = tabData.editor;
            console.log('Set global queryEditor reference');
        }
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
        
        // Refresh CodeMirror and set global reference
        const tabData = this.tabs.get(tabId);
        if (tabData && tabData.editor) {
            GrafanaConfig.queryEditor = tabData.editor; // Set global reference
            console.log('Updated global queryEditor for tab:', tabId);
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
        const container = document.querySelector(`[data-tab-id="${tabId}"].editor-container`);
        if (!container) {
            console.warn('Container not found for tab:', tabId);
            return;
        }
        
        // Update button states
        const queryTypeButtons = container.querySelectorAll('.query-type-button');
        queryTypeButtons.forEach(btn => {
            btn.classList.remove('active');
        });
        
        const targetButton = container.querySelector(`[data-type="${type}"]`);
        if (targetButton) {
            targetButton.classList.add('active');
        } else {
            console.warn('Query type button not found for type:', type);
        }
        
        // Update tab data
        const tabData = this.tabs.get(tabId);
        if (tabData) {
            tabData.queryType = type;
            
            // Update CodeMirror mode
            if (tabData.editor) {
                const mode = type === 'promql' ? 'promql' : 'sql';
                tabData.editor.setOption('mode', mode);
            }
        }
        
        // Update global query type for compatibility
        GrafanaConfig.currentQueryType = type;
        
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
                <div class="empty-state" style="padding: 20px; text-align: center; background-color: #2d2d30; margin: 10px; border-radius: 4px; min-height: 100px; display: block; visibility: visible;">
                    <div style="margin-bottom: 16px; color: #cccccc; font-size: 14px;">No connections configured</div>
                    <button class="primary-button" onclick="showNewConnectionDialog()" style="font-size: 13px; padding: 10px 16px; background-color: #007acc; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500;">
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
        
        console.log('Has connections, building connection list HTML...');
        
        let html = '';
        for (const [id, connection] of Object.entries(connections)) {
            const isConnected = GrafanaConfig.connectionId === id || GrafanaConfig.currentConnectionId === id;
            const hasProxy = connection.proxy ? ' (via proxy)' : '';
            html += `
                <div class="connection-item ${isConnected ? 'active connected' : ''}" data-connection-id="${id}">
                    <div style="flex: 1;">
                        <div style="font-weight: 500; color: #cccccc; font-size: 13px;">${Utils.escapeHtml(connection.name)}</div>
                        <div style="font-size: 11px; color: #858585;">${Utils.escapeHtml(connection.url)}${hasProxy}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button class="icon-button" onclick="showEditConnectionDialog('${id}')" title="Edit Connection" style="padding: 2px 4px; font-size: 12px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                        </button>
                        <div class="connection-status"></div>
                    </div>
                </div>
            `;
        }
        
        connectionList.innerHTML = html;
        
        // Ensure proper styling for connection list
        connectionList.style.cssText = `
            display: block !important;
            visibility: visible !important;
            height: auto !important;
            min-height: 100px !important;
            overflow: visible !important;
            flex: 1 !important;
        `;
        
        console.log('connectionList after styling:', connectionList);
        console.log('connectionList parent:', connectionList.parentElement);
        console.log('connectionList getBoundingClientRect:', connectionList.getBoundingClientRect());
        
        // Force each connection item to be visible
        connectionList.querySelectorAll('.connection-item').forEach(item => {
            item.style.display = 'flex';
            item.style.visibility = 'visible';
            item.style.opacity = '1';
            item.style.height = 'auto';
        });
        
        console.log('Set connectionList HTML with', connectionList.querySelectorAll('.connection-item').length, 'connections');
        
        // Remove the backup button if connections exist
        const backupBtn = document.querySelector('.backup-add-btn');
        if (backupBtn) {
            backupBtn.remove();
            console.log('Removed backup button');
        }
        
        // Add click handlers
        connectionList.querySelectorAll('.connection-item').forEach(item => {
            item.addEventListener('click', () => {
                this.connectToConnection(item.dataset.connectionId);
            });
        });
        
        // Debug: Check if HTML is still there after a short delay
        setTimeout(() => {
            console.log('After timeout - connectionList contains:', connectionList.innerHTML.length, 'characters');
            console.log('Connection items found:', connectionList.querySelectorAll('.connection-item').length);
        }, 50);
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
        console.log('executeQuery called with tabId:', tabId);
        const tabData = this.tabs.get(tabId || this.activeTab);
        console.log('tabData:', tabData);
        if (!tabData || !tabData.editor) {
            console.error('No tab data or editor found');
            return;
        }
        
        const query = tabData.editor.getValue();
        if (!query.trim()) {
            this.showToast('Please enter a query', 'error');
            return;
        }
        
        // Update global state for compatibility with existing code
        GrafanaConfig.currentQueryType = tabData.queryType;
        
        // Switch to results panel
        this.switchPanel('results');
        
        // Check if we have a datasource selected
        if (!GrafanaConfig.selectedDatasourceUid) {
            this.showToast('Please select a data source first', 'error');
            return;
        }
        
        // Call existing query execution logic
        if (typeof Queries !== 'undefined' && Queries.executeQuery) {
            // Temporarily set the global query editor value
            const originalGetQueryValue = Editor.getQueryValue;
            Editor.getQueryValue = () => query;
            
            // Create temporary select element for compatibility with old Queries module
            const tempSelect = document.createElement('select');
            tempSelect.id = 'datasource';
            tempSelect.innerHTML = `<option value="${GrafanaConfig.selectedDatasourceUid}" data-type="${GrafanaConfig.selectedDatasourceType}" data-id="${GrafanaConfig.selectedDatasourceId}" selected></option>`;
            
            // Create temporary time inputs
            const tempTimeFrom = document.createElement('input');
            tempTimeFrom.id = 'timeFrom';
            tempTimeFrom.value = document.querySelector(`[data-tab-id="${tabId}"] .time-from`)?.value || '1';
            
            const tempTimeTo = document.createElement('input');
            tempTimeTo.id = 'timeTo';
            tempTimeTo.value = document.querySelector(`[data-tab-id="${tabId}"] .time-to`)?.value || '0';
            
            const tempMaxDataPoints = document.createElement('input');
            tempMaxDataPoints.id = 'maxDataPoints';
            tempMaxDataPoints.value = '1000';
            
            const tempIntervalMs = document.createElement('input');
            tempIntervalMs.id = 'intervalMs';
            tempIntervalMs.value = '15000';
            
            const tempInstantQuery = document.createElement('input');
            tempInstantQuery.id = 'instantQuery';
            tempInstantQuery.type = 'checkbox';
            tempInstantQuery.checked = tabData.queryType === 'promql';
            
            // Temporarily add elements to DOM
            document.body.appendChild(tempSelect);
            document.body.appendChild(tempTimeFrom);
            document.body.appendChild(tempTimeTo);
            document.body.appendChild(tempMaxDataPoints);
            document.body.appendChild(tempIntervalMs);
            document.body.appendChild(tempInstantQuery);
            
            Queries.executeQuery().then(() => {
                // Restore original function and clean up
                Editor.getQueryValue = originalGetQueryValue;
                document.body.removeChild(tempSelect);
                document.body.removeChild(tempTimeFrom);
                document.body.removeChild(tempTimeTo);
                document.body.removeChild(tempMaxDataPoints);
                document.body.removeChild(tempIntervalMs);
                document.body.removeChild(tempInstantQuery);
            }).catch((error) => {
                Editor.getQueryValue = originalGetQueryValue;
                document.body.removeChild(tempSelect);
                document.body.removeChild(tempTimeFrom);
                document.body.removeChild(tempTimeTo);
                document.body.removeChild(tempMaxDataPoints);
                document.body.removeChild(tempIntervalMs);
                document.body.removeChild(tempInstantQuery);
                console.error('Query execution failed:', error);
            });
        }
    },

    updateExecuteButton(tabId) {
        // Update per-tab execute button in new interface
        if (tabId) {
            const tabContainer = document.querySelector(`[data-tab-id="${tabId}"]`);
            if (tabContainer) {
                const executeBtn = tabContainer.querySelector('.execute-button');
                if (executeBtn) {
                    if (GrafanaConfig.connected && (GrafanaConfig.selectedDatasourceId || GrafanaConfig.selectedDatasourceUid)) {
                        executeBtn.disabled = false;
                    } else {
                        executeBtn.disabled = true;
                    }
                }
            }
        }
        
        // Also update global execute button for backward compatibility
        const globalExecuteBtn = document.getElementById('executeBtn');
        if (globalExecuteBtn) {
            if (GrafanaConfig.connected && (GrafanaConfig.selectedDatasourceId || GrafanaConfig.selectedDatasourceUid)) {
                globalExecuteBtn.disabled = false;
            } else {
                globalExecuteBtn.disabled = true;
            }
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

    // Schema explorer implementation
    refreshSchemaExplorer() {
        const container = document.getElementById('schemaContainer');
        
        if (!GrafanaConfig.connected) {
            container.innerHTML = '<div class="empty-state">Connect to Grafana first</div>';
            return;
        }
        
        if (!GrafanaConfig.selectedDatasourceUid) {
            container.innerHTML = '<div class="empty-state">Select a data source to explore schema</div>';
            return;
        }
        
        // Show loading state
        container.innerHTML = '<div class="empty-state">Loading schema...</div>';
        
        // Update Schema module with current datasource info
        Schema.currentDatasourceType = GrafanaConfig.selectedDatasourceType;
        Schema.currentDatasourceId = GrafanaConfig.selectedDatasourceUid; // Use UID, not numeric ID
        
        console.log('Refreshing schema for:', {
            type: Schema.currentDatasourceType,
            uid: Schema.currentDatasourceId
        });
        
        // Load and render schema
        Schema.loadSchema();
    },

    refreshDashboards() {
        // Dashboard refresh logic
    },

    loadHistory() {
        // History loading logic
    },

    // Initialize resizers for sidebar and panel
    initializeResizers() {
        this.initializeSidebarResizer();
        this.initializePanelResizer();
    },

    initializeSidebarResizer() {
        const resizer = document.querySelector('.sidebar-resizer');
        const sidebar = document.querySelector('.sidebar');
        
        if (!resizer || !sidebar) return;

        let isDragging = false;
        let startX = 0;
        let startWidth = 0;

        resizer.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startWidth = parseInt(document.defaultView.getComputedStyle(sidebar).width, 10);
            
            document.body.classList.add('resizing');
            resizer.classList.add('dragging');
            
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const width = startWidth + e.clientX - startX;
            const minWidth = 200;
            const maxWidth = 600;
            
            if (width >= minWidth && width <= maxWidth) {
                sidebar.style.width = width + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.classList.remove('resizing');
                resizer.classList.remove('dragging');
                
                // Refresh CodeMirror editors after resize
                setTimeout(() => {
                    const activeTab = this.tabs.get(this.activeTab);
                    if (activeTab && activeTab.editor) {
                        activeTab.editor.refresh();
                    }
                }, 100);
            }
        });
    },

    initializePanelResizer() {
        const resizer = document.querySelector('.panel-resizer');
        const panel = document.querySelector('.panel-area');
        
        if (!resizer || !panel) return;

        let isDragging = false;
        let startY = 0;
        let startHeight = 0;

        resizer.addEventListener('mousedown', (e) => {
            isDragging = true;
            startY = e.clientY;
            startHeight = parseInt(document.defaultView.getComputedStyle(panel).height, 10);
            
            document.body.classList.add('resizing');
            resizer.classList.add('dragging');
            
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const height = startHeight - (e.clientY - startY);
            const minHeight = 150;
            const maxHeight = window.innerHeight * 0.6; // 60% of viewport height
            
            if (height >= minHeight && height <= maxHeight) {
                panel.style.height = height + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.classList.remove('resizing');
                resizer.classList.remove('dragging');
                
                // Refresh CodeMirror editors after resize
                setTimeout(() => {
                    const activeTab = this.tabs.get(this.activeTab);
                    if (activeTab && activeTab.editor) {
                        activeTab.editor.refresh();
                    }
                }, 100);
            }
        });
    },

    connectToConnection(connectionId) {
        // Connection logic - integrate with existing Connections module
        if (typeof Connections !== 'undefined' && Connections.connectWithStoredConnection) {
            Connections.connectWithStoredConnection(connectionId);
        }
    },

    // Handle connection form submission with proper authentication flow
    async handleConnectionSave(name, url, username, password, proxyConfig = null, editingConnectionId = null) {
        if (!name || !url || !username || !password) {
            this.showToast('Please fill in all fields', 'error');
            return false;
        }

        try {
            // Create connection object
            const connection = {
                id: editingConnectionId || Date.now().toString(),
                name: name,
                url: url,
                username: username,
                proxy: proxyConfig
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

// Proxy fields toggle
function toggleProxyFields() {
    const enableProxy = document.getElementById('enableProxy');
    const proxyFields = document.getElementById('proxyFields');
    
    if (enableProxy.checked) {
        proxyFields.style.display = 'block';
    } else {
        proxyFields.style.display = 'none';
        // Clear proxy fields when disabled
        document.getElementById('proxyHost').value = '';
        document.getElementById('proxyPort').value = '';
        document.getElementById('proxyUsername').value = '';
        document.getElementById('proxyPassword').value = '';
    }
}

// Dialog management
function showNewConnectionDialog() {
    console.log('Showing new connection dialog...');
    const dialog = document.getElementById('connectionDialog');
    if (dialog) {
        // Clear form for new connection
        document.getElementById('connectionDialogTitle').textContent = 'New Connection';
        hideConnectionDialog(); // This clears all fields
        dialog.classList.add('active');
        console.log('Dialog shown');
    } else {
        console.error('Connection dialog not found');
        Interface.showToast('Connection dialog not found', 'error');
    }
}

function showEditConnectionDialog(connectionId) {
    console.log('Showing edit connection dialog for:', connectionId);
    const dialog = document.getElementById('connectionDialog');
    if (!dialog) {
        console.error('Connection dialog not found');
        Interface.showToast('Connection dialog not found', 'error');
        return;
    }
    
    const connections = Storage.getSavedConnections();
    const connection = connections[connectionId];
    
    if (!connection) {
        console.error('Connection not found:', connectionId);
        Interface.showToast('Connection not found', 'error');
        return;
    }
    
    // Set dialog title
    document.getElementById('connectionDialogTitle').textContent = 'Edit Connection';
    
    // Populate form fields
    document.getElementById('connectionName').value = connection.name;
    document.getElementById('connectionUrl').value = connection.url;
    document.getElementById('connectionUsername').value = connection.username;
    document.getElementById('connectionPassword').value = ''; // Never prefill password
    
    // Populate proxy fields if proxy is configured
    if (connection.proxy) {
        document.getElementById('enableProxy').checked = true;
        document.getElementById('proxyHost').value = connection.proxy.host;
        document.getElementById('proxyPort').value = connection.proxy.port;
        document.getElementById('proxyUsername').value = connection.proxy.username || '';
        document.getElementById('proxyPassword').value = ''; // Never prefill proxy password
        document.getElementById('proxyFields').style.display = 'block';
    } else {
        document.getElementById('enableProxy').checked = false;
        document.getElementById('proxyFields').style.display = 'none';
    }
    
    // Store connection ID for editing
    dialog.dataset.editingConnectionId = connectionId;
    
    dialog.classList.add('active');
    console.log('Edit dialog shown');
}

function hideConnectionDialog() {
    const dialog = document.getElementById('connectionDialog');
    dialog.classList.remove('active');
    
    // Clear form
    document.getElementById('connectionName').value = '';
    document.getElementById('connectionUrl').value = '';
    document.getElementById('connectionUsername').value = '';
    document.getElementById('connectionPassword').value = '';
    
    // Clear proxy fields
    document.getElementById('enableProxy').checked = false;
    document.getElementById('proxyHost').value = '';
    document.getElementById('proxyPort').value = '';
    document.getElementById('proxyUsername').value = '';
    document.getElementById('proxyPassword').value = '';
    document.getElementById('proxyFields').style.display = 'none';
    
    // Clear editing ID
    delete dialog.dataset.editingConnectionId;
}

async function saveConnection() {
    const name = document.getElementById('connectionName').value.trim();
    const url = document.getElementById('connectionUrl').value.trim();
    const username = document.getElementById('connectionUsername').value.trim();
    const password = document.getElementById('connectionPassword').value;
    
    // Get proxy data
    const enableProxy = document.getElementById('enableProxy').checked;
    let proxyConfig = null;
    
    if (enableProxy) {
        const proxyHost = document.getElementById('proxyHost').value.trim();
        const proxyPort = document.getElementById('proxyPort').value.trim();
        const proxyUsername = document.getElementById('proxyUsername').value.trim();
        const proxyPassword = document.getElementById('proxyPassword').value;
        
        if (!proxyHost || !proxyPort) {
            Interface.showToast('Please provide proxy host and port', 'error');
            return;
        }
        
        proxyConfig = {
            host: proxyHost,
            port: parseInt(proxyPort),
            username: proxyUsername || null,
            password: proxyPassword || null
        };
    }
    
    // Check if we're editing an existing connection
    const dialog = document.getElementById('connectionDialog');
    const editingConnectionId = dialog.dataset.editingConnectionId;
    
    const success = await Interface.handleConnectionSave(name, url, username, password, proxyConfig, editingConnectionId);
    
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