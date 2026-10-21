#!/usr/bin/env node
/**
 * Win rate of each badge against a bot with no badge, playing real GameRoom games
 * (bot vs bot, «Расчётливый» mood, all-normal dice, target 4000).
 * Run: node scripts/badge-balance.js [gamesPerBadge=400]
 */
import { GameRoom } from '../server/room.js';
import { BotDriver } from '../server/bot.js';
import { BADGES } from '../server/engine/badges.js';

const GAMES = Number(process.argv[2]) || 400;
const ZERO = { firstRollDelayMinMs: 0, firstRollDelayMaxMs: 0, postRollDelayMinMs: 0, postRollDelayMaxMs: 0 };

function botPlayer(i) {
  return {
    id: `p${i}`, clientId: `p${i}`, name: `p${i}`, firstName: `Bot${i}`, mood: 'calculated',
    connected: true, isBot: true, totalScore: 0, socket: null, loadout: Array(6).fill('normal'),
  };
}

function play(badgeId) {
  return new Promise((resolve) => {
    const room = new GameRoom({ farklePassDelayMs: 0, farkleRescueDelayMs: 5 });
    const driver = new BotDriver(room, ZERO);
    room.setStateChangedHandler(() => {
      if (room.phase !== 'finished') return driver.tick();
      driver.cancel();
      resolve(room.winnerId === 'p0');
    });
    room.players = [botPlayer(0), botPlayer(1)];
    const setup = room._setupBadge.bind(room);
    room._setupBadge = (p) => {
      p.isBot = false;
      p.badge = badgeId;
      setup(p);
      if (p.id === 'p1') Object.assign(p, { gameBadge: null, badgeCharges: 0, shield: 0, totalScore: 0 });
      p.isBot = true;
    };
    room.handleMessage(room.players[0], { type: 'start_game', payload: { mode: 'badge', targetScore: 4000 } });
  });
}

console.log(`Бляха vs без бляхи, ${GAMES} партий на бляху\n`);
for (const b of BADGES) {
  let wins = 0;
  for (let i = 0; i < GAMES; i++) if (await play(b.id)) wins++;
  console.log(`${b.name.padEnd(26)} ${((100 * wins) / GAMES).toFixed(1)}%`);
}
