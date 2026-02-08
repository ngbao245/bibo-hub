// Simple Mobile Interface for Hub Page
class HubMobileInterface {
    constructor() {
        this.isMobile = window.innerWidth <= 768;
        this.sidebarVisible = false;
        this.init();
    }

    init() {
        if (!this.isMobile) return;
        
        this.createMobileHeader();
        this.setupSidebarToggle();
        this.setupResponsive();
    }

    createMobileHeader() {
        const container = document.querySelector('.container');
        if (!container) return;

        const header = document.createElement('div');
        header.className = 'mobile-header';
        header.innerHTML = `
            <button class="mobile-hamburger" id="mobileHamburger">☰</button>
            <h2>Hub</h2>
        `;

        container.insertBefore(header, container.firstChild);
    }

    setupSidebarToggle() {
        const hamburger = document.getElementById('mobileHamburger');
        const sidebar = document.querySelector('.sidebar');
        
        if (!hamburger || !sidebar) return;

        hamburger.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-visible');
            hamburger.textContent = sidebar.classList.contains('mobile-visible') ? '✕' : '☰';
        });

        // Close sidebar when clicking outside
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('mobile-visible') && 
                !sidebar.contains(e.target) && 
                !hamburger.contains(e.target)) {
                sidebar.classList.remove('mobile-visible');
                hamburger.textContent = '☰';
            }
        });
    }

    setupResponsive() {
        window.addEventListener('resize', () => {
            this.isMobile = window.innerWidth <= 768;
            if (!this.isMobile) {
                const sidebar = document.querySelector('.sidebar');
                if (sidebar) sidebar.classList.remove('mobile-visible');
            }
        });
    }
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new HubMobileInterface();
    });
} else {
    new HubMobileInterface();
}
