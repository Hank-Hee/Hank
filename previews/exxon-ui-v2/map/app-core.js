export const normalizeKey = (value) => String(value ?? "").trim().toLocaleLowerCase("en-US");

export const RESOURCE_FILTER_MODES = Object.freeze([
  "all",
  "any",
  "p90",
  "p50",
  "pmean",
  "prospective",
  "none",
]);

const RESOURCE_FIELD_BY_MODE = Object.freeze({
  p90: "p90",
  p50: "p50",
  pmean: "pMean",
  prospective: "prospective",
});

const toFilterValues = (values) => {
  if (values == null) return [];
  if (typeof values === "string") return [values];
  return [...values];
};

const hasMeaningfulValue = (values) => Array.isArray(values)
  && values.some((value) => value !== null
    && value !== undefined
    && (typeof value !== "string" || value.trim() !== ""));

const normalizeResourceMode = (mode) => {
  const normalized = normalizeKey(mode);
  return RESOURCE_FILTER_MODES.includes(normalized) ? normalized : "all";
};

export const hasResourceData = (project, resourceMode = "any") => {
  const resources = project?.resources || {};
  const mode = normalizeResourceMode(resourceMode);
  if (mode === "all") return true;
  if (mode === "any") {
    return Object.values(RESOURCE_FIELD_BY_MODE)
      .some((field) => hasMeaningfulValue(resources[field]));
  }
  if (mode === "none") return !hasResourceData(project, "any");
  return hasMeaningfulValue(resources[RESOURCE_FIELD_BY_MODE[mode]]);
};

export const resolveOperator = (manifest, requestedOperator) => {
  const requested = normalizeKey(requestedOperator);
  return manifest.operators.find((operator) =>
    [operator.name, ...(operator.aliases || [])].some((alias) => normalizeKey(alias) === requested));
};

export const filterProjectsByRegion = (projects, requestedRegion) => {
  const region = normalizeKey(requestedRegion);
  if (!region) return projects;
  return projects.filter((project) =>
    (project.businessRegions || []).some((value) => normalizeKey(value) === region));
};

export const groupProjectsByCountry = (projects) => {
  const groups = new Map();
  projects.forEach((project) => {
    if (!groups.has(project.country)) groups.set(project.country, []);
    groups.get(project.country).push(project);
  });
  return [...groups.entries()]
    .map(([country, countryProjects]) => ({ country, projects: countryProjects }))
    .sort((left, right) => right.projects.length - left.projects.length || left.country.localeCompare(right.country));
};

export const searchProjects = (projects, query) => {
  const needle = normalizeKey(query);
  if (!needle) return projects;
  return projects.filter((project) => normalizeKey(project.project).includes(needle));
};

export const getFacilityOptions = (projects) => {
  const options = new Map();
  projects.forEach((project) => {
    (project.facilities || []).forEach((facility) => {
      const normalized = normalizeKey(facility);
      if (normalized && !options.has(normalized)) options.set(normalized, String(facility).trim());
    });
  });
  return [...options.values()].sort((left, right) => left.localeCompare(right, "zh-CN", {
    numeric: true,
    sensitivity: "base",
  }));
};

export const countActiveFilters = ({ facilities = [], reserveMode = "all" } = {}) => {
  const selectedFacilities = new Set(toFilterValues(facilities).map(normalizeKey).filter(Boolean));
  return selectedFacilities.size + (normalizeResourceMode(reserveMode) === "all" ? 0 : 1);
};

export const hasActiveProjectFilters = ({ query = "", facilities = [], reserveMode = "all" } = {}) =>
  Boolean(normalizeKey(query)) || countActiveFilters({ facilities, reserveMode }) > 0;

export const filterProjects = (
  projects,
  { query = "", facilities = [], reserveMode = "all" } = {},
) => {
  const selectedFacilities = new Set(toFilterValues(facilities).map(normalizeKey).filter(Boolean));
  const mode = normalizeResourceMode(reserveMode);
  return searchProjects(projects, query).filter((project) => {
    const matchesFacility = selectedFacilities.size === 0
      || (project.facilities || []).some((facility) => selectedFacilities.has(normalizeKey(facility)));
    return matchesFacility && hasResourceData(project, mode);
  });
};

export const getResourceFilterCounts = (projects) => Object.fromEntries(
  RESOURCE_FILTER_MODES.map((mode) => [
    mode,
    mode === "all" ? projects.length : projects.filter((project) => hasResourceData(project, mode)).length,
  ]),
);

export const formatSearchSummary = (operator, total, visible, filters = "") => {
  const isFiltered = typeof filters === "object"
    ? hasActiveProjectFilters(filters)
    : Boolean(normalizeKey(filters));
  if (isFiltered) return `${operator} · 匹配 ${visible} / 总计 ${total}`;
  return `${operator} · ${total} 个项目 · 点击项目展开详情`;
};
