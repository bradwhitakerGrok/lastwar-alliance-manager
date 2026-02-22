const API_URL = '/api/dyno-recommendations';
const MEMBERS_URL = '/api/members';

let allMembers = [];
let allDynoRecs = [];
let currentUsername = '';
let currentUserId = 0;
let currentView = 'list'; // 'list' or 'grouped'
let currentFilter = 'all'; // 'all', 'active', 'positive', 'negative', 'mine'

// Check authentication
async function checkAuth() {
    try {
        const response = await fetch('/api/check-auth');
        const data = await response.json();
        
        if (!data.authenticated) {
            window.location.href = '/login.html';
            return false;
        }
        
        currentUsername = data.username;
        currentUserId = data.user_id || 0;
        let displayText = `👤 ${currentUsername}`;
        if (data.rank) {
            displayText += ` (${data.rank})`;
        }
        document.getElementById('username-display').textContent = displayText;
        
        return true;
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/login.html';
        return false;
    }
}

// Setup event listeners after auth check
async function setupEventListeners() {
    const usernameDisplay = document.getElementById('username-display');
    const logoutBtn = document.getElementById('dropdown-logout-btn');
    const adminLink = document.getElementById('admin-dropdown-link');
    
    if (usernameDisplay) {
        usernameDisplay.addEventListener('click', toggleUserDropdown);
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Check if user is admin to show admin link
    try {
        const response = await fetch('/api/check-auth');
        const data = await response.json();
        if (data.is_admin && adminLink) {
            adminLink.style.display = 'block';
        }
    } catch (error) {
        console.error('Error checking admin status:', error);
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (event) => {
        const dropdown = document.getElementById('user-dropdown-menu');
        const usernameBtn = document.getElementById('username-display');
        if (dropdown && usernameBtn && !usernameBtn.contains(event.target) && !dropdown.contains(event.target)) {
            dropdown.classList.remove('show');
        }
    });
}

// Toggle user dropdown menu
function toggleUserDropdown(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('user-dropdown-menu');
    if (dropdown) {
        dropdown.classList.toggle('show');
    }
}

// Logout handler
async function handleLogout(event) {
    event.preventDefault();
    if (!confirm('Are you sure you want to logout?')) {
        return;
    }
    
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error logging out. Please try again.');
    }
}

// Load members
async function loadMembers() {
    try {
        const response = await fetch(MEMBERS_URL);
        allMembers = await response.json();
        allMembers.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
        populateMemberSelect();
    } catch (error) {
        console.error('Error loading members:', error);
        alert('Failed to load members.');
    }
}

// Populate member select dropdown
function populateMemberSelect() {
    const select = document.getElementById('member-select');
    select.innerHTML = '<option value="">Select a member...</option>';
    
    allMembers.forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = `${member.name} (${member.rank})`;
        select.appendChild(option);
    });
}

// Setup search filter for member dropdown
function setupMemberSearch() {
    const searchInput = document.getElementById('member-search');
    const selectElement = document.getElementById('member-select');
    
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        const options = selectElement.options;
        let visibleCount = 0;
        
        for (let i = 1; i < options.length; i++) {
            const text = options[i].textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                options[i].style.display = '';
                visibleCount++;
            } else {
                options[i].style.display = 'none';
            }
        }
        
        // Auto-select if only one match
        if (visibleCount === 1 && searchTerm) {
            for (let i = 1; i < options.length; i++) {
                if (options[i].style.display !== 'none') {
                    selectElement.selectedIndex = i;
                    break;
                }
            }
        }
    });
}

// Load dyno recommendations
async function loadDynoRecommendations() {
    try {
        const response = await fetch(API_URL);
        allDynoRecs = await response.json();
        updateStatistics();
        renderDynoRecommendations();
    } catch (error) {
        console.error('Error loading dyno recommendations:', error);
        alert('Failed to load dyno recommendations.');
    }
}

// Update statistics dashboard
function updateStatistics() {
    const active = allDynoRecs.filter(r => !r.expired);
    const expired = allDynoRecs.filter(r => r.expired);
    const positive = active.filter(r => r.points > 0);
    const negative = active.filter(r => r.points < 0);
    
    document.getElementById('total-dyno').textContent = active.length;
    document.getElementById('positive-dyno').textContent = positive.length;
    document.getElementById('negative-dyno').textContent = negative.length;
    document.getElementById('expired-dyno').textContent = expired.length;
}

// Render dyno recommendations
function renderDynoRecommendations() {
    const container = document.getElementById('dyno-list');
    const filterSearch = document.getElementById('filter-search').value.toLowerCase();
    
    // Apply filter
    let filtered = allDynoRecs.filter(rec => {
        const memberMatch = rec.member_name.toLowerCase().includes(filterSearch);
        const creatorMatch = rec.created_by.toLowerCase().includes(filterSearch);
        const searchMatch = !filterSearch || memberMatch || creatorMatch;
        
        let statusMatch = true;
        if (currentFilter === 'active') {
            statusMatch = !rec.expired;
        } else if (currentFilter === 'positive') {
            statusMatch = !rec.expired && rec.points > 0;
        } else if (currentFilter === 'negative') {
            statusMatch = !rec.expired && rec.points < 0;
        } else if (currentFilter === 'mine') {
            statusMatch = rec.created_by_id === currentUserId;
        }
        
        return searchMatch && statusMatch;
    });
    
    if (filtered.length === 0) {
        container.innerHTML = '<p class="no-data">No dyno recommendations found.</p>';
        return;
    }
    
    if (currentView === 'grouped') {
        renderGroupedView(filtered, container);
    } else {
        renderListView(filtered, container);
    }
}

// Render list view
function renderListView(recs, container) {
    container.innerHTML = '';
    
    recs.forEach(rec => {
        const card = createDynoCard(rec);
        container.appendChild(card);
    });
}

// Render grouped view (by member)
function renderGroupedView(recs, container) {
    container.innerHTML = '';
    
    // Group by member
    const grouped = {};
    recs.forEach(rec => {
        if (!grouped[rec.member_id]) {
            grouped[rec.member_id] = {
                member: { id: rec.member_id, name: rec.member_name, rank: rec.member_rank },
                recommendations: []
            };
        }
        grouped[rec.member_id].recommendations.push(rec);
    });
    
    Object.values(grouped).forEach(group => {
        const groupCard = document.createElement('div');
        groupCard.className = 'member-group-card';
        
        const totalPoints = group.recommendations.reduce((sum, r) => sum + r.points, 0);
        const activeRecs = group.recommendations.filter(r => !r.expired);
        
        groupCard.innerHTML = `
            <div class="member-group-header">
                <div class="member-info">
                    <span class="member-name">${group.member.name}</span>
                    <span class="rank-badge rank-${group.member.rank.toLowerCase()}">${group.member.rank}</span>
                    <span class="dyno-count">${activeRecs.length} active</span>
                </div>
                <div class="member-total-points ${totalPoints >= 0 ? 'positive' : 'negative'}">
                    ${totalPoints > 0 ? '+' : ''}${totalPoints} pts
                </div>
            </div>
            <div class="grouped-recommendations"></div>
        `;
        
        const recsContainer = groupCard.querySelector('.grouped-recommendations');
        group.recommendations.forEach(rec => {
            const card = createDynoCard(rec, true);
            recsContainer.appendChild(card);
        });
        
        container.appendChild(groupCard);
    });
}

// Create dyno recommendation card
function createDynoCard(rec, compact = false) {
    const card = document.createElement('div');
    card.className = `recommendation-card ${rec.expired ? 'expired' : ''}`;
    
    const pointsClass = rec.points > 0 ? 'positive' : (rec.points < 0 ? 'negative' : 'neutral');
    const pointsIcon = rec.points > 0 ? '✅' : (rec.points < 0 ? '❌' : '➖');
    
    const createdDate = new Date(rec.created_at);
    const now = new Date();
    const expiryDate = new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const daysLeft = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
    
    const expiryText = rec.expired 
        ? '⏱️ Expired' 
        : `⏱️ ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
    
    card.innerHTML = `
        <div class="rec-header">
            ${!compact ? `
            <div class="member-info">
                <span class="member-name">${rec.member_name}</span>
                <span class="rank-badge rank-${rec.member_rank.toLowerCase()}">${rec.member_rank}</span>
            </div>
            ` : ''}
            <div class="rec-points ${pointsClass}">
                ${pointsIcon} ${rec.points > 0 ? '+' : ''}${rec.points}
            </div>
        </div>
        <div class="rec-notes">${rec.notes || 'No notes provided'}</div>
        <div class="rec-footer">
            <div class="rec-meta">
                <span class="rec-by">by ${rec.created_by}</span>
                <span class="rec-date">${formatDate(rec.created_at)}</span>
                <span class="expiry-badge ${rec.expired ? 'expired' : ''}">${expiryText}</span>
            </div>
            ${rec.created_by_id === currentUserId ? `
                <button class="delete-btn" onclick="deleteDynoRecommendation(${rec.id})">🗑️ Delete</button>
            ` : ''}
        </div>
    `;
    
    return card;
}

// Submit dyno recommendation
async function submitDynoRecommendation() {
    const memberId = parseInt(document.getElementById('member-select').value);
    const points = parseInt(document.getElementById('points-input').value);
    const notes = document.getElementById('notes-input').value.trim();
    
    if (!memberId) {
        alert('Please select a member.');
        return;
    }
    
    if (isNaN(points)) {
        alert('Please enter valid points.');
        return;
    }
    
    if (!notes) {
        alert('Please provide notes for this recommendation.');
        return;
    }
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ member_id: memberId, points: points, notes: notes })
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }
        
        // Clear form
        document.getElementById('member-select').value = '';
        document.getElementById('member-search').value = '';
        document.getElementById('points-input').value = '';
        document.getElementById('notes-input').value = '';
        
        // Reload recommendations
        await loadDynoRecommendations();
        
        alert('Dyno recommendation submitted successfully!');
    } catch (error) {
        console.error('Error submitting dyno recommendation:', error);
        alert('Failed to submit dyno recommendation: ' + error.message);
    }
}

// Delete dyno recommendation
async function deleteDynoRecommendation(id) {
    if (!confirm('Are you sure you want to delete this dyno recommendation?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete dyno recommendation');
        }
        
        await loadDynoRecommendations();
    } catch (error) {
        console.error('Error deleting dyno recommendation:', error);
        alert('Failed to delete dyno recommendation.');
    }
}

// Format date
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
}

// Setup view toggle
function setupViewToggle() {
    const listBtn = document.getElementById('list-view-btn');
    const groupedBtn = document.getElementById('grouped-view-btn');
    
    listBtn.addEventListener('click', () => {
        currentView = 'list';
        listBtn.classList.add('active');
        groupedBtn.classList.remove('active');
        renderDynoRecommendations();
    });
    
    groupedBtn.addEventListener('click', () => {
        currentView = 'grouped';
        groupedBtn.classList.add('active');
        listBtn.classList.remove('active');
        renderDynoRecommendations();
    });
}

// Setup filter chips
function setupFilters() {
    const filterChips = document.querySelectorAll('.filter-chip');
    
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.dataset.filter;
            renderDynoRecommendations();
        });
    });
    
    // Search filter
    const searchInput = document.getElementById('filter-search');
    searchInput.addEventListener('input', () => {
        renderDynoRecommendations();
    });
}

// Initialize
async function init() {
    const authenticated = await checkAuth();
    if (!authenticated) return;
    
    await setupEventListeners();
    await loadMembers();
    await loadDynoRecommendations();
    
    setupMemberSearch();
    setupViewToggle();
    setupFilters();
    
    // Submit button
    document.getElementById('submit-dyno-btn').addEventListener('click', submitDynoRecommendation);
}

// Run on page load
document.addEventListener('DOMContentLoaded', init);
