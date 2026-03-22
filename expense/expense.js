// Expense App — chat-style spending tracker
const API = API_CONFIG.NOTES;
const EXPENSE_TYPE = 'expense';

// Categories
const CATEGORIES = {
    food: { label: 'Ăn uống', icon: '🍜' },
    transport: { label: 'Di chuyển', icon: '🛵' },
    shopping: { label: 'Mua sắm', icon: '🛍️' },
    tech: { label: 'Công nghệ', icon: '💻' },
    travel: { label: 'Du lịch', icon: '✈️' },
    gift: { label: 'Quà tặng', icon: '🎁' },
    course: { label: 'Khóa học', icon: '📖' },
    health: { label: 'Sức khỏe', icon: '💊' },
    other: { label: 'Khác', icon: '📌' },
};

// Category colors for left border
const CAT_COLORS = {
    food: '#ff7043',
    transport: '#42a5f5',
    shopping: '#ab47bc',
    tech: '#26c6da',
    travel: '#26a69a',
    gift: '#ec407a',
    course: '#7e57c2',
    health: '#66bb6a',
    other: '#78909c',
};

let allExpenses = [];
let dayRecords = {};
let currentPeriod = 'today';
let currentTab = 'feed';
let isLoading = true;
let undoTimer = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
    setupTabs();
    setupFeedList();
    setupReportPanel();
    setupInput();
    applyChatSide();
    updateMoodIndicator();
    render();
    await loadExpenses();
    isLoading = false;
    render();
    restoreChatSession();
    document.getElementById('chatInput').focus();
}

// ─── Schema ───────────────────────────────────────────────────────────────────
// 1 record per day in notes table, type="expense"
// source = YYYY-MM-DD
// content = JSON array: [{id, name, amount, category, time, raw}, ...]

function parseRecord(r) {
    try { return JSON.parse(r.content || '[]'); } catch { return []; }
}

function serializeItems(items) {
    return JSON.stringify(items);
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function loadExpenses() {
    try {
        const res = await fetch(`${API}?limit=200`);
        const data = await res.json();
        const records = Array.isArray(data) ? data.filter(d => d.type === EXPENSE_TYPE) : [];

        dayRecords = {};
        allExpenses = [];

        records.forEach(r => {
            const date = r.source;
            dayRecords[date] = { id: r.id, content: r.content };
            const items = parseRecord(r);
            items.forEach(it => allExpenses.push({ ...it, date }));
        });

        allExpenses.sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
    } catch (e) {
        console.error('Load error:', e);
    }
}

async function saveDayRecord(date, items) {
    const content = serializeItems(items);
    const existing = dayRecords[date];

    const body = {
        type: EXPENSE_TYPE,
        title: date,
        source: date,
        content,
        url1: '', url2: '', tags: '',
    };

    const res = await fetch(
        existing?.id ? `${API}/${existing.id}` : API,
        {
            method: existing?.id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }
    );
    const saved = await res.json();
    dayRecords[date] = { id: saved.id, content };
}

async function deleteDayRecord(date) {
    const rec = dayRecords[date];
    if (rec?.id) await fetch(`${API}/${rec.id}`, { method: 'DELETE' });
    delete dayRecords[date];
}

// ─── Name normalization ───────────────────────────────────────────────────────

// Common typos / shorthand → correct Vietnamese
const TYPO_MAP = [
    [/\bquan\b/gi, 'quần'],
    [/\baó\b/gi, 'áo'],
    [/\bgiay\b/gi, 'giày'],
    [/\btui\b/gi, 'túi'],
    [/\bca phe\b/gi, 'cà phê'],
    [/\bcafe\b/gi, 'cà phê'],
    [/\bcom\b/gi, 'cơm'],
    [/\bpho\b/gi, 'phở'],
    [/\bbun\b/gi, 'bún'],
    [/\bga\b/gi, 'gà'],
    [/\bxang\b/gi, 'xăng'],
    [/\bnuoc\b/gi, 'nước'],
    [/\bbanh\b/gi, 'bánh'],
    [/\btra\b/gi, 'trà'],
    [/\bbia\b/gi, 'bia'],
];

function normalizeName(raw) {
    let s = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';

    s = stripExpenseContext(s);

    // bỏ số lượng đầu câu nếu có
    s = s.replace(/^\d+\s*(cái|cặp|đôi|x|chiếc)?\s*/i, '').trim();

    TYPO_MAP.forEach(([pattern, replacement]) => {
        s = s.replace(pattern, replacement);
    });

    s = s.replace(/^["'“”]+|["'“”]+$/g, '').trim();
    s = smartTitleCase(s);

    return s || String(raw || '').trim();
}

// ─── AI Parse ─────────────────────────────────────────────────────────────────

// Fallback: local regex parse nếu không có AI key
function localParse(text) {
    let amount = 0;
    let amountStr = '';

    // Ưu tiên bắt dạng:
    // 1tr2, 1tr25, 1tr250, 1 triệu 2, 1 triệu 250
    const trTailMatch = text.match(/(\d[\d.,]*)\s*(tr|triệu|trieu|củ|cu)\s*(\d{1,3})\b/i);

    // Dạng đơn:
    // 1tr, 1.2tr, 1 triệu
    const trMatch = text.match(/(\d[\d.,]*)\s*(tr|triệu|trieu|củ|cu)\b/i);

    const kMatch = text.match(/(\d[\d.,]*)\s*(k|ngàn|ngan|nghìn|nghin)\b/i);
    const bigMatch = text.match(/\b(\d{4,})\b/);
    const smallMatch = text.match(/\b(\d{2,3})\b/);

    if (trTailMatch) {
        amountStr = trTailMatch[0]; // vd: "1tr2", "1 triệu 2"
        amount = parseMillionWithTail(trTailMatch[1], trTailMatch[3]);
    } else if (trMatch) {
        amountStr = trMatch[0]; // vd: "1tr", "1.2tr", "1 triệu"
        amount = Math.round(parseFloat(trMatch[1].replace(/,/g, '.')) * 1000000);
    } else if (kMatch) {
        amountStr = kMatch[0]; // vd: "70k", "70 ngàn"
        amount = Math.round(parseFloat(kMatch[1].replace(/,/g, '.')) * 1000);
    } else if (bigMatch) {
        amountStr = bigMatch[0];
        amount = parseInt(bigMatch[1].replace(/\./g, ''), 10);
    } else if (smallMatch) {
        const isLeadingQty =
            /^\d+\s+\D/.test(text.trim()) &&
            smallMatch.index === text.search(/\d/);

        if (!isLeadingQty) {
            amountStr = smallMatch[0];
            amount = parseInt(smallMatch[1], 10) * 1000;
        }
    }

    const rawName = amountStr ? text.replace(amountStr, ' ') : text;
    const name = normalizeName(rawName);

    const matchText = normalizeForMatch(`${text} ${name}`);

    let category = 'other';

    if (hasAnyPhrase(matchText, [
        'ca phe', 'cafe', 'tra sua', 'tra', 'nuoc', 'boba', 'milk tea', 'bia'
    ])) {
        category = 'drink';
    } else if (hasAnyPhrase(matchText, [
        'an', 'com', 'pho', 'bun', 'ga', 'bo', 'heo', 'pizza', 'burger',
        'banh', 'xoi', 'che', 'lau', 'nuong', 'sushi', 'bua', 'quan an'
    ])) {
        category = 'food';
    } else if (hasAnyPhrase(matchText, [
        'xang', 'grab', 'xe', 'taxi', 'bus', 'xe buyt', 'ship', 'giao hang', 've'
    ])) {
        category = 'transport';
    } else if (hasAnyPhrase(matchText, [
        'shop', 'quan', 'ao', 'giay', 'tui', 'keycap', 'ban phim',
        'chuot', 'man', 'tai nghe', 'switch', 'phu kien'
    ])) {
        category = 'shopping';
    } else if (hasAnyPhrase(matchText, [
        'dien thoai', 'laptop', 'may tinh', 'sac', 'cap', 'ram', 'ssd',
        'man hinh', 'phan mem', 'app', 'game'
    ])) {
        category = 'tech';
    } else if (hasAnyPhrase(matchText, [
        'thuoc', 'bac si', 'kham', 'benh vien', 'vitamin', 'gym', 'spa', 'the thao'
    ])) {
        category = 'health';
    } else if (hasAnyPhrase(matchText, [
        'tien dien', 'dien', 'tien nuoc', 'nuoc', 'internet', 'wifi',
        'tien nha', 'thue nha', 'bao hiem', 'hoc phi', 'bill'
    ])) {
        category = 'bill';
    }

    return { name, amount, category };
}

function parseMillionWithTail(headRaw, tailRaw) {
    const head = parseFloat(String(headRaw).replace(/,/g, '.'));
    if (!Number.isFinite(head)) return 0;

    let amount = Math.round(head * 1000000);

    if (!tailRaw) return amount;

    const tail = String(tailRaw).replace(/\D/g, '');
    if (!tail) return amount;

    // 1tr2   = 1.200.000
    // 1tr25  = 1.250.000
    // 1tr250 = 1.250.000
    if (tail.length === 1) {
        amount += parseInt(tail, 10) * 100000;
    } else if (tail.length === 2) {
        amount += parseInt(tail, 10) * 10000;
    } else {
        amount += parseInt(tail.slice(0, 3), 10) * 1000;
    }

    return amount;
}

// ─── Submit ───────────────────────────────────────────────────────────────────

async function submitExpense() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    autoResizeInput(input);
    setInputDisabled(true);

    // Show user message bubble
    appendUserBubble(text);

    // Show AI typing indicator
    const thinkId = showTyping();

    try {
        const parsed = localParse(text);
        removeThinking(thinkId);

        if (!parsed.amount) {
            appendAIBubble('Ờ... tôi không hiểu bạn chi bao nhiêu. Thử kiểu "cà phê 35k" hoặc "xăng 50" nhé 😅');
            setInputDisabled(false);
            return;
        }

        const now = new Date();
        const date = toLocalDate(now);
        const exp = {
            id: 'temp_' + Date.now(),
            name: parsed.name || text,
            amount: parsed.amount,
            category: parsed.category || 'other',
            date,
            time: now.toTimeString().slice(0, 5),
            raw: text,
        };

        // Optimistic add to data
        allExpenses.unshift(exp);
        addMoodBonus(exp.amount);
        render();

        // Generate AI reply (non-blocking)
        const replyThinkId = showTyping();
        const reply = await aiReply(exp, text);
        removeThinking(replyThinkId);
        appendAIBubble(reply);

        // Save to API — lấy tất cả items của ngày (trừ item vừa thêm để tránh duplicate)
        const { date: _d, ...expNoDate } = exp;
        const dayItems = allExpenses
            .filter(e => e.date === date && e.id !== exp.id)
            .map(({ date: _d2, ...rest }) => rest);
        await saveDayRecord(date, [...dayItems, expNoDate]);

    } catch (e) {
        removeThinking(thinkId);
        appendAIBubble('Ối, có lỗi gì đó rồi. Thử lại đi bạn ơi 😬');
        console.error(e);
    }

    setInputDisabled(false);
}

function setInputDisabled(disabled) {
    const input = document.getElementById('chatInput');
    const btn = document.getElementById('sendBtn');
    const icon = document.getElementById('sendIcon');
    input.disabled = disabled;
    btn.disabled = disabled;
    icon.innerHTML = disabled ? '<span class="spin">⟳</span>' : '↑';
    if (!disabled) input.focus();
}

// ─── Render ───────────────────────────────────────────────────────────────────

function render() {
    renderFeed();
    renderExpenseList();
    if (currentTab === 'report') renderReport();
}

function getFilteredExpenses() {
    const now = new Date();
    const today = toLocalDate(now);
    return allExpenses.filter(e => {
        if (currentPeriod === 'today') return e.date === today;
        if (currentPeriod === 'week') {
            const d = new Date(e.date + 'T00:00:00');
            const diff = (now - d) / 86400000;
            return diff >= 0 && diff < 7;
        }
        if (currentPeriod === 'month') return e.date.slice(0, 7) === today.slice(0, 7);
        return true;
    });
}

function renderFeed() {
    // Chat feed chỉ hiển thị welcome nếu chưa có bubble nào — không render expense list vào đây
    const feed = document.getElementById('chatFeed');
    if (!feed) return;
    // Chỉ show welcome nếu feed trống (không có bubble user/AI)
    const hasBubbles = feed.querySelector('.user-bubble, .ai-bubble, .expense-bubble');
    if (!hasBubbles && !feed.querySelector('.chat-welcome')) {
        feed.innerHTML = `<div class="chat-welcome">
            <div class="welcome-icon">💬</div>
            <div class="welcome-text">Nhập chi tiêu tự nhiên<br><span class="welcome-hint">vd: "keycap 555k" hoặc "đi ăn gà 120"</span></div>
        </div>`;
    }
}

function renderSummary() {
    const expenses = getFilteredExpenses();
    const total = expenses.reduce((s, e) => s + e.amount, 0);

    document.getElementById('totalAmount').textContent = formatAmount(total);
    document.getElementById('totalCount').textContent = expenses.length;

    // Category breakdown
    const catTotals = {};
    expenses.forEach(e => {
        catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
    });

    const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 4);
    document.getElementById('summaryCats').innerHTML = sorted.map(([cat, amt]) => {
        const c = CATEGORIES[cat] || CATEGORIES.other;
        return `<div class="cat-chip">
            <span class="cat-chip-icon">${c.icon}</span>
            <span>${c.label}</span>
            <span class="cat-chip-amount">${formatAmount(amt)}</span>
        </div>`;
    }).join('');
}

// ─── AI Reply ─────────────────────────────────────────────────────────────────

async function aiReply(exp) {
    const todayTotal = allExpenses
        .filter(e => e.date === exp.date)
        .reduce((s, e) => s + e.amount, 0);
    return localReply(exp, todayTotal);
}

function localReply(exp, todayTotal) {
    return getLocalReply(
        exp.category,
        exp.name || 'Món này',
        formatAmount(exp.amount),
        formatAmount(todayTotal)
    );
}

// ─── Chat session persistence ─────────────────────────────────────────────────

const CHAT_SESSION_KEY = 'expense_chat_session';

function saveChatSession() {
    const feed = document.getElementById('chatFeed');
    if (!feed) return;
    const messages = [];
    feed.querySelectorAll('.user-bubble, .ai-bubble').forEach(el => {
        if (el.classList.contains('typing-bubble')) return;
        if (el.classList.contains('user-bubble')) {
            messages.push({ role: 'user', text: el.textContent });
        } else {
            const textEl = el.querySelector('.ai-text');
            messages.push({ role: 'ai', text: textEl ? textEl.textContent : el.textContent });
        }
    });
    sessionStorage.setItem(CHAT_SESSION_KEY, JSON.stringify(messages));
}

function restoreChatSession() {
    const raw = sessionStorage.getItem(CHAT_SESSION_KEY);
    if (!raw) return;
    try {
        const messages = JSON.parse(raw);
        if (!messages.length) return;
        const feed = document.getElementById('chatFeed');
        if (!feed) return;
        feed.querySelector('.chat-welcome')?.remove();
        messages.forEach(m => {
            const el = document.createElement('div');
            if (m.role === 'user') {
                el.className = 'user-bubble';
                el.textContent = m.text;
            } else {
                el.className = 'ai-bubble';
                el.innerHTML = `<span class="ai-avatar">🤖</span><span class="ai-text">${esc(m.text)}</span>`;
            }
            feed.appendChild(el);
        });
        feed.scrollTop = feed.scrollHeight;
    } catch (e) {
        sessionStorage.removeItem(CHAT_SESSION_KEY);
    }
}

// ─── Chat bubbles ─────────────────────────────────────────────────────────────

function appendUserBubble(text) {
    const feed = document.getElementById('chatFeed');
    // Remove welcome screen if present
    feed.querySelector('.chat-welcome')?.remove();
    const el = document.createElement('div');
    el.className = 'user-bubble';
    el.textContent = text;
    feed.appendChild(el);
    feed.scrollTop = feed.scrollHeight;
    saveChatSession();
}

function appendAIBubble(text) {
    const feed = document.getElementById('chatFeed');
    const el = document.createElement('div');
    el.className = 'ai-bubble';
    el.innerHTML = `<span class="ai-avatar">🤖</span><span class="ai-text">${esc(text)}</span>`;
    feed.appendChild(el);
    feed.scrollTop = feed.scrollHeight;
    saveChatSession();
}

function showTyping() {
    const id = 'think_' + (++thinkCounter);
    const feed = document.getElementById('chatFeed');
    const el = document.createElement('div');
    el.className = 'ai-bubble typing-bubble';
    el.id = id;
    el.innerHTML = `<span class="ai-avatar">🤖</span>
        <div class="thinking-dots"><span></span><span></span><span></span></div>`;
    feed.appendChild(el);
    feed.scrollTop = feed.scrollHeight;
    return id;
}

// ─── Thinking / Error bubbles ─────────────────────────────────────────────────

let thinkCounter = 0;
function showThinking(text) {
    const id = 'think_' + (++thinkCounter);
    const feed = document.getElementById('chatFeed');
    const el = document.createElement('div');
    el.className = 'thinking-bubble';
    el.id = id;
    el.innerHTML = `<span>${esc(text)}</span>
        <div class="thinking-dots"><span></span><span></span><span></span></div>`;
    feed.appendChild(el);
    feed.scrollTop = feed.scrollHeight;
    return id;
}

function removeThinking(id) {
    document.getElementById(id)?.remove();
}

function showError(msg) {
    const feed = document.getElementById('chatFeed');
    const el = document.createElement('div');
    el.className = 'error-bubble';
    el.textContent = msg;
    feed.appendChild(el);
    feed.scrollTop = feed.scrollHeight;
    setTimeout(() => el.remove(), 4000);
}

// ─── Inline edit name ─────────────────────────────────────────────────────────

function inlineEditName(el, id) {
    if (el.querySelector('input')) return;
    const exp = allExpenses.find(e => e.id === id);
    if (!exp) return;

    const input = document.createElement('input');
    input.className = 'inline-name-input';
    input.value = exp.name;

    const save = async () => {
        const val = input.value.trim();
        if (val && val !== exp.name) {
            exp.name = val;
            const date = exp.date;
            const items = allExpenses.filter(e => e.date === date).map(({ date: _d, ...rest }) => rest);
            await saveDayRecord(date, items);
        }
        render();
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') render();
    });

    el.replaceWith(input);
    input.focus();
    input.select();
}

// ─── Category context menu ────────────────────────────────────────────────────

let catMenuTarget = null;

function openCatMenu(e, id) {
    e.preventDefault();
    // Toggle: nếu đang mở cho cùng item thì đóng
    if (catMenuTarget === id && document.getElementById('catMenu')) {
        closeCatMenu();
        return;
    }
    closeCatMenu();
    catMenuTarget = id;

    const menu = document.createElement('div');
    menu.id = 'catMenu';
    menu.className = 'cat-menu';
    menu.innerHTML = Object.entries(CATEGORIES).map(([key, c]) =>
        `<div class="cat-menu-item" onclick="selectCategory('${id}','${key}')">
            <span>${c.icon}</span><span>${c.label}</span>
        </div>`
    ).join('');

    // Position near cursor
    menu.style.left = Math.min(e.clientX, window.innerWidth - 180) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - 280) + 'px';
    document.body.appendChild(menu);

    setTimeout(() => document.addEventListener('click', closeCatMenu, { once: true }), 0);
}

function closeCatMenu() {
    document.getElementById('catMenu')?.remove();
    catMenuTarget = null;
}

async function selectCategory(id, category) {
    closeCatMenu();
    const exp = allExpenses.find(e => e.id === id);
    if (!exp) return;

    exp.category = category;
    render();

    // Rewrite day record
    const date = exp.date;
    const items = allExpenses.filter(e => e.date === date).map(({ date: _d, ...rest }) => rest);
    await saveDayRecord(date, items);
}

// ─── Delete with undo ─────────────────────────────────────────────────────────

function deleteWithUndo(id) {
    const exp = allExpenses.find(e => e.id === id);
    if (!exp) return;

    // Remove from UI immediately
    const snapshot = [...allExpenses];
    allExpenses = allExpenses.filter(e => e.id !== id);
    render();

    // Show undo toast
    showUndoToast(exp.name, async () => {
        // Undo: restore
        allExpenses = snapshot;
        render();
    }, async () => {
        // Confirm delete after timeout
        const date = exp.date;
        const remaining = allExpenses.filter(e => e.date === date).map(({ date: _d, ...rest }) => rest);
        if (remaining.length === 0) await deleteDayRecord(date);
        else await saveDayRecord(date, remaining);
    });
}

async function confirmDelete(id) {
    const exp = allExpenses.find(e => e.id === id);
    if (!exp) return;
    const date = exp.date;
    allExpenses = allExpenses.filter(e => e.id !== id);
    render();
    const remaining = allExpenses.filter(e => e.date === date).map(({ date: _d, ...rest }) => rest);
    if (remaining.length === 0) await deleteDayRecord(date);
    else await saveDayRecord(date, remaining);
}

function showUndoToast(name, onUndo, onConfirm) {
    document.getElementById('undoToast')?.remove();
    if (undoTimer) clearTimeout(undoTimer);

    const toast = document.createElement('div');
    toast.id = 'undoToast';
    toast.className = 'undo-toast';
    toast.innerHTML = `<span>Đã xóa "${esc(name)}"</span>
        <button onclick="undoDelete()">Hoàn tác</button>`;
    document.body.appendChild(toast);

    // Store callbacks
    toast._onUndo = onUndo;
    toast._onConfirm = onConfirm;

    undoTimer = setTimeout(() => {
        toast._onConfirm?.();
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

async function undoDelete() {
    const toast = document.getElementById('undoToast');
    if (!toast) return;
    if (undoTimer) clearTimeout(undoTimer);
    await toast._onUndo?.();
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 300);
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function setupTabs() {
    // Restore tab from URL param
    const urlTab = new URLSearchParams(location.search).get('tab');
    if (urlTab) {
        currentTab = urlTab;
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`tab-${currentTab}`).classList.add('active');
            // Update URL param without reload
            try {
                const url = new URL(location.href);
                url.searchParams.set('tab', currentTab);
                history.replaceState(null, '', url);
            } catch (e) { /* file:// may not support replaceState */ }
            if (currentTab === 'report') renderReport();
        });
    });

    // Apply restored tab to DOM
    if (urlTab) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === urlTab));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`tab-${urlTab}`)?.classList.add('active');
    }
}

// ─── Feed list (left panel of Chi tiêu tab) ───────────────────────────────────

let feedPeriod = 'today';

// ─── Mood engine ──────────────────────────────────────────────────────────────
// Mỗi ngày random 1 base mood (0–100). Normal rất hiếm (~10%).
// Mỗi lần chi tiêu, mood tăng theo số tiền. Mood quyết định tone reply.
// Thresholds: 0–39 = fun, 40–79 = fun (nghiêng savage), 80+ = savage
// Normal chỉ xuất hiện khi base mood < 12 VÀ chưa chi gì nhiều.

const MOOD_KEY_PREFIX = 'expense_mood_';

function getMoodKey() {
    const d = new Date();
    return MOOD_KEY_PREFIX + `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getMoodState() {
    const key = getMoodKey();
    const raw = localStorage.getItem(key);

    // Cleanup old mood keys (keep only today)
    Object.keys(localStorage)
        .filter(k => k.startsWith(MOOD_KEY_PREFIX) && k !== key)
        .forEach(k => localStorage.removeItem(k));

    if (raw) return JSON.parse(raw);

    // Random base mood mỗi ngày
    // 10% chance normal (base 0–11), 60% fun (12–59), 30% savage-leaning (60–79)
    const roll = Math.random() * 100;
    const base = roll < 10 ? Math.floor(Math.random() * 12)
        : roll < 70 ? Math.floor(12 + Math.random() * 48)
            : Math.floor(60 + Math.random() * 20);

    const state = { base, bonus: 0 };
    localStorage.setItem(key, JSON.stringify(state));
    return state;
}

function addMoodBonus(amount) {
    const key = getMoodKey();
    const state = getMoodState();
    // Mỗi 100k tăng ~3 mood, tối đa +30 mỗi lần
    const delta = Math.min(30, Math.floor(amount / 100000) * 3 + (amount >= 50000 ? 2 : 1));
    state.bonus = Math.min(40, state.bonus + delta); // bonus tối đa +40
    localStorage.setItem(key, JSON.stringify(state));
    updateMoodIndicator();
}

function getCurrentMood() {
    const { base, bonus } = getMoodState();
    return Math.min(100, base + bonus);
}

function getCurrentTone() {
    const mood = getCurrentMood();
    if (mood >= 80) return 'savage';
    if (mood >= 12) return 'fun';
    return 'normal';
}

function updateMoodIndicator() {
    const el = document.getElementById('moodIndicator');
    if (!el) return;
    const mood = getCurrentMood();
    const tone = getCurrentTone();
    const icons = { normal: '😐', fun: '😄', savage: '😈' };
    el.textContent = icons[tone];
    el.title = `Mood ${mood}/100 · ${tone}`;
}

function applyChatSide() {
    const side = localStorage.getItem('expense_chat_side') || 'left';
    const tabEl = document.getElementById('tab-feed');
    tabEl.classList.toggle('chat-left', side === 'left');
}

function toggleChatSide() {
    const current = localStorage.getItem('expense_chat_side') || 'left';
    const next = current === 'left' ? 'right' : 'left';
    localStorage.setItem('expense_chat_side', next);
    applyChatSide();
}

function setupFeedList() {
    document.querySelectorAll('.fp-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.fp-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            feedPeriod = btn.dataset.fp;
            renderExpenseList();
        });
    });
}

function getFeedFilteredExpenses() {
    const now = new Date();
    const today = toLocalDate(now);
    return allExpenses.filter(e => {
        if (feedPeriod === 'today') return e.date === today;
        if (feedPeriod === 'week') {
            const d = new Date(e.date + 'T00:00:00');
            return (now - d) / 86400000 >= 0 && (now - d) / 86400000 < 7;
        }
        if (feedPeriod === 'month') return e.date.slice(0, 7) === today.slice(0, 7);
        return true;
    });
}

function renderExpenseList() {
    const expenses = getFeedFilteredExpenses();
    const total = expenses.reduce((s, e) => s + e.amount, 0);

    const summaryEl = document.getElementById('feedSummaryLine');
    if (summaryEl) summaryEl.innerHTML =
        `<span>${expenses.length} giao dịch</span><span class="fs-total">${formatAmount(total)}</span>`;

    const listEl = document.getElementById('expenseList');
    if (!listEl) return;

    if (isLoading) {
        listEl.innerHTML = `<div class="skeleton-bubble">
            <div class="skeleton-icon skel"></div>
            <div class="skeleton-body"><div class="skel skel-name"></div><div class="skel skel-meta"></div></div>
            <div class="skel skel-amount"></div>
        </div>`;
        return;
    }

    if (!expenses.length) {
        listEl.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--color-text-muted);font-size:var(--font-sm)">Chưa có giao dịch</div>';
        return;
    }

    const groups = {};
    expenses.forEach(e => { if (!groups[e.date]) groups[e.date] = []; groups[e.date].push(e); });

    let html = '';
    Object.keys(groups).sort((a, b) => b.localeCompare(a)).forEach(date => {
        const dayTotal = groups[date].reduce((s, e) => s + e.amount, 0);
        html += `<div class="date-sep">
            <div class="date-sep-line"></div>
            <div class="date-sep-label">${formatDate(date)}</div>
            <div class="date-sep-line"></div>
            <div class="date-sep-total">${formatAmount(dayTotal)}</div>
        </div>`;
        groups[date].forEach(e => {
            const cat = CATEGORIES[e.category] || CATEGORIES.other;
            const color = CAT_COLORS[e.category] || CAT_COLORS.other;
            html += `<div class="expense-bubble" data-id="${e.id}"
                style="border-left-color:${color}"
                oncontextmenu="openCatMenu(event,'${e.id}')">
                <div class="bubble-cat-icon">${cat.icon}</div>
                <div class="bubble-body">
                    <div class="bubble-name" ondblclick="inlineEditName(this,'${e.id}')">${esc(e.name)}</div>
                    <div class="bubble-meta">
                        <span class="bubble-cat" style="color:${color}">${cat.label}</span>
                        ${e.time ? `<span class="bubble-time">${e.time}</span>` : ''}
                    </div>
                </div>
                <div class="bubble-amount">${formatAmount(e.amount)}</div>
                <button class="btn-delete-expense" onclick="deleteWithUndo('${e.id}')">✕</button>
            </div>`;
        });
    });
    listEl.innerHTML = html;
}

// ─── Filters (topbar — removed, now handled per-panel) ────────────────────────

// ─── Report panel ─────────────────────────────────────────────────────────────

let reportPeriod = 'today';

function setupReportPanel() {
    document.querySelectorAll('.rp-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.rp-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            reportPeriod = btn.dataset.rp;
            renderReport();
        });
    });
    const input = document.getElementById('reportChatInput');
    if (input) input.addEventListener('input', () => autoResizeInput(input));
}

function getReportFilteredExpenses() {
    const now = new Date();
    const today = toLocalDate(now);
    return allExpenses.filter(e => {
        if (reportPeriod === 'today') return e.date === today;
        if (reportPeriod === 'week') {
            const d = new Date(e.date + 'T00:00:00');
            return (now - d) / 86400000 >= 0 && (now - d) / 86400000 < 7;
        }
        if (reportPeriod === 'month') return e.date.slice(0, 7) === today.slice(0, 7);
        return true; // 'all'
    });
}

function renderReport() {
    const expenses = getReportFilteredExpenses();
    const total = expenses.reduce((s, e) => s + e.amount, 0);

    const summaryEl = document.getElementById('reportSummaryLine');
    if (summaryEl) summaryEl.innerHTML =
        `<span>${expenses.length} chi tiêu</span><span class="rls-total">${formatAmount(total)}</span>`;

    const statsEl = document.getElementById('reportStatsPanel');
    if (!statsEl) return;
    if (isLoading) { statsEl.innerHTML = '<div class="report-empty">Đang tải...</div>'; return; }
    if (!expenses.length) { statsEl.innerHTML = '<div class="report-empty">📭 Chưa có dữ liệu cho kỳ này</div>'; return; }

    const now = new Date();
    const today = toLocalDate(now);

    // ── Core computed ──
    const catTotals = {}, catCounts = {};
    expenses.forEach(e => {
        catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
        catCounts[e.category] = (catCounts[e.category] || 0) + 1;
    });
    const catSorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

    const dayTotals = {};
    expenses.forEach(e => { dayTotals[e.date] = (dayTotals[e.date] || 0) + e.amount; });
    const days = Object.keys(dayTotals).sort();
    const maxDay = Math.max(...Object.values(dayTotals), 1);
    const avgDay = days.length ? Math.round(total / days.length) : 0;
    const avgTx = expenses.length ? Math.round(total / expenses.length) : 0;
    const maxExpense = [...expenses].sort((a, b) => b.amount - a.amount)[0];
    const maxDayEntry = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0];
    const minDayEntry = Object.entries(dayTotals).sort((a, b) => a[1] - b[1])[0];

    // Streak
    let streak = 0;
    for (let i = 0; i < days.length; i++) {
        const expected = toLocalDate(new Date(now - i * 86400000));
        if ([...days].sort((a, b) => b.localeCompare(a))[i] === expected) streak++;
        else break;
    }

    // So sánh kỳ trước
    let prevTotal = 0, prevLabel = '';
    if (reportPeriod === 'today') {
        const yesterday = toLocalDate(new Date(now - 86400000));
        prevTotal = allExpenses.filter(e => e.date === yesterday).reduce((s, e) => s + e.amount, 0);
        prevLabel = 'hôm qua';
    } else if (reportPeriod === 'week') {
        prevTotal = allExpenses.filter(e => {
            const diff = (now - new Date(e.date + 'T00:00:00')) / 86400000;
            return diff >= 7 && diff < 14;
        }).reduce((s, e) => s + e.amount, 0);
        prevLabel = 'tuần trước';
    } else if (reportPeriod === 'month') {
        const pm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const pmStr = `${pm.getFullYear()}-${String(pm.getMonth() + 1).padStart(2, '0')}`;
        prevTotal = allExpenses.filter(e => e.date.slice(0, 7) === pmStr).reduce((s, e) => s + e.amount, 0);
        prevLabel = 'tháng trước';
    }
    const diffPct = prevTotal ? Math.round((total - prevTotal) / prevTotal * 100) : null;
    const diffArrow = diffPct === null ? '' : diffPct > 0
        ? `<span class="kpi-trend up">▲ ${diffPct}% so với ${prevLabel}</span>`
        : diffPct < 0
            ? `<span class="kpi-trend down">▼ ${Math.abs(diffPct)}% so với ${prevLabel}</span>`
            : `<span class="kpi-trend flat">= bằng ${prevLabel}</span>`;

    // Dự đoán cuối tháng
    let projHtml = '';
    if (reportPeriod === 'month' && days.length > 0) {
        const dayOfMonth = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const projected = Math.round(total / dayOfMonth * daysInMonth);
        projHtml = `<div class="proj-row">
            <span class="proj-label">Dự đoán cuối tháng:</span>
            <span class="proj-value">${formatAmount(projected)}</span>
            <span class="proj-sub">còn ~${formatAmount(projected - total)} nếu giữ tốc độ</span>
        </div>`;
    }

    // Name frequency
    const nameCounts = {}, nameAmounts = {}, nameCat = {};
    expenses.forEach(e => {
        const key = e.name.toLowerCase();
        nameCounts[key] = (nameCounts[key] || 0) + 1;
        nameAmounts[key] = (nameAmounts[key] || 0) + e.amount;
        nameCat[key] = e.category;
    });

    // ── Section 1: KPI ──
    const topCat = catSorted[0];
    const topCatInfo = topCat ? (CATEGORIES[topCat[0]] || CATEGORIES.other) : null;
    const kpiHtml = `<div class="kpi-grid">
        <div class="kpi-card kpi-main">
            <div class="kpi-label">Tổng chi</div>
            <div class="kpi-value">${formatAmount(total)}</div>
            <div class="kpi-sub">${expenses.length} chi tiêu · ${days.length} ngày ${diffArrow}</div>
            ${projHtml}
        </div>
        <div class="kpi-card">
            <div class="kpi-label">TB / lần chi</div>
            <div class="kpi-value">${formatAmount(avgTx)}</div>
            <div class="kpi-sub">TB / ngày: ${formatAmount(avgDay)}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Chi lớn nhất</div>
            <div class="kpi-value">${formatAmount(maxExpense.amount)}</div>
            <div class="kpi-sub">${esc(maxExpense.name)}</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Danh mục top</div>
            <div class="kpi-value kpi-cat">${topCatInfo ? topCatInfo.icon + ' ' + topCatInfo.label : '—'}</div>
            <div class="kpi-sub">${topCat ? formatAmount(topCat[1]) + ' · ' + Math.round(topCat[1] / total * 100) + '%' : ''}</div>
        </div>
    </div>`;

    // ── Section 2: Timeline ──
    const tlCols = days.map(d => {
        const amt = dayTotals[d];
        const h = Math.max(3, Math.round(amt / maxDay * 72));
        const isToday = d === today;
        const isMax = d === maxDayEntry[0];
        const isMin = days.length > 1 && d === minDayEntry[0];
        return `<div class="tl-col${isToday ? ' tl-today' : ''}${isMax ? ' tl-max' : ''}${isMin ? ' tl-min' : ''}">
            <div class="tl-amt">${formatAmount(amt)}</div>
            <div class="tl-bar-wrap"><div class="tl-bar" style="height:${h}px"></div></div>
            <div class="tl-label">${formatDateShort(d)}</div>
        </div>`;
    }).join('');

    const streakBadge = streak > 1 ? `<span class="tl-streak">🔥 ${streak} ngày liên tiếp</span>` : '';
    const maxMinMeta = days.length > 1
        ? `<span class="section-meta-item">Nhiều nhất: <b>${formatDate(maxDayEntry[0])}</b> ${formatAmount(maxDayEntry[1])}</span>
           <span class="section-meta-item">Ít nhất: <b>${formatDate(minDayEntry[0])}</b> ${formatAmount(minDayEntry[1])}</span>`
        : '';

    const timelineHtml = days.length > 1 ? `<div class="report-section">
        <div class="report-section-title">📅 Chi theo ngày · TB ${formatAmount(avgDay)}/ngày
            <span class="section-meta">${maxMinMeta}${streakBadge}</span>
        </div>
        <div class="tl-chart">${tlCols}</div>
    </div>` : '';

    // ── Section 3: Danh mục + cần/không cần ──
    const ESSENTIAL_CATS = new Set(['food', 'transport', 'health', 'bill']);
    let essentialAmt = 0, nonEssentialAmt = 0;
    catSorted.forEach(([cat, amt]) => {
        if (ESSENTIAL_CATS.has(cat)) essentialAmt += amt;
        else nonEssentialAmt += amt;
    });
    const essentialPct = total ? Math.round(essentialAmt / total * 100) : 0;
    const nonEssentialPct = 100 - essentialPct;

    const maxCatAmt = catSorted[0]?.[1] || 1;
    const catRows = catSorted.map(([cat, amt]) => {
        const c = CATEGORIES[cat] || CATEGORIES.other;
        const color = CAT_COLORS[cat] || CAT_COLORS.other;
        const pct = Math.round(amt / total * 100);
        const count = catCounts[cat] || 0;
        const avgCatTx = Math.round(amt / count);
        const barW = Math.round(amt / maxCatAmt * 100);
        return `<div class="cat-row">
            <div class="cat-row-head">
                <span class="cat-row-icon">${c.icon}</span>
                <span class="cat-row-name">${c.label}</span>
                <span class="cat-row-count">${count} lần · TB ${formatAmount(avgCatTx)}/lần</span>
                <span class="cat-row-pct" style="color:${color}">${pct}% · ${formatAmount(amt)}</span>
            </div>
            <div class="cat-row-track">
                <div class="cat-row-fill" style="width:${barW}%;background:${color}"></div>
            </div>
        </div>`;
    }).join('');

    const catHtml = `<div class="report-section">
        <div class="report-section-title">🗂 Tỷ trọng danh mục</div>
        <div class="cat-breakdown">${catRows}</div>
    </div>`;

    // ── Section 4: Hành vi ──
    const top5 = [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 5);
    const maxTop5 = top5[0]?.amount || 1;
    const top5Html = top5.map((e, i) => {
        const c = CATEGORIES[e.category] || CATEGORIES.other;
        const color = CAT_COLORS[e.category] || CAT_COLORS.other;
        const barW = Math.round(e.amount / maxTop5 * 100);
        return `<div class="top-item">
            <span class="top-rank">${i + 1}</span>
            <span class="top-icon">${c.icon}</span>
            <div class="top-body">
                <div class="top-row">
                    <span class="top-name">${esc(e.name)}</span>
                    <span class="top-amt" style="color:${color}">${formatAmount(e.amount)}</span>
                </div>
                <div class="top-bar-bg"><div class="top-bar-fg" style="width:${barW}%;background:${color}"></div></div>
            </div>
        </div>`;
    }).join('');

    const repeatItems = Object.entries(nameCounts)
        .filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([key, count]) => {
            const color = CAT_COLORS[nameCat[key]] || CAT_COLORS.other;
            return `<div class="repeat-item">
                <span class="repeat-name">${esc(key)}</span>
                <span class="repeat-count" style="color:${color}">${count}×</span>
                <span class="repeat-total">${formatAmount(nameAmounts[key])}</span>
                <span class="repeat-avg">TB ${formatAmount(Math.round(nameAmounts[key] / count))}</span>
            </div>`;
        }).join('');

    const s1 = expenses.filter(e => e.amount < 100000).length;
    const s2 = expenses.filter(e => e.amount >= 100000 && e.amount < 200000).length;
    const s3 = expenses.filter(e => e.amount >= 200000 && e.amount < 500000).length;
    const s4 = expenses.filter(e => e.amount >= 500000 && e.amount < 1000000).length;
    const s5 = expenses.filter(e => e.amount >= 1000000).length;
    const segMax = Math.max(s1, s2, s3, s4, s5, 1);
    const segHtml = `<div class="seg-row">
        <div class="seg-item">
            <div class="seg-bar-wrap"><div class="seg-bar" style="height:${Math.round(s1 / segMax * 56)}px;background:#66bb6a"></div></div>
            <div class="seg-label">dưới 100k</div>
            <div class="seg-count">${s1} lần</div>
        </div>
        <div class="seg-item">
            <div class="seg-bar-wrap"><div class="seg-bar" style="height:${Math.round(s2 / segMax * 56)}px;background:#42a5f5"></div></div>
            <div class="seg-label">100–200k</div>
            <div class="seg-count">${s2} lần</div>
        </div>
        <div class="seg-item">
            <div class="seg-bar-wrap"><div class="seg-bar" style="height:${Math.round(s3 / segMax * 56)}px;background:#ff9800"></div></div>
            <div class="seg-label">200–500k</div>
            <div class="seg-count">${s3} lần</div>
        </div>
        <div class="seg-item">
            <div class="seg-bar-wrap"><div class="seg-bar" style="height:${Math.round(s4 / segMax * 56)}px;background:#ef5350"></div></div>
            <div class="seg-label">500k–1tr</div>
            <div class="seg-count">${s4} lần</div>
        </div>
        <div class="seg-item">
            <div class="seg-bar-wrap"><div class="seg-bar" style="height:${Math.round(s5 / segMax * 56)}px;background:#b71c1c"></div></div>
            <div class="seg-label">trên 1tr</div>
            <div class="seg-count">${s5} lần</div>
        </div>
    </div>`;

    const hourTotals = {}, hourCounts = {};
    expenses.forEach(e => {
        if (!e.time) return;
        const h = parseInt(e.time.split(':')[0]);
        hourTotals[h] = (hourTotals[h] || 0) + e.amount;
        hourCounts[h] = (hourCounts[h] || 0) + 1;
    });
    const slotDefs = [
        { label: 'Sáng', range: [6, 11], icon: '🌅' },
        { label: 'Trưa', range: [11, 14], icon: '☀️' },
        { label: 'Chiều', range: [14, 18], icon: '🌤' },
        { label: 'Tối', range: [18, 24], icon: '🌙' },
        { label: 'Đêm', range: [0, 6], icon: '🌃' },
    ];
    const slots = slotDefs.map(s => {
        const amt = Object.entries(hourTotals).filter(([h]) => +h >= s.range[0] && +h < s.range[1]).reduce((sum, [, a]) => sum + a, 0);
        const cnt = Object.entries(hourCounts).filter(([h]) => +h >= s.range[0] && +h < s.range[1]).reduce((sum, [, c]) => sum + c, 0);
        return { ...s, amt, cnt };
    }).filter(s => s.amt > 0).sort((a, b) => b.amt - a.amt);
    const maxSlot = slots[0]?.amt || 1;
    const hourHtml = slots.length
        ? `<div class="hour-slots">${slots.map(s =>
            `<div class="hour-slot">
                <span class="hour-icon">${s.icon}</span>
                <span class="hour-label">${s.label}</span>
                <div class="hour-track"><div class="hour-fill" style="width:${Math.round(s.amt / maxSlot * 100)}%"></div></div>
                <span class="hour-cnt">${s.cnt} lần</span>
                <span class="hour-amt">${formatAmount(s.amt)}</span>
            </div>`
        ).join('')}</div>`
        : '<div class="report-empty-sm">Chưa đủ dữ liệu giờ</div>';

    const behaviorHtml = `
        <div class="report-row-2">
            <div class="report-section">
                <div class="report-section-title">🏆 Top 5 khoản chi lớn nhất</div>
                <div class="top-list">${top5Html}</div>
            </div>
            <div class="report-section">
                <div class="report-section-title">💰 Phân khúc chi tiêu</div>
                ${segHtml}
            </div>
        </div>`;

    // ── Section 5: Gợi ý cắt giảm ──
    const tips = [];
    catSorted.forEach(([cat, amt]) => {
        const pct = Math.round(amt / total * 100);
        const c = CATEGORIES[cat] || CATEGORIES.other;
        const count = catCounts[cat] || 0;
        if (pct >= 40 && !ESSENTIAL_CATS.has(cat)) {
            tips.push({ level: 'high', icon: c.icon, text: `<b>${c.label}</b> chiếm ${pct}% tổng chi (${formatAmount(amt)}). Giảm 20% → tiết kiệm <b>${formatAmount(Math.round(amt * 0.2))}</b>.` });
        } else if (pct >= 25 && (cat === 'food' || cat === 'drink')) {
            tips.push({ level: 'mid', icon: c.icon, text: `<b>${c.label}</b> ${formatAmount(amt)} (${count} lần). Giảm 1-2 lần/tuần → tiết kiệm ~<b>${formatAmount(Math.round(amt * 0.15))}</b>.` });
        }
    });
    Object.entries(nameCounts).filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 2).forEach(([key, count]) => {
        const avgAmt = Math.round(nameAmounts[key] / count);
        tips.push({ level: 'mid', icon: '🔁', text: `<b>${esc(key)}</b> mua ${count} lần (${formatAmount(nameAmounts[key])}). Tìm lựa chọn rẻ hơn ~${formatAmount(Math.round(avgAmt * 0.7))}/lần → tiết kiệm <b>${formatAmount(Math.round(nameAmounts[key] * 0.3))}</b>.` });
    });
    if (days.length > 2) {
        const spikes = Object.entries(dayTotals).filter(([, a]) => a > avgDay * 2).sort((a, b) => b[1] - a[1]);
        if (spikes.length) tips.push({ level: 'low', icon: '📈', text: `Ngày <b>${formatDate(spikes[0][0])}</b> chi ${formatAmount(spikes[0][1])} — gấp ${(spikes[0][1] / avgDay).toFixed(1)}x trung bình. Xem lại khoản nào không cần thiết.` });
    }
    if (nonEssentialPct > 50) {
        tips.push({ level: 'mid', icon: '🛍️', text: `Chi không thiết yếu chiếm <b>${nonEssentialPct}%</b> (${formatAmount(nonEssentialAmt)}). Cân nhắc giảm xuống dưới 40%.` });
    }
    if (!tips.length) tips.push({ level: 'low', icon: '✅', text: 'Chi tiêu khá cân đối, không có danh mục nào bất thường. Tiếp tục duy trì!' });

    const levelColor = { high: '#f44336', mid: '#ff9800', low: '#66bb6a' };
    const tipsHtml = `<div class="report-section">
        <div class="report-section-title">✂️ Gợi ý cắt giảm</div>
        <div class="tips-list">${tips.map(t =>
            `<div class="tip-item tip-${t.level}">
                <span class="tip-dot" style="background:${levelColor[t.level]}"></span>
                <span class="tip-icon">${t.icon}</span>
                <span class="tip-text">${t.text}</span>
            </div>`
        ).join('')}</div>
    </div>`;

    const catHourHtml = `<div class="report-row-2">
        ${catHtml}
        <div class="report-section">
            <div class="report-section-title">🕐 Khung giờ hay tiêu tiền</div>
            ${hourHtml}
        </div>
    </div>`;

    statsEl.innerHTML = kpiHtml + timelineHtml + catHourHtml + behaviorHtml + tipsHtml;

    requestAnimationFrame(() => {
        statsEl.querySelectorAll('.cat-row-fill, .top-bar-fg, .hour-fill').forEach(el => {
            const w = el.style.width; el.style.width = '0';
            requestAnimationFrame(() => { el.style.width = w; });
        });
        statsEl.querySelectorAll('.tl-bar, .seg-bar').forEach(el => {
            const h = el.style.height; el.style.height = '0';
            requestAnimationFrame(() => { el.style.height = h; });
        });
    });
}

function handleReportChatKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitReportChat();
    }
}

async function submitReportChat() {
    const input = document.getElementById('reportChatInput');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    autoResizeInput(input);

    const feed = document.getElementById('reportChatFeed');
    feed.querySelector('.report-chat-welcome')?.remove();

    // User bubble
    const userEl = document.createElement('div');
    userEl.className = 'user-bubble';
    userEl.textContent = text;
    feed.appendChild(userEl);
    feed.scrollTop = feed.scrollHeight;

    // Disable input
    const btn = document.getElementById('reportSendBtn');
    const icon = document.getElementById('reportSendIcon');
    input.disabled = true; btn.disabled = true;
    icon.innerHTML = '<span class="spin">⟳</span>';

    // Typing indicator
    const thinkId = showTypingInFeed(feed);

    try {
        const reply = await callReportAI(text);
        document.getElementById(thinkId)?.remove();
        appendAIBubbleToFeed(feed, reply);
    } catch (e) {
        document.getElementById(thinkId)?.remove();
        appendAIBubbleToFeed(feed, 'Ối, lỗi rồi. Thử lại nha 😬');
    }

    input.disabled = false; btn.disabled = false;
    icon.innerHTML = '↑';
    input.focus();
}

function showTypingInFeed(feed) {
    const id = 'rthink_' + Date.now();
    const el = document.createElement('div');
    el.className = 'ai-bubble typing-bubble';
    el.id = id;
    el.innerHTML = `<span class="ai-avatar">🤖</span>
        <div class="thinking-dots"><span></span><span></span><span></span></div>`;
    feed.appendChild(el);
    feed.scrollTop = feed.scrollHeight;
    return id;
}

function appendAIBubbleToFeed(feed, text) {
    const el = document.createElement('div');
    el.className = 'ai-bubble';
    el.innerHTML = `<span class="ai-avatar">🤖</span><span class="ai-text">${esc(text)}</span>`;
    feed.appendChild(el);
    feed.scrollTop = feed.scrollHeight;
}

function callReportAI(question) {
    const expenses = getReportFilteredExpenses();
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const catTotals = {};
    expenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });
    const catSummary = Object.entries(catTotals)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amt]) => `${CATEGORIES[cat]?.label || cat}: ${formatAmount(amt)}`)
        .join(', ');
    const periodLabel = reportPeriod === 'today' ? 'Hôm nay' : reportPeriod === 'week' ? '7 ngày qua' : reportPeriod === 'month' ? 'Tháng này' : 'Tất cả';
    if (!expenses.length) return Promise.resolve(`${periodLabel} chưa có chi tiêu nào.`);
    const topItems = [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 3)
        .map(e => `${e.name} ${formatAmount(e.amount)}`).join(', ');
    return Promise.resolve(`${periodLabel} bạn chi tổng ${formatAmount(total)} (${expenses.length} lần). Nhiều nhất: ${catSummary.split(',')[0]}. Top: ${topItems}.`);
}

// ─── Input ────────────────────────────────────────────────────────────────────

function formatDateShort(dateStr) {
    try {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    } catch { return dateStr.slice(5); }
}

function setupInput() {
    const input = document.getElementById('chatInput');
    input.addEventListener('input', () => autoResizeInput(input));

    // Mobile: scroll chat to bottom when keyboard opens
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            const feed = document.getElementById('chatFeed');
            if (feed) {
                // Small delay to let layout settle
                setTimeout(() => {
                    feed.scrollTop = feed.scrollHeight;
                }, 100);
            }
        });
    }

    // Mobile: scroll to bottom on input focus
    input.addEventListener('focus', () => {
        if (window.innerWidth <= 600) {
            const feed = document.getElementById('chatFeed');
            setTimeout(() => {
                if (feed) feed.scrollTop = feed.scrollHeight;
            }, 300);
        }
    });
}

function autoResizeInput(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function handleInputKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitExpense();
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLocalDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const today = toLocalDate(new Date());
    const yesterday = toLocalDate(new Date(Date.now() - 86400000));
    if (dateStr === today) return 'Hôm nay';
    if (dateStr === yesterday) return 'Hôm qua';
    try {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
    } catch { return dateStr; }
}

function formatAmount(n) {
    if (n >= 1000) return n.toLocaleString('vi-VN') + 'đ';
    return n + 'đ';
    return n + 'đ';
}

function esc(str) {
    return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('contextmenu', e => e.preventDefault());
    init();
});
