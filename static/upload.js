const API_BASE = '/api';

let selectedFile = null;

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
const previewImg = document.getElementById('preview-img');
const previewFilename = document.getElementById('preview-filename');
const processImageBtn = document.getElementById('process-image-btn');
const clearBtn = document.getElementById('clear-btn');

// Click to upload
dropZone.addEventListener('click', (e) => {
    if (e.target === clearBtn || clearBtn.contains(e.target)) {
        return; // Don't trigger file input if clicking clear button
    }
    if (!selectedFile) {
        imageInput.click();
    }
});

// File selection
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
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
    
    const file = e.dataTransfer.files[0];
    if (file) {
        handleFile(file);
    }
});

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        showResult('Please upload an image file (PNG, JPG, JPEG)', 'error');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        showResult('File size must be less than 10MB', 'error');
        return;
    }
    
    selectedFile = file;
    
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        previewFilename.textContent = file.name;
        dropContent.style.display = 'none';
        previewContainer.style.display = 'block';
        processImageBtn.style.display = 'block';
    };
    reader.readAsDataURL(file);
    
    // Clear any previous results
    document.getElementById('result-container').innerHTML = '';
}

// Clear image
clearBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedFile = null;
    imageInput.value = '';
    previewContainer.style.display = 'none';
    dropContent.style.display = 'block';
    processImageBtn.style.display = 'none';
    document.getElementById('result-container').innerHTML = '';
});

// Process image with OCR
processImageBtn.addEventListener('click', async () => {
    if (!selectedFile) {
        showResult('Please select an image first', 'error');
        return;
    }
    
    const originalText = processImageBtn.innerHTML;
    processImageBtn.innerHTML = '<span class="loading"></span> Processing...';
    processImageBtn.disabled = true;
    
    try {
        showResult('🔍 Processing image with OCR...', 'info');
        
        const formData = new FormData();
        formData.append('image', selectedFile);
        
        const response = await fetch(`${API_BASE}/power-history/process-screenshot`, {
            method: 'POST',
            body: formData
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
                clearBtn.click();
            }, 2000);
        }
    } catch (error) {
        console.error('Error processing image:', error);
        showResult(`❌ OCR failed: ${error.message}`, 'error');
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

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const auth = await checkAuth();
    if (!auth) return;
    
    // Check if power tracking is enabled
    try {
        const response = await fetch(`${API_BASE}/settings`);
        if (response.ok) {
            const settings = await response.json();
            if (!settings.power_tracking_enabled) {
                showResult('⚠️ Power tracking is not enabled. Please enable it in Settings first.', 'error');
                document.querySelectorAll('.btn').forEach(btn => btn.disabled = true);
                dropZone.style.pointerEvents = 'none';
                dropZone.style.opacity = '0.5';
            }
        }
    } catch (error) {
        console.error('Failed to check power tracking status:', error);
    }
});
