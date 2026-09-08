/**
 * POST /api/chat
 * OpenAI Chat Completions grounded in public/data/floorplan.json.
 * Env: OPENAI_API_KEY only. Never log or return the value.
 *
 * Clean degrade: if the key is missing, return configured:false plus
 * local keyword matches so the client can still answer from the dataset.
 */

const { loadFloorplan, buildSystemPrompt, localSearch } = require("../lib/grounding");

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

function sanitizeMessages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(-12).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: String(m.content || "").slice(0, 4000),
  })).filter((m) => m.content.trim());
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end("Method not allowed");
  }

  let data;
  try {
    data = loadFloorplan();
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "Map grounding failed to load." }));
  }

  const body = readBody(req);
  const messages = sanitizeMessages(body.messages);
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const query = lastUser ? lastUser.content : "";
  const fallback = localSearch(data, query);
  const configured = Boolean(process.env.OPENAI_API_KEY);

  if (!configured) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    return res.end(JSON.stringify({
      ok: true,
      configured: false,
      model: null,
      reply: [
        "OPENAI_API_KEY is not configured on this deployment, so I am searching the extracted floorplan dataset instead of calling a live model.",
        "Ask about halls, pavilions, or an exhibitor name / booth from the official list. For pins the screenshot cannot confirm, open the live Goeshow floorplan.",
      ].join(" "),
      fallback,
      liveFloorplan: data.event.liveFloorplan,
    }));
  }

  if (!messages.length) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "Missing messages." }));
  }

  let openaiRes;
  try {
    openaiRes = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          { role: "system", content: buildSystemPrompt(data) },
          ...messages,
        ],
      }),
    });
  } catch (err) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({
      ok: false,
      configured: true,
      error: "Upstream chat request failed.",
      fallback,
    }));
  }

  if (!openaiRes.ok) {
    const text = await openaiRes.text().catch(() => "");
    console.error("openai chat http", openaiRes.status, text.slice(0, 200));
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({
      ok: false,
      configured: true,
      error: "Chat upstream returned an error.",
      fallback,
    }));
  }

  const payload = await openaiRes.json();
  const reply = payload?.choices?.[0]?.message?.content || "I could not form an answer from the map data. Try the live Goeshow floorplan.";

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify({
    ok: true,
    configured: true,
    model: MODEL,
    reply,
    fallback,
    liveFloorplan: data.event.liveFloorplan,
  }));
};
