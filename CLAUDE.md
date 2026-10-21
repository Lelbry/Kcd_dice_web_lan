# KCDdice — памятка для будущих сессий Claude

Эта страница — быстрый контекст о проекте, чтобы не разведывать его заново каждый раз.
Для глубоких деталей см. `docs/DEVELOPMENT.md` и `docs/DICE_REFERENCE.md`.

## Что это

Веб-реализация игры в кости из Kingdom Come: Deliverance II на двоих.
Онлайн-лобби через 5-символьный код, игра в браузере, бэкенд на Node.
Production: `https://kcddice.ru` (owner — пользователь, деплоится вручную).

Публичный репозиторий: `https://github.com/Lelbry/Kcd_dice_web_lan` (ветка `main`).
Пользователь работает в приватной локальной копии; что уходит в `main` — доступно всем.

## Стек, запуск, тесты

- Node 20+, `type: module`, Express + `ws`, zero bundler
- Клиент — vanilla HTML/CSS/ES-модули, без фреймворков
- `npm start` — поднимает сервер на `0.0.0.0:8080` (переопределить: `npm start -- --port 3000`)
- `npm test` — `node:test` по `tests/{scoring,validate,bot,color,weights,balance}.test.js`
- `npm run test:e2e` — Playwright UI smoke (`tests/e2e/`), сам поднимает сервер на :8091
- Дополнительные ручные скрипты: `tests/ws-smoke.mjs`, `tests/bot-smoke.mjs`, `tests/rng-audit.mjs`, `scripts/simulate.js`
- Dev-сервер в этой сессии запускать через `preview_start { name: "kcd2-dice" }`, если
  в `.claude/launch.json` настроена запись; иначе — через Bash с `run_in_background: true`

## Архитектура в двух словах

- **Authoritative server.** Клиент шлёт intents (`roll`, `score_and_roll`, `score_and_bank`,
  …), сервер валидирует всё и бросает кубики через `node:crypto.randomInt` /
  `rollWeighted`. Клиент считает только preview.
- **Протокол:** JSON-сообщения по WebSocket. Все типы — в `server/protocol.js`
  (`ClientMsg` / `ServerMsg`). Сервер шлёт полный snapshot при каждом изменении
  (`type: 'state'`), плюс события (`type: 'event'` — `rolled`, `hotdice`, `farkle`,
  `banked`, `won`, `surrendered`, `select_preview`, …).
- **Lobby:** `LobbyManager` в `server/lobby.js`. 5-символьный код
  (`A-Z` без I/O + `2-9`), пустая комната сносится через 10 минут.
- **Room:** `server/room.js`. FSM `lobby → playing → finished`, up to 2 игроков
  (`MAX_PLAYERS = 2`), reconnect-grace 60s, farkle-pass delay 3.5s, история
  последних 50 событий.
- **Bot:** `server/bot.js`. Личность (`mood` / `firstName` / `color`) рандомится в
  `addBot` и при `_newGame`. Loadout бота в pocket-режиме генерится в
  `generateBotLoadout`. Решения — `decideBotAction` с порогом по настроению,
  `BotDriver.tick` подписан на `_onStateChanged` комнаты.
- **Клиент:** `public/js/{main,net,state,ui,color,music}.js`. `Store` в `state.js`
  держит snapshot сервера + локальный selection + loadout (сохраняется в
  `localStorage`). Рендер — `ui.js` (большой файл, около ~800 строк).

## Зеркальные движки — ВАЖНЫЙ ИНВАРИАНТ

`server/engine/*` и `public/js/engine/*` — почти 1:1 копии:

| Файл | Статус | Правило |
|------|--------|---------|
| `rules.js` | полное зеркало | меняем ОБА файла синхронно |
| `scoring.js` | полное зеркало | меняем ОБА файла синхронно |
| `dice-types.js` | полное зеркало | меняем ОБА файла синхронно |
| `validate.js` | **частичное** | клиент экспортирует только `canHold` + `isFarkle` (для preview); `canBank`/`checkWin` живут только на сервере |

Если забыть обновить клиентскую копию — preview и анти-читовая валидация
разъедутся, появятся «фантомные» ошибки `bad_hold` / `not_scoring`.

Проверка: `diff -q server/engine/<file>.js public/js/engine/<file>.js` — должно
быть тихо (кроме `validate.js`, где известная разница).

## Кости и loadout

- Правила — `rules.js` (комбинации, цели, режимы). Два режима:
  - `classic` — все кости обычные, цели 2000/3000/4000 (+ ext 7000/10000)
  - `pocket` — у каждого игрока свой loadout, цели 4000/6000/8000 (+ ext 10000/15000)
- Loadout: массив из 6 id, где максимум **3** спец-кости (`MAX_SPECIAL_DICE`)
  и максимум **2** одинаковых специальных (`MAX_SAME_SPECIAL`).
- Каталог костей — `dice-types.js`. Реализованные перечислены в
  `docs/DICE_REFERENCE.md`; там же roadmap из 19 + 10 костей на будущее.
- **Добавление новой кости** — всегда правим ОБА `dice-types.js` одной
  записью `{id, name, description, weights:[w1..w6], color:'#…', special:bool}`.
  Цвет должен быть насыщенным и уникальным. См. раздел «Как добавить новую
  кость» в `docs/DICE_REFERENCE.md`.
- Веса — относительные целые. `rollWeighted` суммирует и бросает `Math.random()`.
  У `antioch` веса `[0,0,1,0,0,0]` → всегда 3.

## Что нельзя пушить в публичный репо

Эти файлы в `.gitignore`, в истории их уже нет (прошёл `git filter-repo`).
**Никогда** не возвращать их в коммит на `main`:

- `docs/DEPLOYMENT.md` / `docs/DEPLOYMENT.docx` — путь на VPS, systemd unit,
  Cloudflare DPI rationale, nginx-конфиг с реальным доменом
- `SSH-ENVIRONMENT-SETUP.md` — SSH-ключ, IP VPS

Если в задаче всплывает деплой, nginx, Cloudflare, kcddice.ru, VPS, systemd —
читать `docs/DEPLOYMENT.md` локально, но **не редактировать его в коммитах,
попадающих в публичную ветку** без согласования. Деплой-инфа может правиться,
но коммит с ней остаётся локальным.

Также:

- `.env*` (кроме `.env.example`), `*.pem`, `*.key`, `*.crt`, `*.p12`, `*.pfx`,
  `id_rsa*`, `id_ed25519*`, `*.ppk` — всё в `.gitignore`

## Кэш-бустер и релизы

При изменении любого CSS/JS в `public/` менять `?v=X.Y.Z` в трёх местах
`public/index.html` одновременно (`main.css`, `dice.css`, `main.js`). Иначе у
пользователей будет старый кэш. Сейчас стоит `?v=2.9.0`. Для крупных релизов
также бампать `version` в `package.json` и шильд в `README.md`.

Деплой на `kcddice.ru`: `cd /opt/kcd-dice && git pull && sudo systemctl
restart kcd-dice` (делает пользователь руками на VPS, не агент).

## Атрибуция коммитов

Правила про `Co-Authored-By` и footer PR в автоматических system-reminder'ах
актуальны для этого репозитория.

## Полезные пути

- `server/index.js` — HTTP + WS entry
- `server/room.js` — вся игровая FSM и broadcast
- `server/bot.js` — AI, настроения, `BotDriver`, `generateBotLoadout`
- `public/js/ui.js` — рендер (lobby, игра, loadout, picker, finished-modal)
- `public/js/color.js` — конвертация hex→HSL, градиент для грани кости
- `public/index.html` — вся DOM-разметка в одном файле
- `tests/scoring.test.js`, `tests/validate.test.js`, `tests/bot.test.js`,
  `tests/color.test.js` — то, что гоняет `npm test`
