// Advanced AI Integration System
// Orchestrates all AI components for a sophisticated user experience

class AdvancedAIIntegration {
    constructor() {
        this.components = {
            advancedAgent: null,
            ragSystem: null,
            queryGenerator: null,
            proactiveMonitoring: null
        };
        
        this.isInitialized = false;
        this.capabilities = {
            naturalLanguageQuery: false,
            proactiveInsights: false,
            semanticSearch: false,
            predictiveAnalytics: false,
            intelligentVisualization: false
        };
    }

    async initialize() {
        if (this.isInitialized) {
            console.log('✅ Advanced AI already initialized, skipping...');
            return;
        }
        
        console.log('🚀 Initializing Advanced AI Integration System...');
        
        try {
            // Add memory cleanup before initialization
            this.cleanupPreviousInstances();
            
            // Initialize core AI components
            await this.initializeComponents();
            
            // Set up inter-component communication
            await this.setupComponentIntegration();
            
            // Enable advanced capabilities
            await this.enableAdvancedCapabilities();
            
            // Note: Proactive systems disabled to prevent renderer crashes
            console.log('ℹ️ Proactive systems disabled to prevent renderer crashes');
            
            // TODO: Re-enable once proactive messaging is fixed with proper rate limiting
            
            this.isInitialized = true;
            console.log('✅ Advanced AI Integration System fully initialized');
            
            // Set up global access
            window.AdvancedAI = {
                isInitialized: true,
                components: this.components,
                capabilities: this.capabilities
            };
            
            // Notify user of new capabilities with additional delay
            setTimeout(() => {
                this.announceCapabilities();
            }, 3000);
            
        } catch (error) {
            console.error('❌ Advanced AI Integration initialization failed:', error);
            console.error('Error details:', error.stack);
            
            // Set a flag that initialization failed
            this.isInitialized = false;
            this.initializationError = error.message;
            
            // Show user-friendly error
            this.showInitializationError(error);
        }
    }
    
    // Show initialization error to user
    showInitializationError(error) {
        // Send error message to AI Agent if available
        if (window.AIAgent && window.AIAgent.addMessage) {
            setTimeout(() => {
                window.AIAgent.addMessage('assistant', 
                    `❌ **AI System Initialization Failed**\n\n` +
                    `I encountered an error while setting up my advanced capabilities:\n\n` +
                    `**Error**: ${error.message}\n\n` +
                    `This might be due to:\n` +
                    `• Missing AI component scripts\n` +
                    `• Script loading order issues\n` +
                    `• Browser compatibility issues\n\n` +
                    `You can try refreshing the page or check the browser console for more details.`,
                    { type: 'initialization_error', error: error.message }
                );
            }, 1000);
        }
    }
    
    // Cleanup method to prevent memory leaks
    cleanupPreviousInstances() {
        // Clear any existing intervals
        if (window.proactiveMonitoringInterval) {
            clearInterval(window.proactiveMonitoringInterval);
            window.proactiveMonitoringInterval = null;
        }
        
        // Clear any existing timeouts
        if (window.advancedAITimeouts) {
            window.advancedAITimeouts.forEach(timeout => clearTimeout(timeout));
            window.advancedAITimeouts = [];
        } else {
            window.advancedAITimeouts = [];
        }
        
        console.log('🧹 Cleaned up previous AI instances');
    }

    async initializeComponents() {
        console.log('🔄 Initializing AI components...');
        
        // Check that all required classes are available
        const requiredClasses = {
            TimeSeriesRAGSystem: window.TimeSeriesRAGSystem,
            IntelligentQueryGenerator: window.IntelligentQueryGenerator, 
            AdvancedAIAgent: window.AdvancedAIAgent,
            ProactiveMonitoringSystem: window.ProactiveMonitoringSystem
        };
        
        const missingClasses = Object.entries(requiredClasses)
            .filter(([name, cls]) => !cls)
            .map(([name]) => name);
            
        if (missingClasses.length > 0) {
            throw new Error(`Required AI classes not available: ${missingClasses.join(', ')}. Make sure all scripts are loaded.`);
        }
        
        // Initialize RAG System first (provides knowledge base for others)
        try {
            this.components.ragSystem = new TimeSeriesRAGSystem();
            await this.components.ragSystem.initialize();
            console.log('✅ RAG System initialized');
        } catch (error) {
            console.error('❌ RAG System initialization failed:', error);
            throw error;
        }
        
        // Initialize Query Generator (needs RAG for examples)
        try {
            this.components.queryGenerator = new IntelligentQueryGenerator();
            await this.components.queryGenerator.initialize();
            console.log('✅ Query Generator initialized');
        } catch (error) {
            console.error('❌ Query Generator initialization failed:', error);
            throw error;
        }
        
        // Initialize Advanced Agent (orchestrates everything)
        try {
            this.components.advancedAgent = new AdvancedAIAgent();
            await this.components.advancedAgent.initialize();
            console.log('✅ Advanced Agent initialized');
        } catch (error) {
            console.error('❌ Advanced Agent initialization failed:', error);
            throw error;
        }
        
        // Initialize Proactive Monitoring (disabled to prevent crashes)
        try {
            // Create but don't initialize to prevent renderer crashes
            this.components.proactiveMonitoring = new ProactiveMonitoringSystem();
            console.log('✅ Proactive Monitoring created (initialization disabled to prevent crashes)');
        } catch (error) {
            console.log('ℹ️ Proactive Monitoring disabled (component not available):', error.message);
            // Don't throw - this is non-critical
        }
        
        console.log('✅ All critical AI components initialized');
    }

    async setupComponentIntegration() {
        console.log('🔗 Setting up component integration...');
        
        // Connect Advanced Agent to RAG System
        this.components.advancedAgent.knowledgeBase = this.components.ragSystem;
        
        // Connect Advanced Agent to Query Generator
        this.components.advancedAgent.queryGenerator = this.components.queryGenerator;
        
        // Connect Query Generator to RAG System
        this.components.queryGenerator.ragSystem = this.components.ragSystem;
        
        // Set up proactive monitoring callbacks
        this.components.proactiveMonitoring.onInsightGenerated = (insight) => {
            this.handleProactiveInsight(insight);
        };
        
        this.components.proactiveMonitoring.onAnomalyDetected = (anomaly) => {
            this.handleAnomalyDetection(anomaly);
        };
        
        console.log('✅ Component integration complete');
    }

    async enableAdvancedCapabilities() {
        console.log('⚡ Enabling advanced capabilities...');
        
        // Enable natural language query processing
        this.capabilities.naturalLanguageQuery = true;
        this.setupNaturalLanguageInterface();
        
        // Enable proactive insights
        this.capabilities.proactiveInsights = true;
        
        // Enable semantic search
        this.capabilities.semanticSearch = true;
        
        // Enable predictive analytics
        this.capabilities.predictiveAnalytics = true;
        
        // Enable intelligent visualization
        this.capabilities.intelligentVisualization = true;
        this.setupIntelligentVisualization();
        
        console.log('✅ Advanced capabilities enabled');
    }

    async startProactiveSystems() {
        console.log('🔄 Starting proactive systems...');
        
        // Start proactive monitoring if datasource is connected
        if (GrafanaConfig.connected) {
            await this.components.proactiveMonitoring.startMonitoring();
        }
        
        // Listen for datasource connection changes
        this.watchForDatasourceChanges();
        
        console.log('✅ Proactive systems started');
    }

    // Natural Language Interface Setup
    setupNaturalLanguageInterface() {
        console.log('✅ Advanced AI integrated directly into AI Agent - no override needed');
        
        // The AI Agent now uses the Advanced AI system directly
        // No need to override sendMessage since it's built-in
    }

    // Advanced processing methods removed - now handled directly in AI Agent

    async handleQueryGeneration(message, context) {
        console.log('🔤 Handling query generation request:', message);
        
        const queryResult = await this.components.queryGenerator.translateNaturalLanguageToQuery(
            message, 
            context
        );
        
        // Format response for chat interface
        let responseText = `I've generated an optimized ${queryResult.queryType} query for you:\n\n`;
        responseText += `\`\`\`${queryResult.queryType}\n${queryResult.generatedQuery}\n\`\`\`\n\n`;
        responseText += `**Explanation:** ${queryResult.explanation}\n\n`;
        
        if (queryResult.optimizations.length > 0) {
            responseText += `**Optimizations applied:**\n`;
            queryResult.optimizations.forEach(opt => {
                responseText += `• ${opt}\n`;
            });
        }
        
        const actions = [
            { label: 'Execute Query', action: 'executeGeneratedQuery', data: queryResult },
            { label: 'Modify Query', action: 'modifyGeneratedQuery', data: queryResult }
        ];
        
        if (queryResult.alternatives.length > 0) {
            actions.push({ label: 'Show Alternatives', action: 'showQueryAlternatives', data: queryResult });
        }
        
        return {
            text: responseText,
            data: {
                type: 'query_generated',
                queryResult
            },
            actions
        };
    }

    async enhanceResponseWithRAG(response, originalMessage) {
        // Retrieve relevant context using RAG
        const ragContext = await this.components.ragSystem.retrieveRelevantContext(originalMessage);
        
        if (ragContext.confidence > 0.7) {
            // Augment response with relevant examples or documentation
            if (ragContext.examples.length > 0) {
                response.examples = ragContext.examples.slice(0, 2);
            }
            
            if (ragContext.documentation.length > 0) {
                response.relatedDocs = ragContext.documentation.slice(0, 2);
            }
        }
        
        return response;
    }

    // Setup intelligent visualization
    setupIntelligentVisualization() {
        // Override chart generation to use AI recommendations
        if (window.Charts) {
            const originalCreateChart = window.Charts.createChart?.bind(window.Charts);
            
            window.Charts.createChart = async (data, options = {}) => {
                if (this.capabilities.intelligentVisualization) {
                    // Use AI to recommend optimal chart type
                    const recommendation = await this.recommendChartType(data, options);
                    options = { ...options, ...recommendation };
                }
                
                // Call original chart creation with enhanced options
                return originalCreateChart ? originalCreateChart(data, options) : null;
            };
        }
    }

    async recommendChartType(data, options) {
        // Analyze data characteristics
        const analysis = this.analyzeDataCharacteristics(data);
        
        // Use AI to recommend optimal visualization
        const recommendation = await this.getVisualizationRecommendation(analysis);
        
        return recommendation;
    }

    analyzeDataCharacteristics(data) {
        // Analyze the data to understand its structure and patterns
        return {
            timeSeriesData: this.isTimeSeriesData(data),
            valueDistribution: this.analyzeValueDistribution(data),
            trendPresent: this.detectTrend(data),
            seasonalityPresent: this.detectSeasonality(data),
            anomaliesPresent: this.detectAnomalies(data)
        };
    }

    // Handle proactive insights - DISABLED to prevent UI crashes
    async handleProactiveInsight(insight) {
        console.log('💡 Proactive insight generated (display disabled):', insight.type || 'insight');
        
        // TEMPORARILY DISABLED: Proactive messages are causing renderer crashes
        // The AI chat interface exists at #aiChatMessages but proactive messages
        // are overwhelming the renderer process and causing DevTools disconnect
        
        // TODO: Implement proper rate limiting and message queuing before re-enabling
        return;
    }

    async formatInsightForChat(insight) {
        const prompt = `Format this monitoring insight as a helpful chat message:

Insight: ${JSON.stringify(insight, null, 2)}

Create a conversational message that:
1. Explains what was discovered
2. Provides context about importance  
3. Suggests actions if needed
4. Uses a friendly, helpful tone

Keep it concise and actionable.`;

        try {
            const formattedMessage = await this.callAIModel(prompt);
            return {
                text: formattedMessage,
                data: { type: 'proactive_insight', insight },
                actions: this.generateInsightActions(insight)
            };
        } catch (error) {
            return {
                text: `I noticed something interesting: ${insight.description || 'New pattern detected in your metrics'}`,
                data: { type: 'proactive_insight', insight }
            };
        }
    }

    // Gather current context for advanced processing
    async gatherCurrentContext() {
        const context = {
            datasource: GrafanaConfig.currentDatasourceName,
            datasourceType: GrafanaConfig.selectedDatasourceType,
            connected: GrafanaConfig.connected,
            availableMetrics: [],
            recentQueries: [],
            systemHealth: {},
            userPreferences: {}
        };
        
        // Get available metrics
        if (window.Schema && Schema.measurements) {
            context.availableMetrics = Schema.measurements.slice(0, 20);
        }
        
        // Get recent query history
        if (window.History) {
            context.recentQueries = History.getRecentQueries(5);
        }
        
        // Get system health status
        context.systemHealth = {
            aiConnected: window.Analytics?.isConnected || false,
            datasourceConnected: GrafanaConfig.connected,
            proactiveMonitoring: this.components.proactiveMonitoring?.isRunning || false
        };
        
        return context;
    }

    // Watch for datasource connection changes
    watchForDatasourceChanges() {
        // Monitor GrafanaConfig changes
        const originalConnect = window.connectToGrafana;
        if (originalConnect) {
            window.connectToGrafana = async (...args) => {
                const result = await originalConnect(...args);
                
                if (GrafanaConfig.connected) {
                    console.log('🔄 Datasource connected - starting proactive monitoring');
                    await this.components.proactiveMonitoring.startMonitoring();
                }
                
                return result;
            };
        }
    }

    // Announce new capabilities to user
    announceCapabilities() {
        const capabilities = [
            '🧠 Advanced natural language understanding',
            '🔍 Intelligent query generation and optimization',  
            '📊 Proactive monitoring and anomaly detection',
            '💡 Contextual insights and recommendations',
            '📚 Knowledge-powered responses with examples'
        ];
        
        console.log('🎉 Advanced AI capabilities now available:');
        capabilities.forEach(cap => console.log(`  ${cap}`));
        
        // Note: Capability announcement disabled to prevent crashes
        console.log('🎉 Advanced AI capabilities available (announcement disabled to prevent crashes)');
        
        // The capability announcement was being sent to the AI chat interface but
        // is causing renderer process crashes. Capabilities are still active,
        // users just won't get the proactive announcement message.
    }

    // Utility methods
    isQueryGenerationRequest(message) {
        const queryIndicators = [
            'generate query', 'create query', 'write query', 'build query',
            'query for', 'sql for', 'influxql for', 'promql for',
            'how to query', 'show me query'
        ];
        
        const lowerMessage = message.toLowerCase();
        return queryIndicators.some(indicator => lowerMessage.includes(indicator));
    }

    async callAIModel(prompt, options = {}) {
        if (window.OpenAIService?.isConnected) {
            return await window.OpenAIService.generateCompletion(prompt, options);
        } else if (window.OllamaService?.isConnected) {
            return await window.OllamaService.generateCompletion(prompt, options);
        }
        throw new Error('No AI service available');
    }

    async learnFromInteraction(message, response) {
        if (this.components.ragSystem) {
            await this.components.ragSystem.storeSuccessfulInteraction(
                message,
                response,
                { success: true },
                { timestamp: new Date(), source: 'advanced_ai' }
            );
        }
    }

    generateInsightActions(insight) {
        const actions = [];
        
        if (insight.type === 'anomaly') {
            actions.push(
                { label: 'Investigate Anomaly', action: 'investigateAnomaly', data: insight },
                { label: 'Set Alert', action: 'createAlert', data: insight }
            );
        }
        
        if (insight.metric) {
            actions.push({ label: 'Analyze Metric', action: 'analyzeMetric', data: { metric: insight.metric } });
        }
        
        return actions;
    }

    // Data analysis utility methods
    isTimeSeriesData(data) {
        return data && data.timestamps && Array.isArray(data.timestamps);
    }

    analyzeValueDistribution(data) {
        if (!data.values || !Array.isArray(data.values)) return {};
        
        const values = data.values.filter(v => typeof v === 'number' && !isNaN(v));
        if (values.length === 0) return {};
        
        values.sort((a, b) => a - b);
        
        return {
            min: values[0],
            max: values[values.length - 1],
            median: values[Math.floor(values.length / 2)],
            range: values[values.length - 1] - values[0]
        };
    }

    detectTrend(data) {
        if (!data.values || data.values.length < 5) return false;
        
        const recentValues = data.values.slice(-10);
        const trend = (recentValues[recentValues.length - 1] - recentValues[0]) / recentValues.length;
        
        return Math.abs(trend) > 0.1; // Threshold for trend detection
    }

    detectSeasonality(data) {
        // Simple seasonality detection - would be more sophisticated in production
        return data.values && data.values.length > 50;
    }

    detectAnomalies(data) {
        // Simple anomaly detection - already handled by proactive monitoring
        return false;
    }

    async getVisualizationRecommendation(analysis) {
        // Return appropriate chart configuration based on data analysis
        if (analysis.timeSeriesData) {
            return {
                type: 'line',
                options: {
                    scales: {
                        x: { type: 'time' },
                        y: { beginAtZero: false }
                    }
                }
            };
        }
        
        return { type: 'bar' };
    }
}

// Initialize the advanced AI system when the page loads
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for core systems to be ready
    setTimeout(async () => {
        try {
            // Only initialize if we have AI services connected
            if (window.Analytics?.isConnected || window.OllamaService?.isConnected || window.OpenAIService?.isConnected) {
                // Clear any existing interval to prevent duplicate initialization
                if (window.advancedAICheckInterval) {
                    clearInterval(window.advancedAICheckInterval);
                    window.advancedAICheckInterval = null;
                }
                
                // Create single instance - don't create multiple!
                if (!window.AdvancedAI) {
                    window.AdvancedAI = new AdvancedAIIntegration();
                }
                await window.AdvancedAI.initialize();
            } else {
                console.log('⏳ Advanced AI waiting for AI service connection...');
                
                // Watch for AI service connection
                window.advancedAICheckInterval = setInterval(async () => {
                    const isAnalyticsConnected = window.Analytics?.isConnected || false;
                    const isOllamaConnected = window.OllamaService?.isConnected || false;
                    const isOpenAIConnected = window.OpenAIService?.isConnected || false;
                    const anyAIConnected = isAnalyticsConnected || isOllamaConnected || isOpenAIConnected;
                    
                    if (anyAIConnected) {
                        clearInterval(window.advancedAICheckInterval);
                        window.advancedAICheckInterval = null;
                        
                        // Only initialize if not already done or in progress
                        if (!window.advancedAIInitializing && !window.AdvancedAI?.isInitialized) {
                            console.log('🔍 AI service detected via interval check, initializing Advanced AI...');
                            await window.initializeAdvancedAIWhenReady();
                        } else {
                            console.log('⏭️ AI detected but Advanced AI already initialized or in progress');
                        }
                    }
                }, 2000);
                
                // Stop checking after 2 minutes
                setTimeout(() => {
                    if (window.advancedAICheckInterval) {
                        clearInterval(window.advancedAICheckInterval);
                        window.advancedAICheckInterval = null;
                        console.log('⏰ Advanced AI initialization timeout - will initialize when AI service connects');
                    }
                }, 120000);
            }
        } catch (error) {
            console.error('Failed to create Advanced AI system:', error);
        }
    }, 3000); // Wait 3 seconds for other systems to initialize
});

// Track initialization state to prevent duplicates
window.advancedAIInitializing = false;

// Manual trigger for when AI services connect
window.initializeAdvancedAIWhenReady = async function() {
    // Check if already initialized via global flag
    if (window.AdvancedAI && window.AdvancedAI.isInitialized) {
        console.log('✅ Advanced AI already initialized, skipping...');
        return;
    }
    
    if (window.advancedAIInitializing) {
        console.log('⏳ Advanced AI initialization already in progress, skipping...');
        return;
    }
    
    // Check if any AI service is actually connected
    const isAnalyticsConnected = window.Analytics?.isConnected || false;
    const isOllamaConnected = window.OllamaService?.isConnected || false;
    const isOpenAIConnected = window.OpenAIService?.isConnected || false;
    const anyAIConnected = isAnalyticsConnected || isOllamaConnected || isOpenAIConnected;
    
    if (!anyAIConnected) {
        console.log('⚠️ No AI services connected, skipping Advanced AI initialization');
        return;
    }
    
    // Check if required classes are available
    const requiredClasses = ['AdvancedAIAgent', 'TimeSeriesRAGSystem', 'IntelligentQueryGenerator', 'ProactiveMonitoringSystem'];
    const missingClasses = requiredClasses.filter(className => !window[className]);
    
    if (missingClasses.length > 0) {
        console.warn('⏳ Some AI classes not yet available:', missingClasses);
        console.log('🔄 Will retry in 1 second...');
        
        // Schedule retry
        setTimeout(() => {
            window.initializeAdvancedAIWhenReady();
        }, 1000);
        
        return;
    }
    
    console.log('✅ All required AI classes are available');
    console.log('🚀 Starting Advanced AI initialization...');
    window.advancedAIInitializing = true;
    
    try {
        // Create single instance - don't create multiple!
        if (!window.AdvancedAI) {
            window.AdvancedAI = new AdvancedAIIntegration();
        }
        await window.AdvancedAI.initialize();
        console.log('✅ Advanced AI initialization completed successfully');
    } catch (error) {
        console.error('❌ Advanced AI initialization failed:', error);
        
        // Show error to user if AIAgent is available
        if (window.AIAgent && window.AIAgent.addMessage) {
            setTimeout(() => {
                window.AIAgent.addMessage('assistant', 
                    `❌ **AI System Initialization Failed**\n\n` +
                    `There was an error setting up the advanced AI features. ` +
                    `You can still use basic functionality, but some advanced features may not be available.\n\n` +
                    `Error: ${error.message}`,
                    { type: 'error' }
                );
            }, 1000);
        }
    } finally {
        window.advancedAIInitializing = false;
    }
};

// Export for global access
window.AdvancedAIIntegration = AdvancedAIIntegration;