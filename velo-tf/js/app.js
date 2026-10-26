/**
 * Velo Tf — main app controller.
 * Keeps a single `state` object, re-renders on change.
 */
(() => {
  const state = {
    resources: [],            // [{ id, fields }]
    activeResourceIdx: 0,
    activeFile: "main.tf",
    files: {},
    unlockedTypes: new Set()
  };

  // --- DOM refs ---
  const $ = (s) => document.querySelector(s);
  const chipsEl     = $("#chips");
  const formArea    = $("#formArea");
  const previewEl   = $("#preview");
  const fileTabsEl  = $("#fileTabs");
  const recipeSel   = $("#recipeSelect");
  const statusBar   = $("#statusBar");
  const toastEl     = $("#toast");
  const skillsCount = $("#skillsCount");
  const skillsBar   = $("#skillsBar");
  const archMapEl   = $("#archMap");

  // --- Toast ---
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove("show"), 2000);
  }

  // --- Theme ---
  const themeToggle = $("#themeToggle");
  const storedTheme = localStorage.getItem("velo-tf-theme") || "dark";
  document.documentElement.dataset.theme = storedTheme;
  themeToggle.textContent = storedTheme === "dark" ? "🌙" : "☀️";
  themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    themeToggle.textContent = next === "dark" ? "🌙" : "☀️";
    localStorage.setItem("velo-tf-theme", next);
  });

  // --- Helpers ---
  function defaultFields(id) {
    const out = {};
    RESOURCES[id].fields.forEach(f => { out[f.name] = f.default; });
    return out;
  }

  // --- Chips ---
  function renderChips() {
    chipsEl.innerHTML = "";
    Object.values(RESOURCES).forEach((r) => {
      const b = document.createElement("button");
      b.className = "chip";
      b.textContent = r.label;
      b.addEventListener("click", () => addResource(r.id));
      chipsEl.appendChild(b);
    });
  }

  // --- Recipes ---
  function renderRecipes() {
    Object.entries(RECIPES).forEach(([key, r]) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = r.label;
      recipeSel.appendChild(opt);
    });
    recipeSel.addEventListener("change", () => {
      const key = recipeSel.value;
      if (!key) return;
      state.resources = RECIPES[key].resources.map(r => ({
        id: r.id,
        fields: { ...defaultFields(r.id), ...r.fields }
      }));
      state.activeResourceIdx = 0;
      state.resources.forEach(r => state.unlockedTypes.add(r.id));
      renderAll();
      toast(`Loaded recipe: ${RECIPES[key].label}`);
    });
  }

  // --- Add resource ---
  function addResource(id) {
    state.resources.push({ id, fields: defaultFields(id) });
    state.activeResourceIdx = state.resources.length - 1;
    state.unlockedTypes.add(id);
    renderAll();
  }

  // --- Form ---
  function renderForm() {
    if (state.resources.length === 0) {
      formArea.innerHTML = `<p class="muted">Select a resource above to configure it.</p>`;
      return;
    }
    const r = state.resources[state.activeResourceIdx];
    const def = RESOURCES[r.id];
    formArea.innerHTML = `<h3>${def.label}</h3><p class="muted">${def.desc}</p>`;

    def.fields.forEach((f) => {
      const g = document.createElement("div");
      g.className = "form-group";

      const label = document.createElement("label");
      label.textContent = f.label;
      label.htmlFor = `f-${f.name}`;

      let input;
      if (f.type === "select") {
        input = document.createElement("select");
        f.options.forEach(o => {
          const opt = document.createElement("option");
          opt.value = o;
          opt.textContent = o;
          if (String(r.fields[f.name]) === String(o)) opt.selected = true;
          input.appendChild(opt);
        });
      } else {
        input = document.createElement("input");
        input.type = f.type === "number" ? "number" : "text";
        input.value = r.fields[f.name] ?? "";
      }

      input.id = `f-${f.name}`;
      input.addEventListener("input", (e) => {
        r.fields[f.name] = f.type === "number" ? Number(e.target.value) : e.target.value;
        renderAll();
      });

      g.appendChild(label);
      g.appendChild(input);
      formArea.appendChild(g);
    });
  }

  // --- Preview ---
  function renderTabs() {
    fileTabsEl.innerHTML = "";
    Object.keys(state.files).forEach((name) => {
      const b = document.createElement("button");
      b.className = "file-tab" + (name === state.activeFile ? " active" : "");
      b.textContent = name;
      b.addEventListener("click", () => {
        state.activeFile = name;
        renderTabs();
        renderPreview();
      });
      fileTabsEl.appendChild(b);
    });
  }

  function renderPreview() {
    const code = state.files[state.activeFile] || "";
    const current = state.resources[state.activeResourceIdx];
    const explainFn = current ? (line) => RESOURCES[current.id].explain?.(line) : null;
    previewEl.innerHTML = highlightHCL(code, explainFn);
  }

  // --- Stats + skills ---
  function renderStats(validation) {
    $("#statResources").textContent = state.resources.length;
    $("#statFiles").textContent     = Object.keys(state.files).length;
    $("#statValid").textContent     = validation.errors.length === 0 ? "OK" : "⚠";

    const total = Object.keys(RESOURCES).length;
    const unlocked = state.unlockedTypes.size;
    skillsCount.textContent = `${unlocked} / ${total}`;
    skillsBar.style.width = `${(unlocked / total) * 100}%`;
  }

  // --- Architecture map ---
  function renderArchMap() {
    if (state.resources.length === 0) {
      archMapEl.innerHTML = `<p class="muted">Add resources to see the map.</p>`;
      return;
    }
    const boxes = state.resources.map((r, i) => {
      const x = 20 + i * 180;
      return `<rect class="box" x="${x}" y="40" width="140" height="60" rx="10" />
              <text class="box-text" x="${x + 70}" y="75">${RESOURCES[r.id].label}</text>`;
    }).join("");

    const arrows = state.resources.slice(1).map((_, i) => {
      const x1 = 20 + i * 180 + 140;
      const x2 = 20 + (i + 1) * 180;
      return `<path class="arrow" d="M${x1} 70 L${x2} 70" />`;
    }).join("");

    const width = Math.max(300, 20 + state.resources.length * 180);

    archMapEl.innerHTML = `
      <svg viewBox="0 0 ${width} 160" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="var(--text-muted)" />
          </marker>
        </defs>
        ${boxes}
        ${arrows}
      </svg>`;
  }

  // --- Regenerate everything ---
  function renderAll() {
    state.files = Generator.buildAll(state);
    const validation = Generator.validate(state);

    // Keep active file valid
    if (!state.files[state.activeFile]) {
      state.activeFile = Object.keys(state.files)[0] || "main.tf";
    }

    renderForm();
    renderTabs();
    renderPreview();
    renderStats(validation);
    renderArchMap();

    statusBar.className = "status-bar " + (validation.errors.length ? "offline" : "success");
    statusBar.textContent = validation.errors.length
      ? validation.errors[0]
      : validation.warnings[0] || "Looks good. Copy or download your files.";
  }

  // --- Share link (encode/decode state in URL hash) ---
  function encodeState() {
    const payload = {
      r: state.resources.map(r => ({ i: r.id, f: r.fields }))
    };
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  }

  function decodeState(hash) {
    try {
      const raw = decodeURIComponent(escape(atob(hash)));
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.r)) return false;
      state.resources = data.r
        .filter(x => RESOURCES[x.i])
        .map(x => ({
          id: x.i,
          fields: { ...defaultFields(x.i), ...(x.f || {}) }
        }));
      state.resources.forEach(r => state.unlockedTypes.add(r.id));
      state.activeResourceIdx = 0;
      return true;
    } catch (e) {
      return false;
    }
  }

  // --- Copy current file ---
  $("#copyBtn").addEventListener("click", async () => {
    const code = state.files[state.activeFile] || "";
    try {
      await navigator.clipboard.writeText(code);
      toast(`Copied ${state.activeFile}`);
    } catch {
      toast("Copy failed — select the text manually");
    }
  });

  // --- Download .tf ---
  $("#downloadTfBtn").addEventListener("click", () => {
    const code = state.files[state.activeFile] || "";
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = state.activeFile;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Downloaded ${state.activeFile}`);
  });

  // --- Download ZIP ---
  $("#downloadZipBtn").addEventListener("click", () => {
    const blob = Zip.build(state.files);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "velo-tf-config.zip";
    a.click();
    URL.revokeObjectURL(url);
    toast("Downloaded ZIP");
  });

  // --- Share link ---
  $("#shareBtn").addEventListener("click", async () => {
    const hash = "#cfg=" + encodeState();
    const url = location.origin + location.pathname + hash;
    try {
      await navigator.clipboard.writeText(url);
      toast("Share link copied");
    } catch {
      toast("Copy failed — URL is in the address bar");
    }
    history.replaceState(null, "", hash);
  });

  // --- Surprise me ---
  $("#surpriseBtn").addEventListener("click", () => {
    const ids = Object.keys(RESOURCES);
    const count = 1 + Math.floor(Math.random() * 3);
    const picked = new Set();
    while (picked.size < count) picked.add(ids[Math.floor(Math.random() * ids.length)]);

    state.resources = [...picked].map(id => ({
      id,
      fields: defaultFields(id)
    }));
    state.activeResourceIdx = 0;
    state.resources.forEach(r => state.unlockedTypes.add(r.id));
    renderAll();
    toast("Surprise! New random config");
  });

  // --- Online/offline ---
  function updateStatusForNetwork() {
    if (!navigator.onLine) {
      statusBar.className = "status-bar offline";
      statusBar.textContent = "You are offline — Velo Tf still works from cache.";
    } else {
      renderAll();
    }
  }
  window.addEventListener("online", updateStatusForNetwork);
  window.addEventListener("offline", updateStatusForNetwork);

  // --- PWA install ---
  const installBtn = $("#installBtn");
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  });

  // --- Service worker ---
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  // --- Init ---
  function init() {
    renderChips();
    renderRecipes();

    // Load from share link if present
    const hash = location.hash.replace(/^#/, "");
    if (hash.startsWith("cfg=")) {
      const ok = decodeState(hash.slice(4));
      if (ok) toast("Loaded shared configuration");
    }

    // Seed with one resource so preview isn't empty
    if (state.resources.length === 0) {
      state.resources.push({ id: "random_password", fields: defaultFields("random_password") });
      state.unlockedTypes.add("random_password");
    }

    renderAll();
    updateStatusForNetwork();
  }

  init();
})();