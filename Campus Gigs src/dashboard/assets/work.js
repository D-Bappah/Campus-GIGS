const API_BASE = "http://localhost:5000/api";
let allApplications = []; 

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../Login and authentification/login.html';
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/applications/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error("Failed to fetch applications");
        
        allApplications = await res.json();
        filterWork('all'); 
        
    } catch (err) {
        console.error(err);
        document.getElementById('work-container').innerHTML = 
            '<p class="text-danger text-center py-5">Failed to load work history. Ensure server is running.</p>';
    }
});

window.filterWork = function(status) {
    const links = document.querySelectorAll('#filter-sidebar .sidebar-link');
    links.forEach(link => {
        link.classList.remove('active');
        if(link.getAttribute('onclick').includes(status)) {
            link.classList.add('active');
        }
    });

    let filteredApps = allApplications;
    if (status !== 'all') {
        filteredApps = allApplications.filter(app => app.status === status);
    }

    const container = document.getElementById('work-container');
    
    if (filteredApps.length === 0) {
        container.innerHTML = `
            <div class="col-12">
                <div class="empty-state mt-4 text-center">
                    <h3>No applications found!</h3>
                    <p class="text-muted">You don't have any proposals in this category yet.</p>
                    <a href="browse-jobs.html?mode=registered" class="btn btn-primary px-4 py-2 mt-2">Browse jobs</a>
                </div>
            </div>`;
        return;
    }

    container.innerHTML = filteredApps.map(app => {
        if (!app.job) return ''; 

        let badgeClass = '';
        let badgeText = '';

        if (app.status === 'pending') {
            badgeClass = 'bg-warning text-dark border-0';
            badgeText = 'Pending';
        } else if (app.status === 'accepted') {
            badgeClass = 'bg-success text-white border-0';
            badgeText = 'Hired / Active';
        } else if (app.status === 'rejected') {
            badgeClass = 'bg-danger text-white border-0';
            badgeText = 'Declined';
        }

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
                    <div class="mt-auto">
                        <a href="job-details.html?id=${app.job._id}" class="btn btn-primary btn-sm px-3">View Job</a>
                        ${app.status === 'accepted' ? `<a href="task-submission.html?id=${app._id}" class="btn btn-dark btn-sm px-3 ms-2">Submit Work</a>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
};