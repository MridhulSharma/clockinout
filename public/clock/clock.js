const form = document.getElementById('clock-form');
const input = document.getElementById('user-id-input');
const messageEl = document.getElementById('message');
const blockedBanner = document.getElementById('blocked-banner');

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function blockDevice() {
  blockedBanner.classList.remove('hidden');
  form.classList.add('hidden');
}

function generateDeviceId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

async function ensureDeviceRegistered() {
  let token = localStorage.getItem('device_token');
  if (!token) {
    token = generateDeviceId();
    localStorage.setItem('device_token', token);
  }

  try {
    const res = await fetch('/api/device/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_token: token }),
    });

    if (!res.ok) {
      blockDevice();
    }
  } catch (err) {
    showMessage('Cannot reach the server. Check your connection.', 'error');
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const userId = input.value.trim();
  if (!userId) return;

  const deviceToken = localStorage.getItem('device_token');

  try {
    const res = await fetch('/api/clock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, device_token: deviceToken }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 403) {
        blockDevice();
      } else if (res.status === 404) {
        showMessage(`Unknown ID "${userId}". Please try again.`, 'error');
      } else {
        showMessage(data.error || 'Something went wrong.', 'error');
      }
      return;
    }

    if (data.action === 'clocked_in') {
      showMessage(`Welcome, ${data.name} — clocked in at ${formatTime(data.time)}`, 'success');
    } else {
      showMessage(`Goodbye, ${data.name} — clocked out at ${formatTime(data.time)}`, 'success');
    }
  } catch (err) {
    showMessage('Cannot reach the server. Check your connection.', 'error');
  } finally {
    input.value = '';
    input.focus();
  }
});

ensureDeviceRegistered();
input.focus();
