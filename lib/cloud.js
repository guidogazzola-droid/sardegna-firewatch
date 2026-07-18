function toPercentage(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(Math.min(100, Math.max(0, parsed)));
}

function toIsoTime(value) {
  const text = String(value || "");
  if (!text) return null;
  const date = new Date(text.endsWith("Z") ? text : `${text}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function buildCloudFrames(data, points) {
  const locations = Array.isArray(data) ? data : [data];
  const framesByTime = new Map();

  locations.forEach((location, locationIndex) => {
    const point = points[locationIndex];
    if (!point) return;
    const times = location?.hourly?.time ?? [];
    const total = location?.hourly?.cloud_cover ?? [];
    const low = location?.hourly?.cloud_cover_low ?? [];
    const mid = location?.hourly?.cloud_cover_mid ?? [];
    const high = location?.hourly?.cloud_cover_high ?? [];

    times.forEach((timeValue, timeIndex) => {
      const time = toIsoTime(timeValue);
      const cover = toPercentage(total[timeIndex]);
      if (!time || cover === null) return;
      if (!framesByTime.has(time)) framesByTime.set(time, []);
      framesByTime.get(time).push({
        latitude: point.latitude,
        longitude: point.longitude,
        cover,
        low: toPercentage(low[timeIndex]),
        mid: toPercentage(mid[timeIndex]),
        high: toPercentage(high[timeIndex]),
      });
    });
  });

  return [...framesByTime.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([time, samples]) => ({
      time,
      averageCover: Math.round(samples.reduce((sum, sample) => sum + sample.cover, 0) / samples.length),
      samples,
    }));
}

export async function fetchCloudForecast({ points, hours = 25, fetchImpl = fetch }) {
  if (!Array.isArray(points) || !points.length || points.length > 30) {
    throw new Error("La griglia nuvole deve contenere da 1 a 30 punti.");
  }

  const forecastHours = Math.min(48, Math.max(2, Math.round(hours)));
  const params = new URLSearchParams({
    latitude: points.map((point) => point.latitude.toFixed(4)).join(","),
    longitude: points.map((point) => point.longitude.toFixed(4)).join(","),
    hourly: "cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high",
    forecast_hours: String(forecastHours),
    timezone: "UTC",
    cell_selection: "nearest",
  });
  const response = await fetchImpl(`https://api.open-meteo.com/v1/forecast?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);

  const frames = buildCloudFrames(await response.json(), points);
  if (!frames.length) throw new Error("Previsione della nuvolosita non disponibile.");
  return frames;
}
