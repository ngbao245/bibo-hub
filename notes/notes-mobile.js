// Mobile Interface Enhancement
// Smart header with navigation, list selection, and sidebar toggle

class MobileInterface {
    constructor() {
        this.isMobile = window.innerWidth <= 768;
        this.sidebarVisible = false;
        this.currentPage = this.getCurrentPage();
        this.init();
        this.setupSafeAreaSupport();
    }

    setupSafeAreaSupport() {
        // Enhanced safe area support for mobile browsers
        if (this.isMobile) {
            // Add viewport height adjustment for mobile browsers
            const setViewportHeight = () => {
                const vh = window.innerHeight * 0.01;
                document.documentElement.style.setProperty('--vh', `${vh}px`);
                
                // Detect if browser supports safe-area-inset
                const testEl = document.createElement('div');
                testEl.style.paddingBottom = 'env(safe-area-inset-bottom)';
                document.body.appendChild(testEl);
                const computedPadding = window.getComputedStyle(testEl).paddingBottom;
                document.body.removeChild(testEl);
                
                // If env() is not supported, add fallback padding
                if (computedPadding === '0px') {
                    // Add fallback safe area for older browsers
                    document.documentElement.style.setProperty('--fallback-safe-bottom', '20px');
                    document.body.classList.add('no-safe-area-support');
                } else {
                    document.documentElement.style.setProperty('--fallback-safe-bottom', '0px');
                    document.body.classList.remove('no-safe-area-support');
                }
            };

            // Set initial viewport height
            setViewportHeight();

            // Update on resize and orientation change
            window.addEventListener('resize', setViewportHeight);
            window.addEventListener('orientationchange', () => {
                setTimeout(setViewportHeight, 100);
            });

            // Handle iOS Safari address bar hide/show
            let ticking = false;
            const updateViewportHeight = () => {
                if (!ticking) {
                    requestAnimationFrame(() => {
                        setViewportHeight();
                        ticking = false;
                    });
                    ticking = true;
                }
            };

            window.addEventListener('scroll', updateViewportHeight);
            window.addEventListener('touchmove', updateViewportHeight);
        }
    }

    getCurrentPage() {
        // Check URL path
        const path = window.location.pathname;
        
        if (path.includes('tasks.html') || path.includes('tasks/')) {
            return 'tasks';
        } else if (path.includes('notes.html') || path.includes('notes/')) {
            return 'notes';
        }
        
        return 'notes'; // default
    }
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
        // Get current active list to show correct name and highlighting
        const currentList = window.currentTaskList || 'today';
        const listNames = {
            'today': 'My Day',
            'all': 'All Tasks',
            'important': 'Important',
            'completed': 'Completed'
        };
        
        // Get display name for current list
        let currentListName = listNames[currentList] || 'My Day';
        if (!listNames[currentList]) {
            // If it's a custom list, still show the custom list name in header
            const customList = window.customLists?.find(l => l.id === currentList);
            currentListName = customList ? (customList.title || customList.name) : 'My Day';
        }
        
        return `
            <div class="mobile-list-section">
                <div class="mobile-list-selector" id="mobileListSelector">
                    <span class="mobile-list-name" id="mobileListName">${currentListName}</span>
                    <span class="mobile-list-arrow">▼</span>
                </div>
                <div class="mobile-list-dropdown" id="mobileListDropdown">
                    <div class="mobile-list-option ${currentList === 'today' ? 'active' : ''}" data-list="today">My Day</div>
                    <div class="mobile-list-option ${currentList === 'all' ? 'active' : ''}" data-list="all">All Tasks</div>
                    <div class="mobile-list-option ${currentList === 'important' ? 'active' : ''}" data-list="important">Important</div>
                    <div class="mobile-list-option ${currentList === 'completed' ? 'active' : ''}" data-list="completed">Completed</div>
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
        // Navigation tab clicks
        if (e.target.closest('.mobile-nav-tab') || e.target.closest('.nav-link')) {
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
                const optionElement = e.target.closest('.mobile-list-option');
                const listType = optionElement.dataset.list;
                console.log('Mobile list option clicked:', listType, optionElement);
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
        
        // Close sidebar when clicking on task list items (mobile)
        if (this.isMobile && this.sidebarVisible && e.target.closest('.task-list-item')) {
            console.log('Task list item clicked on mobile, closing sidebar...');
            
            // Get the list type that was clicked
            const clickedItem = e.target.closest('.task-list-item');
            const listType = clickedItem.dataset.list;
            const listName = clickedItem.querySelector('.list-name')?.textContent;
            
            console.log('Clicked list:', listType, listName);
            
            // Clear all active states first
            document.querySelectorAll('.task-list-item.active').forEach(item => {
                item.classList.remove('active');
                // Clear any inline styles
                item.style.background = '';
                item.style.color = '';
                const count = item.querySelector('.list-count');
                if (count) {
                    count.style.background = '';
                    count.style.color = '';
                }
            });
            document.querySelectorAll('.mobile-list-option.active').forEach(option => {
                option.classList.remove('active');
            });
            
            // Set active state on clicked item with immediate visual feedback
            clickedItem.classList.add('active');
            clickedItem.style.background = 'var(--color-accent-primary)';
            clickedItem.style.color = 'white';
            
            const clickedListCount = clickedItem.querySelector('.list-count');
            if (clickedListCount) {
                clickedListCount.style.background = 'rgba(255, 255, 255, 0.2)';
                clickedListCount.style.color = 'white';
            }
            
            // Update mobile dropdown header immediately
            const mobileListName = document.querySelector('#mobileListName');
            if (mobileListName && listName) {
                mobileListName.textContent = listName;
                console.log('Updated mobile dropdown header to:', listName);
            }
            
            // Update dropdown highlighting
            this.updateMobileDropdownHighlighting(listType);
            
            // Remove inline styles after CSS takes over
            setTimeout(() => {
                clickedItem.style.background = '';
                clickedItem.style.color = '';
                if (clickedListCount) {
                    clickedListCount.style.background = '';
                    clickedListCount.style.color = '';
                }
            }, 300);
            
            // Add a small delay to let the click action complete first
            setTimeout(() => {
                this.hideSidebar();
            }, 100);
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
            
            // Force refresh active state when sidebar opens on mobile
            if (this.isMobile) {
                setTimeout(() => {
                    this.refreshSidebarHighlighting();
                    
                    // Additional force refresh - find and highlight current active item
                    const currentActiveItem = document.querySelector('.task-list-item.active');
                    if (currentActiveItem) {
                        // Force style application
                        currentActiveItem.style.background = 'var(--color-accent-primary)';
                        currentActiveItem.style.color = 'white';
                        
                        const listCount = currentActiveItem.querySelector('.list-count');
                        if (listCount) {
                            listCount.style.background = 'rgba(255, 255, 255, 0.2)';
                            listCount.style.color = 'white';
                        }
                        
                        // Remove inline styles after a moment to let CSS take over
                        setTimeout(() => {
                            currentActiveItem.style.background = '';
                            currentActiveItem.style.color = '';
                            if (listCount) {
                                listCount.style.background = '';
                                listCount.style.color = '';
                            }
                        }, 200);
                    }
                }, 100);
            }
        }
    }

    refreshSidebarHighlighting() {
        // Find currently active list and force refresh its highlighting
        const activeListItem = document.querySelector('.task-list-item.active');
        if (activeListItem) {
            const listType = activeListItem.dataset.list;
            console.log('Refreshing sidebar highlighting for:', listType);
            
            // Force CSS refresh by temporarily removing and re-adding classes
            activeListItem.classList.remove('active');
            
            // Force a reflow to ensure the class removal takes effect
            activeListItem.offsetHeight;
            
            setTimeout(() => {
                activeListItem.classList.add('active');
                console.log('Refreshed active class for:', listType);
                
                // Additional force refresh by adding a temporary class
                activeListItem.classList.add('force-active');
                setTimeout(() => {
                    activeListItem.classList.remove('force-active');
                }, 100);
            }, 10);
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
            // Check if it's a custom list
            if (!listNames[listType]) {
                // Find custom list name
                const customList = window.customLists?.find(l => l.id === listType);
                mobileListName.textContent = customList ? (customList.title || customList.name) : listType;
            } else {
                mobileListName.textContent = listNames[listType];
            }
        }

        // Clear all active states first to prevent conflicts
        document.querySelectorAll('.task-list-item.active').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelectorAll('.mobile-list-option.active').forEach(option => {
            option.classList.remove('active');
        });

        // Update highlighting in dropdown
        this.updateMobileDropdownHighlighting(listType);

        // Update sidebar highlighting
        const sidebarItem = document.querySelector(`.task-list-item[data-list="${listType}"]`);
        if (sidebarItem) {
            sidebarItem.classList.add('active');
            console.log('Added active to sidebar item:', listType);
        }

        // Trigger desktop list switch (this will also update task list)
        if (window.switchTaskList) {
            window.switchTaskList(listType);
        }

        // Close dropdown after selection
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
                        
                        console.log('Desktop list changed to:', listType, listName);
                        
                        // Clear all other active states first
                        document.querySelectorAll('.task-list-item.active').forEach(item => {
                            if (item !== target) {
                                item.classList.remove('active');
                            }
                        });
                        document.querySelectorAll('.mobile-list-option.active').forEach(option => {
                            option.classList.remove('active');
                        });
                        
                        // Update mobile dropdown header name
                        const mobileListName = document.querySelector('#mobileListName');
                        if (mobileListName && listName) {
                            mobileListName.textContent = listName;
                            console.log('Updated mobile header to:', listName);
                        }
                        
                        // Update mobile dropdown highlighting (only for built-in lists)
                        this.updateMobileDropdownHighlighting(listType);
                    }
                }
            });
        });

        // Observe task list items for active state changes
        const taskListItems = document.querySelectorAll('.task-list-item');
        console.log('Setting up observers for', taskListItems.length, 'task list items');
        taskListItems.forEach(item => {
            observer.observe(item, { 
                attributes: true, 
                attributeFilter: ['class'],
                subtree: false 
            });
        });

        // Also observe custom lists container for dynamic lists (for sidebar only)
        const customListsContainer = document.querySelector('#customLists');
        if (customListsContainer) {
            const customObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        // Re-setup observers when custom lists change
                        setTimeout(() => {
                            this.syncWithDesktopTasks();
                        }, 100);
                    }
                });
            });
            customObserver.observe(customListsContainer, { childList: true });
        }
        
        // Initial sync - set correct name based on current active list
        this.syncMobileHeaderWithDesktop();
    }

    updateMobileDropdownHighlighting(activeListType) {
        // Wait a bit to ensure DOM is ready
        setTimeout(() => {
            // Clear ALL mobile-list-option active states first
            document.querySelectorAll('.mobile-list-option.active').forEach(option => {
                option.classList.remove('active');
            });
            
            // Update highlighting in mobile dropdown - only for built-in lists
            const dropdown = document.querySelector('#mobileListDropdown');
            if (!dropdown) {
                console.log('Mobile dropdown not found');
                return;
            }
            
            // Only highlight if it's a built-in list (not custom lists)
            const builtInLists = ['today', 'all', 'important', 'completed'];
            if (!builtInLists.includes(activeListType)) {
                console.log('Not highlighting custom list in dropdown:', activeListType);
                return;
            }
            
            const allOptions = dropdown.querySelectorAll('.mobile-list-option');
            console.log('Updating mobile dropdown highlighting for:', activeListType);
            console.log('Found options in dropdown:', allOptions.length);
            
            // Add active to the correct one
            allOptions.forEach(option => {
                const optionListType = option.dataset.list;
                if (optionListType === activeListType) {
                    option.classList.add('active');
                    console.log('Added active to option:', option.textContent, 'with list type:', optionListType);
                }
            });
        }, 50);
    }

    syncMobileHeaderWithDesktop() {
        // Find currently active list in desktop
        const activeListItem = document.querySelector('.task-list-item.active');
        if (activeListItem) {
            const listName = activeListItem.querySelector('.list-name')?.textContent;
            const listType = activeListItem.dataset.list;
            
            console.log('Syncing mobile header with desktop active list:', listType, listName);
            
            // Update dropdown header name
            const mobileListName = document.querySelector('#mobileListName');
            if (mobileListName && listName) {
                mobileListName.textContent = listName;
                console.log('Synced mobile header name to:', listName);
            }
            
            // Update dropdown highlighting
            if (listType) {
                this.updateMobileDropdownHighlighting(listType);
            }
        }
    }

    // Force sync mobile header - can be called manually
    forceSyncMobileHeader() {
        console.log('Force syncing mobile header...');
        this.syncMobileHeaderWithDesktop();
        
        // Also force refresh sidebar highlighting with enhanced method
        setTimeout(() => {
            this.refreshSidebarHighlighting();
            
            // Additional manual highlighting for mobile
            if (this.isMobile && this.sidebarVisible) {
                const activeItem = document.querySelector('.task-list-item.active');
                if (activeItem) {
                    console.log('Manually applying mobile highlighting to:', activeItem.dataset.list);
                    
                    // Clear all other active states first
                    document.querySelectorAll('.task-list-item').forEach(item => {
                        if (item !== activeItem) {
                            item.classList.remove('active');
                        }
                    });
                    
                    // Force the active class and styles
                    activeItem.classList.add('active');
                    activeItem.style.background = 'var(--color-accent-primary)';
                    activeItem.style.color = 'white';
                    
                    const listCount = activeItem.querySelector('.list-count');
                    if (listCount) {
                        listCount.style.background = 'rgba(255, 255, 255, 0.2)';
                        listCount.style.color = 'white';
                    }
                    
                    // Remove inline styles after CSS takes over
                    setTimeout(() => {
                        activeItem.style.background = '';
                        activeItem.style.color = '';
                        if (listCount) {
                            listCount.style.background = '';
                            listCount.style.color = '';
                        }
                    }, 300);
                }
            }
        }, 100);
    }

    updateMobileCustomLists() {
        const mobileCustomLists = document.querySelector('#mobileCustomLists');
        const desktopCustomLists = document.querySelector('#customLists');
        
        if (mobileCustomLists && desktopCustomLists) {
            // Clear existing
            mobileCustomLists.innerHTML = '';
            
            // Get current active list for highlighting
            const currentList = window.currentTaskList || 'today';
            
            // Copy custom lists
            const customListItems = desktopCustomLists.querySelectorAll('.task-list-item');
            customListItems.forEach(item => {
                const listName = item.querySelector('.list-name')?.textContent;
                const listId = item.dataset.list;
                
                if (listName && listId) {
                    const option = document.createElement('div');
                    option.className = `mobile-list-option ${currentList === listId ? 'active' : ''}`;
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
            // Let the link navigate normally
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