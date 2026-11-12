# Project Isolation and Directory Cleanup

Date: 2026-11-13

## Result

`rrliRev/` is the sole active RouteX application. It now contains its own package manifest, lockfile, dependency installation, source code, assets, Supabase migration, documentation, AI instructions, scripts, and GitHub workflow. It no longer resolves its Turbopack root through the parent directory.

## Directory structure

### Before

```text
rrli/
├── src/, public/, docs/, package.json, node_modules/, .next/
├── RouteX-Knowledge-Base/
├── RouteX_Codex_Development_Kit/
├── rrliRev/
└── .git/
```

### After

```text
rrli/
├── rrliRev/                 # active RouteX project
├── _ARCHIVE/                # historical material, locally Git-excluded
├── .git/                    # preserved shared Git history
└── .tmp-edge-ui-audit/      # preserved private browser-profile data
```

## Retained in rrliRev

- Application source, public assets, Supabase migration, tests, scripts, `.env.example`, `.github` workflow, and self-contained documentation.
- `AGENTS.md`, `CLAUDE.md`, and `README.md`.
- New `package-lock.json`, local `node_modules/`, and `.gitignore`.
- `tailwindcss` is declared directly because `src/app/globals.css` imports it.
- `next.config.ts` fixes `turbopack.root` to the project directory rather than falling back to its parent.

## Archived material

- `_ARCHIVE/original-project/`: the prior root application source, assets, manifests, configurations, and instructions.
- `_ARCHIVE/old-documentation/`: prior root documentation, knowledge base, development kit, and architecture blueprint.
- `_ARCHIVE/previous-versions/`: `rrliRev` checkpoint backups and scratch scripts.
- `_ARCHIVE/other-files/`: regenerable parent and pre-isolation build outputs, parent dependencies, editor settings, and TypeScript build metadata.

`_ARCHIVE/` is excluded through the parent repository's local `.git/info/exclude` and its own `.gitignore`, keeping historical files out of normal Git status and search indexing.

## Git preservation

The existing Git repository is rooted at `rrli/`, not `rrliRev/`. Its metadata and history were preserved unchanged. A nested repository was intentionally not created: safely splitting it would require creating commits, rewriting/checking out history, or risking the existing uncommitted work. This is the sole remaining structural relationship to the parent directory; it does not affect running, testing, building, or deploying `rrliRev` directly.

## Verification

Run from `rrliRev/` after local dependency installation:

- `npm run typecheck` — passed.
- `npm test` — 232 passing tests, 0 failures or skips.
- `npm run build` — passed with Next.js 16.4.2 and Turbopack.

No lint script is declared in `package.json`.

## Intentionally preserved parent item

`.tmp-edge-ui-audit/` was not moved or deleted because it is a browser-profile directory that may contain private session data. It is neither used by `rrliRev` nor required for its development workflow.
