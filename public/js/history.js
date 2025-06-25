const History = {
    // State
    searchTerm: '',
    filterTags: [],
    showFavoritesOnly: false,
    
    // Initialize history
    initialize() {
        this.renderHistoryControls();
        this.loadHistory();
    },
    
    // Render history controls (search, filters)
    renderHistoryControls() {
        const historySection = document.querySelector('.history-section');
        const titleElement = historySection.querySelector('.section-title');
        
        // Create controls container
        const controlsHtml = `
            <div class="history-controls">
                <div class="history-search-container">
                    <input type="text" id="historySearch" placeholder="Search queries..." 
                           onkeyup="History.handleSearch(this.value)" class="history-search">
                </div>
                <div class="history-filters">
                    <label class="history-filter-toggle">
                        <input type="checkbox" onchange="History.toggleFavoritesOnly(this.checked)">
                        <span>Favorites only</span>
                    </label>
                    <button class="secondary-button" onclick="clearHistory()">Clear All</button>
                </div>
            </div>
        `;
        
        // Insert after title
        titleElement.insertAdjacentHTML('afterend', controlsHtml);
    },
    
    // Handle search
    handleSearch(term) {
        this.searchTerm = term.toLowerCase();
        this.loadHistory();
    },
    
    // Toggle favorites only filter
    toggleFavoritesOnly(checked) {
        this.showFavoritesOnly = checked;
        this.loadHistory();
    },
    
    // Filter by tag
    filterByTag(tag) {
        if (this.filterTags.includes(tag)) {
            this.filterTags = this.filterTags.filter(t => t !== tag);
        } else {
            this.filterTags.push(tag);
        }
        this.loadHistory();
    },
    
    // Load history into UI with filtering
    loadHistory() {
        let history = Storage.getHistory();
        const historyList = document.getElementById('historyList');
        
        // Apply filters
        if (this.searchTerm) {
            history = history.filter(item => 
                item.query.toLowerCase().includes(this.searchTerm) ||
                (item.label && item.label.toLowerCase().includes(this.searchTerm)) ||
                (item.tags && item.tags.some(tag => tag.toLowerCase().includes(this.searchTerm)))
            );
        }
        
        if (this.showFavoritesOnly) {
            history = history.filter(item => item.isFavorite);
        }
        
        if (this.filterTags.length > 0) {
            history = history.filter(item => 
                item.tags && this.filterTags.some(tag => item.tags.includes(tag))
            );
        }
        
        if (history.length === 0) {
            historyList.innerHTML = '<p style="color: #888; text-align: center;">No queries found</p>';
            return;
        }
        
        historyList.innerHTML = history.map(item => this.renderHistoryItem(item)).join('');
    },
    
    // Render a single history item
    renderHistoryItem(item) {
        const tags = (item.tags || []).map(tag => 
            `<span class="history-tag" onclick="History.filterByTag('${Utils.escapeHtml(tag)}')">${Utils.escapeHtml(tag)}</span>`
        ).join('');
        
        return `
            <div class="history-item" data-id="${item.id}">
                <div class="history-item-header">
                    <div class="history-timestamp">${new Date(item.timestamp).toLocaleString()}</div>
                    <div class="history-item-actions">
                        <button class="history-action-btn ${item.isFavorite ? 'favorite active' : 'favorite'}" 
                                onclick="History.toggleFavorite(${item.id})" title="Toggle favorite">
                            ${item.isFavorite ? '★' : '☆'}
                        </button>
                        <button class="history-action-btn" onclick="History.editItem(${item.id})" title="Edit label/tags">
                            ✏️
                        </button>
                        <button class="history-action-btn danger" onclick="History.deleteItem(${item.id})" title="Delete">
                            🗑️
                        </button>
                    </div>
                </div>
                ${item.label ? `<div class="history-label">${Utils.escapeHtml(item.label)}</div>` : ''}
                <div class="history-query" onclick="loadHistoryItem(${item.id})">${Utils.escapeHtml(item.query)}</div>
                <div class="history-metadata">
                    <span class="history-datasource">${item.datasourceName} (${item.queryType || 'unknown'})</span>
                    ${tags ? `<div class="history-tags">${tags}</div>` : ''}
                </div>
            </div>
        `;
    },
    
    // Toggle favorite status
    toggleFavorite(id) {
        const item = Storage.getHistory().find(h => h.id === id);
        if (item) {
            Storage.updateHistoryItem(id, { isFavorite: !item.isFavorite });
            this.loadHistory();
        }
    },
    
    // Delete history item
    deleteItem(id) {
        if (confirm('Are you sure you want to delete this query from history?')) {
            Storage.deleteHistoryItem(id);
            this.loadHistory();
        }
    },
    
    // Edit history item (label/tags)
    editItem(id) {
        const item = Storage.getHistory().find(h => h.id === id);
        if (!item) return;
        
        const formHtml = `
            <div class="history-edit-overlay" id="historyEditOverlay">
                <div class="history-edit-form">
                    <h3>Edit Query Details</h3>
                    <form onsubmit="History.saveItemEdits(event, ${id})">
                        <div class="form-group">
                            <label for="historyLabel">Label</label>
                            <input type="text" id="historyLabel" value="${Utils.escapeHtml(item.label || '')}" 
                                   placeholder="Enter a descriptive label">
                        </div>
                        <div class="form-group">
                            <label for="historyTags">Tags (comma-separated)</label>
                            <input type="text" id="historyTags" value="${Utils.escapeHtml((item.tags || []).join(', '))}" 
                                   placeholder="tag1, tag2, tag3">
                        </div>
                        <div class="form-buttons">
                            <button type="submit">Save</button>
                            <button type="button" class="secondary-button" onclick="History.closeEditForm()">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', formHtml);
    },
    
    // Save item edits
    saveItemEdits(event, id) {
        event.preventDefault();
        
        const label = document.getElementById('historyLabel').value.trim();
        const tagsInput = document.getElementById('historyTags').value.trim();
        const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];
        
        Storage.updateHistoryItem(id, { label, tags });
        this.closeEditForm();
        this.loadHistory();
    },
    
    // Close edit form
    closeEditForm() {
        const overlay = document.getElementById('historyEditOverlay');
        if (overlay) {
            overlay.remove();
        }
    },

    // Load a specific history item
    loadHistoryItem(id) {
        const history = Storage.getHistory();
        const item = history.find(function(h) { return h.id === id; });
        
        if (item) {
            Editor.setQueryValue(item.query);
            
            // Set query type
            if (item.queryType) {
                Editor.setQueryType(item.queryType);
            }
            
            // Select datasource
            const datasourceSelect = document.getElementById('datasource');
            if (datasourceSelect.querySelector('option[value="' + item.datasourceId + '"]')) {
                datasourceSelect.value = item.datasourceId;
            }
        }
    },

    // Clear all history
    clearHistory() {
        if (confirm('Are you sure you want to clear all query history?')) {
            Storage.clearHistory();
            this.loadHistory();
        }
    }
};

// Global functions for HTML onclick handlers
function loadHistoryItem(id) {
    History.loadHistoryItem(id);
}

function clearHistory() {
    History.clearHistory();
}