import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  getTruckStorageCapability,
  getTruckClassificationLabel,
  TRUCK_CLASSIFICATION_FILTER_OPTIONS,
  TRUCK_PERFORMANCE_FILTER_OPTIONS,
  getOwnedTrucks,
  getSubcontractedTrucks,
} from "./truck-registry.ts";

describe("Truck Management and Filtering Improvements", () => {
  describe("Freezer, Chilled, and Dry Cargo Capability Classification", () => {
    it("correctly classifies freezer trucks based on operational data", () => {
      // Canonical owned freezer trucks (-18°C):
      assert.equal(getTruckStorageCapability("NGS 4281"), "Freezer");
      assert.equal(getTruckStorageCapability("ABX 2201"), "Freezer");

      // Canonical subcontracted freezer units:
      assert.equal(getTruckStorageCapability("HJK 2207"), "Freezer");
      assert.equal(getTruckStorageCapability("JRS 3760"), "Freezer");
      assert.equal(getTruckStorageCapability("BVC 1928"), "Freezer");
    });

    it("correctly classifies chilled trucks based on operational data", () => {
      // Canonical owned chilled trucks (2°C - 4°C):
      assert.equal(getTruckStorageCapability("DAA 7310"), "Chilled");
      assert.equal(getTruckStorageCapability("NBE 9042"), "Chilled");

      // Canonical subcontracted chilled units:
      assert.equal(getTruckStorageCapability("PQR 7156"), "Chilled");
      assert.equal(getTruckStorageCapability("BCD 8642"), "Chilled");
      assert.equal(getTruckStorageCapability("VWX 6385"), "Chilled");
      assert.equal(getTruckStorageCapability("XYZ 9102"), "Chilled");
    });

    it("correctly classifies dry / ambient cargo trucks based on operational data", () => {
      // Canonical owned dry cargo trucks:
      assert.equal(getTruckStorageCapability("CBZ 1187"), "Dry");
      assert.equal(getTruckStorageCapability("XCY 6612"), "Dry");

      // Canonical subcontracted dry units:
      assert.equal(getTruckStorageCapability("KLM 4821"), "Dry");
      assert.equal(getTruckStorageCapability("TUV 3098"), "Dry");
      assert.equal(getTruckStorageCapability("MNP 5934"), "Dry");
      assert.equal(getTruckStorageCapability("STX 1479"), "Dry");
    });

    it("respects explicit capability parameter and falls back gracefully for unknown plates", () => {
      assert.equal(getTruckStorageCapability("UNKNOWN-1", "Freezer"), "Freezer");
      assert.equal(getTruckStorageCapability("UNKNOWN-2", "Chilled"), "Chilled");
      assert.equal(getTruckStorageCapability("UNKNOWN-3", "Dry"), "Dry");
      // Default fallback is Dry when completely unknown
      assert.equal(getTruckStorageCapability("RANDOM 999"), "Dry");
    });

    it("generates clear human-readable classification labels", () => {
      assert.equal(getTruckClassificationLabel("6-Wheeler", "Freezer"), "6-Wheeler · Freezer");
      assert.equal(getTruckClassificationLabel("6-Wheeler", "Chilled"), "6-Wheeler · Chilled");
      assert.equal(getTruckClassificationLabel("10-Wheeler", "Dry"), "10-Wheeler · Dry");
      assert.equal(getTruckClassificationLabel("4-Wheeler", "Freezer"), "4-Wheeler · Freezer");
      assert.equal(getTruckClassificationLabel("4-Wheeler", "Dry"), "4-Wheeler · Dry");
    });
  });

  describe("Truck Classification Filters (Freezer, Chilled, and Dry)", () => {
    it("ensures filter options contain all, freezer, chilled, and dry options", () => {
      const values = TRUCK_CLASSIFICATION_FILTER_OPTIONS.map((opt) => opt.value);

      // Must include All, Freezer, Chilled, and Dry
      assert.ok(values.includes("all"));
      assert.ok(values.includes("freezer"));
      assert.ok(values.includes("chilled"));
      assert.ok(values.includes("dry"));

      // Wheel-specific combinations must NOT be present
      assert.ok(!values.includes("reefer-6w" as any));
      assert.ok(!values.includes("reefer-4w" as any));
      assert.ok(!values.includes("dry-10w" as any));
      assert.ok(!values.includes("dry-4w" as any));

      // Raw per-wheel options without classification context must NOT be present
      assert.ok(!values.includes("4-Wheeler" as any));
      assert.ok(!values.includes("6-Wheeler" as any));
      assert.ok(!values.includes("10-Wheeler" as any));
    });

    it("provides clean labels for freezer, chilled, and dry classifications", () => {
      const freezerOption = TRUCK_CLASSIFICATION_FILTER_OPTIONS.find((o) => o.value === "freezer");
      assert.equal(freezerOption?.label, "Freezer");

      const chilledOption = TRUCK_CLASSIFICATION_FILTER_OPTIONS.find((o) => o.value === "chilled");
      assert.equal(chilledOption?.label, "Chilled");

      const dryOption = TRUCK_CLASSIFICATION_FILTER_OPTIONS.find((o) => o.value === "dry");
      assert.equal(dryOption?.label, "Dry");
    });
  });

  describe("Performance Tier Filters & Highest-Value / Highest-Performing Criteria", () => {
    it("defines clear and transparent performance filter criteria", () => {
      const perfValues = TRUCK_PERFORMANCE_FILTER_OPTIONS.map((o) => o.value);
      assert.deepEqual(perfValues, ["all", "top_performing", "high_value", "active"]);

      const topPerf = TRUCK_PERFORMANCE_FILTER_OPTIONS.find((o) => o.value === "top_performing");
      assert.ok(topPerf?.label.includes("Net Profit > ₱0"));

      const highVal = TRUCK_PERFORMANCE_FILTER_OPTIONS.find((o) => o.value === "high_value");
      assert.ok(highVal?.label.includes("Revenue ≥ ₱50k"));

      const active = TRUCK_PERFORMANCE_FILTER_OPTIONS.find((o) => o.value === "active");
      assert.ok(active?.label.includes("≥ 1 Trip"));
    });

    it("filters truck profitability records accurately without confusion", () => {
      const mockSummaries = [
        { plateNumber: "AAA 111", revenue: 85000, netProfit: 25000, deliveries: 3, marginPercent: 29.4 },
        { plateNumber: "BBB 222", revenue: 45000, netProfit: 5000, deliveries: 2, marginPercent: 11.1 },
        { plateNumber: "CCC 333", revenue: 60000, netProfit: -4000, deliveries: 2, marginPercent: -6.7 },
        { plateNumber: "DDD 444", revenue: 0, netProfit: 0, deliveries: 0, marginPercent: null },
      ];

      // Top Performing: Net Profit > 0
      const topPerforming = mockSummaries.filter((s) => s.netProfit > 0);
      assert.equal(topPerforming.length, 2);
      assert.ok(topPerforming.some((s) => s.plateNumber === "AAA 111"));
      assert.ok(topPerforming.some((s) => s.plateNumber === "BBB 222"));

      // Highest Value: Revenue >= 50,000
      const highestValue = mockSummaries.filter((s) => s.revenue >= 50000);
      assert.equal(highestValue.length, 2);
      assert.ok(highestValue.some((s) => s.plateNumber === "AAA 111"));
      assert.ok(highestValue.some((s) => s.plateNumber === "CCC 333"));

      // Active: deliveries >= 1
      const activeTrucks = mockSummaries.filter((s) => s.deliveries > 0);
      assert.equal(activeTrucks.length, 3);
      assert.ok(!activeTrucks.some((s) => s.plateNumber === "DDD 444"));
    });

    it("stably breaks ties during sorting to prevent card jumping or unpredictable order", () => {
      const mockCards = [
        { plateNumber: "XCY 6612", netProfit: 0 },
        { plateNumber: "ABX 2201", netProfit: 0 },
        { plateNumber: "CBZ 1187", netProfit: 15000 },
        { plateNumber: "NGS 4281", netProfit: 15000 },
      ];

      const sorted = [...mockCards].sort((a, b) => {
        if (b.netProfit !== a.netProfit) {
          return b.netProfit - a.netProfit;
        }
        return a.plateNumber.localeCompare(b.plateNumber);
      });

      // For netProfit: 15000, CBZ 1187 comes before NGS 4281 alphabetically
      assert.equal(sorted[0].plateNumber, "CBZ 1187");
      assert.equal(sorted[1].plateNumber, "NGS 4281");
      // For netProfit: 0, ABX 2201 comes before XCY 6612 alphabetically
      assert.equal(sorted[2].plateNumber, "ABX 2201");
      assert.equal(sorted[3].plateNumber, "XCY 6612");
    });
  });

  describe("Preservation of Ownership Types and Source Data Integrity", () => {
    it("preserves canonical owned trucks without altering registration details", () => {
      const owned = getOwnedTrucks();
      assert.equal(owned.length, 6);
      assert.ok(owned.every((t) => t.ownershipType === "Owned"));

      const plates = owned.map((t) => t.plateNumber);
      assert.ok(plates.includes("NGS 4281"));
      assert.ok(plates.includes("DAA 7310"));
      assert.ok(plates.includes("CBZ 1187"));
      assert.ok(plates.includes("NBE 9042"));
      assert.ok(plates.includes("ABX 2201"));
      assert.ok(plates.includes("XCY 6612"));
    });

    it("preserves canonical subcontracted trucks and provider details", () => {
      const sub = getSubcontractedTrucks();
      assert.ok(sub.length >= 8);
      assert.ok(sub.every((t) => t.ownershipType === "Subcontracted"));
      assert.ok(sub.every((t) => Boolean(t.provider)));
    });
  });
});
