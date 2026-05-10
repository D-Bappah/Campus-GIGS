document.addEventListener('DOMContentLoaded', function () {

    // --- Fetch and Render Jobs ---
    // We now pass 'filters' and 'page' as arguments
    // --- Fetch and Render Jobs ---
    const loadJobs = async (filters = {}, page = 1) => {
        const jobsContainer = document.getElementById('jobs-container');
        jobsContainer.innerHTML = '<div class="text-center text-secondary py-5"><div class="spinner-border text-primary mb-3"></div><p>Loading campus gigs...</p></div>';
        
        try {
            // 1. Construct the URL
            let url = `http://localhost:5000/api/jobs?page=${page}`;
            if (filters.experienceLevel) url += `&experienceLevel=${filters.experienceLevel}`;
            if (filters.location) url += `&location=${filters.location}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch jobs');
            
            // 2. Parse the new rich object from the backend
            const data = await response.json();
            console.log("THE SERVER SENT EXACTLY THIS:", data);
            
            // 3. Safely extract the array of jobs
            const jobsArray = data.jobs; 
            
            // Safety check: If the array isn't there, force an error so we can see why
            if (!jobsArray) {
                throw new Error("The backend object is missing the 'jobs' array!");
            }

            if (jobsArray.length === 0) {
                jobsContainer.innerHTML = '<p class="text-center text-secondary py-5">No jobs match your filters. Try adjusting your search!</p>';
                return;
            }

            // 4. Map the HTML
            const jobsHTML = jobsArray.map(job => {
                const postedDate = new Date(job.createdAt);
                const hoursAgo = Math.floor((new Date() - postedDate) / (1000 * 60 * 60));
                const timeString = hoursAgo < 24 ? `${hoursAgo} hours ago` : `${Math.floor(hoursAgo/24)} days ago`;
                
                // Safety check for tags just in case
                const tagsHTML = (job.tags || []).map(tag => `<span class="job-tag">${tag}</span>`).join('');

                return `
                    <div class="job-card">
                        <div class="job-posted-time">Posted ${timeString}</div>
                        <div class="job-header">
                            <img src="../Login and authentification/assets/logo.png" class="company-logo" alt="Company">
                            <div>
                                <h4 class="job-title">${job.title}</h4>
                                <div class="job-meta-row">
                                    <span>${job.priceRange}</span>
                                    <span class="job-meta-dot"></span>
                                    <span>${job.experienceLevel}</span>
                                    <span class="job-meta-dot"></span>
                                    <span>${job.duration}</span>
                                </div>
                            </div>
                        </div>
                        <p class="job-desc">${job.description}</p>
                        <div class="job-tags">${tagsHTML}</div>
                        <div class="job-location">
                            <i class="bi bi-geo-alt"></i> ${job.location}
                        </div>
                        <div class="mt-3">
                            <button class="btn btn-primary" onclick="handleApplyClick('${job._id}')">Apply Now</button>
                        </div>
                    </div>
                `;
            }).join('');

            jobsContainer.innerHTML = jobsHTML;
// Build the page numbers based on what the server just sent
            renderPagination(data.currentPage, data.totalPages);
            
        } catch (error) {
            console.error('Error loading jobs:', error);
            jobsContainer.innerHTML = '<p class="text-danger text-center py-5">Failed to load jobs. Please ensure the server is running.</p>';
        }
    };

    // --- Render Pagination UI ---
    const renderPagination = (currentPage, totalPages) => {
        const paginationContainer = document.getElementById('pagination-container');
        if (!paginationContainer) return;

        // If there is only 1 page of jobs, don't show the pagination bar at all
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let html = '<ul class="pagination justify-content-center">';

        // 1. Previous Button
        const prevDisabled = currentPage === 1 ? 'disabled' : '';
        html += `
            <li class="page-item ${prevDisabled}">
                <a class="page-link" href="#" onclick="changePage(${currentPage - 1}, ${totalPages}); return false;">Previous</a>
            </li>
        `;

        // 2. The Page Numbers (1, 2, 3...)
        for (let i = 1; i <= totalPages; i++) {
            const activeClass = i === currentPage ? 'active' : '';
            html += `
                <li class="page-item ${activeClass}">
                    <a class="page-link" href="#" onclick="changePage(${i}, ${totalPages}); return false;">${i}</a>
                </li>
            `;
        }

        // 3. Next Button
        const nextDisabled = currentPage === totalPages ? 'disabled' : '';
        html += `
            <li class="page-item ${nextDisabled}">
                <a class="page-link" href="#" onclick="changePage(${currentPage + 1}, ${totalPages}); return false;">Next</a>
            </li>
        `;

        html += '</ul>';
        paginationContainer.innerHTML = html;
    };
    
    // Execute the fetch immediately
    loadJobs();

    // Determine mode from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode'); // 'guest' or 'registered'

    // Elements
    const publicHeader = document.getElementById('publicHeader');
    const dashboardHeader = document.getElementById('dashboardHeader');
    const guestSidebar = document.getElementById('guestSidebar');
    const registeredSidebar = document.getElementById('registeredSidebar');

    // Logic: Default to Guest if no param or explicit 'guest'
    if (mode === 'registered') {
        // Show Registered UI
        if (publicHeader) publicHeader.style.display = 'none';
        if (dashboardHeader) dashboardHeader.style.display = 'block';
        if (guestSidebar) guestSidebar.style.display = 'none';
        if (registeredSidebar) registeredSidebar.style.display = 'block';
    } else {
        // Show Guest UI (Default)
        if (publicHeader) publicHeader.style.display = 'block';
        if (dashboardHeader) dashboardHeader.style.display = 'none';
        if (guestSidebar) guestSidebar.style.display = 'block';
        if (registeredSidebar) registeredSidebar.style.display = 'none';
    }

    // --- Sidebar Filtering Logic ---
    let currentFilters = {};
    let currentPage = 1;

    // Make this globally available so the HTML buttons can click it
    window.changePage = (newPage, totalPages) => {
        // Stop them from clicking "Previous" on page 1, or "Next" on the last page
        if (newPage < 1 || newPage > totalPages) return; 

        currentPage = newPage;
        loadJobs(currentFilters, currentPage);
        
        // Smoothly scroll the user back to the top of the feed
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    // Find all the filter inputs in your sidebar (Assuming you gave them a class like 'filter-input')
    // Alternatively, you can target specific IDs if you used them in your HTML
    const filterInputs = document.querySelectorAll('.filter-checkbox, .filter-radio');

    filterInputs.forEach(input => {
        input.addEventListener('change', () => {
            // Reset to page 1 whenever a new filter is applied
            currentPage = 1; 
            currentFilters = {};

            // Example: Check which Experience Level radio is selected
            const expLevelChecked = document.querySelector('input[name="experienceLevel"]:checked');
            if (expLevelChecked && expLevelChecked.value !== 'All') {
                currentFilters.experienceLevel = expLevelChecked.value;
            }

            // Example: Check Location
            const locationChecked = document.querySelector('input[name="location"]:checked');
            if (locationChecked && locationChecked.value !== 'All') {
                currentFilters.location = locationChecked.value;
            }

            // Fetch the newly filtered data
            loadJobs(currentFilters, currentPage);
        });
    });

    // Execute the very first fetch on page load with no filters
    loadJobs(currentFilters, currentPage);

});

// exposed function for Apply buttons
window.handleApplyClick = function () {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');

    if (mode === 'registered') {
        // Go to Job Details (Registered View)
        window.location.href = 'job-details.html?mode=registered';
    } else {
        // Redirect to Sign Up / Onboarding
        window.location.href = '../Login and authentification/SIgn up.html';
    }
};

// Helper for User to switch modes via console
window.switchMode = function (mode) {
    if (mode === 'registered' || mode === 'guest') {
        const url = new URL(window.location);
        url.searchParams.set('mode', mode);
        window.location.href = url.toString();
        console.log("Switching to " + mode + " mode...");
    } else {
        console.warn("Invalid mode. Use 'registered' or 'guest'.");
    }
};
