# Deployment Guide

## Варіант 1: Docker Compose (production-like)

Цей варіант підходить для демонстрації та staging. Усі сервіси запускаються в контейнерах.

### Кроки

```bash
# 1. Клонувати репозиторій
git clone <repo-url>
cd hackflow

# 2. Налаштувати змінні
cp .env.example .env
# Відредагувати .env (обов'язково: JWT_SECRET)

# 3. Згенерувати безпечний JWT secret
openssl rand -hex 32
# Скопіювати результат у .env: JWT_SECRET=<результат>

# 4. Запустити (з білдом)
docker compose up --build -d

# 5. Перевірити статус
docker compose ps
docker compose logs backend --tail=50
```

### Перевірка після запуску

```bash
# Backend health
curl http://localhost:8000/api/v1/  
# {"detail": "Not Found"} — нормально, ендпоінт не існує але backend відповідає

# API docs
open http://localhost:8000/api/docs

# Frontend
open http://localhost:5173

# ChromaDB
curl http://localhost:8001/api/v1/heartbeat
```

### Перезапуск після зміни коду

```bash
# Backend (з hot-reload через volume mount — зміни підхоплюються автоматично)
# Якщо треба повний rebuild:
docker compose up --build backend -d

# Frontend (теж hot-reload через volume mount)
docker compose up --build frontend -d
```

### Перегляд логів

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
```

---

## Варіант 2: Production на VPS (nginx + SSL)

### Передумови

- Ubuntu 22.04 VPS
- Docker + Docker Compose встановлені
- Домен з A-записом на IP сервера

### 1. Встановити Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Клонувати та налаштувати

```bash
git clone <repo-url> /opt/hackflow
cd /opt/hackflow

cp .env.example .env
nano .env
```

У `.env` для production змінити:

```dotenv
ENVIRONMENT=production
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://api.yourdomain.com
GITHUB_REDIRECT_URI=https://api.yourdomain.com/api/v1/auth/github/callback
```

### 3. Docker Compose override для production

Створіть файл `docker-compose.prod.yml`:

```yaml
version: "3.9"

services:
  backend:
    command: ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
    volumes: []   # Вимкнути volume mount (не live-reload)
    environment:
      - ENVIRONMENT=production

  frontend:
    build:
      target: builder   # Build stage → static files
    command: []
    # Статичні файли обслуговує nginx

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - ./frontend/dist:/usr/share/nginx/html:ro
    depends_on:
      - backend
```

### 4. Nginx конфігурація (`nginx.conf`)

```nginx
events {}

http {
    upstream backend {
        server backend:8000;
    }

    server {
        listen 80;
        server_name yourdomain.com api.yourdomain.com;
        return 301 https://$host$request_uri;
    }

    # Frontend
    server {
        listen 443 ssl;
        server_name yourdomain.com;

        ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

        root /usr/share/nginx/html;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }
    }

    # Backend API
    server {
        listen 443 ssl;
        server_name api.yourdomain.com;

        ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

        location / {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket
        location /ws/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
        }
    }
}
```

### 5. SSL через Let's Encrypt

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com -d api.yourdomain.com
```

### 6. Запуск production

```bash
cd /opt/hackflow

# Побудувати frontend статику
docker compose -f docker-compose.yml -f docker-compose.prod.yml build frontend

# Запустити все
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 7. Автоновлення SSL

```bash
# Додати в crontab
echo "0 3 * * * certbot renew --quiet && docker compose -C /opt/hackflow restart nginx" | sudo crontab -
```

---

## Резервне копіювання PostgreSQL

```bash
# Backup
docker compose exec postgres pg_dump -U hackflow hackflow > backup_$(date +%Y%m%d).sql

# Restore
cat backup_20240601.sql | docker compose exec -T postgres psql -U hackflow hackflow
```

---

## Оновлення додатку

```bash
cd /opt/hackflow

git pull origin main

# Накатити нові міграції (якщо є)
docker compose exec backend alembic upgrade head

# Перебілдати і перезапустити
docker compose up --build -d
```

---

## Типові проблеми

### Backend не стартує: "Database connection failed"

```bash
# Перевірити, що postgres запущений і healthy
docker compose ps postgres
docker compose logs postgres --tail=20

# Перевірити DATABASE_URL у .env
# Для docker: postgresql+asyncpg://hackflow:hackflow_secret@postgres:5432/hackflow
# Для локального: postgresql+asyncpg://hackflow:hackflow_secret@localhost:5432/hackflow
```

### "alembic: can't connect to database"

```bash
# Запустити міграції вручну (postgres вже запущений)
docker compose exec backend alembic upgrade head
```

### Frontend не підключається до API: CORS error

```bash
# Перевірити FRONTEND_URL у .env
# Має точно співпадати з origin браузера (включаючи порт)
```

### ChromaDB: "Connection refused"

```bash
# Перевірити що CHROMA_HOST і CHROMA_PORT збігаються з docker-compose
# В docker: CHROMA_HOST=chromadb, CHROMA_PORT=8000
# Локально: CHROMA_HOST=localhost, CHROMA_PORT=8001
```

### Discord: канали не створюються

```bash
# Перевірити логи backend
docker compose logs backend | grep -i discord

# Перевірити discord_integrations в БД
docker compose exec postgres psql -U hackflow -c "SELECT * FROM discord_integrations;"
# sync_status='failed' означає помилку; перевірити error_message поле
```
