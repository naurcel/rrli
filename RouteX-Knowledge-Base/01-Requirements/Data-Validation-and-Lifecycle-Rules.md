# Data Validation and Lifecycle Rules

## Validation supported by source documents
- Required delivery references include delivery ID, truck plate, driver, and client, subject to final schema/field decisions.
- Delivery dates must be valid dates.
- Revenue and expense values must be numeric and non-negative where applicable. Reversals/adjustments may require a separate representation rather than negative source entries; the final rule is TBD.
- Calculated delivery margin must not be directly editable.
- POD files must use approved file types and size limits and link to an existing delivery.
- Usernames or emails must be unique; password security rules must be enforced.

## Confirmed history-preservation policy
- Do not permanently delete operational or financial records needed for history, reporting, accountability, or audit.
- Use controlled correction, void, reversal, or archive actions where appropriate.
- Require a reason for voids/reversals and material corrections.
- Audit entries should capture actor, timestamp, action, affected record, reason, and before/after values where applicable.
- Voided entries remain visible as voided and are excluded from active totals according to approved financial rules.
- Deactivate trucks and employees instead of deleting historical references.
- Disable users while preserving identity in audit records.

## TBD
Define correction workflows by entity, whether approvals are needed, reference-data change behavior, immutable fields, retention periods, and how reversals appear in exports. Implementation and tests are not yet evidenced by the prototype.

> Mirrors: `RouteX_SRS.pdf`, Section 2.1–2.3; `RouteX_Feature_Spec_and_Access_Control.md`, deletion/correction and lifecycle sections. Update this note and the mirrored source-derived summary together when the source is revised. Canonical source copies remain unmodified.
