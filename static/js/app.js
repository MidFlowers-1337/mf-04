/* ===== 常量 ===== */
const TYPE_RATING = {
    book: {
        fields: ['rating_writing', 'rating_plot', 'rating_idea'],
        labels: ['文笔', '情节', '思想'],
    },
    movie: {
        fields: ['rating_story', 'rating_acting', 'rating_visual', 'rating_music'],
        labels: ['剧情', '表演', '画面', '配乐'],
    },
    music: {
        fields: ['rating_melody', 'rating_lyrics', 'rating_production'],
        labels: ['旋律', '歌词', '制作'],
    },
};
const TYPE_LABELS = { book: '书籍', movie: '影视', music: '音乐' };
const STATUS_LABELS = { want: '想看', doing: '在看', done: '看过' };

/* ===== 全局状态 ===== */
let currentType = 'book';
let currentFilter = 'all';
let allTags = [];
let createTagState = { selected: [] };
let editTagState = { selected: [] };
let createRatingState = {};
let editRatingState = {};
let editItemType = null;
let filterState = {
    types: [],
    statuses: [],
    tag_ids: [],
    tag_mode: 'or',
    min_rating: '',
    rating_dim: '',
    rating_dim_min: '',
    date_from: '',
    date_to: '',
    year: '',
};

/* ===== 初始化 ===== */
document.addEventListener('DOMContentLoaded', async () => {
    setupTabs();
    setupForm();
    setupRatingDimInputs('rating-dim-grid', 'rating-avg-preview', createRatingState, () => currentType);
    setupTagInput('tag-input', 'tag-field', 'tag-suggestions', 'tag-tags', createTagState);
    setupEditForm();
    setupFilterTabs();
    await loadTags();
    populateFilterTagSelect();
    populateFilterDimSelect();
    populateFilterYearSelect();
    applyUrlToFilter();
    bindFilterEvents();
    applyFilterToUI();
    await loadItems();
});

/* ===== 雷达图 SVG 生成 ===== */
function buildRadarSVG(labels, values, size = 100) {
    const n = labels.length;
    if (n < 3) {
        return `<svg class="radar-chart-small" viewBox="0 0 ${size} ${size}"></svg>`;
    }
    const cx = size / 2, cy = size / 2;
    const radius = size * 0.32;
    const levels = 5;
    const angle = (i) => (-Math.PI / 2) + (i * 2 * Math.PI) / n;
    const point = (i, v) => {
        const r = (v / 5) * radius;
        const a = angle(i);
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    };

    let svg = '';
    // 网格
    for (let lvl = 1; lvl <= levels; lvl++) {
        const pts = [];
        const v = lvl;
        for (let i = 0; i < n; i++) {
            const [x, y] = point(i, v);
            pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
        }
        svg += `<polyline class="grid" points="${pts.join(' ')} ${pts[0]}" />`;
    }
    // 轴线
    for (let i = 0; i < n; i++) {
        const [x, y] = point(i, 5);
        svg += `<line class="axis" x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" />`;
    }
    // 数据形状
    const dataPts = [];
    for (let i = 0; i < n; i++) {
        const v = values[i] || 0;
        const [x, y] = point(i, v);
        dataPts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    svg += `<polygon class="shape" points="${dataPts.join(' ')}" />`;
    // 数据点
    for (let i = 0; i < n; i++) {
        const v = values[i] || 0;
        if (v > 0) {
            const [x, y] = point(i, v);
            svg += `<circle class="dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.8" />`;
        }
    }
    // 标签
    const labelRadius = radius + 10;
    for (let i = 0; i < n; i++) {
        const a = angle(i);
        const lx = cx + labelRadius * Math.cos(a);
        const ly = cy + labelRadius * Math.sin(a);
        const anchor = Math.abs(Math.cos(a)) < 0.2 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
        const dy = Math.abs(Math.sin(a)) < 0.2 ? 0 : (Math.sin(a) > 0 ? 4 : -2);
        svg += `<text class="label" text-anchor="${anchor}" x="${lx.toFixed(1)}" y="${(ly + dy).toFixed(1)}">${labels[i]}</text>`;
    }
    return `<svg class="radar-chart-small" viewBox="0 0 ${size} ${size}">${svg}</svg>`;
}

function getItemDims(item) {
    const conf = TYPE_RATING[item.item_type];
    if (!conf) return { labels: [], values: [] };
    const values = conf.fields.map(f => item[f] ?? null);
    const hasAny = values.some(v => v != null);
    if (!hasAny && item.rating != null) {
        return { labels: conf.labels, values: conf.fields.map(() => item.rating) };
    }
    return { labels: conf.labels, values };
}

function getItemAvg(item) {
    const { values } = getItemDims(item);
    const vs = values.filter(v => v != null);
    if (!vs.length) return null;
    return (vs.reduce((a, b) => a + b, 0) / vs.length);
}

/* ===== Tooltip ===== */
function showTooltip(html, x, y) {
    const el = document.getElementById('tooltip');
    el.innerHTML = html;
    el.style.display = 'block';
    const w = el.offsetWidth, h = el.offsetHeight;
    let px = x + 14, py = y + 14;
    if (px + w > window.innerWidth) px = x - w - 14;
    if (py + h > window.innerHeight) py = y - h - 14;
    el.style.left = `${px}px`;
    el.style.top = `${py}px`;
}
function hideTooltip() {
    document.getElementById('tooltip').style.display = 'none';
}

/* ===== Tabs ===== */
function setupTabs() {
    const tabs = document.querySelectorAll('.tab:not(.filter-tab)');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentType = tab.dataset.type;
            updateFormLabels();
            resetCreateRating();
        });
    });
    updateFormLabels();
}

function updateFormLabels() {
    const labels = { book: '作者', movie: '导演', music: '艺人' };
    document.getElementById('creator-label').textContent = labels[currentType];
    const episodeFields = document.getElementById('episode-fields');
    episodeFields.style.display = currentType === 'movie' ? 'flex' : 'none';
}

/* ===== 多维评分输入组件 ===== */
function setupRatingDimInputs(gridId, avgId, state, typeGetter) {
    renderRatingDimGrid(gridId, avgId, state, typeGetter);
}

function renderRatingDimGrid(gridId, avgId, state, typeGetter) {
    const grid = document.getElementById(gridId);
    const t = typeGetter();
    const conf = TYPE_RATING[t] || { fields: [], labels: [] };
    grid.innerHTML = conf.labels.map((label, i) => {
        const field = conf.fields[i];
        const v = state[field] || 0;
        return `<div class="rating-dim-row">
            <span class="rating-dim-label">${label}</span>
            <div class="star-input" data-field="${field}" data-grid="${gridId}" data-avg="${avgId}">
                ${[1,2,3,4,5].map(n =>
                    `<span class="s ${n <= v ? 'on' : ''}" data-n="${n}">★</span>`
                ).join('')}
            </div>
        </div>`;
    }).join('');
    grid.querySelectorAll('.star-input').forEach(starRow => {
        const field = starRow.dataset.field;
        const gId = starRow.dataset.grid;
        const aId = starRow.dataset.avg;
        starRow.querySelectorAll('.s').forEach((s, idx) => {
            s.addEventListener('click', () => {
                const n = idx + 1;
                const cur = state[field] || 0;
                state[field] = (cur === n) ? 0 : n;
                renderRatingDimGrid(gId, aId, state, typeGetter);
                updateRatingAvg(gId, aId, state, typeGetter);
            });
        });
    });
    updateRatingAvg(gridId, avgId, state, typeGetter);
}

function resetCreateRating() {
    createRatingState = {};
    renderRatingDimGrid('rating-dim-grid', 'rating-avg-preview', createRatingState, () => currentType);
}

function updateRatingAvg(gridId, avgId, state, typeGetter) {
    const el = document.getElementById(avgId);
    const conf = TYPE_RATING[typeGetter()];
    if (!conf) { el.textContent = '未评分'; return; }
    const vals = conf.fields.map(f => state[f] || 0).filter(v => v > 0);
    if (!vals.length) { el.textContent = '未评分'; return; }
    const avg = (vals.reduce((a, b) => a + b, 0) / vals.length);
    el.textContent = `${'★'.repeat(Math.round(avg))} (${avg.toFixed(1)})`;
}

function collectRatingState(state, type) {
    const conf = TYPE_RATING[type];
    if (!conf) return {};
    const out = {};
    let any = false;
    conf.fields.forEach(f => {
        const v = state[f] || 0;
        if (v > 0) { out[f] = v; any = true; }
        else { out[f] = null; }
    });
    return any ? out : {};
}

/* ===== 标签输入组件 ===== */
function setupTagInput(wrapperId, inputId, sugId, tagsId, state) {
    const wrapper = document.getElementById(wrapperId);
    const input = document.getElementById(inputId);
    const sug = document.getElementById(sugId);
    const tagsEl = document.getElementById(tagsId);
    wrapper.addEventListener('click', (e) => {
        if (e.target === wrapper || e.target === tagsEl || e.target === input) {
            input.focus();
        }
    });
    input.addEventListener('focus', () => {
        showTagSuggestions(input, sug, state, tagsEl, '');
    });
    input.addEventListener('blur', () => {
        setTimeout(() => sug.classList.remove('active'), 150);
    });
    input.addEventListener('input', () => {
        showTagSuggestions(input, sug, state, tagsEl, input.value);
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = input.value.trim();
            if (val) {
                addTag(state, tagsEl, val);
                input.value = '';
                showTagSuggestions(input, sug, state, tagsEl, '');
            }
        } else if (e.key === 'Backspace' && !input.value && state.selected.length) {
            state.selected.pop();
            renderSelectedTags(tagsEl, state);
        }
    });
}

function showTagSuggestions(input, sug, state, tagsEl, q) {
    const qq = q.trim().toLowerCase();
    const selectedNames = new Set(state.selected.map(t => t.name));
    let list = allTags.filter(t => !selectedNames.has(t.name));
    if (qq) list = list.filter(t => t.name.toLowerCase().includes(qq));
    list = list.slice(0, 10);
    const showCreate = qq && !list.some(t => t.name.toLowerCase() === qq) && !selectedNames.has(qq);
    if (!list.length && !showCreate) { sug.classList.remove('active'); return; }
    sug.innerHTML = list.map(t =>
        `<div class="tag-suggestion-item" data-name="${escapeAttr(t.name)}">
            <span>${escapeHtml(t.name)}</span>
            <span class="count">${t.usage_count ?? 0}</span>
        </div>`
    ).join('') + (showCreate ?
        `<div class="tag-suggestion-item" data-name="${escapeAttr(qq)}" data-create="1">
            <span>新建：<b>${escapeHtml(qq)}</b></span>
        </div>` : '');
    sug.classList.add('active');
    sug.querySelectorAll('.tag-suggestion-item').forEach(item => {
        item.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const name = item.dataset.name;
            addTag(state, tagsEl, name);
            input.value = '';
            sug.classList.remove('active');
            showTagSuggestions(input, sug, state, tagsEl, '');
        });
    });
}

function addTag(state, tagsEl, name) {
    name = name.trim();
    if (!name) return;
    if (state.selected.some(t => t.name === name)) return;
    let obj = allTags.find(t => t.name === name);
    if (!obj) obj = { id: null, name };
    state.selected.push(obj);
    renderSelectedTags(tagsEl, state);
}

function renderSelectedTags(tagsEl, state) {
    tagsEl.innerHTML = state.selected.map((t, i) =>
        `<span class="tag">${escapeHtml(t.name)}
            <span class="tag-remove" data-i="${i}">×</span>
        </span>`
    ).join('');
    tagsEl.querySelectorAll('.tag-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.selected.splice(parseInt(btn.dataset.i), 1);
            renderSelectedTags(tagsEl, state);
        });
    });
}

/* ===== 表单提交 ===== */
function setupForm() {
    const form = document.getElementById('item-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ratingDims = collectRatingState(createRatingState, currentType);
        const data = {
            title: document.getElementById('title').value,
            item_type: currentType,
            creator: document.getElementById('creator').value || null,
            status: document.getElementById('status').value,
            tag_names: createTagState.selected.map(t => t.name),
            comment: document.getElementById('comment').value || null,
            start_date: document.getElementById('start_date').value || null,
            end_date: document.getElementById('end_date').value || null,
            ...ratingDims,
        };
        if (currentType === 'movie') {
            data.total_episodes = document.getElementById('total_episodes').value ?
                parseInt(document.getElementById('total_episodes').value) : null;
            data.current_episode = parseInt(document.getElementById('current_episode').value) || 0;
        }
        try {
            const res = await fetch('/api/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (res.ok) {
                form.reset();
                document.getElementById('current_episode').value = '0';
                createTagState.selected = [];
                renderSelectedTags(document.getElementById('tag-tags'), createTagState);
                resetCreateRating();
                await loadTags();
                populateFilterTagSelect();
                await loadItems();
            } else {
                const err = await res.json();
                alert(err.error || '添加失败');
            }
        } catch (e) { alert('网络错误'); }
    });
}

/* ===== 编辑弹窗 ===== */
function setupEditForm() {
    setupRatingDimInputs('edit-rating-dim-grid', 'edit-rating-avg-preview', editRatingState, () => editItemType);
    setupTagInput('edit-tag-input', 'edit-tag-field', 'edit-tag-suggestions', 'edit-tag-tags', editTagState);

    document.getElementById('edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const itemId = document.getElementById('edit-id').value;
        const ratingDims = collectRatingState(editRatingState, editItemType);
        const data = {
            title: document.getElementById('edit-title').value,
            creator: document.getElementById('edit-creator').value || null,
            status: document.getElementById('edit-status').value,
            tag_names: editTagState.selected.map(t => t.name),
            comment: document.getElementById('edit-comment').value || null,
            start_date: document.getElementById('edit-start_date').value || null,
            end_date: document.getElementById('edit-end_date').value || null,
            ...ratingDims,
        };
        if (editItemType === 'movie') {
            data.total_episodes = document.getElementById('edit-total_episodes').value ?
                parseInt(document.getElementById('edit-total_episodes').value) : null;
            data.current_episode = parseInt(document.getElementById('edit-current_episodes').value) || 0;
        }
        const res = await fetch(`/api/items/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        if (res.ok) {
            closeModal();
            await loadTags();
            populateFilterTagSelect();
            await loadItems();
        } else {
            const err = await res.json();
            alert(err.error || '更新失败');
        }
    });
}

async function editItem(itemId) {
    const res = await fetch(`/api/items/${itemId}`);
    const item = await res.json();
    editItemType = item.item_type;
    document.getElementById('edit-id').value = item.id;
    document.getElementById('edit-title').value = item.title;
    document.getElementById('edit-creator').value = item.creator || '';
    document.getElementById('edit-status').value = item.status;
    document.getElementById('edit-comment').value = item.comment || '';
    document.getElementById('edit-start_date').value = item.start_date || '';
    document.getElementById('edit-end_date').value = item.end_date || '';
    const labels = { book: '作者', movie: '导演', music: '艺人' };
    document.getElementById('edit-creator-label').textContent = labels[item.item_type];
    const epFields = document.getElementById('edit-episode-fields');
    if (item.item_type === 'movie') {
        epFields.style.display = 'flex';
        document.getElementById('edit-total_episodes').value = item.total_episodes || '';
        document.getElementById('edit-current_episodes').value = item.current_episode || 0;
    } else {
        epFields.style.display = 'none';
    }
    // 标签
    editTagState.selected = (item.tag_list || []).map(t => ({ id: t.id, name: t.name }));
    renderSelectedTags(document.getElementById('edit-tag-tags'), editTagState);
    // 评分
    editRatingState = {};
    const conf = TYPE_RATING[item.item_type];
    if (conf) {
        conf.fields.forEach(f => {
            if (item[f] != null) editRatingState[f] = item[f];
            else if (item.rating != null) editRatingState[f] = item.rating;
        });
    }
    renderRatingDimGrid('edit-rating-dim-grid', 'edit-rating-avg-preview', editRatingState, () => editItemType);
    document.getElementById('edit-modal').classList.add('active');
}

function closeModal() {
    document.getElementById('edit-modal').classList.remove('active');
}

/* ===== Filter Tabs （简单 tabs） ===== */
function setupFilterTabs() {
    const tabs = document.querySelectorAll('.filter-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            loadItems();
        });
    });
}

/* ===== Tags API ===== */
async function loadTags() {
    try {
        const res = await fetch('/api/tags');
        allTags = await res.json();
    } catch (e) { allTags = []; }
}

/* ===== 高级筛选 ===== */
function populateFilterTagSelect() {
    const sel = document.getElementById('filter-tag-select');
    sel.innerHTML = '<option value="">-- 选择标签 --</option>' +
        allTags.map(t => `<option value="${t.id}">${escapeHtml(t.name)} (${t.usage_count ?? 0})</option>`).join('');
}

function populateFilterDimSelect() {
    const sel = document.getElementById('filter-rating-dim');
    let html = '<option value="">-- 选择维度 --</option>';
    const groupLabel = { book: '书籍', movie: '影视', music: '音乐' };
    for (const [t, conf] of Object.entries(TYPE_RATING)) {
        html += `<optgroup label="${groupLabel[t]}">`;
        conf.fields.forEach((f, i) => {
            html += `<option value="${f}">${groupLabel[t]} - ${conf.labels[i]}</option>`;
        });
        html += '</optgroup>';
    }
    sel.innerHTML = html;
}

function populateFilterYearSelect() {
    const years = new Set();
    const now = new Date().getFullYear();
    for (let y = now; y >= now - 5; y--) years.add(String(y));
    fetch('/api/stats/years').then(r => r.json()).then(ys => {
        ys.forEach(y => years.add(y));
        const sel = document.getElementById('filter-year');
        const arr = [...years].sort().reverse();
        sel.innerHTML = '<option value="">不限</option>' + arr.map(y => `<option value="${y}">${y} 年</option>`).join('');
        applyFilterToUI();
    }).catch(() => {
        const sel = document.getElementById('filter-year');
        const arr = [...years].sort().reverse();
        sel.innerHTML = '<option value="">不限</option>' + arr.map(y => `<option value="${y}">${y} 年</option>`).join('');
        applyFilterToUI();
    });
}

function bindFilterEvents() {
    // chips 点击
    ['types', 'statuses'].forEach(key => {
        const box = document.getElementById(`filter-${key}`);
        box.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const v = chip.dataset.value;
                const arr = filterState[key];
                const i = arr.indexOf(v);
                if (i >= 0) arr.splice(i, 1); else arr.push(v);
                chip.classList.toggle('active');
                filterStateChanged();
            });
        });
    });
    // 标签 select
    document.getElementById('filter-tag-select').addEventListener('change', (e) => {
        const id = parseInt(e.target.value);
        e.target.value = '';
        if (!id) return;
        const tag = allTags.find(t => t.id === id);
        if (!tag) return;
        if (filterState.tag_ids.includes(id)) return;
        filterState.tag_ids.push(id);
        renderSelectedFilterTags();
        filterStateChanged();
    });
    // tag_mode radio
    document.querySelectorAll('input[name="tag_mode"]').forEach(r => {
        r.addEventListener('change', () => {
            filterState.tag_mode = r.value;
            filterStateChanged();
        });
    });
    // min_rating
    document.getElementById('filter-min-rating').addEventListener('change', (e) => {
        filterState.min_rating = e.target.value;
        filterStateChanged();
    });
    // dim
    document.getElementById('filter-rating-dim').addEventListener('change', (e) => {
        filterState.rating_dim = e.target.value;
        filterStateChanged();
    });
    document.getElementById('filter-rating-dim-min').addEventListener('change', (e) => {
        filterState.rating_dim_min = e.target.value;
        filterStateChanged();
    });
    // 日期
    document.getElementById('filter-date-from').addEventListener('change', (e) => {
        filterState.date_from = e.target.value;
        filterStateChanged();
    });
    document.getElementById('filter-date-to').addEventListener('change', (e) => {
        filterState.date_to = e.target.value;
        filterStateChanged();
    });
    // year
    document.getElementById('filter-year').addEventListener('change', (e) => {
        filterState.year = e.target.value;
        filterStateChanged();
    });
    // 重置
    document.getElementById('filter-reset').addEventListener('click', (e) => {
        e.preventDefault();
        filterState = {
            types: [], statuses: [], tag_ids: [], tag_mode: 'or',
            min_rating: '', rating_dim: '', rating_dim_min: '',
            date_from: '', date_to: '', year: '',
        };
        filterStateChanged();
    });
}

function renderSelectedFilterTags() {
    const box = document.getElementById('filter-tags-selected');
    const tagMap = new Map(allTags.map(t => [t.id, t.name]));
    box.innerHTML = filterState.tag_ids.map((id, i) => {
        const name = tagMap.get(id) || `#${id}`;
        return `<span class="chip active">${escapeHtml(name)} <span class="chip-remove" data-i="${i}">×</span></span>`;
    }).join('');
    box.querySelectorAll('.chip-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            filterState.tag_ids.splice(parseInt(btn.dataset.i), 1);
            renderSelectedFilterTags();
            filterStateChanged();
        });
    });
}

function filterStateChanged() {
    syncFilterToUrl();
    applyFilterToUI();
    loadItems();
}

function syncFilterToUrl() {
    const p = new URLSearchParams();
    ['types', 'statuses'].forEach(k => {
        if (filterState[k].length) p.set(k, filterState[k].join(','));
    });
    if (filterState.tag_ids.length) p.set('tag_ids', filterState.tag_ids.join(','));
    if (filterState.tag_mode !== 'or') p.set('tag_mode', filterState.tag_mode);
    if (filterState.min_rating) p.set('min_rating', filterState.min_rating);
    if (filterState.rating_dim) p.set('rating_dim', filterState.rating_dim);
    if (filterState.rating_dim_min) p.set('rating_dim_min', filterState.rating_dim_min);
    if (filterState.date_from) p.set('date_from', filterState.date_from);
    if (filterState.date_to) p.set('date_to', filterState.date_to);
    if (filterState.year) p.set('year', filterState.year);
    const qs = p.toString();
    const url = qs ? `${location.pathname}?${qs}` : location.pathname;
    history.replaceState(null, '', url);
}

function applyUrlToFilter() {
    const p = new URLSearchParams(location.search);
    const split = (s) => (s || '').split(',').filter(Boolean);
    filterState.types = split(p.get('types'));
    filterState.statuses = split(p.get('statuses'));
    filterState.tag_ids = split(p.get('tag_ids')).map(x => parseInt(x)).filter(x => x);
    filterState.tag_mode = p.get('tag_mode') || 'or';
    filterState.min_rating = p.get('min_rating') || '';
    filterState.rating_dim = p.get('rating_dim') || '';
    filterState.rating_dim_min = p.get('rating_dim_min') || '';
    filterState.date_from = p.get('date_from') || '';
    filterState.date_to = p.get('date_to') || '';
    filterState.year = p.get('year') || '';
}

function applyFilterToUI() {
    // chips
    ['types', 'statuses'].forEach(key => {
        const box = document.getElementById(`filter-${key}`);
        box.querySelectorAll('.chip').forEach(chip => {
            if (filterState[key].includes(chip.dataset.value)) chip.classList.add('active');
            else chip.classList.remove('active');
        });
    });
    // 标签
    renderSelectedFilterTags();
    // tag_mode
    const mode = filterState.tag_mode || 'or';
    document.querySelectorAll('input[name="tag_mode"]').forEach(r => {
        r.checked = (r.value === mode);
    });
    // select
    document.getElementById('filter-min-rating').value = filterState.min_rating;
    document.getElementById('filter-rating-dim').value = filterState.rating_dim;
    document.getElementById('filter-rating-dim-min').value = filterState.rating_dim_min;
    document.getElementById('filter-date-from').value = filterState.date_from;
    document.getElementById('filter-date-to').value = filterState.date_to;
    if (filterState.year) {
        const ysel = document.getElementById('filter-year');
        if ([...ysel.options].some(o => o.value === filterState.year)) {
            ysel.value = filterState.year;
        }
    }
}

/* ===== 加载列表 ===== */
async function loadItems() {
    const params = new URLSearchParams();

    // 高级筛选条件
    const hasAdvanced = [
        filterState.types.length, filterState.statuses.length, filterState.tag_ids.length,
        filterState.tag_mode !== 'or', filterState.min_rating, filterState.rating_dim,
        filterState.rating_dim_min, filterState.date_from, filterState.date_to, filterState.year,
    ].some(Boolean);

    if (hasAdvanced) {
        if (filterState.types.length) params.set('types', filterState.types.join(','));
        if (filterState.statuses.length) params.set('statuses', filterState.statuses.join(','));
        if (filterState.tag_ids.length) params.set('tag_ids', filterState.tag_ids.join(','));
        if (filterState.tag_mode !== 'or') params.set('tag_mode', filterState.tag_mode);
        if (filterState.min_rating) params.set('min_rating', filterState.min_rating);
        if (filterState.rating_dim) params.set('rating_dim', filterState.rating_dim);
        if (filterState.rating_dim_min) params.set('rating_dim_min', filterState.rating_dim_min);
        if (filterState.date_from) params.set('date_from', filterState.date_from);
        if (filterState.date_to) params.set('date_to', filterState.date_to);
        if (filterState.year) params.set('year', filterState.year);
    } else {
        // 简单 filter tabs
        if (currentFilter === 'book' || currentFilter === 'movie' || currentFilter === 'music') {
            params.append('type', currentFilter);
        } else if (currentFilter === 'doing' || currentFilter === 'done') {
            params.append('status', currentFilter);
        }
    }

    let url = '/api/items';
    if (params.toString()) url += '?' + params.toString();
    try {
        const res = await fetch(url);
        const items = await res.json();
        renderItems(items);
    } catch (e) { console.error(e); }
}

/* ===== 渲染卡片 ===== */
function renderItems(items) {
    const list = document.getElementById('item-list');
    if (!items.length) {
        list.innerHTML = '<div class="empty-state">暂无条目，快去添加吧！</div>';
        return;
    }
    list.innerHTML = items.map(item => renderItemCard(item)).join('');
    bindCardEvents();
}

function renderItemCard(item) {
    const tags = item.tag_list && item.tag_list.length ? item.tag_list :
        (item.tags ? item.tags.split(',').map((n, i) => ({ id: i, name: n.trim() })).filter(t => t.name) : []);
    const tagsHtml = tags.map(t => `<span class="tag">${escapeHtml(t.name)}</span>`).join('');

    const dims = getItemDims(item);
    const avg = getItemAvg(item);
    const hasRating = dims.values.some(v => v != null) || avg != null;
    let radarHtml = '';
    if (hasRating) {
        const svg = buildRadarSVG(dims.labels, dims.values.map(v => v == null ? 0 : v), 100);
        const avgStars = avg != null ? '★'.repeat(Math.round(avg)) + '<span style="color:#ddd">' + '☆'.repeat(5 - Math.round(avg)) + '</span>' : '';
        radarHtml = `
            <div class="item-radar-row" data-item-id="${item.id}">
                ${svg}
                <div class="radar-avg-box">
                    ${avg != null ? `<div class="radar-avg-score">${avg.toFixed(1)}</div>` : ''}
                    ${avg != null ? `<div class="radar-avg-label">${avgStars}</div>` : ''}
                </div>
            </div>
        `;
    }

    let progressHtml = '';
    if (item.item_type === 'movie' && item.total_episodes) {
        const percent = Math.min(100, Math.round((item.current_episode / item.total_episodes) * 100));
        progressHtml = `
            <div class="progress-bar"><div class="progress-fill" style="width: ${percent}%"></div></div>
            <div class="episode-controls">
                <button onclick="changeEpisode(${item.id}, -1)">-</button>
                <span>${item.current_episode} / ${item.total_episodes}</span>
                <button onclick="changeEpisode(${item.id}, 1)">+</button>
            </div>
        `;
    }

    const dates = [];
    if (item.start_date) dates.push(`开始: ${item.start_date}`);
    if (item.end_date) dates.push(`结束: ${item.end_date}`);
    const datesHtml = dates.length ? `<div class="item-meta">${dates.join(' · ')}</div>` : '';

    return `
        <div class="item-card type-${item.item_type}" data-item-id="${item.id}">
            <h3>${escapeHtml(item.title)}</h3>
            <div class="item-meta">${TYPE_LABELS[item.item_type]} · ${item.creator || '未知'}</div>
            <span class="status-badge status-${item.status}">${STATUS_LABELS[item.status]}</span>
            <div class="item-tags">${tagsHtml}</div>
            ${radarHtml}
            ${datesHtml}
            ${progressHtml}
            ${item.comment ? `<p style="font-size: 0.9rem; color: #666; margin-top: 0.5rem;">${escapeHtml(item.comment)}</p>` : ''}
            <div class="item-actions">
                <button class="btn btn-sm btn-secondary" onclick="editItem(${item.id})">编辑</button>
                <button class="btn btn-sm btn-danger" onclick="deleteItem(${item.id})">删除</button>
            </div>
        </div>
    `;
}

function bindCardEvents() {
    document.querySelectorAll('.item-radar-row').forEach(row => {
        const id = parseInt(row.dataset.itemId);
        row.addEventListener('mouseenter', (e) => {
            showRadarTooltip(id, e);
        });
        row.addEventListener('mousemove', (e) => {
            updateRadarTooltipPos(e);
        });
        row.addEventListener('mouseleave', hideTooltip);
    });
}

let currentRadarItem = null;
async function showRadarTooltip(id, e) {
    if (currentRadarItem === id) { updateRadarTooltipPos(e); return; }
    let item = null;
    try {
        const res = await fetch(`/api/items/${id}`);
        item = await res.json();
    } catch { return; }
    currentRadarItem = id;
    const dims = getItemDims(item);
    const rows = dims.labels.map((l, i) => {
        const v = dims.values[i];
        return `<div class="dim-row"><span class="dim-label">${l}</span><span class="dim-value">${v != null ? '★'.repeat(v) + '☆'.repeat(5 - v) + ` (${v})` : '未评'}</span></div>`;
    }).join('');
    const avg = getItemAvg(item);
    const title = `<div class="tooltip-title">${escapeHtml(item.title)} · 综合 ${avg != null ? avg.toFixed(1) : '未评分'}</div>`;
    showTooltip(title + rows, e.clientX, e.clientY);
}
function updateRadarTooltipPos(e) {
    const el = document.getElementById('tooltip');
    if (el.style.display !== 'block') return;
    const w = el.offsetWidth, h = el.offsetHeight;
    let px = e.clientX + 14, py = e.clientY + 14;
    if (px + w > window.innerWidth) px = e.clientX - w - 14;
    if (py + h > window.innerHeight) py = e.clientY - h - 14;
    el.style.left = `${px}px`;
    el.style.top = `${py}px`;
}

document.addEventListener('mouseleave', hideTooltip);

/* ===== 追剧进度 ===== */
async function changeEpisode(itemId, delta) {
    const itemRes = await fetch(`/api/items/${itemId}`);
    const item = await itemRes.json();
    const newEp = Math.max(0, item.current_episode + delta);
    const res = await fetch(`/api/items/${itemId}/episode`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_episode: newEp }),
    });
    if (res.ok) await loadItems();
}

async function deleteItem(itemId) {
    if (!confirm('确定删除这个条目吗？')) return;
    const res = await fetch(`/api/items/${itemId}`, { method: 'DELETE' });
    if (res.ok) {
        await loadTags();
        populateFilterTagSelect();
        await loadItems();
    }
}

/* ===== Utils ===== */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}
function escapeAttr(text) {
    return String(text == null ? '' : text).replace(/"/g, '&quot;');
}
