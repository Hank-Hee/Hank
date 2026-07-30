# Product Documentation and Implementation Index

## Mandatory governance hold

Task 2 is paused. Do not use the legacy Codex start prompt or continue the existing foundation plan until the new product-document sequence has been reviewed and approved.

Current facts:

- `docs/product/PRD.md` and `docs/product/acceptance-criteria.md` are draft documents awaiting product-owner review.
- Task 1 was completed at task scope on branch `feat/platform-foundation` in commit `aef248f` (`build: bootstrap platform workspaces`).
- Foundation execution is paused before Task 2.
- Task 1 must receive a final consistency review after the downstream Product/System Design, Technical Architecture, Roadmap, and Codex Implementation Plan have been approved.

## Required document order

The project must establish and approve documents in this order:

1. Product Requirements Document: `docs/product/PRD.md`
2. Product/System Design: pending rewrite after PRD approval
3. Technical Architecture: pending separate document after Product/System Design approval
4. Roadmap: pending revalidation and rewrite after architecture approval
5. Codex Implementation Plan: pending rewrite after roadmap approval

The four-layer acceptance standard in `docs/product/acceptance-criteria.md` is a companion verification document subordinate to the PRD. It cannot add product scope.

## Document authority lifecycle

### While the new PRD and acceptance standard are drafts

- The new files are review artifacts, not yet approved requirements.
- The legacy design, roadmap, foundation plan, and corrections remain historical inputs.
- No new implementation Task may start.

### After PRD and acceptance approval

- `docs/product/PRD.md` becomes the sole product-requirements authority.
- Product-requirement statements in the legacy mixed design are superseded.
- The legacy design's system/technical content, the roadmap, the foundation plan, and corrections remain paused inputs for rewriting; they are not authorization to resume coding.

### After all four downstream documents are approved

- The five-layer document set becomes the executable authority chain.
- Superseded legacy design, roadmap, foundation, corrections, and start prompts become historical references.
- Task 1 is reviewed against the approved chain. Task 2 may start only after that review is clean or required Task 1 changes are completed and reviewed.

## Legacy inputs awaiting separation or revalidation

- Mixed Product/System/Technical design: `docs/superpowers/specs/2026-07-30-oil-gas-knowledge-platform-design.md`
- Provisional roadmap: `docs/superpowers/plans/2026-07-30-oil-gas-platform-roadmap.md`
- Legacy foundation implementation plan: `docs/superpowers/plans/2026-07-30-platform-foundation.md`
- Mandatory corrections for that legacy plan only: `docs/superpowers/plans/2026-07-30-platform-foundation-execution-corrections.md`

The corrections file overrides conflicts inside the legacy foundation plan while that plan is being reviewed. It cannot override the PRD, acceptance standard, or any newly approved upstream document.

## Interim review order

For the current documentation review, read:

1. `docs/product/PRD.md`
2. `docs/product/acceptance-criteria.md`
3. `docs/superpowers/specs/2026-07-30-oil-gas-knowledge-platform-design.md` as a legacy source
4. `docs/superpowers/plans/2026-07-30-oil-gas-platform-roadmap.md` as a provisional source
5. The legacy foundation plan and corrections only to assess Task 1 compatibility

There is intentionally no executable Codex start prompt while this hold is active.
