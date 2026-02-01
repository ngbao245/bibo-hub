// Mobile Interface Enhancement
// Smart header with navigation, list selection, and sidebar toggle

class MobileInterface {
    constructor() {
        this.isMobile = window.innerWidth <= 768;
        this.sidebarVisible = false;
        this.currentPage = this.getCurrentPage();
        this.init();
    }

    getCurrentPage() {
        // First check localStorage for saved tab state
        const savedTab = StorageManager.loadCurrentTab();
        
        // Then check URL path
        const path = window.location.pathname;
        let currentTab;
        if (path.includes('tasks.html')) {
            currentTab = 'tasks';
        } else {
            currentTab = 'notes';
        }
        
        // If URL doesn't match saved tab, redirect to correct page
        if (savedTab !== currentTab) {
            const targetPage = savedTab === 'tasks' ? 'tasks.html' : 'index.html';
            if (window.location.pathname !== `/${targetPage}` && 
                !window.location.pathname.endsWith(targetPage)) {
                // Only redirect if we're not already on the correct page
                setTimeout(() => {
                    window.location.href = targetPage;
                }, 100);
            }
        }
        
        return currentTab;
    }

    init() {
        if (!this.isMobile) return;
        
        console.log('Initializing mobile interface for:', this.currentPage);
        this.createMobileHeader();
        this.setupEventListeners();
        this.hideSidebar();
        
        // Handle window resize
        window.addEventListener('resize', () => {
            const wasMobile = this.isMobile;
            this.isMobile = window.innerWidth <= 768;
            
            if (wasMobile !== this.isMobile) {
                if (this.isMobile) {
                    this.createMobileHeader();
                    this.hideSidebar();
                } else {
                    this.removeMobileHeader();
                    this.showSidebar();
                }
            }
        });
    }

    createMobileHeader() {
        // Remove existing mobile header if any
        const existingHeader = document.querySelector('.mobile-header');
        if (existingHeader) {
            existingHeader.remove();
        }

        const header = document.createElement('div');
        header.className = 'mobile-header';
        
        console.log('Creating mobile header for page:', this.currentPage);
        
        header.innerHTML = `
            <div class="mobile-header-content">
                <div class="mobile-nav-section">
                    <button class="mobile-toggle-btn" id="mobileToggle">
                        <span class="hamburger-icon">☰</span>
                    </button>
                    <div class="mobile-nav-tabs">
                        <a href="index.html" class="mobile-nav-tab ${this.currentPage === 'notes' ? 'active' : ''}">Notes</a>
                        <a href="tasks.html" class="mobile-nav-tab ${this.currentPage === 'tasks' ? 'active' : ''}">Tasks</a>
                    </div>
                </div>
                ${this.currentPage === 'tasks' ? this.createTasksHeaderContent() : this.createNotesHeaderContent()}
            </div>
        `;

        // Insert at the beginning of container
        const container = document.querySelector('.container');
        if (container) {
            container.insertBefore(header, container.firstChild);
            console.log('Mobile header inserted successfully');
            
            // Debug: Check if dropdown elements exist
            if (this.currentPage === 'tasks') {
                setTimeout(() => {
                    const selector = document.querySelector('#mobileListSelector');
                    const dropdown = document.querySelector('#mobileListDropdown');
                    console.log('Mobile list selector found:', !!selector);
                    console.log('Mobile list dropdown found:', !!dropdown);
                }, 100);
            }
        } else {
            console.error('Container not found for mobile header');
        }
    }

    createTasksHeaderContent() {
        return `
            <div class="mobile-list-section">
                <div class="mobile-list-selector" id="mobileListSelector">
                    <span class="mobile-list-name" id="mobileListName">My Day</span>
                    <span class="mobile-list-arrow">▼</span>
                </div>
                <div class="mobile-list-dropdown" id="mobileListDropdown">
                    <div class="mobile-list-option" data-list="today">My Day</div>
                    <div class="mobile-list-option" data-list="all">All Tasks</div>
                    <div class="mobile-list-option" data-list="important">Important</div>
                    <div class="mobile-list-option" data-list="completed">Completed</div>
                    <div class="mobile-list-divider"></div>
                    <div id="mobileCustomLists"></div>
                </div>
            </div>
        `;
    }

    createNotesHeaderContent() {
        return `
            <div class="mobile-search-section">
                <div class="mobile-search-wrapper">
                    <input type="text" id="mobileNoteSearch" placeholder="Find in note" class="mobile-search-input">
                    <button class="mobile-search-clear" id="mobileNoteSearchClear" style="display: none;">×</button>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        if (!this.isMobile) return;

        // Remove existing listeners to prevent duplicates
        document.removeEventListener('click', this.handleClick);
        
        // Bind the handler to this instance
        this.handleClick = this.handleClick.bind(this);
        
        // Add single click listener for all mobile interactions
        document.addEventListener('click', this.handleClick);
        
        // Tasks page specific setup
        if (this.currentPage === 'tasks') {
            this.syncWithDesktopTasks();
        }

        // Notes page specific setup
        if (this.currentPage === 'notes') {
            this.setupMobileSearch();
            
            // Clear search when switching notes
            document.addEventListener('click', (e) => {
                if (e.target.closest('.note-item')) {
                    // Clear mobile search when selecting different note
                    setTimeout(() => {
                        this.clearMobileNoteSearch();
                        const mobileSearchInput = document.querySelector('#mobileNoteSearch');
                        const mobileSearchClear = document.querySelector('#mobileNoteSearchClear');
                        if (mobileSearchInput) mobileSearchInput.value = '';
                        if (mobileSearchClear) mobileSearchClear.style.display = 'none';
                    }, 100);
                }
            });
        }
    }

    handleClick(e) {
        // Navigation tab clicks - save tab state
        if (e.target.closest('.mobile-nav-tab') || e.target.closest('.nav-link')) {
            const link = e.target.closest('.mobile-nav-tab') || e.target.closest('.nav-link');
            const href = link.getAttribute('href');
            
            if (href) {
                if (href.includes('tasks.html')) {
                    StorageManager.saveCurrentTab('tasks');
                } else if (href.includes('index.html')) {
                    StorageManager.saveCurrentTab('notes');
                }
            }
            return; // Let the link navigate normally
        }

        // Toggle sidebar
        if (e.target.closest('#mobileToggle')) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Mobile toggle clicked');
            this.toggleSidebar();
            return;
        }

        // Tasks page - list selector
        if (this.currentPage === 'tasks') {
            if (e.target.closest('#mobileListSelector')) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Mobile list selector clicked');
                this.toggleListDropdown();
                return;
            }

            if (e.target.closest('.mobile-list-option')) {
                e.preventDefault();
                e.stopPropagation();
                const listType = e.target.dataset.list;
                console.log('Mobile list option clicked:', listType);
                if (listType) {
                    this.selectList(listType);
                }
                return;
            }
        }

        // Close dropdowns when clicking outside
        if (!e.target.closest('.mobile-list-selector') && !e.target.closest('.mobile-list-dropdown')) {
            this.closeListDropdown();
        }

        // Close sidebar when clicking outside
        if (this.sidebarVisible && !e.target.closest('.sidebar') && !e.target.closest('#mobileToggle')) {
            this.hideSidebar();
        }
    }

    toggleSidebar() {
        if (this.sidebarVisible) {
            this.hideSidebar();
        } else {
            this.showSidebar();
        }
    }

    showSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const container = document.querySelector('.container');
        
        if (sidebar && container) {
            sidebar.classList.add('mobile-sidebar-visible');
            container.classList.add('mobile-sidebar-open');
            this.sidebarVisible = true;
            
            // Update toggle button
            const toggleBtn = document.querySelector('#mobileToggle .hamburger-icon');
            if (toggleBtn) {
                toggleBtn.textContent = '✕';
            }
        }
    }

    hideSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const container = document.querySelector('.container');
        
        if (sidebar && container) {
            sidebar.classList.remove('mobile-sidebar-visible');
            container.classList.remove('mobile-sidebar-open');
            this.sidebarVisible = false;
            
            // Update toggle button
            const toggleBtn = document.querySelector('#mobileToggle .hamburger-icon');
            if (toggleBtn) {
                toggleBtn.textContent = '☰';
            }
        }
    }

    toggleListDropdown() {
        const dropdown = document.querySelector('#mobileListDropdown');
        const arrow = document.querySelector('.mobile-list-arrow');
        
        console.log('Toggle dropdown - dropdown element:', dropdown);
        console.log('Toggle dropdown - arrow element:', arrow);
        
        if (dropdown) {
            const isShowing = dropdown.classList.contains('show');
            console.log('Dropdown currently showing:', isShowing);
            
            dropdown.classList.toggle('show');
            
            // Rotate arrow
            if (arrow) {
                arrow.style.transform = isShowing ? 'rotate(0deg)' : 'rotate(180deg)';
            }
            
            console.log('Dropdown after toggle:', dropdown.classList.contains('show'));
        } else {
            console.error('Mobile dropdown not found!');
        }
    }

    closeListDropdown() {
        const dropdown = document.querySelector('#mobileListDropdown');
        const arrow = document.querySelector('.mobile-list-arrow');
        
        if (dropdown) {
            dropdown.classList.remove('show');
            
            // Reset arrow
            if (arrow) {
                arrow.style.transform = 'rotate(0deg)';
            }
        }
    }

    selectList(listType) {
        // Update mobile header display
        const listNames = {
            'today': 'My Day',
            'all': 'All Tasks',
            'important': 'Important',
            'completed': 'Completed'
        };

        const mobileListName = document.querySelector('#mobileListName');
        if (mobileListName) {
            mobileListName.textContent = listNames[listType] || listType;
        }

        // Trigger desktop list switch
        if (window.switchTaskList) {
            window.switchTaskList(listType);
        }

        this.closeListDropdown();
    }

    syncWithDesktopTasks() {
        // Update mobile list selector when desktop changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if (target.classList.contains('task-list-item') && target.classList.contains('active')) {
                        const listType = target.dataset.list;
                        const listName = target.querySelector('.list-name')?.textContent;
                        
                        const mobileListName = document.querySelector('#mobileListName');
                        if (mobileListName && listName) {
                            mobileListName.textContent = listName;
                        }
                    }
                }
            });
        });

        // Observe task list items for active state changes
        const taskListItems = document.querySelectorAll('.task-list-item');
        taskListItems.forEach(item => {
            observer.observe(item, { attributes: true });
        });

        // Update custom lists in mobile dropdown
        this.updateMobileCustomLists();
    }

    updateMobileCustomLists() {
        const mobileCustomLists = document.querySelector('#mobileCustomLists');
        const desktopCustomLists = document.querySelector('#customLists');
        
        if (mobileCustomLists && desktopCustomLists) {
            // Clear existing
            mobileCustomLists.innerHTML = '';
            
            // Copy custom lists
            const customListItems = desktopCustomLists.querySelectorAll('.task-list-item');
            customListItems.forEach(item => {
                const listName = item.querySelector('.list-name')?.textContent;
                const listId = item.dataset.list;
                
                if (listName && listId) {
                    const option = document.createElement('div');
                    option.className = 'mobile-list-option';
                    option.dataset.list = listId;
                    option.textContent = listName;
                    mobileCustomLists.appendChild(option);
                }
            });
        }
    }

    setupMobileSearch() {
        const mobileSearchInput = document.querySelector('#mobileNoteSearch');
        const mobileSearchClear = document.querySelector('#mobileNoteSearchClear');

        if (mobileSearchInput && mobileSearchClear) {
            // Mobile-only search functionality (different from desktop)
            mobileSearchInput.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                
                // Show/hide clear button
                mobileSearchClear.style.display = query ? 'block' : 'none';
                
                // Perform mobile search (search within note content)
                this.performMobileNoteSearch(query);
            });

            // Clear search
            mobileSearchClear.addEventListener('click', () => {
                mobileSearchInput.value = '';
                mobileSearchClear.style.display = 'none';
                this.clearMobileNoteSearch();
            });
        }
    }

    performMobileNoteSearch(query) {
        if (!query) {
            this.clearMobileNoteSearch();
            return;
        }

        // Get current note content
        const currentNoteContent = document.querySelector('.content-text');
        if (!currentNoteContent) return;

        // Remove existing highlights
        this.clearMobileNoteSearch();

        // Search and highlight in current note
        const content = currentNoteContent.innerHTML;
        const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
        
        if (regex.test(content)) {
            // Highlight matches
            const highlightedContent = content.replace(regex, '<mark class="mobile-search-highlight">$1</mark>');
            currentNoteContent.innerHTML = highlightedContent;
            
            // Scroll to first match
            const firstMatch = currentNoteContent.querySelector('.mobile-search-highlight');
            if (firstMatch) {
                firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    clearMobileNoteSearch() {
        // Remove all highlights
        const highlights = document.querySelectorAll('.mobile-search-highlight');
        highlights.forEach(highlight => {
            const parent = highlight.parentNode;
            parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
            parent.normalize();
        });
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    removeMobileHeader() {
        const header = document.querySelector('.mobile-header');
        if (header) {
            header.remove();
        }
    }
}

// Initialize mobile interface when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize once
    if (!window.mobileInterface) {
        window.mobileInterface = new MobileInterface();
    }
    
    // Add global navigation tab state saving
    setupNavigationStateTracking();
});

// Setup navigation state tracking for both desktop and mobile
function setupNavigationStateTracking() {
    document.addEventListener('click', (e) => {
        // Check if clicked element is a navigation link
        const navLink = e.target.closest('.nav-link, .mobile-nav-tab');
        if (navLink) {
            const href = navLink.getAttribute('href');
            if (href) {
                if (href.includes('tasks.html')) {
                    StorageManager.saveCurrentTab('tasks');
                } else if (href.includes('index.html')) {
                    StorageManager.saveCurrentTab('notes');
                }
            }
        }
    });
}

// Re-initialize on page navigation (for SPA-like behavior)
window.addEventListener('load', () => {
    // Only initialize if not already done
    if (!window.mobileInterface) {
        window.mobileInterface = new MobileInterface();
    }
});