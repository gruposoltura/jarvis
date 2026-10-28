/* NEXUS · Bezichtiging — elke bezichtigingsaanvraag via het makelaarsportaal (agents.gruposoltura.com; viewing@ is sinds 28-10-2026 uit, BD-169) als flow van links naar rechts (Rick, 20-10-2026).
   Bron: RPC nexus_viewing_board(p_days, p_test) (migratie 046) over core.viewing_intake; één rij = één aanvraag (chain),
   d.w.z. alle mails van dezelfde makelaar tot de aanvraag verwerkt is. Gevuld door n8n JARVIS-AppointmentAgent-v2.
   Stappen: Ontvangen → Makelaar → Gegevens compleet → Woning → NEXUS → Bevestigd & doorgestuurd.
   Lezen: hele team. Testrijen (DRY_RUN van de workflow) apart te tonen. */
(function(){
"use strict";
window.NEXUS_I18N=window.NEXUS_I18N||{nl:{},en:{}};
Object.assign(window.NEXUS_I18N.nl,{"tab.vw":"Bezichtiging"});
Object.assign(window.NEXUS_I18N.en,{"tab.vw":"Viewings"});

let X=null, ROOT=null, D=null, DAYS=60, TEST=false, FILTER="all", Q="", OPEN=null, BUSY=false;
const tr=v=>Array.isArray(v)?(X&&X.lang()==="en"?v[1]:v[0]):v;
const esc=v=>v==null?"":String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const LOC=()=>X&&X.lang()==="en"?"en-GB":"nl-NL";
const dmyt=ts=>ts?(window.NEXUS_DMYT?NEXUS_DMYT(new Date(ts)):new Date(ts).toLocaleString(LOC())):"—";
function ago(ts){if(!ts)return "";const s=(Date.now()-new Date(ts))/1000;
  if(s<3600)return tr([`${Math.max(1,Math.round(s/60))} min geleden`,`${Math.max(1,Math.round(s/60))} min ago`]);
  if(s<86400)return tr([`${Math.round(s/3600)} uur geleden`,`${Math.round(s/3600)} h ago`]);
  return tr([`${Math.round(s/86400)} d geleden`,`${Math.round(s/86400)} d ago`])}

const MISS={client_first:["voornaam klant","client first name"],client_last:["achternaam klant","client last name"],ref:["referentie","reference"],day:["dag","day"],time:["tijd","time"],
  first_name:["voornaam","first name"],last_name:["achternaam","last name"],company:["bedrijfsnaam","agency"],email:["e-mail","email"],mobile:["mobiel","mobile"]};
const OUT={registration_requested:["Registratie gevraagd","Registration requested"],registration_incomplete:["Registratie incompleet","Registration incomplete"],
  agent_registered:["Makelaar geregistreerd","Agent registered"],incomplete:["Aanvraag incompleet","Request incomplete"],ref_not_found:["Referentie onbekend","Unknown reference"],
  not_available:["Woning niet beschikbaar","Property not available"],processed:["Verwerkt","Processed"],nexus_failed:["NEXUS-fout","NEXUS error"],skipped:["Overgeslagen","Skipped"],
  client_known:["Klant al bekend","Client already known"]};
const MAILK={confirmation:["Bevestiging","Confirmation"],rep_notification:["Salesrep","Sales rep"],incomplete:["Ontbreekt","Missing"],ref_not_found:["Ref. onbekend","Unknown ref"],
  not_available:["Niet beschikbaar","Not available"],registration_requested:["Registratieverzoek","Registration request"],registration_incomplete:["Registratie incompleet","Registration incomplete"],agent_registered:["Registratie bevestigd","Registration confirmed"]};
const missTxt=a=>(a||[]).map(k=>tr(MISS[k]||[k,k])).join(", ");

/* ---------- één aanvraag → 6 stappen ---------- */
function model(c){
  const st=c.steps||[], last=st[st.length-1]||{}, has=o=>st.some(s=>s.outcome===o), lastOf=f=>{for(let i=st.length-1;i>=0;i--)if(f(st[i]))return st[i];return null};
  const known=st.some(s=>s.agent_known)||has("agent_registered");
  const proc=lastOf(s=>s.outcome==="processed"), view=lastOf(s=>s.kind==="viewing"&&s.outcome!=="registration_requested");
  const S=[];
  // kanaal (24-10-2026): viewing@ (mail) of het makelaarsportaal op de website (gesprek met Sola)
  if(c.channel==="website")S.push({k:"in",st:"done",t:tr(["Website · Sola","Website · Sola"]),d:`${tr(["makelaarsportaal","agent portal"])} · ${ago(c.started_at)}`});
  else S.push({k:"in",st:"done",t:tr(["Ontvangen","Received"]),d:`${st.length} ${tr(st.length===1?["mail","email"]:["mails","emails"])} · ${ago(c.started_at)}`});
  // makelaar
  if(st.length&&st[0].agent_known)S.push({k:"ag",st:"done",t:tr(["Makelaar bekend","Agent known"]),d:""});
  else if(has("agent_registered"))S.push({k:"ag",st:"done",t:tr(["Geregistreerd als Agent","Registered as agent"]),d:dmyt(lastOf(s=>s.outcome==="agent_registered").at)});
  else if(has("skipped")&&st.every(s=>s.outcome==="skipped"))S.push({k:"ag",st:"na",t:"—",d:""});
  else{const r=lastOf(s=>/^registration_/.test(s.outcome));
    S.push({k:"ag",st:"wait",t:r&&r.outcome==="registration_incomplete"?tr(["Registratie incompleet","Registration incomplete"]):tr(["Onbekend","Unknown"]),
      d:r&&r.outcome==="registration_incomplete"?tr(["Ontbreekt: ","Missing: "])+missTxt(r.missing):tr(["Registratie gevraagd, wacht op gegevens","Registration requested, waiting for details"])})}
  // gegevens compleet
  if(!known)S.push({k:"cp",st:"todo",t:tr(["Gegevens aanvraag","Request details"]),d:tr(["na registratie","after registration"])});
  else if(view&&view.outcome==="incomplete")S.push({k:"cp",st:"wait",t:tr(["Incompleet","Incomplete"]),d:tr(["Ontbreekt: ","Missing: "])+missTxt(view.missing)});
  else if(view)S.push({k:"cp",st:"done",t:tr(["Compleet","Complete"]),d:[view.client_name,[view.day,view.time].filter(Boolean).join(" ")].filter(Boolean).join(" · ")});
  else S.push({k:"cp",st:"wait",t:tr(["Wacht op aanvraag","Waiting for request"]),d:tr(["makelaar moet (opnieuw) indienen","agent must (re)submit"])});
  // woning
  const pv=lastOf(s=>/^(processed|ref_not_found|not_available|nexus_failed)$/.test(s.outcome));
  if(!pv)S.push({k:"wo",st:"todo",t:tr(["Woning","Property"]),d:view&&view.ref?view.ref:""});
  else if(pv.outcome==="ref_not_found")S.push({k:"wo",st:"wait",t:tr(["Referentie onbekend","Unknown reference"]),d:pv.ref||"",ref:null});
  else if(pv.outcome==="not_available")S.push({k:"wo",st:"stop",t:tr(["Niet beschikbaar","Not available"]),d:(pv.ref||"")+tr([" · onder bod / uit verkoop"," · under offer / off market"]),ref:pv.ref});
  else S.push({k:"wo",st:"done",t:pv.ref||tr(["Woning","Property"]),d:tr(["gevonden","found"]),ref:pv.ref});
  // NEXUS
  const nf=lastOf(s=>s.outcome==="nexus_failed"), ck=lastOf(s=>s.outcome==="client_known");
  if(proc)S.push({k:"nx",st:"done",t:tr(["Claimed + aanvraag","Claimed + request"]),d:proc.client_name||"",cid:proc.client_contact_id});
  else if(ck)S.push({k:"nx",st:"stop",t:tr(["Klant al bekend","Client already known"]),d:tr(["aanvraag geweigerd","request refused"])});
  else if(nf)S.push({k:"nx",st:"fail",t:tr(["Mislukt","Failed"]),d:tr(["handmatig aanmaken","create manually"])});
  else S.push({k:"nx",st:"todo",t:"NEXUS",d:""});
  // bevestigd
  if(proc){const r=c.rep||{};S.push({k:"ok",st:"done",t:tr(["Bevestigd & doorgestuurd","Confirmed & forwarded"]),d:(r.name||proc.rep_email||"")+(proc.at?" · "+dmyt(proc.at):""),rep:r})}
  else if(ck)S.push({k:"ok",st:"stop",t:tr(["Geweigerd","Refused"]),d:tr(["klant loopt via ons eigen team","client goes through our own team"])});
  else if(nf)S.push({k:"ok",st:"fail",t:tr(["Niet bevestigd","Not confirmed"]),d:tr(["salesrep gewaarschuwd","sales rep alerted"])});
  else S.push({k:"ok",st:"todo",t:tr(["Bevestiging","Confirmation"]),d:""});
  // status van de hele aanvraag
  let state="wait";
  if(proc)state="done";else if(nf)state="fail";else if(has("client_known")||has("not_available"))state="stop";else if(st.length&&st.every(s=>s.outcome==="skipped"))state="skip";
  return {S,state,last,known};
}
const STATE={done:["Afgerond","Done"],wait:["Wacht op makelaar","Waiting for agent"],fail:["Actie nodig","Action needed"],stop:["Afgewezen","Declined"],skip:["Overgeslagen","Skipped"]};

function agentCell(c,m){
  const s0=(c.steps||[])[0]||{}, a=c.agent||{};
  const name=a.name||s0.sender_name||s0.sender_email||"—";
  const link=a.id?`<a class="vw-ag" data-c="${esc(a.id)}">${esc(name)}</a>`:`<span class="vw-ag nolink">${esc(name)}</span>`;
  return `<div class="vw-who">${link}<small>${esc(a.company||(m.known?"":tr(["nieuwe makelaar","new agent"])))}</small><small class="vw-mail">${esc(s0.sender_email||"")}</small></div>`;
}
const ICON={done:"✓",wait:"…",fail:"!",stop:"✕",todo:"",na:"–"};
function stepCell(s){
  const inner=`<b>${esc(s.t)}</b>${s.d?`<small>${esc(s.d)}</small>`:""}`;
  const extra=s.ref?` data-p="${esc(s.ref)}"`:(s.cid?` data-c="${esc(s.cid)}"`:"");
  return `<div class="vw-st ${s.st}${extra?" lnk":""}"${extra}><div class="vw-tx">${inner}</div><div class="vw-tr"><i aria-hidden="true">${ICON[s.st]||""}</i></div></div>`;
}
function detail(c){
  return `<div class="vw-det">${(c.steps||[]).map(s=>`<div class="vw-ev"><span class="vw-t">${esc(dmyt(s.at))}</span>
    <span class="vw-o o-${esc(s.outcome)}">${esc(tr(OUT[s.outcome]||[s.outcome,s.outcome]))}</span>
    <span class="vw-x">${[s.ref,s.client_name,[s.day,s.time].filter(Boolean).join(" ")].filter(Boolean).map(esc).join(" · ")}${s.missing&&s.missing.length?` · ${esc(tr(["ontbrak: ","missing: "]))}${esc(missTxt(s.missing))}`:""}${s.note?` · <i>${esc(s.note)}</i>`:""}</span>
    <span class="vw-m">${(s.mails||[]).map(m=>`<span class="vw-chip${m.sent?"":" bad"}" title="${esc(m.subject||"")}">✉ ${esc(tr(MAILK[m.kind]||[m.kind,m.kind]))} → ${esc(m.to)}${m.sent?"":" ⚠"}</span>`).join("")||`<span class="vw-chip dim">${esc(tr(["geen mail","no email"]))}</span>`}</span></div>`).join("")}</div>`;
}

function render(){
  if(!ROOT)return;
  const rows=(D||[]).map(c=>({c,m:model(c)}));
  const cnt={all:rows.length,open:rows.filter(r=>r.m.state==="wait"||r.m.state==="fail").length,done:rows.filter(r=>r.m.state==="done").length};
  const q=Q.trim().toLowerCase();
  const vis=rows.filter(r=>(FILTER==="all"||(FILTER==="open"?(r.m.state==="wait"||r.m.state==="fail"):r.m.state==="done"))
    &&(!q||JSON.stringify([r.c.agent,(r.c.steps||[]).map(s=>[s.sender_email,s.sender_name,s.ref,s.client_name])]).toLowerCase().includes(q)));
  const seg=(k,l)=>`<button type="button" class="${FILTER===k?"on":""}" data-f="${k}">${esc(tr(l))} <span>${cnt[k]}</span></button>`;
  const head=`<div class="vw-bar">
    <div class="seg vw-seg">${seg("all",["Alle","All"])}${seg("open",["Open","Open"])}${seg("done",["Afgerond","Done"])}</div>
    <input id="vwQ" type="search" placeholder="${esc(tr(["Zoek makelaar, ref of klant…","Search agent, ref or client…"]))}" value="${esc(Q)}">
    <select id="vwDays">${[30,60,90,365].map(d=>`<option value="${d}"${d===DAYS?" selected":""}>${d} ${esc(tr(["dagen","days"]))}</option>`).join("")}</select>
    <label class="vw-test"><input type="checkbox" id="vwTest"${TEST?" checked":""}> ${esc(tr(["Testrijen (dry-run)","Test rows (dry run)"]))}</label>
    <button class="btn vw-re" type="button" id="vwRe">↻</button></div>`;
  const cols=[["Makelaar","Agent"],["Ontvangen","Received"],["Makelaar","Agent"],["Gegevens","Details"],["Woning","Property"],["NEXUS","NEXUS"],["Bevestigd","Confirmed"]];
  const body=!D?`<div class="loader">${esc(tr(["Aanvragen laden…","Loading requests…"]))}</div>`
    :!vis.length?`<div class="empty vw-empty">${esc(rows.length?tr(["Geen aanvragen met dit filter.","No requests match this filter."]):tr(["Nog geen bezichtigingsaanvragen in deze periode. Zodra een makelaar via het makelaarsportaal (agents.gruposoltura.com) een bezichtiging aanvraagt, verschijnt de aanvraag hier.","No viewing requests in this period yet. As soon as an agent books a viewing via the agent portal (agents.gruposoltura.com), the request appears here."]))}</div>`
    :`<div class="vw-scroll"><div class="vw-grid">
      <div class="vw-hd">${cols.map((c,i)=>`<span${i===0?' class="sticky"':""}>${esc(tr(c))}</span>`).join("")}<span>${esc(tr(["Status","Status"]))}</span></div>
      ${vis.map(({c,m})=>`<div class="vw-row s-${m.state}${OPEN===c.chain_id?" open":""}" data-id="${esc(c.chain_id)}">
        <div class="sticky">${agentCell(c,m)}</div>${m.S.map(stepCell).join("")}
        <div class="vw-state"><span class="vw-pill ${m.state}">${esc(tr(STATE[m.state]))}</span><small>${esc(ago(c.last_at))}</small></div>
        ${OPEN===c.chain_id?`<div class="vw-detwrap">${detail(c)}</div>`:""}</div>`).join("")}
    </div></div>`;
  ROOT.innerHTML=`<div class="vw">${head}<p class="vw-lead">${esc(tr(["Elke rij is één bezichtigingsaanvraag van een makelaar via het makelaarsportaal agents.gruposoltura.com (gesprek met Sola). Sinds 28-10-2026 is dat de enige route; rijen met een mail als bron zijn van daarvoor. De flow loopt van links (binnengekomen) naar rechts (bevestigd en doorgestuurd naar de salesrep). Klik op een rij voor alle mails.","Each row is one viewing request from an agent via the agent portal agents.gruposoltura.com (chat with Sola). Since 28-10-2026 that is the only route; rows with email as source are from before. The flow runs from left (received) to right (confirmed and forwarded to the sales rep). Click a row for every email."]))}</p>${body}</div>`;
  wire();
}
function wire(){
  ROOT.querySelectorAll(".vw-seg button").forEach(b=>b.onclick=()=>{FILTER=b.dataset.f;render()});
  const q=ROOT.querySelector("#vwQ");if(q)q.oninput=()=>{Q=q.value;const pos=q.selectionStart;render();const n=ROOT.querySelector("#vwQ");n.focus();try{n.setSelectionRange(pos,pos)}catch(e){}};
  const d=ROOT.querySelector("#vwDays");if(d)d.onchange=()=>{DAYS=+d.value;load()};
  const t=ROOT.querySelector("#vwTest");if(t)t.onchange=()=>{TEST=t.checked;load()};
  const r=ROOT.querySelector("#vwRe");if(r)r.onclick=()=>load();
  ROOT.querySelectorAll(".vw-row").forEach(row=>row.onclick=e=>{
    const a=e.target.closest("[data-c],[data-p]");
    if(a&&row.contains(a)){e.stopPropagation();if(a.dataset.c)location.hash="c/"+encodeURIComponent(a.dataset.c);else location.hash="p/"+encodeURIComponent(a.dataset.p);return}
    if(e.target.closest(".vw-detwrap"))return;
    OPEN=OPEN===row.dataset.id?null:row.dataset.id;render()});
}
async function load(){
  if(BUSY)return;BUSY=true;D=null;render();
  try{D=await X.rpc("nexus_viewing_board",{p_days:DAYS,p_test:TEST})||[]}
  catch(e){ROOT.innerHTML=`<div class="empty">${esc(e.message||e)}</div>`}
  finally{BUSY=false}
  if(D)render();
}
window.NEXUS_VIEWINGS={
  open(root,ctx){X=ctx;ROOT=root;load()},
  rerender(){render()}
};
})();
