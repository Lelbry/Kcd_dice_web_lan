import { test, expect } from '@playwright/test';

// The picker splits cheating and cosmetic dice into tabs; open the one that has typeId.
async function showCard(page, typeId) {
  const card = page.locator(`#dice-catalog .dice-type-card[data-type="${typeId}"]`);
  if (await card.count() === 0) {
    await page.locator('#dice-picker-tabs .help-tab:not(.active)').click();
  }
  return card;
}

async function pickDie(page, slotIdx, typeId) {
  await page.locator('#loadout-slots .loadout-slot').nth(slotIdx).click();
  await (await showCard(page, typeId)).click();
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
  await (await showCard(page, 'tooth')).click();
  await expect(page.locator('#dice-picker-modal')).toBeHidden();

  const pieSlots = page.locator('#loadout-slots .die[data-type="pie"]');
  await expect(pieSlots).toHaveCount(1);
  await expect(pieSlots.first().locator('svg').first()).toBeVisible();
  await expect(pieSlots.first().locator('.pip')).toHaveCount(0);

  await page.locator('#ready-btn').click();
  await expect(page.locator('#game')).toBeVisible();

  let sawPieOnTable = false;
  let inspectedOpponent = false;
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

    const oppDie = page.locator('#dice-area .die.inspectable').first();
    if (!inspectedOpponent && (await oppDie.count()) > 0) {
      await oppDie.click({ force: true });
      const card = page.locator('#info-card');
      if (await card.isVisible()) {
        await expect(card).toContainText('Кость игрока');
        await expect(card.locator('.prob-bar')).toHaveCount(6);
        await page.keyboard.press('Escape');
        await expect(card).toBeHidden();
        inspectedOpponent = true;
      }
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
  expect(inspectedOpponent).toBe(true);
  expect(errors).toEqual([]);
});

test('classic mode lets you restyle dice with cosmetic dice only', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await openLobbyWithBot(page, 'classic');
  await expect(page.locator('#loadout-label')).toHaveText('Внешний вид костей:');
  await expect(page.locator('#loadout-hint')).toContainText('сменить облик');

  await page.locator('#loadout-slots .loadout-slot').nth(0).click();
  await expect(page.locator('#dice-catalog .dice-type-card[data-type="loaded"]')).toHaveCount(0);
  await expect(page.locator('#dice-catalog .dice-type-card[data-type="artist_r"]')).toBeVisible();
  await page.locator('#dice-catalog .dice-type-card[data-type="artist_r"]').click();
  await pickDie(page, 1, 'artist_r');
  await expect(page.locator('#loadout-slots .die[data-type="artist_r"]')).toHaveCount(2);

  await page.locator('#ready-btn').click();
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

test('badge mode: pick a badge, use it on a die, read about it in help', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await openLobbyWithBot(page, 'badge');
  await expect(page.locator('#badge-select')).toBeVisible();
  await page.locator('#badge-slot').click();
  await expect(page.locator('#badge-catalog .badge-card')).toHaveCount(14);
  await page.locator('#badge-catalog .badge-card[data-badge="transmutation"]').click();
  await expect(page.locator('#badge-slot')).toContainText('Бляха превращения');

  await page.locator('#ready-btn').click();
  await expect(page.locator('#badge-bar')).toBeVisible();
  await expect(page.locator('.badge-chip.mine')).toContainText('Бляха превращения');
  await expect(page.locator('.badge-chip.theirs .badge-medallion')).toBeVisible();

  const roll = page.locator('#actions-panel [data-action="roll"]');
  const useBtn = page.locator('.badge-chip.mine .badge-activate');
  await expect.poll(async () => {
    if (await roll.isVisible() && await roll.isEnabled()) await roll.click();
    return useBtn.isEnabled();
  }, { timeout: 90_000, intervals: [500] }).toBe(true);

  await page.keyboard.press('KeyB');
  const targets = page.locator('#dice-area .die.badge-target');
  await expect(targets.first()).toBeVisible();
  await expect(page.locator('.badge-target-hint')).toBeVisible();
  await targets.first().click();

  await expect(page.locator('.badge-chip.mine .charge.full')).toHaveCount(0);
  await expect(page.locator('#dice-area .die.badge-target')).toHaveCount(0);
  await page.locator('#log-toggle').click();
  // The bot draws a random badge: its Бляха защиты may burn the transmutation, which is also a valid outcome.
  await expect(page.locator('#log-panel')).toContainText(/Бляха превращения — кость|Бляха превращения сгорела/);

  await page.keyboard.press('KeyT');
  await page.locator('[data-help-tab="badges"]').click();
  await expect(page.locator('#help-badges .help-badge')).toHaveCount(14);
  expect(errors).toEqual([]);
});

test('phone layout: badges move into the score table and the action list', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLobbyWithBot(page, 'badge');
  await page.locator('#ready-btn').click();
  await expect(page.locator('#game')).toBeVisible();
  await expect(page.locator('#badge-bar')).toBeHidden();
  const row = page.locator('.score-table .badge-row');
  await expect(row).toBeVisible();
  await expect(row.locator('.score-badge')).toHaveCount(2);
  await expect(page.locator('#actions-panel [data-action="badge"]')).toBeVisible();

  await row.locator('.score-badge').last().click();
  await expect(page.locator('#info-card')).toContainText('Бляха игрока');

  const indicator = await page.locator('#turn-indicator').boundingBox();
  expect(indicator.height).toBeLessThan(60);
});

test('phone layout: the speaker button opens volume and brightness sliders', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#volume-slider')).toBeHidden();
  await page.locator('#mute-btn').click();
  const panel = page.locator('#sound-panel');
  await expect(panel).toBeVisible();

  await panel.locator('.volume-input').fill('30');
  await expect(page.locator('#volume-slider')).toHaveValue('30');
  expect(await page.evaluate(() => localStorage.getItem('kcd2_music_volume'))).toBe('0.3');
  await panel.locator('.brightness-input').fill('80');
  expect(await page.evaluate(() => localStorage.getItem('kcd2_dice_brightness'))).toBe('80');

  await panel.locator('#panel-mute-btn').click();
  await expect(page.locator('#mute-btn')).toHaveText('🔇');

  await page.locator('#lobby-select h1').click();
  await expect(panel).toBeHidden();
});

test('dice picker: cheating and cosmetic dice sit on separate tabs', async ({ page }) => {
  await openLobbyWithBot(page, 'pocket');
  await page.locator('#loadout-slots .loadout-slot').nth(0).click();
  const tabs = page.locator('#dice-picker-tabs .help-tab');
  await expect(tabs).toHaveCount(2);
  await expect(tabs.nth(0)).toHaveClass(/active/);
  await expect(tabs.nth(0)).toContainText('Шулерские');
  await expect(page.locator('#dice-catalog .dice-type-card[data-type="loaded"]')).toBeVisible();
  await expect(page.locator('#dice-catalog .dice-type-card[data-type="tooth"]')).toHaveCount(0);

  await tabs.nth(1).click();
  await expect(tabs.nth(1)).toHaveClass(/active/);
  await expect(page.locator('#dice-catalog .dice-type-card[data-type="tooth"]')).toBeVisible();
  await expect(page.locator('#dice-catalog .dice-type-card[data-type="loaded"]')).toHaveCount(0);

  // A slot holding a cosmetic die reopens on the cosmetic tab.
  await page.locator('#dice-catalog .dice-type-card[data-type="tooth"]').click();
  await page.locator('#loadout-slots .loadout-slot').nth(0).click();
  await expect(tabs.nth(1)).toHaveClass(/active/);
  await page.keyboard.press('Escape');
});

// Plays until it is our turn with six fresh dice on the table that we may select.
async function reachOwnSixDice(page) {
  const roll = page.locator('#actions-panel [data-action="roll"]');
  const myDice = page.locator('#dice-area .die:not(.disabled)');
  for (let attempt = 0; attempt < 40; attempt++) {
    await expect(page.locator('#finished-modal')).toBeHidden();
    await expect(roll).toBeEnabled({ timeout: 45000 });
    await roll.click();
    try {
      await expect(myDice).toHaveCount(6, { timeout: 4000 });
      return;
    } catch {
      // Farkle on the first roll: the bot plays its turn, then we roll again.
    }
  }
  throw new Error('never got six selectable dice');
}

function overlap(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

for (const vp of [{ name: 'phone', width: 390, height: 844 }, { name: 'desktop', width: 1280, height: 800 }]) {
  test(`${vp.name}: selected dice show their names under them without covering other dice`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openLobbyWithBot(page, 'pocket');
    await pickDie(page, 0, 'lu');
    await pickDie(page, 1, 'qi');
    await pickDie(page, 2, 'fer');
    // The longest game, so the bot cannot win while we wait for a turn with six fresh dice.
    await page.locator('#target-select').selectOption('15000');
    await expect(page.locator('#target-select')).toHaveValue('15000');
    await page.locator('#ready-btn').click();
    await expect(page.locator('#game')).toBeVisible();
    await reachOwnSixDice(page);

    const area = page.locator('#dice-area');
    const dice = area.locator('.die');
    const labels = area.locator('.die-label');
    await expect(labels).toHaveCount(0);

    for (let i = 0; i < 6; i++) await dice.nth(i).click();
    await expect(labels).toHaveCount(6);
    await page.waitForTimeout(400); // let the dice finish sliding into place

    const names = (await labels.allTextContents()).sort();
    expect(names).toEqual(['Лю', 'Обычная', 'Обычная', 'Обычная', 'Фер', 'Ци']);
    await expect(area.locator('.die-label.special')).toHaveCount(3);

    const areaBox = await area.boundingBox();
    const dieBoxes = [];
    for (let i = 0; i < 6; i++) dieBoxes.push(await dice.nth(i).boundingBox());
    const tagBoxes = [];
    for (let i = 0; i < 6; i++) tagBoxes.push(await labels.nth(i).boundingBox());
    for (const t of tagBoxes) {
      expect(t.x).toBeGreaterThanOrEqual(areaBox.x - 1);
      expect(t.x + t.width).toBeLessThanOrEqual(areaBox.x + areaBox.width + 1);
      expect(t.y + t.height).toBeLessThanOrEqual(areaBox.y + areaBox.height + 1);
    }
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        if (i !== j) expect(overlap(tagBoxes[i], tagBoxes[j]), `tags ${i} and ${j} overlap`).toBe(false);
        // Each tag sits under its own die; it must not cover any die.
        expect(overlap(tagBoxes[i], dieBoxes[j]), `tag ${i} covers die ${j}`).toBe(false);
      }
    }
    await page.screenshot({ path: test.info().outputPath(`labels-${vp.name}.png`) });

    await dice.nth(0).click();
    await expect(labels).toHaveCount(5);
    expect(errors).toEqual([]);
  });
}

test('two players: shared settings, both press «Готов», countdown, game starts for both', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  const errors = [];
  for (const p of [a, b]) p.on('pageerror', (e) => errors.push(e.message));

  await a.goto('/');
  await a.evaluate(() => localStorage.clear());
  await a.reload();
  await a.locator('#create-lobby-btn').click();
  const code = (await a.locator('#lobby-code-text').textContent()).trim();
  expect(code).toMatch(/^[A-Z2-9]{5}$/);
  await b.goto(`/?lobby=${code}`);
  await expect(b.locator('#lobby-players .lobby-player:not(.waiting)')).toHaveCount(2);

  // A picks the mode; B's lobby follows.
  await a.locator('input[name="game-mode"][value="badge"]').check();
  await expect(b.locator('input[name="game-mode"][value="badge"]')).toBeChecked();
  await expect(b.locator('#tier-selector')).toBeVisible();
  await b.locator('input[name="badge-tier"][value="gold"]').check();
  await expect(a.locator('input[name="badge-tier"][value="gold"]')).toBeChecked();

  await a.locator('#ready-btn').click();
  await expect(a.locator('#ready-btn')).toHaveText('Не готов');
  await expect(b.locator('#lobby-players .ready-mark.ready')).toHaveCount(1);

  // Changing a shared setting clears everyone's ready.
  await b.locator('#target-select').selectOption('12000');
  await expect(a.locator('#target-select')).toHaveValue('12000');
  await expect(a.locator('#ready-btn')).toHaveText('Готов');

  await a.locator('#ready-btn').click();
  await b.locator('#ready-btn').click();
  await expect(a.locator('#lobby-status')).toContainText('игра начнётся через');
  await expect(a.locator('#game')).toBeVisible({ timeout: 6000 });
  await expect(b.locator('#game')).toBeVisible({ timeout: 6000 });
  await expect(a.locator('#turn-indicator')).toContainText('Игра с бляхой');
  expect(errors).toEqual([]);
  await ctxA.close();
  await ctxB.close();
});

test('badge tiers: gold lobby shows gold badges, Fortune rerolls the dice you pick', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openLobbyWithBot(page, 'badge');
  await page.locator('input[name="badge-tier"][value="gold"]').check();
  await expect(page.locator('#badge-slot .badge-medallion')).toHaveAttribute('data-tier', 'gold');
  await expect(page.locator('#badge-slot')).toContainText('золотая · 3 заряда');

  await page.locator('#badge-slot').click();
  await expect(page.locator('#badge-picker-modal h2')).toContainText('золотая');
  await expect(page.locator('#badge-catalog .badge-card[data-badge="headstart"]')).toContainText('1000');
  await expect(page.locator('#badge-catalog .badge-card[data-badge="emperor"]')).toContainText('особая');
  await page.locator('#badge-catalog .badge-card[data-badge="fortune"]').click();
  await expect(page.locator('#badge-slot')).toContainText('до 3 выбранных костей');

  await page.locator('#ready-btn').click();
  await expect(page.locator('.badge-chip.mine .charge')).toHaveCount(2);

  const roll = page.locator('#actions-panel [data-action="roll"]');
  const useBtn = page.locator('.badge-chip.mine .badge-activate');
  await expect.poll(async () => {
    if (await roll.isVisible() && await roll.isEnabled()) await roll.click();
    return useBtn.isEnabled();
  }, { timeout: 90_000, intervals: [500] }).toBe(true);

  await page.keyboard.press('KeyB');
  const targets = page.locator('#dice-area .die.badge-target');
  await expect(targets.first()).toBeVisible();
  await expect(page.locator('.badge-target-hint')).toContainText('до 3 костей');
  await expect(useBtn).toHaveText('Отмена');
  await targets.nth(0).click();
  await targets.nth(1).click();
  await expect(page.locator('#dice-area .die.badge-picked')).toHaveCount(2);
  await expect(useBtn).toHaveText('Перебросить (2)');
  await useBtn.click();
  await expect(page.locator('#dice-area .die.badge-target')).toHaveCount(0);
  await expect(page.locator('.badge-chip.mine .charge.full')).toHaveCount(1);
  await page.locator('#log-toggle').click();
  await expect(page.locator('#log-panel')).toContainText(/Бляха фортуны — переброс \[\d, \d\] → \[\d, \d\]|Бляха фортуны сгорела/);
  expect(errors).toEqual([]);
});

test('Might: armed before the roll, the turn is played with seven dice', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openLobbyWithBot(page, 'badge');
  await page.locator('#badge-slot').click();
  await page.locator('#badge-catalog .badge-card[data-badge="might"]').click();
  await page.locator('#ready-btn').click();
  const roll = page.locator('#actions-panel [data-action="roll"]');
  await expect(roll).toBeEnabled({ timeout: 45000 });
  const useBtn = page.locator('.badge-chip.mine .badge-activate');
  await expect(useBtn).toBeEnabled();
  await useBtn.click();
  // The bot may carry Бляха защиты and burn the charge; then the turn stays at six dice.
  const burned = page.locator('#log-panel');
  await expect(page.locator('.badge-chip.mine .charge.full')).toHaveCount(0);
  const armed = await page.locator('.badge-chip.mine .badge-chip-flag.hot').count();
  await roll.click();
  await expect(page.locator('#dice-area .die')).toHaveCount(armed ? 7 : 6, { timeout: 5000 });
  if (armed) await expect(page.locator('.badge-chip.mine')).toContainText('+1 кость в этом ходу');
  else await expect(burned).toContainText('Бляха силы сгорела');
  expect(errors).toEqual([]);
});
