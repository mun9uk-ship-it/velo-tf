/**
 * Velo TerraForm — main app controller.
 */
(() => {
  const state = {
    resources: [],
    activeResourceIdx: 0,
    activeFile: "main.tf",
    files: {},
    unlockedTypes: new Set()
  };

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

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove("show"), 2000);
  }

  // Theme
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

  function defaultFields(id) {
    const out = {};
    RESOURCES[id].fields.forEach(f => { out[f.name] = f.default; });
    return out;
  }

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

  function addResource(id) {
    state.resources.push({ id, fields: defaultFields(id) });
    state.activeResourceIdx = state.resources.length - 1;
    state.unlockedTypes.add(id);
    renderAll();
  }

  function renderForm() {
    if (state.resources.length === 0) {
      formArea.innerHTML = `<p class="muted">Select a resource above to configure it.</p>`;
      return;
    }
    const r = state.resources[state.activeResourceIdx];
    const def = RESOURCES[r.id];
    
    // إضافة زر الحذف هنا
    formArea.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
        <div>
          <h3 style="margin-bottom: 0.2rem;">${def.label}</h3>
          <p class="muted" style="margin-bottom: 0;">${def.desc}</p>
        </div>
        <button id="deleteResourceBtn" class="delete-btn">🗑️ Delete</button>
      </div>
    `;

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
        r.fields[f.name] = e.target.value; 
        
        state.files = Generator.buildAll(state);
        const validation = Generator.validate(state);
        renderTabs();
        renderPreview();
        renderStats(validation);
        renderArchMap();
        updateDynamicCommand();
        
        statusBar.className = "status-bar " + (validation.errors.length ? "offline" : "success");
        statusBar.textContent = validation.errors.length
          ? validation.errors[0]
          : validation.warnings[0] || "Looks good. Copy or download your files.";
      });

      g.appendChild(label);
      g.appendChild(input);
      formArea.appendChild(g);
    });

    // تفعيل زر الحذف
    document.getElementById("deleteResourceBtn").addEventListener("click", () => {
      state.resources.splice(state.activeResourceIdx, 1);
      state.activeResourceIdx = Math.max(0, state.activeResourceIdx - 1);
      renderAll();
      toast("Resource deleted");
    });
  }

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

  function renderStats(validation) {
    $("#statResources").textContent = state.resources.length;
    $("#statFiles").textContent     = Object.keys(state.files).length;
    $("#statValid").textContent     = validation.errors.length === 0 ? "OK" : "⚠";

    const total = Object.keys(RESOURCES).length;
    const unlocked = state.unlockedTypes.size;
    skillsCount.textContent = `${unlocked} / ${total}`;
    skillsBar.style.width = `${(unlocked / total) * 100}%`;
  }

  function renderArchMap() {
    if (state.resources.length === 0) {
      archMapEl.innerHTML = `<p class="muted">Add resources to see the map.</p>`;
      return;
    }
    const boxes = state.resources.map((r, i) => {
      const x = 10 + i * 160;
      return `<rect class="box" x="${x}" y="10" width="140" height="50" rx="8" />
              <text class="box-text" x="${x + 70}" y="40">${RESOURCES[r.id].label}</text>`;
    }).join("");

    const arrows = state.resources.slice(1).map((_, i) => {
      const x1 = 10 + i * 160 + 140;
      const x2 = 10 + (i + 1) * 160;
      return `<path class="arrow" d="M${x1} 35 L${x2} 35" />`;
    }).join("");

    const width = Math.max(300, 10 + state.resources.length * 160);

    archMapEl.innerHTML = `
      <svg viewBox="0 0 ${width} 70" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="var(--text-muted)" />
          </marker>
        </defs>
        ${boxes}
        ${arrows}
      </svg>`;
  }

  function updateDynamicCommand() {
    const rp = state.resources.find(r => r.id === "random_password");
    const targetName = rp ? `${rp.fields.name}_password` : "db_password_password";
    const dynamicCommand = `terraform output -raw ${targetName}; echo ""`;
    
    const outputCode = document.getElementById("dynamicOutputCommand");
    const outputBtn = document.getElementById("copyDynamicOutput");
    
    if (outputCode && outputBtn) {
      outputCode.textContent = dynamicCommand;
      outputBtn.setAttribute("data-copy", dynamicCommand);
    }
  }

  function renderAll() {
    state.files = Generator.buildAll(state);
    const validation = Generator.validate(state);

    if (!state.files[state.activeFile]) {
      state.activeFile = Object.keys(state.files)[0] || "main.tf";
    }

    renderForm();
    renderTabs();
    renderPreview();
    renderStats(validation);
    renderArchMap();
    updateDynamicCommand();

    statusBar.className = "status-bar " + (validation.errors.length ? "offline" : "success");
    statusBar.textContent = validation.errors.length
      ? validation.errors[0]
      : validation.warnings[0] || "Looks good. Copy or download your files.";
  }

  // --- Share link ---
  function encodeState() {
    const payload = { r: state.resources.map(r => ({ i: r.id, f: r.fields })) };
    return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  }

  function decodeState(hash) {
    try {
      const raw = decodeURIComponent(escape(atob(hash)));
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.r)) return false;
      state.resources = data.r.filter(x => RESOURCES[x.i]).map(x => ({
        id: x.i, fields: { ...defaultFields(x.i), ...(x.f || {}) }
      }));
      state.resources.forEach(r => state.unlockedTypes.add(r.id));
      state.activeResourceIdx = 0;
      return true;
    } catch (e) { return false; }
  }

  // Copy Buttons Logic
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const textToCopy = btn.getAttribute('data-copy');
      try {
        await navigator.clipboard.writeText(textToCopy);
        toast("Command copied to clipboard!");
      } catch {
        toast("Failed to copy.");
      }
    });
  });

  // Buttons Action
  $("#downloadZipBtn").addEventListener("click", () => {
    const blob = Zip.build(state.files);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "velo-tf-config.zip"; a.click();
    URL.revokeObjectURL(url);
    toast("Downloaded ZIP");
  });

  $("#downloadTfBtn").addEventListener("click", () => {
    const code = state.files[state.activeFile] || "";
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = state.activeFile; a.click();
    URL.revokeObjectURL(url);
    toast(`Downloaded ${state.activeFile}`);
  });

  $("#copyBtn").addEventListener("click", async () => {
    const code = state.files[state.activeFile] || "";
    try { 
      await navigator.clipboard.writeText(code); 
      toast(`Copied ${state.activeFile}`); 
    } catch { 
      toast("Copy failed"); 
    }
  });

  $("#shareBtn").addEventListener("click", async () => {
    const hash = "#cfg=" + encodeState();
    const url = location.origin + location.pathname + hash;
    try { 
      await navigator.clipboard.writeText(url); 
      toast("Share link copied"); 
    } catch { 
      toast("Copy failed"); 
    }
    history.replaceState(null, "", hash);
  });

  $("#surpriseBtn").addEventListener("click", () => {
    const ids = Object.keys(RESOURCES);
    const count = 1 + Math.floor(Math.random() * 2);
    const picked = new Set();
    while (picked.size < count) picked.add(ids[Math.floor(Math.random() * ids.length)]);
    state.resources = [...picked].map(id => ({ id, fields: defaultFields(id) }));
    state.activeResourceIdx = 0;
    state.resources.forEach(r => state.unlockedTypes.add(r.id));
    renderAll();
    toast("Surprise! New random config");
  });

  function updateStatusForNetwork() {
    if (!navigator.onLine) {
      statusBar.className = "status-bar offline";
      statusBar.textContent = "You are offline — Velo TerraForm still works from cache.";
    } else { renderAll(); }
  }
  window.addEventListener("online", updateStatusForNetwork);
  window.addEventListener("offline", updateStatusForNetwork);

  // PWA Install
  const installBtn = $("#installBtn");
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); deferredPrompt = e; installBtn.hidden = false;
  });
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null; installBtn.hidden = true;
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }

  function init() {
    renderChips();
    renderRecipes();
    const hash = location.hash.replace(/^#/, "");
    if (hash.startsWith("cfg=")) {
      const ok = decodeState(hash.slice(4));
      if (ok) toast("Loaded shared configuration");
    }
    // تم إزالة الكود الذي يضيف كلمة المرور تلقائياً
    renderAll();
    updateStatusForNetwork();
  }

  init();
})();