const API_URL = '/api/members';

let editingMemberId = null;
let currentUsername = '';
let canManageRanks = false;
let isR5OrAdmin = false;
let allMembers = []; // Store all members for search filtering

// Check authentication on page load
async function checkAuth() {
    try {
        const response = await fetch('/api/check-auth');
        const data = await response.json();
        
        if (!data.authenticated) {
            window.location.href = '/login.html';
            return false;
        }
        
        currentUsername = data.username;
        canManageRanks = data.can_manage_ranks || false;
        isR5OrAdmin = data.is_r5_or_admin || false;
        
        let displayText = `👤 ${currentUsername}`;
        if (data.rank) {
            displayText += ` (${data.rank})`;
        }
        document.getElementById('username-display').textContent = displayText;
        
        // Show/hide management controls based on permissions
        updateUIPermissions();
        
        return true;
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/login.html';
        return false;
    }
}

// Update UI based on user permissions
function updateUIPermissions() {
    const formSection = document.querySelector('.form-section');
    
    if (!canManageRanks) {
        // Hide the add member form for users without permission
        formSection.style.display = 'none';
        
        // Add notice message
        const notice = document.createElement('div');
        notice.className = 'permission-notice';
        notice.innerHTML = '<p>ℹ️ Only R4 and R5 members can add or manage member ranks.</p>';
        document.querySelector('main').insertBefore(notice, document.querySelector('.members-section'));
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

// Load all members
async function loadMembers() {
    try {
        const response = await fetch(API_URL);
        const members = await response.json();
        allMembers = members; // Store for search
        displayMembers(members);
        updateMemberCount(members.length);
    } catch (error) {
        console.error('Error loading members:', error);
        document.getElementById('members-list').innerHTML = 
            '<p class="empty">Error loading members. Please try again.</p>';
    }
}

// Display members in the list
function displayMembers(members) {
    const membersList = document.getElementById('members-list');
    
    if (!members || members.length === 0) {
        membersList.innerHTML = '<p class="empty">No members yet. Add your first alliance member!</p>';
        return;
    }

    membersList.innerHTML = members.map(member => {
        let actionsHtml = '';
        if (canManageRanks) {
            actionsHtml = `
                <div class="member-actions">
                    <button class="edit-btn" onclick="editMember(${member.id}, '${escapeHtml(member.name)}', '${escapeHtml(member.rank)}')">Edit</button>
                    <button class="delete-btn" onclick="deleteMember(${member.id}, '${escapeHtml(member.name)}')">Delete</button>
                    ${isR5OrAdmin ? `<button class="create-user-btn" onclick="createUserForMember(${member.id}, '${escapeHtml(member.name)}')">Create User</button>` : ''}
                </div>
            `;
        }
        
        return `
            <div class="member-card">
                <div class="member-info">
                    <div class="member-name">${escapeHtml(member.name)}</div>
                    <span class="member-rank rank-${member.rank.replace(/\s+/g, '-')}">${escapeHtml(member.rank)}</span>
                </div>
                ${actionsHtml}
            </div>
        `;
    }).join('');
}

// Update member count
function updateMemberCount(count) {
    const heading = document.querySelector('.members-section h3');
    if (heading) {
        heading.textContent = `Alliance Members (${count})`;
    }
}

// Handle form submission
document.getElementById('member-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!canManageRanks) {
        alert('You do not have permission to manage members. Only R4 and R5 can do this.');
        return;
    }
    
    const name = document.getElementById('member-name').value.trim();
    const rank = document.getElementById('member-rank').value;
    
    if (!name || !rank) {
        alert('Please fill in all fields');
        return;
    }

    try {
        if (editingMemberId) {
            // Update existing member
            const response = await fetch(`${API_URL}/${editingMemberId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, rank }),
            });

            if (!response.ok) throw new Error('Failed to update member');
            
            editingMemberId = null;
            document.getElementById('form-title').textContent = 'Add New Member';
            document.getElementById('submit-btn').textContent = 'Add Member';
            document.getElementById('cancel-btn').style.display = 'none';
        } else {
            // Add new member
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, rank }),
            });

            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('Permission denied: Only R4/R5 members can manage ranks');
                }
                throw new Error('Failed to add member');
            }
        }

        // Reset form and reload members
        document.getElementById('member-form').reset();
        document.getElementById('member-id').value = '';
        await loadMembers();
    } catch (error) {
        console.error('Error saving member:', error);
        alert('Failed to save member. Please try again.');
    }
});

// Edit a member
function editMember(id, name, rank) {
    if (!canManageRanks) {
        alert('You do not have permission to edit members. Only R4 and R5 can do this.');
        return;
    }
    
    editingMemberId = id;
    document.getElementById('member-name').value = name;
    document.getElementById('member-rank').value = rank;
    document.getElementById('form-title').textContent = 'Edit Member';
    document.getElementById('submit-btn').textContent = 'Update Member';
    document.getElementById('cancel-btn').style.display = 'inline-block';
    
    // Scroll to form
    document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
}

// Cancel editing
document.getElementById('cancel-btn').addEventListener('click', () => {
    editingMemberId = null;
    document.getElementById('member-form').reset();
    document.getElementById('form-title').textContent = 'Add New Member';
    document.getElementById('submit-btn').textContent = 'Add Member';
    document.getElementById('cancel-btn').style.display = 'none';
});

// Delete a member
async function deleteMember(id, name) {
    if (!canManageRanks) {
        alert('You do not have permission to delete members. Only R4 and R5 can do this.');
        return;
    }
    
    if (!confirm(`Are you sure you want to remove ${name} from the alliance?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            if (response.status === 403) {
                throw new Error('Permission denied: Only R4/R5 members can manage members');
            }
            throw new Error('Failed to delete member');
        }
        
        await loadMembers();
    } catch (error) {
        console.error('Error deleting member:', error);
        alert('Failed to delete member. Please try again.');
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Load members when page loads
document.addEventListener('DOMContentLoaded', async () => {
    const isAuthenticated = await checkAuth();
    if (isAuthenticated) {
        loadMembers();
        setupCSVImport();
        setupSearch();
    }
});

// Setup search functionality
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('clear-search');
    
    if (!searchInput) return;
    
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        
        if (searchTerm) {
            clearBtn.style.display = 'flex';
            const filtered = allMembers.filter(member => 
                member.name.toLowerCase().includes(searchTerm) ||
                member.rank.toLowerCase().includes(searchTerm)
            );
            displayMembers(filtered);
            updateMemberCount(filtered.length);
        } else {
            clearBtn.style.display = 'none';
            displayMembers(allMembers);
            updateMemberCount(allMembers.length);
        }
    });
    
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        displayMembers(allMembers);
        updateMemberCount(allMembers.length);
        searchInput.focus();
    });
}

// Setup CSV import functionality
function setupCSVImport() {
    const importBtn = document.getElementById('import-btn');
    const fileInput = document.getElementById('csv-file');
    
    if (!importBtn || !fileInput) return;
    
    importBtn.addEventListener('click', async () => {
        if (!canManageRanks) {
            alert('You do not have permission to import members. Only R4 and R5 can do this.');
            return;
        }
        
        const file = fileInput.files[0];
        if (!file) {
            alert('Please select a CSV file to import');
            return;
        }
        
        if (!file.name.endsWith('.csv')) {
            alert('Please select a valid CSV file');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', file);
        
        importBtn.disabled = true;
        importBtn.textContent = 'Importing...';
        
        try {
            const response = await fetch('/api/members/import', {
                method: 'POST',
                body: formData,
            });
            
            if (!response.ok) {
                if (response.status === 403) {
                    throw new Error('Permission denied: Only R4/R5 members can import members');
                }
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to import CSV');
            }
            
            const result = await response.json();
            displayImportResult(result);
            
            // Reload members list
            await loadMembers();
            
            // Clear file input
            fileInput.value = '';
            
        } catch (error) {
            console.error('Import error:', error);
            displayImportError(error.message);
        } finally {
            importBtn.disabled = false;
            importBtn.textContent = 'Import CSV';
        }
    });
}

// Display import results
function displayImportResult(result) {
    const resultDiv = document.getElementById('import-result');
    resultDiv.style.display = 'block';
    
    let className = 'success';
    let message = '';
    
    if (result.imported > 0 && result.skipped === 0) {
        className = 'success';
        message = `✓ Successfully imported ${result.imported} member${result.imported > 1 ? 's' : ''}!`;
    } else if (result.imported > 0 && result.skipped > 0) {
        className = 'warning';
        message = `⚠ Imported ${result.imported} member${result.imported > 1 ? 's' : ''}, skipped ${result.skipped} row${result.skipped > 1 ? 's' : ''}.`;
    } else if (result.imported === 0 && result.skipped > 0) {
        className = 'error';
        message = `✗ No members imported. ${result.skipped} row${result.skipped > 1 ? 's' : ''} skipped.`;
    }
    
    resultDiv.className = `import-result ${className}`;
    
    let html = `<strong>${message}</strong>`;
    
    if (result.errors && result.errors.length > 0) {
        html += '<ul>';
        result.errors.forEach(error => {
            html += `<li>${escapeHtml(error)}</li>`;
        });
        html += '</ul>';
    }
    
    resultDiv.innerHTML = html;
    
    // Auto-hide after 10 seconds if no errors
    if (result.errors.length === 0) {
        setTimeout(() => {
            resultDiv.style.display = 'none';
        }, 10000);
    }
}

// Display import error
function displayImportError(message) {
    const resultDiv = document.getElementById('import-result');
    resultDiv.style.display = 'block';
    resultDiv.className = 'import-result error';
    resultDiv.innerHTML = `<strong>✗ Import failed:</strong> ${escapeHtml(message)}`;
}

// Create user for member
async function createUserForMember(memberId, memberName) {
    if (!confirm(`Create a user account for ${memberName}? A random password will be generated.`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/${memberId}/create-user`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }
        
        const result = await response.json();
        
        // Display the username and password in a popup
        const message = `User created successfully!\n\nUsername: ${result.username}\nPassword: ${result.password}\n\n⚠️ IMPORTANT: Save this password now! It won't be shown again.`;
        alert(message);
        
        // Also log to console for easy copying
        console.log('=== NEW USER CREDENTIALS ===');
        console.log('Username:', result.username);
        console.log('Password:', result.password);
        console.log('============================');
        
    } catch (error) {
        console.error('Error creating user:', error);
        alert('Failed to create user: ' + error.message);
    }
}

