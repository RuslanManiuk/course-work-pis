# Database Schema

## Огляд таблиць

### `users`

| Колонка | Тип | Опис |
|---|---|---|
| `id` | UUID PK | Унікальний ідентифікатор |
| `email` | VARCHAR(254) UNIQUE | Email (логін) |
| `username` | VARCHAR(64) UNIQUE | Нік |
| `password_hash` | VARCHAR(128) NULL | bcrypt. NULL для GitHub-юзерів |
| `role` | ENUM | `hacker`, `mentor`, `judge`, `organizer` |
| `github_id` | VARCHAR(32) UNIQUE NULL | GitHub user ID |
| `github_username` | VARCHAR(64) NULL | GitHub login |
| `avatar_url` | TEXT NULL | Аватар (GitHub) |
| `is_active` | BOOLEAN | Активний акаунт |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

---

### `user_profiles`

| Колонка | Тип | Опис |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | 1:1, CASCADE DELETE |
| `bio` | TEXT NULL | Опис |
| `skills` | JSONB | `[{"name": "Python", "proficiency": "advanced"}]` |
| `tech_stack` | JSONB | `[{"tech": "FastAPI", "years": 2}]` |
| `years_experience` | INTEGER | |
| `mentoring_expertise` | JSONB NULL | Для менторів |

---

### `hackathons`

| Колонка | Тип | Опис |
|---|---|---|
| `id` | UUID PK | |
| `organizer_id` | UUID FK → users | |
| `title` | VARCHAR(255) | |
| `description` | TEXT | |
| `status` | ENUM | `draft`, `upcoming`, `active`, `completed`, `cancelled` |
| `start_date` | TIMESTAMPTZ | |
| `end_date` | TIMESTAMPTZ | |
| `submission_deadline` | TIMESTAMPTZ | |
| `registration_deadline` | TIMESTAMPTZ | |
| `max_team_size` | INTEGER | |
| `min_team_size` | INTEGER | |
| `max_participants` | INTEGER NULL | |
| `discord_server_id` | VARCHAR(64) NULL | |
| `banner_url` | TEXT NULL | |
| `tags` | JSONB | `["AI", "Healthcare"]` |

---

### `evaluation_criteria`

| Колонка | Тип | Опис |
|---|---|---|
| `id` | UUID PK | |
| `hackathon_id` | UUID FK → hackathons | CASCADE DELETE |
| `name` | VARCHAR(128) | "Innovation", "Technical Complexity" |
| `description` | TEXT NULL | |
| `weight` | INTEGER | Вага критерію (для зваженого score) |
| `order` | INTEGER | Порядок відображення |

---

### `teams`

| Колонка | Тип | Опис |
|---|---|---|
| `id` | UUID PK | |
| `hackathon_id` | UUID FK → hackathons | CASCADE DELETE |
| `name` | VARCHAR(128) | |
| `description` | TEXT NULL | |
| `leader_id` | UUID FK → users | |
| `status` | ENUM | `forming`, `active`, `submitted`, `eliminated`, `won` |
| `size` | INTEGER | Поточна кількість членів |
| `avg_score` | FLOAT NULL | Обчислюється при оцінюванні |
| `invite_token` | VARCHAR(64) UNIQUE NULL | URL-safe токен для запрошення |
| `invite_token_expires_at` | TIMESTAMPTZ NULL | TTL 72 год |
| `discord_text_channel_id` | VARCHAR(32) NULL | ID каналу Discord |
| `discord_voice_channel_id` | VARCHAR(32) NULL | ID голосового каналу Discord |

---

### `team_members`

| Колонка | Тип | Опис |
|---|---|---|
| `id` | UUID PK | |
| `team_id` | UUID FK → teams | CASCADE DELETE |
| `user_id` | UUID FK → users | |
| `role` | ENUM | `leader`, `member` |
| `joined_at` | TIMESTAMPTZ | |

Унікальний constraint: `(team_id, user_id)`

---

### `kanban_cards`

| Колонка | Тип | Опис |
|---|---|---|
| `id` | UUID PK | |
| `team_id` | UUID FK → teams | CASCADE DELETE |
| `created_by_id` | UUID FK → users | |
| `assignee_id` | UUID FK → users NULL | |
| `title` | VARCHAR(256) | |
| `description` | TEXT NULL | |
| `status` | ENUM | `todo`, `in_progress`, `done` |
| `order` | INTEGER | Порядок у колонці |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

---

### `submissions`

| Колонка | Тип | Опис |
|---|---|---|
| `id` | UUID PK | |
| `team_id` | UUID FK → teams | CASCADE DELETE |
| `hackathon_id` | UUID FK → hackathons | CASCADE DELETE |
| `repository_url` | VARCHAR(512) | GitHub repo URL |
| `video_pitch_url` | VARCHAR(512) NULL | YouTube/Loom |
| `presentation_url` | VARCHAR(512) NULL | Google Slides / Figma |
| `description` | TEXT | Опис рішення |
| `status` | ENUM | `draft`, `submitted`, `under_review`, `scored` |
| `embedding_indexed` | BOOLEAN | Чи проіндексовано у ChromaDB |
| `submitted_at` | TIMESTAMPTZ NULL | Час фінального submit |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

Унікальний constraint: `(team_id, hackathon_id)` — одна команда = один submit.

---

### `evaluations`

| Колонка | Тип | Опис |
|---|---|---|
| `id` | UUID PK | |
| `submission_id` | UUID FK → submissions | CASCADE DELETE |
| `judge_id` | UUID FK → users | |
| `criteria_id` | UUID FK → evaluation_criteria | |
| `score` | INTEGER | 1–10 |
| `feedback` | TEXT NULL | Коментар судді |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

Унікальний constraint: `(submission_id, judge_id, criteria_id)` — кожен суддя оцінює кожен критерій один раз.

---

### `helpdesk_tickets`

| Колонка | Тип | Опис |
|---|---|---|
| `id` | UUID PK | |
| `hackathon_id` | UUID FK → hackathons | |
| `team_id` | UUID FK → teams NULL | |
| `created_by_id` | UUID FK → users | Автор тікету |
| `assigned_mentor_id` | UUID FK → users NULL | Ментор |
| `title` | VARCHAR(256) | |
| `description` | TEXT | |
| `priority` | ENUM | `low`, `medium`, `high` |
| `status` | ENUM | `open`, `assigned`, `in_progress`, `resolved`, `closed` |
| `jitsi_room_url` | VARCHAR(512) NULL | Генерується при assign |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

---

### `discord_integrations`

| Колонка | Тип | Опис |
|---|---|---|
| `id` | UUID PK | |
| `team_id` | UUID FK → teams UNIQUE | |
| `discord_guild_id` | VARCHAR(32) | |
| `text_channel_id` | VARCHAR(32) NULL | |
| `voice_channel_id` | VARCHAR(32) NULL | |
| `sync_status` | ENUM | `pending`, `synced`, `failed` |
| `error_message` | TEXT NULL | Помилка якщо failed |
| `last_sync` | TIMESTAMPTZ NULL | |

---

### `notifications`

| Колонка | Тип | Опис |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → users | Одержувач |
| `type` | ENUM | `team_invite`, `mentor_assigned`, `score_update`, `event_reminder`, `submission_accepted`, `broadcast` |
| `title` | VARCHAR(256) | |
| `message` | TEXT | |
| `is_read` | BOOLEAN | |
| `priority` | ENUM | `low`, `normal`, `high` |
| `created_at` | TIMESTAMPTZ | |

---

### `github_stats`

| Колонка | Тип | Опис |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → users UNIQUE | |
| `repositories` | INTEGER | |
| `followers` | INTEGER | |
| `total_contributions` | INTEGER | |
| `language_breakdown` | JSONB | `[{"language": "Python", "percentage": 60.5}]` |
| `cached_at` | TIMESTAMPTZ | Час кешування (TTL 24 год) |

---

## ChromaDB колекції

ChromaDB зберігає окрему колекцію для кожного хакатону:

**Назва колекції:** `hackathon_{hackathon_id з дефісами заміненими на _}`

**Документи:** текстове представлення submission:
```
Team: Team Alpha
Description: We built an ML-powered recommendation system...
Repository: https://github.com/team-alpha/ai-solution
Skills: Python, scikit-learn, FastAPI
```

**Метадані:**
```json
{
  "submission_id": "uuid",
  "team_name": "Team Alpha",
  "hackathon_id": "uuid"
}
```

**Embedding:** 768-dimensional vector (text-embedding-004 від Google Gemini).  
**Similarity:** cosine distance (hnsw:space=cosine).

---

## Alembic міграції

```bash
# Переглянути поточну версію
alembic current

# Накатити всі міграції
alembic upgrade head

# Відкатити на крок назад
alembic downgrade -1

# Створити нову міграцію (після зміни моделей)
alembic revision --autogenerate -m "add new field"
```

Файл конфігурації: `backend/alembic.ini`  
Міграції: `backend/app/db/migrations/versions/`
