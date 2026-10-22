const KEY = "b3a.live.v1";
const MAX_SNAPSHOTS = 6;

const DEFAULTS = {
  lang: null,
  dir: "O",
  stops: {},
  favorites: [],
  snapshots: {},
};

export function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!raw || typeof raw !== "object") return { ...DEFAULTS };
    return {
      ...DEFAULTS,
      ...raw,
      stops: raw.stops && typeof raw.stops === "object" ? raw.stops : {},
      favorites: Array.isArray(raw.favorites) ? raw.favorites : [],
      snapshots: raw.snapshots && typeof raw.snapshots === "object" ? raw.snapshots : {},
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveState(state) {
  const { lang, dir, stops, favorites, snapshots } = state;
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ lang, dir, stops, favorites, snapshots })
    );
  } catch {
    /* Private mode or quota — the app still works, it just forgets. */
  }
}

export function snapshotKey(dir, stopId) {
  return `${dir}:${stopId}`;
}

export function rememberSnapshot(state, dir, stopId, snapshot) {
  const key = snapshotKey(dir, stopId);
  state.snapshots = { ...state.snapshots, [key]: snapshot };
  const keys = Object.keys(state.snapshots);
  if (keys.length > MAX_SNAPSHOTS) {
    const drop = keys
      .sort((a, b) => (state.snapshots[a].fetchedAt || 0) - (state.snapshots[b].fetchedAt || 0))
      .slice(0, keys.length - MAX_SNAPSHOTS);
    for (const old of drop) delete state.snapshots[old];
  }
  saveState(state);
}

export function detectLang() {
  const nav = (navigator.language || "zh-HK").toLowerCase();
  if (nav.startsWith("zh-cn") || nav.startsWith("zh-sg") || nav.startsWith("zh-hans")) {
    return "sc";
  }
  if (nav.startsWith("zh")) return "tc";
  return "en";
}
