
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirm');
  const emailInput = document.getElementById('email');
  const studentIdInput = document.getElementById('studentId');

  // PASSWORD TOGGLE FEATURE (from original signup-script.js)
  const addToggle = (input) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Toggle password visibility');
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    btn.style.cssText = 'position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#6b7280;padding:4px 8px;z-index:10;';

    input.parentElement.style.position = 'relative';
    input.parentElement.appendChild(btn);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
  };

  addToggle(passwordInput);
  addToggle(confirmInput);

  // ERROR HANDLING (improved from signup-script.js)
  const showError = (el, msg) => {
    // Remove existing error for this field
    const existingError = el.parentElement.querySelector('.error-msg');
    if (existingError) existingError.remove();
    
    const err = document.createElement('div');
    err.className = 'error-msg';
    err.textContent = msg;
    err.style.cssText = 'color:#dc2626;font-size:12px;margin-top:4px;display:block;';
    el.parentElement.appendChild(err);
    el.style.borderColor = '#dc2626';
  };

  const clearError = (el) => {
    const error = el.parentElement.querySelector('.error-msg');
    if (error) error.remove();
    el.style.borderColor = '';
  };

  // Real-time validation
  [emailInput, studentIdInput, passwordInput, confirmInput].forEach(input => {
    input.addEventListener('input', () => clearError(input));
    
    if (input === confirmInput) {
      input.addEventListener('input', () => {
        if (passwordInput.value && confirmInput.value && passwordInput.value !== confirmInput.value) {
          showError(confirmInput, 'Passwords do not match');
        } else {
          clearError(confirmInput);
        }
      });
    }
  });

  // FORM SUBMISSION (hybrid approach)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Clear all errors
    document.querySelectorAll('.error-msg').forEach(el => el.remove());
    document.querySelectorAll('.form-control').forEach(el => el.style.borderColor = '');

    // Get values
    const email = emailInput.value.trim();
    const studentId = studentIdInput.value.trim();
    const password = passwordInput.value;
    const confirm = confirmInput.value;
    
    let isValid = true;

    // Validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError(emailInput, 'Please enter a valid student email');
      isValid = false;
    }
    
    if (!studentId || studentId.length < 6) {
      showError(studentIdInput, 'Student ID must be at least 6 characters');
      isValid = false;
    }
    
    if (!password || password.length < 6) {
      showError(passwordInput, 'Password must be at least 6 characters');
      isValid = false;
    }
    
    if (password !== confirm) {
      showError(confirmInput, 'Passwords do not match');
      isValid = false;
    }

    if (!isValid) return;

    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating account...';
    submitBtn.disabled = true;

    try {
      // BACKEND INTEGRATION ()
      const res = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, studentId, password })
      });

      const data = await res.json();

      if (res.ok) {
        // Success - redirect to verification or login
        if (data.requiresVerification) {
          window.location.href = 'verify.html';
        } else {
          alert("Registration Successful! Please login.");
          window.location.href = 'login.html';
        }
      } else {
        // Handle specific backend errors
        let errorMessage = data.message || 'Registration failed';
        
        // Map common backend errors to specific fields
        if (errorMessage.includes('email') || errorMessage.includes('Email')) {
          showError(emailInput, errorMessage);
        } else if (errorMessage.includes('student') || errorMessage.includes('ID')) {
          showError(studentIdInput, errorMessage);
        } else {
          alert(errorMessage);
        }
      }
    } catch (err) {
      console.error('Registration error:', err);
      
      // Fallback: If backend is unavailable, use client-side redirect
      if (err.message.includes('Failed to fetch')) {
        const useFallback = confirm('Server connection failed. Continue with demo mode?');
        if (useFallback) {
          // Store in localStorage for demo purposes
          const demoUser = { email, studentId, timestamp: new Date().toISOString() };
          localStorage.setItem('demoUser', JSON.stringify(demoUser));
          window.location.href = 'verify.html';
        }
      } else {
        alert('An unexpected error occurred. Please try again.');
      }
    } finally {
      // Reset button state
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });

  // ADDITIONAL UX IMPROVEMENTS
  // Add focus styles
  document.querySelectorAll('.form-control').forEach(input => {
    input.addEventListener('focus', function() {
      this.style.borderColor = '#3b82f6';
      this.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
    });
    
    input.addEventListener('blur', function() {
      this.style.boxShadow = '';
    });
  });
});
