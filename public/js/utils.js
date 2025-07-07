const Utils = {
    // HTML escaping utility
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    },

    // Show status messages
    showStatus(elementId, message, type) {
        const element = document.getElementById(elementId);
        if (type === 'loading') {
            element.innerHTML = '<div class="loading">' + message + '</div>';
        } else {
            element.innerHTML = '<div class="status ' + type + '">' + message + '</div>';
        }
    },

    // Show results with different types
    showResults(message, type) {
        const resultsDiv = document.getElementById('results');
        GrafanaConfig.currentResults = null;
        GrafanaConfig.selectedSeries = 0;
        if (type === 'loading') {
            resultsDiv.innerHTML = '<div class="loading">' + message + '</div>';
        } else {
            resultsDiv.innerHTML = '<div class="status ' + type + '">' + message + '</div>';
        }
    },

    // Token status management
    showTokenStatus(connectionId, message, type = 'info') {
        let statusDiv = document.getElementById('tokenStatus');
        if (!statusDiv) {
            statusDiv = document.createElement('div');
            statusDiv.id = 'tokenStatus';
            statusDiv.className = 'token-status';
            
            const connectionMgmt = document.getElementById('connectionManagement');
            connectionMgmt.parentNode.insertBefore(statusDiv, connectionMgmt.nextSibling);
        }
        
        statusDiv.className = 'token-status ' + type;
        
        if (type === 'loading') {
            statusDiv.innerHTML = '<div class="loading">' + message + '</div>';
        } else {
            statusDiv.innerHTML = message;
        }
        
        statusDiv.classList.remove('hidden');
    },

    clearTokenStatus() {
        const statusDiv = document.getElementById('tokenStatus');
        if (statusDiv) {
            statusDiv.classList.add('hidden');
        }
    },

    // Hide all auth sections
    hideAllAuthSections() {
        const connectionForm = document.getElementById('connectionForm');
        if (connectionForm) {
            connectionForm.classList.add('hidden');
        }
        
        const connectWithPassword = document.getElementById('connectWithPassword');
        if (connectWithPassword) {
            connectWithPassword.classList.add('hidden');
        }
        
        this.clearTokenStatus();
    },

    // Show data source notification
    showDataSourceNotification(datasourceType) {
        const notification = document.createElement('div');
        notification.style.cssText = 'position: fixed; top: 20px; right: 20px; background-color: #1a3a1a; border: 1px solid #2a5a2a; color: #4ade80; padding: 10px 15px; border-radius: 4px; font-size: 14px; z-index: 1000; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3); transition: opacity 0.3s ease;';
        
        const queryType = datasourceType === 'prometheus' ? 'PromQL' : 'InfluxQL';
        notification.textContent = '✓ Auto-selected ' + queryType + ' for ' + datasourceType + ' data source';
        
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(function() {
            notification.style.opacity = '0';
            setTimeout(function() {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    },

    // Format time values for display
    formatTimeValue(value) {
        return new Date(value).toLocaleString();
    },

    // Format number values for display
    formatNumberValue(value) {
        if (typeof value === 'number' && !Number.isInteger(value)) {
            return value.toFixed(3);
        }
        return value;
    },

    // Extract series name from frame metadata
    extractSeriesName(frame, frameIndex) {
        let seriesName = 'Group ' + (frameIndex + 1);
        
        try {
            // Try to extract name from frame metadata
            if (frame.name) {
                return frame.name;
            }
            
            // Try to extract from tag columns
            if (frame.schema && frame.schema.fields && frame.data && frame.data.values) {
                const tagFields = frame.schema.fields.filter(function(field) {
                    return field.type === 'string' && 
                           field.name !== 'time' && 
                           !field.name.startsWith('_');
                });
                
                if (tagFields.length > 0 && frame.data.values.length > 0) {
                    const tagValues = [];
                    tagFields.forEach(function(field) {
                        const fieldIndex = frame.schema.fields.indexOf(field);
                        if (fieldIndex >= 0 && frame.data.values[fieldIndex] && frame.data.values[fieldIndex].length > 0) {
                            const value = frame.data.values[fieldIndex][0];
                            if (value !== null && value !== undefined && value !== '') {
                                tagValues.push(field.name + '=' + value);
                            }
                        }
                    });
                    
                    if (tagValues.length > 0) {
                        seriesName = tagValues.slice(0, 2).join(', ');
                    }
                }
            }
            
            // Try to extract from field labels (Prometheus)
            if (seriesName === 'Group ' + (frameIndex + 1) && frame.schema && frame.schema.fields) {
                const labelField = frame.schema.fields.find(function(field) {
                    return field.labels && Object.keys(field.labels).length > 0;
                });
                if (labelField && labelField.labels) {
                    const excludeLabels = ['__name__', 'job', 'instance'];
                    const meaningfulLabels = Object.entries(labelField.labels)
                        .filter(function(entry) {
                            const key = entry[0];
                            const value = entry[1];
                            return !excludeLabels.includes(key) && value;
                        })
                        .map(function(entry) {
                            const key = entry[0];
                            const value = entry[1];
                            return key + '="' + value + '"';
                        })
                        .slice(0, 2);
                    
                    if (meaningfulLabels.length > 0) {
                        seriesName = meaningfulLabels.join(', ');
                    }
                }
            }
            
            // Try to extract from display name
            if (seriesName === 'Group ' + (frameIndex + 1) && frame.schema && frame.schema.fields) {
                const displayField = frame.schema.fields.find(function(field) {
                    return field.config && field.config.displayNameFromDS;
                });
                if (displayField && displayField.config.displayNameFromDS) {
                    seriesName = displayField.config.displayNameFromDS;
                }
            }
            
        } catch (error) {
            console.warn('Error extracting series name:', error);
        }
        
        return seriesName;
    }
};