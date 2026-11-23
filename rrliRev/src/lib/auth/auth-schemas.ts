import * as z from "zod";
import { USER_ROLES } from "./rbac";

export const signInSchema = z.object({
  email: z.string().trim().min(1, "Enter your email or username.").optional(),
  username: z.string().trim().min(1, "Enter your username or email.").optional(),
  password: z.string().min(1, "Enter your password."),
  rememberMe: z.boolean().optional().default(false),
}).refine((data) => Boolean(data.email || data.username), {
  message: "Enter your email or username.",
  path: ["email"],
});

export type SignInInput = z.infer<typeof signInSchema>;

export const checkRecoveryUserSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .email("Enter a valid email address.")
    .or(z.string().trim().min(1, "Enter your username or email.")),
  username: z.string().trim().optional(),
});

export const verifySecurityAnswerSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .optional(),
  username: z.string().trim().optional(),
  answer: z
    .string()
    .trim()
    .min(1, "Enter your security answer."),
});

export const resetPasswordWithTokenSchema = z.object({
  email: z.string().trim().optional(),
  username: z.string().trim().optional(),
  token: z.string().trim().min(1, "Recovery token is required."),
  mode: z.enum(["admin", "security_question", "backup_key"]),
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string().min(1, "Confirm your new password."),
});

export const verifyBackupKeySchema = z.object({
  email: z.string().trim().optional(),
  username: z.string().trim().optional(),
  backupKey: z.string().trim().min(6, "Enter your emergency backup key."),
});

export const generateBackupKeySchema = z.object({
  currentPassword: z.string().min(1, "Current password is required to generate a backup key."),
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
  avatarUrl: z.string().trim().optional().nullable(),
});

export const createUserAccountSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address."),
  fullName: z
    .string()
    .trim()
    .min(2, "Enter the staff member's full name.")
    .max(100, "Full name must be 100 characters or fewer."),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .max(30, "Username cannot exceed 30 characters.")
    .optional(),
  role: z.enum(USER_ROLES, {
    error: "Select a valid RouteX access role.",
  }).optional().default("customer_representative"),
  roles: z.array(z.string().trim().min(1)).min(1, "Assign at least one role.").optional(),
  designation: z.string().trim().max(100).optional(),
  temporaryPassword: z
    .string()
    .min(8, "Temporary password must be at least 8 characters.")
    .optional(),
  confirmTemporaryPassword: z.string().optional(),
  phoneNumber: z
    .string()
    .trim()
    .max(25, "Phone number cannot exceed 25 characters.")
    .optional(),
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
