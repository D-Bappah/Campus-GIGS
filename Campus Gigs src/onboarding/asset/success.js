document.addEventListener('DOMContentLoaded', () => {
  // Mark completed
  const userData = JSON.parse(localStorage.getItem('onboardingData') || '{}');
  userData.completed = true;
  userData.completionDate = new Date().toISOString();
  localStorage.setItem('onboardingData', JSON.stringify(userData));

  // Confetti
  const colors = ['#3b82f6', '#667eea', '#764ba2', '#f59e0b', '#10b981'];
  for (let i = 0; i < 50; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'confetti';
      el.style.left = Math.random() * 100 + '%';
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      el.style.animation = `confetti-fall ${Math.random() * 3 + 2}s linear forwards`;

      document.body.appendChild(el);
      setTimeout(() => el.remove(), 5000);
    }, i * 100);
  }
});
