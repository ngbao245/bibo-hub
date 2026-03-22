// Deal Tracker Modal - Optimized Version
class DealsModalTracker {
    constructor() {
        this.deals = [];
        this.filteredDeals = [];
        this.currentFilter = 'all';
        this.readDeals = this.loadReadDeals();
        this.isLoading = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadDeals();
    }

    setupEventListeners() {
        const searchInput = document.getElementById('dealsSearchInput');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.filterDeals(e.target.value);
                }, 300);
            });
        }

        document.querySelectorAll('.deals-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.deals-filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                const searchValue = document.getElementById('dealsSearchInput')?.value || '';
                this.filterDeals(searchValue);
            });
        });

        const refreshBtn = document.getElementById('dealsRefreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.forceLoadDeals();
            });
        }
    }

    loadReadDeals() {
        const stored = localStorage.getItem('readDeals');
        return stored ? new Set(JSON.parse(stored)) : new Set();
    }

    saveReadDeals() {
        localStorage.setItem('readDeals', JSON.stringify([...this.readDeals]));
    }

    async loadDeals() {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            // Try Vercel API first, fallback to local, then file reader
            let response = await fetch('/api/deals');

            if (!response.ok) {
                response = await fetch('http://localhost:3000/api/deals');
            }

            if (response.ok) {
                this.deals = await response.json();
            } else {
                // Fallback: read file directly
                this.deals = await this.loadFromFile();
            }
        } catch (error) {
            // Fallback: read file directly
            try {
                this.deals = await this.loadFromFile();
            } catch (fileError) {
                this.deals = this.parseDemoDeals();
            }
        }

        const searchValue = document.getElementById('dealsSearchInput')?.value || '';
        this.filterDeals(searchValue);
        this.updateStats();
        this.isLoading = false;
    }

    async loadFromFile() {
        const response = await fetch('telegram/deals.txt');
        if (!response.ok) throw new Error('Cannot load deals.txt');

        const content = await response.text();
        return this.parseDealsFromFile(content);
    }

    parseDealsFromFile(content) {
        const deals = [];
        const sections = content.split('============================================================').filter(s => s.trim());

        sections.forEach((section, index) => {
            const lines = section.trim().split('\n').filter(line => line.trim());

            let date = '';
            let link = '';
            let contentText = '';
            let images = [];
            let rawDate = null;

            lines.forEach(line => {
                if (line.startsWith('📅 Ngày:')) {
                    date = line.replace('📅 Ngày:', '').trim();
                    rawDate = new Date(date);
                } else if (line.startsWith('🔗 Link:')) {
                    link = line.replace('🔗 Link:', '').trim();
                } else if (line.startsWith('🖼️ Hình ảnh:')) {
                    const imageUrls = line.replace('🖼️ Hình ảnh:', '').trim();
                    images = imageUrls.split(',').map(url => url.trim()).filter(url => url);
                } else if (line.startsWith('📝 Nội dung:')) {
                    contentText = line.replace('📝 Nội dung:', '').trim();
                } else if (contentText) {
                    contentText += '\n' + line;
                }
            });

            if (date && link && contentText) {
                const id = link.split('/').pop() || `deal_${index}`;
                deals.push({
                    id,
                    date: this.formatDate(rawDate),
                    rawDate: rawDate ? rawDate.getTime() : 0,
                    link,
                    content: contentText.trim(),
                    images
                });
            }
        });

        deals.sort((a, b) => b.rawDate - a.rawDate);
        return deals;
    }

    formatDate(date) {
        if (!date || isNaN(date.getTime())) return 'N/A';

        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${day}/${month}/${year} ${hours}:${minutes}`;
    }

    forceLoadDeals() {
        this.isLoading = false;
        this.loadDeals();
    }

    parseDemoDeals() {
        const now = new Date();
        return [
            { id: 'demo_1', date: new Date(now - 10 * 60000).toLocaleString('vi-VN'), link: 'https://t.me/cuongtruewireless/17268', content: 'TOANG RỒI\nQUAY XE GẤP các sếp ơi\nSunning global mà cũng có hàng phake luôn :(' },
            { id: 'demo_2', date: new Date(now - 30 * 60000).toLocaleString('vi-VN'), link: 'https://t.me/cuongtruewireless/17264', content: 'Xiaomi S101 về đáy, mời các sếp nhập môn mấy cạo râu ngon bổ rẻ, xịn mịn luôn\nhttps://s.lazada.vn/s.7Mfk8?cc&t=h5' },
            { id: 'demo_3', date: new Date(now - 45 * 60000).toLocaleString('vi-VN'), link: 'https://t.me/cuongtruewireless/17263', content: 'Đáy\nHúp thôi các sếp\nhttps://s.lazada.vn/s.7Gawy?cc&t=p-iEX7H6M-s22p3Jpo' },
            { id: 'demo_4', date: new Date(now - 60 * 60000).toLocaleString('vi-VN'), link: 'https://t.me/cuongtruewireless/17261', content: 'Húp các sếp ơi\nhttps://c.lazada.vn/t/c.1vd11Y' },
            { id: 'demo_5', date: new Date(now - 90 * 60000).toLocaleString('vi-VN'), link: 'https://t.me/cuongtruewireless/17260', content: 'KTC 260Hz mời cá game thụ\nhttps://s.lazada.vn/s.7GaXW?cc&t=p-i3WyOj3-sGzlgYZ' },
            { id: 'demo_6', date: new Date(now - 120 * 60000).toLocaleString('vi-VN'), link: 'https://t.me/cuongtruewireless/17259', content: 'SANG GROUP NÀY LỌ CHÉO XU LAZADA\nhttps://t.me/+4uBaXmtQwcc0MjNl' },
            { id: 'demo_7', date: new Date(now - 150 * 60000).toLocaleString('vi-VN'), link: 'https://t.me/cuongtruewireless/17258', content: 'Con lợn nhựa này du kích quá\nhttps://c.lazada.vn/t/c.1vd11Y' },
            { id: 'demo_8', date: new Date(now - 180 * 60000).toLocaleString('vi-VN'), link: 'https://t.me/cuongtruewireless/17257', content: '5 slot zero 68 các sếp ơi\nhttps://s.lazada.vn/s.7tD3U?cc&t=p-iEX2u9H-s22oGFJb' }
        ];
    }

    filterDeals(searchTerm = '') {
        let filtered = [...this.deals];

        if (this.currentFilter === 'read') {
            filtered = filtered.filter(deal => this.readDeals.has(deal.id));
        } else if (this.currentFilter === 'unread') {
            filtered = filtered.filter(deal => !this.readDeals.has(deal.id));
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(deal =>
                deal.content.toLowerCase().includes(term) ||
                deal.date.toLowerCase().includes(term)
            );
        }

        this.filteredDeals = filtered;
        this.renderDeals();
    }

    renderDeals() {
        const container = document.getElementById('dealsContainer');
        const emptyState = document.getElementById('dealsEmptyState');

        if (!container || !emptyState) return;

        if (this.filteredDeals.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        container.style.display = 'grid';
        emptyState.style.display = 'none';
        container.innerHTML = this.filteredDeals.map(deal => this.createDealCard(deal)).join('');

        container.onclick = (e) => {
            const markReadBtn = e.target.closest('.deals-mark-read-btn');
            if (markReadBtn) {
                this.toggleReadStatus(markReadBtn.dataset.dealId);
                return;
            }

            const openLinkBtn = e.target.closest('.deals-open-link-btn');
            if (openLinkBtn) {
                window.open(openLinkBtn.dataset.link, '_blank');
            }
        };
    }

    createDealCard(deal) {
        const isRead = this.readDeals.has(deal.id);
        const isNewest = this.filteredDeals.indexOf(deal) === 0;

        let imagesHTML = '';
        if (deal.images && deal.images.length > 0) {
            imagesHTML = `
                <div class="deals-card-images">
                    ${deal.images.map(img => `<img src="${img}" alt="Deal image" loading="lazy" />`).join('')}
                </div>
            `;
        }

        return `
            <div class="deals-card ${isRead ? 'read' : ''} ${isNewest ? 'newest' : ''}" data-deal-id="${deal.id}">
                <div class="deals-card-header">
                    <span class="deals-card-date">
                        ${isNewest ? '<span class="deals-newest-badge">📌 Mới nhất</span>' : ''}
                        📅 ${deal.date}
                        ${!isRead ? '<span class="deals-unread-badge">MỚI</span>' : ''}
                    </span>
                    <div class="deals-card-actions">
                        <button class="deals-card-btn deals-mark-read-btn ${isRead ? 'read' : ''}" data-deal-id="${deal.id}">
                            ${isRead ? '✓ Đã xem' : 'Đánh dấu'}
                        </button>
                        <button class="deals-card-btn deals-open-link-btn" data-link="${deal.link}">
                            🔗 Mở
                        </button>
                    </div>
                </div>
                ${imagesHTML}
                <div class="deals-card-content">${this.escapeHtml(deal.content)}</div>
            </div>
        `;
    }

    toggleReadStatus(dealId) {
        if (this.readDeals.has(dealId)) {
            this.readDeals.delete(dealId);
        } else {
            this.readDeals.add(dealId);
        }
        this.saveReadDeals();

        const card = document.querySelector(`[data-deal-id="${dealId}"]`);
        if (card) {
            const isRead = this.readDeals.has(dealId);
            card.classList.toggle('read', isRead);

            const dateSpan = card.querySelector('.deals-card-date');
            const badge = card.querySelector('.deals-unread-badge');

            if (badge) badge.remove();

            if (!isRead && dateSpan) {
                dateSpan.insertAdjacentHTML('beforeend', '<span class="deals-unread-badge">MỚI</span>');
            }

            const btn = card.querySelector('.deals-mark-read-btn');
            if (btn) {
                btn.textContent = isRead ? '✓ Đã xem' : 'Đánh dấu';
                btn.classList.toggle('read', isRead);
            }
        }

        this.updateStats();
    }

    updateStats() {
        const totalEl = document.getElementById('dealsTotalDeals');
        const unreadEl = document.getElementById('dealsUnreadDeals');

        if (totalEl) totalEl.textContent = this.deals.length;
        if (unreadEl) {
            unreadEl.textContent = this.deals.filter(deal => !this.readDeals.has(deal.id)).length;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

if (!window.dealsModalTracker) {
    window.dealsModalTracker = new DealsModalTracker();
}
