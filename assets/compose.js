/*
  EndoWiki composer.
  Powers compose.html. Non-programmer friendly: no markdown visible anywhere.
  Body editor is Toast UI in WYSIWYG-only mode.
  On publish, generates the final page content and opens GitHub's new-file
  editor with everything prefilled — user clicks one green button to go live.
*/
(function () {
  // ---------- Helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function slugify(str) {
    return String(str || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80);
  }

  function pad2(n) { return String(n).padStart(2, "0"); }
  function todayYYYYMM() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  }

  function yamlString(v) {
    if (v == null) return "";
    const s = String(v);
    // Quote if it contains special chars
    if (/[:#&*!|>'"%@`,\[\]{}?\n]|^\s|\s$/.test(s)) {
      return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
    }
    return s;
  }

  // ---------- URL params (prefill) ----------
  const params = new URLSearchParams(location.search);
  const prefillKind = params.get("kind");
  if (prefillKind && ["article", "course", "equipment"].includes(prefillKind)) {
    const radio = document.querySelector(`input[name="kind"][value="${prefillKind}"]`);
    if (radio) radio.checked = true;
  }

  // ---------- Toast UI Editor ----------
  let editor = null;
  // Handle image uploads: small images go inline as data URIs; bigger ones
  // get a friendly warning to paste a URL instead. No backend required.
  function handleImageUpload(blob, callback) {
    const MAX_INLINE = 200 * 1024; // 200 KB
    if (blob.size > MAX_INLINE) {
      alert(
        "That image is larger than 200 KB (" + Math.round(blob.size / 1024) + " KB).\n\n" +
        "Large images make your entry slow to load. Please either:\n" +
        " • Compress it first (try tinypng.com — free, no signup), or\n" +
        " • Upload it somewhere else (imgbb.com, your Google Drive, Dropbox) and paste the image URL instead."
      );
      return; // abort: don't insert
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      // Toast UI expects callback(url, altText)
      callback(e.target.result, blob.name || "image");
    };
    reader.onerror = () => {
      alert("Sorry, couldn't read that image. Try a different file.");
    };
    reader.readAsDataURL(blob);
  }

  function initEditor() {
    if (editor) return;
    editor = new toastui.Editor({
      el: $("#editor-host"),
      height: "500px",
      initialEditType: "wysiwyg",
      hideModeSwitch: true, // hide the WYSIWYG / markdown tab switch
      previewStyle: "vertical",
      usageStatistics: false,
      placeholder: "Write here. Use the toolbar — bold, headings, lists, images, links. Drag an image in to embed it.",
      toolbarItems: [
        ["heading", "bold", "italic", "strike"],
        ["hr", "quote"],
        ["ul", "ol", "task"],
        ["table", "image", "link"],
      ],
      hooks: {
        addImageBlobHook: handleImageUpload,
      },
    });
  }
  // Initialize after the Toast UI script has loaded
  if (window.toastui && window.toastui.Editor) {
    initEditor();
  } else {
    const waitId = setInterval(() => {
      if (window.toastui && window.toastui.Editor) {
        clearInterval(waitId);
        initEditor();
      }
    }, 50);
  }

  // ---------- Kind picker -> show/hide sections ----------
  function currentKind() {
    const el = document.querySelector('input[name="kind"]:checked');
    return el ? el.value : "course";
  }
  function applyKind() {
    const k = currentKind();
    $("#review-fields").style.display = k === "article" ? "none" : "block";
    $("#course-fields").style.display = k === "course" ? "block" : "none";
    $("#equipment-fields").style.display = k === "equipment" ? "block" : "none";
    $("#article-fields").style.display = k === "article" ? "block" : "none";
    // Update title placeholder
    const titleInput = $("#title");
    titleInput.placeholder =
      k === "article"
        ? "e.g. 'Managing calcified canals'"
        : k === "course"
          ? "e.g. 'Styleitaliano Endodontics Masterclass'"
          : "e.g. 'Woodpex III apex locator'";
  }
  $$('input[name="kind"]').forEach((r) => r.addEventListener("change", applyKind));
  applyKind();

  // ---------- Stars ----------
  let rating = 0;
  const starBtns = $$("#stars-input button");
  function paintStars(n) {
    starBtns.forEach((b) => {
      const v = Number(b.dataset.v);
      b.classList.toggle("filled", v <= n);
    });
    const labels = ["Click to rate", "Poor", "Fair", "OK", "Good", "Excellent"];
    $("#stars-value-text").textContent = labels[n] + (n ? ` (${n}/5)` : "");
  }
  starBtns.forEach((b) => {
    b.addEventListener("click", () => {
      rating = Number(b.dataset.v);
      paintStars(rating);
    });
    b.addEventListener("mouseenter", () => paintStars(Number(b.dataset.v)));
    b.addEventListener("mouseleave", () => paintStars(rating));
  });

  // ---------- List inputs (pros/cons) ----------
  function buildList(containerId, addLabel) {
    const host = document.getElementById(containerId);
    function render(rows) {
      host.innerHTML = "";
      rows.forEach((val, i) => {
        const row = document.createElement("div");
        row.className = "li-row";
        row.innerHTML = `
          <input type="text" value="${val.replace(/"/g, "&quot;")}" placeholder="${addLabel}" />
          <button class="rm" type="button" aria-label="Remove">×</button>
        `;
        const input = row.querySelector("input");
        input.addEventListener("input", (e) => { data[i] = e.target.value; });
        row.querySelector(".rm").addEventListener("click", () => {
          data.splice(i, 1);
          render(data);
        });
        host.appendChild(row);
      });
      const addBtn = document.createElement("button");
      addBtn.className = "add";
      addBtn.type = "button";
      addBtn.textContent = "+ Add another";
      addBtn.addEventListener("click", () => {
        data.push("");
        render(data);
        const last = host.querySelectorAll("input");
        last[last.length - 1].focus();
      });
      host.appendChild(addBtn);
    }
    const data = ["", ""]; // start with 2 empty rows
    render(data);
    return { get: () => data.map((s) => s.trim()).filter(Boolean) };
  }
  const prosList = buildList("pros-input", "Something you liked");
  const consList = buildList("cons-input", "Something you didn't like");

  // ---------- Repo detection ----------
  // Priority: (1) localStorage override set by user in this browser,
  //           (2) repo baked into index.html Docsify config,
  //           (3) prompt the user the first time they hit Publish.
  let repoSlug = null; // e.g. "owner/endo-wiki"
  const LS_KEY = "endowiki:repo";

  function isValidRepoSlug(s) {
    return typeof s === "string" && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(s);
  }

  async function detectRepo() {
    // 1. localStorage
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (isValidRepoSlug(stored)) {
        repoSlug = stored;
        renderRepoStatus();
        return;
      }
    } catch (e) { /* ignore */ }

    // 2. index.html docsify config
    try {
      const res = await fetch("index.html", { cache: "no-store" });
      const html = await res.text();
      const m = html.match(/repo:\s*['"]([^'"]+)['"]/);
      if (m && m[1] && !m[1].includes("YOUR-GITHUB-USERNAME") && isValidRepoSlug(m[1])) {
        repoSlug = m[1];
      }
    } catch (e) {
      // ignore
    }
    renderRepoStatus();
  }

  function renderRepoStatus() {
    const el = $("#repo-status");
    if (repoSlug) {
      el.className = "callout ok";
      el.innerHTML =
        `✅ Ready to publish to <strong>${repoSlug}</strong>. ` +
        `<a href="#" id="change-repo" style="margin-left:8px;">Change repo</a>`;
      const change = document.getElementById("change-repo");
      if (change) change.addEventListener("click", (e) => {
        e.preventDefault();
        const next = promptForRepo(repoSlug);
        if (next) {
          repoSlug = next;
          try { localStorage.setItem(LS_KEY, next); } catch (e) {}
          renderRepoStatus();
        }
      });
    } else {
      el.className = "callout warn";
      el.innerHTML =
        `⚠️ No GitHub repo linked yet. ` +
        `<a href="#" id="set-repo">Click here to link your GitHub repo</a> — ` +
        `it only takes a moment and is remembered on this device.`;
      const set = document.getElementById("set-repo");
      if (set) set.addEventListener("click", (e) => {
        e.preventDefault();
        const next = promptForRepo();
        if (next) {
          repoSlug = next;
          try { localStorage.setItem(LS_KEY, next); } catch (e) {}
          renderRepoStatus();
        }
      });
    }
  }

  function promptForRepo(current) {
    const msg =
      "What's your GitHub repository?\n\n" +
      "Format: your-username/your-repo-name\n" +
      "Example: drsmith/endo-wiki\n\n" +
      "(If you don't have a GitHub account yet, create one free at github.com/signup, " +
      "then create a public repository named 'endo-wiki'.)";
    const ans = prompt(msg, current || "");
    if (!ans) return null;
    const cleaned = ans.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/\/$/, "");
    if (!isValidRepoSlug(cleaned)) {
      alert("That doesn't look like a GitHub repository. Please use the format 'username/repo-name'.");
      return null;
    }
    return cleaned;
  }

  detectRepo();

  // ---------- Build the markdown output ----------
  function collect() {
    const kind = currentKind();
    const title = $("#title").value.trim();
    const author = $("#author").value.trim();
    const date = todayYYYYMM();
    const body = editor ? editor.getMarkdown() : "";

    const errors = [];
    if (!title) errors.push("Please add a title.");
    if (!author) errors.push("Please add your name.");
    if (kind !== "article" && rating === 0) errors.push("Please rate it (click the stars).");

    const common = { kind, title, author, date };
    let data;
    if (kind === "course") {
      data = {
        ...common,
        rating,
        provider: $("#provider").value.trim(),
        instructor: $("#instructor").value.trim(),
        location: $("#location").value.trim(),
        format: $("#format").value,
        duration: $("#duration").value.trim(),
        price: $("#price-c").value.trim(),
        pros: prosList.get(),
        cons: consList.get(),
        would_recommend: $("#would-recommend").value,
        verdict: $("#verdict").value.trim(),
      };
    } else if (kind === "equipment") {
      data = {
        ...common,
        rating,
        brand: $("#brand").value.trim(),
        model: $("#model").value.trim(),
        category: $("#category").value,
        price: $("#price-e").value.trim(),
        duration_used: $("#duration-used").value.trim(),
        pros: prosList.get(),
        cons: consList.get(),
        would_recommend: $("#would-recommend").value,
        verdict: $("#verdict").value.trim(),
      };
    } else {
      data = {
        ...common,
        summary: $("#summary").value.trim(),
      };
    }

    return { kind, data, body, errors };
  }

  function buildFrontmatter(data) {
    const lines = ["---"];
    for (const [k, v] of Object.entries(data)) {
      if (v === "" || v == null || (Array.isArray(v) && v.length === 0)) continue;
      if (Array.isArray(v)) {
        lines.push(`${k}:`);
        v.forEach((item) => lines.push(`  - ${yamlString(item)}`));
      } else {
        lines.push(`${k}: ${yamlString(v)}`);
      }
    }
    lines.push("---");
    return lines.join("\n");
  }

  function buildMarkdown() {
    const { kind, data, body, errors } = collect();
    if (errors.length) return { errors, md: "", path: "" };

    let md;
    if (kind === "article") {
      md = `# ${data.title}\n\n`;
      if (data.summary) md += `*${data.summary}*\n\n`;
      md += body || "*(empty)*";
    } else {
      md = buildFrontmatter(data) + `\n\n# ${data.title}\n\n` + (body || "*(empty)*");
    }

    const slug = slugify(data.title) || "untitled";
    const folder =
      kind === "article"
        ? "articles"
        : kind === "course"
          ? "reviews/courses"
          : "reviews/equipment";
    const path = `${folder}/${slug}.md`;
    return { errors: [], md, path, kind };
  }

  // ---------- Preview ----------
  $("#btn-preview").addEventListener("click", () => {
    const { errors, md, path } = buildMarkdown();
    if (errors.length) {
      alert(errors.join("\n"));
      return;
    }
    const rendered = $("#pm-rendered");
    // Use Toast UI's factory to render the markdown to HTML
    try {
      rendered.innerHTML = toastui.Editor.factory({
        el: document.createElement("div"),
        viewer: true,
        initialValue: md,
      }).getHTML();
    } catch (e) {
      // Fallback: simple escape and preserve line breaks
      rendered.textContent = md;
    }
    // Prepend a note about the path (tiny, muted)
    const note = document.createElement("p");
    note.style.color = "var(--muted)";
    note.style.fontSize = "12px";
    note.style.marginTop = "0";
    note.textContent = `Will be saved as: ${path}`;
    rendered.prepend(note);
    $("#preview-modal").classList.add("open");
  });
  $("#pm-close").addEventListener("click", () => {
    $("#preview-modal").classList.remove("open");
  });

  // ---------- Download ----------
  $("#btn-download").addEventListener("click", () => {
    const { errors, md, path } = buildMarkdown();
    if (errors.length) {
      alert(errors.join("\n"));
      return;
    }
    const filename = path.split("/").pop();
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  });

  // ---------- Publish ----------
  $("#btn-publish").addEventListener("click", () => {
    const { errors, md, path, kind } = buildMarkdown();
    if (errors.length) {
      alert(errors.join("\n"));
      return;
    }
    if (!repoSlug) {
      // Prompt inline — first time only, remembered afterwards.
      const next = promptForRepo();
      if (!next) return;
      repoSlug = next;
      try { localStorage.setItem(LS_KEY, next); } catch (e) {}
      renderRepoStatus();
    }
    // Build GitHub "new file" URL. GitHub supports ?filename= and ?value=.
    const encPath = path
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    const folder = encPath.substring(0, encPath.lastIndexOf("/"));
    const filename = encPath.substring(encPath.lastIndexOf("/") + 1);
    const url =
      `https://github.com/${repoSlug}/new/main/${folder}` +
      `?filename=${filename}` +
      `&value=${encodeURIComponent(md)}`;
    // Some browsers truncate very long URLs — warn if we're close to the limit
    if (url.length > 8000) {
      if (!confirm(
        "Your entry is quite long. Some browsers may truncate the GitHub URL.\n\n" +
        "If the GitHub page doesn't show all your content, use 'Save a backup copy' " +
        "and upload the file to GitHub manually.\n\nContinue to GitHub?"
      )) return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  });

  // ---------- Progress bar (light touch) ----------
  function updateProgress() {
    const t = $("#title").value.trim();
    const a = $("#author").value.trim();
    const k = currentKind();
    const body = editor ? editor.getMarkdown().trim() : "";
    const step2 = t && a && (k === "article" || rating > 0);
    const step3 = step2 && body.length > 20;
    $("#p2").classList.toggle("on", !!step2);
    $("#p3").classList.toggle("on", !!step3);
  }
  ["#title", "#author"].forEach((s) => {
    const el = $(s); if (el) el.addEventListener("input", updateProgress);
  });
  starBtns.forEach((b) => b.addEventListener("click", updateProgress));
  $$('input[name="kind"]').forEach((r) => r.addEventListener("change", updateProgress));
  setInterval(updateProgress, 1200);
})();
