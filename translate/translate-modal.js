// Translate Modal Logic

let translateTimeout;

function openTranslateModal() {
    document.getElementById('translateModal').classList.add('show');
    document.getElementById('translateSource').focus();
    
    // Setup event listener if not already set
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

function closeTranslateModal() {
    document.getElementById('translateModal').classList.remove('show');
}

async function translate(text) {
    const isVi = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text);
    const from = isVi ? 'vi' : 'en';
    const to = isVi ? 'en' : 'vi';
    
    try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
        const res = await fetch(url);
        const data = await res.json();
        document.getElementById('translateTarget').value = data.responseData?.translatedText || 'Error';
    } catch (e) {
        document.getElementById('translateTarget').value = 'Error';
    }
}

function copyTranslation() {
    const text = document.getElementById('translateTarget').value;
    if (text) navigator.clipboard.writeText(text);
}

function clearTranslation() {
    document.getElementById('translateSource').value = '';
    document.getElementById('translateTarget').value = '';
    document.getElementById('translateSource').focus();
}
