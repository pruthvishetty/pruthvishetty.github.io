// Shetty Family Tree
// ---------------------------------------------------------------
// Persistence: PUT /api/data after every mutation (debounced). When the API
// isn't available the page still loads from the inlined data/bundle.js but
// will warn that edits won't persist.
// Views: Tree (descendant chart) | Relations (egocentric force graph).
// ---------------------------------------------------------------

const ROOT_DEFAULT = "I1"; // Ramayya Shetty
const CARD_W = 188;
const CARD_H = 96;
const NODE_H_SPACING = 12;
const NODE_V_SPACING = 96;
const SPOUSE_DX = CARD_W + 20;
const MIN_FIT_SCALE = 0.32;
const SAVE_DEBOUNCE_MS = 350;

const THEME_KEY = "shetty-tree-theme";
const VIEW_KEY = "shetty-tree-view";
const FOCUS_KEY = "shetty-tree-focus";

// Default kin layers shown in Relations view — extras are opt-in via chips.
const DEFAULT_KIN = new Set(["parents", "siblings", "partner", "children"]);
const ALL_KIN_LAYERS = [
  { key: "parents",        label: "Parents",        always: true },
  { key: "siblings",       label: "Siblings",       always: true },
  { key: "partner",        label: "Partner",        always: true },
  { key: "children",       label: "Children",       always: true },
  { key: "grandparents",   label: "Grandparents",   always: false },
  { key: "grandchildren",  label: "Grandchildren",  always: false },
  { key: "auntsUncles",    label: "Aunts & uncles", always: false },
  { key: "firstCousins",   label: "First cousins",  always: false },
  { key: "secondCousins",  label: "Second cousins", always: false },
  { key: "inLaws",         label: "In-laws",        always: false },
];

const state = {
  people: {},
  families: {},
  meta: {},
  rootId: ROOT_DEFAULT,
  focusId: ROOT_DEFAULT,     // who Relations view orbits around
  view: "tree",              // "tree" | "relations"
  collapsed: new Set(),
  editMode: false,
  apiAvailable: false,
  saveTimer: null,
  inFlight: 0,
  kinLayers: new Set(DEFAULT_KIN), // which kin types Relations view shows
};

// ───────────── Bootstrap ─────────────

initTheme();

loadData()
  .then(({ people, families, meta, fromApi }) => {
    state.people = people;
    state.families = families;
    state.meta = meta;
    state.apiAvailable = fromApi;
    initUI();
    render({ resetZoom: true });
    populatePlaceDatalist();
  })
  .catch((err) => {
    document.body.innerHTML =
      `<div style="padding:32px;font-family:sans-serif;color:var(--ink);background:var(--bg);height:100vh;">
        <h2 style="font-family:'Fraunces',serif;">Couldn't load family data</h2>
        <p style="color:var(--muted);">${err.message}</p>
        <p>Run <code>python3 scripts/serve.py</code> from the project root then open <a style="color:var(--accent)" href="http://localhost:7777">http://localhost:7777</a>.</p>
      </div>`;
  });

// ───────────── Data loading ─────────────

async function loadData() {
  // Prefer the live API
  try {
    const r = await fetch("/api/data", { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      return { ...d, fromApi: true };
    }
  } catch (_) { /* fall through */ }
  // Fallback: inlined bundle (file:// or offline)
  if (window.__SHETTY_DATA__) {
    const { people, families, meta } = window.__SHETTY_DATA__;
    return { people, families, meta, fromApi: false };
  }
  // Last resort: raw JSON files
  const [p, f, m] = await Promise.all([
    fetch("./data/people.json").then((r) => r.json()),
    fetch("./data/families.json").then((r) => r.json()),
    fetch("./data/meta.json").then((r) => r.json()),
  ]);
  return { people: p, families: f, meta: m, fromApi: false };
}

function setSaveState(s, msg) {
  const el = document.getElementById("save-indicator");
  if (!el) return;
  el.dataset.state = s;
  const text = el.querySelector(".text");
  if (text) text.textContent = msg || (s === "saving" ? "Saving…" : s === "saved" ? "Saved" : s === "error" ? (msg || "Save failed") : "");
  if (s === "saved") {
    clearTimeout(setSaveState._t);
    setSaveState._t = setTimeout(() => { el.dataset.state = "idle"; }, 1400);
  }
}

function scheduleSave() {
  if (!state.apiAvailable) return; // can't save without backend
  state.pendingSave = true;
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(saveNow, SAVE_DEBOUNCE_MS);
}

async function saveNow() {
  if (!state.apiAvailable) return;
  if (state.inFlight > 0) {
    // A save is currently happening — queue another after it completes.
    state.queuedSave = true;
    return;
  }
  state.pendingSave = false;
  setSaveState("saving");
  state.inFlight++;
  try {
    const r = await fetch("/api/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ people: state.people, families: state.families }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      const detail = (err.details && err.details[0]) ? err.details[0] : "";
      setSaveState("error", `${err.error || `HTTP ${r.status}`}${detail ? " · " + detail : ""}`);
      console.warn("Save failed:", err);
      return;
    }
    const resp = await r.json();
    if (resp.meta) state.meta = resp.meta;
    setSaveState("saved");
    populatePlaceDatalist();
  } catch (e) {
    setSaveState("error", e.message);
    console.warn("Save error:", e);
  } finally {
    state.inFlight--;
    // If another change came in while saving, fire a follow-up.
    if (state.queuedSave) {
      state.queuedSave = false;
      setTimeout(saveNow, 0);
    }
  }
}

function persist() { scheduleSave(); }

// Best-effort synchronous save when the page is about to close — uses
// navigator.sendBeacon which the browser is willing to fire during unload.
// This is the safety net against "tab closed before debounce fired" data loss.
function flushOnUnload() {
  if (!state.apiAvailable) return;
  if (!state.pendingSave) return;
  try {
    const blob = new Blob(
      [JSON.stringify({ people: state.people, families: state.families })],
      { type: "application/json" }
    );
    navigator.sendBeacon("/api/data", blob);
  } catch (_) { /* best effort */ }
}
window.addEventListener("beforeunload", flushOnUnload);
window.addEventListener("pagehide", flushOnUnload);
// Also flush when the tab becomes hidden (mobile background, switch tabs)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flushOnUnload();
});

// ───────────── UI init ─────────────

function initUI() {
  document.getElementById("meta-line").textContent = `${state.meta.counts.people} people · ${state.meta.counts.families} families`;
  document.getElementById("counts").textContent = state.apiAvailable ? "" : "Read-only — start the server with python3 scripts/serve.py";

  document.getElementById("detail-close").addEventListener("click", closeDetail);

  document.getElementById("reset-view").addEventListener("click", () => {
    state.rootId = ROOT_DEFAULT;
    state.collapsed.clear();
    render({ resetZoom: true });
  });
  document.getElementById("expand-all").addEventListener("click", () => {
    state.collapsed.clear();
    render();
  });
  document.getElementById("collapse-all").addEventListener("click", () => {
    state.collapsed.clear();
    const root = buildHierarchy(state.rootId);
    if (!root) return;
    (function walk(node, depth) {
      if (depth >= 2 && node._allChildren?.length) state.collapsed.add(node.id);
      (node._allChildren || []).forEach((c) => walk(c, depth + 1));
    })(root, 0);
    render();
  });

  // View toggle
  document.querySelectorAll(".view-toggle .seg-btn").forEach((b) => {
    b.addEventListener("click", () => setView(b.dataset.view));
  });
  const savedView = (() => { try { return localStorage.getItem(VIEW_KEY) || "tree"; } catch { return "tree"; } })();
  if (savedView === "relations") setView("relations");

  // Theme toggle
  document.getElementById("theme-toggle").addEventListener("click", toggleTheme);

  initSearch();
  initEditMode();
  initKeyboard();

  window.addEventListener("resize", () => { measureSvg(); });
}

function initKeyboard() {
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "Escape") closeDetail();
    if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      document.getElementById("search").focus();
    }
  });
}

// ───────────── Theme ─────────────

function initTheme() {
  let saved = "auto";
  try { saved = localStorage.getItem(THEME_KEY) || "auto"; } catch (_) {}
  document.documentElement.setAttribute("data-theme", saved);
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme") || "auto";
  // Cycle: auto → light → dark → auto
  const next = cur === "auto" ? "light" : cur === "light" ? "dark" : "auto";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem(THEME_KEY, next); } catch (_) {}
}

// ───────────── View toggle ─────────────

function setView(v) {
  state.view = v;
  document.querySelectorAll(".view-toggle .seg-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === v);
  });
  try { localStorage.setItem(VIEW_KEY, v); } catch (_) {}
  // Hide tree-only controls when in relations view
  const treeControls = document.querySelectorAll(".controls .seg:not(.view-toggle)");
  treeControls.forEach((c) => c.style.display = v === "relations" ? "none" : "");
  // Kin chip bar only in relations view
  const kinBar = document.getElementById("kin-bar");
  if (kinBar) kinBar.hidden = v !== "relations";
  render({ resetZoom: true });
}

// ───────────── Edit mode ─────────────

function initEditMode() {
  const btn = document.getElementById("edit-toggle");
  if (btn) {
    const label = btn.querySelector(".label");
    btn.addEventListener("click", () => {
      state.editMode = !state.editMode;
      btn.classList.toggle("active", state.editMode);
      if (label) label.textContent = state.editMode ? "Editing" : "Edit";
      render();
      const openId = document.getElementById("detail-body")?.dataset?.personId;
      if (openId) openDetail(openId);
    });
  }
  document.getElementById("modal-close")?.addEventListener("click", closeModal);
  document.querySelector(".modal-backdrop")?.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !document.getElementById("modal-root").hidden) closeModal();
  });
}

function nextId(prefix, dict) {
  let max = 0;
  for (const k of Object.keys(dict)) {
    const m = k.match(new RegExp(`^${prefix}(\\d+)$`));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${max + 1}`;
}

// ───────────── Modal helpers ─────────────

function openModal(contentEl) {
  const root = document.getElementById("modal-root");
  const body = document.getElementById("modal-body");
  body.innerHTML = "";
  body.appendChild(contentEl);
  root.hidden = false;
  setTimeout(() => {
    const f = body.querySelector("input, select, textarea, button");
    if (f) f.focus();
  }, 30);
}
function closeModal() { document.getElementById("modal-root").hidden = true; }

// ───────────── Smart suggestion helpers ─────────────

function uniquePlaces() {
  const seen = new Set();
  for (const p of Object.values(state.people)) {
    if (p.birth?.place) seen.add(p.birth.place);
    if (p.death?.place) seen.add(p.death.place);
  }
  for (const f of Object.values(state.families)) {
    if (f.marriage?.place) seen.add(f.marriage.place);
  }
  return [...seen].sort();
}
function populatePlaceDatalist() {
  const list = document.getElementById("known-places");
  if (!list) return;
  list.innerHTML = uniquePlaces().map((p) => `<option value="${escapeHtml(p)}">`).join("");
}
function findDuplicateName(displayName) {
  const trimmed = (displayName || "").trim().toLowerCase();
  if (!trimmed) return null;
  return Object.values(state.people).find((p) => (p.name.display || "").trim().toLowerCase() === trimmed);
}

// ───────────── Add Person flow ─────────────

function openAddPersonModal({ role, anchorPersonId }) {
  // role = "spouse" | "child" | "parent" | "sibling"
  const anchor = state.people[anchorPersonId];
  if (!anchor) return;

  // Pre-flight guards
  if (role === "parent") {
    const fam = anchor.parents_family ? state.families[anchor.parents_family] : null;
    if (fam && fam.husband && fam.wife) {
      alert(`${displayName(anchor)} already has two parents recorded. Edit them individually if you need to change names.`);
      return;
    }
  }

  const newPid = nextId("I", state.people);

  // Smart defaults — surname defaults to "Shetty" unless the anchor has a
  // non-Shetty surname that the new person would naturally inherit.
  let defaultSurname = "Shetty", defaultSex = "U", suggestionHtml = "";
  if (role === "spouse") {
    defaultSex = anchor.sex === "M" ? "F" : anchor.sex === "F" ? "M" : "U";
    if ((anchor.spouse_families || []).length > 0) {
      suggestionHtml = `<div class="suggest">${escapeHtml(displayName(anchor))} already has ${anchor.spouse_families.length} recorded partner${anchor.spouse_families.length > 1 ? "s" : ""}. This adds a separate marriage.</div>`;
    }
  } else if (role === "child") {
    defaultSurname = anchor.name.surname || "Shetty";
    const fams = anchor.spouse_families || [];
    if (fams.length === 0) {
      suggestionHtml = `<div class="suggest"><b>No partner recorded yet</b> for ${escapeHtml(displayName(anchor))}. A single-parent family will be created — consider adding the partner first to keep both parents linked.</div>`;
    }
  } else if (role === "parent") {
    const fam = anchor.parents_family ? state.families[anchor.parents_family] : null;
    if (fam) {
      if (!fam.husband) defaultSex = "M";
      else if (!fam.wife) defaultSex = "F";
    }
    // Father typically shares surname with the child; mother often does too in this tree.
    defaultSurname = anchor.name.surname || "Shetty";
  } else if (role === "sibling") {
    defaultSurname = anchor.name.surname || "Shetty";
    if (!anchor.parents_family) {
      suggestionHtml = `<div class="suggest"><b>No parents recorded</b> for ${escapeHtml(displayName(anchor))}. A new parents-family will be created with no parents listed; you can add the parents afterward.</div>`;
    }
  }

  const titleByRole = { spouse: "Add partner", child: "Add child", parent: "Add parent", sibling: "Add sibling" };
  const subByRole = {
    spouse: `as partner of <b>${escapeHtml(displayName(anchor))}</b>`,
    child: `as child of <b>${escapeHtml(displayName(anchor))}</b>`,
    parent: `as parent of <b>${escapeHtml(displayName(anchor))}</b>`,
    sibling: `as sibling of <b>${escapeHtml(displayName(anchor))}</b>`,
  };

  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <h3>${titleByRole[role]}</h3>
    <div class="sub">${subByRole[role]}</div>
    ${suggestionHtml}

    <div class="seg mode-toggle" role="group" style="display:flex; margin-bottom: 18px;">
      <button type="button" class="seg-btn active" data-mode="new">Create new</button>
      <button type="button" class="seg-btn" data-mode="link">Link existing</button>
    </div>

    <div id="mode-new">
      <div class="form-row"><label for="f-given">Given name</label><input id="f-given" type="text" autocomplete="off" /></div>
      <div class="form-row"><label for="f-surname">Surname</label><input id="f-surname" type="text" value="${escapeHtml(defaultSurname)}" autocomplete="off" /></div>
      <div class="form-row"><label for="f-sex">Gender</label>
        <select id="f-sex">
          <option value="M" ${defaultSex === "M" ? "selected" : ""}>Male</option>
          <option value="F" ${defaultSex === "F" ? "selected" : ""}>Female</option>
          <option value="U" ${defaultSex === "U" ? "selected" : ""}>Unspecified</option>
        </select>
      </div>
      <div class="form-row"><label for="f-birth">Born</label><input id="f-birth" type="text" placeholder="e.g. 12 MAR 1995 or 1995" /></div>
      <div class="form-row"><label for="f-place">Birth place</label><input id="f-place" type="text" list="known-places" placeholder="optional" /></div>
      <div class="form-row"><label for="f-dead">Deceased</label><div class="inline"><input id="f-dead" type="checkbox" /><span>Yes, no longer with us</span></div></div>
      <div class="form-row" id="death-date-row" style="display:none;"><label for="f-death">Died</label><input id="f-death" type="text" placeholder="e.g. 2010 (optional)" /></div>
      ${role === "child" ? renderFamilyPicker(anchor) : ""}
      <div id="dup-warn"></div>
    </div>

    <div id="mode-link" style="display:none;">
      <div class="suggest">Pick someone already in the tree to attach as ${role}. Their existing details stay; just the relationship is added.</div>
      <div class="form-row"><label for="link-pick">Person</label>
        <select id="link-pick">
          <option value="">— search / choose —</option>
          ${Object.values(state.people)
            .filter((p) => p.id !== anchorPersonId)
            .sort((a, b) => displayName(a).localeCompare(displayName(b)))
            .map((p) => `<option value="${p.id}">${escapeHtml(displayName(p))}${p.name?.surname && p.name.surname !== "Shetty" ? "" : ""} · ${escapeHtml(p.id)}</option>`).join("")}
        </select>
      </div>
      ${role === "child" ? renderFamilyPicker(anchor) : ""}
      <div id="link-warn"></div>
    </div>

    <div class="form-actions">
      <div class="spacer"></div>
      <button class="quiet" id="f-cancel">Cancel</button>
      <button class="primary" id="f-save">Add ${role}</button>
    </div>
  `;

  // Tab toggle
  wrap.querySelectorAll(".mode-toggle .seg-btn").forEach((b) => {
    b.addEventListener("click", () => {
      wrap.querySelectorAll(".mode-toggle .seg-btn").forEach((x) => x.classList.toggle("active", x === b));
      const isLink = b.dataset.mode === "link";
      wrap.querySelector("#mode-new").style.display = isLink ? "none" : "";
      wrap.querySelector("#mode-link").style.display = isLink ? "" : "none";
    });
  });
  // When picking an existing person, warn about conflicts
  wrap.querySelector("#link-pick")?.addEventListener("change", (e) => {
    const pickId = e.target.value;
    if (!pickId) { wrap.querySelector("#link-warn").innerHTML = ""; return; }
    wrap.querySelector("#link-warn").innerHTML = describeLinkConflict(role, anchor, state.people[pickId]);
  });

  // Wiring
  const updateDup = () => {
    const given = wrap.querySelector("#f-given").value.trim();
    const surname = wrap.querySelector("#f-surname").value.trim();
    const display = [given, surname].filter(Boolean).join(" ");
    const dup = findDuplicateName(display);
    const warn = wrap.querySelector("#dup-warn");
    warn.innerHTML = dup
      ? `<div class="suggest">A person named <b>${escapeHtml(displayName(dup))}</b> already exists. If this is the same person, link them by editing the existing entry instead of creating a duplicate.</div>`
      : "";
  };
  wrap.querySelector("#f-given").addEventListener("input", updateDup);
  wrap.querySelector("#f-surname").addEventListener("input", updateDup);
  wrap.querySelector("#f-dead").addEventListener("change", (e) => {
    wrap.querySelector("#death-date-row").style.display = e.target.checked ? "" : "none";
  });
  wrap.querySelector("#f-cancel").addEventListener("click", closeModal);
  wrap.querySelector("#f-save").addEventListener("click", () => {
    const mode = wrap.querySelector(".mode-toggle .seg-btn.active")?.dataset?.mode || "new";

    if (mode === "link") {
      const pickId = wrap.querySelector("#link-pick").value;
      if (!pickId || !state.people[pickId]) { alert("Pick an existing person."); return; }
      const existing = state.people[pickId];
      if (role === "spouse") addSpouseRelation(anchor, existing);
      else if (role === "parent") addParentRelation(anchor, existing);
      else if (role === "sibling") addSiblingRelation(anchor, existing);
      else {
        const familyChoice = wrap.querySelector('#mode-link input[name="family-choice"]:checked')?.value
                         || wrap.querySelector('#mode-link input[name="family-choice"]')?.value
                         || "__new__";
        addChildRelation(anchor, existing, familyChoice);
      }
      closeModal();
      persist();
      // Adding a parent shifts the topmost ancestor — re-anchor the tree root so the new parent renders.
      if (role === "parent") focusPerson(anchor.id);
      else render();
      openDetail(pickId);
      return;
    }

    // Create-new path
    const given = wrap.querySelector("#f-given").value.trim();
    const surname = wrap.querySelector("#f-surname").value.trim();
    if (!given && !surname) {
      alert("Please enter at least a given name or surname.");
      return;
    }
    const sex = wrap.querySelector("#f-sex").value;
    const birthDate = wrap.querySelector("#f-birth").value.trim();
    const birthPlace = wrap.querySelector("#f-place").value.trim();
    const isDead = wrap.querySelector("#f-dead").checked;
    const deathDate = isDead ? wrap.querySelector("#f-death").value.trim() : "";

    const newPerson = makePerson(newPid, { given, surname, sex, birthDate, birthPlace, isDead, deathDate });
    state.people[newPid] = newPerson;

    if (role === "spouse") addSpouseRelation(anchor, newPerson);
    else if (role === "parent") addParentRelation(anchor, newPerson);
    else if (role === "sibling") addSiblingRelation(anchor, newPerson);
    else {
      const familyChoice = wrap.querySelector('#mode-new input[name="family-choice"]:checked')?.value
                       || wrap.querySelector('#mode-new input[name="family-choice"]')?.value
                       || "__new__";
      addChildRelation(anchor, newPerson, familyChoice);
    }

    closeModal();
    persist();
    if (role === "parent") focusPerson(anchor.id);
    else render();
    openDetail(newPid);
  });

  openModal(wrap);
}

function renderFamilyPicker(anchor) {
  const fams = (anchor.spouse_families || []).map((fid) => state.families[fid]).filter(Boolean);
  if (fams.length === 0) {
    return `<div class="form-row"><label>Family</label><span style="font-size:13px;color:var(--muted);">A new single-parent family will be created.</span></div>`;
  }
  if (fams.length === 1) {
    const f = fams[0];
    const partnerId = f.husband === anchor.id ? f.wife : f.husband;
    const partner = partnerId ? state.people[partnerId] : null;
    return `<div class="form-row"><label>Family</label><div style="font-size:13px;color:var(--ink);">Adding to existing family with <b>${partner ? escapeHtml(displayName(partner)) : "(unknown partner)"}</b>
      <input type="hidden" name="family-choice" value="${f.id}" /></div></div>`;
  }
  const opts = fams.map((f, i) => {
    const partnerId = f.husband === anchor.id ? f.wife : f.husband;
    const partner = partnerId ? state.people[partnerId] : null;
    return `<label class="opt"><input type="radio" name="family-choice" value="${f.id}" ${i === 0 ? "checked" : ""} /> with <b style="margin-left:4px;">${partner ? escapeHtml(displayName(partner)) : "(unknown)"}</b></label>`;
  }).join("");
  return `<div class="form-row"><label>Family</label><div class="family-picker">${opts}<label class="opt"><input type="radio" name="family-choice" value="__new__" /> Different / new partner</label></div></div>`;
}

function makePerson(pid, { given, surname, sex, birthDate, birthPlace, isDead, deathDate }) {
  const display = [given, surname].filter(Boolean).join(" ").trim() || "(unnamed)";
  const birth = (birthDate || birthPlace) ? { date: birthDate || null, place: birthPlace || null } : null;
  let death = null;
  if (isDead) {
    death = deathDate ? { date: deathDate, place: null } : { date: null, place: null, recorded: true };
  }
  return {
    id: pid,
    name: { given: given || null, surname: surname || null, suffix: null, display },
    sex,
    birth,
    death,
    is_dead: !!isDead,
    photo: null,
    parents_family: null,
    spouse_families: [],
    notes: null,
  };
}

function describeLinkConflict(role, anchor, candidate) {
  if (!candidate) return "";
  const warn = [];
  if (role === "spouse") {
    if ((candidate.spouse_families || []).length > 0) {
      const others = candidate.spouse_families.map((fid) => state.families[fid]).filter(Boolean);
      for (const f of others) {
        const partnerId = f.husband === candidate.id ? f.wife : f.husband;
        if (partnerId && partnerId !== anchor.id) {
          const partner = state.people[partnerId];
          warn.push(`Already married to <b>${escapeHtml(displayName(partner))}</b> (${f.id}).`);
        } else if (!partnerId) {
          warn.push(`Already in family ${f.id} with an unknown partner — consider filling that instead.`);
        }
      }
    }
  } else if (role === "parent") {
    if (anchor.parents_family) {
      const f = state.families[anchor.parents_family];
      if (f) {
        const filled = (f.husband ? 1 : 0) + (f.wife ? 1 : 0);
        if (filled === 2) warn.push(`${escapeHtml(displayName(anchor))} already has two parents recorded.`);
      }
    }
  } else if (role === "sibling") {
    if (candidate.parents_family && anchor.parents_family && candidate.parents_family !== anchor.parents_family) {
      warn.push(`${escapeHtml(displayName(candidate))} already belongs to a different parents-family (${escapeHtml(candidate.parents_family)}). Linking will <b>move</b> them.`);
    }
  } else if (role === "child") {
    if (candidate.parents_family) {
      warn.push(`${escapeHtml(displayName(candidate))} already has parents recorded (${escapeHtml(candidate.parents_family)}). Linking will <b>move</b> them to ${escapeHtml(displayName(anchor))}'s family.`);
    }
  }
  return warn.length ? `<div class="suggest">${warn.join("<br/>")}</div>` : "";
}

function addSpouseRelation(anchor, otherPerson) {
  // First check: are they ALREADY linked? Don't create a duplicate family.
  for (const fid of anchor.spouse_families || []) {
    const f = state.families[fid];
    if (!f) continue;
    if (f.husband === otherPerson.id || f.wife === otherPerson.id) {
      // Already a couple — nothing to do.
      return fid;
    }
    // If anchor has a family with an empty slot of the right sex, fill it instead of creating a new family.
    if (!f.husband && otherPerson.sex === "M") { f.husband = otherPerson.id; bidi_add(otherPerson, "spouse_families", fid); return fid; }
    if (!f.wife && otherPerson.sex === "F") { f.wife = otherPerson.id; bidi_add(otherPerson, "spouse_families", fid); return fid; }
  }
  const fid = nextId("F", state.families);
  const husband = anchor.sex === "M" ? anchor.id : otherPerson.sex === "M" ? otherPerson.id : null;
  const wife = anchor.sex === "F" ? anchor.id : otherPerson.sex === "F" ? otherPerson.id : null;
  state.families[fid] = {
    id: fid,
    husband: husband || anchor.id,
    wife: wife || otherPerson.id,
    children: [],
    marriage: null,
  };
  bidi_add(anchor, "spouse_families", fid);
  bidi_add(otherPerson, "spouse_families", fid);
  return fid;
}

function bidi_add(person, key, value) {
  person[key] = person[key] || [];
  if (!person[key].includes(value)) person[key].push(value);
}

function addParentRelation(anchor, otherPerson) {
  let fid = anchor.parents_family;
  let fam;
  if (!fid) {
    fid = nextId("F", state.families);
    fam = { id: fid, husband: null, wife: null, children: [anchor.id], marriage: null };
    state.families[fid] = fam;
    anchor.parents_family = fid;
  } else {
    fam = state.families[fid];
    if (!fam) {
      fam = { id: fid, husband: null, wife: null, children: [anchor.id], marriage: null };
      state.families[fid] = fam;
    }
    if (!fam.children.includes(anchor.id)) fam.children.push(anchor.id);
  }
  if (fam.husband === otherPerson.id || fam.wife === otherPerson.id) return;
  if (otherPerson.sex === "M" && !fam.husband) fam.husband = otherPerson.id;
  else if (otherPerson.sex === "F" && !fam.wife) fam.wife = otherPerson.id;
  else if (!fam.husband) fam.husband = otherPerson.id;
  else if (!fam.wife) fam.wife = otherPerson.id;
  bidi_add(otherPerson, "spouse_families", fid);
}

// Remove the shared-parents-family link so `other` is no longer recorded as
// `anchor`'s sibling. `anchor` stays put; `other` is detached from the family.
// If the family ends up empty (no parents and no children), it's deleted.
function unlinkSibling(anchor, other) {
  const fid = anchor.parents_family;
  if (!fid || other.parents_family !== fid) return;
  const fam = state.families[fid];
  if (!fam) return;
  fam.children = (fam.children || []).filter((c) => c !== other.id);
  other.parents_family = null;
  if (!fam.husband && !fam.wife && fam.children.length === 0) {
    delete state.families[fid];
    anchor.parents_family = null;
  }
}

function addSiblingRelation(anchor, otherPerson) {
  let fid = anchor.parents_family;
  if (!fid) {
    // Create an empty parents-family so both share it; the user can add parents later.
    fid = nextId("F", state.families);
    state.families[fid] = { id: fid, husband: null, wife: null, children: [anchor.id], marriage: null };
    anchor.parents_family = fid;
  }
  const fam = state.families[fid];
  if (!fam.children.includes(otherPerson.id)) fam.children.push(otherPerson.id);
  // If sibling is being moved from another parents_family, detach them there
  if (otherPerson.parents_family && otherPerson.parents_family !== fid) {
    const prev = state.families[otherPerson.parents_family];
    if (prev) prev.children = (prev.children || []).filter((c) => c !== otherPerson.id);
  }
  otherPerson.parents_family = fid;
}

function addChildRelation(anchor, otherPerson, familyChoice) {
  let fid;
  const existing = anchor.spouse_families || [];
  if (familyChoice && familyChoice !== "__new__") {
    fid = familyChoice;
  } else if (!familyChoice && existing.length === 1) {
    fid = existing[0];
  } else {
    fid = nextId("F", state.families);
    state.families[fid] = {
      id: fid,
      husband: anchor.sex === "M" ? anchor.id : null,
      wife: anchor.sex === "F" ? anchor.id : null,
      children: [],
      marriage: null,
    };
    bidi_add(anchor, "spouse_families", fid);
  }
  const fam = state.families[fid];
  if (!fam.children.includes(otherPerson.id)) fam.children.push(otherPerson.id);
  // If the child is being moved from another parents_family, detach
  if (otherPerson.parents_family && otherPerson.parents_family !== fid) {
    const prev = state.families[otherPerson.parents_family];
    if (prev) prev.children = (prev.children || []).filter((c) => c !== otherPerson.id);
  }
  otherPerson.parents_family = fid;
}

// ───────────── Edit existing ─────────────

function openEditPersonModal(pid) {
  const p = state.people[pid];
  if (!p) return;

  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <h3>Edit person</h3>
    <div class="sub">${escapeHtml(p.id)} · was <b>${escapeHtml(displayName(p))}</b></div>

    <div class="form-row"><label for="f-given">Given name</label><input id="f-given" type="text" value="${escapeHtml(p.name.given || "")}" /></div>
    <div class="form-row"><label for="f-surname">Surname</label><input id="f-surname" type="text" value="${escapeHtml(p.name.surname || "")}" /></div>
    <div class="form-row"><label for="f-sex">Gender</label>
      <select id="f-sex">
        <option value="M" ${p.sex === "M" ? "selected" : ""}>Male</option>
        <option value="F" ${p.sex === "F" ? "selected" : ""}>Female</option>
        <option value="U" ${(!p.sex || p.sex === "U") ? "selected" : ""}>Unspecified</option>
      </select>
    </div>
    <div class="form-row"><label for="f-birth">Born</label><input id="f-birth" type="text" value="${escapeHtml(p.birth?.date || "")}" placeholder="e.g. 1958" /></div>
    <div class="form-row"><label for="f-place">Birth place</label><input id="f-place" type="text" value="${escapeHtml(p.birth?.place || "")}" list="known-places" /></div>
    <div class="form-row"><label for="f-dead">Deceased</label><div class="inline"><input id="f-dead" type="checkbox" ${p.is_dead ? "checked" : ""} /><span>No longer with us</span></div></div>
    <div class="form-row" id="death-date-row" style="display:${p.is_dead ? "" : "none"};"><label for="f-death">Died</label><input id="f-death" type="text" value="${escapeHtml(p.death?.date || "")}" placeholder="optional date" /></div>
    <div class="form-row"><label for="f-notes">Notes</label><input id="f-notes" type="text" value="${escapeHtml(p.notes || "")}" placeholder="optional" /></div>
    <div class="form-actions">
      <button class="danger" id="f-delete">Delete</button>
      <div class="spacer"></div>
      <button class="quiet" id="f-cancel">Cancel</button>
      <button class="primary" id="f-save">Save</button>
    </div>
  `;
  wrap.querySelector("#f-dead").addEventListener("change", (e) => {
    wrap.querySelector("#death-date-row").style.display = e.target.checked ? "" : "none";
  });
  wrap.querySelector("#f-cancel").addEventListener("click", closeModal);
  wrap.querySelector("#f-delete").addEventListener("click", () => {
    if (!confirm(`Delete ${displayName(p)}? They'll be removed from any families they're part of.`)) return;
    deletePerson(pid);
    closeModal();
    persist();
    render();
    closeDetail();
  });
  wrap.querySelector("#f-save").addEventListener("click", () => {
    const given = wrap.querySelector("#f-given").value.trim();
    const surname = wrap.querySelector("#f-surname").value.trim();
    const sex = wrap.querySelector("#f-sex").value;
    const birthDate = wrap.querySelector("#f-birth").value.trim();
    const birthPlace = wrap.querySelector("#f-place").value.trim();
    const isDead = wrap.querySelector("#f-dead").checked;
    const deathDate = isDead ? wrap.querySelector("#f-death").value.trim() : "";
    const notes = wrap.querySelector("#f-notes").value.trim();
    p.name = {
      given: given || null, surname: surname || null, suffix: p.name.suffix || null,
      display: [given, surname].filter(Boolean).join(" ").trim() || "(unnamed)",
    };
    p.sex = sex;
    p.birth = (birthDate || birthPlace) ? { date: birthDate || null, place: birthPlace || null } : null;
    p.is_dead = isDead;
    if (isDead) p.death = deathDate ? { date: deathDate, place: p.death?.place || null } : (p.death || { date: null, place: null, recorded: true });
    else p.death = null;
    p.notes = notes || null;
    closeModal();
    persist();
    render();
    openDetail(pid);
  });
  openModal(wrap);
}

// ───────────── Co-parent picker ─────────────

function openCoParentPicker(focalPersonId, familyId) {
  const focal = state.people[focalPersonId];
  const fam = state.families[familyId];
  if (!focal || !fam) return;

  // Which slot are we filling? The one that ISN'T the focal person.
  let slot;
  if (fam.husband === focalPersonId) slot = "wife";
  else if (fam.wife === focalPersonId) slot = "husband";
  else slot = focal.sex === "M" ? "wife" : focal.sex === "F" ? "husband" : "wife";

  const role = slot === "husband" ? "father" : "mother";
  const currentCoId = slot === "husband" ? fam.husband : fam.wife;
  const currentCo = currentCoId ? state.people[currentCoId] : null;
  const wantSex = slot === "husband" ? "M" : "F";

  const kids = (fam.children || []).map((cid) => state.people[cid]).filter(Boolean);
  const kidsList = kids.map((k) => displayName(k)).join(", ");

  // Smart suggestion: any other spouse_family of the focal person with a partner
  // of the right sex (and who isn't already someone in THIS family).
  const candidates = [];
  for (const fid of focal.spouse_families || []) {
    if (fid === familyId) continue;
    const f = state.families[fid];
    if (!f) continue;
    const partnerId = f.husband === focalPersonId ? f.wife : f.husband;
    if (!partnerId) continue;
    const partner = state.people[partnerId];
    if (!partner) continue;
    if (partner.sex && wantSex && partner.sex !== wantSex && wantSex !== "U") continue;
    candidates.push(partner);
  }
  // De-dupe
  const seen = new Set();
  const suggestions = candidates.filter((p) => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });

  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <h3>Who is the ${role}?</h3>
    <div class="sub">of ${escapeHtml(kidsList || "(no children listed)")} — currently ${currentCo ? `<b>${escapeHtml(displayName(currentCo))}</b>` : "<b>unknown</b>"}</div>

    ${suggestions.length ? `
      <div class="suggest"><b>Most likely:</b> ${escapeHtml(displayName(suggestions[0]))}${suggestions[0].sex === wantSex ? "" : ""}
        — ${escapeHtml(displayName(focal))}'s partner from another recorded marriage.
        ${kids.length ? `Selecting them will merge this family into that existing marriage record.` : ""}</div>
    ` : ""}

    <div class="form-row">
      <label>Pick</label>
      <select id="cp-pick">
        <option value="">— choose —</option>
        ${suggestions.map((p) => `<option value="${p.id}" ${p === suggestions[0] ? "selected" : ""}>${escapeHtml(displayName(p))} (suggested)</option>`).join("")}
        <option disabled>──────────</option>
        ${Object.values(state.people)
          .filter((p) => p.id !== focalPersonId && (!p.sex || !wantSex || p.sex === wantSex || wantSex === "U"))
          .sort((a, b) => displayName(a).localeCompare(displayName(b)))
          .slice(0, 300)
          .map((p) => `<option value="${p.id}">${escapeHtml(displayName(p))}${p.id === currentCoId ? " (current)" : ""}</option>`).join("")}
      </select>
    </div>

    <div class="form-row">
      <label>Or add</label>
      <button class="quiet" id="cp-add-new" style="justify-self:start;">Create new person…</button>
    </div>

    <div class="form-actions">
      ${currentCo ? `<button class="danger" id="cp-clear">Remove ${role}</button>` : ""}
      <div class="spacer"></div>
      <button class="quiet" id="cp-cancel">Cancel</button>
      <button class="primary" id="cp-save">Set ${role}</button>
    </div>
  `;

  wrap.querySelector("#cp-cancel").addEventListener("click", closeModal);
  // "Create new" inline — fills the SPECIFIC family slot instead of making a new family.
  wrap.querySelector("#cp-add-new")?.addEventListener("click", () => {
    const newForm = document.createElement("div");
    newForm.innerHTML = `
      <div class="suggest"><b>New ${role}</b> for ${escapeHtml(displayName(focal))} — will fill the existing family, not create a new one.</div>
      <div class="form-row"><label>Given name</label><input id="nf-given" type="text" autocomplete="off" /></div>
      <div class="form-row"><label>Surname</label><input id="nf-surname" type="text" value="Shetty" autocomplete="off" /></div>
      <div class="form-row"><label>Born</label><input id="nf-birth" type="text" placeholder="e.g. 1965" /></div>
      <div class="form-row"><label>Birth place</label><input id="nf-place" type="text" list="known-places" placeholder="optional" /></div>
      <div class="form-row"><label>Deceased</label><div class="inline"><input id="nf-dead" type="checkbox" /><span>No longer with us</span></div></div>
    `;
    // Replace the existing picker UI with the new-person form
    const pickerRow = wrap.querySelector("#cp-pick")?.closest(".form-row");
    const addBtnRow = wrap.querySelector("#cp-add-new")?.closest(".form-row");
    if (pickerRow) pickerRow.replaceWith(newForm);
    if (addBtnRow) addBtnRow.remove();
    const saveBtn = wrap.querySelector("#cp-save");
    if (saveBtn) saveBtn.textContent = `Add as ${role}`;
    // Swap the save handler to the "create new" path
    saveBtn?.replaceWith(saveBtn.cloneNode(true));
    wrap.querySelector("#cp-save").addEventListener("click", () => {
      const given = wrap.querySelector("#nf-given").value.trim();
      const surname = wrap.querySelector("#nf-surname").value.trim();
      if (!given && !surname) { alert("Please enter at least a given name."); return; }
      const birthDate = wrap.querySelector("#nf-birth").value.trim();
      const birthPlace = wrap.querySelector("#nf-place").value.trim();
      const isDead = wrap.querySelector("#nf-dead").checked;
      const newPid = nextId("I", state.people);
      const newPerson = makePerson(newPid, {
        given, surname, sex: wantSex,
        birthDate, birthPlace, isDead, deathDate: "",
      });
      state.people[newPid] = newPerson;
      // Fill the family slot directly
      fam[slot] = newPid;
      newPerson.spouse_families = [familyId];
      closeModal();
      persist();
      render();
      openDetail(focalPersonId);
    });
    setTimeout(() => wrap.querySelector("#nf-given")?.focus(), 30);
  });
  if (currentCo) {
    wrap.querySelector("#cp-clear").addEventListener("click", () => {
      // Remove the current co-parent from this family + their back-reference
      fam[slot] = null;
      const co = state.people[currentCoId];
      if (co) co.spouse_families = (co.spouse_families || []).filter((x) => x !== familyId);
      closeModal();
      persist();
      render();
      openDetail(focalPersonId);
    });
  }
  wrap.querySelector("#cp-save").addEventListener("click", () => {
    const pick = wrap.querySelector("#cp-pick").value;
    if (!pick) { alert("Pick someone or cancel."); return; }
    const newCo = state.people[pick];
    if (!newCo) return;

    // Fool-proof guard: if the focal person and the picked partner are ALREADY
    // recorded as spouses in another family, that other family IS this marriage —
    // merge children into it instead of producing a parallel record.
    let mergeTargetId = null;
    for (const fid of newCo.spouse_families || []) {
      if (fid === familyId) continue;
      const f = state.families[fid];
      if (!f) continue;
      const focalIsHere = f.husband === focalPersonId || f.wife === focalPersonId;
      const pickIsHere = f.husband === pick || f.wife === pick;
      if (focalIsHere && pickIsHere) { mergeTargetId = fid; break; }
    }

    if (mergeTargetId) {
      const src = state.families[familyId];
      const dst = state.families[mergeTargetId];
      for (const cid of src.children || []) {
        if (!dst.children.includes(cid)) dst.children.push(cid);
        const child = state.people[cid];
        if (child) child.parents_family = mergeTargetId;
      }
      if (!dst.marriage && src.marriage) dst.marriage = src.marriage;
      // Detach the old, empty family from both spouses.
      focal.spouse_families = (focal.spouse_families || []).filter((x) => x !== familyId);
      newCo.spouse_families = (newCo.spouse_families || []).filter((x) => x !== familyId);
      if (currentCoId && currentCoId !== pick) {
        const co = state.people[currentCoId];
        if (co) co.spouse_families = (co.spouse_families || []).filter((x) => x !== familyId);
      }
      delete state.families[familyId];
      closeModal();
      persist();
      render();
      openDetail(focalPersonId);
      return;
    }

    // If there's currently a different co-parent, detach them first.
    if (currentCoId && currentCoId !== pick) {
      const co = state.people[currentCoId];
      if (co) co.spouse_families = (co.spouse_families || []).filter((x) => x !== familyId);
    }
    fam[slot] = pick;
    if (!(newCo.spouse_families || []).includes(familyId)) {
      newCo.spouse_families = [...(newCo.spouse_families || []), familyId];
    }
    closeModal();
    persist();
    render();
    openDetail(focalPersonId);
  });

  openModal(wrap);
}

function deletePerson(pid) {
  const p = state.people[pid];
  if (!p) return;
  for (const fid of Object.keys(state.families)) {
    const f = state.families[fid];
    if (f.husband === pid) f.husband = null;
    if (f.wife === pid) f.wife = null;
    f.children = (f.children || []).filter((cid) => cid !== pid);
    if (!f.husband && !f.wife && f.children.length === 0) delete state.families[fid];
  }
  delete state.people[pid];
}

// ───────────── Search ─────────────

function initSearch() {
  const input = document.getElementById("search");
  const results = document.getElementById("search-results");
  let activeIndex = -1;
  let items = [];

  function renderResults(query) {
    const q = query.trim().toLowerCase();
    if (!q) { results.hidden = true; items = []; return; }
    items = Object.values(state.people)
      .filter((p) => (p.name.display || "").toLowerCase().includes(q))
      .slice(0, 12);
    if (!items.length) {
      results.innerHTML = `<li class="hint">No matches</li>`;
      results.hidden = false;
      return;
    }
    results.innerHTML = items.map((p, i) => {
      const hint = [p.birth?.place, p.death?.place].filter(Boolean)[0] || "";
      return `<li data-id="${p.id}" data-idx="${i}"><span>${escapeHtml(displayName(p))}</span><span class="hint">${escapeHtml(hint)}</span></li>`;
    }).join("");
    results.hidden = false;
    activeIndex = -1;
  }
  function pick(id) {
    if (!id) return;
    input.value = "";
    results.hidden = true;
    focusPerson(id);
    openDetail(id);
  }
  input.addEventListener("input", (e) => renderResults(e.target.value));
  input.addEventListener("focus", () => { if (input.value) renderResults(input.value); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, items.length - 1); paintActive(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); paintActive(); }
    else if (e.key === "Enter") { e.preventDefault(); if (activeIndex >= 0 && items[activeIndex]) pick(items[activeIndex].id); else if (items[0]) pick(items[0].id); }
    else if (e.key === "Escape") { results.hidden = true; }
  });
  results.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (li && li.dataset.id) pick(li.dataset.id);
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".search")) results.hidden = true; });

  function paintActive() {
    [...results.children].forEach((el, i) => el.classList.toggle("active", i === activeIndex));
  }
}

// ───────────── Tree data shape ─────────────

function buildHierarchy(rootId) {
  const seen = new Set();
  function visit(personId) {
    if (seen.has(personId)) return null;
    seen.add(personId);
    const p = state.people[personId];
    if (!p) return null;

    const spouses = [];
    const childrenNodes = [];
    for (const fid of p.spouse_families || []) {
      const fam = state.families[fid];
      if (!fam) continue;
      const spouseId = fam.husband === personId ? fam.wife : fam.husband;
      if (spouseId && state.people[spouseId]) {
        spouses.push({ person: state.people[spouseId], familyId: fid });
      }
      for (const cid of fam.children || []) {
        const child = visit(cid);
        if (child) childrenNodes.push(child);
      }
    }
    const node = { id: personId, person: p, spouses, _allChildren: childrenNodes };
    node.children = state.collapsed.has(personId) ? null : childrenNodes;
    return node;
  }
  return visit(rootId);
}

// ───────────── Avatar (canonical person icon + blue/pink by sex) ─────────────

// Sex-based background gradients. Blue for male, pink for female, neutral for unknown.
// Deceased people get a desaturated variant of the same hue.
const SEX_GRADIENTS = {
  M: ["#6FA8D9", "#3F78B8"],   // sky blue → deeper blue
  F: ["#EFA1B5", "#D26A85"],   // rose pink → deeper pink
  U: ["#B8B2A4", "#857F71"],   // warm neutral
};
function avatarGradient(sex, deceased) {
  const [a, b] = SEX_GRADIENTS[sex] || SEX_GRADIENTS.U;
  if (!deceased) return [a, b];
  return [desaturate(a, 0.6), desaturate(b, 0.6)];
}
function desaturate(hex, amount) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const grey = (r + g + b) / 3;
  const mix = (c) => Math.round(c * (1 - amount) + grey * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

// Canonical "person" head + shoulders bust (the same shape used by Material
// Symbols `person` / Bootstrap Icons `person-fill`). Coords are in a 24-unit
// viewBox so the path is the well-known one.
//   <head circle at 7> + rounded shoulders curving up to the head.
const PERSON_ICON_PATH =
  "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z";

function drawAvatar(parent, person, { r = 20 } = {}) {
  const [c1, c2] = avatarGradient(person.sex, person.is_dead);
  const gid = `g-${person.id}-${Math.random().toString(36).slice(2, 7)}`;
  const defs = parent.append("defs");
  const grad = defs.append("linearGradient").attr("id", gid)
    .attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "100%");
  grad.append("stop").attr("offset", "0%").attr("stop-color", c1);
  grad.append("stop").attr("offset", "100%").attr("stop-color", c2);

  parent.append("circle").attr("class", "bg").attr("r", r).attr("fill", `url(#${gid})`);
  if (person.is_dead) {
    parent.append("circle").attr("r", r - 1.5).attr("fill", "none")
      .attr("stroke", "rgba(255,255,255,0.55)")
      .attr("stroke-width", 0.9)
      .attr("stroke-dasharray", "1.5 2");
  }
  // Standard Material-style person icon, scaled to fit nicely inside the circle
  // and positioned so the head sits in the upper third.
  const iconScale = (r * 2 * 0.78) / 24; // icon fills ~78% of avatar
  parent.append("path")
    .attr("d", PERSON_ICON_PATH)
    .attr("fill", "rgba(255,255,255,0.95)")
    .attr("transform", `translate(${-12 * iconScale}, ${-12 * iconScale + r * 0.18}) scale(${iconScale})`);
  return gid;
}

function bigAvatarSVG(person) {
  const size = 88;
  const r = size / 2;
  const [c1, c2] = avatarGradient(person.sex, person.is_dead);
  const gid = `big-${person.id}`;
  const iconScale = (size * 0.78) / 24;
  const iconX = r - 12 * iconScale;
  const iconY = r - 12 * iconScale + size * 0.09;
  const ring = person.is_dead
    ? `<circle cx="${r}" cy="${r}" r="${r - 2}" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.2" stroke-dasharray="2 3"/>`
    : "";
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block;">
      <defs>
        <linearGradient id="${gid}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${c1}"/>
          <stop offset="100%" stop-color="${c2}"/>
        </linearGradient>
      </defs>
      <circle cx="${r}" cy="${r}" r="${r}" fill="url(#${gid})" />
      ${ring}
      <path d="${PERSON_ICON_PATH}" fill="rgba(255,255,255,0.95)" transform="translate(${iconX}, ${iconY}) scale(${iconScale})"/>
    </svg>`;
}

// ───────────── Tree render ─────────────

const svg = d3.select("#tree");
let svgWidth = 0, svgHeight = 0, zoomBehavior, viewport;

function ensureSvgSetup() {
  if (viewport) return;
  viewport = svg.append("g").attr("class", "viewport");
  let hintHidden = false;
  const hideHint = () => {
    if (hintHidden) return;
    hintHidden = true;
    const h = document.getElementById("hint");
    if (h) { h.style.opacity = "0"; setTimeout(() => h.remove(), 700); }
  };
  zoomBehavior = d3.zoom().scaleExtent([0.15, 2.6]).on("zoom", (event) => {
    viewport.attr("transform", event.transform.toString());
    if (event.sourceEvent) hideHint();
  });
  svg.call(zoomBehavior);
  svg.on("click", hideHint, { once: true });
}

function measureSvg() {
  const wrap = document.getElementById("canvas-wrap");
  svgWidth = wrap.clientWidth;
  svgHeight = wrap.clientHeight;
  svg.attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`).attr("width", svgWidth).attr("height", svgHeight);
}

function render(opts = {}) {
  ensureSvgSetup();
  measureSvg();
  viewport.selectAll("*").remove();
  if (state.view === "relations") return renderRelations(opts);
  return renderTree(opts);
}

function renderTree({ resetZoom = false } = {}) {
  const root = buildHierarchy(state.rootId);
  if (!root) return;

  const hierarchy = d3.hierarchy(root, (d) => d.children);
  const NODE_X = CARD_W + NODE_H_SPACING;
  const treeLayout = d3.tree()
    .nodeSize([NODE_X, CARD_H + NODE_V_SPACING])
    .separation((a, b) => {
      // d3.tree doesn't guarantee which of (a,b) is left vs right, so use the
      // max spouse count. Whichever node ends up on the left needs enough room
      // for its spouse cards to extend right into the gap without overlapping
      // the next sibling.
      const aSp = a.data.spouses?.length || 0;
      const bSp = b.data.spouses?.length || 0;
      const maxSpouseUnits = (Math.max(aSp, bSp) * SPOUSE_DX) / NODE_X;
      const baseGap = a.parent === b.parent ? 1.0 : 1.3;
      return baseGap + maxSpouseUnits + 0.1;
    });
  treeLayout(hierarchy);

  // Bounds
  let xL = Infinity, xR = -Infinity, yT = Infinity, yB = -Infinity;
  hierarchy.each((n) => {
    const sp = n.data.spouses?.length || 0;
    const left = n.x - CARD_W / 2;
    const right = n.x + CARD_W / 2 + sp * SPOUSE_DX;
    const top = n.y - CARD_H / 2;
    const bottom = n.y + CARD_H / 2 + (n.data._allChildren?.length ? 32 : 0);
    if (left < xL) xL = left;
    if (right > xR) xR = right;
    if (top < yT) yT = top;
    if (bottom > yB) yB = bottom;
  });

  // Draw orthogonal connectors org-chart style:
  //   1. Vertical stem dropping from the couple-midpoint of each parent
  //   2. Horizontal sibling bar at half-spacing below
  //   3. Vertical drop from the bar into each child's card top
  // This makes "child of these two" visually unambiguous.
  const linksLayer = viewport.append("g").attr("class", "links");
  // Group child links by parent so we can draw one shared sibling bar per parent.
  const linksByParent = new Map();
  for (const link of hierarchy.links()) {
    const arr = linksByParent.get(link.source) || [];
    arr.push(link.target);
    linksByParent.set(link.source, arr);
  }
  for (const [parentNode, children] of linksByParent) {
    const spouseCount = parentNode.data.spouses?.length || 0;
    const anchorX = parentNode.x + (spouseCount ? SPOUSE_DX / 2 : 0);
    const parentBottom = parentNode.y + CARD_H / 2;
    const childTop = children[0].y - CARD_H / 2;
    const busY = parentBottom + (childTop - parentBottom) / 2;

    // Vertical stem from parent down to bus
    linksLayer.append("path")
      .attr("class", "link")
      .attr("d", `M ${anchorX} ${parentBottom} V ${busY}`);

    // Horizontal bar at bus level — spans from the parent anchor across to all children.
    // (Even a single child needs this if its column is offset from the parent anchor,
    //  otherwise the two vertical segments don't visually connect.)
    const xs = children.map((c) => c.x).concat([anchorX]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    if (maxX > minX) {
      linksLayer.append("path")
        .attr("class", "link")
        .attr("d", `M ${minX} ${busY} H ${maxX}`);
    }

    // Vertical drop from bus into each child
    for (const child of children) {
      linksLayer.append("path")
        .attr("class", "link")
        .attr("d", `M ${child.x} ${busY} V ${childTop}`);
    }
  }

  // Compute the set of person IDs visible in THIS render so we can flag cards
  // whose owners have relations (siblings, parents) that exist in the data but
  // aren't shown in the current tree.
  const renderedIds = new Set();
  hierarchy.each((n) => {
    renderedIds.add(n.data.id);
    for (const sp of n.data.spouses || []) renderedIds.add(sp.person.id);
  });

  // Draw nodes
  const nodes = viewport.append("g").attr("class", "nodes")
    .selectAll(".node-group")
    .data(hierarchy.descendants(), (d) => d.data.id)
    .enter()
    .append("g")
    .attr("class", "node-group")
    .attr("transform", (d) => `translate(${d.x},${d.y})`);

  nodes.each(function (d) {
    const g = d3.select(this);

    // Hit-area covers card + button positions
    if (state.editMode) {
      const sp = d.data.spouses?.length || 0;
      const hitW = CARD_W + 50 + sp * SPOUSE_DX;
      const hitH = CARD_H + 92;
      g.append("rect")
        .attr("class", "hit-area")
        .attr("x", -CARD_W / 2 - 25)
        .attr("y", -hitH / 2)
        .attr("width", hitW)
        .attr("height", hitH)
        .attr("fill", "transparent")
        .attr("pointer-events", "all");
    }

    // Focal card
    drawCard(g, d.data.person, { dx: 0, focal: true, depth: d.depth });
    drawOffChartBadge(g, d.data.person.id, 0, renderedIds);

    // Spouse cards + connector (horizontal hairline in the gap between cards)
    (d.data.spouses || []).forEach((sp, i) => {
      const dx = (i + 1) * SPOUSE_DX;
      drawCard(g, sp.person, { dx, focal: false, depth: d.depth });
      drawOffChartBadge(g, sp.person.id, dx, renderedIds);
      const prevX = i === 0 ? 0 : i * SPOUSE_DX;
      const startX = prevX + CARD_W / 2 + 4;
      const endX = dx - CARD_W / 2 - 4;
      g.append("path")
        .attr("class", "spouse-link")
        .attr("d", `M ${startX},0 H ${endX}`);
    });

    // Expand/collapse pill — clearer with chevron + count
    if (d.data._allChildren?.length) {
      const collapsed = state.collapsed.has(d.data.id);
      const n = countDescendants(d.data._allChildren);
      const sp = d.data.spouses?.length || 0;
      const anchorX = sp ? SPOUSE_DX / 2 : 0;
      const pill = g.append("g")
        .attr("class", `expand-pill${collapsed ? " collapsed" : ""}`)
        .attr("transform", `translate(${anchorX}, ${CARD_H / 2 + 18})`)
        .on("click", (event) => {
          event.stopPropagation();
          if (state.collapsed.has(d.data.id)) state.collapsed.delete(d.data.id);
          else state.collapsed.add(d.data.id);
          render();
        });
      const label = collapsed ? `${n}` : "–";
      const w = collapsed ? 46 : 30;
      pill.append("rect").attr("x", -w / 2).attr("y", -10).attr("width", w).attr("height", 20).attr("rx", 10);
      if (collapsed) {
        // chevron-down + count
        pill.append("path").attr("class", "chev").attr("d", "M -10 -2 L -6 2 L -2 -2");
        pill.append("text").attr("x", 6).attr("y", 1).text(label);
      } else {
        pill.append("text").attr("y", 1).text("–");
      }
    }

    // Edit affordances
    if (state.editMode) {
      drawAddButtons(g, d.data.person.id, 0);
      (d.data.spouses || []).forEach((sp, i) => {
        const dx = (i + 1) * SPOUSE_DX;
        drawAddButtons(g, sp.person.id, dx);
      });
    }
  });

  // Initial fit
  if (resetZoom || !renderTree._initial) {
    const padding = 80;
    const treeW = xR - xL;
    const treeH = yB - yT;
    const fitScale = Math.min((svgWidth - padding * 2) / treeW, (svgHeight - padding * 2) / treeH, 1);
    const scale = Math.max(fitScale, MIN_FIT_SCALE);
    const cx = (xL + xR) / 2;
    const cy = (yT + yB) / 2;
    const tx = svgWidth / 2 - cx * scale;
    const ty = svgHeight / 2 - cy * scale;
    svg.transition().duration(700).ease(d3.easeCubicOut)
      .call(zoomBehavior.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    renderTree._initial = true;
  }
}

function countDescendants(children) {
  let n = 0;
  (function walk(arr) {
    for (const c of arr || []) {
      n += 1;
      walk(c._allChildren);
    }
  })(children);
  return n;
}

function drawCard(g, person, { dx = 0, focal = true, depth = 0 } = {}) {
  const dirty = false; // dirty mark no longer used (we save immediately)
  const card = g.append("g")
    .attr("class", `node-card sex-${person.sex || "U"}${person.is_dead ? " deceased" : ""}${dirty ? " dirty" : ""}`)
    .attr("data-pid", person.id)
    .attr("transform", `translate(${dx - CARD_W / 2}, ${-CARD_H / 2})`)
    .on("click", (event) => { event.stopPropagation(); openDetail(person.id); });

  card.append("rect").attr("class", "card-bg").attr("width", CARD_W).attr("height", CARD_H).attr("rx", 12).attr("ry", 12);
  card.append("rect").attr("class", "gender-accent").attr("x", 0).attr("y", 14).attr("width", 3).attr("height", CARD_H - 28).attr("rx", 1.5);

  const avSize = 40;
  const av = card.append("g").attr("class", "avatar")
    .attr("transform", `translate(${avSize / 2 + 16}, ${CARD_H / 2})`);
  drawAvatar(av, person, { r: avSize / 2 });

  const textX = avSize + 28;
  const given = person.name?.given || "";
  const surname = person.name?.surname || "";
  const full = displayName(person);
  // Wrap to 2 lines only for non-Shetty surnames that don't fit on one line.
  const wrap2 = surname && surname !== "Shetty" && given && full.length > 17;
  if (wrap2) {
    card.append("text").attr("class", "name").attr("x", textX).attr("y", 30).text(truncate(given, 17));
    card.append("text").attr("class", "name surname").attr("x", textX).attr("y", 46).text(truncate(surname, 17));
    card.append("text").attr("class", "dates").attr("x", textX).attr("y", 62).text(formatLifespan(person));
    const place = person.birth?.place || person.death?.place;
    if (place) card.append("text").attr("class", "place").attr("x", textX).attr("y", 78).text(truncate(place, 19));
  } else {
    card.append("text").attr("class", "name").attr("x", textX).attr("y", 36).text(truncate(full, 17));
    card.append("text").attr("class", "dates").attr("x", textX).attr("y", 54).text(formatLifespan(person));
    const place = person.birth?.place || person.death?.place;
    if (place) card.append("text").attr("class", "place").attr("x", textX).attr("y", 70).text(truncate(place, 19));
  }

  if (!focal) card.attr("opacity", 0.92);
}

// ───────────── Off-chart relations badge ─────────────
// When a person's parents or siblings exist in the data but aren't drawn in
// the current view (e.g. siblings of a node who only appears as a spouse, or
// parents of a node further up than the tree's current root), surface a small
// "···" pill at the top-right of their card so the connection isn't invisible.

function offChartRelations(personId, renderedIds) {
  const p = state.people[personId];
  if (!p) return { siblings: [], parents: [] };
  const siblings = [];
  const parents = [];
  if (p.parents_family) {
    const fam = state.families[p.parents_family];
    if (fam) {
      for (const slot of ["husband", "wife"]) {
        const pid = fam[slot];
        if (pid && !renderedIds.has(pid)) parents.push(pid);
      }
      for (const cid of fam.children || []) {
        if (cid !== personId && !renderedIds.has(cid)) siblings.push(cid);
      }
    }
  }
  return { siblings, parents };
}

function drawOffChartBadge(parentG, personId, dx, renderedIds) {
  const { siblings, parents } = offChartRelations(personId, renderedIds);
  const total = siblings.length + parents.length;
  if (total === 0) return;

  const tipParts = [];
  if (siblings.length) tipParts.push(`${siblings.length} sibling${siblings.length === 1 ? "" : "s"}`);
  if (parents.length) tipParts.push(`${parents.length} parent${parents.length === 1 ? "" : "s"}`);
  const tipText = `${tipParts.join(" · ")} not shown — click to view`;

  const badge = parentG.append("g")
    .attr("class", "off-chart-badge")
    .attr("transform", `translate(${dx + CARD_W / 2 - 14}, ${-CARD_H / 2 + 14})`)
    .on("click", (event) => { event.stopPropagation(); openDetail(personId); });

  const tipW = tipText.length * 6 + 16;

  // Invisible hit-region that spans the badge AND the tooltip area above it,
  // so moving the cursor up onto the tooltip keeps the badge "hovered".
  badge.append("rect")
    .attr("class", "hit")
    .attr("x", -Math.max(tipW / 2, 10))
    .attr("y", -34)
    .attr("width", Math.max(tipW, 20))
    .attr("height", 44)
    .attr("fill", "transparent")
    .attr("pointer-events", "all");

  badge.append("circle").attr("class", "bg").attr("r", 9);
  badge.append("text").attr("class", "dots").attr("y", 1).text("···");

  const tip = badge.append("g")
    .attr("class", "off-chart-tip")
    .attr("transform", `translate(0, -22)`);
  tip.append("rect").attr("x", -tipW / 2).attr("y", -10).attr("width", tipW).attr("height", 20).attr("rx", 6);
  tip.append("text").attr("y", 1).text(tipText);
  badge.on("mouseenter", () => tip.classed("visible", true))
       .on("mouseleave", () => tip.classed("visible", false));
}

// ───────────── Add-buttons (4-way: parent / sibling / spouse / child) ─────────────

function drawAddButtons(g, personId, dx) {
  const R = 13;
  const mkBtn = (parent, xOffset, yOffset, role, tooltipText) => {
    const b = parent.append("g")
      .attr("class", "add-btn")
      .attr("transform", `translate(${xOffset}, ${yOffset})`)
      .on("click", (event) => { event.stopPropagation(); openAddPersonModal({ role, anchorPersonId: personId }); });
    b.append("circle").attr("class", "bg").attr("r", R);
    b.append("path").attr("class", "icon").attr("d", "M -4 0 L 4 0 M 0 -4 L 0 4");

    const tipW = tooltipText.length * 6.4 + 16;
    const tipY = yOffset > 0 ? R + 14 : -R - 22;
    const tip = parent.append("g")
      .attr("class", "add-btn-tooltip")
      .attr("transform", `translate(${xOffset}, ${tipY})`);
    tip.append("rect").attr("x", -tipW / 2).attr("y", -10).attr("width", tipW).attr("height", 20).attr("rx", 6);
    tip.append("text").attr("y", 1).text(tooltipText);
    b.on("mouseenter", () => tip.classed("visible", true))
     .on("mouseleave", () => tip.classed("visible", false));
  };

  // Top: + parent / + sibling
  const top = g.append("g").attr("class", "add-btn-group").attr("transform", `translate(${dx}, ${-CARD_H / 2 - 22})`);
  mkBtn(top, -22, 0, "parent", "Add parent");
  mkBtn(top, 22, 0, "sibling", "Add sibling");
  // Bottom: + child / + spouse
  const bottom = g.append("g").attr("class", "add-btn-group").attr("transform", `translate(${dx}, ${CARD_H / 2 + 26})`);
  mkBtn(bottom, -22, 0, "child", "Add child");
  mkBtn(bottom, 22, 0, "spouse", "Add partner");
}

// ───────────── Relations view (egocentric) ─────────────

// Compute the full kin map for a focal person — every category, with each
// kin tagged with its role and any "via" linkage. We compute every layer
// always; the UI then filters by state.kinLayers when rendering.
function computeKin(focalId) {
  const result = {
    parents: [], siblings: [], partners: [], children: [],
    grandparents: [], grandchildren: [], auntsUncles: [],
    firstCousins: [], secondCousins: [], inLaws: [],
  };
  const focal = state.people[focalId];
  if (!focal) return result;

  const parentFam = focal.parents_family ? state.families[focal.parents_family] : null;

  // Immediate ring
  if (parentFam) {
    [parentFam.husband, parentFam.wife].filter(Boolean).forEach((pid) => {
      result.parents.push({ id: pid, role: "parent" });
    });
    (parentFam.children || []).filter((c) => c !== focalId).forEach((cid) => {
      result.siblings.push({ id: cid, role: "sibling" });
    });
  }
  (focal.spouse_families || []).forEach((fid) => {
    const fam = state.families[fid];
    if (!fam) return;
    const partnerId = fam.husband === focalId ? fam.wife : fam.husband;
    if (partnerId) result.partners.push({ id: partnerId, role: "partner", familyId: fid });
    (fam.children || []).forEach((cid) => {
      result.children.push({ id: cid, role: "child", familyId: fid });
    });
  });

  // Grandparents (parents' parents)
  for (const p of result.parents) {
    const parent = state.people[p.id];
    const gpFam = parent?.parents_family ? state.families[parent.parents_family] : null;
    if (!gpFam) continue;
    [gpFam.husband, gpFam.wife].filter(Boolean).forEach((gpid) => {
      result.grandparents.push({ id: gpid, role: "grandparent", via: p.id });
    });
  }

  // Grandchildren (children's children)
  for (const c of result.children) {
    const child = state.people[c.id];
    (child?.spouse_families || []).forEach((fid) => {
      const fam = state.families[fid];
      (fam?.children || []).forEach((gcid) => {
        result.grandchildren.push({ id: gcid, role: "grandchild", via: c.id });
      });
    });
  }

  // Aunts & uncles (parents' siblings)
  for (const p of result.parents) {
    const parent = state.people[p.id];
    const gpFam = parent?.parents_family ? state.families[parent.parents_family] : null;
    if (!gpFam) continue;
    (gpFam.children || []).filter((c) => c !== p.id).forEach((auid) => {
      result.auntsUncles.push({ id: auid, role: "aunt-uncle", via: p.id });
    });
  }

  // First cousins (aunts/uncles' children)
  for (const au of result.auntsUncles) {
    const auntUncle = state.people[au.id];
    (auntUncle?.spouse_families || []).forEach((fid) => {
      const fam = state.families[fid];
      (fam?.children || []).forEach((cid) => {
        result.firstCousins.push({ id: cid, role: "first-cousin", via: au.id });
      });
    });
  }

  // Second cousins (grandparents' siblings' grandchildren)
  // — i.e. great-aunts/uncles' children's children, excluding closer relatives.
  const closer = new Set([
    focalId,
    ...result.parents.map((x) => x.id),
    ...result.siblings.map((x) => x.id),
    ...result.grandparents.map((x) => x.id),
    ...result.auntsUncles.map((x) => x.id),
    ...result.firstCousins.map((x) => x.id),
    ...result.children.map((x) => x.id),
    ...result.partners.map((x) => x.id),
  ]);
  for (const gp of result.grandparents) {
    const grandparent = state.people[gp.id];
    const ggpFam = grandparent?.parents_family ? state.families[grandparent.parents_family] : null;
    if (!ggpFam) continue;
    const greatAuntsUncles = (ggpFam.children || []).filter((c) => c !== gp.id);
    for (const gauId of greatAuntsUncles) {
      const greatAunt = state.people[gauId];
      (greatAunt?.spouse_families || []).forEach((fid) => {
        const fam = state.families[fid];
        (fam?.children || []).forEach((parentCousinId) => {
          const parentCousin = state.people[parentCousinId];
          (parentCousin?.spouse_families || []).forEach((pcFid) => {
            const pcFam = state.families[pcFid];
            (pcFam?.children || []).forEach((scId) => {
              if (closer.has(scId)) return;
              closer.add(scId);
              result.secondCousins.push({ id: scId, role: "second-cousin", via: gauId });
            });
          });
        });
      });
    }
  }

  // In-laws: partner's parents + siblings
  for (const sp of result.partners) {
    const partner = state.people[sp.id];
    const pFam = partner?.parents_family ? state.families[partner.parents_family] : null;
    if (!pFam) continue;
    [pFam.husband, pFam.wife].filter(Boolean).filter((x) => x !== sp.id).forEach((ilid) => {
      result.inLaws.push({ id: ilid, role: "in-law-parent", via: sp.id });
    });
    (pFam.children || []).filter((c) => c !== sp.id).forEach((silId) => {
      result.inLaws.push({ id: silId, role: "in-law-sibling", via: sp.id });
    });
  }

  // Dedupe each list (a person can appear twice via different paths — e.g. cousins from both sides)
  for (const k of Object.keys(result)) {
    const seen = new Set();
    result[k] = result[k].filter((x) => {
      if (seen.has(x.id)) return false;
      seen.add(x.id);
      return true;
    });
  }
  return result;
}

// Layer key in state.kinLayers → which result-array(s) to include
const LAYER_TO_KIND = {
  parents:       ["parents"],
  siblings:      ["siblings"],
  partner:       ["partners"],
  children:      ["children"],
  grandparents:  ["grandparents"],
  grandchildren: ["grandchildren"],
  auntsUncles:   ["auntsUncles"],
  firstCousins:  ["firstCousins"],
  secondCousins: ["secondCousins"],
  inLaws:        ["inLaws"],
};

function renderRelations({ resetZoom = false } = {}) {
  const focusId = state.focusId || state.rootId;
  const focus = state.people[focusId];
  if (!focus) return;

  const kin = computeKin(focusId);

  // Build node list filtered by which layers are enabled.
  // Each kin entry becomes a node with x/y hint and a role for layout + styling.
  const nodes = [{ id: focusId, person: focus, role: "self" }];
  const seen = new Set([focusId]);
  const addNode = (id, role, via) => {
    if (!id || seen.has(id)) return;
    const p = state.people[id];
    if (!p) return;
    seen.add(id);
    nodes.push({ id, person: p, role, via });
  };

  for (const [layerKey, kindList] of Object.entries(LAYER_TO_KIND)) {
    if (!state.kinLayers.has(layerKey)) continue;
    for (const kind of kindList) {
      for (const k of kin[kind] || []) addNode(k.id, k.role, k.via);
    }
  }

  // Build links — only between nodes that actually made it into the graph.
  const links = [];
  const has = (id) => seen.has(id);
  const pushLink = (a, b, rel) => { if (has(a) && has(b) && a !== b) links.push({ source: a, target: b, rel }); };

  // Couple lines for any visible couples
  if (state.kinLayers.has("parents")) {
    if (kin.parents.length === 2) pushLink(kin.parents[0].id, kin.parents[1].id, "spouse");
  }
  if (state.kinLayers.has("partner")) {
    kin.partners.forEach((sp) => pushLink(focusId, sp.id, "spouse"));
  }

  // Parent ↔ self
  if (state.kinLayers.has("parents")) {
    kin.parents.forEach((p) => pushLink(p.id, focusId, "parent"));
  }
  // Sibling ↔ self
  if (state.kinLayers.has("siblings")) {
    kin.siblings.forEach((s) => pushLink(s.id, focusId, "sibling"));
  }
  // Children
  if (state.kinLayers.has("children")) {
    kin.children.forEach((c) => {
      pushLink(focusId, c.id, "parent");
      if (state.kinLayers.has("partner")) {
        const fam = state.families[c.familyId];
        const partnerId = fam ? (fam.husband === focusId ? fam.wife : fam.husband) : null;
        if (partnerId) pushLink(partnerId, c.id, "parent");
      }
    });
  }
  // Grandparents → parents
  if (state.kinLayers.has("grandparents") && state.kinLayers.has("parents")) {
    kin.grandparents.forEach((gp) => pushLink(gp.id, gp.via, "parent"));
  }
  // Grandchildren ← children
  if (state.kinLayers.has("grandchildren") && state.kinLayers.has("children")) {
    kin.grandchildren.forEach((gc) => pushLink(gc.via, gc.id, "parent"));
  }
  // Aunts/Uncles are siblings of parents
  if (state.kinLayers.has("auntsUncles") && state.kinLayers.has("parents")) {
    kin.auntsUncles.forEach((au) => pushLink(au.id, au.via, "sibling"));
  }
  // First cousins ← aunts/uncles (parent link from aunt/uncle to cousin)
  if (state.kinLayers.has("firstCousins") && state.kinLayers.has("auntsUncles")) {
    kin.firstCousins.forEach((c) => pushLink(c.via, c.id, "parent"));
  }
  // Second cousins — connect to focus via a faint "distant" link
  if (state.kinLayers.has("secondCousins")) {
    kin.secondCousins.forEach((c) => pushLink(focusId, c.id, "distant"));
  }
  // In-laws — connect to the partner with dotted line
  if (state.kinLayers.has("inLaws") && state.kinLayers.has("partner")) {
    kin.inLaws.forEach((il) => pushLink(il.via, il.id, "in-law"));
  }

  // Initial position hints — radial by role, so the layout settles meaningfully.
  const cx = svgWidth / 2, cy = svgHeight / 2;
  const ringPos = {
    "self":            { dx: 0,     dy: 0,    pin: true },
    "parent":          { dx: 0,     dy: -200 },
    "grandparent":     { dx: 0,     dy: -360 },
    "sibling":         { dx: -260,  dy: 40 },
    "aunt-uncle":      { dx: -380,  dy: -160 },
    "first-cousin":    { dx: -420,  dy: 80 },
    "second-cousin":   { dx: -460,  dy: 280 },
    "partner":         { dx: 260,   dy: 40 },
    "in-law-parent":   { dx: 380,   dy: -120 },
    "in-law-sibling":  { dx: 420,   dy: 100 },
    "child":           { dx: 0,     dy: 220 },
    "grandchild":      { dx: 0,     dy: 380 },
  };
  nodes.forEach((n, i) => {
    const pos = ringPos[n.role] || { dx: 0, dy: 0 };
    // Add a tiny per-index offset to break symmetry so the force sim doesn't stall.
    n.x = cx + pos.dx + (i % 5) * 22 - 44;
    n.y = cy + pos.dy + Math.floor(i / 5) * 18 - 12;
    if (pos.pin) { n.fx = n.x; n.fy = n.y; }
  });

  // Force sim
  const linkObjs = links.map((l) => ({
    ...l,
    source: nodes.find((n) => n.id === l.source),
    target: nodes.find((n) => n.id === l.target),
  })).filter((l) => l.source && l.target);

  const sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(linkObjs).distance((l) => {
      if (l.rel === "sibling") return 130;
      if (l.rel === "spouse") return 110;
      if (l.rel === "in-law") return 130;
      if (l.rel === "distant") return 260;
      return 160; // parent
    }).strength(0.7))
    .force("charge", d3.forceManyBody().strength((d) => d.role === "self" ? -1200 : -500))
    .force("collide", d3.forceCollide(58))
    .force("center", d3.forceCenter(cx, cy).strength(0.04))
    .stop();
  // Run synchronously to settle. Force-driven animation via d3-timer is suspended
  // when the tab is backgrounded (requestAnimationFrame paused), so we cannot
  // rely on it. ~300 ticks is enough to settle a small ego graph deterministically.
  for (let i = 0; i < 300; i++) sim.tick();

  const layer = viewport.append("g").attr("class", "relations");

  const linkSel = layer.append("g").selectAll(".rel-link")
    .data(linkObjs).enter().append("line")
    .attr("class", (d) => `rel-link ${d.rel === "spouse" ? "spouse" : d.rel === "sibling" ? "sibling" : d.rel === "in-law" ? "in-law" : d.rel === "distant" ? "distant" : ""}`);

  const labelSel = layer.append("g").selectAll(".rel-link-label")
    .data(linkObjs.filter((l) => l.rel === "spouse" || l.rel === "sibling" || l.rel === "in-law")).enter().append("text")
    .attr("class", "rel-link-label")
    .text((d) => d.rel === "spouse" ? "partner" : d.rel === "in-law" ? "in-law" : "sibling");

  const nodeSel = layer.append("g").selectAll(".rel-node")
    .data(nodes, (d) => d.id).enter().append("g")
    .attr("class", (d) => `rel-node${d.role === "self" ? " focused" : ""}`)
    .style("cursor", "pointer")
    .on("click", (event, d) => {
      if (d.role === "self") { openDetail(d.id); return; }
      state.focusId = d.id;
      try { localStorage.setItem(FOCUS_KEY, d.id); } catch (_) {}
      render({ resetZoom: true });
      openDetail(d.id);
    });

  nodeSel.each(function (d) {
    const g = d3.select(this);
    const r = d.role === "self" ? 36 : 26;
    drawAvatar(g, d.person, { r });
    g.append("text").attr("class", "name").attr("y", r + 14).text(truncate(displayName(d.person), 16));
    if (d.role !== "self") {
      g.append("text").attr("class", "role").attr("y", -r - 8).text(roleLabel(d.role));
    }
  });

  // Apply final positions (sim already settled synchronously above).
  linkSel
    .attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
    .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
  labelSel
    .attr("x", (d) => (d.source.x + d.target.x) / 2)
    .attr("y", (d) => (d.source.y + d.target.y) / 2 - 4);
  nodeSel.attr("transform", (d) => `translate(${d.x}, ${d.y})`);

  // Repaint the chip bar to reflect current layer state + counts
  paintKinChips(kin);

  if (resetZoom || !renderRelations._initial) {
    svg.transition().duration(500).call(zoomBehavior.transform, d3.zoomIdentity);
    renderRelations._initial = true;
  }
}

function roleLabel(role) {
  return ({
    parent: "Parent", child: "Child", partner: "Partner", sibling: "Sibling",
    grandparent: "Grandparent", grandchild: "Grandchild",
    "aunt-uncle": "Aunt / Uncle", "first-cousin": "Cousin",
    "second-cousin": "2nd cousin",
    "in-law-parent": "In-law", "in-law-sibling": "In-law",
  })[role] || "";
}

// ───────────── Kin chip bar ─────────────

function paintKinChips(kin) {
  const bar = document.getElementById("kin-bar");
  const chipsEl = bar?.querySelector(".kin-chips");
  if (!bar || !chipsEl) return;
  bar.hidden = state.view !== "relations";
  if (state.view !== "relations") return;

  // Map layer key → count of kin in that bucket
  const counts = {};
  for (const [layer, kinds] of Object.entries(LAYER_TO_KIND)) {
    counts[layer] = kinds.reduce((n, k) => n + (kin[k]?.length || 0), 0);
  }

  chipsEl.innerHTML = ALL_KIN_LAYERS.map((L) => {
    const on = state.kinLayers.has(L.key);
    const count = counts[L.key] || 0;
    const disabled = count === 0 && !L.always;
    return `<button class="kin-chip${on ? " on" : ""}" data-layer="${L.key}" ${disabled ? "disabled" : ""}>${escapeHtml(L.label)}${count > 0 ? `<span class="kin-count">${count}</span>` : ""}</button>`;
  }).join("");

  chipsEl.querySelectorAll(".kin-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.layer;
      if (state.kinLayers.has(key)) state.kinLayers.delete(key);
      else state.kinLayers.add(key);
      render();
    });
  });
}

// ───────────── Detail panel ─────────────

function openDetail(personId) {
  const person = state.people[personId];
  if (!person) return;

  // Compute relationship sets
  const parentsFam = person.parents_family ? state.families[person.parents_family] : null;
  const parents = parentsFam
    ? [parentsFam.husband, parentsFam.wife].filter(Boolean).map((id) => state.people[id]).filter(Boolean)
    : [];
  const siblings = parentsFam
    ? (parentsFam.children || []).filter((cid) => cid !== personId).map((cid) => state.people[cid]).filter(Boolean)
    : [];

  // Build partner+children rows, skipping families that are essentially empty
  const partnerRows = (person.spouse_families || []).map((fid) => {
    const fam = state.families[fid];
    if (!fam) return "";
    const spouseId = fam.husband === personId ? fam.wife : fam.husband;
    const spouse = spouseId ? state.people[spouseId] : null;
    const kids = (fam.children || []).map((cid) => state.people[cid]).filter(Boolean);
    // Skip useless rows: no spouse AND no kids AND no marriage date
    if (!spouse && kids.length === 0 && !fam.marriage?.date) return "";
    const marryDate = fam.marriage?.date ? ` <small>· m. ${escapeHtml(fam.marriage.date)}</small>` : "";
    const spouseHtml = spouse
      ? `<div class="row"><span class="k">Partner</span><span class="v">${personLink(spouse)}${marryDate}${state.editMode ? ` · <a data-fix-coparent="${fid}">change</a>` : ""}</span></div>`
      : (kids.length > 0
        ? `<div class="row"><span class="k">Partner</span><span class="v"><a data-fix-coparent="${fid}" class="muted-link">(unknown — co-parent of ${kids.length} child${kids.length === 1 ? "" : "ren"})</a> <small style="color:var(--muted);">— click to set</small></span></div>`
        : "");
    const kidsHtml = kids.length
      ? `<div class="row"><span class="k">Children</span><span class="v">${kids.map(personLink).join(", ")}</span></div>`
      : "";
    return spouseHtml + kidsHtml;
  }).join("");

  const body = document.getElementById("detail-body");
  body.dataset.personId = person.id;
  const sexGlyph = person.sex === "M" ? "♂" : person.sex === "F" ? "♀" : "";

  body.innerHTML = `
    <div class="big-avatar">${bigAvatarSVG(person)}</div>
    <h2>${escapeHtml(displayName(person))}</h2>
    <div class="sub">${sexGlyph ? `<span class="sex">${sexGlyph}</span>` : ""}${escapeHtml(person.id)}${person.is_dead ? " · deceased" : ""}</div>

    ${person.birth?.date || person.birth?.place ? `<div class="row"><span class="k">Born</span><span class="v">${[person.birth?.date, person.birth?.place].filter(Boolean).map(escapeHtml).join(" · ")}</span></div>` : ""}
    ${person.death?.date || person.death?.place ? `<div class="row"><span class="k">Died</span><span class="v">${[person.death?.date, person.death?.place].filter(Boolean).map(escapeHtml).join(" · ")}</span></div>` : ""}
    ${parents.length ? `<div class="row"><span class="k">Parents</span><span class="v">${parents.map(personLink).join(", ")}</span></div>` : ""}
    ${siblings.length ? `<div class="row"><span class="k">Siblings</span><span class="v">${siblings.map((s) => personLink(s) + (state.editMode ? ` <a class="unlink" data-unsibling="${s.id}" title="Remove sibling relationship">×</a>` : "")).join(", ")}</span></div>` : ""}
    ${partnerRows}
    ${person.notes ? `<div class="row"><span class="k">Notes</span><span class="v">${escapeHtml(person.notes)}</span></div>` : ""}

    <div class="row actions"><span class="k">Actions</span><span class="v">
      <a data-relations="${person.id}">See relationships</a>
      <a data-focus="${person.id}">Center tree here</a>
      ${state.editMode ? `<a data-edit="${person.id}">Edit person</a>` : ""}
    </span></div>
  `;

  body.querySelectorAll("a[data-id]").forEach((a) => a.addEventListener("click", () => openDetail(a.dataset.id)));
  body.querySelectorAll("a[data-focus]").forEach((a) => a.addEventListener("click", () => focusPerson(a.dataset.focus)));
  body.querySelectorAll("a[data-edit]").forEach((a) => a.addEventListener("click", () => openEditPersonModal(a.dataset.edit)));
  body.querySelectorAll("a[data-relations]").forEach((a) => a.addEventListener("click", () => {
    state.focusId = a.dataset.relations;
    try { localStorage.setItem(FOCUS_KEY, a.dataset.relations); } catch (_) {}
    setView("relations");
  }));
  body.querySelectorAll("a[data-fix-coparent]").forEach((a) => a.addEventListener("click", () => {
    openCoParentPicker(personId, a.dataset.fixCoparent);
  }));
  body.querySelectorAll("a[data-unsibling]").forEach((a) => a.addEventListener("click", (event) => {
    event.preventDefault();
    const otherId = a.dataset.unsibling;
    const other = state.people[otherId];
    if (!other) return;
    if (!confirm(`Remove sibling relationship between ${displayName(person)} and ${displayName(other)}?\n\n${displayName(other)} stays in the tree but won't be linked as ${displayName(person)}'s sibling anymore.`)) return;
    unlinkSibling(person, other);
    persist();
    render();
    openDetail(personId);
  }));

  document.getElementById("detail").classList.remove("closed");
  document.getElementById("detail").setAttribute("aria-hidden", "false");
}

function closeDetail() {
  document.getElementById("detail").classList.add("closed");
  document.getElementById("detail").setAttribute("aria-hidden", "true");
}

function personLink(person) {
  return `<a data-id="${person.id}">${escapeHtml(displayName(person))}</a>`;
}

function focusPerson(personId) {
  const p = state.people[personId];
  if (!p) return;
  // Walk up to topmost ancestor for tree root
  let cursor = personId;
  const guard = new Set();
  while (true) {
    if (guard.has(cursor)) break;
    guard.add(cursor);
    const cur = state.people[cursor];
    if (!cur?.parents_family) break;
    const fam = state.families[cur.parents_family];
    if (!fam) break;
    const parent = fam.husband || fam.wife;
    if (!parent) break;
    cursor = parent;
  }
  state.rootId = cursor;
  state.focusId = personId;
  state.collapsed.clear();
  if (state.view !== "tree") setView("tree");
  render({ resetZoom: true });
  // Brief visual cue so the user can locate the centered person in the new layout.
  // Use a small setTimeout so the d3 zoom transition has settled before we touch
  // the DOM — rAF alone can fire mid-transition and miss the new cards.
  setTimeout(() => {
    const cards = document.querySelectorAll(`#tree g.node-card[data-pid="${personId}"]`);
    cards.forEach((c) => {
      c.classList.add("just-focused");
      setTimeout(() => c.classList.remove("just-focused"), 1700);
    });
  }, 60);
}

// ───────────── Utils ─────────────

// "Shetty" is implicit — everyone in the tree's main lineage is one. Suppress
// it in display labels so non-Shetty surnames (Mallya, Rai, Hegde…) stand out.
const IMPLICIT_SURNAME = "Shetty";
function displayName(person) {
  if (!person) return "";
  const n = person.name || {};
  const d = (n.display || "").trim();
  // Strip the trailing implicit surname from the display, however it got there
  // (whether stored as a separate surname field or concatenated into display).
  const suffix = ` ${IMPLICIT_SURNAME}`;
  if (d.endsWith(suffix) && d !== IMPLICIT_SURNAME) {
    return d.slice(0, -suffix.length).trim();
  }
  return d;
}

function formatLifespan(person) {
  const b = parseYear(person.birth?.date);
  const d = parseYear(person.death?.date);
  if (b && d) return `${b} – ${d}`;
  if (b) return `b. ${b}`;
  if (d) return `d. ${d}`;
  if (person.is_dead) return "deceased";
  return "";
}
function parseYear(s) { if (!s) return null; const m = s.match(/\d{4}/); return m ? m[0] : null; }
function truncate(s, n) { if (!s) return ""; return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
