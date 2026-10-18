/* NEXUS — app. Alleen-lezen (Admin-tab: invoerschermen, nog zonder opslaan); alle data via nexus_* RPC's (team-gate in de database). */
(function(){
"use strict";
const SB_URL="https://wuvpbwowdycsdlrqkaoq.supabase.co";
const SB_KEY="sb_publishable_4FzuR1v2uE0VAAH75XgHIQ_o2qEH6n3";
const sb=supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,storageKey:"nexus-auth"}});
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const esc=v=>v==null?"":String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* ================= TAAL ================= */
const DICT=window.NEXUS_I18N||{nl:{},en:{}};
let LANG=(()=>{try{return localStorage.getItem("nexus-lang")||""}catch(e){return""}})()||((navigator.language||"").toLowerCase().startsWith("nl")?"nl":"en");
if(!DICT[LANG])LANG="nl";
function t(k,vars){let s=(DICT[LANG]&&DICT[LANG][k])??DICT.nl[k]??k;if(vars)for(const v in vars)s=s.split("{"+v+"}").join(vars[v]);return s}
const LOC=()=>LANG==="en"?"en-GB":"nl-NL";
function applyStatic(){
  document.documentElement.lang=LANG;
  $$("[data-i18n]").forEach(el=>el.textContent=t(el.dataset.i18n));
  $$("[data-i18n-html]").forEach(el=>el.innerHTML=t(el.dataset.i18nHtml));
  $$("[data-i18n-ph]").forEach(el=>el.placeholder=t(el.dataset.i18nPh));
  $$("[data-lang-switch] button").forEach(b=>b.classList.toggle("on",b.dataset.l===LANG));
}
async function setLang(l,persist){
  if(!DICT[l]||l===LANG&&!persist)return;
  LANG=l;try{localStorage.setItem("nexus-lang",l)}catch(e){}
  applyStatic();
  if(booted){buildRoleChips();buildStatusChips();buildBuildSeg();if(mpMap)buildMpSeg();rerender();if(persist!==false)sb.rpc("nexus_set_lang",{p_lang:l}).then(()=>{},()=>{})}
}
$$("[data-lang-switch] button").forEach(b=>b.onclick=()=>setLang(b.dataset.l,true));
/* lettergrootte (per gebruiker, in deze browser) */
const FS=[0.9,1,1.1,1.2,1.3,1.45,1.6];
let fsIdx=(()=>{try{const v=parseFloat(localStorage.getItem("nexus-fs"));const i=FS.indexOf(v);return i<0?1:i}catch(e){return 1}})();
function applyFs(){document.documentElement.style.setProperty("--fs",FS[fsIdx]);try{localStorage.setItem("nexus-fs",String(FS[fsIdx]))}catch(e){}
  $$("[data-fs-switch]").forEach(w=>{w.title=t("fs.title")+" "+Math.round(FS[fsIdx]*100)+"%";w.querySelector('[data-fs="-"]').disabled=fsIdx===0;w.querySelector('[data-fs="+"]').disabled=fsIdx===FS.length-1});
  setTimeout(()=>{try{if(mpMap)mpMap.invalidateSize()}catch(e){}},50)}
$$("[data-fs-switch] button").forEach(b=>b.onclick=()=>{fsIdx=Math.max(0,Math.min(FS.length-1,fsIdx+(b.dataset.fs==="+"?1:-1)));applyFs()});
applyFs();
/* dag/nacht (per gebruiker, in deze browser) */
function applyTheme(th){const light=th==="light";if(light)document.documentElement.setAttribute("data-theme","light");else document.documentElement.removeAttribute("data-theme");
  try{localStorage.setItem("nexus-theme",light?"light":"dark")}catch(e){}
  const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=light?"#f3f5fa":"#0a0f1e";
  $$("[data-theme-toggle]").forEach(b=>{b.textContent=light?"☾":"☀";b.title=light?t("th.dark"):t("th.light")})}
$$("[data-theme-toggle]").forEach(b=>b.onclick=()=>applyTheme(document.documentElement.getAttribute("data-theme")==="light"?"dark":"light"));
applyTheme(document.documentElement.getAttribute("data-theme")==="light"?"light":"dark");
function rerender(){
  if(ovLoaded&&OV)renderOverview();
  if(ctLoaded)loadContacts(true);
  if(prLoaded)loadProps(true);
  if(CT&&$("#ctBody"))renderContact();
  if(PR&&$("#prBody"))renderProp();
  if(mpData)renderMap();
  if(curTab==="ac")loadActivity();
  if(window.NEXUS_ADMIN)NEXUS_ADMIN.rerender();
}

const eur=v=>v==null||v===""?"—":"€ "+Number(v).toLocaleString(LOC(),{maximumFractionDigits:0});
const num=v=>v==null?"—":Number(v).toLocaleString(LOC());
const ROLE={suspect:["Suspect","--r-suspect"],prospect:["Prospect","--r-prospect"],seller:["Seller","--r-seller"],buyer:["Buyer","--r-buyer"],agent:["Agent","--r-agent"],"suspect-seller":["Suspect-Seller","--r-suspect-seller"]};
const roleTag=r=>{const x=ROLE[r]||[r,"--tx3"];return `<span class="role" style="--rc:var(${x[1]})">${esc(x[0])}</span>`};
const REPC={Rick:"#f97316",Marco:"#3b82f6",Ingrid:"#a855f7",Lisette:"#ec4899",Kantoor:"#475569"};
const rep=r=>r==="Kantoor"?t("Kantoor"):r;
function ago(ts){if(!ts)return"";const d=(Date.now()-new Date(ts))/1000;if(d<0){return new Date(ts).toLocaleDateString(LOC(),{day:"numeric",month:"short"})}
  const en=LANG==="en";
  if(d<3600)return Math.max(1,Math.round(d/60))+" min";if(d<86400)return Math.round(d/3600)+(en?" h":" u");if(d<86400*30)return Math.round(d/86400)+" d";
  return new Date(ts).toLocaleDateString(LOC(),{day:"numeric",month:"short",year:"2-digit"})}
function fdate(ts){return ts?new Date(ts).toLocaleDateString(LOC(),{day:"numeric",month:"short",year:"numeric"}):"—"}
function initials(n){n=(n||"?").trim();const p=n.split(/\s+/);return ((p[0]||"")[0]||"?").toUpperCase()+((p.length>1?p[p.length-1][0]:"")||"").toUpperCase()}
function hue(s){let h=0;for(const c of String(s||""))h=(h*31+c.charCodeAt(0))%360;return `hsl(${h} 55% 42%)`}
/* serverteksten (NL) vertalen */
function why(s){if(!s)return"";let m;
  if((m=s.match(/^koper van (.+)$/)))return t("why.buyer",{r:m[1]});
  if((m=s.match(/^verkoper van (.+)$/)))return t("why.seller",{r:m[1]});
  if((m=s.match(/^eigenaar van (.+)$/)))return t("why.owner",{r:m[1]});
  if((m=s.match(/^aanbieder van (.+)$/)))return t("why.offerer",{r:m[1]});
  if(s==="zelfde adres/telefoon")return t("why.household");return s}
const relT=r=>r==="koper"?t("rel.koper"):r==="eigenaar"?t("rel.eigenaar"):r==="aanbiedend makelaar"?t("rel.agent"):r;
const tlTitle=s=>s==="bezichtiging"?t("tl.viewing"):s;
/* link naar de woning bij de partner-makelaar; zonder URL in de feed: zoeken op agency + hun referentie */
function extLink(agency,url,ref){if(url)return{href:url,exact:true};
  if(!agency&&!ref)return null;return{href:"https://www.google.com/search?q="+encodeURIComponent([agency,ref].filter(Boolean).join(" ")),exact:false}}
const catUrl=r=>"https://www1.sedecatastro.gob.es/CYCBienInmueble/OVCListaBienes.aspx?rc1="+encodeURIComponent(String(r).slice(0,7))+"&rc2="+encodeURIComponent(String(r).slice(7,14));
const catMap=r=>"https://www1.sedecatastro.gob.es/Cartografia/mapa.aspx?refcat="+encodeURIComponent(String(r).slice(0,14));

async function rpc(fn,args){const {data,error}=await sb.rpc(fn,args||{});if(error){if(error.code==="42501"){noAccess();}throw error}return data}

/* ================= AUTH ================= */
const lgMsg=(k,ok,raw)=>{const m=$("#lgMsg");m.textContent=raw?k:(k?t(k):"");m.className="msg "+(ok?"ok":"err")};
function showForm(mode){["fLogin","fReset","fActivate","fNewPass"].forEach(id=>$("#"+id).classList.add("hidden"));
  $({login:"#fLogin",reset:"#fReset",activate:"#fActivate",newpass:"#fNewPass"}[mode]).classList.remove("hidden");lgMsg("")}
$$(".lg-links a").forEach(a=>a.onclick=()=>showForm(a.dataset.mode));
$("#fLogin").onsubmit=async e=>{e.preventDefault();const b=$("#lgBtn");b.disabled=true;lgMsg("");
  const {error}=await sb.auth.signInWithPassword({email:$("#lgEmail").value.trim(),password:$("#lgPass").value});
  b.disabled=false;if(error)error.message==="Invalid login credentials"?lgMsg("msg.badcreds"):lgMsg(error.message,false,true);};
$("#fReset").onsubmit=async e=>{e.preventDefault();
  const {error}=await sb.auth.resetPasswordForEmail($("#rsEmail").value.trim(),{redirectTo:location.origin+location.pathname});
  error?lgMsg(error.message,false,true):lgMsg("msg.resetsent",true)};
$("#fActivate").onsubmit=async e=>{e.preventDefault();const em=$("#acEmail").value.trim().toLowerCase();
  if(!/@gruposoltura\.com$/.test(em))return lgMsg("msg.onlyteam");
  const {data:ok}=await sb.rpc("nexus_can_register",{p_email:em});
  if(!ok)return lgMsg("msg.notlisted");
  const {data,error}=await sb.auth.signUp({email:em,password:$("#acPass").value,options:{emailRedirectTo:location.origin+location.pathname}});
  if(error){return /registered|exists/i.test(error.message)?lgMsg("msg.exists"):lgMsg(error.message,false,true)}
  if(data.session)return; lgMsg("msg.confirm",true)};
$("#fNewPass").onsubmit=async e=>{e.preventDefault();const {error}=await sb.auth.updateUser({password:$("#npPass").value});
  if(error)return lgMsg(error.message,false,true);lgMsg("msg.saved",true);history.replaceState(null,"",location.pathname);
  if(booted){$("#login").classList.add("hidden");$("#app").classList.remove("hidden");route()}else boot()};
$("#logout").onclick=async()=>{await sb.auth.signOut();location.hash="";location.reload()};
function noAccess(){$("#app").classList.add("hidden");$("#login").classList.remove("hidden");showForm("login");
  lgMsg("msg.noaccess");sb.auth.signOut()}

let ME=null, booted=false;
sb.auth.onAuthStateChange((ev,session)=>{
  if(ev==="PASSWORD_RECOVERY"){$("#login").classList.remove("hidden");$("#app").classList.add("hidden");showForm("newpass");return}
  if(session&&!booted)boot();
  if(!session&&ev==="SIGNED_OUT"){booted=false}
});
applyStatic();
(async()=>{const {data}=await sb.auth.getSession();if(data.session&&!location.hash.includes("type=recovery"))boot()})();

async function boot(){
  if(booted)return;booted=true;
  try{ME=await rpc("nexus_me")}catch(e){booted=false;return}
  if(!ME){booted=false;return noAccess()}
  if(ME.lang&&ME.lang!==LANG){LANG=ME.lang;try{localStorage.setItem("nexus-lang",LANG)}catch(e){}applyStatic()}
  $("#login").classList.add("hidden");$("#app").classList.remove("hidden");
  $("#meName").textContent=ME.display_name;const av=$("#meAv");av.textContent=initials(ME.display_name);av.style.background=ME.color||"#14b8a6";
  buildRoleChips();buildStatusChips();buildBuildSeg();
  /* Admin (invoerschermen, nog niet gekoppeld): voorlopig alleen voor de rol admin */
  $("#tabAd").classList.toggle("hidden",ME.role!=="admin");
  route();
}

/* ================= TABS / ROUTING ================= */
const TABC={ov:"--c-ov",ct:"--c-ct",pr:"--c-pr",mp:"--c-mp",ac:"--c-ac",ad:"--c-ad"};
let curTab="ov";
function setTab(t_){curTab=t_;$$(".tab").forEach(b=>b.classList.toggle("on",b.dataset.tab===t_));
  $$(".pane").forEach(p=>p.classList.toggle("hidden",p.id!=="p-"+t_));
  document.documentElement.style.setProperty("--acc",`var(${TABC[t_]})`);
  if(t_==="ov"&&!ovLoaded)loadOverview();
  if(t_==="ct"&&!ctLoaded)loadContacts(true);
  if(t_==="pr"&&!prLoaded)loadProps(true);
  if(t_==="mp")loadMap();
  if(t_==="ac")loadActivity();
  if(t_==="ad"&&window.NEXUS_ADMIN)NEXUS_ADMIN.open($("#p-ad"),{rpc,t,lang:()=>LANG,me:()=>ME,esc});
}
$$(".tab").forEach(b=>b.onclick=()=>{location.hash=b.dataset.tab});
window.addEventListener("hashchange",route);
function route(){
  if(!booted)return;const h=location.hash.replace(/^#/,"");
  let m;
  if((m=h.match(/^c\/([^/?#]+)/))){setTab("ct");openContact(decodeURIComponent(m[1]));return}
  if((m=h.match(/^p\/([^/?#]+)/))){setTab("pr");applyPrFocus();openProp(decodeURIComponent(m[1]));return}
  prFocus=false;applyPrFocus();
  if(h==="ad"&&ME.role!=="admin")return setTab("ov");
  setTab(TABC[h]?h:"ov");
}
const go={c:id=>location.hash="c/"+id,p:id=>location.hash="p/"+encodeURIComponent(id)};
/* Woning openen van buiten de woningenlijst (vanuit een contact, overzicht, activiteit of directe link):
   volledig scherm met alle details en een terugknop. Vanuit de lijst zelf blijft het de gesplitste weergave. */
let prFocus=true, prFrom=null;
function applyPrFocus(){
  const ps=$("#p-pr .psplit"), fb=$("#prFocus"); if(!ps||!fb)return;
  ps.classList.toggle("focus",prFocus); fb.classList.toggle("hidden",!prFocus);
  $("#prBackLbl").textContent=prFrom&&prFrom.name?t("back.to",{n:prFrom.name}):t("back");
  $("#prAll").textContent=t("pr.all");
}
$("#prBack").onclick=()=>{if(prFrom&&prFrom.hash)location.hash=prFrom.hash;else if(history.length>1)history.back();else location.hash="pr"};
$("#prAll").onclick=()=>{prFocus=false;prFrom=null;applyPrFocus();if(!prLoaded)loadProps(true)};
/* data-c wint van data-p: zo opent de eigenaar-link op een woningkaart het contact, niet de woning */
document.addEventListener("click",e=>{if(e.target.closest("a[href]"))return;
  const c=e.target.closest("[data-c]"), p=e.target.closest("[data-p]");
  if(c&&(!p||p.contains(c))){e.stopPropagation();go.c(c.dataset.c);return}
  if(p){
    prFocus=!p.closest("#prRows");
    if(prFocus&&curTab!=="pr")prFrom=curTab==="ct"&&CT&&CT.contact?{name:CT.contact.full_name||CT.contact.email,hash:location.hash.replace(/^#/,"")}:{hash:location.hash.replace(/^#/,"")||curTab};
    go.p(p.dataset.p)}});

/* globale zoek */
let gT;$("#gSearch").addEventListener("input",e=>{clearTimeout(gT);gT=setTimeout(()=>{const v=e.target.value.trim();
  if(/^[A-Za-z]{2,4}\d{2,4}$/.test(v)){location.hash="pr";$("#prQ").value=v;loadProps(true);return}
  $("#ctQ").value=v;if(location.hash!=="#ct")location.hash="ct";loadContacts(true)},300)});

/* ================= OVERZICHT ================= */
let ovLoaded=false, OV=null;
async function loadOverview(){
  const p=$("#p-ov");p.innerHTML=`<div class="loader">${t("loading.ov")}</div>`;
  try{OV=await rpc("nexus_overview")}catch(e){p.innerHTML=`<div class="empty">${t("err")}: ${esc(e.message)}</div>`;return}
  ovLoaded=true;buildRoleChips();renderOverview();
}
function renderOverview(){
  const p=$("#p-ov"), o=OV, pr=o.props||{}, roles=o.roles||{};
  $("#cntCt").textContent=num(o.contacts_total);$("#cntPr").textContent=num(pr.current);
  const kp=(v,l,s,c,act)=>`<div class="card kpi" style="--kc:var(${c})" data-go="${act}"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
  const maxR=Math.max(1,...Object.values(roles));
  const order=["suspect","seller","buyer","suspect-seller","agent"];
  const d=o.req_daily_30d||[], mx=Math.max(1,...d.map(x=>x.n));
  const pts=d.map((x,i)=>`${(i/(d.length-1||1))*300},${66-(x.n/mx)*60}`).join(" ");
  p.innerHTML=`<div class="ov">
   <div class="kpis">
    ${kp(num(o.contacts_total),t("kpi.contacts"),t("kpi.contacts.s",{n:num(o.contacts_new_30d)}),"--c-ct","ct")}
    ${kp(num(o.contacts_mine),t("kpi.mine"),t("kpi.mine.s",{n:esc(ME.display_name)}),"--c-ov","ct:mine")}
    ${kp(num(pr.current),t("kpi.props"),t("kpi.props.s",{a:num(pr.own),b:num(pr.external)}),"--c-pr","pr")}
    ${kp(num(pr.under_offer),t("kpi.offer"),t("kpi.offer.s",{n:num(pr.sold)}),"--c-pr","pr:under_offer")}
    ${kp(num(o.requests_7d),t("kpi.req"),t("kpi.req.s",{a:num(o.requests_30d),b:num(o.leads_7d)}),"--c-ac","ac")}
    ${kp(num(o.viewings_upcoming),t("kpi.view"),t("kpi.view.s",{n:num(o.hot_pending)}),"--c-ac","ac")}
   </div>
   <div class="card ov-roles"><div class="hd"><h3>${t("ov.roles")}</h3><span class="sm muted">${t("ov.clickfilter")}</span></div>
     <div class="scroll" style="flex:1;padding:6px 0">${order.map(r=>`<div class="rolebar" data-role="${r}" style="--rc:var(${(ROLE[r]||[])[1]})">
       <span>${roleTag(r)}</span><div class="bar"><span style="width:${((roles[r]||0)/maxR*100).toFixed(1)}%"></span></div><span class="n">${num(roles[r]||0)}</span></div>`).join("")}
     <div class="hd" style="border-top:1px solid var(--line);margin-top:6px"><h3>${t("ov.req30")}</h3><span class="sm muted">${t("ov.max",{n:mx})}</span></div>
     <div class="spark"><svg viewBox="0 0 300 70" preserveAspectRatio="none"><defs><linearGradient id="sg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ec4899" stop-opacity=".45"/><stop offset="1" stop-color="#ec4899" stop-opacity="0"/></linearGradient></defs>
       <polygon points="0,70 ${pts} 300,70" fill="url(#sg)"/><polyline points="${pts}" fill="none" stroke="#ec4899" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
       <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${(o.req_types_30d||[]).map(x=>`<span class="tag">${esc(x.t)} · ${x.n}</span>`).join("")}</div></div>
     </div></div>
   <div class="card ov-act"><div class="hd"><h3>${t("ov.activity")}</h3><a class="sm muted" href="#ac">${t("ov.all")}</a></div>
     <div class="scroll feed" style="flex:1">${feedHtml(o.activity)}</div></div>
   <div class="ov-side">
     <div class="card" style="flex:1;display:flex;flex-direction:column;min-height:0"><div class="hd"><h3>${t("ov.viewings")}</h3><span class="sm muted">${(o.viewings||[]).length||""}</span></div>
       <div class="scroll feed" style="flex:1">${viewingsHtml(o.viewings)}</div></div>
     <div class="card" style="flex:1;display:flex;flex-direction:column;min-height:0"><div class="hd"><h3>${t("ov.notaries")}</h3><span class="sm muted">${(o.notaries||[]).length||""}</span></div>
       <div class="scroll feed" style="flex:1">${notariesHtml(o.notaries)}</div></div>
   </div></div>`;
  p.querySelectorAll("[data-go]").forEach(k=>k.onclick=()=>{const [tb,a]=k.dataset.go.split(":");
    if(tb==="ct"){ctScope=a==="mine"?"mine":"all";$$("#ctScope button").forEach(b=>b.classList.toggle("on",b.dataset.v===ctScope));ctLoaded=false}
    if(tb==="pr"&&a){prStatus=a;buildStatusChips();prLoaded=false}
    location.hash=tb;});
  p.querySelectorAll("[data-role]").forEach(r=>r.onclick=()=>{ctRole=r.dataset.role;buildRoleChips();ctLoaded=false;location.hash="ct"});
}
/* komende afspraken uit nexus_agenda (agenda-scans van ViewingLogger en ModeloReminder) */
const ownerName=e=>{const m=String(e||"").match(/^([a-z]+)@gruposoltura\.com$/i);return m?m[1][0].toUpperCase()+m[1].slice(1):(e||"")};
const agWhen=x=>`${fdate(x.date)}${x.time?" · "+esc(x.time)+(x.end?"–"+esc(x.end):""):""}`;
function viewingsHtml(v){return (v||[]).length?v.map(x=>`<div class="it" ${x.prop_wp_id?`data-p="${x.prop_wp_id}"`:'style="cursor:default"'}><div class="ic" style="--ic:#22c55e">◉</div>
  <div style="min-width:0"><div class="t">${esc(x.ref||"—")}${x.client?" · "+esc(x.client):""}</div><div class="d">${agWhen(x)}${x.owner?` · <span style="color:${REPC[ownerName(x.owner)]||"#64748b"}">${esc(ownerName(x.owner))}</span>`:""}</div>${x.title?`<div class="d" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.title)}</div>`:""}</div><span></span></div>`).join(""):`<div class="empty">${t("ov.noviewings")}</div>`}
function notariesHtml(v){return (v||[]).length?v.map(x=>`<div class="it" ${x.prop_wp_id?`data-p="${x.prop_wp_id}"`:'style="cursor:default"'}><div class="ic" style="--ic:#a855f7">⚖</div>
  <div style="min-width:0"><div class="t">${esc(x.client||x.title||"—")}</div><div class="d">${agWhen(x)}${x.role?` · ${esc(t("nt."+x.role)!=="nt."+x.role?t("nt."+x.role):x.role)}`:""}${x.ref?" · "+esc(x.ref):""}${x.owner?` · <span style="color:${REPC[ownerName(x.owner)]||"#64748b"}">${esc(ownerName(x.owner))}</span>`:""}</div>
  ${(x.modelos||[]).length?`<div style="margin-top:3px;display:flex;gap:4px;flex-wrap:wrap">${x.modelos.map(m=>`<span class="tag">Modelo ${esc(m)}</span>`).join("")}</div>`:""}</div><span></span></div>`).join(""):`<div class="empty">${t("ov.nonotaries")}</div>`}
function feedHtml(list){
  const IC={request:["#ec4899","✉"],lead:["#f59e0b","★"],viewing:["#22c55e","◉"]};
  if(!list||!list.length)return`<div class="empty">${t("noactivity")}</div>`;
  return list.map(a=>{const ic=IC[a.kind]||IC.request;return `<div class="it" ${a.contact_wp_id?`data-c="${a.contact_wp_id}"`:""}>
    <div class="ic" style="--ic:${ic[0]}">${ic[1]}</div>
    <div style="min-width:0"><div class="t">${esc(a.name||t("unknown"))}</div><div class="d">${esc(a.type)}${a.ref?" · "+esc(a.ref):""} · <span style="color:${REPC[a.rep]||"#64748b"}">${esc(rep(a.rep||""))}</span></div></div>
    <span class="sm muted">${ago(a.ts)}</span></div>`}).join("")}

/* ================= CONTACTEN ================= */
let ctLoaded=false, ctRole="", ctScope="all", ctOff=0, ctSel=null;
function buildRoleChips(){const order=["","suspect","seller","buyer","suspect-seller","agent"];
  $("#ctRoles").innerHTML=order.map(r=>`<span class="chip ${ctRole===r?"on":""}" data-r="${r}" style="--cc:var(${r?ROLE[r][1]:"--c-ct"})">${r?ROLE[r][0]:t("allroles")}${OV&&r&&OV.roles?` <b>${num(OV.roles[r]||0)}</b>`:""}</span>`).join("");
  $$("#ctRoles .chip").forEach(c=>c.onclick=()=>{ctRole=c.dataset.r;buildRoleChips();loadContacts(true)})}
$$("#ctScope button").forEach(b=>b.onclick=()=>{ctScope=b.dataset.v;$$("#ctScope button").forEach(x=>x.classList.toggle("on",x===b));loadContacts(true)});
let cT;$("#ctQ").addEventListener("input",()=>{clearTimeout(cT);cT=setTimeout(()=>loadContacts(true),280)});
async function loadContacts(reset){
  const box=$("#ctRows");if(reset){ctOff=0;box.innerHTML=`<div class="loader">${t("loading.search")}</div>`}
  let r;try{r=await rpc("nexus_search",{p_q:$("#ctQ").value,p_role:ctRole||null,p_scope:ctScope,p_limit:50,p_offset:ctOff})}catch(e){box.innerHTML=`<div class="empty">${esc(e.message)}</div>`;return}
  ctLoaded=true;
  const html=r.rows.map(c=>`<div class="row ${ctSel===String(c.key||c.wp_id)?"sel":""}" data-c="${esc(c.key||c.wp_id)}">
     <div class="ini" style="background:${hue(c.name||c.email)}">${esc(initials(c.name||c.email))}</div>
     <div style="min-width:0"><div class="nm">${esc(c.name||c.email||t("noname"))}</div>
       <div class="sub">${(c.roles||[]).map(roleTag).join(" ")} <span>${esc([c.city,c.country].filter(Boolean).join(", ")||c.email||"")}</span></div></div>
     <div style="text-align:right"><div class="sm" style="color:${REPC[c.rep]||"#64748b"}">${esc(rep(c.rep))}</div><div class="sm muted">${c.last?ago(c.last):""}</div></div></div>`).join("");
  if(reset)box.innerHTML=html||`<div class="empty">${t("nocontacts")}</div>`;else{box.querySelector(".more")?.remove();box.insertAdjacentHTML("beforeend",html)}
  ctOff+=r.rows.length;
  if(ctOff<r.total){box.insertAdjacentHTML("beforeend",`<div class="more"><button class="btn" id="ctMore">${t("more",{n:num(r.total-ctOff)})}</button></div>`);$("#ctMore").onclick=()=>loadContacts(false)}
  if(reset)box.insertAdjacentHTML("afterbegin",`<div class="sub muted sm" style="padding:6px 12px">${t("n.contacts",{n:num(r.total)})}</div>`);
}
let ctSub="profiel", CT=null;
async function openContact(id){
  id=String(id);ctSel=id;$$("#ctRows .row").forEach(r=>r.classList.toggle("sel",r.dataset.c===id));
  if(!ctLoaded)loadContacts(true);
  const d=$("#ctDetail");d.innerHTML=`<div class="loader">${t("loading.ct")}</div>`;
  try{CT=await rpc("nexus_contact_by_key",{p_key:id})}catch(e){d.innerHTML=`<div class="empty">${esc(e.message)}</div>`;return}
  if(!CT){d.innerHTML=`<div class="empty">${t("notfound.ct")}</div>`;return}
  renderContact();
  if(innerWidth<1100)d.scrollIntoView({behavior:"smooth",block:"start"});
}
function renderContact(){
  const c=CT.contact, raw=CT.raw||{}, d=$("#ctDetail");
  const name=c.full_name||[raw.first_name,raw.last_name].filter(Boolean).join(" ")||c.email;
  const tabs=[["profiel",t("st.profile")],["woningen",t("st.props"),(CT.properties||[]).length+(CT.interests||[]).length],["tijdlijn",t("st.timeline"),(CT.timeline||[]).length],["relaties",t("st.relations"),(CT.relations||[]).length+(CT.interested_in_mine||[]).length],["mailings",t("st.mailings")]];
  if(!tabs.some(x=>x[0]===ctSub))ctSub="profiel";
  const D=CT.details||{};
  const phones=(D.phones&&D.phones.length?D.phones.map(x=>x.value):[c.phone]).filter(Boolean);
  const emails=(D.emails&&D.emails.length?D.emails.map(x=>x.value):[c.email]).filter(Boolean);
  const cleanTel=v=>String(v).replace(/[^\d+]/g,""), waNum=v=>cleanTel(v).replace(/^\+/,"").replace(/^00/,"");
  const intro=D.introducer;
  d.innerHTML=`<div class="dh"><div class="ini big" style="background:${hue(name)}">${esc(initials(name))}</div>
    <div style="min-width:0;flex:1"><h2>${esc(name)}</h2>
      <div class="roles">${(c.roles||[]).map(roleTag).join("")}<span class="sm muted" style="margin-left:6px">👤 <b style="color:${REPC[c.rep]||"#94a3b8"}">${esc(rep(c.rep))}</b> ${c.wp_id?" · #"+c.wp_id:""}${c.language?" · 🌐 "+esc(c.language):""}</span></div>
      <div class="cstrip">${phones.map(p=>`<span class="cpill"><a href="tel:${esc(cleanTel(p))}">☎ ${esc(p)}</a><a class="wa" href="https://wa.me/${esc(waNum(p))}" target="_blank" rel="noopener" title="WhatsApp">WA</a></span>`).join("")}${!phones.length?`<span class="cpill nophone"><a data-cedit="1" title="${esc(t("addphone"))}">☎ ${t("nophone")} · <b>+ ${t("addphone")}</b></a></span>`:""}${emails.map(e=>`<span class="cpill"><a href="mailto:${esc(e)}">✉ ${esc(e)}</a></span>`).join("")}${!emails.length?`<span class="cpill nophone"><a data-cedit="1">✉ ${t("noemail")} · <b>+ ${t("addemail")}</b></a></span>`:""}</div>
      ${intro?`<div class="introbar" data-c="${esc(intro.key||intro.wp_id)}">🤝 ${t("intro.by")} <b>${esc(intro.name||intro.email)}</b>${intro.phone?` · ${esc(intro.phone)}`:""}${intro.email?` · ${esc(intro.email)}`:""}<span class="go">${t("intro.open")}</span></div>`:""}</div>
    <div class="acts"><a class="act-edit" data-cedit="1">✎ ${t("act.pedit")}</a>${c.wp_id?`<a href="https://gruposoltura.com/wp-admin/admin.php?page=cpr-contacts&view=overview&id=${c.wp_id}" target="_blank" rel="noopener" title="${esc(t("act.cprold"))}">CPR ↗</a>`:""}</div></div>
   <div class="subtabs">${tabs.map(x=>`<button class="st ${ctSub===x[0]?"on":""}" data-s="${x[0]}">${x[1]}${x[2]!=null?`<span class="cnt">${x[2]}</span>`:""}</button>`).join("")}</div>
   <div class="dbody scroll" id="ctBody"></div>`;
  d.querySelectorAll(".st").forEach(b=>b.onclick=()=>{ctSub=b.dataset.s;renderContact()});
  d.querySelectorAll("[data-cedit]").forEach(ce=>ce.onclick=()=>window.NEXUS_EDIT&&NEXUS_EDIT.openContact(c.key||c.id||c.wp_id,{sb,rpc,lang:()=>LANG,me:()=>ME,onSaved:()=>{openContact(ctSel);loadContacts(true)}}));
  const B=$("#ctBody");
  if(ctSub==="profiel")B.innerHTML=ctProfile(c,raw);
  if(ctSub==="woningen")B.innerHTML=ctProps();
  if(ctSub==="tijdlijn")B.innerHTML=timeline(CT.timeline);
  if(ctSub==="relaties")B.innerHTML=ctRelations(c);
  if(ctSub==="mailings")B.innerHTML=ctMailings(c);
}
function kv(pairs){const f=pairs.filter(p=>p[1]!=null&&p[1]!=="");return f.length?`<dl class="kv">${f.map(p=>`<dt>${p[0]}</dt><dd>${p[2]?p[1]:esc(p[1])}</dd>`).join("")}</dl>`:`<div class="empty sm">${t("nodata")}</div>`}
function salesStatus(v){if(v==null||v==="")return null;return v==="0"?"Unqualified":v}
function ctProfile(c,raw){
  const ip=CT.interest||{}, m=CT.matches||{}, fb=CT.feedback||{}, D=CT.details||{};
  const addr=[D.street,[D.postcode,D.city].filter(Boolean).join(" "),D.suburb,D.state,D.country].filter(Boolean).map(esc).join("<br>");
  const budget=ip.declared_budget_min||ip.declared_budget_max?`${eur(ip.declared_budget_min)} – ${eur(ip.declared_budget_max)}`:(ip.price_min?`${eur(ip.price_min)} – ${eur(ip.price_max)} (${t("behaviour")})`:raw.sd_budget);
  const link=(u,l)=>u?`<a href="${esc(/^https?:/.test(u)?u:"https://"+u)}" target="_blank" rel="noopener">${esc(l||u)}</a>`:null;
  const socials=[D.facebook&&link(D.facebook,"Facebook"),D.instagram&&link(D.instagram,"Instagram"),D.linkedin&&link(D.linkedin,"LinkedIn"),D.twitter&&link(D.twitter,"X/Twitter")].filter(Boolean).join(" · ");
  return `<div class="bigtiles">
     <div class="bt"><div class="l">${t("t.requests")}</div><div class="v">${num(ip.total_requests||0)}</div></div>
     <div class="bt"><div class="l">${t("t.viewed")}</div><div class="v">${num(ip.distinct_properties_viewed||0)}</div></div>
     <div class="bt"><div class="l">${t("t.matches")}</div><div class="v">${num(m.sent||0)}</div></div>
     <div class="bt"><div class="l">${t("t.engagement")}</div><div class="v">${ip.engagement_score!=null?Number(ip.engagement_score).toFixed(0):"—"}</div></div></div>
   <div class="grid2">
    <div class="card"><div class="hd"><h3>${t("h.person")}</h3></div>${kv([[t("f.title"),D.title],[t("f.first"),D.first_name],[t("f.last"),D.last_name],[t("f.homeaddr"),addr||null,1],[t("f.born"),D.birthday],[t("f.marital"),D.marital],[t("f.nie"),D.nie?`<b class="mono">${esc(D.nie)}</b>`:null,1],[t("f.passport"),D.passport?`<b class="mono">${esc(D.passport)}</b>`:null,1],[t("f.language"),D.language],[t("f.company"),D.company],[t("f.jobtitle"),D.jobtitle],[t("f.website"),link(D.website),1],[t("f.socials"),socials||null,1],[t("f.custom")+" 1",D.custom_1],[t("f.custom")+" 2",D.custom_2]])}</div>
    <div class="card"><div class="hd"><h3>${t("h.cpr")}</h3></div>${kv([[t("f.introducer"),D.introducer?`<a class="ownerlink" data-c="${esc(D.introducer.key||D.introducer.wp_id)}">${esc(D.introducer.name||D.introducer.email)}</a>`:null,1],[t("f.referred"),D.referred_by],[t("f.keyholder"),D.keyholder],[t("f.salesstatus"),salesStatus(D.sales_status)],[t("f.value"),D.sales_value?eur(D.sales_value):null],[t("f.since"),raw.created_wp?fdate(raw.created_wp):null],[t("f.modified"),c.wp_modified?fdate(c.wp_modified):null]])}
      <div class="hd" style="border-top:1px solid var(--line)"><h3>${t("h.search")}</h3><span class="tag">${esc(ip.data_confidence||"—")}</span></div>${kv([[t("f.budget"),budget],[t("f.type"),ip.declared_property_type||raw.sd_type||(ip.preferred_categories?Object.keys(ip.preferred_categories).slice(0,3).join(", "):null)],[t("f.beds"),ip.declared_bedrooms_min?"≥ "+ip.declared_bedrooms_min:null],[t("f.areas"),ip.declared_areas?[].concat(ip.declared_areas).join(", "):null],[t("f.musthaves"),ip.declared_must_haves?[].concat(ip.declared_must_haves).join(", "):null],[t("f.period"),ip.declared_period||raw.sd_period],[t("f.firstlast"),ip.first_request_at?`${fdate(ip.first_request_at)} → ${fdate(ip.last_request_at)}`:null],[t("f.feedback"),Object.keys(fb).length?Object.entries(fb).map(([k,v])=>k+": "+v).join(" · "):null]])}</div>
   </div>
   <div class="card" style="margin-top:12px"><div class="hd"><h3>${t("h.notes")}</h3></div><div class="note">${raw.internal_comments?esc(raw.internal_comments.replace(/<br\s*\/?>/gi,"\n")):`<span class="muted">${t("nonotes")}</span>`}</div></div>`;
}
function cprDate(v){if(!v)return null;let m;
  if((m=String(v).match(/^SCHEDULED-(\d{4})(\d{2})(\d{2})/)))return t("ml.scheduled")+" "+fdate(`${m[1]}-${m[2]}-${m[3]}`);
  if((m=String(v).match(/^(\d{4})(\d{2})(\d{2})\d{0,6}$/))&&+m[1]>2000)return fdate(`${m[1]}-${m[2]}-${m[3]}`);
  return "#"+v}
function ctMailings(c){
  const M=(CT.details||{}).mailing||{}, jin=M.jarvis_optin||{}, jout=M.jarvis_optout||{}, ev=M.events||{};
  const pill=(on,txtOn,txtOff)=>on==null?`<span class="mpill">—</span>`:`<span class="mpill ${on?"in":"out"}">${on?txtOn:txtOff}</span>`;
  const masterOn=M.master_optin==="yes"||(M.master_optin==null&&M.synced_opt_in);
  const types=(M.types||[]).map(tp=>{const i=jin[tp.slug], o=jout[tp.slug];
    let st=tp.opted_in, src="Supabase";
    if(st==null&&(i||o)){st=!o||(!!i&&i>o);src="JARVIS"} if(st==null){st=tp.default;src=t("ml.default")}
    return `<tr><td>${esc(t("mt."+tp.slug)!=="mt."+tp.slug?t("mt."+tp.slug):tp.label)}</td><td>${pill(st,t("ml.in"),t("ml.out"))}</td><td class="muted">${esc(src)}</td><td>${i?fdate(i):"—"}</td><td>${o?fdate(o):"—"}</td><td>${tp.updated?fdate(tp.updated):"—"}</td></tr>`}).join("");
  const legacy=Object.keys(jout).filter(k=>!(M.types||[]).some(x=>x.slug===k));
  const cpr=(M.cpr||[]).map(x=>`<tr><td>${esc(t("cm."+x.key)!=="cm."+x.key?t("cm."+x.key):x.key)}</td><td>${pill(x.on==="yes",t("ml.in"),t("ml.out"))}</td><td>${cprDate(x.last)||"—"}</td></tr>`).join("");
  return `<div class="bigtiles">
     <div class="bt"><div class="l">${t("ml.master")}</div><div class="v">${pill(masterOn,t("yes"),t("no"))}</div></div>
     <div class="bt"><div class="l">${t("ml.delivered")}</div><div class="v">${num(ev.delivered||0)}</div></div>
     <div class="bt"><div class="l">${t("ml.opened")} / ${t("ml.clicked")}</div><div class="v">${num(ev.opened||0)} / ${num(ev.clicked||0)}</div></div>
     <div class="bt"><div class="l">${t("ml.lastmail")}</div><div class="v" style="font-size:calc(15px*var(--fs,1))">${ev.last_delivered?fdate(ev.last_delivered):"—"}</div></div></div>
   ${ev.unsubscribed||ev.hard_bounce||ev.spam||(M.bounces||[]).length?`<div class="alertbar">${ev.unsubscribed?`⛔ ${t("ml.unsub")} ${fdate(ev.unsubscribed)} `:""}${ev.hard_bounce?`· ⚠ hard bounce ${fdate(ev.hard_bounce)} `:""}${ev.spam?`· 🚫 spam ${fdate(ev.spam)} `:""}${(M.bounces||[]).map(b=>`· ${t("ml.bounce")} ${fdate(b.at)} (${esc(b.reason||b.action||"")})`).join(" ")}</div>`:""}
   <div class="card"><div class="hd"><h3>${t("ml.jarvis")}</h3><span class="sm muted">${M.optout_changed?t("ml.changed")+" "+fdate(M.optout_changed):""}</span></div>
     <div class="scroll"><table class="mtable"><thead><tr><th>${t("ml.type")}</th><th>${t("ml.status")}</th><th>${t("ml.source")}</th><th>${t("ml.optin")}</th><th>${t("ml.optout")}</th><th>${t("ml.updated")}</th></tr></thead><tbody>${types}</tbody></table></div>
     ${legacy.length?`<div class="sm muted" style="padding:8px 14px">${t("ml.legacy")}: ${legacy.map(k=>esc(k)+" ("+fdate(jout[k])+")").join(", ")}</div>`:""}</div>
   <div class="card" style="margin-top:12px"><div class="hd"><h3>${t("ml.cpr")}</h3></div>
     <div class="scroll"><table class="mtable"><thead><tr><th>${t("ml.type")}</th><th>${t("ml.status")}</th><th>${t("ml.lastsent")}</th></tr></thead><tbody>${cpr||`<tr><td colspan="3" class="muted">—</td></tr>`}</tbody></table></div></div>`;
}
function propCard(p,extra){return `<div class="pcard" data-p="${esc(p.key||p.reference||p.wp_id||"")}">${p.image?`<img loading="lazy" src="${esc(p.image)}" alt="">`:'<div class="ph"></div>'}
  <div style="min-width:0"><div class="tt">${esc(p.reference||"?")} · ${esc(p.title||"")}</div><div class="pr">${eur(p.price)}</div>
  <div class="sm muted">${esc(p.town||"")} · ${esc(p.core_status?stLabel(p.core_status):(p.status||""))}</div>${extra||""}</div></div>`}
function ctProps(){
  const own=CT.properties||[], it=CT.interests||[];
  return `<div class="hd" style="padding:0 0 8px"><h3>${t("h.owned",{n:own.length})}</h3></div>
   ${own.length?`<div class="grid2">${own.map(p=>propCard(p,`<div style="margin-top:4px"><span class="role" style="--rc:var(${p.relation==="koper"?"--r-buyer":p.relation==="eigenaar"?"--r-seller":"--r-agent"})">${esc(relT(p.relation))}</span></div>`)).join("")}</div>`:`<div class="empty sm">${t("noowned")}</div>`}
   <div class="hd" style="padding:16px 0 8px"><h3>${t("h.interest",{n:it.length})}</h3></div>
   ${it.length?`<div class="grid2">${it.map(p=>propCard(p,`<div class="sm" style="margin-top:4px">${p.n}× · ${esc((p.types||[]).join(", "))} · ${ago(p.last)}</div>`)).join("")}</div>`:`<div class="empty sm">${t("nointerest")}</div>`}`}
function timeline(list){
  const C={request:"#ec4899",viewing:"#22c55e",mail:"#3b82f6",lead:"#f59e0b",hot:"#ef4444",note:"#a855f7"};
  if(!list||!list.length)return`<div class="empty">${t("notimeline")}</div>`;
  return `<div class="tl">${list.map(e=>`<div class="e" style="--ec:${C[e.kind]||"#64748b"}"><div class="h"><span class="k">${esc(t("k."+e.kind))} · ${esc(tlTitle(e.title||""))}</span>${e.ref?`<span class="tag">${esc(e.ref)}</span>`:""}<span class="w">${fdate(e.ts)} · ${ago(e.ts)}</span></div>${e.text?`<div class="x">${esc(e.text)}</div>`:""}</div>`).join("")}</div>`}
function ctRelations(c){
  const r=CT.relations||[], im=CT.interested_in_mine||[];
  const rel=x=>`<div class="rel" data-c="${esc(x.key||x.wp_id)}"><div class="ini" style="background:${hue(x.name||x.email)};width:32px;height:32px;font-size:calc(12px*var(--fs,1))">${esc(initials(x.name||x.email))}</div><div style="min-width:0"><div style="font-weight:600">${esc(x.name||x.email)}</div><div class="sm muted">${esc(x.why||"")}</div></div></div>`;
  return `<div class="hd" style="padding:0 0 8px"><h3>${t("h.guided")}</h3></div>
    <div class="rel" style="cursor:default;max-width:320px"><div class="avatar" style="background:${REPC[c.rep]||"#475569"}">${esc(initials(rep(c.rep)))}</div><div><b>${esc(rep(c.rep))}</b><div class="sm muted">Grupo Soltura</div></div></div>
    <div class="hd" style="padding:16px 0 8px"><h3>${t("h.connected",{n:r.length})}</h3></div>
    ${r.length?`<div class="grid2">${r.map(x=>rel({...x,why:why(x.why)})).join("")}</div>`:`<div class="empty sm">${t("noconnected")}</div>`}
    ${im.length?`<div class="hd" style="padding:16px 0 8px"><h3>${t("h.intmine",{n:im.length})}</h3></div><div class="grid2">${im.map(x=>rel({...x,why:x.ref+" · "+t("x.requests",{n:x.n})})).join("")}</div>`:""}`}
function enrichList(list,kind){
  if(!list||!list.length)return `<div class="empty">${t("noenrich",{k:t("kind."+kind)})}<br><span class="sm">${t("noenrich.s")}</span></div>`;
  const by={};list.forEach(e=>{(by[e.field]=by[e.field]||[]).push(e)});
  return `<div class="card">${Object.entries(by).map(([f,arr])=>`<dl class="kv" style="border-bottom:1px solid var(--line)"><dt>${esc(f)}</dt><dd>${arr.map((e,i)=>`<div style="${i?"opacity:.55;font-size:calc(12px*var(--fs,1))":""}">${esc(typeof e.value==="object"?JSON.stringify(e.value):e.value)}<span class="src">${esc(e.label||e.source)}</span>${e.url?` <a href="${esc(e.url)}" target="_blank" rel="noopener" class="sm muted">↗</a>`:""} <span class="sm muted">${ago(e.at)}</span></div>`).join("")}</dd></dl>`).join("")}</div>`}

/* ================= WONINGEN ================= */
let prLoaded=false, prStatus="current", prBuild="", prOff=0, prSel=null, PR=null, prSub="kenmerken";
function buildStatusChips(){const S=["current","under_offer","own","draft","withdrawn","sold","all"];
  $("#prStatus").innerHTML=S.map(s=>`<span class="chip ${prStatus===s?"on":""}" data-s="${s}" style="--cc:var(--c-pr)">${t("ps."+s)}</span>`).join("");
  $$("#prStatus .chip").forEach(c=>c.onclick=()=>{prStatus=c.dataset.s;buildStatusChips();loadProps(true)})}
function buildBuildSeg(){const B=[["","pb.all"],["resale","pb.resale"],["new","pb.new"]];
  $("#prBuild").innerHTML=B.map(b=>`<button data-b="${b[0]}" class="${prBuild===b[0]?"on":""}">${t(b[1])}</button>`).join("");
  $$("#prBuild button").forEach(b=>b.onclick=()=>{prBuild=b.dataset.b;buildBuildSeg();loadProps(true)})}
let pT;$("#prQ").addEventListener("input",()=>{clearTimeout(pT);pT=setTimeout(()=>loadProps(true),280)});
async function loadProps(reset){
  const box=$("#prRows");if(reset){prOff=0;box.innerHTML=`<div class="loader">${t("loading.props")}</div>`}
  let r;try{r=await rpc("nexus_properties",{p_q:$("#prQ").value,p_status:prStatus+(prBuild?":"+prBuild:""),p_limit:48,p_offset:prOff})}catch(e){box.innerHTML=`<div class="empty">${esc(e.message)}</div>`;return}
  prLoaded=true;
  const html=r.rows.map(p=>`<div class="pc ${prSel===p.reference?"sel":""}" data-p="${esc(p.reference)}"><div class="im" style="${p.image?`background-image:url('${esc(p.image)}')`:""}">
     <span class="badge">${esc(p.reference||"")}</span>${stBadge(p.core_status)}${p.cat_ref?`<span class="catb" title="Catastro ${esc(p.cat_ref)}">CAT</span>`:""}${p.req30>0?`<span class="hot">${p.req30}× 30d</span>`:""}</div>
     <div class="bd"><div class="p">${eur(p.price)}${p.previous_price&&p.previous_price>p.price?` <span class="sm muted" style="text-decoration:line-through">${eur(p.previous_price)}</span>`:""}</div>
     <div class="t">${esc(p.title||"")}</div><div class="s">${esc([p.suburb,p.town].filter(Boolean).join(", "))} · ${p.bedrooms??"?"} ${t("beds.short")}${p.build?` · ${p.build} m²`:""}</div>
     <div class="s">${p.is_external?t("external"):t("own")}${p.n_enrich?` · <span style="color:#d8b4fe">${t("enriched",{n:p.n_enrich})}</span>`:""}</div>
     ${p.is_external?(()=>{const L=extLink(p.agency,p.ext_url,p.ext_ref);return L?`<a class="ext-l" href="${esc(L.href)}" target="_blank" rel="noopener" title="${esc(L.exact?t("ext.open",{a:p.agency||t("external")}):t("ext.search"))}">${L.exact?"🔗":"🔎"} ${esc(p.agency||t("external"))}${p.ext_ref?" · "+esc(p.ext_ref):""} ↗</a>`:""})():""}
     ${(p.owner_id||p.owner_wp_id)&&p.owner?`<span class="own-l" data-c="${esc(p.owner_id||p.owner_wp_id)}" title="${t("p.openowner")}">👤 ${esc(p.owner)}</span>`:""}</div></div>`).join("");
  if(reset)box.innerHTML=`<div class="sub muted sm" style="padding:8px 12px 0">${t("n.props",{n:num(r.total)})}</div><div class="pgrid" id="pgrid">${html}</div>`;
  else{box.querySelector(".more")?.remove();$("#pgrid").insertAdjacentHTML("beforeend",html)}
  prOff+=r.rows.length;
  if(prOff<r.total){box.insertAdjacentHTML("beforeend",`<div class="more"><button class="btn" id="prMore">${t("more",{n:num(r.total-prOff)})}</button></div>`);$("#prMore").onclick=()=>loadProps(false)}
}
async function openProp(id){
  id=String(id);prSel=id;$$("#prRows .pc").forEach(r=>r.classList.toggle("sel",r.dataset.p===id));
  if(!prLoaded)loadProps(true);
  const d=$("#prDetail");d.innerHTML=`<div class="loader">${t("loading.pr")}</div>`;
  try{PR=await rpc("nexus_property_by_ref",{p_ref:id})}catch(e){d.innerHTML=`<div class="empty">${esc(e.message)}</div>`;return}
  if(!PR){d.innerHTML=`<div class="empty">${t("notfound.pr")}</div>`;return}
  renderProp();
  if(innerWidth<1100)d.scrollIntoView({behavior:"smooth",block:"start"});
}
function ownerBox(o){
  if(!o)return `<div class="ownerbox" style="cursor:default;border-style:dashed"><span class="muted sm">${t("p.noowner")}</span></div>`;
  const lbl=o.is_agent?t("p.agentc"):t("p.owner");
  return `<div class="ownerbox" data-c="${esc(o.id||o.wp_id)}"><div class="ini" style="background:${hue(o.name||o.email)};width:38px;height:38px">${esc(initials(o.name||o.email))}</div>
    <div style="min-width:0"><div class="sm muted">${lbl}</div><div style="font-weight:700">${esc(o.name||o.email)}</div>
    <div class="sm muted">${[o.email,o.phone].filter(Boolean).map(esc).join(" · ")}</div></div><span class="go">${t("p.openowner")}</span></div>`}
function extBox(p,raw,L){
  const phone=raw.external_phone, mail=raw.external_email;
  return `<div class="extbox"><div style="min-width:0"><div class="sm muted">${t("ext.partner")}</div><div style="font-weight:700;font-size:calc(15px*var(--fs,1))">${esc(p.external_agency||t("external"))}</div>
    <div class="sm">${raw.external_refnr?`${t("ext.theirref")}: <b class="mono">${esc(raw.external_refnr)}</b>`:""}${phone?` · <a href="tel:${esc(String(phone).replace(/[^\d+]/g,""))}">☎ ${esc(phone)}</a>`:""}${mail?` · <a href="mailto:${esc(mail)}">✉ ${esc(mail)}</a>`:""}</div>
    ${L&&!L.exact?`<div class="sm muted" style="margin-top:3px">${t("ext.nourl")}</div>`:""}</div>
    ${L?`<a class="go-ext" href="${esc(L.href)}" target="_blank" rel="noopener">${L.exact?t("ext.open",{a:esc(p.external_agency||t("external"))}):t("ext.search")} ↗</a>`:""}</div>`}
function catSummary(k,p){
  if(!k)return "";
  if(!k.cadastral_ref)return `<div class="catbox off"><b>Catastro</b> <span class="sm muted">· ${esc(k.status==="not_found"?t("k.notfound"):k.status||"")}${k.error?" · "+esc(k.error):""}${k.checked_at?" · "+ago(k.checked_at):""}</span></div>`;
  const diff=k.build_area_m2!=null&&p.build_area?Math.round((p.build_area-k.build_area_m2)/k.build_area_m2*100):null;
  return `<div class="catbox"><div class="cat-h"><b>Catastro</b><span class="tag">${esc(k.match_quality||k.match_method||"")}</span>
      <a class="mono cat-ref" href="${esc(catUrl(k.cadastral_ref))}" target="_blank" rel="noopener" title="Sede Electrónica del Catastro">${esc(k.cadastral_ref)} ↗</a>
      <a class="sm" href="${esc(catMap(k.cadastral_ref))}" target="_blank" rel="noopener">${t("k.map")} ↗</a></div>
    <div class="facts" style="margin:10px 0 0">
      <div><b>${k.build_area_m2!=null?num(k.build_area_m2)+" m²":"—"}</b><span>${t("k.built")}${diff!=null&&Math.abs(diff)>=5?` · <span style="color:${diff>0?"#f87171":"#34d399"}">CPR ${diff>0?"+":""}${diff}%</span>`:""}</span></div>
      <div><b>${k.living_area_m2!=null?num(k.living_area_m2)+" m²":"—"}</b><span>${t("k.living.w")}</span></div>
      <div><b>${k.parcel_area_m2!=null?num(k.parcel_area_m2)+" m²":"—"}</b><span>${t("k.plot")}</span></div>
      <div><b>${k.year_built||"—"}</b><span>${t("k.year")}</span></div></div>
    <div class="sm muted" style="margin-top:8px">${[k.use_class,[k.cat_address,k.cat_postal_code,k.cat_municipality].filter(Boolean).join(", "),k.checked_at?ago(k.checked_at):""].filter(Boolean).map(esc).join(" · ")}</div></div>`}
function catElements(k){const el=Array.isArray(k&&k.elements)?k.elements:[];if(!el.length)return "";
  return `<div class="card" style="margin-bottom:12px"><div class="hd"><h3>${t("k.elements")}</h3></div><div class="scroll"><table class="mtable"><thead><tr><th>${t("k.use")}</th><th>${t("k.eltype")}</th><th>${t("k.floor")}</th><th style="text-align:right">m²</th></tr></thead><tbody>${el.map(e=>`<tr><td>${esc(e.use||"")}</td><td class="muted">${esc(e.type||"")}</td><td>${esc(e.pt??"")}</td><td style="text-align:right">${num(e.m2)}</td></tr>`).join("")}</tbody></table></div></div>`}
/* status (core) + bewerken */
const STC={available:"#22c55e",under_offer:"#ec4899",reserved:"#f43f5e",sold:"#a855f7",withdrawn:"#64748b",draft:"#f59e0b",off_market:"#475569"};
const stLabel=s=>t("cs."+s)!=="cs."+s?t("cs."+s):s;
const stBadge=s=>s&&s!=="available"?`<span class="stb" style="--sc:${STC[s]||"#64748b"}">${esc(stLabel(s))}</span>`:"";
function statusBar(p){const S=["available","under_offer","sold","withdrawn","draft"];
  return `<div class="stbar">${S.map(s=>`<button data-qs="${s}" class="${p.core_status===s?"on":""}" style="--sc:${STC[s]}">${esc(stLabel(s))}</button>`).join("")}${["off_market","reserved"].includes(p.core_status)?`<button class="on" style="--sc:${STC[p.core_status]}">${esc(stLabel(p.core_status))}</button>`:""}</div>`}
function editCtx(jump){return {sb,rpc,lang:()=>LANG,me:()=>ME,jump,onSaved:ref=>{if(String(prSel).toUpperCase()===String(ref).toUpperCase()||prSel===String(PR&&PR.property&&PR.property.wp_id))openProp(ref);loadProps(true);ovLoaded=false;mpData=null}}}
function wirePropEdit(d,p){
  const e=d.querySelector("[data-edit]");if(e)e.onclick=()=>window.NEXUS_EDIT&&NEXUS_EDIT.open(p.reference,editCtx());
  d.querySelectorAll("[data-qs]").forEach(b=>b.onclick=async()=>{const s=b.dataset.qs;if(s===p.core_status)return;
    if(!confirm(t("qs.confirm",{r:p.reference,s:stLabel(s)})))return;
    b.disabled=true;
    try{await rpc("nexus_property_save",{p_id:p.id,p_patch:{status:s},p_texts:{},p_base:p.updated_at});
      await openProp(p.reference);loadProps(true);ovLoaded=false;mpData=null;
      if(s==="sold"&&ME&&ME.role==="admin"&&confirm(t("qs.solddetails")))NEXUS_EDIT.open(p.reference,editCtx("status"));
    }catch(err){b.disabled=false;alert(err.code==="40001"?t("qs.conflict"):(err.message||String(err)));if(err.code==="40001")openProp(p.reference)}});
}
function renderProp(){
  const p=PR.property, raw=PR.raw||{}, d=$("#prDetail"), o=PR.owner, K=PR.catastro;
  const XL=p.is_external?extLink(p.external_agency,raw.external_url,raw.external_refnr):null;
  const tabs=[["kenmerken",t("st.features")],["contacten",t("st.contacts"),(PR.interested||[]).length+(o?1:0)+(PR.buyer?1:0)],["verrijking",t("st.enrich"),(PR.enrichment||[]).length+(PR.catastro&&PR.catastro.cadastral_ref?1:0)+(PR.price_m2?1:0)]];
  d.innerHTML=`<div class="dh" style="--acc:var(--c-pr)"><div style="min-width:0"><h2>${esc(p.reference)} · ${esc(p.title||"")}</h2>
     <div class="meta"><span>📍 ${esc([p.suburb,p.town,p.province].filter(Boolean).join(", "))}</span>
       ${o?`<a class="ownerlink" data-c="${esc(o.id||o.wp_id)}">👤 ${esc(o.name||o.email)}</a>`:""}
       <span>🏷 <b style="color:${REPC[p.rep]||"#94a3b8"}">${esc(rep(p.rep))}</b></span>${p.is_newbuild?`<span>${t("pb.new")}</span>`:""}</div>
     ${statusBar(p)}</div>
     <div class="acts"><a class="act-edit" data-edit="1">✎ ${t("act.pedit")}</a>${raw.url_new?`<a href="${esc(raw.url_new)}" target="_blank" rel="noopener">${t("act.site")}</a>`:raw.url?`<a href="${esc(raw.url)}" target="_blank" rel="noopener">${t("act.site")}</a>`:""}${p.wp_id?`<a href="https://gruposoltura.com/wp-admin/post.php?post=${p.wp_id}&action=edit" target="_blank" rel="noopener" title="${esc(t("act.cprold"))}">CPR ↗</a>`:""}${p.is_external&&XL?`<a class="act-ext" href="${esc(XL.href)}" target="_blank" rel="noopener">${XL.exact?t("ext.open",{a:esc(p.external_agency||t("external"))}):t("ext.search")} ↗</a>`:""}</div></div>
   <div class="subtabs" style="--acc:var(--c-pr)">${tabs.map(x=>`<button class="st ${prSub===x[0]?"on":""}" data-s="${x[0]}">${x[1]}${x[2]!=null?`<span class="cnt">${x[2]}</span>`:""}</button>`).join("")}</div>
   <div class="dbody scroll" id="prBody"></div>`;
  d.querySelectorAll(".st").forEach(b=>b.onclick=()=>{prSub=b.dataset.s;renderProp()});
  wirePropEdit(d,p);
  const B=$("#prBody"), m=PR.matches||{};
  if(prSub==="kenmerken")B.innerHTML=`<div class="hero" style="${raw.image?`background-image:url('${esc(raw.image)}')`:""}"><span class="pr">${eur(p.price)}</span></div>
    ${p.is_external?extBox(p,raw,XL):""}
    ${ownerBox(o)}
    ${catSummary(K,p)}
    <div class="facts"><div><b>${p.bedrooms??"—"}</b><span>${t("fa.beds")}</span></div><div><b>${p.bathrooms??"—"}</b><span>${t("fa.baths")}</span></div><div><b>${p.build_area?num(p.build_area)+" m²":"—"}</b><span>${t("fa.build")}</span></div><div><b>${p.plot_area?num(p.plot_area)+" m²":"—"}</b><span>${t("fa.plot")}</span></div>
      <div><b>${num(raw.hits_total)}</b><span>${t("fa.hits")}</span></div><div><b>${raw.hits_today??"—"}</b><span>${t("fa.today")}</span></div><div><b>${num(m.sent||0)}</b><span>${t("fa.mailed")}</span></div><div><b>${num(m.converted||0)}</b><span>${t("fa.conv")}</span></div></div>
    <div class="card">${kv([[t("p.type"),p.property_type],[t("p.newbuild"),p.is_newbuild?t("yes"):null],[t("p.year"),raw.year_built&&raw.year_built!=="0"?raw.year_built:null],[t("p.energy"),raw.energy_label],[t("p.view"),raw.view],[t("p.orient"),raw.orientation],[t("p.pool"),raw.pool],[t("p.sea"),raw.distance_sea?num(raw.distance_sea)+" m":null],[t("p.address"),[raw.street,raw.postal_code].filter(Boolean).join(", ")],[t("p.keys"),raw.keydetails],[t("p.mandate"),raw.authority],[t("p.offeredby"),p.is_external?(p.external_agency||t("external"))+(raw.external_refnr?" · "+raw.external_refnr:""):t("p.owngs")],[t("p.srccontact"),[raw.external_phone,raw.external_email].filter(Boolean).join(" · ")],[t("p.prevprice"),p.previous_price&&p.previous_price!=p.price?eur(p.previous_price)+" ("+fdate(p.price_changedate)+")":null],[t("p.notary"),raw.sold_notary],[t("p.costs"),[raw.fee_notary&&t("c.notary")+" "+eur(raw.fee_notary),raw.fee_registry&&t("c.registry")+" "+eur(raw.fee_registry),raw.fee_legal&&t("c.legal")+" "+eur(raw.fee_legal)].filter(Boolean).join(" · ")],[t("p.listed"),p.list_date?fdate(p.list_date):null]])}</div>
    ${raw.changelog?`<div class="card" style="margin-top:12px"><div class="hd"><h3>${t("h.changelog")}</h3></div><div class="note">${esc(raw.changelog.replace(/<br\s*\/?>/gi,"\n"))}</div></div>`:""}`;
  if(prSub==="contacten"){const one=(x,w,rc)=>x?`<div class="rel" data-c="${esc(x.id||x.wp_id)}"><div class="ini" style="background:${hue(x.name)};width:32px;height:32px;font-size:calc(12px*var(--fs,1))">${esc(initials(x.name||x.email))}</div><div style="min-width:0"><div style="font-weight:600">${esc(x.name||x.email)}</div><div class="sm">${roleTag(rc)} <span class="muted">${esc(w)}</span></div></div></div>`:"";
    const it=PR.interested||[], vw=PR.viewings||[];
    B.innerHTML=`<div style="display:flex;flex-direction:column;gap:8px">${one(o,o&&o.is_agent?t("o.agent"):t("o.owner"),o&&o.is_agent?"agent":"seller")}${one(PR.buyer,t("o.buyer"),"buyer")}</div>
      ${vw.length?`<div class="hd" style="padding:16px 0 8px"><h3>${t("h.viewings",{n:vw.length})}</h3></div>${vw.map(v=>`<div class="sm" style="padding:4px 0">${fdate(v.date)} ${esc(v.time||"")} · ${esc(v.client||"")} · <span class="muted">${esc(v.agent||"")}</span></div>`).join("")}`:""}
      <div class="hd" style="padding:16px 0 8px"><h3>${t("h.interested",{n:it.length})}</h3></div>
      ${it.length?`<div style="display:flex;flex-direction:column;gap:6px">${it.map(x=>`<div class="rel" data-c="${esc(x.id||x.wp_id)}"><div class="ini" style="background:${hue(x.name||x.email)};width:30px;height:30px;font-size:calc(11px*var(--fs,1))">${esc(initials(x.name||x.email))}</div><div style="min-width:0;flex:1"><div style="font-weight:600">${esc(x.name||x.email)}</div><div class="sm muted">${x.n}× · ${esc((x.types||[]).join(", "))}</div></div><span class="sm muted">${ago(x.last)}</span></div>`).join("")}</div>`:`<div class="empty sm">${t("norequests")}</div>`}`}
  if(prSub==="verrijking"){const k=PR.catastro, pm=PR.price_m2;
    const kc=k&&k.cadastral_ref?`<div class="card" style="margin-bottom:12px"><div class="hd"><h3>Catastro</h3><span class="tag">${esc(k.match_quality||k.match_method||"")} · ${ago(k.checked_at)}</span></div>${kv([[t("k.cadref"),`<a class="mono" href="${esc(catUrl(k.cadastral_ref))}" target="_blank" rel="noopener">${esc(k.cadastral_ref)} ↗</a>`,1],[t("k.parcel"),k.parcel_ref],[t("k.unit"),[k.cat_block&&"bl. "+k.cat_block,k.cat_stair&&"esc. "+k.cat_stair,k.cat_floor&&"pl. "+k.cat_floor,k.cat_door&&"pta. "+k.cat_door].filter(Boolean).join(" · ")],[t("k.landclass"),k.land_class],[t("k.share"),k.participation_pct!=null?k.participation_pct+" %":null],[t("k.cataddr"),[k.cat_address,k.cat_postal_code,k.cat_municipality].filter(Boolean).join(", ")],[t("k.use"),k.use_class],[t("k.year"),k.year_built],[t("k.built"),k.build_area_m2!=null?num(k.build_area_m2)+" m²"+(p.build_area?` <span class="sm muted">(CPR: ${num(p.build_area)} m²)</span>`:""):null,1],[t("k.living"),[k.living_area_m2&&num(k.living_area_m2)+" m² "+t("k.living.w"),k.terrace_area_m2&&num(k.terrace_area_m2)+" m² "+t("k.living.t"),k.pool_area_m2&&num(k.pool_area_m2)+" m² "+t("k.living.p")].filter(Boolean).join(" · ")],[t("k.plot"),k.parcel_area_m2!=null?num(k.parcel_area_m2)+" m²":null],[t("k.building"),k.building_dwellings?t("k.dwellings",{a:k.building_dwellings,b:k.building_floors_above||"?"}):null]].map(x=>x[2]?x:[x[0],x[1]]))}</div>`
      :(k?`<div class="card" style="margin-bottom:12px"><div class="hd"><h3>Catastro</h3><span class="tag">${esc(k.status||t("k.notfound"))}</span></div><div class="note">${esc(k.error||t("k.nomatch"))}</div></div>`:"");
    const pc=pm?`<div class="card" style="margin-bottom:12px"><div class="hd"><h3>${t("m.title")}</h3><span class="tag">${esc(pm.town||"")} · ${esc(pm.segment||"")}</span></div>
      <div class="facts" style="padding:12px 14px 0"><div><b>${eur(pm.ask_m2_cat||pm.ask_m2_wp)}</b><span>${t("m.ask")}</span></div><div><b>${eur(pm.market_median_m2)}</b><span>${t("m.median")}</span></div><div><b style="color:${pm.deviation_pct>10?"#f87171":pm.deviation_pct<-10?"#34d399":"inherit"}">${pm.deviation_pct!=null?(pm.deviation_pct>0?"+":"")+Number(pm.deviation_pct).toFixed(1)+"%":"—"}</b><span>${t("m.dev")}</span></div><div><b>${num(pm.market_n)}</b><span>${t("m.n")}</span></div></div>
      <div class="sm muted" style="padding:0 14px 12px">${t("m.range",{a:eur(pm.market_p25_m2),b:eur(pm.market_p75_m2),c:esc(pm.market_basis||""),d:fdate(pm.period)})}</div></div>`:"";
    B.innerHTML=kc+catElements(k)+pc+((PR.enrichment||[]).length||(!kc&&!pc)?enrichList(PR.enrichment,"property"):"");}
}

/* ================= MAP ================= */
/* Eigen woningen: CPR-coördinaten, anders Catastro-geocode (benadering). Externe woningen: alleen opgeslagen coördinaten.
   Alles wordt één keer geladen (nexus_map('all')); het filter Eigen/Extern/Alles werkt in de browser. */
const MPC={own:"#22c55e",ext:"#3b82f6"};
let mpData=null, mpMap=null, mpLayer=null, mpMarkers={}, mpHideT=null, mpFitted={};
let mpScope=(()=>{try{return localStorage.getItem("nexus-mp-scope")||"own"}catch(e){return"own"}})();
if(!["own","external","all"].includes(mpScope))mpScope="own";
const gPin=(lat,lng)=>`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
async function copyTxt(txt){
  try{await navigator.clipboard.writeText(txt);return true}catch(e){
    const ta=document.createElement("textarea");ta.value=txt;ta.style.cssText="position:fixed;opacity:0";document.body.appendChild(ta);ta.select();
    let ok=false;try{ok=document.execCommand("copy")}catch(_){}ta.remove();return ok}}
function buildMpSeg(){const S=[["own","mp.s.own"],["external","mp.s.ext"],["all","mp.s.all"]];
  $("#mpScope").innerHTML=S.map(x=>`<button data-v="${x[0]}" class="${mpScope===x[0]?"on":""}">${t(x[1])}</button>`).join("");
  $$("#mpScope button").forEach(b=>b.onclick=()=>{mpScope=b.dataset.v;try{localStorage.setItem("nexus-mp-scope",mpScope)}catch(e){}buildMpSeg();if(mpData)renderMap(true)})}
function mpCompact(){if(mpMap)mpMap.getContainer().classList.toggle("mp-compact",mpMap.getZoom()<14)}
async function loadMap(){
  buildMpSeg();
  if(!window.L){$("#mpList").innerHTML=`<div class="empty">${t("mp.noleaflet")}</div>`;return}
  if(!mpMap){
    mpMap=L.map("mpMap",{zoomControl:true,attributionControl:true}).setView([38.07,-0.72],12);
    const street=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'});
    const sat=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,attribution:"Imagery &copy; Esri"});
    street.addTo(mpMap);
    mpMap._lc=L.control.layers({[t("mp.street")]:street,[t("mp.sat")]:sat},null,{position:"topright"}).addTo(mpMap);
    mpLayer=L.layerGroup().addTo(mpMap);
    mpMap.on("popupopen",e=>wirePopup(e.popup));
    mpMap.on("zoomend",mpCompact);mpCompact();
  }
  setTimeout(()=>mpMap.invalidateSize(),60);
  if(mpData)return;
  $("#mpList").innerHTML=`<div class="loader">${t("loading")}</div>`;
  try{mpData=await rpc("nexus_map",{p_scope:"all"})}catch(e){$("#mpList").innerHTML=`<div class="empty">${esc(e.message)}</div>`;return}
  renderMap(true);
}
function popupHtml(p){
  const who=p.is_own?`<span style="color:${MPC.own}">● ${t("mp.own")}</span>`:`<span style="color:${MPC.ext}">● ${esc(p.agency||t("external"))}</span>${p.ext_ref?` · <span class="mono">${esc(p.ext_ref)}</span>`:""}`;
  return `<div class="mpp">${p.image?`<div class="im" style="background-image:url('${esc(p.image)}')"></div>`:""}<div class="bd">
    <div class="rf">${esc(p.reference)} · <span class="muted">${esc([p.suburb,p.town].filter(Boolean).join(", "))}</span></div>
    <div class="pr">${eur(p.price)}${p.under_offer?` <span class="sm" style="color:var(--c-ac)">· ${t("underoffer")}</span>`:""}</div>
    <div class="sm">${who}</div>
    <div class="ll">${p.lat}, ${p.lng}</div><div class="sm muted">${t("mp.src."+p.src)}</div>
    <div class="btns"><button class="pri" data-cp="link">📍 ${t("mp.copylink")}</button>
      <div class="row2"><button data-cp="coord">${t("mp.copycoord")}</button><a class="b" href="${esc(gPin(p.lat,p.lng))}" target="_blank" rel="noopener">${t("mp.gmaps")}</a></div>
      <button data-open="${esc(p.reference)}">${t("mp.open")}</button></div></div></div>`}
function wirePopup(pp){
  const el=pp.getElement(), p=pp._nx;if(!el||!p)return;
  el.onmouseenter=()=>clearTimeout(mpHideT);
  el.onmouseleave=()=>{if(pp._hover)mpHideT=setTimeout(()=>mpMap.closePopup(pp),350)};
  el.querySelectorAll("[data-cp]").forEach(b=>b.onclick=async ev=>{ev.preventDefault();ev.stopPropagation();
    const txt=b.dataset.cp==="link"?gPin(p.lat,p.lng):`${p.lat}, ${p.lng}`, orig=b.innerHTML;
    const ok=await copyTxt(txt);b.innerHTML=ok?t("mp.copied"):t("mp.copyfail");b.classList.toggle("ok",ok);
    pp._hover=false;setTimeout(()=>{b.innerHTML=orig;b.classList.remove("ok")},1600)});
  const o=el.querySelector("[data-open]");if(o)o.onclick=ev=>{ev.stopPropagation();go.p(o.dataset.open)};
}
function renderMap(fit){
  const all=mpData.rows||[];
  const rows=all.filter(r=>mpScope==="all"||(mpScope==="own"?r.is_own:!r.is_own));
  const on=rows.filter(r=>r.lat!=null), off=rows.filter(r=>r.lat==null);
  $("#cntMp").textContent=num(all.filter(r=>r.is_own&&r.lat!=null).length);
  $("#mpCount").textContent=t("mp.onmap",{a:num(on.length),b:num(rows.length)});
  $("#mpTitle").textContent=t("mp.title."+mpScope);
  if(mpMap&&mpLayer){
    mpLayer.clearLayers();mpMarkers={};
    on.forEach(p=>{
      const c=p.is_own?MPC.own:MPC.ext;
      const icon=L.divIcon({className:"",iconSize:null,iconAnchor:[0,0],
        html:`<div class="mp-pin ${p.is_own?"own":"ext"} ${p.src==="catastro"?"approx":""}" style="--pc:${c};transform:translate(-50%,-100%)"><b>${esc(p.reference)}${p.under_offer?'<s title="'+esc(t("underoffer"))+'"></s>':""}</b><i></i></div>`});
      const m=L.marker([p.lat,p.lng],{icon,title:p.reference,riseOnHover:true,zIndexOffset:p.is_own?1000:0}).addTo(mpLayer);
      const pp=L.popup({offset:[0,-26],autoPan:true,closeButton:true,maxWidth:280,minWidth:260}).setContent(popupHtml(p));pp._nx=p;
      m.bindPopup(pp);
      m.on("mouseover",()=>{clearTimeout(mpHideT);pp._hover=true;if(!m.isPopupOpen())m.openPopup()});
      m.on("mouseout",()=>{if(pp._hover)mpHideT=setTimeout(()=>{if(pp._hover)mpMap.closePopup(pp)},350)});
      m.on("click",()=>{pp._hover=false;clearTimeout(mpHideT);m.openPopup()});
      mpMarkers[p.reference]=m;
    });
    if(fit&&on.length)mpMap.fitBounds(L.latLngBounds(on.map(p=>[p.lat,p.lng])).pad(0.15),{maxZoom:15});
  }
  const sub=p=>esc(p.is_own?[p.suburb,p.town].filter(Boolean).join(", "):[p.agency,p.town].filter(Boolean).join(" · "));
  const it=(p,extra,attr)=>`<div class="mp-it" ${attr}><div class="th" style="${p.image?`background-image:url('${esc(p.image)}')`:""}"></div>
    <div style="min-width:0"><div class="t"><span class="dot" style="background:${p.is_own?MPC.own:MPC.ext}"></span>${esc(p.reference)} · ${eur(p.price)}</div><div class="d">${extra}</div></div><span class="sm" style="color:var(--c-ac)">${p.under_offer?"●":""}</span></div>`;
  const onOwn=on.filter(p=>p.is_own), onExt=on.filter(p=>!p.is_own);
  const sec=(lbl,list)=>list.length?`<div class="mp-sec">${lbl}</div>`+list.map(p=>it(p,sub(p)+(p.src==="catastro"?" · ≈":""),`data-fly="${esc(p.reference)}"`)).join(""):"";
  $("#mpList").innerHTML=(rows.length?"":`<div class="empty">${t("mp.none")}</div>`)
    +sec(t("mp.located.own",{n:onOwn.length}),onOwn)+sec(t("mp.located.ext",{n:onExt.length}),onExt)
    +(off.length?`<div class="mp-sec">${t("mp.nolocation",{n:off.length})}</div><div class="sm muted" style="padding:8px 12px">${t("mp.nolocation.s")}</div>`
      +off.map(p=>it(p,p.is_own?esc([p.street||p.cat_address,p.suburb,p.town].filter(Boolean).join(", ")):sub(p),`data-p="${esc(p.reference)}"`)).join(""):"");
  $$("#mpList [data-fly]").forEach(r=>r.onclick=()=>{const m=mpMarkers[r.dataset.fly];if(!m)return;
    mpMap.flyTo(m.getLatLng(),Math.max(mpMap.getZoom(),16),{duration:.6});setTimeout(()=>{m.getPopup()._hover=false;m.openPopup()},650)});
}

/* ================= ACTIVITEIT ================= */
async function loadActivity(){
  const p=$("#p-ac");if(!OV){p.innerHTML=`<div class="loader">${t("loading")}</div>`;try{OV=await rpc("nexus_overview")}catch(e){p.innerHTML=`<div class="empty">${esc(e.message)}</div>`;return}}
  p.innerHTML=`<div class="split" style="grid-template-columns:1fr 1fr">
    <div class="card list"><div class="hd"><h3>${t("ac.req")}</h3><span class="sm muted">${t("ac.7d",{n:num(OV.requests_7d)})}</span></div><div class="rows scroll feed">${feedHtml(OV.activity)}</div></div>
    <div class="card list"><div class="hd"><h3>${t("ac.view")}</h3><span class="sm muted">${t("ac.planned",{n:num(OV.viewings_upcoming)})}</span></div><div class="rows scroll feed">${viewingsHtml(OV.viewings)}
    <div class="hd" style="border-top:1px solid var(--line)"><h3>${t("ov.notaries")}</h3></div>${notariesHtml(OV.notaries)}
    <div class="hd" style="border-top:1px solid var(--line)"><h3>${t("ac.types")}</h3></div><div style="padding:12px 14px;display:flex;flex-wrap:wrap;gap:6px">${(OV.req_types_30d||[]).map(x=>`<span class="tag">${esc(x.t)} · ${x.n}</span>`).join("")}</div></div></div></div>`;
}

})();
