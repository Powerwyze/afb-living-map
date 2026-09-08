/* ================================================================
 *  PowerWyze AF&B Living Map — landscape talk-to-map
 * ================================================================ */

const LIVE_MAP = "https://maps.goeshow.com/atec/amfoodbev/2026/Floorplan";

const STARTER_PROMPTS = [
  "Where is the Brazil Pavilion from the entrance?",
  "How do I get to Center Stage?",
  "Where is A Taste of the States?",
  "What hall is the Beverage Pavilion in?",
  "Where is HapCor / booth 463?",
  "Atlantic Grocery Supply booth?",
];

const FEATURED_ZONES = [
  "hall-a", "hall-b", "hall-c",
  "beverage-pavilion", "brazil", "food-court",
  "taste-of-the-states", "center-stage", "beer-lounge",
  "buyers-lounge", "hapcor", "japan",
];

const $ = (sel, root = document) => root.querySelector(sel);

const state = {
  data: null,
  configured: false,
  messages: [],
  scale: 1,
  x: 0,
  y: 0,
  drag: null,
  activeZone: null,
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function applyTransform() {
  $("#mapWorld").style.transform = `translate(${state.x}px, ${state.y}px) scale(${state.scale})`;
}

function fitMap() {
  state.scale = 1;
  state.x = 0;
  state.y = 0;
  applyTransform();
}

function zoomBy(delta, cx, cy) {
  const prev = state.scale;
  const next = Math.min(4, Math.max(1, prev * delta));
  if (next === prev) return;
  const stage = $("#mapStage").getBoundingClientRect();
  const ox = (cx ?? stage.left + stage.width / 2) - stage.left;
  const oy = (cy ?? stage.top + stage.height / 2) - stage.top;
  state.x = ox - ((ox - state.x) * next) / prev;
  state.y = oy - ((oy - state.y) * next) / prev;
  state.scale = next;
  applyTransform();
}

function highlightZone(zone) {
  const overlays = $("#overlays");
  overlays.innerHTML = "";
  state.activeZone = zone ? zone.id : null;
  $$chips();
  if (!zone || !zone.box) return;
  const [l, t, w, h] = zone.box;
  const el = document.createElement("div");
  el.className = "zone-box";
  el.style.left = `${l}%`;
  el.style.top = `${t}%`;
  el.style.width = `${w}%`;
  el.style.height = `${h}%`;
  el.innerHTML = `<span class="zone-box__label">${escapeHtml(zone.name)}</span>`;
  overlays.appendChild(el);
}

function $$chips() {
  document.querySelectorAll(".chip").forEach((btn) => {
    btn.classList.toggle("is-on", btn.dataset.zone === state.activeZone);
  });
}

function renderChips() {
  const host = $("#zoneChips");
  host.innerHTML = "";
  const zones = (state.data.zones || []).filter((z) => FEATURED_ZONES.includes(z.id));
  zones.forEach((z) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.dataset.zone = z.id;
    btn.textContent = z.name;
    btn.addEventListener("click", () => {
      highlightZone(state.activeZone === z.id ? null : z);
      addBot(`<b>${escapeHtml(z.name)}</b> · ${escapeHtml(z.hall)} (${escapeHtml(z.confidence)})<br>${escapeHtml(z.notes)}`);
    });
    host.appendChild(btn);
  });
}

function renderPrompts() {
  const host = $("#prompts");
  host.innerHTML = "";
  STARTER_PROMPTS.forEach((text) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "prompt";
    btn.textContent = text;
    btn.addEventListener("click", () => ask(text));
    host.appendChild(btn);
  });
}

function addMsg(role, html) {
  const el = document.createElement("div");
  el.className = `msg msg--${role}`;
  el.innerHTML = html;
  $("#transcript").appendChild(el);
  $("#transcript").scrollTop = $("#transcript").scrollHeight;
}

function addBot(html) { addMsg("bot", html); }
function addUser(text) { addMsg("user", escapeHtml(text)); }
function addSys(html) { addMsg("sys", html); }

function formatFallback(fb) {
  if (!fb) return "";
  const parts = [];
  if (fb.zones?.length) {
    parts.push("<b>Zones</b><ul>" + fb.zones.map((z) =>
      `<li>${escapeHtml(z.name)} — ${escapeHtml(z.hall)} (${escapeHtml(z.confidence)})</li>`
    ).join("") + "</ul>");
  }
  if (fb.matches?.length) {
    parts.push("<b>Official exhibitor list</b><ul>" + fb.matches.map((ex) => {
      const loc = ex.hall ? ` · ${escapeHtml(ex.hall)}` : "";
      return `<li>Booth ${escapeHtml(ex.booth)} — ${escapeHtml(ex.name)}${loc}</li>`;
    }).join("") + "</ul>");
  }
  if (fb.faq?.length) {
    parts.push("<b>From map FAQ</b><ul>" + fb.faq.map((f) =>
      `<li>${escapeHtml(f.a)}</li>`
    ).join("") + "</ul>");
  }
  return parts.join("");
}

function localAnswer(query) {
  const q = query.toLowerCase();
  const zone = (state.data.zones || []).find((z) =>
    z.name.toLowerCase().includes(q) || q.includes(z.name.toLowerCase())
  );
  if (zone) highlightZone(zone);

  const faqHit = (state.data.faq || []).find((f) =>
    f.q.toLowerCase().includes(q) || q.split(/\s+/).filter((w) => w.length > 3).every((w) =>
      (f.q + f.a).toLowerCase().includes(w)
    )
  );

  const boothQ = q.replace(/booth\s*/, "").trim();
  const matches = (state.data.exhibitors || []).filter((ex) => {
    const name = ex.name.toLowerCase();
    if (ex.booth === boothQ) return true;
    return q.split(/\s+/).filter((w) => w.length > 2).every((w) => name.includes(w) || ex.booth.includes(w));
  }).slice(0, 8);

  const bits = [];
  if (faqHit) bits.push(escapeHtml(faqHit.a));
  if (zone && !faqHit) bits.push(`<b>${escapeHtml(zone.name)}</b> is in ${escapeHtml(zone.hall)}. ${escapeHtml(zone.notes)}`);
  if (matches.length) {
    bits.push("<b>Official list matches</b><ul>" + matches.map((ex) => {
      const loc = ex.hall ? ` · ${escapeHtml(ex.hall)}` : " · hall not confirmed in this dataset";
      return `<li>Booth ${escapeHtml(ex.booth)} — ${escapeHtml(ex.name)}${loc}</li>`;
    }).join("") + "</ul>");
  }
  if (!bits.length) {
    bits.push(`Nothing exact in the extracted map data. I will not invent a booth number. Open the <a href="${LIVE_MAP}" target="_blank" rel="noopener noreferrer">live Goeshow floorplan</a>.`);
  }
  return bits.join("<br><br>");
}

async function ask(text) {
  const q = String(text || "").trim();
  if (!q) return;
  addUser(q);
  state.messages.push({ role: "user", content: q });
  $("#sendBtn").disabled = true;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: state.messages }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.reply) {
      addBot(escapeHtml(data.reply).replace(/\n/g, "<br>"));
      state.messages.push({ role: "assistant", content: data.reply });
      const extra = formatFallback(data.fallback);
      if (extra && !data.configured) addBot(extra);
      const zoneFromQ = (state.data.zones || []).find((z) =>
        q.toLowerCase().includes(z.name.toLowerCase())
      );
      if (zoneFromQ) highlightZone(zoneFromQ);
    } else if (data.fallback) {
      addBot((data.error ? escapeHtml(data.error) + "<br><br>" : "") + (formatFallback(data.fallback) || localAnswer(q)));
    } else {
      addBot(localAnswer(q));
    }
  } catch {
    addBot(localAnswer(q));
  } finally {
    $("#sendBtn").disabled = false;
  }
}

function wireMap() {
  const stage = $("#mapStage");
  $("#zoomIn").addEventListener("click", () => zoomBy(1.25));
  $("#zoomOut").addEventListener("click", () => zoomBy(0.8));
  $("#zoomFit").addEventListener("click", fitMap);
  $("#toggleLegend").addEventListener("click", () => {
    const legend = $("#legend");
    legend.hidden = !legend.hidden;
    $("#toggleLegend").classList.toggle("is-on", !legend.hidden);
  });
  $("#toggleEmbed").addEventListener("click", () => {
    const wrap = $("#embedWrap");
    const frame = $("#embedFrame");
    wrap.hidden = !wrap.hidden;
    $("#toggleEmbed").classList.toggle("is-on", !wrap.hidden);
    if (!wrap.hidden && !frame.src) frame.src = LIVE_MAP;
  });
  stage.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.12 : 0.9, e.clientX, e.clientY);
  }, { passive: false });
  stage.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    state.drag = { x: e.clientX - state.x, y: e.clientY - state.y };
    stage.classList.add("is-dragging");
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (!state.drag) return;
    state.x = e.clientX - state.drag.x;
    state.y = e.clientY - state.drag.y;
    applyTransform();
  });
  const endDrag = () => {
    state.drag = null;
    stage.classList.remove("is-dragging");
  };
  stage.addEventListener("pointerup", endDrag);
  stage.addEventListener("pointercancel", endDrag);
}

function wireChat() {
  $("#composer").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#chatInput");
    const text = input.value.trim();
    input.value = "";
    ask(text);
  });
  $("#chatInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      $("#composer").requestSubmit();
    }
  });

  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (Speech) {
    const mic = $("#micBtn");
    mic.hidden = false;
    let rec = null;
    mic.addEventListener("click", () => {
      if (rec) { rec.stop(); rec = null; mic.classList.remove("is-on"); return; }
      rec = new Speech();
      rec.lang = "en-US";
      rec.onresult = (ev) => {
        const text = ev.results?.[0]?.[0]?.transcript;
        if (text) ask(text);
      };
      rec.onend = () => { rec = null; mic.classList.remove("is-on"); };
      rec.start();
      mic.classList.add("is-on");
    });
  }
}

async function boot() {
  state.data = await fetch("/data/floorplan.json").then((r) => r.json());
  renderChips();
  renderPrompts();
  wireMap();
  wireChat();

  addSys("First screen is the living map — no marketing detour. Screenshot is primary; live Goeshow may block iframes.");

  try {
    const health = await fetch("/api/health").then((r) => r.json());
    state.configured = Boolean(health?.env?.OPENAI_API_KEY);
  } catch {
    state.configured = false;
  }

  const pill = $("#keyPill");
  if (state.configured) {
    pill.textContent = "LIVE CHAT READY";
    pill.classList.add("pill--ok");
    addBot("Ask about Halls A–C, pavilions, or an exhibitor from the official Goeshow list. I will not invent booth numbers.");
  } else {
    pill.textContent = "KEYWORD MODE · KEY NOT SET";
    pill.classList.add("pill--warn");
    addBot("OPENAI_API_KEY is not configured, so I am using canned FAQ and keyword search over the extracted hall / pavilion / exhibitor list. The map still works. Add the env name on Vercel for live grounded chat.");
  }
}

boot().catch((err) => {
  addSys("Map data failed to load. Refresh, or open the live Goeshow floorplan.");
  console.error(err);
});
