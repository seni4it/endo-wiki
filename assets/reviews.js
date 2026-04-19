/*
  EndoWiki review rendering.

  Review pages can express their data two ways (both supported):

  (1) YAML frontmatter at the very top of the .md file (what Decap CMS writes):
      ---
      kind: course
      title: Course name
      rating: 5
      pros:
        - Pro 1
        - Pro 2
      ...
      ---

  (2) Legacy JSON in a <script type="application/json" id="review-data">…</script>
      block plus a <div id="review-card"></div> placeholder anywhere in the page.

  This script, via a Docsify plugin, strips the frontmatter from the rendered
  page and injects a rich review card at the top of the content.
*/
(function () {
  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function stars(rating) {
    const r = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    return (
      '<span class="stars">' +
      "★".repeat(r) +
      '<span class="empty">' +
      "☆".repeat(5 - r) +
      "</span></span>"
    );
  }

  // Minimal YAML parser for flat review frontmatter:
  //   scalar: value
  //   list:
  //     - item
  //     - item
  // No quoting complexity beyond stripping surrounding quotes.
  function parseYamlFrontmatter(yaml) {
    const out = {};
    const lines = yaml.split(/\r?\n/);
    let currentListKey = null;
    for (let raw of lines) {
      if (!raw.trim() || raw.trim().startsWith("#")) {
        continue;
      }
      const listItem = raw.match(/^\s*-\s+(.*)$/);
      if (listItem && currentListKey) {
        let v = listItem[1].trim();
        if (
          (v.startsWith('"') && v.endsWith('"')) ||
          (v.startsWith("'") && v.endsWith("'"))
        ) {
          v = v.slice(1, -1);
        }
        out[currentListKey].push(v);
        continue;
      }
      const keyMatch = raw.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
      if (keyMatch) {
        const key = keyMatch[1];
        let val = keyMatch[2].trim();
        if (val === "") {
          currentListKey = key;
          out[key] = [];
          continue;
        }
        currentListKey = null;
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (/^(true|false)$/i.test(val)) {
          out[key] = val.toLowerCase() === "true";
        } else if (/^-?\d+(\.\d+)?$/.test(val)) {
          out[key] = Number(val);
        } else {
          out[key] = val;
        }
      }
    }
    return out;
  }

  function renderReviewCard(data) {
    const kind = data.kind === "equipment" ? "equipment" : "course";
    const factKeys =
      kind === "course"
        ? [
            ["Provider", data.provider],
            ["Instructor(s)", data.instructor],
            ["Location", data.location],
            ["Format", data.format],
            ["Duration", data.duration],
            ["Price", data.price],
            ["Taken", data.date_taken],
          ]
        : [
            ["Brand", data.brand],
            ["Model", data.model],
            ["Category", data.category],
            ["Price", data.price],
            ["Bought", data.date_bought],
            ["Used for", data.duration_used],
          ];

    const facts = factKeys
      .filter(([, v]) => v != null && String(v).trim() !== "")
      .map(
        ([k, v]) =>
          `<div><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`
      )
      .join("");

    const pros = (data.pros || [])
      .map((p) => `<li>${esc(p)}</li>`)
      .join("");
    const cons = (data.cons || [])
      .map((c) => `<li>${esc(c)}</li>`)
      .join("");

    let verdictClass = "mixed";
    let verdictText = "Mixed — see pros and cons.";
    const rec = data.would_recommend;
    if (rec === true || rec === "yes" || rec === "true") {
      verdictClass = "yes";
      verdictText = "Would recommend.";
    } else if (rec === false || rec === "no" || rec === "false") {
      verdictClass = "no";
      verdictText = "Would not recommend.";
    } else if (rec === "mixed") {
      verdictClass = "mixed";
      verdictText = "Mixed — see pros and cons.";
    }
    if (data.verdict) verdictText = data.verdict;

    return `
    <div class="review-card">
      <div class="review-head">
        <div class="review-title-block">
          <h3>${esc(data.title || data.item_name || "Untitled review")}
            <span class="kind-tag ${kind}">${kind}</span>
          </h3>
          <div class="review-meta">
            ${data.author ? `By <strong>${esc(data.author)}</strong>` : ""}
            ${data.date ? ` · ${esc(data.date)}` : ""}
          </div>
        </div>
        <div>${stars(data.rating)}</div>
      </div>
      ${facts ? `<div class="facts">${facts}</div>` : ""}
      ${
        pros || cons
          ? `<div class="proscons">
        <div class="pros"><h4>Pros</h4><ul>${pros || "<li>—</li>"}</ul></div>
        <div class="cons"><h4>Cons</h4><ul>${cons || "<li>—</li>"}</ul></div>
      </div>`
          : ""
      }
      <div class="verdict ${verdictClass}">${esc(verdictText)}</div>
    </div>`;
  }

  // Hook that runs on the raw markdown before Docsify renders it.
  // If the file starts with YAML frontmatter that has `kind: course` or
  // `kind: equipment`, we:
  //   1. Parse the frontmatter
  //   2. Remove it from the markdown (so it doesn't show as text)
  //   3. Prepend an HTML review card so it appears at the top of the page.
  function processFrontmatter(md) {
    const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\s*\n?([\s\S]*)$/);
    if (!m) return md;
    const data = parseYamlFrontmatter(m[1]);
    const body = m[2];
    if (data.kind === "course" || data.kind === "equipment") {
      return renderReviewCard(data) + "\n\n" + body;
    }
    // Non-review frontmatter (e.g., articles with tags) — just strip it.
    return body;
  }

  // Process legacy JSON <script> blocks.
  function processScriptBlock() {
    const dataEl = document.querySelector(
      '.markdown-section script[type="application/json"]#review-data'
    );
    const targetEl = document.querySelector(
      ".markdown-section #review-card"
    );
    if (!dataEl || !targetEl) return;
    try {
      const data = JSON.parse(dataEl.textContent);
      targetEl.outerHTML = renderReviewCard(data);
    } catch (e) {
      targetEl.innerHTML =
        '<div class="review-card"><em>Could not render review card: ' +
        esc(e.message) +
        "</em></div>";
    }
  }

  window.$docsify = window.$docsify || {};
  window.$docsify.plugins = (window.$docsify.plugins || []).concat(
    function (hook) {
      hook.beforeEach(function (markdown) {
        return processFrontmatter(markdown);
      });
      hook.doneEach(function () {
        processScriptBlock();
        // Initialize mermaid for any <div class="mermaid"> blocks
        if (window.mermaid && typeof window.mermaid.run === "function") {
          try { window.mermaid.run(); } catch (e) { /* ignore */ }
        }
      });
    }
  );
})();
