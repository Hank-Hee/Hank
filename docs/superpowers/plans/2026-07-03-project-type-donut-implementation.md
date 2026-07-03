# Project Type Donut Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a responsive, interactive Shell project-type donut chart and deliver a tested, reusable Codex skill plus shareable ZIP.

**Architecture:** A standalone GitHub Pages feature loads the existing company manifest and one company JSON payload, classifies projects through a pure JavaScript core, and renders an accessible SVG donut without a charting dependency. The personal skill bundles a deterministic summarizer, a reusable page template, and a concise data contract.

**Tech Stack:** HTML5, CSS, ES modules, SVG, Node.js built-in test runner, GitHub Pages, Codex skill tooling.

---

## File Structure

- Create `charts/project-type/chart-core.js`: pure company resolution, categorization, percentage, and SVG geometry helpers.
- Create `charts/project-type/app.js`: data loading, DOM rendering, hover/focus state, and error handling.
- Create `charts/project-type/index.html`: compact standalone embed shell.
- Create `charts/project-type/styles.css`: responsive dashboard styling and interaction states.
- Create `charts/project-type/tests/chart-core.test.mjs`: aggregation and geometry tests.
- Create `charts/project-type/tests/verify-ui-contract.mjs`: static embed and accessibility contract.
- Create `C:/Users/heshiyu/.codex/skills/github-project-type-donut/`: reusable personal skill.
- Create `C:/Users/heshiyu/Desktop/github-project-type-donut-skill.zip`: shareable skill package.

### Task 1: Project-Type Aggregation Core

**Files:**
- Create: `charts/project-type/tests/chart-core.test.mjs`
- Create: `charts/project-type/chart-core.js`

- [ ] **Step 1: Write the failing aggregation tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildProjectTypeMix, formatPercent } from "../chart-core.js";

test("classifies multi-valued projects as Mixed field exactly once", () => {
  const projects = [
    { fieldTypes: ["Oil field"] },
    { fieldTypes: ["Gas field", "Oil field"] },
    { fieldTypes: [] },
  ];
  assert.deepEqual(buildProjectTypeMix(projects).map(({ key, count }) => [key, count]), [
    ["Oil field", 1],
    ["Mixed field", 1],
    ["Other", 1],
  ]);
});

test("formats a one-decimal percentage", () => {
  assert.equal(formatPercent(19, 552), "3.4%");
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
node --test charts/project-type/tests/chart-core.test.mjs
```

Expected: FAIL because `chart-core.js` does not exist.

- [ ] **Step 3: Implement minimal pure helpers**

```js
const TYPE_META = {
  "Gas-Condensate field": { label: "凝析气田", color: "#208b8d" },
  "Oil field": { label: "油田", color: "#e5a832" },
  "Gas field": { label: "气田", color: "#3278bd" },
  "Mixed field": { label: "复合类型", color: "#aab8c8" },
  Other: { label: "其他", color: "#d7e0e8" },
};

export function buildProjectTypeMix(projects) {
  const counts = new Map();
  for (const project of projects) {
    const values = [...new Set(project.fieldTypes || [])].filter(Boolean);
    const key = values.length === 0 ? "Other" : values.length > 1 ? "Mixed field" : values[0];
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count, ...(TYPE_META[key] || TYPE_META.Other) }))
    .sort((a, b) => b.count - a.count);
}

export const formatPercent = (count, total) => `${((count / total) * 100).toFixed(1)}%`;
```

- [ ] **Step 4: Add the Shell regression assertion and verify GREEN**

Load `maps/data/shell.json` in the test and assert:

```js
assert.deepEqual(mix.map(({ key, count }) => [key, count]), [
  ["Gas-Condensate field", 302],
  ["Oil field", 206],
  ["Gas field", 25],
  ["Mixed field", 19],
]);
assert.equal(mix.reduce((sum, item) => sum + item.count, 0), 552);
```

Run the Node test suite and expect all tests to pass.

- [ ] **Step 5: Commit the aggregation core**

```powershell
git add charts/project-type/chart-core.js charts/project-type/tests/chart-core.test.mjs
git commit -m "feat: add project type aggregation core"
```

### Task 2: Standalone SVG Chart Contract

**Files:**
- Create: `charts/project-type/tests/verify-ui-contract.mjs`
- Create: `charts/project-type/index.html`
- Create: `charts/project-type/styles.css`
- Create: `charts/project-type/app.js`

- [ ] **Step 1: Write the failing UI contract test**

The test must assert:

```js
assert.match(html, /id="project-type-chart"/);
assert.match(html, /id="chart-tooltip"/);
assert.match(app, /URLSearchParams/);
assert.match(app, /maps\/operators\.json/);
assert.match(app, /role", "img"/);
assert.match(app, /tabindex", "0"/);
assert.ok(!html.includes("region"));
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /@media \(max-width: 520px\)/);
```

- [ ] **Step 2: Run the contract test and verify RED**

Run:

```powershell
node charts/project-type/tests/verify-ui-contract.mjs
```

Expected: FAIL because the page files do not exist.

- [ ] **Step 3: Build the compact HTML shell and responsive visual system**

Create a single dashboard card with:

- `PROJECT MIX · 2026` eyebrow.
- Company-aware heading.
- SVG donut container.
- Center total.
- Legend container.
- One reusable tooltip.
- One compact error/loading state.

Use CSS custom properties for the four accepted colors, a subtle radial-dot texture, a 16px radius, restrained shadow, and responsive stacking below 520px.

- [ ] **Step 4: Implement data loading and SVG geometry**

In `app.js`:

1. Read `operator` with `URLSearchParams`, defaulting to Shell.
2. Fetch `../../maps/operators.json` with a version query.
3. Resolve the manifest entry case-insensitively.
4. Fetch `../../maps/<dataFile>`.
5. Aggregate with `buildProjectTypeMix`.
6. Render SVG circle segments using dash arrays and rotations.
7. Render synchronized legend rows.

- [ ] **Step 5: Implement hover and keyboard feedback**

For each segment and legend row:

- Set a shared `data-type-key`.
- On pointer enter or focus, apply `.is-active` to both elements.
- Position the tooltip inside the card and show label, English type, count, and percentage.
- On pointer leave or blur, clear active state and hide the tooltip.
- Give every segment `tabindex="0"`, `role="img"`, and an accessible label.

- [ ] **Step 6: Run tests and commit**

Run:

```powershell
node --test charts/project-type/tests/chart-core.test.mjs
node charts/project-type/tests/verify-ui-contract.mjs
node --check charts/project-type/app.js
```

Expected: all pass.

Commit:

```powershell
git add charts/project-type
git commit -m "feat: add interactive project type donut chart"
```

### Task 3: Browser and Responsive Verification

**Files:**
- Modify as needed: `charts/project-type/index.html`
- Modify as needed: `charts/project-type/styles.css`
- Modify as needed: `charts/project-type/app.js`

- [ ] **Step 1: Start the local static server**

Run Python's HTTP server on `127.0.0.1:8765` from the repository root.

- [ ] **Step 2: Verify the 670×350 embed**

Open:

```text
http://127.0.0.1:8765/charts/project-type/?operator=Shell
```

Verify title, total 552, four segments, no clipping, and no console errors.

- [ ] **Step 3: Verify interaction**

Hover and keyboard-focus at least one segment. Confirm the tooltip and matching legend highlight appear and clear predictably.

- [ ] **Step 4: Verify mobile layout**

At 390×640, confirm the donut, title, center value, and all four legend rows remain visible and aligned.

- [ ] **Step 5: Re-run automated tests after any visual repairs**

Expected: aggregation, contract, and syntax checks remain green.

### Task 4: Reusable Skill and ZIP

**Files:**
- Create: `C:/Users/heshiyu/.codex/skills/github-project-type-donut/SKILL.md`
- Create: `C:/Users/heshiyu/.codex/skills/github-project-type-donut/agents/openai.yaml`
- Create: `C:/Users/heshiyu/.codex/skills/github-project-type-donut/scripts/summarize_project_types.mjs`
- Create: `C:/Users/heshiyu/.codex/skills/github-project-type-donut/references/data-contract.md`
- Create: `C:/Users/heshiyu/.codex/skills/github-project-type-donut/assets/template/`
- Create: `C:/Users/heshiyu/Desktop/github-project-type-donut-skill.zip`

- [ ] **Step 1: Establish failing baseline checks**

Before creating the skill, run checks for the expected skill directory, `SKILL.md`, summarizer, template, and ZIP. Record that they fail because the artifacts do not yet exist.

- [ ] **Step 2: Initialize the skill using the official helper**

Run `init_skill.py` with resources `scripts,references,assets` and UI metadata:

```text
display_name=GitHub Project Type Donut
short_description=Build and publish company project-type donut charts
default_prompt=Use $github-project-type-donut to create or update a company project-type structure chart for GitHub Pages and JianDaoYun.
```

- [ ] **Step 3: Add reusable resources**

- Copy the verified chart page into `assets/template/`.
- Add a summarizer that accepts a company JSON path, applies the exact single/mixed/other rules, prints JSON, and exits non-zero for malformed input.
- Add a concise data contract for `operators.json`, company JSON, `fieldTypes`, and the URL pattern.
- Write a concise `SKILL.md` covering inspect, classify, test, render, publish, and live verification.

- [ ] **Step 4: Validate and exercise the skill**

Run:

```powershell
quick_validate.py C:/Users/heshiyu/.codex/skills/github-project-type-donut
node C:/Users/heshiyu/.codex/skills/github-project-type-donut/scripts/summarize_project_types.mjs maps/data/shell.json
```

Expected summarizer counts: 302, 206, 25, and 19; expected total: 552.

- [ ] **Step 5: Package and inspect the ZIP**

Create the ZIP with `github-project-type-donut/` as the top-level directory. List archive entries and verify `SKILL.md`, `agents/openai.yaml`, the script, reference, and template files are present.

### Task 5: Final Verification and GitHub Publish

**Files:**
- Verify all chart, documentation, and existing map files.

- [ ] **Step 1: Run the complete local verification suite**

```powershell
node --test charts/project-type/tests/chart-core.test.mjs
node charts/project-type/tests/verify-ui-contract.mjs
node --test maps/tests/app-core.test.mjs
node maps/tests/verify_ui_contract.mjs
python -m unittest discover -s maps/tests -p "test_*.py"
git diff --check
```

- [ ] **Step 2: Confirm a clean, intentional diff**

Verify only the approved chart, plan, spec, and related tests are included in the repository commit. The personal skill and ZIP remain outside the repository.

- [ ] **Step 3: Commit and push `main`**

Push the tested `main` branch to `Hank-Hee/Hank`.

- [ ] **Step 4: Verify GitHub Pages**

Verify HTTP 200 and rendered state at:

```text
https://hank-hee.github.io/Hank/charts/project-type/?operator=Shell
```

Confirm the title, total 552, category counts, tooltip interaction, compact layout, and absence of console errors.
