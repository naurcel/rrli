import * as z from "zod";
import { USER_ROLES } from "./rbac";

export const signInSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Enter your username."),
  password: z
    .string()
    .min(1, "Enter your password."),
  rememberMe: z.boolean().optional().default(false),
});

export type SignInInput = z.infer<typeof signInSchema>;

export const checkRecoveryUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Enter your username."),
});

export const verifySecurityAnswerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Enter your username."),
  answer: z
    .string()
    .trim()
    .min(1, "Enter your security answer."),
});

export const resetPasswordWithTokenSchema = z.object({
  username: z.string().trim().min(1, "Username is required."),
  token: z.string().trim().min(1, "Recovery token is required."),
  mode: z.enum(["admin", "security_question"]),
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string().min(1, "Confirm your new password."),
});

export const changeUsernameSchema = z.object({
  newUsername: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .max(30, "Username cannot exceed 30 characters."),
  currentPassword: z.string().min(1, "Enter your current password."),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: z.string().min(8, "New password must be at least 8 characters."),
  confirmPassword: z.string().min(1, "Confirm your new password."),
});

export const changeSecurityQuestionSchema = z.object({
  question: z.string().trim().min(1, "Select or enter a security question."),
  answer: z.string().trim().min(2, "Security answer must be at least 2 characters."),
  confirmAnswer: z.string().trim().min(1, "Confirm your security answer."),
  currentPassword: z.string().min(1, "Enter your current password."),
});

export const initialSetupSchema = z.object({
  newPassword: z.string().min(8, "New password must be at least 8 characters."),
  confirmPassword: z.string().min(1, "Confirm your new password."),
  question: z.string().trim().min(1, "Select or enter a security question."),
  answer: z.string().trim().min(2, "Security answer must be at least 2 characters."),
  confirmAnswer: z.string().trim().min(1, "Confirm your security answer."),
});

export const createUserAccountSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .max(30, "Username cannot exceed 30 characters."),
  fullName: z
    .string()
    .trim()
    .min(2, "Enter the staff member's full name.")
    .max(100, "Full name must be 100 characters or fewer."),
  role: z.enum(USER_ROLES, {
    error: "Select a valid RouteX access role.",
  }),
  temporaryPassword: z
    .string()
    .min(8, "Temporary password must be at least 8 characters."),
  confirmTemporaryPassword: z.string().optional(),
  email: z.string().trim().email("Please enter a valid email address."),
  phoneNumber: z
    .string()
    .trim()
    .min(7, "Phone number must be at least 7 digits.")
    .max(25, "Phone number cannot exceed 25 characters."),
});

export const updateContactInfoSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
  phoneNumber: z
    .string()
    .trim()
    .min(7, "Phone number must be at least 7 digits.")
    .max(25, "Phone number cannot exceed 25 characters."),
  currentPassword: z.string().min(1, "Enter your current password."),
});

export const adminUpdateContactSchema = z.object({
  userId: z.string().trim().min(1, "User ID is required."),
  email: z.string().trim().email("Please enter a valid email address."),
  phoneNumber: z
    .string()
    .trim()
    .min(7, "Phone number must be at least 7 digits.")
    .max(25, "Phone number cannot exceed 25 characters."),
});

export const updateUserRoleSchema = z.object({
  userId: z.string().trim().min(1, "User ID is required."),
  role: z.enum(USER_ROLES).optional(),
  isActive: z.boolean().optional(),
});

export const adminUpdateUsernameSchema = z.object({
  userId: z.string().trim().min(1, "User ID is required."),
  newUsername: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .max(30, "Username cannot exceed 30 characters."),
});

export const authorizeResetSchema = z.object({
  userId: z.string().trim().min(1, "User ID is required."),
});
