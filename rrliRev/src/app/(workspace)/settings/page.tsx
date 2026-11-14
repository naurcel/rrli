"use client";

import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";

import { useAuthenticatedActor } from "@/components/auth-context";
import { OperationalTopbar } from "@/components/operational-topbar";
import { PasswordCriteriaList } from "@/components/password-criteria-list";
import { RoundedSelect, type SelectOption } from "@/components/rounded-select";
import {
  getDefaultAvatarUrl,
  getProfileStorageKey,
  getUserInitials,
  PROFILE_PHOTO_EVENT,
  resizeProfilePhotoFile,
} from "@/components/profile-photo";
import {
  evaluatePasswordCriteria,
  PREDEFINED_SECURITY_QUESTIONS,
  validateUsernameFormat,
} from "@/lib/auth/password-policy";
import {
  canImportAndReviewExcel,
  canManageCompanyExpenses,
  canManageDocuments,
  canManageTrucks,
  canManageUsers,
  canMutateDeliveryRecords,
  hasPermission,
  ROLE_METADATA,
  USER_ROLES,
  type UserRole,
} from "@/lib/auth/rbac";

const SECURITY_QUESTION_OPTIONS: readonly SelectOption[] = [
  ...PREDEFINED_SECURITY_QUESTIONS.map((q) => ({
    value: q,
    label: q,
  })),
  {
    value: "custom",
    label: "Enter custom question…",
  },
];

export default function SettingsPage() {
  const actor = useAuthenticatedActor();
  const [currentUsername, setCurrentUsername] = useState(actor.username);
  const [currentEmail, setCurrentEmail] = useState(actor.email);
  const [currentPhone, setCurrentPhone] = useState(actor.phoneNumber ?? "+63 917 123 4567");

  // Profile Photo state
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(() => {
    return actor.avatarUrl ?? getDefaultAvatarUrl(actor.username);
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoFeedback, setPhotoFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // Change Contact Details form (Email & Phone Number)
  const [contactEmail, setContactEmail] = useState(actor.email);
  const [contactPhone, setContactPhone] = useState(actor.phoneNumber ?? "+63 917 123 4567");
  const [contactPassword, setContactPassword] = useState("");
  const [contactFeedback, setContactFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [contactSubmitting, setContactSubmitting] = useState(false);

  // Change Username form
  const [newUsername, setNewUsername] = useState("");
  const [usernamePassword, setUsernamePassword] = useState("");
  const [usernameFeedback, setUsernameFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [usernameSubmitting, setUsernameSubmitting] = useState(false);

  // Change Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordFeedback, setPasswordFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  // Security Question form
  const [currentQuestion, setCurrentQuestion] = useState<string>("Not yet configured");
  const [selectedQuestion, setSelectedQuestion] = useState<string>(PREDEFINED_SECURITY_QUESTIONS[0]);
  const [isCustomQuestion, setIsCustomQuestion] = useState(false);
  const [customQuestionText, setCustomQuestionText] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [confirmSecurityAnswer, setConfirmSecurityAnswer] = useState("");
  const [securityPassword, setSecurityPassword] = useState("");
  const [securityFeedback, setSecurityFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [securitySubmitting, setSecuritySubmitting] = useState(false);

  // Load fresh user data on mount & sync local storage photo
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(getProfileStorageKey(actor.id));
      if (stored) {
        setCurrentAvatar(stored);
      }
    } catch {
      // Ignore storage restrictions
    }

    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok && data.actor) {
          if (data.actor.username) setCurrentUsername(data.actor.username);
          if (data.actor.email) {
            setCurrentEmail(data.actor.email);
            setContactEmail(data.actor.email);
          }
          if (data.actor.phoneNumber) {
            setCurrentPhone(data.actor.phoneNumber);
            setContactPhone(data.actor.phoneNumber);
          }
          if (data.actor.securityQuestion) setCurrentQuestion(data.actor.securityQuestion);
          if (data.actor.avatarUrl) {
            setCurrentAvatar(data.actor.avatarUrl);
            try {
              window.localStorage.setItem(getProfileStorageKey(actor.id), data.actor.avatarUrl);
            } catch {
              // Ignore
            }
          }
        }
      })
      .catch(() => {});
  }, [actor.id]);

  // Handle Profile Photo Upload / Replace
  async function handlePhotoSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoFeedback(null);
    setPhotoUploading(true);

    try {
      const dataUrl = await resizeProfilePhotoFile(file, 320);
      setPreviewUrl(dataUrl);

      const res = await fetch("/api/auth/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-profile-photo",
          avatarUrl: dataUrl,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message ?? "Unable to save profile photo.");
      }

      setCurrentAvatar(dataUrl);
      setPreviewUrl(null);
      try {
        window.localStorage.setItem(getProfileStorageKey(actor.id), dataUrl);
      } catch {
        // Ignore
      }

      window.dispatchEvent(
        new CustomEvent(PROFILE_PHOTO_EVENT, {
          detail: { avatarUrl: dataUrl, userId: actor.id },
        }),
      );

      setPhotoFeedback({ tone: "success", text: "Profile picture updated successfully." });
    } catch (err) {
      setPreviewUrl(null);
      setPhotoFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Error processing photo.",
      });
    } finally {
      setPhotoUploading(false);
      // Reset input
      e.target.value = "";
    }
  }

  // Handle Profile Photo Removal
  async function handleRemovePhoto() {
    setPhotoFeedback(null);
    setPhotoUploading(true);

    try {
      const res = await fetch("/api/auth/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-profile-photo",
          avatarUrl: null,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message ?? "Unable to remove profile photo.");
      }

      const defaultAvatar = getDefaultAvatarUrl(actor.username);
      setCurrentAvatar(defaultAvatar);
      setPreviewUrl(null);
      try {
        window.localStorage.removeItem(getProfileStorageKey(actor.id));
      } catch {
        // Ignore
      }

      window.dispatchEvent(
        new CustomEvent(PROFILE_PHOTO_EVENT, {
          detail: { avatarUrl: null, userId: actor.id },
        }),
      );

      setPhotoFeedback({ tone: "success", text: "Profile picture removed." });
    } catch (err) {
      setPhotoFeedback({
        tone: "error",
        text: err instanceof Error ? err.message : "Error removing photo.",
      });
    } finally {
      setPhotoUploading(false);
    }
  }

  // Handle Change Username
  async function handleUsernameSubmit(e: FormEvent) {
    e.preventDefault();
    setUsernameFeedback(null);

    const check = validateUsernameFormat(newUsername);
    if (!check.isValid) {
      setUsernameFeedback({ tone: "error", text: check.message || "Invalid username format." });
      return;
    }

    if (!usernamePassword) {
      setUsernameFeedback({ tone: "error", text: "Enter your current password to confirm username change." });
      return;
    }

    setUsernameSubmitting(true);
    try {
      const res = await fetch("/api/auth/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change-username",
          newUsername: newUsername.trim(),
          currentPassword: usernamePassword,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message ?? "Failed to update username.");
      }

      setCurrentUsername(data.profile?.username || newUsername.trim());
      setNewUsername("");
      setUsernamePassword("");
      setUsernameFeedback({ tone: "success", text: data.message ?? "Username updated successfully." });
    } catch (err) {
      setUsernameFeedback({ tone: "error", text: err instanceof Error ? err.message : "Error updating username." });
    } finally {
      setUsernameSubmitting(false);
    }
  }

  // Handle Update Contact Details (Email & Phone Number)
  async function handleContactSubmit(e: FormEvent) {
    e.preventDefault();
    setContactFeedback(null);

    const cleanEmail = contactEmail.trim().toLowerCase();
    const cleanPhone = contactPhone.trim();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setContactFeedback({ tone: "error", text: "Please enter a valid email address." });
      return;
    }

    if (!cleanPhone || cleanPhone.length < 7) {
      setContactFeedback({ tone: "error", text: "Please enter a valid phone number (min 7 digits)." });
      return;
    }

    if (!contactPassword) {
      setContactFeedback({ tone: "error", text: "Enter your current password to confirm contact changes." });
      return;
    }

    setContactSubmitting(true);
    try {
      const res = await fetch("/api/auth/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-contact",
          email: cleanEmail,
          phoneNumber: cleanPhone,
          currentPassword: contactPassword,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message ?? "Failed to update contact details.");
      }

      setCurrentEmail(data.profile?.email ?? cleanEmail);
      if (data.profile?.phoneNumber) {
        setCurrentPhone(data.profile.phoneNumber);
      }
      setContactPassword("");
      setContactFeedback({ tone: "success", text: data.message ?? "Contact information updated successfully." });
    } catch (err) {
      setContactFeedback({ tone: "error", text: err instanceof Error ? err.message : "Error updating contact details." });
    } finally {
      setContactSubmitting(false);
    }
  }

  // Handle Change Password
  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordFeedback(null);

    const criteria = evaluatePasswordCriteria(newPassword);
    if (!criteria.isValid) {
      setPasswordFeedback({ tone: "error", text: criteria.errors[0] || "Password does not meet criteria." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ tone: "error", text: "New passwords do not match." });
      return;
    }

    if (!currentPassword) {
      setPasswordFeedback({ tone: "error", text: "Enter your current password." });
      return;
    }

    setPasswordSubmitting(true);
    try {
      const res = await fetch("/api/auth/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change-password",
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message ?? "Failed to update password.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordFeedback({ tone: "success", text: "Password changed successfully." });
    } catch (err) {
      setPasswordFeedback({ tone: "error", text: err instanceof Error ? err.message : "Error updating password." });
    } finally {
      setPasswordSubmitting(false);
    }
  }

  // Handle Change Security Question
  async function handleSecurityQuestionSubmit(e: FormEvent) {
    e.preventDefault();
    setSecurityFeedback(null);

    const finalQuestion = isCustomQuestion ? customQuestionText.trim() : selectedQuestion;
    if (!finalQuestion) {
      setSecurityFeedback({ tone: "error", text: "Select or enter a security question." });
      return;
    }

    if (!securityAnswer.trim() || securityAnswer.trim().length < 2) {
      setSecurityFeedback({ tone: "error", text: "Security answer must be at least 2 characters long." });
      return;
    }

    if (securityAnswer.trim() !== confirmSecurityAnswer.trim()) {
      setSecurityFeedback({ tone: "error", text: "Security answers do not match." });
      return;
    }

    if (!securityPassword) {
      setSecurityFeedback({ tone: "error", text: "Enter your current password to save security question." });
      return;
    }

    setSecuritySubmitting(true);
    try {
      const res = await fetch("/api/auth/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change-security-question",
          question: finalQuestion,
          answer: securityAnswer.trim(),
          confirmAnswer: confirmSecurityAnswer.trim(),
          currentPassword: securityPassword,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.message ?? "Failed to update security question.");
      }

      setCurrentQuestion(finalQuestion);
      setSecurityAnswer("");
      setConfirmSecurityAnswer("");
      setSecurityPassword("");
      setSecurityFeedback({ tone: "success", text: "Security question and answer saved." });
    } catch (err) {
      setSecurityFeedback({ tone: "error", text: err instanceof Error ? err.message : "Error updating security question." });
    } finally {
      setSecuritySubmitting(false);
    }
  }

  const activeAvatar = previewUrl || currentAvatar;
  const initials = getUserInitials(actor.fullName, actor.username);
  const cleanFullName = actor.fullName.replace(/\s*\([^)]*\)/g, "").trim() || actor.fullName;

  return (
    <>
      <OperationalTopbar contextLabel="Settings" showDateFilter={false} />

      <div className="content-wrap settings-page-wrap">
        {/* Profile Centerpiece (Google Account Mobile Inspired - Borderless with Animated Glowing Avatar) */}
        <section className="settings-profile-centerpiece" aria-label="User Profile">
          {/* Centered Avatar with Animated Gradient Glow */}
          <div className="settings-hero-avatar-container">
            {/* Luminous Animated Moving Gradient Glow */}
            <div className="settings-hero-avatar-glow" aria-hidden="true" />

            {/* Crisp Animated Gradient Ring Border */}
            <div className="settings-hero-avatar-ring" aria-hidden="true" />

            <div className="settings-hero-avatar-wrap">
              {activeAvatar ? (
                <img
                  src={activeAvatar}
                  alt={cleanFullName}
                  width={156}
                  height={156}
                  className="settings-hero-avatar-img"
                />
              ) : (
                <div className="settings-hero-avatar-fallback">
                  <span>{initials}</span>
                </div>
              )}
              {photoUploading ? (
                <div className="settings-hero-avatar-loading">
                  <span>Saving…</span>
                </div>
              ) : null}
            </div>
          </div>

          {/* User Identity Header */}
          <div className="settings-hero-info">
            <h1 className="settings-hero-name">{cleanFullName}</h1>
            <p className="settings-hero-username">@{currentUsername}</p>

            <div className="settings-hero-badges">
              <span className={`access-pill ${actor.accessLevel}`}>
                {actor.roleLabel}
              </span>
              <span className="settings-hero-dot" aria-hidden="true">·</span>
              <span className="settings-hero-email">{currentEmail}</span>
              <span className="settings-hero-dot" aria-hidden="true">·</span>
              <span className="settings-hero-phone">{currentPhone}</span>
            </div>
          </div>

          {/* Profile Photo Actions */}
          <div className="settings-hero-actions">
            <label className="secondary-button settings-photo-btn" title="Upload a JPG, PNG, or WebP photo (max 5MB)">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handlePhotoSelect}
                disabled={photoUploading}
              />
              {activeAvatar ? "Change Photo" : "Upload Photo"}
            </label>

            {activeAvatar ? (
              <button
                type="button"
                className="settings-photo-remove-btn"
                onClick={handleRemovePhoto}
                disabled={photoUploading}
                title="Remove profile picture"
              >
                Remove
              </button>
            ) : null}
          </div>

          {photoFeedback ? (
            <div className={`settings-photo-feedback ${photoFeedback.tone}`}>
              {photoFeedback.text}
            </div>
          ) : (
            <p className="settings-photo-hint">
              JPG, PNG, or WebP (max 5MB).
            </p>
          )}
        </section>

        {/* Vertically Organized Settings Stack Under Profile */}
        <div className="settings-sections-container">
          {/* Section 1: Account Details (Change Username) */}
          <section className="records-card settings-card-section" aria-label="Account Details">
            <div className="settings-section-header">
              <h2>Account Details</h2>
              <p>Manage your username.</p>
            </div>

            <form onSubmit={handleUsernameSubmit} className="settings-form-body">
              {usernameFeedback ? (
                <div className={`settings-form-alert ${usernameFeedback.tone}`}>
                  {usernameFeedback.text}
                </div>
              ) : null}

              <div className="settings-field-row-2col">
                <div className="settings-form-field">
                  <label>Current Username</label>
                  <input
                    type="text"
                    disabled
                    value={`@${currentUsername}`}
                    className="settings-input"
                  />
                </div>

                <div className="settings-form-field">
                  <label>New Username</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. shinryu"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="settings-input"
                    minLength={3}
                    maxLength={30}
                  />
                </div>
              </div>

              <div className="settings-form-field">
                <label>Confirm Current Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter current password"
                  value={usernamePassword}
                  onChange={(e) => setUsernamePassword(e.target.value)}
                  className="settings-input"
                  minLength={8}
                />
              </div>

              <div className="settings-form-actions">
                <button
                  type="submit"
                  className="primary-action-button"
                  disabled={usernameSubmitting}
                  title="Save your new username"
                  style={{ minHeight: "42px", padding: "0 22px" }}
                >
                  {usernameSubmitting ? "Updating…" : "Save Username"}
                </button>
              </div>
            </form>
          </section>

          {/* Section 1b: Contact Information (Email & Phone Number) */}
          <section className="records-card settings-card-section" aria-label="Contact Information">
            <div className="settings-section-header">
              <h2>Contact Information</h2>
              <p>Manage your verified email address and primary phone number.</p>
            </div>

            <form onSubmit={handleContactSubmit} className="settings-form-body">
              {contactFeedback ? (
                <div className={`settings-form-alert ${contactFeedback.tone}`}>
                  {contactFeedback.text}
                </div>
              ) : null}

              <div className="settings-field-row-2col">
                <div className="settings-form-field">
                  <label>Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. user@routex.local"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="settings-input"
                  />
                </div>

                <div className="settings-form-field">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +63 917 123 4567"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="settings-input"
                  />
                </div>
              </div>

              <div className="settings-form-field">
                <label>Confirm Current Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter current password"
                  value={contactPassword}
                  onChange={(e) => setContactPassword(e.target.value)}
                  className="settings-input"
                  minLength={8}
                />
              </div>

              <div className="settings-form-actions">
                <button
                  type="submit"
                  className="primary-action-button"
                  disabled={contactSubmitting}
                  title="Save your email and phone number"
                  style={{ minHeight: "42px", padding: "0 22px" }}
                >
                  {contactSubmitting ? "Updating…" : "Save Contact Info"}
                </button>
              </div>
            </form>
          </section>

          {/* Section 2: Sign-in & Security (Change Password) */}
          <section className="records-card settings-card-section" aria-label="Sign-in & Security">
            <div className="settings-section-header">
              <h2>Sign-in &amp; Security</h2>
              <p>Update your password.</p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="settings-form-body">
              {passwordFeedback ? (
                <div className={`settings-form-alert ${passwordFeedback.tone}`}>
                  {passwordFeedback.text}
                </div>
              ) : null}

              <div className="settings-form-field">
                <label>Current Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="settings-input"
                  minLength={8}
                />
              </div>

              <div className="settings-field-row-2col">
                <div className="settings-form-field">
                  <label>New Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter new password (min. 8 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="settings-input"
                    minLength={8}
                    maxLength={128}
                  />
                </div>

                <div className="settings-form-field">
                  <label>Confirm New Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="settings-input"
                    minLength={8}
                    maxLength={128}
                  />
                </div>
              </div>

              <PasswordCriteriaList password={newPassword} />

              <div className="settings-form-actions">
                <button
                  type="submit"
                  className="primary-action-button"
                  disabled={passwordSubmitting}
                  title="Update your account password"
                  style={{ minHeight: "42px", padding: "0 22px" }}
                >
                  {passwordSubmitting ? "Updating…" : "Update Password"}
                </button>
              </div>
            </form>
          </section>

          {/* Section 3: Recovery & Verification (Security Question) */}
          <section className="records-card settings-card-section" aria-label="Recovery & Verification">
            <div className="settings-section-header">
              <h2>Recovery &amp; Verification</h2>
              <p>Used to verify identity during password recovery.</p>
            </div>

            <form onSubmit={handleSecurityQuestionSubmit} className="settings-form-body">
              {securityFeedback ? (
                <div className={`settings-form-alert ${securityFeedback.tone}`}>
                  {securityFeedback.text}
                </div>
              ) : null}

              <div className="settings-form-field">
                <label>Active Security Question</label>
                <div style={{ fontSize: "13px", fontWeight: 600, padding: "10px 14px", borderRadius: "10px", background: "var(--color-accent-soft)", color: "var(--color-accent-deep)" }}>
                  {currentQuestion}
                </div>
              </div>

              <div className="settings-form-field">
                <label>Choose New Question</label>
                <RoundedSelect
                  value={isCustomQuestion ? "custom" : selectedQuestion}
                  options={SECURITY_QUESTION_OPTIONS}
                  onChange={(val) => {
                    if (val === "custom") {
                      setIsCustomQuestion(true);
                    } else {
                      setIsCustomQuestion(false);
                      setSelectedQuestion(val);
                    }
                  }}
                  ariaLabel="Choose New Question"
                  className="is-form-select"
                />

                {isCustomQuestion ? (
                  <input
                    type="text"
                    required
                    placeholder="Enter your custom security question"
                    value={customQuestionText}
                    onChange={(e) => setCustomQuestionText(e.target.value)}
                    className="settings-input"
                    style={{ marginTop: "8px" }}
                  />
                ) : null}
              </div>

              <div className="settings-field-row-2col">
                <div className="settings-form-field">
                  <label>Security Answer (Case-sensitive)</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter secret answer"
                    value={securityAnswer}
                    onChange={(e) => setSecurityAnswer(e.target.value)}
                    className="settings-input"
                  />
                </div>

                <div className="settings-form-field">
                  <label>Confirm Security Answer</label>
                  <input
                    type="text"
                    required
                    placeholder="Confirm secret answer"
                    value={confirmSecurityAnswer}
                    onChange={(e) => setConfirmSecurityAnswer(e.target.value)}
                    className="settings-input"
                  />
                </div>
              </div>

              <div className="settings-form-field">
                <label>Confirm Current Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter current password"
                  value={securityPassword}
                  onChange={(e) => setSecurityPassword(e.target.value)}
                  className="settings-input"
                  minLength={8}
                />
              </div>

              <div className="settings-form-actions">
                <button
                  type="submit"
                  className="primary-action-button"
                  disabled={securitySubmitting}
                  title="Save your password recovery security question and answer"
                  style={{ minHeight: "42px", padding: "0 22px" }}
                >
                  {securitySubmitting ? "Saving…" : "Save Security Question"}
                </button>
              </div>
            </form>
          </section>

          {/* Section 4: Account Security Status */}
          <section className="records-card settings-card-section" aria-label="Account Security Status">
            <div className="settings-section-header">
              <h2>Account Security Status</h2>
              <p>Security protections enabled for your account.</p>
            </div>

            <div className="settings-security-checklist-card">
              <ul className="settings-security-checklist">
                <li className="settings-security-item">
                  <span className="settings-check-pill ok" aria-hidden="true">✓</span>
                  <div>
                    <strong>Argon2id Password Encryption</strong>
                    <p className="settings-security-subtext">RFC 9106 cryptographic standard</p>
                  </div>
                </li>
                <li className="settings-security-item">
                  <span className={`settings-check-pill ${currentQuestion !== "Not yet configured" ? "ok" : "pending"}`} aria-hidden="true">
                    {currentQuestion !== "Not yet configured" ? "✓" : "!"}
                  </span>
                  <div>
                    <strong>
                      {currentQuestion !== "Not yet configured"
                        ? "Security Question Configured"
                        : "Security Question Pending"}
                    </strong>
                    <p className="settings-security-subtext">
                      {currentQuestion !== "Not yet configured"
                        ? "Active self-service recovery"
                        : "Required for self-service recovery"}
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </section>

          {/* Section 5: Role Permissions Reference */}
          <section className="records-card settings-card-section" aria-label="Role Permissions">
            <div className="settings-section-header">
              <h2>Role Permissions</h2>
              <p>System privileges and operational authority across RouteX roles.</p>
            </div>

            <div
              className="settings-role-current-summary"
              style={{
                margin: "14px 0 18px",
                padding: "12px 16px",
                borderRadius: "10px",
                background: "var(--color-surface-subtle, rgba(241, 245, 249, 0.6))",
                border: "1px solid var(--color-border-subtle, rgba(148, 163, 184, 0.2))",
                fontSize: "13px",
                lineHeight: 1.5,
                color: "var(--color-text-secondary)",
              }}
            >
              <strong style={{ color: "var(--color-text-primary)" }}>
                Active Session Role ({ROLE_METADATA[actor.role].label}):
              </strong>{" "}
              {ROLE_METADATA[actor.role].summary}
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Access Level</th>
                    <th>Finance &amp; Expenses</th>
                    <th>Deliveries &amp; Drop-offs</th>
                    <th>Excel Import &amp; Review</th>
                    <th>Fleet &amp; Profitability</th>
                    <th>POD &amp; Documents</th>
                    <th>Reports &amp; Analytics</th>
                    <th>User Management</th>
                  </tr>
                </thead>
                <tbody>
                  {USER_ROLES.map((roleKey) => {
                    const meta = ROLE_METADATA[roleKey];
                    const isCurrentRole = actor.role === roleKey;
                    return (
                      <tr key={roleKey} className={isCurrentRole ? "settings-current-role-row" : undefined}>
                        <td>
                          <strong>{meta.label}</strong>
                          {isCurrentRole ? <span className="settings-current-role-tag">(Your Role)</span> : null}
                        </td>
                        <td>
                          <span className={`access-pill ${meta.accessLevel}`}>
                            {meta.accessLevelLabel}
                          </span>
                        </td>
                        <td>{renderFinanceCell(roleKey)}</td>
                        <td>{renderDeliveriesCell(roleKey)}</td>
                        <td>{renderImportCell(roleKey)}</td>
                        <td>{renderTrucksCell(roleKey)}</td>
                        <td>{renderPodCell(roleKey)}</td>
                        <td>{renderReportsCell(roleKey)}</td>
                        <td>{renderUsersCell(roleKey)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function renderFinanceCell(role: UserRole) {
  if (role === "admin") {
    return <strong style={{ color: "var(--color-success, #10b981)" }}>Full Control (Create, Edit &amp; Delete)</strong>;
  }
  if (canManageCompanyExpenses(role)) {
    return <strong style={{ color: "var(--color-success, #10b981)" }}>Create, Edit &amp; Manage (Finance Page)</strong>;
  }
  return <span style={{ color: "var(--color-text-muted)" }}>View-Only</span>;
}

function renderDeliveriesCell(role: UserRole) {
  if (role === "admin") {
    return <strong style={{ color: "var(--color-success, #10b981)" }}>Full Control (No 3-Day Limit)</strong>;
  }
  if (canMutateDeliveryRecords(role)) {
    return <strong style={{ color: "var(--color-success, #10b981)" }}>Create, Edit &amp; View (3-Day Window)</strong>;
  }
  return <span style={{ color: "var(--color-text-muted)" }}>View-Only</span>;
}

function renderImportCell(role: UserRole) {
  if (canImportAndReviewExcel(role)) {
    return <strong style={{ color: "var(--color-success, #10b981)" }}>Upload, Review &amp; Confirm</strong>;
  }
  return <span style={{ color: "var(--color-text-muted)" }}>No Access</span>;
}

function renderTrucksCell(role: UserRole) {
  if (role === "admin") {
    return <strong style={{ color: "var(--color-success, #10b981)" }}>Full Control (Trucks, Crew &amp; Delete)</strong>;
  }
  if (canManageTrucks(role)) {
    return <strong style={{ color: "var(--color-success, #10b981)" }}>Register Trucks &amp; Crew</strong>;
  }
  return <span style={{ color: "var(--color-text-muted)" }}>View-Only</span>;
}

function renderPodCell(role: UserRole) {
  if (canManageDocuments(role)) {
    return <strong style={{ color: "var(--color-success, #10b981)" }}>Upload &amp; Manage</strong>;
  }
  return <span style={{ color: "var(--color-text-muted)" }}>View-Only</span>;
}

function renderReportsCell(role: UserRole) {
  if (hasPermission(role, "reports:manage_templates")) {
    return <strong style={{ color: "var(--color-success, #10b981)" }}>View, Export &amp; Custom Templates</strong>;
  }
  if (hasPermission(role, "reports:export")) {
    return <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>View &amp; Export</span>;
  }
  return <span style={{ color: "var(--color-text-muted)" }}>View-Only</span>;
}

function renderUsersCell(role: UserRole) {
  if (canManageUsers(role)) {
    return <strong style={{ color: "var(--color-success, #10b981)" }}>Full Admin Control</strong>;
  }
  return <span style={{ color: "var(--color-text-muted)" }}>Restricted</span>;
}
