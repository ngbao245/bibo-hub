# BiBo - Notes & Tasks Management App

A comprehensive notes and tasks management application with Microsoft To Do style interface, featuring rich text editing, auto-save task management, and responsive mobile design with smart header navigation.

## 🚀 Key Features

### 📝 Notes Management
- **Rich Text Editor**: Support for bold, italic, underline, bullet lists, numbered lists
- **Fullscreen Mode**: Full-screen mode for writing (F11 or ⛶ button)
- **Window Controls**: Fullscreen button (gray) and close button (red) like Windows Explorer
- **Inline Editing**: Direct editing of title and content
- **Search**: Search notes by title and content
- **Categories & Tags**: Categorize notes by type, language, tags
- **URLs Management**: Store up to 5 URLs per note
- **Auto-save**: Automatically save form data while editing

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

### Database Schema (MockAPI)
Uses single table approach with `type` field to differentiate:

**Notes Table:**
```json
{
  "id": "string",
  "title": "string",
  "content": "string (HTML)",
  "type": "note|vocabulary|code|course",
  "language": "vi|en",
  "source": "string",
  "tags": "string (comma-separated)",
  "example": "string",
  "url1": "string",
  "url2": "string",
  "url3": "string",
  "url4": "string", 
  "url5": "string",
  "createdAt": "ISO string",
  "updatedAt": "ISO string"
}
```

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
├── index.html              # Notes page
├── tasks.html             # Tasks page  
├── app.js                 # Notes logic
├── tasks.js               # Tasks logic
├── mobile.js              # Mobile-specific enhancements
├── style.css              # Base styles + Notes styles
├── tasks.css              # Tasks-specific styles (extends style.css)
├── richtext-editor.js     # Rich text editor class
├── richtext-editor.css    # Rich text editor styles
├── storage.js             # LocalStorage utilities
├── config.js              # API configuration (encoded)
├── encoder.html           # API URL encoding tool
└── README.md              # Documentation
```

### API Configuration
File `config.js` contains centralized API endpoints (encoded):
```javascript
const API_CONFIG = {
    NOTES: 'encoded_url_here',
    TASKS: 'encoded_url_here'
};
```

**How to update API URL:**
1. Open `encoder.html` in browser
2. Enter new API URL
3. Click "Encode" 
4. Copy encoded string to `config.js`

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
            task.recurring === true ||  // Daily recurring tasks always show
            (task.dueDate && new Date(task.dueDate).toDateString() === today) ||
            isOverdue(task.dueDate)
        )
    );
```

### Rich Text Editor
- **ContentEditable**: Uses contenteditable with execCommand API
- **Fullscreen Mode**: Toggle with ⛶/🗗 button or F11 key
- **Window Controls**: `.window-controls` div contains fullscreen + close buttons
- **Toolbar State**: Dynamic update button states based on selection
- **HTML Sanitization**: Enhanced content cleaning to prevent HTML display bugs
- **Keyboard Shortcuts**: 
  - Ctrl+B/I/U (formatting)
  - Ctrl+S (save)
  - Escape (close)
  - F11 (toggle fullscreen)
  - Tab (insert 4 spaces)

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
  --color-accent-primary: #007acc;    /* Primary accent color */
  --color-bg-primary: #1e1e1e;        /* Main background */
  --color-bg-elevated: #2d2d30;       /* Hover color (consistent) */
  --color-text-primary: #d4d4d4;      /* Primary text */
  --color-bg-secondary: #252526;      /* Secondary background */
  --color-border: #3e3e42;            /* Border color */
}
```

### Animation Timing
```css
:root {
  --transition-fast: 0.15s ease;      /* Dropdowns, quick interactions */
  --transition-normal: 0.2s ease;     /* Modals, standard transitions */
  --transition-slow: 0.3s ease;       /* Complex animations */
}
```

## ⌨️ Keyboard Shortcuts

### Global
- `Escape` - Close editor/modal
- `Double Click` - Edit title or content

### Rich Text Editor
- `Ctrl + B` - Bold text
- `Ctrl + I` - Italic text  
- `Ctrl + U` - Underline text
- `Tab` - Insert 4 spaces
- `F11` - Toggle fullscreen
- `Ctrl + S` - Save and close
- `Escape` - Close (without save)

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

### Mobile Sidebar Highlighting Implementation
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

### Smart Header Design
The mobile interface features a compact smart header that includes:

**Header Components:**
- **Hamburger Toggle**: ☰/✕ button to show/hide sidebar
- **Navigation Tabs**: Switch between Notes and Tasks
- **Search Bar** (Notes): Mobile search input synced with desktop
- **List Selector** (Tasks): Dropdown to switch between task lists (4 built-in only)

**Mobile Navigation:**
```
[☰] [Notes|Tasks] .................... [Search/List Selector]
```

**Features:**
- **Responsive**: Automatically activates on screens ≤768px
- **Touch-Friendly**: Large touch targets (44px minimum)
- **Smooth Animations**: 0.3s sidebar slide, 0.15s dropdown
- **Synchronized**: Mobile actions sync with desktop functionality
- **Overlay**: Dark overlay when sidebar is open
- **Auto-Close**: Sidebar closes when clicking outside or selecting lists
- **Fixed Highlighting**: Task list items properly highlight when active

### Mobile Sidebar Behavior
- **Slide Animation**: Smooth slide-in from left with transform
- **Overlay Background**: Dark backdrop when open
- **Auto-Close**: Closes when selecting task lists or clicking outside
- **Proper Highlighting**: Active task lists now show blue background and white text
- **Sync with Dropdown**: Selection syncs between sidebar and header dropdown
- **All Lists Available**: Sidebar shows all lists (built-in + custom)

### Mobile vs Desktop Differences
- **Header Dropdown**: Mobile shows only 4 built-in lists (My Day, All Tasks, Important, Completed)
- **Sidebar**: Mobile sidebar shows all lists including custom ones
- **Navigation**: Mobile uses smart header, desktop uses traditional sidebar navigation
- **Search**: Mobile search in header, desktop search in sidebar/main content
- **Touch Optimization**: Larger touch targets and simplified interactions on mobile

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

**Version**: 2.4.0  
**Last Updated**: February 2026  
**Tech Stack**: Vanilla JavaScript, MockAPI, CSS Variables  
**License**: MIT  
**Author**: BiBo Development Team

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