import { WebSocket } from 'ws';

const url = 'ws://localhost:8080';

function connect(name, clientId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const messages = [];
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'hello', payload: { name, clientId } }));
    });
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      messages.push(msg);
    });
    ws.on('error', reject);
    setTimeout(() => resolve({ ws, messages }), 500);
  });
}

const p1 = await connect('Sasha', 'cid-test-1');
const p2 = await connect('Vanya', 'cid-test-2');

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

// p1 (current) rolls
p1.ws.send(JSON.stringify({ type: 'roll' }));
await new Promise((r) => setTimeout(r, 300));

const lastState2 = [...p1.messages].reverse().find((m) => m.type === 'state');
console.log('after roll, dice:', lastState2?.payload?.turn?.diceOnTable);
console.log('isFarkle:', lastState2?.payload?.turn?.isFarkle);

p1.ws.close();
p2.ws.close();
console.log('OK');
process.exit(0);
