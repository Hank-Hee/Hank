import {
  filterProjectsByRegion,
  formatSearchSummary,
  groupProjectsByCountry,
  normalizeKey,
  resolveOperator,
  searchProjects,
} from "./app-core.js?v=20260709-title-tooltip";

const VERSION = "20260709-title-tooltip";

const dom = {
  operator: document.querySelector("#operator-name"),
  total: document.querySelector("#total-projects"),
  scope: document.querySelector("#map-scope"),
  instruction: document.querySelector(".map-instruction"),
  overview: document.querySelector("#overview-button"),
  drawer: document.querySelector("#project-drawer"),
  drawerTitle: document.querySelector("#drawer-title"),
  drawerSummary: document.querySelector("#drawer-summary"),
  drawerClose: document.querySelector("#drawer-close"),
  search: document.querySelector("#project-search"),
  list: document.querySelector("#project-list"),
  emptyState: document.querySelector("#empty-state"),
};

const lifecycleNames = {
  Producing: "已投产",
  "Under development": "开发中",
  Discovery: "已发现",
  Undiscovered: "待发现",
  Abandoned: "已废弃",
  Unknown: "未知",
};

const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const textOrDash = (values, transform = (value) => value) =>
  values?.length ? values.map(transform).join(" / ") : "—";

const shortProjectName = (name) => name.replace(/,\s*[A-Z]{2,3}$/i, "");

const showState = (title, message) => {
  dom.emptyState.hidden = false;
  dom.emptyState.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
};

const fetchJson = async (url) => {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
};

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const animationDuration = prefersReducedMotion ? 0 : 0.65;

const start = async () => {
  if (!window.L) {
    showState("地图资源未加载", "请检查网络连接后刷新页面。");
    return;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const requestedOperator = (params.get("operator") || "Shell").trim();
    const requestedRegion = (params.get("region") || "").trim();
    const [manifest, centersPayload] = await Promise.all([
      fetch("operators.json?v=20260709-title-tooltip").then((response) => {
        if (!response.ok) throw new Error(`operators.json returned ${response.status}`);
        return response.json();
      }),
      fetch("data/country-centers.json?v=20260709-title-tooltip").then((response) => {
        if (!response.ok) throw new Error(`country-centers.json returned ${response.status}`);
        return response.json();
      }),
    ]);

    const operatorEntry = resolveOperator(manifest, requestedOperator);
    if (!operatorEntry) {
      showState("没有找到该公司的项目", "请检查链接中的 operator 参数。");
      return;
    }

    const matchingRegion = requestedRegion
      ? operatorEntry.businessRegions.find((region) => normalizeKey(region) === normalizeKey(requestedRegion))
      : "";
    if (requestedRegion && !matchingRegion) {
      showState(
        "没有找到该业务区域",
        `可用区域：${operatorEntry.businessRegions.join("、")}`,
      );
      return;
    }

    const companyPayload = await fetchJson(`${operatorEntry.dataFile}?v=${VERSION}`);
    const projects = filterProjectsByRegion(companyPayload.projects, matchingRegion);
    if (!projects.length) {
      showState("没有找到项目", "当前公司和业务区域没有可展示的项目。");
      return;
    }

    const countryGroups = groupProjectsByCountry(projects);
    const countryCenters = centersPayload.countries;
    const missingCountries = countryGroups
      .map(({ country }) => country)
      .filter((country) => !countryCenters[country]);
    if (missingCountries.length) {
      showState("国家定位数据不完整", `缺少：${missingCountries.join("、")}`);
      return;
    }

    dom.operator.textContent = operatorEntry.name;
    dom.total.textContent = projects.length;
    dom.scope.textContent = matchingRegion || "全球展示";
    document.title = `${operatorEntry.name} 项目分布地图`;
    dom.emptyState.hidden = true;

    const map = L.map("map", {
      zoomControl: false,
      minZoom: 1,
      maxZoom: 10,
      zoomSnap: 0.25,
      preferCanvas: true,
      worldCopyJump: true,
    });
    map.setView([18, 12], 2.25);
    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);

    const activeMarkers = new Map();
    let selectedCountry = "";
    let selectedMarker = null;

    const hideInstruction = () => dom.instruction.classList.add("hidden");
    window.setTimeout(hideInstruction, 4000);

    const fitOverview = (animate = true) => {
      const coordinates = countryGroups.map(({ country }) => countryCenters[country].center);
      if (coordinates.length === 1) {
        map.flyTo(coordinates[0], 5.2, { duration: animate ? animationDuration : 0 });
        return;
      }
      const bounds = L.latLngBounds(coordinates);
      map.flyToBounds(bounds, {
        paddingTopLeft: [96, 92],
        paddingBottomRight: [76, 78],
        maxZoom: matchingRegion ? 5.35 : 4.6,
        duration: animate ? animationDuration : 0,
      });
    };

    const renderProjectList = (country, query = "") => {
      const group = countryGroups.find((item) => item.country === country);
      if (!group) return;
      const visible = searchProjects(group.projects, query);
      dom.drawerSummary.textContent = formatSearchSummary(
        operatorEntry.name,
        group.projects.length,
        visible.length,
        query,
      );
      dom.list.innerHTML = visible.length ? visible.map((project, index) => {
        const lifecycle = textOrDash(project.lifecycleCategories, (item) => lifecycleNames[item] || item);
        const sourceOperatorDetail = operatorEntry.name === "ADNOC"
          ? `<span class="wide"><b>运营实体</b>${escapeHtml(textOrDash(project.sourceOperators))}</span>`
          : "";
        return `
          <button class="project-row" type="button" data-project-id="${escapeHtml(project.id)}" aria-expanded="false">
            <span class="project-row-main">
              <span class="project-number">${String(index + 1).padStart(2, "0")}</span>
              <span class="project-copy">
                <span class="project-name" title="${escapeHtml(project.project)}">${escapeHtml(shortProjectName(project.project))}</span>
                <span class="project-subtitle">${escapeHtml(lifecycle)} · ${escapeHtml(textOrDash(project.fieldTypes))}</span>
              </span>
              <span class="project-chevron" aria-hidden="true">›</span>
            </span>
            <span class="project-detail">
              <span class="wide"><b>业务区域</b>${escapeHtml(textOrDash(project.businessRegions))}</span>
              <span><b>生命周期</b>${escapeHtml(lifecycle)}</span>
              <span><b>生命周期明细</b>${escapeHtml(textOrDash(project.lifecycleDetails))}</span>
              <span><b>油气田类型</b>${escapeHtml(textOrDash(project.fieldTypes))}</span>
              <span><b>供应板块</b>${escapeHtml(textOrDash(project.supplySegments))}</span>
              <span><b>设施类型</b>${escapeHtml(textOrDash(project.facilities))}</span>
              <span><b>水深类别</b>${escapeHtml(textOrDash(project.waterDepthCategories))}</span>
              <span><b>发现年份</b>${escapeHtml(textOrDash(project.discoveryYears))}</span>
              <span><b>批准年份</b>${escapeHtml(textOrDash(project.approvalYears))}</span>
              <span><b>投产年份</b>${escapeHtml(textOrDash(project.startupYears))}</span>
              <span class="wide"><b>Ownership</b>${escapeHtml(textOrDash(project.ownerships))}</span>
              ${sourceOperatorDetail}
            </span>
          </button>`;
      }).join("") : '<div class="project-row project-row-empty"><span class="project-name">没有匹配的项目</span></div>';

      dom.list.querySelectorAll("[data-project-id]").forEach((button) => {
        button.addEventListener("click", () => {
          const expanded = !button.classList.contains("expanded");
          button.classList.toggle("expanded", expanded);
          button.setAttribute("aria-expanded", String(expanded));
        });
      });
    };

    const offsetMapForDrawer = () => {
      if (!selectedCountry || !dom.drawer.classList.contains("open")) return;
      const drawerRect = dom.drawer.getBoundingClientRect();
      if (window.innerWidth >= 760) {
        map.panBy([drawerRect.width / 2, 0], { animate: !prefersReducedMotion, duration: 0.35 });
      } else {
        map.panBy([0, drawerRect.height * 0.38], { animate: !prefersReducedMotion, duration: 0.35 });
      }
    };

    const openCountry = (country, marker) => {
      const group = countryGroups.find((item) => item.country === country);
      if (!group) return;
      selectedCountry = country;
      selectedMarker = marker;
      hideInstruction();
      dom.drawerTitle.textContent = `${countryCenters[country].nameZh || country}项目`;
      dom.search.value = "";
      renderProjectList(country);
      dom.drawer.classList.add("open");
      dom.drawer.setAttribute("aria-hidden", "false");
      activeMarkers.forEach((item, markerCountry) => {
        item.getElement()?.querySelector(".country-dot")?.classList.toggle("is-active", markerCountry === country);
      });
      map.flyTo(countryCenters[country].center, 5.4, { duration: animationDuration });
      window.setTimeout(offsetMapForDrawer, prefersReducedMotion ? 0 : 720);
    };

    const closeDrawer = ({ restoreFocus = true } = {}) => {
      const markerToFocus = selectedMarker;
      selectedCountry = "";
      selectedMarker = null;
      dom.drawer.classList.remove("open");
      dom.drawer.setAttribute("aria-hidden", "true");
      activeMarkers.forEach((marker) => marker.getElement()?.querySelector(".country-dot")?.classList.remove("is-active"));
      if (restoreFocus) window.setTimeout(() => markerToFocus?.getElement()?.focus(), 0);
    };

    countryGroups.forEach(({ country, projects: countryProjects }) => {
      const countryConfig = countryCenters[country];
      const countryLabel = countryConfig.nameZh || country;
      const dotSize = Math.round(Math.min(44, Math.max(30, 28 + Math.sqrt(countryProjects.length) * 2.2)));
      const icon = L.divIcon({
        className: "country-dot-icon",
        html: `
          <div class="country-dot" style="--dot-size:${dotSize}px" aria-label="${escapeHtml(countryLabel)} · ${countryProjects.length} 个项目">
            <span class="country-dot-count">${countryProjects.length}</span>
          </div>`,
        iconSize: [dotSize, dotSize],
        iconAnchor: [dotSize / 2, dotSize / 2],
      });
      const marker = L.marker(countryConfig.center, {
        icon,
        title: `${countryLabel} · ${countryProjects.length} 个项目`,
        keyboard: true,
      }).addTo(map);
      marker.bindTooltip(`
        <div class="country-tooltip-card">
          <small>${escapeHtml(operatorEntry.name.toUpperCase())} PROJECTS</small>
          <strong>${escapeHtml(countryLabel)} · ${countryProjects.length} 个项目</strong>
          <span>点击查看全部</span>
        </div>`, { direction: "top", offset: [0, -dotSize / 2 - 10], opacity: 1 });
      marker.on("click", () => openCountry(country, marker));
      activeMarkers.set(country, marker);
    });

    dom.drawerClose.addEventListener("click", () => closeDrawer());
    dom.search.addEventListener("input", () => renderProjectList(selectedCountry, dom.search.value));
    dom.overview.addEventListener("click", () => {
      closeDrawer({ restoreFocus: false });
      fitOverview();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && dom.drawer.classList.contains("open")) closeDrawer();
    });
    map.on("dragstart zoomstart", hideInstruction);
    window.addEventListener("resize", () => {
      map.invalidateSize();
      if (selectedCountry) offsetMapForDrawer();
      else fitOverview(false);
    });

    fitOverview(false);
    window.setTimeout(() => map.invalidateSize(), 120);
  } catch (error) {
    console.error(error);
    showState("地图数据未加载", "请检查网络连接后刷新页面。");
  }
};

start();
