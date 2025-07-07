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

    generateQueryTitle(query, queryType) {
        // Clean up the query for title generation
        const cleanQuery = query.trim().replace(/\s+/g, ' ');
        
        if (queryType === 'promql') {
            // Extract metric name from PromQL
            const metricMatch = cleanQuery.match(/^(\w+)(?:\{|$)/);
            if (metricMatch) {
                const metric = metricMatch[1];
                // Check for common functions
                if (cleanQuery.includes('rate(')) return `Rate of ${metric}`;
                if (cleanQuery.includes('sum(')) return `Sum of ${metric}`;
                if (cleanQuery.includes('avg(')) return `Average ${metric}`;
                if (cleanQuery.includes('max(')) return `Max ${metric}`;
                if (cleanQuery.includes('min(')) return `Min ${metric}`;
                if (cleanQuery.includes('count(')) return `Count of ${metric}`;
                return metric;
            }
        } else if (queryType === 'influxql') {
            // Extract table/measurement from InfluxQL
            const fromMatch = cleanQuery.match(/FROM\s+["']?(\w+)["']?/i);
            const selectMatch = cleanQuery.match(/SELECT\s+(.+?)\s+FROM/i);
            
            if (fromMatch) {
                const table = fromMatch[1];
                if (selectMatch) {
                    const fields = selectMatch[1].toLowerCase();
                    if (fields.includes('count(')) return `Count from ${table}`;
                    if (fields.includes('mean(')) return `Mean from ${table}`;
                    if (fields.includes('sum(')) return `Sum from ${table}`;
                    if (fields.includes('max(')) return `Max from ${table}`;
                    if (fields.includes('min(')) return `Min from ${table}`;
                }
                return `Query ${table}`;
            }
        }
        
        // Fallback: use first few words
        const words = cleanQuery.split(' ').slice(0, 3).join(' ');
        return words.length > 30 ? words.substring(0, 27) + '...' : words;
    },

    saveToHistory(query, datasourceId, datasourceName) {
        const history = this.getHistory();
        
        // Check if this exact query already exists for the same datasource
        const existingIndex = history.findIndex(item => 
            item.query === query && 
            item.datasourceId === datasourceId
        );
        
        let historyItem;
        
        if (existingIndex !== -1) {
            // Move existing item to top, preserving its metadata
            historyItem = history[existingIndex];
            historyItem.timestamp = new Date().toISOString();
            // Remove from current position
            history.splice(existingIndex, 1);
        } else {
            // Create new history item with auto-generated title
            historyItem = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                query: query,
                datasourceId: datasourceId,
                datasourceName: datasourceName,
                queryType: GrafanaConfig.currentQueryType,
                tags: [],
                label: this.generateQueryTitle(query, GrafanaConfig.currentQueryType),
                isFavorite: false
            };
        }
        
        // Add to top
        history.unshift(historyItem);
        
        // Keep only the last 100 items
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