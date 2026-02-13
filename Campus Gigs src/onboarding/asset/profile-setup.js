// Profile Setup - Optimized
document.addEventListener('DOMContentLoaded', () => {
  const get = (id) => document.getElementById(id);
  const userData = JSON.parse(localStorage.getItem('onboardingData') || '{}');

  // Restore
  if (userData.profile) {
    ['skillProficiency', 'availability', 'workType', 'hourlyRate', 'linkedin', 'github'].forEach(id => {
      if (get(id)) get(id).value = userData.profile[id] || '';
    });
  }

  // Handle File Display
  const fileInput = get('resume');
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    document.querySelector('.file-upload-btn').textContent = file ? file.name : 'Click to upload';
  });

  // Handle Submit
  get('profileSetupForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validation (Keep your existing checks)
    const req = ['skillProficiency', 'availability', 'workType'];
    if (req.some(id => !get(id).value)) return alert('Please fill in all required fields');

    // Save CURRENT page data to the main object
    userData.profile = {
      skillProficiency: get('skillProficiency').value,
      availability: get('availability').value,
      workType: get('workType').value,
      hourlyRate: get('hourlyRate').value,
      linkedin: get('linkedin').value,
      github: get('github').value,
      resume: fileInput.files[0] ? fileInput.files[0].name : (userData.profile?.resume || null)
    };

    // RETRIEVE USER EMAIL
    // it needs to know WHO this data belongs to.
    // In Sign-up-script.js our Frontend programmer saved 'demoUser' to localStorage. 
    // Ideally, i'll use the email from the login token, but let's try to find an email.
    
    // Check different places where email might be stored based on my previous scripts
    let userEmail = sessionStorage.getItem('pendingEmail'); 
    
    // If not found, try to decode the token (if they logged in)
    if (!userEmail) {
        const token = localStorage.getItem('token'); // From login-script
        if (token) {
            // Quick hack to get email from JWT without a library
            try {
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
                    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
                userEmail = JSON.parse(jsonPayload).email; // Assuming your JWT contains { email: ... }
            } catch (e) { console.log("Token decode failed"); }
        }
    }

    // FALLBACK: If there is still no email, prompt the user (Dev Only)
    // In a real app, you would force them to login before onboarding.
    if (!userEmail) {
        userEmail = prompt("Developer Check: We lost the email. Please enter it to save data:");
    }

    // SEND EVERYTHING TO BACKEND
    try {
        const res = await fetch('http://localhost:5000/api/auth/complete-onboarding', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                email: userEmail, 
                onboardingData: userData 
            })
        });

        if (res.ok) {
            // Success! Clear storage and go to success page
            localStorage.removeItem('onboardingData'); 
            window.location.href = 'success.html';
        } else {
            const data = await res.json();
            alert("Save failed: " + data.message);
        }
    } catch (err) {
        console.error(err);
        alert("Server error. Check console.");
    }
  });

    // Required fields
    const req = ['skillProficiency', 'availability', 'workType'];
    if (req.some(id => !get(id).value)) return alert('Please fill in all required fields');

    userData.profile = {
      skillProficiency: get('skillProficiency').value,
      availability: get('availability').value,
      workType: get('workType').value,
      hourlyRate: get('hourlyRate').value,
      linkedin: get('linkedin').value,
      github: get('github').value,
      resume: fileInput.files[0] ? fileInput.files[0].name : (userData.profile?.resume || null)
    };

    localStorage.setItem('onboardingData', JSON.stringify(userData));
    window.location.href = 'success.html';
  });

window.goBack = () => window.location.href = 'services.html';
window.skipForNow = () => window.location.href = 'success.html';
