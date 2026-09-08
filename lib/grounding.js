/**
 * Shared floorplan grounding — used by /api/chat.
 * Never invent booth numbers. Prefer official list + visual zones.
 */

function loadFloorplan() {
  // require() so Vercel bundles the JSON into the serverless function.
  // public/data/floorplan.json remains the client copy.
  return require("../public/data/floorplan.json");
}

function compactExhibitors(exhibitors, limit = 950) {
  return exhibitors.slice(0, limit).map((ex) => {
    const loc = ex.hall ? ` · ${ex.hall}${ex.zone ? " / " + ex.zone : ""}` : "";
    return `${ex.booth}\t${ex.name}${loc}`;
  }).join("\n");
}

function buildSystemPrompt(data) {
  const event = data.event || {};
  const halls = (data.halls || []).map((h) =>
    `${h.name} (${h.side}): ${h.landmarks.join("; ")}`
  ).join("\n");
  const zones = (data.zones || []).map((z) =>
    `${z.name} — ${z.hall} [${z.kind}] (${z.confidence}): ${z.notes}`
  ).join("\n");
  const legend = (data.legend || []).map((l) => `${l.color} = ${l.status}`).join("; ");
  const faq = (data.faq || []).map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n");

  return [
    "You are the PowerWyze Living Map guide for the Americas Food & Beverage Show & Conference 2026 (AF&B), Miami Beach Convention Center, September 14–16, 2026 (30th Anniversary).",
    "Stephanie (PowerWyze CEO) and team will ask about booth locations, paths, pavilions, halls, exhibitors, and wayfinding.",
    "",
    "HARD RULES:",
    "- Answer ONLY from the map data below (visual floorplan zones + official Goeshow exhibitor list).",
    "- NEVER invent or guess a booth number, company, or hall assignment that is not in the data.",
    "- If a company is on the exhibitor list without a hall, give the official booth number and say the hall is not confirmed in this dataset. Suggest the live Goeshow floorplan.",
    "- If something is unknown, say so clearly and point to the live floorplan: " + event.liveFloorplan,
    "- Prefer hall / pavilion / landmark answers over fake exact pins.",
    "- Visual zone boxes are approximate overlays on a screenshot, not surveyed CAD.",
    "- Booth IDs on the screenshot are often illegible; official list booth IDs are the source of truth.",
    "- Do not mention API keys, models, or internal implementation.",
    "- Keep answers concise and useful for walking the floor. Name Hall A / B / C and nearby landmarks.",
    "",
    "EVENT:",
    JSON.stringify(event, null, 2),
    "",
    "LEGEND: " + legend,
    "",
    "HALLS:",
    halls,
    "",
    "ZONES / LANDMARKS:",
    zones,
    "",
    "CANNED GROUNDING FAQ (you may reuse):",
    faq,
    "",
    "OFFICIAL EXHIBITOR LIST (booth TAB name; optional hall/zone when visually confirmed):",
    compactExhibitors(data.exhibitors || []),
    "",
    "DISCLAIMER: " + (data.disclaimer || ""),
  ].join("\n");
}

const STOP = new Set(["where", "what", "whats", "which", "how", "do", "i", "get", "to", "the", "a", "an", "is", "in", "of", "for", "from", "and", "or", "at", "on", "me", "please", "find", "show", "tell", "about"]);

function tokens(query) {
  return String(query || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));
}

function localSearch(data, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return { matches: [], zones: [], faq: [] };
  const words = tokens(q);
  const rawWords = q.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);

  const zones = (data.zones || []).filter((z) => {
    const hay = `${z.name} ${z.hall} ${z.kind} ${z.notes}`.toLowerCase();
    if (hay.includes(q.replace(/[^a-z0-9\s]/g, "").trim())) return true;
    if (!words.length) return false;
    return words.every((w) => hay.includes(w));
  }).slice(0, 8);

  const faq = (data.faq || []).filter((f) => {
    const hay = `${f.q} ${f.a}`.toLowerCase();
    if (hay.includes(q)) return true;
    return words.some((w) => w.length > 3 && hay.includes(w));
  }).slice(0, 4);

  const boothQ = q.replace(/booth\s*/, "").replace(/[^0-9]/g, "");
  const matches = (data.exhibitors || []).filter((ex) => {
    const name = ex.name.toLowerCase();
    const booth = String(ex.booth);
    if (boothQ && booth === boothQ) return true;
    const nameWords = words.length ? words : rawWords.filter((w) => w.length > 1);
    if (!nameWords.length) return false;
    return nameWords.every((w) => name.includes(w) || booth.includes(w));
  }).slice(0, 12);

  return { matches, zones, faq };
}

module.exports = { loadFloorplan, buildSystemPrompt, localSearch };
