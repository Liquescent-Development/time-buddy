const Connections = {
    // Show connected state
    showConnectedState(connection) {
        Utils.hideAllAuthSections();
        
        // Handle old interface elements (may not exist in Electron version)
        const authInfo = document.getElementById('authInfo');
        if (authInfo) {
            authInfo.classList.remove('hidden');
        }
        
        const connectedUrl = document.getElementById('connectedUrl');
        if (connectedUrl) {
            connectedUrl.textContent = connection.url + ' (' + connection.username + ')';
        }
        
        // Log connection status for new interface
        console.log('Connected to:', connection.url, 'as', connection.username);
        
        // Update header status
        const headerStatus = document.getElementById('authHeaderStatus');
        if (headerStatus) {
            headerStatus.textContent = 'Connected: ' + connection.url;
        }
        
        // Update variables UI for the connected state
        if (typeof Variables !== 'undefined') {
            Variables.renderVariablesUI();
        }
        
        // Auto-collapse auth section on connection
        const authSection = document.getElementById('authSection');
        if (authSection && !authSection.classList.contains('collapsed')) {
            authSection.classList.add('collapsed');
            const toggleButton = document.querySelector('.auth-toggle');
            if (toggleButton) {
                toggleButton.textContent = 'Show';
            }
        }
        
        // Auto-expand datasource section when connected
        const datasourceSection = document.getElementById('datasourceSection');
        if (datasourceSection) {
            datasourceSection.style.display = '';
            if (datasourceSection.classList.contains('collapsed')) {
                datasourceSection.classList.remove('collapsed');
                const toggleButton = document.querySelector('.datasource-toggle');
                if (toggleButton) {
                    toggleButton.textContent = 'Hide';
                }
            }
        }
    },

    // Ensure disconnected state
    ensureDisconnectedState() {
        // Check if elements exist before accessing them (VS Code interface compatibility)
        const authInfo = document.getElementById('authInfo');
        if (authInfo) {
            authInfo.classList.add('hidden');
        }
        
        if (typeof Utils !== 'undefined' && Utils.hideAllAuthSections) {
            Utils.hideAllAuthSections();
        }
        
        const datasource = document.getElementById('datasource');
        if (datasource) {
            datasource.innerHTML = '<option value="">Connect to Grafana first</option>';
            datasource.disabled = true;
        }
        
        const executeBtn = document.getElementById('executeBtn');
        if (executeBtn) {
            executeBtn.disabled = true;
        }
        
        const authStatus = document.getElementById('authStatus');
        if (authStatus) {
            authStatus.innerHTML = '';
        }
        
        // Clear header status
        const headerStatus = document.getElementById('authHeaderStatus');
        if (headerStatus) {
            headerStatus.textContent = '';
        }
        
        // Update variables UI for the disconnected state
        if (typeof Variables !== 'undefined') {
            Variables.renderVariablesUI();
        }
    },

    // Connect to Grafana
    async connectToGrafana(url, username, password, connectionId = null) {
        GrafanaConfig.url = url.replace(/\/$/, '');
        GrafanaConfig.username = username;
        GrafanaConfig.password = password;
        GrafanaConfig.currentConnectionId = connectionId;
        
        // Use cached token if available, otherwise create new Basic auth
        if (connectionId && !password) {
            const cachedToken = Storage.getAuthToken(connectionId);
            if (cachedToken) {
                GrafanaConfig.authHeader = cachedToken;
            } else {
                throw new Error('No cached authentication token available');
            }
        } else {
            const credentials = btoa(username + ':' + password);
            GrafanaConfig.authHeader = 'Basic ' + credentials;
        }

        Utils.showStatus('authStatus', 'Connecting...', 'info');

        try {
            const response = await API.makeApiRequest('/api/datasources');

            if (!response.ok) {
                let errorMessage = response.status + ' ' + response.statusText;
                try {
                    const errorData = await response.json();
                    if (errorData.message) {
                        errorMessage = errorData.message;
                    } else if (errorData.error) {
                        errorMessage = errorData.error;
                    }
                } catch (e) {
                    try {
                        const errorText = await response.text();
                        if (errorText) {
                            errorMessage = errorText;
                        }
                    } catch (e2) {
                        // Ignore
                    }
                }
                throw new Error('Authentication failed: ' + errorMessage);
            }

            GrafanaConfig.datasources = await response.json();
            GrafanaConfig.connected = true;
            GrafanaConfig.connectionId = connectionId;
            
            Storage.saveGrafanaConfig();

            if (connectionId) {
                const expiresAt = Date.now() + (24 * 60 * 60 * 1000);
                Storage.saveAuthToken(connectionId, GrafanaConfig.authHeader, expiresAt);
                
                // Connection saved successfully for new interface
                
                Utils.showTokenStatus(connectionId, 'Authentication saved for future use', 'success');
            }

            Utils.showStatus('authStatus', 'Connected successfully!', 'success');
            
            const connection = { url: GrafanaConfig.url, username: username };
            this.showConnectedState(connection);
            
            this.populateDatasources();
            Editor.enableQueryEditor();
            
            // Update connection status in new interface
            if (typeof Interface !== 'undefined' && Interface.loadConnections) {
                Interface.loadConnections();
                Interface.updateExecuteButton(Interface.activeTab);
            }

            // Password fields cleared automatically in new interface

        } catch (error) {
            Utils.showStatus('authStatus', 'Connection failed: ' + error.message, 'error');
            console.error('Connection error:', error);
        }
    },

    // Disconnect from Grafana
    disconnect() {
        GrafanaConfig.url = '';
        GrafanaConfig.username = '';
        GrafanaConfig.password = '';
        GrafanaConfig.authHeader = '';
        GrafanaConfig.currentConnectionId = null;
        GrafanaConfig.datasources = [];
        GrafanaConfig.currentResults = null;
        
        localStorage.removeItem('grafanaConfig');
        
        Utils.clearTokenStatus();
        this.ensureDisconnectedState();
    },

    // Populate datasources dropdown
    populateDatasources() {
        // For new interface, update the data sources list in the sidebar
        const datasourceList = document.getElementById('datasourceList');
        if (datasourceList) {
            const supportedDatasources = GrafanaConfig.datasources.filter(function(ds) {
                return ds.type === 'influxdb' || ds.type === 'prometheus';
            });
            
            if (supportedDatasources.length === 0) {
                datasourceList.innerHTML = '<div class="empty-state">No supported data sources found</div>';
                return;
            }
            
            let html = '';
            supportedDatasources.forEach(function(ds) {
                html += `
                    <div class="datasource-item" data-uid="${ds.uid}" data-type="${ds.type}" data-id="${ds.id}">
                        <div style="flex: 1;">
                            <div style="font-weight: 500; color: #cccccc; font-size: 13px;">${Utils.escapeHtml(ds.name)}</div>
                            <div style="font-size: 11px; color: #858585;">${ds.type}</div>
                        </div>
                    </div>
                `;
            });
            
            datasourceList.innerHTML = html;
            
            // Add click handlers for data source selection
            datasourceList.querySelectorAll('.datasource-item').forEach(item => {
                item.addEventListener('click', () => {
                    // Remove previous selection
                    datasourceList.querySelectorAll('.datasource-item').forEach(ds => ds.classList.remove('selected'));
                    // Add selection to clicked item
                    item.classList.add('selected');
                    
                    // Update global config
                    GrafanaConfig.selectedDatasourceUid = item.dataset.uid;
                    GrafanaConfig.selectedDatasourceType = item.dataset.type;
                    GrafanaConfig.selectedDatasourceId = item.dataset.id;
                    GrafanaConfig.currentDatasourceId = item.dataset.uid; // Also set current for compatibility
                    
                    // Auto-select appropriate query type
                    const queryType = item.dataset.type === 'prometheus' ? 'promql' : 'influxql';
                    if (typeof Interface !== 'undefined' && Interface.setQueryType) {
                        // Add small delay to ensure tab DOM is ready
                        setTimeout(() => {
                            Interface.setQueryType(Interface.activeTab, queryType);
                        }, 100);
                    } else if (typeof Editor !== 'undefined' && Editor.setQueryType) {
                        Editor.setQueryType(queryType);
                    }
                    
                    // Refresh schema explorer if it's the current view
                    if (typeof Interface !== 'undefined' && Interface.activeSidebarView === 'explorer') {
                        Interface.refreshSchemaExplorer();
                    }
                    
                    // Update execute button
                    if (typeof Interface !== 'undefined' && Interface.updateExecuteButton) {
                        Interface.updateExecuteButton(Interface.activeTab);
                    }
                });
            });
        }
        
        // Also update old interface if it exists (for backward compatibility)
        const select = document.getElementById('datasource');
        if (select) {
            select.innerHTML = '<option value="">Select a data source</option>';
            
            const supportedDatasources = GrafanaConfig.datasources.filter(function(ds) {
                return ds.type === 'influxdb' || ds.type === 'prometheus';
            });
            
            supportedDatasources.forEach(function(ds) {
                const option = document.createElement('option');
                option.value = ds.uid;
                option.textContent = ds.name + ' (' + ds.type + ')';
                option.dataset.type = ds.type;
                option.dataset.id = ds.id;
                select.appendChild(option);
            });
            
            // Add event listener for auto-selecting query type based on datasource
            select.addEventListener('change', function() {
                const selectedOption = this.selectedOptions[0];
                if (selectedOption && selectedOption.dataset.type) {
                    const datasourceType = selectedOption.dataset.type;
                    
                    // Auto-select appropriate query type
                    if (typeof Editor !== 'undefined' && Editor.setQueryType) {
                        if (datasourceType === 'prometheus') {
                            Editor.setQueryType('promql');
                        } else if (datasourceType === 'influxdb') {
                            Editor.setQueryType('influxql');
                        }
                    }
                    
                    // Show a brief notification about the auto-selection
                    if (typeof Utils !== 'undefined' && Utils.showDataSourceNotification) {
                        Utils.showDataSourceNotification(datasourceType);
                    }
                }
            });
            
            select.disabled = false;
        }
    },

    // Load saved connections
    // Removed loadSavedConnections - only needed for old interface

    // Load a saved connection
    loadSavedConnection() {
        const select = document.getElementById('savedConnections');
        const connectionId = select.value;
        
        Utils.hideAllAuthSections();
        
        if (connectionId) {
            const connections = Storage.getSavedConnections();
            const connection = connections[connectionId];
            
            if (connection) {
                const authToken = Storage.getAuthToken(connectionId);
                if (authToken) {
                    this.attemptTokenConnection(connection, authToken);
                } else {
                    this.showPasswordInput(connection);
                }
            }
        }
        
        // Connection buttons updated automatically in new interface
    },

    // Show password input for connection
    showPasswordInput(connection) {
        document.getElementById('selectedConnectionName').textContent = connection.name;
        document.getElementById('password').value = '';
        document.getElementById('connectWithPassword').classList.remove('hidden');
        Utils.showTokenStatus(connection.id, 'Enter password to connect to ' + connection.name, 'info');
    },

    // Attempt connection with stored token
    async attemptTokenConnection(connection, authToken) {
        Utils.showTokenStatus(connection.id, 'Verifying stored authentication...', 'info');
        
        try {
            const tempConfig = {
                url: connection.url,
                username: connection.username,
                authHeader: authToken
            };
            
            const response = await API.makeApiRequestWithConfig(tempConfig, '/api/user');
            
            if (response.ok) {
                GrafanaConfig.url = tempConfig.url;
                GrafanaConfig.username = tempConfig.username;
                GrafanaConfig.authHeader = tempConfig.authHeader;
                GrafanaConfig.currentConnectionId = connection.id;
                
                const dsResponse = await API.makeApiRequestWithConfig(tempConfig, '/api/datasources');
                if (dsResponse.ok) {
                    GrafanaConfig.datasources = await dsResponse.json();
                    
                    Utils.showTokenStatus(connection.id, 'Connected with stored authentication', 'success');
                    this.showConnectedState(connection);
                    
                    this.populateDatasources();
                    Editor.enableQueryEditor();

                } else {
                    throw new Error('Failed to load datasources');
                }
            } else {
                throw new Error('Token authentication failed');
            }
        } catch (error) {
            Storage.clearAuthToken(connection.id);
            Utils.showTokenStatus(connection.id, 'Stored authentication expired - password required', 'error');
            
            // Connection list updated automatically in new interface
            
            const select = document.getElementById('savedConnections');
            select.value = connection.id;
            this.showPasswordInput(connection);
        }
    },

    // Connect with stored connection
    async connectWithStoredConnection(connectionId) {
        // If connectionId is provided directly, use it; otherwise get from form
        if (!connectionId) {
            const select = document.getElementById('savedConnections');
            if (select) {
                connectionId = select.value;
            }
        }
        
        if (!connectionId) {
            Utils.showStatus('authStatus', 'Please select a connection first', 'error');
            return;
        }
        
        const connections = Storage.getSavedConnections();
        const connection = connections[connectionId];
        
        if (!connection) {
            Utils.showStatus('authStatus', 'Connection not found', 'error');
            return;
        }
        
        // Check if we have a cached authentication token
        const cachedToken = Storage.getAuthToken(connectionId);
        if (cachedToken) {
            // Try to connect with cached token first
            await this.connectToGrafana(connection.url, connection.username, null, connectionId);
            return;
        }
        
        // If no cached token, prompt for password
        const password = await this.promptForPassword(connection.name);
        if (!password) {
            Utils.showStatus('authStatus', 'Password required for connection', 'error');
            return;
        }
        
        await this.connectToGrafana(connection.url, connection.username, password, connectionId);
    },
    
    async promptForPassword(connectionName) {
        return new Promise((resolve) => {
            // Create password dialog
            const overlay = document.createElement('div');
            overlay.className = 'modal-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.6);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
            `;
            
            const dialog = document.createElement('div');
            dialog.className = 'password-dialog';
            dialog.style.cssText = `
                background-color: #2d2d30;
                border: 1px solid #454545;
                border-radius: 4px;
                padding: 20px;
                min-width: 300px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            `;
            
            dialog.innerHTML = `
                <div style="margin-bottom: 16px; color: #cccccc; font-size: 14px; font-weight: 500;">
                    Connect to ${Utils.escapeHtml(connectionName)}
                </div>
                <div style="margin-bottom: 8px; color: #cccccc; font-size: 12px;">
                    Password:
                </div>
                <input type="password" id="passwordInput" style="
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #454545;
                    border-radius: 3px;
                    background-color: #3c3c3c;
                    color: #cccccc;
                    font-size: 13px;
                    margin-bottom: 16px;
                " placeholder="Enter password...">
                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                    <button id="cancelBtn" style="
                        padding: 8px 16px;
                        border: 1px solid #454545;
                        border-radius: 3px;
                        background-color: transparent;
                        color: #cccccc;
                        font-size: 13px;
                        cursor: pointer;
                    ">Cancel</button>
                    <button id="connectBtn" style="
                        padding: 8px 16px;
                        border: none;
                        border-radius: 3px;
                        background-color: #007acc;
                        color: white;
                        font-size: 13px;
                        cursor: pointer;
                    ">Connect</button>
                </div>
            `;
            
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            
            const passwordInput = dialog.querySelector('#passwordInput');
            const cancelBtn = dialog.querySelector('#cancelBtn');
            const connectBtn = dialog.querySelector('#connectBtn');
            
            // Focus password input
            passwordInput.focus();
            
            // Handle connect button
            connectBtn.addEventListener('click', () => {
                const password = passwordInput.value;
                document.body.removeChild(overlay);
                resolve(password);
            });
            
            // Handle cancel button
            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(overlay);
                resolve(null);
            });
            
            // Handle Enter key
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const password = passwordInput.value;
                    document.body.removeChild(overlay);
                    resolve(password);
                }
            });
            
            // Handle Escape key
            document.addEventListener('keydown', function escapeHandler(e) {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', escapeHandler);
                    document.body.removeChild(overlay);
                    resolve(null);
                }
            });
        });
    },

    // Removed updateConnectionButtons - only needed for old interface

    // Clear connection token
    clearConnectionToken(connectionId) {
        if (!connectionId) return;
        
        if (confirm('Clear stored authentication for this connection?')) {
            Storage.clearAuthToken(connectionId);
            // Connection list updated automatically in new interface
            
            const select = document.getElementById('savedConnections');
            if (select.value === connectionId) {
                Utils.showTokenStatus(connectionId, 'Authentication cleared - password required', 'info');
            }
            // Connection buttons updated automatically in new interface
        }
    },

    // Toggle connection form
    toggleConnectionForm() {
        const form = document.getElementById('connectionForm');
        const isHidden = form.classList.contains('hidden');
        
        if (isHidden) {
            Utils.hideAllAuthSections();
            document.getElementById('connectionFormTitle').textContent = 'Add New Connection';
            document.getElementById('connectionName').value = '';
            document.getElementById('connectionUrl').value = '';
            document.getElementById('connectionUsername').value = '';
            document.getElementById('connectionPassword').value = '';
            GrafanaConfig.currentEditingConnectionId = null;
            form.classList.remove('hidden');
            
            document.getElementById('savedConnections').value = '';
            // Connection buttons updated automatically in new interface
        } else {
            Utils.hideAllAuthSections();
        }
    },

    // Edit connection
    editConnection() {
        const select = document.getElementById('savedConnections');
        const connectionId = select.value;
        
        if (!connectionId) return;
        
        const connections = Storage.getSavedConnections();
        const connection = connections[connectionId];
        
        if (connection) {
            Utils.hideAllAuthSections();
            document.getElementById('connectionFormTitle').textContent = 'Edit Connection';
            document.getElementById('connectionName').value = connection.name;
            document.getElementById('connectionUrl').value = connection.url;
            document.getElementById('connectionUsername').value = connection.username;
            document.getElementById('connectionPassword').value = '';
            GrafanaConfig.currentEditingConnectionId = connectionId;
            document.getElementById('connectionForm').classList.remove('hidden');
        }
    },

    // Save connection
    saveConnection() {
        const name = document.getElementById('connectionName').value.trim();
        const url = document.getElementById('connectionUrl').value.trim();
        const username = document.getElementById('connectionUsername').value.trim();
        
        if (!name || !url) {
            alert('Please provide at least a name and URL for the connection.');
            return;
        }
        
        const connection = {
            id: GrafanaConfig.currentEditingConnectionId || Date.now().toString(),
            name: name,
            url: url.replace(/\/$/, ''),
            username: username
        };
        
        Storage.saveConnectionToStorage(connection);
        // Connection list updated automatically in new interface
        
        document.getElementById('savedConnections').value = connection.id;
        
        this.cancelConnectionForm();
        // Connection buttons updated automatically in new interface
        
        Utils.showStatus('authStatus', 'Connection "' + name + '" saved successfully', 'success');
    },

    // Save and connect connection
    saveAndConnectConnection() {
        const name = document.getElementById('connectionName').value.trim();
        const url = document.getElementById('connectionUrl').value.trim();
        const username = document.getElementById('connectionUsername').value.trim();
        const password = document.getElementById('connectionPassword').value.trim();
        
        if (!name || !url || !username || !password) {
            alert('Please provide all connection details including password to test connection.');
            return;
        }
        
        const connection = {
            id: GrafanaConfig.currentEditingConnectionId || Date.now().toString(),
            name: name,
            url: url.replace(/\/$/, ''),
            username: username
        };
        
        Storage.saveConnectionToStorage(connection);
        // Connection list updated automatically in new interface
        
        document.getElementById('savedConnections').value = connection.id;
        this.cancelConnectionForm();
        // Connection buttons updated automatically in new interface
        
        this.connectToGrafana(url, username, password, connection.id);
    },

    // Cancel connection form
    cancelConnectionForm() {
        Utils.hideAllAuthSections();
        GrafanaConfig.currentEditingConnectionId = null;
        
        const select = document.getElementById('savedConnections');
        if (select.value) {
            this.loadSavedConnection();
        }
        // Connection buttons updated automatically in new interface
    },

    // Delete connection
    deleteConnection() {
        const select = document.getElementById('savedConnections');
        const connectionId = select.value;
        
        if (!connectionId) return;
        
        const connections = Storage.getSavedConnections();
        const connection = connections[connectionId];
        
        if (connection && confirm('Are you sure you want to delete the connection "' + connection.name + '"? This will also clear any stored authentication.')) {
            Storage.deleteConnectionFromStorage(connectionId);
            Storage.clearAuthToken(connectionId);
            // Connection list updated automatically in new interface
            
            select.value = '';
            Utils.hideAllAuthSections();
            Utils.clearTokenStatus();
            // Connection buttons updated automatically in new interface
        }
    }
};