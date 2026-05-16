# HackFlow — CLAUDE.md

## Проект

**HackFlow** — веб-платформа для автоматизації проведення хакатонів.
Повний full-stack: FastAPI (Python) + React 18 (TypeScript) + PostgreSQL + Redis + ChromaDB + Docker.

**Шлях до проекту:** `/Users/admin/course-work-pis/hackflow/`

---

## Архітектура

```
hackflow/
├── backend/          FastAPI + SQLAlchemy 2.0 async + Alembic
├── frontend/         React 18 + Vite + TypeScript + Zustand + TanStack Query
├── docker-compose.yml
└── .env              (копія з .env.example)
```

### Локальні адреси

| Сервіс | URL |
|--------|-----|
| Frontend (Vite dev) | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/api/docs |
| ReDoc | http://localhost:8000/api/redoc |
| ChromaDB | http://localhost:8001 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

---

## Як запустити локально

### Docker (рекомендовано)

```bash
cd /Users/admin/course-work-pis/hackflow
cp .env.example .env
# Встановити JWT_SECRET в .env (мінімальна вимога)
docker compose up --build
```

### Без Docker (окремо)

**Backend:**
```bash
cd hackflow/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd hackflow/frontend
npm install
npm run dev   # запускає на http://localhost:5173
```

---

## Стек технологій

### Backend
- Python 3.11+, FastAPI 0.111, Uvicorn
- SQLAlchemy 2.0 (async) + asyncpg + PostgreSQL 16
- Alembic (міграції), Pydantic v2
- JWT (python-jose HS256) + bcrypt
- Redis (pub/sub, WebSocket), ChromaDB (RAG)
- Google Gemini API (AI embeddings + відповіді)
- APScheduler (фонові задачі)
- Discord API, GitHub OAuth, Jitsi, SMTP

### Frontend
- React 18.3 + TypeScript 5.4 + Vite 5.2
- Zustand 4.5 (global state), TanStack Query 5 (server state)
- React Router v6, Axios 1.7 + interceptors
- socket.io-client 4.7 (WebSocket)

---

## Ролі користувачів

| Роль | Доступ |
|------|--------|
| `hacker` | Teams, Workspace, HelpDesk |
| `mentor` | HelpDesk (assign + Jitsi), Teams |
| `judge` | Judging panel, AI assistant |
| `organizer` | Все + Admin panel |

---

## API структура

**Base:** `http://localhost:8000/api/v1`

| Модуль | Endpoints |
|--------|-----------|
| Auth | `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/github`, `/auth/me` |
| Users | `/users/me`, `/users/{id}`, `/users/{id}/github-stats` |
| Hackathons | `/hackathons` (CRUD) + `/hackathons/{id}/criteria` |
| Teams | `/teams` (CRUD) + join/leave/invite/members |
| Workspace | `/teams/{id}/workspace`, `/teams/{id}/cards`, `/teams/{id}/submissions` |
| Matchmaking | `/hackathons/{id}/matchmaking/suggestions` |
| Judging | `/hackathons/{id}/submissions`, `/submissions/{id}/evaluate`, `/hackathons/{id}/leaderboard` |
| AI | `/hackathons/{id}/ai/query` (streaming SSE) |
| HelpDesk | `/helpdesk/tickets` (CRUD + assign) |
| Admin | `/admin/users`, `/admin/broadcast` |
| WebSocket | `ws://localhost:8000/ws?token=<jwt>` |

---

## База даних (PostgreSQL)

**13 таблиць:** users, user_profiles, hackathons, evaluation_criteria, teams, team_members, kanban_cards, submissions, evaluations, helpdesk_tickets, discord_integrations, notifications, github_stats

**ChromaDB:** колекції `hackathon_{id}` — векторний пошук по submissions (Gemini embeddings)

---

## Правила розробки

### Загальні правила

1. **Мова коду:** змінні, функції, коментарі — англійська. UI тексти — за замовчуванням англійська, але можна українська якщо є вже така традиція в проекті.
2. **Типізація:** завжди повна TypeScript типізація. На бекенді — Pydantic v2 схеми для всього.
3. **Async/await:** весь backend код — async. Немає синхронних блокуючих операцій.
4. **Error handling:** HTTP помилки через `HTTPException` subclasses з `exceptions.py`. На фронті — через axios interceptors.
5. **Auth:** завжди перевіряти `CurrentUser` через `dependencies.py`. Не хардкодити токени.
6. **Secrets:** ніколи не комітити `.env` файли. Використовувати `.env.example` як шаблон.

### Backend правила

- Нові endpoints додавати в `app/api/v1/` як окремі модулі
- Роутер реєструвати в `app/main.py`
- Всі DB операції — через `AsyncSession` з `get_session` dependency
- Нові таблиці — через Alembic міграцію (`alembic revision --autogenerate`)
- Сервіси зовнішніх API — в `app/services/`
- Pydantic схеми — в `app/schemas/`

### Frontend правила

- Нові сторінки — в `src/pages/`
- Компоненти — в `src/components/`
- API виклики — через модулі в `src/api/` (не напряму axios)
- Глобальний стан — Zustand stores в `src/store/`
- Server state — TanStack Query (useQuery, useMutation)
- Роутинг — через `src/router.tsx`

---

## ОБОВ'ЯЗКОВА ПЕРЕВІРКА ЧЕРЕЗ БРАУЗЕР

**Після кожної зміни фронтенду або будь-якого функціоналу — перевіряти в браузері на localhost.**

### Порядок перевірки

1. Переконатись що сервер запущений:
   ```bash
   # Перевірити чи запущений backend
   curl http://localhost:8000/api/v1/auth/me 2>/dev/null | head -5
   # Перевірити чи запущений frontend
   curl -s http://localhost:5173 | head -3
   ```

2. Відкрити браузер і протестувати зміни:
   - Використовувати Playwright або Puppeteer MCP інструменти
   - Або відкрити `open http://localhost:5173` в терміналі

3. **Чеклист перевірки після змін:**
   - [ ] Сторінка відкривається без помилок в консолі
   - [ ] Нова функціональність працює
   - [ ] Авторизація не зламана (login/logout)
   - [ ] API виклики повертають правильні дані (перевірити Network tab)
   - [ ] Немає TypeScript помилок (`npm run lint`)
   - [ ] Немає Python помилок (`uvicorn` логи в терміналі)

4. **Swagger перевірка API змін:**
   - Відкрити http://localhost:8000/api/docs
   - Протестувати новий endpoint через Swagger UI
   - Переконатись що схеми правильні

### Автоматична перевірка через браузер (Playwright/Puppeteer)

При кожному значному апгрейді використовувати browser automation для перевірки:

```bash
# Перевірити що frontend запущений і відповідає
curl -s http://localhost:5173 | grep -q "<!DOCTYPE html" && echo "OK" || echo "FAIL"

# Перевірити backend health
curl -s http://localhost:8000/api/v1/auth/me | python3 -c "import sys,json; d=json.load(sys.stdin); print('AUTH OK' if 'detail' in d else 'AUTH FAIL')"

# Перевірити Swagger доступність
curl -s http://localhost:8000/api/docs | grep -q "swagger" && echo "SWAGGER OK" || echo "SWAGGER FAIL"
```

**Правило:** не вважати задачу виконаною поки не перевірено в браузері або через browser automation інструменти (Playwright MCP).

---

## Upgrade план (в процесі)

Ціль: потужний апгрейд всього проекту — фронт, бек, інфраструктура.

### Пріоритети апгрейду

**Frontend:**
- Додати UI component library (shadcn/ui або Radix UI)
- Покращити дизайн всіх сторінок
- Додати dark mode
- Покращити UX/навігацію
- Додати loading states та skeleton screens
- Покращити error boundaries та error messages

**Backend:**
- Додати rate limiting
- Покращити логування (structured logs)
- Додати health check endpoints
- Покращити валідацію вхідних даних
- Додати pagination де потрібно
- Покращити error messages

**Інфраструктура:**
- Налаштувати CI/CD
- Додати тести (pytest для backend, Vitest для frontend)
- Покращити Docker конфігурацію
- Додати моніторинг

---

## Корисні команди

```bash
# Docker
docker compose up --build          # запустити все
docker compose down                # зупинити
docker compose logs backend -f     # логи бекенду
docker compose logs frontend -f    # логи фронтенду

# Backend (без Docker)
cd hackflow/backend
alembic upgrade head               # застосувати міграції
alembic revision --autogenerate -m "description"  # нова міграція
uvicorn app.main:app --reload --port 8000

# Frontend (без Docker)
cd hackflow/frontend
npm run dev                        # dev server
npm run build                      # production build
npm run lint                       # ESLint перевірка

# Перевірка API
curl http://localhost:8000/api/v1/auth/me
curl http://localhost:8000/api/docs
```

---

## Файли документації проекту

| Файл | Зміст |
|------|-------|
| `docs/README.md` | Огляд + Quick Start |
| `docs/ARCHITECTURE.md` | Архітектура + ER діаграма |
| `docs/API.md` | Повний API reference |
| `docs/DATABASE.md` | Схема БД |
| `docs/INTEGRATIONS.md` | Налаштування інтеграцій |
| `docs/DEPLOYMENT.md` | Production деплой |
