import test from "node:test";
import assert from "node:assert/strict";

import {
  countActiveFilters,
  filterProjects,
  filterProjectsByRegion,
  formatSearchSummary,
  getFacilityOptions,
  getResourceFilterCounts,
  groupProjectsByCountry,
  hasActiveProjectFilters,
  hasResourceData,
  resolveOperator,
  searchProjects,
} from "../app-core.js";


test("resolves operator aliases case-insensitively", () => {
  const manifest = {
    operators: [
      { name: "Shell", aliases: ["Shell"], dataFile: "data/shell.json" },
      { name: "ADNOC", aliases: ["ADNOC"], dataFile: "data/adnoc.json" },
    ],
  };

  assert.equal(resolveOperator(manifest, " SHELL ").name, "Shell");
  assert.equal(resolveOperator(manifest, "adnoc").name, "ADNOC");
  assert.equal(resolveOperator(manifest, "Unknown"), undefined);
});

test("filters projects by unified business region", () => {
  const projects = [
    { id: "1", businessRegions: ["东南亚"] },
    { id: "2", businessRegions: ["巴西"] },
    { id: "3", businessRegions: ["东南亚", "全球/跨区域"] },
  ];

  assert.deepEqual(filterProjectsByRegion(projects, " 东南亚 ").map((project) => project.id), ["1", "3"]);
  assert.deepEqual(filterProjectsByRegion(projects, ""), projects);
});

test("groups projects by country with largest groups first", () => {
  const groups = groupProjectsByCountry([
    { id: "1", country: "Malaysia" },
    { id: "2", country: "Brunei" },
    { id: "3", country: "Malaysia" },
  ]);

  assert.equal(groups[0].country, "Malaysia");
  assert.equal(groups[0].projects.length, 2);
  assert.equal(groups[1].country, "Brunei");
});

test("searches project names and formats result counts", () => {
  const projects = [
    { id: "1", project: "Alpha Deepwater" },
    { id: "2", project: "Beta Shelf" },
  ];
  const visible = searchProjects(projects, " deep ");

  assert.deepEqual(visible.map((project) => project.id), ["1"]);
  assert.equal(formatSearchSummary("Shell", 2, 1, "deep"), "Shell · 匹配 1 / 总计 2");
  assert.equal(formatSearchSummary("Shell", 2, 2, ""), "Shell · 2 个项目 · 点击项目展开详情");
});

test("combines project-name search, facility OR matching, and resource filtering", () => {
  const projects = [
    {
      id: "1",
      project: "Alpha Deepwater",
      facilities: ["FPSO"],
      resources: { p90: [0], p50: [], pMean: [], prospective: [] },
    },
    {
      id: "2",
      project: "Alpha Shelf",
      facilities: ["Steel platform"],
      resources: { p90: [], p50: [25], pMean: [], prospective: [] },
    },
    {
      id: "3",
      project: "Beta Onshore",
      facilities: ["Onshore LNG plant"],
      resources: { p90: [], p50: [], pMean: [], prospective: [] },
    },
  ];

  const visible = filterProjects(projects, {
    query: " alpha ",
    facilities: new Set(["fpso", "Steel platform"]),
    reserveMode: "any",
  });
  assert.deepEqual(visible.map((project) => project.id), ["1", "2"]);

  const p90Only = filterProjects(projects, {
    facilities: ["FPSO", "Onshore LNG plant"],
    reserveMode: "p90",
  });
  assert.deepEqual(p90Only.map((project) => project.id), ["1"]);
});

test("treats zero as resource data and supports every resource availability mode", () => {
  const projects = [
    { id: "1", resources: { p90: [0], p50: [], pMean: [], prospective: [] } },
    { id: "2", resources: { p90: [], p50: [12], pMean: [18], prospective: [] } },
    { id: "3", resources: { p90: [], p50: [], pMean: [], prospective: [7] } },
    { id: "4", resources: { p90: [], p50: [], pMean: [], prospective: [] } },
    { id: "5" },
  ];

  assert.equal(hasResourceData(projects[0], "p90"), true);
  assert.equal(hasResourceData(projects[1], "pmean"), true);
  assert.equal(hasResourceData({ resources: { p90: [null, " "] } }, "p90"), false);
  assert.deepEqual(getResourceFilterCounts(projects), {
    all: 5,
    any: 3,
    p90: 1,
    p50: 1,
    pmean: 1,
    prospective: 1,
    none: 2,
  });
});

test("builds normalized facility options and counts only filter-panel selections", () => {
  const projects = [
    { facilities: ["Steel platform", "FPSO"] },
    { facilities: ["fpso", " Onshore LNG plant "] },
    { facilities: [] },
  ];

  assert.deepEqual(getFacilityOptions(projects), ["FPSO", "Onshore LNG plant", "Steel platform"]);
  assert.equal(countActiveFilters({
    facilities: ["FPSO", "fpso", "Steel platform"],
    reserveMode: "p50",
  }), 3);
  assert.equal(hasActiveProjectFilters({ query: "alpha" }), true);
  assert.equal(hasActiveProjectFilters({ facilities: [], reserveMode: "all" }), false);
});

test("formats a filtered summary for facility or resource filters without a search query", () => {
  const filters = { query: "", facilities: ["FPSO"], reserveMode: "p90" };
  assert.equal(formatSearchSummary("ADNOC", 49, 8, filters), "ADNOC · 匹配 8 / 总计 49");
});
