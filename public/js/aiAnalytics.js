// AI Analytics Engine
// Specialized prompt engineering and analysis execution for time series data

const AIAnalytics = {
    // Configuration
    config: {
        maxDataPoints: 100000, // High resolution for comprehensive AI analysis
        defaultTimeout: 600000, // 10 minutes default, configurable per connection
        retryAttempts: 2
    },

    // Specialized prompts for different analysis types
    prompts: {
        systemPrompt: `You are a specialized time series analyst with expertise in InfluxDB metrics and system monitoring. 
        You analyze time series data for anomalies, predictions, and trends using statistical reasoning and domain knowledge.
        Always respond with valid JSON only, no additional text or explanations outside the JSON structure.
        Use your knowledge of system metrics, seasonality patterns, and anomaly detection techniques.`,

        anomalyDetection: `
        Analyze this time series data for anomalies:

        CONTEXT:
        - Measurement: {measurement}
        - Field: {field} 
        - Tags: {tags}
        - Time Range: {timeRange}
        - Statistical Baseline: {historicalStats}

        DATA POINTS:
        {dataPoints}

        STATISTICAL CONTEXT:
        - Mean: {mean}
        - Standard Deviation: {stdDev}
        - Normal Range: {normalRangeLower} to {normalRangeUpper}
        - Data Points Count: {dataPointsCount}

        ANALYSIS REQUIREMENTS:
        1. Calculate anomaly scores (0-1) for each suspicious point based on statistical deviation
        2. Identify anomaly types: spike, drop, drift, seasonal_deviation, outlier
        3. Determine severity levels based on score ranges:
           - critical: score >= 0.9 (extreme outliers, >4 sigma)
           - high: score >= 0.7 (significant outliers, 3-4 sigma) 
           - medium: score >= 0.5 (moderate outliers, 2-3 sigma)
           - low: score >= 0.3 (mild outliers, 1.5-2 sigma)
        4. Provide statistical explanations for each anomaly
        5. Consider business context and typical system behavior patterns
        
        **CRITICAL ANTI-BIAS REQUIREMENTS:**
        6. MANDATORY: Analyze the ENTIRE time series equally - do NOT focus only on recent data
        7. FORBIDDEN: Clustering all anomalies at the end of the time series
        8. REQUIRED: Find anomalies distributed across the FULL time period if they exist
        9. VERIFICATION: Before finalizing, check that anomalies span multiple days/periods, not just the last few hours
        10. TEMPORAL BALANCE: If you find 10 anomalies, they should be spread across the time range, NOT all in the final 1% of data
        11. ALWAYS include severity_distribution in summary with actual counts from anomalies
        
        **MANDATORY TEMPORAL DISTRIBUTION:**
        12. FORBIDDEN: Finding all anomalies in timestamps after 2025-07-16T06:00:00Z (recent bias)
        13. REQUIRED: If analyzing 30 days of data, anomalies must span across multiple days, not just the final day
        14. ENFORCEMENT: Actively search for anomalies in the first 80% of the time series, not just the last 20%
        15. VALIDATION: The earliest anomaly timestamp should be within the first 50% of the time range
        16. BALANCE CHECK: Maximum 30% of anomalies can be in the final 10% of the time series

        RESPONSE FORMAT (JSON only):
        {
          "anomalies": [
            {
              "timestamp": "2024-01-01T12:00:00Z",
              "value": 95.5,
              "score": 0.85,
              "type": "spike",
              "severity": "high",
              "explanation": "Value exceeds normal range by 3.2 standard deviations",
              "statistical_context": {
                "z_score": 3.2,
                "percentile": 99.1,
                "deviation_from_mean": 45.3
              }
            }
          ],
          "summary": {
            "total_anomalies": 5,
            "severity_distribution": {"critical": 0, "high": 2, "medium": 2, "low": 1},
            "anomaly_types": {"spike": 3, "drop": 1, "drift": 1},
            "patterns_detected": ["unusual_spike_pattern", "potential_system_overload"],
            "recommendations": ["Monitor system resources", "Check for recent deployments"],
            "analysis_confidence": 0.78
          },
          "metadata": {
            "analysis_timestamp": "2024-01-01T12:00:00Z",
            "data_quality": "good",
            "baseline_period": "7 days",
            "total_points_analyzed": 144
          }
        }`,

        prediction: `
        Forecast future values for this time series based on historical patterns:

        CONTEXT:
        - Measurement: {measurement}
        - Field: {field}
        - Historical Period: {historicalPeriod}
        - Forecast Horizon: {forecastHorizon}
        - Seasonality Information: {seasonalityInfo}

        HISTORICAL DATA:
        {historicalData}

        RECENT TRENDS:
        {recentTrends}

        STATISTICAL CONTEXT:
        - Trend Direction: {trendDirection}
        - Trend Strength: {trendStrength}
        - Seasonal Patterns: {seasonalPatterns}
        - Data Volatility: {volatility}

        FORECASTING REQUIREMENTS:
        1. Generate point forecasts for the requested time horizon
        2. Calculate confidence intervals (80%, 95%)
        3. Identify key patterns influencing the forecast
        4. Assess forecast reliability and uncertainty factors
        5. Consider seasonal patterns, trends, and cyclical behavior

        RESPONSE FORMAT (JSON only):
        {
          "predictions": [
            {
              "timestamp": "2024-01-01T13:00:00Z",
              "predicted_value": 78.5,
              "confidence_80_lower": 75.2,
              "confidence_80_upper": 81.8,
              "confidence_95_lower": 72.1,
              "confidence_95_upper": 84.9,
              "trend_component": 2.3,
              "seasonal_component": -1.8
            }
          ],
          "forecast_metadata": {
            "model_type": "trend_seasonal_decomposition",
            "reliability_score": 0.78,
            "key_patterns": ["daily_seasonality", "weekly_pattern", "upward_trend"],
            "uncertainty_factors": ["recent_volatility", "limited_historical_data", "irregular_patterns"],
            "seasonal_strength": 0.65,
            "trend_strength": 0.42,
            "forecast_accuracy_estimate": "±15%"
          },
          "recommendations": [
            "Monitor for deviations from predicted range",
            "Consider capacity planning if upward trend continues",
            "Review forecasts weekly due to moderate uncertainty"
          ]
        }`,

        trendAnalysis: `
        Analyze trends and patterns in this time series data:

        DATA:
        {timeSeriesData}

        CONTEXT:
        - Metric Type: {metricType}
        - Business Context: {businessContext}
        - Analysis Period: {analysisPeriod}
        - Data Frequency: {dataFrequency}

        STATISTICAL SUMMARY:
        - Total Data Points: {totalPoints}
        - Time Span: {timeSpan}
        - Value Range: {valueRange}
        - Variance: {variance}

        ANALYSIS REQUIREMENTS:
        1. Identify short-term (last 24h), medium-term (last 7d), and long-term trends (full period)
        2. Detect seasonality patterns (hourly, daily, weekly, monthly)
        3. Calculate trend strength, direction, and statistical significance
        4. Assess trend stability and predict continuation probability
        5. Identify change points and trend reversals

        RESPONSE FORMAT (JSON only):
        {
          "trends": {
            "short_term": {
              "direction": "increasing",
              "strength": 0.65,
              "significance": "moderate",
              "slope": 0.23,
              "r_squared": 0.42,
              "change_rate": "2.3% per hour"
            },
            "medium_term": {
              "direction": "stable",
              "strength": 0.23,
              "significance": "weak",
              "slope": 0.05,
              "r_squared": 0.18,
              "change_rate": "0.5% per day"
            },
            "long_term": {
              "direction": "increasing",
              "strength": 0.78,
              "significance": "strong",
              "slope": 0.45,
              "r_squared": 0.67,
              "change_rate": "5.2% per week"
            }
          },
          "seasonality": {
            "hourly": {
              "detected": true,
              "strength": 0.82,
              "peak_hours": [9, 14, 20],
              "pattern_description": "Business hours peaks"
            },
            "daily": {
              "detected": true,
              "strength": 0.45,
              "peak_days": ["Monday", "Wednesday"],
              "pattern_description": "Weekday activity pattern"
            },
            "weekly": {
              "detected": false,
              "strength": 0.12,
              "pattern_description": "No clear weekly pattern"
            }
          },
          "change_points": [
            {
              "timestamp": "2024-01-01T08:00:00Z",
              "type": "level_shift",
              "magnitude": 15.2,
              "confidence": 0.78,
              "description": "Significant increase in baseline level"
            }
          ],
          "insights": [
            "Strong daily pattern with peaks during business hours (9AM, 2PM, 8PM)",
            "Moderate upward trend over past 7 days indicates growing usage",
            "Weekly seasonality suggests business-driven rather than technical patterns",
            "Recent level shift may indicate system change or increased load"
          ],
          "recommendations": [
            "Monitor trend continuation for capacity planning",
            "Investigate cause of recent level shift",
            "Consider alerting thresholds based on daily patterns"
          ]
        }`
    },

    // Update loading step in the UI
    updateLoadingStep(stepId, status = 'active') {
        const stepElement = document.getElementById(stepId);
        if (stepElement) {
            // Remove all status classes
            stepElement.classList.remove('active', 'completed', 'error');
            // Add new status class
            stepElement.classList.add(status);
            
            // If marking as completed, also add checkmark
            if (status === 'completed') {
                const text = stepElement.textContent;
                if (!text.includes('✅')) {
                    stepElement.textContent = text.replace(/^[\u{1F4C8}\u{1F504}\u{1F9E0}\u{1F4C8}]/u, '✅');
                }
            }
        }
    },

    // Main analysis execution method
    async executeAnalysis(config) {
        console.log('🤖 Starting AI analysis...', config);
        
        try {
            // Step 1: Fetch and preprocess data
            this.updateLoadingStep('step-preprocessing', 'active');
            const data = await this.fetchAnalysisData(config);
            if (!data || data.length === 0) {
                throw new Error('No data available for analysis');
            }

            // Step 2: Preprocess data for analysis type
            const processedData = this.preprocessData(data, config.analysisType);
            this.updateLoadingStep('step-preprocessing', 'completed');
            
            // Step 3: Generate AI prompt with data
            const prompt = this.generatePrompt(config, processedData);
            
            // Step 4: Execute AI analysis
            this.updateLoadingStep('step-ai', 'active');
            const aiResponse = await this.executeAIAnalysis(prompt, config);
            this.updateLoadingStep('step-ai', 'completed');
            
            // Step 5: Post-process and validate results
            this.updateLoadingStep('step-visualization', 'active');
            const results = this.postprocessResults(aiResponse, config, processedData);
            this.updateLoadingStep('step-visualization', 'completed');
            
            console.log('✅ AI analysis completed successfully');
            return results;
            
        } catch (error) {
            console.error('❌ AI analysis failed:', error);
            
            // Mark current step as error
            const activeStep = document.querySelector('.loading-step.active');
            if (activeStep) {
                this.updateLoadingStep(activeStep.id, 'error');
            }
            
            throw this.createUserFriendlyError(error);
        }
    },

    // Fetch data for analysis
    async fetchAnalysisData(config) {
        console.log('📊 Fetching analysis data...', config);
        
        // Mark data fetching as complete
        this.updateLoadingStep('step-fetching', 'completed');
        
        // Use TimeSeriesProcessor to get optimized data
        if (typeof TimeSeriesProcessor !== 'undefined') {
            return await TimeSeriesProcessor.optimizeDataForAnalysis(config, this.config.maxDataPoints);
        }
        
        // Fallback to direct query execution
        return await this.executeDirectQuery(config);
    },

    // Direct query execution fallback
    async executeDirectQuery(config) {
        const query = this.buildAnalysisQuery(config);
        console.log('🔍 Executing query:', query);
        
        // Use the existing query execution infrastructure
        if (typeof Queries !== 'undefined') {
            const result = await Queries.executeQuery(query, {
                datasourceId: GrafanaConfig.currentDatasourceId,
                datasourceType: GrafanaConfig.selectedDatasourceType
            });
            
            return this.extractDataFromResult(result);
        }
        
        throw new Error('Query execution system not available');
    },

    // Build analysis query
    buildAnalysisQuery(config) {
        const timeRange = this.parseTimeRange(config.timeRange);
        const interval = this.calculateOptimalInterval(timeRange, this.config.maxDataPoints);
        
        let whereClause = `time >= now() - ${config.timeRange}`;
        
        // Add tag filters
        if (config.tags && Object.keys(config.tags).length > 0) {
            const tagFilters = Object.entries(config.tags)
                .map(([key, value]) => `"${key}" = '${value}'`)
                .join(' AND ');
            whereClause += ` AND ${tagFilters}`;
        }
        
        return `SELECT mean("${config.field}") as value 
                FROM "${config.measurement}" 
                WHERE ${whereClause}
                GROUP BY time(${interval}) fill(none)`;
    },

    // Extract data from query result
    extractDataFromResult(result) {
        if (!result || !result.results || !result.results.A || !result.results.A.frames) {
            return [];
        }
        
        const frames = result.results.A.frames;
        const data = [];
        
        for (const frame of frames) {
            if (frame.data && frame.data.values && frame.data.values.length >= 2) {
                const timeValues = frame.data.values[0]; // Time column
                const dataValues = frame.data.values[1]; // Value column
                
                for (let i = 0; i < timeValues.length; i++) {
                    if (timeValues[i] && dataValues[i] !== null && dataValues[i] !== undefined) {
                        data.push({
                            timestamp: new Date(timeValues[i]).toISOString(),
                            value: dataValues[i]
                        });
                    }
                }
            }
        }
        
        return data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    },

    // Data preprocessing for AI analysis
    preprocessData(rawData, analysisType) {
        console.log('🔄 Preprocessing data for analysis type:', analysisType);
        
        const processed = {
            dataPoints: this.formatDataPoints(rawData),
            statistics: this.calculateStatistics(rawData),
            patterns: this.detectBasicPatterns(rawData),
            dataPointsCount: rawData.length,
            rawDataPoints: rawData // Preserve original data for visualization
        };

        if (analysisType === 'anomaly') {
            processed.historicalStats = this.calculateHistoricalBaseline(rawData);
        } else if (analysisType === 'prediction') {
            processed.seasonalityInfo = this.analyzeSeasonality(rawData);
            processed.recentTrends = this.calculateRecentTrends(rawData);
        } else if (analysisType === 'trend') {
            processed.trendAnalysis = this.calculateTrendComponents(rawData);
        }

        return processed;
    },

    // Format data points for AI prompt with temporal balance
    formatDataPoints(data) {
        if (data.length <= 100) {
            // Small dataset: include all points
            return data.map(point => 
                `${point.timestamp}: ${point.value}`
            ).join('\n');
        }
        
        // Large dataset: sample across entire time range to avoid recency bias
        const samples = [];
        const sampleSize = 100;
        
        // Take samples from beginning (40%), middle (30%), and end (30%)
        const beginningCount = Math.floor(sampleSize * 0.4);
        const middleCount = Math.floor(sampleSize * 0.3);
        const endCount = sampleSize - beginningCount - middleCount;
        
        // Beginning samples
        for (let i = 0; i < beginningCount && i < data.length; i++) {
            const index = Math.floor((i / beginningCount) * (data.length * 0.33));
            if (data[index]) samples.push(data[index]);
        }
        
        // Middle samples
        const middleStart = Math.floor(data.length * 0.33);
        const middleEnd = Math.floor(data.length * 0.67);
        for (let i = 0; i < middleCount; i++) {
            const index = middleStart + Math.floor((i / middleCount) * (middleEnd - middleStart));
            if (data[index]) samples.push(data[index]);
        }
        
        // End samples
        const endStart = Math.floor(data.length * 0.67);
        for (let i = 0; i < endCount; i++) {
            const index = endStart + Math.floor((i / endCount) * (data.length - endStart));
            if (data[index]) samples.push(data[index]);
        }
        
        return samples.map(point => 
            `${point.timestamp}: ${point.value}`
        ).join('\n');
    },

    // Calculate basic statistics
    calculateStatistics(data) {
        const values = data.map(point => point.value).filter(v => v !== null && v !== undefined);
        
        if (values.length === 0) return null;
        
        const sorted = [...values].sort((a, b) => a - b);
        const mean = values.reduce((a, b) => a + b) / values.length;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2)) / values.length;
        const stdDev = Math.sqrt(variance);
        
        return {
            count: values.length,
            mean: Number(mean.toFixed(2)),
            stdDev: Number(stdDev.toFixed(2)),
            min: sorted[0],
            max: sorted[sorted.length - 1],
            median: this.calculateMedian(sorted),
            q1: this.calculatePercentile(sorted, 25),
            q3: this.calculatePercentile(sorted, 75)
        };
    },

    // Calculate historical baseline for anomaly detection
    calculateHistoricalBaseline(data) {
        const values = data.map(point => point.value).filter(v => v !== null && v !== undefined);
        const mean = values.reduce((a, b) => a + b) / values.length;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2)) / values.length;
        const stdDev = Math.sqrt(variance);

        return {
            mean: Number(mean.toFixed(2)),
            stdDev: Number(stdDev.toFixed(2)),
            median: this.calculateMedian(values),
            percentiles: {
                p5: this.calculatePercentile(values, 5),
                p25: this.calculatePercentile(values, 25),
                p75: this.calculatePercentile(values, 75),
                p95: this.calculatePercentile(values, 95)
            },
            normalRange: {
                lower: Number((mean - 2 * stdDev).toFixed(2)),
                upper: Number((mean + 2 * stdDev).toFixed(2))
            }
        };
    },

    // Analyze seasonality patterns
    analyzeSeasonality(data) {
        // Simple hourly pattern detection
        const hourlyStats = {};
        
        data.forEach(point => {
            const hour = new Date(point.timestamp).getHours();
            if (!hourlyStats[hour]) hourlyStats[hour] = [];
            hourlyStats[hour].push(point.value);
        });
        
        const hourlyMeans = {};
        Object.keys(hourlyStats).forEach(hour => {
            const values = hourlyStats[hour];
            hourlyMeans[hour] = values.reduce((a, b) => a + b) / values.length;
        });
        
        return {
            hourly_pattern: hourlyMeans,
            peak_hours: Object.entries(hourlyMeans)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .map(([hour]) => parseInt(hour))
        };
    },

    // Calculate recent trends
    calculateRecentTrends(data) {
        if (data.length < 10) return { direction: 'insufficient_data', strength: 0 };
        
        const recent = data.slice(-24); // Last 24 points
        const values = recent.map(p => p.value);
        const slope = this.calculateLinearSlope(values);
        
        return {
            direction: slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable',
            strength: Math.abs(slope),
            slope: Number(slope.toFixed(4))
        };
    },

    // Calculate trend components
    calculateTrendComponents(data) {
        const values = data.map(p => p.value);
        const shortTerm = this.calculateLinearSlope(values.slice(-24));
        const mediumTerm = this.calculateLinearSlope(values.slice(-168)); // Last week
        const longTerm = this.calculateLinearSlope(values);
        
        return {
            short_term: shortTerm,
            medium_term: mediumTerm,
            long_term: longTerm
        };
    },

    // Calculate linear slope using least squares
    calculateLinearSlope(values) {
        if (values.length < 2) return 0;
        
        const n = values.length;
        const x = Array.from({length: n}, (_, i) => i);
        const y = values;
        
        const sumX = x.reduce((a, b) => a + b);
        const sumY = y.reduce((a, b) => a + b);
        const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
        const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);
        
        return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    },

    // Generate AI prompt
    generatePrompt(config, processedData) {
        // Map analysis types to prompt keys
        const promptKeyMap = {
            'anomaly': 'anomalyDetection',
            'prediction': 'prediction', 
            'trend': 'trendAnalysis'
        };
        
        const promptKey = promptKeyMap[config.analysisType];
        if (!promptKey) {
            throw new Error(`Unknown analysis type: ${config.analysisType}. Supported types: ${Object.keys(promptKeyMap).join(', ')}`);
        }
        
        let basePrompt = this.prompts[promptKey];
        
        if (!basePrompt) {
            throw new Error(`Prompt not found for analysis type: ${config.analysisType} (key: ${promptKey})`);
        }
        
        // Replace placeholders with actual data
        const replacements = {
            measurement: config.measurement,
            field: config.field,
            tags: JSON.stringify(config.tags || {}),
            timeRange: config.timeRange,
            dataPoints: processedData.dataPoints,
            dataPointsCount: processedData.dataPointsCount,
            ...processedData.statistics,
            ...processedData.historicalStats,
            historicalStats: JSON.stringify(processedData.historicalStats || {}),
            seasonalityInfo: JSON.stringify(processedData.seasonalityInfo || {}),
            recentTrends: JSON.stringify(processedData.recentTrends || {}),
            timeSeriesData: processedData.dataPoints,
            metricType: this.inferMetricType(config.field),
            businessContext: 'System monitoring and performance metrics',
            analysisPeriod: config.timeRange,
            dataFrequency: 'Regular intervals',
            totalPoints: processedData.dataPointsCount,
            timeSpan: config.timeRange,
            valueRange: `${processedData.statistics?.min} - ${processedData.statistics?.max}`,
            variance: processedData.statistics?.stdDev
        };
        
        // Apply replacements
        let prompt = basePrompt;
        Object.entries(replacements).forEach(([key, value]) => {
            prompt = prompt.replace(new RegExp(`{${key}}`, 'g'), value || 'N/A');
        });
        
        return prompt;
    },

    // Execute AI analysis using Ollama
    async executeAIAnalysis(prompt, config) {
        console.log('🧠 Executing AI analysis with Ollama...');
        
        if (typeof OllamaService === 'undefined') {
            throw new Error('Ollama service not available');
        }
        
        // Use custom timeout from config if available, otherwise use default
        const customTimeout = config.timeout || this.config.defaultTimeout;
        
        const response = await OllamaService.generateResponse(
            prompt,
            this.prompts.systemPrompt,
            {
                temperature: 0.1, // Low temperature for analytical tasks
                num_predict: config.numPredict === -1 ? -1 : (config.numPredict || 4096),
                num_ctx: config.numCtx || 8192,
                top_p: 0.9
            },
            customTimeout
        );
        
        return response;
    },

    // Post-process AI results
    postprocessResults(aiResponse, config, processedData) {
        try {
            // Extract the response text from Ollama response object
            let responseText = aiResponse;
            if (typeof aiResponse === 'object' && aiResponse.response) {
                responseText = aiResponse.response;
                console.log('📄 AI response text:', responseText.substring(0, 500) + '...');
            }
            
            // Try to parse JSON response
            const parsed = JSON.parse(responseText);
            
            // Validate and fix severity distribution
            this.validateAndFixSeverityDistribution(parsed);
            
            // Add metadata and original time series data
            parsed.metadata = {
                ...parsed.metadata,
                analysis_type: config.analysisType,
                generated_at: new Date().toISOString(),
                model_used: GrafanaConfig.selectedModel || 'unknown',
                data_source: {
                    measurement: config.measurement,
                    field: config.field,
                    tags: config.tags,
                    time_range: config.timeRange
                }
            };
            
            // Include the original time series data for visualization (preserve original array format)
            // NOTE: processedData.dataPoints is string-formatted for AI prompt, 
            // but we need the original array structure for visualization
            parsed.timeSeriesData = processedData.rawDataPoints || [];
            console.log('📊 Added time series data to results:', parsed.timeSeriesData.length, 'points');
            
            return parsed;
            
        } catch (error) {
            console.error('❌ Failed to parse AI response:', error);
            console.error('📋 Raw AI response type:', typeof aiResponse);
            console.error('📋 Raw AI response:', aiResponse);
            
            // Show the actual response text for debugging
            let responseText = aiResponse;
            if (typeof aiResponse === 'object' && aiResponse.response) {
                responseText = aiResponse.response;
            }
            console.error('📝 Response text (first 2000 chars):', typeof responseText === 'string' ? responseText.substring(0, 2000) : responseText);
            
            throw new Error(`AI returned invalid JSON response. This usually means the response was truncated due to token limits. Try increasing 'Response Tokens (num_predict)' in settings. Error: ${error.message}`);
        }
    },

    // Validate and fix severity distribution in AI response
    validateAndFixSeverityDistribution(parsed) {
        // Only apply to anomaly detection results
        if (!parsed.anomalies || !Array.isArray(parsed.anomalies)) {
            return;
        }

        console.log('🔍 Validating severity distribution...');
        
        // Check if summary exists, create if missing
        if (!parsed.summary) {
            parsed.summary = {};
        }

        // Get existing severity distribution or create empty one
        let distribution = parsed.summary.severity_distribution || {};
        
        // Calculate expected distribution from individual anomalies
        const calculatedDistribution = parsed.anomalies.reduce((acc, anomaly) => {
            const severity = anomaly.severity || 'unknown';
            acc[severity] = (acc[severity] || 0) + 1;
            return acc;
        }, {});

        // Check if existing distribution matches calculated distribution
        const defaultLevels = ['critical', 'high', 'medium', 'low'];
        let needsUpdate = false;

        // Ensure all severity levels are represented
        defaultLevels.forEach(level => {
            const existing = distribution[level] || 0;
            const calculated = calculatedDistribution[level] || 0;
            
            if (existing !== calculated) {
                needsUpdate = true;
            }
        });

        // Update distribution if needed
        if (needsUpdate || Object.keys(distribution).length === 0) {
            console.log('🔄 Fixing severity distribution mismatch');
            console.log('📊 Calculated from anomalies:', calculatedDistribution);
            console.log('📊 Previous distribution:', distribution);
            
            // Create corrected distribution with all levels
            const correctedDistribution = { critical: 0, high: 0, medium: 0, low: 0 };
            Object.assign(correctedDistribution, calculatedDistribution);
            
            parsed.summary.severity_distribution = correctedDistribution;
            console.log('✅ Updated severity distribution:', correctedDistribution);
        } else {
            console.log('✅ Severity distribution is valid');
        }

        // Update total anomalies count
        parsed.summary.total_anomalies = parsed.anomalies.length;
    },


    // Utility methods
    calculateMedian(sortedArray) {
        const mid = Math.floor(sortedArray.length / 2);
        return sortedArray.length % 2 === 0
            ? (sortedArray[mid - 1] + sortedArray[mid]) / 2
            : sortedArray[mid];
    },

    calculatePercentile(sortedArray, percentile) {
        const index = (percentile / 100) * (sortedArray.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        
        if (lower === upper) {
            return sortedArray[lower];
        }
        
        return sortedArray[lower] + (sortedArray[upper] - sortedArray[lower]) * (index - lower);
    },

    parseTimeRange(timeRange) {
        const units = { h: 3600, d: 86400, w: 604800, m: 2592000 };
        const match = timeRange.match(/^(\d+)([hdwm])$/);
        
        if (!match) return 86400; // Default to 1 day
        
        const [, value, unit] = match;
        return parseInt(value) * (units[unit] || 86400);
    },

    calculateOptimalInterval(timeRangeSeconds, maxPoints) {
        const intervals = ['15s', '30s', '1m', '5m', '15m', '30m', '1h', '6h', '12h', '1d'];
        const intervalSeconds = {
            '15s': 15, '30s': 30, '1m': 60, '5m': 300, '15m': 900,
            '30m': 1800, '1h': 3600, '6h': 21600, '12h': 43200, '1d': 86400
        };
        
        for (const interval of intervals) {
            const points = timeRangeSeconds / intervalSeconds[interval];
            if (points <= maxPoints) {
                return interval;
            }
        }
        
        return '1d'; // Fallback
    },

    inferMetricType(fieldName) {
        const patterns = {
            'cpu': 'CPU utilization',
            'memory': 'Memory usage',
            'disk': 'Disk I/O',
            'network': 'Network traffic',
            'response': 'Response time',
            'error': 'Error rate',
            'request': 'Request rate'
        };
        
        const field = fieldName.toLowerCase();
        for (const [pattern, type] of Object.entries(patterns)) {
            if (field.includes(pattern)) {
                return type;
            }
        }
        
        return 'Generic metric';
    },

    createUserFriendlyError(error) {
        const userFriendlyMessages = {
            'No data available': 'No data found for the selected measurement and time range. Please check your selection and try again.',
            'Ollama service not available': 'AI service is not connected. Please test your Ollama connection and try again.',
            'AI returned invalid response': 'AI analysis completed but returned unexpected format. Please try again or contact support.',
            'Query execution system not available': 'Database query system is not available. Please refresh the page and try again.',
            'Request timed out': 'AI analysis timed out. This can happen with complex analysis or slower models. Please try again or use a faster model.',
            'Connection timeout': 'Connection to Ollama timed out. Please check that Ollama is running and accessible.',
            'AbortError': 'Request was cancelled. This usually happens due to timeout or network issues. Please try again.'
        };
        
        const message = error.message || error;
        
        // Check for timeout-related errors
        if (message.includes('timeout') || message.includes('timed out') || error.name === 'AbortError') {
            return new Error(userFriendlyMessages['Request timed out'] || `Analysis timed out: ${message}`);
        }
        
        return new Error(userFriendlyMessages[message] || `Analysis failed: ${message}`);
    },

    // Detect basic patterns in data
    detectBasicPatterns(data) {
        if (data.length < 10) return { patterns: ['insufficient_data'] };
        
        const patterns = [];
        const values = data.map(p => p.value);
        const mean = values.reduce((a, b) => a + b) / values.length;
        const stdDev = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2)) / values.length);
        
        // Check for spikes
        const spikes = values.filter(v => v > mean + 3 * stdDev).length;
        if (spikes > 0) patterns.push('spikes_detected');
        
        // Check for drops
        const drops = values.filter(v => v < mean - 3 * stdDev).length;
        if (drops > 0) patterns.push('drops_detected');
        
        // Check for trend
        const slope = this.calculateLinearSlope(values);
        if (Math.abs(slope) > 0.1) {
            patterns.push(slope > 0 ? 'upward_trend' : 'downward_trend');
        }
        
        return { patterns };
    }
};

// Export for use in other modules
window.AIAnalytics = AIAnalytics;