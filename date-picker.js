// Datumvelden: bij klikken verschijnt direct het kalendertje (niet alleen via het kleine icoontje).
// Overslaan blijft kunnen: met Tab ga je er gewoon voorbij (dan opent er niets), typen werkt ook,
// en in de kalender wis je een datum met "Wissen"/"Clear" of met Delete/Backspace in het veld.
// Geldt voor alle date-, datetime-local-, month- en time-velden, ook die later dynamisch worden toegevoegd.
(() => {
  const SEL = 'input[type="date"],input[type="datetime-local"],input[type="month"],input[type="time"]';
  const open = el => {
    if (!el || el.disabled || el.readOnly || typeof el.showPicker !== 'function') return;
    try { el.showPicker(); } catch (_) { /* sommige browsers staan het niet toe; dan werkt het icoontje zoals altijd */ }
  };
  document.addEventListener('click', e => { const el = e.target.closest && e.target.closest(SEL); if (el) open(el); });
  // toetsenbord: spatie of pijl omlaag opent de kalender; Tab slaat het veld gewoon over
  document.addEventListener('keydown', e => {
    const el = e.target; if (!el.matches || !el.matches(SEL)) return;
    if (e.key === ' ' || (e.key === 'ArrowDown' && e.altKey)) { e.preventDefault(); open(el); }
  });
  const css = document.createElement('style');
  css.textContent = `${SEL}{cursor:pointer}${SEL.split(',').map(s => s + '::-webkit-calendar-picker-indicator').join(',')}{cursor:pointer;opacity:.8}`;
  document.head.appendChild(css);
})();
