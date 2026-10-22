/* =====================================================================
   NEXUS · nexus-embed-child.js (22-10-2026)
   Voor pagina's die als onderdeel IN NEXUS draaien (Facturen, Contracten).
   - Eén ingang: buiten NEXUS geopend -> door naar /nexus.html#<doel>.
   - Clickjacking: alleen in een frame van dezelfde origin (NEXUS zelf).
   - Eén login: de sessie van NEXUS (storageKey "nexus-auth").
   - Look & feel: thema, lettergrootte en taal komen uit NEXUS en volgen live.
   Gebruik in <head>, vóór de andere scripts:
     <script src="/nexus-embed-child.js?v=1" data-target="fa"></script>
   ===================================================================== */
(function (w, d) {
  "use strict";
  var me = d.currentScript;
  var target = (me && me.getAttribute("data-target")) || "";
  var params = new URLSearchParams(location.search);
  var embedded = params.get("embed") === "1";
  var sameOriginFrame = false;
  try { sameOriginFrame = w.top !== w && w.top.location.origin === location.origin; } catch (e) { sameOriginFrame = false; }

  if (!embedded || !sameOriginFrame) {
    var ref = params.get("ref");
    var dest = "/nexus.html#" + target + (ref ? "/" + encodeURIComponent(ref) : "");
    try { w.top.location.replace(dest); } catch (e) { location.replace(dest); }
    d.documentElement.style.display = "none";   // niets tonen tot de omleiding klaar is
    w.NEXUS_EMBED_BLOCKED = true;
    return;
  }

  w.NEXUS_STORAGE_KEY = "nexus-auth";
  var root = d.documentElement;
  root.classList.add("nx-embed");
  root.setAttribute("data-nx-part", target);

  function apply(s) {
    s = s || {};
    var theme = s.theme === "light" ? "light" : "dark";
    root.setAttribute("data-theme", theme);
    var fs = parseFloat(s.fs);
    root.style.setProperty("--fs", fs > 0 ? String(fs) : "1");
    if (s.lang) root.setAttribute("data-nx-lang", s.lang);
    try { w.dispatchEvent(new CustomEvent("nexus-settings", { detail: { theme: theme, fs: fs, lang: s.lang } })); } catch (e) {}
  }
  function fromStorage() {
    var s = {};
    try {
      s.theme = localStorage.getItem("nexus-theme") || "dark";
      s.fs = localStorage.getItem("nexus-fs") || "1";
      s.lang = localStorage.getItem("nexus-lang") || "nl";
    } catch (e) {}
    return s;
  }
  apply(fromStorage());
  w.addEventListener("message", function (ev) {
    if (ev.origin !== location.origin || !ev.data || ev.data.type !== "nexus-settings") return;
    apply(ev.data);
  });
  /* andere tabbladen met NEXUS open: zelfde instellingen volgen */
  w.addEventListener("storage", function (ev) {
    if (ev.key === "nexus-theme" || ev.key === "nexus-fs" || ev.key === "nexus-lang") apply(fromStorage());
  });

  /* Sessie verlopen of uitgelogd: NEXUS zelf laten herladen, die toont de login */
  w.NEXUS_RELOGIN = function () {
    try { w.top.postMessage({ type: "nexus-relogin" }, location.origin); } catch (e) {}
  };
})(window, document);
