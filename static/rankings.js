const API_BASE = '/api';
const RANKINGS_URL = `${API_BASE}/rankings`;

let currentData = null;
let filteredRankings = null;
let charts = {
    score: null,
    conductor: null,
    pointsBreakdown: null,
    awardDistribution: null
};

// Check authentication
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/check-auth`);
        if (!response.ok) {
            window.location.href = '/login.html';
            return false;
        }
        const data = await response.json();
        document.getElementById('username-display').textContent = `👤 ${data.username}`;
        return data;
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login.html';
        return false;
    }
}

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
        await fetch(`${API_BASE}/logout`, { method: 'POST' });
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Logout failed:', error);
    }
});

// Format date to dd/mm/yyyy
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// Load rankings
async function loadRankings() {
    try {
        const response = await fetch(RANKINGS_URL);
        if (!response.ok) throw new Error('Failed to load rankings');
        
        currentData = await response.json();
        filteredRankings = currentData.rankings;
        
        displaySystemInfo(currentData.settings, currentData.average_conductor_count);
        displayCharts(currentData);
        displayRankings(filteredRankings);
        
        document.getElementById('avg-count').textContent = 
            currentData.average_conductor_count.toFixed(2);
    } catch (error) {
        console.error('Error loading rankings:', error);
        document.getElementById('rankings-list').innerHTML = 
            '<p class="error">Failed to load rankings. Please try again.</p>';
    }
}

// Display system info
function displaySystemInfo(settings, avgCount) {
    const html = `
        <div class="system-info-grid">
            <div class="system-info-item">
                <span class="info-label">🥇 1st Place Award:</span>
                <span class="info-value">+${settings.award_first_points} pts</span>
            </div>
            <div class="system-info-item">
                <span class="info-label">🥈 2nd Place Award:</span>
                <span class="info-value">+${settings.award_second_points} pts</span>
            </div>
            <div class="system-info-item">
                <span class="info-label">🥉 3rd Place Award:</span>
                <span class="info-value">+${settings.award_third_points} pts</span>
            </div>
            <div class="system-info-item">
                <span class="info-label">⭐ Recommendations:</span>
                <span class="info-value">5 + 5*√n pts (non-linear scaling)</span>
            </div>
            <div class="system-info-item">
                <span class="info-label">🏅 R4/R5 Rank Boost:</span>
                <span class="info-value">+${settings.r4r5_rank_boost} pts</span>
            </div>
            <div class="system-info-item">
                <span class="info-label">🎯 First Time Conductor Boost:</span>
                <span class="info-value">+${settings.first_time_conductor_boost} pts (if never been conductor)</span>
            </div>
            <div class="system-info-item">
                <span class="info-label">⏱️ Recent Conductor Penalty:</span>
                <span class="info-value">-${settings.recent_conductor_penalty_days} pts max (based on days)</span>
            </div>
            <div class="system-info-item">
                <span class="info-label">📊 Above Average Penalty:</span>
                <span class="info-value">-${settings.above_average_conductor_penalty} pts</span>
            </div>
        </div>
        <p class="system-note">
            <strong>Note:</strong> Awards and recommendations stack across multiple weeks until you're assigned as conductor/backup, then they expire. 
            Average conductor count: <strong>${avgCount.toFixed(2)}</strong> times.
            <br><strong>Recommendation Formula:</strong> 1 rec = 10pts, 2 recs = 12pts, 3 recs = 14pts, 4 recs = 15pts (diminishing returns)
        </p>
    `;
    document.getElementById('system-info').innerHTML = html;
}

// Display charts
function displayCharts(data) {
    const rankings = data.rankings;
    
    // Destroy existing charts
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });
    
    // 1. Score Distribution Chart
    const scoreLabels = rankings.map((r, i) => `#${i + 1} ${r.member.name}`);
    const scoreData = rankings.map(r => r.total_score);
    
    const scoreCtx = document.getElementById('scoreChart').getContext('2d');
    charts.score = new Chart(scoreCtx, {
        type: 'bar',
        data: {
            labels: scoreLabels.slice(0, 15),
            datasets: [{
                label: 'Total Score',
                data: scoreData.slice(0, 15),
                backgroundColor: 'rgba(102, 126, 234, 0.8)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                title: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Points' }
                }
            }
        }
    });
    
    // 2. Conductor Frequency Chart
    const conductorCounts = rankings.map(r => ({ name: r.member.name, count: r.conductor_count }));
    conductorCounts.sort((a, b) => b.count - a.count);
    
    const conductorCtx = document.getElementById('conductorChart').getContext('2d');
    charts.conductor = new Chart(conductorCtx, {
        type: 'bar',
        data: {
            labels: conductorCounts.slice(0, 15).map(c => c.name),
            datasets: [{
                label: 'Conductor Count',
                data: conductorCounts.slice(0, 15).map(c => c.count),
                backgroundColor: 'rgba(255, 159, 64, 0.8)',
                borderColor: 'rgba(255, 159, 64, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 },
                    title: { display: true, text: 'Times as Conductor' }
                }
            }
        }
    });
    
    // 3. Points Breakdown Chart (Top 10)
    const top10 = rankings.slice(0, 10);
    const pointsBreakdownCtx = document.getElementById('pointsBreakdownChart').getContext('2d');
    charts.pointsBreakdown = new Chart(pointsBreakdownCtx, {
        type: 'bar',
        data: {
            labels: top10.map(r => r.member.name),
            datasets: [
                {
                    label: 'Awards',
                    data: top10.map(r => r.award_points),
                    backgroundColor: 'rgba(255, 205, 86, 0.8)'
                },
                {
                    label: 'Recommendations',
                    data: top10.map(r => r.recommendation_points),
                    backgroundColor: 'rgba(75, 192, 192, 0.8)'
                },
                {
                    label: 'Rank Boost',
                    data: top10.map(r => r.rank_boost),
                    backgroundColor: 'rgba(153, 102, 255, 0.8)'
                },
                {
                    label: 'First Timer',
                    data: top10.map(r => r.first_time_conductor_boost),
                    backgroundColor: 'rgba(54, 162, 235, 0.8)'
                },
                {
                    label: 'Recent Penalty',
                    data: top10.map(r => -r.recent_conductor_penalty),
                    backgroundColor: 'rgba(255, 99, 132, 0.8)'
                },
                {
                    label: 'Above Avg Penalty',
                    data: top10.map(r => -r.above_average_penalty),
                    backgroundColor: 'rgba(255, 159, 64, 0.8)'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: true, position: 'bottom' }
            },
            scales: {
                x: { stacked: true },
                y: { 
                    stacked: true,
                    title: { display: true, text: 'Points' }
                }
            }
        }
    });
    
    // 4. Award Distribution Chart
    const awardTypes = {};
    rankings.forEach(r => {
        if (r.award_details && r.award_details.length > 0) {
            r.award_details.forEach(award => {
                const key = `${award.award_type} - ${getRankEmoji(award.rank)}`;
                awardTypes[key] = (awardTypes[key] || 0) + 1;
            });
        }
    });
    
    const awardLabels = Object.keys(awardTypes);
    const awardData = Object.values(awardTypes);
    
    const awardCtx = document.getElementById('awardDistributionChart').getContext('2d');
    charts.awardDistribution = new Chart(awardCtx, {
        type: 'doughnut',
        data: {
            labels: awardLabels,
            datasets: [{
                data: awardData,
                backgroundColor: [
                    'rgba(255, 205, 86, 0.8)',
                    'rgba(192, 192, 192, 0.8)',
                    'rgba(205, 127, 50, 0.8)',
                    'rgba(102, 126, 234, 0.8)',
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(153, 102, 255, 0.8)',
                    'rgba(255, 159, 64, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: true, position: 'right' }
            }
        }
    });
}

// Filter rankings
function filterRankings() {
    if (!currentData || !currentData.rankings) return;
    
    const nameFilter = document.getElementById('filter-name').value.toLowerCase().trim();
    const rankFilter = document.getElementById('filter-rank').value;
    
    filteredRankings = currentData.rankings.filter(ranking => {
        const nameMatch = !nameFilter || ranking.member.name.toLowerCase().includes(nameFilter);
        const rankMatch = !rankFilter || ranking.member.rank === rankFilter;
        return nameMatch && rankMatch;
    });
    
    displayRankings(filteredRankings);
}

// Clear filters
function clearFilters() {
    document.getElementById('filter-name').value = '';
    document.getElementById('filter-rank').value = '';
    filteredRankings = currentData.rankings;
    displayRankings(filteredRankings);
}

// Display rankings
function displayRankings(rankings) {
    if (rankings.length === 0) {
        document.getElementById('rankings-list').innerHTML = 
            '<p class="empty">No members match the current filters.</p>';
        return;
    }

    let html = '';
    rankings.forEach((ranking, index) => {
        const rankClass = index === 0 ? 'rank-first' : index === 1 ? 'rank-second' : index === 2 ? 'rank-third' : '';
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        
        html += `
            <div class="ranking-card ${rankClass}">
                <div class="ranking-header">
                    <div class="ranking-position">
                        <span class="position-number">${medal} #${index + 1}</span>
                        <h4>${escapeHtml(ranking.member.name)} <span class="rank-badge">${ranking.member.rank}</span></h4>
                    </div>
                    <div class="total-score">
                        <span class="score-value">${ranking.total_score}</span>
                        <span class="score-label">pts</span>
                    </div>
                </div>
                
                <div class="ranking-details">
                    <div class="detail-section">
                        <h5>📊 Score Breakdown</h5>
                        <div class="detail-grid">
                            <div class="detail-item positive">
                                <span class="detail-label">🏆 Awards:</span>
                                <span class="detail-value">+${ranking.award_points} pts</span>
                            </div>
                            <div class="detail-item positive">
                                <span class="detail-label">⭐ Recommendations:</span>
                                <span class="detail-value">+${ranking.recommendation_points} pts (${ranking.recommendation_count})</span>
                            </div>
                            <div class="detail-item positive">
                                <span class="detail-label">🏅 Rank Boost:</span>
                                <span class="detail-value">+${ranking.rank_boost} pts</span>
                            </div>
                            <div class="detail-item positive">
                                <span class="detail-label">🎯 First Timer:</span>
                                <span class="detail-value">+${ranking.first_time_conductor_boost} pts</span>
                            </div>
                            <div class="detail-item negative">
                                <span class="detail-label">⏱️ Recent Conductor:</span>
                                <span class="detail-value">-${ranking.recent_conductor_penalty} pts</span>
                            </div>
                            <div class="detail-item negative">
                                <span class="detail-label">📈 Above Average:</span>
                                <span class="detail-value">-${ranking.above_average_penalty} pts</span>
                            </div>
                        </div>
                    </div>
                    
                    ${ranking.award_details && ranking.award_details.length > 0 ? `
                        <div class="detail-section">
                            <h5>🏆 Award Details (${ranking.award_details.length} awards)</h5>
                            <div class="awards-detailed-list">
                                ${ranking.award_details.map(award => `
                                    <div class="award-detail-item">
                                        <span class="award-icon">${getRankEmoji(award.rank)}</span>
                                        <span class="award-type">${escapeHtml(award.award_type)}</span>
                                        <span class="award-rank">${getPlaceText(award.rank)}</span>
                                        <span class="award-points">+${award.points} pts</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : `
                        <div class="detail-section">
                            <h5>🏆 Award Details</h5>
                            <p class="no-awards">No awards yet</p>
                        </div>
                    `}
                    
                    <div class="detail-section">
                        <h5>📈 Conductor Statistics</h5>
                        <div class="stats-grid">
                            <div class="stat-item">
                                <span class="stat-label">Times as Conductor:</span>
                                <span class="stat-value">${ranking.conductor_count}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Last Conductor Date:</span>
                                <span class="stat-value">${formatDate(ranking.last_conductor_date)}</span>
                            </div>
                            ${ranking.days_since_last_conductor !== null ? `
                                <div class="stat-item">
                                    <span class="stat-label">Days Since Last:</span>
                                    <span class="stat-value">${ranking.days_since_last_conductor} days</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    document.getElementById('rankings-list').innerHTML = html;
}

// Get rank emoji
function getRankEmoji(rank) {
    switch(rank) {
        case 1: return '🥇';
        case 2: return '🥈';
        case 3: return '🥉';
        default: return '🏅';
    }
}

// Get place text
function getPlaceText(rank) {
    switch(rank) {
        case 1: return '1st Place';
        case 2: return '2nd Place';
        case 3: return '3rd Place';
        default: return `${rank}th Place`;
    }
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Refresh rankings
document.getElementById('refresh-btn').addEventListener('click', loadRankings);

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const auth = await checkAuth();
    if (auth) {
        await loadRankings();
        
        // Add filter event listeners
        document.getElementById('filter-name').addEventListener('input', filterRankings);
        document.getElementById('filter-rank').addEventListener('change', filterRankings);
        document.getElementById('clear-filters-btn').addEventListener('click', clearFilters);
    }
});
