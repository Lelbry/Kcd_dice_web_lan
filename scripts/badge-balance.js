#!/usr/bin/env node
/**
 * Win rate of each badge against a bot with no badge, playing real GameRoom games
 * (bot vs bot, «Расчётливый» mood, all-normal dice, the badge mode's default target).
 * Run: node scripts/badge-balance.js [gamesPerBadge=400] [tin|silver|gold|all=all] [badgeId…]
 */
import { GameRoom } from '../server/room.js';
import { BotDriver } from '../server/bot.js';
import { BADGES, BADGE_TIERS } from '../server/engine/badges.js';
import { GAME_MODES } from '../server/engine/rules.js';

const GAMES = Number(process.argv[2]) || 400;
const TIERS = BADGE_TIERS.includes(process.argv[3]) ? [process.argv[3]] : BADGE_TIERS;
const ONLY = process.argv.slice(4);
const ZERO = { firstRollDelayMinMs: 0, firstRollDelayMaxMs: 0, postRollDelayMinMs: 0, postRollDelayMaxMs: 0, previewMs: 0 };

function botPlayer(i) {
  return {
    id: `p${i}`, clientId: `p${i}`, name: `p${i}`, firstName: `Bot${i}`, mood: 'calculated',
    connected: true, isBot: true, totalScore: 0, socket: null, loadout: Array(6).fill('normal'),
  };
}

function play(badgeId, tier) {
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
    room.settings = { mode: 'badge', targetScore: GAME_MODES.badge.defaultTarget, tier };
    room._startGame();
  });
}

console.log(`Бляха vs без бляхи, ${GAMES} партий на бляху и уровень\n`);
console.log(`${''.padEnd(26)} ${TIERS.map((t) => t.padStart(7)).join(' ')}`);
for (const b of BADGES.filter((x) => ONLY.length === 0 || ONLY.includes(x.id))) {
  const cells = [];
  for (const tier of TIERS) {
    let wins = 0;
    for (let i = 0; i < GAMES; i++) if (await play(b.id, tier)) wins++;
    cells.push(`${((100 * wins) / GAMES).toFixed(1)}%`.padStart(7));
  }
  console.log(`${b.name.padEnd(26)} ${cells.join(' ')}`);
}
