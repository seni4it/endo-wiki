/*
  EndoWiki citation widget.

  Called from article.html / review.html after a post has been loaded.
  Renders a "Cite this" button + expandable panel with APA, AMA, and BibTeX
  formats. Each format has a copy-to-clipboard button.

  Usage:
    renderCitation(document.getElementById('cite-slot'), post, url);

  `post` is the full record returned by /api/get.
  `url` is the canonical URL of this page.
*/
(function (global) {
  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function fmtYear(iso) {
    return iso ? new Date(iso).getFullYear() : new Date().getFullYear();
  }

  function fmtAccessed(iso) {
    const d = new Date(iso || Date.now());
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }

  function bibKey(post) {
    const last = (post.author_name || "endowiki").split(/\s+/).pop().toLowerCase().replace(/[^a-z]/g, "");
    const year = fmtYear(post.created_at || post.updated_at);
    const title = (post.title || "entry").split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, "");
    return `${last}${year}${title}`;
  }

  function formats(post, url) {
    const year = fmtYear(post.created_at || post.updated_at);
    const updated = fmtAccessed(post.updated_at || post.created_at);
    const accessed = fmtAccessed(new Date().toISOString());
    const author = post.author_name || "EndoWiki contributor";
    const title = post.title;
    const kindLabel =
      post.kind === "article"
        ? "Clinical article"
        : post.kind === "course"
          ? "Course review"
          : "Equipment review";

    // APA 7th edition — web resource
    const apa =
      `${author}. (${year}). ${title} [${kindLabel}]. EndoWiki. Retrieved ${accessed}, from ${url}`;

    // AMA 11th edition — web content
    const ama =
      `${author}. ${title}. EndoWiki. Published ${year}. Updated ${updated}. Accessed ${accessed}. ${url}`;

    // Vancouver style
    const vancouver =
      `${author}. ${title} [Internet]. EndoWiki; ${year} [cited ${accessed}]. Available from: ${url}`;

    // BibTeX
    const bibtex =
      `@misc{${bibKey(post)},\n` +
      `  author    = {${author}},\n` +
      `  title     = {${title}},\n` +
      `  year      = {${year}},\n` +
      `  note      = {${kindLabel}},\n` +
      `  publisher = {EndoWiki},\n` +
      `  url       = {${url}},\n` +
      `  urldate   = {${accessed}}\n` +
      `}`;

    return { apa, ama, vancouver, bibtex };
  }

  function renderCitation(host, post, url) {
    if (!host || !post) return;
    const f = formats(post, url);

    host.innerHTML = `
      <section class="cite-box" aria-labelledby="cite-heading">
        <button type="button" class="cite-toggle" id="cite-toggle" aria-expanded="false" aria-controls="cite-panel">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M5 4h6M5 8h6M5 12h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>Cite this ${esc(post.kind === "article" ? "article" : "review")}</span>
          <svg class="cite-chev" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="cite-panel" id="cite-panel" hidden>
          <h3 id="cite-heading" class="cite-panel-title">Cite this ${esc(post.kind === "article" ? "article" : "review")}</h3>

          <div class="cite-tabs" role="tablist">
            <button type="button" class="cite-tab active" role="tab" aria-selected="true" data-fmt="apa">APA</button>
            <button type="button" class="cite-tab" role="tab" aria-selected="false" data-fmt="ama">AMA</button>
            <button type="button" class="cite-tab" role="tab" aria-selected="false" data-fmt="vancouver">Vancouver</button>
            <button type="button" class="cite-tab" role="tab" aria-selected="false" data-fmt="bibtex">BibTeX</button>
          </div>

          <div class="cite-format" id="cite-format" role="tabpanel">
            <pre class="cite-text" id="cite-text">${esc(f.apa)}</pre>
            <button type="button" class="cite-copy" id="cite-copy">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="4" y="4" width="9" height="10" rx="1" stroke="currentColor" stroke-width="1.5"/>
                <path d="M6 4V3a1 1 0 011-1h5a1 1 0 011 1v9a1 1 0 01-1 1h-1" stroke="currentColor" stroke-width="1.5"/>
              </svg>
              <span>Copy</span>
            </button>
          </div>
        </div>
      </section>
    `;

    const toggle = host.querySelector("#cite-toggle");
    const panel = host.querySelector("#cite-panel");
    const tabs = host.querySelectorAll(".cite-tab");
    const textEl = host.querySelector("#cite-text");
    const copyBtn = host.querySelector("#cite-copy");

    toggle.addEventListener("click", () => {
      const isOpen = panel.hidden === false;
      panel.hidden = isOpen;
      toggle.setAttribute("aria-expanded", String(!isOpen));
      toggle.classList.toggle("open", !isOpen);
    });

    tabs.forEach((t) => {
      t.addEventListener("click", () => {
        tabs.forEach((x) => { x.classList.remove("active"); x.setAttribute("aria-selected", "false"); });
        t.classList.add("active");
        t.setAttribute("aria-selected", "true");
        const fmt = t.dataset.fmt;
        textEl.textContent = f[fmt] || f.apa;
      });
    });

    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(textEl.textContent);
        const label = copyBtn.querySelector("span");
        const orig = label.textContent;
        label.textContent = "Copied!";
        copyBtn.classList.add("copied");
        setTimeout(() => {
          label.textContent = orig;
          copyBtn.classList.remove("copied");
        }, 1500);
      } catch (e) {
        // Fallback: select and prompt
        const range = document.createRange();
        range.selectNodeContents(textEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
  }

  global.renderCitation = renderCitation;
})(window);
