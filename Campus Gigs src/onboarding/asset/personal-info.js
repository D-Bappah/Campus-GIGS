// Personal Info - Optimized
document.addEventListener('DOMContentLoaded', () => {
  const get = (id) => document.getElementById(id);
  const userData = JSON.parse(localStorage.getItem('onboardingData') || '{}');

  // Restore Text Fields
  if (userData.personal) {
    ['firstName', 'lastName', 'displayName', 'shortBio'].forEach(id => {
      if (get(id)) get(id).value = userData.personal[id] || '';
    });

    // Restore Avatar
    if (userData.personal.avatar) {
       const preview = get('avatarPreview');
       if (preview) preview.innerHTML = `<img src="${userData.personal.avatar}" alt="Profile">`;
    }
  }

  // Avatar Handling
  const btnEditAvatar = get('btnEditAvatar');
  const avatarInput = get('avatarInput');
  const avatarPreview = get('avatarPreview');

  if (btnEditAvatar && avatarInput) {
    btnEditAvatar.addEventListener('click', () => avatarInput.click());

    avatarInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 2 * 1024 * 1024) { // 2MB limit check
            alert("File is too large. Please select an image under 2MB.");
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
          const result = ev.target.result;
          if (avatarPreview) avatarPreview.innerHTML = `<img src="${result}" alt="Profile">`;
          avatarInput.setAttribute('data-base64', result); 
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Handle Submit
  const form = get('personalInfoForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fields = ['firstName', 'lastName', 'displayName', 'shortBio'];
      const values = {};

      const requiredFields = ['firstName', 'lastName', 'displayName'];
      
      const hasEmpty = requiredFields.some(id => {
        const el = get(id);
        return !el || !el.value.trim();
      });

      if (hasEmpty) return alert('Please fill in all required fields');

      // Collect values
      fields.forEach(id => {
         const el = get(id);
         if (el) values[id] = el.value.trim();
      });

      // Get Avatar
      const inputBase64 = avatarInput ? avatarInput.getAttribute('data-base64') : null;
      if (inputBase64) {
          values.avatar = inputBase64;
      } else if (userData.personal && userData.personal.avatar) {
          values.avatar = userData.personal.avatar;
      }

      userData.personal = values;
      localStorage.setItem('onboardingData', JSON.stringify(userData));
      window.location.href = 'academic-info.html';
    });
  }
});

window.goBack = () => window.location.href = '../Login and authentification/login.html';
