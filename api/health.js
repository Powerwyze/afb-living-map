/**
 * Health — reports whether OPENAI_API_KEY is present.
 * Boolean only. Never returns values.
 */

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    return res.end("Method not allowed");
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify({
    ok: true,
    service: "afb-living-map",
    demo: "AF&B Living Map",
    event: "AF&B Miami Beach · Sept 14–16 2026",
    env: {
      OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
    },
  }));
};
