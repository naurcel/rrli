# ADR-001: Post-Delivery Recordkeeping

- **Status:** Accepted direction
- **Decision date:** Confirmed in project discussion; exact date not independently recorded here
- **Sources:** [Scope and Exclusions](../00-Project-Core/Scope-and-Exclusions.md); canonical Letter of Agreement

## Context
The system supports record retrieval and profitability review after delivery, not live dispatch or tracking.

## Decision
RouteX records completed deliveries only. It is not a live GPS tracking or live dispatch system. Timing fields previously discussed are not required and must not drive automated charges under the current direction.

## Consequences
Production workflow and tests must not depend on Pending/In Transit operational stages unless the client separately approves a scope change. Delivery data is dependent on authorized staff entry.
