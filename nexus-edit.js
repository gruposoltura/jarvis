/* NEXUS · woning bewerken. Schrijft naar core via nexus_property_save / nexus_property_media_* (team-gate + audit in de database).
   Commissies en verkoopdetails: alleen admin (database dwingt dit af; hier alleen-lezen/verborgen). */
(function(){
"use strict";
const esc=v=>v==null?"":String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let X=null;                               // {sb,rpc,lang,me,onSaved}
const tr=v=>Array.isArray(v)?(X&&X.lang()==="en"?v[1]:v[0]):v;
const L=()=>window.NEXUS_LISTS||{};

const STATUS=[["available",["Actief","Active"],"#22c55e"],["under_offer",["Onder bod / gereserveerd","Under offer / reserved"],"#ec4899"],["reserved",["Gereserveerd","Reserved"],"#f43f5e"],["sold",["Verkocht","Sold"],"#a855f7"],
  ["withdrawn",["Ingetrokken","Withdrawn"],"#64748b"],["draft",["Concept","Draft"],"#f59e0b"],["off_market",["Off-market","Off-market"],"#475569"]];
/* Besluit Rick 18-10: Gereserveerd = Onder bod. De database kent sinds 18-10 ook "reserved" (nieuwe site);
   die knop verschijnt alleen als een woning al op reserved staat. Zet SHOW_RESERVED op true om hem altijd te tonen. */
const SHOW_RESERVED=false;
const statusOf=s=>STATUS.find(x=>x[0]===s)||[s,[s,s],"#64748b"];
const LANGS=["nl","en","es","de","fr"];
const ADMIN_ONLY=["sold_price","sold_price_display","sold_date","deed_price","sold_agent_id","sold_agent_text","notary","notary_protocol","commission_a","commission_b","commission_out","conveyancing","commission_note"];
const FEED_FIELDS=["price","bedrooms","bathrooms","build_area","plot_area","energy_label","city","location_area","location_id","lat","lng","feature_options","build_type","category","province","country"];

let D=null, P=null, T=null, M=null, TOUCH={}, TTOUCH={}, MEDIA_DIRTY=false, txL="nl", ROOT=null, busy=false, MAP=null;

/* ---------- waarden ---------- */
const isNum=k=>/^(price|price_previous|bedrooms|bathrooms|toilets|ensuites|rooms|kitchens|living_rooms|floors|balconies|terraces|patios|garages|carports|build_area|plot_area|area_\w+|year_built|distance_\w+|fee_\w+|cost_\w+|lat|lng|sold_price|deed_price|commission_\w+|conveyancing|location_id)$/.test(k)&&k!=="commission_note";
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
   <input data-k="${k}" type="${o.type||"text"}" value="${esc(val)}" ${o.step?`step="${o.step}"`:""} ${o.min!=null?`min="${o.min}"`:""} ${o.ph?`placeholder="${esc(tr(o.ph))}"`:""} ${ro(k)||o.ro?"disabled":""}>${o.hint?`<small>${esc(tr(o.hint))}</small>`:""}</label>`}
function sel(k,label,opts,o={}){const v=P[k]==null?"":String(P[k]);const has=opts.some(x=>String(x[0])===v);
  return `<label class="ad-f ${o.w?"w"+o.w:""}"><span>${esc(tr(label))}${feedMark(k)}${ro(k)?" 🔒":""}</span><select data-k="${k}" ${ro(k)?"disabled":""}>
   ${o.empty!==false?`<option value="">—</option>`:""}${!has&&v?`<option value="${esc(v)}" selected>${esc(v)} ${esc(tr(["(huidig)","(current)"]))}</option>`:""}
   ${opts.map(x=>`<option value="${esc(x[0])}" ${String(x[0])===v?"selected":""}>${esc(tr(x[1]))}</option>`).join("")}</select>${o.hint?`<small>${esc(tr(o.hint))}</small>`:""}</label>`}
function chk(k,label){return `<label class="ad-c"><input type="checkbox" data-k="${k}" data-bool ${P[k]?"checked":""} ${ro(k)?"disabled":""}><span>${esc(tr(label))}${feedMark(k)}</span></label>`}
function multi(k,opts,o={}){const arr=o.csv?String(P[k]||"").split(/\s*,\s*/).filter(Boolean):(o.path?((P[k]||{})[o.path]||[]):(P[k]||[]));
  const extra=arr.filter(a=>!opts.some(x=>(Array.isArray(x)?x[0]:x)===a));
  return `<div class="ad-multi ${o.cols?"c"+o.cols:""}">${opts.concat(extra.map(e=>[e,e])).map(x=>{const val=Array.isArray(x)?x[0]:x, lab=Array.isArray(x)?x[1]:x;
    return `<label class="ad-c"><input type="checkbox" data-k="${k}" data-arr="${esc(val)}" ${o.csv?"data-csv":""} ${o.path?`data-path="${o.path}"`:""} ${arr.includes(val)?"checked":""}><span>${esc(tr(lab))}</span></label>`}).join("")}</div>`}
const sec=(id,title,body,o={})=>`<section class="ad-sec" id="pe-${id}"><h4>${esc(tr(title))}${o.aside||""}</h4>${body}</section>`;
const row=(...c)=>`<div class="ad-row">${c.join("")}</div>`;

/* ---------- opbouw ---------- */
const NAV=[["status",["Status & verkoop","Status & sale"]],["basis",["Basis","Basics"]],["prijs",["Prijs","Price"]],["loc",["Locatie","Location"]],["ind",["Indeling","Layout"]],
  ["ken",["Kenmerken","Features"]],["tekst",["Teksten","Texts"]],["media",["Foto's","Photos"]],["kost",["Kosten & kadaster","Costs & registry"]],["con",["Contacten","Contacts"]],
  ["pub",["Publicatie","Publishing"]],["hist",["Historie","History"]]];
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
       ${p.origin==="partner"?`<div class="ad-warnbox"><b>${esc(tr(["Partnerwoning: let op","Partner listing: note"]))}</b><span class="sm">${esc(tr(["Velden met ⟳ (prijs, kamers, oppervlakte, locatie, beschrijving en foto's) worden elke nacht om 01:15 door de partnerfeed overschreven. Status (onder bod / verkocht), koppelingen en kop blijven staan.","Fields marked ⟳ (price, rooms, areas, location, description and photos) are overwritten nightly at 01:15 by the partner feed. Status (under offer / sold), links and heading are kept."]))}</span></div>`:""}
       <div id="peErr"></div>
       ${secStatus()}${secBasis()}${secPrice()}${secLoc()}${secLayout()}${secFeatures()}${secTexts()}${secMedia()}${secCosts()}${secContacts()}${secPub()}${secHist()}
     </div></div>
   <footer class="pe-ft"><span class="sm muted" id="peDirty"></span><span style="flex:1"></span>
     <button class="btn" data-act="close">${esc(tr(["Annuleren","Cancel"]))}</button>
     <button class="btn ad-next" data-act="save" id="peSave">${esc(tr(["Opslaan","Save"]))}</button></footer></div>`;
  ROOT.querySelector("#peMain").scrollTop=sc;
  upDirty();initMap();wireMedia();
}
function upDirty(){const n=dirtyCount(), el=ROOT.querySelector("#peDirty"), b=ROOT.querySelector("#peSave");
  if(el)el.textContent=n?tr([`${n} wijziging(en) niet opgeslagen`,`${n} unsaved change(s)`]):tr(["Geen wijzigingen","No changes"]);
  if(b)b.disabled=!n||busy}

function secStatus(){const p=P;
  const seg=`<div class="pe-seg">${STATUS.filter(s=>s[0]!=="reserved"||SHOW_RESERVED||p.status==="reserved").map(s=>`<button data-status="${s[0]}" class="${p.status===s[0]?"on":""}" style="--sc:${s[2]}">${esc(tr(s[1]))}</button>`).join("")}</div>`;
  return sec("status",["Status & verkoop","Status & sale"],seg
    +row(chk("published",["Gepubliceerd op de website","Published on website"]),chk("dossier_complete",["Dossier compleet","Dossier complete"])).replace('class="ad-row"','class="ad-row pe-chkrow"')
    +row(inp("listed_at",["In aanbod sinds","Listed since"],{type:"date"}),inp("under_offer_at",["Onder bod sinds","Under offer since"],{type:"date"}),(p.status==="reserved"||p.reserved_at)?inp("reserved_at",["Gereserveerd sinds","Reserved since"],{type:"date"}):"",inp("sold_at",["Verkocht op (status)","Sold on (status)"],{type:"date"}),inp("withdrawn_at",["Ingetrokken op","Withdrawn on"],{type:"date"}))
    +`<h5>${esc(tr(["Verkoop","Sale"]))}${D.is_admin?"":` <span class="sm muted">🔒 ${esc(tr(["alleen beheerder","admin only"]))}</span>`}</h5>`
    +row(inp("sold_price",["Verkoopprijs (€)","Sold price (€)"],{type:"number",min:0,step:1000}),inp("sold_date",["Verkoopdatum","Sale date"],{type:"date"}),
         sel("sold_agent_id",["Verkocht door","Sold by"],D.team.map(t=>[t.id,t.name])),inp("sold_agent_text",["Verkocht door (vrij)","Sold by (free text)"]))
    +row(inp("notary",["Notaris","Notary"],{w:2}),inp("notary_protocol",["Protocolnummer","Protocol number"]),D.is_admin?inp("deed_price",["Aktewaarde (€)","Deed value (€)"],{type:"number",min:0,step:1000}):"")
    +chk("sold_price_display",["Verkoopprijs tonen op de site","Display sold price"])
    +(D.is_admin?`<h5>${esc(tr(["Commissie","Commission"]))}</h5>`+row(inp("commission_a",["Commissie A (€)","Commission A (€)"],{type:"number",step:"any"}),inp("commission_b",["Commissie B (€)","Commission B (€)"],{type:"number",step:"any"}),
         inp("commission_out",["Commissie uit (€)","Commission out (€)"],{type:"number",step:"any"}),inp("conveyancing",["Conveyancing (€)","Conveyancing (€)"],{type:"number",step:"any"}))
       +row(inp("commission_note",["Notitie commissie","Commission note"],{w:4})):""))}
function secBasis(){const l=L();
  return sec("basis",["Basis","Basics"],row(sel("category",["Woningtype","Property type"],l.CATS||[]),sel("build_type",["Bouw","Build"],[["resale",["Bestaande bouw","Resale"]],["new_build",["Nieuwbouw","New build"]]]),
      sel("own_listing_type",["Soort opdracht","Mandate"],[["direct",["Direct","Direct"]],["indirect",["Indirect","Indirect"]]]),sel("listing_agent_id",["Verantwoordelijk","Responsible"],D.team.map(t=>[t.id,t.name])))
    +row(inp("reference",["Referentie","Reference"],{ro:true,hint:["Vast: wordt gebruikt in links en feeds","Fixed: used in links and feeds"]}),inp("year_built",["Bouwjaar","Year built"],{type:"number",min:1800}),inp("object_style",["Stijl","Style"]),
      P.origin==="partner"?inp("external_ref",["Partnerreferentie","Partner reference"],{ro:true}):""))}
function secPrice(){const h=D.price_history||[];
  return sec("prijs",["Prijs","Price"],row(inp("price",["Vraagprijs (€)","Asking price (€)"],{type:"number",min:0,step:1000}),inp("price_previous",["Vorige prijs (€)","Previous price (€)"],{type:"number",min:0,step:1000,hint:["Wordt automatisch gevuld bij een prijswijziging","Filled automatically when the price changes"]}))
    +`<div class="ad-multi c4">${chk("price_hidden",["Prijs verbergen","Hide price"])}${chk("price_fixed",["Vaste prijs","Price FIXED"])}${chk("price_from",["Prijs vanaf","Price FROM"])}${chk("price_on_request",["Prijs op aanvraag","Price ON REQUEST"])}</div>`
    +(h.length?`<div class="pe-hist">${h.map(x=>`<span>${new Date(x.at).toLocaleDateString("nl-NL")} · <b>€ ${Number(x.price).toLocaleString("nl-NL")}</b> <span class="muted">${esc(x.source||"")}</span></span>`).join("")}</div>`:""))}
function secLoc(){const l=L(), locs=D.locations||[], cur=locs.find(x=>x.id===Number(P.location_id));
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
    +`<h5>${esc(tr(["Afstanden (meter)","Distances (metres)"]))}</h5>`+row(inp("distance_sea_m",["Zee","Sea"],{type:"number",min:0}),inp("distance_airport_m",["Luchthaven","Airport"],{type:"number",min:0}),inp("distance_city_m",["Centrum","Centre"],{type:"number",min:0}),inp("distance_shops_m",["Winkels","Shops"],{type:"number",min:0})))}
function secLayout(){const l=L(), n=(k,lab)=>inp(k,lab,{type:"number",min:0});
  return sec("ind",["Indeling en oppervlaktes","Layout and areas"],`<div class="ad-cols3"><div><h5>${esc(tr(["Kamers","Rooms"]))}</h5>${n("bedrooms",["Slaapkamers","Bedrooms"])}${n("bathrooms",["Badkamers","Bathrooms"])}${n("toilets",["Toiletten","Toilets"])}${n("ensuites","En-suite")}${n("rooms",["Kamers totaal","Rooms total"])}${n("living_rooms",["Woonkamers","Living rooms"])}${n("kitchens",["Keukens","Kitchens"])}</div>
    <div><h5>${esc(tr(["Oppervlakte (m²)","Surface (m²)"]))}</h5>${n("build_area",["Bebouwd","Built"])}${n("plot_area",["Perceel","Plot"])}${n("area_living",["Woonoppervlak","Living"])}${n("area_terrace",["Terras","Terrace"])}${n("area_garden",["Tuin","Garden"])}${n("area_kitchen",["Keuken","Kitchen"])}
      ${sel("energy_label",["Energielabel","Energy label"],l.ENERGY||[])}</div>
    <div><h5>${esc(tr(["Overig","Other"]))}</h5>${n("floors",["Verdiepingen","Floors"])}${inp("floor_level",["Etage","Level"])}${n("balconies",["Balkons","Balconies"])}${n("terraces",["Terrassen","Terraces"])}${n("patios",["Patio's","Patios"])}${n("garages",["Garages","Garages"])}${n("carports","Carports")}</div></div>`)}
function secFeatures(){const l=L(), fo=P.feature_options||{}, known=Object.keys(l.OPT||{});
  const other=Object.keys(fo).filter(k=>!known.includes(k)&&(fo[k]||[]).length);
  return sec("ken",["Kenmerken","Features"],`<div class="ad-cols3"><div><h5>Indoor</h5>${multi("features",l.F_INDOOR||[])}</div><div><h5>Outdoor</h5>${multi("features",l.F_OUTDOOR||[])}</div><div><h5>${esc(tr(["Klimaat","Climate"]))}</h5>${multi("features",l.F_CLIMATE||[])}</div></div>
    ${Object.entries(l.OPT||{}).map(([k,[lab,vals]])=>`<details class="ad-det" ${(fo[k]||[]).length?"open":""}><summary>${esc(tr(lab))} <span class="sm muted">${(fo[k]||[]).length||""}</span></summary>${multi("feature_options",vals,{path:k,cols:k==="property"||k==="community"?4:3})}</details>`).join("")}
    ${other.map(k=>`<details class="ad-det"><summary>${esc(k)} <span class="sm muted">${fo[k].length} · ${esc(tr(["uit feed, alleen-lezen","from feed, read-only"]))}</span></summary><div class="ad-chips">${fo[k].map(v=>`<span class="tag">${esc(v)}</span>`).join("")}</div></details>`).join("")}`)}
function secTexts(){const t=T[txL]||{};
  const f=(k,lab,o={})=>o.area?`<label class="ad-f w4"><span>${esc(tr(lab))}</span><textarea data-tx="${txL}.${k}" rows="${o.rows||4}">${esc(t[k]||"")}</textarea>${o.hint?`<small>${esc(tr(o.hint))}</small>`:""}</label>`
    :`<label class="ad-f ${o.w?"w"+o.w:"w4"}"><span>${esc(tr(lab))}</span><input data-tx="${txL}.${k}" value="${esc(t[k]||"")}">${o.hint?`<small>${esc(tr(o.hint))}</small>`:""}</label>`;
  return sec("tekst",["Teksten","Texts"],`<div class="seg ad-seg sm">${LANGS.map(l=>`<button data-txl="${l}" class="${txL===l?"on":""}">${l.toUpperCase()}${(T[l]||{}).description?" ✓":""}</button>`).join("")}</div>
    ${row(f("heading",["Kop","Heading"]))}${row(f("description",["Omschrijving","Description"],{area:true,rows:9,hint:P.origin==="partner"?["⟳ Wordt elke nacht door de feed overschreven","⟳ Overwritten nightly by the feed"]:null}))}
    ${row(f("key_details",["Kernpunten / sleutels","Key details / keys"],{area:true,rows:3}))}
    ${row(f("seo_title",["SEO-titel","SEO title"],{w:2}),f("seo_keyword",["SEO-zoekwoord","SEO keyword"],{w:2}))}${row(f("seo_description",["SEO-omschrijving","SEO description"],{area:true,rows:2}))}`)}
function secMedia(){
  return sec("media",["Foto's en media","Photos and media"],`<div class="ad-drop" id="peDrop"><input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" hidden>
      <div><b>${esc(tr(["Sleep foto's hierheen of klik om te uploaden","Drop photos here or click to upload"]))}</b><div class="sm muted">${esc(tr(["JPG/PNG/WebP of PDF, max. 20 MB. Upload gebeurt bij Opslaan. Sleep om de volgorde te wijzigen; ★ = hoofdfoto.","JPG/PNG/WebP or PDF, max 20 MB. Uploaded on Save. Drag to reorder; ★ = main photo."]))}</div></div></div>
    <div class="ad-media" id="peMedia"></div>`,{aside:`<span class="sm muted">${M.filter(m=>!m.del).length}</span>`})}
function secCosts(){const n=(k,lab)=>inp(k,lab,{type:"number",min:0});
  return sec("kost",["Kosten en kadaster","Costs and registry"],`<div class="ad-cols3"><div><h5>${esc(tr(["Vaste lasten per jaar (€)","Running costs per year (€)"]))}</h5>${n("cost_community",["Gemeenschap","Community"])}${n("cost_ibi","IBI")}${n("cost_garbage",["Afval","Garbage"])}${n("cost_insurance",["Verzekering","Insurance"])}</div>
    <div><h5>${esc(tr(["Kosten koper (€)","Buyer costs (€)"]))}</h5>${n("fee_transfer_tax",["Overdrachtsbelasting","Transfer tax"])}${n("fee_notary",["Notaris","Notary"])}${n("fee_registry","Registro")}${n("fee_legal",["Advocaat","Legal"])}</div>
    <div><h5>${esc(tr(["Kadaster","Registry"]))}</h5>${inp("cadastral_ref",["Kadastrale referentie","Cadastral reference"])}${inp("finca_number",["Fincanummer","Finca number"])}</div></div>`)}
function secContacts(){const C=D.contacts||{};
  const box=(k,col,lab,role)=>{const c=C[k];const cur=P[col];
    return `<div class="ad-f w2"><span>${esc(tr(lab))}</span>${cur&&c&&c.id===cur?`<div class="ad-picked"><div class="ini" style="background:var(--c-ct)">${esc((c.name||"?")[0].toUpperCase())}</div><div style="min-width:0"><b>${esc(c.name||"—")}</b><div class="sm muted">${esc(c.email||"")}</div></div>
        <span>${c.wp_id?`<a class="btn sm" href="#c/${c.wp_id}" data-act="close">${esc(tr(["Open","Open"]))}</a>`:""}<button class="btn sm" data-unlink="${col}">${esc(tr(["Ontkoppelen","Unlink"]))}</button></span></div>`
      :cur?`<div class="ad-picked"><div style="min-width:0;grid-column:1/3"><b>${esc((PICKED[col]||{}).name||cur)}</b> <span class="tag">${esc(tr(["nieuw gekozen","newly picked"]))}</span></div><button class="btn sm" data-unlink="${col}">×</button></div>`:""}
      <input class="ad-search" data-pick="${col}" data-role="${role||""}" type="search" placeholder="${esc(tr(["Zoek op naam, e-mail of telefoon","Search by name, e-mail or phone"]))}"><div class="ad-res" data-res="${col}"></div></div>`};
  return sec("con",["Contacten","Contacts"],row(box("owner","owner_contact_id",["Eigenaar / verkoper","Owner / seller"]),box("buyer","buyer_contact_id",["Koper","Buyer"]))
    +row(box("agency","agency_contact_id",["Aanbiedend kantoor (partner)","Listing agency (partner)"],"agent")))}
function secPub(){
  return sec("pub",["Publicatie","Publishing"],`<h5>Labels</h5>`+multi("labels",[["new","NEW"],["exclusive","EXCLUSIVE"],["premium","PREMIUM"],["bargain","BARGAIN"],["featured",["Uitgelicht","Featured"]]],{cols:5})
    +`<h5>${esc(tr(["Exportfeeds","Export feeds"]))}</h5>`+multi("export_feeds",[["idealista","Idealista"]],{cols:4})+chk("no_export",["Uitsluiten van alle XML-feeds","Exclude from all XML feeds"])
    +row(inp("video_url",["Video-URL","Video URL"],{w:2,ph:"https://"}),inp("tour_360_url",["360°/3D-link","360°/3D link"],{w:2,ph:"https://"})))}
function secHist(){const a=D.audit||[];
  return sec("hist",["Historie","History"],a.length?`<div class="pe-audit">${a.map(x=>`<div><b>${new Date(x.at).toLocaleString("nl-NL",{day:"numeric",month:"short",year:"2-digit",hour:"2-digit",minute:"2-digit"})}</b> · ${esc(x.who||"?")} <span class="muted">· ${esc((x.fields||[]).join(", "))}</span></div>`).join("")}</div>`
    :`<div class="sm muted">${esc(tr(["Nog geen wijzigingen via NEXUS.","No changes via NEXUS yet."]))}</div>`)}

/* ---------- kaart ---------- */
function initMap(){const el=ROOT.querySelector("#peMap");if(!el||!window.L)return;if(MAP){MAP.remove();MAP=null}
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
  box.innerHTML=M.map((m,i)=>`<div class="ad-mi ${m.is_main&&!m.del?"main":""} ${m.del?"del":""}" draggable="true" data-i="${i}">
    <div class="im" style="${m.url&&!/\.pdf($|\?)/i.test(m.url)?`background-image:url('${esc(m.url)}')`:""}">${m.url&&!/\.pdf($|\?)/i.test(m.url)?"":"PDF"}${m.is_main&&!m.del?`<span>${esc(tr(["Hoofdfoto","Main"]))}</span>`:""}${m.file?`<span class="new">${esc(tr(["nieuw","new"]))}</span>`:""}</div>
    <select data-mk="${i}" ${m.del?"disabled":""}>${KIND.map(k=>`<option value="${k[0]}" ${m.kind===k[0]?"selected":""}>${esc(tr(k[1]))}</option>`).join("")}</select>
    <input data-mc="${i}" placeholder="${esc(tr(["Bijschrift","Caption"]))}" value="${esc(m.caption||"")}" ${m.del?"disabled":""}>
    <div class="ad-mibtn">${!m.is_main&&!m.del&&m.kind==="photo"?`<button data-mmain="${i}" title="${esc(tr(["Maak hoofdfoto","Make main"]))}">★</button>`:""}<button data-mdel="${i}" title="${esc(m.del?tr(["Terugzetten","Restore"]):tr(["Verwijderen","Delete"]))}">${m.del?"↺":"🗑"}</button></div></div>`).join("")
    ||`<div class="sm muted">${esc(tr(["Geen foto's.","No photos."]))}</div>`;
  const ch=()=>{MEDIA_DIRTY=true;upDirty()};
  box.querySelectorAll("[data-mk]").forEach(s=>s.onchange=()=>{M[+s.dataset.mk].kind=s.value;ch()});
  box.querySelectorAll("[data-mc]").forEach(s=>s.oninput=()=>{M[+s.dataset.mc].caption=s.value;ch()});
  box.querySelectorAll("[data-mdel]").forEach(b=>b.onclick=()=>{const m=M[+b.dataset.mdel];if(m.file){M.splice(+b.dataset.mdel,1)}else m.del=!m.del;
    if(m.del&&m.is_main){m.is_main=false;const nx=M.find(x=>!x.del&&x.kind==="photo");if(nx)nx.is_main=true}ch();wireMedia()});
  box.querySelectorAll("[data-mmain]").forEach(b=>b.onclick=()=>{M.forEach(x=>x.is_main=false);const m=M.splice(+b.dataset.mmain,1)[0];m.is_main=true;M.unshift(m);ch();wireMedia()});
  let from=null;box.querySelectorAll(".ad-mi").forEach(el=>{el.ondragstart=()=>{from=+el.dataset.i;el.classList.add("drag")};el.ondragend=()=>el.classList.remove("drag");
    el.ondragover=e=>e.preventDefault();el.ondrop=e=>{e.preventDefault();const to=+el.dataset.i;if(from==null||from===to)return;const m=M.splice(from,1)[0];M.splice(to,0,m);ch();wireMedia()}});
  if(drop&&!drop.dataset.w){drop.dataset.w=1;const f=drop.querySelector("input");drop.onclick=()=>f.click();
    drop.ondragover=e=>{e.preventDefault();drop.classList.add("over")};drop.ondragleave=()=>drop.classList.remove("over");
    drop.ondrop=e=>{e.preventDefault();drop.classList.remove("over");add(e.dataTransfer.files)};f.onchange=()=>{add(f.files);f.value=""}}
  function add(files){[...files].forEach(file=>{if(!/^image\/(jpeg|png|webp)$|^application\/pdf$/.test(file.type))return err(tr([`${file.name}: alleen JPG, PNG, WebP of PDF`,`${file.name}: JPG, PNG, WebP or PDF only`]));
    if(file.size>20*1048576)return err(tr([`${file.name} is groter dan 20 MB`,`${file.name} exceeds 20 MB`]));
    const hasMain=M.some(x=>x.is_main&&!x.del);
    M.push({file,url:file.type.startsWith("image/")?URL.createObjectURL(file):null,kind:file.type==="application/pdf"?"energy_certificate":/plan|plano/i.test(file.name)?"floorplan":"photo",caption:"",is_main:!hasMain&&file.type.startsWith("image/")})});
    ch();wireMedia()}
}

/* ---------- events ---------- */
let PICKED={};
function set(k,v){P[k]=v;TOUCH[k]=1;upDirty()}
function err(msg){const e=ROOT.querySelector("#peErr");if(!e)return;e.innerHTML=msg?`<div class="pe-errbox">${esc(msg)}</div>`:"";if(msg)e.scrollIntoView({block:"nearest"})}
function bind(){
  ROOT.addEventListener("input",e=>{const el=e.target;
    if(el.dataset.tx){const [l,f]=el.dataset.tx.split(".");(T[l]=T[l]||{})[f]=el.value;TTOUCH[el.dataset.tx]=1;upDirty();return}
    if(el.dataset.pick!=null){pickSearch(el);return}
    const k=el.dataset.k;if(!k)return;
    if(el.dataset.arr!=null){const v=el.dataset.arr;
      if(el.dataset.csv!=null){let a=String(P[k]||"").split(/\s*,\s*/).filter(Boolean);a=el.checked?[...new Set([...a,v])]:a.filter(x=>x!==v);set(k,a.join(",")||null)}
      else if(el.dataset.path){const o=JSON.parse(JSON.stringify(P[k]||{}));let a=o[el.dataset.path]||[];a=el.checked?[...new Set([...a,v])]:a.filter(x=>x!==v);
        if(a.length)o[el.dataset.path]=a;else delete o[el.dataset.path];set(k,o)}
      else{let a=[...(P[k]||[])];a=el.checked?[...new Set([...a,v])]:a.filter(x=>x!==v);set(k,a)}return}
    if(el.dataset.bool!=null){set(k,el.checked);return}
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
    if(d.jump){e.preventDefault();const s=ROOT.querySelector("#pe-"+d.jump);if(s)s.scrollIntoView({behavior:"smooth",block:"start"});return}
    if(d.status){e.preventDefault();set("status",d.status);render(true);return}
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
  try{D=await X.rpc("nexus_property_edit",{p_ref:ref})}catch(e){ROOT.querySelector(".pe-box").innerHTML=`<div class="pe-load">${esc(e.message)} <button class="btn" data-act="close">×</button></div>`;return}
  if(!D){ROOT.querySelector(".pe-box").innerHTML=`<div class="pe-load">${esc(tr(["Woning niet gevonden","Property not found"]))} <button class="btn" data-act="close">×</button></div>`;return}
  P=JSON.parse(JSON.stringify(D.property));T=JSON.parse(JSON.stringify(D.texts||{}));M=JSON.parse(JSON.stringify(D.media||[]));
  render();
  if(X.jump)setTimeout(()=>{const s=ROOT.querySelector("#pe-"+X.jump);if(s)s.scrollIntoView({block:"start"})},60);
}
function close(){if(dirtyCount()&&!confirm(tr(["Er zijn niet-opgeslagen wijzigingen. Toch sluiten?","There are unsaved changes. Close anyway?"])))return;
  M&&M.forEach(m=>m.file&&m.url&&URL.revokeObjectURL(m.url));if(MAP){MAP.remove();MAP=null}
  ROOT.className="";ROOT.innerHTML="";document.body.classList.remove("pe-open")}
async function save(){
  if(busy)return;const pt=patch(), tt=tpatch();
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
    P=JSON.parse(JSON.stringify(D.property));T=JSON.parse(JSON.stringify(D.texts||{}));M=JSON.parse(JSON.stringify(D.media||[]));
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

window.NEXUS_EDIT={open:(ref,ctx)=>{X=ctx;load(ref)},quickStatus,STATUS,statusOf,tr:v=>tr(v)};
})();
