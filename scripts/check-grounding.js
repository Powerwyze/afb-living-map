#!/usr/bin/env node
const assert = require("node:assert/strict");
const { loadFloorplan, buildSystemPrompt, localSearch } = require("../lib/grounding");

const data = loadFloorplan();
assert.ok(data.event.shortName.includes("AF&B"));
assert.ok(data.zones.some((z) => z.id === "brazil"));
assert.ok(data.exhibitors.length > 800);

const abimapi = data.exhibitors.find((e) => e.name === "ABIMAPI");
assert.equal(abimapi.booth, "429");
assert.equal(abimapi.hall, "Hall A");

const hapcor = data.exhibitors.find((e) => e.name === "HapCor");
assert.equal(hapcor.booth, "463");

const atlantic = data.exhibitors.find((e) => e.name === "Atlantic Grocery Supply");
assert.equal(atlantic.booth, "1809");

const brazil = localSearch(data, "Where is the Brazil Pavilion?");
assert.ok(brazil.zones.some((z) => z.id === "brazil"));
assert.ok(brazil.faq.length >= 1);

const booth = localSearch(data, "429");
assert.ok(booth.matches.some((m) => m.name === "ABIMAPI"));

const prompt = buildSystemPrompt(data);
assert.ok(prompt.includes("NEVER invent"));
assert.ok(prompt.includes("429"));
assert.ok(prompt.includes(data.event.liveFloorplan));

console.log("grounding ok", {
  exhibitors: data.exhibitors.length,
  zones: data.zones.length,
  promptChars: prompt.length,
});
