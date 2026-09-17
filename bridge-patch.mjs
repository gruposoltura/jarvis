#!/usr/bin/env node
/* bridge-patch.mjs - past organisation.html + constellation.html aan (2026-09-17)
   Draaien in de repo-root:  node bridge-patch.mjs
   Elk anker moet in elk bestand precies EEN keer voorkomen; anders wordt NIETS geschreven.
   Wat het doet: resultaat van de laatste run op de kaart, "wacht op invoer" voor vraaggestuurde
   agents, relatieve tijd, kop-getallen VEROUDERD/ERRORS klikbaar als filter, dubbele tellers weg. */
import fs from "node:fs";
const PATCHES = [
 {
  "name": "css",
  "old": "  .ac-sub{margin-top:3px;display:inline-flex;align-items:center;font:700 8px/1 system-ui;\n    letter-spacing:.12em;text-transform:uppercase;color:var(--cyan);\n    border:1px solid color-mix(in srgb,var(--cyan) 40%, transparent);border-radius:5px;padding:2px 5px}",
  "new": "  .ac-sub{margin-top:3px;display:inline-flex;align-items:center;font:700 8px/1 system-ui;\n    letter-spacing:.12em;text-transform:uppercase;color:var(--cyan);\n    border:1px solid color-mix(in srgb,var(--cyan) 40%, transparent);border-radius:5px;padding:2px 5px}\n  /* resultaat van de laatste run (jarvis_runs.summary via bridge_agent_index.last_summary) */\n  .ac-sum{margin-top:2px;font-size:9.5px;line-height:1.25;color:var(--text);opacity:.78;\n    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n  .ac-sum:empty{display:none}\n  /* vraaggestuurde agent (expected_frequency_hours NULL): geen 0/24u-teller maar een label */\n  .ac-od{font:700 8px/1 system-ui;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);\n    border:1px solid var(--hair);border-radius:5px;padding:2px 5px;white-space:nowrap}\n  /* kop-filter: klik VEROUDERD / ERRORS -> alleen die kaarten oplichten */\n  .metric.clickable{cursor:pointer;border-radius:8px;padding:3px 6px;margin:-3px -6px;transition:background .15s}\n  .metric.clickable:hover{background:rgba(255,255,255,.06)}\n  .metric.flt-on{background:rgba(255,255,255,.08);box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}\n  .agent-unit.flt-dim{opacity:.16;filter:grayscale(1);transition:opacity .2s}",
  "files": [
   "organisation.html",
   "constellation.html"
  ],
  "regex": false
 },
 {
  "name": "agoNL",
  "old": "const RUNGLYPH={ ok:{ch:\"✓\",cls:\"run-ok\"}, running:{ch:\"⟳\",cls:\"run-go\"},",
  "new": "/* relatieve tijd op de kaart (NL, kort); de volledige tijd staat in de tooltip */\nconst agoNL=ts=>{ if(!ts)return\"—\"; const d=new Date(ts); if(isNaN(d))return\"—\";\n  const s=Math.floor((Date.now()-d)/1000);\n  if(s<60)return\"nu\"; if(s<3600)return Math.floor(s/60)+\" min\"; if(s<86400)return Math.floor(s/3600)+\" u\";\n  if(s<7*86400)return Math.floor(s/86400)+\" d\"; return fmtRun(ts); };\nconst LASTSUM={};                  // agent_id -> summary van de laatste run (bridge_agent_index.last_summary)\nconst EXPH={};                     // agent_id -> expected_frequency_hours (NULL = vraaggestuurd)\nlet agentClass={};                 // agent_id -> BRIDGE_AGENTS.classify() (voor het kop-filter)\nlet orgFilter=null;                // \"stale\" | \"error\" | null\nconst RUNGLYPH={ ok:{ch:\"✓\",cls:\"run-ok\"}, running:{ch:\"⟳\",cls:\"run-go\"},",
  "files": [
   "organisation.html",
   "constellation.html"
  ],
  "regex": false
 },
 {
  "name": "renderMetrics-nodes",
  "old": "  if(currentView===\"radial\"){ $(\"mNodes\").textContent=UNITS.length; $(\"mNodesL\").textContent=\"NODES ZICHTBAAR\"; }\n  else { $(\"mNodes\").textContent=AGENTS.length; $(\"mNodesL\").textContent=\"AGENTS ZICHTBAAR\"; }",
  "new": "  if(currentView===\"radial\"){ $(\"mNodes\").parentElement.style.display=\"\"; $(\"mNodes\").textContent=UNITS.length; $(\"mNodesL\").textContent=\"NODES ZICHTBAAR\"; }\n  else { $(\"mNodes\").parentElement.style.display=\"none\"; }   // in het organigram altijd gelijk aan AGENTS TOT. -> weglaten",
  "files": [
   "organisation.html",
   "constellation.html"
  ],
  "regex": false
 },
 {
  "name": "refreshAgentCounts",
  "old": "    const r=await window.BRIDGE_AGENTS.load(SB);\n    sharedCounts=r.counts;",
  "new": "    const r=await window.BRIDGE_AGENTS.load(SB);\n    sharedCounts=r.counts;\n    /* per-agent gegevens uit dezelfde canonieke bron: klasse (filter), laatste summary, verwachte frequentie */\n    agentClass={};\n    (r.agents||[]).forEach(a=>{ agentClass[a.agent_id]=window.BRIDGE_AGENTS.classify(a);\n      LASTSUM[a.agent_id]=a.last_summary||\"\"; EXPH[a.agent_id]=a.expected_frequency_hours; });\n    updateOrgStatus(); fillRuns24(); applyOrgFilter();",
  "files": [
   "organisation.html",
   "constellation.html"
  ],
  "regex": false
 },
 {
  "name": "filter-wiring",
  "old": "$(\"viewToggle\").addEventListener(\"click\",e=>{ const b=e.target.closest(\"button\"); if(b) setView(b.dataset.view); });",
  "new": "$(\"viewToggle\").addEventListener(\"click\",e=>{ const b=e.target.closest(\"button\"); if(b) setView(b.dataset.view); });\n/* kop-filter: VEROUDERD / ERRORS aanklikken laat alleen die kaarten oplichten en scrolt naar de eerste */\nfunction applyOrgFilter(){\n  const on=!!orgFilter; let first=null;\n  document.querySelectorAll(\".agent-unit[data-unit]\").forEach(u=>{\n    const id=u.getAttribute(\"data-unit\"), hit=on && agentClass[id]===orgFilter;\n    u.classList.toggle(\"flt-dim\", on && !hit);\n    if(hit && !first) first=u; });\n  [[\"mStale\",\"stale\"],[\"mErr\",\"error\"]].forEach(([el,k])=>{ const m=$(el)&&$(el).parentElement; if(m) m.classList.toggle(\"flt-on\",orgFilter===k); });\n  if(on && first && currentView===\"org\") first.scrollIntoView({block:\"center\",inline:\"center\",behavior:\"smooth\"});\n}\n[[\"mStale\",\"stale\"],[\"mErr\",\"error\"]].forEach(([el,k])=>{ const m=$(el)&&$(el).parentElement; if(!m)return;\n  m.classList.add(\"clickable\"); m.title=\"klik: alleen deze agents tonen (nogmaals = uit)\";\n  m.addEventListener(\"click\",()=>{ if(!sharedCounts||!(sharedCounts[k]>0)){ orgFilter=null; }\n    else orgFilter = orgFilter===k ? null : k;\n    if(orgFilter && currentView!==\"org\") setView(\"org\");\n    applyOrgFilter(); }); });",
  "files": [
   "organisation.html",
   "constellation.html"
  ],
  "regex": false
 },
 {
  "name": "card-summary",
  "old": "          <div class=\"ac-sched\"><span class=\"schedtxt\">${a.sched}</span><span class=\"ac24\" data-24=\"${a.id}\"></span></div>",
  "new": "          <div class=\"ac-sched\"><span class=\"schedtxt\">${a.sched}</span><span class=\"ac24\" data-24=\"${a.id}\"></span></div>\n          <div class=\"ac-sum\" data-sum=\"${a.id}\"></div>",
  "files": [
   "organisation.html",
   "constellation.html"
  ],
  "regex": false
 },
 {
  "name": "wire-sum",
  "old": "    orgAgentDep[id]=card.querySelector(\".ac-dep\");\n    const wf=card.querySelector(\".ac-wf\");",
  "new": "    orgAgentDep[id]=card.querySelector(\".ac-dep\");\n    orgAgentSum[id]=card.querySelector(\".ac-sum\");\n    const wf=card.querySelector(\".ac-wf\");",
  "files": [
   "organisation.html",
   "constellation.html"
  ],
  "regex": false
 },
 {
  "name": "sum-map",
  "old": "const orgAgentDep={};  // agentId -> .ac-dep element (readiness badge)",
  "new": "const orgAgentDep={};  // agentId -> .ac-dep element (readiness badge)\nconst orgAgentSum={};  // agentId -> .ac-sum element (resultaat laatste run)",
  "files": [
   "organisation.html",
   "constellation.html"
  ],
  "regex": false
 },
 {
  "name": "buildOrgOnce-clear",
  "old": "  for(const k in orgAgentDep)delete orgAgentDep[k];",
  "new": "  for(const k in orgAgentDep)delete orgAgentDep[k];\n  for(const k in orgAgentSum)delete orgAgentSum[k];",
  "files": [
   "organisation.html",
   "constellation.html"
  ],
  "regex": false
 },
 {
  "name": "fillRuns24",
  "old": "    const id=el.getAttribute(\"data-24\"), n=runs24[id]||0;\n    el.innerHTML = n>0 ? `<b>${n}</b>/24u` : `<b style=\"color:var(--dim)\">0</b>/24u`; }); }",
  "new": "    const id=el.getAttribute(\"data-24\"), n=runs24[id]||0;\n    const onDemand = (id in EXPH) && (EXPH[id]===null || EXPH[id]===undefined);   // geen verwachting = webhook/mail/on approve\n    el.innerHTML = n>0 ? `<b>${n}</b>/24u` : (onDemand ? `<span class=\"ac-od\" title=\"vraaggestuurd: draait als er invoer is\">wacht op invoer</span>` : `<b style=\"color:var(--dim)\">0</b>/24u`); }); }",
  "files": [
   "organisation.html",
   "constellation.html"
  ],
  "regex": false
 },
 {
  "name": "updateOrgStatus",
  "old": "    el.querySelector(\".rt\").textContent=lr?fmtRun(lr):\"—\";\n    el.title=lr?(\"laatst gedraaid · \"+ago(lr)):\"nog niet gedraaid\"; }",
  "new": "    el.querySelector(\".rt\").textContent=lr?agoNL(lr):\"—\";\n    el.title=lr?(\"laatst gedraaid · \"+fmtRunFull(lr)):\"nog niet gedraaid\"; }\n  for(const id in orgAgentSum){ const el=orgAgentSum[id]; if(!el)continue;\n    const s=(LASTSUM[id]||\"\").replace(/\\s+/g,\" \").trim();\n    el.textContent=s; el.title=s?(\"laatste run: \"+s):\"\"; }",
  "files": [
   "organisation.html",
   "constellation.html"
  ],
  "regex": false
 },
 {
  "name": "loadSubworkflows",
  "old": "    const {data,error}=await sb.from(\"bridge_agent_index\").select(\"agent_id,has_subworkflow\");\n    if(error){ console.warn(\"bridge_agent_index has_subworkflow:\",error.message); return; }\n    SUBWF.clear();\n    (data||[]).forEach(r=>{ if(r.has_subworkflow) SUBWF.add(r.agent_id); });",
  "new": "    const {data,error}=await sb.from(\"bridge_agent_index\").select(\"agent_id,has_subworkflow,expected_frequency_hours,last_summary\");\n    if(error){ console.warn(\"bridge_agent_index has_subworkflow:\",error.message); return; }\n    SUBWF.clear();\n    (data||[]).forEach(r=>{ if(r.has_subworkflow) SUBWF.add(r.agent_id);\n      EXPH[r.agent_id]=r.expected_frequency_hours; LASTSUM[r.agent_id]=r.last_summary||\"\"; });",
  "files": [
   "organisation.html",
   "constellation.html"
  ],
  "regex": false
 },
 {
  "name": "lane-count",
  "old": "\\n\\s*<span class=\"lane-count\"[^>]*>\\$\\{d\\.agents\\.length\\}</span>",
  "new": "",
  "files": [
   "organisation.html",
   "constellation.html"
  ],
  "regex": true
 },
 {
  "name": "footer",
  "old": "klik een agent voor de <b>laatste 10 executies</b> ·",
  "new": "klik een agent voor de <b>laatste 10 executies</b> · klik <b>VEROUDERD</b> of <b>ERRORS</b> in de kop om te filteren ·",
  "files": [
   "organisation.html",
   "constellation.html"
  ],
  "regex": false
 }
];
const files = ["organisation.html","constellation.html"];
const out = {}; let ok = true;
for (const f of files) {
  if (!fs.existsSync(f)) { console.error("ontbreekt:", f); ok = false; continue; }
  let src = fs.readFileSync(f, "utf8"); const orig = src;
  for (const p of PATCHES) {
    if (!p.files.includes(f)) continue;
    let n;
    if (p.regex) { const re = new RegExp(p.old, "g"); n = (src.match(re) || []).length; if (n === 1) src = src.replace(re, p.new); }
    else { n = src.split(p.old).length - 1; if (n === 1) src = src.replace(p.old, () => p.new); }
    if (n !== 1) { console.error(`${f}: anker "${p.name}" komt ${n}x voor (verwacht 1)`); ok = false; }
  }
  if (src === orig) { console.error(`${f}: ongewijzigd`); ok = false; }
  out[f] = src;
}
if (!ok) { console.error("\nGEEN bestand geschreven."); process.exit(1); }
for (const f of files) { fs.writeFileSync(f, out[f]); console.log("geschreven:", f, out[f].length, "bytes"); }
console.log("\nKlaar. Controleer: git diff --stat, dan committen en pushen.");
