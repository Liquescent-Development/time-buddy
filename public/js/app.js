const App = {
    // Initialize the application
    initialize() {
        console.log('Page loaded, initializing...');
        
        History.initialize();
        Connections.loadSavedConnections();
        Variables.initialize();
        Schema.initialize();
        
        Connections.ensureDisconnectedState();
        API.checkIfRunningInContainer();
        
        // Initialize CodeMirror after a short delay to ensure DOM is ready
        setTimeout(function() {
            Editor.initializeCodeMirror();
        }, 100);
        
        Connections.updateConnectionButtons();
        
        console.log('Initialization complete');
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
    const headerStatus = document.getElementById('datasourceHeaderStatus');
    const toggleButton = document.querySelector('.datasource-toggle');
    
    // Get selected datasource
    const selectedOption = datasourceSelect.selectedOptions[0];
    if (selectedOption && selectedOption.value) {
        // Update header status
        if (headerStatus) {
            headerStatus.textContent = 'Selected: ' + selectedOption.textContent;
        }
        
        // Auto-collapse the section
        if (datasourceSection && !datasourceSection.classList.contains('collapsed')) {
            datasourceSection.classList.add('collapsed');
            if (toggleButton) {
                toggleButton.textContent = 'Show';
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