-- ============================================================
-- HostelCare — Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ── Enable UUID extension ───────────────────────────────────
create extension if not exists "pgcrypto";

-- ── USERS ───────────────────────────────────────────────────
create table if not exists users (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text not null unique,
  password     text not null,
  role         text not null check (role in ('student', 'warden')),
  hostel_type  text,
  block        text,
  room         text,
  designation  text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ── PASSWORD RESET TOKENS ───────────────────────────────────
create table if not exists password_reset_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  token       text not null,
  expires_at  timestamptz not null,
  used        boolean default false,
  created_at  timestamptz default now(),
  unique(user_id)
);

-- ── COMPLAINTS ──────────────────────────────────────────────
create table if not exists complaints (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references users(id) on delete cascade,
  user_name              text not null,
  description            text not null,
  category               text not null,
  priority               text default 'Low' check (priority in ('Low', 'Medium', 'High')),
  status                 text default 'Submitted' check (status in ('Submitted', 'Assigned', 'In Progress', 'Resolved')),
  block                  text,
  room                   text,
  image                  text,
  assigned_tech_name     text,
  assigned_tech_phone    text,
  assigned_tech_specialty text,
  resolved_at            timestamptz,
  rating                 int check (rating >= 1 and rating <= 5),
  feedback               text,
  status_history         jsonb default '[]'::jsonb,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

-- ── Row Level Security (disable for service-role usage) ─────
-- The backend uses the SERVICE ROLE key which bypasses RLS.
-- Enable RLS only if you also use the anon/user key on frontend.
alter table users                  enable row level security;
alter table password_reset_tokens  enable row level security;
alter table complaints             enable row level security;

-- Allow all operations via service role (backend uses this)
-- No policies needed when using service role key — it bypasses RLS.

-- ── Indexes ─────────────────────────────────────────────────
create index if not exists idx_complaints_user_id   on complaints(user_id);
create index if not exists idx_complaints_status    on complaints(status);
create index if not exists idx_complaints_created   on complaints(created_at desc);
create index if not exists idx_prt_user_id          on password_reset_tokens(user_id);
