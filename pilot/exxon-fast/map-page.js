import { mountVectorMap } from "./map.js";

const root = document.querySelector("[data-vector-map]");

mountVectorMap(root, {
  summaryUrl: "data/map-summary.json?v=20260728-pilot-v2",
  detailsUrl: "../../maps/data/exxonmobil.json?v=20260728-pilot-v2",
}).then(({ summary }) => {
  document.documentElement.dataset.pilotReady = "true";
  window.__EXXON_PILOT__ = {
    page: "map",
    ready: true,
    projectCount: summary.meta.projectCount,
    countryCount: summary.meta.countryCount,
  };
}).catch((error) => {
  root.querySelector("[data-map-state]").innerHTML = `<strong>地图加载失败</strong><span>${error.message}</span>`;
  window.__EXXON_PILOT__ = { page: "map", ready: false, error: error.message };
  console.error(error);
});
