import assert from "node:assert/strict";
import test from "node:test";

import {
  appendQueryParam,
  deriveReturnLabel,
  isValidInternalReturnPath,
  resolveReturnTarget,
  withReturnContext,
} from "./return-context.ts";

test("isValidInternalReturnPath accepts internal relative routes and rejects external/unsafe paths", () => {
  assert.equal(isValidInternalReturnPath("/deliveries"), true);
  assert.equal(
    isValidInternalReturnPath("/deliveries?search=Landers&status=incomplete&page=2"),
    true,
  );
  assert.equal(
    isValidInternalReturnPath("/truck-profitability/DAA%207310?sort=deliveryDate:desc"),
    true,
  );
  assert.equal(isValidInternalReturnPath(null), false);
  assert.equal(isValidInternalReturnPath(""), false);
  assert.equal(isValidInternalReturnPath("https://evil.example/phish"), false);
  assert.equal(isValidInternalReturnPath("//evil.example/phish"), false);
  assert.equal(isValidInternalReturnPath("/\\evil.example"), false);
});

test("deriveReturnLabel produces human-readable Back labels across RouteX sections", () => {
  assert.equal(
    deriveReturnLabel("/dashboard?dateFrom=2026-10-01", "Dashboard", "Back to deliveries"),
    "Back to Dashboard",
  );
  assert.equal(
    deriveReturnLabel(
      "/truck-profitability/DAA%207310?truckPage=2",
      "DAA 7310",
      "Back to deliveries",
    ),
    "Back to DAA 7310",
  );
  assert.equal(
    deriveReturnLabel("/truck-profitability?view=crew&crewQ=Santos", null, "Back"),
    "Back to Crew",
  );
  assert.equal(
    deriveReturnLabel("/truck-profitability?class=Cold&page=2", null, "Back"),
    "Back to Trucks",
  );
  assert.equal(
    deriveReturnLabel("/deliveries?search=Landers&status=completed", null, "Back"),
    "Back to Deliveries",
  );
  assert.equal(
    deriveReturnLabel("/pod-documents?status=Missing+POD", null, "Back"),
    "Back to POD Documents",
  );
});

test("resolveReturnTarget preserves full query parameters or falls back safely", () => {
  const fromFilteredLedger = resolveReturnTarget({
    returnTo: "/deliveries?search=Otis&status=incomplete&sort=net_income:asc&page=3",
    returnLabel: "Deliveries",
    fallbackHref: "/deliveries",
    fallbackLabel: "Back to deliveries",
  });
  assert.equal(
    fromFilteredLedger.href,
    "/deliveries?search=Otis&status=incomplete&sort=net_income:asc&page=3",
  );
  assert.equal(fromFilteredLedger.label, "Back to Deliveries");

  const directFallback = resolveReturnTarget({
    returnTo: "https://external.site/bad",
    returnLabel: "External",
    fallbackHref: "/deliveries",
    fallbackLabel: "Back to deliveries",
  });
  assert.equal(directFallback.href, "/deliveries");
  assert.equal(directFallback.label, "Back to deliveries");
});

test("withReturnContext and appendQueryParam preserve nested navigation chains", () => {
  const dashboardUrl = "/dashboard?sort=revenue:desc&dateFrom=2026-10-01&dateTo=2026-10-31";
  const truckUrl = withReturnContext(
    "/truck-profitability/DAA%207310?from=dashboard",
    dashboardUrl,
    "Dashboard",
  );

  const deliveryUrl = withReturnContext(
    "/deliveries/trip-101?from=truck&truck=DAA+7310",
    truckUrl,
    "DAA 7310",
  );

  const editUrl = withReturnContext(
    "/deliveries/trip-101/edit",
    deliveryUrl,
    "Waybill #WB-101",
  );

  // Step 1: Back from Edit returns to Delivery with its full query string and returnTo=truckUrl
  const editParams = new URLSearchParams(editUrl.split("?")[1]);
  const backFromEdit = resolveReturnTarget({
    returnTo: editParams.get("returnTo"),
    returnLabel: editParams.get("returnLabel"),
    fallbackHref: "/deliveries/trip-101",
    fallbackLabel: "Back to delivery",
  });
  assert.equal(backFromEdit.href, deliveryUrl);
  assert.equal(backFromEdit.label, "Back to Waybill #WB-101");

  // Saving Edit appends updated=1 without losing returnTo
  const savedDeliveryUrl = appendQueryParam(backFromEdit.href, "updated", "1");
  const deliveryParams = new URLSearchParams(savedDeliveryUrl.split("?")[1]);
  assert.equal(deliveryParams.get("updated"), "1");
  assert.equal(deliveryParams.get("from"), "truck");

  // Step 2: Back from Delivery returns to Truck Profile with its returnTo=dashboardUrl
  const backFromDelivery = resolveReturnTarget({
    returnTo: deliveryParams.get("returnTo"),
    returnLabel: deliveryParams.get("returnLabel"),
    fallbackHref: "/deliveries",
    fallbackLabel: "Back to deliveries",
  });
  assert.equal(backFromDelivery.href, truckUrl);
  assert.equal(backFromDelivery.label, "Back to DAA 7310");

  // Step 3: Back from Truck Profile returns to Dashboard with its sort & date range
  const truckParams = new URLSearchParams(backFromDelivery.href.split("?")[1]);
  const backFromTruck = resolveReturnTarget({
    returnTo: truckParams.get("returnTo"),
    returnLabel: truckParams.get("returnLabel"),
    fallbackHref: "/truck-profitability",
    fallbackLabel: "Back to trucks",
  });
  assert.equal(backFromTruck.href, dashboardUrl);
  assert.equal(backFromTruck.label, "Back to Dashboard");
});
