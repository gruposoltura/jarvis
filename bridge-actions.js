/* =====================================================================
   The Bridge - Actielijst (waarschuwingen + taken) - BD-124, 2026-10-09
   Naar het DEWI-patroon (BD-006, Soltura-data; geen HDB-code of -credentials).
   - Data:   RPC bridge_actielijst()  (ingelogd; open issues uit de escalatieladder
             BD-123 + memo's binnen hun waarschuwingsvenster).
   - Acties: RPC bridge_action_update(p_id, p_op, p_days)
             done = afgerond, snooze = 7 dagen opschuiven, hide = niet meer tonen.
   - AI:     n8n JARVIS-Infra-IssueAsk (QMqGZn4r5okzmGUi), POST /webhook/jarvis-ask
             met de Supabase-sessie als Bearer. Alleen lezen en uitleggen.
   Wordt alleen op kpi.html geladen (loader onderaan bridge-config.js) en zet
   zichzelf als eerste blok in #kpiScroll. kpi.html zelf is niet aangepast.
   ===================================================================== */
(function(){
  'use strict';
  if(window.__bridgeActions) return; window.__bridgeActions = true;
  var ASK_URL = 'https://gruposoltura.app.n8n.cloud/webhook/jarvis-ask';
  var LIMIT = 8;
  var CFG = window.BRIDGE_CONFIG || {};
  var sb = null;
  var AL = { rows: [], filter: 'all', showAll: false, staleOpen: false };

  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function fmtDT(t){ try{ return new Date(t).toLocaleString('nl-NL', { timeZone:'Europe/Madrid', day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }); }catch(e){ return ''; } }

  var CSS = ''
  + '#actions{margin:0 0 14px;background:var(--panel,#0d1420);border:1px solid var(--line,#1c2940);border-radius:12px;padding:12px 14px 10px}'
  + '#actions .al-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}'
  + '#actions .al-t{font-size:12.5px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:var(--yellow,#ffd400)}'
  + '#actions .al-s{font-size:11px;color:var(--muted,#7d8ca3)}'
  + '#actions .al-f{margin-left:auto;display:flex;gap:4px}'
  + '#actions .al-f button{appearance:none;background:none;border:1px solid var(--line,#1c2940);color:var(--muted,#7d8ca3);font:600 11px system-ui;border-radius:8px;padding:3px 9px;cursor:pointer}'
  + '#actions .al-f button.on{border-color:var(--yellow,#ffd400);color:var(--yellow,#ffd400)}'
  + '#actions .al-f button:focus-visible{outline:2px solid var(--cyan,#00d4ff);outline-offset:1px}'
  + '#actions .al-heal{display:none;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 8px;padding:7px 12px;border-radius:10px;border:1px dashed rgba(125,140,163,.5);background:rgba(125,140,163,.06);font-size:11px;color:var(--muted,#7d8ca3)}'
  + '#actions .al-heal.on{display:flex}'
  + '#actions .al-heal .h{font:800 9.5px/1 system-ui;letter-spacing:.16em;color:var(--green,#4fd1a1)}'
  + '.al-list{display:flex;flex-direction:column}'
  + '.al-row{display:grid;grid-template-columns:4px minmax(0,1fr) auto;gap:10px;align-items:center;padding:7px 0;border-top:1px solid rgba(28,41,64,.6)}'
  + '.al-row:first-child{border-top:0}'
  + '.al-bar{align-self:stretch;border-radius:2px;background:var(--muted,#7d8ca3);opacity:.5}'
  + '.al-row.p-high .al-bar{background:var(--red,#ff5d5d);opacity:1}'
  + '.al-row.p-med .al-bar{background:var(--yellow,#ffd400);opacity:.8}'
  + '.al-row.p-low .al-bar{background:var(--green,#4fd1a1);opacity:.55}'
  + '.al-main{min-width:0;cursor:pointer}'
  + '.al-title{font-size:13px;line-height:1.35;color:var(--text,#dfe8f5);overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}'
  + '.al-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:2px;font-size:11px;color:var(--muted,#7d8ca3)}'
  + '.al-meta .k-w{color:var(--red,#ff5d5d);font-weight:700}'
  + '.al-meta .k-h{color:var(--green,#4fd1a1);font-weight:700}'
  + '.al-meta .k-t{color:var(--yellow,#ffd400);font-weight:700}'
  + '.al-meta .late{color:var(--red,#ff5d5d);font-weight:700}'
  + '.al-meta .soon{color:var(--orange,#e67e22);font-weight:700}'
  + '.al-detail{display:none;margin-top:6px;font-size:12px;line-height:1.5;color:#b9c6d8;white-space:pre-wrap}'
  + '.al-detail b{color:var(--text,#dfe8f5)}'
  + '.al-detail a{color:var(--cyan,#00d4ff)}'
  + '.al-row.open .al-detail{display:block}'
  + '.al-row.open .al-title{-webkit-line-clamp:unset}'
  + '.al-btns{display:flex;gap:4px}'
  + '.al-btns button{appearance:none;background:rgba(0,0,0,.25);border:1px solid var(--line,#1c2940);color:var(--muted,#7d8ca3);border-radius:7px;min-width:30px;height:28px;padding:0 7px;cursor:pointer;font:600 11.5px system-ui}'
  + '.al-btns button:hover,.al-btns button:focus-visible{color:var(--text,#dfe8f5);border-color:var(--cyan,#00d4ff);outline:none}'
  + '.al-btns button.ok:hover{border-color:var(--green,#4fd1a1);color:var(--green,#4fd1a1)}'
  + '.al-btns button.del:hover{border-color:var(--red,#ff5d5d);color:var(--red,#ff5d5d)}'
  + '.al-btns button:disabled{opacity:.4;cursor:default}'
  + '.al-more{appearance:none;background:none;border:0;color:var(--cyan,#00d4ff);font:600 12px system-ui;padding:8px 0 2px;cursor:pointer}'
  + '.al-empty{font-size:12.5px;color:var(--muted,#7d8ca3);padding:6px 0}'
  + '.al-stale{margin-top:6px;border-top:1px dashed var(--line,#1c2940);padding-top:6px}'
  + '.al-stale summary{cursor:pointer;color:var(--muted,#7d8ca3);font-size:12px;list-style:none}'
  + '.al-stale summary::-webkit-details-marker{display:none}'
  + '@media (max-width:820px){.al-row{grid-template-columns:4px minmax(0,1fr)}.al-btns{grid-column:2;justify-content:flex-start}}'
  /* AI-paneel */
  + '#alAsk{position:fixed;top:0;right:0;bottom:0;width:min(440px,100vw);background:var(--panel,#0d1420);border-left:1px solid var(--line,#1c2940);z-index:60;display:flex;flex-direction:column;transform:translateX(105%);transition:transform .2s ease;box-shadow:-20px 0 40px -20px rgba(0,0,0,.7)}'
  + '#alAsk.open{transform:none}'
  + '#alAsk .ah{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid var(--line,#1c2940)}'
  + '#alAsk .ah .t{font-weight:800;letter-spacing:.18em;font-size:12px;color:var(--cyan,#00d4ff)}'
  + '#alAsk .ah .s{font-size:11px;color:var(--muted,#7d8ca3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}'
  + '#alAsk .ah button{appearance:none;background:none;border:1px solid var(--line,#1c2940);color:var(--muted,#7d8ca3);border-radius:7px;padding:3px 9px;font:600 11px system-ui;cursor:pointer}'
  + '#alAsk .am{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px}'
  + '#alAsk .msg{font-size:13px;line-height:1.5;border-radius:10px;padding:8px 11px;max-width:92%}'
  + '#alAsk .msg.u{align-self:flex-end;background:rgba(0,212,255,.12);border:1px solid rgba(0,212,255,.35)}'
  + '#alAsk .msg.a{align-self:flex-start;background:rgba(0,0,0,.28);border:1px solid var(--line,#1c2940);white-space:pre-wrap}'
  + '#alAsk .msg.err{align-self:flex-start;color:var(--red,#ff5d5d);border:1px solid rgba(255,93,93,.45)}'
  + '#alAsk .thinking{font-size:12px;color:var(--muted,#7d8ca3)}'
  + '#alAsk .ac{display:flex;gap:6px;padding:10px 12px;border-top:1px solid var(--line,#1c2940)}'
  + '#alAsk textarea{flex:1;resize:none;background:rgba(0,0,0,.3);color:var(--text,#dfe8f5);border:1px solid var(--line,#1c2940);border-radius:8px;padding:7px 9px;font:13px system-ui;min-height:36px}'
  + '#alAsk .send{appearance:none;background:var(--cyan,#00d4ff);color:#04070d;border:0;border-radius:8px;padding:0 14px;font:700 12px system-ui;cursor:pointer}'
  + '#alAsk .send:disabled{opacity:.45;cursor:default}';

  /* ------------------------------------------------------------ opbouw */
  function mount(){
    var host = $('kpiScroll'); if(!host || $('actions')) return !!$('actions');
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var sec = document.createElement('section');
    sec.id = 'actions'; sec.setAttribute('aria-label', 'Actielijst');
    sec.innerHTML = '<div class="al-head"><span class="al-t">Actielijst</span><span class="al-s" id="al-sum"></span>'
      + '<span class="al-f" role="group" aria-label="Filter">'
      + '<button type="button" data-f="all" class="on">Alles</button>'
      + '<button type="button" data-f="w">Waarschuwingen</button>'
      + '<button type="button" data-f="t">Taken</button></span></div>'
      + '<div class="al-heal" id="al-heal"></div>'
      + '<div id="al-body"><div class="al-empty">laden&hellip;</div></div>';
    host.insertBefore(sec, host.firstChild);
    sec.addEventListener('click', onClick);
    buildAsk();
    return true;
  }

  /* ------------------------------------------------------------ actielijst */
  function dueTxt(r){
    if(r.days_left == null) return '';
    var d = Number(r.days_left);
    if(d < 0) return '<span class="late">' + (-d) + ' d te laat</span>';
    if(d === 0) return '<span class="soon">vandaag</span>';
    if(d <= 3) return '<span class="soon">over ' + d + ' d</span>';
    return 'deadline ' + String(r.deadline).slice(8,10) + '/' + String(r.deadline).slice(5,7);
  }
  function rowHtml(r){
    var meta = [];
    if(r.src === 'issue'){
      meta.push(r.stage === 'geescaleerd' ? '<span class="k-w">Actie nodig</span>' : '<span class="k-h">Zelfherstel loopt</span>');
      if(r.category) meta.push(esc(r.category));
      meta.push('sinds ' + esc(fmtDT(r.started_at)));
      if(r.stage !== 'geescaleerd') meta.push('escaleert ' + esc(fmtDT(r.escalate_after)));
    } else {
      meta.push('<span class="k-t">Taak</span>');
      if(r.category) meta.push(esc(r.category));
      var due = dueTxt(r); if(due) meta.push(due);
    }
    var det = '';
    if(r.detail) det += esc(r.detail);
    if(r.todo) det += (det ? '\n\n' : '') + '<b>Te doen:</b> ' + esc(r.todo);
    var links = [];
    if(r.execution_url) links.push('<a href="' + esc(r.execution_url) + '" target="_blank" rel="noopener">Open executie</a>');
    if(r.url) links.push('<a href="' + esc(r.url) + '" target="_blank" rel="noopener">Open link</a>');
    if(links.length) det += (det ? '\n\n' : '') + links.join(' &middot; ');
    var btns = '<button type="button" class="ok" data-op="done" title="Afgerond" aria-label="Afgerond">&#10003;</button>'
      + '<button type="button" data-op="snooze" title="7 dagen opschuiven" aria-label="7 dagen opschuiven">7d</button>'
      + '<button type="button" class="del" data-op="hide" title="Verwijderen: niet meer tonen (komt pas terug als het opnieuw optreedt)" aria-label="Verwijderen">&#10005;</button>'
      + '<button type="button" data-op="ask" title="Vraag JARVIS hiernaar" aria-label="Vraag AI">AI</button>';
    return '<div class="al-row p-' + esc(r.priority || 'low') + '" data-id="' + esc(r.id) + '">'
      + '<span class="al-bar"></span>'
      + '<div class="al-main" data-op="toggle"><div class="al-title">' + esc(r.title) + '</div><div class="al-meta">' + meta.join('<span>&middot;</span>') + '</div>'
      + (det ? '<div class="al-detail">' + det + '</div>' : '') + '</div>'
      + '<div class="al-btns">' + btns + '</div></div>';
  }
  function match(r){
    if(AL.filter === 'w') return r.src === 'issue';
    if(AL.filter === 't') return r.src === 'memo';
    return true;
  }
  function render(){
    var box = $('al-body'); if(!box) return;
    var heal = AL.rows.filter(function(r){ return r.src === 'issue' && r.stage !== 'geescaleerd'; });
    var act = AL.rows.filter(function(r){ return !r.stale && !(r.src === 'issue' && r.stage !== 'geescaleerd'); });
    var stale = AL.rows.filter(function(r){ return r.stale; });
    var nW = act.filter(function(r){ return r.src === 'issue'; }).length, nT = act.length - nW;
    $('al-sum').textContent = (nW + ' waarschuwing' + (nW === 1 ? '' : 'en') + ' met actie, ' + nT + ' ta' + (nT === 1 ? 'ak' : 'ken'))
      + (heal.length ? ' · ' + heal.length + ' in zelfherstel' : '');
    var hb = $('al-heal');
    if(hb){
      hb.classList.toggle('on', heal.length > 0 && AL.filter !== 't');
      hb.innerHTML = '<span class="h">ZELFHERSTEL</span><span>' + heal.length + ' punt' + (heal.length === 1 ? '' : 'en')
        + ' lost' + (heal.length === 1 ? '' : 'en') + ' zichzelf waarschijnlijk op; je hoort er pas van als dat binnen de wachttijd niet lukt. Ze staan hieronder onderaan, groen gemarkeerd.</span>';
    }
    var list = act.concat(AL.filter === 't' ? [] : heal).filter(match);
    var shown = AL.showAll ? list : list.slice(0, LIMIT);
    var h = shown.length ? '<div class="al-list">' + shown.map(rowHtml).join('') + '</div>'
      : '<div class="al-empty">' + (AL.filter === 't' ? 'Geen taken die nu op je wachten.' : 'Niets dat nu je aandacht vraagt.') + '</div>';
    if(list.length > LIMIT) h += '<button type="button" class="al-more" data-op="more">' + (AL.showAll ? 'Toon minder' : 'Toon alle ' + list.length) + '</button>';
    var staleF = stale.filter(match);
    if(staleF.length){
      h += '<details class="al-stale"' + (AL.staleOpen ? ' open' : '') + '><summary><b>' + staleF.length
        + '</b> ' + (staleF.length === 1 ? 'taak' : 'taken') + ' al 14+ dagen over de deadline &mdash; mogelijk achterhaald</summary>'
        + '<div class="al-list">' + staleF.map(rowHtml).join('') + '</div></details>';
    }
    box.innerHTML = h;
    var sd = box.querySelector('.al-stale'); if(sd) sd.addEventListener('toggle', function(){ AL.staleOpen = sd.open; });
    Array.prototype.forEach.call(document.querySelectorAll('#actions .al-f button'), function(b){ b.classList.toggle('on', b.getAttribute('data-f') === AL.filter); });
  }
  function load(){
    if(!sb) return Promise.resolve();
    return sb.rpc('bridge_actielijst').then(function(res){
      if(res.error) throw res.error;
      AL.rows = Array.isArray(res.data) ? res.data : [];
      render();
    }).catch(function(e){
      var box = $('al-body'); if(box) box.innerHTML = '<div class="al-empty">Actielijst niet geladen: ' + esc(e.message || e) + '</div>';
    });
  }
  function onClick(e){
    var f = e.target.closest('.al-f button');
    if(f){ AL.filter = f.getAttribute('data-f'); AL.showAll = false; render(); return; }
    if(e.target.closest('a')) return;
    var b = e.target.closest('[data-op]'); if(!b) return;
    var op = b.getAttribute('data-op');
    if(op === 'more'){ AL.showAll = !AL.showAll; render(); return; }
    var row = b.closest('.al-row'); if(!row) return;
    var id = row.getAttribute('data-id');
    var r = AL.rows.filter(function(x){ return String(x.id) === id; })[0];
    if(op === 'toggle'){ row.classList.toggle('open'); return; }
    if(op === 'ask'){ openAsk(r); return; }
    if(op === 'hide' && !confirm('Verwijderen uit de actielijst? JARVIS meldt dit punt niet meer, tenzij het opnieuw optreedt.')) return;
    b.disabled = true;
    sb.rpc('bridge_action_update', { p_id: id, p_op: op, p_days: 7 }).then(function(res){
      if(res.error) throw res.error;
      AL.rows = AL.rows.filter(function(x){ return String(x.id) !== id; });
      render();
    }).catch(function(err){ b.disabled = false; alert('Niet gelukt: ' + (err.message || err)); });
  }

  /* ------------------------------------------------------------ AI */
  var ASK = { item: null, msgs: [], busy: false };
  function buildAsk(){
    var p = document.createElement('aside');
    p.id = 'alAsk'; p.setAttribute('aria-label', 'Vraag JARVIS'); p.setAttribute('aria-hidden', 'true');
    p.innerHTML = '<div class="ah"><span class="t">VRAAG JARVIS</span><span class="s" id="alAskS"></span><button type="button" id="alAskX">Sluiten</button></div>'
      + '<div class="am" id="alAskM" aria-live="polite"></div>'
      + '<div class="ac"><textarea id="alAskIn" rows="1" placeholder="Vervolgvraag&hellip;"></textarea><button type="button" class="send" id="alAskGo">Stuur</button></div>';
    document.body.appendChild(p);
    $('alAskX').addEventListener('click', closeAsk);
    var ta = $('alAskIn');
    ta.addEventListener('keydown', function(e){ if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); var v = ta.value; ta.value = ''; send(v); } });
    $('alAskGo').addEventListener('click', function(){ var v = ta.value; ta.value = ''; send(v); });
    document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && p.classList.contains('open')) closeAsk(); });
  }
  function renderAsk(){
    var box = $('alAskM'); if(!box) return;
    var h = ASK.msgs.map(function(m){
      if(m.role === 'user') return '<div class="msg u">' + esc(m.text) + '</div>';
      if(m.role === 'error') return '<div class="msg err">' + esc(m.text) + '</div>';
      return '<div class="msg a">' + esc(m.text) + '</div>';
    }).join('');
    if(ASK.busy) h += '<div class="thinking" id="alAskT">JARVIS zoekt het uit&hellip;</div>';
    box.innerHTML = h; box.scrollTop = box.scrollHeight;
    $('alAskGo').disabled = ASK.busy;
  }
  function openAsk(r){
    var p = $('alAsk'); if(!p || !r) return;
    if(!ASK.item || ASK.item.id !== r.id){ ASK.item = r; ASK.msgs = []; }
    $('alAskS').textContent = r.title;
    p.classList.add('open'); p.setAttribute('aria-hidden', 'false');
    renderAsk();
    if(!ASK.msgs.length) send('Wat is de stand en wat moet ik doen?');
  }
  function closeAsk(){ var p = $('alAsk'); if(p){ p.classList.remove('open'); p.setAttribute('aria-hidden', 'true'); } }
  function send(text){
    text = String(text || '').trim(); if(!text || ASK.busy || !ASK.item) return;
    var hist = ASK.msgs.filter(function(m){ return m.role === 'user' || m.role === 'assistant'; }).slice(-8);
    ASK.msgs.push({ role:'user', text:text }); ASK.busy = true; renderAsk();
    var t0 = Date.now(), tick = setInterval(function(){ var el = $('alAskT'); if(el) el.textContent = 'JARVIS zoekt het uit… ' + Math.round((Date.now() - t0) / 1000) + ' s'; }, 1000);
    sb.auth.getSession().then(function(res){
      var s = res.data && res.data.session; if(!s) throw new Error('Geen sessie: log opnieuw in.');
      return fetch(ASK_URL, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + s.access_token },
        body: JSON.stringify({ id: ASK.item.id, question: text, history: hist }) });
    }).then(function(r){
      if(r.status === 401) throw new Error('Geen toegang: je sessie is verlopen. Log opnieuw in.');
      if(!r.ok) throw new Error('JARVIS gaf HTTP ' + r.status + '. Staat workflow JARVIS-Infra-IssueAsk gepubliceerd?');
      return r.json();
    }).then(function(j){
      ASK.msgs.push({ role:'assistant', text: (j && j.answer) || '(leeg antwoord)' });
    }).catch(function(e){
      ASK.msgs.push({ role:'error', text: e.message || String(e) });
    }).then(function(){ clearInterval(tick); ASK.busy = false; renderAsk(); });
  }

  /* ------------------------------------------------------------ start */
  function start(){
    if(!window.supabase || !CFG.SUPABASE_URL) return;
    // Eigen client op dezelfde sessie-opslag; de cockpit-client ververst het token.
    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { autoRefreshToken:false, persistSession:true, detectSessionInUrl:false } });
    var tries = 0;
    (function wait(){
      var work = $('work');
      if(work && !work.classList.contains('hidden') && mount()){
        load(); setInterval(load, 5 * 60 * 1000);
        document.addEventListener('visibilitychange', function(){ if(document.visibilityState === 'visible') load(); });
        return;
      }
      if(++tries < 120) setTimeout(wait, 500);
    })();
  }
  window.BRIDGE_ACTIONS = { reload: load };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
