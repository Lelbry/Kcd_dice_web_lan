# KCD2 Dice — браузерная игра в кости (онлайн, v0.5)

Веб-реализация игры в кости из Kingdom Come: Deliverance II. Два игрока в браузере без установки, **играют через интернет по коду комнаты**. Сервер крутится на твоём ноутбуке (Windows / macOS / Linux), наружу выставляется через **Cloudflare Tunnel** — без проброса портов на роутере, с автоматическим HTTPS.

> **Ветки и версии:**
> — `main` — стабильная LAN/Radmin-версия `1.0.x` (для локальной сети / Radmin VPN).
> — `online-v0.5` — **эта** ветка: онлайн через Cloudflare Tunnel + комнаты по коду (beta).

![phase](https://img.shields.io/badge/status-beta-orange)
![license](https://img.shields.io/badge/license-MIT-blue)
![node](https://img.shields.io/badge/node-%E2%89%A520-green)

## Правила

6 кубиков. На своём ходу: бросаешь — выбираешь зачётные кости — решаешь продолжить (с риском зонка) или зафиксировать очки.

**Комбинации:**

| Комбинация | Очки |
|---|---|
| Одиночная «1» | 100 |
| Одиночная «5» | 50 |
| Три «1» | 1000 |
| Три N (N=2..6) | N × 100 |
| 4 одинаковых | ×2 от тройки |
| 5 одинаковых | ×4 от тройки |
| 6 одинаковых | ×8 от тройки |
| Стрит 1-5 | 500 |
| Стрит 2-6 | 750 |
| Стрит 1-6 | 1500 |

- **Зонк:** в броске нет ни одной зачётной → все очки хода сгорают, ход переходит.
- **Hot dice:** все 6 костей зачётные → обязательный переролл всех 6.
- **Стриты** засчитываются только в рамках одного броска.
- **Победа:** первый, у кого после фиксации очки ≥ цели (2000 / 3000 / 4000 — выбирается перед партией).

## Как играть (для пользователей)

1. Хост открывает свою ссылку (например `https://dice.example.com`) → нажимает **«Создать игру»**.
2. В шапке появляется **код комнаты** из 5 символов (например `ABCDE`). Кнопка-копипаст рядом.
3. Хост пересылает код другу любым способом (Telegram / Discord / SMS).
4. Друг открывает ту же ссылку → нажимает **«Войти»** → вводит код.
5. Когда оба видны в лобби, хост жмёт **«Начать игру»**.

Несколько пар могут играть одновременно — каждая в своей комнате, по своему коду.

---

## Что нужно установить (для разработчика / хостинга на своём ноуте)

- **Node.js 20+** (включает `npm`).
- **Cloudflare Tunnel** (`cloudflared`) — если ты разворачиваешь сервер для интернета.
- Один **свой домен**, делегированный на Cloudflare (бесплатно).

### Установка Node.js

#### Windows

1. Скачайте установщик **Windows Installer (.msi), LTS, 64-bit** со страницы [nodejs.org/en/download](https://nodejs.org/en/download).
2. Запустите `.msi`, кликайте **Next** на каждом шаге, ничего не меняйте — Path добавится автоматически.
3. **Закройте и заново откройте** окно PowerShell / Командной строки.
4. Проверьте: `node --version` и `npm --version`.

#### macOS / Linux

```bash
# macOS
brew install node@20

# Linux (Debian/Ubuntu)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
```

## Локальная разработка (без интернета)

```bash
npm install              # подтянет express и ws (выполняется один раз)
npm test                 # тесты движка + room-manager
npm start                # сервер на http://localhost:8080
npm start -- --port 9000 # другой порт
```

Открой `http://localhost:8080` в двух разных профилях браузера (или в обычном + Incognito). В одном создай игру, во втором введи код — это самая быстрая локальная проверка.

---

## Развёртывание онлайн через Cloudflare Tunnel

Этот сценарий позволяет любому твоему другу из интернета играть по обычной ссылке вида `https://dice.<твой-домен>`. Никаких портов на роутере открывать не нужно, и работает даже за CGNAT провайдера.

### Шаг 1 — делегировать домен на Cloudflare (разово)

1. Зарегистрируйся (бесплатно) на [cloudflare.com](https://www.cloudflare.com).
2. **Add a site** → введи свой домен → выбери Free-план.
3. Cloudflare покажет **2 nameserver** (например `nina.ns.cloudflare.com`, `bob.ns.cloudflare.com`).
4. У регистратора домена (там, где ты купил домен) замени NS-серверы на эти. Пропагация — от 15 минут до нескольких часов.
5. После того как в кабинете Cloudflare домен помечен зелёным — переходи к шагу 2.

### Шаг 2 — установить cloudflared

**Windows (PowerShell от администратора):**
```powershell
winget install --id Cloudflare.cloudflared
```
Альтернатива: MSI-инсталлятор с [github.com/cloudflare/cloudflared/releases](https://github.com/cloudflare/cloudflared/releases).

**macOS:** `brew install cloudflared`
**Linux:** см. [официальные инструкции](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).

### Шаг 3 — создать туннель

```bash
cloudflared tunnel login          # откроет браузер, выбери свой домен
cloudflared tunnel create kcd2-dice
# → запомни выведенный UUID и путь к <UUID>.json
```

### Шаг 4 — конфиг туннеля

Скопируй [`cloudflared/config.example.yml`](cloudflared/config.example.yml) в `%USERPROFILE%\.cloudflared\config.yml` (Windows) или `~/.cloudflared/config.yml` (Mac/Linux). Подставь UUID, путь к credentials-файлу и свой поддомен (например `dice.example.com`).

### Шаг 5 — DNS-запись и запуск

```bash
cloudflared tunnel route dns kcd2-dice dice.<твой-домен>
cloudflared tunnel run kcd2-dice
```

Параллельно в другом окне:

```bash
# Переменные окружения для прода:
# Windows PowerShell:
$env:ALLOWED_ORIGINS = "https://dice.example.com"
$env:PORT = "8080"
# Linux/macOS:
export ALLOWED_ORIGINS=https://dice.example.com
export PORT=8080

npm start
```

Откройте `https://dice.<твой-домен>` — должна загрузиться игра уже через HTTPS.

### Шаг 6 — автозапуск (Windows-сервис через NSSM)

Чтобы сервер поднимался сам после ребута ноута:

1. **Туннель**: `cloudflared service install` — Cloudflare сам поставит туннель как Windows service.
2. **Node-сервер** через [NSSM](https://nssm.cc/):
   - Скачай `nssm.exe`, положи в `C:\Windows\System32`.
   - В PowerShell от админа: `nssm install kcd2-dice`.
   - В GUI укажи:
     - **Path**: `C:\Program Files\nodejs\node.exe`
     - **Arguments**: `server/index.js`
     - **Startup directory**: путь к репозиторию
     - **Environment** (вкладка Environment): `PORT=8080`, `ALLOWED_ORIGINS=https://dice.example.com`, `MAX_ROOMS=50`
   - `nssm start kcd2-dice` — запустит сервис; дальше будет подниматься автоматически.

### Шаг 7 — проверка

- В DevTools (F12) → Network → видно `wss://dice.<домен>/` со статусом 101 Switching Protocols.
- Открой `https://dice.<домен>/healthz` — должен вернуться JSON `{"ok":true,"ts":...}`.
- Друг с мобильного интернета (не из твоей сети) открывает ссылку, вводит код — попадает в твою комнату.

---

## Игра против бота

Если играть некому — добавь AI-противника прямо из лобби.

1. Создай игру, в лобби в свободном слоте нажми **«+ Добавить бота»**.
2. Бот появится со случайным именем из пула KCD2-персонажей, гонщиков Формулы-1 и шахматистов (например, «Ян Жижка», «Льюис Хэмилтон», «Магнус Карлсен»).
3. Выбери цель партии и нажми «Начать игру».
4. После окончания партии в финальной модалке откроется **полное имя бота** + описание его стиля игры.

**Стили (настроения) бота** — случайны на каждую партию:

| Прозвище | Поведение |
|---|---|
| Осторожный | Банкует рано, минимум риска |
| Расчётливый | Сбалансированная стратегия |
| Дерзкий | Идёт на лишний бросок чаще, охотится за hot dice |
| Безбашенный | Банкует только под победу или огромный замес |
| Хладнокровный | Чистая логика, без эмоций и рофла |
| Шальной | Непредсказуем — порог риска случайный на каждое решение |

Бот **рискует больше**, когда соперник близок к победе или сам отстаёт. У большинства настроений ~5 % шанс «рофла» — случайной инверсии решения.

---

## Управление

| Действие | Кнопка / Hotkey |
|---|---|
| Выбрать/снять кость | клик по кости |
| Бросить кости (первый бросок хода) | кнопка «Бросить» / `Space` |
| Записать выбор и перебросить оставшиеся | кнопка «Записать и продолжить» / `F` |
| Записать выбор и закончить ход (бэнк) | кнопка «Записать и закончить ход» / `Q` |
| Помощь (правила) | `T` |
| Скопировать код комнаты | кнопка ⧉ в шапке |

## Цвет кубиков

В лобби каждый игрок выбирает свой **цвет кубиков**. Оппонент видит ваши кубики именно этим цветом. Слайдер **☼ яркости** в шапке — локальная настройка вашего экрана (не передаётся оппоненту).

## Первый игрок

Кто бросает первым выбирается **случайно** каждой партии (`crypto.randomInt`). В логе ходов появится строка «Игра началась, первым ходит …».

## Технологии

- **Сервер:** Node.js 20+, Express, `ws` (нативный WebSocket), `RoomManager` (in-memory).
- **Клиент:** vanilla HTML / CSS / ES-модули, без бандлера и без фреймворков.
- **Тесты:** встроенный `node:test`.
- **Авторитативный сервер:** клиент шлёт только намерения, сервер бросает кубики через `crypto.randomInt` и валидирует все ходы.
- **Деплой:** Cloudflare Tunnel + NSSM (Windows-сервис).

## Безопасность (что есть в v0.5)

- Origin-check на WebSocket (см. `ALLOWED_ORIGINS`).
- Rate-limit на handshake: 10 hello/мин с одного IP (по `cf-connecting-ip`).
- Лимит на количество одновременных комнат (`MAX_ROOMS`, по умолчанию 50).
- Пустые комнаты (created без подключения 60с / оба игрока ушли > 60с) автоматически удаляются.

## Структура

```
server/
  index.js          # Express static + WebSocket upgrade, origin/rate-limit, graceful shutdown
  room-manager.js   # Map<code, GameRoom>, TTL, лимиты — NEW в v0.5
  room.js           # GameRoom: FSM ходов, broadcast, dispose
  protocol.js       # типы сообщений, валидация, RoomAction
  bot.js            # личность бота + BotDriver
  engine/
    rules.js, scoring.js, validate.js
public/
  index.html        # room-select + лобби + игровой экран + модалки
  styles/
  js/
    main.js         # room-select flow, persisted last-room, hotkeys
    net.js          # WebSocket + reconnect backoff
    state.js        # snapshot + selection + roomCode
    ui.js           # рендер DOM по снапшоту, бейдж комнаты в шапке
    engine/         # зеркало серверного движка (preview-скор)
tests/
  scoring.test.js, validate.test.js, bot.test.js, color.test.js
  room-manager.test.js   # NEW в v0.5
cloudflared/
  config.example.yml     # шаблон конфига туннеля
.env.example
```

## Известные ограничения v0.5

- Состояние комнат хранится в памяти Node-процесса — рестарт сервера = все активные игры теряются. Достаточно для seamless-пары; для прода с десятками комнат нужна персистентность.
- Нет аутентификации игроков (кроме нормализации `clientId` в localStorage браузера). Подсмотревший код может войти как третий, увидит «комната занята». Если нужна защита — добавить пароль на комнату в следующей версии.

## Лицензия

MIT — см. [LICENSE](LICENSE).
