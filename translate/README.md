# Translate Modal

Auto-detect Vietnamese/English translation modal accessible globally via Alt+T.

## 📋 Overview

Translate modal is a global modal that provides quick translation between Vietnamese and English. Features auto-detection of language and real-time translation with 500ms debounce.

## 🚀 Features

- **Auto-detect Language**: Automatically detects Vietnamese or English
- **Real-time Translation**: Translates as you type (500ms debounce)
- **Copy to Clipboard**: One-click copy of translation
- **Clear Function**: Quick clear of both input and output
- **Global Access**: Open from any page with Alt+T
- **Toggle Support**: Press Alt+T once to open, again to close

## 📁 File Structure

```
translate/
├── translate-loader.js     # Dynamic modal loader
├── translate-modal.js      # Modal logic
├── translate-modal.css     # Modal styles
└── README.md               # This file
```

## 🔧 Technical Implementation

### Language Detection (translate-modal.js)

**Auto-detect Logic:**
```javascript
async function translate(text) {
    // Detect Vietnamese characters
    const isVi = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text);
    
    // Set translation direction
    const from = isVi ? 'vi' : 'en';
    const to = isVi ? 'en' : 'vi';
    
    // Call API
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
    const res = await fetch(url);
    const data = await res.json();
    
    // Display result
    document.getElementById('translateTarget').value = data.responseData?.translatedText || 'Error';
}
```

**Debounced Input:**
```javascript
let translateTimeout;

function openTranslateModal() {
    document.getElementById('translateModal').classList.add('show');
    document.getElementById('translateSource').focus();
    
    // Setup event listener with debounce
    const sourceInput = document.getElementById('translateSource');
    if (sourceInput && !sourceInput.hasAttribute('data-listener-attached')) {
        sourceInput.oninput = function() {
            clearTimeout(translateTimeout);
            const text = this.value.trim();
            if (text) {
                translateTimeout = setTimeout(() => translate(text), 500);
            } else {
                document.getElementById('translateTarget').value = '';
            }
        };
        sourceInput.setAttribute('data-listener-attached', 'true');
    }
}
```

### Modal Loader (translate-loader.js)

**Dynamic Loading with Toggle:**
```javascript
let translateModalLoaded = false;

async function loadTranslateModal() {
    if (translateModalLoaded) return;
    
    try {
        // Detect current path
        const basePath = window.location.pathname.includes('/notes/') || 
                         window.location.pathname.includes('/tasks/') ? '../' : './';
        
        // Inject HTML
        const html = `
            <div id="translateModal" class="modal">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <span class="modal-title">Translate</span>
                        <button onclick="closeTranslateModal()" class="modal-close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="translate-container">
                            <textarea id="translateSource" placeholder="Enter text..."></textarea>
                            <div class="translate-divider">→</div>
                            <textarea id="translateTarget" placeholder="Translation..." readonly></textarea>
                        </div>
                        <div class="translate-actions">
                            <button onclick="copyTranslation()" class="btn">Copy</button>
                            <button onclick="clearTranslation()" class="btn">Clear</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container.firstElementChild);
        
        // Load CSS
        if (!document.querySelector('link[href*="translate-modal.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = basePath + 'translate/translate-modal.css';
            document.head.appendChild(link);
        }
        
        // Load JS
        if (typeof openTranslateModal === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = basePath + 'translate/translate-modal.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        translateModalLoaded = true;
    } catch (error) {
        console.error('Error loading translate modal:', error);
    }
}

// Lazy open with toggle
async function openTranslateModalLazy() {
    await loadTranslateModal();
    
    const modal = document.getElementById('translateModal');
    
    // Toggle
    if (modal && modal.classList.contains('show')) {
        if (typeof closeTranslateModal === 'function') {
            closeTranslateModal();
        } else {
            modal.classList.remove('show');
        }
    } else if (modal) {
        if (typeof openTranslateModal === 'function') {
            openTranslateModal();
        } else {
            modal.classList.add('show');
        }
    }
}
```

### Key Functions

- `openTranslateModal()`: Open modal and focus input
- `closeTranslateModal()`: Close modal
- `translate(text)`: Auto-detect language and translate
- `copyTranslation()`: Copy translation to clipboard
- `clearTranslation()`: Clear both input and output

## 🎨 Styling

### Key CSS Classes
- `.modal`: Modal container (z-index: 10000)
- `.translate-container`: Input/output container
- `.translate-divider`: Arrow between input/output
- `.translate-actions`: Button container

### Layout
```
┌─────────────────────────────────────┐
│ Translate                         × │
├─────────────────────────────────────┤
│ ┌─────────────┐   →   ┌──────────┐ │
│ │ Input       │       │ Output   │ │
│ │ (editable)  │       │ (readonly)│ │
│ └─────────────┘       └──────────┘ │
│                                     │
│         [Copy]  [Clear]             │
└─────────────────────────────────────┘
```

## 🔌 Dependencies

### External
- `../common.css`: Shared styles
- MyMemory Translation API: Free translation service

### Integration
- Loaded via `translate-loader.js` in all pages
- Registered in `shortcuts-config.js` with Alt+T
- Handled by `global-shortcuts.js`

## 🚀 Usage

### Opening Modal
1. Press `Alt+T` from any page
2. Or click "Translate" button in Hub
3. Modal opens with focus on input

### Translating
1. Type text in left textarea
2. Wait 500ms (debounce)
3. Translation appears in right textarea
4. Auto-detects Vietnamese or English

### Copying Translation
1. Click "Copy" button
2. Translation copied to clipboard

### Closing Modal
1. Press `Alt+T` again (toggle)
2. Press `Escape`
3. Click × button
4. Click outside modal

## ⚙️ Configuration

### Translation API
Uses MyMemory Translation API (free, no API key required):
```javascript
const url = `https://api.mymemory.translated.net/get?q=${text}&langpair=${from}|${to}`;
```

**API Limits:**
- Free tier: 1000 requests/day
- No authentication required
- Supports 100+ languages

### Changing Translation Service
To use different API (e.g., Google Translate):
```javascript
async function translate(text) {
    const isVi = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text);
    const from = isVi ? 'vi' : 'en';
    const to = isVi ? 'en' : 'vi';
    
    // Replace with your API
    const url = `https://your-api.com/translate?text=${text}&from=${from}&to=${to}`;
    const res = await fetch(url);
    const data = await res.json();
    
    document.getElementById('translateTarget').value = data.translation;
}
```

### Debounce Timing
Change debounce delay (default 500ms):
```javascript
translateTimeout = setTimeout(() => translate(text), 1000); // 1 second
```

## 🐛 Troubleshooting

### Translation not working
- Check internet connection
- Verify MyMemory API is accessible
- Check Console for API errors
- API may have rate limits (1000/day)

### Modal not opening
- Check `translate-loader.js` is loaded
- Verify Alt+T is registered in `shortcuts-config.js`
- Check Console for errors

### Vietnamese not detected
- Verify regex pattern includes all Vietnamese characters
- Check text has at least one Vietnamese character
- Test with: `àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ`

### Debounce too fast/slow
- Adjust timeout value (500ms default)
- Too fast: More API calls, may hit rate limit
- Too slow: Slower user experience

## 📝 Development Notes

### Adding New Language Pair

**Example: Add French:**
```javascript
async function translate(text) {
    // Detect language
    const isVi = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text);
    const isFr = /[àâæçéèêëïîôùûüÿœ]/i.test(text);
    
    let from, to;
    if (isVi) {
        from = 'vi';
        to = 'en';
    } else if (isFr) {
        from = 'fr';
        to = 'en';
    } else {
        from = 'en';
        to = 'vi'; // or 'fr'
    }
    
    // Rest of code...
}
```

### Performance Optimization
- Debounce prevents excessive API calls
- Event listener attached only once (check `data-listener-attached`)
- Modal loads lazily (only when first opened)

## 🔗 Related Documentation

- `../README.md`: Global project overview
- `../PROJECT-STRUCTURE.md`: Project structure
- `../shortcut/GLOBAL-MODAL-POPUP-GUIDE.md`: How to create global modals

## 📞 Support

For issues or questions:
1. Check this README first
2. Verify internet connection
3. Check Console for API errors
4. Check MyMemory API status

---

**Version**: 2.10.2  
**Last Updated**: February 2026  
**Part of**: BiBo Project  
**Tech Stack**: Vanilla JavaScript, MyMemory Translation API
