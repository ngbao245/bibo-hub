// Movies Tracker - Main Logic

// API Configuration - Use notes API with type filter
const API_MOVIES = API_CONFIG.NOTES;

// State
let movies = [];
let currentFilter = { status: 'all', type: 'all' };
let searchQuery = '';
let editingMovie = null;
let pendingSaves = new Map(); // Track pending saves: movieId -> timeout
let hasUnsavedChanges = false;

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Save current page for index.html redirect
    localStorage.setItem('app_currentPage', 'movies');
    
    setupEventListeners();
    setupBeforeUnloadWarning();
    await loadMovies();
    renderMovies();
}

// Event Listeners
function setupEventListeners() {
    // Add movie button
    document.getElementById('addMovieBtn').addEventListener('click', openAddModal);
    
    // Modal close
    document.getElementById('closeModalBtn').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);
    
    // Form submit
    document.getElementById('movieForm').addEventListener('submit', handleFormSubmit);
    
    // Type change
    document.getElementById('movieType').addEventListener('change', handleTypeChange);
    
    // Search
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => handleFilterChange('status', btn.dataset.status));
    });
    
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => handleFilterChange('type', btn.dataset.type));
    });
    
    // Rating stars
    document.querySelectorAll('.star').forEach(star => {
        star.addEventListener('click', handleRatingClick);
    });
    
    // Number input scroll support
    setupNumberInputScroll();
    
    // Close modal on outside click
    document.getElementById('movieModal').addEventListener('click', (e) => {
        if (e.target.id === 'movieModal') closeModal();
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('movieModal').classList.contains('show')) {
            closeModal();
        }
    });
}

// Setup number input scroll support
function setupNumberInputScroll() {
    const numberInputs = ['season', 'currentEpisode', 'totalEpisodes'];
    
    numberInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('wheel', (e) => {
                // Only work when input is focused
                if (document.activeElement === input) {
                    e.preventDefault();
                    
                    const step = parseInt(input.step) || 1;
                    const min = parseInt(input.min) || 0;
                    const max = parseInt(input.max) || Infinity;
                    let value = parseInt(input.value) || min;
                    
                    // Scroll up = increase, scroll down = decrease
                    if (e.deltaY < 0) {
                        value = Math.min(value + step, max);
                    } else {
                        value = Math.max(value - step, min);
                    }
                    
                    input.value = value;
                }
            }, { passive: false });
        }
    });
}

// Setup beforeunload warning
function setupBeforeUnloadWarning() {
    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges || pendingSaves.size > 0) {
            e.preventDefault();
            e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            return e.returnValue;
        }
    });
}

// Load Movies
async function loadMovies() {
    try {
        const response = await fetch(API_MOVIES);
        const data = await response.json();
        
        // Ensure movies is always an array
        const allNotes = Array.isArray(data) ? data : [];
        
        // Filter only movie and series types, then convert to movie format
        movies = allNotes
            .filter(note => note.type === 'movie' || note.type === 'series')
            .map(note => convertNoteToMovie(note));
        
        console.log('Loaded movies:', movies);
    } catch (error) {
        console.error('Error loading movies:', error);
        movies = [];
    }
}

// Convert notes schema to movie format
function convertNoteToMovie(note) {
    const movie = {
        id: note.id,
        title: note.title,
        type: note.type, // 'movie' or 'series'
        status: note.tags || 'plan', // tags -> status
        notes: note.content || '', // content -> notes
        url: note.source || '', // source -> url
        rating: parseInt(note.url4) || 0,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt
    };
    
    if (note.type === 'movie') {
        movie.currentTime = note.url1 || '0:00';
        movie.totalTime = note.url2 || '0:00';
    } else {
        movie.currentEpisode = parseInt(note.url1) || 0;
        movie.totalEpisodes = parseInt(note.url2) || 0;
        movie.season = parseInt(note.url3) || 1;
        movie.episodeDuration = note.url5 || '';
    }
    
    return movie;
}

// Render Movies
function renderMovies() {
    const container = document.getElementById('moviesList');
    
    // Safety check: ensure movies is an array
    if (!Array.isArray(movies)) {
        console.error('Movies is not an array:', movies);
        movies = [];
    }
    
    // Filter movies
    let filtered = movies.filter(movie => {
        const matchesStatus = currentFilter.status === 'all' || movie.status === currentFilter.status;
        const matchesType = currentFilter.type === 'all' || movie.type === currentFilter.type;
        const matchesSearch = !searchQuery || 
            movie.title.toLowerCase().includes(searchQuery.toLowerCase());
        
        return matchesStatus && matchesType && matchesSearch;
    });
    
    // Sort by updated date (newest first)
    filtered.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🎬</div>
                <div class="empty-state-text">No movies found</div>
                <div class="empty-state-subtext">Add your first movie to get started</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filtered.map(movie => createMovieCard(movie)).join('');
    
    // Attach event listeners
    attachMovieEventListeners();
}

// Create Movie Card
function createMovieCard(movie) {
    const progress = calculateProgress(movie);
    const progressText = getProgressText(movie);
    
    return `
        <div class="movie-card" data-id="${movie.id}">
            <div class="movie-header">
                <div class="movie-title-section">
                    <div class="title-row">
                        <h3 class="movie-title">
                            ${movie.title}${movie.type === 'series' && movie.status !== 'plan' ? ` - S${String(movie.season).padStart(2, '0')}E${String(movie.currentEpisode).padStart(2, '0')}` : ''}
                        </h3>
                        <span class="movie-badge badge-${movie.status}">${getStatusLabel(movie.status)}</span>
                    </div>
                    <div class="movie-meta">
                    </div>
                </div>
                ${movie.rating > 0 ? `<div class="movie-rating">${'★'.repeat(movie.rating)}${'☆'.repeat(5 - movie.rating)}</div>` : ''}
            </div>
            
            <div class="movie-progress">
                <div class="progress-info">
                    <span class="progress-text-display" data-id="${movie.id}" data-type="${movie.type}">${progressText}</span>
                    <span>${Math.round(progress)}%</span>
                </div>
                <div class="progress-bar-container" data-id="${movie.id}">
                    <div class="progress-bar progress-${movie.status}" style="width: ${progress}%"></div>
                </div>
            </div>
            
            <div class="movie-actions">
                <div class="actions-left">
                    ${movie.url ? `
                        <a href="${movie.url}" target="_blank" rel="noopener noreferrer" class="action-btn btn-watch">
                            ▶ Watch
                        </a>
                    ` : ''}
                    ${movie.type === 'movie' ? `
                        <button class="action-btn btn-play" data-action="play" data-id="${movie.id}" ${movie.status === 'completed' ? 'disabled' : ''}>
                            +5 min
                        </button>
                    ` : `
                        <button class="action-btn btn-play" data-action="nextEp" data-id="${movie.id}" ${movie.status === 'completed' ? 'disabled' : ''}>
                            Next Ep
                        </button>
                    `}
                </div>
                <div class="actions-right">
                    <button class="action-btn" data-action="edit" data-id="${movie.id}" title="Edit">
                        ⚙
                    </button>
                    <button class="action-btn btn-delete" data-action="delete" data-id="${movie.id}" title="Delete">
                        ✕
                    </button>
                </div>
            </div>
                        
            ${movie.notes ? `<div class="movie-notes">${movie.notes}</div>` : ''}
        </div>
    `;
}

// Calculate Progress
function calculateProgress(movie) {
    if (movie.status === 'completed') return 100;
    if (movie.status === 'plan') return 0;
    
    if (movie.type === 'movie') {
        if (!movie.currentTime || !movie.totalTime) return 0;
        const current = timeToSeconds(movie.currentTime);
        const total = timeToSeconds(movie.totalTime);
        return Math.round((current / total) * 10000) / 100; // Round to 2 decimal places
    } else {
        // For series: progress based on episodes watched
        if (!movie.totalEpisodes || movie.totalEpisodes === 0) return 0;
        // Allow episode 0 to show 0% progress
        const currentEp = movie.currentEpisode || 0;
        return Math.round((currentEp / movie.totalEpisodes) * 10000) / 100; // Round to 2 decimal places
    }
}

// Get Progress Text
function getProgressText(movie) {
    if (movie.type === 'movie') {
        return `${movie.currentTime || '0:00'} / ${movie.totalTime || '0:00'}`;
    } else {
        const currentEp = movie.status === 'plan' ? 0 : (movie.currentEpisode || 1);
        const episodeTime = movie.episodeDuration ? ` (${movie.episodeDuration})` : '';
        return `${episodeTime} Ep ${currentEp} / ${movie.totalEpisodes || 0}`;
    }
}

// Time Helpers
function timeToSeconds(time) {
    if (!time) return 0;
    const parts = time.split(':').map(Number);
    return parts[0] * 60 + (parts[1] || 0);
}

function secondsToTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
}

// Get Status Label
function getStatusLabel(status) {
    const labels = {
        watching: 'Watching',
        completed: 'Completed',
        plan: 'Plan to Watch'
    };
    return labels[status] || status;
}

// Attach Movie Event Listeners
function attachMovieEventListeners() {
    // Progress bar drag (mouse and touch)
    document.querySelectorAll('.progress-bar-container').forEach(bar => {
        bar.addEventListener('mousedown', handleProgressClick);
        bar.addEventListener('touchstart', handleProgressClick, { passive: false });
    });
    
    // Progress text double click to edit
    document.querySelectorAll('.progress-text-display').forEach(span => {
        span.addEventListener('dblclick', handleProgressTextEdit);
    });
    
    // Action buttons
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', handleActionClick);
    });
}

// Handle Progress Text Double Click to Edit
function handleProgressTextEdit(e) {
    const id = e.currentTarget.dataset.id;
    const type = e.currentTarget.dataset.type;
    const movie = movies.find(m => m.id === id);
    if (!movie) return;
    
    const span = e.currentTarget;
    const currentValue = type === 'movie' ? movie.currentTime : movie.episodeDuration;
    
    // Create input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue || '0:00';
    input.style.cssText = `
        width: 80px;
        padding: 2px 6px;
        background: var(--color-bg-primary);
        border: 1px solid var(--color-border);
        color: var(--color-text-primary);
        font-size: inherit;
        font-family: inherit;
        box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
        outline: none;
    `;
    
    // Replace span with input
    span.style.display = 'none';
    span.parentNode.insertBefore(input, span);
    input.focus();
    input.select();
    
    const saveValue = () => {
        const newValue = parseTimeInput(input.value);
        input.remove();
        span.style.display = '';
        
        // Update movie
        const updatedMovie = { ...movie };
        if (type === 'movie') {
            updatedMovie.currentTime = newValue;
        } else {
            updatedMovie.episodeDuration = newValue;
        }
        
        // Update status if needed
        if (newValue !== '0:00' && updatedMovie.status === 'plan') {
            updatedMovie.status = 'watching';
        }
        
        updateMovieInState(updatedMovie);
        renderMovies();
        debouncedSave(updatedMovie);
    };
    
    input.addEventListener('blur', saveValue);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveValue();
        } else if (e.key === 'Escape') {
            input.remove();
            span.style.display = '';
        }
    });
}

// Handle Progress Bar Drag
function handleProgressClick(e) {
    const id = e.currentTarget.dataset.id;
    const movie = movies.find(m => m.id === id);
    if (!movie) return;
    
    const progressBar = e.currentTarget;
    const rect = progressBar.getBoundingClientRect();
    
    // Create tooltip
    const tooltip = document.createElement('div');
    tooltip.style.cssText = `
        position: fixed;
        background: var(--color-bg-elevated);
        color: var(--color-text-primary);
        padding: 4px 8px;
        border-radius: 4px;
        font-size: var(--font-sm);
        pointer-events: none;
        z-index: 10001;
        border: 1px solid var(--color-border);
    `;
    document.body.appendChild(tooltip);
    
    // Calculate percent from mouse/touch position
    const calculatePercent = (clientX) => {
        let percent = ((clientX - rect.left) / rect.width) * 100;
        percent = Math.max(0, Math.min(100, percent));
        
        // For series: snap to episode boundaries
        if (movie.type === 'series' && movie.totalEpisodes > 0) {
            const episodePercent = 100 / movie.totalEpisodes;
            percent = Math.round(percent / episodePercent) * episodePercent;
        } else if (movie.type === 'movie') {
            // For movies: snap to seconds (smoother than rounding to whole percent)
            const totalSeconds = timeToSeconds(movie.totalTime);
            if (totalSeconds > 0) {
                const currentSeconds = Math.round((percent / 100) * totalSeconds);
                percent = (currentSeconds / totalSeconds) * 100;
            }
        }
        
        return percent;
    };
    
    // Get clientX from mouse or touch event
    const getClientX = (event) => {
        return event.touches ? event.touches[0].clientX : event.clientX;
    };
    
    // Update tooltip position
    const updateTooltip = (clientX, clientY, percent) => {
        if (movie.type === 'movie') {
            // For movies: show time instead of percent
            const totalSeconds = timeToSeconds(movie.totalTime);
            const currentSeconds = Math.round((percent / 100) * totalSeconds);
            tooltip.textContent = secondsToTime(currentSeconds);
        } else {
            // For series: show percent with 2 decimal places
            tooltip.textContent = `${percent.toFixed(2)}%`;
        }
        tooltip.style.left = `${clientX + 10}px`;
        tooltip.style.top = `${clientY - 30}px`;
    };
    
    let lastPercent = 0;
    const initialX = getClientX(e);
    const initialPercent = calculatePercent(initialX);
    lastPercent = initialPercent;
    updateTooltip(initialX, e.clientY || e.touches[0].clientY, initialPercent);
    updateProgressUI(movie, initialPercent); // Only update UI, no save
    
    // Setup drag
    const onMove = (event) => {
        const clientX = getClientX(event);
        const clientY = event.clientY || event.touches[0].clientY;
        const percent = calculatePercent(clientX);
        lastPercent = percent;
        updateTooltip(clientX, clientY, percent);
        updateProgressUI(movie, percent); // Only update UI, no save
        event.preventDefault(); // Prevent scrolling on touch
    };
    
    const onEnd = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
        progressBar.style.cursor = 'grab';
        tooltip.remove();
        
        // Save only once when drag ends
        updateProgress(movie, lastPercent);
    };
    
    progressBar.style.cursor = 'grabbing';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
}

// Update Progress UI only (no save)
function updateProgressUI(movie, percent) {
    const updatedMovie = { ...movie };
    
    if (movie.type === 'movie') {
        const totalSeconds = timeToSeconds(movie.totalTime);
        const currentSeconds = Math.round((percent / 100) * totalSeconds);
        updatedMovie.currentTime = secondsToTime(currentSeconds);
    } else {
        // For series: update current episode based on percent
        const currentEp = Math.round((percent / 100) * movie.totalEpisodes);
        updatedMovie.currentEpisode = currentEp;
    }
    
    // Update status based on percent
    if (percent >= 100) {
        updatedMovie.status = 'completed';
    } else if (percent > 0) {
        updatedMovie.status = 'watching';
    } else if (percent === 0) {
        updatedMovie.status = 'plan';
    }
    
    // Update UI immediately (optimistic)
    updateMovieInState(updatedMovie);
    renderMovies();
}

// Update Progress (Optimistic UI)
function updateProgress(movie, percent) {
    const updatedMovie = { ...movie };
    
    if (movie.type === 'movie') {
        const totalSeconds = timeToSeconds(movie.totalTime);
        const currentSeconds = Math.round((percent / 100) * totalSeconds);
        updatedMovie.currentTime = secondsToTime(currentSeconds);
    } else {
        // For series: update current episode based on percent
        const currentEp = Math.round((percent / 100) * movie.totalEpisodes);
        updatedMovie.currentEpisode = currentEp;
    }
    
    // Update status based on percent (allow dragging back from 100%)
    if (percent >= 100) {
        updatedMovie.status = 'completed';
    } else if (percent > 0) {
        // If dragging back from completed, set to watching
        updatedMovie.status = 'watching';
    } else if (percent === 0) {
        // If dragged to 0%, set to plan
        updatedMovie.status = 'plan';
    }
    
    // Update UI immediately (optimistic)
    updateMovieInState(updatedMovie);
    renderMovies();
    
    // Save to DB in background (debounced)
    debouncedSave(updatedMovie);
}

// Handle Action Click
async function handleActionClick(e) {
    const action = e.currentTarget.dataset.action;
    const id = e.currentTarget.dataset.id;
    const movie = movies.find(m => m.id === id);
    
    if (!movie) return;
    
    switch (action) {
        case 'play':
            handlePlay(movie);
            break;
        case 'nextEp':
            handleNextEpisode(movie);
            break;
        case 'edit':
            openEditModal(movie);
            break;
        case 'delete':
            await handleDelete(movie);
            break;
    }
}

// Handle Play (Optimistic UI) - Add 5 minutes for movies only
function handlePlay(movie) {
    const updatedMovie = { ...movie };
    
    // Add 5 minutes to current time
    const currentSeconds = timeToSeconds(movie.currentTime || '0:00');
    const totalSeconds = timeToSeconds(movie.totalTime);
    const newSeconds = Math.min(currentSeconds + 300, totalSeconds);
    updatedMovie.currentTime = secondsToTime(newSeconds);
    
    if (newSeconds >= totalSeconds) {
        updatedMovie.status = 'completed';
    } else if (updatedMovie.status === 'plan') {
        updatedMovie.status = 'watching';
    }
    
    // Update UI immediately (optimistic)
    updateMovieInState(updatedMovie);
    renderMovies();
    
    // Save to DB in background (debounced)
    debouncedSave(updatedMovie);
}

// Handle Next Episode (Optimistic UI)
function handleNextEpisode(movie) {
    const updatedMovie = { ...movie };
    
    // Next episode - reset episode duration to 0:00
    const nextEp = (movie.currentEpisode || 0) + 1;
    updatedMovie.currentEpisode = Math.min(nextEp, movie.totalEpisodes);
    updatedMovie.episodeDuration = '0:00'; // Reset time for new episode
    
    if (updatedMovie.currentEpisode >= movie.totalEpisodes) {
        updatedMovie.status = 'completed';
    } else if (updatedMovie.status === 'plan') {
        updatedMovie.status = 'watching';
    }
    
    // Update UI immediately (optimistic)
    updateMovieInState(updatedMovie);
    renderMovies();
    
    // Save to DB in background (debounced)
    debouncedSave(updatedMovie);
}

// Handle Delete
async function handleDelete(movie) {
    if (!confirm(`Delete "${movie.title}"?`)) return;
    
    try {
        await fetch(`${API_MOVIES}/${movie.id}`, { method: 'DELETE' });
        await loadMovies();
        renderMovies();
    } catch (error) {
        console.error('Error deleting movie:', error);
        alert('Error deleting movie');
    }
}

// Update movie in state (optimistic UI)
function updateMovieInState(updatedMovie) {
    const index = movies.findIndex(m => m.id === updatedMovie.id);
    if (index !== -1) {
        movies[index] = updatedMovie;
    }
}

// Debounced save (wait 1 second after last change)
function debouncedSave(movieData) {
    const movieId = movieData.id;
    
    // Mark as having unsaved changes
    hasUnsavedChanges = true;
    
    // Clear existing timeout for this movie
    if (pendingSaves.has(movieId)) {
        clearTimeout(pendingSaves.get(movieId));
    }
    
    // Set new timeout
    const timeoutId = setTimeout(async () => {
        console.log('Auto-saving movie:', movieData.title);
        await saveMovieToAPI(movieData);
        pendingSaves.delete(movieId);
        
        // Check if all saves are done
        if (pendingSaves.size === 0) {
            hasUnsavedChanges = false;
        }
    }, 200); // 200ms debounce
    
    pendingSaves.set(movieId, timeoutId);
}

// Save Movie to API (actual API call)
async function saveMovieToAPI(movieData) {
    try {
        const url = movieData.id ? `${API_MOVIES}/${movieData.id}` : API_MOVIES;
        const method = movieData.id ? 'PUT' : 'POST';
        
        // Map movie data to notes schema
        const dataToSave = {
            title: movieData.title || 'Untitled',
            content: movieData.notes || '',
            type: movieData.type || 'movie',
            source: movieData.url || '',
            tags: movieData.status || 'plan',
            example: '',
            url1: movieData.type === 'movie' ? movieData.currentTime || '0:00' : String(movieData.currentEpisode || 0),
            url2: movieData.type === 'movie' ? movieData.totalTime || '0:00' : String(movieData.totalEpisodes || 0),
            url3: movieData.type === 'series' ? String(movieData.season || 1) : '',
            url4: String(movieData.rating || 0),
            url5: movieData.type === 'series' ? (movieData.episodeDuration || '') : '',
            wordCountEnabled: false,
            timerDuration: '0',
            createdAt: movieData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Add id if editing
        if (movieData.id) {
            dataToSave.id = movieData.id;
        }
        
        console.log('Saving movie to API:', dataToSave);
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSave)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', errorText);
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }
        
        const result = await response.json();
        console.log('Save result:', result);
        
        return result;
    } catch (error) {
        console.error('Error saving movie:', error);
        // Show error but don't block UI
        showSaveError(movieData.title);
        throw error;
    }
}

// Save Movie (for form submit - immediate save)
async function saveMovie(movieData) {
    try {
        const result = await saveMovieToAPI(movieData);
        
        // Reload from API to get fresh data
        await loadMovies();
        renderMovies();
        
        return result;
    } catch (error) {
        alert('Error saving movie: ' + error.message);
    }
}

// Show save error notification
function showSaveError(movieTitle) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--color-danger);
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        z-index: 10001;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = `Failed to save "${movieTitle}"`;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Modal Functions
function openAddModal() {
    editingMovie = null;
    document.getElementById('modalTitle').textContent = 'Add Movie';
    document.getElementById('movieForm').reset();
    document.getElementById('movieRating').value = '0';
    updateRatingStars(0);
    handleTypeChange();
    
    // Set default current episode to 0 for new series
    document.getElementById('currentEpisode').value = '0';
    
    // Hide status and current time for new movies (Plan to Watch by default)
    const statusGroup = document.getElementById('statusGroup');
    const currentTimeGroup = document.getElementById('currentTimeGroup');
    if (statusGroup) statusGroup.style.display = 'none';
    if (currentTimeGroup) currentTimeGroup.style.display = 'none';
    
    document.getElementById('movieModal').classList.add('show');
}

function openEditModal(movie) {
    editingMovie = movie;
    document.getElementById('modalTitle').textContent = 'Edit Movie';
    
    // Fill form
    document.getElementById('movieTitle').value = movie.title;
    document.getElementById('movieType').value = movie.type;
    document.getElementById('movieStatus').value = movie.status;
    document.getElementById('movieNotes').value = movie.notes || '';
    document.getElementById('movieUrl').value = movie.url || '';
    document.getElementById('movieRating').value = movie.rating || 0;
    updateRatingStars(movie.rating || 0);
    
    if (movie.type === 'movie') {
        document.getElementById('currentTime').value = movie.currentTime || '';
        document.getElementById('totalTime').value = movie.totalTime || '';
        
        // Show current time field for editing
        const currentTimeGroup = document.getElementById('currentTime').closest('.form-group');
        if (currentTimeGroup) {
            currentTimeGroup.style.display = 'block';
        }
    } else {
        document.getElementById('season').value = movie.season || 1;
        document.getElementById('currentEpisode').value = movie.currentEpisode || 1;
        document.getElementById('totalEpisodes').value = movie.totalEpisodes || 12;
        document.getElementById('episodeDuration').value = movie.episodeDuration || '';
    }
    
    handleTypeChange();
    document.getElementById('movieModal').classList.add('show');
}

function closeModal() {
    document.getElementById('movieModal').classList.remove('show');
    editingMovie = null;
}

// Handle Type Change
function handleTypeChange() {
    const type = document.getElementById('movieType').value;
    const movieFields = document.getElementById('movieFields');
    const seriesFields = document.getElementById('seriesFields');
    const totalTimeGroup = document.getElementById('totalTimeGroup');
    const totalTimeInput = document.getElementById('totalTime');
    const totalEpisodesInput = document.getElementById('totalEpisodes');
    
    if (type === 'movie') {
        movieFields.style.display = 'block';
        seriesFields.style.display = 'none';
        if (totalTimeGroup) totalTimeGroup.style.display = 'block';
        // Set required for movie fields
        totalTimeInput.required = true;
        totalEpisodesInput.required = false;
    } else {
        movieFields.style.display = 'none';
        seriesFields.style.display = 'block';
        if (totalTimeGroup) totalTimeGroup.style.display = 'none';
        // Set required for series fields
        totalTimeInput.required = false;
        totalEpisodesInput.required = true;
    }
}

// Handle Form Submit
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const type = document.getElementById('movieType').value;
    const movieData = {
        title: document.getElementById('movieTitle').value,
        type,
        status: document.getElementById('movieStatus').value,
        notes: document.getElementById('movieNotes').value,
        url: document.getElementById('movieUrl').value,
        rating: parseInt(document.getElementById('movieRating').value) || 0,
        createdAt: editingMovie?.createdAt || new Date().toISOString()
    };
    
    if (type === 'movie') {
        const currentTimeValue = document.getElementById('currentTime').value;
        movieData.currentTime = currentTimeValue ? parseTimeInput(currentTimeValue) : '0:00';
        movieData.totalTime = parseTimeInput(document.getElementById('totalTime').value);
        
        // Auto change status based on current time
        if (movieData.status === 'plan' && movieData.currentTime !== '0:00') {
            movieData.status = 'watching';
        }
    } else {
        movieData.season = parseInt(document.getElementById('season').value) || 1;
        movieData.currentEpisode = parseInt(document.getElementById('currentEpisode').value) || 0;
        movieData.totalEpisodes = parseInt(document.getElementById('totalEpisodes').value);
        
        // Episode duration (optional)
        const episodeDurationValue = document.getElementById('episodeDuration').value;
        movieData.episodeDuration = episodeDurationValue ? parseTimeInput(episodeDurationValue) : '';
        
        // Auto change status based on current episode
        if (movieData.status === 'plan' && movieData.currentEpisode > 0) {
            movieData.status = 'watching';
        }
        if (movieData.currentEpisode >= movieData.totalEpisodes) {
            movieData.status = 'completed';
        }
    }
    
    if (editingMovie) {
        movieData.id = editingMovie.id;
    }
    
    await saveMovie(movieData);
    closeModal();
}

// Parse time input (smart parsing)
function parseTimeInput(input) {
    if (!input) return '0:00';
    
    input = input.trim();
    
    // If has colon: "12:34" → 12:34, "12:12222" → 12:12
    if (input.includes(':')) {
        const parts = input.split(':');
        const mins = parseInt(parts[0]) || 0;
        // Only take first 2 digits of seconds
        const secsStr = (parts[1] || '0').substring(0, 2);
        const secs = Math.min(parseInt(secsStr) || 0, 59);
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }
    
    // If has space: "12 34" → 12:34, "12 3456" → 12:34
    if (input.includes(' ')) {
        const parts = input.split(/\s+/);
        const mins = parseInt(parts[0]) || 0;
        // Only take first 2 digits of seconds
        const secsStr = (parts[1] || '0').substring(0, 2);
        const secs = Math.min(parseInt(secsStr) || 0, 59);
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }
    
    // If just a number: "120" → 120:00
    const mins = parseInt(input) || 0;
    return `${mins}:00`;
}

// Handle Rating Click (toggle to remove)
function handleRatingClick(e) {
    const rating = parseInt(e.target.dataset.rating);
    const currentRating = parseInt(document.getElementById('movieRating').value);
    
    // If clicking the same rating, remove it (set to 0)
    if (rating === currentRating) {
        document.getElementById('movieRating').value = 0;
        updateRatingStars(0);
    } else {
        document.getElementById('movieRating').value = rating;
        updateRatingStars(rating);
    }
}

function updateRatingStars(rating) {
    document.querySelectorAll('.star').forEach((star, index) => {
        if (index < rating) {
            star.classList.add('active');
            star.textContent = '★';
        } else {
            star.classList.remove('active');
            star.textContent = '☆';
        }
    });
}

// Handle Filter Change
function handleFilterChange(filterType, value) {
    currentFilter[filterType] = value;
    
    // Update active button
    const buttons = filterType === 'status' ? '.filter-btn' : '.type-btn';
    document.querySelectorAll(buttons).forEach(btn => {
        btn.classList.toggle('active', btn.dataset[filterType] === value);
    });
    
    renderMovies();
}

// Handle Search
function handleSearch(e) {
    searchQuery = e.target.value;
    renderMovies();
}
