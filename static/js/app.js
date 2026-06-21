let currentType = 'book';
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupForm();
    loadItems();
    setupFilterTabs();
    setupEditForm();
});

function setupTabs() {
    const tabs = document.querySelectorAll('.tab:not(.filter-tab)');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentType = tab.dataset.type;
            updateFormLabels();
        });
    });
}

function updateFormLabels() {
    const labels = {
        book: '作者',
        movie: '导演',
        music: '艺人'
    };
    document.getElementById('creator-label').textContent = labels[currentType];
    
    const episodeFields = document.getElementById('episode-fields');
    if (currentType === 'movie') {
        episodeFields.style.display = 'flex';
    } else {
        episodeFields.style.display = 'none';
    }
}

function setupForm() {
    const form = document.getElementById('item-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const data = {
            title: document.getElementById('title').value,
            item_type: currentType,
            creator: document.getElementById('creator').value || null,
            tags: document.getElementById('tags').value || null,
            status: document.getElementById('status').value,
            rating: document.getElementById('rating').value ? parseInt(document.getElementById('rating').value) : null,
            comment: document.getElementById('comment').value || null,
            start_date: document.getElementById('start_date').value || null,
            end_date: document.getElementById('end_date').value || null
        };
        
        if (currentType === 'movie') {
            data.total_episodes = document.getElementById('total_episodes').value ? parseInt(document.getElementById('total_episodes').value) : null;
            data.current_episode = parseInt(document.getElementById('current_episode').value) || 0;
        }
        
        try {
            const res = await fetch('/api/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (res.ok) {
                form.reset();
                document.getElementById('current_episode').value = '0';
                loadItems();
            } else {
                const err = await res.json();
                alert(err.error || '添加失败');
            }
        } catch (e) {
            alert('网络错误');
        }
    });
}

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

async function loadItems() {
    let url = '/api/items';
    const params = new URLSearchParams();
    
    if (currentFilter === 'book' || currentFilter === 'movie' || currentFilter === 'music') {
        params.append('type', currentFilter);
    } else if (currentFilter === 'doing' || currentFilter === 'done') {
        params.append('status', currentFilter);
    }
    
    if (params.toString()) {
        url += '?' + params.toString();
    }
    
    try {
        const res = await fetch(url);
        const items = await res.json();
        renderItems(items);
    } catch (e) {
        console.error(e);
    }
}

function renderItems(items) {
    const list = document.getElementById('item-list');
    
    if (!items.length) {
        list.innerHTML = '<div class="empty-state">暂无条目，快去添加吧！</div>';
        return;
    }
    
    list.innerHTML = items.map(item => {
        const typeLabels = { book: '书籍', movie: '影视', music: '音乐' };
        const statusLabels = { want: '想看', doing: '在看', done: '看过' };
        
        const tagsHtml = item.tags ? item.tags.split(',').map(t => 
            `<span class="tag">${t.trim()}</span>`
        ).join('') : '';
        
        const stars = item.rating ? '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating) : '未评分';
        
        let progressHtml = '';
        if (item.item_type === 'movie' && item.total_episodes) {
            const percent = Math.min(100, Math.round((item.current_episode / item.total_episodes) * 100));
            progressHtml = `
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percent}%"></div>
                </div>
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
            <div class="item-card type-${item.item_type}">
                <h3>${escapeHtml(item.title)}</h3>
                <div class="item-meta">${typeLabels[item.item_type]} · ${item.creator || '未知'}</div>
                <span class="status-badge status-${item.status}">${statusLabels[item.status]}</span>
                <div class="stars">${stars}</div>
                <div class="item-tags">${tagsHtml}</div>
                ${datesHtml}
                ${progressHtml}
                ${item.comment ? `<p style="font-size: 0.9rem; color: #666; margin-top: 0.5rem;">${escapeHtml(item.comment)}</p>` : ''}
                <div class="item-actions">
                    <button class="btn btn-sm btn-secondary" onclick="editItem(${item.id})">编辑</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteItem(${item.id})">删除</button>
                </div>
            </div>
        `;
    }).join('');
}

async function changeEpisode(itemId, delta) {
    const itemRes = await fetch(`/api/items/${itemId}`);
    const item = await itemRes.json();
    
    const newEp = Math.max(0, item.current_episode + delta);
    
    const res = await fetch(`/api/items/${itemId}/episode`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_episode: newEp })
    });
    
    if (res.ok) {
        loadItems();
    }
}

async function deleteItem(itemId) {
    if (!confirm('确定删除这个条目吗？')) return;
    
    const res = await fetch(`/api/items/${itemId}`, { method: 'DELETE' });
    if (res.ok) {
        loadItems();
    }
}

function editItem(itemId) {
    fetch(`/api/items/${itemId}`)
        .then(res => res.json())
        .then(item => {
            document.getElementById('edit-id').value = item.id;
            document.getElementById('edit-title').value = item.title;
            document.getElementById('edit-creator').value = item.creator || '';
            document.getElementById('edit-tags').value = item.tags || '';
            document.getElementById('edit-status').value = item.status;
            document.getElementById('edit-rating').value = item.rating || '';
            document.getElementById('edit-comment').value = item.comment || '';
            document.getElementById('edit-start_date').value = item.start_date || '';
            document.getElementById('edit-end_date').value = item.end_date || '';
            
            const labels = { book: '作者', movie: '导演', music: '艺人' };
            document.getElementById('edit-creator-label').textContent = labels[item.item_type];
            
            const epFields = document.getElementById('edit-episode-fields');
            if (item.item_type === 'movie') {
                epFields.style.display = 'flex';
                document.getElementById('edit-total_episodes').value = item.total_episodes || '';
                document.getElementById('edit-current_episode').value = item.current_episode || 0;
            } else {
                epFields.style.display = 'none';
            }
            
            document.getElementById('edit-modal').classList.add('active');
        });
}

function closeModal() {
    document.getElementById('edit-modal').classList.remove('active');
}

function setupEditForm() {
    document.getElementById('edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const itemId = document.getElementById('edit-id').value;
        const itemRes = await fetch(`/api/items/${itemId}`);
        const item = await itemRes.json();
        
        const data = {
            title: document.getElementById('edit-title').value,
            creator: document.getElementById('edit-creator').value || null,
            tags: document.getElementById('edit-tags').value || null,
            status: document.getElementById('edit-status').value,
            rating: document.getElementById('edit-rating').value ? parseInt(document.getElementById('edit-rating').value) : null,
            comment: document.getElementById('edit-comment').value || null,
            start_date: document.getElementById('edit-start_date').value || null,
            end_date: document.getElementById('edit-end_date').value || null
        };
        
        if (item.item_type === 'movie') {
            data.total_episodes = document.getElementById('edit-total_episodes').value ? parseInt(document.getElementById('edit-total_episodes').value) : null;
            data.current_episode = parseInt(document.getElementById('edit-current_episode').value) || 0;
        }
        
        const res = await fetch(`/api/items/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (res.ok) {
            closeModal();
            loadItems();
        } else {
            const err = await res.json();
            alert(err.error || '更新失败');
        }
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
