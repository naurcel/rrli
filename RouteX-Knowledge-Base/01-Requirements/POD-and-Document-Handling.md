# POD and Document Handling

- POD means Proof of Delivery document associated with a delivery record.
- Users with approved operational permissions can upload and retrieve POD files linked to an existing completed delivery.
- Files must be private by default and accessible only to authorized users.
- Validate file type and size; the accepted allowlist and maximum size are TBD.
- Store files in Supabase Storage as specified by the current stack, with server-side authorization checks before access.
- Do not expose service-role keys or private object paths as an authorization substitute.
- Missing-POD indicators appear in working UI/design materials, but exact trigger conditions, resolution behavior, and whether notifications are in committed scope need confirmation.
- Audit uploads, replacements, and access-relevant actions where required by the final audit policy.

> Mirrors: `RouteX_SRS.pdf`, Sections 1.3 and 2.1; `RouteX_LETTER OF AGREEMENT.docx.pdf`, Section 1.3. Update this note and the mirrored source-derived summary together when the source is revised. Canonical source copies remain unmodified.
