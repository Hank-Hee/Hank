import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { buildCountrySummary, buildProjectTypeMix, filterProjects, projectToMap } from "../map-core.js";

const repoRoot = resolve(import.meta.dirname, "../../..");
const pilotRoot = resolve(repoRoot, "pilot/exxon-fast");
const readText = (path) => readFile(resolve(repoRoot, path), "utf8");
const readJson = async (path) => JSON.parse(await readText(path));

test("Exxon pilot summary preserves the approved map totals", async () => {
  const [summary, details, centers] = await Promise.all([
    readJson("pilot/exxon-fast/data/map-summary.json"),
    readJson("maps/data/exxonmobil.json"),
    readJson("maps/data/country-centers.json"),
  ]);
  assert.equal(summary.meta.operator, "ExxonMobil");
  assert.equal(summary.meta.projectCount, 373);
  assert.equal(summary.meta.countryCount, 18);
  assert.equal(details.projects.length, 373);
  assert.equal(summary.projectTypes.reduce((sum, item) => sum + item.count, 0), 373);
  assert.equal(summary.countries.reduce((sum, item) => sum + item.count, 0), 373);
  for (const country of summary.countries) {
    assert.ok(country.point.x >= 0 && country.point.x <= 1000, country.country);
    assert.ok(country.point.y >= 0 && country.point.y <= 500, country.country);
    assert.deepEqual(country.point, projectToMap(country.center));
  }
  assert.deepEqual(buildCountrySummary(details.projects, centers.countries), summary.countries);
  assert.deepEqual(buildProjectTypeMix(details.projects), summary.projectTypes);
});

test("Project search covers project, facilities and business region", async () => {
  const details = await readJson("maps/data/exxonmobil.json");
  assert.ok(filterProjects(details.projects, "FPSO").length > 0);
  assert.ok(filterProjects(details.projects, "墨西哥湾").length > 0);
  assert.equal(filterProjects(details.projects, "__not_a_real_project__").length, 0);
});

test("Pilot pages have no nested iframe or third-party runtime dependency", async () => {
  const paths = [
    "pilot/exxon-fast/index.html",
    "pilot/exxon-fast/map.html",
    "pilot/exxon-fast/app.js",
    "pilot/exxon-fast/map.js",
    "pilot/exxon-fast/map-page.js",
    "pilot/exxon-fast/map-core.js",
    "pilot/exxon-fast/styles.css",
  ];
  const text = (await Promise.all(paths.map(readText))).join("\n");
  assert.doesNotMatch(text, /<iframe\b/i);
  assert.doesNotMatch(text, /(?:src|href)\s*=\s*["']https?:\/\//i);
  assert.doesNotMatch(text, /fetch\s*\(\s*["']https?:\/\//i);
  assert.doesNotMatch(text, /unpkg|cartocdn|leaflet|echarts|xlsx|no-store|Date\.now/i);
  assert.match(text, /force-cache/);
  assert.match(text, /\.pilot-footer \[data-pilot-ready\]/);
});

test("Local vector map is self-contained and within the first-load budget", async () => {
  const svg = await readText("pilot/exxon-fast/assets/world-110m.svg");
  assert.match(svg, /^(?:<\?xml[^>]+>\s*)?<svg\b/);
  assert.doesNotMatch(svg, /<(?:image|script|foreignObject)\b/i);
  const initialPaths = [
    "pilot/exxon-fast/index.html",
    "pilot/exxon-fast/styles.css",
    "pilot/exxon-fast/app.js",
    "pilot/exxon-fast/map.js",
    "pilot/exxon-fast/map-core.js",
    "pilot/exxon-fast/data/company.json",
    "pilot/exxon-fast/data/map-summary.json",
    "pilot/exxon-fast/assets/world-110m.svg",
    "assets/banner-logos/exxonmobil-logo.png",
  ];
  const sizes = await Promise.all(initialPaths.map(async (path) => (await stat(resolve(repoRoot, path))).size));
  const total = sizes.reduce((sum, size) => sum + size, 0);
  assert.ok(total < 300_000, `initial local assets are ${total} bytes`);
  assert.ok((await stat(resolve(pilotRoot, "data/map-summary.json"))).size < 10_000);
  assert.ok((await stat(resolve(pilotRoot, "assets/world-110m.svg"))).size < 150_000);
});

test("Profile, production and financial data satisfy the pilot contract", async () => {
  const [profile, production, financial] = await Promise.all([
    readJson("pilot/exxon-fast/data/company.json"),
    readJson("data/exxon-net-production-by-region.json"),
    readJson("data/exxonmobil-financials.json"),
  ]);
  for (const key of ["name", "nameZh", "companyType", "businessTags", "introduction", "focusRegions"]) {
    assert.ok(profile[key]?.length, `missing profile field: ${key}`);
  }
  assert.equal(production.data.length, 36);
  assert.equal(production.data[0].year, 2015);
  assert.equal(production.data.at(-1).year, 2050);
  for (const row of production.data) {
    const total = production.regions.reduce((sum, region) => sum + Number(row.values[region] || 0), 0);
    assert.ok(Math.abs(total - row.total) < 0.001, `production total mismatch: ${row.year}`);
  }
  assert.deepEqual(financial.coverage.dashboardYears, Array.from({ length: 13 }, (_, index) => 2016 + index));
  assert.equal(financial.dashboards.profitability.barKey, "revenue");
  assert.equal(financial.dashboards.cashInvestment.barKey, "investmentAbs");
  for (const year of financial.coverage.dashboardYears) {
    const row = financial.metrics.find((item) => item.year === year);
    assert.ok(row, `missing financial year: ${year}`);
    assert.ok(Number.isFinite(row.revenue));
    assert.ok(Number.isFinite(row.netIncome));
    assert.ok(Number.isFinite(row.freeCashFlow));
    assert.ok(Number.isFinite(row.capex));
  }
});
