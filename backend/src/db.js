const { Pool } = require('pg')
const { DATABASE_URL } = require('./config')

// Admin pool — connects to the default DB for creating/dropping user databases
const adminPool = new Pool({ connectionString: DATABASE_URL })

// Cache of pools per user database
const pools = new Map()

function dbUrlFor(dbName) {
  const url = new URL(DATABASE_URL)
  url.pathname = `/${dbName}`
  return url.toString()
}

async function getUserPool(dbName) {
  if (!pools.has(dbName)) {
    pools.set(dbName, new Pool({ connectionString: dbUrlFor(dbName) }))
  }
  return pools.get(dbName)
}

async function createUserDb(dbName) {
  // Identifiers cannot be parameterized — caller must validate name first
  await adminPool.query(`CREATE DATABASE "${dbName}"`)
}

async function dropUserDb(dbName) {
  // Terminate active connections, close pool, then drop
  await adminPool.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
    [dbName]
  )
  if (pools.has(dbName)) {
    await pools.get(dbName).end()
    pools.delete(dbName)
  }
  await adminPool.query(`DROP DATABASE IF EXISTS "${dbName}"`)
}

async function listUserDbs(address) {
  const prefix = `usr_${address}_`
  const result = await adminPool.query(
    `SELECT datname FROM pg_database WHERE datname LIKE $1 ORDER BY datname`,
    [prefix + '%']
  )
  return result.rows.map(r => r.datname.slice(prefix.length))
}

module.exports = { getUserPool, createUserDb, dropUserDb, listUserDbs }
