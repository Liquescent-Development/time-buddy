// AI Analytics Controller
// Main controller for AI/ML analytics functionality

const Analytics = {
    // State management
    config: {
        ollamaEndpoint: 'http://localhost:11434',
        selectedModel: 'llama3.1:8b-instruct-q4_K_M',
        analysisType: 'anomaly',
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
        const testButton = document.getElementById('testConnection');
        if (testButton) {
            testButton.addEventListener('click', () => this.testOllamaConnection());
        }

        // Configuration changes
        const ollamaEndpoint = document.getElementById('ollamaEndpoint');
        if (ollamaEndpoint) {
            ollamaEndpoint.addEventListener('change', (e) => {
                this.config.ollamaEndpoint = e.target.value;
                this.saveConfiguration();
            });
        }

        const selectedModel = document.getElementById('selectedModel');
        if (selectedModel) {
            selectedModel.addEventListener('change', (e) => {
                this.config.selectedModel = e.target.value;
                this.saveConfiguration();
                this.updateModelInfo();
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
        // Update form values
        const ollamaEndpoint = document.getElementById('ollamaEndpoint');
        if (ollamaEndpoint) ollamaEndpoint.value = this.config.ollamaEndpoint;

        const selectedModel = document.getElementById('selectedModel');
        if (selectedModel) selectedModel.value = this.config.selectedModel;

        const timeRange = document.getElementById('analyticsTimeRange');
        if (timeRange) timeRange.value = this.config.timeRange;

        const alertThreshold = document.getElementById('alertThreshold');
        const thresholdValue = document.getElementById('thresholdValue');
        if (alertThreshold) alertThreshold.value = this.config.alertThreshold;
        if (thresholdValue) thresholdValue.textContent = this.config.alertThreshold.toFixed(1);

        // Update analysis type
        this.setAnalysisType(this.config.analysisType);

        // Update connection status
        this.updateConnectionStatus();

        // Update model info
        this.updateModelInfo();

        // Load measurements from current datasource
        this.loadMeasurements();
    },

    // Test Ollama connection
    async testOllamaConnection() {
        console.log('🔍 Testing Ollama connection...');
        
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.status-text');
        const testButton = document.getElementById('testConnection');

        // Update UI to show testing state
        if (statusIndicator) {
            statusIndicator.className = 'status-indicator connecting';
        }
        if (statusText) {
            statusText.textContent = 'Testing...';
        }
        if (testButton) {
            testButton.disabled = true;
            testButton.textContent = 'Testing...';
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
            
            console.error('❌ Ollama connection failed:', error);
        } finally {
            // Reset test button
            if (testButton) {
                testButton.disabled = false;
                testButton.textContent = 'Test Connection';
            }
        }
    },

    // Update connection status display
    updateConnectionStatus() {
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.status-text');

        if (this.isConnected) {
            if (statusIndicator) statusIndicator.className = 'status-indicator connected';
            if (statusText) statusText.textContent = 'Connected';
        } else {
            if (statusIndicator) statusIndicator.className = 'status-indicator offline';
            if (statusText) statusText.textContent = 'Not Connected';
        }
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
            // First, ensure schema is loaded for current datasource
            if (typeof Schema !== 'undefined') {
                // Check if we need to load schema for the current datasource
                const needsSchemaLoad = !Schema.loadedSchema || 
                                       Schema.currentDatasourceId !== GrafanaConfig.currentDatasourceId ||
                                       (GrafanaConfig.selectedDatasourceType === 'influxdb' && Schema.influxMeasurements.length === 0);
                
                if (needsSchemaLoad) {
                    console.log('🔄 Loading schema for current datasource...', {
                        currentId: GrafanaConfig.currentDatasourceId,
                        schemaId: Schema.currentDatasourceId,
                        measurements: Schema.influxMeasurements.length
                    });
                    measurementSelect.innerHTML = '<option value="">Loading measurements...</option>';
                    
                    // Set the datasource context in Schema
                    Schema.currentDatasourceId = GrafanaConfig.currentDatasourceId;
                    Schema.currentDatasourceType = GrafanaConfig.selectedDatasourceType;
                    
                    // Trigger schema loading
                    await Schema.loadSchema();
                    
                    // Wait a moment for schema to load
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }

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
            } else {
                console.error('❌ Schema module not available');
                measurementSelect.innerHTML = '<option value="">Schema module not available</option>';
            }
        } catch (error) {
            console.error('❌ Failed to load measurements:', error);
            measurementSelect.innerHTML = '<option value="">Error loading measurements</option>';
        }
    },

    // Load fields for selected measurement
    loadFieldsForMeasurement(measurement) {
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
                fields.forEach(field => {
                    const option = document.createElement('option');
                    option.value = field;
                    option.textContent = field;
                    if (field === this.config.field) {
                        option.selected = true;
                    }
                    fieldSelect.appendChild(option);
                });
                
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
            runButton.textContent = '🔌 Connect to Ollama First';
        } else if (!GrafanaConfig.connected) {
            runButton.textContent = '📊 Connect to Grafana First';
        } else if (!this.config.measurement || !this.config.field) {
            runButton.textContent = '📋 Select Measurement & Field';
        } else if (this.isAnalysisRunning) {
            runButton.textContent = '⏳ Analyzing...';
        } else {
            runButton.textContent = '🚀 Run Analysis';
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

        try {
            // TODO: Implement analysis execution in Phase 2
            // For now, show a placeholder result
            await this.showPlaceholderResults();
            
        } catch (error) {
            console.error('❌ Analysis failed:', error);
            this.showError('Analysis failed: ' + error.message);
        } finally {
            this.isAnalysisRunning = false;
            this.updateAnalysisButton();
        }
    },

    // Show placeholder results (will be replaced in Phase 2)
    async showPlaceholderResults() {
        const resultsContainer = document.getElementById('analyticsResults');
        const resultsContent = document.getElementById('analyticsResultsContent');
        
        if (!resultsContainer || !resultsContent) return;

        // Simulate analysis delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        resultsContent.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #858585;">
                <h4 style="color: #f46800; margin-bottom: 12px;">🚧 Phase 1 Complete</h4>
                <p style="margin-bottom: 8px;">Ollama integration is ready!</p>
                <p style="font-size: 10px;">Analysis execution will be implemented in Phase 2</p>
                <div style="margin-top: 16px; padding: 8px; background-color: #2d2d30; border-radius: 4px;">
                    <strong>Current Configuration:</strong><br>
                    Model: ${this.config.selectedModel}<br>
                    Analysis: ${this.config.analysisType}<br>
                    Data: ${this.config.measurement}.${this.config.field}<br>
                    Range: ${this.config.timeRange}
                </div>
            </div>
        `;

        resultsContainer.style.display = 'block';
    },

    // Show error message
    showError(message) {
        const resultsContainer = document.getElementById('analyticsResults');
        const resultsContent = document.getElementById('analyticsResultsContent');
        
        if (!resultsContainer || !resultsContent) return;

        resultsContent.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #ff4757;">
                <h4 style="color: #ff4757; margin-bottom: 12px;">❌ Error</h4>
                <p>${message}</p>
            </div>
        `;

        resultsContainer.style.display = 'block';
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

// Export for use in other modules
window.Analytics = Analytics;