/* NEXUS · Makelaarskantoren (Rick 20-10-2026).
   Eén lijst (core.agencies, migratie 049) voor het veld Bedrijf bij een Agent en voor "Verkocht door (extern)" bij een woning.
   Beheer: toevoegen, wijzigen, verwijderen. Hernoemen past Bedrijf bij alle gekoppelde agents aan (trigger in de database).
   Verwijderen: agents en woningen blijven bestaan, alleen de koppeling vervalt.
   RPC's: nexus_agencies, nexus_agency_save, nexus_agency_delete, nexus_agency_agents. */
(function(){
"use strict";
const esc=v=>v==null?"":String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let LIST=null, LOADING=null;
const AGENTS={};

async function list(rpc,force){
  if(LIST&&!force)return LIST;
  if(LOADING&&!force)return LOADING;
  LOADING=rpc("nexus_agencies",{}).then(r=>{LIST=r||[];LOADING=null;return LIST}).catch(e=>{LOADING=null;throw e});
  return LOADING}
async function agents(rpc,id,force){
  if(!id)return [];
  if(AGENTS[id]&&!force)return AGENTS[id];
  AGENTS[id]=(await rpc("nexus_agency_agents",{p_id:id}))||[];return AGENTS[id]}
const byName=n=>{const k=String(n||"").trim().toLowerCase();return (LIST||[]).find(a=>a.name.trim().toLowerCase()===k)||null};
const datalist=id=>`<datalist id="${id}">${(LIST||[]).filter(a=>a.active!==false).map(a=>`<option value="${esc(a.name)}">${esc(a.city||"")}</option>`).join("")}</datalist>`;

/* ---------- beheerscherm (overlay boven het bewerkscherm) ---------- */
function manage(ctx,opts={}){
  const {rpc,tr,isAdmin}=ctx;let Q=opts.q||"", EDIT=null, ERR="", BUSY=false;
  const ov=document.createElement("div");ov.className="ag-ov";document.body.appendChild(ov);
  const close=()=>{ov.remove();opts.onClose&&opts.onClose(LIST)};
  const blank=()=>({id:null,name:Q.trim(),city:"",phone:"",website:"",email_domain:"",notes:"",active:true});
  const F=[["name",["Naam kantoor","Office name"],2],["city",["Plaats","Town"],1],["phone",["Telefoon","Phone"],1],
           ["website","Website",2],["email_domain",["Maildomein (bijv. kantoor.com)","Mail domain (e.g. office.com)"],2],["notes",["Notitie","Note"],4]];
  const form=()=>`<div class="ag-form"><h4>${esc(EDIT.id?tr(["Kantoor wijzigen","Edit office"]):tr(["Nieuw kantoor","New office"]))}</h4>
     <div class="ad-row">${F.map(f=>`<label class="ad-f ${f[2]>1?"w"+f[2]:""}"><span>${esc(tr(f[1]))}</span><input data-af="${f[0]}" value="${esc(EDIT[f[0]]??"")}" ${f[0]==="name"?"autofocus":""}></label>`).join("")}</div>
     <label class="ad-c"><input type="checkbox" data-af="active" ${EDIT.active!==false?"checked":""}><span>${esc(tr(["Actief (staat in de keuzelijst)","Active (shown in the pick list)"]))}</span></label>
     ${EDIT.id&&(EDIT.agents||0)?`<small class="muted">${esc(tr([`Een nieuwe naam wordt ook bij de ${EDIT.agents} gekoppelde agent(s) als Bedrijf gezet.`,`A new name is also set as Company on the ${EDIT.agents} linked agent(s).`]))}</small>`:""}
     <div class="ag-fbtn"><button class="btn sm" data-ag="cancel">${esc(tr(["Annuleren","Cancel"]))}</button><button class="btn sm ad-next" data-ag="save" ${BUSY?"disabled":""}>${esc(tr(["Opslaan","Save"]))}</button></div></div>`;
  const rows=()=>{const q=Q.trim().toLowerCase();
    const L=(LIST||[]).filter(a=>!q||[a.name,a.city,a.email_domain].some(x=>String(x||"").toLowerCase().includes(q)));
    return L.length?L.map(a=>`<div class="ag-row ${a.active===false?"off":""}"><div style="min-width:0"><b>${esc(a.name)}</b>${a.active===false?` <span class="tag">${esc(tr(["inactief","inactive"]))}</span>`:""}
        <div class="sm muted">${esc([a.city,a.phone,a.email_domain].filter(Boolean).join(" · ")||"—")}</div></div>
        <span class="sm muted ag-n" title="${esc(tr(["Gekoppelde agents · woningen verkocht via dit kantoor","Linked agents · properties sold via this office"]))}">👤 ${a.agents||0} · 🏠 ${a.sold||0}</span>
        <span class="ag-act"><button class="btn sm" data-ag="edit" data-id="${a.id}">✎</button>${isAdmin()?`<button class="btn sm" data-ag="del" data-id="${a.id}" title="${esc(tr(["Verwijderen","Delete"]))}">🗑</button>`:""}</span></div>`).join("")
      :`<div class="empty sm" style="padding:14px">${esc(tr(["Geen kantoor gevonden.","No office found."]))}</div>`};
  const draw=()=>{const sc=ov.querySelector(".ag-list");const top=sc?sc.scrollTop:0;
    ov.innerHTML=`<div class="ag-box"><header class="pe-hd"><div style="min-width:0"><div class="pe-ref">🏢 ${esc(tr(["Makelaarskantoren","Agencies"]))}</div>
        <div class="pe-tt">${esc(tr([`${(LIST||[]).length} kantoren · gebruikt bij Bedrijf (Agent) en Verkocht door (extern)`,`${(LIST||[]).length} offices · used for Company (Agent) and Sold by (external)`]))}</div></div>
        <button class="pe-x" data-ag="close">×</button></header>
      <div class="ag-main">${ERR?`<div class="pe-errbox">${esc(ERR)}</div>`:""}
        ${EDIT?form():`<div class="ag-bar"><input class="ad-search" id="agQ" type="search" value="${esc(Q)}" placeholder="${esc(tr(["Zoek op naam, plaats of maildomein","Search by name, town or mail domain"]))}" autocomplete="off">
          <button class="btn sm ad-next" data-ag="new">+ ${esc(tr(["Nieuw kantoor","New office"]))}</button></div>
          <div class="ag-list">${rows()}</div>`}</div></div>`;
    const q=ov.querySelector("#agQ");if(q){q.oninput=()=>{Q=q.value;ov.querySelector(".ag-list").innerHTML=rows()};if(!opts.noFocus)q.focus();q.setSelectionRange(Q.length,Q.length)}
    const l=ov.querySelector(".ag-list");if(l)l.scrollTop=top;
    ov.querySelectorAll("[data-af]").forEach(el=>el.oninput=el.onchange=()=>{EDIT[el.dataset.af]=el.type==="checkbox"?el.checked:el.value});
    const n=ov.querySelector('[data-af="name"]');if(n)n.focus()};
  ov.addEventListener("click",async e=>{if(e.target===ov){close();return}
    const b=e.target.closest("[data-ag]");if(!b)return;const a=b.dataset.ag, it=(LIST||[]).find(x=>x.id===b.dataset.id);ERR="";
    if(a==="close"){close();return}
    if(a==="new"){EDIT=blank();draw();return}
    if(a==="edit"){EDIT=Object.assign({},it);draw();return}
    if(a==="cancel"){EDIT=null;draw();return}
    if(a==="save"){if(!String(EDIT.name||"").trim()){ERR=tr(["Vul de naam van het kantoor in.","Enter the office name."]);draw();return}
      BUSY=true;draw();
      try{const p={};F.forEach(f=>p[f[0]]=EDIT[f[0]]??"");p.active=EDIT.active!==false;
        const r=await rpc("nexus_agency_save",{p_id:EDIT.id,p});await list(rpc,true);
        if(!EDIT.id&&opts.onPick&&r){BUSY=false;ov.remove();opts.onPick(r,LIST);return}
        EDIT=null}catch(x){ERR=x.message||String(x)}
      BUSY=false;draw();return}
    if(a==="del"&&it){
      if(!confirm(tr([`Kantoor "${it.name}" verwijderen?\n\n${it.agents||0} agent(s) en ${it.sold||0} woning(en) blijven bestaan; alleen de koppeling met dit kantoor vervalt.`,
        `Delete office "${it.name}"?\n\n${it.agents||0} agent(s) and ${it.sold||0} propert(y/ies) remain; only the link to this office is removed.`])))return;
      try{await rpc("nexus_agency_delete",{p_id:it.id});delete AGENTS[it.id];await list(rpc,true)}catch(x){ERR=x.message||String(x)}
      draw();return}});
  ov.addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();EDIT?(EDIT=null,draw()):close()}});
  (async()=>{try{await list(rpc,true)}catch(x){ERR=x.message||String(x)}draw()})();
  ov.innerHTML=`<div class="ag-box"><div class="pe-load">${esc(tr(["Kantoren laden…","Loading offices…"]))}</div></div>`;
}

window.NEXUS_AGENCIES={list,agents,byName,datalist,manage,cached:()=>LIST||[],forget:id=>{if(id)delete AGENTS[id]}};
})();
