// Backup Modal Functions
const DM_API_URL = API_CONFIG?.NOTES || '';
const DM_TASKS_URL = API_CONFIG?.TASKS || '';

let currentTab = 'notes';

function openBackupModal() {
    document.getElementById('backupModal').classList.add('show');
    dmLoadStatistics();
    dmLoadTasksStatistics();
}

function closeBackupModal() {
    document.getElementById('backupModal').classList.remove('show');
}

// Switch between tabs
function dmSwitchTab(tab) {
    currentTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.dm-tab').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.dm-tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tab === 'notes' ? 'dmNotesTab' : 'dmTasksTab').classList.add('active');
}

// Legacy function name for compatibility
function openBackup() {
    openBackupModal();
}

// ===== NOTES FUNCTIONS =====

async function dmLoadStatistics() {
    try {
        const response = await fetch(DM_API_URL);
        const notes = await response.json();

        // Count by type in single pass
        const counts = { total: notes.length, note: 0, ielts: 0, code: 0, course: 0, interview: 0, secret: 0, source: 0 };
        notes.forEach(n => { if (counts.hasOwnProperty(n.type)) counts[n.type]++; });

        document.getElementById('dmTotalNotes').textContent = counts.total;
        document.getElementById('dmRegularNotes').textContent = counts.note;
        document.getElementById('dmIeltsNotes').textContent = counts.ielts;
        document.getElementById('dmCodeNotes').textContent = counts.code;
        document.getElementById('dmCourseNotes').textContent = counts.course;
        document.getElementById('dmInterviewNotes').textContent = counts.interview;
        document.getElementById('dmSecretNotes').textContent = counts.secret;
        document.getElementById('dmSourceNotes').textContent = counts.source;
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
}

async function dmExportNotes() {
    dmShowStatus('dmExportStatus', 'info', 'Exporting...');
    
    try {
        const response = await fetch(DM_API_URL);
        const notes = await response.json();

        const dataStr = JSON.stringify(notes, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `bibo-notes-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        dmShowStatus('dmExportStatus', 'success', `✅ Exported ${notes.length} notes!`);
    } catch (error) {
        console.error('Error exporting notes:', error);
        dmShowStatus('dmExportStatus', 'error', '❌ Export failed');
    }
}

async function dmImportNotes(mode) {
    const fileInput = mode === 'merge' ? 
        document.getElementById('dmImportFileMerge') : 
        document.getElementById('dmImportFileReplace');
    
    const file = fileInput.files[0];
    if (!file) return;

    dmShowStatus('dmImportStatus', 'info', 'Reading file...');

    try {
        const text = await file.text();
        const importedData = JSON.parse(text);

        if (!Array.isArray(importedData)) {
            throw new Error('Invalid file format: Expected an array');
        }

        if (importedData.length === 0) {
            throw new Error('File is empty');
        }

        // Validate file type
        const firstItem = importedData[0];
        const hasNotesFields = 'content' in firstItem || 'wordCountEnabled' in firstItem || 'timerDuration' in firstItem;
        const hasTasksFields = 'status' in firstItem || 'priority' in firstItem || 'dueDate' in firstItem || 'recurring' in firstItem || 'completedDate' in firstItem;

        if (hasTasksFields) {
            throw new Error('Wrong file type: This is a Tasks backup file. Please use the Tasks tab to import.');
        }

        if (!hasNotesFields) {
            throw new Error('Invalid notes file format: Missing required note fields');
        }

        if (mode === 'replace') {
            const confirmed = confirm(
                `⚠️ WARNING: Delete all existing notes?\n\nReplace with ${importedData.length} imported notes?\n\nThis cannot be undone!`
            );
            if (!confirmed) {
                dmShowStatus('dmImportStatus', 'info', 'Cancelled');
                fileInput.value = '';
                return;
            }

            dmShowStatus('dmImportStatus', 'info', 'Deleting...');
            await dmDeleteAllNotes();
        }

        dmShowStatus('dmImportStatus', 'info', `Importing ${importedData.length}...`);
        let successCount = 0;

        for (const note of importedData) {
            try {
                const noteData = {
                    title: note.title || 'Untitled',
                    content: note.content || '',
                    type: note.type || 'note',
                    source: note.source || '',
                    tags: note.tags || '',
                    example: note.example || '',
                    url1: note.url1 || '',
                    url2: note.url2 || '',
                    url3: note.url3 || '',
                    url4: note.url4 || '',
                    url5: note.url5 || '',
                    wordCountEnabled: note.wordCountEnabled || false,
                    timerDuration: note.timerDuration || '0',
                    createdAt: note.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                const response = await fetch(DM_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(noteData)
                });

                if (response.ok) successCount++;
            } catch (error) {
                console.error('Error importing note:', error);
            }
        }

        dmShowStatus('dmImportStatus', 'success', `✅ Imported ${successCount} notes!`);
        await dmLoadStatistics();
        fileInput.value = '';
    } catch (error) {
        console.error('Error importing notes:', error);
        dmShowStatus('dmImportStatus', 'error', `❌ ${error.message}`);
        fileInput.value = '';
    }
}

async function dmDeleteAllNotes() {
    const response = await fetch(DM_API_URL);
    const notes = await response.json();
    for (const note of notes) {
        await fetch(`${DM_API_URL}/${note.id}`, { method: 'DELETE' });
    }
}

function dmShowStatus(elementId, type, message) {
    const statusEl = document.getElementById(elementId);
    statusEl.classList.add('show');
    statusEl.textContent = message;
    
    if (type === 'success') {
        statusEl.style.background = 'rgba(0, 200, 100, 0.1)';
        statusEl.style.color = '#00c864';
        statusEl.style.border = '1px solid rgba(0, 200, 100, 0.3)';
    } else if (type === 'error') {
        statusEl.style.background = 'rgba(197, 0, 11, 0.1)';
        statusEl.style.color = '#c5000b';
        statusEl.style.border = '1px solid rgba(197, 0, 11, 0.3)';
    } else {
        statusEl.style.background = 'rgba(0, 122, 204, 0.1)';
        statusEl.style.color = 'var(--color-accent-primary)';
        statusEl.style.border = '1px solid rgba(0, 122, 204, 0.3)';
    }

    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            statusEl.classList.remove('show');
        }, 5000);
    }
}

// ===== TASKS FUNCTIONS =====

async function dmLoadTasksStatistics() {
    try {
        const response = await fetch(DM_TASKS_URL);
        const allTasks = await response.json();
        
        // Count in single pass
        const counts = { tasks: 0, pending: 0, completed: 0, lists: 0 };
        allTasks.forEach(t => {
            if (t.type === 'task') {
                counts.tasks++;
                if (t.status === 'pending') counts.pending++;
                if (t.status === 'completed') counts.completed++;
            } else if (t.type === 'list') {
                counts.lists++;
            }
        });

        document.getElementById('dmTotalTasks').textContent = counts.tasks;
        document.getElementById('dmPendingTasks').textContent = counts.pending;
        document.getElementById('dmCompletedTasks').textContent = counts.completed;
        document.getElementById('dmListsCount').textContent = counts.lists;
    } catch (error) {
        console.error('Error loading tasks statistics:', error);
    }
}

async function dmExportTasks() {
    dmShowStatus('dmExportTasksStatus', 'info', 'Exporting...');
    
    try {
        const response = await fetch(DM_TASKS_URL);
        const tasks = await response.json();

        const dataStr = JSON.stringify(tasks, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `bibo-tasks-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        dmShowStatus('dmExportTasksStatus', 'success', `✅ Exported ${tasks.length} tasks!`);
    } catch (error) {
        console.error('Error exporting tasks:', error);
        dmShowStatus('dmExportTasksStatus', 'error', '❌ Export failed');
    }
}

async function dmImportTasks(mode) {
    const fileInput = mode === 'merge' ? 
        document.getElementById('dmImportTasksMerge') : 
        document.getElementById('dmImportTasksReplace');
    
    const file = fileInput.files[0];
    if (!file) return;

    dmShowStatus('dmImportTasksStatus', 'info', 'Reading file...');

    try {
        const text = await file.text();
        const importedData = JSON.parse(text);

        if (!Array.isArray(importedData)) {
            throw new Error('Invalid file format: Expected an array');
        }

        if (importedData.length === 0) {
            throw new Error('File is empty');
        }

        // Validate file type
        const firstItem = importedData[0];
        const hasNotesFields = 'content' in firstItem || 'wordCountEnabled' in firstItem || 'timerDuration' in firstItem;
        const hasTasksFields = 'status' in firstItem || 'priority' in firstItem || 'dueDate' in firstItem || 'recurring' in firstItem || 'completedDate' in firstItem;

        if (hasNotesFields) {
            throw new Error('Wrong file type: This is a Notes backup file. Please use the Notes tab to import.');
        }

        if (!hasTasksFields) {
            throw new Error('Invalid tasks file format: Missing required task fields');
        }

        if (mode === 'replace') {
            const confirmed = confirm(
                `⚠️ WARNING: Delete all existing tasks?\n\nReplace with ${importedData.length} imported tasks?\n\nThis cannot be undone!`
            );
            if (!confirmed) {
                dmShowStatus('dmImportTasksStatus', 'info', 'Cancelled');
                fileInput.value = '';
                return;
            }

            dmShowStatus('dmImportTasksStatus', 'info', 'Deleting...');
            await dmDeleteAllTasks();
        }

        dmShowStatus('dmImportTasksStatus', 'info', `Importing ${importedData.length}...`);
        let successCount = 0;

        for (const task of importedData) {
            try {
                const taskData = {
                    type: task.type || 'task',
                    title: task.title || '',
                    name: task.name || '',
                    description: task.description || '',
                    parentId: task.parentId || '',
                    status: task.status || 'pending',
                    priority: task.priority || 'normal',
                    dueDate: task.dueDate || '',
                    recurring: task.recurring || false,
                    url1: task.url1 || '',
                    url2: task.url2 || '',
                    url3: task.url3 || '',
                    createdAt: task.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    completedDate: task.completedDate || ''
                };
                
                const response = await fetch(DM_TASKS_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(taskData)
                });

                if (response.ok) successCount++;
            } catch (error) {
                console.error('Error importing task:', error);
            }
        }

        dmShowStatus('dmImportTasksStatus', 'success', `✅ Imported ${successCount} tasks!`);
        await dmLoadTasksStatistics();
        fileInput.value = '';
    } catch (error) {
        console.error('Error importing tasks:', error);
        dmShowStatus('dmImportTasksStatus', 'error', `❌ ${error.message}`);
        fileInput.value = '';
    }
}

async function dmDeleteAllTasks() {
    const response = await fetch(DM_TASKS_URL);
    const tasks = await response.json();
    for (const task of tasks) {
        await fetch(`${DM_TASKS_URL}/${task.id}`, { method: 'DELETE' });
    }
}
