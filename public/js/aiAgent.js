// AI Agent Chat Interface
// Interactive conversational interface for time series analysis

const AIAgent = {
    // State management
    state: {
        conversations: [],
        currentConversationId: null,
        isProcessing: false,
        hasActivePopOut: false,
        context: {
            datasource: null,
            measurement: null,
            field: null,
            timeRange: '1h',
            recentMetrics: [],
            discoveries: []
        }
    },

    // AI Assistant avatar management
    avatarDataUrl: null,

    // UI references for embedded chat
    ui: {
        messageList: null,
        input: null,
        sendButton: null,
        contextBar: null,
        statusIndicator: null
    },

    // Initialize the AI Agent
    initialize() {
        console.log('⏰ Initializing Time Buddy AI Agent...');
        this.loadAvatarImage(); // Load avatar image first
        this.loadConversations();
        this.setupEmbeddedUI();
        this.setupEventListeners();
        this.updateContext();
        this.setupElectronChatCommunication(); // Set up Electron chat window communication
        
        console.log('✅ AI Agent initialized');
    },

    // Load AI Assistant avatar image
    async loadAvatarImage() {
        try {
            if (window.electronAPI && typeof window.electronAPI.getAIAvatar === 'function') {
                const result = await window.electronAPI.getAIAvatar();
                if (result && result.success && result.dataUrl && typeof result.dataUrl === 'string') {
                    // Validate data URL format
                    if (result.dataUrl.startsWith('data:image/')) {
                        this.avatarDataUrl = result.dataUrl;
                        console.log('✅ AI avatar loaded via NativeImage');
                    } else {
                        console.warn('⚠️ Invalid data URL format, using fallback');
                        this.avatarDataUrl = null;
                    }
                } else {
                    console.log('ℹ️ Using fallback avatar path:', result?.fallbackPath || 'images/logo.png');
                    this.avatarDataUrl = null; // Will use fallback in getAvatarHTML
                }
            } else {
                console.log('ℹ️ Not in Electron environment or missing getAIAvatar function, using relative path for avatar');
                this.avatarDataUrl = null;
            }
        } catch (error) {
            console.warn('⚠️ Failed to load avatar via IPC, using fallback:', error);
            this.avatarDataUrl = null;
        }
    },

    // Get avatar HTML element
    getAvatarHTML() {
        if (this.avatarDataUrl) {
            return `<img src="${this.avatarDataUrl}" alt="Time Buddy" class="ai-avatar-logo" style="width: 32px; height: 32px; border-radius: 50%; background-color: rgba(107, 70, 193, 0.1); padding: 2px; box-sizing: border-box;">`;
        } else {
            // Fallback to relative path
            return `<img src="images/logo.png" alt="Time Buddy" class="ai-avatar-logo" style="width: 32px; height: 32px; border-radius: 50%; background-color: rgba(107, 70, 193, 0.1); padding: 2px; box-sizing: border-box;">`;
        }
    },

    // Setup embedded UI references
    setupEmbeddedUI() {
        // Reference existing embedded chat elements
        this.ui.messageList = document.getElementById('aiChatMessages');
        this.ui.input = document.getElementById('aiChatInput');
        this.ui.sendButton = document.getElementById('aiChatSend');
        this.ui.contextBar = document.getElementById('aiContextBar');
        this.ui.statusIndicator = document.getElementById('aiAssistantStatus');
        this.ui.popOutButton = document.getElementById('aiChatPopOut');
        
        if (!this.ui.messageList || !this.ui.input || !this.ui.sendButton) {
            console.error('AI Agent: Required UI elements not found');
            return;
        }
        
        console.log('🎨 AI Agent embedded UI setup complete');
    },



    // Setup event listeners for embedded UI
    setupEventListeners() {
        if (!this.ui.input || !this.ui.sendButton) {
            console.error('AI Agent: Required UI elements not found for event listeners');
            return;
        }

        // Input handling
        this.ui.input.addEventListener('input', () => this.handleInputChange());
        this.ui.input.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.ui.sendButton.addEventListener('click', () => this.sendMessage());
        
        // Pop-out button
        if (this.ui.popOutButton) {
            this.ui.popOutButton.addEventListener('click', () => this.popOutChat());
        }

        console.log('🎧 AI Agent event listeners setup complete');
    },



    // Focus the embedded chat input
    focus() {
        if (this.ui.input) {
            this.ui.input.focus();
        }
        this.updateContext();
    },

    // Check if all prerequisites are met
    checkPrerequisites() {
        const issues = [];
        
        // Check Grafana connection
        if (!GrafanaConfig.connected) {
            issues.push('Please connect to a Grafana datasource first.');
        }
        
        // Check AI service (if Analytics is available)
        if (window.Analytics && !Analytics.isConnected) {
            issues.push('Please connect to an AI service first.');
        }
        
        if (issues.length > 0) {
            // Add a helpful message to chat instead of alert
            this.addMessage('assistant', `To get started, I need you to:\n\n${issues.join('\n')}`
                + '\n\nOnce you\'re connected, I can help you analyze your time series data!', 
                { type: 'prerequisites' });
            return false;
        }
        
        return true;
    },


    // Handle input change
    handleInputChange() {
        const value = this.ui.input.value.trim();
        this.ui.sendButton.disabled = !value || this.state.isProcessing;
        
        // Auto-resize textarea
        this.ui.input.style.height = 'auto';
        this.ui.input.style.height = Math.min(this.ui.input.scrollHeight, 120) + 'px';
        
        // Show suggestions
        if (value.length > 2) {
            this.showSuggestions(value);
        } else {
            this.hideSuggestions();
        }
    },

    // Handle key down events
    handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!this.ui.sendButton.disabled) {
                this.sendMessage();
            }
        }
    },

    // Update context from current state
    updateContext() {
        const context = this.state.context;
        
        // Update datasource
        if (GrafanaConfig.connected && GrafanaConfig.currentDatasourceName) {
            context.datasource = GrafanaConfig.currentDatasourceName;
        }
        
        // Update metric if available from Analytics
        if (window.Analytics && Analytics.config.measurement && Analytics.config.field) {
            context.measurement = Analytics.config.measurement;
            context.field = Analytics.config.field;
        }
        
        // Update context bar if it exists
        if (this.ui.contextBar) {
            this.updateContextBar(context);
        }
    },
    
    // Update context bar display
    updateContextBar(context) {
        let contextHTML = '';
        
        if (context.datasource) {
            contextHTML += `
                <span class="ai-context-item">
                    <span class="ai-context-icon">🔗</span>
                    <span class="ai-context-label">${context.datasource}</span>
                </span>
            `;
        }
        
        if (context.measurement && context.field) {
            contextHTML += `
                <span class="ai-context-item">
                    <span class="ai-context-icon">📊</span>
                    <span class="ai-context-label">${context.measurement}.${context.field}</span>
                </span>
            `;
        }
        
        this.ui.contextBar.innerHTML = contextHTML;
    },

    // Show suggestions based on input (placeholder for embedded UI)
    showSuggestions(input) {
        // Note: Suggestions feature could be implemented in embedded UI if needed
        // For now, just log the suggestions that would be shown
        const suggestions = this.generateSuggestions(input);
        if (suggestions.length > 0) {
            console.log('💡 AI suggestions:', suggestions);
        }
    },

    // Generate suggestions based on input
    generateSuggestions(input) {
        const lower = input.toLowerCase();
        const suggestions = [];

        // Common patterns
        const patterns = [
            { trigger: 'show', suggestions: ['Show me anomalies', 'Show current metrics', 'Show trends'] },
            { trigger: 'what', suggestions: ['What anomalies occurred today?', "What's the current status?", 'What trends are emerging?'] },
            { trigger: 'find', suggestions: ['Find spikes', 'Find anomalies', 'Find patterns'] },
            { trigger: 'compare', suggestions: ['Compare to yesterday', 'Compare to last week', 'Compare metrics'] },
            { trigger: 'alert', suggestions: ['Alert me when', 'Alert on threshold', 'Alert on anomaly'] }
        ];

        for (const pattern of patterns) {
            if (lower.includes(pattern.trigger)) {
                suggestions.push(...pattern.suggestions.filter(s => 
                    s.toLowerCase().includes(lower)
                ));
            }
        }

        // Add metric-specific suggestions if context is available
        if (this.state.context.measurement) {
            suggestions.push(`Analyze ${this.state.context.measurement}`);
            suggestions.push(`Show ${this.state.context.measurement} anomalies`);
        }

        return [...new Set(suggestions)].slice(0, 5);
    },

    // Hide suggestions (placeholder for embedded UI)
    hideSuggestions() {
        // Note: No suggestions container in embedded UI
    },

    // Send quick message (for buttons)
    async sendQuickMessage(message) {
        return this.sendMessage(message);
    },

    // Send message
    async sendMessage(text = null) {
        const message = text || this.ui.input.value.trim();
        if (!message) {
            console.log('🔇 No message to send');
            return;
        }
        
        // CRITICAL: Prevent ALL processing if already busy
        if (this.state.isProcessing) {
            console.log('🚫 Already processing a message, rejecting new request:', message.substring(0, 50) + '...');
            return;
        }
        
        // Create unique request ID to prevent duplicate processing
        const requestId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        console.log('🔄 Processing message request:', requestId, message.substring(0, 50) + '...');
        
        // Check if this exact message was just processed (within last 3 seconds)
        const now = Date.now();
        if (this.lastProcessedMessage && 
            this.lastProcessedMessage.text === message && 
            (now - this.lastProcessedMessage.timestamp) < 3000) {
            console.log('🚫 Duplicate message detected, ignoring:', requestId);
            return;
        }
        
        // Check for rapid-fire requests (ANY message within 1 second)
        if (this.lastSendTimestamp && (now - this.lastSendTimestamp) < 1000) {
            console.log('🚫 Rapid-fire request blocked:', requestId);
            return;
        }
        
        // Lock processing IMMEDIATELY to prevent concurrent calls
        this.state.isProcessing = true;
        this.lastSendTimestamp = now;
        this.lastProcessedMessage = { text: message, timestamp: now, requestId };

        // Clear input (only if sidebar is active)
        if (!this.state.hasActivePopOut && this.ui.input) {
            this.ui.input.value = '';
            this.handleInputChange();
            this.hideSuggestions();
        }

        // Add user message (only to the active interface)
        this.addMessage('user', message);

        // Set processing state
        this.state.isProcessing = true;
        if (!this.state.hasActivePopOut && this.ui.sendButton) {
            this.ui.sendButton.disabled = true;
        }

        // Show loading indicator in the active interface only
        if (!this.state.hasActivePopOut) {
            this.showLoading();
        }

        try {
            // Process the message
            const response = await this.processMessage(message);
            
            // Add assistant response (will auto-sync to pop-out via addMessage)
            this.addMessage('assistant', response.text, response.data);

        } catch (error) {
            console.error('Error processing message:', error);
            
            const errorMessage = 'I encountered an error processing your request. Please try again.';
            this.addMessage('assistant', errorMessage, { error: error.message });
            
        } finally {
            // Hide loading indicator in the active interface only
            if (!this.state.hasActivePopOut) {
                this.hideLoading();
            }
            
            this.state.isProcessing = false;
            if (!this.state.hasActivePopOut && this.ui.sendButton) {
                this.ui.sendButton.disabled = false;
            }
        }
    },

    // Process user message using Advanced AI System
    async processMessage(message) {
        // Prevent duplicate processing at the Advanced AI level
        const processId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        console.log('🧠 Processing AI message:', processId, message.substring(0, 50) + '...');
        
        // Check if this exact message is already being processed
        if (this.currentProcessing && this.currentProcessing.message === message) {
            console.log('🚫 Message already being processed, ignoring duplicate:', processId);
            return this.currentProcessing.promise;
        }
        
        // Also check recent processing to catch rapid-fire duplicates
        const now = Date.now();
        if (this.recentProcessing && 
            this.recentProcessing.message === message && 
            (now - this.recentProcessing.timestamp) < 5000) {
            console.log('🚫 Recent duplicate message detected, ignoring:', processId);
            return { text: 'Duplicate request ignored', data: {} };
        }
        
        // Create processing promise to handle duplicates
        const processingPromise = this.doProcessMessage(message, processId);
        this.currentProcessing = { message, promise: processingPromise, processId };
        
        try {
            const result = await processingPromise;
            // Store in recent processing for duplicate detection
            this.recentProcessing = { message, timestamp: Date.now() };
            return result;
        } finally {
            // Clear processing state
            this.currentProcessing = null;
        }
    },
    
    // Actual message processing implementation
    async doProcessMessage(message, processId) {
        try {
            // Use Advanced AI System for all processing
            if (window.AdvancedAI && window.AdvancedAI.isInitialized) {
                console.log('🧠 Using Advanced AI System for:', message);
                
                // Get current context with proper metrics retrieval
                const context = {
                    datasource: this.state.context.datasource,
                    measurement: this.state.context.measurement,
                    field: this.state.context.field,
                    timeRange: this.state.context.timeRange,
                    connected: window.GrafanaConfig?.connected || false,
                    availableMetrics: await this.getAvailableMetrics()
                };
                
                // Process with Advanced AI
                const response = await this.processWithAdvancedAI(message, context);
                
                // Add inspiring sample sentences after AI responses
                if (response.text && response.text.trim()) {
                    response.text += this.renderSampleSentences();
                }
                
                return response;
            }
            
            // Show initialization status instead of fallback
            return this.getInitializationStatus();
            
        } catch (error) {
            console.error('Error processing message:', error);
            return {
                text: "I encountered an error processing your request. Please try again.",
                data: { type: 'error', error: error.message }
            };
        }
    },

    // Get available metrics using the proper centralized Schema access
    async getAvailableMetrics() {
        try {
            console.log('🔍 Getting available metrics from centralized Schema...');
            
            if (!window.Schema) {
                console.log('⚠️ Schema object not available');
                return [];
            }
            
            const datasourceType = window.GrafanaConfig?.selectedDatasourceType || Schema.currentDatasourceType;
            console.log('📊 Current datasource type:', datasourceType);
            
            let metrics = [];
            
            // Use proper centralized access based on datasource type
            if (datasourceType === 'influxdb') {
                metrics = Schema.influxMeasurements || [];
                console.log('📊 Using Schema.influxMeasurements:', metrics.length, 'measurements');
            } else if (datasourceType === 'prometheus') {
                metrics = Schema.prometheusMetrics || [];
                console.log('📊 Using Schema.prometheusMetrics:', metrics.length, 'metrics');
            } else {
                // Try both if datasource type is unclear
                const influxMetrics = Schema.influxMeasurements || [];
                const promMetrics = Schema.prometheusMetrics || [];
                
                if (influxMetrics.length > 0) {
                    metrics = influxMetrics;
                    console.log('📊 Using Schema.influxMeasurements (fallback):', metrics.length, 'measurements');
                } else if (promMetrics.length > 0) {
                    metrics = promMetrics;
                    console.log('📊 Using Schema.prometheusMetrics (fallback):', metrics.length, 'metrics');
                }
            }
            
            if (metrics.length === 0) {
                console.log('⚠️ No metrics found in Schema. Current state:', {
                    datasourceType,
                    influxMeasurements: Schema.influxMeasurements?.length || 0,
                    prometheusMetrics: Schema.prometheusMetrics?.length || 0,
                    connected: window.GrafanaConfig?.connected
                });
            }
            
            // Normalize metric names and return ALL metrics (not limited to 20)
            return metrics.map(m => {
                const name = typeof m === 'string' ? m : (m.name || m.measurement || m);
                return name;
            }).filter(Boolean); // Return all metrics, don't limit to 20
            
        } catch (error) {
            console.error('Error getting available metrics:', error);
            return [];
        }
    },

    // Process message with Advanced AI System
    async processWithAdvancedAI(message, context) {
        try {
            // Check multiple ways to access Advanced AI
            let advancedAgent = null;
            
            if (window.AdvancedAI && window.AdvancedAI.components && window.AdvancedAI.components.advancedAgent) {
                advancedAgent = window.AdvancedAI.components.advancedAgent;
            } else if (window.AdvancedAIAgent) {
                // Try to create instance if class is available
                try {
                    advancedAgent = new window.AdvancedAIAgent();
                    await advancedAgent.initialize();
                } catch (initError) {
                    console.warn('Could not initialize AdvancedAIAgent:', initError);
                }
            }
            
            if (advancedAgent && advancedAgent.processAdvancedQuery) {
                console.log('🧠 Using Advanced AI processing');
                return await advancedAgent.processAdvancedQuery(message, context);
            }
            
            console.log('⚠️ Advanced AI not available, using enhanced basic processing');
            return await this.processEnhancedBasicMessage(message, context);
            
        } catch (error) {
            console.error('Advanced AI processing failed:', error);
            return await this.processEnhancedBasicMessage(message, context);
        }
    },

    // Enhanced basic message processing with intelligent pattern recognition
    async processEnhancedBasicMessage(message, context) {
        const lowerMessage = message.toLowerCase();
        const availableMetrics = context.availableMetrics || [];
        
        console.log('🔍 Enhanced basic processing for:', message);
        console.log('📊 Available metrics count:', availableMetrics.length);
        
        // Handle "show 10 more" or "show more" requests
        if (lowerMessage.includes('show') && (lowerMessage.includes('more') || lowerMessage.includes('10'))) {
            return await this.handleShowMoreMetrics(availableMetrics);
        }
        
        // Handle IOPS and I/O queries with better pattern matching
        if (lowerMessage.includes('iops') || lowerMessage.includes('prometheus measurement') || 
            (lowerMessage.includes('anomal') && (lowerMessage.includes('iops') || lowerMessage.includes('ops')))) {
            return await this.handleIOPSQuery(message, availableMetrics);
        }
        
        // Handle general anomaly queries
        if (lowerMessage.includes('anomal') || lowerMessage.includes('spike') || lowerMessage.includes('unusual')) {
            return await this.handleAnomalyQuery(message, availableMetrics);
        }
        
        // Handle metric queries
        if (lowerMessage.includes('metric') || lowerMessage.includes('measurement')) {
            return await this.handleMetricQuery(message);
        }
        
        if (lowerMessage.includes('help') || lowerMessage.includes('what can you do')) {
            return {
                text: "I'm your AI assistant for time series analysis! I can help you:\n\n• Find and explore available metrics\n• Detect anomalies and patterns\n• Generate optimized queries\n• Analyze your data trends\n• Answer questions about your metrics\n\nWhat would you like to explore?",
                data: { type: 'help' },
                actions: [
                    { label: 'Show Metrics', action: 'showMeasurements' },
                    { label: 'Find Anomalies', action: 'findAnomalies' }
                ]
            };
        }
        
        // Default response
        return {
            text: "I'm here to help with your time series data analysis. What would you like to know about your metrics?",
            data: { type: 'default' },
            actions: [
                { label: 'Show Available Metrics', action: 'showMeasurements' },
                { label: 'Get Help', action: 'showHelp' }
            ]
        };
    },
    
    // Handle "show more" requests
    async handleShowMoreMetrics(availableMetrics) {
        if (availableMetrics.length === 0) {
            return {
                text: "I don't see any metrics available. Please ensure you're connected to a datasource.",
                data: { type: 'no_metrics' }
            };
        }
        
        // Show all metrics grouped by category
        const categorizedMetrics = this.categorizeMetrics(availableMetrics);
        let responseText = `📊 **All Available Metrics** (${availableMetrics.length} total)\n\n`;
        
        Object.entries(categorizedMetrics).forEach(([category, metrics]) => {
            if (metrics.length > 0) {
                const icon = {
                    iops: '⚡',
                    volume: '💾',
                    storage: '📦',
                    object: '🗃️',
                    test: '🧪',
                    other: '📊'
                }[category] || '📊';
                
                responseText += `${icon} **${category.toUpperCase()} Metrics:**\n`;
                metrics.forEach(metric => {
                    responseText += `• \`${metric}\`\n`;
                });
                responseText += `\n`;
            }
        });
        
        return {
            text: responseText,
            data: { type: 'all_metrics', metrics: availableMetrics, categories: categorizedMetrics },
            actions: [
                { label: 'Analyze IOPS Metrics', action: 'analyzeIOPS' },
                { label: 'Find Volume Anomalies', action: 'findVolumeAnomalies' },
                { label: 'Generate Query', action: 'generateQuery' }
            ]
        };
    },
    
    // Categorize metrics intelligently
    categorizeMetrics(metrics) {
        const categories = {
            iops: [],
            volume: [],
            storage: [],
            object: [],
            test: [],
            other: []
        };
        
        metrics.forEach(metric => {
            const lower = metric.toLowerCase();
            if (lower.includes('ops') || lower.includes('read') || lower.includes('write')) {
                categories.iops.push(metric);
            } else if (lower.includes('volume')) {
                categories.volume.push(metric);
            } else if (lower.includes('storage') || lower.includes('bytes')) {
                categories.storage.push(metric);
            } else if (lower.includes('object')) {
                categories.object.push(metric);
            } else if (lower.includes('test') || lower.includes('smoke')) {
                categories.test.push(metric);
            } else {
                categories.other.push(metric);
            }
        });
        
        return categories;
    },
    
    // Handle IOPS-specific queries
    async handleIOPSQuery(message, availableMetrics) {
        const iopsTelated = availableMetrics.filter(metric => {
            const lower = metric.toLowerCase();
            return lower.includes('ops') || lower.includes('read') || lower.includes('write') || 
                   lower.includes('volume') || lower.includes('iops');
        });
        
        if (iopsTelated.length === 0) {
            return {
                text: `I don't see specific IOPS metrics like "prometheus.measurement" in your available data. However, I found these I/O related metrics:\n\n${availableMetrics.filter(m => m.toLowerCase().includes('volume')).map(m => `• ${m}`).join('\n')}\n\nWould you like me to analyze any of these for anomalies?`,
                data: { type: 'no_iops_metrics', availableMetrics: availableMetrics.slice(0, 10) },
                actions: [
                    { label: 'Analyze Volume Metrics', action: 'analyzeVolumeMetrics' },
                    { label: 'Show All Metrics', action: 'showMeasurements' }
                ]
            };
        }
        
        const responseText = `⚡ **IOPS & I/O Related Metrics Found:**\n\n${iopsTelated.map(m => `• \`${m}\``).join('\n')}\n\nI can analyze these for anomalies. Which specific metric would you like me to focus on?`;
        
        return {
            text: responseText,
            data: { type: 'iops_metrics', metrics: iopsTelated },
            actions: [
                { label: 'Analyze Read Operations', action: 'analyzeReadOps' },
                { label: 'Analyze Write Operations', action: 'analyzeWriteOps' },
                { label: 'Find All IOPS Anomalies', action: 'findIOPSAnomalies' }
            ]
        };
    },
    
    // Handle general anomaly queries
    async handleAnomalyQuery(message, availableMetrics) {
        if (availableMetrics.length === 0) {
            return {
                text: "I don't see any metrics available for anomaly analysis. Please ensure you're connected to a datasource first.",
                data: { type: 'no_metrics' }
            };
        }
        
        // Try to identify specific metrics mentioned in the query
        const mentionedMetrics = availableMetrics.filter(metric => 
            message.toLowerCase().includes(metric.toLowerCase())
        );
        
        if (mentionedMetrics.length > 0) {
            const metricList = mentionedMetrics.map(m => `• \`${m}\``).join('\n');
            return {
                text: `🔍 **Anomaly Detection for Mentioned Metrics:**\n\n${metricList}\n\nI can analyze these metrics for unusual patterns, spikes, and anomalies. Which would you like me to start with?`,
                data: { type: 'specific_anomaly_request', metrics: mentionedMetrics },
                actions: [
                    { label: 'Analyze All Mentioned', action: 'analyzeSpecificMetrics' },
                    { label: 'Choose One to Start', action: 'chooseMetric' }
                ]
            };
        }
        
        // General anomaly help with top metrics
        const topMetrics = availableMetrics.slice(0, 5);
        return {
            text: `🔍 **Anomaly Detection Ready**\n\nI can analyze your metrics for unusual patterns. Here are some metrics I can check:\n\n${topMetrics.map(m => `• \`${m}\``).join('\n')}\n\n${availableMetrics.length > 5 ? `...and ${availableMetrics.length - 5} more metrics.` : ''}\n\nWhich metrics would you like me to analyze for anomalies?`,
            data: { type: 'anomaly_help', availableMetrics: topMetrics },
            actions: [
                { label: 'Show All Metrics', action: 'showMeasurements' },
                { label: 'Analyze Top 5 Metrics', action: 'analyzeTopMetrics' },
                { label: 'Help Choose Metrics', action: 'helpChooseMetrics' }
            ]
        };
    },
    
    // Basic message processing (keep for compatibility)
    async processBasicMessage(message) {
        return await this.processEnhancedBasicMessage(message, { availableMetrics: await this.getAvailableMetrics() });
    },

    // Handle metric-related queries  
    async handleMetricQuery(message) {
        const availableMetrics = await this.getAvailableMetrics();
        
        if (availableMetrics.length === 0) {
            return {
                text: "I don't see any metrics available yet. Please make sure you're connected to a datasource first.",
                data: { type: 'no_metrics' },
                actions: [
                    { label: 'Check Connection', action: 'checkConnection' }
                ]
            };
        }
        
        // Categorize metrics for better display
        const categorizedMetrics = this.categorizeMetrics(availableMetrics);
        let responseText = `📊 **Available Metrics** (${availableMetrics.length} total)\n\n`;
        
        // Show first few from each category
        Object.entries(categorizedMetrics).forEach(([category, metrics]) => {
            if (metrics.length > 0) {
                const icon = {
                    iops: '⚡',
                    volume: '💾', 
                    storage: '📦',
                    object: '🗃️',
                    test: '🧪',
                    other: '📊'
                }[category] || '📊';
                
                responseText += `${icon} **${category.toUpperCase()}** (${metrics.length}): `;
                responseText += metrics.slice(0, 3).map(m => `\`${m}\``).join(', ');
                if (metrics.length > 3) {
                    responseText += ` and ${metrics.length - 3} more`;
                }
                responseText += `\n`;
            }
        });
        
        responseText += `\n💡 **Ask me to:**\n• "Show 10 more" to see all metrics\n• "Find anomalies in IOPS" for specific analysis\n• "Analyze [metric name]" for detailed insights`;
        
        return {
            text: responseText,
            data: { 
                type: 'metrics_list', 
                metrics: availableMetrics,
                categories: categorizedMetrics
            },
            actions: [
                { label: 'Show All Metrics', action: 'showAllMetrics' },
                { label: 'Analyze IOPS', action: 'analyzeIOPS' },
                { label: 'Find Anomalies', action: 'findAnomalies' }
            ]
        };
    },

    // Render inspiring sample sentences for follow-up questions
    renderSampleSentences() {
        const sampleSentences = [
            "Show me metrics for the last 24 hours",
            "What anomalies can you detect in my data?",
            "Help me create a query for CPU utilization",
            "Explain this metric pattern to me",
            "What's the trend for memory usage?",
            "Find correlations between these metrics",
            "Show me system performance insights",
            "Help me optimize this query"
        ];
        
        // Randomly select 2 sample sentences
        const selectedSentences = sampleSentences
            .sort(() => 0.5 - Math.random())
            .slice(0, 2);
        
        let html = '<div class="sample-prompts" style="margin-top: 16px; padding: 12px; border-radius: 6px; background-color: rgba(255, 255, 255, 0.03);">';
        html += '<div style="font-size: 11px; color: #888; margin-bottom: 8px;">💡 Try asking:</div>';
        
        selectedSentences.forEach(sentence => {
            html += `<div class="sample-prompt" onclick="AIAgent.sendMessage('${sentence}')" style="
                padding: 6px 10px; 
                margin: 4px 0; 
                background-color: rgba(107, 70, 193, 0.1); 
                border: 1px solid rgba(107, 70, 193, 0.2); 
                border-radius: 12px; 
                cursor: pointer; 
                font-size: 12px; 
                color: #cccccc;
                transition: all 0.2s;
            " onmouseover="this.style.backgroundColor='rgba(107, 70, 193, 0.2)'" onmouseout="this.style.backgroundColor='rgba(107, 70, 193, 0.1)'">"${sentence}"</div>`;
        });
        
        html += '</div>';
        return html;
    },

    // Send a message (used by sample prompts)
    sendMessage(messageText) {
        if (!messageText || !messageText.trim()) return;
        
        // Get the input field and send button from the DOM
        const input = document.getElementById('aiChatInput');
        const sendButton = document.getElementById('aiChatSend');
        
        if (input && sendButton) {
            // Set the input value
            input.value = messageText.trim();
            
            // Trigger the send button click
            sendButton.click();
        }
    },

    // Helper function to serialize data objects safely
    serializeData(data) {
        if (!data) {
            return null;
        }
        
        if (typeof data !== 'object') {
            return data;
        }
        
        // Handle arrays
        if (Array.isArray(data)) {
            return data.map(item => this.serializeData(item));
        }
        
        try {
            // Use JSON parse/stringify for deep cloning and filtering out non-serializable values
            const jsonString = JSON.stringify(data, (key, value) => {
                // Filter out functions, undefined, symbols, etc.
                if (typeof value === 'function' || typeof value === 'undefined' || typeof value === 'symbol') {
                    return undefined;
                }
                
                // Convert dates to ISO strings
                if (value instanceof Date) {
                    return value.toISOString();
                }
                
                // Handle DOM elements and other non-serializable objects
                if (value && typeof value === 'object' && value.nodeType) {
                    return '[DOM Element]';
                }
                
                return value;
            });
            
            return JSON.parse(jsonString);
        } catch (error) {
            console.warn('Error serializing data object:', error, data);
            return { 
                error: 'Failed to serialize data',
                type: typeof data,
                keys: data && typeof data === 'object' ? Object.keys(data) : []
            };
        }
    },

    // Execute action from message
    async executeAction(action) {
        console.log('🎯 Executing action:', action);
        
        // Show loading
        this.showLoading();
        
        try {
            let result;
            
            // Handle actions directly without old AIAgentEngine
            switch (action) {
                case 'showMeasurements':
                    result = await this.handleMetricQuery('show metrics');
                    break;
                    
                case 'analyzeIOPS':
                case 'analyzeVolumeMetrics':
                    const availableMetrics = await this.getAvailableMetrics();
                    result = await this.handleIOPSQuery('analyze IOPS metrics', availableMetrics);
                    break;
                    
                case 'findVolumeAnomalies':
                case 'findIOPSAnomalies':
                    const metrics = await this.getAvailableMetrics();
                    const volumeMetrics = metrics.filter(m => m.toLowerCase().includes('volume') || m.toLowerCase().includes('ops'));
                    result = {
                        text: `🔍 **Analyzing Volume/IOPS Metrics for Anomalies:**\n\n${volumeMetrics.map(m => `• \`${m}\``).join('\n')}\n\nI would analyze these metrics for unusual patterns, but I need to connect to an AI service to perform the actual anomaly detection. Please connect to an AI service first.`,
                        data: { type: 'anomaly_analysis_needed', metrics: volumeMetrics }
                    };
                    break;
                    
                case 'findAnomalies':
                    result = {
                        text: "I'm ready to help you find anomalies! Which metrics would you like me to analyze for unusual patterns?",
                        data: { type: 'anomaly_search' },
                        actions: [
                            { label: 'Show Available Metrics', action: 'showMeasurements' }
                        ]
                    };
                    break;
                    
                case 'showHelp':
                    result = await this.processBasicMessage('help');
                    break;
                    
                case 'checkConnection':
                    const connected = window.GrafanaConfig?.connected || false;
                    result = {
                        text: connected 
                            ? "✅ You're connected to a datasource. Try refreshing the schema to load metrics."
                            : "❌ No datasource connection detected. Please connect to Grafana first.",
                        data: { type: 'connection_status', connected }
                    };
                    break;
                    
                case 'showAllMetrics':
                    const allMetrics = await this.getAvailableMetrics();
                    result = await this.handleShowMoreMetrics(allMetrics);
                    break;
                    
                case 'analyzeTopMetrics':
                    const topMetrics = await this.getAvailableMetrics();
                    result = {
                        text: `📊 **Top Metrics Analysis:**\n\n${topMetrics.slice(0, 5).map(m => `• \`${m}\``).join('\n')}\n\nI would analyze these metrics for patterns and anomalies, but I need an AI service connection to perform the actual analysis. Please connect to an AI service first.`,
                        data: { type: 'analysis_needs_ai', metrics: topMetrics.slice(0, 5) }
                    };
                    break;
                    
                case 'checkInitStatus':
                    result = this.getInitializationStatus();
                    break;
                    
                case 'refreshPage':
                    result = {
                        text: "🔄 **Refreshing Page**\n\nI'll refresh the page to reinitialize all systems. Please wait...",
                        data: { type: 'refreshing' }
                    };
                    // Actually refresh after a short delay
                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                    break;
                    
                case 'checkAIConnection':
                case 'reconnectAI':
                    const aiConnected = (window.OpenAIService && window.OpenAIService.isConnected) || 
                                       (window.OllamaService && window.OllamaService.isConnected);
                    result = {
                        text: aiConnected 
                            ? "✅ **AI Service Connected**\n\nYour AI service appears to be connected. The issue might be with the advanced AI system initialization. Try refreshing the page."
                            : "❌ **No AI Service Connected**\n\nPlease connect to an AI service (OpenAI or Ollama) first. Go to the AI Connections section and set up your connection.",
                        data: { type: 'ai_connection_check', connected: aiConnected }
                    };
                    break;
                    
                default:
                    result = {
                        text: `🔄 **Processing Action: ${action}**\n\nI'm working on your request. If my advanced AI system is still initializing, this might take a moment...`,
                        data: { type: 'action_processing' }
                    };
            }
            
            // Remove loading
            this.hideLoading();
            
            // Add response
            this.addMessage('assistant', result.text, result.data);
            
        } catch (error) {
            console.error('Error executing action:', error);
            this.hideLoading();
            this.addMessage('assistant', 'Failed to execute action: ' + error.message, { error: true });
        }
    },

    // Add message to chat
    addMessage(sender, text, data = null) {
        // Prevent duplicate messages from being added to UI
        const textStr = typeof text === 'string' ? text : String(text || '');
        const messageKey = sender + ':' + textStr.substring(0, 100);
        const now = Date.now();
        
        // Check for recent duplicate messages (within 2 seconds)
        if (this.recentMessages && this.recentMessages[messageKey]) {
            const timeDiff = now - this.recentMessages[messageKey];
            if (timeDiff < 2000) {
                console.log('🚫 Duplicate UI message blocked:', messageKey.substring(0, 50) + '...');
                return;
            }
        }
        
        // Initialize recent messages tracking
        if (!this.recentMessages) {
            this.recentMessages = {};
        }
        
        // Store this message
        this.recentMessages[messageKey] = now;
        
        // Clean up old entries (older than 5 seconds)
        Object.keys(this.recentMessages).forEach(key => {
            if (now - this.recentMessages[key] > 5000) {
                delete this.recentMessages[key];
            }
        });
        
        const messageEl = document.createElement('div');
        messageEl.className = `message ${sender}`;
        
        const avatar = sender === 'user' ? '👤' : null; // Will use logo image for assistant
        const hasSamplePrompts = textStr.includes('<div class="sample-prompts">');
        
        // Process content based on sender and content type
        let processedContent;
        if (hasSamplePrompts) {
            // Split text into main content and sample prompts
            const parts = textStr.split('<div class="sample-prompts">');
            const mainContent = parts[0];
            const promptsHtml = '<div class="sample-prompts">' + parts[1];
            
            // Process main content for markdown if it's an assistant message
            let processedMainContent;
            if (sender === 'assistant' && this.containsMarkdown(mainContent)) {
                console.log('🎨 Rendering markdown for assistant message with actions');
                processedMainContent = this.renderMarkdown(mainContent);
            } else {
                processedMainContent = this.escapeHtml(mainContent);
            }
            
            // Combine processed content with sample prompts
            processedContent = processedMainContent + promptsHtml;
        } else if (sender === 'assistant' && this.containsMarkdown(textStr)) {
            console.log('🎨 Rendering markdown for assistant message');
            processedContent = this.renderMarkdown(textStr);
        } else {
            processedContent = this.escapeHtml(textStr);
        }
        
        // SECURITY FIX: Create elements safely to prevent HTML injection
        const avatarEl = document.createElement('div');
        avatarEl.className = 'message-avatar';
        
        if (sender === 'assistant') {
            // Use Time Buddy logo for assistant messages (NativeImage or fallback)
            avatarEl.innerHTML = this.getAvatarHTML();
        } else {
            // Use emoji for user messages
            avatarEl.textContent = avatar;
        }
        
        const contentEl = document.createElement('div');
        contentEl.className = 'message-content';
        
        // Use innerHTML only for processed content (already escaped or from trusted AI source)
        contentEl.innerHTML = processedContent;
        
        // SECURITY FIX: Handle error messages safely - never use innerHTML for error data
        if (data && data.error) {
            const errorEl = document.createElement('div');
            errorEl.className = 'message-error';
            errorEl.textContent = typeof data.error === 'string' ? data.error : 'An error occurred';
            contentEl.appendChild(errorEl);
        }
        
        messageEl.appendChild(avatarEl);
        messageEl.appendChild(contentEl);

        // Check if we need to remove any welcome messages
        const welcomeMessages = this.ui.messageList.querySelectorAll('.ai-welcome-message');
        welcomeMessages.forEach(msg => msg.remove());

        // Handle display based on active interface
        if (!this.state.hasActivePopOut) {
            // Sidebar is active - show message there
            this.ui.messageList.appendChild(messageEl);
            this.scrollToBottom();
        } else if (sender === 'assistant') {
            // Pop-out is active and this is an assistant response - send to pop-out
            if (window.electronAPI) {
                window.electronAPI.sendChatResponse(textStr);
            }
        }
        // Note: User messages from pop-out are already displayed in the pop-out window

        // Store in conversation history (store plain text version)
        if (!this.state.currentConversationId) {
            this.startNewConversation();
        }

        // Always store messages in conversation history regardless of active interface
        const conversation = this.state.conversations.find(c => c.id === this.state.currentConversationId);
        if (conversation) {
            conversation.messages.push({ 
                sender, 
                text: typeof text === 'string' ? text : String(text), 
                data, 
                timestamp: new Date() 
            });
            
            console.log(`💾 Stored ${sender} message in conversation history. Total messages: ${conversation.messages.length}`);
        }
        
        this.saveConversations();
    },

    // Escape HTML for security
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Check if text contains markdown formatting
    containsMarkdown(text) {
        const markdownPatterns = [
            /#{1,6}\s+.+/,           // Headers (# ## ###)
            /\*\*.+?\*\*/,           // Bold (**text**)
            /\*.+?\*/,               // Italic (*text*)
            /`{1,3}.+?`{1,3}/,       // Code (`code` or ```code```)
            /^\s*[\*\-\+]\s+/m,      // Unordered lists (* - +)
            /^\s*\d+\.\s+/m,         // Ordered lists (1. 2.)
            /\[.+?\]\(.+?\)/,        // Links [text](url)
        ];
        
        const hasMarkdown = markdownPatterns.some(pattern => pattern.test(text));
        console.log(`🔍 Markdown detection for text (${text.substring(0, 50)}...): ${hasMarkdown}`);
        return hasMarkdown;
    },

    // Simple markdown to HTML converter
    renderMarkdown(text) {
        console.log('🎨 renderMarkdown called with:', text.substring(0, 200) + '...');
        console.log('🔍 marked available:', typeof marked !== 'undefined');
        console.log('🔍 hljs available:', typeof hljs !== 'undefined');
        
        // Check for code blocks in the input
        const codeBlockMatches = text.match(/```[\s\S]*?```/g);
        console.log('🔍 Code blocks found:', codeBlockMatches ? codeBlockMatches.length : 0);
        if (codeBlockMatches) {
            codeBlockMatches.forEach((block, i) => {
                console.log(`📝 Code block ${i + 1}:`, block.substring(0, 100) + '...');
            });
        }
        
        // Configure marked.js with highlight.js for syntax highlighting
        if (typeof marked !== 'undefined' && typeof hljs !== 'undefined') {
            console.log('✅ Using marked.js with highlight.js');
            
            // Test if highlight.js is working
            console.log('🧪 Testing hljs.highlight with SQL:', hljs.getLanguage('sql') ? 'available' : 'not available');
            
            const renderer = new marked.Renderer();
            const originalCode = renderer.code;
            renderer.code = function(code, lang, escaped) {
                console.log('🌈 Custom renderer code function called, lang:', lang);
                
                // Map custom query languages to appropriate highlighters
                const languageMap = {
                    'influxql': 'sql',
                    'promql': 'javascript',
                    'prometheus': 'javascript'
                };
                
                const mappedLang = languageMap[lang] || lang;
                console.log('🎯 Mapped language:', mappedLang);
                
                if (mappedLang && hljs.getLanguage(mappedLang)) {
                    try {
                        const result = hljs.highlight(code, { language: mappedLang }).value;
                        console.log('✨ Syntax highlighting successful');
                        // Add inline styles as fallback in case CSS doesn't load
                        return `<pre style="background: #1e1e1e; padding: 12px; border-radius: 4px; overflow-x: auto;"><code class="hljs language-${mappedLang}" style="color: #d4d4d4; font-family: 'Courier New', Consolas, monospace;">${result}</code></pre>`;
                    } catch (err) {
                        console.warn('Syntax highlighting failed for language:', mappedLang, err);
                    }
                }
                
                const autoResult = hljs.highlightAuto(code).value;
                console.log('🔄 Using auto-detection');
                return `<pre style="background: #1e1e1e; padding: 12px; border-radius: 4px; overflow-x: auto;"><code class="hljs" style="color: #d4d4d4; font-family: 'Courier New', Consolas, monospace;">${autoResult}</code></pre>`;
            };
            
            marked.setOptions({
                renderer: renderer,
                breaks: true,
                gfm: true
            });
            
            try {
                const result = marked.parse(text);
                console.log('✅ Marked.js parsing successful');
                
                // Debug: log a snippet of the generated HTML to see if classes are present
                const codeMatch = result.match(/<pre><code[^>]*>[\s\S]*?<\/code><\/pre>/);
                if (codeMatch) {
                    console.log('🔍 Generated HTML sample:', codeMatch[0].substring(0, 200) + '...');
                }
                
                return result;
            } catch (err) {
                console.error('Markdown parsing failed, falling back to simple HTML:', err);
                return this.fallbackMarkdown(text);
            }
        } else {
            console.warn('❌ marked.js or highlight.js not available, using fallback');
            return this.fallbackMarkdown(text);
        }
    },
    
    // Fallback markdown renderer for when libraries aren't available
    fallbackMarkdown(text) {
        let html = text;
        
        // Headers
        html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
        
        // Bold and italic
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Code blocks
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            const languageClass = lang ? ` class="language-${lang}"` : '';
            const escapedCode = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<pre><code${languageClass}>${escapedCode.trim()}</code></pre>`;
        });
        
        // Inline code
        html = html.replace(/`(.*?)`/g, '<code>$1</code>');
        
        // Line breaks
        html = html.replace(/\n\n/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');
        
        return html;
    },

    // Convert markdown lists to HTML lists
    convertMarkdownLists(text) {
        // Handle unordered lists
        text = text.replace(/^(\s*[\*\-\+]\s+.+(?:\n\s*[\*\-\+]\s+.+)*)/gm, (match) => {
            const items = match.split('\n').map(line => {
                const cleaned = line.replace(/^\s*[\*\-\+]\s+/, '').trim();
                return cleaned ? `<li>${cleaned}</li>` : '';
            }).filter(Boolean).join('');
            return `<ul>${items}</ul>`;
        });
        
        // Handle ordered lists
        text = text.replace(/^(\s*\d+\.\s+.+(?:\n\s*\d+\.\s+.+)*)/gm, (match) => {
            const items = match.split('\n').map(line => {
                const cleaned = line.replace(/^\s*\d+\.\s+/, '').trim();
                return cleaned ? `<li>${cleaned}</li>` : '';
            }).filter(Boolean).join('');
            return `<ol>${items}</ol>`;
        });
        
        return text;
    },

    // Pop out chat into floating window using Electron IPC
    async popOutChat() {
        // Ensure we have a current conversation
        if (!this.state.currentConversationId) {
            this.startNewConversation();
        }
        
        // Mark that we have an active pop-out FIRST
        this.state.hasActivePopOut = true;
        
        // Hide sidebar chat and show "bring back" button
        this.hideSidebarChat();
        
        // Open pop-out window with current conversation (serialized)
        try {
            const currentConversation = this.state.conversations.find(c => c.id === this.state.currentConversationId);
            
            // Create a simple conversation object for IPC
            const simpleConversation = currentConversation ? {
                messages: (currentConversation.messages || []).map(msg => ({
                    sender: msg.sender || msg.role || 'user',
                    text: msg.text || msg.content || '',
                    data: null // Skip data to avoid serialization issues
                }))
            } : { messages: [] };
            
            await window.electronAPI.openChatWindow({
                conversation: simpleConversation
            });
            console.log('✅ AI Assistant chat window opened - sidebar hidden');
            
        } catch (error) {
            console.error('❌ Failed to open chat window:', error);
            // If failed to open, restore sidebar and reset state
            this.state.hasActivePopOut = false;
            this.showSidebarChat();
        }
    },
    

    // Setup Electron IPC communication with chat window
    setupElectronChatCommunication() {
        if (!window.electronAPI) {
            console.log('⚠️ Electron API not available, skipping chat window communication setup');
            return;
        }
        
        // Listen for messages from the chat window
        window.electronAPI.onChatMessageFromPopup((message) => {
            console.log('📨 Received message from chat window:', message);
            this.handleChatWindowMessage(message);
        });
        
        // Listen for chat window close events
        window.electronAPI.onChatWindowClosed(() => {
            console.log('🪟 Chat window closed - restoring sidebar');
            this.bringBackToSidebar();
        });
        
        console.log('✅ Electron chat window communication setup complete');
    },

    // Hide sidebar chat and show "bring back" button
    hideSidebarChat() {
        console.log('🫥 Hiding sidebar chat, UI elements:', {
            messageList: !!this.ui.messageList,
            input: !!this.ui.input,
            inputParent: this.ui.input ? !!this.ui.input.parentElement : false
        });
        
        if (!this.ui.messageList) {
            console.warn('⚠️ No messageList found, cannot hide sidebar');
            return;
        }
        
        // Hide the chat messages and input
        this.ui.messageList.style.display = 'none';
        if (this.ui.input && this.ui.input.parentElement) {
            console.log('🫥 Hiding input container');
            this.ui.input.parentElement.style.display = 'none';
        }
        
        // Create and show "bring back" button
        this.showBringBackButton();
    },

    // Show sidebar chat and hide "bring back" button
    showSidebarChat() {
        console.log('👁️ Showing sidebar chat');
        
        if (!this.ui.messageList) {
            console.warn('⚠️ No messageList found, cannot show sidebar');
            return;
        }
        
        // Hide "bring back" button first
        this.hideBringBackButton();
        
        // Show the chat messages and input with proper styling
        this.ui.messageList.style.display = 'block';
        if (this.ui.input && this.ui.input.parentElement) {
            console.log('👁️ Showing input container');
            const inputContainer = this.ui.input.parentElement;
            inputContainer.style.display = 'flex';
            inputContainer.style.width = '100%';
            inputContainer.style.minHeight = 'auto'; // Reset any height constraints
            
            // Ensure input styling is correct
            this.ui.input.style.width = '';
            this.ui.input.style.height = '';
            this.ui.input.style.fontSize = '';
            
            // Ensure send button styling is correct
            if (this.ui.sendButton) {
                this.ui.sendButton.style.width = '';
                this.ui.sendButton.style.height = '';
                this.ui.sendButton.style.fontSize = '';
            }
        }
        
        this.state.hasActivePopOut = false;
        console.log('✅ Sidebar chat restored');
    },

    // Show the "bring back to sidebar" button
    showBringBackButton() {
        // Remove existing button if any
        this.hideBringBackButton();
        
        const bringBackButton = document.createElement('div');
        bringBackButton.id = 'aiChatBringBack';
        bringBackButton.className = 'ai-bring-back-container';
        bringBackButton.innerHTML = `
            <div class="ai-bring-back-message">
                <div class="ai-bring-back-icon">🪟</div>
                <div class="ai-bring-back-text">
                    <h4>AI Assistant opened in separate window</h4>
                    <p>Chat is now available in the pop-out window</p>
                </div>
            </div>
            <button class="ai-bring-back-button" onclick="AIAgent.bringBackToSidebar()">
                📥 Bring Back to Sidebar
            </button>
        `;
        
        // Add styles with ID for cleanup
        const style = document.createElement('style');
        style.id = 'aiChatBringBackStyles';
        style.textContent = `
            .ai-bring-back-container {
                padding: 20px;
                text-align: center;
                background: #2d2d30;
                border-radius: 8px;
                margin: 10px;
                border: 1px solid #454545;
            }
            .ai-bring-back-message {
                margin-bottom: 15px;
            }
            .ai-bring-back-icon {
                font-size: 48px;
                margin-bottom: 10px;
            }
            .ai-bring-back-text h4 {
                color: #ffffff;
                margin: 0 0 5px 0;
                font-size: 16px;
            }
            .ai-bring-back-text p {
                color: #cccccc;
                margin: 0;
                font-size: 14px;
            }
            .ai-bring-back-button {
                background: #007acc;
                border: none;
                color: white;
                padding: 12px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: background 0.2s;
            }
            .ai-bring-back-button:hover {
                background: #005a9e;
            }
        `;
        document.head.appendChild(style);
        
        // Insert the button where the chat messages were
        if (this.ui.messageList && this.ui.messageList.parentElement) {
            this.ui.messageList.parentElement.insertBefore(bringBackButton, this.ui.messageList);
        }
    },

    // Hide the "bring back to sidebar" button
    hideBringBackButton() {
        const existingButton = document.getElementById('aiChatBringBack');
        if (existingButton) {
            existingButton.remove();
        }
        
        // Also remove any injected styles for the bring back button
        const existingStyle = document.getElementById('aiChatBringBackStyles');
        if (existingStyle) {
            existingStyle.remove();
        }
    },

    // Bring chat back from pop-out to sidebar
    async bringBackToSidebar() {
        console.log('📥 Bringing AI Assistant back to sidebar');
        
        // Reset the active pop-out state first
        this.state.hasActivePopOut = false;
        
        // First, try to close the chat window
        try {
            if (window.electronAPI) {
                await window.electronAPI.closeChatWindow();
                console.log('✅ Chat window close requested');
            }
        } catch (error) {
            console.warn('⚠️ Could not close chat window via IPC:', error);
        }
        
        // Show sidebar chat
        this.showSidebarChat();
        
        // Ensure we have a current conversation
        if (!this.state.currentConversationId) {
            console.log('🔄 No current conversation, creating new one');
            this.startNewConversation();
        }
        
        // Debug: Log current conversation state
        const currentConversation = this.state.conversations.find(c => c.id === this.state.currentConversationId);
        console.log('🔍 Current conversation state:', {
            id: this.state.currentConversationId,
            hasConversation: !!currentConversation,
            messageCount: currentConversation ? currentConversation.messages.length : 0,
            messages: currentConversation ? currentConversation.messages.map(m => ({
                sender: m.sender || m.role,
                textPreview: (m.text || m.content || '').substring(0, 30) + '...'
            })) : []
        });
        
        // Force update the conversation display
        this.updateConversationDisplay();
        
        // Focus the sidebar input
        if (this.ui.input) {
            this.ui.input.focus();
        }
        
        console.log('✅ AI Assistant brought back to sidebar');
    },

    // Handle messages from the chat window
    async handleChatWindowMessage(message) {
        // Don't process if we don't have an active pop-out
        if (!this.state.hasActivePopOut) {
            console.warn('Received chat window message but no active pop-out');
            return;
        }
        
        console.log('📨 Processing chat window message:', message);
        
        // Show loading in chat window
        window.electronAPI.showChatLoading();
        
        try {
            // Ensure we have a current conversation
            if (!this.state.currentConversationId) {
                console.log('Creating new conversation for pop-out message');
                this.startNewConversation();
            }
            
            // Add the user message to the current conversation first
            const currentConversation = this.state.conversations.find(c => c.id === this.state.currentConversationId);
            if (currentConversation) {
                currentConversation.messages.push({
                    sender: 'user',
                    text: message,
                    timestamp: new Date().toISOString(),
                    data: null
                });
                console.log('✅ User message added to conversation');
            }
            
            // Process the message using the main AI Agent
            const response = await this.processMessage(message);
            
            // Add the AI response to the conversation
            if (response && response.text && currentConversation) {
                currentConversation.messages.push({
                    sender: 'assistant',
                    text: response.text,
                    timestamp: new Date().toISOString(),
                    data: response.data || null
                });
                console.log('✅ AI response added to conversation');
                
                // Save the updated conversation
                this.saveConversations();
            }
            
            // Send the response back to the chat window
            if (response && response.text) {
                window.electronAPI.sendChatResponse(response.text);
                console.log('✅ Response sent to chat window');
            }
            
        } catch (error) {
            console.error('Error processing chat window message:', error);
            // Send error response to chat window
            window.electronAPI.sendChatResponse('I encountered an error processing your request. Please try again.');
        } finally {
            // Hide loading in chat window
            window.electronAPI.hideChatLoading();
        }
    },




    // Show loading indicator
    showLoading() {
        const loadingEl = document.createElement('div');
        loadingEl.className = 'message assistant';
        loadingEl.id = 'aiAgentLoading';
        // Create loading element with Time Buddy logo
        const avatarEl = document.createElement('div');
        avatarEl.className = 'message-avatar';
        
        const contentEl = document.createElement('div');
        contentEl.className = 'message-content';
        contentEl.innerHTML = `
                <div class="message-loading">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            `;
        
        loadingEl.appendChild(avatarEl);
        loadingEl.appendChild(contentEl);
        this.ui.messageList.appendChild(loadingEl);
        this.scrollToBottom();
    },

    // Hide loading indicator
    hideLoading() {
        const loading = document.getElementById('aiAgentLoading');
        if (loading) {
            loading.remove();
        }
    },

    // Scroll to bottom of messages
    scrollToBottom() {
        this.ui.messageList.scrollTop = this.ui.messageList.scrollHeight;
    },

    // Start new conversation
    startNewConversation() {
        const conversation = {
            id: Date.now().toString(),
            messages: [],
            createdAt: new Date(),
            context: { ...this.state.context }
        };
        
        this.state.conversations.push(conversation);
        this.state.currentConversationId = conversation.id;
        
        // Limit to last 10 conversations
        if (this.state.conversations.length > 10) {
            this.state.conversations.shift();
        }
        
        this.saveConversations();
    },

    // Create new conversation (alias for compatibility)
    createNewConversation() {
        return this.startNewConversation();
    },

    // Update conversation display with current messages
    updateConversationDisplay() {
        if (!this.ui.messageList) {
            console.warn('Message list UI element not found');
            return;
        }

        // Clear existing messages
        this.ui.messageList.innerHTML = '';

        // Find current conversation
        const currentConversation = this.state.conversations.find(
            c => c.id === this.state.currentConversationId
        );

        if (!currentConversation || !currentConversation.messages) {
            return;
        }

        // Display all messages in the conversation by directly adding to sidebar
        console.log(`🔄 Rebuilding sidebar with ${currentConversation.messages.length} messages`);
        for (const message of currentConversation.messages) {
            // Handle different message formats (content/text, role/sender)
            const text = message.text || message.content || '';
            const sender = message.sender || (message.role === 'user' ? 'user' : 'assistant');
            const data = message.data || null;
            
            console.log(`📝 Adding ${sender} message to sidebar: ${text.substring(0, 50)}...`);
            this.addMessageDirectlyToSidebar(sender, text, data);
        }

        // Scroll to bottom
        this.scrollToBottom();
    },

    // Add message directly to sidebar (bypasses active interface logic)
    addMessageDirectlyToSidebar(sender, text, data = null) {
        if (!this.ui.messageList) {
            console.warn('Cannot add message to sidebar - messageList not found');
            return;
        }

        // Create message element (same logic as addMessage but forced to sidebar)
        const messageEl = document.createElement('div');
        messageEl.className = `message ${sender}`;
        
        const avatar = sender === 'user' ? '👤' : null; // Will use logo image for assistant
        const textStr = typeof text === 'string' ? text : String(text || '');
        const hasSamplePrompts = textStr.includes('<div class="sample-prompts">');
        
        // Process content based on sender and content type
        let processedContent;
        if (hasSamplePrompts) {
            // Split text into main content and sample prompts
            const parts = textStr.split('<div class="sample-prompts">');
            const mainContent = parts[0];
            const promptsHtml = '<div class="sample-prompts">' + parts[1];
            
            // Process main content for markdown if it's an assistant message
            let processedMainContent;
            if (sender === 'assistant' && this.containsMarkdown(mainContent)) {
                processedMainContent = this.renderMarkdown(mainContent);
            } else {
                processedMainContent = this.escapeHtml(mainContent);
            }
            
            // Combine processed content with sample prompts
            processedContent = processedMainContent + promptsHtml;
        } else if (sender === 'assistant' && this.containsMarkdown(textStr)) {
            processedContent = this.renderMarkdown(textStr);
        } else {
            processedContent = this.escapeHtml(textStr);
        }
        
        // SECURITY FIX: Create elements safely to prevent HTML injection
        const avatarEl = document.createElement('div');
        avatarEl.className = 'message-avatar';
        
        if (sender === 'assistant') {
            // Use Time Buddy logo for assistant messages (NativeImage or fallback)
            avatarEl.innerHTML = this.getAvatarHTML();
        } else {
            // Use emoji for user messages
            avatarEl.textContent = avatar;
        }
        
        const contentEl = document.createElement('div');
        contentEl.className = 'message-content';
        
        // Use innerHTML only for processed content (already escaped or from trusted AI source)
        contentEl.innerHTML = processedContent;
        
        // SECURITY FIX: Handle error messages safely - never use innerHTML for error data
        if (data && data.error) {
            const errorEl = document.createElement('div');
            errorEl.className = 'message-error';
            errorEl.textContent = typeof data.error === 'string' ? data.error : 'An error occurred';
            contentEl.appendChild(errorEl);
        }
        
        messageEl.appendChild(avatarEl);
        messageEl.appendChild(contentEl);

        // Always add to sidebar messageList
        this.ui.messageList.appendChild(messageEl);
    },

    // Display message (alias for addMessage with different parameter order)
    displayMessage(text, role, type = 'normal') {
        // Convert role to sender format and call addMessage
        const sender = role === 'user' ? 'user' : 'assistant';
        const data = type !== 'normal' ? { type } : null;
        this.addMessage(sender, text, data);
    },

    // Load conversations from storage
    loadConversations() {
        try {
            const saved = localStorage.getItem('aiAgentConversations');
            if (saved) {
                this.state.conversations = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Failed to load conversations:', error);
        }
    },

    // Save conversations to storage with security limits
    saveConversations() {
        try {
            // SECURITY FIX: Implement storage limits to prevent memory leaks
            const MAX_CONVERSATIONS = 50;
            const MAX_MESSAGES_PER_CONVERSATION = 100;
            const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB limit
            
            // Limit number of conversations
            let limitedConversations = this.state.conversations.slice(-MAX_CONVERSATIONS);
            
            // Limit messages per conversation and sanitize data
            limitedConversations = limitedConversations.map(conv => ({
                ...conv,
                messages: (conv.messages || []).slice(-MAX_MESSAGES_PER_CONVERSATION).map(msg => ({
                    sender: msg.sender || 'user',
                    text: typeof msg.text === 'string' ? msg.text.substring(0, 10000) : '', // Limit message length
                    timestamp: msg.timestamp || new Date().toISOString(),
                    data: msg.data ? {
                        type: msg.data.type || null,
                        // Remove potentially large or sensitive data
                        error: msg.data.error ? (typeof msg.data.error === 'string' ? msg.data.error.substring(0, 1000) : null) : null
                    } : null
                }))
            }));
            
            // Check total size and reduce if necessary
            let serialized = JSON.stringify(limitedConversations);
            while (serialized.length > MAX_STORAGE_SIZE && limitedConversations.length > 1) {
                // Remove oldest conversation if too large
                limitedConversations.shift();
                serialized = JSON.stringify(limitedConversations);
            }
            
            // If still too large, reduce messages per conversation
            if (serialized.length > MAX_STORAGE_SIZE) {
                limitedConversations = limitedConversations.map(conv => ({
                    ...conv,
                    messages: conv.messages.slice(-50) // Further reduce to 50 messages per conversation
                }));
                serialized = JSON.stringify(limitedConversations);
            }
            
            localStorage.setItem('aiAgentConversations', serialized);
            
            // Update state to match what was actually saved
            this.state.conversations = limitedConversations;
            
            console.log(`💾 Saved ${limitedConversations.length} conversations (${Math.round(serialized.length / 1024)}KB)`);
            
        } catch (error) {
            console.error('Failed to save conversations:', error);
            
            // If storage is full, try to recover by clearing old data
            if (error.name === 'QuotaExceededError') {
                console.warn('Storage quota exceeded, clearing old conversations');
                try {
                    // Keep only the current conversation
                    const currentConv = this.state.conversations.find(c => c.id === this.state.currentConversationId);
                    this.state.conversations = currentConv ? [currentConv] : [];
                    localStorage.setItem('aiAgentConversations', JSON.stringify(this.state.conversations));
                } catch (retryError) {
                    console.error('Failed to recover from storage error:', retryError);
                }
            }
        }
    },

    // Receive proactive messages from the advanced AI system
    receiveProactiveMessage(message, retryCount = 0) {
        try {
            console.log('💡 Received proactive message:', message);
            
            // Prevent infinite recursion
            if (retryCount > 3) {
                console.warn('⚠️ Maximum retries reached for proactive message, skipping');
                return;
            }
            
            // Prevent processing if UI elements are missing (indicates crash/reload scenario)
            if (!this.ui.messageList) {
                console.warn('⚠️ UI elements missing, skipping proactive message');
                return;
            }
            
            // Add the proactive message to the current conversation
            if (this.state.currentConversationId) {
                const conversation = this.state.conversations.find(c => c.id === this.state.currentConversationId);
                if (conversation) {
                    // Check for duplicate messages to prevent loops
                    const isDuplicate = conversation.messages.some(msg => 
                        msg.type === 'proactive' && 
                        (msg.content === (message.text || message)) &&
                        (Date.now() - new Date(msg.timestamp).getTime()) < 5000 // Within 5 seconds
                    );
                    
                    if (isDuplicate) {
                        console.log('⚠️ Duplicate proactive message detected, skipping');
                        return;
                    }
                    
                    conversation.messages.push({
                        role: 'assistant',
                        content: message.text || message,
                        timestamp: new Date(),
                        type: 'proactive',
                        data: message.data || {},
                        actions: message.actions || []
                    });
                    
                    // Update the UI safely with timeout to prevent blocking
                    setTimeout(() => {
                        try {
                            this.updateConversationDisplay();
                            this.saveConversations();
                            
                            // Auto-scroll to new message
                            const chatContainer = document.querySelector('.ai-chat-messages');
                            if (chatContainer) {
                                setTimeout(() => {
                                    chatContainer.scrollTop = chatContainer.scrollHeight;
                                }, 50);
                            }
                        } catch (error) {
                            console.error('Error updating conversation display:', error);
                        }
                    }, 10);
                }
            } else {
                // Create a new conversation for the proactive message
                try {
                    this.createNewConversation();
                    
                    // Verify conversation was created before retrying
                    if (this.state.currentConversationId) {
                        // Retry with small delay to allow conversation to be fully created
                        setTimeout(() => this.receiveProactiveMessage(message, retryCount + 1), 50);
                    } else {
                        console.warn('⚠️ Failed to create conversation for proactive message');
                    }
                } catch (error) {
                    console.error('Error creating new conversation:', error);
                }
            }
        } catch (error) {
            console.error('Critical error in receiveProactiveMessage:', error);
            // Don't throw the error to prevent crashing the entire app
        }
    },

    // Receive proactive notifications (alternative method name for compatibility)
    receiveProactiveNotification(notification) {
        console.log('🔔 Received proactive notification:', notification);
        
        // Convert notification to message format
        const message = {
            text: `**${notification.title}**\n\n${notification.message}`,
            data: { 
                type: 'notification', 
                priority: notification.priority,
                tags: notification.tags 
            },
            actions: notification.actions || []
        };
        
        this.receiveProactiveMessage(message);
    },

    // Get initialization status instead of fallback processing
    getInitializationStatus() {
        // Check what's initializing
        const status = {
            advancedAI: !!window.AdvancedAI,
            components: !!(window.AdvancedAI && window.AdvancedAI.components),
            agent: !!(window.AdvancedAI && window.AdvancedAI.components && window.AdvancedAI.components.advancedAgent),
            initialized: !!(window.AdvancedAI && window.AdvancedAI.isInitialized)
        };
        
        console.log('🔍 AI Initialization Status:', status);
        
        if (!status.advancedAI) {
            return {
                text: "🚀 **AI System Starting Up**\n\nI'm currently initializing my advanced AI capabilities. This includes:\n\n• 🧠 Natural Language Processing\n• 📊 Intelligent Query Generation\n• 🔍 Advanced Anomaly Detection\n• 📈 Smart Data Analysis\n\nPlease wait a moment while I finish setting up...",
                data: { type: 'initializing', stage: 'starting' },
                actions: [
                    { label: 'Check Status', action: 'checkInitStatus' }
                ]
            };
        }
        
        if (!status.components) {
            return {
                text: "⚙️ **Loading AI Components**\n\nI'm currently loading my advanced components:\n\n• 🔄 RAG System\n• 🔄 Query Generator\n• 🔄 Advanced Agent\n• 🔄 Monitoring System\n\nThis should only take a few more seconds...",
                data: { type: 'initializing', stage: 'components' },
                actions: [
                    { label: 'Check Status', action: 'checkInitStatus' }
                ]
            };
        }
        
        if (!status.agent) {
            return {
                text: "🧠 **Initializing AI Agent**\n\nI'm setting up my intelligent agent capabilities:\n\n• 🔄 Knowledge Base Loading\n• 🔄 Query Pattern Recognition\n• 🔄 Context Management\n• 🔄 Response Generation\n\nAlmost ready...",
                data: { type: 'initializing', stage: 'agent' },
                actions: [
                    { label: 'Check Status', action: 'checkInitStatus' }
                ]
            };
        }
        
        if (!status.initialized) {
            return {
                text: "🔧 **Finalizing AI Setup**\n\nI'm completing the final initialization steps:\n\n• ✅ Components Loaded\n• 🔄 System Integration\n• 🔄 Capability Testing\n• 🔄 Ready Check\n\nJust a moment more...",
                data: { type: 'initializing', stage: 'finalizing' },
                actions: [
                    { label: 'Check Status', action: 'checkInitStatus' }
                ]
            };
        }
        
        // Should not reach here if properly initialized
        return {
            text: "❓ **Initialization Status Unknown**\n\nThere seems to be an issue with my initialization process. Please try refreshing the page or reconnecting to your AI service.",
            data: { type: 'init_error', status },
            actions: [
                { label: 'Refresh Page', action: 'refreshPage' },
                { label: 'Reconnect AI', action: 'reconnectAI' }
            ]
        };
    }
};

// Export for global access
window.AIAgent = AIAgent;