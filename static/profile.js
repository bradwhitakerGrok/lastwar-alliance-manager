const API_BASE = '/api';

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
        
        // Display profile info
        document.getElementById('profile-username').textContent = data.username;
        document.getElementById('profile-role').textContent = data.is_admin ? 'Administrator' : 'Member';
        
        if (data.rank) {
            document.getElementById('profile-member').textContent = data.rank;
            document.getElementById('profile-member-info').style.display = 'block';
        }
        
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

// Change password
document.getElementById('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (newPassword !== confirmPassword) {
        alert('❌ New passwords do not match!');
        return;
    }
    
    if (newPassword.length < 6) {
        alert('❌ New password must be at least 6 characters!');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/change-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }
        
        alert('✅ Password changed successfully!');
        document.getElementById('password-form').reset();
    } catch (error) {
        console.error('Error changing password:', error);
        alert('❌ Failed to change password: ' + error.message);
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
});
