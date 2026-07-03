-- ============================================================
--  UDSM SOCIAL HUB — Database Migration
--  Run: psql -U postgres -d udsm_hub -f migration.sql
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── USERS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(100) NOT NULL,
  email            VARCHAR(255) NOT NULL UNIQUE,
  password         VARCHAR(255) NOT NULL,
  role             VARCHAR(20)  NOT NULL DEFAULT 'student' CHECK (role IN ('student','teacher','admin')),
  student_id       VARCHAR(20),
  department       VARCHAR(100),
  year_of_study    INTEGER CHECK (year_of_study BETWEEN 1 AND 7),
  avatar_url       TEXT,
  cover_url        TEXT,
  bio              TEXT,
  phone            VARCHAR(20),
  fcm_token        TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  is_verified      BOOLEAN NOT NULL DEFAULT false,
  last_seen        TIMESTAMP,
  followers_count  INTEGER NOT NULL DEFAULT 0,
  following_count  INTEGER NOT NULL DEFAULT 0,
  posts_count      INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email      ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role       ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);

-- ── POSTS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         TEXT NOT NULL CHECK (length(content) <= 2000),
  image_urls      TEXT[] DEFAULT '{}',
  hashtags        TEXT[] DEFAULT '{}',
  likes_count     INTEGER NOT NULL DEFAULT 0,
  comments_count  INTEGER NOT NULL DEFAULT 0,
  shares_count    INTEGER NOT NULL DEFAULT 0,
  visibility      VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','friends','private')),
  is_pinned       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id    ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_hashtags   ON posts USING GIN(hashtags);

-- ── COMMENTS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id    UUID REFERENCES comments(id) ON DELETE CASCADE,
  content      TEXT NOT NULL CHECK (length(content) <= 500),
  likes_count  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);

-- ── LIKES ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS likes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id     UUID REFERENCES posts(id) ON DELETE CASCADE,
  comment_id  UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, post_id)
);

-- ── POLLS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS polls (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question     VARCHAR(500) NOT NULL,
  description  TEXT,
  ends_at      TIMESTAMP,
  total_votes  INTEGER NOT NULL DEFAULT 0,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── POLL OPTIONS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS poll_options (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  label      VARCHAR(200) NOT NULL,
  votes      INTEGER NOT NULL DEFAULT 0,
  "order"    INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── POLL VOTES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS poll_votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id  UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (poll_id, user_id)
);

-- ── MESSAGES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  media_url   TEXT,
  media_type  VARCHAR(20) CHECK (media_type IN ('image','video','file')),
  read_at     TIMESTAMP,
  deleted_at  TIMESTAMP,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at      ON messages(created_at DESC);

-- ── GROUPS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(100) NOT NULL,
  description  TEXT,
  creator_id   UUID NOT NULL REFERENCES users(id),
  avatar_url   TEXT,
  cover_url    TEXT,
  member_count INTEGER NOT NULL DEFAULT 1,
  is_private   BOOLEAN NOT NULL DEFAULT false,
  department   VARCHAR(100),
  category     VARCHAR(50),
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── GROUP MEMBERS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin','moderator','member')),
  joined_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);

-- ── FOLLOWS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS follows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (follower_id, following_id)
);

-- ── NOTIFICATIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type     VARCHAR(50) NOT NULL,
  title    VARCHAR(200),
  body     TEXT,
  ref_id   UUID,
  ref_type VARCHAR(50),
  is_read  BOOLEAN NOT NULL DEFAULT false,
  sent_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);

-- ── COURSES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(200) NOT NULL,
  code           VARCHAR(20)  NOT NULL,
  description    TEXT,
  teacher_id     UUID NOT NULL REFERENCES users(id),
  department     VARCHAR(100),
  year           INTEGER,
  semester       INTEGER,
  students_count INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── ANNOUNCEMENTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(300) NOT NULL,
  content     TEXT NOT NULL,
  author_id   UUID NOT NULL REFERENCES users(id),
  course_id   UUID REFERENCES courses(id),
  group_id    UUID REFERENCES groups(id),
  priority    VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  expires_at  TIMESTAMP,
  views_count INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── REPORTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id),
  ref_id      UUID NOT NULL,
  ref_type    VARCHAR(50),
  reason      VARCHAR(200),
  details     TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','resolved')),
  resolved_by UUID REFERENCES users(id),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ── SEED: Admin user ──────────────────────────────────────────
-- Password: Admin@UDSM2024! (bcrypt hash)
INSERT INTO users (name, email, password, role, department, is_active, is_verified)
VALUES (
  'Admin UDSM',
  'admin@udsm.ac.tz',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBApSSuFQxMj6S',
  'admin',
  'Administration',
  true,
  true
) ON CONFLICT (email) DO NOTHING;

-- ════════════════════════════════════════════════════════════
--  Migration imekamilika! ✅
-- ════════════════════════════════════════════════════════════
