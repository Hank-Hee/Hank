# Oil & Gas Knowledge Platform — Product and System Design

> **HISTORICAL INPUT — NOT EXECUTION AUTHORITY (2026-07-31):** Product requirements in this mixed document have been superseded by the approved `docs/product/PRD.md`. Its system and technical material is reference input only until separate Product/System Design and Technical Architecture documents are approved. Do not use this file to authorize implementation or Task 2.

- **Document status:** Proposed baseline, approved for specification drafting
- **Date:** 2026-07-30
- **Repository:** `Hank-Hee/Hank`
- **Primary audience:** Product owner, Codex implementation agent, future engineering contributors
- **Decision owner:** Hank
- **Current release objective:** Internal MVP for Wison sales and business development users
- **Future direction:** Commercialization is intentionally deferred; architecture must not block it

---

## 1. Executive Summary

The repository currently contains a strong collection of working prototypes and data-processing scripts: company banners, company profiles, global project maps, production and financial dashboards, oil and gas price automation, an industry report library, and an ExxonMobil performance pilot. These assets demonstrate the desired content coverage and visual direction, but they are implemented as separate static pages, JSON files, generated HTML files, and module-specific scripts.

The next product stage is not to add more isolated pages. It is to convert the prototypes into one governed internal knowledge platform with:

1. A unified application and navigation model.
2. A formal relational database as the system of record.
3. Private object storage for reports and attachments.
4. Standard company, project, report, source, tag, and user identifiers.
5. Automated and reviewable ingestion pipelines.
6. Unified search across companies, projects, reports, and extracted document text.
7. Role-based access control, content classification, and audit logs.
8. Subscription and change-notification workflows.
9. A data model prepared for future semantic search, vector retrieval, and RAG.
10. Measurable performance, data-quality, security, and adoption criteria.

The recommended baseline architecture is:

- **Frontend:** React + TypeScript + Vite
- **API:** Cloudflare Workers + Hono + TypeScript
- **Primary database:** Supabase PostgreSQL
- **Authentication:** Supabase Auth initially; enterprise SSO can be added later
- **File storage:** Private Cloudflare R2
- **Charts:** ECharts, with local assets
- **Search:** PostgreSQL full-text search and trigram matching for MVP
- **Future retrieval:** PostgreSQL `pgvector` and hybrid search
- **Deployment:** Cloudflare-hosted frontend/API with custom domain; database in a nearby region
- **Operational principle:** PostgreSQL is the only master data source; R2 is the only master attachment source

---

## 2. Product Context

### 2.1 Current user and business context

The first production release serves internal Wison users only.

The primary user group is:

- Sales and business development personnel.

The supporting user groups are:

- Market research administrators and content maintainers.
- Content reviewers.
- Management read-only users.
- Platform administrators.

The product is intended to help sales and business development staff quickly answer questions such as:

- What does a target company do, where does it operate, and what projects matter?
- Which oil and gas, LNG, FLNG, FPSO, FSRU, or offshore opportunities match a region or project stage?
- Which reports, attachments, and market conclusions are relevant to an upcoming client meeting?
- What changed recently for a watched company or project?
- Which source supports a specific statement or data point?

### 2.2 Confirmed data scale

Current approximate scale:

| Domain | Current scale |
|---|---:|
| Companies | 100+ |
| Projects | 10,000+ |
| Reports | 1,111 |
| Report attachments | Approximately 1,111 |
| News records | 1,000+ |
| Monthly new records | At least 1,000 |
| Initial users | Approximately 40 |
| Expected users | More than 100 |

This scale is modest for PostgreSQL but too large and operationally complex for a production system based on manually maintained static HTML pages and committed JSON files.

### 2.3 Current repository assets

The repository already contains useful prototypes and implementation patterns, including:

- `company-text-dashboard/` — Excel-derived company data and profile rendering.
- `production/` — shared production dashboard components and data-driven company pages.
- `pilot/exxon-fast/` — integrated company detail performance pilot.
- `maps/` — project map and filtering experience.
- `industry-research-library.html` — report search, filtering, and pagination.
- `industry-research-data-adapter.js` — flexible mapping from multiple source field names.
- `assets/oil-gas-dashboard.js` — market-price dashboard.
- `scripts/build-company-text-json.mjs` — Excel-to-JSON conversion.
- `scripts/update_oil_gas_data.py` — scheduled market data ingestion.
- `tests/` and pilot verification scripts — static performance and data-contract checks.
- Company-specific banner HTML files — useful visual references but high-duplication production artifacts.

The best reusable patterns are:

1. Shared chart components driven by structured data.
2. Locally hosted JavaScript and visual assets.
3. Thin entry pages around reusable components.
4. Data-contract checks and asset-size budgets.
5. Automated data generation through workflows.

The main patterns to retire are:

1. One HTML file per company.
2. JavaScript global variables as the report database.
3. GitHub JSON as the production system of record.
4. Public or permanent report attachment URLs.
5. Module-specific IDs and field definitions.
6. Hardcoded company lists, aliases, route maps, and narrative content.
7. Independent search implementations per page.

### 2.4 Review basis

This design is based on:

- The current GitHub repository contents and recent changes.
- The uploaded single-file demo.
- The confirmed business and technical requirements collected during product discovery.

The live Cloudflare deployment was not treated as the authoritative source for functional behavior; repository code and supplied artifacts are the specification baseline.

---

## 3. Product Vision and Positioning

### 3.1 Internal product statement

> A governed oil and gas intelligence platform that connects company, project, report, source, market, and internal analysis data so sales and business development users can find reliable information and prepare for client and opportunity decisions faster.

### 3.2 Long-term external positioning

Commercialization is not an MVP requirement. If pursued later, the platform should be positioned as:

> An oil and gas intelligence aggregation, normalization, verification, and analytical workflow platform.

It should not be positioned as a reseller or substitute for Rystad, S&P Global, EMA, or other licensed information services.

### 3.3 Product principles

1. **One source of truth:** production data lives in PostgreSQL, not in HTML or Git-tracked JSON.
2. **Source-first:** every material fact should be traceable to a source.
3. **Permission-first:** access control is evaluated before a record, attachment, extracted paragraph, or future AI answer is returned.
4. **Search before AI:** exact, filterable, auditable search must work before RAG is introduced.
5. **Automate collection, review publication:** ingestion should minimize manual work, while sensitive changes remain reviewable.
6. **Reusable components:** company-specific experiences must be data-driven, not copied files.
7. **Migration-friendly:** application contracts should not depend irreversibly on one cloud provider.
8. **Mainland performance is a release criterion:** real corporate-network tests are mandatory.
9. **Data quality is visible:** freshness, ownership, source, verification, and import history are product features.
10. **Commercialization remains optional:** internal value must justify the MVP independently.

---

## 4. Goals, Non-Goals, and Success Criteria

### 4.1 MVP goals

The MVP must:

1. Provide unified company, project, and report repositories.
2. Support company-to-project, company-to-report, and project-to-report relationships.
3. Allow a sales user to find relevant material within five minutes.
4. Provide unified keyword and full-text search.
5. Allow filtering by relevant business dimensions.
6. Support private report preview and download subject to permission.
7. Allow users to follow companies, projects, topics, and keywords.
8. Generate site notifications and digest-ready notification records.
9. Support favorites, recent views, internal links, and correction requests.
10. Provide a visual admin interface for non-technical data maintenance.
11. Support bulk import, validation, deduplication, review, and publication.
12. Record data origin, access level, and change history.
13. Provide stable API contracts for all major modules.
14. Prepare report text and metadata for future vector indexing and RAG.
15. Measure product usage, search outcomes, and data-maintenance health.

### 4.2 Explicit MVP non-goals

The MVP will not include:

- External customer accounts.
- Paid subscriptions or billing.
- Multi-tenant customer isolation.
- CRM integration.
- A standalone news center.
- Production AI question answering.
- Vector search in the user interface.
- Automated AI-generated conclusions published without human review.
- Elasticsearch or OpenSearch.
- A public SEO-focused website.
- A mobile application.
- Full PowerPoint generation automation.
- Legal determination of third-party redistribution rights.

### 4.3 Success criteria

The first release is successful when:

1. A sales user can find a target company, related projects, and relevant reports in five minutes or less.
2. Search produces a useful result or a clear zero-result path for at least 90% of representative test queries.
3. Core search API P95 latency is no more than 800 ms under the agreed test load.
4. Standard list API P95 latency is no more than 500 ms.
5. Standard detail API P95 latency is no more than 800 ms.
6. Core pages become usable within three seconds on tested Wison corporate networks.
7. No known cross-role or attachment access-control violation remains at release.
8. All production records have a source classification and security level.
9. Import failures, rejected rows, and stale records are visible to administrators.
10. Initial sales users repeatedly use the platform rather than visiting only once.
11. Market research users can maintain content without code changes.
12. The system can exceed 100 users without an architectural redesign.

---

## 5. Personas and Responsibilities

### 5.1 Sales and business development user

Primary needs:

- Find company and project intelligence.
- Prepare for meetings, bids, and opportunity reviews.
- Follow targets and receive update notifications.
- Save, share, and export relevant information.
- Submit corrections and additions without changing governed master data.

Allowed actions:

- Read authorized content.
- Search and filter.
- Favorite and follow.
- Add private notes.
- Submit correction requests.
- Generate internal briefs from approved data.
- Export authorized records.

### 5.2 Market research administrator

Primary needs:

- Import, clean, relate, verify, and publish data.
- Manage sources, taxonomies, aliases, and data freshness.
- Resolve duplicates and correction requests.
- Control sensitive content and attachment access.
- Monitor ingestion failures and stale records.

### 5.3 Content editor

Allowed to:

- Create and edit drafts.
- Upload attachments.
- Suggest relationships.
- Submit content for review.

Not allowed to:

- Publish restricted content without approval.
- Change user roles.
- Change global security policies.

### 5.4 Content reviewer

Allowed to:

- Review draft and changed records.
- Approve, reject, or return changes.
- Mark verification status.
- Escalate rights or security concerns.

### 5.5 Management read-only user

Allowed to:

- Read authorized dashboards and intelligence.
- Use search and exports.
- Follow key subjects.

Not allowed to:

- Edit, review, or publish.

### 5.6 Super administrator

Responsible for:

- User and role management.
- Permission policies.
- System configuration.
- Integration credentials.
- Audit access.
- Retention and backup settings.

---

## 6. Information Architecture

### 6.1 Primary navigation

1. Home
2. Companies
3. Projects
4. Reports
5. Search
6. Watchlist
7. Notifications
8. Recent activity
9. Admin, shown only to authorized roles

### 6.2 Home

The home page should provide:

- Global search.
- Recently updated companies.
- Important project changes.
- Newly published reports.
- User watchlist changes.
- Saved items.
- Quick access to common filters.
- Optional market-price summary.
- Data freshness and source notices where relevant.

### 6.3 Company repository

List functions:

- Search by company name and alias.
- Filter by company type, country, region, business segment, market position, and tags.
- Sort by latest update, name, project count, or relevance.
- Save views and export authorized results.

Company detail sections:

- Company identity and profile.
- Business areas and market positioning.
- Geographic presence.
- Global project map.
- Project list.
- Project-type mix.
- Production history and forecast.
- Financial indicators.
- Related reports.
- Related public updates or news references.
- Internal analysis and key conclusions.
- Source and update history.
- Follow, favorite, share, export, and correction actions.

Customer-follow-up records and internal contact-owner fields are excluded from the company master page in the MVP.

### 6.4 Project repository

Project list functions:

- Search by project name and aliases.
- Filter by region, country, basin, project type, lifecycle stage, operator, participant, capacity, status, source, and updated date.
- Sort by update date, relevance, stage, or capacity.
- Save views and export authorized results.

Project detail sections:

- Project identity and aliases.
- Type, status, stage, geography, coordinates, and capacity.
- Operator and participant companies.
- Timeline and milestone events.
- Technical attributes.
- Related reports and files.
- Related company profiles.
- Source records.
- Change history.
- Internal conclusions.
- Follow, favorite, share, export, and correction actions.

### 6.5 Report repository

Report list functions:

- Search title, translated title, abstract, key conclusions, tags, source, company, project, and extracted text.
- Filter by industry, region, report type, source, publication date, language, security level, and verification status.
- Sort by relevance, publication date, upload date, or last update.
- Support pagination or cursor-based loading.

Report detail sections:

- Original and Chinese titles.
- Source and publication metadata.
- Abstract.
- Key conclusions.
- Tags and taxonomy.
- Related companies and projects.
- Attachment preview.
- Authorized download.
- Extracted text status.
- Source and rights classification.
- Version and update history.
- Follow, favorite, share, and correction actions.

### 6.6 Unified search

Search must return grouped results for:

- Companies.
- Projects.
- Reports.
- Extracted report text.
- Sources and tags when useful.

Search must support:

- Exact name matching.
- Alias matching.
- Prefix and partial matching.
- Full-text search.
- Typo-tolerant matching through PostgreSQL trigram support.
- Filters shared across result types.
- Permission filtering before results are returned.
- Highlighted snippets.
- Search analytics.
- Zero-result logging.
- Suggested corrections and alternate terms.

### 6.7 Watchlist and notifications

Users can follow:

- Companies.
- Projects.
- Report topics.
- Regions.
- Project types.
- Keywords.

Notification event types:

- Company profile update.
- New company-project relationship.
- New project.
- Project stage or status change.
- New related report.
- New or replaced attachment.
- Production or financial data refresh.
- Important research conclusion.
- Administrator announcement.

Notification delivery for MVP:

- In-app notification center.
- Digest-ready records for future email delivery.
- Optional email digest only after authentication and mail-delivery policies are confirmed.

---

## 7. Core User Journeys

### 7.1 Prepare for a client meeting

1. User searches a company.
2. User opens the company profile.
3. User reviews business areas, key projects, recent changes, production, financials, and relevant reports.
4. User filters projects by region, type, and stage.
5. User saves selected records.
6. User creates an internal meeting brief from approved fields.
7. User shares the brief or internal link with colleagues.
8. System records source references and the brief generation event.

### 7.2 Find a project opportunity

1. User opens the project repository.
2. User applies region, project type, lifecycle stage, operator, and capacity filters.
3. User opens a project detail record.
4. User reviews participants, milestones, reports, and change history.
5. User follows the project.
6. Future material changes generate a notification.

### 7.3 Find supporting reports

1. User enters a company, project, topic, or question-like keyword query.
2. Search returns report metadata and extracted-text snippets.
3. User filters by source, date, region, and report type.
4. User opens a report.
5. System checks attachment authorization.
6. User previews or downloads the report.
7. The view and download are written to the audit log.

### 7.4 Submit a correction

1. Sales user opens a record.
2. User selects “Submit correction”.
3. User identifies the field and proposed correction, with optional source or attachment.
4. A correction request is created.
5. Market research reviews the request.
6. Accepted changes create a new record version and optional subscriber notification.
7. Rejected changes retain the review reason.

### 7.5 Bulk import and publish

1. Administrator uploads Excel or CSV.
2. System identifies the import template.
3. System validates fields, types, required values, references, and security levels.
4. System computes duplicate candidates and change previews.
5. Valid rows enter staging; invalid rows remain downloadable as an error report.
6. Reviewer approves all or selected changes.
7. Approved records are written transactionally.
8. Search index fields and relationships are refreshed.
9. Material changes create notification events.
10. Import run statistics and errors remain auditable.

---

## 8. Functional Requirements

### 8.1 Company management

The system must support:

- Create, read, update, archive, restore.
- Stable UUID and human-readable slug.
- Multiple names and aliases.
- Structured geography and business taxonomy.
- Many-to-many company-project relationships.
- Related reports and source records.
- Time-series production and financial metrics.
- Draft, review, published, archived status.
- Field-level source references where feasible.
- Record version history.
- Duplicate candidate detection.

### 8.2 Project management

The system must support:

- Stable UUID and aliases.
- Type, stage, status, country, region, coordinates, capacity, and date attributes.
- Multiple participating companies with relationship roles.
- Milestones and event history.
- Related reports, source records, and files.
- Structured technical attributes.
- Draft and review workflow.
- Change detection and subscription events.

### 8.3 Report management

The system must support:

- Metadata import and editing.
- One or multiple attachments.
- Original title and normalized Chinese title.
- Source, publication date, report type, region, topic, and language.
- Abstract and key conclusions.
- Related companies and projects.
- Attachment checksum and duplicate detection.
- Private preview and permission-controlled download.
- Text-extraction status.
- Rights and security classification.
- Review and publication workflow.

### 8.4 Admin console

The admin console must include:

- Company CRUD.
- Project CRUD.
- Report CRUD and upload.
- Source management.
- Tag and taxonomy management.
- Bulk import.
- Import templates.
- Staging and validation.
- Duplicate management.
- Review and publishing.
- Correction-request management.
- User and role management.
- Security-level management.
- Audit and data-change logs.
- Data-quality dashboard.
- Usage analytics.
- Notification-event management.
- Failed job and retry interface.

### 8.5 Export and sharing

The MVP should support:

- CSV/XLSX export for authorized lists.
- PDF export for selected company or project briefs.
- Internal share links that require authentication.
- Permission checks at export time.
- Export audit logs.
- Watermarking or user identification for restricted exports where required.

PowerPoint export can be deferred unless a validated sales workflow requires it before release.

---

## 9. Data Governance and Rights Model

### 9.1 Content ownership categories

Every source, record, file, extracted text block, and future vector chunk must inherit or define a rights category:

- `OWNED`
- `PUBLIC_THIRD_PARTY`
- `LICENSED_RESTRICTED`
- `DERIVED_REVIEW_REQUIRED`

### 9.2 Security levels

The accepted baseline is:

- **L1 — Public information**
- **L2 — General internal information**
- **L3 — Licensed subscription information**
- **L4 — Sensitive analysis or management information**

### 9.3 Required governance fields

All publishable records should include:

- `security_level`
- `rights_type`
- `source_id`
- `source_url` where applicable
- `source_reference`
- `verification_status`
- `verified_by`
- `verified_at`
- `owner_user_id` or owner team
- `last_reviewed_at`
- `next_review_due_at`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

### 9.4 Access rules

1. L1 and L2 are available to ordinary authenticated users unless module policy is narrower.
2. L3 is limited to roles and users covered by the relevant internal subscription policy.
3. L4 requires explicit role or record-level permission.
4. File access must never rely only on knowing an object URL.
5. Extracted text cannot have broader access than the source file.
6. Future vector chunks and AI answers cannot have broader access than their source records.
7. Export and download actions for L3 and L4 must be logged.
8. Administrators cannot silently downgrade a security level without a recorded reason.
9. Deleted records should normally be archived or soft-deleted to preserve auditability.

### 9.5 Commercialization boundary

The MVP does not provide external access. A future commercialization release requires a separate legal and product review covering:

- Subscription contract rights.
- Redistribution and derivative-work restrictions.
- External user licensing.
- Tenant isolation.
- Billing and terms.
- Public-source revalidation.
- External AI use and output policies.

No current implementation decision should imply that licensed third-party data can be commercially redistributed.

---

## 10. Recommended System Architecture

### 10.1 Architecture overview

```text
Authenticated user
    |
    v
React + TypeScript frontend
    |
    v
Cloudflare Workers API
    |-------------------------|
    |                         |
    v                         v
Supabase PostgreSQL       Cloudflare R2
    |                         |
    |                         +-- private reports and attachments
    |                         +-- logos and controlled assets
    |                         +-- export artifacts
    |
    +-- master data
    +-- relationships
    +-- auth profile and roles
    +-- search vectors for full-text search
    +-- workflow and audit records
    +-- subscriptions and notifications
    +-- extracted document text metadata
    +-- future pgvector embeddings
```

### 10.2 Frontend

Recommended stack:

- React
- TypeScript
- Vite
- TanStack Router
- TanStack Query
- Tailwind CSS
- shadcn/ui or an equivalent accessible component system
- ECharts
- Zod-compatible API contract types where useful

Frontend responsibilities:

- Routing and page composition.
- Query caching and loading states.
- Accessible filters and tables.
- Charts and maps.
- Permission-aware presentation.
- Import preview and validation UI.
- No direct use of privileged database credentials.
- No business-critical authorization implemented only in the browser.

### 10.3 API

Recommended stack:

- Cloudflare Workers
- Hono
- TypeScript
- REST-style versioned endpoints
- Zod or equivalent input validation
- OpenAPI generation where practical

API responsibilities:

- Authentication verification.
- Role and record authorization.
- Query validation.
- Database transactions.
- Signed R2 access.
- Audit logging.
- Import orchestration.
- Notification creation.
- Rate limiting.
- Error normalization.
- Correlation IDs and observability.

Initial route families:

```text
/api/v1/auth
/api/v1/companies
/api/v1/projects
/api/v1/reports
/api/v1/files
/api/v1/search
/api/v1/favorites
/api/v1/subscriptions
/api/v1/notifications
/api/v1/corrections
/api/v1/exports
/api/v1/admin/imports
/api/v1/admin/reviews
/api/v1/admin/users
/api/v1/admin/taxonomies
/api/v1/admin/data-quality
```

### 10.4 Database

Recommended baseline:

- Supabase-managed PostgreSQL.
- Region selected after latency testing, with Singapore as the initial candidate.
- SQL migrations stored in the repository.
- PostgreSQL extensions enabled only when justified.
- Application tables use UUID primary keys.
- Human-facing slugs are unique but are not primary keys.
- Soft deletion for governed master records.
- Transactional import publication.
- Row-level security used as defense in depth, not as a substitute for API authorization.

### 10.5 Authentication

MVP:

- Simple internal accounts.
- Email/password or approved email-based authentication.
- Role and profile data stored separately from authentication provider metadata.
- Session expiration and password policy.
- Administrator-driven account provisioning if self-registration is inappropriate.

Future:

- Microsoft Entra ID / Microsoft 365 SSO.
- Domain restrictions.
- Group-to-role mapping.
- Automated offboarding.

### 10.6 File storage

Recommended baseline:

- Private Cloudflare R2 buckets.
- No report attachment stored as a public repository asset.
- File access through short-lived signed URLs after API authorization.
- Checksum-based duplicate detection.
- Object keys independent of original filenames.
- Metadata and access classification stored in PostgreSQL.
- Upload status, malware-scan status, extraction status, and retention status tracked explicitly.

### 10.7 Map strategy

Use a product decision per use case:

- A locally hosted vector map for company overview and high-speed summary.
- A richer interactive map only where filters, geographic detail, and project exploration justify it.
- Avoid runtime dependencies on inaccessible or unstable overseas map tiles.
- Store normalized coordinates and geographic identifiers in PostgreSQL.
- Keep map rendering independent from the source data schema.

### 10.8 Charts

- Retain ECharts for complex charts.
- Use shared chart components.
- Load local chart assets.
- Use normalized API response schemas.
- Separate metric definitions from presentation.
- Store units, currency, period type, actual/forecast status, and source with each data point.

---

## 11. Proposed Data Model

The detailed ERD and field dictionary will be produced after this specification is approved. The following entities are required.

### 11.1 Identity and access

- `users`
- `user_profiles`
- `roles`
- `permissions`
- `user_roles`
- `role_permissions`
- `teams`
- `team_members`
- `record_access_grants`
- `user_sessions` if not fully provider-managed

### 11.2 Company domain

- `companies`
- `company_aliases`
- `company_profiles`
- `company_business_segments`
- `company_regions`
- `company_tags`
- `company_metrics`
- `company_metric_series`

### 11.3 Project domain

- `projects`
- `project_aliases`
- `project_locations`
- `project_attributes`
- `project_milestones`
- `project_companies`
- `project_tags`
- `project_status_history`

### 11.4 Report and document domain

- `reports`
- `report_files`
- `report_companies`
- `report_projects`
- `report_tags`
- `report_regions`
- `document_extractions`
- `document_pages`
- `document_sections`
- `document_chunks`, reserved for future RAG
- `document_embeddings`, reserved for future RAG

### 11.5 Source and governance domain

- `sources`
- `source_licenses`
- `record_sources`
- `verification_records`
- `security_levels`
- `rights_types`
- `record_versions`
- `audit_events`
- `data_quality_issues`

### 11.6 User workflow domain

- `favorites`
- `subscriptions`
- `notification_events`
- `notifications`
- `saved_searches`
- `recent_views`
- `user_notes`
- `correction_requests`
- `exports`

### 11.7 Ingestion and operations domain

- `import_templates`
- `import_runs`
- `import_rows`
- `import_errors`
- `deduplication_candidates`
- `background_jobs`
- `job_attempts`
- `integration_sources`
- `sync_runs`

### 11.8 Taxonomy domain

- `tags`
- `tag_types`
- `industries`
- `regions`
- `countries`
- `project_types`
- `project_stages`
- `report_types`
- `business_segments`

### 11.9 Key relationship rules

1. A company can participate in many projects.
2. A project can have many companies with different roles.
3. A report can relate to many companies and projects.
4. A source can support many records.
5. A record can cite multiple sources.
6. Files inherit security and rights defaults from their report but can be stricter.
7. Subscriptions point to a normalized subject type and subject ID, or to a saved query.
8. Notifications originate from material change events.
9. Record versions preserve prior approved states.
10. Future chunks and embeddings must reference their report, file, page, and security context.

---

## 12. Search Design

### 12.1 MVP search index

Use PostgreSQL full-text search and trigram matching.

Indexed content includes:

- Company names and aliases.
- Project names and aliases.
- Report titles and translated titles.
- Abstracts.
- Key conclusions.
- Tags.
- Regions.
- Company and project relationships.
- Extracted report text.
- Source names.

### 12.2 Relevance strategy

Initial ranking signals:

1. Exact canonical-name match.
2. Exact alias match.
3. Prefix match.
4. Title match.
5. Tag or taxonomy match.
6. Full-text relevance.
7. Relationship relevance.
8. Recency.
9. Verification status.
10. User watchlist or prior behavior only if later validated.

### 12.3 Search analytics

Record:

- Query text.
- Normalized query.
- Filters.
- Result count.
- Top result types.
- Clicked record.
- Time to first click.
- Zero-result status.
- User role.
- Search session ID.

Search analytics must avoid storing secrets or unnecessary sensitive free text.

### 12.4 Future semantic retrieval

The MVP must prepare:

- Clean extracted text.
- Stable page and section references.
- Chunk IDs.
- Source and security inheritance.
- Language metadata.
- Document version linkage.
- Embedding status fields.

Future retrieval flow:

```text
Query
→ authentication and permission context
→ keyword candidate retrieval
→ vector candidate retrieval
→ permission filtering
→ reranking
→ source-context assembly
→ answer generation
→ inline citation
→ audit record
```

No AI response may cite content that the requesting user cannot directly access.

---

## 13. Ingestion and Publication Design

### 13.1 Supported ingestion methods

The system should support multiple methods:

1. Excel and CSV bulk import.
2. Manual admin editing.
3. Scheduled scripts.
4. Approved APIs.
5. Public-web collection with human review.
6. Attachment upload and metadata extraction.

### 13.2 Source-of-truth policy

- PostgreSQL is the master data source.
- R2 is the master binary-file source.
- Excel is an import/export format.
- GitHub JSON is a build artifact or test fixture only.
- Simple generated static pages are not authoritative records.
- Existing module JSON can be imported and archived as migration evidence.

### 13.3 Import lifecycle

Statuses:

- `UPLOADED`
- `PARSING`
- `VALIDATING`
- `READY_FOR_REVIEW`
- `PARTIALLY_VALID`
- `REJECTED`
- `APPROVED`
- `PUBLISHING`
- `PUBLISHED`
- `FAILED`
- `ROLLED_BACK`

### 13.4 Validation categories

- Required fields.
- Type validation.
- Date and number formats.
- Country and region normalization.
- Unit and currency validation.
- Foreign-key existence.
- Duplicate company, project, report, and file detection.
- Rights and security fields.
- Source existence.
- URL format.
- Unsupported attachment type.
- Row-level permission conflicts.
- Material-change detection.

### 13.5 Deduplication

Use deterministic and fuzzy indicators:

- Stable source ID.
- Exact normalized name.
- Alias match.
- Report title + source + publication date.
- Project name + country + operator.
- File checksum.
- Trigram similarity.
- Manual merge decision.

Merges must preserve:

- Source references.
- External IDs.
- Audit history.
- Relationships.
- Prior aliases.
- File associations.

### 13.6 Publication workflow

Baseline policy:

- Ordinary data may publish automatically only when it passes a trusted import template and no material security or rights change occurs.
- Sensitive, licensed, or material changes require review.
- The accepted default is: ordinary data can publish automatically; sensitive data requires review.
- Every publication creates a version record.
- Subscriber notifications are created only for material changes.

---

## 14. Notification Design

### 14.1 Subscription targets

- Company.
- Project.
- Report topic.
- Region.
- Project type.
- Keyword.
- Saved search.

### 14.2 Change importance

Each change event receives:

- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

Examples:

- Typographic correction: low.
- New related report: medium.
- Project stage change: high.
- Major award, cancellation, FID, contract, or ownership change: high or critical depending on policy.

### 14.3 Delivery policy

- Low and medium events default to digest.
- High and critical events can create immediate in-app notifications.
- Duplicate events are grouped.
- Users can mute subjects and adjust frequency.
- Administrators can suppress mistaken events.
- Notification creation is auditable.

---

## 15. Performance and Scalability Requirements

### 15.1 Initial targets

| Metric | MVP target |
|---|---:|
| Core page usable time on tested corporate network | ≤ 3 seconds |
| Search API P95 | ≤ 800 ms |
| Standard list API P95 | ≤ 500 ms |
| Standard detail API P95 | ≤ 800 ms |
| Error rate for core requests | < 1% |
| Search success for representative queries | ≥ 90% |
| Initial user count | 40 |
| Supported growth without redesign | 100+ users |

### 15.2 Scalability assumptions

- The initial record count is well within PostgreSQL capacity.
- Attachment size, text extraction, and future vector data will dominate storage growth.
- List APIs must use pagination.
- Expensive aggregates should be precomputed or cached.
- Charts should request only required series.
- Imports and document extraction must run asynchronously.
- Large exports must use background jobs.
- Database connections from Workers must use an appropriate pooling strategy.
- Cache behavior must not bypass permissions.

### 15.3 Mainland network testing

Before release, test from actual Wison networks in relevant offices.

Test:

- DNS and TLS setup.
- Custom domain.
- Authentication.
- Static asset delivery.
- API latency.
- R2 preview and download.
- Database round-trip latency.
- Browser compatibility.
- Failure and retry behavior.

Third-party runtime dependencies such as Google Fonts, `unpkg`, or inaccessible map tiles must be removed from critical paths.

---

## 16. Security Requirements

### 16.1 Authentication and session security

- No open self-registration unless explicitly approved.
- Enforce password and session policy.
- Secure, HTTP-only cookies where applicable.
- CSRF protection for cookie-authenticated mutations.
- Rate limits for login and sensitive endpoints.
- Account disablement and offboarding.
- No service-role secrets in frontend code.

### 16.2 Authorization

- Deny by default.
- Enforce authorization in the API.
- Use database RLS as defense in depth.
- Check permissions for previews, downloads, exports, and extracted text.
- Test horizontal and vertical privilege escalation.
- Record role and permission changes.

### 16.3 File security

- Private buckets.
- Short-lived signed URLs.
- MIME validation.
- File-size limits.
- Malware-scanning integration point.
- Checksum and duplicate detection.
- Filename sanitization.
- No direct execution of uploaded content.
- Preview isolation.
- Download audit logging.

### 16.4 Application security

- Input validation.
- Parameterized SQL.
- Output encoding.
- Content Security Policy.
- Secure headers.
- Dependency scanning.
- Secret management.
- Error messages without sensitive details.
- Correlation IDs.
- Administrative action audit.

### 16.5 Data protection and retention

- Backup policy.
- Restore testing.
- Retention for audit events.
- Soft deletion and controlled purge.
- Export retention.
- User-note privacy.
- Removal of accounts and reassignment of owned content.
- Incident-response owner to be assigned before production.

---

## 17. Observability and Operations

The platform must provide:

- Structured application logs.
- API request metrics.
- Error tracking.
- Background-job status.
- Import-run dashboards.
- Database health and slow-query review.
- R2 upload/download failures.
- Authentication failures.
- Permission-denied metrics.
- Search latency and zero-result metrics.
- Notification backlog.
- Data freshness dashboard.

Recommended operational identifiers:

- `request_id`
- `correlation_id`
- `user_id`
- `job_id`
- `import_run_id`
- `record_id`
- `source_id`

Sensitive source content must not be written into general logs.

---

## 18. Test Strategy

All listed test categories are required.

### 18.1 Unit tests

Cover:

- Validation.
- Normalization.
- Permission decisions.
- Relevance helpers.
- Change classification.
- Notification grouping.
- Import parsers.
- Metric calculations.

### 18.2 Data-quality tests

Cover:

- Required fields.
- Unique IDs and slugs.
- Relationship integrity.
- Source presence.
- Rights and security classification.
- Production-series total consistency.
- Financial metric unit consistency.
- Duplicate checks.
- Stale-record rules.
- File-to-report integrity.

### 18.3 API tests

Cover:

- Success responses.
- Validation failures.
- Pagination.
- Filtering.
- Sorting.
- Idempotent imports where required.
- Transactions and rollback.
- Signed URL expiry.
- Stable error schema.

### 18.4 Permission and security tests

Cover:

- Cross-role access.
- Record-level restrictions.
- Attachment access.
- Export restrictions.
- Admin-only routes.
- Disabled users.
- Direct-object reference attempts.
- Search-result leakage.
- Extracted-text leakage.
- Future vector-retrieval leakage.

### 18.5 Frontend end-to-end tests

Use Playwright or equivalent to cover:

- Login.
- Global search.
- Company lookup.
- Project filtering.
- Report preview.
- Favorite and follow.
- Correction submission.
- Import preview.
- Review and publication.
- Notification viewing.
- Permission-denied states.

### 18.6 Browser compatibility

Minimum target set should be confirmed with corporate IT, but initially include:

- Current Chrome.
- Current Edge.
- Current Safari where Mac users are supported.

### 18.7 Performance tests

Cover:

- Search query latency.
- Filter combinations.
- Company detail aggregation.
- Project lists at 10,000+ records.
- Concurrent previews and downloads.
- Bulk imports.
- Background extraction.
- Database connection behavior.
- Cache correctness under permissions.

### 18.8 Backup and recovery tests

Cover:

- Database restore.
- R2 object recovery policy.
- Failed publication rollback.
- Import reprocessing.
- Audit-log continuity.

### 18.9 Future AI evaluation

Before AI release, define:

- Answer correctness.
- Citation correctness.
- Permission compliance.
- Retrieval recall.
- Hallucination rate.
- Unsupported-answer behavior.
- Sensitive-data leakage.
- Regression test set.

---

## 19. Migration Strategy

### 19.1 Migration principles

1. Do not rewrite every feature simultaneously.
2. Stabilize the schema and API contracts first.
3. Import and validate data before replacing user-facing pages.
4. Preserve the visual value of the current prototype.
5. Move one domain at a time.
6. Keep legacy pages available as references until replacement acceptance.
7. Do not allow long-term dual masters.

### 19.2 Proposed migration waves

#### Wave 0 — Inventory and contracts

- Catalog current files, generated pages, JSON datasets, Excel files, and scripts.
- Define canonical entity and field mappings.
- Identify duplicate and conflicting IDs.
- Classify data sources and security levels.
- Freeze creation of new company-specific page patterns.

#### Wave 1 — Platform foundation

- Create frontend shell.
- Create API shell.
- Create PostgreSQL schema and migrations.
- Create authentication and role baseline.
- Create R2 private storage.
- Add logging, environment configuration, and CI checks.

#### Wave 2 — Company domain

- Import company Excel/JSON.
- Normalize aliases and classifications.
- Create company list and detail APIs.
- Rebuild company UI as shared components.
- Migrate map, production, financial, and related-report sections.

#### Wave 3 — Project domain

- Import project datasets.
- Normalize company-project roles.
- Build filters, maps, milestones, and detail pages.
- Add change history and subscriptions.

#### Wave 4 — Report domain

- Import 1,111 report records.
- Upload and checksum attachments.
- Build private preview and download.
- Extract and index text.
- Add company and project relationships.
- Replace the static report-library data source.

#### Wave 5 — Unified search and workflow

- Build cross-domain search.
- Add favorites, recent views, subscriptions, notifications, saved searches, notes, and correction requests.
- Add admin review and data-quality dashboards.

#### Wave 6 — Hardening and pilot

- E2E, security, load, and recovery testing.
- Mainland corporate-network testing.
- Pilot with approximately 40 users.
- Measure search success and repeat usage.
- Resolve high-severity defects.

#### Wave 7 — RAG readiness validation

- Validate document extraction quality.
- Validate chunk identity and permissions.
- Build an offline semantic-search experiment.
- Do not expose AI answers until evaluation and governance gates are passed.

### 19.3 Legacy code disposition

For each current asset, classify as:

- Reuse as component logic.
- Reuse as visual reference.
- Convert into data migration input.
- Retain as test fixture.
- Archive after replacement.
- Remove after acceptance.

The final decision should be made module by module after code-level assessment.

---

## 20. Deployment and Environment Strategy

### 20.1 Environments

At minimum:

- `development`
- `staging`
- `production`

Each environment must have:

- Separate database or isolated schema policy.
- Separate R2 bucket or prefix with strict controls.
- Separate credentials.
- Separate API origin.
- Explicit environment labeling.

Production data must not be copied into development without sanitization.

### 20.2 Domain strategy

- Use a company-controlled custom domain or subdomain.
- Do not treat the `pages.dev` hostname as the final production identity.
- Keep API and frontend origins explicit.
- Confirm cookie and CORS strategy early.
- Test DNS and TLS from mainland corporate networks.

### 20.3 CI/CD

CI should run:

- Type checking.
- Linting.
- Unit tests.
- Data-contract tests.
- Migration validation.
- Build.
- Dependency/security checks.
- Static performance budgets.
- E2E smoke tests against staging.

Production deployment should require:

- Successful CI.
- Approved migration.
- Backup checkpoint.
- Smoke-test result.
- Rollback plan.

---

## 21. Analytics and Product Learning

The MVP is also intended to validate product value.

Track:

- Daily and weekly active users.
- Repeat-user rate.
- Search count.
- Search success rate.
- Zero-result queries.
- Time from search to useful click.
- Company, project, and report views.
- Favorites and follows.
- Brief generation.
- Report previews and downloads.
- Correction requests.
- Notification opens.
- Import throughput.
- Data freshness.
- Records without sources.
- Records awaiting review.

Do not use page views alone as the product-success metric.

The most important qualitative pilot questions are:

1. Which information tasks are now faster?
2. Which searches still fail?
3. Which records do users distrust and why?
4. Which alerts are valuable versus noisy?
5. Which manual research tasks remain outside the platform?
6. Which outputs are used in meetings, bids, or decisions?

---

## 22. Architecture Alternatives Considered

### 22.1 Cloudflare-only architecture

Components:

- React.
- Workers.
- D1.
- R2.
- Vectorize.

Advantages:

- Simple vendor footprint.
- Low operational burden.
- Strong fit with current hosting.
- Easy incremental deployment.

Reasons not selected as the primary baseline:

- The product has many relational domains and workflow tables.
- PostgreSQL provides a stronger path for complex queries, migrations, extensions, and future hybrid search.
- A single D1-centered design creates avoidable data-model and migration constraints.

D1 remains suitable for isolated edge caches, small auxiliary datasets, or later specialized uses.

### 22.2 Domestic-cloud architecture

Components:

- React.
- FastAPI or NestJS.
- PostgreSQL.
- Domestic object storage.
- Domestic deployment.

Advantages:

- Stronger mainland delivery and enterprise-control options.
- Better fit if future IT or regulatory rules require domestic hosting.

Reasons not selected for MVP:

- Higher infrastructure and operations burden.
- No dedicated engineering or IT support is currently assigned.
- No current requirement for domestic-only storage.
- The recommended application contracts allow later migration.

### 22.3 Selected hybrid architecture

Selected because it balances:

- Fast implementation by one product owner using Codex.
- Relational data quality.
- Private file storage.
- Future RAG.
- Low server-management burden.
- Cloud portability.
- Current Cloudflare experience.

---

## 23. Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Mainland access instability | Poor adoption | Custom domain, local assets, nearby database region, real-network testing, migration-ready architecture |
| Licensed-content misuse | Legal and commercial exposure | Rights classification, L3 controls, audit logs, contract review before external use |
| Static prototype duplication continues | High maintenance | Freeze new company-specific pages; require shared component pattern |
| Inconsistent IDs and fields | Broken relationships | Canonical UUIDs, aliases, import mappings, staged migration |
| PDF extraction quality is poor | Weak future search/RAG | Extraction status, page-level storage, quality sampling, reprocessing |
| Over-automation publishes bad data | Loss of trust | Staging, validation, material-change review, rollback |
| Too many notifications | Users disable alerts | Importance levels, digest grouping, mute controls |
| Solo implementation becomes too broad | Delayed delivery | Domain-by-domain migration and explicit non-goals |
| Direct database access leaks privilege | Security breach | API authorization, RLS defense in depth, security testing |
| Supabase or Cloudflare dependency | Migration cost | Standard PostgreSQL, REST contracts, S3-compatible storage, migration scripts |
| Search quality is insufficient | Low usage | Query analytics, aliases, relevance tuning, representative test set |
| AI is introduced too early | Hallucination and leakage | Search-first gate, offline evaluation, permission-aware retrieval design |

---

## 24. Open Assumptions to Validate During Detailed Planning

These assumptions do not block this design approval but must be validated before implementation milestones are committed:

1. The selected Supabase region provides acceptable latency from Wison offices.
2. Cloudflare custom-domain delivery is stable on target corporate networks.
3. The company can provision a production domain and approved email sender.
4. Existing report files can be migrated to private object storage.
5. Source contracts permit the intended internal storage and employee access.
6. Project data has sufficiently stable source identifiers or deduplication fields.
7. Existing financial, production, and project metrics can be normalized into common units.
8. Report text extraction can be performed with acceptable accuracy for the dominant PDF types.
9. API and database budget is available.
10. A named reviewer can be assigned for sensitive data publication.
11. An incident owner and data owner will be named before production.
12. Existing spreadsheets and source files can be provided to the migration process.

---

## 25. Decision Log

| Decision | Status |
|---|---|
| First release is internal only | Confirmed |
| Primary users are sales and business development | Confirmed |
| Market research maintains and governs content | Confirmed |
| Company, project, and report repositories are MVP core | Confirmed |
| Project repository is a first-class module | Confirmed |
| Independent news repository is deferred | Confirmed |
| AI question answering is deferred | Confirmed |
| RAG and vector readiness are required | Confirmed |
| CRM integration is deferred but data contracts should not block it | Confirmed |
| Visual admin console is required | Confirmed |
| Sensitive changes require review | Confirmed |
| Four security levels are accepted | Confirmed |
| Overseas cloud services are allowed | Confirmed |
| PostgreSQL replaces Jiandaoyun and GitHub JSON as master data | Confirmed |
| Cloudflare + Supabase hybrid architecture | Confirmed |
| R2 is preferred for private attachments | Confirmed |
| Existing UI may be reused, migrated, or replaced module by module | Confirmed |
| Mainland performance tests are mandatory | Confirmed |
| Commercialization is a future independent phase | Confirmed |

---

## 26. Specification Acceptance Criteria

This design specification is accepted when the product owner confirms that:

1. The product vision and internal-user scope are correct.
2. The MVP goals and non-goals are correct.
3. Company, project, report, search, subscription, and admin scopes are correct.
4. The rights and security model is acceptable.
5. The Cloudflare + Supabase PostgreSQL architecture is acceptable.
6. The migration waves are acceptable.
7. The stated performance and testing baseline is acceptable.
8. The detailed implementation plan may proceed from this specification.

After acceptance, the next artifact must be a separate implementation plan that decomposes this design into ordered Codex tasks with:

- Exact repository paths.
- Schema migration sequence.
- API contract sequence.
- Test-first checkpoints.
- Data migration checkpoints.
- Review gates.
- Verification commands.
- Rollback points.

Implementation should not begin from this document alone until that plan has been reviewed.
