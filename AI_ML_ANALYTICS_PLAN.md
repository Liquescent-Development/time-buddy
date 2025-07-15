# 🤖 Comprehensive AI/ML Predictive Analytics & Anomaly Detection Plan

## 🎯 **Revised Architecture: Ollama-Based Local AI**

### **Core Philosophy**
- **Zero External Dependencies**: No paid API services (OpenAI, Azure, etc.)
- **Local-First**: All AI processing via user-provided Ollama endpoints
- **Model Agnostic**: Support multiple model types for different use cases
- **Training Optional**: Hybrid approach with zero-shot + optional fine-tuning

## 🧠 **Model Requirements & Recommendations**

### **Primary Model: Llama 3.1 8B Instruct**
```bash
# User setup command
ollama pull llama3.1:8b-instruct-q4_K_M
```

**Why Llama 3.1 8B:**
- **Excellent reasoning**: Strong analytical capabilities for time series
- **JSON output**: Reliable structured data generation
- **Context window**: 128k tokens (handles large datasets)
- **Resource efficient**: Runs on 8-16GB RAM
- **Fast inference**: Good for real-time anomaly detection

### **Alternative Models (User Choice)**
```bash
# For better performance (if hardware allows)
ollama pull llama3.1:70b-instruct-q4_K_M

# For resource-constrained environments
ollama pull llama3.2:3b-instruct-q4_K_M

# For specialized math/analysis
ollama pull deepseek-math:7b-instruct-q4_K_M

# For code generation (if extending features)
ollama pull codellama:13b-instruct-q4_K_M
```

### **Model Configuration Matrix**
| Use Case | Primary Model | RAM Req | Fallback Model | Training Needed |
|----------|---------------|---------|----------------|-----------------|
| **Real-time Anomaly** | Llama 3.1 8B | 8GB | Llama 3.2 3B | No |
| **Complex Forecasting** | Llama 3.1 70B | 48GB | Llama 3.1 8B | Optional |
| **Pattern Analysis** | DeepSeek-Math 7B | 6GB | Llama 3.1 8B | No |
| **Custom Metrics** | Fine-tuned Llama | 8GB+ | Base model | Yes |

## 🏗️ **Detailed Implementation Architecture**

### **Phase 1: Ollama Integration Layer (Week 1)**

#### **Step 1.1: Ollama Client Service**
```javascript
// public/js/ollama.js
const OllamaService = {
    // Configuration and connection management
    config: {
        endpoint: null, // User-provided
        model: 'llama3.1:8b-instruct-q4_K_M',
        timeout: 30000,
        maxRetries: 3
    },

    // Initialize and validate Ollama connection
    async initialize(endpoint, model = null) {
        this.config.endpoint = endpoint;
        if (model) this.config.model = model;
        
        const isConnected = await this.testConnection();
        if (!isConnected) {
            throw new Error('Cannot connect to Ollama endpoint');
        }
        
        const modelExists = await this.checkModelAvailability();
        if (!modelExists) {
            throw new Error(`Model ${this.config.model} not found. Please run: ollama pull ${this.config.model}`);
        }
        
        return true;
    },

    // Test Ollama connection
    async testConnection() {
        try {
            const response = await fetch(`${this.config.endpoint}/api/tags`);
            return response.ok;
        } catch (error) {
            console.error('Ollama connection test failed:', error);
            return false;
        }
    },

    // Check if required model is available
    async checkModelAvailability() {
        try {
            const response = await fetch(`${this.config.endpoint}/api/tags`);
            const data = await response.json();
            return data.models.some(model => model.name === this.config.model);
        } catch (error) {
            console.error('Model availability check failed:', error);
            return false;
        }
    },

    // Core inference method
    async generateResponse(prompt, systemPrompt = null, options = {}) {
        const requestBody = {
            model: this.config.model,
            prompt: prompt,
            system: systemPrompt,
            stream: false,
            options: {
                temperature: options.temperature || 0.1, // Low for analytical tasks
                num_predict: options.max_tokens || 2048,
                top_p: options.top_p || 0.9,
                ...options
            }
        };

        try {
            const response = await fetch(`${this.config.endpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(this.config.timeout)
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`);
            }

            const data = await response.json();
            return data.response;
        } catch (error) {
            console.error('Ollama generation failed:', error);
            throw error;
        }
    }
};
```

#### **Step 1.2: Model Management System**
```javascript
// public/js/modelManager.js
const ModelManager = {
    // Available models and their capabilities
    supportedModels: {
        'llama3.1:8b-instruct-q4_K_M': {
            name: 'Llama 3.1 8B',
            capabilities: ['anomaly', 'prediction', 'trend'],
            ramRequired: '8GB',
            speed: 'fast',
            quality: 'good'
        },
        'llama3.1:70b-instruct-q4_K_M': {
            name: 'Llama 3.1 70B',
            capabilities: ['anomaly', 'prediction', 'trend', 'complex_analysis'],
            ramRequired: '48GB',
            speed: 'slow',
            quality: 'excellent'
        },
        'deepseek-math:7b-instruct-q4_K_M': {
            name: 'DeepSeek Math 7B',
            capabilities: ['prediction', 'trend', 'statistical_analysis'],
            ramRequired: '6GB',
            speed: 'fast',
            quality: 'specialized'
        },
        'llama3.2:3b-instruct-q4_K_M': {
            name: 'Llama 3.2 3B',
            capabilities: ['anomaly', 'basic_prediction'],
            ramRequired: '3GB',
            speed: 'very_fast',
            quality: 'basic'
        }
    },

    // Auto-detect best available model
    async detectBestModel(ollamaEndpoint, analysisType) {
        const availableModels = await this.getAvailableModels(ollamaEndpoint);
        const compatibleModels = availableModels.filter(model => 
            this.supportedModels[model]?.capabilities.includes(analysisType)
        );

        if (compatibleModels.length === 0) {
            throw new Error(`No suitable models found for ${analysisType}. Please install a compatible model.`);
        }

        // Prefer quality for complex tasks, speed for real-time
        const preference = analysisType === 'anomaly' ? 'speed' : 'quality';
        return this.selectOptimalModel(compatibleModels, preference);
    },

    async getAvailableModels(endpoint) {
        const response = await fetch(`${endpoint}/api/tags`);
        const data = await response.json();
        return data.models.map(m => m.name);
    }
};
```

### **Phase 2: Specialized AI Analytics Engine (Week 2-3)**

#### **Step 2.1: Time Series Analysis Prompts**
```javascript
// public/js/aiAnalytics.js
const AIAnalytics = {
    // Sophisticated prompt engineering for time series
    prompts: {
        systemPrompt: `You are a specialized time series analyst with expertise in InfluxDB metrics. 
        You analyze time series data for anomalies, predictions, and trends.
        Always respond with valid JSON only, no additional text.
        Use statistical reasoning and domain knowledge about system metrics.`,

        anomalyDetection: `
        Analyze this time series data for anomalies:

        CONTEXT:
        - Measurement: {measurement}
        - Field: {field} 
        - Tags: {tags}
        - Time Range: {timeRange}
        - Normal Patterns: {historicalStats}

        DATA:
        {dataPoints}

        TASK:
        1. Calculate anomaly scores (0-1) for each point
        2. Identify anomaly types (spike, drop, drift, seasonal)
        3. Determine severity levels (low, medium, high, critical)
        4. Provide explanations for each anomaly

        RESPONSE FORMAT (JSON only):
        {
          "anomalies": [
            {
              "timestamp": "2024-01-01T12:00:00Z",
              "value": 95.5,
              "score": 0.85,
              "type": "spike",
              "severity": "high",
              "explanation": "Value exceeds normal range by 3.2 standard deviations"
            }
          ],
          "summary": {
            "total_anomalies": 5,
            "severity_distribution": {"high": 2, "medium": 2, "low": 1},
            "patterns_detected": ["unusual_spike_pattern", "potential_system_issue"]
          }
        }`,

        prediction: `
        Forecast future values for this time series:

        CONTEXT:
        - Measurement: {measurement}
        - Field: {field}
        - Historical Period: {historicalPeriod}
        - Forecast Horizon: {forecastHorizon}
        - Seasonality: {seasonalityInfo}

        HISTORICAL DATA:
        {historicalData}

        RECENT TRENDS:
        {recentTrends}

        TASK:
        1. Generate point forecasts for the requested horizon
        2. Calculate confidence intervals (80%, 95%)
        3. Identify key patterns influencing the forecast
        4. Assess forecast reliability

        RESPONSE FORMAT (JSON only):
        {
          "predictions": [
            {
              "timestamp": "2024-01-01T13:00:00Z",
              "predicted_value": 78.5,
              "confidence_80_lower": 75.2,
              "confidence_80_upper": 81.8,
              "confidence_95_lower": 72.1,
              "confidence_95_upper": 84.9
            }
          ],
          "forecast_metadata": {
            "model_type": "trend_seasonal",
            "reliability_score": 0.78,
            "key_patterns": ["daily_seasonality", "upward_trend"],
            "uncertainty_factors": ["recent_volatility", "limited_historical_data"]
          }
        }`,

        trendAnalysis: `
        Analyze trends and patterns in this time series:

        DATA:
        {timeSeriesData}

        CONTEXT:
        - Metric Type: {metricType}
        - Business Context: {businessContext}
        - Analysis Period: {analysisPeriod}

        TASK:
        1. Identify short-term and long-term trends
        2. Detect seasonality patterns (hourly, daily, weekly)
        3. Calculate trend strength and significance
        4. Predict trend continuation probability

        RESPONSE FORMAT (JSON only):
        {
          "trends": {
            "short_term": {"direction": "increasing", "strength": 0.65, "significance": "moderate"},
            "long_term": {"direction": "stable", "strength": 0.23, "significance": "weak"}
          },
          "seasonality": {
            "daily": {"detected": true, "strength": 0.82, "peak_hours": [9, 14, 20]},
            "weekly": {"detected": true, "strength": 0.45, "peak_days": ["Monday", "Wednesday"]}
          },
          "insights": [
            "Strong daily pattern with peaks during business hours",
            "Moderate upward trend over past 7 days",
            "Weekly seasonality suggests business-driven usage"
          ]
        }`
    },

    // Data preprocessing for AI analysis
    preprocessData(rawData, analysisType) {
        const processed = {
            dataPoints: this.formatDataPoints(rawData),
            statistics: this.calculateStatistics(rawData),
            patterns: this.detectBasicPatterns(rawData)
        };

        if (analysisType === 'anomaly') {
            processed.historicalStats = this.calculateHistoricalBaseline(rawData);
        } else if (analysisType === 'prediction') {
            processed.seasonalityInfo = this.analyzeSeasonality(rawData);
            processed.recentTrends = this.calculateRecentTrends(rawData);
        }

        return processed;
    },

    // Statistical baseline calculation
    calculateHistoricalBaseline(data) {
        const values = data.map(point => point.value);
        const mean = values.reduce((a, b) => a + b) / values.length;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2)) / values.length;
        const stdDev = Math.sqrt(variance);

        return {
            mean,
            stdDev,
            median: this.calculateMedian(values),
            percentiles: {
                p5: this.calculatePercentile(values, 5),
                p25: this.calculatePercentile(values, 25),
                p75: this.calculatePercentile(values, 75),
                p95: this.calculatePercentile(values, 95)
            },
            normalRange: {
                lower: mean - 2 * stdDev,
                upper: mean + 2 * stdDev
            }
        };
    }
};
```

#### **Step 2.2: Advanced Data Processing**
```javascript
// public/js/timeSeriesProcessor.js
const TimeSeriesProcessor = {
    // Intelligent data sampling for large datasets
    async optimizeDataForAnalysis(config, maxPoints = 1000) {
        const query = this.buildOptimalQuery(config, maxPoints);
        const rawData = await this.executeQuery(query);
        return this.postprocessData(rawData, config);
    },

    buildOptimalQuery(config, maxPoints) {
        const timeRange = this.parseTimeRange(config.timeRange);
        const optimalInterval = this.calculateOptimalInterval(timeRange, maxPoints);
        
        const tagFilters = Object.entries(config.tags || {})
            .map(([key, value]) => `"${key}" = '${value}'`)
            .join(' AND ');

        return `
            SELECT 
                ${this.getAggregationFunction(config.field)}("${config.field}") as value,
                ${this.getAggregationFunction(config.field, 'stddev')}("${config.field}") as stddev
            FROM "${config.retention}"."${config.measurement}"
            WHERE ${tagFilters}
            AND time >= ${timeRange.from}
            AND time <= ${timeRange.to}
            GROUP BY time(${optimalInterval}) fill(linear)
            ORDER BY time ASC
        `;
    },

    // Smart interval calculation based on data density
    calculateOptimalInterval(timeRange, maxPoints) {
        const duration = timeRange.to - timeRange.from;
        const intervalMs = Math.ceil(duration / maxPoints);
        
        // Round to sensible intervals
        if (intervalMs < 60000) return '1m';
        if (intervalMs < 300000) return '5m';
        if (intervalMs < 900000) return '15m';
        if (intervalMs < 3600000) return '1h';
        if (intervalMs < 21600000) return '6h';
        return '1d';
    },

    // Feature engineering for better AI analysis
    enrichDataWithFeatures(data) {
        return data.map((point, index) => ({
            ...point,
            features: {
                hourOfDay: new Date(point.timestamp).getHours(),
                dayOfWeek: new Date(point.timestamp).getDay(),
                isWeekend: [0, 6].includes(new Date(point.timestamp).getDay()),
                movingAverage5: this.calculateMovingAverage(data, index, 5),
                movingAverage20: this.calculateMovingAverage(data, index, 20),
                rateOfChange: index > 0 ? (point.value - data[index-1].value) / data[index-1].value : 0,
                zscore: this.calculateZScore(data, index)
            }
        }));
    }
};
```

### **Phase 3: Fine-Tuning System (Optional) (Week 4)**

#### **Step 3.1: Domain-Specific Model Training**
```javascript
// public/js/modelTraining.js
const ModelTraining = {
    // Generate training data from historical queries and results
    async generateTrainingDataset(datasourceId, timeRange = '30d') {
        const historicalData = await this.collectHistoricalMetrics(datasourceId, timeRange);
        const labeledAnomalies = await this.collectKnownAnomalies(datasourceId, timeRange);
        
        return this.formatForTraining(historicalData, labeledAnomalies);
    },

    // Create model cards for different metric types
    async createDomainSpecificModels() {
        const domains = {
            'cpu_metrics': {
                measurements: ['cpu', 'cpu_usage', 'system'],
                fields: ['usage_idle', 'usage_system', 'usage_user'],
                patterns: ['daily_cycles', 'load_spikes', 'thermal_throttling']
            },
            'memory_metrics': {
                measurements: ['mem', 'memory'],
                fields: ['used_percent', 'available_percent', 'cached'],
                patterns: ['memory_leaks', 'gc_patterns', 'swap_usage']
            },
            'network_metrics': {
                measurements: ['net', 'network'],
                fields: ['bytes_sent', 'bytes_recv', 'packets_sent'],
                patterns: ['traffic_bursts', 'bandwidth_saturation', 'packet_loss']
            }
        };

        for (const [domain, config] of Object.entries(domains)) {
            await this.trainDomainModel(domain, config);
        }
    },

    // Fine-tune Llama model for specific metric domains
    async trainDomainModel(domain, config) {
        const trainingData = await this.generateDomainTrainingData(domain, config);
        const modelFile = await this.createModelfile(domain, trainingData);
        
        // Generate Ollama Modelfile for fine-tuning
        const modelfileContent = `
        FROM llama3.1:8b-instruct-q4_K_M
        
        TEMPLATE """{{ if .System }}<|start_header_id|>system<|end_header_id|>
        
        {{ .System }}<|eot_id|>{{ end }}{{ if .Prompt }}<|start_header_id|>user<|end_header_id|>
        
        {{ .Prompt }}<|eot_id|>{{ end }}<|start_header_id|>assistant<|end_header_id|>
        
        {{ .Response }}<|eot_id|>"""
        
        SYSTEM """You are a specialized ${domain} analyst with deep knowledge of:
        ${config.patterns.join(', ')}
        
        You understand normal patterns for: ${config.fields.join(', ')}
        You can detect anomalies specific to: ${config.measurements.join(', ')}"""
        
        PARAMETER temperature 0.1
        PARAMETER top_p 0.9
        PARAMETER num_predict 2048
        `;

        return {
            domain,
            modelfile: modelfileContent,
            trainingExamples: trainingData.length,
            setupInstructions: [
                `Save modelfile as: ${domain}.modelfile`,
                `Run: ollama create ${domain}-analyzer -f ${domain}.modelfile`,
                `Test: ollama run ${domain}-analyzer`
            ]
        };
    }
};
```

#### **Step 3.2: Training Data Generation**
```javascript
const TrainingDataGenerator = {
    // Generate synthetic anomalies for training
    generateSyntheticAnomalies(cleanData) {
        const syntheticDataset = [];
        
        cleanData.forEach((point, index) => {
            // Add normal point
            syntheticDataset.push({
                ...point,
                label: 'normal',
                anomaly_score: 0.0
            });

            // Generate anomalies with different patterns
            if (Math.random() < 0.05) { // 5% anomaly rate
                const anomalyTypes = ['spike', 'drop', 'drift', 'outlier'];
                const anomalyType = anomalyTypes[Math.floor(Math.random() * anomalyTypes.length)];
                
                const anomalousPoint = this.createAnomaly(point, anomalyType);
                syntheticDataset.push({
                    ...anomalousPoint,
                    label: 'anomaly',
                    anomaly_type: anomalyType,
                    anomaly_score: Math.random() * 0.4 + 0.6 // 0.6-1.0
                });
            }
        });

        return syntheticDataset;
    },

    createAnomaly(basePoint, type) {
        const value = basePoint.value;
        let anomalousValue;

        switch (type) {
            case 'spike':
                anomalousValue = value * (2 + Math.random() * 3); // 2-5x spike
                break;
            case 'drop':
                anomalousValue = value * (0.1 + Math.random() * 0.3); // 10-40% of normal
                break;
            case 'drift':
                anomalousValue = value + (Math.random() - 0.5) * value * 0.8; // ±40% drift
                break;
            case 'outlier':
                anomalousValue = Math.random() > 0.5 ? value * 10 : value * 0.1;
                break;
            default:
                anomalousValue = value;
        }

        return {
            ...basePoint,
            value: anomalousValue
        };
    }
};
```

### **Phase 4: Real-Time Analytics Dashboard (Week 5-6)**

#### **Step 4.1: Analytics UI Components**
```html
<!-- public/components/analytics-panel.html -->
<div id="analyticsPanel" class="sidebar-panel">
    <div class="panel-header">
        <h3>🤖 AI Analytics</h3>
        <div class="model-status" id="modelStatus">
            <span class="status-indicator offline"></span>
            <span class="status-text">Not Connected</span>
        </div>
    </div>

    <div class="analytics-setup">
        <div class="setup-section">
            <h4>🔌 Ollama Configuration</h4>
            <div class="form-group">
                <label>Ollama Endpoint:</label>
                <input type="url" id="ollamaEndpoint" 
                       placeholder="http://localhost:11434" 
                       value="http://localhost:11434">
            </div>
            <div class="form-group">
                <label>Model:</label>
                <select id="selectedModel">
                    <option value="llama3.1:8b-instruct-q4_K_M">Llama 3.1 8B (Recommended)</option>
                    <option value="llama3.1:70b-instruct-q4_K_M">Llama 3.1 70B (High Performance)</option>
                    <option value="deepseek-math:7b-instruct-q4_K_M">DeepSeek Math 7B (Specialized)</option>
                    <option value="llama3.2:3b-instruct-q4_K_M">Llama 3.2 3B (Fast)</option>
                </select>
            </div>
            <button id="testConnection" class="secondary-button">Test Connection</button>
        </div>

        <div class="setup-section">
            <h4>📊 Data Configuration</h4>
            <div class="form-group">
                <label>Measurement:</label>
                <select id="analyticsMeasurement">
                    <option value="">Select measurement...</option>
                </select>
            </div>
            <div class="form-group">
                <label>Field:</label>
                <select id="analyticsField">
                    <option value="">Select field...</option>
                </select>
            </div>
            <div class="form-group">
                <label>Tags (Optional):</label>
                <div id="analyticsTagFilters" class="tag-filters">
                    <!-- Dynamically populated -->
                </div>
            </div>
            <div class="form-group">
                <label>Time Range:</label>
                <select id="analyticsTimeRange">
                    <option value="1h">Last 1 Hour</option>
                    <option value="6h">Last 6 Hours</option>
                    <option value="1d" selected>Last 1 Day</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                </select>
            </div>
        </div>

        <div class="setup-section">
            <h4>🔮 Analysis Type</h4>
            <div class="analysis-tabs">
                <button class="tab-button active" data-analysis="anomaly">
                    ⚠️ Anomaly Detection
                </button>
                <button class="tab-button" data-analysis="prediction">
                    📈 Prediction
                </button>
                <button class="tab-button" data-analysis="trend">
                    📊 Trend Analysis
                </button>
            </div>

            <!-- Anomaly Detection Options -->
            <div id="anomalyOptions" class="analysis-options active">
                <div class="form-group">
                    <label>Sensitivity:</label>
                    <select id="anomalySensitivity">
                        <option value="low">Low (Conservative)</option>
                        <option value="medium" selected>Medium</option>
                        <option value="high">High (Aggressive)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Alert Threshold:</label>
                    <input type="range" id="alertThreshold" min="0.5" max="1.0" step="0.1" value="0.8">
                    <span id="thresholdValue">0.8</span>
                </div>
            </div>

            <!-- Prediction Options -->
            <div id="predictionOptions" class="analysis-options">
                <div class="form-group">
                    <label>Forecast Horizon:</label>
                    <select id="forecastHorizon">
                        <option value="1h">1 Hour</option>
                        <option value="6h">6 Hours</option>
                        <option value="1d" selected>1 Day</option>
                        <option value="3d">3 Days</option>
                        <option value="7d">1 Week</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Confidence Level:</label>
                    <select id="confidenceLevel">
                        <option value="0.80">80%</option>
                        <option value="0.95" selected>95%</option>
                        <option value="0.99">99%</option>
                    </select>
                </div>
            </div>

            <!-- Trend Analysis Options -->
            <div id="trendOptions" class="analysis-options">
                <div class="form-group">
                    <label>Analysis Depth:</label>
                    <select id="trendDepth">
                        <option value="basic">Basic Trends</option>
                        <option value="seasonal" selected>Include Seasonality</option>
                        <option value="advanced">Advanced Patterns</option>
                    </select>
                </div>
            </div>
        </div>

        <div class="analytics-actions">
            <button id="runAnalysis" class="primary-button" disabled>
                🚀 Run Analysis
            </button>
            <button id="scheduleAnalysis" class="secondary-button" disabled>
                ⏰ Schedule
            </button>
        </div>
    </div>

    <div class="analytics-results" id="analyticsResults" style="display: none;">
        <div class="results-header">
            <h4>📋 Analysis Results</h4>
            <div class="results-actions">
                <button class="icon-button" onclick="exportAnalysisResults()">📁</button>
                <button class="icon-button" onclick="shareAnalysisResults()">🔗</button>
            </div>
        </div>
        <div class="results-content" id="analyticsResultsContent">
            <!-- Results populated dynamically -->
        </div>
    </div>
</div>
```

#### **Step 4.2: Advanced Visualization Components**
```javascript
// public/js/analyticsVisualization.js
const AnalyticsVisualization = {
    // Enhanced chart with AI results overlay
    renderAnalyticsChart(data, analysis, analysisType) {
        const ctx = document.getElementById('analyticsChart').getContext('2d');
        
        const config = {
            type: 'line',
            data: {
                labels: data.map(point => new Date(point.timestamp).toLocaleString()),
                datasets: this.buildDatasets(data, analysis, analysisType)
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        callbacks: {
                            afterBody: (context) => {
                                return this.generateTooltipInsights(context, analysis, analysisType);
                            }
                        }
                    },
                    annotation: {
                        annotations: this.buildAnnotations(analysis, analysisType)
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'hour'
                        }
                    },
                    y: {
                        beginAtZero: false
                    }
                }
            }
        };

        return new Chart(ctx, config);
    },

    buildDatasets(data, analysis, analysisType) {
        const datasets = [{
            label: 'Historical Data',
            data: data.map(point => ({ x: point.timestamp, y: point.value })),
            borderColor: '#51cf66',
            backgroundColor: 'rgba(81, 207, 102, 0.1)',
            fill: false,
            tension: 0.1
        }];

        if (analysisType === 'anomaly') {
            datasets.push(...this.buildAnomalyDatasets(data, analysis));
        } else if (analysisType === 'prediction') {
            datasets.push(...this.buildPredictionDatasets(analysis));
        }

        return datasets;
    },

    buildAnomalyDatasets(data, analysis) {
        const anomalyPoints = analysis.anomalies.map(anomaly => ({
            x: anomaly.timestamp,
            y: anomaly.value,
            score: anomaly.score,
            severity: anomaly.severity,
            explanation: anomaly.explanation
        }));

        return [{
            label: 'Anomalies',
            data: anomalyPoints,
            backgroundColor: (ctx) => {
                const point = ctx.raw;
                if (point.severity === 'critical') return '#ff4757';
                if (point.severity === 'high') return '#ff6b7a';
                if (point.severity === 'medium') return '#ffa726';
                return '#ffcc02';
            },
            borderColor: '#ff4757',
            pointRadius: (ctx) => ctx.raw.score * 8 + 3,
            pointHoverRadius: 10,
            showLine: false,
            type: 'scatter'
        }];
    },

    buildPredictionDatasets(analysis) {
        const predictions = analysis.predictions.map(pred => ({
            x: pred.timestamp,
            y: pred.predicted_value
        }));

        const upperBound = analysis.predictions.map(pred => ({
            x: pred.timestamp,
            y: pred.confidence_95_upper
        }));

        const lowerBound = analysis.predictions.map(pred => ({
            x: pred.timestamp,
            y: pred.confidence_95_lower
        }));

        return [
            {
                label: 'Predictions',
                data: predictions,
                borderColor: '#ffa500',
                backgroundColor: 'rgba(255, 165, 0, 0.1)',
                borderDash: [5, 5],
                fill: false
            },
            {
                label: '95% Confidence Band',
                data: upperBound,
                borderColor: 'rgba(255, 165, 0, 0.3)',
                backgroundColor: 'rgba(255, 165, 0, 0.1)',
                fill: '+1',
                pointRadius: 0
            },
            {
                label: '',
                data: lowerBound,
                borderColor: 'rgba(255, 165, 0, 0.3)',
                backgroundColor: 'rgba(255, 165, 0, 0.1)',
                fill: false,
                pointRadius: 0
            }
        ];
    }
};
```

### **Phase 5: Production Deployment & Monitoring (Week 7)**

#### **Step 5.1: Performance Optimization**
```javascript
// public/js/analyticsOptimization.js
const AnalyticsOptimization = {
    // Intelligent caching system
    cache: new Map(),
    cacheTimeout: 5 * 60 * 1000, // 5 minutes

    async getCachedAnalysis(config) {
        const cacheKey = this.generateCacheKey(config);
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.result;
        }
        
        return null;
    },

    setCachedAnalysis(config, result) {
        const cacheKey = this.generateCacheKey(config);
        this.cache.set(cacheKey, {
            result,
            timestamp: Date.now()
        });
    },

    // Batch processing for multiple analyses
    async batchAnalyzeMetrics(configs) {
        const results = await Promise.allSettled(
            configs.map(config => this.runAnalysis(config))
        );

        return results.map((result, index) => ({
            config: configs[index],
            status: result.status,
            result: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? result.reason : null
        }));
    },

    // Streaming analysis for real-time monitoring
    async startStreamingAnalysis(config, callback) {
        const interval = setInterval(async () => {
            try {
                const latestData = await this.getLatestData(config);
                const analysis = await this.runAnalysis({
                    ...config,
                    data: latestData
                });
                
                callback(null, analysis);
            } catch (error) {
                callback(error, null);
            }
        }, config.updateInterval || 60000); // Default 1 minute

        return {
            stop: () => clearInterval(interval),
            interval
        };
    }
};
```

## 🎯 **Training Requirements Summary**

### **Zero-Shot Capability (Immediate)**
- **No Training Required**: Works immediately with Llama 3.1 8B
- **Base Models**: Pre-trained models handle most use cases
- **Prompt Engineering**: Sophisticated prompts provide domain knowledge

### **Optional Fine-Tuning (Advanced)**
- **Domain-Specific Models**: Train for specific metric types (CPU, memory, network)
- **Training Data**: Generated from historical data + synthetic anomalies
- **Time Investment**: 1-2 days per domain model
- **Performance Gain**: 15-30% improvement in accuracy

### **Model Selection Matrix**
| Scenario | Model Choice | Training Needed | Setup Time |
|----------|--------------|-----------------|------------|
| **Quick Start** | Llama 3.1 8B | No | 30 minutes |
| **Production** | Llama 3.1 8B + Domain Models | Optional | 1-3 days |
| **High Performance** | Llama 3.1 70B | No | 1 hour |
| **Resource Constrained** | Llama 3.2 3B | No | 15 minutes |

## 🚀 **Implementation Timeline**

- **Week 1**: Ollama integration + basic UI
- **Week 2-3**: AI analytics engine + prompt engineering  
- **Week 4**: Optional fine-tuning system
- **Week 5-6**: Advanced visualization + real-time monitoring
- **Week 7**: Production optimization + deployment

## 📋 **Configuration Schema**

```javascript
const AnalyticsConfigSchema = {
    // Data source configuration
    data: {
        datasource_id: "string",
        retention_policy: "string",
        measurement: "string", 
        field: "string",
        tags: "object",
        time_range: "string"
    },
    
    // Analysis parameters
    analysis: {
        type: "prediction|anomaly|trend",
        horizon: "string", // 1h, 6h, 1d, 7d, 30d
        confidence: "number", // 0.80, 0.90, 0.95, 0.99
        sensitivity: "low|medium|high",
        model_provider: "ollama"
    },
    
    // Ollama configuration
    ollama: {
        endpoint: "string", // http://localhost:11434
        model: "string", // llama3.1:8b-instruct-q4_K_M
        timeout: "number", // 30000ms
        max_retries: "number" // 3
    },
    
    // Output preferences
    output: {
        format: "chart|table|export",
        alerts_enabled: "boolean",
        alert_threshold: "number",
        export_format: "json|csv|png"
    }
};
```

## 🔧 **User Setup Instructions**

### **Prerequisites**
1. **Install Ollama**: Download from [ollama.ai](https://ollama.ai)
2. **Pull Required Model**:
   ```bash
   ollama pull llama3.1:8b-instruct-q4_K_M
   ```
3. **Start Ollama Service**:
   ```bash
   ollama serve
   ```
4. **Verify Installation**:
   ```bash
   curl http://localhost:11434/api/tags
   ```

### **Optional: High-Performance Setup**
For better analysis quality (requires more RAM):
```bash
ollama pull llama3.1:70b-instruct-q4_K_M
```

### **Optional: Resource-Constrained Setup**
For limited hardware:
```bash
ollama pull llama3.2:3b-instruct-q4_K_M
```

## 🎯 **Success Metrics**

### **Technical Performance**
- **Anomaly Detection Accuracy**: >85% precision/recall
- **Prediction MAPE**: <15% for 1-day forecasts
- **Response Time**: <10 seconds for analysis
- **Model Availability**: >99% uptime

### **User Experience**
- **Setup Time**: <30 minutes for basic config
- **Analysis Frequency**: Support for real-time monitoring
- **Visualization Quality**: Interactive charts with insights
- **Export Capabilities**: JSON, CSV, PNG formats

This comprehensive plan provides a robust, self-contained AI/ML analytics solution that doesn't depend on external paid services while offering both immediate zero-shot capabilities and optional advanced fine-tuning for specialized use cases.