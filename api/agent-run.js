// /api/agent-run - The Bridge <-> n8n executions proxy
//
// Waarom dit bestaat: de n8n API key mag nooit in de browser komen. Deze
// functie draait server-side op Vercel, controleert eerst of de aanvrager
// een geldige Supabase-sessie heeft (dezelfde login als The Bridge zelf),
// en praat daarna met de n8n REST API. Zware node-payloads worden hier
// weggegooid; alleen de stappenlijst gaat terug naar de browser.
//
// Vereiste Vercel environment variables (Project Settings -> Environment Variables):
//   N8N_API_KEY        - n8n Cloud API key (Settings -> n8n API -> Create key)
//   SUPABASE_URL       - https://wuvpbwowdycsdlrqkaoq.supabase.co
//   SUPABASE_ANON_KEY  - eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1dnBid293ZHljc2RscnFrYW9xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5OTQ5MTYsImV4cCI6MjA5NjU3MDkxNn0.S5S0KcYHOrMjLl9ApRmvRKPOd_EjgJ5gYnzgqL-c8hQ
//   N8N_API_URL        - optioneel; default https://gruposoltura.app.n8n.cloud/api/v1
//
// Endpoints:
//   GET /api/agent-run?workflow_id=XXXX                    -> laatste executies (metadata)
//   GET /api/agent-run?workflow_id=XXXX&execution_id=YYYY  -> stappen van 1 executie

const N8N_API_URL = process.env.N8N_API_URL || "https://gruposoltura.app.n8n.cloud/api/v1";

async function verifySupabaseUser(req) {
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        authorization: `Bearer ${token}`
      }
    });
    if (!r.ok) return null;
    const user = await r.json();
    return user && user.id ? user : null;
  } catch {
    return null;
  }
}

async function n8nGet(path) {
  const r = await fetch(`${N8N_API_URL}${path}`, {
    headers: { "X-N8N-API-KEY": process.env.N8N_API_KEY, accept: "application/json" }
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`n8n API ${r.status}: ${body.slice(0, 200)}`);
  }
  return r.json();
}

function durationMs(exec) {
  if (!exec.startedAt || !exec.stoppedAt) return null;
  return new Date(exec.stoppedAt).getTime() - new Date(exec.startedAt).getTime();
}

function extractSteps(executionData) {
  // n8n kan data als object of als JSON-string leveren
  let data = executionData;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { return []; }
  }
  const runData = data && data.resultData && data.resultData.runData;
  if (!runData) return [];

  const steps = [];
  for (const nodeName of Object.keys(runData)) {
    const runs = runData[nodeName];
    if (!Array.isArray(runs) || runs.length === 0) continue;
    // laatste run van de node is de relevante bij loops/retries
    const run = runs[runs.length - 1];
    steps.push({
      node: nodeName,
      order: typeof run.executionIndex === "number" ? run.executionIndex : 0,
      status: run.executionStatus || "unknown",
      ms: typeof run.executionTime === "number" ? run.executionTime : null,
      started: run.startTime ? new Date(run.startTime).toISOString() : null,
      previous: (Array.isArray(run.source) && run.source[0] && run.source[0].previousNode) || null,
      runs: runs.length
    });
  }
  steps.sort((a, b) => a.order - b.order);
  return steps;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  if (!process.env.N8N_API_KEY || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    res.status(500).json({ error: "server_misconfigured", detail: "Env vars N8N_API_KEY / SUPABASE_URL / SUPABASE_ANON_KEY ontbreken in Vercel." });
    return;
  }

  const user = await verifySupabaseUser(req);
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const { workflow_id: workflowId, execution_id: executionId, limit } = req.query;
  if (!workflowId || !/^[A-Za-z0-9]+$/.test(workflowId)) {
    res.status(400).json({ error: "workflow_id_required" });
    return;
  }

  try {
    if (executionId) {
      if (!/^[0-9]+$/.test(executionId)) {
        res.status(400).json({ error: "invalid_execution_id" });
        return;
      }
      const exec = await n8nGet(`/executions/${executionId}?includeData=true`);
      if (String(exec.workflowId) !== String(workflowId)) {
        res.status(404).json({ error: "execution_not_in_workflow" });
        return;
      }
      res.setHeader("cache-control", "private, max-age=15");
      res.status(200).json({
        execution: {
          id: exec.id,
          status: exec.status,
          mode: exec.mode,
          startedAt: exec.startedAt,
          stoppedAt: exec.stoppedAt,
          duration_ms: durationMs(exec)
        },
        steps: extractSteps(exec.data)
      });
      return;
    }

    const lim = Math.min(parseInt(limit, 10) || 15, 50);
    const list = await n8nGet(`/executions?workflowId=${encodeURIComponent(workflowId)}&limit=${lim}`);
    res.setHeader("cache-control", "private, max-age=15");
    res.status(200).json({
      executions: (list.data || []).map((e) => ({
        id: e.id,
        status: e.status,
        mode: e.mode,
        startedAt: e.startedAt,
        stoppedAt: e.stoppedAt,
        duration_ms: durationMs(e)
      }))
    });
  } catch (err) {
    res.status(502).json({ error: "n8n_upstream_error", detail: String(err.message || err).slice(0, 300) });
  }
};
