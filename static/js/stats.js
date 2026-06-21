let currentYear = new Date().getFullYear();

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
}

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
        legend.innerHTML = types.map(type => {
            const labels = { book: '书籍', movie: '影视', music: '音乐' };
            return `<div class="type-legend-item type-${type}">
                <span class="type-dot" style="background: ${typeColors[type]}"></span>
                ${labels[type]}
            </div>`;
        }).join('');
    }
}

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
    
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 40;
    
    let startAngle = -Math.PI / 2;
    let svgContent = '';
    
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
        
        if (count > 0) {
            svgContent += `<text x="${labelX}" y="${labelY}" text-anchor="middle" fill="white" font-size="13" font-weight="bold">
                ${count}
            </text>`;
        }
        
        startAngle = endAngle;
    }
    
    svgContent += `<text x="${centerX}" y="${centerY + 5}" text-anchor="middle" fill="#333" font-size="16" font-weight="bold">
        共 ${total}
    </text>`;
    
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = svgContent;
}
