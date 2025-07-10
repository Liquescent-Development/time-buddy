const Dashboard = {
    // Dashboard state
    currentDashboards: [],
    selectedDashboard: null,
    searchTimeout: null,
    initialized: false,
    
    // Initialize dashboard explorer
    initialize() {
        if (this.initialized) {
            console.log('Dashboard already initialized, skipping');
            return;
        }
        
        console.log('Initializing Dashboard module');
        this.initialized = true;
        this.renderDashboardUI();
        
        // Load all dashboards when connected
        if (GrafanaConfig.connected) {
            this.loadAllDashboards();
        }
    },
    
    // Load all dashboards
    async loadAllDashboards() {
        // Check if connected to Grafana
        if (!GrafanaConfig.connected) {
            this.showError('Please connect to Grafana first');
            return;
        }
        
        try {
            console.log('Loading all dashboards');
            
            // Get all dashboards without a search query
            const searchUrl = `/api/search?type=dash-db`;
            
            const response = await API.makeApiRequest(searchUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Dashboard loading failed: ' + response.statusText);
            }
            
            const results = await response.json();
            console.log('All dashboard results:', results.length);
            
            // Filter to ensure we only have dashboards
            const dashboards = results.filter(item => item.type === 'dash-db');
            
            // Store all dashboards
            this.allDashboards = dashboards;
            this.currentDashboards = dashboards;
            
            this.renderDashboardResults();
            
        } catch (error) {
            console.error('Error loading all dashboards:', error);
            this.showError('Failed to load dashboards: ' + error.message);
        }
    },
    
    // Search for dashboards
    async searchDashboards(query) {
        console.log('Dashboard.searchDashboards called with query:', query);
        
        if (!query || query.trim().length === 0) {
            // No search query - show all dashboards
            if (this.allDashboards) {
                this.currentDashboards = this.allDashboards;
            } else {
                await this.loadAllDashboards();
            }
            this.renderDashboardResults();
            return;
        }
        
        // Check if connected to Grafana
        if (!GrafanaConfig.connected) {
            this.showError('Please connect to Grafana first');
            return;
        }
        
        // Filter from all dashboards if we have them loaded
        if (this.allDashboards && this.allDashboards.length > 0) {
            // Client-side filtering from loaded dashboards
            const filteredResults = this.allDashboards.filter(item => {
                const searchTerm = query.toLowerCase();
                return item.title.toLowerCase().includes(searchTerm) ||
                       (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchTerm))) ||
                       (item.description && item.description.toLowerCase().includes(searchTerm));
            });
            
            console.log('Filtered dashboard results (client-side):', filteredResults.length, 'out of', this.allDashboards.length);
            this.currentDashboards = filteredResults;
            this.renderDashboardResults();
            return;
        }
        
        // Fallback to server-side search if we don't have all dashboards loaded
        try {
            console.log('Searching dashboards server-side for:', query);
            
            const searchUrl = `/api/search?q=${encodeURIComponent(query)}&type=dash-db`;
            
            const response = await API.makeApiRequest(searchUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Dashboard search failed: ' + response.statusText);
            }
            
            const results = await response.json();
            console.log('Dashboard search results (server-side):', results);
            
            // Filter results client-side if Grafana API didn't filter properly
            const filteredResults = results.filter(item => {
                // Ensure it's a dashboard and matches the search query
                const isMatch = item.type === 'dash-db' && 
                               (item.title.toLowerCase().includes(query.toLowerCase()) ||
                                (item.tags && item.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))) ||
                                (item.description && item.description.toLowerCase().includes(query.toLowerCase())));
                return isMatch;
            });
            
            console.log('Filtered dashboard results (server-side):', filteredResults.length, 'out of', results.length);
            
            // Store the filtered results
            this.currentDashboards = filteredResults;
            
            this.renderDashboardResults();
            
        } catch (error) {
            console.error('Error searching dashboards:', error);
            this.showError('Failed to search dashboards: ' + error.message);
        }
    },
    
    // Get dashboard by UID
    async getDashboardByUid(uid) {
        try {
            console.log('Fetching dashboard:', uid);
            
            const response = await API.makeApiRequest(`/api/dashboards/uid/${uid}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Dashboard fetch failed: ' + response.statusText);
            }
            
            const result = await response.json();
            console.log('Dashboard data:', result);
            
            return result.dashboard;
            
        } catch (error) {
            console.error('Error fetching dashboard:', error);
            this.showError('Failed to fetch dashboard: ' + error.message);
            return null;
        }
    },
    
    // Select a dashboard and load its queries
    async selectDashboard(dashboardItem) {
        try {
            // Mark as selected in UI
            document.querySelectorAll('.dashboard-item').forEach(item => {
                item.classList.remove('selected');
            });
            document.querySelector(`[data-dashboard-uid="${dashboardItem.uid}"]`).classList.add('selected');
            
            // Fetch full dashboard data
            const dashboard = await this.getDashboardByUid(dashboardItem.uid);
            if (!dashboard) return;
            
            this.selectedDashboard = dashboard;
            this.extractAndDisplayQueries(dashboard);
            
        } catch (error) {
            console.error('Error selecting dashboard:', error);
            this.showError('Failed to load dashboard queries: ' + error.message);
        }
    },
    
    // Extract queries from dashboard panels
    extractAndDisplayQueries(dashboard) {
        const queries = [];
        
        // Recursively extract queries from panels
        const extractFromPanels = (panels) => {
            if (!panels) return;
            
            panels.forEach((panel, panelIndex) => {
                if (panel.panels) {
                    // Row panel with sub-panels
                    extractFromPanels(panel.panels);
                } else if (panel.targets) {
                    // Regular panel with queries
                    panel.targets.forEach((target, targetIndex) => {
                        if (target.expr || target.query) {
                            queries.push({
                                id: `panel-${panelIndex}-target-${targetIndex}`,
                                panelTitle: panel.title || `Panel ${panelIndex + 1}`,
                                panelType: panel.type || 'unknown',
                                datasource: target.datasource,
                                query: target.expr || target.query || '',
                                refId: target.refId || 'A',
                                target: target
                            });
                        }
                    });
                }
            });
        };
        
        extractFromPanels(dashboard.panels);
        
        console.log('Extracted queries:', queries);
        this.renderDashboardQueries(dashboard, queries);
    },
    
    // Render dashboard UI
    renderDashboardUI() {
        // Initial render - results container is already in HTML
        console.log('Rendering dashboard UI');
        const container = document.getElementById('dashboardResults');
        if (container) {
            if (GrafanaConfig.connected) {
                // If connected, load all dashboards
                container.innerHTML = '<div class="loading">Loading dashboards...</div>';
                this.loadAllDashboards();
            } else {
                // If not connected, show connect message
                container.innerHTML = '<div class="empty-state">Connect to Grafana to explore dashboards</div>';
            }
        }
    },
    
    // Render dashboard search results
    renderDashboardResults() {
        const container = document.getElementById('dashboardResults');
        if (!container) {
            console.error('Dashboard results container not found');
            return;
        }
        
        let html = '';
        
        if (this.currentDashboards.length === 0) {
            // Show different message based on connection and search state
            const searchInput = document.getElementById('dashboardSearch');
            const hasSearched = searchInput && searchInput.value.trim().length > 0;
            
            if (!GrafanaConfig.connected) {
                html = '<div class="dashboard-empty">Connect to Grafana to explore dashboards</div>';
            } else if (hasSearched) {
                html = '<div class="dashboard-empty">No dashboards found matching your search</div>';
            } else {
                html = '<div class="dashboard-empty">No dashboards available</div>';
            }
        } else {
            // Show count of dashboards
            const searchInput = document.getElementById('dashboardSearch');
            const hasSearched = searchInput && searchInput.value.trim().length > 0;
            const countLabel = hasSearched ? 
                `${this.currentDashboards.length} dashboard${this.currentDashboards.length === 1 ? '' : 's'} found` :
                `${this.currentDashboards.length} dashboard${this.currentDashboards.length === 1 ? '' : 's'}`;
            
            html += `<div class="dashboard-count">${countLabel}</div>`;
            
            for (const dashboard of this.currentDashboards) {
                html += `<div class="dashboard-item" data-dashboard-uid="${dashboard.uid}" onclick="selectDashboard('${dashboard.uid}')">`;
                html += `<div class="dashboard-item-title">${Utils.escapeHtml(dashboard.title)}</div>`;
                if (dashboard.description) {
                    html += `<div class="dashboard-item-description">${Utils.escapeHtml(dashboard.description)}</div>`;
                }
                html += '</div>';
            }
        }
        
        container.innerHTML = html;
    },
    
    // Render dashboard queries in tabs
    renderDashboardQueries(dashboard, queries) {
        const dashboardQueries = document.getElementById('dashboardQueries');
        const dashboardResults = document.getElementById('dashboardResults');
        
        if (!dashboardQueries || !dashboardResults) return;
        
        // Show queries section, hide results
        dashboardQueries.classList.remove('hidden');
        dashboardResults.style.display = 'none';
        
        // Update dashboard info
        document.getElementById('selectedDashboardTitle').textContent = dashboard.title || 'Untitled Dashboard';
        document.getElementById('selectedDashboardDescription').textContent = dashboard.description || 'No description available';
        
        // Render query list
        this.renderQueryList(queries);
    },
    
    // Render query list
    renderQueryList(queries) {
        const queryList = document.getElementById('dashboardQueryList');
        
        if (!queryList) return;
        
        let listHtml = '';
        
        queries.forEach((query, index) => {
            listHtml += `<div class="query-list-item" onclick="showQueryPreview('${query.id}')" data-query-id="${query.id}">`;
            listHtml += `<div class="query-item-panel">${Utils.escapeHtml(query.panelTitle)}</div>`;
            listHtml += `<div class="query-item-ref">Query ${query.refId}</div>`;
            listHtml += '</div>';
        });
        
        queryList.innerHTML = listHtml;
        
        // Store queries for preview
        this.currentQueries = queries;
        
        // Auto-select first query
        if (queries.length > 0) {
            setTimeout(() => {
                showQueryPreview(queries[0].id);
            }, 100);
        }
    },
    
    // Show error message
    showError(message) {
        const container = document.getElementById('dashboardResults');
        if (container) {
            container.innerHTML = `<div class="dashboard-empty" style="color: #f87171;">${Utils.escapeHtml(message)}</div>`;
        }
    },
    
    // Clear search
    clearSearch() {
        document.getElementById('dashboardSearch').value = '';
        this.currentDashboards = [];
        this.selectedDashboard = null;
        
        // Hide queries section, show results
        const dashboardQueries = document.getElementById('dashboardQueries');
        const dashboardResults = document.getElementById('dashboardResults');
        
        if (dashboardQueries) {
            dashboardQueries.classList.add('hidden');
        }
        
        if (dashboardResults) {
            dashboardResults.style.display = '';
        }
        
        this.renderDashboardResults();
    },
    
    // Helper function to resolve datasource UID to name
    resolveDatasourceName(datasource) {
        if (!datasource) return 'Unknown';
        
        // If it's already an object, check if it has a name, otherwise look up by uid
        if (typeof datasource === 'object') {
            if (datasource.name) {
                return datasource.name;
            }
            // If object has uid but no name, look up the name
            if (datasource.uid) {
                return this.lookupDatasourceNameByUid(datasource.uid);
            }
            return datasource.uid || 'Unknown';
        }
        
        // If it's a string (UID), look it up in the available datasources
        if (typeof datasource === 'string') {
            return this.lookupDatasourceNameByUid(datasource);
        }
        
        return 'Unknown';
    },
    
    // Helper method to look up datasource name by UID
    lookupDatasourceNameByUid(uid) {
        // Try to find the datasource in the global config
        if (GrafanaConfig.datasources && GrafanaConfig.datasources.length > 0) {
            const ds = GrafanaConfig.datasources.find(d => d.uid === uid);
            if (ds) {
                return ds.name;
            }
        }
        
        // Try to find it in the DOM elements
        const datasourceItem = document.querySelector(`[data-uid="${uid}"]`);
        if (datasourceItem && datasourceItem.dataset.name) {
            return datasourceItem.dataset.name;
        }
        
        // Fallback to the UID itself
        return uid;
    }
};

// Ensure Dashboard is available globally
window.Dashboard = Dashboard;

// Global functions for HTML onclick handlers
function searchDashboards() {
    const searchInput = document.getElementById('dashboardSearch');
    if (!searchInput) {
        console.error('Dashboard search input not found');
        return;
    }
    
    const query = searchInput.value.trim();
    
    // Ensure Dashboard object is available
    const dashboardObj = (typeof Dashboard !== 'undefined' && Dashboard) ? Dashboard : window.Dashboard;
    if (!dashboardObj) {
        console.error('Dashboard object not available in searchDashboards');
        return;
    }
    
    // Clear previous timeout
    if (dashboardObj.searchTimeout) {
        clearTimeout(dashboardObj.searchTimeout);
    }
    
    // Debounce search to avoid too many API calls
    dashboardObj.searchTimeout = setTimeout(() => {
        if (dashboardObj && dashboardObj.searchDashboards) {
            dashboardObj.searchDashboards(query);
        } else {
            console.error('Dashboard.searchDashboards not available');
        }
    }, 300);
}

function clearDashboardSearch() {
    const dashboardObj = (typeof Dashboard !== 'undefined' && Dashboard) ? Dashboard : window.Dashboard;
    if (dashboardObj && dashboardObj.clearSearch) {
        dashboardObj.clearSearch();
    } else {
        console.error('Dashboard.clearSearch not available');
    }
}

function selectDashboard(uid) {
    const dashboardItem = Dashboard.currentDashboards.find(d => d.uid === uid);
    if (dashboardItem) {
        Dashboard.selectDashboard(dashboardItem);
    }
}

function showQueryPreview(queryId) {
    // Remove active class from all query list items
    document.querySelectorAll('.query-list-item').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Add active class to selected query
    const selectedItem = document.querySelector(`[data-query-id="${queryId}"]`);
    if (selectedItem) {
        selectedItem.classList.add('selected');
    }
    
    // Find the query data
    const query = Dashboard.currentQueries ? Dashboard.currentQueries.find(q => q.id === queryId) : null;
    
    if (!query) return;
    
    // Show preview section
    const previewSection = document.getElementById('dashboardQueryPreview');
    const previewContent = document.getElementById('queryPreviewContent');
    
    if (previewSection && previewContent) {
        previewSection.classList.remove('hidden');
        
        // Build preview content
        let html = '<div class="dashboard-query-info">';
        
        html += `<div class="dashboard-query-title">Query ${query.refId}: ${Utils.escapeHtml(query.panelTitle)}</div>`;
        
        if (query.datasource) {
            const dsName = Dashboard.resolveDatasourceName(query.datasource);
            html += `<div class="dashboard-query-datasource">Data Source: ${Utils.escapeHtml(dsName)}</div>`;
        }
        
        html += `<div class="dashboard-query-expression">${Utils.escapeHtml(query.query)}</div>`;
        
        html += '<div class="dashboard-query-actions">';
        html += `<button class="secondary-button" onclick="copyQueryToEditor('${query.id}')">Copy to Editor</button>`;
        html += `<button class="secondary-button" onclick="executeQueryFromDashboard('${query.id}')">Execute Query</button>`;
        html += '</div>';
        
        html += '</div>';
        
        previewContent.innerHTML = html;
    }
}

function copyQueryToEditor(queryId) {
    try {
        // Find the query by ID
        const query = Dashboard.currentQueries ? Dashboard.currentQueries.find(q => q.id === queryId) : null;
        
        if (!query) {
            console.error('Query not found with ID:', queryId);
            return;
        }
        
        // Create a new tab for this query
        const newTabId = Interface.createNewTab();
        
        // Wait for tab to be fully created, then set the query and datasource
        setTimeout(() => {
            console.log('copyQueryToEditor: Processing query:', query);
            console.log('copyQueryToEditor: Query datasource:', query.datasource);
            
            // Get the tab data and set the query
            const tabData = Interface.tabs.get(newTabId);
            if (tabData && tabData.editor) {
                tabData.editor.setValue(query.query);
                tabData.editor.focus();
            }
            
            // Set the datasource for this tab if available
            if (query.datasource) {
                const datasourceUid = typeof query.datasource === 'object' ? query.datasource.uid : query.datasource;
                console.log('copyQueryToEditor: Datasource UID:', datasourceUid);
                if (datasourceUid) {
                    console.log('copyQueryToEditor: Calling setTabDatasource with:', newTabId, datasourceUid);
                    Interface.setTabDatasource(newTabId, datasourceUid);
                    
                    // Force execute button update after datasource is set
                    setTimeout(() => {
                        console.log('copyQueryToEditor: Force calling updateExecuteButton');
                        Interface.updateExecuteButton(newTabId);
                    }, 100);
                } else {
                    console.log('copyQueryToEditor: No valid datasource UID found');
                }
            } else {
                console.log('copyQueryToEditor: No datasource found in query');
            }
            
            // Show success message
            console.log('Query copied to new tab:', query.query);
            Interface.showToast('Query copied to new tab', 'success');
        }, 200);
        
    } catch (error) {
        console.error('Error copying query to editor:', error);
        Interface.showToast('Error copying query to editor', 'error');
    }
}

function executeQueryFromDashboard(queryId) {
    try {
        // Find the query by ID
        const query = Dashboard.currentQueries ? Dashboard.currentQueries.find(q => q.id === queryId) : null;
        
        if (!query) {
            console.error('Query not found with ID:', queryId);
            return;
        }
        
        // Create a new tab for this query
        const newTabId = Interface.createNewTab();
        
        // Wait for tab to be fully created, then set the query, datasource, and execute
        setTimeout(() => {
            // Get the tab data and set the query
            const tabData = Interface.tabs.get(newTabId);
            if (tabData && tabData.editor) {
                tabData.editor.setValue(query.query);
            }
            
            // Set the datasource for this tab if available
            if (query.datasource) {
                const datasourceUid = typeof query.datasource === 'object' ? query.datasource.uid : query.datasource;
                if (datasourceUid) {
                    Interface.setTabDatasource(newTabId, datasourceUid);
                    
                    // Force execute button update and then execute query
                    setTimeout(() => {
                        Interface.updateExecuteButton(newTabId);
                        
                        // Execute the query after ensuring button is enabled
                        setTimeout(() => {
                            Interface.executeQuery(newTabId);
                        }, 50);
                    }, 100);
                }
            }
            
            // Show success message
            console.log('Query executed in new tab:', query.query);
            Interface.showToast('Query executed in new tab', 'success');
        }, 200);
        
    } catch (error) {
        console.error('Error executing query from dashboard:', error);
        Interface.showToast('Error executing query from dashboard', 'error');
    }
}

function toggleDashboardExplorer() {
    const dashboardSection = document.getElementById('dashboardSection');
    const toggleButton = document.querySelector('.dashboard-toggle');
    
    if (dashboardSection.classList.contains('collapsed')) {
        dashboardSection.classList.remove('collapsed');
        toggleButton.textContent = 'Hide';
    } else {
        dashboardSection.classList.add('collapsed');
        toggleButton.textContent = 'Show';
    }
}