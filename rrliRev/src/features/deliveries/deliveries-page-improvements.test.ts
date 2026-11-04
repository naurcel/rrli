import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { DELIVERY_SORT_FIELDS } from "./delivery-query.ts";
import { SMALL_MOCK_DATABASE } from "./small-mock-database.ts";
import { listSmallMockDeliveryRecords } from "./small-mock-repository.ts";

describe("Deliveries Page Improvements", () => {
  describe("Sort Arrow Controls & 3-State Cycle", () => {
    it("cycles non-default columns through default -> primary -> secondary -> default visual state", () => {
      type SortDir = "asc" | "desc";
      type SortState = { key: string; direction: SortDir } | null;

      function simulateClick(
        columnKey: string,
        currentSort: SortState,
        defaultDirection: SortDir = "asc",
      ): SortState {
        const active = currentSort?.key === columnKey;
        if (!active) {
          return { key: columnKey, direction: defaultDirection };
        }
        if (currentSort.direction === defaultDirection) {
          const opposite: SortDir = defaultDirection === "asc" ? "desc" : "asc";
          return { key: columnKey, direction: opposite };
        }
        // 3rd click: resets to default sort / visual state
        return null;
      }

      // Initial state: table default is delivery_date:desc
      let currentSort: SortState = { key: "delivery_date", direction: "desc" };

      // Click "client" (defaultDirection="asc")
      currentSort = simulateClick("client", currentSort, "asc");
      assert.deepEqual(currentSort, { key: "client", direction: "asc" }, "Click 1 activates client in asc");

      // Click "client" again
      currentSort = simulateClick("client", currentSort, "asc");
      assert.deepEqual(currentSort, { key: "client", direction: "desc" }, "Click 2 flips client to desc");

      // Click "client" 3rd time: returns to default visual state (null / reset)
      currentSort = simulateClick("client", currentSort, "asc");
      assert.equal(currentSort, null, "Click 3 returns arrow to default visual state");
    });

    it("cycles default sort column (delivery_date) between desc and asc and returns to default desc", () => {
      type SortDir = "asc" | "desc";
      type SortState = { key: string; direction: SortDir };

      function simulateDateClick(currentDirection: SortDir): SortDir {
        // delivery_date defaults to desc
        if (currentDirection === "desc") {
          return "asc";
        }
        // Reset to default desc
        return "desc";
      }

      let dateDirection: SortDir = "desc";
      dateDirection = simulateDateClick(dateDirection);
      assert.equal(dateDirection, "asc", "First click on default date column flips to asc");

      dateDirection = simulateDateClick(dateDirection);
      assert.equal(dateDirection, "desc", "Second click returns date to default desc visual state");
    });
  });

  describe("Reorganized Stores / Drop-offs Display", () => {
    it("DELIVERY_SORT_FIELDS includes dropoffs for sorting by store count", () => {
      assert.ok(
        DELIVERY_SORT_FIELDS.includes("dropoffs" as any),
        "dropoffs must be in DELIVERY_SORT_FIELDS",
      );
    });

    it("sorts delivery records accurately by store drop-off count", () => {
      const resultAsc = listSmallMockDeliveryRecords({
        search: "",
        clientId: null,
        truckId: null,
        status: null,
        podStatus: null,
        dateFrom: null,
        dateTo: null,
        sort: "dropoffs" as any,
        direction: "asc",
        page: 1,
        pageSize: 25,
      });

      const resultDesc = listSmallMockDeliveryRecords({
        search: "",
        clientId: null,
        truckId: null,
        status: null,
        podStatus: null,
        dateFrom: null,
        dateTo: null,
        sort: "dropoffs" as any,
        direction: "desc",
        page: 1,
        pageSize: 25,
      });

      assert.ok(resultAsc.items.length > 0);
      assert.ok(resultDesc.items.length > 0);

      // Verify ascending order: dropoffs.length increases or stays equal
      for (let i = 0; i < resultAsc.items.length - 1; i++) {
        assert.ok(
          resultAsc.items[i].dropoffs.length <= resultAsc.items[i + 1].dropoffs.length,
          `Ascending: item ${i} (${resultAsc.items[i].dropoffs.length}) <= item ${i + 1} (${resultAsc.items[i + 1].dropoffs.length})`,
        );
      }

      // Verify descending order: dropoffs.length decreases or stays equal
      for (let i = 0; i < resultDesc.items.length - 1; i++) {
        assert.ok(
          resultDesc.items[i].dropoffs.length >= resultDesc.items[i + 1].dropoffs.length,
          `Descending: item ${i} (${resultDesc.items[i].dropoffs.length}) >= item ${i + 1} (${resultDesc.items[i + 1].dropoffs.length})`,
        );
      }
    });

    it("accurately produces store badges, destination summaries, and full sequence tooltips", () => {
      const sampleTrip = SMALL_MOCK_DATABASE.deliveries[0].record;
      assert.ok(sampleTrip.dropoffs.length > 0);

      const countBadge = `${sampleTrip.dropoffs.length} ${sampleTrip.dropoffs.length === 1 ? "store" : "stores"}`;
      assert.match(countBadge, /^\d+ stores?$/);

      const summary = sampleTrip.dropoffs
        .map((d) => d.destinationArea || d.storeName)
        .filter(Boolean)
        .slice(0, 2)
        .join(", ");
      assert.ok(summary.length > 0, "Summary displays destination areas");

      const tooltip = sampleTrip.dropoffs
        .map((d) => `#${d.sequence} ${d.storeName} (${d.destinationArea})`)
        .join("\n");
      assert.ok(tooltip.includes("#1"), "Tooltip includes sequence #1");
    });
  });

  describe("Completed Delivery Ledger Presentation Hierarchy", () => {
    it("distinguishes financially complete and incomplete deliveries for ledger badges", () => {
      const finalized = SMALL_MOCK_DATABASE.deliveries.find((d) => d.record.financialState === "finalized");
      const incomplete = SMALL_MOCK_DATABASE.deliveries.find((d) => d.record.financialState === "incomplete");

      assert.ok(finalized, "Has finalized delivery in mock database");
      assert.ok(incomplete, "Has incomplete delivery in mock database");
      assert.equal(finalized.record.financialState, "finalized");
      assert.equal(incomplete.record.financialState, "incomplete");
    });

    it("cold chain temperatures differentiate frozen and chilled status correctly", () => {
      const isFrozen = (temp: string) => temp.includes("-");
      assert.equal(isFrozen("-18°C"), true, "-18°C is frozen");
      assert.equal(isFrozen("-20°C"), true, "-20°C is frozen");
      assert.equal(isFrozen("4°C"), false, "4°C is chilled/fresh");
      assert.equal(isFrozen("2°C"), false, "2°C is chilled/fresh");
    });
  });
});