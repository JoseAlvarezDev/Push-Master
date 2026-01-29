/* global CONFIG, PusherPushNotifications */
// Initialize Pusher Beams Client
let beamsClient = null;

async function initBeams() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/config`);
        const config = await response.json();

        if (!config.instanceId) {
            console.warn('Pusher Instance ID not configured');
            return;
        }

        beamsClient = new PusherPushNotifications.Client({
            instanceId: config.instanceId,
        });

        await beamsClient.start();
        await beamsClient.addDeviceInterest('hello');
        console.log('Successfully registered and subscribed to "hello"!');
    } catch (error) {
        console.error('Error al inicializar Pusher Beams:', error);
    } finally {
        // Even if they already saw the splash this session, show it briefly (600ms)
        // instead of almost skipping it (100ms) to avoid flickers and show brand.
        const hasSeenSplash = sessionStorage.getItem('splashShown');
        const delay = hasSeenSplash ? 600 : 1500;

        setTimeout(hideSplashScreen, delay);

        if (!hasSeenSplash) {
            sessionStorage.setItem('splashShown', 'true');
        }
    }
}

function hideSplashScreen() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        // Always use fade-out for a smoother experience
        splash.classList.add('fade-out');
        setTimeout(() => (splash.style.display = 'none'), 800);
    }
}

// HTML sanitization to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Form validation
function validateForm() {
    const interest = document.getElementById('interest').value.trim();
    const title = document.getElementById('title').value.trim();
    const body = document.getElementById('body').value.trim();

    const errors = [];

    // Validate interest
    if (!interest) {
        errors.push('El interés es obligatorio');
    } else if (!/^[a-z0-9-]+$/.test(interest)) {
        errors.push('El interés solo puede contener letras minúsculas, números y guiones');
    }

    // Validate title
    if (!title) {
        errors.push('El título es obligatorio');
    } else if (title.length > 100) {
        errors.push('El título no puede exceder 100 caracteres');
    }

    // Validate body
    if (!body) {
        errors.push('El mensaje es obligatorio');
    } else if (body.length > 500) {
        errors.push('El mensaje no puede exceder 500 caracteres');
    }

    return errors;
}

// Character counter update
function updateCharCounter(inputId, counterId, maxLength) {
    const input = document.getElementById(inputId);
    const counter = document.getElementById(counterId);
    const length = input.value.length;
    counter.textContent = `${length}/${maxLength}`;

    if (length > maxLength) {
        counter.style.color = '#f87171';
    } else if (length > maxLength * 0.9) {
        counter.style.color = '#fbbf24';
    } else {
        counter.style.color = 'var(--text-dim)';
    }
}

initBeams();
loadHistory();

// Emoji Logic
document.querySelectorAll('.emoji-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        const emoji = btn.getAttribute('data-emoji');
        const bodyInput = document.getElementById('body');
        const start = bodyInput.selectionStart;
        const end = bodyInput.selectionEnd;
        const text = bodyInput.value;
        bodyInput.value = text.slice(0, start) + emoji + text.slice(end);
        bodyInput.focus();
        bodyInput.selectionStart = bodyInput.selectionEnd = start + emoji.length;

        // Update character counter
        updateCharCounter('body', 'body-counter', 500);
    });
});

// Character counters
const titleInput = document.getElementById('title');
if (titleInput) {
    titleInput.addEventListener('input', () => {
        updateCharCounter('title', 'title-counter', 100);
    });
}

const bodyInput = document.getElementById('body');
if (bodyInput) {
    bodyInput.addEventListener('input', () => {
        updateCharCounter('body', 'body-counter', 500);
    });
}

const interestInput = document.getElementById('interest');
if (interestInput) {
    interestInput.addEventListener('input', () => {
        const interest = document.getElementById('interest');
        const value = interest.value;
        // Auto-convert to lowercase and remove invalid characters
        interest.value = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    });
}

// History Logic
async function loadHistory() {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/history`);
        const history = await response.json();
        renderHistory(history);

        // Setup refresh button listener if present
        const refreshBtn = document.getElementById('refresh-history-btn');
        if (refreshBtn && !refreshBtn.dataset.listener) {
            refreshBtn.onclick = () => loadHistory();
            refreshBtn.dataset.listener = 'true';
        }
    } catch (error) {
        console.error('Error cargando historial:', error);
    }
}

function renderHistory(history) {
    const list = document.getElementById('history-list');
    if (!list) return;

    if (history.length === 0) {
        list.innerHTML = '<p class="empty-msg">No hay mensajes recientes</p>';
        return;
    }

    // Sanitize all user content to prevent XSS
    list.innerHTML = history
        .map(
            (item) => `
        <div class="history-item" id="item-${item.id}">
            <div class="history-header">
                <span class="history-title">${escapeHtml(item.title)}</span>
            </div>
            <p class="history-body">${escapeHtml(item.body)}</p>
            <div class="history-meta">
                <div class="meta-left">
                    <span>📍 ${escapeHtml(item.interest)}</span>
                    ${item.image ? '<span class="history-image-tag">🖼️ Con imagen</span>' : ''}
                </div>
                <div class="meta-right">
                    <button class="delete-btn" data-id="${item.id}" title="Borrar notificación">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                    <span class="history-time">${new Date(item.timestamp).toLocaleTimeString()}</span>
                </div>
            </div>
        </div>
    `
        )
        .join('');

    // Add event listeners to delete buttons
    list.querySelectorAll('.delete-btn').forEach((btn) => {
        btn.onclick = (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            deleteNotification(id);
        };
    });
}

async function deleteNotification(id) {
    if (!confirm('¿Estás seguro de que quieres borrar esta notificación?')) return;

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/history/${id}`, {
            method: 'DELETE',
        });
        if (response.ok) {
            loadHistory();
        } else {
            console.error('Error al borrar la notificación');
        }
    } catch (error) {
        console.error('Error de red al borrar la notificación:', error);
    }
}

const pushForm = document.getElementById('push-form');
if (pushForm) {
    pushForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validate form
        const validationErrors = validateForm();
        if (validationErrors.length > 0) {
            showStatus(validationErrors.join(', '), 'error');
            return;
        }

        const interest = document.getElementById('interest').value;
        const title = document.getElementById('title').value;
        const body = document.getElementById('body').value;
        const submitBtn = document.getElementById('submit-btn');
        const loader = document.getElementById('loader');
        const statusMsg = document.getElementById('status-message');

        // Reset UI
        statusMsg.className = 'hidden';
        submitBtn.disabled = true;
        loader.style.display = 'block';

        // Use FormData for file upload support
        const formData = new FormData();
        formData.append('interest', interest);
        formData.append('title', title);
        formData.append('body', body);

        const fileInput = document.getElementById('imageFile');
        if (fileInput.files.length > 0) {
            formData.append('imageFile', fileInput.files[0]);
        }

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/api/send`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (response.ok) {
                showStatus('¡Notificación enviada con éxito!', 'success');
                document.getElementById('push-form').reset();
                // Reset character counters
                const tc = document.getElementById('title-counter');
                if (tc) tc.textContent = '0/100';
                const bc = document.getElementById('body-counter');
                if (bc) bc.textContent = '0/500';
                loadHistory();
            } else {
                showStatus('Error: ' + (data.error || 'No se pudo enviar'), 'error');
            }
        } catch (error) {
            showStatus('Error de conexión con el servidor', 'error');
        } finally {
            submitBtn.disabled = false;
            loader.style.display = 'none';
        }
    });
}

function showStatus(text, type) {
    const statusMsg = document.getElementById('status-message');
    statusMsg.innerText = text;
    statusMsg.className = `show ${type}`;

    // Auto hide after 5 seconds
    setTimeout(() => {
        statusMsg.className = 'hidden';
    }, 5000);
}
