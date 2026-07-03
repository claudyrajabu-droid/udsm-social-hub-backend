# UDSM Social Hub — Backend API

## Stack
- Node.js + Express.js
- PostgreSQL (Sequelize ORM)
- Socket.io (Real-time)
- JWT Authentication
- Cloudinary (Images)
- Firebase (Push notifications)

---

## Hatua za Kuanza (Setup)

### 1. Install Node.js
Pakua kutoka: https://nodejs.org (chagua LTS version)

### 2. Install PostgreSQL
Pakua kutoka: https://postgresql.org/download
- Windows: chagua installer
- Mac: `brew install postgresql`

### 3. Tengeneza Database
```bash
psql -U postgres
CREATE DATABASE udsm_hub;
\q
```

### 4. Clone na Install
```bash
cd udsm-social-hub-backend
npm install
```

### 5. Weka .env
```bash
cp .env.example .env
# Fungua .env na badilisha values
```

### 6. Run Migration (Tengeneza Tables)
```bash
psql -U postgres -d udsm_hub -f database/migration.sql
```

### 7. Anzisha Server
```bash
# Development
npm run dev

# Production
npm start
```

Server itafanya kazi kwenye: http://localhost:5000

---

## API Endpoints

### Auth
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /api/auth/register | Signup mpya | ❌ |
| POST | /api/auth/login | Login | ❌ |
| POST | /api/auth/refresh | Refresh token | ❌ |
| GET  | /api/auth/me | Profile yangu | ✅ |
| POST | /api/auth/change-password | Badilisha password | ✅ |

### Posts
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET  | /api/posts | Feed ya posts | ✅ |
| POST | /api/posts | Unda post | ✅ |
| GET  | /api/posts/:id | Post moja | ✅ |
| PUT  | /api/posts/:id | Hariri post | ✅ |
| DELETE | /api/posts/:id | Futa post | ✅ |
| POST | /api/posts/:id/like | Toggle like | ✅ |
| GET  | /api/posts/:id/comments | Maoni | ✅ |
| POST | /api/posts/:id/comments | Ongeza maoni | ✅ |
| GET  | /api/posts/search?q= | Tafuta posts | ✅ |

### Polls
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET  | /api/polls | Polls zote | ✅ |
| POST | /api/polls | Unda poll | ✅ |
| GET  | /api/polls/:id | Poll moja | ✅ |
| POST | /api/polls/:id/vote | Piga kura | ✅ |
| DELETE | /api/polls/:id | Futa poll | ✅ |
| PATCH | /api/polls/:id/close | Funga poll | ✅ |

### Messages
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET  | /api/messages/conversations | Mazungumzo | ✅ |
| GET  | /api/messages/:userId | History | ✅ |
| POST | /api/messages | Tuma ujumbe | ✅ |
| DELETE | /api/messages/:id | Futa ujumbe | ✅ |

### Users
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET  | /api/users/search?q= | Tafuta | ✅ |
| GET  | /api/users/:id | Profile | ✅ |
| PUT  | /api/users/:id | Sasisha profile | ✅ |
| POST | /api/users/:id/follow | Follow/Unfollow | ✅ |
| GET  | /api/users/:id/followers | Wafuatao | ✅ |

### Groups
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET  | /api/groups | Vikundi | ✅ |
| POST | /api/groups | Unda kikundi | ✅ |
| POST | /api/groups/:id/join | Jiunga | ✅ |
| DELETE | /api/groups/:id/leave | Toka | ✅ |

### Admin (Admin tu)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | /api/admin/stats | Dashboard stats |
| GET  | /api/admin/users | Watumiaji wote |
| PUT  | /api/admin/users/:id | Hariri mtumiaji |
| DELETE | /api/admin/users/:id | Futa mtumiaji |
| GET  | /api/admin/reports | Ripoti |
| PUT  | /api/admin/reports/:id | Resolve ripoti |
| DELETE | /api/admin/posts/:id | Futa post yoyote |
| POST | /api/admin/announcements | Tuma tangazo |

### Other
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET  | /api/search?q= | Global search | ✅ |
| GET  | /api/notifications | Arifa zangu | ✅ |
| PUT  | /api/notifications/read-all | Soma zote | ✅ |
| POST | /api/upload/image | Pakia picha | ✅ |
| GET  | /health | Server status | ❌ |

---

## Socket.io Events

### Client → Server
- `user:join` — Sajili online
- `message:send` — Tuma ujumbe
- `typing:start` / `typing:stop` — Typing indicator
- `messages:read` — Mark as read
- `group:join` / `group:message` — Group chat

### Server → Client
- `message:receive` — Ujumbe mpya
- `notification:receive` — Arifa mpya
- `users:online` — Watu waliopo online
- `user:online` / `user:offline` — Status changes
- `typing:start` / `typing:stop` — Mtu anaandika

---

## Deploy (Kuweka Online)

### Railway (Recommended)
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Environment Variables za Production
Weka hizi kwenye Railway/Render:
- DATABASE_URL
- JWT_SECRET
- JWT_REFRESH_SECRET
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET
- FRONTEND_URL
- NODE_ENV=production

---

## Admin ya Default
- Email: admin@udsm.ac.tz
- Password: Admin@UDSM2024!

**Badilisha password mara baada ya login ya kwanza!**
