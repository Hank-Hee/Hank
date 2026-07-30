# Oil & Gas Knowledge Platform Implementation Roadmap

> **For agentic workers:** Read `docs/superpowers/specs/2026-07-30-oil-gas-knowledge-platform-design.md` before using this roadmap. Each phase has its own executable plan. Do not implement multiple phases in one unreviewed change set.

**Goal:** Convert the current collection of static prototypes, generated HTML pages, JSON datasets, and scripts into one governed internal knowledge platform without a risky full rewrite.

**Architecture:** Build a new React/TypeScript application and Cloudflare Workers API beside the current static assets. Introduce Supabase PostgreSQL as the only master data source and private Cloudflare R2 as the only master attachment source. Migrate one domain at a time, keeping existing pages available as visual references and migration evidence until replacement acceptance.

**Tech Stack:** React, TypeScript, Vite, TanStack Router, TanStack Query, Hono, Cloudflare Workers, Supabase PostgreSQL/Auth, Cloudflare R2, PostgreSQL full-text search, ECharts, Vitest, Playwright, GitHub Actions.

---

## 1. Why the work is split into independent plans

The approved design covers several independently reviewable systems. A single implementation plan would become too large for Codex to execute safely and would mix unrelated failure modes. The project is therefore divided into eight plans. Each plan must produce working, testable software and end with an explicit review gate.

The plans are executed in order unless a later plan explicitly states that it can run in parallel.

---

## 2. Plan sequence

| Order | Plan | Main outcome | Depends on |
|---:|---|---|---|
| 1 | Platform Foundation | Monorepo, frontend shell, Workers API, database baseline, authentication boundary, CI, smoke tests | Approved design |
| 2 | Company Domain | Canonical company schema, import pipeline, company list/detail APIs and shared UI | Plan 1 |
| 3 | Project Domain | Canonical project schema, company-project roles, project search/filter/detail/map | Plans 1–2 |
| 4 | Report and Document Domain | Report metadata, private files, preview/download, extraction pipeline, relationships | Plans 1–3 |
| 5 | Unified Search and User Workflow | Cross-domain search, favorites, recent views, saved searches, subscriptions, notifications, correction requests | Plans 2–4 |
| 6 | Admin, Ingestion, and Data Quality | Visual admin console, staged imports, deduplication, review, publication, audit and quality dashboards | Plans 2–5 |
| 7 | Hardening, Deployment, and Pilot | Mainland network validation, load/security/recovery tests, production deployment, 40-user pilot analytics | Plans 1–6 |
| 8 | RAG Readiness | Document sections/chunks, permission inheritance, offline hybrid retrieval experiment and AI evaluation gate | Plans 4–7 |

---

## 3. Plan files

The following files are the intended plan set:

```text
docs/superpowers/plans/
├── 2026-07-30-oil-gas-platform-roadmap.md
├── 2026-07-30-platform-foundation.md
├── 2026-08-xx-company-domain.md
├── 2026-08-xx-project-domain.md
├── 2026-08-xx-report-document-domain.md
├── 2026-08-xx-unified-search-workflow.md
├── 2026-08-xx-admin-ingestion-data-quality.md
├── 2026-08-xx-hardening-deployment-pilot.md
└── 2026-08-xx-rag-readiness.md
```

Only the first plan is generated now. Each subsequent plan must be written after the preceding domain contracts and repository paths are verified. This prevents later plans from inventing filenames, API signatures, or database structures that conflict with the implemented foundation.

---

## 4. Cross-plan global constraints

Every plan must preserve these decisions:

1. The first release is internal only.
2. Primary users are sales and business development personnel.
3. Market research maintains and governs content.
4. Company, project, and report repositories are first-class modules.
5. PostgreSQL is the only master data source.
6. Cloudflare R2 is the only master binary attachment source.
7. GitHub JSON and Excel are migration/import artifacts, not production masters.
8. All production records have source, rights type, security level, verification status, ownership, and update metadata.
9. Security levels are L1 public, L2 internal general, L3 licensed restricted, and L4 sensitive.
10. Rights categories are `OWNED`, `PUBLIC_THIRD_PARTY`, `LICENSED_RESTRICTED`, and `DERIVED_REVIEW_REQUIRED`.
11. Authorization is enforced by the API; PostgreSQL RLS is defense in depth.
12. Files use private object storage and short-lived authorized access.
13. Search is implemented before AI.
14. Future document chunks and embeddings inherit source permissions.
15. Critical assets must not depend on Google Fonts, `unpkg`, or inaccessible overseas map tiles.
16. Mainland corporate-network testing is a production release gate.
17. Existing static pages are references or migration inputs, not the target architecture.
18. CRM, external customers, billing, multi-tenancy, and production AI answering are outside the MVP.

---

## 5. Branch and review model

Each implementation plan should be executed in an isolated worktree and feature branch.

Recommended branch names:

```text
feat/platform-foundation
feat/company-domain
feat/project-domain
feat/report-document-domain
feat/search-workflow
feat/admin-ingestion
feat/platform-hardening
feat/rag-readiness
```

Each plan should use small commits matching its task boundaries. A reviewer should be able to accept or reject one task without reviewing the entire phase again.

Do not merge a phase until:

- Its automated tests pass.
- Its migration and rollback behavior are verified.
- Its API contracts are documented.
- Its permission tests pass.
- Its user-visible acceptance criteria pass.
- The next phase can consume its published interfaces without reaching into private implementation details.

---

## 6. Phase exit criteria

### Plan 1 — Platform Foundation

Exit when:

- Root workspace installs from a clean checkout.
- Web and API applications build.
- `/api/v1/health` returns a typed response.
- The frontend shell displays API health and protected route states.
- Supabase migrations create baseline governance, role, profile, and audit tables.
- Authentication verification and permission middleware are tested.
- CI runs type checks, unit tests, builds, migration tests, and smoke tests.

### Plan 2 — Company Domain

Exit when:

- Existing company Excel/JSON data is mapped into canonical company tables.
- Aliases, regions, business segments, tags, production, and financial series have stable contracts.
- Company list and detail pages replace one-company-per-HTML behavior for pilot companies.
- Company import and duplicate checks are repeatable.

### Plan 3 — Project Domain

Exit when:

- More than 10,000 projects can be imported and paginated.
- Company-project roles are normalized.
- Project filters and detail pages meet latency targets.
- Map rendering uses normalized project coordinates without exposing raw source files.

### Plan 4 — Report and Document Domain

Exit when:

- 1,111 report records and attachments can be migrated reproducibly.
- Files are private and permission-controlled.
- Preview/download activity is audited.
- Text extraction produces page-referenced searchable text.
- Company/project/report relationships are manageable.

### Plan 5 — Unified Search and User Workflow

Exit when:

- One query searches companies, projects, reports, and extracted report text.
- Permission filtering occurs before result delivery.
- Representative search success reaches at least 90%.
- Favorites, recent views, saved searches, subscriptions, notifications, notes, and correction requests work end to end.

### Plan 6 — Admin, Ingestion, and Data Quality

Exit when:

- Non-technical maintainers can create, import, validate, review, publish, merge, archive, and correct records.
- Failed rows and jobs are visible and retryable.
- Data quality and freshness are measurable.
- Sensitive changes require approval.

### Plan 7 — Hardening, Deployment, and Pilot

Exit when:

- Production deployment and rollback are documented and tested.
- Core pages are usable within three seconds on target corporate networks.
- API P95 targets are met under the agreed load.
- No known authorization bypass remains.
- Backup and restore tests pass.
- Approximately 40 pilot users can be onboarded and measured.

### Plan 8 — RAG Readiness

Exit when:

- Document sections and chunks have stable page references and permission inheritance.
- Offline hybrid retrieval can be evaluated without exposing AI answers to users.
- Citation, recall, permission, and leakage test sets exist.
- Production AI remains gated until explicit product and governance approval.

---

## 7. Codex operating instructions

For each phase, give Codex only:

1. The approved design specification.
2. This roadmap.
3. The current phase plan.
4. The repository at the commit on which the plan was written.

Codex should not be asked to “build the whole platform” in one prompt. It should execute one task at a time, run the exact verification command, commit, and stop at the review gate.

Recommended execution prompt:

```text
Read these files first:
- docs/superpowers/specs/2026-07-30-oil-gas-knowledge-platform-design.md
- docs/superpowers/plans/2026-07-30-oil-gas-platform-roadmap.md
- docs/superpowers/plans/2026-07-30-platform-foundation.md

Use the Superpowers workflow. Create an isolated worktree and branch `feat/platform-foundation`. Execute the platform-foundation plan task by task using test-driven development. Run every verification command exactly as written. Commit after each task. Do not start the next task when the current task's tests fail. Stop at each review gate and report the changed files, command output, remaining risks, and next task.
```

---

## 8. Roadmap change control

If implementation proves that a chosen interface or provider is unsuitable:

1. Record the evidence.
2. Update the design decision log.
3. Update this roadmap if phase dependencies change.
4. Rewrite affected future plans before implementation.
5. Do not silently diverge from the approved specification.
