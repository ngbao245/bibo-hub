// SPX Tracking Modal Logic
const SPX_STORAGE_KEY = 'spx_tracking_history';
const SPX_BASE_URL = 'https://spx.vn/track?';
let currentTrackingUrl = '';

function openSpxTrackingModal() {
    const modal = document.getElementById('spxTrackingModal');
    if (modal) {
        modal.classList.add('show');

        // Show input section, hide iframe
        showSpxInputSection();

        // Load recent history
        loadSpxHistory();

        // Focus input
        setTimeout(() => {
            const input = document.getElementById('spxTrackingInput');
            if (input) {
                input.focus();
            }
        }, 100);
    }
}

function closeSpxTrackingModal() {
    const modal = document.getElementById('spxTrackingModal');
    if (modal) {
        modal.classList.remove('show');

        // Clear input
        const input = document.getElementById('spxTrackingInput');
        if (input) {
            input.value = '';
        }

        // Reset to input section
        showSpxInputSection();
    }
}

function showSpxInputSection() {
    const inputSection = document.getElementById('spxInputSection');
    const iframeSection = document.getElementById('spxIframeSection');
    const modal = document.getElementById('spxTrackingModal');

    if (inputSection) inputSection.style.display = 'block';
    if (iframeSection) iframeSection.style.display = 'none';
    if (modal) modal.classList.remove('show-iframe');
}

function showSpxIframeSection() {
    const inputSection = document.getElementById('spxInputSection');
    const iframeSection = document.getElementById('spxIframeSection');
    const modal = document.getElementById('spxTrackingModal');

    if (inputSection) inputSection.style.display = 'none';
    if (iframeSection) iframeSection.style.display = 'block';
    if (modal) modal.classList.add('show-iframe');
}

function backToSpxInput() {
    showSpxInputSection();

    // Clear iframe
    const iframe = document.getElementById('spxTrackingIframe');
    if (iframe) {
        iframe.src = '';
    }
}

function openSpxInNewTab() {
    if (currentTrackingUrl) {
        window.open(currentTrackingUrl, '_blank');
    }
}

function trackSpxPackage() {
    const input = document.getElementById('spxTrackingInput');
    const trackingCode = input.value.trim();

    if (!trackingCode) {
        alert('Vui lòng nhập mã vận đơn');
        input.focus();
        return;
    }

    // Validate tracking code format (basic check)
    if (trackingCode.length < 10) {
        alert('Mã vận đơn không hợp lệ');
        input.focus();
        return;
    }

    // Save to history
    saveToSpxHistory(trackingCode);

    // Load in iframe
    loadSpxInIframe(trackingCode);

    // Clear input
    input.value = '';
}

function loadSpxInIframe(trackingCode) {
    const iframe = document.getElementById('spxTrackingIframe');
    const currentCodeSpan = document.getElementById('spxCurrentCode');

    if (!iframe) return;

    // Build tracking URL
    currentTrackingUrl = SPX_BASE_URL + trackingCode;

    // Set iframe src
    iframe.src = currentTrackingUrl;

    // Update current code display
    if (currentCodeSpan) {
        currentCodeSpan.textContent = trackingCode;
    }

    // Show iframe section
    showSpxIframeSection();
}

function saveToSpxHistory(trackingCode) {
    let history = getSpxHistory();

    // Remove if already exists
    history = history.filter(item => item.code !== trackingCode);

    // Add to beginning
    history.unshift({
        code: trackingCode,
        timestamp: new Date().toISOString()
    });

    // Keep only last 10
    history = history.slice(0, 10);

    localStorage.setItem(SPX_STORAGE_KEY, JSON.stringify(history));
}

function getSpxHistory() {
    try {
        const data = localStorage.getItem(SPX_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Error loading SPX history:', error);
        return [];
    }
}

function loadSpxHistory() {
    const history = getSpxHistory();
    const recentSection = document.getElementById('spxRecentSection');
    const recentList = document.getElementById('spxRecentList');

    if (!recentSection || !recentList) return;

    if (history.length === 0) {
        recentSection.style.display = 'none';
        return;
    }

    recentSection.style.display = 'block';

    recentList.innerHTML = history.map(item => {
        const date = new Date(item.timestamp);
        const timeAgo = getTimeAgo(date);

        return `
            <div class="spx-recent-item" onclick="trackSpxFromHistory('${item.code}')">
                <div class="spx-recent-code">${item.code}</div>
                <div class="spx-recent-time">${timeAgo}</div>
            </div>
        `;
    }).join('');
}

function trackSpxFromHistory(trackingCode) {
    // Update timestamp
    saveToSpxHistory(trackingCode);

    // Load in iframe
    loadSpxInIframe(trackingCode);
}

function clearSpxHistory() {
    if (confirm('Xóa tất cả lịch sử tra cứu?')) {
        localStorage.removeItem(SPX_STORAGE_KEY);
        loadSpxHistory();
    }
}

function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;

    return date.toLocaleDateString('vi-VN');
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('spxTrackingModal');
    if (!modal || !modal.classList.contains('show')) return;

    const inputSection = document.getElementById('spxInputSection');
    const isInputVisible = inputSection && inputSection.style.display !== 'none';

    // Enter to track (only when input section is visible)
    if (e.key === 'Enter' && isInputVisible) {
        const input = document.getElementById('spxTrackingInput');
        if (input && document.activeElement === input) {
            e.preventDefault();
            trackSpxPackage();
        }
    }

    // Escape to close or go back
    if (e.key === 'Escape') {
        if (isInputVisible) {
            closeSpxTrackingModal();
        } else {
            backToSpxInput();
        }
    }
});

// Click outside to close
document.addEventListener('click', (e) => {
    const modal = document.getElementById('spxTrackingModal');
    if (modal && e.target === modal) {
        closeSpxTrackingModal();
    }
});
