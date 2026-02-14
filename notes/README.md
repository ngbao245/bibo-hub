# Notes App

A rich text note-taking application with advanced editing features, type filtering, and mobile support.

## 📋 Overview

Notes app is a standalone note-taking application that supports rich text editing, categorization, search, and URL management. It's part of the BiBo project but can function independently.

## 🚀 Features

### Core Features
- **Create/Edit/Delete Notes**: Full CRUD operations
- **Rich Text Editor**: Advanced content editing with formatting
- **Type Filtering**: Filter by Note, IELTS, Course, Code
- **Search**: Real-time search by title and content
- **URL Management**: Store up to 5 URLs per note
- **Auto-save**: Form data auto-saved to localStorage while editing

### Rich Text Editor
- **Formatting Tools**:
  - Bold, Italic, Underline, Strikethrough
  - Highlight (yellow background)
  - Bullet lists, Numbered lists
  - Code blocks with Copy/Paste/Clear buttons
  - Clear all content
  
- **Writing Tools**:
  - **Word Count**: Toggle-able real-time counter
    - Priority 1: Count selected text
    - Priority 2: Count text between `` markers
    - Priority 3: Count all text
  - **Timer**: Session timer with start/stop
    - Persists across sessions (saved to DB)
    - Right-click to reset
  
- **Code Block Features**:
  - 3 action buttons: Copy, Paste, Clear
  - Ctrl+A: Select all code in block
  - Ctrl+C: Copy as plain text (no HTML)
  - Smart button positioning (fixed width 68px each)
  
- **Window Controls**:
  - Fullscreen mode (F11 or ⛶ button)
  - Close button (× with red hover)
  - Unsaved changes warning
  
- **Keyboard Shortcuts**:
  - `Ctrl+B`: Bold
  - `Ctrl+I`: Italic
  - `Ctrl+U`: Underline
  - `Ctrl+H`: Highlight
  - `Ctrl+S`: Save and close
  - `F11`: Toggle fullscreen
  - `Escape`: Close with confirmation if changed
  - `Tab`: Insert 4 spaces

### Mobile Interface
- **Hamburger Menu**: ☰ button to toggle sidebar
- **Responsive Design**: Optimized for ≤768px screens
- **Touch-Friendly**: Large touch targets
- **Navigation**: Hub, Notes, Tasks tabs in sidebar
- **Auto-Close**: Sidebar closes when clicking outside

## 📁 File Structure

```
notes/
├── notes.html              # Main HTML page
├── notes.css               # Styles
├── notes.js                # Main logic (CRUD, filtering, search)
├── notes-storage.js        # LocalStorage utilities
├── notes-richtext.js       # Rich text editor
├── notes-richtext.css      # Rich text editor styles
├── notes-mobile.js         # Mobile interface
└── README.md               # This file
```

## 🗄️ Database Schema

Uses MockAPI with the following structure:

```json
{
  "id": "string",
  "title": "string",
  "content": "string (HTML)",
  "type": "note|ielts|course|code|secret",
  "source": "string",
  "tags": "string (comma-separated)",
  "example": "string",
  "url1": "string",
  "url2": "string",
  "url3": "string",
  "url4": "string",
  "url5": "string",
  "wordCountEnabled": "boolean",
  "timerDuration": "string (seconds)",
  "createdAt": "ISO string",
  "updatedAt": "ISO string"
}
```

**Important Notes:**
- `type="secret"` notes are filtered out (only shown in Secret Notes modal in Hub)
- `type="source"` notes are filtered out (only shown in Sources app)
- `content` is stored as HTML (with `<br>` tags for line breaks)
- `wordCountEnabled`: Rich text editor word count toggle state
- `timerDuration`: Accumulated writing time in seconds

## 🔧 Technical Implementation

### Main Logic (notes.js)

**State Management:**
```javascript
let notes = [];              // All notes from API
let currentNote = null;      // Currently selected note
let isEditing = false;       // Edit mode flag
let searchQuery = '';        // Search filter
let currentTypeFilter = 'all'; // Type filter
```

**Key Functions:**
- `init()`: Initialize app, restore state from cache, load notes from API
- `loadNotes()`: Fetch notes from API, filter out secret/source types
- `saveNote(noteData)`: Create or update note (optimistic UI)
- `deleteNote(id)`: Delete note with confirmation
- `renderNotesList()`: Render filtered notes list
- `showViewMode()`: Display note in view mode
- `showEditMode()`: Display note in edit form
- `selectNote(id)`: Select and display note
- `newNote()`: Create new note
- `editCurrentNote()`: Switch to edit mode
- `saveCurrentNote()`: Save note from form
- `cancelEdit()`: Cancel editing

**Filtering:**
```javascript
// Filter by search query
const matchesSearch = !searchQuery || 
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase());

// Filter by type
const matchesType = currentTypeFilter === 'all' || note.type === currentTypeFilter;

// Exclude secret and source notes
const filtered = notes.filter(n => 
    n.type !== 'source' && 
    n.type !== 'secret' &&
    matchesSearch && 
    matchesType
);
```

**Rich Text Protection:**
```javascript
// Detect if content has rich text formatting
function detectRichTextContent(note) {
    const richTextTags = /<(strong|em|u|b|i|ul|ol|li|code|pre|h[1-6]|span|p)[^>]*>/i;
    const hasRichText = richTextTags.test(note.content);
    
    if (hasRichText) {
        // Make textarea readonly and show warning
        textarea.readOnly = true;
        warning.style.display = 'block';
        warning.textContent = '⚠️ This note has rich text formatting. To edit content, close this form and double-click the content in view mode.';
    }
}
```

### Rich Text Editor (notes-richtext.js)

**Class Structure:**
```javascript
class RichTextEditor {
    constructor(container, initialContent, onSave, noteData) {
        this.container = container;
        this.onSave = onSave;
        this.editor = null;
        this.initialContent = initialContent;
        this.timerInterval = null;
        this.timerSeconds = 0; // Restored from DB
        this.timerRunning = false;
        this.wordCountActive = false; // Restored from DB
        this.wordCountInterval = null;
        this.noteData = noteData;
        this.init(initialContent);
    }
}
```

**Key Methods:**
- `init(content)`: Initialize editor, restore state
- `setupEventListeners()`: Attach toolbar and keyboard events
- `setupCodeBlockButtons()`: Re-attach events to saved code blocks
- `execCommand(command)`: Execute formatting commands
- `insertCodeBlock()`: Insert code block with buttons
- `toggleHighlight()`: Toggle yellow highlight
- `toggleTimer()`: Start/stop writing timer
- `toggleWordCount()`: Activate/deactivate word counter
- `updateWordCount()`: Count words with priority logic
- `save()`: Save content and close editor
- `closeWithConfirmation()`: Check for unsaved changes

**Code Block Button Event Listeners:**
```javascript
// Problem: Buttons from saved content (DB) don't have event listeners
// Solution: Re-attach listeners when loading content

setupCodeBlockButtons() {
    const codeBlockWrappers = this.editor.querySelectorAll('.code-block-wrapper');
    
    codeBlockWrappers.forEach(wrapper => {
        const copyBtn = wrapper.querySelector('.code-copy-btn');
        const codeBlock = wrapper.querySelector('.code-block');
        
        if (copyBtn && codeBlock) {
            copyBtn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                let text = codeBlock.innerText || codeBlock.textContent;
                await navigator.clipboard.writeText(text);
                // Show "Copied" feedback
            };
        }
        // Same for pasteBtn and clearBtn
    });
}
```

**Timer Persistence:**
```javascript
// Timer duration saved to database
async function saveNote(noteData) {
    noteData.timerDuration = this.timerSeconds.toString();
    // Save to API...
}

// Timer restored when opening note
constructor(container, initialContent, onSave, noteData) {
    this.timerSeconds = parseInt(noteData.timerDuration) || 0;
    this.updateTimerDisplay();
}
```

**Word Count Priority Logic:**
```javascript
updateWordCount() {
    let text = '';
    const selection = window.getSelection();
    
    // Priority 1: Count selected text
    if (selection && selection.toString().trim().length > 0) {
        text = selection.toString();
    } 
    // Priority 2: Count text between `` markers
    else {
        const fullText = this.editor.innerText;
        const match = fullText.match(/``([\s\S]*?)``/);
        
        if (match && match[1]) {
            text = match[1];
        } else {
            text = fullText; // Priority 3: All text
        }
    }
    
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    const count = words.length;
    this.container.querySelector('.word-count-display').textContent = `${count} words`;
}
```

### Storage (notes-storage.js)

**LocalStorage Keys:**
- `notes_currentNoteId`: ID of currently open note
- `notes_editorState`: Editor state and form data
- `notes_cachedNote`: Cached note data for instant display
- `notes_typeFilter`: Current type filter selection

**Key Functions:**
- `saveCurrentNoteId(id)`: Save current note ID
- `loadCurrentNoteId()`: Load current note ID
- `saveCachedNote(note)`: Cache note data
- `loadCachedNote()`: Load cached note
- `saveEditorState(formData)`: Save form state while editing
- `loadEditorState()`: Load form state
- `clearEditorState()`: Clear form state
- `setupAutoSave()`: Setup auto-save for form inputs

**Cache Strategy:**
```javascript
// Restore state IMMEDIATELY from cache (no API wait)
function restoreStateFromCache() {
    const savedNoteId = StorageManager.loadCurrentNoteId();
    if (savedNoteId) {
        const cachedNote = StorageManager.loadCachedNote();
        if (cachedNote && cachedNote.id === savedNoteId) {
            currentNote = cachedNote;
            notes = [cachedNote]; // Temporary
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
```

### Mobile Interface (notes-mobile.js)

**Class Structure:**
```javascript
class MobileInterface {
    constructor() {
        this.isMobile = window.innerWidth <= 768;
        this.sidebarVisible = false;
        this.init();
    }
    
    init() {
        if (!this.isMobile) return;
        this.createMobileHeader();
        this.setupSidebarToggle();
    }
}
```

**Mobile Header:**
```html
<div class="mobile-header">
    <button class="mobile-hamburger">☰</button>
    <h2>Notes</h2>
</div>
```

**Sidebar Toggle:**
```javascript
toggleSidebar() {
    this.sidebarVisible = !this.sidebarVisible;
    const sidebar = document.querySelector('.sidebar');
    const hamburger = document.querySelector('.mobile-hamburger');
    
    if (this.sidebarVisible) {
        sidebar.classList.add('mobile-visible');
        hamburger.textContent = '✕';
    } else {
        sidebar.classList.remove('mobile-visible');
        hamburger.textContent = '☰';
    }
}
```

## 🎨 Styling

### CSS Variables (from common.css)
```css
:root {
    --color-accent-primary: #007acc;
    --color-bg-primary: #1e1e1e;
    --color-bg-elevated: #2d2d30;
    --color-text-primary: #d4d4d4;
    --color-bg-secondary: #252526;
    --color-border: #3e3e42;
}
```

### Key CSS Classes
- `.sidebar`: Left sidebar with notes list
- `.editor-container`: Right panel with editor
- `.note-item`: Note list item
- `.note-item.active`: Selected note
- `.editor-header`: Editor header with title and actions
- `.view-mode`: View mode display
- `.editor-content`: Edit form
- `.richtext-modal`: Rich text editor modal
- `.mobile-header`: Mobile header with hamburger
- `.mobile-visible`: Sidebar visible on mobile

## 🔌 Dependencies

### External
- `../common.css`: Shared styles (colors, buttons, scrollbar)
- `../config.js`: API configuration

### Internal
- `notes.css`: Notes-specific styles
- `notes.js`: Main logic
- `notes-storage.js`: LocalStorage utilities
- `notes-richtext.js`: Rich text editor
- `notes-richtext.css`: Editor styles
- `notes-mobile.js`: Mobile interface

### Global Modals (Optional)
- `../translate/translate-loader.js`: Translate modal
- `../modals/calculator-loader.js`: Calculator modal
- `../encoder/encoder-loader.js`: Encoder modal
- `../backup/backup-loader.js`: Backup modal
- `../global-shortcuts.js`: Keyboard shortcuts

## 🚀 Usage

### Basic Usage
1. Open `notes.html` in browser
2. Click "+" to create new note
3. Fill in title, content, type, tags, URLs
4. Click "Save" to save note
5. Double-click content to open rich text editor

### Rich Text Editing
1. Select note in view mode
2. Double-click content area
3. Use toolbar or keyboard shortcuts
4. Click word count button to activate counter
5. Click timer button to start/stop timer
6. Press F11 for fullscreen mode
7. Ctrl+S to save, Escape to close

### Code Blocks
1. Click `</>` button or Ctrl+Shift+C
2. Type or paste code
3. Use Copy/Paste/Clear buttons
4. Ctrl+A to select all code in block
5. Ctrl+C to copy as plain text

### Mobile Usage
1. Tap ☰ to open sidebar
2. Select note from list
3. Tap outside or ✕ to close sidebar
4. Edit note normally

## ⚙️ Configuration

### API Setup
Edit `../config.js`:
```javascript
const API_CONFIG = {
    NOTES: 'https://your-api.mockapi.io/notes',
    // ...
};
```

### Type Filter
Types are defined in code:
```javascript
const types = ['note', 'ielts', 'course', 'code'];
```

To add new type:
1. Add to types array in `notes.js`
2. Add to type dropdown in `showEditMode()`
3. Add to filter sidebar in `notes.html`
4. Update `updateTypeCounts()` function

## 🐛 Troubleshooting

### Notes not loading
- Check API URL in `config.js`
- Open Console (F12) for errors
- Verify MockAPI is accessible

### Rich text not saving
- Check if content has rich text tags
- Verify `detectRichTextContent()` is working
- Edit via rich text editor (double-click content)

### Code block buttons not working
- Check `setupCodeBlockButtons()` is called after loading content
- Verify event listeners are attached
- Check Console for errors

### Timer not persisting
- Verify `timerDuration` field exists in database
- Check `noteData.timerDuration` is passed to editor
- Verify timer is saved when closing editor

### Word count not working
- Click word count button to activate
- Check `wordCountActive` state
- Verify `updateWordCount()` is called every 0.5s

### Mobile sidebar not showing
- Check screen width ≤768px
- Verify `notes-mobile.js` is loaded
- Check `.mobile-visible` class is added

### Child notes showing extra whitespace
**Problem**: Child note content displays with unwanted spaces/line breaks at the beginning, while parent note content displays correctly.

**Root Cause**: HTML whitespace in template strings. When you write HTML with line breaks and indentation like this:
```javascript
<div class="linked-note-content-preview">
    ${content}
</div>
```

Browser creates **text nodes** containing the whitespace (line breaks + spaces), which get rendered as visible spaces on screen.

**Solution**: Write HTML on a single line without line breaks between opening tag and content:
```javascript
// ❌ BAD - Creates whitespace nodes
<div class="linked-note-content-preview">
    ${content}
</div>

// ✅ GOOD - No whitespace nodes
<div class="linked-note-content-preview">${content}</div>
```

**Where to check**: 
- `renderLinkedNotesList()` function in `notes.js`
- Any template string that renders user content
- Look for line breaks between `>` and `${variable}`

**Why parent notes don't have this issue**: Parent note content is rendered on a single line:
```javascript
<div class="content-text editable-content" ondblclick="editContent(this)">${currentNote.content || ''}</div>
```

**Technical explanation**: 
- HTML spec says whitespace between tags is preserved as text nodes
- Browser renders these text nodes as actual spaces
- Single-line HTML eliminates these whitespace text nodes
- This is standard HTML/browser behavior, not a bug

## 📝 Development Notes

### Adding New Features

**New Note Field:**
1. Add field to database schema
2. Add input to `showEditMode()` form
3. Add to `saveCurrentNote()` data collection
4. Add to `showViewMode()` display

**New Formatting Tool:**
1. Add button to toolbar in `notes-richtext.js`
2. Add command to `execCommand()` switch
3. Add keyboard shortcut to `handleKeydown()`
4. Add active state to `updateToolbar()`

**New Type:**
1. Add to types array
2. Add to dropdown options
3. Add to filter sidebar
4. Update counts function

### Code Style

**Naming Conventions:**
- Functions: camelCase (`loadNotes`, `saveNote`)
- Classes: PascalCase (`RichTextEditor`, `MobileInterface`)
- Constants: UPPER_SNAKE_CASE (`API_NOTES`, `STORAGE_KEYS`)
- CSS classes: kebab-case (`.note-item`, `.editor-header`)

**File Organization:**
- Main logic in `notes.js`
- Storage utilities in `notes-storage.js`
- Rich text editor in `notes-richtext.js`
- Mobile interface in `notes-mobile.js`
- Styles in `notes.css` and `notes-richtext.css`

### Performance Optimizations
- **Debounced Search**: 300ms delay
- **Optimistic UI**: Update UI first, API later
- **Cache Strategy**: LocalStorage for instant load
- **Event Delegation**: Avoid many event listeners
- **Lazy Loading**: Rich text editor loads on demand

## 🔗 Related Documentation

- `../README.md`: Global project overview
- `../PROJECT-STRUCTURE.md`: Project structure
- `../shortcut/GLOBAL-MODAL-POPUP-GUIDE.md`: Global modals guide
- `../tasks/README.md`: Tasks app documentation (if exists)

## 📞 Support

For issues or questions:
1. Check this README first
2. Check browser Console for errors
3. Verify API configuration
4. Check related documentation

---

**Version**: 2.10.2  
**Last Updated**: February 2026  
**Part of**: BiBo Project  
**Tech Stack**: Vanilla JavaScript, MockAPI, CSS Variables
