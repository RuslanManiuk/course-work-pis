# Сценарії демонстрації (Defense Script)

Покроковий сценарій для демонстрації "wow-ефекту" комісії.  
Час демо: ~10 хвилин.

---

## Підготовка (за 15 хвилин до захисту)

```bash
cd hackflow

# 1. Переконатися що .env налаштований (Discord + Gemini для wow-ефекту)
cat .env | grep -E "DISCORD_BOT_TOKEN|GEMINI_API_KEY"

# 2. Запустити стек
docker compose up -d

# 3. Дочекатися повної готовності (~2 хвилини)
docker compose ps
# Всі сервіси мають бути Up/healthy

# 4. Відкрити у браузері
# - http://localhost:5173  (frontend)
# - http://localhost:8000/api/docs  (API docs - для показу)
# - Discord сервер хакатону (для wow-ефекту)
```

---

## Сценарій 1: Реєстрація та профіль

**Час: ~1 хвилина**

1. Відкрити http://localhost:5173/auth/register
2. Зареєструвати першого юзера:
   - Email: `hacker1@demo.com`
   - Username: `hacker_one`  
   - Password: `demopass123`
   - Role: `hacker`
3. Після входу → Dashboard
4. Зайти в Profile → заповнити Skills: `Python`, `React`, `Machine Learning`

```bash
# Або через API (показати комісії як виглядає REST):
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"hacker1@demo.com","username":"hacker_one","password":"demopass123","role":"hacker"}'
```

5. Зареєструвати другого юзера:
   - Email: `hacker2@demo.com`, Username: `hacker_two`, Role: `hacker`

---

## Сценарій 2: Організатор створює хакатон

**Час: ~1 хвилина**

1. Зареєструвати/залогінитись як організатор:
   - Email: `organizer@demo.com`, Role: `organizer`

2. Через API Docs (http://localhost:8000/api/docs) або curl:

```bash
# Отримати токен організатора
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"organizer@demo.com","password":"demopass123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Створити хакатон
curl -X POST http://localhost:8000/api/v1/hackathons \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "AI Innovation Hackathon 2024",
    "description": "48-hour hackathon focused on AI/ML solutions for real-world problems",
    "start_date": "2024-06-01T09:00:00Z",
    "end_date": "2024-06-02T18:00:00Z",
    "submission_deadline": "2024-06-02T17:00:00Z",
    "registration_deadline": "2024-05-31T23:59:00Z",
    "max_team_size": 5,
    "min_team_size": 2
  }'
```

Скопіювати `hackathon_id` з відповіді.

---

## Сценарій 3: Командоутворення + Discord WOW-ефект ⭐

**Час: ~2 хвилини**

1. Залогінитись як `hacker1`
2. Створити команду:

```bash
# Токен hacker1
TOKEN1=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hacker1@demo.com","password":"demopass123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -X POST http://localhost:8000/api/v1/teams \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{
    "hackathon_id": "<HACKATHON_ID>",
    "name": "Team Alpha",
    "description": "Building an ML-powered solution"
  }'
```

3. **ПЕРЕКЛЮЧИТИСЬ НА DISCORD** → показати комісії, що автоматично з'явились два канали:
   - `#team-alpha-text`
   - `🔊 team-alpha-voice`

4. Приєднати `hacker2` до команди:
   - Скопіювати `invite_token` з відповіді
   
```bash
TOKEN2=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hacker2@demo.com","password":"demopass123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -X POST http://localhost:8000/api/v1/teams/<TEAM_ID>/join \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d '{"invite_token": "<INVITE_TOKEN>"}'
```

---

## Сценарій 4: Workspace — Kanban + Submit

**Час: ~1 хвилина**

1. Відкрити http://localhost:5173 → знайти workspace команди
2. Створити картки на Kanban:
   - "Design architecture" (Todo)
   - "Implement ML model" (In Progress)
   - "Write tests" (Done)
3. Подати фінальний проєкт:

```bash
curl -X POST http://localhost:8000/api/v1/teams/<TEAM_ID>/submissions \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{
    "hackathon_id": "<HACKATHON_ID>",
    "repository_url": "https://github.com/team-alpha/ai-solution",
    "video_pitch_url": "https://youtube.com/watch?v=demo",
    "presentation_url": "https://docs.google.com/presentation/d/demo",
    "description": "We built an ML-powered recommendation system using Python, scikit-learn and FastAPI. The system analyzes user behavior to provide personalized recommendations with 94% accuracy."
  }'
```

---

## Сценарій 5: HelpDesk → Jitsi відеодзвінок

**Час: ~1 хвилина**

1. Команда створює тікет:

```bash
curl -X POST http://localhost:8000/api/v1/helpdesk/tickets \
  -H "Authorization: Bearer $TOKEN1" \
  -H "Content-Type: application/json" \
  -d '{
    "hackathon_id": "<HACKATHON_ID>",
    "team_id": "<TEAM_ID>",
    "title": "Overfitting in our ML model",
    "description": "Our model shows 99% train accuracy but only 60% on test data",
    "priority": "high"
  }'
```

2. Залогінитись як ментор і взяти тікет:

```bash
TOKEN_MENTOR=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"mentor@demo.com","password":"demopass123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -X POST http://localhost:8000/api/v1/helpdesk/tickets/<TICKET_ID>/assign \
  -H "Authorization: Bearer $TOKEN_MENTOR"
```

3. Показати `jitsi_room_url` у відповіді → клікнути → **відкриється відеокімната Jitsi Meet**

---

## Сценарій 6: AI-асистент журі ⭐ (потрібен GEMINI_API_KEY)

**Час: ~2 хвилини**

1. Зареєструвати судью: `judge@demo.com`, role: `judge`
2. Відкрити Judging page у frontend
3. Або через API:

```bash
TOKEN_JUDGE=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"judge@demo.com","password":"demopass123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Запитати AI
curl -X POST http://localhost:8000/api/v1/hackathons/<HACKATHON_ID>/ai/query \
  -H "Authorization: Bearer $TOKEN_JUDGE" \
  -H "Content-Type: application/json" \
  -d '{"question": "Which teams implemented machine learning in their project?"}'
```

4. **Показати стримінгову відповідь** — AI знаходить Team Alpha і описує їхнє ML рішення з description сабміту

---

## Сценарій 7: Оцінювання + Лідерборд

**Час: ~1 хвилина**

1. Спочатку додати критерії (від організатора):

```bash
curl -X POST http://localhost:8000/api/v1/hackathons/<HACKATHON_ID>/criteria \
  -H "Authorization: Bearer $TOKEN_ORG" \
  -H "Content-Type: application/json" \
  -d '{
    "criteria": [
      {"name": "Innovation", "weight": 3, "order": 1},
      {"name": "Technical Complexity", "weight": 4, "order": 2},
      {"name": "Presentation", "weight": 3, "order": 3}
    ]
  }'
```

2. Суддя оцінює проєкт:

```bash
curl -X POST http://localhost:8000/api/v1/submissions/<SUBMISSION_ID>/evaluate \
  -H "Authorization: Bearer $TOKEN_JUDGE" \
  -H "Content-Type: application/json" \
  -d '{
    "evaluations": [
      {"criteria_id": "<CRITERIA_1_ID>", "score": 9, "feedback": "Very innovative approach"},
      {"criteria_id": "<CRITERIA_2_ID>", "score": 8, "feedback": "Well implemented"},
      {"criteria_id": "<CRITERIA_3_ID>", "score": 7, "feedback": "Good pitch"}
    ]
  }'
```

3. Показати лідерборд:

```bash
curl http://localhost:8000/api/v1/hackathons/<HACKATHON_ID>/leaderboard
```

---

## Корисні команди для демо

```bash
# Швидко зупинити і почати з нуля (очистити всі дані)
docker compose down -v && docker compose up -d

# Дивитися логи в реальному часі
docker compose logs -f backend

# Перевірити поточний стан команди в БД
docker compose exec postgres psql -U hackflow -c \
  "SELECT t.name, t.discord_text_channel_id, di.sync_status 
   FROM teams t JOIN discord_integrations di ON t.id = di.team_id;"
```
