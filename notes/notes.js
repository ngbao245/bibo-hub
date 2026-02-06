// API Configuration - Using centralized config
const API_NOTES = API_CONFIG.NOTES;
const API_TAGS = API_CONFIG.TAGS;

// State
let notes = [];
let currentNote = null;
let isEditing = false;
let searchQuery = '';
let currentTypeFilter = localStorage.getItem('notes_typeFilter') || 'all'; // Filter by type, restore from localStorage

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
        const allNotes = await response.json();
        
        // Filter out sources (only show notes)
        notes = allNotes.filter(n => n.type !== 'source');
        notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        updateTypeCounts();
        restoreTypeFilter(); // Restore filter state
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
            updateTypeCounts();
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
            updateTypeCounts();
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
            updateTypeCounts();
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
        updateTypeCounts();
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
        // Filter by search query
        const matchesSearch = !searchQuery || 
            note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            note.content.toLowerCase().includes(searchQuery.toLowerCase());
        
        // Filter by type
        const matchesType = currentTypeFilter === 'all' || note.type === currentTypeFilter;
        
        return matchesSearch && matchesType;
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
                <span class="meta-badge">${formatDate(currentNote.createdAt)}</span>
                ${currentNote.timerDuration && parseInt(currentNote.timerDuration) > 0 ? `<span class="meta-badge">⏱ ${parseInt(currentNote.timerDuration)} min</span>` : ''}
            </div>
            
            ${currentNote.source ? `
                <div class="content-section">
                    <h3>Source</h3>
                    <div class="content-text">${escapeHtml(currentNote.source)}</div>
                </div>
            ` : ''}
            
            <div class="content-section">
                <h3>Content</h3>
                <div class="content-text editable-content" ondblclick="editContent(this)">${currentNote.content || ''}</div>
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
    
    // Set default type based on current filter
    if (!note.id && !note.type) {
        // New note: use current filter as default type (if not 'all')
        if (currentTypeFilter !== 'all') {
            note.type = currentTypeFilter;
        }
    }
    
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
                    <textarea id="noteContent" placeholder="Start typing...">${note.content ? htmlToPlainText(note.content) : ''}</textarea>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Type</label>
                        <div class="note-type-dropdown">
                            <button type="button" class="note-type-btn" id="noteTypeBtn" onclick="toggleNoteTypeDropdown()">
                                <span id="noteTypeText">Note</span>
                            </button>
                            <div class="note-type-options" id="noteTypeOptions">
                                <div class="note-type-option" onclick="setNoteType('note')">
                                    <span class="option-text">Note</span>
                                </div>
                                <div class="note-type-option" onclick="setNoteType('ielts')">
                                    <span class="option-text">IELTS</span>
                                </div>
                                <div class="note-type-option" onclick="setNoteType('course')">
                                    <span class="option-text">Course</span>
                                </div>
                                <div class="note-type-option" onclick="setNoteType('code')">
                                    <span class="option-text">Code</span>
                                </div>
                            </div>
                        </div>
                        <!-- Hidden input for note type -->
                        <input type="text" id="noteType" value="${note.type || 'note'}" style="display: none;">
                    </div>

                    <div class="form-group">
                        <label>Timer Duration</label>
                        <div class="timer-duration-dropdown">
                            <button type="button" class="timer-duration-btn" id="timerDurationBtn" onclick="toggleTimerDurationDropdown()">
                                <span id="timerDurationText">Not set</span>
                            </button>
                            <div class="timer-duration-options" id="timerDurationOptions">
                                <div class="timer-duration-option" onclick="setTimerDuration('20')">
                                    <span class="option-text">20 min (Writing Task 1)</span>
                                </div>
                                <div class="timer-duration-option" onclick="setTimerDuration('40')">
                                    <span class="option-text">40 min (Writing Task 2)</span>
                                </div>
                                <div class="timer-duration-option" onclick="setTimerDuration('60')">
                                    <span class="option-text">60 min (Reading/Listening)</span>
                                </div>
                                <div class="timer-duration-option" onclick="setTimerDuration('30')">
                                    <span class="option-text">30 min</span>
                                </div>
                                <div class="timer-duration-option" onclick="setTimerDuration('45')">
                                    <span class="option-text">45 min</span>
                                </div>
                                <div class="timer-duration-option" onclick="setTimerDuration('custom')">
                                    <span class="option-text">Custom...</span>
                                </div>
                            </div>
                        </div>
                        <!-- Hidden input for timer duration -->
                        <input type="number" id="noteTimerDuration" value="${parseInt(note.timerDuration) || 0}" style="display: none;" min="0">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Source</label>
                        <input type="text" id="noteSource" value="${escapeHtml(note.source || '')}" placeholder="Udemy, YouTube, Book...">
                    </div>

                    <div class="form-group">
                        <label>Tags</label>
                        <input type="text" id="noteTags" value="${escapeHtml(note.tags || '')}" placeholder="javascript, react, english (comma separated)">
                    </div>
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
    
    // Initialize timer duration dropdown display
    updateTimerDurationDisplay();
    
    // Initialize note type dropdown display
    updateNoteTypeDisplay();
}

// Note Type Dropdown Functions
function toggleNoteTypeDropdown() {
    const options = document.getElementById('noteTypeOptions');
    if (options) {
        options.style.display = options.style.display === 'block' ? 'none' : 'block';
    }
}

function setNoteType(type) {
    const input = document.getElementById('noteType');
    const options = document.getElementById('noteTypeOptions');
    
    input.value = type;
    updateNoteTypeDisplay();
    
    // Close dropdown
    if (options) {
        options.style.display = 'none';
    }
}

function updateNoteTypeDisplay() {
    const input = document.getElementById('noteType');
    const displayText = document.getElementById('noteTypeText');
    
    if (!input || !displayText) return;
    
    const type = input.value || 'note';
    
    const typeLabels = {
        'note': 'Note',
        'ielts': 'IELTS',
        'course': 'Course',
        'code': 'Code'
    };
    
    displayText.textContent = typeLabels[type] || 'Note';
}

// Timer Duration Dropdown Functions
function toggleTimerDurationDropdown() {
    const options = document.getElementById('timerDurationOptions');
    if (options) {
        options.style.display = options.style.display === 'block' ? 'none' : 'block';
    }
}

function setTimerDuration(value) {
    const input = document.getElementById('noteTimerDuration');
    const options = document.getElementById('timerDurationOptions');
    
    if (value === 'custom') {
        // Show prompt for custom duration
        const customValue = prompt('Enter duration in minutes:', input.value || '0');
        if (customValue !== null) {
            const minutes = parseInt(customValue);
            if (!isNaN(minutes) && minutes >= 0) {
                input.value = minutes;
                updateTimerDurationDisplay();
            }
        }
    } else {
        input.value = value;
        updateTimerDurationDisplay();
    }
    
    // Close dropdown
    if (options) {
        options.style.display = 'none';
    }
}

function updateTimerDurationDisplay() {
    const input = document.getElementById('noteTimerDuration');
    const displayText = document.getElementById('timerDurationText');
    
    if (!input || !displayText) return;
    
    const minutes = parseInt(input.value) || 0;
    
    if (minutes === 0) {
        displayText.textContent = 'Not set';
    } else if (minutes === 20) {
        displayText.textContent = '20 min';
    } else if (minutes === 40) {
        displayText.textContent = '40 min';
    } else if (minutes === 60) {
        displayText.textContent = '60 min';
    } else if (minutes === 30) {
        displayText.textContent = '30 min';
    } else if (minutes === 45) {
        displayText.textContent = '45 min';
    } else {
        displayText.textContent = `${minutes} min`;
    }
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
    const contentTextarea = document.getElementById('noteContent');
    let content = contentTextarea.value.trim();
    
    // Convert plain text to HTML for storage (preserve line breaks)
    if (content) {
        content = content.replace(/\n/g, '<br>');
        // Wrap in div if not already wrapped
        if (!content.startsWith('<div>')) {
            content = `<div>${content}</div>`;
        }
    }
    
    // Use placeholder text as default title if empty
    const placeholder = document.getElementById('noteTitle').placeholder;
    const finalTitle = title || placeholder;
    
    const noteData = {
        title: finalTitle,
        content: content,
        type: document.getElementById('noteType').value,
        source: document.getElementById('noteSource').value,
        tags: document.getElementById('noteTags').value,
        example: document.getElementById('noteExample').value,
        url1: document.getElementById('noteUrl1').value,
        url2: document.getElementById('noteUrl2').value,
        url3: document.getElementById('noteUrl3').value,
        url4: document.getElementById('noteUrl4').value,
        url5: document.getElementById('noteUrl5').value,
        wordCountEnabled: currentNote ? currentNote.wordCountEnabled : false, // Keep existing value or default
        timerDuration: document.getElementById('noteTimerDuration').value || "0"
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
    
    // Close timer duration dropdown when clicking outside
    document.addEventListener('click', (e) => {
        const timerDropdown = document.getElementById('timerDurationOptions');
        const timerBtn = document.getElementById('timerDurationBtn');
        if (timerDropdown && timerBtn && !timerDropdown.contains(e.target) && !timerBtn.contains(e.target)) {
            timerDropdown.style.display = 'none';
        }
        
        // Close note type dropdown when clicking outside
        const typeDropdown = document.getElementById('noteTypeOptions');
        const typeBtn = document.getElementById('noteTypeBtn');
        if (typeDropdown && typeBtn && !typeDropdown.contains(e.target) && !typeBtn.contains(e.target)) {
            typeDropdown.style.display = 'none';
        }
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

// Type Filter Functions
function toggleTypeFilter() {
    const list = document.getElementById('noteTypeList');
    const toggle = document.getElementById('filterToggle');
    
    list.classList.toggle('open');
    toggle.classList.toggle('open');
}

function filterByType(type) {
    currentTypeFilter = type;
    
    // Save to localStorage
    localStorage.setItem('notes_typeFilter', type);
    
    // Update active state
    document.querySelectorAll('.note-type-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`.note-type-item[data-type="${type}"]`).classList.add('active');
    
    // Render filtered notes
    renderNotesList();
}

function restoreTypeFilter() {
    // Restore active state from localStorage
    const savedFilter = localStorage.getItem('notes_typeFilter') || 'all';
    currentTypeFilter = savedFilter;
    
    document.querySelectorAll('.note-type-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const activeItem = document.querySelector(`.note-type-item[data-type="${savedFilter}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
    }
}

function updateTypeCounts() {
    const counts = {
        all: notes.length,
        note: notes.filter(n => n.type === 'note').length,
        ielts: notes.filter(n => n.type === 'ielts').length,
        course: notes.filter(n => n.type === 'course').length,
        code: notes.filter(n => n.type === 'code').length
    };
    
    document.getElementById('countAll').textContent = counts.all;
    document.getElementById('countNote').textContent = counts.note;
    document.getElementById('countIelts').textContent = counts.ielts;
    document.getElementById('countCourse').textContent = counts.course;
    document.getElementById('countCode').textContent = counts.code;
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
        // Skip if cached note is a source
        if (cachedNote && cachedNote.id === savedNoteId && cachedNote.type !== 'source') {
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
        note: 'Note',
        ielts: 'IELTS',
        course: 'Course',
        code: 'Code'
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

function htmlToPlainText(html) {
    if (!html) return '';
    
    // Create a temporary div to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Replace <br> and </div> with line breaks
    temp.innerHTML = temp.innerHTML
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<div>/gi, '');
    
    // Get plain text content
    let plainText = temp.textContent || temp.innerText || '';
    
    // Clean up multiple consecutive line breaks
    plainText = plainText.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
    
    return plainText;
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
    
    // Sanitize content before passing to editor
    let contentToEdit = currentNote.content || '';
    
    // If content looks like it might have malformed HTML, clean it
    if (contentToEdit.includes('<') && contentToEdit.includes('>')) {
        const temp = document.createElement('div');
        try {
            temp.innerHTML = contentToEdit;
            contentToEdit = temp.innerHTML;
        } catch (error) {
            // If parsing fails, treat as plain text
            temp.textContent = contentToEdit;
            contentToEdit = temp.innerHTML;
        }
    }
    
    // Initialize rich text editor
    const editor = new RichTextEditor(
        editorContainer,
        contentToEdit,
        async (newContent, editorState) => {
            // Save callback with editor state
            if (newContent !== currentNote.content || 
                (editorState && (editorState.wordCountEnabled !== currentNote.wordCountEnabled || 
                editorState.timerDuration !== currentNote.timerDuration))) {
                currentNote.content = newContent;
                if (editorState) {
                    currentNote.wordCountEnabled = editorState.wordCountEnabled;
                    currentNote.timerDuration = editorState.timerDuration;
                }
                await saveNote(currentNote);
            }
        },
        currentNote // Pass current note data for state restoration
    );
}