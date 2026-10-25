/* =====================================================================
   NEXUS · Tarievenkaart (Rick, 25-10-2026)
   Paneel in Contact > Profiel bij rol Buyer of Suspect (koper). Kosten koper bij
   aankoop van een bestaande woning in vier kolommen:
     1 kostenpost  2 werkelijke kosten bij benadering (standaard, uitgangspunt)
     3 All-in      4 A-la-carte
   De klant kiest All-in of A-la-carte (toggle, per contact opgeslagen).
   - A-la-carte: alles 1-op-1 uit de werkelijke kosten, behalve Juridische
     begeleiding, NIE-nummer en Hypotheekbemiddeling (afspraak per contact).
   - All-in: een prijs voor alles behalve hypotheekbemiddeling.
   - Hypotheekbemiddeling: zelfde standaardtarief in beide, per contact aan te passen.
   Data: core.tariff_card_defaults (standaard, alleen admin wijzigt) en
   core.contact_tariff_cards (keuze + afwijkingen per contact), via de RPC's
   nexus_tariff_card / nexus_tariff_card_save / nexus_tariff_defaults_save.
   ===================================================================== */
(function (w) {
  "use strict";
  var ROWS = [
    { k: "legal",    nl: "Juridische begeleiding",              en: "Legal assistance",                ac: "deal" },
    { k: "notary",   nl: "Notariskosten",                       en: "Notary fees",                     ac: "pass" },
    { k: "registry", nl: "Registerkosten (Eigendomsregister)",  en: "Land Registry fees",              ac: "pass" },
    { k: "nie",      nl: "NIE-nummer",                          en: "NIE number",                      ac: "deal" },
    { k: "poa",      nl: "Volmacht",                            en: "Power of attorney",               ac: "pass", qty: 1 },
    { k: "mortgage", nl: "Hypotheekbemiddeling",                en: "Mortgage brokerage",              ac: "deal", own: 1 }
  ];

  function mount(el, contactId, ctx) {
    if (!el || !contactId) return;
    var L = function (nl, en) { return ctx.lang() === "en" ? en : nl; };
    var esc = ctx.esc, eur = ctx.eur;
    /* ctx.form (Contact bewerken, 25-10): geen autosave; wijzigingen gaan mee met Opslaan van het venster (ctx.onChange).
       ctx.state: gedeelde staat zodat een hertekening van het venster niets kwijtraakt. */
    var form = !!ctx.form;
    var st = ctx.state || {};
    if (!st.init) Object.assign(st, { init: 1, def: null, card: null, data: {}, choice: null, canDef: false, defMode: false, defEdit: null, saving: false, msg: "" });

    function n(v) { return v == null || v === "" || isNaN(Number(v)) ? null : Number(v); }
    function A() { return st.defMode ? st.defEdit.actual : st.def.actual; }
    function qty() { var q = n(st.data.poa_count); return q == null ? 1 : q; }
    /* waarde per cel: contactafwijking, anders standaard */
    function val(col, k) {
      var D = st.defMode ? st.defEdit : st.def, d = st.data;
      if (col === "actual") return k === "poa" ? (n(A().poa) || 0) * qty() : (n(A()[k]) || 0);
      if (k === "mortgage") {
        var ov = st.defMode ? null : n(d[col === "allin" ? "mortgage_allin" : "mortgage_alacarte"]);
        return ov != null ? ov : (n(D.mortgage) || 0);
      }
      if (col === "allin") return null; /* inbegrepen in de All-in prijs */
      if (k === "legal" || k === "nie") {
        var o = st.defMode ? null : n(d[k]);
        return o != null ? o : (n(D.alacarte[k]) || 0);
      }
      return val("actual", k); /* doorbelast 1-op-1 */
    }
    function allinPrice() { var o = st.defMode ? null : n(st.data.allin); return o != null ? o : (n((st.defMode ? st.defEdit : st.def).allin) || 0); }
    function totals() {
      var t = { actual: 0, allin: allinPrice() + val("allin", "mortgage"), alacarte: 0 };
      ROWS.forEach(function (r) { t.actual += val("actual", r.k); t.alacarte += val("alacarte", r.k); });
      return t;
    }
    /* invoerveld; ph = standaardwaarde (leeg = standaard) */
    function inp(key, v, def, title) {
      var differs = !st.defMode && v != null && def != null && Number(v) !== Number(def);
      return '<span class="tc-in' + (differs ? " ovr" : "") + '"><span class="eu">€</span><input type="number" min="0" step="25" inputmode="decimal" data-tk="' + key + '" value="' + (v == null ? "" : v) + '" placeholder="' + (def == null ? "" : def) + '"' + (title ? ' title="' + esc(title) + '"' : "") + '>' +
        (differs ? '<a class="tc-rst" data-trst="' + key + '" title="' + esc(L("Terug naar standaard ", "Back to default ") + eur(def)) + '">↺</a>' : "") + "</span>";
    }
    function dinp(path, v) { return '<span class="tc-in def"><span class="eu">€</span><input type="number" min="0" step="25" inputmode="decimal" data-td="' + path + '" value="' + (v == null ? "" : v) + '"></span>'; }

    function render() {
      if (!st.def) return;
      var D = st.defMode ? st.defEdit : st.def, d = st.data, T = totals(), ch = st.defMode ? null : st.choice;
      var head = function (col, title, sub) {
        var on = ch === col;
        return '<th class="tc-opt' + (on ? " on" : ch ? " off" : "") + '"><button type="button" class="tc-pick" data-tpick="' + col + '"' + (st.defMode ? " disabled" : "") + ' aria-pressed="' + on + '">' +
          '<span class="tc-radio"></span><span><b>' + title + '</b><small>' + sub + "</small></span></button></th>";
      };
      var cls = function (col) { return ch === col ? " on" : ch && (col === "allin" || col === "alacarte") ? " off" : ""; };
      var rows = ROWS.map(function (r, i) {
        var lab = L(r.nl, r.en);
        if (r.qty) lab += ' <span class="tc-qty"><input type="number" min="0" step="1" data-tk="poa_count" value="' + qty() + '"' + (st.defMode ? " disabled" : "") + '> × ' + eur(n(A().poa)) + "</span>";
        var act = st.defMode ? dinp("actual." + r.k, n(A()[r.k])) : eur(val("actual", r.k));
        var ai;
        if (r.own) ai = st.defMode ? dinp("mortgage", n(D.mortgage)) : inp("mortgage_allin", n(d.mortgage_allin) != null ? d.mortgage_allin : null, n(D.mortgage));
        else if (i === 0) ai = { span: 1 };
        else ai = null;
        var ac;
        if (r.own) ac = st.defMode ? '<span class="muted sm">' + L("zelfde tarief", "same rate") + "</span>" : inp("mortgage_alacarte", n(d.mortgage_alacarte), n(D.mortgage));
        else if (r.ac === "deal") ac = st.defMode ? dinp("alacarte." + r.k, n(D.alacarte[r.k])) : inp(r.k, n(d[r.k]), n(D.alacarte[r.k]));
        else ac = eur(val("alacarte", r.k)) + ' <span class="tc-tag">' + L("1-op-1", "at cost") + "</span>";
        var allinCell = "";
        if (ai && ai.span) {
          allinCell = '<td class="tc-c tc-allin' + cls("allin") + '" rowspan="5"><div class="tc-one"><span class="muted sm">' + L("Eén prijs voor", "One price for") + "<br>" + L("deze vijf posten", "these five items") + "</span>" +
            (st.defMode ? dinp("allin", n(D.allin)) : inp("allin", n(d.allin), n(D.allin))) + "</div></td>";
        } else if (r.own) allinCell = '<td class="tc-c' + cls("allin") + '">' + ai + "</td>";
        return '<tr class="' + (r.own ? "tc-own" : "") + '"><td class="tc-lab">' + lab + (r.ac === "deal" ? ' <span class="tc-tag deal">' + L("afspraak", "agreed") + "</span>" : "") + "</td>" +
          '<td class="tc-c tc-act">' + act + "</td>" + allinCell + '<td class="tc-c' + cls("alacarte") + '">' + ac + "</td></tr>";
      }).join("");
      var diff = function (v) { var x = v - T.actual; return (x >= 0 ? "+ " : "− ") + eur(Math.abs(x)); };
      var foot = '<tr class="tc-tot"><td>' + L("Totaal kosten koper", "Total buyer costs") + '</td><td class="tc-c tc-act">' + eur(T.actual) + '</td><td class="tc-c' + cls("allin") + '"><b>' + eur(T.allin) + '</b></td><td class="tc-c' + cls("alacarte") + '"><b>' + eur(T.alacarte) + "</b></td></tr>" +
        '<tr class="tc-diff"><td>' + L("Verschil met werkelijke kosten", "Difference vs actual costs") + '</td><td class="tc-c tc-act">—</td><td class="tc-c' + cls("allin") + '">' + diff(T.allin) + '</td><td class="tc-c' + cls("alacarte") + '">' + diff(T.alacarte) + "</td></tr>";
      var who = st.card && st.card.updated_at ? L("Laatst gewijzigd ", "Last changed ") + new Date(st.card.updated_at).toLocaleDateString(ctx.lang() === "en" ? "en-GB" : "nl-NL") + (st.card.updated_by ? " · " + esc(st.card.updated_by) : "") : L("Nog niets vastgelegd voor dit contact; de standaardtarieven gelden.", "Nothing saved for this contact yet; default rates apply.");
      var chosen = ch ? L("Gekozen: ", "Chosen: ") + "<b>" + (ch === "allin" ? "All-in" : "A-la-carte") + "</b> · " + eur(ch === "allin" ? T.allin : T.alacarte) : L("Klant heeft nog geen tarief gekozen — klik op All-in of A-la-carte.", "Client has not chosen a rate yet — click All-in or A-la-carte.");
      if (form) who = dirty(st) ? L("Wordt opgeslagen met Opslaan", "Saved with Save") : who;
      el.innerHTML = (form ? "" :
        '<div class="hd"><h3>' + L("Tarievenkaart", "Rate card") + ' <span class="muted sm" style="font-weight:500">· ' + L("bestaande bouw", "resale") + '</span></h3><span class="pk-sec-r">') + (form ? "" :
        (st.canDef ? '<a class="tc-defbtn' + (st.defMode ? " on" : "") + '" data-defmode="1" title="' + esc(L("Standaardtarieven voor alle contacten wijzigen", "Change default rates for all contacts")) + '">' + (st.defMode ? L("Klaar", "Done") : "✎ " + L("Standaard", "Defaults")) + "</a>" : "") + "</span></div>") +
        (st.defMode ? '<div class="tc-warn">' + L("Je wijzigt de <b>standaardtarieven</b>. Dit geldt voor alle contacten zonder eigen afspraak. Wijzig de werkelijke kosten alleen als ze in de praktijk veranderen.", "You are editing the <b>default rates</b>. This applies to all contacts without their own agreement. Change actual costs only when they change in practice.") + "</div>" : "") +
        '<div class="tc-wrap"><table class="tc"><thead><tr><th class="tc-lab">' + L("Kostenpost", "Cost item") + '</th><th class="tc-act">' + L("Werkelijke kosten", "Actual costs") + "<small>" + L("bij benadering", "approx.") + "</small></th>" +
        head("allin", "All-in", L("alles voor één prijs", "everything for one price")) + head("alacarte", "A-la-carte", L("werkelijke kosten + afspraak", "actual costs + agreement")) +
        "</tr></thead><tbody>" + rows + "</tbody><tfoot>" + foot + "</tfoot></table></div>" +
        '<div class="tc-ft"><span>' + (st.defMode ? L("Standaard sinds ", "Defaults since ") + new Date(st.defAt).toLocaleDateString(ctx.lang() === "en" ? "en-GB" : "nl-NL") : chosen) + '</span><span class="muted sm">' + (st.msg ? esc(st.msg) : st.defMode ? "" : who) + "</span></div>";
      bind();
    }

    var timer = null;
    function bind() {
      el.querySelectorAll("[data-tpick]").forEach(function (b) { b.onclick = function () { st.choice = st.choice === b.dataset.tpick ? null : b.dataset.tpick; render(); save(); }; });
      el.querySelectorAll("input[data-tk]").forEach(function (i) {
        i.onchange = function () {
          var v = i.value.trim(), k = i.dataset.tk;
          if (v === "" || isNaN(Number(v)) || Number(v) < 0) delete st.data[k]; else st.data[k] = Number(v);
          if (k === "poa_count" && st.data.poa_count === 1) delete st.data.poa_count;
          render(); save();
        };
        i.onkeydown = function (e) { if (e.key === "Enter") i.blur(); };
      });
      el.querySelectorAll("[data-trst]").forEach(function (a) { a.onclick = function () { delete st.data[a.dataset.trst]; render(); save(); }; });
      el.querySelectorAll("input[data-td]").forEach(function (i) {
        i.onchange = function () {
          var v = Number(i.value), p = i.dataset.td.split(".");
          if (i.value.trim() === "" || isNaN(v) || v < 0) { render(); return; }
          if (p.length === 2) st.defEdit[p[0]][p[1]] = v; else st.defEdit[p[0]] = v;
          render(); saveDef();
        };
      });
      var dm = el.querySelector("[data-defmode]");
      if (dm) dm.onclick = function () {
        st.defMode = !st.defMode;
        if (st.defMode) st.defEdit = JSON.parse(JSON.stringify(st.def));
        st.msg = ""; render();
      };
    }
    function save() {
      if (form) { if (ctx.onChange) ctx.onChange(); return; }
      clearTimeout(timer);
      timer = setTimeout(async function () {
        st.msg = L("Opslaan…", "Saving…"); paintMsg();
        try { apply(await ctx.rpc("nexus_tariff_card_save", { p_contact: contactId, p_choice: st.choice, p_data: st.data })); st.msg = ""; }
        catch (e) { st.msg = L("Niet opgeslagen: ", "Not saved: ") + (e.message || e); }
        render();
      }, 350);
    }
    async function saveDef() {
      st.msg = L("Opslaan…", "Saving…"); paintMsg();
      try { st.def = await ctx.rpc("nexus_tariff_defaults_save", { p_data: st.defEdit }); st.defEdit = JSON.parse(JSON.stringify(st.def)); st.defAt = new Date().toISOString(); st.msg = L("Standaard opgeslagen", "Defaults saved"); }
      catch (e) { st.msg = L("Niet opgeslagen: ", "Not saved: ") + (e.message || e); }
      render();
    }
    function paintMsg() { var m = el.querySelector(".tc-ft .muted"); if (m) m.textContent = st.msg; }
    function apply(r) {
      st.def = r.defaults; st.defAt = r.defaults_at; st.canDef = !!r.can_defaults; st.card = r.card;
      st.choice = r.card ? r.card.choice : null; st.data = (r.card && r.card.data) || {};
      st.orig = snap(st);
    }
    if (form) st.canDef = false;
    if (st.def) { if (form) st.canDef = false; render(); return; }
    el.innerHTML = (form ? "" : '<div class="hd"><h3>' + L("Tarievenkaart", "Rate card") + '</h3></div>') + '<div class="cp-empty">' + L("Laden…", "Loading…") + "</div>";
    ctx.rpc("nexus_tariff_card", { p_contact: contactId }).then(function (r) {
      apply(r); if (form) st.canDef = false;
      if (!el.isConnected) return;
      render();
    }).catch(function (e) { el.innerHTML = '<div class="hd"><h3>' + L("Tarievenkaart", "Rate card") + '</h3></div><div class="cp-empty">' + esc(e.message || String(e)) + "</div>"; });
  }
  function snap(st) { var d = st.data || {}; return JSON.stringify([st.choice || null, Object.keys(d).sort().map(function (k) { return [k, d[k]]; })]); }
  function dirty(st) { return !!(st && st.def && st.orig != null && snap(st) !== st.orig); }
  /* opslaan vanuit Contact bewerken */
  async function saveState(rpc, contactId, st) {
    var r = await rpc("nexus_tariff_card_save", { p_contact: contactId, p_choice: st.choice || null, p_data: st.data || {} });
    st.card = r.card; st.orig = snap(st); return r;
  }
  w.NEXUS_TARIFF = { mount: mount, dirty: dirty, save: saveState };
})(window);
