// SPX Tracking Modal Loader
let spxTrackingModalLoaded = false;

async function loadSpxTrackingModal() {
    if (spxTrackingModalLoaded) return;

    try {
        const basePath = window.location.pathname.includes('/notes/') ||
            window.location.pathname.includes('/tasks/') ? '../' : './';

        const html = `
            <div id="spxTrackingModal" class="modal">
                <div class="modal-content spx-modal-content">
                    <div class="modal-header">
                        <span class="modal-title">📦 Tra cứu đơn hàng SPX</span>
                        <button onclick="closeSpxTrackingModal()" class="modal-close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <!-- Input Section -->
                        <div id="spxInputSection">
                            <div class="spx-input-group">
                                <label>Mã vận đơn</label>
                                <input 
                                    type="text" 
                                    id="spxTrackingInput" 
                                    placeholder="VD: SPXVN062495885902"
                                    autocomplete="off"
                                >
                                <div class="spx-hint">Nhập mã vận đơn SPX để tra cứu</div>
                            </div>
                            
                            <div class="spx-recent-section" id="spxRecentSection" style="display: none;">
                                <div class="spx-recent-header">
                                    <span>Tra cứu gần đây</span>
                                    <button onclick="clearSpxHistory()" class="btn-clear-history">Xóa</button>
                                </div>
                                <div id="spxRecentList" class="spx-recent-list"></div>
                            </div>
                            
                            <div class="spx-actions">
                                <button onclick="trackSpxPackage()" class="btn btn-primary">
                                    🔍 Tra cứu
                                </button>
                            </div>
                        </div>
                        
                        <!-- Iframe Section -->
                        <div id="spxIframeSection" style="display: none;">
                            <div class="spx-iframe-header">
                                <button onclick="backToSpxInput()" class="btn">
                                    ← Quay lại
                                </button>
                                <span id="spxCurrentCode" class="spx-current-code"></span>
                                <button onclick="openSpxInNewTab()" class="btn" title="Mở trong tab mới">
                                    🔗
                                </button>
                            </div>
                            <div class="spx-iframe-container">
                                <iframe id="spxTrackingIframe" frameborder="0"></iframe>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        while (wrapper.firstElementChild) {
            document.body.appendChild(wrapper.firstElementChild);
        }

        if (!document.querySelector('link[href*="spx-tracking-modal.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = basePath + 'spx-tracking/spx-tracking-modal.css';
            document.head.appendChild(link);
        }

        if (typeof openSpxTrackingModal === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = basePath + 'spx-tracking/spx-tracking-modal.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }

        spxTrackingModalLoaded = true;
    } catch (error) {
        console.error('Error loading SPX tracking modal:', error);
    }
}

async function openSpxTrackingModalLazy() {
    await loadSpxTrackingModal();

    const modal = document.getElementById('spxTrackingModal');

    if (modal && modal.classList.contains('show')) {
        if (typeof closeSpxTrackingModal === 'function') {
            closeSpxTrackingModal();
        } else {
            modal.classList.remove('show');
        }
    } else if (modal) {
        if (typeof openSpxTrackingModal === 'function') {
            openSpxTrackingModal();
        } else {
            modal.classList.add('show');
        }
    }
}
