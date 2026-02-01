// API Configuration - Using centralized config
const API_NOTES = API_CONFIG.NOTES;
const API_TAGS = API_CONFIG.TAGS;

// State
let notes = [];
let currentNote = null;
let isEditing = false;
let searchQuery = '';

// DOM Elements
const notesList = document.getElementById('notesList');
const searchInput = document.getElementById('searchInput');
const editorView = document.getElementById('editorView');

// Utility: Debounce function for smooth search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize
init();

async function init() {
    // Restore state IMMEDIATELY from cache (no API wait)
    restoreStateFromCache();
    
    // Setup listeners
    setupEventListeners();
    
    // Load notes from API in background
    await loadNotes();
    
    // Update with fresh API data
    updateStateFromAPI();
}

// API Functions
async function loadNotes() {
    try {
        const response = await fetch(API_NOTES);
        notes = await response.json();
        notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        renderNotesList();
    } catch (error) {
        console.error('Error loading notes:', error);
        notesList.innerHTML = '<div style="padding: 20px; text-align: center; color: #c5000b;">Error loading notes</div>';
    }
}

async function saveNote(noteData) {
    try {
        if (currentNote && currentNote.id) {
            // Update existing note - Optimistic UI
            const updatedNote = { ...currentNote, ...noteData, updatedAt: new Date().toISOString() };
            const index = notes.findIndex(n => n.id === currentNote.id);
            if (index !== -1) notes[index] = updatedNote;
            currentNote = updatedNote;
            
            // Update UI immediately
            StorageManager.saveCurrentNoteId(currentNote.id);
            StorageManager.clearEditorState();
            renderNotesList();
            showViewMode();
            
            // Save to API in background
            fetch(`${API_NOTES}/${currentNote.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedNote)
            }).catch(error => {
                console.error('Error saving to API:', error);
            });
        } else {
            // Create new note - need to wait for ID from API
            const tempNote = { 
                ...noteData, 
                id: 'temp_' + Date.now(),
                createdAt: new Date().toISOString(), 
                updatedAt: new Date().toISOString() 
            };
            notes.unshift(tempNote);
            currentNote = tempNote;
            
            // Update UI immediately with temp note
            StorageManager.clearEditorState();
            renderNotesList();
            showViewMode();
            
            // Create in API and update with real ID
            const response = await fetch(API_NOTES, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...noteData, createdAt: tempNote.createdAt, updatedAt: tempNote.updatedAt })
            });
            const newNote = await response.json();
            
            // Replace temp note with real note
            const index = notes.findIndex(n => n.id === tempNote.id);
            if (index !== -1) notes[index] = newNote;
            currentNote = newNote;
            StorageManager.saveCurrentNoteId(newNote.id);
            renderNotesList();
        }
    } catch (error) {
        console.error('Error saving note:', error);
        alert('Error saving note');
    }
}

async function deleteNote(id) {
    if (!confirm('Delete this note?')) return;
    
    try {
        // Optimistic UI - remove immediately
        notes = notes.filter(n => n.id !== id);
        currentNote = null;
        StorageManager.saveCurrentNoteId(null);
        StorageManager.saveCachedNote(null);
        StorageManager.clearEditorState();
        renderNotesList();
        editorView.innerHTML = '<div class="empty-editor">Select a note or create a new one</div>';
        
        // Delete from API in background
        fetch(`${API_NOTES}/${id}`, { method: 'DELETE' }).catch(error => {
            console.error('Error deleting from API:', error);
        });
    } catch (error) {
        console.error('Error deleting note:', error);
        alert('Error deleting note');
    }
}

// Render Functions
function renderNotesList() {
    const filteredNotes = notes.filter(note => {
        if (!searchQuery) return true;
        return note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
               note.content.toLowerCase().includes(searchQuery.toLowerCase());
    });
    
    if (filteredNotes.length === 0) {
        notesList.innerHTML = '<div style="padding: 20px; text-align: center; color: #858585;">No notes found</div>';
        return;
    }
    
    notesList.innerHTML = filteredNotes.map(note => `
        <div class="note-item ${currentNote && currentNote.id === note.id ? 'active' : ''}" onclick="selectNote('${note.id}')">
            <div class="note-item-content">
                <div class="note-item-title">${escapeHtml(note.title)}</div>
                <div class="note-item-meta">${formatDate(note.createdAt)}</div>
            </div>
            <div class="note-item-actions">
                <button class="btn-icon" onclick="event.stopPropagation(); deleteNote('${note.id}')" title="Delete">×</button>
            </div>
        </div>
    `).join('');
}

function showViewMode() {
    if (!currentNote) return;
    
    isEditing = false;
    editorView.innerHTML = `
        <div class="editor-header" ondblclick="editTitleFromHeader(event)">
            <div class="editor-title editable-title">${escapeHtml(currentNote.title)}</div>
            <div class="editor-actions">
                <button class="btn" onclick="editCurrentNote()">Edit</button>
                <button class="btn btn-danger" onclick="deleteNote('${currentNote.id}')">Delete</button>
            </div>
        </div>
        <div class="view-mode">
            <div class="meta-info">
                <span class="meta-badge">${getTypeLabel(currentNote.type)}</span>
                <span class="meta-badge">${currentNote.language === 'vi' ? 'Tiếng Việt' : 'English'}</span>
                <span class="meta-badge">${formatDate(currentNote.createdAt)}</span>
            </div>
            
            ${currentNote.source ? `
                <div class="content-section">
                    <h3>Source</h3>
                    <div class="content-text">${escapeHtml(currentNote.source)}</div>
                </div>
            ` : ''}
            
            <div class="content-section">
                <h3>Content</h3>
                <div class="content-text editable-content" ondblclick="editContent(this)">${currentNote.content || '<span style="color: var(--color-text-muted); font-style: italic;">blank</span>'}</div>
            </div>
            
            ${currentNote.example ? `
                <div class="content-section">
                    <h3>Example</h3>
                    <div class="example-text">${currentNote.example}</div>
                </div>
            ` : ''}
            
            ${currentNote.tags ? `
                <div class="content-section">
                    <h3>Tags</h3>
                    <div class="tags-list">
                        ${currentNote.tags.split(',').map(tag => `<span class="tag">${escapeHtml(tag.trim())}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${hasAnyUrl(currentNote) ? `
                <div class="content-section">
                    <h3>Resources</h3>
                    <div class="urls-list">
                        ${currentNote.url1 ? `<div class="url-group"><label>URL 1:</label><br><a href="${escapeHtml(currentNote.url1)}" target="_blank" class="url-link">${escapeHtml(currentNote.url1)}</a></div>` : ''}
                        ${currentNote.url2 ? `<div class="url-group"><label>URL 2:</label><br><a href="${escapeHtml(currentNote.url2)}" target="_blank" class="url-link">${escapeHtml(currentNote.url2)}</a></div>` : ''}
                        ${currentNote.url3 ? `<div class="url-group"><label>URL 3:</label><br><a href="${escapeHtml(currentNote.url3)}" target="_blank" class="url-link">${escapeHtml(currentNote.url3)}</a></div>` : ''}
                        ${currentNote.url4 ? `<div class="url-group"><label>URL 4:</label><br><a href="${escapeHtml(currentNote.url4)}" target="_blank" class="url-link">${escapeHtml(currentNote.url4)}</a></div>` : ''}
                        ${currentNote.url5 ? `<div class="url-group"><label>URL 5:</label><br><a href="${escapeHtml(currentNote.url5)}" target="_blank" class="url-link">${escapeHtml(currentNote.url5)}</a></div>` : ''}
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function showEditMode(restoreData = null) {
    isEditing = true;
    const note = restoreData || currentNote || {};
    
    // Generate default placeholder for new note
    const defaultPlaceholder = `New ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    
    editorView.innerHTML = `
        <div class="editor-header">
            <div class="editor-title">${note.id ? 'Edit Note' : 'New Note'}</div>
            <div class="editor-actions">
                <button class="btn btn-primary" onclick="saveCurrentNote()">Save</button>
                ${note.id ? `<button class="btn" onclick="cancelEdit()">Cancel</button>` : ''}
            </div>
        </div>
        <div class="editor-content">
            <form id="noteForm" onsubmit="event.preventDefault(); saveCurrentNote();">
                <div class="form-group">
                    <label>Title</label>
                    <input type="text" id="noteTitle" value="${escapeHtml(note.title || '')}" placeholder="${note.id ? 'Untitled' : defaultPlaceholder}">
                </div>

                <div class="form-group">
                    <label>Content</label>
                    <textarea id="noteContent" placeholder="Start typing...">${escapeHtml(note.content || '')}</textarea>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Type</label>
                        <select id="noteType">
                            <option value="note" ${note.type === 'note' ? 'selected' : ''}>Note</option>
                            <option value="vocabulary" ${note.type === 'vocabulary' ? 'selected' : ''}>Vocabulary</option>
                            <option value="code" ${note.type === 'code' ? 'selected' : ''}>Code</option>
                            <option value="course" ${note.type === 'course' ? 'selected' : ''}>Course</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Language</label>
                        <select id="noteLanguage">
                            <option value="vi" ${note.language === 'vi' ? 'selected' : ''}>Tiếng Việt</option>
                            <option value="en" ${note.language === 'en' ? 'selected' : ''}>English</option>
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label>Source</label>
                    <input type="text" id="noteSource" value="${escapeHtml(note.source || '')}" placeholder="Udemy, YouTube, Book...">
                </div>

                <div class="form-group">
                    <label>Tags</label>
                    <input type="text" id="noteTags" value="${escapeHtml(note.tags || '')}" placeholder="javascript, react, english (comma separated)">
                </div>

                <div class="form-group">
                    <label>Example</label>
                    <textarea id="noteExample">${escapeHtml(note.example || '')}</textarea>
                </div>

                <div class="form-group">
                    <label>URL 1</label>
                    <input type="url" id="noteUrl1" value="${escapeHtml(note.url1 || '')}" placeholder="https://...">
                </div>

                <div class="form-group">
                    <label>URL 2</label>
                    <input type="url" id="noteUrl2" value="${escapeHtml(note.url2 || '')}" placeholder="https://...">
                </div>

                <div class="form-group">
                    <label>URL 3</label>
                    <input type="url" id="noteUrl3" value="${escapeHtml(note.url3 || '')}" placeholder="https://...">
                </div>

                <div class="form-group">
                    <label>URL 4</label>
                    <input type="url" id="noteUrl4" value="${escapeHtml(note.url4 || '')}" placeholder="https://...">
                </div>

                <div class="form-group">
                    <label>URL 5</label>
                    <input type="url" id="noteUrl5" value="${escapeHtml(note.url5 || '')}" placeholder="https://...">
                </div>
            </form>
        </div>
    `;
    
    // Focus on title
    document.getElementById('noteTitle').focus();
    
    // Setup auto-save for form fields
    StorageManager.setupAutoSave();
}

// Actions
function newNote() {
    currentNote = null;
    StorageManager.saveCurrentNoteId(null);
    StorageManager.clearEditorState();
    showEditMode();
}

function selectNote(id) {
    const note = notes.find(n => n.id === id);
    if (note) {
        currentNote = note;
        StorageManager.saveCurrentNoteId(note.id);
        StorageManager.saveCachedNote(note);
        StorageManager.clearEditorState();
        showViewMode();
        renderNotesList();
    }
}

function editCurrentNote() {
    showEditMode();
}

function cancelEdit() {
    StorageManager.clearEditorState();
    if (currentNote) {
        showViewMode();
    } else {
        editorView.innerHTML = '<div class="empty-editor">Select a note or create a new one</div>';
    }
}

function saveCurrentNote() {
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    
    // Use placeholder text as default title if empty
    const placeholder = document.getElementById('noteTitle').placeholder;
    const finalTitle = title || placeholder;
    
    const noteData = {
        title: finalTitle,
        content: content,
        type: document.getElementById('noteType').value,
        language: document.getElementById('noteLanguage').value,
        source: document.getElementById('noteSource').value,
        tags: document.getElementById('noteTags').value,
        example: document.getElementById('noteExample').value,
        url1: document.getElementById('noteUrl1').value,
        url2: document.getElementById('noteUrl2').value,
        url3: document.getElementById('noteUrl3').value,
        url4: document.getElementById('noteUrl4').value,
        url5: document.getElementById('noteUrl5').value
    };
    
    saveNote(noteData);
}

// Event Listeners
function setupEventListeners() {
    const clearSearchBtn = document.getElementById('clearSearch');
    
    // Debounced search for smooth performance
    const debouncedSearch = debounce((value) => {
        searchQuery = value;
        renderNotesList();
    }, 300);
    
    searchInput.addEventListener('input', (e) => {
        const value = e.target.value;
        // Show/hide clear button immediately (no debounce)
        clearSearchBtn.style.display = value ? 'block' : 'none';
        // Debounce the search
        debouncedSearch(value);
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+S: Save note
        if (e.ctrlKey && e.key === 's' && isEditing) {
            e.preventDefault();
            saveCurrentNote();
        }
        // Escape: Cancel edit
        if (e.key === 'Escape' && isEditing) {
            cancelEdit();
        }
    });
}

// Helper Functions
function clearSearch() {
    searchInput.value = '';
    searchQuery = '';
    document.getElementById('clearSearch').style.display = 'none';
    renderNotesList();
    searchInput.focus();
}

// Restore state from cache IMMEDIATELY (no API wait)
function restoreStateFromCache() {
    // Restore editor state
    const editorState = StorageManager.loadEditorState();
    if (editorState && editorState.isEditing) {
        showEditMode(editorState.formData);
        return;
    }
    
    // Restore current note from cache
    const savedNoteId = StorageManager.loadCurrentNoteId();
    if (savedNoteId) {
        const cachedNote = StorageManager.loadCachedNote();
        if (cachedNote && cachedNote.id === savedNoteId) {
            currentNote = cachedNote;
            // Add to notes array temporarily
            notes = [cachedNote];
            showViewMode();
            renderNotesList();
        }
    }
}

// Update with fresh data from API
function updateStateFromAPI() {
    const savedNoteId = StorageManager.loadCurrentNoteId();
    if (savedNoteId) {
        const note = notes.find(n => n.id === savedNoteId);
        if (note) {
            currentNote = note;
            StorageManager.saveCachedNote(note);
            showViewMode();
            renderNotesList();
        }
    }
}

function getTypeLabel(type) {
    const labels = {
        vocabulary: 'Vocabulary',
        code: 'Code',
        course: 'Course',
        note: 'Note'
    };
    return labels[type] || 'Note';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function hasAnyUrl(note) {
    return note.url1 || note.url2 || note.url3 || note.url4 || note.url5;
}

// Inline editing functions
function editTitleFromHeader(event) {
    // Ignore if clicking on buttons
    if (event.target.tagName === 'BUTTON' || event.target.closest('button')) {
        return;
    }
    
    const titleElement = event.currentTarget.querySelector('.editor-title');
    if (titleElement) {
        editTitle(titleElement);
    }
}

function editTitle(element) {
    const currentText = element.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'inline-edit-input';
    
    const saveTitle = async () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== currentText) {
            currentNote.title = newTitle;
            await saveNote(currentNote);
        }
        showViewMode();
    };
    
    input.addEventListener('blur', saveTitle);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveTitle();
        } else if (e.key === 'Escape') {
            showViewMode();
        }
    });
    
    element.replaceWith(input);
    input.focus();
    input.select();
}

function editContent(element) {
    // Create container for rich text editor
    const editorContainer = document.createElement('div');
    document.body.appendChild(editorContainer);
    
    // Initialize rich text editor
    const editor = new RichTextEditor(
        editorContainer,
        currentNote.content || '',
        async (newContent) => {
            // Save callback
            if (newContent !== currentNote.content) {
                currentNote.content = newContent;
                await saveNote(currentNote);
            }
        }
    );
}
