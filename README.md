# BiBo - Notes & Tasks Management App

A comprehensive notes and tasks management application with modular architecture, global modal system, and responsive mobile design.

## 🚀 Overview

BiBo is a collection of productivity tools organized in a hub-based architecture. Each tool is a standalone mini-project that can function independently while sharing common resources and global features.

## 📦 Projects

### Mini Projects
- **[Notes](notes/README.md)**: Rich text note-taking with advanced editing features
- **[Tasks](tasks/README.md)**: Microsoft To Do style task management
- **[Secret Notes](secret/README.md)**: Password-protected notes with encryption (Hub only)
- **Sources**: Source management app (coming soon)

### Hub & Global Modals
- **Hub**: Main landing page with tool grid
- **Translate Modal**: Auto-detect Vietnamese/English translation (Alt+T)
- **Calculator Modal**: Basic calculator (Alt+C)
- **Encoder Modal**: Encode API URLs for config.js (Alt+E)
- **Backup Modal**: Export/import notes data (Alt+B)
- **Shortcuts Modal**: View all keyboard shortcuts (Alt+K)

## 🏗️ Architecture

### Project Structure
```
/
├── index.html              # Redirect to hub or last visited page
├── hub.html                # Main hub with tool grid
├── config.js               # API configuration (encoded)
├── common.css              # Shared styles for all projects
├── shortcuts-config.js     # Keyboard shortcuts config (single source of truth)
├── global-shortcuts.js     # Global keyboard shortcuts handler
├── shortcuts-loader.js     # Shortcuts modal loader
├── README.md               # This file
├── PROJECT-STRUCTURE.md    # Detailed project structure
├── DEVELOPMENT-RULES.md    # 🚨 MANDATORY development rules
│
├── notes/                  # Notes mini-project
│   └── README.md           # 🚨 REQUIRED - Complete documentation
│
├── tasks/                  # Tasks mini-project
│   └── README.md           # 🚨 REQUIRED - Complete documentation
│
├── secret/                 # Secret Notes modal
│   └── README.md           # 🚨 REQUIRED - Complete documentation
│
├── translate/              # Translate modal
│   └── README.md           # 🚨 REQUIRED - Complete documentation
│
├── encoder/                # Encoder modal
│   └── README.md           # 🚨 REQUIRED - Complete documentation
│
├── backup/                 # Backup modal
│   └── README.md           # 🚨 REQUIRED - Complete documentation
│
└── modals/                 # Calculator modal
    └── README.md           # 🚨 REQUIRED - Complete documentation
```

### 🚨 CRITICAL RULE: README.md is MANDATORY

**Every mini project folder MUST have a complete README.md file.**

**Why:**
- Future work can continue without prior conversation history
- Each project is self-contained and understandable
- New developers can understand the project immediately
- Easy to maintain without losing context

**See [DEVELOPMENT-RULES.md](DEVELOPMENT-RULES.md) for detailed requirements.**

**Projects without complete README.md are considered INCOMPLETE.**

### Global Modal System

**How It Works:**
1. **Single Config**: All shortcuts defined in `shortcuts-config.js`
2. **Lazy Loading**: Modals load only when first opened
3. **Toggle Support**: Press shortcut once to open, again to close
4. **Global Access**: Open modals from any page (Notes, Tasks, Hub)
5. **No CORS Issues**: HTML injected via JavaScript, not fetched
6. **High z-index**: Modals use z-index: 10000 to appear above everything

**Architecture:**
```
shortcuts-config.js (single source of truth)
    ↓
global-shortcuts.js (keyboard event handler)
    ↓
{modal}-loader.js (lazy load modal)
    ↓
{modal}-modal.js (modal logic)
```

**Benefits:**
- ✅ Easy config (edit one file)
- ✅ Global access with keyboard shortcuts
- ✅ Toggle UX (press once to open, again to close)
- ✅ Lazy loading (better performance)
- ✅ No duplication (modal HTML in loader only)
- ✅ Alt key usage (avoids browser conflicts)

**See**: [GLOBAL-MODAL-POPUP-GUIDE](shortcut/GLOBAL-MODAL-POPUP-GUIDE.md) for detailed instructions.

## ⌨️ Global Keyboard Shortcuts

Works from any page (Notes, Tasks, Hub):

- `Alt + T` - Translate modal (toggle)
- `Alt + C` - Calculator modal (toggle)
- `Alt + E` - Encoder modal (toggle)
- `Alt + B` - Backup modal (toggle)
- `Alt + K` - Shortcuts modal (toggle)
- `Escape` - Close all modals

**Note**: Uses Alt instead of Ctrl to avoid browser shortcut conflicts.

## 🎨 Shared Resources

### common.css
Contains shared styles for all projects:
- CSS Variables (colors, spacing, fonts)
- Reset styles
- Common buttons
- Scrollbar styles
- App navigation
- Text selection rules

### config.js
Centralized API configuration:
```javascript
const API_CONFIG = {
    ENCODED: 'base64_encoded_url',
    
    decode() {
        // Supports Unicode/Vietnamese
        // Reverse + Base64 decode + UTF-8 decode
    },
    
    get BASE() { return this.decode(); },
    get NOTES() { return `${this.BASE}/notes`; },
    get TASKS() { return `${this.BASE}/tasks`; }
};
```

**How to update API URL:**
1. Open Hub in browser
2. Click "Encoder" tool or press Alt+E
3. Enter new API URL
4. Click "Encode"
5. Copy encoded string to `config.js`

## 📱 Mobile Interface

All pages share unified mobile interface:

**Features:**
- **Hamburger Menu**: ☰ button to toggle sidebar
- **Responsive Design**: Optimized for ≤768px screens
- **Touch-Friendly**: Large touch targets (minimum 44px)
- **Navigation**: Hub, Notes, Tasks tabs in sidebar
- **Auto-Close**: Sidebar closes when clicking outside
- **Consistent**: Identical behavior across all pages

**Mobile Files:**
- `hub-mobile.js` - Hub mobile interface
- `notes/notes-mobile.js` - Notes mobile interface
- `tasks/tasks-mobile.js` - Tasks mobile interface
- `sources/sources-mobile.js` - Sources mobile interface

## 🗄️ Database

Uses MockAPI with the following tables:

### Notes Table
Shared by Notes app and Secret Notes modal:
```json
{
  "id": "string",
  "title": "string",
  "content": "string (HTML)",
  "type": "note|ielts|course|code|secret|source",
  "source": "string",
  "tags": "string (comma-separated)",
  "example": "string",
  "url1-5": "string",
  "wordCountEnabled": "boolean",
  "timerDuration": "string",
  "createdAt": "ISO string",
  "updatedAt": "ISO string"
}
```

**Type Filtering:**
- `type="note|ielts|course|code"`: Regular notes (Notes app)
- `type="secret"`: Secret notes (Secret Notes modal only)
- `type="source"`: Source notes (Sources app only)

### Tasks Table
Shared by tasks and lists:
```json
{
  "id": "string",
  "type": "task|list",
  "title": "string",
  "name": "string",
  "description": "string",
  "parentId": "string",
  "status": "pending|completed",
  "priority": "normal|high",
  "dueDate": "ISO string",
  "recurring": "boolean",
  "url1-3": "string",
  "createdAt": "ISO string",
  "updatedAt": "ISO string",
  "completedDate": "ISO string"
}
```

## 🔧 Development

### Adding New Mini Project

1. **Create folder**: `project-name/`
2. **Create files**:
   - `project-name.html`
   - `project-name.css`
   - `project-name.js`
   - `project-name-mobile.js` (if needed)
   - `README.md` (documentation)
3. **Link to common.css**: `<link href="../common.css">`
4. **Add to hub**: Button in `hub.html`
5. **Update navigation**: Add to other projects

### Adding New Global Modal

**See**: [GLOBAL-MODAL-POPUP-GUIDE](shortcut/GLOBAL-MODAL-POPUP-GUIDE.md)

**Quick Steps:**
1. Create `folder/modal-name-loader.js` (dynamic loader)
2. Create `folder/modal-name-modal.js` (logic)
3. Create `folder/modal-name-modal.css` (styles with z-index: 10000)
4. Register in `shortcuts-config.js`
5. Load in all pages (notes, tasks, hub)

### Code Style Guidelines

**Naming Conventions:**
- Functions: camelCase (`loadNotes`, `saveTask`)
- Classes: PascalCase (`RichTextEditor`, `MobileInterface`)
- Constants: UPPER_SNAKE_CASE (`API_NOTES`, `STORAGE_KEYS`)
- CSS classes: kebab-case (`.note-item`, `.task-editor`)

**File Naming:**
- Projects: `project-name.html`, `project-name.css`, `project-name.js`
- Features: `project-name-feature.js` (e.g., `notes-richtext.js`)
- Modals: `modal-name-loader.js`, `modal-name-modal.js`, `modal-name-modal.css`

## 🎨 Theme & Styling

### CSS Variables
```css
:root {
    --color-accent-primary: #007acc;
    --color-bg-primary: #1e1e1e;
    --color-bg-elevated: #2d2d30;
    --color-text-primary: #d4d4d4;
    --color-bg-secondary: #252526;
    --color-border: #3e3e42;
    --color-danger: #d13438;
    --color-danger-hover: #e74c50;
}
```

### Animation Timing
```css
:root {
    --transition-fast: 0.15s ease;
    --transition-normal: 0.2s ease;
    --transition-slow: 0.3s ease;
}
```

### UI Consistency Patterns
- **Hover Colors**: All elements use `var(--color-bg-elevated)` (#2d2d30)
- **Animation Timing**: Dropdowns use `0.15s ease`, modals use `0.2s ease`
- **Form Styling**: No border-radius, only border-bottom for inputs
- **Text Selection**: Disabled on UI elements, enabled only in input fields

## 🚀 Setup & Deployment

### Local Development
1. Clone repository
2. Open `index.html` in browser
3. No build process needed (vanilla JS)

### API Setup
1. Create MockAPI account at mockapi.io
2. Create tables: `notes` and `tasks`
3. Copy API URLs
4. Open Hub → Encoder (Alt+E)
5. Encode URLs and paste into `config.js`

### Deployment
- **Static Hosting**: Vercel, Netlify, GitHub Pages
- **No Backend Required**: Only serve static files
- **HTTPS Required**: For CORS with MockAPI

## 🐛 Troubleshooting

### Common Issues

**API not working:**
- Check `config.js` has correct encoded URL
- Use Encoder (Alt+E) to encode new URL
- Verify MockAPI is accessible
- Check Console for errors

**Modal not opening:**
- Check loader script is loaded
- Verify shortcut in `shortcuts-config.js`
- Check Console for errors
- Try clicking button instead of shortcut

**Mobile sidebar not showing:**
- Check screen width ≤768px
- Verify mobile JS file is loaded
- Check `.mobile-visible` class is added

**Styles not applying:**
- Verify `common.css` is loaded first
- Check CSS variable names
- Clear browser cache

### Debug Tips
- Open Console (F12) to see errors
- Check Network tab for failed requests
- Verify localStorage data
- Test with Encoder if API issues

## 📚 Documentation

- **[PROJECT-STRUCTURE.md](PROJECT-STRUCTURE.md)**: Detailed project structure and architecture
- **[GLOBAL-MODAL-POPUP-GUIDE](shortcut/GLOBAL-MODAL-POPUP-GUIDE.md)**: How to create global modals
- **[notes/README.md](notes/README.md)**: Notes app documentation
- **[tasks/README.md](tasks/README.md)**: Tasks app documentation
- **[secret/README.md](secret/README.md)**: Secret Notes documentation

## 🔗 Navigation Flow

```
index.html (redirect)
    ↓
[Check localStorage for last page]
    ↓
hub.html OR notes/notes.html OR tasks/tasks.html
    ↓
[User navigates between pages]
    ↓
[localStorage saves current page]
```

## 📞 Support

For issues or questions:
1. Check relevant README first
2. Check browser Console for errors
3. Verify API configuration
4. Check related documentation

## 🎯 Future Enhancements

- **Drag & Drop**: Reorder tasks and lists
- **Offline Support**: PWA with service worker
- **Themes**: Multiple color schemes
- **Collaboration**: Real-time sharing
- **Advanced Search**: Filters, date ranges
- **Attachments**: File upload support

---

**Version**: 2.10.2  
**Last Updated**: February 2026  
**Tech Stack**: Vanilla JavaScript, MockAPI, CSS Variables  
**License**: MIT  
**Author**: BiBo Development Team
