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
  var STALE_HOURS = 48;              // vangnet-drempel (uur)

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
     6. last_run ouder dan STALE_HOURS -> stale   (vangnet)
     7. anders                          -> ok      */
  function classify(a){
    if(!a) return "idle";
    if(a.paused) return "paused";
    if(a.last_status === "error") return "error";
    if(a.last_status === "stale") return "stale";
    if(a.last_status === "running") return "running";
    if(a.last_status === "idle" || !a.last_run) return "idle";
    if(new Date(a.last_run).getTime() < Date.now() - STALE_HOURS*3600*1000) return "stale";
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
    classify: classify,
    count: count,
    load: load,
    summaryText: summaryText,
    summaryHTML: summaryHTML
  };
})();
