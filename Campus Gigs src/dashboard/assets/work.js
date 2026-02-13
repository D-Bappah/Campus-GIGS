document.addEventListener('DOMContentLoaded', () => {

    // --- Work List Logic (work.html) ---
    const filterLinks = document.querySelectorAll('.sidebar-link');
    const contractItems = document.querySelectorAll('#contract-list > div'); // The cols containing cards

    if (filterLinks.length > 0) {
        filterLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();

                // Update Active State
                filterLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                const filter = link.getAttribute('data-filter');

                contractItems.forEach(item => {
                    const status = item.getAttribute('data-status');
                    if (filter === 'all' || status === filter) {
                        item.classList.remove('d-none');
                    } else {
                        item.classList.add('d-none');
                    }
                });
            });
        });
    }

    // --- Contract Details Logic (contract-details.html) ---
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('sig-file-input');
    const btnConfirmUpload = document.getElementById('btn-confirm-upload');
    let currentUploadTarget = null; // 'your' or 'client'
    let selectedFile = null;

    // Permissions: Change this to 'client' to test client view
    const USER_ROLE = 'freelancer'; // Options: 'freelancer', 'client'

    // Initial permission check on page load
    const btnFreelancer = document.getElementById('btn-upload-freelancer');
    const btnClient = document.getElementById('btn-upload-client');

    if (btnFreelancer && btnClient) {
        if (USER_ROLE === 'freelancer') {
            btnClient.disabled = true;
            btnClient.style.opacity = '0.5';
            btnClient.style.cursor = 'not-allowed';
            btnClient.title = 'Only the client can upload here';
        } else if (USER_ROLE === 'client') {
            btnFreelancer.disabled = true;
            btnFreelancer.style.opacity = '0.5';
            btnFreelancer.style.cursor = 'not-allowed';
            btnFreelancer.title = 'Only the freelancer can upload here';
        }
    }

    window.openSignatureModal = (target) => {
        // Double check permissions
        if (USER_ROLE === 'freelancer' && target === 'client') {
            alert("Access Denied: Only the client can upload this signature.");
            return;
        }
        if (USER_ROLE === 'client' && target === 'your') {
            alert("Access Denied: Only the freelancer can upload this signature.");
            return;
        }

        currentUploadTarget = target;
        selectedFile = null;
        if (btnConfirmUpload) {
            btnConfirmUpload.disabled = true;
            btnConfirmUpload.classList.remove('btn-primary', 'text-white');
            btnConfirmUpload.classList.add('btn-light', 'text-secondary');
        }

        // Reset modal UI if needed
        const modalEl = document.getElementById('signatureModal');
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    };

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                selectedFile = e.target.files[0];
                btnConfirmUpload.disabled = false;
                btnConfirmUpload.classList.remove('btn-light', 'text-secondary');
                btnConfirmUpload.classList.add('btn-primary', 'text-white');
            }
        });
    }

    if (btnConfirmUpload) {
        btnConfirmUpload.addEventListener('click', () => {
            if (!selectedFile || !currentUploadTarget) return;

            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target.result;
                const targetAreaId = currentUploadTarget === 'your' ? 'your-sig-area' : 'client-sig-area';
                const targetArea = document.getElementById(targetAreaId);

                if (targetArea) {
                    targetArea.innerHTML = `<img src="${result}" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
                }

                // Close Modal
                const modalEl = document.getElementById('signatureModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                modal.hide();
            };
            reader.readAsDataURL(selectedFile);
        });
    }

});
