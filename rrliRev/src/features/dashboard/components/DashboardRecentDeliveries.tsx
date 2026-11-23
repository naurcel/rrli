"use client";

import React from "react";
import { CompactMoney } from "@/components/compact-money";
import { SortableTableHeader, type TableSortDirection } from "@/components/sortable-table-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyState,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  isDeliveryFinanciallyComplete,
  isDeliveryIncomplete,
} from "@/features/deliveries/delivery-domain";
import type { DeliveryLedgerItem } from "@/features/deliveries/server/delivery-repository";

function parseDateParts(dateString: string): Date | null {
  const parts = dateString.split("-").map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return null;
}

function formatDashboardDate(dateValue: string): string {
  const d = parseDateParts(dateValue);
  if (d) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  return dateValue;
}

export type DashboardRecentDeliveriesProps = {
  deliveries: DeliveryLedgerItem[];
  deliverySort: { key: string; direction: TableSortDirection };
  onSort: (key: string, direction: TableSortDirection) => void;
  onSelectDelivery: (tripId: string) => void;
};

export function DashboardRecentDeliveries({
  deliveries,
  deliverySort,
  onSort,
  onSelectDelivery,
}: DashboardRecentDeliveriesProps) {
  return (
    <Card className="dashboard-recent-deliveries" aria-label="Recent completed deliveries">
      <CardHeader
        title="Recent Deliveries"
        actions={
          <Button
            variant="secondary"
            size="sm"
            href="/deliveries"
            className="secondary-button dashboard-view-all-btn"
          >
            View all
          </Button>
        }
      />

      <Table>
        <TableHeader>
          <tr>
            <SortableTableHeader
              label="Waybill & Date"
              sortKey="date"
              activeSortKey={deliverySort.key}
              direction={deliverySort.direction}
              defaultDirection="desc"
              onSort={onSort}
            />
            <SortableTableHeader
              label="Client"
              sortKey="client"
              activeSortKey={deliverySort.key}
              direction={deliverySort.direction}
              onSort={onSort}
            />
            <SortableTableHeader
              label="Truck"
              sortKey="truck"
              activeSortKey={deliverySort.key}
              direction={deliverySort.direction}
              onSort={onSort}
            />
            <SortableTableHeader
              label="Drop-offs"
              sortKey="dropoffs"
              activeSortKey={deliverySort.key}
              direction={deliverySort.direction}
              defaultDirection="desc"
              onSort={onSort}
            />
            <SortableTableHeader
              label="Revenue"
              sortKey="revenue"
              activeSortKey={deliverySort.key}
              direction={deliverySort.direction}
              defaultDirection="desc"
              onSort={onSort}
            />
            <SortableTableHeader
              label="Net Profit"
              sortKey="netIncome"
              activeSortKey={deliverySort.key}
              direction={deliverySort.direction}
              defaultDirection="desc"
              onSort={onSort}
            />
          </tr>
        </TableHeader>
        <TableBody>
          {deliveries.length === 0 ? (
            <TableEmptyState
              colSpan={6}
              title="No records found"
              description="No delivery trips recorded in this period."
            />
          ) : (
            deliveries.map((trip) => {
              const isIncomplete = isDeliveryIncomplete(trip);
              const isFinanciallyIncomplete = !isDeliveryFinanciallyComplete(trip);

              return (
                <TableRow
                  key={trip.id}
                  interactive
                  className={isIncomplete ? "is-incomplete" : ""}
                  tabIndex={0}
                  onClick={() => onSelectDelivery(trip.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectDelivery(trip.id);
                    }
                  }}
                >
                  <TableCell>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <strong>{trip.waybillNumber}</strong>
                    </div>
                    <small>{formatDashboardDate(trip.deliveryDate)}</small>
                  </TableCell>
                  <TableCell>
                    <span className="recent-client-name">{trip.clientName}</span>
                  </TableCell>
                  <TableCell className="truck-code">
                    <strong>{trip.plateNumber}</strong>
                    <br />
                    <small>{trip.truckType}</small>
                  </TableCell>
                  <TableCell>
                    <span className="recent-dropoff-pill">
                      {trip.dropoffs.length}
                    </span>
                  </TableCell>
                  <TableCell className="money">
                    {trip.deliveryRate != null && trip.deliveryRate > 0 ? (
                      <CompactMoney value={trip.deliveryRate} />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell className="money">
                    {isFinanciallyIncomplete || trip.netIncome == null ? (
                      <span
                        className="profit-amount warning"
                        title="Pending expenses"
                        style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: "var(--color-warning, #f59e0b)",
                            flexShrink: 0,
                          }}
                        />
                        Pending
                      </span>
                    ) : (
                      <CompactMoney value={trip.netIncome} />
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
