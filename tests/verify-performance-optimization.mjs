import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, "..");

const productionPages = [
  ["adnoc-net-production-dashboard.html", "adnoc"],
  ["bp-net-production-dashboard.html", "bp"],
  ["chevron-net-production-dashboard.html", "chevron"],
  ["eni-net-production-dashboard.html", "eni"],
  ["exxon-net-production-dashboard.html", "exxonmobil"],
  ["petronas-net-production-dashboard.html", "petronas"],
  ["shell-net-production-dashboard.html", "shell"],
  ["totalenergies-net-production-dashboard.html", "totalenergies"]
];

for (const [file, company] of productionPages) {
  const text = await fs.readFile(path.join(rootDir, file), "utf8");
  assert.match(text, new RegExp(`data-company="${company}"`));
  assert.match(text, /production\/production-dashboard\.css/);
  assert.match(text, /assets\/echarts-production-lite\.min\.js/);
  assert.match(text, /production\/production-dashboard\.js/);
  assert.doesNotMatch(text, /const dashboardData|assets\/echarts\.min\.js/);
  assert.ok(Buffer.byteLength(text) < 2200, `${file} should remain a thin compatibility entry`);
}

const genericPage = await fs.readFile(path.join(rootDir, "production", "index.html"), "utf8");
assert.match(genericPage, /production-dashboard\.js/);
assert.match(genericPage, /echarts-production-lite\.min\.js/);

const productionRuntime = await fs.readFile(path.join(rootDir, "production", "production-dashboard.js"), "utf8");
assert.match(productionRuntime, /cache: "no-cache"/);
assert.match(productionRuntime, /requestIdleCallback/);
assert.match(productionRuntime, /axisLabels === "endpoints"/);
assert.match(productionRuntime, /installCustomTooltip/);
assert.doesNotMatch(productionRuntime, /no-store|Date\.now/);

const productionStyles = await fs.readFile(path.join(rootDir, "production", "production-dashboard.css"), "utf8");
assert.match(productionStyles, /\.production-tooltip/);
assert.match(productionStyles, /font-family: "Microsoft YaHei"/);

const fullEcharts = await fs.stat(path.join(rootDir, "assets", "echarts.min.js"));
const liteEcharts = await fs.stat(path.join(rootDir, "assets", "echarts-production-lite.min.js"));
assert.ok(liteEcharts.size < fullEcharts.size * 0.5, "Production ECharts build should be less than half the full bundle");
const fullEchartsGzip = zlib.gzipSync(await fs.readFile(path.join(rootDir, "assets", "echarts.min.js"))).length;
const liteEchartsGzip = zlib.gzipSync(await fs.readFile(path.join(rootDir, "assets", "echarts-production-lite.min.js"))).length;
assert.ok(liteEchartsGzip < fullEchartsGzip * 0.55, "Compressed production ECharts build should remain materially smaller");

const companyJson = JSON.parse(await fs.readFile(path.join(rootDir, "company-text-dashboard", "data", "company-data.json"), "utf8"));
assert.equal(companyJson.length, 126);
assert.ok(companyJson.every((row) => row.data_id && row["公司名称"]));

for (const file of ["index.html", "links.html"]) {
  const text = await fs.readFile(path.join(rootDir, "company-text-dashboard", file), "utf8");
  assert.doesNotMatch(text, /xlsx\.full\.min\.js/);
  assert.match(text, /data\.js\?v=20260729-1/);
}

const companyDataRuntime = await fs.readFile(path.join(rootDir, "company-text-dashboard", "data.js"), "utf8");
assert.match(companyDataRuntime, /company-data\.json/);
assert.match(companyDataRuntime, /cache: "no-cache"/);
assert.doesNotMatch(companyDataRuntime, /XLSX|no-store/);

const targetFiles = [
  path.join(rootDir, "assets", "oil-gas-widget.js"),
  path.join(rootDir, "charts", "financial", "financial-dashboard.js"),
  ...(await fs.readdir(path.join(rootDir, "charts", "financial")))
    .filter((file) => file.endsWith("-financials.js"))
    .map((file) => path.join(rootDir, "charts", "financial", file))
];
for (const file of targetFiles) {
  const text = await fs.readFile(file, "utf8");
  assert.doesNotMatch(text, /no-store|Date\.now/);
}

console.log(JSON.stringify({
  productionPages: productionPages.length,
  companyRecords: companyJson.length,
  fullEchartsBytes: fullEcharts.size,
  liteEchartsBytes: liteEcharts.size,
  echartsReductionPercent: Number(((1 - liteEcharts.size / fullEcharts.size) * 100).toFixed(1)),
  fullEchartsGzipBytes: fullEchartsGzip,
  liteEchartsGzipBytes: liteEchartsGzip,
  echartsGzipReductionPercent: Number(((1 - liteEchartsGzip / fullEchartsGzip) * 100).toFixed(1))
}));
