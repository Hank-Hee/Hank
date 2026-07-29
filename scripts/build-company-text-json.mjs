import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const dashboardDir = path.join(rootDir, "company-text-dashboard");
const vendorPath = path.join(dashboardDir, "vendor", "xlsx.full.min.js");
const workbookPath = path.join(dashboardDir, "data", "company-data.xlsx");
const outputPath = path.join(dashboardDir, "data", "company-data.json");

const vendorSource = await fs.readFile(vendorPath, "utf8");
const sandbox = {
  ArrayBuffer,
  Buffer,
  console,
  Date,
  Uint8Array,
  setTimeout,
  clearTimeout
};
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
sandbox.window = sandbox;
vm.runInNewContext(vendorSource, sandbox, { filename: vendorPath });

if (!sandbox.XLSX) {
  throw new Error("Unable to initialize the bundled XLSX parser");
}

const workbookBuffer = await fs.readFile(workbookPath);
const workbook = sandbox.XLSX.read(workbookBuffer, { type: "buffer" });
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = sandbox.XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false })
  .filter((row) => String(row["公司名称"] || "").trim());

await fs.writeFile(outputPath, `${JSON.stringify(rows)}\n`, "utf8");
console.log(`Generated ${rows.length} company records at ${path.relative(rootDir, outputPath)}.`);
