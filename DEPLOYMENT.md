# Деплой KCD Dice — kcddice.ru

Текущая конфигурация production-сервера и инструкции по обновлению.

---

## Что на сервере

| Параметр | Значение |
|---|---|
| Адрес | http://kcddice.ru |
| Путь к проекту | `/opt/kcd-dice/` |
| Ветка | `main` |
| Процесс | systemd сервис `kcd-dice.service` (auto-restart, enabled) |
| Node.js | слушает `localhost:3000` |
| Reverse proxy | nginx, порт 80 → 3000 (с WebSocket upgrade) |
| Протокол | HTTP (не HTTPS, см. «Почему нет HTTPS») |

---

## Обновление

```bash
cd /opt/kcd-dice && git pull && sudo systemctl restart kcd-dice
```

**Важно:** при обновлении CSS/JS менять `?v=X.X.X` в `public/index.html`, чтобы сбросить кеш браузеров у пользователей:

```html
<link rel="stylesheet" href="/styles/main.css?v=2.0.2" />
<link rel="stylesheet" href="/styles/dice.css?v=2.0.2" />
<script type="module" src="/js/main.js?v=2.0.2"></script>
```

---

## Логи

```bash
journalctl -u kcd-dice -f
```

---

## Cloudflare DNS

| Параметр | Значение |
|---|---|
| Режим | **DNS only** (серое облако), без proxy |
| HTTPS | Отключён (Always Use HTTPS, Automatic HTTPS Rewrites, Opportunistic Encryption — **off**) |

### Почему нет HTTPS

Cloudflare proxy тормозил загрузку статики (~19 сек на файл), а DPI блокирует TLS на порт 443 напрямую к серверу. Поэтому:

- Cloudflare работает в режиме DNS only (только резолвинг, без проксирования)
- Сайт отдаётся по HTTP
- WebSocket подключается по `ws://` (не `wss://`) — протокол определяется автоматически из `location.protocol` в клиентском коде

---

## Конфиг nginx

Находится на сервере. Ключевые директивы:

```nginx
server {
    listen 80;
    server_name kcddice.ru;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Заголовки `Upgrade` и `Connection "upgrade"` обязательны для WebSocket.

---

## Конфиг systemd

`/etc/systemd/system/kcd-dice.service`:

```ini
[Unit]
Description=KCD2 Dice Game
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/kcd-dice
ExecStart=/usr/bin/node server/index.js --port 3000
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

---

## Архитектура (v2.0.0)

- **Мульти-лобби** — неограниченное количество одновременных игровых комнат
- **5-символьные коды** — создание/присоединение к лобби по коду или ссылке `http://kcddice.ru/?lobby=XXXXX`
- **Автоочистка** — пустые лобби удаляются через 10 минут
- **Бот** — можно добавить AI-противника прямо из лобби

---

## Известные ограничения

- Нет HTTPS/WSS из-за DPI (см. выше)
- `prompt()` не поддерживается в некоторых контекстах — имя задаётся через поле в интерфейсе
- При обновлении CSS/JS обязательно менять cache-bust параметр `?v=`

---

## Развёртывание с нуля на другом сервере

См. README.md — раздел «Развёртывание на сервере (production)».
