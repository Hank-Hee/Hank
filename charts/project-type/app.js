import {
  buildDonutSegments,
  buildProjectTypeMix,
  formatPercent,
  resolveOperator,
} from "./chart-core.js?v=20260721-ui-v2-production";

const VERSION = "20260721-ui-v2-production";
const SVG_NS = "http://www.w3.org/2000/svg";
const CENTER = { x: 120, y: 120 };
const RADIUS = 100;
const IS_EN = new URLSearchParams(window.location.search).get("lang") === "en";
const tr = (chinese, english) => IS_EN ? english : chinese;
const displayLabel = (item) => IS_EN ? item.englishLabel : item.label;
const displayDescription = (item) => IS_EN ? item.englishDescription || "" : item.description || "";
document.documentElement.lang = IS_EN ? "en" : "zh-CN";

if (IS_EN) {
  document.title = "Project mix";
  document.querySelector("#chart-title").lastChild.textContent = " Project mix";
  document.querySelector(".chart-heading p").textContent = "Grouped by primary project type";
  document.querySelector(".header-total").lastChild.textContent = " projects";
  document.querySelector("#chart-description").textContent = "Donut chart of company projects by field type";
  document.querySelector(".donut-unit").textContent = "Total projects";
  document.querySelector("#project-type-legend").setAttribute("aria-label", "Project type legend");
  document.querySelectorAll(".tooltip-metrics small")[0].textContent = "Projects";
  document.querySelectorAll(".tooltip-metrics small")[1].textContent = "Share";
  document.querySelector("#chart-state strong").textContent = "Loading project data";
}

const dom = {
  card: document.querySelector(".dashboard-card"),
  operator: document.querySelector("#operator-name"),
  headerTotal: document.querySelector("#header-total"),
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
  const note = dom.tooltip.querySelector(".tooltip-note");
  const count = dom.tooltip.querySelector(".tooltip-count");
  const percent = dom.tooltip.querySelector(".tooltip-percent");
  swatch.style.setProperty("--segment-color", item.color);
  label.textContent = displayLabel(item);
  english.textContent = IS_EN ? "" : item.englishLabel;
  note.textContent = displayDescription(item);
  note.hidden = !displayDescription(item);
  count.textContent = tr(`${item.count} 个`, `${item.count}`);
  percent.textContent = item.percent;
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
  row.setAttribute("aria-label", tr(`${item.label}，项目数量 ${item.count} 个，项目占比 ${item.percent}${item.description ? `，${item.description}` : ""}`, `${item.englishLabel}, ${item.count} projects, ${item.percent}${displayDescription(item) ? `, ${displayDescription(item)}` : ""}`));
  row.innerHTML = `
    <span class="legend-swatch" aria-hidden="true"></span>
    <span class="legend-copy"><strong></strong><small></small></span>
    <span class="legend-metrics">
      <span class="legend-count"></span>
      <span class="legend-percent"></span>
    </span>`;
  row.style.setProperty("--segment-color", item.color);
  row.querySelector("strong").textContent = displayLabel(item);
  row.querySelector("small").textContent = IS_EN ? "" : item.englishLabel;
  row.querySelector(".legend-count").textContent = tr(`${item.count} 个项目`, `${item.count} projects`);
  row.querySelector(".legend-percent").textContent = tr(`占比 ${item.percent}`, `${item.percent}`);
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
  segment.setAttribute("aria-label", tr(`${item.label}，项目数量 ${item.count} 个，项目占比 ${item.percent}${item.description ? `，${item.description}` : ""}`, `${item.englishLabel}, ${item.count} projects, ${item.percent}${displayDescription(item) ? `, ${displayDescription(item)}` : ""}`));
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
  dom.total.textContent = total.toLocaleString(IS_EN ? "en-US" : "zh-CN");
  dom.headerTotal.textContent = total.toLocaleString(IS_EN ? "en-US" : "zh-CN");
  document.title = tr(`${operatorEntry.name} 项目类型结构`, `${operatorEntry.name} Project Mix`);
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
      showError(tr(`暂不支持 ${requestedOperator || "该公司"}`, `${requestedOperator || "This company"} is not supported`));
      return;
    }

    const payload = await loadJson(`../../maps/${operatorEntry.dataFile}?v=${VERSION}`);
    renderChart(operatorEntry, payload.projects || []);
  } catch (error) {
    console.error(error);
    showError(tr("项目类型数据加载失败，请刷新后重试", "Project type data failed to load. Refresh to retry."));
  }
};

start();
