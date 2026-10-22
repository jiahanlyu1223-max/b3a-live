import { fetchEtas, fetchStops } from "./api.js";
import {
  buildHash,
  formatClock,
  formatClockSeconds,
  nearestStop,
  normalizeEtas,
  parseHash,
} from "./core.js";
import { t } from "./i18n.js";
import {
  findStop,
  renderChrome,
  renderEmpty,
  renderEtas,
  renderFatal,
  renderFavorites,
  renderSkeleton,
  renderStatus,
  renderStopList,
  toast,
  updateFavoriteButton,
} from "./ui.js";
import {
  detectLang,
  loadState,
  rememberSnapshot,
  saveState,
  snapshotKey,
} from "./store.js";

const REFRESH_MS = 45000;
const TICK_MS = 15000;
const BACKOFF_MS = [15000, 30000, 60000];
const DEFAULT_STOPS = { O: "003261", I: "003262" };

const refs = {
  docTitle: document.querySelector("title"),
  tagline: document.getElementById("tagline"),
  title: document.getElementById("routeTitle"),
  dirButtons: [...document.querySelectorAll(".dir-tab")],
  langButtons: [...document.querySelectorAll(".lang-btn")],
  stopBar: document.getElementById("stopBtn"),
  boardingLabel: document.getElementById("boardingLabel"),
  stopName: document.getElementById("stopName"),
  stopDetail: document.getElementById("stopDetail"),
  stopSeq: document.getElementById("stopSeq"),
  locateBtn: document.getElementById("locateBtn"),
  favBtn: document.getElementById("favBtn"),
  favIcon: document.getElementById("favIcon"),
  quick: document.getElementById("quickStops"),
  refreshBtn: document.getElementById("refreshBtn"),
  dot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
  list: document.getElementById("etaList"),
  footnote: document.getElementById("footnote"),
  serviceNote: document.getElementById("serviceNote"),
  toast: document.getElementById("toast"),
  dialog: document.getElementById("stopDialog"),
  dialogTitle: document.getElementById("dialogTitle"),
  stopSearch: document.getElementById("stopSearch"),
  stopList: document.getElementById("stopList"),
  closeDialogBtn: document.getElementById("closeDialogBtn"),
  locateInDialog: document.getElementById("locateInDialog"),
};

const state = loadState();
if (!state.lang) state.lang = detectLang();
if (state.dir !== "I") state.dir = "O";
if (!state.stopId) state.stopId = state.stops[state.dir] || DEFAULT_STOPS[state.dir];

let data = null;
let refreshTimer = null;
let tickTimer = null;
let attempts = 0;
let requestToken = 0;
const view = { etas: [], stale: false, updatedAt: 0, signature: "" };

/* ---------------------------------------------------------------- rendering */

function paint(force = false) {
  const now = Date.now();
  if (view.stale) {
    renderEtas(refs, view.etas, state.lang, now, { stale: true });
    return;
  }
  const signature = view.etas
    .map((eta) => `${eta.iso}:${Math.floor((eta.at - now) / 60000)}`)
    .join("|");
  if (!force && signature === view.signature) return;
  view.signature = signature;
  renderEtas(refs, view.etas, state.lang, now);
}

function renderAll() {
  if (!data) return;
  renderChrome(refs, state, data);
  paint(true);
}

function describeError(err) {
  if (err && err.code === "TIMEOUT") return "timeout";
  return "network";
}

/* ------------------------------------------------------------------ refresh */

function schedule(ms) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refresh(), ms);
}

async function refresh() {
  if (!data) return;
  clearTimeout(refreshTimer);

  const token = ++requestToken;
  const dir = state.dir;
  const stopId = state.stopId;
  const hadData = view.etas.length > 0 && !view.stale;

  if (!hadData) renderStatus(refs, "loading", t(state.lang, "loading"));

  try {
    const { rows } = await fetchEtas(stopId);
    if (token !== requestToken) return;

    attempts = 0;
    view.etas = normalizeEtas(rows, dir);
    view.stale = false;
    view.updatedAt = Date.now();
    view.signature = "";

    rememberSnapshot(state, dir, stopId, { rows, fetchedAt: view.updatedAt });
    saveState(state);

    renderStatus(
      refs,
      "ok",
      t(state.lang, "updated", { time: formatClockSeconds(view.updatedAt, state.lang) })
    );
    paint(true);
    schedule(REFRESH_MS);
  } catch (err) {
    if (token !== requestToken) return;
    if (err && err.code !== "TIMEOUT") console.warn("[B3A] ETA request failed:", err);

    attempts += 1;
    const wait = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];
    const snapshot = state.snapshots[snapshotKey(dir, stopId)];

    if (snapshot && Array.isArray(snapshot.rows)) {
      view.etas = normalizeEtas(snapshot.rows, dir, Date.now(), { dropStale: false });
      view.stale = true;
      view.updatedAt = snapshot.fetchedAt || 0;
      renderStatus(
        refs,
        "warn",
        t(state.lang, "offline", {
          time: view.updatedAt ? formatClock(view.updatedAt, state.lang) : "—",
        })
      );
      paint(true);
    } else {
      view.etas = [];
      view.stale = false;
      view.updatedAt = 0;
      renderEmpty(refs, state.lang);
      renderStatus(
        refs,
        "err",
        t(state.lang, "retrying", { s: Math.round(wait / 1000) })
      );
    }
    schedule(wait);
  }
}

/* -------------------------------------------------------------- selections */

function defaultStopId(dir) {
  const group = data.directions[dir];
  if (!group) return null;
  const preferred = DEFAULT_STOPS[dir];
  if (group.stops.some((s) => s.id === preferred)) return preferred;
  return group.stops[group.stops.length - 1].id;
}

function selectStop(dir, stopId, opts = {}) {
  if (!data || !findStop(data, dir, stopId)) return;

  state.dir = dir;
  state.stopId = stopId;
  state.stops[dir] = stopId;
  saveState(state);

  if (opts.push !== false) {
    history.replaceState(null, "", buildHash(dir, stopId));
  }

  view.etas = [];
  view.stale = false;
  view.updatedAt = 0;
  view.signature = "";

  renderChrome(refs, state, data);
  renderSkeleton(refs);
  refresh();
}

function changeDir(dir) {
  if (!data) return;
  if (dir === state.dir) return;
  const stored = state.stops[dir];
  const stopId = stored && findStop(data, dir, stored) ? stored : defaultStopId(dir);
  selectStop(dir, stopId);
}

function toggleFavorite() {
  if (!data) return;
  const key = `${state.dir}:${state.stopId}`;
  const index = state.favorites.indexOf(key);
  if (index === -1) state.favorites.push(key);
  else state.favorites.splice(index, 1);
  saveState(state);
  updateFavoriteButton(refs, state);
  renderFavorites(refs, state, data);
  if (refs.dialog.open) renderStopList(refs, data, state, refs.stopSearch.value);
}

function setLang(lang) {
  if (!["tc", "sc", "en"].includes(lang)) return;
  state.lang = lang;
  saveState(state);
  renderAll();
  updateFavoriteButton(refs, state);
  if (refs.dialog.open) {
    refs.dialogTitle.textContent = t(lang, "chooseStop");
    refs.stopSearch.placeholder = t(lang, "search");
    refs.closeDialogBtn.setAttribute("aria-label", t(lang, "close"));
    refs.locateInDialog.textContent = t(lang, "nearest");
    renderStopList(refs, data, state, refs.stopSearch.value);
  }
}

/* ------------------------------------------------------------------ dialog */

function openDialog() {
  if (!data) return;
  refs.dialogTitle.textContent = t(state.lang, "chooseStop");
  refs.stopSearch.placeholder = t(state.lang, "search");
  refs.stopSearch.value = "";
  refs.locateInDialog.textContent = t(state.lang, "nearest");
  refs.closeDialogBtn.setAttribute("aria-label", t(state.lang, "close"));
  renderStopList(refs, data, state, "");
  refs.dialog.showModal();
  window.setTimeout(() => refs.stopSearch.focus(), 30);
}

function closeDialog() {
  if (refs.dialog.open) refs.dialog.close();
}

/* --------------------------------------------------------------- geolocate */

function locate() {
  if (!data) return;
  if (!("geolocation" in navigator)) {
    toast(refs, t(state.lang, "geoUnsupported"));
    return;
  }

  refs.locateBtn.classList.add("is-busy");
  refs.locateInDialog.classList.add("is-busy");

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      refs.locateBtn.classList.remove("is-busy");
      refs.locateInDialog.classList.remove("is-busy");
      const best = nearestStop(data.directions, pos.coords.latitude, pos.coords.longitude);
      if (!best) {
        toast(refs, t(state.lang, "geoDenied"));
        return;
      }
      if (best.km > 3) {
        toast(refs, t(state.lang, "geoFar", { km: best.km.toFixed(1) }));
      } else {
        toast(refs, t(state.lang, "geoOk"));
      }
      if (refs.dialog.open) closeDialog();
      selectStop(best.dir, best.stop.id);
    },
    () => {
      refs.locateBtn.classList.remove("is-busy");
      refs.locateInDialog.classList.remove("is-busy");
      toast(refs, t(state.lang, "geoDenied"));
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
  );
}

/* ------------------------------------------------------------------ events */

function bindEvents() {
  for (const btn of refs.dirButtons) {
    btn.addEventListener("click", () => changeDir(btn.dataset.dir));
    btn.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const next = event.key === "ArrowRight" ? "I" : "O";
      changeDir(next);
      refs.dirButtons.find((b) => b.dataset.dir === next)?.focus();
    });
  }

  for (const btn of refs.langButtons) {
    btn.addEventListener("click", () => setLang(btn.dataset.lang));
  }

  refs.refreshBtn.addEventListener("click", () => {
    refs.refreshBtn.classList.add("is-busy");
    refresh().finally(() => refs.refreshBtn.classList.remove("is-busy"));
  });

  refs.stopBar.addEventListener("click", openDialog);
  refs.favBtn.addEventListener("click", toggleFavorite);
  refs.locateBtn.addEventListener("click", locate);
  refs.locateInDialog.addEventListener("click", () => {
    closeDialog();
    locate();
  });
  refs.closeDialogBtn.addEventListener("click", closeDialog);

  refs.quick.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-stop]");
    if (!chip) return;
    selectStop(chip.dataset.dir, chip.dataset.stop);
  });

  refs.stopList.addEventListener("click", (event) => {
    const item = event.target.closest("[data-stop]");
    if (!item) return;
    closeDialog();
    selectStop(item.dataset.dir, item.dataset.stop);
  });

  refs.stopSearch.addEventListener("input", () => {
    renderStopList(refs, data, state, refs.stopSearch.value);
  });

  refs.dialog.addEventListener("click", (event) => {
    if (event.target === refs.dialog) closeDialog();
  });
  refs.dialog.addEventListener("close", () => refs.stopBar.focus());

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh();
    else clearTimeout(refreshTimer);
  });

  window.addEventListener("online", () => refresh());
  window.addEventListener("offline", () => {
    if (!view.updatedAt) return;
    renderStatus(
      refs,
      "warn",
      t(state.lang, "offline", { time: formatClock(view.updatedAt, state.lang) })
    );
  });

  window.addEventListener("hashchange", () => {
    if (!data) return;
    const hash = parseHash(location.hash);
    if (!hash) return;
    if (hash.dir === state.dir && hash.stopId === state.stopId) return;
    selectStop(hash.dir, hash.stopId, { push: false });
  });
}

/* -------------------------------------------------------------------- boot */

async function boot() {
  bindEvents();
  renderSkeleton(refs);
  renderStatus(refs, "loading", t(state.lang, "loading"));

  try {
    data = await fetchStops();
  } catch (err) {
    console.warn("[B3A] Could not load stops:", err);
    renderFatal(refs, state.lang);
    renderStatus(refs, "err", t(state.lang, "loadError"));
    return;
  }

  const hash = parseHash(location.hash);
  let dir = hash ? hash.dir : state.dir;
  let stopId = hash ? hash.stopId : state.stops[dir];
  if (!stopId || !findStop(data, dir, stopId)) stopId = defaultStopId(dir);
  if (!stopId) {
    dir = "O";
    stopId = data.directions.O.stops[0].id;
  }

  state.dir = dir;
  state.stopId = stopId;
  state.stops[dir] = stopId;
  saveState(state);

  if (!parseHash(location.hash)) {
    history.replaceState(null, "", buildHash(dir, stopId));
  }

  renderAll();
  refresh();

  clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    if (document.visibilityState === "visible") paint();
  }, TICK_MS);

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((err) => {
        console.warn("[B3A] Service worker registration failed:", err);
      });
    });
  }
}

boot();
