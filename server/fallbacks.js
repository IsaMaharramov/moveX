// Offline safety net for the four demo presets, used only if the OpenAI call fails.
// The API response is flagged source: "offline-fallback" so the UI is honest about it.
const d = (route, extra_buses, depot_origin, dispatch_time, estimated_crowd_reduction_pct, action = 'ADD', reason = '') => ({ route, action, extra_buses, depot_origin, dispatch_time, estimated_crowd_reduction_pct, reason })

export const FALLBACKS = {
  match_rain: {
    scenario_title: 'Qarabag FK match in the rain at Tofiq Bahramov Stadium',
    risk_severity: 'CRITICAL',
    weather_factor: 'Heavy rain: pedestrians switch to buses, demand roughly x1.5',
    egress_peak_window: '21:55-22:40',
    affected_routes: ['125', 'H1', '65'],
    affected_zones: ['Ganjlik', 'Stadium (Neftchilar)', '28 May'],
    briefing: 'Evening league match with about 29,000 expected and heavy rain forecast. Expect a severe arrival wave from 18:30 and a sharp egress peak after full-time.',
    tactical_rationale: 'Rain removes walking as an option for fans and commuters at the same time. Routes 125, H1 and 65 all pass the stadium, so they must be reinforced before the arrival wave, not after delays start.',
    recommended_dispatch: [d('125', 4, 'Korogllu Depot', '18:40', 38), d('H1', 3, 'Dernegul Depot', '18:45', 32), d('65', 2, 'Korogllu Depot', '18:50', 24), d('6', 1, 'Dernegul Depot', '17:30', 0, 'REMOVE', 'Quiet route in the west tonight; reassign to routes 125 and H1.')],
  },
  school_rush: {
    scenario_title: 'September 15 school opening: city-wide rush',
    risk_severity: 'CRITICAL',
    weather_factor: 'Dry, but all school-age and parent trips land in the same 07:30-09:00 window',
    egress_peak_window: '07:30-09:15 and 13:00-14:30',
    affected_routes: ['13', '6', '30', '65', '125'],
    affected_zones: ['Elmlar Akademiyasi', 'Nizami', 'Narimanov', 'Khatai'],
    briefing: 'First school day of the year. Residential-to-school routes will saturate and road gridlock will slow every bus, so delays compound.',
    tactical_rationale: 'Traffic congestion lowers bus speed exactly when demand peaks. Extra buses on residential feeders spread the load before the morning peak.',
    recommended_dispatch: [d('13', 4, 'Zig Depot', '06:50', 36), d('6', 3, 'Dernegul Depot', '06:50', 30), d('30', 3, 'Korogllu Depot', '07:00', 30), d('65', 2, 'Korogllu Depot', '07:00', 22), d('125', 2, 'Dernegul Depot', '07:10', 20)],
  },
  jan20: {
    scenario_title: "January 20 commemoration at Martyrs' Lane",
    risk_severity: 'HIGH',
    weather_factor: 'Cold winter day, some walkers will choose buses',
    egress_peak_window: '10:00-13:00',
    affected_routes: ['30', '125', '13'],
    affected_zones: ['Narimanov', 'Nizami', 'Khatai'],
    briefing: "Large flows to Martyrs' Lane and Parliament Avenue through the morning, with a return wave around midday.",
    tactical_rationale: 'Demand is concentrated on the Narimanov corridor and ends in a single return wave. Routes 30, 125 and 13 give the best coverage.',
    recommended_dispatch: [d('30', 3, 'Korogllu Depot', '08:30', 34), d('125', 3, 'Dernegul Depot', '08:30', 30), d('13', 2, 'Zig Depot', '08:45', 24)],
  },
  tbilisi_repairs: {
    scenario_title: 'Emergency repairs on Tbilisi Avenue',
    risk_severity: 'HIGH',
    weather_factor: 'No weather impact reported',
    egress_peak_window: '07:30-09:30 and 17:00-19:30',
    affected_routes: ['13', '6', '30'],
    affected_zones: ['Nizami', 'Elmlar Akademiyasi', 'Narimanov'],
    briefing: 'Lane closures on Tbilisi Avenue force detours. Buses will bunch and arrive late at the western stops during both rush hours.',
    tactical_rationale: 'Detours lengthen cycle times, so the same fleet delivers a lower frequency. Adding buses restores headways on affected routes.',
    recommended_dispatch: [d('13', 3, 'Zig Depot', '07:00', 28), d('6', 3, 'Dernegul Depot', '07:00', 26), d('30', 2, 'Korogllu Depot', '07:10', 20)],
  },
}
