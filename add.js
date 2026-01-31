document.addEventListener('DOMContentLoaded', () => {
    const bookmarkTitleInput = document.getElementById('bookmarkTitle');
    const bookmarkUrlInput = document.getElementById('bookmarkUrl');
    const bookmarkCategorySelect = document.getElementById('bookmarkCategory');
    const bookmarkColorInput = document.getElementById('bookmarkColor');
    const addBookmarkButton = document.getElementById('addBookmark');

    addBookmarkButton.addEventListener('click', () => {
        const title = bookmarkTitleInput.value.trim();
        const url = bookmarkUrlInput.value.trim();
        const category = bookmarkCategorySelect.value;
        const color = bookmarkColorInput.value;

        if (!title || !url) {
            alert('Please enter both title and URL');
            return;
        }

        const formattedUrl = url.startsWith('http') ? url : `https://${url}`;
        
        // Load existing bookmarks
        let bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];
        
        // Add new bookmark
        bookmarks.push({
            title,
            url: formattedUrl,
            category,
            color,
            dateAdded: new Date().toISOString()
        });

        // Save to localStorage
        localStorage.setItem('bookmarks', JSON.stringify(bookmarks));

        // Clear inputs
        bookmarkTitleInput.value = '';
        bookmarkUrlInput.value = '';
        bookmarkCategorySelect.value = 'work';
        bookmarkColorInput.value = '#4CAF50';

        // Redirect to main page
        window.location.href = 'index.html';
    });
}); 