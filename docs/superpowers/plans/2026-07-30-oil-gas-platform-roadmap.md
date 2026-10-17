# Oil & Gas Knowledge Platform Implementation Roadmap

| Attribute | Value |
|---|---|
| Status | Approved roadmap; does not independently authorize implementation |
| Version | 1.1 |
| Date | 2026-08-03 |
| Product authority | `docs/product/PRD.md` v1.1 |
| System design | `docs/product/system-design.md` v1.1 approved for Foundation upstream use and first-company UAT direction |
| Technical architecture | `docs/architecture/technical-architecture.md` v1.1 approved for Foundation upstream use |
| Acceptance | `docs/product/acceptance-criteria.md` |
| Approval basis | Hank delegated consistency authority; independent roadmap/authority review PASS; 2026-07-31 |

> **CURRENT EXECUTION GATE:** The approved document chain is merged into `feat/platform-foundation`. Task 1A is the next Foundation Task; after its specified verification, commit and focused requirements/code-quality review pass, execution continues through Tasks 2–10 without per-Task product approval. Recoverable failures follow the root-cause policy in `docs/knowledge-platform-launch/01-launch-strategy.md`.

**Goal:** Convert the current collection of static prototypes, generated HTML pages, JSON datasets, and scripts into one governed internal knowledge platform without a risky full rewrite.

**Architecture:** Follow the approved `docs/architecture/technical-architecture.md` v1.1: React/TypeScript Web assets and a separately maintained Hono API workspace are assembled into one production Cloudflare Worker/deployment artifact, with Supabase Auth/PostgreSQL and private Cloudflare R2. Migrate one domain at a time while retaining existing static assets only as references and migration evidence.

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
| 2 | Company UAT Vertical Slice | Email login entry, three-item sidebar, canonical company snapshot/import, eight-company list/detail APIs and ordered dashboard UI | Plan 1 |
| 3 | Project Domain | Canonical project schema, company-project roles, project search/filter/detail/map | Plans 1–2 |
| 4 | Report and Document Domain | Report metadata, private files, preview/download, extraction pipeline, relationships; missing PDFs remain unavailable | Plans 1–3 |
| 5 | Unified Search and User Workflow | Cross-domain search, favorites, recent views, saved searches, subscriptions, notifications, correction requests | Plans 2–4 |
| 6 | Admin, Ingestion, and Data Quality | Visual admin console, staged imports, deduplication, review, publication, audit and quality dashboards | Plans 2–5 |
| 7 | Hardening, Deployment, and Pilot | Mainland network validation, load/security/recovery tests, production deployment, and approved pilot analytics | Plans 1–6 |
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

Roadmap approval alone is not implementation evidence. Foundation Plan v2.1 is the canonical Task authority on `feat/platform-foundation`; Task 1A is its next Task, followed continuously by Tasks 2–10 after each preceding engineering gate passes. Each subsequent product-domain plan must be written from the then-current contracts, repository paths and closed PRD decisions. A roadmap phase row cannot substitute for an exact implementation plan.

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
| Task 2 — Shared API/authorization contracts | Queued | Execute from Foundation Plan v2.1 immediately after Task 1A passes |
| Tasks 3–10 | Not started | Execute one at a time after each preceding task is verified, committed and reviewed |

### Plan 2 — Company UAT Vertical Slice

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

Codex must execute one task at a time with TDD, run every verification command, commit with the specified message and complete a focused requirements/code-quality review before the next task. Routine per-Task implementation/review subagents are disabled to conserve cost; concentrated independent review occurs at Foundation completion and later database/authorization, login, import, and pre-UAT risk gates. An expected RED test is recorded as TDD evidence. A non-expected failure keeps the current Task open while Codex performs root-cause analysis, applies the smallest safe fix and reruns the full Task verification; it does not require a routine approval interruption. No Task may be committed while required verification is failing. Codex pauses only for destructive-data risk, security/rights/secret risk, missing external authority or credentials, an actual conflict in product authority, or an architectural escalation after the same root cause survives three fix attempts.

Current implementation sequence:

```text
Execute Task 1A next. After its required RED/GREEN evidence, complete
verification, specified commit and focused review pass, record the
commit in INDEX.md and continue through Foundation Tasks 2–10. Then write
the exact Company UAT Vertical Slice implementation plan against the
implemented Foundation contracts and execute it without per-Task approval.
```

The legacy start prompt and any unchecked Task in an earlier plan have no authority. `docs/superpowers/plans/INDEX.md` identifies the exact executable plan, branch, prerequisite implementation commit and next Task; it must be updated again after Task 1A before Task 2 starts.

---

## 8. Roadmap change control

If implementation proves that a chosen interface or provider is unsuitable:

1. Record the evidence.
2. Update Product/System Design or Technical Architecture as appropriate.
3. Update this roadmap if phase dependencies change.
4. Rewrite affected future plans before implementation.
5. Do not silently diverge from the approved specification.
