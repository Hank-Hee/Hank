# Oil & Gas Knowledge Platform Implementation Roadmap

| Attribute | Value |
|---|---|
| Status | Approved roadmap; does not independently authorize implementation |
| Version | 1.0 |
| Date | 2026-07-31 |
| Product authority | `docs/product/PRD.md` v1.1 |
| System design | `docs/product/system-design.md` v1.0 approved for Foundation upstream use |
| Technical architecture | `docs/architecture/technical-architecture.md` v1.0 approved for Foundation upstream use |
| Acceptance | `docs/product/acceptance-criteria.md` |
| Approval basis | Hank delegated consistency authority; independent roadmap/authority review PASS; 2026-07-31 |

> **CURRENT EXECUTION HOLD:** Task 2 remains paused until the rewritten Foundation Implementation Plan is approved, the approved document chain is merged into `feat/platform-foundation`, and the Task 1 Node consistency repair passes its review gate.

**Goal:** Convert the current collection of static prototypes, generated HTML pages, JSON datasets, and scripts into one governed internal knowledge platform without a risky full rewrite.

**Architecture:** Follow the approved `docs/architecture/technical-architecture.md` v1.0: React/TypeScript Web assets and a separately maintained Hono API workspace are assembled into one production Cloudflare Worker/deployment artifact, with Supabase Auth/PostgreSQL and private Cloudflare R2. Migrate one domain at a time while retaining existing static assets only as references and migration evidence.

**Tech Stack:** React, TypeScript, Vite, TanStack Router, TanStack Query, Hono, Cloudflare Workers, Supabase PostgreSQL/Auth, Cloudflare R2, PostgreSQL full-text search, ECharts, Vitest, Playwright, GitHub Actions.

---

## 1. Why the work is split into independent plans

The approved product scope covers several independently reviewable systems. A single implementation plan would mix unrelated failure modes and make acceptance ambiguous. The project is therefore divided into eight plans. Each plan must produce working, testable software and end with an explicit review gate.

The plans are executed in order unless a later plan explicitly states that it can run in parallel.

---

## 2. Plan sequence

| Order | Plan | Main outcome | Depends on |
|---:|---|---|---|
| 1 | Platform Foundation | Reproducible toolchain, monorepo, frontend shell, Workers API, governance database baseline, authentication boundary, private-storage adapter, CI and smoke tests | Approved five-layer document chain |
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

Roadmap approval alone authorizes no implementation. The Foundation plan path above becomes executable only after its legacy content has been rewritten, separately reviewed and approved, and `docs/superpowers/plans/INDEX.md` identifies its exact version, document commit, prerequisite implementation commit and next Task. The approved document commit must then be merged into `feat/platform-foundation`, and the Task 1A repair must be committed and independently reviewed before Task 2 can start. Each subsequent plan must be written from the then-current contracts, repository paths and closed PRD decisions. A roadmap phase row is never implementation authorization.

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
12. Files use private object storage and authorization on every access; permanent public URLs are forbidden and presigned URLs are not the baseline for restricted content.
13. Search is implemented before AI.
14. Future document chunks and embeddings inherit source permissions.
15. Critical assets must not depend on Google Fonts, `unpkg`, or inaccessible overseas map tiles.
16. Mainland corporate-network testing is a production release gate.
17. Existing static pages are references or migration inputs, not the target architecture.
18. CRM, external customers, billing, multi-tenancy, and production AI answering are outside the MVP.
19. `super_admin` controls accounts, roles and system policy but does not implicitly receive content-edit, publish, L3 or L4 access.
20. Every Implementation Task is foundation-only or tied to one named product domain; no task may smuggle in a later phase.

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

- Task 1's Node/npm declarations match the locked dependency engine requirements and reproduce under `npm ci --engine-strict`.
- Root workspace installs from a clean checkout.
- Web and API applications build.
- `/api/v1/health` returns a typed response.
- The frontend shell displays API health and protected route states.
- Supabase migrations create baseline governance, role, profile, and audit tables.
- Authentication verification and permission middleware are tested.
- CI runs type checks, unit tests, builds, migration tests, and smoke tests.

Current Foundation state:

| Work item | Status | Evidence / next gate |
|---|---|---|
| Task 1 — Bootstrap workspace | Implemented at `aef248f`; consistency fix required | Layout test passed, scope clean; Node range must be narrowed and pinned |
| Task 1A — Pin compatible Node toolchain | Pending | Must complete by TDD before Task 2 |
| Task 2 — Shared API/authorization contracts | Paused | Execute only from the rewritten plan after Task 1A passes and documents are merged |
| Tasks 3–10 | Not started | Execute one at a time after each preceding task is verified, committed and reviewed |

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
- Favorites, recent views, saved searches, subscriptions, notifications and notes work end to end.
- Users can submit and track their own correction requests; reviewer assignment, decision, resulting version/publication and closure notification remain Plan 6 exit work.

### Plan 6 — Admin, Ingestion, and Data Quality

Exit when:

- Non-technical maintainers can create, import, validate, review, publish, merge, archive, and correct records.
- Correction requests complete the reviewer assignment → evidence comparison → decision → governed version/publication → submitter notification lifecycle begun in Plan 5.
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
- All applicable G2 and G3 sub-gates are aggregated and passed, G4 is passed, and the approved production pilot has completed with approximately 40 users.
- Approved adoption criteria are met, release-blocking findings are closed, and product owner plus real sales/business-development and market-research representatives have passed G1-B.

### Plan 8 — RAG Readiness

Plan 8 cannot start merely because production is deployed. It requires Plan 7's completed G2/G3/G4 aggregation, completed pilot and passed G1-B; any production AI remains separately gated.

Exit when:

- Document sections and chunks have stable page references and permission inheritance.
- Offline hybrid retrieval can be evaluated without exposing AI answers to users.
- Citation, recall, permission, and leakage test sets exist.
- Production AI remains gated until explicit product and governance approval.

---

## 7. Codex operating model and current authorization

Codex receives only:

1. The approved PRD and four-layer acceptance standard.
2. The approved Product/System Design.
3. The approved Technical Architecture.
4. The approved, revalidated Roadmap.
5. The approved current-phase Codex Implementation Plan.
6. The repository at the commit on which the plan was written.

Codex must execute one task at a time with TDD, run every verification command, commit with the specified message and obtain an independent review before the next task. A non-expected failed verification command stops the current task and is reported; an expected RED test is recorded as TDD evidence.

Current implementation-plan hold:

```text
STOP. Task 2 is paused while the rewritten Foundation Implementation
Plan remains unapproved. After that plan is approved, merge the
document chain into feat/platform-foundation, complete
Task 1A, verify and review it, then execute the rewritten Task 2.
```

The legacy start prompt and any unchecked Task in an earlier plan have no authority. When this roadmap and the rewritten plan reach approved status, `docs/superpowers/plans/INDEX.md` must identify the exact executable plan, branch, prerequisite commit and next Task.

---

## 8. Roadmap change control

If implementation proves that a chosen interface or provider is unsuitable:

1. Record the evidence.
2. Update Product/System Design or Technical Architecture as appropriate.
3. Update this roadmap if phase dependencies change.
4. Rewrite affected future plans before implementation.
5. Do not silently diverge from the approved specification.
