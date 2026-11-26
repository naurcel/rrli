"use client";

import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
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
  resizeProfilePhotoFile,
  getProfileStorageKey,
  PROFILE_PHOTO_EVENT,
} from "@/components/profile-photo";

interface ActorInfo {
  id: string;
  username: string;
  fullName?: string | null;
  role: string;
}

export function InitialSetupSoloWizard({ actor }: { actor: ActorInfo }) {
  const router = useRouter();

  // Active step state & smooth blur-fade transition phase
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [transitionPhase, setTransitionPhase] = useState<"idle" | "blur-out" | "blur-in">("blur-in");
  const [isExiting, setIsExiting] = useState(false);

  // Step 1: Password fields
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Step 2: Profile Photo
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Step 3: Recovery Question fields
  const [question, setQuestion] = useState<string>(PREDEFINED_SECURITY_QUESTIONS[0]);
  const [isCustomQuestion, setIsCustomQuestion] = useState(false);
  const [customQuestionText, setCustomQuestionText] = useState("");
  const [answer, setAnswer] = useState("");
  const [confirmAnswer, setConfirmAnswer] = useState("");

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

  // Initial mount smooth entrance
  useEffect(() => {
    const timer = setTimeout(() => {
      setTransitionPhase("idle");
    }, 650);
    return () => clearTimeout(timer);
  }, []);

  // Smooth, deliberate blur-fade transition between steps
  function navigateToStep(nextStep: 1 | 2 | 3 | 4) {
    if (nextStep === step) return;
    setErrorMessage(null);
    setTransitionPhase("blur-out");

    setTimeout(() => {
      setStep(nextStep);
      setTransitionPhase("blur-in");
      setTimeout(() => {
        setTransitionPhase("idle");
      }, 600);
    }, 380);
  }

  function handleContinueToPhotoStep(e: FormEvent) {
    e.preventDefault();
    if (!step1Valid) {
      if (!pwdValidation.isValid) {
        setErrorMessage(pwdValidation.errors[0] || "Password does not meet all security criteria.");
      } else if (!passwordsMatch) {
        setErrorMessage("Passwords do not match.");
      }
      return;
    }
    navigateToStep(2);
  }

  async function handlePhotoFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError(null);
    setPhotoProcessing(true);
    try {
      const dataUrl = await resizeProfilePhotoFile(file, 320);
      setAvatarUrl(dataUrl);
      toast.success("Profile photo ready", {
        description: "Your picture will be saved with your account setup.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to process photo file.";
      setPhotoError(msg);
      toast.error("Photo upload failed", { description: msg });
    } finally {
      setPhotoProcessing(false);
    }
  }

  function handleContinueToRecovery(e: FormEvent) {
    e.preventDefault();
    navigateToStep(3);
  }

  async function handleFinalSubmit(e: FormEvent) {
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

      // Smooth transition into step 4 (celebration)
      setTransitionPhase("blur-out");
      setTimeout(() => {
        setStep(4);
        setTransitionPhase("blur-in");
        toast.success("Account setup complete!", {
          description: "Your credentials and profile are active.",
        });

        // Deliberate, relaxed timing before entering dashboard
        setTimeout(() => {
          setIsExiting(true);
        }, 2200);

        setTimeout(() => {
          router.push("/dashboard");
          router.refresh();
        }, 3000);
      }, 400);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Setup submission failed.");
      setSubmitting(false);
    }
  }

  return (
    <div className={`native-setup-canvas ${isExiting ? "native-setup-exiting-dashboard" : ""}`}>
      {/* Living Breathing Gemini-Style Gradient Aurora Mesh */}
      <div className="setup-gemini-mesh" aria-hidden="true">
        <div className="setup-gemini-orb orb-primary" />
        <div className="setup-gemini-orb orb-secondary" />
        <div className="setup-gemini-orb orb-accent" />
        <div className="setup-gemini-orb orb-subtle" />
      </div>

      {/* Main Centered Stage with Silky Blur-Fade Transition */}
      <main className={`native-setup-stage native-setup-transition-${transitionPhase}`}>
        {/* ========================================================================= */}
        {/* STEP 1: PERMANENT PASSWORD */}
        {/* ========================================================================= */}
        {step === 1 ? (
          <div key="native-step-1" className="native-setup-content-block">
            <div className="native-setup-header">
              <span className="native-setup-personal-pill">Welcome to RouteX</span>
              <h1 className="native-setup-hero-title">Welcome, {firstName}.</h1>
              <p className="native-setup-hero-subtitle">
                Let&apos;s take a moment to make this space feel like yours. First, create a permanent password only you know.
              </p>
            </div>

            <form className="native-setup-form-panel" onSubmit={handleContinueToPhotoStep} noValidate>
              {errorMessage ? (
                <div className="native-setup-alert" role="alert">
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

              <div className="native-setup-field-group">
                <label htmlFor="new-password">New Permanent Password</label>
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
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                    <span>{showPassword ? "Hide" : "Show"}</span>
                  </button>
                </div>
                <PasswordCriteriaList password={newPassword} />
              </div>

              <div className="native-setup-field-group">
                <label htmlFor="confirm-password">Confirm Permanent Password</label>
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
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                    <span>{showConfirm ? "Hide" : "Show"}</span>
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

              <div className="native-setup-actions single">
                <button
                  type="submit"
                  className="native-setup-primary-btn"
                  disabled={!step1Valid}
                >
                  <span>Continue to Profile Photo</span>
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
        {/* STEP 2: PROFILE PHOTO SETUP */}
        {/* ========================================================================= */}
        {step === 2 ? (
          <div key="native-step-2" className="native-setup-content-block">
            <div className="native-setup-header">
              <span className="native-setup-personal-pill">Profile & Presence</span>
              <h1 className="native-setup-hero-title">Looking good, {firstName}.</h1>
              <p className="native-setup-hero-subtitle">
                Put a face to your name so your team knows who&apos;s behind the wheel. You can always change this later.
              </p>
            </div>

            <form className="native-setup-form-panel" onSubmit={handleContinueToRecovery}>
              {photoError ? (
                <div className="native-setup-alert" role="alert">
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

              <div className="native-setup-avatar-card">
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
                    <button
                      type="button"
                      className="native-setup-back-btn"
                      onClick={() => setAvatarUrl(null)}
                      style={{ padding: "0 18px", height: "44px", fontSize: "13.5px" }}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                <p className="native-setup-avatar-hint">
                  JPG, PNG, or WebP up to 5MB. Photo is automatically centered and cropped.
                </p>
              </div>

              <div className="native-setup-actions dual">
                <button
                  type="button"
                  className="native-setup-back-btn"
                  onClick={() => navigateToStep(1)}
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
                  <span>{avatarUrl ? "Continue with Photo" : "Skip for now"}</span>
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
        {/* STEP 3: ACCOUNT RECOVERY QUESTION */}
        {/* ========================================================================= */}
        {step === 3 ? (
          <div key="native-step-3" className="native-setup-content-block">
            <div className="native-setup-header">
              <span className="native-setup-personal-pill">Account Recovery</span>
              <h1 className="native-setup-hero-title">Just between us.</h1>
              <p className="native-setup-hero-subtitle">
                Set a safety question you&apos;ll easily remember. If you ever forget your password, you can reset it on your own without waiting for an administrator.
              </p>
            </div>

            <form className="native-setup-form-panel" onSubmit={handleFinalSubmit} noValidate>
              {errorMessage ? (
                <div className="native-setup-alert" role="alert">
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

              <div className="native-setup-field-group">
                <label>Select Security Question</label>
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
                <div className="native-setup-field-group">
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

              <div className="native-setup-field-group">
                <label htmlFor="sec-answer">Your Secret Answer</label>
                <input
                  id="sec-answer"
                  type="text"
                  className="native-setup-text-input"
                  placeholder="Enter your confidential answer..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  autoComplete="off"
                  required
                />
              </div>

              <div className="native-setup-field-group">
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

              <div className="native-setup-actions dual">
                <button
                  type="button"
                  className="native-setup-back-btn"
                  onClick={() => navigateToStep(2)}
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
                  <span>{submitting ? "Securing Workspace..." : "Complete Setup & Launch"}</span>
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
        {/* STEP 4: CELEBRATION / WORKSPACE ACTIVATION */}
        {/* ========================================================================= */}
        {step === 4 ? (
          <div key="native-step-4" className="native-complete-viewport">
            <div className="native-complete-halo" aria-hidden="true">
              <svg
                width="38"
                height="38"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="native-setup-hero-title">You&apos;re all set, {firstName}.</h1>
            <p className="native-setup-hero-subtitle">
              Your credentials and personal settings are verified. Taking you to your RouteX command center...
            </p>
            <div className="native-progress-track" aria-hidden="true">
              <div className="native-progress-bar-fill" />
            </div>
            <span className="native-launching-text">Preparing your workspace...</span>
          </div>
        ) : null}
      </main>

      <footer style={{ height: "20px" }} aria-hidden="true" />
    </div>
  );
}
