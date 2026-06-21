let currentYear = new Date().getFullYear();

const TYPE_RATING = {
    book: { fields: ['rating_writing', 'rating_plot', 'rating_idea'], labels: ['文笔', '情节', '思想'] },
    movie: { fields: ['rating_story', 'rating_acting', 'rating_visual', 'rating_music'], labels: ['剧情', '表演', '画面', '配乐'] },
    music: { fields: ['rating_melody', 'rating_lyrics', 'rating_production'], labels: ['旋律', '歌词', '制作'] },
};

document.addEventListener('DOMContentLoaded', () => {
    loadYears();
});

async function loadYears() {
    try {
        const res = await fetch('/api/stats/years');
        const years = await res.json();
        const select = document.getElementById('year-select');
        const currentYearVal = new Date().getFullYear();
        if (!years.includes(String(currentYearVal))) {
            years.unshift(String(currentYearVal));
        }
        select.innerHTML = years.map(y => `<option value="${y}">${y} 年</option>`).join('');
        select.value = currentYear;
        select.addEventListener('change', () => {
            currentYear = parseInt(select.value);
            loadStats();
        });
        loadStats();
    } catch (e) {
        console.error(e);
    }
}

async function loadStats() {
    try {
        const res = await fetch(`/api/stats/yearly/${currentYear}`);
        const stats = await res.json();
        renderStats(stats);
    } catch (e) {
        console.error(e);
    }
}

function renderStats(stats) {
    const cards = document.getElementById('stats-cards');
    cards.innerHTML = `
        <div class="stat-card">
            <div class="number">${stats.total_count}</div>
            <div class="label">新增条目</div>
        </div>
        <div class="stat-card">
            <div class="number">${stats.done_count}</div>
            <div class="label">已完成</div>
        </div>
        <div class="stat-card">
            <div class="number">${stats.doing_count}</div>
            <div class="label">进行中</div>
        </div>
        <div class="stat-card">
            <div class="number">${stats.avg_rating || '-'}</div>
            <div class="label">平均评分</div>
        </div>
    `;
    renderBarChart(stats.monthly_stats, stats.monthly_by_type);
    renderTypeChart(stats.type_breakdown);
    renderTagTop10(stats.tag_top10 || []);
    renderDimensionRadar(stats.dimension_avgs || {});
}

/* ===== 按月柱状图 ===== */
function renderBarChart(monthlyStats, monthlyByType) {
    const svg = document.getElementById('bar-chart');
    const width = svg.clientWidth || 800;
    const height = 200;
    const padding = { top: 20, right: 20, bottom: 40, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const maxVal = Math.max(...Object.values(monthlyStats), 1);
    const barWidth = chartWidth / 12 * 0.6;
    const barGap = chartWidth / 12 * 0.4;
    const typeColors = { book: '#e74c3c', movie: '#3498db', music: '#2ecc71' };
    const types = ['book', 'movie', 'music'];

    let svgContent = '';
    for (let i = 0; i < 5; i++) {
        const y = padding.top + chartHeight * (i / 4);
        const val = Math.round(maxVal * (1 - i / 4));
        svgContent += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#eee" stroke-width="1"/>`;
        svgContent += `<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" fill="#999" font-size="11">${val}</text>`;
    }
    for (let i = 0; i < 12; i++) {
        const month = months[i];
        const x = padding.left + i * (chartWidth / 12) + barGap / 2;
        const monthTotal = monthlyStats[month] || 0;
        let cumulativeY = padding.top + chartHeight;
        for (const type of types) {
            const val = (monthlyByType[type] && monthlyByType[type][month]) || 0;
            if (val > 0) {
                const barHeight = (val / maxVal) * chartHeight;
                const barY = cumulativeY - barHeight;
                svgContent += `<rect x="${x}" y="${barY}" width="${barWidth}" height="${barHeight}" fill="${typeColors[type]}" opacity="0.8">
                    <title>${monthLabels[i]}: ${val} 个</title>
                </rect>`;
                cumulativeY = barY;
            }
        }
        svgContent += `<text x="${x + barWidth / 2}" y="${height - padding.bottom + 20}" text-anchor="middle" fill="#666" font-size="11">${monthLabels[i]}</text>`;
    }
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = svgContent;

    const legend = document.getElementById('type-legend');
    if (legend) {
        const labels = { book: '书籍', movie: '影视', music: '音乐' };
        legend.innerHTML = types.map(type => `
            <div class="type-legend-item type-${type}">
                <span class="type-dot" style="background: ${typeColors[type]}"></span>
                ${labels[type]}
            </div>`).join('');
    }
}

/* ===== 类型饼图 ===== */
function renderTypeChart(typeBreakdown) {
    const svg = document.getElementById('type-chart');
    const width = svg.clientWidth || 800;
    const height = 300;
    const types = ['book', 'movie', 'music'];
    const labels = { book: '书籍', movie: '影视', music: '音乐' };
    const colors = { book: '#e74c3c', movie: '#3498db', music: '#2ecc71' };
    const total = types.reduce((sum, t) => sum + (typeBreakdown[t] || 0), 0);
    if (total === 0) {
        svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#999">暂无数据</text>';
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        return;
    }
    const centerX = width / 2, centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 40;
    let startAngle = -Math.PI / 2;
    let svgContent = '';
    const nonZeroTypes = types.filter(t => (typeBreakdown[t] || 0) > 0);
    if (nonZeroTypes.length === 1) {
        const type = nonZeroTypes[0];
        const count = typeBreakdown[type];
        svgContent += `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="${colors[type]}" opacity="0.8">
            <title>${labels[type]}: ${count} 个 (100%)</title>
        </circle>`;
        svgContent += `<text x="${centerX}" y="${centerY - 15}" text-anchor="middle" fill="white" font-size="13" font-weight="bold">${count}</text>`;
        svgContent += `<text x="${centerX}" y="${centerY + 10}" text-anchor="middle" fill="white" font-size="11">${labels[type]} (100%)</text>`;
    } else {
        for (const type of types) {
            const count = typeBreakdown[type] || 0;
            if (count === 0) continue;
            const angle = (count / total) * Math.PI * 2;
            const endAngle = startAngle + angle;
            const x1 = centerX + radius * Math.cos(startAngle);
            const y1 = centerY + radius * Math.sin(startAngle);
            const x2 = centerX + radius * Math.cos(endAngle);
            const y2 = centerY + radius * Math.sin(endAngle);
            const largeArc = angle > Math.PI ? 1 : 0;
            svgContent += `<path d="M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z" 
                fill="${colors[type]}" opacity="0.8">
                <title>${labels[type]}: ${count} 个 (${((count / total) * 100).toFixed(1)}%)</title>
            </path>`;
            const midAngle = startAngle + angle / 2;
            const labelX = centerX + (radius * 0.65) * Math.cos(midAngle);
            const labelY = centerY + (radius * 0.65) * Math.sin(midAngle);
            svgContent += `<text x="${labelX}" y="${labelY}" text-anchor="middle" fill="white" font-size="13" font-weight="bold">${count}</text>`;
            startAngle = endAngle;
        }
    }
    svgContent += `<text x="${centerX}" y="${centerY + radius + 25}" text-anchor="middle" fill="#333" font-size="16" font-weight="bold">共 ${total}</text>`;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = svgContent;
}

/* ===== 标签 Top10 横向条 ===== */
function renderTagTop10(list) {
    const el = document.getElementById('tag-top10');
    if (!list || !list.length) {
        el.innerHTML = '<div class="empty-state" style="padding:1.5rem">暂无标签数据</div>';
        return;
    }
    const max = Math.max(...list.map(t => t.count), 1);
    const palette = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6',
                     '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b'];
    el.innerHTML = list.map((t, i) => {
        const pct = (t.count / max) * 100;
        const color = palette[i % palette.length];
        return `<div class="horizontal-bar-row">
            <div class="horizontal-bar-label" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</div>
            <div class="horizontal-bar-track">
                <div class="horizontal-bar-fill" style="width:${pct.toFixed(1)}%; background: linear-gradient(90deg, ${color}, ${shade(color, -20)});">
                </div>
            </div>
            <div class="horizontal-bar-value">${t.count}</div>
        </div>`;
    }).join('');
}

function shade(hex, percent) {
    const f = parseInt(hex.slice(1), 16);
    const t = percent < 0 ? 0 : 255;
    const p = Math.abs(percent) / 100;
    const R = f >> 16, G = (f >> 8) & 0xff, B = f & 0xff;
    const r = Math.round((t - R) * p) + R;
    const g = Math.round((t - G) * p) + G;
    const b = Math.round((t - B) * p) + B;
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/* ===== 维度平均雷达 ===== */
function renderDimensionRadar(dimensionAvgs) {
    const el = document.getElementById('dimension-radar');
    const typeNames = { book: '书籍', movie: '影视', music: '音乐' };
    const typeColors = { book: '#e74c3c', movie: '#3498db', music: '#2ecc71' };
    let html = '';
    for (const [type, conf] of Object.entries(TYPE_RATING)) {
        const data = (dimensionAvgs[type] || []).filter(d => d.avg != null);
        const labels = data.map(d => d.label);
        const values = data.map(d => d.avg || 0);
        const hasData = values.length > 0;
        const size = 220;
        const svg = hasData ? buildRadarSVG(labels, values, size, typeColors[type]) :
            `<svg class="radar-chart-small" viewBox="0 0 ${size} ${size}"><text x="50%" y="50%" text-anchor="middle" fill="#aaa" font-size="14">暂无该类型评分</text></svg>`;
        const avgAll = values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : '-';
        html += `<div style="flex:1; min-width:260px; background:#fafbfc; border:1px solid #eef1f3; border-radius:8px; padding:1rem;">
            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:0.5rem;">
                <h4 style="margin:0; color:#444;">${typeNames[type]}</h4>
                <span style="font-size:0.85rem; color:#888;">综合 <b style="color:#f39c12; font-size:1.05rem;">${avgAll}</b></span>
            </div>
            <div style="display:flex; justify-content:center;">${svg}</div>
            <div style="margin-top:0.75rem; display:grid; grid-template-columns: 1fr 1fr; gap:0.25rem 1rem; font-size:0.85rem;">
                ${data.length ? data.map(d => `
                    <div style="display:flex; justify-content:space-between;">
                        <span style="color:#666;">${d.label}</span>
                        <span style="color:#333; font-weight:600;">${d.avg}${'★'.repeat(Math.round(d.avg))}</span>
                    </div>`).join('') :
                    '<div style="grid-column:1/-1; text-align:center; color:#aaa;">暂无数据</div>'}
            </div>
        </div>`;
    }
    el.innerHTML = html;
}

function buildRadarSVG(labels, values, size = 220, color = '#3498db') {
    const n = labels.length;
    if (n < 3) return `<svg viewBox="0 0 ${size} ${size}"></svg>`;
    const cx = size / 2, cy = size / 2;
    const radius = size * 0.36;
    const levels = 5;
    const angle = (i) => (-Math.PI / 2) + (i * 2 * Math.PI) / n;
    const point = (i, v) => {
        const r = (Math.min(v, 5) / 5) * radius;
        const a = angle(i);
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    };
    let svg = '';
    for (let lvl = 1; lvl <= levels; lvl++) {
        const pts = [];
        for (let i = 0; i < n; i++) {
            const [x, y] = point(i, lvl);
            pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
        }
        svg += `<polyline class="grid" points="${pts.join(' ')} ${pts[0]}" fill="none" stroke="#e3e8ed" stroke-width="1"/>`;
    }
    for (let i = 0; i < n; i++) {
        const [x, y] = point(i, 5);
        svg += `<line x1="${cx.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#e3e8ed" stroke-width="1"/>`;
    }
    const dataPts = [];
    for (let i = 0; i < n; i++) {
        const v = values[i] || 0;
        const [x, y] = point(i, v);
        dataPts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    const hex = hexToRgba(color, 0.22);
    svg += `<polygon points="${dataPts.join(' ')}" fill="${hex}" stroke="${color}" stroke-width="2"/>`;
    for (let i = 0; i < n; i++) {
        const v = values[i] || 0;
        if (v > 0) {
            const [x, y] = point(i, v);
            svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${color}"/>`;
        }
    }
    const labelRadius = radius + 14;
    for (let i = 0; i < n; i++) {
        const a = angle(i);
        const lx = cx + labelRadius * Math.cos(a);
        const ly = cy + labelRadius * Math.sin(a);
        const anchor = Math.abs(Math.cos(a)) < 0.2 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end');
        const dy = Math.abs(Math.sin(a)) < 0.2 ? 0 : (Math.sin(a) > 0 ? 5 : -2);
        svg += `<text text-anchor="${anchor}" x="${lx.toFixed(1)}" y="${(ly + dy).toFixed(1)}" fill="#555" font-size="12">${labels[i]}</text>`;
    }
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${svg}</svg>`;
}

function hexToRgba(hex, alpha) {
    const f = parseInt(hex.slice(1), 16);
    const R = f >> 16, G = (f >> 8) & 0xff, B = f & 0xff;
    return `rgba(${R}, ${G}, ${B}, ${alpha})`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}
