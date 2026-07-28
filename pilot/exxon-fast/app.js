import { formatNumber, niceScale } from "./map-core.js";
import { mountVectorMap } from "./map.js";

const VERSION = "20260728-pilot-v2";
const SVG_NS = "http://www.w3.org/2000/svg";
const tooltip = document.querySelector("[data-chart-tooltip]");
const footerStatus = document.querySelector(".pilot-footer [data-pilot-ready]");

window.__EXXON_PILOT__ = {
  page: "dashboard",
  ready: false,
  profileReady: false,
  mapReady: false,
  productionReady: false,
  financialReady: false,
};

function svgElement(tag, attributes = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function htmlElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error(`${url} request failed: ${response.status}`);
  return response.json();
}

function renderTags(root, values = []) {
  root.replaceChildren(...values.map((value) => htmlElement("span", "", value)));
}

function renderProfile(profile) {
  document.querySelector("[data-company-name]").textContent = profile.name;
  document.querySelector("[data-company-name-zh]").textContent = profile.nameZh;
  renderTags(document.querySelector("[data-business-tags]"), profile.businessTags);
  renderTags(document.querySelector("[data-profile-business]"), profile.businessTags);
  renderTags(document.querySelector("[data-focus-regions]"), profile.focusRegions);
  const introduction = document.querySelector("[data-company-introduction]");
  introduction.replaceChildren(...profile.introduction.map((text) => htmlElement("p", "", text)));

  const facts = [
    ["公司类型", profile.companyType],
    ["总部", profile.headquarters],
    ["成立年份", String(profile.founded)],
    ["市场定位", profile.marketPosition],
    ["官方网站", profile.website],
  ];
  const factsRoot = document.querySelector("[data-company-facts]");
  factsRoot.replaceChildren(...facts.map(([label, value]) => {
    const row = htmlElement("div");
    row.append(htmlElement("dt", "", label));
    const content = htmlElement("dd");
    if (label === "官方网站") {
      const link = htmlElement("a", "", "ExxonMobil");
      link.href = value;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      content.append(link);
    } else content.textContent = value;
    row.append(content);
    return row;
  }));
  window.__EXXON_PILOT__.profileReady = true;
}

function renderDonut(summary) {
  const types = summary.projectTypes;
  const total = types.reduce((sum, item) => sum + item.count, 0);
  const radius = 92;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const segmentRoot = document.querySelector("[data-donut-segments]");
  segmentRoot.replaceChildren(...types.map((item) => {
    const length = item.count / total * circumference;
    const circle = svgElement("circle", {
      class: "donut-segment",
      cx: 120,
      cy: 120,
      r: radius,
      stroke: item.color,
      "stroke-dasharray": `${length} ${circumference - length}`,
      "stroke-dashoffset": -offset,
    });
    circle.append(svgElement("title", {}, `${item.label}: ${item.count}`));
    offset += length;
    return circle;
  }));
  document.querySelector("[data-donut-total]").textContent = formatNumber(total);
  document.querySelector("[data-type-total]").textContent = formatNumber(total);
  const legend = document.querySelector("[data-donut-legend]");
  legend.replaceChildren(...types.map((item) => {
    const row = htmlElement("div", "donut-legend-row");
    row.style.setProperty("--segment-color", item.color);
    row.append(htmlElement("i"), htmlElement("strong", "", item.label), htmlElement("span", "", `${formatNumber(item.count)} · ${(item.count / total * 100).toFixed(1)}%`));
    return row;
  }));
}

function showTooltip(event, title, rows) {
  tooltip.replaceChildren(htmlElement("strong", "", title));
  const table = htmlElement("table");
  for (const [label, value, color] of rows) {
    const tr = htmlElement("tr");
    const nameCell = htmlElement("td");
    if (color) {
      const dot = htmlElement("i");
      dot.style.cssText = `display:inline-block;width:7px;height:7px;margin-right:6px;border-radius:2px;background:${color}`;
      nameCell.append(dot);
    }
    nameCell.append(document.createTextNode(label));
    tr.append(nameCell, htmlElement("td", "", value));
    table.append(tr);
  }
  tooltip.append(table);
  tooltip.hidden = false;
  const margin = 12;
  const width = tooltip.offsetWidth;
  const height = tooltip.offsetHeight;
  tooltip.style.left = `${Math.max(margin, Math.min(window.innerWidth - width - margin, event.clientX + 14))}px`;
  tooltip.style.top = `${Math.max(margin, Math.min(window.innerHeight - height - margin, event.clientY + 14))}px`;
}

function hideTooltip() {
  tooltip.hidden = true;
}

const REGION_META = {
  "North America": ["北美", "#244e70"],
  "Middle East": ["中东", "#16847a"],
  "South America": ["南美", "#d5b46a"],
  Australasia: ["澳大拉西亚", "#6f91a8"],
  "West Africa": ["西非", "#7b6a58"],
  "Central Asia": ["中亚", "#8da66b"],
  "Western Europe": ["西欧", "#a27476"],
  "Melanesia, Micronesia & Polynesia": ["美拉尼西亚等", "#5f8f91"],
  "South East Asia": ["东南亚", "#7792c6"],
  "East Africa": ["东非", "#c1845b"],
  "Southern Europe": ["南欧", "#8c7fa7"],
  "North Africa": ["北非", "#bd9a65"],
  "South Africa": ["南部非洲", "#7ba38b"],
  "East Asia": ["东亚", "#a3a66f"],
  Russia: ["俄罗斯", "#9b8793"],
};

function renderProduction(payload) {
  const stage = document.querySelector("[data-production-chart]");
  const legend = document.querySelector("[data-production-legend]");
  const latest = payload.data.at(-1);
  document.querySelector("[data-production-latest]").textContent = `${latest.year} · ${formatNumber(latest.total)} ${payload.unit}`;
  const active = new Set(payload.regions);

  const draw = () => {
    const width = 1180;
    const height = 350;
    const margin = { top: 16, right: 22, bottom: 36, left: 56 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const totals = payload.data.map((row) => payload.regions.reduce((sum, region) => sum + (active.has(region) ? Number(row.values[region]) || 0 : 0), 0));
    const scale = niceScale(totals, 4);
    const maximum = Math.max(1, scale.maximum);
    const xAt = (index) => margin.left + index / (payload.data.length - 1) * plotWidth;
    const yAt = (value) => margin.top + plotHeight - value / maximum * plotHeight;
    const svg = svgElement("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "ExxonMobil 地区净产量堆叠面积图" });

    for (const tick of scale.ticks.filter((tick) => tick >= 0)) {
      const y = yAt(tick);
      svg.append(svgElement("line", { class: "chart-grid-line", x1: margin.left, x2: width - margin.right, y1: y, y2: y }));
      svg.append(svgElement("text", { class: "chart-label", x: margin.left - 8, y: y + 3, "text-anchor": "end" }, formatNumber(tick)));
    }
    svg.append(svgElement("line", { class: "chart-axis-line", x1: margin.left, x2: width - margin.right, y1: height - margin.bottom, y2: height - margin.bottom }));

    payload.data.forEach((row, index) => {
      if (row.year % 5 !== 0 && index !== payload.data.length - 1) return;
      svg.append(svgElement("text", { class: "chart-label", x: xAt(index), y: height - 13, "text-anchor": "middle" }, row.year));
    });

    const baseline = Array(payload.data.length).fill(0);
    for (const region of payload.regions) {
      if (!active.has(region)) continue;
      const lower = [...baseline];
      const upper = payload.data.map((row, index) => {
        baseline[index] += Number(row.values[region]) || 0;
        return baseline[index];
      });
      const forward = upper.map((value, index) => `${index ? "L" : "M"}${xAt(index).toFixed(2)},${yAt(value).toFixed(2)}`).join(" ");
      const backward = lower.map((value, index) => `L${xAt(index).toFixed(2)},${yAt(value).toFixed(2)}`).reverse().join(" ");
      const path = svgElement("path", {
        class: "production-area",
        d: `${forward} ${backward} Z`,
        fill: REGION_META[region]?.[1] || "#8ca0ac",
        stroke: REGION_META[region]?.[1] || "#8ca0ac",
      });
      path.append(svgElement("title", {}, REGION_META[region]?.[0] || region));
      svg.append(path);
    }

    const crosshair = svgElement("line", { class: "chart-crosshair", x1: 0, x2: 0, y1: margin.top, y2: height - margin.bottom, visibility: "hidden" });
    svg.append(crosshair);
    const hitWidth = plotWidth / payload.data.length;
    payload.data.forEach((row, index) => {
      const hit = svgElement("rect", {
        class: "chart-hit",
        x: xAt(index) - hitWidth / 2,
        y: margin.top,
        width: hitWidth,
        height: plotHeight,
      });
      hit.addEventListener("pointerenter", () => crosshair.setAttribute("visibility", "visible"));
      hit.addEventListener("pointermove", (event) => {
        const x = xAt(index);
        crosshair.setAttribute("x1", x);
        crosshair.setAttribute("x2", x);
        const rows = payload.regions
          .filter((region) => active.has(region) && Number(row.values[region]) > 0)
          .sort((left, right) => row.values[right] - row.values[left])
          .slice(0, 8)
          .map((region) => [REGION_META[region]?.[0] || region, formatNumber(row.values[region], 1), REGION_META[region]?.[1]]);
        rows.unshift(["合计", `${formatNumber(totals[index], 1)} ${payload.unit}`, ""]);
        showTooltip(event, String(row.year), rows);
      });
      hit.addEventListener("pointerleave", () => {
        crosshair.setAttribute("visibility", "hidden");
        hideTooltip();
      });
      svg.append(hit);
    });
    stage.replaceChildren(svg);
  };

  legend.replaceChildren(...payload.regions.map((region) => {
    const button = htmlElement("button", "");
    button.type = "button";
    button.style.setProperty("--series-color", REGION_META[region]?.[1] || "#8ca0ac");
    button.append(htmlElement("i"), document.createTextNode(REGION_META[region]?.[0] || region));
    button.addEventListener("click", () => {
      if (active.has(region) && active.size === 1) return;
      if (active.has(region)) active.delete(region); else active.add(region);
      button.classList.toggle("is-muted", !active.has(region));
      draw();
    });
    return button;
  }));
  draw();
  window.__EXXON_PILOT__.productionReady = true;
  performance.mark("exxon-production-ready");
}

function valueScale(values, tickCount = 4) {
  const scale = niceScale(values, tickCount);
  const span = scale.maximum - scale.minimum || 1;
  return { ...scale, span };
}

function pathFor(rows, xAt, yAt, valueKey) {
  return rows.map((row, index) => `${index ? "L" : "M"}${xAt(row.index).toFixed(2)},${yAt(row[valueKey]).toFixed(2)}`).join(" ");
}

function renderFinancialCard(card, payload, dashboardKey) {
  const config = payload.dashboards[dashboardKey];
  const years = new Set(payload.coverage.dashboardYears);
  const rows = payload.metrics
    .filter((row) => years.has(row.year))
    .map((row, index) => ({
      ...row,
      index,
      investmentAbs: row.capex === null ? null : Math.abs(row.capex),
      forecast: row.year >= 2026,
    }))
    .filter((row) => Number.isFinite(row[config.barKey]) && Number.isFinite(row[config.lineKey]));

  card.querySelector("[data-financial-title]").textContent = config.titleCn;
  card.querySelector("[data-financial-subtitle]").textContent = `${config.subtitle} · 实际值至2025，预测值2026–2028`;
  card.querySelector("[data-bar-label]").textContent = config.barLabel;
  card.querySelector("[data-line-label]").textContent = config.lineLabel;

  const width = 680;
  const height = 300;
  const margin = { top: 18, right: 50, bottom: 38, left: 52 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const slot = plotWidth / rows.length;
  const barWidth = Math.min(25, slot * .58);
  const barScale = valueScale(rows.map((row) => row[config.barKey]));
  barScale.minimum = Math.min(0, barScale.minimum);
  barScale.span = barScale.maximum - barScale.minimum || 1;
  const lineScale = valueScale(rows.map((row) => row[config.lineKey]));
  const xAt = (index) => margin.left + slot * index + slot / 2;
  const yBar = (value) => margin.top + plotHeight - (value - barScale.minimum) / barScale.span * plotHeight;
  const yLine = (value) => margin.top + plotHeight - (value - lineScale.minimum) / lineScale.span * plotHeight;
  const svg = svgElement("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": config.titleCn });

  for (const tick of barScale.ticks) {
    const y = yBar(tick);
    if (y < margin.top - 1 || y > height - margin.bottom + 1) continue;
    svg.append(svgElement("line", { class: "chart-grid-line", x1: margin.left, x2: width - margin.right, y1: y, y2: y }));
    svg.append(svgElement("text", { class: "chart-label", x: margin.left - 7, y: y + 3, "text-anchor": "end" }, formatNumber(tick)));
  }
  for (const tick of lineScale.ticks) {
    const y = yLine(tick);
    if (y < margin.top - 1 || y > height - margin.bottom + 1) continue;
    svg.append(svgElement("text", { class: "chart-label", x: width - margin.right + 7, y: y + 3, "text-anchor": "start" }, formatNumber(tick)));
  }
  svg.append(svgElement("line", { class: "chart-axis-line", x1: margin.left, x2: width - margin.right, y1: height - margin.bottom, y2: height - margin.bottom }));

  for (const row of rows) {
    const barTop = yBar(row[config.barKey]);
    const baseline = yBar(Math.max(0, barScale.minimum));
    const bar = svgElement("rect", {
      class: `financial-bar${row.forecast ? " is-forecast" : ""}`,
      x: xAt(row.index) - barWidth / 2,
      y: Math.min(barTop, baseline),
      width: barWidth,
      height: Math.max(1, Math.abs(baseline - barTop)),
      rx: 2,
    });
    bar.append(svgElement("title", {}, `${row.year} ${config.barLabel}: ${formatNumber(row[config.barKey])}`));
    svg.append(bar);
    svg.append(svgElement("text", { class: "chart-label", x: xAt(row.index), y: height - 15, "text-anchor": "middle" }, row.year));
  }

  const actualRows = rows.filter((row) => !row.forecast);
  const forecastRows = rows.filter((row) => row.year >= 2025);
  svg.append(svgElement("path", { class: "financial-line", d: pathFor(actualRows, xAt, yLine, config.lineKey) }));
  svg.append(svgElement("path", { class: "financial-line is-forecast", d: pathFor(forecastRows, xAt, yLine, config.lineKey) }));
  for (const row of rows) {
    const point = svgElement("circle", { class: "financial-point", cx: xAt(row.index), cy: yLine(row[config.lineKey]), r: 3.4 });
    point.append(svgElement("title", {}, `${row.year} ${config.lineLabel}: ${formatNumber(row[config.lineKey])}`));
    svg.append(point);
  }

  const firstForecast = rows.find((row) => row.forecast);
  if (firstForecast) {
    const dividerX = xAt(firstForecast.index) - slot / 2;
    svg.append(svgElement("line", { class: "forecast-divider", x1: dividerX, x2: dividerX, y1: margin.top, y2: height - margin.bottom }));
    svg.append(svgElement("text", { class: "chart-label", x: dividerX + 5, y: margin.top + 8 }, "预测"));
  }

  for (const row of rows) {
    const hit = svgElement("rect", { class: "chart-hit", x: xAt(row.index) - slot / 2, y: margin.top, width: slot, height: plotHeight });
    hit.addEventListener("pointermove", (event) => showTooltip(event, `${row.year} · ${row.forecast ? "分析师一致预期" : "官方年度实际值"}`, [
      [config.barLabel, formatNumber(row[config.barKey]), "#7898ad"],
      [config.lineLabel, formatNumber(row[config.lineKey]), "#16847a"],
    ]));
    hit.addEventListener("pointerleave", hideTooltip);
    svg.append(hit);
  }
  card.querySelector("[data-financial-chart]").replaceChildren(svg);
}

function renderFinancial(payload) {
  for (const card of document.querySelectorAll("[data-financial-card]")) {
    renderFinancialCard(card, payload, card.dataset.financialCard);
  }
  window.__EXXON_PILOT__.financialReady = true;
  performance.mark("exxon-financial-ready");
}

function finishIfReady() {
  const status = window.__EXXON_PILOT__;
  if (!status.profileReady || !status.mapReady || !status.productionReady || !status.financialReady) return;
  status.ready = true;
  status.initialResourceHosts = [...new Set(performance.getEntriesByType("resource").map((entry) => new URL(entry.name).host))];
  document.documentElement.dataset.pilotReady = "true";
  footerStatus.textContent = "全部模块已就绪";
  performance.mark("exxon-pilot-all-ready");
  window.dispatchEvent(new CustomEvent("exxon:pilot-ready", { detail: status }));
}

async function init() {
  performance.mark("exxon-pilot-start");
  const [profile, summary] = await Promise.all([
    fetchJson(`data/company.json?v=${VERSION}`),
    fetchJson(`data/map-summary.json?v=${VERSION}`),
  ]);
  renderProfile(profile);
  renderDonut(summary);
  const map = await mountVectorMap(document.querySelector("[data-vector-map]"), {
    summary,
    detailsUrl: `../../maps/data/exxonmobil.json?v=${VERSION}`,
  });
  window.__EXXON_PILOT__.mapReady = true;
  window.__EXXON_PILOT__.projectCount = map.summary.meta.projectCount;
  window.__EXXON_PILOT__.countryCount = map.summary.meta.countryCount;
  footerStatus.textContent = "首屏已就绪，图表加载中";
  performance.mark("exxon-pilot-above-fold-ready");

  const loadCharts = async () => {
    try {
      const [production, financial] = await Promise.all([
        fetchJson(`../../data/exxon-net-production-by-region.json?v=${VERSION}`),
        fetchJson(`../../data/exxonmobil-financials.json?v=${VERSION}`),
      ]);
      renderProduction(production);
      renderFinancial(financial);
      finishIfReady();
    } catch (error) {
      footerStatus.textContent = "部分图表加载失败";
      window.__EXXON_PILOT__.error = error.message;
      console.error(error);
    }
  };
  if ("requestIdleCallback" in window) requestIdleCallback(loadCharts, { timeout: 900 });
  else setTimeout(loadCharts, 0);
}

init().catch((error) => {
  footerStatus.textContent = "试点页面加载失败";
  window.__EXXON_PILOT__.error = error.message;
  console.error(error);
});
