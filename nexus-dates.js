/* NEXUS · datums altijd als DD/MM/YYYY (besluit Rick 20-10-2026).
   1) Weergave: NEXUS_DMY(ts) -> "20/10/2026", NEXUS_DMYT(ts) -> "20/10/2026 16:51".
   2) Invoer: elk <input type="date"> krijgt een zichtbaar tekstveld in DD/MM/YYYY ervoor.
      Het echte datumveld blijft (onzichtbaar) bestaan met zijn data-k en ISO-waarde (YYYY-MM-DD),
      dus opslaan, filters en de bestaande code veranderen niet. De browserinstelling (bv. Engels = MM/DD) doet er niet meer toe.
      Klik of spatie/Alt+pijl omlaag opent de kalender; typen mag als 20/10/2026, 20-10-26 of 20102026; leegmaken wist de datum. */
(function(){
"use strict";
const pad=n=>String(n).padStart(2,"0");
function toDate(ts){if(ts==null||ts==="")return null;
  if(typeof ts==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(ts))return new Date(ts+"T12:00:00");   // kale datum: geen tijdzoneverschuiving
  const d=ts instanceof Date?ts:new Date(ts);return isNaN(d)?null:d}
function DMY(ts){const d=toDate(ts);return d?`${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`:""}
function DMYT(ts){const d=toDate(ts);return d?`${DMY(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`:""}
const isoToDmy=v=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(v||"");return m?`${m[3]}/${m[2]}/${m[1]}`:""};
function dmyToIso(s){s=String(s||"").trim();if(!s)return "";
  let d,m,y;const p=s.split(/[^\d]+/).filter(Boolean);
  if(p.length===3){[d,m,y]=p}else if(/^\d{8}$/.test(s)){d=s.slice(0,2);m=s.slice(2,4);y=s.slice(4)}else if(/^\d{6}$/.test(s)){d=s.slice(0,2);m=s.slice(2,4);y=s.slice(4)}else return null;
  d=+d;m=+m;y=+y;if(y<100)y+=2000;
  const t=new Date(y,m-1,d);if(t.getFullYear()!==y||t.getMonth()!==m-1||t.getDate()!==d||y<1900||y>2200)return null;
  return `${y}-${pad(m)}-${pad(d)}`}
window.NEXUS_DMY=DMY;window.NEXUS_DMYT=DMYT;

const VAL=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value");
function enhance(el){
  if(el.__dmy||el.type!=="date")return;el.__dmy=1;
  const txt=document.createElement("input");
  txt.type="text";txt.className="dmy-txt "+(el.className||"");txt.inputMode="numeric";txt.autocomplete="off";
  txt.placeholder="DD/MM/YYYY";txt.maxLength=10;txt.disabled=el.disabled;txt.readOnly=el.readOnly;
  txt.value=isoToDmy(VAL.get.call(el));
  const wrap=document.createElement("span");wrap.className="dmy-wrap";
  el.parentNode.insertBefore(wrap,el);wrap.appendChild(txt);wrap.appendChild(el);
  el.classList.add("dmy-native");el.tabIndex=-1;el.setAttribute("aria-hidden","true");
  const sync=()=>{txt.value=isoToDmy(VAL.get.call(el));txt.classList.remove("dmy-bad")};
  // wie het echte veld in code zet (prefill, akte-inlezen), ziet het tekstveld meeveranderen
  Object.defineProperty(el,"value",{configurable:true,get(){return VAL.get.call(this)},set(v){VAL.set.call(this,v);sync()}});
  const fire=()=>{el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}))};
  const commit=()=>{const iso=dmyToIso(txt.value);
    if(iso===null){txt.classList.add("dmy-bad");txt.title="DD/MM/YYYY";return}
    txt.classList.remove("dmy-bad");txt.title="";
    if(iso!==VAL.get.call(el)){VAL.set.call(el,iso);fire()}
    txt.value=isoToDmy(iso)};
  const open=()=>{if(el.disabled||el.readOnly||typeof el.showPicker!=="function")return;try{el.showPicker()}catch(_){}};
  txt.addEventListener("input",e=>{e.stopPropagation();                     // eigen veld: geen data-k, niets voor de formulierlogica
    let v=txt.value.replace(/[^\d\/\-.]/g,"");
    if(/^\d{2}$/.test(v)||/^\d{2}\/\d{2}$/.test(v))if(!(e.inputType||"").startsWith("delete"))v+="/";
    if(v!==txt.value)txt.value=v});
  txt.addEventListener("change",e=>{e.stopPropagation();commit()});
  txt.addEventListener("blur",commit);
  txt.addEventListener("keydown",e=>{if(e.key==="Enter"){commit()}else if(e.key===" "||(e.key==="ArrowDown"&&e.altKey)){e.preventDefault();open()}});
  txt.addEventListener("click",open);
  el.addEventListener("input",()=>{if(document.activeElement!==txt)sync()});
  el.addEventListener("change",()=>{if(document.activeElement!==txt)sync()});
}
function scan(root){(root.querySelectorAll?root:document).querySelectorAll('input[type="date"]').forEach(enhance);
  if(root.matches&&root.matches('input[type="date"]'))enhance(root)}
const css=document.createElement("style");
css.textContent=`.dmy-wrap{position:relative;display:block;width:100%}
.ad-f>span.dmy-wrap{font-size:inherit;color:inherit}
.dmy-wrap>input.dmy-native{position:absolute;left:0;bottom:0;width:100%;height:100%;opacity:0;pointer-events:none;padding:0;border:0}
input.dmy-txt{cursor:pointer;font-variant-numeric:tabular-nums}
input.dmy-txt.dmy-bad{border-color:#f87171!important;box-shadow:0 0 0 3px rgba(248,113,113,.2)!important}`;
document.head.appendChild(css);
const start=()=>{scan(document);new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1)scan(n)}).observe(document.body,{childList:true,subtree:true})};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
