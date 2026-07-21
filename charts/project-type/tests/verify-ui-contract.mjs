import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const featureDir = path.resolve(testDir, "..");
const html = fs.readFileSync(path.join(featureDir, "index.html"), "utf8");
const css = fs.readFileSync(path.join(featureDir, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(featureDir, "app.js"), "utf8");
const core = fs.readFileSync(path.join(featureDir, "chart-core.js"), "utf8");

assert.match(html, /id="project-type-chart"/);
assert.match(html, /id="chart-tooltip"/);
assert.match(html, /id="project-type-legend"/);
assert.match(html, /id="header-total"/);
assert.match(html, /aria-live="polite"/);
assert.match(html, /app\.js\?v=20260721-ui-v2-production/);
assert.match(html, /styles\.css\?v=20260721-ui-v2-production/);
assert.match(html, /viewBox="0 0 240 240"/);
assert.match(html, /<circle class="donut-track" cx="120" cy="120" r="100">/);
assert.ok(!html.includes("texture-orbit"));
assert.ok(!html.includes("header-mark"));
assert.ok(!html.includes("echarts"));
assert.ok(!html.includes("ExxonMobil"), "shared donut HTML must remain company-neutral");

assert.match(app, /URLSearchParams/);
assert.match(app, /params\.get\("operator"\) \|\| "Shell"/);
assert.match(app, /\.\.\/\.\.\/maps\/operators\.json/);
assert.match(app, /\.\.\/\.\.\/maps\//);
assert.match(app, /CENTER = \{ x: 120, y: 120 \}/);
assert.match(app, /setAttribute\("role", "img"\)/);
assert.match(app, /setAttribute\("tabindex", "0"\)/);
assert.match(app, /pointerenter/);
assert.match(app, /项目数量/);
assert.match(app, /项目占比/);
assert.ok(app.includes("item.description"));
assert.ok(!app.includes("${item.count} · ${item.percent}"));
assert.ok(!app.includes('params.get("region")'));

assert.match(css, /prefers-reduced-motion/);
assert.match(css, /#project-type-chart\s*\{[^}]*width:\s*220px/s);
assert.match(css, /\.chart-legend\s*\{[^}]*grid-template-columns:\s*1fr/s);
assert.match(css, /\.legend-row[\s\S]*?min-height:\s*34px/);
assert.match(css, /\.donut-segment\.is-active/);
assert.ok(!/height:\s*100v(?:h|svh|dvh)/.test(css));

assert.match(core, /#16847a/);
assert.match(core, /#d5b46a/);
assert.match(core, /#244e70/);
assert.match(core, /#7896aa/);
assert.match(core, /复合类型：同一项目包含两个及以上油气田类型。/);

console.log("Project type donut UI V2 contract checks passed");
