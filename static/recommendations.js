const API_URL = '/api/recommendations';
const MEMBERS_URL = '/api/members';

let allMembers = [];
let allRecommendations = [];
let currentUsername = '';
let currentUserId = 0;

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

// Logout handler
document.getElementById('logout-btn').addEventListener('click', async () => {
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
});

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

// Load recommendations
async function loadRecommendations() {
    try {
        const response = await fetch(API_URL);
        allRecommendations = await response.json();
        renderRecommendations();
    } catch (error) {
        console.error('Error loading recommendations:', error);
        alert('Failed to load recommendations.');
    }
}

// Render recommendations
function renderRecommendations() {
    const container = document.getElementById('recommendations-list');
    const filterSearch = document.getElementById('filter-search').value.toLowerCase();
    
    const filtered = allRecommendations.filter(rec => {
        const memberMatch = rec.member_name.toLowerCase().includes(filterSearch);
        const recommenderMatch = rec.recommended_by.toLowerCase().includes(filterSearch);
        return memberMatch || recommenderMatch;
    });
    
    if (filtered.length === 0) {
        container.innerHTML = '<p class="no-data">No recommendations found.</p>';
        return;
    }
    
    let html = '';
    filtered.forEach(rec => {
        const canDelete = rec.recommended_by === currentUsername;
        const date = new Date(rec.created_at);
        const formattedDate = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        const expiredClass = rec.expired ? ' expired' : '';
        const expiredBadge = rec.expired ? '<span class="expired-badge">✓ Assigned</span>' : '';
        
        html += `
            <div class="recommendation-card${expiredClass}">
                <div class="recommendation-header">
                    <div class="recommendation-member">
                        <span class="member-name">${escapeHtml(rec.member_name)}</span>
                        <span class="member-rank rank-${rec.member_rank}">${rec.member_rank}</span>
                        ${expiredBadge}
                    </div>
                    ${canDelete ? `<button class="delete-btn" onclick="deleteRecommendation(${rec.id})">🗑️ Delete</button>` : ''}
                </div>
                <div class="recommendation-body">
                    <div class="recommendation-meta">
                        <span class="recommended-by">👤 Recommended by: <strong>${escapeHtml(rec.recommended_by)}</strong></span>
                        <span class="recommendation-date">📅 ${formattedDate}</span>
                    </div>
                    ${rec.notes ? `<div class="recommendation-notes">${escapeHtml(rec.notes)}</div>` : ''}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Submit recommendation
async function submitRecommendation() {
    const memberSelect = document.getElementById('member-select');
    const notesInput = document.getElementById('notes-input');
    
    const memberId = parseInt(memberSelect.value);
    const notes = notesInput.value.trim();
    
    if (!memberId) {
        alert('Please select a member to recommend.');
        return;
    }
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ member_id: memberId, notes })
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit recommendation');
        }
        
        // Clear form
        memberSelect.value = '';
        notesInput.value = '';
        document.getElementById('member-search').value = '';
        
        // Reload recommendations
        await loadRecommendations();
        
        alert('✓ Recommendation submitted successfully!');
    } catch (error) {
        console.error('Error submitting recommendation:', error);
        alert('Failed to submit recommendation: ' + error.message);
    }
}

// Delete recommendation
async function deleteRecommendation(id) {
    if (!confirm('Delete this recommendation?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Failed to delete recommendation');
        }
        
        await loadRecommendations();
        alert('✓ Recommendation deleted.');
    } catch (error) {
        console.error('Error deleting recommendation:', error);
        alert('Failed to delete recommendation: ' + error.message);
    }
}

// Escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const isAuthenticated = await checkAuth();
    if (isAuthenticated) {
        await loadMembers();
        await loadRecommendations();
        setupMemberSearch();
        
        // Set up event listeners
        document.getElementById('submit-recommendation-btn').addEventListener('click', submitRecommendation);
        document.getElementById('filter-search').addEventListener('input', renderRecommendations);
    }
});
