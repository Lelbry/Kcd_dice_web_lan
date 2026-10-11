import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { LobbyManager } from './lobby.js';
import { parseMessage, validateHello, ServerMsg, ClientMsg } from './protocol.js';

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

const lobbyManager = new LobbyManager();

const PING_INTERVAL_MS = 30_000;
const PING_TIMEOUT_MS = 10_000;

wss.on('connection', (socket) => {
  let player = null;
  let lobby = null;
  let alive = true;
  let pingTimer = null;
  let pingTimeoutTimer = null;

  function send(msg) {
    try { socket.send(JSON.stringify(msg)); } catch {}
  }

  function schedulePing() {
    pingTimer = setTimeout(() => {
      if (!alive) return;
      send({ type: ServerMsg.PING });
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

    if (msg.type === ClientMsg.CREATE_LOBBY) {
      if (lobby) {
        send({ type: ServerMsg.ERROR, payload: { code: 'already_in_lobby' } });
        return;
      }
      const entry = lobbyManager.create();
      if (!entry) {
        send({ type: ServerMsg.ERROR, payload: { code: 'lobby_create_failed' } });
        return;
      }
      lobby = entry;
      send({ type: ServerMsg.LOBBY_INFO, payload: { code: entry.code, action: 'created' } });
      return;
    }

    if (msg.type === ClientMsg.JOIN_LOBBY) {
      if (lobby) {
        send({ type: ServerMsg.ERROR, payload: { code: 'already_in_lobby' } });
        return;
      }
      const code = msg.payload?.code;
      if (typeof code !== 'string' || code.length < 3) {
        send({ type: ServerMsg.ERROR, payload: { code: 'invalid_lobby_code' } });
        return;
      }
      const entry = lobbyManager.get(code);
      if (!entry) {
        send({ type: ServerMsg.ERROR, payload: { code: 'lobby_not_found' } });
        return;
      }
      lobby = entry;
      send({ type: ServerMsg.LOBBY_INFO, payload: { code: entry.code, action: 'joined' } });
      return;
    }

    if (msg.type === ClientMsg.HELLO) {
      if (!lobby) {
        send({ type: ServerMsg.ERROR, payload: { code: 'join_lobby_first' } });
        return;
      }
      const v = validateHello(msg.payload);
      if (!v) {
        send({ type: ServerMsg.ERROR, payload: { code: 'bad_hello' } });
        return;
      }
      const result = lobby.room.addPlayer(v.clientId, v.name, socket, v.color);
      if (!result.player) {
        send({ type: ServerMsg.ERROR, payload: { code: result.error || 'cannot_join' } });
        try { socket.close(); } catch {}
        return;
      }
      player = result.player;
      send({
        type: ServerMsg.EVENT,
        payload: { type: 'joined', playerId: player.id, isNew: result.isNew },
      });
      return;
    }

    if (!player || !lobby) {
      send({ type: ServerMsg.ERROR, payload: { code: 'hello_required' } });
      return;
    }

    lobby.room.handleMessage(player, msg);
  });

  socket.on('close', () => {
    alive = false;
    if (pingTimer) clearTimeout(pingTimer);
    if (pingTimeoutTimer) clearTimeout(pingTimeoutTimer);
    if (player && lobby) lobby.room.removePlayer(player.clientId);
  });

  socket.on('error', () => {
    alive = false;
  });
});

server.listen(PORT, HOST, () => {
  const lanHint = HOST === '0.0.0.0' ? 'all interfaces' : HOST;
  console.log(`KCD2 Dice server listening on http://localhost:${PORT}  (bound to ${lanHint})`);
});
