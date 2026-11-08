import test from "node:test";
import assert from "node:assert/strict";

// Auth & RBAC
import {
  USER_ROLES,
  ACCESS_LEVELS,
  hasPermission,
  canMutateDeliveryRecords,
  canImportAndReviewExcel,
  canManageDocuments,
  getAuthorizedNavigationForRole,
  type UserRole,
} from "../../lib/auth/rbac.ts";
import {
  createSignedSessionToken,
  verifySignedSessionToken,
} from "../../lib/auth/session-token.ts";
import {
  evaluatePasswordCriteria,
  validateUsernameFormat,
} from "../../lib/auth/password-policy.ts";
import {
  verifyServerAccountCredentials,
  listServerAccountProfiles,
  findServerAccountById,
  findServerAccountByUsername,
  createServerAccountProfile,
  updateServerAccountProfile,
  deleteServerAccount,
  authorizeServerAccountReset,
  getServerAccountRecoveryState,
  verifyServerAccountSecurityAnswer,
  resetServerAccountPasswordWithToken,
  updateServerAccountPassword,
  updateServerAccountUsername,
} from "../../lib/auth/server-account-store.ts";

// Delivery Domain & Repository
import {
  buildDeliveryTripRecord,
  calculateTripExpenseTotal,
  calculateProfitMargin,
  derivePodVerificationStatus,
  summarizeTruckProfitability,
  type DeliveryTripRecord,
} from "../deliveries/delivery-domain.ts";
import {
  getAllMockDeliveries,
  listSmallMockDeliveryRecords,
  correctSmallMockDelivery,
  finalizeSmallMockDelivery,
  deleteSmallMockDelivery,
  deletedDeliveryIds,
} from "../deliveries/small-mock-repository.ts";
import { parseDeliveryListQuery } from "../deliveries/delivery-query.ts";

// Truck & Driver Registry
import {
  getFleetTrucks,
  registerFleetTruck,
  deleteFleetTruck,
  deletedTruckPlateNumbers,
  OWNED_TRUCKS,
  SUBCONTRACTED_TRUCKS,
} from "../deliveries/truck-registry.ts";
import {
  getFleetCrew,
  getFleetDrivers,
  registerFleetCrewMember,
  registerFleetDriver,
  setFleetCrewActive,
} from "../deliveries/driver-registry.ts";

// Reports Engine
import { BUILTIN_REPORT_TEMPLATES } from "../reports/report-template-types.ts";
import {
  listServerReportTemplates,
  saveServerReportTemplate,
  deleteServerReportTemplate,
} from "../reports/report-template-store.ts";

test("FULL AUDIT TEST: Authentication, RBAC, and Security Posture", async (t) => {
  await t.test("Verify exact RBAC matrix across all 6 roles", () => {
    // Admin: Full access
    assert.equal(hasPermission("admin", "deliveries:create"), true);
    assert.equal(hasPermission("admin", "deliveries:edit"), true);
    assert.equal(hasPermission("admin", "profitability:manage"), true);
    assert.equal(hasPermission("admin", "users:view"), true);
    assert.equal(hasPermission("admin", "users:manage"), true);
    assert.equal(hasPermission("admin", "reports:manage_templates"), true);

    // Operations: Write access for deliveries, fleet, POD, but NO user management or deletion of templates
    assert.equal(hasPermission("operations", "deliveries:create"), true);
    assert.equal(hasPermission("operations", "deliveries:edit"), true);
    assert.equal(hasPermission("operations", "profitability:manage"), true);
    assert.equal(hasPermission("operations", "users:view"), false);
    assert.equal(hasPermission("operations", "users:manage"), false);
    assert.equal(hasPermission("operations", "reports:manage_templates"), false);

    // View-Only Roles (Finance, HR, Secretary, Customer Rep): strictly view-only
    const viewOnlyRoles: UserRole[] = ["finance", "hr", "secretary", "customer_representative"];
    for (const role of viewOnlyRoles) {
      assert.equal(hasPermission(role, "deliveries:view"), true, `${role} can view deliveries`);
      assert.equal(hasPermission(role, "deliveries:create"), false, `${role} cannot create deliveries`);
      assert.equal(hasPermission(role, "deliveries:edit"), false, `${role} cannot edit deliveries`);
      assert.equal(hasPermission(role, "profitability:manage"), false, `${role} cannot manage profitability`);
      assert.equal(hasPermission(role, "users:view"), false, `${role} cannot view users`);
      assert.equal(hasPermission(role, "users:manage"), false, `${role} cannot manage users`);
    }
  });

  await t.test("Navigation menu visibility aligns strictly with role authorization", () => {
    const adminNav = getAuthorizedNavigationForRole("admin");
    assert.ok(adminNav.primary.some((i) => i.href === "/deliveries"), "Admin has Deliveries");
    assert.ok(adminNav.management.some((i) => i.href === "/user-management"), "Admin has User Management");

    const opsNav = getAuthorizedNavigationForRole("operations");
    assert.ok(opsNav.primary.some((i) => i.href === "/deliveries"), "Operations has Deliveries");
    assert.equal(opsNav.management.some((i) => i.href === "/user-management"), false, "Operations lacks User Management");

    const finNav = getAuthorizedNavigationForRole("finance");
    assert.ok(finNav.primary.some((i) => i.href === "/deliveries"), "Finance has Deliveries view");
    assert.equal(finNav.management.some((i) => i.href === "/user-management"), false, "Finance lacks User Management");
  });

  await t.test("HMAC-SHA256 Session Token signing and verification", () => {
    const token = createSignedSessionToken({
      userId: "usr-admin-1",
      rememberMe: true,
      nowMs: Date.now(),
      durationMs: 60_000,
    });
    assert.ok(token && token.includes("."), "Token must be valid signed dot-separated string");

    const verified = verifySignedSessionToken(token);
    assert.ok(verified, "Session verification must succeed");
    assert.equal(verified?.sub, "usr-admin-1");

    const tampered = token.slice(0, -4) + "XXXX";
    const failedVerify = verifySignedSessionToken(tampered);
    assert.equal(failedVerify, null, "Tampered token must fail verification");
  });

  await t.test("Password criteria validation enforces RFC 9106 standards", () => {
    const weak = evaluatePasswordCriteria("weak");
    assert.equal(weak.isValid, false);
    assert.equal(weak.checks.minLength, false);

    const strong = evaluatePasswordCriteria("RouteX@2026Secure!");
    assert.equal(strong.isValid, true);
    assert.equal(strong.checks.minLength, true);
    assert.equal(strong.checks.hasLetter, true);
    assert.equal(strong.checks.hasNumber, true);
    assert.equal(strong.checks.notCommon, true);
  });

  await t.test("Username normalization is case-insensitive", () => {
    assert.equal(validateUsernameFormat("  AdminUser ").normalized, "adminuser");
    assert.equal(validateUsernameFormat("OPERATIONS_01").normalized, "operations_01");
  });

  await t.test("Server Account Store: Authentication, Credentials & Password Reset", async () => {
    const adminAuth = await verifyServerAccountCredentials("admin", "admin");
    assert.equal(adminAuth.ok, true, "Admin credentials must succeed");
    if (adminAuth.ok) {
      assert.equal(adminAuth.profile.role, "admin");
    }

    const wrongPass = await verifyServerAccountCredentials("admin", "wrongpassword");
    assert.equal(wrongPass.ok, false);

    // Verify security question answer
    const secVerify = await verifyServerAccountSecurityAnswer("admin", "RouteX Academy");
    assert.equal(secVerify.ok, true, "Security answer for admin must verify");

    const secWrong = await verifyServerAccountSecurityAnswer("admin", "Wrong Answer");
    assert.equal(secWrong.ok, false, "Incorrect security answer must fail");
  });

  await t.test("Account Provisioning, Role Update, Status Toggle, and Protected Deletion", async () => {
    // 1. Provision new account
    const testUsername = `testuser_${Date.now()}`;
    const provisionRes = await createServerAccountProfile({
      username: testUsername,
      email: `${testUsername}@routex.local`,
      fullName: "Test Provisioned User",
      role: "operations",
      temporaryPassword: "TempPassword123!",
    });
    assert.equal(provisionRes.ok, true);
    const user = (provisionRes as { ok: true; profile: { id: string } }).profile;

    // 2. Change role
    const roleRes = updateServerAccountProfile({
      userId: user.id,
      role: "finance",
    });
    assert.equal(roleRes.ok, true);
    assert.equal(findServerAccountById(user.id)?.role, "finance");

    // 3. Deactivate and reactivate
    const deactRes = updateServerAccountProfile({
      userId: user.id,
      isActive: false,
    });
    assert.equal(deactRes.ok, true);
    assert.equal(findServerAccountById(user.id)?.isActive, false);

    const reactRes = updateServerAccountProfile({
      userId: user.id,
      isActive: true,
    });
    assert.equal(reactRes.ok, true);
    assert.equal(findServerAccountById(user.id)?.isActive, true);

    // 4. Delete staff user
    const delRes = deleteServerAccount(user.id);
    assert.equal(delRes.ok, true);
    assert.equal(findServerAccountById(user.id), null);

    // 5. Verify primary admin CANNOT be deleted
    const primaryAdmin = findServerAccountByUsername("admin");
    assert.ok(primaryAdmin);
    const adminDelRes = deleteServerAccount(primaryAdmin.id);
    assert.equal(adminDelRes.ok, false);
    assert.match(adminDelRes.message, /cannot be deleted/i);
  });
});

test("FULL AUDIT TEST: Delivery Domain, Calculations, and Financial Integrity", async (t) => {
  await t.test("buildDeliveryTripRecord accurately computes expenses and net income", () => {
    const record = buildDeliveryTripRecord({
      id: "dlv-test-1",
      waybillNumber: "WB-TEST-001",
      deliveryDate: "2026-11-01",
      clientName: "Landers",
      plateNumber: "NGS 4281",
      truckType: "6-Wheeler",
      truckTemperature: "4°C",
      origin: "Hub 1",
      distanceKm: 50,
      fuelRate: 85,
      deliveryRate: 20000,
      expenses: {
        dieselExpenses: 3000,
        tollGateExpenses: 500,
        tollGateBreakdown: "NLEX Tolls",
        driverAllowance: 300,
        driverDailyRate: 800,
        helperAllowance: 200,
        helperDailyRate: 600,
        otherExpenses: 100,
      },
      dropoffs: [
        {
          id: "stop-1",
          sequence: 1,
          storeName: "Landers Otis",
          destinationArea: "Manila",
          entryFee: 150,
          entryFeeStatus: "confirmed",
          podSubmitted: true,
          supportingDocsComplete: true,
          documentRef: "POD-001.pdf",
        },
      ],
    });

    // Expenses: 3000 + 500 + 300 + 800 + 200 + 600 + 100 + 150 = 5,650
    assert.equal(record.totalExpenses, 5650);
    assert.equal(record.netIncome, 14350);
    assert.equal(record.financialState, "finalized");
    assert.equal(record.podStatus, "Verified");
  });

  await t.test("Unknown expenses are NEVER silently zeroed; financial state marks incomplete", () => {
    const record = buildDeliveryTripRecord({
      id: "dlv-test-2",
      waybillNumber: "WB-TEST-002",
      deliveryDate: "2026-11-01",
      clientName: "Vanguard",
      plateNumber: "CBZ 1187",
      truckType: "10-Wheeler",
      truckTemperature: "20°C",
      origin: "Hub 2",
      distanceKm: 80,
      fuelRate: 88,
      deliveryRate: 25000,
      expenses: {
        dieselExpenses: 4000,
        tollGateExpenses: null, // Unknown!
        tollGateBreakdown: "",
        driverAllowance: 350,
        driverDailyRate: 850,
        helperAllowance: 250,
        helperDailyRate: 600,
        otherExpenses: 0,
      },
      expenseStates: { tollGateExpenses: "unknown" },
      dropoffs: [
        {
          id: "stop-2",
          sequence: 1,
          storeName: "Store 1",
          destinationArea: "Area 1",
          entryFee: 100,
          podSubmitted: false,
          supportingDocsComplete: false,
          documentRef: "",
        },
      ],
    });

    assert.equal(record.totalExpenses, null, "Total expenses must be null when an expense is unknown");
    assert.equal(record.netIncome, null, "Net income must be null when expenses are incomplete");
    assert.equal(record.marginPercent, null, "Margin percent must be null");
    assert.equal(record.financialState, "incomplete");
    assert.ok(record.financialIntegrityIssues.length > 0);
  });

  await t.test("Not applicable expenses evaluate to confirmed null with zero impact", () => {
    const record = buildDeliveryTripRecord({
      id: "dlv-test-3",
      waybillNumber: "WB-TEST-003",
      deliveryDate: "2026-11-01",
      clientName: "Client 3",
      plateNumber: "XCY 6612",
      truckType: "4-Wheeler",
      truckTemperature: "25°C",
      origin: "Hub 3",
      distanceKm: 20,
      fuelRate: 80,
      deliveryRate: 10000,
      expenses: {
        dieselExpenses: 1500,
        tollGateExpenses: null, // NA
        tollGateBreakdown: "None",
        driverAllowance: 200,
        driverDailyRate: 600,
        helperAllowance: null, // No helper
        helperDailyRate: null,
        otherExpenses: 0,
      },
      expenseStates: {
        tollGateExpenses: "not_applicable",
        helperAllowance: "not_applicable",
        helperDailyRate: "not_applicable",
      },
      dropoffs: [
        {
          id: "stop-3",
          sequence: 1,
          storeName: "Direct Depot",
          destinationArea: "Pasig",
          entryFee: null,
          entryFeeStatus: "not_applicable",
          podSubmitted: true,
          supportingDocsComplete: true,
          documentRef: "DOC-003.pdf",
        },
      ],
    });

    // Expenses: 1500 + 200 + 600 = 2300
    assert.equal(record.totalExpenses, 2300);
    assert.equal(record.netIncome, 7700);
    assert.equal(record.financialState, "finalized");
  });

  await t.test("POD Verification Status derives correctly from stop documents", () => {
    // 1. All verified
    assert.equal(
      derivePodVerificationStatus([
        { id: "1", sequence: 1, storeName: "A", destinationArea: "B", entryFee: 0, entryFeeStatus: "confirmed", documentRef: "d1", podSubmitted: true, supportingDocsComplete: true },
        { id: "2", sequence: 2, storeName: "C", destinationArea: "D", entryFee: 0, entryFeeStatus: "confirmed", documentRef: "d2", podSubmitted: true, supportingDocsComplete: true },
      ]),
      "Verified",
    );

    // 2. One submitted but incomplete supporting docs
    assert.equal(
      derivePodVerificationStatus([
        { id: "1", sequence: 1, storeName: "A", destinationArea: "B", entryFee: 0, entryFeeStatus: "confirmed", documentRef: "d1", podSubmitted: true, supportingDocsComplete: true },
        { id: "2", sequence: 2, storeName: "C", destinationArea: "D", entryFee: 0, entryFeeStatus: "confirmed", documentRef: "d2", podSubmitted: true, supportingDocsComplete: false },
      ]),
      "Incomplete",
    );

    // 3. No POD submitted or supporting docs
    assert.equal(
      derivePodVerificationStatus([
        { id: "1", sequence: 1, storeName: "A", destinationArea: "B", entryFee: 0, entryFeeStatus: "confirmed", documentRef: "d1", podSubmitted: false, supportingDocsComplete: false },
        { id: "2", sequence: 2, storeName: "C", destinationArea: "D", entryFee: 0, entryFeeStatus: "confirmed", documentRef: "d2", podSubmitted: false, supportingDocsComplete: false },
      ]),
      "Pending",
    );
  });

  await t.test("summarizeTruckProfitability aggregates revenue, expenses, and store drop-off counts", () => {
    const trip1 = buildDeliveryTripRecord({
      id: "t1",
      waybillNumber: "WB-T1",
      deliveryDate: "2026-11-01",
      clientName: "Client A",
      plateNumber: "TRK 100",
      truckType: "6-Wheeler",
      truckTemperature: "-18°C",
      origin: "Hub",
      distanceKm: 50,
      fuelRate: 85,
      deliveryRate: 15000,
      expenses: {
        dieselExpenses: 2000,
        tollGateExpenses: 300,
        tollGateBreakdown: "Toll",
        driverAllowance: 200,
        driverDailyRate: 700,
        helperAllowance: 150,
        helperDailyRate: 500,
        otherExpenses: 50,
      },
      dropoffs: [
        { id: "s1", sequence: 1, storeName: "S1", destinationArea: "D1", entryFee: 100, podSubmitted: true, supportingDocsComplete: true, documentRef: "doc1" },
        { id: "s2", sequence: 2, storeName: "S2", destinationArea: "D2", entryFee: 100, podSubmitted: true, supportingDocsComplete: true, documentRef: "doc2" },
      ],
    });

    const trip2 = buildDeliveryTripRecord({
      id: "t2",
      waybillNumber: "WB-T2",
      deliveryDate: "2026-11-02",
      clientName: "Client B",
      plateNumber: "TRK 100",
      truckType: "6-Wheeler",
      truckTemperature: "-18°C",
      origin: "Hub",
      distanceKm: 40,
      fuelRate: 85,
      deliveryRate: 12000,
      expenses: {
        dieselExpenses: 1800,
        tollGateExpenses: 200,
        tollGateBreakdown: "Toll",
        driverAllowance: 200,
        driverDailyRate: 700,
        helperAllowance: 150,
        helperDailyRate: 500,
        otherExpenses: 50,
      },
      dropoffs: [
        { id: "s3", sequence: 1, storeName: "S3", destinationArea: "D3", entryFee: 100, podSubmitted: true, supportingDocsComplete: true, documentRef: "doc3" },
      ],
    });

    const summary = summarizeTruckProfitability([trip1, trip2]);
    assert.equal(summary.length, 1);
    assert.equal(summary[0].completedTrips, 2);
    assert.equal(summary[0].totalStoresServed, 3); // 2 + 1 = 3 drop-offs!
    assert.equal(summary[0].totalEarnings, 27000); // 15000 + 12000
  });
});

test("FULL AUDIT TEST: Repository CRUD, Filtering, and Deletion Governance", async (t) => {
  deletedDeliveryIds.clear();
  deletedTruckPlateNumbers.clear();

  await t.test("listSmallMockDeliveryRecords query parsing and multi-criteria filters", () => {
    const baseQuery = parseDeliveryListQuery(new URLSearchParams("sort=delivery_date&direction=desc&page=1&pageSize=50"));
    assert.equal(baseQuery.ok, true);
    if (!baseQuery.ok) return;

    const all = listSmallMockDeliveryRecords(baseQuery.value);
    assert.ok(all.total > 0, "Must return mock deliveries");

    // Filter by client
    const clientFilteredQuery = parseDeliveryListQuery(
      new URLSearchParams(`sort=delivery_date&direction=desc&page=1&pageSize=50&clientId=${encodeURIComponent(all.filters.clients[0].id)}`)
    );
    assert.equal(clientFilteredQuery.ok, true);
    if (!clientFilteredQuery.ok) return;

    const clientFiltered = listSmallMockDeliveryRecords(clientFilteredQuery.value);
    assert.ok(clientFiltered.total <= all.total);
    for (const item of clientFiltered.items) {
      assert.equal(item.clientId, all.filters.clients[0].id);
    }
  });

  await t.test("Delivery financial correction with optimistic locking version check", () => {
    const listQuery = parseDeliveryListQuery(new URLSearchParams("sort=delivery_date&direction=desc&page=1&pageSize=10"));
    assert.equal(listQuery.ok, true);
    if (!listQuery.ok) return;

    const list = listSmallMockDeliveryRecords(listQuery.value);
    const target = list.items[0];

    // Correction with matching version succeeds
    const correctRes = correctSmallMockDelivery({
      deliveryId: target.id,
      expectedVersion: target.version,
      reason: "Audit correction verified",
      changes: {
        deliveryRate: 35000,
      },
    });
    assert.equal(correctRes.ok, true);
    if (correctRes.ok) {
      assert.equal(correctRes.version, target.version + 1);
    }

    // Stale version fails with VERSION_CONFLICT
    const staleRes = correctSmallMockDelivery({
      deliveryId: target.id,
      expectedVersion: target.version, // outdated version!
      reason: "Concurrent retry",
      changes: { deliveryRate: 36000 },
    });
    assert.equal(staleRes.ok, false);
    assert.match(staleRes.error, /VERSION_CONFLICT/i);
  });

  await t.test("Truck registry: Registration, duplicate protection, and deletion", () => {
    const initialTrucks = getFleetTrucks();
    const newPlate = `TEST-${Date.now().toString().slice(-4)}`;

    const reg = registerFleetTruck({
      id: `trk-${Date.now()}`,
      plateNumber: newPlate,
      truckType: "6-Wheeler",
      ownershipType: "Owned",
      rateBasis: "Redeemed Rate",
      provider: null,
      contactPerson: null,
    });
    assert.equal(reg.ok, true);

    const afterReg = getFleetTrucks();
    assert.ok(afterReg.some((t) => t.plateNumber === newPlate));

    // Delete truck
    const del = deleteFleetTruck(newPlate);
    assert.equal(del.ok, true);

    const afterDel = getFleetTrucks();
    assert.equal(afterDel.some((t) => t.plateNumber === newPlate), false);
  });

  await t.test("Driver and helper registry management", () => {
    const newDriverName = `Carlos Driver ${Date.now()}`;
    const regDriver = registerFleetDriver({
      fullName: newDriverName,
      assignmentType: "Driver",
    });
    assert.equal(regDriver.ok, true);

    const drivers = getFleetDrivers();
    assert.ok(drivers.some((d) => d.fullName === newDriverName));

    const newHelperName = `Ira Helper ${Date.now()}`;
    const regHelper = registerFleetCrewMember({
      fullName: newHelperName,
      assignmentType: "Helper",
    });
    assert.equal(regHelper.ok, true);

    const crew = getFleetCrew();
    assert.ok(crew.some((h) => h.fullName === newHelperName && h.assignmentType === "Helper"));
  });

  await t.test("Report template management: Built-in protection & custom templates", () => {
    const templates = listServerReportTemplates();
    assert.ok(templates.length >= 6, "Must provide at least 6 built-in templates");

    // Attempting to delete a built-in template must fail
    const delBuiltin = deleteServerReportTemplate(BUILTIN_REPORT_TEMPLATES[0].id);
    assert.equal(delBuiltin.ok, false, "Cannot delete built-in template");

    // Creating a custom template
    const custom = saveServerReportTemplate({
      name: "Custom Fleet Audit",
      description: "Custom test report layout",
      baseType: "truck_summary",
      layout: {
        title: "Custom Fleet Audit",
        sectionHeading: "Truck Summaries",
      },
      columns: [
        { id: "plateNumber", visible: true, order: 0, customLabel: "Vehicle Plate" },
        { id: "completedTrips", visible: true, order: 1 },
        { id: "revenue", visible: true, order: 2 },
        { id: "netIncome", visible: true, order: 3 },
      ],
      breakdown: {
        showGrossEarnings: true,
        showTotalExpenses: true,
        showNetProfit: true,
        showProfitMargin: true,
        showActiveTrucks: true,
        showStoreDropoffs: true,
        showDieselExpenses: true,
        showTollExpenses: true,
        showCrewCosts: true,
      },
      filters: {
        financialState: "finalized_only",
        truckOwnership: "all",
      },
    });
    assert.equal(custom.ok, true);

    if (custom.ok) {
      const delCustom = deleteServerReportTemplate(custom.template.id);
      assert.equal(delCustom.ok, true, "Deleting custom template must succeed");
    }
  });

  deletedDeliveryIds.clear();
  deletedTruckPlateNumbers.clear();
});
