/**
 * Pure helpers for B3A Live.
 *
 * Everything in this file is side-effect free so it can be exercised from the
 * browser console (or a test runner) without touching the DOM or the network.
 */

export const HK_TZ = "Asia/Hong_Kong";

const LOCALES = { tc: "zh-HK", sc: "zh-CN", en: "en-HK" };

export function localeOf(lang) {
  return LOCALES[lang] || LOCALES.tc;
}

export function parseTime(iso) {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/**
 * Whole minutes until an ETA, floored so "1" never means "90 seconds".
 * Returns null for unparseable timestamps.
 */
export function minutesUntil(iso, now = Date.now()) {
  const t = parseTime(iso);
  if (t === null) return null;
  return Math.max(0, Math.floor((t - now) / 60000));
}

export function formatClock(iso, lang = "tc") {
  const t = typeof iso === "number" ? iso : parseTime(iso);
  if (t === null) return "—";
  return new Intl.DateTimeFormat(localeOf(lang), {
    timeZone: HK_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(t);
}

export function formatClockSeconds(iso, lang = "tc") {
  const t = typeof iso === "number" ? iso : parseTime(iso);
  if (t === null) return "—";
  return new Intl.DateTimeFormat(localeOf(lang), {
    timeZone: HK_TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(t);
}

/**
 * Turn raw Citybus ETA rows into a sorted, de-duplicated list.
 *
 * - keeps only the requested direction (`O` / `I`);
 * - ignores rows without a usable `eta`;
 * - drops departures that are more than `graceMs` in the past, unless
 *   `dropStale` is false (used when displaying an offline snapshot);
 * - de-duplicates repeated rows from the feed.
 */
export function normalizeEtas(rows, dir, now = Date.now(), opts = {}) {
  const dropStale = opts.dropStale !== false;
  const graceMs = opts.graceMs ?? 60000;
  const seen = new Set();
  const out = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || !row.eta) continue;
    if (row.dir && row.dir !== dir) continue;

    const at = parseTime(row.eta);
    if (at === null) continue;
    if (dropStale && at < now - graceMs) continue;

    const key = `${row.eta_seq ?? ""}|${row.eta}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      at,
      iso: row.eta,
      seq: Number(row.eta_seq) || 0,
      dest: {
        tc: row.dest_tc || "",
        sc: row.dest_sc || "",
        en: row.dest_en || "",
      },
      rmk: {
        tc: row.rmk_tc || "",
        sc: row.rmk_sc || "",
        en: row.rmk_en || "",
      },
      mins: Math.max(0, Math.floor((at - now) / 60000)),
    });
  }

  out.sort((a, b) => a.at - b.at);
  return out;
}

export function haversineKm(a, b) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Closest B3A stop in either direction, so a single tap can also flip the
 * direction tab to whichever side of the road is nearer.
 */
export function nearestStop(directions, lat, lng) {
  let best = null;
  for (const [dir, group] of Object.entries(directions || {})) {
    for (const stop of group.stops || []) {
      const km = haversineKm({ lat, lng }, { lat: stop.lat, lng: stop.lng });
      if (!best || km < best.km) best = { dir, stop, km };
    }
  }
  return best;
}

/** "#O/003261" -> { dir: "O", stopId: "003261" } */
export function parseHash(hash) {
  const match = /^#([OI])\/([0-9A-Za-z]+)$/.exec(hash || "");
  return match ? { dir: match[1], stopId: match[2] } : null;
}

export function buildHash(dir, stopId) {
  return `#${dir}/${stopId}`;
}

/** "富泰邨, 青山公路" -> ["富泰邨", "青山公路"] */
export function splitStopName(name) {
  const raw = String(name || "");
  const comma = raw.indexOf(",");
  if (comma === -1) return [raw, ""];
  return [raw.slice(0, comma).trim(), raw.slice(comma + 1).trim()];
}
