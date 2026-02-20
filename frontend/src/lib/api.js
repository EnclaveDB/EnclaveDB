const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

async function request(path, options = {}, token = null) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export const api = {
  getNonce:  (address)            => request(`/auth/nonce?address=${encodeURIComponent(address)}`),
  verify:    (address, signature) => request('/auth/verify', { method: 'POST', body: JSON.stringify({ address, signature }) }),
  listDbs:   (token)              => request('/db', {}, token),
  createDb:  (name, token)        => request('/db', { method: 'POST', body: JSON.stringify({ name }) }, token),
  deleteDb:  (name, token)        => request(`/db/${name}`, { method: 'DELETE' }, token),
  query:     (db, sql, token)     => request(`/db/${db}/query`, { method: 'POST', body: JSON.stringify({ sql }) }, token),
}
