function setAuthStatus(msg, kind = '') {
  const el = document.getElementById('auth-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'hint' + (kind ? ' ' + kind : '');
}
function setAuthStatusLogin(msg, kind = '') {
  const el = document.getElementById('auth-status-login');
  if (!el) return;
  el.textContent = msg;
  el.className = 'hint' + (kind ? ' ' + kind : '');
}
function setAuthTab(which) {
  document.getElementById('tab-create').classList.toggle('active', which === 'create');
  document.getElementById('tab-login').classList.toggle('active', which === 'login');
  document.getElementById('auth-create').style.display = which === 'create' ? 'block' : 'none';
  document.getElementById('auth-login').style.display = which === 'login' ? 'block' : 'none';
  document.getElementById('resend-row').style.display = 'none';
  setAuthStatus('');
  setAuthStatusLogin('');
}

function validateAuthForms() {
  const name = document.getElementById('in-name').value.trim();
  const studno = document.getElementById('in-studno').value.trim();
  const email = document.getElementById('in-email').value.trim();
  const pass = document.getElementById('in-pass').value;
  const pass2 = document.getElementById('in-pass2').value;
  const campus = document.getElementById('in-campus').value;
  const popia = document.getElementById('in-popia').checked;

  document.getElementById('btn-create').disabled = !(
    name && studno && email.includes('@') &&
    pass.length >= 8 && pass === pass2 && campus && popia
  );
  const lemail = document.getElementById('in-login-email').value.trim();
  const lpass = document.getElementById('in-login-pass').value;
  document.getElementById('btn-login').disabled = !(lemail && lpass.length >= 1);
}

function wireAuthEvents() {
  document.getElementById('tab-create').addEventListener('click', () => setAuthTab('create'));
  document.getElementById('tab-login').addEventListener('click', () => setAuthTab('login'));

  ['in-name', 'in-studno', 'in-email', 'in-pass', 'in-pass2']
    .forEach(id => document.getElementById(id).addEventListener('input', validateAuthForms));
  document.getElementById('in-campus').addEventListener('change', validateAuthForms);
  document.getElementById('in-popia').addEventListener('change', validateAuthForms);
  ['in-login-email', 'in-login-pass']
    .forEach(id => document.getElementById(id).addEventListener('input', validateAuthForms));

  let eligibleTimer = null;
  document.getElementById('in-studno').addEventListener('input', (e) => {
    clearTimeout(eligibleTimer);
    const num = e.target.value.trim();
    if (!num) { setAuthStatus(''); return; }
    eligibleTimer = setTimeout(async () => {
      const { ok, data } = await api('/api/eligible-check', {
        method: 'POST',
        body: JSON.stringify({ student_number: num }),
      });
      if (ok && data.campus) {
        document.getElementById('in-campus').value = data.campus;
        setAuthStatus(`Approved student found — campus pre-filled: ${data.campus}`);
      } else if (!ok) {
        setAuthStatus(data.error || 'Not on approved list.', 'warn');
      }
    }, 500);
  });

  document.getElementById('btn-create').addEventListener('click', onCreate);
  document.getElementById('btn-login').addEventListener('click', onLogin);
  document.getElementById('btn-resend-verification').addEventListener('click', onResendVerification);
  document.getElementById('btn-demo').addEventListener('click', () => {
    document.getElementById('in-login-email').value = '202600001';
    document.getElementById('in-login-pass').value = 'demo1234';
    validateAuthForms();
    setAuthStatusLogin('Demo student filled — click Log in.');
  });
}

async function onCreate() {
  setAuthStatus('Creating your account…');
  const body = {
    full_name: document.getElementById('in-name').value.trim(),
    student_number: document.getElementById('in-studno').value.trim(),
    email: document.getElementById('in-email').value.trim(),
    password: document.getElementById('in-pass').value,
    campus: document.getElementById('in-campus').value,
    popia_consent: document.getElementById('in-popia').checked,
  };
  const { ok, data } = await api('/api/register', { method: 'POST', body: JSON.stringify(body) });
  if (!ok) { setAuthStatus(data.error || 'Could not create account.', 'warn'); return; }
  setAuthStatus(data.message || 'Account created — check your email to verify.', 'warn');
  setTimeout(() => setAuthTab('login'), 2500);
}

async function onLogin() {
  setAuthStatusLogin('Logging in…');
  document.getElementById('resend-row').style.display = 'none';
  const body = {
    student_number: document.getElementById('in-login-email').value.trim(),
    password: document.getElementById('in-login-pass').value,
  };
  const { ok, data } = await api('/api/login', { method: 'POST', body: JSON.stringify(body) });
  if (!ok) {
    setAuthStatusLogin(data.error || 'Login failed.', 'warn');
    if (data.needs_verification) document.getElementById('resend-row').style.display = 'flex';
    return;
  }
  setAuthStatusLogin('');
  state.sessionToken = data.token;
  await afterAuth(data.user);
}

async function onResendVerification() {
  const studno = document.getElementById('in-login-email').value.trim();
  if (!studno) { setAuthStatusLogin('Enter your student number first.', 'warn'); return; }
  setAuthStatusLogin('Sending a new verification link…');
  const { ok, data } = await api('/api/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ student_number: studno }),
  });
  if (ok) setAuthStatusLogin(data.message || 'Verification email sent.');
  else setAuthStatusLogin(data.error || 'Could not resend verification email.', 'warn');
}

async function afterAuth(user) {
  state.user.name = user.full_name;
  state.user.email = user.email;
  state.user.studentNumber = user.student_number;
  state.user.campus = user.campus;
  state.user.popiaConsent = !!user.popia_consent;
  state.user.pathway = user.pathway || null;
  state.user.verificationStatus = user.verification_status || 'unverified';
  state.user.isAdmin = !!user.is_admin;
  state.user.staysOnCampus = !!user.stays_on_campus;

  state.onCampus = state.user.staysOnCampus;
  state.path = state.user.pathway;

  state.card.name = user.full_name;
  state.card.studno = user.student_number;
  state.card.validUntil = '30 November ' + new Date().getFullYear();

  document.getElementById('userchip').hidden = false;
  document.getElementById('userchip-name').textContent = `${user.full_name} · ${user.campus}`;
  const popiaBadge = document.getElementById('userchip-popia');
  if (popiaBadge) popiaBadge.hidden = !state.user.popiaConsent;
  const adminItem = document.getElementById('menu-admin');
  if (adminItem) adminItem.hidden = !state.user.isAdmin;

  const oc = document.getElementById('in-oncampus');
  if (oc) oc.checked = state.onCampus;
  const dzR = document.getElementById('dz-residence');
  if (dzR) dzR.hidden = !state.onCampus;

  await renderHome();
  goTo('screen-home');
}

async function doLogout() {
  if (state.sessionToken) {
    api('/api/logout', { method: 'POST' }).catch(() => {});
  }
  resetToAuth('You have been logged out.');
}

function resetToAuth(message = '') {
  state.user = {
    name: '', email: '', studentNumber: '', campus: '',
    popiaConsent: false, createdAt: null,
    pathway: null, verificationStatus: 'unverified',
    isAdmin: false, staysOnCampus: false,
  };
  state.sessionToken = null;
  state.docs = { id: null, registration: null, residence: null };
  state.onCampus = false;
  state.path = null;
  state.photo = null;
  state.card = { name: '', studno: '', faculty: '', year: '', validUntil: '' };
  state.chosenDate = null;
  state.chosenSlotIdx = null;
  state.booked = null;

  document.getElementById('userchip').hidden = true;
  document.getElementById('userchip-menu').hidden = true;
  document.getElementById('userchip-name').textContent = '';
  const popiaBadge = document.getElementById('userchip-popia');
  if (popiaBadge) popiaBadge.hidden = true;
  const adminItem = document.getElementById('menu-admin');
  if (adminItem) adminItem.hidden = true;

  ['in-name','in-studno','in-email','in-pass','in-pass2','in-login-email','in-login-pass'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const p = document.getElementById('in-popia'); if (p) p.checked = false;
  const c = document.getElementById('in-campus'); if (c) c.value = '';
  const oc = document.getElementById('in-oncampus'); if (oc) oc.checked = false;
  const dzR = document.getElementById('dz-residence'); if (dzR) dzR.hidden = true;

  ['id', 'registration', 'residence'].forEach(k => {
    const dz = document.getElementById('dz-' + k);
    if (dz) dz.classList.remove('filled');
    const s = document.getElementById('dz-' + k + '-status');
    if (s) s.textContent = '';
  });

  validateAuthForms();
  setAuthTab('login');
  if (message) setAuthStatusLogin(message);
  goTo('screen-auth');
}

function renderProfile() {
  document.getElementById('pf-name').textContent = state.user.name || '—';
  document.getElementById('pf-studno').textContent = state.user.studentNumber || '—';
  document.getElementById('pf-email').textContent = state.user.email || '—';
  document.getElementById('pf-campus').textContent = state.user.campus || '—';
  document.getElementById('pf-pathway').textContent = pathwayLabel();
  document.getElementById('pf-identity').textContent = verificationLabel();
  document.getElementById('pf-popia').textContent = state.user.popiaConsent ? 'On record' : 'Not recorded';
  document.getElementById('pf-created').textContent = state.user.createdAt
    ? new Date(state.user.createdAt).toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—';

  renderProfileDocuments();
}

async function renderProfileDocuments() {
  const box = document.getElementById('pf-docs');
  box.innerHTML = '<div class="doc-empty">Loading…</div>';

  const { ok, data } = await api('/api/documents');
  if (!ok) {
    box.innerHTML = '<div class="doc-empty">Could not load documents.</div>';
    return;
  }

  const docs = data.documents || [];
  if (docs.length === 0) {
    box.innerHTML = '<div class="doc-empty">No documents uploaded yet.</div>';
    return;
  }

  box.innerHTML = '';
  docs.forEach(d => {
    const label = d.doc_type === 'id' ? 'Identity document'
              : d.doc_type === 'registration' ? 'Proof of registration'
              : 'Proof of residence';
    const sizeKb = Math.round((d.size_bytes || 0) / 1024);
    const when = d.uploaded_at
      ? new Date(d.uploaded_at).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—';

    const row = document.createElement('div');
    row.className = 'doc-row';
    row.innerHTML = `
      <div class="doc-info">
        <div class="doc-name">${label}</div>
        <div class="doc-meta">${d.filename} · ${sizeKb} KB · uploaded ${when}</div>
      </div>
      <div class="doc-actions">
        <button class="btn btn-ghost" data-action="view">View</button>
        <button class="btn btn-ghost danger" data-action="delete">Remove</button>
      </div>
    `;
    row.querySelector('[data-action="view"]').addEventListener('click', () => {
      window.open('/api/documents/' + d.doc_type + '/download', '_blank');
    });
    row.querySelector('[data-action="delete"]').addEventListener('click', async () => {
      if (!confirm(`Remove the uploaded ${label.toLowerCase()}?`)) return;
      const { ok } = await api('/api/documents/' + d.doc_type, { method: 'DELETE' });
      if (ok) {
        state.docs[d.doc_type] = null;
        renderProfileDocuments();
        checkDocsComplete();
      }
    });
    box.appendChild(row);
  });
}

function wirePopiaModal() {
  const popiaModal = document.getElementById('popia-modal');
  document.getElementById('link-popia').addEventListener('click', (e) => { e.preventDefault(); popiaModal.hidden = false; });
  document.getElementById('popia-modal-close').addEventListener('click', () => { popiaModal.hidden = true; });
  popiaModal.addEventListener('click', (e) => { if (e.target === popiaModal) popiaModal.hidden = true; });
}

function wireChangePass() {
  const cpModal = document.getElementById('change-pass-modal');
  window.openChangePass = () => {
    document.getElementById('cp-current').value = '';
    document.getElementById('cp-new').value = '';
    document.getElementById('cp-new2').value = '';
    document.getElementById('cp-status').textContent = '';
    document.getElementById('cp-status').className = 'hint';
    cpModal.hidden = false;
  };
  document.getElementById('cp-cancel').addEventListener('click', () => cpModal.hidden = true);
  cpModal.addEventListener('click', (e) => { if (e.target === cpModal) cpModal.hidden = true; });

  document.getElementById('cp-submit').addEventListener('click', async () => {
    const cur = document.getElementById('cp-current').value;
    const nw  = document.getElementById('cp-new').value;
    const nw2 = document.getElementById('cp-new2').value;
    const status = document.getElementById('cp-status');
    if (nw.length < 8) { status.textContent = 'New password must be at least 8 characters.'; status.className = 'hint warn'; return; }
    if (nw !== nw2)   { status.textContent = 'New passwords do not match.'; status.className = 'hint warn'; return; }

    const { ok, data } = await api('/api/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: cur, new_password: nw }),
    });
    if (ok) {
      status.textContent = data.message || 'Password changed.';
      status.className = 'hint';
      setTimeout(() => { cpModal.hidden = true; }, 1200);
    } else {
      status.textContent = data.error || 'Could not change password.';
      status.className = 'hint warn';
    }
  });
}

function wireDeleteAccount() {
  const delModal = document.getElementById('delete-modal');
  window.openDelete = () => {
    document.getElementById('del-pass').value = '';
    document.getElementById('del-status').textContent = '';
    document.getElementById('del-status').className = 'hint';
    delModal.hidden = false;
  };
  document.getElementById('del-cancel').addEventListener('click', () => delModal.hidden = true);
  delModal.addEventListener('click', (e) => { if (e.target === delModal) delModal.hidden = true; });

  document.getElementById('del-submit').addEventListener('click', async () => {
    const pass = document.getElementById('del-pass').value;
    const status = document.getElementById('del-status');
    if (!pass) { status.textContent = 'Password is required.'; status.className = 'hint warn'; return; }
    status.textContent = 'Deleting…';
    status.className = 'hint';
    const { ok, data } = await api('/api/account', {
      method: 'DELETE',
      body: JSON.stringify({ password: pass }),
    });
    if (ok) {
      delModal.hidden = true;
      resetToAuth('Your account has been deleted.');
    } else {
      status.textContent = data.error || 'Could not delete account.';
      status.className = 'hint warn';
    }
  });
}

function wireUserChip() {
  const btn = document.getElementById('userchip-btn');
  const menu = document.getElementById('userchip-menu');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !menu.hidden;
    menu.hidden = open;
    btn.setAttribute('aria-expanded', String(!open));
  });
  document.addEventListener('click', (e) => {
    if (menu.hidden) return;
    if (!menu.contains(e.target) && e.target !== btn) {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  document.getElementById('menu-dashboard').addEventListener('click', () => {
    menu.hidden = true; renderHome(); goTo('screen-home');
  });
  document.getElementById('menu-profile').addEventListener('click', () => {
    menu.hidden = true; renderProfile(); goTo('screen-profile');
  });
  document.getElementById('menu-change-pass').addEventListener('click', () => {
    menu.hidden = true; window.openChangePass();
  });
  document.getElementById('menu-logout').addEventListener('click', () => {
    menu.hidden = true; doLogout();
  });
  document.getElementById('menu-delete').addEventListener('click', () => {
    menu.hidden = true; window.openDelete();
  });
  document.getElementById('menu-admin').addEventListener('click', () => {
    menu.hidden = true;
    showAdminTab('verify');
    goTo('screen-admin');
  });

  document.getElementById('btn-profile-back').addEventListener('click', () => { renderHome(); goTo('screen-home'); });
  document.getElementById('btn-profile-change-pass').addEventListener('click', () => window.openChangePass());
  document.getElementById('btn-profile-delete').addEventListener('click', () => window.openDelete());
}