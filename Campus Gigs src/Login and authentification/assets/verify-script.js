document.addEventListener('DOMContentLoaded', () => {
    const API = 'http://localhost:5000/api/auth';
    const inputs = document.querySelectorAll('.otp-input');
    const form = document.getElementById('verifyForm');
    const timerEl = document.getElementById('timer');
    const resendBtn = document.getElementById('resendBtn');

    const email = sessionStorage.getItem('pendingEmail') || sessionStorage.getItem('resetEmail');
    const isResetFlow = !!sessionStorage.getItem('resetEmail');

    if (!email) {
        alert('Session expired. Please sign up again.');
        window.location.href = 'SIgn up.html';
        return;
    }

    // Auto-advance and backspace logic
    inputs.forEach((input, i) => {
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
            if (e.target.value && i < inputs.length - 1) inputs[i + 1].focus();
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && i > 0) inputs[i - 1].focus();
        });
    });

    // Resend timer
    let timeLeft = 60;
    const startTimer = () => {
        timeLeft = 60;
        resendBtn.classList.add('disabled');
        resendBtn.style.pointerEvents = 'none';
        const interval = setInterval(() => {
            timerEl.textContent = --timeLeft;
            if (timeLeft <= 0) {
                clearInterval(interval);
                resendBtn.classList.remove('disabled');
                resendBtn.style.pointerEvents = 'auto';
            }
        }, 1000);
    };
    startTimer();

    resendBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (resendBtn.classList.contains('disabled')) return;

        try {
            const endpoint = isResetFlow ? '/forgot-password' : '/resend-otp';
            const res = await fetch(`${API}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            alert(data.message || 'New code sent.');
            inputs.forEach(i => i.value = '');
            inputs[0].focus();
            startTimer();
        } catch {
            alert('Failed to resend. Check your connection.');
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const otp = Array.from(inputs).map(i => i.value).join('');
        if (otp.length !== 6) return alert('Enter the full 6-digit code.');

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Verifying...';

        try {
            const endpoint = isResetFlow ? '/verify-otp' : '/verify-email';
            const res = await fetch(`${API}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp })
            });
            const data = await res.json();

            if (res.ok) {
                if (isResetFlow) {
                    window.location.href = 'password-reset.html';
                } else {
                    sessionStorage.removeItem('pendingEmail');
                    alert('Email verified! You can now log in.');
                    window.location.href = 'login.html';
                }
            } else {
                alert(data.message || 'Verification failed.');
            }
        } catch {
            alert('Connection failed. Is the server running?');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Continue';
        }
    });
});
