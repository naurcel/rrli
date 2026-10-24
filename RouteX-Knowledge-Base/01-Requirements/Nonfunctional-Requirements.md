# Nonfunctional Requirements

## Security and privacy
- Restrict system use to authorized personnel.
- Store passwords using a one-way cryptographic hash; never store or display them in plain text.
- Encrypt browser/server traffic using HTTPS/TLS in deployment.
- Enforce authorization on the server for reads, edits, exports, and file access; hiding interface controls is insufficient.
- Protect private POD files and do not expose storage secrets to client-side code.
- Handle personal information consistently with the Data Privacy Act of 2012 (RA 10173) and applicable requirements. Exact compliance procedures should be reviewed by the responsible parties.

## Data integrity and auditability
- Validate dates, amounts, required references, and supported file types/size limits.
- Preserve original records and correction/void history.
- Make profitability results traceable to source entries.

## Reliability and backup
- Back up data to reduce data-loss risk.
- Retention period, backup schedule, recovery-point/recovery-time objectives, and restore testing are TBD.

## Performance and compatibility
- Use a modern web browser and stable internet connection, as stated in the SRS.
- The SRS lists a minimum device baseline of dual-core 2.0 GHz CPU or higher, 8 GB RAM, at least 1 GB available storage, and 1366×768 display. Treat this as a source-stated baseline, not a tested performance guarantee.
- Quantitative performance targets and browser support matrix are TBD.

> Mirrors: `RouteX_SRS.pdf`, Sections 1.6, 2.2, and 2.3. Update this note and the mirrored source-derived summary together when the source is revised. Canonical source copies remain unmodified.
