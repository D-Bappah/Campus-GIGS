const API_BASE_NOTIF = "http://localhost:5000/api";
let currentNotifPage = 1;
let totalNotifPages = 1;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Preserve your popup toggle logic!
    const notificationBtn = document.getElementById('notificationBtn') || document.getElementById('notification-bell');
    const popup = document.getElementById('notificationPopup');

    if (notificationBtn && popup) {
        notificationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            popup.classList.toggle('show');
            if (popup.classList.contains('show')) {
                loadNavNotifications(); // Fetch fresh data when opened!
            }
        });

        document.addEventListener('click', (e) => {
            if (!popup.contains(e.target) && !notificationBtn.contains(e.target)) {
                popup.classList.remove('show');
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') popup.classList.remove('show');
        });
    }

    // 2. Initial load of the unread badge
    loadUnreadBadge();

    // 3. If we are on the dedicated notifications.html page, load the full list
    if (document.getElementById('notifications-page-list')) {
        loadFullNotifications(currentNotifPage);

        document.getElementById("notif-prev")?.addEventListener("click", () => {
            if (currentNotifPage > 1) loadFullNotifications(currentNotifPage - 1);
        });

        document.getElementById("notif-next")?.addEventListener("click", () => {
            if (currentNotifPage < totalNotifPages) loadFullNotifications(currentNotifPage + 1);
        });
    }
});

// --- API FUNCTIONS ---

async function loadUnreadBadge() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch(`${API_BASE_NOTIF}/notifications?limit=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        // Update badges across the app
        const badges = [document.getElementById('notification-badge'), document.getElementById('notification-badge-dot')];
        badges.forEach(badge => {
            if (badge) {
                if (data.unreadCount > 0) {
                    badge.textContent = data.unreadCount > 99 ? '99+' : data.unreadCount;
                    badge.classList.remove('d-none');
                } else {
                    badge.classList.add('d-none');
                }
            }
        });

        // Update dedicated page count if it exists
        const countSpan = document.getElementById('notif-unread-count');
        if (countSpan) countSpan.textContent = data.unreadCount;

    } catch (err) { console.error("Error fetching badge:", err); }
}

async function loadNavNotifications() {
    const token = localStorage.getItem('token');
    const listContainer = document.querySelector('.notification-list');
    if (!listContainer) return;

    listContainer.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm text-primary"></div></div>';

    try {
        const res = await fetch(`${API_BASE_NOTIF}/notifications?limit=5`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (data.notifications.length === 0) {
            listContainer.innerHTML = '<div class="text-center text-muted p-3">No new notifications</div>';
            return;
        }

        listContainer.innerHTML = data.notifications.map(n => renderNotificationHTML(n)).join('');
    } catch (err) {
        listContainer.innerHTML = '<div class="text-center text-danger p-3">Failed to load</div>';
    }
}

async function loadFullNotifications(page) {
    const token = localStorage.getItem('token');
    const listContainer = document.getElementById('notifications-page-list');
    if (!listContainer) return;

    listContainer.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';

    try {
        const res = await fetch(`${API_BASE_NOTIF}/notifications?page=${page}&limit=10`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        currentNotifPage = data.pagination.page;
        totalNotifPages = data.pagination.pages;

        if (data.notifications.length === 0) {
            listContainer.innerHTML = '<div class="text-center text-muted py-5">You have no notifications.</div>';
        } else {
            listContainer.innerHTML = data.notifications.map(n => renderNotificationHTML(n)).join('');
        }

        // Update pagination buttons
        const prevBtn = document.getElementById("notif-prev");
        const nextBtn = document.getElementById("notif-next");
        const pageInfo = document.getElementById("notif-page-info");

        if (pageInfo) pageInfo.textContent = `Page ${currentNotifPage} of ${totalNotifPages}`;
        if (prevBtn) prevBtn.disabled = currentNotifPage <= 1;
        if (nextBtn) nextBtn.disabled = currentNotifPage >= totalNotifPages;

    } catch (err) {
        listContainer.innerHTML = '<div class="text-center text-danger py-5">Failed to load notifications.</div>';
    }
}

// --- HELPER FUNCTIONS ---

function renderNotificationHTML(notif) {
    const isUnread = notif.read ? '' : 'unread';
    const time = new Date(notif.createdAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' });
    
    // Choose icon based on type
    let icon = '<i class="bi bi-bell"></i>';
    if (notif.type === 'job_update') icon = '<i class="bi bi-briefcase"></i>';
    if (notif.type === 'payment') icon = '<i class="bi bi-cash-coin text-success"></i>';
    if (notif.type === 'message') icon = '<i class="bi bi-chat-dots text-primary"></i>';

    return `
        <a href="#" class="notification-item ${isUnread}" onclick="markAsRead('${notif._id}', '${notif.link || '#'}'); return false;">
            <div class="notif-icon-box bg-white border shadow-sm">${icon}</div>
            <div class="notif-content">
                <p class="notif-text">${notif.message}</p>
                <span class="notif-time">${time}</span>
            </div>
        </a>
    `;
}

window.markAsRead = async function(id, redirectLink) {
    const token = localStorage.getItem('token');
    try {
        await fetch(`${API_BASE_NOTIF}/notifications/${id}/read`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        window.location.href = redirectLink !== 'undefined' ? redirectLink : '#';
    } catch (err) {
        console.error(err);
        window.location.href = redirectLink !== 'undefined' ? redirectLink : '#';
    }
};

window.markAllNotificationsRead = async function() {
    const token = localStorage.getItem('token');
    try {
        await fetch(`${API_BASE_NOTIF}/notifications/read-all`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        window.location.reload();
    } catch (err) {
        alert("Failed to clear notifications.");
    }
};