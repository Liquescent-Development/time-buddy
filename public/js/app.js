const App = {
    // Initialize the application
    initialize() {
        console.log('Page loaded, initializing...');
        
        History.initialize();
        Connections.loadSavedConnections();
        Variables.initialize();
        Schema.initialize();
        Dashboard.initialize();
        
        Connections.ensureDisconnectedState();
        API.checkIfRunningInContainer();
        
        // Initialize CodeMirror after a short delay to ensure DOM is ready
        setTimeout(function() {
            Editor.initializeCodeMirror();
        }, 100);
        
        Connections.updateConnectionButtons();
        
        // Set default section states on page load
        this.setDefaultSectionStates();
        
        console.log('Initialization complete');
    },
    
    // Set default section states for page load
    setDefaultSectionStates() {
        // Auth section: expanded by default
        const authSection = document.getElementById('authSection');
        if (authSection) {
            authSection.classList.remove('collapsed');
            const toggleButton = document.querySelector('.auth-toggle');
            if (toggleButton) {
                toggleButton.textContent = 'Hide';
            }
        }
        
        // Datasource section: collapsed by default
        const datasourceSection = document.getElementById('datasourceSection');
        if (datasourceSection) {
            datasourceSection.classList.add('collapsed');
            const toggleButton = document.querySelector('.datasource-toggle');
            if (toggleButton) {
                toggleButton.textContent = 'Show';
            }
        }
        
        // Schema section: collapsed by default
        const schemaSection = document.getElementById('schemaSection');
        if (schemaSection) {
            schemaSection.classList.add('collapsed');
            const toggleButton = document.querySelector('.schema-toggle');
            if (toggleButton) {
                toggleButton.textContent = 'Show';
            }
        }
        
        // Dashboard section: collapsed by default
        const dashboardSection = document.getElementById('dashboardSection');
        if (dashboardSection) {
            dashboardSection.classList.add('collapsed');
            const toggleButton = document.querySelector('.dashboard-toggle');
            if (toggleButton) {
                toggleButton.textContent = 'Show';
            }
        }
    }
};

// Global functions for HTML onclick handlers
function showConnectedState(connection) {
    Connections.showConnectedState(connection);
}

function disconnect() {
    Connections.disconnect();
}

function clearConnectionToken(connectionId) {
    Connections.clearConnectionToken(connectionId);
}

function updateConnectionButtons() {
    Connections.updateConnectionButtons();
}

function toggleConnectionForm() {
    Connections.toggleConnectionForm();
}

function loadSavedConnection() {
    Connections.loadSavedConnection();
}

function editConnection() {
    Connections.editConnection();
}

function deleteConnection() {
    Connections.deleteConnection();
}

function saveAndConnectConnection() {
    Connections.saveAndConnectConnection();
}

function saveConnection() {
    Connections.saveConnection();
}

function cancelConnectionForm() {
    Connections.cancelConnectionForm();
}

function connectWithStoredConnection() {
    Connections.connectWithStoredConnection();
}

function setQueryType(type) {
    Editor.setQueryType(type);
}

function clearQuery() {
    Editor.clearQuery();
}

function executeQuery() {
    Queries.executeQuery();
}

function toggleDatasourceSection() {
    const datasourceSection = document.getElementById('datasourceSection');
    const toggleButton = document.querySelector('.datasource-toggle');
    
    if (datasourceSection.classList.contains('collapsed')) {
        datasourceSection.classList.remove('collapsed');
        toggleButton.textContent = 'Hide';
    } else {
        datasourceSection.classList.add('collapsed');
        toggleButton.textContent = 'Show';
    }
}

function filterDataSources() {
    const searchInput = document.getElementById('datasourceSearch');
    const datasourceSelect = document.getElementById('datasource');
    const searchTerm = searchInput.value.toLowerCase();
    const options = datasourceSelect.options;
    
    for (let i = 0; i < options.length; i++) {
        const option = options[i];
        const text = option.textContent.toLowerCase();
        
        if (text.includes(searchTerm) || searchTerm === '') {
            option.style.display = '';
        } else {
            option.style.display = 'none';
        }
    }
}

function toggleAuthSection() {
    const authSection = document.getElementById('authSection');
    const toggleButton = document.querySelector('.auth-toggle');
    
    if (authSection.classList.contains('collapsed')) {
        authSection.classList.remove('collapsed');
        toggleButton.textContent = 'Hide';
    } else {
        authSection.classList.add('collapsed');
        toggleButton.textContent = 'Show';
    }
}

function onDataSourceChange() {
    const datasourceSelect = document.getElementById('datasource');
    const datasourceSection = document.getElementById('datasourceSection');
    const schemaSection = document.getElementById('schemaSection');
    const headerStatus = document.getElementById('datasourceHeaderStatus');
    const toggleButton = document.querySelector('.datasource-toggle');
    const schemaToggleButton = document.querySelector('.schema-toggle');
    
    // Get selected datasource
    const selectedOption = datasourceSelect.selectedOptions[0];
    if (selectedOption && selectedOption.value) {
        // Update header status
        if (headerStatus) {
            headerStatus.textContent = 'Selected: ' + selectedOption.textContent;
        }
        
        // Auto-collapse the datasource section
        if (datasourceSection && !datasourceSection.classList.contains('collapsed')) {
            datasourceSection.classList.add('collapsed');
            if (toggleButton) {
                toggleButton.textContent = 'Show';
            }
        }
        
        // Auto-expand the schema section
        if (schemaSection && schemaSection.classList.contains('collapsed')) {
            schemaSection.classList.remove('collapsed');
            if (schemaToggleButton) {
                schemaToggleButton.textContent = 'Hide';
            }
        }
    }
    
    // Always call the schema explorer's datasource change handler
    if (typeof Schema !== 'undefined' && Schema.onDatasourceChange) {
        Schema.onDatasourceChange();
    }
}

// Initialize when page loads
window.onload = function() {
    App.initialize();
};