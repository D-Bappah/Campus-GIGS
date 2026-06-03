document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('forgotForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value.trim();
        if (!email) return alert('Please enter your email.');

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        try {
            const res = await fetch('http://localhost:5000/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();

            if (res.ok) {
                sessionStorage.setItem('resetEmail', email);
                window.location.href = 'verify.html';
            } else {
                alert(data.message || 'Email not found.');
            }
        } catch {
            alert('Connection failed. Is the server running?');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Reset Code';
        }
    });
});
