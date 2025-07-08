const App = {
    // Initialize the application
    initialize() {
        console.log('Initializing VS Code-like interface...');
        
        // Add platform class to body for platform-specific styling
        if (typeof process !== 'undefined' && process.platform) {
            document.body.classList.add(`platform-${process.platform}`);
        } else if (navigator.userAgent.includes('Mac')) {
            document.body.classList.add('platform-darwin');
        } else if (navigator.userAgent.includes('Win')) {
            document.body.classList.add('platform-win32');
        } else {
            document.body.classList.add('platform-linux');
        }
        
        // Initialize the new VS Code-like interface
        Interface.initialize();
        
        // Initialize CodeMirror modes and helpers for the new interface
        Editor.setupCodeMirrorHelpers();
        Variables.initialize();
        Dashboard.initialize();
        
        // Initialize connection and API systems
        Connections.ensureDisconnectedState();
        API.checkIfRunningInContainer();
        
        // Set default application state
        this.setDefaultApplicationState();
        
        console.log('VS Code-like interface initialization complete');
    },
    
    // Set default application state
    setDefaultApplicationState() {
        // Set default query type
        GrafanaConfig.currentQueryType = 'influxql';
        GrafanaConfig.currentViewMode = 'table';
        GrafanaConfig.pageSize = 25;
        GrafanaConfig.currentPage = 1;
        
        // Update title bar connection status
        this.updateTitleBarStatus();
        
        // Check for saved connections and load them
        this.loadSavedConnections();
    },
    
    updateTitleBarStatus() {
        const statusElement = document.getElementById('titleBarConnectionStatus');
        if (GrafanaConfig.connected && GrafanaConfig.url) {
            statusElement.textContent = `Connected to ${GrafanaConfig.url}`;
            statusElement.style.color = '#51cf66';
        } else {
            statusElement.textContent = 'Not Connected';
            statusElement.style.color = '#858585';
        }
    },
    
    loadSavedConnections() {
        // Load and display saved connections in the new interface
        Interface.loadConnections();
    }
};

// Connection Management - Updated for new interface
function showConnectedState(connection) {
    GrafanaConfig.connected = true;
    GrafanaConfig.url = connection.url;
    GrafanaConfig.username = connection.username;
    GrafanaConfig.connectionId = connection.id;
    
    App.updateTitleBarStatus();
    Interface.loadConnections();
    Interface.loadDataSources();
    
    // Update execute buttons in all tabs
    Interface.tabs.forEach((_, tabId) => {
        Interface.updateExecuteButton(tabId);
    });
    
    Interface.showToast(`Connected to ${connection.name}`, 'success');
}

function disconnect() {
    GrafanaConfig.connected = false;
    GrafanaConfig.url = '';
    GrafanaConfig.username = '';
    GrafanaConfig.connectionId = null;
    GrafanaConfig.currentDatasourceId = null;
    
    App.updateTitleBarStatus();
    Interface.loadConnections();
    Interface.loadDataSources();
    
    // Disable execute buttons in all tabs
    Interface.tabs.forEach((_, tabId) => {
        Interface.updateExecuteButton(tabId);
    });
    
    Interface.showToast('Disconnected from Grafana', 'info');
}

// Global functions for HTML onclick handlers and compatibility
function clearConnectionToken(connectionId) {
    if (typeof Connections !== 'undefined') {
        Connections.clearConnectionToken(connectionId);
    }
}

function updateConnectionButtons() {
    Interface.loadConnections();
}

function loadSavedConnection() {
    // This is handled by the new connection click handlers in Interface
}

function editConnection() {
    // TODO: Implement edit functionality in new interface
    Interface.showToast('Edit connection functionality coming soon', 'info');
}

function deleteConnection(connectionId) {
    if (!connectionId) {
        Interface.showToast('Invalid connection ID', 'error');
        return;
    }
    
    const connections = Storage.getSavedConnections();
    const connection = connections[connectionId];
    
    if (!connection) {
        Interface.showToast('Connection not found', 'error');
        return;
    }
    
    // Show confirmation dialog
    const confirmed = confirm(`Are you sure you want to delete the connection "${connection.name}"?\n\nThis will also clear any stored authentication tokens.`);
    
    if (confirmed) {
        // Check if this is the currently active connection
        const isActiveConnection = GrafanaConfig.connectionId === connectionId || GrafanaConfig.currentConnectionId === connectionId;
        
        // Delete the connection from storage
        Storage.deleteConnectionFromStorage(connectionId);
        
        // Clear any stored auth tokens
        Storage.clearAuthToken(connectionId);
        
        // If this was the active connection, disconnect
        if (isActiveConnection) {
            Connections.disconnect();
            Interface.showToast('Connection deleted and disconnected', 'success');
        } else {
            Interface.showToast(`Connection "${connection.name}" deleted`, 'success');
        }
        
        // Reload the connections list
        Interface.loadConnections();
    }
}

function connectWithStoredConnection(connectionId) {
    if (typeof Connections !== 'undefined') {
        Connections.connectWithStoredConnection(connectionId);
    }
}

// Query and Editor functions - Updated for tab system
function setQueryType(type) {
    Interface.setQueryType(Interface.activeTab, type);
}

function clearQuery() {
    const tabData = Interface.tabs.get(Interface.activeTab);
    if (tabData && tabData.editor) {
        tabData.editor.setValue('');
    }
}

function executeQuery(tabId) {
    Interface.executeQuery(tabId || Interface.activeTab);
}

// Datasource management - Updated for new interface
function onDataSourceChange() {
    const datasourceSelect = document.getElementById('datasource');
    if (!datasourceSelect) return;
    
    const selectedOption = datasourceSelect.selectedOptions[0];
    if (selectedOption && selectedOption.value) {
        GrafanaConfig.currentDatasourceId = selectedOption.value;
        
        // Update execute buttons
        Interface.tabs.forEach((_, tabId) => {
            Interface.updateExecuteButton(tabId);
        });
        
        // Auto-detect query type based on datasource
        const datasourceType = selectedOption.dataset.type;
        if (datasourceType) {
            const queryType = datasourceType === 'prometheus' ? 'promql' : 'influxql';
            Interface.setQueryType(Interface.activeTab, queryType);
        }
        
        // Trigger schema loading
        if (typeof Schema !== 'undefined' && Schema.onDatasourceChange) {
            Schema.onDatasourceChange();
        }
        
        // Switch to schema explorer view
        Interface.switchSidebarView('explorer');
        
        Interface.showToast(`Selected datasource: ${selectedOption.textContent}`, 'success');
    }
}

// Data source loading function (called by Interface)
async function loadDataSources() {
    if (!GrafanaConfig.connected) return;
    
    try {
        const response = await API.makeApiRequest('/api/datasources', {
            method: 'GET'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const datasources = await response.json();
        populateDataSourceList(datasources);
        
    } catch (error) {
        console.error('Error loading data sources:', error);
        Interface.showToast('Failed to load data sources: ' + error.message, 'error');
    }
}

function populateDataSourceList(datasources) {
    const datasourceList = document.getElementById('datasourceList');
    
    if (!datasources || datasources.length === 0) {
        datasourceList.innerHTML = '<div class="empty-state">No data sources found</div>';
        return;
    }
    
    let html = '';
    datasources.forEach(ds => {
        const isSelected = GrafanaConfig.currentDatasourceId === ds.uid;
        html += `
            <div class="datasource-item ${isSelected ? 'selected' : ''}" data-uid="${ds.uid}" data-type="${ds.type}">
                <div>
                    <div style="font-weight: 500;">${Utils.escapeHtml(ds.name)}</div>
                    <div style="font-size: 11px; color: #858585;">${Utils.escapeHtml(ds.type)}</div>
                </div>
            </div>
        `;
    });
    
    datasourceList.innerHTML = html;
    
    // Add click handlers
    datasourceList.querySelectorAll('.datasource-item').forEach(item => {
        item.addEventListener('click', () => {
            // Update selection
            datasourceList.querySelectorAll('.datasource-item').forEach(i => {
                i.classList.remove('selected');
            });
            item.classList.add('selected');
            
            // Update global state
            GrafanaConfig.currentDatasourceId = item.dataset.uid;
            
            // Trigger change event
            onDataSourceChange();
        });
    });
}

// Connection backup functions
function exportConnections() {
    const backupData = Storage.exportConnections();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `grafana-connections-${timestamp}.json`;
    
    // Create a download link
    const blob = new Blob([backupData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    Interface.showToast(`Connections exported to ${filename}`, 'success');
}

function importConnections() {
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = Storage.importConnections(e.target.result);
            
            if (result.success) {
                Interface.showToast(`Imported ${result.connectionsImported} connections and ${result.tokensImported} auth tokens`, 'success');
                Interface.loadConnections();
            } else {
                Interface.showToast(`Import failed: ${result.error}`, 'error');
            }
        };
        
        reader.onerror = () => {
            Interface.showToast('Failed to read file', 'error');
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// Dashboard search functions
function searchDashboards() {
    if (typeof Dashboard !== 'undefined' && Dashboard.searchDashboards) {
        Dashboard.searchDashboards();
    }
}

function clearDashboardSearch() {
    const searchInput = document.getElementById('dashboardSearch');
    if (searchInput) {
        searchInput.value = '';
        searchDashboards();
    }
}

// Panel management functions
function selectSeries(seriesIndex) {
    const index = parseInt(seriesIndex);
    if (GrafanaConfig.currentResults && index >= 0) {
        GrafanaConfig.currentPage = 1;
        GrafanaConfig.selectedSeries = index;
        Queries.displayResults(GrafanaConfig.currentResults, GrafanaConfig.currentPage, index);
    }
}

function setViewMode(mode) {
    GrafanaConfig.currentViewMode = mode;
    if (GrafanaConfig.currentResults) {
        Queries.displayResults(GrafanaConfig.currentResults, GrafanaConfig.currentPage, GrafanaConfig.selectedSeries);
    }
}

function goToPage(page) {
    if (GrafanaConfig.currentResults && page >= 1 && page <= Math.ceil(GrafanaConfig.totalRows / GrafanaConfig.pageSize)) {
        Queries.displayResults(GrafanaConfig.currentResults, page, GrafanaConfig.selectedSeries);
    }
}

function changePageSize(newSize) {
    GrafanaConfig.pageSize = parseInt(newSize);
    GrafanaConfig.currentPage = 1;
    if (GrafanaConfig.currentResults) {
        Queries.displayResults(GrafanaConfig.currentResults, GrafanaConfig.currentPage, GrafanaConfig.selectedSeries);
    }
}

function updateChart() {
    if (typeof Charts !== 'undefined' && Charts.updateChart) {
        Charts.updateChart();
    }
}

// Legacy function compatibility
function toggleSchemaExplorer() {
    Interface.switchSidebarView('explorer');
}

function toggleDashboardExplorer() {
    Interface.switchSidebarView('dashboards');
}

function refreshSchema() {
    if (typeof Schema !== 'undefined' && Schema.loadSchema) {
        Schema.loadSchema();
    }
}

// Variables management
function addVariable() {
    Interface.switchPanel('variables');
    if (typeof Variables !== 'undefined' && Variables.addVariable) {
        Variables.addVariable();
    }
}

// Global function for clearing query history
function clearQueryHistory() {
    if (typeof History !== 'undefined') {
        History.clearHistory();
    } else {
        console.error('History module not available');
    }
}

// Initialize when page loads
window.onload = function() {
    App.initialize();
    
    // Load data sources when Interface is ready
    Interface.loadDataSources = loadDataSources;
    
    // Mark app as loaded for Electron
    if (document.body) {
        document.body.classList.add('electron-app');
    }
    
    // Expose debug functions to global scope for console access
    window.debugStorage = Storage.debugLocalStorage.bind(Storage);
    window.recoverConnections = Storage.recoverConnections.bind(Storage);
    
    // Log debug info on startup
    console.log('App initialized - you can use debugStorage() and recoverConnections() in console');
};