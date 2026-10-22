import { formatClock, splitStopName } from "./core.js";
import { t } from "./i18n.js";

export function h(tag, props, ...children) {
  const node = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key === "dataset") Object.assign(node.dataset, value);
      else if (key === "aria") {
        for (const [name, val] of Object.entries(value)) {
          node.setAttribute(`aria-${name}`, String(val));
        }
      } else if (key.startsWith("on") && typeof value === "function") {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (value === true) {
        node.setAttribute(key, "");
      } else {
        node.setAttribute(key, String(value));
      }
    }
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function setDocumentLang(lang) {
  const map = { tc: "zh-HK", sc: "zh-CN", en: "en" };
  document.documentElement.lang = map[lang] || "zh-HK";
  document.documentElement.dataset.lang = lang;
}

export function renderChrome(refs, state, data) {
  const { lang } = state;
  const dir = data.directions[state.dir];
  const place = dir.endpoint.to[lang];

  setDocumentLang(lang);

  refs.tagline.textContent = t(lang, "tagline");
  refs.boardingLabel.textContent = t(lang, "boarding");
  refs.title.textContent = `${dir.endpoint.from[lang]} → ${place}`;
  refs.docTitle.textContent = `B3A · ${dir.endpoint.from[lang]} → ${place}`;
  refs.refreshBtn.textContent = t(lang, "refresh");
  refs.locateBtn.setAttribute("aria-label", t(lang, "nearest"));
  refs.locateBtn.title = t(lang, "nearest");
  refs.footnote.textContent = t(lang, "footnote");
  refs.serviceNote.textContent = t(lang, "serviceNote");

  for (const btn of refs.dirButtons) {
    const active = btn.dataset.dir === state.dir;
    btn.textContent = t(lang, "dirTo", { place: data.directions[btn.dataset.dir].endpoint.to[lang] });
    btn.setAttribute("aria-selected", String(active));
    btn.tabIndex = active ? 0 : -1;
    btn.classList.toggle("is-active", active);
  }

  const stop = findStop(data, state.dir, state.stopId);
  if (stop) {
    const [primary, detail] = splitStopName(stop.name[lang]);
    refs.stopName.textContent = primary;
    refs.stopDetail.textContent = detail || t(lang, "stopN", { n: stop.seq });
    refs.stopSeq.textContent = t(lang, "stopN", { n: stop.seq });
  }

  for (const btn of refs.langButtons) {
    const active = btn.dataset.lang === lang;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  }

  renderFavorites(refs, state, data);
  updateFavoriteButton(refs, state);
}

export function updateFavoriteButton(refs, state) {
  const key = `${state.dir}:${state.stopId}`;
  const saved = state.favorites.includes(key);
  refs.favBtn.setAttribute("aria-pressed", String(saved));
  refs.favBtn.classList.toggle("is-saved", saved);
  const label = t(state.lang, saved ? "unfavorite" : "favorite");
  refs.favBtn.setAttribute("aria-label", label);
  refs.favBtn.title = label;
  refs.favIcon.textContent = saved ? "★" : "☆";
}

export function renderFavorites(refs, state, data) {
  refs.quick.replaceChildren();
  const chips = state.favorites
    .map((key) => {
      const [dir, stopId] = key.split(":");
      const stop = findStop(data, dir, stopId);
      if (!stop) return null;
      const active = dir === state.dir && stopId === state.stopId;
      const [primary] = splitStopName(stop.name[state.lang]);
      return h(
        "button",
        {
          type: "button",
          class: "chip" + (active ? " is-active" : ""),
          dataset: { dir, stop: stopId },
          "aria-pressed": String(active),
          title: stop.name[state.lang],
        },
        h("span", { class: "chip-dir", text: dir === "O" ? "↗" : "↙" }),
        h("span", { text: primary })
      );
    })
    .filter(Boolean);

  refs.quick.hidden = chips.length === 0;
  refs.quick.append(...chips);
}

export function renderStatus(refs, kind, text) {
  refs.dot.className = `dot ${kind || ""}`.trim();
  refs.statusText.textContent = text;
}

export function renderSkeleton(refs) {
  const cards = [0, 1, 2].map(() =>
    h(
      "li",
      { class: "eta-card skeleton", "aria-hidden": "true" },
      h("div", { class: "sk-block sk-mins" }),
      h(
        "div",
        { class: "eta-main" },
        h("div", { class: "sk-block sk-line wide" }),
        h("div", { class: "sk-block sk-line" })
      )
    )
  );
  refs.list.replaceChildren(...cards);
}

export function renderEmpty(refs, lang) {
  refs.list.replaceChildren(
    h(
      "li",
      { class: "empty" },
      h("div", { class: "empty-title", text: t(lang, "empty") }),
      h("div", { class: "empty-hint", text: t(lang, "emptyHint") })
    )
  );
}

export function renderFatal(refs, lang) {
  refs.list.replaceChildren(
    h(
      "li",
      { class: "empty is-error" },
      h("div", { class: "empty-title", text: t(lang, "loadError") })
    )
  );
}

export function renderEtas(refs, etas, lang, now, opts = {}) {
  const stale = Boolean(opts.stale);
  if (!etas.length) {
    renderEmpty(refs, lang);
    return;
  }

  const cards = etas.map((eta, index) => {
    const past = eta.at < now;
    const mins = Math.max(0, Math.floor((eta.at - now) / 60000));
    const due = !stale && mins <= 0;
    const minsText = stale && past ? "—" : due ? t(lang, "due") : String(mins);
    const unitText = due ? "" : stale && past ? t(lang, "past") : t(lang, "minute");
    const dest = eta.dest[lang] || eta.dest.en || "";

    const clockLine = h(
      "div",
      { class: "eta-clock" },
      t(lang, "etaAt", { time: formatClock(eta.iso, lang) }),
      eta.rmk[lang] ? ` · ${eta.rmk[lang]}` : ` · ${t(lang, "scheduled")}`,
      stale ? h("span", { class: "tag tag-stale", text: t(lang, "staleTag") }) : null
    );

    return h(
      "li",
      { class: "eta-card" + (index === 0 && !stale ? " is-next" : "") + (stale ? " is-stale" : "") },
      h(
        "div",
        { class: "eta-mins" + (due ? " is-due" : "") + (stale && past ? " is-past" : "") },
        h("span", { class: "mins-value", text: minsText }),
        unitText ? h("span", { class: "mins-unit", text: unitText }) : null
      ),
      h(
        "div",
        { class: "eta-main" },
        h(
          "div",
          { class: "eta-dest" },
          `→ ${dest}`,
          index === 0 && !stale ? h("span", { class: "tag", text: t(lang, "next") }) : null
        ),
        clockLine
      )
    );
  });

  refs.list.replaceChildren(...cards);
}

export function renderStopList(refs, data, state, query) {
  const { lang } = state;
  const needle = String(query || "").trim().toLowerCase();

  const matches = (stop) =>
    !needle ||
    ["tc", "sc", "en"].some((code) =>
      (stop.name[code] || "").toLowerCase().includes(needle)
    );

  const buildItem = (dir, stop) => {
    const key = `${dir}:${stop.id}`;
    const saved = state.favorites.includes(key);
    const active = dir === state.dir && stop.id === state.stopId;
    const [primary, detail] = splitStopName(stop.name[lang]);
    return h(
      "li",
      null,
      h(
        "button",
        {
          type: "button",
          class: "stop-item" + (active ? " is-active" : ""),
          dataset: { dir, stop: stop.id },
        },
        h("span", { class: "stop-seq", text: stop.seq }),
        h(
          "span",
          { class: "stop-name" },
          h("span", { class: "stop-primary", text: primary }),
          detail ? h("span", { class: "stop-detail", text: detail }) : null
        ),
        h("span", { class: "stop-side", text: dir === "O" ? "↗" : "↙" }),
        saved ? h("span", { class: "stop-star", text: "★", "aria-hidden": "true" }) : null
      )
    );
  };

  const groups = [];
  const favKeys = new Set(state.favorites.filter((k) => k.startsWith(`${state.dir}:`)));
  const favs = data.directions[state.dir].stops.filter((s) => favKeys.has(`${state.dir}:${s.id}`));
  const rest = data.directions[state.dir].stops.filter((s) => !favKeys.has(`${state.dir}:${s.id}`));

  if (needle) {
    const all = data.directions[state.dir].stops.filter(matches);
    groups.push({ title: null, stops: all });
  } else {
    if (favs.length) groups.push({ title: t(lang, "favorites"), stops: favs });
    groups.push({ title: favs.length ? t(lang, "allStops") : null, stops: rest });
  }

  const nodes = [];
  for (const group of groups) {
    if (group.title) {
      nodes.push(h("li", { class: "group-title", text: group.title, role: "presentation" }));
    }
    for (const stop of group.stops) nodes.push(buildItem(state.dir, stop));
  }

  if (!nodes.length) {
    refs.stopList.replaceChildren(
      h("li", { class: "no-results", text: t(lang, "noResults") })
    );
    return;
  }
  refs.stopList.replaceChildren(...nodes);
}

export function findStop(data, dir, stopId) {
  return data.directions[dir]?.stops.find((s) => s.id === stopId) || null;
}

let toastTimer = null;
export function toast(refs, message) {
  refs.toast.textContent = message;
  refs.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => refs.toast.classList.remove("is-visible"), 2800);
}
