-- ============================================================================
-- Migration: 20261104010000_username_and_password_recovery.sql
-- RouteX: Username Authentication, Account Settings, and Password Recovery
--
-- Objective:
-- Support username-based authentication, user account credential self-management,
-- Argon2id password and security-question answer hashing, initial password
-- change enforcement, and Admin-assisted 24-hour single-use recovery.
--
-- Security Guarantees:
-- 1. Passwords and security answers are NEVER stored in plaintext.
-- 2. Passwords and security answers are hashed using RFC 9106 Argon2id.
-- 3. Admins and Presidents cannot view, retrieve, or choose users' permanent passwords.
-- 4. Usernames are unique, case-insensitive, and validated on the server.
-- 5. Admin recovery authorization is single-use, time-limited (24 hours), and logged.
-- ============================================================================

-- 1. Add username, setup status, security question, and recovery columns
alter table public.user_profiles
  add column if not exists username text,
  add column if not exists normalized_username text,
  add column if not exists password_hash text,
  add column if not exists must_change_password boolean not null default false,
  add column if not exists security_question text,
  add column if not exists security_answer_hash text,
  add column if not exists recovery_authorized_at timestamptz,
  add column if not exists recovery_authorized_by text,
  add column if not exists recovery_token_hash text,
  add column if not exists recovery_expires_at timestamptz,
  add column if not exists password_changed_at timestamptz;

-- 2. Populate usernames for existing records from email if currently null
update public.user_profiles
set
  username = coalesce(username, split_part(email, '@', 1)),
  normalized_username = coalesce(normalized_username, lower(split_part(email, '@', 1)))
where username is null or normalized_username is null;

-- Ensure username and normalized_username are non-null
alter table public.user_profiles
  alter column username set not null,
  alter column normalized_username set not null;

-- 3. Add case-insensitive unique index on normalized_username
create unique index if not exists uq_user_profiles_normalized_username
  on public.user_profiles (normalized_username);

-- 4. Add format check constraint for usernames (3-30 chars, alphanumeric + . - _)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_user_profiles_username_format'
  ) then
    alter table public.user_profiles
      add constraint chk_user_profiles_username_format
      check (
        length(normalized_username) >= 3
        and length(normalized_username) <= 30
        and normalized_username ~ '^[a-z0-9][a-z0-9_.-]*[a-z0-9]$'
      );
  end if;
end $$;

-- 5. Documentation comments on columns
comment on column public.user_profiles.username is
  'User-facing login handle. Displayed with @ prefix. Case-preserving.';

comment on column public.user_profiles.normalized_username is
  'Lowercased, trimmed username used for case-insensitive unique authentication.';

comment on column public.user_profiles.password_hash is
  'Argon2id password hash for RouteX-managed credentials. Plaintext is never stored.';

comment on column public.user_profiles.must_change_password is
  'Flag indicating the user must change their temporary password and setup security question before normal access is granted.';

comment on column public.user_profiles.security_question is
  'Configured security question prompt chosen or provided by the user for self-service recovery.';

comment on column public.user_profiles.security_answer_hash is
  'Argon2id hash of the case-sensitive, whitespace-trimmed security answer. Plaintext is never stored or displayed.';

comment on column public.user_profiles.recovery_authorized_at is
  'Timestamp when an Admin or President authorized single-use recovery for this account.';

comment on column public.user_profiles.recovery_authorized_by is
  'Username of the Admin who authorized password recovery.';

comment on column public.user_profiles.recovery_token_hash is
  'Cryptographic hash of the single-use recovery authorization token.';

comment on column public.user_profiles.recovery_expires_at is
  'Expiration timestamp (24 hours from authorization) for Admin-assisted recovery.';

