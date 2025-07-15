// Ollama Service Client
// Handles communication with Ollama endpoints for AI/ML analytics

const OllamaService = {
    // Configuration and connection management
    config: {
        endpoint: null, // User-provided endpoint
        model: 'llama3.1:8b-instruct-q4_K_M', // Default recommended model
        timeout: 30000, // 30 second timeout
        maxRetries: 3,
        retryDelay: 1000 // 1 second initial retry delay
    },

    // Connection status
    isConnected: false,
    lastError: null,

    // Initialize and validate Ollama connection
    async initialize(endpoint, model = null) {
        console.log('🤖 Initializing Ollama service...', { endpoint, model });
        
        this.config.endpoint = endpoint.replace(/\/$/, ''); // Remove trailing slash
        if (model) this.config.model = model;
        
        try {
            // Test basic connection
            const isConnected = await this.testConnection();
            if (!isConnected) {
                throw new Error('Cannot connect to Ollama endpoint. Please verify the URL and that Ollama is running.');
            }
            
            // Check if required model is available
            const modelExists = await this.checkModelAvailability();
            if (!modelExists) {
                throw new Error(`Model "${this.config.model}" not found. Please run: ollama pull ${this.config.model}`);
            }
            
            this.isConnected = true;
            this.lastError = null;
            console.log('✅ Ollama service initialized successfully');
            return true;
            
        } catch (error) {
            this.isConnected = false;
            this.lastError = error.message;
            console.error('❌ Ollama initialization failed:', error);
            throw error;
        }
    },

    // Test Ollama connection
    async testConnection() {
        try {
            console.log('🔍 Testing Ollama connection to:', this.config.endpoint);
            const response = await fetch(`${this.config.endpoint}/api/tags`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000) // 5 second timeout for connection test
            });
            
            const isOk = response.ok;
            console.log('🔗 Connection test result:', isOk ? 'SUCCESS' : 'FAILED');
            return isOk;
            
        } catch (error) {
            console.error('🔗 Connection test failed:', error.message);
            return false;
        }
    },

    // Check if required model is available
    async checkModelAvailability() {
        try {
            console.log('🔍 Checking model availability:', this.config.model);
            const response = await fetch(`${this.config.endpoint}/api/tags`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch models: ${response.status}`);
            }
            
            const data = await response.json();
            const models = data.models || [];
            const modelExists = models.some(model => model.name === this.config.model);
            
            console.log('📋 Available models:', models.map(m => m.name));
            console.log('✓ Model availability check:', modelExists ? 'FOUND' : 'NOT FOUND');
            
            return modelExists;
            
        } catch (error) {
            console.error('📋 Model availability check failed:', error);
            return false;
        }
    },

    // Get list of available models
    async getAvailableModels() {
        try {
            const response = await fetch(`${this.config.endpoint}/api/tags`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch models: ${response.status}`);
            }
            
            const data = await response.json();
            return data.models || [];
            
        } catch (error) {
            console.error('Failed to get available models:', error);
            return [];
        }
    },

    // Core inference method with retry logic
    async generateResponse(prompt, systemPrompt = null, options = {}) {
        if (!this.isConnected) {
            throw new Error('Ollama service not connected. Please initialize first.');
        }

        const requestBody = {
            model: this.config.model,
            prompt: prompt,
            system: systemPrompt,
            stream: false,
            options: {
                temperature: options.temperature || 0.1, // Low temperature for analytical tasks
                num_predict: options.max_tokens || 2048,
                top_p: options.top_p || 0.9,
                num_ctx: options.context_length || 4096,
                ...options
            }
        };

        console.log('🧠 Generating AI response...', {
            model: this.config.model,
            promptLength: prompt.length,
            hasSystem: !!systemPrompt,
            options: requestBody.options
        });

        let lastError;
        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            try {
                const response = await fetch(`${this.config.endpoint}/api/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                    signal: AbortSignal.timeout(this.config.timeout)
                });

                if (!response.ok) {
                    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                
                if (!data.response) {
                    throw new Error('Empty response from Ollama');
                }

                console.log('✅ AI response generated successfully', {
                    responseLength: data.response.length,
                    attempt: attempt
                });

                return {
                    response: data.response,
                    model: data.model,
                    created_at: data.created_at,
                    done: data.done,
                    total_duration: data.total_duration,
                    load_duration: data.load_duration,
                    prompt_eval_count: data.prompt_eval_count,
                    eval_count: data.eval_count
                };

            } catch (error) {
                lastError = error;
                console.warn(`🔄 Generation attempt ${attempt} failed:`, error.message);
                
                if (attempt < this.config.maxRetries) {
                    const delay = this.config.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
                    console.log(`⏳ Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    console.error('❌ All generation attempts failed');
                }
            }
        }

        // If we get here, all retries failed
        this.lastError = lastError.message;
        throw new Error(`AI generation failed after ${this.config.maxRetries} attempts: ${lastError.message}`);
    },

    // Validate and parse JSON response from AI
    parseJsonResponse(response) {
        try {
            // Try to extract JSON from response (handles cases where model adds extra text)
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            
            // If no JSON found, try parsing the entire response
            return JSON.parse(response);
            
        } catch (error) {
            console.error('Failed to parse JSON response:', error);
            console.log('Raw response:', response);
            throw new Error('AI returned invalid JSON response');
        }
    },

    // Get service status for UI display
    getStatus() {
        return {
            connected: this.isConnected,
            endpoint: this.config.endpoint,
            model: this.config.model,
            lastError: this.lastError
        };
    },

    // Disconnect and cleanup
    disconnect() {
        this.isConnected = false;
        this.lastError = null;
        console.log('🔌 Ollama service disconnected');
    }
};

// Export for use in other modules
window.OllamaService = OllamaService;