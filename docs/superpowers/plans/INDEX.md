# Product Documentation and Implementation Index

## Current execution gate

Task 1A is the only authorized next implementation Task. Task 2 remains paused until the approved document chain is merged into `feat/platform-foundation` and Task 1A is implemented, verified, committed, and independently reviewed.

Current facts:

- `docs/product/PRD.md` v1.1 was approved by product owner Hank on 2026-07-31 and is now the sole authority for product goals, users, scope and business rules. The v1.1 permission-matrix revision is covered by Hank's delegated authority to resolve consistency issues before Task 2.
- `docs/product/acceptance-criteria.md` v1.0 is approved under Hank's delegated authority; G1-A is passed for product definition. Sales/business-development, market-research, IT, data and security signers remain required at their later G2/G3/G4/G1-B gates.
- `docs/product/system-design.md` v1.0, `docs/architecture/technical-architecture.md` v1.0 and the revalidated roadmap v1.0 are approved for Foundation upstream use after independent reviews passed with no remaining Critical/Important findings. These approvals do not claim full G2/G3/G4.
- `docs/superpowers/plans/2026-07-30-platform-foundation.md` v2.0 is the approved canonical Codex Implementation Plan at document commit `f66cf5552f45d3c6ea0f16f737047fb526c8e361`; independent full-plan review passed with no remaining Critical/Important findings.
- `docs/superpowers/plans/2026-07-30-platform-foundation-execution-corrections.md` is superseded historical evidence for the pre-v2 plan and has no executable authority over v2.0.
- Task 1 was completed at task scope on branch `feat/platform-foundation` in commit `aef248f` (`build: bootstrap platform workspaces`).
- Task 1 consistency review against the approved document chain is complete with no remaining Critical/Important findings; its Node/npm mismatch is isolated as Task 1A.
- Foundation execution is authorized only for Task 1A; Task 2 remains paused.

## Required document order

The project must establish and approve documents in this order:

1. Product Requirements Document: `docs/product/PRD.md` v1.1, product-owner approved
2. Product/System Design: v1.0 approved for Foundation upstream use; named domain decisions remain gated before their product phases
3. Technical Architecture: v1.0 approved for Foundation upstream use; production G3/G4 remains gated
4. Roadmap: v1.0 approved; it does not independently authorize implementation
5. Codex Implementation Plan: `docs/superpowers/plans/2026-07-30-platform-foundation.md` v2.0, approved at `f66cf5552f45d3c6ea0f16f737047fb526c8e361`

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
- Superseded mixed-design requirements, pre-v2 Foundation plan text, legacy corrections, and start prompts become historical references; the approved Roadmap v1.0 and Foundation Plan v2.0 remain current.
- Approval of the Roadmap alone never authorizes a Task.
- Task 2 may start only when this index names the exact approved Foundation Implementation Plan version and document commit, that document commit is merged into `feat/platform-foundation`, and the required Task 1A repair has been implemented, verified, committed and independently reviewed. Until all of those conditions hold, any older Task 2 text remains disabled.

## Current downstream status

- Revalidated Roadmap v1.0: `docs/superpowers/plans/2026-07-30-oil-gas-platform-roadmap.md`; approved and paired with the separately approved Foundation Implementation Plan, but never independently authorizes a Task.
- Foundation Implementation Plan v2.0: `docs/superpowers/plans/2026-07-30-platform-foundation.md`; approved at exact document commit `f66cf5552f45d3c6ea0f16f737047fb526c8e361`.

## Historical inputs

- Mixed Product/System/Technical design: `docs/superpowers/specs/2026-07-30-oil-gas-knowledge-platform-design.md`
- Superseded corrections for the pre-v2 Foundation plan: `docs/superpowers/plans/2026-07-30-platform-foundation-execution-corrections.md`

The corrections file no longer overrides anything in Foundation Plan v2.0. It cannot authorize a Task or override any approved document.

## Current execution reading order

For Foundation execution, read:

1. `docs/product/PRD.md`
2. `docs/product/acceptance-criteria.md`
3. `docs/product/system-design.md`
4. `docs/architecture/technical-architecture.md`
5. `docs/superpowers/plans/2026-07-30-oil-gas-platform-roadmap.md`
6. `docs/superpowers/plans/2026-07-30-platform-foundation.md` v2.0 at the exact commit above

The exact next Task is Task 1A. After its reviewed commit is recorded here, the next Task becomes Task 2; no legacy start prompt has authority.
