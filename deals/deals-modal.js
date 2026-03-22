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
            this.deals = await loadDealsFromFile();
        } catch (error) {
            console.error('Error loading deals:', error);
            this.deals = this.parseDemoDeals();
        }

        const searchValue = document.getElementById('dealsSearchInput')?.value || '';
        this.filterDeals(searchValue);
        this.updateStats();
        this.isLoading = false;
    }

    forceLoadDeals() {
        this.isLoading = false;
        this.loadDeals();
    }

    parseDemoDeals() {
        return [];
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
