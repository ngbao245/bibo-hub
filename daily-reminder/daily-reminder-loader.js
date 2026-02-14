// Daily Reminder Loader
let dailyReminderLoaded = false;

async function loadDailyReminder() {
    if (dailyReminderLoaded) return;
    
    try {
        // Detect current path
        const basePath = window.location.pathname.includes('/notes/') || 
                         window.location.pathname.includes('/tasks/') ||
                         window.location.pathname.includes('/sources/') ||
                         window.location.pathname.includes('/project-packer/') ? '../' : './';
        
        // Inject HTML directly
        const html = `
            <div id="dailyReminderModal" class="daily-reminder-modal">
                <div class="daily-reminder-content">
                    <div class="daily-reminder-header">
                        <div class="daily-reminder-icon">☀️</div>
                        <div class="daily-reminder-header-text">
                            <h2>Daily Tasks Reminder</h2>
                            <p>You have pending daily tasks</p>
                        </div>
                    </div>
                    <div class="daily-reminder-body">
                        <div id="dailyTasksList" class="daily-tasks-list"></div>
                    </div>
                    <div class="daily-reminder-footer">
                        <div class="daily-reminder-footer-buttons">
                            <button class="daily-reminder-btn" onclick="closeDailyReminder()">Close</button>
                            <button class="daily-reminder-btn daily-reminder-btn-primary" onclick="closeAndGoToTasks()">Close & Go to Tasks</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container.firstElementChild);
        
        // Load CSS if not already loaded
        if (!document.querySelector('link[href*="daily-reminder.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = basePath + 'daily-reminder/daily-reminder.css';
            document.head.appendChild(link);
        }
        
        // Load JS if not already loaded
        if (typeof checkDailyTasks === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = basePath + 'daily-reminder/daily-reminder.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        dailyReminderLoaded = true;
    } catch (error) {
        console.error('Error loading daily reminder:', error);
    }
}

// Auto-load on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDailyReminder);
} else {
    loadDailyReminder();
}
