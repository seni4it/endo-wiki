/*
  EndoWiki global auth bootstrap.
  Loaded on every page. Initialises Netlify Identity so:
    - Confirmation links in signup emails get processed no matter which page
      they land on.
    - The site nav shows the user's current state.
    - Clicking "Sign in" / "Write a new entry" without a session opens the
      Identity modal instead of silently failing.
*/
(function () {
  function getIdentity() { return window.netlifyIdentity; }

  function updateNav() {
    const nav = document.querySelector(".site-nav .nav-right");
    if (!nav) return;
    const id = getIdentity();
    const user = id ? id.currentUser() : null;

    // Remove any prior auth chip
    const prev = nav.querySelector(".nav-auth");
    if (prev) prev.remove();

    const chip = document.createElement("div");
    chip.className = "nav-auth";
    chip.style.cssText = "display:inline-flex;align-items:center;gap:10px;font-family:var(--font-ui);font-size:13px;";

    if (user) {
      const name = user.user_metadata?.full_name || (user.email || "").split("@")[0] || "You";
      chip.innerHTML =
        `<span style="color:rgba(255,255,255,0.72);">Signed in as <strong style="color:white;">${escapeHtml(name)}</strong></span>` +
        `<button type="button" class="nav-signout" style="background:transparent;color:rgba(255,255,255,0.72);border:1px solid rgba(255,255,255,0.18);padding:6px 12px;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;">Sign out</button>`;
      chip.querySelector(".nav-signout").addEventListener("click", () => id.logout());
    } else {
      chip.innerHTML =
        `<button type="button" class="nav-signin" style="background:transparent;color:rgba(255,255,255,0.85);border:1px solid rgba(255,255,255,0.18);padding:6px 12px;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;">Sign in</button>`;
      chip.querySelector(".nav-signin").addEventListener("click", () => id.open("login"));
    }

    // Insert before the existing nav-cta (keeps "Write a new entry" at the far right)
    const cta = nav.querySelector(".nav-cta");
    if (cta) nav.insertBefore(chip, cta);
    else nav.appendChild(chip);
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function showConfirmationBanner(text, kind) {
    const existing = document.getElementById("auth-banner");
    if (existing) existing.remove();
    const banner = document.createElement("div");
    banner.id = "auth-banner";
    banner.setAttribute("role", "status");
    const color = kind === "ok" ? "#1c6b45" : kind === "err" ? "#7d1f1f" : "#0b4d85";
    const bg = kind === "ok" ? "#e8f6ef" : kind === "err" ? "#fceaea" : "#eaf4fb";
    const border = kind === "ok" ? "#b0d9c4" : kind === "err" ? "#e0aaaa" : "#c0d9ef";
    banner.style.cssText =
      `position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:200;` +
      `padding:10px 18px;border-radius:8px;background:${bg};border:1px solid ${border};color:${color};` +
      `font-family:var(--font-ui);font-size:14px;font-weight:500;box-shadow:0 4px 16px rgba(15,30,60,0.12);` +
      `max-width:calc(100% - 40px);`;
    banner.textContent = text;
    document.body.appendChild(banner);
    setTimeout(() => { banner.style.opacity = "0"; banner.style.transition = "opacity 0.4s"; }, 5000);
    setTimeout(() => banner.remove(), 5500);
  }

  // Wait for Identity widget to load
  function init() {
    const id = getIdentity();
    if (!id) {
      setTimeout(init, 100);
      return;
    }

    // Wire events before init() is called so we catch "init", "login", etc.
    id.on("init", () => {
      updateNav();
      // If user landed here with a confirmation hash, the widget has already
      // processed it by now. If URL still has a confirmation_token, the
      // confirmation failed (expired, invalid).
      if (location.hash.includes("confirmation_token=") && !id.currentUser()) {
        showConfirmationBanner(
          "That confirmation link is invalid or has expired. Try signing in; we'll offer to resend the link.",
          "err"
        );
      }
    });
    id.on("login", (user) => {
      updateNav();
      const name = user.user_metadata?.full_name || user.email;
      showConfirmationBanner(`Welcome, ${name}! You're signed in.`, "ok");
      id.close();
    });
    id.on("logout", () => {
      updateNav();
      showConfirmationBanner("Signed out.", "info");
    });
    id.on("error", (err) => {
      console.warn("Identity error:", err);
      showConfirmationBanner("Authentication error: " + (err.message || err), "err");
    });

    id.init();
  }

  // ─── Inject search link into nav ─────────────────────────────────
  function initSearchLink() {
    const navLinks = document.querySelector(".site-nav .nav-links");
    if (!navLinks) return;
    if (navLinks.querySelector('a[href="search.html"]')) return; // already present
    const onSearchPage = /\bsearch\.html/.test(location.pathname);
    const link = document.createElement("a");
    link.href = "search.html";
    link.setAttribute("aria-label", "Search the wiki");
    link.style.cssText = "display:inline-flex;align-items:center;gap:6px;";
    link.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
      '<circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.5"/>' +
      '<path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg>' +
      '<span>Search</span>';
    if (onSearchPage) link.setAttribute("aria-current", "page");
    navLinks.appendChild(link);
  }

  // ─── Mobile nav hamburger ─────────────────────────────────────────
  // Injects a toggle button that shows the hidden .nav-links as a dropdown
  // on narrow viewports. QA found that <640px the nav links vanish with no
  // replacement — this restores access.
  function initMobileNav() {
    const nav = document.querySelector(".site-nav");
    if (!nav) return;
    const links = nav.querySelector(".nav-links");
    const inner = nav.querySelector(".site-nav-inner");
    if (!links || !inner) return;
    if (nav.querySelector(".nav-toggle-btn")) return; // already wired

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nav-toggle-btn";
    btn.setAttribute("aria-label", "Toggle menu");
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '<path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

    btn.addEventListener("click", () => {
      const open = nav.classList.toggle("nav-open");
      btn.setAttribute("aria-expanded", String(open));
    });

    // Close when a link is clicked (so mobile users see the section they picked)
    links.addEventListener("click", (e) => {
      if (e.target.tagName === "A") {
        nav.classList.remove("nav-open");
        btn.setAttribute("aria-expanded", "false");
      }
    });

    inner.insertBefore(btn, inner.firstChild.nextSibling);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { init(); initSearchLink(); initMobileNav(); });
  } else {
    init();
    initSearchLink();
    initMobileNav();
  }
})();
