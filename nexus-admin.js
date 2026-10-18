/* NEXUS · Admin — invoerschermen (contact → aanbrenger → woning → koppelen).
   STATUS: alleen frontend. Er wordt NIETS opgeslagen in Supabase of WordPress; de knop "Opslaan" staat uit
   tot Rick akkoord geeft op de koppeling met het core-schema. Opzoeken (dubbelen, makelaars, woningen) gebeurt
   alleen-lezen via de bestaande nexus_* RPC's. Concepten blijven in deze browser (localStorage), foto's niet. */
(function(){
"use strict";
window.NEXUS_I18N=window.NEXUS_I18N||{nl:{},en:{}};
Object.assign(window.NEXUS_I18N.nl,{"tab.ad":"Admin"});
Object.assign(window.NEXUS_I18N.en,{"tab.ad":"Admin"});

let X=null;                // context uit nexus-app.js: {rpc,t,lang,me,esc}
let ROOT=null;
const tr=v=>Array.isArray(v)?(X&&X.lang()==="en"?v[1]:v[0]):v;
const esc=v=>v==null?"":String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const DRAFT_KEY="nexus-admin-draft-v1";

/* ================= REFERENTIELIJSTEN ================= */
const TEAM=[{wp:2,name:"Rick",email:"rick@gruposoltura.com",c:"#f97316"},{wp:3,name:"Marco",email:"marco@gruposoltura.com",c:"#3b82f6"},
  {wp:4,name:"Ingrid",email:"ingrid@gruposoltura.com",c:"#a855f7"},{wp:6,name:"Lisette",email:"lisette@gruposoltura.com",c:"#ec4899"}];
/* Contactlabels = CPR-taxonomie cpr_contact_tag; alleen deze vijf bestaan (Rick, 17-10-2026) */
const ROLES=[["suspect","Suspect","--r-suspect"],["seller","Seller","--r-seller"],["buyer","Buyer","--r-buyer"],["suspect_seller","Suspect-Seller","--r-suspect-seller"],["agent","Agent","--r-agent"]];
const LANGS=[["nl","Nederlands","Dutch"],["en","Engels","English"],["es","Spaans","Spanish"],["de","Duits","German"],["fr","Frans","French"],
  ["sv","Zweeds","Swedish"],["no","Noors","Norwegian"],["da","Deens","Danish"],["fi","Fins","Finnish"],["ru","Russisch","Russian"],["other","Anders","Other"]];
const SOURCES=[["website","Website"],["phone",["Telefoon","Phone"]],["email","E-mail"],["walkin",["Binnenloper","Walk-in"]],["agent",["Partnermakelaar","Partner agent"]],
  ["referral",["Doorverwezen","Referral"]],["portal",["Portaal (Idealista e.d.)","Portal (Idealista etc.)"]],["social","Social media"],["other",["Anders","Other"]]];
const EMAIL_KINDS=[["","—"],["private",["Privé","Private"]],["work",["Werk","Work"]]];
const PHONE_KINDS=[["mobile",["Mobiel","Mobile"]],["phone",["Vast","Landline"]],["work",["Werk","Work"]],["whatsapp","WhatsApp"]];
/* Nieuwsbrieven = slugs uit public.mailing_types die JARVIS/Brevo echt verstuurt (18-10-2026). Transactionele mails
   (reserved, review_invite, review_viewing, welcome_seller) zijn geen nieuwsbrief en staan hier bewust niet.
   market_report is het enige opt-in-type (default_opt_in=false); de rest staat standaard aan met afmeldmogelijkheid. */
const MAILINGS=[["weekly_news",["Wekelijks nieuws (vrijdag)","Weekly news (Friday)"]],["price_reduced",["Prijsverlagingen (woensdag)","Price reductions (Wednesday)"]],
  ["monthly_matches",["Maandelijkse woningmatches","Monthly property matches"]],["new_listing",["Nieuwe woning","New listing"]],
  ["market_report",["Marktbericht (alleen met expliciete opt-in)","Market report (explicit opt-in only)"]]];
const MAILING_DEFAULT_ON=["weekly_news","price_reduced","monthly_matches","new_listing"];
const STATUS=[["draft",["Concept","Draft"]],["available",["In aanbod (current)","For sale (current)"]],["under_offer",["Onder bod","Under offer"]],
  ["sold",["Verkocht","Sold"]],["withdrawn",["Ingetrokken","Withdrawn"]],["off_market",["Off-market","Off-market"]]];
const CATS=[["apartment",["Appartement","Apartment"]],["penthouse","Penthouse"],["bungalow","Bungalow"],["townhouse",["Geschakelde woning","Townhouse"]],
  ["quadrant",["Quad (kwadrant)","Quad house"]],["semi-detached",["Halfvrijstaand","Semi-detached"]],["detached",["Vrijstaand","Detached"]],["villa","Villa"],
  ["duplex","Duplex"],["finca","Finca"],["studio","Studio"],["plot",["Bouwgrond","Plot"]],["commercial",["Bedrijfspand","Commercial"]],["other",["Overig","Other"]]];
const ORIENT=[["north",["Noord","North"]],["northeast",["Noordoost","North-east"]],["east",["Oost","East"]],["southeast",["Zuidoost","South-east"]],["south",["Zuid","South"]],["southwest",["Zuidwest","South-west"]],["west",["West","West"]],["northwest",["Noordwest","North-west"]]];
const VIEWS=[["bay",["Baai","Bay"]],["country",["Platteland","Country"]],["golf","Golf"],["green",["Groenzone","Green zone"]],["harbour",["Haven","Harbour"]],
  ["lake",["Meer","Lake"]],["mountain",["Bergen","Mountain"]],["ocean",["Oceaan","Ocean"]],["panoramic",["Panorama","Panoramic"]],["residential",["Woonwijk","Residential"]],
  ["sea",["Zee","Sea"]],["valley",["Vallei","Valley"]]];
const ENERGY=["A","B","C","D","E","F","G"].map(x=>[x,x]).concat([["R","R"],["X","X"]]);
const RANK=[["top","TOP"],["high","HIGH"],["normal","NORMAL"],["low","LOW"],["bottom","BOTTOM"]];
const LISTING=[["direct",["Direct (eigen opdracht)","Direct (own mandate)"]],["indirect",["Indirect (via derde)","Indirect (via third party)"]]];
/* zelfde sleutels als core.properties.features (import_wp.php) */
const F_INDOOR=[["security_system","Security system"],["family_room","Family room"],["study","Study"],["workshop","Workshop"],["basement","Basement"],
  ["furnished","Fully furnished"],["semi_furnished","Semi furnished"]];
const F_OUTDOOR=[["pool","Pool"],["communal_pool","Communal pool"],["solarium","Solarium"],["deck","Deck"],["courtyard","Courtyard"],
  ["outdoor_entertaining","Outdoor entertaining"],["storage_shed","Shed"],["remote_garage","Remote garage"],["secure_parking","Secure parking"],["intercom","Intercom"],["fully_fenced","Fully fenced"]];
const F_CLIMATE=[["air_conditioning","Air conditioning"],["air_conditioning_preinstalled","Air conditioning pre"],["underfloor_heating","Underfloor heating"],
  ["central_heating","Central heating"],["ducted_heating","Ducted heating"],["ducted_cooling","Ducted cooling"],["split_heating","Split system heating"],
  ["hydronic_heating","Hydronic heating"],["split_aircon","Split system airco"],["gas_heating","Gas heating"],["reverse_cycle_aircon","Reverse cycle aircon"],
  ["evaporative_cooling","Evaporative cooling"],["fireplace","Fire place"]];
/* zelfde groepen als core.properties.feature_options */
const OPT={
  kitchen:[["Keuken","Kitchen"],["closed","open","island","american","fully equipped"]],
  pool:[["Zwembad","Pool"],["infinity","heated","covered","salted","free","community","countercurrent swimming system"]],
  floor:[["Vloer","Floor"],["marble","wood","laminate","gres","porcelain stoneware","tiled","carpets","boards"]],
  garden:[["Tuin","Garden"],["plot - garden","plot - grass","planters","watersystem","waterfall","natural park","no","community","fruit trees","cypress trees","exotic plants","palms","japanese garden"]],
  terrace:[["Terras","Terrace"],["covered","glazed","open","solarium"]],
  aircon:[["Airco","Airco"],["conductor","pre-installed","split unit"]],
  heating:[["Verwarming","Heating"],["central heating","radiator","electric","gas","gasoil","oil","underfloor heating","pre-installation","heat pump","gas fireplace","wood fireplace"]],
  property:[["Overige kenmerken","Other property features"],["alarm","armored door","balcony","barbecue","built-in wardrobes","ceiling fan","centralised security","disabled access","dishwasher","domotic system","double glass windows","dressing room","electric blinds","electric gate","elevator","employees room","frontline beach","game room","garden","guesthouse apartment","independent guesthouse","gym","home-cinema","internet connection","jacuzzi","laundry room","library","mosquito nets","osmosis","outside jacuzzi","outside kitchen","outside shower","private parking","reformed","reform needed","roof terrace","safe-deposit box","sauna","softener limescale","solar panels","spa","storage room","technical room","tennis court","terrace","tv satellite","vacuum system","video surveillance","walk-in closet","waterdeposit","white goods","wifi","wine cellar"]],
  community:[["Gemeenschap","Community features"],["15 min beach","15 min market","15 min shops","24h security","barbecue","concierge","closed community","controlled access","direct beach access","disabled access","elevator","frontline beach","game area","gardens","golf court","gym","hotel","indoor swimming pool","jacuzzi","paddle court","parking","public transport","social club","sport center","swimming pool","tennis court"]]
};
/* Terugvallijst gemeente > wijk (opgeschoond uit de huidige woningdata). Bij openen wordt de live taxonomie 'location'
   van de website gelezen (zelfde boom als in wp-admin); lukt dat niet, dan geldt deze lijst. */
const LOC_FALLBACK={"Rojales":["Ciudad Quesada","La Marquesa","Benimar","Doña Pepa","Lo Pepín","Lo Marabú","Pueblo Bravo","Pueblo Lucero","La Fiesta","Upper Quesada","Altos de Quesada","Rojales Hills","Rojales - Village"],
  "Algorfa":["La Finca Golf","La Finca Golf Resort","Montemar","Castillo de Montemar","Lo Crispín","Lomas de La Juliana","Montebello","Algorfa - Village"],
  "Benijófar":["Benimar","Monte Azul","Atalaya Park","Benijófar - Village"],"Formentera del Segura":["Fincas de la Vega","Los Palacios","Formentera - Village"],
  "Guardamar del Segura":["El Raso","Centro","Puerto"],"San Fulgencio":["La Marina","El Oasis"],
  "Orihuela Costa":["Campoamor","Cabo Roig","La Zenia","Las Colinas Golf","Las Filipinas","Las Ramblas","Los Altos","Los Balcones","Los Dolses","Playa Flamenca","Punta Prima","Villamartín"],
  "San Miguel de Salinas":["Cerro del Sol","Las Comunicaciones"],"Almoradí":["Las Heredades"],"Los Montesinos":["La Herrada","Entre Naranjos / Vistabella Golf"],
  "Torrevieja":["Playa del Cura","Aguas Nuevas"],"Bigastro":["Loma Alta"],"Orihuela":["La Campaneta","Torremendo"],"Catral":[],"Daya Nueva":[],"Daya Vieja":[],"Dolores":[],
  "Pilar de la Horadada":["Torre de la Horadada"],"Albatera":[],"Benejúzar":[],"Benferri":[],"Callosa de Segura":[],"Cox":[],"Crevillente":[],"Redován":[],
  "San Bartolomé":[],"Abanilla":[],"Aspe":[],"Altea":["Altea Hills"],"Los Alcázares":[],"La Manga del Mar Menor":[]};
window.NEXUS_LISTS={CATS,ORIENT,VIEWS,ENERGY,F_INDOOR,F_OUTDOOR,F_CLIMATE,OPT,RANK};
let LOCS=null, LOC_SRC="fallback";
const REF_PFX=["RH","BE","QU","LM","LP","PL","PB","DP","FO","AL","PR","SB","SR","TO","VL","AY"];

/* ================= STATE ================= */
const blankContact=()=>({title:"",first_name:"",last_name:"",company:"",language:"",country:"",state:"",city:"",postcode:"",street:"",street_number:"",
  birthday:"",website:"",referred_by:"",owner:"",source:"",roles:[],emails:[{email:"",kind:""}],phones:[{phone:"",kind:"mobile"}],
  keyholder:false,mailing_optin:false,prefs:[],search:{budget:"",property_type:"",period:"",build:[]},internal_comments:""});
const blankProp=()=>({status:"draft",published:false,category:"",build_type:"resale",own_listing_type:"direct",reference:"",year_built:"",listed_at:new Date().toISOString().slice(0,10),
  dossier_complete:false,listing_agent:"",internal_notes:"",
  price:"",price_text:"",price_original:"",price_temp:"",price_temp_until:"",price_hidden:false,price_fixed:false,price_from:false,price_on_request:false,price_coming_soon:false,
  labels:[],search_rank:"normal",no_export:false,export_feeds:[],
  municipality:"",area:"",area_new:"",street:"",street_number:"",postal_code:"",province:"Alicante",country:"Spain",lat:"",lng:"",hide_address:false,show_street:false,
  orientation:"",views:[],
  bedrooms:"",bathrooms:"",toilets:"",ensuites:"",living_rooms:"",kitchens:"",utility_rooms:"",build_area:"",plot_area:"",garages:"",carports:"",parking_open:"",
  energy_label:"",energy_rating:"",floors:"",floor_level:"",staircases:"",balconies:"",patios:"",terraces:"",
  area_living:"",area_kitchen:"",area_terrace:"",area_garden:"",distance_airport_m:"",distance_sea_m:"",distance_city_m:"",distance_shops_m:"",
  features:[],opts:{},
  texts:{nl:{heading:"",description:"",key_details:"",seo_title:"",seo_description:""},en:{heading:"",description:"",key_details:"",seo_title:"",seo_description:""},es:{heading:"",description:"",key_details:"",seo_title:"",seo_description:""}},
  cost_community:"",cost_garbage:"",cost_ibi:"",cost_insurance:"",fee_transfer_tax:"",fee_legal:"",fee_notary:"",fee_registry:"",
  registry_name:"",finca_number:"",cadastral_ref:"",video_url:"",tour_360_url:"",video_embed:""});
function blank(){return{flow:"wizard",step:1,agentMode:"none",agent:null,newAgent:{company:"",first_name:"",last_name:"",email:"",phone:"",website:"",language:"es"},
  contactMode:"new",existing:null,c:blankContact(),propMode:null,linkProp:null,linkRel:"owner",p:blankProp(),
  /* losse schermen */
  wp:{owner:null,p:blankProp()},lk:{contact:null,prop:null,rel:"owner"}};}
let S=blank(), MEDIA=[], WP_MEDIA=[], txLang="nl";
function load(){try{const d=JSON.parse(localStorage.getItem(DRAFT_KEY)||"null");if(d){S=Object.assign(blank(),d);
  S.c=Object.assign(blankContact(),d.c);S.c.roles=(S.c.roles||[]).filter(r=>ROLES.some(x=>x[0]===r));S.p=Object.assign(blankProp(),d.p);S.wp.p=Object.assign(blankProp(),(d.wp||{}).p)}}catch(e){}}
let saveT;function persist(){clearTimeout(saveT);saveT=setTimeout(()=>{try{localStorage.setItem(DRAFT_KEY,JSON.stringify(S));stamp()}catch(e){}},250)}
function stamp(){const el=ROOT&&ROOT.querySelector("#adStamp");if(el)el.textContent=tr(["Concept bewaard in deze browser · ","Draft kept in this browser · "])+new Date().toLocaleTimeString(X.lang()==="en"?"en-GB":"nl-NL",{hour:"2-digit",minute:"2-digit"})}
const getP=(o,path)=>path.split(".").reduce((a,k)=>a==null?a:a[k],o);
function setP(o,path,v){const ks=path.split(".");let a=o;for(let i=0;i<ks.length-1;i++){if(a[ks[i]]==null)a[ks[i]]={};a=a[ks[i]]}a[ks[ks.length-1]]=v}
const pm=()=>isSeller()?(S.propMode||"now"):"none"; /* zonder Seller-label nooit een woning */
/* Woning-stap (3) alleen bij Seller/Suspect-Seller; anders van Contact direct naar Controle */
const nextStep=()=>S.step===2&&!isSeller()?4:S.step+1;
const prevStep=()=>S.step===4&&!isSeller()?2:S.step-1;
const isSeller=()=>S.c.roles.some(r=>r==="seller"||r==="suspect_seller")||(S.contactMode==="existing"&&S.existing&&(S.existing.roles||[]).some(r=>/seller/.test(r)));

/* ================= VELD-HELPERS ================= */
/* req: "save" = verplicht om op te slaan, "pub" = verplicht om te publiceren */
const mark=req=>req==="save"?`<b class="ad-req" title="${esc(tr(["Verplicht","Required"]))}">*</b>`:req==="pub"?`<b class="ad-pub" title="${esc(tr(["Verplicht voor publicatie","Required to publish"]))}">◆</b>`:"";
function inp(k,label,o={}){const v=getP(S,k);const type=o.type||"text";
  return `<label class="ad-f ${o.w?"w"+o.w:""}"><span>${esc(tr(label))}${mark(o.req)}</span>
   <input data-k="${k}" type="${type}" value="${esc(v??"")}" ${o.ph?`placeholder="${esc(tr(o.ph))}"`:""} ${o.min!=null?`min="${o.min}"`:""} ${o.step?`step="${o.step}"`:""} ${o.list?`list="${o.list}"`:""} ${o.ac?`autocomplete="${o.ac}"`:""}>
   ${o.hint?`<small>${esc(tr(o.hint))}</small>`:""}</label>`}
function sel(k,label,opts,o={}){const v=getP(S,k);
  return `<label class="ad-f ${o.w?"w"+o.w:""}"><span>${esc(tr(label))}${mark(o.req)}</span><select data-k="${k}">
   ${o.empty!==false?`<option value="">${esc(tr(o.empty||["— kies —","— choose —"]))}</option>`:""}
   ${opts.map(x=>`<option value="${esc(x[0])}" ${String(v)===String(x[0])?"selected":""}>${esc(tr(x[1]))}</option>`).join("")}</select>${o.hint?`<small>${esc(tr(o.hint))}</small>`:""}</label>`}
function area(k,label,o={}){return `<label class="ad-f w${o.w||4}"><span>${esc(tr(label))}${mark(o.req)}</span><textarea data-k="${k}" rows="${o.rows||4}" ${o.ph?`placeholder="${esc(tr(o.ph))}"`:""}>${esc(getP(S,k)||"")}</textarea>${o.hint?`<small>${esc(tr(o.hint))}</small>`:""}</label>`}
function chk(k,label){return `<label class="ad-c"><input type="checkbox" data-k="${k}" data-bool ${getP(S,k)?"checked":""}><span>${esc(tr(label))}</span></label>`}
function multi(k,opts,o={}){const arr=getP(S,k)||[];
  return `<div class="ad-multi ${o.cols?"c"+o.cols:""}">${opts.map(x=>{const val=Array.isArray(x)?x[0]:x, lab=Array.isArray(x)?x[1]:x;
    return `<label class="ad-c"><input type="checkbox" data-k="${k}" data-arr="${esc(val)}" ${arr.includes(val)?"checked":""}><span>${esc(tr(lab))}</span></label>`}).join("")}</div>`}
const sec=(title,body,o={})=>`<section class="ad-sec" ${o.id?`id="${o.id}"`:""}><h4>${esc(tr(title))}${o.aside?`<span class="sm muted">${o.aside}</span>`:""}</h4>${body}</section>`;
const row=(...c)=>`<div class="ad-row">${c.join("")}</div>`;

/* ================= LOCATIES ================= */
async function loadLocations(){
  if(LOCS)return;LOCS=JSON.parse(JSON.stringify(LOC_FALLBACK));
  try{let all=[],page=1;
    while(page<10){const r=await fetch(`https://gruposoltura.com/wp-json/wp/v2/location?per_page=100&page=${page}&_fields=id,name,parent`,{mode:"cors"});
      if(!r.ok)break;const j=await r.json();all=all.concat(j);if(j.length<100)break;page++}
    if(all.length>20){const dec=s=>{const d=document.createElement("textarea");d.innerHTML=s;return d.value};
      const byId={};all.forEach(x=>byId[x.id]=x);const tree={};
      all.filter(x=>!x.parent).forEach(x=>tree[dec(x.name)]=[]);
      all.filter(x=>x.parent&&byId[x.parent]).forEach(x=>{let r=byId[x.parent],g=0;while(r.parent&&byId[r.parent]&&g++<5)r=byId[r.parent];(tree[dec(r.name)]=tree[dec(r.name)]||[]).push(dec(x.name))});
      Object.values(tree).forEach(a=>a.sort((a,b)=>a.localeCompare(b,"es")));
      LOCS=tree;LOC_SRC="wp"}
  }catch(e){}
}
const munis=()=>Object.keys(LOCS||LOC_FALLBACK).sort((a,b)=>a.localeCompare(b,"es"));

/* ================= OPEN / LAYOUT ================= */
function open(root,ctx){X=ctx;ROOT=root;if(!ROOT.dataset.init){load();ROOT.dataset.init="1";bind()}
  if(!S.c.owner&&X.me())S.c.owner=String(X.me().wp_author_id||"");
  if(!S.p.listing_agent&&X.me())S.p.listing_agent=String(X.me().wp_author_id||"");
  render();loadLocations().then(()=>{if(ROOT.querySelector("#adMuni"))render()})}
const STEPS=[[1,["Aanbrenger","Introducer"]],[2,["Contact","Contact"]],[3,["Woning","Property"]],[4,["Controle","Review"]]];
/* bij opnieuw tekenen (bv. vinkje aan/uit) de scrollpositie en focus behouden, zodat het scherm niet naar boven springt */
function render(){
  const prevMain=ROOT&&ROOT.querySelector("#adMain"), keepY=prevMain?prevMain.scrollTop:0, keepKey=prevMain?prevMain.dataset.view:"";
  const fe=document.activeElement, focusK=fe&&ROOT&&ROOT.contains(fe)?(fe.dataset.k||fe.id||""):"";
  renderInner();
  const m=ROOT.querySelector("#adMain");
  if(m){m.dataset.view=S.flow+":"+S.step;if(keepKey===m.dataset.view)m.scrollTop=keepY}
  if(focusK){const el=ROOT.querySelector(`[data-k="${CSS.escape(focusK)}"]`)||ROOT.querySelector("#"+CSS.escape(focusK));if(el&&el.focus)el.focus({preventScroll:true})}
}
function renderInner(){
  const flows=[["wizard",["Nieuw contact (workflow)","New contact (workflow)"],"①→④"],["prop",["Woning toevoegen","Add property"],"⌂"],["link",["Contact ↔ woning koppelen","Link contact ↔ property"],"⇄"]];
  ROOT.innerHTML=`<div class="ad">
   <aside class="card ad-nav"><div class="hd"><h3>Admin</h3></div>
     ${flows.map(f=>`<button class="ad-flow ${S.flow===f[0]?"on":""}" data-flow="${f[0]}"><i>${f[2]}</i>${esc(tr(f[1]))}</button>`).join("")}
     ${S.flow==="wizard"?`<div class="ad-steps">${STEPS.map(s=>s[0]===3&&!isSeller()?`<button class="ad-step skip" disabled title="${esc(tr(["Alleen bij label Seller of Suspect-Seller","Only with label Seller or Suspect-Seller"]))}"><b>3</b>${esc(tr(s[1]))} <small>${esc(tr(["(alleen bij Seller)","(Seller only)"]))}</small></button>`:`<button class="ad-step ${S.step===s[0]?"on":""} ${stepDone(s[0])?"ok":""}" data-step="${s[0]}"><b>${s[0]}</b>${esc(tr(s[1]))}</button>`).join("")}</div>`:""}
     <div class="ad-legend sm"><div>${mark("save")} ${esc(tr(["verplicht om op te slaan","required to save"]))}</div><div>${mark("pub")} ${esc(tr(["verplicht om te publiceren","required to publish"]))}</div></div>
     <div class="ad-off sm"><b>${esc(tr(["Nog niet gekoppeld","Not connected yet"]))}</b>${esc(tr(["Dit scherm schrijft nog niets weg. Opslaan gaat aan na akkoord van Rick.","This screen does not save anything yet. Saving is enabled after Rick approves."]))}</div>
     <div class="sm muted" id="adStamp" style="padding:8px 14px"></div>
     <button class="ad-reset" id="adReset">${esc(tr(["Concept wissen","Clear draft"]))}</button>
   </aside>
   <div class="card ad-main"><div class="ad-scroll" id="adMain">${S.flow==="wizard"?wizard():S.flow==="prop"?propFlow():linkFlow()}</div>
     ${S.flow==="wizard"?`<div class="ad-foot">${S.step>1?`<button class="btn" data-step="${prevStep()}">← ${esc(tr(["Vorige","Back"]))}</button>`:"<span></span>"}
       ${S.step<4?`<button class="btn ad-next" data-step="${nextStep()}">${esc(tr(["Volgende","Next"]))} →</button>`:saveBtn()}</div>`:S.flow==="prop"?`<div class="ad-foot"><span></span>${saveBtn()}</div>`:`<div class="ad-foot"><span></span>${saveBtn(tr(["Koppeling opslaan","Save link"]))}</div>`}
   </div>
   <aside class="card ad-side"><div class="hd"><h3>${esc(tr(["Controle","Checks"]))}</h3></div><div class="ad-scroll" id="adChecks"></div></aside></div>`;
  afterRender();
}
const saveBtn=lbl=>`<button class="btn ad-save" disabled title="${esc(tr(["Opslaan wordt gekoppeld na akkoord","Saving is connected after approval"]))}">🔒 ${esc(lbl||tr(["Opslaan","Save"]))}</button>`;
function afterRender(){updateChecks();stamp();
  if(ROOT.querySelector("#adMap"))initMap();
  ROOT.querySelectorAll(".ad-drop").forEach(wireDrop);
  renderMedia();
}

/* ================= STAP 1 · AANBRENGER ================= */
function stepAgent(){
  const m=S.agentMode;
  return `<div class="ad-intro"><h2>${esc(tr(["Wie heeft dit contact aangebracht?","Who introduced this contact?"]))}</h2>
    <p class="muted">${esc(tr(["Komt het contact via een (partner)makelaar, kies die dan eerst. Onbekende makelaar? Maak hem hier aan; hij krijgt het label Agent.","If the contact came through a (partner) agent, pick that agent first. Unknown agent? Create one here; it gets the Agent label."]))}</p></div>
  <div class="seg ad-seg">${[["none",["Niet aangebracht","Not introduced"]],["existing",["Bestaande makelaar","Existing agent"]],["new",["Nieuwe makelaar","New agent"]]].map(o=>`<button data-am="${o[0]}" class="${m===o[0]?"on":""}">${esc(tr(o[1]))}</button>`).join("")}</div>
  ${m==="existing"?sec(["Makelaar zoeken","Find agent"],`${S.agent?pickedCard(S.agent,"agent"):""}
     <input class="ad-search" id="adAgentQ" type="search" placeholder="${esc(tr(["Naam, kantoor of e-mail (alleen contacten met label Agent)","Name, office or e-mail (only contacts labelled Agent)"]))}">
     <div id="adAgentRes" class="ad-res"></div>`):""}
  ${m==="new"?sec(["Nieuwe makelaar","New agent"],row(inp("newAgent.company",["Kantoor / bedrijf","Office / company"],{req:"save",w:2}),inp("newAgent.website","Website",{w:2,ph:"https://"}))
     +row(inp("newAgent.first_name",["Voornaam contactpersoon","Contact first name"]),inp("newAgent.last_name",["Achternaam","Last name"]),sel("newAgent.language",["Taal","Language"],LANGS.map(l=>[l[0],[l[1],l[2]]])))
     +row(inp("newAgent.email","E-mail",{type:"email",w:2,req:"save",hint:["E-mail of telefoon is verplicht","E-mail or phone is required"]}),inp("newAgent.phone",["Telefoon","Phone"],{type:"tel",w:2}))
     +`<div id="adAgentDup"></div>`):""}
  ${m!=="none"?sec(["Of: vrij verwezen door","Or: referred by (free text)"],row(inp("c.referred_by",["Verwezen door (bijv. kennis, tipgever)","Referred by (e.g. friend, tipster)"],{w:4}))):sec(["Verwezen door","Referred by"],row(inp("c.referred_by",["Verwezen door (optioneel)","Referred by (optional)"],{w:4})))}`;
}
function pickedCard(c,kind){return `<div class="ad-picked"><div class="ini" style="background:var(--r-agent)">${esc((c.name||c.email||"?").slice(0,1).toUpperCase())}</div>
  <div style="min-width:0"><b>${esc(c.name||c.email)}</b><div class="sm muted">${esc([c.email,c.city].filter(Boolean).join(" · "))} · WP ${esc(c.wp_id)}</div></div>
  <button class="btn sm" data-clear="${kind}">${esc(tr(["Wijzigen","Change"]))}</button></div>`}

/* ================= STAP 2 · CONTACT ================= */
function stepContact(){
  const c=S.c;
  return `<div class="ad-intro"><h2>${esc(tr(["Contact","Contact"]))}</h2>
   <p class="muted">${esc(tr(["Vul het contact in. NEXUS zoekt tijdens het typen naar bestaande contacten met hetzelfde e-mailadres, telefoonnummer of dezelfde naam.","Enter the contact. While you type, NEXUS looks for existing contacts with the same e-mail, phone or name."]))}</p></div>
  <div class="seg ad-seg">${[["new",["Nieuw contact","New contact"]],["existing",["Bestaand contact kiezen","Pick existing contact"]]].map(o=>`<button data-cm="${o[0]}" class="${S.contactMode===o[0]?"on":""}">${esc(tr(o[1]))}</button>`).join("")}</div>
  ${S.contactMode==="existing"?sec(["Bestaand contact","Existing contact"],`${S.existing?pickedCard(S.existing,"existing"):""}
    <input class="ad-search" id="adCtQ" type="search" placeholder="${esc(tr(["Naam, e-mail of telefoon","Name, e-mail or phone"]))}"><div id="adCtRes" class="ad-res"></div>
    ${S.existing?row(`<div class="ad-f w4"><span>${esc(tr(["Labels toevoegen aan dit contact","Add labels to this contact"]))}</span>${roleChips()}</div>`):""}`):`
  <div id="adDup"></div>
  ${sec(["Labels","Labels"],`<div class="ad-f w4"><span>${esc(tr(["Rol(len) van dit contact","Role(s) of this contact"]))}${mark("save")}</span>${roleChips()}
     <small>${esc(tr(["Meerdere mogelijk. Seller of Suspect-Seller opent de woningstap.","Several allowed. Seller or Suspect-Seller opens the property step."]))}</small></div>`)}
  ${sec(["Persoon","Person"],row(sel("c.title",["Aanhef","Title"],[["Mr","Mr"],["Mrs","Mrs"],["Ms","Ms"],["Mr & Mrs","Mr & Mrs"],["Dhr.","Dhr."],["Mevr.","Mevr."],["Sr.","Sr."],["Sra.","Sra."]]),
       inp("c.first_name",["Voornaam","First name"],{req:"save",ac:"off"}),inp("c.last_name",["Achternaam","Last name"],{ac:"off"}),inp("c.company",["Bedrijf","Company"]))
     +row(sel("c.language",["Correspondentietaal","Correspondence language"],LANGS.map(l=>[l[0],[l[1],l[2]]]),{req:"save"}),inp("c.birthday",["Geboortedatum","Birthday"],{type:"date"}),
       sel("c.owner",["Verantwoordelijk teamlid","Responsible team member"],TEAM.map(t=>[String(t.wp),t.name]),{req:"save"}),sel("c.source",["Bron","Source"],SOURCES))
     +`<small class="muted">${esc(tr(["Voornaam óf bedrijf is genoeg.","First name or company is enough."]))}</small>`)}
  ${sec(["E-mail en telefoon","E-mail and phone"],`
    <div class="ad-list">${c.emails.map((e,i)=>`<div class="ad-row">${inp(`c.emails.${i}.email`,i?["Extra e-mail","Extra e-mail"]:"E-mail",{type:"email",w:3,req:i?"":"save",ac:"off"})}${sel(`c.emails.${i}.kind`,["Soort","Kind"],EMAIL_KINDS,{empty:false})}
      ${i?`<button class="ad-x" data-rm="emails" data-i="${i}" title="×">×</button>`:""}</div>`).join("")}<button class="btn sm" data-add="emails">+ ${esc(tr(["e-mail","e-mail"]))}</button></div>
    <div class="ad-list">${c.phones.map((p,i)=>`<div class="ad-row">${inp(`c.phones.${i}.phone`,i?["Extra telefoon","Extra phone"]:["Telefoon","Phone"],{type:"tel",w:3,ph:"+34 …",ac:"off"})}${sel(`c.phones.${i}.kind`,["Soort","Kind"],PHONE_KINDS,{empty:false})}
      ${i?`<button class="ad-x" data-rm="phones" data-i="${i}" title="×">×</button>`:""}</div>`).join("")}<button class="btn sm" data-add="phones">+ ${esc(tr(["telefoon","phone"]))}</button></div>
    <small class="muted">${esc(tr(["Minstens één e-mailadres of telefoonnummer.","At least one e-mail address or phone number."]))}</small>`)}
  ${sec(["Adres","Address"],row(inp("c.street",["Straat","Street"],{w:2}),inp("c.street_number",["Nr.","No."]),inp("c.postcode",["Postcode","Postcode"]))
     +row(inp("c.city",["Plaats","City"],{w:2}),inp("c.state",["Provincie / regio","Province / region"]),inp("c.country",["Land","Country"],{list:"adCountries"})))}
  ${c.roles.some(r=>r==="buyer"||r==="suspect")?sec(["Zoekprofiel","Search profile"],row(inp("c.search.budget",["Budget","Budget"],{ph:["bijv. 200-300k","e.g. 200-300k"]}),
     sel("c.search.property_type",["Woningtype","Property type"],CATS),inp("c.search.period",["Wanneer kopen","When to buy"],{ph:["bijv. binnen 6 maanden","e.g. within 6 months"]}),inp("c.website","Website"))
     +row(`<div class="ad-f w4"><span>${esc(tr(["Bestaande bouw of nieuwbouw (beide mag)","Resale or new build (both allowed)"]))}</span>${multi("c.search.build",[["resale",["Bestaande bouw","Resale"]],["new_build",["Nieuwbouw","New build"]]],{cols:2})}</div>`)):""}
  ${sec(["Mailings","Mailings"],`${chk("c.mailing_optin",["Toestemming voor mailings (opt-in)","Consent to mailings (opt-in)"])}${S.c.mailing_optin?multi("c.prefs",MAILINGS,{cols:3}):""}`)}
  ${sec(["Interne opmerking","Internal note"],row(area("c.internal_comments",["Alleen zichtbaar voor het team","Only visible to the team"],{rows:3})))}`}
  <datalist id="adCountries">${["Spain","Netherlands","Belgium","United Kingdom","Ireland","Germany","France","Sweden","Norway","Denmark","Finland","Switzerland","Austria"].map(x=>`<option value="${x}">`).join("")}</datalist>`;
}
function roleChips(){return `<div class="ad-chips">${ROLES.map(r=>`<label class="chip ${S.c.roles.includes(r[0])?"on":""}" style="--cc:var(${r[2]})"><input type="checkbox" hidden data-k="c.roles" data-arr="${r[0]}" ${S.c.roles.includes(r[0])?"checked":""}>${esc(tr(r[1]))}</label>`).join("")}</div>`}

/* ================= STAP 3 · WONING ================= */
function stepProp(){
  const seller=isSeller();
  return `<div class="ad-intro"><h2>${esc(tr(["Woning","Property"]))}</h2>
   <p class="muted">${esc(seller?tr(["Dit contact is verkoper. Maak de woning nu aan, later, of koppel een woning die al bestaat.","This contact is a seller. Create the property now, later, or link an existing property."])
     :tr(["Dit contact heeft (nog) geen verkoperslabel. Je kunt deze stap overslaan of toch een woning koppelen.","This contact has no seller label (yet). You can skip this step or link a property anyway."]))}</p></div>
  <div class="seg ad-seg">${[["now",["Nu aanmaken","Create now"]],["later",["Later","Later"]],["link",["Bestaande woning koppelen","Link existing property"]],["none",["Geen woning","No property"]]]
    .map(o=>`<button data-pm="${o[0]}" class="${pm()===o[0]?"on":""}">${esc(tr(o[1]))}</button>`).join("")}</div>
  ${pm()==="now"?propForm("p",MEDIA):""}
  ${pm()==="later"?`<div class="ad-note">${esc(tr(["Het contact wordt opgeslagen zonder woning. De woning voeg je later toe via ‘Woning toevoegen’ of koppel je via ‘Contact ↔ woning koppelen’.","The contact is saved without a property. Add it later via ‘Add property’ or link it via ‘Link contact ↔ property’."]))}</div>`:""}
  ${pm()==="link"?sec(["Bestaande woning","Existing property"],`${S.linkProp?propPicked(S.linkProp,"linkProp"):""}
     <input class="ad-search" id="adPrQ" type="search" placeholder="${esc(tr(["Referentie of plaats (bijv. RH994)","Reference or town (e.g. RH994)"]))}"><div id="adPrRes" class="ad-res ad-pres"></div>
     ${row(sel("linkRel",["Rol van het contact bij deze woning","Contact's role for this property"],RELS))}`):""}`;
}
const RELS=[["owner",["Eigenaar / verkoper","Owner / seller"]],["buyer",["Koper","Buyer"]],["interest",["Geïnteresseerd","Interested"]],["agency",["Aanbiedend makelaar","Listing agency"]]];
function propPicked(p,kind){return `<div class="ad-picked"><div class="th" style="${p.image?`background-image:url('${esc(p.image)}')`:""}"></div>
  <div style="min-width:0"><b>${esc(p.reference)} · ${p.price?"€ "+Number(p.price).toLocaleString("nl-NL"):"—"}</b><div class="sm muted">${esc([p.suburb,p.town].filter(Boolean).join(", "))}${p.owner?" · 👤 "+esc(p.owner):""}</div></div>
  <button class="btn sm" data-clear="${kind}">${esc(tr(["Wijzigen","Change"]))}</button></div>`}

function propForm(base,media){
  const p=getP(S,base), B=k=>base+"."+k;
  const mun=p.municipality, areas=(LOCS||LOC_FALLBACK)[mun]||[];
  const nav=[["pf-basis",["Basis","Basics"]],["pf-prijs",["Prijs","Price"]],["pf-loc",["Locatie","Location"]],["pf-ind",["Indeling","Layout"]],["pf-ken",["Kenmerken","Features"]],
    ["pf-tekst",["Teksten","Texts"]],["pf-media",["Foto's","Photos"]],["pf-kost",["Kosten","Costs"]],["pf-pub",["Publicatie","Publishing"]]];
  return `<div class="ad-jump">${nav.map(n=>`<a data-jump="${n[0]}">${esc(tr(n[1]))}</a>`).join("")}</div>
  ${sec(["Basis","Basics"],row(sel(B("status"),["Status","Status"],STATUS,{req:"save",empty:false}),sel(B("category"),["Woningtype","Property type"],CATS,{req:"save"}),
      sel(B("build_type"),["Bouw","Build"],[["resale",["Bestaande bouw","Resale"]],["new_build",["Nieuwbouw","New build"]]],{req:"save",empty:false}),sel(B("own_listing_type"),["Soort opdracht","Mandate"],LISTING,{empty:false}))
    +row(inp(B("reference"),["Referentie","Reference"],{req:"save",list:"adRefPfx",ph:"RH995",hint:["Plaatsprefix + nummer; uniek","Location prefix + number; unique"]}),inp(B("year_built"),["Bouwjaar","Year built"],{type:"number",min:1800}),
      inp(B("listed_at"),["In aanbod sinds","Date listed"],{type:"date"}),sel(B("listing_agent"),["Makelaar (verantwoordelijk)","Listing agent"],TEAM.map(t=>[String(t.wp),t.name]),{req:"save"}))
    +`<div id="adRefCheck" class="sm"></div>`+chk(B("dossier_complete"),["Dossier compleet","Dossier complete"])
    +`<datalist id="adRefPfx">${REF_PFX.map(x=>`<option value="${x}">`).join("")}</datalist>`,{id:"pf-basis"})}
  ${sec(["Prijs","Price"],row(inp(B("price"),["Vraagprijs (€)","Asking price (€)"],{type:"number",min:0,step:1000,req:"save"}),inp(B("price_text"),["Prijstekst","Price text"],{ph:["bijv. Prijs op aanvraag","e.g. Price on request"]}),
      inp(B("price_original"),["Oorspronkelijke vraagprijs (€)","Original price (€)"],{type:"number",min:0,step:1000}))
    +row(inp(B("price_temp"),["Tijdelijke prijs (€)","Temporary price (€)"],{type:"number",min:0,step:1000}),inp(B("price_temp_until"),["Tijdelijke prijs tot","Temporary price until"],{type:"datetime-local"}))
    +`<div class="ad-multi c3">${chk(B("price_hidden"),["Prijs verbergen","Hide price"])}${chk(B("price_fixed"),["Vaste prijs","Price FIXED"])}${chk(B("price_from"),["Prijs vanaf","Price FROM"])}
      ${chk(B("price_on_request"),["Prijs op aanvraag","Price ON REQUEST"])}${chk(B("price_coming_soon"),["Binnenkort","Price COMING SOON"])}</div>`,{id:"pf-prijs"})}
  ${sec(["Locatie","Location"],row(`<label class="ad-f w2"><span>${esc(tr(["Gemeente","Municipality"]))}${mark("save")}</span><select data-k="${B("municipality")}" id="adMuni"><option value="">${esc(tr(["— kies —","— choose —"]))}</option>
        ${munis().map(m=>`<option ${m===mun?"selected":""}>${esc(m)}</option>`).join("")}</select><small>${esc(LOC_SRC==="wp"?tr(["Lijst uit de website-taxonomie ‘Location’","List from the website ‘Location’ taxonomy"]):tr(["Lijst uit de woningdata (website niet bereikbaar)","List from property data (website unreachable)"]))}</small></label>`,
      `<label class="ad-f w2"><span>${esc(tr(["Wijk / urbanisatie","Area / urbanisation"]))}${mark("save")}</span><select data-k="${B("area")}" ${mun?"":"disabled"}><option value="">${esc(tr(mun?["— kies —","— choose —"]:["eerst gemeente","municipality first"]))}</option>
        ${areas.map(a=>`<option ${a===p.area?"selected":""}>${esc(a)}</option>`).join("")}<option value="__mun" ${p.area==="__mun"?"selected":""}>${esc(tr(["(gemeente zelf, geen wijk)","(municipality itself, no area)"]))}</option><option value="__new" ${p.area==="__new"?"selected":""}>+ ${esc(tr(["nieuwe wijk…","new area…"]))}</option></select></label>`)
    +(p.area==="__new"?row(inp(B("area_new"),["Naam nieuwe wijk","New area name"],{w:2,req:"save",hint:["Wordt als voorstel aangemaakt; de PropertyGuard-normalisatie moet hem goedkeuren","Created as a proposal; PropertyGuard normalisation must approve it"]})):"")
    +row(inp(B("street"),["Straat","Street"],{w:2}),inp(B("street_number"),["Nr.","No."]),inp(B("postal_code"),["Postcode","Post code"]))
    +row(inp(B("province"),["Provincie","Province"]),inp(B("country"),["Land","Country"]),sel(B("orientation"),["Oriëntatie","Orientation"],ORIENT))
    +`<div class="ad-mapwrap"><div class="ad-maptools"><input id="adGeoQ" type="search" placeholder="${esc(tr(["Zoek adres of plak een Google Maps-link / ‘lat, lng’","Search address or paste a Google Maps link / ‘lat, lng’"]))}"><button class="btn sm" id="adGeoBtn">${esc(tr(["Zoek","Find"]))}</button></div>
      <div id="adMap" data-base="${base}"></div><div class="ad-row">${inp(B("lat"),["Breedtegraad","Latitude"],{req:"pub",type:"number",step:"any"})}${inp(B("lng"),["Lengtegraad","Longitude"],{req:"pub",type:"number",step:"any"})}</div>
      <small class="muted">${esc(tr(["Klik op de kaart of sleep de pin. Zonder coördinaten staat een woning niet op de NEXUS-kaart.","Click the map or drag the pin. Without coordinates a property is not on the NEXUS map."]))}</small></div>`
    +`<div class="ad-multi c3">${chk(B("hide_address"),["Kaart verbergen","Hide map"])}${chk(B("show_street"),["Straat tonen op de site","Display street address"])}</div>`
    +`<div class="ad-f w4"><span>${esc(tr(["Uitzicht","Views"]))}</span>${multi(B("views"),VIEWS,{cols:4})}</div>`,{id:"pf-loc"})}
  ${sec(["Indeling en oppervlaktes","Layout and areas"],
     `<div class="ad-cols3"><div><h5>${esc(tr(["Kamers","Rooms"]))}</h5>${[["bedrooms",["Slaapkamers","Bedrooms"],"save"],["bathrooms",["Badkamers","Bathrooms"],"save"],["toilets",["Toiletten","Toilets"]],["ensuites","En-suite"],["living_rooms",["Woonkamers","Livings"]],["kitchens",["Keukens","Kitchens"]],["utility_rooms",["Bijkeukens","Utility rooms"]]]
        .map(f=>inp(B(f[0]),f[1],{type:"number",min:0,req:f[2]})).join("")}</div>
      <div><h5>${esc(tr(["Oppervlakte (m²)","Surface (m²)"]))}</h5>${[["build_area",["Bebouwd","Building area"],"save"],["plot_area",["Perceel","Land area"]],["area_living",["Woonoppervlak","Living area"]],["area_kitchen",["Keuken","Kitchen area"]],["area_terrace",["Terras","Terrace area"]],["area_garden",["Tuin","Garden area"]]]
        .map(f=>inp(B(f[0]),f[1],{type:"number",min:0,req:f[2]})).join("")}
        ${sel(B("energy_label"),["Energielabel C.E.E.","Energy label C.E.E."],ENERGY,{req:"pub",hint:["Wettelijk verplicht in advertenties","Legally required in adverts"]})}${inp(B("energy_rating"),["Energieverbruik (kWh/m²·jr)","Energy rating (kWh/m²·yr)"],{type:"number",min:0})}</div>
      <div><h5>${esc(tr(["Overig","Other"]))}</h5>${[["floors",["Verdiepingen","Floors"]],["staircases",["Trappen","Staircases"]],["balconies",["Balkons","Balconies"]],["patios",["Patio's","Patios"]],["terraces",["Terrassen","Terraces"]],["garages",["Garages","Garage"]],["carports","Carport"],["parking_open",["Open parkeerplaatsen","Open parking spaces"]]]
        .map(f=>inp(B(f[0]),f[1],{type:"number",min:0})).join("")}${inp(B("floor_level"),["Etage","Level"],{ph:["bijv. begane grond, 2e","e.g. ground, 2nd"]})}</div></div>
     <h5>${esc(tr(["Afstanden (meter)","Distances (metres)"]))}</h5>${row(inp(B("distance_sea_m"),["Zee","Sea"],{type:"number",min:0}),inp(B("distance_airport_m"),["Luchthaven","Airport"],{type:"number",min:0}),inp(B("distance_city_m"),["Centrum","Town centre"],{type:"number",min:0}),inp(B("distance_shops_m"),["Winkels","Shops"],{type:"number",min:0}))}`,{id:"pf-ind"})}
  ${sec(["Kenmerken","Features"],`<div class="ad-cols3"><div><h5>Indoor</h5>${multi(B("features"),F_INDOOR)}</div><div><h5>Outdoor</h5>${multi(B("features"),F_OUTDOOR)}</div><div><h5>${esc(tr(["Klimaat","Climatisation"]))}</h5>${multi(B("features"),F_CLIMATE)}</div></div>
     ${Object.entries(OPT).map(([k,[lab,vals]])=>`<details class="ad-det" ${((p.opts||{})[k]||[]).length?"open":""}><summary>${esc(tr(lab))} <span class="sm muted">${((p.opts||{})[k]||[]).length||""}</span></summary>${multi(B("opts."+k),vals,{cols:k==="property"||k==="community"?4:3})}</details>`).join("")}`,{id:"pf-ken"})}
  ${sec(["Teksten","Texts"],`<div class="seg ad-seg sm">${["nl","en","es"].map(l=>`<button data-tx="${l}" class="${txLang===l?"on":""}">${l.toUpperCase()}${txOk(p,l)?" ✓":""}</button>`).join("")}</div>
     ${row(inp(B(`texts.${txLang}.heading`),["Kop","Heading"],{w:4,req:txLang==="es"?"":"pub",ph:["bijv. Vrijstaande villa met privézwembad in Benimar","e.g. Detached villa with private pool in Benimar"]}))}
     ${row(area(B(`texts.${txLang}.description`),["Omschrijving","Description"],{rows:8,req:txLang==="es"?"":"pub"}))}
     ${row(area(B(`texts.${txLang}.key_details`),["Kernpunten (één per regel)","Key details (one per line)"],{rows:3}))}
     ${row(area(B("internal_notes"),["Interne notities (bijv. wie de sleutelhouder is)","Internal notes (e.g. who holds the keys)"],{rows:3,hint:["Alleen intern, nooit op de site","Internal only, never on the site"]}))}
     ${row(inp(B(`texts.${txLang}.seo_title`),["SEO-titel","SEO title"],{w:2,hint:["max. ±60 tekens","max ±60 characters"]}),inp(B(`texts.${txLang}.seo_description`),["SEO-omschrijving","SEO description"],{w:2,hint:["max. ±155 tekens","max ±155 characters"]}))}
     <small class="muted">${esc(tr(["NL en EN zijn nodig voor de site en de Kyero-feed naar partners; ES is optioneel.","NL and EN are needed for the site and the Kyero feed to partners; ES is optional."]))}</small>`,{id:"pf-tekst"})}
  ${sec(["Foto's en media","Photos and media"],`<div class="ad-drop" data-media="${base}"><input type="file" multiple accept="image/*,application/pdf" hidden>
       <div><b>${esc(tr(["Sleep foto's hierheen of klik om te kiezen","Drop photos here or click to choose"]))}</b><div class="sm muted">${esc(tr(["JPG/PNG/WebP, ook plattegronden en PDF (energiecertificaat). Eerste foto = hoofdfoto. Volgorde aanpassen door te slepen.","JPG/PNG/WebP, also floor plans and PDF (energy certificate). First photo = main photo. Drag to reorder."]))}</div></div></div>
     <div class="ad-media" id="adMedia-${base}"></div>
     <small class="muted">${esc(tr(["Foto's blijven alleen in dit venster; ze worden pas geüpload naar Supabase Storage (bucket property-media) na koppeling.","Photos stay in this window only; they are uploaded to Supabase Storage (bucket property-media) once connected."]))}</small>
     ${row(inp(B("video_url"),["Video-URL","Video URL"],{w:2,ph:"https://"}),inp(B("tour_360_url"),["360°/3D-link (vistafoto.eu)","360°/3D link (vistafoto.eu)"],{w:2,ph:"https://"}))}`,{id:"pf-media"})}
  ${sec(["Kosten en kadaster","Costs and land registry"],`<div class="ad-cols3"><div><h5>${esc(tr(["Vaste lasten per jaar (€)","Running costs per year (€)"]))}</h5>
       ${inp(B("cost_community"),["Gemeenschapskosten","Community fees"],{type:"number",min:0})}${inp(B("cost_garbage"),["Afvalheffing","Garbage fee"],{type:"number",min:0})}
       ${inp(B("cost_ibi"),["IBI (onroerendgoedbelasting)","IBI (property tax)"],{type:"number",min:0})}${inp(B("cost_insurance"),["Opstalverzekering","Home insurance"],{type:"number",min:0})}</div>
     <div><h5>${esc(tr(["Kosten koper (€)","Buyer costs (€)"]))}</h5>${inp(B("fee_transfer_tax"),["Overdrachtsbelasting (ITP)","Transfer tax (ITP)"],{type:"number",min:0})}
       ${inp(B("fee_notary"),["Notaris","Notary"],{type:"number",min:0})}${inp(B("fee_registry"),["Registro","Registry"],{type:"number",min:0})}${inp(B("fee_legal"),["Advocaat","Legal"],{type:"number",min:0})}</div>
     <div><h5>${esc(tr(["Eigendomsakte","Title deed"]))}</h5>${inp(B("registry_name"),["Registro de la Propiedad","Land registry"])}${inp(B("finca_number"),["Fincanummer","Finca number"])}
       ${inp(B("cadastral_ref"),["Kadastrale referentie","Cadastre number"],{hint:["20 tekens; vult de Catastro-verrijking","20 characters; feeds the Catastro enrichment"]})}</div></div>
     <div class="ad-note sm">${esc(tr(["Hypotheek, aktewaarde, verkoopprijs, notarisdatum en commissies staan hier bewust niet: volgens het migratieplan gaan transacties en commissies niet in Supabase (besluit nog open).","Mortgage, deed value, sale price, notary date and commissions are deliberately left out: per the migration plan, transactions and commissions do not go into Supabase (decision still open)."]))}</div>`,{id:"pf-kost"})}
  ${sec(["Publicatie","Publishing"],`<div class="ad-multi c3">${chk(B("published"),["Publiceren op de website","Publish on website"])}${chk(B("no_export"),["Uitsluiten van XML-feeds","Exclude from XML feeds"])}</div>
     <div class="ad-f w4"><span>${esc(tr(["Labels","Labels"]))}</span>${multi(B("labels"),[["new","NEW"],["exclusive","EXCLUSIVE"],["premium","PREMIUM"],["bargain","BARGAIN"],["featured",["Uitgelicht","Featured"]]],{cols:5})}</div>
     <div class="ad-f w4"><span>${esc(tr(["Exportfeeds","Export feeds"]))}</span>${multi(B("export_feeds"),[["idealista","Idealista"]],{cols:4})}</div>
     ${row(sel(B("search_rank"),["Zoekrangschikking","Search ranking"],RANK,{empty:false}))}`,{id:"pf-pub"})}`;
}
const txOk=(p,l)=>!!(p.texts[l]&&p.texts[l].heading&&p.texts[l].description);

/* ================= STAP 4 · CONTROLE ================= */
function stepReview(){
  const v=validate("wizard"), save=v.filter(x=>x.level==="save"), pub=v.filter(x=>x.level==="pub");
  const c=S.contactMode==="existing"?S.existing:S.c, p=S.p;
  const name=S.contactMode==="existing"?(c&&c.name):[S.c.first_name,S.c.last_name].filter(Boolean).join(" ")||S.c.company;
  return `<div class="ad-intro"><h2>${esc(tr(["Controle","Review"]))}</h2><p class="muted">${esc(tr(["Zo komt het in het nieuwe schema terecht. Opslaan wordt aangezet na akkoord.","This is how it lands in the new schema. Saving is switched on after approval."]))}</p></div>
  <div class="ad-sum">
   <div class="ad-sumcard"><h5>${esc(tr(["Aanbrenger","Introducer"]))}</h5>${S.agentMode==="none"?`<span class="muted">${esc(tr(["Niet aangebracht","Not introduced"]))}</span>${S.c.referred_by?" · "+esc(S.c.referred_by):""}`
     :S.agentMode==="existing"?(S.agent?`<b>${esc(S.agent.name||S.agent.email)}</b> <span class="sm muted">WP ${esc(S.agent.wp_id)}</span>`:`<span class="ad-bad">${esc(tr(["nog niet gekozen","not chosen yet"]))}</span>`)
     :`<b>${esc(S.newAgent.company||"—")}</b> <span class="tag">${esc(tr(["nieuw","new"]))}</span>`}</div>
   <div class="ad-sumcard"><h5>Contact</h5><b>${esc(name||"—")}</b> ${S.contactMode==="existing"?`<span class="tag">${esc(tr(["bestaand","existing"]))}</span>`:`<span class="tag">${esc(tr(["nieuw","new"]))}</span>`}
     <div class="ad-chips" style="margin-top:6px">${S.c.roles.map(r=>{const x=ROLES.find(y=>y[0]===r);return `<span class="role" style="--rc:var(${x[2]})">${esc(tr(x[1]))}</span>`}).join("")}</div></div>
   <div class="ad-sumcard"><h5>${esc(tr(["Woning","Property"]))}</h5>${pm()==="now"?`<b>${esc(p.reference||"—")}</b> · ${esc((CATS.find(x=>x[0]===p.category)||[,""])[1]&&tr(CATS.find(x=>x[0]===p.category)[1]))} · ${p.price?"€ "+Number(p.price).toLocaleString("nl-NL"):"—"}<div class="sm muted">${esc([p.area==="__new"?p.area_new:p.area==="__mun"?"":p.area,p.municipality].filter(Boolean).join(", "))} · ${MEDIA.length} ${esc(tr(["bestanden","files"]))}</div>`
     :pm()==="link"?(S.linkProp?`<b>${esc(S.linkProp.reference)}</b> · ${esc(tr((RELS.find(r=>r[0]===S.linkRel)||RELS[0])[1]))}`:`<span class="ad-bad">${esc(tr(["nog niet gekozen","not chosen yet"]))}</span>`)
     :`<span class="muted">${esc(tr(pm()==="later"?["Later toevoegen","Add later"]:["Geen woning","No property"]))}</span>`}</div></div>
  ${sec(["Status","Status"],`<div class="ad-verdict ${save.length?"bad":pub.length?"warn":"ok"}">${save.length?esc(tr([`${save.length} verplicht veld(en) ontbreken: opslaan zou niet lukken.`,`${save.length} required field(s) missing: saving would fail.`]))
     :pub.length?esc(tr([`Opslaan kan; voor publicatie ontbreken nog ${pub.length} veld(en).`,`Could be saved; ${pub.length} field(s) still missing to publish.`])):esc(tr(["Alles compleet.","Everything complete."]))}</div>`)}
  ${sec(["Wat er geschreven wordt (core-schema)","What would be written (core schema)"],`<pre class="code ad-json">${esc(JSON.stringify(payload("wizard"),null,2))}</pre>`,{aside:`<button class="btn sm" id="adCopyJson">${esc(tr(["Kopieer JSON","Copy JSON"]))}</button>`})}`;
}
function wizard(){return S.step===1?stepAgent():S.step===2?stepContact():S.step===3?stepProp():stepReview()}

/* ================= LOS: WONING TOEVOEGEN ================= */
function propFlow(){return `<div class="ad-intro"><h2>${esc(tr(["Woning toevoegen","Add property"]))}</h2><p class="muted">${esc(tr(["Nieuwe eigen woning, met of zonder eigenaar. De eigenaar kun je ook later koppelen.","New own property, with or without an owner. You can also link the owner later."]))}</p></div>
  ${sec(["Eigenaar / verkoper","Owner / seller"],`${S.wp.owner?pickedCard(S.wp.owner,"wpOwner"):""}<input class="ad-search" id="adOwnQ" type="search" placeholder="${esc(tr(["Zoek eigenaar (naam, e-mail, telefoon) — optioneel","Find owner (name, e-mail, phone) — optional"]))}"><div id="adOwnRes" class="ad-res"></div>`)}
  ${propForm("wp.p",WP_MEDIA)}`}

/* ================= LOS: KOPPELEN ================= */
function linkFlow(){const k=S.lk;
  return `<div class="ad-intro"><h2>${esc(tr(["Contact en woning koppelen","Link contact and property"]))}</h2><p class="muted">${esc(tr(["Leg achteraf een verband tussen een bestaand contact en een bestaande woning.","Connect an existing contact and an existing property after the fact."]))}</p></div>
  <div class="ad-two">${sec(["Contact","Contact"],`${k.contact?pickedCard(k.contact,"lkContact"):""}<input class="ad-search" id="adLkCQ" type="search" placeholder="${esc(tr(["Naam, e-mail of telefoon","Name, e-mail or phone"]))}"><div id="adLkCRes" class="ad-res"></div>`)}
  ${sec(["Woning","Property"],`${k.prop?propPicked(k.prop,"lkProp"):""}<input class="ad-search" id="adLkPQ" type="search" placeholder="${esc(tr(["Referentie of plaats","Reference or town"]))}"><div id="adLkPRes" class="ad-res ad-pres"></div>`)}</div>
  ${sec(["Verband","Relation"],row(sel("lk.rel",["Rol van het contact","Contact's role"],RELS,{empty:false}))
    +(k.contact&&k.prop?`<div class="ad-note">${esc(tr(["Wordt:","Will become:"]))} <b>${esc(k.contact.name||k.contact.email)}</b> → <b>${esc(tr(RELS.find(r=>r[0]===k.rel)[1]))}</b> → <b>${esc(k.prop.reference)}</b>${k.prop.owner&&k.rel==="owner"?` <span class="ad-bad">· ${esc(tr(["huidige eigenaar","current owner"]))}: ${esc(k.prop.owner)} ${esc(tr(["wordt vervangen","will be replaced"]))}</span>`:""}</div>`:""))}`}

/* ================= VALIDATIE ================= */
const emailOk=e=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
function validateProp(p,media,stepNo,out){
  const add=(msg,level,jump)=>out.push({msg:tr(msg),level,step:stepNo,jump});
  if(!p.category)add(["Woningtype kiezen","Choose property type"],"save","pf-basis");
  if(!p.reference)add(["Referentie invullen","Enter reference"],"save","pf-basis");
  else if(!/^[A-Z]{2,3}\d{1,5}$/.test(p.reference))add(["Referentie: 2–3 hoofdletters + nummer (bijv. RH995)","Reference: 2–3 capitals + number (e.g. RH995)"],"save","pf-basis");
  if(!p.listing_agent)add(["Verantwoordelijke makelaar kiezen","Choose listing agent"],"save","pf-basis");
  if(!p.price&&!p.price_on_request)add(["Vraagprijs (of ‘prijs op aanvraag’)","Asking price (or ‘price on request’)"],"save","pf-prijs");
  if(!p.municipality)add(["Gemeente kiezen","Choose municipality"],"save","pf-loc");
  if(!p.area)add(["Wijk kiezen (of ‘gemeente zelf’)","Choose area (or ‘municipality itself’)"],"save","pf-loc");
  if(p.area==="__new"&&!p.area_new)add(["Naam nieuwe wijk invullen","Enter new area name"],"save","pf-loc");
  if(p.bedrooms==="")add(["Aantal slaapkamers","Number of bedrooms"],"save","pf-ind");
  if(p.bathrooms==="")add(["Aantal badkamers","Number of bathrooms"],"save","pf-ind");
  if(!p.build_area&&p.category!=="plot")add(["Bebouwde oppervlakte","Building area"],"save","pf-ind");
  if(p.lat===""||p.lng==="")add(["Locatie op de kaart","Location on the map"],"pub","pf-loc");
  if(!p.energy_label&&p.category!=="plot")add(["Energielabel","Energy label"],"pub","pf-ind");
  if(!txOk(p,"nl"))add(["Kop + omschrijving NL","Heading + description NL"],"pub","pf-tekst");
  if(!txOk(p,"en"))add(["Kop + omschrijving EN","Heading + description EN"],"pub","pf-tekst");
  const photos=media.filter(m=>m.kind==="photo").length;
  if(photos<1)add(["Minstens één foto","At least one photo"],"pub","pf-media");
  else if(photos<5)add(["Minder dan 5 foto's","Fewer than 5 photos"],"tip","pf-media");
  if(p.cadastral_ref&&!/^[0-9A-Z]{20}$/i.test(p.cadastral_ref.replace(/\s/g,"")))add(["Kadastrale referentie heeft 20 tekens","Cadastral reference has 20 characters"],"tip","pf-kost");
}
function validate(flow){
  const out=[], add=(msg,level,step,jump)=>out.push({msg:tr(msg),level,step,jump});
  if(flow==="wizard"){
    if(S.agentMode==="existing"&&!S.agent)add(["Makelaar kiezen of ‘niet aangebracht’","Pick agent or ‘not introduced’"],"save",1);
    if(S.agentMode==="new"){if(!S.newAgent.company)add(["Kantoornaam nieuwe makelaar","Office name of new agent"],"save",1);
      if(!S.newAgent.email&&!S.newAgent.phone)add(["E-mail of telefoon nieuwe makelaar","E-mail or phone of new agent"],"save",1);
      else if(S.newAgent.email&&!emailOk(S.newAgent.email))add(["E-mail makelaar ongeldig","Agent e-mail invalid"],"save",1)}
    if(S.contactMode==="existing"){if(!S.existing)add(["Bestaand contact kiezen","Pick existing contact"],"save",2)}
    else{const c=S.c;
      if(!c.roles.length)add(["Minstens één label","At least one label"],"save",2);
      if(!c.first_name&&!c.company)add(["Voornaam of bedrijf","First name or company"],"save",2);
      const em=c.emails.map(e=>e.email.trim()).filter(Boolean), ph=c.phones.map(p=>p.phone.replace(/\D/g,"")).filter(x=>x.length>=6);
      if(!em.length&&!ph.length)add(["E-mail of telefoon","E-mail or phone"],"save",2);
      em.filter(e=>!emailOk(e)).forEach(e=>add([`Ongeldig e-mailadres: ${e}`,`Invalid e-mail: ${e}`],"save",2));
      if(!c.language)add(["Correspondentietaal","Correspondence language"],"save",2);
      if(!c.owner)add(["Verantwoordelijk teamlid","Responsible team member"],"save",2);
      if(c.phones.some(p=>p.phone&&!/^\+/.test(p.phone.trim())))add(["Telefoon zonder landcode (+34, +31 …)","Phone without country code (+34, +31 …)"],"tip",2);
      if(DUPS.length)add([`${DUPS.length} mogelijk dubbel contact`,`${DUPS.length} possible duplicate contact(s)`],"tip",2)}
    if(isSeller()&&pm()==="none")add(["Verkoper zonder woning: kies ‘later’ of maak hem aan","Seller without property: choose ‘later’ or create it"],"tip",3);
    if(isSeller()&&pm()==="link"&&!S.linkProp)add(["Woning kiezen om te koppelen","Pick property to link"],"save",3);
    if(isSeller()&&pm()==="now")validateProp(S.p,MEDIA,3,out);
  }else if(flow==="prop"){validateProp(S.wp.p,WP_MEDIA,0,out);if(!S.wp.owner)out.push({msg:tr(["Geen eigenaar gekoppeld (kan later)","No owner linked (can be done later)"]),level:"tip",step:0})}
  else{if(!S.lk.contact)add(["Contact kiezen","Pick contact"],"save",0);if(!S.lk.prop)add(["Woning kiezen","Pick property"],"save",0)}
  return out;
}
function stepDone(n){return n<4&&S.flow==="wizard"&&!validate("wizard").some(x=>x.step===n&&x.level==="save")}
function updateChecks(){
  const box=ROOT.querySelector("#adChecks");if(!box)return;
  const v=validate(S.flow);
  const grp=(lvl,title,cls)=>{const l=v.filter(x=>x.level===lvl);return l.length?`<div class="ad-chk ${cls}"><h5>${esc(tr(title))} <b>${l.length}</b></h5>${l.map(x=>`<a ${x.step?`data-step="${x.step}"`:""} ${x.jump?`data-jump="${x.jump}"`:""}>${S.flow==="wizard"&&x.step?`<i>${x.step}</i>`:""}${esc(x.msg)}</a>`).join("")}</div>`:""};
  box.innerHTML=(v.filter(x=>x.level!=="tip").length?"":`<div class="ad-chk ok"><h5>✓ ${esc(tr(["Compleet","Complete"]))}</h5></div>`)
    +grp("save",["Verplicht om op te slaan","Required to save"],"bad")+grp("pub",["Nodig om te publiceren","Needed to publish"],"warn")+grp("tip",["Aandachtspunten","Points of attention"],"tip")
    +(DUPS.length&&S.flow==="wizard"?`<div class="ad-chk tip"><h5>${esc(tr(["Mogelijk al in NEXUS","Possibly already in NEXUS"]))}</h5>${DUPS.map(d=>`<a data-usedup="${d.wp_id}">${esc(d.name||d.email)}<span class="sm muted"> · ${esc(d.why)}</span></a>`).join("")}</div>`:"");
  ROOT.querySelectorAll(".ad-step").forEach(b=>b.classList.toggle("ok",stepDone(+b.dataset.step)));
}

/* ================= PAYLOAD (voorbeeld van de schrijfactie) ================= */
const n=v=>v===""||v==null?null:Number(v);
const teamName=wp=>{const t=TEAM.find(x=>String(x.wp)===String(wp));return t?`← team ${t.name}`:(wp?`← team wp ${wp}`:null)};
function propPayload(p,media,owner){
  const opts={};Object.entries(p.opts||{}).forEach(([k,v])=>{if(v&&v.length)opts[k]=v});
  return {"core.properties":{reference:p.reference||null,origin:"own",internal_notes:p.internal_notes||null,own_listing_type:p.own_listing_type,status:p.status,published:!!p.published,category:p.category||null,build_type:p.build_type,
    price:n(p.price),price_previous:n(p.price_original),price_from:p.price_from,price_on_request:p.price_on_request,price_fixed:p.price_fixed,price_hidden:p.price_hidden,
    bedrooms:n(p.bedrooms),bathrooms:n(p.bathrooms),toilets:n(p.toilets),ensuites:n(p.ensuites),living_rooms:n(p.living_rooms),kitchens:n(p.kitchens),floors:n(p.floors),floor_level:p.floor_level||null,
    balconies:n(p.balconies),terraces:n(p.terraces),patios:n(p.patios),garages:n(p.garages),carports:n(p.carports),build_area:n(p.build_area),plot_area:n(p.plot_area),
    area_living:n(p.area_living),area_terrace:n(p.area_terrace),area_garden:n(p.area_garden),area_kitchen:n(p.area_kitchen),year_built:n(p.year_built),orientation:p.orientation||null,
    views:(p.views||[]).join(",")||null,energy_label:p.energy_label||null,features:p.features,feature_options:opts,
    country:p.country||null,province:p.province||null,city:p.municipality||null,location_area:p.area==="__new"?p.area_new:p.area==="__mun"?null:p.area||null,
    location_id:"← core.locations (gemeente/wijk)",street:p.street||null,street_number:p.street_number||null,postal_code:p.postal_code||null,lat:n(p.lat),lng:n(p.lng),hide_address:p.hide_address,
    distance_sea_m:n(p.distance_sea_m),distance_airport_m:n(p.distance_airport_m),distance_city_m:n(p.distance_city_m),distance_shops_m:n(p.distance_shops_m),
    fee_legal:n(p.fee_legal),fee_notary:n(p.fee_notary),fee_registry:n(p.fee_registry),fee_transfer_tax:n(p.fee_transfer_tax),cost_community:n(p.cost_community),cost_ibi:n(p.cost_ibi),
    cost_garbage:n(p.cost_garbage),cost_insurance:n(p.cost_insurance),cadastral_ref:p.cadastral_ref||null,finca_number:p.finca_number||null,labels:p.labels,export_feeds:p.export_feeds,
    no_export:p.no_export,video_url:p.video_url||null,tour_360_url:p.tour_360_url||null,owner_contact_id:owner,listing_agent_id:teamName(p.listing_agent),listed_at:p.listed_at||null},
   "core.property_texts":["nl","en","es"].filter(l=>Object.values(p.texts[l]).some(Boolean)).map(l=>Object.assign({lang:l},p.texts[l])),
   "core.property_price_history":p.price?[{price:n(p.price),source:"nexus"}]:[],
   "core.property_media":media.map((m,i)=>({kind:m.kind,sort:i,is_main:i===0,caption:m.caption||null,storage_path:`property-media/<property_id>/<media_id>.${(m.name.split(".").pop()||"jpg").toLowerCase()}`,file:m.name,bytes:m.size})),
   "_nog_geen_kolom":Object.fromEntries(Object.entries({price_text:p.price_text,price_temp:p.price_temp,price_temp_until:p.price_temp_until,price_coming_soon:p.price_coming_soon||null,
     dossier_complete:p.dossier_complete||null,utility_rooms:p.utility_rooms,parking_open:p.parking_open,staircases:p.staircases,energy_rating:p.energy_rating,registry_name:p.registry_name,
     show_street:p.show_street||null,search_rank:p.search_rank!=="normal"?p.search_rank:null}).filter(([,v])=>v!==""&&v!=null))};
}
function payload(flow){
  if(flow!=="wizard")return {};
  const c=S.c, out={};
  if(S.agentMode==="new")out["core.contacts (makelaar)"]={company:S.newAgent.company,first_name:S.newAgent.first_name||null,last_name:S.newAgent.last_name||null,language:S.newAgent.language,website:S.newAgent.website||null,
    emails:S.newAgent.email?[S.newAgent.email]:[],phones:S.newAgent.phone?[S.newAgent.phone]:[],roles:["agent"],source:"nexus"};
  if(S.contactMode==="existing")out["core.contacts"]={bestaand:S.existing?`legacy_map contact wp_id ${S.existing.wp_id}`:null,roles_toevoegen:c.roles};
  else{out["core.contacts"]={title:c.title||null,first_name:c.first_name||null,last_name:c.last_name||null,company:c.company||null,language:c.language||null,country:c.country||null,state:c.state||null,
      city:c.city||null,postcode:c.postcode||null,street:c.street||null,street_number:c.street_number||null,birthday:c.birthday||null,website:c.website||null,referred_by:c.referred_by||null,
      owner_id:teamName(c.owner),keyholder:!!c.keyholder,mailing_optin:c.mailing_optin,mailing_prefs:Object.fromEntries(MAILINGS.map(([k])=>[k,{on:!!c.mailing_optin&&(c.prefs||[]).includes(k)}])),
      search_profile:Object.fromEntries(Object.entries(c.search).filter(([,v])=>Array.isArray(v)?v.length:v)),internal_comments:c.internal_comments||null,source:c.source?"nexus:"+c.source:"nexus"};
    out["core.contact_emails"]=c.emails.filter(e=>e.email).map((e,i)=>({email:e.email.trim().toLowerCase(),kind:e.kind||null,is_primary:i===0}));
    out["core.contact_phones"]=c.phones.filter(p=>p.phone).map((p,i)=>({phone:p.phone.trim(),kind:p.kind,is_primary:i===0}));
    out["core.contact_roles"]=c.roles.map(r=>({role:r}));}
  if(S.agentMode!=="none")out["core.contact_relations"]=[{relation:"introduced_by",related_contact:S.agentMode==="existing"?(S.agent?`wp_id ${S.agent.wp_id}`:null):"← nieuwe makelaar"}];
  if(pm()==="now")Object.assign(out,propPayload(S.p,MEDIA,"← dit contact"));
  if(pm()==="link"&&S.linkProp)out["koppeling"]={property:S.linkProp.reference,relation:S.linkRel,
    schrijft:{owner:"core.properties.owner_contact_id",buyer:"core.properties.buyer_contact_id",interest:"core.property_interests",agency:"core.properties.agency_contact_id"}[S.linkRel]};
  out["core.audit_log"]={actor:X&&X.me()?X.me().email:null,action:"insert"};
  return out;
}

/* ================= ZOEKEN (alleen-lezen via bestaande RPC's) ================= */
let DUPS=[], dupT;
async function searchContacts(q,role){if(!q||q.trim().length<2)return[];try{const r=await X.rpc("nexus_search",{p_q:q.trim(),p_role:role||null,p_scope:"all",p_limit:8,p_offset:0});return r.rows||[]}catch(e){return[]}}
async function searchProps(q){if(!q||q.trim().length<2)return[];try{const r=await X.rpc("nexus_properties",{p_q:q.trim(),p_status:"",p_limit:8,p_offset:0});return r.rows||[]}catch(e){return[]}}
const resRow=c=>`<button class="ad-hit" data-pick='${esc(JSON.stringify({wp_id:c.wp_id,name:c.name,email:c.email,city:c.city,roles:c.roles}))}'>
  <div class="ini" style="background:hsl(${[...String(c.name||c.email||"")].reduce((h,ch)=>(h*31+ch.charCodeAt(0))%360,0)} 55% 42%)">${esc(((c.name||c.email||"?")[0]||"?").toUpperCase())}</div>
  <div style="min-width:0"><b>${esc(c.name||c.email||"—")}</b><div class="sm muted">${(c.roles||[]).map(r=>esc(r)).join(", ")} ${esc([c.email,c.city].filter(Boolean).join(" · "))}</div></div><span class="sm muted">WP ${esc(c.wp_id)}</span></button>`;
const propRow=p=>`<button class="ad-hit" data-pickp='${esc(JSON.stringify({wp_id:p.wp_id,reference:p.reference,price:p.price,town:p.town,suburb:p.suburb,image:p.image,owner:p.owner,owner_wp_id:p.owner_wp_id}))}'>
  <div class="th" style="${p.image?`background-image:url('${esc(p.image)}')`:""}"></div><div style="min-width:0"><b>${esc(p.reference)} · ${p.price?"€ "+Number(p.price).toLocaleString("nl-NL"):"—"}</b>
  <div class="sm muted">${esc([p.suburb,p.town].filter(Boolean).join(", "))}${p.owner?" · 👤 "+esc(p.owner):""}${p.is_external?" · "+esc(p.agency||"extern"):""}</div></div></button>`;
function liveSearch(inputSel,resSel,fn,rowFn,onPick,attr){
  const i=ROOT.querySelector(inputSel), box=ROOT.querySelector(resSel);if(!i||!box)return;let T;
  i.addEventListener("input",()=>{clearTimeout(T);T=setTimeout(async()=>{const rows=await fn(i.value);
    box.innerHTML=rows.length?rows.map(rowFn).join(""):(i.value.trim().length>=2?`<div class="empty sm">${esc(tr(["Niets gevonden","Nothing found"]))}</div>`:"");
    box.querySelectorAll(`[${attr}]`).forEach(b=>b.onclick=()=>{onPick(JSON.parse(b.getAttribute(attr)));persist();render()})},260)});
}
async function checkDups(){
  if(S.flow!=="wizard"||S.contactMode!=="new")return;
  const qs=[...S.c.emails.map(e=>e.email.trim()).filter(e=>emailOk(e)),...S.c.phones.map(p=>p.phone.replace(/\D/g,"")).filter(x=>x.length>=8).map(x=>x.slice(-9))];
  const nm=[S.c.first_name,S.c.last_name].filter(Boolean).join(" ").trim();if(S.c.last_name&&nm.length>=5)qs.push(nm);
  const found={};
  for(const q of qs){for(const r of await searchContacts(q)){if(!found[r.wp_id])found[r.wp_id]=Object.assign({},r,{why:q.includes("@")?"e-mail":/^\d+$/.test(q)?tr(["telefoon","phone"]):tr(["naam","name"])})}}
  DUPS=Object.values(found).slice(0,5);
  const box=ROOT.querySelector("#adDup");
  if(box)box.innerHTML=DUPS.length?`<div class="ad-warnbox"><b>${esc(tr(["Dit contact bestaat mogelijk al","This contact may already exist"]))}</b>${DUPS.map(d=>`<div class="ad-duprow"><span>${esc(d.name||d.email)} <span class="sm muted">· ${esc(d.why)} · ${esc((d.roles||[]).join(", "))}</span></span><button class="btn sm" data-usedup="${d.wp_id}">${esc(tr(["Gebruik dit contact","Use this contact"]))}</button></div>`).join("")}</div>`:"";
  updateChecks();
}
async function checkRef(base){const p=getP(S,base);const box=ROOT.querySelector("#adRefCheck");if(!box)return;
  if(!/^[A-Z]{2,3}\d{1,5}$/.test(p.reference||"")){box.innerHTML="";return}
  const rows=await searchProps(p.reference);const hit=rows.find(r=>String(r.reference).toUpperCase()===p.reference);
  box.innerHTML=hit?`<span class="ad-bad">⚠ ${esc(tr([`Referentie ${p.reference} bestaat al`,`Reference ${p.reference} already exists`]))} (${esc([hit.suburb,hit.town].filter(Boolean).join(", "))})</span>`:`<span style="color:#34d399">✓ ${esc(tr(["Referentie is vrij","Reference is free"]))}</span>`}

/* ================= KAART ================= */
let MAP=null, PIN=null;
function initMap(){
  const el=ROOT.querySelector("#adMap");if(!el||!window.L)return;const base=el.dataset.base, p=getP(S,base);
  if(MAP){MAP.remove();MAP=null}
  const has=p.lat!==""&&p.lng!=="";
  MAP=L.map(el,{scrollWheelZoom:false}).setView(has?[+p.lat,+p.lng]:[38.075,-0.73],has?17:12);
  const osm=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap"}).addTo(MAP);
  const sat=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,attribution:"Esri"});
  L.control.layers({[tr(["Kaart","Map"])]:osm,[tr(["Satelliet","Satellite"])]:sat}).addTo(MAP);
  const place=(lat,lng,fly)=>{lat=+(+lat).toFixed(6);lng=+(+lng).toFixed(6);setP(S,base+".lat",String(lat));setP(S,base+".lng",String(lng));
    if(!PIN||!MAP.hasLayer(PIN)){PIN=L.marker([lat,lng],{draggable:true}).addTo(MAP);PIN.on("dragend",e=>{const ll=e.target.getLatLng();place(ll.lat,ll.lng)})}else PIN.setLatLng([lat,lng]);
    ROOT.querySelectorAll(`[data-k="${base}.lat"]`).forEach(x=>x.value=lat);ROOT.querySelectorAll(`[data-k="${base}.lng"]`).forEach(x=>x.value=lng);
    if(fly)MAP.setView([lat,lng],17);persist();updateChecks()};
  PIN=null;if(has)place(p.lat,p.lng);
  MAP.on("click",e=>place(e.latlng.lat,e.latlng.lng));
  MAP._place=place;setTimeout(()=>MAP&&MAP.invalidateSize(),60);
  const q=ROOT.querySelector("#adGeoQ"), go=async()=>{const v=q.value.trim();if(!v)return;
    let m=v.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/)||v.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)||v.match(/query=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if(m)return place(m[1],m[2],true);
    try{const r=await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=es&q="+encodeURIComponent(v));const j=await r.json();
      if(j[0])place(j[0].lat,j[0].lon,true);else q.value=v+"  ✗"}catch(e){}};
  ROOT.querySelector("#adGeoBtn").onclick=e=>{e.preventDefault();go()};q.onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();go()}};
}

/* ================= MEDIA ================= */
const mediaOf=base=>base==="p"?MEDIA:WP_MEDIA;
function wireDrop(d){const base=d.dataset.media, f=d.querySelector("input[type=file]");
  d.onclick=e=>{if(e.target===d||e.target.closest("div"))f.click()};
  d.ondragover=e=>{e.preventDefault();d.classList.add("over")};d.ondragleave=()=>d.classList.remove("over");
  d.ondrop=e=>{e.preventDefault();d.classList.remove("over");addFiles(base,e.dataTransfer.files)};
  f.onchange=()=>{addFiles(base,f.files);f.value=""}}
function addFiles(base,files){const arr=mediaOf(base);
  [...files].forEach(file=>{if(!/^image\/|^application\/pdf$/.test(file.type))return;
    arr.push({id:Math.random().toString(36).slice(2),name:file.name,size:file.size,type:file.type,url:file.type.startsWith("image/")?URL.createObjectURL(file):null,
      kind:file.type==="application/pdf"?"energy_certificate":/plan|plano|floor/i.test(file.name)?"floorplan":"photo",caption:""})});
  renderMedia();updateChecks()}
function renderMedia(){[["p",MEDIA],["wp.p",WP_MEDIA]].forEach(([base,arr])=>{const box=ROOT.querySelector(`#adMedia-${CSS.escape(base)}`);if(!box)return;
  const kinds=[["photo",["Foto","Photo"]],["floorplan",["Plattegrond","Floor plan"]],["document",["Document","Document"]],["energy_certificate",["Energiecertificaat","Energy certificate"]]];
  box.innerHTML=arr.map((m,i)=>`<div class="ad-mi ${i===0&&m.kind==="photo"?"main":""}" draggable="true" data-mi="${i}" data-mb="${base}">
    <div class="im" style="${m.url?`background-image:url('${m.url}')`:""}">${m.url?"":"PDF"}${i===0&&m.kind==="photo"?`<span>${esc(tr(["Hoofdfoto","Main"]))}</span>`:""}</div>
    <select data-mk="${i}">${kinds.map(k=>`<option value="${k[0]}" ${m.kind===k[0]?"selected":""}>${esc(tr(k[1]))}</option>`).join("")}</select>
    <input data-mc="${i}" placeholder="${esc(tr(["Bijschrift","Caption"]))}" value="${esc(m.caption)}">
    <div class="ad-mibtn">${i?`<button data-mmain="${i}" title="${esc(tr(["Maak hoofdfoto","Make main"]))}">★</button>`:""}<button data-mdel="${i}" title="×">🗑</button></div>
    <small class="muted">${esc(m.name)} · ${(m.size/1048576).toFixed(1)} MB</small></div>`).join("")||"";
  box.querySelectorAll("[data-mk]").forEach(s=>s.onchange=()=>{arr[+s.dataset.mk].kind=s.value;renderMedia();updateChecks()});
  box.querySelectorAll("[data-mc]").forEach(s=>s.oninput=()=>{arr[+s.dataset.mc].caption=s.value});
  box.querySelectorAll("[data-mdel]").forEach(b=>b.onclick=()=>{const m=arr.splice(+b.dataset.mdel,1)[0];if(m.url)URL.revokeObjectURL(m.url);renderMedia();updateChecks()});
  box.querySelectorAll("[data-mmain]").forEach(b=>b.onclick=()=>{const m=arr.splice(+b.dataset.mmain,1)[0];arr.unshift(m);renderMedia()});
  let from=null;box.querySelectorAll(".ad-mi").forEach(el=>{el.ondragstart=()=>{from=+el.dataset.mi;el.classList.add("drag")};el.ondragend=()=>el.classList.remove("drag");
    el.ondragover=e=>e.preventDefault();el.ondrop=e=>{e.preventDefault();e.stopPropagation();const to=+el.dataset.mi;if(from==null||from===to)return;const m=arr.splice(from,1)[0];arr.splice(to,0,m);renderMedia()}});
});}

/* ================= EVENTS ================= */
function bind(){
  ROOT.addEventListener("input",e=>{const el=e.target, k=el.dataset&&el.dataset.k;if(!k)return;
    if(el.dataset.arr!=null){const a=getP(S,k)||[];const v=el.dataset.arr;const nx=el.checked?[...new Set([...a,v])]:a.filter(x=>x!==v);setP(S,k,nx);
      const ch=el.closest(".chip");if(ch)ch.classList.toggle("on",el.checked);
      if(k==="c.roles"&&S.flow==="wizard"&&S.step===2){persist();render();return}
      if(k==="c.prefs"||/\.opts\./.test(k)){const d=el.closest("details");if(d){const s=d.querySelector("summary .sm");if(s)s.textContent=(getP(S,k)||[]).length||""}}}
    else if(el.dataset.bool!=null){setP(S,k,el.checked);if(k==="c.mailing_optin"){const cur=(S.c.prefs||[]).filter(x=>MAILINGS.some(m=>m[0]===x));S.c.prefs=el.checked&&!cur.length?[...MAILING_DEFAULT_ON]:cur;persist();render();return}}
    else{let v=el.value;if(/\.reference$/.test(k)){v=v.toUpperCase().replace(/\s/g,"");if(el.value!==v)el.value=v}setP(S,k,v)}
    if(/\.(municipality|area)$/.test(k)){if(/municipality$/.test(k))setP(S,k.replace(/municipality$/,"area"),"");persist();render();return}
    if(/\.(lat|lng)$/.test(k)&&MAP&&MAP._place){const b=k.replace(/\.(lat|lng)$/,""),p=getP(S,b);if(p.lat!==""&&p.lng!==""&&!isNaN(+p.lat)&&!isNaN(+p.lng))MAP._place(p.lat,p.lng,true)}
    if(/\.texts\./.test(k)){const b=ROOT.querySelector(`[data-tx="${txLang}"]`);if(b){const base=k.split(".texts.")[0];b.textContent=txLang.toUpperCase()+(txOk(getP(S,base),txLang)?" ✓":"")}}
    if(/^newAgent\./.test(k))agentDup();
    if(/^c\.(emails|phones|first_name|last_name)/.test(k)){clearTimeout(dupT);dupT=setTimeout(checkDups,600)}
    if(/\.reference$/.test(k)){clearTimeout(dupT);dupT=setTimeout(()=>checkRef(k.replace(/\.reference$/,"")),500)}
    persist();updateChecks()});
  ROOT.addEventListener("click",e=>{const t=e.target.closest("button,a");if(!t||!ROOT.contains(t))return;const d=t.dataset;
    if(d.flow){S.flow=d.flow;persist();render();ROOT.querySelector("#adMain").scrollTop=0;return}
    if(d.step){S.step=+d.step;if(S.step===3&&!isSeller())S.step=4;S.flow="wizard";persist();render();ROOT.querySelector("#adMain").scrollTop=0;
      if(d.jump)setTimeout(()=>{const s=ROOT.querySelector("#"+d.jump);if(s)s.scrollIntoView({behavior:"smooth",block:"start"})},50);return}
    if(d.jump){e.preventDefault();const s=ROOT.querySelector("#"+d.jump);if(s)s.scrollIntoView({behavior:"smooth",block:"start"});return}
    if(d.am){S.agentMode=d.am;persist();render();return}
    if(d.cm){S.contactMode=d.cm;persist();render();return}
    if(d.pm){S.propMode=d.pm;persist();render();return}
    if(d.tx){txLang=d.tx;render();const s=ROOT.querySelector("#pf-tekst");if(s)s.scrollIntoView({block:"start"});return}
    if(d.add){e.preventDefault();S.c[d.add].push(d.add==="emails"?{email:"",kind:""}:{phone:"",kind:"mobile"});persist();render();return}
    if(d.rm){e.preventDefault();S.c[d.rm].splice(+d.i,1);persist();render();return}
    if(d.clear){({agent:()=>S.agent=null,existing:()=>S.existing=null,linkProp:()=>S.linkProp=null,wpOwner:()=>S.wp.owner=null,lkContact:()=>S.lk.contact=null,lkProp:()=>S.lk.prop=null})[d.clear]();persist();render();return}
    if(d.usedup){const x=DUPS.find(y=>String(y.wp_id)===d.usedup);if(x){S.contactMode="existing";S.existing={wp_id:x.wp_id,name:x.name,email:x.email,city:x.city,roles:x.roles};S.step=2;S.flow="wizard";DUPS=[];persist();render()}return}
    if(t.id==="adCopyJson"){navigator.clipboard&&navigator.clipboard.writeText(JSON.stringify(payload("wizard"),null,2));t.textContent="✓";return}
    if(t.id==="adReset"){if(confirm(tr(["Concept wissen? Alle ingevulde velden en foto's gaan weg.","Clear draft? All entered fields and photos are removed."]))){
      [...MEDIA,...WP_MEDIA].forEach(m=>m.url&&URL.revokeObjectURL(m.url));MEDIA=[];WP_MEDIA=[];DUPS=[];const f=S.flow;S=blank();S.flow=f;
      if(X.me()){S.c.owner=S.p.listing_agent=S.wp.p.listing_agent=String(X.me().wp_author_id||"")}try{localStorage.removeItem(DRAFT_KEY)}catch(_){}render()}return}
  });
  /* zoekvelden opnieuw koppelen na elke render */
  const _render=render;render=function(){_render();
    liveSearch("#adAgentQ","#adAgentRes",q=>searchContacts(q,"agent"),resRow,c=>S.agent=c,"data-pick");
    liveSearch("#adCtQ","#adCtRes",q=>searchContacts(q),resRow,c=>S.existing=c,"data-pick");
    liveSearch("#adPrQ","#adPrRes",searchProps,propRow,p=>S.linkProp=p,"data-pickp");
    liveSearch("#adOwnQ","#adOwnRes",q=>searchContacts(q),resRow,c=>S.wp.owner=c,"data-pick");
    liveSearch("#adLkCQ","#adLkCRes",q=>searchContacts(q),resRow,c=>S.lk.contact=c,"data-pick");
    liveSearch("#adLkPQ","#adLkPRes",searchProps,propRow,p=>S.lk.prop=p,"data-pickp");
    if(S.flow==="wizard"&&S.step===1&&S.agentMode==="new")agentDup();
  };
}
let agT;function agentDup(){clearTimeout(agT);agT=setTimeout(async()=>{const box=ROOT.querySelector("#adAgentDup");if(!box)return;
  const q=S.newAgent.email&&emailOk(S.newAgent.email)?S.newAgent.email:S.newAgent.company;const rows=q&&q.length>=3?await searchContacts(q):[];
  box.innerHTML=rows.length?`<div class="ad-warnbox"><b>${esc(tr(["Bestaat deze makelaar al?","Does this agent already exist?"]))}</b>${rows.slice(0,4).map(r=>`<div class="ad-duprow"><span>${esc(r.name||r.email)} <span class="sm muted">· ${esc((r.roles||[]).join(", "))}</span></span><button class="btn sm" data-useagent='${esc(JSON.stringify({wp_id:r.wp_id,name:r.name,email:r.email,city:r.city}))}'>${esc(tr(["Gebruik deze","Use this one"]))}</button></div>`).join("")}</div>`:"";
  box.querySelectorAll("[data-useagent]").forEach(b=>b.onclick=()=>{S.agent=JSON.parse(b.dataset.useagent);S.agentMode="existing";persist();render()})},500)}

window.NEXUS_ADMIN={open,rerender:()=>{if(ROOT&&ROOT.dataset.init)render()},
  /* vanuit Contacten: direct de workflow "Nieuw contact" openen (stap 2 = contact als er geen aanbrenger is) */
  startNewContact:()=>{S.flow="wizard";S.step=1;S.contactMode="new";if(ROOT&&ROOT.dataset.init)render()},
  /* vanuit een contact dat Seller wordt: 'Woning toevoegen' met dit contact als eigenaar */
  startNewProperty:owner=>{S.flow="prop";S.wp=S.wp||{owner:null,p:blankProp()};S.wp.owner=owner||null;persist();if(ROOT&&ROOT.dataset.init)render()}};
})();
