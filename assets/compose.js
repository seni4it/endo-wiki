/*
  EndoWiki composer — Netlify backend version.

  - Toast UI Editor for WYSIWYG body (hidden markdown mode).
  - Netlify Identity widget for email signup / login / email verification.
  - On Publish, POSTs to /api/publish with the user's JWT.
  - Server stores content in Netlify Blobs.
*/
(function () {
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

  // ---------- URL params (prefill) ----------
  // Supports: ?kind=course|equipment|article
  //           &title=...        (e.g. from "Add your review" on a subject page)
  //           &subject_slug=... (groups this review with others for the same item)
  const params = new URLSearchParams(location.search);
  const prefillKind = params.get("kind");
  if (prefillKind && ["article", "course", "equipment"].includes(prefillKind)) {
    const radio = document.querySelector(`input[name="kind"][value="${prefillKind}"]`);
    if (radio) radio.checked = true;
  }
  const prefillTitle = params.get("title");
  if (prefillTitle) {
    // Defer to let the DOM settle
    setTimeout(() => {
      const t = document.getElementById("title");
      if (t && !t.value) t.value = prefillTitle;
    }, 50);
  }
  const prefillSubjectSlug = params.get("subject_slug") || "";

  // ---------- Toast UI Editor ----------
  let editor = null;
  function handleImageUpload(blob, callback) {
    const MAX_INLINE = 300 * 1024;
    if (blob.size > MAX_INLINE) {
      alert(
        "That image is larger than 300 KB (" + Math.round(blob.size / 1024) + " KB).\n\n" +
        "Please either compress it first (try tinypng.com — free, no signup), " +
        "or upload it to a free image host (imgbb.com, your Google Drive) and paste the image URL instead."
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => callback(e.target.result, blob.name || "image");
    reader.onerror = () => alert("Couldn't read that image. Try a different file.");
    reader.readAsDataURL(blob);
  }

  function initEditor() {
    if (editor) return;
    editor = new toastui.Editor({
      el: $("#editor-host"),
      height: "500px",
      initialEditType: "wysiwyg",
      hideModeSwitch: true,
      previewStyle: "vertical",
      usageStatistics: false,
      placeholder: "Write here. Use the toolbar — bold, headings, lists, images, links. Drag an image in to embed it.",
      toolbarItems: [
        ["heading", "bold", "italic", "strike"],
        ["hr", "quote"],
        ["ul", "ol", "task"],
        ["table", "image", "link"],
      ],
      hooks: { addImageBlobHook: handleImageUpload },
    });
  }
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

  // ---------- Kind picker ----------
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
    const rowPhoto = $("#row-photo");
    if (rowPhoto) rowPhoto.style.display = k === "article" ? "none" : "block";
    $("#title").placeholder =
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
    b.addEventListener("click", () => { rating = Number(b.dataset.v); paintStars(rating); });
    b.addEventListener("mouseenter", () => paintStars(Number(b.dataset.v)));
    b.addEventListener("mouseleave", () => paintStars(rating));
  });

  // ---------- Pros/Cons lists ----------
  function buildList(containerId, placeholder) {
    const host = document.getElementById(containerId);
    const data = ["", ""];
    function render() {
      host.innerHTML = "";
      data.forEach((val, i) => {
        const row = document.createElement("div");
        row.className = "li-row";
        row.innerHTML = `<input type="text" value="${val.replace(/"/g, "&quot;")}" placeholder="${placeholder}" /><button class="rm" type="button" aria-label="Remove">×</button>`;
        row.querySelector("input").addEventListener("input", (e) => { data[i] = e.target.value; });
        row.querySelector(".rm").addEventListener("click", () => { data.splice(i, 1); render(); });
        host.appendChild(row);
      });
      const addBtn = document.createElement("button");
      addBtn.className = "add";
      addBtn.type = "button";
      addBtn.textContent = "+ Add another";
      addBtn.addEventListener("click", () => {
        data.push("");
        render();
        const inputs = host.querySelectorAll("input");
        inputs[inputs.length - 1].focus();
      });
      host.appendChild(addBtn);
    }
    render();
    return { get: () => data.map((s) => s.trim()).filter(Boolean) };
  }
  const prosList = buildList("pros-input", "Something you liked");
  const consList = buildList("cons-input", "Something you didn't like");

  // ---------- Product/course photo ----------
  let imageDataUrl = ""; // populated from file upload
  function showPreview(src) {
    if (!src) {
      $("#image-preview").style.display = "none";
      return;
    }
    $("#image-preview-img").src = src;
    $("#image-preview").style.display = "block";
  }
  function setPhotoFromFile(file) {
    const MAX = 400 * 1024;
    if (file.size > MAX) {
      alert(
        "That image is " + Math.round(file.size / 1024) + " KB — please compress to under 400 KB " +
        "(try tinypng.com for free) or paste a URL instead."
      );
      $("#image-file").value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      imageDataUrl = e.target.result;
      $("#image-url").value = "";
      showPreview(imageDataUrl);
    };
    reader.readAsDataURL(file);
  }
  const fileInput = $("#image-file");
  const urlInput = $("#image-url");
  const clearBtn = $("#image-clear");
  if (fileInput) fileInput.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) setPhotoFromFile(file);
  });
  if (urlInput) urlInput.addEventListener("input", (e) => {
    const v = e.target.value.trim();
    if (v && /^https:\/\//.test(v)) {
      imageDataUrl = "";
      if (fileInput) fileInput.value = "";
      showPreview(v);
    } else if (!v) {
      showPreview("");
    }
  });
  if (clearBtn) clearBtn.addEventListener("click", () => {
    imageDataUrl = "";
    if (fileInput) fileInput.value = "";
    if (urlInput) urlInput.value = "";
    showPreview("");
  });
  function currentImageUrl() {
    if (imageDataUrl) return imageDataUrl;
    const urlValue = urlInput ? urlInput.value.trim() : "";
    if (urlValue && /^https:\/\//.test(urlValue)) return urlValue;
    return "";
  }

  // ---------- Netlify Identity ----------
  const identity = window.netlifyIdentity;

  function currentUser() {
    return identity ? identity.currentUser() : null;
  }

  function renderAuthStatus() {
    const el = $("#repo-status");
    if (!identity) {
      el.className = "callout warn";
      el.innerHTML = "⚠️ Login system not loaded. Try refreshing the page.";
      return;
    }
    const user = currentUser();
    if (user) {
      const name = user.user_metadata?.full_name || user.email;
      el.className = "callout ok";
      el.innerHTML =
        `✅ Signed in as <strong>${name}</strong>. ` +
        `When you click <strong>Publish</strong>, your entry goes straight to the wiki. ` +
        `<a href="#" id="signout-link" style="margin-left:8px;">Sign out</a>`;
      const so = document.getElementById("signout-link");
      if (so) so.addEventListener("click", (e) => { e.preventDefault(); identity.logout(); });
    } else {
      el.className = "callout";
      el.innerHTML =
        `👋 You need to be logged in to publish. ` +
        `<a href="#" id="signin-link" style="font-weight:700;">Sign in or create an account</a> ` +
        `— email + password, takes 30 seconds.`;
      const si = document.getElementById("signin-link");
      if (si) si.addEventListener("click", (e) => { e.preventDefault(); identity.open("login"); });
    }
  }

  if (identity) {
    identity.on("init", renderAuthStatus);
    identity.on("login", () => { renderAuthStatus(); identity.close(); });
    identity.on("logout", renderAuthStatus);
    identity.init();
  } else {
    // Script not yet loaded — retry
    const iwait = setInterval(() => {
      if (window.netlifyIdentity) {
        clearInterval(iwait);
        const id = window.netlifyIdentity;
        id.on("init", renderAuthStatus);
        id.on("login", () => { renderAuthStatus(); id.close(); });
        id.on("logout", renderAuthStatus);
        id.init();
      }
    }, 100);
  }

  // ---------- Collect + build payload ----------
  function collect() {
    const kind = currentKind();
    const title = $("#title").value.trim();
    const body = editor ? editor.getMarkdown() : "";

    const errors = [];
    if (!title) errors.push("Please add a title.");
    if (kind !== "article" && rating === 0) errors.push("Please rate it (click the stars).");
    if (!body || body.trim().length < 10) errors.push("Please write a few sentences in the body.");

    const base = { kind, title, body };
    let payload;
    if (kind !== "article" && prefillSubjectSlug) base.subject_slug = prefillSubjectSlug;
    // Attach the product/course photo if the reviewer added one
    if (kind !== "article") base.image_url = currentImageUrl();
    if (kind === "course") {
      payload = {
        ...base,
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
      payload = {
        ...base,
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
      payload = { ...base, summary: $("#summary").value.trim() };
    }
    return { payload, errors };
  }

  // ---------- Preview ----------
  $("#btn-preview").addEventListener("click", () => {
    const { payload, errors } = collect();
    if (errors.length) {
      alert(errors.join("\n"));
      return;
    }
    const rendered = $("#pm-rendered");
    try {
      rendered.innerHTML = toastui.Editor.factory({
        el: document.createElement("div"),
        viewer: true,
        initialValue: payload.body,
      }).getHTML();
    } catch (e) {
      rendered.textContent = payload.body;
    }
    const title = document.createElement("h1");
    title.textContent = payload.title;
    rendered.prepend(title);
    $("#preview-modal").classList.add("open");
  });
  $("#pm-close").addEventListener("click", () => {
    $("#preview-modal").classList.remove("open");
  });

  // ---------- Save local backup ----------
  $("#btn-download").addEventListener("click", () => {
    const { payload, errors } = collect();
    if (errors.length) { alert(errors.join("\n")); return; }
    const stamp = new Date().toISOString().slice(0, 10);
    const name = `${payload.kind}-${slugify(payload.title) || "draft"}-${stamp}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  });

  // ---------- Publish ----------
  async function doPublish() {
    const { payload, errors } = collect();
    if (errors.length) { alert(errors.join("\n")); return; }

    const user = currentUser();
    if (!user || !identity) {
      alert("Please sign in first.");
      identity && identity.open("login");
      return;
    }

    const btn = $("#btn-publish");
    btn.disabled = true;
    const originalLabel = btn.textContent;
    btn.textContent = "Publishing…";

    try {
      const token = await user.jwt();
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) {
        alert("Publish failed: " + (result.error || res.statusText));
        btn.disabled = false;
        btn.textContent = originalLabel;
        return;
      }
      // Success — for reviews, send the author to the subject page so they see
      // their review alongside anyone else's. For articles, go to the article.
      location.href = result.subject_path || result.path;
    } catch (e) {
      alert("Publish failed: " + e.message);
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  }

  $("#btn-publish").addEventListener("click", doPublish);

  // ---------- Progress bar ----------
  function updateProgress() {
    const t = $("#title").value.trim();
    const k = currentKind();
    const body = editor ? editor.getMarkdown().trim() : "";
    const step2 = t && (k === "article" || rating > 0);
    const step3 = step2 && body.length > 20;
    $("#p2").classList.toggle("on", !!step2);
    $("#p3").classList.toggle("on", !!step3);
  }
  ["#title"].forEach((s) => { const el = $(s); if (el) el.addEventListener("input", updateProgress); });
  starBtns.forEach((b) => b.addEventListener("click", updateProgress));
  $$('input[name="kind"]').forEach((r) => r.addEventListener("change", updateProgress));
  setInterval(updateProgress, 1500);
})();
