// API Configuration - Centralized config for all features
// Use encoder.html to update the encoded API base

const API_CONFIG = {
    // Encoded API base - use encoder.html to generate this value
    ENCODED: 'b2kuaXBha2NvbS43MmM1MWJlZmNlYTFhOTg4ZTcwMWM3OTYvLzpzcHR0aA==',
    
    // Decoder function (supports Unicode/Vietnamese)
    decode() {
        try {
            // Reverse + Base64 decode
            const reversed = atob(this.ENCODED).split('').reverse().join('');
            
            // Convert binary string to UTF-8
            const bytes = new Uint8Array(reversed.length);
            for (let i = 0; i < reversed.length; i++) {
                bytes[i] = reversed.charCodeAt(i);
            }
            
            // Decode UTF-8 bytes to string
            return new TextDecoder().decode(bytes);
        } catch (e) {
            // Fallback to old method for backward compatibility
            try {
                return atob(this.ENCODED).split('').reverse().join('');
            } catch (e2) {
                console.error('Failed to decode API base');
                return '';
            }
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
    
    get TASKS() { 
        return `${this.BASE}/tasks`; 
    },
    
    // Future endpoints can be added here
    // get USERS() { return `${this.BASE}/users`; },
    // get CATEGORIES() { return `${this.BASE}/categories`; },
    // get SETTINGS() { return `${this.BASE}/settings`; }
};

// Export for use in other modules
window.API_CONFIG = API_CONFIG;