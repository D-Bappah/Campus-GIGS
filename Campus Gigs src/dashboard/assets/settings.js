document.addEventListener('DOMContentLoaded', () => {

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

    // --- Profile Editing Logic ---
    window.toggleEdit = function (sectionId) {
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
                input.classList.add('bg-white'); // specific visual cue if needed
            });
            btnIcon.classList.remove('bi-pencil-square');
            btnIcon.classList.add('bi-check-lg');
            btnIcon.style.color = 'green';
            inputs[0].focus();
        } else {
            // Save / Disable Edit Mode
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
