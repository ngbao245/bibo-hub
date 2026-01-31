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
                        <button class="btn-close" data-action="close">×</button>
                    </div>
                    <div class="richtext-editor" contenteditable="true" id="richtextEditor">${content}</div>
                    <div class="richtext-actions">
                        <button class="btn btn-primary" data-action="save">Save</button>
                        <button class="btn" data-action="close">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        this.editor = this.container.querySelector('#richtextEditor');
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

    getContent() {
        return this.editor.innerHTML;
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
