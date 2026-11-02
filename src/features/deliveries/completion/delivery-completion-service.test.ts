import assert from "node:assert/strict";
import test from "node:test";

import {
  type CompletionAuditEvent,
  type CompletionDelivery,
  type CompletionSuccess,
  type DeliveryCompletionRepository,
  type DeliveryCompletionTransaction,
  DeliveryCompletionService,
} from "./delivery-completion-service.ts";

const categories = [
  { category: "fuel", state: "amount", amount: 1500 },
  { category: "tolls", state: "amount", amount: 250 },
  { category: "other-expenses", state: "not-applicable" },
  { category: "entry-fees", state: "not-applicable" },
  { category: "driver-helper-costs", state: "amount", amount: 750 },
] as const;

function delivery(overrides: Partial<CompletionDelivery> = {}): CompletionDelivery {
  return {
    id: "DLV-1001",
    version: 4,
    status: "In Progress",
    clientId: "client-1",
    truckId: "truck-1",
    origin: "Manila",
    destination: "Quezon City",
    deliveryDate: "2026-10-30",
    waybillNumber: "WB-1001",
    rate: 5000,
    expenses: categories,
    ...overrides,
  };
}

class MemoryRepository implements DeliveryCompletionRepository, DeliveryCompletionTransaction {
  readonly audits: CompletionAuditEvent[] = [];
  readonly completed = new Map<string, CompletionSuccess & { idempotencyKey: string }>();
  readonly deliveries = new Map<string, CompletionDelivery>([["DLV-1001", delivery()]]);
  failTransaction = false;
  failAudit = false;
  stale = false;
  truckActive = true;

  async transaction<T>(work: (transaction: DeliveryCompletionTransaction) => Promise<T>): Promise<T> {
    if (this.failTransaction) throw new Error("transaction unavailable");
    const deliveriesBefore = new Map(this.deliveries);
    const completionsBefore = new Map(this.completed);
    const auditsBefore = [...this.audits];

    try {
      return await work(this);
    } catch (error) {
      this.deliveries.clear();
      deliveriesBefore.forEach((value, key) => this.deliveries.set(key, value));
      this.completed.clear();
      completionsBefore.forEach((value, key) => this.completed.set(key, value));
      this.audits.splice(0, this.audits.length, ...auditsBefore);
      throw error;
    }
  }

  async findDelivery(deliveryId: string) {
    return this.deliveries.get(deliveryId) ?? null;
  }

  async findDeliveryByWaybill(waybillNumber: string) {
    return Array.from(this.deliveries.values()).find((item) => item.waybillNumber === waybillNumber) ?? null;
  }

  async findTruck(truckId: string) {
    return truckId === "truck-1" ? { id: truckId, active: this.truckActive } : null;
  }

  async findCompletionByIdempotencyKey(idempotencyKey: string) {
    return this.completed.get(idempotencyKey) ?? null;
  }

  async completeDelivery(command: Parameters<DeliveryCompletionTransaction["completeDelivery"]>[0]) {
    if (this.stale) return { kind: "stale" as const };
    const stored = this.completed.get(command.idempotencyKey);
    if (stored) return { kind: "idempotency-conflict" as const };
    const current = this.deliveries.get(command.deliveryId);
    if (!current || current.version !== command.expectedVersion) return { kind: "stale" as const };

    this.deliveries.set(command.deliveryId, { ...current, status: "Completed", version: current.version + 1 });
    this.completed.set(command.idempotencyKey, {
      deliveryId: command.deliveryId,
      status: "Completed",
      completedAt: command.completedAt,
      completedBy: command.completedBy,
      financials: command.financials,
      idempotencyKey: command.idempotencyKey,
    });
    return { kind: "saved" as const };
  }

  async recordAuditEvent(event: CompletionAuditEvent) {
    if (this.failAudit) throw new Error("audit unavailable");
    this.audits.push(event);
  }
}

function subject(repository = new MemoryRepository(), allowed = true) {
  return {
    repository,
    service: new DeliveryCompletionService(
      repository,
      { canCompleteDelivery: () => allowed },
      () => new Date("2026-10-30T12:00:00.000Z"),
    ),
  };
}

const actor = { id: "staff-1", active: true };
const request = { deliveryId: "DLV-1001", expectedVersion: 4, idempotencyKey: "request-1" };

test("completes a valid in-progress delivery atomically and writes an audit event", async () => {
  const { repository, service } = subject();
  const result = await service.complete(actor, request);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.idempotent, false);
  assert.deepEqual(result.completion.financials, { rate: 5000, totalExpenses: 2500, netIncome: 2500, profitMargin: 50 });
  assert.equal(repository.deliveries.get("DLV-1001")?.status, "Completed");
  assert.equal(repository.audits.length, 1);
  assert.deepEqual(repository.audits[0]?.changes.status, { from: "In Progress", to: "Completed" });
});

test("rejects every missing required delivery field without changing status", async () => {
  const { repository, service } = subject();
  repository.deliveries.set("DLV-1001", delivery({
    clientId: null,
    truckId: null,
    origin: null,
    destination: null,
    deliveryDate: "2026-02-30",
    waybillNumber: null,
  }));

  const result = await service.complete(actor, request);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "VALIDATION_FAILED");
  assert.deepEqual(Object.keys(result.fieldErrors ?? {}).sort(), ["client", "deliveryDate", "destination", "origin", "truck", "waybillNumber"]);
  assert.equal(repository.deliveries.get("DLV-1001")?.status, "In Progress");
});

test("rejects a conflicting waybill and a deleted truck", async () => {
  const { repository, service } = subject();
  repository.deliveries.delete("DLV-1001");
  repository.deliveries.set("DLV-1002", delivery({ id: "DLV-1002", waybillNumber: "WB-1001" }));
  repository.deliveries.set("DLV-1001", delivery({ truckId: "missing-truck" }));

  const result = await service.complete(actor, request);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.fieldErrors?.truck, "The selected truck no longer exists.");
  assert.equal(result.fieldErrors?.waybillNumber, "This waybill number is already used by another delivery.");
});

test("allows a historical in-progress record linked to an inactive existing truck", async () => {
  const { repository, service } = subject();
  repository.truckActive = false;
  const result = await service.complete(actor, request);
  assert.equal(result.ok, true);
});

test("requires an explicit, valid rate and every confirmed expense category", async () => {
  const { repository, service } = subject();
  repository.deliveries.set("DLV-1001", delivery({
    rate: Number.NaN,
    expenses: [
      { category: "fuel", state: "unknown" },
      { category: "tolls", state: "amount", amount: Number.POSITIVE_INFINITY },
    ],
  }));

  const result = await service.complete(actor, request);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.fieldErrors?.rate, "Enter a valid rate greater than zero.");
  assert.equal(result.fieldErrors?.["expenses.fuel"], "Confirm an amount or mark this expense not applicable.");
  assert.equal(result.fieldErrors?.["expenses.tolls"], "Enter a valid confirmed amount.");
  assert.equal(result.fieldErrors?.["expenses.entry-fees"], "Confirm an amount or mark this expense not applicable.");
});

test("rejects non-in-progress, unauthorized, inactive, and stale completion attempts", async () => {
  const completed = subject();
  completed.repository.deliveries.set("DLV-1001", delivery({ status: "Completed" }));
  const wrongStatus = await completed.service.complete(actor, request);
  assert.equal(wrongStatus.ok, false);
  if (!wrongStatus.ok) assert.equal(wrongStatus.code, "CONFLICT");

  const denied = subject(undefined, false);
  const unauthorized = await denied.service.complete(actor, request);
  assert.equal(unauthorized.ok, false);
  if (!unauthorized.ok) assert.equal(unauthorized.code, "FORBIDDEN");

  const inactive = subject();
  const inactiveResult = await inactive.service.complete({ ...actor, active: false }, request);
  assert.equal(inactiveResult.ok, false);
  if (!inactiveResult.ok) assert.equal(inactiveResult.code, "FORBIDDEN");

  const stale = subject();
  stale.repository.stale = true;
  const staleResult = await stale.service.complete(actor, request);
  assert.equal(staleResult.ok, false);
  if (!staleResult.ok) assert.equal(staleResult.fieldErrors?.version, "The delivery is out of date.");
});

test("returns the stored success for a duplicate idempotency request", async () => {
  const { service } = subject();
  const first = await service.complete(actor, request);
  const second = await service.complete(actor, request);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (second.ok) assert.equal(second.idempotent, true);
});

test("does not report success when the transaction or audit write fails", async () => {
  const transactionFailure = subject();
  transactionFailure.repository.failTransaction = true;
  const transactionResult = await transactionFailure.service.complete(actor, request);
  assert.equal(transactionResult.ok, false);
  if (!transactionResult.ok) assert.equal(transactionResult.code, "INTERNAL_ERROR");

  const auditFailure = subject();
  auditFailure.repository.failAudit = true;
  const auditResult = await auditFailure.service.complete(actor, request);
  assert.equal(auditResult.ok, false);
  if (!auditResult.ok) assert.equal(auditResult.code, "INTERNAL_ERROR");
  assert.equal(auditFailure.repository.deliveries.get("DLV-1001")?.status, "In Progress");
  assert.equal(auditFailure.repository.audits.length, 0);
});
