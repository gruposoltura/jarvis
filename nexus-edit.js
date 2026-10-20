/* NEXUS · woning bewerken. Schrijft naar core via nexus_property_save / nexus_property_media_* (team-gate + audit in de database).
   Commissies en verkoopdetails: alleen admin (database dwingt dit af; hier alleen-lezen/verborgen). */
(function(){
"use strict";
const esc=v=>v==null?"":String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let X=null;                               // {sb,rpc,lang,me,onSaved}
const tr=v=>Array.isArray(v)?(X&&X.lang()==="en"?v[1]:v[0]):v;
const LS=()=>window.NEXUS_LISTS||{};   /* niet "L": dat is Leaflet (kaart) */

const STATUS=[["available",["Actief","Active"],"#22c55e"],["under_offer",["Gereserveerd","Reserved"],"#ec4899"],["reserved",["Gereserveerd","Reserved"],"#f43f5e"],["sold",["Verkocht","Sold"],"#a855f7"],
  ["withdrawn",["Ingetrokken","Withdrawn"],"#64748b"],["draft",["Concept","Draft"],"#f59e0b"]];
/* Besluit Rick 18-10: Gereserveerd = Onder bod. De database kent sinds 18-10 ook "reserved" (nieuwe site);
   die knop verschijnt alleen als een woning al op reserved staat. Zet SHOW_RESERVED op true om hem altijd te tonen. */
const SHOW_RESERVED=false;
const statusOf=s=>STATUS.find(x=>x[0]===s)||[s,[s,s],"#64748b"];
const TXL=["en","nl","sv"];
/* oudere talen (es/de/fr) alleen tonen als er al tekst in staat */
const LANGS_OF=()=>TXL.concat(["es","de","fr"].filter(l=>T&&T[l]&&Object.values(T[l]).some(Boolean)));
const ADMIN_ONLY=["sold_price","sold_price_display","sold_date","deed_price","sold_agent_id","sold_agent_text","notary","notary_protocol","commission_a","commission_b","commission_out","conveyancing","commission_note"];
const FEED_FIELDS=["price","bedrooms","bathrooms","build_area","plot_area","energy_label","city","location_area","location_id","lat","lng","feature_options","build_type","category","province","country"];

let D=null, P=null, T=null, M=null, TOUCH={}, TTOUCH={}, MEDIA_DIRTY=false, txL="en", ROOT=null, busy=false, MAP=null;

/* ---------- waarden ---------- */
const isNum=k=>/^(price|price_previous|bedrooms|bathrooms|toilets|ensuites|rooms|kitchens|living_rooms|floors|balconies|terraces|patios|garages|carports|parking_spaces|build_area|plot_area|area_\w+|year_built|distance_\w+|fee_\w+|cost_\w+|lat|lng|sold_price|deed_price|commission_\w+|conveyancing|location_id|purchase_price|purchase_tax|deed_build_area|deed_plot_area)$/.test(k)&&k!=="commission_note";
function norm(k,v){if(v===""||v===undefined)return null;if(v===null)return null;
  if(isNum(k)){const n=Number(String(v).replace(",","."));return isNaN(n)?null:n}
  if(/_at$|_date$/.test(k)&&typeof v==="string")return v.slice(0,10);
  return v}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function patch(){const o={};for(const k in TOUCH){const a=norm(k,P[k]),b=norm(k,D.property[k]);if(!same(a,b))o[k]=a}return o}
function tpatch(){const o={};for(const key in TTOUCH){const [l,f]=key.split(".");const a=(T[l]||{})[f]??"", b=((D.texts||{})[l]||{})[f]??"";if(a!==b){(o[l]=o[l]||{})[f]=a===""?null:a}}return o}
const dirtyCount=()=>Object.keys(patch()).length+Object.values(tpatch()).reduce((n,x)=>n+Object.keys(x).length,0)+(MEDIA_DIRTY?1:0);

/* ---------- veldhelpers ---------- */
const ro=k=>(!D.is_admin&&ADMIN_ONLY.includes(k));
const feedMark=k=>P.origin==="partner"&&FEED_FIELDS.includes(k)?`<b class="pe-feed" title="${esc(tr(["Wordt elke nacht door de partnerfeed overschreven","Overwritten nightly by the partner feed"]))}">⟳</b>`:"";
function inp(k,label,o={}){const v=P[k];let val=v??"";if(o.type==="date"&&val)val=String(val).slice(0,10);
  return `<label class="ad-f ${o.w?"w"+o.w:""}"><span>${esc(tr(label))}${feedMark(k)}${ro(k)?" 🔒":""}</span>
   <input data-k="${k}" type="${o.type||"text"}" value="${esc(val)}" ${o.step?`step="${o.step}"`:""} ${o.min!=null?`min="${o.min}"`:""} ${o.ph?`placeholder="${esc(tr(o.ph))}"`:""} ${o.list?`list="${o.list}"`:""} ${ro(k)||o.ro?"disabled":""}>${o.hint?`<small>${esc(tr(o.hint))}</small>`:""}</label>`}
function sel(k,label,opts,o={}){const v=P[k]==null?"":String(P[k]);const has=opts.some(x=>String(x[0])===v);
  return `<label class="ad-f ${o.w?"w"+o.w:""}"><span>${esc(tr(label))}${feedMark(k)}${ro(k)?" 🔒":""}</span><select data-k="${k}" ${ro(k)?"disabled":""}>
   ${o.empty!==false?`<option value="">—</option>`:""}${!has&&v?`<option value="${esc(v)}" selected>${esc(v)} ${esc(tr(["(huidig)","(current)"]))}</option>`:""}
   ${opts.map(x=>`<option value="${esc(x[0])}" ${String(x[0])===v?"selected":""}>${esc(tr(x[1]))}</option>`).join("")}</select>${o.hint?`<small>${esc(tr(o.hint))}</small>`:""}</label>`}
function chk(k,label){return `<label class="ad-c"><input type="checkbox" data-k="${k}" data-bool ${P[k]?"checked":""} ${ro(k)?"disabled":""}><span>${esc(tr(label))}${feedMark(k)}</span></label>`}
function multi(k,opts,o={}){const arr=o.csv?String(P[k]||"").split(/\s*,\s*/).filter(Boolean):(o.path?((P[k]||{})[o.path]||[]):(P[k]||[]));
  const extra=arr.filter(a=>!opts.some(x=>(Array.isArray(x)?x[0]:x)===a));
  return `<div class="ad-multi ${o.cols?"c"+o.cols:""}">${opts.concat(extra.map(e=>[e,e])).map(x=>{const val=Array.isArray(x)?x[0]:x, lab=Array.isArray(x)?x[1]:x;
    return `<label class="ad-c"><input type="checkbox" data-k="${k}" data-arr="${esc(val)}" ${o.csv?"data-csv":""} ${o.path?`data-path="${o.path}"`:""} ${arr.includes(val)?"checked":""}><span>${esc(tr(lab))}</span></label>`}).join("")}</div>`}
const SEC_C={status:"#22c55e",sale:"#a855f7",basis:"#3b82f6",prijs:"#22c55e",loc:"#06b6d4",ind:"#f59e0b",ken:"#a855f7",tekst:"#ec4899",media:"#f97316",kost:"#64748b",con:"#14b8a6",pub:"#eab308",hist:"#94a3b8"};
const sec=(id,title,body,o={})=>`<section class="ad-sec" id="pe-${id}" style="--sc:${SEC_C[id]||"#94a3b8"}"><h4>${esc(tr(title))}${o.aside||""}</h4>${body}</section>`;
const row=(...c)=>`<div class="ad-row">${c.join("")}</div>`;

/* ---------- opbouw ---------- */
const NAV=[["status",["Status","Status"]],["basis",["Basis","Basics"]],["prijs",["Prijs","Price"]],["loc",["Locatie","Location"]],["ind",["Indeling","Layout"]],
  ["ken",["Kenmerken","Features"]],["tekst",["Teksten","Texts"]],["media",["Foto's","Photos"]],["kost",["Eigendomsakte","Title deed"]],["con",["Contacten","Contacts"]],
  ["pub",["Publicatie","Publishing"]],["sale",["Verkoop","Sale"]],["hist",["Historie","History"]]];
function shell(){
  ROOT=document.getElementById("pe");if(!ROOT){ROOT=document.createElement("div");ROOT.id="pe";document.body.appendChild(ROOT);bind()}
  ROOT.className="pe";ROOT.innerHTML=`<div class="pe-box"><div class="pe-load">${esc(tr(["Woning laden…","Loading property…"]))}</div></div>`;
  document.body.classList.add("pe-open");
}
function render(keepScroll){
  const sc=keepScroll&&ROOT.querySelector("#peMain")?ROOT.querySelector("#peMain").scrollTop:0;
  const p=P, st=statusOf(p.status), title=((T.nl||{}).heading||(T.en||{}).heading||"");
  ROOT.innerHTML=`<div class="pe-box">
   <header class="pe-hd"><div style="min-width:0"><div class="pe-ref">${esc(p.reference)} <span class="pe-st" style="--sc:${st[2]}">${esc(tr(st[1]))}</span>
       ${p.origin==="partner"?`<span class="tag">${esc(tr(["Partnerwoning","Partner listing"]))}${p.external_ref?" · "+esc(p.external_ref):""}</span>`:""}</div>
     <div class="pe-tt">${esc(title||"—")}</div></div>
     <button class="pe-x" data-act="close" title="${esc(tr(["Sluiten","Close"]))}">×</button></header>
   <div class="pe-body"><nav class="pe-nav">${NAV.map(n=>`<a data-jump="${n[0]}">${esc(tr(n[1]))}</a>`).join("")}</nav>
     <div class="pe-main" id="peMain">
       ${p.origin==="partner"?`<div class="ad-warnbox"><b>${esc(tr(["Partnerwoning: let op","Partner listing: note"]))}</b><span class="sm">${esc(tr(["Velden met ⟳ (prijs, kamers, oppervlakte, locatie, beschrijving en foto's) worden elke nacht om 01:15 door de partnerfeed overschreven. Status (gereserveerd / verkocht), koppelingen en kop blijven staan.","Fields marked ⟳ (price, rooms, areas, location, description and photos) are overwritten nightly at 01:15 by the partner feed. Status (reserved / sold), links and heading are kept."]))}</span></div>`:""}
       <div id="peErr"></div>
       ${secStatus()}${secBasis()}${secPrice()}${secLoc()}${secLayout()}${secFeatures()}${secTexts()}${secMedia()}${secCosts()}${secContacts()}${secPub()}${secSale()}${secHist()}
     </div></div>
   <footer class="pe-ft">${D.is_admin&&p.origin!=="partner"?`<button class="btn pe-del" data-act="delete" title="${esc(tr(["Woning definitief verwijderen (alleen beheerder)","Delete property permanently (admin only)"]))}">🗑 ${esc(tr(["Verwijderen","Delete"]))}</button>`:""}<span class="sm muted" id="peDirty"></span><span style="flex:1"></span>
     <button class="btn" data-act="close">${esc(tr(["Annuleren","Cancel"]))}</button>
     <button class="btn ad-next" data-act="save" id="peSave">${esc(tr(["Opslaan","Save"]))}</button></footer></div>`;
  ROOT.querySelector(".pe-box").insertAdjacentHTML("beforeend",`<datalist id="peRegistros">${(LK.registry||[]).map(x=>`<option value="${esc(x)}">`).join("")}</datalist><datalist id="peNotaries">${(LK.notary||[]).map(x=>`<option value="${esc(x)}">`).join("")}</datalist>`);
  ROOT.querySelector("#peMain").scrollTop=sc;
  upDirty();initMap();wireMedia();
}
function upDirty(){const n=dirtyCount(), el=ROOT.querySelector("#peDirty"), b=ROOT.querySelector("#peSave");
  if(el)el.textContent=n?tr([`${n} wijziging(en) niet opgeslagen`,`${n} unsaved change(s)`]):tr(["Geen wijzigingen","No changes"]);
  if(b)b.disabled=!n||busy}

function secStatus(){const p=P;
  const seg=`<div class="pe-seg">${STATUS.filter(s=>s[0]!=="reserved"||SHOW_RESERVED||p.status==="reserved").map(s=>`<button data-status="${s[0]}" class="${p.status===s[0]?"on":""}" style="--sc:${s[2]}">${esc(tr(s[1]))}</button>`).join("")}</div>`;
  return sec("status",["Status","Status"],seg
    +row(chk("dossier_complete",["Dossier compleet","Dossier complete"]))+`<small class="muted">${esc(tr(["Online/offline volgt de status: Actief en Gereserveerd staan online, Concept, Verkocht en Ingetrokken offline.","Online/offline follows the status: Active and Reserved are online, Draft, Sold and Withdrawn offline."]))}</small>`.replace('class="ad-row"','class="ad-row pe-chkrow"')
    +row(inp("listed_at",["In aanbod sinds","Listed since"],{type:"date"}),inp("under_offer_at",["Gereserveerd sinds","Reserved since"],{type:"date"}),(p.status==="reserved"||p.reserved_at)?inp("reserved_at",["Gereserveerd sinds","Reserved since"],{type:"date"}):"",inp("withdrawn_at",["Ingetrokken op","Withdrawn on"],{type:"date"})))}
function secSale(){const p=P;
  return sec("sale",["Verkoop","Sale"],row(inp("sold_price",["Verkoopprijs (€)","Sold price (€)"],{type:"number",min:0,step:1000}),inp("sold_date",["Verkoopdatum","Sale date"],{type:"date"}),
         sel("sold_agent_id",["Verkocht door","Sold by"],D.team.map(t=>[t.id,t.name])),inp("sold_agent_text",["Verkocht door (vrij)","Sold by (free text)"]))
    +row(inp("notary",["Notaris","Notary"],{w:2,list:"peNotaries",ph:["kies of typ","pick or type"]}),inp("notary_protocol",["Protocolnummer","Protocol number"]))
    +chk("sold_price_display",["Verkoopprijs tonen op de site","Display sold price"])
    +(D.is_admin?`<h5>${esc(tr(["Commissie","Commission"]))}</h5>`+row(inp("commission_a",["Commissie A (€)","Commission A (€)"],{type:"number",step:"any"}),inp("commission_b",["Commissie B (€)","Commission B (€)"],{type:"number",step:"any"}),
         inp("commission_out",["Commissie uit (€)","Commission out (€)"],{type:"number",step:"any"}),inp("conveyancing",["Conveyancing (€)","Conveyancing (€)"],{type:"number",step:"any"}))
       +row(inp("commission_note",["Notitie commissie","Commission note"],{w:4})):""),{aside:`${D.is_admin?"":` <span class="sm muted">🔒 ${esc(tr(["alleen beheerder","admin only"]))}</span>`}`})}
function secBasis(){const l=LS();
  return sec("basis",["Basis","Basics"],row(sel("category",["Woningtype","Property type"],l.CATS||[]),sel("build_type",["Bouw","Build"],[["resale",["Bestaande bouw","Resale"]],["new_build",["Nieuwbouw","New build"]]]),
      sel("own_listing_type",["Soort opdracht","Mandate"],[["direct",["Direct","Direct"]],["indirect",["Indirect","Indirect"]]]),sel("listing_agent_id",["Verantwoordelijk","Responsible"],D.team.map(t=>[t.id,t.name])))
    +row(inp("reference",["Referentie","Reference"],{ro:true,hint:["Vast: wordt gebruikt in links en feeds","Fixed: used in links and feeds"]}),inp("year_built",["Bouwjaar","Year built"],{type:"number",min:1800}),inp("object_style",["Stijl","Style"]),
      P.origin==="partner"?inp("external_ref",["Partnerreferentie","Partner reference"],{ro:true}):""))
    +row(sel("condition",["Staat van de woning","Condition"],[["new",["Nieuw","New"]],["good",["Goed","Good"]],["to_restore",["Op te knappen","To restore"]]],{empty:false}),`<div></div>`,`<div></div>`,`<div></div>`)
    +("key_number" in P&&P.origin!=="partner"?row(inp("key_number",["Sleutelnummer","Key number"],{hint:["Leeg = geen sleutel in beheer","Empty = no keys held"]}),`<div class="ad-f"><span>&nbsp;</span><button class="btn sm" data-act="keynext" ${P.key_number?"disabled":""}>${esc(tr(["Vrij nummer toekennen","Assign free number"]))}</button></div>`):"")}
function secPrice(){const h=D.price_history||[];
  return sec("prijs",["Prijs","Price"],row(inp("price",["Vraagprijs (€)","Asking price (€)"],{type:"number",min:0,step:1000}),inp("price_previous",["Vorige prijs (€)","Previous price (€)"],{type:"number",min:0,step:1000,hint:["Wordt automatisch gevuld bij een prijswijziging","Filled automatically when the price changes"]}),
      inp("cost_community",["Gemeenschapskosten per JAAR (€)","Community fees per YEAR (€)"],{type:"number",min:0,step:1,hint:["Altijd het jaarbedrag","Always the yearly amount"]}))
    +`<div class="ad-multi c4">${chk("price_hidden",["Prijs verbergen","Hide price"])}${chk("price_fixed",["Vaste prijs","Price FIXED"])}${chk("price_from",["Prijs vanaf","Price FROM"])}${chk("price_on_request",["Prijs op aanvraag","Price ON REQUEST"])}</div>`
    +(h.length?`<div class="pe-hist">${h.map(x=>`<span>${NEXUS_DMY(x.at)} · <b>€ ${Number(x.price).toLocaleString("nl-NL")}</b> <span class="muted">${esc(x.source||"")}</span></span>`).join("")}</div>`:""))}
function secLoc(){const l=LS(), locs=D.locations||[], cur=locs.find(x=>x.id===Number(P.location_id));
  const mun=cur?(cur.parent?locs.find(x=>x.id===cur.parent):cur):null, area=cur&&cur.parent?cur:null;
  const munis=locs.filter(x=>!x.parent), areas=mun?locs.filter(x=>x.parent===mun.id):[];
  return sec("loc",["Locatie","Location"],row(`<label class="ad-f w2"><span>${esc(tr(["Gemeente","Municipality"]))}${feedMark("location_id")}</span><select data-loc="mun"><option value="">—</option>${munis.map(m=>`<option value="${m.id}" ${mun&&mun.id===m.id?"selected":""}>${esc(m.name)}</option>`).join("")}</select>
        <small>${esc(tr(["Huidig in tekst: ","Current text: "]))}${esc([P.suburb,P.city].filter(Boolean).join(", ")||"—")}</small></label>`,
      `<label class="ad-f w2"><span>${esc(tr(["Wijk / urbanisatie","Area"]))}</span><select data-loc="area" ${mun?"":"disabled"}><option value="">${esc(tr(["(gemeente zelf)","(municipality itself)"]))}</option>${areas.map(a=>`<option value="${a.id}" ${area&&area.id===a.id?"selected":""}>${esc(a.name)}</option>`).join("")}</select></label>`)
    +row(inp("street",["Straat","Street"],{w:2}),inp("street_number",["Nr.","No."]),inp("postal_code",["Postcode","Post code"]))
    +row(inp("province",["Provincie","Province"]),inp("country",["Land","Country"]),sel("orientation",["Oriëntatie","Orientation"],l.ORIENT||[]),`<div></div>`)
    +`<div id="peMap"></div>`+row(inp("lat",["Breedtegraad","Latitude"],{type:"number",step:"any"}),inp("lng",["Lengtegraad","Longitude"],{type:"number",step:"any"}),
       `<div class="ad-f w2"><span>&nbsp;</span>${chk("hide_address",["Adres/kaart verbergen op de site","Hide address/map on site"])}</div>`)
    +`<small class="muted">${esc(tr(["Klik op de kaart of sleep de pin om de coördinaten te zetten.","Click the map or drag the pin to set the coordinates."]))}</small>`
    +`<h5>${esc(tr(["Uitzicht","Views"]))}</h5>`+multi("views",l.VIEWS||[],{csv:true,cols:4})
    +`<h5 class="ad-h5row">${esc(tr(["Afstanden (meter, hemelsbreed)","Distances (metres, straight line)"]))}<button class="btn sm" data-act="dist">⟳ ${esc(tr(["Bereken","Calculate"]))}</button></h5>`+`<small class="muted" id="peDistInfo"></small>`+row(inp("distance_sea_m",["Zee","Sea"],{type:"number",min:0}),inp("distance_airport_m",["Luchthaven","Airport"],{type:"number",min:0}),inp("distance_city_m",["Centrum","Centre"],{type:"number",min:0}),inp("distance_shops_m",["Winkels (supermarkt)","Shops (supermarket)"],{type:"number",min:0})))}
function secLayout(){const l=LS(), n=(k,lab)=>inp(k,lab,{type:"number",min:0});
  return sec("ind",["Indeling en oppervlaktes","Layout and areas"],`<div class="ad-cols3"><div><h5>${esc(tr(["Kamers","Rooms"]))}</h5>${n("bedrooms",["Slaapkamers","Bedrooms"])}${n("bathrooms",["Badkamers","Bathrooms"])}${n("toilets",["Toiletten","Toilets"])}${n("ensuites","En-suite")}${n("rooms",["Kamers totaal","Rooms total"])}${n("living_rooms",["Woonkamers","Living rooms"])}${n("kitchens",["Keukens","Kitchens"])}</div>
    <div><h5>${esc(tr(["Oppervlakte (m²)","Surface (m²)"]))}</h5>${n("build_area",["Bebouwd","Built"])}${n("plot_area",["Perceel","Plot"])}
      ${sel("energy_label",["Energielabel","Energy label"],l.ENERGY||[])}</div>
    <div><h5>${esc(tr(["Overig","Other"]))}</h5>${n("floors",["Verdiepingen","Floors"])}${inp("floor_level",["Etage","Level"])}${n("balconies",["Balkons","Balconies"])}${n("terraces",["Terrassen","Terraces"])}${n("patios",["Patio's","Patios"])}${n("garages",["Garages","Garages"])}${n("carports","Carports")}${n("parking_spaces",["Open parkeerplekken","Open parking spaces"])}</div></div>`)}
const featModel=()=>({get:()=>({features:P.features||[],opts:P.feature_options||{}}),set:(f,o)=>{set("features",f);set("feature_options",o)}});
function secFeatures(){
  return sec("ken",["Kenmerken","Features"],`<div data-fxbase="edit">${window.NEXUS_FEAT?NEXUS_FEAT.html(featModel(),{tr,category:P.category}):""}</div>`)}
function secTexts(){const t=T[txL]||{};
  const f=(k,lab,o={})=>o.area?`<label class="ad-f w4"><span>${esc(tr(lab))}</span><textarea data-tx="${txL}.${k}" rows="${o.rows||4}">${esc(t[k]||"")}</textarea>${o.hint?`<small>${esc(tr(o.hint))}</small>`:""}</label>`
    :`<label class="ad-f ${o.w?"w"+o.w:"w4"}"><span>${esc(tr(lab))}</span><input data-tx="${txL}.${k}" value="${esc(t[k]||"")}">${o.hint?`<small>${esc(tr(o.hint))}</small>`:""}</label>`;
  return sec("tekst",["Teksten","Texts"],`<div class="ad-txbar"><div class="seg ad-seg sm">${LANGS_OF().map(l=>`<button data-txl="${l}" class="${txL===l?"on":""}">${l.toUpperCase()}${(T[l]||{}).description?" ✓":""}</button>`).join("")}</div>
    ${P.origin==="partner"?"":`<button class="btn sm ad-gen" data-act="gen" ${GEN?"disabled":""}>${GEN?"… "+esc(tr(["Kadaster en Agent SEO bezig (±1 min)","Cadastre and Agent SEO running (±1 min)"])):"✨ "+esc(tr(["Kadaster + teksten opnieuw (Agent SEO)","Cadastre + texts again (Agent SEO)"]))}</button>`}</div><div id="peGenMsg" class="sm"></div>
    ${row(f("heading",["Kop","Heading"]))}${row(f("description",["Omschrijving","Description"],{area:true,rows:9,hint:P.origin==="partner"?["⟳ Wordt elke nacht door de feed overschreven","⟳ Overwritten nightly by the feed"]:null}))}
    ${row(f("key_details",["Kernpunten (één per regel)","Key points (one per line)"],{area:true,rows:5}))}
    ${row(f("seo_title",["SEO-titel","SEO title"],{w:2}),f("seo_keyword",["SEO-zoekwoord","SEO keyword"],{w:2}))}${row(f("seo_description",["SEO-omschrijving","SEO description"],{area:true,rows:2}))}`)}
function secMedia(){
  return sec("media",["Foto's en media","Photos and media"],`<div class="ad-drop" id="peDrop"><input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" hidden>
      <div><b>${esc(tr(["Sleep foto's hierheen of klik om te uploaden","Drop photos here or click to upload"]))}</b><div class="sm muted">${esc(tr(["JPG/PNG/WebP of PDF, max. 20 MB. Upload gebeurt bij Opslaan. Sleep een foto (of ⠿ op telefoon/tablet) naar een andere plek om de volgorde te wijzigen; de eerste foto is de hoofdfoto.","JPG/PNG/WebP or PDF, max 20 MB. Uploaded on Save. Drag a photo (or ⠿ on phone/tablet) to reorder; the first photo is the main photo."]))}</div></div></div>
    <div class="ad-media" id="peMedia"></div>`,{aside:`<span class="sm muted">${M.filter(m=>!m.del).length}</span>`})}
function secCosts(){
  /* BESLUIT Rick 18/19-10-2026: geen kosten koper en geen vaste lasten in NEXUS. Niet terugzetten.
     Uitzondering 20-10-2026 (Rick): gemeenschapskosten PER JAAR (cost_community) staan bij Prijs, voor de Idealista-feed.
     20-10-2026: aktegegevens (registro, inschrijving, oppervlakte volgens akte, aankoop huidige eigenaar) + knop Akte inlezen. */
  return sec("kost",["Eigendomsakte","Title deed"],`<div class="dd-bar">${window.NEXUS_DEED?NEXUS_DEED.button(tr):""}<span class="sm muted">${esc(tr(["PDF of foto van de escritura; je ziet eerst wat er gevonden is.","PDF or photo of the escritura; you review what was found first."]))}${P.deed_read_at?" · "+esc(tr(["laatst ingelezen ","last read "]))+NEXUS_DMY(P.deed_read_at):""}</span></div>
    <div class="ad-cols3">
    <div><h5>${esc(tr(["Kadaster en registro","Cadastre and registry"]))}</h5>${inp("cadastral_ref",["Kadastrale referentie","Cadastral reference"])}${inp("finca_number",["Fincanummer","Finca number"])}${inp("registry_name",["Registro de la Propiedad","Land registry"],{list:"peRegistros",ph:["kies of typ","pick or type"]})}${inp("idufir","IDUFIR / CRU")}${inp("drive_folder_id",["Klantmap op de Drive","Client folder on Drive"],{ph:["plak de link van de map","paste the folder link"],hint:["Map in ‘1. KLANTEN’; de knop 📁 in de woningkop opent hem","Folder in ‘1. KLANTEN’; the 📁 button in the property header opens it"]})}</div>
    <div><h5>${esc(tr(["Inschrijving en oppervlakte","Inscription and areas"]))}</h5>${row(inp("registry_tomo","Tomo"),inp("registry_libro","Libro"))}${row(inp("registry_folio","Folio"),inp("registry_inscription",["Inscripción","Inscription"]))}
      ${inp("deed_build_area",["Bebouwd volgens akte (m²)","Built area per deed (m²)"],{type:"number",min:0})}${inp("deed_plot_area",["Kavel volgens akte (m²)","Plot per deed (m²)"],{type:"number",min:0,hint:["Leeg bij een appartement","Empty for an apartment"]})}</div>
    <div><h5>${esc(tr(["Aankoop huidige eigenaar","Purchase by current owner"]))}</h5>${inp("purchase_date",["Datum aankoop","Purchase date"],{type:"date"})}${inp("purchase_price",["Aankoopprijs (€)","Purchase price (€)"],{type:"number",min:0,step:"any"})}
      ${row(inp("purchase_tax",["Overdrachtsbelasting (€)","Transfer tax (€)"],{type:"number",min:0,step:"any"}),sel("purchase_tax_type",["Soort","Type"],[["ITP","ITP"],["IVA","IVA"],["IVA+AJD","IVA + AJD"]]))}
      ${inp("purchase_notary",["Notaris aankoop","Notary (purchase)"],{list:"peNotaries"})}${inp("purchase_notary_protocol",["Protocolnummer","Protocol number"])}</div></div>`)}
function secContacts(){const C=D.contacts||{};
  const box=(k,col,lab,role)=>{const c=C[k];const cur=P[col];
    return `<div class="ad-f w2"><span>${esc(tr(lab))}</span>${cur&&c&&c.id===cur?`<div class="ad-picked"><div class="ini" style="background:var(--c-ct)">${esc((c.name||"?")[0].toUpperCase())}</div><div style="min-width:0"><b>${esc(c.name||"—")}</b><div class="sm muted">${esc(c.email||"")}</div></div>
        <span>${c.id?`<a class="btn sm" href="#c/${c.id}" data-act="close">${esc(tr(["Open","Open"]))}</a>`:""}<button class="btn sm" data-unlink="${col}">${esc(tr(["Ontkoppelen","Unlink"]))}</button></span></div>`
      :cur?`<div class="ad-picked"><div style="min-width:0;grid-column:1/3"><b>${esc((PICKED[col]||{}).name||cur)}</b> <span class="tag">${esc(tr(["nieuw gekozen","newly picked"]))}</span></div><button class="btn sm" data-unlink="${col}">×</button></div>`:""}
      <input class="ad-search" data-pick="${col}" data-role="${role||""}" type="search" placeholder="${esc(tr(["Zoek op naam, e-mail of telefoon","Search by name, e-mail or phone"]))}"><div class="ad-res" data-res="${col}"></div></div>`};
  return sec("con",["Contacten","Contacts"],row(box("owner","owner_contact_id",["Eigenaar / verkoper","Owner / seller"]),box("buyer","buyer_contact_id",["Koper","Buyer"]))
    +row(box("agency","agency_contact_id",["Aanbiedend kantoor (partner)","Listing agency (partner)"],"agent"))
    +row(`<label class="ad-f w4"><span>${esc(tr(["Interne notities (bijv. wie de sleutelhouder is)","Internal notes (e.g. who holds the keys)"]))}</span><textarea data-k="internal_notes" rows="4">${esc(P.internal_notes||"")}</textarea><small>${esc(tr(["Alleen intern, nooit op de site","Internal only, never on the site"]))}</small></label>`))}
function secPub(){
  return sec("pub",["Publicatie","Publishing"],`<h5>Labels</h5>`+multi("labels",[["exclusive","EXCLUSIVE"],["premium","PREMIUM"],["bargain","BARGAIN"],["featured",["Uitgelicht","Featured"]]],{cols:4})+`<small class="muted">${esc(tr(["NEW zet NEXUS zelf: de eerste 7 dagen na de eerste publicatie","NEXUS sets NEW itself: the first 7 days after first publication"]))}${P.published_at?" ("+NEXUS_DMY(P.published_at)+")":""}.</small>`
    +`<h5>${esc(tr(["Exportfeeds","Export feeds"]))}</h5>`+multi("export_feeds",[["idealista","Idealista"]],{cols:4})+chk("no_export",["Uitsluiten van alle XML-feeds","Exclude from all XML feeds"]))}
function secHist(){const a=D.audit||[];
  return sec("hist",["Historie","History"],a.length?`<div class="pe-audit">${a.map(x=>`<div><b>${NEXUS_DMYT(x.at)}</b> · ${esc(x.who||"?")} <span class="muted">· ${esc((x.fields||[]).join(", "))}</span></div>`).join("")}</div>`
    :`<div class="sm muted">${esc(tr(["Nog geen wijzigingen via NEXUS.","No changes via NEXUS yet."]))}</div>`)}

/* ---------- kaart ---------- */
function initMap(){const el=ROOT.querySelector("#peMap"), L=window.L;if(!el||!L||typeof L.map!=="function")return;if(MAP){MAP.remove();MAP=null}
  const has=P.lat!=null&&P.lat!==""&&P.lng!=null&&P.lng!=="";
  MAP=L.map(el,{scrollWheelZoom:false}).setView(has?[+P.lat,+P.lng]:[38.075,-0.73],has?16:11);
  const osm=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(MAP);
  const sat=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,attribution:"Esri"});
  L.control.layers({[tr(["Kaart","Map"])]:osm,[tr(["Satelliet","Satellite"])]:sat}).addTo(MAP);
  let pin=null;const place=(a,b)=>{a=+(+a).toFixed(6);b=+(+b).toFixed(6);set("lat",a);set("lng",b);
    ROOT.querySelector('[data-k="lat"]').value=a;ROOT.querySelector('[data-k="lng"]').value=b;
    if(!pin){pin=L.marker([a,b],{draggable:true}).addTo(MAP);pin.on("dragend",e=>{const ll=e.target.getLatLng();place(ll.lat,ll.lng)})}else pin.setLatLng([a,b])};
  if(has){pin=L.marker([+P.lat,+P.lng],{draggable:true}).addTo(MAP);pin.on("dragend",e=>{const ll=e.target.getLatLng();place(ll.lat,ll.lng)})}
  MAP.on("click",e=>place(e.latlng.lat,e.latlng.lng));setTimeout(()=>MAP&&MAP.invalidateSize(),80)}

/* ---------- media ---------- */
function wireMedia(){const box=ROOT.querySelector("#peMedia"), drop=ROOT.querySelector("#peDrop");if(!box)return;
  const KIND=[["photo",["Foto","Photo"]],["floorplan",["Plattegrond","Floor plan"]],["document","Document"],["energy_certificate",["Energiecertificaat","Energy certificate"]]];
  const isImg=m=>m.url&&!/\.pdf($|\?)/i.test(m.url);let pos=0;
  box.innerHTML=M.map((m,i)=>{const n=m.del?"":++pos;return `<div class="ad-mi ${m.is_main&&!m.del?"main":""} ${m.del?"del":""}" data-i="${i}">
    <div class="im" data-mdrag="${i}" title="${esc(tr(["Sleep om te verplaatsen","Drag to move"]))}" style="${isImg(m)?`background-image:url('${esc(m.url)}')`:""}">${isImg(m)?"":"PDF"}${m.is_main&&!m.del?`<span>${esc(tr(["Hoofdfoto","Main"]))}</span>`:""}${m.file?`<span class="new">${esc(tr(["nieuw","new"]))}</span>`:""}<i class="grip">⠿</i>${n?`<b class="pos">${n}</b>`:""}</div>
    <select data-mk="${i}" ${m.del?"disabled":""}>${KIND.map(k=>`<option value="${k[0]}" ${m.kind===k[0]?"selected":""}>${esc(tr(k[1]))}</option>`).join("")}</select>
    <input data-mc="${i}" placeholder="${esc(tr(["Bijschrift","Caption"]))}" value="${esc(m.caption||"")}" ${m.del?"disabled":""}>
    <div class="ad-mibtn">${m.del?"":`<button data-mmove="${i}:-1" title="${esc(tr(["Naar voren","Move earlier"]))}" ${i===0?"disabled":""}>◀</button><button data-mmove="${i}:1" title="${esc(tr(["Naar achteren","Move later"]))}" ${i===M.length-1?"disabled":""}>▶</button><span class="sp"></span>`}${!m.is_main&&!m.del&&m.kind==="photo"?`<button data-mmain="${i}" title="${esc(tr(["Maak hoofdfoto (zet hem vooraan)","Make main (moves it first)"]))}">★</button>`:""}<button data-mdel="${i}" title="${esc(m.del?tr(["Terugzetten","Restore"]):tr(["Verwijderen","Delete"]))}">${m.del?"↺":"🗑"}</button></div></div>`}).join("")
    ||`<div class="sm muted">${esc(tr(["Geen foto's.","No photos."]))}</div>`;
  /* Hoofdfoto = eerste niet-verwijderde foto. Website en edit-RPC sorteren op is_main desc, sort; zo blijft wat je ziet gelijk aan wat de site toont. */
  const syncMain=()=>{const first=M.find(x=>!x.del&&x.kind==="photo");M.forEach(x=>x.is_main=x===first)};
  const ch=()=>{syncMain();MEDIA_DIRTY=true;upDirty()};
  const move=(from,to)=>{if(to<0||to>=M.length||from===to)return;const m=M.splice(from,1)[0];M.splice(to,0,m);ch();wireMedia()};
  box.querySelectorAll("[data-mk]").forEach(s=>s.onchange=()=>{M[+s.dataset.mk].kind=s.value;ch();wireMedia()});
  box.querySelectorAll("[data-mc]").forEach(s=>s.oninput=()=>{M[+s.dataset.mc].caption=s.value;MEDIA_DIRTY=true;upDirty()});
  box.querySelectorAll("[data-mdel]").forEach(b=>b.onclick=()=>{const m=M[+b.dataset.mdel];if(m.file){M.splice(+b.dataset.mdel,1)}else m.del=!m.del;ch();wireMedia()});
  box.querySelectorAll("[data-mmain]").forEach(b=>b.onclick=()=>move(+b.dataset.mmain,0));
  box.querySelectorAll("[data-mmove]").forEach(b=>b.onclick=()=>{const [i,d]=b.dataset.mmove.split(":").map(Number);move(i,i+d)});
  /* Slepen met pointer events: werkt met muis, pen en touch. Live plaatsvervanger + auto-scroll. */
  box.querySelectorAll("[data-mdrag]").forEach(h=>h.onpointerdown=e=>{
    if(e.button>0||busy)return;const card=h.closest(".ad-mi");const touch=e.pointerType!=="mouse";
    if(touch&&!e.target.closest(".grip"))return; /* op touch: vegen over de foto = scrollen, slepen via ⠿ */
    e.preventDefault();const sx=e.clientX,sy=e.clientY;let ghost=null,ox=0,oy=0,px=sx,py=sy,raf=0;
    const scroller=box.closest(".pe-main")||document.scrollingElement;
    const start=()=>{const r=card.getBoundingClientRect();ox=sx-r.left;oy=sy-r.top;
      ghost=card.cloneNode(true);ghost.classList.add("ad-ghost");ghost.style.width=r.width+"px";ghost.style.height=r.height+"px";document.body.appendChild(ghost);
      card.classList.add("ph");document.body.classList.add("ad-sorting");place();tick()};
    const place=()=>{ghost.style.transform=`translate(${px-ox}px,${py-oy}px) rotate(1.5deg)`;
      const over=document.elementFromPoint(px,py),t=over&&over.closest(".ad-mi");
      if(!t||t===card||t.parentNode!==box)return;const r=t.getBoundingClientRect();
      const after=(py>r.bottom-r.height*.15)||(py>=r.top&&px>r.left+r.width/2);
      if(after){if(t.nextSibling!==card)box.insertBefore(card,t.nextSibling)}else if(t.previousSibling!==card)box.insertBefore(card,t)};
    const tick=()=>{const r=scroller===document.scrollingElement?{top:0,bottom:innerHeight}:scroller.getBoundingClientRect(),Z=70;
      const v=py<r.top+Z?-Math.ceil((r.top+Z-py)/5):py>r.bottom-Z?Math.ceil((py-(r.bottom-Z))/5):0;
      if(v){scroller.scrollTop+=v;place()}raf=requestAnimationFrame(tick)};
    const mv=ev=>{px=ev.clientX;py=ev.clientY;if(!ghost){if(Math.hypot(px-sx,py-sy)<6)return;start()}else place()};
    const end=ev=>{removeEventListener("pointermove",mv);removeEventListener("pointerup",end);removeEventListener("pointercancel",end);cancelAnimationFrame(raf);
      if(!ghost)return;ghost.remove();card.classList.remove("ph");document.body.classList.remove("ad-sorting");
      if(ev.type==="pointercancel"){wireMedia();return}
      const order=[...box.querySelectorAll(".ad-mi")].map(x=>M[+x.dataset.i]);
      if(order.some((m,i)=>m!==M[i])){M.length=0;M.push(...order);ch()}wireMedia()};
    addEventListener("pointermove",mv);addEventListener("pointerup",end);addEventListener("pointercancel",end)});
  if(drop&&!drop.dataset.w){drop.dataset.w=1;const f=drop.querySelector("input");drop.onclick=()=>f.click();
    drop.ondragover=e=>{e.preventDefault();drop.classList.add("over")};drop.ondragleave=()=>drop.classList.remove("over");
    drop.ondrop=e=>{e.preventDefault();drop.classList.remove("over");add(e.dataTransfer.files)};f.onchange=()=>{add(f.files);f.value=""}}
  function add(files){[...files].forEach(file=>{if(!/^image\/(jpeg|png|webp)$|^application\/pdf$/.test(file.type))return err(tr([`${file.name}: alleen JPG, PNG, WebP of PDF`,`${file.name}: JPG, PNG, WebP or PDF only`]));
    if(file.size>20*1048576)return err(tr([`${file.name} is groter dan 20 MB`,`${file.name} exceeds 20 MB`]));
    const hasMain=M.some(x=>x.is_main&&!x.del);
    M.push({file,url:file.type.startsWith("image/")?URL.createObjectURL(file):null,kind:file.type==="application/pdf"?"energy_certificate":/plan|plano/i.test(file.name)?"floorplan":"photo",caption:"",is_main:!hasMain&&file.type.startsWith("image/")})});
    ch();wireMedia()}
}

/* ---------- afstanden en teksten (19-10-2026) ---------- */
let GEN=false;
async function fnCall(name,body){const {data,error}=await X.sb.functions.invoke(name,{body});
  if(error){let m=error.message;try{const j=await error.context.json();m=j.error||m}catch(_){}throw new Error(m)}
  if(data&&data.ok===false)throw new Error(data.error||"error");return data}
const locName=id=>{const l=(D.locations||[]).find(x=>x.id===Number(id));return l?l.name:null};
async function calcDist(){const info=ROOT.querySelector("#peDistInfo");
  if(P.lat==null||P.lng==null||P.lat===""||P.lng===""){if(info)info.textContent=tr(["Zet eerst de pin op de kaart.","Place the pin on the map first."]);return}
  if(info)info.textContent=tr(["Afstanden worden berekend…","Calculating distances…"]);
  try{const r=await fnCall("property-distances",{lat:+P.lat,lng:+P.lng,municipality:P.city||null,area:P.suburb||P.location_area||null});
    [["distance_sea_m",r.sea_m],["distance_airport_m",r.airport_m],["distance_city_m",r.city_m],["distance_shops_m",r.shops_m]].forEach(([k,v])=>{if(v!=null){set(k,v);ROOT.querySelectorAll(`[data-k="${k}"]`).forEach(x=>x.value=v)}});
    const i2=ROOT.querySelector("#peDistInfo");if(i2)i2.textContent=tr(["Hemelsbreed berekend","Straight line"])+" · "+[r.airport,r.centre,r.shop].filter(Boolean).join(" · ")+" — "+tr(["nog niet opgeslagen","not saved yet"])}
  catch(x){if(info)info.textContent=tr(["Afstanden niet berekend: ","Distances not calculated: "])+(x.message||x)}}
async function genTexts(){if(GEN)return;
  if(dirtyCount()){err(tr(["Sla eerst je wijzigingen op; Agent SEO werkt met de opgeslagen gegevens.","Save your changes first; Agent SEO works from the saved data."]));return}
  if(((T.en||{}).description||"").length>200&&!confirm(tr(["Agent SEO herschrijft de Engelse omschrijving en SEO-teksten (de kop blijft staan). NL en SV worden daarna opnieuw vertaald. Doorgaan?","Agent SEO rewrites the English description and SEO texts (the heading stays). NL and SV are then translated again. Continue?"])))return;
  GEN=true;render(true);let r,msg;
  try{r=await fnCall("property-enrich-now",{property_id:P.id})}catch(x){r={ok:false,error:x.message||String(x)}}
  GEN=false;
  const c=r.catastro;const parts=[];
  parts.push(c?(c.status==="ok"?"✓ "+tr(["Kadaster","Cadastre"])+": "+(c.cadastral_ref||""):"⚠ "+tr(["Kadaster niet gevonden","Cadastre not found"])+(c.error?": "+c.error:"")):(r.pending?"…":"⚠ "+tr(["Kadaster: geen resultaat","Cadastre: no result"])));
  parts.push(((r.seo||{}).written||[]).length?"✓ "+tr(["Teksten geschreven (EN); NL en SV volgen binnen enkele minuten","Texts written (EN); NL and SV follow within minutes"]):"⚠ "+(r.error||tr(["Teksten niet geschreven","Texts not written"])));
  msg=parts.join(" · ");
  await load(P.reference);
  const m=ROOT.querySelector("#peGenMsg");if(m)m.innerHTML=`<span style="color:${r.ok?"#34d399":"#fbbf24"}">${esc(msg)}</span>`}

/* ---------- events ---------- */
let PICKED={};
function set(k,v){P[k]=v;TOUCH[k]=1;
  /* Rick 20-10: Verkoopdatum en "Verkocht op (status)" zijn hetzelfde; NEXUS toont alleen Verkoopdatum en houdt sold_at gelijk */
  if(k==="sold_date"){P.sold_at=v;TOUCH.sold_at=1}
  upDirty()}
function err(msg){const e=ROOT.querySelector("#peErr");if(!e)return;e.innerHTML=msg?`<div class="pe-errbox">${esc(msg)}</div>`:"";if(msg)e.scrollIntoView({block:"nearest"})}
function bind(){
  ROOT.addEventListener("input",e=>{const el=e.target;
    if(el.dataset.tx){const [l,f]=el.dataset.tx.split(".");(T[l]=T[l]||{})[f]=el.value;TTOUCH[el.dataset.tx]=1;upDirty();return}
    if(el.dataset.pick!=null){pickSearch(el);return}
    if((el.dataset.fxc||el.dataset.fxl)&&window.NEXUS_FEAT){if(NEXUS_FEAT.handle(el,featModel()))render(true);return}
    const k=el.dataset.k;if(!k)return;
    if(el.dataset.arr!=null){const v=el.dataset.arr;
      if(el.dataset.csv!=null){let a=String(P[k]||"").split(/\s*,\s*/).filter(Boolean);a=el.checked?[...new Set([...a,v])]:a.filter(x=>x!==v);set(k,a.join(",")||null)}
      else if(el.dataset.path){const o=JSON.parse(JSON.stringify(P[k]||{}));let a=o[el.dataset.path]||[];a=el.checked?[...new Set([...a,v])]:a.filter(x=>x!==v);
        if(a.length)o[el.dataset.path]=a;else delete o[el.dataset.path];set(k,o)}
      else{let a=[...(P[k]||[])];a=el.checked?[...new Set([...a,v])]:a.filter(x=>x!==v);set(k,a)}return}
    if(el.dataset.bool!=null){set(k,el.checked);return}
    if(k==="drive_folder_id"){const m=String(el.value).match(/folders\/([\w-]{10,})|[?&]id=([\w-]{10,})/);if(m){el.value=m[1]||m[2]}}
    set(k,el.value)});
  ROOT.addEventListener("change",e=>{const el=e.target;
    if(el.tagName==="SELECT"&&el.dataset.k)set(el.dataset.k,el.value===""?null:el.value);
    if(el.dataset.loc){const locs=D.locations;
      if(el.dataset.loc==="mun"){const m=locs.find(x=>x.id===+el.value);set("location_id",m?m.id:null);set("city",m?m.name:null);set("suburb",null)}
      else{const a=locs.find(x=>x.id===+el.value), mun=ROOT.querySelector('[data-loc="mun"]').value, m=locs.find(x=>x.id===+mun);
        set("location_id",a?a.id:(m?m.id:null));set("suburb",a?a.name:null)}
      render(true)}});
  ROOT.addEventListener("click",e=>{const b=e.target.closest("button,a");if(!b||!ROOT.contains(b))return;const d=b.dataset;
    if(d.act==="close"){if(b.tagName!=="A")e.preventDefault();close();return}
    if(d.act==="save"){e.preventDefault();save();return}
    if(d.act==="reload"){e.preventDefault();load(P.reference);return}
    if(d.act==="dist"){e.preventDefault();calcDist();return}
    if(d.fxr&&window.NEXUS_FEAT){e.preventDefault();if(NEXUS_FEAT.handle(b,featModel()))render(true);return}
    if(d.act==="gen"){e.preventDefault();genTexts();return}
    if(d.deed){e.preventDefault();if(window.NEXUS_DEED)NEXUS_DEED.run({sb:X.sb,tr,current:P,onApply:v=>{Object.entries(v).forEach(([k,x])=>set(k,x));render(true);
      const s=ROOT.querySelector("#pe-kost");if(s)s.scrollIntoView({block:"start"});toast(tr(["Overgenomen; vergeet niet op te slaan","Applied; remember to save"]))}});return}
    if(d.act==="keynext"){e.preventDefault();(async()=>{try{const n=await X.rpc("nexus_key_number_next",{});set("key_number",String(n));render(true)}catch(x){err(x.message||String(x))}})();return}
    if(d.act==="delete"){e.preventDefault();delProp();return}
    if(d.jump){e.preventDefault();const s=ROOT.querySelector("#pe-"+d.jump);if(s)s.scrollIntoView({behavior:"smooth",block:"start"});return}
    if(d.status){e.preventDefault();const was=P.status;set("status",d.status);
      /* Rick 20-10: bij Verkocht direct door naar de sectie Verkoop; Verkoopdatum = vandaag als die nog leeg is */
      if(d.status==="sold"&&was!=="sold"&&!P.sold_date&&!ro("sold_date")){const t=new Date();set("sold_date",`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`)}
      render(true);
      if(d.status==="sold"&&was!=="sold")setTimeout(()=>{const s=ROOT.querySelector("#pe-sale");if(s)s.scrollIntoView({behavior:"smooth",block:"start"});
        const f=ROOT.querySelector('[data-k="sold_price"]');if(f&&!f.disabled)setTimeout(()=>f.focus({preventScroll:true}),350)},30);
      return}
    if(d.txl){e.preventDefault();txL=d.txl;render(true);return}
    if(d.unlink){e.preventDefault();set(d.unlink,null);render(true);return}
    if(d.pickid){e.preventDefault();const c=JSON.parse(d.pickid);PICKED[d.col]=c;set(d.col,c.id);render(true);return}
  });
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&ROOT&&ROOT.classList.contains("pe")&&document.body.classList.contains("pe-open"))close()});
}
let pT;function pickSearch(el){clearTimeout(pT);pT=setTimeout(async()=>{const col=el.dataset.pick, box=ROOT.querySelector(`[data-res="${col}"]`);
  let r=[];try{r=await X.rpc("nexus_contact_pick",{p_q:el.value,p_role:el.dataset.role||null})}catch(_){}
  box.innerHTML=(r||[]).map(c=>`<button class="ad-hit" data-col="${col}" data-pickid='${esc(JSON.stringify({id:c.id,name:c.name}))}'><div class="ini" style="background:var(--c-ct)">${esc((c.name||"?")[0].toUpperCase())}</div>
    <div style="min-width:0"><b>${esc(c.name||"—")}</b><div class="sm muted">${esc([(c.roles||[]).join(", "),c.email,c.phone,c.city].filter(Boolean).join(" · "))}</div></div><span></span></button>`).join("")
    ||(el.value.trim().length>=2?`<div class="empty sm">${esc(tr(["Niets gevonden","Nothing found"]))}</div>`:"")},260)}

/* ---------- laden / opslaan ---------- */
async function load(ref){
  shell();TOUCH={};TTOUCH={};MEDIA_DIRTY=false;PICKED={};
  await loadLK();
  try{D=await X.rpc("nexus_property_edit",{p_ref:ref})}catch(e){ROOT.querySelector(".pe-box").innerHTML=`<div class="pe-load">${esc(e.message)} <button class="btn" data-act="close">×</button></div>`;return}
  if(!D){ROOT.querySelector(".pe-box").innerHTML=`<div class="pe-load">${esc(tr(["Woning niet gevonden","Property not found"]))} <button class="btn" data-act="close">×</button></div>`;return}
  P=JSON.parse(JSON.stringify(D.property));if(!P.sold_date&&P.sold_at)P.sold_date=String(P.sold_at).slice(0,10);T=JSON.parse(JSON.stringify(D.texts||{}));M=JSON.parse(JSON.stringify(D.media||[]));
  render();
  if(X.jump)setTimeout(()=>{const s=ROOT.querySelector("#pe-"+X.jump);if(s)s.scrollIntoView({block:"start"})},60);
}
function close(){if(dirtyCount()&&!confirm(tr(["Er zijn niet-opgeslagen wijzigingen. Toch sluiten?","There are unsaved changes. Close anyway?"])))return;
  M&&M.forEach(m=>m.file&&m.url&&URL.revokeObjectURL(m.url));if(MAP){MAP.remove();MAP=null}
  ROOT.className="";ROOT.innerHTML="";document.body.classList.remove("pe-open")}
let LK={};
async function loadLK(){if(LK.registry)return;try{LK=await X.rpc("nexus_lookups",{})||{}}catch(_){LK={}}}
async function delProp(){
  const ref=P.reference;
  const typed=prompt(tr([`Woning ${ref} definitief verwijderen? Teksten, foto-verwijzingen en prijshistorie gaan mee; aanvragen en bezichtigingen blijven bestaan zonder woning. Er wordt een volledige kopie in het auditlog bewaard.\n\nTyp ${ref} om te bevestigen:`,
    `Permanently delete property ${ref}? Texts, photo references and price history go with it; requests and viewings remain without a property. A full copy is kept in the audit log.\n\nType ${ref} to confirm:`]));
  if(typed==null)return;if(typed.trim().toUpperCase()!==String(ref).toUpperCase()){alert(tr(["Referentie klopt niet; niets verwijderd.","Reference does not match; nothing deleted."]));return}
  try{await X.rpc("nexus_property_delete",{p_id:P.id});
    M&&M.forEach(m=>m.file&&m.url&&URL.revokeObjectURL(m.url));if(MAP){MAP.remove();MAP=null}
    ROOT.className="";ROOT.innerHTML="";document.body.classList.remove("pe-open");
    alert(tr([`Woning ${ref} verwijderd`,`Property ${ref} deleted`]));location.hash="pr";location.reload()}
  catch(e){err(e.message||String(e))}}
async function save(){
  if(busy)return;if(D.is_admin&&!D.property.sold_date&&P.sold_date)TOUCH.sold_date=1;const pt=patch(), tt=tpatch();
  if(!dirtyCount())return;
  if(pt.status==="sold"&&D.is_admin&&!P.sold_date&&!confirm(tr(["Status Verkocht zonder verkoopdatum. Toch opslaan?","Status Sold without sale date. Save anyway?"])))return;
  busy=true;upDirty();const btn=ROOT.querySelector("#peSave");btn.textContent=tr(["Opslaan…","Saving…"]);err("");
  try{
    let fresh=null;
    if(Object.keys(pt).length||Object.keys(tt).length)fresh=await X.rpc("nexus_property_save",{p_id:P.id,p_patch:pt,p_texts:tt,p_base:D.property.updated_at});
    if(MEDIA_DIRTY){
      for(const m of M.filter(x=>x.file)){
        const ext=(m.file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
        const path=`${P.id}/nexus-${(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(36).slice(2))}.${ext}`;
        const up=await X.sb.storage.from("property-media").upload(path,m.file,{contentType:m.file.type,upsert:false});
        if(up.error)throw new Error(tr(["Upload mislukt: ","Upload failed: "])+up.error.message);
        const r=await X.rpc("nexus_property_media_add",{p_property_id:P.id,p_storage_path:path,p_kind:m.kind,p_caption:m.caption||null});
        m.id=r.id;delete m.file;
      }
      const items=M.map((m,i)=>m.del?{id:m.id,delete:true}:{id:m.id,sort:i,is_main:!!m.is_main,caption:m.caption||"",kind:m.kind});
      fresh=await X.rpc("nexus_property_media_save",{p_property_id:P.id,p_items:items});
    }
    if(fresh){D=fresh}
    TOUCH={};TTOUCH={};MEDIA_DIRTY=false;PICKED={};
    P=JSON.parse(JSON.stringify(D.property));if(!P.sold_date&&P.sold_at)P.sold_date=String(P.sold_at).slice(0,10);T=JSON.parse(JSON.stringify(D.texts||{}));M=JSON.parse(JSON.stringify(D.media||[]));
    busy=false;render(true);toast(tr(["Opgeslagen","Saved"]));
    X.onSaved&&X.onSaved(P.reference);
  }catch(e){busy=false;btn.textContent=tr(["Opslaan","Save"]);upDirty();
    if(e.code==="40001")ROOT.querySelector("#peErr").innerHTML=`<div class="pe-errbox">${esc(e.message)} <button class="btn sm" data-act="reload">${esc(tr(["Herladen","Reload"]))}</button></div>`;
    else err(e.message||String(e))}
}
function toast(msg){const t=document.createElement("div");t.className="pe-toast";t.textContent="✓ "+msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2200)}

/* ---------- snelle statuswissel vanuit het detailscherm ---------- */
async function quickStatus(ctx,id,ref,status,base){X=ctx;
  const r=await ctx.rpc("nexus_property_save",{p_id:id,p_patch:{status},p_texts:{},p_base:base});return r}

/* ---------- contact bewerken (compact) ---------- */
/* Alle bewerkbare contactvelden (core.contacts). Rick 18-10-2026: bij wijzigen moeten alle velden zichtbaar zijn, ook de lege. */
const CPERSON=[["title",["Aanhef","Title"]],["first_name",["Voornaam","First name"]],["last_name",["Achternaam","Last name"]],["company",["Bedrijf","Company"]],
  ["nie","NIE"],["passport",["Paspoortnummer","Passport number"]],["birthday",["Geboortedatum","Birthday"],"date"],["language",["Taal (nl/en/es…)","Language (nl/en/es…)"]],
  ["marital",["Burgerlijke staat","Marital status"]],["jobtitle",["Functie","Job title"]]];
const CADDR=[["street",["Straat","Street"]],["street_number",["Nr.","No."]],["postcode",["Postcode","Postcode"]],["city",["Plaats","City"]],["suburb",["Wijk","Area"]],["state",["Provincie","Province"]],
  ["country",["Land","Country"]],["website","Website"],["referred_by",["Verwezen door","Referred by"]]];
const CEXTRA=[["facebook","Facebook"],["instagram","Instagram"],["linkedin","LinkedIn"],["twitter","X / Twitter"],["custom_1",["Vrij veld 1","Custom field 1"]],["custom_2",["Vrij veld 2","Custom field 2"]]];
const CFIELDS=[...CPERSON,...CADDR,...CEXTRA];
const CEDIT=["keyholder","internal_comments","owner_id","source","sales_value","mailing_optin"].concat(CFIELDS.map(f=>f[0]));
/* Nieuwsbrieven = slugs uit mailing_types (gelijk aan nexus-admin.js). market_report alleen bij expliciete opt-in. */
const CMAILS=[["weekly_news",["Wekelijks nieuws (vrijdag)","Weekly news (Friday)"]],["price_reduced",["Prijsverlagingen (woensdag)","Price reductions (Wednesday)"]],
  ["monthly_matches",["Maandelijkse woningmatches","Monthly property matches"]],["new_listing",["Nieuwe woning","New listing"]],
  ["market_report",["Marktbericht (alleen met expliciete opt-in)","Market report (explicit opt-in only)"]]];
const CMAIL_DEF=["weekly_news","price_reduced","monthly_matches","new_listing"];
/* Aanhef per persoon; "Mr & Mrs" bestaat niet meer — een echtpaar is twee contacten (partner) */
const TITLES=[["",""],["Mr","Mr"],["Mrs","Mrs"],["Ms","Ms"],["Dhr.","Dhr."],["Mevr.","Mevr."],["Sr.","Sr."],["Sra.","Sra."],["Herr","Herr"],["Frau","Frau"],["Dr.","Dr."]];
const SP_BUDGET=[["",""],["100k","€ 100k"],["150k","€ 150k"],["250k","€ 250k"],["more",["Meer","More"]]];
const SP_PERIOD=[["",""],["0-3",["0-3 maanden","0-3 months"]],["3-6",["3-6 maanden","3-6 months"]],["longer",["Langer","Longer"]]];
async function openContact(key,ctx){X=ctx;
  ROOT=document.getElementById("pe");if(!ROOT){ROOT=document.createElement("div");ROOT.id="pe";document.body.appendChild(ROOT);bind()}
  ROOT.className="pe";document.body.classList.add("pe-open");ROOT.innerHTML=`<div class="pe-box pe-small"><div class="pe-load">${esc(tr(["Contact laden…","Loading contact…"]))}</div></div>`;
  let C;try{C=await X.rpc("nexus_contact_by_key",{p_key:String(key)})}catch(e){ROOT.querySelector(".pe-box").innerHTML=`<div class="pe-load">${esc(e.message)} <button class="btn" data-act="cclose">×</button></div>`;return}
  const o=C.core||{}, v=JSON.parse(JSON.stringify(o));
  /* zoekprofiel en mailings: eigen staat naast de kolommen */
  const spClean=x=>Object.fromEntries(Object.entries(x||{}).filter(([,w])=>Array.isArray(w)?w.length:(w!=null&&String(w).trim()!=="")).map(([k,w])=>[k,Array.isArray(w)?[...w].sort():(k==="bedrooms_min"?Number(w):String(w).trim())]));
  const SP0=spClean(C.search_profile||{}), SP=JSON.parse(JSON.stringify(C.search_profile||{}));
  const spChanged=()=>JSON.stringify(Object.entries(spClean(SP)).sort())!==JSON.stringify(Object.entries(SP0).sort());
  const mp0=C.mailing_prefs||{}, MS0={};
  CMAILS.forEach(([sl])=>{const x=mp0[sl];MS0[sl]=x&&x.on!=null?!!x.on:(!!o.mailing_optin&&CMAIL_DEF.includes(sl))});
  const MS=Object.assign({},MS0);
  const msChanged=()=>CMAILS.some(([sl])=>MS[sl]!==MS0[sl]);
  const optSel=(attr,k,opts,cur)=>{const has=opts.some(x=>x[0]===String(cur??""));return `<select ${attr}="${k}">${has?"":`<option value="${esc(cur)}" selected>${esc(cur)}</option>`}${opts.map(x=>`<option value="${esc(x[0])}" ${String(cur??"")===x[0]?"selected":""}>${esc(tr(x[1]))}</option>`).join("")}</select>`};
  const cats=()=>[["",""]].concat((LS().CATS||[["apartment",["Appartement","Apartment"]],["villa","Villa"],["other",["Overig","Other"]]]));
  const mailRows=()=>`<label class="ad-c"><input type="checkbox" data-cf="mailing_optin" ${v.mailing_optin?"checked":""}><span><b>${esc(tr(["Toestemming voor mailings (opt-in)","Consent to mailings (opt-in)"]))}</b></span></label>
       <div class="ad-row" style="margin-top:8px">${CMAILS.map(([sl,lab])=>`<label class="ad-c ${sl==="market_report"?"w2":""}"><input type="checkbox" data-ms="${sl}" ${MS[sl]?"checked":""} ${v.mailing_optin?"":"disabled"}><span>${esc(tr(lab))}</span></label>`).join("")}</div>
       <small class="muted">${esc(tr(["Zonder toestemming gaat er geen enkele nieuwsbrief uit. Transactionele mails (review, welkom verkoper, opvolging) vallen hier niet onder.","Without consent no newsletter is sent. Transactional mails (review, seller welcome, follow-up) are not covered here."]))}</small>`;
  const cfIn=f=>f[0]==="title"?`<label class="ad-f"><span>${esc(tr(f[1]))}</span>${optSel("data-cf","title",TITLES,v.title)}</label>`
    :`<label class="ad-f"><span>${esc(tr(f[1]))}</span><input data-cf="${f[0]}" type="${f[2]||"text"}" value="${esc(v[f[0]]??"")}"></label>`;
  /* labels: aan/uit; bij Seller/Suspect-Seller aan verschijnt de optie om meteen een woning aan te maken */
  const RL=[["suspect","Suspect"],["seller","Seller"],["buyer","Buyer"],["suspect_seller","Suspect-Seller"],["agent","Agent"]];
  const r0=new Set((C.contact.roles||[]).map(x=>String(x).replace(/-/g,"_")).filter(x=>RL.some(r=>r[0]===x)));
  const rs=new Set(r0); let mkProp=false;
  /* e-mails, telefoons en verantwoordelijk teamlid */
  const ch0=C.channels||{emails:(C.details&&C.details.emails||[]).map((e,i)=>({email:e.value,kind:e.label||"",is_primary:i===0})),phones:(C.details&&C.details.phones||[]).map((p,i)=>({phone:p.value,kind:p.label||"",is_primary:i===0}))};
  const EM=JSON.parse(JSON.stringify(ch0.emails||[])), PH=JSON.parse(JSON.stringify(ch0.phones||[]));
  const norm=a=>JSON.stringify(a.filter(x=>(x.email||x.phone||"").trim()).map(x=>[(x.email||x.phone||"").trim().toLowerCase(),x.kind||"",!!x.is_primary]));
  const chChanged=()=>norm(EM)!==norm(ch0.emails||[])||norm(PH)!==norm(ch0.phones||[]);
  /* Partner / tweede persoon (Rick 19-10-2026): echtparen zijn twee losse contacten met eigen e-mail en mobiel,
     gekoppeld via relatie 'partner'. De woningen van de één gelden in NEXUS als mede-eigendom van de ander.
     Bij een duidelijk tweepersoonsrecord ("John & Heather") staat het voorstel al ingevuld; pas na Opslaan wordt het gesplitst. */
  const PL0=C.partners||[], UNL=new Set();
  const PT={mode:"none",title:"",first_name:"",last_name:o.last_name||"",email:"",ekind:"",phone:"",pick:null,res:[]};
  let HINT=null, MOVED=null;
  if(!PL0.length){try{HINT=await X.rpc("nexus_couple_split_hint",{p_id:o.id})}catch(_){HINT=null}}
  const applyHint=on=>{
    if(on){v.first_name=HINT.first_name_1;if(/&|\band\b|mr\s*mrs/i.test(String(o.title||"")))v.title=null;
      Object.assign(PT,{mode:"new",first_name:HINT.first_name_2,last_name:HINT.last_name||o.last_name||""});
      const m=(HINT.move_emails||[])[0];if(m){const i=EM.findIndex(x=>(x.email||"").toLowerCase()===String(m.email).toLowerCase());
        if(i>=0){MOVED=EM.splice(i,1)[0];if(MOVED.is_primary&&EM.length)EM[0].is_primary=true;PT.email=MOVED.email;PT.ekind=MOVED.kind||""}}}
    else{v.first_name=o.first_name;v.title=o.title;if(MOVED){EM.forEach(x=>x.is_primary=x.is_primary&&!MOVED.is_primary);EM.push(MOVED);MOVED=null}PT.email=""}};
  if(HINT&&HINT.first_name_2)applyHint(true);
  const ptOn=()=>PT.mode==="new"?!!(PT.first_name.trim()||PT.last_name.trim()):PT.mode==="link"?!!PT.pick:false;
  const ptChanged=()=>ptOn()||UNL.size>0;
  const EK=[["",tr(["—","—"])],["private",tr(["Privé","Private"])],["work",tr(["Werk","Work"])]], PK=[["mobile",tr(["Mobiel","Mobile"])],["phone",tr(["Vast","Landline"])],["work",tr(["Werk","Work"])],["whatsapp","WhatsApp"],["",tr(["—","—"])]];
  const chRows=(arr,key,kinds,ph)=>arr.map((x,i)=>`<div class="pe-ch"><input data-ch="${key}" data-i="${i}" data-f="${key==="em"?"email":"phone"}" value="${esc(x.email||x.phone||"")}" placeholder="${esc(ph)}" type="${key==="em"?"email":"tel"}">
     <select data-ch="${key}" data-i="${i}" data-f="kind">${kinds.map(k=>`<option value="${k[0]}" ${String(x.kind||"")===k[0]?"selected":""}>${esc(k[1])}</option>`).join("")}</select>
     <label class="ad-c" title="${esc(tr(["Hoofdadres","Primary"]))}"><input type="radio" name="pr-${key}" data-ch="${key}" data-i="${i}" data-f="is_primary" ${x.is_primary?"checked":""}><span>★</span></label>
     <button type="button" class="ad-x" data-chdel="${key}" data-i="${i}">×</button></div>`).join("")+`<button type="button" class="btn sm" data-chadd="${key}">+ ${esc(key==="em"?tr(["e-mail","e-mail"]):tr(["telefoon","phone"]))}</button>`;
  const isSell=set=>set.has("seller")||set.has("suspect_seller");
  const rolesChanged=()=>r0.size!==rs.size||[...rs].some(x=>!r0.has(x));
  const propOpt=()=>isSell(rs)&&!isSell(r0)?`<label class="ad-c pe-mkprop"><input type="checkbox" id="peMkProp" ${mkProp?"checked":""}><span><b>${esc(tr(["Woning aanmaken voor dit contact","Create a property for this contact"]))}</b> · ${esc(tr(["na opslaan opent ‘Woning toevoegen’ met dit contact als eigenaar","after saving, ‘Add property’ opens with this contact as owner"]))}</span></label>`:(isSell(rs)&&!(C.properties||[]).some(p=>p.relation==="eigenaar")?`<button type="button" class="btn sm" id="peMkPropBtn">+ ${esc(tr(["Woning aanmaken voor dit contact","Create a property for this contact"]))}</button>`:"");
  const ptSec=()=>{
    const cards=PL0.map(x=>`<div class="ad-picked pe-ptc ${UNL.has(x.id)?"off":""}"><div class="ini" style="background:var(--r-buyer)">${esc((x.name||x.email||"?").slice(0,1).toUpperCase())}</div>
       <div style="min-width:0"><b>${esc(x.name||"—")}</b><div class="sm muted">${esc([(x.roles||[]).join(", "),x.email,x.phone].filter(Boolean).join(" · ")||tr(["geen e-mail of telefoon","no e-mail or phone"]))}</div>
       ${UNL.has(x.id)?`<div class="sm" style="color:#f87171">${esc(tr(["Wordt ontkoppeld bij opslaan (het contact zelf blijft bestaan)","Will be unlinked on save (the contact itself remains)"]))}</div>`:""}</div>
       <div style="display:flex;gap:6px"><button type="button" class="btn sm" data-ptgo="${esc(x.id)}">${esc(tr(["Openen","Open"]))}</button>
       <button type="button" class="btn sm" data-ptun="${esc(x.id)}">${esc(UNL.has(x.id)?tr(["Toch gekoppeld laten","Keep linked"]):tr(["Ontkoppelen","Unlink"]))}</button></div></div>`).join("");
    const live=PL0.filter(x=>!UNL.has(x.id)).length;
    const hint=HINT&&HINT.first_name_2&&PT.mode==="new"&&!live?`<div class="pe-pthint">💡 ${esc(tr([`Dit record bevat twee personen. Voorstel: ${HINT.first_name_1} blijft dit contact, ${HINT.first_name_2} wordt een eigen contact en als partner gekoppeld${MOVED?` (met e-mail ${MOVED.email})`:""}. Controleer de aanhef en vul eventueel e-mail en mobiel aan; er wordt pas gesplitst bij Opslaan.`,
        `This record holds two people. Proposal: ${HINT.first_name_1} stays this contact, ${HINT.first_name_2} becomes a contact of their own, linked as partner${MOVED?` (with e-mail ${MOVED.email})`:""}. Check the titles and add e-mail and mobile if known; nothing is split until you Save.`]))}</div>`:"";
    const seg=`<div class="seg ad-seg" style="margin:6px 0 10px">${[["none",["Geen partner","No partner"]],["new",["Nieuwe partner","New partner"]],["link",["Bestaand contact koppelen","Link existing contact"]]]
       .map(m=>`<button type="button" data-ptm="${m[0]}" class="${PT.mode===m[0]?"on":""}">${esc(tr(m[1]))}</button>`).join("")}</div>`;
    const fNew=`<div class="ad-row">
         <label class="ad-f"><span>${esc(tr(["Aanhef","Title"]))}</span>${optSel("data-pt","title",TITLES,PT.title)}</label>
         <label class="ad-f"><span>${esc(tr(["Voornaam","First name"]))}</span><input data-pt="first_name" value="${esc(PT.first_name)}" autocomplete="off"></label>
         <label class="ad-f"><span>${esc(tr(["Achternaam","Last name"]))}</span><input data-pt="last_name" value="${esc(PT.last_name)}" autocomplete="off"></label></div>
       <div class="ad-row">
         <label class="ad-f w2"><span>${esc(tr(["Eigen e-mail","Own e-mail"]))}</span><input data-pt="email" type="email" value="${esc(PT.email)}" placeholder="naam@voorbeeld.com" autocomplete="off"></label>
         <label class="ad-f w2"><span>${esc(tr(["Eigen mobiel","Own mobile"]))}</span><input data-pt="phone" type="tel" value="${esc(PT.phone)}" placeholder="+34 …" autocomplete="off"></label></div>
       <small class="muted">${esc(tr(["Adres, taal, land, verantwoordelijk teamlid en labels worden overgenomen van dit contact. Mailing-toestemming niet: die geeft ieder zelf. E-mail en mobiel mogen leeg blijven.","Address, language, country, responsible team member and labels are copied from this contact. Mailing consent is not: everyone gives that themselves. E-mail and mobile may stay empty."]))}</small>`;
    const fLink=PT.pick?`<div class="ad-picked"><div class="ini" style="background:var(--r-buyer)">${esc((PT.pick.name||"?").slice(0,1).toUpperCase())}</div><div style="min-width:0"><b>${esc(PT.pick.name||"—")}</b><div class="sm muted">${esc(PT.pick.sub||"")}</div></div><button type="button" class="btn sm" data-ptclr="1">×</button></div>`
      :`<input class="ad-search" id="pePtQ" type="search" placeholder="${esc(tr(["Naam, e-mail of telefoon van de partner","Partner's name, e-mail or phone"]))}" autocomplete="off"><div class="ad-res" id="pePtRes">${PT.res.map((c,i)=>`<button type="button" class="ad-hit" data-ptpick="${i}"><div class="ini" style="background:var(--c-ct)">${esc((c.name||"?")[0].toUpperCase())}</div><div style="min-width:0"><b>${esc(c.name||"—")}</b><div class="sm muted">${esc([(c.roles||[]).join(", "),c.email,c.phone,c.city].filter(Boolean).join(" · "))}</div></div><span></span></button>`).join("")}</div>`;
    return cards+(live?`<small class="muted">${esc(tr(["Beide contacten zijn los te vinden, met eigen e-mail en telefoon. De woningen van de één staan bij de ander als mede-eigendom.","Both contacts can be found separately, each with own e-mail and phone. Each partner's properties show on the other as co-owned."]))}</small>`
      :hint+seg+(PT.mode==="new"?fNew:PT.mode==="link"?fLink:`<small class="muted">${esc(tr(["Heeft dit contact een partner die mede-eigenaar of mede-koper is? Leg die vast als eigen contact, niet als tweede naam in dit record.","Does this contact have a partner who co-owns or co-buys? Record them as a contact of their own, not as a second name in this record."]))}</small>`));
  };
  const draw=()=>{const sc=ROOT.querySelector(".pe-main");const top=sc?sc.scrollTop:0;ROOT.innerHTML=`<div class="pe-box pe-small"><header class="pe-hd"><div style="min-width:0"><div class="pe-ref">${esc(C.contact.full_name||"—")}</div><div class="pe-tt">${esc(tr(["Contactgegevens bewerken","Edit contact details"]))}</div></div>
     <button class="pe-x" data-act="cclose">×</button></header>
     <div class="pe-main"><div id="peErr"></div>
     <section class="ad-sec" style="--sc:#ec4899"><h4>${esc(tr(["Labels","Labels"]))}</h4><div class="pe-roles">${RL.map(r=>`<button type="button" class="pe-role ${rs.has(r[0])?"on":""}" data-role="${r[0]}" style="--rc:var(--r-${r[0].replace("_","-")})">${r[1]}</button>`).join("")}</div>
       <small class="muted">${esc(tr(["Een contact kan op elk moment een ander label krijgen. Minstens één label.","A contact can get another label at any time. At least one label."]))}</small><div id="peProp">${propOpt()}</div></section>
     <section class="ad-sec" style="--sc:#3b82f6"><h4>${esc(tr(["Persoon en identiteit","Person and identity"]))}</h4>
       <div class="ad-row">${CPERSON.map(cfIn).join("")}</div>
</section>
     <section class="ad-sec" style="--sc:#e11d48"><h4>💑 ${esc(tr(["Partner / tweede persoon","Partner / second person"]))}</h4><div id="pePt">${ptSec()}</div></section>
     <section class="ad-sec" style="--sc:#06b6d4"><h4>${esc(tr(["Adres en overig","Address and other"]))}</h4>
       <div class="ad-row">${CADDR.map(cfIn).join("")}</div>
       <label class="ad-f w4"><span>${esc(tr(["Interne opmerking","Internal note"]))}</span><textarea data-cf="internal_comments" rows="4">${esc(v.internal_comments||"")}</textarea></label></section>
     <section class="ad-sec" style="--sc:#f59e0b"><h4>${esc(tr(["Zoekprofiel","Search profile"]))}</h4>
       <div class="ad-row">
         <label class="ad-f"><span>${esc(tr(["Budget","Budget"]))}</span>${optSel("data-sp","budget",SP_BUDGET,SP.budget)}</label>
         <label class="ad-f"><span>${esc(tr(["Woningtype","Property type"]))}</span>${optSel("data-sp","property_type",cats(),SP.property_type)}</label>
         <label class="ad-f"><span>${esc(tr(["Wanneer kopen","When to buy"]))}</span>${optSel("data-sp","period",SP_PERIOD,SP.period)}</label>
         <label class="ad-f"><span>${esc(tr(["Min. slaapkamers","Min. bedrooms"]))}</span><input data-sp="bedrooms_min" type="number" min="0" value="${esc(SP.bedrooms_min??"")}"></label>
         <label class="ad-f w2"><span>${esc(tr(["Gewenste gebieden","Preferred areas"]))}</span><input data-sp="areas" value="${esc(SP.areas??"")}" placeholder="${esc(tr(["bijv. Rojales, Ciudad Quesada","e.g. Rojales, Ciudad Quesada"]))}"></label>
         <label class="ad-f w2"><span>${esc(tr(["Must-haves","Must-haves"]))}</span><input data-sp="must_haves" value="${esc(SP.must_haves??"")}" placeholder="${esc(tr(["bijv. zwembad, zeezicht","e.g. pool, sea view"]))}"></label></div>
       <div class="ad-row">${[["resale",["Bestaande bouw","Resale"]],["new_build",["Nieuwbouw","New build"]]].map(b=>`<label class="ad-c"><input type="checkbox" data-spb="${b[0]}" ${(SP.build||[]).includes(b[0])?"checked":""}><span>${esc(tr(b[1]))}</span></label>`).join("")}</div></section>
     <section class="ad-sec" style="--sc:#a855f7"><h4>${esc(tr(["Mailings","Mailings"]))}</h4><div id="peMail">${mailRows()}</div></section>
     <section class="ad-sec" style="--sc:#64748b"><h4>${esc(tr(["Herkomst en verkoop","Origin and sales"]))}</h4>
       <div class="ad-row">
         <label class="ad-f"><span>${esc(tr(["Bron","Source"]))}</span><input data-cf="source" value="${esc(v.source??"")}"></label>
         <label class="ad-f"><span>${esc(tr(["Verkoopwaarde (€)","Sales value (€)"]))}</span><input data-cf="sales_value" type="number" min="0" step="1000" value="${esc(v.sales_value??"")}"></label>
         <label class="ad-c" style="align-self:center"><input type="checkbox" data-cf="keyholder" ${v.keyholder?"checked":""}><span>${esc(tr(["Sleutelhouder","Keyholder"]))}</span></label></div></section>
     <section class="ad-sec" style="--sc:#14b8a6"><h4>${esc(tr(["Online en vrije velden","Online and custom fields"]))}</h4>
       <div class="ad-row">${CEXTRA.map(cfIn).join("")}</div></section>
     <section class="ad-sec" style="--sc:#22c55e"><h4>${esc(tr(["E-mail en telefoon","E-mail and phone"]))}</h4>
       <div class="pe-chs" id="peEm">${chRows(EM,"em",EK,"naam@voorbeeld.com")}</div>
       <div class="pe-chs" id="pePh" style="margin-top:10px">${chRows(PH,"ph",PK,"+34 …")}</div>
       <small class="muted">${esc(tr(["★ = hoofdadres (gebruikt voor mailings en WhatsApp). Telefoon met landcode, bijv. +34 of +31.","★ = primary (used for mailings and WhatsApp). Phone with country code, e.g. +34 or +31."]))}</small></section>
     ${(C.team||[]).length?`<section class="ad-sec" style="--sc:#f97316"><h4>${esc(tr(["Verantwoordelijk","Responsible"]))}</h4><label class="ad-f" style="max-width:320px"><span>${esc(tr(["Teamlid","Team member"]))}</span><select data-cf="owner_id"><option value="">—</option>${C.team.map(t=>`<option value="${t.id}" ${o.owner_id===t.id?"selected":""}>${esc(t.name)}</option>`).join("")}</select></label></section>`:""}
     </div>
     <footer class="pe-ft">${X.me&&X.me()&&X.me().role==="admin"?`<button class="btn pe-del" data-act="cdelete" title="${esc(tr(["Contact definitief verwijderen (alleen beheerder)","Delete contact permanently (admin only)"]))}">🗑 ${esc(tr(["Verwijderen","Delete"]))}</button>`:""}<span class="sm muted" id="peDirty"></span><span style="flex:1"></span><button class="btn" data-act="cclose">${esc(tr(["Annuleren","Cancel"]))}</button>
       <button class="btn ad-next" data-act="csave" id="peSave">${esc(tr(["Opslaan","Save"]))}</button></footer></div>`;
    const diff=()=>{const d={};for(const k of CEDIT){if(!(k in v))continue;const a=v[k]===""?null:v[k],b=o[k]===""?null:o[k];if(String(a??"")!==String(b??""))d[k]=a}return d};
    const anyDirty=()=>Object.keys(diff()).length||rolesChanged()||chChanged()||spChanged()||msChanged()||ptChanged();
    const up=()=>{const n=Object.keys(diff()).length+(rolesChanged()?1:0)+(chChanged()?1:0)+(spChanged()?1:0)+(msChanged()?1:0)+(ptChanged()?1:0);ROOT.querySelector("#peDirty").textContent=n?tr([`${n} wijziging(en)`,`${n} change(s)`]):tr(["Geen wijzigingen","No changes"]);ROOT.querySelector("#peSave").disabled=!n};
    const wireMail=()=>{ROOT.querySelectorAll("#peMail [data-cf],[data-cf]").forEach(el=>el.oninput=el.onchange=()=>{v[el.dataset.cf]=el.type==="checkbox"?el.checked:el.value;
        if(el.dataset.cf==="mailing_optin"){if(!el.checked)CMAILS.forEach(([sl])=>MS[sl]=false);else if(!CMAILS.some(([sl])=>MS[sl]))CMAIL_DEF.forEach(sl=>MS[sl]=true);
          ROOT.querySelector("#peMail").innerHTML=mailRows();wireMail()}up()});
      ROOT.querySelectorAll("[data-ms]").forEach(el=>el.onchange=()=>{MS[el.dataset.ms]=el.checked;up()})};
    wireMail();
    ROOT.querySelectorAll("[data-sp]").forEach(el=>el.oninput=el.onchange=()=>{SP[el.dataset.sp]=el.value;up()});
    ROOT.querySelectorAll("[data-spb]").forEach(el=>el.onchange=()=>{const a=new Set(SP.build||[]);el.checked?a.add(el.dataset.spb):a.delete(el.dataset.spb);SP.build=[...a];up()});
    const wireCh=()=>{
      ROOT.querySelectorAll("[data-ch]").forEach(el=>el.oninput=el.onchange=()=>{const arr=el.dataset.ch==="em"?EM:PH, i=+el.dataset.i, f=el.dataset.f;
        if(f==="is_primary"){arr.forEach((x,j)=>x.is_primary=j===i)}else arr[i][f]=el.value;up()});
      ROOT.querySelectorAll("[data-chadd]").forEach(b=>b.onclick=()=>{const key=b.dataset.chadd, arr=key==="em"?EM:PH;
        arr.push(key==="em"?{email:"",kind:"",is_primary:!arr.length}:{phone:"",kind:"mobile",is_primary:!arr.length});redrawCh(key);
        const ins=ROOT.querySelectorAll(`[data-ch="${key}"][data-f="${key==="em"?"email":"phone"}"]`);if(ins.length)ins[ins.length-1].focus()});
      ROOT.querySelectorAll("[data-chdel]").forEach(b=>b.onclick=()=>{const key=b.dataset.chdel, arr=key==="em"?EM:PH, i=+b.dataset.i;const wasP=arr[i].is_primary;
        arr.splice(i,1);if(wasP&&arr.length)arr[0].is_primary=true;redrawCh(key);up()})};
    const redrawCh=key=>{ROOT.querySelector(key==="em"?"#peEm":"#pePh").innerHTML=key==="em"?chRows(EM,"em",EK,"naam@voorbeeld.com"):chRows(PH,"ph",PK,"+34 …");wireCh()};
    wireCh();
    let ptT;
    const wirePt=()=>{const B=ROOT.querySelector("#pePt");if(!B)return;
      B.querySelectorAll("[data-ptm]").forEach(b=>b.onclick=()=>{const m=b.dataset.ptm;if(m===PT.mode)return;
        if(HINT&&HINT.first_name_2){if(m==="new"&&PT.mode!=="new"&&v.first_name===o.first_name)applyHint(true);else if(m!=="new"&&PT.mode==="new")applyHint(false)}
        PT.mode=m;if(m!=="link")PT.pick=null;draw()});
      B.querySelectorAll("[data-pt]").forEach(el=>el.oninput=el.onchange=()=>{PT[el.dataset.pt]=el.value;up()});
      B.querySelectorAll("[data-ptun]").forEach(b=>b.onclick=()=>{const id=b.dataset.ptun;UNL.has(id)?UNL.delete(id):UNL.add(id);draw()});
      B.querySelectorAll("[data-ptgo]").forEach(b=>b.onclick=()=>{if(anyDirty()&&!confirm(tr(["Niet-opgeslagen wijzigingen. Toch naar de partner?","Unsaved changes. Go to the partner anyway?"])))return;closeC();location.hash="c/"+b.dataset.ptgo});
      const clr=B.querySelector("[data-ptclr]");if(clr)clr.onclick=()=>{PT.pick=null;PT.res=[];draw()};
      B.querySelectorAll("[data-ptpick]").forEach(b=>b.onclick=()=>{const c=PT.res[+b.dataset.ptpick];
        if(!c||c.id===o.id)return;PT.pick={id:c.id,name:c.name,sub:[c.email,c.phone,c.city].filter(Boolean).join(" · ")};draw()});
      const q=B.querySelector("#pePtQ");if(q)q.oninput=()=>{clearTimeout(ptT);ptT=setTimeout(async()=>{if(q.value.trim().length<2){PT.res=[];}
        else{try{PT.res=((await X.rpc("nexus_contact_pick",{p_q:q.value,p_role:null}))||[]).filter(c=>c.id&&c.id!==o.id)}catch(_){PT.res=[]}}
        const val=q.value;B.innerHTML=ptSec();wirePt();const q2=B.querySelector("#pePtQ");if(q2){q2.value=val;q2.focus()}
        if(!PT.res.length&&val.trim().length>=2)B.querySelector("#pePtRes").innerHTML=`<div class="empty sm">${esc(tr(["Niets gevonden","Nothing found"]))}</div>`},260)}};
    wirePt();
    const wireProp=()=>{const cb=ROOT.querySelector("#peMkProp");if(cb)cb.onchange=()=>{mkProp=cb.checked};
      const bt=ROOT.querySelector("#peMkPropBtn");if(bt)bt.onclick=()=>{closeC();goNewProp()}};
    ROOT.querySelectorAll("[data-role]").forEach(b=>b.onclick=()=>{const r=b.dataset.role;
      if(rs.has(r)){if(rs.size===1)return;rs.delete(r)}else rs.add(r);
      b.classList.toggle("on",rs.has(r));if(!isSell(rs))mkProp=false;
      ROOT.querySelector("#peProp").innerHTML=propOpt();wireProp();up()});
    wireProp();
    ROOT.querySelectorAll('[data-act="cclose"]').forEach(b=>b.onclick=()=>{if(anyDirty()&&!confirm(tr(["Niet-opgeslagen wijzigingen. Toch sluiten?","Unsaved changes. Close anyway?"])))return;ROOT.className="";ROOT.innerHTML="";document.body.classList.remove("pe-open")});
    const delB=ROOT.querySelector('[data-act="cdelete"]');
    if(delB)delB.onclick=async()=>{const nm=C.contact.full_name||C.contact.email||"dit contact";
      if(!confirm(tr([`Contact "${nm}" definitief verwijderen?\n\nE-mails, telefoons, labels, relaties en notities gaan mee; aanvragen en bezichtigingen blijven bestaan zonder contact. Er wordt een volledige kopie in het auditlog bewaard.`,
        `Permanently delete contact "${nm}"?\n\nE-mails, phones, labels, relations and notes go with it; requests and viewings remain without a contact. A full copy is kept in the audit log.`])))return;
      try{await X.rpc("nexus_contact_delete",{p_id:o.id});closeC();alert(tr(["Contact verwijderd","Contact deleted"]));location.hash="ct";location.reload()}
      catch(e){ROOT.querySelector("#peErr").innerHTML=`<div class="pe-errbox">${esc(e.message||String(e))}</div>`}};
    ROOT.querySelector('[data-act="csave"]').onclick=async()=>{const d=diff();if(spChanged())d.search_profile=spClean(SP);if(msChanged())d.mailing_prefs=Object.assign({},MS);if(!anyDirty())return;
      const badE=EM.map(x=>(x.email||"").trim()).filter(e=>e&&!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(e));
      if(PT.mode==="new"&&PT.email.trim()&&!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(PT.email.trim()))badE.push(PT.email.trim());
      if(badE.length){ROOT.querySelector("#peErr").innerHTML=`<div class="pe-errbox">${esc(tr(["Ongeldig e-mailadres: ","Invalid e-mail: "])+badE.join(", "))}</div>`;return}
      if(PT.mode==="new"&&HINT&&!ptOn()){ROOT.querySelector("#peErr").innerHTML=`<div class="pe-errbox">${esc(tr(["Vul de naam van de partner in, of kies ‘Geen partner’.","Enter the partner's name, or choose ‘No partner’."]))}</div>`;return}const b=ROOT.querySelector("#peSave");b.disabled=true;b.textContent=tr(["Opslaan…","Saving…"]);
      try{if(Object.keys(d).length)await X.rpc("nexus_contact_save",{p_id:o.id,p_patch:d});
        if(rolesChanged())await X.rpc("nexus_contact_roles_set",{p_id:o.id,p_roles:[...rs]});
        if(chChanged())await X.rpc("nexus_contact_channels_set",{p_id:o.id,p_emails:EM.filter(x=>(x.email||"").trim()),p_phones:PH.filter(x=>(x.phone||"").trim())});
        for(const id of UNL)await X.rpc("nexus_partner_unlink",{p_a:o.id,p_b:id});
        if(PT.mode==="new"&&ptOn()){const f=Object.fromEntries(Object.entries({title:PT.title,first_name:PT.first_name.trim(),last_name:PT.last_name.trim()}).filter(([,x])=>x));
          await X.rpc("nexus_partner_create",{p_main:o.id,p_fields:f,
            p_emails:PT.email.trim()?[{email:PT.email.trim().toLowerCase(),kind:PT.ekind||null,is_primary:true}]:[],
            p_phones:PT.phone.replace(/\D/g,"").length>=6?[{phone:PT.phone.trim(),kind:"mobile",is_primary:true}]:[]})}
        else if(PT.mode==="link"&&PT.pick)await X.rpc("nexus_partner_link",{p_a:o.id,p_b:PT.pick.id});
        const go=mkProp&&isSell(rs);closeC();toast(tr(["Opgeslagen","Saved"]));X.onSaved&&X.onSaved(o.id);if(go)goNewProp()}
      catch(e){b.disabled=false;b.textContent=tr(["Opslaan","Save"]);ROOT.querySelector("#peErr").innerHTML=`<div class="pe-errbox">${esc(e.message||String(e))}</div>`}};
    up();const sc2=ROOT.querySelector(".pe-main");if(sc2&&top)sc2.scrollTop=top};
  const closeC=()=>{ROOT.className="";ROOT.innerHTML="";document.body.classList.remove("pe-open")};
  const goNewProp=()=>{location.hash="ad";setTimeout(()=>{if(window.NEXUS_ADMIN&&NEXUS_ADMIN.startNewProperty)NEXUS_ADMIN.startNewProperty({id:o.id,wp_id:C.contact.wp_id||"",name:C.contact.full_name,email:C.contact.email,city:o.city,roles:[...rs].map(x=>x.replace("_","-"))})},0)};
  draw();
}
window.NEXUS_EDIT={open:(ref,ctx)=>{X=ctx;load(ref)},openContact,quickStatus,STATUS,statusOf,tr:v=>tr(v)};
})();
