import { NextResponse } from "next/server";
import * as z from "zod";

import {
  COMPANY_FOUNDATION_DATE,
  type ValidatedCompanyExpense,
} from "@/features/finance/company-expense-domain";
import { batchCreateCompanyExpenses } from "@/features/finance/server/company-expense-repository";
import { verifyServerPermission } from "@/lib/auth/server-session";

const importExpenseRowSchema = z.object({
  expenseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Valid YYYY-MM-DD date required.")
    .refine(
      (d) => d >= COMPANY_FOUNDATION_DATE,
      `Expense date cannot precede company foundation (${COMPANY_FOUNDATION_DATE}).`,
    ),
  description: z
    .string()
    .trim()
    .default("Total Company Expenses")
    .transform((d) => d || "Total Company Expenses"),
  amount: z
    .number()
    .positive("Amount must be greater than zero."),
  category: z.string().trim().default("General"),
  notes: z.string().trim().nullable().optional(),
  transactionType: z.enum(["Incoming", "Outgoing"]).default("Outgoing"),
  sourceSheet: z.string().trim().nullable().optional(),
  sourceRow: z.number().nullable().optional(),
  sourceRef: z.string().trim().nullable().optional(),
});

const batchImportExpenseSchema = z.object({
  batchName: z.string().trim().min(3, "Batch name is required."),
  idempotencyKey: z.string().uuid("Idempotency key must be a valid UUID."),
  rows: z.array(importExpenseRowSchema).min(1, "At least one expense row is required."),
});

// Cache for idempotency keys (in-memory for local / server preview mode)
const processedIdempotencyKeys = new Set<string>();

export async function POST(request: Request) {
  const auth = await verifyServerPermission("finance:manage");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  const parsed = batchImportExpenseSchema.safeParse(body);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    return NextResponse.json(
      { ok: false, message: `Validation failed: ${errorDetails}`, errors: parsed.error.issues },
      { status: 422 },
    );
  }

  const { batchName, idempotencyKey, rows } = parsed.data;

  if (processedIdempotencyKeys.has(idempotencyKey)) {
    return NextResponse.json(
      {
        ok: true,
        message: "Batch already processed (Idempotent replay).",
        batchName,
        committedCount: rows.length,
        alreadyProcessed: true,
      },
      { status: 200 },
    );
  }

  try {
    const actorEmail = auth.actor?.email ?? "admin@routex.local";

    const validatedList: ValidatedCompanyExpense[] = rows.map((r) => ({
      description: r.description,
      amount: r.amount,
      expenseDate: r.expenseDate,
      category: r.category || "General",
      notes: r.notes || null,
      transactionType: r.transactionType ?? "Outgoing",
      sourceSheet: r.sourceSheet || null,
      sourceRow: r.sourceRow ?? null,
      sourceRef: r.sourceRef || null,
    }));

    const result = await batchCreateCompanyExpenses(validatedList, actorEmail, batchName);

    processedIdempotencyKeys.add(idempotencyKey);

    return NextResponse.json({
      ok: true,
      batchName,
      committedCount: result.count,
      committedExpenses: result.committed,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Failed to process expense import batch.",
      },
      { status: 500 },
    );
  }
}
