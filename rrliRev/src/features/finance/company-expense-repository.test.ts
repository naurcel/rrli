import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  listCompanyExpenses,
  getCompanyExpenseById,
  createCompanyExpense,
  updateCompanyExpense,
  deleteCompanyExpense,
  getCompanyExpensesSummary,
} from "./server/company-expense-repository.ts";
import { listAuditEntries } from "../../lib/audit/server-audit-store.ts";

describe("Company Expense Server Repository & Persistence", () => {
  it("lists initial company expenses with accurate summary statistics", async () => {
    const result = await listCompanyExpenses({ pageSize: 50 });
    assert.ok(result.total >= 9, "Should contain at least 9 seeded company expenses");
    assert.ok(result.summary.totalAmount > 0, "Total amount should be positive");
    assert.ok(result.summary.categoryTotals.length > 0, "Should have category totals");
  });

  it("filters company expenses by date range and search term", async () => {
    const octOnly = await listCompanyExpenses({
      dateFrom: "2026-10-01",
      dateTo: "2026-10-31",
    });
    assert.ok(octOnly.items.every((item) => item.expenseDate >= "2026-10-01" && item.expenseDate <= "2026-10-31"));

    const searchRes = await listCompanyExpenses({
      search: "Meralco",
    });
    assert.ok(searchRes.items.length >= 1);
    assert.ok(searchRes.items[0].description.includes("Meralco"));
  });

  it("creates, updates, and deletes a company expense with audit trail logging", async () => {
    const actorEmail = "test-operations@routex.local";

    // 1. Create
    const created = await createCompanyExpense(
      {
        description: "Test Office Whiteboard & Markers",
        amount: 3250.5,
        expenseDate: "2026-11-08",
        category: "Office & Admin",
        notes: "Stationery for route planning session",
      },
      actorEmail,
    );

    assert.ok(created.id);
    assert.equal(created.description, "Test Office Whiteboard & Markers");
    assert.equal(created.amount, 3250.5);

    // Verify Audit Log for creation
    const auditsAfterCreate = listAuditEntries();
    const createAudit = auditsAfterCreate.find(
      (a) => a.action === "company_expense.created" && a.entityId === created.id,
    );
    assert.ok(createAudit, "Audit log must contain company_expense.created entry");
    assert.equal(createAudit?.actorEmail, actorEmail);

    // 2. Fetch by ID
    const fetched = await getCompanyExpenseById(created.id);
    assert.ok(fetched);
    assert.equal(fetched?.id, created.id);

    // 3. Update
    const updated = await updateCompanyExpense(
      created.id,
      {
        description: "Test Office Whiteboard & Premium Markers",
        amount: 3500,
        expenseDate: "2026-11-08",
        category: "Office & Admin",
        notes: "Adjusted with magnetic eraser",
      },
      actorEmail,
    );
    assert.ok(updated);
    assert.equal(updated?.amount, 3500);
    assert.equal(updated?.description, "Test Office Whiteboard & Premium Markers");

    // Verify Audit Log for update
    const auditsAfterUpdate = listAuditEntries();
    const updateAudit = auditsAfterUpdate.find(
      (a) => a.action === "company_expense.updated" && a.entityId === created.id,
    );
    assert.ok(updateAudit, "Audit log must contain company_expense.updated entry");

    // 4. Delete with reason
    const deleteSuccess = await deleteCompanyExpense(
      created.id,
      actorEmail,
      "Duplicate entry cleanup during audit testing",
    );
    assert.equal(deleteSuccess, true);

    const postDelete = await getCompanyExpenseById(created.id);
    assert.equal(postDelete, null);

    // Verify Audit Log for deletion
    const auditsAfterDelete = listAuditEntries();
    const deleteAudit = auditsAfterDelete.find(
      (a) => a.action === "company_expense.deleted" && a.entityId === created.id,
    );
    assert.ok(deleteAudit, "Audit log must contain company_expense.deleted entry");
    assert.ok(deleteAudit?.summary.includes("Duplicate entry cleanup"));
  });

  it("calculates summary statistics for global date ranges", async () => {
    const summary = await getCompanyExpensesSummary("2026-10-01", "2026-11-30");
    assert.ok(summary.totalAmount > 0);
    assert.ok(summary.count > 0);
    assert.ok(summary.monthlyTotals.length >= 2, "Should cover Oct and Nov 2026");
  });
});
