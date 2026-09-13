async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.sessionToken && !headers.Authorization) {
    headers.Authorization = 'Bearer ' + state.sessionToken;
  }
  const res = await fetch(path, { ...options, headers });
  let data = {};
  try { data = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, data };
}