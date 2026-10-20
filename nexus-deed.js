/* NEXUS · Akte inlezen (20-10-2026).
   Knop in het woningformulier (nieuw en bewerken): kies de eigendomsakte (PDF of foto), edge function deed-read leest hem met Claude
   en geeft ALLEEN woninggegevens terug (geen persoonsgegevens). De akte wordt nergens opgeslagen.
   Daarna volgt een popup met wat er gevonden is; aangevinkte regels worden in het formulier gezet. Opslaan blijft de gewone knop.
   Gebruik: NEXUS_DEED.button(tr)  → html van de knop (data-deed)
            NEXUS_DEED.run({sb, tr, current:{kolom:waarde}, onApply:(velden)=>{}}) */
(function(){
"use strict";
const esc=v=>v==null?"":String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const eur=v=>v==null||v===""?"":"€ "+Number(v).toLocaleString("nl-NL",{maximumFractionDigits:2});
const m2=v=>v==null||v===""?"":Number(v).toLocaleString("nl-NL")+" m²";
const dt=v=>{if(!v)return"";const d=new Date(String(v).slice(0,10)+"T12:00:00");return isNaN(d)?String(v):d.toLocaleDateString("nl-NL",{day:"numeric",month:"long",year:"numeric"})};
const txt=v=>v==null?"":String(v);
/* [kolom in core.properties, label, veld uit de akte, weergave] */
const ROWS=[
  ["purchase_date",["Datum aankoop","Purchase date"],"purchase_date",dt],
  ["purchase_price",["Aankoopprijs","Purchase price"],"purchase_price",eur],
  ["purchase_tax",["Overdrachtsbelasting aankoop","Transfer tax on purchase"],"purchase_tax",eur],
  ["purchase_tax_type",["Soort belasting","Tax type"],"purchase_tax_type",txt],
  ["purchase_notary",["Notaris aankoop","Notary (purchase)"],"purchase_notary",txt],
  ["purchase_notary_protocol",["Protocolnummer aankoop","Protocol no. (purchase)"],"purchase_notary_protocol",txt],
  ["finca_number",["Fincanummer","Finca number"],"finca_number",txt],
  ["registry_name",["Registro de la Propiedad","Land registry"],"registry_name",txt],
  ["registry_tomo",["Tomo","Tomo"],"registry_tomo",txt],
  ["registry_libro",["Libro","Libro"],"registry_libro",txt],
  ["registry_folio",["Folio","Folio"],"registry_folio",txt],
  ["registry_inscription",["Inscripción","Inscription"],"registry_inscription",txt],
  ["idufir",["IDUFIR / CRU","IDUFIR / CRU"],"idufir",txt],
  ["cadastral_ref",["Kadastrale referentie","Cadastral reference"],"cadastral_ref",txt],
  ["deed_build_area",["Bebouwde oppervlakte (ook advertentie)","Built area (also listing)"],"build_area",m2],
  ["deed_plot_area",["Oppervlakte kavel (ook advertentie)","Plot area (also listing)"],"plot_area",m2],
];
const DOC={escritura_compraventa:["Koopakte (escritura de compraventa)","Purchase deed"],escritura_obra_nueva:["Akte nieuwbouw (obra nueva)","New-build deed"],
  escritura_herencia:["Akte erfenis (herencia)","Inheritance deed"],escritura_otra:["Escritura","Deed"],nota_simple:["Nota simple","Nota simple"],otro:["Onbekend document","Unknown document"]};
const same=(a,b)=>String(a??"").trim().toUpperCase().replace(/\s/g,"")===String(b??"").trim().toUpperCase().replace(/\s/g,"")||(a!=null&&b!=null&&a!==""&&b!==""&&!isNaN(+a)&&!isNaN(+b)&&+a===+b);

function button(tr){return `<button type="button" class="btn sm dd-btn" data-deed="1">📄 ${esc(tr(["Akte uploaden en inlezen","Upload and read title deed"]))}</button>`}

function fileB64(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(",")[1]||"");r.onerror=()=>rej(r.error);r.readAsDataURL(f)})}

let OV=null;
function overlay(html){if(!OV){OV=document.createElement("div");OV.className="dd-ov";document.body.appendChild(OV)}OV.innerHTML=`<div class="dd-box">${html}</div>`;return OV}
function closeOv(){if(OV){OV.remove();OV=null}}

function run(o){const tr=o.tr;
  const inp=document.createElement("input");inp.type="file";inp.accept="application/pdf,image/jpeg,image/png,image/webp";
  inp.onchange=async()=>{const f=inp.files&&inp.files[0];if(!f)return;
    if(!/^application\/pdf$|^image\/(jpeg|png|webp)$/.test(f.type)){alert(tr(["Alleen PDF, JPG, PNG of WebP","PDF, JPG, PNG or WebP only"]));return}
    if(f.size>24*1048576){alert(tr(["Bestand is groter dan 24 MB","File exceeds 24 MB"]));return}
    overlay(`<div class="dd-busy"><div class="dd-spin"></div><b>${esc(tr(["Akte wordt gelezen…","Reading the deed…"]))}</b><div class="sm muted">${esc(f.name)} · ${esc(tr(["dit duurt meestal 20 tot 60 seconden","this usually takes 20 to 60 seconds"]))}</div></div>`);
    let r;
    try{const b64=await fileB64(f);
      const {data,error}=await o.sb.functions.invoke("deed-read",{body:{file_b64:b64,mime:f.type,filename:f.name}});
      if(error){let m=error.message;try{const j=await error.context.json();m=j.error||m}catch(_){}throw new Error(m)}
      if(!data||data.ok===false)throw new Error((data&&data.error)||"error");r=data}
    catch(e){overlay(`<h3>${esc(tr(["Akte niet gelezen","Deed not read"]))}</h3><div class="pe-errbox">${esc(e.message||String(e))}</div><div class="dd-ft"><button class="btn" data-dd="close">${esc(tr(["Sluiten","Close"]))}</button></div>`);
      OV.querySelector("[data-dd=close]").onclick=closeOv;return}
    show(o,r,f.name)};
  inp.click()}

function show(o,r,fname){const tr=o.tr, f=r.fields||{}, cur=o.current||{};
  const found=ROWS.filter(x=>f[x[2]]!=null&&String(f[x[2]]).trim()!=="");
  const missing=ROWS.filter(x=>!found.includes(x)&&!(x[0]==="deed_plot_area"&&f.property_kind==="apartment"));
  /* Rick 20-10-2026: de oppervlakte uit de akte vervangt altijd ook de geadverteerde oppervlakte (bebouwd en kavel). */
  const extra=[];
  const rowHtml=(x,i)=>{const val=f[x[2]], now=x[0]==="deed_build_area"?cur.build_area:x[0]==="deed_plot_area"?cur.plot_area:cur[x[0]], diff=now!=null&&now!==""&&!same(now,val), eq=now!=null&&now!==""&&same(now,val);
    return `<label class="dd-row ${eq?"eq":""}"><input type="checkbox" data-ddi="${i}" ${eq?"":"checked"}>
      <span class="dd-l">${esc(tr(x[1]))}</span><span class="dd-v"><b>${esc(x[3](val))}</b>${diff?`<small class="dd-now">${esc(tr(["nu: ","now: "]))}${esc(x[3](now))}</small>`:eq?`<small class="muted">${esc(tr(["staat er al","already set"]))}</small>`:""}</span></label>`};
  const exHtml=(x,i)=>{const empty=x[3]==null||x[3]==="";const eq=!empty&&same(x[3],x[2]);if(eq)return"";
    return `<label class="dd-row dd-ex"><input type="checkbox" data-dde="${i}" ${empty?"checked":""}><span class="dd-l">${esc(tr(x[1]))}</span><span class="dd-v"><b>${esc(m2(x[2]))}</b>${empty?"":`<small class="dd-now">${esc(tr(["nu: ","now: "]))}${esc(m2(x[3]))}</small>`}</span></label>`};
  const u=r.usage||{};
  overlay(`<h3>📄 ${esc(tr(["Gevonden in de akte","Found in the deed"]))}</h3>
    <div class="sm muted dd-sub">${esc(tr(DOC[f.document_type]||DOC.otro))} · ${esc(fname)}</div>
    ${found.length?`<div class="dd-list">${found.map(rowHtml).join("")}${extra.map(exHtml).join("")}</div>`
      :`<div class="pe-errbox">${esc(tr(["Er zijn geen woninggegevens gevonden. Is dit de eigendomsakte van deze woning?","No property data found. Is this the title deed of this property?"]))}</div>`}
    ${(r.warnings||[]).concat(f.notes?[f.notes]:[]).map(w=>`<div class="dd-warn">⚠ ${esc(w)}</div>`).join("")}
    ${missing.length&&found.length?`<div class="sm muted dd-miss">${esc(tr(["Niet gevonden: ","Not found: "]))}${missing.map(x=>esc(tr(x[1]))).join(", ")}</div>`:""}
    <div class="sm muted dd-miss">${esc(tr(["Alleen woninggegevens; namen en persoonsnummers uit de akte worden niet overgenomen. De akte zelf wordt niet bewaard.","Property data only; names and ID numbers in the deed are not taken over. The deed itself is not stored."]))}${u.input_tokens?` · ${Math.round((u.input_tokens||0)/1000)}k tokens`:""}</div>
    <div class="dd-ft"><button class="btn" data-dd="close">${esc(tr(["Annuleren","Cancel"]))}</button>${found.length?`<button class="btn ad-next" data-dd="apply">${esc(tr(["Overnemen in formulier","Apply to form"]))}</button>`:""}</div>`);
  OV.querySelector("[data-dd=close]").onclick=closeOv;
  const ap=OV.querySelector("[data-dd=apply]");
  if(ap)ap.onclick=()=>{const out={};
    OV.querySelectorAll("[data-ddi]").forEach(c=>{if(c.checked){const x=found[+c.dataset.ddi];out[x[0]]=f[x[2]];
      if(x[0]==="deed_build_area")out.build_area=f[x[2]];if(x[0]==="deed_plot_area")out.plot_area=f[x[2]]}});
    OV.querySelectorAll("[data-dde]").forEach(c=>{if(c.checked){const x=extra[+c.dataset.dde];out[x[0]]=x[2]}});
    closeOv();if(Object.keys(out).length){out.deed_read_at=new Date().toISOString();o.onApply(out)}};
  OV.onclick=e=>{if(e.target===OV)closeOv()};
}
window.NEXUS_DEED={button,run};
})();
