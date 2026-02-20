const router = require('express').Router()
const authMiddleware = require('../middleware/auth')
const { createUserDb, dropUserDb, listUserDbs, getUserPool } = require('../db')

router.use(authMiddleware)

// Strict name validation: starts with letter, letters/numbers/underscores, max 40 chars
const validName = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/

function dbNameFor(address, name) {
  return `usr_${address}_${name}`
}

const wrap = fn => async (req, res) => {
  try {
    await fn(req, res)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}

// List user's databases
router.get('/', wrap(async (req, res) => {
  const names = await listUserDbs(req.user)
  res.json({ databases: names })
}))

// Create a database
router.post('/', wrap(async (req, res) => {
  const { name } = req.body
  if (!name || !validName.test(name)) {
    return res.status(400).json({
      error: 'Name must start with a letter, contain only letters/numbers/underscores, max 40 chars',
    })
  }
  await createUserDb(dbNameFor(req.user, name))
  res.status(201).json({ name })
}))

// Drop a database
router.delete('/:name', wrap(async (req, res) => {
  const { name } = req.params
  if (!validName.test(name)) {
    return res.status(400).json({ error: 'Invalid database name' })
  }
  await dropUserDb(dbNameFor(req.user, name))
  res.json({ deleted: name })
}))

// Run a SQL query against a user's database
router.post('/:name/query', wrap(async (req, res) => {
  const { name } = req.params
  const { sql } = req.body
  if (!validName.test(name)) {
    return res.status(400).json({ error: 'Invalid database name' })
  }
  if (!sql?.trim()) {
    return res.status(400).json({ error: 'SQL query is required' })
  }
  const pool = await getUserPool(dbNameFor(req.user, name))
  const result = await pool.query(sql)
  res.json({
    rows: result.rows,
    fields: result.fields?.map(f => f.name) ?? [],
    rowCount: result.rowCount,
    command: result.command,
  })
}))

module.exports = router
