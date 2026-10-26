/* v11 (25-10-2026): list() filtert interne mails (New Lead, JARVIS) uit Mail klant; nexus_flow_obj sluit ze ook server-side uit. v10 (25-10-2026): list() - Aanvragen/Portalen tonen alle aanvragen als flowkaarten (bron: nexus_request_flows), met contactnaam en rep. v9 (25-10-2026): aangeklikte aanvraag bovenaan met label en accentrand; portaalbron in eigen kleur (NEXUS_SRC). v8 (25-10-2026): interne mails (JARVIS, New Lead, ook met emoji vooraf) niet als losse mailflow. v7 (25-10-2026): mailpopup compact (kolom fit-content, onderwerp als eigen regel, Brevo-status leesbaar), interne mails niet bij Mail klant. v6 (25-10-2026): intake overgeslagen als de aanvraag niet via web-contact binnenkwam. v5 (23-10-2026): losse automatische mails als flow met één node. */
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
/* brochureblok woningpagina (BD-149, 24-10-2026): welke documenten de klant vroeg (fields.docs) */
const DOCN={brochure:["Woningbrochure","Property brochure"],costs:["Kostenoverzicht","Cost overview"]};
const docsTxt=f=>{const d=Array.isArray(f&&f.docs)?f.docs.filter(x=>DOCN[x]):[];return d.length?d.map(x=>tr(DOCN[x])).join(" + "):""};
const docsSent=f=>{const d=Array.isArray(f&&f.docs)?f.docs:[];return d.map(x=>x==="brochure"?tr(["Woningbrochure als bijlage (PDF)","Property brochure attached (PDF)"]):x==="costs"?tr(["Kostenoverzicht als downloadlink","Cost overview as download link"]):null).filter(Boolean).join(" · ")};
const ANS={yes:["ja","yes"],no:["nee","no"]};
const ansTxt=f=>{const a=f&&f.answers;if(!a)return"";const v=k=>a[k]?tr(ANS[a[k]]||[a[k],a[k]]):tr(["niet beantwoord","not answered"]);
  return tr(["NIE nodig: ","Needs NIE: "])+v("nie")+" · "+tr(["Spaanse hypotheek: ","Spanish mortgage: "])+v("mortgage")+" · "+tr(["Volmacht: ","Power of attorney: "])+v("power_of_attorney")};
const fTitle=f=>{const b=X.rq(f.key)||f.key,d=docsTxt(f);return d?b+" · "+d:b};

/* ---------- kwalificatie ---------- */
const QL={hot:["Hot","Hot"],warm:["Warm","Warm"],cold:["Cold","Cold"],none:["Geen lead","No lead"],mail:["Mail","Email"]};
/* zelfde tabel als LeadProcessor-v2 (Build scoring prompt, 22-10-2026) plus de oude-site-typen */
const QT={
  hot:["viewing","valuation","bookaviewing","book-viewing","makeoffer","make-offer","offer","idealista-offer","callme","sellforfree"],
  warm:["costs","move","contact","contact-form","general-homepage","general_enquiry","purchaseinfo","guide","property-details","agent","info","mortgage","setprice","listings","listingshelp",
        "3rdkyero","3rdthinkspain","3rdmovechannel","3rdpropaway","3rdpropshowrms","3rdeudomi","huizeninspanje","ferienbolig","solturadirect","apprequest","order","idealista","idealista-message"],
  cold:["favorite","favorites","favourite","notify","notify-back","pdfbrochure","pdf-brochure","searchdetails","search-details","emailalert","bargain","secretdeals","dashboard"],
  none:["newsletter","optin"]};
function qual(f){
  if(f._mail)return"mail";
  const s=String(f.lp&&f.lp.score||"").toLowerCase();if(QL[s])return s;
  for(const k of [f.kind,f.type,f.key]){const v=String(k||"").toLowerCase().replace(/^request-/,"");for(const q in QT)if(QT[q].includes(v))return q}
  return "warm";
}
/* route zoals WebFormIntake-v2 hem kiest */
/* Alleen WebFormIntake-v2 logt een echte route. WpLeadBridge-v2 (Idealista) logt in stats.kind de formuliersoort,
   geen route: die werd hier ten onrechte als route gelezen, waardoor elke onbekende soort als BackOnMarket getekend werd (fix 22-10-2026). */
const ROUTES=["leadprocessor","newsletter","favorites","none"];
function route(f){
  const k=String(f.kind||f.type||"").toLowerCase();
  const isNotify=k==="notify"||k==="notify-back";
  const ir=f.intake&&f.intake.wf==="WebFormIntakeV2"?String(f.intake.route||""):"";
  if(ir==="guide")return"leadprocessor";
  if(ROUTES.includes(ir))return ir==="none"&&!isNotify?"leadprocessor":ir;
  if(k==="newsletter")return"newsletter";if(k==="favorites"||k==="favorite")return"favorites";if(isNotify)return"none";
  return"leadprocessor";
}
const origin=f=>f.source==="cpr_import"?"old":(f.web||f.source==="website"||f.source==="website-new")?"web":"other";

/* portaalkanalen: naam zoals het team hem kent + de intake-agent die de portaalmail leest */
/* kleur per portaal/bron (Rick, 25-10-2026): elk portaal een eigen kleur in de lijst, chips en flows; nieuw portaal krijgt een vaste kleur uit de reserve */
const SRCC={idealista:"#84cc16","idealista-message":"#84cc16",thinkspain:"#f97316"};
const SRCN={idealista:"Idealista","idealista-message":"Idealista",thinkspain:"thinkSPAIN"};
const SRCX=["#06b6d4","#eab308","#14b8a6","#f43f5e","#6366f1","#d946ef"];
const srcColor=k=>{k=String(k||"").toLowerCase().replace(/^p:/,"");if(SRCC[k])return SRCC[k];let h=0;for(const c of k)h=(h*31+c.charCodeAt(0))>>>0;return SRCX[h%SRCX.length]};
window.NEXUS_SRC={color:srcColor,name:k=>{k=String(k||"").toLowerCase().replace(/^p:/,"");return SRCN[k]||k},isPortal:k=>{k=String(k||"").toLowerCase();return k.startsWith("p:")||!!SRCC[k]}};
const CHAN={idealista:{n:"Idealista",wf:"IdealistaLeadIntake"},"idealista-message":{n:"Idealista",wf:"IdealistaLeadIntake"},thinkspain:{n:"thinkSPAIN",wf:"ThinkSpainLeadIntake"}};

/* ---------- mailnode-status ---------- */
const INTERNAL_SUBJ=/^[^A-Za-z0-9\[]*(New Lead\b|JARVIS\b|\[Website\]|Lead ?card\b)/i; /* emoji/teken vooraf toegestaan: '🔵 New Lead — …' (25-10-2026) */
/* Brevo-events leesbaar, in volgorde van de reis van de mail */
const EVN={request:["verstuurd","sent"],delivered:["afgeleverd","delivered"],unique_opened:["geopend","opened"],opened:["geopend","opened"],click:["geklikt","clicked"],
  soft_bounce:["soft bounce","soft bounce"],hard_bounce:["hard bounce","hard bounce"],blocked:["geblokkeerd","blocked"],invalid_email:["ongeldig adres","invalid address"],spam:["als spam gemeld","reported as spam"],deferred:["uitgesteld","deferred"],error:["fout","error"]};
const evTxt=ev=>{const o=[];(ev||[]).forEach(e=>{const t=tr(EVN[e]||[e,e]);if(!o.includes(t))o.push(t)});const ord=Object.values(EVN).map(x=>tr(x));return o.sort((a,b)=>(ord.indexOf(a)+99)%99-(ord.indexOf(b)+99)%99).join(" → ")};
const mailSt=m=>!m?null:(m.events||[]).some(e=>/hard|soft|block|invalid|spam|error/.test(e))?"fail":"done";
const mailSub=m=>{const ev=m.events||[];return ev.some(e=>/click/.test(e))?tr(["geklikt","clicked"]):ev.some(e=>/open/.test(e))?tr(["geopend","opened"]):ev.some(e=>/deliver/.test(e))?tr(["afgeleverd","delivered"]):(ev[0]||"")};
/* oogje op de mailnode (Rick, 23-10-2026): de klant opende (of klikte in) de mail, ook als dat dagen later was (migratie 071) */
const mailEye=m=>{if(!m)return null;const ev=m.events||[];const op=m.opened_at||(ev.some(e=>/open/.test(e))?"?":null),cl=m.clicked_at||(ev.some(e=>/click/.test(e))?"?":null);
    if(!op&&!cl)return null;const w=x=>x&&x!=="?"?" "+dmyt(x):"";
    return {click:!!cl,title:(op?tr(["Geopend door de klant","Opened by the client"])+w(op):"")+(cl?(op?" · ":"")+tr(["geklikt","clicked"])+w(cl):"")}};

/* ---------- stappen per flow ---------- */
/* st: done | wait | fail | skip ; id verwijst naar de uitleg in INFO */
function steps(f){
  const o=origin(f), q=qual(f), age=(Date.now()-new Date(f.ts))/60000, S=[];
  const late=age>30;
  /* losse automatische mail zonder formulier (bv. "Your property is live!", seller-update): één node "Mail klant" (Rick, 23-10-2026) */
  if(f._mail){const m=(f.mails||[])[0];S.push({id:"mail",st:mailSt(m)||"done",t:tr(["Mail klant","Client email"]),s:mailSub(m)||hm(f.ts),eye:mailEye(m)});return S}
  if(f._synthetic){}else S.push({id:"form",st:"done",t:docsTxt(f)||X.rq(f.key)||f.key,s:o==="old"?tr(["oude site","old site"]):o==="web"?tr(["website","website"]):(f.source||"")});
  if(f._synthetic){
    S.push({id:"optin",st:"done",t:tr(["Opt-in","Opt-in"]),s:tr(["bij import","at import"])});
    S.push({id:"nexus",st:"done",t:"NEXUS",s:tr(["mailingvoorkeuren","mailing preferences"])});
    return S;
  }
  if(o==="old"){
    S.push({id:"import",st:"done",t:tr(["In NEXUS","In NEXUS"]),s:tr(["geïmporteerd","imported"])});
    S.push({id:"oldflow",st:f.status==="closed"?"done":"skip",t:tr(["Oude opvolging","Old follow-up"]),s:f.status==="closed"?tr(["afgesloten","closed"]):tr(["via WordPress","via WordPress"])});
    return S;
  }
  if(o==="web"){
    const w=f.web;
    S.push({id:"edge",st:w?"done":"skip",t:tr(["Ontvangst","Received"]),s:w?hm(w.at):tr(["geen webrij","no web row"])});
    const ierr=(w&&w.error)||(f.intake&&f.intake.error);
    /* geen webrij en geen intake-run: de aanvraag kwam niet via web-contact binnen (bv. rechtstreeks in LeadProcessor).
       Dan is er ook niets om op te wachten: overgeslagen, niet 'wacht' (Rick, 25-10-2026). */
    if(!w&&!f.intake)S.push({id:"intake",st:"skip",t:"Intake",s:tr(["niet via intake","not via intake"])});
    else S.push({id:"intake",st:ierr?"fail":(w&&w.processed_at)||f.intake?"done":(late?"fail":"wait"),t:"Intake",
      s:ierr?tr(["fout","error"]):w&&w.processed_at?dur(mins(w.at,w.processed_at)):tr(["wacht","waiting"])});
  } else {
    S.push({id:"bridge",st:f.intake?"done":"skip",t:tr(["Doorgifte","Hand-over"]),s:f.intake?hm(f.intake.at):((CHAN[f.source]&&CHAN[f.source].n)||f.source||"")});
  }
  S.push({id:"nexus",st:"done",t:"NEXUS",s:tr(["contact + aanvraag","contact + request"])});
  const r=route(f), mail=(f.mails||[])[0];
  if(r==="leadprocessor"){
    const lp=f.lp, lpErr=lp&&(lp.status==="error"||lp.error);
    S.push({id:"lp",st:lp?(lpErr?"fail":"done"):(late?"fail":"wait"),t:"LeadProcessor",s:lp?tr(["score ","score "])+String(lp.score||"?"):(late?tr(["geen run","no run"]):tr(["wacht","waiting"])),q:true});
    S.push({id:"rep",st:lp?(lp.leadcard==="sent"?"done":"skip"):"skip",t:tr(["Leadcard","Lead card"]),s:lp&&lp.rep?"→ "+repName(lp.rep):"—"});
    const isGuide=String(f.kind||f.type||"").toLowerCase().match(/guide|purchaseinfo/), isVal=String(f.kind||f.type||"").toLowerCase()==="valuation";
    if(isGuide||isVal){const fo=f.follow;
      S.push({id:isGuide?"gids":"seller",st:fo?(fo.status==="error"?"fail":"done"):(lp&&late?"fail":"wait"),t:isGuide?tr(["Aankoopgids","Buying guide"]):"SellerGuide",
        s:fo?(fo.attachment?tr(["met PDF","with PDF"]):tr(["verstuurd","sent"])):tr(["wacht","waiting"])});}
    /* portalen (Idealista) leveren geen e-mailadres: geen automatische klantmail, de rep belt of whatsappt (Rick, 22-10-2026) */
    if(o==="other"&&!mail)S.push({id:"call",st:lp?"skip":"wait",t:tr(["Bellen / WhatsApp","Call / WhatsApp"]),s:tr(["geen e-mail","no email"])});
    else S.push({id:"mail",st:mailSt(mail)||(lp&&late?"skip":"wait"),t:tr(["Mail klant","Client email"]),s:mail?mailSub(mail):(lp&&late?tr(["niet gevonden","not found"]):tr(["wacht","waiting"])),eye:mailEye(mail)});
    if(q==="hot")S.push({id:"hot",st:lp?"done":"wait",t:tr(["Agenda","Calendar"]),s:tr(["+ cc Rick","+ cc Rick"])});
  } else if(r==="newsletter"){
    const fo=f.follow;S.push({id:"nl",st:fo?(fo.status==="error"?"fail":"done"):(late?"fail":"wait"),t:"NewsletterConfirm",s:fo?(fo.lang||"").toUpperCase():tr(["wacht","waiting"])});
    S.push({id:"mail",st:mailSt(mail)||(fo?"skip":"wait"),t:tr(["Bevestiging","Confirmation"]),s:mail?mailSub(mail):"—",eye:mailEye(mail)});
  } else if(r==="favorites"){
    const fo=f.follow;S.push({id:"fav",st:fo?(fo.status==="error"?"fail":"done"):(late?"fail":"wait"),t:"FavoritesMail",s:fo?(fo.to?tr(["verstuurd","sent"]):""):tr(["wacht","waiting"])});
    S.push({id:"mail",st:mailSt(mail)||(fo?"skip":"wait"),t:tr(["Mail klant","Client email"]),s:mail?mailSub(mail):"—",eye:mailEye(mail)});
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
    facts:[[tr(["Aangevraagd","Requested"]),docsTxt(f)],[tr(["Formulier","Form"]),f.form_id||f.type],[tr(["Pagina","Page"]),f.page_url||(f.web&&f.web.page_url)],[tr(["Woning","Property"]),f.ref],[tr(["Taal","Language"]),f.lang],
      [tr(["Kwalificatie","Qualification"]),tr(QL[qual(f)])+(f.lp&&f.lp.score?tr([" (door AI gescoord)"," (scored by AI)"]):tr([" (volgens scoretabel)"," (by score table)"]))],
      [tr(["Kostenvragen","Cost questions"]),f.docs&&f.docs.includes("costs")?ansTxt(f):null],
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
  /* Doorgifte per kanaal (fix 24-10-2026): de tekst noemde altijd Idealista, ook bij een thinkSPAIN-lead */
  bridge:f=>{const c=CHAN[f.source], nm=c?c.n:(f.source||tr(["onbekend kanaal","unknown channel"]));
    return {h:["Doorgifte","Hand-over"],p:[c?
      ["Deze aanvraag kwam binnen via "+nm+", niet via het websiteformulier. "+c.wf+" las de portaalmail uit en WpLeadBridge-v2 zette het contact en de aanvraag in NEXUS.",
       "This request came in through "+nm+", not through the website form. "+c.wf+" read the portal email and WpLeadBridge-v2 put the contact and request into NEXUS."]:
      ["Deze aanvraag kwam binnen via "+nm+", niet via het websiteformulier, en is door JARVIS in NEXUS gezet.",
       "This request came in through "+nm+", not through the website form, and was put into NEXUS by JARVIS."]],
    facts:[[tr(["Bron","Source"]),nm],[tr(["Tijd","Time"]),f.intake&&dmyt(f.intake.at)]]}},
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
    facts:[[tr(["Aangevraagd","Requested"]),docsTxt(f)],[tr(["Verstuurd","Sent"]),docsSent(f)]].concat((f.mails||[]).flatMap(m=>[[tr(["Mail","Email"])+" "+hm(m.at),m.subject||""],
      [tr(["Status","Status"]),evTxt(m.events)],[tr(["Geopend","Opened"]),m.opened_at?dmyt(m.opened_at):null],[tr(["Geklikt","Clicked"]),m.clicked_at?dmyt(m.clicked_at):null]]))}),
  call:f=>({h:["Bellen of WhatsApp","Call or WhatsApp"],p:[["Deze lead kwam via een portaal zonder e-mailadres van de klant. JARVIS stuurt dus geen mail; de leadcard vraagt de rep om te bellen of te whatsappen. Reageert de klant via het portaal, dan wordt daar geantwoord.",
    "This lead came through a portal without the client's email address. JARVIS therefore sends no email; the lead card asks the rep to call or WhatsApp. If the client replies through the portal, the answer goes there."]],facts:[[tr(["Bron","Source"]),f.source],[tr(["Rep","Rep"]),f.lp&&repName(f.lp.rep)]]}),
  hot:f=>({h:["Hot: agenda en cc Rick","Hot: calendar and cc Rick"],p:[["Bij een Hot lead staat Rick in cc op de leadcard en komt er een afspraak in de agenda van de rep: bij terugbellen 2 uur na binnenkomst, anders 10:00 op de eerstvolgende werkdag.",
    "For a Hot lead Rick is cc'd on the lead card and the rep gets a calendar event: for a call-back 2 hours after arrival, otherwise 10:00 on the next working day."]],facts:[[tr(["Rep","Rep"]),f.lp&&repName(f.lp.rep)]]}),
  end:f=>({h:["Afgerond","Done"],p:[["Het formulier is als verwerkt gemarkeerd en elke run staat in jarvis_runs. Blijft een formulier 30 minuten liggen, dan meldt JARVIS dat direct.",
    "The form is marked as processed and every run is in jarvis_runs. If a form sits for 30 minutes, JARVIS reports it right away."]],facts:[[tr(["Verwerkt","Processed"]),f.processed_at?dmyt(f.processed_at):"—"]]})
};

/* ---------- render ---------- */
const ICON={done:"✓",wait:"…",fail:"!",skip:"–"};
/* verzendingen per soort mailing (Nieuwsbrief, Prijsverlaging, Woningmatches ...), nieuwste soort eerst */
function sendGroups(f){const G={};(f._sends||[]).forEach(m=>{const k=m.title||"mailing";(G[k]=G[k]||{t:k,items:[],o:0,c:0,last:null}).items.push(m);
    G[k].o+=Number(m.opens||0)>0?1:0;G[k].c+=Number(m.clicks||0)>0?1:0;if(!G[k].last||new Date(m.ts)>new Date(G[k].last))G[k].last=m.ts});
  return Object.values(G).sort((a,b)=>new Date(b.last)-new Date(a.last))}
const dm=ts=>{if(!ts)return"";const d=new Date(ts);return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")};
/* losse aanvraag verwijderen vanaf de flowkaart, alleen beheerder; alleen echte aanvragen (geen losse mail of opt-in) (Rick, 26-10-2026) */
const canDel=f=>!!(X&&X.canDel&&X.canDel()&&X.delReq&&f&&f.id&&!f._synthetic&&!f._mail&&!String(f.id).startsWith("_"));
const bindDel=root=>root.querySelectorAll(".fl-del").forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();X.delReq(b.dataset.del)});
function flowHtml(f,i,lst){
  const q=qual(f), S=steps(f), o=f._mail?"mail":f._synthetic?"optin":origin(f), G=sendGroups(f);
  const PORT={idealista:"Idealista",thinkspain:"thinkSPAIN","agent-portal":"Makelaarsportaal (Sola)","appointment-agent":"viewing@ (e-mail)"};
  const ORIG={old:["Oude site","Old site"],web:["Website","Website"],optin:["Oude CPR","Old CPR"],mail:["Automatische mail","Automatic email"],other:[PORT[f.source]||f.source||"Overig",PORT[f.source]||f.source||"Other"]};
  const title=f._mail?(f.subject||tr(["Mail","Email"])):f._synthetic?tr(["Opt-in voor mailings","Mailing opt-in"]):fTitle(f);
  const on=!lst&&!!RID&&f.id===RID, pc=o==="other"&&SRCC[String(f.source||"").toLowerCase()]?srcColor(f.source):"";
  return `<div class="fl-card q-${q}${on?" on":""}" data-fi="${i}"${lst?` data-rid="${esc(f.id)}"`:""}${lst&&f.contact_id?` data-fc="${esc(f.contact_id)}"`:""}>
    ${lst?`<div class="fl-who"><b>${esc(f.contact_name||tr(["Onbekend contact","Unknown contact"]))}</b>${f.rep?`<span class="fl-rep">${esc(f.rep)}</span>`:""}</div>`:""}
    ${on?`<div class="fl-here">${esc(tr(["Aangeklikte aanvraag","Selected request"]))}</div>`:""}
    <div class="fl-hd"><span class="fl-q">${esc(tr(QL[q]))}</span><b class="fl-t">${esc(title)}</b>${f.ref?`<span class="fl-ref" data-p="${esc(f.ref)}">${esc(f.ref)}</span>`:""}
      <span class="fl-o${pc?" src":""}"${pc?` style="--sc:${pc}"`:""}>${esc(tr(ORIG[o]))}</span><span class="fl-ts" title="${esc(dmyt(f.ts))}">${esc(dmyt(f.ts))}</span>${canDel(f)?`<button type="button" class="act-del fl-del" data-del="${esc(f.id)}" title="${esc(tr(["Aanvraag verwijderen","Delete request"]))}" aria-label="${esc(tr(["Aanvraag verwijderen","Delete request"]))}"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/></svg></button>`:""}</div>
    ${f.message?`<div class="fl-msg" title="${esc(f.message)}">${esc(f.message)}</div>`:""}
    <div class="fl-track">${S.map((s,j)=>`<button type="button" class="fl-n ${s.st}" data-s="${j}" data-id="${s.id}"><i aria-hidden="true">${ICON[s.st]}</i><b>${esc(s.t)}${s.eye?`<span class="fl-eye" style="display:inline-flex;vertical-align:-1px;margin-left:4px;color:${s.eye.click?"#38bdf8":"#22c55e"}" title="${esc(s.eye.title)}" aria-label="${esc(s.eye.title)}"><svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M1.5 12S5.5 4.5 12 4.5 22.5 12 22.5 12 18.5 19.5 12 19.5 1.5 12 1.5 12Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg></span>`:""}</b><small>${esc(s.s||"")}</small></button>`).join("")}${G.map((g,gi)=>`<button type="button" class="fl-n done send" data-g="${gi}"><i aria-hidden="true">✉</i><b>${esc(g.t)} ${g.items.length}×</b><small>${esc(tr([`${g.o} geopend · ${g.c} geklikt · ${dm(g.last)}`,`${g.o} opened · ${g.c} clicked · ${dm(g.last)}`]))}</small></button>`).join("")}</div></div>`;
}
function render(){
  if(!ROOT)return;
  if(!D){ROOT.innerHTML=`<div class="fl-wrap"><div class="sm muted">${esc(tr(["Formulierflows laden…","Loading form flows…"]))}</div></div>`;return}
  const fl=D.flows||[];
  if(!fl.length){ROOT.innerHTML="";return}
  ROOT.innerHTML=`<div class="fl-wrap">
    <div class="fl-top"><h4>${esc(tr(["Formulieren","Forms"]))} <span class="cnt">${D.total||fl.filter(f=>!f._synthetic).length}</span>${fl.some(f=>f._mail)?` · ${esc(tr(["Mails","Emails"]))} <span class="cnt">${fl.filter(f=>f._mail).length}</span>`:""}</h4>
      <div class="fl-leg">${["hot","warm","cold","none"].map(q=>`<span class="fl-lg q-${q}">${esc(tr(QL[q]))}</span>`).join("")}</div></div>
    <div class="fl-list">${(()=>{const ix=fl.map((f,i)=>i),r=RID?fl.findIndex(f=>f.id===RID):-1;if(r>0){ix.splice(r,1);ix.unshift(r)}return ix.map(i=>flowHtml(fl[i],i)).join("")})()}
      ${D.total>fl.filter(f=>!f._synthetic).length?`<div class="sm muted" style="padding:2px 4px">${esc(tr([`en ${D.total-fl.filter(f=>!f._synthetic).length} oudere aanvragen, zie de tijdlijn hieronder`,`and ${D.total-fl.filter(f=>!f._synthetic).length} older requests, see the timeline below`]))}</div>`:""}</div></div>`;
  ROOT.querySelectorAll(".fl-n").forEach(b=>b.onclick=e=>{e.stopPropagation();const card=b.closest(".fl-card"),f=fl[+card.dataset.fi];
    if(b.dataset.g!=null)popSends(f,sendGroups(f)[+b.dataset.g]);else popup(f,b.dataset.id,b.className.split(" ")[1])});
  bindDel(ROOT);
  const on=ROOT.querySelector(".fl-card.on");if(on&&on.scrollIntoView)try{on.scrollIntoView({block:"nearest"})}catch(e){}
}
function popup(f,id,st){
  const I=(INFO[id]||INFO.nexus)(f);
  const facts=(I.facts||[]).filter(x=>x[1]!=null&&x[1]!=="");
  const STL={done:["Gedaan","Done"],wait:["Loopt nog","In progress"],fail:["Controleren","Check"],skip:["Niet van toepassing","Not applicable"]};
  let ov=document.getElementById("flPop");if(ov)ov.remove();
  ov=document.createElement("div");ov.id="flPop";ov.className="fl-pop";
  ov.innerHTML=`<div class="fl-box q-${qual(f)}" role="dialog" aria-modal="true" aria-labelledby="flPopH">
    <div class="fl-bh"><div><small>${esc(f._mail?(f.subject||""):fTitle(f))} · ${esc(dmyt(f.ts))}</small><h3 id="flPopH">${esc(tr(I.h))}</h3></div><button type="button" class="fl-x" aria-label="${esc(tr(["Sluiten","Close"]))}">×</button></div>
    <div class="fl-bb"><span class="fl-st ${st}">${ICON[st]} ${esc(tr(STL[st]||STL.done))}</span>
      ${(I.p||[]).map(p=>`<p>${esc(tr(p))}</p>`).join("")}
      ${facts.length?`<dl>${facts.map(x=>`<dt>${esc(x[0])}</dt><dd>${esc(x[1])}</dd>`).join("")}</dl>`:""}
      ${id==="mail"&&(f._mailUuids||[]).length&&X.openMail?`<div class="fl-acts">${f._mailUuids.map((u,i)=>`<button type="button" class="btn fl-mv" data-u="${esc(u)}">✉ ${esc(tr(["Mail bekijken","View email"]))}${f._mailUuids.length>1?" "+(i+1):""}</button>`).join("")}</div>`:""}</div></div>`;
  document.body.appendChild(ov);
  const shut=()=>{ov.remove();document.removeEventListener("keydown",key)};
  const key=e=>{if(e.key==="Escape")shut()};
  ov.onclick=e=>{const mv=e.target.closest(".fl-mv");if(mv){shut();X.openMail({uuid:mv.dataset.u});return}if(e.target===ov||e.target.closest(".fl-x"))shut()};
  document.addEventListener("keydown",key);ov.querySelector(".fl-x").focus();
}
/* popup met alle verzendingen van één soort, elk te openen in de mailpreview */
function popSends(f,g){if(!g)return;
  let ov=document.getElementById("flPop");if(ov)ov.remove();
  ov=document.createElement("div");ov.id="flPop";ov.className="fl-pop";
  const its=g.items.slice().sort((a,b)=>new Date(b.ts)-new Date(a.ts));
  ov.innerHTML=`<div class="fl-box q-${qual(f)}" role="dialog" aria-modal="true" aria-labelledby="flPopH">
    <div class="fl-bh"><div><small>${esc(tr(["Verzending uit","Sent because of"]))} ${esc(f._synthetic?tr(["opt-in bij import","opt-in at import"]):(X.rq(f.key)||f.key))} · ${esc(dmyt(f.ts))}</small><h3 id="flPopH">${esc(g.t)} · ${its.length}×</h3></div><button type="button" class="fl-x" aria-label="${esc(tr(["Sluiten","Close"]))}">×</button></div>
    <div class="fl-bb"><p>${esc(tr(["Deze mailings gingen naar het contact omdat het zich via deze aanvraag aanmeldde voor dit soort berichten. Klik op een mailing om hem te bekijken.",
      "These mailings went to the contact because it signed up for this kind of message through this request. Click a mailing to view it."]))}</p>
      <div class="fl-sl">${its.map(m=>`<button type="button" class="fl-si"${m.campaign_id?` data-camp="${esc(m.campaign_id)}" data-email="${esc(m.email||"")}"`:" disabled"}>
        <span class="fl-sd">${esc(dmyt(m.ts))}</span><span class="fl-ss">${esc(m.subject||String(m.text||"").split(" · ")[0])}</span>
        <span class="fl-sm">${Number(m.opens||0)?esc(tr(["geopend","opened"])):""}${Number(m.clicks||0)?" · "+esc(tr(["geklikt","clicked"])):""}</span></button>`).join("")}</div></div></div>`;
  document.body.appendChild(ov);
  const shut=()=>{ov.remove();document.removeEventListener("keydown",key)};const key=e=>{if(e.key==="Escape")shut()};
  ov.onclick=e=>{const it=e.target.closest(".fl-si[data-camp]");if(it&&X.openMail){shut();X.openMail({campaign_id:Number(it.dataset.camp),email:it.dataset.email||undefined});return}
    if(e.target===ov||e.target.closest(".fl-x"))shut()};
  document.addEventListener("keydown",key);ov.querySelector(".fl-x").focus();
}
function close(){CID=null;RID=null;D=null;const p=document.getElementById("flPop");if(p)p.remove()}
async function open(root,contactId,requestId,ctx){
  X=ctx;ROOT=root;
  if(CID!==contactId){CID=contactId;D=null}
  RID=requestId||null;if(D&&X.onData)X.onData(D);render();
  const my=++SEQ;
  try{const d=await X.rpc("nexus_contact_flows",{p_contact:contactId,p_limit:50});if(my!==SEQ)return;D=d||{flows:[]};if(X.onData)X.onData(D);render()}
  catch(e){if(my!==SEQ)return;ROOT.innerHTML=`<div class="fl-wrap"><div class="empty">${esc(e.message||e)}</div></div>`;if(X.onError)X.onError(e)}
}
/* Tijdlijnregels die bij een formulierflow horen (de aanvraag, de lead en de mails aan de klant) gaan op in die flow;
   de rest (mailings, notities, bezichtigingen) blijft als gewone contactmomenten staan. Mail-uuid's gaan mee naar de flow (Mail bekijken). */
/* Verzendingen (Rick, 22-10-2026): elke mailing komt voort uit een aanvraag. Een mailing hoort bij de laatste opt-in-aanvraag
   (nieuwsbrief, zoekprofiel, e-mailalert) van vóór de verzending, anders bij de laatste aanvraag ervoor.
   Een mailing gaat NOOIT naar een aanvraag van ná de verzending (Rick, 24-10-2026: oude mailings verschenen in de koopgidsflow).
   Zonder aanvraag vóór de verzending gaat hij naar één flow "Opt-in voor mailings" (standaard-opt-in uit de oude import). */
const OPTIN=/^(newsletter|searchdetails|search-details|emailalert|bargain|secretdeals|web-newsletter.*)$/;
const isOptin=f=>[f.kind,f.type,f.key].some(k=>OPTIN.test(String(k||"").toLowerCase()));
function fold(list,data){
  if(data&&data.flows)data.flows=data.flows.filter(f=>!f._synthetic);
  const fl=(data&&data.flows)||[], ids=new Set(fl.map(f=>String(f.id))), T=x=>new Date(x).getTime();
  /* interne mails (leadcard 'New Lead', JARVIS-meldingen) horen niet bij 'Mail klant'; ze kwamen erbij als de klant zelf
     een teamlid is (test op rick@) en in hetzelfde tijdvenster viel (Rick, 25-10-2026) */
  fl.forEach(f=>{f._mailUuids=[];f._sends=[];if(Array.isArray(f.mails))f.mails=f.mails.filter(m=>!INTERNAL_SUBJ.test(String(m.subject||"")))});
  const byTs=fl.slice().sort((a,b)=>T(a.ts)-T(b.ts));
  const origin=m=>{const t=T(m.ts),before=byTs.filter(f=>T(f.ts)<=t);
    return before.filter(isOptin).pop()||before.pop()||null};
  /* Rick 24-10-2026: geen losse flow "Opt-in voor mailings" meer. Mailings zonder aanvraag ervoor verschijnen niet onder Aanvragen;
     wat aan of uit staat staat in het tabblad Opt-ins / opt-outs. */
  (list||[]).forEach(e=>{if(e.kind!=="mailing")return;const f=origin(e);if(f)f._sends.push(e)});
  const M={};
  /* interne mails aan het team (JARVIS-meldingen, leadcard 'New Lead') zijn geen contactmoment met de klant: ook als losse mail
     niet tonen, met alle Brevo-events van dezelfde uuid. Ze verschenen bij contacten die zelf teamlid zijn (rick@) (Rick, 25-10-2026). */
  const intU=new Set((list||[]).filter(e=>e.kind==="mail"&&e.uuid&&INTERNAL_SUBJ.test(String(e.text||""))).map(e=>e.uuid));
  const rest=(list||[]).filter(e=>{
    if(e.kind==="mailing")return false;
    if(e.kind==="mail"&&(INTERNAL_SUBJ.test(String(e.text||""))||(e.uuid&&intU.has(e.uuid))))return false;
    /* opens en clicks op een mailing (Brevo-event met het mailingtype als tekst) tellen al mee in die mailing */
    if(e.kind==="mail"&&/^[a-z_]+$/.test(String(e.text||"")))return false;
    if(e.kind==="request")return !ids.has(String(e.id));
    if(e.kind==="lead")return !fl.some(f=>f.source!=="cpr_import"&&Math.abs(T(e.ts)-T(f.ts))<=10*60000);
    /* Brevo-events (open, klik) op de klantmail van een flow gaan op in die flow, ook dagen later: herkend aan de mail-uuid (23-10-2026) */
    if(e.kind==="mail"&&e.uuid){const f=fl.find(f=>(f.mails||[]).some(m=>m.uuid&&m.uuid===e.uuid));
      if(f){if(!f._mailUuids.includes(e.uuid))f._mailUuids.push(e.uuid);return false}}
    if(e.kind==="mail"){const f=fl.find(f=>{const d=T(e.ts)-T(f.ts);return d>=-60000&&d<=3*3600000&&(f.mails||[]).some(m=>m.subject===e.text)});
      if(!f){if(!e.uuid)return true;(M[e.uuid]=M[e.uuid]||[]).push(e);return false}if(e.uuid&&!f._mailUuids.includes(e.uuid))f._mailUuids.push(e.uuid);return false}
    return true});
  /* Losse transactionele mails (geen formulier, bv. "Your property is live!" of de seller-update): alle Brevo-events
     van dezelfde mail (uuid) worden één flow met één node "Mail klant", met oogje bij geopend/geklikt (Rick, 23-10-2026). */
  Object.keys(M).forEach(u=>{const ev=M[u].slice().sort((a,b)=>T(a.ts)-T(b.ts)),nm=e=>String(e.title||"").toLowerCase();
    const first=ev.find(e=>/sent|request|deliver/.test(nm(e)))||ev[0], fo=ev.find(e=>/open/.test(nm(e))), fc=ev.find(e=>/click/.test(nm(e)));
    const m={uuid:u,at:first.ts,subject:first.text||"",events:[...new Set(ev.map(nm).filter(Boolean))],opened_at:fo?fo.ts:null,clicked_at:fc?fc.ts:null};
    fl.push({id:"_mail_"+u,_synthetic:true,_mail:true,ts:first.ts,key:"mail",subject:m.subject,ref:ev.map(e=>e.ref).find(Boolean)||null,mails:[m],_mailUuids:[u],_sends:[]})});
  if(Object.keys(M).length)fl.sort((a,b)=>T(b.ts)-T(a.ts));
  return rest;
}
/* Aanvragen/Portalen (Rick, 25-10-2026): alle aanvragen van alle contacten als flowkaarten onder elkaar, nieuw naar oud.
   flows komen uit nexus_request_flows (zelfde opbouw als nexus_contact_flows via nexus_flow_obj, plus contact_id/contact_name/rep). */
function list(root,flows,ctx,opt){X=ctx;const fl=flows||[];opt=opt||{};
  /* interne mails (New Lead, JARVIS) nooit bij Mail klant, ook niet in de lijstweergave (Rick, 25-10-2026) */
  fl.forEach(f=>{if(Array.isArray(f.mails))f.mails=f.mails.filter(m=>!INTERNAL_SUBJ.test(String(m.subject||"")))});
  if(!fl.length){root.innerHTML=`<div class="empty">${esc(opt.empty||tr(["Geen aanvragen","No requests"]))}</div>`;return}
  root.innerHTML=`<div class="fl-wrap fl-all">${opt.legend===false?"":`<div class="fl-top"><span></span><div class="fl-leg">${["hot","warm","cold","none"].map(q=>`<span class="fl-lg q-${q}">${esc(tr(QL[q]))}</span>`).join("")}</div></div>`}
    <div class="fl-list">${fl.map((f,i)=>flowHtml(f,i,true)).join("")}</div></div>`;
  root.querySelectorAll(".fl-n").forEach(b=>b.onclick=e=>{e.stopPropagation();const card=b.closest(".fl-card"),f=fl[+card.dataset.fi];
    if(b.dataset.g!=null)popSends(f,sendGroups(f)[+b.dataset.g]);else popup(f,b.dataset.id,b.className.split(" ")[1])});
  bindDel(root);
}
window.NEXUS_FLOWS={open,close,fold,list,rerender:render,current:()=>CID};
})();
