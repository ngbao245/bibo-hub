// API Configuration - Centralized config for all features
// Use encoder.html to update the encoded API base

const API_CONFIG = {
    // Encoded API base - use encoder.html to generate this value
    ENCODED: 'b2kuaXBha2NvbS43MmM1MWJlZmNlYTFhOTg4ZTcwMWM3OTYvLzpzcHR0aA==',
    
    // Decoder function
    decode() {
        try {
            return atob(this.ENCODED).split('').reverse().join('');
        } catch (e) {
            console.error('Failed to decode API base');
            return '';
        }
    },
    
    // API endpoints
    get BASE() { 
        return this.decode(); 
    },
    
    get NOTES() { 
        return `${this.BASE}/notes`; 
    },
    
    get TAGS() { 
        return `${this.BASE}/tags`; 
    },
    
    // Future endpoints can be added here
    // get USERS() { return `${this.BASE}/users`; },
    // get CATEGORIES() { return `${this.BASE}/categories`; },
    // get SETTINGS() { return `${this.BASE}/settings`; }
};

// Export for use in other modules
window.API_CONFIG = API_CONFIG;