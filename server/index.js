import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { RoomManager } from './room-manager.js';
import { parseMessage, validateHello, ServerMsg, ClientMsg, RoomAction } from './protocol.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const { values: args } = parseArgs({
  options: {
    port: { type: 'string', default: process.env.PORT || '8080' },
    host: { type: 'string', default: '0.0.0.0' },
  },
});
const PORT = Number(args.port);
const HOST = args.host;
const MAX_ROOMS = Number(process.env.MAX_ROOMS) || 50;

// Разрешённые Origin для WebSocket. Список через запятую: ALLOWED_ORIGINS=https://dice.example.com,http://localhost:8080.
// Если переменная не задана — разрешено всё (удобно для разработки), но мы это шумно логируем.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const ORIGIN_CHECK_ENABLED = ALLOWED_ORIGINS.length > 0;
if (!ORIGIN_CHECK_ENABLED) {
  console.warn('[WARN] ALLOWED_ORIGINS не задан — Origin не проверяется. Для прод-деплоя ОБЯЗАТЕЛЬНО задайте список через .env / окружение.');
}

// Rate-limit на handshake: max 10 hello/min с одного IP.
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const handshakeBuckets = new Map(); // ip -> { count, windowStart }

function rateLimitOk(ip) {
  const now = Date.now();
  const bucket = handshakeBuckets.get(ip);
  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    handshakeBuckets.set(ip, { count: 1, windowStart: now });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= RATE_LIMIT_MAX;
}

// Периодически чистим протухшие бакеты, чтобы Map не разрастался.
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of handshakeBuckets) {
    if (now - bucket.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      handshakeBuckets.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW_MS).unref();

function clientIp(req) {
  // За Cloudflare Tunnel реальный IP лежит в cf-connecting-ip.
  const cf = req.headers['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.length > 0) return cf;
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) return xff.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

const app = express();
app.use(express.static(publicDir));
app.get('/healthz', (_req, res) => res.json({ ok: true, ts: Date.now() }));

const server = createServer(app);
const wss = new WebSocketServer({ server });

const manager = new RoomManager({ maxRooms: MAX_ROOMS });

const PING_INTERVAL_MS = 30_000;
const PING_TIMEOUT_MS = 10_000;

wss.on('connection', (socket, req) => {
  // Origin check
  if (ORIGIN_CHECK_ENABLED) {
    const origin = req.headers.origin;
    if (!ALLOWED_ORIGINS.includes(origin)) {
      try {
        socket.send(JSON.stringify({ type: ServerMsg.ERROR, payload: { code: 'origin_not_allowed' } }));
      } catch {}
      try { socket.close(1008, 'origin_not_allowed'); } catch {}
      return;
    }
  }

  const ip = clientIp(req);
  let player = null;
  let room = null;
  let alive = true;
  let pingTimer = null;
  let pingTimeoutTimer = null;

  function schedulePing() {
    pingTimer = setTimeout(() => {
      if (!alive) return;
      try { socket.send(JSON.stringify({ type: ServerMsg.PING })); } catch {}
      pingTimeoutTimer = setTimeout(() => {
        try { socket.terminate(); } catch {}
      }, PING_TIMEOUT_MS);
    }, PING_INTERVAL_MS);
  }
  schedulePing();

  socket.on('message', (raw) => {
    const msg = parseMessage(raw.toString());
    if (!msg) return;

    if (pingTimeoutTimer) {
      clearTimeout(pingTimeoutTimer);
      pingTimeoutTimer = null;
    }
    if (pingTimer) clearTimeout(pingTimer);
    schedulePing();

    if (msg.type === ClientMsg.PONG) return;

    if (msg.type === ClientMsg.HELLO) {
      if (!rateLimitOk(ip)) {
        try { socket.send(JSON.stringify({ type: ServerMsg.ERROR, payload: { code: 'rate_limited' } })); } catch {}
        try { socket.close(); } catch {}
        return;
      }
      const v = validateHello(msg.payload);
      if (!v) {
        socket.send(JSON.stringify({ type: ServerMsg.ERROR, payload: { code: 'bad_hello' } }));
        return;
      }

      // Найти или создать комнату.
      if (v.roomAction === RoomAction.CREATE) {
        const created = manager.createRoom();
        if (!created) {
          socket.send(JSON.stringify({ type: ServerMsg.ERROR, payload: { code: 'too_many_rooms' } }));
          try { socket.close(); } catch {}
          return;
        }
        room = created.room;
      } else {
        room = manager.getRoom(v.roomCode);
        if (!room) {
          socket.send(JSON.stringify({ type: ServerMsg.ERROR, payload: { code: 'room_not_found' } }));
          try { socket.close(); } catch {}
          return;
        }
      }

      const result = room.addPlayer(v.clientId, v.name, socket, v.color);
      if (!result.player) {
        socket.send(JSON.stringify({ type: ServerMsg.ERROR, payload: { code: result.error || 'cannot_join' } }));
        try { socket.close(); } catch {}
        return;
      }
      player = result.player;
      socket.send(JSON.stringify({
        type: ServerMsg.EVENT,
        payload: {
          type: 'joined',
          playerId: player.id,
          isNew: result.isNew,
          roomCode: room.code,
        },
      }));
      return;
    }

    if (!player || !room) {
      socket.send(JSON.stringify({ type: ServerMsg.ERROR, payload: { code: 'hello_required' } }));
      return;
    }

    room.handleMessage(player, msg);
  });

  socket.on('close', () => {
    alive = false;
    if (pingTimer) clearTimeout(pingTimer);
    if (pingTimeoutTimer) clearTimeout(pingTimeoutTimer);
    if (player && room) room.removePlayer(player.clientId);
  });

  socket.on('error', () => {
    alive = false;
  });
});

server.listen(PORT, HOST, () => {
  const bindHint = HOST === '0.0.0.0' ? 'all interfaces' : HOST;
  console.log(`KCD2 Dice server (v0.5 online) listening on http://localhost:${PORT}  (bound to ${bindHint})`);
  console.log(`Max rooms: ${MAX_ROOMS}.  Origin check: ${ORIGIN_CHECK_ENABLED ? ALLOWED_ORIGINS.join(', ') : 'DISABLED (dev mode)'}`);
});

function gracefulShutdown(signal) {
  console.log(`\n[${signal}] shutdown — disposing rooms and closing server...`);
  manager.shutdown();
  wss.close();
  server.close(() => process.exit(0));
  // Если что-то висит дольше 5 сек — exit жёстко.
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
