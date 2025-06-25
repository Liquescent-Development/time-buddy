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

// Initialize when page loads
window.onload = function() {
    App.initialize();
};