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
    },
    
    // Search for dashboards
    async searchDashboards(query) {
        console.log('Dashboard.searchDashboards called with query:', query);
        console.log('Called from:', new Error().stack);
        
        if (!query || query.trim().length < 2) {
            console.log('Query too short, clearing results');
            this.currentDashboards = [];
            this.renderDashboardResults();
            return;
        }
        
        // Check if connected to Grafana
        if (!GrafanaConfig.connected) {
            this.showError('Please connect to Grafana first');
            return;
        }
        
        try {
            console.log('Searching dashboards for:', query);
            
            // Try different search approaches
            let searchUrl;
            
            // First try the standard search API with query
            searchUrl = `/api/search?q=${encodeURIComponent(query)}&type=dash-db`;
            
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
            console.log('Dashboard search results:', results);
            
            // Filter results client-side if Grafana API didn't filter properly
            const filteredResults = results.filter(item => {
                // Ensure it's a dashboard and matches the search query
                const isMatch = item.type === 'dash-db' && 
                               (item.title.toLowerCase().includes(query.toLowerCase()) ||
                                (item.tags && item.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))) ||
                                (item.description && item.description.toLowerCase().includes(query.toLowerCase())));
                return isMatch;
            });
            
            console.log('Filtered dashboard results:', filteredResults.length, 'out of', results.length);
            
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
        // Don't trigger search on initialization
        console.log('Rendering dashboard UI');
        // Just render the initial empty state without calling search
        const container = document.getElementById('dashboardResults');
        if (container) {
            container.innerHTML = '<div class="empty-state">Search for dashboards to explore</div>';
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
            // Show different message based on whether user has searched
            const searchInput = document.getElementById('dashboardSearch');
            const hasSearched = searchInput && searchInput.value.trim().length >= 2;
            
            if (hasSearched) {
                html = '<div class="dashboard-empty">No dashboards found matching your search</div>';
            } else {
                html = '<div class="dashboard-empty">Search for dashboards to explore their queries</div>';
            }
        } else {
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
    }
};

// Global functions for HTML onclick handlers
function searchDashboards() {
    const searchInput = document.getElementById('dashboardSearch');
    if (!searchInput) {
        console.error('Dashboard search input not found');
        return;
    }
    
    const query = searchInput.value.trim();
    
    // Clear previous timeout
    if (Dashboard.searchTimeout) {
        clearTimeout(Dashboard.searchTimeout);
    }
    
    // Debounce search to avoid too many API calls
    Dashboard.searchTimeout = setTimeout(() => {
        Dashboard.searchDashboards(query);
    }, 500);
}

function clearDashboardSearch() {
    Dashboard.clearSearch();
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
            const dsName = typeof query.datasource === 'object' ? 
                (query.datasource.name || query.datasource.uid || 'Unknown') : 
                query.datasource;
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
        
        if (GrafanaConfig.queryEditor) {
            GrafanaConfig.queryEditor.setValue(query.query);
            GrafanaConfig.queryEditor.focus();
        }
        
        // Show success message
        console.log('Query copied to editor:', query.query);
        
    } catch (error) {
        console.error('Error copying query to editor:', error);
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
        
        // Copy query to editor first
        copyQueryToEditor(queryId);
        
        // Execute the query
        setTimeout(() => {
            if (typeof Queries !== 'undefined' && Queries.executeQuery) {
                Queries.executeQuery();
            } else if (typeof executeQuery === 'function') {
                executeQuery();
            } else {
                console.error('No executeQuery function found');
            }
        }, 100);
        
    } catch (error) {
        console.error('Error executing query from dashboard:', error);
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