document.addEventListener('DOMContentLoaded', () => {

    // --- Profile Data Fetching Logic ---
    const loadUserProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                window.location.href = '../Login and authentification/login.html';
                return;
            }

            const response = await fetch('http://localhost:5000/api/users/me', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to fetch profile data');

            const user = await response.json();

            // 1. Populate Personal Info
            document.getElementById('emailInput').value = user.email || '';
            document.getElementById('firstNameInput').value = user.firstName || '';
            document.getElementById('lastNameInput').value = user.lastName || '';
            document.getElementById('displayNameInput').value = user.displayName || `${user.firstName} ${user.lastName}`;

            // 2. Populate Profile Info
            document.getElementById('bioInput').value = user.shortBio || 'No bio provided yet.';
            document.getElementById('roleInput').value = user.department || 'Student'; // Or skillProficiency

            // 3. Update Profile Initials
            const initials = ((user.firstName?.[0] || 'S') + (user.lastName?.[0] || '')).toUpperCase();
            const initialsDiv = document.getElementById('profileInitials');
            if(initialsDiv) {
                // Be careful to keep the edit icon inside the div!
                initialsDiv.innerHTML = `${initials} <div class="edit-pic-icon"><i class="bi bi-pencil-fill"></i></div>`;
            }

        } catch (error) {
            console.error('Error loading profile:', error);
            // Optional: Show a small error toast/alert to the user here
        }
        // 4. Populate Account Info
    document.getElementById('skillProficiencyInput').value = user.skillProficiency || 'Beginner';
    document.getElementById('hoursPerWeekInput').value = user.hoursPerWeek || '0 - 10 hours';
    document.getElementById('workTypeInput').value = user.preferredWorkType || 'Remote';
    document.getElementById('hourlyRangeInput').value = user.hourlyRange || 'N1500 - N2500';

    // 5. Populate Academic Info
    document.getElementById('departmentInput').value = user.department || 'Not specified';
    document.getElementById('yearOfStudyInput').value = user.yearOfStudy || '100 Level';
    document.getElementById('graduationYearInput').value = user.expectedGraduation || 'Not specified';
    
    // 6. Check Linked Accounts (Visual toggle based on DB booleans)
    const githubStatus = document.querySelector('.bi-github').nextElementSibling.querySelector('.text-secondary');
    githubStatus.textContent = user.githubConnected ? 'Connected.' : 'Not connected.';
    };
    
document.querySelector('.btn-connect-github').addEventListener('click', async () => {
    // Decode the JWT to get the user's ID (or fetch it from your /me route)
    const userId = getUserIdFromSomewhere(); 
    
    // Redirect the browser entirely to your Express OAuth route
    window.location.href = `http://localhost:5000/api/auth/github?userId=${userId}`;
});

    // Execute the fetch as soon as the page loads
    loadUserProfile();

    // --- Tab Switching Logic ---
    const tabButtons = document.querySelectorAll('.settings-tab');
    const tabContents = document.querySelectorAll('.tab-content');

    // function to switch tab
    const switchTab = (targetTab) => {
        // Remove active class from all buttons
        tabButtons.forEach(b => {
            b.classList.remove('active');
            if (b.getAttribute('data-tab') === targetTab) b.classList.add('active');
        });

        // Hide all tab contents
        tabContents.forEach(content => content.classList.add('d-none'));

        // Show target tab content
        const targetContent = document.getElementById(`tab-${targetTab}`);
        if (targetContent) targetContent.classList.remove('d-none');

        // Save to localStorage
        localStorage.setItem('activeSettingsTab', targetTab);
    };

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });

    // Check localStorage on load
    const savedTab = localStorage.getItem('activeSettingsTab');
    if (savedTab) {
        switchTab(savedTab);
    }
// Save Profile Data to Backend
    const saveProfileData = async (sectionId) => {
        const token = localStorage.getItem('token');
        if (!token) return;

        // Prepare the payload based on which section is being saved
        let payload = {};

        if (sectionId === 'section-my-profile') {
            payload = {
                shortBio: document.getElementById('bioInput').value,
                skillProficiency: document.getElementById('roleInput').value
            };
        } else if (sectionId === 'section-personal-info') {
            payload = {
                firstName: document.getElementById('firstNameInput').value,
                lastName: document.getElementById('lastNameInput').value,
                displayName: document.getElementById('displayNameInput').value
            };
            } else if (sectionId === 'section-account-info') {
        payload = {
            skillProficiency: document.getElementById('skillProficiencyInput').value,
            hoursPerWeek: document.getElementById('hoursPerWeekInput').value,
            preferredWorkType: document.getElementById('workTypeInput').value,
            hourlyRange: document.getElementById('hourlyRangeInput').value
        };
    } else if (sectionId === 'section-academic-info') {
        payload = {
            department: document.getElementById('departmentInput').value,
            yearOfStudy: document.getElementById('yearOfStudyInput').value,
            expectedGraduation: document.getElementById('graduationYearInput').value
        };
    
        }

        try {
            const response = await fetch('http://localhost:5000/api/users/me', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Failed to update profile');

            const updatedUser = await response.json();
            console.log('Profile updated successfully:', updatedUser);
            
            // Optional: You could show a success toast/alert here
            
        } catch (error) {
            console.error('Error saving profile:', error);
            alert("Failed to save changes. Please try again.");
        }
    };
    // --- Profile Editing Logic ---
    window.toggleEdit = async function (sectionId) {
        const section = document.getElementById(sectionId);
        if (!section) return;

        const inputs = section.querySelectorAll('input, textarea');
        const btnIcon = section.querySelector('.btn-edit i');

        // Check state based on first input
        const isCurrentlyReadonly = inputs[0].hasAttribute('readonly');

        if (isCurrentlyReadonly) {
            // Enable Edit Mode
            inputs.forEach(input => {
                input.removeAttribute('readonly');
                input.classList.add('bg-white'); 
            });
            btnIcon.classList.remove('bi-pencil-square');
            btnIcon.classList.add('bi-check-lg');
            btnIcon.style.color = 'green';
            inputs[0].focus();
        } else {
            // Save Data to Database First
            await saveProfileData(sectionId); // <--- TRIGGER THE API CALL HERE

            // Disable Edit Mode (Lock it back up)
            inputs.forEach(input => {
                input.setAttribute('readonly', true);
                input.classList.remove('bg-white');
            });
            btnIcon.classList.remove('bi-check-lg');
            btnIcon.classList.add('bi-pencil-square');
            btnIcon.style.color = '';
        }
    };

    // --- Payout Account Logic ---
    const btnSaveAccount = document.getElementById('btn-save-account');
    const btnAddAccountConfirm = document.getElementById('btn-add-account-confirm');
    const payoutEmptyState = document.getElementById('payout-empty-state');
    const payoutList = document.getElementById('payout-list');
    const payoutModalEl = document.getElementById('payoutModal');
    let payoutModal = null;

    if (payoutModalEl) {
        payoutModal = new bootstrap.Modal(payoutModalEl);
    }

    // Helper to render list
    const renderPayoutList = () => {
        const accounts = JSON.parse(localStorage.getItem('payoutAccounts')) || [];

        if (accounts.length === 0) {
            payoutEmptyState.classList.remove('d-none');
            payoutList.classList.add('d-none');
            payoutList.innerHTML = '';
        } else {
            payoutEmptyState.classList.add('d-none');
            payoutList.classList.remove('d-none');

            payoutList.innerHTML = accounts.map((acc, index) => `
                <div class="payout-item" data-index="${index}">
                    <div class="bank-info">
                        <input type="radio" class="radio-select" name="payoutAcc" ${index === 0 ? 'checked' : ''}>
                        <div class="bank-icon">
                            <i class="bi bi-bank"></i> 
                        </div>
                        <div>
                            <div class="fw-bold" style="font-size:14px; display:flex; align-items:center;">
                                ${acc.name} <span class="badge-default">Default</span>
                            </div>
                            <div class="text-secondary" style="font-size:13px; font-weight:500;">
                                ${acc.bank} <i class="bi bi-dot"></i> ${acc.last4}
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-sm text-secondary border-0 btn-delete-payout"><i class="bi bi-trash"></i></button>
                </div>
            `).join('');
        }
    };

    // Initial Render
    renderPayoutList();

    const addAccountAction = () => {
        // Collect Data
        const bankName = document.getElementById('bankSelect').value;
        const accNum = document.getElementById('accNumInput').value;
        const accName = document.getElementById('accNameInput').value;
        const last4 = accNum.slice(-4);

        if (accNum.length < 4) {
            alert("Please enter a valid account number");
            return;
        }

        const newAccount = {
            bank: bankName,
            number: accNum,
            last4: last4,
            name: accName
        };

        // Save to LocalStorage
        const accounts = JSON.parse(localStorage.getItem('payoutAccounts')) || [];
        accounts.push(newAccount);
        localStorage.setItem('payoutAccounts', JSON.stringify(accounts));

        // Render
        renderPayoutList();

        // Close Modal
        if (payoutModal) payoutModal.hide();

        // Reset form (optional)
        document.getElementById('accNumInput').value = '';
        document.getElementById('accNameInput').value = '';
    };

    if (btnSaveAccount) btnSaveAccount.addEventListener('click', addAccountAction);
    if (btnAddAccountConfirm) btnAddAccountConfirm.addEventListener('click', addAccountAction);

    // --- Payout Deletion Logic ---
    if (payoutList) {
        payoutList.addEventListener('click', (e) => {
            // Find closest delete button
            const deleteBtn = e.target.closest('.btn-delete-payout');
            if (deleteBtn) {
                if (confirm('Are you sure you want to remove this payout account?')) {
                    const item = deleteBtn.closest('.payout-item');
                    const index = item.getAttribute('data-index');

                    // Remove from LS
                    const accounts = JSON.parse(localStorage.getItem('payoutAccounts')) || [];
                    accounts.splice(index, 1);
                    localStorage.setItem('payoutAccounts', JSON.stringify(accounts));

                    // Re-render
                    renderPayoutList();
                }
            }
        });
    }

});
