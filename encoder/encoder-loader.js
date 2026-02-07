// Encoder Modal Loader
let encoderModalLoaded = false;

async function loadEncoderModal() {
    if (encoderModalLoaded) return;
    
    try {
        // Detect current path (notes/, tasks/, or root)
        const basePath = window.location.pathname.includes('/notes/') || 
                         window.location.pathname.includes('/tasks/') ? '../' : './';
        
        // Load CSS first and wait for it
        if (!document.querySelector('link[href*="encoder-modal.css"]')) {
            await new Promise((resolve) => {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = basePath + 'encoder/encoder-modal.css';
                link.onload = resolve;
                document.head.appendChild(link);
            });
        }
        
        // Then inject HTML directly
        const html = `
            <div id="encoderModal" class="modal">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <span class="modal-title">🔐 API Encoder</span>
                        <button onclick="closeEncoderModal()" class="modal-close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; margin-bottom: 8px; font-size: 12px; color: var(--color-text-muted);">API Base URL</label>
                            <input type="text" id="apiInput" placeholder="https://example.mockapi.io" 
                                   style="width: 100%; padding: 10px; background: var(--color-bg-input); border: 1px solid var(--color-border); color: var(--color-text-primary); font-size: 13px; font-family: 'Consolas', monospace;">
                        </div>
                        
                        <button class="encoder-btn encoder-btn-primary" onclick="encodeAPI()" style="width: 100%; margin-bottom: 20px;">
                            🔐 Encode
                        </button>
                        
                        <div>
                            <label style="display: block; margin-bottom: 8px; font-size: 12px; color: var(--color-text-muted);">Encoded String (Click to copy)</label>
                            <div id="encoderOutput" onclick="copyEncoderOutput()" 
                                 style="background: var(--color-bg-primary); padding: 15px; border: 1px solid var(--color-border); word-break: break-all; font-size: 12px; color: var(--color-accent-secondary); min-height: 80px; cursor: pointer; user-select: all; transition: all 0.2s;">
                                b2suaXBhY29tLmVscG1heGUvL3NwdHRo
                            </div>
                        </div>
                        
                        <div style="margin-top: 20px; padding: 15px; background: var(--color-bg-elevated); border-left: 3px solid var(--color-accent-primary); font-size: 12px; line-height: 1.6;">
                            <strong style="color: var(--color-accent-primary);">Hướng dẫn:</strong><br>
                            1. Nhập API URL vào ô trên<br>
                            2. Click "Encode"<br>
                            3. Click vào output để copy<br>
                            4. Paste vào config.js thay thế giá trị API<br>
                            5. App sẽ tự động decode khi chạy
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container.firstElementChild);
        
        // Load JS - wait for it to load
        if (typeof openEncoderModal === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = basePath + 'encoder/encoder-modal.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        encoderModalLoaded = true;
    } catch (error) {
        console.error('Error loading encoder modal:', error);
    }
}

// Lazy open function with toggle
async function openEncoderModalLazy() {
    // Load modal first if not loaded
    await loadEncoderModal();
    
    const modal = document.getElementById('encoderModal');
    
    // Toggle: if open, close it
    if (modal && modal.classList.contains('show')) {
        if (typeof closeEncoderModal === 'function') {
            closeEncoderModal();
        } else {
            modal.classList.remove('show');
        }
    } else if (modal) {
        // Otherwise open it
        if (typeof openEncoderModal === 'function') {
            openEncoderModal();
        } else {
            modal.classList.add('show');
        }
    }
}
