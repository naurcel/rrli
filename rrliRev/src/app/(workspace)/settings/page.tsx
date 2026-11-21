"use client";

import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { useAuthenticatedActor } from "@/components/auth-context";
import { OperationalTopbar } from "@/components/operational-topbar";
import { PasswordCriteriaList } from "@/components/password-criteria-list";
import { RoundedSelect, type SelectOption } from "@/components/rounded-select";
import {
  applyDesignPreferences,
  DESIGN_PREFERENCES_EVENT,
  type DesignPreferences,
  loadDesignPreferences,
  resetDesignPreferences,
} from "@/components/design-preferences";
import {
  getDefaultAvatarUrl,
  getProfileStorageKey,
  getUserInitials,
  PROFILE_PHOTO_EVENT,
  resizeProfilePhotoFile,
} from "@/components/profile-photo";
import {
  evaluatePasswordCriteria,
  normalizeSecurityAnswer,
  PREDEFINED_SECURITY_QUESTIONS,
  validateUsernameFormat,
} from "@/lib/auth/password-policy";
import {
  formatDateRange,
  GlobalDateRangePicker,
  toDateKey,
  useGlobalDateRange,
  type DateRange,
} from "@/components/global-date-range-picker";
import { ReportsDataExportTab } from "@/components/reports-data-export-tab";
import { usePersistedDeliveries } from "@/features/deliveries/use-persisted-deliveries";
import {
  readBrowserPreviewExpenses,
  ROUTEX_COMPANY_EXPENSES_CHANGED,
} from "@/features/finance/browser-preview-expenses";
import type { CompanyExpense } from "@/features/finance/company-expense-domain";
import {
  canAccessDataExportTab,
  readExportRequests,
  ROUTEX_EXPORT_REQUESTS_CHANGED,
} from "@/features/reports/data-export-engine";
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
import { DiscordPermissionsManager } from "@/features/permissions/DiscordPermissionsManager";
import { RolePermissionsMatrix } from "@/features/permissions/RolePermissionsMatrix";

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

  // Emergency Backup Key state
  const [backupKeyPassword, setBackupKeyPassword] = useState("");
  const [backupKeyFeedback, setBackupKeyFeedback] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [backupKeySubmitting, setBackupKeySubmitting] = useState(false);
  const [generatedBackupKey, setGeneratedBackupKey] = useState<string | null>(null);
  const [hasExistingBackupKey, setHasExistingBackupKey] = useState(false);

  // Design Preferences state & Dark mode sync
  type SettingsTab = "account" | "appearance" | "security" | "permissions" | "export";
  const [activeTab, setActiveTab] = useState<SettingsTab>("account");
  const [permissionsView, setPermissionsView] = useState<"interactive" | "matrix">("interactive");

  const ALL_TIME_RANGE: DateRange = { startDate: null, endDate: null };
  const { range } = useGlobalDateRange();
  const { deliveries: allDeliveries } = usePersistedDeliveries(ALL_TIME_RANGE);
  const [companyExpenses, setCompanyExpenses] = useState<CompanyExpense[]>([]);
  const [pendingExportRequestsCount, setPendingExportRequestsCount] = useState(0);

  useEffect(() => {
    const syncPending = () => {
      const reqs = readExportRequests();
      setPendingExportRequestsCount(reqs.filter((r) => r.status === "pending").length);
    };
    syncPending();
    window.addEventListener(ROUTEX_EXPORT_REQUESTS_CHANGED, syncPending);
    window.addEventListener("storage", syncPending);
    return () => {
      window.removeEventListener(ROUTEX_EXPORT_REQUESTS_CHANGED, syncPending);
      window.removeEventListener("storage", syncPending);
    };
  }, []);

  useEffect(() => {
    async function fetchExpenses() {
      try {
        const res = await fetch("/api/finance/expenses?pageSize=100");
        if (res.ok) {
          const data = await res.json();
          if (data.ok && Array.isArray(data.items)) {
            setCompanyExpenses(data.items);
            return;
          }
        }
      } catch {
        // Fallback
      }
      setCompanyExpenses(readBrowserPreviewExpenses());
    }

    fetchExpenses();

    const onExpensesChanged = () => {
      setCompanyExpenses(readBrowserPreviewExpenses());
    };
    window.addEventListener(ROUTEX_COMPANY_EXPENSES_CHANGED, onExpensesChanged);
    return () => {
      window.removeEventListener(ROUTEX_COMPANY_EXPENSES_CHANGED, onExpensesChanged);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "").toLowerCase();
      if (hash === "appearance" || hash === "design") setActiveTab("appearance");
      else if (hash === "security") setActiveTab("security");
      else if (hash === "permissions") setActiveTab("permissions");
      else if (hash === "export" || hash === "data-export") setActiveTab("export");
      else if (hash === "account") setActiveTab("account");
    }
  }, []);

  function handleSelectTab(tab: SettingsTab) {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", '#' + tab);
    }
  }

  // Design Preferences state & Dark mode sync
  const [preferences, setPreferences] = useState<DesignPreferences>(() =>
    loadDesignPreferences(actor.id)
  );
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    try {
      const current =
        document.documentElement.dataset.theme ??
        window.localStorage.getItem("routex-theme");
      setIsDark(current === "dark");
    } catch {
      // Ignore
    }

    const currentPrefs = loadDesignPreferences(actor.id);
    setPreferences(currentPrefs);
    applyDesignPreferences(currentPrefs, actor.id);

    function handlePrefsChange(e: Event) {
      const ce = e as CustomEvent<DesignPreferences>;
      if (ce.detail) {
        setPreferences(ce.detail);
      }
    }

    function handleStorage(e: StorageEvent) {
      if (e.key === "routex-theme" && e.newValue) {
        setIsDark(e.newValue === "dark");
      }
      if (e.key && e.key.startsWith("routex.design-preferences")) {
        const next = loadDesignPreferences(actor.id);
        setPreferences(next);
        applyDesignPreferences(next, actor.id);
      }
    }

    window.addEventListener(DESIGN_PREFERENCES_EVENT, handlePrefsChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(DESIGN_PREFERENCES_EVENT, handlePrefsChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [actor.id]);

  function handleUpdatePreferences(partial: Partial<DesignPreferences>) {
    const next: DesignPreferences = {
      ...preferences,
      ...partial,
    };
    setPreferences(next);
    applyDesignPreferences(next, actor.id);
  }

  function handleResetPreferences() {
    const defaults = resetDesignPreferences(actor.id);
    setPreferences(defaults);
  }

  function handleToggleTheme() {
    setIsDark((prev) => {
      const next = !prev;
      const nextTheme = next ? "dark" : "light";
      document.documentElement.dataset.theme = nextTheme;
      try {
        window.localStorage.setItem("routex-theme", nextTheme);
      } catch {
        // Ignore
      }
      return next;
    });
  }

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
          if (data.actor.hasBackupKey) setHasExistingBackupKey(Boolean(data.actor.hasBackupKey));
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

    if (normalizeSecurityAnswer(securityAnswer) !== normalizeSecurityAnswer(confirmSecurityAnswer)) {
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

  async function handleGenerateBackupKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBackupKeyFeedback(null);
    if (!backupKeyPassword) {
      setBackupKeyFeedback({ tone: "error", text: "Current password is required to generate a backup key." });
      return;
    }

    try {
      setBackupKeySubmitting(true);
      const res = await fetch("/api/auth/backup-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: backupKeyPassword }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setBackupKeyFeedback({
          tone: "error",
          text: data?.message || "Failed to generate emergency backup key.",
        });
        return;
      }

      setGeneratedBackupKey(data.backupKey);
      setHasExistingBackupKey(true);
      setBackupKeyPassword("");
      setBackupKeyFeedback({
        tone: "success",
        text: "Emergency backup key generated successfully! Save this key now in a secure offline location.",
      });
      toast.success("Emergency backup key generated!");
    } catch {
      setBackupKeyFeedback({ tone: "error", text: "Network error generating emergency backup key." });
    } finally {
      setBackupKeySubmitting(false);
    }
  }

  const activeAvatar = previewUrl || currentAvatar;
  const initials = getUserInitials(actor.fullName, actor.username);
  const cleanFullName = actor.fullName.replace(/\s*\([^)]*\)/g, "").trim() || actor.fullName;

  return (
    <>
      <OperationalTopbar contextLabel="Settings" showDateFilter={false} />

      <div className={`content-wrap settings-page-wrap${activeTab === "export" || activeTab === "permissions" ? " is-export" : ""}`}>
        <div className={`settings-layout-grid${activeTab === "export" || activeTab === "permissions" ? " is-export" : ""}`}>
          {/* Left Navigation: Clean text tabs */}
          <aside className="settings-tabs-sidebar" aria-label="Settings categories">
            <nav className="settings-tabs-list" role="tablist">
              <button
                type="button"
                role="tab"
                id="tab-account"
                aria-selected={activeTab === "account"}
                aria-controls="panel-account"
                className={`settings-tab-btn${activeTab === "account" ? " active" : ""}`}
                onClick={() => handleSelectTab("account")}
              >
                Account
              </button>
              <button
                type="button"
                role="tab"
                id="tab-appearance"
                aria-selected={activeTab === "appearance"}
                aria-controls="panel-appearance"
                className={`settings-tab-btn${activeTab === "appearance" ? " active" : ""}`}
                onClick={() => handleSelectTab("appearance")}
              >
                Appearance
              </button>
              <button
                type="button"
                role="tab"
                id="tab-security"
                aria-selected={activeTab === "security"}
                aria-controls="panel-security"
                className={`settings-tab-btn${activeTab === "security" ? " active" : ""}`}
                onClick={() => handleSelectTab("security")}
              >
                Security
              </button>
              <button
                type="button"
                role="tab"
                id="tab-permissions"
                aria-selected={activeTab === "permissions"}
                aria-controls="panel-permissions"
                className={`settings-tab-btn${activeTab === "permissions" ? " active" : ""}`}
                onClick={() => handleSelectTab("permissions")}
              >
                Permissions
              </button>
              {canAccessDataExportTab(actor.role) && (
                <button
                  type="button"
                  role="tab"
                  id="tab-export"
                  aria-selected={activeTab === "export"}
                  aria-controls="panel-export"
                  className={`settings-tab-btn${activeTab === "export" ? " active" : ""}`}
                  onClick={() => handleSelectTab("export")}
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}
                >
                  <span>Export Data</span>
                  {actor.role === "admin" && pendingExportRequestsCount > 0 ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: "18px",
                        height: "18px",
                        padding: "0 5px",
                        borderRadius: "999px",
                        fontSize: "10.5px",
                        fontWeight: 700,
                        background: "var(--color-accent, #b45309)",
                        color: "#ffffff",
                      }}
                    >
                      {pendingExportRequestsCount}
                    </span>
                  ) : null}
                </button>
              )}
            </nav>
          </aside>

          {/* Right Main Content Column */}
          <div className={`settings-tab-content-area${activeTab === "export" || activeTab === "permissions" ? " is-expanded" : ""}`}>
            {activeTab === "account" && (
              <div id="panel-account" role="tabpanel" aria-labelledby="tab-account" className="settings-tab-panel">
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
            <label className="secondary-button settings-photo-btn">
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
                title="Remove photo"
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
                  style={{ minHeight: "42px", padding: "0 22px" }}
                >
                  {contactSubmitting ? "Updating…" : "Save Contact Info"}
                </button>
              </div>
            </form>
          </section>
              </div>
            )}

            {activeTab === "appearance" && (
              <div id="panel-appearance" role="tabpanel" aria-labelledby="tab-appearance" className="settings-tab-panel">
                          <section className="records-card settings-card-section appearance-card" aria-label="Appearance and Design Preferences">
            <div className="settings-section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h2>Appearance &amp; Design</h2>
                <p>Customize typography scaling, visual density, animations, and color mode across RouteX.</p>
              </div>
              <button
                type="button"
                className="profile-prefs-reset-btn"
                onClick={handleResetPreferences}
                title="Reset design preferences to system defaults"
              >
                Reset to Defaults
              </button>
            </div>

            <div className="settings-form-body appearance-form-body">
              {/* Theme Mode Option */}
              <div className="appearance-section-item">
                <div className="appearance-item-header">
                  <div>
                    <h3 className="appearance-item-title">Color Theme</h3>
                    <p className="appearance-item-subtext">Toggle between daylight contrast and low-glare obsidian dark mode.</p>
                  </div>
                </div>
                <div className="appearance-toggle-box">
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-primary)" }}>Dark Mode</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isDark}
                    aria-label="Toggle dark mode"
                    className={`profile-theme-switch${isDark ? " active" : ""}`}
                    onClick={handleToggleTheme}
                  >
                    <span className="profile-theme-knob" />
                  </button>
                </div>
              </div>

              {/* Font Size Scaling */}
              <div className="appearance-section-item">
                <div className="appearance-item-header">
                  <div>
                    <h3 className="appearance-item-title">Font Size Scaling</h3>
                    <p className="appearance-item-subtext">
                      Scales typography proportionally across tables, form inputs, buttons, navigation, and summary cards.
                    </p>
                  </div>
                </div>
                <div className="profile-segmented-control" role="radiogroup" aria-label="Font Size options" style={{ maxWidth: "420px" }}>
                  {(["small", "default", "large"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      role="radio"
                      aria-checked={preferences.fontSize === opt}
                      className={`profile-segmented-btn${preferences.fontSize === opt ? " active" : ""}`}
                      onClick={() => handleUpdatePreferences({ fontSize: opt })}
                    >
                      {opt === "small" ? "Small (Compact)" : opt === "large" ? "Large (Accessible)" : "Default"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Layout Compactness */}
              <div className="appearance-section-item">
                <div className="appearance-item-header">
                  <div>
                    <h3 className="appearance-item-title">Layout Density &amp; Compactness</h3>
                    <p className="appearance-item-subtext">
                      Adjusts whitespace, table row heights, form padding, and grid gaps to maximize visible data on screen.
                    </p>
                  </div>
                </div>
                <div className="profile-segmented-control" role="radiogroup" aria-label="Compactness options" style={{ maxWidth: "340px" }}>
                  {(["comfortable", "compact"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      role="radio"
                      aria-checked={preferences.compactness === opt}
                      className={`profile-segmented-btn${preferences.compactness === opt ? " active" : ""}`}
                      onClick={() => handleUpdatePreferences({ compactness: opt })}
                    >
                      {opt === "comfortable" ? "Comfortable (Spacious)" : "Compact (Dense)"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reduce Motion */}
              <div className="appearance-section-item">
                <div className="appearance-item-header">
                  <div>
                    <h3 className="appearance-item-title">Reduce Motion</h3>
                    <p className="appearance-item-subtext">
                      Disables non-essential view transitions, drawer slides, dropdown animations, and animated spinners.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={preferences.reduceMotion}
                    aria-label={preferences.reduceMotion ? "Disable reduced motion" : "Enable reduced motion"}
                    className={`profile-theme-switch${preferences.reduceMotion ? " active" : ""}`}
                    onClick={() => handleUpdatePreferences({ reduceMotion: !preferences.reduceMotion })}
                  >
                    <span className="profile-theme-knob" />
                  </button>
                </div>
              </div>
            </div>
          </section>
              </div>
            )}

            {activeTab === "security" && (
              <div id="panel-security" role="tabpanel" aria-labelledby="tab-security" className="settings-tab-panel">
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
                  style={{ minHeight: "42px", padding: "0 22px" }}
                >
                  {securitySubmitting ? "Saving…" : "Save Security Question"}
                </button>
              </div>
            </form>
          </section>

          {/* Section 4: Emergency Backup Key */}
          <section className="records-card settings-card-section" aria-label="Emergency Backup Key">
            <div className="settings-section-header">
              <h2>Emergency Backup Key</h2>
              <p>Generate a single-use emergency backup key for offline account recovery.</p>
            </div>

            <p className="settings-explanation-text">
              Emergency backup keys allow you to recover account access if you forget your password or cannot answer your security question.
              Each key is strictly <strong>single-use</strong>. Generating a new key invalidates any prior key immediately.
              Plaintext backup keys are never stored on RouteX servers (Argon2id cryptographic hash only).
            </p>

            {backupKeyFeedback && (
              <div
                className={`feedback-banner ${backupKeyFeedback.tone}`}
                role="alert"
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  marginBottom: "16px",
                  backgroundColor: backupKeyFeedback.tone === "success" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                  color: backupKeyFeedback.tone === "success" ? "#059669" : "#dc2626",
                  border: `1px solid ${backupKeyFeedback.tone === "success" ? "#10b981" : "#ef4444"}`,
                }}
              >
                {backupKeyFeedback.text}
              </div>
            )}

            {generatedBackupKey && (
              <div
                style={{
                  padding: "16px",
                  borderRadius: "8px",
                  border: "1px dashed var(--color-accent-deep)",
                  backgroundColor: "var(--color-surface-subtle)",
                  marginBottom: "20px",
                }}
              >
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--color-accent-deep)", marginBottom: "4px" }}>
                  Your New Single-Use Emergency Backup Key:
                </div>
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "20px",
                    fontWeight: 700,
                    letterSpacing: "1.5px",
                    padding: "10px 0",
                    color: "var(--color-text)",
                    userSelect: "all",
                  }}
                >
                  {generatedBackupKey}
                </div>
                <p
                  style={{
                    margin: "4px 0 14px",
                    fontSize: "12px",
                    color: "var(--color-text-muted)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                    aria-hidden="true"
                  >
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>Save this key in a secure location (e.g. password manager, safe). It will never be displayed again.</span>
                </p>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ padding: "6px 14px", fontSize: "12px", fontWeight: 600 }}
                    onClick={() => {
                      navigator.clipboard.writeText(generatedBackupKey);
                      toast.success("Emergency backup key copied to clipboard!");
                    }}
                  >
                    Copy Key
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ padding: "6px 14px", fontSize: "12px", fontWeight: 600 }}
                    onClick={() => {
                      const content = `ROUTEX EMERGENCY BACKUP KEY\nAccount: ${actor.username}\nKey: ${generatedBackupKey}\nGenerated: ${new Date().toISOString()}\n\nNote: This is a single-use emergency backup key. Store offline in a secure location.`;
                      const blob = new Blob([content], { type: "text/plain" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `routex-backup-key-${actor.username}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success("Backup key downloaded!");
                    }}
                  >
                    Download .txt
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleGenerateBackupKey} className="settings-stacked-form" noValidate>
              <div className="settings-field-group">
                <label htmlFor="input-backupkey-password" className="settings-field-label">
                  Current Password (Identity Verification)
                </label>
                <input
                  id="input-backupkey-password"
                  type="password"
                  required
                  placeholder="Enter current password to generate key"
                  value={backupKeyPassword}
                  onChange={(e) => setBackupKeyPassword(e.target.value)}
                  className="settings-input"
                  style={{ maxWidth: "340px" }}
                  minLength={8}
                />
              </div>

              <div className="settings-form-actions">
                <button
                  type="submit"
                  className="primary-action-button"
                  disabled={backupKeySubmitting}
                  style={{ minHeight: "42px", padding: "0 22px" }}
                >
                  {backupKeySubmitting ? "Generating…" : hasExistingBackupKey ? "Regenerate Backup Key" : "Generate Emergency Backup Key"}
                </button>
              </div>
            </form>
          </section>

          {/* Section 5: Account Security Status */}
          <section className="records-card settings-card-section" aria-label="Account Security Status">
            <div className="settings-section-header">
              <h2>Account Security Status</h2>
              <p>Security protections enabled for your account.</p>
            </div>

            <div className="settings-security-checklist-card">
              <ul className="settings-security-checklist">
                <li className="settings-security-item">
                  <span className="settings-check-pill ok" aria-hidden="true" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <div>
                    <strong>Argon2id Password Encryption</strong>
                    <p className="settings-security-subtext">RFC 9106 cryptographic standard</p>
                  </div>
                </li>
                <li className="settings-security-item">
                  <span
                    className={`settings-check-pill ${currentQuestion !== "Not yet configured" ? "ok" : "pending"}`}
                    aria-hidden="true"
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                  >
                    {currentQuestion !== "Not yet configured" ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      "!"
                    )}
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
                <li className="settings-security-item">
                  <span
                    className={`settings-check-pill ${hasExistingBackupKey || Boolean(generatedBackupKey) ? "ok" : "pending"}`}
                    aria-hidden="true"
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                  >
                    {hasExistingBackupKey || Boolean(generatedBackupKey) ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      "!"
                    )}
                  </span>
                  <div>
                    <strong>
                      {hasExistingBackupKey || Boolean(generatedBackupKey)
                        ? "Emergency Backup Key Configured"
                        : "Emergency Backup Key Not Yet Generated"}
                    </strong>
                    <p className="settings-security-subtext">
                      {hasExistingBackupKey || Boolean(generatedBackupKey)
                        ? "Single-use key ready for emergency recovery"
                        : "Recommended for secure offline recovery"}
                    </p>
                  </div>
                </li>
              </ul>
            </div>
          </section>
              </div>
            )}

            {activeTab === "permissions" && (
              <div id="panel-permissions" role="tabpanel" aria-labelledby="tab-permissions" className="settings-tab-panel">
                {canManageUsers(actor.role) ? (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "16px",
                        flexWrap: "wrap",
                        gap: "10px",
                      }}
                    >
                      <div>
                        <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "var(--color-text-primary)" }}>
                          Roles & Permissions
                        </h2>
                        <p style={{ fontSize: "12.5px", color: "var(--color-text-secondary)", margin: "4px 0 0 0" }}>
                          Configure operational permissions for roles and individual employees.
                        </p>
                      </div>
                      <div className="user-management-tabs" style={{ margin: 0 }}>
                        <button
                          type="button"
                          className={permissionsView === "interactive" ? "active" : ""}
                          onClick={() => setPermissionsView("interactive")}
                        >
                          Roles & Staff
                        </button>
                        <button
                          type="button"
                          className={permissionsView === "matrix" ? "active" : ""}
                          onClick={() => setPermissionsView("matrix")}
                        >
                          Access Matrix
                        </button>
                      </div>
                    </div>
                    {permissionsView === "interactive" ? (
                      <DiscordPermissionsManager />
                    ) : (
                      <RolePermissionsMatrix />
                    )}
                  </div>
                ) : (
                  <RolePermissionsMatrix />
                )}
              </div>
            )}

            {activeTab === "export" && canAccessDataExportTab(actor.role) && (
              <div id="panel-export" role="tabpanel" aria-labelledby="tab-export" className="settings-tab-panel is-export">
                <ReportsDataExportTab
                  actor={actor}
                  allDeliveries={allDeliveries}
                  allCompanyExpenses={companyExpenses}
                  dateFrom={range.startDate ? toDateKey(range.startDate) : null}
                  dateTo={range.endDate ? toDateKey(range.endDate) : null}
                  periodLabel={formatDateRange(range)}
                  dateRangePicker={<GlobalDateRangePicker />}
                />
              </div>
            )}
          </div>

          {/* Balanced Right Spacer: only when not in full-width export or permissions tab */}
          {activeTab !== "export" && activeTab !== "permissions" && (
            <div className="settings-grid-spacer" aria-hidden="true" />
          )}
        </div>
      </div>
    </>
  );
}

const ROLE_CONCISE_SUMMARY: Record<UserRole, string> = {
  admin: "Full administrative control and unrestricted data access.",
  operations: "Create & edit deliveries, manage fleet trucks, and import trip reports.",
  finance: "Record & manage company operating expenses and view financial reports.",
  hr: "View-only access across workspace ledgers and reports.",
  secretary: "View-only access across workspace ledgers and reports.",
  customer_representative: "View-only access across workspace ledgers and reports.",
};

function renderDeliveriesCell(role: UserRole) {
  if (role === "admin") {
    return <strong style={{ color: "var(--color-success, #10b981)" }}>Full</strong>;
  }
  if (canMutateDeliveryRecords(role)) {
    return <strong style={{ color: "var(--color-primary, #2563eb)" }}>Manage</strong>;
  }
  return <span style={{ color: "var(--color-text-muted)" }}>View</span>;
}

function renderFinanceCell(role: UserRole) {
  if (role === "admin") {
    return <strong style={{ color: "var(--color-success, #10b981)" }}>Full</strong>;
  }
  if (canManageCompanyExpenses(role)) {
    return <strong style={{ color: "var(--color-primary, #2563eb)" }}>Manage</strong>;
  }
  return <span style={{ color: "var(--color-text-muted)" }}>View</span>;
}

function renderImportCell(role: UserRole) {
  if (canImportAndReviewExcel(role)) {
    return <strong style={{ color: "var(--color-primary, #2563eb)" }}>Upload</strong>;
  }
  return <span style={{ color: "var(--color-text-muted)" }}>—</span>;
}

function renderTrucksCell(role: UserRole) {
  if (role === "admin") {
    return <strong style={{ color: "var(--color-success, #10b981)" }}>Full</strong>;
  }
  if (canManageTrucks(role)) {
    return <strong style={{ color: "var(--color-primary, #2563eb)" }}>Manage</strong>;
  }
  return <span style={{ color: "var(--color-text-muted)" }}>View</span>;
}

function renderPodCell(role: UserRole) {
  if (canManageDocuments(role)) {
    return <strong style={{ color: "var(--color-primary, #2563eb)" }}>Upload</strong>;
  }
  return <span style={{ color: "var(--color-text-muted)" }}>View</span>;
}

function renderReportsCell(role: UserRole) {
  if (hasPermission(role, "reports:export")) {
    return <strong style={{ color: "var(--color-primary, #2563eb)" }}>Export</strong>;
  }
  return <span style={{ color: "var(--color-text-muted)" }}>View</span>;
}

function renderUsersCell(role: UserRole) {
  if (canManageUsers(role)) {
    return <strong style={{ color: "var(--color-success, #10b981)" }}>Full</strong>;
  }
  return <span style={{ color: "var(--color-text-muted)" }}>—</span>;
}
