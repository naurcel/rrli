# Component Patterns

Patterns represented in the prototype/design packages include data tables, global header/search, collapsible sidebar, drawers, dialogs, filters, detail views, and report/export controls.

Implementation rules:
- Use shared components for repeated table, form, filter, status, and dialog patterns.
- Keep field validation visible and explain why a save failed.
- Destructive-looking actions for financial records must be controlled void/correction flows, not hard deletion.
- Every control shown in production must perform its advertised action; mock-only controls must not be presented as functional.
- Permission-sensitive controls need server enforcement regardless of whether the UI hides them.
