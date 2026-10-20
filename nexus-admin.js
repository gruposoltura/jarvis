/* NEXUS · Admin — invoerschermen (contact → aanbrenger → woning → koppelen).
   STATUS (18-10-2026, akkoord Rick): GEKOPPELD aan core. "Opslaan" roept nexus_admin_submit aan (migratie 019):
   aanbrenger + contact + woning/koppeling in één transactie; lukt één stap niet, dan wordt niets opgeslagen.
   Foto's/documenten gaan daarna naar Storage (property-media/<id>/nexus-<uuid>.<ext>) via nexus_property_media_add.
   Concepten blijven tot het opslaan in deze browser (localStorage), foto's niet. */
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
const STATUS=[["draft",["Concept (offline)","Draft (offline)"]],["available",["Actief (online)","Active (online)"]],["under_offer",["Gereserveerd (online)","Reserved (online)"]],
  ["sold",["Verkocht (offline)","Sold (offline)"]],["withdrawn",["Ingetrokken (offline)","Withdrawn (offline)"]]];
// De 9 standaard woningtypen (besluit 19-10-2026, = core.property_types). Andere waarden weigert de database.
const CATS=[["villa","Villa"],["apartment",["Appartement","Apartment"]],["penthouse","Penthouse"],["bungalow","Bungalow"],
  ["quadrant",["Quad (kwadrant)","Quad house"]],["semi-detached",["Halfvrijstaand","Semi-detached"]],["townhouse",["Geschakelde woning","Townhouse"]],
  ["duplex","Duplex"],["finca","Finca"]];
const ORIENT=[["north",["Noord","North"]],["northeast",["Noordoost","North-east"]],["east",["Oost","East"]],["southeast",["Zuidoost","South-east"]],["south",["Zuid","South"]],["southwest",["Zuidwest","South-west"]],["west",["West","West"]],["northwest",["Noordwest","North-west"]]];
const VIEWS=[["bay",["Baai","Bay"]],["country",["Platteland","Country"]],["golf","Golf"],["green",["Groenzone","Green zone"]],["harbour",["Haven","Harbour"]],
  ["lake",["Meer","Lake"]],["mountain",["Bergen","Mountain"]],["ocean",["Oceaan","Ocean"]],["panoramic",["Panorama","Panoramic"]],["residential",["Woonwijk","Residential"]],
  ["sea",["Zee","Sea"]],["valley",["Vallei","Valley"]]];
const ENERGY=["A","B","C","D","E","F","G"].map(x=>[x,x]).concat([["R","R"],["X","X"]]);
const RANK=[["top","TOP"],["high","HIGH"],["normal","NORMAL"],["low","LOW"],["bottom","BOTTOM"]];
const LISTING=[["direct",["Direct (eigen opdracht)","Direct (own mandate)"]],["indirect",["Indirect (via derde)","Indirect (via third party)"]]];
/* zelfde sleutels als core.properties.features (import_wp.php); labels [NL, EN] */
const F_INDOOR=[["security_system",["Beveiligingssysteem","Security system"]],["family_room",["Familiekamer","Family room"]],["study",["Studeerkamer","Study"]],["workshop",["Werkplaats","Workshop"]],["basement",["Kelder","Basement"]],
  ["furnished",["Volledig gemeubileerd","Fully furnished"]],["semi_furnished",["Deels gemeubileerd","Semi furnished"]]];
const F_OUTDOOR=[["pool",["Privézwembad","Private pool"]],["communal_pool",["Gemeenschappelijk zwembad","Communal pool"]],["solarium","Solarium"],["deck",["Houten terras (deck)","Deck"]],["courtyard",["Binnenplaats","Courtyard"]],
  ["outdoor_entertaining",["Buitenleven / buitenkeuken","Outdoor entertaining"]],["storage_shed",["Berging / schuur","Shed"]],["remote_garage",["Garage met afstandsbediening","Remote garage"]],["secure_parking",["Afgesloten parkeerplaats","Secure parking"]],["intercom","Intercom"],["fully_fenced",["Volledig omheind","Fully fenced"]]];
const F_CLIMATE=[["air_conditioning",["Airconditioning","Air conditioning"]],["air_conditioning_preinstalled",["Airco voorbereid","Air conditioning pre-installed"]],["underfloor_heating",["Vloerverwarming","Underfloor heating"]],
  ["central_heating",["Centrale verwarming","Central heating"]],["ducted_heating",["Verwarming via kanalen","Ducted heating"]],["ducted_cooling",["Koeling via kanalen","Ducted cooling"]],["split_heating",["Verwarming via split-units","Split system heating"]],
  ["hydronic_heating",["Waterverwarming (radiatoren)","Hydronic heating"]],["split_aircon",["Airco via split-units","Split system airco"]],["gas_heating",["Gasverwarming","Gas heating"]],["reverse_cycle_aircon",["Airco met warmtepomp (koelen/verwarmen)","Reverse cycle aircon"]],
  ["evaporative_cooling",["Verdampingskoeling","Evaporative cooling"]],["fireplace",["Open haard","Fire place"]],["radiant_panels",["Stralingspanelen","Radiant panels"]]];
/* zelfde groepen en waarden als core.properties.feature_options; de waarde blijft Engels (feeds), het label is NL/EN */
const o_=(v,nl)=>[v,[nl,v.charAt(0).toUpperCase()+v.slice(1)]];
const OPT={
  kitchen:[["Keuken","Kitchen"],[o_("closed","Gesloten"),o_("open","Open"),o_("island","Kookeiland"),o_("american","Amerikaanse keuken"),o_("fully equipped","Volledig ingericht")]],
  pool:[["Zwembad","Pool"],[o_("private","Privé"),o_("community","Gemeenschappelijk"),o_("infinity","Infinity"),o_("heated","Verwarmd"),o_("covered","Overdekt"),o_("salted","Zoutwater"),o_("countercurrent swimming system","Tegenstroominstallatie")]],
  floor:[["Vloer","Floor"],[o_("marble","Marmer"),o_("wood","Hout"),o_("laminate","Laminaat"),o_("gres","Gres"),o_("porcelain stoneware","Porseleintegels"),o_("tiled","Tegels"),o_("carpets","Tapijt"),o_("boards","Planken")]],
  garden:[["Tuin","Garden"],[o_("plot - garden","Perceel met tuin"),o_("plot - grass","Perceel met gras"),o_("planters","Plantenbakken"),o_("watersystem","Bewateringssysteem"),o_("waterfall","Waterval"),o_("natural park","Natuurpark"),o_("no","Geen tuin"),o_("community","Gemeenschappelijke tuin"),o_("fruit trees","Fruitbomen"),o_("cypress trees","Cipressen"),o_("exotic plants","Exotische planten"),o_("palms","Palmen"),o_("japanese garden","Japanse tuin")]],
  terrace:[["Terras","Terrace"],[o_("covered","Overdekt"),o_("glazed","Ingeglaasd"),o_("open","Open"),o_("solarium","Solarium")]],
  aircon:[["Airco","Airco"],[o_("conductor","Kanalensysteem"),o_("pre-installed","Voorbereid"),o_("split unit","Split-unit")]],
  heating:[["Verwarming","Heating"],[o_("central heating","Centrale verwarming"),o_("radiator","Radiatoren"),o_("electric","Elektrisch"),o_("radiant panels","Stralingspanelen"),o_("gas","Gas"),o_("gasoil","Gasolie"),o_("oil","Olie"),o_("underfloor heating","Vloerverwarming"),o_("pre-installation","Voorbereid"),o_("heat pump","Warmtepomp"),o_("gas fireplace","Gashaard"),o_("wood fireplace","Houthaard")]],
  property:[["Overige kenmerken","Other property features"],[o_("alarm","Alarm"),o_("armored door","Veiligheidsdeur"),o_("balcony","Balkon"),o_("barbecue","Barbecue"),o_("built-in wardrobes","Inbouwkasten"),o_("ceiling fan","Plafondventilator"),o_("centralised security","Centrale beveiliging"),o_("disabled access","Rolstoeltoegankelijk"),o_("dishwasher","Vaatwasser"),o_("domotic system","Domotica"),o_("double glass windows","Dubbel glas"),o_("dressing room","Kleedkamer"),o_("electric blinds","Elektrische rolluiken"),o_("electric gate","Elektrisch hek"),o_("elevator","Lift"),o_("employees room","Personeelskamer"),o_("frontline beach","Eerstelijns strand"),o_("game room","Spelkamer"),o_("garden","Tuin"),o_("guesthouse apartment","Gastenappartement"),o_("independent guesthouse","Vrijstaand gastenverblijf"),o_("gym","Fitnessruimte"),o_("home-cinema","Thuisbioscoop"),o_("internet connection","Internetaansluiting"),o_("jacuzzi","Jacuzzi"),o_("laundry room","Wasruimte"),o_("library","Bibliotheek"),o_("mosquito nets","Horren"),o_("osmosis","Osmosefilter"),o_("outside jacuzzi","Buitenjacuzzi"),o_("outside kitchen","Buitenkeuken"),o_("outside shower","Buitendouche"),o_("private parking","Eigen parkeerplaats"),o_("reformed","Gerenoveerd"),o_("reform needed","Renovatie nodig"),o_("roof terrace","Dakterras"),o_("safe-deposit box","Kluis"),o_("sauna","Sauna"),o_("softener limescale","Waterontharder"),o_("solar panels","Zonnepanelen"),o_("spa","Spa"),o_("storage room","Berging"),o_("technical room","Technische ruimte"),o_("tennis court","Tennisbaan"),o_("terrace","Terras"),o_("tv satellite","Satelliet-tv"),o_("vacuum system","Centraal stofzuigsysteem"),o_("video surveillance","Camerabewaking"),o_("walk-in closet","Inloopkast"),o_("waterdeposit","Waterreservoir"),o_("white goods","Witgoed"),o_("wifi","Wifi"),o_("wine cellar","Wijnkelder")]],
  community:[["Gemeenschap","Community features"],[o_("15 min beach","Strand binnen 15 min"),o_("15 min market","Markt binnen 15 min"),o_("15 min shops","Winkels binnen 15 min"),o_("24h security","24-uursbewaking"),o_("barbecue","Barbecue"),o_("concierge","Conciërge"),o_("closed community","Afgesloten complex"),o_("controlled access","Gecontroleerde toegang"),o_("direct beach access","Directe toegang tot strand"),o_("disabled access","Rolstoeltoegankelijk"),o_("elevator","Lift"),o_("frontline beach","Eerstelijns strand"),o_("game area","Speelplaats"),o_("gardens","Tuinen"),o_("golf court","Golfbaan"),o_("gym","Fitnessruimte"),o_("hotel","Hotel"),o_("indoor swimming pool","Binnenzwembad"),o_("jacuzzi","Jacuzzi"),o_("paddle court","Padelbaan"),o_("parking","Parkeren"),o_("public transport","Openbaar vervoer"),o_("social club","Sociale club"),o_("sport center","Sportcentrum"),o_("swimming pool","Zwembad"),o_("tennis court","Tennisbaan")]]
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
  keyholder:false,mailing_optin:false,prefs:[],search:{budget:"",property_type:"",period:"",build:[]},internal_comments:"",
  partner:{on:false,title:"",first_name:"",last_name:"",email:"",phone:""}});
/* Echtpaar = twee contacten (Rick 19-10-2026). Herkent alleen een heel duidelijk "John & Heather" / "Ian and Diane" / "Henk en Joke". */
const COUPLE_RE=/^([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'.-]+)\s*(?:&|\+|\s(?:and|en|y|und|og|och|et|e)\s)\s*([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'.-]+)$/i;
const COUPLE_NOT=/^(partners?|sons?|family|familie|familia|co|company|kids|children|kinderen|friends?)$/i;
function coupleSplit(fn){const m=String(fn||"").trim().match(COUPLE_RE);if(!m||COUPLE_NOT.test(m[1])||COUPLE_NOT.test(m[2]))return null;return [m[1],m[2]]}
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
  texts:{en:{heading:"",description:"",key_details:"",seo_title:"",seo_description:""},nl:{heading:"",description:"",key_details:"",seo_title:"",seo_description:""},sv:{heading:"",description:"",key_details:"",seo_title:"",seo_description:""}},key_on:false,key_number:"",
  cost_community:"",cost_garbage:"",cost_ibi:"",cost_insurance:"",fee_transfer_tax:"",fee_legal:"",fee_notary:"",fee_registry:"",
  registry_name:"",finca_number:"",cadastral_ref:"",idufir:"",registry_tomo:"",registry_libro:"",registry_folio:"",registry_inscription:"",deed_build_area:"",deed_plot_area:"",
  purchase_date:"",purchase_price:"",purchase_tax:"",purchase_tax_type:"",purchase_notary:"",purchase_notary_protocol:"",deed_read_at:""});
function blank(){return{flow:"wizard",step:1,agentMode:"none",agent:null,newAgent:{company:"",first_name:"",last_name:"",email:"",phone:"",website:"",language:"es"},
  contactMode:"new",existing:null,c:blankContact(),propMode:null,linkProp:null,linkRel:"owner",p:blankProp(),
  /* losse schermen */
  wp:{owner:null,p:blankProp()},lk:{contact:null,prop:null,rel:"owner"}};}
let S=blank(), MEDIA=[], WP_MEDIA=[], txLang="en";
const TX_LANGS=["en","nl","sv"];
function load(){try{const d=JSON.parse(localStorage.getItem(DRAFT_KEY)||"null");if(d){S=Object.assign(blank(),d);
  S.c=Object.assign(blankContact(),d.c);S.c.roles=(S.c.roles||[]).filter(r=>ROLES.some(x=>x[0]===r));S.p=Object.assign(blankProp(),d.p);S.wp.p=Object.assign(blankProp(),(d.wp||{}).p);
  [S.p,S.wp.p].forEach(p=>{const b=blankProp().texts;p.texts=Object.assign({},b,p.texts||{});TX_LANGS.forEach(l=>p.texts[l]=Object.assign({},b[l],p.texts[l]||{}))})}}catch(e){}}
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
/* 19-10-2026: elk invulblok een eigen kleur (dunne rand, ronde hoeken, lichte achtergrond) */
const SEC_C={"pf-basis":"#3b82f6","pf-prijs":"#22c55e","pf-loc":"#06b6d4","pf-ind":"#f59e0b","pf-ken":"#a855f7","pf-tekst":"#ec4899","pf-media":"#f97316","pf-kost":"#64748b","pf-pub":"#eab308",
  "ct-labels":"#ec4899","ct-partner":"#e11d48","ct-person":"#3b82f6","ct-chan":"#22c55e","ct-addr":"#06b6d4","ct-search":"#f59e0b","ct-mail":"#a855f7","ct-note":"#64748b","ag":"#14b8a6"};
const SEC_T={"Labels":"#ec4899","Persoon":"#3b82f6","E-mail en telefoon":"#22c55e","Adres":"#06b6d4","Zoekprofiel":"#f59e0b","Mailings":"#a855f7","Interne opmerking":"#64748b",
  "Makelaar zoeken":"#14b8a6","Nieuwe makelaar":"#14b8a6","Of: vrij verwezen door":"#64748b","Verwezen door":"#64748b","Bestaand contact":"#3b82f6","Bestaande woning":"#f97316","Status":"#22c55e",
  "Wat er geschreven wordt (core-schema)":"#64748b","Eigenaar":"#14b8a6","Contact":"#3b82f6","Woning":"#f97316","Koppeling":"#a855f7"};
const sec=(title,body,o={})=>`<section class="ad-sec" ${o.id?`id="${o.id}"`:""} style="--sc:${SEC_C[o.id]||SEC_T[Array.isArray(title)?title[0]:title]||"#94a3b8"}"><h4>${esc(tr(title))}${o.aside?`<span class="sm muted">${o.aside}</span>`:""}</h4>${body}</section>`;
const row=(...c)=>`<div class="ad-row">${c.join("")}</div>`;

/* ================= LOCATIES ================= */
let LOC_ID={mun:{},area:{}};
async function loadLocations(){
  if(LOCS)return;LOCS=JSON.parse(JSON.stringify(LOC_FALLBACK));
  /* 1e keus: core.locations via nexus_locations (WordPress-API bestaat niet meer sinds de omzetting) */
  try{const rows=await X.rpc("nexus_locations",{});
    if(Array.isArray(rows)&&rows.length>20){const byId={},tree={};rows.forEach(r=>byId[r.id]=r);
      rows.filter(r=>r.kind==="municipality").forEach(r=>{tree[r.name]=tree[r.name]||[];LOC_ID.mun[r.name]=r.id});
      rows.filter(r=>r.kind!=="municipality").forEach(r=>{let m=byId[r.parent_id],g=0;while(m&&m.kind!=="municipality"&&g++<5)m=byId[m.parent_id];
        if(!m)return;(tree[m.name]=tree[m.name]||[]).push(r.name);LOC_ID.area[m.name+"|"+r.name]=r.id});
      Object.values(tree).forEach(a=>a.sort((a,b)=>a.localeCompare(b,"es")));
      LOCS=tree;LOC_SRC="core";return}
  }catch(e){}
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
let LOOKUPS={}, LOOKUPS_LOADED=false;
function loadLookups(){if(LOOKUPS_LOADED)return Promise.resolve();LOOKUPS_LOADED=true;
  return X.rpc("nexus_lookups",{}).then(r=>{LOOKUPS=r||{}}).catch(()=>{LOOKUPS_LOADED=false})}
let PENDING=null; /* start-actie van buiten Admin, toegepast ná het laden van het concept */
function open(root,ctx){X=ctx;ROOT=root;if(!ROOT.dataset.init){load();ROOT.dataset.init="1";bind()}
  if(PENDING){const f=PENDING;PENDING=null;f()}
  if(!S.c.owner&&X.me())S.c.owner=String(X.me().wp_author_id||"");
  if(!S.p.listing_agent&&X.me())S.p.listing_agent=String(X.me().wp_author_id||"");
  render();loadLocations().then(()=>{if(ROOT.querySelector("#adMuni"))render()});
  loadLookups().then(()=>{const d=ROOT.querySelector("#adRegistros");if(d)d.innerHTML=(LOOKUPS.registry||[]).map(x=>`<option value="${esc(x)}">`).join("")});
  ["p","wp.p"].forEach(b=>{if(/^[A-Z]{2}\d{3}$/.test(getP(S,b).reference||""))checkRef(b)})}
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
     <div class="ad-off sm" id="adSaveMsg"><b>${esc(tr(["Gekoppeld aan NEXUS","Connected to NEXUS"]))}</b>${esc(tr(["Opslaan schrijft direct naar de database; lukt één onderdeel niet, dan wordt niets opgeslagen.","Saving writes straight to the database; if any part fails, nothing is saved."]))}</div>
     <div class="sm muted" id="adStamp" style="padding:8px 14px"></div>
     <button class="ad-reset" id="adReset">${esc(tr(["Concept wissen","Clear draft"]))}</button>
   </aside>
   <div class="card ad-main"><div class="ad-scroll" id="adMain">${DONE?doneView():S.flow==="wizard"?wizard():S.flow==="prop"?propFlow():linkFlow()}</div>
     ${DONE?"":S.flow==="wizard"?`<div class="ad-foot">${S.step>1?`<button class="btn" data-step="${prevStep()}">← ${esc(tr(["Vorige","Back"]))}</button>`:"<span></span>"}
       ${S.step<4?`<button class="btn ad-next" data-step="${nextStep()}">${esc(tr(["Volgende","Next"]))} →</button>`:saveBtn()}</div>`:S.flow==="prop"?`<div class="ad-foot"><span></span>${saveBtn()}</div>`:`<div class="ad-foot"><span></span>${saveBtn(tr(["Koppeling opslaan","Save link"]))}</div>`}
   </div>
   <aside class="card ad-side"><div class="hd"><h3>${esc(tr(["Controle","Checks"]))}</h3></div><div class="ad-scroll" id="adChecks"></div></aside></div>`;
  afterRender();
}
const canSave=()=>!BUSY&&!validate(S.flow).some(x=>x.level==="save");
const saveBtn=lbl=>`<button class="btn ad-save" data-save="1" data-lbl="${esc(lbl||"")}" ${canSave()?"":"disabled"} title="${esc(tr(["Slaat op in NEXUS (core)","Saves to NEXUS (core)"]))}">${BUSY?"…":"💾"} ${esc(BUSY?tr(["Opslaan…","Saving…"]):(lbl||tr(["Opslaan","Save"])))}</button>`;
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
  ${sec(["Persoon","Person"],row(sel("c.title",["Aanhef","Title"],[["Mr","Mr"],["Mrs","Mrs"],["Ms","Ms"],["Dhr.","Dhr."],["Mevr.","Mevr."],["Sr.","Sr."],["Sra.","Sra."],["Herr","Herr"],["Frau","Frau"],["Dr.","Dr."]]),
       inp("c.first_name",["Voornaam","First name"],{req:"save",ac:"off"}),inp("c.last_name",["Achternaam","Last name"],{ac:"off"}),inp("c.company",["Bedrijf","Company"]))
     +row(sel("c.language",["Correspondentietaal","Correspondence language"],LANGS.map(l=>[l[0],[l[1],l[2]]]),{req:"save"}),inp("c.birthday",["Geboortedatum","Birthday"],{type:"date"}),
       sel("c.owner",["Verantwoordelijk teamlid","Responsible team member"],TEAM.map(t=>[String(t.wp),t.name]),{req:"save"}),sel("c.source",["Bron","Source"],SOURCES))
     +`<small class="muted">${esc(tr(["Voornaam óf bedrijf is genoeg. Eén persoon per contact: een echtpaar leg je vast als contact + partner hieronder.","First name or company is enough. One person per contact: record a couple as contact + partner below."]))}</small><div id="adPtHint">${ptHint()}</div>`)}
  ${sec(["Partner / tweede persoon","Partner / second person"],ptBlock(),{id:"ct-partner"})}
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
function ptHint(){const c=S.c, x=coupleSplit(c.first_name);if(!x||(c.partner&&c.partner.on))return "";
  return `<div class="ad-warnbox" style="margin-top:8px"><b>💑 ${esc(tr([`Twee personen in één naam: ${x[0]} en ${x[1]}`,`Two people in one name: ${x[0]} and ${x[1]}`]))}</b>
    <div class="sm">${esc(tr([`Leg ${x[1]} vast als partner met een eigen contact, e-mail en mobiel.`,`Record ${x[1]} as partner with a contact, e-mail and mobile of their own.`]))}</div>
    <button class="btn sm" data-ptsplit="1" style="margin-top:6px">${esc(tr(["Splitsen in contact + partner","Split into contact + partner"]))}</button></div>`}
function ptBlock(){const pt=S.c.partner||(S.c.partner=blankContact().partner);
  if(!pt.on)return `<button class="btn sm" data-ptadd="1">+ ${esc(tr(["Partner toevoegen (mede-eigenaar / mede-koper)","Add partner (co-owner / co-buyer)"]))}</button>
    <small class="muted" style="display:block;margin-top:6px">${esc(tr(["De partner wordt een eigen contact, individueel vindbaar, en staat als mede-eigenaar of mede-koper bij dezelfde woning.","The partner becomes a contact of their own, findable on their own, and shows as co-owner or co-buyer on the same property."]))}</small>`;
  return row(sel("c.partner.title",["Aanhef","Title"],[["Mr","Mr"],["Mrs","Mrs"],["Ms","Ms"],["Dhr.","Dhr."],["Mevr.","Mevr."],["Sr.","Sr."],["Sra.","Sra."],["Herr","Herr"],["Frau","Frau"],["Dr.","Dr."]]),
      inp("c.partner.first_name",["Voornaam","First name"],{req:"save",ac:"off"}),inp("c.partner.last_name",["Achternaam","Last name"],{ac:"off"}))
    +row(inp("c.partner.email",["Eigen e-mail","Own e-mail"],{type:"email",w:2,ac:"off"}),inp("c.partner.phone",["Eigen mobiel","Own mobile"],{type:"tel",w:2,ph:"+34 …",ac:"off"}))
    +`<small class="muted">${esc(tr(["Adres, taal, teamlid en labels worden overgenomen. Mailing-toestemming niet: die geeft ieder zelf. E-mail en mobiel mogen leeg blijven.","Address, language, team member and labels are copied. Mailing consent is not: everyone gives that themselves. E-mail and mobile may stay empty."]))}</small>
     <div><button class="btn sm" data-ptdel="1" style="margin-top:8px">× ${esc(tr(["Geen partner","No partner"]))}</button></div>`}
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
    ["pf-tekst",["Teksten","Texts"]],["pf-media",["Foto's","Photos"]],["pf-kost",["Eigendomsakte","Title deed"]],["pf-pub",["Publicatie","Publishing"]]];
  return `<div class="ad-jump">${nav.map(n=>`<a data-jump="${n[0]}">${esc(tr(n[1]))}</a>`).join("")}</div>
  ${sec(["Basis","Basics"],row(sel(B("status"),["Status","Status"],STATUS,{req:"save",empty:false}),sel(B("category"),["Woningtype","Property type"],CATS,{req:"save"}),
      sel(B("build_type"),["Bouw","Build"],[["resale",["Bestaande bouw","Resale"]],["new_build",["Nieuwbouw","New build"]]],{req:"save",empty:false}),sel(B("own_listing_type"),["Soort opdracht","Mandate"],LISTING,{empty:false}))
    +row(inp(B("reference"),["Referentie","Reference"],{req:"save",list:"adRefPfx",ph:"RH995",hint:["Plaatsprefix + nummer; uniek","Location prefix + number; unique"]}),inp(B("year_built"),["Bouwjaar","Year built"],{type:"number",min:1800}),
      inp(B("listed_at"),["In aanbod sinds","Date listed"],{type:"date"}),sel(B("listing_agent"),["Makelaar (verantwoordelijk)","Listing agent"],TEAM.map(t=>[String(t.wp),t.name]),{req:"save"}))
    +`<div id="adRefCheck" class="sm"></div>`
    +`<div class="ad-key">${chk(B("key_on"),["Sleutel in beheer: sleutelnummer toekennen","Keys held: assign a key number"])}${p.key_on?`<label class="ad-f"><span>${esc(tr(["Sleutelnummer","Key number"]))}${mark("save")}</span><input data-k="${B("key_number")}" value="${esc(p.key_number||"")}" inputmode="numeric" placeholder="…"><small>${esc(tr(["Eerste vrije nummer; je mag het aanpassen","First free number; you may change it"]))}</small></label>`:""}</div>`
    +chk(B("dossier_complete"),["Dossier compleet","Dossier complete"])
    +`<datalist id="adRefPfx">${REF_PFX.map(x=>`<option value="${x}">`).join("")}</datalist>`,{id:"pf-basis"})}
  ${sec(["Prijs","Price"],row(inp(B("price"),["Vraagprijs (€)","Asking price (€)"],{type:"number",min:0,step:1000,req:"save"}),
      inp(B("price_original"),["Oorspronkelijke vraagprijs (€)","Original price (€)"],{type:"number",min:0,step:1000}))
    +`<div class="ad-multi c3">${chk(B("price_hidden"),["Prijs verbergen","Hide price"])}${chk(B("price_fixed"),["Vaste prijs","Price FIXED"])}${chk(B("price_from"),["Prijs vanaf","Price FROM"])}
      ${chk(B("price_on_request"),["Prijs op aanvraag","Price ON REQUEST"])}</div>`,{id:"pf-prijs"})}
  ${sec(["Locatie","Location"],row(`<label class="ad-f w2"><span>${esc(tr(["Gemeente","Municipality"]))}${mark("save")}</span><select data-k="${B("municipality")}" id="adMuni"><option value="">${esc(tr(["— kies —","— choose —"]))}</option>
        ${munis().map(m=>`<option ${m===mun?"selected":""}>${esc(m)}</option>`).join("")}</select><small>${esc(LOC_SRC==="wp"?tr(["Lijst uit de website-taxonomie ‘Location’","List from the website ‘Location’ taxonomy"]):tr(["Lijst uit de woningdata (website niet bereikbaar)","List from property data (website unreachable)"]))}</small></label>`,
      `<label class="ad-f w2"><span>${esc(tr(["Wijk / urbanisatie","Area / urbanisation"]))}${mark("save")}</span><select data-k="${B("area")}" ${mun?"":"disabled"}><option value="">${esc(tr(mun?["— kies —","— choose —"]:["eerst gemeente","municipality first"]))}</option>
        ${areas.map(a=>`<option ${a===p.area?"selected":""}>${esc(a)}</option>`).join("")}<option value="__mun" ${p.area==="__mun"?"selected":""}>${esc(tr(["(gemeente zelf, geen wijk)","(municipality itself, no area)"]))}</option><option value="__new" ${p.area==="__new"?"selected":""}>+ ${esc(tr(["nieuwe wijk…","new area…"]))}</option></select></label>`)
    +(p.area==="__new"?row(inp(B("area_new"),["Naam nieuwe wijk","New area name"],{w:2,req:"save",hint:["Wordt als voorstel aangemaakt; de PropertyGuard-normalisatie moet hem goedkeuren","Created as a proposal; PropertyGuard normalisation must approve it"]})):"")
    +row(inp(B("street"),["Straat","Street"],{w:2}),inp(B("street_number"),["Nr.","No."]),inp(B("postal_code"),["Postcode","Post code"]))
    +row(inp(B("province"),["Provincie","Province"]),inp(B("country"),["Land","Country"]),sel(B("orientation"),["Oriëntatie","Orientation"],ORIENT))
    +`<div class="ad-mapwrap"><div class="ad-maptools"><input id="adGeoQ" type="search" value="${esc(geoAddr(p))}" data-base="${base}" placeholder="${esc(tr(["Zoek adres of plak een Google Maps-link / ‘lat, lng’","Search address or paste a Google Maps link / ‘lat, lng’"]))}"><button class="btn sm" id="adGeoBtn">${esc(tr(["Zoek","Find"]))}</button></div>
      <div id="adMap" data-base="${base}"></div><div class="ad-row">${inp(B("lat"),["Breedtegraad","Latitude"],{req:"pub",type:"number",step:"any"})}${inp(B("lng"),["Lengtegraad","Longitude"],{req:"pub",type:"number",step:"any"})}</div>
      <small class="muted">${esc(tr(["Klik op de kaart of sleep de pin. Zonder coördinaten staat een woning niet op de NEXUS-kaart.","Click the map or drag the pin. Without coordinates a property is not on the NEXUS map."]))}</small></div>`
    +`<div class="ad-multi c3">${chk(B("hide_address"),["Kaart verbergen","Hide map"])}</div>`
    +`<div class="ad-f w4"><span>${esc(tr(["Uitzicht","Views"]))}</span>${multi(B("views"),VIEWS,{cols:4})}</div>`,{id:"pf-loc"})}
  ${sec(["Indeling en oppervlaktes","Layout and areas"],
     `<div class="ad-cols3"><div><h5>${esc(tr(["Kamers","Rooms"]))}</h5>${[["bedrooms",["Slaapkamers","Bedrooms"],"save"],["bathrooms",["Badkamers","Bathrooms"],"save"],["toilets",["Toiletten","Toilets"]],["ensuites","En-suite"],["living_rooms",["Woonkamers","Livings"]],["kitchens",["Keukens","Kitchens"]]]
        .map(f=>inp(B(f[0]),f[1],{type:"number",min:0,req:f[2]})).join("")}</div>
      <div><h5>${esc(tr(["Oppervlakte (m²)","Surface (m²)"]))}</h5>${[["build_area",["Bebouwd","Building area"],"save"],["plot_area",["Perceel","Land area"]]]
        .map(f=>inp(B(f[0]),f[1],{type:"number",min:0,req:f[2]})).join("")}
        ${sel(B("energy_label"),["Energielabel C.E.E.","Energy label C.E.E."],ENERGY,{req:"pub",hint:["Wettelijk verplicht in advertenties","Legally required in adverts"]})}</div>
      <div><h5>${esc(tr(["Overig","Other"]))}</h5>${[["floors",["Verdiepingen","Floors"]],["balconies",["Balkons","Balconies"]],["patios",["Patio's","Patios"]],["terraces",["Terrassen","Terraces"]],["garages",["Garages","Garage"]],["carports","Carport"]]
        .map(f=>inp(B(f[0]),f[1],{type:"number",min:0})).join("")}${inp(B("floor_level"),["Etage","Level"],{ph:["bijv. begane grond, 2e","e.g. ground, 2nd"]})}</div></div>
     <h5 class="ad-h5row">${esc(tr(["Afstanden (meter, hemelsbreed)","Distances (metres, straight line)"]))}<button class="btn sm" data-dist="${base}">⟳ ${esc(tr(["Bereken","Calculate"]))}</button></h5>${row(inp(B("distance_sea_m"),["Zee","Sea"],{type:"number",min:0}),inp(B("distance_airport_m"),["Luchthaven","Airport"],{type:"number",min:0}),inp(B("distance_city_m"),["Centrum","Town centre"],{type:"number",min:0}),inp(B("distance_shops_m"),["Winkels (supermarkt)","Shops (supermarket)"],{type:"number",min:0}))}
     <small class="muted" id="adDistInfo-${base.replace(".","_")}">${esc(distInfo(p))}</small>`,{id:"pf-ind"})}
  ${sec(["Kenmerken","Features"],`<div data-fxbase="${base}">${window.NEXUS_FEAT?NEXUS_FEAT.html(featModel(base),{tr,category:p.category}):""}</div>`,{id:"pf-ken"})}
  ${sec(["Teksten","Texts"],`<div class="ad-note sm" style="margin-bottom:10px">✨ ${esc(tr(["Je hoeft hier niets in te vullen. Direct na Opslaan haalt NEXUS het kadaster op en schrijft Agent SEO (dezelfde agent als bij de import) de Engelse kop, omschrijving met links naar de woonplaatsgids en de SEO-teksten. NL en SV volgen binnen enkele minuten via de vertaalagents. Wat je hier zelf invult, mag Agent SEO herschrijven; een kop die je invult blijft staan.","No need to fill this in. Right after Save, NEXUS fetches the cadastre and Agent SEO (the same agent as for imports) writes the English heading, description with links to the town guide and the SEO texts. NL and SV follow within minutes via the translation agents. Agent SEO may rewrite what you enter here; a heading you enter is kept."]))}</div>
     <div class="ad-txbar"><div class="seg ad-seg sm">${TX_LANGS.map(l=>`<button data-tx="${l}" class="${txLang===l?"on":""}">${l.toUpperCase()}${txOk(p,l)?" ✓":""}</button>`).join("")}</div></div>
     ${row(inp(B(`texts.${txLang}.heading`),["Kop","Heading"],{w:4,ph:["bijv. Vrijstaande villa met privézwembad in Benimar","e.g. Detached villa with private pool in Benimar"]}))}
     ${row(area(B(`texts.${txLang}.description`),["Omschrijving","Description"],{rows:9}))}
     ${row(area(B(`texts.${txLang}.key_details`),["Kernpunten (één per regel, komen op de website)","Key points (one per line, shown on the website)"],{rows:5}))}
     ${row(inp(B(`texts.${txLang}.seo_title`),["SEO-titel","SEO title"],{w:2,hint:["max. ±60 tekens","max ±60 characters"]}),inp(B(`texts.${txLang}.seo_description`),["SEO-omschrijving","SEO description"],{w:2,hint:["max. ±155 tekens","max ±155 characters"]}))}
     ${row(area(B("internal_notes"),["Interne notities","Internal notes"],{rows:3,hint:["Alleen intern, nooit op de site of in teksten","Internal only, never on the site or in texts"]}))}
`,{id:"pf-tekst"})}
  ${sec(["Foto's en media","Photos and media"],`<div class="ad-drop" data-media="${base}"><input type="file" multiple accept="image/*,application/pdf" hidden>
       <div><b>${esc(tr(["Sleep foto's hierheen of klik om te kiezen","Drop photos here or click to choose"]))}</b><div class="sm muted">${esc(tr(["JPG/PNG/WebP, ook plattegronden en PDF (energiecertificaat). Eerste foto = hoofdfoto. Volgorde aanpassen door te slepen.","JPG/PNG/WebP, also floor plans and PDF (energy certificate). First photo = main photo. Drag to reorder."]))}</div></div></div>
     <div class="ad-media" id="adMedia-${base}"></div>
     <small class="muted">${esc(tr(["Foto's blijven alleen in dit venster; ze worden pas geüpload naar Supabase Storage (bucket property-media) na koppeling.","Photos stay in this window only; they are uploaded to Supabase Storage (bucket property-media) once connected."]))}</small>`,{id:"pf-media"})}
  ${/* BESLUIT Rick 18/19-10-2026: geen kosten koper en geen vaste lasten in NEXUS. Niet terugzetten. */""}
  ${sec(["Eigendomsakte","Title deed"],`<div class="dd-bar">${window.NEXUS_DEED?NEXUS_DEED.button(tr).replace('data-deed="1"',`data-deed="${base}"`):""}<span class="sm muted">${esc(tr(["PDF of foto van de escritura; je ziet eerst wat er gevonden is.","PDF or photo of the escritura; you review what was found first."]))}</span></div>
    <div class="ad-cols3">
     <div><h5>${esc(tr(["Kadaster en registro","Cadastre and registry"]))}</h5>${inp(B("registry_name"),["Registro de la Propiedad","Land registry"],{list:"adRegistros",ph:["kies of typ, bijv. Torrevieja nº 2","pick or type, e.g. Torrevieja nº 2"]})}<datalist id="adRegistros">${(LOOKUPS.registry||[]).map(x=>`<option value="${esc(x)}">`).join("")}</datalist>${inp(B("finca_number"),["Fincanummer","Finca number"])}
       ${inp(B("cadastral_ref"),["Kadastrale referentie","Cadastre number"],{hint:["20 tekens; hiermee worden de kadastergegevens opgehaald","20 characters; used to fetch the cadastral data"]})}${inp(B("idufir"),"IDUFIR / CRU")}</div>
     <div><h5>${esc(tr(["Inschrijving en oppervlakte","Inscription and areas"]))}</h5>${row(inp(B("registry_tomo"),"Tomo"),inp(B("registry_libro"),"Libro"))}${row(inp(B("registry_folio"),"Folio"),inp(B("registry_inscription"),["Inscripción","Inscription"]))}
       ${inp(B("deed_build_area"),["Bebouwd volgens akte (m²)","Built area per deed (m²)"],{type:"number",min:0})}${inp(B("deed_plot_area"),["Kavel volgens akte (m²)","Plot per deed (m²)"],{type:"number",min:0,hint:["Leeg bij een appartement","Empty for an apartment"]})}</div>
     <div><h5>${esc(tr(["Aankoop huidige eigenaar","Purchase by current owner"]))}</h5>${inp(B("purchase_date"),["Datum aankoop","Purchase date"],{type:"date"})}${inp(B("purchase_price"),["Aankoopprijs (€)","Purchase price (€)"],{type:"number",min:0,step:"any"})}
       ${row(inp(B("purchase_tax"),["Overdrachtsbelasting (€)","Transfer tax (€)"],{type:"number",min:0,step:"any"}),sel(B("purchase_tax_type"),["Soort","Type"],[["ITP","ITP"],["IVA","IVA"],["IVA+AJD","IVA + AJD"]],{empty:["—","—"]}))}
       ${inp(B("purchase_notary"),["Notaris aankoop","Notary (purchase)"])}${inp(B("purchase_notary_protocol"),["Protocolnummer","Protocol number"])}</div></div>
     <div class="ad-note sm">${esc(tr(["Verkoopprijs, notaris en commissies van onze verkoop vul je later in via ✎ Bewerken op de woning (alleen beheerder).","Our sale price, notary and commissions are entered later via ✎ Edit on the property (admin only)."]))}</div>`,{id:"pf-kost"})}
  ${sec(["Publicatie","Publishing"],`<div class="ad-multi c3">${chk(B("no_export"),["Uitsluiten van XML-feeds","Exclude from XML feeds"])}</div>
     <div class="ad-note sm">${esc(tr(["Online/offline volgt de status: Actief en Gereserveerd staan online, Concept, Verkocht en Ingetrokken offline.","Online/offline follows the status: Active and Reserved are online, Draft, Sold and Withdrawn offline."]))}</div>
     <div class="ad-f w4"><span>${esc(tr(["Labels","Labels"]))}</span>${multi(B("labels"),[["exclusive","EXCLUSIVE"],["premium","PREMIUM"],["bargain","BARGAIN"],["featured",["Uitgelicht","Featured"]]],{cols:4})}<small>${esc(tr(["NEW zet NEXUS zelf: de eerste 7 dagen na de eerste publicatie.","NEXUS sets NEW itself: the first 7 days after first publication."]))}</small></div>
     <div class="ad-f w4"><span>${esc(tr(["Exportfeeds","Export feeds"]))}</span>${multi(B("export_feeds"),[["idealista","Idealista"]],{cols:4})}</div>`,{id:"pf-pub"})}`;
}
const txOk=(p,l)=>!!(p.texts[l]&&p.texts[l].heading&&p.texts[l].description);

/* ================= STAP 4 · CONTROLE ================= */
function stepReview(){
  const v=validate("wizard"), save=v.filter(x=>x.level==="save"), pub=v.filter(x=>x.level==="pub");
  const c=S.contactMode==="existing"?S.existing:S.c, p=S.p;
  const name=S.contactMode==="existing"?(c&&c.name):[S.c.first_name,S.c.last_name].filter(Boolean).join(" ")||S.c.company;
  return `<div class="ad-intro"><h2>${esc(tr(["Controle","Review"]))}</h2><p class="muted">${esc(tr(["Zo komt het in NEXUS terecht. Controleer en klik op Opslaan.","This is how it lands in NEXUS. Check and click Save."]))}</p></div>
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
  else if(!/^[A-Z]{2}\d{3}$/.test(p.reference))add(["Referentie: 2 hoofdletters + 3 cijfers (bijv. RH995)","Reference: 2 capitals + 3 digits (e.g. RH995)"],"save","pf-basis");
  else if(REF_TAKEN[p.reference])add([`Referentie ${p.reference} bestaat al — kies een andere`,`Reference ${p.reference} already exists — choose another`],"save","pf-basis");
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
  if(!txOk(p,"en"))add(["Teksten schrijft Agent SEO direct na opslaan","Agent SEO writes the texts right after saving"],"tip","pf-tekst");
  if(p.key_on&&!/^\d{1,9}$/.test(String(p.key_number||"").trim()))add(["Sleutelnummer (alleen cijfers)","Key number (digits only)"],"save","pf-basis");
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
      const pt=c.partner||{};if(pt.on){if(!String(pt.first_name||"").trim()&&!String(pt.last_name||"").trim())add(["Naam van de partner (of ‘Geen partner’)","Partner's name (or ‘No partner’)"],"save",2,"ct-partner");
        if(String(pt.email||"").trim()&&!emailOk(pt.email.trim()))add([`Ongeldig e-mailadres partner: ${pt.email}`,`Invalid partner e-mail: ${pt.email}`],"save",2,"ct-partner");
        if(String(pt.email||"").trim()&&em.some(e=>e.toLowerCase()===pt.email.trim().toLowerCase()))add(["Partner heeft hetzelfde e-mailadres als het contact","Partner has the same e-mail as the contact"],"save",2,"ct-partner")}
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
    +(DUPS.length&&S.flow==="wizard"?`<div class="ad-chk tip"><h5>${esc(tr(["Mogelijk al in NEXUS","Possibly already in NEXUS"]))}</h5>${DUPS.map(d=>`<a data-usedup="${d.id||d.wp_id}">${esc(d.name||d.email)}<span class="sm muted"> · ${esc(d.why)}</span></a>`).join("")}</div>`:"");
  ROOT.querySelectorAll(".ad-step").forEach(b=>b.classList.toggle("ok",stepDone(+b.dataset.step)));
  ROOT.querySelectorAll(".ad-save").forEach(b=>{b.disabled=!canSave();b.textContent=(BUSY?"… ":"💾 ")+(BUSY?(PROG||tr(["Opslaan…","Saving…"])):b.dataset.lbl||tr(["Opslaan","Save"]))});
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
    year_built:n(p.year_built),orientation:p.orientation||null,
    views:(p.views||[]).join(",")||null,energy_label:p.energy_label||null,features:p.features,feature_options:opts,
    country:p.country||null,province:p.province||null,city:p.municipality||null,location_area:p.area==="__new"?p.area_new:p.area==="__mun"?null:p.area||null,
    location_id:"← core.locations (gemeente/wijk)",street:p.street||null,street_number:p.street_number||null,postal_code:p.postal_code||null,lat:n(p.lat),lng:n(p.lng),hide_address:p.hide_address,
    distance_sea_m:n(p.distance_sea_m),distance_airport_m:n(p.distance_airport_m),distance_city_m:n(p.distance_city_m),distance_shops_m:n(p.distance_shops_m),
    fee_legal:n(p.fee_legal),fee_notary:n(p.fee_notary),fee_registry:n(p.fee_registry),fee_transfer_tax:n(p.fee_transfer_tax),cost_community:n(p.cost_community),cost_ibi:n(p.cost_ibi),
    cost_garbage:n(p.cost_garbage),cost_insurance:n(p.cost_insurance),cadastral_ref:p.cadastral_ref||null,finca_number:p.finca_number||null,key_number:p.key_on?(p.key_number||null):null,labels:(p.labels||[]).filter(x=>x!=="new"),export_feeds:p.export_feeds,
    no_export:p.no_export,registry_name:p.registry_name||null,idufir:p.idufir||null,registry_tomo:p.registry_tomo||null,registry_libro:p.registry_libro||null,registry_folio:p.registry_folio||null,
    registry_inscription:p.registry_inscription||null,deed_build_area:n(p.deed_build_area),deed_plot_area:n(p.deed_plot_area),purchase_date:p.purchase_date||null,purchase_price:n(p.purchase_price),
    purchase_tax:n(p.purchase_tax),purchase_tax_type:p.purchase_tax_type||null,purchase_notary:p.purchase_notary||null,purchase_notary_protocol:p.purchase_notary_protocol||null,deed_read_at:p.deed_read_at||null,owner_contact_id:owner,listing_agent_id:teamName(p.listing_agent),listed_at:p.listed_at||null},
   "core.property_texts":TX_LANGS.filter(l=>Object.values(p.texts[l]||{}).some(Boolean)).map(l=>Object.assign({lang:l},p.texts[l])),
   "core.property_price_history":p.price?[{price:n(p.price),source:"nexus"}]:[],
   "core.property_media":media.map((m,i)=>({kind:m.kind,sort:i,is_main:i===0,caption:m.caption||null,storage_path:`property-media/<property_id>/<media_id>.${(m.name.split(".").pop()||"jpg").toLowerCase()}`,file:m.name,bytes:m.size})),
   "_nog_geen_kolom":Object.fromEntries(Object.entries({price_text:p.price_text,price_temp:p.price_temp,price_temp_until:p.price_temp_until,price_coming_soon:p.price_coming_soon||null,
     dossier_complete:p.dossier_complete||null,utility_rooms:p.utility_rooms,parking_open:p.parking_open,staircases:p.staircases,energy_rating:p.energy_rating,
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

/* ================= OPSLAAN (gekoppeld 18-10-2026, migratie 019) ================= */
let BUSY=false, DONE=null, PROG="";
const nul=v=>v===""||v==null?null:v;
const CONTACT_KEYS=["title","first_name","last_name","company","language","birthday","street","street_number","postcode","city","state","country","website","referred_by","internal_comments"];
function contactFields(c){
  const f={};CONTACT_KEYS.forEach(k=>{const v=typeof c[k]==="string"?c[k].trim():c[k];if(nul(v)!=null)f[k]=v});
  if(c.owner)f.owner_id=String(c.owner);
  f.source=c.source?"nexus:"+c.source:"nexus";
  const sp=Object.fromEntries(Object.entries(c.search||{}).filter(([,v])=>Array.isArray(v)?v.length:v));if(Object.keys(sp).length)f.search_profile=sp;
  if(c.mailing_optin){f.mailing_optin=true;f.mailing_prefs=Object.fromEntries(MAILINGS.map(([k])=>[k,(c.prefs||[]).includes(k)]))}
  return f;
}
const contactEmails=c=>(c.emails||[]).filter(e=>e.email&&e.email.trim()).map((e,i)=>({email:e.email.trim().toLowerCase(),kind:e.kind||null,is_primary:i===0}));
const contactPhones=c=>(c.phones||[]).filter(p=>p.phone&&p.phone.replace(/\D/g,"").length>=6).map((p,i)=>({phone:p.phone.trim(),kind:p.kind||null,is_primary:i===0}));
function locationId(p){if(!p.municipality)return null;
  if(p.area&&p.area!=="__mun"&&p.area!=="__new"&&LOC_ID.area[p.municipality+"|"+p.area])return LOC_ID.area[p.municipality+"|"+p.area];
  return LOC_ID.mun[p.municipality]||null}
function propFields(p){
  const pl=propPayload(p,[],null)["core.properties"];
  const f={reference:p.reference};
  ["own_listing_type","status","published","category","build_type","price","price_previous","price_from","price_on_request","price_fixed","price_hidden",
   "bedrooms","bathrooms","toilets","ensuites","living_rooms","kitchens","floors","floor_level","balconies","terraces","patios","garages","carports",
   "build_area","plot_area","area_living","area_terrace","area_garden","area_kitchen","year_built","orientation","views","energy_label","features","feature_options",
   "country","province","city","location_area","street","street_number","postal_code","lat","lng","hide_address",
   "distance_sea_m","distance_airport_m","distance_city_m","distance_shops_m","fee_legal","fee_notary","fee_registry","fee_transfer_tax",
   "cost_community","cost_ibi","cost_garbage","cost_insurance","cadastral_ref","finca_number","labels","export_feeds","no_export",
   "listed_at","internal_notes","registry_name","idufir","registry_tomo","registry_libro","registry_folio","registry_inscription","deed_build_area","deed_plot_area",
   "purchase_date","purchase_price","purchase_tax","purchase_tax_type","purchase_notary","purchase_notary_protocol","deed_read_at"].forEach(k=>{const v=pl[k];if(v!==undefined&&v!==null&&v!=="")f[k]=v});
  if(f.cadastral_ref)f.cadastral_ref=String(f.cadastral_ref).replace(/\s/g,"").toUpperCase();
  if(p.dossier_complete)f.dossier_complete=true;
  const loc=locationId(p);if(loc)f.location_id=loc;
  if(p.listing_agent)f.listing_agent_id=String(p.listing_agent);
  if(p.key_on&&String(p.key_number||"").trim())f.key_number=String(p.key_number).trim();
  return f;
}
function propTexts(p){const t={};TX_LANGS.forEach(l=>{const x=p.texts&&p.texts[l];if(!x)return;
  const y={};Object.entries(x).forEach(([k,v])=>{if(v&&String(v).trim())y[k]=String(v).trim()});if(Object.keys(y).length)t[l]=y});return t}
function buildSubmit(flow){
  if(flow==="link"){const k=S.lk;return {contact:{mode:"existing",id:k.contact&&k.contact.id,roles:[]},property:{mode:"link",id:k.prop&&k.prop.id,rel:k.rel||"owner"}}}
  if(flow==="prop"){return {contact:{mode:"none"},owner_id:S.wp.owner&&S.wp.owner.id||null,property:{mode:"now",fields:propFields(S.wp.p),texts:propTexts(S.wp.p)}}}
  const out={};
  if(S.agentMode==="existing"&&S.agent)out.agent={mode:"existing",id:S.agent.id};
  else if(S.agentMode==="new"){const a=S.newAgent;
    out.agent={mode:"new",fields:Object.fromEntries(Object.entries({company:a.company,first_name:a.first_name,last_name:a.last_name,language:a.language,website:a.website,source:"nexus"}).filter(([,v])=>nul(v)!=null)),
      emails:a.email?[{email:a.email.trim().toLowerCase(),is_primary:true}]:[],phones:a.phone?[{phone:a.phone.trim(),kind:"work",is_primary:true}]:[]}}
  else out.agent={mode:"none"};
  if(S.contactMode==="existing")out.contact={mode:"existing",id:S.existing&&S.existing.id,roles:S.c.roles||[]};
  else{out.contact={mode:"new",fields:contactFields(S.c),roles:S.c.roles,emails:contactEmails(S.c),phones:contactPhones(S.c)};
    const pt=S.c.partner||{};
    if(pt.on&&(String(pt.first_name||"").trim()||String(pt.last_name||"").trim()))out.contact.partner={
      fields:Object.fromEntries(Object.entries({title:pt.title,first_name:String(pt.first_name||"").trim(),last_name:String(pt.last_name||"").trim()||String(S.c.last_name||"").trim()}).filter(([,v])=>v)),
      emails:String(pt.email||"").trim()?[{email:pt.email.trim().toLowerCase(),is_primary:true}]:[],
      phones:String(pt.phone||"").replace(/\D/g,"").length>=6?[{phone:pt.phone.trim(),kind:"mobile",is_primary:true}]:[]}}
  const m=pm();
  if(m==="now")out.property={mode:"now",fields:propFields(S.p),texts:propTexts(S.p)};
  else if(m==="link"&&S.linkProp)out.property={mode:"link",id:S.linkProp.id,rel:S.linkRel||"owner"};
  else out.property={mode:"none"};
  return out;
}
async function uploadMedia(pid,arr){
  const items=arr.filter(m=>m.file);if(!pid||!items.length)return {n:0,errors:[]};
  if(!X.sb)return {n:0,errors:[tr(["Foto's niet geüpload: verbinding met Storage ontbreekt","Photos not uploaded: no Storage connection"])]};
  const ids=[],errors=[];
  let i=0;for(const m of items){i++;PROG=tr([`Foto's uploaden ${i}/${items.length}…`,`Uploading photos ${i}/${items.length}…`]);updateChecks();try{
    const ext=(m.file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
    const path=`${pid}/nexus-${crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random().toString(36).slice(2)}.${ext}`;
    const up=await X.sb.storage.from("property-media").upload(path,m.file,{contentType:m.file.type,upsert:false});
    if(up.error)throw new Error(up.error.message);
    const r=await X.rpc("nexus_property_media_add",{p_property_id:pid,p_storage_path:path,p_kind:m.kind,p_caption:m.caption||null});
    ids.push({id:r&&r.id,kind:m.kind,caption:m.caption||""});
  }catch(e){errors.push(m.name+": "+(e.message||e))}}
  const ok=ids.filter(x=>x.id);
  if(ok.length){try{let main=false;
    await X.rpc("nexus_property_media_save",{p_property_id:pid,p_items:ok.map((x,i)=>{const im=!main&&x.kind==="photo";if(im)main=true;return {id:x.id,sort:i,is_main:im,caption:x.caption,kind:x.kind}})})
  }catch(e){errors.push(tr(["Volgorde foto's: ","Photo order: "])+(e.message||e))}}
  PROG="";return {n:ok.length,errors};
}
function saveMsg(html,cls){const el=ROOT&&ROOT.querySelector("#adSaveMsg");if(el){el.innerHTML=html;el.className="ad-off sm"+(cls?" "+cls:"")}}
async function submit(){
  if(BUSY||!canSave())return;
  const flow=S.flow;let payload;
  try{payload=buildSubmit(flow)}catch(e){console.error("NEXUS admin buildSubmit",e);return saveMsg(`<b>${esc(tr(["Niet opgeslagen","Not saved"]))}</b>${esc(tr(["Fout bij samenstellen: ","Error building data: "]))+esc(e.message||String(e))}`,"err")}
  if(flow==="wizard"&&payload.contact.mode==="existing"&&!payload.contact.id)return saveMsg(esc(tr(["Kies het bestaande contact opnieuw (oude selectie zonder NEXUS-id).","Pick the existing contact again (old selection without NEXUS id)."])),"err");
  if(payload.agent&&payload.agent.mode==="existing"&&!payload.agent.id)return saveMsg(esc(tr(["Kies de makelaar opnieuw (oude selectie zonder NEXUS-id).","Pick the agent again (old selection without NEXUS id)."])),"err");
  if(payload.property&&payload.property.mode==="link"&&!payload.property.id)return saveMsg(esc(tr(["Kies de woning opnieuw (oude selectie zonder NEXUS-id).","Pick the property again (old selection without NEXUS id)."])),"err");
  BUSY=true;updateChecks();
  let res;
  try{res=await X.rpc("nexus_admin_submit",{p:payload})}
  catch(e){BUSY=false;updateChecks();saveMsg(`<b>${esc(tr(["Niet opgeslagen","Not saved"]))}</b>${esc(e.message||String(e))}`,"err");return}
  const doneName=flow==="wizard"?(S.contactMode==="existing"?(S.existing&&S.existing.name):[S.c.first_name,S.c.last_name].filter(Boolean).join(" ")||S.c.company):flow==="prop"?(S.wp.owner&&S.wp.owner.name):(S.lk.contact&&S.lk.contact.name);
  const media=flow==="wizard"?MEDIA:flow==="prop"?WP_MEDIA:[];
  const up=res&&res.property_id&&(flow==="prop"||pm()==="now")?await uploadMedia(res.property_id,media):{n:0,errors:[]};
  BUSY=false;
  /* concept leegmaken; zelfde scherm blijft open voor de volgende invoer */
  [...MEDIA,...WP_MEDIA].forEach(m=>m.url&&URL.revokeObjectURL(m.url));MEDIA=[];WP_MEDIA=[];DUPS=[];S=blank();S.flow=flow;
  if(X.me()){S.c.owner=S.p.listing_agent=S.wp.p.listing_agent=String(X.me().wp_author_id||"")}
  try{localStorage.removeItem(DRAFT_KEY)}catch(_){}
  DONE={name:doneName||"",contact_id:res&&res.contact_id,reference:res&&res.reference,n:up.n,errors:up.errors,link:flow==="link",
    enrich:res&&res.property_id&&payload.property&&payload.property.mode==="now"?{busy:true}:null};
  render();
  if(DONE.enrich){const me=DONE;fnCall("property-enrich-now",{property_id:res.property_id}).then(r=>{me.enrich=r||{}}).catch(e=>{me.enrich={ok:false,error:e.message||String(e)}}).then(()=>{if(DONE===me)render()})}
  saveMsg(`<b>✓ ${esc(tr(["Opgeslagen","Saved"]))}</b>${esc(DONE.reference?DONE.reference+" · ":"")}${esc(DONE.name)}`,"ok");
}
function doneView(){const d=DONE;
  const btns=[d.reference?`<a class="btn ad-done-go" href="#p/${encodeURIComponent(d.reference)}">${esc(tr(["Open woning","Open property"]))} ${esc(d.reference)}</a>`:"",
    d.contact_id?`<a class="btn" href="#c/${esc(d.contact_id)}">${esc(tr(["Open contact","Open contact"]))}</a>`:"",
    `<button class="btn" id="adDoneNew">${esc(tr(["Nieuwe invoer","New entry"]))}</button>`].join("");
  return `<div class="ad-done"><div class="ad-done-ic">✓</div><h2>${esc(tr(["Opgeslagen in NEXUS","Saved in NEXUS"]))}</h2>
    <p>${d.name?`<b>${esc(d.name)}</b>`:""}${d.name&&d.reference?" · ":""}${d.reference?`${esc(tr(["woning","property"]))} <b>${esc(d.reference)}</b>`:""}${d.n?esc(tr([` · ${d.n} bestand(en) geüpload`,` · ${d.n} file(s) uploaded`])):""}</p>
    ${d.errors&&d.errors.length?`<div class="ad-bad" style="text-align:left">${esc(tr(["Niet alle bestanden zijn geüpload — voeg ze toe via Bewerken bij de woning:","Not all files were uploaded — add them via Edit on the property:"]))}<br>${d.errors.map(esc).join("<br>")}</div>`:""}
    ${d.enrich?enrichView(d.enrich):""}
    <div class="ad-done-btns">${btns}</div></div>`}
function enrichView(e){
  if(e.busy)return `<div class="ad-enrich busy"><span class="ad-spin"></span>${esc(tr(["Kadaster wordt opgehaald en Agent SEO schrijft de teksten (±1 minuut)…","Fetching cadastre and Agent SEO is writing the texts (±1 minute)…"]))}</div>`;
  const c=e.catastro||null, seo=e.seo||{};
  const cat=c?(c.status==="ok"?`✓ ${esc(tr(["Kadaster","Cadastre"]))}: ${esc(c.cadastral_ref||"")}${c.year_built?" · "+esc(tr(["bouwjaar ","built "]))+c.year_built:""}${c.build_area_m2?" · "+c.build_area_m2+" m²":""}${c.parcel_area_m2?" · "+esc(tr(["perceel ","plot "]))+c.parcel_area_m2+" m²":""}`
      :`⚠ ${esc(tr(["Kadaster niet gevonden","Cadastre not found"]))}${c.error?": "+esc(c.error):""}`):(e.pending?"":`⚠ ${esc(tr(["Kadaster: geen resultaat","Cadastre: no result"]))}`);
  const txt=(seo.written||[]).length?`✓ ${esc(tr(["Teksten geschreven door Agent SEO (EN); NL en SV volgen binnen enkele minuten","Texts written by Agent SEO (EN); NL and SV follow within minutes"]))}`
      :e.pending?`… ${esc(tr(["Duurt langer dan verwacht; het loopt op de achtergrond door","Taking longer than expected; it continues in the background"]))}`
      :`⚠ ${esc(tr(["Teksten nog niet geschreven","Texts not written yet"]))}${e.error?": "+esc(e.error):""}`;
  return `<div class="ad-enrich ${e.ok?"ok":"warn"}">${cat?`<div>${cat}</div>`:""}<div>${txt}</div></div>`}

/* ================= ZOEKEN (alleen-lezen via bestaande RPC's) ================= */
let DUPS=[], dupT;
async function searchContacts(q,role){if(!q||q.trim().length<2)return[];try{const r=await X.rpc("nexus_search",{p_q:q.trim(),p_role:role||null,p_scope:"all",p_limit:8,p_offset:0});return r.rows||[]}catch(e){return[]}}
async function searchProps(q){if(!q||q.trim().length<2)return[];try{const r=await X.rpc("nexus_properties",{p_q:q.trim(),p_status:"",p_limit:8,p_offset:0});return r.rows||[]}catch(e){return[]}}
const resRow=c=>`<button class="ad-hit" data-pick='${esc(JSON.stringify({id:c.id,wp_id:c.wp_id,name:c.name,email:c.email,city:c.city,roles:c.roles}))}'>
  <div class="ini" style="background:hsl(${[...String(c.name||c.email||"")].reduce((h,ch)=>(h*31+ch.charCodeAt(0))%360,0)} 55% 42%)">${esc(((c.name||c.email||"?")[0]||"?").toUpperCase())}</div>
  <div style="min-width:0"><b>${esc(c.name||c.email||"—")}</b><div class="sm muted">${(c.roles||[]).map(r=>esc(r)).join(", ")} ${esc([c.email,c.city].filter(Boolean).join(" · "))}</div></div><span class="sm muted">WP ${esc(c.wp_id)}</span></button>`;
const propRow=p=>`<button class="ad-hit" data-pickp='${esc(JSON.stringify({id:p.id,wp_id:p.wp_id,reference:p.reference,price:p.price,town:p.town,suburb:p.suburb,image:p.image,owner:p.owner,owner_wp_id:p.owner_wp_id}))}'>
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
  for(const q of qs){for(const r of await searchContacts(q)){const key=r.id||r.wp_id;if(!found[key])found[key]=Object.assign({},r,{why:q.includes("@")?"e-mail":/^\d+$/.test(q)?tr(["telefoon","phone"]):tr(["naam","name"])})}}
  DUPS=Object.values(found).slice(0,5);
  const box=ROOT.querySelector("#adDup");
  if(box)box.innerHTML=DUPS.length?`<div class="ad-warnbox"><b>${esc(tr(["Dit contact bestaat mogelijk al","This contact may already exist"]))}</b>${DUPS.map(d=>`<div class="ad-duprow"><span>${esc(d.name||d.email)} <span class="sm muted">· ${esc(d.why)} · ${esc((d.roles||[]).join(", "))}</span></span><button class="btn sm" data-usedup="${d.id||d.wp_id}">${esc(tr(["Gebruik dit contact","Use this contact"]))}</button></div>`).join("")}</div>`:"";
  updateChecks();
}
const REF_TAKEN={};
async function checkRef(base){const p=getP(S,base);const box=ROOT.querySelector("#adRefCheck");if(!box)return;
  if(!/^[A-Z]{2}\d{3}$/.test(p.reference||"")){box.innerHTML="";return}
  const rows=await searchProps(p.reference);const hit=rows.find(r=>String(r.reference).toUpperCase()===p.reference);
  REF_TAKEN[p.reference]=!!hit;updateChecks();
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
    if(fly)MAP.setView([lat,lng],17);persist();updateChecks();autoDist(base)};
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
    arr.push({id:Math.random().toString(36).slice(2),file,name:file.name,size:file.size,type:file.type,url:file.type.startsWith("image/")?URL.createObjectURL(file):null,
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

/* ================= ADRES · AFSTANDEN · TEKSTEN (19-10-2026) ================= */
const GEO_Q={};             // handmatig getypte zoektekst per formulier; anders volgt het zoekveld het adres
const areaName=p=>p.area==="__new"?p.area_new:p.area==="__mun"?"":p.area;
function geoAddr(p){const base=p===S.p?"p":"wp.p";if(GEO_Q[base]!=null)return GEO_Q[base];
  const st=[p.street,p.street_number].filter(Boolean).join(" ");
  return [st,[p.postal_code,p.municipality].filter(Boolean).join(" "),st?"":areaName(p)].filter(Boolean).join(", ")}
function syncGeo(base){if(GEO_Q[base]!=null)return;const q=ROOT.querySelector("#adGeoQ");if(q&&q.dataset.base===base)q.value=geoAddr(getP(S,base))}
const distInfo=p=>p._dist_info||"";
async function fnCall(name,body){
  if(!X||!X.sb)throw new Error(tr(["Geen verbinding met de server","No connection to the server"]));
  const {data,error}=await X.sb.functions.invoke(name,{body});
  if(error){let m=error.message;try{const j=await error.context.json();m=j.error||m}catch(_){}throw new Error(m)}
  if(data&&data.ok===false)throw new Error(data.error||"error");
  return data;
}
let DIST_T={}, DIST_TRIED={};
function autoDist(base){const p=getP(S,base);if(["distance_sea_m","distance_airport_m","distance_city_m","distance_shops_m"].some(k=>p[k]!==""&&p[k]!=null))return;
  const key=base+"|"+p.lat+"|"+p.lng;if(DIST_TRIED[key])return;
  clearTimeout(DIST_T[base]);DIST_T[base]=setTimeout(()=>{DIST_TRIED[key]=1;calcDist(base,false)},900)}
async function calcDist(base,force){const p=getP(S,base), info=ROOT.querySelector(`#adDistInfo-${base.replace(".","_")}`);
  if(p.lat===""||p.lng===""){if(info)info.textContent=tr(["Zet eerst de pin op de kaart.","Place the pin on the map first."]);return}
  if(info)info.textContent=tr(["Afstanden worden berekend…","Calculating distances…"]);
  try{const r=await fnCall("property-distances",{lat:+p.lat,lng:+p.lng,municipality:p.municipality||null,area:areaName(p)||null});
    const map={distance_sea_m:r.sea_m,distance_airport_m:r.airport_m,distance_city_m:r.city_m,distance_shops_m:r.shops_m};
    Object.entries(map).forEach(([k,v])=>{if(v==null)return;if(force||p[k]===""||p[k]==null){setP(S,base+"."+k,String(v));ROOT.querySelectorAll(`[data-k="${base}.${k}"]`).forEach(x=>x.value=v)}});
    p._dist_info=tr(["Hemelsbreed berekend","Straight line"])+" · "+[r.airport&&tr(["luchthaven ","airport "])+r.airport,r.centre&&tr(["centrum ","centre "])+r.centre,r.shop&&tr(["winkel ","shop "])+r.shop].filter(Boolean).join(" · ");
    if(info)info.textContent=p._dist_info;persist();updateChecks()}
  catch(e){if(info)info.textContent=tr(["Afstanden niet berekend: ","Distances not calculated: "])+(e.message||e)}}
let GEN_BUSY=false;
const featModel=base=>({get:()=>{const p=getP(S,base);return{features:p.features||[],opts:p.opts||{}}},set:(f,o)=>{const p=getP(S,base);p.features=f;p.opts=o}});
async function keyToggle(base,on){const p=getP(S,base);
  if(!on){p.key_number="";persist();render();return}
  render();
  try{const n=await X.rpc("nexus_key_number_next",{});if(n&&!p.key_number)p.key_number=String(n)}catch(e){saveMsg(esc(tr(["Sleutelnummer ophalen lukt nog niet: ","Could not fetch a key number yet: "])+(e.message||e)),"err")}
  persist();render()}

/* ================= EVENTS ================= */
function bind(){
  ROOT.addEventListener("input",e=>{const el=e.target, k=el.dataset&&el.dataset.k;
    if(el.id==="adGeoQ"){GEO_Q[el.dataset.base]=el.value;return}
    if(el.dataset.fxc||el.dataset.fxl){const w=el.closest("[data-fxbase]");if(w&&window.NEXUS_FEAT&&NEXUS_FEAT.handle(el,featModel(w.dataset.fxbase))){persist();render()}return}
    if(!k)return;
    if(el.dataset.arr!=null){const a=getP(S,k)||[];const v=el.dataset.arr;const nx=el.checked?[...new Set([...a,v])]:a.filter(x=>x!==v);setP(S,k,nx);
      const ch=el.closest(".chip");if(ch)ch.classList.toggle("on",el.checked);
      if(k==="c.roles"&&S.flow==="wizard"&&S.step===2){persist();render();return}
      if(k==="c.prefs"||/\.opts\./.test(k)){const d=el.closest("details");if(d){const s=d.querySelector("summary .sm");if(s)s.textContent=(getP(S,k)||[]).length||""}}}
    else if(el.dataset.bool!=null){setP(S,k,el.checked);if(/\.key_on$/.test(k)){keyToggle(k.replace(/\.key_on$/,""),el.checked);return}if(k==="c.mailing_optin"){const cur=(S.c.prefs||[]).filter(x=>MAILINGS.some(m=>m[0]===x));S.c.prefs=el.checked&&!cur.length?[...MAILING_DEFAULT_ON]:cur;persist();render();return}}
    else{let v=el.value;if(/\.reference$/.test(k)){v=v.toUpperCase().replace(/\s/g,"");if(el.value!==v)el.value=v}setP(S,k,v)}
    if(/\.(street|street_number|postal_code)$/.test(k))syncGeo(k.replace(/\.[a-z_]+$/,""));
    if(/\.(municipality|area)$/.test(k)){if(/municipality$/.test(k))setP(S,k.replace(/municipality$/,"area"),"");persist();render();return}
    if(/\.(lat|lng)$/.test(k)&&MAP&&MAP._place){const b=k.replace(/\.(lat|lng)$/,""),p=getP(S,b);if(p.lat!==""&&p.lng!==""&&!isNaN(+p.lat)&&!isNaN(+p.lng))MAP._place(p.lat,p.lng,true)}
    if(/\.(lat|lng)$/.test(k))autoDist(k.replace(/\.(lat|lng)$/,""));
    if(/\.texts\./.test(k)){const b=ROOT.querySelector(`[data-tx="${txLang}"]`);if(b){const base=k.split(".texts.")[0];b.textContent=txLang.toUpperCase()+(txOk(getP(S,base),txLang)?" ✓":"")}}
    if(/^newAgent\./.test(k))agentDup();
    if(/^c\.(emails|phones|first_name|last_name)/.test(k)){clearTimeout(dupT);dupT=setTimeout(checkDups,600)}
    if(k==="c.first_name"){const h=ROOT.querySelector("#adPtHint");if(h)h.innerHTML=ptHint()}
    if(/\.reference$/.test(k)){clearTimeout(dupT);dupT=setTimeout(()=>checkRef(k.replace(/\.reference$/,"")),500)}
    persist();updateChecks()});
  ROOT.addEventListener("click",e=>{const t=e.target.closest("button,a");if(!t||!ROOT.contains(t))return;const d=t.dataset;
    if(t.id==="adDoneNew"){DONE=null;render();return}
    if(d.deed&&window.NEXUS_DEED){e.preventDefault();const base=d.deed, p=getP(S,base);
      NEXUS_DEED.run({sb:X.sb,tr,current:p,onApply:v=>{Object.entries(v).forEach(([k,x])=>setP(S,base+"."+k,x==null?"":String(x)));persist();render();
        const s=ROOT.querySelector("#pf-kost");if(s)s.scrollIntoView({block:"start"})}});return}
    if(DONE&&(d.flow||d.step))DONE=null;
    if(d.flow){S.flow=d.flow;persist();render();ROOT.querySelector("#adMain").scrollTop=0;return}
    if(d.step){S.step=+d.step;if(S.step===3&&!isSeller())S.step=4;S.flow="wizard";persist();render();ROOT.querySelector("#adMain").scrollTop=0;
      if(d.jump)setTimeout(()=>{const s=ROOT.querySelector("#"+d.jump);if(s)s.scrollIntoView({behavior:"smooth",block:"start"})},50);return}
    if(d.jump){e.preventDefault();const s=ROOT.querySelector("#"+d.jump);if(s)s.scrollIntoView({behavior:"smooth",block:"start"});return}
    if(d.am){S.agentMode=d.am;persist();render();return}
    if(d.cm){S.contactMode=d.cm;persist();render();return}
    if(d.ptadd){e.preventDefault();S.c.partner=Object.assign(blankContact().partner,{on:true,last_name:S.c.last_name||""});persist();render();return}
    if(d.ptdel){e.preventDefault();S.c.partner=blankContact().partner;persist();render();return}
    if(d.ptsplit){e.preventDefault();const x=coupleSplit(S.c.first_name);if(x){S.c.first_name=x[0];if(/&|mr\s*mrs|\band\b/i.test(S.c.title||""))S.c.title="";
      S.c.partner=Object.assign(blankContact().partner,{on:true,first_name:x[1],last_name:S.c.last_name||""})}persist();render();
      const s=ROOT.querySelector("#ct-partner");if(s)s.scrollIntoView({behavior:"smooth",block:"start"});return}
    if(d.pm){S.propMode=d.pm;persist();render();return}
    if(d.tx){txLang=d.tx;render();const s=ROOT.querySelector("#pf-tekst");if(s)s.scrollIntoView({block:"start"});return}
    if(d.add){e.preventDefault();S.c[d.add].push(d.add==="emails"?{email:"",kind:""}:{phone:"",kind:"mobile"});persist();render();return}
    if(d.rm){e.preventDefault();S.c[d.rm].splice(+d.i,1);persist();render();return}
    if(d.clear){({agent:()=>S.agent=null,existing:()=>S.existing=null,linkProp:()=>S.linkProp=null,wpOwner:()=>S.wp.owner=null,lkContact:()=>S.lk.contact=null,lkProp:()=>S.lk.prop=null})[d.clear]();persist();render();return}
    if(d.usedup){const x=DUPS.find(y=>String(y.id||y.wp_id)===d.usedup);if(x){S.contactMode="existing";S.existing={id:x.id,wp_id:x.wp_id,name:x.name,email:x.email,city:x.city,roles:x.roles};S.step=2;S.flow="wizard";DUPS=[];persist();render()}return}
    if(d.save){e.preventDefault();submit().catch(err=>{BUSY=false;updateChecks();console.error("NEXUS admin submit",err);saveMsg(`<b>${esc(tr(["Niet opgeslagen","Not saved"]))}</b>${esc((err&&err.message)||String(err))}`,"err")});return}
    if(d.dist){e.preventDefault();calcDist(d.dist,true);return}
    if(d.fxr){e.preventDefault();const w=t.closest("[data-fxbase]");if(w&&window.NEXUS_FEAT&&NEXUS_FEAT.handle(t,featModel(w.dataset.fxbase))){persist();render()}return}
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
  box.innerHTML=rows.length?`<div class="ad-warnbox"><b>${esc(tr(["Bestaat deze makelaar al?","Does this agent already exist?"]))}</b>${rows.slice(0,4).map(r=>`<div class="ad-duprow"><span>${esc(r.name||r.email)} <span class="sm muted">· ${esc((r.roles||[]).join(", "))}</span></span><button class="btn sm" data-useagent='${esc(JSON.stringify({id:r.id,wp_id:r.wp_id,name:r.name,email:r.email,city:r.city}))}'>${esc(tr(["Gebruik deze","Use this one"]))}</button></div>`).join("")}</div>`:"";
  box.querySelectorAll("[data-useagent]").forEach(b=>b.onclick=()=>{S.agent=JSON.parse(b.dataset.useagent);S.agentMode="existing";persist();render()})},500)}

window.NEXUS_ADMIN={open,rerender:()=>{if(ROOT&&ROOT.dataset.init)render()},
  /* vanuit Contacten: direct de workflow "Nieuw contact" openen (stap 2 = contact als er geen aanbrenger is) */
  startNewContact:()=>{const f=()=>{S.flow="wizard";S.step=1;S.contactMode="new";persist()};if(ROOT&&ROOT.dataset.init){f();render()}else PENDING=f},
  /* vanuit een contact dat Seller wordt: 'Woning toevoegen' met dit contact als eigenaar */
  startNewProperty:owner=>{const f=()=>{DONE=null;S.flow="prop";S.wp=S.wp||{owner:null,p:blankProp()};S.wp.owner=owner||null;persist()};if(ROOT&&ROOT.dataset.init){f();render()}else PENDING=f}};
})();
