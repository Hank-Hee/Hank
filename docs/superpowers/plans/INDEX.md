# Product Documentation and Implementation Index

## Mandatory governance hold

Task 2 is paused. Do not use the legacy Codex start prompt or continue the existing foundation plan until the new product-document sequence has been reviewed and approved.

Current facts:

- `docs/product/PRD.md` v1.1 was approved by product owner Hank on 2026-07-31 and is now the sole authority for product goals, users, scope and business rules. The v1.1 permission-matrix revision is covered by Hank's delegated authority to resolve consistency issues before Task 2.
- `docs/product/acceptance-criteria.md` v1.0 is approved under Hank's delegated authority; G1-A is passed for product definition. Sales/business-development, market-research, IT, data and security signers remain required at their later G2/G3/G4/G1-B gates.
- `docs/product/system-design.md` v1.0, `docs/architecture/technical-architecture.md` v1.0 and the revalidated roadmap v1.0 are approved for Foundation upstream use after independent reviews passed with no remaining Critical/Important findings. These approvals do not claim full G2/G3/G4.
- Task 1 was completed at task scope on branch `feat/platform-foundation` in commit `aef248f` (`build: bootstrap platform workspaces`).
- Foundation execution is paused before Task 2.
- Task 1 must receive a final consistency review after the downstream Product/System Design, Technical Architecture, Roadmap, and Codex Implementation Plan have been approved.

## Required document order

The project must establish and approve documents in this order:

1. Product Requirements Document: `docs/product/PRD.md` v1.1, product-owner approved
2. Product/System Design: v1.0 approved for Foundation upstream use; named domain decisions remain gated before their product phases
3. Technical Architecture: v1.0 approved for Foundation upstream use; production G3/G4 remains gated
4. Roadmap: v1.0 approved; it does not independently authorize implementation
5. Codex Implementation Plan: pending rewrite after roadmap approval

The four-layer acceptance standard in `docs/product/acceptance-criteria.md` is a companion verification document subordinate to the PRD. It cannot add product scope.

## Document authority lifecycle

### Before any new product document is approved

- The new files are review artifacts, not yet approved requirements.
- The legacy design, roadmap, foundation plan, and corrections remain historical inputs.
- No new implementation Task may start.

### After product-owner approval of the PRD only

- `docs/product/PRD.md` becomes the sole product-requirements authority.
- Product-requirement statements in the legacy mixed design are superseded.
- The draft acceptance standard does not become approved merely because its upstream PRD was approved.
- G1-A remains blocked until the acceptance standard is approved by the product owner; later business signers remain mandatory only at the G2/G1-B gates assigned to them.
- Product/System Design may be drafted, but it cannot be approved until applicable PRD open decisions are closed and any resulting PRD revision is approved.
- No new implementation Task may start.

### After PRD, acceptance standard, and G1-A approval

- `docs/product/PRD.md` remains the sole product-requirements authority, and the acceptance standard becomes its subordinate verification specification.
- The legacy design's system/technical content, the roadmap, the foundation plan, and corrections remain paused inputs for rewriting; they are not authorization to resume coding.
- Product/System Design and Technical Architecture may be completed under delegated authority; no implementation Task may start until the remaining downstream documents, Task 1 consistency repair and review are complete.

### After all four downstream documents are approved

- The five-layer document set becomes the executable authority chain.
- Superseded legacy design, roadmap, foundation, corrections, and start prompts become historical references.
- Approval of the Roadmap alone never authorizes a Task.
- Task 2 may start only when this index names the exact approved Foundation Implementation Plan version and document commit, that document commit is merged into `feat/platform-foundation`, and the required Task 1A repair has been implemented, verified, committed and independently reviewed. Until all of those conditions hold, any older Task 2 text remains disabled.

## Current downstream status

- Revalidated Roadmap v1.0: `docs/superpowers/plans/2026-07-30-oil-gas-platform-roadmap.md`; approved but has no execution authority until paired with the separately approved Foundation Implementation Plan.

## Legacy inputs awaiting separation

- Mixed Product/System/Technical design: `docs/superpowers/specs/2026-07-30-oil-gas-knowledge-platform-design.md`
- Legacy foundation implementation plan: `docs/superpowers/plans/2026-07-30-platform-foundation.md`
- Mandatory corrections for that legacy plan only: `docs/superpowers/plans/2026-07-30-platform-foundation-execution-corrections.md`

The corrections file overrides conflicts inside the legacy foundation plan while that plan is being reviewed. It cannot override the PRD, acceptance standard, or any newly approved upstream document.

## Interim review order

For the current documentation review, read:

1. `docs/product/PRD.md`
2. `docs/product/acceptance-criteria.md`
3. `docs/superpowers/specs/2026-07-30-oil-gas-knowledge-platform-design.md` as a legacy source
4. `docs/superpowers/plans/2026-07-30-oil-gas-platform-roadmap.md` as the approved revalidated roadmap
5. The legacy foundation plan and corrections only to assess Task 1 compatibility

There is intentionally no executable Codex start prompt while this hold is active.
