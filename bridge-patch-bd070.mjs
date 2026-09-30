// BD-070: vaste rolstructuur in MAIL / META / SOCIAL op de Bridge.
// Patcht organisation.html en constellation.html (BD-005: engine-fix in beide).
// Elk anker moet precies 1x voorkomen, anders wordt NIETS geschreven.
import fs from 'node:fs';

const FILES = ['organisation.html', 'constellation.html'];

const PIN_OLD = "const pinRank=e=> (e.loose && e.loose.cluster==='social-playbook') ? 0 : 1;";
const PIN_NEW =
  "const ROLE_RANK={scouts:0,bible:1,builders:2,publishers:3,reviewers:4};\n" +
  "    const roleOf=a=>{ const c=String((a&&(a.grp||a.cluster))||\"\"); const m=c.match(/-(scouts|bible|builders|publishers|reviewers)$/); return m?ROLE_RANK[m[1]]:(c==='social-playbook'?-1:9); };\n" +
  "    const pinRank=e=> e.loose ? roleOf(e.loose) : Math.min(...e.members.map(roleOf));   // BD-070: vaste rolvolgorde Scouts -> Bible -> Builders -> Publishers -> Reviewers";

const META_OLD = 'const meta=GRP[g]||{label:g,flow:""};';
const META_NEW = 'const meta=GRP[g]||ROLE_GRP(g)||{label:g,flow:""};';

const BADGE_OLD = '<span class="pl-badge">${mem.length}-STAP</span>';
const BADGE_NEW = '<span class="pl-badge">${meta.role?(mem.length+(mem.length===1?" AGENT":" AGENTS")):(mem.length+"-STAP")}</span>';

const GRP_END = String.raw`flow:"CURATIE \u2192 MAILING"}` + '\n};\n';
const GRP_ADD = GRP_END +
  "/* BD-070: rolblokken (grp = <dept>-scouts|bible|builders|publishers|reviewers) */\n" +
  String.raw`const ROLE_META={scouts:{label:"SCOUTS & HARVESTERS",flow:"ONDERZOEKEN \u2192 VERZAMELEN \u2192 THE BIBLE"},bible:{label:"THE BIBLE",flow:"KENNIS \u2192 WEGEN & FILTEREN \u2192 BUILDERS"},builders:{label:"BUILDERS",flow:"BOUWEN \u2192 PUBLISHERS"},publishers:{label:"PUBLISHERS",flow:"PUBLICEREN \u2192 REVIEWERS"},reviewers:{label:"REVIEWERS",flow:"EVALUEREN \u2192 THE BIBLE"}};` + "\n" +
  'function ROLE_GRP(g){ const m=String(g||"").match(/-(scouts|bible|builders|publishers|reviewers)$/); return m?{...ROLE_META[m[1]],role:m[1]}:null; }\n';

function count(s, sub){ let n=0,i=0; while((i=s.indexOf(sub,i))!==-1){ n++; i+=sub.length; } return n; }
function swap(src, oldS, newS, name, file){
  const n = count(src, oldS);
  if(n !== 1) throw new Error(`${file}: anker ${name} komt ${n}x voor (verwacht 1)`);
  return src.replace(oldS, () => newS);
}

const out = {};
for(const f of FILES){
  let s = fs.readFileSync(f, 'utf8');
  if(s.includes('ROLE_GRP') || s.includes('ROLE_RANK')) throw new Error(`${f}: al gepatcht (ROLE_GRP/ROLE_RANK bestaat)`);
  s = swap(s, PIN_OLD, PIN_NEW, 'pinRank', f);
  s = swap(s, META_OLD, META_NEW, 'GRP-meta', f);
  s = swap(s, BADGE_OLD, BADGE_NEW, 'pl-badge', f);
  s = swap(s, GRP_END, GRP_ADD, 'GRP-einde', f);
  out[f] = s;
}
// agents.html: afdelingslabels voor MAIL/SOCIAL/META (klein bestand, zelfde commit)
{
  const f = 'agents.html';
  let s = fs.readFileSync(f, 'utf8');
  s = swap(s, 'advertising:"Advertising",infra:"Infra"};', 'advertising:"Meta",mail:"Mail",social:"Social",infra:"Infra"};', 'DEPT_LABELS', f);
  out[f] = s;
}
for(const f of Object.keys(out)){ fs.writeFileSync(f, out[f]); console.log(`${f}: gepatcht (${out[f].length} tekens)`); }
