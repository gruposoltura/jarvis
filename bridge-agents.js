/* The Bridge - bridge-agents.js
   =============================================================
   ENIGE bron van waarheid voor de agent-telling in de Bridge.
   Gebruikt door: agents.html, kpi.html, organisation.html.

   - Canonieke databron : Supabase-view 'bridge_agent_index'
     (1 rij per agent: agent_id, agent_name, bridge_dept,
      schedule_human, paused, last_status, last_run, ...)
   - Eén classificatie  : classify(agent)
   - Eén telling        : count(agents)
   - Eén weergave       : summaryText / summaryHTML

   Regels aanpassen (bijv. andere stale-drempel of een categorie
   altijd tonen) doe je ALLEEN hier - alle panelen veranderen dan
   tegelijk mee.

   Klassiek script (geen ES-module): werkt zowel in gewone
   <script>-pagina's als in <script type="module">-pagina's via
   window.BRIDGE_AGENTS. Bevat GEEN keys; elke pagina geeft haar
   eigen (al ingelogde) Supabase-client mee aan load(sb). */
(function(){
  "use strict";

  var VIEW = "bridge_agent_index";   // canonieke Supabase-view
  var STALE_HOURS = 48;              // vangnet-drempel (uur) als de view geen expected_frequency_hours levert
  var STALE_FACTOR = 1.5;            // vangnet = expected_frequency_hours * STALE_FACTOR (marge voor een gemiste slag)

  /* Kleuren voor summaryHTML - bewust hardcoded zodat het bestand
     op elke pagina identiek rendert, ongeacht de lokale CSS-vars. */
  var COLOR = {
    ok:     "#3ee08f",
    running:"#00d4ff",
    idle:   "#7d8ca3",
    error:  "#ff5f6b",
    stale:  "#ffb547",
    paused: "#7d8ca3"
  };
  var LABEL = {
    total:  "totaal",
    ok:     "ok",
    idle:   "zonder status",
    error:  "fout",
    stale:  "verouderd",
    paused: "gepauzeerd"
  };

  /* De ENIGE classificatiefunctie. Volgorde is betekenisvol:
     1. paused                          -> paused
     2. last_status === "error"        -> error
     3. last_status === "stale"        -> stale   (per-agent schema, backend)
     4. last_status === "running"      -> running (telt als ok in samenvatting)
     5. last_status === "idle" of geen last_run -> idle
     6. vangnet op expected_frequency_hours (registry):
        - NULL  -> vraaggestuurd (webhook/mail/on approve): nooit stale
        - getal -> stale als last_run ouder is dan getal * STALE_FACTOR
        - kolom ontbreekt (oude view) -> STALE_HOURS
     7. anders                          -> ok      */
  function classify(a){
    if(!a) return "idle";
    if(a.paused) return "paused";
    if(a.last_status === "error") return "error";
    if(a.last_status === "stale") return "stale";
    if(a.last_status === "running") return "running";
    if(a.last_status === "idle" || !a.last_run) return "idle";
    var exp = a.expected_frequency_hours;
    var limitHours;
    if(exp === undefined) limitHours = STALE_HOURS;            // oude view zonder kolom
    else if(exp === null || !(Number(exp) > 0)) return "ok";  // vraaggestuurd: geen verwachting, geen vangnet
    else limitHours = Number(exp) * STALE_FACTOR;
    if(new Date(a.last_run).getTime() < Date.now() - limitHours*3600*1000) return "stale";
    return "ok";
  }

  function count(agents){
    var c = { total:0, ok:0, running:0, idle:0, error:0, stale:0, paused:0 };
    (agents || []).forEach(function(a){
      c.total++;
      c[classify(a)]++;
    });
    return c;
  }

  /* Haalt de canonieke view op via de meegegeven Supabase-client.
     Geeft {agents, counts} terug. Gooit bij fout een Error zodat de
     aanroepende pagina zelf beslist (fallback/melding). */
  function load(sb){
    return sb.from(VIEW).select("*")
      .order("bridge_dept").order("agent_name")
      .then(function(r){
        if(r.error) throw new Error(r.error.message || "bridge_agent_index onbereikbaar");
        var agents = r.data || [];
        return { agents: agents, counts: count(agents) };
      });
  }

  /* Samenvatting: categorieën met 0 worden weggelaten, behalve
     'totaal' en 'ok'. 'running' telt op bij 'ok'. */
  function parts(c){
    var okAll = (c.ok||0) + (c.running||0);
    var p = [
      { key:"total",  n:c.total||0, always:true },
      { key:"ok",     n:okAll,      always:true },
      { key:"error",  n:c.error||0 },
      { key:"stale",  n:c.stale||0 },
      { key:"idle",   n:c.idle||0 },
      { key:"paused", n:c.paused||0 }
    ];
    return p.filter(function(x){ return x.always || x.n > 0; });
  }

  function summaryText(c){
    return parts(c).map(function(x){ return x.n + " " + LABEL[x.key]; }).join(" \u00b7 ");
  }

  function summaryHTML(c){
    return parts(c).map(function(x){
      var col = x.key === "total" ? "" :
        ' style="color:' + (COLOR[x.key] || COLOR.idle) + '"';
      return "<b" + col + ">" + x.n + "</b>\u2009" + LABEL[x.key];
    }).join(" \u00b7 ");
  }

  window.BRIDGE_AGENTS = {
    VIEW: VIEW,
    STALE_HOURS: STALE_HOURS,
    STALE_FACTOR: STALE_FACTOR,
    classify: classify,
    count: count,
    load: load,
    summaryText: summaryText,
    summaryHTML: summaryHTML
  };
})();

/* --- Health-pill (Systems Roll Call) --------------------------------
   Zelfstandig blok, los van BRIDGE_AGENTS hierboven. Injecteert
   rechtsboven in de cockpit-balk (#top, naast #stamp) een status-pill
   die public.bridge_health leest (anon SELECT toegestaan, geen auth
   nodig). Doet niets op pagina's zonder de cockpit-balk en kan de
   cockpit nooit blokkeren (alles in try/catch/stil). Bron van de
   data: workflow JARVIS-Infra-HealthCheck (dagelijks 07:35). */
(function(){
  "use strict";
  var CFG = (window.BRIDGE_CONFIG || {});
  var SB_URL = CFG.SUPABASE_URL || window.SUPABASE_URL || "https://wuvpbwowdycsdlrqkaoq.supabase.co";
  var SB_KEY = CFG.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || "";
  if(!SB_KEY) return;

  var MAP = {
    green: { c:"#4fd1a1", bg:"rgba(79,209,161,.15)", t:"ALLES OK" },
    amber: { c:"#e67e22", bg:"rgba(230,126,34,.15)", t:"LET OP" },
    red:   { c:"#ff5d5d", bg:"rgba(255,93,93,.15)",  t:"ACTIE NODIG" }
  };

  function injectStyle(){
    if(document.getElementById("jarvisHealthPillCss")) return;
    var st = document.createElement("style");
    st.id = "jarvisHealthPillCss";
    st.textContent =
      "#jarvisHealthPill{display:inline-flex;align-items:center;gap:7px;margin-left:12px;" +
      "font-size:11px;font-weight:800;letter-spacing:.04em;padding:4px 11px;border-radius:99px;" +
      "white-space:nowrap;cursor:default}" +
      "#jarvisHealthPill .hb-dot{width:8px;height:8px;border-radius:50%;flex:none}";
    document.head.appendChild(st);
  }

  function render(d){
    var pill = document.getElementById("jarvisHealthPill");
    if(!pill) return;
    var m = MAP[d && d.overall] || MAP.green;
    pill.style.color = m.c;
    pill.style.background = m.bg;
    pill.innerHTML = '<span class="hb-dot" style="background:' + m.c + '"></span>' +
      ((d && d.headline) ? String(d.headline) : m.t);
    var when = (d && d.checked_at)
      ? new Date(d.checked_at).toLocaleString("nl-NL", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})
      : "";
    pill.title = "Systems Roll Call" + (when ? (" \u00b7 " + when) : "") +
      (d ? ("\n" + (d.silent_count||0) + " stil \u00b7 " + (d.error_count||0) + " fouten \u00b7 " +
        (d.warn_count||0) + " warn \u00b7 " + (d.stale_count||0) + " stale \u00b7 " +
        (d.memo_count||0) + " memo") : "");
  }

  function refresh(){
    try{
      fetch(SB_URL + "/rest/v1/bridge_health?id=eq.1&select=*",
        { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } })
        .then(function(r){ return r.ok ? r.json() : []; })
        .then(function(rows){ if(rows && rows[0]) render(rows[0]); })
        .catch(function(){});
    }catch(e){}
  }

  function mount(){
    var stamp = document.querySelector("#top #stamp");
    if(!stamp) return false;
    if(!document.getElementById("jarvisHealthPill")){
      injectStyle();
      var pill = document.createElement("span");
      pill.id = "jarvisHealthPill";
      stamp.parentNode.insertBefore(pill, stamp.nextSibling);
      render(null);
      refresh();
      setInterval(refresh, 60000);
      document.addEventListener("visibilitychange", function(){
        if(document.visibilityState === "visible") refresh();
      });
    }
    return true;
  }

  // De cockpit onthult #top pas na login; poll de balk tot 60s.
  if(!mount()){
    var tries = 0;
    var iv = setInterval(function(){
      tries++;
      if(mount() || tries > 120) clearInterval(iv);
    }, 500);
  }
})();
