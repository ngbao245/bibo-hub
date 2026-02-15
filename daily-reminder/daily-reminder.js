// Daily Tasks Reminder
// Auto-show modal if there are incomplete daily tasks

const REMINDER_API_URL = API_CONFIG?.TASKS || '';
const REMINDER_LAST_SHOWN_KEY = 'daily_reminder_last_shown';
const REMINDER_COOLDOWN_HOURS = 2; // Remind every 2 hours
let pendingTaskUpdates = new Map(); // Store pending task updates
let isSaving = false; // Track if save is in progress
let autoCloseTimeout = null; // Track auto-close timeout

async function checkDailyTasks() {
    try {
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
        
        // Fetch all tasks
        const response = await fetch(REMINDER_API_URL);
        const allData = await response.json();
        
        // Filter tasks (same logic as tasks.js)
        const tasks = allData.filter(item => item.type === 'task' || !item.type);
        
        // Filter daily recurring tasks that are not completed
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
    } catch (error) {
        console.error('Error checking daily tasks:', error);
    }
}

function showDailyReminder(tasks) {
    const modal = document.getElementById('dailyReminderModal');
    if (!modal) return;
    
    // Clear pending updates
    pendingTaskUpdates.clear();
    
    // Render tasks list
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
            e.stopPropagation(); // Prevent double toggle from parent
            
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
    
    // Show modal
    modal.classList.add('show');
    
    // Add click outside to close
    setTimeout(() => {
        modal.addEventListener('click', handleModalOutsideClick);
    }, 100);
    
    // Add ESC key to close
    document.addEventListener('keydown', handleEscapeKey);
}

function handleModalOutsideClick(e) {
    const modal = document.getElementById('dailyReminderModal');
    const modalContent = modal.querySelector('.daily-reminder-content');
    
    // Check if click is outside modal content
    if (e.target === modal && !modalContent.contains(e.target)) {
        closeDailyReminder();
        modal.removeEventListener('click', handleModalOutsideClick);
    }
}

function handleEscapeKey(e) {
    if (e.key === 'Escape') {
        closeDailyReminder();
        document.removeEventListener('keydown', handleEscapeKey);
    }
}

async function closeDailyReminder() {
    const modal = document.getElementById('dailyReminderModal');
    if (!modal) return;
    
    // Remove event listeners
    modal.removeEventListener('click', handleModalOutsideClick);
    document.removeEventListener('keydown', handleEscapeKey);
    
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
                
                const saveResponse = await fetch(`${REMINDER_API_URL}/${taskId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(task)
                });
                
                if (!saveResponse.ok) {
                    throw new Error(`HTTP ${saveResponse.status}`);
                }
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

function checkAllTasksCompleted() {
    // Clear any existing timeout
    if (autoCloseTimeout) {
        clearTimeout(autoCloseTimeout);
        autoCloseTimeout = null;
    }
    
    const allCheckboxes = document.querySelectorAll('.daily-task-checkbox');
    const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
    
    if (allChecked && allCheckboxes.length > 0) {
        // Debounce auto-close to handle rapid clicks
        autoCloseTimeout = setTimeout(() => {
            closeDailyReminder();
        }, 600);
    }
}

function goToTasks() {
    // Detect current path
    const isSubPage = window.location.pathname.includes('/notes/') || 
                      window.location.pathname.includes('/tasks/') ||
                      window.location.pathname.includes('/sources/') ||
                      window.location.pathname.includes('/project-packer/');
    
    if (isSubPage) {
        window.location.href = '../tasks/tasks.html';
    } else {
        window.location.href = './tasks/tasks.html';
    }
}

function closeAndGoToTasks() {
    // Close modal first (this will save pending updates)
    closeDailyReminder();
    
    // Navigate to Tasks app after a short delay to ensure save starts
    setTimeout(() => {
        goToTasks();
    }, 100);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Auto-check on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkDailyTasks);
} else {
    checkDailyTasks();
}

// Warn before closing tab/refresh if save is in progress
window.addEventListener('beforeunload', (e) => {
    if (isSaving) {
        e.preventDefault();
        e.returnValue = 'Tasks are being saved. Please wait a moment.';
        return e.returnValue;
    }
});
