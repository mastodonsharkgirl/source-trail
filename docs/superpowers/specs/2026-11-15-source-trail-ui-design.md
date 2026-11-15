# Source Trail UI improvement

Owner request: perform UI QC, then substantially improve both Source Trail routes using the Saran design toolkit and the earlier Tetr Compass prompts. The referenced Compass request explicitly asks for implementation through verification and release, rather than stopping at a proposal. Apply its transferable design and evidence principles; do not transplant its banking content or brand.

## Intent and direction

Visitors should immediately understand the two tasks: search notes for exact passages, or inspect a saved AI answer against what it received. Retain Source Trail's editorial paper, cobalt and deep teal identity, with a coherent app shell, legible typography, rounded raised surfaces, subtle shadows and responsive interaction feedback. This is the implementation direction selected by the agent within the owner's request.

Considered approaches: cosmetic recoloring would leave the empty starting state; an entirely new app would unnecessarily threaten the working local inference and evidence boundaries. Improve the existing Astro/React product, keeping its workers and immutable evidence intact.

## Required behavior

- Evidence Desk opens with an explicitly labelled worked search example, a populated question, actual lexical results and a highlighted source. Text matching is the immediate default; never download a model on arrival. Preserve manual free-text search, optional MiniLM search, edit/add/cancel/reset, validation, source navigation and JSON export. Example actions actually run searches. Reset clears user content and shows an honest useful starting state.
- Preserve lexical ranking and historical scores/evaluations; explain weak matches and ranking versus confidence. Do not invent automatic support checks.
- Main route provides a compact explanation, clear navigation between the two views, visible entry actions, contextual original vector illustration of passages flowing into an answer, readable saved output and a conspicuous source conflict. Inspection remains manually reviewed and explicitly labelled. Changing words never changes the saved answer. Live generation remains a separate opt-in experiment with its download/capability disclosures.
- Preserve appearance options, pause, live reduced-motion changes, opaque fallback, source dialogs, generator worker and cache boundaries. No new runtime dependencies, accounts, tracking, persistence or remote inference.
- No sparkle/twinkle icons or four-point stars, including existing selected-word markers. Use check marks or meaningful symbols.
- Apply Illustrated World's content-led scene composition in a restrained original evidence-trail illustration; no unrelated scenic layers that obstruct the workspace.

## Verification

Capture before/after at 320, 390, 768 and 1440px. Test real keyboard actions, search/error/recovery, source highlights, editor cancellation/validation, reset/export, word preview, saved inspection and generation setup/cancel. Check current appearance variants, 200% text, reduced motion, no-JS readable content and no document overflow. Existing model tests remain meaningful. Run full source npm run qa with SOURCE_TRAIL_BASE=/tools/source-trail/ and preserve frozen source/evaluation bytes.

## Integration

Base source is fd3e437, matching the existing portfolio artifact manifest, avoiding the unrelated unlaunched Policy Lab branch. Integrate only Source Trail build output, canonical links, scoped headers and artifact hashes into a separate saran.info branch based on latest live Compass release; preserve all intervening work. Run portfolio QA, commit/push exact sources, inspect CI, use documented existing Pages release workflow and verify hosted routes and headers. Never equate local QA, CI or deployment states. Preserve original standalone baseline deployment. Parent workspace has unrelated modifications; update only the relevant domains.yaml fields after verification without committing unrelated edits.
