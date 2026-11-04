import assert from "node:assert/strict";
import test from "node:test";

import {
  isImageDocument,
  generateMockPodSvgReceipt,
  type PodReceiptDeliveryMeta,
  type PodReceiptDropoffMeta,
} from "./pod-utils.ts";
import { SMALL_MOCK_DATABASE } from "./small-mock-database.ts";

test("isImageDocument correctly classifies SVG data URLs, images, and PDFs", () => {
  // SVG receipt data URL with a .pdf filename (mock local mode generated receipt)
  const svgDataUrl = "data:image/svg+xml;utf8,%3Csvg%3E%3C%2Fsvg%3E";
  assert.equal(isImageDocument(svgDataUrl, "SAMPLE-POD-VGD-06A.pdf"), true);

  // Direct image types
  assert.equal(isImageDocument(null, "signed-receipt.png"), true);
  assert.equal(isImageDocument(null, "delivery_pod.jpg"), true);
  assert.equal(isImageDocument(null, "receipt.jpeg"), true);
  assert.equal(isImageDocument(null, "proof.webp"), true);
  assert.equal(isImageDocument(null, "document.svg"), true);
  assert.equal(isImageDocument("data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==", "scan.png"), true);

  // Pure PDF documents without image data URL
  assert.equal(isImageDocument(null, "proof-of-delivery.pdf"), false);
  assert.equal(
    isImageDocument("data:application/pdf;base64,JVBERi0xLjQK...", "proof-of-delivery.pdf"),
    false,
  );
  assert.equal(isImageDocument("https://storage.example.com/pod.pdf", "pod.pdf"), false);

  // Empty or invalid inputs
  assert.equal(isImageDocument(null, null), false);
  assert.equal(isImageDocument("", ""), false);
  assert.equal(isImageDocument(undefined, undefined), false);
});

test("generateMockPodSvgReceipt produces a comprehensive, valid vector document", () => {
  const delivery: PodReceiptDeliveryMeta = {
    waybillNumber: "WB-261102",
    clientName: "Vanguard Commercial Goods",
    deliveryDate: "2026-11-02",
    plateNumber: "CBZ 1187",
    truckType: "6-Wheeler Closed Van",
  };

  const dropoff: PodReceiptDropoffMeta = {
    storeName: "Waltermart Makiling Branch",
    destinationArea: "Makiling, Calamba",
    sequence: 1,
    entryFee: 250,
  };

  const filename = "SAMPLE-POD-VGD-06A.pdf";
  const dataUrl = generateMockPodSvgReceipt(delivery, dropoff, filename);

  assert.ok(dataUrl.startsWith("data:image/svg+xml;utf8,"));

  const decodedSvg = decodeURIComponent(dataUrl.replace("data:image/svg+xml;utf8,", ""));

  // Verify critical operational elements
  assert.ok(decodedSvg.includes("REDEEMED ROUTE LOGISTICS INC."));
  assert.ok(decodedSvg.includes("OFFICIAL PROOF OF DELIVERY RECEIPT (POD)"));
  assert.ok(decodedSvg.includes("WB-261102"));
  assert.ok(decodedSvg.includes("Vanguard Commercial Goods"));
  assert.ok(decodedSvg.includes("2026-11-02"));
  assert.ok(decodedSvg.includes("CBZ 1187"));
  assert.ok(decodedSvg.includes("6-Wheeler Closed Van"));
  assert.ok(decodedSvg.includes("Waltermart Makiling Branch"));
  assert.ok(decodedSvg.includes("Makiling, Calamba"));
  assert.ok(decodedSvg.includes("PHP 250"));
  assert.ok(decodedSvg.includes("STOP #1"));
  assert.ok(decodedSvg.includes("STORE RECEIVING"));
  assert.ok(decodedSvg.includes("RECEIVED &amp; VERIFIED"));
  assert.ok(decodedSvg.includes("POD-WB-261102-1"));
  assert.ok(decodedSvg.includes(filename));
});

test("small mock database contains expected drop-off POD attachments and missing states", () => {
  const allDropoffs = SMALL_MOCK_DATABASE.deliveries.flatMap((d) => d.record.dropoffs);

  // Ensure there are both attached PODs and missing PODs to test both states
  const attachedStops = allDropoffs.filter((d) => d.podSubmitted && d.documentRef);
  const missingStops = allDropoffs.filter((d) => !d.podSubmitted);

  assert.ok(attachedStops.length > 0, "There must be stops with attached PODs");
  assert.ok(missingStops.length > 0, "There must be stops with missing PODs for empty state testing");

  // Every attached stop must have a non-empty document reference
  for (const stop of attachedStops) {
    assert.ok(stop.documentRef && stop.documentRef.length > 0);
  }

  // Missing stops should have clear pending or absent document status
  for (const stop of missingStops) {
    assert.equal(stop.podSubmitted, false);
  }
});