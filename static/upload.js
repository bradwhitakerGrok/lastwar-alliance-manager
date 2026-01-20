const API_URL = '/api/upload-screenshots';
const CONFIRM_URL = '/api/confirm-member-updates';

let currentUsername = '';
let selectedFiles = [];
let detectedMembers = [];

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
        let displayText = `👤 ${currentUsername}`;
        if (data.rank) {
            displayText += ` (${data.rank})`;
        }
        document.getElementById('username-display').textContent = displayText;
        
        // Check if user is R4, R5, or admin
        if (data.rank !== 'R4' && data.rank !== 'R5' && !data.is_admin) {
            alert('Only R4, R5, and admin members can upload screenshots.');
            window.location.href = 'index.html';
            return false;
        }
        
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

// File input handler
document.getElementById('screenshot-files').addEventListener('change', (e) => {
    selectedFiles = Array.from(e.target.files);
    
    if (selectedFiles.length > 0) {
        showPreviews();
    } else {
        document.getElementById('preview-section').style.display = 'none';
    }
});

// Show file previews
function showPreviews() {
    const previewSection = document.getElementById('preview-section');
    const previewsContainer = document.getElementById('file-previews');
    
    previewsContainer.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
        const preview = document.createElement('div');
        preview.className = 'file-preview';
        
        const img = document.createElement('img');
        img.className = 'preview-image';
        
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
        
        const info = document.createElement('div');
        info.className = 'file-info';
        info.innerHTML = `
            <strong>${escapeHtml(file.name)}</strong><br>
            <span class="file-size">${formatFileSize(file.size)}</span>
        `;
        
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'remove-file-btn';
        removeBtn.textContent = '✖';
        removeBtn.onclick = () => removeFile(index);
        
        preview.appendChild(img);
        preview.appendChild(info);
        preview.appendChild(removeBtn);
        previewsContainer.appendChild(preview);
    });
    
    previewSection.style.display = 'block';
}

// Remove file from selection
function removeFile(index) {
    selectedFiles.splice(index, 1);
    
    if (selectedFiles.length > 0) {
        showPreviews();
    } else {
        document.getElementById('preview-section').style.display = 'none';
        document.getElementById('screenshot-files').value = '';
    }
}

// Clear button handler
document.getElementById('clear-btn').addEventListener('click', () => {
    selectedFiles = [];
    document.getElementById('screenshot-files').value = '';
    document.getElementById('preview-section').style.display = 'none';
});

// Upload form submission
document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (selectedFiles.length === 0) {
        alert('Please select at least one screenshot file.');
        return;
    }
    
    // Hide form, show processing
    document.getElementById('upload-form').parentElement.style.display = 'none';
    document.getElementById('processing-section').style.display = 'block';
    document.getElementById('results-section').style.display = 'none';
    document.getElementById('update-section').style.display = 'none';
    
    try {
        const formData = new FormData();
        selectedFiles.forEach((file) => {
            formData.append('screenshots', file);
        });
        
        updateProgress(0, 'Uploading screenshots...');
        
        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('Upload failed: ' + response.statusText);
        }
        
        updateProgress(50, 'Processing images...');
        
        const result = await response.json();
        
        updateProgress(100, 'Complete!');
        
        // Show results
        setTimeout(() => {
            showResults(result);
        }, 500);
        
    } catch (error) {
        console.error('Upload error:', error);
        alert('Error processing screenshots: ' + error.message);
        resetUpload();
    }
});

// Update progress bar
function updateProgress(percent, message) {
    document.getElementById('progress-fill').style.width = percent + '%';
    document.getElementById('processing-message').textContent = message;
}

// Show detection results
function showResults(result) {
    detectedMembers = result.detected_members || [];
    
    document.getElementById('processing-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'block';
    
    // Summary
    const summary = document.getElementById('results-summary');
    summary.innerHTML = `
        <div class="summary-card">
            <div class="summary-item">
                <span class="summary-label">Screenshots Processed:</span>
                <span class="summary-value">${result.processed_count || 0}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Members Detected:</span>
                <span class="summary-value">${detectedMembers.length}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">New Members:</span>
                <span class="summary-value new">${detectedMembers.filter(m => m.is_new).length}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Rank Changes:</span>
                <span class="summary-value change">${detectedMembers.filter(m => m.rank_changed).length}</span>
            </div>
        </div>
    `;
    
    // Detected members list
    const membersContainer = document.getElementById('detected-members');
    
    if (detectedMembers.length === 0) {
        membersContainer.innerHTML = '<p class="empty">No members detected. Please try different screenshots.</p>';
        return;
    }
    
    let html = '<h4>Detected Members:</h4><div class="members-grid">';
    
    detectedMembers.forEach((member) => {
        const statusClass = member.is_new ? 'new' : (member.rank_changed ? 'changed' : 'unchanged');
        const statusText = member.is_new ? 'NEW' : (member.rank_changed ? `${member.old_rank} → ${member.rank}` : 'No Change');
        
        html += `
            <div class="detected-member-card ${statusClass}">
                <div class="member-name">${escapeHtml(member.name)}</div>
                <div class="member-rank rank-${member.rank}">${member.rank}</div>
                <div class="member-status">${statusText}</div>
            </div>
        `;
    });
    
    html += '</div>';
    membersContainer.innerHTML = html;
}

// Confirm and update database
document.getElementById('confirm-btn').addEventListener('click', async () => {
    if (!confirm(`Update ${detectedMembers.length} members in the database?`)) {
        return;
    }
    
    try {
        const response = await fetch(CONFIRM_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ members: detectedMembers })
        });
        
        if (!response.ok) {
            throw new Error('Update failed: ' + response.statusText);
        }
        
        const result = await response.json();
        
        // Show update results
        document.getElementById('results-section').style.display = 'none';
        document.getElementById('update-section').style.display = 'block';
        
        const updateResults = document.getElementById('update-results');
        updateResults.innerHTML = `
            <div class="success-message">
                <h4>✅ Database Updated Successfully!</h4>
                <div class="update-stats">
                    <div class="stat-item">
                        <span class="stat-label">Members Added:</span>
                        <span class="stat-value">${result.added || 0}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Ranks Updated:</span>
                        <span class="stat-value">${result.updated || 0}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">No Changes:</span>
                        <span class="stat-value">${result.unchanged || 0}</span>
                    </div>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Confirm error:', error);
        alert('Error updating database: ' + error.message);
    }
});

// Cancel button
document.getElementById('cancel-btn').addEventListener('click', () => {
    if (confirm('Cancel without updating the database?')) {
        resetUpload();
    }
});

// Upload more button
document.getElementById('upload-more-btn').addEventListener('click', () => {
    resetUpload();
});

// Reset upload form
function resetUpload() {
    selectedFiles = [];
    detectedMembers = [];
    document.getElementById('screenshot-files').value = '';
    document.getElementById('preview-section').style.display = 'none';
    document.getElementById('upload-form').parentElement.style.display = 'block';
    document.getElementById('processing-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'none';
    document.getElementById('update-section').style.display = 'none';
}

// Format file size
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize
(async () => {
    await checkAuth();
})();
