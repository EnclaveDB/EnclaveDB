import { useState, useEffect, useCallback } from 'react'
import { BrowserProvider } from 'ethers'
import { api } from './lib/api'

export default function App() {
  const [wallet, setWallet]       = useState(null)   // { address, token }
  const [databases, setDatabases] = useState([])
  const [selectedDb, setSelectedDb] = useState(null)
  const [sql, setSql]             = useState('SELECT version();')
  const [result, setResult]       = useState(null)
  const [newDbName, setNewDbName] = useState('')
  const [error, setError]         = useState(null)
  const [loading, setLoading]     = useState({ auth: false, dbs: false, query: false, create: false })

  const setLoad = (key, val) => setLoading(l => ({ ...l, [key]: val }))

  // Restore session from localStorage
  useEffect(() => {
    const token   = localStorage.getItem('pdb_token')
    const address = localStorage.getItem('pdb_address')
    if (token && address) setWallet({ address, token })
  }, [])

  const fetchDbs = useCallback(async (w) => {
    const auth = w || wallet
    if (!auth) return
    setLoad('dbs', true)
    try {
      const { databases } = await api.listDbs(auth.token)
      setDatabases(databases)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoad('dbs', false)
    }
  }, [wallet])

  useEffect(() => { fetchDbs() }, [fetchDbs])

  const connect = async () => {
    if (!window.ethereum) return setError('MetaMask not detected')
    setLoad('auth', true)
    setError(null)
    try {
      const provider = new BrowserProvider(window.ethereum)
      const signer   = await provider.getSigner()
      const address  = await signer.getAddress()
      const { message } = await api.getNonce(address)
      const signature    = await signer.signMessage(message)
      const { token }    = await api.verify(address, signature)
      const w = { address, token }
      setWallet(w)
      localStorage.setItem('pdb_token',   token)
      localStorage.setItem('pdb_address', address)
      fetchDbs(w)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoad('auth', false)
    }
  }

  const disconnect = () => {
    setWallet(null)
    setDatabases([])
    setSelectedDb(null)
    setResult(null)
    localStorage.removeItem('pdb_token')
    localStorage.removeItem('pdb_address')
  }

  const createDb = async () => {
    if (!newDbName.trim()) return
    setLoad('create', true)
    setError(null)
    try {
      await api.createDb(newDbName.trim(), wallet.token)
      setNewDbName('')
      await fetchDbs()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoad('create', false)
    }
  }

  const deleteDb = async (name) => {
    if (!confirm(`Drop database "${name}"? This cannot be undone.`)) return
    try {
      await api.deleteDb(name, wallet.token)
      if (selectedDb === name) { setSelectedDb(null); setResult(null) }
      await fetchDbs()
    } catch (e) {
      setError(e.message)
    }
  }

  const runQuery = async () => {
    if (!selectedDb || !sql.trim()) return
    setLoad('query', true)
    setResult(null)
    setError(null)
    try {
      const data = await api.query(selectedDb, sql, wallet.token)
      setResult(data)
    } catch (e) {
      setResult({ error: e.message })
    } finally {
      setLoad('query', false)
    }
  }

  const short = (addr) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  return (
    <div className="app">
      {/* Top bar */}
      <header className="topbar">
        <div className="logo">
          <span className="logo-lock">&#x1F512;</span>
          <span className="logo-text">PrivateDB</span>
          <span className="logo-sub">on EigenCompute TEE</span>
        </div>
        <div>
          {wallet ? (
            <div className="wallet-row">
              <span className="wallet-chip">{short(wallet.address)}</span>
              <button className="btn btn-ghost" onClick={disconnect}>Disconnect</button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={connect} disabled={loading.auth}>
              {loading.auth ? 'Signing in...' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>&#x2715;</button>
        </div>
      )}

      {/* Landing */}
      {!wallet ? (
        <div className="landing">
          <div className="landing-card">
            <h1>Your data, cryptographically yours</h1>
            <p>
              Connect your wallet to access private Postgres databases running inside an
              EigenCompute Trusted Execution Environment. No passwords. No admin access.
              Not even the operator can read your data.
            </p>
            <ul>
              <li>Wallet signature proves identity — no passwords</li>
              <li>Data is encrypted inside the TEE — operators are locked out</li>
              <li>Full Postgres — any SQL, any schema</li>
            </ul>
            <button className="btn btn-primary btn-lg" onClick={connect} disabled={loading.auth}>
              {loading.auth ? 'Connecting...' : 'Connect MetaMask'}
            </button>
          </div>
        </div>
      ) : (
        <div className="workspace">
          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sidebar-section">
              <div className="sidebar-label">Databases</div>
              {loading.dbs ? (
                <div className="sidebar-muted">Loading...</div>
              ) : databases.length === 0 ? (
                <div className="sidebar-muted">No databases yet</div>
              ) : (
                <ul className="db-list">
                  {databases.map(db => (
                    <li key={db} className={`db-item${selectedDb === db ? ' active' : ''}`}>
                      <button className="db-name" onClick={() => { setSelectedDb(db); setResult(null) }}>
                        <span className="db-dot" /> {db}
                      </button>
                      <button className="db-delete" onClick={() => deleteDb(db)} title="Drop database">
                        &#x2715;
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="sidebar-section sidebar-bottom">
              <div className="sidebar-label">New Database</div>
              <div className="create-row">
                <input
                  className="input"
                  placeholder="db_name"
                  value={newDbName}
                  onChange={e => setNewDbName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createDb()}
                />
                <button
                  className="btn btn-primary"
                  onClick={createDb}
                  disabled={loading.create || !newDbName.trim()}
                >
                  {loading.create ? '...' : 'Create'}
                </button>
              </div>
            </div>
          </aside>

          {/* Main panel */}
          <main className="main">
            {!selectedDb ? (
              <div className="empty-main">Select a database to start querying</div>
            ) : (
              <>
                <div className="query-bar">
                  <span className="query-db-name">
                    <span className="db-dot" /> {selectedDb}
                  </span>
                  <button className="btn btn-primary" onClick={runQuery} disabled={loading.query}>
                    {loading.query ? 'Running...' : '▶  Run'}
                  </button>
                </div>

                <textarea
                  className="sql-editor"
                  value={sql}
                  onChange={e => setSql(e.target.value)}
                  onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runQuery() }}
                  placeholder="SELECT * FROM ..."
                  spellCheck={false}
                />

                {result && (
                  <div className="results">
                    {result.error ? (
                      <div className="result-error">
                        <span className="result-error-label">Error</span>
                        {result.error}
                      </div>
                    ) : (
                      <>
                        <div className="result-meta">
                          {result.command} &mdash; {result.rowCount} row{result.rowCount !== 1 ? 's' : ''}
                        </div>
                        {result.fields.length > 0 && (
                          <div className="table-wrap">
                            <table className="result-table">
                              <thead>
                                <tr>{result.fields.map(f => <th key={f}>{f}</th>)}</tr>
                              </thead>
                              <tbody>
                                {result.rows.map((row, i) => (
                                  <tr key={i}>
                                    {result.fields.map(f => (
                                      <td key={f}>{row[f] == null ? <span className="null">NULL</span> : String(row[f])}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      )}
    </div>
  )
}
