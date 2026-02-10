# Encoder Modal

Encode API URLs with Base64 + reverse for config.js, supports Unicode/Vietnamese.

## 📋 Overview

Encoder modal provides a simple way to encode API URLs for use in `config.js`. Uses Base64 encoding with reverse obfuscation and supports Unicode/Vietnamese characters.

## 🚀 Features

- **Unicode Support**: Encodes Vietnamese and special characters correctly
- **Base64 + Reverse**: Simple obfuscation method
- **Copy to Clipboard**: One-click copy of encoded string
- **Usage Instructions**: Vietnamese instructions included
- **Global Access**: Open from any page with Alt+E
- **Toggle Support**: Press Alt+E once to open, again to close

## 📁 File Structure

```
encoder/
├── encoder-loader.js       # Dynamic modal loader
├── encoder-modal.js        # Modal logic
├── encoder-modal.css       # Modal styles
└── README.md               # This file
```

## 🔧 Technical Implementation

### Encoding Function (encoder-modal.js)

**Unicode Support:**
```javascript
function encodeAPI() {
    const input = document.getElementById('apiInput').value.trim();
    if (!input) {
        alert('Vui lòng nhập API URL');
        return;
    }
    
    try {
        // Step 1: Convert Unicode to UTF-8 bytes
        const utf8Bytes = new TextEncoder().encode(input);
        
        // Step 2: Convert bytes to binary string
        let binaryString = '';
        utf8Bytes.forEach(byte => {
            binaryString += String.fromCharCode(byte);
        });
        
        // Step 3: Base64 encode + reverse
        const encoded = btoa(binaryString.split('').reverse().join(''));
        document.getElementById('encoderOutput').textContent = encoded;
    } catch (error) {
        alert('Lỗi mã hóa: ' + error.message);
    }
}
```

**Why This Approach:**
- `btoa()` only supports ASCII (fails with Vietnamese)
- `TextEncoder` converts Unicode → UTF-8 bytes
- Convert bytes → binary string → Base64
- Reverse for simple obfuscation
- Works with Vietnamese: `https://api.mockapi.io/việt-nam`

### Copy to Clipboard

**Copy Function:**
```javascript
function copyEncoderOutput() {
    const output = document.getElementById('encoderOutput');
    const text = output.textContent;
    
    if (!text || text === '✓ Copied!') {
        return;
    }
    
    navigator.clipboard.writeText(text).then(() => {
        const originalText = output.textContent;
        output.textContent = '✓ Copied!';
        output.style.color = 'var(--color-success)';
        setTimeout(() => {
            output.textContent = originalText;
            output.style.color = 'var(--color-accent-secondary)';
        }, 1000);
    }).catch(() => {
        // Fallback for older browsers
        const range = document.createRange();
        range.selectNodeContents(output);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    });
}
```

### Modal Loader (encoder-loader.js)

**Dynamic Loading with Toggle:**
```javascript
let encoderModalLoaded = false;

async function loadEncoderModal() {
    if (encoderModalLoaded) return;
    
    try {
        const basePath = window.location.pathname.includes('/notes/') || 
                         window.location.pathname.includes('/tasks/') ? '../' : './';
        
        // Inject HTML with Vietnamese instructions
        const html = `
            <div id="encoderModal" class="modal">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <span class="modal-title">API Encoder</span>
                        <button onclick="closeEncoderModal()" class="modal-close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="encoder-instructions">
                            <h3>Hướng dẫn sử dụng:</h3>
                            <ol>
                                <li>Nhập API URL vào ô bên dưới</li>
                                <li>Nhấn "Encode" để mã hóa</li>
                                <li>Copy chuỗi đã mã hóa</li>
                                <li>Paste vào <code>config.js</code> → <code>ENCODED</code></li>
                            </ol>
                        </div>
                        <div class="form-group">
                            <label>API URL:</label>
                            <input type="text" id="apiInput" placeholder="https://example.mockapi.io">
                        </div>
                        <button onclick="encodeAPI()" class="btn btn-primary">Encode</button>
                        <div class="encoder-output-container">
                            <label>Encoded String (click to copy):</label>
                            <div id="encoderOutput" class="encoder-output" onclick="copyEncoderOutput()">
                                Nhấn "Encode" để mã hóa
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container.firstElementChild);
        
        // Load CSS
        if (!document.querySelector('link[href*="encoder-modal.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = basePath + 'encoder/encoder-modal.css';
            document.head.appendChild(link);
        }
        
        // Load JS
        if (typeof openEncoderModal === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = basePath + 'encoder/encoder-modal.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        encoderModalLoaded = true;
    } catch (error) {
        console.error('Error loading encoder modal:', error);
    }
}

// Lazy open with toggle
async function openEncoderModalLazy() {
    await loadEncoderModal();
    
    const modal = document.getElementById('encoderModal');
    
    if (modal && modal.classList.contains('show')) {
        if (typeof closeEncoderModal === 'function') {
            closeEncoderModal();
        } else {
            modal.classList.remove('show');
        }
    } else if (modal) {
        if (typeof openEncoderModal === 'function') {
            openEncoderModal();
        } else {
            modal.classList.add('show');
        }
    }
}
```

### Key Functions

- `openEncoderModal()`: Open modal with default URL
- `closeEncoderModal()`: Close modal
- `encodeAPI()`: Encode input URL with Unicode support
- `copyEncoderOutput()`: Copy encoded string to clipboard

## 🎨 Styling

### Key CSS Classes
- `.modal`: Modal container (z-index: 10000)
- `.encoder-instructions`: Vietnamese instructions
- `.encoder-output-container`: Output display area
- `.encoder-output`: Clickable output (copy on click)

### Layout
```
┌─────────────────────────────────────┐
│ API Encoder                       × │
├─────────────────────────────────────┤
│ Hướng dẫn sử dụng:                  │
│ 1. Nhập API URL...                  │
│ 2. Nhấn "Encode"...                 │
│                                     │
│ API URL:                            │
│ [https://example.mockapi.io      ] │
│                                     │
│ [Encode]                            │
│                                     │
│ Encoded String (click to copy):    │
│ ┌─────────────────────────────────┐ │
│ │ base64_encoded_string_here...   │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## 🔌 Dependencies

### External
- `../common.css`: Shared styles

### Integration
- Loaded via `encoder-loader.js` in all pages
- Registered in `shortcuts-config.js` with Alt+E
- Handled by `global-shortcuts.js`

## 🚀 Usage

### Encoding API URL

1. **Open Modal**: Press `Alt+E` or click "Encoder" in Hub
2. **Enter URL**: Type API URL (e.g., `https://api.mockapi.io/notes`)
3. **Encode**: Click "Encode" button
4. **Copy**: Click on encoded string to copy
5. **Paste**: Open `config.js` and paste into `ENCODED` field

### Example Workflow

**Before:**
```javascript
// config.js
const API_CONFIG = {
    ENCODED: 'old_encoded_string',
    // ...
};
```

**Steps:**
1. Open Encoder (Alt+E)
2. Enter: `https://6725c1bc3e17a3ac846e.mockapi.io`
3. Click "Encode"
4. Copy: `b2kuaXBha2NvbS43MmM1MWJlZmNlYTFhOTg4ZTcwMWM3OTYvLzpzcHR0aA==`
5. Paste into config.js

**After:**
```javascript
// config.js
const API_CONFIG = {
    ENCODED: 'b2kuaXBha2NvbS43MmM1MWJlZmNlYTFhOTg4ZTcwMWM3OTYvLzpzcHR0aA==',
    // ...
};
```

## ⚙️ Configuration

### Default URL
Change default URL in `openEncoderModal()`:
```javascript
function openEncoderModal() {
    document.getElementById('encoderModal').classList.add('show');
    document.getElementById('apiInput').value = 'https://your-default-url.com';
}
```

### Encoding Method
Current method: Base64 + Reverse (simple obfuscation)

**To use stronger encryption:**
```javascript
// Use Web Crypto API for AES-256
async function encodeAPI() {
    const input = document.getElementById('apiInput').value.trim();
    
    // Generate key from password
    const password = 'your-secret-key';
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
    );
    
    // Derive encryption key
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
        encoder.encode(input)
    );
    
    // Convert to base64
    const encryptedArray = new Uint8Array(encrypted);
    const encoded = btoa(String.fromCharCode(...encryptedArray));
    
    document.getElementById('encoderOutput').textContent = encoded;
}
```

## 🐛 Troubleshooting

### Encoding fails with Vietnamese
- Verify `TextEncoder` is used
- Check browser supports `TextEncoder` (all modern browsers)
- Test with: `https://api.com/việt-nam`

### Copy not working
- Check clipboard API permissions
- Verify HTTPS (clipboard API requires secure context)
- Fallback to manual selection if API fails

### Modal not opening
- Check `encoder-loader.js` is loaded
- Verify Alt+E is registered in `shortcuts-config.js`
- Check Console for errors

### Encoded string too long
- Base64 increases size by ~33%
- Reverse doesn't change length
- Consider URL shortening service if needed

## 📝 Development Notes

### Security Considerations

**Current Security Level:**
- **Low**: Base64 + reverse is easily reversible
- **Purpose**: Obfuscation, not encryption
- **Recommendation**: For production, use proper encryption (AES-256)

**Improving Security:**
1. Use Web Crypto API for AES-256 encryption
2. Derive key from password using PBKDF2
3. Add salt and IV for each encryption
4. Store encrypted data in config.js

### Performance
- Encoding is instant (< 1ms)
- No API calls required
- Works offline

### Browser Compatibility
- `TextEncoder`: All modern browsers (Chrome 38+, Firefox 18+, Safari 10.1+)
- `btoa()`: All browsers
- `navigator.clipboard`: HTTPS required

## 🔗 Related Documentation

- `../README.md`: Global project overview
- `../PROJECT-STRUCTURE.md`: Project structure
- `../config.js`: Where encoded URLs are used
- `../shortcut/GLOBAL-MODAL-POPUP-GUIDE.md`: How to create global modals

## 📞 Support

For issues or questions:
1. Check this README first
2. Verify browser supports `TextEncoder`
3. Check Console for errors
4. Test with simple ASCII URL first

---

**Version**: 2.10.2  
**Last Updated**: February 2026  
**Part of**: BiBo Project  
**Tech Stack**: Vanilla JavaScript, Web Crypto API (TextEncoder)
