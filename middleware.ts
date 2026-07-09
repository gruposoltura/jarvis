// JARVIS - The Bridge - Basic Auth (Vercel Edge Middleware)
// Plaats dit bestand in de ROOT van de gruposoltura/jarvis repo (naast command-center.html).
// Vereist twee Environment Variables in het Vercel-project "jarvis":
//   BRIDGE_USER  (gebruikersnaam)
//   BRIDGE_PASS  (wachtwoord)
// Zet de env vars EERST (Production), commit dit bestand daarna.
// Zonder ingestelde env vars blokkeert de middleware ALLES (fail-closed) --
// dat is bewust: liever even buitengesloten dan onbedoeld open.
//
// De PIN in de VOORSTELLEN-flow blijft als tweede factor bestaan.
// Verwijderen van de bescherming = dit bestand uit de repo halen.

export const config = {
  // Beschermt het hele project (alle paden, ook toekomstige pagina's).
  matcher: "/(.*)",
};

function timingSafeEqual(a: string, b: string): boolean {
  // Constante-tijd vergelijking om timing-lekken te voorkomen.
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) {
    // Vergelijk toch iets van gelijke lengte zodat de tijd niet verklapt dat de lengte fout is.
    let diff = 1;
    for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ (bb[i % (bb.length || 1)] ?? 0);
    return false && diff === 0;
  }
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

export default function middleware(request: Request): Response | undefined {
  const USER = process.env.BRIDGE_USER || "";
  const PASS = process.env.BRIDGE_PASS || "";

  const header = request.headers.get("authorization") || "";
  if (USER && PASS && header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const sep = decoded.indexOf(":");
      const user = decoded.slice(0, sep);
      const pass = decoded.slice(sep + 1);
      if (timingSafeEqual(user, USER) && timingSafeEqual(pass, PASS)) {
        return undefined; // toegang -> verzoek loopt gewoon door naar de statische site
      }
    } catch {
      /* ongeldige base64 -> val door naar 401 */
    }
  }

  return new Response("Authentication required - The Bridge", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="The Bridge", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}
