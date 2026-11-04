const fs = require('fs');

let code = fs.readFileSync('rrliRev/src/app/api/deliveries/route.ts', 'utf8');

// 1. Add schema fields
const schemaTarget = `  driverAllowance: optionalMoneySchema,
  driverAllowanceStatus: expenseStatusSchema,
  driverDailyRate: optionalMoneySchema,
  driverDailyRateStatus: expenseStatusSchema,
  helperAllowance: optionalMoneySchema,
  helperAllowanceStatus: expenseStatusSchema,
  helperDailyRate: optionalMoneySchema,
  helperDailyRateStatus: expenseStatusSchema,
  otherExpenses: optionalMoneySchema,
  otherExpensesStatus: expenseStatusSchema,`;

const schemaReplace = `  driverAllowance: optionalMoneySchema,
  driverAllowanceStatus: expenseStatusSchema,
  driverDailyRate: optionalMoneySchema,
  driverDailyRateStatus: expenseStatusSchema,
  driverName: z.string().trim().optional().nullable(),
  helperAllowance: optionalMoneySchema,
  helperAllowanceStatus: expenseStatusSchema,
  helperDailyRate: optionalMoneySchema,
  helperDailyRateStatus: expenseStatusSchema,
  helperName: z.string().trim().optional().nullable(),
  hasSecondHelper: z.boolean().default(false),
  helper2Allowance: optionalMoneySchema.optional().nullable(),
  helper2AllowanceStatus: expenseStatusSchema.optional().default("not_applicable"),
  helper2DailyRate: optionalMoneySchema.optional().nullable(),
  helper2DailyRateStatus: expenseStatusSchema.optional().default("not_applicable"),
  helper2Name: z.string().trim().optional().nullable(),
  otherExpenses: optionalMoneySchema,
  otherExpensesStatus: expenseStatusSchema,`;

// 2. Add superRefine check for helper 2
const refineTarget = `    if (status === "not_applicable" && amount != null) {
      context.addIssue({ code: "custom", path: [field], message: "Not applicable expenses must not contain an amount." });
    }
  }
  data.dropoffs.forEach((dropoff, index) => {`;

const refineReplace = `    if (status === "not_applicable" && amount != null) {
      context.addIssue({ code: "custom", path: [field], message: "Not applicable expenses must not contain an amount." });
    }
  }
  if (data.hasSecondHelper) {
    const helper2Pairs = [
      ["helper2Allowance", data.helper2Allowance, data.helper2AllowanceStatus],
      ["helper2DailyRate", data.helper2DailyRate, data.helper2DailyRateStatus],
    ] as const;
    for (const [field, amount, status] of helper2Pairs) {
      if (status === "confirmed" && amount == null) {
        context.addIssue({ code: "custom", path: [field], message: "Enter a confirmed amount for Helper 2, including zero when confirmed." });
      }
      if (status === "not_applicable" && amount != null) {
        context.addIssue({ code: "custom", path: [field], message: "Not applicable expenses must not contain an amount." });
      }
    }
  }
  data.dropoffs.forEach((dropoff, index) => {`;

// 3. In POST: calculate combined helper values before `if (!isSupabaseConfigured())`
const postTarget = `export async function POST(request: Request) {
  const auth = await verifyServerPermission("deliveries:create");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = createDeliverySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid delivery record payload.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured()) {`;

const postReplace = `export async function POST(request: Request) {
  const auth = await verifyServerPermission("deliveries:create");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = createDeliverySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid delivery record payload.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  let combinedHelperAllowance = parsed.data.helperAllowance;
  let combinedHelperAllowanceStatus = parsed.data.helperAllowanceStatus;
  let combinedHelperDailyRate = parsed.data.helperDailyRate;
  let combinedHelperDailyRateStatus = parsed.data.helperDailyRateStatus;

  if (parsed.data.hasSecondHelper) {
    if (parsed.data.helperAllowanceStatus === "unknown" || parsed.data.helper2AllowanceStatus === "unknown") {
      combinedHelperAllowance = null;
      combinedHelperAllowanceStatus = "unknown";
    } else if (parsed.data.helperAllowanceStatus === "confirmed" || parsed.data.helper2AllowanceStatus === "confirmed") {
      const h1 = parsed.data.helperAllowanceStatus === "confirmed" ? (parsed.data.helperAllowance ?? 0) : 0;
      const h2 = parsed.data.helper2AllowanceStatus === "confirmed" ? (parsed.data.helper2Allowance ?? 0) : 0;
      combinedHelperAllowance = h1 + h2;
      combinedHelperAllowanceStatus = "confirmed";
    } else {
      combinedHelperAllowance = null;
      combinedHelperAllowanceStatus = "not_applicable";
    }

    if (parsed.data.helperDailyRateStatus === "unknown" || parsed.data.helper2DailyRateStatus === "unknown") {
      combinedHelperDailyRate = null;
      combinedHelperDailyRateStatus = "unknown";
    } else if (parsed.data.helperDailyRateStatus === "confirmed" || parsed.data.helper2DailyRateStatus === "confirmed") {
      const r1 = parsed.data.helperDailyRateStatus === "confirmed" ? (parsed.data.helperDailyRate ?? 0) : 0;
      const r2 = parsed.data.helper2DailyRateStatus === "confirmed" ? (parsed.data.helper2DailyRate ?? 0) : 0;
      combinedHelperDailyRate = r1 + r2;
      combinedHelperDailyRateStatus = "confirmed";
    } else {
      combinedHelperDailyRate = null;
      combinedHelperDailyRateStatus = "not_applicable";
    }
  }

  const helperNames = [parsed.data.helperName, parsed.data.helper2Name]
    .filter((n): n is string => Boolean(n && n.trim()))
    .join(", ") || null;

  if (!isSupabaseConfigured()) {`;

// 4. In mock branch, update helper expenses and previewRecord:
const mockRecordTarget = `        helperAllowance: parsed.data.helperAllowance,
        helperDailyRate: parsed.data.helperDailyRate,
        otherExpenses: parsed.data.otherExpenses,
      },
      expenseStates: {
        dieselExpenses: parsed.data.dieselExpensesStatus,
        tollGateExpenses: parsed.data.tollGateExpensesStatus,
        driverAllowance: parsed.data.driverAllowanceStatus,
        driverDailyRate: parsed.data.driverDailyRateStatus,
        helperAllowance: parsed.data.helperAllowanceStatus,
        helperDailyRate: parsed.data.helperDailyRateStatus,
        otherExpenses: parsed.data.otherExpensesStatus,
      },
      dropoffs: parsed.data.dropoffs.map((dropoff, index) => ({
        ...dropoff,
        id: \`\${parsed.data.idempotencyKey}-stop-\${index + 1}\`,
        sequence: index + 1,
      })),
    });
    recordAuditEntry({ actorId: auth.actor.id, actorEmail: auth.actor.email, action: "delivery.created", entityType: "delivery", entityId: record.id, summary: \`Recorded completed delivery \${record.waybillNumber}.\`, changes: { clientName: record.clientName, plateNumber: record.plateNumber, deliveryRate: record.deliveryRate } });
    dynamicMockDeliveries.push({ record, clientId: client.id, truckId: truck.id, driverId: "", helperId: "", scenario: "User-recorded completed delivery." });
    return NextResponse.json({
      ok: true,
      source: "browser-local",
      deliveryId: record.id,
      previewRecord: {
        ...record,
        clientId: client.id,
        truckId: truck.id,
        deliveryStatus: "Completed",
        driverName: null,
        helperName: null,
      },`;

const mockRecordReplace = `        helperAllowance: combinedHelperAllowance,
        helperDailyRate: combinedHelperDailyRate,
        otherExpenses: parsed.data.otherExpenses,
      },
      expenseStates: {
        dieselExpenses: parsed.data.dieselExpensesStatus,
        tollGateExpenses: parsed.data.tollGateExpensesStatus,
        driverAllowance: parsed.data.driverAllowanceStatus,
        driverDailyRate: parsed.data.driverDailyRateStatus,
        helperAllowance: combinedHelperAllowanceStatus,
        helperDailyRate: combinedHelperDailyRateStatus,
        otherExpenses: parsed.data.otherExpensesStatus,
      },
      dropoffs: parsed.data.dropoffs.map((dropoff, index) => ({
        ...dropoff,
        id: \`\${parsed.data.idempotencyKey}-stop-\${index + 1}\`,
        sequence: index + 1,
      })),
    });
    recordAuditEntry({ actorId: auth.actor.id, actorEmail: auth.actor.email, action: "delivery.created", entityType: "delivery", entityId: record.id, summary: \`Recorded completed delivery \${record.waybillNumber}.\`, changes: { clientName: record.clientName, plateNumber: record.plateNumber, deliveryRate: record.deliveryRate } });
    dynamicMockDeliveries.push({ record, clientId: client.id, truckId: truck.id, driverId: "", helperId: "", scenario: "User-recorded completed delivery." });
    return NextResponse.json({
      ok: true,
      source: "browser-local",
      deliveryId: record.id,
      previewRecord: {
        ...record,
        clientId: client.id,
        truckId: truck.id,
        deliveryStatus: "Completed",
        driverName: parsed.data.driverName || null,
        helperName: helperNames,
      },`;

// 5. In Supabase RPC branch:
const supabaseTarget = `  const { data: deliveryId, error } = await supabase.rpc("create_delivery_record", {
    p_record: parsed.data,
    p_dropoffs: parsed.data.dropoffs,
  });`;

const supabaseReplace = `  const { data: deliveryId, error } = await supabase.rpc("create_delivery_record", {
    p_record: {
      ...parsed.data,
      helperAllowance: combinedHelperAllowance,
      helperAllowanceStatus: combinedHelperAllowanceStatus,
      helperDailyRate: combinedHelperDailyRate,
      helperDailyRateStatus: combinedHelperDailyRateStatus,
    },
    p_dropoffs: parsed.data.dropoffs,
  });`;

function applyReplace(text, target, repl, label) {
  const isCRLF = text.includes('\r\n');
  const t = isCRLF ? target.replace(/\r?\n/g, '\r\n') : target.replace(/\r?\n/g, '\n');
  const r = isCRLF ? repl.replace(/\r?\n/g, '\r\n') : repl.replace(/\r?\n/g, '\n');
  if (!text.includes(t)) {
    throw new Error('Target not found for: ' + label);
  }
  return text.replace(t, r);
}

code = applyReplace(code, schemaTarget, schemaReplace, 'schema');
code = applyReplace(code, refineTarget, refineReplace, 'refine');
code = applyReplace(code, postTarget, postReplace, 'post');
code = applyReplace(code, mockRecordTarget, mockRecordReplace, 'mockRecord');
code = applyReplace(code, supabaseTarget, supabaseReplace, 'supabase');

fs.writeFileSync('rrliRev/src/app/api/deliveries/route.ts', code, 'utf8');
console.log('Successfully updated api/deliveries/route.ts with helper 2 support!');
