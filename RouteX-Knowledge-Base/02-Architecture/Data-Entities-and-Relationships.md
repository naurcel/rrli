# Data Entities and Relationships

## Candidate entities (not final schema)
- User and role/permission assignment
- Truck/fleet record
- Client
- Employee/crew member
- Completed delivery
- Delivery revenue/charge entry
- Delivery expense entry
- Company operating expense/transaction
- Compensation summary or payable-period record
- POD file metadata/object reference
- Audit event/correction/void record

## Relationship principles
- A completed delivery links to the relevant truck, client, and assigned driver/crew as applicable.
- Delivery financial entries belong to a delivery and must be traceable individually.
- Company operating expenses not assigned to a delivery must remain separately identifiable.
- POD metadata links to a delivery; the file itself is stored in private object storage.
- Audit events identify actor, time, action, target record, reason, and before/after values where applicable.
- Deactivated reference records remain available for historical joins.

**TBD:** field definitions, cardinalities, many-to-many assignments, unique constraints, currencies/precision, period model for compensation, reversal representation, and schema migration method.
