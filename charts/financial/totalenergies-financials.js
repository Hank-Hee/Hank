const VERSION = "20260721-totalenergies-v1";
const DATA_URL = "../../data/totalenergies-financials.json";

const fmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const formatAxis = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  const abs = Math.abs(value);
  return abs >= 1000 ? `${fmt.format(value / 1000)}k` : fmt.format(value);
};

const formatValue = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "n/a";
  return `${fmt.format(value)} USD million`;
};

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

const loadData = async () => {
  const response = await fetch(`${DATA_URL}?v=${VERSION}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load ${DATA_URL}: ${response.status}`);
  return response.json();
};

const sourceListFor = (payload, config) => {
  const keys = config.sourceKeys?.length ? config.sourceKeys : config.sourceKey ? [config.sourceKey] : [];
  return keys.map((key) => payload.sources.find((source) => source.key === key)).filter(Boolean);
};

const renderSourceLinks = (element, payload, config) => {
  const sources = sourceListFor(payload, config);
  if (!sources.length) {
    element.textContent = config.sourceLine || "Source: company public disclosures";
    return;
  }

  const renderLinks = (labelKey) =>
    sources
      .map((source) => {
        const label = source[labelKey] || source.footerLabel || source.shortTitle || source.title;
        return `<a href="${escapeHtml(source.url)}" title="${escapeHtml(source.title)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`;
      })
      .join('<span class="source-separator" aria-hidden="true">&#65292;</span>');

  const compactViewport = window.matchMedia("(max-width: 560px)").matches;
  element.innerHTML = `Source: ${renderLinks(compactViewport ? "footerShortLabel" : "footerLabel")}`;
  if (!compactViewport && element.scrollWidth > element.clientWidth) element.innerHTML = `Source: ${renderLinks("footerShortLabel")}`;
};

const niceStep = (span) => {
  const roughStep = Math.max(1, span / 4);
  const power = 10 ** Math.floor(Math.log10(roughStep));
  return [1, 2, 2.5, 5, 10].find((item) => item * power >= roughStep) * power;
};

const niceScale = (values) => {
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const step = niceStep(maxValue - minValue || 1);
  const yMin = Math.floor(minValue / step) * step;
  const yMax = Math.ceil(maxValue / step) * step || step;
  const ticks = [];
  for (let tick = yMin; tick <= yMax + step / 10; tick += step) ticks.push(tick);
  return { yMin, yMax, ticks };
};

const trimNumber = (value) => Number(value.toFixed(2)).toString();

const pathFor = (rows, xScale, yScale, key) => {
  const points = rows
    .filter((row) => row[key] !== null && row[key] !== undefined)
    .map((row) => ({ x: xScale(row.index), y: yScale(row[key]) }));

  if (!points.length) return "";
  if (points.length === 1) return `M ${trimNumber(points[0].x)} ${trimNumber(points[0].y)}`;
  if (points.length === 2) return `M ${trimNumber(points[0].x)} ${trimNumber(points[0].y)} L ${trimNumber(points[1].x)} ${trimNumber(points[1].y)}`;

  const commands = [`M ${trimNumber(points[0].x)} ${trimNumber(points[0].y)}`];
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    commands.push(`C ${trimNumber(cp1x)} ${trimNumber(cp1y)}, ${trimNumber(cp2x)} ${trimNumber(cp2y)}, ${trimNumber(p2.x)} ${trimNumber(p2.y)}`);
  }
  return commands.join(" ");
};

const titleFor = (row, config) => {
  const barValue = row.barValue === null || row.barValue === undefined ? "n/a" : formatValue(row.barValue);
  const lineValue = row.lineValue === null || row.lineValue === undefined ? "n/a" : formatValue(row.lineValue);
  return `${row.year}\n${config.barLabel}: ${barValue}\n${config.lineLabel}: ${lineValue}\n${row.dataType || row.status}`;
};

const renderTooltipContent = (tooltip, row, config) => {
  const status = row.isForecast ? "Forecast" : "Actual";
  tooltip.innerHTML = `
    <div class="tooltip-heading"><span class="tooltip-year">${escapeHtml(row.year)}</span><span class="tooltip-status">${status}</span></div>
    <div class="tooltip-row"><span>${escapeHtml(config.barLabel)}</span><strong>${escapeHtml(formatValue(row.barValue))}</strong></div>
    <div class="tooltip-row"><span>${escapeHtml(config.lineLabel)}</span><strong>${escapeHtml(formatValue(row.lineValue))}</strong></div>
  `;
};

const positionTooltip = (tooltip, chart, event, target) => {
  const chartRect = chart.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const baseX = event?.clientX ?? targetRect.left + targetRect.width / 2;
  const baseY = event?.clientY ?? targetRect.top + targetRect.height / 2;
  let x = baseX - chartRect.left + 12;
  let y = baseY - chartRect.top - tooltip.offsetHeight - 12;

  if (x + tooltip.offsetWidth > chartRect.width - 6) x = chartRect.width - tooltip.offsetWidth - 6;
  if (y < 6) y = baseY - chartRect.top + 14;
  tooltip.style.left = `${Math.max(6, x)}px`;
  tooltip.style.top = `${Math.max(6, y)}px`;
};

const attachTooltips = (chart, rows, config) => {
  const tooltip = document.createElement("div");
  tooltip.className = "chart-tooltip";
  tooltip.setAttribute("role", "tooltip");
  chart.appendChild(tooltip);

  const rowByIndex = new Map(rows.map((row) => [String(row.index), row]));
  chart.querySelectorAll(".tooltip-target").forEach((target) => {
    const pairedPoint = () => target.dataset.series === "line" ? chart.querySelector(`.line-point[data-index="${target.dataset.index}"]`) : null;
    const show = (event) => {
      const row = rowByIndex.get(target.dataset.index);
      if (!row) return;
      renderTooltipContent(tooltip, row, config);
      tooltip.classList.add("is-visible");
      target.classList.add("is-hover");
      pairedPoint()?.classList.add("is-hover");
      positionTooltip(tooltip, chart, event, target);
    };
    const hide = () => {
      tooltip.classList.remove("is-visible");
      target.classList.remove("is-hover");
      pairedPoint()?.classList.remove("is-hover");
    };
    target.addEventListener("pointerenter", show);
    target.addEventListener("pointermove", show);
    target.addEventListener("pointerleave", hide);
    target.addEventListener("focus", show);
    target.addEventListener("blur", hide);
  });
};

const attachLegendToggles = (chart) => {
  document.querySelectorAll(".legend-item[data-series]").forEach((button) => {
    button.onclick = () => {
      const series = button.dataset.series;
      const isVisible = button.getAttribute("aria-pressed") !== "false";
      button.setAttribute("aria-pressed", String(!isVisible));
      const selector = series === "forecast" ? "[data-forecast]" : `[data-chart-series="${series}"]`;
      chart.querySelectorAll(selector).forEach((element) => element.classList.toggle("series-hidden", isVisible));
    };
  });
};

const buildRows = (payload, mode) => {
  const config = payload.dashboards[mode];
  return payload.metrics
    .filter((row) => payload.coverage.dashboardYears.includes(row.year))
    .map((row) => ({
      ...row,
      barValue: mode === "cashInvestment" ? (row.capex === null ? null : Math.abs(row.capex)) : row[config.barKey],
      lineValue: row[config.lineKey],
      isForecast: /forecast|guidance/i.test(row.dataType || row.status || "")
    }))
    .filter((row) => row.barValue !== null || row.lineValue !== null)
    .map((row, index) => ({ ...row, index }));
};

const renderComboChart = (payload, mode) => {
  const config = payload.dashboards[mode];
  const rows = buildRows(payload, mode);
  const chart = document.querySelector("#financial-chart");
  const width = Math.max(340, Math.round(chart.clientWidth || 420));
  const height = Math.max(210, Math.round(chart.clientHeight || 230));
  const compact = width < 460;
  const margin = compact ? { top: 22, right: 8, bottom: 30, left: 48 } : { top: 22, right: 12, bottom: 30, left: 58 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const values = rows.flatMap((row) => [row.barValue, row.lineValue]).filter((value) => value !== null && value !== undefined);
  const { yMin, yMax, ticks } = niceScale(values);
  const band = plotW / Math.max(rows.length, 1);
  const barWidth = Math.max(8, Math.min(compact ? 17 : 23, band * 0.54));
  const x = (index) => margin.left + band * index + band / 2;
  const y = (value) => margin.top + plotH - (plotH * (value - yMin)) / (yMax - yMin);
  const firstForecast = rows.findIndex((row) => row.isForecast);
  const actualLineRows = firstForecast > -1 ? rows.slice(0, firstForecast) : rows;
  const forecastLineRows = firstForecast > -1 ? rows.slice(Math.max(0, firstForecast - 1)) : [];
  const zeroY = y(0);

  const grid = ticks.map((tick) => {
    const ty = y(tick);
    return `<g><line class="grid-line" x1="${margin.left}" x2="${width - margin.right}" y1="${ty}" y2="${ty}"></line><text x="${margin.left - 8}" y="${ty + 4}" text-anchor="end">${formatAxis(tick)}</text></g>`;
  }).join("");

  const bars = rows.filter((row) => row.barValue !== null && row.barValue !== undefined).map((row) => {
    const valueY = y(row.barValue);
    const barH = Math.abs(zeroY - valueY);
    const forecastAttr = row.isForecast ? ' data-forecast="true"' : "";
    return `<rect class="bar-rect tooltip-target${row.isForecast ? " forecast" : ""}" data-chart-series="bar"${forecastAttr} data-index="${row.index}" data-series="bar" tabindex="0" x="${x(row.index) - barWidth / 2}" y="${Math.min(zeroY, valueY)}" width="${barWidth}" height="${barH}" rx="2" ry="2"><title>${escapeHtml(titleFor(row, config))}</title></rect>`;
  }).join("");

  const labels = rows.map((row) => {
    const showLabel = !compact || row.index % 2 === 0 || row.index === rows.length - 1;
    return `<text x="${x(row.index)}" y="${height - 8}" text-anchor="middle">${showLabel ? row.year : ""}</text>`;
  }).join("");

  const lineActual = pathFor(actualLineRows, x, y, "lineValue");
  const lineForecast = pathFor(forecastLineRows, x, y, "lineValue");
  const points = rows.filter((row) => row.lineValue !== null && row.lineValue !== undefined).map((row) => {
    const forecastAttr = row.isForecast ? ' data-forecast="true"' : "";
    return `<circle class="line-point${row.isForecast ? " forecast" : ""}" data-chart-series="line"${forecastAttr} data-index="${row.index}" cx="${x(row.index)}" cy="${y(row.lineValue)}" r="${compact ? 3 : 3.6}"><title>${escapeHtml(titleFor(row, config))}</title></circle><circle class="line-hit-area tooltip-target" data-chart-series="line"${forecastAttr} data-index="${row.index}" data-series="line" tabindex="0" cx="${x(row.index)}" cy="${y(row.lineValue)}" r="${compact ? 10 : 11}"><title>${escapeHtml(titleFor(row, config))}</title></circle>`;
  }).join("");

  const forecastDivider = firstForecast > -1 ? (() => {
    const dividerX = x(firstForecast) - band / 2;
    return `<g class="forecast-divider" data-forecast="true"><line x1="${dividerX}" x2="${dividerX}" y1="${margin.top}" y2="${height - margin.bottom}"></line><text x="${dividerX + 4}" y="${margin.top + 10}">Forecast</text></g>`;
  })() : "";

  chart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${config.title}">
      <g>${grid}</g>
      <line class="axis-line" x1="${margin.left}" x2="${width - margin.right}" y1="${zeroY}" y2="${zeroY}"></line>
      <g>${bars}</g>
      ${lineActual ? `<path class="line-path" data-chart-series="line" d="${lineActual}"></path>` : ""}
      ${lineForecast ? `<path class="line-path forecast" data-chart-series="line" data-forecast="true" d="${lineForecast}"></path>` : ""}
      <g>${points}</g>
      ${forecastDivider}
      <g>${labels}</g>
    </svg>`;

  attachTooltips(chart, rows, config);
  attachLegendToggles(chart);
  document.querySelector("[data-eyebrow]").textContent = config.eyebrow || "FINANCIAL PROFILE";
  document.querySelector("[data-title-cn]").textContent = config.titleCn || config.title;
  document.querySelector("[data-subtitle]").textContent = config.subtitle;
  document.querySelector("[data-bar-label]").textContent = config.barLabel;
  document.querySelector("[data-line-label]").textContent = config.lineLabel;
  renderSourceLinks(document.querySelector("[data-source-line]"), payload, config);
  document.querySelector("[data-update-date]").textContent = config.updateDate || `Update date: ${payload.company.updatedOn?.replaceAll("-", "/") || ""}`;
};

const currentMode = () => document.body.dataset.dashboard === "cash-investment" ? "cashInvestment" : "profitability";

const renderCurrent = (payload) => {
  const mode = currentMode();
  renderComboChart(payload, mode);
  window.__financialDashboardDebug = { mode, payload, version: VERSION };
};

const downloadChart = () => {
  const svg = document.querySelector("#financial-chart svg");
  if (!svg) return;
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${document.body.dataset.company || "company"}-${document.body.dataset.dashboard}.svg`;
  link.click();
  URL.revokeObjectURL(link.href);
};

const setupActions = () => {
  document.querySelector("[data-action=download]")?.addEventListener("click", downloadChart);
  document.querySelector("[data-action=refresh]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try { renderCurrent(await loadData()); } finally { button.disabled = false; }
  });
  document.querySelector("[data-action=fullscreen]")?.addEventListener("click", async () => {
    const card = document.querySelector(".chart-card");
    if (!document.fullscreenElement) await card?.requestFullscreen?.();
    else await document.exitFullscreen?.();
  });
};

const start = async () => {
  const state = document.querySelector("#state");
  setupActions();
  try {
    renderCurrent(await loadData());
    state.hidden = true;
  } catch (error) {
    console.error(error);
    state.textContent = "Financial data failed to load";
    state.hidden = false;
  }
};

window.addEventListener("resize", () => {
  if (window.__financialDashboardDebug?.payload) renderCurrent(window.__financialDashboardDebug.payload);
});

start();
