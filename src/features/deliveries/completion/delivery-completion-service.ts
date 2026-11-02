import {
  calculateDeliveryCompletionFinancials,
  type DeliveryCompletionFinancials,
  type DeliveryExpenseConfirmation,
} from "./delivery-completion-financials.ts";

export type CompletionDelivery = {
  id: string;
  version: number;
  status: string;
  clientId: string | null;
  truckId: string | null;
  origin: string | null;
  destination: string | null;
  deliveryDate: string | null;
  waybillNumber: string | null;
  rate: number | null;
  expenses: readonly DeliveryExpenseConfirmation[];
};

export type CompletionTruck = {
  id: string;
  active: boolean;
};

export type CompletionActor = {
  id: string;
  active: boolean;
};

export type CompletionSuccess = {
  deliveryId: string;
  status: "Completed";
  completedAt: string;
  completedBy: string;
  financials: DeliveryCompletionFinancials;
};

export type StoredCompletion = CompletionSuccess & {
  idempotencyKey: string;
};

export type CompletionAuditEvent = {
  action: "delivery.completed";
  actorId: string;
  deliveryId: string;
  occurredAt: string;
  changes: {
    status: { from: string; to: "Completed" };
    rate: number;
    totalExpenses: number;
    netIncome: number;
    waybillNumber: string;
  };
};

export type CompletionWriteResult =
  | { kind: "saved" }
  | { kind: "stale" }
  | { kind: "idempotency-conflict" };

export interface DeliveryCompletionTransaction {
  findDelivery(deliveryId: string): Promise<CompletionDelivery | null>;
  findDeliveryByWaybill(waybillNumber: string): Promise<Pick<CompletionDelivery, "id"> | null>;
  findTruck(truckId: string): Promise<CompletionTruck | null>;
  findCompletionByIdempotencyKey(idempotencyKey: string): Promise<StoredCompletion | null>;
  completeDelivery(command: {
    deliveryId: string;
    expectedVersion: number;
    idempotencyKey: string;
    completedAt: string;
    completedBy: string;
    financials: DeliveryCompletionFinancials;
  }): Promise<CompletionWriteResult>;
  recordAuditEvent(event: CompletionAuditEvent): Promise<void>;
}

export interface DeliveryCompletionRepository {
  transaction<T>(work: (transaction: DeliveryCompletionTransaction) => Promise<T>): Promise<T>;
}

export type DeliveryCompletionAuthorizer = {
  canCompleteDelivery(actor: CompletionActor, delivery: CompletionDelivery): Promise<boolean> | boolean;
};

export type DeliveryCompletionResult =
  | { ok: true; completion: CompletionSuccess; idempotent: boolean }
  | {
      ok: false;
      code: "VALIDATION_FAILED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "INTERNAL_ERROR";
      message: string;
      fieldErrors?: Record<string, string>;
    };

export type CompleteDeliveryInput = {
  deliveryId: string;
  expectedVersion: number;
  idempotencyKey: string;
};

function isPresent(value: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidIsoDate(value: string | null): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function validateDeliveryDetails(delivery: CompletionDelivery): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  if (!isPresent(delivery.clientId)) fieldErrors.client = "Select a valid client.";
  if (!isPresent(delivery.truckId)) fieldErrors.truck = "Select a valid truck.";
  if (!isPresent(delivery.origin)) fieldErrors.origin = "Enter an origin.";
  if (!isPresent(delivery.destination)) fieldErrors.destination = "Enter a destination.";
  if (!isValidIsoDate(delivery.deliveryDate)) {
    fieldErrors.deliveryDate = "Enter the actual delivery date in a valid format.";
  }
  if (!isPresent(delivery.waybillNumber)) {
    fieldErrors.waybillNumber = "Enter a waybill number.";
  }

  return fieldErrors;
}

function validationResult(fieldErrors: Record<string, string>): DeliveryCompletionResult {
  return {
    ok: false,
    code: "VALIDATION_FAILED",
    message: "Review the delivery details before completing it.",
    fieldErrors,
  };
}

/**
 * Server-side delivery completion orchestration. The repository is responsible
 * for database transactions, uniqueness constraints, and atomic audit writes.
 * No browser-local preview data may call this service as a successful completion.
 */
export class DeliveryCompletionService {
  private readonly repository: DeliveryCompletionRepository;
  private readonly authorizer: DeliveryCompletionAuthorizer;
  private readonly now: () => Date;

  constructor(
    repository: DeliveryCompletionRepository,
    authorizer: DeliveryCompletionAuthorizer,
    now: () => Date = () => new Date(),
  ) {
    this.repository = repository;
    this.authorizer = authorizer;
    this.now = now;
  }

  async complete(
    actor: CompletionActor | null,
    input: CompleteDeliveryInput,
  ): Promise<DeliveryCompletionResult> {
    if (!actor || !actor.active) {
      return {
        ok: false,
        code: "FORBIDDEN",
        message: "An active authorized staff account is required to complete a delivery.",
      };
    }

    if (!isPresent(input.idempotencyKey)) {
      return validationResult({ idempotencyKey: "A completion request key is required." });
    }

    if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) {
      return validationResult({ version: "The delivery version is invalid. Reload the latest record." });
    }

    try {
      return await this.repository.transaction(async (transaction) => {
        const previous = await transaction.findCompletionByIdempotencyKey(input.idempotencyKey);
        if (previous) {
          if (previous.deliveryId !== input.deliveryId) {
            return {
              ok: false,
              code: "CONFLICT",
              message: "This completion request key was already used for a different delivery.",
            };
          }

          return { ok: true, completion: previous, idempotent: true };
        }

        const delivery = await transaction.findDelivery(input.deliveryId);
        if (!delivery) {
          return { ok: false, code: "NOT_FOUND", message: "The delivery could not be found." };
        }

        if (delivery.status !== "In Progress") {
          return {
            ok: false,
            code: "CONFLICT",
            message: "Only an in-progress delivery can be completed.",
            fieldErrors: { status: "Reload the delivery before trying again." },
          };
        }

        if (!(await this.authorizer.canCompleteDelivery(actor, delivery))) {
          return {
            ok: false,
            code: "FORBIDDEN",
            message: "You do not have permission to complete this delivery.",
          };
        }

        const fieldErrors = validateDeliveryDetails(delivery);
        if (Object.keys(fieldErrors).length > 0) return validationResult(fieldErrors);

        const truckId = delivery.truckId;
        const waybillNumber = delivery.waybillNumber;
        if (!truckId || !waybillNumber) return validationResult(fieldErrors);

        const [truck, conflictingWaybill] = await Promise.all([
          transaction.findTruck(truckId),
          transaction.findDeliveryByWaybill(waybillNumber),
        ]);

        if (!truck) fieldErrors.truck = "The selected truck no longer exists.";
        // An inactive truck remains valid on a historical, already-linked record.
        // New-delivery selection is enforced by the creation workflow instead.
        if (conflictingWaybill && conflictingWaybill.id !== delivery.id) {
          fieldErrors.waybillNumber = "This waybill number is already used by another delivery.";
        }

        const financialValidation = calculateDeliveryCompletionFinancials({
          rate: delivery.rate,
          expenses: delivery.expenses,
        });
        if (!financialValidation.ok) {
          Object.assign(fieldErrors, financialValidation.fieldErrors);
        }
        if (Object.keys(fieldErrors).length > 0) return validationResult(fieldErrors);

        if (!financialValidation.ok) return validationResult(fieldErrors);

        const completedAt = this.now().toISOString();
        const financials = financialValidation.value;
        const write = await transaction.completeDelivery({
          deliveryId: delivery.id,
          expectedVersion: input.expectedVersion,
          idempotencyKey: input.idempotencyKey,
          completedAt,
          completedBy: actor.id,
          financials,
        });

        if (write.kind === "stale") {
          return {
            ok: false,
            code: "CONFLICT",
            message: "This delivery changed while you were reviewing it. Reload the latest record before trying again.",
            fieldErrors: { version: "The delivery is out of date." },
          };
        }

        if (write.kind === "idempotency-conflict") {
          const completed = await transaction.findCompletionByIdempotencyKey(input.idempotencyKey);
          if (completed?.deliveryId === delivery.id) {
            return { ok: true, completion: completed, idempotent: true };
          }
          return {
            ok: false,
            code: "CONFLICT",
            message: "A duplicate completion request could not be safely resolved. Reload the delivery.",
          };
        }

        const completion: CompletionSuccess = {
          deliveryId: delivery.id,
          status: "Completed",
          completedAt,
          completedBy: actor.id,
          financials,
        };

        await transaction.recordAuditEvent({
          action: "delivery.completed",
          actorId: actor.id,
          deliveryId: delivery.id,
          occurredAt: completedAt,
          changes: {
            status: { from: delivery.status, to: "Completed" },
            rate: financials.rate,
            totalExpenses: financials.totalExpenses,
            netIncome: financials.netIncome,
            waybillNumber,
          },
        });

        return { ok: true, completion, idempotent: false };
      });
    } catch {
      return {
        ok: false,
        code: "INTERNAL_ERROR",
        message: "The delivery was not completed. Please try again after the save issue is resolved.",
      };
    }
  }
}
