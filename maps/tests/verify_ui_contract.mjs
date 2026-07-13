import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";


const testDir = path.dirname(fileURLToPath(import.meta.url));
const mapsDir = path.resolve(testDir, "..");
const html = fs.readFileSync(path.join(mapsDir, "index.html"), "utf8");
const css = fs.readFileSync(path.join(mapsDir, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(mapsDir, "app.js"), "utf8");

assert.ok(!html.includes("点位为国家级聚合，不代表项目坐标"), "removed disclaimer must be absent");
assert.ok(html.includes("圆点数字代表项目数量"), "count legend must remain");
assert.ok(!html.includes("title-rule"), "map title decoration must be removed");
assert.ok(!html.includes("data.js"), "legacy data.js must not be loaded");
assert.ok(html.includes('app.js?v=20260713-project-details'), "HTML must load the current app version");
assert.ok(html.includes('styles.css?v=20260713-project-details'), "HTML must load the current CSS version");
assert.ok(!fs.existsSync(path.join(mapsDir, "data.js")), "legacy data.js must be deleted");
assert.ok(html.includes('id="project-filter-toggle"'), "filter toggle must sit beside search");
assert.ok(html.includes('id="facility-filter-options"'), "facility filter container is required");
assert.ok(html.includes('id="resource-filter-options"'), "resource filter container is required");
assert.ok(html.includes('id="project-detail-view"'), "project detail must use a dedicated view");
assert.ok(html.includes('id="project-detail-back"'), "detail view must provide a back action");
assert.ok(html.includes('id="drawer-toggle"'), "mobile drawer must be collapsible");

assert.ok(!css.includes(".map-legend span:last-child"), "mobile CSS must not hide the retained legend");
assert.ok(!css.includes(".title-rule"), "map title decoration CSS must be removed");
assert.ok(css.includes(":focus-visible"), "keyboard focus styling is required");
assert.match(css, /width:\s*clamp\(560px,\s*58vw,\s*1120px\)/);
assert.match(css, /height:\s*min\(65vh,\s*650px\)/);
assert.match(css, /\.project-drawer\.collapsed/);
assert.match(css, /\.resource-grid[\s\S]*repeat\(2,/);
assert.match(css, /\.map-instruction[\s\S]*bottom:/);

assert.ok(app.includes("./app-core.js?v=20260713-project-details"), "app-core cache version must match");
assert.ok(app.includes("operators.json?v=20260713-project-details"), "operator manifest cache version must match");
assert.ok(app.includes("data/country-centers.json?v=20260713-project-details"), "country centers cache version must match");
assert.match(app, /minZoom:\s*1,/, "narrow screens must be able to fit global markers");
assert.ok(app.includes("Escape"), "Escape must close the drawer");
assert.ok(app.includes("getBoundingClientRect()"), "drawer avoidance must use actual pixels");
assert.ok(app.includes("latLngToContainerPoint"), "drawer avoidance must target the visible map area");
assert.ok(app.includes("window.setTimeout(hideInstruction, 4000)"), "initial hint must auto-hide");
assert.ok(!app.includes("marker.getElement()?.addEventListener"), "marker click must have one event chain");
assert.ok(app.includes("设施类型"), "facility type must be prominent in project details");
assert.ok(app.includes("储量"), "resource card must be present");
assert.ok(app.includes("P90") && app.includes("P50") && app.includes("P Mean") && app.includes("Prospective"));
assert.ok(!app.includes("批准年份"), "approval year must be removed from the project detail");
assert.ok(!app.includes("approvalYears"), "approval-year data must not be consumed by the UI");
assert.ok(app.includes("getResourceFilterCounts"), "resource filter counts must drive disabled options");
assert.ok(app.includes("resources.rawCounts"), "resource cards must show source-record counts, not unique-value counts");

console.log("UI contract checks passed");
