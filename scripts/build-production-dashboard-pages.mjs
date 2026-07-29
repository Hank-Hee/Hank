import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");

const companies = [
  { key: "adnoc", name: "ADNOC", file: "adnoc-net-production-dashboard.html", data: "adnoc-net-production-by-region.json" },
  { key: "bp", name: "bp", file: "bp-net-production-dashboard.html", data: "bp-net-production-by-region.json" },
  { key: "chevron", name: "Chevron", file: "chevron-net-production-dashboard.html", data: "chevron-net-production-by-region.json" },
  { key: "eni", name: "Eni", file: "eni-net-production-dashboard.html", data: "eni-net-production-by-region.json" },
  { key: "exxonmobil", name: "ExxonMobil", file: "exxon-net-production-dashboard.html", data: "exxon-net-production-by-region.json" },
  { key: "petronas", name: "Petronas", file: "petronas-net-production-dashboard.html", data: "petronas-net-production-by-region.json" },
  { key: "shell", name: "Shell", file: "shell-net-production-dashboard.html", data: "shell-net-production-by-region.json" },
  { key: "totalenergies", name: "TotalEnergies", file: "totalenergies-net-production-dashboard.html", data: "totalenergies-net-production-by-region.json" }
];

const renderPage = ({ key, name, data }) => `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${name} 按 Region 展示的净产量分析看板">
  <title>${name} 地区净产量</title>
  <link rel="preload" href="data/${data}" as="fetch">
  <link rel="stylesheet" href="production/production-dashboard.css?v=20260729-4">
  <script defer src="assets/echarts-production-lite.min.js?v=5.6.0-production-1"></script>
  <script defer src="production/production-dashboard.js?v=20260729-4"></script>
</head>
<body data-company="${key}">
  <main class="dashboard">
    <section class="chart-card" aria-labelledby="page-title">
      <header class="chart-head">
        <div>
          <h1 id="page-title">${name} 地区净产量</h1>
          <p>Net production · Unit: kbbl/d</p>
        </div>
      </header>

      <div class="chart-stage">
        <div id="production-chart" role="img" aria-label="按地区展示 ${name} 净产量"></div>
        <div id="chart-loading" class="chart-loading">正在加载生产数据…</div>
      </div>

      <div class="legend-zone">
        <span class="legend-label">Region</span>
        <div id="region-legend" class="region-legend" aria-label="地区图例；点击可显示或隐藏地区"></div>
      </div>
    </section>
  </main>
</body>
</html>
`;

for (const company of companies) {
  await fs.writeFile(path.join(rootDir, company.file), renderPage(company), "utf8");
}

console.log(`Generated ${companies.length} production dashboard entry pages.`);
