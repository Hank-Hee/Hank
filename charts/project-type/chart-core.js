const TYPE_META = {
  "Gas-Condensate field": {
    label: "凝析气田",
    englishLabel: "Gas-Condensate field",
    color: "#238b8d",
  },
  "Oil field": {
    label: "油田",
    englishLabel: "Oil field",
    color: "#e3a72f",
  },
  "Gas field": {
    label: "气田",
    englishLabel: "Gas field",
    color: "#3277bd",
  },
  "Mixed field": {
    label: "复合类型",
    englishLabel: "Mixed field",
    color: "#9dadbd",
  },
  Other: {
    label: "其他",
    englishLabel: "Other",
    color: "#d7e0e8",
  },
};

const TYPE_ORDER = [
  "Gas-Condensate field",
  "Oil field",
  "Gas field",
  "Mixed field",
  "Other",
];

const normalizeKey = (value) => String(value || "").trim().toLocaleLowerCase("en-US");

export function resolveOperator(manifest, requestedOperator) {
  const requested = normalizeKey(requestedOperator || "Shell");
  return manifest.operators.find((entry) => (
    [entry.name, ...(entry.aliases || [])].some((value) => normalizeKey(value) === requested)
  )) || null;
}

export function classifyProjectType(fieldTypes) {
  const values = [...new Set((fieldTypes || []).map((value) => String(value).trim()).filter(Boolean))];
  if (values.length === 0) return "Other";
  if (values.length > 1) return "Mixed field";
  return values[0];
}

export function buildProjectTypeMix(projects) {
  const counts = new Map();
  for (const project of projects || []) {
    const key = classifyProjectType(project.fieldTypes);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([key, count], index) => ({
      key,
      count,
      order: TYPE_ORDER.indexOf(key) === -1 ? TYPE_ORDER.length + index : TYPE_ORDER.indexOf(key),
      ...(TYPE_META[key] || {
        label: key,
        englishLabel: key,
        color: TYPE_META.Other.color,
      }),
    }))
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .map(({ order, ...item }) => item);
}

export function formatPercent(count, total) {
  if (!total) return "0.0%";
  return `${((count / total) * 100).toFixed(1)}%`;
}

export function buildDonutSegments(items, total, radius) {
  const circumference = 2 * Math.PI * radius;
  let offsetRatio = 0;

  return items.map((item) => {
    const ratio = total ? item.count / total : 0;
    const segment = {
      ...item,
      ratio,
      offsetRatio,
      circumference,
      dashLength: ratio * circumference,
      dashOffset: -offsetRatio * circumference,
    };
    offsetRatio += ratio;
    return segment;
  });
}
