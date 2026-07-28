import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCountrySummary, buildProjectTypeMix } from "../pilot/exxon-fast/map-core.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const pilotRoot = path.join(root, "pilot", "exxon-fast");
const dataRoot = path.join(pilotRoot, "data");
const assetRoot = path.join(pilotRoot, "assets");
const sourceUrl = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";

await fs.mkdir(dataRoot, { recursive: true });
await fs.mkdir(assetRoot, { recursive: true });

const readJson = async (relativePath) => JSON.parse(await fs.readFile(path.join(root, relativePath), "utf8"));
const payload = await readJson(path.join("maps", "data", "exxonmobil.json"));
const centers = await readJson(path.join("maps", "data", "country-centers.json"));
const countries = buildCountrySummary(payload.projects, centers.countries);
const projectTypes = buildProjectTypeMix(payload.projects);

const summary = {
  meta: {
    operator: payload.meta.operator,
    projectCount: payload.projects.length,
    countryCount: countries.length,
    locationRule: payload.meta.locationRule,
    sourceFile: payload.meta.sourceFile,
    generatedOn: "2026-07-28",
  },
  countries,
  projectTypes,
};

await fs.writeFile(
  path.join(dataRoot, "map-summary.json"),
  `${JSON.stringify(summary)}\n`,
  "utf8",
);

const worldPath = path.join(assetRoot, "world-110m.svg");
const refreshWorld = process.argv.includes("--refresh-world");
let worldExists = true;
try {
  await fs.access(worldPath);
} catch {
  worldExists = false;
}

if (refreshWorld || !worldExists) {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Natural Earth request failed: ${response.status}`);
  const world = await response.json();
  const round = (value) => Math.round(value * 10) / 10;
  const project = ([longitude, latitude]) => [
    round(((longitude + 180) / 360) * 1000),
    round(((90 - latitude) / 180) * 500),
  ];
  const ringPath = (ring) => ring.map((coordinate, index) => {
    const [x, y] = project(coordinate);
    return `${index ? "L" : "M"}${x} ${y}`;
  }).join("") + "Z";
  const polygonPath = (polygon) => polygon.map(ringPath).join("");
  const geometryPath = (geometry) => {
    if (!geometry) return "";
    if (geometry.type === "Polygon") return polygonPath(geometry.coordinates);
    if (geometry.type === "MultiPolygon") return geometry.coordinates.map(polygonPath).join("");
    return "";
  };

  const longitudeLines = [-120, -60, 0, 60, 120].map((longitude) => {
    const x = round(((longitude + 180) / 360) * 1000);
    return `<path d="M${x} 0V500"/>`;
  }).join("");
  const latitudeLines = [-60, -30, 0, 30, 60].map((latitude) => {
    const y = round(((90 - latitude) / 180) * 500);
    return `<path d="M0 ${y}H1000"/>`;
  }).join("");
  const land = world.features
    .map((feature) => geometryPath(feature.geometry))
    .filter(Boolean)
    .map((d) => `<path d="${d}"/>`)
    .join("");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500" role="img" aria-labelledby="title desc">
  <title id="title">本地矢量世界地图</title>
  <desc id="desc">基于 Natural Earth 1:110m 国家边界生成的本地静态矢量底图</desc>
  <rect width="1000" height="500" fill="#eef4f7"/>
  <g fill="none" stroke="#dce6ec" stroke-width="0.65">${longitudeLines}${latitudeLines}</g>
  <g fill="#f8fafb" fill-rule="evenodd" stroke="#c8d5de" stroke-width="0.7" vector-effect="non-scaling-stroke">${land}</g>
</svg>
`;
  await fs.writeFile(worldPath, svg, "utf8");
}

process.stdout.write(JSON.stringify({
  summary: path.relative(root, path.join(dataRoot, "map-summary.json")),
  world: path.relative(root, worldPath),
  projectCount: payload.projects.length,
  countryCount: countries.length,
  typeCount: projectTypes.reduce((sum, item) => sum + item.count, 0),
}, null, 2));
