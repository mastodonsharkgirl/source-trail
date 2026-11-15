# Source Trail UI Implementation Plan

**Goal:** Make both Source Trail views immediately understandable, useful and visually crafted.
**Architecture:** Preserve Astro static output and existing React islands/workers. Refine the existing interface and add a small original vector evidence illustration; keep immutable records, inference and model caches unchanged.
**Tech Stack:** Existing Astro, React, TypeScript and CSS; no new runtime dependencies.
**Spec:** ../specs/2026-11-15-source-trail-ui-design.md

## Constraints and review focus

No sparkle symbols; no automatic model downloads; truthful saved/live/manual distinctions; unchanged frozen fixtures and model settings. Check small-screen ordering, stale results after edits, keyboard focus recovery, long-content overflow, and appearance/reduced-motion variants.

- [ ] Task 1 — QC and implement both views. Owner: one builder for all product files in the source worktree. Add focused regression coverage before behavior changes, capture the prior rendered pages, implement the spec, run focused checks and npm run qa, update DOMAIN_BRIEF and UI_QC_2026-11-15.md. Preserve existing accessibility and privacy tests.
- [ ] Task 2 — Independent rendered and source review. Owner: read-only QA reviewer. Inspect real output and changed states at 320/390/768/1440; report actionable issues with evidence. Implementation owner resolves findings and reruns affected checks.
- [ ] Task 3 — Portfolio integration and release. Owner: root agent in a separate portfolio worktree, after source handoff. Import built files, update exact artifact manifest and scoped CSP, run portfolio QA and browser QC, commit/push, inspect CI and deploy through documented workflow. Verify live routes/assets/headers, update concise release documentation and relevant parent metadata.

## Progress

2026-11-15: Read owner-referenced Compass prompt and later corrections. Live review confirms sparse first screen, disabled default search, poor view separation and forbidden selected-word star markers. Source worktree isolated at fd3e437. Native worktree creation did not return within bounded wait; no new worktree was observed, so Git fallback was used. Existing source and unrelated policy/portfolio work remain untouched.
