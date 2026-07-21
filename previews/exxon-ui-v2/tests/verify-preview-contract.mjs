import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDir, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

const shellHtml = read("index.html");
const shellCss = read("styles.css");
const mapHtml = read("map", "index.html");
const mapCss = read("map", "styles.css");
const mapApp = read("map", "app.js");
const donutHtml = read("project-type", "index.html");
const donutCss = read("project-type", "styles.css");
const donutApp = read("project-type", "app.js");
const donutCore = read("project-type", "chart-core.js");

assert.match(shellHtml, /map\/\?operator=ExxonMobil/);
assert.match(shellHtml, /project-type\/\?operator=ExxonMobil/);
assert.match(shellCss, /grid-template-columns:\s*minmax\(0,\s*2fr\)\s+minmax\(320px,\s*1fr\)/);
assert.match(shellCss, /height:\s*520px/);

assert.match(mapHtml, /class="chart-header"/);
assert.match(mapHtml, /id="refresh-button"/);
assert.match(mapHtml, /id="new-window-button"/);
assert.match(mapHtml, /id="fullscreen-button"/);
assert.match(mapHtml, /id="country-count"/);
assert.ok(!mapHtml.includes("map-instruction"));
assert.ok(!mapHtml.includes("map-status"));
assert.match(mapCss, /width:\s*clamp\(420px,\s*48%,\s*560px\)/);
assert.match(mapCss, /max-width:\s*calc\(100%\s*-\s*280px\)/);
assert.match(mapCss, /\.country-dot\.tier-1/);
assert.match(mapCss, /\.country-dot\.is-active[\s\S]*?accent-gold/);
assert.match(mapCss, /\.project-summary-grid/);
assert.match(mapCss, /\.reserve-grid/);
assert.match(mapCss, /\.fact-grid/);
assert.ok(!/height:\s*100v(?:h|svh|dvh)/.test(mapCss));
assert.match(mapApp, /DATA_ROOT = `\.\.\/\.\.\/\.\.\/maps`/);
assert.match(mapApp, /project-summary-grid/);
assert.match(mapApp, /reserve-section/);
assert.match(mapApp, /fact-grid/);
assert.match(mapApp, /listScrollTop/);

assert.match(donutHtml, /viewBox="0 0 240 240"/);
assert.match(donutHtml, /id="header-total"/);
assert.ok(!donutHtml.includes("texture-orbit"));
assert.match(donutCss, /#project-type-chart\s*\{[^}]*width:\s*220px/s);
assert.match(donutCss, /\.chart-legend\s*\{[^}]*grid-template-columns:\s*1fr/s);
assert.match(donutCss, /\.legend-row[\s\S]*?min-height:\s*34px/);
assert.ok(!/height:\s*100v(?:h|svh|dvh)/.test(donutCss));
assert.match(donutApp, /\.\.\/\.\.\/\.\.\/maps\/operators\.json/);
assert.match(donutApp, /CENTER = \{ x: 120, y: 120 \}/);
assert.match(donutCore, /#16847a/);
assert.match(donutCore, /#d5b46a/);
assert.match(donutCore, /#244e70/);
assert.match(donutCore, /#7896aa/);
assert.match(donutCore, /复合类型：同一项目包含两个及以上油气田类型。/);

console.log("ExxonMobil UI V2 preview contract checks passed");
