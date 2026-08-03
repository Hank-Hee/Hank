# Product Documentation and Implementation Index

## Current execution gate

Task 1A is the next implementation Task. The approved document chain is already merged into `feat/platform-foundation`. After Task 1A is implemented test-first, fully verified, committed, and reviewed, Codex continues through Tasks 2–10 without per-Task product approval under the lean engineering workflow.

Current facts:

- `docs/product/PRD.md` v1.1 was approved by product owner Hank on 2026-07-31 and is now the sole authority for product goals, users, scope and business rules. The v1.1 permission-matrix revision is covered by Hank's delegated authority to resolve consistency issues before Task 2.
- `docs/product/acceptance-criteria.md` v1.1 is approved under Hank's delegated authority; G1-A is passed for product definition. Sales/business-development, market-research, IT, data and security signers remain required at their later G2/G3/G4/G1-B gates.
- `docs/product/system-design.md` v1.1, `docs/architecture/technical-architecture.md` v1.1 and the revalidated roadmap v1.1 incorporate the approved company-first UAT direction, three-item sidebar and recoverable-failure policy. These approvals do not claim full G2/G3/G4.
- `docs/superpowers/plans/2026-07-30-platform-foundation.md` v2.1 is the canonical Codex Implementation Plan at documentation commit `a336115`.
- `docs/superpowers/plans/2026-07-30-platform-foundation-execution-corrections.md` is superseded historical evidence for the pre-v2 plan and has no executable authority over v2.1.
- Task 1 was completed at task scope on branch `feat/platform-foundation` in commit `aef248f` (`build: bootstrap platform workspaces`).
- Task 1 consistency review against the approved document chain is complete with no remaining Critical/Important findings; its Node/npm mismatch is isolated as Task 1A.
- Foundation execution is authorized continuously for Task 1A–10, subject to each Task's own RED/GREEN, verification, commit, and review gate.
- `docs/knowledge-platform-launch/` is the tracked GitHub entry for launch strategy, UAT scope, data readiness, and delivery order.

## Required document order

The project must establish and approve documents in this order:

1. Product Requirements Document: `docs/product/PRD.md` v1.1, product-owner approved
2. Product/System Design: v1.1 approved for Foundation and first-company UAT direction; named domain decisions remain gated before their product phases
3. Technical Architecture: v1.1 approved for Foundation upstream use; production G3/G4 remains gated
4. Roadmap: v1.1 approved; it does not independently prove implementation
5. Codex Implementation Plan: `docs/superpowers/plans/2026-07-30-platform-foundation.md` v2.1

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
- Superseded mixed-design requirements, pre-v2 Foundation plan text, legacy corrections, and start prompts become historical references; the approved Roadmap v1.1 and Foundation Plan v2.1 remain current.
- Approval of the Roadmap alone never authorizes a Task.
- Task 2 starts after the required Task 1A repair has been implemented, verified, committed and reviewed. Tasks 2–10 then continue without per-Task product approval, but never bypass their own engineering gates.

## Current downstream status

- Revalidated Roadmap v1.1: `docs/superpowers/plans/2026-07-30-oil-gas-platform-roadmap.md`; approved and paired with the Foundation Implementation Plan.
- Foundation Implementation Plan v2.1: `docs/superpowers/plans/2026-07-30-platform-foundation.md`; uses the approved lean engineering workflow and is recorded at documentation commit `a336115`.

## Historical inputs

- Mixed Product/System/Technical design: `docs/superpowers/specs/2026-07-30-oil-gas-knowledge-platform-design.md`
- Superseded corrections for the pre-v2 Foundation plan: `docs/superpowers/plans/2026-07-30-platform-foundation-execution-corrections.md`

The corrections file no longer overrides anything in Foundation Plan v2.1. It cannot authorize a Task or override any approved document.

## Current execution reading order

For Foundation execution, read:

1. `docs/product/PRD.md`
2. `docs/product/acceptance-criteria.md`
3. `docs/product/system-design.md`
4. `docs/architecture/technical-architecture.md`
5. `docs/superpowers/plans/2026-07-30-oil-gas-platform-roadmap.md`
6. `docs/knowledge-platform-launch/README.md`
7. `docs/superpowers/plans/2026-07-30-platform-foundation.md` v2.1

The exact next Task is Task 1A. After its reviewed commit is recorded here, execution continues to Task 2 and then through Task 10; no legacy start prompt has authority.
