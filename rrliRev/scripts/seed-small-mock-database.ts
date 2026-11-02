import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  SMALL_MOCK_DATABASE,
  SMALL_MOCK_PERIOD,
  validateSmallMockDatabase,
} from "../src/features/deliveries/small-mock-database.ts";

const SEED_ACTOR_EMAIL = "routex-small-mock-seed@local.invalid";

function loadEnvironmentFile(filename: string): void {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;

  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim().replace(/^export\s+/, "");
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
}

function assertSeedTarget(urlValue: string): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("The small mock database seed is disabled when NODE_ENV=production.");
  }

  const url = new URL(urlValue);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const isLocal = localHosts.has(url.hostname);
  const isExplicitTest = process.env.ROUTEX_SEED_ENV === "test";
  if (!isLocal && !isExplicitTest) {
    throw new Error(
      "Refusing to seed a non-local database. Set ROUTEX_SEED_ENV=test only for a disposable test project.",
    );
  }
}

function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function run(): Promise<void> {
  loadEnvironmentFile(".env.local");
  loadEnvironmentFile(".env");

  const fixtureIssues = validateSmallMockDatabase();
  ensure(fixtureIssues.length === 0, fixtureIssues.join("\n"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  ensure(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL is required.");
  ensure(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY is required for database seeding.");
  assertSeedTarget(supabaseUrl);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const users = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  let seedActor = users.data.users.find((user) => user.email === SEED_ACTOR_EMAIL);
  if (!seedActor) {
    const created = await supabase.auth.admin.createUser({
      email: SEED_ACTOR_EMAIL,
      password: `${randomUUID()}-${randomUUID()}`,
      email_confirm: true,
      app_metadata: { role: "admin", seed_only: true },
      user_metadata: { full_name: "RouteX Mock Seed Actor" },
    });
    if (created.error) throw created.error;
    seedActor = created.data.user;
  }
  ensure(seedActor, "Unable to create or resolve the mock seed actor.");

  const profileResult = await supabase.from("user_profiles").upsert({
    id: seedActor.id,
    email: SEED_ACTOR_EMAIL,
    full_name: "RouteX Mock Seed Actor",
    role: "admin",
    is_active: true,
  }, { onConflict: "id" });
  if (profileResult.error) throw profileResult.error;

  const clientResult = await supabase.from("clients").upsert(
    SMALL_MOCK_DATABASE.clients.map((client) => ({
      id: client.id,
      client_code: client.code,
      name: client.name,
      is_active: true,
    })),
    { onConflict: "id" },
  );
  if (clientResult.error) throw clientResult.error;

  const truckResult = await supabase.from("trucks").upsert(
    SMALL_MOCK_DATABASE.trucks.map((truck) => ({
      id: truck.id,
      plate_number: truck.plateNumber,
      truck_type: truck.truckType,
      truck_temperature: truck.truckTemperature,
      is_active: true,
    })),
    { onConflict: "id" },
  );
  if (truckResult.error) throw truckResult.error;

  const employeeResult = await supabase.from("employees").upsert(
    [...SMALL_MOCK_DATABASE.drivers, ...SMALL_MOCK_DATABASE.helpers].map((employee) => ({
      id: employee.id,
      employee_code: employee.employeeCode,
      full_name: employee.fullName,
      assignment_type: employee.assignmentType,
      is_active: true,
    })),
    { onConflict: "id" },
  );
  if (employeeResult.error) throw employeeResult.error;

  const deliveryResult = await supabase.from("deliveries").upsert(
    SMALL_MOCK_DATABASE.deliveries.map(({ record, clientId, truckId, driverId, helperId }) => ({
      id: record.id,
      waybill_number: record.waybillNumber,
      delivery_date: record.deliveryDate,
      client_id: clientId,
      truck_id: truckId,
      truck_type_snapshot: record.truckType,
      truck_temperature_snapshot: record.truckTemperature,
      origin: record.origin,
      distance_km: record.distanceKm,
      fuel_rate: record.fuelRate,
      diesel_expenses: record.expenses.dieselExpenses,
      diesel_expenses_status: record.expenseStates.dieselExpenses,
      toll_gate_expenses: record.expenses.tollGateExpenses,
      toll_gate_expenses_status: record.expenseStates.tollGateExpenses,
      toll_gate_breakdown: record.expenses.tollGateBreakdown,
      entry_fees: record.expenses.entryFees,
      entry_fees_status: record.expenseStates.entryFees,
      driver_allowance: record.expenses.driverAllowance,
      driver_allowance_status: record.expenseStates.driverAllowance,
      driver_daily_rate: record.expenses.driverDailyRate,
      driver_daily_rate_status: record.expenseStates.driverDailyRate,
      helper_allowance: record.expenses.helperAllowance,
      helper_allowance_status: record.expenseStates.helperAllowance,
      helper_daily_rate: record.expenses.helperDailyRate,
      helper_daily_rate_status: record.expenseStates.helperDailyRate,
      other_expenses: record.expenses.otherExpenses,
      other_expenses_status: record.expenseStates.otherExpenses,
      delivery_rate: record.deliveryRate,
      pod_status: record.podStatus,
      driver_id: driverId,
      helper_id: helperId,
      delivery_status: "Completed",
      version: 1,
      financial_state: record.financialState,
      financial_finalized_at:
        record.financialState === "finalized" ? `${record.deliveryDate}T12:00:00+08:00` : null,
      financial_finalized_by: record.financialState === "finalized" ? seedActor.id : null,
      created_by: seedActor.id,
    })),
    { onConflict: "id" },
  );
  if (deliveryResult.error) throw deliveryResult.error;

  const dropoffResult = await supabase.from("delivery_dropoffs").upsert(
    SMALL_MOCK_DATABASE.deliveries.flatMap(({ record }) =>
      record.dropoffs.map((dropoff) => ({
        id: dropoff.id,
        delivery_id: record.id,
        sequence_number: dropoff.sequence,
        store_name: dropoff.storeName,
        destination_area: dropoff.destinationArea,
        entry_fee: dropoff.entryFee,
        entry_fee_status: dropoff.entryFeeStatus,
        pod_submitted: dropoff.podSubmitted,
        supporting_docs_complete: dropoff.supportingDocsComplete,
        document_ref: dropoff.documentRef,
        remarks: "Fictional RouteX mock record for local/test use only.",
      })),
    ),
    { onConflict: "id" },
  );
  if (dropoffResult.error) throw dropoffResult.error;

  const documentResult = await supabase.from("delivery_documents").upsert(
    SMALL_MOCK_DATABASE.documents.map((document) => ({
      id: document.id,
      delivery_id: document.deliveryId,
      dropoff_id: document.dropoffId,
      requirement_key: document.requirementKey,
      label: document.label,
      status: document.status,
      storage_path: document.storagePath,
      original_filename: document.originalFilename,
      mime_type: document.mimeType,
      size_bytes: document.sizeBytes,
      verification_notes: document.verificationNotes,
      uploaded_by: document.status === "Missing" ? null : seedActor.id,
      uploaded_at: document.status === "Missing" ? null : "2026-06-07T15:00:00+08:00",
      verified_by: document.status === "Verified" || document.status === "Rejected" ? seedActor.id : null,
      verified_at:
        document.status === "Verified" || document.status === "Rejected"
          ? "2026-06-07T16:00:00+08:00"
          : null,
    })),
    { onConflict: "id" },
  );
  if (documentResult.error) throw documentResult.error;

  const deliveryIds = SMALL_MOCK_DATABASE.deliveries.map((delivery) => delivery.record.id);
  const seededDeliveries = await supabase
    .from("delivery_ledger")
    .select("id, client_id, delivery_date, financial_state, total_expenses, net_income")
    .in("id", deliveryIds)
    .order("delivery_date", { ascending: true });
  if (seededDeliveries.error) throw seededDeliveries.error;
  ensure(seededDeliveries.data.length === 6, "Database verification expected 6 seeded deliveries.");

  for (const client of SMALL_MOCK_DATABASE.clients) {
    ensure(
      seededDeliveries.data.filter((delivery) => delivery.client_id === client.id).length === 2,
      `Database verification expected 2 deliveries for ${client.name}.`,
    );
  }
  ensure(
    seededDeliveries.data.every(
      (delivery) =>
        delivery.delivery_date >= SMALL_MOCK_PERIOD.start &&
        delivery.delivery_date <= SMALL_MOCK_PERIOD.end,
    ),
    "A seeded delivery falls outside June 1–7, 2026.",
  );
  ensure(
    seededDeliveries.data.filter((delivery) => delivery.financial_state === "incomplete").length === 1,
    "Database verification expected exactly 1 financially incomplete delivery.",
  );

  for (const seededDelivery of seededDeliveries.data) {
    const expected = SMALL_MOCK_DATABASE.deliveries.find(
      (delivery) => delivery.record.id === seededDelivery.id,
    )?.record;
    ensure(expected, `No fixture record found for seeded delivery ${seededDelivery.id}.`);

    const actualExpenses =
      seededDelivery.total_expenses === null ? null : Number(seededDelivery.total_expenses);
    const actualNetIncome =
      seededDelivery.net_income === null ? null : Number(seededDelivery.net_income);
    ensure(
      actualExpenses === expected.totalExpenses,
      `Generated total expenses do not match the centralized calculation for ${expected.waybillNumber}.`,
    );
    ensure(
      actualNetIncome === expected.netIncome,
      `Generated net income does not match the centralized calculation for ${expected.waybillNumber}.`,
    );
  }

  const seededDropoffs = await supabase
    .from("delivery_dropoffs")
    .select("id, delivery_id")
    .in("delivery_id", deliveryIds);
  if (seededDropoffs.error) throw seededDropoffs.error;
  ensure(seededDropoffs.data.length === 9, "Database verification expected 9 seeded drop-offs.");

  const seededDocuments = await supabase
    .from("delivery_documents")
    .select("id, status")
    .in("id", SMALL_MOCK_DATABASE.documents.map((document) => document.id));
  if (seededDocuments.error) throw seededDocuments.error;
  ensure(
    seededDocuments.data.length === SMALL_MOCK_DATABASE.documents.length,
    "Database verification expected one POD document requirement per seeded drop-off.",
  );
  const documentStates = new Set(seededDocuments.data.map((document) => document.status));
  for (const state of ["Verified", "Submitted", "Missing", "Rejected"]) {
    ensure(documentStates.has(state), `Database verification is missing the ${state} POD state.`);
  }

  const summary = await supabase.rpc("delivery_profitability_summary", {
    p_date_from: SMALL_MOCK_PERIOD.start,
    p_date_to: SMALL_MOCK_PERIOD.end,
  });
  if (summary.error) throw summary.error;
  const summaryValue = summary.data as { deliveries?: number; trucks?: unknown[] } | null;
  ensure(summaryValue?.deliveries === 5, "Profitability must include only the 5 finalized deliveries.");
  ensure(summaryValue?.trucks?.length === 3, "Profitability must include all 3 seeded trucks.");

  console.log("RouteX small mock database seeded and verified.");
  console.log("3 clients, 3 trucks, 2 drivers, 2 helpers, 6 deliveries, 9 drop-offs.");
  console.log(`Delivery period: ${SMALL_MOCK_PERIOD.start} through ${SMALL_MOCK_PERIOD.end}.`);
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

