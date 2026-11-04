import { NextResponse } from "next/server";

import { recordAuditEntry } from "@/lib/audit/server-audit-store";
import { canManageReportTemplates } from "@/lib/auth/rbac";
import { verifyServerPermission } from "@/lib/auth/server-session";
import {
  deleteServerReportTemplate,
  listServerReportTemplates,
  saveServerReportTemplate,
} from "@/features/reports/report-template-store";
import type { ReportTemplate } from "@/features/reports/report-template-types";

export async function GET() {
  const auth = await verifyServerPermission("reports:view");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const templates = listServerReportTemplates();
  return NextResponse.json({ ok: true, templates });
}

export async function POST(request: Request) {
  const auth = await verifyServerPermission("reports:view");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  // RBAC Enforcement: Only Admin users can configure & save report format layouts
  if (!canManageReportTemplates(auth.actor.role)) {
    return NextResponse.json(
      {
        ok: false,
        code: "FORBIDDEN",
        message: "Only System Administrators are authorized to configure and save report formats.",
      },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as Partial<ReportTemplate> | null;
  if (!body || !body.name || !body.baseType || !body.layout || !Array.isArray(body.columns)) {
    return NextResponse.json(
      { ok: false, message: "Invalid report template configuration payload." },
      { status: 400 },
    );
  }

  const isUpdate = Boolean(body.id && !body.id.startsWith("custom-tpl-temp"));
  const res = saveServerReportTemplate({
    id: body.id,
    name: body.name.trim(),
    description: body.description?.trim() || "Custom company report layout.",
    baseType: body.baseType,
    layout: body.layout,
    columns: body.columns,
    breakdown: body.breakdown || {
      showGrossEarnings: true,
      showTotalExpenses: true,
      showNetProfit: true,
      showProfitMargin: true,
      showActiveTrucks: true,
      showStoreDropoffs: true,
      showDieselExpenses: false,
      showTollExpenses: false,
      showCrewCosts: false,
    },
    filters: body.filters || {
      financialState: "finalized_only",
      truckOwnership: "all",
    },
    createdBy: auth.actor.username || auth.actor.fullName,
  });

  if (!res.ok) {
    return NextResponse.json({ ok: false, message: res.message }, { status: 400 });
  }

  recordAuditEntry({
    actorId: auth.actor.id,
    actorEmail: auth.actor.email,
    action: isUpdate ? "report_template.updated" : "report_template.created",
    entityType: "report_template",
    entityId: res.template.id,
    summary: `${isUpdate ? "Updated" : "Created"} custom report template "${res.template.name}" (${res.template.baseType}).`,
    changes: {
      templateName: res.template.name,
      baseType: res.template.baseType,
      columns: res.template.columns.map((c) => ({ id: c.id, label: c.customLabel, order: c.order, visible: c.visible })),
    },
  });

  return NextResponse.json({ ok: true, template: res.template });
}

export async function DELETE(request: Request) {
  const auth = await verifyServerPermission("reports:view");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  // RBAC Enforcement: Only Admin users can delete report format templates
  if (!canManageReportTemplates(auth.actor.role)) {
    return NextResponse.json(
      {
        ok: false,
        code: "FORBIDDEN",
        message: "Only System Administrators are authorized to delete report format templates.",
      },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ ok: false, message: "Template ID is required." }, { status: 400 });
  }

  const res = deleteServerReportTemplate(id);
  if (!res.ok) {
    return NextResponse.json({ ok: false, message: res.message }, { status: 400 });
  }

  recordAuditEntry({
    actorId: auth.actor.id,
    actorEmail: auth.actor.email,
    action: "report_template.deleted",
    entityType: "report_template",
    entityId: id,
    summary: `Deleted custom report template ID ${id}.`,
  });

  return NextResponse.json({ ok: true, message: "Template deleted successfully." });
}
