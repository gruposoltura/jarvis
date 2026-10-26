/* NEXUS - knop "Brochure" op de woningpagina (Rick 26-10-2026).
   Print de interne woningbrochure (een A4, variant 'window'). De agent die verantwoordelijk is voor de woningbrochure
   bouwt hem: JARVIS-Sales-LeadProcessor-v2 (n8n 280vYTcWJkBORRa8), webhook 'NEXUS Brochure Hook' (/webhook/nexus-brochure).
   Die controleert zelf de Supabase-sessie (Bearer) en haalt de data via rpc nexus_brochure_data (nexus_gate).
   Bron van de opmaak: soltura-web brochure-src/brochure.js -> buildBrochure(data, lang, A, { variant: 'window' }).
   Hier staat geen opmaak; NEXUS toont alleen de HTML die de agent teruggeeft en opent het printvenster. */
(function(){
const HOOK="https://gruposoltura.app.n8n.cloud/webhook/nexus-brochure";
const LANGS=[["nl","NL"],["en","EN"],["es","ES"],["sv","SV"]];
let CTX=null; /* {sb, lang} uit nexus-app.js (sb/LANG zitten in de IIFE van nexus-app) */
const ui=()=>(CTX&&CTX.lang&&CTX.lang()==="en")?"en":"nl";
const tx=(nl,en)=>ui()==="en"?en:nl;
const SCREEN_CSS='@media screen{html{background:#525659}body{margin:12mm auto}.page{box-shadow:0 4px 24px rgba(0,0,0,.45)}}';
const msg=(w,t)=>{try{w.document.body.textContent=t}catch(e){}};

/* Opent het venster direct in de klik (popup-blokker), vraagt de HTML op bij de agent en print na het laden van fonts en foto's. */
async function print(ref,lang,ctx){
  if(ctx)CTX=ctx;
  const w=window.open("","_blank");
  if(!w){alert(tx("Pop-up geblokkeerd: sta pop-ups toe voor dash.gruposoltura.com","Pop-up blocked: allow pop-ups for dash.gruposoltura.com"));return}
  w.document.write('<!DOCTYPE html><title>Brochure '+String(ref).replace(/[<&]/g,"")+'</title><body style="font:15px system-ui;padding:40px;color:#334">'+tx("Brochure wordt gemaakt…","Building brochure…")+'</body>');
  let html;
  try{
    if(!CTX||!CTX.sb)throw new Error("NEXUS-context ontbreekt");
    const {data:{session}}=await CTX.sb.auth.getSession();
    if(!session)throw new Error(tx("Niet ingelogd","Not signed in"));
    const r=await fetch(HOOK,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+session.access_token},body:JSON.stringify({ref,lang,variant:"window"})});
    const body=await r.text();
    if(!r.ok){let m=body;try{m=JSON.parse(body).error||body}catch(e){}throw new Error(m||("HTTP "+r.status))}
    html=body;
  }catch(e){msg(w,tx("Fout: ","Error: ")+(e.message||e));return}
  if(!/^\s*<!DOCTYPE html>/i.test(html)){msg(w,tx("Fout: onverwacht antwoord van de agent","Error: unexpected response"));return}
  w.document.open();w.document.write(html.replace("</style>",SCREEN_CSS+"</style>"));w.document.close();
  const go=async()=>{
    try{await Promise.race([w.document.fonts.ready,new Promise(r=>setTimeout(r,4000))])}catch(e){}
    const imgs=[...w.document.images].filter(i=>!i.complete).map(i=>new Promise(r=>{i.onload=i.onerror=r}));
    /* achtergrondfoto's (style background-image) vooraf laden */
    const bgs=[...w.document.querySelectorAll('[style*="background-image"]')].map(el=>{const m=/url\(["']?([^"')]+)/.exec(el.getAttribute("style")||"");return m?new Promise(r=>{const im=new w.Image();im.onload=im.onerror=r;im.src=m[1]}):null}).filter(Boolean);
    await Promise.race([Promise.all(imgs.concat(bgs)),new Promise(r=>setTimeout(r,8000))]);
    w.focus();w.print();
  };
  if(w.document.readyState==="complete")go();else w.addEventListener("load",go);
}

/* Taalkeuze onder de knop; standaard de taal van NEXUS */
function menu(anchor,ref,ctx){
  if(ctx)CTX=ctx;
  document.querySelectorAll(".brx-pop").forEach(x=>x.remove());
  const pop=document.createElement("div");pop.className="brx-pop";
  pop.innerHTML='<div class="brx-h">'+tx("Brochure printen","Print brochure")+'</div><div class="brx-l">'+LANGS.map(([c,l])=>'<button data-l="'+c+'"'+(c===ui()?' class="on"':'')+'>'+l+'</button>').join("")+'</div>';
  document.body.appendChild(pop);
  const r=anchor.getBoundingClientRect();
  pop.style.top=(r.bottom+6+window.scrollY)+"px";pop.style.left=Math.max(8,Math.min(r.left,window.innerWidth-pop.offsetWidth-8))+"px";
  pop.querySelectorAll("button").forEach(b=>b.onclick=e=>{e.stopPropagation();pop.remove();print(ref,b.dataset.l)});
  setTimeout(()=>{const off=e=>{if(!pop.contains(e.target)){pop.remove();document.removeEventListener("click",off,true);document.removeEventListener("keydown",key,true)}};const key=e=>{if(e.key==="Escape")off({target:document.body})};document.addEventListener("click",off,true);document.addEventListener("keydown",key,true)},0);
}
window.NEXUS_BROCHURE={print,menu};
})();
