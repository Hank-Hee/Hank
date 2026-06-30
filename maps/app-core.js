export const normalizeKey = (value) => String(value ?? "").trim().toLocaleLowerCase("en-US");

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

export const formatSearchSummary = (operator, total, visible, query) => {
  if (normalizeKey(query)) return `${operator} · 匹配 ${visible} / 总计 ${total}`;
  return `${operator} · ${total} 个项目 · 点击项目展开详情`;
};
