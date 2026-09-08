#!/usr/bin/env node
const assert = require("node:assert/strict");
const handler = require("../api/chat");
const health = require("../api/health");

function mockRes() {
  const res = { statusCode: 0, headers: {}, body: "" };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.end = (b) => { res.body = b || ""; return res; };
  return res;
}

async function run() {
  delete process.env.OPENAI_API_KEY;

  const h = mockRes();
  await health({ method: "GET" }, h);
  const healthJson = JSON.parse(h.body);
  assert.equal(healthJson.ok, true);
  assert.equal(healthJson.env.OPENAI_API_KEY, false);

  const r = mockRes();
  await handler({
    method: "POST",
    body: { messages: [{ role: "user", content: "Where is the Brazil Pavilion?" }] },
  }, r);
  const json = JSON.parse(r.body);
  assert.equal(json.ok, true);
  assert.equal(json.configured, false);
  assert.match(json.reply, /OPENAI_API_KEY/);
  assert.ok(json.fallback.zones.some((z) => z.id === "brazil"));
  console.log("chat fallback ok");
}

run().catch((e) => { console.error(e); process.exit(1); });
