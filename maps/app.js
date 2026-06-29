(() => {
  "use strict";

  const payload = window.PROJECT_MAP_DATA;
  const emptyState = document.querySelector("#empty-state");
  if (!payload || !window.L) {
    emptyState.hidden = false;
    emptyState.innerHTML = "<strong>地图资源未加载</strong><span>请检查网络连接后刷新页面。</span>";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const requestedOperator = (params.get("operator") || "Shell").trim();
  const operators = [...new Set(payload.projects.map((project) => project.operator))];
  const operator = operators.find((name) => name.toLowerCase() === requestedOperator.toLowerCase()) || requestedOperator;
  const projects = payload.projects.filter((project) => project.operator === operator);

  const countryNames = {
    Brunei: "文莱",
    Malaysia: "马来西亚",
    Thailand: "泰国",
    Indonesia: "印度尼西亚",
    Vietnam: "越南",
    Myanmar: "缅甸",
  };
  const countryConfig = {
    Brunei: { center: [4.62, 114.72], zoom: 7.2 },
    Malaysia: { center: [4.2, 102.0], zoom: 5.7 },
    Thailand: { center: [15.4, 101.0], zoom: 5.8 },
    Indonesia: { center: [-2.1, 118.0], zoom: 4.8 },
    Vietnam: { center: [16.0, 107.8], zoom: 5.5 },
    Myanmar: { center: [20.2, 96.0], zoom: 5.2 },
  };
  const lifecycleNames = {
    Producing: "已投产",
    "Under development": "开发中",
    Discovery: "已发现",
    Undiscovered: "待发现",
    Abandoned: "已废弃",
    Unknown: "未知",
  };

  const dom = {
    operator: document.querySelector("#operator-name"),
    total: document.querySelector("#total-projects"),
    instruction: document.querySelector(".map-instruction"),
    overview: document.querySelector("#overview-button"),
    drawer: document.querySelector("#project-drawer"),
    drawerTitle: document.querySelector("#drawer-title"),
    drawerSummary: document.querySelector("#drawer-summary"),
    drawerClose: document.querySelector("#drawer-close"),
    search: document.querySelector("#project-search"),
    list: document.querySelector("#project-list"),
  };

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const textOrDash = (values, transform = (value) => value) => values?.length ? values.map(transform).join(" / ") : "—";
  const shortProjectName = (name) => name.replace(/,\s*(BN|MY|TH|ID|VN|MM)$/i, "");

  dom.operator.textContent = operator;
  dom.total.textContent = projects.length;
  document.title = `${operator} 项目分布地图`;

  if (!projects.length) {
    emptyState.hidden = false;
    return;
  }

  const map = L.map("map", {
    zoomControl: false,
    minZoom: 3,
    maxZoom: 10,
    zoomSnap: 0.25,
    preferCanvas: true,
    worldCopyJump: true,
  });
  map.setView([8.5, 108.0], 4.25);
  L.control.zoom({ position: "topright" }).addTo(map);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd",
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);

  const countryGroups = Object.values(projects.reduce((groups, project) => {
    if (!groups[project.country]) groups[project.country] = { country: project.country, projects: [] };
    groups[project.country].projects.push(project);
    return groups;
  }, {})).sort((a, b) => b.projects.length - a.projects.length);
  const activeMarkers = new Map();
  let selectedCountry = "";

  const fitOverview = () => {
    const coordinates = countryGroups
      .map(({ country }) => countryConfig[country]?.center)
      .filter(Boolean);
    if (coordinates.length === 1) map.flyTo(coordinates[0], 5.2, { duration: 0.65 });
    else map.flyToBounds(L.latLngBounds(coordinates).pad(0.34), { maxZoom: 5.1, duration: 0.65 });
  };

  const renderProjectList = (country, query = "") => {
    const group = countryGroups.find((item) => item.country === country);
    if (!group) return;
    const needle = query.trim().toLowerCase();
    const visible = group.projects.filter((project) => !needle || project.project.toLowerCase().includes(needle));
    dom.list.innerHTML = visible.length ? visible.map((project, index) => {
      const lifecycle = textOrDash(project.lifecycles, (item) => lifecycleNames[item] || item);
      return `
        <button class="project-row" type="button" data-project-id="${escapeHtml(project.id)}">
          <span class="project-row-main">
            <span class="project-number">${String(index + 1).padStart(2, "0")}</span>
            <span class="project-copy">
              <span class="project-name" title="${escapeHtml(project.project)}">${escapeHtml(shortProjectName(project.project))}</span>
              <span class="project-subtitle">${escapeHtml(lifecycle)} · ${escapeHtml(textOrDash(project.oilGasCategories))}</span>
            </span>
            <span class="project-chevron">›</span>
          </span>
          <span class="project-detail">
            <span><b>生命周期</b>${escapeHtml(lifecycle)}</span>
            <span><b>Oil / Gas 分类</b>${escapeHtml(textOrDash(project.oilGasCategories))}</span>
            <span><b>供应板块</b>${escapeHtml(textOrDash(project.supplySegments))}</span>
            <span><b>设施类型</b>${escapeHtml(textOrDash(project.facilities))}</span>
            <span><b>发现年份</b>${escapeHtml(textOrDash(project.discoveryYears))}</span>
            <span><b>投产年份</b>${escapeHtml(textOrDash(project.startupYears))}</span>
            <span class="wide"><b>Ownership</b>${escapeHtml(textOrDash(project.ownerships))}</span>
          </span>
        </button>`;
    }).join("") : '<div class="project-row"><span class="project-name">没有匹配的项目</span></div>';

    dom.list.querySelectorAll("[data-project-id]").forEach((button) => {
      button.addEventListener("click", () => button.classList.toggle("expanded"));
    });
  };

  const openCountry = (country) => {
    const group = countryGroups.find((item) => item.country === country);
    const config = countryConfig[country];
    if (!group || !config) return;
    selectedCountry = country;
    dom.instruction.classList.add("hidden");
    dom.drawerTitle.textContent = `${countryNames[country] || country}项目`;
    dom.drawerSummary.textContent = `${operator} · ${group.projects.length} 个项目 · 点击项目展开详情`;
    dom.search.value = "";
    renderProjectList(country);
    dom.drawer.classList.add("open");
    dom.drawer.setAttribute("aria-hidden", "false");
    activeMarkers.forEach((marker, markerCountry) => {
      marker.getElement()?.querySelector(".country-cluster")?.classList.toggle("is-active", markerCountry === country);
    });
    const horizontalOffset = window.innerWidth >= 760 ? -0.14 : 0;
    map.flyTo([config.center[0], config.center[1] + horizontalOffset], config.zoom, { duration: 0.7 });
  };

  const closeDrawer = () => {
    selectedCountry = "";
    dom.drawer.classList.remove("open");
    dom.drawer.setAttribute("aria-hidden", "true");
    activeMarkers.forEach((marker) => marker.getElement()?.querySelector(".country-cluster")?.classList.remove("is-active"));
  };

  countryGroups.forEach(({ country, projects: countryProjects }) => {
    const config = countryConfig[country];
    if (!config) return;
    const countryLabel = countryNames[country] || country;
    const clusterWidth = Math.max(92, 58 + countryLabel.length * 16);
    const icon = L.divIcon({
      className: "country-cluster-icon",
      html: `
        <div class="country-cluster" style="--cluster-width:${clusterWidth}px">
          <span class="country-cluster-count">${countryProjects.length}</span>
          <span class="country-cluster-label">${escapeHtml(countryLabel)}</span>
        </div>`,
      iconSize: [clusterWidth, 48],
      iconAnchor: [24, 46],
    });
    const marker = L.marker(config.center, {
      icon,
      title: `${country} · ${countryProjects.length} projects`,
      keyboard: true,
    }).addTo(map);
    marker.bindTooltip(`
      <div class="country-tooltip-card">
        <small>${escapeHtml(operator.toUpperCase())} PROJECTS</small>
        <strong>${escapeHtml(countryLabel)} · ${countryProjects.length} 个项目</strong>
        <span>点击查看全部</span>
      </div>`, { direction: "top", offset: [28, -54], opacity: 1 });
    marker.on("click", () => openCountry(country));
    marker.getElement()?.addEventListener("click", () => openCountry(country));
    activeMarkers.set(country, marker);
  });

  dom.drawerClose.addEventListener("click", closeDrawer);
  dom.search.addEventListener("input", () => renderProjectList(selectedCountry, dom.search.value));
  dom.overview.addEventListener("click", () => {
    closeDrawer();
    fitOverview();
    dom.instruction.classList.remove("hidden");
  });
  map.on("dragstart zoomstart", () => dom.instruction.classList.add("hidden"));
  map.on("click", (event) => {
    if (event.originalEvent?.target?.closest?.(".country-cluster")) return;
  });

  fitOverview();
  window.setTimeout(() => map.invalidateSize(), 120);
})();
