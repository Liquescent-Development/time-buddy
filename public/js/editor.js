const Editor = {
    // Initialize CodeMirror editor
    initializeCodeMirror() {
        console.log('Initializing CodeMirror...');
        const textarea = document.getElementById('query');
        
        GrafanaConfig.queryEditor = CodeMirror.fromTextArea(textarea, {
            mode: GrafanaConfig.currentQueryType === 'promql' ? 'promql' : 'sql',
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

        // InfluxQL autocomplete
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
        }
        
        // Check for basic syntax errors
        const quotes = query.match(/['"]/g);
        if (quotes && quotes.length % 2 !== 0) {
            errors.push("Unmatched quotes");
        }
        
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
            GrafanaConfig.queryEditor.setOption('mode', type === 'promql' ? 'promql' : 'sql');
            
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