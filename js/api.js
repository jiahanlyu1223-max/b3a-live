const BASE = "https://rt.data.gov.hk/v2/transport/citybus";
const CO = "CTB";
const ROUTE = "B3A";

export class ApiError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = "ApiError";
    this.code = code;
  }
}

/**
 * Live ETAs for one stop. The API returns every direction serving the stop, so
 * callers must still filter by `dir` (see core.normalizeEtas).
 */
export async function fetchEtas(stopId, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${BASE}/eta/${CO}/${encodeURIComponent(stopId)}/${ROUTE}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new ApiError(`HTTP_${res.status}`, `HTTP ${res.status}`);
    const json = await res.json();
    if (!json || !Array.isArray(json.data)) {
      throw new ApiError("BAD_PAYLOAD", "Unexpected payload");
    }
    return {
      rows: json.data,
      generatedAt: json.generated_timestamp || null,
    };
  } catch (err) {
    if (err.name === "AbortError") throw new ApiError("TIMEOUT", "Request timed out");
    if (err instanceof ApiError) throw err;
    throw new ApiError("NETWORK", err.message);
  } finally {
    clearTimeout(timer);
  }
}

/** Static stop snapshot shipped with the app. */
export async function fetchStops() {
  const res = await fetch("data/stops.json");
  if (!res.ok) throw new ApiError(`HTTP_${res.status}`, `HTTP ${res.status}`);
  return res.json();
}
