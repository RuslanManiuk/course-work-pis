# Налаштування зовнішніх інтеграцій

Усі інтеграції опціональні для локального запуску.  
Якщо змінна не задана — відповідна функціональність просто не спрацює, але платформа запуститься.

---

## GitHub OAuth

Потрібно для:
- Входу через кнопку "Login with GitHub"
- Автоматичного підтягування GitHub-статистики (repos, followers, languages)

### Кроки

1. Перейдіть на https://github.com/settings/developers
2. **"New OAuth App"**:
   - **Application name:** HackFlow
   - **Homepage URL:** `http://localhost:5173`
   - **Authorization callback URL:** `http://localhost:8000/api/v1/auth/github/callback`
3. Скопіюйте **Client ID** і згенеруйте **Client Secret**

### `.env`

```dotenv
GITHUB_CLIENT_ID=Ov23li...
GITHUB_CLIENT_SECRET=abc123def456...
GITHUB_REDIRECT_URI=http://localhost:8000/api/v1/auth/github/callback
```

### Перевірка

```bash
curl http://localhost:8000/api/v1/auth/github
# Повинен повернути {"redirect_url": "https://github.com/login/oauth/authorize?..."}
```

---

## Discord Bot

Потрібно для:
- Автоматичного створення текстового і голосового каналу при формуванні команди

### Кроки

1. Перейдіть на https://discord.com/developers/applications
2. **"New Application"** → дайте назву "HackFlow Bot"
3. Перейдіть у **Bot** → **"Add Bot"** → скопіюйте **Token**
4. У **OAuth2 → URL Generator**:
   - Scopes: `bot`
   - Bot Permissions: `Manage Channels`, `View Channels`, `Send Messages`
5. Скопіюйте згенерований URL і перейдіть по ньому — додайте бота до вашого Discord-сервера
6. Щоб отримати Guild ID:
   - Увімкніть Developer Mode у Discord (Settings → Advanced)
   - ПКМ по назві сервера → **"Copy Server ID"**

### `.env`

```dotenv
DISCORD_BOT_TOKEN=MTI...
DISCORD_GUILD_ID=1234567890123456789
```

### Як це працює

При POST `/teams` бекенд запускає фоновий таск:
1. Знаходить або створює категорію `hackflow-teams` на сервері
2. Створює текстовий канал `team-{name}-text`
3. Створює голосовий канал `team-{name}-voice`
4. Зберігає ID каналів у БД і оновлює `discord_integrations.sync_status = 'synced'`
5. Відправляє WebSocket-подію `discord:channel-created` до frontend

### Перевірка

```bash
# Після створення команди через API, подивіться на запис в БД:
# discord_integrations: sync_status = 'synced'
# teams: discord_text_channel_id IS NOT NULL
```

---

## Google Gemini API (AI-асистент)

Потрібно для:
- AI-асистента журі: RAG-відповіді на запитання про проєкти команд
- Ембедингів для ChromaDB (векторна індексація сабмітів)

### Кроки

1. Перейдіть на https://aistudio.google.com/app/apikey
2. **"Create API key"**
3. Виберіть або створіть Google Cloud Project

### `.env`

```dotenv
GEMINI_API_KEY=AIzaSy...
```

### Використовувані моделі

| Операція | Модель |
|---|---|
| Генерація відповідей | `gemini-1.5-flash` |
| Ембединги | `models/text-embedding-004` |

### Безкоштовний ліміт (станом на 2024)

- 15 RPM (requests per minute) для flash моделі
- 1M токенів на день

### Як це працює

**Індексація (при submit проєкту):**
```
description + repo_url + team_name → text-embedding-004 → 768-dim vector → ChromaDB
```

**Запит судді:**
```
question → text-embedding-004 → cosine similarity search в ChromaDB
         → top-5 релевантних документів
         → gemini-1.5-flash (stream) → SSE до браузера
```

### ChromaDB

ChromaDB запускається як окремий Docker-контейнер. Дані зберігаються у volume `chroma_data`.

```bash
# Перевірити, що ChromaDB живий:
curl http://localhost:8001/api/v1/heartbeat
# {"nanosecond heartbeat": 1234567890}
```

---

## Email (Mailtrap / Gmail SMTP)

Потрібно для:
- Листа при запрошенні до команди (`team_invite.html`)
- Листа коли ментор взяв тікет (`mentor_assigned.html`)
- Листа з результатами оцінювання (`score_published.html`)
- Нагадувань дедлайнів (`deadline_reminder.html`)

### Варіант 1: Mailtrap (для розробки — рекомендовано)

1. Зареєструйтесь на https://mailtrap.io
2. Inbox → **SMTP Settings** → скопіюйте credentials

```dotenv
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=<ваш_mailtrap_user>
SMTP_PASS=<ваш_mailtrap_pass>
EMAIL_FROM=noreply@hackflow.dev
```

Mailtrap перехоплює всі листи — реальні email не надсилаються. Ідеально для тестування.

### Варіант 2: Gmail SMTP (для demo/production)

1. Увімкніть 2-factor authentication на Gmail
2. Перейдіть на https://myaccount.google.com/apppasswords
3. Створіть App Password для "Mail"

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your.email@gmail.com
SMTP_PASS=<16-символьний app password>
EMAIL_FROM=your.email@gmail.com
```

### Перевірка

```bash
# Через API: запросіть когось у команду
curl -X POST http://localhost:8000/api/v1/teams/{team_id}/invite/email \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
# Перевірте Mailtrap inbox або Gmail sent
```

---

## Jitsi Meet

**Налаштування не потрібне.** Jitsi Meet (meet.jit.si) — відкритий безкоштовний сервіс.

При assign тікету система генерує URL:
```
https://meet.jit.si/hackflow-{ticket_id}
```

Унікальний UUID в URL забезпечує приватність кімнати.  
Ніякого API-ключа не потрібно.

---

## Повна `.env` з усіма інтеграціями

```dotenv
# ─── Database ───────────────────────────────────────────
POSTGRES_USER=hackflow
POSTGRES_PASSWORD=hackflow_secret
POSTGRES_DB=hackflow
DATABASE_URL=postgresql+asyncpg://hackflow:hackflow_secret@postgres:5432/hackflow

# ─── Redis ──────────────────────────────────────────────
REDIS_URL=redis://redis:6379/0

# ─── ChromaDB ───────────────────────────────────────────
CHROMA_HOST=chromadb
CHROMA_PORT=8000

# ─── JWT ────────────────────────────────────────────────
JWT_SECRET=<openssl rand -hex 32>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# ─── GitHub OAuth ───────────────────────────────────────
GITHUB_CLIENT_ID=Ov23li...
GITHUB_CLIENT_SECRET=abc123...
GITHUB_REDIRECT_URI=http://localhost:8000/api/v1/auth/github/callback

# ─── Discord ────────────────────────────────────────────
DISCORD_BOT_TOKEN=MTI...
DISCORD_GUILD_ID=123456789...

# ─── Gemini ─────────────────────────────────────────────
GEMINI_API_KEY=AIzaSy...

# ─── Email ──────────────────────────────────────────────
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=<mailtrap_user>
SMTP_PASS=<mailtrap_pass>
EMAIL_FROM=noreply@hackflow.dev

# ─── App ────────────────────────────────────────────────
ENVIRONMENT=development
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:8000
```
