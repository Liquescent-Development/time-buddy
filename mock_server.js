/**
 * Mock Grafana Server for Demo Mode
 * Simulates Grafana API responses for testing and demo purposes
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({
    contentSecurityPolicy: false // Disable CSP for development
}));
app.use(compression());
app.use(morgan('combined'));
app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(express.json());

// Mock data generators
const MockData = {
    // Generate realistic Prometheus time series data
    generatePrometheusData(query, start, end, step) {
        const now = Math.floor(Date.now() / 1000);
        const startTime = start || (now - 3600); // Default 1 hour ago
        const endTime = end || now;
        const stepSeconds = step || 60; // Default 1 minute steps
        
        const points = [];
        for (let time = startTime; time <= endTime; time += stepSeconds) {
            if (query.includes('up')) {
                points.push([time, Math.random() > 0.1 ? '1' : '0']);
            } else if (query.includes('cpu') || query.includes('node_cpu_seconds_total')) {
                points.push([time, (20 + Math.random() * 60).toFixed(2)]);
            } else if (query.includes('memory') || query.includes('node_memory')) {
                points.push([time, (4000000000 + Math.random() * 2000000000).toFixed(0)]);
            } else if (query.includes('http_request')) {
                points.push([time, (100 + Math.random() * 500).toFixed(2)]);
            } else {
                points.push([time, (Math.random() * 100).toFixed(2)]);
            }
        }
        return points;
    },

    // Generate realistic InfluxDB data
    generateInfluxData(query) {
        const values = [];
        const now = new Date();
        
        for (let i = 19; i >= 0; i--) {
            const timestamp = new Date(now.getTime() - i * 60000).toISOString();
            
            if (query.includes('cpu')) {
                values.push([timestamp, (20 + Math.random() * 60).toFixed(2), (10 + Math.random() * 30).toFixed(2)]);
            } else if (query.includes('memory')) {
                values.push([timestamp, (50 + Math.random() * 40).toFixed(2)]);
            } else if (query.includes('disk')) {
                values.push([timestamp, (60 + Math.random() * 30).toFixed(2)]);
            } else if (query.includes('diskio')) {
                values.push([timestamp, (1000 + Math.random() * 5000).toFixed(0), (500 + Math.random() * 2000).toFixed(0)]);
            } else if (query.includes('net')) {
                values.push([timestamp, (10000 + Math.random() * 50000).toFixed(0), (5000 + Math.random() * 25000).toFixed(0)]);
            } else {
                values.push([timestamp, (Math.random() * 100).toFixed(2)]);
            }
        }
        
        return values;
    }
};

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', mode: 'mock', timestamp: new Date().toISOString() });
});

// Mock Grafana API endpoints

// User authentication
app.get('/api/user', (req, res) => {
    res.json({
        id: 1,
        name: 'Demo User',
        login: 'demo-admin',
        email: 'demo@example.com',
        isGrafanaAdmin: true,
        theme: 'dark'
    });
});

// Data sources
app.get('/api/datasources', (req, res) => {
    res.json([
        {
            id: 1,
            uid: 'prometheus-prod',
            name: 'Prometheus Production',
            type: 'prometheus',
            url: 'http://prometheus:9090',
            access: 'proxy',
            isDefault: true
        },
        {
            id: 2,
            uid: 'influxdb-staging',
            name: 'InfluxDB Staging',
            type: 'influxdb',
            url: 'http://influxdb:8086',
            access: 'proxy',
            database: 'telegraf'
        },
        {
            id: 3,
            uid: 'prometheus-alerts',
            name: 'Prometheus Alerts',
            type: 'prometheus',
            url: 'http://prometheus-alerts:9090',
            access: 'proxy'
        },
        {
            id: 4,
            uid: 'influxdb-metrics',
            name: 'InfluxDB Metrics',
            type: 'influxdb',
            url: 'http://influxdb-metrics:8086',
            access: 'proxy',
            database: 'metrics'
        },
        {
            id: 5,
            uid: 'loki-logs',
            name: 'Loki Logs',
            type: 'loki',
            url: 'http://loki:3100',
            access: 'proxy'
        }
    ]);
});

// Dashboard search
app.get('/api/search', (req, res) => {
    res.json([
        {
            id: 1,
            uid: 'demo-dash-1',
            title: 'Infrastructure Overview',
            type: 'dash-db',
            tags: ['infrastructure', 'overview'],
            url: '/d/demo-dash-1/infrastructure-overview'
        },
        {
            id: 2,
            uid: 'demo-dash-2',
            title: 'Application Performance',
            type: 'dash-db',
            tags: ['application', 'performance'],
            url: '/d/demo-dash-2/application-performance'
        },
        {
            id: 3,
            uid: 'demo-dash-3',
            title: 'Database Metrics',
            type: 'dash-db',
            tags: ['database', 'monitoring'],
            url: '/d/demo-dash-3/database-metrics'
        },
        {
            id: 4,
            uid: 'demo-dash-4',
            title: 'Network Analytics',
            type: 'dash-db',
            tags: ['network', 'analytics'],
            url: '/d/demo-dash-4/network-analytics'
        }
    ]);
});

// Dashboard details
app.get('/api/dashboards/uid/:uid', (req, res) => {
    res.json({
        dashboard: {
            id: 1,
            uid: req.params.uid,
            title: 'Infrastructure Overview',
            panels: [
                {
                    id: 1,
                    title: 'CPU Usage',
                    type: 'graph',
                    datasource: { uid: 'prometheus-prod' },
                    targets: [
                        {
                            refId: 'A',
                            expr: '100 - (avg(irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'
                        }
                    ]
                },
                {
                    id: 2,
                    title: 'Memory Usage',
                    type: 'graph',
                    datasource: { uid: 'prometheus-prod' },
                    targets: [
                        {
                            refId: 'B',
                            expr: '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100'
                        }
                    ]
                },
                {
                    id: 3,
                    title: 'Disk I/O',
                    type: 'graph',
                    datasource: { uid: 'influxdb-staging' },
                    targets: [
                        {
                            refId: 'C',
                            rawSql: 'SELECT mean("read_bytes"), mean("write_bytes") FROM "diskio" WHERE time > now() - 1h GROUP BY time(5m)'
                        }
                    ]
                }
            ]
        }
    });
});

// Prometheus API proxy endpoints
app.get('/api/datasources/proxy/:id/api/v1/label/__name__/values', (req, res) => {
    res.json({
        status: 'success',
        data: [
            'up',
            'http_requests_total',
            'http_request_duration_seconds',
            'http_request_duration_seconds_bucket',
            'http_request_duration_seconds_count',
            'http_request_duration_seconds_sum',
            'node_cpu_seconds_total',
            'node_memory_MemTotal_bytes',
            'node_memory_MemAvailable_bytes',
            'node_memory_MemFree_bytes',
            'node_disk_read_bytes_total',
            'node_disk_written_bytes_total',
            'node_filesystem_size_bytes',
            'node_filesystem_avail_bytes',
            'node_network_receive_bytes_total',
            'node_network_transmit_bytes_total',
            'container_cpu_usage_seconds_total',
            'container_memory_usage_bytes',
            'container_memory_limit_bytes',
            'prometheus_tsdb_head_samples_appended_total',
            'prometheus_tsdb_head_series',
            'grafana_api_user_signups_started_total'
        ]
    });
});

app.get('/api/datasources/proxy/:id/api/v1/label/:labelName/values', (req, res) => {
    const labelName = req.params.labelName;
    
    const mockLabelValues = {
        'instance': ['localhost:9090', 'web-server-01:8080', 'api-server-01:3000', 'db-server-01:5432', 'prometheus:9090'],
        'job': ['prometheus', 'node-exporter', 'cadvisor', 'grafana', 'api-service', 'web-service'],
        'method': ['GET', 'POST', 'PUT', 'DELETE'],
        'status': ['200', '201', '400', '401', '403', '404', '500', '502', '503'],
        'mode': ['idle', 'user', 'system', 'iowait', 'irq', 'softirq'],
        'device': ['sda', 'sdb', 'nvme0n1', 'nvme1n1'],
        'fstype': ['ext4', 'xfs', 'tmpfs'],
        'mountpoint': ['/', '/var', '/tmp', '/home', '/boot']
    };
    
    res.json({
        status: 'success',
        data: mockLabelValues[labelName] || ['value1', 'value2', 'value3']
    });
});

app.get('/api/datasources/proxy/:id/api/v1/query', (req, res) => {
    const query = req.query.query || '';
    const time = req.query.time ? parseInt(req.query.time) : Math.floor(Date.now() / 1000);
    
    console.log('Prometheus query:', query);
    
    let mockResult = [];
    
    if (query.includes('up')) {
        mockResult = [
            {
                metric: { __name__: 'up', job: 'prometheus', instance: 'localhost:9090' },
                value: [time, '1']
            },
            {
                metric: { __name__: 'up', job: 'node-exporter', instance: 'web-server-01:9100' },
                value: [time, '1']
            },
            {
                metric: { __name__: 'up', job: 'grafana', instance: 'grafana:3000' },
                value: [time, Math.random() > 0.1 ? '1' : '0']
            }
        ];
    } else if (query.includes('cpu') || query.includes('node_cpu_seconds_total')) {
        mockResult = [
            {
                metric: { __name__: 'node_cpu_seconds_total', mode: 'idle', instance: 'web-server-01:9100' },
                value: [time, (15 + Math.random() * 10).toFixed(2)]
            },
            {
                metric: { __name__: 'node_cpu_seconds_total', mode: 'user', instance: 'web-server-01:9100' },
                value: [time, (60 + Math.random() * 20).toFixed(2)]
            }
        ];
    } else {
        mockResult = [
            {
                metric: { __name__: 'demo_metric', job: 'demo-service', instance: 'demo-host:8080' },
                value: [time, (Math.random() * 100).toFixed(2)]
            }
        ];
    }
    
    res.json({
        status: 'success',
        data: {
            resultType: 'vector',
            result: mockResult
        }
    });
});

app.get('/api/datasources/proxy/:id/api/v1/query_range', (req, res) => {
    const query = req.query.query || '';
    const start = parseInt(req.query.start) || (Math.floor(Date.now() / 1000) - 3600);
    const end = parseInt(req.query.end) || Math.floor(Date.now() / 1000);
    const step = parseInt(req.query.step) || 60;
    
    console.log('Prometheus range query:', query);
    
    let mockResult = [];
    
    if (query.includes('up')) {
        mockResult = [
            {
                metric: { __name__: 'up', job: 'prometheus', instance: 'localhost:9090' },
                values: MockData.generatePrometheusData(query, start, end, step)
            },
            {
                metric: { __name__: 'up', job: 'node-exporter', instance: 'web-server-01:9100' },
                values: MockData.generatePrometheusData(query, start, end, step)
            }
        ];
    } else if (query.includes('cpu') || query.includes('node_cpu_seconds_total')) {
        mockResult = [
            {
                metric: { __name__: 'node_cpu_seconds_total', mode: 'idle', instance: 'web-server-01:9100' },
                values: MockData.generatePrometheusData(query, start, end, step)
            },
            {
                metric: { __name__: 'node_cpu_seconds_total', mode: 'user', instance: 'web-server-01:9100' },
                values: MockData.generatePrometheusData(query, start, end, step)
            }
        ];
    } else {
        mockResult = [
            {
                metric: { __name__: 'demo_metric', job: 'demo-service', instance: 'demo-host:8080' },
                values: MockData.generatePrometheusData(query, start, end, step)
            }
        ];
    }
    
    res.json({
        status: 'success',
        data: {
            resultType: 'matrix',
            result: mockResult
        }
    });
});

// Main query endpoint used by the application
app.post('/api/ds/query', (req, res) => {
    const { queries, from, to } = req.body;
    const dsType = req.query.ds_type;
    const requestId = req.query.requestId;
    
    console.log('🎭 Mock query execution:', {
        dsType,
        requestId,
        queriesCount: queries?.length,
        timeRange: { from, to }
    });
    
    if (!queries || queries.length === 0) {
        return res.status(400).json({ error: 'No queries provided' });
    }
    
    const results = [];
    
    queries.forEach((queryItem, index) => {
        const { datasource, expr, query, refId } = queryItem;
        const actualQuery = expr || query || '';
        
        console.log(`Processing query ${index + 1}:`, {
            refId: refId || 'Unknown',
            datasourceType: datasource?.type,
            datasourceUid: datasource?.uid,
            query: actualQuery
        });
        
        // Determine if this is a Prometheus query by examining the query content
        const isPrometheusQuery = actualQuery.includes('histogram_quantile') || 
                                 actualQuery.includes('rate(') || 
                                 actualQuery.includes('irate(') ||
                                 actualQuery.includes('increase(') ||
                                 actualQuery.includes('sum(') ||
                                 actualQuery.includes('avg(') ||
                                 actualQuery.includes('max(') ||
                                 actualQuery.includes('min(') ||
                                 actualQuery.includes('count(') ||
                                 actualQuery.includes('up{') ||
                                 actualQuery.includes('node_') ||
                                 actualQuery.includes('{job=') ||
                                 actualQuery.includes('[5m]') ||
                                 actualQuery.includes('[1m]') ||
                                 actualQuery.includes('[15m]') ||
                                 (datasource?.type === 'prometheus' || dsType === 'prometheus');
                                 
        // Determine if this is an InfluxDB query
        const isInfluxQuery = actualQuery.toUpperCase().includes('SELECT') ||
                             actualQuery.toUpperCase().includes('SHOW') ||
                             actualQuery.toUpperCase().includes('FROM') ||
                             actualQuery.toUpperCase().includes('WHERE') ||
                             actualQuery.toUpperCase().includes('GROUP BY') ||
                             (datasource?.type === 'influxdb' || dsType === 'influxdb');
        
        if (isPrometheusQuery && !isInfluxQuery) {
            // Generate Prometheus-style response
            const now = Math.floor(Date.now() / 1000);
            const startTime = from ? Math.floor(parseInt(from) / 1000) : (now - 3600);
            const endTime = to ? Math.floor(parseInt(to) / 1000) : now;
            
            let series = [];
            
            if (actualQuery.includes('up')) {
                series = [
                    {
                        metric: { __name__: 'up', job: 'prometheus', instance: 'localhost:9090' },
                        values: MockData.generatePrometheusData(actualQuery, startTime, endTime, 60)
                    },
                    {
                        metric: { __name__: 'up', job: 'node-exporter', instance: 'web-server-01:9100' },
                        values: MockData.generatePrometheusData(actualQuery, startTime, endTime, 60)
                    }
                ];
            } else if (actualQuery.includes('cpu') || actualQuery.includes('node_cpu_seconds_total')) {
                series = [
                    {
                        metric: { 
                            __name__: 'node_cpu_seconds_total', 
                            mode: 'idle', 
                            instance: 'web-server-01:9100',
                            job: 'node-exporter'
                        },
                        values: MockData.generatePrometheusData(actualQuery, startTime, endTime, 60)
                    },
                    {
                        metric: { 
                            __name__: 'node_cpu_seconds_total', 
                            mode: 'user', 
                            instance: 'web-server-01:9100',
                            job: 'node-exporter'
                        },
                        values: MockData.generatePrometheusData(actualQuery, startTime, endTime, 60)
                    }
                ];
            } else if (actualQuery.includes('memory') || actualQuery.includes('node_memory')) {
                series = [
                    {
                        metric: { 
                            __name__: 'node_memory_MemTotal_bytes', 
                            instance: 'web-server-01:9100',
                            job: 'node-exporter'
                        },
                        values: MockData.generatePrometheusData(actualQuery, startTime, endTime, 60)
                    },
                    {
                        metric: { 
                            __name__: 'node_memory_MemAvailable_bytes', 
                            instance: 'web-server-01:9100',
                            job: 'node-exporter'
                        },
                        values: MockData.generatePrometheusData(actualQuery, startTime, endTime, 60)
                    }
                ];
            } else {
                // Default response for unknown queries
                series = [
                    {
                        metric: { 
                            __name__: 'demo_metric', 
                            job: 'demo-service', 
                            instance: 'demo-host:8080' 
                        },
                        values: MockData.generatePrometheusData(actualQuery, startTime, endTime, 60)
                    }
                ];
            }
            
            // Convert series to frames format expected by frontend
            const frames = series.map((serie, index) => {
                const timeValues = serie.values.map(v => new Date(v[0] * 1000).toISOString());
                const dataValues = serie.values.map(v => parseFloat(v[1]));
                
                return {
                    schema: {
                        refId: refId || 'A',
                        fields: [
                            { name: 'time', type: 'time' },
                            { name: serie.metric.__name__ || 'value', type: 'number' }
                        ]
                    },
                    data: {
                        values: [timeValues, dataValues]
                    },
                    meta: serie.metric
                };
            });
            
            results.push({
                refId: refId || 'A',
                frames: frames,
                meta: {
                    type: 'timeseries',
                    typeVersion: [0, 1],
                    custom: {
                        resultType: 'matrix'
                    }
                }
            });
            
        } else if (isInfluxQuery || (datasource?.type === 'influxdb' || dsType === 'influxdb')) {
            // Generate InfluxDB-style response
            const values = MockData.generateInfluxData(actualQuery);
            
            let series = [];
            if (actualQuery.toLowerCase().includes('cpu')) {
                series = [{
                    name: 'cpu',
                    tags: { host: 'web-server-01', cpu: 'cpu-total' },
                    columns: ['time', 'mean_usage_user', 'mean_usage_system'],
                    values: values
                }];
            } else if (actualQuery.toLowerCase().includes('memory')) {
                series = [{
                    name: 'memory',
                    tags: { host: 'web-server-01' },
                    columns: ['time', 'mean_used_percent'],
                    values: values
                }];
            } else if (actualQuery.toLowerCase().includes('disk')) {
                series = [{
                    name: 'disk',
                    tags: { host: 'web-server-01', device: 'sda1' },
                    columns: ['time', 'mean_used_percent'],
                    values: values
                }];
            } else {
                series = [{
                    name: 'demo_measurement',
                    tags: { host: 'demo-host' },
                    columns: ['time', 'value'],
                    values: values
                }];
            }
            
            // Convert series to frames format expected by frontend
            const frames = series.map((serie, index) => {
                // InfluxDB format: values are arrays like [timestamp, value1, value2, ...]
                const timeValues = serie.values.map(v => v[0]); // First column is time
                const dataColumns = [];
                
                // Create data columns for each field (skip time column)
                for (let i = 1; i < serie.columns.length; i++) {
                    const columnName = serie.columns[i];
                    const columnValues = serie.values.map(v => parseFloat(v[i]) || 0);
                    dataColumns.push({
                        name: columnName,
                        values: columnValues
                    });
                }
                
                const fields = [
                    { name: 'time', type: 'time' },
                    ...dataColumns.map(col => ({ name: col.name, type: 'number' }))
                ];
                
                const values = [
                    timeValues,
                    ...dataColumns.map(col => col.values)
                ];
                
                return {
                    schema: {
                        refId: refId || 'A',
                        fields: fields
                    },
                    data: {
                        values: values
                    },
                    meta: { tags: serie.tags || {}, name: serie.name }
                };
            });
            
            results.push({
                refId: refId || 'A',
                frames: frames,
                meta: {
                    type: 'timeseries',
                    typeVersion: [0, 1]
                }
            });
        } else {
            // Default/unknown datasource type
            results.push({
                refId: refId || 'A',
                frames: [{
                    schema: {
                        refId: refId || 'A',
                        fields: [
                            { name: 'time', type: 'time' },
                            { name: 'value', type: 'number' }
                        ]
                    },
                    data: {
                        values: [[], []]
                    },
                    meta: {}
                }],
                meta: {
                    type: 'timeseries',
                    typeVersion: [0, 1]
                }
            });
        }
    });
    
    console.log(`🎭 Returning ${results.length} result(s) for ${queries.length} query(ies)`);
    
    // Transform results to match expected format (results.A, results.B, etc.)
    const transformedResults = {};
    results.forEach(result => {
        transformedResults[result.refId] = result;
    });
    
    console.log('🎭 Transformed results:', Object.keys(transformedResults));
    
    res.json({
        results: transformedResults
    });
});

// InfluxDB API proxy endpoints
app.get('/api/datasources/proxy/:id/query', (req, res) => {
    const query = req.query.q || '';
    console.log('InfluxDB query:', query);
    
    if (query.includes('SHOW MEASUREMENTS')) {
        res.json({
            results: [{
                series: [{
                    name: 'measurements',
                    columns: ['name'],
                    values: [
                        ['cpu'], ['memory'], ['disk'], ['diskio'], ['net'], ['netstat'],
                        ['system'], ['processes'], ['kernel'], ['swap'],
                        ['docker_container_cpu'], ['docker_container_mem'],
                        ['nginx'], ['postgresql'], ['redis']
                    ]
                }]
            }]
        });
        return;
    }
    
    if (query.includes('SHOW FIELD KEYS')) {
        const measurement = query.match(/FROM "([^"]+)"/)?.[1] || 'cpu';
        
        const mockFields = {
            'cpu': [['usage_user', 'float'], ['usage_system', 'float'], ['usage_idle', 'float']],
            'memory': [['used', 'float'], ['available', 'float'], ['total', 'float'], ['used_percent', 'float']],
            'disk': [['used', 'float'], ['free', 'float'], ['total', 'float'], ['used_percent', 'float']],
            'diskio': [['read_bytes', 'float'], ['write_bytes', 'float'], ['read_time', 'float'], ['write_time', 'float']],
            'net': [['bytes_recv', 'float'], ['bytes_sent', 'float'], ['packets_recv', 'float'], ['packets_sent', 'float']]
        };
        
        res.json({
            results: [{
                series: [{
                    name: measurement,
                    columns: ['fieldKey', 'fieldType'],
                    values: mockFields[measurement] || [['value', 'float']]
                }]
            }]
        });
        return;
    }
    
    if (query.includes('SHOW TAG KEYS')) {
        const measurement = query.match(/FROM "([^"]+)"/)?.[1] || 'cpu';
        
        const mockTags = {
            'cpu': [['host'], ['cpu'], ['datacenter']],
            'memory': [['host'], ['datacenter']],
            'disk': [['host'], ['device'], ['fstype'], ['path']],
            'diskio': [['host'], ['name']],
            'net': [['host'], ['interface']]
        };
        
        res.json({
            results: [{
                series: [{
                    name: measurement,
                    columns: ['tagKey'],
                    values: mockTags[measurement] || [['host']]
                }]
            }]
        });
        return;
    }
    
    if (query.includes('SHOW TAG VALUES')) {
        res.json({
            results: [{
                series: [{
                    name: 'hosts',
                    columns: ['key', 'value'],
                    values: [
                        ['host', 'web-server-01'],
                        ['host', 'web-server-02'],
                        ['host', 'api-server-01'],
                        ['host', 'db-server-01']
                    ]
                }]
            }]
        });
        return;
    }
    
    if (query.includes('SHOW RETENTION POLICIES')) {
        res.json({
            results: [{
                series: [{
                    columns: ['name', 'duration', 'shardGroupDuration', 'replicaN', 'default'],
                    values: [
                        ['autogen', '0s', '168h0m0s', 1, true],
                        ['30d', '720h0m0s', '24h0m0s', 1, false],
                        ['1y', '8760h0m0s', '168h0m0s', 1, false]
                    ]
                }]
            }]
        });
        return;
    }
    
    // Handle SELECT queries
    if (query.includes('SELECT')) {
        let mockSeries = [];
        const values = MockData.generateInfluxData(query);
        
        if (query.includes('cpu')) {
            mockSeries = [{
                name: 'cpu',
                tags: { host: 'web-server-01', cpu: 'cpu-total' },
                columns: ['time', 'mean_usage_user', 'mean_usage_system'],
                values: values
            }];
        } else if (query.includes('memory')) {
            mockSeries = [{
                name: 'memory',
                tags: { host: 'web-server-01' },
                columns: ['time', 'mean_used_percent'],
                values: values
            }];
        } else if (query.includes('disk')) {
            mockSeries = [{
                name: 'disk',
                tags: { host: 'web-server-01', device: 'sda1' },
                columns: ['time', 'mean_used_percent'],
                values: values
            }];
        } else {
            mockSeries = [{
                name: 'demo_measurement',
                tags: { host: 'demo-host' },
                columns: ['time', 'value'],
                values: values
            }];
        }
        
        res.json({
            results: [{
                series: mockSeries
            }]
        });
        return;
    }
    
    // Default response
    res.json({ results: [{}] });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════╗
║          Mock Grafana Server (Demo Mode)           ║
╠════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}          ║
║  Health check: http://localhost:${PORT}/health       ║
║                                                    ║
║  This mock server provides realistic Grafana API  ║
║  responses for demo and testing purposes.          ║
╚════════════════════════════════════════════════════╝
    `);
});

module.exports = app;