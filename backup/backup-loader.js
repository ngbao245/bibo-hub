// Backup Modal Loader
let backupModalLoaded = false;

async function loadBackupModal() {
    if (backupModalLoaded) return;
    
    try {
        // Detect current path
        const basePath = window.location.pathname.includes('/notes/') || 
                         window.location.pathname.includes('/tasks/') ? '../' : './';
        
        // Load CSS first and wait for it
        if (!document.querySelector('link[href*="backup-modal.css"]')) {
            await new Promise((resolve) => {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = basePath + 'backup/backup-modal.css';
                link.onload = resolve;
                document.head.appendChild(link);
            });
        }
        
        // Then inject HTML
        const html = `
            <div id="backupModal" class="modal">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <span class="modal-title">💾 Backup</span>
                        <button onclick="closeBackupModal()" class="modal-close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="dm-stats">
                            <div class="dm-stats-title">Statistics</div>
                            <div class="dm-stats-grid">
                                <div class="dm-stat-item">
                                    <div class="dm-stat-value primary" id="dmTotalNotes">0</div>
                                    <div class="dm-stat-label">Total</div>
                                </div>
                                <div class="dm-stat-item">
                                    <div class="dm-stat-value secondary" id="dmIeltsNotes">0</div>
                                    <div class="dm-stat-label">IELTS</div>
                                </div>
                                <div class="dm-stat-item">
                                    <div class="dm-stat-value secondary" id="dmCodeNotes">0</div>
                                    <div class="dm-stat-label">Code</div>
                                </div>
                                <div class="dm-stat-item">
                                    <div class="dm-stat-value secondary" id="dmCourseNotes">0</div>
                                    <div class="dm-stat-label">Course</div>
                                </div>
                            </div>
                        </div>

                        <div class="dm-section">
                            <h3 class="dm-section-title">💾 Backup & Restore</h3>
                            <p class="dm-section-desc">Export or import notes as JSON backup file</p>
                            <div class="dm-button-group">
                                <button class="dm-btn dm-btn-primary" onclick="dmExportNotes()">
                                    📤 Export
                                </button>
                                
                                <button class="dm-btn" onclick="document.getElementById('dmImportFileMerge').click()">
                                    📁 Merge
                                </button>
                                <input type="file" id="dmImportFileMerge" accept=".json" onchange="dmImportNotes('merge')" style="display: none;">
                                
                                <button class="dm-btn dm-btn-danger" onclick="document.getElementById('dmImportFileReplace').click()">
                                    ⚠️ Replace
                                </button>
                                <input type="file" id="dmImportFileReplace" accept=".json" onchange="dmImportNotes('replace')" style="display: none;">
                            </div>
                            <div id="dmExportStatus" class="dm-status"></div>
                            <div id="dmImportStatus" class="dm-status"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container.firstElementChild);
        
        // Load JS - wait for it
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

// Lazy open function with toggle
async function openBackupModalLazy() {
    // Load modal first if not loaded
    await loadBackupModal();
    
    const modal = document.getElementById('backupModal');
    
    // Toggle: if open, close it
    if (modal && modal.classList.contains('show')) {
        if (typeof closeBackupModal === 'function') {
            closeBackupModal();
        } else {
            modal.classList.remove('show');
        }
    } else if (modal) {
        // Otherwise open it
        if (typeof openBackupModal === 'function') {
            openBackupModal();
        } else {
            modal.classList.add('show');
        }
    }
}
