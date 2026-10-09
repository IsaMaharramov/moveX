// Automatic data collection for MoveX: weather, Azerbaijani calendar, and news from the open web.
// Every collector returns { name, ok, signals[], error? } and never throws.
import { XMLParser } from 'fast-xml-parser'

const UA = 'Mozilla/5.0 (compatible; MoveX-AYNA-prototype/1.0)'
const xml = new XMLParser({ ignoreAttributes: false })
const BAKU = { lat: 40.4093, lon: 49.8671 }
const MAX_AGE_H = 72

async function get(url, ms = 12000) {
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(ms), redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

export function bakuNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Baku', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'long',
  }).formatToParts(new Date())
  const o = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return { iso: `${o.year}-${o.month}-${o.day}`, time: `${o.hour === '24' ? '00' : o.hour}:${o.minute}`, weekday: o.weekday, year: +o.year, month: +o.month, day: +o.day }
}

// ---------- weather (Open-Meteo, no key) ----------
export async function collectWeather() {
  const name = 'Open-Meteo weather'
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${BAKU.lat}&longitude=${BAKU.lon}&hourly=precipitation,snowfall,temperature_2m,wind_speed_10m&current=temperature_2m,precipitation&forecast_days=2&timezone=Asia%2FBaku`
    const j = JSON.parse(await get(url))
    const now = bakuNow()
    const h = j.hourly
    const start = Math.max(0, h.time.findIndex((t) => t >= `${now.iso}T${now.time.slice(0, 2)}:00`))
    const next = (arr) => arr.slice(start, start + 24)
    const precip = next(h.precipitation)
    const snow = next(h.snowfall)
    const temp = next(h.temperature_2m)
    const wind = next(h.wind_speed_10m)
    const maxRate = Math.max(...precip)
    const total = precip.reduce((a, b) => a + b, 0)
    const snowTotal = snow.reduce((a, b) => a + b, 0)
    const peakHour = h.time[start + precip.indexOf(maxRate)]?.slice(11, 16)
    const stats = { maxRainMmH: +maxRate.toFixed(1), totalRainMm: +total.toFixed(1), snowCm: +snowTotal.toFixed(1), minTempC: Math.round(Math.min(...temp)), maxWindKmH: Math.round(Math.max(...wind)), peakHour }

    let severity = 'none'
    let text = `Dry next 24h, ${stats.minTempC}-${Math.round(Math.max(...temp))}°C`
    if (snowTotal >= 1) { severity = snowTotal >= 5 ? 'severe' : 'moderate'; text = `Snow expected: ${stats.snowCm} cm in next 24h, min ${stats.minTempC}°C` }
    else if (maxRate >= 4 || total >= 10) { severity = 'severe'; text = `Heavy rain: up to ${stats.maxRainMmH} mm/h around ${peakHour}, ${stats.totalRainMm} mm total in 24h` }
    else if (total >= 2) { severity = 'moderate'; text = `Rain expected: ${stats.totalRainMm} mm in next 24h (peak ${peakHour})` }
    else if (stats.maxWindKmH >= 50) { severity = 'moderate'; text = `Strong wind up to ${stats.maxWindKmH} km/h` }
    const signals = [{ type: 'weather', title: `Weather forecast for Baku: ${text}`, source: name, url: 'https://open-meteo.com', published: new Date().toISOString(), severity, stats }]
    return { name, ok: true, signals, weather: { text, severity, ...stats, currentTempC: j.current?.temperature_2m } }
  } catch (e) {
    return { name, ok: false, signals: [], error: e.message }
  }
}

// ---------- Azerbaijani calendar (built-in, there is no open API for this) ----------
const CALENDAR = [
  { m: 1, d: 1, n: 'New Year holiday', effect: 'Evening and night celebrations downtown' },
  { m: 1, d: 20, n: "National Mourning Day (Black January)", effect: "Mass flow to Martyrs' Lane and Parliament Avenue" },
  { m: 3, d: 8, n: "International Women's Day", effect: 'Holiday shopping and flower trips, evening peaks' },
  { m: 3, d: 20, n: 'Novruz holiday period', effect: 'Fairs and celebrations, heavy crowds at Fountain Square and parks' },
  { m: 5, d: 9, n: 'Victory over fascism day', effect: 'Public gatherings' },
  { m: 5, d: 28, n: 'Independence Day', effect: 'Military parade, concerts and crowds downtown' },
  { m: 6, d: 15, n: 'National Salvation Day', effect: 'Ceremonies and gatherings' },
  { m: 6, d: 26, n: 'Armed Forces Day', effect: 'Ceremonies and gatherings' },
  { m: 9, d: 15, n: 'First day of school (Bilik Gunu)', effect: 'City-wide gridlock, surge on residential-to-school routes' },
  { m: 9, d: 27, n: 'Remembrance Day', effect: "Flow to Martyrs' Lane" },
  { m: 11, d: 8, n: 'Victory Day', effect: 'Ceremonies, flow to Victory Park and Flag Square' },
  { m: 11, d: 9, n: 'National Flag Day', effect: 'Ceremonies at Flag Square' },
  { m: 11, d: 12, n: 'Constitution Day', effect: 'Public gatherings' },
  { m: 12, d: 31, n: "New Year's Eve", effect: 'Night-time surge toward downtown' },
]

export function collectCalendar() {
  const name = 'Azerbaijan calendar'
  const now = bakuNow()
  const today = Date.UTC(now.year, now.month - 1, now.day)
  const signals = []
  for (const e of CALENDAR) {
    for (const y of [now.year, now.year + 1]) {
      const days = Math.round((Date.UTC(y, e.m - 1, e.d) - today) / 86400000)
      if (days >= 0 && days <= 7) {
        const when = days === 0 ? 'TODAY' : days === 1 ? 'tomorrow' : `in ${days} days`
        signals.push({ type: 'calendar', title: `${e.n} ${when} (${y}-${String(e.m).padStart(2, '0')}-${String(e.d).padStart(2, '0')}): ${e.effect}`, source: name, url: null, published: new Date().toISOString(), daysAway: days })
      }
    }
  }
  if (['Saturday', 'Sunday'].includes(now.weekday)) {
    signals.push({ type: 'calendar', title: `Today is ${now.weekday}: leisure travel pattern, fewer commuters, more evening trips to malls and the seafront`, source: name, url: null, published: new Date().toISOString() })
  }
  return { name, ok: true, signals }
}

// ---------- news (RSS from several outlets + Google News searches) ----------
const FEEDS = [
  { name: 'Report.az (EN)', url: 'https://report.az/en/rss/' },
  { name: 'Report.az (AZ)', url: 'https://report.az/rss/' },
  { name: 'AZERTAC (EN)', url: 'https://azertag.az/en/rss' },
  { name: 'Google News: events', url: 'https://news.google.com/rss/search?q=Baku+(stadium+OR+concert+OR+festival+OR+match+OR+exhibition+OR+marathon+OR+rally+OR+%22Qarabag%22)+when:2d&hl=en&gl=AZ&ceid=AZ:en' },
  { name: 'Google News: roads (EN)', url: 'https://news.google.com/rss/search?q=Baku+(%22road+closure%22+OR+%22road+repair%22+OR+traffic+OR+roadworks+OR+detour+OR+%22bus+route%22)+when:2d&hl=en&gl=AZ&ceid=AZ:en' },
  { name: 'Google News: roads (AZ)', url: 'https://news.google.com/rss/search?q=Bak%C4%B1+(t%C9%99mir+OR+t%C4%B1xac+OR+%22yol+h%C9%99r%C9%99k%C9%99ti%22+OR+stadion+OR+konsert)+when:2d&hl=az&gl=AZ&ceid=AZ:az' },
]

const KEYWORDS = new RegExp([
  'stadium|match|football|concert|festival|exhibition|expo|forum|summit|conference|rally|marathon|parade|grand prix|formula|ceremony|commemorat|qarabag|neftchi|traffic|road|closure|closed|repair|construction|roadworks|detour|bus|metro|snow|rain|storm|flood|fog|school|holiday',
  'stadion|oyun|matç|konsert|festival|sərgi|forum|mərasim|yürüş|marafon|yarış|yol|təmir|tıxac|bağlan|hərəkət|avtobus|metro|qar|yağış|külək|sel|duman|məktəb|bayram|anım|tədbir',
  'стадион|матч|концерт|фестиваль|выставк|ремонт|пробк|перекр|дорог|автобус|снег|дожд|школ',
].join('|'), 'i')
const BAKU_HINT = /baku|bakı|баку|tofiq|olimp|crystal|heydar|nizami|narimanov|nərimanov|28 may|ganjlik|gənclik|khatai|xətai|yasamal|sahil|azadlıq|tbilisi|babek|nobel|8 noyabr|aznews|qarabag|qarabağ|neftchi|neftçi/i

function text(v) {
  if (v == null) return ''
  if (typeof v === 'object') return String(v['#text'] ?? '')
  return String(v)
}

async function collectFeed(feed) {
  try {
    const x = xml.parse(await get(feed.url))
    let items = x?.rss?.channel?.item ?? []
    if (!Array.isArray(items)) items = [items]
    const isGoogle = feed.name.startsWith('Google')
    const signals = []
    for (const it of items) {
      const title = text(it.title).replace(/\s+/g, ' ').trim()
      const published = new Date(text(it.pubDate))
      if (!title || Number.isNaN(published.getTime())) continue
      if ((Date.now() - published.getTime()) / 36e5 > MAX_AGE_H) continue
      if (!KEYWORDS.test(title)) continue
      if (!isGoogle && !BAKU_HINT.test(title)) continue // national feeds: keep Baku-relevant items only
      const src = isGoogle && it.source ? text(it.source) : feed.name
      signals.push({ type: 'news', title: title.slice(0, 220), source: src, url: text(it.link) || null, published: published.toISOString() })
    }
    return { name: feed.name, ok: true, signals }
  } catch (e) {
    return { name: feed.name, ok: false, signals: [], error: e.message }
  }
}

export async function collectAll() {
  const [weather, ...news] = await Promise.all([collectWeather(), ...FEEDS.map(collectFeed)])
  const calendar = collectCalendar()
  const sources = [weather, calendar, ...news]

  // de-duplicate near-identical headlines, newest first, cap for the model
  const seen = new Set()
  const newsSignals = news.flatMap((n) => n.signals)
    .sort((a, b) => new Date(b.published) - new Date(a.published))
    .filter((s) => { const k = s.title.toLowerCase().replace(/[^a-zа-яəğıöşüç0-9]/g, '').slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true })
    .slice(0, 30)
  const signals = [...weather.signals, ...calendar.signals, ...newsSignals].map((s, i) => ({ id: i + 1, ...s }))

  return {
    weather: weather.weather ?? null,
    signals,
    sources: sources.map((s) => ({ name: s.name, ok: s.ok, count: s.signals.length, error: s.error })),
  }
}
