const state = {
  user: {
    name: '', email: '', studentNumber: '', campus: '',
    popiaConsent: false, createdAt: null,
    pathway: null, verificationStatus: 'unverified',
    isAdmin: false, staysOnCampus: false,
  },
  sessionToken: null,
  docs: { id: null, registration: null, residence: null },
  onCampus: false,
  path: null,
  photo: null,
  card: { name: '', studno: '', faculty: '', year: '', validUntil: '' },
  bookingsMade: {},
  chosenDate: null,
  chosenSlotIdx: null,
  booked: null,
};

let pendingUploadKey = null;
let cameraStream = null;

const FACULTIES = [
  'Education',
  'Science, Agriculture & Engineering',
  'Commerce, Administration & Law',
  'Humanities & Social Sciences',
];

const SLOTS_O1 = [
  { label: '08:00–09:00', max: 90 }, { label: '09:00–10:00', max: 90 },
  { label: '10:00–11:00', max: 80 }, { label: '11:00–12:00', max: 80 },
  { label: '12:00–13:00', max: 70 }, { label: '13:00–14:00', max: 60 },
  { label: '14:00–15:00', max: 30 },
];
const SLOTS_O2 = [
  { label: '08:00–10:00', max: 100 }, { label: '10:00–12:00', max: 100 },
  { label: '12:00–14:00', max: 90 }, { label: '14:00–16:00', max: 80 },
];

function slotsFor(pathNum) { return pathNum === 1 ? SLOTS_O1 : SLOTS_O2; }

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}
function seededInt(seed, min, max) { return min + (hashStr(seed) % (max - min + 1)); }

function getUpcomingWeekdays(n) {
  const out = []; let d = new Date(); d.setDate(d.getDate() + 2);
  while (out.length < n) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function fmtDate(d) { return d.toLocaleDateString('en-ZA', { weekday: 'short', day: '2-digit', month: 'short' }); }
function fmtDateLong(d) { return d.toLocaleDateString('en-ZA', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }); }
function dkey(d) { return d.toISOString().slice(0, 10); }

function baseRemaining(dateObj, pathNum, slotIdx) {
  const slots = slotsFor(pathNum);
  const cap = slots[slotIdx].max;
  const key = dkey(dateObj) + ':p' + pathNum + ':s' + slotIdx;
  const floor = Math.floor(cap * 0.35);
  let rem = cap - seededInt(key, 0, cap - floor);
  const dayIdx = Math.abs(hashStr(dkey(dateObj) + 'p' + pathNum)) % slots.length;
  if (dayIdx === slotIdx) rem = 0;
  return rem;
}
function effectiveRemaining(dateObj, pathNum, slotIdx) {
  const key = dkey(dateObj) + ':p' + pathNum + ':s' + slotIdx;
  return Math.max(0, baseRemaining(dateObj, pathNum, slotIdx) - (state.bookingsMade[key] || 0));
}
function dayTotalRemaining(dateObj, pathNum) {
  const slots = slotsFor(pathNum); let sum = 0;
  for (let i = 0; i < slots.length; i++) sum += effectiveRemaining(dateObj, pathNum, i);
  return sum;
}
function dayTotalMax(pathNum) { return slotsFor(pathNum).reduce((a, s) => a + s.max, 0); }

function docsComplete() {
  if (state.path === 2) return !!state.docs.registration;
  return !!(state.docs.id && state.docs.registration);
}

function pathwayLabel() {
  if (state.path === 1 || state.user.pathway === 1) return 'Online production (collect on campus)';
  if (state.path === 2 || state.user.pathway === 2) return 'On-campus production';
  return 'Not chosen';
}

function verificationLabel() {
  if (state.path === 2 || state.user.pathway === 2) return 'Verified in person on campus';
  switch (state.user.verificationStatus) {
    case 'verified': return 'Verified';
    case 'pending_review': return 'Pending manual review';
    case 'rejected': return 'Rejected';
    case 'not_required': return 'Not required';
    default: return 'Not started';
  }
}