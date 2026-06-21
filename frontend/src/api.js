/**
 * api.js — every backend call Flora's frontend makes lives here.
 * Centralizing this means: if the backend URL or a route's shape changes,
 * there's exactly one file to update, not five scattered fetch calls.
 */

const API_BASE = process.env.REACT_APP_API_BASE || 'https://flora-iho3.onrender.com'

// ── Auth token helpers (replaces anonymous getUserId) ─────────────────────────
export function getToken()  { return localStorage.getItem('flora_token') }
export function setToken(t) { localStorage.setItem('flora_token', t) }
export function clearToken(){ localStorage.removeItem('flora_token') }
export function isLoggedIn(){ return !!getToken() }

async function request(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function signup(display_name, email, password) {
  const data = await request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ display_name, email, password }),
  })
  setToken(data.token)
  return data.user
}

export async function login(email, password) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setToken(data.token)
  return data.user
}

export function logout() { clearToken() }

export function getMe() { return request('/auth/me') }

// ── Existing API calls (user_id removed — backend reads from token now) ────────
export function previewSwap(text) {
  return request('/preview-swap', {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

export function checkIn(text, userResponse = null, overrideMode = null) {
  return request('/check-in', {
    method: 'POST',
    body: JSON.stringify({
      text,
      user_response: userResponse,
      override_mode: overrideMode,
    }),
  })
}

export function getStats(period = 'week') {
  return request(`/stats?period=${period}`)
}

export function getHistory(limit = 50) {
  return request(`/history?limit=${limit}`)
}

export function getWeather() {
  return request('/weather')
}

export function getInsights() {
  return request('/insights')
}

export function getProfile() {
  return request('/profile')
}

export function updateProfile(updates) {
  return request('/profile', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

export function scanReceipt(rawText) {
  return request('/receipt-scan', {
    method: 'POST',
    body: JSON.stringify({ raw_text: rawText }),
  })
}

export function scanReceiptImage(file) {
  const token    = getToken()
  const formData = new FormData()
  formData.append('file', file)

  return fetch(`${API_BASE}/scan-receipt-image`, {
    method:  'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body:    formData,
  }).then(r => r.json())
}