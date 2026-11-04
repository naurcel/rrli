/**
 * RouteX Authentication & Credential Policies
 *
 * Implements simplified, robust password requirements:
 * - Minimum 8 characters, maximum 128 characters
 * - At least one letter (a-zA-Z)
 * - At least one number (0-9)
 * - Special characters and uppercase/lowercase combinations are optional
 * - Reject commonly used or easily guessed passwords
 * - Passwords must not consist entirely of whitespace
 */

export const PREDEFINED_SECURITY_QUESTIONS = [
  "What was the name of your first school?",
  "What was the name of your first pet?",
  "What city were you born in?",
  "What was your childhood nickname?",
] as const;

export type SecurityQuestionOption = (typeof PREDEFINED_SECURITY_QUESTIONS)[number];

const COMMONLY_GUESSED_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty123",
  "admin123",
  "admin2026",
  "routex123",
  "routex2026",
  "welcome1",
  "welcome123",
  "letmein1",
  "changeme1",
  "default1",
  "operator1",
  "operations1",
  "financial1",
]);

export type PasswordCriteriaChecks = {
  minLength: boolean;
  maxLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  notWhitespaceOnly: boolean;
  notCommon: boolean;
};

export type PasswordValidationResult = {
  isValid: boolean;
  checks: PasswordCriteriaChecks;
  errors: string[];
};

export function evaluatePasswordCriteria(password: string): PasswordValidationResult {
  const p = typeof password === "string" ? password : "";

  const minLength = p.length >= 8;
  const maxLength = p.length <= 128;
  const hasLetter = /[a-zA-Z]/.test(p);
  const hasNumber = /[0-9]/.test(p);
  const notWhitespaceOnly = p.trim().length > 0;
  const notCommon = !COMMONLY_GUESSED_PASSWORDS.has(p.trim().toLowerCase());

  const checks: PasswordCriteriaChecks = {
    minLength,
    maxLength,
    hasLetter,
    hasNumber,
    notWhitespaceOnly,
    notCommon,
  };

  const errors: string[] = [];
  if (!minLength) {
    errors.push("Password must be at least 8 characters long.");
  }
  if (!maxLength) {
    errors.push("Password cannot exceed 128 characters.");
  }
  if (!hasLetter) {
    errors.push("Password must contain at least one letter.");
  }
  if (!hasNumber) {
    errors.push("Password must contain at least one number.");
  }
  if (!notWhitespaceOnly) {
    errors.push("Password cannot consist entirely of whitespace.");
  }
  if (!notCommon) {
    errors.push("This password is too common or easily guessed. Choose a more secure password.");
  }

  const isValid =
    minLength &&
    maxLength &&
    hasLetter &&
    hasNumber &&
    notWhitespaceOnly &&
    notCommon;

  return { isValid, checks, errors };
}

/**
 * Validates RouteX username requirements:
 * - 3 to 30 characters
 * - Starts with a letter or digit
 * - May contain letters, numbers, underscores, dots, or hyphens
 * - No spaces
 */
export function validateUsernameFormat(username: string): {
  isValid: boolean;
  message?: string;
  normalized: string;
} {
  const trimmed = typeof username === "string" ? username.trim() : "";
  const normalized = trimmed.toLowerCase();

  if (trimmed.length < 3) {
    return { isValid: false, message: "Username must be at least 3 characters long.", normalized };
  }
  if (trimmed.length > 30) {
    return { isValid: false, message: "Username cannot exceed 30 characters.", normalized };
  }
  if (!/^[a-zA-Z0-9]/.test(trimmed)) {
    return { isValid: false, message: "Username must start with a letter or number.", normalized };
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
    return { isValid: false, message: "Username can only contain letters, numbers, underscores, dots, and hyphens.", normalized };
  }

  return { isValid: true, normalized };
}

/**
 * Normalizes security answer:
 * - Case-sensitive
 * - Trims accidental leading/trailing whitespace
 * - Does NOT lowercase
 */
export function normalizeSecurityAnswer(answer: string): string {
  if (typeof answer !== "string") return "";
  return answer.trim();
}

