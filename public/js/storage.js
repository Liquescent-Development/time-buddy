const Storage = {
    // Connection storage
    getSavedConnections() {
        const rawData = localStorage.getItem('grafanaConnections');
        console.log('DEBUG: Raw localStorage data for grafanaConnections:', rawData);
        console.log('DEBUG: localStorage length:', localStorage.length);
        console.log('DEBUG: All localStorage keys:', Object.keys(localStorage));
        
        if (rawData === null) {
            console.log('DEBUG: No grafanaConnections found in localStorage');
            return {};
        }
        
        try {
            const connections = JSON.parse(rawData || '{}');
            console.log('DEBUG: Parsed connections:', connections);
            console.log('DEBUG: Connection count:', Object.keys(connections).length);
            return connections;
        } catch (error) {
            console.error('DEBUG: Error parsing connections from localStorage:', error);
            console.error('DEBUG: Raw data that caused error:', rawData);
            return {};
        }
    },

    saveConnectionToStorage(connection) {
        const connections = this.getSavedConnections();
        connections[connection.id] = connection;
        localStorage.setItem('grafanaConnections', JSON.stringify(connections));
        console.log('DEBUG: Saved connection:', connection);
        console.log('DEBUG: All connections after save:', connections);
    },

    // Schema cache storage
    getSavedSchemaCache() {
        const rawData = localStorage.getItem('grafanaSchemaCache');
        if (rawData === null) {
            console.log('DEBUG: No schema cache found in localStorage');
            return {};
        }
        
        try {
            const cache = JSON.parse(rawData || '{}');
            console.log('DEBUG: Loaded schema cache for', Object.keys(cache).length, 'datasources');
            return cache;
        } catch (error) {
            console.error('DEBUG: Error parsing schema cache from localStorage:', error);
            return {};
        }
    },

    saveSchemaToStorage(datasourceId, schemaData) {
        const cache = this.getSavedSchemaCache();
        const timestamp = Date.now();
        
        cache[datasourceId] = {
            ...schemaData,
            timestamp: timestamp,
            version: '1.0' // For future compatibility
        };
        
        localStorage.setItem('grafanaSchemaCache', JSON.stringify(cache));
        console.log(`DEBUG: Saved schema cache for datasource ${datasourceId}:`, {
            retentionPolicies: schemaData.retentionPolicies?.length || 0,
            measurements: schemaData.measurements?.length || 0,
            fieldsForMeasurements: Object.keys(schemaData.fields || {}).length,
            tagsForMeasurements: Object.keys(schemaData.tags || {}).length
        });
    },

    getSchemaFromStorage(datasourceId, maxAgeMs = 24 * 60 * 60 * 1000) { // Default: 24 hours
        const cache = this.getSavedSchemaCache();
        const cached = cache[datasourceId];
        
        if (!cached) {
            console.log(`DEBUG: No cached schema found for datasource ${datasourceId}`);
            return null;
        }
        
        const age = Date.now() - cached.timestamp;
        if (age > maxAgeMs) {
            console.log(`DEBUG: Cached schema for ${datasourceId} is expired (${Math.round(age / 1000 / 60)} minutes old)`);
            // Clean up expired cache
            delete cache[datasourceId];
            localStorage.setItem('grafanaSchemaCache', JSON.stringify(cache));
            return null;
        }
        
        console.log(`DEBUG: Using cached schema for ${datasourceId} (${Math.round(age / 1000 / 60)} minutes old)`);
        return cached;
    },

    clearExpiredSchemaCache(maxAgeMs = 24 * 60 * 60 * 1000) {
        const cache = this.getSavedSchemaCache();
        const now = Date.now();
        let clearedCount = 0;
        
        Object.keys(cache).forEach(datasourceId => {
            const age = now - cache[datasourceId].timestamp;
            if (age > maxAgeMs) {
                delete cache[datasourceId];
                clearedCount++;
            }
        });
        
        if (clearedCount > 0) {
            localStorage.setItem('grafanaSchemaCache', JSON.stringify(cache));
            console.log(`DEBUG: Cleared ${clearedCount} expired schema cache entries`);
        }
        
        return clearedCount;
    },

    // Debug function to inspect and recover localStorage data
    debugLocalStorage() {
        console.log('=== DEBUG: localStorage INSPECTION ===');
        console.log('localStorage length:', localStorage.length);
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            console.log(`Key: ${key}`, `Value:`, value);
            
            if (key.includes('grafana') || key.includes('connection')) {
                try {
                    const parsed = JSON.parse(value);
                    console.log(`Parsed ${key}:`, parsed);
                } catch (e) {
                    console.log(`Could not parse ${key} as JSON`);
                }
            }
        }
        console.log('=== END DEBUG ===');
    },

    // Recovery function to attempt to restore connections from various sources
    recoverConnections() {
        console.log('=== ATTEMPTING CONNECTION RECOVERY ===');
        
        // Check for connections under different keys
        const possibleKeys = ['grafanaConnections', 'connections', 'savedConnections', 'grafana_connections'];
        
        for (const key of possibleKeys) {
            const data = localStorage.getItem(key);
            if (data) {
                try {
                    const parsed = JSON.parse(data);
                    if (typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                        console.log(`Found potential connections under key '${key}':`, parsed);
                        
                        // If this isn't the standard key, migrate the data
                        if (key !== 'grafanaConnections') {
                            localStorage.setItem('grafanaConnections', data);
                            console.log(`Migrated connections from '${key}' to 'grafanaConnections'`);
                        }
                        return parsed;
                    }
                } catch (e) {
                    console.log(`Data under '${key}' is not valid JSON`);
                }
            }
        }
        
        console.log('No recoverable connections found');
        return {};
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

    // Backup and restore functionality
    exportConnections() {
        const connections = this.getSavedConnections();
        const tokens = JSON.parse(localStorage.getItem('grafanaTokens') || '{}');
        const history = this.getHistory();
        const variables = JSON.parse(localStorage.getItem('queryVariables') || '[]');
        
        const backup = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            connections: connections,
            tokens: tokens,
            history: history,
            variables: variables
        };
        
        return JSON.stringify(backup, null, 2);
    },

    importConnections(backupData) {
        try {
            const backup = JSON.parse(backupData);
            
            if (!backup.connections) {
                throw new Error('Invalid backup format: missing connections');
            }
            
            // Validate the structure
            if (typeof backup.connections !== 'object') {
                throw new Error('Invalid backup format: connections must be an object');
            }
            
            // Import connections
            localStorage.setItem('grafanaConnections', JSON.stringify(backup.connections));
            
            // Import tokens if they exist
            if (backup.tokens) {
                localStorage.setItem('grafanaTokens', JSON.stringify(backup.tokens));
            }
            
            // Import history if it exists
            if (backup.history) {
                localStorage.setItem('queryHistory', JSON.stringify(backup.history));
            }
            
            // Import variables if they exist
            if (backup.variables) {
                localStorage.setItem('queryVariables', JSON.stringify(backup.variables));
            }
            
            console.log('Import successful:', {
                connectionsImported: Object.keys(backup.connections).length,
                tokensImported: backup.tokens ? Object.keys(backup.tokens).length : 0,
                historyImported: backup.history ? backup.history.length : 0,
                variablesImported: backup.variables ? backup.variables.length : 0
            });
            
            return {
                success: true,
                connectionsImported: Object.keys(backup.connections).length,
                tokensImported: backup.tokens ? Object.keys(backup.tokens).length : 0,
                historyImported: backup.history ? backup.history.length : 0,
                variablesImported: backup.variables ? backup.variables.length : 0
            };
        } catch (error) {
            console.error('Import failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
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
        console.log('DEBUG: Raw queryHistory from localStorage:', history);
        console.log('DEBUG: localStorage queryHistory length:', history ? history.length : 0);
        const parsed = history ? JSON.parse(history) : [];
        console.log('DEBUG: Parsed history items count:', parsed.length);
        return parsed;
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
        
        const historyJson = JSON.stringify(history);
        console.log('DEBUG: Saving history to localStorage, items count:', history.length);
        console.log('DEBUG: History JSON length:', historyJson.length);
        localStorage.setItem('queryHistory', historyJson);
        
        // Verify it was saved
        const saved = localStorage.getItem('queryHistory');
        console.log('DEBUG: Verified save - retrieved length:', saved ? saved.length : 0);
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