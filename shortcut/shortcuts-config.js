// Keyboard Shortcuts Configuration
// Single source of truth for all shortcuts

const SHORTCUTS_CONFIG = {
    // Tools (using Alt to avoid browser conflicts)
    'alt+t': { name: 'Translate', action: 'openTranslateModalLazy' },
    'alt+c': { name: 'Calculator', action: 'openCalculatorModalLazy' },
    'alt+e': { name: 'Encoder', action: 'openEncoderModalLazy' },
    'alt+b': { name: 'Backup', action: 'openBackupModalLazy' },
    'alt+k': { name: 'Shortcuts', action: 'openShortcutsModalLazy' },
    
    // Navigation
    'alt+n': { name: 'Notes', action: 'openNotes' },
    'alt+d': { name: 'Tasks', action: 'openTasks' },
    
    // Future features (not yet implemented)
    'alt+shift+t': { name: 'Timer', action: 'openTimer' },
    'alt+shift+c': { name: 'Color Picker', action: 'openColor' },
    'alt+q': { name: 'QR Code', action: 'openQR' },
    'alt+j': { name: 'JSON Formatter', action: 'openJSON' },
    'alt+m': { name: 'Markdown Preview', action: 'openMarkdown' },
    'alt+u': { name: 'Unit Converter', action: 'openUnit' },
    'alt+p': { name: 'Sources', action: 'openSourcesModal' },
    
    // Controls
    'escape': { name: 'Close Modal', action: 'closeAllModals' },
};
