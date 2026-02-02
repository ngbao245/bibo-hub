// Rich Text Editor for Notes App
class RichTextEditor {
    constructor(container, initialContent = '', onSave, noteData = {}) {
        this.container = container;
        this.onSave = onSave;
        this.editor = null;
        this.initialContent = initialContent; // Store initial content for comparison
        this.timerInterval = null;
        this.timerSeconds = parseInt(noteData.timerDuration) || 0; // Restore timer duration from string
        this.timerRunning = false;
        this.wordCountActive = noteData.wordCountEnabled || false; // Restore word count state
        this.wordCountInterval = null;
        this.noteData = noteData; // Store note data for saving state
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
                        <div class="richtext-stats">
                            <button class="word-count-btn" data-action="word-count" title="• Selected text \n• Text between &#96;&#96; markers, \n• All text">
                                <span class="word-count-display">-- words</span>
                            </button>
                            <span class="toolbar-separator">|</span>
                            <button class="timer-btn" data-action="timer" title="Click to start/stop timer">⏱ 00:00</button>
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
        
        // Setup code block buttons for existing code blocks
        this.setupCodeBlockButtons();
        
        // Restore word count state if it was active
        if (this.wordCountActive) {
            this.startWordCount();
        }
        
        // Update timer display with restored duration
        this.updateTimerDisplay();
        
        // Focus editor
        this.editor.focus();
        this.moveCursorToEnd();
    }

    setupCodeBlockButtons() {
        // Find all existing code blocks and attach event listeners to their buttons
        const codeBlockWrappers = this.editor.querySelectorAll('.code-block-wrapper');
        
        codeBlockWrappers.forEach(wrapper => {
            const copyBtn = wrapper.querySelector('.code-copy-btn');
            const pasteBtn = wrapper.querySelector('.code-paste-btn');
            const clearBtn = wrapper.querySelector('.code-clear-btn');
            const codeBlock = wrapper.querySelector('.code-block');
            
            if (copyBtn && codeBlock) {
                copyBtn.onclick = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                        let text = codeBlock.innerText || codeBlock.textContent || '';
                        if (text === '\u200B') text = '';
                        await navigator.clipboard.writeText(text);
                        const originalText = copyBtn.textContent;
                        copyBtn.textContent = 'Copied';
                        setTimeout(() => { copyBtn.textContent = originalText; }, 1500);
                    } catch (err) {
                        console.error('Failed to copy:', err);
                        alert('Cannot copy to clipboard. Please copy manually (Ctrl+C)');
                    }
                };
            }
            
            if (pasteBtn && codeBlock) {
                pasteBtn.onclick = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    try {
                        const text = await navigator.clipboard.readText();
                        codeBlock.innerHTML = '';
                        codeBlock.textContent = text;
                        codeBlock.focus();
                    } catch (err) {
                        console.error('Failed to read clipboard:', err);
                        alert('Cannot access clipboard. Please paste manually (Ctrl+V)');
                    }
                };
            }
            
            if (clearBtn && codeBlock) {
                clearBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    codeBlock.innerHTML = '';
                    codeBlock.textContent = '\u200B';
                    codeBlock.focus();
                };
            }
        });
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
            btn.addEventListener('click', () => this.closeWithConfirmation());
        });

        this.container.querySelectorAll('[data-action="fullscreen"]').forEach(btn => {
            btn.addEventListener('click', () => this.toggleFullscreen());
        });

        this.container.querySelectorAll('[data-action="timer"]').forEach(btn => {
            btn.addEventListener('click', () => this.toggleTimer());
        });

        this.container.querySelectorAll('[data-action="word-count"]').forEach(btn => {
            btn.addEventListener('click', () => this.toggleWordCount());
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
        // Ctrl+C: Copy plain text if inside code block
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                let node = selection.anchorNode;
                let codeBlockElement = null;
                
                // Check if inside code block
                while (node && node !== this.editor) {
                    if (node.classList && node.classList.contains('code-block')) {
                        codeBlockElement = node;
                        break;
                    }
                    node = node.parentNode;
                }
                
                // If inside code block, copy as plain text
                if (codeBlockElement) {
                    e.preventDefault();
                    const selectedText = selection.toString();
                    if (selectedText) {
                        navigator.clipboard.writeText(selectedText).catch(err => {
                            console.error('Failed to copy:', err);
                        });
                    }
                    return;
                }
            }
        }
        // Ctrl+A: Select all in code block if inside one
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                let node = selection.anchorNode;
                let codeBlockElement = null;
                
                // Check if inside code block
                while (node && node !== this.editor) {
                    if (node.classList && node.classList.contains('code-block')) {
                        codeBlockElement = node;
                        break;
                    }
                    node = node.parentNode;
                }
                
                // If inside code block, select all content
                if (codeBlockElement) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const range = document.createRange();
                    range.selectNodeContents(codeBlockElement);
                    selection.removeAllRanges();
                    selection.addRange(range);
                    return;
                }
            }
        }
        // Ctrl+S: Save
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            this.save();
        }
        // Escape: Close with confirmation if content changed
        else if (e.key === 'Escape') {
            this.closeWithConfirmation();
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
        // Tab: Insert 4 spaces
        else if (e.key === 'Tab') {
            e.preventDefault();
            document.execCommand('insertText', false, '    ');
        }
        // Backspace/Delete: Handle zero-width space in code blocks
        else if (e.key === 'Backspace' || e.key === 'Delete') {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                let node = selection.anchorNode;
                let codeElement = null;
                
                // Check if inside code block
                while (node && node !== this.editor) {
                    if (node.tagName === 'CODE' && node.parentElement && node.parentElement.classList.contains('code-block')) {
                        codeElement = node;
                        break;
                    }
                    node = node.parentNode;
                }
                
                // If inside code block and content is only zero-width space, clear it
                if (codeElement && codeElement.textContent === '\u200B') {
                    e.preventDefault();
                    codeElement.textContent = '';
                }
            }
        }
        // Enter: Handle line breaks in code blocks
        else if (e.key === 'Enter') {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                let node = selection.anchorNode;
                let isInCodeBlock = false;
                
                // Check if inside code block (check for both <pre> tag and code-block class)
                while (node && node !== this.editor) {
                    if ((node.tagName === 'PRE' && node.classList && node.classList.contains('code-block')) ||
                        (node.tagName === 'CODE' && node.parentElement && node.parentElement.classList && node.parentElement.classList.contains('code-block'))) {
                        isInCodeBlock = true;
                        break;
                    }
                    node = node.parentNode;
                }
                
                // If inside code block, insert plain newline instead of creating new <pre>
                if (isInCodeBlock) {
                    e.preventDefault();
                    document.execCommand('insertText', false, '\n');
                    return;
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
        pasteBtn.setAttribute('contenteditable', 'false');
        pasteBtn.setAttribute('tabindex', '-1');
        pasteBtn.setAttribute('unselectable', 'on');
        pasteBtn.setAttribute('role', 'button');
        pasteBtn.onselectstart = () => false;
        pasteBtn.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };
        pasteBtn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                const text = await navigator.clipboard.readText();
                
                // Traverse to find code block
                let node = pasteBtn;
                let codeBlockElement = null;
                
                while (node && node !== document.body) {
                    if (node.classList && node.classList.contains('code-block')) {
                        codeBlockElement = node;
                        break;
                    }
                    if (node.nextElementSibling && node.nextElementSibling.classList && node.nextElementSibling.classList.contains('code-block')) {
                        codeBlockElement = node.nextElementSibling;
                        break;
                    }
                    node = node.parentElement;
                }
                
                if (codeBlockElement) {
                    codeBlockElement.innerHTML = '';
                    codeBlockElement.textContent = text;
                    codeBlockElement.focus();
                }
            } catch (err) {
                console.error('Failed to read clipboard:', err);
                alert('Cannot access clipboard. Please paste manually (Ctrl+V)');
            }
        };
        
        // Create copy button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'code-copy-btn';
        copyBtn.textContent = 'Copy';
        copyBtn.setAttribute('contenteditable', 'false');
        copyBtn.setAttribute('tabindex', '-1');
        copyBtn.setAttribute('unselectable', 'on');
        copyBtn.setAttribute('role', 'button');
        copyBtn.onselectstart = () => false;
        copyBtn.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };
        copyBtn.onclick = async (e) => {
            console.log('=== COPY BUTTON CLICKED ===');
            e.preventDefault();
            e.stopPropagation();
            try {
                // Traverse up from button to find code-block (same logic as Ctrl+A)
                let node = copyBtn;
                let codeBlockElement = null;
                
                console.log('Starting from:', node);
                
                while (node && node !== document.body) {
                    console.log('Checking node:', node, 'classList:', node.classList);
                    
                    if (node.classList && node.classList.contains('code-block')) {
                        codeBlockElement = node;
                        console.log('Found code-block via parent!');
                        break;
                    }
                    // Also check siblings
                    if (node.nextElementSibling) {
                        console.log('Checking sibling:', node.nextElementSibling);
                        if (node.nextElementSibling.classList && node.nextElementSibling.classList.contains('code-block')) {
                            codeBlockElement = node.nextElementSibling;
                            console.log('Found code-block via sibling!');
                            break;
                        }
                    }
                    node = node.parentElement;
                }
                
                console.log('Final code block:', codeBlockElement);
                
                if (codeBlockElement) {
                    // Get ALL text from code block
                    let text = codeBlockElement.innerText || codeBlockElement.textContent || '';
                    console.log('Text to copy:', text.substring(0, 100));
                    
                    if (text === '\u200B') {
                        text = '';
                    }
                    await navigator.clipboard.writeText(text);
                    console.log('COPY SUCCESS!');
                    
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = 'Copied';
                    setTimeout(() => {
                        copyBtn.textContent = originalText;
                    }, 1500);
                } else {
                    console.log('CODE BLOCK NOT FOUND!');
                }
            } catch (err) {
                console.error('Failed to copy:', err);
                alert('Cannot copy to clipboard. Please copy manually (Ctrl+C)');
            }
        };
        
        // Create clear button for code block
        const clearBtn = document.createElement('button');
        clearBtn.className = 'code-clear-btn';
        clearBtn.textContent = 'Clear';
        clearBtn.setAttribute('contenteditable', 'false');
        clearBtn.setAttribute('tabindex', '-1');
        clearBtn.setAttribute('unselectable', 'on');
        clearBtn.setAttribute('role', 'button');
        clearBtn.onselectstart = () => false;
        clearBtn.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };
        clearBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Traverse to find code block
            let node = clearBtn;
            let codeBlockElement = null;
            
            while (node && node !== document.body) {
                if (node.classList && node.classList.contains('code-block')) {
                    codeBlockElement = node;
                    break;
                }
                if (node.nextElementSibling && node.nextElementSibling.classList && node.nextElementSibling.classList.contains('code-block')) {
                    codeBlockElement = node.nextElementSibling;
                    break;
                }
                node = node.parentElement;
            }
            
            if (codeBlockElement) {
                codeBlockElement.innerHTML = '';
                codeBlockElement.textContent = '\u200B';
                codeBlockElement.focus();
            }
        };
        
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
        const btn = this.container.querySelector('[data-action="fullscreen"]');
        
        if (modal.classList.contains('fullscreen')) {
            modal.classList.remove('fullscreen');
            btn.innerHTML = '⛶';
            btn.title = 'Fullscreen';
        } else {
            modal.classList.add('fullscreen');
            btn.innerHTML = '🗗';
            btn.title = 'Exit Fullscreen';
        }
        
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

    hasContentChanged() {
        const currentContent = this.getContent();
        const initialContent = this.sanitizeContent(this.initialContent);
        
        // Normalize both contents for comparison (remove extra whitespace)
        const normalize = (html) => {
            return html.replace(/\s+/g, ' ').trim();
        };
        
        return normalize(currentContent) !== normalize(initialContent);
    }

    closeWithConfirmation() {
        // Check if content has changed
        if (this.hasContentChanged()) {
            const confirmed = confirm('You have unsaved changes. Are you sure you want to close?');
            if (!confirmed) {
                return; // Don't close if user cancels
            }
        }
        this.close();
    }

    save() {
        const content = this.getContent();
        if (this.onSave) {
            // Include word count state and timer duration in save
            const editorState = {
                wordCountEnabled: this.wordCountActive,
                timerDuration: this.timerSeconds.toString() // Convert to string
            };
            this.onSave(content, editorState);
        }
        this.close();
    }

    toggleWordCount() {
        if (this.wordCountActive) {
            this.stopWordCount();
        } else {
            this.startWordCount();
        }
    }

    startWordCount() {
        this.wordCountActive = true;
        const wordCountBtn = this.container.querySelector('[data-action="word-count"]');
        
        // Update immediately
        this.updateWordCount();
        
        // Update every time user types
        this.wordCountInterval = setInterval(() => {
            this.updateWordCount();
        }, 500);
        
        if (wordCountBtn) {
            wordCountBtn.classList.add('word-count-active');
        }
    }

    stopWordCount() {
        this.wordCountActive = false;
        
        if (this.wordCountInterval) {
            clearInterval(this.wordCountInterval);
            this.wordCountInterval = null;
        }
        
        const wordCountBtn = this.container.querySelector('[data-action="word-count"]');
        const wordCountDisplay = this.container.querySelector('.word-count-display');
        
        if (wordCountBtn) {
            wordCountBtn.classList.remove('word-count-active');
        }
        
        if (wordCountDisplay) {
            wordCountDisplay.textContent = '-- words';
        }
    }

    updateWordCount() {
        if (!this.wordCountActive) return;
        
        let text = '';
        const selection = window.getSelection();
        
        // Priority 1: If text is selected, count selected text
        if (selection && selection.toString().trim().length > 0) {
            text = selection.toString();
        } 
        // Priority 2: If content has `` markers, count text between them
        else {
            const fullText = this.editor.innerText || '';
            const markerRegex = /``([\s\S]*?)``/;
            const match = fullText.match(markerRegex);
            
            if (match && match[1]) {
                text = match[1];
            } else {
                // Priority 3: Count all text
                text = fullText;
            }
        }
        
        // Remove zero-width space and other invisible characters before counting
        text = text.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');
        
        const words = text.trim().split(/\s+/).filter(word => word.length > 0);
        const count = words.length;
        
        const wordCountDisplay = this.container.querySelector('.word-count-display');
        if (wordCountDisplay) {
            wordCountDisplay.textContent = `${count} ${count === 1 ? 'word' : 'words'}`;
        }
    }

    toggleTimer() {
        if (this.timerRunning) {
            this.stopTimer();
        } else {
            this.startTimer();
        }
    }

    startTimer() {
        this.timerRunning = true;
        const timerBtn = this.container.querySelector('[data-action="timer"]');
        
        this.timerInterval = setInterval(() => {
            this.timerSeconds++;
            this.updateTimerDisplay();
        }, 1000);
        
        if (timerBtn) {
            timerBtn.classList.add('timer-running');
        }
    }

    stopTimer() {
        this.timerRunning = false;
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        const timerBtn = this.container.querySelector('[data-action="timer"]');
        if (timerBtn) {
            timerBtn.classList.remove('timer-running');
        }
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timerSeconds / 60);
        const seconds = this.timerSeconds % 60;
        const display = `⏱ ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        const timerBtn = this.container.querySelector('[data-action="timer"]');
        if (timerBtn) {
            timerBtn.textContent = display;
        }
    }

    close() {
        // Stop timer when closing
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        // Stop word count when closing
        if (this.wordCountInterval) {
            clearInterval(this.wordCountInterval);
        }
        this.container.innerHTML = '';
    }
}

// Export for use in app.js
window.RichTextEditor = RichTextEditor;
