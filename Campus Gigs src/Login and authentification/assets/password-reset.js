document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('resetForm');
    const newPw = document.getElementById('newPassword');
    const confirmPw = document.getElementById('confirmPassword');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (newPw.value !== confirmPw.value) return alert("Passwords do not match!");
        if (newPw.value.length < 6) return alert("Password too short (min 6 chars).");

        alert("Password reset successful!");
        sessionStorage.removeItem('resetFlow');
        window.location.href = 'login.html';
    });
});
