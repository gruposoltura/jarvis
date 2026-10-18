/* NEXUS · XML — beheer van XML-feeds.
   Export = onze eigen woningen als Kyero-feed per partnermakelaar (core.partner_export_feeds, edge function partner-feed).
   Import = Kyero-feeds van partnermakelaars die elke nacht om 01:15 binnenkomen (core.partner_feeds, edge function
   partner-feed-import, n8n JARVIS-Infra-PartnerFeedImport-v2).
   Lezen: hele team. Aanmaken, wijzigen, aan/uit en de proefrun: alleen beheerder (gecontroleerd in de database). */
(function(){
"use strict";
window.NEXUS_I18N=window.NEXUS_I18N||{nl:{},en:{}};
Object.assign(window.NEXUS_I18N.nl,{"tab.xm":"XML"});
Object.assign(window.NEXUS_I18N.en,{"tab.xm":"XML"});

let X=null, ROOT=null, D=null, KIND="export", SEL=null, Q="", EDIT=null, PREV=null, LOG=null, BUSY=false, LOCS=null;
const tr=v=>Array.isArray(v)?(X&&X.lang()==="en"?v[1]:v[0]):v;
const esc=v=>v==null?"":String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const LOC=()=>X&&X.lang()==="en"?"en-GB":"nl-NL";
const VARIANTS=[["gruposoltura",["Alle eigen woningen in aanbod","All own listings for sale"]],["resales",["Alleen bestaande bouw","Resales only"]],
  ["newdevelopments",["Alleen nieuwbouw","New builds only"]],["idealista",["Idealista (intern, JARVIS)","Idealista (internal, JARVIS)"]]];
const BUILD=[["",["Alles","Everything"]],["RESALES",["Alleen bestaande bouw","Resales only"]],["NEWDEV",["Alleen nieuwbouw","New builds only"]]];
const TOWN_ST={accepted:["Komt binnen","Imported","#22c55e"],excluded:["Uitgesloten","Excluded","#f87171"],not_whitelisted:["Niet op 'alleen deze plaatsen'","Not in 'only these places'","#f59e0b"],
  build:["Bouwfilter","Build filter","#64748b"],ref:["Ref-uitsluiting","Ref exclusion","#64748b"]};

function when(ts){if(!ts)return tr(["nooit","never"]);const d=new Date(ts), s=(Date.now()-d)/1000;
  const abs=d.toLocaleString(LOC(),{day:"numeric",month:"short",year:d.getFullYear()!==new Date().getFullYear()?"numeric":undefined,hour:"2-digit",minute:"2-digit"});
  if(s<60)return tr(["zojuist","just now"]);if(s<3600)return tr([`${Math.round(s/60)} min geleden`,`${Math.round(s/60)} min ago`]);
  if(s<86400)return tr([`${Math.round(s/3600)} uur geleden`,`${Math.round(s/3600)} h ago`])+` · ${d.toLocaleTimeString(LOC(),{hour:"2-digit",minute:"2-digit"})}`;
  if(s<86400*30)return tr([`${Math.round(s/86400)} dagen geleden`,`${Math.round(s/86400)} days ago`])+` · ${abs}`;return abs}
function dt(ts){if(!ts)return tr(["nooit","never"]);const d=new Date(ts);
  return d.toLocaleString(LOC(),{day:"numeric",month:"short",year:d.getFullYear()!==new Date().getFullYear()?"numeric":undefined,hour:"2-digit",minute:"2-digit"})}
function stale(ts,days){return !ts||(Date.now()-new Date(ts))/86400000>days}
function n(v){return v==null?"—":Number(v).toLocaleString(LOC())}
async function copy(text,btn){try{await navigator.clipboard.writeText(text)}catch(e){const t=document.createElement("textarea");t.value=text;document.body.appendChild(t);t.select();try{document.execCommand("copy")}catch(_){}t.remove()}
  if(btn){const o=btn.innerHTML;btn.innerHTML="✓ "+esc(tr(["Gekopieerd","Copied"]));btn.classList.add("ok");setTimeout(()=>{btn.innerHTML=o;btn.classList.remove("ok")},1600)}}
function toast(msg,bad){const t=document.createElement("div");t.className="pe-toast";if(bad)t.style.background="#dc2626";t.textContent=(bad?"⚠ ":"✓ ")+msg;document.body.appendChild(t);setTimeout(()=>t.remove(),bad?4500:2200)}
const canEdit=()=>!!(D&&D.can_edit);
const list=()=>D?(KIND==="export"?D.exports:D.imports):[];
const cur=()=>list().find(f=>f.id===SEL)||null;

async function load(keep){
  if(!keep){ROOT.innerHTML=`<div class="loader">${esc(tr(["XML-feeds laden…","Loading XML feeds…"]))}</div>`}
  try{D=await X.rpc("nexus_feeds")}catch(e){ROOT.innerHTML=`<div class="empty">${esc(e.message)}</div>`;return}
  if(SEL&&!list().some(f=>f.id===SEL)&&EDIT&&!EDIT.isNew)SEL=null;
  render();
}
function open(root,ctx){X=ctx;ROOT=root;if(!ROOT.dataset.init){ROOT.dataset.init="1";bind();load()}else if(D)render()}

/* ================= RENDER ================= */
function render(){
  const L=list().filter(f=>!Q||[f.name,f.code,f.agency_name,f.ref_prefix,f.token].join(" ").toLowerCase().includes(Q.toLowerCase()));
  const nOn=k=>(k==="export"?D.exports:D.imports).filter(f=>f.active).length;
  ROOT.innerHTML=`<div class="xm">
   <div class="card list xm-list">
     <div class="toolbar">
       <div class="seg" id="xmKind">
         <button data-k="export" class="${KIND==="export"?"on":""}">${esc(tr(["Export","Export"]))} <b>${nOn("export")}/${D.exports.length}</b></button>
         <button data-k="import" class="${KIND==="import"?"on":""}">${esc(tr(["Import","Import"]))} <b>${nOn("import")}/${D.imports.length}</b></button>
       </div>
       ${canEdit()?`<button class="btn sm xm-new" data-new="1">+ ${esc(KIND==="export"?tr(["Nieuwe exportfeed","New export feed"]):tr(["Nieuwe importfeed","New import feed"]))}</button>`:""}
     </div>
     <div class="toolbar" style="padding-top:8px"><input type="search" id="xmQ" value="${esc(Q)}" placeholder="${esc(tr(["Zoek op naam, makelaar, prefix…","Search name, agent, prefix…"]))}"></div>
     <div class="xm-explain sm muted">${esc(KIND==="export"
        ?tr(["Feeds met ónze woningen die partnermakelaars ophalen. Eén link per makelaar.","Feeds with our listings that partner agents fetch. One link per agent."])
        :tr(["Feeds van partnermakelaars die elke nacht om 01:15 worden ingelezen.","Partner agents' feeds imported every night at 01:15."]))}</div>
     <div class="rows scroll">${L.length?L.map(KIND==="export"?rowExp:rowImp).join(""):`<div class="empty">${esc(tr(["Geen feeds","No feeds"]))}</div>`}</div>
   </div>
   <div class="card detail xm-detail">${EDIT?editor():SEL&&cur()?detail(cur()):`<div class="empty">${esc(tr(["Kies links een feed","Pick a feed on the left"]))}</div>`}</div>
  </div>`;
  afterRender();
}
function sw(f){return `<label class="xm-sw ${canEdit()?"":"ro"}" title="${esc(f.active?tr(["Actief — klik om uit te zetten","Active — click to switch off"]):tr(["Inactief — klik om aan te zetten","Inactive — click to switch on"]))}"><input type="checkbox" data-tg="${f.id}" ${f.active?"checked":""} ${canEdit()?"":"disabled"}><i></i></label>`}
function rowExp(f){const old=f.active&&stale(f.last_accessed_at,14);
  return `<div class="row xm-row ${SEL===f.id?"on":""} ${f.active?"":"off"}" data-sel="${f.id}">
   ${sw(f)}
   <div style="min-width:0"><div class="nm">${esc(f.name)}</div>
     <div class="sub sm">${f.agency_name?`<span class="xm-ag">${esc(f.agency_name)}</span>`:`<span class="xm-warn">${esc(tr(["geen makelaar gekoppeld","no agent linked"]))}</span>`}</div>
     <div class="sub sm xm-meta"><span class="${old?"xm-warn":""}" title="${esc(tr(["Laatst opgehaald door de makelaar","Last fetched by the agent"]))}">⟳ ${esc(dt(f.last_accessed_at))}</span>${f.last_item_count!=null?` · ${n(f.last_item_count)} ${esc(tr(["woningen","listings"]))}`:""}</div></div>
   <button class="btn sm xm-copy" data-copy="${esc(f.url)}" title="${esc(f.url)}">⧉ URL</button></div>`}
function rowImp(f){const err=f.last_error, rp=(f.last_run&&f.last_run.report)||{};const old=f.active&&stale(f.last_run_at,2);
  const cnt=rp.accepted!=null?rp.accepted:f.last_item_count;
  return `<div class="row xm-row ${SEL===f.id?"on":""} ${f.active?"":"off"}" data-sel="${f.id}">
   ${sw(f)}
   <div style="min-width:0"><div class="nm">${esc(f.code)} <span class="xm-pfx">${esc(f.ref_prefix)}</span></div>
     <div class="sub sm">${f.agency_name?`<span class="xm-ag">${esc(f.agency_name)}</span>`:`<span class="xm-warn">${esc(tr(["geen makelaar","no agent"]))}</span>`}</div>
     <div class="sub sm xm-meta"><span class="${err?"xm-bad":old?"xm-warn":""}" title="${esc(tr(["Laatste run","Last run"]))}">${err?"⚠":"⟳"} ${esc(dt(f.last_run_at))}</span>
       · <b class="${cnt===0&&f.active?"xm-warn":""}" title="${esc(tr(["Woningen in de laatste run (na filters)","Listings in last run (after filters)"]))}">${n(cnt)} ${esc(tr(["woningen","listings"]))}</b>${rp.in_feed!=null&&rp.in_feed!==cnt?` <span class="muted">${esc(tr([`van ${n(rp.in_feed)}`,`of ${n(rp.in_feed)}`]))}</span>`:""}</div></div>
   <button class="btn sm xm-copy" data-copy="${esc(f.url)}" title="${esc(f.url)}">⧉ URL</button></div>`}

function kv(k,v){return `<div class="xm-kv"><span>${esc(k)}</span><b>${v}</b></div>`}
function urlBox(label,url,hint){return `<div class="xm-url"><div class="sm muted">${esc(label)}</div><div class="xm-urlrow"><code>${esc(url)}</code><button class="btn sm" data-copy="${esc(url)}">⧉ ${esc(tr(["Kopieer","Copy"]))}</button><a class="btn sm" href="${esc(url)}" target="_blank" rel="noopener">↗</a></div>${hint?`<small class="muted">${esc(hint)}</small>`:""}</div>`}

function detail(f){return KIND==="export"?detailExp(f):detailImp(f)}
function head(title,sub,f){return `<div class="xm-head"><div style="min-width:0"><h2>${esc(title)}</h2><div class="sm muted">${sub}</div></div>
  <div class="xm-acts">${sw(f)}${canEdit()?`<button class="btn sm" data-edit="1">✎ ${esc(tr(["Wijzigen","Edit"]))}</button>`:""}</div></div>`}
function agentLink(f){return f.agency_contact_id?`<a data-c="${f.agency_contact_id}" class="xm-link">${esc(f.agency_name||"?")}</a>`:`<span class="xm-warn">${esc(tr(["geen makelaar gekoppeld","no agent linked"]))}</span>`}

function detailExp(f){
  const v=(VARIANTS.find(x=>x[0]===f.variant)||[f.variant,f.variant])[1];
  return `<div class="xm-scroll">${head(f.name,`${agentLink(f)} · ${esc(tr(v))}`,f)}
   ${!f.active?`<div class="xm-note">${esc(tr(["Deze feed staat uit: de makelaar krijgt nu 'not found'.","This feed is off: the agent now gets 'not found'."]))}</div>`:""}
   ${urlBox(tr(["Link voor de makelaar","Link for the agent"]),f.url,tr(["Dit is dezelfde link als in de oude CPR; bestaande makelaars hoeven niets te wijzigen.","Same link as in the old CPR; existing agents need not change anything."]))}
   <div class="xm-grid">
     ${kv(tr(["Laatst opgehaald","Last fetched"]),esc(when(f.last_accessed_at))+(f.last_accessed_legacy?` <span class="muted sm">(CPR)</span>`:""))}
     ${kv(tr(["Aanroepen sinds overstap","Calls since cutover"]),n(f.access_count))}
     ${kv(tr(["Aanroepen laatste 7 dagen","Calls last 7 days"]),n(f.hits_7d))}
     ${kv(tr(["Woningen in laatste levering","Listings in last delivery"]),n(f.last_item_count))}
   </div>
   ${f.last_user_agent?`<div class="sm muted" style="margin:-4px 0 12px">${esc(tr(["Laatste ophaler","Last fetcher"]))}: <code>${esc(f.last_user_agent)}</code></div>`:""}
   ${f.notes?`<div class="xm-notes">${esc(f.notes)}</div>`:""}
   <div class="xm-sub"><h3>${esc(tr(["Aanroeplog","Call log"]))}</h3><span class="sm muted">${esc(tr(["laatste 50 · 90 dagen bewaard","last 50 · kept 90 days"]))}</span></div>
   <div id="xmLog">${logTable()}</div></div>`}

function detailImp(f){
  const b=(BUILD.find(x=>x[0]===(f.build_filter||""))||BUILD[0])[1];
  const resp=(D.team.find(t=>t.id===f.responsible_id)||{}).name;
  const chips=(arr,cls)=>arr.length?`<div class="xm-chips">${arr.map(c=>`<span class="chip ${cls}">${esc(c)}</span>`).join("")}</div>`:`<span class="muted">—</span>`;
  return `<div class="xm-scroll">${head(f.code,`${agentLink(f)} · ${esc(tr(["prefix","prefix"]))} <b>${esc(f.ref_prefix)}</b> · ${esc(tr(["volgende ref","next ref"]))} <b>${esc(f.ref_prefix+f.next_ref_number)}</b>`,f)}
   ${!f.active?`<div class="xm-note">${esc(tr(["Deze feed staat uit en wordt 's nachts overgeslagen. Woningen die al binnen zijn blijven staan.","This feed is off and skipped at night. Listings already imported stay."]))}</div>`:""}
   ${f.last_error?`<div class="xm-note bad">⚠ ${esc(tr(["Laatste fout","Last error"]))} (${esc(when(f.last_error_at))}): ${esc(f.last_error)}</div>`:""}
   ${urlBox(tr(["Feed-URL van de makelaar","Agent's feed URL"]),f.url)}
   <div class="xm-grid">
     ${kv(tr(["Laatst ingelezen","Last imported"]),esc(when(f.last_run_at)))}
     ${kv(tr(["Woningen in feed (na filters)","Listings in feed (after filters)"]),n(f.last_item_count))}
     ${kv(tr(["In aanbod in NEXUS","Live in NEXUS"]),n(f.live_count))}
     ${kv(tr(["Totaal ooit ingelezen","Total ever imported"]),n(f.total_count))}
   </div>
   <div class="xm-rules">
     <div><span>${esc(tr(["Bouwfilter","Build filter"]))}</span><b>${esc(tr(b))}</b></div>
     <div><span>${esc(tr(["Alleen deze plaatsen","Only these places"]))}</span>${chips(f.city_whitelist,"in")}</div>
     <div><span>${esc(tr(["Uitgesloten plaatsen","Excluded places"]))}</span>${chips(f.city_blacklist,"ex")}</div>
     <div><span>${esc(tr(["Refs overslaan die beginnen met","Skip refs starting with"]))}</span><b>${esc(f.ref_exclude_prefix||"—")}</b></div>
     <div><span>${esc(tr(["Verantwoordelijke","Responsible"]))}</span><b>${esc(resp||"—")}</b></div>
     <div><span>${esc(tr(["Intrekken alleen als feed ≥","Withdraw only if feed ≥"]))}</span><b>${Math.round(Number(f.withdraw_min_ratio)*100)}% ${esc(tr(["van vorige run","of previous run"]))}</b></div>
   </div>
   ${f.notes?`<div class="xm-notes">${esc(f.notes)}</div>`:""}
   ${canEdit()?`<div class="xm-testbar"><button class="btn sm" data-test="saved">▶ ${esc(tr(["Proefrun (niets opslaan)","Test run (saves nothing)"]))}</button><span class="sm muted">${esc(tr(["Haalt de feed nu op en laat zien wat er met de huidige regels binnen zou komen, per plaats.","Fetches the feed now and shows what the current rules would import, per place."]))}</span></div>`:""}
   <div id="xmPrev">${prevBox(false)}</div>
   <div class="xm-sub"><h3>${esc(tr(["Runlog","Run log"]))}</h3><span class="sm muted">${esc(tr(["laatste 30 · 180 dagen bewaard","last 30 · kept 180 days"]))}</span></div>
   <div id="xmLog">${logTable()}</div></div>`}

function logTable(){
  if(LOG==null)return `<div class="loader">${esc(tr(["Laden…","Loading…"]))}</div>`;
  if(!LOG.length)return `<div class="empty sm">${esc(KIND==="export"?tr(["Nog geen aanroepen gelogd (log loopt sinds 18-10-2026).","No calls logged yet (log runs since 18 Oct 2026)."]):tr(["Nog geen runs gelogd (log loopt sinds 18-10-2026).","No runs logged yet (log runs since 18 Oct 2026)."]))}</div>`;
  if(KIND==="export")return `<div class="scroll"><table class="mtable"><thead><tr><th>${esc(tr(["Moment","When"]))}</th><th>${esc(tr(["Status","Status"]))}</th><th style="text-align:right">${esc(tr(["Woningen","Listings"]))}</th><th>${esc(tr(["Ophaler","Fetcher"]))}</th></tr></thead><tbody>
    ${LOG.map(h=>`<tr><td>${esc(new Date(h.at).toLocaleString(LOC(),{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}))}</td><td>${h.status===200?`<span class="xm-ok">OK</span>`:`<span class="xm-bad">${h.status===404?esc(tr(["geweigerd (uit)","refused (off)"])):h.status}</span>`}</td><td style="text-align:right">${n(h.item_count)}</td><td class="muted xm-ua" title="${esc(h.user_agent||"")}">${esc(h.user_agent||"—")}</td></tr>`).join("")}</tbody></table></div>`;
  return `<div class="scroll"><table class="mtable"><thead><tr><th>${esc(tr(["Moment","When"]))}</th><th>${esc(tr(["Soort","Kind"]))}</th><th style="text-align:right">${esc(tr(["Nieuw","New"]))}</th><th style="text-align:right">${esc(tr(["Bijgewerkt","Updated"]))}</th><th style="text-align:right">${esc(tr(["Ingetrokken","Withdrawn"]))}</th><th style="text-align:right">${esc(tr(["Uitgesloten","Excluded"]))}</th><th>${esc(tr(["Resultaat","Result"]))}</th></tr></thead><tbody>
    ${LOG.map(r=>{const p=r.report||{};const kind=r.source==="nexus"?tr(["proefrun","test run"]):r.dry_run?tr(["proef (n8n)","dry (n8n)"]):tr(["nacht","nightly"]);
      return `<tr><td>${esc(new Date(r.at).toLocaleString(LOC(),{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}))}</td><td class="muted">${esc(kind)}</td>
      <td style="text-align:right">${n(p.inserted??p.new)}</td><td style="text-align:right">${n(p.updated??p.existing)}</td><td style="text-align:right">${n(p.withdrawn??p.would_withdraw)}</td>
      <td style="text-align:right">${n((p.skipped_excluded||0)+(p.skipped_city||0))}</td>
      <td>${r.ok?(p.withdraw_guard?`<span class="xm-warn" title="${esc(p.withdraw_guard)}">${esc(tr(["OK · intrekbeveiliging","OK · withdraw guard"]))}</span>`:`<span class="xm-ok">OK</span>`):`<span class="xm-bad" title="${esc(r.error||"")}">⚠ ${esc((r.error||"").slice(0,60))}</span>`}</td></tr>`}).join("")}</tbody></table></div>`;
}

function prevBox(inEditor){
  if(!PREV)return "";
  if(PREV.loading)return `<div class="loader">${esc(tr(["Feed ophalen en doorrekenen…","Fetching and evaluating feed…"]))}</div>`;
  if(PREV.error)return `<div class="xm-note bad">⚠ ${esc(PREV.error)}</div>`;
  const r=PREV.report;
  const bl=new Set(((inEditor?EDIT.city_blacklist:(cur()||{}).city_blacklist)||[]).map(normT));
  return `<div class="xm-prev">
    <div class="xm-grid">
      ${kv(tr(["In de feed","In feed"]),n(r.in_feed))}
      ${kv(tr(["Komt binnen","Would import"]),`<span class="xm-ok">${n(r.accepted)}</span> <span class="sm muted">(${n(r.new)} ${esc(tr(["nieuw","new"]))})</span>`)}
      ${kv(tr(["Uitgesloten op plaats","Excluded by place"]),n(r.skipped_excluded))}
      ${kv(tr(["Niet op 'alleen deze plaatsen'","Not in 'only these places'"]),n(r.skipped_city))}
      ${kv(tr(["Bouwfilter / ref","Build filter / ref"]),n(r.skipped_build_type)+" / "+n(r.skipped_ref))}
      ${kv(tr(["Zou worden ingetrokken","Would be withdrawn"]),r.withdraw_guard?`<span class="xm-warn" title="${esc(r.withdraw_guard)}">0 (${esc(tr(["beveiliging","guard"]))})</span>`:n(r.would_withdraw))}
    </div>
    <div class="xm-sub"><h3>${esc(tr(["Plaatsen in de feed","Places in the feed"]))}</h3><span class="sm muted">${esc(canEdit()?tr(["klik om uit te sluiten of weer toe te laten","click to exclude or allow again"]):"")}</span></div>
    <div class="xm-towns">${(r.towns||[]).map(t=>{const st=TOWN_ST[t.status]||[t.status,t.status,"#64748b"];const isEx=bl.has(normT(t.name));
      return `<button class="xm-town ${isEx?"ex":""}" ${canEdit()?`data-town="${esc(t.name)}"`:"disabled"} style="--tc:${st[2]}" title="${esc(tr([st[0],st[1]]))}"><i></i>${esc(t.name)} <b>${n(t.n)}</b>${canEdit()?`<span>${isEx?"↺":"✕"}</span>`:""}</button>`}).join("")}</div>
    ${PREV.dirty?`<div class="xm-note">${esc(tr(["Je hebt plaatsen aangepast. Draai de proefrun opnieuw om het effect te zien, en klik daarna op Opslaan.","You changed places. Run the test again to see the effect, then click Save."]))}</div>`:""}
  </div>`;
}
const normT=s=>String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

/* ================= EDITOR ================= */
function startEdit(isNew){
  const f=isNew?null:cur();
  if(KIND==="export")EDIT={isNew,id:f?f.id:"",name:f?f.name:"",agency_contact_id:f?f.agency_contact_id:"",agency_name:f?f.agency_name:"",variant:f?f.variant:"gruposoltura",active:f?f.active:true,notes:f?f.notes||"":""};
  else EDIT={isNew,id:f?f.id:"",code:f?f.code:"",url:f?f.url:"",agency_contact_id:f?f.agency_contact_id:"",agency_name:f?f.agency_name:"",ref_prefix:f?f.ref_prefix:"",
    next_ref_number:f?f.next_ref_number:null,build_filter:f?f.build_filter||"":"RESALES",city_whitelist:f?[...f.city_whitelist]:[],city_blacklist:f?[...f.city_blacklist]:[],
    ref_exclude_prefix:f?f.ref_exclude_prefix||"":"",responsible_id:f?f.responsible_id||"":"",withdraw_min_ratio:f?Number(f.withdraw_min_ratio):0.7,active:f?f.active:true,notes:f?f.notes||"":""};
  if(isNew)PREV=null;
  render();
  if(!LOCS)X.rpc("nexus_locations").then(r=>{LOCS=r||[];const dl=ROOT.querySelector("#xmLocs");if(dl)dl.innerHTML=locOpts()}).catch(()=>{LOCS=[]});
}
function locOpts(){return (LOCS||[]).map(l=>`<option value="${esc(l.name)}">`).join("")}
function fld(k,label,o={}){const v=EDIT[k]??"";return `<label class="ad-f ${o.w?"w"+o.w:""}"><span>${esc(tr(label))}${o.req?'<b class="ad-req">*</b>':""}</span>
  <input data-f="${k}" value="${esc(v)}" ${o.ph?`placeholder="${esc(tr(o.ph))}"`:""} ${o.type?`type="${o.type}"`:""} ${o.attrs||""}>${o.hint?`<small>${esc(tr(o.hint))}</small>`:""}</label>`}
function selF(k,label,opts,o={}){return `<label class="ad-f ${o.w?"w"+o.w:""}"><span>${esc(tr(label))}</span><select data-f="${k}">${opts.map(x=>`<option value="${esc(x[0])}" ${String(EDIT[k]??"")===String(x[0])?"selected":""}>${esc(tr(x[1]))}</option>`).join("")}</select>${o.hint?`<small>${esc(tr(o.hint))}</small>`:""}</label>`}
function tags(k,label,hint,cls){return `<div class="ad-f w4"><span>${esc(tr(label))}</span>
  <div class="xm-tags" data-tags="${k}">${EDIT[k].map((c,i)=>`<span class="chip ${cls}">${esc(c)}<button type="button" data-rm="${k}" data-i="${i}" aria-label="x">×</button></span>`).join("")}
  <input list="xmLocs" data-add="${k}" placeholder="${esc(tr(["plaats typen + Enter","type a place + Enter"]))}"></div><small>${esc(tr(hint))}</small></div>`}
function agentPicker(){return `<div class="ad-f w4"><span>${esc(tr(["Makelaar (contact met label Agent)","Agent (contact labelled Agent)"]))}<b class="ad-req">*</b></span>
  ${EDIT.agency_contact_id?`<div class="xm-picked"><span class="role" style="--rc:var(--r-agent)">Agent</span> <b>${esc(EDIT.agency_name||"?")}</b><button type="button" class="btn sm" data-unpick="1">${esc(tr(["Wijzig","Change"]))}</button></div>`
   :`<input class="ad-search" id="xmAg" placeholder="${esc(tr(["Zoek makelaar op naam of bedrijf…","Search agent by name or company…"]))}" autocomplete="off"><div class="ad-res" id="xmAgRes"></div>
     <small>${esc(tr(["Staat de makelaar er niet tussen? Maak hem eerst aan als contact met het label Agent (Admin → Nieuw contact).","Agent not listed? First create the contact with label Agent (Admin → New contact)."]))}</small>`}</div>`}

function editor(){
  const E=EDIT, ttl=E.isNew?(KIND==="export"?tr(["Nieuwe exportfeed","New export feed"]):tr(["Nieuwe importfeed","New import feed"])):(KIND==="export"?E.name:E.code);
  const body=KIND==="export"?`
    <div class="ad-row">${fld("name",["Naam van de feed","Feed name"],{w:2,ph:["bijv. Casagator","e.g. Casagator"],hint:["Leeg = naam van de makelaar","Empty = agent's name"]})}
      ${selF("variant",["Inhoud","Content"],VARIANTS,{w:2,hint:["Alleen woningen met status In aanbod gaan mee (niet onder bod).","Only listings that are for sale are included (not under offer)."]})}</div>
    <div class="ad-row">${agentPicker()}</div>
    ${E.isNew?`<div class="xm-note">${esc(tr(["Na opslaan krijgt de feed een eigen geheime link die je kunt kopiëren en naar de makelaar sturen.","After saving the feed gets its own secret link to copy and send to the agent."]))}</div>`:urlBox(tr(["Link voor de makelaar","Link for the agent"]),cur().url)}`
  :`
    <div class="ad-row">${fld("code",["Code","Code"],{req:1,ph:["bijv. REDSP","e.g. REDSP"],hint:["Korte naam, hoofdletters","Short name, capitals"]})}
      ${fld("url",["Feed-URL (Kyero XML)","Feed URL (Kyero XML)"],{w:3,req:1,ph:["https://…","https://…"]})}</div>
    <div class="ad-row">${agentPicker()}</div>
    <div class="ad-row">${fld("ref_prefix",["Referentieprefix","Reference prefix"],{req:1,ph:["bijv. RSP","e.g. RSP"],attrs:'maxlength="5" style="text-transform:uppercase"',hint:["2–5 letters; nieuwe woningen krijgen prefix + volgnummer","2–5 letters; new listings get prefix + number"]})}
      <div class="ad-f"><span>${esc(tr(["Volgende referentie","Next reference"]))}</span><div class="xm-ro">${E.next_ref_number?esc((E.ref_prefix||"").toUpperCase()+E.next_ref_number):`<span class="muted">${esc(tr(["na opslaan","after saving"]))}</span>`}</div><small>${esc(tr(["Automatisch; gaat nooit omlaag","Automatic; never goes down"]))}</small></div>
      ${selF("build_filter",["Bouwfilter","Build filter"],BUILD)}
      ${selF("responsible_id",["Verantwoordelijke","Responsible"],[["",["—","—"]]].concat(D.team.map(t=>[t.id,[t.name,t.name]])))}</div>
    <div class="ad-row">${tags("city_blacklist",["Uitgesloten plaatsen","Excluded places"],["Woningen in deze plaatsen (of wijken) worden niet ingelezen. Tip: draai de proefrun en klik op een plaats.","Listings in these towns (or areas) are not imported. Tip: run the test and click a place."],"ex")}</div>
    <div class="ad-row">${tags("city_whitelist",["Alleen deze plaatsen (optioneel)","Only these places (optional)"],["Leeg = alle plaatsen. Gevuld = alleen woningen uit deze plaatsen.","Empty = all places. Filled = only listings from these places."],"in")}</div>
    <div class="ad-row">${fld("ref_exclude_prefix",["Refs overslaan die beginnen met","Skip refs starting with"],{ph:["optioneel","optional"]})}
      ${fld("withdraw_min_ratio",["Intrekbeveiliging (0–1)","Withdraw guard (0–1)"],{type:"number",attrs:'step="0.05" min="0" max="1"',hint:["Bij 0,7 wordt niets ingetrokken als de feed ineens minder dan 70% levert","At 0.7 nothing is withdrawn if the feed suddenly delivers <70%"]})}</div>
    <datalist id="xmLocs">${locOpts()}</datalist>
    <div class="xm-testbar"><button class="btn sm" type="button" data-test="edit">▶ ${esc(tr(["Proefrun met deze instellingen","Test run with these settings"]))}</button><span class="sm muted">${esc(tr(["Er wordt niets opgeslagen.","Nothing is saved."]))}</span></div>
    <div id="xmPrev">${prevBox(true)}</div>`;
  return `<div class="xm-scroll"><div class="xm-head"><div><h2>${esc(ttl)}</h2><div class="sm muted">${esc(KIND==="export"?tr(["Exportfeed","Export feed"]):tr(["Importfeed","Import feed"]))}</div></div>
     <div class="xm-acts"><label class="ad-c"><input type="checkbox" data-f="active" data-bool ${E.active?"checked":""}><span>${esc(tr(["Actief","Active"]))}</span></label></div></div>
    ${body}
    <div class="ad-row"><label class="ad-f w4"><span>${esc(tr(["Notities (intern)","Notes (internal)"]))}</span><textarea data-f="notes" rows="2">${esc(E.notes)}</textarea></label></div>
    <div class="xm-err" id="xmErr"></div></div>
   <div class="ad-foot"><button class="btn sm" data-cancel="1">${esc(tr(["Annuleren","Cancel"]))}</button><button class="btn sm ad-next" data-save="1" ${BUSY?"disabled":""}>${esc(BUSY?tr(["Opslaan…","Saving…"]):tr(["Opslaan","Save"]))}</button></div>`;
}

/* ================= ACTIES ================= */
async function loadLog(){
  const f=cur();if(!f||EDIT)return;LOG=null;const box=ROOT.querySelector("#xmLog");if(box)box.innerHTML=logTable();
  const id=f.id;
  try{LOG=KIND==="export"?await X.rpc("nexus_feed_export_hits",{p_id:id,p_limit:50}):await X.rpc("nexus_feed_import_runs",{p_id:id,p_limit:30})}catch(e){LOG=[]}
  if(SEL!==id)return;const b2=ROOT.querySelector("#xmLog");if(b2)b2.innerHTML=logTable();
}
async function runTest(fromEditor){
  const f=cur();const code=fromEditor?(EDIT.code||"").toUpperCase():f&&f.code;
  const url=fromEditor?EDIT.url:f&&f.url;
  if(!url){toast(tr(["Vul eerst de feed-URL in","Enter the feed URL first"]),true);return}
  PREV={loading:true};paintPrev(fromEditor);
  const body={feed:code||"__nieuw__",preview:true};
  if(fromEditor)body.rules={url:EDIT.url,build_filter:EDIT.build_filter||null,city_whitelist:EDIT.city_whitelist,city_blacklist:EDIT.city_blacklist,ref_exclude_prefix:EDIT.ref_exclude_prefix||null};
  try{const {data,error}=await X.sb.functions.invoke("partner-feed-import",{body});
    if(error){let msg=error.message;try{const j=await error.context.json();msg=j.error||msg}catch(_){}throw new Error(msg)}
    if(!data||!data.ok)throw new Error((data&&data.error)||"?");
    PREV={report:data.report}}catch(e){PREV={error:e.message}}
  paintPrev(fromEditor);if(!fromEditor)loadLog();
}
function paintPrev(inEditor){const b=ROOT.querySelector("#xmPrev");if(b)b.innerHTML=prevBox(inEditor)}
function toggleTown(name){
  if(EDIT){const arr=EDIT.city_blacklist, i=arr.findIndex(x=>normT(x)===normT(name));if(i>=0)arr.splice(i,1);else arr.push(name);
    if(PREV)PREV.dirty=true;const s=ROOT.querySelector(".xm-scroll"),y=s?s.scrollTop:0;render();const s2=ROOT.querySelector(".xm-scroll");if(s2)s2.scrollTop=y;return}
  /* vanuit het detailscherm: direct naar de editor met de wijziging */
  startEdit(false);toggleTown(name);
}
async function save(){
  if(BUSY)return;const E=EDIT, err=ROOT.querySelector("#xmErr");
  const p=KIND==="export"?{id:E.id||null,name:E.name,agency_contact_id:E.agency_contact_id||null,variant:E.variant,active:E.active,notes:E.notes}
    :{id:E.id||null,code:E.code,url:E.url,agency_contact_id:E.agency_contact_id||null,ref_prefix:E.ref_prefix,build_filter:E.build_filter||null,
      city_whitelist:E.city_whitelist,city_blacklist:E.city_blacklist,ref_exclude_prefix:E.ref_exclude_prefix,responsible_id:E.responsible_id||null,
      withdraw_min_ratio:E.withdraw_min_ratio,active:E.active,notes:E.notes};
  BUSY=true;render();
  try{const r=await X.rpc(KIND==="export"?"nexus_feed_export_save":"nexus_feed_import_save",{p});
    BUSY=false;EDIT=null;PREV=null;SEL=r.id;await load(true);loadLog();
    toast(tr(["Opgeslagen","Saved"]));
    if(KIND==="export"&&!p.id&&r.url){copy(r.url);toast(tr(["Opgeslagen — link gekopieerd","Saved — link copied"]))}
  }catch(e){BUSY=false;render();const b=ROOT.querySelector("#xmErr");if(b)b.textContent=e.message.replace(/^NEXUS:\s*/,"")}
}
async function toggle(id,on,cb){
  const f=list().find(x=>x.id===id);if(!f)return;
  const q=KIND==="export"
    ?(on?tr([`Feed "${f.name}" aanzetten? De makelaar kan hem dan weer ophalen.`,`Switch on "${f.name}"? The agent can fetch it again.`]):tr([`Feed "${f.name}" uitzetten? De makelaar krijgt dan 'not found' en ziet onze woningen niet meer.`,`Switch off "${f.name}"? The agent will get 'not found' and no longer see our listings.`]))
    :(on?tr([`Import ${f.code} aanzetten? Hij draait vanaf vannacht 01:15 weer mee.`,`Switch on ${f.code}? It runs again from tonight 01:15.`]):tr([`Import ${f.code} uitzetten? Hij wordt 's nachts overgeslagen; woningen die al binnen zijn blijven staan.`,`Switch off ${f.code}? It is skipped at night; imported listings stay.`]));
  if(!confirm(q)){cb.checked=!on;return}
  try{await X.rpc("nexus_feed_toggle",{p_kind:KIND,p_id:id,p_active:on});f.active=on;toast(on?tr(["Aangezet","Switched on"]):tr(["Uitgezet","Switched off"]));render();if(SEL===id)loadLog()}
  catch(e){cb.checked=!on;toast(e.message.replace(/^NEXUS:\s*/,""),true)}
}

let agT;
function afterRender(){
  const q=ROOT.querySelector("#xmQ");if(q)q.oninput=e=>{Q=e.target.value;const p=q.selectionStart;render();const q2=ROOT.querySelector("#xmQ");q2.focus();q2.setSelectionRange(p,p)};
  const ag=ROOT.querySelector("#xmAg");
  if(ag)ag.oninput=()=>{clearTimeout(agT);agT=setTimeout(async()=>{const v=ag.value.trim();const box=ROOT.querySelector("#xmAgRes");if(!box)return;
    if(v.length<2){box.innerHTML="";return}
    let rows=[];try{rows=(await X.rpc("nexus_search",{p_q:v,p_role:"agent",p_scope:"all",p_limit:8,p_offset:0})).rows||[]}catch(e){}
    box.innerHTML=rows.length?rows.map(c=>`<button type="button" class="ad-hit" data-pick="${esc(c.id)}" data-nm="${esc(c.company||c.name||c.email)}"><div class="ini" style="background:var(--r-agent)">${esc((c.company||c.name||"?").slice(0,1).toUpperCase())}</div><div style="min-width:0"><b>${esc(c.company||c.name||c.email)}</b><div class="sm muted">${esc([c.company&&c.name!==c.company?c.name:"",c.email,c.city].filter(Boolean).join(" · "))}</div></div><span class="sm muted">${esc(tr(["kies","pick"]))}</span></button>`).join("")
      :`<div class="empty sm">${esc(tr(["Geen contact met label Agent gevonden","No contact labelled Agent found"]))}</div>`},250)};
  if(SEL&&!EDIT&&LOG==null)loadLog();
}
function bind(){
  ROOT.addEventListener("click",e=>{
    const t=e.target;let el;
    if((el=t.closest("[data-copy]"))){e.preventDefault();e.stopPropagation();copy(el.dataset.copy,el);return}
    if(t.closest(".xm-sw"))return;
    if((el=t.closest("#xmKind [data-k]"))){if(KIND!==el.dataset.k){KIND=el.dataset.k;SEL=null;EDIT=null;PREV=null;LOG=null;Q="";render()}return}
    if(t.closest("[data-new]")){SEL=null;LOG=null;startEdit(true);return}
    if(t.closest("[data-edit]")){startEdit(false);return}
    if(t.closest("[data-cancel]")){EDIT=null;PREV=null;render();return}
    if(t.closest("[data-save]")){save();return}
    if((el=t.closest("[data-test]"))){runTest(el.dataset.test==="edit");return}
    if((el=t.closest("[data-town]"))){toggleTown(el.dataset.town);return}
    if(t.closest("[data-unpick]")){EDIT.agency_contact_id="";EDIT.agency_name="";render();setTimeout(()=>{const a=ROOT.querySelector("#xmAg");if(a)a.focus()},0);return}
    if((el=t.closest("[data-pick]"))){EDIT.agency_contact_id=el.dataset.pick;EDIT.agency_name=el.dataset.nm;if(KIND==="export"&&!EDIT.name)EDIT.name=el.dataset.nm;render();return}
    if((el=t.closest("[data-rm]"))){EDIT[el.dataset.rm].splice(+el.dataset.i,1);if(PREV)PREV.dirty=true;render();return}
    if((el=t.closest("[data-sel]"))&&!t.closest("[data-c]")){if(EDIT&&!confirm(tr(["Wijzigingen niet opgeslagen. Toch wisselen?","Unsaved changes. Switch anyway?"])))return;
      EDIT=null;PREV=null;LOG=null;SEL=el.dataset.sel;render();return}
  });
  ROOT.addEventListener("change",e=>{const t=e.target;
    if(t.dataset.tg){toggle(t.dataset.tg,t.checked,t);return}
    if(EDIT&&t.dataset.f){EDIT[t.dataset.f]=t.dataset.bool!=null?t.checked:t.value;
      if(t.dataset.f==="ref_prefix"){EDIT.ref_prefix=t.value.toUpperCase();t.value=EDIT.ref_prefix}}
  });
  ROOT.addEventListener("input",e=>{const t=e.target;if(EDIT&&t.dataset.f&&t.dataset.bool==null)EDIT[t.dataset.f]=t.dataset.f==="ref_prefix"?t.value.toUpperCase():t.value});
  ROOT.addEventListener("keydown",e=>{const t=e.target;if(t.dataset&&t.dataset.add&&(e.key==="Enter"||e.key===",")){e.preventDefault();addTag(t)}});
  ROOT.addEventListener("focusout",e=>{const t=e.target;if(t.dataset&&t.dataset.add&&t.value.trim())addTag(t)});
}
function addTag(inp){const k=inp.dataset.add, v=inp.value.trim().replace(/,$/,"");if(!v)return;
  if(!EDIT[k].some(x=>normT(x)===normT(v)))EDIT[k].push(v);if(PREV)PREV.dirty=true;render();
  const n2=ROOT.querySelector(`[data-add="${k}"]`);if(n2)n2.focus()}

window.NEXUS_FEEDS={open,reload:()=>load(true),rerender:()=>{if(ROOT&&D)render()}};
})();
