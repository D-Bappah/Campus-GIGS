document.addEventListener('DOMContentLoaded', () => {
    // 1. Declare global ID variable at the very top
    let currentUserId = null;

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
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to fetch profile data');

            const user = await response.json();
            currentUserId = user._id; // Save the ID immediately for the OAuth button

            // Populate Personal Info (With safety checks using 'if')
            if(document.getElementById('emailInput')) document.getElementById('emailInput').value = user.email || '';
            if(document.getElementById('firstNameInput')) document.getElementById('firstNameInput').value = user.firstName || '';
            if(document.getElementById('lastNameInput')) document.getElementById('lastNameInput').value = user.lastName || '';
            if(document.getElementById('displayNameInput')) document.getElementById('displayNameInput').value = user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim();

            // Populate Profile Info
            if(document.getElementById('bioInput')) document.getElementById('bioInput').value = user.shortBio || 'No bio provided yet.';
            if(document.getElementById('roleInput')) document.getElementById('roleInput').value = user.skillProficiency || 'Student';

            // Populate Account Info
            if(document.getElementById('skillProficiencyInput')) document.getElementById('skillProficiencyInput').value = user.skillProficiency || 'Beginner';
            if(document.getElementById('hoursPerWeekInput')) document.getElementById('hoursPerWeekInput').value = user.hoursPerWeek || '0 - 10 hours';
            if(document.getElementById('workTypeInput')) document.getElementById('workTypeInput').value = user.preferredWorkType || 'Remote';
            if(document.getElementById('hourlyRangeInput')) document.getElementById('hourlyRangeInput').value = user.hourlyRange || 'N1500 - N2500';

            // Populate Academic Info
            if(document.getElementById('departmentInput')) document.getElementById('departmentInput').value = user.department || 'Not specified';
            if(document.getElementById('yearOfStudyInput')) document.getElementById('yearOfStudyInput').value = user.yearOfStudy || '100 Level';
            if(document.getElementById('graduationYearInput')) document.getElementById('graduationYearInput').value = user.expectedGraduation || 'Not specified';

            // Update GitHub UI
            const githubStatusText = document.getElementById('githubStatusText');
            const btnGithubAction = document.getElementById('btnGithubAction');
            
            if (githubStatusText && btnGithubAction) {
                if (user.githubConnected) {
                    githubStatusText.textContent = 'Connected. You can sign in using your GitHub account.';
                    btnGithubAction.textContent = 'Disconnect';
                    btnGithubAction.classList.add('btn-disconnect');
                    btnGithubAction.classList.remove('btn-primary');
                } else {
                    githubStatusText.textContent = 'Not connected.';
                    btnGithubAction.textContent = 'Connect';
                    btnGithubAction.classList.remove('btn-disconnect');
                    btnGithubAction.classList.add('btn-primary', 'btn-sm');
                }
            }

            // Update Profile Initials
            const initials = ((user.firstName?.[0] || 'S') + (user.lastName?.[0] || '')).toUpperCase();
            const initialsDiv = document.getElementById('profileInitials');
            if(initialsDiv) {
                initialsDiv.innerHTML = `${initials} <div class="edit-pic-icon"><i class="bi bi-pencil-fill"></i></div>`;
            }

        } catch (error) {
            console.error('Error loading profile:', error);
        }
    };

    // Execute the fetch immediately
    loadUserProfile();

    // --- Save Profile Data to Backend ---
    const saveProfileData = async (sectionId) => {
        const token = localStorage.getItem('token');
        if (!token) return;

        let payload = {};

        if (sectionId === 'section-my-profile') {
            payload = {
                shortBio: document.getElementById('bioInput')?.value,
                skillProficiency: document.getElementById('roleInput')?.value
            };
        } else if (sectionId === 'section-personal-info') {
            payload = {
                firstName: document.getElementById('firstNameInput')?.value,
                lastName: document.getElementById('lastNameInput')?.value,
                displayName: document.getElementById('displayNameInput')?.value
            };
        } else if (sectionId === 'section-account-info') {
            payload = {
                skillProficiency: document.getElementById('skillProficiencyInput')?.value,
                hoursPerWeek: document.getElementById('hoursPerWeekInput')?.value,
                preferredWorkType: document.getElementById('workTypeInput')?.value,
                hourlyRange: document.getElementById('hourlyRangeInput')?.value
            };
        } else if (sectionId === 'section-academic-info') {
            payload = {
                department: document.getElementById('departmentInput')?.value,
                yearOfStudy: document.getElementById('yearOfStudyInput')?.value,
                expectedGraduation: document.getElementById('graduationYearInput')?.value
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
        } catch (error) {
            console.error('Error saving profile:', error);
            alert("Failed to save changes. Please try again.");
        }
    };

    // --- Profile Editing Logic (Pencil/Checkmark Toggle) ---
    window.toggleEdit = async function (sectionId) {
        const section = document.getElementById(sectionId);
        if (!section) return;

        const inputs = section.querySelectorAll('input, textarea');
        if (inputs.length === 0) return; // Stop if no inputs are found
        
        const btnIcon = section.querySelector('.btn-edit i');
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
            // Save Data to Database
            await saveProfileData(sectionId);

            // Lock the inputs back up
            inputs.forEach(input => {
                input.setAttribute('readonly', true);
                input.classList.remove('bg-white');
            });
            btnIcon.classList.remove('bi-check-lg');
            btnIcon.classList.add('bi-pencil-square');
            btnIcon.style.color = '';
        }
    };

    // --- GitHub Button Logic ---
    const btnGithubAction = document.getElementById('btnGithubAction');
    if (btnGithubAction) {
        btnGithubAction.addEventListener('click', () => {
            if (btnGithubAction.textContent === 'Connect') {
                if (currentUserId) {
                    window.location.href = `http://localhost:5000/api/auth/github?userId=${currentUserId}`;
                } else {
                    alert("Profile is still loading. Please wait a second.");
                }
            } else {
                if(confirm("Are you sure you want to disconnect your GitHub account?")) {
                    alert("Disconnect functionality coming soon!"); 
                }
            }
        });
    }

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
            const deleteBtn = e.target.closest('.btn-delete-payout');
            if (deleteBtn) {
                if (confirm('Are you sure you want to remove this payout account?')) {
                    const item = deleteBtn.closest('.payout-item');
                    const index = item.getAttribute('data-index');
                    const accounts = JSON.parse(localStorage.getItem('payoutAccounts')) || [];
                    accounts.splice(index, 1);
                    localStorage.setItem('payoutAccounts', JSON.stringify(accounts));
                    renderPayoutList();
                }
            }
        });
    }

    // --- Notification Preferences ---
    const NOTIF_KEY = 'notificationPrefs';
    const notifCheckboxIds = ['jobOffers', 'appStatus', 'jobProgress', 'noNotifyMe', 'newMsg', 'msgMention', 'payApproved', 'paySent', 'payoutCompleted'];

    const loadNotifPrefs = () => {
        const saved = JSON.parse(localStorage.getItem(NOTIF_KEY)) || {};
        notifCheckboxIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.checked = saved[id] ?? false;
        });
    };

    const saveNotifPrefs = () => {
        const prefs = {};
        notifCheckboxIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) prefs[id] = el.checked;
        });
        localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
    };

    loadNotifPrefs();
    notifCheckboxIds.forEach(id => {
        document.getElementById(id)?.addEventListener('change', saveNotifPrefs);
    });

});
