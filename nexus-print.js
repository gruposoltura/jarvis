/* NEXUS · Afdrukken (Rick, 26-10-2026).
   Een plek om alles af te drukken wat het team op papier meegeeft:
   1) Woningbrochure op referentie: voorbeeld via rpc nexus_brochure_data (nexus_gate), printen via NEXUS_BROCHURE.print
      (agent LeadProcessor-v2, webhook nexus-brochure, variant window - BD-160). Hier geen eigen brochure-opmaak.
   2) De PDF's uit de map downloads van de website (repo gruposoltura/soltura-web, geserveerd op gruposoltura.com/downloads/).
      De lijst komt live uit de GitHub-API (publieke repo), zodat een nieuwe PDF in die map vanzelf verschijnt;
      lukt dat niet, dan de vaste lijst hieronder. Bekende documenten worden per soort gegroepeerd met een knop per taal,
      onbekende PDF's komen onder Overige.
   Printen: PDF ophalen als blob (GitHub Pages geeft CORS *), in een verborgen iframe laden en daar print() aanroepen.
   Lukt dat niet (bv. Safari), dan opent de PDF in een nieuw tabblad. */
(function(){
"use strict";
window.NEXUS_I18N=window.NEXUS_I18N||{nl:{},en:{}};
Object.assign(window.NEXUS_I18N.nl,{"tab.dr":"Afdrukken"});
Object.assign(window.NEXUS_I18N.en,{"tab.dr":"Print"});

const SITE="https://gruposoltura.com/downloads/";
const API="https://api.github.com/repos/gruposoltura/soltura-web/contents/downloads?ref=main";
const CACHE_KEY="nexus-print-list";
const LANGS=["nl","en","es","sv"];
/* Bekende documenten: herkend op bestandsnaam (jaartal mag wisselen). Optioneel hide: [talen] om een taal te verbergen.
   De koopgids bestaat in NL/EN/ES/SV (Rick 26-10-2026). */
const DOCS=[
  {k:"guide",ico:"📘",t:["Woon- en koopgids","Living & buying guide"],d:["De complete gids voor kopers","The complete guide for buyers"],
   m:[[/woon-en-koopgids/i,"nl"],[/buying-guide/i,"en"],[/guia-de-compra/i,"es"],[/kopguide/i,"sv"]]},
  {k:"cost",ico:"🧾",t:["Kostenoverzicht koper","Buyer cost overview"],d:["Kosten bij aankoop, zonder bedragen per woning","Purchase costs, without per-property amounts"],
   m:[[/kostenoverzicht/i,"nl"],[/cost-overview/i,"en"],[/resumen-de-gastos/i,"es"],[/kostnadsoversikt/i,"sv"]]},
  {k:"allin",ico:"🤝",t:["All-in-one tarief","All-in-one fee"],d:["Infotorial over het all-in tarief","Infotorial about the all-in fee"],
   m:[[/alles-in-een-tarief/i,"nl"],[/all-in-one-fee/i,"en"],[/tarifa-todo-incluido/i,"es"],[/allt-i-ett-arvode/i,"sv"]]},
  {k:"seller",ico:"🏡",t:["Verkoopbegeleiding","Seller guidance"],d:["Voor eigenaren die willen verkopen","For owners who want to sell"],
   m:[[/verkoopbegeleiding/i,"nl"],[/seller-guidance/i,"en"],[/acompanamiento-en-la-venta/i,"es"],[/saljradgivning/i,"sv"]]}
];
const FALLBACK=["soltura-woon-en-koopgids-2026-nl.pdf","soltura-buying-guide-2026-en.pdf","soltura-guia-de-compra-2026-es.pdf","soltura-kopguide-2026-sv.pdf",
  "soltura-kostenoverzicht-2026-nl.pdf","soltura-cost-overview-2026-en.pdf","soltura-resumen-de-gastos-2026-es.pdf","soltura-kostnadsoversikt-2026-sv.pdf",
  "Alles-in-een-tarief.pdf","All-in-one-fee.pdf","Tarifa-todo-incluido.pdf","Allt-i-ett-arvode.pdf",
  "Soltura-verkoopbegeleiding.pdf","Soltura-seller-guidance.pdf","Soltura-acompanamiento-en-la-venta.pdf","Soltura-saljradgivning.pdf"].map(n=>({name:n,size:null}));

let X=null, ROOT=null, FILES=null, LIVE=false, BLANG=null, PREV=null, BUSY=false;
const ui=()=>X&&X.lang&&X.lang()==="en"?"en":"nl";
const tr=v=>Array.isArray(v)?(ui()==="en"?v[1]:v[0]):v;
const esc=v=>v==null?"":String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const mb=n=>n==null?"":(n>=1048576?(n/1048576).toLocaleString(ui()==="en"?"en-GB":"nl-NL",{maximumFractionDigits:1})+" MB":Math.round(n/1024)+" KB");
const eur=v=>v==null?"":"€"+Math.round(Number(v)).toLocaleString("nl-NL");
const $=s=>ROOT&&ROOT.querySelector(s);

/* ---------- lijst downloads ---------- */
async function loadFiles(){
  try{const c=JSON.parse(sessionStorage.getItem(CACHE_KEY)||"null");if(c&&Date.now()-c.at<10*60*1000){FILES=c.files;LIVE=true;return}}catch(e){}
  try{
    const r=await fetch(API,{headers:{Accept:"application/vnd.github+json"}});
    if(!r.ok)throw new Error("HTTP "+r.status);
    const j=await r.json();
    FILES=(Array.isArray(j)?j:[]).filter(f=>f.type==="file"&&/\.pdf$/i.test(f.name)).map(f=>({name:f.name,size:f.size}));
    LIVE=true;
    try{sessionStorage.setItem(CACHE_KEY,JSON.stringify({at:Date.now(),files:FILES}))}catch(e){}
  }catch(e){FILES=FALLBACK;LIVE=false}
}
function group(){
  const used=new Set();
  const docs=DOCS.map(d=>{const by={};
    for(const f of FILES){for(const [re,l] of d.m){if(re.test(f.name)){used.add(f.name);if(!(d.hide||[]).includes(l)&&!by[l])by[l]=f}}}
    return {d,by}}).filter(x=>Object.keys(x.by).length);
  const rest=FILES.filter(f=>!used.has(f.name));
  return {docs,rest};
}

/* ---------- PDF printen ---------- */
async function printPdf(name,btn){
  const url=SITE+encodeURIComponent(name);
  const old=btn?btn.innerHTML:null;
  if(btn){btn.disabled=true;btn.classList.add("busy");btn.innerHTML="…"}
  const done=()=>{if(btn){btn.disabled=false;btn.classList.remove("busy");btn.innerHTML=old}};
  const fallback=()=>{done();window.open(url,"_blank","noopener")};
  try{
    const r=await fetch(url,{cache:"no-cache"});
    if(!r.ok)throw new Error("HTTP "+r.status);
    const blob=await r.blob();
    const obj=URL.createObjectURL(new Blob([blob],{type:"application/pdf"}));
    document.querySelectorAll("iframe.dr-frame").forEach(f=>f.remove());
    const fr=document.createElement("iframe");fr.className="dr-frame";fr.setAttribute("aria-hidden","true");
    fr.style.cssText="position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none";
    let fired=false;
    fr.onload=()=>{if(fired)return;fired=true;setTimeout(()=>{try{fr.contentWindow.focus();fr.contentWindow.print();done()}catch(e){fallback()}
      setTimeout(()=>{try{URL.revokeObjectURL(obj)}catch(e){}},60000)},400)};
    fr.src=obj;document.body.appendChild(fr);
    setTimeout(()=>{if(!fired){fired=true;fallback()}},15000);
  }catch(e){fallback()}
}

/* ---------- woningbrochure ---------- */
async function lookup(){
  const inp=$("#drRef");const ref=(inp.value||"").trim().toUpperCase().replace(/\s+/g,"");
  inp.value=ref;
  const box=$("#drPrev");
  if(!ref){PREV=null;box.innerHTML="";return}
  if(BUSY)return;BUSY=true;
  box.innerHTML='<div class="dr-msg">'+tr(["Zoeken…","Searching…"])+'</div>';
  try{
    const d=await X.rpc("nexus_brochure_data",{p_ref:ref});
    const p=d&&d.p;
    if(!p){PREV=null;box.innerHTML='<div class="dr-msg bad">'+esc(tr(["Geen woning gevonden met referentie ","No property found with reference "]))+'<b>'+esc(ref)+'</b></div>';return}
    PREV=p;renderPrev();
  }catch(e){PREV=null;box.innerHTML='<div class="dr-msg bad">'+esc(tr(["Fout: ","Error: "])+(e.message||e))+'</div>'}
  finally{BUSY=false}
}
function renderPrev(){
  const box=$("#drPrev");const p=PREV;if(!box)return;if(!p){box.innerHTML="";return}
  const ph=Array.isArray(p.photos)&&p.photos[0]?(typeof p.photos[0]==="string"?p.photos[0]:p.photos[0].url||p.photos[0].src):null;
  const ok=!!p.url_new;
  const st=p.status==="sold"?tr(["Verkocht","Sold"]):p.under_offer||p.status==="reserved"?tr(["Gereserveerd","Reserved"]):null;
  const facts=[p.bedrooms!=null?p.bedrooms+" "+tr(["slpk","bed"]):"",p.bathrooms!=null?p.bathrooms+" "+tr(["badk","bath"]):"",p.build_area?p.build_area+" m²":""].filter(Boolean).join(" · ");
  box.innerHTML='<div class="dr-prop">'+(ph?'<div class="dr-ph" style="background-image:url(\''+esc(ph)+'\')"></div>':'<div class="dr-ph none">🏠</div>')+
    '<div class="dr-pi"><div class="dr-pr"><b>'+esc(p.reference)+'</b>'+(st?'<span class="dr-st">'+esc(st)+'</span>':'')+'</div>'+
    '<div class="dr-pt">'+esc([p.category?p.category.charAt(0).toUpperCase()+p.category.slice(1):"",[p.suburb,p.town].filter(Boolean).join(", ")].filter(Boolean).join(" · "))+'</div>'+
    '<div class="dr-pf">'+esc(facts)+(p.price?' <span class="dr-price">'+(p.price_from?tr(["vanaf ","from "]):"")+eur(p.price)+'</span>':'')+'</div>'+
    (ok?'':'<div class="dr-msg bad">'+tr(["Deze woning staat niet op de nieuwe website; er is geen brochure.","This property is not on the new website; there is no brochure."])+'</div>')+
    '</div></div>'+
    (ok?'<button class="btn dr-go" type="button" id="drGo">🖨 '+tr(["Brochure afdrukken","Print brochure"])+' · '+BLANG.toUpperCase()+'</button><div class="dr-hint">'+tr(["Opent het printvenster; kies daar je printer of Opslaan als PDF.","Opens the print dialog; choose your printer or Save as PDF."])+'</div>':'');
  const go=$("#drGo");if(go)go.onclick=()=>window.NEXUS_BROCHURE&&NEXUS_BROCHURE.print(p.reference,BLANG,{sb:X.sb,lang:X.lang});
}

/* ---------- render ---------- */
function render(){
  if(!ROOT)return;
  if(!BLANG)BLANG=ui();
  const g=FILES?group():null;
  const dl=!FILES?'<div class="dr-msg">'+tr(["Laden…","Loading…"])+'</div>':
    g.docs.map(({d,by})=>'<div class="dr-doc"><div class="dr-di">'+d.ico+'</div><div class="dr-dt"><b>'+esc(tr(d.t))+'</b><span>'+esc(tr(d.d))+'</span></div><div class="dr-langs">'+
      LANGS.filter(l=>by[l]).map(l=>'<span class="dr-lp"><button class="dr-l" type="button" data-pdf="'+esc(by[l].name)+'" title="'+esc(tr(["Afdrukken: ","Print: "])+by[l].name+(by[l].size?" · "+mb(by[l].size):""))+'">🖨 '+l.toUpperCase()+'</button><a class="dr-o" href="'+esc(SITE+encodeURIComponent(by[l].name))+'" target="_blank" rel="noopener" title="'+esc(tr(["Openen in een nieuw tabblad","Open in a new tab"]))+'">↗</a></span>').join("")+
      '</div></div>').join("")+
    (g.rest.length?'<div class="dr-sec">'+tr(["Overige PDF's","Other PDFs"])+'</div>'+g.rest.map(f=>'<div class="dr-doc"><div class="dr-di">📄</div><div class="dr-dt"><b>'+esc(f.name.replace(/\.pdf$/i,""))+'</b><span>'+esc(mb(f.size))+'</span></div><div class="dr-langs"><span class="dr-lp"><button class="dr-l" type="button" data-pdf="'+esc(f.name)+'">🖨 '+tr(["Afdrukken","Print"])+'</button><a class="dr-o" href="'+esc(SITE+encodeURIComponent(f.name))+'" target="_blank" rel="noopener">↗</a></span></div></div>').join(""):"")+
    (LIVE?"":'<div class="dr-msg">'+tr(["Lijst uit de vaste set (GitHub niet bereikbaar).","List from the fixed set (GitHub unreachable)."])+'</div>');
  const keep=ROOT.querySelector("#drRef")?ROOT.querySelector("#drRef").value:"";
  ROOT.innerHTML='<div class="dr-wrap"><div class="dr-grid">'+
    '<div class="card dr-card dr-bro"><div class="hd"><h3>'+tr(["Woningbrochure","Property brochure"])+'</h3></div><div class="dr-body">'+
      '<form class="dr-find" id="drFind" autocomplete="off"><input id="drRef" type="search" spellcheck="false" placeholder="'+esc(tr(["Referentie, bv. RH550","Reference, e.g. RH550"]))+'" value="'+esc(keep)+'"><button class="btn" type="submit">'+tr(["Zoek","Find"])+'</button></form>'+
      '<div class="dr-lab">'+tr(["Taal van de brochure","Brochure language"])+'</div><div class="seg dr-bl" id="drBl">'+LANGS.map(l=>'<button type="button" data-l="'+l+'"'+(l===BLANG?' class="on"':'')+'>'+l.toUpperCase()+'</button>').join("")+'</div>'+
      '<div id="drPrev"></div></div></div>'+
    '<div class="card dr-card"><div class="hd"><h3>'+tr(["Brochures en documenten","Brochures and documents"])+'</h3><span class="sm muted">gruposoltura.com/downloads</span></div><div class="dr-body dr-list">'+dl+'</div></div>'+
  '</div></div>';
  $("#drFind").onsubmit=e=>{e.preventDefault();lookup()};
  ROOT.querySelectorAll("#drBl button").forEach(b=>b.onclick=()=>{BLANG=b.dataset.l;ROOT.querySelectorAll("#drBl button").forEach(x=>x.classList.toggle("on",x===b));renderPrev()});
  ROOT.querySelectorAll("[data-pdf]").forEach(b=>b.onclick=()=>printPdf(b.dataset.pdf,b));
  renderPrev();
}

async function open(root,ctx){
  X=ctx;ROOT=root;
  render();
  if(!FILES){await loadFiles();render()}
  setTimeout(()=>{const i=$("#drRef");if(i&&!i.value)i.focus()},0);
}
function rerender(){if(ROOT)render()}
window.NEXUS_PRINT={open,rerender,printPdf};
})();
