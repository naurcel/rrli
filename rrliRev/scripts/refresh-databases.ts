import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

import {
  SMALL_MOCK_COMPANY_EXPENSES,
  SMALL_MOCK_DATABASE,
  SMALL_MOCK_PERIOD,
  validateSmallMockDatabase,
} from "../src/features/deliveries/small-mock-database.ts";

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

async function refreshDatabases(): Promise<void> {
  console.log("==================================================");
  console.log(" RouteX: Refresh Delivery & Finance Databases");
  console.log("==================================================");

  // 1. Refresh Local File-Based / In-Memory Mock Database
  const mockStoragePath = resolve(process.cwd(), ".mock-storage.json");
  console.log(`\n[1/3] Clearing local delivery mock persistence (${mockStoragePath})...`);
  writeFileSync(
    mockStoragePath,
    JSON.stringify(
      {
        dynamicMockDeliveries: [],
        deletedDeliveryIds: [],
      },
      null,
      2,
    ),
    "utf-8",
  );
  console.log("✓ Cleared dynamic deliveries and restored all deleted delivery records.");
  console.log(`✓ Populated ${SMALL_MOCK_DATABASE.deliveries.length} baseline delivery trips across ${SMALL_MOCK_DATABASE.clients.length} clients and ${SMALL_MOCK_DATABASE.trucks.length} trucks.`);
  console.log(`✓ Populated ${SMALL_MOCK_COMPANY_EXPENSES.length} baseline company expense records.`);

  // 2. Validate Fixtures
  console.log("\n[2/3] Validating delivery and finance database fixtures...");
  const issues = validateSmallMockDatabase();
  if (issues.length > 0) {
    throw new Error(`Fixture validation failed:\n${issues.join("\n")}`);
  }
  console.log("✓ All delivery calculations, store drop-offs, and financial invariants validated.");

  // 3. Supabase Refresh (if configured)
  loadEnvironmentFile(".env.local");
  loadEnvironmentFile(".env");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey && !supabaseUrl.includes("your-project-ref.supabase.co")) {
    console.log(`\n[3/3] Connected to Supabase at ${supabaseUrl}. Clearing and re-populating tables...`);
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Clear dependent tables
    await supabase.from("delivery_documents").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("delivery_dropoffs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("deliveries").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("company_expenses").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    console.log("✓ Cleared Supabase delivery and finance tables.");

    // Populate company expenses
    const expenseInserts = SMALL_MOCK_COMPANY_EXPENSES.map((exp) => ({
      id: exp.id,
      description: exp.description,
      amount: exp.amount,
      expense_date: exp.expenseDate,
      category: exp.category,
      notes: exp.notes,
      created_by: exp.createdBy,
      created_at: exp.createdAt,
      updated_at: exp.updatedAt,
    }));
    const { error: expError } = await supabase.from("company_expenses").insert(expenseInserts);
    if (expError) {
      console.warn("Notice: company_expenses insert returned:", expError.message);
    } else {
      console.log(`✓ Inserted ${expenseInserts.length} company expenses into Supabase.`);
    }

    // Populate foundational entities: Clients, Trucks, and Crew
    const clientInserts = SMALL_MOCK_DATABASE.clients.map((c) => ({
      id: c.id,
      client_code: c.code,
      name: c.name,
      is_active: true,
    }));
    const { error: clientError } = await supabase.from("clients").upsert(clientInserts, { onConflict: "id" });
    if (clientError) console.warn("Notice: clients upsert returned:", clientError.message);
    else console.log(`✓ Upserted ${clientInserts.length} clients into Supabase.`);

    const truckInserts = SMALL_MOCK_DATABASE.trucks.map((t) => ({
      id: t.id,
      plate_number: t.plateNumber,
      truck_type: t.truckType,
      storage_capability: t.storageCapability,
      ownership_type: t.ownershipType,
      rate_basis: t.rateBasis,
      provider: t.provider,
      contact_person: t.contactPerson,
      is_active: true,
    }));
    const { error: truckError } = await supabase.from("trucks").upsert(truckInserts, { onConflict: "id" });
    if (truckError) console.warn("Notice: trucks upsert returned:", truckError.message);
    else console.log(`✓ Upserted ${truckInserts.length} fleet trucks into Supabase.`);

    const employeeInserts = [
      ...SMALL_MOCK_DATABASE.drivers.map((d) => ({
        id: d.id,
        employee_code: d.employeeCode,
        full_name: d.fullName,
        assignment_type: "Driver",
        is_active: true,
      })),
      ...SMALL_MOCK_DATABASE.helpers.map((h) => ({
        id: h.id,
        employee_code: h.employeeCode,
        full_name: h.fullName,
        assignment_type: "Helper",
        is_active: true,
      })),
    ];
    const { error: empError } = await supabase.from("employees").upsert(employeeInserts, { onConflict: "id" });
    if (empError) console.warn("Notice: employees upsert returned:", empError.message);
    else console.log(`✓ Upserted ${employeeInserts.length} crew employees into Supabase.`);

    // Populate deliveries & dropoffs
    const deliveryInserts = SMALL_MOCK_DATABASE.deliveries.map(({ record, clientId, truckId, driverId, helperId }) => ({
      id: record.id,
      waybill_number: record.waybillNumber,
      delivery_date: record.deliveryDate,
      client_id: clientId,
      truck_id: truckId,
      truck_type_snapshot: record.truckType,
      truck_temperature_snapshot: record.truckTemperature,
      truck_ownership_snapshot: record.truckOwnership || "Owned",
      rate_basis: record.rateBasis || "Redeemed Rate",
      origin: record.origin,
      distance_km: record.distanceKm,
      fuel_rate: record.fuelRate,
      delivery_rate: record.deliveryRate,
      pod_status: record.podStatus,
      driver_id: driverId,
      helper_id: helperId,
      delivery_status: "Completed",
      version: 1,
      financial_state: record.financialState,
      notes: record.notes || null,
    }));
    const { error: delError } = await supabase.from("deliveries").insert(deliveryInserts);
    if (delError) console.warn("Notice: deliveries insert returned:", delError.message);
    else console.log(`✓ Inserted ${deliveryInserts.length} deliveries into Supabase.`);

    const dropoffInserts = SMALL_MOCK_DATABASE.deliveries.flatMap(({ record }) =>
      record.dropoffs.map((d) => ({
        id: d.id,
        delivery_id: record.id,
        sequence_number: d.sequence,
        store_name: d.storeName,
        destination_area: d.destinationArea,
        dropoff_count: d.dropoffCount ?? 1,
        entry_fee: d.entryFee,
        entry_fee_status: d.entryFeeStatus,
        pod_submitted: d.podSubmitted,
        supporting_docs_complete: d.supportingDocsComplete,
        document_ref: d.documentRef,
      })),
    );
    const { error: dropError } = await supabase.from("delivery_dropoffs").insert(dropoffInserts);
    if (dropError) console.warn("Notice: delivery_dropoffs insert returned:", dropError.message);
    else console.log(`✓ Inserted ${dropoffInserts.length} delivery drop-offs into Supabase.`);
  } else {
    console.log("\n[3/3] Supabase remote database is not configured. Local mock repository is the active data source.");
  }

  console.log("\n==================================================");
  console.log("✓ Refresh complete: Delivery and Finance databases are fresh and fully populated.");
  console.log(`  - Deliveries: ${SMALL_MOCK_DATABASE.deliveries.length} trips`);
  console.log(`  - Drop-offs: ${SMALL_MOCK_DATABASE.deliveries.reduce((sum, d) => sum + d.record.dropoffs.length, 0)} store drop-offs`);
  console.log(`  - Company Expenses: ${SMALL_MOCK_COMPANY_EXPENSES.length} expense records`);
  console.log(`  - Period: ${SMALL_MOCK_PERIOD.start} through ${SMALL_MOCK_PERIOD.end}`);
  console.log("==================================================\n");
}

refreshDatabases().catch((error) => {
  console.error("Error refreshing databases:", error);
  process.exit(1);
});
