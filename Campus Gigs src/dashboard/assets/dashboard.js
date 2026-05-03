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
   const updateUserInfo = async () => {
    try {
        // 1. Get the token we saved during login
        const token = localStorage.getItem('token');
        
        if (!token) {
            console.log("No token found, redirecting to login...");
            window.location.href = '../Login and authentification/login.html';
            return;
        }

        // 2. Fetch real data from your new API route
        const response = await fetch('http://localhost:5000/api/users/me', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // <--- Passing the token here!
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch user data');
        }

        const userData = await response.json();

        // Update the UI with real data
        const firstName = userData.firstName || 'Student'; // Fallback if name is missing
        const lastName = userData.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim();
        const role = userData.department || 'Student'; // Or wherever you store "UI/UX Designer"

        const greetingIncomplete = document.getElementById('greeting-incomplete');
        const greetingComplete = document.getElementById('greeting-complete');
        const nameDisplay = document.getElementById('user-name-display');

        // Greeting logic
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good Morning!' : hour < 18 ? 'Good Afternoon!' : 'Good Evening!';

        // Update UI Elements
        if (greetingIncomplete) greetingIncomplete.textContent = `${greeting} ${firstName},`;
        if (greetingComplete) greetingComplete.textContent = `${greeting} ${firstName},`;
        if (nameDisplay) nameDisplay.textContent = fullName;
        
        // If you have a role element on the dashboard, update it too
        const roleDisplay = document.querySelector('.card-action .text-secondary');
        if(roleDisplay && userData.skillProficiency) {
            roleDisplay.textContent = userData.skillProficiency;
        }

    } catch (e) {
        console.error('Error loading user info:', e);
        // If the token is expired or invalid, force them to log in again
        localStorage.removeItem('token');
        window.location.href = '../Login and authentification/login.html';
    }
};

    updateUserInfo();
});
