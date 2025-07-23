/**
 * File Explorer Module
 * Handles file system operations for saving and loading query files
 */

const FileExplorer = {
    currentDirectory: null,
    fileTree: {},
    
    // Initialize file explorer
    initialize() {
        // Check if we're in Electron environment
        // First check if we have the electron-app class that's added in app.js
        const hasElectronClass = document.body.classList.contains('electron-app');
        
        // Also check for any window electron APIs
        const hasElectronAPI = typeof window.electronAPI !== 'undefined' || 
                              typeof window.electron !== 'undefined' ||
                              typeof window.ipcRenderer !== 'undefined';
        
        this.isElectron = hasElectronClass || hasElectronAPI;
        
        console.log('FileExplorer initialized - Electron detection:', {
            hasElectronClass,
            hasElectronAPI,
            windowElectronAPI: typeof window.electronAPI,
            windowElectron: typeof window.electron,
            windowIpcRenderer: typeof window.ipcRenderer,
            isElectron: this.isElectron,
            availableAPIs: this.isElectron ? this.getAvailableAPIs() : 'N/A'
        });
        
        // Log all available window properties that might be Electron APIs
        if (this.isElectron) {
            console.log('Available window properties (potential Electron APIs):');
            Object.keys(window).filter(key => 
                key.toLowerCase().includes('electron') || 
                key.toLowerCase().includes('ipc') ||
                key.toLowerCase().includes('file') ||
                key.toLowerCase().includes('dialog')
            ).forEach(key => {
                console.log(`  window.${key}:`, typeof window[key]);
            });
        }
        
        if (!this.isElectron) {
            this.showWebLimitation();
        } else {
            // Try to restore last opened directory with a small delay to ensure Electron APIs are ready
            setTimeout(() => {
                this.restoreLastDirectory();
            }, 500);
        }
    },
    
    // Helper to check what APIs are available
    getAvailableAPIs() {
        const apis = {};
        if (typeof window.electronAPI !== 'undefined') {
            apis.electronAPI = Object.keys(window.electronAPI || {});
            console.log('Available electronAPI methods:', Object.keys(window.electronAPI || {}));
        }
        if (typeof window.electron !== 'undefined') {
            apis.electron = Object.keys(window.electron || {});
        }
        if (typeof window.ipcRenderer !== 'undefined') {
            apis.ipcRenderer = ['available'];
        }
        return apis;
    },
    
    // Show limitation message for web version
    showWebLimitation() {
        const container = document.getElementById('fileExplorerTree');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>File system access is only available in the desktop version.</p>
                    <p style="margin-top: 10px; font-size: 12px; opacity: 0.8;">
                        Use the desktop app to save and open query files directly.
                    </p>
                </div>
            `;
        }
    },
    
    // Save last directory using centralized cache
    saveLastDirectory(directory) {
        if (directory) {
            Storage.setFileExplorerLastDirectory(directory);
            console.log('Saved last directory:', directory);
            
            // Verify it was saved
            const saved = Storage.getFileExplorerLastDirectory();
            console.log('Verified saved directory:', saved);
        }
    },
    
    // Debug method to check centralized cache
    debugLastDirectory() {
        const lastDirectory = Storage.getFileExplorerLastDirectory();
        console.log('Current stored directory:', lastDirectory);
        console.log('All localStorage keys:', Object.keys(localStorage));
        console.log('localStorage length:', localStorage.length);
        return lastDirectory;
    },
    
    // Restore last directory from centralized cache
    async restoreLastDirectory() {
        const lastDirectory = Storage.getFileExplorerLastDirectory();
        console.log('Attempting to restore last directory:', lastDirectory);
        console.log('isElectron:', this.isElectron);
        console.log('Available electronAPI methods:', window.electronAPI ? Object.keys(window.electronAPI) : 'electronAPI not available');
        
        if (lastDirectory && this.isElectron) {
            try {
                // Check if directoryExists method is available
                if (window.electronAPI && typeof window.electronAPI.directoryExists === 'function') {
                    console.log('Checking if directory exists:', lastDirectory);
                    const exists = await window.electronAPI.directoryExists(lastDirectory);
                    console.log('Directory exists result:', exists);
                    if (exists) {
                        this.currentDirectory = lastDirectory;
                        await this.refreshFileTree();
                        console.log('Successfully restored last directory:', lastDirectory);
                    } else {
                        // Directory no longer exists, remove from storage
                        Storage.setFileExplorerLastDirectory(null);
                        console.log('Last directory no longer exists, cleared from storage:', lastDirectory);
                    }
                } else {
                    // If directoryExists is not available, try to restore anyway
                    console.log('directoryExists method not available, attempting to restore directory anyway');
                    this.currentDirectory = lastDirectory;
                    try {
                        await this.refreshFileTree();
                        console.log('Successfully restored last directory without validation:', lastDirectory);
                    } catch (refreshError) {
                        console.error('Failed to refresh file tree for last directory:', refreshError);
                        // Directory probably doesn't exist, remove from storage
                        Storage.setFileExplorerLastDirectory(null);
                        this.currentDirectory = null;
                    }
                }
            } catch (error) {
                console.error('Error restoring last directory:', error);
                // If error checking directory, remove from storage
                Storage.setFileExplorerLastDirectory(null);
                this.currentDirectory = null;
            }
        } else if (lastDirectory && !this.isElectron) {
            console.log('Last directory found but not in Electron environment');
        } else if (!lastDirectory) {
            console.log('No last directory found in localStorage');
        }
    },
    
    // Select a directory to explore
    async selectDirectory() {
        if (!this.isElectron) {
            Interface.showToast('File system access is only available in the desktop version', 'info');
            return;
        }
        
        try {
            let result = null;
            
            // Try Electron API first
            if (window.electronAPI && window.electronAPI.selectDirectory) {
                console.log('Using window.electronAPI.selectDirectory');
                result = await window.electronAPI.selectDirectory();
                
                if (result && !result.canceled && result.filePaths && result.filePaths.length > 0) {
                    this.currentDirectory = result.filePaths[0];
                    this.saveLastDirectory(this.currentDirectory);
                    await this.refreshFileTree();
                    return;
                }
            } else {
                console.log('No Electron directory selection API available');
                Interface.showToast('Directory selection not available in this version', 'warning');
                return;
            }
        } catch (error) {
            console.error('Error selecting directory:', error);
            Interface.showToast('Failed to select directory: ' + error.message, 'error');
        }
    },
    
    // Refresh the file tree
    async refreshFileTree() {
        if (!this.currentDirectory || !this.isElectron) return;
        
        const container = document.getElementById('fileExplorerTree');
        container.innerHTML = '<div class="loading">Loading files...</div>';
        
        try {
            console.log('Reading directory:', this.currentDirectory);
            
            
            const files = await window.electronAPI.readDirectory(this.currentDirectory);
            console.log('Found files:', files);
            this.renderFileTree(files);
        } catch (error) {
            console.error('Error reading directory:', error);
            container.innerHTML = '<div class="empty-state">Failed to read directory: ' + error.message + '</div>';
        }
    },
    
    // Render the file tree
    renderFileTree(files) {
        const container = document.getElementById('fileExplorerTree');
        
        if (!files || files.length === 0) {
            container.innerHTML = '<div class="empty-state">No query files found</div>';
            return;
        }
        
        // Filter for query files
        const queryFiles = files.filter(file => 
            file.name.endsWith('.promql') || 
            file.name.endsWith('.isql') ||
            file.name.endsWith('.sql')
        );
        
        if (queryFiles.length === 0) {
            container.innerHTML = '<div class="empty-state">No query files found (.promql, .isql, .sql)</div>';
            return;
        }
        
        // Sort files by name
        queryFiles.sort((a, b) => a.name.localeCompare(b.name));
        
        // Render files
        let html = '<div class="file-tree-content">';
        html += `<div class="directory-path">${this.currentDirectory}</div>`;
        
        queryFiles.forEach(file => {
            const fileType = file.name.endsWith('.promql') ? 'promql' : 'influxql';
            const icon = fileType === 'promql' ? '📊' : '📈';
            
            html += `
                <div class="file-item" data-path="${file.path}" data-name="${file.name}" data-type="${fileType}">
                    <span class="file-icon">${icon}</span>
                    <span class="file-name">${file.name}</span>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
        
        // Add click handlers
        container.querySelectorAll('.file-item').forEach(item => {
            item.addEventListener('click', () => this.openFile(item.dataset.path, item.dataset.name, item.dataset.type));
        });
    },
    
    // Open a file in a new tab
    async openFile(filePath, fileName, fileType) {
        if (!this.isElectron) return;
        
        try {
            console.log('Opening file:', filePath);
            
            const content = await window.electronAPI.readFileContent(filePath);
            console.log('File content loaded, length:', content.length);
            
            // Create new tab with the file
            const tabId = Interface.createNewTab();
            console.log('Created new tab with ID:', tabId);
            
            // Switch to the new tab first
            Interface.switchTab(tabId);
            
            const tabData = Interface.tabs.get(tabId);
            console.log('Tab data:', tabData);
            
            if (tabData) {
                // Update tab data
                tabData.content = content;
                tabData.saved = true;
                tabData.filePath = filePath;
                tabData.label = fileName;
                tabData.queryType = fileType;
                
                console.log('Updated tab data with file info');
                
                // Update tab label
                const tab = document.querySelector(`[data-tab-id="${tabId}"].tab`);
                if (tab) {
                    const label = tab.querySelector('.tab-label');
                    if (label) {
                        label.textContent = fileName;
                        console.log('Updated tab label to:', fileName);
                    }
                }
                
                // Update query type buttons first
                Interface.setQueryType(tabId, fileType);
                console.log('Set query type to:', fileType);
                
                // Wait a bit for CodeMirror to initialize, then set content
                setTimeout(() => {
                    const currentTabData = Interface.tabs.get(tabId);
                    console.log('Setting content after timeout. Editor available:', !!currentTabData.editor);
                    
                    if (currentTabData.editor) {
                        currentTabData.editor.setValue(content);
                        currentTabData.editor.clearHistory();
                        
                        // Set the correct mode
                        const mode = fileType === 'promql' ? 'promql' : 'influxql';
                        currentTabData.editor.setOption('mode', mode);
                        console.log('Content set in CodeMirror, mode:', mode);
                    } else {
                        // Try to initialize CodeMirror if it's not available
                        console.log('Editor not available, trying to initialize...');
                        Interface.ensureCodeMirrorInitialized();
                        
                        // Try again after another short delay
                        setTimeout(() => {
                            const retryTabData = Interface.tabs.get(tabId);
                            if (retryTabData.editor) {
                                retryTabData.editor.setValue(content);
                                retryTabData.editor.clearHistory();
                                const mode = fileType === 'promql' ? 'promql' : 'influxql';
                                retryTabData.editor.setOption('mode', mode);
                                console.log('Content set in CodeMirror after retry, mode:', mode);
                            } else {
                                console.error('Failed to initialize CodeMirror editor');
                            }
                        }, 200);
                    }
                }, 100);
                
                Interface.showToast(`Opened ${fileName}`, 'success');
            }
        } catch (error) {
            console.error('Error opening file:', error);
            Interface.showToast('Failed to open file: ' + error.message, 'error');
        }
    },
    
    // Save the current tab
    async saveCurrentTab() {
        console.log('FileExplorer.saveCurrentTab() called');
        console.log('FileExplorer.isElectron:', this.isElectron);
        
        const tabId = Interface.activeTab;
        const tabData = Interface.tabs.get(tabId);
        
        console.log('Tab data:', tabData);
        
        if (!tabData) {
            console.log('No tab data found, returning');
            return;
        }
        
        // If file already has a path and we're in Electron, save directly to that path
        if (tabData.filePath && this.isElectron) {
            console.log('Tab has file path and is Electron, saving to existing file:', tabData.filePath);
            const content = tabData.editor ? tabData.editor.getValue() : '';
            
            try {
                // Use writeFile to save directly to the existing path without dialog
                if (window.electronAPI && window.electronAPI.writeFile) {
                    console.log('Using writeFile to save to existing path:', tabData.filePath);
                    await window.electronAPI.writeFile(tabData.filePath, content);
                    tabData.saved = true;
                    Interface.markTabSaved(tabData.id);
                    Interface.showToast('File saved successfully', 'success');
                } else if (window.electronAPI && window.electronAPI.saveFileToPath) {
                    console.log('Using saveFileToPath to save to existing path:', tabData.filePath);
                    await window.electronAPI.saveFileToPath(tabData.filePath, content);
                    Interface.markTabSaved(tabData.id);
                    Interface.showToast('File saved successfully', 'success');
                } else {
                    // Fallback: extract filename and use saveFile (will show dialog)
                    console.log('No direct write method available, falling back to saveFile dialog');
                    const fileName = tabData.filePath.split('/').pop().split('\\').pop();
                    const extension = tabData.queryType === 'promql' ? '.promql' : '.isql';
                    const fileNameWithExtension = fileName.includes('.') ? fileName : fileName + extension;
                    
                    const result = await window.electronAPI.saveFile(content, fileNameWithExtension);
                    if (result) {
                        Interface.markTabSaved(tabData.id);
                        Interface.showToast('File saved successfully', 'success');
                    }
                }
            } catch (error) {
                console.error('Error saving existing file:', error);
                Interface.showToast('Failed to save file: ' + error.message, 'error');
            }
        } else {
            // Otherwise, show save dialog or download for web
            console.log('No file path or not Electron, calling saveAsCurrentTab');
            console.log('tabData.filePath:', tabData.filePath);
            console.log('this.isElectron:', this.isElectron);
            await this.saveAsCurrentTab();
        }
    },
    
    // Save As for the current tab
    async saveAsCurrentTab() {
        console.log('FileExplorer.saveAsCurrentTab() called');
        console.log('FileExplorer.isElectron:', this.isElectron);
        
        const tabId = Interface.activeTab;
        const tabData = Interface.tabs.get(tabId);
        
        if (!tabData) {
            console.log('No tab data found, returning');
            return;
        }
        
        // Get the content
        const content = tabData.editor ? tabData.editor.getValue() : '';
        if (!content.trim()) {
            console.log('No content to save');
            Interface.showToast('Nothing to save', 'warning');
            return;
        }
        
        if (!this.isElectron) {
            // For web version, download the file
            console.log('Not Electron, calling downloadCurrentTab()');
            this.downloadCurrentTab();
            return;
        }
        
        console.log('Is Electron, attempting to use native file dialog');
        
        // For Electron version, try to use file save dialog
        try {
            // Determine file extension based on query type
            const extension = tabData.queryType === 'promql' ? '.promql' : '.isql';
            const defaultName = tabData.label.replace(' •', '') + extension;
            
            let result = null;
            
            // Try different API patterns that might be available
            console.log('Trying Electron APIs...');
            console.log('Available electronAPI methods:', Object.keys(window.electronAPI || {}));
            
            if (window.electronAPI && window.electronAPI.saveFile) {
                console.log('Using window.electronAPI.saveFile');
                console.log('Saving with defaultName:', defaultName);
                console.log('Content length:', content.length);
                
                // Try passing the parameters in correct order: content, filename
                result = await window.electronAPI.saveFile(content, defaultName);
                
                if (result) {
                    console.log('Save result:', result);
                    // Update tab data with file info
                    tabData.filePath = result;
                    tabData.label = result.split('/').pop().split('\\').pop();
                    tabData.saved = true;
                    
                    // Update tab label
                    const tab = document.querySelector(`[data-tab-id="${tabId}"].tab`);
                    if (tab) {
                        const label = tab.querySelector('.tab-label');
                        if (label) {
                            label.textContent = tabData.label;
                        }
                    }
                    
                    Interface.showToast('File saved successfully', 'success');
                    return;
                }
            } else {
                // Fallback to download if no file APIs available
                console.log('No Electron saveFile API found, falling back to download');
                this.downloadCurrentTab();
                return;
            }
        } catch (error) {
            console.error('Error saving file:', error);
            Interface.showToast('Failed to save file: ' + error.message, 'error');
            
            // Fallback to download on error
            console.log('Falling back to download due to error');
            this.downloadCurrentTab();
        }
    },
    
    // Save content to a file
    async saveToFile(filePath, tabData) {
        if (!this.isElectron) return;
        
        const content = tabData.editor ? tabData.editor.getValue() : '';
        
        try {
            // Use the saveFile method directly since it handles both dialog and writing
            const result = await window.electronAPI.saveFile(filePath.split('/').pop().split('\\').pop(), content);
            
            if (result) {
                Interface.markTabSaved(tabData.id);
                Interface.showToast('File saved successfully', 'success');
            } else {
                throw new Error('File save was cancelled or failed');
            }
        } catch (error) {
            console.error('Error writing file:', error);
            Interface.showToast('Failed to save file: ' + error.message, 'error');
        }
    },
    
    // Download file for web version
    downloadCurrentTab() {
        const tabId = Interface.activeTab;
        const tabData = Interface.tabs.get(tabId);
        
        if (!tabData) return;
        
        const content = tabData.editor ? tabData.editor.getValue() : '';
        if (!content.trim()) {
            Interface.showToast('Nothing to download', 'warning');
            return;
        }
        
        // Determine file extension based on query type
        const extension = tabData.queryType === 'promql' ? '.promql' : '.isql';
        const fileName = tabData.label.replace(' •', '') + extension;
        
        // Create blob and download
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Update tab name and mark as saved (simulating file save)
        tabData.label = fileName;
        tabData.saved = true;
        
        // Update tab label in UI
        const tab = document.querySelector(`[data-tab-id="${tabId}"].tab`);
        if (tab) {
            const label = tab.querySelector('.tab-label');
            if (label) {
                label.textContent = fileName;
            }
        }
        
        Interface.showToast(`File downloaded: ${fileName}`, 'success');
    }
};

// Global functions for HTML onclick handlers
function selectQueryDirectory() {
    console.log('selectQueryDirectory called');
    FileExplorer.selectDirectory();
}

function saveQuery() {
    console.log('saveQuery called - routing to FileExplorer.saveCurrentTab()');
    FileExplorer.saveCurrentTab();
}

function saveQueryAs() {
    console.log('saveQueryAs called - routing to FileExplorer.saveAsCurrentTab()');
    FileExplorer.saveAsCurrentTab();
}

function debugFileExplorer() {
    console.log('=== FILE EXPLORER DEBUG ===');
    FileExplorer.debugLastDirectory();
    console.log('isElectron:', FileExplorer.isElectron);
    console.log('currentDirectory:', FileExplorer.currentDirectory);
    console.log('Available window.electronAPI:', window.electronAPI ? Object.keys(window.electronAPI) : 'Not available');
    console.log('========================');
}