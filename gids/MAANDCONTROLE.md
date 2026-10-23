# Maandelijkse controle woon- en koopgids (agent GuideCheck)

Draait elke 1e van de maand als geplande Claude-sessie. Doel: de gids (NL, EN, ES, SV) klopt
inhoudelijk met de actuele werkelijkheid. Bij een wijziging worden alle vier de PDF's opnieuw
gemaakt en vervangen ze de oude (zelfde bestandsnamen, dus links blijven werken).
Telegram gaat alleen uit als er iets gewijzigd is (of als de run misgaat).

## Bronnen in de repo's
- `gruposoltura/jarvis`, branch **gids-assets**, map `gids/`
  - `content_en.py` is de bron; `content_nl.py`, `content_es.py`, `content_sv.py` zijn vertalingen met dezelfde opbouw.
  - `build.py <lang>` maakt HTML; `publish.py <pad-naar-soltura-web>` bouwt alles, rendert de PDF's,
    controleert overflow, vervangt de PDF's en maakt de waaierbeelden.
- `gruposoltura/soltura-web` (main = live via GitHub Pages): `downloads/*.pdf`, `img/gids/*.webp`.
- Supabase project `wuvpbwowdycsdlrqkaoq`: `public.web_guide_knowledge` (wat Ava weet) en
  `public.web_config` (keys `itp_resale_pct`, `iva_newbuild_pct`, `ajd_newbuild_pct`, `euribor_12m_pct`; Ava vult hiermee
  de placeholders {itp} {iva} {ajd} {euribor} in de kennisrijen, dus deze moeten gelijk zijn aan de gids).

## Wat controleren (per run, met webzoeken op officiële bronnen)
Alleen feitelijke punten die kunnen veranderen. Toon, opmaak en stijl blijven zoals ze zijn.
1. Belastingen bij aankoop Comunitat Valenciana: ITP (en drempel hoger tarief), IVA nieuwbouw,
   AJD, verlaagde tarieven (onder 35, grote gezinnen, beperking). Bron: gva.es / DOGV, agenciatributaria.
2. Hypotheek voor niet-residenten: gangbare maximale financiering, Euribor (orde van grootte), wie
   betaalt welke kosten (Ley 5/2019).
3. Jaarlijkse lasten: IBI, basura, Modelo 210 (imputación de rentas, tarieven EU/niet-EU), vermogensbelasting/
   solidariteitsbelasting drempels Valencia.
4. Verhuur: registratie toeristische verhuur Comunitat Valenciana (Decreto/Ley turismo), registro
   único / ventanilla única de arrendamientos (NRA), regels VvE.
5. Verkoop: plusvalía municipal, retención 3% voor niet-residenten, IRPF/IRNR op meerwaarde.
6. Wonen: NIE, padrón, residencia (EU en niet-EU), golden visa (afgeschaft per april 2025 - bevestigen),
   zorg (S1/convenio especial), rijbewijs, huisdieren (Ley 7/2023).
7. Kosten notaris, registro, gestoría: alleen aanpassen bij een duidelijk ander gangbaar niveau.
8. Soltura-gegevens: adres, telefoon, openingstijden, links (gruposoltura.com pagina's moeten bestaan).
Twijfel = niet wijzigen. Alleen wijzigen met een officiële of meerdere betrouwbare bronnen.

## Bij een wijziging
1. Pas `content_en.py` aan en precies dezelfde wijziging in `content_nl.py`, `content_es.py`, `content_sv.py`
   (gewone taal, geen gedachtestreepjes, merk = Soltura Real Estate; juridisch Grupo Soltura SL).
2. Werk het jaar/de datum in de tekst bij als een tarief per een nieuwe datum geldt.
3. `python3 gids/publish.py ../soltura-web` - moet eindigen met `KLAAR`. Bij `STOP` (overflow):
   tekst op die pagina inkorten en opnieuw.
4. Controleer visueel minimaal de gewijzigde pagina's (pdftoppm -> png -> bekijken).
5. Commit + push beide repo's (jarvis gids-assets; soltura-web main). Bump in soltura-web `sw.js`
   de cacheversie (`V = 'soltura-vN'` -> N+1) zodat bezoekers de nieuwe beelden krijgen.
6. Werk de overeenkomstige rijen in `web_guide_knowledge` bij (body, `checked_on = current_date`,
   `updated_at = now()`), en `web_config` als een tarief daar staat.
7. Meld het resultaat (zie hieronder) met `changed: true` en per wijziging een korte regel in het
   Nederlands, bijv. "ITP Comunitat Valenciana 9% -> 8% per 1 jan 2027 (DOGV 12-12-2026)".

## Zonder wijziging
Niets bouwen, niets committen. Wel `checked_on = current_date` zetten in `web_guide_knowledge`
voor de gecontroleerde rijen en het resultaat melden met `changed: false` (geen Telegram).

## Resultaat melden
n8n-workflow **JARVIS-Research-GuideCheck** (id `kPKjN5guVY02nd0S`), via de n8n-connector:
`execute_workflow` met `executionMode: production`, `triggerNodeName: "Guide Check Report"`,
`inputs.webhookData = { method: "POST", body: { token, changed, summary, changes: [..], checked: [..], languages: ["nl","en","es","sv"], commit } }`.
Bij een fout: `body.error` met de reden. De workflow logt in `jarvis_runs` (GuideCheck) en stuurt
Telegram alleen bij `changed: true` of `error`. De token staat in de geplande taak.
