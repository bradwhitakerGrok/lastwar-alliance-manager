const API_BASE = '/api';
const RANKINGS_URL = `${API_BASE}/rankings`;

let currentData = null;
let filteredRankings = null;

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
                <span class="info-label">⭐ Recommendation:</span>
                <span class="info-value">+${settings.recommendation_points} pts each</span>
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
            <strong>Note:</strong> Rankings are calculated based on last week's awards. 
            Average conductor count: <strong>${avgCount.toFixed(2)}</strong> times.
        </p>
    `;
    document.getElementById('system-info').innerHTML = html;
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
                            <h5>🏆 Award Details</h5>
                            <div class="awards-list">
                                ${ranking.award_details.map(award => `
                                    <span class="award-chip">
                                        ${getRankEmoji(award.rank)} ${award.award_type}: +${award.points} pts
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
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
