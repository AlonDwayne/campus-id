function wireBooking() {
  document.getElementById('btn-day-back').addEventListener('click', () => {
    if (state.path === 1) goTo('screen-preview');
    else { renderHome(); goTo('screen-home'); }
  });
  document.getElementById('btn-day-continue').addEventListener('click', () => { setupTimeScreen(); goTo('screen-time'); });
  document.getElementById('btn-time-back').addEventListener('click', () => goTo('screen-day'));
  document.getElementById('btn-time-continue').addEventListener('click', finalizeBooking);
  document.getElementById('btn-print').addEventListener('click', () => window.print());
  document.getElementById('btn-restart').addEventListener('click', () => { renderHome(); goTo('screen-home'); });
}

function setupDayScreen() {
  const p = state.path;
  document.getElementById('day-eyebrow').textContent = 'Step ' + (p === 1 ? '06' : '03') + ' · Option 0' + p;
  document.getElementById('day-title').textContent = p === 1 ? 'Choose your collection day' : 'Choose your campus session';
  document.getElementById('day-lede').textContent = p === 1
    ? `Up to ${dayTotalMax(1)} students can collect printed cards each day. Pick a day, then an hour that suits you.`
    : `Up to ${dayTotalMax(2)} students can have cards produced on campus each day, in 2-hour sessions. Pick a day, then a session.`;
  document.getElementById('time-eyebrow').textContent = 'Step ' + (p === 1 ? '07' : '04') + ' · Option 0' + p;
  document.getElementById('time-title').textContent = p === 1 ? 'Choose a collection hour' : 'Choose a session';
  document.getElementById('time-lede').textContent = p === 1
    ? 'Each hour admits a limited number of students so the queue stays short.'
    : 'Each session admits a limited number of students for on-the-spot photos and printing.';

  state.chosenDate = null; state.chosenSlotIdx = null;
  document.getElementById('btn-day-continue').disabled = true;

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';
  getUpcomingWeekdays(10).forEach(d => {
    const rem = dayTotalRemaining(d, p), max = dayTotalMax(p), pct = rem / max, full = rem <= 0;
    const color = full ? 'var(--rust)' : pct > 0.5 ? 'var(--success)' : pct > 0.2 ? 'var(--gold)' : 'var(--rust)';
    const card = document.createElement('div');
    card.className = 'day-card' + (full ? ' full' : '');
    card.innerHTML = `
      <div class="day-dow">${d.toLocaleDateString('en-ZA', { weekday: 'short' })}</div>
      <div class="day-date">${d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })}</div>
      <div class="cap-bar"><div style="width:${Math.max(pct * 100, 3)}%;background:${color}"></div></div>
      <div class="cap-text">${full ? 'Full' : rem + ' / ' + max + ' left'}</div>
    `;
    if (!full) card.onclick = () => {
      state.chosenDate = d;
      document.querySelectorAll('.day-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      document.getElementById('btn-day-continue').disabled = false;
    };
    grid.appendChild(card);
  });
}

function setupTimeScreen() {
  const p = state.path, d = state.chosenDate, slots = slotsFor(p);
  const grid = document.getElementById('slot-grid');
  grid.innerHTML = '';
  document.getElementById('time-lede').textContent = `${fmtDateLong(d)} — ${p === 1 ? 'select an hour' : 'select a session'} below.`;
  state.chosenSlotIdx = null;
  document.getElementById('btn-time-continue').disabled = true;
  slots.forEach((s, i) => {
    const rem = effectiveRemaining(d, p, i), full = rem <= 0;
    const pill = document.createElement('div');
    pill.className = 'slot-pill' + (full ? ' full' : '');
    pill.innerHTML = `<span>${s.label}</span><span class="slot-cap">${full ? 'Full' : rem + ' left'}</span>`;
    if (!full) pill.onclick = () => {
      state.chosenSlotIdx = i;
      document.querySelectorAll('.slot-pill').forEach(x => x.classList.remove('selected'));
      pill.classList.add('selected');
      document.getElementById('btn-time-continue').disabled = false;
    };
    grid.appendChild(pill);
  });
}

function finalizeBooking() {
  const p = state.path, d = state.chosenDate, i = state.chosenSlotIdx;
  const key = dkey(d) + ':p' + p + ':s' + i;
  state.bookingsMade[key] = (state.bookingsMade[key] || 0) + 1;

  const slot = slotsFor(p)[i];
  const remAfter = effectiveRemaining(d, p, i);
  const seatNo = slot.max - remAfter;
  const ref = 'UZ-' + dkey(d).replace(/-/g, '') + '-' + String(seededInt(state.user.email + d + i, 1000, 9999));
  const queueNo = (p === 1 ? 'A-' : 'Q-') + String(seatNo).padStart(3, '0');

  state.booked = { p, d, i, ref, queueNo, slotLabel: slot.label };

  document.getElementById('cd-name').textContent = state.card.name || state.user.name;
  document.getElementById('cd-campus').textContent = state.user.campus || '—';
  document.getElementById('cd-service').textContent = p === 1
    ? 'Card collection (pre-printed)'
    : 'On-campus card production';
  document.getElementById('cd-date').textContent = fmtDateLong(d);
  document.getElementById('cd-time').textContent = slot.label;
  document.getElementById('cd-queue').textContent = queueNo;
  document.getElementById('ref-code').textContent = ref;
  document.getElementById('confirm-title').textContent =
    'You\'re booked, ' + ((state.card.name || state.user.name).split(' ')[0] || '') + '!';
  document.getElementById('confirm-lede').textContent = p === 1
    ? 'Your card has been generated and is queued for printing. Bring this QR code and your ID on the day.'
    : 'Your on-campus production slot is reserved. Bring this QR code and your physical ID on the day.';

  const primary = document.getElementById('notice-primary');
  const warning = document.getElementById('notice-warning');
  if (p === 1) {
    primary.innerHTML = `<b>Bring a valid ID when collecting your student card.</b> Present this QR code at the collection desk — no ID, no card, no exceptions.`;
    warning.innerHTML = `<b>Arrive within your hour.</b> Collection is first-come within each hourly window. If you miss your slot, you'll need to rebook for another day.`;
  } else {
    primary.innerHTML = `<b>Bring your physical SA ID (smart ID card or passport).</b> Staff will verify your identity in person and take your photo on the spot before producing your card.`;
    warning.innerHTML = `<b>Arrive at least 10 minutes before your session starts.</b> If you miss your slot, your seat may be given to the next student and you'll need to rebook.`;
  }
  document.getElementById('cd-queue-row').style.display = 'flex';

  const serviceLabel = p === 1 ? 'Card collection (pre-printed)' : 'On-campus card production';
  api('/api/send-booking-confirmation', {
    method: 'POST',
    body: JSON.stringify({
      student_number: state.user.studentNumber,
      service_label: serviceLabel,
      date_str: fmtDateLong(d),
      time_slot: slot.label,
      queue_no: queueNo,
      ref_code: ref,
      pathway: p,
    }),
  }).catch(() => {});

  goTo('screen-confirm');
  drawQr(ref + ' | ' + queueNo + ' | ' + state.card.name + ' | ' + fmtDateLong(d) + ' | ' + slot.label);
}

function drawQr(text) {
  const el = document.getElementById('qrcode');
  el.innerHTML = '';
  try { new QRCode(el, { text, width: 150, height: 150, colorDark: '#0B1F3A', colorLight: '#ffffff' }); }
  catch { el.textContent = 'QR unavailable'; }
}