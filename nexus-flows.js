/* NEXUS · Contact › Contactmomenten — formulierflows per contact (Rick, 22-10-2026).
   Klik in Binnenkomend op een aanvraag: het contact opent altijd op Contactmomenten, met bovenaan alle aanvragen van dat contact
   als compacte flow onder elkaar, van het formulier (links) tot afgerond (rechts); de aangeklikte aanvraag is gemarkeerd. Kleur = kwalificatie van de lead (Hot / Warm / Cold / geen lead).
   Bron: RPC nexus_contact_flows(p_contact, p_limit) (migratie 060): per aanvraag web_contact_requests, jarvis_runs
   (WebFormIntakeV2 / WpLeadBridgeV2 / LeadProcessorV2 / PurchaseInfoV2 / SellerGuideV2 / FavoritesMail), leads en email_events.
   Klik op een stap voor uitleg en wat er werkelijk gebeurde. */
(function(){
"use strict";
let X=null, ROOT=null, D=null, CID=null, RID=null, SEQ=0;
const tr=v=>Array.isArray(v)?(X&&X.lang()==="en"?v[1]:v[0]):v;
const esc=v=>v==null?"":String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dmyt=ts=>ts?(window.NEXUS_DMYT?NEXUS_DMYT(new Date(ts)):new Date(ts).toLocaleString()):"—";
const hm=ts=>{if(!ts)return"";const d=new Date(ts);return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0")};
const mins=(a,b)=>a&&b?Math.max(0,Math.round((new Date(b)-new Date(a))/1000)):null;
const dur=s=>s==null?"":s<60?`${s} s`:s<3600?`${Math.round(s/60)} min`:`${Math.round(s/3600)} u`;
const REPN={"rick@gruposoltura.com":"Rick","marco@gruposoltura.com":"Marco","ingrid@gruposoltura.com":"Ingrid","lisette@gruposoltura.com":"Lisette","info@gruposoltura.com":"info@"};
const repName=e=>REPN[String(e||"").toLowerCase()]||e||"";

/* ---------- kwalificatie ---------- */
const QL={hot:["Hot","Hot"],warm:["Warm","Warm"],cold:["Cold","Cold"],none:["Geen lead","No lead"]};
/* zelfde tabel als LeadProcessor-v2 (Build scoring prompt, 22-10-2026) plus de oude-site-typen */
const QT={
  hot:["viewing","valuation","bookaviewing","book-viewing","makeoffer","make-offer","callme","sellforfree"],
  warm:["costs","move","contact","contact-form","general-homepage","general_enquiry","purchaseinfo","guide","property-details","agent","info","mortgage","setprice","listings","listingshelp",
        "3rdkyero","3rdthinkspain","3rdmovechannel","3rdpropaway","3rdpropshowrms","3rdeudomi","huizeninspanje","ferienbolig","solturadirect","apprequest","order","idealista"],
  cold:["favorite","favorites","favourite","notify","notify-back","pdfbrochure","pdf-brochure","searchdetails","search-details","emailalert","bargain","secretdeals","dashboard"],
  none:["newsletter"]};
function qual(f){
  const s=String(f.lp&&f.lp.score||"").toLowerCase();if(QL[s])return s;
  for(const k of [f.kind,f.type,f.key]){const v=String(k||"").toLowerCase().replace(/^request-/,"");for(const q in QT)if(QT[q].includes(v))return q}
  return "warm";
}
/* route zoals WebFormIntake-v2 hem kiest */
function route(f){
  if(f.intake&&f.intake.route)return f.intake.route==="guide"?"leadprocessor":f.intake.route;
  const k=String(f.kind||f.type||"").toLowerCase();
  if(k==="newsletter")return"newsletter";if(k==="favorites"||k==="favorite")return"favorites";if(k==="notify"||k==="notify-back")return"none";
  return"leadprocessor";
}
const origin=f=>f.source==="cpr_import"?"old":(f.web||f.source==="website"||f.source==="website-new")?"web":"other";

/* ---------- stappen per flow ---------- */
/* st: done | wait | fail | skip ; id verwijst naar de uitleg in INFO */
function steps(f){
  const o=origin(f), q=qual(f), age=(Date.now()-new Date(f.ts))/60000, S=[];
  const late=age>30;
  S.push({id:"form",st:"done",t:X.rq(f.key)||f.key,s:o==="old"?tr(["oude site","old site"]):o==="web"?tr(["website","website"]):(f.source||"")});
  if(o==="old"){
    S.push({id:"import",st:"done",t:tr(["In NEXUS","In NEXUS"]),s:tr(["geïmporteerd","imported"])});
    S.push({id:"oldflow",st:f.status==="closed"?"done":"skip",t:tr(["Oude opvolging","Old follow-up"]),s:f.status==="closed"?tr(["afgesloten","closed"]):tr(["via WordPress","via WordPress"])});
    return S;
  }
  if(o==="web"){
    const w=f.web;
    S.push({id:"edge",st:w?"done":"skip",t:tr(["Ontvangst","Received"]),s:w?hm(w.at):tr(["geen webrij","no web row"])});
    const ierr=(w&&w.error)||(f.intake&&f.intake.error);
    S.push({id:"intake",st:ierr?"fail":(w&&w.processed_at)||f.intake?"done":(late?"fail":"wait"),t:"Intake",
      s:ierr?tr(["fout","error"]):w&&w.processed_at?dur(mins(w.at,w.processed_at)):tr(["wacht","waiting"])});
  } else {
    S.push({id:"bridge",st:f.intake?"done":"skip",t:tr(["Doorgifte","Hand-over"]),s:f.intake?hm(f.intake.at):(f.source||"")});
  }
  S.push({id:"nexus",st:"done",t:"NEXUS",s:tr(["contact + aanvraag","contact + request"])});
  const r=route(f), mail=(f.mails||[])[0];
  const mailSt=m=>!m?null:(m.events||[]).some(e=>/hard|soft|block|invalid|spam|error/.test(e))?"fail":"done";
  const mailSub=m=>{const ev=m.events||[];return ev.some(e=>/click/.test(e))?tr(["geklikt","clicked"]):ev.some(e=>/open/.test(e))?tr(["geopend","opened"]):ev.some(e=>/deliver/.test(e))?tr(["afgeleverd","delivered"]):(ev[0]||"")};
  if(r==="leadprocessor"){
    const lp=f.lp, lpErr=lp&&(lp.status==="error"||lp.error);
    S.push({id:"lp",st:lp?(lpErr?"fail":"done"):(late?"fail":"wait"),t:"LeadProcessor",s:lp?tr(["score ","score "])+String(lp.score||"?"):(late?tr(["geen run","no run"]):tr(["wacht","waiting"])),q:true});
    S.push({id:"rep",st:lp?(lp.leadcard==="sent"?"done":"skip"):"skip",t:tr(["Leadcard","Lead card"]),s:lp&&lp.rep?"→ "+repName(lp.rep):"—"});
    const isGuide=String(f.kind||f.type||"").toLowerCase().match(/guide|purchaseinfo/), isVal=String(f.kind||f.type||"").toLowerCase()==="valuation";
    if(isGuide||isVal){const fo=f.follow;
      S.push({id:isGuide?"gids":"seller",st:fo?(fo.status==="error"?"fail":"done"):(lp&&late?"fail":"wait"),t:isGuide?tr(["Aankoopgids","Buying guide"]):"SellerGuide",
        s:fo?(fo.attachment?tr(["met PDF","with PDF"]):tr(["verstuurd","sent"])):tr(["wacht","waiting"])});}
    S.push({id:"mail",st:mailSt(mail)||(lp&&late?"skip":"wait"),t:tr(["Mail klant","Client email"]),s:mail?mailSub(mail):(lp&&late?tr(["niet gevonden","not found"]):tr(["wacht","waiting"]))});
    if(q==="hot")S.push({id:"hot",st:lp?"done":"wait",t:tr(["Agenda","Calendar"]),s:tr(["+ cc Rick","+ cc Rick"])});
  } else if(r==="newsletter"){
    const fo=f.follow;S.push({id:"nl",st:fo?(fo.status==="error"?"fail":"done"):(late?"fail":"wait"),t:"NewsletterConfirm",s:fo?(fo.lang||"").toUpperCase():tr(["wacht","waiting"])});
    S.push({id:"mail",st:mailSt(mail)||(fo?"skip":"wait"),t:tr(["Bevestiging","Confirmation"]),s:mail?mailSub(mail):"—"});
  } else if(r==="favorites"){
    const fo=f.follow;S.push({id:"fav",st:fo?(fo.status==="error"?"fail":"done"):(late?"fail":"wait"),t:"FavoritesMail",s:fo?(fo.to?tr(["verstuurd","sent"]):""):tr(["wacht","waiting"])});
    S.push({id:"mail",st:mailSt(mail)||(fo?"skip":"wait"),t:tr(["Mail klant","Client email"]),s:mail?mailSub(mail):"—"});
  } else {
    S.push({id:"bom",st:f.status==="closed"?"done":"wait",t:"BackOnMarket",s:f.status==="closed"?tr(["gemaild","emailed"]):tr(["wacht op woning","waits for property"])});
  }
  const anyFail=S.some(s=>s.st==="fail"), anyWait=S.some(s=>s.st==="wait");
  S.push({id:"end",st:anyFail?"fail":anyWait?"wait":"done",t:tr(["Afgerond","Done"]),s:anyFail?tr(["controleren","check"]):anyWait?tr(["loopt","running"]):f.processed_at?hm(f.processed_at):"✓"});
  return S;
}

/* ---------- uitleg per stap (popup) ---------- */
const INFO={
  form:f=>({h:[X.rq(f.key)||f.key,X.rq(f.key)||f.key],p:[
    ["Het eerste contactmoment: de bezoeker vulde dit formulier in. Elk formulier is een lead.","The first contact moment: the visitor filled in this form. Every form is a lead."]],
    facts:[[tr(["Formulier","Form"]),f.form_id||f.type],[tr(["Pagina","Page"]),f.page_url||(f.web&&f.web.page_url)],[tr(["Woning","Property"]),f.ref],[tr(["Taal","Language"]),f.lang],
      [tr(["Kwalificatie","Qualification"]),tr(QL[qual(f)])+(f.lp&&f.lp.score?tr([" (door AI gescoord)"," (scored by AI)"]):tr([" (volgens scoretabel)"," (by score table)"]))],
      [tr(["Bericht","Message"]),f.message]]}),
  edge:f=>({h:["Ontvangst · web-contact","Received · web-contact"],p:[
    ["Spamfilter (verborgen veld), controle op e-mail of telefoon, en opslag van het volledige formulier in web_contact_requests. Daarna direct gemeld aan de intake; lukt dat niet, dan pakt het vangnet het binnen 15 minuten op.",
     "Spam filter (hidden field), check for email or phone, and storage of the full form in web_contact_requests. Then reported to the intake right away; if that fails, the safety net picks it up within 15 minutes."]],
    facts:f.web?[[tr(["Ontvangen","Received"]),dmyt(f.web.at)],[tr(["Direct gemeld","Reported directly"]),f.web.intake_notified?tr(["ja","yes"]):tr(["nee, via vangnet","no, via safety net"])],["Web-id",f.web.id]]:[]}),
  intake:f=>({h:["Intake · WebFormIntake-v2","Intake · WebFormIntake-v2"],p:[
    ["Leest het formulier uit (naam, velden, UTM, woning) en kiest de opvolging: LeadProcessor voor vragen en koopgids, NewsletterConfirm voor de nieuwsbrief, FavoritesMail voor favorieten, BackOnMarket voor een seintje.",
     "Reads the form (name, fields, UTM, property) and picks the follow-up: LeadProcessor for questions and the buying guide, NewsletterConfirm for the newsletter, FavoritesMail for favourites, BackOnMarket for a notify request."]],
    facts:[[tr(["Verwerkt","Processed"]),f.web&&f.web.processed_at?dmyt(f.web.processed_at):"—"],[tr(["Route","Route"]),f.intake&&f.intake.route],[tr(["Doorgestuurd","Forwarded"]),f.intake?(f.intake.routed?tr(["ja","yes"]):tr(["nee","no"])):"—"],
      [tr(["Reden","Reason"]),f.intake&&f.intake.skip],[tr(["Fout","Error"]),(f.web&&f.web.error)||(f.intake&&f.intake.error)]]}),
  bridge:f=>({h:["Doorgifte","Hand-over"],p:[["Deze aanvraag kwam niet via het websiteformulier binnen, maar via een ander kanaal (bijvoorbeeld Idealista) en werd door WpLeadBridge-v2 in NEXUS gezet.",
    "This request did not come in through the website form but through another channel (for example Idealista) and was put into NEXUS by WpLeadBridge-v2."]],facts:[[tr(["Bron","Source"]),f.source],[tr(["Tijd","Time"]),f.intake&&dmyt(f.intake.at)]]}),
  nexus:f=>({h:["NEXUS · contact + aanvraag","NEXUS · contact + request"],p:[["Het contact is gevonden op e-mail of telefoon, of nieuw aangemaakt als Suspect. De aanvraag staat als contactmoment bij het contact. Hetzelfde formulier wordt nooit twee keer verwerkt.",
    "The contact was matched on email or phone, or created as a new Suspect. The request is stored as a contact moment. The same form is never processed twice."]],facts:[[tr(["Aangemaakt","Created"]),dmyt(f.ts)],[tr(["Status aanvraag","Request status"]),f.status]]}),
  import:f=>({h:["Geïmporteerd uit de oude site","Imported from the old site"],p:[["Deze aanvraag kwam binnen via de oude WordPress-site en is bij de overstap naar NEXUS geïmporteerd. De opvolging liep toen via de oude flow; daar zijn hier geen stappen van bewaard.",
    "This request came in through the old WordPress site and was imported when NEXUS went live. Follow-up ran through the old flow; its steps are not stored here."]],facts:[[tr(["Datum","Date"]),dmyt(f.ts)],[tr(["Bericht","Message"]),f.message]]}),
  oldflow:f=>({h:["Oude opvolging","Old follow-up"],p:[["Opvolging via de oude LeadProcessor op WordPress (leadcard naar de rep). Status zoals geïmporteerd.","Follow-up through the old LeadProcessor on WordPress (lead card to the rep). Status as imported."]],facts:[["Status",f.status]]}),
  lp:f=>({h:["LeadProcessor-v2","LeadProcessor-v2"],p:[["Zoekt de woning op, bepaalt de rep (listing-agent van de woning, anders op naam), legt het kanaal vast en laat de AI de lead scoren: Hot bij bezichtiging en waardebepaling; Warm bij kosten, emigratie, contact en koopgids; Cold bij favorieten en seintje.",
    "Looks up the property, picks the rep (the listing agent, otherwise by name), records the channel and lets the AI score the lead: Hot for viewings and valuations; Warm for costs, relocation, contact and buying guide; Cold for favourites and notify requests."]],
    facts:f.lp?[[tr(["Score","Score"]),f.lp.score],[tr(["Rep","Rep"]),repName(f.lp.rep)],[tr(["Kanaal","Channel"]),f.lead&&(f.lead.source+(f.lead.campaign?" · "+f.lead.campaign:""))],[tr(["Tijd","Time"]),dmyt(f.lp.at)],[tr(["Samenvatting","Summary"]),f.lp.summary]]:[[tr(["Status","Status"]),tr(["Geen run gevonden voor deze aanvraag","No run found for this request"])]]}),
  rep:f=>({h:["Leadcard naar de rep","Lead card to the rep"],p:[["Samenvatting in het Nederlands met score, bron, urgentie en aanbevolen actie. Onderaan staat wat de klant al automatisch ontving. Zonder rep gaat hij naar info@.",
    "Summary in Dutch with score, source, urgency and recommended action. At the bottom it shows what the client already received automatically. Without a rep it goes to info@."]],facts:[[tr(["Aan","To"]),f.lp&&f.lp.rep],[tr(["Leadcard","Lead card"]),f.lp&&f.lp.leadcard]]}),
  gids:f=>({h:["Aankoopgids","Buying guide"],p:[["LeadProcessor zette de aanvraag door naar PurchaseInfo-v2: de klant krijgt de aankoopgids als PDF, in het Nederlands of Engels. Geen tweede antwoordmail.",
    "LeadProcessor passed the request to PurchaseInfo-v2: the client gets the buying guide as a PDF, in Dutch or English. No second reply email."]],facts:f.follow?[[tr(["Aan","To"]),f.follow.to],[tr(["Taal","Language"]),f.follow.lang],["PDF",f.follow.attachment?tr(["ja","yes"]):tr(["nee","no"])],[tr(["Tijd","Time"]),dmyt(f.follow.at)]]:[]}),
  seller:f=>({h:["SellerGuide-v2","SellerGuide-v2"],p:[["Een waardebepaling komt van een mogelijke verkoper: die krijgt de verkoopbegeleiding-infotorial.","A valuation comes from a possible seller: they receive the seller guidance infotorial."]],
    facts:f.follow?[[tr(["Aan","To"]),f.follow.to],["PDF",f.follow.attachment?tr(["ja","yes"]):tr(["nee","no"])],[tr(["Tijd","Time"]),dmyt(f.follow.at)]]:[]}),
  nl:f=>({h:["NewsletterConfirm-v2","NewsletterConfirm-v2"],p:[["Bevestigt de inschrijving met de gekozen interesses en een afmeldlink. Een inschrijving is geen vraag: geen leadcard naar het team.",
    "Confirms the subscription with the chosen interests and an unsubscribe link. A subscription is not a question: no lead card to the team."]],facts:f.follow?[[tr(["Aan","To"]),f.follow.to],[tr(["Taal","Language"]),f.follow.lang],[tr(["Tijd","Time"]),dmyt(f.follow.at)]]:[]}),
  fav:f=>({h:["FavoritesMail","FavoritesMail"],p:[["Mailt de bezoeker zijn favoriete woningen in de huisstijl. Een signaal voor later, geen directe actie.","Emails the visitor their favourite properties in house style. A signal for later, no direct action."]],
    facts:f.follow?[[tr(["Aan","To"]),f.follow.to],[tr(["Tijd","Time"]),dmyt(f.follow.at)]]:[]}),
  bom:f=>({h:["BackOnMarket","BackOnMarket"],p:[["De aanvraag blijft open tot de gereserveerde woning weer beschikbaar is. Dan mailt BackOnMarket de bezoeker en sluit de aanvraag.",
    "The request stays open until the reserved property is available again. Then BackOnMarket emails the visitor and closes the request."]],facts:[[tr(["Woning","Property"]),f.ref],["Status",f.status]]}),
  mail:f=>({h:["Mail aan de klant","Email to the client"],p:[["Transactionele mail via Brevo, met de rep als reply-to. Hieronder de status zoals Brevo die terugmeldt.","Transactional email via Brevo, with the rep as reply-to. Below is the status as reported back by Brevo."]],
    facts:(f.mails||[]).map(m=>[hm(m.at)+" · "+(m.subject||""),(m.events||[]).join(", ")])}),
  hot:f=>({h:["Hot: agenda en cc Rick","Hot: calendar and cc Rick"],p:[["Bij een Hot lead staat Rick in cc op de leadcard en komt er een afspraak in de agenda van de rep: bij terugbellen 2 uur na binnenkomst, anders 10:00 op de eerstvolgende werkdag.",
    "For a Hot lead Rick is cc'd on the lead card and the rep gets a calendar event: for a call-back 2 hours after arrival, otherwise 10:00 on the next working day."]],facts:[[tr(["Rep","Rep"]),f.lp&&repName(f.lp.rep)]]}),
  end:f=>({h:["Afgerond","Done"],p:[["Het formulier is als verwerkt gemarkeerd en elke run staat in jarvis_runs. Blijft een formulier 30 minuten liggen, dan meldt JARVIS dat direct.",
    "The form is marked as processed and every run is in jarvis_runs. If a form sits for 30 minutes, JARVIS reports it right away."]],facts:[[tr(["Verwerkt","Processed"]),f.processed_at?dmyt(f.processed_at):"—"]]})
};

/* ---------- render ---------- */
const ICON={done:"✓",wait:"…",fail:"!",skip:"–"};
function flowHtml(f,i){
  const q=qual(f), S=steps(f), o=origin(f);
  const ORIG={old:["Oude site","Old site"],web:["Website","Website"],other:[f.source||"Overig",f.source||"Other"]};
  return `<div class="fl-card q-${q}${f.id===RID?" on":""}" data-fi="${i}">
    <div class="fl-hd"><span class="fl-q">${esc(tr(QL[q]))}</span><b class="fl-t">${esc(X.rq(f.key)||f.key)}</b>${f.ref?`<span class="fl-ref" data-p="${esc(f.ref)}">${esc(f.ref)}</span>`:""}
      <span class="fl-o">${esc(tr(ORIG[o]))}</span><span class="fl-ts" title="${esc(dmyt(f.ts))}">${esc(dmyt(f.ts))}</span></div>
    ${f.message?`<div class="fl-msg" title="${esc(f.message)}">${esc(f.message)}</div>`:""}
    <div class="fl-track">${S.map((s,j)=>`<button type="button" class="fl-n ${s.st}" data-s="${j}" data-id="${s.id}"><i aria-hidden="true">${ICON[s.st]}</i><b>${esc(s.t)}</b><small>${esc(s.s||"")}</small></button>`).join("")}</div></div>`;
}
function render(){
  if(!ROOT)return;
  if(!D){ROOT.innerHTML=`<div class="fl-wrap"><div class="sm muted">${esc(tr(["Formulierflows laden…","Loading form flows…"]))}</div></div>`;return}
  const fl=D.flows||[];
  if(!fl.length){ROOT.innerHTML="";return}
  ROOT.innerHTML=`<div class="fl-wrap">
    <div class="fl-top"><h4>${esc(tr(["Formulieren","Forms"]))} <span class="cnt">${D.total||fl.length}</span></h4>
      <div class="fl-leg">${["hot","warm","cold","none"].map(q=>`<span class="fl-lg q-${q}">${esc(tr(QL[q]))}</span>`).join("")}</div></div>
    <div class="fl-list">${fl.map(flowHtml).join("")}
      ${D.total>fl.length?`<div class="sm muted" style="padding:2px 4px">${esc(tr([`en ${D.total-fl.length} oudere aanvragen, zie de tijdlijn hieronder`,`and ${D.total-fl.length} older requests, see the timeline below`]))}</div>`:""}</div></div>`;
  ROOT.querySelectorAll(".fl-n").forEach(b=>b.onclick=e=>{e.stopPropagation();const card=b.closest(".fl-card");popup(fl[+card.dataset.fi],b.dataset.id,b.className.split(" ")[1])});
  const on=ROOT.querySelector(".fl-card.on");if(on&&on.scrollIntoView)try{on.scrollIntoView({block:"nearest"})}catch(e){}
}
function popup(f,id,st){
  const I=(INFO[id]||INFO.nexus)(f);
  const facts=(I.facts||[]).filter(x=>x[1]!=null&&x[1]!=="");
  const STL={done:["Gedaan","Done"],wait:["Loopt nog","In progress"],fail:["Controleren","Check"],skip:["Niet van toepassing","Not applicable"]};
  let ov=document.getElementById("flPop");if(ov)ov.remove();
  ov=document.createElement("div");ov.id="flPop";ov.className="fl-pop";
  ov.innerHTML=`<div class="fl-box q-${qual(f)}" role="dialog" aria-modal="true" aria-labelledby="flPopH">
    <div class="fl-bh"><div><small>${esc(X.rq(f.key)||f.key)} · ${esc(dmyt(f.ts))}</small><h3 id="flPopH">${esc(tr(I.h))}</h3></div><button type="button" class="fl-x" aria-label="${esc(tr(["Sluiten","Close"]))}">×</button></div>
    <div class="fl-bb"><span class="fl-st ${st}">${ICON[st]} ${esc(tr(STL[st]||STL.done))}</span>
      ${(I.p||[]).map(p=>`<p>${esc(tr(p))}</p>`).join("")}
      ${facts.length?`<dl>${facts.map(x=>`<dt>${esc(x[0])}</dt><dd>${esc(x[1])}</dd>`).join("")}</dl>`:""}</div></div>`;
  document.body.appendChild(ov);
  const shut=()=>{ov.remove();document.removeEventListener("keydown",key)};
  const key=e=>{if(e.key==="Escape")shut()};
  ov.onclick=e=>{if(e.target===ov||e.target.closest(".fl-x"))shut()};
  document.addEventListener("keydown",key);ov.querySelector(".fl-x").focus();
}
function close(){CID=null;RID=null;D=null;const p=document.getElementById("flPop");if(p)p.remove()}
async function open(root,contactId,requestId,ctx){
  X=ctx;ROOT=root;
  if(CID!==contactId){CID=contactId;D=null}
  RID=requestId||null;render();
  const my=++SEQ;
  try{const d=await X.rpc("nexus_contact_flows",{p_contact:contactId,p_limit:15});if(my!==SEQ)return;D=d||{flows:[]};render()}
  catch(e){if(my!==SEQ)return;ROOT.innerHTML=`<div class="fl-wrap"><div class="empty">${esc(e.message||e)}</div></div>`}
}
window.NEXUS_FLOWS={open,close,rerender:render,current:()=>CID};
})();
