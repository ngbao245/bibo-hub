// Movies Mobile Interface

class MoviesMobileInterface {
    constructor() {
        this.isMobile = window.innerWidth <= 768;
        this.sidebarVisible = false;
        this.init();
    }

    init() {
        if (!this.isMobile) return;
        
        this.createMobileHeader();
        this.setupSidebarToggle();
        this.setupResizeHandler();
    }

    createMobileHeader() {
        const mainContent = document.querySelector('.main-content');
        if (!mainContent) return;

        const header = document.createElement('div');
        header.className = 'mobile-header';
        header.innerHTML = `
            <button class="mobile-hamburger">☰</button>
            <h2>Movies</h2>
        `;

        mainContent.insertBefore(header, mainContent.firstChild);
    }

    setupSidebarToggle() {
        const hamburger = document.querySelector('.mobile-hamburger');
        if (!hamburger) return;

        hamburger.addEventListener('click', () => this.toggleSidebar());

        // Close sidebar when clicking outside
        document.addEventListener('click', (e) => {
            const sidebar = document.querySelector('.sidebar');
            if (this.sidebarVisible && 
                !sidebar.contains(e.target) && 
                !hamburger.contains(e.target)) {
                this.toggleSidebar();
            }
        });
    }

    toggleSidebar() {
        this.sidebarVisible = !this.sidebarVisible;
        const sidebar = document.querySelector('.sidebar');
        const hamburger = document.querySelector('.mobile-hamburger');

        if (this.sidebarVisible) {
            sidebar.classList.add('mobile-visible');
            hamburger.textContent = '✕';
        } else {
            sidebar.classList.remove('mobile-visible');
            hamburger.textContent = '☰';
        }
    }

    setupResizeHandler() {
        window.addEventListener('resize', () => {
            const wasMobile = this.isMobile;
            this.isMobile = window.innerWidth <= 768;

            if (wasMobile !== this.isMobile) {
                location.reload();
            }
        });
    }
}

// Initialize mobile interface
document.addEventListener('DOMContentLoaded', () => {
    new MoviesMobileInterface();
});
