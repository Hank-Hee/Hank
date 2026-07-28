import { clean, filterProjects, formatNumber } from "./map-core.js";

const VERSION = "20260728-pilot-v2";

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function listText(values) {
  return Array.isArray(values) && values.length ? values.join("、") : "—";
}

function totalResource(values) {
  if (!Array.isArray(values) || !values.length) return null;
  const total = values.map(Number).filter(Number.isFinite).reduce((sum, value) => sum + value, 0);
  return Number.isFinite(total) ? total : null;
}

function addFact(grid, label, value) {
  const item = element("div");
  item.append(element("small", "", label), element("b", "", value || "—"));
  grid.append(item);
}

function createProjectRow(project) {
  const row = element("article", "project-row");
  const toggle = element("button", "project-toggle");
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.append(
    element("strong", "", clean(project.project) || "未命名项目"),
    element("span", "", [listText(project.lifecycleCategories), listText(project.fieldTypes)].join(" · ")),
  );

  const detail = element("div", "project-detail");
  detail.hidden = true;

  const summaryGrid = element("div", "summary-grid");
  addFact(summaryGrid, "设施类型", listText(project.facilities));
  addFact(summaryGrid, "油气田类型", listText(project.fieldTypes));
  addFact(summaryGrid, "生命周期", listText(project.lifecycleDetails?.length ? project.lifecycleDetails : project.lifecycleCategories));
  addFact(summaryGrid, "供应类型", listText(project.supplySegments));

  const resources = project.resources || {};
  const unit = clean(resources.unit) || "million boe";
  const reserveGrid = element("div", "reserve-grid");
  for (const [key, label] of [["p90", "P90"], ["p50", "P50"], ["pMean", "PMean"], ["prospective", "Prospective"]]) {
    const value = totalResource(resources[key]);
    addFact(reserveGrid, `${label}（${unit}）`, value === null ? "—" : formatNumber(value, 2));
  }

  const factGrid = element("div", "fact-grid");
  addFact(factGrid, "业务区域", listText(project.businessRegions));
  addFact(factGrid, "地理区域", listText(project.regions));
  addFact(factGrid, "水深类别", listText(project.waterDepthCategories));
  addFact(factGrid, "发现年份", listText(project.discoveryYears));
  addFact(factGrid, "投产年份", listText(project.startupYears));
  addFact(factGrid, "权益结构", listText(project.ownerships));

  detail.append(summaryGrid, reserveGrid, factGrid);
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    detail.hidden = expanded;
  });
  row.append(toggle, detail);
  return row;
}

function emit(name, detail = {}) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export async function mountVectorMap(root, options = {}) {
  if (!root) throw new Error("Vector map root is required");
  const summaryUrl = options.summaryUrl || `data/map-summary.json?v=${VERSION}`;
  const detailsUrl = options.detailsUrl || `../../maps/data/exxonmobil.json?v=${VERSION}`;
  const stateNode = root.querySelector("[data-map-state]");
  const markerLayer = root.querySelector("[data-marker-layer]");
  const viewport = root.querySelector("[data-map-viewport]");
  const canvas = root.querySelector("[data-map-canvas]");
  const drawer = root.querySelector("[data-project-drawer]");
  const drawerTitle = root.querySelector("[data-drawer-title]");
  const drawerSummary = root.querySelector("[data-drawer-summary]");
  const drawerClose = root.querySelector("[data-drawer-close]");
  const drawerSearch = root.querySelector("[data-drawer-search]");
  const searchSummary = root.querySelector("[data-search-summary]");
  const projectList = root.querySelector("[data-project-list]");
  if (!stateNode || !markerLayer || !viewport || !canvas || !drawer || !projectList) {
    throw new Error("Vector map markup is incomplete");
  }

  performance.mark("exxon-map-summary-request-start");
  const summary = options.summary || await fetch(summaryUrl, { cache: "force-cache" }).then((response) => {
    if (!response.ok) throw new Error(`Map summary request failed: ${response.status}`);
    return response.json();
  });
  performance.mark("exxon-map-summary-ready");

  root.querySelector("[data-map-operator]").textContent = summary.meta.operator;
  root.querySelector("[data-map-project-count]").textContent = formatNumber(summary.meta.projectCount);
  root.querySelector("[data-map-country-count]").textContent = formatNumber(summary.meta.countryCount);

  let selectedCountry = null;
  let selectedMarker = null;
  let detailsPromise = null;
  let countryProjects = [];
  const markers = [];

  const setSelected = (marker, country) => {
    selectedMarker?.classList.remove("is-selected");
    selectedMarker = marker;
    selectedCountry = country;
    selectedMarker?.classList.add("is-selected");
  };

  const renderProjectList = () => {
    const filtered = filterProjects(countryProjects, drawerSearch.value);
    projectList.replaceChildren(...filtered.map(createProjectRow));
    searchSummary.textContent = drawerSearch.value
      ? `匹配 ${formatNumber(filtered.length)} / ${formatNumber(countryProjects.length)} 个项目`
      : `共 ${formatNumber(countryProjects.length)} 个项目；点击项目名称查看详情`;
    if (!filtered.length) projectList.append(element("p", "empty-state", "没有匹配的项目。"));
  };

  const loadDetails = () => {
    if (!detailsPromise) {
      performance.mark("exxon-map-details-request-start");
      detailsPromise = fetch(detailsUrl, { cache: "default" }).then((response) => {
        if (!response.ok) throw new Error(`Project details request failed: ${response.status}`);
        return response.json();
      }).then((payload) => {
        performance.mark("exxon-map-details-ready");
        emit("exxon:map-details-ready", { projectCount: payload.projects.length });
        return payload;
      });
    }
    return detailsPromise;
  };

  const openCountry = async (country, marker) => {
    setSelected(marker, country);
    drawer.hidden = false;
    drawerSearch.value = "";
    const countryMeta = summary.countries.find((item) => item.country === country);
    drawerTitle.textContent = `${countryMeta?.nameZh || country}项目`;
    drawerSummary.textContent = `${countryMeta?.count || 0} 个项目 · 正在加载详细数据…`;
    projectList.replaceChildren(element("p", "empty-state", "正在按需加载项目详情…"));
    searchSummary.textContent = "首次点击国家时才请求完整项目数据";
    try {
      const payload = await loadDetails();
      if (selectedCountry !== country) return;
      countryProjects = payload.projects.filter((project) => project.country === country);
      drawerSummary.textContent = `${formatNumber(countryProjects.length)} 个项目 · 国家级聚合位置`;
      renderProjectList();
      drawerClose.focus({ preventScroll: true });
    } catch (error) {
      projectList.replaceChildren(element("p", "empty-state", "项目详情加载失败，请刷新后重试。"));
      searchSummary.textContent = error.message;
    }
  };

  for (const country of summary.countries) {
    const marker = element("button", "map-marker", formatNumber(country.count));
    marker.type = "button";
    marker.style.left = `${country.point.x / 10}%`;
    marker.style.top = `${country.point.y / 5}%`;
    marker.dataset.tier = country.count >= 50 ? "large" : country.count >= 10 ? "medium" : "small";
    marker.dataset.country = country.country;
    marker.setAttribute("aria-label", `${country.nameZh}，${country.count} 个项目`);
    marker.title = `${country.nameZh} · ${country.count} 个项目`;
    marker.addEventListener("click", () => openCountry(country.country, marker));
    markerLayer.append(marker);
    markers.push(marker);
  }

  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;

  const clampTranslation = () => {
    const xLimit = viewport.clientWidth * Math.max(0, scale - 1) / 2 + 80;
    const yLimit = viewport.clientHeight * Math.max(0, scale - 1) / 2 + 60;
    translateX = Math.max(-xLimit, Math.min(xLimit, translateX));
    translateY = Math.max(-yLimit, Math.min(yLimit, translateY));
  };
  const updateTransform = () => {
    clampTranslation();
    canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    root.dataset.mapScale = scale.toFixed(2);
  };
  const zoom = (delta) => {
    scale = Math.max(1, Math.min(4, scale + delta));
    if (scale === 1) translateX = translateY = 0;
    updateTransform();
  };
  const reset = () => {
    scale = 1;
    translateX = translateY = 0;
    updateTransform();
  };

  root.querySelector("[data-map-zoom-in]").addEventListener("click", () => zoom(.35));
  root.querySelector("[data-map-zoom-out]").addEventListener("click", () => zoom(-.35));
  root.querySelector("[data-map-reset]").addEventListener("click", reset);
  viewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoom(event.deltaY < 0 ? .25 : -.25);
  }, { passive: false });
  viewport.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".map-marker, .map-controls, .map-legend")) return;
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    originX = translateX;
    originY = translateY;
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    translateX = originX + event.clientX - startX;
    translateY = originY + event.clientY - startY;
    updateTransform();
  });
  const endDrag = () => { dragging = false; };
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
  viewport.addEventListener("keydown", (event) => {
    if (event.key === "+" || event.key === "=") zoom(.35);
    if (event.key === "-") zoom(-.35);
    if (event.key === "0") reset();
    if (event.key === "Escape" && !drawer.hidden) drawerClose.click();
  });

  drawerClose.addEventListener("click", () => {
    drawer.hidden = true;
    selectedMarker?.classList.remove("is-selected");
    const previousMarker = selectedMarker;
    selectedMarker = null;
    selectedCountry = null;
    countryProjects = [];
    previousMarker?.focus({ preventScroll: true });
  });
  drawerSearch.addEventListener("input", renderProjectList);

  stateNode.hidden = true;
  root.dataset.ready = "true";
  performance.mark("exxon-vector-map-ready");
  emit("exxon:vector-map-ready", {
    projectCount: summary.meta.projectCount,
    countryCount: summary.meta.countryCount,
  });
  return { summary, markers, reset, loadDetails };
}
