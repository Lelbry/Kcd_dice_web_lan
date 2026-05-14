import { WebSocket } from 'ws';

const url = 'ws://localhost:8080';

function connect(name, clientId, helloExtra) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const messages = [];
    let resolved = false;
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'hello', payload: { name, clientId, ...helloExtra } }));
    });
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      messages.push(msg);
      // Резолвим как только увидели joined-event с roomCode (для p1).
      if (!resolved && msg.type === 'event' && msg.payload?.type === 'joined') {
        resolved = true;
        // Подождём ещё чуть-чуть на state.
        setTimeout(() => resolve({ ws, messages }), 100);
      }
    });
    ws.on('error', reject);
    setTimeout(() => { if (!resolved) resolve({ ws, messages }); }, 800);
  });
}

const p1 = await connect('Sasha', 'cid-test-1', { roomAction: 'create' });
const joined1 = p1.messages.find((m) => m.type === 'event' && m.payload?.type === 'joined');
const roomCode = joined1?.payload?.roomCode;
console.log('p1 received roomCode:', roomCode);
if (!roomCode) {
  console.error('FAIL: no roomCode returned for create');
  process.exit(1);
}

const p2 = await connect('Vanya', 'cid-test-2', { roomAction: 'join', roomCode });

console.log('p1 received:', p1.messages.map((m) => m.type + (m.payload?.type ? `(${m.payload.type})` : '')).join(', '));
console.log('p2 received:', p2.messages.map((m) => m.type + (m.payload?.type ? `(${m.payload.type})` : '')).join(', '));

// Start game
p1.ws.send(JSON.stringify({ type: 'start_game', payload: { targetScore: 2000 } }));
await new Promise((r) => setTimeout(r, 300));

const lastStateP1 = [...p1.messages].reverse().find((m) => m.type === 'state');
console.log('phase after start:', lastStateP1?.payload?.phase);
console.log('players:', lastStateP1?.payload?.players?.map((p) => `${p.name}(${p.id}, ${p.totalScore})`).join(', '));
console.log('currentPlayerId:', lastStateP1?.payload?.currentPlayerId);
console.log('awaitingFirstRoll:', lastStateP1?.payload?.turn?.awaitingFirstRoll);

// Send roll from whichever player has the turn (server picks random first player).
const cur = lastStateP1?.payload?.currentPlayerId;
const roller = cur === 'p0' ? p1 : p2;
roller.ws.send(JSON.stringify({ type: 'roll' }));
await new Promise((r) => setTimeout(r, 300));

const lastState2 = [...roller.messages].reverse().find((m) => m.type === 'state');
console.log('after roll, dice:', lastState2?.payload?.turn?.diceOnTable);
console.log('isFarkle:', lastState2?.payload?.turn?.isFarkle);

p1.ws.close();
p2.ws.close();
console.log('OK');
process.exit(0);
