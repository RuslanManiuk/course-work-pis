# HackFlow

Веб-платформа для автоматизації проведення хакатонів.  
Об'єднує реєстрацію, командоутворення, менторство, оцінювання та AI-асистента для журі в єдине середовище.

---

## Стан реалізації

### Backend (`/backend`) — реалізовано повністю

| Модуль | Статус |
|---|---|
| JWT авторизація (register / login / refresh) | ✅ |
| GitHub OAuth | ✅ |
| Профілі користувачів + GitHub-статистика | ✅ |
| CRUD хакатонів + критерії оцінювання | ✅ |
| Команди (створення, запрошення, вступ, вихід) | ✅ |
| Discord-інтеграція (авто-канали при створенні команди) | ✅ |
| Matchmaking — підбір команд за навичками | ✅ |
| Workspace: Kanban-дошка | ✅ |
| Workspace: Submit проєкту | ✅ |
| HelpDesk (черга тікетів + Jitsi-посилання) | ✅ |
| Журі: оцінювання + зважений рейтинг + лідерборд | ✅ |
| AI-асистент (RAG: ChromaDB + Gemini) зі стримінгом | ✅ |
| Адмін: управління користувачами, broadcast-сповіщення | ✅ |
| Транзакційні email (4 шаблони Jinja2, Mailtrap/SMTP) | ✅ |
| WebSocket (real-time: команди, хакатони, тікети, user) | ✅ |
| Заплановані задачі (нагадування дедлайнів) | ✅ |

### Frontend (`/frontend`) — повністю реалізовано

| Сторінка | Статус |
|---|---|
| Login / Register / GitHub Callback | ✅ |
| Dashboard | ✅ |
| Workspace (Kanban + Submit) | ✅ |
| HelpDesk | ✅ |
| Judging + AI-чат | ✅ |
| Список хакатонів | ✅ |
| Деталі хакатону | ✅ |
| Сторінки команд (create / join / leave) | ✅ |
| Matchmaking (пошук команд за навичками) | ✅ |
| Адмін-панель (users + broadcast) | ✅ |

---

## Швидкий старт (Docker — рекомендовано)

### 1. Клонування та налаштування

```bash
git clone <repo-url>
cd hackflow
cp .env.example .env
```

### 2. Обов'язкові змінні в `.env`

Відкрийте `.env` та встановіть:

```dotenv
JWT_SECRET=<випадковий рядок 32+ символи>
```

Згенерувати можна командою:

```bash
openssl rand -hex 32
```

Усі інші змінні мають значення за замовчуванням і не обов'язкові для локального запуску.

### 3. Запуск

```bash
docker compose up --build
```

Перший запуск займає ~2–3 хвилини (завантаження образів, збірка, міграції).

### 4. Перевірка

| Сервіс | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000/api/docs |
| ReDoc | http://localhost:8000/api/redoc |
| ChromaDB | http://localhost:8001/api/v1/heartbeat |

---

## Локальний запуск без Docker

### Передумови

- Python 3.11+
- Node.js 20+
- PostgreSQL 16
- Redis 7

### Backend

```bash
cd backend

# Створити віртуальне середовище
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Встановити залежності
pip install -r requirements.txt

# Налаштувати змінні середовища
cp ../.env.example ../.env
# Відредагувати .env: вказати DATABASE_URL, JWT_SECRET
# DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/hackflow

# Накатити міграції
alembic upgrade head

# Запустити сервер
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

npm install
npm run dev
```

---

## Зупинка та очистка

```bash
# Зупинити контейнери
docker compose down

# Зупинити і видалити всі дані (volumes)
docker compose down -v
```

---

## Зовнішні сервіси (опціонально для демо)

Усі інтеграції ввімкнені тільки якщо відповідні змінні задані у `.env`.  
Без них платформа повноцінно запускається і працює.

| Змінна | Потрібна для |
|---|---|
| `GITHUB_CLIENT_ID` + `GITHUB_CLIENT_SECRET` | OAuth логін через GitHub |
| `DISCORD_BOT_TOKEN` + `DISCORD_GUILD_ID` | Авто-канали Discord при створенні команди |
| `GEMINI_API_KEY` | AI-асистент журі |
| `SMTP_USER` + `SMTP_PASS` | Email-сповіщення (Mailtrap або Gmail) |

Детальні інструкції з налаштування — у [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).

---

## Структура проєкту

```
hackflow/
├── .env.example            # Шаблон змінних середовища
├── docker-compose.yml      # Повний стек (postgres, redis, chromadb, backend, frontend)
├── backend/
│   ├── app/
│   │   ├── api/v1/         # REST-ендпоінти (auth, users, hackathons, teams, ...)
│   │   ├── core/           # Config, dependencies, security, exceptions
│   │   ├── db/
│   │   │   ├── models/     # SQLAlchemy ORM-моделі
│   │   │   └── migrations/ # Alembic-міграції
│   │   ├── schemas/        # Pydantic-схеми запитів/відповідей
│   │   ├── services/       # discord, email, github, jitsi, rag
│   │   ├── tasks/          # (порожньо — заплановані задачі не реалізовані)
│   │   ├── templates/email/ # Jinja2 HTML-шаблони листів
│   │   └── websocket/      # WebSocket manager + handlers
│   ├── requirements.txt
│   └── Dockerfile
└── frontend/
    ├── src/
    │   ├── api/            # Axios-клієнти для кожного модуля
    │   ├── components/     # UI, layout, kanban, helpdesk, judging, ai
    │   ├── hooks/          # useAuth, useKanban, useWebSocket
    │   ├── pages/          # Сторінки по модулях
    │   ├── store/          # Zustand (auth, notifications)
    │   └── types/          # TypeScript-типи
    └── Dockerfile
```

---

## Документація

| Файл | Зміст |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Архітектура системи, ER-діаграма, flow запитів |
| [docs/API.md](docs/API.md) | Повний довідник API-ендпоінтів |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | Налаштування GitHub OAuth, Discord Bot, Gemini, Email |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Продакшн-деплой (Docker + nginx + SSL) |
