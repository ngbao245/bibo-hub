// Global Keyboard Shortcuts System
// Allows opening modals from any page with keyboard shortcuts

// Shortcuts config is loaded from shortcuts-config.js
const GLOBAL_SHORTCUTS = SHORTCUTS_CONFIG;

// Track which modals are currently open
let openModals = [];

// Close all modals
function closeAllModals() {
    // Close standard modals
    const modals = document.querySelectorAll('.modal.show');
    modals.forEach(modal => {
        modal.classList.remove('show');
    });
    
    // Close shortcuts modal
    const shortcutsModal = document.querySelector('.shortcuts-modal.show');
    if (shortcutsModal) {
        shortcutsModal.classList.remove('show');
    }
    
    // Close sources modal
    const sourcesModal = document.querySelector('.sources-modal.show');
    if (sourcesModal) {
        sourcesModal.classList.remove('show');
    }
    
    openModals = [];
}

// Keyboard event handler
document.addEventListener('keydown', (e) => {
    // Build shortcut string
    let shortcut = '';
    if (e.ctrlKey) shortcut += 'ctrl+';
    if (e.shiftKey) shortcut += 'shift+';
    if (e.altKey) shortcut += 'alt+';
    shortcut += e.key.toLowerCase();
    
    // Check if shortcut exists
    const action = GLOBAL_SHORTCUTS[shortcut];
    if (action && typeof window[action.action] === 'function') {
        e.preventDefault();
        window[action.action]();
    }
});

// Click outside to close modal
document.addEventListener('click', (e) => {
    // Check if clicked element is a modal backdrop
    if (e.target.classList.contains('modal') && e.target.classList.contains('show')) {
        e.target.classList.remove('show');
    }
    
    // Check for shortcuts modal
    if (e.target.classList.contains('shortcuts-modal') && e.target.classList.contains('show')) {
        e.target.classList.remove('show');
    }
    
    // Check for sources modal
    if (e.target.classList.contains('sources-modal') && e.target.classList.contains('show')) {
        e.target.classList.remove('show');
    }
});

// Navigation functions
function openNotes() {
    // Detect current path
    const isSubPage = window.location.pathname.includes('/notes/') || 
                      window.location.pathname.includes('/tasks/') ||
                      window.location.pathname.includes('/sources/') ||
                      window.location.pathname.includes('/project-packer/');
    
    if (isSubPage) {
        window.location.href = '../notes/notes.html';
    } else {
        window.location.href = './notes/notes.html';
    }
}

function openTasks() {
    // Detect current path
    const isSubPage = window.location.pathname.includes('/notes/') || 
                      window.location.pathname.includes('/tasks/') ||
                      window.location.pathname.includes('/sources/') ||
                      window.location.pathname.includes('/project-packer/');
    
    if (isSubPage) {
        window.location.href = '../tasks/tasks.html';
    } else {
        window.location.href = './tasks/tasks.html';
    }
}
