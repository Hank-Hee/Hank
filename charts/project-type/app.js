import {
  buildDonutSegments,
  buildProjectTypeMix,
  formatPercent,
  resolveOperator,
} from "./chart-core.js?v=20260703-project-type";

const VERSION = "20260703-project-type";
const SVG_NS = "http://www.w3.org/2000/svg";
const CENTER = { x: 145, y: 126 };
const RADIUS = 82;

const dom = {
  card: document.querySelector(".dashboard-card"),
  operator: document.querySelector("#operator-name"),
  total: document.querySelector("#donut-total"),
  segments: document.querySelector("#donut-segments"),
  legend: document.querySelector("#project-type-legend"),
  tooltip: document.querySelector("#chart-tooltip"),
  state: document.querySelector("#chart-state"),
};

const showError = (message) => {
  dom.state.classList.add("is-error");
  dom.state.querySelector(".state-spinner")?.remove();
  dom.state.querySelector("strong").textContent = message;
  dom.state.hidden = false;
};

const typeSelector = (key) => `[data-type-key="${CSS.escape(key)}"]`;

const setActive = (item, sourceElement, pointerEvent) => {
  document.querySelectorAll("[data-type-key]").forEach((element) => {
    element.classList.toggle("is-active", element.dataset.typeKey === item.key);
  });

  const swatch = dom.tooltip.querySelector(".tooltip-swatch");
  const label = dom.tooltip.querySelector(".tooltip-copy strong");
  const english = dom.tooltip.querySelector(".tooltip-copy small");
  const value = dom.tooltip.querySelector(".tooltip-value");
  swatch.style.setProperty("--segment-color", item.color);
  label.textContent = item.label;
  english.textContent = item.englishLabel;
  value.textContent = `${item.count} · ${item.percent}`;
  dom.tooltip.hidden = false;

  const cardRect = dom.card.getBoundingClientRect();
  const anchorRect = sourceElement.getBoundingClientRect();
  const pointerX = pointerEvent?.clientX ?? anchorRect.left + anchorRect.width / 2;
  const pointerY = pointerEvent?.clientY ?? anchorRect.top + anchorRect.height / 2;
  const tooltipRect = dom.tooltip.getBoundingClientRect();
  const left = Math.min(
    Math.max(12, pointerX - cardRect.left + 14),
    cardRect.width - tooltipRect.width - 12,
  );
  const top = Math.min(
    Math.max(12, pointerY - cardRect.top - tooltipRect.height - 12),
    cardRect.height - tooltipRect.height - 12,
  );
  dom.tooltip.style.left = `${left}px`;
  dom.tooltip.style.top = `${top}px`;
};

const clearActive = (event) => {
  const next = event?.relatedTarget;
  const activeKey = event?.currentTarget?.dataset.typeKey;
  if (next instanceof Element && next.matches(typeSelector(activeKey))) return;
  document.querySelectorAll("[data-type-key]").forEach((element) => element.classList.remove("is-active"));
  dom.tooltip.hidden = true;
};

const bindInteraction = (element, item) => {
  element.addEventListener("pointerenter", (event) => setActive(item, element, event));
  element.addEventListener("pointermove", (event) => setActive(item, element, event));
  element.addEventListener("pointerleave", clearActive);
  element.addEventListener("focus", () => setActive(item, element));
  element.addEventListener("blur", clearActive);
};

const renderLegendRow = (item) => {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "legend-row";
  row.dataset.typeKey = item.key;
  row.setAttribute("aria-label", `${item.label}，${item.count} 个项目，${item.percent}`);
  row.innerHTML = `
    <span class="legend-swatch" aria-hidden="true"></span>
    <span class="legend-copy"><strong></strong><small></small></span>
    <span class="legend-metrics">
      <span class="legend-count"></span>
      <span class="legend-percent"></span>
    </span>`;
  row.style.setProperty("--segment-color", item.color);
  row.querySelector("strong").textContent = item.label;
  row.querySelector("small").textContent = item.englishLabel;
  row.querySelector(".legend-count").textContent = `${item.count} 项`;
  row.querySelector(".legend-percent").textContent = item.percent;
  bindInteraction(row, item);
  return row;
};

const renderSegment = (item) => {
  const segment = document.createElementNS(SVG_NS, "circle");
  segment.classList.add("donut-segment");
  segment.dataset.typeKey = item.key;
  segment.setAttribute("cx", CENTER.x);
  segment.setAttribute("cy", CENTER.y);
  segment.setAttribute("r", RADIUS);
  segment.setAttribute("stroke", item.color);
  segment.setAttribute("stroke-dasharray", `${item.dashLength} ${item.circumference - item.dashLength}`);
  segment.setAttribute("stroke-dashoffset", item.dashOffset);
  segment.setAttribute("transform", `rotate(-90 ${CENTER.x} ${CENTER.y})`);
  segment.setAttribute("role", "img");
  segment.setAttribute("tabindex", "0");
  segment.setAttribute("aria-label", `${item.label}，${item.count} 个项目，${item.percent}`);
  bindInteraction(segment, item);
  return segment;
};

const renderChart = (operatorEntry, projects) => {
  const total = projects.length;
  const mix = buildProjectTypeMix(projects);
  const segments = buildDonutSegments(mix, total, RADIUS).map((item) => ({
    ...item,
    percent: formatPercent(item.count, total),
  }));

  dom.operator.textContent = operatorEntry.name;
  dom.total.textContent = total.toLocaleString("zh-CN");
  document.title = `${operatorEntry.name} 项目类型结构`;
  dom.segments.replaceChildren(...segments.map(renderSegment));
  dom.legend.replaceChildren(...segments.map(renderLegendRow));
  dom.state.hidden = true;
};

const loadJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
};

const start = async () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const requestedOperator = (params.get("operator") || "Shell").trim();
    const manifest = await loadJson(`../../maps/operators.json?v=${VERSION}`);
    const operatorEntry = resolveOperator(manifest, requestedOperator);
    if (!operatorEntry) {
      showError(`暂不支持 ${requestedOperator || "该公司"}`);
      return;
    }

    const payload = await loadJson(`../../maps/${operatorEntry.dataFile}?v=${VERSION}`);
    renderChart(operatorEntry, payload.projects || []);
  } catch (error) {
    console.error(error);
    showError("项目类型数据加载失败，请刷新后重试");
  }
};

start();
