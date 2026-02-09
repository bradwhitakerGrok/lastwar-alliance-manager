const API_BASE = '/api';
const SETTINGS_URL = `${API_BASE}/settings`;

let isR5OrAdmin = false;

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
        isR5OrAdmin = data.is_r5_or_admin || false;
        
        // Disable form if not R5 or admin
        if (!isR5OrAdmin) {
            const form = document.getElementById('settings-form');
            const inputs = form.querySelectorAll('input, textarea, button[type="submit"]');
            inputs.forEach(input => input.disabled = true);
            
            const notice = document.createElement('div');
            notice.className = 'permission-notice';
            notice.style.cssText = 'background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 20px;';
            notice.innerHTML = '<p>ℹ️ Only R5 members and admins can modify settings.</p>';
            form.parentNode.insertBefore(notice, form);
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

// Load settings
async function loadSettings() {
    try {
        const response = await fetch(SETTINGS_URL);
        if (!response.ok) throw new Error('Failed to load settings');
        
        const settings = await response.json();
        
        document.getElementById('award-first').value = settings.award_first_points;
        document.getElementById('award-second').value = settings.award_second_points;
        document.getElementById('award-third').value = settings.award_third_points;
        document.getElementById('recent-conductor-days').value = settings.recent_conductor_penalty_days;
        document.getElementById('above-average-penalty').value = settings.above_average_conductor_penalty;
        document.getElementById('r4r5-rank-boost').value = settings.r4r5_rank_boost;
        document.getElementById('first-time-boost').value = settings.first_time_conductor_boost || 5;
        document.getElementById('schedule-message-template').value = settings.schedule_message_template || 'Train Schedule - Week {WEEK}\n\n{SCHEDULES}\n\nNext in line:\n{NEXT_3}';
        document.getElementById('daily-message-template').value = settings.daily_message_template || 'ALL ABOARD! Daily Train Assignment\n\nDate: {DATE}\n\nToday\'s Conductor: {CONDUCTOR_NAME} ({CONDUCTOR_RANK})\nBackup Engineer: {BACKUP_NAME} ({BACKUP_RANK})\n\nDEPARTURE SCHEDULE:\n- 15:00 ST (17:00 UK) - Conductor {CONDUCTOR_NAME}, please request train assignment in alliance chat\n- 16:30 ST (18:30 UK) - If conductor hasn\'t shown up, Backup {BACKUP_NAME} takes over and assigns train to themselves\n\nRemember: Communication is key! Let the alliance know if you can\'t make it.\n\nAll aboard for another successful run!';
        
        // Power tracking
        const powerTrackingEnabled = settings.power_tracking_enabled || false;
        document.getElementById('power-tracking-enabled').checked = powerTrackingEnabled;
        togglePowerUploadSection(powerTrackingEnabled);
    } catch (error) {
        console.error('Error loading settings:', error);
        alert('Failed to load settings');
    }
}

// Save settings
document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!isR5OrAdmin) {
        alert('You do not have permission to modify settings. Only R5 members and admins can do this.');
        return;
    }
    
    const settings = {
        award_first_points: parseInt(document.getElementById('award-first').value),
        award_second_points: parseInt(document.getElementById('award-second').value),
        award_third_points: parseInt(document.getElementById('award-third').value),
        recent_conductor_penalty_days: parseInt(document.getElementById('recent-conductor-days').value),
        above_average_conductor_penalty: parseInt(document.getElementById('above-average-penalty').value),
        r4r5_rank_boost: parseInt(document.getElementById('r4r5-rank-boost').value),
        first_time_conductor_boost: parseInt(document.getElementById('first-time-boost').value),
        schedule_message_template: document.getElementById('schedule-message-template').value,
        daily_message_template: document.getElementById('daily-message-template').value,
        power_tracking_enabled: document.getElementById('power-tracking-enabled').checked
    };
    
    try {
        const response = await fetch(SETTINGS_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(error);
        }
        
        alert('✅ Settings saved successfully!');
    } catch (error) {
        console.error('Error saving settings:', error);
        alert('❌ Failed to save settings: ' + error.message);
    }
});

// Reset to defaults
document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('Reset all settings to default values?')) {
        document.getElementById('award-first').value = 3;
        document.getElementById('award-second').value = 2;
        document.getElementById('award-third').value = 1;
        document.getElementById('recommendation-points').value = 10;
        document.getElementById('recent-conductor-days').value = 30;
        document.getElementById('above-average-penalty').value = 10;
        document.getElementById('r4r5-rank-boost').value = 5;
        document.getElementById('first-time-boost').value = 5;
        document.getElementById('schedule-message-template').value = 'Train Schedule - Week {WEEK}\n\n{SCHEDULES}\n\nNext in line:\n{NEXT_3}';
        document.getElementById('daily-message-template').value = 'ALL ABOARD! Daily Train Assignment\n\nDate: {DATE}\n\nToday\'s Conductor: {CONDUCTOR_NAME} ({CONDUCTOR_RANK})\nBackup Engineer: {BACKUP_NAME} ({BACKUP_RANK})\n\nDEPARTURE SCHEDULE:\n- 15:00 ST (17:00 UK) - Conductor {CONDUCTOR_NAME}, please request train assignment in alliance chat\n- 16:30 ST (18:30 UK) - If conductor hasn\'t shown up, Backup {BACKUP_NAME} takes over and assigns train to themselves\n\nRemember: Communication is key! Let the alliance know if you can\'t make it.\n\nAll aboard for another successful run!';
        document.getElementById('power-tracking-enabled').checked = false;
    }
});

// Power tracking toggle
function togglePowerUploadSection(enabled) {
    const uploadSection = document.getElementById('power-upload-section');
    if (uploadSection) {
        uploadSection.style.display = enabled ? 'block' : 'none';
    }
}

document.getElementById('power-tracking-enabled').addEventListener('change', (e) => {
    togglePowerUploadSection(e.target.checked);
});

// Process power data
document.getElementById('process-power-btn').addEventListener('click', async () => {
    const dataInput = document.getElementById('power-data-input').value.trim();
    const resultDiv = document.getElementById('power-upload-result');
    
    if (!dataInput) {
        alert('Please paste power data first');
        return;
    }
    
    // Parse the input data
    const lines = dataInput.split('\n').filter(line => line.trim());
    const records = [];
    const errors = [];
    
    lines.forEach((line, index) => {
        const parts = line.split(',').map(p => p.trim());
        if (parts.length !== 2) {
            errors.push(`Line ${index + 1}: Invalid format (expected: Name, Power)`);
            return;
        }
        
        const [name, powerStr] = parts;
        const power = parseInt(powerStr.replace(/,/g, ''));
        
        if (isNaN(power)) {
            errors.push(`Line ${index + 1}: Invalid power value "${powerStr}"`);
            return;
        }
        
        records.push({ member_name: name, power: power });
    });
    
    if (errors.length > 0) {
        resultDiv.innerHTML = `<div style="background: #f8d7da; color: #721c24; padding: 10px; border-radius: 5px;">
            <strong>Parsing errors:</strong><br>
            ${errors.join('<br>')}
        </div>`;
        resultDiv.style.display = 'block';
        return;
    }
    
    if (records.length === 0) {
        alert('No valid records to upload');
        return;
    }
    
    try {
        resultDiv.innerHTML = `<div style="background: #d1ecf1; color: #0c5460; padding: 10px; border-radius: 5px;">
            Uploading ${records.length} records...
        </div>`;
        resultDiv.style.display = 'block';
        
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
        
        let html = `<div style="background: #d4edda; color: #155724; padding: 10px; border-radius: 5px;">
            <strong>✅ ${result.message}</strong><br>
            Successful: ${result.success_count}, Failed: ${result.failed_count}
        `;
        
        if (result.errors && result.errors.length > 0) {
            html += `<br><br><strong>Errors:</strong><br>${result.errors.join('<br>')}`;
        }
        
        html += '</div>';
        resultDiv.innerHTML = html;
        
        // Clear input on success
        if (result.success_count > 0) {
            document.getElementById('power-data-input').value = '';
        }
    } catch (error) {
        console.error('Error uploading power data:', error);
        resultDiv.innerHTML = `<div style="background: #f8d7da; color: #721c24; padding: 10px; border-radius: 5px;">
            <strong>❌ Upload failed:</strong> ${error.message}
        </div>`;
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const auth = await checkAuth();
    if (auth) {
        await loadSettings();
    }
});
