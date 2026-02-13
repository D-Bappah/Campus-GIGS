document.addEventListener('DOMContentLoaded', () => {
    // Withdrawal Logic
    const btnWithdrawTrigger = document.getElementById('btn-withdraw-trigger');
    const withdrawFundsModalEl = document.getElementById('withdrawFundsModal');
    const withdrawalSuccessModalEl = document.getElementById('withdrawalSuccessModal');
    const btnConfirmWithdraw = document.getElementById('btn-confirm-withdraw');

    let withdrawFundsModal; // Bootstrap modal instance
    let withdrawalSuccessModal; // Bootstrap modal instance

    if (withdrawFundsModalEl) {
        withdrawFundsModal = new bootstrap.Modal(withdrawFundsModalEl);
    }

    if (withdrawalSuccessModalEl) {
        withdrawalSuccessModal = new bootstrap.Modal(withdrawalSuccessModalEl);
    }

    // Open first modal Logic
    if (btnWithdrawTrigger) {
        btnWithdrawTrigger.addEventListener('click', () => {
            // 1. Check for Payout Accounts in LocalStorage
            const payoutAccounts = JSON.parse(localStorage.getItem('payoutAccounts')) || [];

            if (payoutAccounts.length === 0) {
                // No account -> Redirect to Settings
                // We can use the 'activeSettingsTab' key from settings.js to ensure the tab opens.
                localStorage.setItem('activeSettingsTab', 'payout');
                window.location.href = 'settings.html';
            } else {
                // Account exists -> Populate Modal & Show
                populateWithdrawalModal(payoutAccounts);
                if (withdrawFundsModal) withdrawFundsModal.show();
            }
        });
    }

    function populateWithdrawalModal(accounts) {
        const accountListContainer = document.querySelector('#withdrawFundsModal .payout-account-list');

        // Clear previous content
        if (!accountListContainer) return; // Guard clause
        accountListContainer.innerHTML = '';

        // Generate HTML
        const accountsHTML = accounts.map((acc, index) => `
            <div class="col-md-6 mb-3">
                <label class="payout-option border rounded-3 p-3 d-flex gap-3 align-items-center cursor-pointer w-100 h-100">
                    <input type="radio" name="payoutAccount" class="form-check-input mt-0" ${index === 0 ? 'checked' : ''} value="${index}">
                    <div>
                        <div class="small text-secondary">${acc.name}</div>
                        <div class="fw-bold d-flex align-items-center gap-2">
                            <span class="text-warning"><i class="bi bi-bank2"></i></span> ${acc.bank} •••• ${acc.last4}
                        </div>
                    </div>
                </label>
            </div>
        `).join('');

        accountListContainer.innerHTML = `<div class="row">${accountsHTML}</div>`;

        // Re-attach styling listeners
        attachRadioListeners();
    }

    // Handle "Withdraw" confirmation
    if (btnConfirmWithdraw) {
        btnConfirmWithdraw.addEventListener('click', () => {
            if (withdrawFundsModal) {
                withdrawFundsModal.hide();
            }

            // Show success modal after a brief delay
            setTimeout(() => {
                if (withdrawalSuccessModal) {
                    withdrawalSuccessModal.show();
                }
            }, 500);
        });
    }

    // Payout Account Selection Styling
    function attachRadioListeners() {
        const payoutOptions = document.querySelectorAll('.payout-option input[type="radio"]');

        function updateSelectionStyles() {
            payoutOptions.forEach(radio => {
                const label = radio.closest('.payout-option');
                if (radio.checked) {
                    label.classList.add('border-primary', 'bg-light');
                    label.classList.remove('border-secondary-subtle');
                } else {
                    label.classList.remove('border-primary', 'bg-light');
                    label.classList.add('border-secondary-subtle');
                }
            });
        }

        // Initialize styles
        updateSelectionStyles();

        // Add listeners
        payoutOptions.forEach(radio => {
            radio.addEventListener('change', updateSelectionStyles);
        });
    }
});
