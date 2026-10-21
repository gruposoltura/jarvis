/* NEXUS · Akte inlezen (20-10-2026).
   Knop in het woningformulier (nieuw en bewerken): kies de eigendomsakte (PDF of foto), edge function deed-read leest hem met Claude
   en geeft woninggegevens terug en (sinds 21-10-2026) de persoonsgegevens van de eigenaar(s) volgens de akte. De akte wordt nergens opgeslagen.
   Daarna volgt een popup in twee delen: Woning (gaat het formulier in) en Eigenaar(s) (gaat bij Opslaan naar het contact: eigenaar,
   diens partner, of een nieuw partnercontact). Besluit Rick 21-10: de akte is de bron van waarheid voor het NIE.
   Gebruik: NEXUS_DEED.button(tr)  → html van de knop (data-deed)
            NEXUS_DEED.run({sb, rpc, tr, current:{kolom:waarde}, ownerId, onApply:(velden)=>{}, onPersons:(lijst)=>{}})
            onPersons krijgt [{contact_id|null, new_partner_of|null, label, patch:{kolom:waarde}, fields:{first_name,last_name}}] */
(function(){
"use strict";
const esc=v=>v==null?"":String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const eur=v=>v==null||v===""?"":"€ "+Number(v).toLocaleString("nl-NL",{maximumFractionDigits:2});
const m2=v=>v==null||v===""?"":Number(v).toLocaleString("nl-NL")+" m²";
const dt=v=>{if(!v)return"";const d=new Date(String(v).slice(0,10)+"T12:00:00");return isNaN(d)?String(v):NEXUS_DMY(d)};
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
    let r, owners=[];
    const ownP=(o.rpc&&o.ownerId)?o.rpc("nexus_deed_owners",{p_property_id:o.ownerId}).catch(()=>[]):Promise.resolve([]);
    try{const b64=await fileB64(f);
      const {data,error}=await o.sb.functions.invoke("deed-read",{body:{file_b64:b64,mime:f.type,filename:f.name}});
      if(error){let m=error.message;try{const j=await error.context.json();m=j.error||m}catch(_){}throw new Error(m)}
      if(!data||data.ok===false)throw new Error((data&&data.error)||"error");r=data;owners=(await ownP)||[]}
    catch(e){overlay(`<h3>${esc(tr(["Akte niet gelezen","Deed not read"]))}</h3><div class="pe-errbox">${esc(e.message||String(e))}</div><div class="dd-ft"><button class="btn" data-dd="close">${esc(tr(["Sluiten","Close"]))}</button></div>`);
      OV.querySelector("[data-dd=close]").onclick=closeOv;return}
    show(o,r,f.name,owners)};
  inp.click()}

/* ---------- persoonsgegevens (21-10-2026) ---------- */
const MAR={single:["Ongehuwd","Single"],married:["Gehuwd","Married"],divorced:["Gescheiden","Divorced"],widowed:["Weduwe/weduwnaar","Widowed"],separated:["Gescheiden van tafel en bed","Separated"],registered_partner:["Geregistreerd partner","Registered partner"]};
const fold=v=>String(v??"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
const toks=v=>fold(v).split(/[^a-z0-9]+/).filter(t=>t.length>1&&!/^(mr|mrs|ms|miss|dr|de|van|der|den|la|el|los|las|del|y|and|en|&)$/.test(t));
const addr=c=>{if(!c)return"";const l1=[c.street,c.street_number].filter(Boolean).join(" "), l2=[c.postcode,c.city].filter(Boolean).join(" ");
  return [l1,l2,c.state,c.country].filter(Boolean).join(", ")};
const hasAddr=c=>!!(c&&(c.street||c.postcode||c.city));
/* akten schrijven namen vaak in hoofdletters: voor een nieuw contact "PETER JONES" → "Peter Jones" */
const tc=v=>v==null?null:String(v).toLowerCase().replace(/(^|[\s\-'’])(\p{L})/gu,(m,a,b)=>a+b.toUpperCase());
const pname=p=>[p.first_name,p.last_name].filter(Boolean).join(" ");
/* [sleutel, label, waarde uit akte, waarde in contact, standaard aanvinken als het verschilt] */
function pRows(p,c,tr){const rows=[];
  if(p.nie)rows.push(["nie",["NIE / DNI","NIE / DNI"],p.nie,c&&c.nie,true]);
  if(p.passport)rows.push(["passport",[p.id_document_kind==="national_id"?"ID-kaart":"Paspoort",p.id_document_kind==="national_id"?"ID card":"Passport"],p.passport,c&&c.passport,false]);
  if(p.marital)rows.push(["marital",["Burgerlijke staat","Marital status"],p.marital,c&&c.marital,false]);
  if(hasAddr(p))rows.push(["address",[p.resident_in_spain===false?"Adres thuisland (niet-resident)":p.resident_in_spain?"Adres in Spanje (resident)":"Adres",
    p.resident_in_spain===false?"Home-country address (non-resident)":p.resident_in_spain?"Address in Spain (resident)":"Address"],addr(p),hasAddr(c)?addr(c):"",false]);
  return rows}
const showV=(k,v,tr)=>k==="marital"?tr(MAR[v]||[v,v]):v;
/* koppel personen uit de akte aan eigenaar/partners: eerst op NIE, dan op naam; nooit twee keer hetzelfde contact */
function match(persons,owners){const used=new Set(), out=persons.map(()=>({target:"",weak:false}));
  persons.forEach((p,i)=>{const c=owners.find(c=>!used.has(c.id)&&p.nie&&c.nie&&same(p.nie,c.nie));if(c){out[i].target=c.id;used.add(c.id)}});
  const score=(p,c)=>{const a=toks(pname(p)), b=new Set(toks([c.first_name,c.last_name,c.name].join(" ")));return a.filter(t=>b.has(t)).length};
  for(;;){let best=null;persons.forEach((p,i)=>{if(out[i].target)return;owners.forEach(c=>{if(used.has(c.id))return;const s=score(p,c);if(s>0&&(!best||s>best.s))best={i,c,s}})});
    if(!best)break;out[best.i].target=best.c.id;used.add(best.c.id)}
  /* één persoon over en één contact over: voorstellen, maar als "naam wijkt af" markeren */
  const freeP=out.map((x,i)=>x.target?null:i).filter(i=>i!=null), freeC=owners.filter(c=>!used.has(c.id));
  if(freeP.length===1&&freeC.length===1){out[freeP[0]]={target:freeC[0].id,weak:true};used.add(freeC[0].id)}
  /* nog personen over en er is een eigenaar: als nieuw partnercontact voorstellen */
  out.forEach((x,i)=>{if(!x.target&&owners.length)x.target="new"});
  return out}

function show(o,r,fname,owners){const tr=o.tr, f=r.fields||{}, cur=o.current||{};
  owners=owners||[];const persons=r.persons||[];const owner=owners.find(c=>c.is_owner);
  const found=ROWS.filter(x=>f[x[2]]!=null&&String(f[x[2]]).trim()!=="");
  const missing=ROWS.filter(x=>!found.includes(x)&&!(x[0]==="deed_plot_area"&&f.property_kind==="apartment"));
  const rowHtml=(x,i)=>{const isA=x[0]==="deed_build_area"||x[0]==="deed_plot_area", val=isA?Math.round(+f[x[2]]):f[x[2]], now=x[0]==="deed_build_area"?cur.build_area:x[0]==="deed_plot_area"?cur.plot_area:cur[x[0]], diff=now!=null&&now!==""&&!same(now,val), eq=now!=null&&now!==""&&same(now,val);
    return `<label class="dd-row ${eq?"eq":""}"><input type="checkbox" data-ddi="${i}" ${eq?"":"checked"}>
      <span class="dd-l">${esc(tr(x[1]))}</span><span class="dd-v"><b>${esc(x[3](val))}</b>${diff?`<small class="dd-now">${esc(tr(["nu: ","now: "]))}${esc(x[3](now))}</small>`:eq?`<small class="muted">${esc(tr(["staat er al","already set"]))}</small>`:""}</span></label>`};
  const M=match(persons,owners);
  const optHtml=(i)=>{const t=M[i].target;
    return owners.map(c=>`<option value="${c.id}" ${t===c.id?"selected":""}>${esc(c.name||"—")} · ${esc(tr(c.is_owner?["eigenaar","owner"]:["partner eigenaar","owner's partner"]))}</option>`).join("")
      +(owner?`<option value="new" ${t==="new"?"selected":""}>${esc(tr(["Nieuw contact (partner van ","New contact (partner of "]))}${esc(owner.name||"")})</option>`:"")
      +`<option value="" ${!t?"selected":""}>${esc(tr(["Niet overnemen","Do not apply"]))}</option>`};
  const personBody=(i)=>{const p=persons[i], t=M[i].target, c=owners.find(x=>x.id===t)||null;
    if(!t)return `<div class="sm muted dd-pnone">${esc(tr(["Wordt niet opgeslagen.","Will not be saved."]))}</div>`;
    const rows=pRows(p,c,tr);
    if(!rows.length)return `<div class="sm muted dd-pnone">${esc(tr(["Geen NIE, paspoort of adres in de akte voor deze persoon.","No NIE, passport or address in the deed for this person."]))}</div>`;
    return `<div class="dd-list">${rows.map(x=>{const v=x[2], now=x[3], has=now!=null&&now!=="", eq=has&&(x[0]==="address"?fold(v).replace(/\W/g,"")===fold(now).replace(/\W/g,""):same(v,now)), chk=!eq&&(!has||x[4]);
      return `<label class="dd-row ${eq?"eq":""}"><input type="checkbox" data-ddp="${i}" data-pk="${x[0]}" ${chk?"checked":""}>
        <span class="dd-l">${esc(tr(x[1]))}${x[0]==="nie"&&p.nie_check==="bad"?` <b class="dd-bad">⚠</b>`:""}</span><span class="dd-v"><b>${esc(showV(x[0],v,tr))}</b>${eq?`<small class="muted">${esc(tr(["staat er al","already set"]))}</small>`
          :has?`<small class="dd-now">${esc(tr(["nu: ","now: "]))}${esc(showV(x[0],now,tr))}${x[0]==="nie"?esc(tr([" · de akte is leidend"," · the deed prevails"])):""}</small>`:""}</span></label>`}).join("")}</div>
      ${M[i].weak&&t===c?.id?`<div class="dd-warn">⚠ ${esc(tr([`Naam in de akte (${pname(p)}) lijkt niet op ${c.name||"dit contact"}; controleer of dit dezelfde persoon is.`,`Name in the deed (${pname(p)}) does not resemble ${c.name||"this contact"}; check it is the same person.`]))}</div>`:""}
      ${t==="new"?`<div class="sm muted dd-pnone">${esc(tr(["Wordt bij Opslaan aangemaakt als nieuw contact, gekoppeld als partner van de eigenaar (zelfde labels).","Created on Save as a new contact, linked as partner of the owner (same labels)."]))}</div>`:""}`};
  const personsHtml=!persons.length?`<div class="sm muted dd-pnone">${esc(tr(["Geen eigenaren gevonden in de akte.","No owners found in the deed."]))}</div>`
    :!owners.length?`<div class="dd-warn">⚠ ${esc(tr(["Deze woning heeft nog geen eigenaar gekoppeld. Koppel eerst een eigenaar bij Contacten, sla op en lees de akte opnieuw in om de persoonsgegevens over te nemen.","This property has no owner linked yet. Link an owner under Contacts, save and read the deed again to apply the personal data."]))}</div>
      <div class="dd-list">${persons.map(p=>`<div class="dd-row eq"><span></span><span class="dd-l">${esc(pname(p))}</span><span class="dd-v"><b>${esc([p.nie,p.passport].filter(Boolean).join(" · ")||"—")}</b><small class="muted">${esc(addr(p))}</small></span></div>`).join("")}</div>`
    :persons.map((p,i)=>`<div class="dd-person" data-pi="${i}">
        <div class="dd-phead"><div><b>${esc(pname(p))}</b><div class="sm muted">${esc([p.nationality,p.share,p.resident_in_spain===true?tr(["resident in Spanje","resident in Spain"]):p.resident_in_spain===false?tr(["niet-resident","non-resident"]):""].filter(Boolean).join(" · "))}</div></div>
          <label class="dd-to"><span class="sm muted">${esc(tr(["Opslaan in","Save to"]))}</span><select data-ddt="${i}">${optHtml(i)}</select></label></div>
        <div data-pb="${i}">${personBody(i)}</div></div>`).join("");
  const u=r.usage||{};
  const canApply=found.length||(persons.length&&owners.length);
  overlay(`<h3>📄 ${esc(tr(["Gevonden in de akte","Found in the deed"]))}</h3>
    <div class="sm muted dd-sub">${esc(tr(DOC[f.document_type]||DOC.otro))} · ${esc(fname)}</div>
    <div class="dd-part">🏠 ${esc(tr(["Woning","Property"]))}<small>${esc(tr(["gaat het formulier in","goes into the form"]))}</small></div>
    ${found.length?`<div class="dd-list">${found.map(rowHtml).join("")}</div>`
      :`<div class="pe-errbox">${esc(tr(["Er zijn geen woninggegevens gevonden. Is dit de eigendomsakte van deze woning?","No property data found. Is this the title deed of this property?"]))}</div>`}
    ${missing.length&&found.length?`<div class="sm muted dd-miss">${esc(tr(["Niet gevonden: ","Not found: "]))}${missing.map(x=>esc(tr(x[1]))).join(", ")}</div>`:""}
    <div class="dd-part">👤 ${esc(tr(["Eigenaar(s) volgens de akte","Owner(s) per the deed"]))}<small>${esc(tr(["gaat bij Opslaan naar het contact","goes to the contact on Save"]))}</small></div>
    ${personsHtml}
    ${(r.warnings||[]).concat(f.notes?[f.notes]:[]).map(w=>`<div class="dd-warn">⚠ ${esc(w)}</div>`).join("")}
    <div class="sm muted dd-miss">${esc(tr(["De akte zelf wordt niet bewaard.","The deed itself is not stored."]))}${u.input_tokens?` · ${Math.round((u.input_tokens||0)/1000)}k tokens`:""}</div>
    <div class="dd-ft"><button class="btn" data-dd="close">${esc(tr(["Annuleren","Cancel"]))}</button>${canApply?`<button class="btn ad-next" data-dd="apply">${esc(tr(["Overnemen","Apply"]))}</button>`:""}</div>`);
  OV.querySelector("[data-dd=close]").onclick=closeOv;
  OV.querySelectorAll("[data-ddt]").forEach(s=>s.onchange=()=>{const i=+s.dataset.ddt;M[i]={target:s.value,weak:false};
    /* hetzelfde contact niet twee keer kiezen */
    if(s.value&&s.value!=="new")M.forEach((m,j)=>{if(j!==i&&m.target===s.value){m.target="";const o2=OV.querySelector(`[data-ddt="${j}"]`);if(o2)o2.value=""; OV.querySelector(`[data-pb="${j}"]`).innerHTML=personBody(j)}});
    OV.querySelector(`[data-pb="${i}"]`).innerHTML=personBody(i)});
  const ap=OV.querySelector("[data-dd=apply]");
  if(ap)ap.onclick=()=>{const out={};
    OV.querySelectorAll("[data-ddi]").forEach(c=>{if(c.checked){const x=found[+c.dataset.ddi];out[x[0]]=f[x[2]];
      /* advertentie: afgerond op hele m² (Rick 20-10-2026); het aktewaarde-veld blijft exact */
      if(x[0]==="deed_build_area")out.build_area=Math.round(+f[x[2]]);if(x[0]==="deed_plot_area")out.plot_area=Math.round(+f[x[2]])}});
    const plist=[];
    persons.forEach((p,i)=>{const t=M[i].target;if(!t||!owners.length)return;const patch={};
      OV.querySelectorAll(`[data-ddp="${i}"]`).forEach(c=>{if(!c.checked)return;const k=c.dataset.pk;
        if(k==="address"){["street","street_number","postcode","city","state","country"].forEach(a=>patch[a]=p[a]||null)}else patch[k]=p[k]});
      if(!Object.keys(patch).length&&t!=="new")return;
      const c=owners.find(x=>x.id===t);
      plist.push({contact_id:t==="new"?null:t,new_partner_of:t==="new"?(owner&&owner.id):null,label:t==="new"?pname(p):(c&&c.name)||pname(p),patch,
        fields:{first_name:tc(p.first_name),last_name:tc(p.last_name)}})});
    closeOv();
    if(Object.keys(out).length){out.deed_read_at=new Date().toISOString();o.onApply(out)}
    if(plist.length&&o.onPersons)o.onPersons(plist)};
  OV.onclick=e=>{if(e.target===OV)closeOv()};
}
window.NEXUS_DEED={button,run};
})();
