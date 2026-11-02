# Screen Inventory

| Screen/area | Current frontend state | Production boundary |
|---|---|---|
| Dashboard | Local date-aware metrics, chart, rankings, attention item, table/drawer | Exact formulas, sources, and role visibility TBD |
| Deliveries | Local search/filter/sort/detail and browser-local create form | Completed-delivery lifecycle, POD policy, edit/history remain TBD |
| Fleet | Owned cards, 50 synthetic subcontracted rows, filters, local create form | Ownership/history/maintenance rules remain TBD |
| Truck profile | Local profile drill-down and browser-local photo crop | Delivery history and permitted profitability remain TBD |
| Transactions/company expenses | Local KPI/table/detail/create interface | Finance workflow, posting, reconciliation, and categories remain TBD |
| Reports | Local date-aware report document and browser print action | Formats, exports, source rules, and permissions remain TBD |
| Administration | Local members table and local audit display | User/role management and retained audit remain TBD |
| Settings | Deliberate work-in-progress placeholder | Scope and persistence TBD |
| HR/compensation | No implemented screen | Not a full payroll engine |

All implemented states above are local frontend behavior, not evidence of
production persistence or authorization. See
[Current Implementation State](../../docs/CURRENT_IMPLEMENTATION_STATE.md).

See individual screen notes in `Screens/`.
