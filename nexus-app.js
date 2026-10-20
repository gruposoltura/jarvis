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
  if(window.NEXUS_FEEDS&&curTab==="xm")NEXUS_FEEDS.rerender();
  if(window.NEXUS_REPORTS&&curTab==="rp")NEXUS_REPORTS.rerender();
  if(window.NEXUS_VIEWINGS&&curTab==="vw")NEXUS_VIEWINGS.rerender();
}

const eur=v=>v==null||v===""?"—":"€ "+Number(v).toLocaleString(LOC(),{maximumFractionDigits:0});
const num=v=>v==null?"—":Number(v).toLocaleString(LOC());
const ROLE={suspect:["Suspect","--r-suspect"],prospect:["Prospect","--r-prospect"],seller:["Seller","--r-seller"],buyer:["Buyer","--r-buyer"],agent:["Agent","--r-agent"],"suspect-seller":["Suspect-Seller","--r-suspect-seller"]};
const roleTag=r=>{const x=ROLE[r]||[r,"--tx3"];return `<span class="role" style="--rc:var(${x[1]})">${esc(x[0])}</span>`};
const REPC={Rick:"#f97316",Marco:"#3b82f6",Ingrid:"#a855f7",Lisette:"#ec4899",Kantoor:"#475569"};
const rep=r=>r==="Kantoor"?t("Kantoor"):r;
function ago(ts){if(!ts)return"";const d=(Date.now()-new Date(ts))/1000;if(d<0){return NEXUS_DMY(ts)}
  const en=LANG==="en";
  if(d<3600)return Math.max(1,Math.round(d/60))+" min";if(d<86400)return Math.round(d/3600)+(en?" h":" u");if(d<86400*30)return Math.round(d/86400)+" d";
  return NEXUS_DMY(ts)}
function fdate(ts){return ts?NEXUS_DMY(ts):"—"}   /* overal DD/MM/YYYY (Rick 20-10) */
function initials(n){n=(n||"?").trim();const p=n.split(/\s+/);return ((p[0]||"")[0]||"?").toUpperCase()+((p.length>1?p[p.length-1][0]:"")||"").toUpperCase()}
function hue(s){let h=0;for(const c of String(s||""))h=(h*31+c.charCodeAt(0))%360;return `hsl(${h} 55% 42%)`}
/* serverteksten (NL) vertalen */
function why(s){if(!s)return"";let m;
  if((m=s.match(/^koper van (.+)$/)))return t("why.buyer",{r:m[1]});
  if((m=s.match(/^verkoper van (.+)$/)))return t("why.seller",{r:m[1]});
  if((m=s.match(/^eigenaar van (.+)$/)))return t("why.owner",{r:m[1]});
  if((m=s.match(/^aanbieder van (.+)$/)))return t("why.offerer",{r:m[1]});
  if(s==="zelfde adres/telefoon")return t("why.household");if(s==="partner")return t("why.partner");return s}
const relT=r=>r==="koper"?t("rel.koper"):r==="eigenaar"?t("rel.eigenaar"):r==="aanbiedend makelaar"?t("rel.agent"):r==="mede-eigenaar (partner)"?t("rel.coowner"):r==="mede-koper (partner)"?t("rel.cobuyer"):r;
/* leesbare formuliernamen (core.request_forms via nexus2_request_forms); onbekende sleutel blijft zichtbaar */
let RF={};const rq=k=>{const f=RF[k];return f?(LANG==="en"?f.en:f.nl)||k:k};
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
$("#fNewPass").onsubmit=async e=>{e.preventDefault();const pw=$("#npPass").value;
  if(MUST_PW&&pw==="soltura2026")return lgMsg("msg.samepw");
  const {error}=await sb.auth.updateUser({password:pw});
  if(error)return lgMsg(error.message,false,true);
  if(MUST_PW){try{await sb.rpc("nexus_password_changed")}catch(e){}MUST_PW=false;booted=false;await sb.auth.refreshSession();}
  lgMsg("msg.saved",true);history.replaceState(null,"",location.pathname);
  if(booted){$("#login").classList.add("hidden");$("#app").classList.remove("hidden");route()}else boot()};
$("#logout").onclick=async()=>{await sb.auth.signOut();location.hash="";location.reload()};
function noAccess(){$("#app").classList.add("hidden");$("#login").classList.remove("hidden");showForm("login");
  lgMsg("msg.noaccess");sb.auth.signOut()}

let ME=null, booted=false, MUST_PW=false;
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
  try{(await rpc("nexus2_request_forms")||[]).forEach(f=>{RF[f.key]=f})}catch(e){}
  /* Tijdelijk wachtwoord: eerst verplicht wijzigen, pas daarna de app */
  if(ME.must_change_pw){MUST_PW=true;booted=false;$("#app").classList.add("hidden");$("#login").classList.remove("hidden");
    showForm("newpass");lgMsg("msg.mustchange");return}
  if(ME.lang&&ME.lang!==LANG){LANG=ME.lang;try{localStorage.setItem("nexus-lang",LANG)}catch(e){}applyStatic()}
  $("#login").classList.add("hidden");$("#app").classList.remove("hidden");
  $("#meName").textContent=ME.display_name;const av=$("#meAv");av.textContent=initials(ME.display_name);av.style.background=ME.color||"#14b8a6";
  buildRoleChips();buildStatusChips();buildBuildSeg();
  /* Admin (invoerschermen, nog niet gekoppeld): voorlopig alleen voor de rol admin */
  $("#tabAd").classList.toggle("hidden",ME.role!=="admin");
  $("#tabRp").classList.toggle("hidden",ME.role!=="admin");
  $("#prNew").classList.toggle("hidden",ME.role!=="admin");
  $("#ctNew").classList.toggle("hidden",ME.role!=="admin");
  route();
}

/* ================= TABS / ROUTING ================= */
const TABC={ov:"--c-ov",ct:"--c-ct",pr:"--c-pr",mp:"--c-mp",ac:"--c-ac",xm:"--c-xm",ad:"--c-ad",rp:"--c-rp",vw:"--c-vw"};
let curTab="ov";
function setTab(t_){curTab=t_;$$(".tab").forEach(b=>b.classList.toggle("on",b.dataset.tab===t_));
  $$(".pane").forEach(p=>p.classList.toggle("hidden",p.id!=="p-"+t_));
  document.documentElement.style.setProperty("--acc",`var(${TABC[t_]})`);
  if(t_==="ov"&&!ovLoaded)loadOverview();
  if(t_==="ct"&&!ctLoaded)loadContacts(true);
  if(t_==="pr"&&!prLoaded)loadProps(true);
  if(t_==="mp")loadMap();
  if(t_==="ac")loadActivity();
  if(t_==="xm"&&window.NEXUS_FEEDS)NEXUS_FEEDS.open($("#p-xm"),{rpc,t,sb,lang:()=>LANG,me:()=>ME,esc});
  if(t_==="ad"&&window.NEXUS_ADMIN)NEXUS_ADMIN.open($("#p-ad"),{sb,rpc,t,lang:()=>LANG,me:()=>ME,esc});
  if(t_==="vw"&&window.NEXUS_VIEWINGS)NEXUS_VIEWINGS.open($("#p-vw"),{rpc,t,lang:()=>LANG,me:()=>ME,esc});
  if(t_==="rp"&&window.NEXUS_REPORTS)NEXUS_REPORTS.open($("#p-rp"),{rpc,t,lang:()=>LANG,me:()=>ME,esc});
}
$$(".tab").forEach(b=>b.onclick=()=>{location.hash=b.dataset.tab});
window.addEventListener("hashchange",route);
function route(){
  if(!booted)return;const h=location.hash.replace(/^#/,"");
  let m;
  if((m=h.match(/^c\/([^/?#]+)/))){setTab("ct");openContact(decodeURIComponent(m[1]));return}
  if((m=h.match(/^p\/([^/?#]+)/))){setTab("pr");applyPrFocus();openProp(decodeURIComponent(m[1]));return}
  prFocus=false;applyPrFocus();
  if(h==="pr"&&prListY!=null){const y=prListY;requestAnimationFrame(()=>{const r=$("#prRows");if(r)r.scrollTop=y})}
  if((h==="ad"||h==="rp")&&ME.role!=="admin")return setTab("ov");
  setTab(TABC[h]?h:"ov");
}
/* Zelfde hash opnieuw zetten vuurt geen hashchange (bv. lijst staat nog op #p/RH400 en je klikt RH400 weer aan):
   dan zelf routeren, anders lijkt de kaart niet klikbaar. */
function goHash(h){if(location.hash.replace(/^#/,"")===h)route();else location.hash=h}
const go={c:id=>goHash("c/"+id),p:id=>goHash("p/"+encodeURIComponent(id))};
/* + Nieuw contact (rechtsboven in Contacten): naar Admin, workflow "Nieuw contact" */
function newContact(){location.hash="ad";setTimeout(()=>{if(window.NEXUS_ADMIN&&NEXUS_ADMIN.startNewContact)NEXUS_ADMIN.startNewContact()},0)}
document.addEventListener("click",e=>{if(e.target.closest("[data-newct]")){e.preventDefault();e.stopPropagation();newContact()}},true);
/* + Nieuwe woning (Woningen-tab) en + Woning toevoegen (contact → Woningen): naar Admin, flow "Woning toevoegen".
   Vanuit een contact staat dat contact meteen als eigenaar ingevuld; nexus_admin_submit koppelt het als 'owner'. */
function newProp(owner){location.hash="ad";setTimeout(()=>{if(window.NEXUS_ADMIN&&NEXUS_ADMIN.startNewProperty)NEXUS_ADMIN.startNewProperty(owner||null)},0)}
function ctOwner(){if(!CT)return null;const c=CT.contact||{},o=CT.core||{};if(!o.id)return null;
  return {id:o.id,wp_id:c.wp_id||"",name:c.full_name||o.full_name||c.email,email:c.email||o.email,city:o.city||"",roles:(c.roles||[]).map(x=>String(x).replace("_","-"))}}
document.addEventListener("click",e=>{const b=e.target.closest("[data-newpr]");if(!b)return;e.preventDefault();e.stopPropagation();
  newProp(b.dataset.newpr==="ct"?ctOwner():null)},true);
/* Woning openen van buiten de woningenlijst (vanuit een contact, overzicht, activiteit of directe link):
   volledig scherm met alle details en een terugknop. Vanuit de lijst zelf blijft het de gesplitste weergave. */
let prFocus=true, prFrom=null, prListY=null;
function applyPrFocus(){
  const ps=$("#p-pr .psplit"), fb=$("#prFocus"); if(!ps||!fb)return;
  ps.classList.toggle("focus",prFocus); fb.classList.toggle("hidden",!prFocus);
  $("#prBackLbl").textContent=prFrom&&prFrom.list?t("back.list"):prFrom&&prFrom.name?t("back.to",{n:prFrom.name}):t("back");
  $("#prAll").classList.toggle("hidden",!!(prFrom&&prFrom.list));
  $("#prAll").textContent=t("pr.all");
}
$("#prBack").onclick=()=>{if(prFrom&&prFrom.list){const y=prFrom.scroll||0;prFrom=null;location.hash="pr";requestAnimationFrame(()=>{const r=$("#prRows");if(r)r.scrollTop=y});return}
  if(prFrom&&prFrom.hash)location.hash=prFrom.hash;else if(history.length>1)history.back();else location.hash="pr"};
$("#prAll").onclick=()=>{prFocus=false;prFrom=null;applyPrFocus();if(/^#?p\//.test(location.hash))history.replaceState(null,"","#pr");if(!prLoaded)loadProps(true)};
/* data-c wint van data-p: zo opent de eigenaar-link op een woningkaart het contact, niet de woning */
document.addEventListener("click",e=>{if(e.target.closest("a[href]"))return;
  const del=e.target.closest("[data-del-id]");if(del){e.stopPropagation();e.preventDefault();delActivity(del.dataset.delK,del.dataset.delId);return}
  const c=e.target.closest("[data-c]"), p=e.target.closest("[data-p]");
  if(c&&(!p||p.contains(c))){e.stopPropagation();go.c(c.dataset.c);return}
  if(p){
    /* een woning opent altijd volledig scherm; vanuit de lijst onthouden we de scrollpositie voor 'Terug' */
    const fromList=!!p.closest("#prRows");
    prFocus=true;
    if(fromList){const rows=$("#prRows");prListY=rows?rows.scrollTop:0;prFrom={list:true,hash:"pr",scroll:prListY}}
    else if(curTab!=="pr")prFrom=curTab==="ct"&&CT&&CT.contact?{name:CT.contact.full_name||CT.contact.email,hash:location.hash.replace(/^#/,"")}:{hash:location.hash.replace(/^#/,"")||curTab};
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
   <div class="card ov-web" id="ovWeb"><div class="loader sm">${L2("Websitecijfers laden…","Loading website figures…")}</div></div>
   <div class="card ov-roles"><div class="hd"><h3>${t("ov.roles")}</h3><span class="sm muted">${t("ov.clickfilter")}</span></div>
     <div class="scroll" style="flex:1;padding:6px 0">${order.map(r=>`<div class="rolebar" data-role="${r}" style="--rc:var(${(ROLE[r]||[])[1]})">
       <span>${roleTag(r)}</span><div class="bar"><span style="width:${((roles[r]||0)/maxR*100).toFixed(1)}%"></span></div><span class="n">${num(roles[r]||0)}</span></div>`).join("")}
     <div class="hd" style="border-top:1px solid var(--line);margin-top:6px"><h3>${t("ov.req30")}</h3><span class="sm muted">${t("ov.max",{n:mx})}</span></div>
     <div class="spark"><svg viewBox="0 0 300 70" preserveAspectRatio="none"><defs><linearGradient id="sg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ec4899" stop-opacity=".45"/><stop offset="1" stop-color="#ec4899" stop-opacity="0"/></linearGradient></defs>
       <polygon points="0,70 ${pts} 300,70" fill="url(#sg)"/><polyline points="${pts}" fill="none" stroke="#ec4899" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
       <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${(o.req_types_30d||[]).map(x=>`<span class="tag">${esc(rq(x.t))} · ${x.n}</span>`).join("")}</div></div>
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
  loadSiteStrip();
}
/* ---------- websitecijfers op Overzicht: eigen meting (web_events) + formulieren (core.requests) + GA4 (kpi_daily) ---------- */
let SITE=null, siteDays=(()=>{try{return +localStorage.getItem("nexus-site-days")||7}catch(e){return 7}})();
async function loadSiteStrip(force){
  const box=$("#ovWeb");if(!box)return;
  if(!SITE||force||SITE.days!==siteDays){try{SITE=await rpc("nexus_site_overview",{p_days:siteDays})}catch(e){box.innerHTML=`<div class="empty sm">${esc(e.message)}</div>`;return}}
  renderSiteStrip();
}
function renderSiteStrip(){
  const box=$("#ovWeb");if(!box||!SITE)return;
  const S=SITE, c=S.cur||{}, pv=S.prev||{}, dl=S.daily||[], gl=S.ga_last||{}, oy=S.own_yesterday||{};
  const mmss=v=>v==null?"—":`${Math.floor(v/60)}:${String(Math.round(v%60)).padStart(2,"0")}`;
  const dlt=(a,b)=>{if(!b||a==null)return"";const x=Math.round((a-b)/b*100);if(!isFinite(x)||x===0)return"";return ` <span class="dl ${x>0?"up":"dn"}">${x>0?"▲":"▼"} ${Math.abs(x)}%</span>`};
  const bars=(k,col)=>{const v=dl.map(x=>x[k]==null?null:+x[k]), mx=Math.max(1,...v.filter(x=>x!=null));
    return `<div class="wb-bars" style="--bc:${col}">${dl.map((x,i)=>`<i title="${fdate(x.day)}: ${v[i]==null?"—":k==="ga_dur"?mmss(v[i]):num(v[i])}" style="height:${v[i]==null?0:Math.max(4,v[i]/mx*100)}%" class="${v[i]==null?"na":""}"></i>`).join("")}</div>`};
  const tile=(lab,val,sub,k,col,go)=>`<div class="wb-t" ${go?`data-go="${go}"`:""} style="--bc:${col}"><div class="l">${lab}</div><div class="v">${val}</div><div class="s">${sub}</div>${bars(k,col)}</div>`;
  const per=L2(`${S.days} d`,`${S.days} d`), gaGap=(c.ga_days||0)<S.days;
  box.innerHTML=`<div class="hd"><h3>${L2("Website","Website")} · <span class="muted" style="font-weight:500">${L2("laatste","last")} ${S.days} ${L2("dagen","days")}</span></h3>
     <div class="seg sm" id="wbDays">${[7,30].map(n=>`<button data-n="${n}" class="${S.days===n?"on":""}">${n} d</button>`).join("")}</div></div>
   <div class="wb-grid">
    ${tile(L2("Bezoekers gisteren","Visitors yesterday")+" <span class='src'>GA4</span>",num(gl.users),`${gl.day?fdate(gl.day)+" · ":""}${L2("eigen meting","own")}: ${num(oy.visitors||0)}`,"ga_users","#3b82f6")}
    ${tile(L2("Bezoekers","Visitors")+` ${per} <span class='src'>GA4</span>`,num(c.ga_users)+dlt(c.ga_days?c.ga_users/c.ga_days:null,pv.ga_days?pv.ga_users/pv.ga_days:null),`${num(c.ga_sessions)} ${L2("sessies","sessions")} · ${L2("eigen","own")}: ${num(c.visitors)}`,"ga_users","#3b82f6")}
    ${tile(L2("Gem. tijd per bezoek","Avg. time per visit")+" <span class='src'>GA4</span>",mmss(c.ga_dur)+dlt(c.ga_dur,pv.ga_dur),`${L2("gisteren","yesterday")}: ${mmss(gl.dur)}`,"ga_dur","#06b6d4")}
    ${tile(L2("Startpagina","Home page"),num(c.home),L2("bezoeken (sessies)","visits (sessions)"),"home","#22c55e")}
    ${tile(L2("Woningpagina's","Property pages"),num(c.prop_views),`${L2("bekeken in","viewed in")} ${num(c.prop_sessions)} ${L2("sessies","sessions")}`,"prop_views","#f59e0b","pr")}
    ${tile(L2("Zoekopdrachten","Searches"),num(c.searches),L2("ingetypt op de site","typed on the site"),"searches","#a855f7")}
    ${tile(L2("Formulieren","Forms"),num(c.forms),`${num(c.intents)} ${L2("contactklikken","contact clicks")}`,"forms","#ec4899","ac")}
   </div>
   ${gaGap?`<div class="sm muted wb-note">${L2(`GA4 loopt een dag achter${(c.ga_days||0)<S.days-1?"; sinds de overstap op 18-10 vult GA4 weer vanaf nu":""}. Eigen meting loopt sinds 17-10.`,`GA4 lags one day${(c.ga_days||0)<S.days-1?"; since the switch on 18 Oct GA4 refills from now":""}. Own measurement runs since 17 Oct.`)}</div>`:""}`;
  box.querySelectorAll("#wbDays button").forEach(b=>b.onclick=()=>{siteDays=+b.dataset.n;try{localStorage.setItem("nexus-site-days",siteDays)}catch(e){};loadSiteStrip(true)});
  box.querySelectorAll("[data-go]").forEach(k=>k.onclick=()=>{location.hash=k.dataset.go});
}
/* komende afspraken uit nexus_agenda (agenda-scans van ViewingLogger en ModeloReminder) */
const ownerName=e=>{const m=String(e||"").match(/^([a-z]+)@gruposoltura\.com$/i);return m?m[1][0].toUpperCase()+m[1].slice(1):(e||"")};
const agWhen=x=>`${fdate(x.date)}${x.time?" · "+esc(x.time)+(x.end?"–"+esc(x.end):""):""}`;
function viewingsHtml(v){return (v||[]).length?v.map(x=>`<div class="it" ${x.prop_wp_id?`data-p="${x.prop_wp_id}"`:'style="cursor:default"'}><div class="ic" style="--ic:#22c55e">◉</div>
  <div style="min-width:0"><div class="t">${esc(x.ref||"—")}${x.client?" · "+esc(x.client):""}</div><div class="d">${agWhen(x)}${x.owner?` · <span style="color:${REPC[ownerName(x.owner)]||"#64748b"}">${esc(ownerName(x.owner))}</span>`:""}</div>${x.title?`<div class="d" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(x.title)}</div>`:""}</div><span></span></div>`).join(""):`<div class="empty">${t("ov.noviewings")}</div>`}
function notariesHtml(v){return (v||[]).length?v.map(x=>`<div class="it" ${x.prop_wp_id?`data-p="${x.prop_wp_id}"`:'style="cursor:default"'}><div class="ic" style="--ic:#a855f7">⚖</div>
  <div style="min-width:0"><div class="t">${esc(x.client||x.title||"—")}</div><div class="d">${agWhen(x)}${x.role?` · ${esc(t("nt."+x.role)!=="nt."+x.role?t("nt."+x.role):x.role)}`:""}${x.ref?" · "+esc(x.ref):""}${x.owner?` · <span style="color:${REPC[ownerName(x.owner)]||"#64748b"}">${esc(ownerName(x.owner))}</span>`:""}</div>
  ${(x.modelos||[]).length?`<div style="margin-top:3px;display:flex;gap:4px;flex-wrap:wrap">${x.modelos.map(m=>`<span class="tag">Modelo ${esc(m)}</span>`).join("")}</div>`:""}</div><span></span></div>`).join(""):`<div class="empty">${t("ov.nonotaries")}</div>`}
/* losse activiteit verwijderen (alleen beheerder); verwijdert ook uit contacttijdlijn */
const isAdmin=()=>!!(ME&&ME.role==="admin");
const delBtn=(k,id)=>isAdmin()&&id!=null?`<button class="act-del" data-del-k="${esc(k)}" data-del-id="${esc(id)}" title="${esc(t("act.del"))}" aria-label="${esc(t("act.del"))}">🗑</button>`:"";
async function delActivity(k,id){
  if(!confirm(t("act.del.confirm")))return;
  try{await rpc("nexus_activity_delete",{p_kind:k,p_id:String(id)})}catch(e){alert(e.message);return}
  OV=null;ovLoaded=false;
  if(curTab==="ov")loadOverview();
  if(curTab==="ac")loadActivity();
  if(curTab==="ct"&&ctSel)openContact(ctSel);
}
function feedHtml(list){
  const IC={request:["#ec4899","✉"],lead:["#f59e0b","★"],viewing:["#22c55e","◉"]};
  if(!list||!list.length)return`<div class="empty">${t("noactivity")}</div>`;
  return list.map(a=>{const ic=IC[a.kind]||IC.request;return `<div class="it" ${a.contact_wp_id?`data-c="${a.contact_wp_id}"`:""}>
    <div class="ic" style="--ic:${ic[0]}">${ic[1]}</div>
    <div style="min-width:0"><div class="t">${esc(a.name||t("unknown"))}</div><div class="d">${esc(a.kind==="request"?rq(a.type):a.type)}${a.ref?" · "+esc(a.ref):""} · <span style="color:${REPC[a.rep]||"#64748b"}">${esc(rep(a.rep||""))}</span></div></div>
    <span class="sm muted" style="display:flex;align-items:center;gap:6px">${ago(a.ts)}${a.kind==="request"?delBtn("request",a.id):""}</span></div>`}).join("")}

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
       <div class="sub">${(c.roles||[]).map(roleTag).join(" ")} <span>${esc([c.city,c.country].filter(Boolean).join(", ")||c.email||"")}</span>${c.partner?` <span class="muted">· 💑 ${esc(c.partner)}</span>`:""}</div></div>
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
  /* MySoltura bestaat niet meer: wachtwoord-resets van het oude klantaccount zijn geen contactmoment (Rick, 20-10-2026) */
  if(CT&&CT.timeline)CT.timeline=CT.timeline.filter(e=>!(e.kind==="request"&&(e.title==="cprreset"||e.title==="dashboard")));
  if(!CT){d.innerHTML=`<div class="empty">${t("notfound.ct")}</div>`;return}
  renderContact();
  loadCampaigns(id);
  if(innerWidth<1100)d.scrollIntoView({behavior:"smooth",block:"start"});
}
function renderContact(){
  const c=CT.contact, raw=CT.raw||{}, d=$("#ctDetail");
  const name=c.full_name||[raw.first_name,raw.last_name].filter(Boolean).join(" ")||c.email;
  const tabs=[["profiel",t("st.profile")],["woningen",t("st.props"),(CT.properties||[]).length+(CT.interests||[]).length+(CT.interested_in_mine||[]).length],["tijdlijn",t("st.timeline"),(CT.timeline||[]).length],["relaties",t("st.relations"),(CT.relations||[]).length+(CT.interested_in_mine||[]).length],["mailings",t("st.mailings")]];
  if(!tabs.some(x=>x[0]===ctSub))ctSub="profiel";
  const D=CT.details||{};
  const phones=(D.phones&&D.phones.length?D.phones.map(x=>x.value):[c.phone]).filter(Boolean);
  const emails=(D.emails&&D.emails.length?D.emails.map(x=>x.value):[c.email]).filter(Boolean);
  const cleanTel=v=>String(v).replace(/[^\d+]/g,""), waNum=v=>cleanTel(v).replace(/^\+/,"").replace(/^00/,"");
  const intro=D.introducer;
  d.innerHTML=`<div class="dh"><div class="ini big" style="background:${hue(name)}">${esc(initials(name))}</div>
    <div style="min-width:0;flex:1"><h2>${esc(name)}${(c.roles||[]).includes("agent")&&D.company?`<span class="h2co"> · ${esc(D.company)}</span>`:""}</h2>
      <div class="roles">${(c.roles||[]).map(roleTag).join("")}<span class="sm muted" style="margin-left:6px">👤 <b style="color:${REPC[c.rep]||"#94a3b8"}">${esc(rep(c.rep))}</b> ${c.wp_id?" · #"+c.wp_id:""}${c.language?" · 🌐 "+esc(c.language):""}</span></div>
      <div class="cstrip">${phones.map(p=>`<span class="cpill"><a href="tel:${esc(cleanTel(p))}">☎ ${esc(p)}</a><a class="wa" href="https://wa.me/${esc(waNum(p))}" target="_blank" rel="noopener" title="WhatsApp">WA</a></span>`).join("")}${!phones.length?`<span class="cpill nophone"><a data-cedit="1" title="${esc(t("addphone"))}">☎ ${t("nophone")} · <b>+ ${t("addphone")}</b></a></span>`:""}${emails.map(e=>`<span class="cpill"><a href="mailto:${esc(e)}">✉ ${esc(e)}</a></span>`).join("")}${!emails.length?`<span class="cpill nophone"><a data-cedit="1">✉ ${t("noemail")} · <b>+ ${t("addemail")}</b></a></span>`:""}</div>
      ${(CT.partners||[]).map(pt=>`<div class="introbar ptbar" data-c="${esc(pt.id)}">💑 ${t("pt.label")} <b>${esc(pt.name||pt.email||"—")}</b>${pt.phone?` · ${esc(pt.phone)}`:""}${pt.email?` · ${esc(pt.email)}`:""}<span class="go">${t("pt.open")}</span></div>`).join("")}
      ${intro?`<div class="introbar" data-c="${esc(intro.key||intro.wp_id)}">🤝 ${t("intro.by")} <b>${esc(intro.name||intro.email)}</b>${intro.phone?` · ${esc(intro.phone)}`:""}${intro.email?` · ${esc(intro.email)}`:""}<span class="go">${t("intro.open")}</span></div>`:""}</div>
    <div class="acts"><a class="act-edit" data-cedit="1">✎ ${t("act.pedit")}</a>${ME&&ME.role==="admin"?`<a class="act-del" data-cdel="1" title="${esc(L2("Contact definitief verwijderen, met al zijn contactmomenten","Delete contact permanently, with all its contact moments"))}">🗑 ${L2("Verwijderen","Delete")}</a>`:""}</div></div>
   <div class="subtabs">${tabs.map(x=>`<button class="st ${ctSub===x[0]?"on":""}" data-s="${x[0]}">${x[1]}${x[2]!=null?`<span class="cnt">${x[2]}</span>`:""}</button>`).join("")}</div>
   <div class="dbody scroll" id="ctBody"></div>`;
  d.querySelectorAll(".st").forEach(b=>b.onclick=()=>{ctSub=b.dataset.s;renderContact()});
  d.querySelectorAll("[data-cedit]").forEach(ce=>ce.onclick=()=>window.NEXUS_EDIT&&NEXUS_EDIT.openContact(c.key||c.id||c.wp_id,{sb,rpc,lang:()=>LANG,me:()=>ME,onSaved:()=>{openContact(ctSel);loadContacts(true)}}));
  const cdel=d.querySelector("[data-cdel]");if(cdel)cdel.onclick=()=>delContact(c,name);
  const B=$("#ctBody");
  if(ctSub==="profiel")B.innerHTML=ctProfile(c,raw);
  if(ctSub==="woningen")B.innerHTML=ctProps();
  if(ctSub==="tijdlijn")B.innerHTML=timeline(CT.timeline);
  if(ctSub==="relaties")B.innerHTML=ctRelations(c);
  if(ctSub==="mailings")B.innerHTML=ctMailings(c);
  B.querySelectorAll("[data-cedit]").forEach(ce=>ce.onclick=()=>window.NEXUS_EDIT&&NEXUS_EDIT.openContact(c.key||c.id||c.wp_id,{sb,rpc,lang:()=>LANG,me:()=>ME,onSaved:()=>{openContact(ctSel);loadContacts(true)}}));
}
/* ---------- Verwijderen vanuit de kop (Rick, 20-10-2026) ----------
   Contact: eerst controleren of er een woning aan hangt; zo ja alleen een waarschuwing, niets verwijderen.
   Anders gaan alle contactmomenten (aanvragen, bezichtigingen, mails, notities) en overige gekoppelde rijen mee. */
async function delContact(c,name){
  let chk=null;try{chk=await rpc("nexus_contact_delete_check",{p_id:c.id})}catch(e){chk=null}
  if(chk&&chk.properties&&chk.properties.length){
    alert(L2(`"${name}" kan niet verwijderd worden: er is een woning aan gekoppeld.\n\n${chk.properties.map(x=>"• "+x.reference+" ("+x.as+")").join("\n")}\n\nVerwijder of ontkoppel eerst die woning.`,
      `"${name}" cannot be deleted: a property is linked to this contact.\n\n${chk.properties.map(x=>"• "+x.reference+" ("+({eigenaar:"owner",koper:"buyer",makelaar:"agent"}[x.as]||x.as)+")").join("\n")}\n\nDelete or unlink that property first.`));return}
  if(chk&&chk.feed){alert(L2(`"${name}" is een partnermakelaar met een XML-feed en kan niet verwijderd worden.`,`"${name}" is a partner agency with an XML feed and cannot be deleted.`));return}
  const n=chk?chk.moments:null;
  if(!confirm(L2(`Contact "${name}" definitief verwijderen?\n\nAlles gaat mee: e-mails, telefoons, labels, relaties${n!=null?` en ${n} contactmoment(en)`:" en alle contactmomenten"} (aanvragen, bezichtigingen, mails, notities). Er blijft alleen een kopie in het auditlog.`,
    `Permanently delete contact "${name}"?\n\nEverything goes: e-mails, phones, labels, relations${n!=null?` and ${n} contact moment(s)`:" and all contact moments"} (requests, viewings, mails, notes). Only a copy in the audit log remains.`)))return;
  try{await rpc("nexus_contact_delete",{p_id:c.id})}catch(e){alert(e.message||String(e));return}
  CT=null;ctSel=null;$("#ctDetail").innerHTML=`<div class="empty">${L2("Contact verwijderd","Contact deleted")}</div>`;location.hash="ct";loadContacts(true)}
async function delProperty(p){
  const ref=p.reference;
  const ext=p.is_external?L2(`LET OP: dit is een partnerwoning. Staat hij nog in de XML-feed van de partner, dan komt hij bij de volgende nachtelijke import gewoon terug.\n\n`,`NOTE: this is a partner property. If it is still in the partner's XML feed, it will come back with the next nightly import.\n\n`):"";
  const typed=prompt(ext+L2(`Woning ${ref} definitief verwijderen?\n\nTeksten, foto's, prijshistorie, kadaster- en marktdata gaan mee. Aanvragen en bezichtigingen blijven als contactmoment bij het contact staan. Er blijft een kopie in het auditlog.\n\nTyp ${ref} om te bevestigen:`,
    `Permanently delete property ${ref}?\n\nTexts, photos, price history, cadastre and market data go with it. Requests and viewings stay as contact moments on the contact. A copy remains in the audit log.\n\nType ${ref} to confirm:`));
  if(typed==null)return;
  if(typed.trim().toUpperCase()!==String(ref).toUpperCase()){alert(L2("Referentie klopt niet; niets verwijderd.","Reference does not match; nothing deleted."));return}
  try{await rpc("nexus_property_delete",{p_id:p.id})}catch(e){alert(e.message||String(e));return}
  PR=null;$("#prDetail").innerHTML=`<div class="empty">${L2(`Woning ${ref} verwijderd`,`Property ${ref} deleted`)}</div>`;location.hash="pr";location.reload()}
function kv(pairs){const f=pairs.filter(p=>p[1]!=null&&p[1]!=="");return f.length?`<dl class="kv">${f.map(p=>`<dt>${p[0]}</dt><dd>${p[2]?p[1]:esc(p[1])}</dd>`).join("")}</dl>`:`<div class="empty sm">${t("nodata")}</div>`}
/* ---------- Contact · Profiel (20-10-2026, Rick) ----------
   Het profiel volgt de rol(len): per rol een eigen gekleurd paneel (zelfde stijl als de woningdetail),
   alleen getoond als die rol of die data er is. Geen herhaling van wat de kop al laat zien
   (naam, aanhef, taal, telefoon, e-mail, aangebracht door). Lege tegels met nullen verdwijnen. */
const CPSEC={sell:"var(--r-seller)",buy:"var(--r-buyer)",agent:"var(--r-agent)",lead:"var(--r-suspect)",person:"#3b82f6",file:"#64748b",notes:"#ec4899",journey:"#14b8a6"};
function cpSec(id,title,body,o){o=o||{};
  return `<div class="card pk-sec cp-sec${o.wide?" cp-wide":""}" style="--sc:${CPSEC[id]}"><div class="hd"><h3>${title}</h3><span class="pk-sec-r">${o.aside||""}${o.edit?`<a class="pk-sec-ed" data-cedit="1" title="${L2("Bewerken","Edit")}">✎</a>`:""}</span></div>${body}</div>`}
const cpTile=(l,v,s,warn)=>`<div class="cp-t${warn?" warn":""}"><div class="l">${l}</div><div class="v">${v}</div>${s?`<div class="s">${s}</div>`:""}</div>`;
function cpDays(ts){const d=days(ts);return d==null?null:d}
function cpPropRow(p,mode){
  const st=p.core_status, live=st==="available", offer=st==="under_offer"||st==="reserved", sold=st==="sold";
  const chg=p.price_previous&&p.price&&Number(p.price_previous)!==Number(p.price)?Math.round((p.price-p.price_previous)/p.price_previous*100):null;
  const dOn=cpDays(p.listed_at);
  const facts=[p.bedrooms?p.bedrooms+" "+L2("slpk","bd"):null,p.bathrooms?p.bathrooms+" "+L2("badk","ba"):null,p.build_area?num(p.build_area)+" m²":null,p.plot_area?L2("perceel ","plot ")+num(p.plot_area)+" m²":null].filter(Boolean).join(" · ");
  let stats="";
  if(mode==="sell"){
    const parts=[];
    if(live||offer)parts.push(`<span class="cp-m"><b>${dOn!=null?num(dOn):"—"}</b> ${L2("dagen online","days online")}</span>`);
    parts.push(`<span class="cp-m${!p.n_people&&live&&dOn>21?" warn":""}"><b>${num(p.n_people||0)}</b> ${L2("geïnteresseerden","interested")}</span>`);
    parts.push(`<span class="cp-m"><b>${num(p.n_viewings||0)}</b> ${L2("bezichtigingen","viewings")}</span>`);
    stats=`<div class="cp-ms">${parts.join("")}</div>`;
    const sub=[p.next_viewing?`📅 ${L2("Volgende bezichtiging","Next viewing")} <b>${fdate(p.next_viewing)}</b>`:null,
               p.last_viewing?`${L2("Laatste bezichtiging","Last viewing")} ${fdate(p.last_viewing)}`:null,
               p.last_request?`${L2("Laatste aanvraag","Last enquiry")} ${ago(p.last_request)}`:null,
               chg!=null?`${L2("Prijs aangepast","Price changed")} ${chg>0?"+":""}${chg}% ${p.price_changed_at?"("+fdate(p.price_changed_at)+")":""}`:null,
               sold&&(p.sold_date||p.sold_at)?`${L2("Verkocht op","Sold on")} ${fdate(p.sold_date||p.sold_at)}${p.sold_price?" · "+eur(p.sold_price):""}`:null].filter(Boolean);
    if(sub.length)stats+=`<div class="cp-sub">${sub.join(" · ")}</div>`;
  }else{
    const sub=[offer?L2("Bod geaccepteerd","Offer accepted"):sold?L2("Gekocht","Purchased"):null,
               p.sold_price?`${L2("Koopprijs","Purchase price")} <b>${eur(p.sold_price)}</b>${p.price&&Number(p.price)!==Number(p.sold_price)?` <span class="muted">(${L2("vraagprijs","asking")} ${eur(p.price)})</span>`:""}`:null,
               (p.sold_date||p.sold_at)?`${L2("Datum","Date")} ${fdate(p.sold_date||p.sold_at)}`:null].filter(Boolean);
    stats=sub.length?`<div class="cp-sub">${sub.join(" · ")}</div>`:"";
  }
  return `<div class="cp-pr" data-p="${esc(p.key||p.reference)}">${p.image?`<img loading="lazy" src="${esc(p.image)}" alt="">`:'<div class="ph"></div>'}
    <div class="cp-pb"><div class="cp-ph"><b>${esc(p.reference||"?")}</b> <span class="muted">${esc(p.title||"")}</span><span class="cp-st st-${esc(st||"")}">${esc(stLabel(st))}</span></div>
      <div class="cp-pp"><b>${eur(mode==="buy"&&p.sold_price?p.sold_price:p.price)}</b>${mode==="sell"&&chg!=null?` <s class="muted sm">${eur(p.price_previous)}</s>`:""} <span class="muted sm">${esc(p.town||"")}${facts?" · "+facts:""}</span></div>
      ${stats}</div></div>`}
function ctProfile(c,raw){
  const ip=CT.interest||{}, m=CT.matches||{}, fb=CT.feedback||{}, D=CT.details||{}, M=D.mailing||{};
  const roles=(c.roles||[]).map(r=>String(r).replace("_","-"));
  const has=r=>roles.includes(r);
  const props=CT.properties||[], own=props.filter(p=>/eigenaar/.test(p.relation)), bought=props.filter(p=>/koper/.test(p.relation)), offered=props.filter(p=>p.relation==="aanbiedend makelaar");
  const tl=CT.timeline||[], rels=CT.relations||[], ints=CT.interests||[];
  /* Rick 20-10-2026: 'aanvragen' = vragen over woningen. Accountverkeer van het oude MySoltura (wachtwoord-reset)
     en een nieuwsbriefinschrijving zijn geen interesse en tellen niet mee. */
  const NOINT=new Set(["cprreset","dashboard","newsletter"]);
  const reqs=tl.filter(e=>e.kind==="request"&&!NOINT.has(e.title)), views=tl.filter(e=>e.kind==="viewing");
  const reqProp=reqs.filter(e=>e.ref), reqOther=reqs.filter(e=>!e.ref), nPropAsked=new Set(reqProp.map(e=>e.ref)).size;
  const tlSorted=tl.filter(e=>e.ts&&!isNaN(new Date(e.ts))&&!(e.kind==="request"&&NOINT.has(e.title))).sort((a,b)=>new Date(a.ts)-new Date(b.ts));
  const firstEv=tlSorted[0]||null, lastTouch=tlSorted.length?tlSorted[tlSorted.length-1].ts:null;
  /* Rick 20-10-2026: eerste contact = de vroegste datum die we van dit contact kennen, ook een rol- of woningdatum.
     Je kunt geen verkoper of koper zijn vóór het eerste contact, dus de klantreis begint hier altijd. */
  const dOk=d=>d&&!isNaN(new Date(d));
  const firstTouch=[firstEv&&firstEv.ts,...bought.flatMap(p=>[p.last_request,p.sold_at,p.listed_at]),...own.map(p=>p.listed_at)].filter(dOk).sort((a,b)=>new Date(a)-new Date(b))[0]||null;
  /* Signaal: rol of woning ligt vóór het eerste vastgelegde contactmoment → er ontbreekt een contactmoment */
  const noFirstMoment=!!firstTouch&&(!firstEv||new Date(firstEv.ts)>new Date(firstTouch));
  const isSeller=has("seller")||has("suspect-seller")||own.length, isBuyer=has("buyer")||bought.length, isAgent=has("agent")||offered.length;
  const out=[];

  /* Klantreis: in één regel hoe dit contact zich ontwikkelde — lost het "was koper, nu verkoper"-probleem op */
  const steps=[];
  bought.forEach(p=>steps.push([p.sold_at||p.last_request||p.listed_at,`${L2("Koper","Buyer")} ${p.reference}`,stLabel(p.core_status),"buy"]));
  own.forEach(p=>steps.push([p.listed_at,`${L2("Verkoper","Seller")} ${p.reference}`,stLabel(p.core_status),"sell"]));
  steps.sort((a,b)=>new Date(a[0]||0)-new Date(b[0]||0));
  /* Eerste contact staat altijd vooraan, los van de sortering */
  if(firstTouch)steps.unshift([firstTouch,L2("Eerste contact","First contact"),noFirstMoment?L2("geen contactmoment vastgelegd","no contact moment logged"):(firstEv&&firstEv.ts===firstTouch&&firstEv.kind==="request"?rq(firstEv.title||""):""),"journey"]);
  if(steps.length>1)out.push(`<div class="cp-journey">${steps.map(s=>`<div class="cp-step" style="--sc:${CPSEC[s[3]]}"><span class="d">${s[0]?fdate(s[0]):"—"}</span><b>${esc(s[1])}</b>${s[2]?`<span class="x">${esc(s[2])}</span>`:""}</div>`).join('<span class="cp-arrow">→</span>')}</div>`);

  /* Verkoop */
  const sellBlock=()=>{
    const live=own.filter(p=>p.core_status==="available"||p.core_status==="under_offer"||p.core_status==="reserved");
    const tot=live.reduce((a,p)=>a+Number(p.price||0),0), ppl=own.reduce((a,p)=>a+Number(p.n_people||0),0), vw=own.reduce((a,p)=>a+Number(p.n_viewings||0),0);
    const oldest=Math.max(0,...live.map(p=>cpDays(p.listed_at)||0));
    const tiles=own.length?`<div class="cp-tiles">${cpTile(L2("In verkoop","For sale"),num(live.length),own.length>live.length?L2(`van ${own.length} woningen`,`of ${own.length} properties`):"")}
       ${tot?cpTile(L2("Vraagprijs","Asking price"),eur(tot)):""}${cpTile(L2("Geïnteresseerden","Interested"),num(ppl),"",live.length&&!ppl&&oldest>21)}${cpTile(L2("Bezichtigingen","Viewings"),num(vw))}
       ${live.length?cpTile(L2("Online","Online"),num(oldest)+" "+L2("dgn","d"),L2("langst lopend","longest running")):""}</div>`:"";
    const rows=own.length?`<div class="cp-prs">${own.map(p=>cpPropRow(p,"sell")).join("")}</div>`
      :`<div class="cp-empty">${has("suspect-seller")?L2("Mogelijke verkoper — nog geen woning gekoppeld.","Possible seller — no property linked yet."):L2("Nog geen woning gekoppeld.","No property linked yet.")}${CT.core&&CT.core.id?` <button class="btn sm act-newpr" type="button" data-newpr="ct">+ ${t("act.addpr")}</button>`:""}</div>`;
    return cpSec("sell",has("suspect-seller")&&!own.length?L2("Mogelijke verkoop","Potential sale"):L2("Verkoop","Selling"),tiles+rows,{wide:1,aside:own.length?`<span class="tag">${own.length}</span>`:""})};

  /* Aankoop: koop in behandeling/afgerond, daarna pas het zoekgedrag */
  const buyBlock=()=>{
    const done=bought.length>0;
    const prof=[[t("f.budget"),(ip.declared_budget_min||ip.declared_budget_max)?`${eur(ip.declared_budget_min)} – ${eur(ip.declared_budget_max)}`:(raw.sd_budget||(ip.price_min?`${eur(ip.price_min)} – ${eur(ip.price_max)} (${t("behaviour")})`:null))],
      [L2("Bouw","Build"),(raw.sd_build||[]).map(b=>b==="new_build"?L2("Nieuwbouw","New build"):L2("Bestaande bouw","Resale")).join(" + ")||null],
      [t("f.type"),ip.declared_property_type||raw.sd_type||(ip.preferred_categories?Object.keys(ip.preferred_categories).slice(0,3).join(", "):null)],
      [t("f.beds"),(raw.sd_beds||ip.declared_bedrooms_min)?"≥ "+(raw.sd_beds||ip.declared_bedrooms_min):null],
      [t("f.areas"),raw.sd_areas||(ip.declared_areas?[].concat(ip.declared_areas).join(", "):null)],
      [t("f.musthaves"),raw.sd_musthaves||(ip.declared_must_haves?[].concat(ip.declared_must_haves).join(", "):null)],
      [t("f.period"),ip.declared_period||raw.sd_period],
      [t("f.feedback"),Object.keys(fb).length?Object.entries(fb).map(([k,v])=>k+": "+v).join(" · "):null]].filter(x=>x[1]);
    const act=[[L2("Woningaanvragen","Property enquiries"),reqProp.length],[L2("Overige vragen","Other enquiries"),reqOther.length],[L2("Woningen bekeken","Properties viewed"),ip.distinct_properties_viewed||ints.length||0],[L2("Bezichtigingen","Viewings"),views.length],[L2("Matches verstuurd","Matches sent"),m.sent||0]];
    const anyAct=act.some(x=>x[1]>0);
    let body="";
    if(done)body+=`<div class="cp-prs">${bought.map(p=>cpPropRow(p,"buy")).join("")}</div>`;
    if(anyAct)body+=`<div class="cp-tiles${done?" cp-dim":""}">${act.filter(x=>x[1]>0||!done).map(x=>cpTile(x[0],num(x[1]))).join("")}${Number(ip.engagement_score)>0?cpTile(L2("Engagement","Engagement"),Number(ip.engagement_score).toFixed(0),ip.data_confidence?L2("betrouwbaarheid ","confidence ")+esc(ip.data_confidence):""):""}</div>`;
    if(!done||prof.length){body+=`<div class="pk-grp">${t("h.search")}${done?` <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:500">· ${L2("vóór de aankoop","before the purchase")}</span>`:""}</div>`+(prof.length?kv(prof):`<div class="cp-empty">${L2("Nog geen zoekprofiel vastgelegd.","No search profile yet.")} <a class="cp-add" data-cedit="1">+ ${L2("Invullen","Add")}</a></div>`)}
    if(ip.first_request_at)body+=`<div class="cp-foot">${L2("Zoekt actief van","Searching from")} ${fdate(ip.first_request_at)} ${L2("tot","to")} ${fdate(ip.last_request_at)}</div>`;
    return cpSec("buy",done?L2("Aankoop","Purchase"):L2("Zoekt een woning","Looking for a home"),body,{wide:!!done||anyAct,edit:!done})};

  /* Makelaar/partner */
  const agentBlock=()=>{
    const introduced=rels.filter(x=>x.why==="aangebracht via deze makelaar");
    const tiles=`<div class="cp-tiles">${cpTile(L2("Aangebrachte contacten","Contacts introduced"),num(introduced.length))}${cpTile(L2("Aangeboden woningen","Properties offered"),num(offered.length))}</div>`;
    const list=introduced.length?`<div class="cp-chips">${introduced.slice(0,12).map(x=>`<a class="cp-chip" data-c="${esc(x.key||x.wp_id)}">${esc(x.name||x.email)}</a>`).join("")}${introduced.length>12?`<span class="muted sm">+${introduced.length-12}</span>`:""}</div>`:"";
    return cpSec("agent",L2("Makelaar / partner","Agent / partner"),tiles+list)};

  /* Lead: alleen Suspect zonder andere rol */
  const leadBlock=()=>{
    const top=ints.slice(0,4);
    const tiles=`<div class="cp-tiles">${cpTile(L2("Woningaanvragen","Property enquiries"),num(reqProp.length),nPropAsked?L2(`over ${nPropAsked} woning${nPropAsked>1?"en":""}`,`about ${nPropAsked} propert${nPropAsked>1?"ies":"y"}`):"")}${reqOther.length?cpTile(L2("Overige vragen","Other enquiries"),num(reqOther.length),L2("algemeen, zonder woning","general, no property")):""}${cpTile(L2("Eerste contact","First contact"),firstTouch?fdate(firstTouch):"—")}${cpTile(L2("Laatst actief","Last active"),lastTouch?ago(lastTouch):"—")}</div>`;
    const list=top.length?`<div class="pk-grp">${L2("Interesse in","Interested in")}</div><div class="cp-chips">${top.map(p=>`<a class="cp-chip" data-p="${esc(p.key||p.reference)}"><b>${esc(p.reference)}</b> ${eur(p.price)} · ${p.n}×</a>`).join("")}</div>`:"";
    return cpSec("lead",L2("Lead","Lead"),tiles+list,{wide:1})};

  /* volgorde: de actieve rol eerst. Verkoper met woning online gaat voor koper die al gekocht heeft. */
  const blocks=[];
  if(isSeller)blocks.push([own.some(p=>p.core_status==="available")?0:2,sellBlock]);
  if(isBuyer)blocks.push([bought.some(p=>p.core_status!=="sold")?1:3,buyBlock]);
  if(isAgent)blocks.push([4,agentBlock]);
  if(!isSeller&&!isBuyer&&!isAgent)blocks.push([0,leadBlock]);
  let halves=0;
  blocks.sort((a,b)=>a[0]-b[0]).forEach(b=>{const h=b[1]();if(!/cp-wide/.test(h.slice(0,80)))halves++;out.push(h)});

  /* Persoonsgegevens: alleen wat de kop niet al toont */
  const addr=[D.street,[D.postcode,D.city].filter(Boolean).join(" "),D.suburb,D.state,D.country].filter(Boolean).map(esc).join("<br>");
  const link=(u,l)=>u?`<a href="${esc(/^https?:/.test(u)?u:"https://"+u)}" target="_blank" rel="noopener">${esc(l||u)}</a>`:null;
  const socials=[D.facebook&&link(D.facebook,"Facebook"),D.instagram&&link(D.instagram,"Instagram"),D.linkedin&&link(D.linkedin,"LinkedIn"),D.twitter&&link(D.twitter,"X/Twitter")].filter(Boolean).join(" · ");
  const pers=[[t("f.homeaddr"),addr||null,1],[t("f.born"),D.birthday],[t("f.marital"),D.marital],[t("f.nie"),D.nie?`<b class="mono">${esc(D.nie)}</b>`:null,1],[t("f.passport"),D.passport?`<b class="mono">${esc(D.passport)}</b>`:null,1],
    [t("f.company"),D.company],[t("f.jobtitle"),D.jobtitle],[t("f.website"),link(D.website),1],[t("f.socials"),socials||null,1],[t("f.custom")+" 1",D.custom_1],[t("f.custom")+" 2",D.custom_2]].filter(p=>p[1]!=null&&p[1]!=="");
  const missing=[!addr&&t("f.homeaddr"),!D.nie&&"NIE",!D.passport&&t("f.passport")].filter(Boolean);
  const persBody=(pers.length?kv(pers):"")+(missing.length&&(isSeller||bought.length)?`<div class="cp-miss">${L2("Ontbreekt voor de notaris","Missing for the notary")}: <b>${missing.map(esc).join(", ")}</b> <a class="cp-add" data-cedit="1">+ ${L2("Aanvullen","Complete")}</a></div>`:!pers.length?`<div class="cp-empty">${L2("Geen aanvullende gegevens.","No further details.")} <a class="cp-add" data-cedit="1">+ ${L2("Aanvullen","Complete")}</a></div>`:"");

  /* Dossier: beheer en contacthistorie in één oogopslag */
  const mailOn=M.master_optin==="yes";
  const file=[[L2("Laatste contactmoment","Last contact"),lastTouch?`${fdate(lastTouch)} <span class="muted sm">· ${ago(lastTouch)}</span>`:null,1],
    [L2("Contactmomenten","Contact moments"),tl.length?num(tl.length):null],
    [L2("Mailings","Mailings"),`<span class="mpill ${mailOn?"in":"out"}">${mailOn?L2("Ingeschreven","Subscribed"):L2("Niet ingeschreven","Not subscribed")}</span>${(M.events||{}).last_delivered?` <span class="muted sm">· ${L2("laatste","last")} ${fdate(M.events.last_delivered)}</span>`:""}`,1],
    [t("f.referred"),D.referred_by],[t("f.keyholder"),D.keyholder?L2("Ja — sleutel bij ons","Yes — we hold a key"):null],[t("f.value"),D.sales_value?eur(D.sales_value):null],
    [L2("In systeem sinds","In system since"),raw.created_wp?fdate(raw.created_wp):null],[t("f.modified"),c.wp_modified?fdate(c.wp_modified):null]];
  /* Laat een halve rolkaart (bv. Makelaar) een gat rechts, dan schuift Dossier daarin en krijgt Persoonsgegevens de volle breedte */
  if(halves%2)out.push(cpSec("file",L2("Dossier","File"),kv(file)),cpSec("person",L2("Persoonsgegevens","Personal details"),persBody,{edit:1,wide:1}));
  else out.push(`<div class="cp-pair">${cpSec("person",L2("Persoonsgegevens","Personal details"),persBody,{edit:1})}${cpSec("file",L2("Dossier","File"),kv(file))}</div>`);

  const notes=raw.internal_comments?esc(raw.internal_comments.replace(/<br\s*\/?>/gi,"\n")):"";
  out.push(cpSec("notes",t("h.notes"),notes?`<div class="note">${notes}</div>`:`<div class="cp-empty">${t("nonotes")}</div>`,{wide:1,edit:1}));
  return `<div class="cp">${out.join("")}</div>`;
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
  const own=CT.properties||[], it=CT.interests||[], im=CT.interested_in_mine||[];
  const byRef={};im.forEach(x=>{(byRef[x.ref]=byRef[x.ref]||[]).push(x)});
  const nInt=p=>(byRef[p.reference]||[]).length;
  const rel=x=>`<div class="rel" data-c="${esc(x.key||x.wp_id)}"><div class="ini" style="background:${hue(x.name||"")};width:32px;height:32px;font-size:calc(12px*var(--fs,1))">${esc(initials(x.name||""))}</div><div style="min-width:0"><div style="font-weight:600">${esc(x.name||"")}</div><div class="sm muted">${esc(x.ref)} · ${t("x.requests",{n:x.n})}</div></div></div>`;
  return `<div class="hd" style="padding:0 0 8px"><h3>${t("h.owned",{n:own.length})}</h3>${ME&&ME.role==="admin"&&CT.core&&CT.core.id?`<button class="btn sm act-newpr" type="button" data-newpr="ct">+ ${t("act.addpr")}</button>`:""}</div>
   ${own.length?`<div class="grid2">${own.map(p=>propCard(p,`<div style="margin-top:4px"><span class="role" style="--rc:var(${p.relation==="koper"||p.relation==="mede-koper (partner)"?"--r-buyer":p.relation==="eigenaar"||p.relation==="mede-eigenaar (partner)"?"--r-seller":"--r-agent"})">${esc(relT(p.relation))}</span>${nInt(p)?` <span class="sm" style="margin-left:6px;color:var(--c-pr);font-weight:700">👥 ${t("x.interested",{n:nInt(p)})}</span>`:""}</div>`)).join("")}</div>`:`<div class="empty sm">${t("noowned")}</div>`}
   ${im.length?`<div class="hd" style="padding:16px 0 8px"><h3>${t("h.intmine",{n:im.length})}</h3></div><div class="grid2">${im.map(rel).join("")}</div>`:""}
   ${it.length||!own.length?`<div class="hd" style="padding:16px 0 8px"><h3>${t("h.interest",{n:it.length})}</h3></div>
   ${it.length?`<div class="grid2">${it.map(p=>propCard(p,`<div class="sm" style="margin-top:4px">${p.n}× · ${esc((p.types||[]).map(rq).join(", "))} · ${ago(p.last)}</div>`)).join("")}</div>`:`<div class="empty sm">${t("nointerest")}</div>`}`:""}`}
function timeline(list){
  const C={request:"#ec4899",viewing:"#22c55e",mail:"#3b82f6",mailing:"#06b6d4",lead:"#f59e0b",hot:"#ef4444",note:"#a855f7"};
  if(!list||!list.length)return`<div class="empty">${t("notimeline")}</div>`;
  /* mail-preview (20-10-2026): transactionele mail (uuid) en mailing (campaign_id) openen in een popup */
  const mv=e=>e.uuid?` data-mv-uuid="${esc(e.uuid)}"`:e.campaign_id?` data-mv-camp="${esc(e.campaign_id)}" data-mv-email="${esc(e.email||"")}"`:"";
  return `<div class="tl">${list.map(e=>`<div class="e${mv(e)?" mv":""}"${mv(e)}${mv(e)?` title="${esc(t("mv.open"))}"`:""} style="--ec:${C[e.kind]||"#64748b"}"><div class="h"><span class="k">${esc(t("k."+e.kind))} · ${esc(e.kind==="request"?rq(e.title||""):tlTitle(e.title||""))}</span>${e.ref?`<span class="tag">${esc(e.ref)}</span>`:""}<span class="w">${fdate(e.ts)} · ${ago(e.ts)}</span>${mv(e)?`<span class="mv-ic">👁</span>`:""}${e.id!=null&&(e.kind!=="mail"||e.src==="communication")?delBtn(e.kind==="mail"?"communication":e.kind,e.id):""}</div>${e.text?`<div class="x">${esc(e.text)}</div>`:""}</div>`).join("")}</div>`}
/* Mailings (Brevo-campagnes) die dit contact ontving, in de tijdlijn zetten. Bron: Edge Function mail-preview -> Brevo contacts/{email}. */
const MT_LABEL={weekly_news:["Nieuwsbrief","Newsletter"],price_reduced:["Prijsverlaging","Price reduced"],monthly_matches:["Woningmatches","Property matches"],new_listing:["Nieuwe woning","New listing"],market_report:["Marktbericht","Market report"]};
const tsN=x=>{const n=new Date(x||0).getTime();return isNaN(n)?0:n};
async function loadCampaigns(id){
  const em=CT&&CT.contact&&CT.contact.email;if(!em)return;
  let r;try{const {data,error}=await sb.functions.invoke("mail-preview",{body:{action:"campaigns",email:em}});if(error||!data||!data.ok)return;r=data}catch(e){return}
  if(ctSel!==id||!CT)return;
  const lb=s=>MT_LABEL[s]?MT_LABEL[s][LANG==="nl"?0:1]:(s||"mailing").replace(/_/g," ");
  const items=(r.rows||[]).filter(x=>x.sent_at).map(x=>({kind:"mailing",ts:x.sent_at,title:lb(x.mailing_type),campaign_id:x.campaign_id,email:em,
    text:[x.subject||"#"+x.campaign_id,x.opens?t("mv.opens",{n:x.opens}):"",x.clicks?t("mv.clicks",{n:x.clicks}):"",x.unsubscribed?t("mv.unsub"):""].filter(Boolean).join(" · ")}));
  if(!items.length)return;
  CT.timeline=(CT.timeline||[]).filter(e=>e.kind!=="mailing").concat(items).sort((a,b)=>tsN(b.ts)-tsN(a.ts));
  if(ctSub==="tijdlijn")renderContact();
  else{const c=document.querySelector('#ctDetail .st[data-s="tijdlijn"] .cnt');if(c)c.textContent=CT.timeline.length}
}
function closeMail(){document.querySelector(".mvp")?.remove();document.body.classList.remove("pe-open");document.removeEventListener("keydown",mailEsc)}
function mailEsc(e){if(e.key==="Escape")closeMail()}
async function openMail(body){
  closeMail();document.body.classList.add("pe-open");
  const o=document.createElement("div");o.className="mvp";
  o.innerHTML=`<div class="mvp-box"><div class="mvp-hd"><div style="min-width:0;flex:1"><div class="mvp-sj">${t("loading")}</div><div class="mvp-meta"></div></div><button class="pe-x" aria-label="${esc(t("mv.close"))}">×</button></div><div class="mvp-ev"></div><div class="mvp-bd"><div class="pe-load">${t("loading")}</div></div></div>`;
  document.body.appendChild(o);document.addEventListener("keydown",mailEsc);
  o.addEventListener("click",e=>{if(e.target===o||e.target.closest(".pe-x"))closeMail()});
  let r;try{const {data,error}=await sb.functions.invoke("mail-preview",{body});if(error){let j=null;try{j=await error.context.json()}catch(x){}r=j||{ok:false,error:error.message}}else r=data}catch(e){r={ok:false,error:e.message||"error"}}
  if(!o.isConnected)return;
  if(!r||!r.ok||!r.html){o.querySelector(".mvp-sj").textContent=(r&&r.subject)||t("mv.na");o.querySelector(".mvp-bd").innerHTML=`<div class="empty">${esc(t(r&&r.error==="not_found"?"mv.gone":r&&r.error==="no_key"?"mv.nokey":"mv.na"))}</div>`;return}
  o.querySelector(".mvp-sj").textContent=r.subject||"—";
  const camp=r.kind==="campaign";
  o.querySelector(".mvp-meta").innerHTML=[r.sender?esc(r.sender):"",r.recipient?"→ "+esc(r.recipient):"",r.sent_at?fdate(r.sent_at)+" "+new Date(r.sent_at).toLocaleTimeString(LOC(),{hour:"2-digit",minute:"2-digit"}):"",
    camp?`<span class="mvp-tag">${t(r.personal?"mv.camp.personal":"mv.camp")}</span>`:""].filter(Boolean).join(" · ");
  const EVN={sent:"mv.ev.sent",delivered:"mv.ev.delivered",opened:"mv.ev.opened",proxy_open:"mv.ev.proxy",clicks:"mv.ev.click",click:"mv.ev.click",softBounce:"mv.ev.bounce",hardBounce:"mv.ev.bounce",soft_bounce:"mv.ev.bounce",hard_bounce:"mv.ev.bounce",unsubscribed:"mv.ev.unsub",spam:"mv.ev.spam"};
  const ev=!camp&&Array.isArray(r.events)?r.events:[];
  o.querySelector(".mvp-ev").innerHTML=ev.length?ev.map(x=>`<span class="mvp-e"><b>${esc(EVN[x.name]?t(EVN[x.name]):x.name)}</b> ${fdate(x.time)} ${new Date(x.time).toLocaleTimeString(LOC(),{hour:"2-digit",minute:"2-digit"})}</span>`).join(""):"";
  if(!ev.length)o.querySelector(".mvp-ev").remove();
  const f=document.createElement("iframe");f.setAttribute("sandbox","allow-popups allow-popups-to-escape-sandbox");f.setAttribute("referrerpolicy","no-referrer");f.title=r.subject||"mail";
  /* links in de mail openen in een nieuw tabblad; scripts draaien niet (sandbox zonder allow-scripts) */
  const H=String(r.html);f.srcdoc=/<head[^>]*>/i.test(H)?H.replace(/<head([^>]*)>/i,'<head$1><base target="_blank">'):'<base target="_blank">'+H;
  const bd=o.querySelector(".mvp-bd");bd.innerHTML="";bd.appendChild(f);
}
document.addEventListener("click",e=>{
  const el=e.target.closest(".tl .e.mv");if(!el||e.target.closest(".act-del")||e.target.closest("a"))return;
  if(el.dataset.mvUuid)openMail({uuid:el.dataset.mvUuid});
  else if(el.dataset.mvCamp)openMail({campaign_id:Number(el.dataset.mvCamp),email:el.dataset.mvEmail||undefined});
});
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
let prSeq=0;
async function loadProps(reset){
  const seq=++prSeq;
  const box=$("#prRows");if(reset){prOff=0;box.innerHTML=`<div class="loader">${t("loading.props")}</div>`}
  let r;try{r=await rpc("nexus_properties",{p_q:$("#prQ").value,p_status:prStatus+(prBuild?":"+prBuild:""),p_limit:48,p_offset:prOff})}catch(e){if(seq===prSeq)box.innerHTML=`<div class="empty">${esc(e.message)}</div>`;return}
  /* een latere zoekopdracht/filter is al onderweg: dit antwoord is verouderd */
  if(seq!==prSeq)return;
  prLoaded=true;
  const html=r.rows.map(p=>`<div class="pc ${prSel===p.reference?"sel":""}" data-p="${esc(p.reference)}"><div class="im" style="${p.image?`background-image:url('${esc(p.image)}')`:""}">
     <span class="badge">${esc(p.reference||"")}</span>${stBadge(p.core_status)}${p.req30>0?`<span class="hot">${p.req30}× 30d</span>`:""}</div>
     <div class="bd"><div class="p">${eur(p.price)}${p.previous_price&&p.previous_price>p.price?` <span class="sm muted" style="text-decoration:line-through">${eur(p.previous_price)}</span>`:""}</div>
     <div class="t">${esc(p.title||"")}</div><div class="s">${esc([p.suburb,p.town].filter(Boolean).join(", "))} · ${p.bedrooms??"?"} ${t("beds.short")}${p.build?` · ${p.build} m²`:""}</div>
     <div class="s">${p.is_external?t("external"):t("own")}</div>
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
/* ---------- woning: kenmerken (zelfsprekend, breed in 2 kolommen, smal in 1) ---------- */
const L2=(nl,en)=>LANG==="en"?en:nl;
const cap=x=>x?String(x).charAt(0).toUpperCase()+String(x).slice(1):x;
const ENERGY={A:"#0a8a3a",B:"#3aa335",C:"#a6c739",D:"#f4e02a",E:"#f2b12a",F:"#ec6a24",G:"#e1251b"};
function energyHtml(v){
  const x=String(v||"").trim().toUpperCase();
  if(!x)return `<span class="muted">${L2("Niet ingevuld","Not filled in")}</span>`;
  if(ENERGY[x])return `<span class="elabel" style="--ec:${ENERGY[x]}">${x}</span> <span class="muted sm">${L2("energielabel "+x,"energy rating "+x)}</span>`;
  if(x==="R")return `<span class="elabel pend">…</span> ${L2("In aanvraag","Applied for")} <span class="muted sm">${L2("(certificaat nog niet afgegeven; code R)","(certificate not issued yet; code R)")}</span>`;
  if(x==="X")return `<span class="elabel none">—</span> ${L2("Vrijgesteld / niet verplicht","Exempt / not required")} <span class="muted sm">(code X)</span>`;
  return esc(v);
}
const ORI={north:["Noord","North"],south:["Zuid","South"],east:["Oost","East"],west:["West","West"],northeast:["Noordoost","North-east"],northwest:["Noordwest","North-west"],southeast:["Zuidoost","South-east"],southwest:["Zuidwest","South-west"]};
const ORI_SUN={south:["zon het grootste deel van de dag","sun most of the day"],southwest:["middag- en avondzon","afternoon and evening sun"],west:["middag- en avondzon","afternoon and evening sun"],southeast:["ochtend- en middagzon","morning and midday sun"],east:["ochtendzon","morning sun"],northeast:["ochtendzon, koeler","morning sun, cooler"],northwest:["late avondzon, koeler","late evening sun, cooler"],north:["weinig directe zon, koel in de zomer","little direct sun, cool in summer"]};
function orientHtml(v){const k=String(v||"").toLowerCase().replace(/[\s-]/g,"");if(!k)return null;const n=ORI[k];if(!n)return esc(v);
  const sun=ORI_SUN[k];return `${L2(n[0],n[1])}${sun?` <span class="muted sm">· ${L2(sun[0],sun[1])}</span>`:""}`}
const VIEW={sea:["zee","sea"],mountain:["bergen","mountains"],country:["landelijk","countryside"],panoramic:["panorama","panoramic"],golf:["golfbaan","golf course"],green:["groen","greenery"],lake:["meer (zoutmeren)","lake (salt lakes)"],residential:["woonwijk","residential"]};
const viewHtml=v=>v?String(v).split(",").map(x=>{const n=VIEW[x.trim()];return n?L2(n[0],n[1]):esc(x)}).join(", "):null;
const MANDATE={multilist:["Multilist (via meerdere makelaars)","Multilist (several agents)"],open:["Open (niet exclusief)","Open (not exclusive)"],exclusive:["Exclusief bij Grupo Soltura","Exclusive to Grupo Soltura"]};
const days=ts=>ts?Math.max(0,Math.round((Date.now()-new Date(ts))/864e5)):null;
function since(ts){const d=days(ts);if(d==null)return "";if(d<60)return L2(d+" dagen",d+" days");const mo=Math.round(d/30.4);return mo<24?L2(mo+" maanden",mo+" months"):L2((d/365).toFixed(1).replace(".",",")+" jaar",(d/365).toFixed(1)+" years")}
/* panelen in dezelfde volgorde en kleuren als het invoerscherm (Admin → Woning toevoegen); ✎ opent Bewerken op die sectie */
const PKSEC=[["basis",["Basis","Basics"],"#3b82f6"],["prijs",["Prijs","Price"],"#22c55e"],["loc",["Locatie","Location"],"#06b6d4"],["ind",["Indeling","Layout"],"#f59e0b"],
  ["ken",["Kenmerken","Features"],"#a855f7"],["tekst",["Teksten","Texts"],"#ec4899"],["media",["Foto's","Photos"],"#f97316"],["kost",["Eigendomsakte","Title deed"],"#64748b"],["pub",["Publicatie","Publishing"],"#eab308"]];
function pkSec(id,title,body,o){o=o||{};const c=(PKSEC.find(x=>x[0]===id)||[0,0,"#ef4444"])[2];
  return `<div class="card pk-card pk-sec" id="pks-${id}" style="--sc:${c}"><div class="hd"><h3>${title}</h3><span class="pk-sec-r">${o.tag?`<span class="tag">${esc(o.tag)}</span>`:""}${o.aside||""}<a class="pk-sec-ed" data-pjump="${id}" title="${L2("Bewerken","Edit")}">✎</a></span></div>${body}</div>`}
function grp(title,pairs){const f=pairs.filter(x=>x[1]!=null&&x[1]!=="");return f.length?`<div class="pk-grp">${title}</div>${kv(f)}`:""}
function propFeatures(p,raw,o,K,XL,m){
  const price=p.price, prev=p.previous_price&&p.previous_price!=p.price?Number(p.previous_price):null;
  const chg=prev&&price?Math.round((price-prev)/prev*100):null;
  const m2=price&&p.build_area?Math.round(price/p.build_area):null;
  const sea=raw.distance_sea&&Number(raw.distance_sea)!==7000?num(raw.distance_sea)+" m":null;
  const yr=raw.year_built&&raw.year_built!=="0"?raw.year_built:null;
  const age=yr&&/^\d{4}$/.test(yr)?new Date().getFullYear()-Number(yr):null;
  const fz=(PR.detail&&PR.detail.features)||[], pP=fz.includes("pool"), pC=fz.includes("communal_pool");
  const pool=pP&&pC?L2("Privé én gemeenschappelijk","Private and communal"):pP?L2("Privé zwembad","Private pool"):pC?L2("Gemeenschappelijk zwembad","Communal pool"):L2("Geen zwembad","No pool");
  const offered=p.is_external?(p.external_agency||t("external"))+(raw.external_refnr?" · "+raw.external_refnr:""):t("p.owngs");
  const tile=(ic,val,lbl)=>`<div><span class="fi">${ic}</span><b>${val}</b><span>${lbl}</span></div>`;
  const D=PR.detail||{}, S=Object.assign({},PR.sale||{}); delete S.deed_price; /* Rick 20-10-2026: aktewaarde weg uit Status & verkoop, staat al onder eigendomsakte */
  const yn=b=>b?L2("Ja","Yes"):null, m2u=v=>v?num(v)+" m²":null;
  const dist=v=>v==null||v===""?null:(v>=1000?(Math.round(v/100)/10).toLocaleString(LOC())+" km":num(v)+" m");
  const nWith=(a,b,lbl)=>a==null?null:(b?`${a} <span class="muted sm">(${L2("waarvan","of which")} ${b} ${lbl})</span>`:String(a));
  const area=D.loc_area||D.suburb||D.location_area||p.suburb;
  const town=D.city||D.loc_municipality||p.town;
  const fullAddr=[[D.street,D.street_number].filter(Boolean).join(" "),[D.postal_code,town].filter(Boolean).join(" "),D.province||p.province].filter(Boolean).join(", ");
  const mapHref=D.lat&&D.lng?`https://www.google.com/maps/search/?api=1&query=${D.lat},${D.lng}`:(fullAddr?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddr)}`:null);
  const LBL={exclusive:["Exclusief","Exclusive"],featured:["Uitgelicht","Featured"],reduced:["Prijs verlaagd","Price reduced"],new:["Nieuw","New"],sold:["Verkocht","Sold"]};
  const priceMode=[D.price_on_request&&L2("Prijs op aanvraag","Price on request"),D.price_hidden&&L2("Prijs verborgen op site","Price hidden on site"),D.price_fixed&&L2("Vaste prijs","Fixed price"),p.price_from&&L2("Vanafprijs","From-price")].filter(Boolean).join(" · ");
  const feeds=D.no_export?L2("Uitgesloten van alle feeds","Excluded from all feeds"):(D.export_feeds||[]).length?D.export_feeds.join(", "):(p.is_own&&p.core_status==="available"?L2("Idealista + partnerfeeds","Idealista + partner feeds"):null);
  const fees=[[L2("Notaris","Notary"),D.fee_notary],[L2("Registro","Land registry"),D.fee_registry],[L2("Advocaat","Lawyer"),D.fee_legal],[L2("Overdrachtsbelasting","Transfer tax"),D.fee_transfer_tax]];
  const costs=[[L2("Gemeenschapskosten","Community fees"),D.cost_community],["IBI",D.cost_ibi],[L2("Vuilnisbelasting","Waste tax"),D.cost_garbage],[L2("Verzekering","Insurance"),D.cost_insurance]];
  const feeSum=fees.reduce((a,x)=>a+(Number(x[1])||0),0);
  const lst=D.listed_at||p.list_date;
  const desc=(LANG==="en"?D.desc_en||D.desc_nl:D.desc_nl||D.desc_en)||"";
  const descTxt=desc?(new DOMParser().parseFromString(desc.replace(/<\/(p|li|h\d)>|<br\s*\/?>/gi,"\n"),"text/html").body.textContent||"").replace(/\n{3,}/g,"\n\n").trim():"";
  return `<div class="pk"><div class="pk-flow">
    <div class="pk-jump">${PKSEC.map(x=>`<a data-pks="${x[0]}" style="--sc:${x[2]}">${L2(...x[1])}</a>`).join("")}</div>
  <div class="pk-main">
    <div class="hero" style="${raw.image?`background-image:url('${esc(raw.image)}')`:""}"><span class="pr">${eur(price)}</span></div>
    <div class="pricebox">
      <div class="pb-now"><span class="lbl">${L2("Huidige vraagprijs","Current asking price")}</span><b>${eur(price)}</b>
        ${prev?`<span class="pb-prev"><s>${eur(prev)}</s> <span class="pb-chg ${chg<0?"down":"up"}">${chg>0?"+":""}${chg}%</span> <span class="muted">${L2("sinds","since")} ${fdate(p.price_changedate)}</span></span>`:""}</div>
      <div class="pb-side">
        ${m2?`<div><b>${eur(m2)}</b><span>${L2("per m² woonoppervlak","per m² living area")}</span></div>`:""}
        ${p.list_date?`<div><b>${since(p.list_date)}</b><span>${L2("op de markt, sinds","on the market, since")} ${fdate(p.list_date)}</span></div>`:""}
      </div>
    </div>
    <div class="facts big">${tile("🛏",p.bedrooms??"—",t("fa.beds"))}${tile("🛁",p.bathrooms??"—",t("fa.baths"))}${(()=>{const F=areaFlag(p,PR.catastro);return F?`<div class="af-tile af-${F.lvl}" title="${esc(areaFlagTip(F))}"><span class="fi">${areaFlagIcon(F,20)}</span><b>${num(p.build_area)} m²</b><span>${t("fa.build")} · <b class="af-pct">${F.pct>0?"+":""}${F.pct}% ${L2("vs kadaster","vs cadastre")}</b></span></div>`:tile("📐",p.build_area?num(p.build_area)+" m²":"—",t("fa.build"))})()}${tile("🌳",p.plot_area?num(p.plot_area)+" m²":"—",t("fa.plot"))}</div>
    <div class="pk-sub">${L2("Belangstelling","Interest")}</div>
    <div class="facts">${tile("👁",num(raw.hits_total),t("fa.hits"))}${tile("⚡",raw.hits_today??"—",t("fa.today"))}${tile("✉",num(m.sent||0),t("fa.mailed"))}${tile("✓",num(m.converted||0),t("fa.conv"))}</div>
  </div>
  <div class="pk-side">
    <div class="pk-sa">
    ${p.is_external?extBox(p,raw,XL):""}
    ${/* Rick 20-10-2026: eigenaarspaneel weg, de eigenaar staat al in de kop van de woning */""}
    ${Object.keys(S).length?pkSec("status",L2("Status & verkoop","Status & sale"),kv([
      [L2("Verkoopprijs","Sale price"),S.sold_price!=null?eur(S.sold_price):null],
      [L2("Verkoopdatum","Sale date"),S.sold_date?fdate(S.sold_date):null],
      [L2("Notaris","Notary"),[S.notary,S.notary_protocol&&("prot. "+S.notary_protocol)].filter(Boolean).join(" · ")],
      [L2("Verkocht door (intern)","Sold by (internal)"),S.sold_agent],
      [L2("Verkocht door (extern)","Sold by (external)"),S.sold_agent_ext],
      [L2("Commissie A","Commission A"),S.commission_a!=null?eur(S.commission_a):null],
      [L2("Commissie B","Commission B"),S.commission_b!=null?eur(S.commission_b):null],
      [L2("Commissie uit","Commission out"),S.commission_out!=null?eur(S.commission_out):null],
      ["Conveyancing",S.conveyancing!=null?eur(S.conveyancing):null],
      [L2("Notitie","Note"),S.commission_note]]),{tag:"admin"}):""}
    ${pkSec("basis",L2("Basis","Basics"),kv([
      [L2("Status","Status"),stLabel(p.core_status)],
      [t("p.type"),p.property_type?esc(cap(p.property_type))+(D.object_style?` <span class="muted sm">· ${esc(cap(D.object_style))}</span>`:""):null,1],
      [L2("Bouw","Build"),p.is_newbuild?L2("Nieuwbouw","New build"):D.build_type==="resale"?L2("Bestaande bouw","Resale"):D.build_type],
      [t("p.mandate"),D.own_listing_type?(MANDATE[D.own_listing_type]?L2(...MANDATE[D.own_listing_type]):D.own_listing_type):raw.authority?(MANDATE[raw.authority]?L2(...MANDATE[raw.authority]):raw.authority):null],
      [L2("Referentie","Reference"),`<b>${esc(p.reference)}</b>`,1],
      [t("p.offeredby"),offered],
      [t("p.year"),yr?`${esc(yr)}${age!=null&&age>=0?` <span class="muted sm">· ${L2(age+" jaar oud",age+" years old")}</span>`:""}`:null,1],
      [L2("In aanbod sinds","Listed since"),lst?`${fdate(lst)} <span class="muted sm">· ${since(lst)}</span>`:null,1],
      [L2("Makelaar","Listing agent"),p.rep?`<b style="color:${REPC[p.rep]||"#94a3b8"}">${esc(rep(p.rep))}</b>`:null,1],
      [L2("Sleutelnummer","Key number"),D.key_number?`🔑 ${esc(D.key_number)}`:raw.keydetails||null,1],
      [L2("Dossier","File"),p.is_own?(D.dossier_complete?L2("Compleet","Complete"):L2("Nog niet compleet","Not yet complete")):null],
      [t("p.srccontact"),[raw.external_phone,raw.external_email].filter(Boolean).join(" · ")]]))}
    ${pkSec("prijs",L2("Prijs","Price"),kv([
      [L2("Vraagprijs","Asking price"),`<b class="pk-price">${eur(price)}</b>${p.price_from||D.price_from?` <span class="muted sm">(${L2("vanafprijs","from-price")})</span>`:""}`,1],
      [t("p.prevprice"),prev?`${eur(prev)} <span class="muted sm">· ${L2("gewijzigd","changed")} ${fdate(p.price_changedate)}${chg!=null?` · ${chg>0?"+":""}${chg}%`:""}</span>`:null,1],
      [L2("Per m²","Per m²"),m2?eur(m2):null],
      [L2("Prijsweergave","Price display"),priceMode||null]]))}
    ${pkSec("loc",L2("Locatie","Location"),kv([
      [L2("Gemeente","Municipality"),D.loc_municipality||town],
      [L2("Wijk / urbanisatie","Area / urbanisation"),area],
      [L2("Straat","Street"),[D.street||raw.street,D.street_number].filter(Boolean).join(" ")||null],
      [L2("Postcode","Postcode"),D.postal_code||raw.postal_code],
      [L2("Provincie","Province"),D.province||p.province],
      [L2("Land","Country"),D.country?(D.country==="Spain"?L2("Spanje","Spain"):D.country):null],
      [t("p.orient"),orientHtml(D.orientation||raw.orientation),1],
      [t("p.view"),viewHtml(D.views||raw.view),1],
      [L2("Kaart","Map"),(D.lat&&D.lng?`${Number(D.lat).toFixed(5)}, ${Number(D.lng).toFixed(5)}`:L2("Geen coördinaten","No coordinates"))+(p.is_own?` <span class="muted sm">· ${D.hide_address?L2("verborgen op site","hidden on site"):L2("zichtbaar op site","visible on site")}</span>`:""),1]]),{aside:mapHref?`<a class="tag" href="${esc(mapHref)}" target="_blank" rel="noopener">${L2("Kaart","Map")} ↗</a>`:""})}
    ${pkSec("ind",L2("Indeling en oppervlaktes","Layout and areas"),
      grp(L2("Kamers","Rooms"),[[L2("Slaapkamers","Bedrooms"),p.bedrooms],[L2("Badkamers","Bathrooms"),p.bathrooms],[L2("Toiletten","Toilets"),D.toilets],["En-suite",D.ensuites],[L2("Woonkamers","Living rooms"),D.living_rooms],[L2("Keukens","Kitchens"),D.kitchens]])
      +grp(L2("Oppervlakte","Surface"),[[L2("Bebouwd","Built"),(()=>{const F=areaFlag(p,PR.catastro);return p.build_area?`${num(p.build_area)} m²${F?` <span class="af-inl af-${F.lvl}" title="${esc(areaFlagTip(F))}">${areaFlagIcon(F,14)} ${F.pct>0?"+":""}${F.pct}%</span>`:""}`:null})(),1],[L2("Perceel","Plot"),m2u(p.plot_area)],[t("p.energy"),energyHtml(D.energy_label||raw.energy_label),1]])
      +grp(L2("Overig","Other"),[[L2("Verdiepingen","Floors"),D.floors],[L2("Etage","Level"),D.floor_level],[L2("Balkons","Balconies"),D.balconies],[L2("Patio's","Patios"),D.patios],[L2("Terrassen","Terraces"),D.terraces],[L2("Garages","Garages"),D.garages],["Carports",D.carports],[L2("Open parkeerplekken","Open parking spaces"),D.parking_spaces]])
      +grp(L2("Afstanden","Distances"),[[L2("Zee","Sea"),sea],[L2("Luchthaven","Airport"),dist(D.dist_airport)],[L2("Centrum","Town centre"),dist(D.dist_city)],[L2("Winkels","Shops"),dist(D.dist_shops)]]))}
    ${pkSec("ken",L2("Kenmerken","Features"),window.NEXUS_FEAT&&NEXUS_FEAT.view?`<div class="pk-fx">${NEXUS_FEAT.view(D.features,D.feature_options,{tr:x=>L2(...x)})}</div>`:propFeatureList(D))}
    ${pkSec("tekst",L2("Teksten","Texts"),(descTxt?`<div class="pk-desc">${esc(descTxt)}</div>`:`<div class="empty sm">${L2("Nog geen omschrijving","No description yet")}</div>`)
      +((D.internal_notes||raw.internal_notes)?`<div class="pk-grp">${L2("Interne notities","Internal notes")}</div><div class="pk-notes" style="margin:0 14px 12px">${esc(D.internal_notes||raw.internal_notes)}</div>`:""),{tag:D.desc_nl&&D.desc_en?(LANG==="en"?"EN":"NL"):""})}
    ${/* BESLUIT Rick 18-10-2026 (herbevestigd 19-10): GEEN kosten koper en geen vaste lasten in het woningdetail. Niet terugzetten. */""}
    ${pkSec("kost",L2("Eigendomsakte","Title deed"),
      grp(L2("Kadaster en registro","Cadastre and registry"),[["Registro",D.registry_name],[L2("Fincanummer","Finca number"),D.finca_number],[L2("Kadastrale referentie","Cadastral ref."),D.cadastral_ref],["IDUFIR / CRU",D.idufir],
        [L2("Inschrijving","Inscription"),[D.registry_tomo&&"Tomo "+D.registry_tomo,D.registry_libro&&"Libro "+D.registry_libro,D.registry_folio&&"Folio "+D.registry_folio,D.registry_inscription&&L2("Inscr. ","Inscr. ")+D.registry_inscription].filter(Boolean).join(" · ")||null]])
      +grp(L2("Oppervlakte volgens akte","Areas per deed"),[[L2("Bebouwd","Built"),m2u(D.deed_build_area)],[L2("Kavel","Plot"),m2u(D.deed_plot_area)]])
      +grp(L2("Aankoop huidige eigenaar","Purchase by current owner"),[[L2("Datum aankoop","Purchase date"),D.purchase_date?fdate(D.purchase_date):null],[L2("Aankoopprijs","Purchase price"),D.purchase_price!=null?eur(D.purchase_price):null],
        [L2("Overdrachtsbelasting","Transfer tax"),D.purchase_tax!=null?eur(D.purchase_tax)+(D.purchase_tax_type?` <span class="muted sm">· ${esc(D.purchase_tax_type)}</span>`:""):null,1],
        [L2("Notaris","Notary"),D.purchase_notary],[L2("Protocolnummer","Protocol number"),D.purchase_notary_protocol]])
      +(D.deed_read_at?`<div class="muted sm" style="margin:0 14px 10px">📄 ${L2("Akte ingelezen op ","Deed read on ")}${fdate(D.deed_read_at)}</div>`:""))}
    ${catSummary(K,p)}
    ${propExtData(p)}
    ${pkSec("pub",L2("Publicatie","Publishing"),kv([
      [L2("Op de website","On the website"),p.is_own||D.published!=null?(D.published?`<span style="color:#22c55e">● ${L2("Online","Online")}</span>${D.published_at?` <span class="muted sm">· ${L2("sinds","since")} ${fdate(D.published_at)}</span>`:""}`:`<span class="muted">○ ${L2("Offline","Offline")}</span>`)+` <span class="muted sm">(${L2("volgt status","follows status")})</span>`:null,1],
      [L2("Labels","Labels"),(D.labels||[]).length?D.labels.map(x=>LBL[x]?L2(...LBL[x]):String(x).toUpperCase()).join(" · "):null],
      [L2("Feeds","Feeds"),feeds],
      [L2("Gereserveerd sinds","Reserved since"),D.under_offer_at?fdate(D.under_offer_at):null],
      [L2("Ingetrokken op","Withdrawn on"),D.withdrawn_at?fdate(D.withdrawn_at):null],
      [t("p.notary"),S.notary?null:raw.sold_notary]]))}
  </div></div></div>
  <aside class="pk-photos" id="pkPhotos" aria-label="${L2("Foto's","Photos")}"><div class="pk-ph-h">${L2("Foto's","Photos")}</div><div class="pk-ph-list"><div class="loader sm">…</div></div></aside>
  <div class="card pk-wide" id="pkLog"><div class="hd"><h3>${L2("Wijzigingslog","Change log")}</h3></div><div class="pk-log-nx"><div class="loader sm">…</div></div>${raw.changelog?`<div class="sm muted" style="margin-top:10px">${L2("Historie uit het oude WordPress (tot 18 okt 2026)","History from the old WordPress (until 18 Oct 2026)")}</div><div class="note">${esc(raw.changelog.replace(/<br\s*\/?>/gi,"\n"))}</div>`:""}</div>
  </div>`;
}
const FEAT={pool:["Privé zwembad","Private pool"],communal_pool:["Gemeenschappelijk zwembad","Communal pool"],air_conditioning:["Airco","Air conditioning"],air_conditioning_preinstalled:["Airco voorbereid","A/C pre-installed"],split_aircon:["Split-airco","Split A/C"],ducted_cooling:["Kanaalkoeling","Ducted cooling"],ducted_heating:["Kanaalverwarming","Ducted heating"],central_heating:["Centrale verwarming","Central heating"],gas_heating:["Gasverwarming","Gas heating"],split_heating:["Split-verwarming","Split heating"],underfloor_heating:["Vloerverwarming","Underfloor heating"],fireplace:["Open haard","Fireplace"],furnished:["Gemeubileerd","Furnished"],semi_furnished:["Deels gemeubileerd","Semi-furnished"],secure_parking:["Afgesloten parkeren","Secure parking"],remote_garage:["Garage met afstandsbediening","Remote garage"],fully_fenced:["Volledig omheind","Fully fenced"],security_system:["Alarmsysteem","Security system"],intercom:["Intercom","Intercom"],solarium:["Solarium","Solarium"],courtyard:["Binnenplaats","Courtyard"],outdoor_entertaining:["Buitenleven","Outdoor entertaining"],basement:["Kelder","Basement"],storage_shed:["Berging","Storage shed"],study:["Studeerkamer","Study"],workshop:["Werkplaats","Workshop"]};
const FOG={kitchen:["Keuken","Kitchen"],garden:["Tuin","Garden"],pool:["Zwembad","Pool"],community:["Gemeenschap","Community"],floor:["Vloer","Floor"],heating:["Verwarming","Heating"],aircon:["Airco","A/C"],terrace:["Terras","Terrace"],property:["Woning","Property"],more:["Overig","Other"]};
function propFeatureList(D){
  const f=(D.features||[]).map(x=>FEAT[x]?L2(...FEAT[x]):cap(String(x).replace(/_/g," ")));
  const o=D.feature_options||{}, g=Object.keys(o).filter(k=>k!=="feed"&&Array.isArray(o[k])&&o[k].length);
  if(!f.length&&!g.length)return "";
  return `<div class="card pk-card"><div class="hd"><h3>${L2("Voorzieningen","Features")}</h3><span class="tag">${f.length+g.reduce((a,k)=>a+o[k].length,0)}</span></div>
    ${f.length?`<div class="pk-chips" style="padding:10px 14px 4px">${f.map(x=>`<span class="pk-chip on">${esc(x)}</span>`).join("")}</div>`:""}
    ${g.length?`<dl class="kv" style="grid-template-columns:110px 1fr">${g.map(k=>`<dt>${esc(FOG[k]?L2(...FOG[k]):cap(k))}</dt><dd><div class="pk-chips">${o[k].map(v=>`<span class="pk-chip">${esc(cap(String(v)))}</span>`).join("")}</div></dd>`).join("")}</dl>`:""}</div>`}
/* alle foto's van de woning als verticale strip; klik = grote foto bovenaan, klik op de grote foto = volle grootte */
const PHOTO_CACHE={};
/* wijzigingslog: live uit core.audit_log + core.property_price_history via nexus_property_edit (zelfde bron als Historie in het bewerkscherm).
   Prijswijzigingen door de partnerfeed staan alleen in de prijshistorie; die komen hier ook bij. */
async function loadPropLog(p){const box=document.querySelector("#pkLog .pk-log-nx");if(!box||!p.reference)return;
  const fmt=d=>NEXUS_DMYT(d);
  try{const d=await rpc("nexus_property_edit",{p_ref:p.reference});
    const ev=((d&&d.audit)||[]).map(x=>({at:x.at,html:`${esc(x.who||L2("systeem","system"))} <span class="muted">· ${esc((x.fields||[]).join(", "))}</span>`}));
    const ph=((d&&d.price_history)||[]).slice().sort((a,b)=>new Date(a.changed_at||a.at)-new Date(b.changed_at||b.at));
    ph.forEach((h,k)=>{if(!k)return;const at=h.changed_at||h.at, prev=ph[k-1].price;if(prev==h.price)return;
      const src=String(h.source||"");const who=src.startsWith("feed:")?L2("partnerfeed ","partner feed ")+src.slice(5):src==="nexus"?"NEXUS":src==="cpr_import"?"WordPress-import":src;
      const pct=prev?Math.round((h.price-prev)/prev*100):null;
      ev.push({at,html:`${L2("Prijs","Price")} ${eur(prev)} → <b>${eur(h.price)}</b>${pct!=null?` <span class="muted">(${pct>0?"+":""}${pct}%)</span>`:""} <span class="muted">· ${esc(who)}</span>`})});
    ev.sort((a,b)=>new Date(b.at)-new Date(a.at));
    box.innerHTML=ev.length?ev.slice(0,25).map(x=>`<div><b>${fmt(x.at)}</b> · ${x.html}</div>`).join("")
      :`<div class="sm muted">${L2("Nog geen wijzigingen via NEXUS.","No changes via NEXUS yet.")}</div>`}
  catch(e){box.innerHTML=`<div class="sm muted">${L2("Log niet beschikbaar.","Log unavailable.")}</div>`}}
async function loadPropPhotos(p,raw){
  const box=$("#pkPhotos .pk-ph-list"); if(!box||!p.id)return;
  let urls=PHOTO_CACHE[p.id];
  if(!urls){try{urls=await rpc("nexus_property_photos",{p_id:p.id})||[]}catch(e){urls=[]}PHOTO_CACHE[p.id]=urls}
  const cur=$("#pkPhotos .pk-ph-list"); if(!cur||!PR||PR.property.id!==p.id)return;
  if(!urls.length){cur.innerHTML=`<div class="muted sm">${L2("Geen foto's","No photos")}</div>`;return}
  $("#pkPhotos .pk-ph-h").textContent=`${L2("Foto's","Photos")} (${urls.length})`;
  cur.innerHTML=urls.map((u,i)=>`<button type="button" class="pk-ph${i===0?" on":""}" data-u="${esc(u)}" title="${i+1}/${urls.length}"><img loading="lazy" src="${esc(u)}" alt=""></button>`).join("");
  const hero=$("#prBody .pk .hero");
  if(hero){hero.style.cursor="zoom-in";hero.dataset.u=urls[0];if(!raw.image)hero.style.backgroundImage=`url('${urls[0].replace(/'/g,"%27")}')`;hero.onclick=()=>{if(hero.dataset.u)window.open(hero.dataset.u,"_blank","noopener")}}
  cur.querySelectorAll(".pk-ph").forEach(b=>b.onclick=()=>{
    cur.querySelectorAll(".pk-ph").forEach(x=>x.classList.toggle("on",x===b));
    if(hero){hero.style.backgroundImage=`url('${b.dataset.u.replace(/'/g,"%27")}')`;hero.dataset.u=b.dataset.u;hero.scrollIntoView({behavior:"smooth",block:"nearest"})}
  });
}
/* contactgegevens van de eigenaar (of de aanbiedende partner) bovenaan de woning */
function ownerContactStrip(o,raw,p){
  const tel=v=>String(v).replace(/[^\d+]/g,""), wa=v=>tel(v).replace(/^\+/,"").replace(/^00/,"");
  const phones=[...new Set([].concat(o&&o.phones&&o.phones.length?o.phones.map(x=>x.value||x):(o&&o.phone?[o.phone]:[]),p.is_external&&raw.external_phone?[raw.external_phone]:[]).filter(Boolean).flatMap(v=>String(v).split(/\s*[,;\/]\s*/)).filter(v=>tel(v).length>=6))];
  const mails=[...new Set([].concat(o&&o.email?[o.email]:[],p.is_external&&raw.external_email?[raw.external_email]:[]).filter(Boolean))];
  if(!phones.length&&!mails.length)return "";
  return `<div class="cstrip">${phones.map(v=>`<span class="cpill"><a href="tel:${esc(tel(v))}">☎ ${esc(v)}</a><a class="wa" href="https://wa.me/${esc(wa(v))}" target="_blank" rel="noopener" title="WhatsApp">WA</a></span>`).join("")}${mails.map(e=>`<span class="cpill"><a href="mailto:${esc(e)}">✉ ${esc(e)}</a></span>`).join("")}</div>`;
}
function ownerBox(o){
  if(!o)return `<div class="ownerbox" style="cursor:default;border-style:dashed"><span class="muted sm">${t("p.noowner")}</span></div>`;
  const lbl=o.co?t("o.coowner"):o.is_agent?t("p.agentc"):t("p.owner");
  return `<div class="ownerbox" data-c="${esc(o.id||o.wp_id)}"><div class="ini" style="background:${hue(o.name||o.email)};width:38px;height:38px">${esc(initials(o.name||o.email))}</div>
    <div style="min-width:0"><div class="sm muted">${lbl}</div><div style="font-weight:700">${esc(o.name||o.email)}</div>
    <div class="sm muted">${[o.email,o.phone].filter(Boolean).map(esc).join(" · ")}</div></div><span class="go">${t("p.openowner")}</span></div>`}
function extBox(p,raw,L){
  const phone=raw.external_phone, mail=raw.external_email;
  return `<div class="extbox"><div style="min-width:0"><div class="sm muted">${t("ext.partner")}</div><div style="font-weight:700;font-size:calc(15px*var(--fs,1))">${esc(p.external_agency||t("external"))}</div>
    <div class="sm">${raw.external_refnr?`${t("ext.theirref")}: <b class="mono">${esc(raw.external_refnr)}</b>`:""}${phone?` · <a href="tel:${esc(String(phone).replace(/[^\d+]/g,""))}">☎ ${esc(phone)}</a>`:""}${mail?` · <a href="mailto:${esc(mail)}">✉ ${esc(mail)}</a>`:""}</div>
    ${L&&!L.exact?`<div class="sm muted" style="margin-top:3px">${t("ext.nourl")}</div>`:""}</div>
    ${L?`<a class="go-ext" href="${esc(L.href)}" target="_blank" rel="noopener">${L.exact?t("ext.open",{a:esc(p.external_agency||t("external"))}):t("ext.search")} ↗</a>`:""}</div>`}
/* oppervlakte-signaal (besluit Rick 19-10): afwijking geadverteerd bebouwd m² t.o.v. Catastro.
   >20% = rood stopbord, 10-20% = amber, <10% = geen signaal. Alleen eigen woningen. */
function areaFlag(p,k){
  if(!p||!p.is_own)return null; /* alleen eigen woningen (Rick 19-10): op partnerwoningen hebben we geen invloed */
  if(!k||!k.cadastral_ref||!(k.build_area_m2>0)||!(p.build_area>0))return null;
  const r=(p.build_area-k.build_area_m2)/k.build_area_m2*100, a=Math.abs(r);
  if(a<10)return null;
  return {lvl:a>20?"red":"amber",pct:Math.round(r),adv:p.build_area,cat:k.build_area_m2};
}
function areaFlagIcon(f,sz){if(!f)return "";sz=sz||18;
  return `<svg class="af-oct af-${f.lvl}" width="${sz}" height="${sz}" viewBox="0 0 24 24" aria-hidden="true"><polygon points="7,1 17,1 23,7 23,17 17,23 7,23 1,17 1,7" fill="currentColor" stroke="#fff" stroke-width="1.5"/>${f.lvl==="red"?'<rect x="5" y="10.5" width="14" height="3" rx="1" fill="#fff"/>':'<rect x="10.75" y="5.5" width="2.5" height="8.5" rx="1" fill="#fff"/><circle cx="12" cy="17.5" r="1.5" fill="#fff"/>'}</svg>`}
function areaFlagTip(f){return f?L2(`Bebouwde oppervlakte wijkt ${f.pct>0?"+":""}${f.pct}% af van het kadaster: geadverteerd ${num(f.adv)} m², Catastro ${num(f.cat)} m²`,`Built area deviates ${f.pct>0?"+":""}${f.pct}% from the cadastre: advertised ${num(f.adv)} m², Catastro ${num(f.cat)} m²`):""}
function areaFlagBadge(f){if(!f)return "";
  return `<span class="af-badge af-${f.lvl}" title="${esc(areaFlagTip(f))}">${areaFlagIcon(f,18)}<b>m² ${f.pct>0?"+":""}${f.pct}% ${L2("vs kadaster","vs cadastre")}</b></span>`}
function catSummary(k,p){
  if(!k)return "";
  if(!k.cadastral_ref)return `<div class="catbox off"><b>Catastro</b> <span class="sm muted">· ${esc(k.status==="not_found"?t("k.notfound"):k.status||"")}${k.error?" · "+esc(k.error):""}${k.checked_at?" · "+ago(k.checked_at):""}</span></div>`;
  const diff=k.build_area_m2!=null&&p.build_area?Math.round((p.build_area-k.build_area_m2)/k.build_area_m2*100):null;
  return `<div class="catbox"><div class="cat-h"><b>Catastro</b><span class="tag">${esc(k.match_quality||k.match_method||"")}</span>
      <a class="mono cat-ref" href="${esc(catUrl(k.cadastral_ref))}" target="_blank" rel="noopener" title="Sede Electrónica del Catastro">${esc(k.cadastral_ref)} ↗</a>
      <a class="sm" href="${esc(catMap(k.cadastral_ref))}" target="_blank" rel="noopener">${t("k.map")} ↗</a></div>
    <div class="facts" style="margin:10px 0 0">
      <div><b>${k.build_area_m2!=null?num(k.build_area_m2)+" m²":"—"}</b><span>${t("k.built")}${(()=>{const F=areaFlag(p,k);return F?` · <span class="af-inl af-${F.lvl}" title="${esc(areaFlagTip(F))}">${areaFlagIcon(F,13)} ${L2("geadv.","adv.")} ${F.pct>0?"+":""}${F.pct}%</span>`:""})()}</span></div>
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
  const pdel=d.querySelector("[data-pdel]");if(pdel)pdel.onclick=()=>delProperty(p);
  const e=d.querySelector("[data-edit]");if(e)e.onclick=()=>window.NEXUS_EDIT&&NEXUS_EDIT.open(p.reference,editCtx());
  d.querySelectorAll("[data-qs]").forEach(b=>b.onclick=async()=>{const s=b.dataset.qs;if(s===p.core_status)return;
    /* Rick 20-10-2026: Verkocht nooit zonder verkoopdatum -> naar het bewerkscherm, sectie Verkoop, status staat al op Verkocht */
    if(s==="sold"){const c=editCtx("sale");c.preset={status:"sold"};NEXUS_EDIT.open(p.reference,c);return}
    const sd=PR&&PR.property&&PR.property.sold_date;
    if(!confirm(t("qs.confirm",{r:p.reference,s:stLabel(s)})+(p.core_status==="sold"&&sd?"\n\n"+L2(`De verkoopdatum (${fdate(sd)}) wordt leeggemaakt.`,`The sale date (${fdate(sd)}) will be cleared.`):"")))return;
    b.disabled=true;
    try{await rpc("nexus_property_save",{p_id:p.id,p_patch:p.core_status==="sold"&&sd?{status:s,sold_date:null}:{status:s},p_texts:{},p_base:p.updated_at});
      await openProp(p.reference);loadProps(true);ovLoaded=false;mpData=null;
    }catch(err){b.disabled=false;alert(err.code==="40001"?t("qs.conflict"):(err.message||String(err)));if(err.code==="40001")openProp(p.reference)}});
}
/* kadaster- en marktgegevens: staan bij de kenmerken (besluit Rick 18-10), niet op foto's of in een aparte tab */
function propExtData(p){const k=PR.catastro;
    const kc=k&&k.cadastral_ref?`<div class="card" style="margin-bottom:12px"><div class="hd"><h3>${L2("Kadastergegevens","Cadastral details")}</h3><span class="tag">Catastro · ${ago(k.checked_at)}</span></div>${kv([[t("k.cadref"),`<a class="mono" href="${esc(catUrl(k.cadastral_ref))}" target="_blank" rel="noopener">${esc(k.cadastral_ref)} ↗</a>`,1],[t("k.parcel"),k.parcel_ref],[t("k.unit"),[k.cat_block&&"bl. "+k.cat_block,k.cat_stair&&"esc. "+k.cat_stair,k.cat_floor&&"pl. "+k.cat_floor,k.cat_door&&"pta. "+k.cat_door].filter(Boolean).join(" · ")],[t("k.landclass"),k.land_class],[t("k.share"),k.participation_pct!=null?k.participation_pct+" %":null],[t("k.cataddr"),[k.cat_address,k.cat_postal_code,k.cat_municipality].filter(Boolean).join(", ")],[t("k.use"),k.use_class],[t("k.year"),k.year_built],[t("k.built"),k.build_area_m2!=null?num(k.build_area_m2)+" m²"+(p.build_area?` <span class="sm muted">(${L2("advertentie","listing")}: ${num(p.build_area)} m²)</span>`:""):null,1],[t("k.living"),[k.living_area_m2&&num(k.living_area_m2)+" m² "+t("k.living.w"),k.terrace_area_m2&&num(k.terrace_area_m2)+" m² "+t("k.living.t"),k.pool_area_m2&&num(k.pool_area_m2)+" m² "+t("k.living.p")].filter(Boolean).join(" · ")],[t("k.plot"),k.parcel_area_m2!=null?num(k.parcel_area_m2)+" m²":null],[t("k.building"),k.building_dwellings?t("k.dwellings",{a:k.building_dwellings,b:k.building_floors_above||"?"}):null]].map(x=>x[2]?x:[x[0],x[1]]))}</div>`
      :"";
    const pc=`<div class="card" id="pkMarket" style="margin-bottom:12px"><div class="hd"><h3>${L2("Markt","Market")}</h3></div><div class="pk-mk"><div class="loader sm">…</div></div></div>`;
    return kc+catElements(k)+pc+((PR.enrichment||[]).length?enrichList(PR.enrichment,"property"):"");}
/* ---------- woning: blok Markt (alleen NEXUS, nooit op de publieke site) ----------
   Bron: rpc nexus_property_market. Rij 1 prijspositie t.o.v. Idealista-vraagprijzen in de plaats,
   rij 2 officiële verkopen in de gemeente (MIVAU) met sparkline, rij 3 taxatiewaarde (alleen gemeenten >25.000 inw.).
   Ontbreekt een onderdeel, dan wordt die rij weggelaten. */
const MK_CACHE={};
async function loadPropMarket(p){const box=document.querySelector("#pkMarket .pk-mk");if(!box||!p.id)return;
  let m=MK_CACHE[p.id];
  if(m===undefined){try{m=await rpc("nexus_property_market",{p_id:p.id})}catch(e){m=null}MK_CACHE[p.id]=m}
  const cur=document.querySelector("#pkMarket .pk-mk");if(!cur||!PR||PR.property.id!==p.id)return;
  const html=m?marketHtml(m):"";
  if(!html){document.getElementById("pkMarket").remove();return}
  cur.innerHTML=html}
function marketHtml(m){
  const I=m.idealista, O=m.official, S=m.series||[], rows=[];
  const pct=v=>v==null?"":(v>0?"+":v<0?"−":"±")+Math.abs(Number(v)).toLocaleString(LOC(),{maximumFractionDigits:1})+"%";
  const qtr=d=>{const x=new Date(d);return "Q"+(Math.floor(x.getUTCMonth()/3)+1)+" "+x.getUTCFullYear()};
  const mon=d=>new Date(d).toLocaleDateString(LOC(),{month:"long",year:"numeric",timeZone:"UTC"});
  const SEG={apartment:["appartementen","apartments"],bungalow:["bungalows","bungalows"],penthouse:["penthouses","penthouses"],townhouse:["geschakelde woningen","townhouses"],villa:["villa's","villas"],all:["alle woningen","all homes"]};
  const segL=s=>SEG[s]?L2(...SEG[s]):s;
  /* rij 1: prijspositie */
  if(I&&I.median_m2){
    const lo=Math.min(I.p25,m.ask_m2||I.p25), hi=Math.max(I.p75,m.ask_m2||I.p75), pad=(hi-lo)*0.12||100, a=lo-pad, b=hi+pad, x=v=>((v-a)/(b-a)*100).toFixed(1);
    const pos={below:[L2("onder markt","below market"),"#34d399"],in:[L2("in markt","in market"),"#94a3b8"],above:[L2("boven markt","above market"),"#f87171"]}[I.position];
    rows.push(`<div class="mk-row"><div class="mk-h">${L2("Prijspositie","Price position")} <span class="muted">· ${esc(I.town||m.town||"")} · ${esc(segL(I.segment))}</span>${pos?`<span class="mk-lbl" style="--mc:${pos[1]}">${pos[0]}</span>`:""}</div>
      <div class="mk-nums"><div><b>${eur(m.ask_m2)}</b><span>${L2("vraagprijs / m²","asking / m²")}${m.ask_m2_basis?` · ${m.ask_m2_basis==="catastro"?"Catastro":L2("eigen","own")} ${num(m.area_m2)} m²`:""}</span></div>
        <div><b>${eur(I.median_m2)}</b><span>${L2("mediaan Idealista","Idealista median")}</span></div>
        ${I.deviation_pct!=null?`<div><b style="color:${pos?pos[1]:"inherit"}">${pct(I.deviation_pct)}</b><span>${L2("t.o.v. mediaan","vs. median")}</span></div>`:""}
        <div><b>${num(I.n)}</b><span>${L2("vergelijkbaar","comparables")}</span></div></div>
      <div class="mk-bar"><div class="mk-band" style="left:${x(I.p25)}%;width:${(x(I.p75)-x(I.p25)).toFixed(1)}%"></div><div class="mk-med" style="left:${x(I.median_m2)}%"></div>${m.ask_m2?`<div class="mk-me" style="left:${x(m.ask_m2)}%;--mc:${pos?pos[1]:"var(--c-pr)"}" title="${L2("deze woning","this property")}"></div>`:""}</div>
      <div class="mk-axis sm muted"><span>p25 ${eur(I.p25)}</span><span>p75 ${eur(I.p75)}</span></div>
      ${I.basis==="all"?`<div class="sm muted">${L2("Te weinig vergelijkbare woningen in dit segment; vergeleken met alle woningen in de plaats.","Too few comparables in this segment; compared with all homes in the town.")}</div>`:""}
      ${I.newbuild_vs_resale?`<div class="sm muted">${L2("Nieuwbouw, vergeleken met vraagprijzen van bestaande bouw.","New build, compared with resale asking prices.")}</div>`:""}</div>`)}
  /* rij 2: marktdynamiek gemeente */
  if(O&&O.tx_12m!=null){
    const vals=S.map(x=>Number(x.v)), mx=Math.max(...vals,1), mn=Math.min(...vals), w=160, h=36, st=S.length>1?w/(S.length-1):0;
    const pts=S.map((x,i)=>[(i*st).toFixed(1),(h-2-(Number(x.v)-mn)/(mx-mn||1)*(h-6)).toFixed(1)]);
    const spark=S.length>1?`<svg class="mk-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts.map(p=>p.join(",")).join(" ")}" fill="none" stroke="var(--c-pr)" stroke-width="1.6" vector-effect="non-scaling-stroke"/>${pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="${i===pts.length-1?2.6:1.4}" fill="${S[i].prov?"var(--bg)":"var(--c-pr)"}" stroke="var(--c-pr)" stroke-width="1"><title>${qtr(S[i].q)}: ${num(S[i].v)}${S[i].prov?L2(" (voorlopig)"," (provisional)"):""}</title></circle>`).join("")}</svg>`:"";
    const ch=O.tx_12m_change_pct;
    rows.push(`<div class="mk-row"><div class="mk-h">${L2("Marktdynamiek","Market activity")} <span class="muted">· ${L2("gemeente","municipality")} ${esc(O.municipality||m.municipality||"")}</span></div>
      <div class="mk-dyn"><div><div class="mk-big"><b>${num(O.tx_12m)}</b> ${L2("verkopen afgelopen 12 maanden","sales in the last 12 months")}${ch!=null?` <span style="color:${ch>0?"#34d399":ch<0?"#f87171":"inherit"}">(${pct(ch)})</span>`:""}</div>
        ${O.tx_nueva_12m!=null||O.tx_segunda_mano_12m!=null?`<div class="sm muted">${L2("nieuwbouw","new build")} ${num(O.tx_nueva_12m)} · ${L2("bestaande bouw","resale")} ${num(O.tx_segunda_mano_12m)}</div>`:""}
        <div class="sm muted">${L2("t/m","through")} ${qtr(O.tx_last_quarter)}${O.tx_last_provisional?L2(" (voorlopig)"," (provisional)"):""}</div></div>
        ${spark?`<div class="mk-sp">${spark}<div class="sm muted">${L2("verkopen per kwartaal","sales per quarter")}, ${S.length} ${L2("kwartalen","quarters")}</div></div>`:""}</div></div>`)}
  /* rij 3: taxatiewaarde */
  if(O&&O.vt_m2!=null){const c=O.vt_change_pct;
    rows.push(`<div class="mk-row"><div class="mk-h">${L2("Taxatiewaarde","Appraised value")} <span class="muted">· ${qtr(O.vt_period)}</span></div>
      <div class="mk-big"><b>${Number(O.vt_m2).toLocaleString(LOC(),{style:"currency",currency:"EUR",minimumFractionDigits:1,maximumFractionDigits:1})}</b> / m²${c!=null?` <span style="color:${c>0?"#34d399":c<0?"#f87171":"inherit"}">(${pct(c)} ${L2("jaar-op-jaar","year on year")})</span>`:""}</div></div>`)}
  if(!rows.length)return "";
  const src=[O?"Ministerio de Vivienda y Agenda Urbana":null,I?L2("Idealista (vraagprijzen, eigen analyse)","Idealista (asking prices, own analysis)"):null].filter(Boolean).join("; ");
  const per=[I&&I.period?"Idealista "+mon(I.period):null,O&&O.tx_last_quarter?"MIVAU "+L2("t/m ","through ")+qtr(O.tx_last_quarter):null].filter(Boolean).join(" · ");
  return rows.join("")+`<div class="mk-src">${L2("Bron","Source")}: ${esc(src)}${per?` · ${esc(per)}`:""}</div>`}
function renderProp(){
  if(prSub==="verrijking")prSub="kenmerken";
  const p=PR.property, raw=PR.raw||{}, d=$("#prDetail"), o=PR.owner, K=PR.catastro;
  const XL=p.is_external?extLink(p.external_agency,raw.external_url,raw.external_refnr):null;
  const tabs=[["kenmerken",t("st.features")],["contacten",t("st.contacts"),(PR.interested||[]).length+(o?1:0)+(PR.buyer?1:0)+(PR.co_owners||[]).length],["website",L2("Website","Website")]];
  const D=PR.detail||{};
  d.innerHTML=`<div class="dh dh-pr" style="--acc:var(--c-pr)"><div class="dh-l">
     <div class="dh-r1"><h2>${esc(p.reference)} · ${esc(p.title||"")}</h2>${statusBar(p)}</div>
     <div class="meta"><span>📍 ${esc([p.suburb,p.town,p.province].filter(Boolean).join(", "))}</span>${areaFlagBadge(areaFlag(p,K))}
       ${o?`<a class="ownerlink" data-c="${esc(o.id||o.wp_id)}">👤 ${esc(o.name||o.email)}</a>`:""}
       <span>🏷 <b style="color:${REPC[p.rep]||"#94a3b8"}">${esc(rep(p.rep))}</b></span>${p.is_newbuild?`<span>${t("pb.new")}</span>`:""}
       ${ownerContactStrip(o,raw,p)}</div></div>
     <div class="acts"><a class="act-edit" data-edit="1">✎ ${t("act.pedit")}</a>${ME&&ME.role==="admin"?`<a class="act-del" data-pdel="1" title="${esc(L2("Woning definitief verwijderen","Delete property permanently"))}">🗑 ${L2("Verwijderen","Delete")}</a>`:""}${p.is_own?`<a class="act-drive" href="${raw.drive_folder_id?`https://drive.google.com/drive/folders/${encodeURIComponent(raw.drive_folder_id)}`:`https://drive.google.com/drive/search?q=${encodeURIComponent(p.reference)}`}" target="_blank" rel="noopener" title="${esc(raw.drive_folder_id?L2("Klantmap op de Drive openen (documenten van deze woning)","Open the client folder on Drive"):L2("Nog geen map gekoppeld: zoekt op de Drive naar ","No folder linked yet: searches Drive for ")+p.reference)}">📁 ${raw.drive_folder_id?L2("Documenten (Drive)","Documents (Drive)"):L2("Zoek map op Drive","Find folder on Drive")}</a>`:""}${raw.url_new?`<a href="${esc(raw.url_new)}" target="_blank" rel="noopener">${t("act.site")}</a>`:raw.url?`<a href="${esc(raw.url)}" target="_blank" rel="noopener">${t("act.site")}</a>`:""}${p.is_external&&XL?`<a class="act-ext" href="${esc(XL.href)}" target="_blank" rel="noopener">${XL.exact?t("ext.open",{a:esc(p.external_agency||t("external"))}):t("ext.search")} ↗</a>`:""}</div></div>
   <div class="subtabs" style="--acc:var(--c-pr)">${tabs.map(x=>`<button class="st ${prSub===x[0]?"on":""}" data-s="${x[0]}">${x[1]}${x[2]!=null?`<span class="cnt">${x[2]}</span>`:""}</button>`).join("")}</div>
   <div class="dbody scroll" id="prBody"></div>`;
  d.querySelectorAll(".st").forEach(b=>b.onclick=()=>{prSub=b.dataset.s;renderProp()});
  wirePropEdit(d,p);
  const B=$("#prBody"), m=PR.matches||{};
  if(prSub==="kenmerken"){B.innerHTML=propFeatures(p,raw,o,K,XL,m);loadPropPhotos(p,raw);loadPropLog(p);loadPropMarket(p);
    B.querySelectorAll("[data-pks]").forEach(a=>a.onclick=()=>{const el=B.querySelector(a.dataset.pks==="media"?"#pkPhotos":"#pks-"+a.dataset.pks);if(el)el.scrollIntoView({behavior:"smooth",block:"start"})});
    B.querySelectorAll("[data-pjump]").forEach(a=>a.onclick=()=>window.NEXUS_EDIT&&NEXUS_EDIT.open(p.reference,editCtx(a.dataset.pjump)))}
  if(prSub==="contacten"){const one=(x,w,rc)=>x?`<div class="rel" data-c="${esc(x.id||x.wp_id)}"><div class="ini" style="background:${hue(x.name)};width:32px;height:32px;font-size:calc(12px*var(--fs,1))">${esc(initials(x.name||x.email))}</div><div style="min-width:0"><div style="font-weight:600">${esc(x.name||x.email)}</div><div class="sm">${roleTag(rc)} <span class="muted">${esc(w)}</span></div></div></div>`:"";
    const it=PR.interested||[], vw=PR.viewings||[];
    B.innerHTML=`<div style="display:flex;flex-direction:column;gap:8px">${one(o,o&&o.is_agent?t("o.agent"):t("o.owner"),o&&o.is_agent?"agent":"seller")}${(PR.co_owners||[]).filter(x=>x.relation!=="buyer").map(x=>one(x,t("o.coowner"),"seller")).join("")}${one(PR.buyer,t("o.buyer"),"buyer")}${(PR.co_owners||[]).filter(x=>x.relation==="buyer").map(x=>one(x,t("o.cobuyer"),"buyer")).join("")}</div>
      ${vw.length?`<div class="hd" style="padding:16px 0 8px"><h3>${t("h.viewings",{n:vw.length})}</h3></div>${vw.map(v=>`<div class="sm" style="padding:4px 0">${fdate(v.date)} ${esc(v.time||"")} · ${esc(v.client||"")} · <span class="muted">${esc(v.agent||"")}</span></div>`).join("")}`:""}
      <div class="hd" style="padding:16px 0 8px"><h3>${t("h.interested",{n:it.length})}</h3></div>
      ${it.length?`<div style="display:flex;flex-direction:column;gap:6px">${it.map(x=>`<div class="rel" data-c="${esc(x.id||x.wp_id)}"><div class="ini" style="background:${hue(x.name||x.email)};width:30px;height:30px;font-size:calc(11px*var(--fs,1))">${esc(initials(x.name||x.email))}</div><div style="min-width:0;flex:1"><div style="font-weight:600">${esc(x.name||x.email)}</div><div class="sm muted">${x.n}× · ${esc((x.types||[]).map(rq).join(", "))}</div></div><span class="sm muted">${ago(x.last)}</span></div>`).join("")}</div>`:`<div class="empty sm">${t("norequests")}</div>`}`}
  if(prSub==="website")renderPropWeb(p,B);
}
/* ---------- woning: websitestatistiek (eigen meting gruposoltura.com, web_events) ---------- */
async function renderPropWeb(p,B){
  B.innerHTML=`<div class="loader">${t("loading")}</div>`;
  let w;try{w=await rpc("nexus_property_web_stats",{p_id:p.id})}catch(e){B.innerHTML=`<div class="empty">${esc(e.message)}</div>`;return}
  if(PR.property.id!==p.id||prSub!=="website")return;
  w=w||{};const dl=w.daily||[],mx=Math.max(1,...dl.map(x=>x.n));
  const bw=600/Math.max(1,dl.length);
  const bars=dl.map((x,i)=>`<rect x="${(i*bw+1).toFixed(1)}" y="${(70-x.n/mx*62).toFixed(1)}" width="${Math.max(1,bw-2).toFixed(1)}" height="${(x.n/mx*62).toFixed(1)}" rx="1.5" fill="var(--c-pr)" opacity="${x.n?0.9:0.15}"><title>${fdate(x.d)}: ${x.n}</title></rect>`).join("");
  const f=(v,l)=>`<div><b>${num(v||0)}</b><span>${l}</span></div>`;
  B.innerHTML=`<div class="card" style="margin-bottom:12px"><div class="hd"><h3>${L2("Bezoek op gruposoltura.com","Visits on gruposoltura.com")}</h3><span class="tag">${w.last_view?L2("laatst bekeken ","last viewed ")+ago(w.last_view):L2("nog niet bekeken","not viewed yet")}</span></div>
    <div class="facts" style="padding:12px 14px 0">${f(w.views_7d,L2("bekeken · 7 dagen","views · 7 days"))}${f(w.views_30d,L2("bekeken · 30 dagen","views · 30 days"))}${f(w.sessions_30d,L2("sessies · 30 dagen","sessions · 30 days"))}${f(w.returning_visitors,L2("terugkerende bezoekers","returning visitors"))}${f(w.favorites,L2("keer bewaard","times saved"))}${f(w.contact_intents,L2("contactintenties","contact intents"))}${f(w.leads,L2("aanvragen via de site","requests via the site"))}${f(w.views_all,L2("bekeken · totaal","views · total"))}</div>
    <div style="padding:6px 14px 4px"><svg viewBox="0 0 600 72" preserveAspectRatio="none" style="width:100%;height:72px;display:block">${bars}</svg>
      <div class="sm muted" style="display:flex;justify-content:space-between"><span>${dl.length?fdate(dl[0].d):""}</span><span>${L2("bekeken per dag, 30 dagen","views per day, 30 days")}</span><span>${dl.length?fdate(dl[dl.length-1].d):""}</span></div></div>
    <div class="sm muted" style="padding:6px 14px 12px">${L2("Eigen meting van de website (anoniem). Terugkerend = bezoeker met cookietoestemming die deze woning op meer dan één dag bekeek. Contactintenties = WhatsApp, bellen, kostenoverzicht, bezichtigingsformulier geopend. Telling sinds 18-10-2026.","Own website measurement (anonymous). Returning = visitor with cookie consent who viewed this home on more than one day. Contact intents = WhatsApp, call, cost overview, viewing form opened. Counted since 18 Oct 2026.")}</div></div>`;
}

/* ================= MAP ================= */
/* Pins: opgeslagen coördinaten, anders kadastraal perceel, anders Catastro-geocode, anders de plaats (benadering). Geldt voor eigen én externe woningen (20-10-2026).
   Alles wordt één keer geladen (nexus_map('all')); het filter Eigen/Extern/Alles werkt in de browser. */
const MPC={own:"#22c55e",ext:"#3b82f6"};
let mpData=null, mpMap=null, mpLayer=null, mpMarkers={}, mpHideT=null, mpFitted={}, mpQ="", mpQT=null;
const mpNorm=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const mpHay=p=>p._h||(p._h=mpNorm([p.reference,p.ext_ref,p.title,p.town,p.suburb,p.street,p.cat_address,p.agency,p.owner,p.rep,p.q].join(" ")));
function mpMatch(p){if(!mpQ)return true;const h=mpHay(p);return mpNorm(mpQ).split(/\s+/).filter(Boolean).every(w=>h.includes(w)||(/^\d{3,}$/.test(w)&&h.replace(/\s/g,"").includes(w)))}
function wireMpSearch(){const i=$("#mpQ");if(!i||i._w)return;i._w=1;
  i.oninput=()=>{clearTimeout(mpQT);mpQT=setTimeout(()=>{mpQ=i.value.trim();if(mpData)renderMap(true)},180)};
  i.onkeydown=e=>{if(e.key==="Escape"){i.value="";mpQ="";if(mpData)renderMap(true)}
    else if(e.key==="Enter"){e.preventDefault();clearTimeout(mpQT);mpQ=i.value.trim();if(!mpData)return;renderMap(true);const f=$("#mpList [data-fly]");if(f)f.click();else{const g=$("#mpList [data-p]");if(g)g.click()}}}}
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
  buildMpSeg();wireMpSearch();
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
  const inScope=r=>mpScope==="all"||(mpScope==="own"?r.is_own:!r.is_own);
  const rows=all.filter(r=>inScope(r)&&mpMatch(r));
  const elsewhere=mpQ?all.filter(r=>!inScope(r)&&mpMatch(r)).length:0;
  const on=rows.filter(r=>r.lat!=null), off=rows.filter(r=>r.lat==null);
  $("#cntMp").textContent=num(all.filter(r=>r.is_own&&r.lat!=null).length);
  $("#mpCount").textContent=t("mp.onmap",{a:num(on.length),b:num(rows.length)});
  $("#mpTitle").textContent=t("mp.title."+mpScope);
  if(mpMap&&mpLayer){
    mpLayer.clearLayers();mpMarkers={};
    on.forEach(p=>{
      const c=p.is_own?MPC.own:MPC.ext;
      const icon=L.divIcon({className:"",iconSize:null,iconAnchor:[0,0],
        html:`<div class="mp-pin ${p.is_own?"own":"ext"} ${p.src==="catastro"||p.src==="area"?"approx":""}" style="--pc:${c};transform:translate(-50%,-100%)"><b>${esc(p.reference)}${p.under_offer?'<s title="'+esc(t("underoffer"))+'"></s>':""}</b><i></i></div>`});
      const m=L.marker([p.lat,p.lng],{icon,title:p.reference,riseOnHover:true,zIndexOffset:p.is_own?1000:0}).addTo(mpLayer);
      const pp=L.popup({offset:[0,-26],autoPan:true,closeButton:true,maxWidth:280,minWidth:260}).setContent(popupHtml(p));pp._nx=p;
      m.bindPopup(pp);
      m.on("mouseover",()=>{clearTimeout(mpHideT);pp._hover=true;if(!m.isPopupOpen())m.openPopup()});
      m.on("mouseout",()=>{if(pp._hover)mpHideT=setTimeout(()=>{if(pp._hover)mpMap.closePopup(pp)},350)});
      m.on("click",()=>{pp._hover=false;clearTimeout(mpHideT);m.openPopup()});
      mpMarkers[p.reference]=m;
    });
    if(fit&&on.length===1&&mpQ){const m=mpMarkers[on[0].reference];mpMap.flyTo(m.getLatLng(),Math.max(mpMap.getZoom(),16),{duration:.6});setTimeout(()=>{m.getPopup()._hover=false;m.openPopup()},650)}
    else if(fit&&on.length)mpMap.fitBounds(L.latLngBounds(on.map(p=>[p.lat,p.lng])).pad(0.15),{maxZoom:15});
  }
  const sub=p=>esc(p.is_own?[p.suburb,p.town].filter(Boolean).join(", "):[p.agency,p.town].filter(Boolean).join(" · "))+(p.owner?` <span class="muted">· 👤 ${esc(p.owner)}</span>`:"");
  const it=(p,extra,attr)=>`<div class="mp-it" ${attr}><div class="th" style="${p.image?`background-image:url('${esc(p.image)}')`:""}"></div>
    <div style="min-width:0"><div class="t"><span class="dot" style="background:${p.is_own?MPC.own:MPC.ext}"></span>${esc(p.reference)} · ${eur(p.price)}</div><div class="d">${extra}</div></div><span class="sm" style="color:var(--c-ac)">${p.under_offer?"●":""}</span></div>`;
  const onOwn=on.filter(p=>p.is_own), onExt=on.filter(p=>!p.is_own);
  const sec=(lbl,list)=>list.length?`<div class="mp-sec">${lbl}</div>`+list.map(p=>it(p,sub(p)+(p.src==="catastro"||p.src==="area"?" · ≈":""),`data-fly="${esc(p.reference)}"`)).join(""):"";
  $("#mpList").innerHTML=(rows.length?"":`<div class="empty">${mpQ?t("mp.nomatch",{q:esc(mpQ)}):t("mp.none")}</div>`)
    +(elsewhere?`<div class="mp-else"><button data-allq="1">${t("mp.elsewhere",{n:num(elsewhere)})}</button></div>`:"")
    +sec(t("mp.located.own",{n:onOwn.length}),onOwn)+sec(t("mp.located.ext",{n:onExt.length}),onExt)
    +(off.length?`<div class="mp-sec">${t("mp.nolocation",{n:off.length})}</div><div class="sm muted" style="padding:8px 12px">${t("mp.nolocation.s")}</div>`
      +off.map(p=>it(p,p.is_own?esc([p.street||p.cat_address,p.suburb,p.town].filter(Boolean).join(", ")):sub(p),`data-p="${esc(p.reference)}"`)).join(""):"");
  const ab=$("#mpList [data-allq]");if(ab)ab.onclick=()=>{mpScope="all";try{localStorage.setItem("nexus-mp-scope",mpScope)}catch(e){}buildMpSeg();renderMap(true)};
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
    <div class="hd" style="border-top:1px solid var(--line)"><h3>${t("ac.types")}</h3></div><div style="padding:12px 14px;display:flex;flex-wrap:wrap;gap:6px">${(OV.req_types_30d||[]).map(x=>`<span class="tag">${esc(rq(x.t))} · ${x.n}</span>`).join("")}</div></div></div></div>`;
}

})();
