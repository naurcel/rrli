import assert from "node:assert/strict";
import test from "node:test";

import {
  getDeliveryPageRange,
  parseDeliveryListQuery,
} from "./delivery-query.ts";

test("parses delivery filters, sorting, and pagination", () => {
  const parsed = parseDeliveryListQuery(
    new URLSearchParams({
      q: "WB-2610",
      dateFrom: "2026-10-01",
      dateTo: "2026-10-31",
      sort: "net_income",
      direction: "asc",
      page: "3",
      pageSize: "50",
    }),
  );

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.search, "WB-2610");
  assert.equal(parsed.value.sort, "net_income");
  assert.deepEqual(getDeliveryPageRange(parsed.value), { from: 100, to: 149 });
});

test("parses multi-select client and truck filters", () => {
  const parsed = parseDeliveryListQuery(
    new URLSearchParams({
      clientIds: "client-1,client-2",
      truckIds: "truck-a,truck-b",
      financialState: "incomplete",
    }),
  );

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.value.clientIds, ["client-1", "client-2"]);
  assert.deepEqual(parsed.value.truckIds, ["truck-a", "truck-b"]);
  assert.equal(parsed.value.clientId, "client-1");
  assert.equal(parsed.value.truckId, "truck-a");
  assert.equal(parsed.value.financialState, "incomplete");
});

test("rejects reversed date ranges and unsupported page sizes", () => {
  const reversed = parseDeliveryListQuery(
    new URLSearchParams({ dateFrom: "2026-11-01", dateTo: "2026-10-01" }),
  );
  assert.equal(reversed.ok, false);

  const unsupportedPageSize = parseDeliveryListQuery(
    new URLSearchParams({ pageSize: "15" }),
  );
  assert.equal(unsupportedPageSize.ok, false);
});
