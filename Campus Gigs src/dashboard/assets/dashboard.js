document.addEventListener('DOMContentLoaded', function () {
    // State Management
    const incompleteView = document.getElementById('incompleteView');
    const completeView = document.getElementById('completeView');

    // Default to Incomplete
    let isComplete = false;

    // Function exposed to global window object for manual testing/state switching
    // Usage: window.setDashboardState('complete') or window.setDashboardState('incomplete')
    window.setDashboardState = function (state) {
        if (state === 'complete') {
            isComplete = true;
            incompleteView.classList.add('d-none');
            completeView.classList.remove('d-none');
            console.log("Dashboard state set to: Complete");
        } else {
            isComplete = false;
            completeView.classList.add('d-none');
            incompleteView.classList.remove('d-none');
            console.log("Dashboard state set to: Incomplete");
        }
    };

    // Initialize View
    window.setDashboardState('incomplete');

    // Dynamic Date
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
        const options = { weekday: 'long', day: 'numeric', month: 'long' };
        // const today = new Date();
        // dateElement.textContent = today.toLocaleDateString('en-US', options);
    }

    // Dynamic User Info
    const updateUserInfo = () => {
        try {
            const userData = JSON.parse(localStorage.getItem('onboardingData') || '{}');
            if (userData.personal) {
                const { firstName, lastName } = userData.personal;
                const fullName = `${firstName} ${lastName}`;

                const greetingIncomplete = document.getElementById('greeting-incomplete');
                const greetingComplete = document.getElementById('greeting-complete');
                const nameDisplay = document.getElementById('user-name-display');

                // Greeting logic
                const hour = new Date().getHours();
                const greeting = hour < 12 ? 'Good Morning!' : hour < 18 ? 'Good Afternoon!' : 'Good Evening!';

                // Update Greetings (Using First Name for a personal touch)
                if (greetingIncomplete) greetingIncomplete.textContent = `${greeting} ${firstName},`;
                if (greetingComplete) greetingComplete.textContent = `${greeting} ${firstName},`;

                // Update Name Card (Using Full Name)
                if (nameDisplay) nameDisplay.textContent = fullName;
            }
        } catch (e) {
            console.error('Error loading user info:', e);
        }
    };

    updateUserInfo();
});
