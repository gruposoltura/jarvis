/* =====================================================================
   NEXUS · nexus-parts.js (22-10-2026)
   1. Facturen (#fa) en Contracten (#cn, #cn/REF): onderdelen in een frame van
      dezelfde origin, met de NEXUS-sessie; thema, lettergrootte en taal volgen live.
   2. The Bridge (#bridge): alleen voor de eigenaar (nexus_team.bridge_owner) en
      alleen met tweestapsverificatie (TOTP, sessie op aal2). Eerste keer: koppelen
      met een authenticator-app. De database eist hetzelfde (bridge_is_owner()).
   ===================================================================== */
(function (w, d) {
  "use strict";
  var PARTS = {
    fa: { url: "/facturacion.html?embed=1", title: "Facturen" },
    cn: { url: "/contratos.html?embed=1", title: "Contracten" }
  };
  var ctx = null, frames = {};

  function L(nl, en) { return ctx && ctx.lang && ctx.lang() === "en" ? en : nl; }
  function settings() {
    var r = d.documentElement, s = {};
    s.theme = r.getAttribute("data-theme") === "light" ? "light" : "dark";
    s.fs = parseFloat(getComputedStyle(r).getPropertyValue("--fs")) || 1;
    s.lang = r.lang || "nl";
    s.type = "nexus-settings";
    return s;
  }
  function broadcast() {
    var s = settings();
    Object.keys(frames).forEach(function (k) {
      try { frames[k].contentWindow.postMessage(s, location.origin); } catch (e) {}
    });
  }
  new MutationObserver(broadcast).observe(d.documentElement, { attributes: true, attributeFilter: ["data-theme", "style", "lang"] });

  /* Een onderdeel meldt dat de sessie weg is: NEXUS herladen toont de login */
  w.addEventListener("message", function (ev) {
    if (ev.origin !== location.origin || !ev.data || ev.data.type !== "nexus-relogin" || !ctx) return;
    ctx.sb.auth.getSession().then(function (r) {
      if (!r || !r.data || !r.data.session) location.reload();
      else ctx.sb.auth.refreshSession().then(function () { Object.keys(frames).forEach(function (k) { frames[k].src = frames[k].src; }); });
    });
  });

  function open(key, pane, ref) {
    var p = PARTS[key]; if (!p || !pane) return;
    var f = frames[key];
    if (!f) {
      pane.innerHTML = "";
      var wrap = d.createElement("div"); wrap.className = "part-wrap";
      f = d.createElement("iframe");
      f.className = "part-frame"; f.title = p.title;
      f.setAttribute("referrerpolicy", "same-origin");
      f.src = p.url + (ref ? "&ref=" + encodeURIComponent(ref) : "");
      f.addEventListener("load", broadcast);
      wrap.appendChild(f); pane.appendChild(wrap);
      frames[key] = f;
      return;
    }
    if (ref) { try { f.contentWindow.postMessage({ type: "nexus-open-ref", ref: ref }, location.origin); } catch (e) {} }
  }

  /* ---------------- The Bridge + tweestapsverificatie ---------------- */
  var ov = null;
  function closeOv() { if (ov) { ov.remove(); ov = null; } }
  function box(html) {
    closeOv();
    ov = d.createElement("div"); ov.className = "mfa-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
    ov.innerHTML = '<div class="mfa-box card"><button type="button" class="mfa-x" aria-label="' + L("Sluiten", "Close") + '">×</button>' + html + "</div>";
    d.body.appendChild(ov);
    ov.querySelector(".mfa-x").onclick = closeOv;
    ov.addEventListener("keydown", function (e) { if (e.key === "Escape") closeOv(); });
    var inp = ov.querySelector("input"); if (inp) setTimeout(function () { inp.focus(); }, 30);
    return ov;
  }
  function codeForm(lead, extra, onCode) {
    var o = box('<div class="mfa-hd"><span class="mfa-ic">⚡</span><h3>The Bridge</h3></div>' + extra +
      '<p class="mfa-lead">' + lead + "</p>" +
      '<form class="mfa-f"><input class="mfa-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="000000" aria-label="' + L("Code van 6 cijfers", "6-digit code") + '" required>' +
      '<button class="btn pri" type="submit">' + L("Bevestigen", "Confirm") + '</button></form><div class="msg" aria-live="polite"></div>');
    var f = o.querySelector("form"), m = o.querySelector(".msg"), b = o.querySelector("button[type=submit]");
    f.onsubmit = async function (e) {
      e.preventDefault(); m.className = "msg"; m.textContent = ""; b.disabled = true;
      var code = o.querySelector(".mfa-code").value.replace(/\D/g, "");
      try { await onCode(code); }
      catch (err) { m.className = "msg err"; m.textContent = /invalid|expired|incorrect/i.test(String(err && err.message)) ? L("Code klopt niet of is verlopen. Probeer de volgende code.", "Code is wrong or expired. Try the next one.") : String((err && err.message) || err); b.disabled = false; }
    };
    return o;
  }
  function enter() { closeOv(); location.href = "/kpi.html"; }

  async function go() {
    if (!ctx) return;
    var me = ctx.me();
    if (!me || me.bridge_owner !== true) { if (location.hash === "#bridge") location.hash = "ov"; return; }
    if (location.hash === "#bridge") history.replaceState(null, "", location.pathname + location.search);
    var sb = ctx.sb;
    try {
      var a = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
      if (a && a.data && a.data.currentLevel === "aal2") return enter();
      var lf = await sb.auth.mfa.listFactors();
      if (lf.error) throw lf.error;
      var all = (lf.data && lf.data.all) || [];
      var ok = all.filter(function (x) { return x.factor_type === "totp" && x.status === "verified"; });
      if (ok.length) {
        codeForm(L("Voer de code van 6 cijfers uit je authenticator-app in.", "Enter the 6-digit code from your authenticator app."), "", async function (code) {
          var r = await sb.auth.mfa.challengeAndVerify({ factorId: ok[0].id, code: code });
          if (r.error) throw r.error;
          enter();
        });
        return;
      }
      /* eerste keer: half afgemaakte koppelingen opruimen en nieuw koppelen */
      for (var i = 0; i < all.length; i++) {
        if (all[i].factor_type === "totp" && all[i].status !== "verified") { try { await sb.auth.mfa.unenroll({ factorId: all[i].id }); } catch (e) {} }
      }
      var en = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "NEXUS The Bridge " + new Date().toISOString().slice(0, 10), issuer: "Grupo Soltura NEXUS" });
      if (en.error) throw en.error;
      var t = en.data.totp || {};
      codeForm(
        L("Scan de QR-code met een authenticator-app (Google Authenticator, Microsoft Authenticator, 1Password…) en vul daarna de code in. Dit doe je één keer; daarna vraagt The Bridge per sessie om een code.",
          "Scan the QR code with an authenticator app, then enter the code. You do this once; after that The Bridge asks for a code each session."),
        '<div class="mfa-qr"><img alt="QR" src="' + ctx.esc(t.qr_code || "") + '"></div><div class="mfa-sec sm muted">' + L("Of typ deze sleutel", "Or type this key") + ': <code>' + ctx.esc(t.secret || "") + "</code></div>",
        async function (code) {
          var r = await sb.auth.mfa.challengeAndVerify({ factorId: en.data.id, code: code });
          if (r.error) throw r.error;
          enter();
        });
    } catch (err) {
      var msg = String((err && err.message) || err);
      box('<div class="mfa-hd"><span class="mfa-ic">⚡</span><h3>The Bridge</h3></div><p class="mfa-lead">' +
        L("Tweestapsverificatie lukte niet: ", "Two-step verification failed: ") + ctx.esc(msg) + "</p>" +
        (/disabled|not enabled/i.test(msg) ? '<p class="sm muted">' + L("Zet in Supabase onder Authentication → Multi-Factor de TOTP-optie aan.", "Enable TOTP under Authentication → Multi-Factor in Supabase.") + "</p>" : ""));
    }
  }

  w.NEXUS_PARTS = {
    init: function (c) {
      ctx = c;
      var me = c.me() || {};
      var br = d.getElementById("tabBr");
      if (br) {
        br.classList.toggle("hidden", me.bridge_owner !== true);
        br.onclick = function (e) { e.preventDefault(); go(); };
      }
    },
    open: open,
    bridge: go
  };
})(window, document);
