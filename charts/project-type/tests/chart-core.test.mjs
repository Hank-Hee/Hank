import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildDonutSegments,
  buildProjectTypeMix,
  formatPercent,
  resolveOperator,
} from "../chart-core.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));

test("classifies multi-valued projects as Mixed field exactly once", () => {
  const projects = [
    { fieldTypes: ["Oil field"] },
    { fieldTypes: ["Gas field", "Oil field", "Gas field"] },
    { fieldTypes: [] },
  ];

  assert.deepEqual(buildProjectTypeMix(projects).map(({ key, count }) => [key, count]), [
    ["Oil field", 1],
    ["Mixed field", 1],
    ["Other", 1],
  ]);
});

test("matches the approved Shell project-type structure", () => {
  const payloadPath = path.resolve(testDir, "../../../maps/data/shell.json");
  const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
  const mix = buildProjectTypeMix(payload.projects);

  assert.deepEqual(mix.map(({ key, count }) => [key, count]), [
    ["Gas-Condensate field", 302],
    ["Oil field", 206],
    ["Gas field", 25],
    ["Mixed field", 19],
  ]);
  assert.equal(mix.reduce((sum, item) => sum + item.count, 0), 552);
});

test("formats one-decimal percentages and avoids invalid output", () => {
  assert.equal(formatPercent(19, 552), "3.4%");
  assert.equal(formatPercent(0, 0), "0.0%");
});

test("builds cumulative donut segments that cover the full circle", () => {
  const segments = buildDonutSegments([
    { key: "A", count: 3 },
    { key: "B", count: 1 },
  ], 4, 80);

  assert.equal(segments.length, 2);
  assert.equal(segments[0].ratio, 0.75);
  assert.equal(segments[1].offsetRatio, 0.75);
  assert.equal(segments.reduce((sum, item) => sum + item.ratio, 0), 1);
});

test("resolves companies and aliases case-insensitively", () => {
  const manifest = {
    operators: [{ name: "Shell", aliases: ["Shell plc"], dataFile: "data/shell.json" }],
  };

  assert.equal(resolveOperator(manifest, "shell").name, "Shell");
  assert.equal(resolveOperator(manifest, "SHELL PLC").name, "Shell");
  assert.equal(resolveOperator(manifest, "Unknown"), null);
});
