// Services Page - Optimized
document.addEventListener('DOMContentLoaded', () => {
  const userData = JSON.parse(localStorage.getItem('onboardingData') || '{}');
  const services = userData.services || [];

  // Restore selection
  services.forEach(s => {
    const card = document.querySelector(`.service-card[data-service="${s}"]`);
    if (card) card.classList.add('selected');
  });

  // Card Toggle Logic
  document.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('click', () => {
      const s = card.dataset.service;
      card.classList.toggle('selected');

      const idx = services.indexOf(s);
      if (card.classList.contains('selected')) {
        if (idx === -1) services.push(s);
      } else {
        if (idx !== -1) services.splice(idx, 1);
      }

      // Real-time save
      userData.services = services;
      localStorage.setItem('onboardingData', JSON.stringify(userData));
    });
  });

  // Handle Submit
  document.getElementById('servicesForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (services.length === 0) return alert('Please select at least one service');
    window.location.href = 'profile-setup.html';
  });
});

window.goBack = () => window.location.href = 'academic-info.html';
window.skipForNow = () => window.location.href = 'profile-setup.html';
