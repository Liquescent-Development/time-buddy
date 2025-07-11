/**
 * Demo Mode Module
 * Provides mock data setup for testing and demo purposes
 */

const Demo = {
    // Demo mode state
    enabled: false,
    
    // Initialize demo mode
    initialize() {
        // Check for demo mode parameter
        const urlParams = new URLSearchParams(window.location.search);
        const isDemoUrl = urlParams.get('demo') === 'true';
        const isDemoStored = localStorage.getItem('demoMode') === 'true';
        
        this.enabled = isDemoUrl || isDemoStored;
        
        if (this.enabled) {
            console.log('🎭 Demo mode enabled');
            
            // Only setup demo data if we're really in demo mode
            if (!isDemoStored && isDemoUrl) {
                // First time entering demo mode
                console.log('🎭 First time entering demo mode, backing up real data...');
                this.backupRealData();
                localStorage.setItem('demoMode', 'true');
            }
            
            this.setupDemoData();
            this.createDemoUI();
        } else {
            // Check if we have demo data contamination when not in demo mode
            const connections = localStorage.getItem('grafanaConnections');
            if (connections && connections.includes('demo-prod')) {
                console.warn('⚠️ Demo data detected in non-demo mode! Run cleanupDemoData() in console to fix.');
            }
        }
    },
    
    // Enable demo mode
    enable() {
        // First backup real data before enabling demo mode
        this.backupRealData();
        
        this.enabled = true;
        localStorage.setItem('demoMode', 'true');
        this.setupDemoData();
        console.log('🎭 Demo mode enabled');
        window.location.reload();
    },
    
    // Disable demo mode
    disable() {
        this.enabled = false;
        localStorage.removeItem('demoMode');
        
        // Restore real data from backup before demo mode was enabled
        this.restoreRealData();
        
        console.log('🎭 Demo mode disabled, real data restored');
        
        // Reload page to reset state
        window.location.reload();
    },
    
    // Backup real data before enabling demo mode
    backupRealData() {
        const realConnections = localStorage.getItem('grafanaConnections');
        if (realConnections && realConnections !== 'null') {
            localStorage.setItem('real_grafanaConnections', realConnections);
        }
        
        const realHistory = localStorage.getItem('queryHistory');
        if (realHistory && realHistory !== 'null') {
            localStorage.setItem('real_queryHistory', realHistory);
        }
        
        const realVariables = localStorage.getItem('queryVariables');
        if (realVariables && realVariables !== 'null') {
            localStorage.setItem('real_queryVariables', realVariables);
        }
        
        const realDirectory = localStorage.getItem('fileExplorerLastDirectory');
        if (realDirectory && realDirectory !== 'null') {
            localStorage.setItem('real_fileExplorerLastDirectory', realDirectory);
        }
        
        console.log('🎭 Real data backed up before demo mode');
    },
    
    // Restore real data when exiting demo mode
    restoreRealData() {
        // Remove demo data from active keys
        localStorage.removeItem('grafanaConnections');
        localStorage.removeItem('queryHistory');
        localStorage.removeItem('queryVariables');
        localStorage.removeItem('fileExplorerLastDirectory');
        localStorage.removeItem('demoMockFiles');
        localStorage.removeItem('demoTabs');
        
        // Restore real data from backup
        const realConnections = localStorage.getItem('real_grafanaConnections');
        if (realConnections) {
            localStorage.setItem('grafanaConnections', realConnections);
            localStorage.removeItem('real_grafanaConnections');
        }
        
        const realHistory = localStorage.getItem('real_queryHistory');
        if (realHistory) {
            localStorage.setItem('queryHistory', realHistory);
            localStorage.removeItem('real_queryHistory');
        }
        
        const realVariables = localStorage.getItem('real_queryVariables');
        if (realVariables) {
            localStorage.setItem('queryVariables', realVariables);
            localStorage.removeItem('real_queryVariables');
        }
        
        const realDirectory = localStorage.getItem('real_fileExplorerLastDirectory');
        if (realDirectory) {
            localStorage.setItem('fileExplorerLastDirectory', realDirectory);
            localStorage.removeItem('real_fileExplorerLastDirectory');
        }
        
        console.log('🎭 Real data restored from backup');
    },
    
    // Setup all demo data in localStorage
    setupDemoData() {
        // Double-check we're really in demo mode before writing anything
        if (!this.enabled && !window.location.search.includes('demo=true')) {
            console.warn('🛑 Attempted to setup demo data when not in demo mode!');
            return;
        }
        
        console.log('🎭 Setting up demo data in localStorage...');
        
        this.setupMockConnections();
        this.setupMockConfig();
        this.setupMockHistory();
        this.setupMockVariables();
        this.setupMockFileData();
        this.setupDemoTabs();
        
        console.log('🎭 Demo data setup complete');
    },
    
    // Setup mock connections
    setupMockConnections() {
        const demoConnections = {
            'demo-prod': {
                id: 'demo-prod',
                name: 'Production Grafana (Mock)',
                url: 'http://localhost:3000',
                username: 'demo-admin',
                defaultDataSource: {
                    uid: 'prometheus-prod',
                    name: 'Prometheus Production',
                    type: 'prometheus',
                    id: '1'
                }
            },
            'demo-staging': {
                id: 'demo-staging',
                name: 'Staging Environment (Mock)',
                url: 'http://localhost:3000',
                username: 'demo-user',
                defaultDataSource: {
                    uid: 'influxdb-staging',
                    name: 'InfluxDB Staging',
                    type: 'influxdb',
                    id: '2'
                }
            },
            'demo-dev': {
                id: 'demo-dev',
                name: 'Development Cluster (Mock)',
                url: 'http://localhost:3000',
                username: 'demo-dev'
            }
        };
        
        // NEVER write to real keys unless we're 100% sure we're in demo mode
        if (!this.enabled) {
            console.error('🛑 BLOCKED: Attempted to write demo connections when not in demo mode!');
            return;
        }
        
        // Store demo data
        localStorage.setItem('grafanaConnections', JSON.stringify(demoConnections));
    },
    
    // Setup mock Grafana config
    setupMockConfig() {
        const mockConfig = {
            url: 'http://localhost:3000',  // Use normal frontend server port
            username: 'demo-admin',
            connected: false,  // Will connect normally
            currentConnectionId: null,
            selectedDatasourceUid: null,
            selectedDatasourceType: null,
            selectedDatasourceId: null,
            currentDatasourceId: null,
            selectedDatasourceName: null,
            datasources: []
        };
        
        localStorage.setItem('grafanaConfig', JSON.stringify(mockConfig));
        console.log('🎭 Mock config setup - frontend will proxy to mock server');
    },
    
    // Setup mock query history
    setupMockHistory() {
        const mockHistory = [
            {
                id: 'hist-1',
                query: 'up{job="prometheus"}',
                queryType: 'promql',
                datasourceName: 'Prometheus Production',
                timestamp: Date.now() - 3600000,
                label: 'Check Prometheus Uptime',
                tags: ['monitoring', 'uptime'],
                favorite: true
            },
            {
                id: 'hist-2',
                query: 'SELECT mean("usage_user"), mean("usage_system") FROM "cpu" WHERE time > now() - 1h GROUP BY time(5m), "host"',
                queryType: 'influxql',
                datasourceName: 'InfluxDB Staging',
                timestamp: Date.now() - 5400000,
                label: 'CPU Usage by Host',
                tags: ['system', 'cpu', 'performance'],
                favorite: true
            },
            {
                id: 'hist-3',
                query: 'rate(http_requests_total[5m])',
                queryType: 'promql',
                datasourceName: 'Prometheus Production',
                timestamp: Date.now() - 7200000,
                label: 'HTTP Request Rate',
                tags: ['performance', 'web'],
                favorite: false
            },
            {
                id: 'hist-4',
                query: 'SELECT mean("used_percent") FROM "memory" WHERE "host" =~ /web-.*/ AND time > now() - 6h GROUP BY time(10m), "host"',
                queryType: 'influxql',
                datasourceName: 'InfluxDB Staging',
                timestamp: Date.now() - 10800000,
                label: 'Memory Usage for Web Servers',
                tags: ['memory', 'servers', 'web'],
                favorite: true
            },
            {
                id: 'hist-5',
                query: 'sum(rate(container_cpu_usage_seconds_total[5m])) by (container)',
                queryType: 'promql',
                datasourceName: 'Prometheus Production',
                timestamp: Date.now() - 14400000,
                label: 'Container CPU Usage by Container',
                tags: ['containers', 'cpu'],
                favorite: false
            },
            {
                id: 'hist-6',
                query: 'SELECT derivative(mean("read_bytes"), 1s) AS "read_rate", derivative(mean("write_bytes"), 1s) AS "write_rate" FROM "diskio" WHERE time > now() - 2h GROUP BY time(1m), "name"',
                queryType: 'influxql',
                datasourceName: 'InfluxDB Metrics',
                timestamp: Date.now() - 18000000,
                label: 'Disk I/O Rates by Device',
                tags: ['disk', 'io', 'performance'],
                favorite: false
            },
            {
                id: 'hist-7',
                query: 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))',
                queryType: 'promql',
                datasourceName: 'Prometheus Production',
                timestamp: Date.now() - 21600000,
                label: '95th Percentile Response Time',
                tags: ['performance', 'latency', 'http'],
                favorite: true
            },
            {
                id: 'hist-8',
                query: 'SELECT max("value") - min("value") AS "range" FROM "temperature" WHERE time > now() - 24h GROUP BY time(1h), "sensor"',
                queryType: 'influxql',
                datasourceName: 'InfluxDB Staging',
                timestamp: Date.now() - 25200000,
                label: 'Temperature Range by Sensor',
                tags: ['hardware', 'temperature', 'monitoring'],
                favorite: false
            }
        ];
        
        // NEVER write to real keys unless we're 100% sure we're in demo mode
        if (!this.enabled) {
            console.error('🛑 BLOCKED: Attempted to write demo history when not in demo mode!');
            return;
        }
        
        // Store demo data
        localStorage.setItem('queryHistory', JSON.stringify(mockHistory));
    },
    
    // Setup mock variables
    setupMockVariables() {
        const mockVariables = [
            {
                id: 'var-1',
                connectionId: 'demo-prod',
                name: 'instance',
                query: 'label_values(up, instance)',
                queryType: 'promql',
                datasourceUid: 'prometheus-prod',
                regex: '',
                multiValue: false,
                values: ['localhost:9090', 'web-server-01:8080', 'api-server-01:3000', 'db-server-01:5432'],
                selectedValues: ['web-server-01:8080']
            },
            {
                id: 'var-2',
                connectionId: 'demo-prod',
                name: 'job',
                query: 'label_values(job)',
                queryType: 'promql',
                datasourceUid: 'prometheus-prod',
                regex: '',
                multiValue: true,
                values: ['prometheus', 'node-exporter', 'cadvisor', 'grafana'],
                selectedValues: ['prometheus', 'node-exporter']
            },
            {
                id: 'var-3',
                connectionId: 'demo-staging',
                name: 'host',
                query: 'SHOW TAG VALUES FROM "cpu" WITH KEY = "host"',
                queryType: 'influxql',
                datasourceUid: 'influxdb-staging',
                regex: '(?P<text>[^.]+).*',
                multiValue: false,
                values: ['staging-web-01.company.com', 'staging-api-01.company.com', 'staging-db-01.company.com'],
                selectedValues: ['staging-web-01.company.com']
            }
        ];
        
        // NEVER write to real keys unless we're 100% sure we're in demo mode
        if (!this.enabled) {
            console.error('🛑 BLOCKED: Attempted to write demo variables when not in demo mode!');
            return;
        }
        
        // Store demo data
        localStorage.setItem('queryVariables', JSON.stringify(mockVariables));
    },
    
    // Setup mock file data
    setupMockFileData() {
        // NEVER write to real keys unless we're 100% sure we're in demo mode
        if (!this.enabled) {
            console.error('🛑 BLOCKED: Attempted to write demo directory when not in demo mode!');
            return;
        }
        
        // Store demo data
        localStorage.setItem('fileExplorerLastDirectory', '/Users/demo/queries');
        
        // Store mock file content in localStorage for demo mode
        const mockFiles = {
            'infrastructure-monitoring.promql': 'up{job="prometheus"}\n\n# Infrastructure monitoring query\n# Shows which services are currently up\n# Returns 1 for up, 0 for down',
            'cpu-analysis.promql': '100 - (avg(irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)\n\n# CPU usage analysis\n# Calculates average CPU utilization across all nodes\n# Subtracts idle time from 100%',
            'memory-usage.influxql': 'SELECT mean("used_percent") AS "avg_memory"\nFROM "memory"\nWHERE time > now() - 1h\nGROUP BY time(5m), "host"\nFILL(previous)\n\n-- Memory usage over time\n-- Shows average memory consumption by host',
            'disk-metrics.influxql': 'SELECT mean("used_percent") AS "disk_usage"\nFROM "disk"\nWHERE time > now() - 24h\nGROUP BY time(1h), "device", "host"\nORDER BY time DESC\n\n-- Disk usage by device and host',
            'network-analysis.influxql': 'SELECT derivative(mean("bytes_recv"), 1s) AS "rx_rate",\n       derivative(mean("bytes_sent"), 1s) AS "tx_rate"\nFROM "net"\nWHERE time > now() - 2h AND "interface" != \'lo\'\nGROUP BY time(1m), "host", "interface"\n\n-- Network traffic rates by interface',
            'performance-dashboard.promql': 'histogram_quantile(0.95,\n  sum(rate(http_request_duration_seconds_bucket[5m])) by (le)\n)\n\n# 95th percentile HTTP response time'
        };
        
        localStorage.setItem('demoMockFiles', JSON.stringify(mockFiles));
    },
    
    // Setup demo tabs data
    setupDemoTabs() {
        const demoTabs = [
            {
                id: 'demo-tab-1',
                label: 'Infrastructure Overview',
                queryType: 'promql',
                content: 'up{job="prometheus"}\n\n# Check Prometheus service uptime\n# Returns 1 if service is up, 0 if down\n# Useful for monitoring service availability',
                saved: false,
                filePath: null
            },
            {
                id: 'demo-tab-2', 
                label: 'CPU Analysis',
                queryType: 'promql',
                content: '100 - (avg(irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)\n\n# Calculate CPU usage percentage across all nodes\n# Subtracts idle time from 100% to get active usage\n# 5-minute rate for smooth metrics',
                saved: false,
                filePath: null
            },
            {
                id: 'demo-tab-3',
                label: 'Memory Usage (InfluxDB)',
                queryType: 'influxql', 
                content: 'SELECT mean("used_percent") AS "avg_memory"\nFROM "memory"\nWHERE time > now() - 1h\nGROUP BY time(5m), "host"\nFILL(previous)\n\n-- Average memory usage by host over last hour\n-- Grouped by 5-minute intervals with gap filling\n-- Useful for capacity planning',
                saved: false,
                filePath: null
            },
            {
                id: 'demo-tab-4',
                label: 'Disk I/O Analysis', 
                queryType: 'influxql',
                content: 'SELECT derivative(mean("read_bytes"), 1s) AS "read_rate",\n       derivative(mean("write_bytes"), 1s) AS "write_rate"\nFROM "diskio"\nWHERE time > now() - 2h\nGROUP BY time(1m), "name"\n\n-- Disk I/O rates by device name\n-- Shows read/write bytes per second\n-- 2-hour window with 1-minute resolution',
                saved: false,
                filePath: null
            },
            {
                id: 'demo-tab-5',
                label: 'HTTP Performance',
                queryType: 'promql',
                content: 'histogram_quantile(0.95,\n  sum(rate(http_request_duration_seconds_bucket[5m])) by (le)\n)\n\n# 95th percentile HTTP response time\n# Shows how long requests take for 95% of users\n# Critical SLA monitoring metric',
                saved: false,
                filePath: null
            }
        ];
        
        localStorage.setItem('demoTabs', JSON.stringify(demoTabs));
        console.log('🎭 Demo tabs data stored in localStorage');
    },
    
    // Create demo mode UI indicator
    createDemoUI() {
        // Add demo mode indicator to title bar
        const titleBarControls = document.querySelector('.title-bar-controls');
        if (titleBarControls && !titleBarControls.querySelector('.demo-indicator')) {
            const demoIndicator = document.createElement('span');
            demoIndicator.className = 'demo-indicator';
            demoIndicator.textContent = 'DEMO MODE';
            demoIndicator.title = 'Application is running in demo mode with mock data';
            demoIndicator.style.cssText = `
                font-size: 11px;
                color: #ff6b35;
                background-color: rgba(255, 107, 53, 0.15);
                padding: 2px 8px;
                border-radius: 3px;
                margin-left: 8px;
                font-weight: 500;
                border: 1px solid rgba(255, 107, 53, 0.4);
                animation: pulse 2s infinite;
            `;
            
            titleBarControls.insertBefore(demoIndicator, titleBarControls.firstChild);
            
            // Add pulse animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.7; }
                    100% { opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
    }
};

// Only auto-initialize demo mode if explicitly requested via URL
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.search.includes('demo=true')) {
        Demo.initialize();
    }
});

// Expose demo controls globally for console access
window.Demo = Demo;

// Global function to manually clean up demo data
window.cleanupDemoData = function() {
    console.log('🧹 Manually cleaning up demo data...');
    
    // Get current data
    const connections = localStorage.getItem('grafanaConnections');
    const history = localStorage.getItem('queryHistory'); 
    const variables = localStorage.getItem('queryVariables');
    const directory = localStorage.getItem('fileExplorerLastDirectory');
    
    // Check if current data looks like demo data
    const isDemoConnections = connections && connections.includes('demo-prod');
    const isDemoDirectory = directory && directory.includes('/Users/demo/');
    
    if (isDemoConnections || isDemoDirectory) {
        console.log('Demo data detected in localStorage, cleaning up...');
        
        // Try to restore from backup first
        const realConnections = localStorage.getItem('real_grafanaConnections');
        const realHistory = localStorage.getItem('real_queryHistory');
        const realVariables = localStorage.getItem('real_queryVariables');
        const realDirectory = localStorage.getItem('real_fileExplorerLastDirectory');
        
        // Clear demo data
        if (isDemoConnections) {
            localStorage.removeItem('grafanaConnections');
            if (realConnections) {
                localStorage.setItem('grafanaConnections', realConnections);
                console.log('✅ Restored real connections from backup');
            } else {
                console.log('❌ No backup found for connections, cleared demo data');
            }
        }
        
        if (isDemoDirectory) {
            localStorage.removeItem('fileExplorerLastDirectory');
            if (realDirectory) {
                localStorage.setItem('fileExplorerLastDirectory', realDirectory);
                console.log('✅ Restored real directory from backup');
            } else {
                console.log('❌ No backup found for directory, cleared demo data');
            }
        }
        
        // Clean up other demo data if needed
        if (realHistory) {
            localStorage.setItem('queryHistory', realHistory);
            console.log('✅ Restored real history from backup');
        }
        
        if (realVariables) {
            localStorage.setItem('queryVariables', realVariables);
            console.log('✅ Restored real variables from backup');
        }
        
        // Remove all demo-related keys
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('demo') || key.includes('demo'))) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log(`🗑️ Removed demo key: ${key}`);
        });
        
        // Remove backup keys after restore
        localStorage.removeItem('real_grafanaConnections');
        localStorage.removeItem('real_queryHistory');
        localStorage.removeItem('real_queryVariables');
        localStorage.removeItem('real_fileExplorerLastDirectory');
        
        console.log('✅ Demo data cleanup complete!');
        console.log('🔄 Please reload the page to see your real data');
        
        return true;
    } else {
        console.log('No demo data detected in localStorage');
        return false;
    }
};