# Project Type Donut Chart Design

## Goal

Build a compact, polished project-type structure chart for JianDaoYun embedding, starting with Shell and reusing the existing per-company project JSON already published in this repository. Package the finished workflow as a reusable Codex skill and a shareable ZIP archive.

## Scope

- Initial company: Shell.
- Future-ready companies: BP, Eni, and ADNOC through the same `operator` URL parameter.
- Company-level aggregation only. Region filtering is intentionally excluded.
- The map pages and their data contract remain unchanged.

## Data Definition

The chart uses `fieldTypes`, generated from the workbook field `Field Type Category`.

Each project contributes to exactly one donut segment:

1. A project with exactly one field type uses that type.
2. A project with two or more field types is classified as `Mixed field`.
3. A missing or empty type is classified as `Other` so the total remains auditable.

For Shell's current 552-project payload, the accepted result is:

| Category | Chinese label | Count |
| --- | --- | ---: |
| Gas-Condensate field | 凝析气田 | 302 |
| Oil field | 油田 | 206 |
| Gas field | 气田 | 25 |
| Mixed field | 复合类型 | 19 |

Percentages are calculated from the company total. Display percentages use one decimal place; raw counts remain visible in the legend and tooltip.

## Page Architecture

Create an isolated feature directory:

```text
charts/project-type/
  index.html
  styles.css
  chart-core.js
  app.js
  tests/
    chart-core.test.mjs
    verify-ui-contract.mjs
```

The page URL is:

```text
https://hank-hee.github.io/Hank/charts/project-type/?operator=Shell
```

`app.js` resolves the requested company from `maps/operators.json`, fetches only that company's JSON file, passes `projects` to pure aggregation functions in `chart-core.js`, then renders one SVG donut. Unknown companies and load failures produce a compact in-card error message.

## Visual Design

- Compact dashboard card sized for a roughly 670×350 JianDaoYun region while remaining responsive down to 360px width.
- White-to-cool-gray background with a subtle CSS-only dot/line texture.
- Deep navy typography, teal primary segment, warm gold secondary segment, cool blue tertiary segment, and light gray mixed segment.
- Header: company-aware title such as `Shell 项目类型结构` plus a small `PROJECT MIX · 2026` eyebrow.
- Donut center: company total and `个项目`.
- Legend: Chinese primary label, English secondary label, count, and one-decimal percentage.
- No navigation, instructional copy, or unrelated controls.

## Interaction and Accessibility

- Hovering or keyboard-focusing a segment slightly expands it and opens a tooltip with Chinese label, English label, count, and exact percentage.
- The matching legend row highlights at the same time.
- Hovering or focusing a legend row produces the same segment highlight and tooltip state.
- SVG segments expose accessible labels and keyboard focus.
- Reduced-motion preferences disable transitions.
- The layout supports compact desktop embeds and mobile stacking without clipping.

## Reusable Skill

Create the personal skill `github-project-type-donut` under the user's Codex skill directory. It will contain:

- `SKILL.md` with trigger conditions and the repeatable inspect → classify → build → verify → publish workflow.
- `agents/openai.yaml` for skill UI metadata.
- `scripts/summarize_project_types.mjs` for deterministic aggregation and data checks.
- `assets/template/` containing the reusable chart page template.
- `references/data-contract.md` documenting accepted company manifest and project payload fields.

Validate the skill, run its aggregation script against Shell, and package the skill directory as:

```text
C:\Users\heshiyu\Desktop\github-project-type-donut-skill.zip
```

The ZIP must contain the skill folder as its top-level directory so another user can extract it into their Codex skills location.

## Verification

- Unit tests prove mutually exclusive categorization, percentage math, ordering, and Shell's accepted counts.
- A UI contract test verifies the lightweight standalone page, company parameter, SVG interaction hooks, and absence of region controls.
- Browser verification covers the Shell live page, hover feedback, keyboard focus, compact desktop layout, and mobile layout.
- GitHub Pages verification confirms HTTP 200 and the four expected Shell categories totaling 552.
- Skill validation confirms frontmatter, UI metadata, reusable files, script output, and ZIP contents.

## Publishing

Commit the chart, tests, design documents, and implementation plan to `Hank-Hee/Hank` on `main`, then verify the GitHub Pages URL. Do not commit the distributable ZIP to the repository; deliver it as a standalone local file.
