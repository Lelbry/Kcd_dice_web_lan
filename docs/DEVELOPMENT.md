# Разработка KCD Dice

Архитектура, протокол, движок, тесты. Если нужен только справочник по костям —
см. `DICE_REFERENCE.md`. Если нужна приватная деплой-шпаргалка — `DEPLOYMENT.md`
(не в публичном репо).

---

## 1. Стек

- **Сервер:** Node 20+, Express, `ws` (нативный WebSocket), ES-модули
- **Клиент:** vanilla HTML / CSS / ES-modules. Без бандлера, без фреймворков,
  без TypeScript — всё загружается `<script type="module">`
- **Тесты:** встроенный `node:test`, запускается `npm test`
- **Авторитативный сервер:** клиент шлёт только intents, сервер валидирует,
  бросает `crypto.randomInt` и возвращает полный snapshot
- Зависимости: `express`, `ws`. Больше ничего в `dependencies`

## 2. Структура

```
server/
  index.js          Express static + WebSocket + lobby routing
  lobby.js          LobbyManager: создание/поиск комнат по коду, cleanup
  room.js           GameRoom: FSM ходов, broadcast state/event
  bot.js            AI (mood, decideBotAction), BotDriver, generateBotLoadout
  protocol.js       константы ClientMsg/ServerMsg + валидаторы payload'ов
  engine/
    rules.js        константы (цели, базовые очки, режимы, multiplier)
    scoring.js      scoreSelection(dice) → {score, valid, breakdown}
    validate.js     canHold / canBank / checkWin / isFarkle
    dice-types.js   каталог костей, лимиты loadout, rollWeighted
    badges.js       каталог блях, комбинации, правила активации

public/
  index.html        вся разметка (lobby-select, lobby-waiting, игра, модалки)
  styles/
    main.css        layout
    dice.css        грани, pips, tumble-анимация
  js/
    main.js         bootstrap, lobby flow, hotkeys
    net.js          WebSocket + reconnect backoff
    state.js        Store: snapshot + локальный selection + loadout
    ui.js           рендер DOM по snapshot
    badges.js       UI блях: выбор, панель, кнопка, вкладка помощи
    infocard.js     всплывающая карточка «что это за кость / бляха»
    glyphs.js       SVG-символы граней
    color.js        hex→HSL + вычисление градиента грани
    music.js        фоновый плеер (треки, next/prev, volume)
    engine/         зеркало серверного движка (preview-скор)

tests/
  scoring.test.js   комбинации, стриты, hot dice (40+ кейсов)
  validate.test.js  canHold/canBank/isFarkle
  bot.test.js       chooseGreedySelection, decideBotAction
  color.test.js     hex↔HSL, computeDieGradient
  weights.test.js   распределение граней каждой кости
  balance.test.js   симуляции loadout vs loadout
  badges.test.js    движок блях + партии бот-vs-бот через GameRoom
  e2e/smoke.spec.js Playwright: pocket, classic-косметика, бляхи, телефон
  ws-smoke.mjs      ручной end-to-end через реальный ws
  bot-smoke.mjs     прогон бота против бота
  rng-audit.mjs     прогон rollWeighted для аудита перекосов

scripts/
  simulate.js       симулятор бот-vs-бот для оценки длительности партии
  sim-core.js       ядро симуляции (импортируется тестами)
  badge-balance.js  процент побед каждой бляхи против игрока без бляхи
```

## 3. FSM комнаты

Фазы: `lobby → playing → finished → lobby (new_game)`.

- **`lobby`**: игроки присоединились, можно `ADD_BOT`/`REMOVE_BOT`, `SET_LOADOUT`,
  `SET_BADGE`, `SET_PROFILE`, `SET_SETTINGS`, `SET_READY`. Режим, цель и уровень
  блях — общие настройки комнаты (`room.settings`); их изменение снимает «готов»
  со всех людей, а смена своих костей или бляхи — с этого игрока. Когда оба
  игрока подключены и готовы: с ботом игра стартует сразу (бот всегда готов),
  у двух людей — после отсчёта `startCountdownMs` (3 с). Отказ от готовности,
  отключение или смена настроек отменяют отсчёт. На старте каждому игроку считается `gameLoadout` —
  его `loadout`, очищенный под режим (`sanitizeLoadout`), — и бляха (`_setupBadge`).
- **`playing`**: активный ход — `ROLL` → `SCORE_AND_ROLL` ×N → `SCORE_AND_BANK`
  или farkle (авто-pass через 3.5s; 6s, если у игрока есть заряд Бляхи
  воскрешения). В режиме `badge` принимается `ACTIVATE_BADGE` — в том числе во
  время farkle-паузы. Параллельно принимаются `SELECT_PREVIEW`
  (ретранслируется противнику для live-подсветки) и `SURRENDER`. `SET_LOADOUT`
  тоже разрешён (применится при следующем броске этого игрока).
- **`finished`**: только `NEW_GAME` возвращает в lobby.

Персона бота рандомится один раз при `addBot`/`_newGame` — не трогаем на
старте партии, иначе имя в лобби сменится после старта (прошлый баг).

Бот перед каждым `score_and_*` сначала шлёт людям `select_preview` со своим
выбором и делает ход через `previewMs` (1 с), чтобы соперник видел, что он
откладывает. `KCD_BOT_SPEED=4` ускоряет ботов (так их запускают e2e-тесты).

## 4. Протокол

Все сообщения — JSON `{type, payload?}`. Валидаторы и enum — в
`server/protocol.js`.

### Клиент → сервер (`ClientMsg`)

| Тип | Payload | Фаза |
|-----|---------|------|
| `create_lobby` | — | до join |
| `join_lobby` | `{code}` | до join |
| `hello` | `{clientId, name, color?}` | после join (обязательно) |
| `set_profile` | `{name?, color?}` | любая |
| `set_loadout` | `{loadout: [id×6], mode?}` — проверяется по правилам режима | любая |
| `set_badge` | `{badgeId}` | любая (применяется на старте партии) |
| `activate_badge` | `{diceIndex?}` — превращение/обмен; `{diceIndices}` — фортуна/свадьба (до `rerollMax` костей) | playing, режим `badge` |
| `add_bot` / `remove_bot` | — | lobby |
| `set_settings` | `{mode?, targetScore?, tier?}` — общие для обоих; цель не из режима → его цель по умолчанию | lobby |
| `set_ready` | `{ready: boolean}` — «готов» нужен, когда в комнате двое | lobby |
| `start_game` | — снят: отвечает ошибкой `use_ready` | — |
| `roll` | — | playing (свой ход, awaitingFirstRoll) |
| `score_and_roll` | `{selection: [idx…]}` | playing (свой ход) |
| `score_and_bank` | `{selection: [idx…]}` | playing (свой ход) |
| `select_preview` | `{selection: [idx…]}` | playing (любой игрок) |
| `surrender` | — | playing |
| `new_game` | — | finished |
| `pong` | — | любая (ответ на `ping`) |

### Сервер → клиент (`ServerMsg`)

| Тип | Payload |
|-----|---------|
| `lobby_info` | `{code, action: 'created' | 'joined'}` |
| `state` | полный snapshot комнаты (`GameRoom.toSnapshot()`) |
| `event` | `{type: 'rolled' | 'hotdice' | 'farkle' | 'banked' | 'won' | 'surrendered' | 'select_preview' | 'joined' | 'reconnected' | 'badge_activated' | 'badge_blocked', …}` |
| `error` | `{code}` — машинный код ошибки |
| `ping` | — (ждёт `pong` 10 секунд) |

Ping-интервал 30s, таймаут 10s — иначе `socket.terminate()`.
Reconnect-grace 60s: при обрыве игрок помечается `connected: false`, но слот
не освобождается — после реконнекта сокет перепривязывается к той же записи.

## 5. Игровой движок

### Правила (`engine/rules.js`)

- 6 костей, 6 граней
- Одиночные: `1` = 100, `5` = 50
- Тройки: 1→1000, 2..6→N×100
- 4/5/6 одинаковых: ×2, ×4, ×8 от тройки
- Стриты 1-5 / 2-6 / 1-6: 500 / 750 / 1500
- Режимы — объект `GAME_MODES` с `targets`, `canonTargets` (кнопки по умолчанию),
  `defaultTarget`, `allowSpecialDice`, `badges`:
  - `classic` — только косметические кости (`allowSpecialDice: false`)
  - `pocket` — до 3 шулерских костей
  - `badge` — как pocket + одна бляха у каждого (`badges: true`)

### Скоринг (`engine/scoring.js`)

`scoreSelection(dice)` → `{score, valid, breakdown}`.
- `valid: true` только если **все** переданные кости использованы в комбинациях.
  Поэтому `[1, 2]` вернёт `valid: false` (двойка — мусор), а `[1]` — `valid: true`.
- `isFarkle(roll)` — true если среди костей на столе нет ни одной зачётной.

### Валидация ходов (`engine/validate.js`)

- `canHold(selection, roll)` — проверяет что индексы валидны и подвыборка скорится
- `canBank(turnScore)` — любое положительное число (на сервере)
- `checkWin(total, target)` — `total >= target`

### Loadout и кости (`engine/dice-types.js`)

- `DICE_TYPES` — массив записей `{id, name, description, weights, color, special}`
- `DICE_TYPES_MAP` — тот же массив как объект-словарь по `id`
- `DEFAULT_LOADOUT = ['normal' × 6]`
- `validateLoadoutArray(loadout, mode)` — вернёт `loadout` или `null`. Проверяет:
  - длина 6
  - все id знакомы
  - в режиме без шулерских костей (`classic`) — ни одной `special`
  - не больше `MAX_SPECIAL_DICE = 3` шулерских и не больше `MAX_SAME_SPECIAL = 1`
    одинаковой шулерской; косметические (`special: false`) без ограничений
- `sanitizeLoadout(loadout, mode)` — заменяет запрещённые режимом кости на `normal`
- `rollWeighted(weights)` — взвешенный бросок по целым весам (`Math.random`)

### Бляхи (`engine/badges.js`)

- `BADGES` — 8 блях v1 `{id, name, description, kind: 'active'|'passive', charges?, target?, combos?, startBonus?, shield?}`
- `scoreWithBadge(values, badgeId)` / `canHoldWithBadge(selection, roll, badgeId)` —
  скоринг с дополнительными комбинациями («Разрез», «Виселица»)
- `activationBlocker(badgeId, {charges, turn, isMyTurn, diceIndex})` — почему бляху
  нельзя применить сейчас (или `null`). Одна функция для сервера, клиента и бота.
- Полный каталог KCD2 и roadmap — `docs/BADGE_REFERENCE.md`.

**Инвариант:** `server/engine/*.js` и `public/js/engine/*.js` — одинаковые
модули (кроме `validate.js`, где клиент экспортирует только `canHold` +
`isFarkle` реэкспортом). Любое правило правится в двух местах.

## 6. Бот

- Личность = `{mood, firstName, color}`. Mood'ы перечислены в `MOODS` в
  `server/bot.js` (cautious / calculated / bold / reckless / cold-blooded / wild).
  Разница — в `base` (порог для банка) и `roflChance` (вероятность инверсии
  решения).
- Полное имя (с настроением) и описание стиля раскрываются **только** в finished
  snapshot — пока партия идёт, видно только короткое имя.
- `chooseGreedySelection` — brute force по 2^6=64 подмножествам, выбирает самое
  большое валидное.
- `decideBotAction`:
  - forced bank, если на кону уже победа
  - forced roll, если выбрано всё (hot dice);
  - иначе `projectedRound >= threshold` → bank. Threshold у `wild` — чистый
    рандом 200..1600; у остальных — `base`, умножаемое на comeback-фактор
    (если противник близко к цели).
- `BotDriver.tick` слушает `_onStateChanged` комнаты и действует с задержкой
  (`firstRoll 600–1200ms`, `postRoll 2500–3500ms`, последняя — чтобы живой
  игрок успел посмотреть на выпавшие кости и услышать звук).
- `generateBotLoadout(mode, rng)` — в classic случайный косметический облик, иначе
  1..3 разных шулерских кости.
- В режиме `badge` бот берёт случайную бляху; `decideBotBadge` решает, когда
  применить активную (удвоение — при отложенных ≥300, воскрешение — при зонке с
  ≥250 очков хода, превращение/обмен — когда до hot dice мешает одна кость).

## 7. Клиент

- `clientId` — UUID, сохраняется в `localStorage` ключом `kcd2_client_id`.
  Используется для реконнекта в ту же сессию.
- `kcd2_player_name`, `kcd2_dice_brightness`, `kcd2_loadout_<mode>` (свой набор
  костей на каждый режим; старый `kcd2_loadout` мигрируется один раз),
  `kcd2_selected_mode`, `kcd2_badge`, `kcd2_music_volume`, `kcd2_music_muted` —
  настройки игрока в `localStorage`.
- `Store.setSnapshot` сбрасывает `selection` при смене набора костей или
  текущего игрока, и опускает `rolling` через ~3 сек на случай застревания.
- Preview-скор на клиенте использует зеркальный `scoreSelection` (в режиме бляхи —
  `scoreWithBadge` и ×2 при взведённом удвоении) → ровно то же число, что потом
  подтвердит сервер.
- Кости, которые нельзя выбрать (кости соперника, отложенные), и бляхи открывают
  `infocard.js` по клику.
- На ширине ≤600px панель блях над столом скрыта: бляхи — строкой в табло,
  активная — кнопкой в списке действий.
- WebSocket URL — `${scheme}://${location.host}`, scheme автоматически
  `wss` под `https`, иначе `ws` (production сейчас по `ws://`, без HTTPS —
  см. `DEPLOYMENT.md`, причины там).

## 8. Тесты

`npm test` запускает:

- `scoring.test.js` — все комбинации, стриты, hot dice
- `validate.test.js` — `canHold`/`canBank`/`isFarkle`, loadout по режимам
- `bot.test.js` — greedy selection, decideBotAction
- `color.test.js` — hex↔HSL, градиент грани
- `weights.test.js` — распределение граней каждой кости
- `balance.test.js` — симуляции loadout против loadout
- `badges.test.js` — движок блях, комната, партии бот-vs-бот

`npm run test:e2e` — Playwright (сам поднимает сервер на :8091).

Ручные скрипты (не входят в `npm test`, запускать отдельно):

- `node tests/ws-smoke.mjs` — проходит создание лобби + hello + несколько ходов
  через настоящий WebSocket (нужен запущенный сервер)
- `node tests/bot-smoke.mjs` — прогоняет бота против бота в памяти
- `node tests/rng-audit.mjs` — миллионные прогоны `rollWeighted` для проверки
  перекосов (используется, когда меняем веса)
- `node scripts/simulate.js` — симуляция партий бот-vs-бот, выводит
  среднюю длительность партии при разных целях/loadout'ах
- `node scripts/badge-balance.js [N]` — процент побед каждой бляхи против
  игрока без бляхи (настоящая `GameRoom`, ~3 минуты на 400 партий)

## 9. Инварианты и известные тонкости

- **Зеркало движка.** `server/engine/*` ↔ `public/js/engine/*` — всегда синхронно.
  CI на это не ругается, проверяем вручную.
- **Hot dice.** После выбора всех 6 костей — обязательный переброс всех 6.
  `score_and_bank` на пустом столе в текущей трактовке UI разрешён (игрок банкует
  накопленное), для бота — всегда `score_and_roll`.
- **Фарк.** Серверный таймер `FARKLE_PASS_DELAY_MS = 3500` даёт клиенту время
  показать анимацию до перехода хода.
- **Reconnect vs. leave.** `removePlayer` держит слот 60 секунд. `immediate: true`
  используется при явном уходе из лобби.
- **Переиндексация игроков.** После `removeBot` оставшиеся получают id
  `p0`, `p1`, … по позиции в массиве.
- **Cache-bust.** Любое изменение в `public/js` или `public/styles` требует
  бампа `?v=` в трёх `<link>/<script>` в `public/index.html`.

## 10. Куда класть новое

- Фичи, рефакторинги, принятые решения — отдельным `.md` в `docs/`
- Постмортемы, отчёты — `docs/YYYY-MM-DD-название.md`
- Новая кость — две записи в `*/engine/dice-types.js` + колонка в
  `DICE_REFERENCE.md` (переносим из «не реализованных» в «реализованные»)
- Новый режим — запись в `GAME_MODES`, тест на валидацию `start_game` payload,
  плюс UI-переключатель в `index.html` + `renderLobby`
