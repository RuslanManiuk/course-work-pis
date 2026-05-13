# Архітектура HackFlow

## Загальна схема

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                               │
│                                                                     │
│   React 18 + TypeScript                                             │
│   React Router v6 | TanStack Query v5 | Zustand | Axios            │
│   WebSocket (native) | Vite 5                                       │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ HTTP REST + WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           API LAYER                                  │
│                                                                     │
│   FastAPI 0.111 (Python 3.11)                                      │
│   Uvicorn (ASGI)                                                    │
│                                                                     │
│   /api/v1/auth          JWT + GitHub OAuth                         │
│   /api/v1/users         Профілі + GitHub Stats                     │
│   /api/v1/hackathons    CRUD + критерії                            │
│   /api/v1/teams         Команди + запрошення                       │
│   /api/v1/matchmaking   Підбір за навичками                        │
│   /api/v1/workspace     Kanban + Submissions                       │
│   /api/v1/helpdesk      HelpDesk черга                             │
│   /api/v1/judging       Оцінювання + лідерборд                     │
│   /api/v1/admin         Адмін-панель                               │
│   /ws/*                 WebSocket rooms                            │
└───────┬───────────────┬─────────────────────┬───────────────────────┘
        │               │                     │
        ▼               ▼                     ▼
┌──────────────┐ ┌─────────────┐    ┌─────────────────────────────────┐
│  PostgreSQL  │ │    Redis    │    │         EXTERNAL SERVICES        │
│              │ │             │    │                                  │
│  Основна БД  │ │  WebSocket  │    │  GitHub API   — OAuth + stats   │
│  SQLAlchemy  │ │  pub/sub    │    │  Discord API  — bot channels    │
│  asyncpg     │ │  (cache)    │    │  Jitsi Meet   — video rooms     │
│  Alembic     │ │             │    │  Google Gemini — AI generation  │
└──────────────┘ └─────────────┘    │  ChromaDB     — vector store   │
                                    │  SMTP/Mailtrap — emails         │
                                    └─────────────────────────────────┘
```

---

## Компоненти

### Backend

Написаний на **FastAPI** з асинхронним SQLAlchemy (asyncpg driver). Повністю async — всі I/O-операції (БД, HTTP, SMTP) виконуються без блокування event loop.

**Структура:**
```
app/
├── main.py             # FastAPI app factory, middleware, router registration
├── api/v1/             # Ендпоінти по модулях
├── core/
│   ├── config.py       # Pydantic Settings (зчитує .env)
│   ├── dependencies.py # CurrentUser, get_session, require_role
│   ├── security.py     # JWT create/decode, bcrypt hash/verify
│   └── exceptions.py   # Кастомні HTTP-exceptions
├── db/
│   ├── base.py         # AsyncEngine, AsyncSession, Base
│   ├── models/         # SQLAlchemy ORM-моделі
│   └── migrations/     # Alembic (один файл 001_initial_schema.py)
├── schemas/            # Pydantic v2 (request/response)
├── services/           # Клієнти зовнішніх сервісів
├── websocket/          # ConnectionManager + WebSocket handlers
└── templates/email/    # Jinja2 HTML для листів
```

### Frontend

**React 18** SPA. Роутинг — React Router v6. Стан сервера — TanStack Query. Глобальний стан (auth, notifications) — Zustand. HTTP — Axios з interceptor для авто-refresh токена.

```
src/
├── api/            # Axios-клієнти (auth.ts, hackathons.ts, teams.ts ...)
├── components/     # Перевикористовувані UI-компоненти
│   ├── ai/         # AI chat компоненти
│   ├── helpdesk/   # HelpDesk UI
│   ├── judging/    # Форми оцінювання
│   ├── kanban/     # Kanban board
│   ├── layout/     # AppLayout (sidebar, header)
│   ├── team/       # Team components
│   └── ui/         # NotificationBell тощо
├── hooks/          # useAuth, useKanban, useWebSocket
├── pages/          # Сторінки-маршрути
├── store/          # Zustand stores
└── types/          # TypeScript interfaces
```

---

## База даних

### ER-діаграма (основні сутності)

```
users ──────────────── user_profiles
  │                        (1:1, CASCADE)
  │
  ├── hackathons (organizer_id)
  │       │
  │       ├── evaluation_criteria
  │       │
  │       └── teams ──── team_members ── users
  │               │           (M:M)
  │               │
  │               ├── kanban_cards
  │               │
  │               ├── submissions ──── evaluations ── evaluation_criteria
  │               │                        │
  │               │                   judge (user)
  │               │
  │               └── discord_integrations
  │
  ├── helpdesk_tickets (created_by, assigned_mentor)
  │
  ├── notifications (user_id)
  │
  └── github_stats (user_id, 1:1)
```

### Таблиці

| Таблиця | Призначення |
|---|---|
| `users` | Акаунти: email, username, password_hash, role, github_id |
| `user_profiles` | Розширений профіль: bio, skills (JSONB), tech_stack (JSONB) |
| `hackathons` | Хакатони з timeline і статусами |
| `evaluation_criteria` | Критерії з вагами (weight) та порядком |
| `teams` | Команди: назва, статус, avg_score, Discord channel IDs |
| `team_members` | M:M users↔teams з роллю (leader/member) |
| `kanban_cards` | Картки Kanban зі статусами todo/in_progress/done |
| `submissions` | Фінальні проєкти: repo URL, video, presentation, description |
| `evaluations` | Оцінки: score (1-10), feedback, UNIQUE(submission, judge, criteria) |
| `helpdesk_tickets` | Тікети: priority, status, jitsi_room_url |
| `discord_integrations` | Discord sync status для кожної команди |
| `notifications` | In-app сповіщення користувачів |
| `github_stats` | Кешована GitHub-статистика (TTL 24 год) |

### JSONB поля

Skills в `user_profiles.skills`:
```json
[
  {"name": "Python", "proficiency": "advanced"},
  {"name": "React", "proficiency": "intermediate"}
]
```

Tech stack в `user_profiles.tech_stack`:
```json
[
  {"tech": "FastAPI", "years": 2},
  {"tech": "PostgreSQL", "years": 3}
]
```

---

## Потік даних — ключові сценарії

### 1. Реєстрація + Login

```
Client → POST /auth/register
         → Перевірка унікальності email/username
         → bcrypt hash пароля
         → INSERT users + user_profiles
         → create_token_pair(user_id, role)
         ← {access_token, refresh_token}
```

### 2. Створення команди + Discord

```
Client → POST /teams
         → Перевірка: hackathon exists, user not in team
         → INSERT team + team_members (leader) + discord_integrations (pending)
         ← TeamResponse

         [Background Task]
         → discord_service.create_team_channels(guild_id, team_name)
           → GET /guilds/{id}/channels  (знайти/створити категорію)
           → POST /guilds/{id}/channels (text channel)
           → POST /guilds/{id}/channels (voice channel)
         → UPDATE teams SET discord_text_channel_id=..., discord_voice_channel_id=...
         → UPDATE discord_integrations SET sync_status='synced'
         → ws_manager.broadcast("team:{id}", "discord:channel-created", {...})
```

### 3. Submit → RAG індексація

```
Client → POST /teams/{id}/submissions  (status=submitted)
         → INSERT submissions
         
         [Background Task]
         → rag_service.index_submission(submission_id, hackathon_id, ...)
           → genai.embed_content(description)  [Gemini embedding]
           → chromadb.collection.upsert(id, embedding, document, metadata)
           → UPDATE submissions SET embedding_indexed=true
```

### 4. AI-запит судді (RAG + SSE)

```
Judge → POST /hackathons/{id}/ai/query {"question": "Who used ML?"}
        → genai.embed_content(question)          [Gemini embedding]
        → chromadb.query(embedding, n_results=5) [similarity search]
        → Зібрати context з top-5 документів
        → gemini.generate_content(context + question, stream=True)
        ← text/event-stream (чанки відповіді)
```

### 5. HelpDesk → Jitsi

```
Hacker → POST /helpdesk/tickets {"title": "Help!", "priority": "high"}
         → INSERT helpdesk_tickets (status=open)
         → ws_manager.broadcast("hackathon:{id}", "helpdesk:ticket-created", ...)

Mentor → POST /helpdesk/tickets/{id}/assign
         → UPDATE tickets SET status=assigned, 
                              assigned_mentor_id=...,
                              jitsi_room_url="https://meet.jit.si/hackflow-{ticket_id}"
         → ws_manager.broadcast("ticket:{id}", "ticket:assigned", {jitsi_room_url})
         
         [Background]
         → email_service.send_mentor_assigned(hacker_email, mentor_name, jitsi_url)
```

---

## Безпека

### JWT

- Access token: 15 хвилин, тип `access`
- Refresh token: 7 днів, тип `refresh`
- Алгоритм: HS256, секрет — `JWT_SECRET` з `.env`
- Payload: `{"sub": "user_id", "role": "hacker", "type": "access", "exp": ...}`

### Паролі

- bcrypt (passlib) з автоматичним salt
- GitHub OAuth users — `password_hash = None` (логін тільки через GitHub)

### RBAC

Перевірка ролей через `require_role(UserRole.organizer)` dependency або inline check в ендпоінтах.

| Роль | Можливості |
|---|---|
| `hacker` | Профіль, команди, workspace, helpdesk tickets |
| `mentor` | Все що hacker + assign/resolve tickets |
| `judge` | Перегляд submissions, оцінювання, AI-асистент |
| `organizer` | Все + створення хакатонів, адмін-панель |

### CORS

Whitelist: `FRONTEND_URL` та `http://localhost:5173`.

---

## WebSocket архітектура

`ConnectionManager` — in-memory room-based менеджер (singleton).

```python
# Кімнати
"team:{team_id}"        # Члени команди
"hackathon:{id}"        # Учасники хакатону
"ticket:{id}"           # Автор тікету + ментор
"user:{user_id}"        # Персональні сповіщення
```

Підключення аутентифікується JWT-токеном з query param `?token=<access_token>`.

**Обмеження:** In-memory — не масштабується горизонтально. Для production з кількома instances потрібен Redis pub/sub (Redis підключений, але не використовується для WS).

---

## Технологічний стек

| Шар | Технологія | Версія |
|---|---|---|
| Backend framework | FastAPI | 0.111 |
| ASGI server | Uvicorn | 0.29 |
| ORM | SQLAlchemy (async) | 2.0 |
| DB driver | asyncpg | 0.29 |
| Migrations | Alembic | 1.13 |
| Validation | Pydantic v2 | 2.7 |
| Auth | python-jose + passlib | - |
| HTTP client | httpx | 0.27 |
| Email | aiosmtplib | 3.0 |
| Templating | Jinja2 | 3.1 |
| AI generation | google-generativeai | 0.7 |
| Vector DB | chromadb | 0.5 |
| Frontend | React | 18.3 |
| Build | Vite | 5 |
| State | Zustand + TanStack Query | - |
| HTTP | Axios | 1.7 |
| Database | PostgreSQL | 16 |
| Cache | Redis | 7 |
| Containers | Docker + Compose | - |
