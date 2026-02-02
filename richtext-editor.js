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
                            <span class="toolbar-separator">|</span>
                            <button class="btn-toolbar" data-command="code" title="Code Block">&lt;/&gt;</button>
                            <button class="btn-toolbar" data-command="clearAll" title="Clear All Content">Clear</button>
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
        // Ctrl+Shift+C: Code Block
        else if (e.ctrlKey && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            this.insertCodeBlock();
        }
        // Tab: Insert 4 spaces (or handle in code block)
        else if (e.key === 'Tab') {
            e.preventDefault();
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                let node = selection.anchorNode;
                let isInCodeBlock = false;
                
                // Check if inside code block
                while (node && node !== this.editor) {
                    if (node.classList && node.classList.contains('code-block')) {
                        isInCodeBlock = true;
                        break;
                    }
                    node = node.parentNode;
                }
                
                // In code block, insert tab
                if (isInCodeBlock) {
                    document.execCommand('insertText', false, '    ');
                } else {
                    document.execCommand('insertText', false, '    ');
                }
            }
        }
    }

    execCommand(command) {
        if (command === 'code') {
            this.insertCodeBlock();
        } else if (command === 'clearAll') {
            if (confirm('Are you sure you want to clear all content?')) {
                this.editor.innerHTML = '';
                this.editor.focus();
            }
            return;
        } else {
            document.execCommand(command, false, null);
        }
        this.editor.focus();
        this.updateToolbar();
    }

    insertCodeBlock() {
        const selection = window.getSelection();
        const selectedText = selection.toString();
        
        // Create line break before code block
        const brBefore = document.createElement('br');
        
        // Create code block wrapper
        const codeBlockWrapper = document.createElement('div');
        codeBlockWrapper.className = 'code-block-wrapper';
        
        // Create paste button
        const pasteBtn = document.createElement('button');
        pasteBtn.className = 'code-paste-btn';
        pasteBtn.textContent = 'Paste';
        pasteBtn.contentEditable = 'false';
        pasteBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                const text = await navigator.clipboard.readText();
                const codeElement = codeBlockWrapper.querySelector('code');
                codeElement.textContent = text;
                codeElement.focus();
            } catch (err) {
                console.error('Failed to read clipboard:', err);
                alert('Cannot access clipboard. Please paste manually (Ctrl+V)');
            }
        });
        
        // Create copy button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'code-copy-btn';
        copyBtn.textContent = 'Copy';
        copyBtn.contentEditable = 'false';
        copyBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                const codeElement = codeBlockWrapper.querySelector('code');
                let text = codeElement.textContent;
                // Remove zero-width space if exists
                if (text === '\u200B') {
                    text = '';
                }
                await navigator.clipboard.writeText(text);
                // Visual feedback with fixed width
                copyBtn.style.minWidth = copyBtn.offsetWidth + 'px';
                const originalText = copyBtn.textContent;
                copyBtn.textContent = '✓ Copied';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                    copyBtn.style.minWidth = '';
                }, 1500);
            } catch (err) {
                console.error('Failed to copy:', err);
                alert('Cannot copy to clipboard. Please copy manually (Ctrl+C)');
            }
        });
        
        // Create clear button for code block
        const clearBtn = document.createElement('button');
        clearBtn.className = 'code-clear-btn';
        clearBtn.textContent = 'Clear';
        clearBtn.contentEditable = 'false';
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const codeElement = codeBlockWrapper.querySelector('code');
            codeElement.textContent = '\u200B';
            codeElement.focus();
        });
        
        // Create code block element
        const codeBlock = document.createElement('pre');
        codeBlock.className = 'code-block';
        codeBlock.contentEditable = 'true';
        
        const code = document.createElement('code');
        // Use zero-width space to make empty code block clickable
        code.textContent = selectedText || '\u200B';
        codeBlock.appendChild(code);
        
        // Assemble wrapper
        codeBlockWrapper.appendChild(copyBtn);
        codeBlockWrapper.appendChild(pasteBtn);
        codeBlockWrapper.appendChild(clearBtn);
        codeBlockWrapper.appendChild(codeBlock);
        
        // Create line break after code block
        const brAfter = document.createElement('br');
        
        // Insert code block
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            
            // Insert: line break + code block wrapper + line break
            range.insertNode(brAfter);
            range.insertNode(codeBlockWrapper);
            range.insertNode(brBefore);
            
            // Move cursor inside code block
            const newRange = document.createRange();
            const codeContent = codeBlock.querySelector('code');
            newRange.selectNodeContents(codeContent);
            newRange.collapse(false);
            selection.removeAllRanges();
            selection.addRange(newRange);
        }
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
        
        // Check if cursor is inside code block
        const codeBtn = this.container.querySelector('[data-command="code"]');
        if (codeBtn) {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                let node = selection.anchorNode;
                let isInCodeBlock = false;
                
                // Traverse up to check if inside code block
                while (node && node !== this.editor) {
                    if (node.classList && node.classList.contains('code-block')) {
                        isInCodeBlock = true;
                        break;
                    }
                    node = node.parentNode;
                }
                
                if (isInCodeBlock) {
                    codeBtn.classList.add('active');
                } else {
                    codeBtn.classList.remove('active');
                }
            }
        }
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
