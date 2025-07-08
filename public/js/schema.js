const Schema = {
    // Schema state
    currentDatasourceType: null,
    currentDatasourceId: null,
    prometheusMetrics: [],
    prometheusLabels: {},
    influxMeasurements: [],
    influxRetentionPolicies: [],
    influxFields: {},
    influxTags: {},
    influxTagValues: {}, // Store tag values keyed by "measurement:tag"
    selectedMeasurement: null,
    selectedRetentionPolicy: null,
    selectedField: null, // Track which field is selected
    selectedTag: null, // Track which tag is selected
    fieldAssociatedTags: {}, // Store tags associated with fields keyed by "measurement:field"
    isLoading: false,
    isLoadingMeasurement: false,
    isLoadingFieldTags: false,
    isLoadingTagValues: false,
    
    // Initialize schema explorer
    initialize() {
        this.renderSchemaUI();
        this.bindEvents();
    },
    
    // Bind event handlers
    bindEvents() {
        // Listen for datasource changes
        const datasourceSelect = document.getElementById('datasource');
        if (datasourceSelect) {
            datasourceSelect.addEventListener('change', () => {
                this.onDatasourceChange();
            });
        }
    },
    
    // Handle datasource change
    async onDatasourceChange() {
        const datasourceSelect = document.getElementById('datasource');
        const selectedOption = datasourceSelect.selectedOptions[0];
        
        if (!selectedOption || !selectedOption.value) {
            this.currentDatasourceType = null;
            this.currentDatasourceId = null;
            this.renderSchemaUI();
            return;
        }
        
        this.currentDatasourceType = selectedOption.dataset.type;
        this.currentDatasourceId = selectedOption.value;
        
        await this.loadSchema();
    },
    
    // Load schema based on datasource type
    async loadSchema() {
        if (!this.currentDatasourceType || !this.currentDatasourceId) return;
        
        this.isLoading = true;
        this.renderSchemaUI();
        
        try {
            console.log('Loading schema for:', this.currentDatasourceType);
            if (this.currentDatasourceType === 'prometheus') {
                await this.loadPrometheusSchema();
            } else if (this.currentDatasourceType === 'influxdb') {
                await this.loadInfluxDBSchema();
            }
        } catch (error) {
            console.error('Error loading schema:', error);
            this.showError('Failed to load schema: ' + error.message);
        } finally {
            this.isLoading = false;
            this.renderSchemaUI();
        }
    },
    
    // Load Prometheus schema (metrics only, labels loaded per-metric)
    async loadPrometheusSchema() {
        try {
            // Method 1: Use a series query to get all metrics - this works universally
            const metricsQuery = '{__name__=~".+"}';
            console.log('Executing metrics query:', metricsQuery);
            const metricsResult = await this.executeSchemaQuery(metricsQuery, 'prometheus');
            
            console.log('Metrics query result:', metricsResult);
            
            if (metricsResult && metricsResult.results && metricsResult.results.A && metricsResult.results.A.frames) {
                const metrics = new Set();
                
                console.log('Processing frames:', metricsResult.results.A.frames.length);
                
                // Extract metrics from series frames
                for (const frame of metricsResult.results.A.frames) {
                    console.log('Frame schema:', frame.schema);
                    console.log('Frame data:', frame.data);
                    
                    // Check schema fields for metric names in labels
                    if (frame.schema && frame.schema.fields) {
                        frame.schema.fields.forEach(field => {
                            if (field.labels && field.labels.__name__) {
                                metrics.add(field.labels.__name__);
                                console.log('Found metric from field labels:', field.labels.__name__);
                            }
                        });
                    }
                    
                    // Also check if there's a displayNameFromDS
                    if (frame.schema && frame.schema.fields) {
                        frame.schema.fields.forEach(field => {
                            if (field.config && field.config.displayNameFromDS) {
                                // Extract metric name from display name (usually like "metric{labels}")
                                const metricMatch = field.config.displayNameFromDS.match(/^([^{]+)/);
                                if (metricMatch) {
                                    metrics.add(metricMatch[1]);
                                    console.log('Found metric from displayName:', metricMatch[1]);
                                }
                            }
                        });
                    }
                }
                
                this.prometheusMetrics = Array.from(metrics).sort();
                console.log('Extracted metrics count:', this.prometheusMetrics.length);
                console.log('Sample metrics:', this.prometheusMetrics.slice(0, 10));
            }
            
            // Initialize empty labels structure - labels will be loaded per metric
            this.prometheusLabels = {};
            
            console.log('Final Prometheus schema:', {
                metrics: this.prometheusMetrics.length
            });
            
        } catch (error) {
            console.error('Error loading Prometheus schema:', error);
            // Set some default common metrics if discovery fails
            this.prometheusMetrics = ['up', 'prometheus_build_info', 'process_start_time_seconds'];
            this.prometheusLabels = {};
        }
    },
    
    // Load labels for a specific Prometheus metric
    async loadPrometheusMetricLabels(metric) {
        try {
            console.log('Loading labels for metric:', metric);
            
            // Query to get labels for this specific metric
            const labelsQuery = `group by (__name__) ({__name__="${metric}"})`;
            console.log('Executing metric labels query:', labelsQuery);
            const labelsResult = await this.executeSchemaQuery(labelsQuery, 'prometheus');
            
            console.log('Metric labels result:', labelsResult);
            
            const metricLabels = new Set(['__name__']); // Always include __name__
            
            if (labelsResult && labelsResult.results && labelsResult.results.A && labelsResult.results.A.frames) {
                // Extract label names from frame schema
                for (const frame of labelsResult.results.A.frames) {
                    if (frame.schema && frame.schema.fields) {
                        frame.schema.fields.forEach(field => {
                            if (field.labels) {
                                Object.keys(field.labels).forEach(labelName => {
                                    metricLabels.add(labelName);
                                    console.log('Found label for metric:', labelName);
                                });
                            }
                        });
                    }
                }
            }
            
            // Store labels for this metric
            this.prometheusLabels[metric] = Array.from(metricLabels).sort();
            console.log(`Found ${this.prometheusLabels[metric].length} labels for ${metric}:`, this.prometheusLabels[metric]);
            
            return this.prometheusLabels[metric];
            
        } catch (error) {
            console.error('Error loading labels for metric:', metric, error);
            // Set some default labels
            this.prometheusLabels[metric] = ['__name__', 'job', 'instance'];
            return this.prometheusLabels[metric];
        }
    },
    
    // Load InfluxDB schema
    async loadInfluxDBSchema() {
        try {
            console.log('Loading InfluxDB schema...');
            
            // Get retention policies
            console.log('Executing: SHOW RETENTION POLICIES');
            const retentionPoliciesResult = await this.executeSchemaQuery('SHOW RETENTION POLICIES', 'influxdb');
            console.log('Retention policies result:', retentionPoliciesResult);
            
            if (retentionPoliciesResult && retentionPoliciesResult.results && retentionPoliciesResult.results.A) {
                this.influxRetentionPolicies = this.extractInfluxResults(retentionPoliciesResult.results.A);
                console.log('Extracted retention policies:', this.influxRetentionPolicies);
            } else {
                console.warn('No retention policies data found');
                this.influxRetentionPolicies = ['autogen']; // Default
            }
            
            // Get measurements
            console.log('Executing: SHOW MEASUREMENTS');
            const measurementsResult = await this.executeSchemaQuery('SHOW MEASUREMENTS', 'influxdb');
            console.log('Measurements result:', measurementsResult);
            
            if (measurementsResult && measurementsResult.results && measurementsResult.results.A) {
                this.influxMeasurements = this.extractInfluxResults(measurementsResult.results.A);
                console.log('Extracted measurements:', this.influxMeasurements);
            } else {
                console.warn('No measurements data found');
                this.influxMeasurements = [];
            }
            
            console.log('InfluxDB schema loaded:', {
                retentionPolicies: this.influxRetentionPolicies.length,
                measurements: this.influxMeasurements.length
            });
            
        } catch (error) {
            console.error('Error loading InfluxDB schema:', error);
            // Set defaults if discovery fails
            this.influxRetentionPolicies = ['autogen'];
            this.influxMeasurements = [];
        }
    },
    
    // Load fields and tags for a specific measurement
    async loadMeasurementSchema(measurement, retentionPolicy = 'autogen') {
        this.selectedMeasurement = measurement;
        this.selectedRetentionPolicy = retentionPolicy;
        this.selectedField = null; // Clear selected field when changing measurement
        this.selectedTag = null; // Clear selected tag when changing measurement
        this.isLoadingMeasurement = true;
        
        // Render UI to show loading state
        this.renderSchemaUI();
        
        try {
            console.log(`Loading schema for measurement: ${measurement}, retention policy: ${retentionPolicy}`);
            
            // Get field keys - try without retention policy first
            let fieldsQuery = `SHOW FIELD KEYS FROM "${measurement}"`;
            console.log('Executing fields query:', fieldsQuery);
            let fieldsResult = await this.executeSchemaQuery(fieldsQuery, 'influxdb');
            console.log('Fields result:', fieldsResult);
            
            // Check if we got fields
            let hasFields = false;
            if (fieldsResult && fieldsResult.results && fieldsResult.results.A) {
                const extractedFields = this.extractInfluxResults(fieldsResult.results.A);
                if (extractedFields.length > 0) {
                    this.influxFields[measurement] = extractedFields;
                    console.log('Extracted fields:', this.influxFields[measurement]);
                    hasFields = true;
                }
            }
            
            // If no fields found, try with retention policy
            if (!hasFields) {
                console.warn('No fields found with basic query, trying with retention policy:', retentionPolicy);
                fieldsQuery = `SHOW FIELD KEYS FROM "${retentionPolicy}"."${measurement}"`;
                console.log('Executing fields query with retention policy:', fieldsQuery);
                fieldsResult = await this.executeSchemaQuery(fieldsQuery, 'influxdb');
                console.log('Fields result with retention policy:', fieldsResult);
                
                if (fieldsResult && fieldsResult.results && fieldsResult.results.A) {
                    this.influxFields[measurement] = this.extractInfluxResults(fieldsResult.results.A);
                    console.log('Extracted fields with retention policy:', this.influxFields[measurement]);
                } else {
                    console.warn('No fields data found for measurement:', measurement);
                    this.influxFields[measurement] = [];
                }
            }
            
            // Get tag keys
            const tagsQuery = `SHOW TAG KEYS FROM "${retentionPolicy}"."${measurement}"`;
            console.log('Executing tags query:', tagsQuery);
            const tagsResult = await this.executeSchemaQuery(tagsQuery, 'influxdb');
            console.log('Tags result:', tagsResult);
            
            if (tagsResult && tagsResult.results && tagsResult.results.A) {
                this.influxTags[measurement] = this.extractInfluxResults(tagsResult.results.A);
                console.log('Extracted tags:', this.influxTags[measurement]);
            } else {
                console.warn('No tags data found for measurement:', measurement);
                this.influxTags[measurement] = [];
            }
            
            console.log(`Measurement schema loaded for ${measurement}:`, {
                fields: this.influxFields[measurement] ? this.influxFields[measurement].length : 0,
                tags: this.influxTags[measurement] ? this.influxTags[measurement].length : 0
            });
            
        } catch (error) {
            console.error('Error loading measurement schema:', error);
            this.showError('Failed to load measurement schema: ' + error.message);
        } finally {
            this.isLoadingMeasurement = false;
            this.renderSchemaUI();
        }
    },
    
    // Execute schema discovery query
    async executeSchemaQuery(query, datasourceType) {
        // Try to get datasource info from old interface first, fallback to global config
        let datasourceNumericId;
        const selectedOption = document.getElementById('datasource');
        if (selectedOption && selectedOption.selectedOptions && selectedOption.selectedOptions[0]) {
            datasourceNumericId = selectedOption.selectedOptions[0].dataset.id;
        } else {
            // Use global config for new interface
            datasourceNumericId = GrafanaConfig.selectedDatasourceId;
        }
        
        if (!datasourceNumericId) {
            console.warn('No datasource ID available for schema query');
            return null;
        }
        
        let requestBody;
        let urlParams = '';
        
        const now = Date.now();
        const fromTime = now - (60 * 60 * 1000); // 1 hour ago
        const toTime = now;
        
        if (datasourceType === 'prometheus') {
            const requestId = Math.random().toString(36).substr(2, 9);
            urlParams = '?ds_type=prometheus&requestId=' + requestId;
            
            requestBody = {
                queries: [{
                    refId: 'A',
                    datasource: { 
                        uid: this.currentDatasourceId,
                        type: 'prometheus'
                    },
                    expr: query,
                    instant: true,
                    interval: '',
                    legendFormat: '',
                    editorMode: 'code',
                    exemplar: false,
                    requestId: requestId.substr(0, 3).toUpperCase(),
                    utcOffsetSec: new Date().getTimezoneOffset() * -60,
                    scopes: [],
                    adhocFilters: [],
                    datasourceId: parseInt(datasourceNumericId),
                    intervalMs: 15000,
                    maxDataPoints: 10000
                }],
                from: fromTime.toString(),
                to: toTime.toString()
            };
        } else if (datasourceType === 'influxdb') {
            const requestId = Math.random().toString(36).substr(2, 9);
            urlParams = '?ds_type=influxdb&requestId=' + requestId;
            
            requestBody = {
                queries: [{
                    refId: 'A',
                    datasource: { 
                        uid: this.currentDatasourceId,
                        type: 'influxdb'
                    },
                    query: query,
                    rawQuery: true,
                    resultFormat: 'time_series',
                    requestId: requestId.substr(0, 3).toUpperCase(),
                    utcOffsetSec: new Date().getTimezoneOffset() * -60,
                    datasourceId: parseInt(datasourceNumericId),
                    intervalMs: 15000,
                    maxDataPoints: 10000
                }],
                from: fromTime.toString(),
                to: toTime.toString()
            };
        }
        
        const response = await API.makeApiRequest('/api/ds/query' + urlParams, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error('Schema query failed: ' + response.statusText + ' - ' + errorText);
        }
        
        return await response.json();
    },
    
    // Load tags associated with a specific field
    async loadFieldAssociatedTags(field) {
        if (!this.selectedMeasurement || !field) return;
        
        const key = `${this.selectedMeasurement}:${field}`;
        this.selectedField = field;
        this.selectedTag = null; // Clear selected tag when field changes
        this.isLoadingFieldTags = true;
        
        // Update only the tags list to show loading state
        this.renderTagsList();
        
        // Clear tag values panel since selected tag is cleared
        this.renderTagValuesPanel();
        
        try {
            console.log(`Loading tags associated with field: ${field} in measurement: ${this.selectedMeasurement}`);
            
            // Query to get tag groupings for this field
            const now = Date.now();
            const fromTime = now - (60 * 60 * 1000); // 1 hour ago
            const toTime = now;
            
            // Build time filter
            const timeFilter = `time >= ${fromTime}ms AND time <= ${toTime}ms`;
            
            // Query with GROUP BY * to get all tag combinations
            const tagsQuery = `SELECT last("${field}") FROM "${this.selectedRetentionPolicy}"."${this.selectedMeasurement}" WHERE ${timeFilter} GROUP BY time(1h), *`;
            console.log('Executing field tags query:', tagsQuery);
            
            const tagsResult = await this.executeSchemaQuery(tagsQuery, 'influxdb');
            console.log('Field tags result:', tagsResult);
            
            const associatedTags = new Set();
            
            if (tagsResult && tagsResult.results && tagsResult.results.A && tagsResult.results.A.frames) {
                // Extract tag names from the frames
                for (const frame of tagsResult.results.A.frames) {
                    if (frame.schema && frame.schema.fields) {
                        frame.schema.fields.forEach(field => {
                            if (field.labels) {
                                Object.keys(field.labels).forEach(tagName => {
                                    // Exclude time-related labels
                                    if (tagName !== 'Time' && tagName !== '__name__') {
                                        associatedTags.add(tagName);
                                    }
                                });
                            }
                        });
                    }
                }
            }
            
            this.fieldAssociatedTags[key] = Array.from(associatedTags).sort();
            console.log(`Found ${this.fieldAssociatedTags[key].length} tags associated with field ${field}:`, this.fieldAssociatedTags[key]);
            
        } catch (error) {
            console.error('Error loading field associated tags:', error);
            // If the query fails, don't filter tags
            this.fieldAssociatedTags[key] = null;
        } finally {
            this.isLoadingFieldTags = false;
            this.renderTagsList();
        }
    },
    
    // Render just the tag values panel
    renderTagValuesPanel() {
        const valuesPanel = document.querySelector('.schema-values-panel');
        if (!valuesPanel) return;
        
        let html = '';
        html += '<div class="schema-panel-header">';
        html += '<h5>Tag Values' + (this.selectedTag ? ' (' + Utils.escapeHtml(this.selectedTag) + ')' : '') + '</h5>';
        html += '</div>';
        
        if (this.selectedTag) {
            const key = `${this.selectedMeasurement}:${this.selectedTag}`;
            const tagValues = this.influxTagValues[key] || [];
            
            // Search box for tag values
            html += '<div class="schema-search">';
            html += '<input type="text" id="tagValuesSearch" placeholder="Search values..." onkeyup="filterTagValues(this.value)">';
            html += '</div>';
            
            html += '<div class="schema-list" id="tagValuesList">';
            
            if (this.isLoadingTagValues) {
                html += '<div class="schema-loading">Loading tag values...</div>';
            } else if (tagValues.length === 0) {
                html += '<div class="schema-empty">No values found</div>';
            } else {
                for (const value of tagValues) {
                    html += '<div class="schema-value-item" onclick="insertTagValue(\'' + Utils.escapeHtml(this.selectedTag) + '\', \'' + Utils.escapeHtml(value) + '\')">';
                    html += '<span class="schema-value-name">' + Utils.escapeHtml(value) + '</span>';
                    html += '</div>';
                }
            }
            
            html += '</div>';
        } else {
            html += '<div class="schema-list">';
            html += '<div class="schema-empty">Select a tag to view values</div>';
            html += '</div>';
        }
        
        // Save current scroll position of tag values list if it exists
        const currentTagValuesList = document.getElementById('tagValuesList');
        const scrollTop = currentTagValuesList ? currentTagValuesList.scrollTop : 0;
        
        valuesPanel.innerHTML = html;
        
        // Restore scroll position after render
        if (this.selectedTag) {
            requestAnimationFrame(() => {
                const newTagValuesList = document.getElementById('tagValuesList');
                if (newTagValuesList && scrollTop > 0) {
                    newTagValuesList.scrollTop = scrollTop;
                }
            });
        }
    },
    
    // Load tag values for a specific tag
    async loadTagValues(tag) {
        if (!this.selectedMeasurement || !tag) return;
        
        const key = `${this.selectedMeasurement}:${tag}`;
        this.selectedTag = tag;
        this.isLoadingTagValues = true;
        
        // Save scroll positions
        const scrollPositions = this.saveScrollPositions();
        
        // Update tags list to show selection
        const tagsList = document.getElementById('tagsList');
        if (tagsList) {
            // Remove previous selection
            const selectedItems = tagsList.querySelectorAll('.schema-item.selected');
            selectedItems.forEach(item => item.classList.remove('selected'));
            
            // Add selection to clicked tag
            const clickedTag = Array.from(tagsList.querySelectorAll('.schema-item')).find(
                item => item.querySelector('.schema-item-name').textContent === tag
            );
            if (clickedTag) {
                clickedTag.classList.add('selected');
            }
        }
        
        // Update only tag values panel to show loading state
        this.renderTagValuesPanel();
        
        // Restore scroll positions
        this.restoreScrollPositions(scrollPositions);
        
        try {
            console.log(`Loading values for tag: ${tag} in measurement: ${this.selectedMeasurement}`);
            
            // Query for tag values
            const tagValuesQuery = `SHOW TAG VALUES WITH KEY = "${tag}"`;
            console.log('Executing tag values query:', tagValuesQuery);
            const tagValuesResult = await this.executeSchemaQuery(tagValuesQuery, 'influxdb');
            console.log('Tag values result:', tagValuesResult);
            
            if (tagValuesResult && tagValuesResult.results && tagValuesResult.results.A) {
                // Extract values from the result
                const values = [];
                const frames = tagValuesResult.results.A.frames || [];
                
                for (const frame of frames) {
                    if (!frame.data || !frame.data.values) continue;
                    
                    // SHOW TAG VALUES returns results with the tag key in first column and value in second
                    // But we should check all columns to be safe
                    for (let i = 0; i < frame.data.values.length; i++) {
                        const column = frame.data.values[i];
                        if (Array.isArray(column)) {
                            // Skip the first column if it contains the tag name
                            if (i === 0 && column.length > 0 && column[0] === tag) {
                                continue;
                            }
                            
                            // Extract values from this column
                            for (const value of column) {
                                if (value !== null && value !== undefined && value !== tag) {
                                    const stringValue = String(value);
                                    if (!values.includes(stringValue)) {
                                        values.push(stringValue);
                                    }
                                }
                            }
                        }
                    }
                }
                
                this.influxTagValues[key] = values.sort();
                console.log(`Extracted ${values.length} values for tag ${tag}:`, this.influxTagValues[key]);
            } else {
                console.warn('No tag values found for:', tag);
                this.influxTagValues[key] = [];
            }
            
        } catch (error) {
            console.error('Error loading tag values:', error);
            this.showError('Failed to load tag values: ' + error.message);
            this.influxTagValues[key] = [];
        } finally {
            this.isLoadingTagValues = false;
            this.renderTagValuesPanel();
            
            // Ensure selected items are visible
            this.ensureItemVisible('fieldsList', '.schema-item.selected');
            this.ensureItemVisible('tagsList', '.schema-item.selected');
        }
    },
    
    // Extract results from InfluxDB response
    extractInfluxResults(result) {
        const values = [];
        
        if (!result.frames || result.frames.length === 0) {
            return values;
        }
        
        for (const frame of result.frames) {
            if (!frame.data || !frame.data.values) continue;
            
            // For SHOW commands, InfluxDB typically returns a single column of values
            // Try to get the first (and usually only) column of values
            if (frame.data.values.length > 0 && Array.isArray(frame.data.values[0])) {
                const columnValues = frame.data.values[0];
                for (const value of columnValues) {
                    if (value !== null && value !== undefined) {
                        const stringValue = String(value);
                        if (!values.includes(stringValue)) {
                            values.push(stringValue);
                        }
                    }
                }
            }
        }
        
        return values.sort();
    },
    
    // Filter metrics based on search term
    filterMetrics(searchTerm) {
        if (!searchTerm) return this.prometheusMetrics;
        
        const term = searchTerm.toLowerCase();
        return this.prometheusMetrics.filter(metric => 
            metric.toLowerCase().includes(term)
        );
    },
    
    // Insert text into query editor
    insertIntoQuery(text) {
        if (GrafanaConfig.queryEditor) {
            const doc = GrafanaConfig.queryEditor.getDoc();
            const cursor = doc.getCursor();
            doc.replaceRange(text, cursor);
            GrafanaConfig.queryEditor.focus();
        }
    },
    
    // Show error message
    showError(message) {
        const container = document.getElementById('schemaContainer');
        if (container) {
            container.innerHTML = `<div class="schema-error">${Utils.escapeHtml(message)}</div>`;
        }
    },
    
    // Render schema UI
    renderSchemaUI() {
        const container = document.getElementById('schemaContainer');
        if (!container) return;
        
        let html = '';
        
        if (!this.currentDatasourceType) {
            html = '<div class="schema-empty">Select a data source to explore schema</div>';
        } else if (this.isLoading) {
            html = '<div class="schema-loading">Loading schema...</div>';
        } else if (this.currentDatasourceType === 'prometheus') {
            html = this.renderPrometheusSchema();
        } else if (this.currentDatasourceType === 'influxdb') {
            html = this.renderInfluxDBSchema();
        }
        
        container.innerHTML = html;
    },
    
    // Render Prometheus schema as a tree
    renderPrometheusSchema() {
        let html = '<div class="schema-tree">';
        
        // Search box at the top
        html += '<div class="schema-search">';
        html += '<input type="text" id="metricsSearch" placeholder="Search metrics..." onkeyup="filterPrometheusMetrics(this.value)">';
        html += '</div>';
        
        // Metrics tree node
        html += '<div class="tree-node">';
        html += '<div class="tree-node-header" onclick="toggleTreeNode(this)">';
        html += '<span class="tree-node-icon">▼</span>';
        html += '<span class="tree-node-label">Metrics</span>';
        html += '<span class="tree-node-count">(' + this.prometheusMetrics.length + ')</span>';
        html += '</div>';
        html += '<div class="tree-node-content expanded" id="metricsList">';
        
        if (this.prometheusMetrics.length === 0) {
            html += '<div class="tree-item-empty">No metrics found</div>';
        } else {
            // Group metrics by prefix for better organization
            const groupedMetrics = this.groupMetricsByPrefix(this.prometheusMetrics);
            
            for (const [prefix, metrics] of Object.entries(groupedMetrics)) {
                if (metrics.length > 1 && prefix !== 'other') {
                    // Create a sub-group for metrics with common prefix
                    html += '<div class="tree-subnode">';
                    html += '<div class="tree-subnode-header" onclick="toggleTreeNode(this)">';
                    html += '<span class="tree-node-icon">▼</span>';
                    html += '<span class="tree-node-label">' + Utils.escapeHtml(prefix) + '</span>';
                    html += '<span class="tree-node-count">(' + metrics.length + ')</span>';
                    html += '</div>';
                    html += '<div class="tree-subnode-content expanded">';
                    
                    for (const metric of metrics) {
                        html += this.renderPrometheusMetricWithLabels(metric);
                    }
                    
                    html += '</div>';
                    html += '</div>';
                } else {
                    // Show individual metrics
                    for (const metric of metrics) {
                        html += this.renderPrometheusMetricWithLabels(metric);
                    }
                }
            }
        }
        
        html += '</div>';
        html += '</div>';
        
        html += '</div>';
        return html;
    },
    
    // Render a single Prometheus metric with its labels as children
    renderPrometheusMetricWithLabels(metric) {
        let html = '';
        
        // Metric node with expandable labels
        html += '<div class="tree-subnode">';
        html += '<div class="tree-subnode-header metric-header">';
        html += '<span class="tree-node-icon" onclick="togglePrometheusMetric(this.parentElement, \'' + Utils.escapeHtml(metric) + '\')">▶</span>';
        html += '<span class="tree-item-icon">📊</span>';
        html += '<span class="tree-item-name" onclick="insertMetric(\'' + Utils.escapeHtml(metric) + '\')" title="Click to insert metric">' + Utils.escapeHtml(metric) + '</span>';
        html += '</div>';
        html += '<div class="tree-subnode-content collapsed" id="labels-' + Utils.escapeHtml(metric).replace(/[^a-zA-Z0-9]/g, '_') + '">';
        
        // Labels will be loaded when expanded
        html += '<div class="tree-item-empty">Click arrow to load labels...</div>';
        
        html += '</div>';
        html += '</div>';
        
        return html;
    },
    
    // Group metrics by common prefix for better tree organization
    groupMetricsByPrefix(metrics) {
        const groups = {};
        const prefixCounts = {};
        
        // Count common prefixes
        for (const metric of metrics) {
            const parts = metric.split('_');
            if (parts.length > 1) {
                const prefix = parts[0];
                prefixCounts[prefix] = (prefixCounts[prefix] || 0) + 1;
            }
        }
        
        // Group metrics by prefix if there are enough items
        for (const metric of metrics) {
            const parts = metric.split('_');
            if (parts.length > 1) {
                const prefix = parts[0];
                if (prefixCounts[prefix] >= 3) { // Only group if 3+ metrics share prefix
                    if (!groups[prefix]) groups[prefix] = [];
                    groups[prefix].push(metric);
                    continue;
                }
            }
            
            // Add to 'other' group
            if (!groups.other) groups.other = [];
            groups.other.push(metric);
        }
        
        return groups;
    },
    
    // Render InfluxDB schema as a tree
    renderInfluxDBSchema() {
        let html = '<div class="schema-tree">';
        
        // Retention Policy tree node
        if (this.influxRetentionPolicies.length > 0) {
            html += '<div class="tree-node">';
            html += '<div class="tree-node-header" onclick="toggleTreeNode(this)">';
            html += '<span class="tree-node-icon">▼</span>';
            html += '<span class="tree-node-label">Retention Policies</span>';
            html += '<span class="tree-node-count">(' + this.influxRetentionPolicies.length + ')</span>';
            html += '</div>';
            html += '<div class="tree-node-content expanded">';
            
            for (const policy of this.influxRetentionPolicies) {
                const isSelected = policy === this.selectedRetentionPolicy;
                html += '<div class="tree-item' + (isSelected ? ' selected' : '') + '" onclick="selectRetentionPolicy(\'' + Utils.escapeHtml(policy) + '\')">';
                html += '<span class="tree-item-icon">🗄️</span>';
                html += '<span class="tree-item-name">' + Utils.escapeHtml(policy) + '</span>';
                html += '</div>';
            }
            
            html += '</div>';
            html += '</div>';
        }
        
        // Measurements tree node
        html += '<div class="tree-node">';
        html += '<div class="tree-node-header" onclick="toggleTreeNode(this)">';
        html += '<span class="tree-node-icon">▼</span>';
        html += '<span class="tree-node-label">Measurements</span>';
        html += '<span class="tree-node-count">(' + this.influxMeasurements.length + ')</span>';
        html += '</div>';
        html += '<div class="tree-node-content expanded">';
        
        if (this.influxMeasurements.length === 0) {
            html += '<div class="tree-item-empty">No measurements found</div>';
        } else {
            for (const measurement of this.influxMeasurements) {
                const isSelected = measurement === this.selectedMeasurement;
                html += '<div class="tree-item' + (isSelected ? ' selected' : '') + '" onclick="selectMeasurement(\'' + Utils.escapeHtml(measurement) + '\')">';
                html += '<span class="tree-item-icon">📋</span>';
                html += '<span class="tree-item-name">' + Utils.escapeHtml(measurement) + '</span>';
                html += '</div>';
            }
        }
        
        html += '</div>';
        html += '</div>';
        
        // Fields and Tags (when measurement is selected)
        if (this.selectedMeasurement) {
            if (this.isLoadingMeasurement) {
                html += '<div class="tree-item-empty">Loading fields and tags...</div>';
            } else {
                const fields = this.influxFields[this.selectedMeasurement] || [];
                const tags = this.influxTags[this.selectedMeasurement] || [];
                
                // Fields tree node
                if (fields.length > 0) {
                    html += '<div class="tree-node">';
                    html += '<div class="tree-node-header" onclick="toggleTreeNode(this)">';
                    html += '<span class="tree-node-icon">▼</span>';
                    html += '<span class="tree-node-label">Fields (' + Utils.escapeHtml(this.selectedMeasurement) + ')</span>';
                    html += '<span class="tree-node-count">(' + fields.length + ')</span>';
                    html += '</div>';
                    html += '<div class="tree-node-content expanded" id="fieldsList">';
                    
                    for (const field of fields) {
                        const isSelected = this.selectedField === field;
                        html += '<div class="tree-item' + (isSelected ? ' selected' : '') + '" onclick="selectField(\'' + Utils.escapeHtml(field) + '\')">';
                        html += '<span class="tree-item-icon">🔢</span>';
                        html += '<span class="tree-item-name">' + Utils.escapeHtml(field) + '</span>';
                        html += '</div>';
                    }
                    
                    html += '</div>';
                    html += '</div>';
                }
                
                // Tags tree node
                if (tags.length > 0) {
                    html += '<div class="tree-node">';
                    html += '<div class="tree-node-header" onclick="toggleTreeNode(this)">';
                    html += '<span class="tree-node-icon">▼</span>';
                    html += '<span class="tree-node-label">Tags (' + Utils.escapeHtml(this.selectedMeasurement) + ')</span>';
                    html += '<span class="tree-node-count">(' + tags.length + ')</span>';
                    html += '</div>';
                    html += '<div class="tree-node-content expanded" id="tagsList">';
                    
                    // Filter tags based on selected field if available
                    let displayTags = tags;
                    if (this.selectedField) {
                        const key = `${this.selectedMeasurement}:${this.selectedField}`;
                        const associatedTags = this.fieldAssociatedTags[key];
                        if (associatedTags !== null && associatedTags !== undefined) {
                            displayTags = tags.filter(tag => associatedTags.includes(tag));
                        }
                    }
                    
                    for (const tag of displayTags) {
                        const isSelected = this.selectedTag === tag;
                        html += '<div class="tree-item' + (isSelected ? ' selected' : '') + '" onclick="selectTag(\'' + Utils.escapeHtml(tag) + '\')">';
                        html += '<span class="tree-item-icon">🏷️</span>';
                        html += '<span class="tree-item-name">' + Utils.escapeHtml(tag) + '</span>';
                        html += '</div>';
                    }
                    
                    html += '</div>';
                    html += '</div>';
                    
                    // Tag Values (when tag is selected)
                    if (this.selectedTag) {
                        const key = `${this.selectedMeasurement}:${this.selectedTag}`;
                        const tagValues = this.influxTagValues[key] || [];
                        
                        html += '<div class="tree-node">';
                        html += '<div class="tree-node-header" onclick="toggleTreeNode(this)">';
                        html += '<span class="tree-node-icon">▼</span>';
                        html += '<span class="tree-node-label">Values (' + Utils.escapeHtml(this.selectedTag) + ')</span>';
                        html += '<span class="tree-node-count">(' + tagValues.length + ')</span>';
                        html += '</div>';
                        html += '<div class="tree-node-content expanded" id="tagValuesList">';
                        
                        if (this.isLoadingTagValues) {
                            html += '<div class="tree-item-empty">Loading tag values...</div>';
                        } else if (tagValues.length === 0) {
                            html += '<div class="tree-item-empty">No values found</div>';
                        } else {
                            for (const value of tagValues) {
                                html += '<div class="tree-item" onclick="insertTagValue(\'' + Utils.escapeHtml(this.selectedTag) + '\', \'' + Utils.escapeHtml(value) + '\')">';
                                html += '<span class="tree-item-icon">📄</span>';
                                html += '<span class="tree-item-name">' + Utils.escapeHtml(value) + '</span>';
                                html += '</div>';
                            }
                        }
                        
                        html += '</div>';
                        html += '</div>';
                    }
                }
            }
        }
        
        html += '</div>';
        return html;
    },
    
    // Save scroll positions
    saveScrollPositions() {
        const positions = {};
        const fieldsList = document.getElementById('fieldsList');
        const tagsList = document.getElementById('tagsList');
        const tagValuesList = document.getElementById('tagValuesList');
        
        if (fieldsList) positions.fields = fieldsList.scrollTop;
        if (tagsList) positions.tags = tagsList.scrollTop;
        if (tagValuesList) positions.tagValues = tagValuesList.scrollTop;
        
        return positions;
    },
    
    // Restore scroll positions
    restoreScrollPositions(positions) {
        if (!positions) return;
        
        requestAnimationFrame(() => {
            const fieldsList = document.getElementById('fieldsList');
            const tagsList = document.getElementById('tagsList');
            const tagValuesList = document.getElementById('tagValuesList');
            
            if (fieldsList && positions.fields !== undefined) {
                fieldsList.scrollTop = positions.fields;
            }
            if (tagsList && positions.tags !== undefined) {
                tagsList.scrollTop = positions.tags;
            }
            if (tagValuesList && positions.tagValues !== undefined) {
                tagValuesList.scrollTop = positions.tagValues;
            }
        });
    },
    
    // Ensure selected item is visible
    ensureItemVisible(containerId, itemSelector) {
        requestAnimationFrame(() => {
            const container = document.getElementById(containerId);
            if (!container) return;
            
            const selectedItem = container.querySelector(itemSelector);
            if (!selectedItem) return;
            
            const containerRect = container.getBoundingClientRect();
            const itemRect = selectedItem.getBoundingClientRect();
            
            // Check if item is outside visible area
            if (itemRect.top < containerRect.top) {
                // Item is above visible area
                container.scrollTop -= containerRect.top - itemRect.top;
            } else if (itemRect.bottom > containerRect.bottom) {
                // Item is below visible area
                container.scrollTop += itemRect.bottom - containerRect.bottom;
            }
        });
    },
    
    // Render just the tags list
    renderTagsList() {
        const tagsList = document.getElementById('tagsList');
        if (!tagsList || !this.selectedMeasurement) return;
        
        // Save current scroll position
        const scrollTop = tagsList.scrollTop;
        
        const tags = this.influxTags[this.selectedMeasurement] || [];
        
        // Filter tags based on selected field if available
        let displayTags = tags;
        if (this.selectedField) {
            const key = `${this.selectedMeasurement}:${this.selectedField}`;
            const associatedTags = this.fieldAssociatedTags[key];
            if (associatedTags !== null && associatedTags !== undefined) {
                displayTags = tags.filter(tag => associatedTags.includes(tag));
            }
        }
        
        let html = '';
        
        if (this.isLoadingFieldTags) {
            html = '<div class="schema-loading">Loading associated tags...</div>';
        } else if (displayTags.length === 0) {
            html = '<div class="schema-empty">No tags found</div>';
        } else {
            for (const tag of displayTags) {
                const isSelected = this.selectedTag === tag;
                
                html += '<div class="schema-item' + (isSelected ? ' selected' : '') + '" onclick="selectTag(\'' + Utils.escapeHtml(tag) + '\')">';
                html += '<span class="schema-item-name">' + Utils.escapeHtml(tag) + '</span>';
                html += '<span class="schema-item-type tag">tag</span>';
                html += '</div>';
            }
        }
        
        tagsList.innerHTML = html;
        
        // Restore scroll position
        requestAnimationFrame(() => {
            tagsList.scrollTop = scrollTop;
        });
        
        // Update the header to show field context
        const headerElement = document.querySelector('.schema-tags-panel .schema-panel-header h5');
        if (headerElement) {
            headerElement.textContent = 'Tag Keys' + (this.selectedField ? ' (for ' + this.selectedField + ')' : '');
        }
    },
    
    // Refresh schema
    async refreshSchema() {
        if (this.currentDatasourceType && this.currentDatasourceId) {
            await this.loadSchema();
        }
    }
};

// Global functions for HTML onclick handlers
function toggleTreeNode(header) {
    const icon = header.querySelector('.tree-node-icon');
    const content = header.nextElementSibling;
    
    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        content.classList.add('collapsed');
        icon.textContent = '▶';
    } else {
        content.classList.remove('collapsed');
        content.classList.add('expanded');
        icon.textContent = '▼';
    }
}

// Toggle Prometheus metric and load its labels
async function togglePrometheusMetric(header, metric) {
    const icon = header.querySelector('.tree-node-icon');
    const content = header.nextElementSibling;
    
    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        content.classList.add('collapsed');
        icon.textContent = '▶';
    } else {
        content.classList.remove('collapsed');
        content.classList.add('expanded');
        icon.textContent = '▼';
        
        // Check if labels are already loaded
        if (!Schema.prometheusLabels[metric]) {
            // Show loading state
            content.innerHTML = '<div class="tree-item-empty">Loading labels...</div>';
            
            // Load labels for this metric
            const labels = await Schema.loadPrometheusMetricLabels(metric);
            
            // Render the labels
            let labelsHtml = '';
            if (labels.length === 0) {
                labelsHtml = '<div class="tree-item-empty">No labels found</div>';
            } else {
                for (const label of labels) {
                    labelsHtml += '<div class="tree-item" onclick="insertLabel(\'' + Utils.escapeHtml(label) + '\')">';
                    labelsHtml += '<span class="tree-item-icon">🏷️</span>';
                    labelsHtml += '<span class="tree-item-name">' + Utils.escapeHtml(label) + '</span>';
                    labelsHtml += '</div>';
                }
            }
            
            content.innerHTML = labelsHtml;
        }
    }
}

function filterPrometheusMetrics(searchTerm) {
    const metricsList = document.getElementById('metricsList');
    if (!metricsList) return;
    
    const filteredMetrics = Schema.filterMetrics(searchTerm);
    
    let html = '';
    if (filteredMetrics.length === 0) {
        html = '<div class="schema-empty">No metrics found</div>';
    } else {
        for (const metric of filteredMetrics) {
            html += '<div class="schema-item" onclick="insertMetric(\'' + Utils.escapeHtml(metric) + '\')">';
            html += '<span class="schema-item-name">' + Utils.escapeHtml(metric) + '</span>';
            html += '<span class="schema-item-type metric">metric</span>';
            html += '</div>';
        }
    }
    
    metricsList.innerHTML = html;
}

function insertMetric(metric) {
    Schema.insertIntoQuery(metric);
}

function insertLabel(label) {
    Schema.insertIntoQuery(label);
}

function insertField(field) {
    Schema.insertIntoQuery(field);
}

function selectField(field) {
    // Save all scroll positions before any updates
    const scrollPositions = Schema.saveScrollPositions();
    
    if (Schema.selectedField === field) {
        // If already selected, deselect
        Schema.selectedField = null;
        Schema.selectedTag = null;
        
        // Update fields list to remove selection
        const fieldsList = document.getElementById('fieldsList');
        if (fieldsList) {
            const selectedItems = fieldsList.querySelectorAll('.schema-item.selected');
            selectedItems.forEach(item => item.classList.remove('selected'));
        }
        
        // Refresh tags list to show all tags
        Schema.renderTagsList();
        
        // Clear tag values panel
        Schema.renderTagValuesPanel();
        
        // Restore scroll positions
        Schema.restoreScrollPositions(scrollPositions);
    } else {
        // Select the field and load associated tags
        Schema.loadFieldAssociatedTags(field);
        
        // Update fields list to show selection
        const fieldsList = document.getElementById('fieldsList');
        if (fieldsList) {
            // Remove previous selection
            const selectedItems = fieldsList.querySelectorAll('.schema-item.selected');
            selectedItems.forEach(item => item.classList.remove('selected'));
            
            // Add selection to clicked field
            const clickedField = Array.from(fieldsList.querySelectorAll('.schema-item')).find(
                item => item.querySelector('.schema-item-name').textContent === field
            );
            if (clickedField) {
                clickedField.classList.add('selected');
            }
        }
        
        // Restore fields scroll position
        Schema.restoreScrollPositions(scrollPositions);
    }
}

function insertTag(tag) {
    Schema.insertIntoQuery(tag);
}

function selectTag(tag) {
    if (Schema.selectedTag === tag) {
        // If already selected, deselect
        Schema.selectedTag = null;
        
        // Save scroll positions
        const scrollPositions = Schema.saveScrollPositions();
        
        // Update tags list to remove selection
        const tagsList = document.getElementById('tagsList');
        if (tagsList) {
            const selectedItems = tagsList.querySelectorAll('.schema-item.selected');
            selectedItems.forEach(item => item.classList.remove('selected'));
        }
        
        // Clear tag values
        Schema.renderTagValuesPanel();
        
        // Restore scroll positions
        Schema.restoreScrollPositions(scrollPositions);
    } else {
        // Select the tag and load its values
        Schema.loadTagValues(tag);
    }
}

function insertTagValue(tag, value) {
    // Insert in WHERE clause format: tag="value"
    const whereClause = `"${tag}"='${value}'`;
    Schema.insertIntoQuery(whereClause);
}

function selectMeasurement(measurement) {
    if (!measurement) {
        Schema.selectedMeasurement = null;
        Schema.renderSchemaUI();
        return;
    }
    const retentionPolicy = Schema.selectedRetentionPolicy || 'autogen';
    Schema.loadMeasurementSchema(measurement, retentionPolicy);
}

function selectRetentionPolicy(policy) {
    Schema.selectedRetentionPolicy = policy || null;
    if (Schema.selectedMeasurement && policy) {
        Schema.loadMeasurementSchema(Schema.selectedMeasurement, policy);
    } else {
        Schema.renderSchemaUI();
    }
}

function filterInfluxFields(searchTerm) {
    const fieldsList = document.getElementById('fieldsList');
    if (!fieldsList || !Schema.selectedMeasurement) return;
    
    // Save scroll position
    const scrollTop = fieldsList.scrollTop;
    
    const fields = Schema.influxFields[Schema.selectedMeasurement] || [];
    const filteredFields = searchTerm ? 
        fields.filter(field => field.toLowerCase().includes(searchTerm.toLowerCase())) : 
        fields;
    
    let html = '';
    if (filteredFields.length === 0) {
        html = '<div class="schema-empty">No fields found</div>';
    } else {
        for (const field of filteredFields) {
            const isSelected = Schema.selectedField === field;
            
            html += '<div class="schema-item' + (isSelected ? ' selected' : '') + '" onclick="selectField(\'' + Utils.escapeHtml(field) + '\')">';
            html += '<span class="schema-item-name">' + Utils.escapeHtml(field) + '</span>';
            html += '<span class="schema-item-type field">field</span>';
            html += '</div>';
        }
    }
    
    fieldsList.innerHTML = html;
    
    // Restore scroll position
    requestAnimationFrame(() => {
        fieldsList.scrollTop = scrollTop;
    });
}

function filterInfluxTags(searchTerm) {
    const tagsList = document.getElementById('tagsList');
    if (!tagsList || !Schema.selectedMeasurement) return;
    
    // Save scroll position
    const scrollTop = tagsList.scrollTop;
    
    let tags = Schema.influxTags[Schema.selectedMeasurement] || [];
    
    // Filter tags based on selected field if available
    if (Schema.selectedField) {
        const key = `${Schema.selectedMeasurement}:${Schema.selectedField}`;
        const associatedTags = Schema.fieldAssociatedTags[key];
        if (associatedTags !== null && associatedTags !== undefined) {
            tags = tags.filter(tag => associatedTags.includes(tag));
        }
    }
    
    const filteredTags = searchTerm ? 
        tags.filter(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) : 
        tags;
    
    let html = '';
    if (filteredTags.length === 0) {
        html = '<div class="schema-empty">No tags found</div>';
    } else {
        for (const tag of filteredTags) {
            const isSelected = Schema.selectedTag === tag;
            
            html += '<div class="schema-item' + (isSelected ? ' selected' : '') + '" onclick="selectTag(\'' + Utils.escapeHtml(tag) + '\')">';
            html += '<span class="schema-item-name">' + Utils.escapeHtml(tag) + '</span>';
            html += '<span class="schema-item-type tag">tag</span>';
            html += '</div>';
        }
    }
    
    tagsList.innerHTML = html;
    
    // Restore scroll position
    requestAnimationFrame(() => {
        tagsList.scrollTop = scrollTop;
    });
}

function filterTagValues(searchTerm) {
    const tagValuesList = document.getElementById('tagValuesList');
    if (!tagValuesList || !Schema.selectedMeasurement || !Schema.selectedTag) return;
    
    // Save scroll position
    const scrollTop = tagValuesList.scrollTop;
    
    const key = `${Schema.selectedMeasurement}:${Schema.selectedTag}`;
    const tagValues = Schema.influxTagValues[key] || [];
    const filteredValues = searchTerm ? 
        tagValues.filter(value => value.toLowerCase().includes(searchTerm.toLowerCase())) : 
        tagValues;
    
    let html = '';
    if (filteredValues.length === 0) {
        html = '<div class="schema-empty">No values found</div>';
    } else {
        for (const value of filteredValues) {
            html += '<div class="schema-value-item" onclick="insertTagValue(\'' + Utils.escapeHtml(Schema.selectedTag) + '\', \'' + Utils.escapeHtml(value) + '\')">';
            html += '<span class="schema-value-name">' + Utils.escapeHtml(value) + '</span>';
            html += '</div>';
        }
    }
    
    tagValuesList.innerHTML = html;
    
    // Restore scroll position
    requestAnimationFrame(() => {
        tagValuesList.scrollTop = scrollTop;
    });
}

function refreshSchema() {
    Schema.refreshSchema();
}

function toggleSchemaExplorer() {
    const schemaSection = document.getElementById('schemaSection');
    const toggleButton = document.querySelector('.schema-toggle');
    
    if (schemaSection.classList.contains('collapsed')) {
        schemaSection.classList.remove('collapsed');
        toggleButton.textContent = 'Hide';
    } else {
        schemaSection.classList.add('collapsed');
        toggleButton.textContent = 'Show';
    }
}