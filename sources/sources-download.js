// Download Modal for Sources

// File format configurations
const FILE_FORMATS = [
    { ext: 'html', icon: '🌐', name: 'HTML' },
    { ext: 'css', icon: '🎨', name: 'CSS' },
    { ext: 'js', icon: '⚡', name: 'JS' },
    { ext: 'md', icon: '📝', name: 'MD' },
    { ext: 'txt', icon: '📄', name: 'TXT' },
    { ext: 'json', icon: '📊', name: 'JSON' },
    { ext: 'xml', icon: '📋', name: 'XML' },
    { ext: 'py', icon: '🐍', name: 'PY' },
    { ext: 'java', icon: '☕', name: 'JAVA' },
    { ext: 'cs', icon: '#️⃣', name: 'C#' },
    { ext: 'sql', icon: '🗄️', name: 'SQL' }
];

// Generate format button HTML
function createFormatButton(filename, format) {
    return `
        <button class="download-format-btn" onclick="downloadWithFormat('${escapeForAttribute(filename)}', '${format.ext}')">
            <span class="format-icon">${format.icon}</span>
            <span class="format-name">${format.name}</span>
        </button>
    `;
}

// Generate custom format button HTML
function createCustomButton(filename) {
    return `
        <button class="download-format-btn download-format-custom" onclick="downloadWithCustomFormat('${escapeForAttribute(filename)}')">
            <span class="format-icon">✏️</span>
            <span class="format-name">Custom</span>
        </button>
    `;
}

// Show download modal with format options
function showDownloadModal(filename, content) {
    const escapedFilename = escapeForAttribute(filename);
    
    // Generate format buttons
    const formatButtons = FILE_FORMATS.map(format => createFormatButton(filename, format)).join('');
    const customButton = createCustomButton(filename);
    
    const modal = document.createElement('div');
    modal.className = 'download-modal';
    modal.innerHTML = `
        <div class="download-modal-content">
            <div class="download-modal-header">
                <span class="download-modal-title">Choose file format</span>
                <button class="download-modal-close" onclick="closeDownloadModal()">&times;</button>
            </div>
            <div class="download-modal-body">
                <div class="download-format-grid">
                    ${formatButtons}
                    ${customButton}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Store content in modal for later use
    modal.dataset.content = content;
    
    // Show modal
    setTimeout(() => modal.classList.add('show'), 10);
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeDownloadModal();
    });
    
    // Close on Escape key
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeDownloadModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

// Close download modal
function closeDownloadModal() {
    const modal = document.querySelector('.download-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 200);
    }
}

// Download with selected format
function downloadWithFormat(filename, extension) {
    const modal = document.querySelector('.download-modal');
    if (!modal) return;
    
    const content = modal.dataset.content;
    const finalFilename = `${filename}.${extension}`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFilename;
    a.click();
    URL.revokeObjectURL(url);
    
    closeDownloadModal();
}

// Download with custom format
function downloadWithCustomFormat(filename) {
    const extension = prompt('Enter custom file extension:', 'txt');
    if (!extension) return;
    
    const cleanExt = extension.replace(/^\./, '').trim();
    if (!cleanExt) return;
    
    downloadWithFormat(filename, cleanExt);
}

// Escape string for HTML attribute
function escapeForAttribute(str) {
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
