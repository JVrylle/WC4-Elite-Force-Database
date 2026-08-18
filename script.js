// Units are auto-discovered: any *.json dropped into a /data subfolder appears
// in the dropdown automatically (no registration needed here).

const UNIT_TYPES = ["infantry", "artillery", "navy", "armored", "airforce"];

const TYPE_LABELS = {
  infantry: "Infantry",
  artillery: "Artillery",
  navy: "Navy",
  armored: "Armored",
  airforce: "Air Force",
};

let ALL_UNITS = [];
let EF_UNITS = [];
let selectedType = "infantry";
let searchMatches = [];
let activeSearchIndex = -1;
let techEnabled = true;

const MIN_LEVEL = 1;
const MAX_LEVEL = 12;

// Max attack-tech upgrade bonuses per unit type. The JSON stats are stored
// with these baked in; toggling tech off subtracts them at render time.
const TECH_ATTACK_BONUS = {
  infantry: 9,
  armored: 15,
  artillery: 18,
  navy: 16,
  airforce: 16,
};

const SVG_ICON_ATTRS =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';

const STAT_META = {
  attack: {
    label: "Attack",
    className: "stat--attack",
    icon: `<svg ${SVG_ICON_ATTRS}><path d="M5.5 19 16 8.5"/><path d="M18.5 19 8 8.5"/><path d="M7.4 13.9 10.6 17.1"/><path d="M16.6 13.9 13.4 17.1"/></svg>`,
  },
  defense: {
    label: "Defense",
    className: "stat--defense",
    icon: `<svg ${SVG_ICON_ATTRS}><path d="M12 3l7 2v6c0 4.3-3 7.7-7 9.4-4-1.7-7-5.1-7-9.4V5l7-2Z"/></svg>`,
  },
  movement: {
    label: "Movement",
    className: "stat--movement",
    icon: `<svg ${SVG_ICON_ATTRS}><path d="M12 3v18"/><path d="M3 12h18"/><path d="M12 3l-2 2"/><path d="M12 3l2 2"/><path d="M12 21l-2-2"/><path d="M12 21l2-2"/><path d="M3 12l2-2"/><path d="M3 12l2 2"/><path d="M21 12l-2-2"/><path d="M21 12l-2 2"/></svg>`,
  },
  hp: {
    label: "HP",
    className: "stat--hp",
    icon: `<svg ${SVG_ICON_ATTRS}><path d="M12 20.3C7.1 15.9 3.8 13 3.8 9.4 3.8 6.9 5.7 5 8.2 5c1.6 0 3.1.8 3.8 2.1C12.7 5.8 14.2 5 15.8 5c2.5 0 4.4 1.9 4.4 4.4 0 3.6-3.3 6.5-8.2 10.9Z"/></svg>`,
  },
  range: {
    label: "Range",
    className: "stat--range",
    icon: `<svg ${SVG_ICON_ATTRS}><circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v3.5"/><path d="M12 18v3.5"/><path d="M2.5 12H6"/><path d="M18 12h3.5"/></svg>`,
  },
};

const COST_META = {
  pieces: "Frags",
  money: "Money",
  industry: "Industry",
  honorInfantryBadges: "Honor Infantry Badges",
};

const unitCache = new Map();

const efSearch = document.getElementById("efSearch");
const efSearchList = document.getElementById("efSearchList");
const efSelect = document.getElementById("efSelect");
const levelSlider = document.getElementById("levelSlider");
const levelInput = document.getElementById("levelInput");
const levelDown = document.getElementById("levelDown");
const levelUp = document.getElementById("levelUp");
const techToggle = document.getElementById("techToggle");
const typeFilter = document.getElementById("typeFilter");
const resultPanel = document.getElementById("resultPanel");
const statusLight = document.getElementById("statusLight");
const whatsNewList = document.getElementById("whatsNewList");

async function loadWhatsNew() {
  try {
    const res = await fetch("whats-new.txt");
    if (!res.ok) throw new Error("not found");
    const text = await res.text();
    const entries = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (entries.length === 0) throw new Error("empty");
    whatsNewList.innerHTML = entries
      .map((entry) => `<li class="log-item">${escapeHtml(entry)}</li>`)
      .join("");
  } catch {
    whatsNewList.innerHTML = `<li class="log-item log-item--muted">Nothing new yet.</li>`;
  }
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;
}

function formatNumber(n) {
  return Number(n).toLocaleString("en-US");
}

function applyTechAdjustment(stats, unitType) {
  if (techEnabled) return stats;
  const bonus = TECH_ATTACK_BONUS[unitType] || 0;
  if (!bonus) return stats;
  return { ...stats, attack: Math.max(0, (stats.attack ?? 0) - bonus) };
}

function setStatus(state, text) {
  statusLight.className = `topbar__status status--${state}`;
  statusLight.innerHTML = `<span class="status-dot"></span><span class="status-text">${text}</span>`;
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

async function loadUnitsFromManifest() {
  try {
    const res = await fetch(`data/units.json?v=${Date.now()}`);
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
      [...html.matchAll(/href=["']([^"'?]*\.json)["']/gi)].map((m) =>
        decodeURIComponent(m[1])
      )
    ),
  ].filter(
    (f) => /\.json$/i.test(f) && !f.toLowerCase().includes("units.json")
  );

  if (files.length === 0) {
    throw new Error("No .json files found in /data");
  }

  const units = await Promise.all(
    files.map(async (file) => {
      const clean = file.replace(/^.*?\/data\//i, "").replace(/^\/+/, "");
      const parts = clean.split("/");
      const id = parts[parts.length - 1].replace(/\.json$/i, "");
      const type = parts.length > 1 ? parts[parts.length - 2] : "infantry";
      try {
        const r = await fetch(
          `data/${clean.split("/").map(encodeURIComponent).join("/")}?v=${Date.now()}`
        );
        const data = await r.json();
        return { id, name: data.name || id, type };
      } catch {
        return { id, name: id, type };
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

function buildTypeButtons() {
  typeFilter.innerHTML = UNIT_TYPES.map(
    (type) =>
      `<button type="button" class="type-btn" data-type="${type}">${TYPE_LABELS[type]}</button>`
  ).join("");
  typeFilter.querySelectorAll(".type-btn").forEach((btn) => {
    btn.addEventListener("click", () => applyTypeFilter(btn.dataset.type));
  });
}

function applyTypeFilter(type) {
  selectedType = type;
  typeFilter.querySelectorAll(".type-btn").forEach((btn) => {
    btn.classList.toggle("type-btn--active", btn.dataset.type === type);
  });
  populateSelects(ALL_UNITS.filter((u) => (u.type || "infantry") === type));
}

function renderSearchList() {
  const query = efSearch.value.trim().toLowerCase();
  searchMatches = ALL_UNITS.filter(
    (u) => !query || (u.name || "").toLowerCase().includes(query)
  );

  if (activeSearchIndex > searchMatches.length - 1) activeSearchIndex = -1;

  efSearchList.innerHTML = searchMatches
    .map(
      (unit, i) =>
        `<li role="option" class="combo__item${i === activeSearchIndex ? " combo__item--active" : ""}" data-id="${escapeHtml(unit.id)}">${escapeHtml(unit.name)}</li>`
    )
    .join("");
}

function openSearchList() {
  efSearchList.hidden = false;
  efSearch.setAttribute("aria-expanded", "true");
}

function closeSearchList() {
  efSearchList.hidden = true;
  efSearch.setAttribute("aria-expanded", "false");
  activeSearchIndex = -1;
}

function highlightSearchItem(index) {
  activeSearchIndex = index;
  efSearchList.querySelectorAll(".combo__item").forEach((item, i) => {
    item.classList.toggle("combo__item--active", i === index);
  });
  const active = efSearchList.querySelector(".combo__item--active");
  if (active) active.scrollIntoView({ block: "nearest" });
}

function selectSearchUnit(id) {
  const unit = ALL_UNITS.find((u) => u.id === id);
  if (!unit) return;
  efSearch.value = unit.name;
  closeSearchList();
  applyTypeFilter(unit.type || "infantry");
  efSelect.value = id;
  runSearch();
}

function populateSelects(units) {
  EF_UNITS = units;
  efSelect.innerHTML = "";
  units.forEach((unit) => {
    const opt = document.createElement("option");
    opt.value = unit.id;
    opt.textContent = unit.name;
    efSelect.appendChild(opt);
  });

  levelSlider.min = MIN_LEVEL;
  levelSlider.max = MAX_LEVEL;
  levelSlider.value = MIN_LEVEL;
  levelInput.value = MIN_LEVEL;

  if (units.length === 0) {
    efSelect.disabled = true;
    levelSlider.disabled = true;
    levelInput.disabled = true;
    levelDown.disabled = true;
    levelUp.disabled = true;
    renderMessage(
      `No ${TYPE_LABELS[selectedType] || selectedType} units available yet.`,
      true
    );
    setStatus("error", "NO UNITS");
    return;
  }

  efSelect.disabled = false;
  levelSlider.disabled = false;
  levelInput.disabled = false;
  efSelect.selectedIndex = 0;
  updateArrowState();
  runSearch();
}

function currentLevel() {
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, parseInt(levelSlider.value, 10) || MIN_LEVEL));
}

function setLevel(value) {
  const level = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, parseInt(value, 10) || MIN_LEVEL));
  levelSlider.value = level;
  levelInput.value = level;
  updateArrowState();
  runSearch();
}

function updateArrowState() {
  const level = currentLevel();
  levelDown.disabled = level <= MIN_LEVEL;
  levelUp.disabled = level >= MAX_LEVEL;
}

function renderStatGrid(stats, maxes) {
  return Object.entries(STAT_META)
    .map(([key, meta]) => {
      const value = stats[key] ?? 0;
      const max = Math.max(maxes?.[key] ?? 0, 1);
      const pct = Math.max(3, Math.round((value / max) * 100));
      return `
        <div class="stat-row ${meta.className}">
          <div class="stat-row__icon">${meta.icon}</div>
          <div class="stat-row__label">${meta.label}</div>
          <div class="stat-row__bar"><div class="stat-row__fill" style="width:${pct}%"></div></div>
          <div class="stat-row__value">${formatNumber(value)} / ${formatNumber(max)}</div>
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
      <h3>Upgrade / Unlock Cost</h3>
      <div class="chip-row">${chips}</div>
    </div>
  `;
}

const KNOWN_TIERS = ["silver", "gold", "platinum", "bronze"];

function getSkillTier(skill) {
  const tier = String(skill?.tier || "").toLowerCase();
  return KNOWN_TIERS.includes(tier) ? tier : "gold";
}

function renderSkills(allLevels, currentLevel) {
  const roster = new Map();
  for (const entry of allLevels) {
    for (const skill of entry.skills || []) {
      const title = skill?.title;
      if (!title || roster.has(title)) continue;
      roster.set(title, {
        title,
        unlockLevel: entry.level,
        description: skill?.description || "",
      });
    }
  }

  const levelEntry = allLevels.find((entry) => entry.level === currentLevel);
  const currentChips = (levelEntry?.skills || []).map((skill) => {
    const tier = getSkillTier(skill);
    const desc = skill?.description
      ? ` data-desc="${escapeHtml(skill.description)}"`
      : "";
    return `<span class="skill-chip skill-chip--${tier}"${desc}>${escapeHtml(skill.title)}</span>`;
  });

  const futureChips = [...roster.values()]
    .filter((perk) => perk.unlockLevel > currentLevel)
    .sort((a, b) => a.unlockLevel - b.unlockLevel)
    .map(
      (perk) => `
        <span class="skill-chip skill-chip--upcoming"${perk.description ? ` data-desc="${escapeHtml(perk.description)}"` : ""} title="Unlocks at level ${perk.unlockLevel}">
          <span class="skill-chip__name">${escapeHtml(perk.title)}</span>
          <span class="skill-chip__lvl">LVL ${perk.unlockLevel}</span>
        </span>`
    );

  if (currentChips.length === 0 && futureChips.length === 0) return "";

  const currentBlock = currentChips.length
    ? `<div class="skill-row">${currentChips.join("")}</div>`
    : `<p class="skill-empty">This unit has no skills at this level</p>`;

  const futureBlock = futureChips.length
    ? `
      <div class="skill-row--upcoming">
        <span class="skill-row__tag">Locked Skills</span>
        <div class="skill-row">${futureChips.join("")}</div>
      </div>`
    : "";

  return `
    <div class="skills">
      <h3>Skills</h3>
      ${currentBlock}
      ${futureBlock}
    </div>
  `;
}

function renderNote(note) {
  if (!note || note === "null") return "";
  return `
    <div class="briefing">
      <span class="briefing__tag">Note</span>
      <p>${escapeHtml(note)}</p>
    </div>
  `;
}

function renderResult(unitName, levelData, allLevels, unitType, maxes) {
  const { level, stats, cost, note } = levelData;

  resultPanel.innerHTML = `
    <div class="dossier">
      <div class="dossier__header">
        <h2>${escapeHtml(unitName)}<span class="badge badge--level">LVL ${level}</span></h2>
        <span class="dossier__scale">Comparison to ${escapeHtml(unitType)} max stats</span>
      </div>
      <div class="stat-grid">${renderStatGrid(stats, maxes)}</div>
      ${renderSkills(allLevels, level)}
      ${renderRequisition(cost)}
      ${renderNote(note)}
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

const typeMaxCache = new Map();

async function ensureTypeMaxes(unitType) {
  const cached = typeMaxCache.get(unitType);
  if (cached) return cached;

  const maxes = { attack: 0, defense: 0, movement: 0, hp: 0, range: 0 };
  const siblings = ALL_UNITS.filter((u) => (u.type || "infantry") === unitType);

  await Promise.all(
    siblings.map(async (unit) => {
      try {
        let data = unitCache.get(unit.id);
        if (!data) {
          const res = await fetch(`data/${unitType}/${encodeURIComponent(unit.id)}.json?v=${Date.now()}`);
          if (!res.ok) return;
          data = await res.json();
          unitCache.set(unit.id, data);
        }
        for (const lvl of data.levels || []) {
          for (const key of Object.keys(maxes)) {
            const value = lvl.stats?.[key] ?? 0;
            if (value > maxes[key]) maxes[key] = value;
          }
        }
      } catch {
        // skip unreadable sibling units
      }
    })
  );

  typeMaxCache.set(unitType, maxes);
  return maxes;
}

async function runSearch() {
  const unitId = efSelect.value;
  const level = currentLevel();
  const unitMeta = EF_UNITS.find((u) => u.id === unitId);

  if (!unitMeta) {
    renderMessage("No unit selected.", true);
    setStatus("error", "NO UNIT");
    return;
  }

  setStatus("busy", "LOADING");

  try {
    let data = unitCache.get(unitId);
    if (!data) {
      const unitType = unitMeta.type || "infantry";
      const res = await fetch(`data/${unitType}/${encodeURIComponent(unitId)}.json?v=${Date.now()}`);
      if (!res.ok) {
        throw new Error(`Could not load data/${unitType}/${unitId}.json (${res.status})`);
      }
      data = await res.json();
      unitCache.set(unitId, data);
    }

    const levelData = (data.levels || []).find((entry) => entry.level === level);

    if (!levelData) {
      renderMessage(`No record for ${data.name || unitMeta.name} at level ${level}.`, true);
      setStatus("error", "NO RECORD");
      return;
    }

    const unitType = unitMeta.type || "infantry";
    const maxes = await ensureTypeMaxes(unitType);
    const displayLevel = techEnabled
      ? levelData
      : { ...levelData, stats: applyTechAdjustment(levelData.stats, unitType) };
    const displayMaxes = applyTechAdjustment(maxes, unitType);
    const displayName = data.name || unitMeta.name;
    renderResult(displayName, displayLevel, data.levels || [], unitType, displayMaxes);
    setStatus("ready", "RECORD FOUND");
  } catch (err) {
    renderMessage(err.message, true);
    setStatus("error", "FETCH FAILED");
  }
}

const debouncedRun = debounce(runSearch, 120);

efSelect.addEventListener("change", runSearch);

efSearch.addEventListener("input", () => {
  activeSearchIndex = -1;
  renderSearchList();
  if (searchMatches.length === 0) {
    closeSearchList();
  } else {
    openSearchList();
  }
});

efSearch.addEventListener("focus", () => {
  renderSearchList();
  if (searchMatches.length > 0) openSearchList();
});

efSearch.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (searchMatches.length === 0) return;
    const next =
      activeSearchIndex +
      (e.key === "ArrowDown" ? 1 : -1);
    highlightSearchItem(
      next < 0 ? searchMatches.length - 1 : next % searchMatches.length
    );
  } else if (e.key === "Enter") {
    if (activeSearchIndex >= 0) {
      e.preventDefault();
      selectSearchUnit(searchMatches[activeSearchIndex].id);
    }
  } else if (e.key === "Escape") {
    closeSearchList();
  }
});

efSearch.addEventListener("blur", () => closeSearchList());

efSearchList.addEventListener("mousedown", (e) => {
  const item = e.target.closest(".combo__item");
  if (!item) return;
  e.preventDefault();
  selectSearchUnit(item.dataset.id);
});

levelSlider.addEventListener("input", () => {
  levelInput.value = levelSlider.value;
  updateArrowState();
  debouncedRun();
});

levelDown.addEventListener("click", () => setLevel(currentLevel() - 1));
levelUp.addEventListener("click", () => setLevel(currentLevel() + 1));

techToggle.addEventListener("click", () => {
  techEnabled = !techEnabled;
  techToggle.textContent = techEnabled ? "Max Tech Upgrades" : "No Tech Upgrades";
  techToggle.setAttribute("aria-pressed", String(techEnabled));
  runSearch();
});

levelInput.addEventListener("input", () => {
  const value = parseInt(levelInput.value, 10);
  if (!Number.isNaN(value) && value >= MIN_LEVEL && value <= MAX_LEVEL) {
    levelSlider.value = value;
    updateArrowState();
  }
});
levelInput.addEventListener("change", () => setLevel(levelInput.value));

loadUnits()
  .then((units) => {
    ALL_UNITS = units;
    buildTypeButtons();
    applyTypeFilter("infantry");
  })
  .catch((err) => {
    renderMessage(
      `Could not load units: ${err.message}. Make sure data/units.json exists (run node generate-manifest.js) and that unit files are committed.`,
      true
    );
    setStatus("error", "NO UNITS");
  });

loadWhatsNew();