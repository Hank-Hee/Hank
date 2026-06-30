# Multi-Operator Project Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy 51-project Shell payload with lazily loaded global Shell, BP, Eni, and grouped ADNOC data while completing the approved embedded-map UI polish.

**Architecture:** A Python standard-library streaming builder reads the large XLSX, applies an explicit company configuration, aggregates rows by canonical company/country/project, and writes one JSON file per company plus a runtime manifest. The browser loads only the requested company, optionally filters by `Business Region`, and uses a small tested core module for URL/data transformations while Leaflet remains responsible for map rendering.

**Tech Stack:** Python 3 standard library, native JavaScript ES modules, Leaflet 1.9.4, JSON, Node.js built-in test runner, GitHub Pages.

---

## File map

- Create `maps/tools/company-config.json`: canonical companies, aliases, exact Excel Operator values, and expected counts.
- Create `maps/tools/build_map_data.py`: XLSX streaming reader, aggregation, validation, Natural Earth center extraction, atomic JSON writer, and CLI.
- Create `maps/tests/test_build_map_data.py`: unit and real-workbook data-pipeline tests.
- Create `maps/tests/app-core.test.mjs`: URL, manifest, region-filter, grouping, and search-summary tests.
- Create `maps/tests/verify_ui_contract.mjs`: static HTML/CSS/JS contract checks.
- Create `maps/app-core.js`: pure runtime functions reusable by tests and `app.js`.
- Create `maps/operators.json`: generated runtime manifest.
- Create `maps/data/shell.json`, `bp.json`, `eni.json`, `adnoc.json`: generated company payloads.
- Create `maps/data/country-centers.json`: audited Natural Earth country-level representative points.
- Modify `maps/index.html`: remove legacy payload script, simplify legend, add region-aware status hooks, load ES module with a new cache version.
- Modify `maps/styles.css`: legend, hint, responsive drawer, focus, and accessibility styles.
- Replace `maps/app.js`: asynchronous loading, global/region overview, responsive drawer avoidance, accessible interactions, and error states.
- Delete `maps/data.js`: remove obsolete Shell-only global payload.

### Task 1: Data aggregation core

**Files:**
- Create: `maps/tools/company-config.json`
- Create: `maps/tools/build_map_data.py`
- Create: `maps/tests/test_build_map_data.py`

- [ ] **Step 1: Write failing unit tests for exact company matching, stable IDs, and aggregation**

```python
import unittest
from maps.tools.build_map_data import aggregate_rows, company_for_operator, stable_project_id


class BuildMapDataTests(unittest.TestCase):
    def test_company_matching_is_exact(self):
        config = {
            "Shell": {"sourceOperators": ["Shell"]},
            "BP": {"sourceOperators": ["BP"]},
        }
        self.assertEqual(company_for_operator("Shell", config), "Shell")
        self.assertIsNone(company_for_operator("Petronas/Shell", config))
        self.assertIsNone(company_for_operator("Aker BP", config))

    def test_project_id_is_stable(self):
        self.assertEqual(
            stable_project_id("Shell", "Malaysia", "Alpha, MY"),
            stable_project_id("Shell", "Malaysia", "Alpha, MY"),
        )

    def test_aggregate_rows_unions_detail_fields(self):
        rows = [
            {"Operator": "ADNOC Offshore", "Country": "UAE", "Project": "Upper Zakum",
             "Business Region": "中东及南亚", "Facility Category": "Fixed"},
            {"Operator": "ADNOC Offshore", "Country": "UAE", "Project": "Upper Zakum",
             "Business Region": "中东及南亚", "Facility Category": "Subsea"},
        ]
        payload = aggregate_rows(rows, "ADNOC", {"ADNOC Offshore"})
        self.assertEqual(len(payload), 1)
        self.assertEqual(payload[0]["facilities"], ["Fixed", "Subsea"])
        self.assertEqual(payload[0]["sourceOperators"], ["ADNOC Offshore"])
```

- [ ] **Step 2: Run tests and verify the module is missing**

Run:

```powershell
python -m unittest maps.tests.test_build_map_data -v
```

Expected: FAIL because `maps/tools/build_map_data.py` does not exist.

- [ ] **Step 3: Implement the pure matching, stable-ID, and aggregation functions**

Implement these interfaces in `build_map_data.py`:

```python
def company_for_operator(operator: str, config: dict) -> str | None: ...
def stable_project_id(company: str, country: str, project: str) -> str: ...
def aggregate_rows(rows: list[dict], canonical_company: str, source_operators: set[str]) -> list[dict]: ...
```

Use SHA-256 truncated to 12 hexadecimal characters for IDs. Aggregate with key `(canonical_company, country, project)`, sort output by `(country.casefold(), project.casefold())`, and union every list field after trimming empty strings.

- [ ] **Step 4: Add exact company configuration**

`company-config.json` must contain Shell 552, BP 396, Eni 437, and grouped ADNOC 49 with the seven approved exact source Operator values. Include URL aliases only for canonical names.

- [ ] **Step 5: Run unit tests and commit**

Expected: all Task 1 tests PASS.

```powershell
git add maps/tools/company-config.json maps/tools/build_map_data.py maps/tests/test_build_map_data.py
git commit -m "feat: add multi-operator data aggregation core"
```

### Task 2: Streaming workbook build and generated payloads

**Files:**
- Modify: `maps/tools/build_map_data.py`
- Modify: `maps/tests/test_build_map_data.py`
- Create: `maps/operators.json`
- Create: `maps/data/country-centers.json`
- Create: `maps/data/shell.json`
- Create: `maps/data/bp.json`
- Create: `maps/data/eni.json`
- Create: `maps/data/adnoc.json`

- [ ] **Step 1: Write a failing real-workbook integration test**

```python
def test_real_workbook_counts_and_required_fields(self):
    workbook = os.environ["RYSTAD_XLSX"]
    result = build_payloads(workbook, CONFIG_PATH, NATURAL_EARTH_URL)
    self.assertEqual(len(result["companies"]["Shell"]), 552)
    self.assertEqual(len(result["companies"]["BP"]), 396)
    self.assertEqual(len(result["companies"]["Eni"]), 437)
    self.assertEqual(len(result["companies"]["ADNOC"]), 49)
    self.assertEqual(
        sum("东南亚" in p["businessRegions"] for p in result["companies"]["Shell"]),
        58,
    )
    self.assertTrue(all(p["country"] in result["countryCenters"] for p in result["allProjects"]))
```

- [ ] **Step 2: Run the integration test and verify `build_payloads` is missing**

Run with the supplied workbook path in `RYSTAD_XLSX`. Expected: FAIL because streaming and country-center logic are not implemented.

- [ ] **Step 3: Implement streaming XLSX parsing**

Use `zipfile.ZipFile` and `xml.etree.ElementTree.iterparse` to read `sharedStrings.xml` and `sheet1.xml`. Validate the exact 21 approved headers before processing rows. Expose:

```python
def stream_xlsx_rows(path: str) -> Iterator[dict[str, object]]: ...
def build_payloads(input_path: str, config_path: str, natural_earth_url: str) -> dict: ...
```

Do not hardcode the Desktop path.

- [ ] **Step 4: Build audited country centers**

Download the official Natural Earth `ne_10m_admin_0_countries.geojson` once during generation. The 10m layer is required because the 110m simplified layer omits Bahrain and Sao Tome and Principe. Use each feature's `LABEL_Y` and `LABEL_X`, record the source URL, and resolve workbook names through explicit aliases such as `UAE -> United Arab Emirates`, `Turkiye -> Turkey`, and `Congo -> Republic of the Congo`. Fail with a sorted missing-country list if any target project has no center.

- [ ] **Step 5: Implement atomic output writing and run the builder**

CLI:

```powershell
python maps/tools/build_map_data.py --input "$env:RYSTAD_XLSX" --output maps/data --manifest maps/operators.json
```

Write JSON to temporary sibling files, validate counts and schemas, then replace final files. Do not emit Asset or resource-volume fields.

- [ ] **Step 6: Run tests and inspect generated files**

Expected: Shell 552, BP 396, Eni 437, ADNOC 49, Shell 东南亚 58, zero missing centers, zero duplicate `country + project` keys.

- [ ] **Step 7: Commit generated data and builder**

```powershell
git add maps/tools maps/tests/test_build_map_data.py maps/operators.json maps/data
git commit -m "feat: generate per-company global project data"
```

### Task 3: Runtime data-loader core

**Files:**
- Create: `maps/app-core.js`
- Create: `maps/tests/app-core.test.mjs`

- [ ] **Step 1: Write failing Node tests**

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { resolveOperator, filterProjectsByRegion, groupProjectsByCountry } from "../app-core.js";

test("resolves operator aliases case-insensitively", () => {
  const manifest = { operators: [{ name: "Shell", aliases: ["shell"], dataFile: "data/shell.json" }] };
  assert.equal(resolveOperator(manifest, "SHELL").name, "Shell");
});

test("filters by unified business region", () => {
  const projects = [
    { id: "1", country: "Malaysia", businessRegions: ["东南亚"] },
    { id: "2", country: "Brazil", businessRegions: ["巴西"] },
  ];
  assert.deepEqual(filterProjectsByRegion(projects, "东南亚").map((p) => p.id), ["1"]);
});

test("groups filtered projects by country", () => {
  const groups = groupProjectsByCountry([{ id: "1", country: "Malaysia" }, { id: "2", country: "Malaysia" }]);
  assert.equal(groups[0].projects.length, 2);
});
```

- [ ] **Step 2: Run tests and verify exports are missing**

Run: `node --test maps/tests/app-core.test.mjs`

Expected: FAIL because `app-core.js` does not exist.

- [ ] **Step 3: Implement pure runtime functions**

Export `normalizeKey`, `resolveOperator`, `filterProjectsByRegion`, `groupProjectsByCountry`, `searchProjects`, and `formatSearchSummary`. Keep DOM and Leaflet access out of this file.

- [ ] **Step 4: Run tests and commit**

```powershell
git add maps/app-core.js maps/tests/app-core.test.mjs
git commit -m "feat: add tested map data loader core"
```

### Task 4: Async map application and embedded UI polish

**Files:**
- Modify: `maps/index.html`
- Modify: `maps/styles.css`
- Replace: `maps/app.js`
- Create: `maps/tests/verify_ui_contract.mjs`
- Delete: `maps/data.js`

- [ ] **Step 1: Write failing static UI contract checks**

Check that:

- the removed disclaimer is absent;
- the retained legend text is present;
- `data.js` is not referenced;
- `app.js` loads as a module with `app-core.js`;
- mobile CSS does not hide `.map-legend span:last-child`;
- focus-visible, 420px medium drawer, bottom hint, `aria-expanded`, Escape handling, region metadata, and cache-version strings exist.

- [ ] **Step 2: Run contract test and verify current UI fails**

Run: `node maps/tests/verify_ui_contract.mjs`

Expected: FAIL on legacy data script, disclaimer, and missing accessibility/async-loader contracts.

- [ ] **Step 3: Update HTML and CSS**

Remove the legacy payload script and disclaimer separator. Load `app.js` with `type="module"`. Add a non-blocking loading state. Preserve existing visual language and font sizes while adding the approved responsive, focus, hint, and drawer rules.

- [ ] **Step 4: Replace `app.js` with the async application**

The module must:

1. fetch manifest and country centers;
2. resolve canonical company;
3. fetch only its JSON;
4. filter optional region;
5. render title/count/scope;
6. fit global or region bounds;
7. offset for the actual drawer rectangle;
8. update search counts and ARIA states;
9. restore focus on Escape;
10. show explicit load, company, and region errors.

- [ ] **Step 5: Delete legacy data and run all static tests**

```powershell
node --test maps/tests/app-core.test.mjs
node maps/tests/verify_ui_contract.mjs
python -m unittest maps.tests.test_build_map_data -v
```

Expected: PASS.

- [ ] **Step 6: Commit UI implementation**

```powershell
git add maps
git commit -m "feat: ship global multi-operator map experience"
```

### Task 5: Local browser verification

**Files:**
- Modify only if verification reveals a failing contract: `maps/index.html`, `maps/styles.css`, `maps/app.js`, corresponding tests.

- [ ] **Step 1: Start a local HTTP server**

```powershell
python -m http.server 8765
```

- [ ] **Step 2: Verify data and URL scenarios**

Open Shell, BP, Eni, ADNOC, Shell 东南亚, unknown company, and unknown region URLs. Verify visible title/count/scope and absence of console errors.

- [ ] **Step 3: Verify responsive sizes**

Check 1920×430, 960×520, 760×520, and 390×640. At each size verify controls do not overlap and the drawer/search/details remain usable.

- [ ] **Step 4: Verify interactions**

Click a country, confirm the active marker stays outside the drawer, search projects, expand a row, press Escape, and return to overview. Repeat a single-country ADNOC case.

- [ ] **Step 5: Save preview screenshots and fix only reproduced failures with a failing test first**

Store previews outside the published `maps/` directory. Re-run the full static and data test suite after any fix.

### Task 6: Final verification and GitHub publication

**Files:**
- Modify: cache-version strings only if necessary after final content stabilizes.

- [ ] **Step 1: Run complete verification from a clean status**

Run data tests, Node tests, UI contract, `git diff --check`, and browser smoke tests. Confirm exact project counts and no `maps/data.js` reference.

- [ ] **Step 2: Commit final cache version and verification fixes**

```powershell
git add maps
git commit -m "chore: finalize multi-operator map release"
```

- [ ] **Step 3: Fast-forward local `main` and push**

```powershell
git switch main
git merge --ff-only codex/shell-map-embed-polish
git push origin main
```

- [ ] **Step 4: Verify GitHub Pages**

Open all four production URLs with the new version parameter, confirm titles/counts and interaction, then report the final links.
