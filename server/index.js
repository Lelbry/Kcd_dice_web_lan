import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { GameRoom } from './room.js';
import { parseMessage, validateHello, ServerMsg, ClientMsg } from './protocol.js';
import { BotDriver } from './bot.js';

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

const app = express();
app.use(express.static(publicDir));
app.get('/healthz', (_req, res) => res.json({ ok: true, ts: Date.now() }));

const server = createServer(app);
const wss = new WebSocketServer({ server });

const room = new GameRoom();
const botDriver = new BotDriver(room);
room.setStateChangedHandler(() => botDriver.tick());

const PING_INTERVAL_MS = 30_000;
const PING_TIMEOUT_MS = 10_000;

wss.on('connection', (socket) => {
  let player = null;
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
      const v = validateHello(msg.payload);
      if (!v) {
        socket.send(JSON.stringify({ type: ServerMsg.ERROR, payload: { code: 'bad_hello' } }));
        return;
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
        payload: { type: 'joined', playerId: player.id, isNew: result.isNew },
      }));
      return;
    }

    if (!player) {
      socket.send(JSON.stringify({ type: ServerMsg.ERROR, payload: { code: 'hello_required' } }));
      return;
    }

    room.handleMessage(player, msg);
  });

  socket.on('close', () => {
    alive = false;
    if (pingTimer) clearTimeout(pingTimer);
    if (pingTimeoutTimer) clearTimeout(pingTimeoutTimer);
    if (player) room.removePlayer(player.clientId);
  });

  socket.on('error', () => {
    alive = false;
  });
});

server.listen(PORT, HOST, () => {
  const lanHint = HOST === '0.0.0.0' ? 'all interfaces' : HOST;
  console.log(`KCD2 Dice server listening on http://localhost:${PORT}  (bound to ${lanHint})`);
  console.log(`Share the URL  http://<your-radmin-ip>:${PORT}  with the second player.`);
});
