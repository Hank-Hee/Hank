export const TYPE_META = {
  "Gas-Condensate field": { label: "凝析气田", color: "#16847a" },
  "Oil field": { label: "油田", color: "#d5b46a" },
  "Gas field": { label: "气田", color: "#244e70" },
  "Mixed field": { label: "复合类型", color: "#7896aa" },
  Other: { label: "其他", color: "#d8e0e6" },
};

const TYPE_ORDER = [
  "Gas-Condensate field",
  "Oil field",
  "Gas field",
  "Mixed field",
  "Other",
];

export const clean = (value) => String(value ?? "").trim();

export function classifyProjectType(fieldTypes = []) {
  const values = [...new Set(fieldTypes.map(clean).filter(Boolean))];
  if (!values.length) return "Other";
  if (values.length > 1) return "Mixed field";
  return TYPE_META[values[0]] ? values[0] : "Other";
}

export function buildProjectTypeMix(projects = []) {
  const counts = new Map();
  for (const project of projects) {
    const type = classifyProjectType(project.fieldTypes);
    counts.set(type, (counts.get(type) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count, ...(TYPE_META[key] || TYPE_META.Other) }))
    .sort((left, right) => (
      right.count - left.count
      || TYPE_ORDER.indexOf(left.key) - TYPE_ORDER.indexOf(right.key)
    ));
}

export function projectToMap(center = []) {
  const latitude = Number(center[0]);
  const longitude = Number(center[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return {
    x: ((longitude + 180) / 360) * 1000,
    y: ((90 - latitude) / 180) * 500,
  };
}

export function buildCountrySummary(projects = [], countryCenters = {}) {
  const groups = new Map();
  for (const project of projects) {
    const country = clean(project.country);
    if (!country) continue;
    if (!groups.has(country)) groups.set(country, []);
    groups.get(country).push(project);
  }

  return [...groups.entries()]
    .map(([country, rows]) => {
      const center = countryCenters[country];
      if (!center) throw new Error(`Missing country center: ${country}`);
      const point = projectToMap(center.center);
      if (!point) throw new Error(`Invalid country center: ${country}`);
      return {
        country,
        nameZh: center.nameZh || country,
        count: rows.length,
        center: center.center,
        point,
      };
    })
    .sort((left, right) => right.count - left.count || left.country.localeCompare(right.country));
}

export function filterProjects(projects = [], query = "") {
  const wanted = clean(query).toLocaleLowerCase("zh-CN");
  if (!wanted) return projects;
  return projects.filter((project) => [
    project.project,
    project.country,
    ...(project.businessRegions || []),
    ...(project.facilities || []),
    ...(project.fieldTypes || []),
    ...(project.lifecycleCategories || []),
  ].some((value) => clean(value).toLocaleLowerCase("zh-CN").includes(wanted)));
}

export function formatNumber(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: digits }).format(number);
}

export function niceScale(values = [], tickCount = 4) {
  const numbers = values.map(Number).filter(Number.isFinite);
  let minimum = Math.min(0, ...numbers);
  let maximum = Math.max(0, ...numbers);
  if (minimum === maximum) maximum = minimum + 1;
  const rawStep = (maximum - minimum) / Math.max(1, tickCount);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = niceNormalized * magnitude;
  minimum = Math.floor(minimum / step) * step;
  maximum = Math.ceil(maximum / step) * step;
  const ticks = [];
  for (let value = minimum; value <= maximum + step / 2; value += step) ticks.push(value);
  return { minimum, maximum, ticks };
}
