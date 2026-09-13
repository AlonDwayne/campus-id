/* ============================= ADMIN ============================= */

function wireAdmin() {
  document.querySelectorAll('.admin-tab').forEach(btn => {
    btn.addEventListener('click', () => showAdminTab(btn.dataset.tab));
  });
  document.getElementById('admin-user-search-btn').addEventListener('click', () => {
    loadAdminUsers(document.getElementById('admin-user-search').value.trim());
  });
  document.getElementById('admin-user-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadAdminUsers(e.target.value.trim());
  });

  // Eligible students tab — bulk upload
  const drop = document.getElementById('eligible-drop');
  const fileInput = document.getElementById('eligible-file');
  drop.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', onEligibleFilePicked);

  ['dragenter', 'dragover'].forEach(evt => {
    drop.addEventListener(evt, (e) => { e.preventDefault(); drop.classList.add('busy'); });
  });
  ['dragleave', 'drop'].forEach(evt => {
    drop.addEventListener(evt, (e) => { e.preventDefault(); drop.classList.remove('busy'); });
  });
  drop.addEventListener('drop', (e) => {
    const f = e.dataTransfer?.files?.[0];
    if (f) uploadEligibleFile(f);
  });

  document.getElementById('eligible-search-btn').addEventListener('click', () => {
    loadEligible(document.getElementById('eligible-search').value.trim());
  });
  document.getElementById('eligible-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadEligible(e.target.value.trim());
  });

  // Sync from Google Sheet
  document.getElementById('eligible-sync-btn').addEventListener('click', async () => {
    const status = document.getElementById('eligible-status');
    status.textContent = 'Syncing from Google Sheet…';
    status.className = 'hint';

    const { ok, data } = await api('/api/admin/eligible/sync', { method: 'POST' });
    if (ok) {
      status.innerHTML = `<div class="upload-report ok">
        Synced. Added: <span class="mono">${data.inserted}</span>,
        updated: <span class="mono">${data.updated}</span>,
        unchanged: <span class="mono">${data.unchanged}</span>,
        total: <span class="mono">${data.total}</span>.
      </div>`;
      loadEligible('');
    } else {
      status.textContent = data.error || 'Sync failed.';
      status.className = 'hint warn';
    }
  });
}

function showAdminTab(name) {
  document.querySelectorAll('.admin-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === name);
  });
  ['verify', 'users', 'eligible', 'audit'].forEach(t => {
    document.getElementById('admin-panel-' + t).hidden = (t !== name);
  });
  if (name === 'verify') renderAdminQueue();
  else if (name === 'users') loadAdminUsers('');
  else if (name === 'eligible') loadEligible('');
  else if (name === 'audit') loadAdminAudit();
}

/* ---------- Verification queue ---------- */

async function renderAdminQueue() {
  const box = document.getElementById('admin-queue');
  box.innerHTML = 'Loading…';

  const { ok, data } = await api('/api/admin/verifications');
  if (!ok) {
    box.innerHTML = `<div class="doc-empty">${data.error || 'Could not load queue.'}</div>`;
    return;
  }

  const list = data.pending || [];
  if (list.length === 0) {
    box.innerHTML = '<div class="doc-empty">No pending reviews.</div>';
    return;
  }

  box.innerHTML = '';
  list.forEach(v => {
    const row = document.createElement('div');
    row.className = 'admin-row';
    row.innerHTML = `
      <div class="doc-info">
        <div class="doc-name">
          ${escapeHtml(v.full_name)} · ${escapeHtml(v.student_number)}
          <span class="badge pending">pending</span>
        </div>
        <div class="doc-meta">${escapeHtml(v.email)} · ${escapeHtml(v.campus)} · confidence ${v.confidence ?? '—'}</div>
        <div class="doc-meta">Submitted ${new Date(v.created_at).toLocaleString()} · warnings: ${(v.warnings || []).join(', ') || 'none'}</div>
      </div>
      <div class="doc-actions">
        <button class="btn btn-primary" data-action="approve">Approve</button>
        <button class="btn btn-ghost danger" data-action="decline">Decline</button>
      </div>
    `;
    row.querySelector('[data-action="approve"]').addEventListener('click', () => decide(v.id, 'approve'));
    row.querySelector('[data-action="decline"]').addEventListener('click', () => decide(v.id, 'decline'));
    box.appendChild(row);
  });
}

async function decide(id, decision) {
  const notes = prompt(`Optional notes for this ${decision}:`) || '';
  const { ok, data } = await api(`/api/admin/verifications/${id}/decide`, {
    method: 'POST',
    body: JSON.stringify({ decision, notes }),
  });
  if (ok) renderAdminQueue();
  else alert(data.error || 'Could not record decision.');
}

/* ---------- All users ---------- */

async function loadAdminUsers(query) {
  const box = document.getElementById('admin-users-list');
  box.innerHTML = 'Loading…';

  const url = '/api/admin/users' + (query ? ('?q=' + encodeURIComponent(query)) : '');
  const { ok, data } = await api(url);
  if (!ok) {
    box.innerHTML = `<div class="doc-empty">${data.error || 'Could not load users.'}</div>`;
    return;
  }

  const list = data.users || [];
  if (list.length === 0) {
    box.innerHTML = '<div class="doc-empty">No users found.</div>';
    return;
  }

  box.innerHTML = '';
  list.forEach(u => {
    const badges = [];
    if (u.is_admin) badges.push('<span class="badge admin">admin</span>');
    if (u.suspended) badges.push('<span class="badge suspended">suspended</span>');
    if (u.verification_status === 'verified') badges.push('<span class="badge verified">verified</span>');
    if (u.verification_status === 'pending_review') badges.push('<span class="badge pending">pending</span>');
    if (u.verification_status === 'rejected') badges.push('<span class="badge rejected">rejected</span>');
    if (u.pathway === 1) badges.push('<span class="badge online">online</span>');
    if (u.pathway === 2) badges.push('<span class="badge oncampus">on-campus</span>');

    const row = document.createElement('div');
    row.className = 'admin-row';
    row.innerHTML = `
      <div class="doc-info">
        <div class="doc-name">${escapeHtml(u.full_name)} · ${escapeHtml(u.student_number)}${badges.join('')}</div>
        <div class="doc-meta">${escapeHtml(u.email)} · ${escapeHtml(u.campus)} · joined ${new Date(u.created_at).toLocaleDateString()}</div>
      </div>
      <div class="doc-actions">
        ${u.suspended
          ? `<button class="btn btn-ghost" data-action="reactivate">Reactivate</button>`
          : `<button class="btn btn-ghost" data-action="suspend">Suspend</button>`}
        <button class="btn btn-ghost danger" data-action="delete">Delete</button>
      </div>
    `;
    row.querySelector('[data-action="suspend"]')?.addEventListener('click', () => suspendUser(u, true));
    row.querySelector('[data-action="reactivate"]')?.addEventListener('click', () => suspendUser(u, false));
    row.querySelector('[data-action="delete"]').addEventListener('click', () => deleteUser(u));
    box.appendChild(row);
  });
}

async function suspendUser(u, suspend) {
  const verb = suspend ? 'suspend' : 'reactivate';
  const reason = prompt(`Reason for ${verb}ing ${u.full_name}:`) || '';
  if (suspend && !reason) { alert('A reason is required to suspend an account.'); return; }

  const { ok, data } = await api(`/api/admin/users/${u.id}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ suspend, reason }),
  });
  if (ok) loadAdminUsers('');
  else alert(data.error || 'Could not update account.');
}

async function deleteUser(u) {
  const reason = prompt(
    `Deleting ${u.full_name} (${u.student_number}) is permanent and cannot be undone.\n\nEnter a reason for the audit log:`
  );
  if (!reason) return;
  if (!confirm(`Are you absolutely sure you want to permanently delete ${u.full_name}?`)) return;

  const { ok, data } = await api(`/api/admin/users/${u.id}`, {
    method: 'DELETE',
    body: JSON.stringify({ reason }),
  });
  if (ok) {
    loadAdminUsers('');
    alert('Account deleted.');
  } else {
    alert(data.error || 'Could not delete account.');
  }
}

/* ---------- Eligible students ---------- */

function onEligibleFilePicked(e) {
  const f = e.target.files?.[0];
  e.target.value = '';
  if (f) uploadEligibleFile(f);
}

async function uploadEligibleFile(file) {
  const MAX = 5 * 1024 * 1024;
  const status = document.getElementById('eligible-status');
  status.textContent = '';
  status.className = 'hint';

  const name = file.name.toLowerCase();
  if (!(name.endsWith('.xlsx') || name.endsWith('.xlsm') || name.endsWith('.csv'))) {
    status.textContent = 'Only .xlsx, .xlsm, or .csv files are accepted.';
    status.className = 'hint warn';
    return;
  }
  if (file.size > MAX) {
    status.textContent = 'File is too large (max 5 MB).';
    status.className = 'hint warn';
    return;
  }

  const drop = document.getElementById('eligible-drop');
  drop.classList.add('busy');
  status.textContent = 'Uploading…';

  const b64 = await fileToBase64(file);
  const { ok, data } = await api('/api/admin/eligible/upload', {
    method: 'POST',
    body: JSON.stringify({ filename: file.name, content: b64 }),
  });

  drop.classList.remove('busy');

  if (!ok) {
    status.textContent = data.error || 'Upload failed.';
    status.className = 'hint warn';
    if (data.skipped && data.skipped.length) {
      showEligibleReport({ ...data, inserted: 0, updated: 0, unchanged: 0 }, 'err');
    }
    return;
  }

  status.textContent = '';
  showEligibleReport(data, 'ok');
  loadEligible('');
}

function showEligibleReport(data, kind) {
  const box = document.getElementById('eligible-status');
  const lines = [];
  lines.push(`<b>${escapeHtml(data.filename || 'File')}</b> processed.`);
  lines.push(`Added: <span class="mono">${data.inserted ?? 0}</span>, updated: <span class="mono">${data.updated ?? 0}</span>, unchanged: <span class="mono">${data.unchanged ?? 0}</span>, skipped: <span class="mono">${data.skipped_count ?? 0}</span>.`);

  if (data.skipped && data.skipped.length) {
    lines.push('<ul>' + data.skipped.map(s =>
      `<li>Row ${s.row}: ${escapeHtml(s.reason)}</li>`
    ).join('') + '</ul>');
  }

  box.innerHTML = `<div class="upload-report ${kind}">${lines.join('<br>')}</div>`;
  box.className = 'hint';
}

async function loadEligible(query) {
  const box = document.getElementById('eligible-list');
  box.innerHTML = 'Loading…';

  const url = '/api/admin/eligible' + (query ? ('?q=' + encodeURIComponent(query)) : '');
  const { ok, data } = await api(url);
  if (!ok) {
    box.innerHTML = `<div class="doc-empty">${data.error || 'Could not load list.'}</div>`;
    return;
  }

  const list = data.eligible || [];
  if (list.length === 0) {
    box.innerHTML = '<div class="doc-empty">No eligible students on file.</div>';
    return;
  }

  box.innerHTML = '';
  list.forEach(s => {
    const row = document.createElement('div');
    row.className = 'admin-row';
    row.innerHTML = `
      <div class="doc-info">
        <div class="doc-name">${escapeHtml(s.full_name)} · ${escapeHtml(s.student_number)}</div>
        <div class="doc-meta">${escapeHtml(s.campus)}</div>
      </div>
      <div class="doc-actions">
        <button class="btn btn-ghost danger" data-action="remove">Remove</button>
      </div>
    `;
    row.querySelector('[data-action="remove"]').addEventListener('click', async () => {
      if (!confirm(`Remove ${s.full_name} (${s.student_number}) from the eligible list?`)) return;
      const { ok, data } = await api('/api/admin/eligible/' + encodeURIComponent(s.student_number), {
        method: 'DELETE',
      });
      if (ok) loadEligible('');
      else alert(data.error || 'Could not remove.');
    });
    box.appendChild(row);
  });
}

/* ---------- Audit log ---------- */

async function loadAdminAudit() {
  const box = document.getElementById('admin-audit-list');
  box.innerHTML = 'Loading…';

  const { ok, data } = await api('/api/admin/audit');
  if (!ok) {
    box.innerHTML = `<div class="doc-empty">${data.error || 'Could not load audit log.'}</div>`;
    return;
  }

  const list = data.entries || [];
  if (list.length === 0) {
    box.innerHTML = '<div class="doc-empty">No admin actions recorded yet.</div>';
    return;
  }

  box.innerHTML = '';
  list.forEach(e => {
    const row = document.createElement('div');
    row.className = 'admin-row';
    const actionLabel = {
      approve: 'Approved verification',
      decline: 'Declined verification',
      suspend: 'Suspended account',
      reactivate: 'Reactivated account',
      delete: 'Deleted account',
      eligible_upload: 'Bulk-uploaded eligible students',
      eligible_delete: 'Removed eligible student',
      eligible_sync: 'Synced eligible students from Google Sheet',
    }[e.action] || e.action;

    row.innerHTML = `
      <div class="doc-info">
        <div class="doc-name">${actionLabel}</div>
        <div class="doc-meta">
          by ${escapeHtml(e.admin_student_number || 'admin')}
          ${e.target_full_name ? ' → ' + escapeHtml(e.target_full_name) + ' (' + escapeHtml(e.target_student_number || '') + ')' : ''}
        </div>
        <div class="doc-meta">${new Date(e.created_at).toLocaleString()}${e.reason ? ' · ' + escapeHtml(e.reason) : ''}</div>
      </div>
    `;
    box.appendChild(row);
  });
}

/* ---------- Helpers ---------- */

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = String(s ?? '');
  return d.innerHTML;
}