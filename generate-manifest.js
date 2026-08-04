// Scans /data for unit JSONs and writes data/units.json — the index file
// the app reads to populate the unit dropdown. Runs automatically on
// GitHub (see .github/workflows/update-units.yml) or manually:
//   node generate-manifest.js
const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "data");
const manifestPath = path.join(dataDir, "units.json");

const files = fs
  .readdirSync(dataDir)
  .filter((f) => /\.json$/i.test(f) && f.toLowerCase() !== "units.json")
  .sort((a, b) => a.localeCompare(b));

const units = [];
for (const file of files) {
  const id = file.replace(/\.json$/i, "");
  let name = id;
  try {
    const raw = fs.readFileSync(path.join(dataDir, file), "utf8");
    if (raw.trim()) {
      const data = JSON.parse(raw);
      if (data && typeof data.name === "string" && data.name.trim()) {
        name = data.name.trim();
      }
    }
  } catch (err) {
    console.warn(`Skipping ${file}: ${err.message}`);
  }
  units.push({ id, name });
}

units.sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(manifestPath, JSON.stringify(units, null, 2) + "\n", "utf8");
console.log(`Wrote ${units.length} unit(s) to data/units.json`);
