// Projects Modal Logic

// Modal State
let modalProjects = [];
let modalCurrentProject = null;
let modalIsEditing = false;
let modalSearchQuery = '';
let modalInitialized = false;

function openSourcesModal() {
    const modal = document.getElementById('sourcesModal');
    if (modal) {
        modal.classList.add('show');
        if (!modalInitialized) {
            initSourcesModal();
            modalInitialized = true;
        }
        // Initialize mobile interface
        setTimeout(() => initSourcesMobileInterface(), 100);
    }
}

function closeSourcesModal() {
    const modal = document.getElementById('sourcesModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// Initialize sources modal
async function initSourcesModal() {
    setupSourcesModalEventListeners();
    await loadSourcesModal();
}

// Setup event listeners
function setupSourcesModalEventListeners() {
    const searchInput = document.getElementById('sourcesSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounceModal(() => {
            modalSearchQuery = searchInput.value.toLowerCase();
            renderSourcesListModal();
            
            const clearBtn = document.getElementById('sourcesClearSearch');
            if (clearBtn) {
                clearBtn.style.display = modalSearchQuery ? 'block' : 'none';
            }
        }, 300));
    }
}

// Debounce function
function debounceModal(func, wait) {
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

// Load projects
async function loadSourcesModal() {
    try {
        const response = await fetch(API_CONFIG.NOTES);
        const allNotes = await response.json();
        
        modalProjects = allNotes.filter(n => n.type === 'source');
        modalProjects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        renderSourcesListModal();
    } catch (error) {
        console.error('Error loading projects:', error);
        const list = document.getElementById('sourcesListModal');
        if (list) {
            list.innerHTML = '<div style="padding: 20px; text-align: center; color: #c5000b;">Error loading sources</div>';
        }
    }
}

// Render projects list
function renderSourcesListModal() {
    const list = document.getElementById('sourcesListModal');
    if (!list) return;
    
    if (modalProjects.length === 0) {
        list.innerHTML = '<div style="padding: 20px; text-align: center; color: #858585;">No sources yet</div>';
        return;
    }
    
    const filtered = modalProjects.filter(p => 
        p.title.toLowerCase().includes(modalSearchQuery) ||
        (p.source && p.source.toLowerCase().includes(modalSearchQuery)) ||
        (p.tags && p.tags.toLowerCase().includes(modalSearchQuery))
    );
    
    if (filtered.length === 0) {
        list.innerHTML = '<div style="padding: 20px; text-align: center; color: #858585;">No sources found</div>';
        return;
    }
    
    list.innerHTML = filtered.map(project => `
        <div class="project-item ${modalCurrentProject && modalCurrentProject.id === project.id ? 'active' : ''}" 
             onclick="selectProjectModal('${project.id}')">
            <div class="project-item-title">${escapeHtmlModal(project.title)}</div>
            <div class="project-item-meta">${formatDateModal(project.createdAt)}</div>
        </div>
    `).join('');
}

// Select project
function selectProjectModal(id) {
    modalCurrentProject = modalProjects.find(p => p.id === id);
    if (modalCurrentProject) {
        renderSourcesListModal();
        showViewModeModal();
    }
}

// New source
function newSourceModal() {
    modalCurrentProject = null;
    showEditModeModal();
}

// Show view mode
function showViewModeModal() {
    if (!modalCurrentProject) return;
    
    modalIsEditing = false;
    
    let files = [];
    try {
        if (modalCurrentProject.content) {
            const parsed = JSON.parse(modalCurrentProject.content);
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
    const editorView = document.getElementById('sourcesEditorView');
    if (!editorView) return;
    
    editorView.innerHTML = `
        <div class="editor-header">
            <div class="editor-title">${escapeHtmlModal(modalCurrentProject.title)}</div>
            <div class="editor-actions">
                <button class="btn" onclick="editCurrentProjectModal()">Edit</button>
                <button class="btn btn-danger" onclick="deleteProjectModal('${modalCurrentProject.id}')">Delete</button>
            </div>
        </div>
        <div class="view-mode">
            <div class="meta-info">
                <span class="meta-badge">Source</span>
                <span class="meta-badge">${formatDateModal(modalCurrentProject.createdAt)}</span>
                <span class="meta-badge">${fileCount} file${fileCount !== 1 ? 's' : ''}</span>
            </div>
            
            ${modalCurrentProject.source ? `
                <div class="content-section">
                    <h3>Description</h3>
                    <div class="content-text">${escapeHtmlModal(modalCurrentProject.source)}</div>
                </div>
            ` : ''}
            
            ${modalCurrentProject.tags ? `
                <div class="content-section">
                    <h3>Tags</h3>
                    <div class="tags-list">
                        ${modalCurrentProject.tags.split(',').map(tag => `<span class="tag">${escapeHtmlModal(tag.trim())}</span>`).join('')}
                    </div>
                </div>
            ` : ''}
            
            <div class="content-section">
                <h3>Source Code</h3>
                ${files.map((file, index) => file.content && file.content.trim() ? `
                    <div class="code-file-view">
                        <div class="code-file-view-header">
                            <span class="code-file-view-label">${escapeHtmlModal(file.name)}</span>
                            <button class="btn-copy-code" onclick="copyCodeViewModal('codeViewModal${index}')">Copy</button>
                        </div>
                        <pre class="code-file-view-content" id="codeViewModal${index}">${escapeHtmlModal(file.content)}</pre>
                    </div>
                ` : '').join('')}
            </div>
        </div>
    `;
}

// Edit current project
function editCurrentProjectModal() {
    if (modalCurrentProject) {
        showEditModeModal();
    }
}

// Show edit mode
function showEditModeModal() {
    modalIsEditing = true;
    const project = modalCurrentProject || {};
    
    let files = [];
    try {
        if (project.content) {
            const parsed = JSON.parse(project.content);
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
    
    if (files.length === 0) {
        files = [
            { name: 'CSS', content: '' },
            { name: 'JavaScript', content: '' }
        ];
    }
    
    const defaultTitle = `New Source ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    const editorView = document.getElementById('sourcesEditorView');
    if (!editorView) return;
    
    editorView.innerHTML = `
        <div class="editor-header">
            <div class="editor-title">${project.id ? 'Edit Source' : 'New Source'}</div>
            <div class="editor-actions">
                <button class="btn btn-primary" onclick="saveProjectModal()">Save</button>
                ${project.id ? `<button class="btn" onclick="cancelEditModal()">Cancel</button>` : ''}
            </div>
        </div>
        <div class="editor-content">
            <form id="projectFormModal" onsubmit="event.preventDefault(); saveProjectModal();">
                <div class="form-group">
                    <label>Source Name</label>
                    <input type="text" id="projectTitleModal" value="${escapeHtmlModal(project.title || '')}" 
                           placeholder="${project.id ? 'Untitled Source' : defaultTitle}">
                </div>

                <div class="form-group">
                    <label>Description</label>
                    <input type="text" id="projectDescriptionModal" value="${escapeHtmlModal(project.source || '')}" 
                           placeholder="Brief description...">
                </div>

                <div class="form-group">
                    <label>Tags</label>
                    <input type="text" id="projectTagsModal" value="${escapeHtmlModal(project.tags || '')}" 
                           placeholder="modal, calculator, tool">
                </div>

                <div id="codeBlocksModal">
                    ${files.map((file, index) => `
                        <div class="code-file-block" data-index="${index}">
                            <div class="code-file-header">
                                <input type="text" class="code-file-name-input" value="${escapeHtmlModal(file.name)}" placeholder="File name">
                                <div class="code-file-actions">
                                    <button type="button" class="btn-copy-code" onclick="copyCodeModal('codeContentModal${index}')">Copy</button>
                                    ${files.length > 1 ? `<button type="button" class="btn-remove-block" onclick="removeCodeBlockModal(${index})">×</button>` : ''}
                                </div>
                            </div>
                            <textarea id="codeContentModal${index}" class="code-file-content" placeholder="// Code here...">${escapeHtmlModal(file.content || '')}</textarea>
                        </div>
                    `).join('')}
                </div>

                <button type="button" class="btn" onclick="addCodeBlockModal()">+ Add Code Block</button>
            </form>
        </div>
    `;
    
    const titleInput = document.getElementById('projectTitleModal');
    if (titleInput) titleInput.focus();
}

// Save project
async function saveProjectModal() {
    const title = document.getElementById('projectTitleModal').value.trim();
    const description = document.getElementById('projectDescriptionModal').value.trim();
    const tags = document.getElementById('projectTagsModal').value.trim();
    
    const codeBlocks = document.querySelectorAll('#codeBlocksModal .code-file-block');
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
        url1: '', url2: '', url3: '', url4: '', url5: ''
    };
    
    try {
        if (modalCurrentProject && modalCurrentProject.id) {
            const response = await fetch(`${API_CONFIG.NOTES}/${modalCurrentProject.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...projectData, updatedAt: new Date().toISOString() })
            });
            modalCurrentProject = await response.json();
            
            const index = modalProjects.findIndex(p => p.id === modalCurrentProject.id);
            if (index !== -1) modalProjects[index] = modalCurrentProject;
        } else {
            const response = await fetch(API_CONFIG.NOTES, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ...projectData, 
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                })
            });
            modalCurrentProject = await response.json();
            modalProjects.unshift(modalCurrentProject);
        }
        
        renderSourcesListModal();
        showViewModeModal();
    } catch (error) {
        console.error('Error saving project:', error);
        alert('Error saving source');
    }
}

// Delete project
async function deleteProjectModal(id) {
    if (!confirm('Delete this source?')) return;
    
    try {
        await fetch(`${API_CONFIG.NOTES}/${id}`, { method: 'DELETE' });
        modalProjects = modalProjects.filter(p => p.id !== id);
        modalCurrentProject = null;
        renderSourcesListModal();
        const editorView = document.getElementById('sourcesEditorView');
        if (editorView) {
            editorView.innerHTML = '<div class="empty-editor">Select a source or create a new one</div>';
        }
    } catch (error) {
        console.error('Error deleting project:', error);
        alert('Error deleting source');
    }
}

// Cancel edit
function cancelEditModal() {
    if (modalCurrentProject) {
        showViewModeModal();
    } else {
        const editorView = document.getElementById('sourcesEditorView');
        if (editorView) {
            editorView.innerHTML = '<div class="empty-editor">Select a source or create a new one</div>';
        }
    }
}

// Add code block
function addCodeBlockModal() {
    const container = document.getElementById('codeBlocksModal');
    if (!container) return;
    
    const blocks = container.querySelectorAll('.code-file-block');
    const newIndex = blocks.length;
    
    const newBlock = `
        <div class="code-file-block" data-index="${newIndex}">
            <div class="code-file-header">
                <input type="text" class="code-file-name-input" value="Code ${newIndex + 1}" placeholder="File name">
                <div class="code-file-actions">
                    <button type="button" class="btn-copy-code" onclick="copyCodeModal('codeContentModal${newIndex}')">Copy</button>
                    <button type="button" class="btn-remove-block" onclick="removeCodeBlockModal(${newIndex})">×</button>
                </div>
            </div>
            <textarea id="codeContentModal${newIndex}" class="code-file-content" placeholder="// Code here..."></textarea>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', newBlock);
}

// Remove code block
function removeCodeBlockModal(index) {
    const block = document.querySelector(`#codeBlocksModal .code-file-block[data-index="${index}"]`);
    if (block) {
        block.remove();
        // Reindex all remaining blocks
        reindexCodeBlocks();
    }
}

// Reindex code blocks after removal
function reindexCodeBlocks() {
    const container = document.getElementById('codeBlocksModal');
    if (!container) return;
    
    const blocks = container.querySelectorAll('.code-file-block');
    blocks.forEach((block, newIndex) => {
        block.setAttribute('data-index', newIndex);
        
        // Update textarea ID
        const textarea = block.querySelector('.code-file-content');
        const oldId = textarea.id;
        const newId = `codeContentModal${newIndex}`;
        textarea.id = newId;
        
        // Update copy button onclick
        const copyBtn = block.querySelector('.btn-copy-code');
        if (copyBtn) {
            copyBtn.setAttribute('onclick', `copyCodeModal('${newId}')`);
        }
        
        // Update remove button onclick
        const removeBtn = block.querySelector('.btn-remove-block');
        if (removeBtn) {
            removeBtn.setAttribute('onclick', `removeCodeBlockModal(${newIndex})`);
        }
    });
}

// Copy code (edit mode)
function copyCodeModal(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (textarea) {
        textarea.select();
        navigator.clipboard.writeText(textarea.value);
        
        const block = textarea.closest('.code-file-block');
        const btn = block.querySelector('.btn-copy-code');
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = originalText; }, 1500);
        }
    }
}

// Copy code (view mode)
function copyCodeViewModal(preId) {
    const pre = document.getElementById(preId);
    if (pre) {
        navigator.clipboard.writeText(pre.textContent);
        
        const view = pre.closest('.code-file-view');
        const btn = view.querySelector('.btn-copy-code');
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = originalText; }, 1500);
        }
    }
}

// Clear search
function clearSourcesSearch() {
    const searchInput = document.getElementById('sourcesSearchInput');
    if (searchInput) {
        searchInput.value = '';
        modalSearchQuery = '';
    }
    const clearBtn = document.getElementById('sourcesClearSearch');
    if (clearBtn) clearBtn.style.display = 'none';
    renderSourcesListModal();
}

// Helper functions
function escapeHtmlModal(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDateModal(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('sourcesModal');
    if (modal && e.target === modal) {
        closeSourcesModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('sourcesModal');
        if (modal && modal.classList.contains('show')) {
            closeSourcesModal();
        }
    }
});


// Mobile Interface for Sources Modal
function initSourcesMobileInterface() {
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;

    const sidebar = document.querySelector('.sources-modal-body .sidebar');
    const header = document.querySelector('.sources-modal-header');
    
    if (!sidebar || !header) return;

    // Add hamburger button
    const hamburger = document.createElement('button');
    hamburger.className = 'mobile-hamburger';
    hamburger.innerHTML = '☰';
    hamburger.style.cssText = `
        background: transparent;
        border: none;
        color: var(--color-text-primary);
        font-size: 24px;
        cursor: pointer;
        padding: 5px 10px;
        margin-right: 10px;
    `;
    
    header.insertBefore(hamburger, header.firstChild);

    // Toggle sidebar
    hamburger.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-visible');
        hamburger.innerHTML = sidebar.classList.contains('mobile-visible') ? '✕' : '☰';
    });

    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('mobile-visible') && 
            !sidebar.contains(e.target) && 
            !hamburger.contains(e.target)) {
            sidebar.classList.remove('mobile-visible');
            hamburger.innerHTML = '☰';
        }
    });
}
