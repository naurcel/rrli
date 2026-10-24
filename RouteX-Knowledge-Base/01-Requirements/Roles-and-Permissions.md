# Roles and Permissions

## Confirmed role names
Admin, President, Corporate Secretary, Operations, Finance, HR.

## Baseline principles
- Admin manages user accounts and approved access configuration but does **not** automatically gain financial edit permission.
- Operations and Finance can both edit delivery financial entries under the current provisional approval.
- Finance manages company operating expenses not directly associated with deliveries.
- Operations manages completed delivery records and POD for operational needs.
- HR manages assigned employee/crew references and compensation summaries.
- President reviews authorized company/truck/delivery profitability and reports.
- Corporate Secretary is a confirmed role, but exact permissions are TBD; grant only explicitly approved access until resolved.

## Permission matrix status
The detailed working matrix in the [canonical feature/access-control specification](../09-References/Canonical-Documents/Working-References/RouteX_Feature_Spec_and_Access_Control.md) is a planning baseline, not final proof of access behavior. It must be reviewed field-by-field, then enforced server-side and tested for direct URL/API/file access, exports, and mutations.

## Required security tests
- Unauthorized role cannot read or mutate restricted data through UI, server action, route handler, query, export, or storage URL.
- Admin cannot edit financial data merely by being Admin.
- Operations and Finance permissions match the approved matrix for delivery financial entries.
- Disabled users cannot authenticate or retain unintended active sessions.
- Role changes take effect safely and are auditable.

See [Issues and TODOs](../08-Logs/Issues-and-TODOs.md) for open permissions.

> Mirrors: `RouteX_Feature_Spec_and_Access_Control.md`, Sections 2–4; `RouteX_SRS.pdf`, security/administration requirements. Update this note and the mirrored source-derived summary together when the source is revised. Canonical source copies remain unmodified.
