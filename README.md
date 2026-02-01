# BiBo - Notes & Tasks Management App

A notes and tasks management application with Microsoft To Do style interface, supporting rich text editing and task management with custom lists. Latest version features auto-save task editor and fullscreen rich text mode.

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
- **🆕 Auto-save Task Editor**: No Save/Cancel buttons needed, auto-saves when:
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

### 📱 Mobile Interface (Smart Header)
- **Smart Header**: Compact header with navigation, list selection, and toggle
- **Navigation Tabs**: Switch between Notes and Tasks directly from header
- **List Selector**: Quick access to task lists without opening sidebar
- **Hamburger Toggle**: Show/hide sidebar with smooth animation
- **Search Integration**: Mobile search synced with desktop functionality
- **Responsive Design**: Optimized for mobile screens (≤768px)
- **Touch-Friendly**: Large touch targets and smooth interactions
### 🎨 UI/UX Features
- **Dark Theme**: Professional dark interface with CSS variables
- **Edge-style Tabs**: Navigation tabs close together without gaps
- **Unified Design**: Same sidebar width (280px) and color scheme
- **Consistent Hover Colors**: All hover effects use #2d2d30 (var(--color-bg-elevated))
- **Smooth Animations**: Dropdown animations 0.15s ease for consistency
- **Responsive Design**: Compatible with mobile and desktop
- **No Border Radius**: Form inputs use border-bottom only
- **Silent Operations**: No toast notifications when moving tasks

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

### 🆕 Auto-save Task Editor
**Brand New**: Task editor no longer has Save/Cancel buttons, automatically saves all changes:

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
4. **🆕 Edit task**: Click on task to open editor on right
   - **Auto-save**: No Save/Cancel buttons needed
   - **Text Fields**: Auto-save when clicking outside (blur)
   - **Due Date**: Auto-save when selecting Today/Tomorrow/Custom date
   - **Toggle Buttons**: Auto-save when clicking Important/Daily Recurring
   - **Move to List**: Auto-save when selecting different list
   - **Silent**: No notifications, saves silently
5. **Complete**: Click circular checkbox to mark complete
6. **Keyboard**: Only Escape to close (no Ctrl+S needed)

### 🆕 Auto-save Workflow
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
- `Double Click` - Edit title hoặc content

### Rich Text Editor
- `Ctrl + B` - Bold text
- `Ctrl + I` - Italic text  
- `Ctrl + U` - Underline text
- `Tab` - Insert 4 spaces
- `F11` - Toggle fullscreen
- `Ctrl + S` - Save và close
- `Escape` - Close (không save)

### 🆕 Task Editor (Auto-save)
- `Escape` - Close editor (auto-save đã hoạt động)
- ~~`Ctrl + S`~~ - **Không cần** (auto-save)
- `Tab` - Navigate giữa fields
- `Enter` - Confirm dropdown selections

## 🔧 Development Notes

### 🆕 Auto-save Implementation
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

### LocalStorage Keys
- `notes_currentNoteId` - ID of currently open note
- `notes_editorState` - Editor state and form data
- `notes_cachedNote` - Cache note data for instant display

### Browser Compatibility
- **Modern Browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **ContentEditable**: Rich text editor requires modern browser support
- **CSS Variables**: Uses CSS custom properties
- **Backdrop Filter**: Modal blur effect (may not support older browsers)

### Known Limitations
- **MockAPI Rate Limits**: Free tier has request limits
- **Rich Text**: No image support, only text formatting
- **Mobile UX**: Optimized for desktop, basic mobile experience
- **Offline**: No offline support (requires internet)
- **Auto-save**: Only saves when title exists (prevents empty tasks)

## 📱 Mobile Interface

### Smart Header Design
The mobile interface features a compact smart header that includes:

**Header Components:**
- **Hamburger Toggle**: ☰/✕ button to show/hide sidebar
- **Navigation Tabs**: Switch between Notes and Tasks
- **Search Bar** (Notes): Mobile search input synced with desktop
- **List Selector** (Tasks): Dropdown to switch between task lists

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
- **Auto-Close**: Sidebar closes when clicking outside

### Mobile Workflow
1. **Toggle Sidebar**: Tap ☰ to open/close sidebar
2. **Switch Apps**: Tap Notes/Tasks tabs in header
3. **Search** (Notes): Use header search bar
4. **Select List** (Tasks): Tap list selector dropdown
5. **Navigate**: All desktop features available in mobile

### Technical Implementation
```javascript
// Mobile interface automatically initializes
class MobileInterface {
    constructor() {
        this.isMobile = window.innerWidth <= 768;
        this.init();
    }
    
    // Smart header creation
    createMobileHeader() {
        // Navigation + Search/List selector
    }
    
    // Sidebar management
    toggleSidebar() {
        // Smooth slide animation
    }
}
```

## 📱 Responsive Design

### Breakpoints
- **Desktop**: > 768px - Full 3-column layout with sidebar
- **Mobile**: ≤ 768px - Smart header + collapsible sidebar

### Mobile Optimizations
- **Smart Header**: Compact navigation and controls
- **Fixed Sidebar**: Slides in from left with overlay
- **Touch Targets**: Minimum 44px for all interactive elements
- **Simplified Layout**: Single column with smart header
- **Synchronized Search**: Mobile search syncs with desktop
- **List Management**: Quick list switching via header dropdown

### Mobile-Specific Features
- **Hamburger Menu**: ☰/✕ toggle for sidebar
- **Header Tabs**: Direct navigation between Notes/Tasks
- **Dropdown Lists**: Quick task list selection
- **Overlay Background**: Dark backdrop when sidebar open
- **Auto-Close**: Sidebar closes on outside click
- **Responsive Text**: Smaller fonts on very small screens (<480px)

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
6. **🆕 Auto-save not working**: 
   - Check title is not empty
   - See console logs for errors
   - Verify API connection

### 🆕 Auto-save Debug
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

### Debug Tips
- Open browser console to see logs
- Check API calls in Network tab
- Verify localStorage data
- Test with `encoder.html` if API issues
- **Auto-save**: Check console for auto-save events

---

**Version**: 2.3.0 🆕  
**Last Updated**: February 2026  
**Tech Stack**: Vanilla JavaScript, MockAPI, CSS Variables  
**License**: MIT  
**Author**: BiBo Development Team

### 🆕 Changelog v2.3.0
- ✅ **Auto-save Task Editor**: Removed Save/Cancel buttons
- ✅ **Seamless UX**: Auto-save on blur, change, click
- ✅ **Silent Operations**: No notifications when auto-saving
- ✅ **Enhanced Workflow**: Microsoft To Do-like editing experience
- ✅ **Updated Documentation**: Comprehensive auto-save guide

## 📞 Support

If you encounter issues or have questions:
1. Check this README first
2. Check browser console for debugging
3. Verify API URLs in `config.js`
4. Test with `encoder.html` if need to update API