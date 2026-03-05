const LEADING_CONTEXT_PATTERNS = [
    /^(h(?:ô|o)m nay|hnay|nay)\s+/i,
    /^(tôi|toi|t|tao|mình|minh|mk|tui)\s+/i,
    /^(còn|con)\s+/i,
    /^(vừa|mới)\s+/i,
    /^(mua|chi|tiêu|trả|đổ)\s+/i,
    /^(cho|vô|vo|vào|vao)\s+/i,
];

const NOISE_WORDS_RE = /\b(hết|het|mất|mat|nữa|nua|rồi|roi)\b/gi;

const TRAILING_CONTEXT_WORDS_RE = /\b(mua|chi|tiêu|trả|đổ|cho|vô|vào)\b\s*$/i;

function stripExpenseContext(text) {
    let s = String(text || '').replace(/\s+/g, ' ').trim();
    let prev = '';

    while (s && s !== prev) {
        prev = s;
        for (const re of LEADING_CONTEXT_PATTERNS) {
            s = s.replace(re, '').trim();
        }
    }

    // bỏ các từ đệm còn sót
    s = s.replace(NOISE_WORDS_RE, ' ').replace(/\s+/g, ' ').trim();

    // bỏ động từ bị treo ở cuối kiểu: "switch mua", "keycap chi"
    s = s.replace(TRAILING_CONTEXT_WORDS_RE, '').replace(/\s+/g, ' ').trim();

    return s;
}

function smartTitleCase(s) {
    return s
        .split(' ')
        .map(word => {
            if (!word) return word;
            if (/^[A-Z0-9]{2,}$/.test(word)) return word;
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
}

function normalizeForMatch(s) {
    return ` ${String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()} `;
}

function hasAnyPhrase(text, phrases) {
    return phrases.some(p => text.includes(` ${p} `));
}