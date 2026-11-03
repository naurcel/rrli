import { NextResponse } from "next/server";
import { verifyServerPermission } from "@/lib/auth/server-session";
import { isSupabaseConfigured } from "@/lib/config/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SMALL_MOCK_DATABASE } from "@/features/deliveries/small-mock-database";
import { derivePodVerificationStatus } from "@/features/deliveries/delivery-domain";
import { getAllMockDeliveries } from "@/features/deliveries/small-mock-repository";

type MutableMockDoc = {
  id: string;
  deliveryId: string;
  dropoffId: string;
  requirementKey: "proof_of_delivery";
  label: string;
  status: string;
  storagePath: string | null;
  originalFilename: string | null;
  mimeType: "application/pdf" | null;
  sizeBytes: number | null;
  verificationNotes: string | null;
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
    const doc = extraDoc ?? SMALL_MOCK_DATABASE.documents.find(
      (d) => d.deliveryId === deliveryId && d.dropoffId === dropoffId,
    );
    if (!doc) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND", message: "Document record not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      document: {
        id: doc.id,
        filename: doc.originalFilename ?? `${doc.label}.pdf`,
        status: doc.status,
        notes: doc.verificationNotes,
        downloadUrl: null, // Simulated in bundled mock
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
        .createSignedUrl(doc.storage_path, 120); // 2-minute signed URL
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
 * Handles POD document upload, verification, or rejection.
 * Enforces server-side `pod:verify` permission (restricted strictly to Admin and Operations).
 */
export async function POST(request: Request) {
  const auth = await verifyServerPermission("pod:verify");
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
  const action = String(formData.get("action") || "upload").trim(); // "upload" | "verify" | "reject"
  const notes = String(formData.get("notes") || "").trim();
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

  const isVerified = action === "verify";
  const isRejected = action === "reject";
  const newStatus = isVerified ? "Verified" : isRejected ? "Rejected" : "Submitted";
  const originalFilename = file && file.name ? file.name : `POD-${deliveryId.slice(0, 8)}.pdf`;

  if (!isSupabaseConfigured()) {
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

    dropoff.podSubmitted = !isRejected;
    dropoff.supportingDocsComplete = isVerified;
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
        mimeType: "application/pdf",
        sizeBytes: file ? file.size : 102400,
        verificationNotes: notes || null,
      };
      extraMockDocuments.set(key, newDoc);
      doc = newDoc;
    } else {
      doc.status = newStatus;
      doc.originalFilename = originalFilename;
      doc.verificationNotes = notes || doc.verificationNotes;
      extraMockDocuments.set(key, doc);
    }

    delivery.record.podStatus = derivePodVerificationStatus(delivery.record.dropoffs);
    delivery.record.version += 1;

    return NextResponse.json({
      ok: true,
      document: {
        id: doc.id,
        filename: originalFilename,
        status: newStatus,
        notes: doc.verificationNotes,
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
      verification_notes: notes || null,
      uploaded_by: auth.actor.id,
      uploaded_at: now,
      verified_by: isVerified ? auth.actor.id : null,
      verified_at: isVerified ? now : null,
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
        { ok: false, code: "DOC_RECORD_FAILED", message: docError.message },
        { status: 500 },
      );
    }

    // Update dropoff stop in public.delivery_dropoffs
    await supabase
      .from("delivery_dropoffs")
      .update({
        pod_submitted: !isRejected,
        supporting_docs_complete: isVerified,
        document_ref: originalFilename,
      })
      .eq("id", dropoffId);

    return NextResponse.json({
      ok: true,
      document: docData,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: "SERVER_ERROR",
        message: err instanceof Error ? err.message : "Document operation failed.",
      },
      { status: 500 },
    );
  }
}
