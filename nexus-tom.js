/* NEXUS Overzicht - kaart "Tijd op de markt per woningtype" (Rick 26-10-2026), onder Rollen in NEXUS.
   Tijd op de markt = huidig aanbod (status available/under_offer), dagen van opname (listed_at) tot vandaag.
   Filter: Beide (standaard) / Eigen woningen / Partnerwoningen. Geen verkochte woningen.
   Data: rpc nexus_time_on_market() achter nexus_gate = bridge_src.bridge_time_on_market (een rij per woningtype).
   Kolom = gemiddelde, wit streepje = mediaan. Elke soort houdt dezelfde kleur. Schaal volgt soorten met n>=5;
   een hogere kolom wordt afgekapt met een zaagrand. */
(function(){
const TYPES = {
  villa:{ nl:'Villa', en:'Villa', c:'#3b82f6' },
  apartment:{ nl:'Appartement', en:'Apartment', c:'#14b8a6' },
  'semi-detached':{ nl:'Halfvrijstaand', en:'Semi-detached', c:'#eab308' },
  townhouse:{ nl:'Geschakelde woning', en:'Townhouse', c:'#f97316', sh:'Geschakeld' },
  bungalow:{ nl:'Bungalow', en:'Bungalow', c:'#ec4899' },
  quadrant:{ nl:'Quad', en:'Quad house', c:'#a855f7' },
  penthouse:{ nl:'Penthouse', en:'Penthouse', c:'#06b6d4' },
  duplex:{ nl:'Duplex', en:'Duplex', c:'#84cc16' },
  finca:{ nl:'Finca', en:'Finca', c:'#b45309' } };
const MODES = {
  all:{ n:'all_avail_n', avg:'all_avail_avg_days', med:'all_avail_median_days', nl:['Beide','eigen + partnerwoningen te koop'], en:['Both','own + partner listings for sale'] },
  own:{ n:'own_avail_n', avg:'own_avail_avg_days', med:'own_avail_median_days', nl:['Eigen woningen','eigen woningen te koop'], en:['Own listings','own listings for sale'] },
  partner:{ n:'partner_avail_n', avg:'partner_avail_avg_days', med:'partner_avail_median_days', nl:['Partnerwoningen','partnerwoningen te koop'], en:['Partner listings','partner listings for sale'] } };
let ROWS = null, mode = (()=>{ try{ const m = localStorage.getItem('nexus-tom-filter'); return MODES[m] ? m : 'all'; }catch(e){ return 'all'; } })();
let box = null, ctx = null, rsz = null;
const isEn = () => ctx && ctx.lang() === 'en';
const L = (nl, en) => isEn() ? en : nl;
const lab = k => TYPES[k][isEn() ? 'en' : 'nl'];
const nf = v => v == null ? '—' : ctx.num(v);
const days = v => v == null ? '—' : nf(v) + ' ' + L('d', 'd') + (v >= 60 ? ' (' + (v / 30.44).toLocaleString(isEn() ? 'en-GB' : 'nl-NL', { maximumFractionDigits:1, minimumFractionDigits:1 }) + ' ' + L('mnd', 'mo') + ')' : '');

function chart(rows, m, narrow){
  const w = narrow ? 420 : 640, h = narrow ? 310 : 280, padL = 40, padR = 6, padT = 24, padB = narrow ? 96 : 48;
  const iW = w - padL - padR, iH = h - padT - padB;
  const reliable = rows.some(r => (r[m.n] || 0) >= 5);
  let max = 1;
  rows.forEach(r => { if(reliable && (r[m.n] || 0) < 5) return; const v = r[m.avg] || 0; if(v > max) max = v; if(m.med && (r[m.med] || 0) > max) max = r[m.med]; });
  max *= 1.08;
  const mag = Math.pow(10, Math.floor(Math.log10(max))), q = max / mag;
  max = (q <= 1 ? 1 : q <= 2 ? 2 : q <= 2.5 ? 2.5 : q <= 5 ? 5 : 10) * mag;
  const Y = v => padT + iH - (v / max) * iH;
  const n = rows.length, slot = iW / n, bw = Math.min(46, slot * 0.64);
  let s = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" style="display:block;width:100%;height:auto">`;
  for(let g = 0; g <= 4; g++){
    const gv = max * g / 4, gy = Y(gv).toFixed(1);
    s += `<line x1="${padL}" y1="${gy}" x2="${w - padR}" y2="${gy}" style="stroke:var(--line)" stroke-width="1"/>`
      + `<text x="${padL - 6}" y="${(+gy + 4).toFixed(1)}" text-anchor="end" font-size="10.5" style="fill:var(--tx3)">${nf(Math.round(gv))}</text>`;
  }
  rows.forEach((r, i) => {
    const t = TYPES[r.category], cx = padL + i * slot + slot / 2, x = cx - bw / 2;
    const cnt = r[m.n] || 0, v = r[m.avg], few = cnt > 0 && cnt < 5;
    s += `<g class="tom-col" data-i="${i}">`;
    if(cnt > 0 && v != null){
      const cut = v > max, y = cut ? padT : Y(v), bh = Math.max(1, padT + iH - y);
      s += `<rect class="bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${t.c}"${few ? ` fill-opacity="0.4" stroke="${t.c}" stroke-dasharray="3 3"` : ''}/>`;
      if(cut){
        let zz = `M${x.toFixed(1)} ${padT + 9}`; const k = 6, sw = bw / k;
        for(let z = 1; z <= k; z++) zz += ` L${(x + z * sw).toFixed(1)} ${padT + (z % 2 ? 3 : 9)}`;
        s += `<path d="${zz} L${(x + bw).toFixed(1)} ${padT - 2} L${x.toFixed(1)} ${padT - 2} Z" style="fill:var(--card)"/>`;
      }
      if(m.med && r[m.med] != null && r[m.med] <= max){
        const my = Y(r[m.med]).toFixed(1);
        s += `<line x1="${(x + 4).toFixed(1)}" y1="${my}" x2="${(x + bw - 4).toFixed(1)}" y2="${my}" stroke="#fff" stroke-width="2" opacity="0.9"/>`;
      }
      const ty = Math.min(y, m.med && r[m.med] != null && r[m.med] <= max ? Y(r[m.med]) : y) - 6;
      s += `<text x="${cx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" font-size="11.5" font-weight="700" style="fill:var(--tx)">${nf(v)}</text>`;
    } else {
      s += `<text x="${cx.toFixed(1)}" y="${padT + iH - 5}" text-anchor="middle" font-size="11" style="fill:var(--tx3)">—</text>`;
    }
    const ly = padT + iH + 14;
    if(narrow){
      s += `<text x="${cx.toFixed(1)}" y="${ly}" text-anchor="middle" font-size="9.5" style="fill:var(--tx3)">n=${cnt}</text>`
        + `<text x="${(cx + 4).toFixed(1)}" y="${ly + 12}" text-anchor="end" font-size="11" font-weight="600" fill="${t.c}" transform="rotate(-62 ${(cx + 4).toFixed(1)} ${ly + 12})">${!isEn() && t.sh ? t.sh : lab(r.category)}</text>`;
    } else {
      const parts = lab(r.category).split(' ');
      s += `<text x="${cx.toFixed(1)}" y="${ly}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${t.c}">${parts[0]}</text>`;
      if(parts[1]) s += `<text x="${cx.toFixed(1)}" y="${ly + 12}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${t.c}">${parts.slice(1).join(' ')}</text>`;
      s += `<text x="${cx.toFixed(1)}" y="${ly + (parts[1] ? 24 : 12)}" text-anchor="middle" font-size="9.5" style="fill:var(--tx3)">n=${cnt}</text>`;
    }
    s += `<rect x="${(padL + i * slot).toFixed(1)}" y="${padT}" width="${slot.toFixed(1)}" height="${h - padT}" fill="transparent"/></g>`;
  });
  return s + '</svg>';
}

function render(){
  if(!box || !ROWS) return;
  const m = MODES[mode], T = m[isEn() ? 'en' : 'nl'];
  const rows = ROWS.filter(r => TYPES[r.category]);
  const narrow = (box.clientWidth || 600) < 520;
  let tot = 0, sum = 0;
  rows.forEach(r => { const c = r[m.n] || 0; if(c && r[m.avg] != null){ tot += c; sum += c * r[m.avg]; } });
  box.innerHTML = `<div class="hd"><h3>${L('Tijd op de markt', 'Time on market')}</h3><span class="sm muted">${tot ? L('gem.', 'avg') + ' ' + nf(Math.round(sum / tot)) + ' d · n=' + nf(tot) : ''}</span></div>
    <div class="tom-body">
      <div class="seg sm tom-seg">${Object.keys(MODES).map(k => `<button data-m="${k}" class="${k === mode ? 'on' : ''}">${MODES[k][isEn() ? 'en' : 'nl'][0]}</button>`).join('')}</div>
      <div class="tom-chart">${rows.length ? chart(rows, m, narrow) : `<div class="empty sm">${L('Geen data', 'No data')}</div>`}<div class="tom-tip"></div></div>
      <div class="tom-note">${L('Huidig aanbod te koop. Kolom = gemiddeld aantal dagen sinds opname tot vandaag; wit streepje = mediaan.', 'Current stock for sale. Bar = average days from intake until today; white tick = median.')} ${L('Gestreept = minder dan 5 woningen; een te hoge kolom is afgekapt.', 'Dashed = fewer than 5 homes; a bar that is too tall is cut off.')}</div>
    </div>`;
  box.querySelectorAll('.tom-seg button').forEach(b => b.onclick = () => { mode = b.dataset.m; try{ localStorage.setItem('nexus-tom-filter', mode); }catch(e){} render(); });
  const ch = box.querySelector('.tom-chart'), tip = box.querySelector('.tom-tip');
  if(!ch || !tip) return;
  ch.onpointermove = ch.onpointerdown = e => {
    const g = e.target.closest && e.target.closest('g.tom-col'); if(!g){ tip.style.display = 'none'; return; }
    const r = rows[+g.dataset.i], t = TYPES[r.category], cnt = r[m.n] || 0;
    tip.innerHTML = `<b style="color:${t.c}">${lab(r.category)}</b><div class="muted">${T[1]}</div>`
      + `<div>${L('Gemiddeld', 'Average')}: <b>${days(cnt ? r[m.avg] : null)}</b></div>`
      + (m.med ? `<div>${L('Mediaan', 'Median')}: <b>${days(cnt ? r[m.med] : null)}</b></div>` : '')
      + `<div>${L('Woningen', 'Homes')}: <b>${nf(cnt)}</b>${cnt > 0 && cnt < 5 ? ` <span style="color:#f97316">(${L('te weinig voor een betrouwbaar gemiddelde', 'too few for a reliable average')})</span>` : ''}</div>`;
    tip.style.display = 'block';
    const rc = ch.getBoundingClientRect(), px = e.clientX - rc.left, tw = tip.offsetWidth;
    tip.style.left = Math.max(0, (px + 12 + tw > ch.clientWidth) ? px - tw - 12 : px + 12) + 'px';
  };
  ch.onpointerleave = e => { if(!e || e.pointerType === 'mouse') tip.style.display = 'none'; };
}

async function open(el, c){
  box = el; ctx = c; if(!box) return;
  if(ROWS){ render(); return; }
  box.innerHTML = `<div class="loader sm">${L('Tijd op de markt laden…', 'Loading time on market…')}</div>`;
  try{ ROWS = await ctx.rpc('nexus_time_on_market') || []; }
  catch(e){ box.innerHTML = `<div class="empty sm">${String(e.message || e).replace(/[<>&]/g, '')}</div>`; return; }
  render();
}
window.addEventListener('resize', () => { clearTimeout(rsz); rsz = setTimeout(() => { if(box && box.isConnected) render(); }, 150); });
window.NEXUS_TOM = { open, rerender: () => { if(box && box.isConnected) render(); } };
})();
