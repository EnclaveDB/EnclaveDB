require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { PORT } = require('./config')

const app = express()

app.use(cors())
app.use(express.json({ limit: '1mb' }))

app.use('/auth', require('./routes/auth'))
app.use('/db', require('./routes/db'))

app.get('/health', (_, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => {
  console.log(`PrivateDB API running on port ${PORT}`)
})
