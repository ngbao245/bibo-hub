// LocalStorage Manager for Notes App
const StorageManager = {
    KEYS: {
        CURRENT_NOTE_ID: 'notes_currentNoteId',
        EDITOR_STATE: 'notes_editorState',
        CACHED_NOTE: 'notes_cachedNote',
        CURRENT_PAGE: 'app_currentPage'
    },

    // Save current note ID
    saveCurrentNoteId(noteId) {
        try {
            if (noteId) {
                localStorage.setItem(this.KEYS.CURRENT_NOTE_ID, noteId);
            } else {
                localStorage.removeItem(this.KEYS.CURRENT_NOTE_ID);
            }
        } catch (error) {
            console.error('Error saving note ID to localStorage:', error);
        }
    },

    // Load current note ID
    loadCurrentNoteId() {
        try {
            return localStorage.getItem(this.KEYS.CURRENT_NOTE_ID);
        } catch (error) {
            console.error('Error loading note ID from localStorage:', error);
            return null;
        }
    },

    // Save editor state (editing mode, form data)
    saveEditorState(state) {
        try {
            localStorage.setItem(this.KEYS.EDITOR_STATE, JSON.stringify(state));
        } catch (error) {
            console.error('Error saving editor state to localStorage:', error);
        }
    },

    // Load editor state
    loadEditorState() {
        try {
            const saved = localStorage.getItem(this.KEYS.EDITOR_STATE);
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Error loading editor state from localStorage:', error);
            return null;
        }
    },

    // Clear editor state
    clearEditorState() {
        try {
            localStorage.removeItem(this.KEYS.EDITOR_STATE);
        } catch (error) {
            console.error('Error clearing editor state:', error);
        }
    },

    // Save form data while editing
    saveFormData() {
        try {
            const formData = {
                title: document.getElementById('noteTitle')?.value || '',
                content: document.getElementById('noteContent')?.value || '',
                type: document.getElementById('noteType')?.value || 'note',
                language: document.getElementById('noteLanguage')?.value || 'vi',
                source: document.getElementById('noteSource')?.value || '',
                tags: document.getElementById('noteTags')?.value || '',
                example: document.getElementById('noteExample')?.value || '',
                url1: document.getElementById('noteUrl1')?.value || '',
                url2: document.getElementById('noteUrl2')?.value || '',
                url3: document.getElementById('noteUrl3')?.value || '',
                url4: document.getElementById('noteUrl4')?.value || '',
                url5: document.getElementById('noteUrl5')?.value || '',
                linkedNotes: window.getSelectedLinkedNotes ? window.getSelectedLinkedNotes() : []
            };
            this.saveEditorState({ isEditing: true, formData });
        } catch (error) {
            console.error('Error saving form data:', error);
        }
    },

    // Auto-save form data on input
    setupAutoSave() {
        const formFields = [
            'noteTitle', 'noteContent', 'noteType', 'noteLanguage',
            'noteSource', 'noteTags', 'noteExample',
            'noteUrl1', 'noteUrl2', 'noteUrl3', 'noteUrl4', 'noteUrl5'
        ];

        formFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('input', () => {
                    this.saveFormData();
                });
            }
        });
    },

    // Save cached note for instant display
    saveCachedNote(note) {
        try {
            if (note) {
                localStorage.setItem(this.KEYS.CACHED_NOTE, JSON.stringify(note));
            } else {
                localStorage.removeItem(this.KEYS.CACHED_NOTE);
            }
        } catch (error) {
            console.error('Error saving cached note:', error);
        }
    },

    // Load cached note
    loadCachedNote() {
        try {
            const cached = localStorage.getItem(this.KEYS.CACHED_NOTE);
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            console.error('Error loading cached note:', error);
            return null;
        }
    },

    // Clear all storage
    clearAll() {
        try {
            Object.values(this.KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
        } catch (error) {
            console.error('Error clearing storage:', error);
        }
    },

    // Save current page
    saveCurrentPage(pageName) {
        try {
            localStorage.setItem(this.KEYS.CURRENT_PAGE, pageName);
        } catch (error) {
            console.error('Error saving current page:', error);
        }
    },

    // Load current page
    loadCurrentPage() {
        try {
            return localStorage.getItem(this.KEYS.CURRENT_PAGE) || 'notes';
        } catch (error) {
            console.error('Error loading current page:', error);
            return 'notes';
        }
    }
};
