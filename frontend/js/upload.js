const MAX_PDF_BYTES = 10 * 1024 * 1024;

function wireUploads() {
  document.querySelectorAll('.dropzone').forEach(dz => {
    dz.addEventListener('click', function () {
      const key = this.id.replace('dz-', '');
      if (key === 'residence' && !state.onCampus) return;
      if (key === 'id' && state.path === 2) return;
      triggerUpload(key);
    });
  });

  document.getElementById('file-input').addEventListener('change', onFilePicked);

  document.getElementById('in-oncampus').addEventListener('change', (e) => {
    state.onCampus = e.target.checked;
    document.getElementById('dz-residence').hidden = !state.onCampus;
    checkDocsComplete();
  });

  document.getElementById('btn-upload-back').addEventListener('click', () => {
    renderHome();
    goTo('screen-home');
  });
  document.getElementById('btn-docs-continue').addEventListener('click', () => {
    if (state.path === 1) {
      if (state.user.verificationStatus === 'verified') {
        goTo('screen-photo');
      } else {
        refreshVerificationScreen();
        goTo('screen-verify');
      }
    } else {
      setupDayScreen();
      goTo('screen-day');
    }
  });
}

function triggerUpload(key) {
  pendingUploadKey = key;
  document.getElementById('file-input').click();
}

async function onFilePicked(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file || !pendingUploadKey) return;
  const key = pendingUploadKey;

  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    setDocError(key, 'Only PDF files are accepted.');
    return;
  }
  if (file.size > MAX_PDF_BYTES) {
    setDocError(key, 'PDF is too large (max 10 MB).');
    return;
  }

  setDocStatus(key, 'Uploading…');

  const b64 = await fileToBase64(file);
  const { ok, data } = await api('/api/documents/' + key, {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      mime_type: 'application/pdf',
      content: b64,
      stays_on_campus: state.onCampus,
    }),
  });

  if (!ok) {
    setDocError(key, data.error || 'Upload failed.');
    return;
  }

  state.docs[key] = { filename: file.name };
  setDocStatus(key, 'Uploaded ✓');
  document.getElementById('dz-' + key + '-sub').textContent = file.name;
  checkDocsComplete();
}

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

function setDocStatus(key, text) {
  const status = document.getElementById('dz-' + key + '-status');
  if (!status) return;
  status.textContent = text;
  status.style.color = 'var(--success)';
  document.getElementById('dz-' + key).classList.add('filled');
}

function setDocError(key, message) {
  const status = document.getElementById('dz-' + key + '-status');
  if (!status) return;
  status.textContent = message;
  status.style.color = 'var(--rust)';
  document.getElementById('dz-' + key).classList.remove('filled');
}

function checkDocsComplete() {
  const ready = docsComplete();
  document.getElementById('btn-docs-continue').disabled = !ready;

  const hint = document.getElementById('upload-hint');
  if (state.path === 1) {
    hint.textContent = ready
      ? 'Documents received. Continue to verify your identity.'
      : 'Upload both required documents: your ID and proof of registration.';
  } else {
    hint.textContent = ready
      ? 'Proof of registration received. Continue to book your campus slot.'
      : 'Upload your proof of registration to continue.';
  }
}

async function hydrateDocumentsFromServer() {
  const { ok, data } = await api('/api/documents');
  if (!ok) return;
  state.docs = { id: null, registration: null, residence: null };
  for (const d of (data.documents || [])) {
    state.docs[d.doc_type] = { filename: d.filename, uploaded_at: d.uploaded_at, size_bytes: d.size_bytes };

    const dz = document.getElementById('dz-' + d.doc_type);
    if (!dz) continue;
    dz.classList.add('filled');
    const status = document.getElementById('dz-' + d.doc_type + '-status');
    const sub = document.getElementById('dz-' + d.doc_type + '-sub');
    if (status) { status.textContent = 'Uploaded ✓'; status.style.color = 'var(--success)'; }
    if (sub) sub.textContent = d.filename;

    if (d.doc_type === 'residence') {
      state.onCampus = true;
      const oc = document.getElementById('in-oncampus');
      if (oc) oc.checked = true;
      const dzR = document.getElementById('dz-residence');
      if (dzR) dzR.hidden = false;
    }
  }
  checkDocsComplete();
}

function applyPathwayToUploadScreen() {
  const showId = state.path !== 2;
  document.getElementById('dz-id').hidden = !showId;

  const eyebrow = document.getElementById('upload-eyebrow');
  const title = document.getElementById('upload-title');
  const lede = document.getElementById('upload-lede');

  if (state.path === 2) {
    eyebrow.textContent = 'Step 02 · Option 02';
    title.textContent = 'Upload proof of registration';
    lede.textContent = 'Only proof of registration is required. Your ID will be checked in person when you come to campus.';
  } else {
    eyebrow.textContent = 'Step 02 · Option 01';
    title.textContent = 'Upload your documents';
    lede.textContent = 'Both the ID and proof of registration are required. All documents must be PDF format (max 10 MB each).';
  }

  checkDocsComplete();
}

/* Photo */
function wirePhoto() {
  document.getElementById('btn-upload-photo').addEventListener('click', () => document.getElementById('photo-input').click());
  document.getElementById('photo-input').addEventListener('change', function (e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  document.getElementById('btn-camera').addEventListener('click', openCamera);
  document.getElementById('btn-capture').addEventListener('click', captureFromCamera);
  document.getElementById('btn-cancel-camera').addEventListener('click', cancelCamera);

  document.getElementById('btn-photo-back').addEventListener('click', () => { renderHome(); goTo('screen-home'); });
  document.getElementById('btn-photo-continue').addEventListener('click', () => { renderCardPreview(); goTo('screen-preview'); });

  document.getElementById('btn-preview-back').addEventListener('click', () => goTo('screen-photo'));
  document.getElementById('btn-preview-confirm').addEventListener('click', () => {
    state.card.name = document.getElementById('v-name').value;
    state.card.studno = document.getElementById('v-studno').value;
    state.card.faculty = document.getElementById('v-faculty').value;
    state.card.year = document.getElementById('v-year').value;
    setupDayScreen();
    goTo('screen-day');
  });
}

function setPhoto(dataUrl) {
  state.photo = dataUrl;
  document.getElementById('photo-slot').innerHTML = `<img src="${dataUrl}">`;
  document.getElementById('btn-photo-continue').disabled = false;
}

async function openCamera() {
  const panel = document.getElementById('camera-panel');
  const hint = document.getElementById('camera-hint');
  const actions = document.getElementById('photo-actions');
  hint.textContent = ''; panel.hidden = false; actions.style.display = 'none';
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    document.getElementById('camera-video').srcObject = cameraStream;
  } catch {
    hint.textContent = 'Camera access isn\'t available here — please use "Upload a photo" instead.';
    stopCamera(); panel.hidden = true; actions.style.display = 'flex';
  }
}

function captureFromCamera() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  const w = video.videoWidth || 480, h = video.videoHeight || 360;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.translate(w, 0); ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, w, h);
  setPhoto(canvas.toDataURL('image/png'));
  cancelCamera();
}

function cancelCamera() {
  stopCamera();
  document.getElementById('camera-panel').hidden = true;
  document.getElementById('photo-actions').style.display = 'flex';
}
function stopCamera() { if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; } }

/* Card preview */
function eagleSvgInline() {
  return `<svg class="watermark" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M20 4 C13 10 4 12 2 13 C7 15 12 15 16 13 C13 18 10 24 4 29 C11 28 17 24 20 18 C23 24 29 28 36 29 C30 24 27 18 24 13 C28 15 33 15 38 13 C36 12 27 10 20 4Z" fill="white"/></svg>`;
}
function eagleSvgSmall() {
  return `<svg class="card-eagle" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M20 4 C13 10 4 12 2 13 C7 15 12 15 16 13 C13 18 10 24 4 29 C11 28 17 24 20 18 C23 24 29 28 36 29 C30 24 27 18 24 13 C28 15 33 15 38 13 C36 12 27 10 20 4Z" fill="#C99A2E"/></svg>`;
}

function renderCardPreview() {
  document.getElementById('v-name').value = state.card.name;
  document.getElementById('v-studno').value = state.card.studno;
  document.getElementById('v-faculty').value = FACULTIES[seededInt(state.user.email + 'f', 0, FACULTIES.length - 1)];
  document.getElementById('v-year').selectedIndex = seededInt(state.user.email + 'y', 0, 3);
  document.getElementById('v-validuntil').textContent = state.card.validUntil;
  ['v-name', 'v-studno', 'v-faculty', 'v-year'].forEach(id => {
    document.getElementById(id).addEventListener('input', drawCard);
    document.getElementById(id).addEventListener('change', drawCard);
  });
  drawCard();
}

function drawCard() {
  const name = document.getElementById('v-name').value || '—';
  const studno = document.getElementById('v-studno').value || '—';
  const faculty = document.getElementById('v-faculty').value;
  const year = document.getElementById('v-year').value;
  const photoBlock = state.photo ? `<img src="${state.photo}">` : '👤';
  document.getElementById('idcard-preview').innerHTML = `
    ${eagleSvgInline()}
    <div class="card-top">
      <div class="card-brand">
        ${eagleSvgSmall()}
        <div>
          <div class="card-uname">UNIVERSITY<br>OF ZULULAND</div>
          <div class="card-motto">Diligentia Cresco</div>
        </div>
      </div>
      <div class="card-pill">STUDENT</div>
    </div>
    <div class="card-body">
      <div class="card-photo">${photoBlock}</div>
      <div class="card-fields">
        <div><div class="cf-label">Name</div><div class="cf-value">${escapeHtml(name)}</div></div>
        <div><div class="cf-label">Student no.</div><div class="cf-value mono">${escapeHtml(studno)}</div></div>
        <div><div class="cf-label">Faculty</div><div class="cf-value">${escapeHtml(faculty)}</div></div>
        <div><div class="cf-label">Year</div><div class="cf-value">${escapeHtml(year)}</div></div>
      </div>
    </div>
    <div class="card-bottom">
      <div class="barcode">${Array.from({ length: 22 }).map((_, i) => `<span style="height:${6 + ((i * 7) % 10)}px"></span>`).join('')}</div>
      <div class="card-id">VALID UNTIL ${state.card.validUntil.toUpperCase()}</div>
    </div>
  `;
}
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }