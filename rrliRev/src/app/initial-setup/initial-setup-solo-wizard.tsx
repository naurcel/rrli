"use client";

import { useState, useEffect, useRef, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PREDEFINED_SECURITY_QUESTIONS,
  evaluatePasswordCriteria,
  normalizeSecurityAnswer,
} from "@/lib/auth/password-policy";
import { PasswordCriteriaList } from "@/components/password-criteria-list";
import { RoundedSelect } from "@/components/rounded-select";
import {
  getUserInitials,
  validateAndReadProfilePhotoFile,
  getProfileStorageKey,
  PROFILE_PHOTO_EVENT,
} from "@/components/profile-photo";
import { ProfilePhotoCropperModal } from "@/components/profile-photo-cropper";

interface ActorInfo {
  id: string;
  username: string;
  fullName?: string | null;
  role: string;
}

type SetupPhase =
  | "intro"
  | "password"
  | "outro-password"
  | "photo"
  | "outro-photo"
  | "recovery"
  | "outro-recovery"
  | "backup-key"
  | "outro-complete";

export function InitialSetupSoloWizard({ actor }: { actor: ActorInfo }) {
  const router = useRouter();

  // Orchestrated phase state & smooth blur-fade transition state
  const [phase, setPhase] = useState<SetupPhase>("intro");
  const [transitionPhase, setTransitionPhase] = useState<"idle" | "blur-out" | "blur-in">("blur-in");
  const [isExiting, setIsExiting] = useState(false);
  const timersRef = useRef<number[]>([]);

  // Stage 1: Password fields
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Stage 2: Profile Photo
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [rawPhotoSource, setRawPhotoSource] = useState<string | null>(null);
  const [cropModalSource, setCropModalSource] = useState<string | null>(null);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Stage 3: Recovery Question fields
  const [question, setQuestion] = useState<string>(PREDEFINED_SECURITY_QUESTIONS[0]);
  const [isCustomQuestion, setIsCustomQuestion] = useState(false);
  const [customQuestionText, setCustomQuestionText] = useState("");
  const [answer, setAnswer] = useState("");
  const [confirmAnswer, setConfirmAnswer] = useState("");

  // Stage 4: Emergency Backup Key state
  const [backupKey, setBackupKey] = useState<string>("");
  const [keyCopied, setKeyCopied] = useState(false);
  const [keyDownloaded, setKeyDownloaded] = useState(false);
  const [keyConfirmedSaved, setKeyConfirmedSaved] = useState(false);

  // Submitting state
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Validation
  const pwdValidation = evaluatePasswordCriteria(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const step1Valid = pwdValidation.isValid && passwordsMatch;

  const resolvedQuestion = isCustomQuestion ? customQuestionText.trim() : question;
  const answersMatch =
    answer.trim().length >= 2 &&
    normalizeSecurityAnswer(answer) === normalizeSecurityAnswer(confirmAnswer);
  const step3Valid = Boolean(resolvedQuestion && answersMatch);

  const initials = getUserInitials(actor.fullName, actor.username);
  const firstName = actor.fullName?.trim() ? actor.fullName.trim().split(" ")[0] : actor.username;

  function clearAllTimers() {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }

  function scheduleTimer(fn: () => void, ms: number) {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }

  // Transition directly to an interactive stage
  function transitionToPhase(nextPhase: SetupPhase) {
    clearAllTimers();
    setErrorMessage(null);
    setTransitionPhase("blur-out");

    scheduleTimer(() => {
      setPhase(nextPhase);
      setTransitionPhase("blur-in");
      scheduleTimer(() => {
        setTransitionPhase("idle");
      }, 700);
    }, 440);
  }

  // Play an interstitial sentence before advancing to the target stage
  function playInterstitialThen(interstitialPhase: SetupPhase, targetPhase: SetupPhase, holdMs = 1850) {
    clearAllTimers();
    setErrorMessage(null);
    setTransitionPhase("blur-out");

    // 1. Fade out current stage
    scheduleTimer(() => {
      setPhase(interstitialPhase);
      setTransitionPhase("blur-in");

      scheduleTimer(() => {
        setTransitionPhase("idle");
      }, 680);

      // 2. Hold interstitial sentence, then fade out into target interactive stage
      scheduleTimer(() => {
        setTransitionPhase("blur-out");

        scheduleTimer(() => {
          setPhase(targetPhase);
          setTransitionPhase("blur-in");

          scheduleTimer(() => {
            setTransitionPhase("idle");
          }, 700);
        }, 460);
      }, holdMs);
    }, 440);
  }

  // Initial mount: show "Welcome, [firstName]." then gently transition to Stage 1
  useEffect(() => {
    const settleId = window.setTimeout(() => {
      setTransitionPhase("idle");
    }, 700);

    const outId = window.setTimeout(() => {
      setTransitionPhase("blur-out");
    }, 2200);

    const stage1Id = window.setTimeout(() => {
      setPhase("password");
      setTransitionPhase("blur-in");
    }, 2680);

    const idleId = window.setTimeout(() => {
      setTransitionPhase("idle");
    }, 3380);

    timersRef.current.push(settleId, outId, stage1Id, idleId);
    return () => clearAllTimers();
  }, []);

  function handleContinueFromPassword(e: FormEvent) {
    e.preventDefault();
    if (!step1Valid) {
      if (!pwdValidation.isValid) {
        setErrorMessage(pwdValidation.errors[0] || "Password does not meet all security criteria.");
      } else if (!passwordsMatch) {
        setErrorMessage("Passwords do not match.");
      }
      return;
    }
    playInterstitialThen("outro-password", "photo", 1850);
  }

  async function handlePhotoFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError(null);
    setPhotoProcessing(true);
    try {
      const rawDataUrl = await validateAndReadProfilePhotoFile(file);
      setRawPhotoSource(rawDataUrl);
      setCropModalSource(rawDataUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to process photo file.";
      setPhotoError(msg);
      toast.error("Photo upload failed", { description: msg });
    } finally {
      setPhotoProcessing(false);
      e.target.value = "";
    }
  }

  function handleConfirmCrop(croppedDataUrl: string) {
    setAvatarUrl(croppedDataUrl);
    setCropModalSource(null);
    toast.success("Profile photo ready", {
      description: "Your picture will be saved with your account setup.",
    });
  }

  function handleContinueFromPhoto(e: FormEvent) {
    e.preventDefault();
    playInterstitialThen("outro-photo", "recovery", 1800);
  }

  async function handleRecoverySubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!step3Valid) {
      if (!resolvedQuestion) {
        setErrorMessage("Please select or specify a security question.");
      } else if (answer.trim().length < 2) {
        setErrorMessage("Answer must be at least 2 characters.");
      } else if (!answersMatch) {
        setErrorMessage("Security answers do not match.");
      }
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "initial-setup",
          newPassword,
          confirmPassword,
          question: resolvedQuestion,
          answer: answer.trim(),
          confirmAnswer: confirmAnswer.trim(),
          avatarUrl: avatarUrl || null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        backupKey?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message ?? "Unable to complete initial setup.");
      }

      // Persist avatar locally and broadcast update
      if (avatarUrl) {
        try {
          window.localStorage.setItem(getProfileStorageKey(actor.id), avatarUrl);
          window.dispatchEvent(
            new CustomEvent(PROFILE_PHOTO_EVENT, {
              detail: { avatarUrl, userId: actor.id },
            }),
          );
        } catch {
          // Ignore localStorage errors
        }
      }

      if (payload.backupKey) {
        setBackupKey(payload.backupKey.replace(/^ROUTEX-/i, ""));
      }

      setSubmitting(false);
      playInterstitialThen("outro-recovery", "backup-key", 1850);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Setup submission failed.");
      setSubmitting(false);
    }
  }

  async function handleCopyBackupKey() {
    if (!backupKey) return;
    try {
      await navigator.clipboard.writeText(backupKey);
      setKeyCopied(true);
      setKeyConfirmedSaved(true);
      toast.success("Backup key copied", {
        description: "Paste and store it in a safe place.",
      });
      setTimeout(() => setKeyCopied(false), 3000);
    } catch {
      toast.error("Unable to copy automatically. Please select and copy the key manually.");
    }
  }

  function handleDownloadBackupKey() {
    if (!backupKey) return;
    const content = [
      "EMERGENCY ACCOUNT RECOVERY KEY",
      "==========================================",
      "",
      `Account: @${actor.username}${actor.fullName ? ` (${actor.fullName})` : ""}`,
      `Generated: ${new Date().toLocaleString()}`,
      "",
      `Recovery Key: ${backupKey}`,
      "",
      "IMPORTANT:",
      "- Keep this key in a safe, private location.",
      "- Do not share this key with anyone.",
      "- This key is single-use. Once used to recover your account, a new one will be issued.",
      "- If you ever misplace this key, you can generate a replacement from your account settings.",
      "",
    ].join("\r\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `emergency-backup-key-${actor.username}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setKeyDownloaded(true);
    setKeyConfirmedSaved(true);
    toast.success("Backup key downloaded", {
      description: `Saved as emergency-backup-key-${actor.username}.txt`,
    });
  }

  function handleFinishSetup(e: FormEvent) {
    e.preventDefault();
    if (!keyConfirmedSaved) return;

    clearAllTimers();
    setTransitionPhase("blur-out");

    scheduleTimer(() => {
      setPhase("outro-complete");
      setTransitionPhase("blur-in");

      scheduleTimer(() => {
        setTransitionPhase("idle");
      }, 700);

      scheduleTimer(() => {
        setIsExiting(true);
      }, 2200);

      scheduleTimer(() => {
        router.push("/dashboard");
        router.refresh();
      }, 3050);
    }, 450);
  }

  const isInterstitial =
    phase === "intro" ||
    phase === "outro-password" ||
    phase === "outro-photo" ||
    phase === "outro-recovery" ||
    phase === "outro-complete";

  return (
    <div className={`native-setup-canvas ${isExiting ? "native-setup-exiting-dashboard" : ""}`}>
      {/* Living Breathing Gemini-Style Ambient Gradient Aurora */}
      <div className="setup-gemini-mesh" aria-hidden="true">
        <div className="setup-gemini-orb orb-primary" />
        <div className="setup-gemini-orb orb-secondary" />
        <div className="setup-gemini-orb orb-accent" />
        <div className="setup-gemini-orb orb-subtle" />
      </div>

      {/* Main Centered Stage with Silky Blur-Fade Transition */}
      <main
        className={`native-setup-stage ${isInterstitial ? "is-interstitial" : ""} native-setup-transition-${transitionPhase}`}
      >
        {/* ========================================================================= */}
        {/* INTERSTITIAL 1: WELCOME */}
        {/* ========================================================================= */}
        {phase === "intro" ? (
          <div key="phase-intro" className="native-setup-interstitial">
            <h1 className="interstitial-sentence setup-stagger setup-stagger-1">
              Welcome, <span className="interstitial-highlight">{firstName}</span>.
            </h1>
          </div>
        ) : null}

        {/* ========================================================================= */}
        {/* STAGE 1: PERMANENT PASSWORD */}
        {/* ========================================================================= */}
        {phase === "password" ? (
          <div key="phase-password" className="native-setup-content-block">
            <div className="native-setup-header">
              <h1 className="native-setup-hero-title setup-stagger setup-stagger-1">
                Let&apos;s get you set up.
              </h1>
              <p className="native-setup-hero-subtitle setup-stagger setup-stagger-2">
                Start by creating a private password that&apos;s completely yours.
              </p>
            </div>

            <form className="native-setup-form-panel" onSubmit={handleContinueFromPassword} noValidate>
              {errorMessage ? (
                <div className="native-setup-alert setup-stagger setup-stagger-2" role="alert">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{errorMessage}</span>
                </div>
              ) : null}

              <div className="native-setup-field-group setup-stagger setup-stagger-3">
                <label htmlFor="new-password">New Password</label>
                <div className="native-setup-input-wrap">
                  <input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter at least 8 characters..."
                    autoComplete="new-password"
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    className="native-setup-toggle-pw"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                <PasswordCriteriaList password={newPassword} />
              </div>

              <div className="native-setup-field-group setup-stagger setup-stagger-4">
                <label htmlFor="confirm-password">Confirm Password</label>
                <div className="native-setup-input-wrap">
                  <input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your new password..."
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="native-setup-toggle-pw"
                    onClick={() => setShowConfirm((prev) => !prev)}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                  >
                    {showConfirm ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {confirmPassword.length > 0 && !passwordsMatch ? (
                  <span className="native-setup-field-hint error">Passwords do not match</span>
                ) : null}
                {passwordsMatch && pwdValidation.isValid ? (
                  <span className="native-setup-field-hint success" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Passwords match
                  </span>
                ) : null}
              </div>

              <div className="native-setup-actions single setup-stagger setup-stagger-5">
                <button
                  type="submit"
                  className="native-setup-primary-btn"
                  disabled={!step1Valid}
                >
                  <span>Continue</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {/* ========================================================================= */}
        {/* INTERSTITIAL 2: AFTER PASSWORD */}
        {/* ========================================================================= */}
        {phase === "outro-password" ? (
          <div key="phase-outro-password" className="native-setup-interstitial">
            <h1 className="interstitial-sentence setup-stagger setup-stagger-1">
              Take care of your new password.
            </h1>
          </div>
        ) : null}

        {/* ========================================================================= */}
        {/* STAGE 2: PROFILE PHOTO SETUP */}
        {/* ========================================================================= */}
        {phase === "photo" ? (
          <div key="phase-photo" className="native-setup-content-block">
            <div className="native-setup-header">
              <h1 className="native-setup-hero-title setup-stagger setup-stagger-1">
                Put a face to your name.
              </h1>
              <p className="native-setup-hero-subtitle setup-stagger setup-stagger-2">
                Add a profile photo so your team can easily recognize you. You can always change this later.
              </p>
            </div>

            <form className="native-setup-form-panel" onSubmit={handleContinueFromPhoto}>
              {photoError ? (
                <div className="native-setup-alert setup-stagger setup-stagger-2" role="alert">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{photoError}</span>
                </div>
              ) : null}

              <div className="native-setup-avatar-card setup-stagger setup-stagger-3">
                <div className="native-setup-avatar-well">
                  <div className="native-setup-avatar-ring">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={actor.fullName || actor.username}
                        className="native-setup-avatar-img"
                      />
                    ) : (
                      <div className="native-setup-avatar-initials">
                        <span>{initials}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="native-setup-avatar-actions">
                  <input
                    id="setup-profile-photo-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="visually-hidden"
                    onChange={handlePhotoFileChange}
                    disabled={photoProcessing}
                  />

                  <label
                    htmlFor="setup-profile-photo-input"
                    className="native-setup-primary-btn"
                    style={{ cursor: "pointer", height: "44px", padding: "0 22px", fontSize: "13.5px" }}
                  >
                    {photoProcessing
                      ? "Processing..."
                      : avatarUrl
                        ? "Change Photo"
                        : "Upload Photo"}
                  </label>

                  {avatarUrl ? (
                    <>
                      <button
                        type="button"
                        className="native-setup-back-btn"
                        onClick={() => setCropModalSource(rawPhotoSource || avatarUrl)}
                        style={{ padding: "0 16px", height: "44px", fontSize: "13.5px" }}
                      >
                        Crop & Move
                      </button>
                      <button
                        type="button"
                        className="native-setup-back-btn"
                        onClick={() => {
                          setAvatarUrl(null);
                          setRawPhotoSource(null);
                        }}
                        style={{ padding: "0 16px", height: "44px", fontSize: "13.5px" }}
                      >
                        Remove
                      </button>
                    </>
                  ) : null}
                </div>

                <p className="native-setup-avatar-hint">
                  JPG, PNG, or WebP up to 5MB. Drag to reposition or use the edges to crop.
                </p>
              </div>

              <div className="native-setup-actions dual setup-stagger setup-stagger-4">
                <button
                  type="button"
                  className="native-setup-back-btn"
                  onClick={() => transitionToPhase("password")}
                  disabled={photoProcessing}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                  <span>Back</span>
                </button>

                <button
                  type="submit"
                  className="native-setup-primary-btn"
                  disabled={photoProcessing}
                >
                  <span>{avatarUrl ? "Continue" : "Skip for now"}</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {/* ========================================================================= */}
        {/* INTERSTITIAL 3: AFTER PHOTO */}
        {/* ========================================================================= */}
        {phase === "outro-photo" ? (
          <div key="phase-outro-photo" className="native-setup-interstitial">
            <h1 className="interstitial-sentence setup-stagger setup-stagger-1">
              {avatarUrl ? (
                <>
                  Looking good, <span className="interstitial-highlight">{firstName}</span>.
                </>
              ) : (
                "No problem — you can add one anytime."
              )}
            </h1>
          </div>
        ) : null}

        {/* ========================================================================= */}
        {/* STAGE 3: ACCOUNT RECOVERY QUESTION */}
        {/* ========================================================================= */}
        {phase === "recovery" ? (
          <div key="phase-recovery" className="native-setup-content-block">
            <div className="native-setup-header">
              <h1 className="native-setup-hero-title setup-stagger setup-stagger-1">
                A safety net, just in case.
              </h1>
              <p className="native-setup-hero-subtitle setup-stagger setup-stagger-2">
                Pick a question only you know the answer to, so you can recover your account anytime.
              </p>
            </div>

            <form className="native-setup-form-panel" onSubmit={handleRecoverySubmit} noValidate>
              {errorMessage ? (
                <div className="native-setup-alert setup-stagger setup-stagger-2" role="alert">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{errorMessage}</span>
                </div>
              ) : null}

              <div className="native-setup-field-group setup-stagger setup-stagger-3">
                <label>Security Question</label>
                <RoundedSelect
                  value={isCustomQuestion ? "custom" : question}
                  ariaLabel="Select security question"
                  options={[
                    ...PREDEFINED_SECURITY_QUESTIONS.map((q) => ({
                      value: q,
                      label: q,
                    })),
                    {
                      value: "custom",
                      label: "Write my own custom question...",
                    },
                  ]}
                  onChange={(val) => {
                    if (val === "custom") {
                      setIsCustomQuestion(true);
                    } else {
                      setIsCustomQuestion(false);
                      setQuestion(val);
                    }
                  }}
                />
              </div>

              {isCustomQuestion ? (
                <div className="native-setup-field-group setup-stagger setup-stagger-3">
                  <label htmlFor="custom-question-input">Custom Security Question</label>
                  <input
                    id="custom-question-input"
                    type="text"
                    className="native-setup-text-input"
                    placeholder="e.g., What was the name of my first pet?"
                    value={customQuestionText}
                    onChange={(e) => setCustomQuestionText(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              ) : null}

              <div className="native-setup-field-group setup-stagger setup-stagger-4">
                <label htmlFor="sec-answer">Secret Answer</label>
                <input
                  id="sec-answer"
                  type="text"
                  className="native-setup-text-input"
                  placeholder="Enter your answer..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  autoComplete="off"
                  required
                />
              </div>

              <div className="native-setup-field-group setup-stagger setup-stagger-4">
                <label htmlFor="sec-answer-confirm">Confirm Secret Answer</label>
                <input
                  id="sec-answer-confirm"
                  type="text"
                  className="native-setup-text-input"
                  placeholder="Confirm your answer..."
                  value={confirmAnswer}
                  onChange={(e) => setConfirmAnswer(e.target.value)}
                  autoComplete="off"
                  required
                />
                {confirmAnswer.length > 0 && !answersMatch ? (
                  <span className="native-setup-field-hint error">Answers do not match</span>
                ) : null}
                {answersMatch ? (
                  <span className="native-setup-field-hint success" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Answers match
                  </span>
                ) : null}
              </div>

              <div className="native-setup-actions dual setup-stagger setup-stagger-5">
                <button
                  type="button"
                  className="native-setup-back-btn"
                  onClick={() => transitionToPhase("photo")}
                  disabled={submitting}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                  <span>Back</span>
                </button>

                <button
                  type="submit"
                  className="native-setup-primary-btn"
                  disabled={!step3Valid || submitting}
                >
                  <span>{submitting ? "Saving..." : "Continue"}</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {/* ========================================================================= */}
        {/* INTERSTITIAL 4: BEFORE BACKUP KEY */}
        {/* ========================================================================= */}
        {phase === "outro-recovery" ? (
          <div key="phase-outro-recovery" className="native-setup-interstitial">
            <h1 className="interstitial-sentence setup-stagger setup-stagger-1">
              One last thing before we begin.
            </h1>
          </div>
        ) : null}

        {/* ========================================================================= */}
        {/* STAGE 4: EMERGENCY BACKUP KEY SAVE */}
        {/* ========================================================================= */}
        {phase === "backup-key" ? (
          <div key="phase-backup-key" className="native-setup-content-block">
            <div className="native-setup-header">
              <h1 className="native-setup-hero-title setup-stagger setup-stagger-1">
                Save your emergency backup key.
              </h1>
              <p className="native-setup-hero-subtitle setup-stagger setup-stagger-2">
                This single-use key is your ultimate fallback if you ever forget both your password and security answer.
              </p>
            </div>

            <form className="native-setup-form-panel" onSubmit={handleFinishSetup}>
              {/* High-Emphasis Warning Banner */}
              <div className="native-setup-backup-warning setup-stagger setup-stagger-3" role="note">
                <div className="backup-warning-icon" aria-hidden="true">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div className="backup-warning-text">
                  <strong>Please do not lose this key.</strong>
                  <p>
                    Write it down or download a copy right now — once you leave this screen, it will never be shown again. If you ever misplace it, you can generate a new one later from your account settings.
                  </p>
                </div>
              </div>

              {/* Neumorphic Backup Key Vault Display */}
              <div className="native-setup-backup-vault setup-stagger setup-stagger-4">
                <span className="backup-vault-label">Your Personal Recovery Key</span>
                <div className="backup-vault-code" aria-label="Emergency backup key">
                  {backupKey || "XXXX-XXXX-XXXX-XXXX"}
                </div>

                <div className="backup-vault-actions">
                  <button
                    type="button"
                    className={`native-setup-vault-btn ${keyCopied ? "active" : ""}`}
                    onClick={handleCopyBackupKey}
                  >
                    {keyCopied ? (
                      <>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Copied to Clipboard</span>
                      </>
                    ) : (
                      <>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        <span>Copy Key</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className={`native-setup-vault-btn ${keyDownloaded ? "active" : ""}`}
                    onClick={handleDownloadBackupKey}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>{keyDownloaded ? "Downloaded .txt" : "Download .txt"}</span>
                  </button>
                </div>
              </div>

              {/* Acknowledgement Checkbox */}
              <label className="native-setup-confirm-check setup-stagger setup-stagger-5">
                <input
                  type="checkbox"
                  checked={keyConfirmedSaved}
                  onChange={(e) => setKeyConfirmedSaved(e.target.checked)}
                />
                <span className="confirm-check-box" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <span className="confirm-check-label">
                  I have saved my emergency backup key in a safe place and understand I cannot view it again.
                </span>
              </label>

              <div className="native-setup-actions single setup-stagger setup-stagger-5">
                <button
                  type="submit"
                  className="native-setup-primary-btn"
                  disabled={!keyConfirmedSaved}
                >
                  <span>Finish Setup</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {/* ========================================================================= */}
        {/* INTERSTITIAL 5: FINAL LAUNCH */}
        {/* ========================================================================= */}
        {phase === "outro-complete" ? (
          <div key="phase-outro-complete" className="native-setup-interstitial">
            <h1 className="interstitial-sentence setup-stagger setup-stagger-1">
              You&apos;re all set, <span className="interstitial-highlight">{firstName}</span>.
            </h1>
            <p className="interstitial-subcaption setup-stagger setup-stagger-2">
              Entering your workspace...
            </p>
          </div>
        ) : null}
      </main>

      <ProfilePhotoCropperModal
        imageSrc={cropModalSource}
        onCancel={() => setCropModalSource(null)}
        onConfirm={handleConfirmCrop}
      />
    </div>
  );
}
