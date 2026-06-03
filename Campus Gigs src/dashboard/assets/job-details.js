const API = 'http://localhost:5000/api';

function getToken() { return localStorage.getItem('token'); }
function authHeaders() {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` };
}

function getCurrentUserId() {
    try {
        return JSON.parse(atob(getToken().split('.')[1])).id;
    } catch { return null; }
}

function showFeedback(message, type = 'success') {
    const toast = document.getElementById('feedback-toast');
    if (!toast) return;
    toast.className = `alert alert-${type} mt-3`;
    toast.textContent = message;
    toast.classList.remove('d-none');
    setTimeout(() => toast.classList.add('d-none'), 5000);
}

document.addEventListener('DOMContentLoaded', async () => {
    const jobId = new URLSearchParams(window.location.search).get('id');
    if (!jobId) {
        document.getElementById('job-title').textContent = 'Error: No Job Selected.';
        document.getElementById('job-description').textContent = 'Please go back and select a valid gig.';
        return;
    }

    try {
        const response = await fetch(`${API}/jobs/${jobId}`);
        if (!response.ok) throw new Error('Job not found');
        const job = await response.json();

        document.getElementById('job-title').textContent = job.title;
        document.getElementById('job-description').textContent = job.description;
        document.getElementById('job-category').textContent = job.category;

        const statusBadge = document.getElementById('job-status-badge');
        if (statusBadge) {
            statusBadge.textContent = job.status.toUpperCase();
            statusBadge.className = `badge ${job.status === 'open' ? 'bg-success' : 'bg-secondary'}`;
        }

        const countEl = document.getElementById('job-application-count');
        if (countEl) countEl.textContent = `${job.applicationCount || 0} Proposals submitted`;

        const skillsContainer = document.getElementById('job-skills');
        if (skillsContainer) {
            skillsContainer.innerHTML = job.skills?.length
                ? job.skills.map(s => `<span class="job-tag me-1">${s}</span>`).join('')
                : '<span class="text-muted">No specific skills required</span>';
        }

        if (job.postedBy) {
            const clientName = job.postedBy.displayName || job.postedBy.firstName || 'Unknown Client';
            document.getElementById('client-name').textContent = clientName;
            document.getElementById('client-university').textContent = job.postedBy.university || '';
            const avatar = document.getElementById('client-avatar');
            if (avatar && job.postedBy.avatarUrl) avatar.src = job.postedBy.avatarUrl;
        }

        document.getElementById('job-budget').textContent = `₦${(job.budget / 100).toLocaleString()}`;
        document.getElementById('job-delivery-days').textContent = `${job.deliveryDays} Days`;
        document.getElementById('job-posted-date').textContent =
            new Date(job.createdAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' });

        const currentUserId = getCurrentUserId();
        const isOwner = job.postedBy && job.postedBy._id?.toString() === currentUserId;

        if (isOwner) {
            // Show proposals panel, hide freelancer actions
            document.getElementById('freelancer-actions').classList.add('d-none');
            document.getElementById('proposals-section').classList.remove('d-none');
            loadProposals(jobId, job);
        } else {
            // Freelancer view
            const applyBtn = document.getElementById('apply-btn');
            if (applyBtn) {
                if (job.status !== 'open') {
                    applyBtn.disabled = true;
                    applyBtn.textContent = 'Position Closed';
                } else {
                    applyBtn.addEventListener('click', () => {
                        if (!getToken()) {
                            window.location.href = '../Login and authentification/login.html';
                        } else {
                            window.location.href = `job-application.html?id=${job._id}`;
                        }
                    });
                }
            }

            // Show "Message Poster" button if logged in and poster ID is known
            if (getToken() && job.postedBy?._id) {
                const msgBtn = document.getElementById('message-poster-btn');
                if (msgBtn) {
                    msgBtn.style.display = '';
                    msgBtn.addEventListener('click', () => {
                        window.location.href = `message.html?with=${job.postedBy._id}`;
                    });
                }
            }
        }

    } catch (err) {
        console.error('Fetch Error:', err);
        document.getElementById('job-title').textContent = 'Job Not Found';
        document.getElementById('job-description').textContent = 'This job may have been deleted, or the server is offline.';
        const btn = document.getElementById('apply-btn');
        if (btn) btn.disabled = true;
    }
});

async function loadProposals(jobId, job) {
    const listEl = document.getElementById('proposals-list');
    const countEl = document.getElementById('proposal-count');

    try {
        const res = await fetch(`${API}/jobs/${jobId}/applications`, { headers: authHeaders() });
        if (!res.ok) throw new Error('Failed to load proposals');
        const { applications } = await res.json();

        if (countEl) countEl.textContent = applications.length;

        if (!applications.length) {
            listEl.innerHTML = '<p class="text-muted py-3">No proposals yet. Share your job to attract freelancers.</p>';
            return;
        }

        listEl.innerHTML = applications.map(app => {
            const applicant = app.applicant;
            const name = applicant?.displayName || applicant?.firstName || 'Anonymous';
            const avatar = applicant?.avatarUrl || 'assets/images/default-avatar.png';
            const bid = `₦${(app.bidAmount / 100).toLocaleString()}`;
            const date = new Date(app.createdAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
            const isPending = app.status === 'pending';
            const isAccepted = app.status === 'accepted';

            return `
            <div class="proposal-card ${isAccepted ? 'accepted' : app.status === 'rejected' ? 'rejected' : ''}" id="proposal-${app._id}">
                <div class="d-flex align-items-start gap-3">
                    <img src="${avatar}" class="rounded-circle" width="44" height="44" style="object-fit:cover;" alt="${name}">
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <strong>${name}</strong>
                                ${applicant?.university ? `<span class="text-muted small ms-1">· ${applicant.university}</span>` : ''}
                            </div>
                            <span class="badge ${isAccepted ? 'bg-success' : app.status === 'rejected' ? 'bg-danger' : 'bg-warning text-dark'}">
                                ${isAccepted ? 'Accepted' : app.status === 'rejected' ? 'Rejected' : 'Pending'}
                            </span>
                        </div>
                        <div class="mt-1 small text-muted">Bid: <strong class="text-dark">${bid}</strong> · Delivery: <strong class="text-dark">${app.deliveryDays} days</strong> · Applied ${date}</div>
                        <p class="mt-2 mb-3" style="font-size:14px;color:#374151;">${app.coverLetter}</p>
                        ${app.attachmentUrl ? `<a href="${app.attachmentUrl}" target="_blank" class="small text-primary me-3"><i class="bi bi-paperclip"></i> Attachment</a>` : ''}
                        <a href="message.html?with=${applicant?._id}" class="small text-secondary"><i class="bi bi-chat"></i> Message</a>
                    </div>
                </div>
                ${isPending ? `
                <div class="d-flex gap-2 mt-3 justify-content-end">
                    <button class="btn-reject" id="reject-${app._id}" onclick="handleProposal('${jobId}', '${app._id}', 'rejected')">Decline</button>
                    <button class="btn-accept" id="accept-${app._id}" onclick="handleProposal('${jobId}', '${app._id}', 'accepted')">Hire Freelancer</button>
                </div>` : ''}
            </div>`;
        }).join('');

    } catch (err) {
        listEl.innerHTML = `<p class="text-danger">${err.message}</p>`;
    }
}

async function showFundingModal(contractId, amountKobo) {
    const fmt = k => '₦' + (k / 100).toLocaleString('en-NG');

    // Inject modal if not already present
    if (!document.getElementById('fundEscrowModal')) {
        const div = document.createElement('div');
        div.innerHTML = `
        <div class="modal fade" id="fundEscrowModal" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header border-0">
                        <h5 class="modal-title fw-bold">Pay into Escrow to Start Work</h5>
                    </div>
                    <div class="modal-body">
                        <p>Your payment is held securely in escrow. It is only released to the freelancer after you approve their completed work.</p>
                        <div class="alert alert-info mb-3">
                            <div class="d-flex justify-content-between">
                                <span>Amount to pay now:</span>
                                <strong id="escrow-amount-display">—</strong>
                            </div>
                            <small class="text-muted">Fully refunded if you cancel the contract.</small>
                        </div>
                        <div id="fund-feedback" class="d-none alert"></div>
                    </div>
                    <div class="modal-footer border-0 d-flex justify-content-between">
                        <a href="work.html" class="btn btn-outline-secondary btn-sm">Pay later from Work page</a>
                        <button class="btn btn-success" id="confirm-fund-btn">
                            <i class="bi bi-credit-card me-1"></i> Pay via Paystack
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.appendChild(div.firstElementChild);
    }

    document.getElementById('escrow-amount-display').textContent = fmt(amountKobo);
    document.getElementById('fund-feedback').className = 'd-none alert';

    const confirmBtn = document.getElementById('confirm-fund-btn');
    confirmBtn.onclick = async () => {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Loading…';

        try {
            const infoRes = await fetch(`${API}/contracts/${contractId}/payment-info`, { headers: authHeaders() });
            const info = await infoRes.json();

            if (!infoRes.ok || !info.publicKey || info.publicKey.includes('your_public_key')) {
                throw new Error("Paystack public key not configured. Add PAYSTACK_PUBLIC_KEY to your .env file.");
            }

            // Open Paystack inline payment
            const handler = PaystackPop.setup({
                key: info.publicKey,
                email: info.email,
                amount: info.amount,
                currency: 'NGN',
                ref: info.reference,
                callback: function(response) {
                    (function() {
                        const fb = document.getElementById('fund-feedback');
                        fb.className = 'alert alert-info';
                        fb.textContent = 'Verifying payment…';
                        fb.classList.remove('d-none');

                        fetch(`${API}/contracts/${contractId}/fund`, {
                            method: 'POST',
                            headers: authHeaders(),
                            body: JSON.stringify({ reference: response.reference })
                        })
                        .then(function(fundRes) { return fundRes.json().then(function(d) { return { ok: fundRes.ok, data: d }; }); })
                        .then(function(result) {
                            fb.className = 'alert alert-' + (result.ok ? 'success' : 'danger');
                            fb.textContent = result.data.message;
                            if (result.ok) {
                                setTimeout(function() {
                                    bootstrap.Modal.getInstance(document.getElementById('fundEscrowModal'))?.hide();
                                    showFeedback('Payment confirmed! Contract is now active — the freelancer can begin work.', 'success');
                                }, 1500);
                            }
                        });
                    })();
                },
                onClose: function() {
                    confirmBtn.disabled = false;
                    confirmBtn.innerHTML = '<i class="bi bi-credit-card me-1"></i> Pay via Paystack';
                }
            });
            handler.openIframe();

        } catch (err) {
            const fb = document.getElementById('fund-feedback');
            fb.className = 'alert alert-danger';
            fb.textContent = err.message || 'Could not load payment. Check your Paystack keys.';
            fb.classList.remove('d-none');
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = '<i class="bi bi-credit-card me-1"></i> Pay via Paystack';
        }
    };

    new bootstrap.Modal(document.getElementById('fundEscrowModal')).show();
}

window.handleProposal = async function (jobId, appId, status) {
    const acceptBtn = document.getElementById(`accept-${appId}`);
    const rejectBtn = document.getElementById(`reject-${appId}`);
    if (acceptBtn) { acceptBtn.disabled = true; acceptBtn.textContent = 'Processing…'; }
    if (rejectBtn) rejectBtn.disabled = true;

    try {
        const res = await fetch(`${API}/jobs/${jobId}/applications/${appId}`, {
            method: 'PUT',
            headers: authHeaders(),
            body: JSON.stringify({ status })
        });

        const data = await res.json();

        if (!res.ok) {
            showFeedback(data.message || 'Something went wrong.', 'danger');
            if (acceptBtn) { acceptBtn.disabled = false; acceptBtn.textContent = 'Hire Freelancer'; }
            if (rejectBtn) rejectBtn.disabled = false;
            return;
        }

        if (status === 'accepted') {
            // Contract created but needs payment — show funding modal
            const contractId = data.application?.contractId || data.contract?._id;
            if (contractId) {
                showFundingModal(contractId, data.application?.bidAmount || 0);
            } else {
                showFeedback('Freelancer hired! Please fund the contract to start work.', 'success');
            }

            // Update the accepted card visually
            const card = document.getElementById(`proposal-${appId}`);
            if (card) {
                card.classList.add('accepted');
                card.querySelector('.d-flex.gap-2')?.remove();
                card.querySelector('.badge').className = 'badge bg-success';
                card.querySelector('.badge').textContent = 'Accepted';
            }
            // Gray out all other pending proposals
            document.querySelectorAll('[id^="proposal-"]').forEach(c => {
                if (c.id !== `proposal-${appId}`) {
                    c.classList.add('rejected');
                    c.querySelector('.d-flex.gap-2')?.remove();
                    const badge = c.querySelector('.badge');
                    if (badge && badge.textContent === 'Pending') {
                        badge.className = 'badge bg-danger';
                        badge.textContent = 'Rejected';
                    }
                }
            });
        } else {
            showFeedback('Proposal declined.', 'warning');
            const card = document.getElementById(`proposal-${appId}`);
            if (card) {
                card.classList.add('rejected');
                card.querySelector('.d-flex.gap-2')?.remove();
                card.querySelector('.badge').className = 'badge bg-danger';
                card.querySelector('.badge').textContent = 'Rejected';
            }
        }

    } catch (err) {
        showFeedback('Network error. Please try again.', 'danger');
        if (acceptBtn) { acceptBtn.disabled = false; acceptBtn.textContent = 'Hire Freelancer'; }
        if (rejectBtn) rejectBtn.disabled = false;
    }
};
