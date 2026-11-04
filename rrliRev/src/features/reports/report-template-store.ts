/**
 * RouteX Report Template Storage & Management
 *
 * Provides persistence for company-customized report templates across
 * both server-side runtime and client browser localStorage.
 */

import {
  BUILTIN_REPORT_TEMPLATES,
  type ReportTemplate,
} from "./report-template-types.ts";

const LOCAL_STORAGE_KEY = "routex_custom_report_templates";

const globalForTemplates = globalThis as unknown as {
  __routexReportTemplates?: Map<string, ReportTemplate>;
};

function getServerTemplateMap(): Map<string, ReportTemplate> {
  if (!globalForTemplates.__routexReportTemplates) {
    const map = new Map<string, ReportTemplate>();
    for (const tpl of BUILTIN_REPORT_TEMPLATES) {
      map.set(tpl.id, tpl);
    }
    globalForTemplates.__routexReportTemplates = map;
  }
  return globalForTemplates.__routexReportTemplates;
}

/**
 * Lists all available templates (built-in defaults + saved custom formats).
 */
export function listServerReportTemplates(): ReportTemplate[] {
  const map = getServerTemplateMap();
  return Array.from(map.values()).sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Retrieves a specific template by ID.
 */
export function findServerReportTemplateById(id: string): ReportTemplate | null {
  const map = getServerTemplateMap();
  return map.get(id) || null;
}

/**
 * Creates or updates a customized report template.
 * Protected built-in templates cannot be overwritten.
 */
export function saveServerReportTemplate(
  input: Omit<ReportTemplate, "id" | "createdAt" | "updatedAt" | "isDefault"> & {
    id?: string;
    createdBy?: string;
  },
): { ok: true; template: ReportTemplate } | { ok: false; message: string } {
  const map = getServerTemplateMap();
  const now = new Date().toISOString();

  if (input.id) {
    const existing = map.get(input.id);
    if (existing?.isDefault) {
      return { ok: false, message: "Standard built-in report formats cannot be overwritten." };
    }

    if (existing) {
      const updated: ReportTemplate = {
        ...existing,
        ...input,
        id: existing.id,
        isDefault: false,
        updatedAt: now,
      };
      map.set(existing.id, updated);
      return { ok: true, template: updated };
    }
  }

  // Generate new template ID
  const newId = input.id || `custom-tpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const newTemplate: ReportTemplate = {
    ...input,
    id: newId,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };

  map.set(newId, newTemplate);
  return { ok: true, template: newTemplate };
}

/**
 * Deletes a custom report template. Default templates are protected.
 */
export function deleteServerReportTemplate(id: string): { ok: boolean; message?: string } {
  const map = getServerTemplateMap();
  const existing = map.get(id);

  if (!existing) {
    return { ok: false, message: "Report template not found." };
  }

  if (existing.isDefault) {
    return { ok: false, message: "Standard built-in templates cannot be deleted." };
  }

  map.delete(id);
  return { ok: true };
}

// ============================================================================
// Client Browser Storage Sync
// ============================================================================

export function loadClientReportTemplates(): ReportTemplate[] {
  if (typeof window === "undefined") {
    return [...BUILTIN_REPORT_TEMPLATES];
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [...BUILTIN_REPORT_TEMPLATES];

    const parsed = JSON.parse(raw) as ReportTemplate[];
    if (!Array.isArray(parsed)) return [...BUILTIN_REPORT_TEMPLATES];

    // Combine builtins with custom saved templates (preventing duplicate IDs)
    const customOnly = parsed.filter((item) => !item.isDefault);
    return [...BUILTIN_REPORT_TEMPLATES, ...customOnly];
  } catch {
    return [...BUILTIN_REPORT_TEMPLATES];
  }
}

export function saveClientReportTemplate(template: ReportTemplate): void {
  if (typeof window === "undefined") return;

  try {
    const current = loadClientReportTemplates();
    const customOnly = current.filter((item) => !item.isDefault && item.id !== template.id);
    customOnly.push(template);
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(customOnly));
  } catch {
    // Ignore storage quota or disabled errors
  }
}

export function deleteClientReportTemplate(id: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    const current = loadClientReportTemplates();
    const target = current.find((item) => item.id === id);
    if (target?.isDefault) return false;

    const remaining = current.filter((item) => !item.isDefault && item.id !== id);
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(remaining));
    return true;
  } catch {
    return false;
  }
}
