// Orders App — 1 record per day
const API = API_CONFIG.NOTES;
const ORDER_TYPE = 'order';

// allDays: array of day records { id, source, url3, content, ... }
// Each day.content = "name\tqty\tspx\tstatus\toptions|name\t..." 
//   status: pending|ordered|cancelled
//   options: "optName~qty;optName~qty" or ""
let allDays = [];
let currentTab = 'admin';

// ─── Pending saves ────────────────────────────────────────────────────────────

let pendingSaves = 0;
function setPending(d) { pendingSaves = Math.max(0, pendingSaves + d); }
window.addEventListener('beforeunload', e => {
    if (pendingSaves > 0) { e.preventDefault(); e.returnValue = ''; }
});

// ─── Serialize / Parse ────────────────────────────────────────────────────────

function serializeItems(items) {
    return items.map(it => [
        (it.name || '').replace(/\t/g, ' ').replace(/\|/g, ' '),
        (it.qty || '1'),
        (it.spx || '').replace(/\t/g, ' ').replace(/\|/g, ' '),
        (it.status || 'pending'),
        serializeOptions(it.options || []),
        (it.url || '').replace(/\t/g, ' ').replace(/\|/g, ' ')
    ].join('\t')).join('|');
}

function parseItems(content) {
    if (!content || !content.trim()) return [];
    return content.split('|').map(s => {
        const parts = s.split('\t');
        return {
            name:    parts[0] || '',
            qty:     parts[1] || '1',
            spx:     parts[2] || '',
            status:  parts[3] || 'pending',
            options: parseOptions(parts[4] || ''),
            url:     parts[5] || ''
        };
    }).filter(it => it.name);
}

function serializeOptions(opts) {
    if (!opts || !opts.length) return '';
    return opts.map(o => `${(o.name||'').replace(/[~;]/g,'')}~${o.qty||'1'}`).join(';');
}

function parseOptions(str) {
    if (!str) return [];
    return str.split(';').map(s => {
        const i = s.lastIndexOf('~');
        if (i === -1) return { name: s.trim(), qty: '1' };
        return { name: s.slice(0, i).trim(), qty: s.slice(i + 1).trim() || '1' };
    }).filter(o => o.name);
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function loadDays() {
    try {
        const res = await fetch(`${API}?limit=200`);
        const data = await res.json();
        allDays = Array.isArray(data) ? data.filter(d => d.type === ORDER_TYPE) : [];
        allDays.sort((a, b) => (b.source || '').localeCompare(a.source || ''));
    } catch (e) {
        console.error('Load error:', e);
        allDays = [];
    }
}

async function apiSave(data) {
    const method = data.id ? 'PUT' : 'POST';
    const url = data.id ? `${API}/${data.id}` : API;
    setPending(+1);
    try {
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    } finally {
        setPending(-1);
    }
}

async function apiDelete(id) {
    await fetch(`${API}/${id}`, { method: 'DELETE' });
}

// Save a day record (optimistic: update allDays immediately, then persist)
function saveDay(day) {
    const idx = allDays.findIndex(d => d.source === day.source);
    if (idx !== -1) allDays[idx] = { ...allDays[idx], ...day };
    else allDays.unshift(day);
    render();
    return apiSave(day);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
    if (!dateStr) return 'Không rõ ngày';
    try {
        const d = new Date(dateStr + 'T00:00:00');
        // dd/MM/yyyy - weekday
        return d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return dateStr; }
}

function formatPrice(val) {
    if (!val) return '';
    const num = parseInt(String(val).replace(/\D/g, ''));
    return isNaN(num) ? val : num.toLocaleString('vi-VN') + 'đ';
}

function esc(str) {
    return String(str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseShopeeUrl(input) {
    try {
        const url = new URL(input.trim());
        if (!url.hostname.includes('shopee')) return null;
        const parts = url.pathname.split('/').filter(Boolean);
        const slug = parts.find(p => p.includes('.i.')) || parts[parts.length - 1];
        const name = slug.replace(/\.i\.\d+\.\d+.*$/, '');
        return { name: decodeURIComponent(name).replace(/-/g, ' ').trim(), url: input.trim() };
    } catch { return null; }
}

function getDayRecord(date) {
    return allDays.find(d => d.source === date);
}

// ─── Render ───────────────────────────────────────────────────────────────────

function render() {
    if (currentTab === 'admin') renderAdmin();
    else renderCustomer();
}

function renderAdmin() {
    const container = document.getElementById('adminDaysList');
    if (allDays.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">Chưa có đơn hàng nào</div></div>`;
        return;
    }

    container.innerHTML = allDays.map(day => {
        const date = day.source;
        const items = parseItems(day.content);
        const hasUnordered = items.length > 0 && items.some(it => it.status === 'pending');
        const groupClass = hasUnordered ? 'day-incomplete' : 'day-complete';
        const badge = hasUnordered
            ? `<span class="day-status-badge badge-warn">⚠ Chưa đặt đủ</span>`
            : `<span class="day-status-badge badge-ok">✓ Đã đặt đủ</span>`;
        const priceHtml = day.url3
            ? `<span class="day-price" onclick="editDayPrice('${date}')">${formatPrice(day.url3)}</span>`
            : `<span class="day-price muted" onclick="editDayPrice('${date}')">+ Thêm giá</span>`;

        const rows = items.map((it, idx) => renderAdminRow(date, it, idx)).join('');

        return `<div class="day-group ${groupClass}" data-date="${date}">
            <div class="day-header">
                <div class="day-header-left">
                    <span class="day-date">${formatDate(date)}</span>
                    <div class="day-meta">${priceHtml}${badge}</div>
                </div>
                <div class="day-header-actions">
                    ${items.some(it => it.url) ? `<button class="btn-day-action" onclick="openAllLinks('${date}')" title="Mở tất cả link Shopee">🔗 Mở tất cả</button>` : ''}
                    <button class="btn-day-action danger" onclick="confirmDeleteDay('${date}')">🗑</button>
                </div>
            </div>
            <div class="items-header">
                <span>Sản phẩm</span>
                <span style="padding-right:8px;text-align:right;">SPX</span>
                <span class="col-check">Đặt</span>
                <span class="col-check">Hủy</span>
                <span class="col-edit"></span>
            </div>
            <div class="items-list">
                ${rows}
                <div class="paste-zone" onclick="focusPasteZone('${date}')">
                    <textarea class="paste-textarea" id="paste-ta-${date}"
                        placeholder="Paste link Shopee hoặc nhập tên, Enter để thêm..."
                        onkeydown="pasteZoneKeydown(event,'${date}')"
                        onpaste="pasteZonePaste(event,'${date}')"
                        rows="1"></textarea>
                </div>
            </div>
        </div>`;
    }).join('');
}

function renderAdminRow(date, it, idx) {
    const isOrdered = it.status === 'ordered';
    const isCancelled = it.status === 'cancelled';
    const rowClass = isCancelled ? 'is-cancelled' : (!isOrdered ? 'is-pending' : '');
    const spxHtml = it.spx
        ? `<span class="spx-badge" onclick="openSpx('${esc(it.spx)}')">${esc(it.spx)}</span>`
        : `<span class="spx-empty-hint">+ SPX</span>`;

    const hasOpts = it.options.length > 0;
    const optsHtml = hasOpts ? `
        <div class="item-options" id="opts-${date}-${idx}" style="display:none;">
            ${it.options.map((o, oi) => `
                <div class="option-row">
                    <span class="option-name editable" onclick="inlineEditOption(this,'${date}',${idx},${oi},'name')">${esc(o.name)}</span>
                    <span class="option-qty editable" onclick="inlineEditOption(this,'${date}',${idx},${oi},'qty')">x${esc(o.qty)}</span>
                    <button class="btn-option-del" onclick="deleteOption('${date}',${idx},${oi})">✕</button>
                </div>`).join('')}
            <button class="btn-add-option" onclick="addOption('${date}',${idx})">+ Thêm option</button>
        </div>` : '';

    const toggleBtn = `<button class="btn-toggle-opts ${hasOpts ? '' : 'btn-toggle-opts-empty'}"
        onclick="toggleOptions('${date}',${idx})">
        ${hasOpts ? `<span class="opts-count">${it.options.length}</span> ▾` : '+ opt'}
    </button>`;

    return `<div class="item-wrap" data-date="${date}" data-idx="${idx}">
        <div class="item-row ${rowClass}">
            <div class="item-main">
                <span class="item-name editable" 
                    onclick="inlineEditItem(this,'${date}',${idx},'name')"
                    onmousedown="handleNameMousedown(event,'${date}',${idx})">${esc(it.name)}</span>
                <div class="item-sub">
                    <span class="item-qty editable" onclick="inlineEditItem(this,'${date}',${idx},'qty')">x${esc(it.qty)}</span>
                    ${toggleBtn}
                </div>
            </div>
            <div class="item-spx" onclick="inlineEditItem(this,'${date}',${idx},'spx')">${spxHtml}</div>
            <div class="item-check">
                <input type="checkbox" ${isOrdered ? 'checked' : ''}
                    onchange="toggleStatus('${date}',${idx},'ordered',this.checked)"
                    ${isCancelled ? 'disabled' : ''}>
            </div>
            <div class="item-check check-cancel">
                <input type="checkbox" ${isCancelled ? 'checked' : ''}
                    onchange="toggleStatus('${date}',${idx},'cancelled',this.checked)">
            </div>
            <div class="item-edit">
                <button class="btn-item-edit" onclick="deleteItemRow('${date}',${idx})">✕</button>
            </div>
        </div>
        ${optsHtml}
    </div>`;
}

function renderCustomer() {
    const container = document.getElementById('customerDaysList');
    if (allDays.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-text">Chưa có đơn hàng nào</div></div>`;
        return;
    }

    container.innerHTML = allDays.map(day => {
        const items = parseItems(day.content);
        const itemsHtml = items.map(it => {
            const isCancelled = it.status === 'cancelled';
            const isOrdered = it.status === 'ordered';
            const dotClass = isCancelled ? 'dot-cancelled' : (isOrdered ? 'dot-ordered' : 'dot-pending');
            const pillClass = isCancelled ? 'pill-cancelled' : (isOrdered ? 'pill-ordered' : 'pill-pending');
            const statusLabel = isCancelled ? 'Đã hủy' : (isOrdered ? 'Đã đặt' : 'Chờ đặt');
            const spxHtml = it.spx ? `<span class="spx-badge" onclick="openSpx('${esc(it.spx)}')">${esc(it.spx)}</span>` : '';
            const optsHtml = it.options.map(o => `<div class="customer-option">↳ ${esc(o.name)} x${esc(o.qty)}</div>`).join('');
            return `<div class="customer-item ${isCancelled ? 'is-cancelled' : ''}">
                <span class="status-dot ${dotClass}"></span>
                <div class="customer-item-info">
                    <div class="customer-item-name">${esc(it.name)}</div>
                    <div class="customer-item-qty">x${esc(it.qty)}</div>
                    ${optsHtml}
                </div>
                <div class="customer-item-right">
                    ${spxHtml}
                    <span class="status-pill ${pillClass}">${statusLabel}</span>
                </div>
            </div>`;
        }).join('');

        return `<div class="customer-day-group">
            <div class="customer-day-header">
                <span class="customer-day-date">${formatDate(day.source)}</span>
                ${day.url3 ? `<span class="customer-day-price">${formatPrice(day.url3)}</span>` : ''}
            </div>
            ${itemsHtml}
        </div>`;
    }).join('');
}

// ─── Mutate day items ─────────────────────────────────────────────────────────

function mutateDayItems(date, mutator) {
    const day = getDayRecord(date);
    if (!day) return;
    const items = parseItems(day.content);
    mutator(items);
    day.content = serializeItems(items);
    saveDay(day);
}

// ─── Inline edit item fields ──────────────────────────────────────────────────

function inlineEditItem(el, date, idx, field) {
    if (el.querySelector('input')) return;
    const day = getDayRecord(date);
    if (!day) return;
    const items = parseItems(day.content);
    const it = items[idx];
    if (!it) return;

    const isQty = field === 'qty';
    const isSpx = field === 'spx';
    const currentVal = it[field] || (isQty ? '1' : '');

    const input = document.createElement('input');
    input.className = 'inline-input' + (isQty ? ' inline-input-qty' : isSpx ? ' inline-input-spx' : '');
    input.type = isQty ? 'number' : 'text';
    input.value = currentVal;
    if (isQty) input.min = '1';
    if (isSpx) input.placeholder = 'Mã SPX...';

    if (isQty) {
        input.addEventListener('wheel', e => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 1 : -1;
            const val = Math.max(1, parseInt(input.value || '1') + delta);
            input.value = String(val);
        }, { passive: false });
    }

    const save = async () => {
        const val = input.value.trim();
        if (val === currentVal && !input._pendingUrl) { render(); return; }
        mutateDayItems(date, its => {
            its[idx][field] = val || currentVal;
            if (input._pendingUrl !== undefined) its[idx].url = input._pendingUrl;
        });
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') render();
    });

    if (field === 'name') {
        input.addEventListener('paste', e => {
            const pasted = (e.clipboardData || window.clipboardData).getData('text');
            const parsed = parseShopeeUrl(pasted);
            if (parsed) {
                e.preventDefault();
                input.value = parsed.name;
                input._pendingUrl = parsed.url;
            }
        });
    }

    if (isSpx) { el.innerHTML = ''; el.appendChild(input); }
    else el.replaceWith(input);
    input.focus(); input.select();
}

// ─── Toggle status ────────────────────────────────────────────────────────────

function toggleStatus(date, idx, status, checked) {
    mutateDayItems(date, items => {
        items[idx].status = checked ? status : 'pending';
    });
}

// ─── Delete item row ──────────────────────────────────────────────────────────

function deleteItemRow(date, idx) {
    if (!confirm('Xóa sản phẩm này?')) return;
    mutateDayItems(date, items => items.splice(idx, 1));
}

// ─── Options ──────────────────────────────────────────────────────────────────

function toggleOptions(date, idx) {
    const el = document.getElementById(`opts-${date}-${idx}`);
    if (!el) { addOption(date, idx); return; }
    const isOpen = el.style.display !== 'none';
    el.style.display = isOpen ? 'none' : 'block';
    const wrap = document.querySelector(`.item-wrap[data-date="${date}"][data-idx="${idx}"]`);
    if (wrap) {
        const btn = wrap.querySelector('.btn-toggle-opts');
        if (btn) {
            const day = getDayRecord(date);
            const count = day ? parseItems(day.content)[idx]?.options.length || 0 : 0;
            btn.innerHTML = isOpen ? `<span class="opts-count">${count}</span> ▾` : `<span class="opts-count">${count}</span> ▴`;
        }
    }
}

function addOption(date, idx) {
    mutateDayItems(date, items => {
        items[idx].options.push({ name: 'Option mới', qty: '1' });
    });
    setTimeout(() => {
        const el = document.getElementById(`opts-${date}-${idx}`);
        if (el) {
            el.style.display = 'block';
            const rows = el.querySelectorAll('.option-row');
            const last = rows[rows.length - 1];
            if (last) {
                const nameEl = last.querySelector('.option-name');
                const day = getDayRecord(date);
                if (nameEl && day) {
                    const oi = parseItems(day.content)[idx]?.options.length - 1;
                    inlineEditOption(nameEl, date, idx, oi, 'name');
                }
            }
        }
    }, 50);
}

function inlineEditOption(el, date, idx, oi, field) {
    if (el.querySelector('input')) return;
    const day = getDayRecord(date);
    if (!day) return;
    const items = parseItems(day.content);
    const opt = items[idx]?.options[oi];
    if (!opt) return;

    const currentVal = opt[field] || '';
    const input = document.createElement('input');
    input.className = 'inline-input' + (field === 'qty' ? ' inline-input-qty' : ' inline-input-option');
    input.type = field === 'qty' ? 'number' : 'text';
    input.value = currentVal;
    if (field === 'qty') input.min = '1';

    if (field === 'qty') {
        input.addEventListener('wheel', e => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 1 : -1;
            const val = Math.max(1, parseInt(input.value || '1') + delta);
            input.value = String(val);
        }, { passive: false });
    }

    const save = () => {
        const val = input.value.trim();
        if (!val || val === currentVal) { render(); reopenOptions(date, idx); return; }
        mutateDayItems(date, its => { its[idx].options[oi][field] = val; });
        setTimeout(() => reopenOptions(date, idx), 50);
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') { render(); reopenOptions(date, idx); }
    });

    el.replaceWith(input);
    input.focus(); input.select();
}

function deleteOption(date, idx, oi) {
    mutateDayItems(date, items => items[idx].options.splice(oi, 1));
    setTimeout(() => reopenOptions(date, idx), 50);
}

function reopenOptions(date, idx) {
    const el = document.getElementById(`opts-${date}-${idx}`);
    if (el) el.style.display = 'block';
}

// ─── Paste zone ───────────────────────────────────────────────────────────────

function focusPasteZone(date) {
    const ta = document.getElementById(`paste-ta-${date}`);
    if (ta) ta.focus();
}

function pasteZoneKeydown(e, date) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const val = e.target.value.trim();
        if (!val) return;
        const links = val.split(/\s+/).filter(s => s.startsWith('http'));
        if (links.length > 0) {
            addItemsToDay(date, links.map(l => parseShopeeUrl(l) || { name: l, url: '' }));
        } else {
            addItemsToDay(date, [{ name: val, url: '' }]);
        }
        e.target.value = '';
    }
}

function pasteZonePaste(e, date) {
    const pasted = (e.clipboardData || window.clipboardData).getData('text');
    const links = pasted.trim().split(/\s+/).filter(s => s.startsWith('http'));
    if (links.length > 0) {
        e.preventDefault();
        addItemsToDay(date, links.map(l => parseShopeeUrl(l) || { name: l, url: '' }));
    }
}

function addItemsToDay(date, nameObjs) {
    mutateDayItems(date, items => {
        nameObjs.forEach(obj => {
            if (obj && obj.name) items.push({ name: obj.name, qty: '1', spx: '', status: 'pending', options: [], url: obj.url || '' });
        });
    });
    setTimeout(() => focusPasteZone(date), 50);
}

// Middle-click item name → open Shopee URL
function handleNameMousedown(e, date, idx) {
    if (e.button !== 1) return; // only middle click
    e.preventDefault();
    const day = getDayRecord(date);
    if (!day) return;
    const it = parseItems(day.content)[idx];
    if (!it || !it.url) return;
    // Create real <a> and click — bypasses popup blocker
    const a = document.createElement('a');
    a.href = it.url;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// ─── Day price inline edit ────────────────────────────────────────────────────

function editDayPrice(date) {
    const day = getDayRecord(date);
    if (!day) return;
    const priceEl = document.querySelector(`.day-group[data-date="${date}"] .day-price`);
    if (!priceEl) return;

    const input = document.createElement('input');
    input.className = 'price-edit-input';
    input.value = day.url3 ? parseInt(day.url3).toLocaleString('vi-VN') : '';
    input.placeholder = 'Nhập giá...';

    input.addEventListener('input', function () {
        const raw = this.value.replace(/\D/g, '');
        this.value = raw ? parseInt(raw).toLocaleString('vi-VN') : '';
    });

    const save = () => {
        const raw = input.value.replace(/\D/g, '');
        day.url3 = raw;
        saveDay(day);
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') input.blur();
        if (e.key === 'Escape') render();
    });

    priceEl.replaceWith(input);
    input.focus(); input.select();
}

// ─── Open all links ───────────────────────────────────────────────────────────

function openAllLinks(date) {
    const day = getDayRecord(date);
    if (!day) return;
    const items = parseItems(day.content);
    const urls = items.map(it => it.url).filter(Boolean);
    if (!urls.length) return;
    urls.forEach(url => window.open(url, '_blank', 'noopener'));
}

// ─── Delete day ───────────────────────────────────────────────────────────────

async function confirmDeleteDay(date) {
    const day = getDayRecord(date);
    if (!day) return;
    const count = parseItems(day.content).length;
    if (!confirm(`Xóa ngày ${formatDate(date)} (${count} sản phẩm)?`)) return;
    allDays = allDays.filter(d => d.source !== date);
    render();
    if (day.id) await apiDelete(day.id);
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function setupTabs() {
    const addBtn = document.getElementById('addDayBtn');
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentTab = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${currentTab}`).classList.add('active');
            addBtn.style.display = currentTab === 'admin' ? '' : 'none';
            history.replaceState(null, '', `?tab=${currentTab}`);
            render();
        });
    });
    addBtn.style.display = '';
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'customer') {
        document.querySelector('[data-tab="customer"]').click();
        document.querySelector('.orders-tabs').style.display = 'none';
        addBtn.style.display = 'none';
    } else if (tabParam === 'admin') {
        document.querySelector('[data-tab="admin"]').click();
    }
}

// ─── Day modal ────────────────────────────────────────────────────────────────

function setupModals() {
    document.getElementById('addDayBtn').addEventListener('click', openAddDay);
    document.getElementById('dayModalClose').addEventListener('click', closeDayModal);
    document.getElementById('dayModalCancel').addEventListener('click', closeDayModal);
    document.getElementById('dayModalSave').addEventListener('click', saveDayModal);
    document.getElementById('spxModalClose').addEventListener('click', closeSpxModal);

    document.getElementById('dayPrice') && document.getElementById('dayPrice').addEventListener('input', function () {
        const raw = this.value.replace(/\D/g, '');
        this.value = raw ? parseInt(raw).toLocaleString('vi-VN') : '';
    });

    ['dayModal', 'spxModal'].forEach(id => {
        document.getElementById(id).addEventListener('click', function (e) {
            if (e.target === this) this.classList.remove('show');
        });
    });

    document.getElementById('dayDate').addEventListener('keydown', e => { if (e.key === 'Enter') saveDayModal(); });
}

function openAddDay() {
    document.getElementById('dayDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('dayModal').classList.add('show');
    setTimeout(() => document.getElementById('dayDate').focus(), 100);
}

function closeDayModal() {
    document.getElementById('dayModal').classList.remove('show');
}

async function saveDayModal() {
    const date = document.getElementById('dayDate').value;
    if (!date) return;

    const existing = getDayRecord(date);
    if (existing) { closeDayModal(); return; }

    const newDay = {
        type: ORDER_TYPE,
        title: formatDate(date),
        source: date,
        url1: '', url2: '',
        url3: '',
        tags: '',
        content: '',
        createdAt: new Date().toISOString()
    };

    allDays.unshift(newDay);
    allDays.sort((a, b) => (b.source || '').localeCompare(a.source || ''));
    closeDayModal();
    render();

    const saved = await apiSave(newDay);
    const idx = allDays.findIndex(d => d.source === date);
    if (idx !== -1) allDays[idx] = saved;
}

// ─── SPX Modal ────────────────────────────────────────────────────────────────

function openSpx(code) {
    if (!code) return;
    document.getElementById('spxModalTitle').textContent = `Tracking: ${code}`;
    document.getElementById('spxIframe').src = `https://tracking.shopee.vn/tracking?id=${encodeURIComponent(code)}`;
    document.getElementById('spxModal').classList.add('show');
}

function closeSpxModal() {
    document.getElementById('spxModal').classList.remove('show');
    document.getElementById('spxIframe').src = '';
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
    setupTabs();
    setupModals();
    await loadDays();
    render();
}

document.addEventListener('DOMContentLoaded', init);
