// Deal Tracker Modal Loader - Lazy load modal khi cần
let dealsModalLoaded = false;

function openDealsModalLazy() {
    if (!dealsModalLoaded) {
        loadDealsModal();
        dealsModalLoaded = true;
    } else {
        openDealsModal();
    }
}

function loadDealsModal() {
    // Load CSS
    const cssLink = document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = 'deals/deals-modal.css';
    document.head.appendChild(cssLink);

    // Load file reader first
    const readerScript = document.createElement('script');
    readerScript.src = 'deals/deals-file-reader.js';
    readerScript.onload = () => {
        // Load modal JS after reader is ready
        loadModalScript();
    };
    document.head.appendChild(readerScript);
}

function loadModalScript() {
    // Load HTML structure
    const modalHTML = `
        <div id="dealsModal" class="deals-modal">
            <div class="deals-modal-content">
                <div class="deals-modal-header">
                    <div class="deals-modal-title">🎯 Deal Tracker</div>
                    <button class="deals-modal-close-btn" onclick="closeDealsModal()">×</button>
                </div>
                <div class="deals-modal-body">
                    <!-- Toolbar -->
                    <div class="deals-toolbar">
                        <div class="deals-search-row">
                            <div class="deals-search-box">
                                <input type="text" id="dealsSearchInput" placeholder="🔍 Tìm kiếm deal..." />
                            </div>
                            <div class="deals-toolbar-actions">
                                <button id="dealsRefreshBtn" class="deals-toolbar-btn primary">🔄 Làm mới</button>
                            </div>
                        </div>
                        <div class="deals-filter-row">
                            <button class="deals-filter-btn active" data-filter="all">Tất cả</button>
                            <button class="deals-filter-btn" data-filter="unread">Chưa xem</button>
                            <button class="deals-filter-btn" data-filter="read">Đã xem</button>
                        </div>
                    </div>

                    <!-- Stats Bar -->
                    <div class="deals-stats-bar">
                        <div class="deals-stat">
                            <span class="deals-stat-value" id="dealsTotalDeals">0</span>
                            <span class="deals-stat-label">Tổng deals</span>
                        </div>
                        <div class="deals-stat">
                            <span class="deals-stat-value" id="dealsUnreadDeals">0</span>
                            <span class="deals-stat-label">Chưa xem</span>
                        </div>
                    </div>

                    <!-- Deals List -->
                    <div class="deals-list">
                        <div id="dealsContainer" class="deals-container">
                            <!-- Deals sẽ được load ở đây -->
                        </div>

                        <div id="dealsEmptyState" class="deals-empty-state" style="display: none;">
                            <p>📭 Không tìm thấy deal nào</p>
                            <small>Thử tìm kiếm với từ khóa khác hoặc bỏ bộ lọc</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Load JS
    const script = document.createElement('script');
    script.src = 'deals/deals-modal.js';
    script.onload = () => {
        openDealsModal();
    };
    document.body.appendChild(script);
}

function openDealsModal() {
    const modal = document.getElementById('dealsModal');
    if (modal) {
        modal.classList.add('show');

        // Scroll to top khi mở modal
        const modalBody = modal.querySelector('.deals-modal-body');
        if (modalBody) {
            modalBody.scrollTop = 0;
        }

        // Trigger load deals
        if (window.dealsModalTracker) {
            window.dealsModalTracker.loadDeals();
        }
    }
}

function closeDealsModal() {
    const modal = document.getElementById('dealsModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// Close on Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeDealsModal();
    }
});
