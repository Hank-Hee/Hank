const VERSION = "20260709-adnoc-redesign-v3";
const DATA_URL = "../../data/adnoc-financials.json";

const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const formatAxis = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  const abs = Math.abs(value);
  if (abs >= 1000) return `${fmt.format(value / 1000)}k`;
  return fmt.format(value);
};

const formatValue = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "n/a";
  return `${fmt.format(value)} USDm`;
};

const loadData = async () => {
  const response = await fetch(`${DATA_URL}?v=${VERSION}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load ${DATA_URL}: ${response.status}`);
  return response.json();
};

const firstSourceUrl = (payload, key) => payload.sources.find((source) => source.key === key)?.url || payload.sources[0]?.url || "#";

const niceScale = (maxValue) => {
  const max = Math.max(1, maxValue);
  const roughStep = max / 4;
  const power = 10 ** Math.floor(Math.log10(roughStep));
  const multipliers = [1, 2, 2.5, 5, 10];
  const step = multipliers.find((item) => item * power >= roughStep) * power;
  const yMax = step * 4 < max ? step * 5 : step * 4;
  return { step, yMax };
};

const pointsFor = (rows, xScale, yScale, key) =>
  rows
    .filter((row) => row[key] !== null && row[key] !== undefined)
    .map((row) => `${xScale(row.index)},${yScale(row[key])}`)
    .join(" ");

const titleFor = (row, config) => {
  const barValue = row.barValue === null || row.barValue === undefined ? "n/a" : formatValue(row.barValue);
  const lineValue = row.lineValue === null || row.lineValue === undefined ? "n/a" : formatValue(row.lineValue);
  return `${row.year}\n${config.barLabel}: ${barValue}\n${config.lineLabel}: ${lineValue}\n${row.dataType || row.status}`;
};

const buildRows = (payload, mode) => {
  const config = payload.dashboards[mode];
  return payload.metrics
    .filter((row) => payload.coverage.dashboardYears.includes(row.year))
    .map((row) => ({
      ...row,
      barValue: mode === "cashInvestment" ? (row.capex === null ? null : Math.abs(row.capex)) : row[config.barKey],
      lineValue: row[config.lineKey],
      isForecast: /forecast/i.test(row.dataType || row.status || "")
    }))
    .filter((row) => row.barValue !== null || row.lineValue !== null)
    .map((row, index) => ({ ...row, index }));
};

const renderComboChart = (payload, mode) => {
  const config = payload.dashboards[mode];
  const rows = buildRows(payload, mode);
  const chart = document.querySelector("#financial-chart");
  const width = Math.max(340, Math.round(chart.clientWidth || 420));
  const height = Math.max(188, Math.round(chart.clientHeight || 230));
  const compact = width < 460;
  const margin = compact
    ? { top: 16, right: 8, bottom: 28, left: 46 }
    : { top: 18, right: 12, bottom: 30, left: 58 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const values = rows.flatMap((row) => [row.barValue, row.lineValue]).filter((value) => value !== null && value !== undefined);
  const { step, yMax } = niceScale(Math.max(...values));
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, index) => index * step);
  const band = plotW / Math.max(rows.length, 1);
  const barWidth = Math.max(10, Math.min(compact ? 20 : 25, band * 0.55));
  const x = (index) => margin.left + band * index + band / 2;
  const y = (value) => margin.top + plotH - (plotH * value) / yMax;
  const firstForecast = rows.findIndex((row) => row.isForecast);
  const actualLineRows = firstForecast > -1 ? rows.slice(0, firstForecast) : rows;
  const forecastLineRows = firstForecast > -1 ? rows.slice(Math.max(0, firstForecast - 1)) : [];

  const grid = ticks
    .map((tick) => {
      const ty = y(tick);
      return `
        <g>
          <line class="grid-line" x1="${margin.left}" x2="${width - margin.right}" y1="${ty}" y2="${ty}"></line>
          <text x="${margin.left - 8}" y="${ty + 4}" text-anchor="end">${formatAxis(tick)}</text>
        </g>`;
    })
    .join("");

  const bars = rows
    .filter((row) => row.barValue !== null && row.barValue !== undefined)
    .map((row) => {
      const barH = y(0) - y(row.barValue);
      return `
        <rect class="bar-rect${row.isForecast ? " forecast" : ""}" x="${x(row.index) - barWidth / 2}" y="${y(row.barValue)}" width="${barWidth}" height="${barH}">
          <title>${titleFor(row, config)}</title>
        </rect>`;
    })
    .join("");

  const labels = rows
    .map((row) => {
      const showLabel = !compact || row.index % 2 === 0 || row.index === rows.length - 1;
      return `<text x="${x(row.index)}" y="${height - 8}" text-anchor="middle">${showLabel ? row.year : ""}</text>`;
    })
    .join("");

  const lineActual = pointsFor(actualLineRows, x, y, "lineValue");
  const lineForecast = pointsFor(forecastLineRows, x, y, "lineValue");
  const points = rows
    .filter((row) => row.lineValue !== null && row.lineValue !== undefined)
    .map(
      (row) => `
        <circle class="line-point${row.isForecast ? " forecast" : ""}" cx="${x(row.index)}" cy="${y(row.lineValue)}" r="${compact ? 3.6 : 4.2}">
          <title>${titleFor(row, config)}</title>
        </circle>`
    )
    .join("");

  chart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${config.title}">
      <g>${grid}</g>
      <line class="axis-line" x1="${margin.left}" x2="${width - margin.right}" y1="${y(0)}" y2="${y(0)}"></line>
      <g>${bars}</g>
      ${lineActual ? `<polyline class="line-path" points="${lineActual}"></polyline>` : ""}
      ${lineForecast ? `<polyline class="line-path forecast" points="${lineForecast}"></polyline>` : ""}
      <g>${points}</g>
      <g>${labels}</g>
    </svg>`;

  document.querySelector("[data-eyebrow]").textContent = config.eyebrow || "FINANCIAL PROFILE";
  document.querySelector("[data-title-cn]").textContent = config.titleCn || config.title;
  document.querySelector("[data-subtitle]").textContent = config.subtitle;
  document.querySelector("[data-bar-label]").textContent = config.barLabel;
  document.querySelector("[data-line-label]").textContent = config.lineLabel;
  document.querySelector("[data-source-line]").textContent = config.sourceLine || `Source: ${config.basisLabel || "company public disclosures"}; etc.`;
  document.querySelector("[data-update-date]").textContent = config.updateDate || `Update date: ${payload.company.updatedOn?.replaceAll("-", "/") || ""}`;
  document.querySelector("[data-source-link]").href = firstSourceUrl(payload, config.sourceKey);
};

const start = async () => {
  const state = document.querySelector("#state");
  try {
    const payload = await loadData();
    const mode = document.body.dataset.dashboard;
    renderComboChart(payload, mode === "cash-investment" ? "cashInvestment" : "profitability");
    state.hidden = true;
    window.__adnocFinancialDebug = { mode, payload };
  } catch (error) {
    console.error(error);
    state.textContent = "财务数据加载失败";
    state.hidden = false;
  }
};

window.addEventListener("resize", () => {
  if (window.__adnocFinancialDebug?.payload) {
    const mode = document.body.dataset.dashboard;
    renderComboChart(window.__adnocFinancialDebug.payload, mode === "cash-investment" ? "cashInvestment" : "profitability");
  }
});

start();
