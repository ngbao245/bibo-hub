# Backup Modal

Export and import notes and tasks data with statistics display and tab-based interface.

## 📋 Overview

Backup modal provides data export/import functionality for both notes and tasks. Features JSON export, merge/replace import modes, file type validation, and statistics display showing counts by type. Organized in tabs for easy navigation between Notes and Tasks backup.

## 🚀 Features

- **Dual Tab Interface**: Separate tabs for Notes and Tasks backup
- **Export Data**: Export notes or tasks as JSON file
- **Import Modes**: 
  - Merge: Add imported data to existing data
  - Replace: Replace all data with imported data
- **File Type Validation**: Automatically detects and prevents wrong file type imports
- **Statistics Display**: 
  - Notes: Total, Note, IELTS, Code, Course, Secret, Source
  - Tasks: Total, Pending, Completed, Lists
- **Global Access**: Open from any page with Alt+B
- **Toggle Support**: Press Alt+B once to open, again to close

## 📁 File Structure

```
backup/
├── backup-loader.js        # Dynamic modal loader
├── backup-modal.js         # Modal logic with tabs
├── backup-modal.css        # Modal styles with tabs
└── README.md               # This file
```

## 🔧 Technical Implementation

### Tab System

**Switch Between Tabs:**
```javascript
function dmSwitchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.dm-tab').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.dm-tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tab === 'notes' ? 'dmNotesTab' : 'dmTasksTab').classList.add('active');
}
```

### Statistics Loading

**Notes Statistics (Optimized - Single Pass):**
```javascript
async function dmLoadStatistics() {
    const response = await fetch(DM_API_URL);
    const notes = await response.json();

    // Count by type in single pass
    const counts = { total: notes.length, note: 0, ielts: 0, code: 0, course: 0, secret: 0, source: 0 };
    notes.forEach(n => { if (counts.hasOwnProperty(n.type)) counts[n.type]++; });

    document.getElementById('dmTotalNotes').textContent = counts.total;
    document.getElementById('dmRegularNotes').textContent = counts.note;
    // ... update other counts
}
```

**Tasks Statistics (Optimized - Single Pass):**
```javascript
async function dmLoadTasksStatistics() {
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
    // ... update other counts
}
```

### File Type Validation

**Detect Notes vs Tasks File:**
```javascript
// Validate file type
const firstItem = importedData[0];
const hasNotesFields = 'content' in firstItem || 'wordCountEnabled' in firstItem || 'timerDuration' in firstItem;
const hasTasksFields = 'status' in firstItem || 'priority' in firstItem || 'dueDate' in firstItem;

if (hasTasksFields) {
    throw new Error('Wrong file type: This is a Tasks backup file. Please use the Tasks tab to import.');
}

if (!hasNotesFields) {
    throw new Error('Invalid notes file format: Missing required note fields');
}
```

**Why this approach:**
- Checks unique fields that only exist in notes or tasks
- Fast validation (only checks first item)
- Clear error messages guide user to correct tab
- Prevents accidental data corruption

### Export Functions

**Export Notes:**
```javascript
async function dmExportNotes() {
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
}
```

**Export Tasks:**
```javascript
async function dmExportTasks() {
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
}
```

### Import Functions

**Import with Validation:**
```javascript
async function dmImportNotes(mode) {
    const file = fileInput.files[0];
    const text = await file.text();
    const importedData = JSON.parse(text);
    
    // Validate array
    if (!Array.isArray(importedData) || importedData.length === 0) {
        throw new Error('Invalid file format');
    }
    
    // Validate file type
    const firstItem = importedData[0];
    const hasNotesFields = 'content' in firstItem || 'wordCountEnabled' in firstItem;
    const hasTasksFields = 'status' in firstItem || 'priority' in firstItem;
    
    if (hasTasksFields) {
        throw new Error('Wrong file type: This is a Tasks backup file');
    }
    
    // Import logic
    if (mode === 'replace') {
        await dmDeleteAllNotes();
    }
    
    for (const note of importedData) {
        await fetch(DM_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(noteData)
        });
    }
}
```

**Why this approach:**
- Validates file type before any operations
- Prevents accidental data loss
- Clear error messages
- Optimized single-pass counting

### Modal Loader (backup-loader.js)

**Dynamic Loading with Toggle:**
```javascript
let backupModalLoaded = false;

async function loadBackupModal() {
    if (backupModalLoaded) return;
    
    try {
        const basePath = window.location.pathname.includes('/notes/') || 
                         window.location.pathname.includes('/tasks/') ? '../' : './';
        
        // Inject HTML
        const html = `
            <div id="backupModal" class="modal">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <span class="modal-title">Backup & Restore</span>
                        <button onclick="closeBackupModal()" class="modal-close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="dm-stats">
                            <h3>Statistics</h3>
                            <div class="dm-stat-item">
                                <span>Total Notes:</span>
                                <span id="dmTotalNotes">0</span>
                            </div>
                            <div class="dm-stat-item">
                                <span>IELTS:</span>
                                <span id="dmIeltsNotes">0</span>
                            </div>
                            <div class="dm-stat-item">
                                <span>Code:</span>
                                <span id="dmCodeNotes">0</span>
                            </div>
                            <div class="dm-stat-item">
                                <span>Course:</span>
                                <span id="dmCourseNotes">0</span>
                            </div>
                        </div>
                        <div class="dm-actions">
                            <button onclick="dmExportNotes()" class="btn btn-primary">Export Notes</button>
                            <button onclick="dmImportNotes('merge')" class="btn">Import (Merge)</button>
                            <button onclick="dmImportNotes('replace')" class="btn btn-danger">Import (Replace)</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container.firstElementChild);
        
        // Load CSS
        if (!document.querySelector('link[href*="backup-modal.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = basePath + 'backup/backup-modal.css';
            document.head.appendChild(link);
        }
        
        // Load JS
        if (typeof openBackupModal === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = basePath + 'backup/backup-modal.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        backupModalLoaded = true;
    } catch (error) {
        console.error('Error loading backup modal:', error);
    }
}

// Lazy open with toggle
async function openBackupModalLazy() {
    await loadBackupModal();
    
    const modal = document.getElementById('backupModal');
    
    if (modal && modal.classList.contains('show')) {
        if (typeof closeBackupModal === 'function') {
            closeBackupModal();
        } else {
            modal.classList.remove('show');
        }
    } else if (modal) {
        if (typeof openBackupModal === 'function') {
            openBackupModal();
        } else {
            modal.classList.add('show');
        }
    }
}
```

### Key Functions

- `openBackupModal()`: Open modal and load statistics
- `closeBackupModal()`: Close modal
- `dmLoadStatistics()`: Load and display note counts
- `dmExportNotes()`: Export notes as JSON file
- `dmImportNotes(mode)`: Import notes (merge or replace)

## 🎨 Styling

### Key CSS Classes
- `.modal`: Modal container (z-index: 10000)
- `.dm-stats`: Statistics display area
- `.dm-stat-item`: Individual stat row
- `.dm-actions`: Button container

### Layout
```
┌─────────────────────────────────────┐
│ Backup & Restore                  × │
├─────────────────────────────────────┤
│ Statistics                          │
│ Total Notes:              42        │
│ IELTS:                    15        │
│ Code:                     12        │
│ Course:                   10        │
│                                     │
│ [Export Notes]                      │
│ [Import (Merge)]                    │
│ [Import (Replace)]                  │
└─────────────────────────────────────┘
```

## 🔌 Dependencies

### External
- `../common.css`: Shared styles
- `../config.js`: API configuration

### Integration
- Loaded via `backup-loader.js` in all pages
- Registered in `shortcuts-config.js` with Alt+B
- Handled by `global-shortcuts.js`

## 🚀 Usage

### Exporting Notes

1. **Open Modal**: Press `Alt+B` or click "Backup" in Hub
2. **View Statistics**: See note counts by type
3. **Export**: Click "Export Notes"
4. **Save File**: Browser downloads `notes-backup-YYYY-MM-DD.json`

### Importing Notes (Merge)

1. **Open Modal**: Press `Alt+B`
2. **Import Merge**: Click "Import (Merge)"
3. **Select File**: Choose JSON file
4. **Confirm**: Notes are added to existing notes
5. **Statistics Update**: Counts refresh automatically

### Importing Notes (Replace)

1. **Open Modal**: Press `Alt+B`
2. **Import Replace**: Click "Import (Replace)"
3. **Select File**: Choose JSON file
4. **Confirm**: All existing notes are deleted, imported notes added
5. **Statistics Update**: Counts refresh automatically

**⚠️ Warning**: Replace mode deletes all existing notes (except secret and source notes)!

## ⚙️ Configuration

### Export Filename
Change filename format:
```javascript
link.download = `my-notes-${Date.now()}.json`; // Timestamp
link.download = `notes-backup.json`; // Fixed name
```

### Filtered Types
Change which types to export/import:
```javascript
// Current: Excludes secret and source
const notes = allNotes.filter(n => n.type !== 'secret' && n.type !== 'source');

// Include all types
const notes = allNotes;

// Exclude only secret
const notes = allNotes.filter(n => n.type !== 'secret');
```

### Statistics Display
Add more types:
```javascript
const counts = {
    total: notes.length,
    ielts: notes.filter(n => n.type === 'ielts').length,
    code: notes.filter(n => n.type === 'code').length,
    course: notes.filter(n => n.type === 'course').length,
    note: notes.filter(n => n.type === 'note').length // Add regular notes
};
```

## 🐛 Troubleshooting

### Export not working
- Check API connection
- Verify `API_CONFIG.NOTES` is correct
- Check Console for errors
- Verify browser allows downloads

### Import fails
- Check JSON file format is valid
- Verify file contains array of notes
- Check each note has required fields
- See Console for specific errors

### Statistics not loading
- Check API connection
- Verify `API_CONFIG.NOTES` is accessible
- Check Console for errors
- Refresh modal to retry

### Replace mode not deleting all notes
- Verify filter excludes secret/source notes
- Check API DELETE requests succeed
- See Console for errors

## 📝 Development Notes

### JSON File Format

**Expected Format:**
```json
[
  {
    "id": "1",
    "title": "Note Title",
    "content": "Note content",
    "type": "note",
    "source": "",
    "tags": "tag1, tag2",
    "example": "",
    "url1": "",
    "url2": "",
    "url3": "",
    "url4": "",
    "url5": "",
    "wordCountEnabled": false,
    "timerDuration": "0",
    "createdAt": "2026-02-11T00:00:00.000Z",
    "updatedAt": "2026-02-11T00:00:00.000Z"
  }
]
```

### Adding Validation

**Validate imported notes:**
```javascript
function validateNote(note) {
    const required = ['title', 'content', 'type'];
    for (const field of required) {
        if (!note[field]) {
            return false;
        }
    }
    return true;
}

// In import function
const validNotes = importedNotes.filter(validateNote);
if (validNotes.length !== importedNotes.length) {
    alert(`Warning: ${importedNotes.length - validNotes.length} invalid notes skipped`);
}
```

### Performance Optimization
- Import in batches (e.g., 10 notes at a time)
- Show progress indicator for large imports
- Use Promise.all() for parallel requests

## 🔗 Related Documentation

- `../README.md`: Global project overview
- `../PROJECT-STRUCTURE.md`: Project structure
- `../notes/README.md`: Notes app documentation
- `../shortcut/GLOBAL-MODAL-POPUP-GUIDE.md`: How to create global modals

## 📞 Support

For issues or questions:
1. Check this README first
2. Verify API connection
3. Check JSON file format
4. Check Console for errors

---

**Version**: 2.10.2  
**Last Updated**: February 2026  
**Part of**: BiBo Project  
**Tech Stack**: Vanilla JavaScript, MockAPI
