const router = require('express').Router()
const { ethers } = require('ethers')
const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('../config')

// In-memory nonce store: address -> { message, expires }
// Fine for TEE single-instance deployment; nonces are short-lived
const pending = new Map()

router.get('/nonce', (req, res) => {
  const { address } = req.query
  if (!address || !ethers.isAddress(address)) {
    return res.status(400).json({ error: 'Invalid Ethereum address' })
  }

  const addr = address.toLowerCase()
  const nonce = ethers.hexlify(ethers.randomBytes(16))
  const issuedAt = new Date().toISOString()

  const message = [
    'Sign in to PrivateDB',
    '',
    'This signature proves ownership of your wallet.',
    'It does not send a transaction or cost any gas.',
    '',
    `Wallet: ${address}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join('\n')

  pending.set(addr, { message, expires: Date.now() + 5 * 60_000 })
  res.json({ message })
})

router.post('/verify', (req, res) => {
  const { address, signature } = req.body
  if (!address || !signature) {
    return res.status(400).json({ error: 'Missing address or signature' })
  }

  const addr = address.toLowerCase()
  const entry = pending.get(addr)

  if (!entry || Date.now() > entry.expires) {
    return res.status(401).json({ error: 'Nonce expired — request a new one' })
  }

  try {
    const recovered = ethers.verifyMessage(entry.message, signature).toLowerCase()
    if (recovered !== addr) {
      return res.status(401).json({ error: 'Signature does not match wallet' })
    }
    pending.delete(addr)
    const token = jwt.sign({ address: addr }, JWT_SECRET, { expiresIn: '24h' })
    res.json({ token, address: addr })
  } catch {
    res.status(401).json({ error: 'Invalid signature' })
  }
})

module.exports = router
