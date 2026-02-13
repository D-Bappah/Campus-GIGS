// Academic Info - Optimized
document.addEventListener('DOMContentLoaded', () => {
  const get = (id) => document.getElementById(id);
  const userData = JSON.parse(localStorage.getItem('onboardingData') || '{}');

  // Restore
  if (userData.academic) {
    ['department', 'yearOfStudy', 'graduationYear'].forEach(id => {
      if (get(id)) get(id).value = userData.academic[id] || '';
    });
  }

  // Handle Submit
  const form = get('academicInfoForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fields = ['department', 'yearOfStudy', 'graduationYear'];
      const values = {};

      const hasEmpty = fields.some(id => {
        const val = get(id).value; // select values don't need trim() usually, but safe to keep loose
        values[id] = val;
        return !val;
      });

      if (hasEmpty) return alert('Please fill in all required fields');

      userData.academic = values;
      localStorage.setItem('onboardingData', JSON.stringify(userData));
      window.location.href = 'services.html';
    });
  }
});

window.goBack = () => window.location.href = 'personal-info.html';
