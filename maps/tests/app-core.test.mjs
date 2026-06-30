import test from "node:test";
import assert from "node:assert/strict";

import {
  filterProjectsByRegion,
  formatSearchSummary,
  groupProjectsByCountry,
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
