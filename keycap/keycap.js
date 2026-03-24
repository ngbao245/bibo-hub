// Keycap Inventory — lưu toàn bộ vào 1 record trong notes table
const API = API_CONFIG.NOTES;
const KC_TYPE = 'keycap_inventory';
const KC_TITLE = '__keycap_inventory__';

const CAT_ICONS = { keycap: '🎨', keyboard: '⌨️', switch: '🔘', other: '📦', combo: '📦' };
const CAT_LABELS = { keycap: 'Keycap', keyboard: 'Bàn phím', switch: 'Switch', other: 'Khác', combo: 'Combo' };

let items = [];
let groups = [];      // [{id, name, url, members, note}]
let recordId = null;
let currentTab = 'inventory';
let editingId = null;
let editingGroupId = null;
let saveTimer = null;
let ctxTargetId = null;

// ─── Schema ───────────────────────────────────────────────────────────────────
// items = [{
//   id: string,
//   name: string,
//   cat: 'keycap'|'keyboard'|'switch'|'other',
//   status: 'available'|'sold',
//   buyPrice: number,   // giá mua
//   sellPrice: number,  // giá muốn bán
//   actualPrice: number,// giá bán thực tế (khi đã bán)
//   date: string,       // ngày mua YYYY-MM-DD
//   note: string,
// }]

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
    setupTabs();
    renderAll();
    await loadData();
    renderAll();
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function loadData() {
    try {
        const res = await fetch(`${API}?limit=200`);
        const data = await res.json();
        const record = Array.isArray(data)
            ? data.find(d => d.type === KC_TYPE)
            : null;

        if (record) {
            recordId = record.id;
            try {
                const parsed = JSON.parse(record.content || '{}');
                // support cả format cũ (array) lẫn mới (object)
                if (Array.isArray(parsed)) {
                    items = parsed;
                } else {
                    items = parsed.items || [];
                    groups = parsed.groups || [];
                }
            } catch { items = []; groups = []; }
        }
    } catch (e) {
        console.error('Load error:', e);
    }
}

function scheduleSave() {
    setSaveStatus('saving');
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveData, 800);
}

async function saveData() {
    try {
        const body = {
            type: KC_TYPE,
            title: KC_TITLE,
            content: JSON.stringify({ items, groups }),
            source: '', tags: '', url1: '', url2: '',
        };
        const res = await fetch(
            recordId ? `${API}/${recordId}` : API,
            {
                method: recordId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }
        );
        const saved = await res.json();
        if (!recordId) recordId = saved.id;
        setSaveStatus('saved');
    } catch (e) {
        console.error('Save error:', e);
        setSaveStatus('');
    }
}

function setSaveStatus(state) {
    const el = document.getElementById('saveStatus');
    if (!el) return;
    el.className = 'save-status ' + state;
    el.textContent = state === 'saving' ? '⟳ Đang lưu...' : state === 'saved' ? '✓ Đã lưu' : '';
    if (state === 'saved') setTimeout(() => { if (el.textContent === '✓ Đã lưu') el.textContent = ''; }, 2000);
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function setupTabs() {
    document.querySelectorAll('.kc-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.kc-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            const fb = document.getElementById('filterBar');
            fb.style.display = (currentTab === 'stats' || currentTab === 'groups') ? 'none' : 'flex';
            const btnAdd = document.getElementById('btnAdd');
            if (currentTab === 'groups') {
                btnAdd.textContent = '+ Group';
                btnAdd.onclick = openAddGroupModal;
            } else {
                btnAdd.textContent = '+ Thêm';
                btnAdd.onclick = openAddModal;
            }
            renderAll();
        });
    });
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderAll() {
    renderSummary();
    if (currentTab === 'inventory') renderList('available');
    else if (currentTab === 'sold') renderList('sold');
    else if (currentTab === 'groups') renderGroups();
    else renderStats();
}

function renderSummary() {
    const available = items.filter(i => i.status === 'available');
    const incoming = items.filter(i => i.status === 'incoming');
    const sold = items.filter(i => i.status === 'sold');

    const invested = items.reduce((s, i) => s + (i.buyPrice || 0), 0);
    const potentialProfit = available.reduce((s, i) => s + calcProfit(i), 0);
    const realizedProfit = sold.reduce((s, i) => {
        if (i.type === 'combo') return s + calcProfit(i);
        const sell = i.actualPrice || i.sellPrice || 0;
        return s + (sell - (i.buyPrice || 0));
    }, 0);

    const el = document.getElementById('summaryBar');
    el.innerHTML = `
        <div class="summary-card">
            <div class="summary-label">Tổng món</div>
            <div class="summary-value sv-total">${items.length}</div>
        </div>
        <div class="summary-card">
            <div class="summary-label">Còn hàng</div>
            <div class="summary-value sv-available">${available.length}</div>
        </div>
        <div class="summary-card">
            <div class="summary-label">Đang về</div>
            <div class="summary-value" style="color:#ff9800">${incoming.length}</div>
        </div>
        <div class="summary-card">
            <div class="summary-label">Đã bán</div>
            <div class="summary-value sv-sold">${sold.length}</div>
        </div>
        <div class="summary-card">
            <div class="summary-label">Vốn đang giữ</div>
            <div class="summary-value sv-invested">${fmt(invested)}</div>
        </div>
        <div class="summary-card">
            <div class="summary-label">Tiềm năng</div>
            <div class="summary-value ${potentialProfit >= 0 ? 'sv-profit' : 'sv-loss'}">${potentialProfit >= 0 ? '+' : ''}${fmt(potentialProfit)}</div>
        </div>
        <div class="summary-card">
            <div class="summary-label">Lời thực tế</div>
            <div class="summary-value ${realizedProfit >= 0 ? 'sv-profit' : 'sv-loss'}">${realizedProfit >= 0 ? '+' : ''}${fmt(realizedProfit)}</div>
        </div>
    `;
}

function getFilteredItems(status) {
    const q = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const cat = document.getElementById('catFilter')?.value || '';
    const sort = document.getElementById('sortSelect')?.value || 'newest';

    let list = items.filter(i => i.status === status);
    if (status === 'available') list = items.filter(i => i.status === 'available' || i.status === 'incoming');
    if (q) list = list.filter(i => i.name.toLowerCase().includes(q) || (i.note || '').toLowerCase().includes(q));
    if (cat) list = list.filter(i => i.cat === cat);

    list = [...list];
    if (sort === 'newest') list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id.localeCompare(a.id));
    else if (sort === 'profit_desc') list.sort((a, b) => calcProfit(b) - calcProfit(a));
    else if (sort === 'buy_desc') list.sort((a, b) => (b.buyPrice || 0) - (a.buyPrice || 0));
    else if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));

    return list;
}

function calcProfit(item) {
    if (item.type === 'combo') {
        const totalSell = (item.subItems || []).reduce((s, si) => {
            const sp = si.status === 'sold' ? (si.actualPrice || si.sellPrice) : si.sellPrice;
            return s + (isNaN(+sp) || sp === '?' ? 0 : (+sp));
        }, 0);
        return totalSell - (item.buyPrice || 0);
    }
    const sp = item.status === 'sold'
        ? (item.actualPrice || item.sellPrice)
        : item.sellPrice;
    const sell = (sp === '?' || sp === undefined || isNaN(+sp)) ? 0 : +sp;
    return sell - (item.buyPrice || 0);
}

function renderList(status) {
    const list = getFilteredItems(status);
    const body = document.getElementById('kcBody');

    if (!list.length) {
        body.innerHTML = `<div class="kc-empty">
            ${status === 'available' ? '📦 Chưa có món nào trong kho' : '🏷️ Chưa có món nào đã bán'}<br>
            <small>${status === 'available' ? 'Nhấn "+ Thêm" hoặc "+ Combo" để thêm' : ''}</small>
        </div>`;
        return;
    }

    body.innerHTML = `<div class="kc-list">${list.map(item =>
        item.type === 'combo' ? renderComboItem(item) : renderItem(item)
    ).join('')}</div>`;
}

function renderItem(item) {
    const cat = CAT_ICONS[item.cat] || '📦';
    const catLabel = CAT_LABELS[item.cat] || item.cat;
    const sellUnknown = item.sellPrice === '?' || String(item.sellPrice || '').trim() === '?';
    const profit = calcProfit(item);
    const profitClass = profit > 0 ? 'profit-pos' : profit < 0 ? 'profit-neg' : 'profit-zero';
    const profitPct = item.buyPrice ? ` (${(profit / item.buyPrice * 100).toFixed(0)}%)` : '';
    const profitBadge = sellUnknown ? '' : `<span class="item-profit-badge ${profitClass}">${(profit > 0 ? `+${fmt(profit)}` : fmt(profit)) + profitPct}</span>`;

    const sellVal = item.status === 'sold'
        ? (item.actualPrice || item.sellPrice)
        : item.sellPrice;
    const sellDisplay = (sellVal === '?' || String(sellVal || '').trim() === '?') ? '?' : fmt(sellVal || 0);
    const buyDisplay = item.buyPrice ? fmt(item.buyPrice) : '—';

    return `<div class="kc-item status-${item.status}" onclick="openEditModal('${item.id}')" oncontextmenu="openCtxMenu(event,'${item.id}')">
        <div class="item-main">
            <div class="item-top-row">
                <span class="item-name ${item.status === 'sold' ? 'name-sold' : ''}">${esc(item.name)}</span>
                ${profitBadge}
            </div>
            <div class="item-bottom-row">
                <span class="price-in">↓ ${buyDisplay}</span>
                <span class="item-sep">→</span>
                <span class="price-out ${item.status === 'sold' ? 'price-actual' : 'price-sell'}">↑ ${sellDisplay}</span>
                ${item.note ? `<span class="item-sep">·</span><span class="item-note-chip">${esc(item.note)}</span>` : ''}
            </div>
        </div>
    </div>`;
}

function renderComboItem(item) {
    const profit = calcProfit(item);
    const profitClass = profit > 0 ? 'profit-pos' : profit < 0 ? 'profit-neg' : 'profit-zero';
    const profitStr = profit > 0 ? `+${fmt(profit)}` : fmt(profit);
    const subs = item.subItems || [];
    const soldCount = subs.filter(s => s.status === 'sold').length;

    const subRows = subs.map(si => {
        const cat = CAT_ICONS[si.cat] || '📦';
        const sell = si.status === 'sold' ? (si.actualPrice || si.sellPrice || 0) : (si.sellPrice || 0);
        const siProfit = sell - 0; // sub-item không có giá mua riêng
        return `<div class="combo-sub-row">
            <span class="combo-sub-icon">${cat}</span>
            <span class="combo-sub-name">${esc(si.name)}</span>
            <span class="status-badge badge-${si.status}" style="font-size:9px;padding:1px 5px">${si.status === 'available' ? 'Còn' : 'Đã bán'}</span>
            <span class="combo-sub-sell">${sell ? fmt(sell) : '—'}</span>
        </div>`;
    }).join('');

    return `<div class="kc-item kc-combo-item" onclick="openEditComboModal('${item.id}')">
        <div class="item-cat-icon">📦</div>
        <div class="item-body">
            <div class="item-name">
                <span class="combo-badge">COMBO</span> ${esc(item.name)}
            </div>
            <div class="item-meta">
                ${item.month ? `<span class="item-date">${item.month}</span>` : ''}
                <span class="item-cat-label">${subs.length} món · ${soldCount} đã bán</span>
                ${item.note ? `<span class="item-note">· ${esc(item.note)}</span>` : ''}
            </div>
            ${subs.length ? `<div class="combo-sub-list">${subRows}</div>` : ''}
        </div>
        <div class="item-prices">
            <div class="price-row">
                <span class="price-label">Mua:</span>
                <span class="price-buy">${fmt(item.buyPrice || 0)}</span>
            </div>
            <div class="price-row">
                <span class="price-label">Bán được:</span>
                <span class="price-actual">${fmt(subs.reduce((s, si) => s + (si.status === 'sold' ? (si.actualPrice || si.sellPrice || 0) : 0), 0))}</span>
            </div>
        </div>
        <div class="item-profit ${profitClass}">${profitStr}</div>
    </div>`;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function renderStats() {
    const body = document.getElementById('kcBody');
    if (!items.length) {
        body.innerHTML = '<div class="kc-empty">Chưa có dữ liệu</div>';
        return;
    }

    const sold = items.filter(i => i.status === 'sold');
    const available = items.filter(i => i.status === 'available');

    const totalInvested = items.reduce((s, i) => s + (i.buyPrice || 0), 0);
    const soldRevenue = sold.reduce((s, i) => s + (i.actualPrice || i.sellPrice || 0), 0);
    const soldCost = sold.reduce((s, i) => s + (i.buyPrice || 0), 0);
    const realizedProfit = soldRevenue - soldCost;
    const unrealizedProfit = available.reduce((s, i) => s + ((i.sellPrice || 0) - (i.buyPrice || 0)), 0);

    // By category
    const cats = ['keycap', 'keyboard', 'switch', 'other'];
    const catData = cats.map(c => ({
        cat: c,
        count: items.filter(i => i.cat === c).length,
        profit: items.filter(i => i.cat === c).reduce((s, i) => s + calcProfit(i), 0),
    })).filter(c => c.count > 0).sort((a, b) => b.count - a.count);
    const maxCount = Math.max(...catData.map(c => c.count), 1);

    // Top profit items
    const topProfit = [...sold].sort((a, b) => calcProfit(b) - calcProfit(a)).slice(0, 5);
    const topLoss = [...sold].sort((a, b) => calcProfit(a) - calcProfit(b)).filter(i => calcProfit(i) < 0).slice(0, 3);

    body.innerHTML = `<div class="stats-grid">
        <div class="stat-section">
            <div class="stat-title">💰 Tổng quan tài chính</div>
            <div class="stat-row"><span class="stat-row-label">Tổng vốn bỏ ra</span><span class="stat-row-value" style="color:#ff9800">${fmt(totalInvested)}</span></div>
            <div class="stat-row"><span class="stat-row-label">Doanh thu đã bán</span><span class="stat-row-value" style="color:#42a5f5">${fmt(soldRevenue)}</span></div>
            <div class="stat-row"><span class="stat-row-label">Lời/lỗ thực tế</span><span class="stat-row-value ${realizedProfit >= 0 ? 'profit-pos' : 'profit-neg'}">${realizedProfit >= 0 ? '+' : ''}${fmt(realizedProfit)}</span></div>
            <div class="stat-row"><span class="stat-row-label">Tiềm năng (còn hàng)</span><span class="stat-row-value ${unrealizedProfit >= 0 ? 'profit-pos' : 'profit-neg'}">${unrealizedProfit >= 0 ? '+' : ''}${fmt(unrealizedProfit)}</span></div>
            <div class="stat-row"><span class="stat-row-label">Vốn đang giữ</span><span class="stat-row-value" style="color:#ff9800">${fmt(available.reduce((s, i) => s + (i.buyPrice || 0), 0))}</span></div>
            ${sold.length ? `<div class="stat-row"><span class="stat-row-label">Tỷ suất lợi nhuận</span><span class="stat-row-value ${realizedProfit >= 0 ? 'profit-pos' : 'profit-neg'}">${soldCost ? (realizedProfit / soldCost * 100).toFixed(1) : 0}%</span></div>` : ''}
        </div>

        <div class="stat-section">
            <div class="stat-title">📊 Theo danh mục</div>
            ${catData.map(c => `
                <div class="cat-stat-row">
                    <span class="cat-stat-name">${CAT_ICONS[c.cat]} ${CAT_LABELS[c.cat]}</span>
                    <div class="cat-stat-bar-bg"><div class="cat-stat-bar-fg" style="width:${Math.round(c.count / maxCount * 100)}%"></div></div>
                    <span class="cat-stat-val">${c.count} món</span>
                </div>
            `).join('')}
        </div>

        ${topProfit.length ? `<div class="stat-section">
            <div class="stat-title">🏆 Lời nhiều nhất</div>
            ${topProfit.map(i => `
                <div class="stat-row">
                    <span class="stat-row-label" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(i.name)}</span>
                    <span class="stat-row-value profit-pos">+${fmt(calcProfit(i))}</span>
                </div>
            `).join('')}
        </div>` : ''}

        ${topLoss.length ? `<div class="stat-section">
            <div class="stat-title">📉 Lỗ</div>
            ${topLoss.map(i => `
                <div class="stat-row">
                    <span class="stat-row-label" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(i.name)}</span>
                    <span class="stat-row-value profit-neg">${fmt(calcProfit(i))}</span>
                </div>
            `).join('')}
        </div>` : ''}
    </div>`;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function openAddModal() {
    editingId = null;
    document.getElementById('modalTitle').textContent = 'Thêm món';
    initNameRows(['']);
    document.getElementById('fCat').value = 'keycap';
    document.getElementById('fStatus').value = 'available';
    document.getElementById('fBuyPrice').value = '';
    document.getElementById('fSellPrice').value = '';
    initMonthSelects();
    setMonthValue('');
    document.getElementById('fNote').value = '';
    document.getElementById('btnDelete').style.display = 'none';
    document.getElementById('btnAddName').style.display = 'inline-block';
    updateProfit();
    document.getElementById('itemModal').classList.add('show');
    setTimeout(() => document.querySelector('#nameRows .name-input')?.focus(), 50);
}

function openEditModal(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    editingId = id;
    document.getElementById('modalTitle').textContent = 'Sửa món';
    initNameRows([item.name], [item.sellPrice || '']);
    document.getElementById('fCat').value = item.cat || 'keycap';
    document.getElementById('fStatus').value = item.status || 'available';
    document.getElementById('fBuyPrice').value = item.buyPrice || '';
    document.getElementById('fSellPrice').value = item.sellPrice || '';
    initMonthSelects();
    setMonthValue(item.month || '');
    document.getElementById('fNote').value = item.note || '';
    document.getElementById('btnDelete').style.display = 'block';
    document.getElementById('btnAddName').style.display = 'none'; // edit thì không thêm tên
    updateProfit();
    document.getElementById('itemModal').classList.add('show');
    setTimeout(() => document.querySelector('#nameRows .name-input')?.focus(), 50);
}

function closeItemModal() {
    document.getElementById('itemModal').classList.remove('show');
    editingId = null;
}

function closeModalOutside(e) {
    if (e.target === document.getElementById('itemModal')) closeItemModal();
}

function updateProfit() {
    const nameRows = document.querySelectorAll('#nameRows .name-row');
    const multi = nameRows.length > 1;

    const buy = parsePrice(document.getElementById('fBuyPrice').value);
    const actual = 0;
    const sell = multi
        ? [...nameRows].reduce((s, row) => s + parsePrice(row.querySelector('.name-sell')?.value || ''), 0)
        : parsePrice(document.getElementById('fSellPrice').value);

    const el = document.getElementById('profitPreview');
    if (!buy && !sell && !actual) { el.innerHTML = ''; return; }

    const potProfit = sell - buy;
    const realProfit = actual ? actual - buy : null;
    const potPct = buy ? (potProfit / buy * 100).toFixed(1) : null;
    const realPct = (buy && realProfit !== null) ? (realProfit / buy * 100).toFixed(1) : null;

    el.innerHTML = `
        ${buy ? `<div class="pp-item"><div class="pp-label">Vốn</div><div class="pp-value" style="color:#ff9800">${fmt(buy)}</div></div>` : ''}
        ${sell ? `<div class="pp-item"><div class="pp-label">Tiềm năng</div><div class="pp-value ${potProfit >= 0 ? 'profit-pos' : 'profit-neg'}">${potProfit >= 0 ? '+' : ''}${fmt(potProfit)}${potPct !== null ? ` <span style="font-size:11px;opacity:0.8">(${potPct}%)</span>` : ''}</div></div>` : ''}
        ${realProfit !== null ? `<div class="pp-item"><div class="pp-label">Lời thực tế</div><div class="pp-value ${realProfit >= 0 ? 'profit-pos' : 'profit-neg'}">${realProfit >= 0 ? '+' : ''}${fmt(realProfit)}${realPct !== null ? ` <span style="font-size:11px;opacity:0.8">(${realPct}%)</span>` : ''}</div></div>` : ''}
    `;
}

function saveItem() {
    const rows = getNameRows();
    if (!rows.length) { document.querySelector('#nameRows .name-input')?.focus(); return; }

    const multi = rows.length > 1;
    const sharedSellRaw = document.getElementById('fSellPrice').value.trim();
    const sharedSell = sharedSellRaw === '?' ? '?' : parsePrice(sharedSellRaw);

    const base = {
        cat: document.getElementById('fCat').value,
        status: document.getElementById('fStatus').value,
        buyPrice: parsePrice(document.getElementById('fBuyPrice').value),
        month: getMonthValue(),
        note: document.getElementById('fNote').value.trim(),
    };

    if (editingId) {
        const idx = items.findIndex(i => i.id === editingId);
        if (idx !== -1) items[idx] = {
            ...base,
            id: editingId,
            name: rows[0].name,
            sellPrice: sharedSell,
        };
    } else {
        const newItems = rows.map((row, i) => ({
            ...base,
            buyPrice: i === 0 ? base.buyPrice : 0, // chỉ item đầu giữ giá mua
            id: 'kc_' + (Date.now() + i),
            name: row.name,
            sellPrice: multi ? (row.sellPrice === '?' ? '?' : parsePrice(row.sellPrice)) : sharedSell,
        }));
        items.unshift(...newItems);
    }

    closeItemModal();
    renderAll();
    scheduleSave();
}

function deleteItem() {
    if (!editingId) return;
    if (!confirm('Xóa món này?')) return;
    items = items.filter(i => i.id !== editingId);
    closeItemModal();
    renderAll();
    scheduleSave();
}

// ─── Groups ───────────────────────────────────────────────────────────────────

function renderGroups() {
    const body = document.getElementById('kcBody');
    if (!groups.length) {
        body.innerHTML = `<div class="kc-empty">👥 Chưa có group nào<br><small>Nhấn "+ Group" để thêm</small></div>`;
        return;
    }
    body.innerHTML = `<div class="kc-list">${groups.map(g => `
        <div class="kc-item" style="border-left-color:#7e57c2;cursor:pointer" onclick="${g.url ? `window.open('${esc(g.url)}','_blank')` : `openEditGroupModal('${g.id}')`}">
            <div class="item-cat-icon">👥</div>
            <div class="item-body">
                <div class="item-name">${esc(g.name)}</div>
                <div class="item-meta">
                    ${g.members ? `<span class="item-cat-label">${esc(g.members)} thành viên</span>` : ''}
                    ${g.note ? `<span class="item-note">· ${esc(g.note)}</span>` : ''}
                </div>
            </div>
            <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
                <button class="btn-secondary" style="padding:4px 10px;font-size:11px" onclick="event.stopPropagation();openEditGroupModal('${g.id}')">Sửa</button>
            </div>
        </div>
    `).join('')}</div>`;
}

function openAddGroupModal() {
    editingGroupId = null;
    document.getElementById('groupModalTitle').textContent = 'Thêm group';
    document.getElementById('gName').value = '';
    document.getElementById('gUrl').value = '';
    document.getElementById('gMembers').value = '';
    document.getElementById('gNote').value = '';
    document.getElementById('btnDeleteGroup').style.display = 'none';
    document.getElementById('groupModal').classList.add('show');
    setTimeout(() => document.getElementById('gName').focus(), 50);
}

function openEditGroupModal(id) {
    const g = groups.find(g => g.id === id);
    if (!g) return;
    editingGroupId = id;
    document.getElementById('groupModalTitle').textContent = 'Sửa group';
    document.getElementById('gName').value = g.name;
    document.getElementById('gUrl').value = g.url || '';
    document.getElementById('gMembers').value = g.members || '';
    document.getElementById('gNote').value = g.note || '';
    document.getElementById('btnDeleteGroup').style.display = 'block';
    document.getElementById('groupModal').classList.add('show');
    setTimeout(() => document.getElementById('gName').focus(), 50);
}

function closeGroupModal() {
    document.getElementById('groupModal').classList.remove('show');
    editingGroupId = null;
}

function closeGroupModalOutside(e) {
    if (e.target === document.getElementById('groupModal')) closeGroupModal();
}

function saveGroup() {
    const name = document.getElementById('gName').value.trim();
    if (!name) { document.getElementById('gName').focus(); return; }

    const g = {
        id: editingGroupId || ('grp_' + Date.now()),
        name,
        url: document.getElementById('gUrl').value.trim(),
        members: document.getElementById('gMembers').value.trim(),
        note: document.getElementById('gNote').value.trim(),
    };

    if (editingGroupId) {
        const idx = groups.findIndex(g => g.id === editingGroupId);
        if (idx !== -1) groups[idx] = g;
    } else {
        groups.push(g);
    }

    closeGroupModal();
    renderGroups();
    scheduleSave();
}

function deleteGroup() {
    if (!editingGroupId) return;
    if (!confirm('Xóa group này?')) return;
    groups = groups.filter(g => g.id !== editingGroupId);
    closeGroupModal();
    renderGroups();
    scheduleSave();
}

// ─── Multi-name helpers ───────────────────────────────────────────────────────

function initNameRows(names, sellPrices = []) {
    const container = document.getElementById('nameRows');
    container.innerHTML = '';
    names.forEach((n, i) => appendNameRow(n, sellPrices[i] || ''));
    syncSellPriceField();
}

function addNameRow() {
    appendNameRow('', '');
    syncSellPriceField();
    autoCat();
    document.querySelectorAll('#nameRows .name-input').forEach((el, i, arr) => {
        if (i === arr.length - 1) el.focus();
    });
}

function appendNameRow(value, sellPrice) {
    const container = document.getElementById('nameRows');
    const isFirst = container.children.length === 0;
    const div = document.createElement('div');
    div.className = 'name-row';
    div.style.cssText = 'display:flex;gap:5px;align-items:center';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'form-input name-input';
    nameInput.placeholder = 'Tên món...';
    nameInput.value = value || '';
    nameInput.style.flex = '1';
    nameInput.addEventListener('input', autoCat);
    nameInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            addNameRow();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const allInputs = [...document.querySelectorAll('#itemModal input, #itemModal select')];
            const idx = allInputs.indexOf(e.target);
            if (idx !== -1 && idx < allInputs.length - 1) allInputs[idx + 1].focus();
        }
    });

    const sellInput = document.createElement('input');
    sellInput.type = 'text';
    sellInput.className = 'form-input name-sell';
    sellInput.placeholder = 'Giá bán';
    sellInput.value = sellPrice || '';
    sellInput.style.cssText = 'width:90px;flex-shrink:0';
    sellInput.addEventListener('input', updateProfit);
    sellInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            addNameRow();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const allInputs = [...document.querySelectorAll('#itemModal input, #itemModal select')];
            const idx = allInputs.indexOf(e.target);
            if (idx !== -1 && idx < allInputs.length - 1) allInputs[idx + 1].focus();
        }
    });

    div.appendChild(nameInput);
    div.appendChild(sellInput);

    if (!isFirst) {
        const btn = document.createElement('button');
        btn.className = 'btn-danger';
        btn.style.cssText = 'padding:4px 8px;flex-shrink:0';
        btn.textContent = '✕';
        btn.onclick = () => { div.remove(); syncSellPriceField(); autoCat(); updateProfit(); };
        div.appendChild(btn);
    }

    container.appendChild(div);
}

function syncSellPriceField() {
    // Nếu chỉ 1 dòng: ẩn ô giá bán trên dòng, dùng field chung
    // Nếu nhiều dòng: hiện ô giá bán trên từng dòng, ẩn field giá bán chung (giá mua chung vẫn giữ)
    const rows = document.querySelectorAll('#nameRows .name-row');
    const multi = rows.length > 1;
    rows.forEach(row => {
        const sellInput = row.querySelector('.name-sell');
        if (sellInput) sellInput.style.display = multi ? '' : 'none';
    });
    const sellField = document.getElementById('fSellPrice');
    if (sellField) sellField.closest('.form-row').style.display = multi ? 'none' : '';
}

function autoCat() {
    const multi = document.querySelectorAll('#nameRows .name-row').length > 1;
    const cat = document.getElementById('fCat');
    if (!cat) return;
    const nonCombo = ['keycap', 'keyboard', 'switch', 'other'];
    if (multi && nonCombo.includes(cat.value)) { cat.value = 'combo'; return; }
    if (!multi && cat.value === 'combo') cat.value = 'keycap';

    // Auto detect từ tên món (chỉ khi single)
    if (!multi) {
        const name = document.querySelector('#nameRows .name-input')?.value.toLowerCase() || '';
        if (/switch/.test(name)) cat.value = 'switch';
        else if (/keyboard|bàn phím|ban phim/.test(name)) cat.value = 'keyboard';
        else if (/keycap/.test(name)) cat.value = 'keycap';
    }
}

function getNameRows() {
    return [...document.querySelectorAll('#nameRows .name-row')].map(row => ({
        name: row.querySelector('.name-input').value.trim(),
        sellPrice: row.querySelector('.name-sell')?.value.trim() || '',
    })).filter(r => r.name);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePrice(val) {
    if (!val) return 0;
    const s = String(val).trim();
    if (s === '?' || s === '') return 0; // "?" = chưa xác định

    // 1tr2, 1tr25, 1 triệu 2
    const trTail = s.match(/^(\d[\d.,]*)\s*(tr|triệu|trieu|củ|cu)\s*(\d{1,3})\b/i);
    if (trTail) {
        const head = parseFloat(trTail[1].replace(/,/g, '.'));
        const tail = trTail[3];
        let amt = Math.round(head * 1_000_000);
        if (tail.length === 1) amt += parseInt(tail) * 100_000;
        else if (tail.length === 2) amt += parseInt(tail) * 10_000;
        else amt += parseInt(tail.slice(0, 3)) * 1_000;
        return amt;
    }

    // 1tr, 1.5tr, 1 triệu
    const tr = s.match(/^(\d[\d.,]*)\s*(tr|triệu|trieu|củ|cu)\b/i);
    if (tr) return Math.round(parseFloat(tr[1].replace(/,/g, '.')) * 1_000_000);

    // 70k, 70 ngàn
    const k = s.match(/^(\d[\d.,]*)\s*(k|ngàn|ngan|nghìn|nghin)\b/i);
    if (k) return Math.round(parseFloat(k[1].replace(/,/g, '.')) * 1_000);

    // số thuần: nếu < 1000 thì nhân 1000 (70 → 70k), ngược lại giữ nguyên
    const raw = parseFloat(s.replace(/[.,\s]/g, '')) || 0;
    return raw > 0 && raw < 1000 ? raw * 1_000 : raw;
}

function fmt(n) {
    if (n === '?' || n === null || n === undefined) return '?';
    if (!n && n !== 0) return '—';
    return Number(n).toLocaleString('vi-VN') + 'đ';
}

function fmtSell(val) {
    // val có thể là number hoặc string "?"
    if (val === '?' || String(val).trim() === '?') return '?';
    return fmt(val);
}

function fmtDate(d) {
    if (!d) return '';
    try {
        return new Date(d + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' });
    } catch { return d; }
}

function toLocalDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function currentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function initMonthSelects() {
    const mSel = document.getElementById('fMonthSel');
    const ySel = document.getElementById('fYearSel');
    if (mSel.options.length) return; // đã init rồi

    const months = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
        'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
    months.forEach((m, i) => {
        const opt = document.createElement('option');
        opt.value = String(i + 1).padStart(2, '0');
        opt.textContent = m;
        mSel.appendChild(opt);
    });

    const curYear = new Date().getFullYear();
    for (let y = curYear; y >= curYear - 5; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        ySel.appendChild(opt);
    }
}

function setMonthValue(val) {
    // val = "YYYY-MM" hoặc ""
    const d = val ? val.split('-') : [new Date().getFullYear(), String(new Date().getMonth() + 1).padStart(2, '0')];
    document.getElementById('fYearSel').value = d[0];
    document.getElementById('fMonthSel').value = d[1];
}

function getMonthValue() {
    const m = document.getElementById('fMonthSel').value;
    const y = document.getElementById('fYearSel').value;
    return `${y}-${m}`;
}

function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Context menu ─────────────────────────────────────────────────────────────

function openCtxMenu(e, id) {
    e.preventDefault();
    e.stopPropagation();

    const menu = document.getElementById('ctxMenu');

    // Nếu menu đang mở và click vào cùng item, đóng menu
    if (menu.classList.contains('show') && ctxTargetId === id) {
        closeCtxMenu();
        return;
    }

    ctxTargetId = id;
    const item = items.find(i => i.id === id);
    if (!item) return;

    document.getElementById('ctxSell').style.display = item.status !== 'sold' ? '' : 'none';
    document.getElementById('ctxUnsell').style.display = item.status === 'sold' ? '' : 'none';

    // position
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 120);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.add('show');

    // Add event listeners to close menu
    setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
    }, 0);
}

function handleClickOutside(e) {
    const menu = document.getElementById('ctxMenu');
    if (menu && !menu.contains(e.target)) {
        closeCtxMenu();
    }
}

function closeCtxMenu() {
    document.getElementById('ctxMenu')?.classList.remove('show');
    ctxTargetId = null;
    document.removeEventListener('click', handleClickOutside);
}

function ctxMarkSold() {
    if (!ctxTargetId) return;
    const item = items.find(i => i.id === ctxTargetId);
    if (item) { item.status = 'sold'; renderAll(); scheduleSave(); }
    closeCtxMenu();
}

function ctxMarkUnsold() {
    if (!ctxTargetId) return;
    const item = items.find(i => i.id === ctxTargetId);
    if (item) { item.status = 'available'; renderAll(); scheduleSave(); }
    closeCtxMenu();
}

function ctxDelete() {
    if (!ctxTargetId) return;
    if (!confirm('Xóa món này?')) return;
    items = items.filter(i => i.id !== ctxTargetId);
    closeCtxMenu();
    renderAll();
    scheduleSave();
}

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeItemModal(); closeGroupModal(); closeCtxMenu(); }
        if (e.key === 's' && e.ctrlKey) {
            e.preventDefault();
            if (document.getElementById('itemModal').classList.contains('show')) saveItem();
            else if (document.getElementById('groupModal').classList.contains('show')) saveGroup();
        }
    });

    // Enter → next input trong modal (trừ name-input đã xử lý riêng)
    document.getElementById('itemModal').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey && !e.target.classList.contains('name-input')) {
            const tag = e.target.tagName;
            if (tag === 'INPUT' || tag === 'SELECT') {
                e.preventDefault();
                const allInputs = [...document.querySelectorAll('#itemModal input, #itemModal select')];
                const idx = allInputs.indexOf(e.target);
                if (idx !== -1 && idx < allInputs.length - 1) allInputs[idx + 1].focus();
            }
        }
    });

    init();
});
