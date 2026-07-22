import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const dashboardDir = path.resolve(testDir, "..");
const html = fs.readFileSync(path.join(dashboardDir, "index.html"), "utf8");
const css = fs.readFileSync(path.join(dashboardDir, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(dashboardDir, "app.js"), "utf8");

assert.match(html, /styles\.css\?v=20260722-combined-v1/);
assert.match(html, /app\.js\?v=20260722-combined-v1/);
assert.match(html, /id="map-frame"/);
assert.match(html, /id="project-type-frame"/);
assert.match(css, /--panel-height:\s*520px/);
assert.match(css, /grid-template-columns:\s*minmax\(0,\s*2fr\)\s+minmax\(340px,\s*1fr\)/);
assert.match(css, /min-height:\s*100vh/);
assert.match(css, /height:\s*var\(--panel-height\)/);
assert.match(css, /@media \(max-width:\s*900px\)/);
assert.match(app, /new URLSearchParams\(window\.location\.search\)/);
assert.match(app, /buildUrl\(`\.\.\/maps\/`\)/);
assert.match(app, /buildUrl\(`\.\.\/charts\/project-type\/`\)/);
assert.match(app, /url\.search\s*=\s*sharedQuery/);
assert.ok(!app.includes("operators.json"), "combined page must reuse the existing apps and data files");

console.log("Company dashboard UI contract checks passed");
