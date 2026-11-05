const loginScreen = document.getElementById('login-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const loginForm = document.getElementById('login-form');
const passwordInput = document.getElementById('password-input');
const loginError = document.getElementById('login-error');
const addUserForm = document.getElementById('add-user-form');
const newUserId = document.getElementById('new-user-id');
const newUserName = document.getElementById('new-user-name');
const usersTableBody = document.getElementById('users-table-body');
const dashboardMessage = document.getElementById('dashboard-message');
const refreshBtn = document.getElementById('refresh-btn');
const resetDeviceBtn = document.getElementById('reset-device-btn');
const logoutBtn = document.getElementById('logout-btn');
const tabLive = document.getElementById('tab-live');
const tabHistory = document.getElementById('tab-history');
const liveStatusSection = document.getElementById('live-status-section');
const historySection = document.getElementById('history-section');
const historyTableBody = document.getElementById('history-table-body');

function getToken() {
  return localStorage.getItem('admin_token');
}

function setToken(token) {
  localStorage.setItem('admin_token', token);
}

function clearToken() {
  localStorage.removeItem('admin_token');
}

function showLogin() {
  loginScreen.classList.remove('hidden');
  dashboardScreen.classList.add('hidden');
}

function showDashboard() {
  loginScreen.classList.add('hidden');
  dashboardScreen.classList.remove('hidden');
}

function showDashboardMessage(text, type) {
  dashboardMessage.textContent = text;
  dashboardMessage.className = `message ${type}`;
  dashboardMessage.classList.remove('hidden');
}

async function authedFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${getToken()}`,
    },
  });

  if (res.status === 401) {
    clearToken();
    showLogin();
    throw new Error('Session expired. Please log in again.');
  }

  return res;
}

function formatTime(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const STATUS_LABELS = {
  active: 'Active',
  clocked_out: 'Clocked Out',
  never_clocked_in: 'Never Clocked In',
};

async function loadUsers() {
  try {
    const res = await authedFetch('/api/clock/summary');
    const data = await res.json();

    usersTableBody.innerHTML = '';

    data.forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.user_id}</td>
        <td>${row.name}</td>
        <td class="status-${row.status}">${STATUS_LABELS[row.status]}</td>
        <td>${formatTime(row.clock_in_time)}</td>
        <td>${formatTime(row.clock_out_time)}</td>
        <td>${row.date || '—'}</td>
        <td><button class="remove-btn" data-id="${row.user_id}">Remove</button></td>
      `;
      usersTableBody.appendChild(tr);
    });
  } catch (err) {
    // authedFetch already handled 401 redirect to login
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.classList.add('hidden');

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput.value }),
    });

    const data = await res.json();

    if (!res.ok) {
      loginError.textContent = data.error || 'Login failed';
      loginError.classList.remove('hidden');
      return;
    }

    setToken(data.token);
    passwordInput.value = '';
    showDashboard();
    refreshAll();
  } catch (err) {
    loginError.textContent = 'Cannot reach the server.';
    loginError.classList.remove('hidden');
  }
});

addUserForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  try {
    const res = await authedFetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: newUserId.value.trim(), name: newUserName.value.trim() }),
    });

    const data = await res.json();

    if (!res.ok) {
      showDashboardMessage(data.error || 'Could not add user', 'error');
      return;
    }

    newUserId.value = '';
    newUserName.value = '';
    showDashboardMessage(`Added ${data.name}`, 'success');
    refreshAll();
  } catch (err) {
    // handled by authedFetch
  }
});

usersTableBody.addEventListener('click', async (e) => {
  if (!e.target.classList.contains('remove-btn')) return;

  const id = e.target.dataset.id;
  if (!confirm(`Remove user ${id}?`)) return;

  try {
    const res = await authedFetch(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) {
      showDashboardMessage(data.error || 'Could not remove user', 'error');
      return;
    }

    showDashboardMessage(`Removed ${id}`, 'success');
    refreshAll();
  } catch (err) {
    // handled by authedFetch
  }
});

async function loadHistory() {
  try {
    const res = await authedFetch('/api/clock/history');
    const data = await res.json();

    historyTableBody.innerHTML = '';

    data.forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.user_id}</td>
        <td>${row.name}</td>
        <td>${row.date || '—'}</td>
        <td>${formatTime(row.clock_in_time)}</td>
        <td>${formatTime(row.clock_out_time)}</td>
      `;
      historyTableBody.appendChild(tr);
    });
  } catch (err) {
    // authedFetch already handled 401 redirect to login
  }
}

function refreshAll() {
  loadUsers();
  loadHistory();
}

tabLive.addEventListener('click', () => {
  tabLive.classList.add('active');
  tabHistory.classList.remove('active');
  liveStatusSection.classList.remove('hidden');
  historySection.classList.add('hidden');
});

tabHistory.addEventListener('click', () => {
  tabHistory.classList.add('active');
  tabLive.classList.remove('active');
  historySection.classList.remove('hidden');
  liveStatusSection.classList.add('hidden');
});

refreshBtn.addEventListener('click', refreshAll);

resetDeviceBtn.addEventListener('click', async () => {
  if (!confirm('Reset the authorized clock-in device? The current kiosk will need to re-register.')) return;

  try {
    const res = await authedFetch('/api/device/reset', { method: 'POST' });
    if (res.ok) {
      showDashboardMessage('Device reset. The next device to open the clock page will be authorized.', 'success');
    }
  } catch (err) {
    // handled by authedFetch
  }
});

logoutBtn.addEventListener('click', () => {
  clearToken();
  showLogin();
});

if (getToken()) {
  showDashboard();
  refreshAll();
} else {
  showLogin();
}
