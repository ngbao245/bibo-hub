# Project Structure

## Overview
Dự án đã được refactor thành cấu trúc modular với các mini projects riêng biệt.

**🚨 CRITICAL RULE**: Every mini project MUST have a complete README.md. See [DEVELOPMENT-RULES.md](DEVELOPMENT-RULES.md).

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
├── DEVELOPMENT-RULES.md    # Development rules
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
- ✅ Easy to add new global modals (follow pattern in "GLOBAL-MODAL-POPUP-GUIDE.md")

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

### Mini Projects
- **[Notes](notes/README.md)**: Rich text note-taking with advanced editing features
- **[Tasks](tasks/README.md)**: Microsoft To Do style task management
- **[Secret Notes](secret/README.md)**: Password-protected notes with encryption (Hub only)

### Global Modals
- **Translate**: Auto-detect Vietnamese/English translation (Alt+T)
- **Calculator**: Basic calculator (Alt+C)
- **Encoder**: Encode API URLs for config.js (Alt+E)
- **Backup**: Export/import notes data (Alt+B)
- **Shortcuts**: View all keyboard shortcuts (Alt+K)

**See individual project READMEs for detailed documentation.**

## Navigation

- **Hub**: Main landing page with tool grid
- **Projects**: Notes, Tasks, Secret Notes (see individual READMEs)
- **Global Modals**: Accessible from any page via keyboard shortcuts (Alt+T, Alt+C, Alt+E, Alt+B, Alt+K)

## Shared Resources

### common.css
Shared styles for all projects: CSS Variables, reset styles, common buttons, scrollbar, navigation, text selection rules.

### config.js
Centralized API configuration with Unicode/Vietnamese support. Use Encoder modal (Alt+E) to encode new API URLs.

## Development Guidelines

### 🚨 MANDATORY RULE: README.md Required

**Every mini project folder MUST have a complete README.md file.**

**See [DEVELOPMENT-RULES.md](DEVELOPMENT-RULES.md) for detailed requirements.**

**Quick Checklist:**
- [ ] README.md exists in project folder
- [ ] Contains complete context (Overview, Features, Technical Implementation, etc.)
- [ ] Includes code examples with explanations
- [ ] Has troubleshooting section
- [ ] Can someone continue development from this README alone?

**This is NOT optional. Projects without complete README.md are considered INCOMPLETE.**

### Adding New Mini Project
1. Create folder: `project-name/`
2. **Create README.md FIRST** (use template from DEVELOPMENT-RULES.md)
3. Fill in Overview and Features sections
4. Create files: HTML, CSS, JS, mobile JS
5. **Update README.md** with Technical Implementation as you code
6. Link to `common.css` and `config.js`
7. Add button in `hub.html`
8. Update navigation in other projects
9. **Final README.md review** - verify Quality Checklist

### Adding New Global Modal
**See**: [GLOBAL-MODAL-POPUP-GUIDE](shortcut/GLOBAL-MODAL-POPUP-GUIDE.md) for detailed step-by-step instructions.

### File Paths
- From project folder to root: `../`
- From root to project: `{project}/`
- Example: `<link href="../common.css">` in project files

## Migration Notes

### Old Structure → New Structure
- `index.html` → Redirects to hub or last page
- `app.js` → `notes/notes.js`
- `storage.js` → `notes/notes-storage.js` & `tasks/tasks-storage.js`
- `richtext-editor.js` → `notes/notes-richtext.js`
- `mobile.js` → `notes/notes-mobile.js` & `tasks/tasks-mobile.js`
- `encoder.html` → `encoder/encoder-modal.js` (modal only)
- `data-manager.html` → `backup/backup-modal.js` (modal only)

### Modal Refactoring History
- **v2.9.0**: Global modal system with toggle support, lazy loading, Alt key shortcuts
- **v2.8.0**: Modular hub architecture with embedded HTML, separate CSS/JS

## Benefits of New Structure

1. **Modularity**: Each project/modal is self-contained
2. **Reusability**: Shared styles in common.css
3. **Maintainability**: Easy to find and edit files
4. **Scalability**: Easy to add new projects/modals
5. **CORS Compatible**: Works with file:// protocol
6. **Separation of Concerns**: Clear structure and organization

## Key Technical Decisions

### Why Dynamic Modal Loading
- No CORS issues (HTML injected, not fetched)
- Global access with keyboard shortcuts
- Lazy loading (better performance)
- Modular (separate CSS/JS files)

### Why Global Shortcuts
- Quick access from anywhere
- Productivity boost
- Consistent across all pages

**See**: [GLOBAL-MODAL-POPUP-GUIDE](shortcut/GLOBAL-MODAL-POPUP-GUIDE.md) for implementation details.

## Context for Future Development

### When Adding New Features

**For Hub Modals:**
- Quick tool (< 1 screen) → Create modal (CSS + JS, HTML in hub.html)
- Complex feature → Create standalone project (separate folder)

**For Existing Projects:**
- Keep files in respective folders
- Share common styles via common.css
- Mobile enhancements in separate `-mobile.js` files
- Document in project README.md

**For Shared Resources:**
- Common styles → `common.css`
- API config → `config.js`
- Documentation → README files

### Code Style Guidelines

**Naming Conventions:**
- Functions: camelCase
- Classes: PascalCase
- Constants: UPPER_SNAKE_CASE
- CSS classes: kebab-case

**File Naming:**
- Projects: `project-name.html`, `project-name.css`, `project-name.js`
- Features: `project-name-feature.js`
- Modals: `modal-name-loader.js`, `modal-name-modal.js`, `modal-name-modal.css`

### Understanding the Codebase

**Entry Points:**
- `index.html` - Redirects to hub or last visited page
- `hub.html` - Main hub with all modals
- `notes/notes.html` - Notes application
- `tasks/tasks.html` - Tasks application

**Navigation Flow:**
```
index.html → [Check localStorage] → hub/notes/tasks → [Save to localStorage]
```

**Modal Flow:**
```
User action → openModalLazy() → Load (if needed) → Toggle show/hide
```

**Project Flow:**
```
Load HTML → Load CSS/JS → Initialize → User interaction → Auto-save → Save state
```

This structure ensures clear understanding of:
1. Where each feature lives
2. How modals work
3. Why decisions were made
4. How to add new features
5. How navigation works
