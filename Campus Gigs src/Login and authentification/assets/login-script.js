document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const passwordInput = document.getElementById('password');
    const emailInput = document.getElementById('email');
  
    // Toggle password visibility
    const setupPasswordToggle = () => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
      btn.style.cssText = 'position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#6b7280;padding:4px 8px;';
  
      const wrapper = passwordInput.parentElement;
      wrapper.style.position = 'relative';
      wrapper.appendChild(btn);
  
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
      });
    };
    setupPasswordToggle();
  
    // Display error below input
    const showError = (el, msg) => {
      const err = document.createElement('div');
      err.className = 'error-msg';
      err.textContent = msg;
      err.style.cssText = 'color:#dc2626;font-size:12px;margin-top:4px;display:block;';
      el.parentElement.appendChild(err);
      el.style.borderColor = '#dc2626';
    };

    // Remove errors when user starts typing again
    [emailInput, passwordInput].forEach(input => {
        input.addEventListener('input', () => {
            const errorMsg = input.parentElement.querySelector('.error-msg');
            if (errorMsg) errorMsg.remove();
            input.style.borderColor = '';
        });
    });
  
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. THIS IS THE CRUCIAL PART: Grab the actual text typed into the boxes
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Logging in...';
        submitBtn.disabled = true;
    
        try {
            const res = await fetch('http://localhost:5000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }) 
            });
    
            const data = await res.json();
    
            if (res.ok) {
                // Save the token AND the role
                localStorage.setItem('token', data.token);
                localStorage.setItem('userRole', data.user.role);

                // Redirect based on role
                // - admin -> admin.html
                // - client/freelancer -> dashboard.html (which toggles UI using userRole)
                const role = data.user.role;
                if (role === 'admin') {
                    window.location.href = '../dashboard/admin.html';
                } else {
                    window.location.href = '../dashboard/dashboard.html';
                }
            } else {
                // Show error if password/email is wrong
                alert(data.message || "Invalid credentials.");
            }
        } catch (err) {
            console.error("Connection Error:", err);
            alert("Server connection failed. Is your backend running?");
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
});