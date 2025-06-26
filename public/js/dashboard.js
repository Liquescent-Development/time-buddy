const Dashboard = {
    // Dashboard state
    currentDashboards: [],
    selectedDashboard: null,
    searchTimeout: null,
    
    // Initialize dashboard explorer
    initialize() {
        this.renderDashboardUI();
    },
    
    // Search for dashboards
    async searchDashboards(query) {
        if (!query || query.trim().length < 2) {
            this.currentDashboards = [];
            this.renderDashboardResults();
            return;
        }
        
        try {
            console.log('Searching dashboards for:', query);
            
            const response = await API.makeApiRequest('/api/search', {
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
            
            // Filter results to only include dashboards that match the query
            this.currentDashboards = results.filter(item => 
                item.type === 'dash-db' && 
                item.title.toLowerCase().includes(query.toLowerCase())
            );
            
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
        this.renderDashboardResults();
    },
    
    // Render dashboard search results
    renderDashboardResults() {
        const container = document.getElementById('dashboardResults');
        if (!container) return;
        
        let html = '';
        
        if (this.currentDashboards.length === 0) {
            html = '<div class="dashboard-empty">Search for dashboards to explore their queries</div>';
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
        
        // Render tabs
        this.renderQueryTabs(queries);
    },
    
    // Render query tabs
    renderQueryTabs(queries) {
        const tabsHeader = document.getElementById('dashboardTabsHeader');
        const tabsContent = document.getElementById('dashboardTabsContent');
        
        if (!tabsHeader || !tabsContent) return;
        
        let headerHtml = '';
        let contentHtml = '';
        
        queries.forEach((query, index) => {
            const isActive = index === 0;
            const tabId = `tab-${query.id}`;
            
            // Tab header
            headerHtml += `<button class="dashboard-tab${isActive ? ' active' : ''}" onclick="showDashboardTab('${tabId}')" data-tab="${tabId}">`;
            headerHtml += `${Utils.escapeHtml(query.panelTitle)} (${query.refId})`;
            headerHtml += '</button>';
            
            // Tab content
            contentHtml += `<div class="dashboard-tab-content${isActive ? ' active' : ''}" id="${tabId}">`;
            contentHtml += '<div class="dashboard-query-info">';
            
            contentHtml += `<div class="dashboard-query-title">Query ${query.refId}: ${Utils.escapeHtml(query.panelTitle)}</div>`;
            
            if (query.datasource) {
                const dsName = typeof query.datasource === 'object' ? 
                    (query.datasource.name || query.datasource.uid || 'Unknown') : 
                    query.datasource;
                contentHtml += `<div class="dashboard-query-datasource">Data Source: ${Utils.escapeHtml(dsName)}</div>`;
            }
            
            contentHtml += `<div class="dashboard-query-expression">${Utils.escapeHtml(query.query)}</div>`;
            
            contentHtml += '<div class="dashboard-query-actions">';
            contentHtml += `<button class="secondary-button" onclick="copyQueryToEditor('${Utils.escapeHtml(JSON.stringify(query))}')">Copy to Editor</button>`;
            contentHtml += `<button class="secondary-button" onclick="executeQueryFromDashboard('${Utils.escapeHtml(JSON.stringify(query))}')">Execute Query</button>`;
            contentHtml += '</div>';
            
            contentHtml += '</div>';
            contentHtml += '</div>';
        });
        
        tabsHeader.innerHTML = headerHtml;
        tabsContent.innerHTML = contentHtml;
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

function showDashboardTab(tabId) {
    // Remove active class from all tabs and content
    document.querySelectorAll('.dashboard-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.dashboard-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Add active class to selected tab and content
    const selectedTab = document.querySelector(`[data-tab="${tabId}"]`);
    const selectedContent = document.getElementById(tabId);
    
    if (selectedTab) selectedTab.classList.add('active');
    if (selectedContent) selectedContent.classList.add('active');
}

function copyQueryToEditor(queryJson) {
    try {
        const query = JSON.parse(queryJson);
        
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

function executeQueryFromDashboard(queryJson) {
    try {
        const query = JSON.parse(queryJson);
        
        // Copy query to editor first
        copyQueryToEditor(queryJson);
        
        // Execute the query
        setTimeout(() => {
            Queries.executeQuery();
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