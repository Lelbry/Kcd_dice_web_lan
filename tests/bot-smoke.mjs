import { WebSocket } from 'ws';

const url = 'ws://localhost:8080';

function connect(name, clientId, helloExtra = { roomAction: 'create' }) {
  return new Promise((resolve) => {
    const ws = new WebSocket(url);
    const messages = [];
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'hello', payload: { name, clientId, ...helloExtra } }));
    });
    ws.on('message', (raw) => {
      try {
        messages.push(JSON.parse(raw.toString()));
      } catch {}
    });
    setTimeout(() => resolve({ ws, messages }), 400);
  });
}

const human = await connect('Sasha', 'cid-bot-smoke-1', { roomAction: 'create' });

// Add bot
human.ws.send(JSON.stringify({ type: 'add_bot' }));
await new Promise((r) => setTimeout(r, 300));

let last = [...human.messages].reverse().find((m) => m.type === 'state');
console.log('after add_bot, players:', last?.payload?.players?.map((p) => `${p.name}(${p.id} bot=${p.isBot})`).join(', '));

// Start game with a small target so bot actually plays a few turns
human.ws.send(JSON.stringify({ type: 'start_game', payload: { targetScore: 2000 } }));
await new Promise((r) => setTimeout(r, 200));
last = [...human.messages].reverse().find((m) => m.type === 'state');
console.log('start: phase=', last?.payload?.phase, 'currentPlayerId=', last?.payload?.currentPlayerId);

// Human rolls first (since human is p0)
human.ws.send(JSON.stringify({ type: 'roll' }));
await new Promise((r) => setTimeout(r, 200));
last = [...human.messages].reverse().find((m) => m.type === 'state');
console.log('human rolled, dice=', last?.payload?.turn?.diceOnTable, 'farkle=', last?.payload?.turn?.isFarkle);

// Human banks immediately even if no scoring — but in case of farkle just wait for pass
const dice = last?.payload?.turn?.diceOnTable || [];
if (last?.payload?.turn?.isFarkle) {
  console.log('human farkled, waiting for pass...');
  await new Promise((r) => setTimeout(r, 2200));
} else {
  // pick any scoring die: just look for index of 1 or 5
  const idx = dice.findIndex((v) => v === 1 || v === 5);
  if (idx >= 0) {
    human.ws.send(JSON.stringify({ type: 'score_and_bank', payload: { selection: [idx] } }));
    await new Promise((r) => setTimeout(r, 500));
  } else {
    // No 1/5 — try roll. We can't reliably bank; this is rare. Just bail.
    console.log('no easy scoring die, bailing');
    human.ws.close();
    process.exit(0);
  }
}

console.log('--- now it should be bot turn, observing 8s ---');

// Watch for bot turn — events should arrive
const t0 = Date.now();
const seenEvents = new Set();
while (Date.now() - t0 < 8000) {
  await new Promise((r) => setTimeout(r, 200));
  for (const m of human.messages) {
    if (m.type === 'event' && !seenEvents.has(m)) {
      seenEvents.add(m);
      const p = m.payload;
      if (p?.playerId === 'p1') {
        console.log(`  bot event: ${p.type}${p.dice ? ' dice=' + JSON.stringify(p.dice) : ''}${p.score !== undefined ? ' score=' + p.score : ''}`);
      }
    }
  }
  const cur = [...human.messages].reverse().find((m) => m.type === 'state');
  if (cur?.payload?.phase === 'finished') {
    console.log('game finished, winner:', cur.payload.winnerId);
    const bot = cur.payload.players.find((p) => p.isBot);
    console.log('bot reveal:', bot?.fullName, '/', bot?.mood, '/', bot?.moodLabel);
    break;
  }
}

human.ws.close();
console.log('OK');
process.exit(0);
