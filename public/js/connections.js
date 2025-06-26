const Connections = {
    // Show connected state
    showConnectedState(connection) {
        Utils.hideAllAuthSections();
        document.getElementById('authInfo').classList.remove('hidden');
        document.getElementById('connectedUrl').textContent = connection.url + ' (' + connection.username + ')';
        
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
        document.getElementById('authInfo').classList.add('hidden');
        Utils.hideAllAuthSections();
        document.getElementById('datasource').innerHTML = '<option value="">Connect to Grafana first</option>';
        document.getElementById('datasource').disabled = true;
        document.getElementById('executeBtn').disabled = true;
        document.getElementById('authStatus').innerHTML = '';
        
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
        
        const credentials = btoa(username + ':' + password);
        GrafanaConfig.authHeader = 'Basic ' + credentials;

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
            
            Storage.saveGrafanaConfig();

            if (connectionId) {
                const expiresAt = Date.now() + (24 * 60 * 60 * 1000);
                Storage.saveAuthToken(connectionId, GrafanaConfig.authHeader, expiresAt);
                
                this.loadSavedConnections();
                const select = document.getElementById('savedConnections');
                select.value = connectionId;
                
                Utils.showTokenStatus(connectionId, 'Authentication saved for future use', 'success');
            }

            Utils.showStatus('authStatus', 'Connected successfully!', 'success');
            
            const connection = { url: GrafanaConfig.url, username: username };
            this.showConnectedState(connection);
            
            this.populateDatasources();
            Editor.enableQueryEditor();

            document.getElementById('password').value = '';
            document.getElementById('connectionPassword').value = '';

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
        const select = document.getElementById('datasource');
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
                if (datasourceType === 'prometheus') {
                    Editor.setQueryType('promql');
                } else if (datasourceType === 'influxdb') {
                    Editor.setQueryType('influxql');
                }
                
                // Show a brief notification about the auto-selection
                Utils.showDataSourceNotification(datasourceType);
            }
        });
        
        select.disabled = false;
    },

    // Load saved connections
    loadSavedConnections() {
        const connections = Storage.getSavedConnections();
        const select = document.getElementById('savedConnections');
        
        while (select.children.length > 1) {
            select.removeChild(select.lastChild);
        }
        
        Object.values(connections).forEach(function(conn) {
            const option = document.createElement('option');
            option.value = conn.id;
            
            const hasValidToken = Storage.getAuthToken(conn.id) !== null;
            const statusIcon = hasValidToken ? '🔐' : '🔓';
            
            option.textContent = statusIcon + ' ' + conn.name;
            select.appendChild(option);
        });
        
        this.updateConnectionButtons();
    },

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
        
        this.updateConnectionButtons();
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
            
            this.loadSavedConnections();
            
            const select = document.getElementById('savedConnections');
            select.value = connection.id;
            this.showPasswordInput(connection);
        }
    },

    // Connect with stored connection
    async connectWithStoredConnection() {
        const select = document.getElementById('savedConnections');
        const connectionId = select.value;
        const password = document.getElementById('password').value.trim();
        
        if (!connectionId) {
            Utils.showStatus('authStatus', 'Please select a connection first', 'error');
            return;
        }
        
        if (!password) {
            Utils.showStatus('authStatus', 'Please enter your password', 'error');
            return;
        }
        
        const connections = Storage.getSavedConnections();
        const connection = connections[connectionId];
        
        if (!connection) {
            Utils.showStatus('authStatus', 'Connection not found', 'error');
            return;
        }
        
        await this.connectToGrafana(connection.url, connection.username, password, connectionId);
    },

    // Update connection buttons state
    updateConnectionButtons() {
        const select = document.getElementById('savedConnections');
        const hasSelection = select.value !== '';
        
        const editBtn = document.getElementById('editConnectionBtn');
        const deleteBtn = document.getElementById('deleteConnectionBtn');
        const clearTokenBtn = document.getElementById('clearTokenBtn');
        
        if (editBtn) editBtn.disabled = !hasSelection;
        if (deleteBtn) deleteBtn.disabled = !hasSelection;
        
        if (clearTokenBtn) {
            if (hasSelection) {
                const connectionId = select.value;
                const hasToken = Storage.getAuthToken(connectionId) !== null;
                clearTokenBtn.disabled = !hasToken;
                clearTokenBtn.style.display = hasToken ? 'inline-block' : 'none';
            } else {
                clearTokenBtn.style.display = 'none';
            }
        }
    },

    // Clear connection token
    clearConnectionToken(connectionId) {
        if (!connectionId) return;
        
        if (confirm('Clear stored authentication for this connection?')) {
            Storage.clearAuthToken(connectionId);
            this.loadSavedConnections();
            
            const select = document.getElementById('savedConnections');
            if (select.value === connectionId) {
                Utils.showTokenStatus(connectionId, 'Authentication cleared - password required', 'info');
            }
            this.updateConnectionButtons();
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
            this.updateConnectionButtons();
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
        this.loadSavedConnections();
        
        document.getElementById('savedConnections').value = connection.id;
        
        this.cancelConnectionForm();
        this.updateConnectionButtons();
        
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
        this.loadSavedConnections();
        
        document.getElementById('savedConnections').value = connection.id;
        this.cancelConnectionForm();
        this.updateConnectionButtons();
        
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
        this.updateConnectionButtons();
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
            this.loadSavedConnections();
            
            select.value = '';
            Utils.hideAllAuthSections();
            Utils.clearTokenStatus();
            this.updateConnectionButtons();
        }
    }
};