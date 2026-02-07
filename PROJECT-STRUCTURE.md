# Project Structure

## Overview
Dự án đã được refactor thành cấu trúc modular với các mini projects riêng biệt.

## Directory Structure

```
project/
├── index.html              # Redirect to hub.html or last visited page
├── hub.html                # Main hub with tool grid
├── config.js               # API configuration
├── common.css              # Shared styles for all projects
├── shortcuts-config.js     # Keyboard shortcuts configuration (single source of truth)
├── global-shortcuts.js     # Global keyboard shortcuts handler
├── shortcuts-loader.js     # Shortcuts modal loader
├── package.json            # Project metadata
├── PROJECT-STRUCTURE.md    # This file
├── README.md               # Project readme
├── Global Modal Popup Guide.md  # Guide for creating global modals
│
├── .vscode/                # VSCode settings
│   └── settings.json
│
├── assets/                 # Shared assets
│   └── icon.png
│
├── notes/                  # Notes Project
│   ├── notes.html
│   ├── notes.css
│   ├── notes.js
│   ├── notes-storage.js
│   ├── notes-richtext.js
│   ├── notes-richtext.css
│   └── notes-mobile.js
│
├── tasks/                  # Tasks Project
│   ├── tasks.html
│   ├── tasks.css
│   ├── tasks.js
│   ├── tasks-storage.js
│   └── tasks-mobile.js
│
├── backup/                 # Backup Modal
│   ├── backup-loader.js    # Dynamic modal loader
│   ├── backup-modal.css    # Modal styles
│   └── backup-modal.js     # Modal logic (includes openBackupModal, closeBackupModal)
│
├── encoder/                # Encoder Modal
│   ├── encoder-loader.js   # Dynamic modal loader
│   ├── encoder-modal.css   # Modal styles
│   └── encoder-modal.js    # Modal logic (includes openEncoderModal, closeEncoderModal)
│
├── translate/              # Translate Modal
│   ├── translate-loader.js # Dynamic modal loader
│   ├── translate-modal.css # Translate modal styles
│   └── translate-modal.js  # Translate modal logic (includes openTranslateModal, closeTranslateModal)
│
├── sources/                # Sources Modal (Hub only)
│   ├── sources-modal.css   # Sources modal styles
│   ├── sources-modal.js    # Sources modal logic
│   ├── sources.css         # Sources page styles
│   ├── sources.html        # Sources standalone page
│   └── sources.js          # Sources page logic
│
└── modals/                 # Calculator Modal
    ├── calculator-loader.js # Dynamic modal loader
    ├── calculator-modal.css # Calculator modal styles
    └── calculator-modal.js  # Calculator modal logic (includes openCalculatorModal, closeCalculatorModal)
```

## Global Modal Architecture

### How Global Modals Work

**Problem Solved:**
- Modals need to be accessible from any page (notes, tasks, hub)
- CORS blocks `fetch()` for local HTML files (file:// protocol)
- Don't want to duplicate modal HTML in every page

**Solution: Dynamic Modal Loading with Lazy Initialization**

**Architecture:**
```
Single Source of Truth
├── shortcuts-config.js          # All keyboard shortcuts defined here
    ↓
├── global-shortcuts.js          # Reads SHORTCUTS_CONFIG, handles keyboard events
└── shortcuts-loader.js          # Reads SHORTCUTS_CONFIG, renders shortcuts modal

Modal Loaders
├── {modal}-loader.js            # Lazy loads modal on demand with toggle support
├── {modal}-modal.css            # Modal styles
└── {modal}-modal.js             # Modal logic
```

**How It Works:**
1. **Single Config**: Edit `shortcuts-config.js` to add/modify shortcuts
2. **Global Shortcuts**: `global-shortcuts.js` listens for keyboard shortcuts on all pages
3. **Lazy Loading**: When shortcut pressed, calls `open{Modal}Lazy()` function
4. **CSS First**: Load CSS and wait → Then inject HTML → Prevents flash
5. **Dynamic Injection**: Loader injects HTML into DOM, loads CSS/JS files
6. **Toggle Support**: Press once to open, press again to close
7. **Path Detection**: Auto-detects if running from notes/, tasks/, or root
8. **One-Time Load**: Modal only loads once, subsequent opens are instant
9. **High z-index**: Modals use z-index: 10000 to appear above everything

**Benefits:**
- ✅ Easy to configure (edit one file: `shortcuts-config.js`)
- ✅ Works with file:// protocol (no server needed)
- ✅ No CORS issues (HTML injected via JavaScript, not fetched)
- ✅ No flash of unstyled content (CSS loads first)
- ✅ Global access from any page with keyboard shortcuts
- ✅ Toggle UX (press once to open, again to close)
- ✅ Lazy loading (better performance, only loads when needed)
- ✅ Modular (each modal has separate CSS/JS files)
- ✅ No duplication (modal HTML defined once in loader)
- ✅ Alt key usage (avoids browser shortcut conflicts)
- ✅ Easy to add new global modals (follow pattern in "Global Modal Popup Guide.md")

### Global Modal Structure Pattern

Each global modal follows this pattern:

**Loader (folder/modal-name-loader.js):**
```javascript
let modalNameLoaded = false;

async function loadModalName() {
    if (modalNameLoaded) return;
    
    try {
        // Detect current path
        const basePath = window.location.pathname.includes('/notes/') || 
                         window.location.pathname.includes('/tasks/') ? '../' : './';
        
        // Inject HTML directly
        const html = `
            <div id="modalNameModal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <span class="modal-title">Modal Title</span>
                        <button onclick="closeModalName()" class="modal-close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <!-- Modal content -->
                    </div>
                </div>
            </div>
        `;
        
        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container.firstElementChild);
        
        // Load CSS
        if (!document.querySelector('link[href*="modal-name-modal.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = basePath + 'folder/modal-name-modal.css';
            document.head.appendChild(link);
        }
        
        // Load JS - wait for it
        if (typeof openModalName === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = basePath + 'folder/modal-name-modal.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        modalNameLoaded = true;
    } catch (error) {
        console.error('Error loading modal:', error);
    }
}

// Lazy open function
async function openModalNameLazy() {
    await loadModalName();
    if (typeof openModalName === 'function') {
        openModalName();
    }
}
```

**CSS (folder/modal-name-modal.css):**
```css
.modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 10000; /* High z-index to appear above everything */
    align-items: center;
    justify-content: center;
}

.modal.show {
    display: flex;
}

.modal-content {
    background: var(--color-bg-elevated);
    /* ... specific modal styles ... */
}
```

**JS (folder/modal-name-modal.js):**
```javascript
function openModalName() {
    document.getElementById('modalNameModal').classList.add('show');
}

function closeModalName() {
    document.getElementById('modalNameModal').classList.remove('show');
}

// ... modal-specific logic ...
```

**Loading in pages (notes.html, tasks.html, hub.html):**
```html
<script src="../folder/modal-name-loader.js"></script>
<script src="../global-shortcuts.js"></script>
```

**Register in global-shortcuts.js:**
```javascript
const GLOBAL_SHORTCUTS = {
    'ctrl+x': { name: 'Modal Name', action: 'openModalNameLazy' },
    // ... other shortcuts
};
```

## File Naming Convention

### HTML Files
- `{project}.html` - Main HTML file for each project
- Example: `notes.html`, `tasks.html`, `backup.html`

### CSS Files
- `common.css` - Shared styles (colors, buttons, scrollbar, navigation)
- `{project}.css` - Project-specific styles
- Example: `notes.css`, `tasks.css`, `backup.css`

### JavaScript Files
- `{project}.js` - Main logic
- `{project}-{feature}.js` - Feature-specific logic
- Example: `notes.js`, `notes-storage.js`, `notes-richtext.js`

## Projects

### 1. Hub (hub.html)
**Purpose:** Main landing page with grid of all tools

**Features:**
- Tool grid with icons
- Modals for quick tools (Translate, Calculator, Encoder, Backup)
- Links to standalone projects (Notes, Tasks)
- Modal HTML embedded (CORS limitation)
- Modal CSS/JS loaded separately

**Modal System:**
- **Translate Modal**: Auto-detect Vietnamese/English translation
- **Calculator Modal**: Basic calculator with keyboard support
- **Encoder Modal**: Encode API URLs for config.js
- **Backup Modal**: Export/import notes data

**Dependencies:**
- `common.css`
- `config.js`
- `modals/translate-modal.css` + `.js`
- `modals/calculator-modal.css` + `.js`
- `backup/backup-modal.css` + `.js`
- `encoder/encoder-modal.css` + `.js`

**Global Modal Handlers:**
- ESC key closes all modals
- Click outside modal to close
- Each modal has its own open/close functions

### 2. Notes (notes/)
**Purpose:** Note-taking app with rich text editor

**Features:**
- Create/edit/delete notes
- Rich text formatting
- Type filtering (Note, IELTS, Code, Course)
- Search functionality
- Timer duration tracking
- Word count

**Files:**
- `notes.html` - Main page
- `notes.css` - Styles
- `notes.js` - Main logic
- `notes-storage.js` - LocalStorage utilities
- `notes-richtext.js` - Rich text editor
- `notes-richtext.css` - Editor styles
- `notes-mobile.js` - Mobile responsive

**Dependencies:**
- `../common.css`
- `../config.js`

### 3. Tasks (tasks/)
**Purpose:** Task management app

**Features:**
- Create/edit/delete tasks
- Task lists
- Task status tracking

**Files:**
- `tasks.html` - Main page
- `tasks.css` - Styles
- `tasks.js` - Main logic
- `tasks-storage.js` - LocalStorage utilities
- `tasks-mobile.js` - Mobile responsive

**Dependencies:**
- `../common.css`
- `../config.js`

### 4. Backup (backup/)
**Purpose:** Export/import notes data

**Features:**
- Export all notes as JSON
- Import with merge or replace
- Statistics display (Total, IELTS, Code, Course)
- Modal version only (no standalone page)

**Files:**
- `backup-modal.css` - Modal styles
- `backup-modal.js` - Modal logic

**Functions:**
- `openBackupModal()` - Opens modal and loads statistics
- `closeBackupModal()` - Closes modal
- `dmExportNotes()` - Export notes as JSON file
- `dmImportNotes(mode)` - Import notes (merge/replace)
- `dmLoadStatistics()` - Load and display note counts

**Dependencies:**
- `../common.css`
- `../config.js`

**Integration:**
- Modal HTML embedded in `hub.html`
- CSS and JS loaded separately
- Accessed via "Backup" button in hub

### 5. Encoder (encoder/)
**Purpose:** Encode API URLs for security

**Features:**
- Base64 + reverse encoding
- Copy to clipboard
- Usage instructions in Vietnamese
- Modal version only (no standalone page)

**Files:**
- `encoder-modal.css` - Modal styles
- `encoder-modal.js` - Modal logic

**Functions:**
- `openEncoderModal()` - Opens modal with default URL
- `closeEncoderModal()` - Closes modal
- `encodeAPI()` - Encodes input URL
- `copyEncoderOutput()` - Copies encoded string to clipboard

**Dependencies:**
- `../common.css`

**Integration:**
- Modal HTML embedded in `hub.html`
- CSS and JS loaded separately
- Accessed via "Encoder" button in hub

### 6. Modals (modals/)
**Purpose:** Shared modal components

**Translate Modal:**
- Auto-detect Vietnamese/English
- Real-time translation (500ms debounce)
- Copy and clear functions
- Files: `translate-modal.css`, `translate-modal.js`

**Calculator Modal:**
- Basic arithmetic operations
- Keyboard support
- Clear and backspace functions
- Files: `calculator-modal.css`, `calculator-modal.js`

**Dependencies:**
- `../common.css`

**Integration:**
- Modal HTML embedded in `hub.html`
- CSS and JS loaded separately
- Accessed via respective buttons in hub

## Navigation

### From Hub
- Click tool button → Opens modal or navigates to standalone page
- Notes button → `notes/notes.html`
- Tasks button → `tasks/tasks.html`
- Backup button → Opens modal in hub
- Encoder button → Opens modal in hub

### From Projects
- Navigation bar at top
- Notes ↔ Tasks ↔ Hub

## Shared Resources

### common.css
Contains:
- CSS Variables (colors, spacing, fonts)
- Reset styles
- Common buttons
- Scrollbar styles
- App navigation
- Text selection rules

### config.js
Contains:
- API endpoints
- Configuration settings

## Development Guidelines

### Adding New Global Modal

**See "Global Modal Popup Guide.md" for detailed step-by-step instructions.**

**Quick Steps:**

1. **Create modal files:**
   ```
   folder/
   ├── modal-name-loader.js    # Dynamic loader
   ├── modal-name-modal.css    # Styles
   └── modal-name-modal.js     # Logic
   ```

2. **Create loader** (see pattern above or guide)

3. **Create CSS** with `z-index: 10000`

4. **Create JS** with open/close functions

5. **Register in shortcuts-config.js:**
   ```javascript
   const SHORTCUTS_CONFIG = {
       'alt+x': { name: 'Modal Name', action: 'openModalNameLazy' },
   };
   ```

6. **Load in pages:**
   ```html
   <script src="../folder/modal-name-loader.js"></script>
   <script src="../shortcuts-config.js"></script>
   <script src="../global-shortcuts.js"></script>
   ```

7. **Add button to hub (optional):**
   ```html
   <button class="tool-btn" onclick="openModalNameLazy()">
       <span class="tool-icon">🔧</span>
       Tool Name
   </button>
   ```

### Adding New Project
1. Create folder: `{project}/`
2. Create files:
   - `{project}.html`
   - `{project}.css`
   - `{project}.js`
3. Link to `common.css`
4. Add button in `hub.html`
5. Update navigation in other projects

### Modifying Styles
- **Common styles** → Edit `common.css`
- **Project-specific** → Edit `{project}.css`
- **Never modify** CSS variables in common.css without testing all projects

### File Paths
- From project folder to root: `../`
- From root to project: `{project}/`
- Example: `<link href="../common.css">` in project files

## Migration Notes

### Old Structure → New Structure
- `index.html` → `notes/notes.html` (now redirects to hub or last page)
- `app.js` → `notes/notes.js`
- `storage.js` → `notes/notes-storage.js` & `tasks/tasks-storage.js`
- `richtext-editor.js` → `notes/notes-richtext.js`
- `mobile.js` → `notes/notes-mobile.js` & `tasks/tasks-mobile.js`
- `tasks.html` → `tasks/tasks.html`
- `encoder.html` → `encoder/encoder-modal.js` (modal only)
- `data-manager.html` → `backup/backup-modal.js` (modal only)

### Deprecated Files
All old files have been removed. The project now uses the new modular structure.

### Modal Refactoring History

**v2.9.0 (Current): Global Modal System with Toggle**
- **Change**: Dynamic modal loading with lazy initialization and toggle support
- **New Files**: `shortcuts-config.js` (single source of truth), `*-loader.js` for each modal, `global-shortcuts.js`, `shortcuts-loader.js`
- **Benefit**: Easy config, global access, keyboard shortcuts, toggle UX, lazy loading, no flash
- **How**: CSS loads first → HTML injected → JS loaded, Alt key usage to avoid browser conflicts

**v2.8.0: Modular Hub Architecture**
- **Before**: Standalone HTML files for each tool
- **After**: Modal system with embedded HTML, separate CSS/JS
- **Reason**: CORS limitation with file:// protocol
- **Benefit**: Cleaner hub, modular styles/logic, no server needed

## Benefits of New Structure

1. **Modularity** - Each project/modal is self-contained
2. **Reusability** - Shared styles in common.css
3. **Maintainability** - Easy to find and edit project/modal files
4. **Scalability** - Easy to add new projects/modals
5. **Clean** - No clutter in root directory
6. **Clear naming** - File names indicate purpose
7. **CORS Compatible** - Works with file:// protocol (no server needed)
8. **Separation of Concerns** - HTML in hub, styles/logic separate

## Key Technical Decisions

### Why Dynamic Modal Loading (v2.9.0)
**Problem**: Need modals accessible from any page, but CORS blocks `fetch()` for local files
**Solution**: Inject HTML via JavaScript, load CSS/JS dynamically
**Benefits**:
- ✅ No CORS issues (HTML injected, not fetched)
- ✅ Global access from any page with keyboard shortcuts
- ✅ Lazy loading (better performance)
- ✅ Modular (separate CSS/JS files)
- ✅ No duplication (modal HTML in loader only)

### Why Lazy Loading
**Benefit**: Modals only load when first opened (better initial page load)
**Performance**: Reduces initial JavaScript execution time
**User Experience**: Instant page load, modals load on demand
**Memory**: Only loads what's needed

### Why Separate CSS/JS Files
**Benefit**: Each modal can be updated independently
**Maintainability**: Easy to find and modify specific modal styles/logic
**Reusability**: Modal styles can be reused in other contexts
**Clean Code**: Separation of concerns (structure/style/behavior)

### Why Global Shortcuts
**User Experience**: Quick access to tools from anywhere
**Productivity**: No need to navigate to hub to open modals
**Consistency**: Same shortcuts work on all pages
**Flexibility**: Hub buttons still work for mouse users

## Context for Future Development

### When Adding New Features

**For Hub Modals:**
1. Check if feature is a quick tool (< 1 screen, simple interaction)
2. If yes → Create modal (CSS + JS files, HTML in hub.html)
3. If no → Create standalone project (separate folder with HTML/CSS/JS)

**For Existing Projects:**
1. Notes and Tasks are full applications with their own pages
2. Keep their files in respective folders
3. Share common styles via common.css
4. Mobile enhancements in separate `-mobile.js` files

**For Shared Resources:**
1. Common styles → `common.css`
2. API config → `config.js`
3. Assets → `assets/` folder
4. Documentation → `README.md` and `PROJECT-STRUCTURE.md`

### Code Style Guidelines

**Modal Functions:**
- Always prefix with modal name: `openModalNameModal()`, `closeModalNameModal()`
- Use consistent naming: `modalNameModal` for ID, `modal-name-modal.css` for file

**CSS Classes:**
- Use `.modal` for base modal container
- Use `.modal-content` for modal content wrapper
- Use `.modal-header`, `.modal-body`, `.modal-footer` for sections
- Prefix specific classes with modal name: `.dm-stats`, `.calc-btn`, etc.

**File Naming:**
- Modals: `modal-name-modal.css`, `modal-name-modal.js`
- Projects: `project-name.html`, `project-name.css`, `project-name.js`
- Features: `project-name-feature.js` (e.g., `notes-richtext.js`)

### Understanding the Codebase

**Entry Points:**
- `index.html` - Redirects to hub or last visited page
- `hub.html` - Main hub with all modals
- `notes/notes.html` - Notes application
- `tasks/tasks.html` - Tasks application

**Navigation Flow:**
```
index.html
    ↓
[Check localStorage for last page]
    ↓
hub.html OR notes/notes.html OR tasks/tasks.html
    ↓
[User navigates between pages]
    ↓
[localStorage saves current page]
```

**Modal Flow:**
```
hub.html loads
    ↓
[User clicks tool button]
    ↓
openModalNameModal() called
    ↓
Modal shows with .show class
    ↓
[User interacts with modal]
    ↓
closeModalNameModal() or ESC or click outside
    ↓
Modal hides by removing .show class
```

**Project Flow:**
```
notes/notes.html OR tasks/tasks.html loads
    ↓
[Loads common.css + project.css]
    ↓
[Loads project.js + storage.js + mobile.js]
    ↓
[Initializes app]
    ↓
[User interacts with app]
    ↓
[Auto-save to API]
    ↓
[Save current page to localStorage]
```

This structure ensures that even without context, any developer can understand:
1. Where each feature lives
2. How modals work (HTML embedded, CSS/JS separate)
3. Why certain decisions were made (CORS, modularity)
4. How to add new features (follow patterns)
5. How navigation and state management work
