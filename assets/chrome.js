/*
  EndoWiki chrome.js — shared nav and footer injection.
  Runs before auth.js (which expects .site-nav .nav-right to exist).
  Tiny, dependency-free IIFE.

  Usage in HTML:
    <nav id="site-nav"></nav>                      ← filled by injectNav()
    <footer id="site-footer"></footer>             ← filled by injectFooter()

  Body dataset hints:
    data-active-nav="articles|courses|equipment|contribute"
    data-nav-cta-href="compose.html?kind=article"   ← overrides default CTA href
    data-nav-cta-label="New article"               ← overrides default CTA label
*/
(function () {
  'use strict';

  var NAV_HTML =
    '<div class="site-nav-inner">' +
      '<a class="brand" href="/">' +
        '<span class="brand-mark" aria-hidden="true">E</span>' +
        'EndoWiki' +
      '</a>' +
      '<div class="nav-links" role="list">' +
        '<a href="/articles/" role="listitem" data-nav-key="articles">Articles</a>' +
        '<a href="/courses/" role="listitem" data-nav-key="courses">Courses</a>' +
        '<a href="/equipment/" role="listitem" data-nav-key="equipment">Equipment</a>' +
        '<a href="/contributing.html" role="listitem" data-nav-key="contribute">Contribute</a>' +
      '</div>' +
      '<div class="nav-right">' +
        '{{CTA}}' +
      '</div>' +
    '</div>';

  var FOOTER_HTML =
    '<div class="site-footer-inner">' +
      '<div>' +
        '<div class="footer-brand">EndoWiki</div>' +
        '<p class="footer-mission">' +
          'A community knowledge base for endodontists. Content is written and reviewed ' +
          'by practising specialists. Articles are released under ' +
          '<a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a>. ' +
          'Content is for educational purposes only and does not constitute clinical advice.' +
        '</p>' +
      '</div>' +
      '<div class="footer-links">' +
        '<a href="https://github.com/seni4it/endo-wiki" target="_blank" rel="noopener">GitHub</a>' +
        '<a href="contributing.html">How to contribute</a>' +
        '<a href="editorial-guidelines.html">Editorial guidelines</a>' +
        '<a href="compose.html">Write a new entry</a>' +
      '</div>' +
    '</div>' +
    '<div class="footer-base">' +
      '&copy; EndoWiki contributors. All content CC BY-SA 4.0.' +
    '</div>';

  var WRITE_ICON =
    '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
    '<path d="M12 2l2 2-9 9H3v-2l9-9z" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>' +
    '</svg>';

  var FAB_HTML =
    '<a id="fab-compose" href="compose.html" title="Write a new article or review" aria-label="Write a new entry">' +
      '<svg class="fab-icon" viewBox="0 0 18 18" fill="none" aria-hidden="true">' +
        '<path d="M13.5 2.25l2.25 2.25L6 14.25H3.75V12L13.5 2.25z" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>' +
      '</svg>' +
      '<span class="fab-label">Write a new entry</span>' +
    '</a>';

  function injectNav() {
    var el = document.getElementById('site-nav');
    if (!el) return;

    // Determine CTA from data attributes on body, with sensible default
    var body = document.body;
    var ctaHref  = (body && body.dataset.navCtaHref)  || 'compose.html';
    var ctaLabel = (body && body.dataset.navCtaLabel) || 'Write a new entry';
    var activeKey = (body && body.dataset.activeNav)  || '';

    var ctaMarkup =
      '<a class="nav-cta" href="' + ctaHref + '">' +
        WRITE_ICON + ' ' + ctaLabel +
      '</a>';

    el.className = 'site-nav';
    el.setAttribute('aria-label', 'Primary navigation');
    el.innerHTML = NAV_HTML.replace('{{CTA}}', ctaMarkup);

    // Mark active link
    if (activeKey) {
      var link = el.querySelector('[data-nav-key="' + activeKey + '"]');
      if (link) link.setAttribute('aria-current', 'page');
    }
  }

  function injectFooter() {
    var el = document.getElementById('site-footer');
    if (!el) return;
    el.className = 'site-footer';
    el.innerHTML = FOOTER_HTML;
  }

  function injectFab() {
    // Only inject if not already present (compose page has its own CTA)
    if (document.getElementById('fab-compose')) return;
    // Don't inject on compose page — it already has a full topbar CTA
    if (/\bcompose\.html/.test(location.pathname)) return;
    var div = document.createElement('div');
    div.innerHTML = FAB_HTML;
    document.body.appendChild(div.firstChild);
  }

  function run() {
    injectNav();
    injectFooter();
    injectFab();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
