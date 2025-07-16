// AI Analytics Controller
// Main controller for AI/ML analytics functionality

const Analytics = {
    // State management
    config: {
        ollamaEndpoint: 'http://localhost:11434',
        selectedModel: 'llama3.1:8b-instruct-q4_K_M',
        numPredict: -1, // -1 means infinite (Ollama default)
        numCtx: 8192,
        analysisType: 'anomaly',
        retentionPolicy: 'raw',
        measurement: '',
        field: '',
        tags: {},
        timeRange: '1d',
        sensitivity: 'medium',
        alertThreshold: 0.8,
        forecastHorizon: '1d',
        confidenceLevel: 0.95,
        trendDepth: 'seasonal'
    },

    // UI state
    isConnected: false,
    isAnalysisRunning: false,
    currentResults: null,

    // Initialize the analytics system
    initialize() {
        console.log('🤖 Initializing Analytics system...');
        this.setupEventListeners();
        this.loadConfiguration();
        this.updateUI();
        console.log('✅ Analytics system initialized');
    },

    // Setup all event listeners
    setupEventListeners() {
        console.log('🔗 Setting up Analytics event listeners...');

        // Connection testing
        const testButton = document.getElementById('testAiConnection');
        if (testButton) {
            testButton.addEventListener('click', () => this.testOllamaConnection());
        }

        // AI connection settings dialog
        const aiSettingsBtn = document.getElementById('aiSettingsBtn');
        if (aiSettingsBtn) {
            aiSettingsBtn.addEventListener('click', () => this.showAiConnectionDialog());
        }

        // AI connection card click to open settings
        const aiConnectionCard = document.getElementById('aiConnectionCard');
        if (aiConnectionCard) {
            aiConnectionCard.addEventListener('click', () => this.showAiConnectionDialog());
        }

        // Configuration changes in modal dialog
        const aiEndpoint = document.getElementById('aiEndpoint');
        if (aiEndpoint) {
            aiEndpoint.addEventListener('change', (e) => {
                this.config.ollamaEndpoint = e.target.value;
                this.saveConfiguration();
            });
        }

        const aiModel = document.getElementById('aiModel');
        if (aiModel) {
            aiModel.addEventListener('change', (e) => {
                this.config.selectedModel = e.target.value;
                this.saveConfiguration();
                this.updateModelInfo();
                this.toggleCustomModelField();
            });
        }

        const aiResponseTokens = document.getElementById('aiResponseTokens');
        if (aiResponseTokens) {
            aiResponseTokens.addEventListener('change', (e) => {
                this.config.numPredict = parseInt(e.target.value);
                this.saveConfiguration();
                console.log('🎛️ Response tokens (num_predict) updated:', this.config.numPredict);
            });
        }

        const aiContextSize = document.getElementById('aiContextSize');
        if (aiContextSize) {
            aiContextSize.addEventListener('change', (e) => {
                this.config.numCtx = parseInt(e.target.value);
                this.saveConfiguration();
                console.log('🎛️ Context size (num_ctx) updated:', this.config.numCtx);
            });
        }

        // Analysis type tabs
        const analysisButtons = document.querySelectorAll('.tab-button[data-analysis]');
        analysisButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.setAnalysisType(e.target.dataset.analysis);
            });
        });

        // Data configuration
        const retentionPolicy = document.getElementById('analyticsRetentionPolicy');
        if (retentionPolicy) {
            retentionPolicy.addEventListener('change', (e) => {
                this.config.retentionPolicy = e.target.value;
                this.saveConfiguration();
            });
        }

        const measurement = document.getElementById('analyticsMeasurement');
        if (measurement) {
            measurement.addEventListener('change', (e) => {
                this.config.measurement = e.target.value;
                this.saveConfiguration();
                // Load fields for the selected measurement
                if (e.target.value) {
                    this.loadFieldsForMeasurement(e.target.value);
                } else {
                    // Clear field dropdown if no measurement selected
                    const fieldSelect = document.getElementById('analyticsField');
                    if (fieldSelect) {
                        fieldSelect.innerHTML = '<option value="">Select measurement first</option>';
                    }
                }
            });
        }

        const field = document.getElementById('analyticsField');
        if (field) {
            field.addEventListener('change', (e) => {
                this.config.field = e.target.value;
                this.saveConfiguration();
            });
        }

        const timeRange = document.getElementById('analyticsTimeRange');
        if (timeRange) {
            timeRange.addEventListener('change', (e) => {
                this.config.timeRange = e.target.value;
                this.saveConfiguration();
            });
        }

        // Alert threshold slider
        const alertThreshold = document.getElementById('alertThreshold');
        const thresholdValue = document.getElementById('thresholdValue');
        if (alertThreshold && thresholdValue) {
            alertThreshold.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.config.alertThreshold = value;
                thresholdValue.textContent = value.toFixed(1);
                this.saveConfiguration();
            });
        }

        // Run analysis button
        const runButton = document.getElementById('runAnalysis');
        if (runButton) {
            runButton.addEventListener('click', () => this.runAnalysis());
        }

        // Measurement and field selectors
        const measurementSelect = document.getElementById('analyticsMeasurement');
        if (measurementSelect) {
            measurementSelect.addEventListener('change', (e) => {
                this.config.measurement = e.target.value;
                this.loadFieldsForMeasurement(e.target.value);
                this.saveConfiguration();
                this.updateAnalysisButton();
            });
        }

        const fieldSelect = document.getElementById('analyticsField');
        if (fieldSelect) {
            fieldSelect.addEventListener('change', (e) => {
                this.config.field = e.target.value;
                this.saveConfiguration();
                this.updateAnalysisButton();
            });
        }
    },

    // Load saved configuration
    loadConfiguration() {
        const savedConfig = localStorage.getItem('analytics_config');
        if (savedConfig) {
            try {
                const parsed = JSON.parse(savedConfig);
                this.config = { ...this.config, ...parsed };
                console.log('📋 Loaded analytics configuration');
            } catch (error) {
                console.warn('Failed to load analytics config:', error);
            }
        }
    },

    // Save configuration to localStorage
    saveConfiguration() {
        localStorage.setItem('analytics_config', JSON.stringify(this.config));
    },

    // Update UI elements with current state
    updateUI() {
        // Update AI connection card display
        this.updateAiConnectionCard();

        // Update form values in modal
        const aiEndpoint = document.getElementById('aiEndpoint');
        if (aiEndpoint) aiEndpoint.value = this.config.ollamaEndpoint;

        const aiModel = document.getElementById('aiModel');
        if (aiModel) aiModel.value = this.config.selectedModel;

        const aiResponseTokens = document.getElementById('aiResponseTokens');
        if (aiResponseTokens) aiResponseTokens.value = this.config.numPredict;

        const aiContextSize = document.getElementById('aiContextSize');
        if (aiContextSize) aiContextSize.value = this.config.numCtx;

        const retentionPolicy = document.getElementById('analyticsRetentionPolicy');
        if (retentionPolicy) retentionPolicy.value = this.config.retentionPolicy;

        const timeRange = document.getElementById('analyticsTimeRange');
        if (timeRange) timeRange.value = this.config.timeRange;

        const alertThreshold = document.getElementById('alertThreshold');
        const thresholdValue = document.getElementById('thresholdValue');
        if (alertThreshold) alertThreshold.value = this.config.alertThreshold;
        if (thresholdValue) thresholdValue.textContent = this.config.alertThreshold.toFixed(1);

        // Update analysis type
        this.setAnalysisType(this.config.analysisType);

        // Update connection status in title bar and card
        this.updateConnectionStatus();
        this.updateTitleBarStatus();

        // Update model info
        this.updateModelInfo();

        // Populate datasource selector
        this.populateAnalyticsDatasourceSelect();

        // Load measurements from current datasource
        this.loadMeasurements();
        
        // Load retention policies from current datasource
        this.loadRetentionPolicies();
        
        // Check for existing AI connections
        this.checkAiConnection().catch(error => {
            console.warn('Failed to check AI connections:', error);
        });
    },

    // Check if we have any connected AI services and initialize them
    async checkAiConnection() {
        const aiConnections = JSON.parse(localStorage.getItem('aiConnections') || '[]');
        const activeConnectionId = localStorage.getItem('activeAiConnection');
        
        // Check if we have an active connection
        if (activeConnectionId) {
            const activeConnection = aiConnections.find(conn => conn.id === activeConnectionId && conn.status === 'connected');
            if (activeConnection) {
                return await this.initializeAiConnection(activeConnection);
            }
        }
        
        // Check if any connection is connected
        const connectedConnection = aiConnections.find(conn => conn.status === 'connected');
        if (connectedConnection) {
            localStorage.setItem('activeAiConnection', connectedConnection.id);
            return await this.initializeAiConnection(connectedConnection);
        }
        
        this.isConnected = false;
        this.updateTitleBarStatus();
        this.updateAnalysisButton();
        return false;
    },

    // Initialize AI connection and Ollama service
    async initializeAiConnection(connection) {
        try {
            this.config.ollamaEndpoint = connection.endpoint;
            this.config.selectedModel = connection.model;
            
            // Actually initialize the Ollama service
            await OllamaService.initialize(connection.endpoint, connection.model);
            
            this.isConnected = true;
            console.log('✅ AI service initialized:', connection.name, 'at', connection.endpoint);
            this.updateTitleBarStatus();
            this.updateAnalysisButton();
            return true;
            
        } catch (error) {
            console.warn('⚠️ Failed to initialize AI connection:', connection.name, error.message);
            
            // Update connection status to disconnected since it failed
            const aiConnections = JSON.parse(localStorage.getItem('aiConnections') || '[]');
            const connectionIndex = aiConnections.findIndex(conn => conn.id === connection.id);
            if (connectionIndex !== -1) {
                aiConnections[connectionIndex].status = 'disconnected';
                localStorage.setItem('aiConnections', JSON.stringify(aiConnections));
                
                // Reload AI connections UI if it exists
                setTimeout(() => {
                    if (typeof loadAiConnections === 'function') {
                        loadAiConnections();
                    }
                }, 100);
            }
            
            this.isConnected = false;
            this.updateTitleBarStatus();
            this.updateAnalysisButton();
            return false;
        }
    },

    // Test Ollama connection
    async testOllamaConnection() {
        console.log('🔍 Testing Ollama connection...');
        
        const statusIndicator = document.querySelector('#aiConnectionStatus .status-indicator');
        const statusText = document.getElementById('aiStatusText');
        const testButton = document.getElementById('testAiConnection');

        // Update UI to show testing state
        if (statusIndicator) {
            statusIndicator.className = 'status-indicator connecting';
        }
        if (statusText) {
            statusText.textContent = 'Testing...';
        }
        if (testButton) {
            testButton.disabled = true;
            testButton.title = 'Testing...';
        }

        try {
            await OllamaService.initialize(this.config.ollamaEndpoint, this.config.selectedModel);
            this.isConnected = true;
            
            // Update UI for success
            if (statusIndicator) {
                statusIndicator.className = 'status-indicator connected';
            }
            if (statusText) {
                statusText.textContent = 'Connected';
            }
            
            this.updateTitleBarStatus();
            this.updateAnalysisButton();
            console.log('✅ Ollama connection successful');
            
        } catch (error) {
            this.isConnected = false;
            
            // Update UI for failure
            if (statusIndicator) {
                statusIndicator.className = 'status-indicator offline';
            }
            if (statusText) {
                statusText.textContent = error.message;
            }
            
            this.updateTitleBarStatus();
            console.error('❌ Ollama connection failed:', error);
        } finally {
            // Reset test button
            if (testButton) {
                testButton.disabled = false;
                testButton.title = 'Test Connection';
            }
        }
    },

    // Update connection status display in AI connection card
    updateConnectionStatus() {
        const statusIndicator = document.querySelector('#aiConnectionStatus .status-indicator');
        const statusText = document.getElementById('aiStatusText');

        if (this.isConnected) {
            if (statusIndicator) statusIndicator.className = 'status-indicator connected';
            if (statusText) statusText.textContent = 'Connected';
        } else {
            if (statusIndicator) statusIndicator.className = 'status-indicator offline';
            if (statusText) statusText.textContent = 'Not Connected';
        }
    },

    // Update AI connection status in title bar
    updateTitleBarStatus() {
        const titleBarStatus = document.getElementById('titleBarAiStatus');
        if (titleBarStatus) {
            if (this.isConnected) {
                titleBarStatus.className = 'connection-status ai-connected';
                titleBarStatus.textContent = 'AI: Connected';
            } else {
                titleBarStatus.className = 'connection-status ai-disconnected';
                titleBarStatus.textContent = 'AI: Not Connected';
            }
        }
    },

    // Update AI connection card display
    updateAiConnectionCard() {
        const connectionName = document.getElementById('aiConnectionName');
        const connectionUrl = document.getElementById('aiConnectionUrl');
        const currentModel = document.getElementById('currentAiModel');

        if (connectionName) connectionName.textContent = 'Ollama AI Service';
        if (connectionUrl) connectionUrl.textContent = this.config.ollamaEndpoint;
        if (currentModel) currentModel.textContent = this.config.selectedModel;
    },

    // Show AI connection settings dialog
    showAiConnectionDialog() {
        const dialog = document.getElementById('aiConnectionDialog');
        if (dialog) {
            // Update dialog values with current config
            const aiEndpoint = document.getElementById('aiEndpoint');
            const aiModel = document.getElementById('aiModel');
            const aiResponseTokens = document.getElementById('aiResponseTokens');
            const aiContextSize = document.getElementById('aiContextSize');

            if (aiEndpoint) aiEndpoint.value = this.config.ollamaEndpoint;
            if (aiModel) aiModel.value = this.config.selectedModel;
            if (aiResponseTokens) aiResponseTokens.value = this.config.numPredict;
            if (aiContextSize) aiContextSize.value = this.config.numCtx;

            this.toggleCustomModelField();
            dialog.style.display = 'block';
        }
    },

    // Hide AI connection settings dialog
    hideAiConnectionDialog() {
        const dialog = document.getElementById('aiConnectionDialog');
        if (dialog) {
            dialog.style.display = 'none';
        }
    },

    // Toggle custom model field visibility
    toggleCustomModelField() {
        const aiModel = document.getElementById('aiModel');
        const customModelGroup = document.getElementById('customModelGroup');
        
        if (aiModel && customModelGroup) {
            if (aiModel.value === 'custom') {
                customModelGroup.style.display = 'block';
            } else {
                customModelGroup.style.display = 'none';
            }
        }
    },

    // Save AI connection settings from dialog
    async saveAiConnection() {
        const aiEndpoint = document.getElementById('aiEndpoint');
        const aiModel = document.getElementById('aiModel');
        const customModelName = document.getElementById('customModelName');
        const aiResponseTokens = document.getElementById('aiResponseTokens');
        const aiContextSize = document.getElementById('aiContextSize');

        if (aiEndpoint) this.config.ollamaEndpoint = aiEndpoint.value;
        
        if (aiModel) {
            if (aiModel.value === 'custom' && customModelName && customModelName.value) {
                this.config.selectedModel = customModelName.value;
            } else {
                this.config.selectedModel = aiModel.value;
            }
        }
        
        if (aiResponseTokens) this.config.numPredict = parseInt(aiResponseTokens.value);
        if (aiContextSize) this.config.numCtx = parseInt(aiContextSize.value);

        this.saveConfiguration();
        this.updateAiConnectionCard();
        this.hideAiConnectionDialog();

        // Test the connection
        await this.testOllamaConnection();
    },

    // Set analysis type and update UI
    setAnalysisType(type) {
        this.config.analysisType = type;
        this.saveConfiguration();

        // Update tab buttons
        document.querySelectorAll('.tab-button[data-analysis]').forEach(button => {
            button.classList.remove('active');
            if (button.dataset.analysis === type) {
                button.classList.add('active');
            }
        });

        // Update options panels
        document.querySelectorAll('.analysis-options').forEach(panel => {
            panel.classList.remove('active');
        });

        const activePanel = document.getElementById(`${type}Options`);
        if (activePanel) {
            activePanel.classList.add('active');
        }

        this.updateAnalysisButton();
    },

    // Update model information display
    updateModelInfo() {
        const modelInfo = ModelManager.supportedModels[this.config.selectedModel];
        if (modelInfo) {
            console.log('📋 Model info:', {
                name: modelInfo.name,
                capabilities: modelInfo.capabilities,
                requirements: modelInfo.ramRequired
            });
        }
    },

    // Load measurements from current datasource
    async loadMeasurements() {
        const measurementSelect = document.getElementById('analyticsMeasurement');
        if (!measurementSelect) return;

        if (!GrafanaConfig.connected || !GrafanaConfig.currentDatasourceId) {
            measurementSelect.innerHTML = '<option value="">Connect to datasource first</option>';
            return;
        }

        console.log('📊 Loading measurements for analytics...', {
            connected: GrafanaConfig.connected,
            datasourceId: GrafanaConfig.currentDatasourceId,
            schemaLoaded: typeof Schema !== 'undefined' && !!Schema.loadedSchema
        });

        try {
            // Ensure Schema is available
            if (typeof Schema === 'undefined') {
                console.error('❌ Schema module not available');
                measurementSelect.innerHTML = '<option value="">Schema module unavailable</option>';
                return;
            }

            // Show loading state
            measurementSelect.innerHTML = '<option value="">Loading measurements...</option>';

            // Use the proper Schema loading mechanism
            await Schema.loadSchemaIfNeeded();

            // Check if we have measurements loaded
            if (GrafanaConfig.selectedDatasourceType === 'influxdb' && Schema.influxMeasurements.length > 0) {
                const measurements = Schema.influxMeasurements;
                console.log('📋 Found measurements:', measurements);
                
                measurementSelect.innerHTML = '<option value="">Select measurement...</option>';
                measurements.forEach(measurement => {
                    const option = document.createElement('option');
                    option.value = measurement;
                    option.textContent = measurement;
                    if (measurement === this.config.measurement) {
                        option.selected = true;
                    }
                    measurementSelect.appendChild(option);
                });

                // Load fields if measurement is already selected
                if (this.config.measurement) {
                    this.loadFieldsForMeasurement(this.config.measurement);
                }
            } else if (GrafanaConfig.selectedDatasourceType === 'prometheus' && Schema.prometheusMetrics.length > 0) {
                // For Prometheus, use metrics as "measurements"
                const metrics = Schema.prometheusMetrics;
                console.log('📋 Found Prometheus metrics:', metrics.slice(0, 10));
                
                measurementSelect.innerHTML = '<option value="">Select metric...</option>';
                metrics.slice(0, 100).forEach(metric => { // Limit to first 100 for performance
                    const option = document.createElement('option');
                    option.value = metric;
                    option.textContent = metric;
                    if (metric === this.config.measurement) {
                        option.selected = true;
                    }
                    measurementSelect.appendChild(option);
                });
            } else {
                console.warn('⚠️ No measurements/metrics found for datasource type:', GrafanaConfig.selectedDatasourceType);
                measurementSelect.innerHTML = '<option value="">No measurements found</option>';
            }
        } catch (error) {
            console.error('❌ Failed to load measurements:', error);
            measurementSelect.innerHTML = '<option value="">Error loading measurements</option>';
        }
    },

    // Load retention policies from current datasource
    async loadRetentionPolicies() {
        const retentionPolicySelect = document.getElementById('analyticsRetentionPolicy');
        if (!retentionPolicySelect) return;

        // Only show retention policies for InfluxDB
        if (GrafanaConfig.selectedDatasourceType !== 'influxdb') {
            retentionPolicySelect.innerHTML = '<option value="">N/A for this datasource type</option>';
            return;
        }

        if (!GrafanaConfig.connected || !GrafanaConfig.currentDatasourceId) {
            retentionPolicySelect.innerHTML = '<option value="">Connect to InfluxDB first</option>';
            return;
        }

        try {
            // Ensure Schema is available and properly initialized
            if (typeof Schema === 'undefined') {
                console.error('❌ Schema module not available');
                retentionPolicySelect.innerHTML = '<option value="">Schema module unavailable</option>';
                return;
            }

            // Show loading state
            retentionPolicySelect.innerHTML = '<option value="">Loading retention policies...</option>';

            // Use the proper Schema loading mechanism
            await Schema.loadSchemaIfNeeded();

            // Check if we have retention policies loaded
            if (Schema.influxRetentionPolicies && Schema.influxRetentionPolicies.length > 0) {
                const retentionPolicies = Schema.influxRetentionPolicies;
                console.log('📋 Found retention policies:', retentionPolicies);
                
                // Clear loading state and populate with real data
                retentionPolicySelect.innerHTML = '';
                
                // Add each retention policy as an option
                retentionPolicies.forEach(policy => {
                    const option = document.createElement('option');
                    option.value = policy;
                    option.textContent = policy;
                    if (policy === this.config.retentionPolicy) {
                        option.selected = true;
                    }
                    retentionPolicySelect.appendChild(option);
                });

                // If no policy is selected but we have policies, select the first one
                if (!this.config.retentionPolicy && retentionPolicies.length > 0) {
                    this.config.retentionPolicy = retentionPolicies[0];
                    retentionPolicySelect.value = retentionPolicies[0];
                    this.saveConfiguration();
                }
            } else {
                console.warn('⚠️ No retention policies found in schema');
                retentionPolicySelect.innerHTML = '<option value="">No retention policies found</option>';
            }
        } catch (error) {
            console.error('❌ Failed to load retention policies:', error);
            retentionPolicySelect.innerHTML = '<option value="">Error loading retention policies</option>';
        }
    },

    // Load fields for selected measurement
    async loadFieldsForMeasurement(measurement) {
        const fieldSelect = document.getElementById('analyticsField');
        if (!fieldSelect || !measurement) {
            if (fieldSelect) fieldSelect.innerHTML = '<option value="">Select measurement first</option>';
            return;
        }

        console.log('📋 Loading fields for measurement:', measurement);

        try {
            if (typeof Schema !== 'undefined') {
                let fields = [];
                
                if (GrafanaConfig.selectedDatasourceType === 'influxdb') {
                    // For InfluxDB, get fields from the Schema.influxFields
                    fields = Schema.influxFields[measurement] || [];
                    console.log('📊 Found InfluxDB fields for', measurement, ':', fields);
                } else if (GrafanaConfig.selectedDatasourceType === 'prometheus') {
                    // For Prometheus, metrics don't have traditional "fields" - they have labels
                    // For analytics purposes, we'll treat the metric itself as the "field"
                    fields = [measurement]; // The metric name itself is the "field"
                    console.log('📊 Using Prometheus metric as field:', measurement);
                }
                
                fieldSelect.innerHTML = '<option value="">Select field...</option>';
                
                // Add fields with data availability checking
                if (fields.length > 0) {
                    // Check if we can validate data availability for fields
                    const fieldsWithData = await this.checkFieldsForData(measurement, fields);
                    
                    fields.forEach(field => {
                        const option = document.createElement('option');
                        option.value = field;
                        
                        // Indicate if field has recent data
                        const hasData = fieldsWithData.includes(field);
                        option.textContent = hasData ? `${field} ✓` : field;
                        if (!hasData) {
                            option.style.color = '#888888';
                            option.title = 'No recent data found for this field';
                        }
                        
                        if (field === this.config.field) {
                            option.selected = true;
                        }
                        fieldSelect.appendChild(option);
                    });
                    
                    // Add helper text
                    if (fieldsWithData.length > 0) {
                        const helperOption = document.createElement('option');
                        helperOption.disabled = true;
                        helperOption.textContent = `─── ${fieldsWithData.length} fields with recent data ✓ ───`;
                        helperOption.style.fontStyle = 'italic';
                        fieldSelect.insertBefore(helperOption, fieldSelect.children[1]);
                    }
                }
                
                if (fields.length === 0) {
                    // Try to load fields if they haven't been loaded yet for InfluxDB
                    if (GrafanaConfig.selectedDatasourceType === 'influxdb') {
                        console.log('🔄 Fields not found, attempting to load for measurement:', measurement);
                        fieldSelect.innerHTML = '<option value="">Loading fields...</option>';
                        
                        // Trigger field loading for this measurement
                        Schema.loadMeasurementFieldsAndTags(measurement).then(() => {
                            // Retry loading fields after schema load
                            setTimeout(() => this.loadFieldsForMeasurement(measurement), 500);
                        }).catch(error => {
                            console.error('Failed to load fields for measurement:', error);
                            fieldSelect.innerHTML = '<option value="">No fields found</option>';
                        });
                    } else {
                        fieldSelect.innerHTML = '<option value="">No fields found</option>';
                    }
                }
            } else {
                console.warn('⚠️ Schema module not available');
                fieldSelect.innerHTML = '<option value="">Schema module not available</option>';
            }
        } catch (error) {
            console.error('❌ Failed to load fields:', error);
            fieldSelect.innerHTML = '<option value="">Error loading fields</option>';
        }
    },

    // Check which fields have recent data
    async checkFieldsForData(measurement, fields) {
        if (!fields || fields.length === 0) return [];
        
        console.log('🔍 Checking fields for recent data...', { measurement, fieldCount: fields.length });
        
        const fieldsWithData = [];
        const maxFieldsToCheck = 10; // Limit to avoid too many API calls
        const fieldsToCheck = fields.slice(0, maxFieldsToCheck);
        
        try {
            // Check fields in parallel for better performance
            const dataChecks = fieldsToCheck.map(async (field) => {
                try {
                    // Quick query to check if field has data in last 24h
                    const testQuery = this.buildQuickDataCheckQuery(measurement, field);
                    
                    if (typeof Queries !== 'undefined') {
                        const result = await Queries.executeQuery(testQuery, {
                            datasourceId: GrafanaConfig.currentDatasourceId,
                            datasourceType: GrafanaConfig.selectedDatasourceType,
                            timeout: 5000 // Short timeout for quick check
                        });
                        
                        // Check if we got any data points
                        const dataPoints = this.extractTimeSeriesData(result);
                        if (dataPoints && dataPoints.length > 0) {
                            return field;
                        }
                    }
                } catch (error) {
                    console.warn(`Data check failed for field ${field}:`, error.message);
                }
                return null;
            });
            
            const results = await Promise.all(dataChecks);
            fieldsWithData.push(...results.filter(field => field !== null));
            
            console.log('📊 Fields with recent data:', fieldsWithData);
            
        } catch (error) {
            console.warn('Failed to check field data availability:', error);
        }
        
        return fieldsWithData;
    },

    // Build a quick query to check if a field has recent data
    buildQuickDataCheckQuery(measurement, field) {
        if (GrafanaConfig.selectedDatasourceType === 'influxdb') {
            const retentionPolicy = this.config.retentionPolicy || 'raw';
            return `SELECT mean("${field}") as "value" FROM "${retentionPolicy}"."${measurement}" WHERE time >= now() - 24h GROUP BY time(1h) fill(none) LIMIT 5`;
        } else if (GrafanaConfig.selectedDatasourceType === 'prometheus') {
            return `${measurement}[1h]`;
        }
        return '';
    },

    // Extract time series data from query result
    extractTimeSeriesData(result) {
        if (!result || !result.results || !result.results.A) {
            return [];
        }
        
        const frames = result.results.A.frames || [];
        const data = [];
        
        for (const frame of frames) {
            if (!frame.data || !frame.data.values || frame.data.values.length < 2) {
                continue;
            }
            
            const timeColumn = frame.data.values[0];
            const valueColumn = frame.data.values[1];
            
            for (let i = 0; i < timeColumn.length; i++) {
                if (timeColumn[i] && valueColumn[i] !== null && valueColumn[i] !== undefined) {
                    data.push({
                        timestamp: new Date(timeColumn[i]).toISOString(),
                        value: Number(valueColumn[i])
                    });
                }
            }
        }
        
        return data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    },

    // Update analysis button state
    updateAnalysisButton() {
        const runButton = document.getElementById('runAnalysis');
        if (!runButton) return;

        const canRun = this.isConnected && 
                      this.config.measurement && 
                      this.config.field && 
                      !this.isAnalysisRunning &&
                      GrafanaConfig.connected;

        runButton.disabled = !canRun;
        
        if (!this.isConnected) {
            runButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>Connect to AI Service First';
            runButton.onclick = () => {
                if (typeof showNewAiConnectionDialog === 'function') {
                    showNewAiConnectionDialog();
                } else {
                    alert('Please add an AI connection first');
                }
            };
        } else if (!GrafanaConfig.connected) {
            runButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>Connect to Grafana First';
            runButton.onclick = null;
        } else if (!this.config.measurement || !this.config.field) {
            runButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>Select Measurement & Field';
            runButton.onclick = null;
        } else if (this.isAnalysisRunning) {
            runButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>Analyzing...';
            runButton.onclick = null;
        } else {
            runButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>Run Analysis';
            runButton.onclick = () => this.runAnalysis();
        }
    },

    // Main analysis execution
    async runAnalysis() {
        if (this.isAnalysisRunning) return;

        console.log('🚀 Starting AI analysis...', {
            type: this.config.analysisType,
            measurement: this.config.measurement,
            field: this.config.field,
            timeRange: this.config.timeRange
        });

        this.isAnalysisRunning = true;
        this.updateAnalysisButton();

        const resultsContainer = document.getElementById('analyticsResults');
        const resultsContent = document.getElementById('analyticsResultsContent');

        try {
            // Show loading in modal
            this.showLoadingModal();

            // Validate configuration
            this.validateAnalysisConfig();

            // Execute AI analysis using the AI Analytics engine
            const results = await AIAnalytics.executeAnalysis({
                analysisType: this.config.analysisType,
                retentionPolicy: this.config.retentionPolicy,
                measurement: this.config.measurement,
                field: this.config.field,
                timeRange: this.config.timeRange,
                tags: this.config.tags,
                sensitivity: this.config.sensitivity,
                alertThreshold: this.config.alertThreshold,
                forecastHorizon: this.config.forecastHorizon,
                confidenceLevel: this.config.confidenceLevel,
                trendDepth: this.config.trendDepth,
                numPredict: this.config.numPredict,
                numCtx: this.config.numCtx
            });

            // Store results for export
            this.currentResults = results;

            // Show results in modal
            this.showResultsModal(results);

            console.log('✅ Analysis completed successfully');
            
        } catch (error) {
            console.error('❌ Analysis failed:', error);
            this.showError(error.message);
        } finally {
            this.isAnalysisRunning = false;
            this.updateAnalysisButton();
        }
    },

    // Validate analysis configuration
    validateAnalysisConfig() {
        if (!this.config.measurement) {
            throw new Error('Please select a measurement');
        }
        
        if (!this.config.field) {
            throw new Error('Please select a field');
        }
        
        if (!GrafanaConfig.connected) {
            throw new Error('Please connect to a Grafana datasource');
        }
        
        if (!this.isConnected) {
            throw new Error('Please test your Ollama connection first');
        }
    },

    // Get loading HTML
    getLoadingHTML() {
        return `
            <div class="analysis-loading">
                <div class="loading-spinner"></div>
                <h4>🤖 AI Analysis in Progress</h4>
                <div class="loading-steps">
                    <div class="loading-step active" id="step-fetching">📊 Fetching time series data...</div>
                    <div class="loading-step" id="step-preprocessing">🔄 Preprocessing data...</div>
                    <div class="loading-step" id="step-ai">🧠 Running AI analysis...</div>
                    <div class="loading-step" id="step-visualization">📈 Generating visualizations...</div>
                </div>
                <div class="loading-config">
                    <strong>Analysis Configuration:</strong><br>
                    Type: ${this.config.analysisType}<br>
                    Model: ${this.config.selectedModel}<br>
                    Data: ${this.config.measurement}.${this.config.field}<br>
                    Range: ${this.config.timeRange}
                </div>
            </div>
        `;
    },

    // Show loading modal
    showLoadingModal() {
        const modalHtml = `
            <div class="modal-overlay active" id="analyticsLoadingModal">
                <div class="modal analytics-loading-modal">
                    <div class="modal-content">
                        ${this.getLoadingHTML()}
                    </div>
                </div>
            </div>
        `;
        
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer.firstElementChild);
    },

    // Close loading modal
    closeLoadingModal() {
        const modal = document.getElementById('analyticsLoadingModal');
        if (modal) {
            modal.remove();
        }
    },

    // Show raw results fallback
    showRawResults(results) {
        const resultsContent = document.getElementById('analyticsResultsContent');
        if (!resultsContent) return;

        resultsContent.innerHTML = `
            <div class="raw-results">
                <div class="results-header">
                    <h4>📊 ${this.config.analysisType.charAt(0).toUpperCase() + this.config.analysisType.slice(1)} Analysis Results</h4>
                    <div class="results-meta">
                        Generated: ${new Date().toLocaleString()}<br>
                        Model: ${this.config.selectedModel}<br>
                        Data: ${this.config.measurement}.${this.config.field}
                    </div>
                </div>
                <div class="results-content">
                    <pre>${JSON.stringify(results, null, 2)}</pre>
                </div>
                <div class="results-actions">
                    <button onclick="Analytics.exportResults('json')" class="secondary-button">📄 Export JSON</button>
                    <button onclick="Analytics.copyResults()" class="secondary-button">📋 Copy to Clipboard</button>
                </div>
            </div>
        `;
    },

    // Export results
    exportResults(format) {
        if (!this.currentResults) {
            console.warn('No results to export');
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `analytics-${this.config.analysisType}-${timestamp}`;

        if (format === 'json') {
            const data = JSON.stringify(this.currentResults, null, 2);
            this.downloadFile(data, `${filename}.json`, 'application/json');
        } else if (format === 'csv') {
            const csv = this.convertResultsToCSV(this.currentResults);
            this.downloadFile(csv, `${filename}.csv`, 'text/csv');
        }
    },

    // Copy results to clipboard
    async copyResults() {
        if (!this.currentResults) {
            console.warn('No results to copy');
            return;
        }

        try {
            const text = JSON.stringify(this.currentResults, null, 2);
            await navigator.clipboard.writeText(text);
            
            // Show feedback
            const button = event.target;
            const originalText = button.textContent;
            button.textContent = '✅ Copied!';
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
        }
    },

    // Convert results to CSV format
    convertResultsToCSV(results) {
        const rows = [];
        
        if (results.anomalies) {
            rows.push(['Type', 'Timestamp', 'Value', 'Score', 'Severity', 'Explanation']);
            results.anomalies.forEach(anomaly => {
                rows.push([
                    'anomaly',
                    anomaly.timestamp,
                    anomaly.value,
                    anomaly.score,
                    anomaly.severity,
                    anomaly.explanation
                ]);
            });
        } else if (results.predictions) {
            rows.push(['Type', 'Timestamp', 'Predicted Value', '80% Lower', '80% Upper', '95% Lower', '95% Upper']);
            results.predictions.forEach(pred => {
                rows.push([
                    'prediction',
                    pred.timestamp,
                    pred.predicted_value,
                    pred.confidence_80_lower,
                    pred.confidence_80_upper,
                    pred.confidence_95_lower,
                    pred.confidence_95_upper
                ]);
            });
        }
        
        return rows.map(row => row.map(field => `"${field}"`).join(',')).join('\n');
    },

    // Download file helper
    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // Show results in modal (similar to Dashboard panel viewer)
    showResultsModal(results) {
        console.log('📊 Showing analytics results in modal');
        
        // Close loading modal first
        this.closeLoadingModal();
        
        // Create modal HTML
        const modalHtml = `
            <div class="modal-overlay active" id="analyticsResultsModal">
                <div class="modal analytics-results-modal">
                    <div class="modal-header">
                        <h3>${this.config.analysisType.charAt(0).toUpperCase() + this.config.analysisType.slice(1)} Analysis Results</h3>
                        <button class="modal-close" onclick="Analytics.closeResultsModal()">×</button>
                    </div>
                    <div class="modal-content analytics-modal-content">
                        <div class="analytics-results-info">
                            <div class="info-item">
                                <strong>Data:</strong> ${this.config.measurement}.${this.config.field}
                            </div>
                            <div class="info-item">
                                <strong>Time Range:</strong> ${this.config.timeRange}
                            </div>
                            <div class="info-item">
                                <strong>Model:</strong> ${this.config.selectedModel}
                            </div>
                        </div>
                        <div class="analytics-results-body" id="analyticsModalResults">
                            <!-- Results will be rendered here -->
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="secondary-button" onclick="Analytics.exportResults('json')">📄 Export JSON</button>
                        <button class="secondary-button" onclick="Analytics.exportResults('csv')">📊 Export CSV</button>
                        <button class="primary-button" onclick="Analytics.closeResultsModal()">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to body
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer.firstElementChild);
        
        // Render results
        if (typeof AnalyticsVisualizer !== 'undefined') {
            AnalyticsVisualizer.visualizeResults(results, 'analyticsModalResults');
        } else {
            this.showRawResultsInModal(results);
        }
    },

    // Close results modal
    closeResultsModal() {
        const modal = document.getElementById('analyticsResultsModal');
        if (modal) {
            modal.remove();
        }
    },

    // Show raw results in modal
    showRawResultsInModal(results) {
        const resultsContent = document.getElementById('analyticsModalResults');
        if (!resultsContent) return;

        resultsContent.innerHTML = `
            <div class="raw-results">
                <div class="results-content">
                    <pre>${JSON.stringify(results, null, 2)}</pre>
                </div>
            </div>
        `;
    },

    // Show error message with suggestions
    showError(message) {
        // Show error in modal
        const errorHtml = `
            <div class="modal-overlay active" id="analyticsErrorModal">
                <div class="modal analytics-error-modal">
                    <div class="modal-header">
                        <h3>❌ Analysis Error</h3>
                        <button class="modal-close" onclick="Analytics.closeErrorModal()">×</button>
                    </div>
                    <div class="modal-content">
                        <div class="analysis-error">
                            <p>${message}</p>
                            ${this.getErrorSuggestions(message)}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="primary-button" onclick="Analytics.closeErrorModal()">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        // Close loading modal if open
        this.closeLoadingModal();
        
        // Add error modal to body
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = errorHtml;
        document.body.appendChild(modalContainer.firstElementChild);
    },

    // Close error modal
    closeErrorModal() {
        const modal = document.getElementById('analyticsErrorModal');
        if (modal) {
            modal.remove();
        }
    },

    // Get error suggestions
    getErrorSuggestions(message) {
        let suggestions = '';
        
        // If it's a "no data found" error, provide helpful suggestions
        if (message.includes('No data found')) {
            suggestions = `
                <div class="error-suggestions">
                    <h5>💡 Suggestions:</h5>
                    <ul>
                        <li>Try selecting a different field - look for fields marked with ✓ in the dropdown</li>
                        <li>Reduce the time range to 1 hour or 1 day to find recent data</li>
                        <li>Check if the measurement actually contains data in the selected time period</li>
                        <li>Verify that the datasource is properly connected and accessible</li>
                    </ul>
                    <button onclick="Analytics.suggestWorkingFields()" class="secondary-button" style="margin-top: 10px;">
                        🔍 Find Fields with Data
                    </button>
                </div>
            `;
        }
        
        return suggestions;
    },

    // Suggest working fields for analysis
    async suggestWorkingFields() {
        console.log('🔍 Looking for fields with data...');
        
        const measurementSelect = document.getElementById('analyticsMeasurement');
        const fieldSelect = document.getElementById('analyticsField');
        
        if (!measurementSelect || !fieldSelect || !GrafanaConfig.connected) {
            console.warn('Cannot suggest fields - connection or elements missing');
            return;
        }
        
        try {
            // Show loading state
            fieldSelect.innerHTML = '<option value="">🔍 Searching for fields with data...</option>';
            
            // Get current measurement or try a few popular ones
            const currentMeasurement = measurementSelect.value;
            const measurementsToTry = currentMeasurement ? 
                [currentMeasurement] : 
                this.getPopularMeasurements();
            
            let foundFields = [];
            
            for (const measurement of measurementsToTry) {
                console.log(`Checking measurement: ${measurement}`);
                
                // Load fields for this measurement if not already loaded
                if (typeof Schema !== 'undefined') {
                    const fields = Schema.influxFields[measurement] || [];
                    
                    if (fields.length > 0) {
                        const fieldsWithData = await this.checkFieldsForData(measurement, fields);
                        
                        if (fieldsWithData.length > 0) {
                            foundFields = foundFields.concat(
                                fieldsWithData.map(field => ({ measurement, field }))
                            );
                        }
                    }
                }
                
                // Stop after finding some fields or checking max measurements
                if (foundFields.length >= 5 || measurementsToTry.indexOf(measurement) >= 2) {
                    break;
                }
            }
            
            if (foundFields.length > 0) {
                // Update measurement and field selects with found data
                const firstFound = foundFields[0];
                
                if (!currentMeasurement) {
                    measurementSelect.value = firstFound.measurement;
                    this.config.measurement = firstFound.measurement;
                }
                
                // Reload fields for the measurement
                await this.loadFieldsForMeasurement(firstFound.measurement);
                
                // Select the first field with data
                fieldSelect.value = firstFound.field;
                this.config.field = firstFound.field;
                
                this.saveConfiguration();
                this.updateAnalysisButton();
                
                console.log(`✅ Found ${foundFields.length} fields with data. Selected: ${firstFound.measurement}.${firstFound.field}`);
                
                // Show success message
                if (typeof Interface !== 'undefined' && Interface.showToast) {
                    Interface.showToast(`Found ${foundFields.length} fields with data. Selected: ${firstFound.measurement}.${firstFound.field}`, 'success');
                } else {
                    console.log(`✅ Selected field with data: ${firstFound.measurement}.${firstFound.field}`);
                }
                
            } else {
                console.warn('❌ No fields with recent data found');
                fieldSelect.innerHTML = '<option value="">No fields with recent data found</option>';
                
                // Show warning message
                if (typeof Interface !== 'undefined' && Interface.showToast) {
                    Interface.showToast('No fields with recent data found. Try a longer time range or different measurement.', 'warning');
                } else {
                    console.warn('❌ No fields with recent data found');
                }
            }
            
        } catch (error) {
            console.error('Failed to suggest working fields:', error);
            fieldSelect.innerHTML = '<option value="">Error searching for fields</option>';
        }
    },

    // Get list of commonly used measurement names to try
    getPopularMeasurements() {
        if (typeof Schema !== 'undefined' && Schema.influxMeasurements.length > 0) {
            // Return first few measurements from schema
            return Schema.influxMeasurements.slice(0, 5);
        }
        
        // Fallback list of common measurement names
        return [
            'prometheus',
            'cpu',
            'memory', 
            'disk',
            'network',
            'system',
            'application',
            'metrics'
        ];
    },

    // Populate the analytics datasource selector
    populateAnalyticsDatasourceSelect() {
        const datasourceSelect = document.getElementById('analyticsDatasource');
        if (!datasourceSelect) return;
        
        // Clear existing options
        datasourceSelect.innerHTML = '<option value="">Select data source</option>';
        
        // Add datasources from the datasource list (only from the sidebar)
        const datasourceList = document.getElementById('datasourceList');
        if (datasourceList) {
            const datasourceItems = datasourceList.querySelectorAll('.datasource-item');
            console.log('📊 Found datasource items for Analytics:', datasourceItems.length);
            datasourceItems.forEach(item => {
                if (item.dataset.uid && item.dataset.name) {
                    const option = document.createElement('option');
                    option.value = item.dataset.uid;
                    option.textContent = item.dataset.name;
                    datasourceSelect.appendChild(option);
                    console.log('📊 Added datasource option to Analytics:', item.dataset.name);
                }
            });
            
            // Set current selection based on global config
            if (GrafanaConfig.currentDatasourceId) {
                datasourceSelect.value = GrafanaConfig.currentDatasourceId;
                console.log('📊 Set Analytics datasource to:', GrafanaConfig.currentDatasourceId);
            }
        }
    },

    // Handle datasource change for Analytics
    setDatasource(datasourceUid) {
        if (!datasourceUid) {
            console.log('❌ No datasource UID provided to Analytics.setDatasource');
            return;
        }

        console.log('📊 Analytics changing datasource to:', datasourceUid);
        
        // Find the datasource item and get its info
        const datasourceItem = document.querySelector(`[data-uid="${datasourceUid}"]`);
        if (!datasourceItem) {
            console.warn('❌ Datasource item not found for UID:', datasourceUid);
            return;
        }

        const datasourceName = datasourceItem.dataset.name;
        const datasourceType = datasourceItem.dataset.type;
        
        console.log('📊 Analytics datasource info:', {
            uid: datasourceUid,
            name: datasourceName,
            type: datasourceType
        });

        // Update global config (this updates Schema context)
        GrafanaConfig.currentDatasourceId = datasourceUid;
        GrafanaConfig.selectedDatasourceUid = datasourceUid;
        GrafanaConfig.selectedDatasourceType = datasourceType;
        GrafanaConfig.selectedDatasourceName = datasourceName;

        // Update Schema context
        if (typeof Schema !== 'undefined') {
            Schema.currentDatasourceId = datasourceUid;
            Schema.currentDatasourceType = datasourceType;
        }

        // Clear existing data and reload for new datasource
        this.config.measurement = '';
        this.config.field = '';
        this.config.retentionPolicy = '';
        this.saveConfiguration();

        // Reload all dependent dropdowns
        this.loadRetentionPolicies();
        this.loadMeasurements();
        
        // Clear field dropdown
        const fieldSelect = document.getElementById('analyticsField');
        if (fieldSelect) {
            fieldSelect.innerHTML = '<option value="">Select measurement first</option>';
        }

        console.log('✅ Analytics datasource changed successfully');
    }
};

// Global functions for HTML event handlers
function exportAnalysisResults() {
    if (Analytics.currentResults) {
        const data = JSON.stringify(Analytics.currentResults, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-results-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

function shareAnalysisResults() {
    if (Analytics.currentResults) {
        const url = `data:application/json,${encodeURIComponent(JSON.stringify(Analytics.currentResults, null, 2))}`;
        navigator.clipboard.writeText(url).then(() => {
            console.log('Results copied to clipboard');
        });
    }
}

// AI Connection Dialog Functions
function showAiConnectionDialog() {
    Analytics.showAiConnectionDialog();
}

function hideAiConnectionDialog() {
    Analytics.hideAiConnectionDialog();
}

function saveAiConnection() {
    Analytics.saveAiConnection();
}

// Export for use in other modules
window.Analytics = Analytics;

