document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('.otp-input');
  const form = document.getElementById('verifyForm');
  const timerEl = document.getElementById('timer');
  const resendBtn = document.getElementById('resendBtn');
  let timeLeft = 60;

  // Auto-focus and navigation logic
  inputs.forEach((input, i) => {
    input.addEventListener('input', (e) => {
      if (e.target.value && i < inputs.length - 1) inputs[i + 1].focus();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && i > 0) inputs[i - 1].focus();
    });

    input.addEventListener('keypress', (e) => !/[0-9]/.test(e.key) && e.preventDefault());
  });

  // verify-script.js
document.addEventListener('DOMContentLoaded', () => {
    // Retrieve the email stored by your Sign-up-script.js
    // Note: Your script uses localStorage key 'demoUser' in fallback, 
    // but typically you should use sessionStorage.getItem('userEmail') if you added that.
    // Let's assume you store the email in sessionStorage in the success block of Sign-up-script.js
    
    // ACTION REQUIRED: Go to your Sign-up-script.js and add this line inside the "if (response.ok)" block:
    // sessionStorage.setItem('pendingEmail', email);

    const email = sessionStorage.getItem('pendingEmail');
    const inputs = document.querySelectorAll('.otp-input');
    const button = document.querySelector('button[type="submit"]');

    button.addEventListener('click', async (e) => {
        e.preventDefault();
        
        // Combine inputs
        let otp = '';
        inputs.forEach(input => otp += input.value);

        try {
            const res = await fetch('http://localhost:5000/api/auth/verify-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp })
            });

            const data = await res.json();

            if (res.ok) {
                alert("Account Verified! Please Login.");
                window.location.href = 'login.html';
            } else {
                alert(data.message);
            }
        } catch (err) {
            alert("Connection failed");
        }
    });
});

  // Timer logic
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

  resendBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (resendBtn.classList.contains('disabled')) return;

    alert('OTP resent!');
    inputs.forEach(inpt => inpt.value = '');
    inputs[0].focus();
    startTimer();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const otp = Array.from(inputs).map(i => i.value).join('');

    if (otp.length !== 6) return alert('Enter full 6-digit code');

    const isReset = sessionStorage.getItem('resetFlow') === 'true';
    if (!isReset) alert('Account Verified!');
    window.location.href = isReset ? 'password-reset.html' : 'login.html';
  });

  startTimer();

const otpInputs = document.querySelectorAll('.otp-input');
const email = sessionStorage.getItem('resetEmail');

// When user clicks "Continue"
async function verifyOtp() {
    // Combine the 6 inputs into one string
    let otp = '';
    otpInputs.forEach(input => otp += input.value);

    const res = await fetch('http://localhost:5000/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
    });

    if (res.ok) {
        window.location.href = 'password-reset.html';
    } else {
        alert("Invalid Code");
    }
}
});
