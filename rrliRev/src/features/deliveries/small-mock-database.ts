import {
  buildDeliveryTripRecord,
  summarizeTruckProfitability,
  type DeliveryTripRecord,
} from "./delivery-domain.ts";
import {
  FLEET_TRUCKS,
  OWNED_TRUCKS,
  SUBCONTRACTED_TRUCKS,
  type FleetTruck,
} from "./truck-registry.ts";

export const SMALL_MOCK_PERIOD = {
  start: "2026-10-27",
  end: "2026-11-02",
} as const;

export type SmallMockClient = {
  id: string;
  code: string;
  name: string;
};

export type SmallMockTruck = FleetTruck;

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
  driverName?: string | null;
  helperName?: string | null;
  scenario: string;
};

const CLIENTS = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    code: "LANDERS",
    name: "Landers",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    code: "MCCI",
    name: "Manila Comisario Central Inc. (MCCI)",
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    code: "VANGUARD",
    name: "Vanguard",
  },
] as const satisfies readonly SmallMockClient[];

const TRUCKS = OWNED_TRUCKS;

const DRIVERS = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    employeeCode: "DRV-01",
    fullName: "Mateo Dela Vega",
    assignmentType: "Driver",
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    employeeCode: "DRV-02",
    fullName: "Nico Serrano",
    assignmentType: "Driver",
  },
] as const satisfies readonly SmallMockEmployee[];

const HELPERS = [
  {
    id: "30000000-0000-4000-8000-000000000003",
    employeeCode: "HLP-01",
    fullName: "Ira Santos",
    assignmentType: "Helper",
  },
  {
    id: "30000000-0000-4000-8000-000000000004",
    employeeCode: "HLP-02",
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
    scenario: "Landers wholesale dry & cold retail replenishment from Laguna consolidation hub to Landers Balintawak flagship store.",
    record: buildDeliveryTripRecord({
      id: "40000000-0000-4000-8000-000000000001",
      waybillNumber: "WB-261027",
      deliveryDate: "2026-10-27",
      clientName: CLIENTS[0].name,
      plateNumber: TRUCKS[0].plateNumber,
      truckType: TRUCKS[0].truckType,
      truckTemperature: "-18°C",
      origin: "Fictional Origin: Landers Greater Manila Consolidation Hub, Calamba, Laguna",
      distanceKm: 82,
      fuelRate: 84.5,
      deliveryRate: 24000,
      expenses: {
        dieselExpenses: 4200,
        tollGateExpenses: 1100,
        tollGateBreakdown: "SLEX & Skyway Stage 3 tolls",
        driverAllowance: 350,
        driverDailyRate: 1000,
        helperAllowance: 250,
        helperDailyRate: 700,
        otherExpenses: 200,
      },
      dropoffs: [{
        id: "50000000-0000-4000-8000-000000000001",
        sequence: 1,
        storeName: "Landers Superstore - Balintawak",
        destinationArea: "Balintawak, Quezon City, Metro Manila",
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
    scenario: "Landers bulk ambient merchandise distribution from Santa Rosa DC along the Daang Hari corridor servicing Alabang and Vermosa branches.",
    record: buildDeliveryTripRecord({
      id: "40000000-0000-4000-8000-000000000002",
      waybillNumber: "WB-261028",
      deliveryDate: "2026-10-28",
      clientName: CLIENTS[0].name,
      plateNumber: TRUCKS[2].plateNumber,
      truckType: TRUCKS[2].truckType,
      truckTemperature: "20°C",
      origin: "Fictional Origin: Landers South Luzon Distribution Center, Santa Rosa, Laguna",
      distanceKm: 118,
      fuelRate: 86.2,
      deliveryRate: 28000,
      expenses: {
        dieselExpenses: 5200,
        tollGateExpenses: 1600,
        tollGateBreakdown: "SLEX & MCX tolls",
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
          storeName: "Landers Superstore - Alabang",
          destinationArea: "Almanza Dos, Las Piñas City, Metro Manila",
          entryFee: 200,
          podSubmitted: true,
          supportingDocsComplete: false,
          documentRef: "SAMPLE-POD-LND-02A.pdf",
        },
        {
          id: "50000000-0000-4000-8000-000000000003",
          sequence: 2,
          storeName: "Landers Superstore - Vermosa",
          destinationArea: "Pasong Buaya II, Imus City, Cavite",
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
    truckId: SUBCONTRACTED_TRUCKS[0].id,
    driverId: DRIVERS[0].id,
    helperId: HELPERS[1].id,
    scenario: "Subcontracted MCCI chilled commissary dispatch to Kuya J Festival Mall Alabang using the Trucker Rate schedule; mall entry fee is not applicable.",
    record: buildDeliveryTripRecord({
      id: "40000000-0000-4000-8000-000000000003",
      waybillNumber: "WB-261029",
      deliveryDate: "2026-10-29",
      clientName: CLIENTS[1].name,
      plateNumber: SUBCONTRACTED_TRUCKS[0].plateNumber,
      truckType: SUBCONTRACTED_TRUCKS[0].truckType,
      truckTemperature: "4°C",
      truckOwnership: "Subcontracted",
      rateBasis: "Trucker Rate",
      origin: "MCCI Central Commissary, San Pedro, Laguna",
      distanceKm: 54,
      fuelRate: 85.0,
      deliveryRate: 6325,
      expenses: {
        dieselExpenses: 1800,
        tollGateExpenses: 450,
        tollGateBreakdown: "SLEX connector round trip",
        driverAllowance: 300,
        driverDailyRate: 900,
        helperAllowance: 200,
        helperDailyRate: 650,
        otherExpenses: 100,
      },
      dropoffs: [{
        id: "50000000-0000-4000-8000-000000000004",
        sequence: 1,
        storeName: "Kuya J Restaurant - Festival Mall Alabang",
        destinationArea: "Filinvest City, Muntinlupa City, Metro Manila",
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
    scenario: "MCCI chilled commissary delivery servicing Kuya J SM Southmall and Popeyes SM Mall of Asia with high operating tolls resulting in tight profit margin; POD rejected for unreadable receiving stamp.",
    record: buildDeliveryTripRecord({
      id: "40000000-0000-4000-8000-000000000004",
      waybillNumber: "WB-261030",
      deliveryDate: "2026-10-30",
      clientName: CLIENTS[1].name,
      plateNumber: TRUCKS[1].plateNumber,
      truckType: TRUCKS[1].truckType,
      truckTemperature: "2°C",
      origin: "MCCI Central Commissary, San Pedro, Laguna",
      distanceKm: 96,
      fuelRate: 87.5,
      deliveryRate: 13000,
      expenses: {
        dieselExpenses: 4800,
        tollGateExpenses: 1200,
        tollGateBreakdown: "SLEX & Skyway tolls",
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
          storeName: "Kuya J Restaurant - SM Southmall",
          destinationArea: "Almanza Uno, Las Piñas City, Metro Manila",
          entryFee: 300,
          podSubmitted: true,
          supportingDocsComplete: false,
          documentRef: "SAMPLE-POD-MCC-04A-REJECTED.pdf",
        },
        {
          id: "50000000-0000-4000-8000-000000000006",
          sequence: 2,
          storeName: "Popeyes - SM Mall of Asia",
          destinationArea: "Bay City, Pasay City, Metro Manila",
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
    scenario: "Vanguard general wholesale delivery to Wilcon Depot Bacoor using arterial roads with confirmed zero toll expenses.",
    record: buildDeliveryTripRecord({
      id: "40000000-0000-4000-8000-000000000005",
      waybillNumber: "WB-261031",
      deliveryDate: "2026-10-31",
      clientName: CLIENTS[2].name,
      plateNumber: TRUCKS[0].plateNumber,
      truckType: TRUCKS[0].truckType,
      truckTemperature: "-18°C",
      origin: "Fictional Origin: Vanguard Southern Luzon Logistics Facility, Carmona, Cavite",
      distanceKm: 68,
      fuelRate: 83.8,
      deliveryRate: 17500,
      expenses: {
        dieselExpenses: 2900,
        tollGateExpenses: 0,
        tollGateBreakdown: "No toll road used via Molino-Paliparan arterial route",
        driverAllowance: 300,
        driverDailyRate: 850,
        helperAllowance: 200,
        helperDailyRate: 600,
        otherExpenses: 150,
      },
      dropoffs: [{
        id: "50000000-0000-4000-8000-000000000007",
        sequence: 1,
        storeName: "Wilcon Depot - Bacoor",
        destinationArea: "Mambog IV, Bacoor City, Cavite",
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
    scenario: "Vanguard general commercial replenishment across two retail outlets (Wilcon Depot Las Piñas and S&R Imus); toll receipt awaiting audit submission keeps trip financials incomplete.",
    record: buildDeliveryTripRecord({
      id: "40000000-0000-4000-8000-000000000006",
      waybillNumber: "WB-261102",
      deliveryDate: "2026-11-02",
      clientName: CLIENTS[2].name,
      plateNumber: TRUCKS[2].plateNumber,
      truckType: TRUCKS[2].truckType,
      truckTemperature: "20°C",
      origin: "Fictional Origin: Vanguard Industrial Cross-Dock Hub, Biñan, Laguna",
      distanceKm: 104,
      fuelRate: 88.5,
      deliveryRate: 21000,
      financialState: "incomplete",
      expenses: {
        dieselExpenses: 3900,
        tollGateExpenses: null,
        tollGateBreakdown: "CALAX and SLEX toll receipt amount awaiting confirmation",
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
          storeName: "Wilcon Depot - Las Piñas",
          destinationArea: "Almanza Uno, Las Piñas City, Metro Manila",
          entryFee: 150,
          podSubmitted: true,
          supportingDocsComplete: false,
          documentRef: "SAMPLE-POD-VGD-06A.pdf",
        },
        {
          id: "50000000-0000-4000-8000-000000000009",
          sequence: 2,
          storeName: "S&R Membership Shopping - Imus",
          destinationArea: "Anabu I-D, Imus City, Cavite",
          entryFee: 150,
          podSubmitted: true,
          supportingDocsComplete: false,
          documentRef: "SAMPLE-POD-VGD-06B.pdf",
        },
      ],
    }),
  },
  {
    clientId: CLIENTS[0].id,
    truckId: TRUCKS[3].id,
    driverId: DRIVERS[0].id,
    helperId: HELPERS[1].id,
    scenario: "Landers chilled replenishment from the South Luzon hub to the Arcovia branch using a compact truck for an urban delivery window.",
    record: buildDeliveryTripRecord({
      id: "40000000-0000-4000-8000-000000000007",
      waybillNumber: "WB-261032",
      deliveryDate: "2026-10-28",
      clientName: CLIENTS[0].name,
      plateNumber: TRUCKS[3].plateNumber,
      truckType: TRUCKS[3].truckType,
      truckTemperature: "4°C",
      origin: "Fictional Origin: Landers Greater Manila Consolidation Hub, Calamba, Laguna",
      distanceKm: 71,
      fuelRate: 82.5,
      deliveryRate: 16000,
      expenses: {
        dieselExpenses: 2700,
        tollGateExpenses: 400,
        tollGateBreakdown: "SLEX and C-5 access tolls",
        driverAllowance: 300,
        driverDailyRate: 850,
        helperAllowance: 200,
        helperDailyRate: 600,
        otherExpenses: 100,
      },
      dropoffs: [{
        id: "50000000-0000-4000-8000-000000000010",
        sequence: 1,
        storeName: "Landers Superstore - Arcovia",
        destinationArea: "Arcovia City, Pasig City, Metro Manila",
        entryFee: 120,
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "SAMPLE-POD-LND-07.pdf",
      }],
    }),
  },
  {
    clientId: CLIENTS[1].id,
    truckId: TRUCKS[4].id,
    driverId: DRIVERS[1].id,
    helperId: HELPERS[0].id,
    scenario: "MCCI frozen commissary dispatch to a north Metro Manila restaurant branch with complete trip financials and a submitted POD awaiting review.",
    record: buildDeliveryTripRecord({
      id: "40000000-0000-4000-8000-000000000008",
      waybillNumber: "WB-261101",
      deliveryDate: "2026-11-01",
      clientName: CLIENTS[1].name,
      plateNumber: TRUCKS[4].plateNumber,
      truckType: TRUCKS[4].truckType,
      truckTemperature: "-18°C",
      origin: "MCCI Central Commissary, San Pedro, Laguna",
      distanceKm: 88,
      fuelRate: 89.0,
      deliveryRate: 22000,
      expenses: {
        dieselExpenses: 4100,
        tollGateExpenses: 900,
        tollGateBreakdown: "SLEX and Skyway tolls",
        driverAllowance: 350,
        driverDailyRate: 950,
        helperAllowance: 250,
        helperDailyRate: 700,
        otherExpenses: 150,
      },
      dropoffs: [{
        id: "50000000-0000-4000-8000-000000000011",
        sequence: 1,
        storeName: "Kuya J Restaurant - Trinoma",
        destinationArea: "North Avenue, Quezon City, Metro Manila",
        entryFee: 180,
        podSubmitted: true,
        supportingDocsComplete: false,
        documentRef: "SAMPLE-POD-MCC-08.pdf",
      }],
    }),
  },
  {
    clientId: CLIENTS[2].id,
    truckId: TRUCKS[5].id,
    driverId: DRIVERS[0].id,
    helperId: HELPERS[1].id,
    scenario: "Vanguard frozen wholesale run from Biñan to a Taguig retail destination with finalized costs and verified receiving documents.",
    record: buildDeliveryTripRecord({
      id: "40000000-0000-4000-8000-000000000009",
      waybillNumber: "WB-261103",
      deliveryDate: "2026-11-01",
      clientName: CLIENTS[2].name,
      plateNumber: TRUCKS[5].plateNumber,
      truckType: TRUCKS[5].truckType,
      truckTemperature: "-20°C",
      origin: "Fictional Origin: Vanguard Industrial Cross-Dock Hub, Biñan, Laguna",
      distanceKm: 112,
      fuelRate: 86.5,
      deliveryRate: 26000,
      expenses: {
        dieselExpenses: 4700,
        tollGateExpenses: 1400,
        tollGateBreakdown: "SLEX, Skyway, and C-5 tolls",
        driverAllowance: 400,
        driverDailyRate: 1000,
        helperAllowance: 300,
        helperDailyRate: 750,
        otherExpenses: 250,
      },
      dropoffs: [{
        id: "50000000-0000-4000-8000-000000000012",
        sequence: 1,
        storeName: "S&R Membership Shopping - BGC",
        destinationArea: "Bonifacio Global City, Taguig, Metro Manila",
        entryFee: 200,
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "SAMPLE-POD-VGD-09.pdf",
      }],
    }),
  },
  {
    clientId: CLIENTS[0].id,
    truckId: TRUCKS[1].id,
    driverId: DRIVERS[0].id,
    helperId: HELPERS[0].id,
    scenario: "Landers temperature-controlled replenishment from Calamba hub to Landers Otis Manila branch.",
    record: buildDeliveryTripRecord({
      id: "40000000-0000-4000-8000-000000000010",
      waybillNumber: "WB-261033",
      deliveryDate: "2026-10-29",
      clientName: CLIENTS[0].name,
      plateNumber: TRUCKS[1].plateNumber,
      truckType: TRUCKS[1].truckType,
      truckTemperature: "-18°C",
      origin: "Fictional Origin: Landers Greater Manila Consolidation Hub, Calamba, Laguna",
      distanceKm: 89,
      fuelRate: 85.0,
      deliveryRate: 23500,
      expenses: {
        dieselExpenses: 3800,
        tollGateExpenses: 850,
        tollGateBreakdown: "SLEX & Skyway Stage 3 tolls",
        driverAllowance: 350,
        driverDailyRate: 950,
        helperAllowance: 250,
        helperDailyRate: 650,
        otherExpenses: 150,
      },
      dropoffs: [{
        id: "50000000-0000-4000-8000-000000000013",
        sequence: 1,
        storeName: "Landers Superstore - Otis",
        destinationArea: "Paco, Manila, Metro Manila",
        entryFee: 150,
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "SAMPLE-POD-LND-10.pdf",
      }],
    }),
  },
  {
    clientId: CLIENTS[0].id,
    truckId: TRUCKS[4].id,
    driverId: DRIVERS[1].id,
    helperId: HELPERS[1].id,
    scenario: "Landers express cold delivery to Landers Uptown BGC store.",
    record: buildDeliveryTripRecord({
      id: "40000000-0000-4000-8000-000000000011",
      waybillNumber: "WB-261034",
      deliveryDate: "2026-10-31",
      clientName: CLIENTS[0].name,
      plateNumber: TRUCKS[4].plateNumber,
      truckType: TRUCKS[4].truckType,
      truckTemperature: "-18°C",
      origin: "Fictional Origin: Landers Greater Manila Consolidation Hub, Calamba, Laguna",
      distanceKm: 76,
      fuelRate: 84.0,
      deliveryRate: 19000,
      expenses: {
        dieselExpenses: 3100,
        tollGateExpenses: 700,
        tollGateBreakdown: "SLEX & C-5 corridor tolls",
        driverAllowance: 300,
        driverDailyRate: 900,
        helperAllowance: 200,
        helperDailyRate: 600,
        otherExpenses: 100,
      },
      dropoffs: [{
        id: "50000000-0000-4000-8000-000000000014",
        sequence: 1,
        storeName: "Landers Superstore - Uptown Bonifacio",
        destinationArea: "Bonifacio Global City, Taguig, Metro Manila",
        entryFee: 120,
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "SAMPLE-POD-LND-11.pdf",
      }],
    }),
  },
  {
    clientId: CLIENTS[1].id,
    truckId: TRUCKS[2].id,
    driverId: DRIVERS[0].id,
    helperId: HELPERS[1].id,
    scenario: "MCCI chilled commissary dispatch to Kuya J SM North EDSA.",
    record: buildDeliveryTripRecord({
      id: "40000000-0000-4000-8000-000000000012",
      waybillNumber: "WB-261035",
      deliveryDate: "2026-10-28",
      clientName: CLIENTS[1].name,
      plateNumber: TRUCKS[2].plateNumber,
      truckType: TRUCKS[2].truckType,
      truckTemperature: "4°C",
      origin: "MCCI Central Commissary, San Pedro, Laguna",
      distanceKm: 92,
      fuelRate: 86.0,
      deliveryRate: 21500,
      expenses: {
        dieselExpenses: 3950,
        tollGateExpenses: 950,
        tollGateBreakdown: "SLEX & Skyway tolls",
        driverAllowance: 350,
        driverDailyRate: 950,
        helperAllowance: 250,
        helperDailyRate: 700,
        otherExpenses: 200,
      },
      dropoffs: [{
        id: "50000000-0000-4000-8000-000000000015",
        sequence: 1,
        storeName: "Kuya J Restaurant - SM North EDSA",
        destinationArea: "Bago Bantay, Quezon City, Metro Manila",
        entryFee: 180,
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "SAMPLE-POD-MCC-12.pdf",
      }],
    }),
  },
  {
    clientId: CLIENTS[1].id,
    truckId: SUBCONTRACTED_TRUCKS[0].id,
    driverId: DRIVERS[1].id,
    helperId: HELPERS[0].id,
    scenario: "Subcontracted dry seasoning replenishment to Popeyes Robinsons Galleria.",
    record: buildDeliveryTripRecord({
      id: "40000000-0000-4000-8000-000000000013",
      waybillNumber: "WB-261036",
      deliveryDate: "2026-10-31",
      clientName: CLIENTS[1].name,
      plateNumber: SUBCONTRACTED_TRUCKS[0].plateNumber,
      truckType: SUBCONTRACTED_TRUCKS[0].truckType,
      truckTemperature: "22°C",
      truckOwnership: "Subcontracted",
      rateBasis: "Trucker Rate",
      origin: "MCCI Central Commissary, San Pedro, Laguna",
      distanceKm: 65,
      fuelRate: 83.5,
      deliveryRate: 7800,
      expenses: {
        dieselExpenses: 2100,
        tollGateExpenses: 450,
        tollGateBreakdown: "SLEX connector round trip",
        driverAllowance: 300,
        driverDailyRate: 850,
        helperAllowance: 200,
        helperDailyRate: 600,
        otherExpenses: 100,
      },
      dropoffs: [{
        id: "50000000-0000-4000-8000-000000000016",
        sequence: 1,
        storeName: "Popeyes - Robinsons Galleria",
        destinationArea: "Ortigas Center, Quezon City, Metro Manila",
        entryFee: 100,
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "SAMPLE-POD-MCC-13.pdf",
      }],
    }),
  },
  {
    clientId: CLIENTS[2].id,
    truckId: TRUCKS[5].id,
    driverId: DRIVERS[0].id,
    helperId: HELPERS[0].id,
    scenario: "Vanguard wholesale hardware replenishment to Wilcon Depot Kawit.",
    record: buildDeliveryTripRecord({
      id: "40000000-0000-4000-8000-000000000014",
      waybillNumber: "WB-261037",
      deliveryDate: "2026-10-27",
      clientName: CLIENTS[2].name,
      plateNumber: TRUCKS[5].plateNumber,
      truckType: TRUCKS[5].truckType,
      truckTemperature: "20°C",
      origin: "Fictional Origin: Vanguard Southern Luzon Logistics Facility, Carmona, Cavite",
      distanceKm: 58,
      fuelRate: 82.0,
      deliveryRate: 15000,
      expenses: {
        dieselExpenses: 2400,
        tollGateExpenses: 300,
        tollGateBreakdown: "CAVITEX expressway tolls",
        driverAllowance: 300,
        driverDailyRate: 850,
        helperAllowance: 200,
        helperDailyRate: 600,
        otherExpenses: 100,
      },
      dropoffs: [{
        id: "50000000-0000-4000-8000-000000000017",
        sequence: 1,
        storeName: "Wilcon Depot - Kawit",
        destinationArea: "Magdalo, Kawit, Cavite",
        entryFee: 100,
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "SAMPLE-POD-VGD-14.pdf",
      }],
    }),
  },
  {
    clientId: CLIENTS[2].id,
    truckId: TRUCKS[3].id,
    driverId: DRIVERS[1].id,
    helperId: HELPERS[1].id,
    scenario: "Vanguard retail distribution to S&R Nuvali Santa Rosa branch.",
    record: buildDeliveryTripRecord({
      id: "40000000-0000-4000-8000-000000000015",
      waybillNumber: "WB-261038",
      deliveryDate: "2026-10-30",
      clientName: CLIENTS[2].name,
      plateNumber: TRUCKS[3].plateNumber,
      truckType: TRUCKS[3].truckType,
      truckTemperature: "-18°C",
      origin: "Fictional Origin: Vanguard Industrial Cross-Dock Hub, Biñan, Laguna",
      distanceKm: 42,
      fuelRate: 83.0,
      deliveryRate: 14000,
      expenses: {
        dieselExpenses: 2100,
        tollGateExpenses: 250,
        tollGateBreakdown: "CALAX Nuvali tolls",
        driverAllowance: 300,
        driverDailyRate: 850,
        helperAllowance: 200,
        helperDailyRate: 600,
        otherExpenses: 100,
      },
      dropoffs: [{
        id: "50000000-0000-4000-8000-000000000018",
        sequence: 1,
        storeName: "S&R Membership Shopping - Nuvali",
        destinationArea: "Don Jose, Santa Rosa City, Laguna",
        entryFee: 100,
        podSubmitted: true,
        supportingDocsComplete: true,
        documentRef: "SAMPLE-POD-VGD-15.pdf",
      }],
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
  "Verified",
  "Submitted",
  "Verified",
  "Verified",
  "Submitted",
  "Verified",
  "Submitted",
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
  trucks: FLEET_TRUCKS,
  drivers: DRIVERS,
  helpers: HELPERS,
  deliveries: DELIVERIES,
  documents: DOCUMENTS,
} as const;

export const dynamicMockClients: SmallMockClient[] = [];

export function getMockClients(): readonly SmallMockClient[] {
  return [...SMALL_MOCK_DATABASE.clients, ...dynamicMockClients];
}

export function registerMockClient(name: string): SmallMockClient {
  const trimmed = name.trim();
  const existing = getMockClients().find(
    (client) => client.name.toLowerCase() === trimmed.toLowerCase(),
  );
  if (existing) {
    return existing;
  }
  const id = `mock-client-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const code =
    trimmed
      .split(/\s+/)
      .map((word) => word[0])
      .join("")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, 6) || "CLI";
  const newClient: SmallMockClient = {
    id,
    code,
    name: trimmed,
  };
  dynamicMockClients.push(newClient);
  return newClient;
}

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
  if (trucks.filter((truck) => truck.ownershipType === "Owned").length !== 6) issues.push("Expected exactly 6 owned mock trucks.");
  if (trucks.filter((truck) => truck.ownershipType === "Subcontracted").length !== 15) issues.push("Expected exactly 15 subcontracted mock trucks.");
  if (drivers.length !== 2) issues.push("Expected exactly 2 mock drivers.");
  if (helpers.length !== 2) issues.push("Expected exactly 2 mock helpers.");
  if (deliveries.length !== 15) issues.push("Expected exactly 15 mock deliveries.");
  if (dropoffCount !== 18) issues.push("Expected exactly 18 mock drop-offs.");
  if (waybills.size !== deliveries.length) issues.push("Mock waybill numbers must be unique.");

  for (const client of clients) {
    const count = deliveries.filter((delivery) => delivery.clientId === client.id).length;
    if (count !== 5) issues.push(`${client.name} must have exactly 5 deliveries.`);
  }
  for (const delivery of deliveries) {
    const truck = trucks.find((candidate) => candidate.id === delivery.truckId);
    if (!truck) {
      issues.push(`${delivery.record.waybillNumber} references an unknown truck.`);
    } else if (
      delivery.record.truckOwnership !== truck.ownershipType ||
      delivery.record.rateBasis !== truck.rateBasis
    ) {
      issues.push(`${delivery.record.waybillNumber} has an inconsistent ownership or rate basis.`);
    }
    if (
      delivery.record.deliveryDate < SMALL_MOCK_PERIOD.start ||
      delivery.record.deliveryDate > SMALL_MOCK_PERIOD.end
    ) {
      issues.push(`${delivery.record.waybillNumber} falls outside the mock period.`);
    }
  }

  const finalized = deliveries.filter((delivery) => delivery.record.financialState === "finalized");
  const incomplete = deliveries.filter((delivery) => delivery.record.financialState === "incomplete");
  if (finalized.length !== 14 || incomplete.length !== 1) {
    issues.push("Expected 14 financially finalized deliveries and 1 incomplete delivery.");
  }
  if (summarizeTruckProfitability(deliveries.map((delivery) => delivery.record)).length !== 7) {
    issues.push("All 6 owned trucks and the active subcontracted truck must appear in confirmed profitability summaries.");
  }

  const documentStatuses = new Set(documents.map((document) => document.status));
  for (const status of ["Verified", "Submitted", "Missing", "Rejected"] as const) {
    if (!documentStatuses.has(status)) issues.push(`Missing ${status} POD document scenario.`);
  }

  return issues;
}

export const SMALL_MOCK_COMPANY_EXPENSES = [
  {
    id: "50000000-0000-4000-8000-000000000001",
    description: "Calamba Logistics Hub - Monthly Facility Rent",
    amount: 45000,
    expenseDate: "2026-10-01",
    category: "Rent & Facilities",
    notes: "Commercial lease payment for Q4 Calamba dispatch staging hub.",
    createdBy: "admin",
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-01T08:00:00.000Z",
  },
  {
    id: "50000000-0000-4000-8000-000000000002",
    description: "Meralco Electric Power - Calamba Cold Facility",
    amount: 14250.8,
    expenseDate: "2026-10-15",
    category: "Utilities",
    notes: "Electric billing for office facilities and cold room pre-cooling.",
    createdBy: "operations",
    createdAt: "2026-10-15T09:30:00.000Z",
    updatedAt: "2026-10-15T09:30:00.000Z",
  },
  {
    id: "50000000-0000-4000-8000-000000000003",
    description: "Enterprise Fiber Internet & Telecom (PLDT)",
    amount: 3499,
    expenseDate: "2026-10-18",
    category: "Utilities",
    notes: "Primary high-speed fiber dispatch line and cloud communications.",
    createdBy: "operations",
    createdAt: "2026-10-18T10:15:00.000Z",
    updatedAt: "2026-10-18T10:15:00.000Z",
  },
  {
    id: "50000000-0000-4000-8000-000000000004",
    description: "Dispatch Office Printing & RFID Tag Supplies",
    amount: 2680,
    expenseDate: "2026-10-22",
    category: "Office & Admin",
    notes: "Thermal paper rolls for waybills and RFID reload pouches.",
    createdBy: "operations",
    createdAt: "2026-10-22T14:00:00.000Z",
    updatedAt: "2026-10-22T14:00:00.000Z",
  },
  {
    id: "50000000-0000-4000-8000-000000000005",
    description: "Commercial Hub Property Insurance - October Premium",
    amount: 8500,
    expenseDate: "2026-10-25",
    category: "Insurance & Legal",
    notes: "General liability and property coverage for logistics yard.",
    createdBy: "admin",
    createdAt: "2026-10-25T11:00:00.000Z",
    updatedAt: "2026-10-25T11:00:00.000Z",
  },
  {
    id: "50000000-0000-4000-8000-000000000006",
    description: "Warehouse Staging Pallets & Heavy Jack Repair",
    amount: 4200,
    expenseDate: "2026-10-28",
    category: "Maintenance & Repairs",
    notes: "Hydraulic jack seal replacement and 10 heavy-duty plastic staging pallets.",
    createdBy: "operations",
    createdAt: "2026-10-28T16:20:00.000Z",
    updatedAt: "2026-10-28T16:20:00.000Z",
  },
  {
    id: "50000000-0000-4000-8000-000000000007",
    description: "Calamba Logistics Hub - Monthly Facility Rent",
    amount: 45000,
    expenseDate: "2026-11-01",
    category: "Rent & Facilities",
    notes: "Commercial lease payment for November 2026.",
    createdBy: "admin",
    createdAt: "2026-11-01T08:30:00.000Z",
    updatedAt: "2026-11-01T08:30:00.000Z",
  },
  {
    id: "50000000-0000-4000-8000-000000000008",
    description: "Enterprise Fiber Internet & Telecom (PLDT)",
    amount: 3499,
    expenseDate: "2026-11-05",
    category: "Utilities",
    notes: "Monthly fiber internet connectivity.",
    createdBy: "operations",
    createdAt: "2026-11-05T09:00:00.000Z",
    updatedAt: "2026-11-05T09:00:00.000Z",
  },
  {
    id: "50000000-0000-4000-8000-000000000009",
    description: "Office Drinking Water & Sanitation Supplies",
    amount: 1250,
    expenseDate: "2026-11-06",
    category: "Office & Admin",
    notes: "Water gallon refills and cleaning supplies for crew rest quarters.",
    createdBy: "operations",
    createdAt: "2026-11-06T13:45:00.000Z",
    updatedAt: "2026-11-06T13:45:00.000Z",
  },
  {
    id: "50000000-0000-4000-8000-000000000010",
    description: "Fleet Management System Cloud License - Nov 2026",
    amount: 6200,
    expenseDate: "2026-11-08",
    category: "Office & Admin",
    notes: "SaaS software subscription for GPS dispatch tracking and cloud sync.",
    createdBy: "operations",
    createdAt: "2026-11-08T09:15:00.000Z",
    updatedAt: "2026-11-08T09:15:00.000Z",
  },
  {
    id: "50000000-0000-4000-8000-000000000011",
    description: "Depot Security & Night Patrol Services",
    amount: 16500,
    expenseDate: "2026-11-10",
    category: "Rent & Facilities",
    notes: "Contracted security services for Calamba staging logistics yard.",
    createdBy: "admin",
    createdAt: "2026-11-10T10:00:00.000Z",
    updatedAt: "2026-11-10T10:00:00.000Z",
  },
  {
    id: "50000000-0000-4000-8000-000000000012",
    description: "Cold Storage Unit Periodic Thermostat Inspection",
    amount: 3800,
    expenseDate: "2026-11-11",
    category: "Maintenance & Repairs",
    notes: "Calibrated staging area cold room thermometers and backup refrigeration compressor.",
    createdBy: "operations",
    createdAt: "2026-11-11T14:30:00.000Z",
    updatedAt: "2026-11-11T14:30:00.000Z",
  },
  {
    id: "50000000-0000-4000-8000-000000000013",
    description: "Warehouse Backup Generator Fuel (Diesel)",
    amount: 5400,
    expenseDate: "2026-11-12",
    category: "Utilities",
    notes: "120 liters diesel fuel refill for standby emergency cold-chain generator.",
    createdBy: "operations",
    createdAt: "2026-11-12T11:00:00.000Z",
    updatedAt: "2026-11-12T11:00:00.000Z",
  },
  {
    id: "50000000-0000-4000-8000-000000000014",
    description: "Operations Crew Uniforms & High-Vis Safety Gear",
    amount: 4750,
    expenseDate: "2026-11-13",
    category: "Office & Admin",
    notes: "Reflective safety vests, steel-toe boots, and company ID lanyards for staging personnel.",
    createdBy: "operations",
    createdAt: "2026-11-13T15:20:00.000Z",
    updatedAt: "2026-11-13T15:20:00.000Z",
  },
  {
    id: "50000000-0000-4000-8000-000000000015",
    description: "Barangay & Municipal Commercial Operation Permits",
    amount: 7200,
    expenseDate: "2026-11-14",
    category: "Insurance & Legal",
    notes: "Q4 municipal dispatch staging clearance and environmental inspection renewal.",
    createdBy: "admin",
    createdAt: "2026-11-14T08:45:00.000Z",
    updatedAt: "2026-11-14T08:45:00.000Z",
  },
];


