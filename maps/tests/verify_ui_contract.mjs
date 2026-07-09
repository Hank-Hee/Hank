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
assert.ok(!html.includes("data.js"), "legacy data.js must not be loaded");
assert.match(html, /<script type="module" src="app\.js\?v=20260709-batch"><\/script>/);
assert.ok(!fs.existsSync(path.join(mapsDir, "data.js")), "legacy data.js must be deleted");

assert.ok(!css.includes(".map-legend span:last-child"), "mobile CSS must not hide the retained legend");
assert.ok(css.includes(":focus-visible"), "keyboard focus styling is required");
assert.match(css, /@media \(min-width: 760px\) and \(max-width: 1099px\)/);
assert.match(css, /width:\s*min\(420px,/);
assert.match(css, /\.map-instruction[\s\S]*bottom:/);

assert.match(app, /from "\.\/app-core\.js\?v=20260709-batch"/);
assert.match(app, /fetch\("operators\.json\?v=20260709-batch"\)/);
assert.match(app, /fetch\("data\/country-centers\.json\?v=20260709-batch"\)/);
assert.match(app, /minZoom:\s*1,/, "narrow screens must be able to fit global markers");
assert.ok(app.includes('event.key === "Escape"'), "Escape must close the drawer");
assert.ok(app.includes('setAttribute("aria-expanded"'), "project rows must expose expanded state");
assert.ok(app.includes("getBoundingClientRect()"), "drawer avoidance must use actual pixels");
assert.ok(app.includes("window.setTimeout(hideInstruction, 4000)"), "initial hint must auto-hide");
assert.ok(!app.includes('marker.getElement()?.addEventListener("click"'), "marker click must have one event chain");

console.log("UI contract checks passed");
