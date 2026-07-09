const VERSION = "20260709-adnoc-financials-svgcash4";
const DATA_URL = "../../data/adnoc-financials.json";

const palette = {
  revenue: "#238b8d",
  netIncome: "#c83c32",
  operatingCashFlow: "#3277bd",
  freeCashFlow: "#eba923",
  cashOnHand: "#7b8794"
};

const formatCompact = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "n/a";
  const abs = Math.abs(value);
  if (abs >= 1000) return `${(value / 1000).toFixed(1)}bn`;
  return `${value.toLocaleString("en-US")}m`;
};

const loadData = async () => {
  const response = await fetch(`${DATA_URL}?v=${VERSION}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load ${DATA_URL}: ${response.status}`);
  return response.json();
};

const actualRows = (payload) => payload.metrics.filter((row) => payload.coverage.dashboardYears.includes(row.year));

const seriesValues = (rows, key) => rows.map((row) => row[key]);

const valueFormatter = (params) => {
  const items = Array.isArray(params) ? params : [params];
  return items
    .map((item) => {
      const value = Array.isArray(item.value) ? item.value[1] : item.value;
      return `${item.marker}${item.seriesName}: ${formatCompact(value)}`;
    })
    .join("<br>");
};

const commonGrid = {
  left: 54,
  right: 28,
  top: 42,
  bottom: 38
};

const buildBaseOption = (years) => ({
  animationDuration: 700,
  color: [palette.revenue, palette.netIncome, palette.operatingCashFlow, palette.freeCashFlow, palette.cashOnHand],
  tooltip: {
    trigger: "axis",
    confine: true,
    valueFormatter: (value) => `${Number(value).toLocaleString("en-US")} USDm`,
    formatter: valueFormatter
  },
  legend: {
    top: 5,
    right: 14,
    itemWidth: 10,
    itemHeight: 10,
    textStyle: { color: "#607789", fontSize: 11 }
  },
  grid: commonGrid,
  xAxis: {
    type: "category",
    data: years,
    boundaryGap: true,
    axisTick: { show: false },
    axisLine: { lineStyle: { color: "rgba(96,119,137,0.32)" } },
    axisLabel: { color: "#607789", fontSize: 11 }
  },
  yAxis: {
    type: "value",
    name: "USDm",
    nameTextStyle: { color: "#607789", fontSize: 10, padding: [0, 0, 2, 0] },
    axisLabel: {
      color: "#607789",
      fontSize: 10,
      formatter: (value) => (Math.abs(value) >= 1000 ? `${value / 1000}k` : value)
    },
    splitLine: { lineStyle: { color: "rgba(104,132,154,0.16)" } }
  }
});

const renderProfitability = (payload) => {
  const rows = actualRows(payload);
  const years = rows.map((row) => row.year);
  const latest = rows.at(-1);
  document.querySelector("[data-kpi='revenue']").textContent = formatCompact(latest.revenue);
  document.querySelector("[data-kpi='net-income']").textContent = formatCompact(latest.netIncome);
  document.querySelector("[data-kpi='period']").textContent = payload.coverage.fullYearActualRange;

  const option = {
    ...buildBaseOption(years),
    series: [
      {
        name: "Revenue 收入",
        type: "line",
        data: seriesValues(rows, "revenue"),
        barMaxWidth: 34,
        itemStyle: { color: palette.revenue, borderRadius: [4, 4, 0, 0] }
      },
      {
        name: "Net income 净利润",
        type: "line",
        data: seriesValues(rows, "netIncome"),
        symbol: "circle",
        symbolSize: 7,
        lineStyle: { width: 3, color: palette.netIncome },
        itemStyle: { color: palette.netIncome }
      }
    ]
  };

  window.__adnocFinancialDebug = {
    mode: "profitability",
    years,
    revenue: seriesValues(rows, "revenue"),
    netIncome: seriesValues(rows, "netIncome")
  };
  echarts.init(document.querySelector("#financial-chart")).setOption(option);
};

const renderCashInvestment = (payload) => {
  const rows = actualRows(payload);
  const years = rows.map((row) => row.year);
  const latest = rows.at(-1);
  document.querySelector("[data-kpi='ocf']").textContent = formatCompact(latest.operatingCashFlow);
  document.querySelector("[data-kpi='cash']").textContent = formatCompact(latest.cashOnHand);
  document.querySelector("[data-kpi='capex']").textContent = "n/a";

  const chartElement = document.querySelector("#financial-chart");
  const compact = chartElement.clientWidth < 500;
  const width = compact ? 360 : 720;
  const height = compact ? 180 : 190;
  const margin = compact
    ? { top: 24, right: 12, bottom: 34, left: 42 }
    : { top: 24, right: 24, bottom: 38, left: 58 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const operating = seriesValues(rows, "operatingCashFlow");
  const free = seriesValues(rows, "freeCashFlow");
  const yMax = Math.ceil(Math.max(...operating, ...free) / 5000) * 5000;
  const yTicks = Array.from({ length: yMax / 5000 + 1 }, (_, index) => index * 5000);
  const x = (index) => margin.left + (plotWidth * index) / Math.max(1, years.length - 1);
  const y = (value) => margin.top + plotHeight - (plotHeight * value) / yMax;
  const points = (values) => values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  const markers = (values, color) => values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="4.5" fill="${color}" stroke="#fff" stroke-width="2"></circle>`).join("");
  const tickLines = yTicks.map((tick) => {
    const ty = y(tick);
    const label = tick >= 1000 ? `${tick / 1000}k` : `${tick}`;
    return `<g><line x1="${margin.left}" x2="${width - margin.right}" y1="${ty}" y2="${ty}" stroke="rgba(104,132,154,0.18)"></line><text x="${margin.left - 10}" y="${ty + 4}" text-anchor="end">${label}</text></g>`;
  }).join("");
  const xLabels = years.map((year, index) => `<text x="${x(index)}" y="${height - (compact ? 18 : 16)}" text-anchor="middle">${year}</text>`).join("");
  const legendX = compact ? width - 198 : width - 315;
  const operatingLabel = compact ? "Operating CF" : "Operating CF 经营现金流";
  const freeLabel = compact ? "Free CF" : "Free CF 自由现金流";
  const freeLegendX = compact ? 96 : 156;
  chartElement.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Operating cash flow and free cash flow trend">
      <style>
        text { font-family: Inter, "Segoe UI", "Microsoft YaHei", Arial, sans-serif; fill: #607789; font-size: ${compact ? 10 : 11}px; }
        .legend { font-size: ${compact ? 10 : 12}px; fill: #607789; }
      </style>
      <text x="${margin.left}" y="12">USDm</text>
      <g>${tickLines}</g>
      <line x1="${margin.left}" x2="${width - margin.right}" y1="${height - margin.bottom}" y2="${height - margin.bottom}" stroke="rgba(96,119,137,0.38)"></line>
      <g>${xLabels}</g>
      <polyline points="${points(operating)}" fill="none" stroke="${palette.operatingCashFlow}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"></polyline>
      <polyline points="${points(free)}" fill="none" stroke="${palette.freeCashFlow}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"></polyline>
      <g>${markers(operating, palette.operatingCashFlow)}${markers(free, palette.freeCashFlow)}</g>
      <g transform="translate(${legendX}, 12)">
        <circle cx="0" cy="0" r="4.5" fill="${palette.operatingCashFlow}"></circle>
        <text class="legend" x="9" y="4">${operatingLabel}</text>
        <circle cx="${freeLegendX}" cy="0" r="4.5" fill="${palette.freeCashFlow}"></circle>
        <text class="legend" x="${freeLegendX + 9}" y="4">${freeLabel}</text>
      </g>
    </svg>`;
};

const start = async () => {
  const state = document.querySelector("#state");
  try {
    const payload = await loadData();
    const mode = document.body.dataset.dashboard;
    if (mode === "profitability") {
      renderProfitability(payload);
    } else {
      renderCashInvestment(payload);
    }
    document.querySelector("[data-source-link]").href = payload.sources.find((source) => source.key === "murban_fy2025_snapshot").url;
    state.hidden = true;
  } catch (error) {
    console.error(error);
    state.textContent = "财务数据加载失败";
    state.hidden = false;
  }
};

start();
