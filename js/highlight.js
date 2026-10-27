/**
 * Velo Tf — tiny HCL syntax highlighter (no dependencies).
 * Wraps tokens in spans, and emits one <span class="code-line"> per line
 * so Explain-mode can attach a tooltip per line.
 */
const HCL_KEYWORDS = ["resource", "variable", "output", "provider", "data", "module", "terraform", "locals"];
const HCL_BOOLEANS = ["true", "false"];

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightLine(line, explainText) {
  let safe = escapeHtml(line);

  // Comments first
  if (safe.trim().startsWith("#") || safe.trim().startsWith("//")) {
    return `<span class="code-line"><span class="tok-com">${safe}</span></span>`;
  }

  // Strings
  safe = safe.replace(/"([^"\\]|\\.)*"/g, m => `<span class="tok-str">${m}</span>`);

  // Numbers
  safe = safe.replace(/\b(\d+)\b/g, m => `<span class="tok-num">${m}</span>`);

  // Booleans
  HCL_BOOLEANS.forEach(b => {
    safe = safe.replace(new RegExp(`\\b${b}\\b`, "g"), `<span class="tok-bool">${b}</span>`);
  });

  // Keywords
  HCL_KEYWORDS.forEach(k => {
    safe = safe.replace(new RegExp(`\\b${k}\\b`, "g"), `<span class="tok-key">${k}</span>`);
  });

  // Braces
  safe = safe.replace(/([{}])/g, `<span class="tok-brace">$1</span>`);

  const tip = explainText
    ? `<span class="explain">${escapeHtml(explainText)}</span>`
    : "";

  return `<span class="code-line">${safe}${tip}</span>`;
}

function highlightHCL(code, explainFn) {
  return code.split("\n").map(line => {
    const expl = explainFn ? explainFn(line) : null;
    return highlightLine(line, expl);
  }).join("\n");
}