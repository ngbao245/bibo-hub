// Shortcuts Modal Loader
let shortcutsModalLoaded = false;

async function loadShortcutsModal() {
    if (shortcutsModalLoaded) return;
    
    try {
        // Detect current path
        const basePath = window.location.pathname.includes('/notes/') || 
                         window.location.pathname.includes('/tasks/') ? '../' : './';
        
        // Load CSS first and wait for it
        if (!document.querySelector('link[href*="shortcuts-modal.css"]')) {
            await new Promise((resolve) => {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = basePath + 'shortcuts-modal.css';
                link.onload = resolve;
                document.head.appendChild(link);
            });
        }
        
        // Then inject HTML after CSS is loaded
        const html = `
            <div id="shortcutsModal" class="shortcuts-modal">
                <div class="shortcuts-modal-content">
                    <div class="shortcuts-modal-header">
                        <div class="shortcuts-modal-title">⌨️ Keyboard Shortcuts</div>
                        <button class="shortcuts-modal-close-btn" onclick="closeShortcutsModal()">×</button>
                    </div>
                    <div class="shortcuts-modal-body">
                        <div id="shortcutsList"></div>
                    </div>
                    <div class="shortcuts-footer">
                        Press <strong>Alt+K</strong> to toggle this window
                    </div>
                </div>
            </div>
        `;
        
        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container.firstElementChild);
        
        shortcutsModalLoaded = true;
    } catch (error) {
        console.error('Error loading shortcuts modal:', error);
    }
}

// Lazy open function with toggle
async function openShortcutsModalLazy() {
    // Load modal first if not loaded
    await loadShortcutsModal();
    
    const modal = document.getElementById('shortcutsModal');
    
    // Toggle: if open, close it
    if (modal && modal.classList.contains('show')) {
        modal.classList.remove('show');
    } else if (modal) {
        // Otherwise open it
        modal.classList.add('show');
        renderAllShortcutsList();
    }
}

// Render all shortcuts list (hub shortcuts + rich text editor)
function renderAllShortcutsList() {
    const container = document.getElementById('shortcutsList');
    if (!container) return;
    
    // Get shortcuts from shortcuts-config.js
    const shortcuts = typeof SHORTCUTS_CONFIG !== 'undefined' ? SHORTCUTS_CONFIG : {};
    
    // Group shortcuts by category
    const tools = [];
    const controls = [];
    
    Object.entries(shortcuts).forEach(([keys, shortcut]) => {
        const item = { keys, ...shortcut };
        if (keys === 'escape' || keys.includes('alt+k')) {
            controls.push(item);
        } else {
            tools.push(item);
        }
    });
    
    let html = '';
    
    // Tools section
    if (tools.length > 0) {
        html += `
            <div class="shortcuts-section">
                <div class="shortcuts-section-title">Tools</div>
                <div class="shortcuts-list">
                    ${tools.map(item => renderShortcutItem(item)).join('')}
                </div>
            </div>
        `;
    }
    
    // Controls section
    if (controls.length > 0) {
        html += `
            <div class="shortcuts-section">
                <div class="shortcuts-section-title">Controls</div>
                <div class="shortcuts-list">
                    ${controls.map(item => renderShortcutItem(item)).join('')}
                </div>
            </div>
        `;
    }
    
    // Rich text editor shortcuts
    html += `
        <div class="shortcuts-section">
            <div class="shortcuts-section-title">Rich Text Editor</div>
            <div class="shortcuts-list">
                <div class="shortcut-item">
                    <span class="shortcut-name">Bold</span>
                    <div class="shortcut-keys"><span class="shortcut-key">Ctrl</span><span class="shortcut-plus">+</span><span class="shortcut-key">B</span></div>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-name">Italic</span>
                    <div class="shortcut-keys"><span class="shortcut-key">Ctrl</span><span class="shortcut-plus">+</span><span class="shortcut-key">I</span></div>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-name">Underline</span>
                    <div class="shortcut-keys"><span class="shortcut-key">Ctrl</span><span class="shortcut-plus">+</span><span class="shortcut-key">U</span></div>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-name">Save & Close</span>
                    <div class="shortcut-keys"><span class="shortcut-key">Ctrl</span><span class="shortcut-plus">+</span><span class="shortcut-key">S</span></div>
                </div>
                <div class="shortcut-item">
                    <span class="shortcut-name">Fullscreen</span>
                    <div class="shortcut-keys"><span class="shortcut-key">F11</span></div>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// Render single shortcut item
function renderShortcutItem(item) {
    const keys = item.keys.split('+').map(k => {
        // Format key names
        if (k === 'ctrl') return 'Ctrl';
        if (k === 'alt') return 'Alt';
        if (k === 'shift') return 'Shift';
        if (k === 'escape') return 'Esc';
        return k.toUpperCase();
    });
    
    const keysHtml = keys.map(k => `<span class="shortcut-key">${k}</span>`).join('<span class="shortcut-plus">+</span>');
    
    return `
        <div class="shortcut-item">
            <span class="shortcut-name">${item.name}</span>
            <div class="shortcut-keys">${keysHtml}</div>
        </div>
    `;
}

// Close function
function closeShortcutsModal() {
    const modal = document.getElementById('shortcutsModal');
    if (modal) {
        modal.classList.remove('show');
    }
}
