// Encoded API Configuration
// Use encoder.html to generate this value
const API_BASE_ENCODED = 'b2kuaXBhY29tLjcyYzUxYmVmY2VhMWE5ODg4ZTcwMTc5NjkvL3NwdHRo';

// Decoder function
function decodeApiBase(encoded) {
    try {
        return atob(encoded).split('').reverse().join('');
    } catch (e) {
        console.error('Failed to decode API base');
        return '';
    }
}

// Export decoded API base
const API_BASE = decodeApiBase(API_BASE_ENCODED);
const API_NOTES = `${API_BASE}/notes`;
const API_TAGS = `${API_BASE}/tags`;
