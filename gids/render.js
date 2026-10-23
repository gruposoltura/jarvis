const { chromium } = require('playwright');
(async () => {
  const [,, html, pdf] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + html, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const over = await p.evaluate(() => [...document.querySelectorAll('.page')].map((pg, i) => {
    const body = pg.querySelector('.body'); if (!body) return null;
    let maxB = 0; const top = body.getBoundingClientRect().top;
    body.querySelectorAll('*').forEach(e => { const r = e.getBoundingClientRect(); if (r.height) maxB = Math.max(maxB, r.bottom - top); });
    const lim = body.getBoundingClientRect().height;
    return maxB > lim + 1 ? `p${i+1}: ${Math.round(maxB - lim)}px over` : null; }).filter(Boolean));
  console.log('OVERFLOW', JSON.stringify(over));
  await p.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true });
  await b.close();
})();
