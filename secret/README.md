# Secret Notes Modal

Password-protected notes modal accessible only from Hub with encryption support for Vietnamese/Unicode.

## 📋 Overview

Secret Notes is a password-protected notes application embedded in Hub. Features full CRUD operations, encryption for sensitive data, and support for up to 100 URLs per note. Notes are stored with `type="secret"` and filtered out from regular Notes app.

## 🚀 Features

### Core Features
- **Password Protection**: Requires password to access
- **Session Lock**: Password required each time modal opens
- **Full CRUD**: Create, read, update, delete secret notes
- **Encryption**: Title, content, and URLs encrypted with Base64 + reverse
- **Unicode Support**: Supports Vietnamese and special characters
- **URL Management**: Store up to 100 URLs with optional names
- **Search**: Search by title and content
- **Rich Content**: HTML content with line breaks
- **Isolation**: Notes don't appear in regular Notes app

### Security Features
- **Custom Password Toggle**: White eye icon for show/hide
- **Browser Compatibility**: Hides default password icons (Edge, Chrome, Firefox, Opera, Arc, Safari)
- **ESC Key Support**: Press ESC to close modal anytime
- **Encrypted Storage**: Sensitive data encrypted before saving to database

### UI/UX
- **Consistent Theme**: Dark theme matching other modals
- **Smooth Animations**: 0.2s slideIn animation
- **Optimized Performance**: No delays, instant UI updates
- **Mobile Support**: Hamburger menu for mobile devices

## 📁 File Structure

```
secret/
├── secret-modal.css        # Modal styles
├── secret-modal.js         # Modal logic and encryption
└── README.md               # This file
```

**Note**: Modal HTML is embedded in `hub.html` due to CORS limitations with file:// protocol.

## 🗄️ Database Schema

Uses same Notes table with `type="secret"`:

```json
{
  "id": "string",
  "title": "string (encrypted)",
  "content": "string (encrypted HTML)",
  "type": "secret",
  "source": "",
  "tags": "",
  "example": "",
  "url1": "string (encrypted, pipe-separated)",
  "url2": "",
  "url3": "",
  "url4": "",
  "url5": "",
  "createdAt": "ISO string",
  "updatedAt": "ISO string"
}
```

**Field Usage:**
- `title`: Encrypted with `encryptSecretData()`
- `content`: Encrypted HTML with `<br>` tags
- `type`: Always "secret"
- `url1`: Encrypted, stores all URLs separated by `|`
  - Format: `name::url|name::url|url` (name optional)
  - Example: `Google::https://google.com|https://github.com`
- `url2-5`: Not used (all URLs in `url1`)

## 🔧 Technical Implementation

### Encryption (secret-modal.js)

**Encryption Function (Unicode Support):**
```javascript
function encryptSecretData(text) {
    if (!text) return '';
    try {
        // Step 1: Convert Unicode to UTF-8 bytes
        const utf8Bytes = new TextEncoder().encode(text);
        
        // Step 2: Convert bytes to binary string
        let binaryString = '';
        utf8Bytes.forEach(byte => {
            binaryString += String.fromCharCode(byte);
        });
        
        // Step 3: Reverse + Base64 encode
        return btoa(binaryString.split('').reverse().join(''));
    } catch (e) {
        console.error('Encryption error:', e);
        return text;
    }
}
```

**Decryption Function (Unicode Support):**
```javascript
function decryptSecretData(encoded) {
    if (!encoded) return '';
    try {
        // Step 1: Base64 decode + reverse
        const reversed = atob(encoded).split('').reverse().join('');
        
        // Step 2: Convert binary string to UTF-8 bytes
        const bytes = new Uint8Array(reversed.length);
        for (let i = 0; i < reversed.length; i++) {
            bytes[i] = reversed.charCodeAt(i);
        }
        
        // Step 3: Decode UTF-8 bytes to Unicode string
        return new TextDecoder().decode(bytes);
    } catch (e) {
        // Fallback for old data (old encryption method)
        try {
            const decoded = atob(encoded);
            return decoded.split('').reverse().join('');
        } catch (e2) {
            // If all fails, return original (plain text)
            return encoded;
        }
    }
}
```

**Why This Approach:**
- `btoa()` only supports ASCII (fails with Vietnamese)
- `TextEncoder` converts Unicode → UTF-8 bytes
- Convert bytes → binary string → Base64
- Reverse for simple obfuscation
- Fallback for backward compatibility with old data

### Password Verification

**Password Storage:**
```javascript
const SECRET_PASSWORD_ENCODED = 'MzAwMkBvYmlib2FC';
// Decoded: BoBibo@2003 (reversed)
```

**Verification:**
```javascript
function verifyPassword() {
    const input = document.getElementById('secretPasswordInput');
    const password = input.value;
    
    const decoded = atob(SECRET_PASSWORD_ENCODED);
    const correctPassword = decoded.split('').reverse().join('');
    
    if (password === correctPassword) {
        secretNotesUnlocked = true;
        showSecretNotesApp();
    } else {
        // Show error, shake animation
        error.style.display = 'block';
        input.style.animation = 'shake 0.3s ease';
    }
}
```

### URL Management

**URL Format:**
```javascript
// Saving URLs
const allUrls = [
    'Google::https://google.com',
    'https://github.com',
    'Docs::https://docs.com'
];
const url1 = allUrls.join('|');
// Result: "Google::https://google.com|https://github.com|Docs::https://docs.com"

// Parsing URLs
const allUrls = note.url1.split('|').filter(u => u.trim());
allUrls.forEach(urlData => {
    const parts = urlData.split('::');
    const name = parts.length > 1 ? parts[0] : '';
    const url = parts.length > 1 ? parts[1] : urlData;
    // Display name and url
});
```

**URL Click to Copy:**
```javascript
async function copySecretUrl(url) {
    try {
        await navigator.clipboard.writeText(url);
        
        // Show feedback popup (reusable element)
        if (!copyFeedback) {
            copyFeedback = document.createElement('div');
            copyFeedback.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: var(--color-accent-primary);
                color: white;
                padding: 12px 24px;
                border-radius: 4px;
                z-index: 100000;
                opacity: 0;
                transition: opacity 0.2s ease;
            `;
            document.body.appendChild(copyFeedback);
        }
        
        copyFeedback.textContent = 'URL copied!';
        copyFeedback.style.opacity = '1';
        
        setTimeout(() => {
            copyFeedback.style.opacity = '0';
        }, 1500);
    } catch (error) {
        console.error('Error copying URL:', error);
    }
}
```

### State Management

**Global State:**
```javascript
const SECRET_PASSWORD_ENCODED = 'MzAwMkBvYmlib2FC';
let secretNotesUnlocked = false;  // Session lock
let secretNotes = [];             // Decrypted notes
let currentSecretNote = null;     // Current note
```

**Key Functions:**
- `openSecretModal()`: Open modal, show password prompt
- `closeSecretModal()`: Close modal, reset unlock state
- `verifyPassword()`: Verify password and unlock
- `showSecretNotesApp()`: Show notes app interface
- `loadSecretNotes()`: Load and decrypt notes from API
- `saveSecretNote()`: Encrypt and save note
- `deleteSecretNote(id)`: Delete note with confirmation
- `selectSecretNote(id)`: Select and display note
- `showSecretNoteView()`: Display note in view mode
- `showSecretNoteEdit()`: Display note in edit mode

### Mobile Interface

**Mobile Support:**
```javascript
function initSecretMobileInterface() {
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) return;

    const sidebar = document.querySelector('.secret-app-container .sidebar');
    const header = document.querySelector('.secret-modal-header');
    
    // Add hamburger button
    const hamburger = document.createElement('button');
    hamburger.className = 'mobile-hamburger';
    hamburger.innerHTML = '☰';
    
    header.insertBefore(hamburger, header.firstChild);

    // Toggle sidebar
    hamburger.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-visible');
        hamburger.innerHTML = sidebar.classList.contains('mobile-visible') ? '✕' : '☰';
    });

    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('mobile-visible') && 
            !sidebar.contains(e.target) && 
            !hamburger.contains(e.target)) {
            sidebar.classList.remove('mobile-visible');
            hamburger.innerHTML = '☰';
        }
    });
}
```

## 🎨 Styling

### Key CSS Classes
- `.secret-modal`: Modal container
- `.secret-modal.show`: Modal visible
- `.secret-password-prompt`: Password input screen
- `.secret-password-input`: Password input field
- `.toggle-password-btn`: Show/hide password button
- `.secret-app-container`: Main app container
- `.sidebar`: Left sidebar with notes list
- `.editor-container`: Right panel with editor
- `.secret-note-item`: Note list item
- `.url-item`: URL item (clickable to copy)

### Password Toggle Button
```css
.toggle-password-btn {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: white; /* White icon */
    cursor: pointer;
    padding: 5px;
    transition: opacity 0.2s;
}

.toggle-password-btn:hover {
    opacity: 0.7;
}

/* Hide browser default password icons */
.secret-password-input::-ms-reveal,
.secret-password-input::-ms-clear {
    display: none; /* Edge/IE */
}

.secret-password-input::-webkit-credentials-auto-fill-button {
    display: none; /* Chrome/Opera/Arc */
}

.secret-password-input::-moz-reveal {
    display: none; /* Firefox */
}

.secret-password-input::-webkit-contacts-auto-fill-button {
    display: none; /* Safari */
}
```

### URL Copy Hover Effect
```css
.url-item {
    cursor: pointer;
    padding: 8px;
    border-radius: 4px;
    transition: background 0.2s;
}

.url-item:hover {
    background: var(--color-bg-elevated);
}
```

## 🔌 Dependencies

### External
- `../common.css`: Shared styles
- `../config.js`: API configuration

### Internal
- `secret-modal.css`: Modal styles
- `secret-modal.js`: Modal logic and encryption

### Integration
- Modal HTML embedded in `hub.html`
- Opened via "🔒 Secret" button in Hub
- ESC key handled by `global-shortcuts.js`

## 🚀 Usage

### Accessing Secret Notes
1. Open Hub (`hub.html`)
2. Click "🔒 Secret" button
3. Enter password
4. Click "Unlock" or press Enter

### Creating Secret Note
1. Click "+" in sidebar
2. Fill in title, content
3. Add URLs with optional names
4. Click "Save"

### Managing URLs
1. Click "Add URL" to add new URL
2. Click name label to edit name
3. Enter URL in input field
4. Click × to remove URL
5. Maximum 100 URLs per note

### Copying URLs
1. View note with URLs
2. Click on any URL item
3. "URL copied!" feedback appears
4. URL is in clipboard

### Mobile Usage
1. Tap ☰ to open sidebar
2. Select note from list
3. Tap outside or ✕ to close sidebar
4. Manage notes normally

## ⚙️ Configuration

### Changing Password
Edit `secret-modal.js`:
```javascript
// Current password: BoBibo@2003
// To change:
// 1. Reverse new password: "newpass" → "ssapwen"
// 2. Base64 encode: btoa("ssapwen") → "c3NhcHdlbg=="
// 3. Update constant:
const SECRET_PASSWORD_ENCODED = 'c3NhcHdlbg==';
```

### API Setup
Uses same API as Notes app:
```javascript
const API_NOTES = API_CONFIG.NOTES;
```

## 🐛 Troubleshooting

### Password not working
- Check `SECRET_PASSWORD_ENCODED` value
- Verify decoding logic: `atob()` → reverse
- Default password: `BoBibo@2003`

### Vietnamese text not encrypting
- Verify `TextEncoder` is used
- Check `encryptSecretData()` function
- See Console for errors

### URLs not saving
- Check format: `name::url` or just `url`
- Verify pipe separator: `|`
- Maximum 100 URLs per note

### Copy feedback not showing
- Check `copyFeedback` element is created
- Verify z-index: 100000
- Check clipboard API permissions

### Notes showing in regular Notes app
- Verify `type: "secret"` is set
- Check filter in Notes app: `n.type !== 'secret'`
- See database records

### Encryption failing
- Check `TextEncoder` browser support
- Verify `btoa()` is available
- See Console for errors
- Fallback to plain text if needed

## 📝 Development Notes

### Adding New Features

**New Field:**
1. Add to edit form HTML
2. Add to `saveSecretNote()` data collection
3. Encrypt if sensitive: `encryptSecretData(value)`
4. Add to view mode display

**New Encryption Method:**
1. Update `encryptSecretData()` function
2. Update `decryptSecretData()` function
3. Keep fallback for old data
4. Test with Vietnamese text

### Security Considerations

**Current Security Level:**
- **Low**: Base64 + reverse is easily reversible
- **Purpose**: Obfuscation, not true encryption
- **Recommendation**: For sensitive data, use proper encryption (AES-256)

**Improving Security:**
1. Use Web Crypto API for AES-256 encryption
2. Derive key from password using PBKDF2
3. Add salt and IV for each encryption
4. Store encrypted data in database

**Example (AES-256):**
```javascript
async function encryptAES(text, password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    // Derive key from password
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: encoder.encode('salt'),
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );
    
    // Encrypt
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
    );
    
    return { encrypted, iv };
}
```

### Code Style

**Naming Conventions:**
- Functions: camelCase (`encryptSecretData`, `verifyPassword`)
- Constants: UPPER_SNAKE_CASE (`SECRET_PASSWORD_ENCODED`)
- CSS classes: kebab-case (`.secret-modal`, `.url-item`)

**File Organization:**
- All logic in `secret-modal.js`
- All styles in `secret-modal.css`
- HTML embedded in `hub.html`

## 🔗 Related Documentation

- `../README.md`: Global project overview
- `../PROJECT-STRUCTURE.md`: Project structure
- `../notes/README.md`: Notes app documentation

## 📞 Support

For issues or questions:
1. Check this README first
2. Check browser Console for errors
3. Verify password is correct
4. Check encryption/decryption functions

---

**Version**: 2.10.2  
**Last Updated**: February 2026  
**Part of**: BiBo Project  
**Tech Stack**: Vanilla JavaScript, MockAPI, Web Crypto API (TextEncoder/TextDecoder)
