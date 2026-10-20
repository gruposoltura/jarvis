/* NEXUS · Rapportage — rapporten bekijken, afdrukken en als PDF opslaan (Rick, 20-10-2026).
   Eerste rapport: "Verkopen & commissie" per jaar, zelfde indeling als het oude rapport (oude WordPress → Sales Info):
     1) Verkopen <jaar>: REFNR · In aanbod · Verkocht · Dagen · Verkoper · Koper · Vraagprijs · Verkoopprijs · Verschil ·
        Comm A · Comm B · Conv · Type · Protocol · Notaris (nieuwste verkoop bovenaan)
     2) Commissietotalen: Comm A / Comm B / Conv per maand, jaartotaal vooraan, voor het gekozen jaar én het jaar ervoor.
   Data: RPC nexus_report_sales(p_year) (migratie 042) — alleen admin, omdat commissies admin-only zijn.
   Afdrukken = browserprint met eigen printopmaak (A4 liggend). PDF = direct downloaden via jsPDF (cdnjs, pas geladen bij de eerste klik). */
(function(){
"use strict";
window.NEXUS_I18N=window.NEXUS_I18N||{nl:{},en:{}};
Object.assign(window.NEXUS_I18N.nl,{"tab.rp":"Rapportage"});
Object.assign(window.NEXUS_I18N.en,{"tab.rp":"Reports"});

let X=null, ROOT=null, YEAR=null, YEARS=null, D=null, BUSY=false;
const tr=v=>Array.isArray(v)?(X&&X.lang()==="en"?v[1]:v[0]):v;
const esc=v=>v==null?"":String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const LOC=()=>X&&X.lang()==="en"?"en-GB":"nl-NL";
const eur=v=>v==null||v===""?"€0":"€"+Math.round(Number(v)).toLocaleString("nl-NL");
const eurOrDash=v=>v==null||v===""?"—":eur(v);
const dmy=v=>v?window.NEXUS_DMY(v):"—";
const cap=s=>s?String(s).charAt(0).toUpperCase()+String(s).slice(1):"";
const MONTHS=()=>Array.from({length:12},(_,i)=>cap(new Date(2026,i,1).toLocaleDateString(LOC(),{month:"long"})));
const sum=a=>(a||[]).reduce((s,x)=>s+(Number(x)||0),0);
function diff(r){if(!r.price||r.sold_price==null)return null;return (Number(r.sold_price)/Number(r.price)-1)*100}
const pct=v=>v==null?"—":(v>0?"+":"")+v.toLocaleString(LOC(),{maximumFractionDigits:1})+"%";

const COLS=()=>[
  ["reference","REFNR"],["list_date",tr(["In aanbod","Listed"])],["sold_date",tr(["Verkocht","Sold"])],["days",tr(["Dagen","Days"])],
  ["seller",tr(["Verkoper","Seller"])],["buyer",tr(["Koper","Buyer"])],["price",tr(["Vraagprijs","Price"])],["sold_price",tr(["Verkoopprijs","Sold"])],
  ["diff",tr(["Verschil","Difference"])],["commission_a","Comm A"],["commission_b","Comm B"],["conveyancing","Conv"],
  ["type","Type"],["protocol","Protocol"],["notary",tr(["Notaris","Notary"])]];
const NUMC=new Set(["days","price","sold_price","diff","commission_a","commission_b","conveyancing","protocol"]);
function cell(r,k){switch(k){
  case "list_date":case "sold_date":return dmy(r[k]);
  case "days":return r.days==null?"—":String(r.days);
  case "seller":case "buyer":return r[k]||"—";
  case "price":case "sold_price":return eurOrDash(r[k]);
  case "diff":return pct(diff(r));
  case "commission_a":case "commission_b":case "conveyancing":return eur(r[k]);
  case "type":return r.type||"—";
  default:return r[k]==null||r[k]===""?"—":String(r[k])}}

function title(){return tr(["Verkopen & commissie","Sales & commission"])+" "+YEAR}

/* ---------- scherm ---------- */
function render(){
  if(!ROOT)return;
  const years=YEARS||[YEAR];
  const head=`<div class="rp-bar no-print">
    <div class="rp-pick"><label>${esc(tr(["Rapport","Report"]))}</label><select disabled><option>${esc(tr(["Verkopen & commissie","Sales & commission"]))}</option></select></div>
    <div class="rp-pick"><label>${esc(tr(["Jaar","Year"]))}</label><select id="rpYear">${years.map(y=>`<option value="${y}"${+y===+YEAR?" selected":""}>${y}</option>`).join("")}</select></div>
    <span class="rp-sp"></span>
    <button class="btn" type="button" id="rpPrint">🖨 ${esc(tr(["Afdrukken","Print"]))}</button>
    <button class="btn rp-pdf" type="button" id="rpPdf">⬇ ${esc(tr(["Opslaan als PDF","Save as PDF"]))}</button></div>`;
  if(!D){ROOT.innerHTML=`<div class="rp">${head}<div class="loader">${esc(tr(["Rapport laden…","Loading report…"]))}</div></div>`;wire();return}
  const rows=D.rows||[], T=D.totals||{}, cols=COLS(), M=MONTHS();
  const tot=k=>sum(rows.map(r=>r[k]));
  const sales=rows.length?`<table class="rp-t rp-sales"><thead><tr>${cols.map(c=>`<th class="${NUMC.has(c[0])?"n":""}">${esc(c[1])}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r=>{const d=diff(r);return `<tr>${cols.map(c=>{const v=cell(r,c[0]);
      if(c[0]==="reference")return `<td><a href="#p/${encodeURIComponent(r.reference)}">${esc(v)}</a></td>`;
      if(c[0]==="diff")return `<td class="n ${d==null?"":d<-15||d>15?"bad":d<0?"neg":"pos"}">${esc(v)}</td>`;
      return `<td class="${NUMC.has(c[0])?"n":""}${v==="—"||v==="€0"?" mut":""}">${esc(v)}</td>`}).join("")}</tr>`}).join("")}</tbody>
    <tfoot><tr><td colspan="6">${esc(tr([`${rows.length} verkopen`,`${rows.length} sales`]))}</td><td class="n">${eur(tot("price"))}</td><td class="n">${eur(tot("sold_price"))}</td><td></td>
      <td class="n">${eur(tot("commission_a"))}</td><td class="n">${eur(tot("commission_b"))}</td><td class="n">${eur(tot("conveyancing"))}</td><td colspan="3"></td></tr></tfoot></table>`
    :`<div class="empty">${esc(tr(["Geen verkopen in dit jaar.","No sales this year."]))}</div>`;
  const totBlock=y=>{const t=T[y]||{a:[],b:[],conv:[]};return `<tr class="rp-yr"><th>${y}</th><th class="n">${esc(tr(["Totaal","Total"]))}</th>${M.map(m=>`<th class="n">${esc(m)}</th>`).join("")}</tr>
    ${[["Comm A",t.a],["Comm B",t.b],["Conv",t.conv]].map(([l,a])=>`<tr><td>${l}</td><td class="n b">${eur(sum(a))}</td>${(a||[]).map(v=>`<td class="n${Number(v)?"":" mut"}">${eur(v)}</td>`).join("")}</tr>`).join("")}`};
  ROOT.innerHTML=`<div class="rp">${head}<div class="rp-doc card">
    <div class="rp-hd"><div><h2>${esc(title())}</h2><div class="rp-sub">Grupo Soltura · ${esc(tr(["gemaakt","generated"]))} ${esc(window.NEXUS_DMYT(new Date()))}</div></div></div>
    <h3 class="rp-sec">${esc(tr(["Verkopen","Sales"]))} ${YEAR}</h3>
    <div class="rp-scroll">${sales}</div>
    <h3 class="rp-sec">${esc(tr(["Commissietotalen","Commission totals"]))}</h3>
    <div class="rp-scroll"><table class="rp-t rp-tot"><tbody>${totBlock(YEAR)}${totBlock(YEAR-1)}</tbody></table></div>
  </div></div>`;
  wire();
}
function wire(){
  const y=ROOT.querySelector("#rpYear");if(y)y.onchange=()=>{YEAR=+y.value;load()};
  const p=ROOT.querySelector("#rpPrint");if(p)p.onclick=print;
  const f=ROOT.querySelector("#rpPdf");if(f)f.onclick=pdf;
}
async function load(){
  D=null;render();
  try{D=await X.rpc("nexus_report_sales",{p_year:YEAR});if(D&&D.years&&D.years.length)YEARS=D.years}catch(e){ROOT.innerHTML=`<div class="empty">${esc(e.message)}</div>`;return}
  render();
}

/* ---------- afdrukken ---------- */
function print(){
  if(!D)return;const old=document.title;document.title=fileName();
  document.body.classList.add("rp-printing");
  const done=()=>{document.body.classList.remove("rp-printing");document.title=old;window.removeEventListener("afterprint",done)};
  window.addEventListener("afterprint",done);window.print();setTimeout(done,1500);
}
const fileName=()=>`Grupo Soltura - ${tr(["Verkopen en commissie","Sales and commission"])} ${YEAR}`;

/* ---------- PDF ---------- */
function loadScript(src){return new Promise((ok,ko)=>{const s=document.createElement("script");s.src=src;s.onload=ok;s.onerror=()=>ko(new Error("load "+src));document.head.appendChild(s)})}
async function ensurePdf(){
  if(!(window.jspdf&&window.jspdf.jsPDF))await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  if(!window.jspdf.jsPDF.API.autoTable)await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");
}
async function pdf(){
  if(!D||BUSY)return;BUSY=true;const b=ROOT.querySelector("#rpPdf"),o=b.innerHTML;b.innerHTML="…";b.disabled=true;
  try{await ensurePdf()}catch(e){BUSY=false;b.innerHTML=o;b.disabled=false;print();return}
  try{
    const doc=new window.jspdf.jsPDF({orientation:"landscape",unit:"mm",format:"a4"});
    const W=doc.internal.pageSize.getWidth(), ink=[15,23,42], mut=[100,116,139], acc=[234,88,12];
    doc.setFont("helvetica","bold");doc.setFontSize(15);doc.setTextColor(...ink);doc.text(title(),12,14);
    doc.setFont("helvetica","normal");doc.setFontSize(8.5);doc.setTextColor(...mut);
    doc.text(`Grupo Soltura · ${tr(["gemaakt","generated"])} ${window.NEXUS_DMYT(new Date())}`,12,19.5);
    const cols=COLS(), rows=D.rows||[];
    const sec=(txt,y)=>{doc.setFont("helvetica","bold");doc.setFontSize(10.5);doc.setTextColor(...acc);doc.text(txt,12,y)};
    const base={theme:"plain",margin:{left:12,right:12},styles:{font:"helvetica",fontSize:7.2,cellPadding:{top:1.3,bottom:1.3,left:1.2,right:1.2},textColor:ink,lineColor:[226,232,240],lineWidth:{bottom:0.15}},
      headStyles:{fontStyle:"bold",textColor:mut,fillColor:[241,245,249]},alternateRowStyles:{fillColor:[250,251,253]}};
    sec(`${tr(["Verkopen","Sales"])} ${YEAR}`,27);
    const colStyles={};cols.forEach((c,i)=>{if(NUMC.has(c[0]))colStyles[i]={halign:"right"}});colStyles[cols.length-1]={cellWidth:52};
    const tot=k=>sum(rows.map(r=>r[k]));
    doc.autoTable(Object.assign({},base,{startY:29,head:[cols.map(c=>c[1])],
      body:rows.length?rows.map(r=>cols.map(c=>cell(r,c[0]).replace("—","-"))):[[{content:tr(["Geen verkopen in dit jaar.","No sales this year."]),colSpan:cols.length}]],
      foot:rows.length?[[{content:tr([`${rows.length} verkopen`,`${rows.length} sales`]),colSpan:6},eur(tot("price")),eur(tot("sold_price")),"",eur(tot("commission_a")),eur(tot("commission_b")),eur(tot("conveyancing")),{content:"",colSpan:3}]]:undefined,
      footStyles:{fontStyle:"bold",fillColor:[241,245,249],textColor:ink,halign:"right"},
      columnStyles:colStyles,
      didParseCell:h=>{if(h.section==="foot"&&h.column.index===0)h.cell.styles.halign="left";
        if(h.section==="head"&&NUMC.has(cols[h.column.index]&&cols[h.column.index][0]))h.cell.styles.halign="right"}}));
    let y=doc.lastAutoTable.finalY+9;
    if(y>165){doc.addPage();y=16}
    sec(tr(["Commissietotalen","Commission totals"]),y);
    const M=Array.from({length:12},(_,i)=>cap(new Date(2026,i,1).toLocaleDateString(LOC(),{month:"short"}).replace(".",""))), body=[];
    [YEAR,YEAR-1].forEach(yr=>{const t=(D.totals||{})[yr]||{a:[],b:[],conv:[]};
      body.push([{content:String(yr),styles:{fontStyle:"bold",fillColor:[241,245,249]}},...[tr(["Totaal","Total"]),...M].map(m=>({content:m,styles:{fontStyle:"bold",textColor:mut,fillColor:[241,245,249],halign:"right"}}))]);
      [["Comm A",t.a],["Comm B",t.b],["Conv",t.conv]].forEach(([l,a])=>body.push([l,{content:eur(sum(a)),styles:{fontStyle:"bold"}},...(a||[]).map(v=>eur(v))]))});
    const cs={0:{cellWidth:18}};for(let i=1;i<14;i++)cs[i]={halign:"right"};
    doc.autoTable(Object.assign({},base,{startY:y+2,body,columnStyles:cs,alternateRowStyles:{}}));
    const n=doc.internal.getNumberOfPages();
    for(let i=1;i<=n;i++){doc.setPage(i);doc.setFontSize(7);doc.setTextColor(...mut);doc.text(`${i} / ${n}`,W-12,203,{align:"right"});doc.text("NEXUS · Grupo Soltura",12,203)}
    doc.save(fileName()+".pdf");
  }catch(e){alert(e.message)}
  BUSY=false;b.innerHTML=o;b.disabled=false;
}

window.NEXUS_REPORTS={
  open(root,ctx){X=ctx;ROOT=root;if(!YEAR)YEAR=new Date().getFullYear();if(!D||D.year!==YEAR)load();else render()},
  rerender(){if(ROOT&&!ROOT.classList.contains("hidden"))render()}
};
})();
