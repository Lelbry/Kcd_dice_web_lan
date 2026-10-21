import { test, expect } from '@playwright/test';

async function pickDie(page, slotIdx, typeId) {
  await page.locator('#loadout-slots .loadout-slot').nth(slotIdx).click();
  await page.locator(`#dice-catalog .dice-type-card[data-type="${typeId}"]`).click();
  await expect(page.locator('#dice-picker-modal')).toBeHidden();
}

async function openLobbyWithBot(page, mode) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#create-lobby-btn').click();
  await expect(page.locator('#lobby-code-text')).toHaveText(/^[A-Z2-9]{5}$/);
  await page.locator('#lobby-players [data-action="add-bot"]').click();
  await expect(page.locator('#lobby-players [data-action="remove-bot"]')).toBeVisible();
  await page.locator(`input[name="game-mode"][value="${mode}"]`).check();
  await expect(page.locator('#dice-loadout')).toBeVisible();
}

// Select every die worth points: all 1s and 5s plus any value showing three or more times.
async function selectScoringDice(page) {
  return page.evaluate(() => {
    const dice = [...document.querySelectorAll('#dice-area .die:not(.disabled)')];
    const counts = {};
    for (const d of dice) counts[d.dataset.value] = (counts[d.dataset.value] || 0) + 1;
    let picked = 0;
    for (const d of dice) {
      const v = d.dataset.value;
      if ((v === '1' || v === '5' || counts[v] >= 3) && !d.classList.contains('selected')) {
        d.click();
        picked++;
      }
    }
    return picked;
  });
}

test('pocket game with pie dice renders pie glyphs and plays to a win', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await openLobbyWithBot(page, 'pocket');

  await pickDie(page, 0, 'pie');
  // Each cheating die exists once: the second pie must be unavailable.
  await page.locator('#loadout-slots .loadout-slot').nth(1).click();
  await expect(page.locator('#dice-catalog .dice-type-card[data-type="pie"]')).toHaveClass(/disabled/);
  await page.locator('#dice-catalog .dice-type-card[data-type="tooth"]').click();
  await expect(page.locator('#dice-picker-modal')).toBeHidden();

  const pieSlots = page.locator('#loadout-slots .die[data-type="pie"]');
  await expect(pieSlots).toHaveCount(1);
  await expect(pieSlots.first().locator('svg').first()).toBeVisible();
  await expect(pieSlots.first().locator('.pip')).toHaveCount(0);

  await page.locator('#start-btn').click();
  await expect(page.locator('#game')).toBeVisible();

  let sawPieOnTable = false;
  const finished = page.locator('#finished-modal');
  const roll = page.locator('#actions-panel [data-action="roll"]');
  const bank = page.locator('#actions-panel [data-action="score-and-bank"]');

  for (let step = 0; step < 3000 && !(await finished.isVisible()); step++) {
    const pieOnTable = page.locator('#dice-area .die[data-type="pie"]');
    if (!sawPieOnTable && (await pieOnTable.count()) > 0) {
      const first = pieOnTable.first();
      await expect(first.locator('.pip-glyph svg').first()).toBeAttached();
      expect(await first.locator('.pip').count()).toBe(0);
      sawPieOnTable = true;
    }

    if ((await roll.isVisible()) && (await roll.isEnabled())) {
      await roll.click();
      await page.waitForTimeout(150);
      continue;
    }
    if ((await bank.isVisible()) && (await bank.isEnabled())) {
      await bank.click();
      await page.waitForTimeout(150);
      continue;
    }
    if ((await selectScoringDice(page)) > 0) {
      await page.waitForTimeout(100);
      continue;
    }
    await page.waitForTimeout(200);
  }

  await expect(finished).toBeVisible();
  expect(sawPieOnTable).toBe(true);
  expect(errors).toEqual([]);
});

test('classic mode lets you restyle dice with cosmetic dice only', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await openLobbyWithBot(page, 'classic');
  await expect(page.locator('#loadout-label')).toHaveText('Внешний вид костей:');
  await expect(page.locator('#loadout-hint')).toContainText('все кости катятся честно');

  await page.locator('#loadout-slots .loadout-slot').nth(0).click();
  await expect(page.locator('#dice-catalog .dice-type-card[data-type="loaded"]')).toHaveCount(0);
  await expect(page.locator('#dice-catalog .dice-type-card[data-type="artist_r"]')).toBeVisible();
  await page.locator('#dice-catalog .dice-type-card[data-type="artist_r"]').click();
  await pickDie(page, 1, 'artist_r');
  await expect(page.locator('#loadout-slots .die[data-type="artist_r"]')).toHaveCount(2);

  await page.locator('#start-btn').click();
  await expect(page.locator('#game')).toBeVisible();

  const myRoll = page.locator('#actions-panel [data-action="roll"]');
  const myDice = page.locator('#dice-area .die[data-type="artist_r"]');
  await expect.poll(async () => {
    if (await myRoll.isVisible() && await myRoll.isEnabled()) await myRoll.click();
    return myDice.count();
  }, { timeout: 30_000 }).toBeGreaterThan(0);

  const otherTypes = await page.locator('#dice-area .die').evaluateAll((els) =>
    els.map((e) => e.dataset.type).filter((t) => t !== 'artist_r' && t !== 'normal'));
  expect(otherTypes.every((t) => !['loaded', 'pie', 'painted'].includes(t))).toBe(true);
  expect(errors).toEqual([]);
});
