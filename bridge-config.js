// The Bridge - gedeelde configuratie voor kpi, agents, competition, credentials en floor.
// Supabase publishable key 'bridge-dashboard' (sinds 2026-10-03, vervangt de legacy anon JWT).
// Publiek by design: RLS + RPC-gates zijn de echte bescherming. organisation.html,
// constellation.html en bridge-credentials-screen.html hebben dezelfde key inline.
window.BRIDGE_CONFIG = {
  SUPABASE_URL: "https://wuvpbwowdycsdlrqkaoq.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_4FzuR1v2uE0VAAH75XgHIQ_o2qEH6n3"
};

/* Favicon: rode Bridge-tegel in het browsertabblad (favicon.svg). Idempotent. */
(function(){try{var d=document;if(d.querySelector('link[rel~="icon"]'))return;var l=d.createElement("link");l.rel="icon";l.type="image/svg+xml";l.href="/favicon.svg?v=1";(d.head||d.documentElement).appendChild(l);}catch(e){}})();
