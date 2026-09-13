let verifyCaptureTarget = null;
let verifyIdPhoto = null;
let verifySelfie = null;

function wireVerification() {
  document.getElementById('btn-capture-id').addEventListener('click', () => openVerifyCamera('id'));
  document.getElementById('btn-capture-selfie').addEventListener('click', () => openVerifyCamera('selfie'));
  document.getElementById('btn-verify-capture').addEventListener('click', captureVerifyFrame);
  document.getElementById('btn-verify-cancel').addEventListener('click', closeVerifyCamera);
  document.getElementById('btn-verify-back').addEventListener('click', () => { renderHome(); goTo('screen-home'); });
  document.getElementById('btn-verify-submit').addEventListener('click', submitVerification);
  document.getElementById('in-idnumber').addEventListener('input', checkVerifyReady);
}

function openVerifyCamera(target) {
  verifyCaptureTarget = target;
  const panel = document.getElementById('verify-camera-panel');
  const video = document.getElementById('verify-camera-video');
  const hint = document.getElementById('verify-camera-hint');
  hint.textContent = '';
  panel.hidden = false;

  navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: target === 'selfie' ? 'user' : 'environment',
      width: { ideal: 1280 }, height: { ideal: 720 },
    },
    audio: false,
  }).then(stream => {
    video.srcObject = stream;
    window._verifyStream = stream;
  }).catch(() => {
    hint.textContent = 'Camera unavailable. Grant permission and try again.';
    panel.hidden = true;
  });
}

function captureVerifyFrame() {
  const video = document.getElementById('verify-camera-video');
  const canvas = document.getElementById('verify-camera-canvas');
  const w = video.videoWidth || 640, h = video.videoHeight || 480;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (verifyCaptureTarget === 'selfie') {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, w, h);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  if (verifyCaptureTarget === 'id') {
    verifyIdPhoto = dataUrl;
    document.getElementById('slot-id-photo').innerHTML = `<img src="${dataUrl}">`;
  } else {
    verifySelfie = dataUrl;
    document.getElementById('slot-selfie').innerHTML = `<img src="${dataUrl}">`;
  }
  closeVerifyCamera();
  checkVerifyReady();
}

function closeVerifyCamera() {
  if (window._verifyStream) {
    window._verifyStream.getTracks().forEach(t => t.stop());
    window._verifyStream = null;
  }
  document.getElementById('verify-camera-panel').hidden = true;
}

function checkVerifyReady() {
  const idNumber = document.getElementById('in-idnumber').value.trim();
  const ready = idNumber.length >= 6 && verifyIdPhoto && verifySelfie;
  document.getElementById('btn-verify-submit').disabled = !ready;
}

async function submitVerification() {
  const status = document.getElementById('verify-status');
  status.textContent = 'Checking your identity…';
  status.className = 'hint';

  const idNumber = document.getElementById('in-idnumber').value.trim();
  const selfieB64 = verifySelfie.split(',')[1] || '';
  const idB64 = verifyIdPhoto.split(',')[1] || '';

  const { ok, data } = await api('/api/verification/submit', {
    method: 'POST',
    body: JSON.stringify({ id_number: idNumber, selfie_image: selfieB64, id_photo: idB64 }),
  });

  if (!ok) {
    status.textContent = data.error || 'Verification failed.';
    status.className = 'hint warn';
    return;
  }

  if (data.outcome === 'approved') {
    status.textContent = 'Identity verified ✓';
    state.user.verificationStatus = 'verified';
    setTimeout(() => { goTo('screen-photo'); }, 1200);
  } else if (data.outcome === 'pending_review') {
    status.textContent = 'Your case is under manual review. You will be notified by email.';
    status.className = 'hint warn';
    state.user.verificationStatus = 'pending_review';
  } else {
    status.textContent = 'We could not verify your identity. Please try again or contact support.';
    status.className = 'hint warn';
    state.user.verificationStatus = 'rejected';
  }
}

function refreshVerificationScreen() {
  const status = document.getElementById('verify-status');
  if (state.user.verificationStatus === 'pending_review') {
    status.textContent = 'Your identity check is currently under manual review. We will email you when it is complete.';
    status.className = 'hint warn';
    document.getElementById('btn-verify-submit').disabled = true;
  } else if (state.user.verificationStatus === 'verified') {
    status.textContent = 'Your identity is verified. You can continue.';
    status.className = 'hint';
    document.getElementById('btn-verify-submit').disabled = true;
  }
}