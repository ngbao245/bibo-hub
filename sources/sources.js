// API Configuration
const API_NOTES = API_CONFIG.NOTES;

// State
let projects = [];
let currentProject = null;
let isEditing = false;
let searchQuery = '';

// DOM Elements
const projectsList = document.getElementById('projectsList');
const searchInput = document.getElementById('searchInput');
const editorView = document.getElementById('editorView');

// Initialize
init();

async function init() {
    setupEventListeners();
    await loadProjects();
}

// Setup event listeners
function setupEventListeners() {
    searchInput.addEventListener('input', debounce(() => {
        searchQuery = searchInput.value.toLowerCase();
        renderProjectsList();
        
        if (searchQuery) {
            document.getElementById('clearSearch').style.display = 'block';
        } else {
            document.getElementById('clearSearch').style.display = 'none';
        }
    }, 300));
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Load sources (only type="source" from notes table)
async function loadProjects() {
    try {
        const response = await fetch(API_NOTES);
        const allNotes = await response.json();
        
        // Filter only sources
        projects = allNotes.filter(n => n.type === 'source');
        projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        renderProjectsList();
    } catch (error) {
        console.error('Error loading projects:', error);
        projectsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #c5000b;">Error loading sources</div>';
    }
}

// Render projects list
function renderProjectsList() {
    if (projects.length === 0) {
        projectsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #858585;">No sources yet</div>';
        return;
    }
    
    const filtered = projects.filter(p => 
        p.title.toLowerCase().includes(searchQuery) ||
        (p.source && p.source.toLowerCase().includes(searchQuery)) ||
        (p.tags && p.tags.toLowerCase().includes(searchQuery))
    );
    
    if (filtered.length === 0) {
        projectsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #858585;">No sources found</div>';
        return;
    }
    
    projectsList.innerHTML = filtered.map(project => `
        <div class="project-item ${currentProject && currentProject.id === project.id ? 'active' : ''}" 
             onclick="selectProject('${project.id}')">
            <div class="project-item-title">${escapeHtml(project.title)}</div>
            <div class="project-item-meta">${formatDate(project.createdAt)}</div>
        </div>
    `).join('');
}

// Select project
function selectProject(id) {
    currentProject = projects.find(p => p.id === id);
    if (currentProject) {
        renderProjectsList();
        showViewMode();
    }
}

// New project
function newProject() {
    currentProject = null;
    showEditMode();
}

// Edit current project
function editCurrentProject() {
    if (currentProject) {
        showEditMode();
    }
}

// Show edit mode
function showEditMode() {
    isEditing = true;
    const project = currentProject || {};
    
    // Parse files from content
    let files = [];
    try {
        if (project.content) {
            const parsed = JSON.parse(project.content);
            // Convert old format {css, js, html} to new format [{name, content}]
            if (parsed.css !== undefined || parsed.js !== undefined || parsed.html !== undefined) {
                if (parsed.css) files.push({ name: 'CSS', content: parsed.css });
                if (parsed.js) files.push({ name: 'JavaScript', content: parsed.js });
                if (parsed.html) files.push({ name: 'HTML', content: parsed.html });
            } else {
                files = parsed;
            }
        }
    } catch (e) {
        files = [];
    }
    
    // Default files if empty
    if (files.length === 0) {
        files = [
            { name: 'CSS', content: '' },
            { name: 'JavaScript', content: '' }
        ];
    }
    
    const defaultTitle = `New Source ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    
    editorView.innerHTML = `
        <div class="editor-header">
            <div class="editor-title">${project.id ? 'Edit Source' : 'New Source'}</div>
            <div class="editor-actions">
                <button class="btn btn-primary" onclick="saveProject()">Save</button>
                ${project.id ? `<button class="btn" onclick="cancelEdit()">Cancel</button>` : ''}
            </div>
        </div>
        <div class="editor-content">
            <form id="projectForm" onsubmit="event.preventDefault(); saveProject();">
                <div class="form-group">
                    <label>Source Name</label>
                    <input type="text" id="projectTitle" value="${escapeHtml(project.title || '')}" 
                           placeholder="${project.id ? 'Untitled Source' : defaultTitle}">
                </div>

                <div class="form-group">
                    <label>Description</label>
                    <input type="text" id="projectDescription" value="${escapeHtml(project.source || '')}" 
                           placeholder="Brief description...">
                </div>

                <div class="form-group">
                    <label>Tags</label>
                    <input type="text" id="projectTags" value="${escapeHtml(project.tags || '')}" 
                           placeholder="modal, calculator, tool">
                </div>

                <div id="codeBlocks">
                    ${files.map((file, index) => `
                        <div class="code-file-block" data-index="${index}">
                            <div class="code-file-header">
                                <input type="text" class="code-file-name-input" value="${escapeHtml(file.name)}" placeholder="File name">
                                <div class="code-file-actions">
                                    <button type="button" class="btn-copy-code" onclick="copyCode('codeContent${index}')">Copy</button>
                                    <button type="button" class="btn-download-code" onclick="downloadCode('codeContent${index}')">Download</button>
                                    ${files.length > 1 ? `<button type="button" class="btn-remove-block" onclick="removeCodeBlock(${index})">×</button>` : ''}
                                </div>
                            </div>
                            <textarea id="codeContent${index}" class="code-file-content" placeholder="// Code here...">${escapeHtml(file.content || '')}</textarea>
                        </div>
                    `).join('')}
                </div>

                <button type="button" class="btn" onclick="addCodeBlock()">+ Add Code Block</button>
            </form>
        </div>
    `;
    
    document.getElementById('projectTitle').focus();
}

// Show view mode
function showViewMode() {
    if (!currentProject) return;
    
    isEditing = false;
    
    // Parse files
    let files = [];
    try {
        if (currentProject.content) {
            const parsed = JSON.parse(currentProject.content);
            // Convert old format to new format
            if (parsed.css !== undefined || parsed.js !== undefined || parsed.html !== undefined) {
                if (parsed.css) files.push({ name: 'CSS', content: parsed.css });
                if (parsed.js) files.push({ name: 'JavaScript', content: parsed.js });
                if (parsed.html) files.push({ name: 'HTML', content: parsed.html });
            } else {
                files = parsed;
            }
        }
    } catch (e) {
        files = [];
    }
    
    const fileCount = files.filter(f => f.content && f.content.trim()).length;
    
    editorView.innerHTML = `
        <div class="editor-header">
            <div class="editor-title">${escapeHtml(currentProject.title)}</div>
            <div class="editor-actions">
                <button class="btn" onclick="editCurrentProject()">Edit</button>
                <button class="btn btn-danger" onclick="deleteProject('${currentProject.id}')">Delete</button>
            </div>
        </div>
        <div class="view-mode">
            <div class="meta-info">
                <span class="meta-badge">Source</span>
                <span class="meta-badge">${formatDate(currentProject.createdAt)}</span>
                <span class="meta-badge">${fileCount} file${fileCount !== 1 ? 's' : ''}</span>
            </div>
            
            ${currentProject.source ? `
                <div class="content-section">
                    <h3>Description</h3>
                    <div class="content-text">${escapeHtml(currentProject.source)}</div>
                </div>
            ` : ''}
            
            ${currentProject.tags ? `
                <div class="content-section">
                    <h3>Tags</h3>
                    <div class="tags-list">
                        ${currentProject.tags.split(',').map(tag => `<span class="tag">${escapeHtml(tag.trim())}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
            
            <div class="content-section">
                <h3>Source Code</h3>
                ${files.map((file, index) => file.content && file.content.trim() ? `
                    <div class="code-file-view">
                        <div class="code-file-view-header">
                            <span class="code-file-view-label">${escapeHtml(file.name)}</span>
                            <div class="code-file-view-actions">
                                <button class="btn-copy-code" onclick="copyCodeView('codeView${index}')">Copy</button>
                                <button class="btn-download-code" onclick="downloadCodeView('codeView${index}')">Download</button>
                            </div>
                        </div>
                        <pre class="code-file-view-content" id="codeView${index}">${escapeHtml(file.content)}</pre>
                    </div>
                ` : '').join('')}
            </div>
        </div>
    `;
}

// Save project
async function saveProject() {
    const title = document.getElementById('projectTitle').value.trim();
    const description = document.getElementById('projectDescription').value.trim();
    const tags = document.getElementById('projectTags').value.trim();
    
    // Collect all code blocks
    const codeBlocks = document.querySelectorAll('.code-file-block');
    const files = [];
    
    codeBlocks.forEach((block, index) => {
        const name = block.querySelector('.code-file-name-input').value.trim();
        const textarea = block.querySelector('.code-file-content');
        if (textarea && name) {
            files.push({ name, content: textarea.value });
        }
    });
    
    const projectData = {
        title: title || 'Untitled Source',
        content: JSON.stringify(files),
        type: 'source',
        source: description,
        tags: tags,
        example: '',
        url1: '',
        url2: '',
        url3: '',
        url4: '',
        url5: ''
    };
    
    try {
        if (currentProject && currentProject.id) {
            // Update
            const response = await fetch(`${API_NOTES}/${currentProject.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...projectData, updatedAt: new Date().toISOString() })
            });
            currentProject = await response.json();
            
            const index = projects.findIndex(p => p.id === currentProject.id);
            if (index !== -1) projects[index] = currentProject;
        } else {
            // Create
            const response = await fetch(API_NOTES, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ...projectData, 
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                })
            });
            currentProject = await response.json();
            projects.unshift(currentProject);
        }
        
        renderProjectsList();
        showViewMode();
    } catch (error) {
        console.error('Error saving project:', error);
        alert('Error saving source');
    }
}

// Add code block
function addCodeBlock() {
    const container = document.getElementById('codeBlocks');
    const blocks = container.querySelectorAll('.code-file-block');
    const newIndex = blocks.length;
    
    const newBlock = `
        <div class="code-file-block" data-index="${newIndex}">
            <div class="code-file-header">
                <input type="text" class="code-file-name-input" value="Code ${newIndex + 1}" placeholder="File name">
                <div class="code-file-actions">
                    <button type="button" class="btn-copy-code" onclick="copyCode('codeContent${newIndex}')">Copy</button>
                    <button type="button" class="btn-download-code" onclick="downloadCode('codeContent${newIndex}')">Download</button>
                    <button type="button" class="btn-remove-block" onclick="removeCodeBlock(${newIndex})">×</button>
                </div>
            </div>
            <textarea id="codeContent${newIndex}" class="code-file-content" placeholder="// Code here..."></textarea>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', newBlock);
}

// Remove code block
function removeCodeBlock(index) {
    const block = document.querySelector(`.code-file-block[data-index="${index}"]`);
    if (block) {
        block.remove();
        // Reindex all remaining blocks
        reindexCodeBlocks();
    }
}

// Reindex code blocks after removal
function reindexCodeBlocks() {
    const container = document.getElementById('codeBlocks');
    if (!container) return;
    
    const blocks = container.querySelectorAll('.code-file-block');
    blocks.forEach((block, newIndex) => {
        block.setAttribute('data-index', newIndex);
        
        // Update textarea ID
        const textarea = block.querySelector('.code-file-content');
        const oldId = textarea.id;
        const newId = `codeContent${newIndex}`;
        textarea.id = newId;
        
        // Update copy button onclick
        const copyBtn = block.querySelector('.btn-copy-code');
        if (copyBtn) {
            copyBtn.setAttribute('onclick', `copyCode('${newId}')`);
        }
        
        // Update download button onclick
        const downloadBtn = block.querySelector('.btn-download-code');
        if (downloadBtn) {
            downloadBtn.setAttribute('onclick', `downloadCode('${newId}')`);
        }
        
        // Update remove button onclick
        const removeBtn = block.querySelector('.btn-remove-block');
        if (removeBtn) {
            removeBtn.setAttribute('onclick', `removeCodeBlock(${newIndex})`);
        }
    });
}

// Delete project
async function deleteProject(id) {
    if (!confirm('Delete this source?')) return;
    
    try {
        await fetch(`${API_NOTES}/${id}`, { method: 'DELETE' });
        projects = projects.filter(p => p.id !== id);
        currentProject = null;
        renderProjectsList();
        editorView.innerHTML = '<div class="empty-editor">Select a source or create a new one</div>';
    } catch (error) {
        console.error('Error deleting project:', error);
        alert('Error deleting source');
    }
}

// Cancel edit
function cancelEdit() {
    if (currentProject) {
        showViewMode();
    } else {
        editorView.innerHTML = '<div class="empty-editor">Select a source or create a new one</div>';
    }
}

// Copy code (edit mode)
function copyCode(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (textarea) {
        textarea.select();
        navigator.clipboard.writeText(textarea.value);
        
        const block = textarea.closest('.code-file-block');
        const btn = block.querySelector('.btn-copy-code');
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 1500);
        }
    }
}

// Download code (edit mode)
function downloadCode(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;
    
    const block = textarea.closest('.code-file-block');
    const nameInput = block.querySelector('.code-file-name-input');
    const defaultName = nameInput ? nameInput.value.trim() : 'code';
    
    showDownloadModal(defaultName, textarea.value);
}

// Download code (view mode)
function downloadCodeView(preId) {
    const pre = document.getElementById(preId);
    if (!pre) return;
    
    const view = pre.closest('.code-file-view');
    const label = view.querySelector('.code-file-view-label');
    const defaultName = label ? label.textContent.trim() : 'code';
    
    showDownloadModal(defaultName, pre.textContent);
}

// Copy code (view mode)
function copyCodeView(preId) {
    const pre = document.getElementById(preId);
    if (pre) {
        const text = pre.textContent;
        navigator.clipboard.writeText(text);
        
        const view = pre.closest('.code-file-view');
        const btn = view.querySelector('.btn-copy-code');
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 1500);
        }
    }
}

// Clear search
function clearSearch() {
    searchInput.value = '';
    searchQuery = '';
    document.getElementById('clearSearch').style.display = 'none';
    renderProjectsList();
}

// Helper functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
