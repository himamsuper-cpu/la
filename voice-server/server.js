import { randomBytes, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { AccessToken, LiveKitAPI } from 'livekit-server-sdk'

const port = Number(process.env.PORT || 8787)
const liveKitApiUrl = process.env.LIVEKIT_API_URL
const liveKitWsUrl = process.env.LIVEKIT_WS_URL
const apiKey = process.env.LIVEKIT_API_KEY
const apiSecret = process.env.LIVEKIT_API_SECRET
const maxParticipants = 8
const rateLimitWindowMs = 60_000
const maxRequestsPerWindow = 30
const requestCounts = new Map()

if (!liveKitApiUrl || !liveKitWsUrl || !apiKey || !apiSecret) {
  throw new Error('Set LIVEKIT_API_URL, LIVEKIT_WS_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.')
}

const liveKit = new LiveKitAPI({ host: liveKitApiUrl, apiKey, secret: apiSecret })

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
  })
  if (status === 204) {
    response.end()
    return
  }
  response.end(JSON.stringify(payload))
}

async function readJson(request) {
  let size = 0
  const chunks = []
  for await (const chunk of request) {
    size += chunk.length
    if (size > 4096) throw Object.assign(new Error('Request body is too large.'), { status: 413 })
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 })
  }
}

function checkRateLimit(address) {
  const now = Date.now()
  const current = requestCounts.get(address)
  if (!current || current.expiresAt <= now) {
    requestCounts.set(address, { count: 1, expiresAt: now + rateLimitWindowMs })
    return true
  }
  current.count += 1
  return current.count <= maxRequestsPerWindow
}

function createRoomCode() {
  return randomBytes(5).toString('hex').toUpperCase()
}

function normalizeDisplayName(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 32)
}

async function createParticipantToken(code, displayName) {
  const token = new AccessToken(apiKey, apiSecret, {
    identity: randomUUID(),
    name: displayName,
    ttl: '15m',
  })
  token.addGrant({
    roomJoin: true,
    room: code,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  })
  return token.toJwt()
}

async function createRoom(displayName) {
  let code
  for (let attempt = 0; attempt < 3; attempt += 1) {
    code = createRoomCode()
    const existing = await liveKit.room.listRooms([code])
    if (existing.length === 0) break
    code = undefined
  }
  if (!code) throw new Error('Could not allocate a room code.')

  await liveKit.room.createRoom({
    name: code,
    maxParticipants,
    emptyTimeout: 300,
  })
  return { code, token: await createParticipantToken(code, displayName), livekitUrl: liveKitWsUrl }
}

async function joinRoom(code, displayName) {
  const rooms = await liveKit.room.listRooms([code])
  if (rooms.length === 0) return { status: 404, error: 'Room not found or already closed.' }
  const participants = await liveKit.room.listParticipants(code)
  if (participants.length >= maxParticipants) return { status: 409, error: 'Room is full.' }
  return { status: 200, payload: { code, token: await createParticipantToken(code, displayName), livekitUrl: liveKitWsUrl } }
}

async function handleRequest(request, response) {
  if (request.method === 'OPTIONS') return sendJson(response, 204, {})
  if (request.method === 'GET' && request.url === '/health') return sendJson(response, 200, { status: 'ok' })
  if (request.method !== 'POST' || !['/api/rooms', '/api/rooms/join'].includes(request.url)) {
    return sendJson(response, 404, { error: 'Not found.' })
  }

  const address = request.socket.remoteAddress || 'unknown'
  if (!checkRateLimit(address)) return sendJson(response, 429, { error: 'Too many requests. Try again shortly.' })

  try {
    const body = await readJson(request)
    const displayName = normalizeDisplayName(body.displayName)
    if (!displayName) return sendJson(response, 400, { error: 'Enter a display name.' })

    if (request.url === '/api/rooms') {
      return sendJson(response, 201, await createRoom(displayName))
    }

    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
    if (!/^[A-F0-9]{10}$/.test(code)) return sendJson(response, 400, { error: 'Enter a valid 10-character invite code.' })
    const result = await joinRoom(code, displayName)
    if (result.status !== 200) return sendJson(response, result.status, { error: result.error })
    return sendJson(response, 200, result.payload)
  } catch (error) {
    const status = Number(error?.status) || 502
    if (status < 500) return sendJson(response, status, { error: error.message })
    console.error('LiveKit request failed:', error instanceof Error ? error.message : 'Unknown error')
    return sendJson(response, 502, { error: 'Voice service is temporarily unavailable.' })
  }
}

const server = createServer((request, response) => {
  void handleRequest(request, response)
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Moon Voice Room service listening on port ${port}`)
})
