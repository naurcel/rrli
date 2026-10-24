# RouteX Knowledge Base

**Product:** RouteX: Profitability Analysis System  
**Client:** Redeemed Route Logistics Inc. (RRLI)  
**Last assembled:** 2026-10-20; time recorded in `08-Logs/Agent-Sessions/2026-10-20-Knowledge-Base-Population.md`.

This repository is the working knowledge base for the RouteX project. It is intended for human readers, Obsidian, and AI coding agents. Markdown links are relative; Obsidian wikilinks are not used.

## Start here
- [Project overview](00-Project-Core/Project-Overview.md)
- [Requirements index](01-Requirements/Requirements-Index.md)
- [Architecture overview](02-Architecture/Architecture-Overview.md)
- [Design overview](03-Design/Design-Overview.md)
- [Implementation roadmap](04-Development/Implementation-Roadmap.md)
- [Frontend Loop Engineering — Build Everything, Then Cross-Check & Audit Everything](04-Development/Frontend-Loop-Engineering.md) — resumable two-phase frontend build and audit checklist.
- [Testing overview](05-Testing/Testing-Overview.md)
- [Decision register](06-Decisions/README.md)
- [AI agent operating rules](07-AI-Agents/Agent-Operating-Rules.md)
- [Unresolved issues and TODOs](08-Logs/Issues-and-TODOs.md)
- [Source index](09-References/Source-Index.md)

## Evidence and authority
Use source documents and the current confirmed decisions documented in this repository. Do not treat the prototype, mock data, draft diagrams, or AI-generated prompts as proof of implemented behavior. When sources disagree, preserve the conflict in [Issues and TODOs](08-Logs/Issues-and-TODOs.md), link the relevant sources, and do not silently decide. See [Source Authority and Conflict Handling](07-AI-Agents/Source-Authority-and-Conflict-Handling.md).

## Status language
- **Confirmed:** explicitly stated by the user or supported by a controlling project agreement.
- **Provisionally approved:** accepted for planning, but detailed behavior still needs definition or validation.
- **Proposed:** suggested in a prototype or working document, not yet confirmed as a requirement.
- **TBD:** unresolved and must not be invented.
- **Not evidence of implementation:** described in requirements/design but not verified in production code.

## Canonical copies
Original source files are preserved without modification under `09-References/Canonical-Documents/`. Supporting ZIP packages are preserved intact where available. The copies are evidence archives; this knowledge base is the readable synthesis and may be updated as decisions are confirmed.
