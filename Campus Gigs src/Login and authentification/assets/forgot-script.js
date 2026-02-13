document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('forgotForm');
  const emailVal = () => document.getElementById('email').value.trim();

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!emailVal()) return alert("Please enter your email.");

      sessionStorage.setItem('resetFlow', 'true');
      window.location.href = 'verify.html';
    });
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();

    const res = await fetch('http://localhost:5000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
    });

    if (res.ok) {
        // Store email temporarily so we know who we are verifying next
        sessionStorage.setItem('resetEmail', email); 
        window.location.href = 'verify.html';
    } else {
        alert("Email not found");
    }
});
});
