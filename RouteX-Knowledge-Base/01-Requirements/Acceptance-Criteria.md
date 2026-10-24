# Acceptance Criteria

These are initial testable criteria derived from the confirmed direction. They do not replace formal client sign-off.

- [ ] An authorized user can create a record for a completed delivery and link its truck, driver/crew, client, financial entries, and POD as applicable.
- [ ] The system does not require operational timing fields that have been explicitly removed from the current workflow.
- [ ] Delivery profitability is calculated from approved source entries and cannot be directly overwritten as a source value.
- [ ] Delivery-level and company-level results are shown distinctly; the same expense is not counted twice.
- [ ] No overhead allocation is applied without a client-approved rule.
- [ ] A variable additional-hour fee is not hard-coded to ₱500/hour or another unapproved universal amount.
- [ ] Operations and Finance can edit delivery financial entries according to the final approved matrix.
- [ ] Admin cannot edit financial data solely by virtue of Admin status.
- [ ] A Corporate Secretary account receives only explicitly approved permissions until its matrix is resolved.
- [ ] Voiding/correcting a record preserves the original and audit trail; voided entries are excluded from current totals according to approved rules.
- [ ] Deactivated trucks/employees remain linked to historical deliveries.
- [ ] POD access is private and authorized server-side.
- [ ] Reports, exports, dashboards, and detail views reconcile to the same approved calculations.
- [ ] Backup and restore procedures are tested before handover.

**Blocking dependency:** Several criteria require approved formulas, access matrix details, retention/backup settings, and client-provided worked examples. See [Issues and TODOs](../08-Logs/Issues-and-TODOs.md).
