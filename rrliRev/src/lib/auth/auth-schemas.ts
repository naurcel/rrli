import * as z from "zod";
import { USER_ROLES } from "./rbac.ts";

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address.")
    .email("Enter a valid email address."),
  password: z
    .string()
    .min(1, "Enter your password."),
  rememberMe: z.boolean().optional().default(false),
});

export type SignInInput = z.infer<typeof signInSchema>;

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter the email address associated with your RouteX account.")
    .email("Enter a valid email address."),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const createUserAccountSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter an email address.")
    .email("Enter a valid email address."),
  fullName: z
    .string()
    .trim()
    .min(2, "Enter the staff member's full name.")
    .max(100, "Full name must be 100 characters or fewer."),
  role: z.enum(USER_ROLES, {
    error: "Select a valid RouteX access role.",
  }),
  password: z
    .string()
    .min(8, "Initial password must be at least 8 characters."),
});

export const updateUserRoleSchema = z.object({
  userId: z.string().trim().min(1, "User ID is required."),
  role: z.enum(USER_ROLES).optional(),
  isActive: z.boolean().optional(),
});

