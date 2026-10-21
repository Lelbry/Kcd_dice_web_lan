import { scoreSelection, isFarkle } from '../server/engine/scoring.js';
import { DICE_TYPES_MAP, rollWeighted } from '../server/engine/dice-types.js';
import { chooseGreedySelection } from '../server/bot.js';

const MAX_TURNS = 1000;

function rollDiceWeighted(typeIds) {
  return typeIds.map((id) => {
    const dt = DICE_TYPES_MAP[id];
    if (!dt) return Math.floor(Math.random() * 6) + 1;
    return rollWeighted(dt.weights);
  });
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function simulateGame(loadout1, loadout2, targetScore, bankThreshold = 450) {
  const players = [
    { score: 0, loadout: loadout1 },
    { score: 0, loadout: loadout2 },
  ];
  let currentIdx = Math.random() < 0.5 ? 0 : 1;
  let totalTurns = 0;
  let totalFarkles = 0;
  let totalBanks = 0;
  let totalHotDice = 0;
  let maxRoundScore = 0;

  while (totalTurns < MAX_TURNS) {
    totalTurns++;
    const player = players[currentIdx];
    const opponent = players[1 - currentIdx];

    let loadoutShuffled = shuffleArray(player.loadout);
    let diceTypeIds = [...loadoutShuffled];
    let diceOnTable = rollDiceWeighted(diceTypeIds);
    let roundScore = 0;
    let turnBanked = false;

    while (true) {
      if (isFarkle(diceOnTable)) {
        totalFarkles++;
        break;
      }

      const selection = chooseGreedySelection(diceOnTable);
      if (!selection) break;

      const heldValues = selection.map((i) => diceOnTable[i]);
      const holdScore = scoreSelection(heldValues).score;
      roundScore += holdScore;

      const remainingValues = diceOnTable.filter((_, i) => !selection.includes(i));
      const remainingTypeIds = diceTypeIds.filter((_, i) => !selection.includes(i));

      if (player.score + roundScore >= targetScore) {
        player.score += roundScore;
        totalBanks++;
        if (roundScore > maxRoundScore) maxRoundScore = roundScore;
        return {
          turns: totalTurns,
          winner: currentIdx,
          scores: [players[0].score, players[1].score],
          farkles: totalFarkles,
          banks: totalBanks,
          hotDice: totalHotDice,
          maxRoundScore,
        };
      }

      if (remainingValues.length === 0) {
        totalHotDice++;
        loadoutShuffled = shuffleArray(player.loadout);
        diceTypeIds = [...loadoutShuffled];
        diceOnTable = rollDiceWeighted(diceTypeIds);
        continue;
      }

      let threshold = bankThreshold;
      const oppDistance = targetScore - opponent.score;
      if (oppDistance <= 500) threshold *= 1.5;
      else if (oppDistance <= 1000) threshold *= 1.2;
      if (player.score < opponent.score - 800) threshold *= 1.3;

      if (roundScore >= threshold) {
        player.score += roundScore;
        totalBanks++;
        turnBanked = true;
        if (roundScore > maxRoundScore) maxRoundScore = roundScore;
        break;
      }

      diceOnTable = rollDiceWeighted(remainingTypeIds);
      diceTypeIds = remainingTypeIds;
    }

    if (player.score >= targetScore) {
      return {
        turns: totalTurns,
        winner: currentIdx,
        scores: [players[0].score, players[1].score],
        farkles: totalFarkles,
        banks: totalBanks,
        hotDice: totalHotDice,
        maxRoundScore,
      };
    }

    currentIdx = 1 - currentIdx;
  }

  return {
    turns: totalTurns,
    winner: -1,
    scores: [players[0].score, players[1].score],
    farkles: totalFarkles,
    banks: totalBanks,
    hotDice: totalHotDice,
    maxRoundScore,
  };
}
