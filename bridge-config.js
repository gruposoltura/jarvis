// The Bridge - gedeelde configuratie voor kpi, agents, competition, credentials en floor.
// Supabase publishable key 'bridge-dashboard' (sinds 2026-10-03, vervangt de legacy anon JWT).
// Publiek by design: RLS + RPC-gates zijn de echte bescherming. organisation.html,
// constellation.html en bridge-credentials-screen.html hebben dezelfde key inline.
window.BRIDGE_CONFIG = {
  SUPABASE_URL: "https://wuvpbwowdycsdlrqkaoq.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_4FzuR1v2uE0VAAH75XgHIQ_o2qEH6n3",
  // Eén login (22-10-2026): The Bridge gebruikt de sessie van NEXUS. Inloggen gebeurt
  // alleen op /nexus.html; The Bridge eist eigenaar + tweestapsverificatie (aal2).
  STORAGE_KEY: "nexus-auth",
  LOGIN_URL: "/nexus.html#bridge"
};

/* Elke Supabase-client op deze pagina's leest dezelfde NEXUS-sessie. */
(function(){try{
  var sb=window.supabase; if(!sb||!sb.createClient||sb.__nexusKey)return;
  var orig=sb.createClient;
  sb.createClient=function(url,key,opts){opts=opts||{};opts.auth=opts.auth||{};
    if(!opts.auth.storageKey)opts.auth.storageKey=window.BRIDGE_CONFIG.STORAGE_KEY;
    if(opts.auth.persistSession===undefined)opts.auth.persistSession=true;
    return orig.call(sb,url,key,opts)};
  sb.__nexusKey=true;
}catch(e){}})();
/* Oude, losse Bridge-sessie opruimen (vóór 22-10-2026 had The Bridge een eigen login). */
(function(){try{localStorage.removeItem("sb-wuvpbwowdycsdlrqkaoq-auth-token")}catch(e){}})();

/* Favicon: rode Bridge-tegel in het browsertabblad (favicon.svg). Idempotent. */
(function(){try{var d=document;if(d.querySelector('link[rel~="icon"]'))return;var l=d.createElement("link");l.rel="icon";l.type="image/svg+xml";l.href="/favicon.svg?v=1";(d.head||d.documentElement).appendChild(l);}catch(e){}})();

/* Actielijst (BD-124): alleen op de cockpit (kpi.html) de module bridge-actions.js laden. Idempotent. */
(function(){try{var p=location.pathname;if(!/\/kpi\.html$/.test(p))return;var d=document;if(d.getElementById("bridge-actions-js"))return;var s=d.createElement("script");s.id="bridge-actions-js";s.src="/bridge-actions.js?v=1";s.defer=true;(d.head||d.documentElement).appendChild(s);}catch(e){}})();
