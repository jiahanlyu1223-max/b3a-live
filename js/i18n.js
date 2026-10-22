export const LANGS = ["tc", "sc", "en"];

export const LANG_LABEL = { tc: "繁", sc: "简", en: "EN" };

const STRINGS = {
  tc: {
    tagline: "城巴 · 實時到站",
    dirTo: "往 {place}",
    boarding: "上車站",
    stopN: "第 {n} 站",
    nearest: "定位最近車站",
    locate: "定位",
    favorite: "收藏此站",
    unfavorite: "取消收藏",
    refresh: "立即更新",
    updated: "已更新 {time}",
    loading: "載入中…",
    offline: "離線 · 顯示 {time} 的資料",
    retrying: "連線失敗，{s} 秒後重試",
    due: "即將到站",
    minute: "分鐘",
    next: "下一班",
    scheduled: "預定班次",
    empty: "暫時沒有預定班次",
    emptyHint: "深宵時段班次較疏，頁面會繼續自動更新。",
    loadError: "無法載入路線資料，請重新整理頁面。",
    etaAt: "到站 {time}",
    staleTag: "舊資料",
    footnote:
      "資料來源：DATA.GOV.HK 城巴實時到站 API · 每 45 秒自動更新 · 時間為香港時間",
    chooseStop: "選擇車站",
    search: "搜尋車站…",
    noResults: "找不到車站",
    favorites: "常用",
    allStops: "全部車站",
    close: "關閉",
    geoDenied: "無法取得位置，請手動選擇車站",
    geoUnsupported: "此瀏覽器不支援定位",
    geoFar: "最近車站距離約 {km} 公里",
    geoOk: "已切換到最近的車站",
    serviceNote: "實時資料由城巴提供，僅供參考。",
    past: "已過",
  },
  sc: {
    tagline: "城巴 · 实时到站",
    dirTo: "往 {place}",
    boarding: "上车站",
    stopN: "第 {n} 站",
    nearest: "定位最近车站",
    locate: "定位",
    favorite: "收藏此站",
    unfavorite: "取消收藏",
    refresh: "立即更新",
    updated: "已更新 {time}",
    loading: "加载中…",
    offline: "离线 · 显示 {time} 的数据",
    retrying: "连接失败，{s} 秒后重试",
    due: "即将到站",
    minute: "分钟",
    next: "下一班",
    scheduled: "预定班次",
    empty: "暂时没有预定班次",
    emptyHint: "深夜时段班次较疏，页面会继续自动更新。",
    loadError: "无法加载路线数据，请重新整理页面。",
    etaAt: "到站 {time}",
    staleTag: "旧数据",
    footnote:
      "数据来源：DATA.GOV.HK 城巴实时到站 API · 每 45 秒自动更新 · 时间为香港时间",
    chooseStop: "选择车站",
    search: "搜索车站…",
    noResults: "找不到车站",
    favorites: "常用",
    allStops: "全部车站",
    close: "关闭",
    geoDenied: "无法获取位置，请手动选择车站",
    geoUnsupported: "此浏览器不支持定位",
    geoFar: "最近车站距离约 {km} 公里",
    geoOk: "已切换到最近的车站",
    serviceNote: "实时数据由城巴提供，仅供参考。",
    past: "已过",
  },
  en: {
    tagline: "Citybus · live arrivals",
    dirTo: "To {place}",
    boarding: "Boarding stop",
    stopN: "Stop {n}",
    nearest: "Find nearest stop",
    locate: "Locate",
    favorite: "Save this stop",
    unfavorite: "Remove from saved",
    refresh: "Refresh",
    updated: "Updated {time}",
    loading: "Loading…",
    offline: "Offline · showing data from {time}",
    retrying: "Connection failed — retrying in {s}s",
    due: "Due",
    minute: "min",
    next: "NEXT",
    scheduled: "Scheduled",
    empty: "No scheduled arrivals right now",
    emptyHint: "Late-night service is sparse. This page keeps checking.",
    loadError: "Could not load route data. Please reload the page.",
    etaAt: "Arrives {time}",
    staleTag: "OLD",
    footnote:
      "Source: DATA.GOV.HK Citybus real-time ETA API · refreshes every 45 seconds · Hong Kong time",
    chooseStop: "Choose a stop",
    search: "Search stops…",
    noResults: "No stops found",
    favorites: "Saved",
    allStops: "All stops",
    close: "Close",
    geoDenied: "Location unavailable — please pick a stop",
    geoUnsupported: "Geolocation is not supported",
    geoFar: "Nearest stop is about {km} km away",
    geoOk: "Switched to the nearest stop",
    serviceNote: "Real-time data by Citybus. For reference only.",
    past: "Past",
  },
};

export function t(lang, key, vars) {
  const table = STRINGS[lang] || STRINGS.tc;
  let text = table[key] ?? STRINGS.tc[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export function hasString(lang, key) {
  return Boolean((STRINGS[lang] || {})[key]);
}
