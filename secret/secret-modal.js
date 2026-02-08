// Secret Notes Modal Logic

const SECRET_PASSWORD_ENCODED = 'MzAwMkBvYmlib2FC';
let secretNotesUnlocked = false;
let secretNotes = [];
let currentSecretNote = null;

function openSecretModal() {
    const modal = document.getElementById('secretModal');
    if (modal) {
        modal.classList.add('show');
        if (!secretNotesUnlocked) {
            showPasswordPrompt();
        } else {
            showSecretNotesApp();
        }
        
        // Add ESC key listener
        document.addEventListener('keydown', handleSecretModalEscape);
    }
}

function handleSecretModalEscape(e) {
    if (e.key === 'Escape') {
        closeSecretModal();
    }
}

function closeSecretModal() {
    const modal = document.getElementById('secretModal');
    if (modal) {
        modal.classList.remove('show');
        secretNotesUnlocked = false;
        
        // Remove ESC key listener
        document.removeEventListener('keydown', handleSecretModalEscape);
    }
}

function showPasswordPrompt() {
    const modalBody = document.querySelector('#secretModal .secret-modal-body');
    if (!modalBody) return;
    
    modalBody.innerHTML = `
        <div class="secret-password-prompt">
            <h2>🔒 Secret Notes</h2>
            <p>Enter password to access your secret notes</p>
            <div class="password-input-wrapper">
                <input type="password" id="secretPasswordInput" class="secret-password-input" placeholder="Enter password..." autofocus>
                <button type="button" class="toggle-password-btn" onclick="togglePasswordVisibility()" title="Show password">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </button>
            </div>
            <div id="secretPasswordError" class="secret-password-error">Incorrect password</div>
            <button onclick="verifyPassword()" class="secret-password-btn">Unlock</button>
        </div>
    `;
    
    const input = document.getElementById('secretPasswordInput');
    if (input) {
        input.focus();
        input.onkeydown = (e) => {
            if (e.key === 'Enter') verifyPassword();
            if (e.key === 'Escape') closeSecretModal();
        };
    }
}

function togglePasswordVisibility() {
    const input = document.getElementById('secretPasswordInput');
    const btn = document.querySelector('.toggle-password-btn');
    if (!input || !btn) return;
    
    // Toggle type immediately for instant feedback
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    
    // Update icon with requestAnimationFrame for smooth transition
    if (isPassword) {
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
            </svg>
        `;
        btn.title = 'Hide password';
    } else {
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
        `;
        btn.title = 'Show password';
    }
}

function verifyPassword() {
    const input = document.getElementById('secretPasswordInput');
    const error = document.getElementById('secretPasswordError');
    const btn = document.querySelector('.secret-password-btn');
    const password = input.value;
    
    // Disable button to prevent double-click
    if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.6';
    }
    
    const decoded = atob(SECRET_PASSWORD_ENCODED);
    const correctPassword = decoded.split('').reverse().join('');
    
    if (password === correctPassword) {
        error.style.display = 'none';
        secretNotesUnlocked = true;
        showSecretNotesApp();
    } else {
        error.style.display = 'block';
        input.value = '';
        input.focus();
        
        // Re-enable button
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
        }
        
        // Shake animation for error feedback
        input.style.animation = 'shake 0.3s ease';
        setTimeout(() => {
            input.style.animation = '';
        }, 300);
    }
}

async function showSecretNotesApp() {
    const modalBody = document.querySelector('#secretModal .secret-modal-body');
    if (!modalBody) return;
    
    // Show loading state immediately
    modalBody.innerHTML = `
        <div class="secret-app-container">
            <div class="sidebar">
                <div class="sidebar-header">
                    <h3>🔒 SECRET NOTES</h3>
                    <button class="btn-new" onclick="newSecretNote()">+</button>
                </div>
                <div class="search-box">
                    <div class="search-wrapper">
                        <input type="text" id="secretSearchInput" placeholder="Search..." class="search-input">
                        <button class="btn-clear-search" id="clearSecretSearch" onclick="clearSecretSearch()" style="display: none;">×</button>
                    </div>
                </div>
                <div class="notes-list-container" id="secretNotesList">
                    <div style="padding: 20px; text-align: center; color: #858585;">Loading...</div>
                </div>
            </div>
            <div class="editor-container">
                <div id="secretEditorView" class="editor-content">
                    <div class="empty-editor">Select a secret note or create a new one</div>
                </div>
            </div>
        </div>
    `;
    
    // Load notes immediately
    await loadSecretNotes();
}

async function loadSecretNotes() {
    try {
        const response = await fetch(API_CONFIG.NOTES);
        const allNotes = await response.json();
        secretNotes = allNotes.filter(n => n.type === 'secret');
        secretNotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        renderSecretNotesList();
    } catch (error) {
        console.error('Error loading secret notes:', error);
        const list = document.getElementById('secretNotesList');
        if (list) list.innerHTML = '<div style="padding: 20px; text-align: center; color: #c5000b;">Error loading notes</div>';
    }
}

function renderSecretNotesList() {
    const list = document.getElementById('secretNotesList');
    if (!list) return;
    
    if (secretNotes.length === 0) {
        list.innerHTML = '<div style="padding: 20px; text-align: center; color: #858585;">No secret notes yet</div>';
        return;
    }
    
    list.innerHTML = secretNotes.map(note => `
        <div class="note-item secret-note-item ${currentSecretNote && currentSecretNote.id === note.id ? 'active' : ''}" onclick="selectSecretNote('${note.id}')">
            <div class="note-item-content">
                <div class="note-item-title">${escapeHtmlSecret(note.title)}</div>
                <div class="note-item-meta">${formatDateSecret(note.createdAt)}</div>
            </div>
            <div class="note-item-actions">
                <button class="btn-icon" onclick="event.stopPropagation(); deleteSecretNote('${note.id}')" title="Delete">×</button>
            </div>
        </div>
    `).join('');
}

function selectSecretNote(id) {
    const note = secretNotes.find(n => n.id === id);
    if (note) {
        currentSecretNote = note;
        showSecretNoteView();
        renderSecretNotesList();
    }
}

function showSecretNoteView() {
    if (!currentSecretNote) return;
    
    const editorView = document.getElementById('secretEditorView');
    if (!editorView) return;
    
    // Parse URLs from url1 field only
    const allUrls = currentSecretNote.url1 
        ? currentSecretNote.url1.split('|').filter(u => u.trim())
        : [];
    
    editorView.innerHTML = `
        <div class="editor-header">
            <div class="editor-title">${escapeHtmlSecret(currentSecretNote.title)}</div>
            <div class="editor-actions">
                <button class="btn" onclick="editSecretNote()">Edit</button>
                <button class="btn btn-danger" onclick="deleteSecretNote('${currentSecretNote.id}')">Delete</button>
            </div>
        </div>
        <div class="view-mode">
            <div class="meta-info">
                <span class="meta-badge">🔒 Secret</span>
                <span class="meta-badge">${formatDateSecret(currentSecretNote.createdAt)}</span>
                ${allUrls.length > 0 ? `<span class="meta-badge">🔗 ${allUrls.length} URL${allUrls.length > 1 ? 's' : ''}</span>` : ''}
            </div>
            
            <div class="content-section">
                <h3>Content</h3>
                <div class="content-text">${currentSecretNote.content || ''}</div>
            </div>
            
            ${allUrls.length > 0 ? `
                <div class="content-section">
                    <h3>URLs</h3>
                    <div class="urls-list">
                        ${allUrls.map((urlData, index) => {
                            const parts = urlData.split('::');
                            const name = parts.length > 1 ? parts[0] : '';
                            const url = parts.length > 1 ? parts[1] : urlData;
                            
                            return `
                            <div class="url-item">
                                <span class="url-index">${index + 1}.</span>
                                <div class="url-content">
                                    ${name ? `<div class="url-name">${escapeHtmlSecret(name)}</div>` : ''}
                                    <a href="${escapeHtmlSecret(url)}" target="_blank" class="url-link">${escapeHtmlSecret(url)}</a>
                                </div>
                            </div>
                        `;
                        }).join('')}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function newSecretNote() {
    currentSecretNote = null;
    showSecretNoteEdit();
}

function editSecretNote() {
    showSecretNoteEdit();
}

function showSecretNoteEdit() {
    const editorView = document.getElementById('secretEditorView');
    if (!editorView) return;
    
    const note = currentSecretNote || {};
    const defaultTitle = `Secret ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    
    // Parse URLs from url1 field only
    const allUrls = note.url1 
        ? note.url1.split('|').filter(u => u.trim())
        : [];
    
    const urls = allUrls.length > 0 ? allUrls : [''];
    
    editorView.innerHTML = `
        <div class="editor-header">
            <div class="editor-title">${note.id ? 'Edit Secret Note' : 'New Secret Note'}</div>
            <div class="editor-actions">
                <button class="btn btn-primary" onclick="saveSecretNote()">Save</button>
                ${note.id ? `<button class="btn" onclick="cancelSecretEdit()">Cancel</button>` : ''}
            </div>
        </div>
        <div class="editor-content">
            <form id="secretNoteForm" onsubmit="event.preventDefault(); saveSecretNote();">
                <div class="form-group">
                    <label>Title</label>
                    <input type="text" id="secretNoteTitle" value="${escapeHtmlSecret(note.title || '')}" placeholder="${note.id ? 'Untitled' : defaultTitle}">
                </div>

                <div class="form-group">
                    <label>Content</label>
                    <textarea id="secretNoteContent" placeholder="Start typing..." style="min-height: 300px;">${note.content ? htmlToPlainTextSecret(note.content) : ''}</textarea>
                </div>

                <div class="form-group">
                    <label>URLs <span style="color: var(--color-text-muted); font-size: 12px;">(Max 100)</span></label>
                    <div id="urlsContainer">
                        ${urls.map((urlData, index) => {
                            const parts = urlData.split('::');
                            const name = parts.length > 1 ? parts[0] : '';
                            const url = parts.length > 1 ? parts[1] : urlData;
                            
                            return `
                            <div class="url-input-row" data-index="${index}">
                                <div class="url-input-group">
                                    <div class="url-name-label" onclick="editUrlName(${index})" data-name="${escapeHtmlSecret(name)}">${name ? escapeHtmlSecret(name) : '<span style="color: var(--color-text-muted); font-style: italic;">Click to add name</span>'}</div>
                                    <div style="display: flex; gap: 8px; align-items: center;">
                                        <input type="url" class="url-input" value="${escapeHtmlSecret(url)}" placeholder="https://example.com" style="flex: 1;">
                                        ${urls.length > 1 ? `<button type="button" class="btn-remove-url" onclick="removeSecretUrl(${index})" tabindex="-1">×</button>` : ''}
                                    </div>
                                </div>
                            </div>
                        `;
                        }).join('')}
                    </div>
                    ${urls.length < 100 ? `<button type="button" class="btn" onclick="addSecretUrl()" style="margin-top: 8px;">+ Add URL</button>` : ''}
                </div>
            </form>
        </div>
    `;
    
    const titleInput = document.getElementById('secretNoteTitle');
    if (titleInput) titleInput.focus();
}

function addSecretUrl() {
    const container = document.getElementById('urlsContainer');
    if (!container) return;
    
    const currentUrls = container.querySelectorAll('.url-input-row');
    if (currentUrls.length >= 100) return;
    
    const newIndex = currentUrls.length;
    const newRow = document.createElement('div');
    newRow.className = 'url-input-row';
    newRow.setAttribute('data-index', newIndex);
    newRow.innerHTML = `
        <div class="url-input-group">
            <div class="url-name-label" onclick="editUrlName(${newIndex})" data-name=""><span style="color: var(--color-text-muted); font-style: italic;">Click to add name</span></div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <input type="url" class="url-input" value="" placeholder="https://example.com" style="flex: 1;">
                <button type="button" class="btn-remove-url" onclick="removeSecretUrl(${newIndex})" tabindex="-1">×</button>
            </div>
        </div>
    `;
    
    container.appendChild(newRow);
    newRow.querySelector('.url-input').focus();
}

function editUrlName(index) {
    const row = document.querySelector(`#urlsContainer .url-input-row[data-index="${index}"]`);
    if (!row) return;
    
    const label = row.querySelector('.url-name-label');
    const currentName = label.getAttribute('data-name') || '';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'url-name-input';
    input.value = currentName;
    input.placeholder = 'Name (optional)';
    
    input.onblur = function() {
        const newName = this.value.trim();
        label.setAttribute('data-name', newName);
        label.innerHTML = newName ? escapeHtmlSecret(newName) : '<span style="color: var(--color-text-muted); font-style: italic;">Click to add name</span>';
        label.style.display = 'block';
        this.remove();
    };
    
    input.onkeydown = function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.blur();
        }
    };
    
    label.style.display = 'none';
    label.parentNode.insertBefore(input, label);
    input.focus();
}

function removeSecretUrl(index) {
    const row = document.querySelector(`#urlsContainer .url-input-row[data-index="${index}"]`);
    if (row) row.remove();
}

async function saveSecretNote() {
    const title = document.getElementById('secretNoteTitle').value.trim();
    const content = document.getElementById('secretNoteContent').value;
    
    // Collect all URLs with names
    const urlRows = document.querySelectorAll('#urlsContainer .url-input-row');
    const allUrls = Array.from(urlRows).map(row => {
        const label = row.querySelector('.url-name-label');
        const name = label ? label.getAttribute('data-name') || '' : '';
        const url = row.querySelector('.url-input').value.trim();
        if (!url) return '';
        return name ? `${name}::${url}` : url;
    }).filter(u => u.length > 0);
    
    // Save all URLs to url1 field only (separated by |)
    const url1 = allUrls.join('|');
    
    const noteData = {
        title: title || 'Untitled Secret',
        content: content.replace(/\n/g, '<br>'),
        type: 'secret',
        source: '',
        tags: '',
        example: '',
        url1: url1,
        url2: '',
        url3: '',
        url4: '',
        url5: ''
    };
    
    try {
        if (currentSecretNote && currentSecretNote.id) {
            const response = await fetch(`${API_CONFIG.NOTES}/${currentSecretNote.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...noteData, updatedAt: new Date().toISOString() })
            });
            currentSecretNote = await response.json();
            
            const index = secretNotes.findIndex(n => n.id === currentSecretNote.id);
            if (index !== -1) secretNotes[index] = currentSecretNote;
        } else {
            const response = await fetch(API_CONFIG.NOTES, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ...noteData, 
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                })
            });
            currentSecretNote = await response.json();
            secretNotes.unshift(currentSecretNote);
        }
        
        renderSecretNotesList();
        showSecretNoteView();
    } catch (error) {
        console.error('Error saving secret note:', error);
        alert('Error saving note');
    }
}

async function deleteSecretNote(id) {
    if (!confirm('Delete this secret note?')) return;
    
    try {
        await fetch(`${API_CONFIG.NOTES}/${id}`, { method: 'DELETE' });
        secretNotes = secretNotes.filter(n => n.id !== id);
        currentSecretNote = null;
        renderSecretNotesList();
        
        const editorView = document.getElementById('secretEditorView');
        if (editorView) {
            editorView.innerHTML = '<div class="empty-editor">Select a secret note or create a new one</div>';
        }
    } catch (error) {
        console.error('Error deleting secret note:', error);
        alert('Error deleting note');
    }
}

function cancelSecretEdit() {
    if (currentSecretNote) {
        showSecretNoteView();
    } else {
        const editorView = document.getElementById('secretEditorView');
        if (editorView) {
            editorView.innerHTML = '<div class="empty-editor">Select a secret note or create a new one</div>';
        }
    }
}

function clearSecretSearch() {
    const input = document.getElementById('secretSearchInput');
    if (input) input.value = '';
    const clearBtn = document.getElementById('clearSecretSearch');
    if (clearBtn) clearBtn.style.display = 'none';
}

function escapeHtmlSecret(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function htmlToPlainTextSecret(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
}

function formatDateSecret(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

