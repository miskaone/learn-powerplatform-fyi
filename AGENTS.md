# AGENTS.md — learn-powerplatform-fyi

Operating rules for coding agents in this repository. The system of record for
scope, criteria, and decisions is `ISA.md` at the repo root — read it before
building anything.

## What this is

Mastery Gate: an adaptive PL-400 learning course at `learn.powerplatform.fyi/pl-400`
built for the OpenAI WebMCP Challenge (submission deadline **2026-09-03 1pm PDT**).
A deterministic TypeScript engine governs a visiting WebMCP agent (the learner's
own ChatGPT): redacted tool schemas, misconception-keyed grading, a four-dimension
mastery rubric, and dynamic tool registration/revocation.

## Build contract — do not break this

- **bun only.** `bun install`, `bun run build`, `bun test`. Never npm or npx.
- **Static export.** Next.js `output: "export"`; build output is `out/`.
  No server API routes, no SSR, no ISR.
- **One deploy path.** Push to `main` → Cloudflare Pages. Never add a GitHub
  Actions deploy workflow.
- Verified commands (bun workspaces: `apps/*`, `packages/*`):
  - `bun install` — repo root
  - `bun run build` — builds `apps/web` (Next.js static export → `apps/web/out/`)
  - `bun test` — runs bun:test across both workspaces
  - `bun run --cwd packages/mastery-gate typecheck` — strict `tsc --noEmit` on the engine package

## Architecture invariants

- `packages/mastery-gate` is **pure TypeScript**: no React imports, no network
  calls, no DOM assumptions beyond localStorage adapters. All grading, rubric,
  gate, and routing logic lives here, unit-tested, and is the only authority.
- All WebMCP access goes through the adapter shim (feature-detects
  `navigator.modelContext` vs `document.modelContext`). Nothing else touches
  the raw API.
- Tool response schemas must never contain answer-key or distractor-map
  material. Redaction is structural, not behavioral.
- Agent input (rubric scores, debrief playlists, narration advances) is
  untrusted: validate, clamp, and reject against the engine's ledger.
- Every engine path must be drivable agent-less via page UI.
- Zero runtime AI/TTS/backend calls. Voice assets are baked at build time; the
  ElevenLabs key lives in env only and is never committed.

## Safety boundaries

- Never commit credentials, tokens, or account ids. `.env*` and `.dev.vars`
  are ignored; keep it that way.
- Code is MIT; `content/` is CC BY 4.0. Remotion is used only in build-time
  tooling for video rendering, never as a runtime dependency of the site.
- The flagship repo (`miskaone/powerplatform-fyi`) is out of bounds for this
  project's changes.
