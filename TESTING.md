# Quality testing report: MoveX

Run everything yourself:

```bash
npm test          # 26 automated tests, no OpenAI key needed
npm run test:ai   # 10 live tests against the real OpenAI model (costs a few cents, needs .env)
npm run bench     # simulation benchmark: today's way of working vs MoveX
```

## What we tested

| Area | How | Result |
|---|---|---|
| Crowd rule, simulation, fleet changes | 18 logic tests: crowd boundaries (4.99 / 5 / 9.99 / 10 min), delays stay in 0 to 20 min for a whole day with extreme fleet changes, bus counts never below 1, positions always inside Baku | 18/18 pass |
| Trip planner | Every leg uses stops that really belong to that route, for all 12 places; unreachable origin (300 km away) fails gracefully; short walks reported | pass (after fix 1) |
| Timetable | A bus really is at the stop at the predicted time (checked against the animated buses on 3 routes, both directions); more buses means a shorter interval; requests in English, Azerbaijani, Russian | pass |
| AI-plan post-processing | Timing rules, bounds, malformed times, unknown depots, REMOVE items, "never in the past" | pass (after fix 2) |
| Routines and storage | Invalid times, learned habit, warn vs all-clear, hostile or oversized documents sanitised | pass (after fix 3) |
| API | 8 tests against the real server with no key: bad input, wrong roles, oversized body, bad ids, path traversal, SQL-like ids, foreign website origin, key never in a response, rate limit | 8/8 pass (after fix 4) |
| Live AI | 10 tests on gpt-4o-mini: valid JSON 5/5 runs, plans use the stadium routes, prompt injection in text and in a fake news headline, invented places, Azerbaijani replies, grounding of replies in the planner, timetable request | 10/10 pass |
| Browser | Headless Edge render of the Dispatch view, Passenger view and My routine tab, checking for console errors | no errors |

AI latency over 13 live calls: median 4.6 s, slowest 7.2 s.

## What broke (and what we did)

Found by the tests above:
1. **Planner loop:** a trip with a bus change could end at the stop it started from (ride out and come back). Fixed.
2. **Buses told to leave in the past:** with a real "derby today" headline at 15:30, the plan said "leave depot 14:25". Fixed: late plans now start 5 minutes from now and show a red "Late start" warning.
3. **Time validation:** `25:99` was accepted as a valid time on both the browser and the server. Fixed with strict `HH:MM`.
4. **No rate limiting:** on a public link, anyone could spam the AI endpoints and drain the OpenAI budget. Fixed: 20 requests per minute per visitor and a daily cap; a test proves the 5th to 8th request get HTTP 429.

Found earlier while building and checking by hand and with the headless browser:
5. **White screen:** the dev server cached an empty `App.jsx`; later, a hook ran before the simulation existed ("Cannot access 'sim' before initialization"). Fixed.
6. **Fake-looking AI output:** every route got the same late time (22:30) and crowd reductions were round guesses (-20%, -30%, -40%). Fixed: timing and percentages are now computed from the simulation.
7. **Secret in git:** the OpenAI key had been committed. Fixed: key rotated, history rewritten and force-pushed, `.env` ignored.

## What is still wrong or untested

- **The simulator is our own model.** The benchmark below shows the logic behaves sensibly, not that buses in Baku behave this way. We have not tested with real AYNA data.
- **Predictive dispatch costs more buses** (see benchmark). The AI can over-provision.
- **Only a few attempts per attack.** Prompt injection was tried once in each of 2 places and the AI did not obey; that is not proof it is immune.
- **AI answers vary between runs.** All 5 repeated runs were valid, but we did not measure how much the bus counts differ.
- **News feeds are noisy.** A Formula 1 headline passed our keyword filter; the AI ignored it. Two feeds we tried (AzerNews, Trend) no longer work and were dropped.
- **Not tested:** real phones and small screens, Firefox and Safari, accessibility, many users at once, push notifications on a real device, the live deployed site over days, and clicking through the UI automatically (we only smoke-test that pages render).
- **Routine reminders only fire on the simulation clock** (use the preview buttons); they do not yet follow real time.
- **Free hosting** sleeps after 15 minutes and wipes the server database on restart.

## Comparison with how it is done today

Today, as we understand it (to be confirmed with AYNA): dispatch follows fixed timetables and is adjusted after dispatchers or passengers report crowding; passengers use general map apps that do not show crowding. We simulated an evening with three city events (17:30 to 24:00, 12 stops, 9 routes) under four ways of working:

| Strategy | Severe stop-minutes | Medium-or-worse stop-minutes | Peak delay | Extra bus-hours used |
|---|---|---|---|---|
| No early action | 70 | 425 | 16 min | 0 |
| Reactive human dispatcher (+2 buses after a stop turns Severe, 30 min to arrive) | 65 | 270 | 16 min | 11.3 |
| **MoveX predictive plan** (in position 150 min early) | **0** | **20** | **7.3 min** | 77 |
| MoveX, leaner timing (100 min early) | 0 | 30 | 7.3 min | 64.8 |

Reading: reacting after the problem appears barely helps the worst stops, because the surge is over before buses arrive. Planning ahead removes severe crowding in this simulation, at the price of roughly 6 to 7 times more extra bus-hours. The reactive policy settings (+2 buses, 30 minutes) are our assumptions.
