# Agent Operating Rules

1. Treat the product name as **RouteX: Profitability Analysis System**.
2. Inspect relevant source files before editing or generating implementation code.
3. Do not claim a feature is implemented because it appears in a prototype, prompt, or requirements document.
4. Do not invent missing business rules, permissions, data fields, formulas, dates, acceptance outcomes, or stakeholder decisions.
5. When a requirement is unclear or conflicting, stop the dependent implementation, add a concise issue to `08-Logs/Issues-and-TODOs.md`, and state the needed decision.
6. Preserve original records; use controlled correction/void/reversal flows with audit history.
7. Enforce authorization on the server for reads, writes, exports, and POD access.
8. Admin does not automatically receive financial edit access. Corporate Secretary permissions remain unresolved until approved.
9. Use a single shared calculation implementation for all profitability surfaces.
10. Do not hard-code the illustrative ₱500/hour amount. Additional-hour fees are variable and need approved rules.
11. Do not automatically allocate overhead without an approved rule.
12. Keep the app as one Next.js 15 App Router application; no Prisma; no separate backend app; npm.
13. Use relative Markdown links and do not use Obsidian wikilinks.
14. For logs, record real date/time when available. If clock unavailable, record the given date and `time not available`; never invent timestamps.
15. Before finishing, run relevant tests, report what was tested, what failed, and what remains blocked. Never claim success without evidence.
