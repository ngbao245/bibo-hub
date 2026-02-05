// Backup Modal Functions
const DM_API_URL = API_CONFIG?.NOTES || '';

function openBackupModal() {
    document.getElementById('backupModal').classList.add('show');
    dmLoadStatistics();
}

function closeBackupModal() {
    document.getElementById('backupModal').classList.remove('show');
}

// Legacy function name for compatibility
function openBackup() {
    openBackupModal();
}

async function dmLoadStatistics() {
    try {
        const response = await fetch(DM_API_URL);
        const notes = await response.json();

        document.getElementById('dmTotalNotes').textContent = notes.length;
        document.getElementById('dmIeltsNotes').textContent = notes.filter(n => n.type === 'ielts').length;
        document.getElementById('dmCodeNotes').textContent = notes.filter(n => n.type === 'code').length;
        document.getElementById('dmCourseNotes').textContent = notes.filter(n => n.type === 'course').length;
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
        const importedNotes = JSON.parse(text);

        if (!Array.isArray(importedNotes)) {
            throw new Error('Invalid file format');
        }

        if (mode === 'replace') {
            const confirmed = confirm(
                `⚠️ WARNING: Delete all existing notes?\n\nReplace with ${importedNotes.length} imported notes?\n\nThis cannot be undone!`
            );
            if (!confirmed) {
                dmShowStatus('dmImportStatus', 'info', 'Cancelled');
                fileInput.value = '';
                return;
            }

            dmShowStatus('dmImportStatus', 'info', 'Deleting...');
            await dmDeleteAllNotes();
        }

        dmShowStatus('dmImportStatus', 'info', `Importing ${importedNotes.length}...`);
        let successCount = 0;

        for (const note of importedNotes) {
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
