# MoveX — Smart Transit for AYNA

> Predict crowding before it happens. Move buses where people will be.

MoveX is a hackathon prototype for **AYNA (Azerbaijan Land Transport Agency)** and the passengers of **Baku**. It turns bus delay into a live crowd signal, forecasts surges from events, weather, the calendar and news, and helps both sides act early:

- **Operators** see crowding on a live map and get AI-drafted dispatch plans they can approve route by route.
- **Passengers** get calmer-stop suggestions, an AI trip assistant, live timetables and reminders before their daily trips.

> **Prototype notice:** the fleet and crowd data are simulated. Weather, calendar and news are collected from the real internet, and the AI is real. In production, AYNA's GPS and delay feeds replace the simulator.

## Features

### AYNA Dispatch view (dark control room)
- Real street map of Baku with buses moving along real roads (routes snapped via OSRM).
- **Delay = crowd signal.** Crowd level comes strictly from bus delay: Low (under 5 min), Medium (5–9), Severe (10+).
- Live KPIs: buses on road, average delay, severe stops, estimated waiting passengers, delay saved.
- City events (match, concert, expo) with arrival/departure waves, AI forecast, **Dispatch +2 Buses**, and an AI plan button.
- **Autonomous Event Intelligence:** every 15 minutes the server collects weather, the Azerbaijani calendar and news, and GPT drafts a dispatch plan. It can *add* buses to busy routes and *reduce* buses on quiet ones.
- Plan card with per-route **Deploy** buttons, adjustable bus counts, "Apply all", depot departure times and simulated crowd-reduction percentages.
- Impact tab: peak-delay forecast chart, passenger-minutes saved, activity log.
- Test buttons to inject fake signals (storm, big match, road closure, Sept 15).

### Passenger view
- Nearest-stop warning and a calmer alternative with the minutes saved.
- **MoveX Assistant** (English, Azerbaijani, Russian): "I want to go to Port Baku Mall" gives a plan with up to one bus change, drawn on the map.
- **Bus intervals:** "give me intervals of bus 125" shows a stop-by-stop table with time ranges, consistent with the moving buses.
- **My routine:** save a weekly schedule, get a reminder 30 minutes before each trip, and let MoveX learn your usual route. Data is saved in the browser and on the server (sync code to restore).
- AI alert banner and map rings for routes the AI flags.

### Demo helpers
- Simulation clock with weekday picker, speed 1×/3×/10× and jump buttons.
- **Demo story:** a guided 7-step pitch tour (yellow button).

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS 3, Leaflet / react-leaflet, lucide-react |
| Backend | Node.js, Express 5, `node:sqlite` |
| AI | OpenAI `gpt-4o-mini` with structured JSON output and tool calling |
| Data sources | Open-Meteo (weather), RSS from Report.az and AZERTAC, Google News RSS, OpenStreetMap tiles, OSRM routing |

## Project structure

```
src/
  components/   UI: AdminView, PassengerView, TripChat, RoutinePanel, PlanCard, ...
  hooks/        useSimulation, useAutoIntel, useRoutines, useRoadPaths
  data/         mockEngine (simulated city), planner, timetable, routine
server/
  index.js      Express API + serves the built site
  autopilot.js  scheduled scan -> GPT dispatch plan
  collectors.js weather / calendar / news collection
  chat.js       passenger assistant (tool calling)
  refine.js     timing and crowd-reduction numbers from the simulation
  db.js         SQLite storage for routines
```

## Getting started

**Requirements:** Node.js 22.13 or newer, an OpenAI API key.

```bash
git clone <your-repo-url>
cd <repo>
npm install
```

Create a `.env` file in the project root (it is git-ignored):

```
OPENAI_API_KEY=your_key_here
```

Run the website and the API together:

```bash
npm run dev
```

Open http://localhost:5173. The API runs on port 3001 and the Vite dev server proxies `/api` to it.

Without an API key, the map, simulation, planner and timetables still work. The AI features show an error (the manual preset buttons fall back to offline plans).

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Website + API with live reload for the website |
| `npm run build` | Production build into `dist/` |
| `npm start` | Runs the API and serves the built site (`dist/`) on one port |
| `npm run lint` | Lint with Oxlint |

### Configuration

| Variable | Default | Meaning |
|---|---|---|
| `OPENAI_API_KEY` | none | Required for AI features |
| `PORT` | `3001` | API / production server port |
| `SCAN_MINUTES` | `15` | How often the autonomous scan runs |
| `DATA_DIR` | `server/data` | Where the SQLite file is stored |

## Deploy for free (one link)

The repo includes a Render blueprint (`render.yaml`). In Render, create a Web Service from this repo:

- **Build command:** `npm install --include=dev && npm run build`
- **Start command:** `npm start`
- **Environment:** `OPENAI_API_KEY` (your key) and `NODE_VERSION=22.13.0`

Free-tier notes: the service sleeps after about 15 minutes without visitors, and its disk is wiped on restart, so server-saved routines can reset (each browser keeps its own copy).

## Security

- The OpenAI key lives only in `.env` or the host's environment variables and is never sent to the browser. All AI calls go through the server.
- Never commit `.env`. It is listed in `.gitignore`.
- The sync code for saved routines works like a password.

## Limitations

- The bus fleet, delays and event crowds are simulated, not AYNA data. Coordinates are approximate.
- News collection works from headlines only and can miss events that get no coverage.
- Trip planning supports at most one bus change.
- Crowd-reduction percentages are simulation estimates, not measured results.

## Roadmap

- Replace the simulator with AYNA GPS and delay feeds.
- Official event calendars and ticket data.
- Native mobile app with push notifications.
- Move the database to PostgreSQL and add user accounts.

## Team

Built for a hackathon by the MoveX team.

## Testing

```bash
npm test          # 26 automated tests (logic + API), no key needed
npm run test:ai   # live tests against the real AI model (needs OPENAI_API_KEY)
npm run bench     # simulation benchmark: reactive dispatch vs MoveX
```

See [TESTING.md](TESTING.md) for what was tested, what broke and how it was fixed, and the comparison with today's way of working.
