// Model Management System
// Handles different AI models and their capabilities for analytics

const ModelManager = {
    // Supported models and their specifications
    supportedModels: {
        'llama3.1:8b-instruct-q4_K_M': {
            name: 'Llama 3.1 8B',
            displayName: 'Llama 3.1 8B (Recommended)',
            capabilities: ['anomaly', 'prediction', 'trend', 'analysis'],
            ramRequired: '8GB',
            speed: 'fast',
            quality: 'good',
            contextLength: 128000,
            description: 'Best balance of performance and resource usage'
        },
        'llama3.1:70b-instruct-q4_K_M': {
            name: 'Llama 3.1 70B',
            displayName: 'Llama 3.1 70B (High Performance)',
            capabilities: ['anomaly', 'prediction', 'trend', 'analysis', 'complex_analysis'],
            ramRequired: '48GB',
            speed: 'slow',
            quality: 'excellent',
            contextLength: 128000,
            description: 'Highest quality analysis, requires significant resources'
        },
        'deepseek-math:7b-instruct-q4_K_M': {
            name: 'DeepSeek Math 7B',
            displayName: 'DeepSeek Math 7B (Specialized)',
            capabilities: ['prediction', 'trend', 'statistical_analysis'],
            ramRequired: '6GB',
            speed: 'fast',
            quality: 'specialized',
            contextLength: 32000,
            description: 'Optimized for mathematical and statistical analysis'
        },
        'llama3.2:3b-instruct-q4_K_M': {
            name: 'Llama 3.2 3B',
            displayName: 'Llama 3.2 3B (Fast)',
            capabilities: ['anomaly', 'basic_prediction'],
            ramRequired: '3GB',
            speed: 'very_fast',
            quality: 'basic',
            contextLength: 32000,
            description: 'Fastest inference, basic analytics capabilities'
        }
    },

    // Analysis type requirements
    analysisRequirements: {
        'anomaly': {
            minQuality: 'basic',
            preferredSpeed: 'fast',
            requiredCapabilities: ['anomaly']
        },
        'prediction': {
            minQuality: 'good',
            preferredSpeed: 'balanced',
            requiredCapabilities: ['prediction']
        },
        'trend': {
            minQuality: 'good',
            preferredSpeed: 'balanced',
            requiredCapabilities: ['trend']
        },
        'complex_analysis': {
            minQuality: 'excellent',
            preferredSpeed: 'quality',
            requiredCapabilities: ['analysis', 'complex_analysis']
        }
    },

    // Auto-detect best available model for analysis type
    async detectBestModel(ollamaEndpoint, analysisType = 'anomaly') {
        console.log('🔍 Detecting best model for analysis type:', analysisType);
        
        try {
            const availableModels = await this.getAvailableModels(ollamaEndpoint);
            console.log('📋 Available models:', availableModels.map(m => m.name));
            
            const compatibleModels = this.getCompatibleModels(availableModels, analysisType);
            
            if (compatibleModels.length === 0) {
                const requirements = this.analysisRequirements[analysisType];
                throw new Error(
                    `No suitable models found for ${analysisType} analysis. ` +
                    `Please install a model with capabilities: ${requirements.requiredCapabilities.join(', ')}`
                );
            }
            
            const bestModel = this.selectOptimalModel(compatibleModels, analysisType);
            console.log('✅ Best model selected:', bestModel.name);
            
            return bestModel;
            
        } catch (error) {
            console.error('❌ Model detection failed:', error);
            throw error;
        }
    },

    // Get available models from Ollama
    async getAvailableModels(endpoint) {
        try {
            const response = await fetch(`${endpoint}/api/tags`);
            if (!response.ok) {
                throw new Error(`Failed to fetch models: ${response.status}`);
            }
            
            const data = await response.json();
            const availableModels = data.models || [];
            
            // Filter to only supported models and add metadata
            return availableModels
                .filter(model => this.supportedModels[model.name])
                .map(model => ({
                    ...model,
                    ...this.supportedModels[model.name]
                }));
                
        } catch (error) {
            console.error('Failed to get available models:', error);
            return [];
        }
    },

    // Filter models by analysis type compatibility
    getCompatibleModels(availableModels, analysisType) {
        const requirements = this.analysisRequirements[analysisType];
        if (!requirements) {
            console.warn('Unknown analysis type:', analysisType);
            return availableModels;
        }
        
        return availableModels.filter(model => {
            // Check if model has required capabilities
            const hasCapabilities = requirements.requiredCapabilities.every(cap => 
                model.capabilities.includes(cap)
            );
            
            // Check quality level
            const qualityLevels = ['basic', 'good', 'excellent', 'specialized'];
            const modelQualityIndex = qualityLevels.indexOf(model.quality);
            const minQualityIndex = qualityLevels.indexOf(requirements.minQuality);
            const meetsQuality = modelQualityIndex >= minQualityIndex || model.quality === 'specialized';
            
            return hasCapabilities && meetsQuality;
        });
    },

    // Select optimal model based on analysis type and user preferences
    selectOptimalModel(compatibleModels, analysisType) {
        if (compatibleModels.length === 1) {
            return compatibleModels[0];
        }
        
        const requirements = this.analysisRequirements[analysisType];
        const speedPreference = requirements.preferredSpeed;
        
        // Score models based on analysis type requirements
        const scoredModels = compatibleModels.map(model => {
            let score = 0;
            
            // Quality scoring
            const qualityScores = { basic: 1, good: 2, excellent: 3, specialized: 2.5 };
            score += qualityScores[model.quality] || 0;
            
            // Speed scoring based on preference
            const speedScores = { very_fast: 3, fast: 2, slow: 1 };
            if (speedPreference === 'fast') {
                score += speedScores[model.speed] || 0;
            } else if (speedPreference === 'quality') {
                score += (4 - (speedScores[model.speed] || 1)); // Inverse speed scoring
            } else { // balanced
                score += speedScores[model.speed] === 2 ? 2 : 1;
            }
            
            // Capability bonus (more capabilities = higher score)
            score += model.capabilities.length * 0.1;
            
            return { ...model, score };
        });
        
        // Sort by score and return best
        scoredModels.sort((a, b) => b.score - a.score);
        
        console.log('🏆 Model scoring results:', scoredModels.map(m => ({
            name: m.name,
            score: m.score,
            quality: m.quality,
            speed: m.speed
        })));
        
        return scoredModels[0];
    },

    // Get model recommendations for UI
    getModelRecommendations() {
        return Object.entries(this.supportedModels).map(([modelName, spec]) => ({
            value: modelName,
            label: spec.displayName,
            description: spec.description,
            requirements: `${spec.ramRequired} RAM`,
            capabilities: spec.capabilities,
            performance: `${spec.speed} speed, ${spec.quality} quality`
        }));
    },

    // Validate model for specific analysis
    validateModelForAnalysis(modelName, analysisType) {
        const model = this.supportedModels[modelName];
        if (!model) {
            return {
                valid: false,
                reason: `Unsupported model: ${modelName}`
            };
        }
        
        const requirements = this.analysisRequirements[analysisType];
        if (!requirements) {
            return {
                valid: false,
                reason: `Unknown analysis type: ${analysisType}`
            };
        }
        
        // Check capabilities
        const missingCapabilities = requirements.requiredCapabilities.filter(cap => 
            !model.capabilities.includes(cap)
        );
        
        if (missingCapabilities.length > 0) {
            return {
                valid: false,
                reason: `Model lacks required capabilities: ${missingCapabilities.join(', ')}`
            };
        }
        
        // Check quality level
        const qualityLevels = ['basic', 'good', 'excellent', 'specialized'];
        const modelQualityIndex = qualityLevels.indexOf(model.quality);
        const minQualityIndex = qualityLevels.indexOf(requirements.minQuality);
        
        if (modelQualityIndex < minQualityIndex && model.quality !== 'specialized') {
            return {
                valid: false,
                reason: `Model quality (${model.quality}) below required level (${requirements.minQuality})`
            };
        }
        
        return {
            valid: true,
            reason: 'Model is compatible'
        };
    },

    // Get setup instructions for model
    getSetupInstructions(modelName) {
        const model = this.supportedModels[modelName];
        if (!model) {
            return ['Model not recognized'];
        }
        
        return [
            `Install Ollama from https://ollama.ai`,
            `Run: ollama pull ${modelName}`,
            `Ensure you have at least ${model.ramRequired} of available RAM`,
            `Start Ollama service: ollama serve`,
            `Verify installation: curl http://localhost:11434/api/tags`
        ];
    }
};

// Export for use in other modules
window.ModelManager = ModelManager;