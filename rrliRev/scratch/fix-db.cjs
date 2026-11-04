const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/features/deliveries/small-mock-database.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Line 349 (WB-261102)
content = content.replace(
  `waybillNumber: "WB-261102",
      deliveryDate: "2026-11-02",
      clientName: CLIENTS[2].name,
      plateNumber: TRUCKS[2].plateNumber,
      truckType: TRUCKS[2].truckType,
      truckTemperature: "18°C–25°C",`,
  `waybillNumber: "WB-261102",
      deliveryDate: "2026-11-02",
      clientName: CLIENTS[2].name,
      plateNumber: TRUCKS[2].plateNumber,
      truckType: TRUCKS[2].truckType,
      truckTemperature: "20°C",`
);

// Line 403 (WB-261032)
content = content.replace(
  `waybillNumber: "WB-261032",
      deliveryDate: "2026-10-28",
      clientName: CLIENTS[0].name,
      plateNumber: TRUCKS[3].plateNumber,
      truckType: TRUCKS[3].truckType,
      truckTemperature: "2°C–4°C",`,
  `waybillNumber: "WB-261032",
      deliveryDate: "2026-10-28",
      clientName: CLIENTS[0].name,
      plateNumber: TRUCKS[3].plateNumber,
      truckType: TRUCKS[3].truckType,
      truckTemperature: "4°C",`
);

// Line 483 (WB-261103)
content = content.replace(
  `scenario: "Vanguard multi-temperature wholesale run from Biñan to a Taguig retail destination with finalized costs and verified receiving documents.",
    record: buildDeliveryTripRecord({
      id: "40000000-0000-4000-8000-000000000009",
      waybillNumber: "WB-261103",
      deliveryDate: "2026-11-01",
      clientName: CLIENTS[2].name,
      plateNumber: TRUCKS[5].plateNumber,
      truckType: TRUCKS[5].truckType,
      truckTemperature: "-18°C / 2°C–4°C",`,
  `scenario: "Vanguard frozen wholesale run from Biñan to a Taguig retail destination with finalized costs and verified receiving documents.",
    record: buildDeliveryTripRecord({
      id: "40000000-0000-4000-8000-000000000009",
      waybillNumber: "WB-261103",
      deliveryDate: "2026-11-01",
      clientName: CLIENTS[2].name,
      plateNumber: TRUCKS[5].plateNumber,
      truckType: TRUCKS[5].truckType,
      truckTemperature: "-20°C",`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated small-mock-database.ts!');

