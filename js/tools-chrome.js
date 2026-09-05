/** Shared tools page chrome: theme sync + muted © footer + mobile header CSS */
(function () {
  var FOOTER_TEXT = '\u00A9 2026 Pruthvi Shetty';
  var THEME_KEY = 'tools-theme';

  function ensureMobileHeaderCss() {
    try {
      if (document.querySelector('link[href*="tool-header-mobile"]')) return;
      var l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = 'css/tool-header-mobile.css';
      document.head.appendChild(l);
    } catch (e) {}
  }

  function ensureFooter() {
    if (document.querySelector('.tools-footer')) return;
    var style = document.createElement('style');
    style.textContent = '.tools-footer{flex-shrink:0;text-align:center;padding:.55rem 1rem;font-size:.75rem;color:var(--text-secondary);opacity:.75;border-top:1px solid var(--border-color);background:var(--bg-secondary)}';
    document.head.appendChild(style);
    var footer = document.createElement('footer');
    footer.className = 'tools-footer';
    footer.textContent = FOOTER_TEXT;
    var anchor = document.querySelector('script[src*="privacy-counter"]') || document.querySelector('script[data-goatcounter]');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(footer, anchor);
    } else {
      document.body.appendChild(footer);
    }
  }

  function ensureBackLink() {
    if (document.querySelector('.back-to-tools')) return;
    var logo = document.querySelector('.header .logo');
    if (!logo) return;
    var wrap = document.createElement('div');
    wrap.className = 'logo-wrap';
    wrap.style.cssText = 'display:flex;align-items:center;gap:.85rem;min-width:0;flex-wrap:wrap';
    var a = document.createElement('a');
    a.className = 'back-to-tools';
    a.href = 'tools.html';
    a.title = 'Back to all tools';
    a.textContent = '\u2190 Tools';
    a.style.cssText = 'display:inline-flex;align-items:center;color:var(--text-secondary);text-decoration:none;font-size:.85rem;font-weight:600;padding:.35rem .75rem;border-radius:6px;background:var(--bg-tertiary);border:1px solid var(--border-color);white-space:nowrap';
    logo.parentNode.insertBefore(wrap, logo);
    wrap.appendChild(a);
    wrap.appendChild(logo);
  }

  function syncThemeKey(legacyKey) {
    try {
      var shared = localStorage.getItem(THEME_KEY);
      var legacy = legacyKey ? localStorage.getItem(legacyKey) : null;
      var theme = shared || legacy || document.body.getAttribute('data-theme') || 'light';
      document.body.setAttribute('data-theme', theme);
      localStorage.setItem(THEME_KEY, theme);
      if (legacyKey) localStorage.setItem(legacyKey, theme);
      var icon = document.querySelector('.theme-toggle i');
      if (icon) icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
      var btn = document.querySelector('.theme-toggle');
      if (btn && !btn.dataset.toolsThemeBound) {
        btn.dataset.toolsThemeBound = '1';
        btn.addEventListener('click', function () {
          setTimeout(function () {
            var t = document.body.getAttribute('data-theme') || 'light';
            localStorage.setItem(THEME_KEY, t);
            if (legacyKey) localStorage.setItem(legacyKey, t);
          }, 0);
        });
      }
    } catch (e) {}
  }

  function init(legacyThemeKey) {
    ensureMobileHeaderCss();
    ensureBackLink();
    ensureFooter();
    syncThemeKey(legacyThemeKey || null);
  }

  window.ToolsChrome = { init: init, ensureFooter: ensureFooter, ensureBackLink: ensureBackLink, syncThemeKey: syncThemeKey, ensureMobileHeaderCss: ensureMobileHeaderCss };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      var key = document.body && document.body.getAttribute('data-theme-key');
      init(key);
    });
  } else {
    var key = document.body && document.body.getAttribute('data-theme-key');
    init(key);
  }
})();
