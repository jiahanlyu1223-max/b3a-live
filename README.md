# The B3A

At Fu Tai Estate I wait,
thirty seconds at a time,
the page breathing, the numbers
tumbling down toward *Due*.

Sixteen minutes of sky
over Castle Peak Road,
then the bus unfolds itself
out of the traffic
and the harbour
opens like a gate.

Shenzhen Bay Port —
the last stop,
the far shore,
the place the numbers
were counting to all along.

*Refresh. The next one is already coming.*

---

## B3A Live

A small, dependency-free web app for Citybus **B3A** (山景邨 ↔ 深圳灣口岸).
Plain HTML5, CSS and ES modules — no framework, no build step, no API key.

**Live:** <https://jiahanlyu1223-max.github.io/b3a-live/>

### Run it

```sh
python3 -m http.server 8765
```

Then open <http://localhost:8765/>.

ES modules and the service worker require `http://` (or `https://`); opening
`index.html` with `file://` will not work.

### What it does

- Live next-arrival ETAs from the DATA.GOV.HK Citybus API, refreshed every
  45 seconds while the tab is visible.
- Both directions, using the correct stop IDs: **003261** (富泰邨, outbound)
  and **003262** (富泰商場, inbound). The two sides of Castle Peak Road are
  different stops.
- Every stop on the route is selectable, with search.
- "Nearest stop" via geolocation (falls back to a toast if permission is
  denied) — it can also flip to the direction on the closer side of the road.
- Save stops as favourites; they appear as quick chips.
- 繁體中文 / 简体中文 / English, remembered across visits.
- Offline: the last successful snapshot is kept in `localStorage` and served
  with a clear "offline / old data" marker. The service worker caches the app
  shell, so the page still opens without a connection.
- Deep links: `#O/003261`, `#I/003262`.
- Accessibility: live regions, keyboard-operable tabs/dialog, reduced-motion
  support, light and dark colour schemes.

### Project layout

```
index.html               app shell
css/app.css              styles (dark/light, mobile bottom sheet)
js/app.js                controller: refresh loop, routing, location, dialog
js/api.js                Citybus ETA client with 8 s timeout
js/core.js               pure helpers (minutes, ETA normalisation, geo, hash)
js/i18n.js               tc / sc / en strings
js/store.js              localStorage state and snapshots
js/ui.js                 DOM rendering
data/stops.json          offline stop snapshot (route, names, coordinates)
scripts/sync_stops.py    regenerate data/stops.json from the API
tests/core.test.html     in-browser checks for js/core.js
sw.js                    app-shell cache + network-first ETAs
manifest.webmanifest     installable PWA metadata
icons/                   app icons (SVG + PNG)
bus.html                 original single-file version, kept for reference
```

### Data

The ETA endpoint is public and CORS-enabled:

```
GET https://rt.data.gov.hk/v2/transport/citybus/eta/CTB/{stop_id}/B3A
```

Responses carry `cache-control: max-age=45`, so the client polls at the same
cadence and backs off (15 s → 30 s → 60 s) when requests fail.

Refresh the bundled stop list after service changes:

```sh
python3 scripts/sync_stops.py
```

The Citybus feed lists inbound Fu Tai Shopping Centre twice; the script
de-duplicates by stop ID.

### Tests

Serve the folder, then open
<http://localhost:8765/tests/core.test.html>. The page runs the pure-function
checks and reports pass/fail. It needs no Node or package install.

### Limits

- The API provides arrival estimates only — there is no vehicle GPS, so this
  app does not pretend to show buses on a map.
- There is no official timetable in the API. The page shows upcoming ETAs and
  an honest empty state, not a fabricated schedule.
- Times are always rendered in `Asia/Hong_Kong`, even when the device is in
  another timezone.
- This is an unofficial client. Real-time data is provided by Citybus via
  DATA.GOV.HK and is for reference only.
