const API_BASE = "http://localhost:5000/api";
let allApplications = [];
let allContracts = [];
let currentTab = 'applications';

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../Login and authentification/login.html';
        return;
    }

    // Load both views in parallel regardless of role
    try {
        const [appRes, contractRes] = await Promise.all([
            fetch(`${API_BASE}/applications/me`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_BASE}/contracts?role=client`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (appRes.ok) allApplications = await appRes.json();
        if (contractRes.ok) {
            const data = await contractRes.json();
            allContracts = data.contracts || [];
        }

        // Default to whichever tab has content; prefer applications
        switchWorkTab('applications');

    } catch (err) {
        console.error(err);
        document.getElementById('work-container').innerHTML =
            '<p class="text-danger text-center py-5">Failed to load. Ensure server is running.</p>';
    }
});

window.switchWorkTab = function(tab) {
    currentTab = tab;

    document.getElementById('tab-applications')?.classList.toggle('active', tab === 'applications');
    document.getElementById('tab-contracts')?.classList.toggle('active', tab === 'contracts');

    const sidebar = document.getElementById('filter-sidebar');

    if (tab === 'contracts') {
        if (sidebar) sidebar.innerHTML = `
            <a href="#" class="sidebar-link active" onclick="filterContracts('all'); return false;">All</a>
            <a href="#" class="sidebar-link" onclick="filterContracts('pending_payment'); return false;">Awaiting Payment</a>
            <a href="#" class="sidebar-link" onclick="filterContracts('active'); return false;">Active</a>
            <a href="#" class="sidebar-link" onclick="filterContracts('pending_review'); return false;">Pending Review</a>
            <a href="#" class="sidebar-link" onclick="filterContracts('completed'); return false;">Completed</a>
        `;
        filterContracts('all');
    } else {
        if (sidebar) sidebar.innerHTML = `
            <a href="#" class="sidebar-link active" onclick="filterWork('all'); return false;">All</a>
            <a href="#" class="sidebar-link" onclick="filterWork('pending'); return false;">Pending</a>
            <a href="#" class="sidebar-link" onclick="filterWork('active'); return false;">Active</a>
            <a href="#" class="sidebar-link" onclick="filterWork('pending_review'); return false;">Under Review</a>
            <a href="#" class="sidebar-link" onclick="filterWork('completed'); return false;">Completed</a>
            <a href="#" class="sidebar-link" onclick="filterWork('rejected'); return false;">Declined</a>
        `;
        filterWork('all');
    }
};

window.filterContracts = function(status) {
    const links = document.querySelectorAll('#filter-sidebar .sidebar-link');
    links.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('onclick')?.includes(`'${status}'`)) link.classList.add('active');
    });

    let filtered = allContracts;
    if (status !== 'all') filtered = allContracts.filter(c => c.status === status);

    const container = document.getElementById('work-container');

    if (!filtered.length) {
        container.innerHTML = `
            <div class="col-12">
                <div class="empty-state mt-4 text-center">
                    <h3>No contracts here</h3>
                    <p class="text-muted">Post a job to start receiving proposals from freelancers.</p>
                    <a href="upload-job.html" class="btn btn-primary px-4 py-2 mt-2">Post a Job</a>
                </div>
            </div>`;
        return;
    }

    container.innerHTML = filtered.map(c => {
        const job = c.job || {};
        const freelancer = c.freelancer || {};
        const freelancerName = freelancer.displayName || freelancer.firstName || 'Freelancer';
        const amount = '₦' + ((c.agreedAmount || 0) / 100).toLocaleString();
        const deadline = c.deadline ? new Date(c.deadline).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

        const statusColors = {
            pending_payment: 'warning text-dark',
            active: 'success',
            pending_review: 'warning text-dark',
            completed: 'secondary',
            disputed: 'danger',
            cancelled: 'dark'
        };
        const badgeClass = statusColors[c.status] || 'secondary';
        const statusLabel = (c.status || '—').replace(/_/g, ' ').toUpperCase();
        const isPendingReview = c.status === 'pending_review';
        const isPendingPayment = c.status === 'pending_payment';

        return `
            <div class="col-md-6">
                <div class="card shadow-sm border-0 h-100 p-3 ${isPendingReview || isPendingPayment ? 'border border-warning' : ''}">
                    <div class="mb-2 d-flex justify-content-between align-items-center">
                        <span class="badge bg-${badgeClass} px-2 py-1">${statusLabel}</span>
                        ${isPendingReview ? '<span class="badge bg-warning text-dark"><i class="bi bi-eye me-1"></i>Review needed</span>' : ''}
                        ${isPendingPayment ? '<span class="badge bg-secondary text-white"><i class="bi bi-lock me-1"></i>Payment needed</span>' : ''}
                    </div>
                    <h5 class="fw-bold mb-1">${job.title || 'Contract'}</h5>
                    <div class="text-muted small mb-3">Freelancer: <strong>${freelancerName}</strong></div>
                    <div class="d-flex align-items-center gap-3 small text-secondary mb-3">
                        <span><i class="bi bi-wallet2 me-1"></i>${amount}</span>
                        <span><i class="bi bi-calendar me-1"></i>Due ${deadline}</span>
                    </div>
                    <div class="mt-auto">
                        <a href="contract-details.html?id=${c._id}" class="btn ${isPendingReview ? 'btn-warning' : isPendingPayment ? 'btn-outline-warning' : 'btn-primary'} btn-sm px-3">
                            ${isPendingReview ? '<i class="bi bi-eye me-1"></i>Review Work' : isPendingPayment ? '<i class="bi bi-credit-card me-1"></i>Pay Escrow' : 'View Contract'}
                        </a>
                    </div>
                </div>
            </div>`;
    }).join('');
};

window.filterWork = function(status) {
    const links = document.querySelectorAll('#filter-sidebar .sidebar-link');
    links.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('onclick')?.includes(`'${status}'`)) link.classList.add('active');
    });

    let filteredApps = allApplications;
    if (status !== 'all') {
        filteredApps = allApplications.filter(app => {
            const effectiveStatus = (app.status === 'accepted' && app.contractStatus)
                ? app.contractStatus
                : app.status;
            return effectiveStatus === status;
        });
    }

    const container = document.getElementById('work-container');

    if (filteredApps.length === 0) {
        container.innerHTML = `
            <div class="col-12">
                <div class="empty-state mt-4 text-center">
                    <h3>No proposals yet</h3>
                    <p class="text-muted">Browse available jobs and submit a proposal to get started.</p>
                    <a href="browse-jobs.html" class="btn btn-primary px-4 py-2 mt-2">Browse Jobs</a>
                </div>
            </div>`;
        return;
    }

    container.innerHTML = filteredApps.map(app => {
        if (!app.job) return '';

        const effectiveStatus = (app.status === 'accepted' && app.contractStatus)
            ? app.contractStatus
            : app.status;

        let badgeClass = 'bg-secondary text-white border-0';
        let badgeText = effectiveStatus || 'Unknown';

        const statusMap = {
            pending:         ['bg-warning text-dark border-0', 'Pending'],
            pending_payment: ['bg-secondary text-white border-0', 'Awaiting Escrow'],
            active:          ['bg-success text-white border-0', 'Active'],
            pending_review:  ['bg-info text-dark border-0', 'Under Review'],
            completed:       ['bg-primary text-white border-0', 'Completed'],
            disputed:        ['bg-danger text-white border-0', 'Disputed'],
            rejected:        ['bg-danger text-white border-0', 'Declined'],
        };
        if (statusMap[effectiveStatus]) [badgeClass, badgeText] = statusMap[effectiveStatus];

        const formattedBid = `₦${(app.bidAmount / 100).toLocaleString()}`;
        const appliedDate = new Date(app.createdAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' });

        return `
            <div class="col-md-6">
                <div class="card shadow-sm border-0 h-100 p-3">
                    <div class="mb-2">
                        <span class="badge ${badgeClass} px-2 py-1">${badgeText}</span>
                    </div>
                    <h5 class="fw-bold mb-2">${app.job.title}</h5>
                    <div class="text-muted small mb-3">Applied on: ${appliedDate}</div>
                    <div class="d-flex align-items-center gap-2 small text-secondary mb-3">
                        <span>Bid: ${formattedBid}</span>
                        <span>•</span>
                        <span>Delivery: ${app.deliveryDays} days</span>
                    </div>
                    <div class="mt-auto d-flex flex-wrap align-items-center gap-2">
                        <a href="job-details.html?id=${app.job._id}" class="btn btn-outline-secondary btn-sm px-3">View Job</a>
                        ${app.contractId ? `<a href="contract-details.html?id=${app.contractId}" class="btn btn-primary btn-sm px-3">View Contract</a>` : ''}
                        ${effectiveStatus === 'active'
                            ? `<a href="task-submission.html?id=${app.contractId}" class="btn btn-dark btn-sm px-3">Submit Work</a>`
                            : effectiveStatus === 'pending_payment'
                            ? `<span class="small text-muted fst-italic">Waiting for client payment</span>`
                            : effectiveStatus === 'pending_review'
                            ? `<span class="small text-info fw-semibold"><i class="bi bi-eye me-1"></i>Under review</span>`
                            : effectiveStatus === 'completed'
                            ? `<span class="small text-success fw-semibold"><i class="bi bi-check-circle me-1"></i>Completed</span>`
                            : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
};
