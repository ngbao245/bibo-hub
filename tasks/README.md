# Tasks App

A Microsoft To Do style task management application with auto-save, custom lists, and smart task filtering.

## 📋 Overview

Tasks app is a standalone task management application inspired by Microsoft To Do. Features 3-column layout (Lists → Tasks → Editor), auto-save functionality, and smart task filtering including "My Day" view with daily recurring tasks.

## 🚀 Features

### Core Features
- **3-Column Layout**: Lists → Tasks → Editor (Microsoft To Do style)
- **Default View**: Opens with "My Day" instead of "All Tasks"
- **Auto-save Task Editor**: No Save/Cancel buttons, auto-saves on:
  - Text inputs: blur (click outside)
  - Dropdowns: selection (due date, move to list)
  - Toggle buttons: click (Important, Daily Recurring)
- **Custom Lists**: Create and manage custom lists with auto-naming
- **Smart Task Management**:
  - **My Day**: Today's tasks + overdue + daily recurring
  - **All Tasks**: All tasks
  - **Important**: High priority tasks
  - **Completed**: Completed tasks
- **Task Features**:
  - Due date with dropdown (Today, Tomorrow, Pick a date)
  - Priority levels (High/Normal)
  - Daily Recurring: Always appear in My Day
  - Descriptions and URLs (up to 3)
  - Move tasks between lists
- **Circular Checkboxes**: Microsoft To Do style design
- **Context Menus**: Right-click to rename/delete lists
- **Inline List Editing**: Click to edit, auto-save on blur/enter

### Mobile Interface
- **Hamburger Menu**: ☰ button to toggle sidebar
- **Responsive Design**: Optimized for ≤768px screens
- **Touch-Friendly**: Large touch targets
- **Navigation**: Hub, Notes, Tasks tabs in sidebar
- **Auto-Close**: Sidebar closes when clicking outside

## 📁 File Structure

```
tasks/
├── tasks.html              # Main HTML page
├── tasks.css               # Styles
├── tasks.js                # Main logic (CRUD, filtering, auto-save)
├── tasks-storage.js        # LocalStorage utilities
├── tasks-mobile.js         # Mobile interface
└── README.md               # This file
```

## 🗄️ Database Schema

Uses MockAPI with single table for both tasks and lists:

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
  "category": "string",
  "recurring": "boolean",
  "url1": "string",
  "url2": "string",
  "url3": "string",
  "createdAt": "ISO string",
  "updatedAt": "ISO string",
  "completedDate": "ISO string"
}
```

**Field Usage:**
- `type`: "task" or "list" (differentiates tasks from lists)
- `title`: Task title
- `name`: List name (for lists only)
- `parentId`: For tasks, points to parent list ID; for lists, null
- `status`: "pending" or "completed" (tasks only)
- `priority`: "normal" or "high" (tasks only)
- `dueDate`: ISO date string (tasks only)
- `recurring`: true for daily recurring tasks (tasks only)
- `url1`, `url2`, `url3`: URLs for tasks
- `completedDate`: When task was completed

## 🔧 Technical Implementation

### Main Logic (tasks.js)

**State Management:**
```javascript
let tasks = [];              // All tasks from API
let lists = [];              // All lists from API
let currentList = 'today';   // Current list view
let currentEditingTask = null; // Task being edited
```

**Key Functions:**
- `init()`: Initialize app, load tasks and lists
- `loadTasks()`: Fetch tasks from API
- `loadLists()`: Fetch lists from API
- `saveTask(taskData)`: Create or update task (auto-save)
- `deleteTask(id)`: Delete task with confirmation
- `renderTasksList()`: Render filtered tasks
- `renderListsSidebar()`: Render lists sidebar
- `switchList(listType)`: Switch between list views
- `showTaskEditor(task)`: Show task editor (auto-save mode)
- `autoSaveTask()`: Auto-save current task
- `toggleTaskComplete(id)`: Toggle task completion
- `moveTaskToList(taskId, newParentId)`: Move task to different list

**My Day Logic:**
```javascript
case 'today':
    const today = new Date().toDateString();
    filtered = filtered.filter(task =>
        task.status !== 'completed' && (
            task.recurring === true || // Daily recurring always show
            (task.dueDate && new Date(task.dueDate).toDateString() === today) ||
            isOverdue(task.dueDate)
        )
    );
    break;
```

**Auto-save Implementation:**
```javascript
// Setup auto-save event listeners
function setupAutoSave() {
    // Text inputs: auto-save on blur
    const titleInput = document.getElementById('taskTitle');
    const descInput = document.getElementById('taskDescription');
    
    titleInput.addEventListener('blur', autoSaveTask);
    descInput.addEventListener('blur', autoSaveTask);
    
    // Date input: auto-save on change
    const dueDateInput = document.getElementById('taskDueDate');
    dueDateInput.addEventListener('change', autoSaveTask);
}

// Auto-save function
function autoSaveTask() {
    if (!window.currentEditingTask || !title.trim()) return;
    
    const taskData = {
        title: title.trim(),
        description: description.trim(),
        dueDate: dueDate,
        priority: priority,
        recurring: recurring,
        // ... collect all form data
    };
    
    saveTask(taskData).catch(error => {
        console.error('Error auto-saving task:', error);
    });
}

// Toggle buttons: auto-save after state change
function toggleImportantButton() {
    const checkbox = document.getElementById('taskImportant');
    checkbox.checked = !checkbox.checked;
    updateToggleButtonState(btn, checkbox.checked);
    autoSaveTask(); // Auto-save immediately
}
```

**Custom List Management:**
```javascript
// Create new list with auto-naming
async function createNewList() {
    let baseName = 'Untitled list';
    let counter = 0;
    let finalName = baseName;
    
    // Check for existing names
    while (lists.some(l => l.name === finalName)) {
        counter++;
        finalName = `${baseName} (${counter})`;
    }
    
    const listData = {
        type: 'list',
        name: finalName,
        createdAt: new Date().toISOString()
    };
    
    // Save to API
    const response = await fetch(API_TASKS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listData)
    });
    
    const newList = await response.json();
    lists.push(newList);
    renderListsSidebar();
}

// Inline edit list name
function editListName(listId) {
    const listItem = document.querySelector(`[data-list-id="${listId}"]`);
    const nameSpan = listItem.querySelector('.list-name');
    const currentName = nameSpan.textContent;
    
    const input = document.createElement('input');
    input.value = currentName;
    input.className = 'list-name-input';
    
    input.onblur = async function() {
        const newName = this.value.trim() || currentName;
        await updateListName(listId, newName);
        nameSpan.textContent = newName;
        nameSpan.style.display = 'inline';
        this.remove();
    };
    
    input.onkeydown = function(e) {
        if (e.key === 'Enter') this.blur();
        if (e.key === 'Escape') {
            nameSpan.style.display = 'inline';
            this.remove();
        }
    };
    
    nameSpan.style.display = 'none';
    listItem.insertBefore(input, nameSpan);
    input.focus();
    input.select();
}
```

**Move Task Between Lists:**
```javascript
async function moveTaskToList(taskId, newParentId) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Update task
    task.parentId = newParentId;
    
    // Save to API
    await fetch(`${API_TASKS}/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task)
    });
    
    // Refresh UI
    renderTasksList();
    updateTaskCounts();
}
```

### Storage (tasks-storage.js)

**LocalStorage Keys:**
- `tasks_currentList`: Current list view
- `tasks_sidebarCollapsed`: Sidebar collapse state

**Key Functions:**
- `saveCurrentList(listType)`: Save current list view
- `loadCurrentList()`: Load current list view
- `saveSidebarState(collapsed)`: Save sidebar state
- `loadSidebarState()`: Load sidebar state

### Mobile Interface (tasks-mobile.js)

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
    <h2>Tasks</h2>
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
- `.sidebar`: Left sidebar with lists
- `.tasks-list-container`: Middle panel with tasks
- `.task-editor-container`: Right panel with editor
- `.task-list-item`: List item in sidebar
- `.task-list-item.active`: Selected list
- `.task-item`: Task item
- `.task-item.completed`: Completed task
- `.task-checkbox`: Circular checkbox (Microsoft To Do style)
- `.mobile-header`: Mobile header with hamburger
- `.mobile-visible`: Sidebar visible on mobile

### Microsoft To Do Style Checkbox
```css
.task-checkbox {
    width: 20px;
    height: 20px;
    border: 2px solid var(--color-border);
    border-radius: 50%; /* Circular */
    cursor: pointer;
    transition: all 0.2s;
}

.task-checkbox:hover {
    border-color: var(--color-accent-primary);
}

.task-item.completed .task-checkbox {
    background: var(--color-accent-primary);
    border-color: var(--color-accent-primary);
}

.task-item.completed .task-checkbox::after {
    content: '✓';
    color: white;
    font-size: 14px;
}
```

## 🔌 Dependencies

### External
- `../common.css`: Shared styles (colors, buttons, scrollbar)
- `../config.js`: API configuration

### Internal
- `tasks.css`: Tasks-specific styles
- `tasks.js`: Main logic
- `tasks-storage.js`: LocalStorage utilities
- `tasks-mobile.js`: Mobile interface

### Global Modals (Optional)
- `../translate/translate-loader.js`: Translate modal
- `../modals/calculator-loader.js`: Calculator modal
- `../encoder/encoder-loader.js`: Encoder modal
- `../backup/backup-loader.js`: Backup modal
- `../global-shortcuts.js`: Keyboard shortcuts

## 🚀 Usage

### Basic Usage
1. Open `tasks.html` in browser
2. Default view is "My Day"
3. Click "Add a task" to create new task
4. Click task to open editor (auto-saves)
5. Click circular checkbox to complete task

### Creating Lists
1. Click "+ New list" in sidebar
2. List auto-named "Untitled list"
3. Click name to edit inline
4. Press Enter or click outside to save

### Managing Tasks
1. **Create**: Click "Add a task" at bottom
2. **Edit**: Click task to open editor
3. **Complete**: Click circular checkbox
4. **Delete**: Click × button in editor
5. **Move**: Use "Move to" dropdown in editor

### Auto-save Behavior
- **Title/Description**: Auto-saves when clicking outside
- **Due Date**: Auto-saves when selecting date
- **Important**: Auto-saves when clicking toggle
- **Daily Recurring**: Auto-saves when clicking toggle
- **Move to List**: Auto-saves when selecting list
- **No notifications**: Saves silently

### Mobile Usage
1. Tap ☰ to open sidebar
2. Select list from sidebar
3. Tap outside or ✕ to close sidebar
4. Manage tasks normally

## ⚙️ Configuration

### API Setup
Edit `../config.js`:
```javascript
const API_CONFIG = {
    TASKS: 'https://your-api.mockapi.io/tasks',
    // ...
};
```

### Adding New List Type
Built-in lists are hardcoded:
```javascript
const builtInLists = ['today', 'all', 'important', 'completed'];
```

To add new built-in list:
1. Add to `builtInLists` array
2. Add filter logic in `switchList()`
3. Add list item to sidebar HTML
4. Update `updateTaskCounts()` function

## 🐛 Troubleshooting

### Tasks not loading
- Check API URL in `config.js`
- Open Console (F12) for errors
- Verify MockAPI is accessible

### Auto-save not working
- Check title is not empty (required)
- Verify event listeners are attached
- Check Console for API errors
- Ensure `currentEditingTask` is set

### My Day not showing tasks
- Check task has `dueDate` set to today
- Verify overdue tasks have past `dueDate`
- Check `recurring: true` for daily tasks
- Verify task `status` is "pending"

### Lists not saving
- Check API connection
- Verify list has `type: "list"`
- Check `name` field is not empty
- See Console for errors

### Mobile sidebar not showing
- Check screen width ≤768px
- Verify `tasks-mobile.js` is loaded
- Check `.mobile-visible` class is added

### Task counts not updating
- Verify `updateTaskCounts()` is called after changes
- Check custom lists are included in count
- See Console for errors

## 📝 Development Notes

### Adding New Features

**New Task Field:**
1. Add field to database schema
2. Add input to task editor HTML
3. Add to `autoSaveTask()` data collection
4. Add to task display in `renderTasksList()`

**New List Filter:**
1. Add to `switchList()` switch statement
2. Add filter logic
3. Add list item to sidebar
4. Update counts function

**New Auto-save Trigger:**
1. Add event listener in `setupAutoSave()`
2. Call `autoSaveTask()` on event
3. Test auto-save behavior

### Code Style

**Naming Conventions:**
- Functions: camelCase (`loadTasks`, `saveTask`)
- Classes: PascalCase (`MobileInterface`)
- Constants: UPPER_SNAKE_CASE (`API_TASKS`)
- CSS classes: kebab-case (`.task-item`, `.task-editor`)

**File Organization:**
- Main logic in `tasks.js`
- Storage utilities in `tasks-storage.js`
- Mobile interface in `tasks-mobile.js`
- Styles in `tasks.css`

### Performance Optimizations
- **Optimistic UI**: Update UI first, API later
- **Event Delegation**: Avoid many event listeners
- **Debounced Auto-save**: Prevent excessive API calls
- **Cached Counts**: Update counts only when needed

## 🔗 Related Documentation

- `../README.md`: Global project overview
- `../PROJECT-STRUCTURE.md`: Project structure
- `../notes/README.md`: Notes app documentation

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
