// Savings Modal Logic

let savingsGoal = null;
let savingsQrImageData = null;
let savingsLoading = false;

function openSavingsModal() {
    document.getElementById('savingsModal').classList.add('show');

    if (savingsGoal) {
        // Already have data — show immediately, sync in background
        showActiveSavingsGoal();
        syncSavingsGoal();
    } else {
        // First open — show skeleton while fetching
        showLoadingSkeleton();
        loadSavingsGoal();
    }
}

function closeSavingsModal() {
    document.getElementById('savingsModal').classList.remove('show');
}

// ===== LOADING SKELETON =====

function showLoadingSkeleton() {
    document.getElementById('savingsCreateForm').style.display = 'none';
    document.getElementById('savingsActiveGoal').style.display = 'none';
    document.getElementById('savingsLoadingState').style.display = 'block';
}

function hideLoadingSkeleton() {
    document.getElementById('savingsLoadingState').style.display = 'none';
}

// ===== DATA LOADING =====

async function loadSavingsGoal() {
    if (savingsLoading) return;
    savingsLoading = true;

    try {
        const response = await fetch(API_CONFIG.NOTES);
        const allData = await response.json();
        const savingsData = allData.filter(n => n.type === 'savings');

        hideLoadingSkeleton();

        if (savingsData.length > 0) {
            const record = savingsData[0];
            savingsGoal = {
                id: record.id,
                name: record.title,
                targetAmount: parseInt(record.url1) || 0,
                currentAmount: parseInt(record.url2) || 0,
                deadline: parseInt(record.url3) || 90,
                startDate: record.createdAt,
                history: safeParseJSON(record.content, []),
                challenge: safeParseJSON(record.url5, null)
            };
            savingsQrImageData = record.url4 || null;
            showActiveSavingsGoal();
        } else {
            showCreateGoalForm();
        }
    } catch (error) {
        console.error('Error loading savings goal:', error);
        hideLoadingSkeleton();
        showCreateGoalForm();
    } finally {
        savingsLoading = false;
    }
}

// Background sync — update state silently if data changed server-side
async function syncSavingsGoal() {
    if (savingsLoading || !savingsGoal?.id) return;

    try {
        const response = await fetch(`${API_CONFIG.NOTES}/${savingsGoal.id}`);
        if (!response.ok) return;
        const record = await response.json();

        // Only update if no pending local changes
        if (pendingSaveTimeout) return;

        const serverAmount = parseInt(record.url2) || 0;
        if (serverAmount !== savingsGoal.currentAmount) {
            savingsGoal.currentAmount = serverAmount;
            savingsGoal.history = safeParseJSON(record.content, []);
            updateSavingsDisplay();
        }
    } catch {
        // Silent fail — user already sees cached data
    }
}

function safeParseJSON(str, fallback) {
    try { return JSON.parse(str) || fallback; }
    catch { return fallback; }
}

// ===== SAVE / DELETE =====

let pendingSaveTimeout = null;

async function saveSavingsGoal() {
    const payload = {
        title: savingsGoal.name,
        content: JSON.stringify(savingsGoal.history),
        type: 'savings',
        url1: savingsGoal.targetAmount.toString(),
        url2: savingsGoal.currentAmount.toString(),
        url3: savingsGoal.deadline.toString(),
        url4: savingsQrImageData || '',
        url5: savingsGoal.challenge ? JSON.stringify(savingsGoal.challenge) : '',
        source: '',
        tags: '',
        example: '',
        wordCountEnabled: false,
        timerDuration: '0'
    };

    if (savingsGoal.id) {
        await fetch(`${API_CONFIG.NOTES}/${savingsGoal.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } else {
        const res = await fetch(API_CONFIG.NOTES, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        savingsGoal.id = result.id;
    }
}

// Debounced background save — UI already updated optimistically
function debouncedSave(snapshot) {
    if (pendingSaveTimeout) clearTimeout(pendingSaveTimeout);
    pendingSaveTimeout = setTimeout(async () => {
        try {
            await saveSavingsGoal();
        } catch (error) {
            console.error('Error saving savings goal:', error);
            // Rollback to snapshot
            savingsGoal.currentAmount = snapshot.currentAmount;
            savingsGoal.history = snapshot.history;
            if (snapshot.challenge) savingsGoal.challenge = snapshot.challenge;
            updateSavingsDisplay();
            showSaveError();
        }
    }, 300);
}

function showSaveError() {
    const el = document.createElement('div');
    el.style.cssText = `
        position: fixed; bottom: 20px; right: 20px;
        background: var(--color-danger); color: white;
        padding: 10px 16px; font-size: var(--font-sm);
        z-index: 20000; border: 1px solid var(--color-danger-hover);
    `;
    el.textContent = 'Lỗi lưu dữ liệu, đã hoàn tác.';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

async function deleteSavingsGoal(id) {
    await fetch(`${API_CONFIG.NOTES}/${id}`, { method: 'DELETE' });
}

// ===== VIEWS =====

function showCreateGoalForm() {
    document.getElementById('savingsCreateForm').style.display = 'block';
    document.getElementById('savingsActiveGoal').style.display = 'none';
}

function showActiveSavingsGoal() {
    document.getElementById('savingsCreateForm').style.display = 'none';
    document.getElementById('savingsActiveGoal').style.display = 'block';
    updateSavingsDisplay();
}

function cancelCreateGoal() {
    closeSavingsModal();
}

function toggleSavingsHistory() {
    const panel = document.getElementById('savingsHistoryPanel');
    const btn = document.getElementById('savingsHistoryBtn');
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    btn.textContent = isOpen ? '📊 Lịch sử' : '📊 Đóng';
}

// ===== CREATE GOAL =====

async function createSavingsGoal() {
    const name = document.getElementById('savingsGoalName').value.trim();
    const target = parseInputNumber(document.getElementById('savingsTargetAmount').value);
    const days = parseDeadlineInput(document.getElementById('savingsDeadline').value);
    const challengeEnabled = document.getElementById('savingsChallengeEnabled').checked;

    if (!name || !target || target <= 0 || !days || days <= 0) {
        alert('Vui lòng điền đầy đủ thông tin hợp lệ!');
        return;
    }

    savingsGoal = {
        id: null,
        name,
        targetAmount: target,
        currentAmount: 0,
        deadline: days,
        startDate: new Date().toISOString(),
        history: [],
        challenge: challengeEnabled ? generateChallenge(target) : null
    };

    await saveSavingsGoal();
    showActiveSavingsGoal();
}

// ===== DISPLAY =====

// Format number with thousand separators for display (e.g. 10000000 → "10.000.000")
function formatInputNumber(val) {
    if (!val && val !== 0) return '';
    return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Parse formatted input back to integer (strips dots/commas)
function parseInputNumber(str) {
    return parseInt(str.toString().replace(/[.,]/g, '')) || 0;
}

// Parse deadline: "2m" → 60, "90" → 90
function parseDeadlineInput(str) {
    const s = str.toString().trim().toLowerCase();
    const mMatch = s.match(/^(\d+(\.\d+)?)\s*m$/);
    if (mMatch) return Math.round(parseFloat(mMatch[1]) * 30);
    return parseInt(s) || 0;
}

function formatMoney(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function updateSavingsDisplay() {
    const { name, currentAmount, targetAmount, deadline, startDate } = savingsGoal;

    document.getElementById('savingsGoalTitle').textContent = name;
    document.getElementById('savingsCurrentAmount').textContent = formatMoney(currentAmount);
    document.getElementById('savingsTargetDisplay').textContent = formatMoney(targetAmount);

    const progress = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;
    document.getElementById('savingsProgressBar').style.width = progress + '%';
    document.getElementById('savingsProgressText').textContent = progress.toFixed(1) + '%';

    const remaining = Math.max(targetAmount - currentAmount, 0);
    document.getElementById('savingsRemaining').textContent = formatMoney(remaining);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + deadline);
    const daysLeft = Math.max(Math.ceil((endDate - new Date()) / 86400000), 0);
    document.getElementById('savingsDaysLeft').textContent = daysLeft + ' ngày';

    const dailyTarget = daysLeft > 0 ? remaining / daysLeft : 0;
    document.getElementById('savingsDailyTarget').textContent = formatMoney(dailyTarget);

    updateSavingsMilestones(progress);

    const qrSection = document.getElementById('savingsQrSection');
    if (savingsQrImageData) {
        qrSection.style.display = 'block';
        document.getElementById('savingsQrImage').src = savingsQrImageData;
    } else {
        qrSection.style.display = 'none';
    }

    const challengeActive = savingsGoal.challenge?.enabled;
    document.getElementById('savingsAddMoneySection').style.display = challengeActive ? 'none' : '';

    updateQuickButtons(remaining);
    updateSavingsHistory();
    updateChallengeDisplay();
}

function updateQuickButtons(remaining) {
    document.querySelectorAll('.quick-btn').forEach(btn => {
        const amount = parseInt(btn.dataset.amount);
        const exceeded = amount > remaining;
        btn.disabled = exceeded;
        btn.title = exceeded ? `Vượt quá số tiền còn lại (${formatMoney(remaining)})` : '';
    });

    // Also cap the custom amount input max
    const customInput = document.getElementById('savingsCustomAmount');
    if (customInput) customInput.max = remaining;
}

function updateSavingsMilestones(currentProgress) {
    const milestones = [
        { percent: 25, icon: '🌱', label: '25%' },
        { percent: 50, icon: '🌿', label: '50%' },
        { percent: 75, icon: '🌳', label: '75%' },
        { percent: 100, icon: '🏆', label: '100%' }
    ];

    const container = document.getElementById('savingsMilestones');
    container.innerHTML = '';

    milestones.forEach(m => {
        const div = document.createElement('div');
        div.className = 'milestone' + (currentProgress >= m.percent ? ' reached' : '');
        div.innerHTML = `
            <span class="milestone-icon">${m.icon}</span>
            <span class="milestone-label">${m.label}</span>
        `;
        container.appendChild(div);
    });
}

function updateSavingsHistory() {
    const container = document.getElementById('savingsHistoryList');
    container.innerHTML = '';

    if (!savingsGoal.history.length) {
        container.innerHTML = '<div class="history-empty">Chưa có lịch sử</div>';
        return;
    }

    [...savingsGoal.history].reverse().forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        const date = new Date(item.date).toLocaleDateString('vi-VN', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        });
        div.innerHTML = `
            <span class="history-amount">+${formatMoney(item.amount)}</span>
            <span class="history-date">${date}</span>
        `;
        container.appendChild(div);
    });
}

// ===== ADD MONEY =====

function quickAddSavings(amount) {
    addSavingsMoney(amount);
}

function addCustomSavingsAmount() {
    const input = document.getElementById('savingsCustomAmount');
    const amount = parseInputNumber(input.value);

    if (!amount || amount <= 0) {
        alert('Vui lòng nhập số tiền hợp lệ!');
        return;
    }

    addSavingsMoney(amount);
    input.value = '';
}

function addSavingsMoney(amount) {
    const oldProgress = savingsGoal.targetAmount > 0
        ? (savingsGoal.currentAmount / savingsGoal.targetAmount) * 100
        : 0;

    // Cap amount so currentAmount doesn't exceed target
    const remaining = savingsGoal.targetAmount - savingsGoal.currentAmount;
    const actualAmount = Math.min(amount, remaining);
    if (actualAmount <= 0) return;

    // Snapshot for rollback
    const snapshot = {
        currentAmount: savingsGoal.currentAmount,
        history: [...savingsGoal.history]
    };

    // Optimistic update
    savingsGoal.currentAmount += actualAmount;
    savingsGoal.history.push({ amount: actualAmount, date: new Date().toISOString() });

    const newProgress = (savingsGoal.currentAmount / savingsGoal.targetAmount) * 100;

    updateSavingsDisplay();
    checkSavingsMilestones(oldProgress, newProgress);

    // Save in background, rollback on failure
    debouncedSave(snapshot);
}

// ===== MILESTONES & CELEBRATION =====

function checkSavingsMilestones(oldProgress, newProgress) {
    [25, 50, 75, 100].forEach(milestone => {
        if (oldProgress < milestone && newProgress >= milestone) {
            celebrateSavings(milestone);
        }
    });
}

function celebrateSavings(milestone) {
    const title = document.getElementById('savingsCelebrationTitle');
    const message = document.getElementById('savingsCelebrationMessage');

    if (milestone === 100) {
        title.textContent = '🎉 Hoàn thành mục tiêu!';
        message.textContent = `Bạn đã tiết kiệm đủ ${formatMoney(savingsGoal.targetAmount)}! Nhấn "Tạo mới" để bắt đầu mục tiêu mới.`;
    } else {
        title.textContent = `🎊 Đạt ${milestone}%!`;
        message.textContent = `Bạn đã hoàn thành ${milestone}% mục tiêu. Tiếp tục phát huy!`;
    }

    document.getElementById('savingsCelebrationModal').classList.add('show');
}

function closeSavingsCelebration() {
    document.getElementById('savingsCelebrationModal').classList.remove('show');
}

// ===== RESET =====

async function resetSavingsGoal() {
    if (!confirm('Xóa mục tiêu hiện tại và tạo mục tiêu mới?')) return;

    if (savingsGoal && savingsGoal.id) {
        try {
            await deleteSavingsGoal(savingsGoal.id);
        } catch (error) {
            console.error('Error deleting savings goal:', error);
            alert('Lỗi khi xóa mục tiêu. Vui lòng thử lại!');
            return;
        }
    }

    savingsGoal = null;
    savingsQrImageData = null;
    clearCreateForm();
    showCreateGoalForm();
}

function clearCreateForm() {
    ['savingsGoalName', 'savingsTargetAmount', 'savingsDeadline'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const upload = document.getElementById('savingsQrUpload');
    if (upload) upload.value = '';
    const preview = document.getElementById('savingsQrPreview');
    if (preview) preview.innerHTML = '';
}

// ===== DAILY CHALLENGE =====

function generateChallenge(target) {
    const STEP = 50000;
    const DAYS = 30;
    const base = Math.ceil(target / DAYS / STEP) * STEP;
    const amounts = [];

    const variants = [-2, -1, 0, 0, 1, 2, 3].map(v => Math.max(STEP, (base + v * STEP)));

    for (let i = 0; i < DAYS; i++) {
        amounts.push(variants[i % variants.length]);
    }

    // Shuffle Fisher-Yates
    for (let i = amounts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [amounts[i], amounts[j]] = [amounts[j], amounts[i]];
    }

    // Adjust so total >= target
    const total = amounts.reduce((s, a) => s + a, 0);
    if (total < target) {
        const extra = Math.ceil((target - total) / STEP) * STEP;
        amounts[amounts.length - 1] += extra;
    }

    return {
        enabled: true,
        days: amounts.map(amount => ({ amount, checked: false }))
    };
}

function getTodayIndex() {
    if (!savingsGoal?.challenge) return -1;

    // Use today's local date string "YYYY-MM-DD"
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

    // Find the earliest challenge history entry to determine day 0
    const challengeEntries = savingsGoal.history.filter(h => h.challengeDay != null);

    if (challengeEntries.length === 0) {
        // No history yet — day 0 is today (only today is unlocked)
        return 0;
    }

    // Get the date of day 1 entry (challengeDay === 1), or earliest entry
    const day1Entry = challengeEntries.find(h => h.challengeDay === 1) || challengeEntries[0];
    const day1Str = day1Entry.date.slice(0, 10); // "YYYY-MM-DD"

    const [sy, sm, sd] = day1Str.split('-').map(Number);
    const [ty, tm, td] = todayStr.split('-').map(Number);
    const startMs = new Date(sy, sm - 1, sd).getTime();
    const todayMs = new Date(ty, tm - 1, td).getTime();

    return Math.floor((todayMs - startMs) / 86400000);
}

function updateChallengeDisplay() {
    const section = document.getElementById('savingsChallengeSection');
    if (!savingsGoal?.challenge?.enabled) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';

    const { days } = savingsGoal.challenge;
    const todayIdx = getTodayIndex();
    const checkedCount = days.filter(d => d.checked).length;
    const checkedTotal = days.filter(d => d.checked).reduce((s, d) => s + d.amount, 0);
    const grandTotal = days.reduce((s, d) => s + d.amount, 0);

    document.getElementById('savingsChallengeSummary').innerHTML =
        `<span>${checkedCount}/${days.length} ngày</span>` +
        `<span>${formatMoney(checkedTotal)} / ${formatMoney(grandTotal)}</span>`;

    const grid = document.getElementById('savingsChallengeGrid');
    grid.innerHTML = '';

    days.forEach((day, i) => {
        const isToday = i === todayIdx;
        const isPast = i < todayIdx;
        const isFuture = i > todayIdx;

        const cell = document.createElement('div');
        cell.className = 'challenge-cell' +
            (day.checked ? ' checked' : '') +
            (isToday ? ' today' : '') +
            (isPast && !day.checked ? ' missed' : '') +
            (isFuture ? ' future' : '');

        cell.innerHTML =
            `<span class="challenge-day">Ngày ${i + 1}</span>` +
            `<span class="challenge-amount">${formatMoney(day.amount)}</span>` +
            (isToday && !day.checked ? `<span class="challenge-cta">Nộp hôm nay</span>` : '') +
            (day.checked ? `<span class="challenge-check">✓</span>` : '');

        if (!day.checked && (isToday || isPast)) {
            cell.addEventListener('click', () => tickChallengeDay(i));
        }

        grid.appendChild(cell);
    });

    // Scroll today's cell into view
    const todayCell = grid.querySelector('.today');
    if (todayCell) {
        requestAnimationFrame(() => {
            todayCell.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
    }
}

function tickChallengeDay(index) {
    const day = savingsGoal.challenge.days[index];
    if (day.checked) return;
    if (index > getTodayIndex()) return; // block future days

    const snapshot = {
        currentAmount: savingsGoal.currentAmount,
        history: [...savingsGoal.history],
        challenge: JSON.parse(JSON.stringify(savingsGoal.challenge))
    };

    const oldProgress = (savingsGoal.currentAmount / savingsGoal.targetAmount) * 100;
    const remaining = savingsGoal.targetAmount - savingsGoal.currentAmount;
    const actualAmount = Math.min(day.amount, remaining);

    day.checked = true;
    savingsGoal.currentAmount += actualAmount;
    savingsGoal.history.push({ amount: actualAmount, date: new Date().toISOString(), challengeDay: index + 1 });

    const newProgress = (savingsGoal.currentAmount / savingsGoal.targetAmount) * 100;

    updateSavingsDisplay();
    checkSavingsMilestones(oldProgress, newProgress);
    debouncedSave(snapshot);
}

// ===== QR UPLOAD =====

setTimeout(() => {
    const qrUpload = document.getElementById('savingsQrUpload');
    if (!qrUpload) return;

    qrUpload.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (!file) return;

        // Update label text
        const label = document.querySelector('label[for="savingsQrUpload"] .file-input-text');
        if (label) label.textContent = file.name;

        const reader = new FileReader();
        reader.onload = function (event) {
            savingsQrImageData = event.target.result;
            document.getElementById('savingsQrPreview').innerHTML =
                `<img src="${savingsQrImageData}" alt="QR Preview">`;
        };
        reader.readAsDataURL(file);
    });

    // Money input IDs that need thousand-separator formatting
    const moneyInputIds = ['savingsTargetAmount', 'savingsCustomAmount'];

    // Deadline input: convert "Xm" → days on blur
    const deadlineInput = document.getElementById('savingsDeadline');
    if (deadlineInput) {
        deadlineInput.addEventListener('blur', function () {
            const parsed = parseDeadlineInput(this.value);
            if (parsed > 0) this.value = parsed;
        });
    }

    // Challenge checkbox: auto-set deadline to 30 and lock/unlock input
    const challengeCheckbox = document.getElementById('savingsChallengeEnabled');
    if (challengeCheckbox) {
        challengeCheckbox.addEventListener('change', function () {
            const spin = deadlineInput?.closest('.number-input-wrap')?.querySelector('.number-spin');
            if (this.checked && deadlineInput) {
                deadlineInput.value = '30';
                deadlineInput.disabled = true;
                if (spin) spin.style.display = 'none';
            } else if (deadlineInput) {
                deadlineInput.disabled = false;
                if (spin) spin.style.display = '';
            }
        });
    }

    // Live format as user types — only allow digits, reformat on each keystroke
    moneyInputIds.forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;
        input.addEventListener('input', function () {
            const raw = parseInputNumber(this.value);
            const pos = this.selectionStart;
            const oldLen = this.value.length;
            this.value = raw ? formatInputNumber(raw) : '';
            // Adjust cursor position after reformatting
            const newLen = this.value.length;
            this.setSelectionRange(pos + (newLen - oldLen), pos + (newLen - oldLen));
        });
    });

    // Scroll wheel on number inputs
    ['savingsTargetAmount', 'savingsDeadline', 'savingsCustomAmount'].forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;
        const step = id === 'savingsDeadline' ? 1 : 50000;
        const isMoney = moneyInputIds.includes(id);
        input.addEventListener('wheel', (e) => {
            if (document.activeElement !== input) return;
            e.preventDefault();
            const val = isMoney ? parseInputNumber(input.value) : parseDeadlineInput(input.value);
            const dir = e.deltaY < 0 ? 'up' : 'down';
            const snapped = Math.round(val / step) * step;
            const next = Math.max(dir === 'up' ? snapped + step : snapped - step, 0);
            input.value = isMoney ? formatInputNumber(next) : next;
        }, { passive: false });
    });
}, 100);
