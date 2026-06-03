const API = 'http://localhost:5000/api';

function getToken() { return localStorage.getItem('token'); }
function authHeaders() {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` };
}
function getCurrentUserId() {
    try { return JSON.parse(atob(getToken().split('.')[1])).id; } catch { return null; }
}
function getCurrentRole() {
    try { return JSON.parse(atob(getToken().split('.')[1])).role; } catch { return null; }
}
function fmt(kobo) {
    return '₦' + (kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 0 });
}
function showFeedback(msg, type = 'success') {
    const el = document.getElementById('contract-feedback');
    if (!el) return;
    el.className = `alert alert-${type} mt-3`;
    el.textContent = msg;
    el.classList.remove('d-none');
    if (type === 'success') setTimeout(() => el.classList.add('d-none'), 6000);
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!getToken()) {
        window.location.href = '../Login and authentification/login.html';
        return;
    }

    const contractId = new URLSearchParams(window.location.search).get('id');
    if (!contractId) {
        document.getElementById('contract-title').textContent = 'No contract selected';
        return;
    }

    try {
        const res = await fetch(`${API}/contracts/${contractId}`, { headers: authHeaders() });
        if (res.status === 401) { localStorage.removeItem('token'); window.location.href = '../Login and authentification/login.html'; return; }
        if (!res.ok) throw new Error('Contract not found or access denied.');

        const contract = await res.json();
        renderContract(contract);
    } catch (err) {
        document.getElementById('contract-title').textContent = err.message;
    }
});

function renderContract(c) {
    const userId = getCurrentUserId();
    const isClient = c.client?._id?.toString() === userId || c.client?.toString() === userId;
    const isFreelancer = c.freelancer?._id?.toString() === userId || c.freelancer?.toString() === userId;

    const job = c.job || {};
    const client = c.client || {};
    const freelancer = c.freelancer || {};

    // Title & status
    set('contract-title', job.title || 'Contract');
    const statusBadge = document.getElementById('contract-status-badge');
    if (statusBadge) {
        const colors = { active: 'success', pending_review: 'warning text-dark', completed: 'secondary', disputed: 'danger', cancelled: 'dark' };
        statusBadge.className = `badge bg-${colors[c.status] || 'secondary'} ms-2`;
        statusBadge.textContent = c.status?.replace('_', ' ').toUpperCase();
    }

    // Parties
    const clientName = client.displayName || client.firstName || client.email || '—';
    const freelancerName = freelancer.displayName || freelancer.firstName || freelancer.email || '—';
    set('contract-client-name', clientName);
    set('contract-freelancer-name', freelancerName);

    // Payment & deadline
    const amountStr = fmt(c.agreedAmount || 0);
    const deadlineStr = c.deadline ? new Date(c.deadline).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
    set('contract-amount', amountStr);
    set('contract-deadline', deadlineStr);
    set('contract-amount-2', amountStr);
    set('contract-deadline-2', deadlineStr);
    const sb2 = document.getElementById('contract-status-badge-2');
    if (sb2) sb2.textContent = c.status?.replace('_', ' ') || '—';

    // Job description
    set('contract-description', job.description || '—');

    // Skills
    const skillsEl = document.getElementById('contract-skills');
    if (skillsEl && job.skills?.length) {
        skillsEl.innerHTML = job.skills.map(s => `<span class="badge bg-light text-dark border me-1">${s}</span>`).join('');
    }

    // Submission section (visible when work is submitted)
    if (c.status === 'pending_review' || c.status === 'completed' || c.status === 'disputed') {
        const section = document.getElementById('submission-section');
        if (section) section.classList.remove('d-none');
        set('submission-note', c.deliverableNote || c.submissionUrl ? '' : 'No note provided.');
        if (c.deliverableNote) set('submission-note', c.deliverableNote);
        const fileLink = document.getElementById('submission-file-link');
        if (fileLink) {
            if (c.submissionUrl) {
                fileLink.href = c.submissionUrl;
                fileLink.textContent = 'View submitted file';
                fileLink.classList.remove('d-none');
            } else {
                fileLink.classList.add('d-none');
            }
        }
    }

    // Action buttons — shown based on role + status
    renderActions(c, isClient, isFreelancer);
}

function renderActions(c, isClient, isFreelancer) {
    const container = document.getElementById('contract-actions');
    if (!container) return;
    container.innerHTML = '';

    const contractId = c._id;

    if (isClient) {
        if (c.status === 'pending_payment') {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <strong>Action required:</strong> You need to pay into escrow before the freelancer can begin work.
                </div>
                <button class="btn btn-success" id="pay-escrow-btn">
                    <i class="bi bi-credit-card me-1"></i> Pay ${fmt(c.agreedAmount)} via Paystack
                </button>
                <div id="fund-feedback" class="d-none alert mt-2"></div>`;

            document.getElementById('pay-escrow-btn').onclick = async () => {
                const btn = document.getElementById('pay-escrow-btn');
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Loading…';
                try {
                    const infoRes = await fetch(`${API}/contracts/${contractId}/payment-info`, { headers: authHeaders() });
                    const info = await infoRes.json();
                    if (!infoRes.ok || !info.publicKey || info.publicKey.includes('your_public_key')) {
                        throw new Error("Paystack public key not configured in .env");
                    }
                    if (typeof PaystackPop === 'undefined') {
                        throw new Error("Paystack script not loaded. Add it to contract-details.html.");
                    }
                    const handler = PaystackPop.setup({
                        key: info.publicKey,
                        email: info.email,
                        amount: info.amount,
                        currency: 'NGN',
                        ref: info.reference,
                        callback: function(response) {
                            fetch(`${API}/contracts/${contractId}/fund`, {
                                method: 'POST',
                                headers: authHeaders(),
                                body: JSON.stringify({ reference: response.reference })
                            })
                            .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
                            .then(function(result) {
                                const fb = document.getElementById('fund-feedback');
                                fb.className = 'alert alert-' + (result.ok ? 'success' : 'danger');
                                fb.textContent = result.data.message;
                                fb.classList.remove('d-none');
                                if (result.ok) setTimeout(function() { window.location.reload(); }, 1500);
                            });
                        },
                        onClose: function() { btn.disabled = false; btn.innerHTML = `<i class="bi bi-credit-card me-1"></i> Pay ${fmt(c.agreedAmount)} via Paystack`; }
                    });
                    handler.openIframe();
                } catch (err) {
                    showFeedback(err.message, 'danger');
                    btn.disabled = false;
                    btn.innerHTML = `<i class="bi bi-credit-card me-1"></i> Pay ${fmt(c.agreedAmount)} via Paystack`;
                }
            };
            return;
        }

        if (c.status === 'pending_review') {
            container.innerHTML = `
                <div class="d-flex gap-2 flex-wrap">
                    <button class="btn btn-success" onclick="updateStatus('${contractId}', 'completed')">
                        <i class="bi bi-check-circle me-1"></i> Approve & Release Payment
                    </button>
                    <button class="btn btn-outline-danger" onclick="updateStatus('${contractId}', 'disputed')">
                        <i class="bi bi-exclamation-triangle me-1"></i> Raise Dispute
                    </button>
                </div>
                <p class="text-muted small mt-2">Approving releases <strong>${fmt(c.agreedAmount)}</strong> to the freelancer's wallet.</p>`;
        } else if (c.status === 'active') {
            container.innerHTML = `
                <button class="btn btn-outline-secondary" onclick="cancelContract('${contractId}')">
                    <i class="bi bi-x-circle me-1"></i> Cancel Contract
                </button>`;
        } else if (c.status === 'completed') {
            container.innerHTML = `<div class="alert alert-success mb-0"><i class="bi bi-check-circle me-1"></i> Contract completed. Payment released.</div>`;
        } else if (c.status === 'disputed') {
            container.innerHTML = `<div class="alert alert-danger mb-0"><i class="bi bi-exclamation-triangle me-1"></i> Dispute raised. Admin will review shortly.</div>`;
        }
    }

    if (isFreelancer) {
        if (c.status === 'pending_payment') {
            container.innerHTML = `<div class="alert alert-warning mb-0"><i class="bi bi-hourglass me-1"></i> Waiting for the client to pay into escrow. You will be notified when you can start work.</div>`;
            return;
        }
        if (c.status === 'active') {
            const contractId2 = c._id;
            container.innerHTML = `
                <a href="task-submission.html?id=${contractId2}" class="btn btn-dark">
                    <i class="bi bi-upload me-1"></i> Submit Completed Work
                </a>`;
        } else if (c.status === 'pending_review') {
            container.innerHTML = `<div class="alert alert-info mb-0"><i class="bi bi-clock me-1"></i> Work submitted — waiting for client review.</div>`;
        } else if (c.status === 'completed') {
            container.innerHTML = `<div class="alert alert-success mb-0"><i class="bi bi-check-circle me-1"></i> Work approved. Payment sent to your wallet.</div>`;
        } else if (c.status === 'disputed') {
            container.innerHTML = `<div class="alert alert-danger mb-0"><i class="bi bi-exclamation-triangle me-1"></i> The client raised a dispute. Admin will review.</div>`;
        }
    }
}

function set(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

window.updateStatus = async function(contractId, status) {
    const labels = { completed: 'Approve Work', disputed: 'Raise Dispute' };
    if (!confirm(`Confirm: ${labels[status]}?`)) return;

    try {
        const res = await fetch(`${API}/contracts/${contractId}/status`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ status })
        });
        const data = await res.json();
        if (!res.ok) { showFeedback(data.message || 'Action failed.', 'danger'); return; }

        showFeedback(data.message || 'Updated successfully.', 'success');
        setTimeout(() => window.location.reload(), 1800);
    } catch (err) {
        showFeedback('Network error.', 'danger');
    }
};

window.cancelContract = async function(contractId) {
    if (!confirm('Are you sure you want to cancel this contract? Escrow will be refunded.')) return;
    try {
        const res = await fetch(`${API}/contracts/${contractId}/status`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ status: 'cancelled' })
        });
        const data = await res.json();
        if (!res.ok) { showFeedback(data.message || 'Cancellation failed.', 'danger'); return; }
        showFeedback('Contract cancelled. Escrow refunded.', 'success');
        setTimeout(() => window.location.href = 'work.html', 1800);
    } catch (err) {
        showFeedback('Network error.', 'danger');
    }
};
