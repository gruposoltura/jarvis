/* 25-10-2026 (Rick): derde zwembadkeuze "Zwembad (zie opmerking)" = feature pool_unspecified: er is een zwembad, maar privé of
   gemeenschappelijk is niet bekend. Opmerking (type, gedeeld met ...) in core.properties.pool_note. Teksten claimen dan nooit privé.
   NEXUS · kenmerken van een woning (nieuwe indeling, akkoord Rick 19-10-2026).
   Eén begrip op één plek, in 8 panelen. Opslag blijft ongewijzigd: core.properties.features (text[]) en feature_options (jsonb {groep:[waarden]}),
   zodat de website, Idealista en de partnerfeeds dezelfde waarden blijven krijgen. Een keuze ("radio") zet precies één set waarden en wist de andere.
   Gebruikt door nexus-admin.js (invoer) en nexus-edit.js (bewerken). Waarden die niet meer in de lijst staan, blijven zichtbaar onder "Uit de oude lijst"
   en kunnen daar worden uitgevinkt. */
(function(){
"use strict";
const esc=v=>v==null?"":String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const F=k=>"f:"+k, O=(g,v)=>"o:"+g+":"+v;
const c=(id,nl,en,keys)=>({t:"chip",id,label:[nl,en],keys:Array.isArray(keys)?keys:[keys]});
const opt=(v,nl,en,keys)=>({v,label:[nl,en],keys:keys||[]});
const r=(id,nl,en,options)=>({t:"radio",id,label:[nl,en],options});

/* panelen; kleur = achtergrondtint van het paneel */
const PANELS=[
 {id:"pool",title:["Zwembad","Pool"],color:"#0ea5e9",items:[
   r("pool","Zwembad","Pool",[opt("none","Geen","None"),opt("private","Privé","Private",[F("pool")]),opt("communal","Gemeenschappelijk","Communal",[F("communal_pool")]),opt("unspecified","Zwembad (overig)","Pool (other)",[F("pool_unspecified")])]),
   c("pool_heated","Verwarmd","Heated",O("pool","heated")),c("pool_salted","Zoutwater","Salt water",O("pool","salted")),c("pool_covered","Overdekt","Covered",O("pool","covered")),
   c("pool_infinity","Infinity","Infinity",O("pool","infinity")),c("pool_counter","Tegenstroominstallatie","Counter-current system",O("pool","countercurrent swimming system"))]},
 {id:"outdoor",title:["Buiten","Outdoor"],color:"#22c55e",items:[
   r("garden","Tuin","Garden",[opt("none","Geen tuin","No garden",[O("garden","no")]),opt("own","Eigen tuin","Private garden",[O("property","garden")]),opt("communal","Gemeenschappelijke tuin","Communal garden",[O("garden","community")])]),
   c("g_water","Bewatering","Irrigation",O("garden","watersystem")),c("g_palms","Palmen","Palms",O("garden","palms")),c("g_fruit","Fruitbomen","Fruit trees",O("garden","fruit trees")),c("g_exotic","Exotische planten","Exotic plants",O("garden","exotic plants")),
   c("t_open","Terras open","Open terrace",O("terrace","open")),c("t_covered","Terras overdekt","Covered terrace",O("terrace","covered")),c("t_glazed","Terras ingeglaasd","Glazed terrace",O("terrace","glazed")),
   c("solarium","Solarium","Solarium",F("solarium")),c("roof_terrace","Dakterras","Roof terrace",O("property","roof terrace")),
   c("outside_kitchen","Buitenkeuken / BBQ","Outdoor kitchen / BBQ",O("property","outside kitchen")),c("outside_shower","Buitendouche","Outdoor shower",O("property","outside shower")),
   c("outside_jacuzzi","Buitenjacuzzi","Outdoor jacuzzi",O("property","outside jacuzzi")),c("fenced","Volledig omheind","Fully fenced",F("fully_fenced"))]},
 {id:"climate",title:["Klimaat en energie","Climate and energy"],color:"#f59e0b",items:[
   r("cooling","Koelen","Cooling",[opt("none","Geen airco","No air conditioning"),
     opt("split","Split-units","Split units",[F("air_conditioning"),F("split_aircon"),O("aircon","split unit")]),
     opt("ducted","Kanalen (ducted)","Ducted",[F("air_conditioning"),F("ducted_cooling"),O("aircon","conductor")]),
     opt("pre","Voorbereid","Pre-installed",[F("air_conditioning_preinstalled"),O("aircon","pre-installed")])]),
   {t:"sub",label:["Verwarmen","Heating"]},
   c("h_airco","Via airco (warmtepomp)","Via air con (heat pump)",F("split_heating")),c("h_floor","Vloerverwarming","Underfloor heating",F("underfloor_heating")),
   c("h_radiant","Stralingspanelen","Radiant panels",[F("radiant_panels"),O("heating","radiant panels")]),c("h_cv","Radiatoren / cv","Radiators / central heating",F("central_heating")),
   c("h_electric","Elektrisch","Electric",O("heating","electric")),c("h_gas","Gas","Gas",F("gas_heating")),
   c("h_wood","Open haard (hout)","Wood fireplace",[F("fireplace"),O("heating","wood fireplace")]),c("h_gasfire","Gashaard","Gas fireplace",O("heating","gas fireplace")),c("h_pellet","Pelletkachel","Pellet stove",O("heating","pellet stove")),
   {t:"sub",label:["Energie","Energy"]},
   c("solar_panels","Zonnepanelen","Solar panels",O("property","solar panels")),c("solar_boiler","Zonneboiler","Solar water heater",O("property","solar water heater")),
   c("double_glass","Dubbel glas","Double glazing",O("property","double glass windows"))]},
 {id:"parking",title:["Parkeren","Parking"],color:"#64748b",hint:["Aantallen garage, carport en open plekken staan bij Indeling.","Numbers of garages, carports and open spaces are under Layout."],items:[
   c("private_parking","Eigen parkeerplaats op terrein","Private parking on plot",O("property","private parking")),c("secure_parking","Afgesloten parkeerplaats","Secure parking",F("secure_parking")),
   c("electric_gate","Elektrisch hek","Electric gate",O("property","electric gate")),c("remote_garage","Garagedeur met afstandsbediening","Remote garage door",F("remote_garage")),
   c("ev_charger","Laadpaal","EV charger",O("property","ev charger"))]},
 {id:"interior",title:["Inrichting en staat","Interior and condition"],color:"#a855f7",items:[
   r("furnished","Gemeubileerd","Furnished",[opt("no","Nee","No"),opt("semi","Deels","Partly",[F("semi_furnished")]),opt("full","Volledig","Fully",[F("furnished")])]),
   r("condition","Staat","Condition",[opt("unknown","Niet vermeld","Not stated"),opt("asnew","Als nieuw","As new",[O("property","as new")]),opt("reformed","Gerenoveerd","Renovated",[O("property","reformed")]),opt("reform","Renovatie nodig","Needs renovation",[O("property","reform needed")])]),
   {t:"sub",label:["Keuken","Kitchen"]},
   c("k_open","Open","Open",O("kitchen","open")),c("k_closed","Gesloten","Closed",O("kitchen","closed")),c("k_american","Amerikaanse keuken","American kitchen",O("kitchen","american")),
   c("k_island","Kookeiland","Island",O("kitchen","island")),c("k_equipped","Volledig ingericht","Fully equipped",O("kitchen","fully equipped")),
   {t:"sub",label:["Vloer","Floor"]},
   c("fl_tiled","Tegels","Tiles",O("floor","tiled")),c("fl_porcelain","Porseleintegels","Porcelain tiles",O("floor","porcelain stoneware")),c("fl_marble","Marmer","Marble",O("floor","marble")),
   c("fl_gres","Gres","Gres",O("floor","gres")),c("fl_wood","Hout","Wood",O("floor","wood")),c("fl_laminate","Laminaat","Laminate",O("floor","laminate")),
   {t:"sub",label:["Uitrusting","Fittings"]},
   c("wardrobes","Inbouwkasten","Built-in wardrobes",O("property","built-in wardrobes")),c("white_goods","Witgoed","White goods",O("property","white goods")),c("dishwasher","Vaatwasser","Dishwasher",O("property","dishwasher")),
   c("ceiling_fan","Plafondventilatoren","Ceiling fans",O("property","ceiling fan")),c("mosquito","Horren","Mosquito screens",O("property","mosquito nets")),c("blinds","Elektrische rolluiken","Electric shutters",O("property","electric blinds"))]},
 {id:"rooms",title:["Extra ruimtes","Extra rooms"],color:"#14b8a6",hint:["Aantallen kamers staan bij Indeling.","Room counts are under Layout."],items:[
   c("study","Studeerkamer / kantoor","Study / office",F("study")),c("basement","Kelder","Basement",F("basement")),c("storage","Berging","Storage room",[O("property","storage room")]),
   c("laundry","Wasruimte","Laundry room",O("property","laundry room")),c("walkin","Inloopkast","Walk-in closet",O("property","walk-in closet")),
   c("guest","Gastenverblijf","Guest apartment",O("property","guesthouse apartment")),c("workshop","Werkplaats","Workshop",F("workshop")),
   c("single_level","Gelijkvloers wonen","Single-level living",O("property","single level")),
   c("sauna","Sauna","Sauna",O("property","sauna")),c("jacuzzi","Jacuzzi binnen","Indoor jacuzzi",O("property","jacuzzi")),c("gym","Fitnessruimte","Gym",O("property","gym")),
   c("wine","Wijnkelder","Wine cellar",O("property","wine cellar")),c("cinema","Thuisbioscoop","Home cinema",O("property","home-cinema"))]},
 {id:"tech",title:["Veiligheid en techniek","Security and technical"],color:"#ef4444",items:[
   c("alarm","Alarm","Alarm",[O("property","alarm")]),c("cctv","Camerabewaking","Video surveillance",O("property","video surveillance")),c("armored","Veiligheidsdeur","Security door",O("property","armored door")),
   c("intercom","Intercom","Intercom",F("intercom")),c("domotic","Domotica","Home automation",O("property","domotic system")),c("internet","Internet / glasvezel","Internet / fibre",O("property","internet connection")),
   c("satellite","Satelliet-tv","Satellite TV",O("property","tv satellite")),c("softener","Waterontharder","Water softener",O("property","softener limescale")),c("osmosis","Osmosefilter","Osmosis filter",O("property","osmosis")),
   c("elevator","Lift","Lift",O("property","elevator")),c("disabled","Rolstoeltoegankelijk","Wheelchair accessible",O("property","disabled access")),
   c("vt","Toeristische verhuurlicentie (VT)","Tourist rental licence (VT)",O("property","tourist licence"))]},
 {id:"complex",title:["Complex","Complex"],color:"#3b82f6",hint:["Alleen invullen bij een appartement of woning in een complex.","Only for an apartment or a home in a complex."],items:[
   c("closed","Afgesloten complex","Gated community",O("community","closed community")),c("concierge","Conciërge","Concierge",O("community","concierge")),c("security24","24-uursbewaking","24h security",O("community","24h security")),
   c("c_gardens","Gemeenschappelijke tuinen","Communal gardens",O("community","gardens")),c("c_gym","Fitness","Gym",O("community","gym")),c("c_padel","Padelbaan","Padel court",O("community","paddle court")),
   c("c_tennis","Tennisbaan","Tennis court",O("community","tennis court")),c("c_parking","Parkeergarage","Parking garage",O("community","parking"))]}
];
const COMPLEX_CATS=["apartment","penthouse","duplex","studio"];
const ALL_KEYS=new Set();PANELS.forEach(p=>p.items.forEach(i=>{if(i.t==="chip")i.keys.forEach(k=>ALL_KEYS.add(k));if(i.t==="radio")i.options.forEach(o=>o.keys.forEach(k=>ALL_KEYS.add(k)))}));
/* oude waarden die als gelijkwaardig gelden (bijv. Zwembad → community = gemeenschappelijk zwembad) */
const ALIAS={[O("pool","community")]:F("communal_pool"),[O("pool","private")]:F("pool"),[O("community","swimming pool")]:F("communal_pool")};

/* model = {get:()=>({features,opts}), set:(features,opts)=>void} */
function keysOf(m){const {features,opts}=m.get();const s=new Set();(features||[]).forEach(f=>s.add(F(f)));
  Object.entries(opts||{}).forEach(([g,a])=>(Array.isArray(a)?a:[]).forEach(v=>s.add(O(g,v))));
  Object.entries(ALIAS).forEach(([a,b])=>{if(s.has(a))s.add(b)});return s}
function write(m,s){const features=[], opts={};
  s.forEach(k=>{if(k.startsWith("f:"))features.push(k.slice(2));else{const i=k.indexOf(":",2);const g=k.slice(2,i), v=k.slice(i+1);(opts[g]=opts[g]||[]).push(v)}});
  m.set(features,opts)}
function radioVal(it,s){for(const o of it.options)if(o.keys.length&&o.keys.every(k=>s.has(k)))return o.v;
  for(const o of it.options)if(o.keys.length&&o.keys.some(k=>s.has(k)))return o.v;return it.options[0].v}

function html(m,ctx){const tr=ctx.tr, s=keysOf(m), cat=ctx.category||"";
  const legacy=[...s].filter(k=>!ALL_KEYS.has(k)&&!ALIAS[k]);
  const panel=p=>{const n=p.items.filter(i=>i.t==="chip"&&i.keys.every(k=>s.has(k))).length+p.items.filter(i=>i.t==="radio"&&radioVal(i,s)!==i.options[0].v).length;
    const open=p.id!=="complex"||COMPLEX_CATS.includes(cat)||n>0;
    return `<details class="fx-panel" style="--fx:${p.color}" ${open?"open":""}><summary><b>${esc(tr(p.title))}</b><span class="fx-n">${n||""}</span></summary>
      ${p.hint?`<div class="fx-hint">${esc(tr(p.hint))}</div>`:""}<div class="fx-body">${p.items.map(i=>{
        if(i.t==="sub")return `<div class="fx-sub">${esc(tr(i.label))}</div>`;
        if(i.t==="radio"){const cur=radioVal(i,s);return `<div class="fx-radio"><span>${esc(tr(i.label))}</span><div class="fx-seg">${i.options.map(o=>`<button type="button" class="${o.v===cur?"on":""}" data-fxr="${i.id}" data-fxv="${o.v}">${esc(tr(o.label))}</button>`).join("")}</div></div>`}
        const on=i.keys.every(k=>s.has(k));return `<label class="fx-chip ${on?"on":""}"><input type="checkbox" data-fxc="${i.id}" ${on?"checked":""}>${esc(tr(i.label))}</label>`}).join("")}</div></details>`};
  return `<div class="fx">${PANELS.map(panel).join("")}
    ${legacy.length?`<details class="fx-panel fx-legacy" style="--fx:#94a3b8"><summary><b>${esc(tr(["Uit de oude lijst","From the old list"]))}</b><span class="fx-n">${legacy.length}</span></summary>
      <div class="fx-hint">${esc(tr(["Deze waarden staan niet meer in de nieuwe indeling. Ze blijven bewaard tot je ze uitvinkt.","These values are no longer in the new layout. They are kept until you untick them."]))}</div>
      <div class="fx-body">${legacy.map(k=>`<label class="fx-chip on"><input type="checkbox" data-fxl="${esc(k)}" checked>${esc(k.replace(/^f:/,"").replace(/^o:/,"").replace(":"," · ").replace(/_/g," "))}</label>`).join("")}</div></details>`:""}</div>`}

/* verwerkt een klik/vinkje; true = model gewijzigd (caller tekent opnieuw en bewaart) */
function handle(el,m){const d=el.dataset||{};const s=keysOf(m);
  if(d.fxc){const it=PANELS.flatMap(p=>p.items).find(i=>i.id===d.fxc);if(!it)return false;
    if(el.checked)it.keys.forEach(k=>s.add(k));else{it.keys.forEach(k=>s.delete(k));Object.entries(ALIAS).forEach(([a,b])=>{if(it.keys.includes(b))s.delete(a)})}
    write(m,s);return true}
  if(d.fxr){const it=PANELS.flatMap(p=>p.items).find(i=>i.id===d.fxr);if(!it)return false;
    it.options.forEach(o=>o.keys.forEach(k=>{s.delete(k);Object.entries(ALIAS).forEach(([a,b])=>{if(b===k)s.delete(a)})}));
    const o=it.options.find(x=>x.v===d.fxv);if(o)o.keys.forEach(k=>s.add(k));write(m,s);return true}
  if(d.fxl){if(!el.checked){s.delete(d.fxl);write(m,s);return true}return false}
  return false}
/* alleen-lezen weergave voor het woningdetail: dezelfde 8 panelen en volgorde als bij invoer, alleen wat aan staat.
   Panelen zonder keuze komen samen op één regel "Niet ingevuld". Zwembad toont altijd de keuze (ook "Geen"). */
function view(features,opts,ctx){const tr=ctx.tr, m={get:()=>({features:features||[],opts:opts||{}})}, s=keysOf(m);
  const legacy=[...s].filter(k=>!ALL_KEYS.has(k)&&!ALIAS[k]&&k!==O("feed",k.slice(7)));
  const empty=[];
  const out=PANELS.map(p=>{let sub=null;const parts=[];
    p.items.forEach(i=>{
      if(i.t==="sub"){sub=i;return}
      if(i.t==="radio"){const v=radioVal(i,s), o=i.options.find(x=>x.v===v);
        if(v===i.options[0].v&&p.id!=="pool")return;
        parts.push(`<div class="fx-vr"><span>${esc(tr(i.label))}</span><b class="${v===i.options[0].v?"muted":""}">${esc(tr(o.label))}</b></div>`);return}
      if(i.keys.every(k=>s.has(k))){if(sub){parts.push(`<div class="fx-sub">${esc(tr(sub.label))}</div>`);sub=null}
        parts.push(`<span class="fx-chip on ro">${esc(tr(i.label))}</span>`)}});
    const real=parts.some(x=>!/class="muted"/.test(x));
    if(!parts.length||(!real&&p.id!=="pool")){empty.push(tr(p.title));return ""}
    return `<div class="fx-panel fx-ro" style="--fx:${p.color}"><div class="fx-h"><b>${esc(tr(p.title))}</b></div><div class="fx-body">${parts.join("")}</div></div>`}).join("");
  return `<div class="fx fx-view">${out}${legacy.length?`<div class="fx-panel fx-ro fx-legacy" style="--fx:#94a3b8"><div class="fx-h"><b>${esc(tr(["Uit de oude lijst","From the old list"]))}</b></div><div class="fx-body">${legacy.map(k=>`<span class="fx-chip on ro">${esc(k.replace(/^f:/,"").replace(/^o:/,"").replace(":"," · ").replace(/_/g," "))}</span>`).join("")}</div></div>`:""}</div>
    ${empty.length?`<div class="fx-empty sm muted">${esc(tr(["Niet ingevuld: ","Not filled in: "]))}${esc(empty.join(" · "))}</div>`:""}`}
window.NEXUS_FEAT={html,handle,view,PANELS};
})();
