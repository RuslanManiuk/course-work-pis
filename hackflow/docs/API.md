# API Reference

Base URL: `http://localhost:8000/api/v1`  
Інтерактивна документація: http://localhost:8000/api/docs

## Автентифікація

Усі захищені ендпоінти потребують заголовку:

```
Authorization: Bearer <access_token>
```

Access token діє **15 хвилин**, refresh token — **7 днів**.

---

## Auth

### POST `/auth/register`

Реєстрація нового користувача.

**Body:**
```json
{
  "email": "user@example.com",
  "username": "hacker42",
  "password": "securepass123",
  "role": "hacker"
}
```

Допустимі ролі: `hacker`, `mentor`, `judge`, `organizer`.

**Response 201:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer"
}
```

**Errors:** `409` — email або username вже зайнятий.

---

### POST `/auth/login`

```json
{
  "email": "user@example.com",
  "password": "securepass123"
}
```

**Response 200:** `TokenResponse` (аналогічно register).  
**Errors:** `401` — невірні credentials або акаунт деактивований.

---

### POST `/auth/refresh`

```json
{
  "refresh_token": "eyJ..."
}
```

**Response 200:** нова пара `TokenResponse`.

---

### GET `/auth/github`

Отримати URL для редиректу на GitHub OAuth.

**Response 200:**
```json
{
  "redirect_url": "https://github.com/login/oauth/authorize?...",
  "state": "random_state_string"
}
```

---

### GET `/auth/github/callback?code=<code>`

GitHub OAuth callback. Автоматично створює або оновлює user.  
**Response 200:** `TokenResponse`.

---

## Users

### GET `/users/me` 🔒

Поточний авторизований користувач з профілем.

**Response 200:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "hacker42",
  "role": "hacker",
  "github_username": "hacker42",
  "avatar_url": "https://avatars.githubusercontent.com/...",
  "is_active": true,
  "created_at": "2024-01-01T00:00:00Z",
  "profile": {
    "id": "uuid",
    "bio": "Backend developer",
    "skills": [{"name": "Python", "proficiency": "advanced"}],
    "tech_stack": [{"tech": "FastAPI", "years": 2}],
    "years_experience": 3,
    "mentoring_expertise": null
  }
}
```

---

### PUT `/users/me/profile` 🔒

Оновити профіль. Усі поля опціональні.

**Body:**
```json
{
  "bio": "Full-stack developer",
  "skills": [
    {"name": "Python", "proficiency": "advanced"},
    {"name": "React", "proficiency": "intermediate"}
  ],
  "tech_stack": [
    {"tech": "FastAPI", "years": 2},
    {"tech": "PostgreSQL", "years": 3}
  ],
  "years_experience": 4
}
```

**Response 200:** `UserResponse`.

---

### GET `/users/{user_id}` 🔒

Профіль будь-якого користувача за ID.

---

### GET `/users/{user_id}/github-stats` 🔒

GitHub-статистика (репозиторії, фоловери, мови). Кешується на 24 год.

**Response 200:**
```json
{
  "repositories": 42,
  "followers": 10,
  "total_contributions": 42,
  "language_breakdown": [
    {"language": "Python", "percentage": 60.5},
    {"language": "TypeScript", "percentage": 39.5}
  ],
  "cached_at": "2024-01-01T00:00:00Z"
}
```

**Note:** Потребує GitHub OAuth access token збереженого при GitHub-логіні. Якщо токену немає — `404`.

---

## Hackathons

### GET `/hackathons`

Список хакатонів. Публічний.

**Query params:**
- `status` — фільтр: `draft` | `upcoming` | `active` | `completed` | `cancelled`
- `page` (default 1), `limit` (default 20, max 100)

**Response 200:** масив `HackathonResponse`.

---

### GET `/hackathons/{hackathon_id}`

Деталі хакатону.

**Response 200:**
```json
{
  "id": "uuid",
  "title": "AI Hackathon 2024",
  "description": "...",
  "status": "active",
  "start_date": "2024-06-01T09:00:00Z",
  "end_date": "2024-06-02T18:00:00Z",
  "submission_deadline": "2024-06-02T17:00:00Z",
  "registration_deadline": "2024-05-31T23:59:00Z",
  "max_team_size": 5,
  "min_team_size": 2
}
```

---

### POST `/hackathons` 🔒 `organizer`

Створити хакатон.

**Body:**
```json
{
  "title": "AI Hackathon 2024",
  "description": "48-hour hackathon focused on AI/ML solutions",
  "start_date": "2024-06-01T09:00:00Z",
  "end_date": "2024-06-02T18:00:00Z",
  "submission_deadline": "2024-06-02T17:00:00Z",
  "registration_deadline": "2024-05-31T23:59:00Z",
  "max_team_size": 5,
  "min_team_size": 2
}
```

**Response 201:** `HackathonResponse`.

---

### PUT `/hackathons/{hackathon_id}` 🔒 `organizer`

Оновити хакатон. Усі поля опціональні.

---

### POST `/hackathons/{hackathon_id}/criteria` 🔒 `organizer`

Встановити критерії оцінювання.

**Body:**
```json
{
  "criteria": [
    {"name": "Innovation", "description": "How innovative is the solution?", "weight": 3, "order": 1},
    {"name": "Technical Complexity", "description": "Complexity of implementation", "weight": 4, "order": 2},
    {"name": "Presentation", "description": "Quality of pitch and demo", "weight": 3, "order": 3}
  ]
}
```

**Response 201:** масив `CriteriaResponse`.

---

### GET `/hackathons/{hackathon_id}/criteria`

Отримати критерії оцінювання.

---

## Teams

### POST `/teams` 🔒

Створити команду. Автоматично призначає поточного юзера лідером.  
Якщо налаштований Discord — тригерить авто-створення каналів у фоні.

**Body:**
```json
{
  "hackathon_id": "uuid",
  "name": "Team Alpha",
  "description": "We build AI solutions"
}
```

**Response 201:** `TeamResponse`.  
**Errors:** `409` — юзер вже в команді для цього хакатону.

---

### GET `/teams/{team_id}` 🔒

Деталі команди з учасниками.

**Response 200:**
```json
{
  "id": "uuid",
  "hackathon_id": "uuid",
  "name": "Team Alpha",
  "description": "We build AI solutions",
  "leader_id": "uuid",
  "status": "forming",
  "size": 2,
  "avg_score": null,
  "invite_token": "abc123...",
  "invite_token_expires_at": "2024-06-04T00:00:00Z",
  "discord_text_channel_id": "1234567890",
  "discord_voice_channel_id": "1234567891",
  "members": [
    {"user_id": "uuid", "role": "leader", "joined_at": "2024-06-01T10:00:00Z"}
  ]
}
```

---

### PUT `/teams/{team_id}` 🔒

Оновити назву/опис команди. Тільки лідер.

---

### GET `/teams/{team_id}/invite`

Попередній перегляд запрошення по токену.

**Query params:** `token=<invite_token>`

**Response 200:**
```json
{
  "team_id": "uuid",
  "team_name": "Team Alpha",
  "hackathon_title": "AI Hackathon 2024",
  "current_size": 2,
  "max_size": 5,
  "expires_at": "2024-06-04T00:00:00Z"
}
```

---

### POST `/teams/{team_id}/join` 🔒

Приєднатися до команди за токеном.

**Body:**
```json
{
  "invite_token": "abc123..."
}
```

**Errors:** `409` — вже в команді; `400` — токен прострочений або команда повна.

---

### DELETE `/teams/{team_id}/leave` 🔒

Покинути команду. Лідер не може покинути — спочатку передайте лідерство.

---

### PUT `/teams/{team_id}/transfer-leadership` 🔒

Передати лідерство. Тільки поточний лідер.

**Body:** `{"new_leader_id": "uuid"}`

---

### POST `/teams/{team_id}/invite/email` 🔒

Надіслати email-запрошення.

**Body:** `{"email": "teammate@example.com"}`

---

## Matchmaking

### GET `/matchmaking/suggestions` 🔒

Підбір команд за навичками. Повертає команди в статусі `forming`, де є потреба у навичках поточного юзера. Сортується за `match_score` (0–1).

**Query params:**
- `hackathon_id` (обов'язковий)
- `limit` (default 10, max 50)

**Response 200:**
```json
[
  {
    "team_id": "uuid",
    "team_name": "Team Alpha",
    "description": "We build AI solutions",
    "current_size": 2,
    "skill_gap": ["Python", "Machine Learning"],
    "match_score": 0.75
  }
]
```

---

## Workspace

### GET `/teams/{team_id}/workspace` 🔒

Kanban-дошка команди.

**Response 200:**
```json
{
  "board": {
    "todo": [...],
    "in_progress": [...],
    "done": [...]
  }
}
```

---

### POST `/teams/{team_id}/kanban/cards` 🔒

Створити картку. Тільки члени команди.

**Body:**
```json
{
  "title": "Implement authentication",
  "description": "JWT + GitHub OAuth",
  "status": "todo",
  "assignee_id": "uuid"
}
```

**Response 201:** `KanbanCardResponse`.

---

### PUT `/teams/{team_id}/kanban/cards/{card_id}` 🔒

Оновити картку (перемістити між колонками, змінити assignee тощо).

**Body (всі поля опціональні):**
```json
{
  "title": "New title",
  "status": "in_progress",
  "assignee_id": "uuid"
}
```

---

### DELETE `/teams/{team_id}/kanban/cards/{card_id}` 🔒

Видалити картку.

---

### POST `/teams/{team_id}/kanban/reorder` 🔒

Перевпорядкувати картки в колонці.

**Body:**
```json
{
  "status": "todo",
  "ordered_ids": ["uuid1", "uuid2", "uuid3"]
}
```

---

### POST `/teams/{team_id}/submissions` 🔒

Подати фінальний проєкт.

**Body:**
```json
{
  "hackathon_id": "uuid",
  "repository_url": "https://github.com/team/project",
  "video_pitch_url": "https://youtube.com/watch?v=xxx",
  "presentation_url": "https://docs.google.com/presentation/d/xxx",
  "description": "Our AI solution that solves..."
}
```

**Response 201:** `SubmissionResponse`.  
**Note:** При статусі `submitted` автоматично індексується у ChromaDB для RAG.

---

### GET `/teams/{team_id}/submissions` 🔒

Поточний submit команди.

---

### PUT `/teams/{team_id}/submissions/{submission_id}` 🔒

Оновити submit (до дедлайну).

---

## HelpDesk

### POST `/helpdesk/tickets` 🔒

Створити тікет (запит до ментора).

**Body:**
```json
{
  "hackathon_id": "uuid",
  "team_id": "uuid",
  "title": "Need help with ML model",
  "description": "Our model overfits on training data...",
  "priority": "high"
}
```

Пріоритети: `low`, `medium`, `high`.

**Response 201:** `TicketResponse`.  
**Note:** Миттєво відправляє WebSocket-подію `helpdesk:ticket-created` до кімнати `hackathon:{id}`.

---

### GET `/helpdesk/tickets` 🔒

Список тікетів. Ментор бачить усі; учасник — тільки свої (в залежності від фільтру).

**Query params:**
- `hackathon_id`, `team_id`, `status` — опціональні фільтри

---

### GET `/helpdesk/tickets/{ticket_id}` 🔒

Деталі тікету.

**Response 200:**
```json
{
  "id": "uuid",
  "hackathon_id": "uuid",
  "team_id": "uuid",
  "title": "Need help with ML model",
  "description": "...",
  "priority": "high",
  "status": "assigned",
  "created_by_id": "uuid",
  "assigned_mentor_id": "uuid",
  "jitsi_room_url": "https://meet.jit.si/hackflow-<ticket-uuid>",
  "created_at": "2024-06-01T14:00:00Z"
}
```

---

### POST `/helpdesk/tickets/{ticket_id}/assign` 🔒 `mentor`

Взяти тікет в роботу. Генерує Jitsi URL і оповіщає учасника через WebSocket.

---

### PUT `/helpdesk/tickets/{ticket_id}` 🔒

Оновити тікет (тільки автор, тільки статус `open`).

---

### POST `/helpdesk/tickets/{ticket_id}/resolve` 🔒 `mentor`

Завершити сесію. Оновлює статус на `resolved`.

---

## Judging

### GET `/hackathons/{hackathon_id}/submissions` 🔒 `judge | organizer`

Список сабмітів для оцінювання. Показує прапорець `scored_by_me`.

**Response 200:**
```json
[
  {
    "submission_id": "uuid",
    "team_id": "uuid",
    "status": "submitted",
    "embedding_indexed": true,
    "scored_by_me": false
  }
]
```

---

### POST `/submissions/{submission_id}/evaluate` 🔒 `judge`

Виставити бали за всіма критеріями.

**Body:**
```json
{
  "evaluations": [
    {"criteria_id": "uuid", "score": 8, "feedback": "Strong innovation"},
    {"criteria_id": "uuid", "score": 7, "feedback": "Good technical depth"},
    {"criteria_id": "uuid", "score": 9, "feedback": "Excellent presentation"}
  ]
}
```

Оцінки: 1–10. Після збереження автоматично перераховується зважений `avg_score` команди.  
**Response 200:** масив `EvaluationResponse`.

---

### GET `/hackathons/{hackathon_id}/leaderboard`

Публічний лідерборд. Відсортований за `avg_score desc`.

**Query params:** `page`, `limit`

**Response 200:**
```json
{
  "total": 15,
  "entries": [
    {
      "rank": 1,
      "team_id": "uuid",
      "team_name": "Team Alpha",
      "avg_score": 8.42,
      "submission_id": "uuid"
    }
  ]
}
```

---

### POST `/hackathons/{hackathon_id}/ai/query` 🔒 `judge | organizer`

RAG-запит до AI-асистента. Відповідь стримується через SSE.

**Body:**
```json
{
  "question": "Which teams implemented machine learning?",
  "n_results": 5
}
```

**Response:** `text/event-stream` — потоковий текст відповіді.

Приклад читання SSE у JavaScript:
```js
const response = await fetch('/api/v1/hackathons/{id}/ai/query', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ question: 'Which teams used React?' })
});
const reader = response.body.getReader();
const decoder = new TextDecoder();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log(decoder.decode(value));
}
```

---

## Admin

### GET `/admin/users` 🔒 `organizer`

Список усіх користувачів.

**Query params:** `role`, `page`, `limit`

---

### PUT `/admin/users/{user_id}` 🔒 `organizer`

Змінити роль або активність користувача.

**Query params:** `role=mentor`, `is_active=false`

---

### POST `/admin/notifications/broadcast` 🔒 `organizer`

Розіслати сповіщення всім учасникам хакатону.

**Body:**
```json
{
  "hackathon_id": "uuid",
  "title": "Submission deadline in 1 hour!",
  "message": "Make sure to submit your projects before 17:00."
}
```

---

## WebSocket

**URL:** `ws://localhost:8000/ws/{room}?token=<access_token>`

### Кімнати

| Endpoint | Кімната | Події |
|---|---|---|
| `/ws/teams/{team_id}` | `team:{id}` | `kanban:card-created`, `kanban:card-updated`, `discord:channel-created` |
| `/ws/hackathons/{hackathon_id}` | `hackathon:{id}` | `helpdesk:ticket-created`, `leaderboard:updated` |
| `/ws/tickets/{ticket_id}` | `ticket:{id}` | `ticket:assigned`, `ticket:resolved` |
| `/ws/user/{user_id}` | `user:{id}` | `notification:new` |

### Формат повідомлення

```json
{
  "event": "kanban:card-created",
  "payload": { "card_id": "uuid", "title": "New task" },
  "timestamp": "2024-06-01T14:00:00Z"
}
```

**Автентифікація:** токен у query param. Код закриття `4001` — невалідний токен, `4003` — Forbidden.

---

## Коди помилок

| HTTP код | Значення |
|---|---|
| `400` | Validation error |
| `401` | Unauthorized (немає/невалідний токен) |
| `403` | Forbidden (недостатньо прав) |
| `404` | Not found |
| `409` | Conflict (duplicate) |
| `422` | Unprocessable entity (Pydantic validation) |

**Формат помилки:**
```json
{
  "detail": "Email already registered"
}
```
