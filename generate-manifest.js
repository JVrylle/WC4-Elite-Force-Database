// Scans /data type subfolders (infantry, artillery, ...) for unit JSONs and
// writes data/units.json — the index file the app reads to populate the unit
// dropdown. Runs automatically on GitHub (see .github/workflows/update-units.yml),
// manually:
//   node generate-manifest.js
// or automatically after every save via admin-server.js.
const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "data");
const manifestPath = path.join(dataDir, "units.json");

function walkTypes(dir) {
  const entries = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      entries.push({ type: entry.name, dir: path.join(dir, entry.name) });
    }
  }
  return entries.sort((a, b) => a.type.localeCompare(b.type));
}

function generateManifest() {
  const units = [];
  for (const { type, dir } of walkTypes(dataDir)) {
    const files = fs
      .readdirSync(dir)
      .filter((f) => /\.json$/i.test(f))
      .sort((a, b) => a.localeCompare(b));

    for (const file of files) {
      const id = file.replace(/\.json$/i, "");
      let name = id;
      try {
        const raw = fs.readFileSync(path.join(dir, file), "utf8");
        if (raw.trim()) {
          const data = JSON.parse(raw);
          if (data && typeof data.name === "string" && data.name.trim()) {
            name = data.name.trim();
          }
        }
      } catch (err) {
        console.warn(`Skipping ${type}/${file}: ${err.message}`);
      }
      units.push({ id, name, type });
    }
  }

  units.sort((a, b) => a.name.localeCompare(b.name));
  fs.writeFileSync(manifestPath, JSON.stringify(units, null, 2) + "\n", "utf8");
  return units;
}

if (require.main === module) {
  const units = generateManifest();
  console.log(`Wrote ${units.length} unit(s) to data/units.json`);
}

module.exports = { generateManifest };
