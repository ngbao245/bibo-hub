// Encoder Modal Logic

function openEncoderModal() {
    document.getElementById('encoderModal').classList.add('show');
    document.getElementById('apiInput').value = 'https://example.mockapi.io';
}

function closeEncoderModal() {
    document.getElementById('encoderModal').classList.remove('show');
}

function encodeAPI() {
    const input = document.getElementById('apiInput').value.trim();
    if (!input) {
        alert('Vui lòng nhập API URL');
        return;
    }
    
    // Simple encoding: Base64 + reverse
    const encoded = btoa(input.split('').reverse().join(''));
    document.getElementById('encoderOutput').textContent = encoded;
}

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
