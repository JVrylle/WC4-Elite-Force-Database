// Units are auto-discovered: any *.json dropped into /data appears
// in the dropdown automatically (no registration needed here).

let EF_UNITS = [];

const MIN_LEVEL = 1;
const MAX_LEVEL = 12;

const STAT_META = {
  attack: { label: "Attack", className: "stat--attack", icon: "⚔" },
  defense: { label: "Defense", className: "stat--defense", icon: "🛡" },
  movement: { label: "Movement", className: "stat--movement", icon: "🥾" },
  hp: { label: "HP", className: "stat--hp", icon: "❤" },
};

const COST_META = {
  pieces: "Pieces",
  money: "Money",
  industry: "Industry",
  honorInfantryBadges: "Honor Infantry Badges",
};

const efSelect = document.getElementById("efSelect");
const levelSlider = document.getElementById("levelSlider");
const levelValue = document.getElementById("levelValue");
const searchBtn = document.getElementById("searchBtn");
const resultPanel = document.getElementById("resultPanel");
const statusLight = document.getElementById("statusLight");

levelSlider.addEventListener("input", updateLevelDisplay);

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;
}

function formatNumber(n) {
  return Number(n).toLocaleString("en-US");
}

function setStatus(state, text) {
  statusLight.className = `topbar__status status--${state}`;
  statusLight.innerHTML = `<span class="status-dot"></span><span class="status-text">${text}</span>`;
}

async function loadUnitsFromManifest() {
  try {
    const res = await fetch("data/units.json");
    if (!res.ok) return null;
    const units = await res.json();
    if (!Array.isArray(units) || units.length === 0) return null;
    return units.filter((u) => u && u.id);
  } catch {
    return null;
  }
}

async function loadUnitsFromListing() {
  const res = await fetch("data/");
  if (!res.ok) {
    throw new Error(`No data/units.json and /data listing unavailable (${res.status})`);
  }

  const html = await res.text();
  const files = [
    ...new Set(
      [...html.matchAll(/href=["']([^"'?]+\.json)["']/gi)]
        .map((m) => decodeURIComponent(m[1].replace(/^.*\//, "")))
    ),
  ].filter((f) => /\.json$/i.test(f) && f.toLowerCase() !== "units.json");

  if (files.length === 0) {
    throw new Error("No .json files found in /data");
  }

  const units = await Promise.all(
    files.map(async (file) => {
      const id = file.replace(/\.json$/i, "");
      try {
        const r = await fetch(`data/${encodeURIComponent(file)}`);
        const data = await r.json();
        return { id, name: data.name || id };
      } catch {
        return { id, name: id };
      }
    })
  );

  units.sort((a, b) => a.name.localeCompare(b.name));
  return units;
}

async function loadUnits() {
  const manifest = await loadUnitsFromManifest();
  if (manifest && manifest.length > 0) return manifest;
  return loadUnitsFromListing();
}

function populateSelects(units) {
  EF_UNITS = units;
  units.forEach((unit) => {
    const opt = document.createElement("option");
    opt.value = unit.id;
    opt.textContent = unit.name;
    efSelect.appendChild(opt);
  });

  levelSlider.min = MIN_LEVEL;
  levelSlider.max = MAX_LEVEL;
  levelSlider.value = MIN_LEVEL;
  updateLevelDisplay();
}

function updateLevelDisplay() {
  levelValue.textContent = `Level ${levelSlider.value}`;
}

function statMax(levels, key) {
  return Math.max(...levels.map((entry) => entry.stats?.[key] ?? 0), 1);
}

function renderStatGrid(stats, allLevels) {
  return Object.entries(STAT_META)
    .map(([key, meta]) => {
      const value = stats[key] ?? 0;
      const max = statMax(allLevels, key);
      const pct = Math.max(3, Math.round((value / max) * 100));
      return `
        <div class="stat-row ${meta.className}">
          <div class="stat-row__icon">${meta.icon}</div>
          <div class="stat-row__label">${meta.label}</div>
          <div class="stat-row__bar"><div class="stat-row__fill" style="width:${pct}%"></div></div>
          <div class="stat-row__value">${formatNumber(value)}</div>
        </div>
      `;
    })
    .join("");
}

function renderRequisition(cost) {
  const entries = Object.entries(cost || {}).filter(([, value]) => value != null);
  if (entries.length === 0) return "";

  const chips = entries
    .map(([key, value]) => {
      const label = COST_META[key] || key;
      return `<span class="chip"><span class="chip__label">${escapeHtml(label)}</span><span class="chip__value">${formatNumber(value)}</span></span>`;
    })
    .join("");

  return `
    <div class="requisition">
      <h3>Requisition Cost</h3>
      <div class="chip-row">${chips}</div>
    </div>
  `;
}

const KNOWN_TIERS = ["silver", "gold", "platinum", "bronze"];

function getSkillTier(title) {
  const m = String(title || "").match(/\(([a-z]+)\)$/i);
  const tier = m ? m[1].toLowerCase() : null;
  return KNOWN_TIERS.includes(tier) ? tier : "platinum";
}

function renderSkills(skills) {
  if (!Array.isArray(skills) || skills.length === 0) return "";

  const chips = skills
    .map((skill) => {
      const title = skill?.title ? escapeHtml(skill.title) : "";
      const desc = skill?.description ? escapeHtml(skill.description) : "";
      const tier = getSkillTier(skill?.title);
      return `<span class="skill-chip skill-chip--${tier}"${desc ? ` data-desc="${desc}"` : ""}>${title}</span>`;
    })
    .join("");

  return `
    <div class="skills">
      <h3>Skills</h3>
      <div class="skill-row">${chips}</div>
    </div>
  `;
}

function renderBriefing(note) {
  if (!note) return "";
  return `
    <div class="briefing">
      <span class="briefing__tag">Briefing</span>
      <p>${escapeHtml(note)}</p>
    </div>
  `;
}

function renderResult(unitName, levelData, allLevels) {
  const { level, stats, cost, skills, note } = levelData;

  resultPanel.innerHTML = `
    <div class="dossier">
      <div class="dossier__header">
        <h2>${escapeHtml(unitName)}</h2>
        <span class="badge">LEVEL ${String(level).padStart(2, "0")}</span>
      </div>
      <div class="stat-grid">${renderStatGrid(stats, allLevels)}</div>
      ${renderSkills(skills)}
      ${renderRequisition(cost)}
      ${renderBriefing(note)}
    </div>
  `;
}

function renderMessage(message, isError) {
  resultPanel.innerHTML = `
    <div class="result-empty${isError ? " result-empty--error" : ""}">
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

async function runSearch() {
  const unitId = efSelect.value;
  const level = parseInt(levelSlider.value, 10);
  const unitMeta = EF_UNITS.find((u) => u.id === unitId);

  if (!unitMeta) {
    renderMessage("No unit selected.", true);
    setStatus("error", "NO UNIT");
    return;
  }

  setStatus("busy", "QUERYING");
  searchBtn.disabled = true;

  try {
    const res = await fetch(`data/${unitId}.json`);
    if (!res.ok) {
      throw new Error(`Could not load data/${unitId}.json (${res.status})`);
    }

    const data = await res.json();
    const levelData = (data.levels || []).find((entry) => entry.level === level);

    if (!levelData) {
      renderMessage(`No record for ${data.name || unitMeta.name} at level ${level}.`, true);
      setStatus("error", "NO RECORD");
      return;
    }

    renderResult(data.name || unitMeta.name, levelData, data.levels);
    setStatus("ready", "RECORD FOUND");
  } catch (err) {
    renderMessage(err.message, true);
    setStatus("error", "FETCH FAILED");
  } finally {
    searchBtn.disabled = false;
  }
}

loadUnits()
  .then((units) => populateSelects(units))
  .catch((err) => {
    renderMessage(
      `Could not load units: ${err.message}. Make sure data/units.json exists (run node generate-manifest.js) and that unit files are committed.`,
      true
    );
    setStatus("error", "NO UNITS");
  });

searchBtn.addEventListener("click", runSearch);