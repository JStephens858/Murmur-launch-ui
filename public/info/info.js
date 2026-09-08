/*
 * Theme + link handling for the legal pages in public/info/.
 * Loaded synchronously in <head> so the theme is applied before first paint.
 *
 * Resolution order:
 *   1. ?mode=dark|light   — what the iOS app passes when it opens these pages.
 *   2. localStorage.theme — set by next-themes on the main site, so a visitor
 *                           who toggled dark mode gets dark here too.
 *   3. OS preference      — via prefers-color-scheme.
 */
(function () {
  var params = new URLSearchParams(window.location.search);
  var mode = params.get("mode");
  var theme = null;

  if (mode === "dark" || mode === "light") {
    theme = mode;
  } else {
    var stored = null;
    try {
      stored = window.localStorage.getItem("theme");
    } catch (e) {
      /* storage unavailable (private mode, sandboxed webview) */
    }
    if (stored === "dark" || stored === "light") {
      theme = stored;
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      theme = "dark";
    } else {
      theme = "light";
    }
  }

  document.documentElement.setAttribute("data-theme", theme);

  // Carry an explicit ?mode= through to the other legal pages so the app's
  // webview stays in one theme when the reader follows a cross-reference.
  if (mode === "dark" || mode === "light") {
    document.addEventListener("DOMContentLoaded", function () {
      var links = document.querySelectorAll('a[href^="https://murmurmd.com/info/"], a[href^="/info/"]');
      for (var i = 0; i < links.length; i++) {
        var href = links[i].getAttribute("href");
        if (href.indexOf("mode=") === -1) {
          var hashIndex = href.indexOf("#");
          var base = hashIndex === -1 ? href : href.slice(0, hashIndex);
          var hash = hashIndex === -1 ? "" : href.slice(hashIndex);
          links[i].setAttribute("href", base + (base.indexOf("?") === -1 ? "?" : "&") + "mode=" + mode + hash);
        }
      }
    });
  }
})();
