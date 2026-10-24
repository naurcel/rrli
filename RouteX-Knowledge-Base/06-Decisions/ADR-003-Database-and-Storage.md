# ADR-003: Database and Storage

- **Status:** Accepted working direction; schema TBD
- **Sources:** [Architecture Overview](../02-Architecture/Architecture-Overview.md); SRS and technical documentation

## Decision
Use PostgreSQL through Supabase for structured records and Supabase Storage for POD documents.

## Consequences
The schema, migration strategy, keys/relationships, backup policy, storage bucket policy, file allowlist/size limits, and restore procedure must be specified and tested. ERD drafts are not final schema approval.
