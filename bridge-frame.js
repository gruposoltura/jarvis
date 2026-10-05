/* =====================================================================
   THE BRIDGE · bridge-frame.js — UNIFORME PANEEL-TOGGLE
   =====================================================================
   Elk venster dat naast kpi.html in de cockpit gezet kan worden
   (agents.html, credentials.html, organisation.html, constellation.html,
   competition.html) krijgt bovenaan exact EEN knop, met twee toestanden:

     |>  VOLLEDIG SCHERM    — je zit in de cockpit (paneel/iframe).
                             Klik = dit venster neemt het hele scherm over.
     <|  TERUG NAAR COCKPIT — je zit op volledig scherm.
                             Klik = terug naar de KPI-cockpit.

   Op de cockpit zelf (kpi.html) verschijnt er niets: daar ben je al.

   Gebruik: een regel in elke pagina, na bridge-config.js:
       <script src="bridge-frame.js"></script>

   Config (optioneel, in bridge-config.js):
       COCKPIT_URL : "kpi.html"     // waar <| heen gaat
   ===================================================================== */
(function (global) {
  "use strict";

  var CFG     = global.BRIDGE_CONFIG || global.DEWI_CONFIG || {};
  var COCKPIT = CFG.COCKPIT_URL || "kpi.html";

  function base(u) {
    return String(u).split("?")[0].split("#")[0].split("/").pop().toLowerCase();
  }

  var inFrame = (function () {
    try { return global.self !== global.top; } catch (e) { return true; }
  })();

  var isCockpit = base(location.pathname) === base(COCKPIT) ||
                  document.documentElement.hasAttribute("data-bridge-cockpit");

  /* Op de cockpit zelf geen toggle. */
  if (isCockpit) {
    global.BRIDGE_FRAME = { mode: "cockpit", cockpitUrl: COCKPIT, inFrame: inFrame };
    return;
  }

  var MODE    = inFrame ? "panel" : "full";   // panel = in cockpit, full = volledig scherm
  var IC_FULL = "\u2922";                     // |>
  var IC_BACK = "\u21a9";                     // <|

  /* ------------------------------------------------------------------ stijl */
  function css() {
    if (document.getElementById("bridge-frame-css")) return;
    var s = document.createElement("style");
    s.id = "bridge-frame-css";
    s.textContent = [
      "#bridge-frame{position:fixed;top:10px;left:50%;transform:translateX(-50%);",
      "  z-index:2147483000;display:flex}",
      "#bridge-frame.bridge-hidden{display:none}",
      "@media print{#bridge-frame{display:none}}",
      ".bridge-toggle{display:inline-flex;align-items:center;gap:8px;cursor:pointer;",
      "  font:700 11px/1 'Segoe UI',system-ui,-apple-system,sans-serif;letter-spacing:.14em;",
      "  text-transform:uppercase;padding:9px 15px;border-radius:999px;white-space:nowrap;",
      "  color:#00d4ff;background:rgba(7,11,18,.92);border:1px solid rgba(0,212,255,.45);",
      "  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);",
      "  transition:color .15s,background .15s,border-color .15s,box-shadow .15s}",
      ".bridge-toggle:hover{color:#06131a;background:#00d4ff;border-color:#00d4ff;",
      "  box-shadow:0 0 14px rgba(0,212,255,.5)}",
      ".bridge-toggle:focus-visible{outline:2px solid #00d4ff;outline-offset:2px}",
      ".bridge-toggle .ic{font-size:14px;letter-spacing:0;line-height:1}",
      ".bridge-toggle.in-header{margin-left:10px}",
      ".bridge-toggle.bridge-hidden{display:none}"
    ].join("");
    (document.head || document.documentElement).appendChild(s);
  }

  /* ------------------------------------------------------------------ acties */
  function toFullscreen() {
    /* uit de cockpit springen: dit venster als heel scherm openen */
    try { global.top.location.href = location.href; }
    catch (e) { global.open(location.href, "_blank", "noopener"); }
  }
  function toCockpit() { location.href = COCKPIT; }

  /* ------------------------------------------------------------------ opbouw */
  function build() {
    if (document.getElementById("bridge-toggle")) return;
    css();

    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "bridge-toggle";
    btn.className = "bridge-toggle";

    if (MODE === "panel") {
      btn.innerHTML = "<span class='ic'>" + IC_FULL + "</span><span class='tx'>Volledig scherm</span>";
      btn.title = "Dit venster als volledig scherm openen";
      btn.setAttribute("aria-label", "Dit venster als volledig scherm openen");
      btn.addEventListener("click", toFullscreen);
    } else {
      btn.innerHTML = "<span class='ic'>" + IC_BACK + "</span><span class='tx'>Terug naar cockpit</span>";
      btn.title = "Terug naar de KPI-cockpit";
      btn.setAttribute("aria-label", "Terug naar de KPI-cockpit");
      btn.addEventListener("click", toCockpit);
    }

    /* plaatsing: in de bestaande header (voor .spacer), anders zwevend bovenaan */
    var wrap = btn;
    var head = document.querySelector("header");
    if (head) {
      btn.classList.add("in-header");
      var sp = head.querySelector(".spacer");
      if (sp) head.insertBefore(btn, sp); else head.appendChild(btn);
    } else {
      var bar = document.createElement("div");
      bar.id = "bridge-frame";
      bar.appendChild(btn);
      document.body.appendChild(bar);
      wrap = bar;
    }

    /* eventuele oude COCKPIT-knop uitzetten */
    var old = document.getElementById("cockpitBtn");
    if (old) old.style.display = "none";

    /* Knop verbergen zolang een loginscherm openstaat (#authGate / #login). */
    var gates = ["authGate", "login"]
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);
    if (gates.length) {
      var sync = function () {
        var open = gates.some(function (g) {
          return g.offsetParent !== null && getComputedStyle(g).display !== "none";
        });
        wrap.classList.toggle("bridge-hidden", open);
      };
      sync();
      gates.forEach(function (g) {
        new MutationObserver(sync).observe(g, { attributes: true, attributeFilter: ["class", "style"] });
      });
      setTimeout(sync, 1500);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();

  global.BRIDGE_FRAME = { mode: MODE, cockpitUrl: COCKPIT, inFrame: inFrame, isCockpit: isCockpit };
})(window);

/* Favicon: rode Bridge-tegel in het browsertabblad (favicon.svg). Idempotent. */
(function(){try{var d=document;if(d.querySelector('link[rel~="icon"]'))return;var l=d.createElement("link");l.rel="icon";l.type="image/svg+xml";l.href="/favicon.svg?v=1";(d.head||d.documentElement).appendChild(l);}catch(e){}})();
