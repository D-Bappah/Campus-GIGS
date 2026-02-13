document.addEventListener('DOMContentLoaded', function () {
    const notificationBtn = document.getElementById('notificationBtn');

    // Create the popup element programmatically if it doesn't strictly exist in HTML 
    // OR we expect it to be there. 
    // Based on plan, we are adding the HTML to each page. 
    // BUT we can also inject it via JS to make it easier to maintain?
    // The plan said "Implement popup in dashboard.html...". 
    // Let's stick to the plan: HTML is in the file, logic is here.

    const popup = document.getElementById('notificationPopup');

    if (notificationBtn && popup) {
        notificationBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            popup.classList.toggle('show');
        });

        // Close when clicking outside
        document.addEventListener('click', function (e) {
            if (!popup.contains(e.target) && !notificationBtn.contains(e.target)) {
                popup.classList.remove('show');
            }
        });

        // Close when pressing Escape
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                popup.classList.remove('show');
            }
        });
    }
});
