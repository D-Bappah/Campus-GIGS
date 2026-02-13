document.addEventListener('DOMContentLoaded', function () {
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
