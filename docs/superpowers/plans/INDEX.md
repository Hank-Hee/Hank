# Superpowers Implementation Plan Index

## Approved specification

- `docs/superpowers/specs/2026-07-30-oil-gas-knowledge-platform-design.md`

## Master roadmap

- `docs/superpowers/plans/2026-07-30-oil-gas-platform-roadmap.md`

## Current executable phase

Read both files in this order:

1. `docs/superpowers/plans/2026-07-30-platform-foundation.md`
2. `docs/superpowers/plans/2026-07-30-platform-foundation-execution-corrections.md`

The corrections file is mandatory and overrides conflicting foundation-plan text.

## Current execution status

- Design specification: approved.
- Roadmap: generated.
- Platform foundation plan: generated and self-reviewed.
- Implementation: not started.
- Company, project, report, search, admin, hardening, and RAG plans: generated only when their prerequisite phase has been implemented and verified.

## Codex start prompt

```text
Read these files in order:
1. docs/superpowers/specs/2026-07-30-oil-gas-knowledge-platform-design.md
2. docs/superpowers/plans/2026-07-30-oil-gas-platform-roadmap.md
3. docs/superpowers/plans/2026-07-30-platform-foundation.md
4. docs/superpowers/plans/2026-07-30-platform-foundation-execution-corrections.md

Use the Superpowers workflow. Before changing code, invoke using-git-worktrees and create an isolated worktree on branch feat/platform-foundation. Then use subagent-driven-development to execute the foundation plan one task at a time with TDD.

For each task:
- write the specified failing test first;
- run it and record the failure;
- implement only the task scope;
- run every specified verification command;
- commit with the exact task commit message;
- perform requirements and code-quality review;
- stop and report any failed command instead of continuing.

The execution-corrections file overrides conflicting text in the main foundation plan. Do not implement company, project, report, search, ingestion, notification, deployment, vector, or AI features in this branch.
```
