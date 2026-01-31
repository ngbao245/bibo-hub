document.addEventListener('DOMContentLoaded', () => {
    const bookmarksContainer = document.getElementById('bookmarksContainer');
    const categories = document.querySelectorAll('.category');
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const saveChangesBtn = document.getElementById('saveChangesBtn');
    let currentCategory = 'all';
    let sortable = null;
    let hasChanges = false;
    let originalBookmarks = '';

    // Create hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'fileInput';
    fileInput.accept = '.csv';
    document.body.appendChild(fileInput);

    // Load bookmarks from localStorage
    function loadBookmarks() {
        return JSON.parse(localStorage.getItem('bookmarks')) || [];
    }

    // Display bookmarks
    function displayBookmarks(category = 'all') {
        const bookmarks = loadBookmarks();
        bookmarksContainer.innerHTML = '';

        const filteredBookmarks = category === 'all' 
            ? bookmarks 
            : bookmarks.filter(bookmark => bookmark.category === category);

        filteredBookmarks.forEach((bookmark, index) => {
            const bookmarkCard = document.createElement('div');
            bookmarkCard.className = 'bookmark-card';
            bookmarkCard.dataset.index = index;
            bookmarkCard.innerHTML = `
                <a href="${bookmark.url}" target="_blank" style="text-decoration: none;">
                    <img class="bookmark-icon" src="https://www.google.com/s2/favicons?sz=64&domain=${bookmark.url}" alt="${bookmark.title}">
                    <h3 class="bookmark-title">${bookmark.title}</h3>
                </a>
                <div class="bookmark-actions">
                    <button class="delete-btn" data-index="${index}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;

            bookmarksContainer.appendChild(bookmarkCard);
        });

        // Initialize Sortable
        if (sortable) {
            sortable.destroy();
        }
        sortable = new Sortable(bookmarksContainer, {
            animation: 150,
            ghostClass: 'bookmark-card-ghost',
            chosenClass: 'bookmark-card-chosen',
            dragClass: 'bookmark-card-drag',
            handle: '.bookmark-card',
            onEnd: function(evt) {
                const allBookmarks = loadBookmarks();
                const oldIndex = evt.oldIndex;
                const newIndex = evt.newIndex;
                
                // Reorder bookmarks array
                const [movedBookmark] = allBookmarks.splice(oldIndex, 1);
                allBookmarks.splice(newIndex, 0, movedBookmark);
                
                // Save to localStorage
                localStorage.setItem('bookmarks', JSON.stringify(allBookmarks));
                checkForChanges();
            }
        });
    }

    // Category switching
    categories.forEach(categoryElement => {
        categoryElement.addEventListener('click', () => {
            categories.forEach(c => c.classList.remove('active'));
            categoryElement.classList.add('active');
            currentCategory = categoryElement.dataset.category;
            displayBookmarks(currentCategory);
        });
    });

    // Delete bookmark
    bookmarksContainer.addEventListener('click', (e) => {
        if (e.target.closest('.delete-btn')) {
            const index = e.target.closest('.delete-btn').dataset.index;
            let bookmarks = loadBookmarks();
            bookmarks.splice(index, 1);
            localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
            displayBookmarks(currentCategory);
            checkForChanges();
        }
    });

    // Function to update CSV file
    function updateCSVFile(bookmarks) {
        let csvContent = 'title,url,category,color,dateAdded\n';
        
        bookmarks.forEach(bookmark => {
            const row = [
                `"${bookmark.title}"`,
                `"${bookmark.url}"`,
                `"${bookmark.category}"`,
                `"${bookmark.color}"`,
                `"${bookmark.dateAdded}"`
            ].join(',');
            csvContent += row + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        
        // Create download link
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'bookmarks.csv';
        
        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Store initial state
    function saveInitialState() {
        originalBookmarks = JSON.stringify(loadBookmarks());
    }

    // Check if there are changes
    function checkForChanges() {
        const currentBookmarks = JSON.stringify(loadBookmarks());
        hasChanges = currentBookmarks !== originalBookmarks;
        if (hasChanges && !saveChangesBtn.classList.contains('show')) {
            saveChangesBtn.classList.add('show');
            createSmokeEffect(saveChangesBtn);
        } else if (!hasChanges) {
            saveChangesBtn.classList.remove('show');
        }
    }

    function createSmokeEffect(button) {
        const numParticles = 12;
        const buttonRect = button.getBoundingClientRect();

        for (let i = 0; i < numParticles; i++) {
            const particle = document.createElement('div');
            particle.className = 'smoke-particle';
            
            // Random starting position around the button
            const startX = Math.random() * (buttonRect.width + 40) - 20;
            const startY = Math.random() * (buttonRect.height + 20) - 10;
            
            particle.style.left = `${startX}px`;
            particle.style.bottom = `${startY}px`;
            
            // Random size
            const size = 8 + Math.random() * 8;
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;

            // Random color variation
            const baseColor = Math.random() < 0.5 ? 
                [129, 76, 191] :  // Tím (#814CBF)
                [40, 27, 45];     // Tím đen (#281B2D)
            
            const r = baseColor[0] + Math.random() * 15;
            const g = baseColor[1] + Math.random() * 10;
            const b = baseColor[2] + Math.random() * 25;
            const opacity = 0.95 + Math.random() * 0.05;
            particle.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            
            // Random glow effect
            const glowColor = Math.random() < 0.3 ? 
                `rgba(228, 178, 70, ${0.5 + Math.random() * 0.3})` :    // Vàng (#E4B246)
                `rgba(129, 76, 191, ${0.7 + Math.random() * 0.2})`;     // Tím (#814CBF)
            
            particle.style.boxShadow = `
                0 0 ${15 + Math.random() * 15}px rgba(129, 76, 191, 0.8),
                0 0 ${20 + Math.random() * 15}px ${glowColor},
                inset 0 0 ${10 + Math.random() * 10}px rgba(40, 27, 45, 0.95)
            `;
            
            // Random animation delay
            const delay = Math.random() * 0.5;
            particle.style.animation = `smoke ${2 + Math.random() * 0.5}s ${delay}s cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
            
            // Add random rotation
            const rotation = Math.random() * 360;
            particle.style.transform = `rotate(${rotation}deg)`;
            
            // Add scale variation
            const scale = 0.8 + Math.random() * 0.4;
            particle.style.transform += ` scale(${scale})`;
            
            button.appendChild(particle);
            
            // Remove particle after animation
            particle.addEventListener('animationend', () => {
                particle.remove();
            });
        }
    }

    // Save Changes button click handler
    saveChangesBtn.addEventListener('click', () => {
        const bookmarks = loadBookmarks();
        updateCSVFile(bookmarks);
        saveInitialState();
        checkForChanges();
    });

    // Export bookmarks to CSV
    function exportToCSV() {
        updateCSVFile(loadBookmarks());
    }

    // Import bookmarks from CSV
    function importFromCSV(file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const csvData = event.target.result;
            const lines = csvData.split('\n');
            const bookmarks = [];

            // Skip header row and process each line
            for(let i = 1; i < lines.length; i++) {
                if(lines[i].trim() === '') continue;
                
                // Handle CSV parsing with quotes
                const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
                if(row) {
                    bookmarks.push({
                        title: row[0].replace(/"/g, ''),
                        url: row[1].replace(/"/g, ''),
                        category: row[2].replace(/"/g, ''),
                        color: row[3].replace(/"/g, ''),
                        dateAdded: row[4].replace(/"/g, '')
                    });
                }
            }

            localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
            displayBookmarks(currentCategory);
        };
        reader.readAsText(file);
    }

    // Export button click handler
    exportBtn.addEventListener('click', exportToCSV);

    // Import button click handler
    importBtn.addEventListener('click', () => fileInput.click());

    // File input change handler
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(file) {
            importFromCSV(file);
            setTimeout(() => {
                saveInitialState();
                checkForChanges();
            }, 100);
        }
        fileInput.value = '';
    });

    // Initialize state
    saveInitialState();
    checkForChanges();

    // Initial display
    displayBookmarks();
});
