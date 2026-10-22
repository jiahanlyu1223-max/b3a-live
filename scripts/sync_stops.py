#!/usr/bin/env python3
"""Snapshot the B3A stop list from the DATA.GOV.HK Citybus API.

Run from the project root:

    python3 scripts/sync_stops.py

Writes data/stops.json. The app loads that file first, so it can render the
full route instantly (and offline) before the live ETA request comes back.
"""

import json
import pathlib
import urllib.request

BASE = "https://rt.data.gov.hk/v2/transport/citybus"
CO = "CTB"
ROUTE = "B3A"
DIRECTIONS = ("O", "I")
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "stops.json"


def get(path):
    with urllib.request.urlopen(BASE + path, timeout=15) as res:
        return json.load(res)["data"]


def main():
    names = {}
    dirs = {}
    route = get(f"/route/{CO}/{ROUTE}")
    endpoints = {
        "O": {"from": "orig", "to": "dest"},
        "I": {"from": "dest", "to": "orig"},
    }

    for d in DIRECTIONS:
        path = "/inbound" if d == "I" else "/outbound"
        rows = get(f"/route-stop/{CO}/{ROUTE}{path}")
        stops = []
        seen = set()
        for row in rows:
            stop_id = row["stop"]
            # The inbound feed lists Fu Tai Shopping Centre twice (seq 2 and 3);
            # keep the first occurrence only.
            if stop_id in seen:
                continue
            seen.add(stop_id)
            if stop_id not in names:
                names[stop_id] = get(f"/stop/{stop_id}")
            info = names[stop_id]
            stops.append(
                {
                    "id": stop_id,
                    "seq": row["seq"],
                    "name": {
                        "tc": info["name_tc"],
                        "sc": info["name_sc"],
                        "en": info["name_en"],
                    },
                    "lat": round(float(info["lat"]), 6),
                    "lng": round(float(info["long"]), 6),
                }
            )
        dirs[d] = {
            "origin": stops[0]["name"],
            "dest": stops[-1]["name"],
            "endpoint": {
                "from": {
                    "tc": route[f"{endpoints[d]['from']}_tc"],
                    "sc": route[f"{endpoints[d]['from']}_sc"],
                    "en": route[f"{endpoints[d]['from']}_en"],
                },
                "to": {
                    "tc": route[f"{endpoints[d]['to']}_tc"],
                    "sc": route[f"{endpoints[d]['to']}_sc"],
                    "en": route[f"{endpoints[d]['to']}_en"],
                },
            },
            "stops": stops,
        }

    payload = {
        "route": ROUTE,
        "company": CO,
        "source": "DATA.GOV.HK Citybus real-time API",
        "directions": dirs,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    for d in DIRECTIONS:
        print(f"{d}: {len(dirs[d]['stops'])} stops")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
