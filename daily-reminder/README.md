# Daily Tasks Reminder

Auto-show modal that reminds users of incomplete daily recurring tasks every 2 hours.

## 📋 Overview

Daily Tasks Reminder is a global modal that automatically appears every 2 hours when there are pending daily recurring tasks. Users can complete tasks directly in the modal or navigate to the Tasks app. The reminder uses a smart cooldown system to avoid being intrusive.

## 🚀 Features

### Core Features
- **Smart Cooldown**: Appears every 2 hours (not on every page load)
- **Daily Recurring Tasks**: Shows only tasks with `recurring: true` and `status: pending`
- **One-way Check**: Mark tasks complete without leaving the page (cannot uncheck - must go to Tasks app)
- **Microsoft To Do Style**: Circular checkboxes matching Tasks app design
- **Auto-close with Debouncing**: Closes automatically when all tasks completed (600ms delay, handles rapid clicks)
- **Close & Go to Tasks**: Button to save changes and navigate to Tasks app
- **Smooth Animations**: Fade in and slide animations using CSS variables
- **Background Saving**: Modal closes immediately, saves in background
- **Optimistic UI**: Tasks disappear from My Day instantly

### User Experience
- **Non-intrusive**: Shows every 2 hours, not on every page load
- **Dismissible**: "Close" button to dismiss (won't show again for 2 hours)
- **Instant Feedback**: Tasks disappear from My Day immediately when completed
- **No Loading States**: Modal closes instantly, saves in background
- **Smooth Animations**: Fade out and slide up when completing tasks
- **One-way Check**: Cannot uncheck in modal - must go to Tasks app to undo
- **Error Handling**: Reverts changes and reloads if save fails
- **Responsive**: Works on mobile and desktop

## 📁 File Structure

```
daily-reminder/
├── daily-reminder-loader.js    # Injects modal HTML/CSS/JS globally
├── daily-reminder.js           # Main logic with optimistic updates
├── daily-reminder.css          # Styles with circular checkboxes
└── README.md                   # This file
```

## 🔧 Technical Implementation

### Main Logic (daily-reminder.js)

**State Management:**
```javascript
const REMINDER_API_URL = API_CONFIG?.TASKS || '';
const REMINDER_LAST_SHOWN_KEY = 'daily_reminder_last_shown';
const REMINDER_COOLDOWN_HOURS = 2; // Remind every 2 hours
let pendingTaskUpdates = new Map(); // Store pending task updates
let isSaving = false; // Track if save is in progress
let autoCloseTimeout = null; // Track auto-close timeout for debouncing
```

**Key Functions:**

**1. checkDailyTasks()** - Check for incomplete daily tasks with cooldown
```javascript
async function checkDailyTasks() {
    // Check cooldown - only show every 2 hours
    const lastShown = localStorage.getItem(REMINDER_LAST_SHOWN_KEY);
    if (lastShown) {
        const lastShownTime = new Date(lastShown);
        const now = new Date();
        const hoursSinceLastShown = (now - lastShownTime) / (1000 * 60 * 60);
        
        if (hoursSinceLastShown < REMINDER_COOLDOWN_HOURS) {
            return; // Still in cooldown period
        }
    }
    
    // Fetch tasks and filter daily recurring pending tasks
    const response = await fetch(REMINDER_API_URL);
    const allData = await response.json();
    const tasks = allData.filter(item => item.type === 'task' || !item.type);
    
    const dailyTasks = tasks.filter(task => 
        task.recurring === true && 
        task.status === 'pending'
    );
    
    if (dailyTasks.length > 0) {
        // Update last shown timestamp
        localStorage.setItem(REMINDER_LAST_SHOWN_KEY, new Date().toISOString());
        
        // Show reminder modal
        showDailyReminder(dailyTasks);
    }
}
```

**2. showDailyReminder(tasks)** - Render tasks list with checkboxes
```javascript
function showDailyReminder(tasks) {
    const modal = document.getElementById('dailyReminderModal');
    if (!modal) return;
    
    pendingTaskUpdates.clear();
    
    // Render tasks list with native checkboxes
    const tasksList = document.getElementById('dailyTasksList');
    tasksList.innerHTML = tasks.map(task => `
        <div class="daily-task-item" data-task-id="${task.id}" onclick="toggleDailyTask('${task.id}')">
            <input type="checkbox" class="daily-task-checkbox" data-task-id="${task.id}">
            <div class="daily-task-content">
                <div class="daily-task-title">${escapeHtml(task.title)}</div>
                ${task.description ? `<div class="daily-task-desc">${escapeHtml(task.description)}</div>` : ''}
            </div>
        </div>
    `).join('');
    
    // Add event listeners to checkboxes
    const checkboxes = tasksList.querySelectorAll('.daily-task-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent double toggle
            
            // Only allow checking, not unchecking
            if (!checkbox.checked) {
                checkbox.checked = true;
                return;
            }
            
            const taskId = checkbox.getAttribute('data-task-id');
            
            // Store pending change as completed
            pendingTaskUpdates.set(taskId, 'completed');
            
            // Update UI immediately - fade out and slide up
            const taskItem = document.querySelector(`.daily-task-item[data-task-id="${taskId}"]`);
            if (taskItem) {
                taskItem.style.transition = 'all 0.3s ease';
                taskItem.style.opacity = '0';
                taskItem.style.transform = 'translateX(20px)';
                taskItem.style.maxHeight = taskItem.offsetHeight + 'px';
                
                setTimeout(() => {
                    taskItem.style.maxHeight = '0';
                    taskItem.style.padding = '0';
                    taskItem.style.margin = '0';
                }, 300);
            }
            
            // Check if all tasks are completed
            checkAllTasksCompleted();
        });
    });
    
    modal.classList.add('show');
}
```

**3. toggleDailyTask(taskId)** - Click anywhere on task item
```javascript
function toggleDailyTask(taskId) {
    const checkbox = document.querySelector(`.daily-task-checkbox[data-task-id="${taskId}"]`);
    if (!checkbox) return;
    
    // Only allow checking, not unchecking
    if (checkbox.checked) return;
    
    // Check the checkbox
    checkbox.checked = true;
    
    // Store pending change as completed
    pendingTaskUpdates.set(taskId, 'completed');
    
    // Update UI immediately - fade out and slide up
    const taskItem = document.querySelector(`.daily-task-item[data-task-id="${taskId}"]`);
    if (taskItem) {
        taskItem.style.transition = 'all 0.3s ease';
        taskItem.style.opacity = '0';
        taskItem.style.transform = 'translateX(20px)';
        taskItem.style.maxHeight = taskItem.offsetHeight + 'px';
        
        setTimeout(() => {
            taskItem.style.maxHeight = '0';
            taskItem.style.padding = '0';
            taskItem.style.margin = '0';
        }, 300);
    }
    
    // Check if all tasks are completed
    checkAllTasksCompleted();
}
```

**4. closeDailyReminder()** - Close modal and save in background
```javascript
async function closeDailyReminder() {
    const modal = document.getElementById('dailyReminderModal');
    if (!modal) return;
    
    // Close modal immediately
    modal.classList.remove('show');
    
    // Save all pending task updates to API in background
    if (pendingTaskUpdates.size > 0) {
        isSaving = true;
        
        // Update local tasks state immediately (optimistic update)
        if (typeof tasks !== 'undefined') {
            pendingTaskUpdates.forEach((status, taskId) => {
                const task = tasks.find(t => t.id === taskId);
                if (task) {
                    task.status = status;
                    task.completedDate = status === 'completed' ? new Date().toISOString() : null;
                    task.updatedAt = new Date().toISOString();
                }
            });
            
            // Re-render tasks list immediately
            if (typeof renderTasksList === 'function') {
                renderTasksList();
            }
            if (typeof updateTaskCounts === 'function') {
                updateTaskCounts();
            }
        }
        
        try {
            // Save sequentially to avoid race conditions
            for (const [taskId, status] of pendingTaskUpdates.entries()) {
                const response = await fetch(`${REMINDER_API_URL}/${taskId}`);
                const task = await response.json();
                
                task.status = status;
                task.completedDate = status === 'completed' ? new Date().toISOString() : null;
                task.updatedAt = new Date().toISOString();
                
                await fetch(`${REMINDER_API_URL}/${taskId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(task)
                });
            }
            
            pendingTaskUpdates.clear();
            isSaving = false;
        } catch (error) {
            console.error('Error saving tasks:', error);
            isSaving = false;
            
            // Revert local changes and reload from API
            if (typeof loadTasks === 'function') {
                await loadTasks();
            }
        }
    }
}
```

**5. checkAllTasksCompleted()** - Auto-close when all tasks completed
```javascript
function checkAllTasksCompleted() {
    // Clear any existing timeout
    if (autoCloseTimeout) {
        clearTimeout(autoCloseTimeout);
        autoCloseTimeout = null;
    }
    
    const allCheckboxes = document.querySelectorAll('.daily-task-checkbox');
    const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
    
    if (allChecked && allCheckboxes.length > 0) {
        // Debounce auto-close to handle rapid clicks (600ms)
        autoCloseTimeout = setTimeout(() => {
            closeDailyReminder();
        }, 600);
    }
}
```

**6. closeAndGoToTasks()** - Close modal and navigate to Tasks app
```javascript
function closeAndGoToTasks() {
    // Close modal first (this will save pending updates)
    closeDailyReminder();
    
    // Navigate to Tasks app after a short delay to ensure save starts
    setTimeout(() => {
        goToTasks();
    }, 100);
}
```

**7. beforeunload Warning** - Warn if save is in progress
```javascript
window.addEventListener('beforeunload', (e) => {
    if (isSaving) {
        e.preventDefault();
        e.returnValue = 'Tasks are being saved. Please wait a moment.';
        return e.returnValue;
    }
});
```

## 🎨 Styling

### CSS Variables (from common.css)
```css
:root {
    --color-accent-primary: #007acc;
    --color-bg-elevated: #2d2d30;
    --color-text-primary: #d4d4d4;
    --color-border: #3e3e42;
    --transition-normal: 0.2s ease;
}
```

### Key CSS Classes
- `.daily-reminder-modal`: Modal overlay
- `.daily-reminder-content`: Modal content container
- `.daily-task-item`: Task item with hover effect
- `.daily-task-checkbox`: Circular checkbox (18x18px)
- `.daily-task-checkbox:checked`: Checked state with checkmark

### Circular Checkbox Style
```css
.daily-task-checkbox {
    width: 18px;
    height: 18px;
    border: 2px solid var(--color-border);
    border-radius: 50%; /* Circular */
    cursor: pointer;
    appearance: none;
    transition: var(--transition-normal);
}

.daily-task-checkbox:checked {
    background: var(--color-accent-primary);
    border-color: var(--color-accent-primary);
}

.daily-task-checkbox:checked::after {
    content: '✓';
    color: white;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.daily-task-item {
    cursor: pointer;
    user-select: none;
}
```

## 🔌 Dependencies

### External
- `../common.css`: Shared styles
- `../config.js`: API configuration (API_CONFIG.TASKS)

### Internal
- `daily-reminder.css`: Modal styles
- `daily-reminder.js`: Main logic
- `daily-reminder-loader.js`: Global injection

### Integration with Tasks App
- Reads from `tasks` global variable (if available)
- Calls `renderTasksList()` to update UI
- Calls `updateTaskCounts()` to update counts
- Calls `loadTasks()` to reload on error

## 🚀 Usage

### User Flow

**1. Page Load:**
- User opens any page (index, hub, notes, tasks, sources, project-packer)
- `checkDailyTasks()` runs automatically via loader
- Checks cooldown (2 hours since last shown)

**2. Cooldown Check:**
- If less than 2 hours since last shown → Don't show modal
- If 2+ hours since last shown → Continue check
- First time (no timestamp) → Continue check

**3. Task Check:**
- Fetches tasks from API
- Filters daily recurring pending tasks
- Shows modal if tasks found
- Updates last shown timestamp

**4. Modal Interaction:**
- User sees list of daily tasks
- Can click anywhere on task item or checkbox to mark as completed (one-way, cannot uncheck)
- Can click "Close & Go to Tasks" to save changes and open Tasks app
- Can click "Close" to dismiss and save changes

**5. Task Completion (Optimistic UI):**
- Click checkbox or task item → Checkbox checks immediately (cannot uncheck)
- Task fades out and slides up (visual feedback)
- Change stored in pending updates (not saved yet)
- To undo, must go to Tasks app and uncheck in Completed list
- If all tasks completed → Auto-closes after 600ms (debounced for rapid clicks)

**6. Background Saving:**
- Modal closes immediately when user clicks "Close"
- Local tasks array updated instantly (optimistic)
- Tasks disappear from My Day immediately
- API saves happen in background (sequential)
- If save fails → Reverts changes and reloads from API
- beforeunload warning if save in progress

**7. Next Reminder:**
- Won't show again for 2 hours
- Cooldown resets when modal is shown (not when closed)
- Timestamp persists across browser sessions (localStorage)

### LocalStorage Tracking

**Key:** `daily_reminder_last_shown`

**Value:** ISO timestamp (e.g., "2026-02-15T14:30:00.000Z")

**Logic:**
```javascript
const lastShown = localStorage.getItem('daily_reminder_last_shown');
if (lastShown) {
    const lastShownTime = new Date(lastShown);
    const now = new Date();
    const hoursSinceLastShown = (now - lastShownTime) / (1000 * 60 * 60);
    
    if (hoursSinceLastShown < 2) {
        // Still in cooldown, don't show
        return;
    }
}

// Show modal and update timestamp
localStorage.setItem('daily_reminder_last_shown', new Date().toISOString());
```

**Reset:** Automatically after 2 hours, or manually clear localStorage

## ⚙️ Configuration

### API Setup
Uses same API as Tasks app from `config.js`:
```javascript
const API_CONFIG = {
    TASKS: 'https://your-api.mockapi.io/tasks'
};
```

### Customization

**Change Cooldown Duration:**
```javascript
// In daily-reminder.js
const REMINDER_COOLDOWN_HOURS = 2; // Change to desired hours (e.g., 1, 3, 4)
```

**Change Icon:**
```html
<!-- In daily-reminder-loader.js -->
<div class="daily-reminder-icon">☀️</div>
<!-- Change to: 📋, ✓, 🎯, ⏰, etc. -->
```

**Change Title:**
```html
<!-- In daily-reminder-loader.js -->
<h2>Daily Tasks Reminder</h2>
<!-- Change to your preferred text -->
```

**Change Auto-close Delay:**
```javascript
// In checkAllTasksCompleted()
autoCloseTimeout = setTimeout(() => {
    closeDailyReminder();
}, 600); // Change 600 to desired milliseconds
```

## 🐛 Troubleshooting

### Modal not showing
- Check Console (F12) for errors
- Verify API URL in `config.js`
- Check if tasks have `recurring: true` and `status: pending`
- Check cooldown: `localStorage.getItem('daily_reminder_last_shown')`
- Clear cooldown: `localStorage.removeItem('daily_reminder_last_shown')`
- Verify loader script is loaded in page HTML

### Modal shows too frequently
- Check cooldown setting: `REMINDER_COOLDOWN_HOURS`
- Verify timestamp is being saved correctly
- Check browser localStorage is enabled

### Tasks not loading
- Check API connection
- Verify API returns tasks with `type: "task"`
- Check filter logic in `checkDailyTasks()`
- See Console for fetch errors

### Checkbox not working
- Verify `onclick="toggleDailyTask('${task.id}')"` is correct
- Check task ID is valid
- See Console for API errors
- Verify task exists in database

### Tasks not saving
- Check API URL in `config.js`
- Verify API is accessible
- Check Console for errors
- Verify `isSaving` flag is working

## 📝 Development Notes

### Cooldown System

**How it works:**
1. When modal is shown, save current timestamp to localStorage
2. On next page load, check if 2 hours have passed
3. If yes → Show modal and update timestamp
4. If no → Don't show modal

**Benefits:**
- Non-intrusive: Only reminds every 2 hours
- Persistent: Works across browser sessions
- Simple: Easy to understand and maintain
- Flexible: Easy to change cooldown duration

### Optimistic UI Pattern
1. Update UI immediately (fade out, update checkbox)
2. Update local state (tasks array)
3. Re-render tasks list
4. Save to API in background
5. Revert on error

### Sequential Saves
- Saves tasks one by one to avoid race conditions
- Uses `for...of` loop with `await`
- Prevents concurrent PUT requests to same resource

### Performance Optimizations

**1. Optimistic UI Updates:**
- Updates UI immediately (no waiting for API)
- Updates local tasks array first
- Re-renders tasks list instantly
- API saves in background
- Reverts on error

**2. Sequential API Saves:**
- Saves tasks one by one to avoid race conditions
- Uses `for...of` loop with `await`
- Prevents concurrent PUT requests to same resource

**3. Single API Call on Load:**
- Fetches all tasks once
- Filters in JavaScript (fast)

**4. Cooldown Caching:**
- Prevents repeated checks during cooldown period
- No API calls if in cooldown

**5. Lazy Loading:**
- Modal HTML injected only once
- CSS and JS loaded on demand

**6. Auto-close with Debouncing:**
- Prevents missing updates when checking tasks rapidly
- Clears previous timeout on each check
- Waits 600ms after last check before closing
- Ensures all pending updates are captured

## 🔗 Related Documentation

- `../tasks/README.md`: Tasks app documentation
- `../PROJECT-STRUCTURE.md`: Project structure
- `../DEVELOPMENT-RULES.md`: Development guidelines

## 📞 Support

For issues or questions:
1. Check this README first
2. Check browser Console for errors
3. Verify API configuration
4. Check Tasks app is working
5. Clear localStorage and test

---

**Version**: 2.0.0  
**Last Updated**: February 2026  
**Part of**: BiBo Project  
**Tech Stack**: Vanilla JavaScript, MockAPI, CSS Variables
