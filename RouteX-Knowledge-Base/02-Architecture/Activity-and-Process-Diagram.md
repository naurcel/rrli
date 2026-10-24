# Activity and Process Diagram

## Completed-delivery recording flow
```text
Start
  -> Confirm delivery has been completed
  -> Create/update delivery record
  -> Link truck, client, driver/crew
  -> Enter approved financial source entries
  -> Attach POD if available/required by approved rule
  -> Validate references and values
  -> Save record and audit event
  -> Recalculate approved profitability views
  -> End
```

## Correction flow
```text
Identify error -> Check permission -> Record reason -> Correct or void/reverse
-> Preserve original and before/after values -> Audit event -> Recalculate active totals
```

The exact validation failures, approval requirements, POD mandatory conditions, and calculation triggers are TBD and must be formalized before treating this as executable workflow specification.
