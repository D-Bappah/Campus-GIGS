document.addEventListener('DOMContentLoaded', async () => {
    // 1. GRAB THE JOB ID FROM THE URL (e.g., job-details.html?id=12345abcde)
    const urlParams = new URLSearchParams(window.location.search);
    const jobId = urlParams.get('id');

    // If there is no ID in the URL, someone navigated here by accident
    if (!jobId) {
        document.getElementById('job-title').textContent = "Error: No Job Selected.";
        document.getElementById('job-description').textContent = "Please go back to the Browse Jobs feed and select a valid gig.";
        return;
    }

    try {
        // 2. FETCH THE JOB DATA FROM YOUR MONGODB BACKEND
        const response = await fetch(`http://localhost:5000/api/jobs/${jobId}`);
        
        if (!response.ok) throw new Error("Job not found");
        const job = await response.json();

        // 3. INJECT THE REAL DATA INTO YOUR HTML
        document.getElementById('job-title').textContent = job.title;
        document.getElementById('job-description').textContent = job.description;
        document.getElementById('job-category').textContent = job.category;
        
        // Status Badge (Green for open, gray for anything else)
        const statusBadge = document.getElementById('job-status-badge');
        if (statusBadge) {
            statusBadge.textContent = job.status.toUpperCase();
            statusBadge.className = `badge ${job.status === 'open' ? 'bg-success' : 'bg-secondary'}`;
        }

        // Application Count
        const countEl = document.getElementById('job-application-count');
        if (countEl) countEl.textContent = `${job.applicationCount || 0} Proposals submitted`;

        // Skills Tags
        const skillsContainer = document.getElementById('job-skills');
        if (skillsContainer) {
            if (job.skills && job.skills.length > 0) {
                skillsContainer.innerHTML = job.skills.map(s => `<span class="job-tag me-1">${s}</span>`).join('');
            } else {
                skillsContainer.innerHTML = '<span class="text-muted">No specific skills required</span>';
            }
        }

        // Client Info (The person who posted the gig)
        if (job.postedBy) {
            document.getElementById('client-name').textContent = job.postedBy.name || 'Unknown Client';
            document.getElementById('client-university').textContent = job.postedBy.university || 'No university listed';
            const avatar = document.getElementById('client-avatar');
            if (avatar && job.postedBy.avatarUrl) avatar.src = job.postedBy.avatarUrl;
        }

        // Meta Grid (Budget, Delivery Days, Posted Date)
        const formattedBudget = `₦${(job.budget / 100).toLocaleString()}`; // Convert Kobo to Naira
        document.getElementById('job-budget').textContent = formattedBudget;
        document.getElementById('job-delivery-days').textContent = `${job.deliveryDays} Days`;
        
        const postedDate = new Date(job.createdAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' });
        document.getElementById('job-posted-date').textContent = postedDate;

        // ==========================================================
        // 4. THE APPLY BUTTON LOGIC
        // ==========================================================
        const applyBtn = document.getElementById('apply-btn');
        const applyMessage = document.getElementById('apply-message');
        
        if (applyBtn) {
            // Check if the job is closed
            if (job.status !== 'open') {
                applyBtn.disabled = true;
                applyBtn.textContent = "Position Closed";
                if (applyMessage) applyMessage.textContent = "This gig is no longer accepting applications.";
                return;
            }

            // Make the button clickable
            applyBtn.addEventListener('click', () => {
                const token = localStorage.getItem('token');
                
                if (!token) {
                    // Kick them to login if they aren't registered
                    window.location.href = '../Login and authentification/login.html'; 
                } else {
                    // Send them to the application form WITH the Job ID attached!
                    window.location.href = `job-application.html?id=${job._id}`;
                }
            });
        }

    } catch (err) {
        console.error("Fetch Error:", err);
        document.getElementById('job-title').textContent = "Job Not Found";
        document.getElementById('job-description').textContent = "This job may have been deleted, or the server is offline.";
        document.getElementById('apply-btn').disabled = true;
    }
});