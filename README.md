# AF&B Living Map

Landscape **talk-to-map** demo for the **Americas Food & Beverage Show & Conference (AF&B) — 30th Anniversary**.

Stephanie (PowerWyze CEO) pre-approved 2026-09-08. This is **not** a 1080×1920 portrait kiosk. First screen is the living map — no marketing landing detour.

Related internal work: **DEMO-002 Buyer Discovery Station / T-021**.

## Event

Confirmed on [americasfoodandbeverage.com](https://www.americasfoodandbeverage.com/):

- Dates: **September 14–16, 2026**
- Venue: **Miami Beach Convention Center (MBCC)**
- Country of Honor: **United States** — *A Taste of the States: Miami* (NASDA / USDA FAS)

Street address **1901 Convention Center Drive** is intake and should be treated as provisional until a human checks the official travel page.

## What it does

1. Primary visual: captured Goeshow floorplan (`public/assets/afb-floorplan.png`) with pan / zoom and landmark overlays.
2. **Open live floorplan** → [maps.goeshow.com/atec/amfoodbev/2026/Floorplan](https://maps.goeshow.com/atec/amfoodbev/2026/Floorplan). Optional iframe (Goeshow may block framing).
3. Chat: “Talk to the map.” Grounded in halls / pavilions from the screenshot plus the official Goeshow exhibitor list. **Never invents booth numbers.**
4. Clean degrade if `OPENAI_API_KEY` is missing: map + canned FAQ + keyword search over the extracted dataset. Chat explains the key is not configured.

## Grounding

`public/data/floorplan.json`

- Halls A / B / C and labeled zones (Beverage Pavilion, Food Court, Brazil, Taste of the States, Center Stage, Beer Lounge, Buyer’s Lounge, country pavilions, etc.) from the floorplan capture. Overlay boxes are **visual estimates** with confidence labels.
- **906** exhibitor name + booth records from the official list scrape on 2026-09-08: [exhibitor_list.cfm](https://s1.goeshow.com/atec/amfoodbev/2026/exhibitor_list.cfm).
- Hall assignment is attached only when the screenshot and list agree (e.g. ABIMAPI 429 in Brazil / Hall A, HapCor 463 in Hall B, Atlantic Grocery Supply 1809 in Hall C, Japan Pavilion 1625 in Hall C).
- Legend: Sold (green), Pending (yellow), Available, Reserved (orange).

If a fact is not in that file, the assistant must say so and point to the live Goeshow map.

## Repo shape

```
public/index.html
public/app.js
public/styles.css
public/data/floorplan.json
public/assets/           logo.svg, afb-floorplan.png
api/chat.js              POST /api/chat
api/health.js            GET /api/health (OPENAI_API_KEY boolean only)
lib/grounding.js
package.json
vercel.json
```

## APIs

| Method | Path | Role |
| --- | --- | --- |
| `POST` | `/api/chat` | OpenAI chat completions with floorplan system prompt, or keyword fallback |
| `GET` | `/api/health` | `{ ok: true, env: { OPENAI_API_KEY: boolean } }` — never values |

## Environment

Copy **by name** on Vercel. Never commit values.

| Name | Role |
| --- | --- |
| `OPENAI_API_KEY` | Live grounded chat. If absent, UI + keyword search still work. |

## Design

Desktop-first split: map panel \| chat panel. Responsive stack on phone. PowerWyze dark gold chrome. English first.

## Deploy

Vercel project slug: `afb-living-map` · team `powerwyzes-projects` (`team_ko928SKsu56IUwWOxDpRNEW4`).
