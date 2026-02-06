// Hub Keyboard Shortcuts Configuration
// Easy to customize and maintain

const HUB_SHORTCUTS = {
    // Format: 'key combination': { name: 'Display Name', action: 'function name' }
    
    // Tools
    'ctrl+t': { name: 'Translate', action: 'openTranslateModal' },
    'ctrl+c': { name: 'Calculator', action: 'openCalculatorModal' },
    'ctrl+shift+t': { name: 'Timer', action: 'openTimer' },
    'ctrl+n': { name: 'Notes', action: 'openNotes' },
    'ctrl+e': { name: 'Encoder', action: 'openEncoderModal' },
    'ctrl+shift+c': { name: 'Color Picker', action: 'openColor' },
    'ctrl+q': { name: 'QR Code', action: 'openQR' },
    'ctrl+j': { name: 'JSON Formatter', action: 'openJSON' },
    'ctrl+m': { name: 'Markdown Preview', action: 'openMarkdown' },
    'ctrl+u': { name: 'Unit Converter', action: 'openUnit' },
    'ctrl+b': { name: 'Backup', action: 'openBackupModal' },
    'ctrl+p': { name: 'Sources', action: 'openSourcesModal' },
    
    // Modal controls
    'escape': { name: 'Close Modal', action: 'closeAllModals' },
    'ctrl+shift+k': { name: 'Show Shortcuts', action: 'showShortcutsModal' },
};

// Shortcut handler
function initHubShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Build key combination string
        let combo = [];
        if (e.ctrlKey) combo.push('ctrl');
        if (e.altKey) combo.push('alt');
        if (e.shiftKey) combo.push('shift');
        combo.push(e.key.toLowerCase());
        
        const keyCombo = combo.join('+');
        
        // Check if this combo is registered
        if (HUB_SHORTCUTS[keyCombo]) {
            const shortcut = HUB_SHORTCUTS[keyCombo];
            const functionName = shortcut.action;
            
            // Call the function if it exists
            if (typeof window[functionName] === 'function') {
                e.preventDefault();
                window[functionName]();
            } else {
                console.warn(`Function ${functionName} not found for shortcut ${keyCombo}`);
            }
        }
    });
    
    console.log('🎹 Hub shortcuts initialized');
}

// Show shortcuts modal
function showShortcutsModal() {
    const modal = document.getElementById('shortcutsModal');
    if (modal) {
        modal.classList.add('show');
        renderShortcutsList();
    }
}

function closeShortcutsModal() {
    const modal = document.getElementById('shortcutsModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal, .shortcuts-modal, .sources-modal').forEach(m => {
        m.classList.remove('show');
    });
}

// Render shortcuts list in modal
function renderShortcutsList() {
    const container = document.getElementById('shortcutsList');
    if (!container) return;
    
    // Group shortcuts by category
    const tools = [];
    const controls = [];
    
    Object.entries(HUB_SHORTCUTS).forEach(([keys, shortcut]) => {
        const item = { keys, ...shortcut };
        if (keys === 'escape' || keys.includes('shift+k')) {
            controls.push(item);
        } else {
            tools.push(item);
        }
    });
    
    // Render HTML
    let html = '';
    
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
    
    container.innerHTML = html;
}

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

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHubShortcuts);
} else {
    initHubShortcuts();
}
