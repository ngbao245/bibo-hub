// Rich Text Editor for Notes App
class RichTextEditor {
    constructor(container, initialContent = '', onSave) {
        this.container = container;
        this.onSave = onSave;
        this.editor = null;
        this.init(initialContent);
    }

    init(content) {
        // Create editor HTML
        this.container.innerHTML = `
            <div class="richtext-modal">
                <div class="richtext-modal-content">
                    <div class="richtext-header">
                        <h3>Edit Content</h3>
                        <div class="richtext-toolbar">
                            <button class="btn-toolbar" data-command="bold" title="Bold (Ctrl+B)"><strong>B</strong></button>
                            <button class="btn-toolbar" data-command="italic" title="Italic (Ctrl+I)"><em>I</em></button>
                            <button class="btn-toolbar" data-command="underline" title="Underline (Ctrl+U)"><u>U</u></button>
                            <span class="toolbar-separator">|</span>
                            <button class="btn-toolbar" data-command="insertUnorderedList" title="Bullet List">• List</button>
                            <button class="btn-toolbar" data-command="insertOrderedList" title="Numbered List">1. List</button>
                        </div>
                        <div class="window-controls">
                            <button class="btn-close" data-action="fullscreen" title="Toggle Fullscreen">⛶</button>
                            <button class="btn-close" data-action="close">×</button>
                        </div>
                    </div>
                    <div class="richtext-editor" contenteditable="true" id="richtextEditor"></div>
                    <div class="richtext-actions">
                        <button class="btn btn-primary" data-action="save">Save</button>
                        <button class="btn" data-action="close">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        this.editor = this.container.querySelector('#richtextEditor');
        
        // Set content safely
        if (content) {
            this.editor.innerHTML = this.sanitizeContent(content);
        }
        
        this.setupEventListeners();
        
        // Focus editor
        this.editor.focus();
        this.moveCursorToEnd();
    }

    setupEventListeners() {
        // Toolbar buttons
        this.container.querySelectorAll('[data-command]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const command = btn.dataset.command;
                this.execCommand(command);
            });
        });

        // Action buttons
        this.container.querySelectorAll('[data-action="save"]').forEach(btn => {
            btn.addEventListener('click', () => this.save());
        });

        this.container.querySelectorAll('[data-action="close"]').forEach(btn => {
            btn.addEventListener('click', () => this.close());
        });

        this.container.querySelectorAll('[data-action="fullscreen"]').forEach(btn => {
            btn.addEventListener('click', () => this.toggleFullscreen());
        });

        // Keyboard shortcuts
        this.editor.addEventListener('keydown', (e) => this.handleKeydown(e));
        
        // Update toolbar state on selection change
        this.editor.addEventListener('keyup', () => this.updateToolbar());
        this.editor.addEventListener('mouseup', () => this.updateToolbar());
        this.editor.addEventListener('focus', () => this.updateToolbar());

        // Click outside to close - REMOVED (don't close on outside click)
        // User must click Cancel or X button to close
    }

    handleKeydown(e) {
        // Ctrl+S: Save
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            this.save();
        }
        // Escape: Close
        else if (e.key === 'Escape') {
            this.close();
        }
        // F11: Toggle fullscreen
        else if (e.key === 'F11') {
            e.preventDefault();
            this.toggleFullscreen();
        }
        // Ctrl+B: Bold
        else if (e.ctrlKey && e.key === 'b') {
            e.preventDefault();
            this.execCommand('bold');
        }
        // Ctrl+I: Italic
        else if (e.ctrlKey && e.key === 'i') {
            e.preventDefault();
            this.execCommand('italic');
        }
        // Ctrl+U: Underline
        else if (e.ctrlKey && e.key === 'u') {
            e.preventDefault();
            this.execCommand('underline');
        }
        // Tab: Insert 4 spaces
        else if (e.key === 'Tab') {
            e.preventDefault();
            document.execCommand('insertText', false, '    ');
        }
    }

    execCommand(command) {
        document.execCommand(command, false, null);
        this.editor.focus();
        this.updateToolbar();
    }
    
    updateToolbar() {
        // Update button states based on current selection
        const commands = ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList'];
        
        commands.forEach(command => {
            const btn = this.container.querySelector(`[data-command="${command}"]`);
            if (btn) {
                if (document.queryCommandState(command)) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });
    }

    moveCursorToEnd() {
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(this.editor);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    toggleFullscreen() {
        const modal = this.container.querySelector('.richtext-modal');
        const content = this.container.querySelector('.richtext-modal-content');
        const btn = this.container.querySelector('[data-action="fullscreen"]');
        
        if (modal.classList.contains('fullscreen')) {
            // Exit fullscreen
            modal.classList.remove('fullscreen');
            btn.innerHTML = '⛶';
            btn.title = 'Fullscreen';
        } else {
            // Enter fullscreen
            modal.classList.add('fullscreen');
            btn.innerHTML = '🗗';
            btn.title = 'Exit Fullscreen';
        }
        
        // Refocus editor after toggle
        setTimeout(() => {
            this.editor.focus();
        }, 100);
    }

    getContent() {
        return this.editor.innerHTML;
    }

    sanitizeContent(content) {
        if (!content) return '';
        
        try {
            // Create a temporary div to parse and clean HTML
            const temp = document.createElement('div');
            temp.innerHTML = content;
            
            // Remove script tags and other dangerous elements
            const dangerousElements = temp.querySelectorAll('script, iframe, object, embed, link, meta, style');
            dangerousElements.forEach(el => el.remove());
            
            // Remove dangerous attributes
            const allElements = temp.querySelectorAll('*');
            allElements.forEach(el => {
                // Keep only safe attributes
                const safeAttributes = ['class', 'style'];
                const attributes = [...el.attributes];
                attributes.forEach(attr => {
                    if (!safeAttributes.includes(attr.name.toLowerCase()) && 
                        !attr.name.startsWith('data-')) {
                        el.removeAttribute(attr.name);
                    }
                });
            });
            
            // Clean up malformed HTML by getting innerHTML again
            return temp.innerHTML;
        } catch (error) {
            console.error('Error sanitizing content:', error);
            // If sanitization fails, return plain text
            const temp = document.createElement('div');
            temp.textContent = content;
            return temp.innerHTML;
        }
    }

    save() {
        const content = this.getContent();
        if (this.onSave) {
            this.onSave(content);
        }
        this.close();
    }

    close() {
        this.container.innerHTML = '';
    }
}

// Export for use in app.js
window.RichTextEditor = RichTextEditor;
