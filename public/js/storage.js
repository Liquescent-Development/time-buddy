const Storage = {
    // Connection storage
    getSavedConnections() {
        const connections = JSON.parse(localStorage.getItem('grafanaConnections') || '{}');
        return connections;
    },

    saveConnectionToStorage(connection) {
        const connections = this.getSavedConnections();
        connections[connection.id] = connection;
        localStorage.setItem('grafanaConnections', JSON.stringify(connections));
    },

    deleteConnectionFromStorage(id) {
        const connections = this.getSavedConnections();
        delete connections[id];
        localStorage.setItem('grafanaConnections', JSON.stringify(connections));
    },

    // Auth token storage
    saveAuthToken(connectionId, authHeader, expiresAt = null) {
        const tokens = JSON.parse(localStorage.getItem('grafanaTokens') || '{}');
        tokens[connectionId] = {
            authHeader: authHeader,
            timestamp: Date.now(),
            expiresAt: expiresAt
        };
        localStorage.setItem('grafanaTokens', JSON.stringify(tokens));
    },

    getAuthToken(connectionId) {
        const tokens = JSON.parse(localStorage.getItem('grafanaTokens') || '{}');
        const token = tokens[connectionId];
        
        if (!token) return null;
        
        if (token.expiresAt && Date.now() > token.expiresAt) {
            this.clearAuthToken(connectionId);
            return null;
        }
        
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        if (Date.now() - token.timestamp > maxAge) {
            this.clearAuthToken(connectionId);
            return null;
        }
        
        return token.authHeader;
    },

    clearAuthToken(connectionId) {
        const tokens = JSON.parse(localStorage.getItem('grafanaTokens') || '{}');
        delete tokens[connectionId];
        localStorage.setItem('grafanaTokens', JSON.stringify(tokens));
    },

    // Grafana config storage
    saveGrafanaConfig() {
        localStorage.setItem('grafanaConfig', JSON.stringify({
            url: GrafanaConfig.url,
            username: GrafanaConfig.username
        }));
    },

    // Query history storage
    getHistory() {
        const history = localStorage.getItem('queryHistory');
        return history ? JSON.parse(history) : [];
    },

    saveToHistory(query, datasourceId, datasourceName) {
        const history = this.getHistory();
        const historyItem = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            query: query,
            datasourceId: datasourceId,
            datasourceName: datasourceName,
            queryType: GrafanaConfig.currentQueryType,
            tags: [],
            label: '',
            isFavorite: false
        };
        
        history.unshift(historyItem);
        
        // Keep only the last 100 items (increased from 50)
        if (history.length > 100) {
            history.pop();
        }
        
        localStorage.setItem('queryHistory', JSON.stringify(history));
    },
    
    updateHistoryItem(id, updates) {
        const history = this.getHistory();
        const index = history.findIndex(item => item.id === id);
        
        if (index !== -1) {
            history[index] = { ...history[index], ...updates };
            localStorage.setItem('queryHistory', JSON.stringify(history));
        }
        
        return history[index];
    },
    
    deleteHistoryItem(id) {
        const history = this.getHistory();
        const filteredHistory = history.filter(item => item.id !== id);
        localStorage.setItem('queryHistory', JSON.stringify(filteredHistory));
    },

    clearHistory() {
        localStorage.removeItem('queryHistory');
    }
};