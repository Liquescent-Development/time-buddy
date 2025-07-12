const Editor = {
    // Initialize CodeMirror editor
    initializeCodeMirror() {
        console.log('Initializing CodeMirror...');
        const textarea = document.getElementById('query');
        
        GrafanaConfig.queryEditor = CodeMirror.fromTextArea(textarea, {
            mode: GrafanaConfig.currentQueryType === 'promql' ? 'promql' : 'influxql',
            theme: 'monokai',
            lineNumbers: true,
            matchBrackets: true,
            autoCloseBrackets: true,
            indentUnit: 2,
            smartIndent: true,
            lineWrapping: false,
            extraKeys: {
                "Ctrl-Space": "autocomplete",
                "Tab": function(cm) {
                    if (cm.getMode().name === 'null') {
                        cm.execCommand('insertTab');
                    } else {
                        if (cm.somethingSelected()) {
                            cm.execCommand('indentMore');
                        } else {
                            cm.execCommand('insertSoftTab');
                        }
                    }
                }
            },
            hintOptions: {
                completeSingle: false,
                alignWithWord: true,
                closeOnUnfocus: false
            }
        });
        
        this.setupCodeMirrorHelpers();
        this.setupCodeMirrorEvents();
        this.setupResizeHandle();
        
        console.log('CodeMirror initialized successfully');
    },

    // Setup autocomplete helpers
    setupCodeMirrorHelpers() {
        // PromQL mode definition
        CodeMirror.defineMode("promql", function() {
            const keywords = new Set(QueryKeywords.promql.map(function(k) { return k.toLowerCase(); }));
            
            return {
                token: function(stream, state) {
                    if (stream.eatSpace()) return null;
                    
                    // Comments
                    if (stream.match(/#.*/)) {
                        return "comment";
                    }
                    
                    // Strings
                    if (stream.match(/"([^"\\]|\\.)*"/)) {
                        return "string";
                    }
                    if (stream.match(/'([^'\\]|\\.)*'/)) {
                        return "string";
                    }
                    
                    // Numbers
                    if (stream.match(/\d+(\.\d+)?([eE][+-]?\d+)?/)) {
                        return "number";
                    }
                    
                    // Time ranges
                    if (stream.match(/\d+[smhdwy]/)) {
                        return "number";
                    }
                    
                    // Operators
                    if (stream.match(/[+\-*/%^=!<>]+/)) {
                        return "operator";
                    }
                    
                    // Brackets
                    if (stream.match(/[()[\]{}]/)) {
                        return "bracket";
                    }
                    
                    // Keywords and functions
                    const word = stream.match(/\w+/);
                    if (word && keywords.has(word[0].toLowerCase())) {
                        return "keyword";
                    }
                    
                    stream.next();
                    return null;
                }
            };
        });

        // PromQL autocomplete
        CodeMirror.registerHelper("hint", "promql", function(cm) {
            const cur = cm.getCursor();
            const line = cm.getLine(cur.line);
            const start = cur.ch;
            const end = start;
            
            // Find word boundary
            let wordStart = start;
            while (wordStart > 0 && /\w/.test(line.charAt(wordStart - 1))) {
                wordStart--;
            }
            
            const word = line.slice(wordStart, start).toLowerCase();
            const suggestions = QueryKeywords.promql.filter(function(keyword) {
                return keyword.toLowerCase().startsWith(word);
            }).map(function(keyword) {
                return {
                    text: keyword,
                    displayText: keyword,
                    className: 'promql-hint'
                };
            });
            
            return {
                list: suggestions,
                from: CodeMirror.Pos(cur.line, wordStart),
                to: CodeMirror.Pos(cur.line, end)
            };
        });

        // InfluxQL mode definition with comprehensive syntax highlighting
        CodeMirror.defineMode("influxql", function() {
            const keywords = new Set(['ALL', 'ALTER', 'ANALYZE', 'ANY', 'AS', 'ASC', 'BEGIN', 'BY', 'CREATE', 'CONTINUOUS', 
                'DATABASE', 'DATABASES', 'DEFAULT', 'DELETE', 'DESC', 'DESTINATIONS', 'DIAGNOSTICS', 'DISTINCT', 'DROP', 
                'DURATION', 'END', 'EVERY', 'EXPLAIN', 'FIELD', 'FOR', 'FROM', 'GRANT', 'GRANTS', 'GROUP', 'GROUPS', 
                'IN', 'INF', 'INSERT', 'INTO', 'KEY', 'KEYS', 'KILL', 'LIMIT', 'SHOW', 'MEASUREMENT', 'MEASUREMENTS', 
                'NAME', 'OFFSET', 'ON', 'ORDER', 'PASSWORD', 'POLICY', 'POLICIES', 'PRIVILEGES', 'QUERIES', 'QUERY', 
                'READ', 'REPLICATION', 'RESAMPLE', 'RETENTION', 'REVOKE', 'SELECT', 'SERIES', 'SET', 'SHARD', 'SHARDS', 
                'SLIMIT', 'SOFFSET', 'STATS', 'SUBSCRIPTION', 'SUBSCRIPTIONS', 'TAG', 'TO', 'USER', 'USERS', 'VALUES', 
                'WHERE', 'WITH', 'WRITE'].map(k => k.toLowerCase()));
            
            const functions = new Set(['MEAN', 'MEDIAN', 'MODE', 'SPREAD', 'STDDEV', 'SUM', 'COUNT', 'DISTINCT', 'INTEGRAL', 
                'DERIVATIVE', 'DIFFERENCE', 'NON_NEGATIVE_DERIVATIVE', 'ELAPSED', 'MOVING_AVERAGE', 'CUMULATIVE_SUM', 
                'HOLT_WINTERS', 'PERCENTILE', 'SAMPLE', 'TOP', 'BOTTOM', 'FIRST', 'LAST', 'MAX', 'MIN'].map(k => k.toLowerCase()));
            
            const operators = new Set(['AND', 'OR', 'NOT', 'IS', 'LIKE', 'REGEX'].map(k => k.toLowerCase()));
            const literals = new Set(['TRUE', 'FALSE', 'NULL', 'NOW', 'TIME'].map(k => k.toLowerCase()));
            
            return {
                token: function(stream, state) {
                    if (stream.eatSpace()) return null;
                    
                    // Single line comments
                    if (stream.match(/--.*$/)) {
                        return "comment";
                    }
                    
                    // Multi-line comments
                    if (stream.match(/\/\*/)) {
                        state.inComment = true;
                        return "comment";
                    }
                    if (state.inComment) {
                        if (stream.match(/\*\//)) {
                            state.inComment = false;
                        } else {
                            stream.next();
                        }
                        return "comment";
                    }
                    
                    // Strings (single quotes)
                    if (stream.match(/^'([^'\\]|\\.)*'/)) {
                        return "string";
                    }
                    
                    // Quoted identifiers (double quotes)
                    if (stream.match(/^"([^"\\]|\\.)*"/)) {
                        return "string-2";
                    }
                    
                    // Regular expressions
                    if (stream.match(/^\/([^\/\\]|\\.)*\//)) {
                        return "string.special";
                    }
                    
                    // Numbers (integers and floats)
                    if (stream.match(/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/)) {
                        return "number";
                    }
                    
                    // Duration literals
                    if (stream.match(/^\d+[uµmshd w]/)) {
                        return "number";
                    }
                    
                    // Time literals
                    if (stream.match(/^\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2}:\d{2}(\.\d+)?)?/)) {
                        return "number";
                    }
                    
                    // Operators
                    if (stream.match(/^(=~|!~|<>|<=|>=|!=|[=<>+\-*\/%&|^])/)) {
                        return "operator";
                    }
                    
                    // Identifiers and keywords
                    if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_]*/)) {
                        const word = stream.current().toLowerCase();
                        if (keywords.has(word)) return "keyword";
                        if (functions.has(word)) return "builtin";
                        if (operators.has(word)) return "operator";
                        if (literals.has(word)) return "atom";
                        return "variable";
                    }
                    
                    // Punctuation
                    if (stream.match(/^[(),.;]/)) {
                        return "punctuation";
                    }
                    
                    stream.next();
                    return null;
                },
                
                startState: function() {
                    return {inComment: false};
                }
            };
        });

        // Enhanced InfluxQL autocomplete with dynamic schema loading and proper formatting
        CodeMirror.registerHelper("hint", "influxql", function(cm) {
            const cur = cm.getCursor();
            const line = cm.getLine(cur.line);
            const fullQuery = cm.getValue().toUpperCase();
            const start = cur.ch;
            const end = start;
            
            let wordStart = start;
            while (wordStart > 0 && /[\w".]/.test(line.charAt(wordStart - 1))) {
                wordStart--;
            }
            
            // For FROM clause autocomplete, we need to include the entire line up to the cursor
            // not just up to the word boundary, to capture "retention_policy"."measurement" patterns
            let lineBeforeForFrom = line.slice(0, start);
            
            // Extract just the current word being typed (for matching)
            let currentTypingWordStart = start;
            while (currentTypingWordStart > 0 && /[\w]/.test(line.charAt(currentTypingWordStart - 1))) {
                currentTypingWordStart--;
            }
            const currentTypingWord = line.slice(currentTypingWordStart, start).toLowerCase();
            
            const word = line.slice(wordStart, start).toLowerCase();
            const lineBefore = line.slice(0, wordStart).toUpperCase();
            const lineBeforeWithQuotes = line.slice(0, wordStart);
            
            console.log(`Autocomplete context - line: "${line}"`);
            console.log(`Autocomplete context - wordStart: ${wordStart}, start: ${start}`);
            console.log(`Autocomplete context - lineBefore: "${lineBefore}"`);
            console.log(`Autocomplete context - lineBeforeWithQuotes: "${lineBeforeWithQuotes}"`);
            console.log(`Autocomplete context - word: "${word}"`);
            
            let suggestions = [];
            let loadingItems = [];
            
            // Helper function to get schema data safely
            const getSchemaData = () => {
                if (typeof Schema !== 'undefined' && Schema.currentDatasourceType === 'influxdb') {
                    const schemaData = {
                        retentionPolicies: Schema.influxRetentionPolicies || [],
                        measurements: Schema.influxMeasurements || [],
                        fields: Schema.influxFields || {},
                        tags: Schema.influxTags || {}
                    };
                    return schemaData;
                }
                return { retentionPolicies: [], measurements: [], fields: {}, tags: {} };
            };
            
            // Global state for debouncing schema loads (initialize once)
            if (!window.SchemaLoadDebounce) {
                window.SchemaLoadDebounce = {
                    loadingQueue: new Set(),
                    debounceTimers: new Map(),
                    lastAutocompleteCall: 0,
                    lastSchemaRefresh: 0
                };
            }
            
            // Helper function to trigger schema refresh when we suspect missing data
            const refreshSchemaIfStale = () => {
                const now = Date.now();
                // Only refresh every 30 seconds to avoid excessive API calls
                if (now - window.SchemaLoadDebounce.lastSchemaRefresh > 30000) {
                    window.SchemaLoadDebounce.lastSchemaRefresh = now;
                    console.log('Triggering schema refresh due to missing autocomplete data');
                    
                    // Trigger a fresh schema load if Schema is available
                    if (typeof Schema !== 'undefined' && Schema.currentDatasourceType === 'influxdb') {
                        setTimeout(() => {
                            Schema.loadSchemaIfNeeded(true); // Force refresh
                        }, 1000);
                    }
                }
            };
            
            // Helper function to trigger dynamic measurement loading with debouncing and proper caching
            const loadMeasurementSchemaIfNeeded = (measurement) => {
                if (typeof Schema !== 'undefined' && Schema.currentDatasourceType === 'influxdb') {
                    const fieldsKey = measurement;
                    const tagsKey = measurement;
                    
                    // Check if we already have data for this measurement
                    const hasFields = Schema.influxFields[fieldsKey] && Schema.influxFields[fieldsKey].length > 0;
                    const hasTags = Schema.influxTags[tagsKey] && Schema.influxTags[tagsKey].length > 0;
                    
                    // Check if already loading or queued for loading
                    const isCurrentlyLoading = Schema.isLoadingMeasurement && Schema.selectedMeasurement === measurement;
                    const isQueued = window.SchemaLoadDebounce.loadingQueue.has(measurement);
                    
                    // Only proceed if we don't have data AND it's not already loading/queued
                    if ((!hasFields || !hasTags) && !isCurrentlyLoading && !isQueued) {
                        // Add to queue immediately to prevent duplicate requests
                        window.SchemaLoadDebounce.loadingQueue.add(measurement);
                        
                        // Clear any existing debounce timer for this measurement
                        if (window.SchemaLoadDebounce.debounceTimers.has(measurement)) {
                            clearTimeout(window.SchemaLoadDebounce.debounceTimers.get(measurement));
                        }
                        
                        // Set debounced timer with longer delay to prevent excessive calls
                        const timer = setTimeout(() => {
                            // Remove from debounce map but keep in queue until loading starts
                            window.SchemaLoadDebounce.debounceTimers.delete(measurement);
                            
                            // Double-check conditions before loading
                            const stillNeedsFields = !Schema.influxFields[fieldsKey] || Schema.influxFields[fieldsKey].length === 0;
                            const stillNeedsTags = !Schema.influxTags[tagsKey] || Schema.influxTags[tagsKey].length === 0;
                            const notCurrentlyLoading = !Schema.isLoadingMeasurement || Schema.selectedMeasurement !== measurement;
                            
                            if ((stillNeedsFields || stillNeedsTags) && notCurrentlyLoading) {
                                console.log('Loading schema for measurement:', measurement);
                                Schema.loadMeasurementSchema(measurement, Schema.influxRetentionPolicies[0] || 'autogen').finally(() => {
                                    // Remove from queue when loading completes
                                    window.SchemaLoadDebounce.loadingQueue.delete(measurement);
                                });
                            } else {
                                // Remove from queue if no loading needed
                                window.SchemaLoadDebounce.loadingQueue.delete(measurement);
                            }
                        }, 500); // Increased debounce delay to 500ms
                        
                        window.SchemaLoadDebounce.debounceTimers.set(measurement, timer);
                    }
                }
            };
            
            const schemaData = getSchemaData();
            
            // Context-aware suggestions
            if (lineBefore.includes('SELECT') && !lineBefore.includes('FROM')) {
                // In SELECT clause - suggest functions and field names with proper formatting
                suggestions = [
                    ...InfluxQLHelpers.aggregateFunctions,
                    ...InfluxQLHelpers.selectorFunctions,
                    ...InfluxQLHelpers.transformationFunctions,
                    'DISTINCT', '*'
                ].filter(s => s.toLowerCase().startsWith(word));
                
                // For SELECT clause, we need to look at the entire query to find the FROM clause
                const cleanWord = word.replace(/"/g, '');
                console.log(`SELECT autocomplete - cleanWord: "${cleanWord}"`);
                console.log(`SELECT autocomplete - available fields:`, schemaData.fields);
                console.log(`SELECT autocomplete - fullQuery: "${fullQuery}"`);
                
                // Extract measurement from FROM clause if it exists
                const fromMatch = fullQuery.match(/FROM\s+(?:"?([^"\s.]+)"?\.)?(?:"?([^"\s]+)"?)/);
                if (fromMatch) {
                    // Found a FROM clause with measurement - suggest fields from this specific measurement
                    const measurement = fromMatch[2] || fromMatch[1]; // measurement is the second capture group, or first if no retention policy
                    console.log(`SELECT autocomplete - found measurement in FROM: "${measurement}"`);
                    
                    // Add field names from this specific measurement
                    const fields = schemaData.fields[measurement] || [];
                    console.log(`SELECT autocomplete - fields for ${measurement}:`, fields);
                    fields.forEach(field => {
                        if (field.toLowerCase().startsWith(cleanWord)) {
                            const formattedField = `"${field}"`;
                            if (!suggestions.includes(formattedField)) {
                                suggestions.push(formattedField);
                            }
                        }
                    });
                    
                    // If we don't have field data for this measurement, trigger loading
                    if (fields.length === 0) {
                        loadingItems.push(`⏳ Fields for "${measurement}" loading...`);
                        loadMeasurementSchemaIfNeeded(measurement);
                    }
                } else {
                    // No FROM clause yet - show all available fields from all loaded measurements
                    console.log(`SELECT autocomplete - no FROM clause, showing all fields`);
                    Object.keys(schemaData.fields).forEach(measurementKey => {
                        const fields = schemaData.fields[measurementKey] || [];
                        fields.forEach(field => {
                            if (field.toLowerCase().startsWith(cleanWord)) {
                                const formattedField = `"${field}"`;
                                if (!suggestions.includes(formattedField)) {
                                    suggestions.push(formattedField);
                                }
                            }
                        });
                    });
                    
                    // If user typed something and no fields match, try loading more measurements
                    if (cleanWord.length >= 2 && suggestions.length === 0) {
                        // Find measurements that might have fields starting with the typed text
                        const potentialMeasurements = schemaData.measurements.filter(m => 
                            !schemaData.fields[m] || schemaData.fields[m].length === 0
                        ).slice(0, 5); // Load up to 5 more measurements
                        
                        if (potentialMeasurements.length > 0) {
                            console.log(`SELECT autocomplete - no matches found, loading more measurements:`, potentialMeasurements);
                            potentialMeasurements.forEach(measurement => {
                                loadingItems.push(`⏳ Loading fields from "${measurement}"...`);
                                loadMeasurementSchemaIfNeeded(measurement);
                            });
                        }
                    }
                    
                    // Show a hint about available measurements if no fields are loaded
                    if (Object.keys(schemaData.fields).length === 0 && schemaData.measurements.length > 0) {
                        // Don't auto-load, just show a helpful message
                        suggestions.push('/* Type FROM to see measurements and load field data */');
                    }
                }
                
            } else if (lineBefore.includes('FROM') && !lineBefore.includes('WHERE')) {
                // Enhanced FROM clause suggestions with schema awareness
                
                // Check if we're after FROM and looking for retention policy/measurement
                console.log(`FROM autocomplete - lineBeforeForFrom: "${lineBeforeForFrom}"`);
                console.log(`FROM autocomplete - currentTypingWord: "${currentTypingWord}"`);
                const fromMatch = lineBeforeForFrom.match(/FROM\s+(.*)$/i);
                console.log(`FROM autocomplete - fromMatch:`, fromMatch);
                if (fromMatch) {
                    const afterFrom = fromMatch[1].trim();
                    console.log(`FROM autocomplete - afterFrom: "${afterFrom}"`);
                    console.log(`FROM autocomplete - current word: "${word}"`);
                    console.log(`FROM autocomplete - available measurements:`, schemaData.measurements);
                    
                    // Pattern: FROM "retention_policy"."measurement_prefix or FROM "retention_policy".
                    const retentionMeasurementMatch = afterFrom.match(/^"([^"]+)"\.(.*)$/);
                    if (retentionMeasurementMatch) {
                        // User typed FROM "retention_policy".XXX - suggest measurements that start with XXX
                        const retentionPolicy = retentionMeasurementMatch[1];
                        const measurementPrefix = retentionMeasurementMatch[2].replace(/"/g, '');
                        
                        // Use currentTypingWord if measurementPrefix is empty (user is still typing)
                        const searchPrefix = measurementPrefix || currentTypingWord;
                        
                        console.log(`Looking for measurements starting with: "${searchPrefix}"`);
                        console.log(`Retention policy: "${retentionPolicy}"`);
                        console.log(`measurementPrefix from regex: "${measurementPrefix}"`);
                        console.log(`currentTypingWord: "${currentTypingWord}"`);
                        
                        // Format suggestions appropriately - if we're after a dot, don't include quotes
                        const formatMeasurement = (measurement) => {
                            if (measurementPrefix !== '' || afterFrom.includes('.')) {
                                // We're after a dot, so just return the measurement name with quotes
                                return `"${measurement}"`;
                            } else {
                                // We're suggesting the full thing
                                return `"${measurement}"`;
                            }
                        };
                        
                        suggestions = schemaData.measurements
                            .filter(m => m.toLowerCase().startsWith(searchPrefix.toLowerCase()))
                            .map(formatMeasurement);
                        
                        console.log(`Found ${suggestions.length} matching measurements:`, suggestions);
                        
                        // If no matches found and user typed something, this might indicate we need to load more data
                        if (suggestions.length === 0 && measurementPrefix.length >= 2) {
                            console.log(`FROM autocomplete - no measurements match "${measurementPrefix}", may need to refresh schema`);
                            loadingItems.push(`⏳ Searching for measurements starting with "${measurementPrefix}"...`);
                            refreshSchemaIfStale();
                        }
                        
                        // If we have no measurements loaded, show loading indicator
                        if (schemaData.measurements.length === 0) {
                            loadingItems.push(`⏳ Loading measurements for "${retentionPolicy}"...`);
                        }
                    } else if (afterFrom === '' || afterFrom === '"' || !afterFrom.includes('.')) {
                        // User just typed FROM or FROM " - suggest retention policies
                        suggestions = schemaData.retentionPolicies
                            .filter(rp => rp.toLowerCase().startsWith(word.replace(/"/g, '')))
                            .map(rp => `"${rp}".`);
                        
                        // Also suggest measurements directly (without retention policy)
                        const directMeasurements = schemaData.measurements
                            .filter(m => m.toLowerCase().startsWith(word.replace(/"/g, '')))
                            .map(m => `"${m}"`);
                        suggestions = [...suggestions, ...directMeasurements];
                        
                    } else {
                        // Default FROM clause completions
                        suggestions = ['WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT', 'OFFSET', 'SLIMIT', 'SOFFSET']
                            .filter(s => s.toLowerCase().startsWith(word));
                    }
                } else {
                    // Not directly after FROM - suggest next clause keywords
                    suggestions = ['WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT', 'OFFSET', 'SLIMIT', 'SOFFSET']
                        .filter(s => s.toLowerCase().startsWith(word));
                }
                
            } else if (lineBefore.includes('WHERE')) {
                // In WHERE clause - suggest operators, functions, and field/tag names with proper formatting
                const cleanWord = word.replace(/"/g, '');
                suggestions = [
                    ...InfluxQLHelpers.operators,
                    ...InfluxQLHelpers.dateFunctions,
                    'time', 'AND', 'OR', 'NOT'
                ].filter(s => s.toLowerCase().startsWith(cleanWord));
                
                // Add field names from schema (formatted with quotes)
                Object.keys(schemaData.fields).forEach(measurementKey => {
                    const fields = schemaData.fields[measurementKey] || [];
                    fields.forEach(field => {
                        if (field.toLowerCase().startsWith(cleanWord)) {
                            const formattedField = `"${field}"`;
                            if (!suggestions.includes(formattedField)) {
                                suggestions.push(formattedField);
                            }
                        }
                    });
                });
                
                // Add tag names from schema (formatted with ::tag suffix)
                Object.keys(schemaData.tags).forEach(measurementKey => {
                    const tags = schemaData.tags[measurementKey] || [];
                    tags.forEach(tag => {
                        if (tag.toLowerCase().startsWith(cleanWord)) {
                            const formattedTag = `"${tag}"::tag`;
                            if (!suggestions.includes(formattedTag)) {
                                suggestions.push(formattedTag);
                            }
                        }
                    });
                });
                
                // Only show loading for measurements that match what user is typing (limit to 1 match)
                if (cleanWord.length >= 2) { // Only if user typed at least 2 characters
                    const matchingMeasurement = schemaData.measurements.find(m => 
                        m.toLowerCase().startsWith(cleanWord) && 
                        (!schemaData.fields[m] || schemaData.fields[m].length === 0)
                    );
                    if (matchingMeasurement) {
                        loadingItems.push(`⏳ "${matchingMeasurement}" schema loading...`);
                        loadMeasurementSchemaIfNeeded(matchingMeasurement);
                    }
                }
                
            } else if (lineBefore.includes('GROUP BY')) {
                // In GROUP BY clause - suggest time, tag options, and actual tag names with proper formatting
                const cleanWord = word.replace(/"/g, '');
                suggestions = ['time', 'TIME', 'FILL', '*']
                    .concat(InfluxQLHelpers.fillOptions)
                    .filter(s => s.toLowerCase().startsWith(cleanWord));
                
                // Add tag names from schema (formatted with ::tag suffix)
                Object.keys(schemaData.tags).forEach(measurementKey => {
                    const tags = schemaData.tags[measurementKey] || [];
                    tags.forEach(tag => {
                        if (tag.toLowerCase().startsWith(cleanWord)) {
                            const formattedTag = `"${tag}"::tag`;
                            if (!suggestions.includes(formattedTag)) {
                                suggestions.push(formattedTag);
                            }
                        }
                    });
                });
                
                // Only load tags for the most relevant measurement
                if (cleanWord.length >= 2) {
                    const matchingMeasurement = schemaData.measurements.find(m => 
                        m.toLowerCase().startsWith(cleanWord) && 
                        (!schemaData.tags[m] || schemaData.tags[m].length === 0)
                    );
                    if (matchingMeasurement) {
                        loadingItems.push(`⏳ "${matchingMeasurement}" tags loading...`);
                        loadMeasurementSchemaIfNeeded(matchingMeasurement);
                    }
                }
                
            } else if (lineBefore.includes('FILL(')) {
                // In FILL clause - suggest fill options
                suggestions = ['null', 'none', 'previous', 'linear', '0']
                    .filter(s => s.toLowerCase().startsWith(word));
            } else if (word === 'show' || lineBefore.endsWith('SHOW')) {
                // SHOW statements
                suggestions = InfluxQLHelpers.showStatements
                    .filter(s => s.toLowerCase().includes(word));
            } else if (word === 'create' || lineBefore.endsWith('CREATE')) {
                // CREATE statements
                suggestions = InfluxQLHelpers.createStatements
                    .filter(s => s.toLowerCase().includes(word));
            } else {
                // Default suggestions - all keywords
                suggestions = QueryKeywords.influxql.filter(function(keyword) { 
                    return keyword.toLowerCase().startsWith(word);
                });
            }
            
            // Convert to hint objects with proper categorization
            const hintList = suggestions.map(function(suggestion) {
                let className = 'influxql-hint';
                let displayText = suggestion;
                
                // Add contextual styling and descriptions
                const cleanSuggestion = suggestion.replace(/[".]/g, '').replace(/::tag$/, '');
                
                if (schemaData.retentionPolicies.includes(cleanSuggestion)) {
                    className += ' retention-policy-hint';
                    displayText = suggestion + ' (retention policy)';
                } else if (schemaData.measurements.includes(cleanSuggestion)) {
                    className += ' measurement-hint'; 
                    displayText = suggestion + ' (measurement)';
                } else if (suggestion.includes('::tag')) {
                    className += ' tag-hint';
                    displayText = suggestion + ' (tag)';
                } else if (suggestion.startsWith('"') && suggestion.endsWith('"') && !suggestion.includes('::tag')) {
                    // Check if it's a field
                    let isField = false;
                    Object.keys(schemaData.fields).forEach(measurementKey => {
                        const fields = schemaData.fields[measurementKey] || [];
                        if (fields.includes(cleanSuggestion)) {
                            isField = true;
                        }
                    });
                    
                    if (isField) {
                        className += ' field-hint';
                        displayText = suggestion + ' (field)';
                    }
                }
                
                return {
                    text: suggestion,
                    displayText: displayText,
                    className: className
                };
            });
            
            // Add loading indicators
            loadingItems.forEach(function(loadingItem) {
                hintList.push({
                    text: '',
                    displayText: loadingItem,
                    className: 'influxql-hint loading-hint',
                    hint: function() { return ''; } // Prevent insertion
                });
            });
            
            // Add common time expressions if in WHERE clause
            if (lineBefore.includes('WHERE') && lineBefore.includes('TIME')) {
                const timeExpressions = [
                    "now() - 1h", "now() - 24h", "now() - 7d", "now() - 30d",
                    "'2023-01-01'", "'2023-01-01 00:00:00'"
                ].filter(expr => expr.startsWith(word));
                
                timeExpressions.forEach(expr => {
                    hintList.push({
                        text: expr,
                        displayText: expr,
                        className: 'influxql-hint time-hint'
                    });
                });
            }
            
            // Determine the correct replacement range based on context
            let replaceFrom = wordStart;
            let replaceTo = end;
            
            // For FROM clause with retention policy patterns like "raw".prom
            // we only want to replace the measurement part, not the retention policy
            if (lineBefore.includes('FROM') && !lineBefore.includes('WHERE')) {
                const fromMatch = lineBeforeForFrom.match(/FROM\s+(.*)$/i);
                if (fromMatch) {
                    const afterFrom = fromMatch[1].trim();
                    const retentionMeasurementMatch = afterFrom.match(/^"([^"]+)"\.(.*)$/);
                    if (retentionMeasurementMatch) {
                        // Only replace the measurement part after the dot
                        const dotIndex = line.lastIndexOf('.', start);
                        if (dotIndex !== -1) {
                            replaceFrom = dotIndex + 1; // Start after the dot
                            console.log(`FROM autocomplete - adjusting replacement range from ${wordStart} to ${replaceFrom}`);
                        }
                    }
                }
            }
            
            console.log(`Autocomplete return - from: ${replaceFrom}, to: ${replaceTo}`);
            
            return {
                list: hintList,
                from: CodeMirror.Pos(cur.line, replaceFrom),
                to: CodeMirror.Pos(cur.line, replaceTo)
            };
        });

        // Legacy SQL autocomplete for backward compatibility
        CodeMirror.registerHelper("hint", "sql", function(cm) {
            const cur = cm.getCursor();
            const line = cm.getLine(cur.line);
            const start = cur.ch;
            const end = start;
            
            let wordStart = start;
            while (wordStart > 0 && /\w/.test(line.charAt(wordStart - 1))) {
                wordStart--;
            }
            
            const word = line.slice(wordStart, start).toLowerCase();
            const suggestions = QueryKeywords.influxql.filter(function(keyword) { 
                return keyword.toLowerCase().startsWith(word);
            }).map(function(keyword) {
                return {
                    text: keyword,
                    displayText: keyword,
                    className: 'influxql-hint'
                };
            });
            
            return {
                list: suggestions,
                from: CodeMirror.Pos(cur.line, wordStart),
                to: CodeMirror.Pos(cur.line, end)
            };
        });
    },

    // Setup CodeMirror event handlers
    setupCodeMirrorEvents() {
        // Real-time syntax validation
        GrafanaConfig.queryEditor.on('change', function(cm) {
            clearTimeout(GrafanaConfig.queryEditor.validateTimeout);
            GrafanaConfig.queryEditor.validateTimeout = setTimeout(function() {
                Editor.validateQuery();
            }, 500);
        });
        
        // Auto-complete on typing
        GrafanaConfig.queryEditor.on('inputRead', function(cm, change) {
            if (!cm.state.completionActive &&
                change.text[0].match(/[a-zA-Z]/)) {
                CodeMirror.commands.autocomplete(cm, null, {completeSingle: false});
            }
        });
        
        // Handle completion selection to trigger schema loading for measurements
        GrafanaConfig.queryEditor.on('endCompletion', function(cm) {
            const query = cm.getValue().toUpperCase();
            const fromMatch = query.match(/FROM\s+(?:"?([^"\s.]+)"?\.)?(?:"?([^"\s]+)"?)/);
            if (fromMatch) {
                const measurement = fromMatch[2] || fromMatch[1];
                if (measurement && typeof Schema !== 'undefined' && Schema.currentDatasourceType === 'influxdb') {
                    // Check if we need to load schema for this measurement
                    const hasFields = Schema.influxFields[measurement] && Schema.influxFields[measurement].length > 0;
                    const hasTags = Schema.influxTags[measurement] && Schema.influxTags[measurement].length > 0;
                    
                    if (!hasFields && !hasTags) {
                        console.log('Auto-loading schema for measurement:', measurement);
                        setTimeout(() => {
                            Schema.loadMeasurementSchema(measurement, Schema.influxRetentionPolicies[0] || 'autogen');
                        }, 100);
                    }
                }
            }
        });
    },

    // Query validation
    validateQuery() {
        if (!GrafanaConfig.queryEditor) return;
        
        const query = GrafanaConfig.queryEditor.getValue().trim();
        const errorDisplay = document.getElementById('queryErrorDisplay');
        
        if (!query) {
            if (errorDisplay) {
                errorDisplay.classList.add('hidden');
            }
            return;
        }
        
        let errors = [];
        if (GrafanaConfig.currentQueryType === 'promql') {
            errors = this.validatePromQL(query);
        } else if (GrafanaConfig.currentQueryType === 'influxql') {
            errors = this.validateInfluxQL(query);
        }
        
        if (errorDisplay) {
            if (errors.length > 0) {
                errorDisplay.textContent = errors.join(', ');
                errorDisplay.classList.remove('hidden');
            } else {
                errorDisplay.classList.add('hidden');
            }
        } else {
            // For new interface, we could log errors to console or handle differently
            if (errors.length > 0) {
                console.warn('Query validation errors:', errors.join(', '));
            }
        }
    },

    // PromQL syntax validation
    validatePromQL(query) {
        const errors = [];
        
        // Basic syntax checks
        const brackets = { '(': 0, '[': 0, '{': 0 };
        for (let i = 0; i < query.length; i++) {
            const char = query[i];
            if (char === '(') brackets['(']++;
            else if (char === ')') brackets['(']--;
            else if (char === '[') brackets['[']++;
            else if (char === ']') brackets['[']--;
            else if (char === '{') brackets['{']++;
            else if (char === '}') brackets['{']--;
        }
        
        if (brackets['('] !== 0) errors.push("Unmatched parentheses");
        if (brackets['['] !== 0) errors.push("Unmatched square brackets");
        if (brackets['{'] !== 0) errors.push("Unmatched curly braces");
        
        // Check for invalid time ranges
        const timeRangeRegex = /\[\s*\d+[smhdwy]\s*\]/g;
        const matches = query.match(timeRangeRegex);
        if (matches) {
            matches.forEach(function(match) {
                if (!match.match(/\[\s*\d+[smhdwy]\s*\]/)) {
                    errors.push('Invalid time range: ' + match);
                }
            });
        }
        
        return errors;
    },

    // InfluxQL syntax validation
    validateInfluxQL(query) {
        const errors = [];
        const upperQuery = query.toUpperCase().trim();
        
        // Basic InfluxQL structure validation
        if (upperQuery.startsWith('SELECT')) {
            if (!upperQuery.includes('FROM')) {
                errors.push("SELECT statement missing FROM clause");
            }
            
            // Check for valid aggregation functions
            const aggregateFunctions = ['COUNT', 'SUM', 'MEAN', 'MEDIAN', 'MODE', 'SPREAD', 'STDDEV', 
                                       'FIRST', 'LAST', 'MAX', 'MIN', 'PERCENTILE', 'SAMPLE', 'TOP', 'BOTTOM'];
            const functionPattern = new RegExp(`\\b(${aggregateFunctions.join('|')})\\s*\\(`, 'gi');
            const functions = query.match(functionPattern);
            
            if (functions && upperQuery.includes('GROUP BY TIME') && !functions.some(fn => 
                aggregateFunctions.some(af => fn.toUpperCase().includes(af)))) {
                errors.push("GROUP BY time() requires an aggregate function");
            }
        }
        
        // Validate SHOW statements
        if (upperQuery.startsWith('SHOW')) {
            const validShowTypes = ['DATABASES', 'MEASUREMENTS', 'SERIES', 'TAG KEYS', 'TAG VALUES', 
                                   'FIELD KEYS', 'RETENTION POLICIES', 'USERS', 'GRANTS', 'QUERIES', 
                                   'SHARDS', 'SHARD GROUPS', 'SUBSCRIPTIONS', 'CONTINUOUS QUERIES'];
            
            const hasValidShow = validShowTypes.some(type => upperQuery.includes(type));
            if (!hasValidShow) {
                errors.push("Invalid SHOW statement type");
            }
        }
        
        // Validate CREATE statements
        if (upperQuery.startsWith('CREATE')) {
            const validCreateTypes = ['DATABASE', 'RETENTION POLICY', 'USER', 'CONTINUOUS QUERY', 'SUBSCRIPTION'];
            const hasValidCreate = validCreateTypes.some(type => upperQuery.includes(type));
            if (!hasValidCreate) {
                errors.push("Invalid CREATE statement type");
            }
        }
        
        // Check for basic syntax errors
        const singleQuotes = (query.match(/'/g) || []).length;
        const doubleQuotes = (query.match(/"/g) || []).length;
        
        if (singleQuotes % 2 !== 0) {
            errors.push("Unmatched single quotes");
        }
        if (doubleQuotes % 2 !== 0) {
            errors.push("Unmatched double quotes");
        }
        
        // Check parentheses matching
        const parens = query.match(/[()]/g);
        if (parens) {
            let count = 0;
            for (const paren of parens) {
                count += paren === '(' ? 1 : -1;
                if (count < 0) break;
            }
            if (count !== 0) {
                errors.push("Unmatched parentheses");
            }
        }
        
        // Validate time literal format
        const timePattern = /\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2}:\d{2}(\.\d+)?)?/g;
        const timeMatches = query.match(timePattern);
        if (timeMatches) {
            timeMatches.forEach(match => {
                try {
                    const date = new Date(match);
                    if (isNaN(date.getTime())) {
                        errors.push(`Invalid time format: ${match}`);
                    }
                } catch (e) {
                    errors.push(`Invalid time format: ${match}`);
                }
            });
        }
        
        // Validate duration literals
        const durationPattern = /\b\d+[uµmshd w]\b/g;
        const durationMatches = query.match(durationPattern);
        if (durationMatches) {
            durationMatches.forEach(match => {
                if (!match.match(/^\d+[uµmshd w]$/)) {
                    errors.push(`Invalid duration format: ${match}`);
                }
            });
        }
        
        return errors;
    },

    // Enable/disable query editor
    enableQueryEditor() {
        const executeBtn = document.getElementById('executeBtn');
        if (executeBtn) {
            executeBtn.disabled = false;
        }
        
        if (GrafanaConfig.queryEditor) {
            GrafanaConfig.queryEditor.setOption('readOnly', false);
        } else {
            const queryElement = document.getElementById('query');
            if (queryElement) {
                queryElement.disabled = false;
            }
        }
    },

    // Get query value - supports multiple queries and selection
    getQueryValue() {
        return GrafanaConfig.queryEditor ? GrafanaConfig.queryEditor.getValue().trim() : document.getElementById('query').value.trim();
    },
    
    // Get the query that should be executed (selected text or individual query from multi-query)
    getExecutableQuery(editor) {
        if (!editor) {
            editor = GrafanaConfig.queryEditor;
        }
        
        if (!editor) {
            return this.getQueryValue();
        }
        
        // Check if there's selected text
        const selectedText = editor.getSelection();
        if (selectedText && selectedText.trim()) {
            console.log('Executing selected query:', selectedText.trim());
            return selectedText.trim();
        }
        
        // Get all text and split into individual queries
        const allText = editor.getValue();
        const queries = this.splitIntoQueries(allText);
        
        // If only one query, return it
        if (queries.length <= 1) {
            return allText.trim();
        }
        
        // Multiple queries found - determine which one to execute based on cursor position
        const cursor = editor.getCursor();
        const currentLine = cursor.line;
        
        // Find which query the cursor is in
        let lineCount = 0;
        for (let i = 0; i < queries.length; i++) {
            const query = queries[i];
            const queryLines = query.split('\n').length;
            
            if (currentLine >= lineCount && currentLine < lineCount + queryLines) {
                console.log(`Executing query ${i + 1} of ${queries.length}:`, query.trim());
                return query.trim();
            }
            
            lineCount += queryLines;
        }
        
        // Fallback to first query
        console.log('Executing first query from multiple queries:', queries[0].trim());
        return queries[0].trim();
    },
    
    // Get all executable queries (for executing all queries in sequence)
    getAllExecutableQueries(editor) {
        if (!editor) {
            editor = GrafanaConfig.queryEditor;
        }
        
        if (!editor) {
            return [this.getQueryValue()];
        }
        
        // Check if there's selected text
        const selectedText = editor.getSelection();
        if (selectedText && selectedText.trim()) {
            console.log('Executing selected query:', selectedText.trim());
            return [selectedText.trim()];
        }
        
        // Get all text and split into individual queries
        const allText = editor.getValue();
        const queries = this.splitIntoQueries(allText);
        
        return queries.filter(q => q.trim().length > 0);
    },
    
    // Split text into individual queries
    splitIntoQueries(text) {
        if (!text || !text.trim()) {
            return [];
        }
        
        // Split on semicolons that are not inside quotes
        const queries = [];
        let currentQuery = '';
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let escaped = false;
        
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            
            if (escaped) {
                currentQuery += char;
                escaped = false;
                continue;
            }
            
            if (char === '\\') {
                escaped = true;
                currentQuery += char;
                continue;
            }
            
            if (char === "'" && !inDoubleQuote) {
                inSingleQuote = !inSingleQuote;
            } else if (char === '"' && !inSingleQuote) {
                inDoubleQuote = !inDoubleQuote;
            }
            
            if (char === ';' && !inSingleQuote && !inDoubleQuote) {
                // Found a query separator
                const query = currentQuery.trim();
                if (query) {
                    queries.push(query);
                }
                currentQuery = '';
            } else {
                currentQuery += char;
            }
        }
        
        // Add the last query if it exists
        const lastQuery = currentQuery.trim();
        if (lastQuery) {
            queries.push(lastQuery);
        }
        
        // If no semicolons found, treat as single query
        if (queries.length === 0 && text.trim()) {
            queries.push(text.trim());
        }
        
        return queries.filter(q => q.length > 0);
    },

    // Set query value
    setQueryValue(value) {
        if (GrafanaConfig.queryEditor) {
            GrafanaConfig.queryEditor.setValue(value);
        } else {
            document.getElementById('query').value = value;
        }
    },

    // Clear query
    clearQuery() {
        if (GrafanaConfig.queryEditor) {
            GrafanaConfig.queryEditor.setValue('');
        } else {
            document.getElementById('query').value = '';
        }
        document.getElementById('queryErrorDisplay').classList.add('hidden');
    },

    // Set query type
    setQueryType(type) {
        GrafanaConfig.currentQueryType = type;
        
        const promqlOptions = document.getElementById('promqlOptions');
        if (promqlOptions) {
            if (type === 'promql') {
                promqlOptions.style.display = 'block';
            } else {
                promqlOptions.style.display = 'none';
            }
        }
        
        // Update CodeMirror mode
        if (GrafanaConfig.queryEditor) {
            GrafanaConfig.queryEditor.setOption('mode', type === 'promql' ? 'promql' : 'influxql');
            
            // Update placeholder
            const placeholder = type === 'influxql' 
                ? 'Enter InfluxQL query (e.g., SELECT * FROM measurement WHERE time > now() - 1h)'
                : 'Enter PromQL query (e.g., up{job="prometheus"})';
            
            GrafanaConfig.queryEditor.setOption('placeholder', placeholder);
            
            // Refresh to apply changes
            GrafanaConfig.queryEditor.refresh();
            
            // Revalidate current query
            this.validateQuery();
        }
    },
    
    // Setup resize handle for query editor
    setupResizeHandle() {
        const resizeHandle = document.getElementById('queryEditorResizeHandle');
        const editorContainer = document.querySelector('.CodeMirror');
        if (!resizeHandle || !editorContainer) return;
        
        let isResizing = false;
        let startY = 0;
        let startHeight = 0;
        const minHeight = 200;
        
        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startY = e.clientY;
            startHeight = editorContainer.offsetHeight;
            document.body.style.cursor = 'ns-resize';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const deltaY = e.clientY - startY;
            const newHeight = Math.max(minHeight, startHeight + deltaY);
            
            editorContainer.style.height = newHeight + 'px';
            if (GrafanaConfig.queryEditor) {
                GrafanaConfig.queryEditor.refresh();
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
            }
        });
    }
};