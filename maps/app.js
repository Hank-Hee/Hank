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
const pageParams = new URLSearchParams(window.location.search);
const IS_EN = pageParams.get(`lang`) === `en`;
const tr = (chinese, english) => IS_EN ? english : chinese;
document.documentElement.lang = IS_EN ? `en` : `zh-CN`;

const businessRegionEnglish = {
  "东南亚": `Southeast Asia`, "中东及南亚": `Middle East and South Asia`,
  "中南美洲": `Central and South America`, "中国及东北亚": `China and Northeast Asia`,
  "俄罗斯/独联体": `Russia / CIS`, "全球/跨区域": `Global / Cross-regional`,
  "加勒比": `Caribbean`, "加拿大": `Canada`, "北美其他": `Other North America`,
  "北非/北欧": `North Africa / Northern Europe`, "地中海/南欧": `Mediterranean / Southern Europe`,
  "墨西哥湾": `Gulf of Mexico`, "巴西": `Brazil`, "欧洲其他": `Other Europe`,
  "澳大利亚/新西兰": `Australia / New Zealand`, "非洲": `Africa`,
};
const localizeValues = (values) => IS_EN ? values?.map((value) => businessRegionEnglish[value] || value) : values;

if (IS_EN) {
  document.title = `Company global project distribution`;
  document.querySelector(`.chart-heading h1`).lastChild.textContent = ` Global project distribution`;
  document.querySelector(`.chart-heading p`).textContent = `Projects grouped by location; bubble size represents project count`;
  document.querySelector(`.map-stage`).setAttribute(`aria-label`, `Interactive company project distribution map`);
  document.querySelector(`#overview-button`).setAttribute(`aria-label`, `Return to regional overview`);
  document.querySelector(`#overview-button`).setAttribute(`title`, `Return to regional overview`);
  document.querySelector(`#overview-button span`).textContent = `Regional overview`;
  document.querySelector(`#project-drawer`).setAttribute(`aria-label`, `Country project list`);
  document.querySelector(`#drawer-toggle-label`).textContent = `Collapse project panel`;
  document.querySelector(`#drawer-title`).textContent = `Project list`;
  document.querySelector(`#drawer-close`).setAttribute(`aria-label`, `Close project list`);
  document.querySelector(`#project-search`).setAttribute(`placeholder`, `Search project name`);
  document.querySelector(`#project-filter-toggle > span:not([hidden])`).textContent = `Filters`;
  document.querySelector(`#project-filter-panel`).setAttribute(`aria-label`, `Project filters`);
  document.querySelector(`.filter-panel-head strong`).textContent = `Filter projects`;
  document.querySelector(`#project-filter-clear`).textContent = `Clear all`;
  document.querySelectorAll(`#project-filter-panel legend`)[0].textContent = `Facility type`;
  document.querySelectorAll(`#project-filter-panel legend`)[1].textContent = `Reserves`;
  document.querySelector(`#project-detail-back`).lastChild.textContent = ` Back to project list`;
  document.querySelector(`.map-legend span:last-child`).textContent = `Marker numbers represent project count`;
  document.querySelector(`#empty-state strong`).textContent = `Loading map data`;
  document.querySelector(`#empty-state span`).textContent = `Please wait.`;
  document.querySelector(`.map-footer span:first-child`).innerHTML = `Total projects <strong id="total-projects">0</strong> · Countries/regions <strong id="country-count">0</strong>`;
  document.querySelector(`#map-scope`).textContent = `Global view`;
}

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
  Producing: tr(`已投产`, `Producing`),
  "Under development": tr(`开发中`, `Under development`),
  Discovery: tr(`已发现`, `Discovery`),
  Undiscovered: tr(`待发现`, `Undiscovered`),
  Abandoned: tr(`已废弃`, `Abandoned`),
  Unknown: tr(`未知`, `Unknown`),
};

const resourceMetrics = [
  { key: `p90`, label: `P90` },
  { key: `p50`, label: `P50` },
  { key: `pMean`, label: `P Mean` },
  { key: `prospective`, label: `Prospective` },
];

const resourceFilterOptions = [
  { mode: `all`, label: tr(`全部`, `All`) },
  { mode: `any`, label: tr(`有任一储量数据`, `Any reserves data`) },
  { mode: `p90`, label: tr(`有 P90`, `Has P90`) },
  { mode: `p50`, label: tr(`有 P50`, `Has P50`) },
  { mode: `pmean`, label: tr(`有 P Mean`, `Has P Mean`) },
  { mode: `prospective`, label: tr(`有 Prospective`, `Has Prospective`) },
  { mode: `none`, label: tr(`无储量数据`, `No reserves data`) },
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

const resourceUnitName = (unit) => IS_EN ? (unit || `million bbl`) : (unit === `million bbl` ? `百万桶` : (unit || `百万桶`));

const getResourceMetricDisplay = (values, rawCount) => {
  const numbers = (values || []).map(Number).filter(Number.isFinite).sort((left, right) => left - right);
  if (!numbers.length) return { value: `—`, note: tr(`暂无数据`, `No data`), empty: true };
  const recordCount = Number.isInteger(rawCount) && rawCount > 0 ? rawCount : numbers.length;
  const minimum = formatResourceNumber(numbers[0]);
  const maximum = formatResourceNumber(numbers[numbers.length - 1]);
  return {
    value: minimum === maximum ? minimum : `${minimum}–${maximum}`,
    note: recordCount === 1 ? tr(`1 条原始数据`, `1 source record`) : tr(`共 ${recordCount} 条原始数据`, `${recordCount} source records`),
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
    showState(tr(`地图资源未加载`, `Map resources failed to load`), tr(`请检查网络连接后刷新页面。`, `Check the network connection and refresh.`));
    return;
  }

  try {
    const params = pageParams;
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
      showState(tr(`没有找到该公司的项目`, `No projects found for this company`), tr(`请检查链接中的 operator 参数。`, `Check the operator parameter in the URL.`));
      return;
    }

    const matchingRegion = requestedRegion
      ? operatorEntry.businessRegions.find((region) => normalizeKey(region) === normalizeKey(requestedRegion))
      : ``;
    if (requestedRegion && !matchingRegion) {
      showState(
        tr(`没有找到该业务区域`, `Business region not found`),
        tr(`可用区域：${operatorEntry.businessRegions.join(`、`)}`, `Available regions: ${localizeValues(operatorEntry.businessRegions).join(`, `)}`),
      );
      return;
    }

    const companyPayload = await fetchJson(`${DATA_ROOT}/${operatorEntry.dataFile}?v=${VERSION}`);
    const projects = filterProjectsByRegion(companyPayload.projects, matchingRegion);
    if (!projects.length) {
      showState(tr(`没有找到项目`, `No projects found`), tr(`当前公司和业务区域没有可展示的项目。`, `No projects are available for this company and region.`));
      return;
    }

    const countryGroups = groupProjectsByCountry(projects);
    const countryCenters = centersPayload.countries;
    const missingCountries = countryGroups
      .map(({ country }) => country)
      .filter((country) => !countryCenters[country]);
    if (missingCountries.length) {
      showState(tr(`国家定位数据不完整`, `Country location data is incomplete`), tr(`缺少：${missingCountries.join(`、`)}`, `Missing: ${missingCountries.join(`, `)}`));
      return;
    }

    dom.operator.textContent = operatorEntry.name;
    dom.total.textContent = projects.length;
    dom.countryCount.textContent = countryGroups.length;
    dom.scope.textContent = matchingRegion ? (businessRegionEnglish[matchingRegion] || matchingRegion) : tr(`全球展示`, `Global view`);
    document.title = tr(`${operatorEntry.name} 项目分布地图`, `${operatorEntry.name} Project Distribution Map`);
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
      IS_EN ? country : (countryCenters[country]?.nameZh || country);

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
        count ? tr(`筛选，已选择 ${count} 个条件`, `Filters, ${count} selected`) : tr(`筛选项目`, `Filter projects`),
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
        : `<span class="filter-empty">${tr(`暂无设施类型`, `No facility types`)}</span>`;

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
      dom.drawerTitle.textContent = tr(`${countryDisplayName(country)}项目`, `${countryDisplayName(country)} Projects`);
      dom.drawerSummary.textContent = formatSearchSummary(
        operatorEntry.name,
        group.projects.length,
        visible.length,
        filters,
        IS_EN ? `en` : `zh`,
      );
      updateFilterBadge();

      dom.list.innerHTML = visible.length ? visible.map((project, index) => {
        const lifecycle = textOrDash(project.lifecycleCategories, (item) => lifecycleNames[item] || item);
        const facility = textOrDash(project.facilities);
        const fieldType = textOrDash(project.fieldTypes);
        const resourceStatus = hasResourceData(project, `any`) ? tr(`有储量数据`, `Reserves available`) : tr(`暂无储量数据`, `No reserves data`);
        return `
          <button class="project-row" type="button" data-project-id="${escapeHtml(project.id)}" aria-label="${tr(`查看 ${escapeHtml(project.project)} 详情`, `View ${escapeHtml(project.project)} details`)}">
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
      }).join(``) : `<div class="project-row project-row-empty"><span class="project-name">${tr(`没有匹配的项目`, `No matching projects`)}</span></div>`;

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
          ${renderSummaryItem(tr(`设施类型`, `Facility type`), facilities)}
          ${renderSummaryItem(tr(`油气田类型`, `Field type`), fieldTypes)}
          ${renderSummaryItem(tr(`生命周期`, `Lifecycle`), lifecycle)}
          ${renderSummaryItem(tr(`供应板块`, `Supply segment`), supplySegments)}
        </div>

        <section class="reserve-section">
          <div class="section-title-row">
            <h4>${tr(`储量`, `Reserves`)}</h4>
            <span class="section-unit">${tr(`单位：`, `Unit: `)}${escapeHtml(resourceUnitName(resources.unit))}</span>
          </div>
          <div class="reserve-grid">${metrics}</div>
        </section>

        <section class="project-facts">
          <div class="section-title-row"><h4>${tr(`项目资料`, `Project information`)}</h4></div>
          <div class="fact-grid">
            ${renderDetailField(tr(`发现年份`, `Discovery year`), project.discoveryYears)}
            ${renderDetailField(tr(`投产年份`, `Start-up year`), project.startupYears)}
            ${renderDetailField(tr(`水深类别`, `Water-depth category`), project.waterDepthCategories)}
            ${renderDetailField(tr(`生命周期明细`, `Lifecycle details`), project.lifecycleDetails)}
            ${renderDetailField(tr(`业务区域`, `Business region`), localizeValues(project.businessRegions))}
            ${renderDetailField(`Ownership`, project.ownerships, { wide: true })}
            ${showSourceOperator ? renderDetailField(tr(`运营实体`, `Operating entity`), project.sourceOperators, { wide: true }) : ``}
          </div>
        </section>`;
    };

    const openProjectDetail = (project) => {
      lastProjectId = project.id;
      listScrollTop = dom.list.scrollTop;
      dom.filterPanel.hidden = true;
      dom.filterToggle.setAttribute(`aria-expanded`, `false`);
      dom.drawerKicker.textContent = `PROJECT DETAILS`;
      dom.drawerTitle.textContent = tr(`项目详情`, `Project details`);
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
        ? tr(`收起项目面板`, `Collapse project panel`)
        : tr(`展开${countryDisplayName()}项目`, `Expand ${countryDisplayName()} projects`);
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
        .join(` / `) || tr(`暂无类型数据`, `No type data`);
    };

    countryGroups.forEach(({ country, projects: countryProjects }) => {
      const countryConfig = countryCenters[country];
      const countryLabel = IS_EN ? country : (countryConfig.nameZh || country);
      const dotSize = Math.round(Math.min(44, Math.max(30, 28 + Math.sqrt(countryProjects.length) * 2.2)));
      const tier = countryProjects.length >= 50 ? 4 : countryProjects.length >= 10 ? 3 : countryProjects.length >= 3 ? 2 : 1;
      const mainTypes = summarizeFieldTypes(countryProjects);
      const icon = L.divIcon({
        className: `country-dot-icon`,
        html: `
          <div class="country-dot tier-${tier}" style="--dot-size:${dotSize}px" aria-label="${escapeHtml(countryLabel)} · ${countryProjects.length} ${tr(`个项目`, `projects`)}">
            <span class="country-dot-count">${countryProjects.length}</span>
          </div>`,
        iconSize: [dotSize, dotSize],
        iconAnchor: [dotSize / 2, dotSize / 2],
      });
      const marker = L.marker(countryConfig.center, {
        icon,
        title: `${countryLabel} · ${countryProjects.length} ${tr(`个项目`, `projects`)}`,
        keyboard: true,
      }).addTo(map);
      marker.bindTooltip(`
        <div class="country-tooltip-card">
          <small>${escapeHtml(operatorEntry.name.toUpperCase())} PROJECTS</small>
          <strong>${escapeHtml(countryLabel)} · ${countryProjects.length} ${tr(`个项目`, `projects`)}</strong>
          <span class="tooltip-types">${tr(`主要类型：`, `Main types: `)}${escapeHtml(mainTypes)}</span>
          <span>${tr(`点击查看全部`, `Select to view all`)}</span>
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
    showState(tr(`地图数据未加载`, `Map data failed to load`), tr(`请检查网络连接后刷新页面。`, `Check the network connection and refresh.`));
  }
};

start();
