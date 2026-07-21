import {
  countActiveFilters,
  filterProjects,
  filterProjectsByRegion,
  formatSearchSummary,
  getFacilityOptions,
  getResourceFilterCounts,
  groupProjectsByCountry,
  hasResourceData,
  normalizeKey,
  resolveOperator,
} from "./app-core.js?v=20260721-ui-v3-no-header-actions";

const VERSION = `20260721-ui-v3-no-header-actions`;
const DATA_ROOT = `.`;

const dom = {
  operator: document.querySelector(`#operator-name`),
  total: document.querySelector(`#total-projects`),
  countryCount: document.querySelector(`#country-count`),
  scope: document.querySelector(`#map-scope`),
  overview: document.querySelector(`#overview-button`),
  drawer: document.querySelector(`#project-drawer`),
  drawerToggle: document.querySelector(`#drawer-toggle`),
  drawerToggleLabel: document.querySelector(`#drawer-toggle-label`),
  drawerKicker: document.querySelector(`#drawer-kicker`),
  drawerTitle: document.querySelector(`#drawer-title`),
  drawerSummary: document.querySelector(`#drawer-summary`),
  drawerClose: document.querySelector(`#drawer-close`),
  drawerContent: document.querySelector(`#drawer-content`),
  search: document.querySelector(`#project-search`),
  filterToggle: document.querySelector(`#project-filter-toggle`),
  filterCount: document.querySelector(`#project-filter-count`),
  filterPanel: document.querySelector(`#project-filter-panel`),
  filterClear: document.querySelector(`#project-filter-clear`),
  facilityOptions: document.querySelector(`#facility-filter-options`),
  resourceOptions: document.querySelector(`#resource-filter-options`),
  listView: document.querySelector(`#project-list-view`),
  list: document.querySelector(`#project-list`),
  detailView: document.querySelector(`#project-detail-view`),
  detailBack: document.querySelector(`#project-detail-back`),
  detailContent: document.querySelector(`#project-detail-content`),
  emptyState: document.querySelector(`#empty-state`),
};

const lifecycleNames = {
  Producing: `已投产`,
  "Under development": `开发中`,
  Discovery: `已发现`,
  Undiscovered: `待发现`,
  Abandoned: `已废弃`,
  Unknown: `未知`,
};

const resourceMetrics = [
  { key: `p90`, label: `P90` },
  { key: `p50`, label: `P50` },
  { key: `pMean`, label: `P Mean` },
  { key: `prospective`, label: `Prospective` },
];

const resourceFilterOptions = [
  { mode: `all`, label: `全部` },
  { mode: `any`, label: `有任一储量数据` },
  { mode: `p90`, label: `有 P90` },
  { mode: `p50`, label: `有 P50` },
  { mode: `pmean`, label: `有 P Mean` },
  { mode: `prospective`, label: `有 Prospective` },
  { mode: `none`, label: `无储量数据` },
];

const escapeHtml = (value) => String(value ?? ``)
  .replaceAll(`&`, `&amp;`)
  .replaceAll(`<`, `&lt;`)
  .replaceAll(`>`, `&gt;`)
  .replaceAll('"', `&quot;`)
  .replaceAll(`'`, `&#039;`);

const textOrDash = (values, transform = (value) => value) =>
  values?.length ? values.map(transform).join(` / `) : `—`;

const shortProjectName = (name) => String(name ?? ``).replace(/,\s*[A-Z]{2,3}$/i, ``);

const resourceNumberFormatter = new Intl.NumberFormat(`zh-CN`, {
  maximumFractionDigits: 2,
  useGrouping: true,
});

const formatResourceNumber = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return `—`;
  const displayValue = Math.abs(number) < 0.005 ? 0 : number;
  return resourceNumberFormatter.format(displayValue);
};

const resourceUnitName = (unit) => unit === `million bbl` ? `百万桶` : (unit || `百万桶`);

const getResourceMetricDisplay = (values, rawCount) => {
  const numbers = (values || []).map(Number).filter(Number.isFinite).sort((left, right) => left - right);
  if (!numbers.length) return { value: `—`, note: `暂无数据`, empty: true };
  const recordCount = Number.isInteger(rawCount) && rawCount > 0 ? rawCount : numbers.length;
  const minimum = formatResourceNumber(numbers[0]);
  const maximum = formatResourceNumber(numbers[numbers.length - 1]);
  return {
    value: minimum === maximum ? minimum : `${minimum}–${maximum}`,
    note: recordCount === 1 ? `1 条原始数据` : `共 ${recordCount} 条原始数据`,
    empty: false,
  };
};

const showState = (title, message) => {
  dom.emptyState.hidden = false;
  dom.emptyState.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
};

const fetchJson = async (url) => {
  const response = await fetch(url, { cache: `no-cache` });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
};

const prefersReducedMotion = window.matchMedia(`(prefers-reduced-motion: reduce)`).matches;
const animationDuration = prefersReducedMotion ? 0 : 0.65;

const start = async () => {
  if (!window.L) {
    showState(`地图资源未加载`, `请检查网络连接后刷新页面。`);
    return;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const requestedOperator = (params.get(`operator`) || `Shell`).trim();
    const requestedRegion = (params.get(`region`) || ``).trim();
    const [manifest, centersPayload] = await Promise.all([
      fetch(`${DATA_ROOT}/operators.json?v=${VERSION}`).then((response) => {
        if (!response.ok) throw new Error(`operators.json returned ${response.status}`);
        return response.json();
      }),
      fetch(`${DATA_ROOT}/data/country-centers.json?v=${VERSION}`).then((response) => {
        if (!response.ok) throw new Error(`country-centers.json returned ${response.status}`);
        return response.json();
      }),
    ]);

    const operatorEntry = resolveOperator(manifest, requestedOperator);
    if (!operatorEntry) {
      showState(`没有找到该公司的项目`, `请检查链接中的 operator 参数。`);
      return;
    }

    const matchingRegion = requestedRegion
      ? operatorEntry.businessRegions.find((region) => normalizeKey(region) === normalizeKey(requestedRegion))
      : ``;
    if (requestedRegion && !matchingRegion) {
      showState(
        `没有找到该业务区域`,
        `可用区域：${operatorEntry.businessRegions.join(`、`)}`,
      );
      return;
    }

    const companyPayload = await fetchJson(`${DATA_ROOT}/${operatorEntry.dataFile}?v=${VERSION}`);
    const projects = filterProjectsByRegion(companyPayload.projects, matchingRegion);
    if (!projects.length) {
      showState(`没有找到项目`, `当前公司和业务区域没有可展示的项目。`);
      return;
    }

    const countryGroups = groupProjectsByCountry(projects);
    const countryCenters = centersPayload.countries;
    const missingCountries = countryGroups
      .map(({ country }) => country)
      .filter((country) => !countryCenters[country]);
    if (missingCountries.length) {
      showState(`国家定位数据不完整`, `缺少：${missingCountries.join(`、`)}`);
      return;
    }

    dom.operator.textContent = operatorEntry.name;
    dom.total.textContent = projects.length;
    dom.countryCount.textContent = countryGroups.length;
    dom.scope.textContent = matchingRegion || `全球展示`;
    document.title = `${operatorEntry.name} 项目分布地图`;
    dom.emptyState.hidden = true;

    const map = L.map(`map`, {
      zoomControl: false,
      minZoom: 1,
      maxZoom: 10,
      zoomSnap: 0.25,
      preferCanvas: true,
      worldCopyJump: true,
    });
    map.setView([18, 12], 2.25);
    L.control.zoom({ position: `topright` }).addTo(map);
    L.tileLayer(`https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`, {
      subdomains: `abcd`,
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);

    const activeMarkers = new Map();
    const filters = {
      query: ``,
      facilities: new Set(),
      reserveMode: `all`,
    };
    let selectedCountry = ``;
    let selectedMarker = null;
    let lastProjectId = ``;
    let listScrollTop = 0;

    const hideInstruction = () => {};

    const getCountryGroup = (country = selectedCountry) =>
      countryGroups.find((item) => item.country === country);

    const countryDisplayName = (country = selectedCountry) =>
      countryCenters[country]?.nameZh || country;

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

    const updateFilterBadge = () => {
      const count = countActiveFilters(filters);
      dom.filterCount.hidden = count === 0;
      dom.filterCount.textContent = String(count);
      dom.filterToggle.setAttribute(
        `aria-label`,
        count ? `筛选，已选择 ${count} 个条件` : `筛选项目`,
      );
    };

    const renderFacilityFilters = (countryProjects) => {
      const options = getFacilityOptions(countryProjects);
      dom.facilityOptions.innerHTML = options.length
        ? options.map((facility, index) => {
          const checked = [...filters.facilities].some(
            (selected) => normalizeKey(selected) === normalizeKey(facility),
          );
          return `
            <label class="filter-option" for="facility-filter-${index}">
              <input id="facility-filter-${index}" type="checkbox" value="${escapeHtml(facility)}" ${checked ? `checked` : ``} />
              <span>${escapeHtml(facility)}</span>
            </label>`;
        }).join(``)
        : '<span class="filter-empty">暂无设施类型</span>';

      dom.facilityOptions.querySelectorAll(`input[type="checkbox"]`).forEach((input) => {
        input.addEventListener(`change`, () => {
          if (input.checked) filters.facilities.add(input.value);
          else {
            [...filters.facilities].forEach((value) => {
              if (normalizeKey(value) === normalizeKey(input.value)) filters.facilities.delete(value);
            });
          }
          renderProjectList(selectedCountry);
        });
      });
    };

    const renderResourceFilters = (countryProjects) => {
      const counts = getResourceFilterCounts(countryProjects);
      dom.resourceOptions.innerHTML = resourceFilterOptions.map(({ mode, label }, index) => {
        const count = counts[mode] || 0;
        const disabled = mode !== `all` && count === 0;
        return `
          <label class="filter-option" for="resource-filter-${index}">
            <input
              id="resource-filter-${index}"
              type="radio"
              name="resource-filter"
              value="${mode}"
              ${filters.reserveMode === mode ? `checked` : ``}
              ${disabled ? `disabled` : ``}
            />
            <span>${escapeHtml(label)} <em>（${count}）</em></span>
          </label>`;
      }).join(``);

      dom.resourceOptions.querySelectorAll(`input[name="resource-filter"]`).forEach((input) => {
        input.addEventListener(`change`, () => {
          if (!input.checked) return;
          filters.reserveMode = input.value;
          renderProjectList(selectedCountry);
        });
      });
    };

    const renderFilterControls = (countryProjects) => {
      renderFacilityFilters(countryProjects);
      renderResourceFilters(countryProjects);
      updateFilterBadge();
    };

    const renderProjectList = (country) => {
      const group = getCountryGroup(country);
      if (!group) return;
      const visible = filterProjects(group.projects, filters);
      dom.drawerKicker.textContent = `COUNTRY PROJECTS`;
      dom.drawerTitle.textContent = `${countryDisplayName(country)}项目`;
      dom.drawerSummary.textContent = formatSearchSummary(
        operatorEntry.name,
        group.projects.length,
        visible.length,
        filters,
      );
      updateFilterBadge();

      dom.list.innerHTML = visible.length ? visible.map((project, index) => {
        const lifecycle = textOrDash(project.lifecycleCategories, (item) => lifecycleNames[item] || item);
        const facility = textOrDash(project.facilities);
        const fieldType = textOrDash(project.fieldTypes);
        const resourceStatus = hasResourceData(project, `any`) ? `有储量数据` : `暂无储量数据`;
        return `
          <button class="project-row" type="button" data-project-id="${escapeHtml(project.id)}" aria-label="查看 ${escapeHtml(project.project)} 详情">
            <span class="project-number">${String(index + 1).padStart(2, `0`)}</span>
            <span class="project-copy">
              <span class="project-name" title="${escapeHtml(project.project)}">${escapeHtml(shortProjectName(project.project))}</span>
              <span class="project-secondary">
                <span title="${escapeHtml(facility)}">${escapeHtml(facility)}</span>
                <span>${escapeHtml(lifecycle)}</span>
              </span>
            </span>
            <span class="project-attributes">
              <span class="data-tag type" title="${escapeHtml(fieldType)}">${escapeHtml(fieldType)}</span>
              <span class="data-tag ${hasResourceData(project, `any`) ? `available` : `unavailable`}">${resourceStatus}</span>
            </span>
            <span class="project-chevron" aria-hidden="true">›</span>
          </button>`;
      }).join(``) : '<div class="project-row project-row-empty"><span class="project-name">没有匹配的项目</span></div>';

      dom.list.querySelectorAll(`[data-project-id]`).forEach((button) => {
        button.addEventListener(`click`, () => {
          const project = group.projects.find((item) => item.id === button.dataset.projectId);
          if (project) openProjectDetail(project);
        });
      });
    };

    const renderDetailField = (label, values, { wide = false, transform } = {}) => `
      <div class="fact-item${wide ? ` wide` : ``}">
        <span class="fact-label">${escapeHtml(label)}</span>
        <span class="fact-value">${escapeHtml(textOrDash(values, transform))}</span>
      </div>`;

    const renderSummaryItem = (label, value) => `
      <div class="summary-item">
        <span class="summary-label">${escapeHtml(label)}</span>
        <span class="summary-value" title="${escapeHtml(value)}">${escapeHtml(value)}</span>
      </div>`;

    const renderProjectDetail = (project) => {
      const resources = project.resources || {};
      const metrics = resourceMetrics.map(({ key, label }) => {
        const display = getResourceMetricDisplay(resources[key], resources.rawCounts?.[key]);
        return `
          <div class="reserve-kpi${display.empty ? ` is-empty` : ``}">
            <span class="reserve-name">${label}</span>
            <span class="reserve-value">${escapeHtml(display.value)}</span>
            <span class="reserve-note">${escapeHtml(display.note)}</span>
          </div>`;
      }).join(``);
      const lifecycle = textOrDash(project.lifecycleCategories, (item) => lifecycleNames[item] || item);
      const facilities = textOrDash(project.facilities);
      const fieldTypes = textOrDash(project.fieldTypes);
      const supplySegments = textOrDash(project.supplySegments);
      const showSourceOperator = (project.sourceOperators || []).some(
        (operator) => normalizeKey(operator) !== normalizeKey(operatorEntry.name),
      );

      dom.detailContent.innerHTML = `
        <div class="project-detail-hero">
          <h3>${escapeHtml(project.project)}</h3>
          <p>${escapeHtml(countryDisplayName(project.country))} · ${escapeHtml(operatorEntry.name)} · ${escapeHtml(lifecycle)}</p>
        </div>

        <div class="project-summary-grid">
          ${renderSummaryItem(`设施类型`, facilities)}
          ${renderSummaryItem(`油气田类型`, fieldTypes)}
          ${renderSummaryItem(`生命周期`, lifecycle)}
          ${renderSummaryItem(`供应板块`, supplySegments)}
        </div>

        <section class="reserve-section">
          <div class="section-title-row">
            <h4>储量</h4>
            <span class="section-unit">单位：${escapeHtml(resourceUnitName(resources.unit))}</span>
          </div>
          <div class="reserve-grid">${metrics}</div>
        </section>

        <section class="project-facts">
          <div class="section-title-row"><h4>项目资料</h4></div>
          <div class="fact-grid">
            ${renderDetailField(`发现年份`, project.discoveryYears)}
            ${renderDetailField(`投产年份`, project.startupYears)}
            ${renderDetailField(`水深类别`, project.waterDepthCategories)}
            ${renderDetailField(`生命周期明细`, project.lifecycleDetails)}
            ${renderDetailField(`业务区域`, project.businessRegions)}
            ${renderDetailField(`Ownership`, project.ownerships, { wide: true })}
            ${showSourceOperator ? renderDetailField(`运营实体`, project.sourceOperators, { wide: true }) : ``}
          </div>
        </section>`;
    };

    const openProjectDetail = (project) => {
      lastProjectId = project.id;
      listScrollTop = dom.list.scrollTop;
      dom.filterPanel.hidden = true;
      dom.filterToggle.setAttribute(`aria-expanded`, `false`);
      dom.drawerKicker.textContent = `PROJECT DETAILS`;
      dom.drawerTitle.textContent = `项目详情`;
      dom.drawerSummary.textContent = `${countryDisplayName(project.country)} · ${operatorEntry.name}`;
      renderProjectDetail(project);
      dom.listView.hidden = true;
      dom.detailView.hidden = false;
      dom.detailView.scrollTop = 0;
      window.setTimeout(() => dom.detailBack.focus(), 0);
    };

    const showProjectList = ({ restoreFocus = true } = {}) => {
      dom.detailView.hidden = true;
      dom.listView.hidden = false;
      renderProjectList(selectedCountry);
      dom.list.scrollTop = listScrollTop;
      if (!restoreFocus) return;
      window.setTimeout(() => {
        const trigger = [...dom.list.querySelectorAll(`[data-project-id]`)]
          .find((button) => button.dataset.projectId === lastProjectId);
        (trigger || dom.search).focus();
      }, 0);
    };

    const resetFilters = () => {
      filters.query = ``;
      filters.facilities.clear();
      filters.reserveMode = `all`;
      dom.search.value = ``;
    };

    const closeFilterPanel = () => {
      dom.filterPanel.hidden = true;
      dom.filterToggle.setAttribute(`aria-expanded`, `false`);
    };

    const offsetMapForDrawer = () => {
      if (!selectedCountry || !dom.drawer.classList.contains(`open`)) return;
      const mapRect = map.getContainer().getBoundingClientRect();
      const drawerRect = dom.drawer.getBoundingClientRect();
      const actual = map.latLngToContainerPoint(countryCenters[selectedCountry].center);
      let desired;

      if (window.innerWidth >= 760) {
        const visibleWidth = Math.max(160, Math.min(mapRect.width, drawerRect.left - mapRect.left));
        desired = L.point(visibleWidth / 2, mapRect.height / 2);
      } else {
        const visibleHeight = Math.max(120, Math.min(mapRect.height, drawerRect.top - mapRect.top));
        desired = L.point(mapRect.width / 2, visibleHeight / 2);
      }

      const delta = actual.subtract(desired);
      if (Math.abs(delta.x) > 1 || Math.abs(delta.y) > 1) {
        map.panBy(delta, { animate: !prefersReducedMotion, duration: 0.35 });
      }
    };

    const focusCountryForDrawer = (country) => {
      map.flyTo(countryCenters[country].center, 5.4, { duration: animationDuration });
      window.setTimeout(offsetMapForDrawer, prefersReducedMotion ? 0 : 720);
    };

    const setDrawerExpanded = (expanded) => {
      dom.drawer.classList.toggle(`collapsed`, !expanded);
      dom.drawerToggle.setAttribute(`aria-expanded`, String(expanded));
      dom.drawerToggleLabel.textContent = expanded
        ? `收起项目面板`
        : `展开${countryDisplayName()}项目`;
      window.setTimeout(offsetMapForDrawer, prefersReducedMotion ? 0 : 340);
    };

    const openCountry = (country, marker) => {
      const group = getCountryGroup(country);
      if (!group) return;
      selectedCountry = country;
      selectedMarker = marker;
      lastProjectId = ``;
      hideInstruction();
      resetFilters();
      closeFilterPanel();
      dom.detailView.hidden = true;
      dom.listView.hidden = false;
      dom.drawer.classList.add(`open`);
      dom.drawer.setAttribute(`aria-hidden`, `false`);
      setDrawerExpanded(true);
      renderFilterControls(group.projects);
      renderProjectList(country);
      activeMarkers.forEach((item, markerCountry) => {
        item.getElement()?.querySelector(`.country-dot`)?.classList.toggle(`is-active`, markerCountry === country);
      });
      focusCountryForDrawer(country);
    };

    const closeDrawer = ({ restoreFocus = true } = {}) => {
      const markerToFocus = selectedMarker;
      selectedCountry = ``;
      selectedMarker = null;
      lastProjectId = ``;
      closeFilterPanel();
      dom.drawer.classList.remove(`open`, `collapsed`);
      dom.drawer.setAttribute(`aria-hidden`, `true`);
      activeMarkers.forEach((marker) => marker.getElement()?.querySelector(`.country-dot`)?.classList.remove(`is-active`));
      if (restoreFocus) window.setTimeout(() => markerToFocus?.getElement()?.focus(), 0);
    };

    const summarizeFieldTypes = (countryProjects) => {
      const counts = new Map();
      countryProjects.forEach((project) => {
        (project.fieldTypes || []).forEach((fieldType) => {
          counts.set(fieldType, (counts.get(fieldType) || 0) + 1);
        });
      });
      return [...counts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 2)
        .map(([fieldType]) => fieldType)
        .join(` / `) || `暂无类型数据`;
    };

    countryGroups.forEach(({ country, projects: countryProjects }) => {
      const countryConfig = countryCenters[country];
      const countryLabel = countryConfig.nameZh || country;
      const dotSize = Math.round(Math.min(44, Math.max(30, 28 + Math.sqrt(countryProjects.length) * 2.2)));
      const tier = countryProjects.length >= 50 ? 4 : countryProjects.length >= 10 ? 3 : countryProjects.length >= 3 ? 2 : 1;
      const mainTypes = summarizeFieldTypes(countryProjects);
      const icon = L.divIcon({
        className: `country-dot-icon`,
        html: `
          <div class="country-dot tier-${tier}" style="--dot-size:${dotSize}px" aria-label="${escapeHtml(countryLabel)} · ${countryProjects.length} 个项目">
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
          <span class="tooltip-types">主要类型：${escapeHtml(mainTypes)}</span>
          <span>点击查看全部</span>
        </div>`, { direction: `top`, offset: [0, -dotSize / 2 - 10], opacity: 1 });
      marker.on(`click`, () => openCountry(country, marker));
      activeMarkers.set(country, marker);
    });

    dom.drawerClose.addEventListener(`click`, () => closeDrawer());
    dom.drawerToggle.addEventListener(`click`, () => {
      setDrawerExpanded(dom.drawer.classList.contains(`collapsed`));
    });
    dom.detailBack.addEventListener(`click`, () => showProjectList());
    dom.search.addEventListener(`input`, () => {
      filters.query = dom.search.value;
      renderProjectList(selectedCountry);
    });
    dom.filterToggle.addEventListener(`click`, () => {
      const open = dom.filterPanel.hidden;
      dom.filterPanel.hidden = !open;
      dom.filterToggle.setAttribute(`aria-expanded`, String(open));
    });
    dom.filterClear.addEventListener(`click`, () => {
      const group = getCountryGroup();
      if (!group) return;
      resetFilters();
      renderFilterControls(group.projects);
      renderProjectList(selectedCountry);
    });
    dom.overview.addEventListener(`click`, () => {
      closeDrawer({ restoreFocus: false });
      fitOverview();
    });
    document.addEventListener(`keydown`, (event) => {
      if (event.key === `Escape` && dom.drawer.classList.contains(`open`)) closeDrawer();
    });
    map.on(`dragstart zoomstart`, hideInstruction);
    window.addEventListener(`resize`, () => {
      map.invalidateSize();
      if (selectedCountry) window.requestAnimationFrame(offsetMapForDrawer);
      else fitOverview(false);
    });

    fitOverview(false);
    window.setTimeout(() => map.invalidateSize(), 120);
  } catch (error) {
    console.error(error);
    showState(`地图数据未加载`, `请检查网络连接后刷新页面。`);
  }
};

start();
