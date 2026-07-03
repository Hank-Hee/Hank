import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const featureDir = path.resolve(testDir, "..");
const html = fs.readFileSync(path.join(featureDir, "index.html"), "utf8");
const css = fs.readFileSync(path.join(featureDir, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(featureDir, "app.js"), "utf8");

assert.match(html, /id="project-type-chart"/);
assert.match(html, /id="chart-tooltip"/);
assert.match(html, /id="project-type-legend"/);
assert.match(html, /aria-live="polite"/);
assert.match(html, /app\.js\?v=20260703-project-type/);
assert.ok(!html.includes("echarts"), "the embed must not depend on a charting CDN");

assert.match(app, /URLSearchParams/);
assert.match(app, /\.\.\/\.\.\/maps\/operators\.json/);
assert.match(app, /\.\.\/\.\.\/maps\//);
assert.match(app, /setAttribute\("role", "img"\)/);
assert.match(app, /setAttribute\("tabindex", "0"\)/);
assert.match(app, /pointerenter/);
assert.match(app, /focus/);
assert.ok(!app.includes('params.get("region")'), "company-only charts must not expose region filters");

assert.match(css, /prefers-reduced-motion/);
assert.match(css, /@media \(max-width: 520px\)/);
assert.match(css, /\.donut-segment\.is-active/);
assert.match(css, /\.legend-row\.is-active/);
assert.match(css, /min-height:\s*350px/);
const segmentRule = css.match(/\.donut-segment\s*\{([\s\S]*?)\}/)?.[1] || "";
assert.ok(
  !/transform-(?:box|origin)/.test(segmentRule),
  "SVG segment rotation must use its SVG transform without a conflicting CSS transform box",
);

console.log("Project type chart UI contract checks passed");
