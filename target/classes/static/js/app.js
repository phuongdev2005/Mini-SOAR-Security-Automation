/**
 * Mini-SOAR Frontend Application JavaScript
 * High-Contrast Monochrome Black & White Cyber Theme
 * Authentication Guard & REST API Connections
 */

let currentApiKey = 'SOAR-SECRET-API-KEY-2026';
let currentSessionToken = localStorage.getItem('soar_session_token') || null;
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    checkAuthAndInit();
});

function getHeaders() {
    const headers = {
        'Content-Type': 'application/json',
        'X-SOAR-API-KEY': currentApiKey
    };
    if (currentSessionToken) {
        headers['X-SOAR-SESSION-TOKEN'] = currentSessionToken;
    }
    return headers;
}

async function checkAuthAndInit() {
    if (!currentSessionToken) {
        showLoginView();
        return;
    }

    try {
        const res = await fetch('/api/v1/auth/me', { headers: getHeaders() });
        if (res.ok) {
            currentUser = await res.json();
            updateUserProfileUI();
            showDashboardView();
            refreshDashboard();
            loadSystemConfigs();
            // Auto-refresh metrics every 10 seconds
            setInterval(refreshDashboard, 10000);
        } else {
            // Invalid or expired token
            localStorage.removeItem('soar_session_token');
            currentSessionToken = null;
            showLoginView();
        }
    } catch (e) {
        showLoginView();
    }
}

function showLoginView() {
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    if (loginView) {
        loginView.classList.remove('d-none');
        loginView.classList.add('d-flex');
    }
    if (dashboardView) {
        dashboardView.classList.add('d-none');
    }
}

function showDashboardView() {
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    if (loginView) {
        loginView.classList.add('d-none');
        loginView.classList.remove('d-flex');
    }
    if (dashboardView) {
        dashboardView.classList.remove('d-none');
    }
}

async function handleLoginSubmit(event) {
    event.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    const errorMsg = document.getElementById('login-error-msg');

    if (errorMsg) errorMsg.textContent = '';

    try {
        const res = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (res.ok) {
            const data = await res.json();
            currentSessionToken = data.token;
            localStorage.setItem('soar_session_token', data.token);
            if (data.apiKey) {
                currentApiKey = data.apiKey;
            }
            currentUser = {
                username: data.username,
                fullName: data.fullName,
                role: data.role
            };

            updateUserProfileUI();
            showDashboardView();
            refreshDashboard();
            loadSystemConfigs();
        } else {
            const errData = await res.json();
            if (errorMsg) errorMsg.textContent = errData.error || 'Invalid username or password';
        }
    } catch (e) {
        if (errorMsg) errorMsg.textContent = 'Error connecting to authentication server';
    }
}

async function logout() {
    if (currentSessionToken) {
        try {
            await fetch('/api/v1/auth/logout', {
                method: 'POST',
                headers: getHeaders()
            });
        } catch (e) {}
    }
    localStorage.removeItem('soar_session_token');
    currentSessionToken = null;
    currentUser = null;
    location.reload();
}

function updateUserProfileUI() {
    if (!currentUser) return;
    const usernameEl = document.getElementById('nav-username');
    if (usernameEl) {
        usernameEl.textContent = currentUser.username || 'admin';
    }
}

function switchTab(tabId) {
    const tabBtn = document.getElementById(tabId);
    if (tabBtn) {
        const tab = new bootstrap.Tab(tabBtn);
        tab.show();
    }
}

async function refreshDashboard() {
    await Promise.all([
        loadSummaryMetrics(),
        loadAlerts(),
        loadExecutions(),
        loadBlockedIPs(),
        loadRansomwareIncidents()
    ]);
}

async function loadSummaryMetrics() {
    try {
        const res = await fetch('/api/v1/dashboard/summary', { headers: getHeaders() });
        if (!res.ok) return;
        const data = await res.json();

        const elTotal = document.getElementById('metric-total-alerts');
        const elSsh = document.getElementById('metric-ssh-alerts');
        const elRw = document.getElementById('metric-ransomware-alerts');
        const elBlocked = document.getElementById('metric-blocked-ips');

        if (elTotal) elTotal.textContent = data.totalAlerts || 0;
        if (elSsh) elSsh.textContent = data.sshAlerts || 0;
        if (elRw) elRw.textContent = data.totalRansomwareIncidents || 0;
        if (elBlocked) elBlocked.textContent = data.totalBlockedIps || 0;

        const tabTotal = document.getElementById('tab-alerts-count');
        const tabExec = document.getElementById('tab-executions-count');
        const tabBlocked = document.getElementById('tab-blocked-ips-count');
        const tabRw = document.getElementById('tab-ransomware-count');

        if (tabTotal) tabTotal.textContent = data.totalAlerts || 0;
        if (tabExec) tabExec.textContent = data.totalExecutions || 0;
        if (tabBlocked) tabBlocked.textContent = data.totalBlockedIps || 0;
        if (tabRw) tabRw.textContent = data.totalRansomwareIncidents || 0;

    } catch (e) {
        console.error('Error loading summary metrics:', e);
    }
}

async function loadAlerts() {
    try {
        const res = await fetch('/api/v1/alerts', { headers: getHeaders() });
        if (!res.ok) return;
        const alerts = await res.json();

        const tbody = document.getElementById('alerts-table-body');
        if (!tbody) return;

        if (alerts.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-secondary">No security alerts ingested yet.</td></tr>`;
            return;
        }

        alerts.sort((a, b) => b.id - a.id);

        tbody.innerHTML = alerts.map(alert => `
            <tr>
                <td><strong>#${alert.id}</strong></td>
                <td><span class="badge ${alert.alertType === 'SSH_BRUTEFORCE' ? 'badge-mono' : 'badge-mono-white'}">${alert.alertType}</span></td>
                <td><strong class="text-white"><i class="fa-solid fa-server me-1"></i>${alert.hostname}</strong></td>
                <td><code>${alert.sourceIp || 'N/A'}</code></td>
                <td><span class="badge badge-mono">${alert.status}</span></td>
                <td><small class="text-secondary">${new Date(alert.receivedAt).toLocaleString()}</small></td>
                <td>
                    <button class="btn btn-mono btn-sm" onclick="viewAlertExecutionLogs(${alert.id})">
                        <i class="fa-solid fa-terminal me-1"></i> View Logs
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Error loading security alerts:', e);
    }
}

async function loadExecutions() {
    try {
        const res = await fetch('/api/v1/executions', { headers: getHeaders() });
        if (!res.ok) return;
        const executions = await res.json();

        const tbody = document.getElementById('executions-table-body');
        if (!tbody) return;

        if (executions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-secondary">No playbook executions recorded yet.</td></tr>`;
            return;
        }

        executions.sort((a, b) => b.id - a.id);

        tbody.innerHTML = executions.map(ex => `
            <tr>
                <td><strong>Exec #${ex.id}</strong></td>
                <td>Alert #${ex.alertId}</td>
                <td><code class="text-white">${ex.playbookName}</code></td>
                <td><span class="badge ${ex.status === 'COMPLETED' ? 'badge-mono-white' : 'badge-mono'}">${ex.status}</span></td>
                <td><code>${ex.executionTimeMs || 0} ms</code></td>
                <td><small class="text-secondary">${ex.completedAt ? new Date(ex.completedAt).toLocaleString() : 'Running...'}</small></td>
                <td><span class="small text-light">${ex.resultSummary || 'Execution in progress'}</span></td>
                <td>
                    <button class="btn btn-mono btn-sm" onclick="showLogModal('Execution #${ex.id} Log', \`${escapeHtml(ex.executionLog)}\`)">
                        <i class="fa-solid fa-code me-1"></i> Details
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Error loading playbook executions:', e);
    }
}

async function loadBlockedIPs() {
    try {
        const res = await fetch('/api/v1/actions/blocked-ips', { headers: getHeaders() });
        if (!res.ok) return;
        const ips = await res.json();

        const tbody = document.getElementById('blocked-ips-table-body');
        if (!tbody) return;

        if (ips.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-secondary">No IP addresses currently blocked.</td></tr>`;
            return;
        }

        ips.sort((a, b) => b.id - a.id);

        tbody.innerHTML = ips.map(item => `
            <tr>
                <td><strong>#${item.id}</strong></td>
                <td><strong class="text-white font-monospace"><i class="fa-solid fa-network-wired me-1"></i>${item.ipAddress}</strong></td>
                <td><span class="badge badge-mono">Score: ${item.threatScore}</span></td>
                <td><span class="small text-light">${item.reason}</span></td>
                <td><small class="text-secondary">${new Date(item.blockedAt).toLocaleString()}</small></td>
                <td><span class="badge ${item.isActive ? 'badge-mono-white' : 'badge-mono'}">${item.isActive ? 'ACTIVE_BLOCKED' : 'UNBLOCKED'}</span></td>
                <td>
                    ${item.isActive ? `
                        <button class="btn btn-mono btn-sm" onclick="unblockIp(${item.id}, '${item.ipAddress}')">
                            <i class="fa-solid fa-unlock me-1"></i> Unblock IP
                        </button>
                    ` : `<span class="small text-secondary">Unblocked</span>`}
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Error loading blocked IPs:', e);
    }
}

async function unblockIp(id, ipAddress) {
    if (!confirm(`Are you sure you want to unblock IP address ${ipAddress}?`)) {
        return;
    }

    try {
        const res = await fetch(`/api/v1/actions/blocked-ips/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });

        if (res.ok) {
            const data = await res.json();
            alert(`IP ${ipAddress} unblocked successfully!\n${data.detail || ''}`);
            await refreshDashboard();
        } else {
            alert(`Failed to unblock IP ${ipAddress}.`);
        }
    } catch (e) {
        alert('Error unblocking IP: ' + e.message);
    }
}

async function loadRansomwareIncidents() {
    try {
        const res = await fetch('/api/v1/actions/ransomware-incidents', { headers: getHeaders() });
        if (!res.ok) return;
        const list = await res.json();

        const tbody = document.getElementById('ransomware-incidents-table-body');
        if (!tbody) return;

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-secondary">No ransomware incidents recorded yet.</td></tr>`;
            return;
        }

        list.sort((a, b) => b.id - a.id);

        tbody.innerHTML = list.map(item => `
            <tr>
                <td><strong>Incident #${item.id}</strong></td>
                <td>Alert #${item.alertId}</td>
                <td><strong class="text-white"><i class="fa-solid fa-server me-1"></i>${item.hostname}</strong></td>
                <td><code class="text-white">${item.processName}</code></td>
                <td><span class="badge badge-mono">PID: ${item.pid}</span></td>
                <td><span class="badge badge-mono">${item.affectedFiles} files</span></td>
                <td><span class="badge badge-mono-white"><i class="fa-solid fa-lock me-1"></i>${item.containmentStatus}</span></td>
                <td><small class="text-secondary">${new Date(item.incidentTime).toLocaleString()}</small></td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Error loading ransomware incidents:', e);
    }
}

async function loadSystemConfigs() {
    try {
        const res = await fetch('/api/v1/configs', { headers: getHeaders() });
        if (!res.ok) return;
        const configs = await res.json();

        configs.forEach(cfg => {
            const el = document.getElementById(`cfg_${cfg.configKey}`);
            if (el) {
                el.value = cfg.configValue || '';
            }
            if (cfg.configKey === 'SOAR_API_KEY' && cfg.configValue) {
                currentApiKey = cfg.configValue;
            }
        });
    } catch (e) {
        console.error('Error loading system configs:', e);
    }
}

async function saveSystemConfigs(event) {
    if (event) event.preventDefault();

    const keys = [
        'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID',
        'SOAR_EXECUTION_MODE', 'SOAR_API_KEY',
        'REMOTE_VPS_HOST', 'REMOTE_VPS_USER', 'REMOTE_VPS_SSH_KEY'
    ];

    const payload = {};
    keys.forEach(k => {
        const el = document.getElementById(`cfg_${k}`);
        if (el) {
            payload[k] = el.value.trim();
        }
    });

    const statusMsg = document.getElementById('config-status-msg');
    if (statusMsg) {
        statusMsg.className = 'fw-bold text-white';
        statusMsg.textContent = 'Saving configurations to MySQL Database...';
    }

    try {
        const res = await fetch('/api/v1/configs', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            if (payload['SOAR_API_KEY']) {
                currentApiKey = payload['SOAR_API_KEY'];
            }
            if (statusMsg) {
                statusMsg.className = 'fw-bold text-white';
                statusMsg.innerHTML = '<i class="fa-solid fa-check-circle me-1"></i> System configurations saved successfully to MySQL DB!';
                setTimeout(() => { statusMsg.textContent = ''; }, 4000);
            }
            await refreshDashboard();
        } else {
            if (statusMsg) {
                statusMsg.className = 'fw-bold text-secondary';
                statusMsg.textContent = 'Failed to save system configurations.';
            }
        }
    } catch (e) {
        if (statusMsg) {
            statusMsg.className = 'fw-bold text-secondary';
            statusMsg.textContent = 'Error saving configurations: ' + e.message;
        }
    }
}



async function viewAlertExecutionLogs(alertId) {
    try {
        const res = await fetch(`/api/v1/executions/alert/${alertId}`, { headers: getHeaders() });
        if (res.ok) {
            const execution = await res.json();
            showLogModal(`Alert #${alertId} - Playbook Log`, execution.executionLog);
        } else {
            alert(`No execution log found for Alert #${alertId}.`);
        }
    } catch (e) {
        alert('Error fetching execution log: ' + e.message);
    }
}

function showLogModal(title, content) {
    const titleEl = document.getElementById('logModalTitle');
    const contentEl = document.getElementById('logContent');
    const modalEl = document.getElementById('logModal');

    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-terminal me-2"></i> ${title}`;
    if (contentEl) contentEl.textContent = content || 'No log details available.';

    if (modalEl) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
