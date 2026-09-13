const STAGE_DEFS = ['Account', 'Documents', 'Pathway', 'Booking', 'Confirmation'];

function goTo(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderStepper(id);
}

function homeStageIdx() {
  if (state.booked) return 4;
  if (state.path) {
    if (!docsComplete()) return 1;
    if (state.path === 1 && state.user.verificationStatus !== 'verified'
        && state.user.verificationStatus !== 'pending_review') {
      return 2;
    }
    return 3;
  }
  return 2;
}

function renderStepper(activeScreenId) {
  const map = {
    'screen-auth': 0,
    'screen-upload': 1,
    'screen-verify': 2,
    'screen-photo': 3,
    'screen-preview': 3,
    'screen-day': 3,
    'screen-time': 3,
    'screen-confirm': 4,
    'screen-profile': 0,
    'screen-admin': 0,
  };
  const activeIdx = activeScreenId === 'screen-home'
    ? homeStageIdx()
    : (map[activeScreenId] ?? 0);

  const el = document.getElementById('stepper');
  el.innerHTML = '';
  STAGE_DEFS.forEach((label, i) => {
    const span = document.createElement('div');
    span.className = 'step' + (i < activeIdx ? ' done' : '') + (i === activeIdx ? ' current' : '');
    span.innerHTML = `<span class="num">${i < activeIdx ? '✓' : String(i + 1).padStart(2, '0')}</span><span>${label}</span>`;
    el.appendChild(span);
    if (i < STAGE_DEFS.length - 1) {
      const sep = document.createElement('div');
      sep.className = 'step-sep';
      el.appendChild(sep);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderStepper('screen-auth');

  wireAuthEvents();
  wirePopiaModal();
  wireChangePass();
  wireDeleteAccount();
  wireUserChip();
  wireVerification();
  wireUploads();
  wirePhoto();
  wireBooking();
  wireAdmin();

  document.getElementById('choice-1').addEventListener('click', () => onPathwayChoice(1));
  document.getElementById('choice-2').addEventListener('click', () => onPathwayChoice(2));

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    ['popia-modal', 'change-pass-modal', 'delete-modal'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
  });
});