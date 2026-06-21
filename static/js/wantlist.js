let draggedItem = null;

document.addEventListener('DOMContentLoaded', () => {
    loadWantlist();
});

async function loadWantlist() {
    try {
        const res = await fetch('/api/items/wantlist');
        const items = await res.json();
        renderWantlist(items);
    } catch (e) {
        console.error(e);
    }
}

function renderWantlist(items) {
    const container = document.getElementById('wantlist');
    
    if (!items.length) {
        container.innerHTML = '<div class="empty-state">想看清单为空，去添加一些吧！</div>';
        return;
    }
    
    const typeLabels = { book: '书籍', movie: '影视', music: '音乐' };
    
    container.innerHTML = items.map((item, index) => `
        <div class="wantlist-item type-${item.item_type}" 
             draggable="true" 
             data-id="${item.id}"
             data-index="${index}"
             ondragstart="handleDragStart(event)"
             ondragend="handleDragEnd(event)"
             ondragover="handleDragOver(event)"
             ondragleave="handleDragLeave(event)"
             ondrop="handleDrop(event)">
            <span class="drag-handle">⋮⋮</span>
            <div class="item-info">
                <strong>${escapeHtml(item.title)}</strong>
                <span class="status-badge status-want" style="margin-left: 0.5rem;">${typeLabels[item.item_type]}</span>
                ${item.creator ? `<div style="font-size: 0.85rem; color: #666;">${escapeHtml(item.creator)}</div>` : ''}
            </div>
            <button class="btn btn-sm btn-secondary" onclick="pinItem(${item.id})">置顶</button>
            <button class="btn btn-sm btn-primary" onclick="startItem(${item.id})">开始</button>
            <button class="btn btn-sm btn-danger" onclick="deleteItem(${item.id})">删除</button>
        </div>
    `).join('');
}

function handleDragStart(e) {
    draggedItem = e.target;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.target.dataset.id);
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.wantlist-item').forEach(item => {
        item.classList.remove('drag-over');
    });
    
    saveNewOrder();
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const target = e.target.closest('.wantlist-item');
    if (target && target !== draggedItem) {
        document.querySelectorAll('.wantlist-item').forEach(item => {
            item.classList.remove('drag-over');
        });
        target.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    const target = e.target.closest('.wantlist-item');
    if (target) {
        target.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    
    const target = e.target.closest('.wantlist-item');
    if (!target || target === draggedItem) return;
    
    const container = document.getElementById('wantlist');
    const items = Array.from(container.children);
    const draggedIndex = items.indexOf(draggedItem);
    const targetIndex = items.indexOf(target);
    
    if (draggedIndex < targetIndex) {
        target.after(draggedItem);
    } else {
        target.before(draggedItem);
    }
}

async function saveNewOrder() {
    const items = document.querySelectorAll('.wantlist-item');
    const order = Array.from(items).map(item => parseInt(item.dataset.id));
    
    try {
        await fetch('/api/items/wantlist/reorder', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order })
        });
    } catch (e) {
        console.error(e);
    }
}

async function pinItem(itemId) {
    try {
        const res = await fetch(`/api/items/${itemId}/pin`, { method: 'POST' });
        if (res.ok) {
            loadWantlist();
        }
    } catch (e) {
        console.error(e);
    }
}

async function startItem(itemId) {
    const today = new Date().toISOString().split('T')[0];
    try {
        const res = await fetch(`/api/items/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'doing', start_date: today })
        });
        if (res.ok) {
            loadWantlist();
        }
    } catch (e) {
        console.error(e);
    }
}

async function deleteItem(itemId) {
    if (!confirm('确定删除这个条目吗？')) return;
    
    try {
        const res = await fetch(`/api/items/${itemId}`, { method: 'DELETE' });
        if (res.ok) {
            loadWantlist();
        }
    } catch (e) {
        console.error(e);
    }
}

function exportData() {
    window.location.href = '/api/export';
}

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    const resultEl = document.getElementById('import-result');
    
    try {
        const res = await fetch('/api/import', {
            method: 'POST',
            body: formData
        });
        
        const data = await res.json();
        
        if (res.ok) {
            resultEl.innerHTML = `<span style="color: green;">导入成功！新增 ${data.imported} 条，跳过重复 ${data.skipped} 条</span>`;
            loadWantlist();
        } else {
            resultEl.innerHTML = `<span style="color: red;">导入失败：${data.error}</span>`;
        }
    } catch (e) {
        resultEl.innerHTML = `<span style="color: red;">网络错误</span>`;
    }
    
    event.target.value = '';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
