const API = {
    // Make API requests with current config
    async makeApiRequest(endpoint, options = {}) {
        // Check if running in Electron
        if (window.electronAPI && window.electronAPI.grafanaRequest) {
            try {
                const requestOptions = {
                    grafanaUrl: GrafanaConfig.url,
                    path: endpoint,
                    method: options.method || 'GET',
                    headers: {
                        'Authorization': GrafanaConfig.authHeader,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        ...options.headers
                    },
                    body: options.body,
                    timeout: 30000,
                    proxyConfig: GrafanaConfig.proxyConfig // Include proxy configuration if available
                };
                
                const response = await window.electronAPI.grafanaRequest(requestOptions);
                
                // Convert to fetch-like response
                return {
                    ok: response.status >= 200 && response.status < 300,
                    status: response.status,
                    statusText: response.statusText,
                    headers: {
                        get: (name) => response.headers[name.toLowerCase()]
                    },
                    json: async () => response.data,
                    text: async () => typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
                };
            } catch (error) {
                // Handle IPC errors and convert to fetch-like response
                const status = error.status || 500;
                return {
                    ok: false,
                    status: status,
                    statusText: error.statusText || error.message || 'Request failed',
                    headers: {
                        get: () => null
                    },
                    json: async () => ({ 
                        error: error.error || error.message,
                        message: error.statusText || error.message 
                    }),
                    text: async () => error.error || error.message || 'Request failed'
                };
            }
        }
        
        // Fallback to HTTP requests (for web-only mode)
        const isIntegratedProxy = window.location.pathname !== '/grafana-query-ide.html';
        
        if (isIntegratedProxy) {
            const headers = {
                'Authorization': GrafanaConfig.authHeader,
                'X-Grafana-URL': GrafanaConfig.url,
                'Accept': 'application/json'
            };
            
            
            // Add proxy configuration if available
            if (GrafanaConfig.proxyConfig) {
                headers['X-Proxy-Config'] = JSON.stringify(GrafanaConfig.proxyConfig);
            }
            
            if (options.headers) {
                Object.assign(headers, options.headers);
            }

            return fetch('/api' + endpoint.replace('/api', ''), {
                method: options.method || 'GET',
                headers: headers,
                body: options.body
            });
        } else {
            const headers = {
                'Authorization': GrafanaConfig.authHeader,
                'Accept': 'application/json'
            };
            
            if (options.headers) {
                Object.assign(headers, options.headers);
            }
            
            return fetch(GrafanaConfig.url + endpoint, {
                method: options.method || 'GET',
                headers: headers,
                body: options.body
            });
        }
    },

    // Make API requests with specific config
    async makeApiRequestWithConfig(config, endpoint, options = {}) {
        // Check if running in Electron
        if (window.electronAPI && window.electronAPI.grafanaRequest) {
            try {
                const requestOptions = {
                    grafanaUrl: config.url,
                    path: endpoint,
                    method: options.method || 'GET',
                    headers: {
                        'Authorization': config.authHeader,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        ...options.headers
                    },
                    body: options.body,
                    timeout: 30000,
                    proxyConfig: config.proxyConfig // Include proxy configuration if available
                };
                
                const response = await window.electronAPI.grafanaRequest(requestOptions);
                
                // Convert to fetch-like response
                return {
                    ok: response.status >= 200 && response.status < 300,
                    status: response.status,
                    statusText: response.statusText,
                    headers: {
                        get: (name) => response.headers[name.toLowerCase()]
                    },
                    json: async () => response.data,
                    text: async () => typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
                };
            } catch (error) {
                // Handle IPC errors and convert to fetch-like response
                const status = error.status || 500;
                return {
                    ok: false,
                    status: status,
                    statusText: error.statusText || error.message || 'Request failed',
                    headers: {
                        get: () => null
                    },
                    json: async () => ({ 
                        error: error.error || error.message,
                        message: error.statusText || error.message 
                    }),
                    text: async () => error.error || error.message || 'Request failed'
                };
            }
        }
        
        // Fallback to HTTP requests (for web-only mode)
        const isIntegratedProxy = window.location.pathname !== '/grafana-query-ide.html';
        
        if (isIntegratedProxy) {
            const headers = {
                'Authorization': config.authHeader,
                'X-Grafana-URL': config.url,
                'Accept': 'application/json'
            };
            
            
            // Add proxy configuration if available in config
            if (config.proxyConfig) {
                headers['X-Proxy-Config'] = JSON.stringify(config.proxyConfig);
            }
            
            if (options.headers) {
                Object.assign(headers, options.headers);
            }

            return fetch('/api' + endpoint.replace('/api', ''), {
                method: options.method || 'GET',
                headers: headers,
                body: options.body
            });
        } else {
            const headers = {
                'Authorization': config.authHeader,
                'Accept': 'application/json'
            };
            
            if (options.headers) {
                Object.assign(headers, options.headers);
            }
            
            return fetch(config.url + endpoint, {
                method: options.method || 'GET',
                headers: headers,
                body: options.body
            });
        }
    },

    // Check if running in container
    async checkIfRunningInContainer() {
        // Check if running in Electron instead
        if (window.electronAPI) {
            const tip = document.createElement('div');
            tip.style.cssText = 'margin-top: 5px; font-size: 12px; color: #4ade80; text-align: center;';
            tip.textContent = '✓ Running in Electron - Direct API access enabled';
            const connectionManagement = document.querySelector('.connection-management');
            if (connectionManagement) {
                connectionManagement.appendChild(tip);
            }
        }
    }
};