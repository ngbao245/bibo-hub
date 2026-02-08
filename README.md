​# BiBo - Notes & Tasks Management App

A comprehensive notes and tasks management application with Microsoft To Do style interface, 
featuring rich text editing, auto-save task management, and responsive mobile design with smart header navigation.

## 🚀 Key Features

### 📝 Notes Management
- **Rich Text Editor**: Support for bold, italic, underline, bullet lists, numbered lists, code blocks
- **Word Count**: Toggle-able word counter - click to activate/deactivate real-time counting
- **Timer**: Built-in writing timer - click to start/stop tracking writing sessions
- **Unsaved Changes Warning**: Prompts confirmation when closing editor with unsaved changes
- **Fullscreen Mode**: Full-screen mode for distraction-free writing (F11 or ⛶ button)
- **Window Controls**: Fullscreen button (gray) and close button (red) like Windows Explorer
- **Inline Editing**: Direct editing of title and content
- **Search**: Search notes by title and content
- **Categories & Tags**: Categorize notes by type (Note, IELTS, Course, Code)
- **URLs Management**: Store up to 5 URLs per note
- **Auto-save**: Automatically save form data while editing

### 🔒 Secret Notes (Hub Only)
- **Password Protection**: Separate app in Hub requiring password to access
- **Dedicated Interface**: Full notes app interface with consistent dark theme
- **Custom Password Toggle**: Show/hide password with eye icon (white color, smooth hover effects)
- **Browser Compatibility**: Hides default password reveal icons from all browsers (Edge, Chrome, Firefox, Opera, Arc, Safari)
- **Type: secret**: Notes stored with type="secret" in database
- **No Global Access**: Only accessible from Hub button (not in Notes app)
- **Session Lock**: Password required each time modal is opened
- **ESC Key Support**: Press ESC to close modal at any time
- **Smooth Animations**: Consistent 0.2s slideIn animation matching other hub modals
- **Optimized Performance**: No requestAnimationFrame delays, instant UI updates
- **URL Management**: Store up to 100 URLs per secret note with optional names
- **Full CRUD**: Create, read, update, delete secret notes with same features as regular notes
- **Search & Filter**: Search secret notes by title and content
- **Rich Content**: HTML content support with line breaks

### ✅ Tasks Management (Microsoft To Do Style)
- **3-Column Layout**: Lists → Tasks → Editor (like Microsoft To Do desktop)
- **Default View**: "My Day" instead of "All Tasks" when opening app
- **Auto-save Task Editor**: No Save/Cancel buttons needed, auto-saves when:
- **Text Inputs**: Auto-save on blur (click outside)
- **Dropdowns**: Auto-save on option selection (due date, move to list)
- **Toggle Buttons**: Auto-save on click (Important, Daily Recurring)
- **Silent Operation**: No notifications, saves silently
- **Custom Lists**: Create and manage custom lists with auto-naming
- **Smart Task Management**:
- **My Day**: Tasks with today's due date + overdue + daily recurring tasks
- **All Tasks**: All tasks
- **Important**: Tasks with high priority
- **Completed**: Completed tasks
- **Task Features**:
- Due date with dropdown (Today, Tomorrow, Pick a date)
- Priority levels (High/Normal)
- **Daily Recurring Tasks**: Always appear in My Day every day
- Task descriptions and URLs (up to 3)
- **Move Tasks**: Move tasks between lists with auto-save and refresh
- **Circular Checkboxes**: Microsoft To Do style design
- **Context Menus**: Right-click to rename/delete lists (normal color, not red)
- **Inline List Editing**: Click to edit list names, auto-save on blur/enter

### 📱 Mobile Interface (Smart Header + Fixed Sidebar Highlighting)
- **Smart Header**: Compact header with navigation, list selection, and toggle
- **Navigation Tabs**: Switch between Notes and Tasks directly from header
- **List Selector**: Quick access to task lists without opening sidebar (4 built-in lists only)
- **Hamburger Toggle**: Show/hide sidebar with smooth animation
- **Fixed Mobile Highlighting**: Task list items now properly highlight when active on mobile
- **Sidebar Sync**: Mobile dropdown and sidebar selection stay synchronized
- **Auto-Close Sidebar**: Sidebar closes when selecting task lists on mobile
- **Search Integration**: Mobile search synced with desktop functionality
- **Responsive Design**: Optimized for mobile screens (≤768px)
- **Touch-Friendly**: Large touch targets and smooth interactions
- **Safe Area Support**: Enhanced mobile browser compatibility with safe area padding

### 🎨 UI/UX Features
- **Dark Theme**: Professional dark interface with CSS variables
- **Edge-style Tabs**: Navigation tabs close together without gaps
- **Unified Design**: Same sidebar width (280px) and color scheme
- **Consistent Hover Colors**: All hover effects use #2d2d30 (var(--color-bg-elevated))
- **Smooth Animations**: Dropdown animations 0.15s ease for consistency
- **Responsive Design**: Compatible with mobile and desktop
- **No Border Radius**: Form inputs use border-bottom only
- **Silent Operations**: No toast notifications when moving tasks
- **Text Selection Disabled**: UI elements are not selectable (except input fields)

## 🏗️ Technical Architecture

### Modular Project Structure
The project is organized into separate mini-projects with shared resources:

**Hub System:**
- `hub.html` - Main landing page with tool grid
- Modals embedded in HTML (CORS limitation with file:// protocol)
- Modal CSS and JS in separate files for modularity
- Each modal has its own folder with `.css` and `.js` files

**Mini Projects:**
- `notes/` - Full notes management app
- `tasks/` - Full tasks management app
- Each project has its own HTML, CSS, JS files
- All projects share `common.css` for consistent styling

**Global Modal Architecture:**
```
Single Source of Truth
├── shortcuts-config.js     # All keyboard shortcuts defined here
    ↓
├── global-shortcuts.js     # Reads from SHORTCUTS_CONFIG, handles keyboard events
└── shortcuts-loader.js     # Reads from SHORTCUTS_CONFIG, renders shortcuts modal

Modal Loaders (lazy loading)
├── translate-loader.js     # Loads CSS first → Injects HTML → Loads JS
├── calculator-loader.js    # Loads CSS first → Injects HTML → Loads JS
├── encoder-loader.js       # Loads CSS first → Injects HTML → Loads JS
└── backup-loader.js        # Loads CSS first → Injects HTML → Loads JS

Each modal:
├── *-loader.js             # Injects HTML, loads CSS/JS dynamically with toggle support
├── *-modal.css             # Modal styles (z-index: 10000)
└── *-modal.js              # Modal logic (open/close functions)
```

**How Global Modals Work:**
1. **Single Config**: All shortcuts defined in `shortcuts-config.js` (easy to modify)
2. **Lazy Loading**: Modals only load when first opened (via keyboard shortcut or button click)
3. **CSS First**: Load CSS and wait → Then inject HTML → Prevents flash of unstyled content
4. **Dynamic Injection**: Loader injects HTML into DOM, loads CSS/JS files
5. **Path Detection**: Auto-detects if running from notes/, tasks/, or root
6. **Toggle Support**: Press shortcut once to open, press again to close
7. **Global Shortcuts**: Keyboard shortcuts work from any page (notes, tasks, hub)
8. **High z-index**: Modals use z-index: 10000 to appear above rich text editor (z-index: 1000)
9. **Click Outside**: All modals close when clicking outside or pressing ESC

**Why This Architecture:**
- **Easy Config**: Edit shortcuts in one place (`shortcuts-config.js`)
- **No CORS Issues**: HTML injected via JavaScript (no fetch needed)
- **No Flash**: CSS loads before HTML injection
- **Lazy Loading**: Modals only load when needed (better performance)
- **Global Access**: Open modals from any page with keyboard shortcuts
- **Toggle UX**: Natural interaction - press once to open, again to close
- **Modular**: Each modal has separate CSS/JS files for maintainability
- **No Duplication**: Modal HTML defined once in loader, works everywhere
- **Alt Key**: Uses Alt instead of Ctrl to avoid browser shortcut conflicts

**Navigation:**
- `index.html` redirects to last visited page (notes/tasks) or hub
- Each page saves its name to localStorage for navigation memory
- Hub provides quick access to all tools via modal system

### Database Schema (MockAPI)
Uses single table approach with `type` field to differentiate:

**Notes Table:**
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
"wordCountEnabled": "boolean", // Rich text editor word count toggle state
"timerDuration": "string", // Rich text editor timer duration in seconds
"createdAt": "ISO string",
"updatedAt": "ISO string"
}
```

**Note:** Secret notes (type="secret") are only accessible through Hub's Secret Notes modal with password protection.

**Tasks Table (contains both tasks and lists):**
```json
{
"id": "string",
"type": "task|list",
"title": "string",
"name": "string", // For lists compatibility
"description": "string", // Tasks only
"parentId": "string", // Tasks: parent list ID, Lists: null
"status": "pending|completed", // Tasks only
"priority": "normal|high", // Tasks only
"dueDate": "ISO string", // Tasks only
"category": "string", // Tasks only
"recurring": boolean, // Tasks only - daily recurring
"url1": "string", // Tasks only
"url2": "string", // Tasks only
"url3": "string", // Tasks only
"createdAt": "ISO string",
"updatedAt": "ISO string",
"completedDate": "ISO string" // Tasks only
}
```

### File Structure
```
├── index.html              # Redirect to hub or last visited page
├── hub.html                # Main hub with tool grid and modals
├── config.js               # API configuration (encoded)
├── common.css              # Shared styles for all projects
├── global-shortcuts.js     # Global keyboard shortcuts system
├── hub-shortcuts.js        # Hub-specific keyboard shortcuts
├── package.json            # Project metadata
├── PROJECT-STRUCTURE.md    # Project structure documentation
├── README.md               # This file
├── Global Modal Popup Guide.md  # Guide for creating global modals
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
│   └── backup-modal.js     # Modal logic
│
├── encoder/                # Encoder Modal
│   ├── encoder-loader.js   # Dynamic modal loader
│   ├── encoder-modal.css   # Modal styles
│   └── encoder-modal.js    # Modal logic
│
├── translate/              # Translate Modal
│   ├── translate-loader.js # Dynamic modal loader
│   ├── translate-modal.css # Modal styles
│   └── translate-modal.js  # Modal logic
│
└── modals/                 # Calculator Modal
    ├── calculator-loader.js # Dynamic modal loader
    ├── calculator-modal.css # Modal styles
    └── calculator-modal.js  # Modal logic
```

**Note**: Modal HTML is embedded in `hub.html` due to CORS restrictions when opening files directly (file:// protocol). CSS and JS are kept in separate files for modularity.

### API Configuration
File `config.js` contains centralized API endpoints (encoded):
```javascript
const API_CONFIG = {
NOTES: 'encoded_url_here',
TASKS: 'encoded_url_here'
};
```

**How to update API URL:**
1. Open `hub.html` in browser
2. Click "Encoder" tool button
3. Enter new API URL in modal
4. Click "Encode"
5. Copy encoded string to `config.js`

**Encoder Modal Features:**
- Base64 + reverse encoding for simple obfuscation
- Click-to-copy output
- Vietnamese instructions
- Integrated in hub (no separate page needed)

## 🎯 Key Implementation Details

### Auto-save Task Editor
Task editor no longer has Save/Cancel buttons, automatically saves all changes:

```javascript
// Auto-save triggers:
- Text inputs: onBlur (when clicking outside)
- Due date dropdown: onChange (when selecting Today/Tomorrow/Custom)
- Toggle buttons: onClick (Important, Daily Recurring)
- Move to list: onChange (when selecting different list)
- Silent operation: No notifications
```

**Benefits:**
- Smooth UX like Microsoft To Do
- No worry about losing data when forgetting to save
- More natural editing flow
- Reduced cognitive load for users

### Mobile Sidebar Highlighting Fix
**Problem Solved**: Task list items in mobile sidebar were not highlighting properly when active.

**Solution Implemented:**
```css
/* Consolidated mobile active state rules with maximum specificity */
@media (max-width: 768px) {
body .sidebar .task-list-item.active,
body .mobile-sidebar-visible .task-list-item.active,
.sidebar .task-list-item.active,
.mobile-sidebar-visible .task-list-item.active,
.task-lists .task-list-item.active,
.custom-lists .task-list-item.active,
.task-list-item.active {
background: var(--color-accent-primary) !important;
color: white !important;
}
}
```

**JavaScript Enhancements:**
- **Immediate Visual Feedback**: Uses temporary inline styles while CSS loads
- **Force Refresh**: Removes and re-adds active class to force style updates
- **Cleanup Mechanism**: Removes inline styles after CSS takes over
- **Enhanced Specificity**: Multiple CSS selector combinations ensure styles apply

### Mobile Interface Architecture
```javascript
class MobileInterface {
constructor() {
this.isMobile = window.innerWidth <= 768;
this.sidebarVisible = false;
this.currentPage = this.getCurrentPage();
this.init();
this.setupSafeAreaSupport();
}

// Smart header with navigation and controls
createMobileHeader() {
// Creates navigation tabs + search/list selector
}

// Enhanced sidebar highlighting
showSidebar() {
// Force refresh active state with immediate visual feedback
// Apply temporary inline styles for instant highlighting
}

// Synchronized dropdown and sidebar
selectList(listType) {
// Update mobile dropdown header
// Clear all active states to prevent conflicts
// Update both sidebar and dropdown highlighting
// Trigger desktop list switch
}
}
```

### Tasks Management Architecture
- **Single Table Design**: Tasks and Lists in same table, differentiated by `type` field
- **Parent-Child Relationship**: Tasks have `parentId` pointing to List ID
- **Event Delegation**: Uses event delegation for task interactions
- **Optimistic UI**: Update UI first, sync API later
- **Auto-save**: Moving tasks between lists auto-saves and refreshes task list
- **Smart Counts**: Custom list counts updated in real-time

### My Day Logic
```javascript
case 'today':
filtered = filtered.filter(task =>
task.status !== 'completed' && (
task.recurring === true || // Daily recurring tasks always show
(task.dueDate && new Date(task.dueDate).toDateString() === today) ||
isOverdue(task.dueDate)
)
);
```

### Rich Text Editor
The rich text editor is a custom-built, feature-rich content editor with professional writing tools:

**Core Features:**
- **ContentEditable**: Uses contenteditable with execCommand API for text formatting
- **Fullscreen Mode**: Toggle with ⛶/🗗 button or F11 key for distraction-free writing
- **Window Controls**: `.window-controls` div contains fullscreen + close buttons
- **Toolbar State**: Dynamic update button states based on selection (active state for Bold, Italic, etc.)
- **HTML Sanitization**: Enhanced content cleaning to prevent HTML display bugs and XSS attacks

**Code Block Features:**
- **3 Action Buttons**: Copy, Paste, Clear buttons positioned at top-left of code block
- **Button Styling**: 
  - Fixed width: 68px each
  - Positioned: Copy (8px), Paste (84px), Clear (160px) from left
  - z-index: 9999 to stay above all elements
  - contenteditable="false" to prevent editing on buttons
  - pointer-events: auto to ensure clickability
- **Event Listeners Setup**:
  - **New code blocks**: Event listeners attached in `insertCodeBlock()` when creating
  - **Existing code blocks**: Event listeners attached in `setupCodeBlockButtons()` when loading saved content
  - **Critical**: Buttons from saved content (DB) need event listeners re-attached on load
  - Method called after `this.editor.innerHTML = this.sanitizeContent(content)`
- **Copy Button**: 
  - Copies plain text from entire code block using `innerText`
  - Shows "Copied" feedback for 1.5 seconds
  - Works with nested HTML elements from pasted code
- **Paste Button**: 
  - Pastes plain text from clipboard
  - Clears existing HTML before pasting
  - Sets plain text only
- **Clear Button**: 
  - Clears all content in code block
  - Sets zero-width space (\u200B) for empty state
- **Ctrl+A in Code Block**: 
  - Selects entire code block content when cursor is inside
  - Prevents selecting entire editor
  - Works by detecting `.code-block` parent element
- **Ctrl+C in Code Block**: 
  - Copies as plain text only (no HTML structure)
  - Uses `selection.toString()` to get plain text
  - Prevents default copy behavior to avoid copying nested HTML elements
- **Smart Selection**: Traverses DOM tree to detect if cursor is inside code block
- **Backspace/Delete**: Automatically removes zero-width space in empty code blocks

**Writing Tools:**
- **Word Count**: 
  - Click to activate/deactivate real-time word counting
  - Updates every 0.5 seconds when active
  - Shows "-- words" when inactive
  - Fixed width (90px) to prevent layout shifts
  - Styled consistently with toolbar buttons
  - **State Persistence**: Toggle state is saved to database and restored when reopening note
  - **Smart Counting Priority**:
    1. **Selected text**: If text is selected, counts only that selection
    2. **Marked text**: If content has `` markers, counts text between first `` ... `` pair
    3. **All text**: If no selection or markers, counts entire content
  - **Example**: `This is outside `` count only this `` ignore this` → counts "count only this"
- **Timer**: 
  - Click to start/stop writing session timer
  - Format: MM:SS (00:00)
  - Continues counting until manually stopped
  - Auto-stops when editor closes
  - Blue highlight when running
  - **Duration Persistence**: Timer duration is saved to database and restored when reopening note
  - **Accumulated Time**: Timer continues from where it left off in previous sessions
- **Unsaved Changes Protection**:
  - Detects content changes by comparing with initial content
  - Prompts "You have unsaved changes. Are you sure you want to close?" when:
    - Pressing ESC key
    - Clicking Cancel button
    - Clicking × close button
  - No prompt if content unchanged
  - Normalizes HTML for accurate comparison

**Keyboard Shortcuts:**
- `Ctrl + A` - Select all (entire editor or just code block if inside one)
- `Ctrl + C` - Copy (plain text if inside code block)
- `Ctrl + B` - Bold text
- `Ctrl + I` - Italic text
- `Ctrl + U` - Underline text
- `Ctrl + S` - Save and close
- `Escape` - Close with confirmation if changed
- `F11` - Toggle fullscreen
- `Tab` - Insert 4 spaces

**Header Layout:**
```
[Edit Content] [Bold|Italic|Underline|•List|1.List|</>|Clear] [Word Count|Timer] [⛶|×]
     ↑                           ↑                                    ↑            ↑
   Title                    Toolbar (centered)                    Stats      Controls
```

**Code Block Layout:**
```
[Copy] [Paste] [Clear]
┌─────────────────────────────────┐
│ code content here...            │
│ multiple lines...               │
└─────────────────────────────────┘
```

**Style Consistency:**
- All buttons use same base style: `var(--color-bg-input)` background
- Hover effect: Blue highlight `var(--color-accent-blue)` with white text
- Active state: Primary blue `var(--color-accent-primary)` (no hover change when active)
- Fixed width for stats section (200px) prevents toolbar from shifting
- Monospace font for word count and timer displays
- Code block buttons: 68px width, 8px gap between buttons

### UI Consistency Patterns
- **Hover Colors**: All elements use `var(--color-bg-elevated)` (#2d2d30)
- **Animation Timing**: Dropdowns use `0.15s ease` for consistency
- **Form Styling**: No border-radius, only border-bottom for inputs
- **Navigation**: Edge-style tabs with `margin-left: -1px` to connect
- **Context Menu**: Delete items have normal color, not red
- **Text Selection**: Disabled on UI elements, enabled only in input fields

### Performance Optimizations
- **Event Delegation**: Avoid attaching many event listeners
- **Debounced Search**: Search with 300ms delay
- **Optimistic UI**: Update UI first, API later
- **Cache Strategy**: LocalStorage cache for instant load
- **Minimal DOM Manipulation**: Batch updates when possible

## 🚀 How to Use

### Hub & Tools
1. **Open Hub**: Open `hub.html` or navigate from notes/tasks
2. **Tool Grid**: Click any tool button to open its modal
3. **Available Tools**:
   - **Translate**: Auto-detect Vietnamese/English translation (Ctrl+Q)
   - **Calculator**: Basic calculator with keyboard support (Ctrl+Shift+C)
   - **Encoder**: Encode API URLs for config.js (Ctrl+E)
   - **Backup**: Export/import notes data (Ctrl+B)
   - **Notes**: Navigate to notes app
   - **Timer, Color, QR, JSON, Markdown, Unit**: Coming soon
4. **Modal Controls**:
   - Click outside modal to close
   - Press ESC to close all modals
   - Click × button to close
5. **Global Keyboard Shortcuts** (works from any page):
   - **Alt+T**: Open Translate modal (toggle)
   - **Alt+C**: Open Calculator modal (toggle)
   - **Alt+E**: Open Encoder modal (toggle)
   - **Alt+B**: Open Backup modal (toggle)
   - **Alt+K**: Open Shortcuts modal (toggle)
   - **ESC**: Close all modals
   - Press shortcut once to open, press again to close (toggle)
   - Modals can be opened from Notes, Tasks, or Hub pages

### Notes
1. **Create new note**: Click "+" in sidebar
2. **Edit**:
- Double-click title for inline edit
- Double-click content to open rich text editor
- Click "Edit" to open form mode
3. **Rich text editing**:
- Use toolbar or keyboard shortcuts
- Click ⛶ button or press F11 for fullscreen
- Ctrl+S to save, Escape to close
4. **Search**: Type in search box to filter notes
5. **URLs**: Add up to 5 URLs per note

### 🔒 Secret Notes (Hub Only)
1. **Access**: Click "🔒 Secret" button in Hub
2. **Password Prompt**: 
   - Enter password to unlock
   - Custom show/hide password toggle (white eye icon)
   - Browser default password icons hidden (Edge, Chrome, Firefox, Opera, Arc, Safari)
   - Press Enter to submit, ESC to close
3. **Interface**: Full notes app with consistent dark theme (not purple)
4. **Create**: Click "+" to create new secret note
5. **Edit**: 
   - Double-click title or content to edit
   - Click "Edit" button for full form
   - Support up to 100 URLs per note with optional names
6. **Security**: 
   - Password required each time modal is opened
   - Session-based lock (no persistent login)
7. **Storage**: Notes saved with type="secret" in database
8. **Isolation**: Secret notes don't appear in regular Notes app
9. **Features**:
   - Search notes by title/content
   - Rich HTML content with line breaks
   - URL management with custom names
   - Same CRUD operations as regular notes
10. **Performance**: 
    - Smooth 0.2s animations matching other modals
    - No delays or lag
    - Instant UI updates

### Tasks
1. **Default View**: App opens with "My Day" view
2. **Create list**: Click "+ New list" in sidebar
- Lists auto-named "Untitled list", "Untitled list (1)", etc.
- Click on name for inline edit, auto-save on blur/enter
- Right-click to rename/delete (normal color)
3. **Create task**: Click "Add a task" at bottom of task list
4. **Edit task**: Click on task to open editor on right
- **Auto-save**: No Save/Cancel buttons needed
- **Text Fields**: Auto-save when clicking outside (blur)
- **Due Date**: Auto-save when selecting Today/Tomorrow/Custom date
- **Toggle Buttons**: Auto-save when clicking Important/Daily Recurring
- **Move to List**: Auto-save when selecting different list
- **Silent**: No notifications, saves silently
5. **Complete**: Click circular checkbox to mark complete
6. **Keyboard**: Only Escape to close (no Ctrl+S needed)

### Mobile Usage
1. **Navigation**: Tap Notes/Tasks tabs in smart header
2. **Sidebar**: Tap ☰ to open sidebar, tap outside or ✕ to close
3. **Task Lists**:
- Use dropdown in header for quick switching (4 built-in lists)
- Use sidebar for all lists including custom ones
- Sidebar items now properly highlight when active
4. **Search** (Notes): Use search bar in mobile header
5. **Auto-Close**: Sidebar automatically closes when selecting task lists

### Auto-save Workflow
```
User Action → Auto-save Trigger → Silent Save → UI Update
├── Edit title/description → onBlur → Save task → Refresh list
├── Change due date → onChange → Save task → Update display
├── Toggle important → onClick → Save task → Update priority
├── Move to list → onChange → Save task → Refresh counts
└── No manual save needed ✨
```

### My Day Logic
- **Today's tasks**: Tasks with due date = today
- **Overdue tasks**: Overdue incomplete tasks
- **Daily recurring tasks**: Always appear every day (regardless of due date)

## 🎨 Customization

### Theme Colors
```css
:root {
--color-accent-primary: #007acc; /* Primary accent color */
--color-bg-primary: #1e1e1e; /* Main background */
--color-bg-elevated: #2d2d30; /* Hover color (consistent) */
--color-text-primary: #d4d4d4; /* Primary text */
--color-bg-secondary: #252526; /* Secondary background */
--color-border: #3e3e42; /* Border color */
}
```

### Animation Timing
```css
:root {
--transition-fast: 0.15s ease; /* Dropdowns, quick interactions */
--transition-normal: 0.2s ease; /* Modals, standard transitions */
--transition-slow: 0.3s ease; /* Complex animations */
}
```

## ⌨️ Keyboard Shortcuts

### Global (Works from any page)
- `Alt + T` - Open Translate modal (toggle)
- `Alt + C` - Open Calculator modal (toggle)
- `Alt + E` - Open Encoder modal (toggle)
- `Alt + B` - Open Backup modal (toggle)
- `Alt + K` - Open Shortcuts modal (toggle)
- `Escape` - Close all modals/editor
- `Double Click` - Edit title or content

**Note**: Uses Alt instead of Ctrl to avoid conflicts with browser shortcuts

### Rich Text Editor
- `Ctrl + A` - Select all (entire editor or just code block content if cursor is inside code block)
- `Ctrl + C` - Copy (copies as plain text when inside code block, preventing HTML structure copy)
- `Ctrl + B` - Bold text
- `Ctrl + I` - Italic text
- `Ctrl + U` - Underline text
- `Tab` - Insert 4 spaces
- `F11` - Toggle fullscreen
- `Ctrl + S` - Save and close
- `Escape` - Close with unsaved changes confirmation

### Task Editor (Auto-save)
- `Escape` - Close editor (auto-save already works)
- `Tab` - Navigate between fields
- `Enter` - Confirm dropdown selections

## 🔧 Development Notes

### Auto-save Implementation
```javascript
// Setup auto-save event listeners
function setupAutoSave() {
// Text inputs: auto-save on blur
inputs.forEach(input => {
input.addEventListener('blur', autoSaveTask);
});

// Date input: auto-save on change
dueDateInput.addEventListener('change', autoSaveTask);
}

// Auto-save function
function autoSaveTask() {
if (!window.currentEditingTask || !title.trim()) return;

const taskData = { /* collect form data */ };
saveTask(taskData).catch(error => {
console.error('Error auto-saving task:', error);
});
}

// Toggle buttons: auto-save after state change
function toggleImportantButton() {
checkbox.checked = !checkbox.checked;
updateToggleButtonState(btn, checkbox.checked);
autoSaveTask(); // Auto-save after toggle
}
```

### Rich Text Editor Implementation Details

**Smart Word Count Logic:**
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
            text = match[1]; // Text between `` ... ``
        } else {
            text = fullText; // Priority 3: All text
        }
    }
    
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    const count = words.length;
}
```

**Use Cases:**
- **Draft with notes**: `Draft text here `` final version only `` more notes` → counts final version
- **Count selection**: Select paragraph → click word count → see paragraph word count
- **Full document**: No markers or selection → counts everything

**Code Block Button Event Listeners:**
```javascript
// Problem: Buttons from saved content (DB) don't have event listeners
// Solution: Re-attach listeners when loading content

init(content) {
    // ... set content ...
    this.setupEventListeners();
    this.setupCodeBlockButtons(); // Re-attach for existing code blocks
}

setupCodeBlockButtons() {
    // Find all existing code blocks
    const codeBlockWrappers = this.editor.querySelectorAll('.code-block-wrapper');
    
    codeBlockWrappers.forEach(wrapper => {
        const copyBtn = wrapper.querySelector('.code-copy-btn');
        const codeBlock = wrapper.querySelector('.code-block');
        
        if (copyBtn && codeBlock) {
            // Attach onclick - use direct reference to codeBlock
            copyBtn.onclick = async (e) => {
                let text = codeBlock.innerText || codeBlock.textContent;
                await navigator.clipboard.writeText(text);
            };
        }
        // Same for pasteBtn and clearBtn
    });
}
```

**Why This Approach:**
- **New code blocks**: Event listeners attached in `insertCodeBlock()` when creating
- **Saved code blocks**: HTML loaded from DB has no JavaScript, needs re-attachment
- **Direct reference**: `wrapper.querySelector('.code-block')` more reliable than traversing
- **Works with complex HTML**: Handles nested elements from pasted code
```javascript
// Enhanced highlighting with immediate visual feedback
showSidebar() {
// ... sidebar show logic ...

// Force refresh active state with immediate visual feedback
setTimeout(() => {
const currentActiveItem = document.querySelector('.task-list-item.active');
if (currentActiveItem) {
// Apply immediate inline styles
currentActiveItem.style.background = 'var(--color-accent-primary)';
currentActiveItem.style.color = 'white';

// Remove inline styles after CSS takes over
setTimeout(() => {
currentActiveItem.style.background = '';
currentActiveItem.style.color = '';
}, 200);
}
}, 100);
}

// Force refresh method with reflow
refreshSidebarHighlighting() {
const activeListItem = document.querySelector('.task-list-item.active');
if (activeListItem) {
// Force CSS refresh by temporarily removing and re-adding classes
activeListItem.classList.remove('active');
activeListItem.offsetHeight; // Force reflow

setTimeout(() => {
activeListItem.classList.add('active');
// Additional force refresh with temporary class
activeListItem.classList.add('force-active');
setTimeout(() => {
activeListItem.classList.remove('force-active');
}, 100);
}, 10);
}
}
```

### LocalStorage Keys
- `notes_currentNoteId` - ID of currently open note
- `notes_editorState` - Editor state and form data
- `notes_cachedNote` - Cache note data for instant display
- `currentTab` - Current active tab (notes/tasks) for mobile sync

### Browser Compatibility
- **Modern Browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **ContentEditable**: Rich text editor requires modern browser support
- **CSS Variables**: Uses CSS custom properties
- **Safe Area**: Enhanced mobile browser support with safe-area-inset
- **Backdrop Filter**: Modal blur effect (may not support older browsers)

### Known Limitations
- **MockAPI Rate Limits**: Free tier has request limits
- **Rich Text**: No image support, only text formatting
- **Mobile UX**: Optimized for desktop, enhanced mobile experience
- **Offline**: No offline support (requires internet)
- **Auto-save**: Only saves when title exists (prevents empty tasks)

## 📱 Mobile Interface Details

### Unified Mobile Design (All Pages)
All pages (Hub, Notes, Tasks, Sources) now share the same simple mobile interface:

**Mobile Interface Features:**
- **Hamburger Button**: ☰ button in top-left corner of mobile header
- **Sidebar Slide**: Sidebar slides in from left with smooth animation
- **Toggle Behavior**: Button changes to ✕ when sidebar is open
- **Click Outside**: Sidebar closes when clicking outside or on ✕ button
- **Navigation Tabs**: All pages have Hub icon, Notes, and Tasks tabs in sidebar
- **Responsive**: Automatically activates on screens ≤768px width
- **Consistent**: Identical behavior across all pages

**Mobile Header Layout:**
```
[☰] [Page Title]
```

**Implementation:**
```javascript
// Each page has its own mobile JS file
class MobileInterface {
    constructor() {
        this.isMobile = window.innerWidth <= 768;
        this.sidebarVisible = false;
        this.init();
    }

    createMobileHeader() {
        // Creates hamburger button + page title
    }

    setupSidebarToggle() {
        // Handles sidebar show/hide with smooth animation
        // Click outside to close
    }
}
```

**Files:**
- `hub-mobile.js` - Hub page mobile interface
- `notes/notes-mobile.js` - Notes page mobile interface  
- `tasks/tasks-mobile.js` - Tasks page mobile interface
- `sources/sources-mobile.js` - Sources page mobile interface

### Mobile CSS Structure
All pages use identical mobile CSS:
```css
/* Mobile Header */
.mobile-header {
    display: none;
    padding: 15px;
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
    align-items: center;
    gap: 15px;
}

.mobile-hamburger {
    background: transparent;
    border: none;
    color: var(--color-text-primary);
    font-size: 24px;
    cursor: pointer;
    padding: 5px 10px;
    transition: all 0.2s;
}

/* Mobile Responsive */
@media (max-width: 768px) {
    .mobile-header {
        display: flex;
    }

    .sidebar {
        position: fixed;
        top: 0;
        left: 0;
        width: 280px;
        height: 100vh;
        z-index: 1000;
        transform: translateX(-100%);
        transition: transform 0.3s ease;
    }

    .sidebar.mobile-visible {
        transform: translateX(0);
    }
}
```

### Smart Header Design (Tasks Only - Legacy)
The Tasks page previously had a more complex smart header (now simplified):

**Old Header Components:**
- **Hamburger Toggle**: ☰/✕ button to show/hide sidebar
- **Navigation Tabs**: Switch between Notes and Tasks
- **Search Bar** (Notes): Mobile search input synced with desktop
- **List Selector** (Tasks): Dropdown to switch between task lists (4 built-in only)

**Old Mobile Navigation:**
```
[☰] [Notes|Tasks] .................... [Search/List Selector]
```

**Note**: This complex design has been replaced with the simple unified design across all pages.

### Mobile Sidebar Behavior
- **Slide Animation**: Smooth slide-in from left with transform
- **Overlay Background**: Dark backdrop when open (via click outside detection)
- **Auto-Close**: Closes when clicking outside sidebar area
- **Navigation**: All pages have Hub, Notes, Tasks tabs in sidebar
- **Consistent Width**: 280px sidebar width on all pages
- **High z-index**: z-index: 1000 to appear above content

### Mobile vs Desktop Differences
- **Header**: Mobile shows hamburger + title, desktop shows full sidebar
- **Sidebar**: Mobile sidebar is fixed and slides in, desktop sidebar is always visible
- **Navigation**: Mobile uses hamburger to access navigation, desktop has tabs always visible
- **Touch Optimization**: Larger touch targets (minimum 44px) on mobile

### Technical Implementation
```javascript
// Mobile interface automatically initializes
class MobileInterface {
constructor() {
this.isMobile = window.innerWidth <= 768;
this.sidebarVisible = false;
this.currentPage = this.getCurrentPage();
this.init();
this.setupSafeAreaSupport();
}

// Smart header creation with navigation and controls
createMobileHeader() {
// Creates navigation tabs + search/list selector based on current page
}

// Enhanced sidebar management with proper highlighting
toggleSidebar() {
// Smooth slide animation with proper active state management
}

// Synchronized list selection between dropdown and sidebar
selectList(listType) {
// Updates both mobile dropdown header and sidebar highlighting
// Clears conflicts and ensures proper visual feedback
}
}
```

## 🚀 Future Enhancements

### Planned Features
- **Drag & Drop**: Reorder tasks and lists
- **Keyboard Navigation**: Full keyboard support
- **Export/Import**: JSON/CSV export
- **Collaboration**: Real-time sharing
- **Offline Support**: PWA with service worker
- **Advanced Search**: Filters, date ranges
- **Themes**: Multiple color schemes
- **Attachments**: File upload support
- **Smart Recurring**: Auto-recreate completed recurring tasks
- **Undo/Redo**: With auto-save system

### Technical Improvements
- **TypeScript**: Type safety
- **State Management**: Centralized state (Redux/Zustand)
- **Testing**: Unit and integration tests
- **Build Process**: Webpack/Vite setup
- **API Optimization**: GraphQL or optimized REST
- **Caching**: Smart caching strategies
- **Performance**: Virtual scrolling for large lists
- **Auto-save Optimization**: Debounced saves, conflict resolution

## 🛠️ Setup & Deployment

### Local Development
1. Clone repository
2. Open `index.html` or `tasks.html` in browser
3. No build process needed (vanilla JS)

### API Setup
1. Create MockAPI account at mockapi.io
2. Create 2 tables: `notes` and `tasks`
3. Copy API URLs
4. Open `encoder.html`, encode URLs
5. Paste into `config.js`

### Deployment
- **Static Hosting**: Vercel, Netlify, GitHub Pages
- **No Backend Required**: Only serve static files
- **HTTPS Required**: For CORS with MockAPI to work

## 🐛 Troubleshooting

### Common Issues
1. **"No tasks found"**: Check My Day logic - need tasks with today's due date or recurring
2. **List counts not updating**: Fixed with `updateTaskCounts()` for custom lists
3. **New list not saving**: Fixed logic to always save even with empty names
4. **Different hover colors**: Unified all to `#2d2d30`
5. **Slow animations**: Optimized to `0.15s ease`
6. **Auto-save not working**:
- Check title is not empty
- See console logs for errors
- Verify API connection
7. **Mobile sidebar not highlighting**: Fixed with enhanced CSS specificity and JavaScript refresh
8. **Rich text showing HTML**: Fixed with enhanced content sanitization

### Mobile-Specific Issues
1. **Sidebar not highlighting**: Fixed with consolidated CSS rules and immediate visual feedback
2. **Dropdown not syncing**: Fixed synchronization between header dropdown and sidebar
3. **Safe area padding**: Enhanced support for mobile browsers with safe-area-inset
4. **Touch targets too small**: All interactive elements minimum 44px

### Auto-save Debug
```javascript
// Enable debug logging
window.DEBUG_AUTOSAVE = true;

// Check auto-save events
console.log('Auto-save triggered:', taskData);
console.log('Current editing task:', window.currentEditingTask);

// Verify event listeners
document.getElementById('taskTitle').addEventListener('blur', () => {
console.log('Title blur event fired');
});
```

### Mobile Debug
```javascript
// Enable mobile debug logging
window.DEBUG_MOBILE = true;

// Check mobile highlighting
console.log('Mobile sidebar visible:', this.sidebarVisible);
console.log('Active list item:', document.querySelector('.task-list-item.active'));

// Force refresh mobile highlighting
window.mobileInterface.forceSyncMobileHeader();
```

### Debug Tips
- Open browser console to see logs
- Check API calls in Network tab
- Verify localStorage data
- Test with `encoder.html` if API issues
- **Auto-save**: Check console for auto-save events
- **Mobile**: Test on actual mobile device or browser dev tools mobile mode

---

**Version**: 2.10.2
**Last Updated**: February 2026
**Tech Stack**: Vanilla JavaScript, MockAPI, CSS Variables
**License**: MIT
**Author**: BiBo Development Team

### Changelog v2.10.0 (Latest)
- ✅ **🔒 Secret Notes Feature (Hub Only)**:
  - **Dedicated App**: Separate notes app in Hub with password protection
  - **Password Modal**: Password required to access
  - **Full Interface**: Complete notes app with sidebar, editor, search
  - **Consistent Theme**: Dark theme matching other modals (not purple)
  - **Type: secret**: Notes stored with type="secret" in database
  - **Session Lock**: Password required each time modal is opened
  - **Isolation**: Secret notes don't appear in regular Notes app
  - **Hub Button**: Access via "🔒 Secret" button in Hub grid
  - **Files**: `secret/secret-modal.css`, `secret/secret-modal.js`

### Changelog v2.10.1
- ✅ **Secret Notes UX Improvements**:
  - **Custom Password Toggle**: White eye icon for show/hide password
  - **Browser Compatibility**: Hides default password reveal icons from all browsers:
    - Edge/IE: `::-ms-reveal`, `::-ms-clear`
    - Chrome/Opera/Arc: `::-webkit-credentials-auto-fill-button`
    - Firefox: `::-moz-reveal`
    - Safari: `::-webkit-contacts-auto-fill-button`
  - **ESC Key Support**: Press ESC to close modal at any time
  - **Performance Optimization**: 
    - Removed all `requestAnimationFrame` delays
    - Instant UI updates and transitions
    - Smooth 0.2s animations matching other hub modals
  - **Animation Consistency**: Same `slideIn 0.2s ease` as translate, calculator, encoder, backup modals
  - **Close Button**: Red background on hover (consistent with other modals)
  - **URL Management**: Support up to 100 URLs per secret note with optional names

### Changelog v2.10.2
- ✅ **Unified Mobile Interface Across All Pages**:
  - **Simple Hamburger Design**: All pages (Hub, Notes, Tasks, Sources) now use identical mobile interface
  - **Consistent Behavior**: 
    - Hamburger button (☰) in top-left corner
    - Sidebar slides in from left when clicked
    - Button changes to ✕ when sidebar is open
    - Click outside or on ✕ to close sidebar
  - **Mobile JS Files**: 
    - `hub-mobile.js` - Hub page mobile interface
    - `notes/notes-mobile.js` - Notes page mobile interface
    - `tasks/tasks-mobile.js` - Tasks page mobile interface
    - `sources/sources-mobile.js` - Sources page mobile interface
  - **Navigation Tabs**: All pages have navigation tabs (Hub icon, Notes, Tasks) in sidebar
  - **Responsive Design**: Automatically activates on screens ≤768px width
  - **Touch-Friendly**: Large touch targets and smooth animations
  - **Clean CSS**: Removed old complex mobile CSS, replaced with simple unified version
  - **No Conflicts**: Eliminated duplicate mobile blocks and conflicting styles

### Changelog v2.9.0
- ✅ **Global Modal System with Keyboard Shortcuts & Toggle**:
  - **Single Config File**: `shortcuts-config.js` - single source of truth for all shortcuts
  - **Global Shortcuts**: Open modals from any page (notes, tasks, hub) with keyboard shortcuts
  - **Toggle Support**: Press shortcut once to open, press again to close
  - **Lazy Loading**: Modals dynamically load only when first opened (better performance)
  - **CSS First Loading**: Load CSS before HTML injection to prevent flash of unstyled content
  - **Modal Loaders**: Each modal has a loader that injects HTML and loads CSS/JS
  - **Path Detection**: Auto-detects current page path for correct file loading
  - **Alt Key Usage**: Uses Alt instead of Ctrl to avoid browser shortcut conflicts
  - **Keyboard Shortcuts**:
    - `Alt+T` - Translate modal (toggle)
    - `Alt+C` - Calculator modal (toggle)
    - `Alt+E` - Encoder modal (toggle)
    - `Alt+B` - Backup modal (toggle)
    - `Alt+K` - Shortcuts modal (toggle)
    - `ESC` - Close all modals
  - **Click Outside**: All modals close when clicking outside modal content
  - **High z-index**: Modals use z-index: 10000 to appear above rich text editor
  - **No CORS Issues**: HTML injected via JavaScript (no fetch needed)
  - **Optimized Code**: Removed console.log debug statements, clean architecture
  - **Documentation**: Updated "Global Modal Popup Guide.md" with toggle support and Alt key usage

### Changelog v2.8.0
- ✅ **Modular Hub Architecture**:
  - **Refactored Modal System**: Separated modals into individual CSS/JS files
  - **Clean Hub.html**: Modal HTML embedded (CORS limitation), styles/logic modular
  - **Folder Structure**: 
    - `modals/` - Translate and Calculator modals
    - `backup/` - Backup modal (CSS + JS only)
    - `encoder/` - Encoder modal (CSS + JS only)
  - **Removed Redundant Files**: Cleaned up standalone HTML files, kept only modal versions
  - **CORS Solution**: Modal HTML embedded in hub.html, CSS/JS loaded separately
  - **Maintainability**: Each modal has its own CSS and JS file for easy updates
  - **Documentation**: Updated README and PROJECT-STRUCTURE with full context

### Changelog v2.7.0
- ✅ **Rich Text Editor State Persistence**:
  - **Word Count State**: Toggle state (on/off) is now saved to database and restored when reopening notes
  - **Timer Duration**: Timer duration is saved to database and continues from previous sessions
  - **Database Schema**: Added `wordCountEnabled` (boolean) and `timerDuration` (string) fields to Notes table
  - **Accumulated Writing Time**: Track total time spent writing on each note across multiple sessions
  - **Seamless Experience**: Editor state automatically restored when switching between notes

### Changelog v2.6.2
- ✅ **Smart Word Count**:
  - **Priority 1 - Selected Text**: Counts only selected text when user has selection
  - **Priority 2 - Marked Text**: Counts text between `` markers (e.g., `` count this ``)
  - **Priority 3 - All Text**: Counts entire content if no selection or markers
  - **Use Case**: Useful for counting specific sections or excluding notes

### Changelog v2.6.1
- ✅ **Code Block Button Fix**:
  - **Event Listeners for Saved Content**: Buttons from saved notes now work correctly
  - **setupCodeBlockButtons() Method**: Re-attaches event listeners to existing code blocks on load
  - **Direct Reference**: Uses direct querySelector within wrapper for reliability
  - **z-index Increased**: 9999 to ensure buttons always clickable
  - **Backspace/Delete Handler**: Auto-removes zero-width space in empty code blocks

### Changelog v2.6.0
- ✅ **Code Block Enhancements**:
  - **Copy/Paste/Clear Buttons**: 3 action buttons at top of each code block
  - **Fixed Width Buttons**: 68px width prevents layout shifts when text changes
  - **Plain Text Copy**: Ctrl+C in code block copies plain text only (no HTML)
  - **Smart Select All**: Ctrl+A in code block selects only that block's content
  - **Button Protection**: contenteditable="false" prevents accidental editing on buttons
  - **High z-index**: Buttons stay clickable above nested HTML elements
  - **Copy Feedback**: "Copied" message for 1.5 seconds after successful copy

### Changelog v2.5.0
- ✅ **Rich Text Editor Enhancements**:
  - **Word Count Feature**: Toggle-able real-time word counter with fixed width layout
  - **Writing Timer**: Built-in session timer with start/stop functionality
  - **Unsaved Changes Warning**: Confirmation prompt when closing with unsaved changes
  - **Style Consistency**: Unified button styles matching toolbar (hover effects, active states)
  - **Layout Stability**: Fixed width stats section prevents toolbar shifting
  - **Professional UX**: English confirmation messages for better user experience

### Changelog v2.4.0
- ✅ **Fixed Mobile Sidebar Highlighting**: Task list items now properly highlight on mobile
- ✅ **Enhanced CSS Specificity**: Consolidated mobile active state rules with maximum specificity
- ✅ **Immediate Visual Feedback**: Uses temporary inline styles for instant highlighting
- ✅ **Force Refresh Mechanism**: Removes and re-adds classes to force style updates
- ✅ **Synchronized Mobile Interface**: Dropdown and sidebar selection stay in sync
- ✅ **Auto-Close Sidebar**: Sidebar closes when selecting task lists on mobile
- ✅ **Cleanup Redundant Code**: Removed duplicate CSS rules and optimized mobile interface
- ✅ **Enhanced Documentation**: Comprehensive mobile interface and troubleshooting guide

### Previous Versions
- **v2.3.0**: Auto-save Task Editor, Silent Operations, Enhanced UX
- **v2.2.0**: Mobile Interface with Smart Header, Safe Area Support
- **v2.1.0**: Rich Text Editor Fullscreen Mode, Window Controls
- **v2.0.0**: Tasks Management System, Microsoft To Do Style Interface

## 📞 Support

If you encounter issues or have questions:
1. Check this README first
2. Check browser console for debugging
3. Verify API URLs in `config.js`
4. Test with `encoder.html` if need to update API
5. For mobile issues, test on actual device and check mobile debug logs
