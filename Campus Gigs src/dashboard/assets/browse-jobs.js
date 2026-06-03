// ==================================================================
// 1. FETCH AND RENDER SIDEBAR PROFILE
// ==================================================================
async function loadSidebarProfile() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const res = await fetch('http://localhost:5000/api/users/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) return;
        const user = await res.json();

        const nameEl = document.getElementById('sidebar-name');
        if (nameEl) nameEl.textContent = user.name || user.displayName || '&nbsp;';

        const roleEl = document.getElementById('sidebar-role');
        if (roleEl) {
            const role = user.role || '';
            roleEl.textContent = role ? role.charAt(0).toUpperCase() + role.slice(1) : '&nbsp;';
        }

        const projectsEl = document.getElementById('sidebar-projects');
        if (projectsEl) projectsEl.textContent = Number(user.completedJobs || user.completedJobsCount || 0) || 0;

        const ratingEl = document.getElementById('sidebar-rating');
        if (ratingEl) {
            const rating = Number(user.rating || 0);
            ratingEl.textContent = rating > 0 ? rating.toFixed(1) : 'New';
        }

        const avatarImg = document.getElementById('sidebar-avatar');
        if (avatarImg && user.avatarUrl) avatarImg.src = user.avatarUrl;

        // Profile completion: base 20 + 20 per non-empty key field.
        let completion = 20;
        const hasBio = !!user.bio;
        const hasUniversity = !!user.university;
        const hasSkills = Array.isArray(user.skills) ? user.skills.length > 0 : !!user.skills;
        const hasBankDetails = !!(user.bankDetails && (user.bankDetails.bankName || user.bankDetails.accountNumber));

        if (hasBio) completion += 20;
        if (hasUniversity) completion += 20;
        if (hasSkills) completion += 20;
        if (hasBankDetails) completion += 20;

        completion = Math.max(0, Math.min(100, completion));

        const progressBar = document.getElementById('sidebar-completion-bar');
        const progressText = document.getElementById('sidebar-completion-text');

        if (progressBar) {
            progressBar.style.width = `${completion}%`;
            progressBar.setAttribute('aria-valuenow', String(completion));
        }
        if (progressText) progressText.textContent = `${completion}%`;
    } catch (err) {
        console.error('Failed to load sidebar profile:', err);
    }
}

// ==================================================================
// 2. MAIN BROWSE JOBS LOGIC
// ==================================================================
document.addEventListener('DOMContentLoaded', function () {
    const loadJobs = async (filters = {}, page = 1) => {
        const jobsContainer = document.getElementById('jobs-container');
        if (!jobsContainer) return;

        jobsContainer.innerHTML = '<div class="text-center text-secondary py-5"><div class="spinner-border text-primary mb-3" role="status"></div><p>Loading campus gigs...</p></div>';

        try {
            let url = `http://localhost:5000/api/jobs?page=${page}`;
            if (filters.experienceLevel) url += `&experienceLevel=${filters.experienceLevel}`;
            if (filters.location) url += `&location=${filters.location}`;
            if (filters.searchText) url += `&searchText=${encodeURIComponent(filters.searchText)}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch jobs');

            const data = await response.json();
            const jobsArray = data.jobs;

            if (!jobsArray) throw new Error("The backend object is missing the 'jobs' array!");

            if (jobsArray.length === 0) {
                jobsContainer.innerHTML = '<p class="text-center text-secondary py-5">No jobs match your filters. Try adjusting your search!</p>';
                return;
            }

            const jobsHTML = jobsArray.map(job => {
                const postedDate = new Date(job.createdAt);
                const hoursAgo = Math.floor((new Date() - postedDate) / (1000 * 60 * 60));
                const timeString = hoursAgo < 24 ? `${hoursAgo} hours ago` : `${Math.floor(hoursAgo / 24)} days ago`;

                const tagsHTML = (job.skills || []).map(skill => `<span class="job-tag">${skill}</span>`).join('');

                const formattedBudget = `₦${(job.budget / 100).toLocaleString()}`;

                return `
                    <div class="job-card">
                        <div class="job-posted-time">Posted ${timeString}</div>
                        <div class="job-header">
                            <div class="company-logo bg-primary text-white d-flex align-items-center justify-content-center fw-bold rounded">CG</div>
                            <div class="ms-3">
                                <h4 class="job-title mb-1">${job.title}</h4>
                                <div class="job-meta-row mb-0">
                                    <span class="fw-semibold text-success">${formattedBudget}</span>
                                    <span class="job-meta-dot mx-2"></span>
                                    <span>${job.category}</span>
                                    <span class="job-meta-dot mx-2"></span>
                                    <span><i class="bi bi-clock me-1"></i>${job.deliveryDays} Days</span>
                                </div>
                            </div>
                        </div>
                        <p class="job-desc mt-3">${job.description.substring(0, 150)}...</p>
                        <div class="job-tags">${tagsHTML}</div>
                        <div class="job-location mt-3">
                            <i class="bi bi-geo-alt"></i> ${job.location || 'Remote'}
                            ${job.isUrgent ? '<span class="badge bg-danger ms-2">Urgent</span>' : ''}
                        </div>
                        <div class="mt-3">
                            <button class="btn btn-primary px-4 py-2 fw-semibold" onclick="handleApplyClick('${job._id}')">View Details</button>
                        </div>
                    </div>
                `;
            }).join('');

            jobsContainer.innerHTML = jobsHTML;
            renderPagination(data.currentPage, data.totalPages);
        } catch (error) {
            console.error('Error loading jobs:', error);
            jobsContainer.innerHTML = '<p class="text-danger text-center py-5">Failed to load jobs. Please ensure the server is running.</p>';
        }
    };

    const renderPagination = (currentPage, totalPages) => {
        const paginationContainer = document.getElementById('pagination-container');
        if (!paginationContainer || totalPages <= 1) {
            if (paginationContainer) paginationContainer.innerHTML = '';
            return;
        }

        let html = '<ul class="pagination justify-content-center">';
        const prevDisabled = currentPage === 1 ? 'disabled' : '';
        html += `<li class="page-item ${prevDisabled}"><a class="page-link" href="#" onclick="changePage(${currentPage - 1}, ${totalPages}); return false;">Previous</a></li>`;

        for (let i = 1; i <= totalPages; i++) {
            const activeClass = i === currentPage ? 'active' : '';
            html += `<li class="page-item ${activeClass}"><a class="page-link" href="#" onclick="changePage(${i}, ${totalPages}); return false;">${i}</a></li>`;
        }

        const nextDisabled = currentPage === totalPages ? 'disabled' : '';
        html += `<li class="page-item ${nextDisabled}"><a class="page-link" href="#" onclick="changePage(${currentPage + 1}, ${totalPages}); return false;">Next</a></li></ul>`;
        paginationContainer.innerHTML = html;
    };

    const urlParams = new URLSearchParams(window.location.search);
    const hasToken = !!localStorage.getItem('token');
    // Treat any logged-in user as "registered" even without the query param
    const isRegistered = urlParams.get('mode') === 'registered' || hasToken;

    const publicHeader = document.getElementById('publicHeader');
    const dashboardHeader = document.getElementById('dashboardHeader');
    const guestSidebar = document.getElementById('guestSidebar');
    const registeredSidebar = document.getElementById('registeredSidebar');

    if (isRegistered) {
        if (publicHeader) publicHeader.style.display = 'none';
        if (dashboardHeader) dashboardHeader.style.display = 'block';
        if (guestSidebar) guestSidebar.style.display = 'none';
        if (registeredSidebar) registeredSidebar.style.display = 'block';
        loadSidebarProfile();
    } else {
        if (publicHeader) publicHeader.style.display = 'block';
        if (dashboardHeader) dashboardHeader.style.display = 'none';
        if (guestSidebar) guestSidebar.style.display = 'block';
        if (registeredSidebar) registeredSidebar.style.display = 'none';
    }

    let currentFilters = {};
    let currentPage = 1;

    window.changePage = (newPage, totalPages) => {
        if (newPage < 1 || newPage > totalPages) return;
        currentPage = newPage;
        loadJobs(currentFilters, currentPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const filterInputs = document.querySelectorAll('.filter-checkbox, .filter-radio');
    filterInputs.forEach(input => {
        input.addEventListener('change', () => {
            currentPage = 1;
            const searchText = typeof currentFilters.searchText === 'string' ? currentFilters.searchText : undefined;
            currentFilters = {};
            if (searchText) currentFilters.searchText = searchText;

            const expLevelChecked = document.querySelector('input[name="experienceLevel"]:checked');
            if (expLevelChecked && expLevelChecked.value !== 'All') currentFilters.experienceLevel = expLevelChecked.value;
            const locationChecked = document.querySelector('input[name="location"]:checked');
            if (locationChecked && locationChecked.value !== 'All') currentFilters.location = locationChecked.value;
            loadJobs(currentFilters, currentPage);
        });
    });

    const searchInput = document.querySelector('.search-input-lg');
    if (searchInput) {
        const debounce = (fn, ms = 300) => {
            let t;
            return (...args) => {
                clearTimeout(t);
                t = setTimeout(() => fn(...args), ms);
            };
        };

        const applySearch = debounce(() => {
            currentPage = 1;
            const text = (searchInput.value || '').trim();
            if (text) currentFilters.searchText = text;
            else delete currentFilters.searchText;
            loadJobs(currentFilters, currentPage);
        }, 300);

        searchInput.addEventListener('input', applySearch);
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                applySearch();
            }
        });
    }

    loadJobs(currentFilters, currentPage);
});

window.handleApplyClick = function (jobId) {
    const token = localStorage.getItem('token');
    if (token) {
        window.location.href = `job-details.html?id=${jobId}`;
    } else {
        window.location.href = '../Login and authentification/login.html';
    }
};

window.switchMode = function (mode) {
    if (mode === 'registered' || mode === 'guest') {
        const url = new URL(window.location);
        url.searchParams.set('mode', mode);
        window.location.href = url.toString();
    }
};

