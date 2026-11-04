import { NextResponse } from "next/server";

import { recordAuditEntry } from "@/lib/audit/server-audit-store";
import { verifyServerPermission } from "@/lib/auth/server-session";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SMALL_MOCK_DATABASE } from "@/features/deliveries/small-mock-database";
import { derivePodVerificationStatus } from "@/features/deliveries/delivery-domain";
import { getAllMockDeliveries } from "@/features/deliveries/small-mock-repository";
import { generateMockPodSvgReceipt } from "@/features/deliveries/pod-utils";

type MutableMockDoc = {
  id: string;
  deliveryId: string;
  dropoffId: string;
  requirementKey: "proof_of_delivery";
  label: string;
  status: string;
  storagePath: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  verificationNotes: string | null;
  dataUrl?: string | null;
};

const extraMockDocuments = new Map<string, MutableMockDoc>();

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * GET /api/deliveries/documents?deliveryId=...&dropoffId=...
 * Generates a short-lived private signed URL for authenticated staff to view/download a POD.
 * Generates a private signed download/preview URL for authenticated staff to view a POD.
 * Enforces server-side `pod:view` permission (accessible by all 6 authenticated roles).
 */
export async function GET(request: Request) {
  const auth = await verifyServerPermission("pod:view");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const { searchParams } = new URL(request.url);
  const deliveryId = searchParams.get("deliveryId");
  const dropoffId = searchParams.get("dropoffId");

  if (!deliveryId || !dropoffId) {
    return NextResponse.json(
      { ok: false, code: "INVALID_PARAMETERS", message: "deliveryId and dropoffId are required." },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured()) {
    const key = `${deliveryId}:${dropoffId}`;
    const extraDoc = extraMockDocuments.get(key);

    // Look up delivery and drop-off in mock database
    const delivery = getAllMockDeliveries().find((d) => d.record.id === deliveryId);
    const dropoff = delivery?.record.dropoffs.find((s) => s.id === dropoffId);

    const doc = extraDoc ?? SMALL_MOCK_DATABASE.documents.find(
      (d) => d.deliveryId === deliveryId && d.dropoffId === dropoffId,
    );
    if (!doc && !dropoff) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND", message: "Document record not found." },
        { status: 404 },
      );
    }

    const filename =
      extraDoc?.originalFilename ??
      doc?.originalFilename ??
      dropoff?.documentRef ??
      "proof-of-delivery.pdf";

    const isAttached = Boolean(
      dropoff ? dropoff.podSubmitted : doc?.status === "Attached",
    );

    // Generate real preview URL when attached
    let downloadUrl: string | null = null;
    if (isAttached) {
      if (extraDoc?.dataUrl) {
        downloadUrl = extraDoc.dataUrl;
      } else {
        downloadUrl = generateMockPodSvgReceipt(delivery?.record, dropoff, filename);
      }
    }

    return NextResponse.json({
      ok: true,
      document: {
        id: doc?.id ?? extraDoc?.id ?? `doc-${deliveryId}-${dropoffId}`,
        filename,
        status: isAttached ? "Attached" : "Missing",
        notes: doc?.verificationNotes ?? null,
        downloadUrl,
        isMock: true,
      },
    });
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data: doc, error } = await supabase
      .from("delivery_documents")
      .select("id, status, storage_path, original_filename, verification_notes")
      .eq("delivery_id", deliveryId)
      .eq("dropoff_id", dropoffId)
      .maybeSingle();

    if (error || !doc) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND", message: "Document record not found." },
        { status: 404 },
      );
    }

    let downloadUrl: string | null = null;
    if (doc.storage_path) {
      const { data: signed } = await supabase.storage
        .from("delivery-documents")
        .createSignedUrl(doc.storage_path, 300); // 5-minute signed URL
      downloadUrl = signed?.signedUrl ?? null;
    }

    return NextResponse.json({
      ok: true,
      document: {
        id: doc.id,
        filename: doc.original_filename ?? "pod-document.pdf",
        status: doc.status,
        notes: doc.verification_notes,
        downloadUrl,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: "DOCUMENT_FETCH_FAILED",
        message: err instanceof Error ? err.message : "Unable to retrieve document.",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/deliveries/documents
 * Handles POD document upload or replacement.
 * Enforces server-side `deliveries:edit` permission (restricted strictly to Admin and Operations).
 */
export async function POST(request: Request) {
  const auth = await verifyServerPermission("deliveries:edit");
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, code: auth.code, message: auth.message },
      { status: auth.status },
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json(
      { ok: false, code: "INVALID_BODY", message: "Expected multipart/form-data payload." },
      { status: 400 },
    );
  }

  const deliveryId = String(formData.get("deliveryId") || "").trim();
  const dropoffId = String(formData.get("dropoffId") || "").trim();
  const file = formData.get("file") as File | null;

  if (!deliveryId || !dropoffId) {
    return NextResponse.json(
      { ok: false, code: "VALIDATION_ERROR", message: "deliveryId and dropoffId are required." },
      { status: 400 },
    );
  }

  // Validate uploaded file if provided
  if (file && typeof file === "object" && file.size > 0) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { ok: false, code: "FILE_TOO_LARGE", message: "Uploaded document must not exceed 10MB." },
        { status: 400 },
      );
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          ok: false,
          code: "INVALID_FILE_TYPE",
          message: "Only PDF, JPEG, and PNG document formats are supported.",
        },
        { status: 400 },
      );
    }
  }

  const newStatus = "Attached";
  const originalFilename = file && file.name ? file.name : `POD-${deliveryId.slice(0, 8)}.pdf`;

  if (!isSupabaseConfigured()) {
    // Convert uploaded file to base64 data URL for preview rendering
    let dataUrl: string | null = null;
    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const mime = file.type || "application/pdf";
      dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
    }

    // Update mock delivery in memory
    const delivery = getAllMockDeliveries().find((d) => d.record.id === deliveryId);
    if (!delivery) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND", message: "Delivery trip record not found." },
        { status: 404 },
      );
    }

    const dropoff = delivery.record.dropoffs.find((s) => s.id === dropoffId);
    if (!dropoff) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND", message: "Store drop-off stop not found." },
        { status: 404 },
      );
    }

    dropoff.podSubmitted = true;
    dropoff.documentRef = originalFilename;

    const key = `${deliveryId}:${dropoffId}`;
    let doc = extraMockDocuments.get(key) ?? (SMALL_MOCK_DATABASE.documents.find(
      (d) => d.deliveryId === deliveryId && d.dropoffId === dropoffId,
    ) as MutableMockDoc | undefined);

    if (!doc) {
      const newDoc: MutableMockDoc = {
        id: `doc-${Date.now()}`,
        deliveryId,
        dropoffId,
        requirementKey: "proof_of_delivery",
        label: "Proof of Delivery (Signed)",
        status: newStatus,
        storagePath: `pod/${deliveryId}/${dropoffId}/${originalFilename}`,
        originalFilename,
        mimeType: file?.type || "application/pdf",
        sizeBytes: file ? file.size : 102400,
        verificationNotes: null,
        dataUrl,
      };
      extraMockDocuments.set(key, newDoc);
      doc = newDoc;
    } else {
      doc.status = newStatus;
      doc.originalFilename = originalFilename;
      doc.dataUrl = dataUrl;
      extraMockDocuments.set(key, doc);
    }

    delivery.record.podStatus = derivePodVerificationStatus(delivery.record.dropoffs);
    delivery.record.version += 1;

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: "document.uploaded",
      entityType: "delivery",
      entityId: deliveryId,
      summary: `Uploaded POD for stop #${dropoff.sequence} (${dropoff.storeName}).`,
      changes: { dropoffId, filename: originalFilename },
    });

    return NextResponse.json({
      ok: true,
      document: {
        id: doc.id,
        filename: originalFilename,
        status: newStatus,
        notes: null,
        downloadUrl: dataUrl,
      },
      dropoff: {
        id: dropoff.id,
        podSubmitted: dropoff.podSubmitted,
        supportingDocsComplete: dropoff.supportingDocsComplete,
        documentRef: dropoff.documentRef,
      },
      tripPodStatus: delivery.record.podStatus,
    });
  }

  try {
    const supabase = await createServerSupabaseClient();

    let storagePath: string | null = null;
    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      storagePath = `${deliveryId}/${dropoffId}/${Date.now()}_${cleanName}`;

      const { error: uploadError } = await supabase.storage
        .from("delivery-documents")
        .upload(storagePath, bytes, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        return NextResponse.json(
          { ok: false, code: "STORAGE_UPLOAD_FAILED", message: uploadError.message },
          { status: 500 },
        );
      }
    }

    const now = new Date().toISOString();
    const documentUpsert = {
      delivery_id: deliveryId,
      dropoff_id: dropoffId,
      requirement_key: "proof_of_delivery",
      label: "Proof of Delivery (Signed)",
      status: newStatus,
      original_filename: originalFilename,
      mime_type: file?.type ?? "application/pdf",
      size_bytes: file?.size ?? null,
      verification_notes: null,
      uploaded_by: auth.actor.id,
      uploaded_at: now,
      updated_at: now,
      ...(storagePath ? { storage_path: storagePath } : {}),
    };

    const { data: docData, error: docError } = await supabase
      .from("delivery_documents")
      .upsert(documentUpsert, { onConflict: "delivery_id,dropoff_id,requirement_key" })
      .select()
      .single();

    if (docError) {
      return NextResponse.json(
        { ok: false, code: "DATABASE_ERROR", message: docError.message },
        { status: 500 },
      );
    }

    // Update stop pod_submitted flag
    await supabase
      .from("delivery_dropoffs")
      .update({
        pod_submitted: true,
        document_ref: originalFilename,
      })
      .eq("id", dropoffId);

    // Generate signed download URL
    let downloadUrl: string | null = null;
    if (storagePath) {
      const { data: signed } = await supabase.storage
        .from("delivery-documents")
        .createSignedUrl(storagePath, 300);
      downloadUrl = signed?.signedUrl ?? null;
    }

    recordAuditEntry({
      actorId: auth.actor.id,
      actorEmail: auth.actor.email,
      action: "document.uploaded",
      entityType: "delivery",
      entityId: deliveryId,
      summary: `Uploaded POD for delivery ${deliveryId}.`,
      changes: { dropoffId, filename: originalFilename },
    });

    return NextResponse.json({
      ok: true,
      document: {
        id: docData?.id ?? `doc-${deliveryId}-${dropoffId}`,
        filename: originalFilename,
        status: newStatus,
        downloadUrl,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : "Document upload failed.",
      },
      { status: 500 },
    );
  }
}
