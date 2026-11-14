/**
 * RouteX Audit Log UI Utilities and State Change Parsers
 */

export type StateTransition = {
  field: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
};

export type AttributeChange = {
  field: string;
  label: string;
  value: unknown;
};

export type ParsedAuditChanges = {
  transitions: StateTransition[];
  attributes: AttributeChange[];
  hasChanges: boolean;
};

const FIELD_LABEL_MAP: Record<string, string> = {
  oldusername: "Username",
  newusername: "Username",
  username: "Username",
  previoustoll: "Highway Tolls",
  tollgateexpenses: "Highway Tolls",
  clientname: "Client Account",
  platenumber: "Plate Number",
  trucktype: "Truck Type",
  truckownership: "Truck Ownership",
  ownershiptype: "Truck Ownership",
  deliveryrate: "Delivery Revenue",
  netincome: "Net Profit",
  marginpercent: "Profit Margin",
  isactive: "Account Status",
  financialstate: "Financial State",
  origin: "Origin Hub",
  filename: "Attached Document",
  ratebasis: "Rate Basis",
  role: "Assigned Role",
  email: "Email Address",
  phonenumber: "Phone Number",
  roles: "System Roles",
  version: "Record Version",
  dropoffid: "Store Drop-off Reference",
  amount: "Expense Amount",
  expensedate: "Expense Date",
  category: "Expense Category",
  notes: "Expense Notes",
  deletionreason: "Deletion Reason",
};

export function formatAuditFieldLabel(field: string): string {
  const normalized = field.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (FIELD_LABEL_MAP[normalized]) {
    return FIELD_LABEL_MAP[normalized];
  }
  // Convert camelCase or snake_case to Title Case
  const withSpaces = field
    .replace(/^old|^new|^previous/i, "")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  if (!withSpaces) return field;
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

export function formatAuditValue(field: string, value: unknown): string {
  if (value === null || value === undefined) {
    return "None";
  }
  if (typeof value === "boolean") {
    return value ? "Active" : "Inactive";
  }
  if (Array.isArray(value)) {
    return value.map((v) => formatAuditValue(field, v)).join(", ");
  }
  if (typeof value === "number") {
    const lowerField = field.toLowerCase();
    if (
      lowerField.includes("expense") ||
      lowerField.includes("rate") ||
      lowerField.includes("toll") ||
      lowerField.includes("fee") ||
      lowerField.includes("income") ||
      lowerField.includes("cost")
    ) {
      return `₱${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    }
    if (lowerField.includes("margin") || lowerField.includes("percent")) {
      return `${value}%`;
    }
    return value.toLocaleString();
  }
  if (typeof value === "string") {
    const lowerField = field.toLowerCase();
    if (lowerField.includes("username") && !value.startsWith("@")) {
      return `@${value}`;
    }
    if (lowerField === "role") {
      const roleNames: Record<string, string> = {
        admin: "Admin",
        operations: "Operations",
        finance: "Finance",
        hr: "HR",
        secretary: "Secretary",
        customer_representative: "Customer Representative",
      };
      return roleNames[value.toLowerCase()] || value;
    }
    return value;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Extracts clean old/new state transitions and itemized attributes
 * from an audit entry's raw changes payload.
 */
export function extractStateChanges(changes?: Record<string, unknown> | null): ParsedAuditChanges {
  if (!changes || typeof changes !== "object" || Object.keys(changes).length === 0) {
    return { transitions: [], attributes: [], hasChanges: false };
  }

  const transitions: StateTransition[] = [];
  const attributes: AttributeChange[] = [];
  const handledKeys = new Set<string>();

  // Check for top-level before/after or old/new objects
  const beforeObj = (changes.before ?? changes.old ?? changes.previous) as Record<string, unknown> | undefined;
  const afterObj = (changes.after ?? changes.new ?? changes.current) as Record<string, unknown> | undefined;

  if (beforeObj && typeof beforeObj === "object" && afterObj && typeof afterObj === "object") {
    handledKeys.add("before").add("after").add("old").add("new").add("previous").add("current");
    const allKeys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);
    for (const key of allKeys) {
      const oldVal = beforeObj[key];
      const newVal = afterObj[key];
      if (oldVal !== newVal) {
        transitions.push({
          field: key,
          label: formatAuditFieldLabel(key),
          oldValue: oldVal,
          newValue: newVal,
        });
      }
    }
  }

  // Look for paired keys like oldUsername / newUsername, previousToll / tollGateExpenses
  const keys = Object.keys(changes).filter((k) => !handledKeys.has(k));

  for (const key of keys) {
    if (handledKeys.has(key)) continue;

    // Pattern 1: oldX / newX
    if (/^old[A-Z_]/i.test(key)) {
      const baseName = key.replace(/^old_?/i, "");
      const newKey = keys.find((k) => k.toLowerCase() === `new${baseName.toLowerCase()}` || k.toLowerCase() === `new_${baseName.toLowerCase()}`);
      if (newKey) {
        transitions.push({
          field: baseName,
          label: formatAuditFieldLabel(baseName),
          oldValue: changes[key],
          newValue: changes[newKey],
        });
        handledKeys.add(key).add(newKey);
        continue;
      }
    }

    // Pattern 2: previousX / currentX or previousX / x
    if (/^previous[A-Z_]/i.test(key)) {
      const baseName = key.replace(/^previous_?/i, "");
      const currentKey = keys.find(
        (k) =>
          k.toLowerCase() === baseName.toLowerCase() ||
          k.toLowerCase() === `current${baseName.toLowerCase()}` ||
          (baseName.toLowerCase() === "toll" && k.toLowerCase() === "tollgateexpenses"),
      );
      if (currentKey) {
        transitions.push({
          field: currentKey,
          label: formatAuditFieldLabel(currentKey),
          oldValue: changes[key],
          newValue: changes[currentKey],
        });
        handledKeys.add(key).add(currentKey);
        continue;
      }
    }

    // Pattern 3: direct field matching with an old/previous variant
    const oldPairKey = keys.find(
      (k) =>
        k.toLowerCase() === `old${key.toLowerCase()}` ||
        k.toLowerCase() === `previous${key.toLowerCase()}` ||
        (key.toLowerCase() === "tollgateexpenses" && k.toLowerCase() === "previoustoll"),
    );
    if (oldPairKey && !handledKeys.has(oldPairKey)) {
      transitions.push({
        field: key,
        label: formatAuditFieldLabel(key),
        oldValue: changes[oldPairKey],
        newValue: changes[key],
      });
      handledKeys.add(key).add(oldPairKey);
      continue;
    }
  }

  // Collect all remaining keys as itemized attribute changes
  for (const key of keys) {
    if (handledKeys.has(key)) continue;
    attributes.push({
      field: key,
      label: formatAuditFieldLabel(key),
      value: changes[key],
    });
  }

  return {
    transitions,
    attributes,
    hasChanges: transitions.length > 0 || attributes.length > 0,
  };
}

/**
 * Human-friendly labels for audit actions to eliminate raw code terms.
 */
export const AUDIT_ACTION_HUMAN_LABELS: Record<string, string> = {
  "all": "All Actions",
  "delivery.created": "Delivery Recorded",
  "delivery.financials_finalized": "Financials Finalized",
  "delivery.financials_corrected": "Financial Correction",
  "delivery.batch_imported": "Excel Batch Import",
  "document.uploaded": "Document Uploaded",
  "truck.created": "Truck Registered",
  "truck.updated": "Truck Updated",
  "user.created": "User Provisioned",
  "user.status_changed": "Status Updated",
  "user.role_changed": "Role Updated",
  "user.username_changed": "Username Changed",
  "user.username_changed_by_admin": "Username Changed (Admin)",
  "user.password_changed": "Password Changed",
  "user.password_recovered": "Password Recovered",
  "user.recovery_authorized": "Reset Window Authorized",
};

/**
 * Human-friendly labels for audit entity types.
 */
export const AUDIT_ENTITY_HUMAN_LABELS: Record<string, string> = {
  "all": "All Entities",
  "delivery": "Deliveries",
  "truck": "Fleet Trucks",
  "user": "Staff Accounts",
  "import_batch": "Import Batches",
  "system": "System Settings",
};

export function formatAuditActionLabel(action: string): string {
  if (AUDIT_ACTION_HUMAN_LABELS[action]) return AUDIT_ACTION_HUMAN_LABELS[action];
  return action
    .replace(/^([a-z]+)\./i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatAuditEntityLabel(entityType: string): string {
  const norm = entityType.toLowerCase();
  if (AUDIT_ENTITY_HUMAN_LABELS[norm]) {
    return AUDIT_ENTITY_HUMAN_LABELS[norm];
  }
  return norm.charAt(0).toUpperCase() + norm.slice(1);
}

export function formatAuditActor(emailOrUsername?: string | null): string {
  if (!emailOrUsername) return "@system";
  const cleaned = emailOrUsername.trim();
  const withoutLeadingAt = cleaned.startsWith("@") ? cleaned.slice(1) : cleaned;
  const username = withoutLeadingAt.includes("@") ? withoutLeadingAt.split("@")[0] : withoutLeadingAt;
  return `@${username || "system"}`;
}

/**
 * Returns consistent tone and icon representation for audit actions.
 */
export function getActionVisuals(action: string): {
  className: string;
  badgeLabel: string;
  category: "create" | "update" | "delete" | "security" | "finalize";
} {
  const norm = action.toLowerCase();
  const label = formatAuditActionLabel(action);
  if (norm.includes("created") || norm.includes("bootstrap") || norm.includes("batch_imported")) {
    return { className: "attached", badgeLabel: label, category: "create" };
  }
  if (norm.includes("finalized")) {
    return { className: "info", badgeLabel: label, category: "finalize" };
  }
  if (norm.includes("deleted")) {
    return { className: "warning", badgeLabel: label, category: "delete" };
  }
  if (norm.includes("corrected") || norm.includes("updated") || norm.includes("status_changed")) {
    return { className: "attention", badgeLabel: label, category: "update" };
  }
  if (
    norm.includes("password") ||
    norm.includes("recovery") ||
    norm.includes("security") ||
    norm.includes("username_changed")
  ) {
    return { className: "security", badgeLabel: label, category: "security" };
  }
  return { className: "neutral", badgeLabel: label, category: "update" };
}
