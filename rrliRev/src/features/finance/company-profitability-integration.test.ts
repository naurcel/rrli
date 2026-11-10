import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateCompanyProfitability,
  validateCompanyExpenseInput,
  type CompanyExpense,
} from "./company-expense-domain.ts";
import {
  createCompanyExpense,
  updateCompanyExpense,
  deleteCompanyExpense,
  listCompanyExpenses,
  getCompanyExpensesSummary,
} from "./server/company-expense-repository.ts";
import { canManageCompanyExpenses, type UserRole } from "../../lib/auth/rbac.ts";
import {
  processReport,
  generateReportRows,
} from "../reports/report-engine.ts";
import {
  DEFAULT_REVENUE_TEMPLATE,
  DEFAULT_PROFITABILITY_TEMPLATE,
  DEFAULT_TRIP_LEDGER_TEMPLATE,
} from "../reports/report-template-types.ts";
import { buildDeliveryTripRecord } from "../deliveries/delivery-domain.ts";
import type { DeliveryTripRecord } from "../deliveries/delivery-domain.ts";

describe("RouteX: Company Profitability & Expense Ledger Integration", () => {
  const mockActorAdmin = {
    id: "usr-admin-01",
    username: "admin",
    fullName: "System Administrator",
    role: "admin" as const,
  };

  const mockActorOperations = {
    id: "usr-ops-01",
    username: "operations",
    fullName: "Dispatcher Operations",
    role: "operations" as const,
  };

  const mockActorFinance = {
    id: "usr-fin-01",
    username: "finance",
    fullName: "Finance Officer",
    role: "finance" as const,
  };

  it("calculates company net profit using the canonical formula: Delivery Revenue - Delivery Expenses - Company Expenses", () => {
    const result = calculateCompanyProfitability({
      deliveryRevenue: 500000,
      deliveryExpenses: 280000,
      companyExpenses: 65000,
    });

    assert.equal(result.deliveryRevenue, 500000);
    assert.equal(result.deliveryExpenses, 280000);
    assert.equal(result.companyExpenses, 65000);
    assert.equal(result.deliveryNetProfit, 220000);
    // 500,000 - 280,000 - 65,000 = 155,000
    assert.equal(result.companyNetProfit, 155000);
    // (155,000 / 500,000) * 100 = 31.0%
    assert.equal(result.companyProfitMargin, 31);
  });

  it("handles negative company net profit (net loss) gracefully with negative profit margin", () => {
    const result = calculateCompanyProfitability({
      deliveryRevenue: 100000,
      deliveryExpenses: 80000,
      companyExpenses: 45000,
    });

    // 100,000 - 80,000 - 45,000 = -25,000
    assert.equal(result.companyNetProfit, -25000);
    // (-25,000 / 100,000) * 100 = -25.0%
    assert.equal(result.companyProfitMargin, -25);
  });

  it("excludes incomplete deliveries from delivery revenue and expenses until confirmed", () => {
    // Completed delivery
    const completedTrip: DeliveryTripRecord = buildDeliveryTripRecord({
      id: "del-comp-01",
      waybillNumber: "WB-COMP-01",
      deliveryDate: "2026-10-15",
      clientName: "Wilcon Depot",
      plateNumber: "NBD-1234",
      truckType: "6-Wheeler",
      truckTemperature: "-18°C",
      origin: "Valenzuela Hub",
      distanceKm: 45,
      fuelRate: 85,
      truckOwnership: "Owned",
      deliveryRate: 25000,
      dropoffs: [
        {
          id: "dp-1",
          sequence: 1,
          storeName: "Wilcon Balintawak",
          destinationArea: "Quezon City",
          entryFee: 150,
          podSubmitted: true,
          supportingDocsComplete: true,
          documentRef: "DOC-01",
        },
      ],
      expenses: {
        dieselExpenses: 3500,
        tollGateExpenses: 850,
        tollGateBreakdown: "NLEX Balintawak ₱850",
        driverAllowance: 500,
        driverDailyRate: 800,
        helperAllowance: 300,
        helperDailyRate: 600,
        otherExpenses: 0,
      },
    });

    // Incomplete delivery with unknown diesel expense
    const incompleteTrip: DeliveryTripRecord = buildDeliveryTripRecord({
      id: "del-incomp-01",
      waybillNumber: "WB-INCOMP-01",
      deliveryDate: "2026-10-16",
      clientName: "SM Supermarket",
      plateNumber: "CBD-5678",
      truckType: "4-Wheeler",
      truckTemperature: "4°C",
      origin: "Meycauayan Hub",
      distanceKm: 35,
      fuelRate: 85,
      truckOwnership: "Owned",
      deliveryRate: 18000,
      dropoffs: [
        {
          id: "dp-2",
          sequence: 1,
          storeName: "SM Fairview",
          destinationArea: "Quezon City",
          entryFee: 100,
          podSubmitted: false,
          supportingDocsComplete: false,
          documentRef: "",
        },
      ],
      expenses: {
        dieselExpenses: null, // Unknown expense!
        tollGateExpenses: 400,
        tollGateBreakdown: "Mindanao Ave ₱400",
        driverAllowance: 300,
        driverDailyRate: 800,
        helperAllowance: null,
        helperDailyRate: null,
        otherExpenses: 0,
      },
      expenseStates: {
        dieselExpenses: "unknown",
        helperAllowance: "not_applicable",
        helperDailyRate: "not_applicable",
      },
    });

    assert.equal(completedTrip.financialState, "finalized");
    assert.equal(incompleteTrip.financialState, "incomplete");

    // Compute company profitability for these two deliveries + 10,000 company expense
    const deliveries = [completedTrip, incompleteTrip];
    const finalizedDeliveries = deliveries.filter((d) => d.financialState === "finalized");

    const deliveryRevenue = finalizedDeliveries.reduce((sum, d) => sum + (d.deliveryRate ?? 0), 0);
    const deliveryExpenses = finalizedDeliveries.reduce((sum, d) => sum + (d.totalExpenses ?? 0), 0);
    const companyExpenses = 10000;

    // Delivery revenue must ONLY be 25,000 (incomplete 18,000 excluded)
    assert.equal(deliveryRevenue, 25000);
    // Delivery expenses must only be from completed trip: 3500 + 850 + 150 (entry) + 500 + 800 + 300 + 600 = 6700
    assert.equal(deliveryExpenses, 6700);

    const profitability = calculateCompanyProfitability({
      deliveryRevenue,
      deliveryExpenses,
      companyExpenses,
    });

    // 25,000 - 6,700 - 10,000 = 8,300
    assert.equal(profitability.companyNetProfit, 8300);
  });

  it("strictly isolates truck profitability from company-wide expenses", () => {
    const tripA: DeliveryTripRecord = buildDeliveryTripRecord({
      id: "del-trk-01",
      waybillNumber: "WB-TRK-01",
      deliveryDate: "2026-10-20",
      clientName: "Wilcon Depot",
      plateNumber: "TRK-9999",
      truckType: "6-Wheeler",
      truckTemperature: "-18°C",
      origin: "Valenzuela Depot",
      distanceKm: 60,
      fuelRate: 85,
      truckOwnership: "Owned",
      deliveryRate: 30000,
      dropoffs: [{ id: "d1", sequence: 1, storeName: "Store 1", destinationArea: "City", entryFee: 0, podSubmitted: true, supportingDocsComplete: true, documentRef: "" }],
      expenses: {
        dieselExpenses: 4000,
        tollGateExpenses: 1000,
        tollGateBreakdown: "Tolls ₱1000",
        driverAllowance: 500,
        driverDailyRate: 800,
        helperAllowance: 300,
        helperDailyRate: 600,
        otherExpenses: 0,
      },
    });

    // Truck summary template
    const reportWithoutCompany = processReport([tripA], DEFAULT_PROFITABILITY_TEMPLATE);
    const reportWithCompany = processReport([tripA], DEFAULT_PROFITABILITY_TEMPLATE, 50000);

    // Truck summary rows must remain IDENTICAL regardless of company expenses
    assert.deepEqual(reportWithoutCompany.rows, reportWithCompany.rows);

    // In truck summary, company expenses are strictly 0 and companyNetProfit equals delivery netProfit
    assert.equal(reportWithCompany.totals.totalCompanyExpenses, 0);
    assert.equal(reportWithCompany.totals.companyNetProfit, reportWithCompany.totals.netProfit);
  });

  it("includes company expenses in client summary and trip ledger reports", () => {
    const tripA: DeliveryTripRecord = buildDeliveryTripRecord({
      id: "del-rep-01",
      waybillNumber: "WB-REP-01",
      deliveryDate: "2026-10-21",
      clientName: "Wilcon Depot",
      plateNumber: "TRK-1111",
      truckType: "6-Wheeler",
      truckTemperature: "-18°C",
      origin: "Valenzuela Depot",
      distanceKm: 70,
      fuelRate: 85,
      truckOwnership: "Owned",
      deliveryRate: 40000,
      dropoffs: [{ id: "d1", sequence: 1, storeName: "Store A", destinationArea: "City", entryFee: 0, podSubmitted: true, supportingDocsComplete: true, documentRef: "" }],
      expenses: {
        dieselExpenses: 5000,
        tollGateExpenses: 1200,
        tollGateBreakdown: "Tolls ₱1200",
        driverAllowance: 600,
        driverDailyRate: 800,
        helperAllowance: 400,
        helperDailyRate: 600,
        otherExpenses: 0,
      },
    });

    const report = processReport([tripA], DEFAULT_REVENUE_TEMPLATE, 15000);

    assert.equal(report.totals.grossEarnings, 40000);
    assert.equal(report.totals.totalExpenses, 8600);
    assert.equal(report.totals.netProfit, 31400);
    assert.equal(report.totals.totalCompanyExpenses, 15000);
    // Company Net Profit: 40,000 - 8,600 - 15,000 = 16,400
    assert.equal(report.totals.companyNetProfit, 16400);
  });

  it("enforces RBAC permissions for company expenses", () => {
    // Admin can view and manage
    assert.equal(canManageCompanyExpenses("admin"), true);

    // Operations can view and manage
    assert.equal(canManageCompanyExpenses("operations"), true);

    // View-only roles CANNOT manage company expenses
    const viewOnlyRoles: UserRole[] = ["finance", "hr", "secretary", "customer_representative"];
    for (const role of viewOnlyRoles) {
      assert.equal(canManageCompanyExpenses(role), false);
    }
  });

  it("validates company expense inputs with boundary checks and decimal precision", () => {
    // Valid input with decimal
    const valid = validateCompanyExpenseInput({
      description: "Warehouse office electricity - October 2026",
      amount: "14850.75",
      expenseDate: "2026-10-25",
      notes: "Meralco Account #12345678",
    });
    assert.equal(valid.success, true);
    if (valid.success) {
      assert.equal(valid.data.amount, 14850.75);
      assert.equal(valid.data.description, "Warehouse office electricity - October 2026");
    }

    // Zero amount rejected
    const zeroAmount = validateCompanyExpenseInput({
      description: "Invalid zero amount",
      amount: 0,
      expenseDate: "2026-10-25",
    });
    assert.equal(zeroAmount.success, false);

    // Negative amount rejected
    const negativeAmount = validateCompanyExpenseInput({
      description: "Invalid negative amount",
      amount: -500,
      expenseDate: "2026-10-25",
    });
    assert.equal(negativeAmount.success, false);

    // Pre-2024 foundation boundary date rejected
    const preFoundationDate = validateCompanyExpenseInput({
      description: "Pre-founding expense",
      amount: 5000,
      expenseDate: "2023-12-31",
    });
    assert.equal(preFoundationDate.success, false);
    if (!preFoundationDate.success) {
      assert.ok(preFoundationDate.errors[0].includes("2024"));
    }

    // Missing description defaults to Total Company Expenses
    const missingDesc = validateCompanyExpenseInput({
      description: "   ",
      amount: 5000,
      expenseDate: "2026-10-25",
    });
    assert.equal(missingDesc.success, true);
    if (missingDesc.success) {
      assert.equal(missingDesc.data.description, "Total Company Expenses");
    }
  });

  it("performs full repository lifecycle: create, list, update, summary, and delete with audit trail", async () => {
    // 1. Create
    const created = await createCompanyExpense(
      {
        description: "Integration Test Hub Maintenance",
        amount: 8500.5,
        expenseDate: "2026-11-01",
        category: "Maintenance & Repairs",
        notes: "Aircon and roll-up door maintenance",
      },
      mockActorOperations.username,
    );

    assert.ok(created.id);
    assert.equal(created.description, "Integration Test Hub Maintenance");
    assert.equal(created.amount, 8500.5);

    // 2. List
    const listResult = await listCompanyExpenses({
      search: "Integration Test Hub",
    });
    assert.ok(listResult.items.some((e) => e.id === created.id));

    // 3. Update
    const updated = await updateCompanyExpense(
      created.id,
      {
        description: "Integration Test Hub Maintenance (Revised)",
        amount: 9200,
        expenseDate: "2026-11-02",
        category: "Maintenance & Repairs",
        notes: "Included spare parts",
      },
      mockActorAdmin.username,
    );

    assert.ok(updated);
    assert.equal(updated.description, "Integration Test Hub Maintenance (Revised)");
    assert.equal(updated.amount, 9200);

    // 4. Summary calculation
    const summary = await getCompanyExpensesSummary("2026-11-01", "2026-11-30");
    assert.ok(summary.totalAmount >= 9200);

    // 5. Delete with reason
    const deleteSuccess = await deleteCompanyExpense(
      created.id,
      mockActorAdmin.username,
      "Test cleanup after verification",
    );
    assert.equal(deleteSuccess, true);

    // Verify deletion
    const afterDelete = await listCompanyExpenses({ search: "Integration Test Hub" });
    assert.ok(!afterDelete.items.some((e) => e.id === created.id));
  });
});
