const jwt = require('jsonwebtoken')
const { JWT_SECRET } = require('../config')

module.exports = (req, res, next) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET)
    req.user = payload.address // normalized lowercase address
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
