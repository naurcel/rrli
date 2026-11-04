# RouteX: Username Authentication, Account Settings, and Password Recovery Implementation Report

## Executive Summary

RouteX has been upgraded from email-based authentication to a **Username and Password Authentication, Account Settings, and Multi-Tier Password Recovery System**. The implementation preserves RouteX's role-based access control (RBAC), multi-tenant security guarantees, delivery records, and audit log integrity, while ensuring that **Admins and the President can NEVER view, retrieve, or choose users' permanent passwords**.

---

## 1. Authentication Architecture

### 1.1 Identifier and Credential Validation
- **Username as Primary Identifier**: Users log in using their unique username (`@username`) and case-sensitive password.
- **Normalization**: Usernames are trimmed of surrounding whitespace and matched case-insensitively (`ADMIN`, `Admin`, `admin` all resolve to the same account).
- **Password Sensitivity**: Passwords remain strictly case-sensitive.
- **Rate Limiting**: Failed login attempts are throttled by an in-memory sliding-window limiter (5 attempts per 5 minutes per client IP/username), returning HTTP 429 when exceeded.
- **Generic Error Responses**: Failed authentication always returns `Invalid username or password.` without enumerating whether the username exists.
- **Show/Hide Password**: Custom SVG eye toggle control with `-ms-reveal` suppressed for cross-browser consistency.
- **Remember Me**: Configurable session lifetime (12-hour active session vs. 30-day extended session).

### 1.2 Cryptographic Security: RFC 9106 Argon2id
RouteX enforces state-of-the-art password and answer hashing using **Argon2id** (`v=19`, `m=65536` / 64 MiB memory cost, `t=3` iterations, `p=1` parallelism) with cryptographically random 16-byte salts and `crypto.timingSafeEqual` constant-time verification.
- **Zero Plaintext Storage**: Neither passwords nor security answers are stored in plaintext.
- **Zero Plaintext Exposure**: Hashes are strictly isolated in server-only layers and omitted from client payloads (`stripSensitiveFields`).

---

## 2. Password Requirements & Live Policy Enforcement

Passwords must meet reasonable, modern security criteria:
1. **Minimum Length**: 8 characters.
2. **Maximum Length**: 128 characters.
3. **At Least One Letter**: `[a-zA-Z]`.
4. **At Least One Number**: `[0-9]`.
5. **No Whitespace-Only Passwords**: Rejects strings consisting exclusively of whitespace.
6. **Common Passwords Blocklist**: Automatically rejects easily guessed passwords (`password123`, `12345678`, `admin2026`, etc.).
7. **Optional Characteristics**: Special characters and uppercase/lowercase combinations are permitted but optional.

### Reusable Live Checklist (`PasswordCriteriaList`)
A lightweight, reactive UI component (`src/components/password-criteria-list.tsx`) provides immediate visual feedback across:
- Temporary password creation by Admins in User Management.
- Initial account password change.
- Password updates in Account Settings.
- Self-service and Admin-assisted password recovery on the login screen.

---

## 3. Account Lifecycle & First-Login Setup Gate

```
Admin creates account with Temporary Password (mustChangePassword = true)
                                │
                                ▼
         User logs in with Username + Temporary Password
                                │
                                ▼
         WorkspaceShell intercepts (InitialSetupModal)
         Normal application functionality blocked
                                │
                                ▼
         Step 1: Set New Permanent Password (satisfying criteria)
         Step 2: Configure Security Question & Answer (Argon2id)
                                │
                                ▼
         mustChangePassword = false, hasSecurityQuestion = true
                                │
                                ▼
                     Access RouteX Dashboard
```

1. **Account Provisioning**: Admins provision accounts in User Management with a temporary password satisfying the password policy. The system never displays the password after entry.
2. **Setup Enforcement**: Accounts flagged with `mustChangePassword = true` are intercepted by `InitialSetupModal` wrapped in `WorkspaceShell`. Users cannot navigate away or access operational records until they choose a permanent password and configure their security question.
3. **Audit Logging**: Successful completion is recorded in the Audit Log (`user.initial_setup_completed`).

---

## 4. Dual Password Recovery Workflows

### 4.1 Normal Self-Service Recovery (Security Question)
1. **Step 1: Username Entry**: User enters their username on `/login` under "Forgot Password". The system verifies the account exists and retrieves the configured security question without leaking sensitive metadata.
2. **Step 2: Security Question Challenge**: The user is presented with their chosen security question and asked for their answer.
3. **Step 3: Verification**: The answer is trimmed of accidental leading/trailing whitespace, preserved as case-sensitive, and validated against the stored Argon2id hash. Attempt limits (3 attempts / 5 minutes) prevent brute-force attacks.
4. **Step 4: Password Reset**: Upon valid verification, a single-use HMAC token is issued allowing the user to set a new password. The token is immediately consumed, and the event is logged (`user.password_recovered`).

### 4.2 Admin-Assisted Recovery (Forgotten Question & Answer)
When a user forgets both their password and security answer:
1. **Admin Authorization**: An Admin triggers **"Authorize Password Reset"** in User Management.
2. **Confirmation & Scope**: A modal outlines the privacy policy:
   - Generates a **single-use, 24-hour** authorization window.
   - **Admin Privacy Guarantee**: The Admin **never** sees, chooses, or sets the user's new password.
   - The action is logged to the Audit Log (`user.recovery_authorized`).
3. **User Reset Flow**:
   - The user visits `/login` and clicks "Forgot Password".
   - Upon entering their username, RouteX recognizes the active Admin-authorized state.
   - The user is allowed to set a new permanent password directly without answering the security question.
   - The recovery authorization is consumed immediately upon successful reset and expires automatically after 24 hours.

---

## 5. Account Settings & Self-Management (`/settings`)

The revised Settings page organizes user self-service controls:
- **Account Information**: Displays Full Name, Username (`@username`), Email, Role, Access Level, and Security Question status.
- **Change Username**:
  - Requires entering the user's current password for verification.
  - Validates format (3-30 chars, alphanumeric + dots/hyphens/underscores) and case-insensitive uniqueness.
  - Preserves user ID, role, delivery associations, and audit trail.
  - Logged in Audit Log (`user.username_changed`).
- **Change Password**:
  - Requires current password verification.
  - Validates new password with live criteria checklist.
  - Hashes new password with Argon2id.
  - Invalidate previous sessions.
  - Logged in Audit Log (`user.password_changed`).
- **Security Question & Answer**:
  - Requires current password verification.
  - Predefined options or custom question prompt.
  - Case-sensitive answer hashed with Argon2id.
- **System Role & Permissions Reference**: Preserves matrix detailing operational permissions across all 6 RouteX roles.

---

## 6. Admin User Management UI (`/user-management`)

- **Username Column**: Prominently displays `@username` alongside staff names.
- **Setup & Recovery Status Badges**:
  - `Reset Authorized (24h)` (amber badge with countdown/indicator).
  - `Initial Setup Pending` (blue badge for users who haven't completed first-login change).
  - `Setup Complete` (green badge for fully configured users).
- **Inline Actions**:
  - `Authorize Reset`: Launches confirmation dialog for 24-hour assisted recovery.
  - `Edit Username`: Allows Admin to update usernames with format & uniqueness checks.
  - `Deactivate / Reactivate`: Disables or restores staff access.
- **Audit Log Filtering**: Supports filtering by new credential events (`user.created`, `user.username_changed`, `user.password_changed`, `user.password_recovered`, `user.recovery_authorized`).

---

## 7. Database Migration

Migration script `rrliRev/supabase/migrations/20261104010000_username_and_password_recovery.sql`:
- Adds `username`, `normalized_username`, `password_hash`, `must_change_password`, `security_question`, `security_answer_hash`, `recovery_authorized_at`, `recovery_authorized_by`, `recovery_token_hash`, `recovery_expires_at`, and `password_changed_at` to `public.user_profiles`.
- Backfills existing records from email prefixes.
- Enforces `UNIQUE (normalized_username)`.
- Adds check constraints enforcing valid 3-30 character username formats.

---

## 8. Verification & Test Coverage

All 52 tests pass successfully:
- `RFC 9106 Argon2id password and answer hashing`
- `RouteX password criteria validation`
- `Username format and case-insensitive normalization`
- `Case-insensitive username authentication with case-sensitive passwords`
- `Provisioning account with temporary password requires first-login setup`
- `Normal password recovery using security question and answer`
- `Admin-assisted password recovery workflow`
- `Username self-management under Account Settings`
- `Password self-management under Account Settings`
- All 43 pre-existing RBAC, session-guard, environment, and delivery tests.

