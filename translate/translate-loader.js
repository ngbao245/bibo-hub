// Translate Modal Loader
let translateModalLoaded = false;

async function loadTranslateModal() {
    if (translateModalLoaded) return;
    
    try {
        // Detect current path
        const basePath = window.location.pathname.includes('/notes/') || 
                         window.location.pathname.includes('/tasks/') ? '../' : './';
        
        // Load CSS first and wait for it
        if (!document.querySelector('link[href*="translate-modal.css"]')) {
            await new Promise((resolve) => {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = basePath + 'translate/translate-modal.css';
                link.onload = resolve;
                document.head.appendChild(link);
            });
        }
        
        // Then inject HTML
        const html = `
            <div id="translateModal" class="modal">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <span class="modal-title">Translate</span>
                        <button onclick="closeTranslateModal()" class="modal-close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <textarea id="translateSource" placeholder="Type text..."></textarea>
                        <div class="translate-divider">↓</div>
                        <textarea id="translateTarget" placeholder="Translation..." readonly></textarea>
                    </div>
                    <div class="modal-footer">
                        <button onclick="copyTranslation()">Copy</button>
                        <button onclick="clearTranslation()">Clear</button>
                    </div>
                </div>
            </div>
        `;
        
        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container.firstElementChild);
        
        // Load JS - wait for it
        if (typeof openTranslateModal === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = basePath + 'translate/translate-modal.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        translateModalLoaded = true;
    } catch (error) {
        console.error('Error loading translate modal:', error);
    }
}

// Lazy open function with toggle and auto-fill selected text
async function openTranslateModalLazy() {
    // Get selected text before loading modal
    const selectedText = window.getSelection().toString().trim();
    
    // Load modal first if not loaded
    await loadTranslateModal();
    
    const modal = document.getElementById('translateModal');
    
    // Toggle: if open, close it
    if (modal && modal.classList.contains('show')) {
        if (typeof closeTranslateModal === 'function') {
            closeTranslateModal();
        } else {
            modal.classList.remove('show');
        }
    } else if (modal) {
        // Otherwise open it
        if (typeof openTranslateModal === 'function') {
            openTranslateModal();
            
            // Auto-fill selected text if exists
            if (selectedText) {
                const sourceInput = document.getElementById('translateSource');
                if (sourceInput) {
                    sourceInput.value = selectedText;
                    // Trigger translation
                    sourceInput.dispatchEvent(new Event('input'));
                }
            }
        } else {
            modal.classList.add('show');
        }
    }
}
