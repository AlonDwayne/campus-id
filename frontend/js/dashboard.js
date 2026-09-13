function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

async function renderHome() {
  const firstName = (state.user.name || 'Student').split(' ')[0];
  document.getElementById('home-greeting').textContent = `${greetingWord()}, ${firstName}`;

  if (state.sessionToken) {
    await hydrateDocumentsFromServer().catch(() => {});
  }

  const pathChosen = !!state.path;
  const hasDocs = docsComplete();
  const booked = !!state.booked;

  document.getElementById('home-lede').textContent = booked
    ? 'Your student card is booked and ready to go — details are below whenever you need them.'
    : (pathChosen
        ? 'Finish the remaining steps for your chosen pathway below.'
        : 'First choose how you\'d like to get your card. Both pathways are quick.');

  const stages = [{ label: 'Account', state: 'done' }];

  if (pathChosen) {
    stages.push({ label: 'Documents', state: hasDocs ? 'done' : 'current' });

    if (state.path === 1) {
      const vs = state.user.verificationStatus;
      stages.push({
        label: 'Identity',
        state: vs === 'verified' ? 'done'
             : vs === 'pending_review' ? 'current'
             : vs === 'rejected' ? 'warn'
             : 'current',
      });
    } else {
      stages.push({ label: 'On-campus ID check', state: 'skipped' });
    }

    stages.push({ label: 'Booking', state: booked ? 'done' : (hasDocs ? 'current' : 'locked') });
  } else {
    stages.push({ label: 'Pathway', state: 'current' });
  }

  document.getElementById('home-status-row').innerHTML = stages
    .map(s => `<div class="status-chip ${s.state}"><span class="status-dot"></span>${s.label}</div>`).join('');

  const pathwaySection = document.getElementById('pathway-section');
  pathwaySection.hidden = pathChosen;

  const docsPanel = document.getElementById('home-docs-panel');
  if (pathChosen) {
    docsPanel.hidden = false;

    if (!hasDocs) {
      const required = state.path === 1 ? 'ID and proof of registration' : 'proof of registration';
      docsPanel.innerHTML = `
        <div class="home-panel-head">
          <div>
            <div class="eyebrow">Next step</div>
            <h3>Upload your ${required}</h3>
            <p class="lede">PDF only, max 10 MB each.</p>
          </div>
          <button class="btn btn-primary" id="home-btn-upload">Upload documents</button>
        </div>`;
      document.getElementById('home-btn-upload').addEventListener('click', () => {
        applyPathwayToUploadScreen();
        goTo('screen-upload');
      });
    } else if (state.path === 1 && state.user.verificationStatus !== 'verified') {
      const vs = state.user.verificationStatus;
      let msg;
      if (vs === 'pending_review') {
        msg = 'Your identity check is under manual review. We\'ll email you when it\'s done.';
      } else if (vs === 'rejected') {
        msg = 'Your identity check was declined. You can re-submit or contact support.';
      } else {
        msg = 'Now verify your identity online — this is the last step before booking.';
      }
      docsPanel.innerHTML = `
        <div class="home-panel-head">
          <div>
            <div class="eyebrow">Next step</div>
            <h3>Verify your identity</h3>
            <p class="lede">${msg}</p>
          </div>
          <button class="btn btn-primary" id="home-btn-verify">${vs === 'rejected' ? 'Re-try verification' : 'Go to verification'}</button>
        </div>`;
      document.getElementById('home-btn-verify').addEventListener('click', () => {
        refreshVerificationScreen();
        goTo('screen-verify');
      });
    } else if (!booked) {
      docsPanel.innerHTML = `
        <div class="home-panel-head">
          <div>
            <div class="eyebrow">Next step</div>
            <h3>Book your ${state.path === 1 ? 'collection' : 'campus session'}</h3>
            <p class="lede">Choose a day and time that suits you.</p>
          </div>
          <button class="btn btn-primary" id="home-btn-book">Choose a day</button>
        </div>`;
      document.getElementById('home-btn-book').addEventListener('click', () => {
        setupDayScreen();
        goTo('screen-day');
      });
    } else {
      docsPanel.hidden = true;
    }
  } else {
    docsPanel.hidden = true;
  }

  const bookedPanel = document.getElementById('home-booked-panel');
  if (booked) {
    const b = state.booked;
    bookedPanel.hidden = false;
    bookedPanel.innerHTML = `
      <div class="home-panel-head">
        <div>
          <div class="eyebrow">Booking confirmed</div>
          <h3>You're all set, ${firstName}</h3>
          <p class="lede">${b.p === 1 ? 'Card collection' : 'On-campus production'} · ${fmtDateLong(b.d)} · ${b.slotLabel}. Reference <span class="mono">${b.ref}</span>.</p>
        </div>
        <button class="btn btn-primary" id="home-btn-view-confirm">View QR &amp; details</button>
      </div>`;
    document.getElementById('home-btn-view-confirm').addEventListener('click', () => goTo('screen-confirm'));
  } else {
    bookedPanel.hidden = true;
  }
}

async function onPathwayChoice(n) {
  const { ok, data } = await api('/api/pathway', {
    method: 'POST',
    body: JSON.stringify({ pathway: n }),
  });
  if (!ok) {
    alert(data.error || 'Could not save pathway choice.');
    return;
  }

  state.path = n;
  state.user.pathway = n;

  if (n === 2) {
    state.user.verificationStatus = 'not_required';
  }

  renderHome();
  goTo('screen-home');
}