import type { TableSortDirection } from "@/components/sortable-table-header";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";

export function sortDeliveryLedgerItems(
  items: readonly DeliveryLedgerItem[],
  sortField: string,
  direction: TableSortDirection,
): DeliveryLedgerItem[] {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...items].sort((left, right) => {
    let leftVal: string | number | null = null;
    let rightVal: string | number | null = null;

    switch (sortField) {
      case "waybill":
        leftVal = (left.waybillNumber ?? "").toLowerCase();
        rightVal = (right.waybillNumber ?? "").toLowerCase();
        break;
      case "delivery_date":
        leftVal = left.deliveryDate ?? "";
        rightVal = right.deliveryDate ?? "";
        break;
      case "client":
        leftVal = (left.clientName ?? "").toLowerCase();
        rightVal = (right.clientName ?? "").toLowerCase();
        break;
      case "truck":
        leftVal = (left.plateNumber ?? "").toLowerCase();
        rightVal = (right.plateNumber ?? "").toLowerCase();
        break;
      case "temperature": {
        const parseTemp = (t?: string | null) => {
          const raw = t ?? "";
          const num = Number(raw.replace(/°?c/i, "").trim());
          return Number.isFinite(num) ? num : raw.toLowerCase();
        };
        leftVal = parseTemp(left.truckTemperature);
        rightVal = parseTemp(right.truckTemperature);
        break;
      }
      case "origin":
        leftVal = (left.origin ?? "").toLowerCase();
        rightVal = (right.origin ?? "").toLowerCase();
        break;
      case "dropoffs":
        leftVal = left.dropoffs?.length ?? 0;
        rightVal = right.dropoffs?.length ?? 0;
        break;
      case "distance":
        leftVal = left.distanceKm ?? 0;
        rightVal = right.distanceKm ?? 0;
        break;
      case "delivery_rate":
        leftVal = left.deliveryRate;
        rightVal = right.deliveryRate;
        break;
      case "total_expenses":
        leftVal = left.totalExpenses;
        rightVal = right.totalExpenses;
        break;
      case "net_income":
        leftVal = left.netIncome;
        rightVal = right.netIncome;
        break;
      case "profit_margin":
        leftVal = left.marginPercent;
        rightVal = right.marginPercent;
        break;
      default:
        leftVal = left.deliveryDate ?? "";
        rightVal = right.deliveryDate ?? "";
        break;
    }

    if (leftVal == null && rightVal == null) return 0;
    if (leftVal == null) return 1;
    if (rightVal == null) return -1;

    const compared =
      typeof leftVal === "number" && typeof rightVal === "number"
        ? leftVal - rightVal
        : String(leftVal).localeCompare(String(rightVal));

    return compared * multiplier || left.id.localeCompare(right.id);
  });
}
