const API_BASE = '/api';

let selectedFiles = []; // Array to hold multiple files
const MAX_FILES = 25;

// Check authentication
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/check-auth`);
        const data = await response.json();
        
        if (!data.authenticated) {
            window.location.href = '/login.html';
            return false;
        }
        
        document.getElementById('username-display').textContent = `👤 ${data.username}`;
        return data;
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login.html';
        return false;
    }
}

// Setup event listeners after auth check
async function setupEventListeners(authData) {
    const usernameDisplay = document.getElementById('username-display');
    const logoutBtn = document.getElementById('dropdown-logout-btn');
    const adminLink = document.getElementById('admin-dropdown-link');
    
    if (usernameDisplay) {
        usernameDisplay.addEventListener('click', toggleUserDropdown);
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Show admin link if user is admin
    if (authData && authData.is_admin && adminLink) {
        adminLink.style.display = 'block';
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
    try {
        await fetch(`${API_BASE}/logout`, { method: 'POST' });
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        
        // Update buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`tab-${tabName}`).classList.add('active');
        
        // Clear results
        document.getElementById('result-container').innerHTML = '';
    });
});

// Image upload handling
const imageInput = document.getElementById('image-input');
const dropZone = document.getElementById('drop-zone');
const dropContent = document.getElementById('drop-content');
const previewContainer = document.getElementById('preview-container');
const previewGallery = document.getElementById('preview-gallery');
const filesCount = document.getElementById('files-count');
const processImageBtn = document.getElementById('process-image-btn');
const clearBtn = document.getElementById('clear-btn');

// Click to upload
dropZone.addEventListener('click', (e) => {
    if (e.target === clearBtn || clearBtn.contains(e.target)) {
        return; // Don't trigger file input if clicking clear button
    }
    if (selectedFiles.length === 0) {
        imageInput.click();
    }
});

// File selection
imageInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        handleFiles(files);
    }
});

// Drag and drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
        handleFiles(files);
    }
});

function handleFiles(files) {
    // Filter image files only
    let imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
        showResult('Please upload image files (PNG, JPG, JPEG)', 'error');
        return;
    }
    
    // Check file size
    const oversizedFiles = imageFiles.filter(file => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
        showResult(`${oversizedFiles.length} file(s) exceed 10MB limit and will be skipped`, 'error');
        imageFiles = imageFiles.filter(file => file.size <= 10 * 1024 * 1024);
    }
    
    // Check total count
    if (selectedFiles.length + imageFiles.length > MAX_FILES) {
        showResult(`Maximum ${MAX_FILES} files allowed. Only adding first ${MAX_FILES - selectedFiles.length} files.`, 'error');
        imageFiles = imageFiles.slice(0, MAX_FILES - selectedFiles.length);
    }
    
    // Add to selected files
    imageFiles.forEach(file => {
        selectedFiles.push(file);
    });
    
    updatePreview();
    
    // Clear any previous results
    document.getElementById('result-container').innerHTML = '';
}

function updatePreview() {
    if (selectedFiles.length === 0) {
        previewContainer.style.display = 'none';
        dropContent.style.display = 'block';
        processImageBtn.style.display = 'none';
        return;
    }
    
    filesCount.textContent = `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected`;
    previewGallery.innerHTML = '';
    
    selectedFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            previewItem.innerHTML = `
                <button class="remove-file" data-index="${index}" title="Remove">×</button>
                <img src="${e.target.result}" class="preview-img" alt="${file.name}">
                <div class="file-name" title="${file.name}">${file.name}</div>
            `;
            
            // Add remove handler
            previewItem.querySelector('.remove-file').addEventListener('click', (evt) => {
                evt.stopPropagation();
                removeFile(index);
            });
            
            previewGallery.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
    });
    
    dropContent.style.display = 'none';
    previewContainer.style.display = 'block';
    processImageBtn.style.display = 'block';
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updatePreview();
}

// Clear all images
clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedFiles = [];
    imageInput.value = '';
    updatePreview();
    document.getElementById('result-container').innerHTML = '';
});

// Process image with OCR
processImageBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) {
        showResult('Please select at least one image', 'error');
        return;
    }
    
    // Get selected screenshot type
    const screenshotType = document.getElementById('screenshot-type').value;
    
    const originalText = processImageBtn.innerHTML;
    processImageBtn.innerHTML = '<span class="loading"></span> Processing...';
    processImageBtn.disabled = true;
    
    try {
        const typeLabel = screenshotType === 'power' ? 'Power Rankings' : 'VS Points';
        showResult(`🔍 Processing ${selectedFiles.length} ${typeLabel} screenshot${selectedFiles.length > 1 ? 's' : ''} with OCR...`, 'info');
        
        let totalSuccess = 0;
        let totalFailed = 0;
        const allErrors = [];
        const detectedDays = []; // For VS points
        
        // Determine API endpoint based on screenshot type
        const apiEndpoint = screenshotType === 'power' 
            ? `${API_BASE}/power-history/process-screenshot`
            : `${API_BASE}/vs-points/process-screenshot`;
        
        // Process files sequentially to avoid overwhelming the server
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            
            showResult(`🔍 Processing ${typeLabel} screenshot ${i + 1} of ${selectedFiles.length}: ${file.name}...`, 'info');
            
            try {
                const formData = new FormData();
                formData.append('image', file);
                
                // Add week parameter for VS Points
                if (screenshotType === 'vs-points') {
                    const week = document.getElementById('vs-week').value;
                    formData.append('week', week);
                }
                
                const response = await fetch(apiEndpoint, {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(error);
                }
                
                const result = await response.json();
                totalSuccess += result.success_count || 0;
                
                // Track detected day for VS points
                if (screenshotType === 'vs-points' && result.day) {
                    detectedDays.push(`${file.name} → ${result.day}`);
                }
                
                if (result.errors && result.errors.length > 0) {
                    allErrors.push(`<strong>${file.name}:</strong> ${result.errors.join(', ')}`);
                    totalFailed++;
                } else if (result.not_found_members && result.not_found_members.length > 0) {
                    allErrors.push(`<strong>${file.name}:</strong> ${result.not_found_members.length} members not found in database`);
                }
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
                allErrors.push(`<strong>${file.name}:</strong> ${error.message}`);
                totalFailed++;
            }
        }
        
        // Show final results
        let html = `<div class="result-box result-success">
            <strong>✅ Processed ${selectedFiles.length} ${typeLabel} screenshot${selectedFiles.length > 1 ? 's' : ''}</strong><br>
            <div style="margin-top: 10px;">
                <strong>Total Records Updated:</strong> ${totalSuccess}`;
                
        if (totalFailed > 0) {
            html += ` | <strong>Failed:</strong> ${totalFailed}`;
        }
        
        html += `</div>`;
        
        // Show detected days for VS points
        if (screenshotType === 'vs-points' && detectedDays.length > 0) {
            html += `<br><br><strong>Detected Days:</strong><br><div style="max-height: 150px; overflow-y: auto; margin-top: 5px; font-size: 13px;">${detectedDays.join('<br>')}</div>`;
        }
        
        if (allErrors.length > 0) {
            html += `<br><br><strong>Issues:</strong><br><div style="max-height: 200px; overflow-y: auto; margin-top: 5px;">${allErrors.join('<br>')}</div>`;
        }
        
        html += '</div>';
        document.getElementById('result-container').innerHTML = html;
        
        // Clear on success after delay
        if (totalSuccess > 0) {
            setTimeout(() => {
                selectedFiles = [];
                imageInput.value = '';
                updatePreview();
            }, 5000);
        }
    } catch (error) {
        console.error('Error processing images:', error);
        showResult(`❌ Processing failed: ${error.message}`, 'error');
    } finally {
        processImageBtn.innerHTML = originalText;
        processImageBtn.disabled = false;
    }
});

// Process manual text entry
document.getElementById('process-text-btn').addEventListener('click', async () => {
    const textInput = document.getElementById('text-input');
    const text = textInput.value.trim();
    
    if (!text) {
        showResult('Please enter some data', 'error');
        return;
    }
    
    const btn = document.getElementById('process-text-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="loading"></span> Uploading...';
    btn.disabled = true;
    
    try {
        showResult('📤 Processing text data...', 'info');
        
        // Parse the text input
        const lines = text.split('\n');
        const records = [];
        const errors = [];
        
        lines.forEach((line, index) => {
            line = line.trim();
            if (!line) return;
            
            // Try to parse: Name, Power or Name Power
            const parts = line.split(/[,\s]+/);
            if (parts.length < 2) {
                errors.push(`Line ${index + 1}: Invalid format - need Name, Power`);
                return;
            }
            
            const name = parts.slice(0, -1).join(' ').trim();
            const powerStr = parts[parts.length - 1].replace(/,/g, '');
            const power = parseInt(powerStr, 10);
            
            if (!name || isNaN(power) || power < 1000000) {
                errors.push(`Line ${index + 1}: Invalid data - "${line}"`);
                return;
            }
            
            records.push({ member_name: name, power: power });
        });
        
        if (errors.length > 0) {
            showResult(`<strong>Parsing errors:</strong><br>${errors.join('<br>')}`, 'error');
            return;
        }
        
        if (records.length === 0) {
            showResult('No valid records to upload', 'error');
            return;
        }
        
        const response = await fetch(`${API_BASE}/power-history/process-screenshot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ records: records })
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }
        
        const result = await response.json();
        
        let html = `<div class="result-box result-success">
            <strong>✅ ${result.message}</strong><br>
            <div style="margin-top: 10px;">
                <strong>Successful:</strong> ${result.success_count} | 
                <strong>Failed:</strong> ${result.failed_count}
            </div>`;
        
        if (result.errors && result.errors.length > 0) {
            html += `<br><br><strong>Errors:</strong><br><div style="max-height: 200px; overflow-y: auto; margin-top: 5px;">${result.errors.join('<br>')}</div>`;
        }
        
        html += '</div>';
        document.getElementById('result-container').innerHTML = html;
        
        // Clear on success after delay
        if (result.success_count > 0) {
            setTimeout(() => {
                textInput.value = '';
            }, 2000);
        }
    } catch (error) {
        console.error('Error uploading data:', error);
        showResult(`❌ Upload failed: ${error.message}`, 'error');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

function showResult(message, type) {
    const resultClass = type === 'error' ? 'result-error' : 
                       type === 'info' ? 'result-info' : 'result-success';
    document.getElementById('result-container').innerHTML = 
        `<div class="result-box ${resultClass}">${message}</div>`;
}

// Screenshot type selector handler
function updateScreenshotTypeHint() {
    const screenshotType = document.getElementById('screenshot-type').value;
    const hintElement = document.getElementById('screenshot-type-hint');
    const weekSelector = document.getElementById('week-selector');
    
    if (screenshotType === 'power') {
        hintElement.textContent = 'Upload power ranking screenshots from the alliance member list.';
        if (weekSelector) weekSelector.style.display = 'none';
    } else if (screenshotType === 'vs-points') {
        hintElement.innerHTML = '<strong>⚔️ VS Points Instructions:</strong> Make sure to screenshot the "Daily Rank" tab. The system will automatically detect which day (Mon-Sat) is selected from the screenshot.';
        if (weekSelector) weekSelector.style.display = 'block';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const auth = await checkAuth();
    if (!auth) return;
    
    await setupEventListeners(auth);
    
    // Setup screenshot type selector
    const screenshotTypeSelector = document.getElementById('screenshot-type');
    if (screenshotTypeSelector) {
        screenshotTypeSelector.addEventListener('change', updateScreenshotTypeHint);
        updateScreenshotTypeHint(); // Set initial hint
    }
    
    // Check if power tracking is enabled
    try {
        const response = await fetch(`${API_BASE}/settings`);
        if (response.ok) {
            const settings = await response.json();
            if (!settings.power_tracking_enabled) {
                showResult('⚠️ Power tracking is not enabled. Some features may be limited. Please enable it in Settings.', 'info');
            }
        }
    } catch (error) {
        console.error('Failed to check power tracking status:', error);
    }
});
