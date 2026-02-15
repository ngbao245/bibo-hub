// API Configuration - Using centralized config
const API_NOTES = API_CONFIG.NOTES;
const API_TAGS = API_CONFIG.TAGS;

// State
let notes = [];
let allNotesCache = []; // Cache ALL notes including child notes
let currentNote = null;
let parentNoteContext = null; // Track parent note when viewing child notes
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
        
        // Store ALL notes in memory cache (including child notes)
        allNotesCache = allNotes;
        
        // Filter out sources, secret notes, and child notes (only show regular notes)
        notes = allNotes.filter(n => n.type !== 'source' && n.type !== 'secret' && !n.isChildNote);
        notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        updateTypeCounts();
        restoreTypeFilter(); // Restore filter state
        renderNotesList();
    } catch (error) {
        console.error('Error loading notes:', error);
        notesList.innerHTML = '<div style="padding: 20px; text-align: center; color: #c5000b;">Error loading notes</div>';
    }
}

// Get all notes from memory cache (NO API CALL - instant access)
function getAllNotesFromCache() {
    return allNotesCache;
}

async function saveNote(noteData) {
    try {
        if (currentNote && currentNote.id) {
            // Update existing note - Optimistic UI
            const updatedNote = { ...currentNote, ...noteData, updatedAt: new Date().toISOString() };
            const index = notes.findIndex(n => n.id === currentNote.id);
            if (index !== -1) notes[index] = updatedNote;
            
            // Update in allNotesCache
            const cacheIndex = allNotesCache.findIndex(n => n.id === currentNote.id);
            if (cacheIndex !== -1) allNotesCache[cacheIndex] = updatedNote;
            
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
            allNotesCache.unshift(tempNote);
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
            
            const cacheIndex = allNotesCache.findIndex(n => n.id === tempNote.id);
            if (cacheIndex !== -1) allNotesCache[cacheIndex] = newNote;
            
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
    // Find the note to check if it has child notes
    const noteToDelete = allNotesCache.find(n => n.id === id);
    
    // Check if this is a child note
    const isChildNote = noteToDelete && noteToDelete.isChildNote;
    const parentId = isChildNote ? noteToDelete.parentNoteId : null;
    
    // Count actual child notes (not just linked notes)
    let childNotesCount = 0;
    if (noteToDelete && noteToDelete.linkedNotes && noteToDelete.linkedNotes.length > 0) {
        childNotesCount = noteToDelete.linkedNotes.filter(linkedId => {
            const linkedNote = allNotesCache.find(n => n.id === linkedId);
            return linkedNote && linkedNote.isChildNote;
        }).length;
    }
    
    // Customize confirm message based on child notes
    let confirmMessage = 'Delete this note?';
    if (childNotesCount > 0) {
        confirmMessage = `Delete this note and its ${childNotesCount} child note(s)?`;
    }
    
    if (!confirm(confirmMessage)) return;
    
    try {
        // If note has linked notes, process them
        if (noteToDelete && noteToDelete.linkedNotes && noteToDelete.linkedNotes.length > 0) {
            for (const linkedId of noteToDelete.linkedNotes) {
                const linkedNote = allNotesCache.find(n => n.id === linkedId);
                
                // Only DELETE if it's a child note
                if (linkedNote && linkedNote.isChildNote) {
                    try {
                        // Delete from API - AWAIT để đảm bảo xóa xong
                        await fetch(`${API_NOTES}/${linkedId}`, { method: 'DELETE' });
                        console.log(`Deleted child note: ${linkedId}`);
                        
                        // Remove from both arrays
                        notes = notes.filter(n => n.id !== linkedId);
                        allNotesCache = allNotesCache.filter(n => n.id !== linkedId);
                    } catch (error) {
                        console.error('Error deleting child note from API:', error);
                    }
                }
                // If it's a linked note (not child), just unlink - no deletion needed
                // The linkedNotes array will be removed when parent is deleted
            }
        }
        
        // If deleting a child note, remove it from parent's linkedNotes
        if (isChildNote && parentId) {
            const parent = allNotesCache.find(n => n.id === parentId);
            if (parent && parent.linkedNotes) {
                parent.linkedNotes = parent.linkedNotes.filter(childId => childId !== id);
                
                // Update parent in API
                await fetch(`${API_NOTES}/${parentId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(parent)
                });
                
                // Update parent in cache
                const parentCacheIndex = allNotesCache.findIndex(n => n.id === parentId);
                if (parentCacheIndex !== -1) {
                    allNotesCache[parentCacheIndex] = parent;
                }
            }
        }
        
        // Remove this note from linkedNotes of ALL other notes that reference it
        const notesReferencingThis = allNotesCache.filter(n => 
            n.linkedNotes && n.linkedNotes.includes(id)
        );
        
        for (const referencingNote of notesReferencingThis) {
            // Remove the deleted note from linkedNotes array
            referencingNote.linkedNotes = referencingNote.linkedNotes.filter(linkedId => linkedId !== id);
            
            // Update in API
            try {
                await fetch(`${API_NOTES}/${referencingNote.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(referencingNote)
                });
                console.log(`Removed reference from note: ${referencingNote.id}`);
                
                // Update in cache
                const cacheIndex = allNotesCache.findIndex(n => n.id === referencingNote.id);
                if (cacheIndex !== -1) {
                    allNotesCache[cacheIndex] = referencingNote;
                }
            } catch (error) {
                console.error(`Error updating note ${referencingNote.id}:`, error);
            }
        }
        
        // Optimistic UI - remove note
        notes = notes.filter(n => n.id !== id);
        allNotesCache = allNotesCache.filter(n => n.id !== id);
        
        // If deleted a child note, navigate back to parent
        if (isChildNote && parentId) {
            const parent = allNotesCache.find(n => n.id === parentId);
            if (parent) {
                currentNote = parent;
                parentNoteContext = null;
                StorageManager.saveCurrentNoteId(parent.id);
                StorageManager.saveCachedNote(parent);
                await showViewMode();
            } else {
                // Parent not found, go to empty state
                currentNote = null;
                parentNoteContext = null;
                StorageManager.saveCurrentNoteId(null);
                StorageManager.saveCachedNote(null);
                editorView.innerHTML = '<div class="empty-editor">Select a note or create a new one</div>';
            }
        } else {
            // Deleted a regular note, go to empty state
            currentNote = null;
            parentNoteContext = null;
            StorageManager.saveCurrentNoteId(null);
            StorageManager.saveCachedNote(null);
            editorView.innerHTML = '<div class="empty-editor">Select a note or create a new one</div>';
        }
        
        StorageManager.clearEditorState();
        updateTypeCounts();
        renderNotesList();
        
        // Delete note from API in background
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

async function showViewMode() {
    if (!currentNote) return;
    
    isEditing = false;
    
    // Render linked notes HTML if exists
    let linkedNotesHtml = '';
    if (currentNote.linkedNotes && currentNote.linkedNotes.length > 0) {
        linkedNotesHtml = await renderLinkedNotesList(currentNote.linkedNotes);
    }
    
    editorView.innerHTML = `
        <div class="editor-header" ondblclick="editTitleFromHeader(event)">
            <div class="editor-title editable-title">${escapeHtml(currentNote.title)}</div>
            <div class="editor-actions">
                <button class="btn btn-link-notes" onclick="openLinkedNotesModalFromView()">Link</button>
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
            
            ${currentNote.linkedNotes && currentNote.linkedNotes.length > 0 ? `
                <div class="content-section">
                    <div class="child-notes-header">
                        <div class="child-notes-title-row" onclick="toggleChildNotesSection()">
                            <h3>Related Notes (${currentNote.linkedNotes.length})</h3>
                            <span class="child-notes-toggle" id="childNotesToggle">▲</span>
                        </div>
                        <button class="btn-add-child-note" onclick="quickCreateChildNote()">+ Child Note</button>
                    </div>
                    <div class="child-notes-list collapsed" id="childNotesList">
                        ${linkedNotesHtml}
                    </div>
                </div>
            ` : `
                <div class="content-section">
                    <div class="child-notes-header">
                        <h3>Related Notes</h3>
                        <button class="btn-add-child-note" onclick="quickCreateChildNote()">+ Child Note</button>
                    </div>
                </div>
            `}
            
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
    
    // Restore collapsed state after rendering
    restoreChildNotesState();
}

async function showEditMode(restoreData = null) {
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
                    <div id="richTextWarning" style="display: none; color: var(--color-danger); font-size: 12px; margin-top: 4px;">
                        ! This note has rich text formatting. To edit content, close this form and double-click the content in view mode.
                    </div>
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
                                <div class="note-type-option" onclick="setNoteType('interview')">
                                    <span class="option-text">Interview</span>
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

                <div class="form-group child-notes-section">
                    <div class="child-notes-header-edit">
                        <label>Related Notes</label>
                        <div class="child-notes-quick-actions">
                            <button type="button" class="btn-quick-action btn-new" onclick="createChildNoteFromEdit()" title="Create new child note">
                                <span class="btn-icon">+</span>
                                <span class="btn-text">New Child</span>
                            </button>
                            <button type="button" class="btn-quick-action btn-link" onclick="openLinkedNotesModal()" title="Link existing notes">
                                <span class="btn-icon">🔗</span>
                                <span class="btn-text">Link Notes</span>
                            </button>
                        </div>
                    </div>
                    <div id="selectedLinkedNotes" class="child-notes-grid">
                        ${note.linkedNotes && note.linkedNotes.length > 0 ? 
                            await renderEditChildNotesGrid(note.linkedNotes)
                            : '<div class="no-child-notes-edit">No child notes yet. Click + New or Link to add.</div>'
                        }
                    </div>
                    <div class="child-notes-count">
                        <span id="linkedNotesCount">${note.linkedNotes ? note.linkedNotes.length : 0}</span> note(s) total
                    </div>
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
    
    // Detect and warn about rich text content
    detectRichTextContent(note);
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

// Timer Duration Dropdown Functions (Manual input only, not auto-saved from rich text editor)
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

// Detect if content has rich text formatting
function detectRichTextContent(note) {
    if (!note || !note.content) return;
    
    // Check if content has rich text tags (not just <div> and <br>)
    const richTextTags = /<(strong|em|u|b|i|ul|ol|li|code|pre|h[1-6]|span|p)[^>]*>/i;
    const hasRichText = richTextTags.test(note.content);
    
    if (hasRichText) {
        const textarea = document.getElementById('noteContent');
        const warning = document.getElementById('richTextWarning');
        
        if (textarea && warning) {
            // Make textarea readonly and show warning
            textarea.readOnly = true;
            textarea.style.opacity = '0.6';
            textarea.style.cursor = 'not-allowed';
            warning.style.display = 'block';
        }
    }
}

// Actions
function newNote() {
    currentNote = null;
    parentNoteContext = null; // Clear parent context when creating new note
    StorageManager.saveCurrentNoteId(null);
    StorageManager.clearEditorState();
    showEditMode();
}

function selectNote(id) {
    const note = notes.find(n => n.id === id);
    if (note) {
        currentNote = note;
        parentNoteContext = null; // Clear parent context when selecting regular note
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
    // Clean up temp child notes from cache
    allNotesCache = allNotesCache.filter(n => !n._isTemp);
    
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
    let content = contentTextarea.value; // Don't trim to preserve leading/trailing whitespace
    
    // IMPORTANT: If textarea is readonly (rich text content), keep original content
    if (contentTextarea.readOnly && currentNote && currentNote.content) {
        content = currentNote.content;
    } else if (content) {
        // Convert plain text to HTML for storage (preserve ALL line breaks including multiple empty lines)
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
        content: content || (currentNote ? currentNote.content : ''), // Keep existing content if empty
        type: document.getElementById('noteType').value,
        source: document.getElementById('noteSource').value,
        tags: document.getElementById('noteTags').value,
        example: document.getElementById('noteExample').value,
        url1: document.getElementById('noteUrl1').value,
        url2: document.getElementById('noteUrl2').value,
        url3: document.getElementById('noteUrl3').value,
        url4: document.getElementById('noteUrl4').value,
        url5: document.getElementById('noteUrl5').value,
        wordCountEnabled: currentNote ? currentNote.wordCountEnabled : false,
        timerDuration: document.getElementById('noteTimerDuration').value || "0",
        linkedNotes: getSelectedLinkedNotes() // Get selected linked notes from UI
    };
    
    saveNoteWithTempChildren(noteData);
}

async function saveNoteWithTempChildren(noteData) {
    try {
        // First, create any temp child notes in DB
        const linkedNotes = noteData.linkedNotes || [];
        const realLinkedNotes = [];
        
        for (const noteId of linkedNotes) {
            if (noteId.startsWith('temp_child_')) {
                // This is a temp child note - create it in DB
                const tempNote = allNotesCache.find(n => n.id === noteId);
                if (tempNote) {
                    const childData = {
                        title: tempNote.title,
                        content: tempNote.content,
                        type: tempNote.type,
                        source: tempNote.source || '',
                        tags: tempNote.tags || '',
                        example: tempNote.example || '',
                        url1: tempNote.url1 || '',
                        url2: tempNote.url2 || '',
                        url3: tempNote.url3 || '',
                        url4: tempNote.url4 || '',
                        url5: tempNote.url5 || '',
                        isChildNote: tempNote.isChildNote,
                        parentNoteId: tempNote.parentNoteId,
                        linkedNotes: tempNote.linkedNotes || [],
                        wordCountEnabled: tempNote.wordCountEnabled || false,
                        timerDuration: tempNote.timerDuration || '0',
                        createdAt: tempNote.createdAt,
                        updatedAt: new Date().toISOString()
                    };
                    
                    const response = await fetch(API_NOTES, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(childData)
                    });
                    
                    const newChildNote = await response.json();
                    
                    // Replace temp note with real note in cache
                    const tempIndex = allNotesCache.findIndex(n => n.id === noteId);
                    if (tempIndex !== -1) {
                        allNotesCache[tempIndex] = newChildNote;
                    }
                    
                    // Use real ID
                    realLinkedNotes.push(newChildNote.id);
                }
            } else {
                // This is a real note ID
                realLinkedNotes.push(noteId);
            }
        }
        
        // Update noteData with real IDs
        noteData.linkedNotes = realLinkedNotes;
        
        // Now save the parent note
        await saveNote(noteData);
        
    } catch (error) {
        console.error('Error saving note with temp children:', error);
        alert('Error saving note');
    }
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

// Generate default title for new child note
function generateChildNoteTitle(parentNote) {
    // Count existing child notes
    const childCount = parentNote.linkedNotes ? parentNote.linkedNotes.filter(id => {
        const note = getAllNotesFromCache().find(n => n.id === id);
        return note && note.isChildNote;
    }).length : 0;
    
    return `New ${childCount + 1} - ${new Date().toLocaleDateString()}`;
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
        code: notes.filter(n => n.type === 'code').length,
        interview: notes.filter(n => n.type === 'interview').length
    };
    
    document.getElementById('countAll').textContent = counts.all;
    document.getElementById('countNote').textContent = counts.note;
    document.getElementById('countIelts').textContent = counts.ielts;
    document.getElementById('countCourse').textContent = counts.course;
    document.getElementById('countCode').textContent = counts.code;
    document.getElementById('countInterview').textContent = counts.interview;
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
    
    // Don't trim or limit consecutive line breaks - preserve all whitespace
    return plainText;
}

// Clean HTML content for preview - minimal cleaning to preserve formatting
function cleanHtmlForPreview(html) {
    if (!html) return '';
    
    // Only remove completely empty tags (no content at all)
    let cleaned = html
        .replace(/<div[^>]*><\/div>/gi, '')
        .replace(/<p[^>]*><\/p>/gi, '')
        .replace(/<span[^>]*><\/span>/gi, '');
    
    // Don't trim or remove line breaks - preserve all formatting
    return cleaned;
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
    const textarea = document.createElement('textarea');
    textarea.value = currentText;
    textarea.className = 'inline-edit-input';
    textarea.rows = 1;
    
    // Auto-resize textarea based on content
    const autoResize = () => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    };
    
    const saveTitle = async () => {
        const newTitle = textarea.value.trim();
        if (newTitle && newTitle !== currentText) {
            currentNote.title = newTitle;
            await saveNote(currentNote);
        }
        showViewMode();
    };
    
    textarea.addEventListener('blur', saveTitle);
    textarea.addEventListener('input', autoResize);
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveTitle();
        } else if (e.key === 'Escape') {
            showViewMode();
        }
    });
    
    element.replaceWith(textarea);
    textarea.focus();
    textarea.select();
    autoResize();
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
                (editorState && editorState.wordCountEnabled !== currentNote.wordCountEnabled)) {
                currentNote.content = newContent;
                if (editorState) {
                    currentNote.wordCountEnabled = editorState.wordCountEnabled;
                }
                await saveNote(currentNote);
            }
        },
        currentNote // Pass current note data for state restoration
    );
}

// Linked Notes Functions
async function openLinkedNotesModal() {
    // Get all notes from memory cache (instant - no API call)
    const allNotes = getAllNotesFromCache();
    const availableNotes = allNotes.filter(n => n.id !== currentNote?.id && n.type !== 'source' && n.type !== 'secret' && !n.isChildNote);
    
    const modal = document.createElement('div');
    modal.className = 'linked-notes-modal';
    modal.innerHTML = `
        <div class="linked-notes-modal-content">
            <div class="linked-notes-modal-header">
                <h3>Select Notes to Link</h3>
                <button class="btn-close" onclick="closeLinkedNotesModal()">×</button>
            </div>
            <div class="linked-notes-modal-search">
                <input type="text" id="linkedNotesSearch" placeholder="Search by title, content, or type (note, code, ielts, course)..." class="search-input">
            </div>
            <div class="linked-notes-modal-body" id="linkedNotesModalBody">
                ${renderLinkedNotesOptionsFromList(availableNotes)}
            </div>
            <div class="linked-notes-modal-footer">
                <button class="btn btn-primary" onclick="closeLinkedNotesModal()">Done</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Trigger animation
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
    });
    
    // Setup search with debounce for better performance
    const searchInput = document.getElementById('linkedNotesSearch');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const query = e.target.value.toLowerCase();
            const filteredNotes = availableNotes.filter(n => {
                // Search in title
                const matchTitle = n.title.toLowerCase().includes(query);
                
                // Search in content
                const matchContent = n.content && n.content.toLowerCase().includes(query);
                
                // Search in type (e.g., "note", "code", "ielts", "course")
                const matchType = n.type.toLowerCase().includes(query);
                
                return matchTitle || matchContent || matchType;
            });
            document.getElementById('linkedNotesModalBody').innerHTML = renderLinkedNotesOptionsFromList(filteredNotes);
        }, 200); // Debounce 200ms
    });
    
    // Focus search
    setTimeout(() => searchInput.focus(), 100);
    
    // Close on ESC key
    const handleEsc = (e) => {
        if (e.key === 'Escape') {
            closeLinkedNotesModal();
            document.removeEventListener('keydown', handleEsc);
        }
    };
    document.addEventListener('keydown', handleEsc);
}

function renderLinkedNotesOptionsFromList(notesToRender) {
    const selectedIds = getSelectedLinkedNotes();
    
    if (notesToRender.length === 0) {
        return '<div class="no-notes-available">No notes available</div>';
    }
    
    return notesToRender.map(note => `
        <div class="linked-note-option ${selectedIds.includes(note.id) ? 'selected' : ''}" 
             onclick="toggleLinkedNote('${note.id}')">
            <div class="linked-note-option-content">
                <div class="linked-note-option-title">${note.isChildNote ? '📄 ' : ''}${escapeHtml(note.title)}</div>
                <div class="linked-note-option-meta">
                    <span class="meta-badge">${getTypeLabel(note.type)}</span>
                    <span class="meta-badge">${formatDate(note.createdAt)}</span>
                    ${note.isChildNote ? '<span class="meta-badge child-badge">Child Note</span>' : ''}
                </div>
            </div>
            <div class="linked-note-option-check">
                ${selectedIds.includes(note.id) ? '✓' : ''}
            </div>
        </div>
    `).join('');
}

function renderLinkedNotesOptions(notesToRender = null) {
    const availableNotes = notesToRender || notes.filter(n => n.id !== currentNote?.id);
    const selectedIds = getSelectedLinkedNotes();
    
    if (availableNotes.length === 0) {
        return '<div class="no-notes-available">No notes available</div>';
    }
    
    return availableNotes.map(note => `
        <div class="linked-note-option ${selectedIds.includes(note.id) ? 'selected' : ''}" 
             onclick="toggleLinkedNote('${note.id}')">
            <div class="linked-note-option-content">
                <div class="linked-note-option-title">${note.isChildNote ? '📄 ' : ''}${escapeHtml(note.title)}</div>
                <div class="linked-note-option-meta">
                    <span class="meta-badge">${getTypeLabel(note.type)}</span>
                    <span class="meta-badge">${formatDate(note.createdAt)}</span>
                    ${note.isChildNote ? '<span class="meta-badge child-badge">Child Note</span>' : ''}
                </div>
            </div>
            <div class="linked-note-option-check">
                ${selectedIds.includes(note.id) ? '✓' : ''}
            </div>
        </div>
    `).join('');
}

async function toggleLinkedNote(noteId) {
    const selectedContainer = document.getElementById('selectedLinkedNotes');
    const countElement = document.getElementById('linkedNotesCount');
    const selectedIds = getSelectedLinkedNotes();
    
    // Get all notes from memory cache (instant - no API call)
    const allNotes = getAllNotesFromCache();
    
    if (selectedIds.includes(noteId)) {
        // Remove - just re-render without this note
        const newLinkedNotes = selectedIds.filter(id => id !== noteId);
        if (newLinkedNotes.length > 0) {
            selectedContainer.innerHTML = await renderEditChildNotesGrid(newLinkedNotes);
        } else {
            selectedContainer.innerHTML = '<div class="no-child-notes-edit">No child notes yet. Click + New or Link to add.</div>';
        }
    } else {
        // Add - re-render with new note
        const newLinkedNotes = [...selectedIds, noteId];
        selectedContainer.innerHTML = await renderEditChildNotesGrid(newLinkedNotes);
    }
    
    // Update count
    const newCount = getSelectedLinkedNotes().length;
    countElement.textContent = newCount;
    
    // Update modal display
    const modalBody = document.getElementById('linkedNotesModalBody');
    if (modalBody) {
        const searchInput = document.getElementById('linkedNotesSearch');
        const query = searchInput ? searchInput.value.toLowerCase() : '';
        const availableNotes = allNotes.filter(n => n.id !== currentNote?.id && n.type !== 'source' && n.type !== 'secret');
        const filteredNotes = query ? 
            availableNotes.filter(n => 
                n.title.toLowerCase().includes(query) || 
                (n.content && n.content.toLowerCase().includes(query))
            ) : availableNotes;
        modalBody.innerHTML = renderLinkedNotesOptionsFromList(filteredNotes);
    }
}

function removeLinkedNote(noteId) {
    const selectedContainer = document.getElementById('selectedLinkedNotes');
    const countElement = document.getElementById('linkedNotesCount');
    const chip = selectedContainer.querySelector(`[data-note-id="${noteId}"]`);
    
    if (chip) {
        chip.remove();
        
        // Update count
        const newCount = getSelectedLinkedNotes().length;
        countElement.textContent = newCount;
        
        // Show "no linked notes" message if empty
        if (newCount === 0) {
            selectedContainer.innerHTML = '<div class="no-linked-notes">No linked notes selected</div>';
        }
        
        // Update modal if open
        const modalBody = document.getElementById('linkedNotesModalBody');
        if (modalBody) {
            const searchInput = document.getElementById('linkedNotesSearch');
            const query = searchInput ? searchInput.value.toLowerCase() : '';
            const filteredNotes = query ? 
                notes.filter(n => 
                    n.id !== currentNote?.id && 
                    (n.title.toLowerCase().includes(query) || 
                     (n.content && n.content.toLowerCase().includes(query)))
                ) : null;
            modalBody.innerHTML = renderLinkedNotesOptions(filteredNotes);
        }
    }
}

function getSelectedLinkedNotes() {
    const selectedContainer = document.getElementById('selectedLinkedNotes');
    if (!selectedContainer) return currentNote?.linkedNotes || [];
    
    const chips = selectedContainer.querySelectorAll('.selected-note-chip');
    return Array.from(chips).map(chip => chip.getAttribute('data-note-id'));
}

function closeLinkedNotesModal() {
    const modal = document.querySelector('.linked-notes-modal');
    if (modal) {
        // Fade out animation
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.remove();
        }, 200);
    }
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.querySelector('.linked-notes-modal');
    if (modal && e.target === modal) {
        closeLinkedNotesModal();
    }
});


// Get all notes from memory cache (NO API CALL)
function getAllNotesFromCache() {
    return allNotesCache;
}

// Render linked notes list in view mode
async function renderLinkedNotesList(linkedNoteIds) {
    const allNotes = getAllNotesFromCache(); // Use memory cache instead of API
    
    return linkedNoteIds.map((noteId, index) => {
        const linkedNote = allNotes.find(n => n.id === noteId);
        
        return linkedNote ? `
            <div class="linked-note-content-item" data-note-id="${linkedNote.id}" data-index="${index}" oncontextmenu="showChildNoteContextMenu(event, ${index})">
                <div class="linked-note-header-bar">
                    <div class="linked-note-title-bar">
                        <span class="linked-note-icon">${linkedNote.isChildNote ? '📄' : '🔗'}</span>
                        <span class="linked-note-title-text">${escapeHtml(linkedNote.title)}</span>
                        <span class="linked-note-type-badge">${getTypeLabel(linkedNote.type)}</span>
                        ${linkedNote.isChildNote ? '<span class="child-note-badge">Child</span>' : ''}
                    </div>
                    <div class="linked-note-actions">
                        <button class="btn-open-linked-note" onclick="selectChildNote('${linkedNote.id}')" title="Open in editor">
                            Open
                        </button>
                        ${linkedNote.isChildNote 
                            ? `<button class="btn-delete-child-note" onclick="deleteChildNote('${linkedNote.id}')" title="Delete child note">×</button>`
                            : `<button class="btn-unlink-note" onclick="unlinkNote('${linkedNote.id}')" title="Unlink note">⛓️‍💥</button>`
                        }
                    </div>
                </div>
                <div class="linked-note-content-preview" ondblclick="openLinkedNoteForEdit('${linkedNote.id}')">${cleanHtmlForPreview(linkedNote.content) || '<em style="color: var(--color-text-muted);">No content</em>'}</div>
            </div>
        ` : '';
    }).join('');
}

// Render selected linked notes in edit mode
async function renderSelectedLinkedNotes(linkedNoteIds) {
    const allNotes = getAllNotesFromCache(); // Use memory cache instead of API
    
    return linkedNoteIds.map(noteId => {
        const linkedNote = allNotes.find(n => n.id === noteId);
        return linkedNote ? `
            <div class="selected-note-chip" data-note-id="${noteId}">
                <span>${linkedNote.isChildNote ? '📄 ' : ''}${escapeHtml(linkedNote.title)}</span>
                <button type="button" onclick="removeLinkedNote('${noteId}')" class="btn-remove-chip">×</button>
            </div>
        ` : '';
    }).join('');
}

// Select child note (can view child notes even though they're hidden from main list)
async function selectChildNote(id) {
    try {
        const allNotes = getAllNotesFromCache(); // Use memory cache instead of API
        const note = allNotes.find(n => n.id === id);
        
        if (note) {
            // Save parent context before switching to child note
            if (currentNote && !currentNote.isChildNote) {
                parentNoteContext = currentNote;
            }
            
            currentNote = note;
            StorageManager.saveCurrentNoteId(note.id);
            StorageManager.saveCachedNote(note);
            StorageManager.clearEditorState();
            await showViewMode();
            // Don't update notes list since child notes shouldn't appear there
        }
    } catch (error) {
        console.error('Error loading child note:', error);
    }
}

// Create a new child note
async function createChildNote() {
    if (!currentNote || !currentNote.id) {
        alert('Please save the parent note first before creating child notes.');
        return;
    }
    
    const defaultTitle = generateChildNoteTitle(currentNote);
    const title = prompt('Enter title for the new child note:', defaultTitle);
    if (!title) return;
    
    try {
        // Create new child note
        const childNoteData = {
            title: title,
            content: '<div><br></div>',
            type: currentNote.type, // Same type as parent
            isChildNote: true, // Mark as child note
            parentNoteId: currentNote.id, // Reference to parent
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        const response = await fetch(API_NOTES, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(childNoteData)
        });
        
        const newChildNote = await response.json();
        
        // Add to parent's linkedNotes
        if (!currentNote.linkedNotes) {
            currentNote.linkedNotes = [];
        }
        currentNote.linkedNotes.push(newChildNote.id);
        
        // Update parent note
        await fetch(`${API_NOTES}/${currentNote.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentNote)
        });
        
        // Refresh edit mode to show new child note
        showEditMode(currentNote);
        
        alert('Child note created! You can now edit it after saving this note.');
    } catch (error) {
        console.error('Error creating child note:', error);
        alert('Error creating child note');
    }
}


// Toggle Child Notes Section
function toggleChildNotesSection() {
    const list = document.getElementById('childNotesList');
    const toggle = document.getElementById('childNotesToggle');
    
    if (list && toggle) {
        const isCollapsed = list.classList.toggle('collapsed');
        toggle.textContent = isCollapsed ? '▲' : '▼';
        
        // Save state to localStorage
        localStorage.setItem('childNotes_collapsed', isCollapsed ? 'true' : 'false');
    }
}

// Quick create child note from view mode
async function quickCreateChildNote() {
    // Determine the actual parent note
    let actualParent = currentNote;
    
    // If current note is a child note, find its parent
    if (currentNote && currentNote.isChildNote) {
        if (currentNote.parentNoteId) {
            // Find parent from cache using parentNoteId
            const allNotes = getAllNotesFromCache();
            const parent = allNotes.find(n => n.id === currentNote.parentNoteId);
            if (parent) {
                actualParent = parent;
            } else {
                alert('Cannot find parent note. Please navigate back to the parent note first.');
                return;
            }
        } else {
            alert('Cannot create child note. Please navigate back to the parent note first.');
            return;
        }
    }
    
    if (!actualParent || !actualParent.id) {
        alert('Please save the parent note first.');
        return;
    }
    
    const defaultTitle = generateChildNoteTitle(actualParent);
    const title = prompt('Enter title for the new child note:', defaultTitle);
    if (!title) return;
    
    try {
        // Create new child note with actual parent ID
        const childNoteData = {
            title: title,
            content: '<div><br></div>',
            type: actualParent.type,
            source: '',
            tags: '',
            example: '',
            url1: '',
            url2: '',
            url3: '',
            url4: '',
            url5: '',
            isChildNote: true,
            parentNoteId: actualParent.id,
            linkedNotes: [],
            wordCountEnabled: false,
            timerDuration: '0',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        const response = await fetch(API_NOTES, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(childNoteData)
        });
        
        const newChildNote = await response.json();
        
        // Add to actual parent's linkedNotes
        if (!actualParent.linkedNotes) {
            actualParent.linkedNotes = [];
        }
        actualParent.linkedNotes.push(newChildNote.id);
        
        // Update actual parent note in API
        await fetch(`${API_NOTES}/${actualParent.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(actualParent)
        });
        
        // Update cache with new child note
        allNotesCache.push(newChildNote);
        
        // Update parent in cache
        const parentCacheIndex = allNotesCache.findIndex(n => n.id === actualParent.id);
        if (parentCacheIndex !== -1) {
            allNotesCache[parentCacheIndex] = actualParent;
        }
        
        // Switch back to parent note to show new child
        currentNote = actualParent;
        parentNoteContext = null;
        StorageManager.saveCurrentNoteId(actualParent.id);
        StorageManager.saveCachedNote(actualParent);
        await showViewMode();
    } catch (error) {
        console.error('Error creating child note:', error);
        alert('Error creating child note');
    }
}


// Open linked note for editing (double-click on content) - OPTIMIZED
async function openLinkedNoteForEdit(noteId) {
    try {
        // Get note from memory cache (INSTANT - no API call)
        const allNotes = getAllNotesFromCache();
        const note = allNotes.find(n => n.id === noteId);
        
        if (note) {
            // Set as current note temporarily for editing
            const tempCurrentNote = currentNote;
            currentNote = note;
            
            // Create container for rich text editor
            const editorContainer = document.createElement('div');
            document.body.appendChild(editorContainer);
            
            // Initialize rich text editor
            const editor = new RichTextEditor(
                editorContainer,
                note.content || '',
                async (newContent, editorState) => {
                    // Save callback
                    if (newContent !== note.content || 
                        (editorState && editorState.wordCountEnabled !== note.wordCountEnabled)) {
                        note.content = newContent;
                        if (editorState) {
                            note.wordCountEnabled = editorState.wordCountEnabled;
                        }
                        
                        // Save to API
                        await fetch(`${API_NOTES}/${note.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(note)
                        });
                        
                        // Update memory cache
                        const cacheIndex = allNotesCache.findIndex(n => n.id === note.id);
                        if (cacheIndex !== -1) allNotesCache[cacheIndex] = note;
                        
                        // Restore original current note and refresh view
                        currentNote = tempCurrentNote;
                        await showViewMode();
                    } else {
                        // Just restore if no changes
                        currentNote = tempCurrentNote;
                    }
                },
                note
            );
        }
    } catch (error) {
        console.error('Error opening linked note for edit:', error);
        alert('Error opening note');
    }
}


// Delete child note
async function deleteChildNote(childNoteId) {
    if (!confirm('Delete this child note? This action cannot be undone.')) return;
    
    try {
        // Delete the child note from API
        await fetch(`${API_NOTES}/${childNoteId}`, { 
            method: 'DELETE' 
        });
        
        // Remove from parent's linkedNotes array
        if (currentNote.linkedNotes) {
            currentNote.linkedNotes = currentNote.linkedNotes.filter(id => id !== childNoteId);
            
            // Update parent note
            await fetch(`${API_NOTES}/${currentNote.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentNote)
            });
        }
        
        // Update cache - remove deleted note
        allNotesCache = allNotesCache.filter(n => n.id !== childNoteId);
        
        // Refresh view
        await showViewMode();
    } catch (error) {
        console.error('Error deleting child note:', error);
        alert('Error deleting child note');
    }
}

// Unlink note (remove from linkedNotes but don't delete the note)
async function unlinkNote(noteId) {
    if (!confirm('Unlink this note? The note will not be deleted, just removed from this list.')) return;
    
    try {
        // Remove from parent's linkedNotes array
        if (currentNote.linkedNotes) {
            currentNote.linkedNotes = currentNote.linkedNotes.filter(id => id !== noteId);
            
            // Update parent note
            await fetch(`${API_NOTES}/${currentNote.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentNote)
            });
            
            // Update cache
            const noteIndex = allNotesCache.findIndex(n => n.id === currentNote.id);
            if (noteIndex !== -1) {
                allNotesCache[noteIndex] = currentNote;
            }
        }
        
        // Refresh view
        await showViewMode();
    } catch (error) {
        console.error('Error unlinking note:', error);
        alert('Error unlinking note');
    }
}


// Render child notes in grid layout for edit mode
async function renderEditChildNotesGrid(linkedNoteIds) {
    const allNotes = getAllNotesFromCache(); // Use memory cache instead of API
    
    // Separate child notes and linked notes
    const childNotes = [];
    const linkedNotes = [];
    
    linkedNoteIds.forEach(noteId => {
        const note = allNotes.find(n => n.id === noteId);
        if (note) {
            if (note.isChildNote) {
                childNotes.push(note);
            } else {
                linkedNotes.push(note);
            }
        }
    });
    
    let html = '';
    
    // Render child notes
    if (childNotes.length > 0) {
        html += '<div class="notes-group-label">Child Notes</div>';
        html += childNotes.map(linkedNote => {
            const isTemp = linkedNote._isTemp || linkedNote.id.startsWith('temp_child_');
            const clickHandler = isTemp ? '' : `onclick="selectChildNote('${linkedNote.id}')"`;
            const clickTitle = isTemp ? 'Save parent note first to open this child note' : 'Click to open';
            const cardStyle = isTemp ? 'opacity: 0.6; cursor: not-allowed;' : 'cursor: pointer;';
            
            return `
            <div class="child-note-card is-child" data-note-id="${linkedNote.id}" style="${cardStyle}">
                <div class="child-note-card-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0;">
                        <span class="child-note-icon">📄</span>
                        <span style="font-size: 12px; color: var(--color-text-primary); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(linkedNote.title)}</span>
                    </div>
                    <button type="button" class="btn-card-remove" onclick="removeLinkedNoteFromEdit('${linkedNote.id}')" title="Remove">×</button>
                </div>
                <div class="child-note-card-body" ${clickHandler} title="${clickTitle}">
                    <div class="child-note-card-meta">
                        <span class="child-note-type">${getTypeLabel(linkedNote.type)}</span>
                        <span class="child-badge-mini">Child</span>
                    </div>
                </div>
            </div>
        `;
        }).join('');
    }
    
    // Render linked notes
    if (linkedNotes.length > 0) {
        html += '<div class="notes-group-label">Linked Notes</div>';
        html += linkedNotes.map(linkedNote => `
            <div class="child-note-card is-linked" data-note-id="${linkedNote.id}" style="opacity: 0.6; cursor: not-allowed;">
                <div class="child-note-card-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0;">
                        <span class="child-note-icon">🔗</span>
                        <span style="font-size: 12px; color: var(--color-text-primary); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(linkedNote.title)}</span>
                    </div>
                    <button type="button" class="btn-card-remove" onclick="removeLinkedNoteFromEdit('${linkedNote.id}')" title="Unlink">×</button>
                </div>
                <div class="child-note-card-body" title="Save parent note first to open this linked note">
                    <div class="child-note-card-meta">
                        <span class="child-note-type">${getTypeLabel(linkedNote.type)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    return html || '<div class="no-child-notes-edit">No child notes yet. Click + New or Link to add.</div>';
}

// Render child notes list in edit mode (legacy - for compatibility)
async function renderEditChildNotesList(linkedNoteIds) {
    return renderEditChildNotesGrid(linkedNoteIds);
}

// Remove linked note from edit mode (just unlink, don't delete)
async function removeLinkedNoteFromEdit(noteId) {
    const selectedContainer = document.getElementById('selectedLinkedNotes');
    const countElement = document.getElementById('linkedNotesCount');
    
    // Re-render the list without this note
    const currentLinkedNotes = getSelectedLinkedNotes().filter(id => id !== noteId);
    
    if (currentLinkedNotes.length > 0) {
        selectedContainer.innerHTML = await renderEditChildNotesGrid(currentLinkedNotes);
    } else {
        selectedContainer.innerHTML = '<div class="no-child-notes-edit">No child notes yet. Click + New or Link to add.</div>';
    }
    
    // Update count
    countElement.textContent = currentLinkedNotes.length;
}

// Get selected linked notes from UI
function getSelectedLinkedNotes() {
    const selectedContainer = document.getElementById('selectedLinkedNotes');
    if (!selectedContainer) return currentNote?.linkedNotes || [];
    
    const cards = selectedContainer.querySelectorAll('.child-note-card');
    return Array.from(cards).map(card => card.getAttribute('data-note-id')).filter(id => id !== null);
}

// Create child note from edit mode
async function createChildNoteFromEdit() {
    if (!currentNote || !currentNote.id) {
        alert('Please save the parent note first before creating child notes.');
        return;
    }
    
    const defaultTitle = generateChildNoteTitle(currentNote);
    const title = prompt('Enter title for the new child note:', defaultTitle);
    if (!title) return;
    
    try {
        // Create TEMP child note (not saved to DB yet)
        const tempChildNote = {
            id: 'temp_child_' + Date.now(), // Temp ID
            title: title,
            content: '<div><br></div>',
            type: currentNote.type,
            source: '',
            tags: '',
            example: '',
            url1: '',
            url2: '',
            url3: '',
            url4: '',
            url5: '',
            isChildNote: true,
            parentNoteId: currentNote.id,
            linkedNotes: [],
            wordCountEnabled: false,
            timerDuration: '0',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            _isTemp: true // Flag to identify temp notes
        };
        
        // Add to cache temporarily (will be replaced with real note on save)
        allNotesCache.push(tempChildNote);
        
        // Add to UI
        const selectedContainer = document.getElementById('selectedLinkedNotes');
        const countElement = document.getElementById('linkedNotesCount');
        
        // Remove "no child notes" message if exists
        const noNotesMsg = selectedContainer.querySelector('.no-child-notes-edit');
        if (noNotesMsg) noNotesMsg.remove();
        
        // Get current linked notes and add new temp one
        const currentLinkedNotes = getSelectedLinkedNotes();
        currentLinkedNotes.push(tempChildNote.id);
        
        // Re-render
        selectedContainer.innerHTML = await renderEditChildNotesGrid(currentLinkedNotes);
        countElement.textContent = currentLinkedNotes.length;
        
        // No alert needed - will be saved when parent is saved
    } catch (error) {
        console.error('Error creating child note:', error);
        alert('Error creating child note');
    }
}


// Open linked notes modal from view mode
async function openLinkedNotesModalFromView() {
    if (!currentNote || !currentNote.id) {
        alert('Please save the note first.');
        return;
    }
    
    // Get all notes from memory cache (instant - no API call)
    const allNotes = getAllNotesFromCache();
    const availableNotes = allNotes.filter(n => n.id !== currentNote?.id && n.type !== 'source' && n.type !== 'secret' && !n.isChildNote);
    
    const modal = document.createElement('div');
    modal.className = 'linked-notes-modal';
    modal.innerHTML = `
        <div class="linked-notes-modal-content">
            <div class="linked-notes-modal-header">
                <h3>Link Notes to "${escapeHtml(currentNote.title)}"</h3>
                <button class="btn-close" onclick="closeLinkedNotesModalView()">×</button>
            </div>
            <div class="linked-notes-modal-search">
                <input type="text" id="linkedNotesSearchView" placeholder="Search by title, content, or type (note, code, ielts, course)..." class="search-input">
            </div>
            <div class="linked-notes-modal-body" id="linkedNotesModalBodyView">
                ${renderLinkedNotesOptionsFromListView(availableNotes)}
            </div>
            <div class="linked-notes-modal-footer">
                <button class="btn btn-primary" onclick="saveLinkedNotesFromView()">Save & Close</button>
                <button class="btn" onclick="closeLinkedNotesModalView()">Cancel</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Trigger animation
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
    });
    
    // Setup search with debounce
    const searchInput = document.getElementById('linkedNotesSearchView');
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const query = e.target.value.toLowerCase();
            const filteredNotes = availableNotes.filter(n => {
                // Search in title
                const matchTitle = n.title.toLowerCase().includes(query);
                
                // Search in content
                const matchContent = n.content && n.content.toLowerCase().includes(query);
                
                // Search in type (e.g., "note", "code", "ielts", "course")
                const matchType = n.type.toLowerCase().includes(query);
                
                return matchTitle || matchContent || matchType;
            });
            document.getElementById('linkedNotesModalBodyView').innerHTML = renderLinkedNotesOptionsFromListView(filteredNotes);
        }, 200);
    });
    
    // Focus search
    setTimeout(() => searchInput.focus(), 100);
    
    // Close on ESC key
    const handleEsc = (e) => {
        if (e.key === 'Escape') {
            closeLinkedNotesModalView();
            document.removeEventListener('keydown', handleEsc);
        }
    };
    document.addEventListener('keydown', handleEsc);
}

// Render options for view mode modal
function renderLinkedNotesOptionsFromListView(notesToRender) {
    const selectedIds = currentNote?.linkedNotes || [];
    
    if (notesToRender.length === 0) {
        return '<div class="no-notes-available">No notes available</div>';
    }
    
    return notesToRender.map(note => `
        <div class="linked-note-option ${selectedIds.includes(note.id) ? 'selected' : ''}" 
             onclick="toggleLinkedNoteView('${note.id}')">
            <div class="linked-note-option-content">
                <div class="linked-note-option-title">${note.isChildNote ? '📄 ' : ''}${escapeHtml(note.title)}</div>
                <div class="linked-note-option-meta">
                    <span class="meta-badge">${getTypeLabel(note.type)}</span>
                    <span class="meta-badge">${formatDate(note.createdAt)}</span>
                    ${note.isChildNote ? '<span class="meta-badge child-badge">Child Note</span>' : ''}
                </div>
            </div>
            <div class="linked-note-option-check">
                ${selectedIds.includes(note.id) ? '✓' : ''}
            </div>
        </div>
    `).join('');
}

// Toggle note selection in view mode
function toggleLinkedNoteView(noteId) {
    if (!currentNote.linkedNotes) {
        currentNote.linkedNotes = [];
    }
    
    const index = currentNote.linkedNotes.indexOf(noteId);
    if (index > -1) {
        currentNote.linkedNotes.splice(index, 1);
    } else {
        currentNote.linkedNotes.push(noteId);
    }
    
    // Re-render modal body
    const modalBody = document.getElementById('linkedNotesModalBodyView');
    if (modalBody) {
        const searchInput = document.getElementById('linkedNotesSearchView');
        const query = searchInput ? searchInput.value.toLowerCase() : '';
        
        const allNotes = getAllNotesFromCache(); // Use memory cache instead of API
        const availableNotes = allNotes.filter(n => n.id !== currentNote?.id && n.type !== 'source' && n.type !== 'secret');
        const filteredNotes = query ? 
            availableNotes.filter(n => 
                n.title.toLowerCase().includes(query) || 
                (n.content && n.content.toLowerCase().includes(query))
            ) : availableNotes;
        modalBody.innerHTML = renderLinkedNotesOptionsFromListView(filteredNotes);
    }
}

// Save linked notes from view mode
async function saveLinkedNotesFromView() {
    try {
        // Update note in API
        await fetch(`${API_NOTES}/${currentNote.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentNote)
        });
        
        // No need to update cache - linkedNotes is just an array of IDs
        
        // Close modal
        closeLinkedNotesModalView();
        
        // Refresh view
        await showViewMode();
    } catch (error) {
        console.error('Error saving linked notes:', error);
        alert('Error saving linked notes');
    }
}

// Close modal from view mode
function closeLinkedNotesModalView() {
    const modal = document.querySelector('.linked-notes-modal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.remove();
        }, 200);
    }
}


// Restore child notes collapsed state after rendering
function restoreChildNotesState() {
    const list = document.getElementById('childNotesList');
    const toggle = document.getElementById('childNotesToggle');
    
    if (list && toggle) {
        const savedState = localStorage.getItem('childNotes_collapsed');
        
        // Default is collapsed (true), unless user has opened it (false)
        const shouldBeCollapsed = savedState === null ? true : savedState === 'true';
        
        if (shouldBeCollapsed) {
            list.classList.add('collapsed');
            toggle.textContent = '▲';
        } else {
            list.classList.remove('collapsed');
            toggle.textContent = '▼';
        }
    }
}


// ===== REORDER CHILD NOTES WITH BUTTONS =====

let contextMenuIndex = null;
let pendingSaves = 0; // Track số lượng saves đang pending

// Warn user before leaving if there are unsaved changes
window.addEventListener('beforeunload', (e) => {
    if (pendingSaves > 0) {
        e.preventDefault();
        e.returnValue = ''; // Chrome requires returnValue to be set
        return 'You have unsaved changes. Are you sure you want to leave?';
    }
});

function showChildNoteContextMenu(event, index) {
    event.preventDefault();
    event.stopPropagation();
    
    // Remove existing context menu if any
    hideChildNoteContextMenu();
    
    contextMenuIndex = index;
    const isFirst = index === 0;
    const isLast = index === currentNote.linkedNotes.length - 1;
    
    // Create context menu
    const menu = document.createElement('div');
    menu.id = 'childNoteContextMenu';
    menu.className = 'child-note-context-menu';
    menu.innerHTML = `
        <div class="context-menu-item ${isFirst ? 'disabled' : ''}" onclick="contextMenuMoveUp()">
            <span class="context-menu-icon">▲</span>
            <span class="context-menu-text">Move Up</span>
        </div>
        <div class="context-menu-item ${isLast ? 'disabled' : ''}" onclick="contextMenuMoveDown()">
            <span class="context-menu-icon">▼</span>
            <span class="context-menu-text">Move Down</span>
        </div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" onclick="contextMenuOpen()">
            <span class="context-menu-icon">📂</span>
            <span class="context-menu-text">Open</span>
        </div>
        <div class="context-menu-item context-menu-danger" onclick="contextMenuDelete()">
            <span class="context-menu-icon">🗑</span>
            <span class="context-menu-text">Delete</span>
        </div>
    `;
    
    // Position menu at mouse
    menu.style.left = event.pageX + 'px';
    menu.style.top = event.pageY + 'px';
    
    document.body.appendChild(menu);
    
    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', hideChildNoteContextMenu);
        document.addEventListener('contextmenu', hideChildNoteContextMenu);
    }, 0);
}

function hideChildNoteContextMenu() {
    const menu = document.getElementById('childNoteContextMenu');
    if (menu) {
        menu.remove();
    }
    contextMenuIndex = null;
    document.removeEventListener('click', hideChildNoteContextMenu);
    document.removeEventListener('contextmenu', hideChildNoteContextMenu);
}

function contextMenuMoveUp() {
    if (contextMenuIndex !== null && contextMenuIndex > 0) {
        moveChildNoteUp(contextMenuIndex);
    }
    hideChildNoteContextMenu();
}

function contextMenuMoveDown() {
    if (contextMenuIndex !== null && contextMenuIndex < currentNote.linkedNotes.length - 1) {
        moveChildNoteDown(contextMenuIndex);
    }
    hideChildNoteContextMenu();
}

function contextMenuOpen() {
    if (contextMenuIndex !== null && currentNote.linkedNotes) {
        const noteId = currentNote.linkedNotes[contextMenuIndex];
        selectChildNote(noteId);
    }
    hideChildNoteContextMenu();
}

function contextMenuDelete() {
    if (contextMenuIndex !== null && currentNote.linkedNotes) {
        const noteId = currentNote.linkedNotes[contextMenuIndex];
        deleteChildNote(noteId);
    }
    hideChildNoteContextMenu();
}

async function moveChildNoteUp(index) {
    if (!currentNote || !currentNote.linkedNotes || index === 0) return;
    
    console.log('=== MOVE UP START ===');
    
    // Get container and items BEFORE swap
    const container = document.getElementById('childNotesList');
    if (!container) {
        console.log('Container not found!');
        return;
    }
    
    const items = Array.from(container.querySelectorAll('.linked-note-content-item'));
    console.log('Items before:', items.length);
    
    // Save positions BEFORE swap
    const oldPositions = items.map(item => {
        const rect = item.getBoundingClientRect();
        return { top: rect.top, id: item.dataset.noteId };
    });
    console.log('Old positions:', oldPositions);
    
    // Swap in data
    const linkedNotes = [...currentNote.linkedNotes];
    [linkedNotes[index - 1], linkedNotes[index]] = [linkedNotes[index], linkedNotes[index - 1]];
    currentNote.linkedNotes = linkedNotes;
    
    // Re-render
    await showViewMode();
    
    // Wait for next frame to ensure restoreChildNotesState() has run and items are visible
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // Get NEW items and positions AFTER swap
    const newContainer = document.getElementById('childNotesList');
    const newItems = Array.from(newContainer.querySelectorAll('.linked-note-content-item'));
    console.log('Items after:', newItems.length);
    
    const newPositions = newItems.map(item => {
        const rect = item.getBoundingClientRect();
        return { top: rect.top, id: item.dataset.noteId };
    });
    console.log('New positions:', newPositions);
    
    // Match old and new positions by note ID
    newItems.forEach((newItem) => {
        const noteId = newItem.dataset.noteId;
        const oldPos = oldPositions.find(p => p.id === noteId);
        const newPos = newPositions.find(p => p.id === noteId);
        
        if (oldPos && newPos) {
            const deltaY = oldPos.top - newPos.top;
            console.log(`Note ${noteId}: deltaY = ${deltaY}`);
            
            if (Math.abs(deltaY) > 1) {
                // Start from old position
                newItem.style.transform = `translateY(${deltaY}px)`;
                newItem.style.transition = 'none';
                
                // Force reflow
                newItem.offsetHeight;
                
                // Animate to new position
                requestAnimationFrame(() => {
                    newItem.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                    newItem.style.transform = 'translateY(0)';
                    
                    // Clean up
                    setTimeout(() => {
                        newItem.style.transition = '';
                        newItem.style.transform = '';
                    }, 400);
                });
            }
        }
    });
    
    console.log('=== MOVE UP END ===');
    
    // Save to API in background
    saveChildNotesOrder();
}

async function moveChildNoteDown(index) {
    if (!currentNote || !currentNote.linkedNotes || index === currentNote.linkedNotes.length - 1) return;
    
    console.log('=== MOVE DOWN START ===');
    
    // Get container and items BEFORE swap
    const container = document.getElementById('childNotesList');
    if (!container) {
        console.log('Container not found!');
        return;
    }
    
    const items = Array.from(container.querySelectorAll('.linked-note-content-item'));
    console.log('Items before:', items.length);
    
    // Save positions BEFORE swap
    const oldPositions = items.map(item => {
        const rect = item.getBoundingClientRect();
        return { top: rect.top, id: item.dataset.noteId };
    });
    console.log('Old positions:', oldPositions);
    
    // Swap in data
    const linkedNotes = [...currentNote.linkedNotes];
    [linkedNotes[index], linkedNotes[index + 1]] = [linkedNotes[index + 1], linkedNotes[index]];
    currentNote.linkedNotes = linkedNotes;
    
    // Re-render
    await showViewMode();
    
    // Wait for next frame to ensure restoreChildNotesState() has run and items are visible
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // Get NEW items and positions AFTER swap
    const newContainer = document.getElementById('childNotesList');
    const newItems = Array.from(newContainer.querySelectorAll('.linked-note-content-item'));
    console.log('Items after:', newItems.length);
    
    const newPositions = newItems.map(item => {
        const rect = item.getBoundingClientRect();
        return { top: rect.top, id: item.dataset.noteId };
    });
    console.log('New positions:', newPositions);
    
    // Match old and new positions by note ID
    newItems.forEach((newItem) => {
        const noteId = newItem.dataset.noteId;
        const oldPos = oldPositions.find(p => p.id === noteId);
        const newPos = newPositions.find(p => p.id === noteId);
        
        if (oldPos && newPos) {
            const deltaY = oldPos.top - newPos.top;
            console.log(`Note ${noteId}: deltaY = ${deltaY}`);
            
            if (Math.abs(deltaY) > 1) {
                // Start from old position
                newItem.style.transform = `translateY(${deltaY}px)`;
                newItem.style.transition = 'none';
                
                // Force reflow
                newItem.offsetHeight;
                
                // Animate to new position
                requestAnimationFrame(() => {
                    newItem.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
                    newItem.style.transform = 'translateY(0)';
                    
                    // Clean up
                    setTimeout(() => {
                        newItem.style.transition = '';
                        newItem.style.transform = '';
                    }, 400);
                });
            }
        }
    });
    
    console.log('=== MOVE DOWN END ===');
    
    // Save to API in background
    saveChildNotesOrder();
}

function saveChildNotesOrder() {
    // Increment pending saves counter
    pendingSaves++;
    console.log('Pending saves:', pendingSaves);
    
    // Save to API in background (fire and forget)
    fetch(`${API_NOTES}/${currentNote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentNote)
    }).then(() => {
        // Update cache after successful save
        const cacheIndex = allNotesCache.findIndex(n => n.id === currentNote.id);
        if (cacheIndex !== -1) {
            allNotesCache[cacheIndex] = currentNote;
        }
        StorageManager.saveCachedNote(currentNote);
        
        // Decrement pending saves counter
        pendingSaves--;
        console.log('Save completed. Pending saves:', pendingSaves);
    }).catch(error => {
        console.error('Error saving child notes order:', error);
        
        // Still decrement to avoid blocking user forever
        pendingSaves--;
        console.log('Save failed. Pending saves:', pendingSaves);
    });
}
