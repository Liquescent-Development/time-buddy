const Variables = {
    // Variables state
    variables: [],
    
    // Initialize variables system
    initialize() {
        this.loadVariablesFromStorage();
        this.renderVariablesUI();
    },
    
    // Add a new variable
    addVariable(name, query, datasourceId, datasourceName, regex = '', type = 'query') {
        const variable = {
            id: Date.now(),
            name: name.trim(),
            query: query.trim(),
            regex: regex.trim(),
            datasourceId: datasourceId,
            datasourceName: datasourceName,
            connectionId: GrafanaConfig.currentConnectionId,
            type: type,
            values: [],
            selectedValue: null,
            selectedValues: [], // For multi-select support
            multiSelect: false, // Whether this variable supports multiple values
            lastUpdated: new Date().toISOString(),
            error: null
        };
        
        this.variables.push(variable);
        this.saveVariablesToStorage();
        this.renderVariablesUI();
        return variable;
    },
    
    // Remove a variable
    removeVariable(variableId) {
        this.variables = this.variables.filter(v => v.id !== variableId);
        this.saveVariablesToStorage();
        this.renderVariablesUI();
    },
    
    // Update variable values by executing its query
    async updateVariable(variableId) {
        const variable = this.variables.find(v => v.id === variableId);
        if (!variable) return;
        
        try {
            variable.error = null;
            const values = await this.executeVariableQuery(variable);
            variable.values = values;
            variable.lastUpdated = new Date().toISOString();
            
            // Set default selected value if none selected
            if (!variable.selectedValue && values.length > 0) {
                variable.selectedValue = values[0];
            }
            
            this.saveVariablesToStorage();
            this.renderVariablesUI();
            return true;
        } catch (error) {
            variable.error = error.message;
            this.saveVariablesToStorage();
            this.renderVariablesUI();
            return false;
        }
    },
    
    // Execute variable query to get values
    async executeVariableQuery(variable) {
        const selectedOption = Array.from(document.getElementById('datasource').options)
            .find(option => option.value === variable.datasourceId);
        
        if (!selectedOption) {
            throw new Error('Datasource not found');
        }
        
        const datasourceType = selectedOption.dataset.type;
        const datasourceNumericId = selectedOption.dataset.id;
        
        // Build request based on datasource type
        let requestBody;
        let urlParams = '';
        
        const now = Date.now();
        const fromTime = now - (24 * 60 * 60 * 1000); // 24 hours ago
        const toTime = now;
        
        if (datasourceType === 'prometheus') {
            const requestId = Math.random().toString(36).substr(2, 9);
            urlParams = '?ds_type=prometheus&requestId=' + requestId;
            
            requestBody = {
                queries: [{
                    refId: 'A',
                    datasource: { 
                        uid: variable.datasourceId,
                        type: 'prometheus'
                    },
                    expr: variable.query,
                    instant: true, // Variable queries are typically instant
                    interval: '',
                    legendFormat: '',
                    editorMode: 'code',
                    exemplar: false,
                    requestId: requestId.substr(0, 3).toUpperCase(),
                    utcOffsetSec: new Date().getTimezoneOffset() * -60,
                    scopes: [],
                    adhocFilters: [],
                    datasourceId: parseInt(datasourceNumericId),
                    intervalMs: 15000,
                    maxDataPoints: 1000
                }],
                from: fromTime.toString(),
                to: toTime.toString()
            };
        } else if (datasourceType === 'influxdb') {
            const requestId = Math.random().toString(36).substr(2, 9);
            urlParams = '?ds_type=influxdb&requestId=' + requestId;
            
            requestBody = {
                queries: [{
                    refId: 'A',
                    datasource: { 
                        uid: variable.datasourceId,
                        type: 'influxdb'
                    },
                    query: variable.query,
                    rawQuery: true,
                    resultFormat: 'time_series',
                    requestId: requestId.substr(0, 3).toUpperCase(),
                    utcOffsetSec: new Date().getTimezoneOffset() * -60,
                    datasourceId: parseInt(datasourceNumericId),
                    intervalMs: 15000,
                    maxDataPoints: 1000
                }],
                from: fromTime.toString(),
                to: toTime.toString()
            };
        }
        
        const response = await API.makeApiRequest('/api/ds/query' + urlParams, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error('Variable query failed: ' + response.statusText + ' - ' + errorText);
        }
        
        const data = await response.json();
        return this.extractValuesFromResult(data, datasourceType, variable);
    },
    
    // Extract values from query result
    extractValuesFromResult(data, datasourceType, variable) {
        const rawValues = [];
        
        if (!data.results || !data.results.A || !data.results.A.frames) {
            return rawValues;
        }
        
        const frames = data.results.A.frames;
        
        for (const frame of frames) {
            if (!frame.data || !frame.data.values) continue;
            
            // For variable queries, we typically want the first non-time column
            const nonTimeColumns = frame.data.values.filter((_, index) => {
                const field = frame.schema.fields[index];
                return field.type !== 'time';
            });
            
            if (nonTimeColumns.length > 0) {
                const columnValues = nonTimeColumns[0];
                for (const value of columnValues) {
                    if (value !== null && value !== undefined) {
                        const stringValue = String(value);
                        if (!rawValues.includes(stringValue)) {
                            rawValues.push(stringValue);
                        }
                    }
                }
            }
        }
        
        // Apply regex processing if specified
        if (variable.regex) {
            return this.applyRegexToValues(rawValues, variable.regex);
        }
        
        return rawValues.sort();
    },
    
    // Apply regex to values with support for named capture groups
    applyRegexToValues(values, regexPattern) {
        const processedValues = [];
        
        try {
            const regex = new RegExp(regexPattern, 'g');
            
            for (const value of values) {
                // Reset regex lastIndex for global regex
                regex.lastIndex = 0;
                const match = regex.exec(value);
                
                if (match) {
                    // Check for named capture groups
                    if (match.groups && Object.keys(match.groups).length > 0) {
                        // Look for 'text' and 'value' named groups
                        const text = match.groups.text || match.groups.display;
                        const val = match.groups.value || match.groups.val;
                        
                        if (text && val) {
                            // Create object with separate display text and value
                            processedValues.push({
                                text: text,
                                value: val
                            });
                        } else if (text) {
                            // Use text as both display and value
                            processedValues.push(text);
                        } else if (val) {
                            // Use value as both display and value
                            processedValues.push(val);
                        } else {
                            // Use first named group
                            const firstGroup = Object.values(match.groups)[0];
                            if (firstGroup) {
                                processedValues.push(firstGroup);
                            }
                        }
                    } else if (match[1]) {
                        // Use first capture group
                        processedValues.push(match[1]);
                    } else if (match[0]) {
                        // Use full match
                        processedValues.push(match[0]);
                    }
                }
            }
        } catch (error) {
            console.error('Regex error:', error);
            // Return original values if regex fails
            return values.sort();
        }
        
        // Remove duplicates and sort
        const uniqueValues = [];
        const seen = new Set();
        
        for (const item of processedValues) {
            const key = typeof item === 'object' ? `${item.text}|${item.value}` : item;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueValues.push(item);
            }
        }
        
        return uniqueValues.sort((a, b) => {
            const aText = typeof a === 'object' ? a.text : a;
            const bText = typeof b === 'object' ? b.text : b;
            return aText.localeCompare(bText);
        });
    },
    
    // Substitute variables in query text
    substituteVariables(queryText) {
        let substitutedQuery = queryText;
        
        // Only use variables for current connection
        const currentConnectionId = GrafanaConfig.currentConnectionId;
        const filteredVariables = currentConnectionId 
            ? this.variables.filter(v => v.connectionId === currentConnectionId)
            : [];
        
        for (const variable of filteredVariables) {
            // Handle multi-select variables
            if (variable.multiSelect && variable.selectedValues && variable.selectedValues.length > 0) {
                const placeholder = `$${variable.name}`;
                const regexPlaceholder = `\\$\\{${variable.name}\\}`;
                
                // Extract actual values from objects if needed
                const values = variable.selectedValues.map(val => 
                    typeof val === 'object' ? val.value : val
                );
                
                // Check for regex pattern usage (e.g., =~ /${hosts}/)
                const regexPattern = new RegExp(`=~\\s*/` + regexPlaceholder + `/`, 'g');
                if (regexPattern.test(substitutedQuery)) {
                    // Replace with regex pattern (hostname1|hostname2|hostname3)
                    const escapedValues = values.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
                    const replacement = `=~ /(${escapedValues.join('|')})/`;
                    substitutedQuery = substitutedQuery.replace(regexPattern, replacement);
                }
                
                // Check for IN clause usage (e.g., IN (${hosts}))
                const inPattern = new RegExp(`IN\\s*\\(\\s*` + regexPlaceholder + `\\s*\\)`, 'g');
                if (inPattern.test(substitutedQuery)) {
                    // Replace with comma-separated quoted values
                    const quotedValues = values.map(v => `'${v}'`);
                    const replacement = `IN (${quotedValues.join(', ')})`;
                    substitutedQuery = substitutedQuery.replace(inPattern, replacement);
                }
                
                // Regular substitution (comma-separated)
                const regularPattern = new RegExp(regexPlaceholder, 'g');
                substitutedQuery = substitutedQuery.replace(regularPattern, values.join(','));
                
            } else if (variable.selectedValue) {
                // Single value substitution
                const placeholder = `$${variable.name}`;
                const regexPlaceholder = `\\$\\{${variable.name}\\}`;
                const regex = new RegExp(regexPlaceholder + '|\\' + placeholder + '\\b', 'g');
                
                // Handle object values (with text/value pairs)
                const value = typeof variable.selectedValue === 'object' 
                    ? variable.selectedValue.value 
                    : variable.selectedValue;
                
                substitutedQuery = substitutedQuery.replace(regex, value);
            }
        }
        
        return substitutedQuery;
    },
    
    // Set variable selected value
    setVariableValue(variableId, value) {
        const variable = this.variables.find(v => v.id === variableId);
        if (variable) {
            variable.selectedValue = value;
            this.saveVariablesToStorage();
            this.renderVariablesUI();
        }
    },
    
    // Render variables UI
    renderVariablesUI() {
        const container = document.getElementById('variablesContainer');
        const variablesSection = document.getElementById('variablesSection');
        if (!container) return;
        
        // Always show variables section (like history section)
        if (variablesSection) {
            variablesSection.style.display = '';
        }
        
        // Show placeholder if not connected
        if (!GrafanaConfig.currentConnectionId) {
            container.innerHTML = '<div class="no-variables">Connect to Grafana to manage query variables</div>';
            return;
        }
        
        let html = '';
        
        // Filter variables for current connection
        const currentConnectionId = GrafanaConfig.currentConnectionId;
        const filteredVariables = this.variables.filter(v => v.connectionId === currentConnectionId);
        
        if (filteredVariables.length === 0) {
            html = '<div class="no-variables">No query variables defined for this connection. <button class="link-button" onclick="showAddVariableForm()">Add your first variable</button></div>';
        } else {
            html += '<div class="variables-list">';
            
            for (const variable of filteredVariables) {
                html += '<div class="variable-item" data-variable-id="' + variable.id + '">';
                
                // Variable header
                html += '<div class="variable-header">';
                html += '<span class="variable-name">$' + Utils.escapeHtml(variable.name) + '</span>';
                html += '<div class="variable-actions">';
                html += '<button class="icon-button" onclick="refreshVariable(' + variable.id + ')" title="Refresh values">';
                html += '<span>🔄</span>';
                html += '</button>';
                html += '<button class="icon-button" onclick="editVariable(' + variable.id + ')" title="Edit variable">';
                html += '<span>✏️</span>';
                html += '</button>';
                html += '<button class="icon-button danger" onclick="deleteVariable(' + variable.id + ')" title="Delete variable">';
                html += '<span>🗑️</span>';
                html += '</button>';
                html += '</div>';
                html += '</div>';
                
                // Variable content
                html += '<div class="variable-content">';
                
                // Value selector
                if (variable.values.length > 0) {
                    html += '<div class="variable-selector">';
                    
                    // Multi-select toggle
                    html += '<label class="variable-multi-toggle">';
                    html += '<input type="checkbox" onchange="toggleMultiSelect(' + variable.id + ', this.checked)" ' + 
                            (variable.multiSelect ? 'checked' : '') + '>';
                    html += '<span>Multi-select</span>';
                    html += '</label>';
                    
                    if (variable.multiSelect) {
                        // Multi-select dropdown
                        html += '<select multiple onchange="setMultipleVariableValues(' + variable.id + ', this)" class="variable-dropdown variable-dropdown-multi" size="5">';
                        
                        for (const value of variable.values) {
                            let optionValue, optionText, isSelected;
                            
                            if (typeof value === 'object') {
                                optionValue = JSON.stringify(value);
                                optionText = value.text;
                                isSelected = variable.selectedValues && variable.selectedValues.some(sv => 
                                    typeof sv === 'object' && 
                                    sv.text === value.text && 
                                    sv.value === value.value
                                );
                            } else {
                                optionValue = value;
                                optionText = value;
                                isSelected = variable.selectedValues && variable.selectedValues.includes(value);
                            }
                            
                            const selected = isSelected ? 'selected' : '';
                            html += '<option value="' + Utils.escapeHtml(optionValue) + '" ' + selected + '>' + Utils.escapeHtml(optionText) + '</option>';
                        }
                        
                        html += '</select>';
                        const selectedCount = variable.selectedValues ? variable.selectedValues.length : 0;
                        html += '<span class="variable-info">' + selectedCount + ' of ' + variable.values.length + ' selected</span>';
                    } else {
                        // Single-select dropdown
                        html += '<select onchange="setVariableValueFromDropdown(' + variable.id + ', this)" class="variable-dropdown">';
                        
                        for (const value of variable.values) {
                            let optionValue, optionText, isSelected;
                            
                            if (typeof value === 'object') {
                                optionValue = JSON.stringify(value);
                                optionText = value.text;
                                isSelected = variable.selectedValue && 
                                            typeof variable.selectedValue === 'object' &&
                                            variable.selectedValue.text === value.text &&
                                            variable.selectedValue.value === value.value;
                            } else {
                                optionValue = value;
                                optionText = value;
                                isSelected = value === variable.selectedValue;
                            }
                            
                            const selected = isSelected ? 'selected' : '';
                            html += '<option value="' + Utils.escapeHtml(optionValue) + '" ' + selected + '>' + Utils.escapeHtml(optionText) + '</option>';
                        }
                        
                        html += '</select>';
                        html += '<span class="variable-info">' + variable.values.length + ' values available</span>';
                    }
                    
                    html += '</div>';
                } else if (variable.error) {
                    html += '<div class="variable-error">Error: ' + Utils.escapeHtml(variable.error) + '</div>';
                } else {
                    html += '<div class="variable-empty">No values found. <button class="link-button" onclick="refreshVariable(' + variable.id + ')">Refresh</button></div>';
                }
                
                // Variable details
                html += '<div class="variable-details">';
                html += '<span class="variable-query" title="' + Utils.escapeHtml(variable.query) + '">';
                html += 'Query: ' + Utils.escapeHtml(variable.query.length > 50 ? variable.query.substring(0, 50) + '...' : variable.query);
                html += '</span>';
                html += '<span class="variable-datasource">Source: ' + Utils.escapeHtml(variable.datasourceName) + '</span>';
                if (variable.lastUpdated) {
                    const lastUpdated = new Date(variable.lastUpdated);
                    html += '<span class="variable-updated">Updated: ' + lastUpdated.toLocaleString() + '</span>';
                }
                html += '</div>';
                
                html += '</div>';
                html += '</div>';
            }
            
            html += '</div>';
        }
        
        // Add variable button
        html += '<div class="add-variable-section">';
        html += '<button class="secondary-button" onclick="showAddVariableForm()">+ Add Variable</button>';
        html += '</div>';
        
        container.innerHTML = html;
    },
    
    // Show add variable form
    showAddVariableForm() {
        const formHtml = `
            <div class="variable-form-overlay" id="variableFormOverlay">
                <div class="variable-form">
                    <h3>Add Query Variable</h3>
                    <form onsubmit="saveVariable(event)">
                        <div class="form-group">
                            <label for="variableName">Variable Name</label>
                            <input type="text" id="variableName" placeholder="region" required>
                            <small>Use $region in your queries to reference this variable</small>
                        </div>
                        <div class="form-group">
                            <label for="variableQuery">Query</label>
                            <textarea id="variableQuery" placeholder="label_values(instance)" required></textarea>
                            <small>Query that returns the variable values</small>
                        </div>
                        <div class="form-group">
                            <label for="variableRegex">Regex Filter (Optional)</label>
                            <input type="text" id="variableRegex" placeholder="(?P<text>.+)_(?P<value>.+)">
                            <small>Extract parts of values. Use named groups 'text' and 'value' for display/value separation</small>
                        </div>
                        <div class="form-group">
                            <label for="variableDatasource">Data Source</label>
                            <select id="variableDatasource" required>
                                <option value="">Select data source...</option>
                            </select>
                        </div>
                        <div class="form-buttons">
                            <button type="submit">Save Variable</button>
                            <button type="button" class="secondary-button" onclick="hideAddVariableForm()">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', formHtml);
        
        // Populate datasource dropdown
        const datasourceSelect = document.getElementById('variableDatasource');
        const datasourceOptions = document.getElementById('datasource').options;
        
        for (let i = 1; i < datasourceOptions.length; i++) { // Skip first "Connect to Grafana first" option
            const option = datasourceOptions[i];
            datasourceSelect.innerHTML += `<option value="${option.value}" data-name="${option.textContent}">${option.textContent}</option>`;
        }
    },
    
    // Hide add variable form
    hideAddVariableForm() {
        const overlay = document.getElementById('variableFormOverlay');
        if (overlay) {
            overlay.remove();
        }
    },
    
    // Save variable from form
    async saveVariable(event) {
        event.preventDefault();
        
        const name = document.getElementById('variableName').value.trim();
        const query = document.getElementById('variableQuery').value.trim();
        const regex = document.getElementById('variableRegex').value.trim();
        const datasourceSelect = document.getElementById('variableDatasource');
        const datasourceId = datasourceSelect.value;
        const datasourceName = datasourceSelect.selectedOptions[0].dataset.name;
        
        // Validate name
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
            alert('Variable name must start with a letter or underscore and contain only letters, numbers, and underscores.');
            return;
        }
        
        // Check for duplicate names within the same connection
        const currentConnectionId = GrafanaConfig.currentConnectionId;
        if (this.variables.some(v => v.name === name && v.connectionId === currentConnectionId)) {
            alert('A variable with this name already exists for this connection.');
            return;
        }
        
        const variable = this.addVariable(name, query, datasourceId, datasourceName, regex);
        
        // Try to update the variable immediately
        await this.updateVariable(variable.id);
        
        this.hideAddVariableForm();
    },
    
    // Storage methods
    saveVariablesToStorage() {
        localStorage.setItem('queryVariables', JSON.stringify(this.variables));
    },
    
    loadVariablesFromStorage() {
        const stored = localStorage.getItem('queryVariables');
        this.variables = stored ? JSON.parse(stored) : [];
    }
};

// Global functions for HTML onclick handlers
function showAddVariableForm() {
    Variables.showAddVariableForm();
}

function hideAddVariableForm() {
    Variables.hideAddVariableForm();
}

function saveVariable(event) {
    Variables.saveVariable(event);
}

function refreshVariable(variableId) {
    Variables.updateVariable(variableId);
}

function editVariable(variableId) {
    // TODO: Implement edit functionality
    alert('Edit functionality coming soon!');
}

function deleteVariable(variableId) {
    if (confirm('Are you sure you want to delete this variable?')) {
        Variables.removeVariable(variableId);
    }
}

function setVariableValue(variableId, value) {
    Variables.setVariableValue(variableId, value);
}

function setVariableValueFromDropdown(variableId, selectElement) {
    const value = selectElement.value;
    
    // Try to parse as JSON (for object values)
    try {
        const parsedValue = JSON.parse(value);
        Variables.setVariableValue(variableId, parsedValue);
    } catch (e) {
        // Not JSON, treat as string
        Variables.setVariableValue(variableId, value);
    }
}

function toggleMultiSelect(variableId, enabled) {
    const variable = Variables.variables.find(v => v.id === variableId);
    if (variable) {
        variable.multiSelect = enabled;
        
        // Reset selections when toggling mode
        if (enabled) {
            // Convert single selection to multi-selection
            variable.selectedValues = variable.selectedValue ? [variable.selectedValue] : [];
        } else {
            // Convert multi-selection to single selection
            variable.selectedValue = variable.selectedValues && variable.selectedValues.length > 0 
                ? variable.selectedValues[0] 
                : (variable.values.length > 0 ? variable.values[0] : null);
        }
        
        Variables.saveVariablesToStorage();
        Variables.renderVariablesUI();
    }
}

function setMultipleVariableValues(variableId, selectElement) {
    const selectedOptions = Array.from(selectElement.selectedOptions);
    const values = selectedOptions.map(option => {
        const value = option.value;
        
        // Try to parse as JSON (for object values)
        try {
            return JSON.parse(value);
        } catch (e) {
            // Not JSON, treat as string
            return value;
        }
    });
    
    const variable = Variables.variables.find(v => v.id === variableId);
    if (variable) {
        variable.selectedValues = values;
        Variables.saveVariablesToStorage();
        Variables.renderVariablesUI();
    }
}

function toggleVariablesSection() {
    const variablesSection = document.getElementById('variablesSection');
    const toggleButton = document.querySelector('.variables-toggle');
    
    if (variablesSection.classList.contains('collapsed')) {
        variablesSection.classList.remove('collapsed');
        toggleButton.textContent = 'Hide';
    } else {
        variablesSection.classList.add('collapsed');
        toggleButton.textContent = 'Show';
    }
}