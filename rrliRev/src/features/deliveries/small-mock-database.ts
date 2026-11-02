import {
  buildDeliveryTripRecord,
  summarizeTruckProfitability,
  type DeliveryTripRecord,
  type TruckTemperature,
  type TruckType,
} from "./delivery-domain.ts";

export const SMALL_MOCK_PERIOD = {
  start: "2026-06-01",
  end: "2026-06-07",
} as const;

export type SmallMockClient = {
  id: string;
  code: string;
  name: "LANDERS" | "Manila Comisario Central Inc. (MCCI)" | "VANGUARD";
};

export type SmallMockTruck = {
  id: string;
  plateNumber: string;
  truckType: TruckType;
  truckTemperature: TruckTemperature;
};

export type SmallMockEmployee = {
  id: string;
  employeeCode: string;
  fullName: string;
  assignmentType: "Driver" | "Helper";
};

export type SmallMockDocumentStatus = "Verified" | "Submitted" | "Missing" | "Rejected";

export type SmallMockDocument = {
  id: string;
  deliveryId: string;
  dropoffId: string;
  requirementKey: "proof_of_delivery";
  label: string;
  status: SmallMockDocumentStatus;
  storagePath: string | null;
  originalFilename: string | null;
  mimeType: "application/pdf" | null;
  sizeBytes: number | null;
  verificationNotes: string | null;
};

export type SmallMockDelivery = {
  record: DeliveryTripRecord;
  clientId: string;
  truckId: string;
  driverId: string;
  helperId: string;
  scenario: string;
};

const CLIENTS = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    code: "MOCK-LANDERS",
    name: "LANDERS",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    code: "MOCK-MCCI",
    name: "Manila Comisario Central Inc. (MCCI)",
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    code: "MOCK-VANGUARD",
    name: "VANGUARD",
  },
] as const satisfies readonly SmallMockClient[];

const TRUCKS = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    plateNumber: "RZX 6101",
    truckType: "6-Wheeler",
    truckTemperature: "Multi-Temp",
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    plateNumber: "RZY 6202",
    truckType: "6-Wheeler",
    truckTemperature: "Chilled (2°C–4°C)",
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    plateNumber: "RZZ 1030",
    truckType: "10-Wheeler",
    truckTemperature: "Ambient",
  },
] as const satisfies readonly SmallMockTruck[];

const DRIVERS = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    employeeCode: "MOCK-DRV-01",
    fullName: "Mateo Dela Vega",
    assignmentType: "Driver",
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    employeeCode: "MOCK-DRV-02",
    fullName: "Nico Serrano",
    assignmentType: "Driver",
  },
] as const satisfies readonly SmallMockEmployee[];

const HELPERS = [
  {
    id: "30000000-0000-4000-8000-000000000003",
    employeeCode: "MOCK-HLP-01",
    fullName: "Ira Santos",
    assignmentType: "Helper",
  },
  {
    id: "30000000-0000-4000-8000-000000000004",
    employeeCode: "MOCK-HLP-02",
    fullName: "Paolo Reyes",
    assignmentType: "Helper",
  },
] as const satisfies readonly SmallMockEmployee[];

const DELIVERIES = [
  {
    clientId: CLIENTS[0].id,
    truckId: TRUCKS[0].id,
    driverId: DRIVERS[0].id,
    helperId: HELPERS[0].id,
    scenario: "LANDERS warehouse-to-store retail replenishment with one destination.",
    record: buildDeliveryTripRecord({
      id: "40000000-0000-4000-8000-000000000001",
      waybillNumber: "WB-MOCK-260601",
      deliveryDate: "2026-06-01",
      clientName: CLIENTS[0].name,
      plateNumber: TRUCKS[0].plateNumber,
      truckType: TRUCKS[0].truckType,
      truckTemperature: TRUCKS[0].truckTemperature,
      origin: "Sample North Retail Warehouse",
      distanceKm: 82,
      fuelRate: 61.8,
      deliveryRate: 24000,
      expenses: {
        dieselExpenses: 4200,
        tollGateExpenses: 1100,
        tollGateBreakdown: "Sample expressway round trip",
        driverAllowance: 350,
        driverDailyRate: 1000,
        helperAllowance: 250,
        helperDailyRate: 700,
        otherExpenses: 200,
      },
      dropoffs: [{
        id: "50000000-0000-4000-8000-000000000001",
        sequence: 1,
        storeName: "LANDERS Sample Branch A",
        destinationArea: "Sample Metro District A",
        entryFee: 150,
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "SAMPLE-POD-LND-01.pdf",
      }],
    }),
  },
  {
    clientId: CLIENTS[0].id,
    truckId: TRUCKS[2].id,
    driverId: DRIVERS[1].id,
    helperId: HELPERS[1].id,
    scenario: "LANDERS groceries and household-goods replenishment for two sample branches.",
    record: buildDeliveryTripRecord({
      id: "40000000-0000-4000-8000-000000000002",
      waybillNumber: "WB-MOCK-260602",
      deliveryDate: "2026-06-02",
      clientName: CLIENTS[0].name,
      plateNumber: TRUCKS[2].plateNumber,
      truckType: TRUCKS[2].truckType,
      truckTemperature: TRUCKS[2].truckTemperature,
      origin: "Sample General Merchandise Hub",
      distanceKm: 118,
      fuelRate: 61.9,
      deliveryRate: 28000,
      expenses: {
        dieselExpenses: 5200,
        tollGateExpenses: 1600,
        tollGateBreakdown: "Sample north and city tolls",
        driverAllowance: 400,
        driverDailyRate: 1000,
        helperAllowance: 300,
        helperDailyRate: 700,
        otherExpenses: 0,
      },
      dropoffs: [
        {
          id: "50000000-0000-4000-8000-000000000002",
          sequence: 1,
          storeName: "LANDERS Sample Branch B",
          destinationArea: "Sample Metro District B",
          entryFee: 200,
          podSubmitted: true,
          supportingDocsComplete: false,
          documentRef: "SAMPLE-POD-LND-02A.pdf",
        },
        {
          id: "50000000-0000-4000-8000-000000000003",
          sequence: 2,
          storeName: "LANDERS Sample Branch C",
          destinationArea: "Sample Metro District C",
          entryFee: 200,
          podSubmitted: true,
          supportingDocsComplete: false,
          documentRef: "SAMPLE-POD-LND-02B.pdf",
        },
      ],
    }),
  },
  {
    clientId: CLIENTS[1].id,
    truckId: TRUCKS[1].id,
    driverId: DRIVERS[0].id,
    helperId: HELPERS[1].id,
    scenario: "MCCI chilled commissary-to-restaurant delivery to one fictional branch.",
    record: buildDeliveryTripRecord({
      id: "40000000-0000-4000-8000-000000000003",
      waybillNumber: "WB-MOCK-260603",
      deliveryDate: "2026-06-03",
      clientName: CLIENTS[1].name,
      plateNumber: TRUCKS[1].plateNumber,
      truckType: TRUCKS[1].truckType,
      truckTemperature: TRUCKS[1].truckTemperature,
      origin: "MCCI Sample Commissary",
      distanceKm: 54,
      fuelRate: 62.1,
      deliveryRate: 18500,
      expenses: {
        dieselExpenses: 3000,
        tollGateExpenses: 600,
        tollGateBreakdown: "Sample city connector toll",
        driverAllowance: 300,
        driverDailyRate: 900,
        helperAllowance: 200,
        helperDailyRate: 650,
        otherExpenses: 250,
      },
      dropoffs: [{
        id: "50000000-0000-4000-8000-000000000004",
        sequence: 1,
        storeName: "MCCI Sample Restaurant Branch A",
        destinationArea: "Sample Food District A",
        entryFee: null,
        entryFeeStatus: "not_applicable",
        podSubmitted: false,
        supportingDocsComplete: false,
        documentRef: "No sample POD submitted",
      }],
    }),
  },
  {
    clientId: CLIENTS[1].id,
    truckId: TRUCKS[1].id,
    driverId: DRIVERS[1].id,
    helperId: HELPERS[0].id,
    scenario: "MCCI temperature-controlled food distribution to two fictional restaurant branches.",
    record: buildDeliveryTripRecord({
      id: "40000000-0000-4000-8000-000000000004",
      waybillNumber: "WB-MOCK-260604",
      deliveryDate: "2026-06-04",
      clientName: CLIENTS[1].name,
      plateNumber: TRUCKS[1].plateNumber,
      truckType: TRUCKS[1].truckType,
      truckTemperature: TRUCKS[1].truckTemperature,
      origin: "MCCI Sample Cold Dispatch Center",
      distanceKm: 96,
      fuelRate: 62.2,
      deliveryRate: 13000,
      expenses: {
        dieselExpenses: 4800,
        tollGateExpenses: 1200,
        tollGateBreakdown: "Sample expressway and city tolls",
        driverAllowance: 400,
        driverDailyRate: 900,
        helperAllowance: 300,
        helperDailyRate: 650,
        otherExpenses: 350,
      },
      dropoffs: [
        {
          id: "50000000-0000-4000-8000-000000000005",
          sequence: 1,
          storeName: "MCCI Sample Restaurant Branch B",
          destinationArea: "Sample Food District B",
          entryFee: 300,
          podSubmitted: true,
          supportingDocsComplete: false,
          documentRef: "SAMPLE-POD-MCC-04A-REJECTED.pdf",
        },
        {
          id: "50000000-0000-4000-8000-000000000006",
          sequence: 2,
          storeName: "MCCI Sample Restaurant Branch C",
          destinationArea: "Sample Food District C",
          entryFee: 300,
          podSubmitted: true,
          supportingDocsComplete: false,
          documentRef: "SAMPLE-POD-MCC-04B-REJECTED.pdf",
        },
      ],
    }),
  },
  {
    clientId: CLIENTS[2].id,
    truckId: TRUCKS[0].id,
    driverId: DRIVERS[0].id,
    helperId: HELPERS[0].id,
    scenario: "VANGUARD general distribution delivery to one fictional destination.",
    record: buildDeliveryTripRecord({
      id: "40000000-0000-4000-8000-000000000005",
      waybillNumber: "WB-MOCK-260605",
      deliveryDate: "2026-06-05",
      clientName: CLIENTS[2].name,
      plateNumber: TRUCKS[0].plateNumber,
      truckType: TRUCKS[0].truckType,
      truckTemperature: TRUCKS[0].truckTemperature,
      origin: "VANGUARD Sample Distribution Center",
      distanceKm: 68,
      fuelRate: 62.0,
      deliveryRate: 17500,
      expenses: {
        dieselExpenses: 2900,
        tollGateExpenses: 0,
        tollGateBreakdown: "No toll road used",
        driverAllowance: 300,
        driverDailyRate: 850,
        helperAllowance: 200,
        helperDailyRate: 600,
        otherExpenses: 150,
      },
      dropoffs: [{
        id: "50000000-0000-4000-8000-000000000007",
        sequence: 1,
        storeName: "VANGUARD Sample Distribution Point A",
        destinationArea: "Sample Logistics Zone A",
        entryFee: 100,
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "SAMPLE-POD-VGD-05.pdf",
      }],
    }),
  },
  {
    clientId: CLIENTS[2].id,
    truckId: TRUCKS[2].id,
    driverId: DRIVERS[1].id,
    helperId: HELPERS[1].id,
    scenario: "VANGUARD general distribution trip with two fictional drop-offs and an unknown toll expense.",
    record: buildDeliveryTripRecord({
      id: "40000000-0000-4000-8000-000000000006",
      waybillNumber: "WB-MOCK-260607",
      deliveryDate: "2026-06-07",
      clientName: CLIENTS[2].name,
      plateNumber: TRUCKS[2].plateNumber,
      truckType: TRUCKS[2].truckType,
      truckTemperature: TRUCKS[2].truckTemperature,
      origin: "VANGUARD Sample Cross-Dock Hub",
      distanceKm: 104,
      fuelRate: 62.3,
      deliveryRate: 21000,
      financialState: "incomplete",
      expenses: {
        dieselExpenses: 3900,
        tollGateExpenses: null,
        tollGateBreakdown: "Receipt amount awaiting confirmation",
        driverAllowance: 350,
        driverDailyRate: 850,
        helperAllowance: 250,
        helperDailyRate: 600,
        otherExpenses: 100,
      },
      expenseStates: { tollGateExpenses: "unknown" },
      dropoffs: [
        {
          id: "50000000-0000-4000-8000-000000000008",
          sequence: 1,
          storeName: "VANGUARD Sample Distribution Point B",
          destinationArea: "Sample Logistics Zone B",
          entryFee: 150,
          podSubmitted: true,
          supportingDocsComplete: false,
          documentRef: "SAMPLE-POD-VGD-06A.pdf",
        },
        {
          id: "50000000-0000-4000-8000-000000000009",
          sequence: 2,
          storeName: "VANGUARD Sample Distribution Point C",
          destinationArea: "Sample Logistics Zone C",
          entryFee: 150,
          podSubmitted: true,
          supportingDocsComplete: false,
          documentRef: "SAMPLE-POD-VGD-06B.pdf",
        },
      ],
    }),
  },
] as const satisfies readonly SmallMockDelivery[];

const DOCUMENT_DELIVERY_STATUSES = [
  "Verified",
  "Submitted",
  "Missing",
  "Rejected",
  "Verified",
  "Submitted",
] as const satisfies readonly SmallMockDocumentStatus[];

const DOCUMENTS: readonly SmallMockDocument[] = DELIVERIES.flatMap((delivery, deliveryIndex) =>
  delivery.record.dropoffs.map((dropoff, dropoffIndex) => {
    const status = DOCUMENT_DELIVERY_STATUSES[deliveryIndex];
    const hasFile = status !== "Missing";
    return {
      id: `60000000-0000-4000-8000-${String(deliveryIndex * 10 + dropoffIndex + 1).padStart(12, "0")}`,
      deliveryId: delivery.record.id,
      dropoffId: dropoff.id,
      requirementKey: "proof_of_delivery" as const,
      label: "Sample proof of delivery (not a signed document)",
      status,
      storagePath: hasFile ? `mock-only/${delivery.record.waybillNumber}/${dropoff.id}.pdf` : null,
      originalFilename: hasFile ? `${dropoff.documentRef.replace(/\.pdf$/i, "")}-SAMPLE-NOT-SIGNED.pdf` : null,
      mimeType: hasFile ? "application/pdf" as const : null,
      sizeBytes: hasFile ? 12000 + deliveryIndex * 1000 + dropoffIndex * 500 : null,
      verificationNotes:
        status === "Rejected"
          ? "Needs correction: the fictional sample receiving stamp is unreadable."
          : status === "Missing"
            ? "No sample POD has been submitted."
            : null,
    };
  }),
);

export const SMALL_MOCK_DATABASE = {
  clients: CLIENTS,
  trucks: TRUCKS,
  drivers: DRIVERS,
  helpers: HELPERS,
  deliveries: DELIVERIES,
  documents: DOCUMENTS,
} as const;

export function filterSmallMockDeliveries(input: {
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
}): readonly SmallMockDelivery[] {
  return SMALL_MOCK_DATABASE.deliveries.filter((delivery) =>
    (!input.clientId || delivery.clientId === input.clientId) &&
    (!input.dateFrom || delivery.record.deliveryDate >= input.dateFrom) &&
    (!input.dateTo || delivery.record.deliveryDate <= input.dateTo)
  );
}

export function validateSmallMockDatabase(): string[] {
  const issues: string[] = [];
  const { clients, trucks, drivers, helpers, deliveries, documents } = SMALL_MOCK_DATABASE;
  const dropoffCount = deliveries.reduce((count, delivery) => count + delivery.record.dropoffs.length, 0);
  const waybills = new Set(deliveries.map((delivery) => delivery.record.waybillNumber));

  if (clients.length !== 3) issues.push("Expected exactly 3 mock clients.");
  if (trucks.length !== 3) issues.push("Expected exactly 3 mock trucks.");
  if (drivers.length !== 2) issues.push("Expected exactly 2 mock drivers.");
  if (helpers.length !== 2) issues.push("Expected exactly 2 mock helpers.");
  if (deliveries.length !== 6) issues.push("Expected exactly 6 mock deliveries.");
  if (dropoffCount < 8 || dropoffCount > 9) issues.push("Expected 8 to 9 mock drop-offs.");
  if (waybills.size !== deliveries.length) issues.push("Mock waybill numbers must be unique.");

  for (const client of clients) {
    const count = deliveries.filter((delivery) => delivery.clientId === client.id).length;
    if (count !== 2) issues.push(`${client.name} must have exactly 2 deliveries.`);
  }
  for (const delivery of deliveries) {
    if (
      delivery.record.deliveryDate < SMALL_MOCK_PERIOD.start ||
      delivery.record.deliveryDate > SMALL_MOCK_PERIOD.end
    ) {
      issues.push(`${delivery.record.waybillNumber} falls outside the mock period.`);
    }
  }

  const finalized = deliveries.filter((delivery) => delivery.record.financialState === "finalized");
  const incomplete = deliveries.filter((delivery) => delivery.record.financialState === "incomplete");
  if (finalized.length !== 5 || incomplete.length !== 1) {
    issues.push("Expected 5 financially finalized deliveries and 1 incomplete delivery.");
  }
  if (summarizeTruckProfitability(deliveries.map((delivery) => delivery.record)).length !== 3) {
    issues.push("All 3 mock trucks must appear in confirmed profitability summaries.");
  }

  const documentStatuses = new Set(documents.map((document) => document.status));
  for (const status of ["Verified", "Submitted", "Missing", "Rejected"] as const) {
    if (!documentStatuses.has(status)) issues.push(`Missing ${status} POD document scenario.`);
  }

  return issues;
}

