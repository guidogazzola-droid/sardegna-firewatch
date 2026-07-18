const EARTH_RADIUS_KM = 6371;
const MAX_HISTORY_DAYS = 10;
const SMOKE_DRIFT_FACTOR = 0.3;

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeBearing(value) {
  return ((value % 360) + 360) % 360;
}

export function compassLabel(degrees) {
  if (!Number.isFinite(degrees)) return "n.d.";
  const labels = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return labels[Math.round(normalizeBearing(degrees) / 45) % labels.length];
}

export function buildWindGridPoints(bounds, rows = 4, columns = 5) {
  const { south, west, north, east } = bounds ?? {};
  if (
    ![south, west, north, east].every(Number.isFinite) ||
    north <= south ||
    east <= west
  ) {
    throw new Error("Limiti della griglia del vento non validi.");
  }

  const safeRows = Math.min(5, Math.max(2, Math.round(rows)));
  const safeColumns = Math.min(6, Math.max(2, Math.round(columns)));
  const latitudeStep = (north - south) / safeRows;
  const longitudeStep = (east - west) / safeColumns;
  const points = [];

  for (let row = 0; row < safeRows; row += 1) {
    for (let column = 0; column < safeColumns; column += 1) {
      points.push({
        latitude: Math.round((south + latitudeStep * (row + 0.5)) * 10_000) / 10_000,
        longitude: Math.round((west + longitudeStep * (column + 0.5)) * 10_000) / 10_000,
      });
    }
  }

  return points;
}

export function parseCurrentWindGrid(data, points) {
  const locations = Array.isArray(data) ? data : [data];

  return locations
    .map((location, index) => {
      const directionFrom = toNumber(location?.current?.wind_direction_10m);
      const speed = toNumber(location?.current?.wind_speed_10m);
      const gust = toNumber(location?.current?.wind_gusts_10m);
      const time = String(location?.current?.time || "");
      const point = points[index];
      if (!point || directionFrom === null || speed === null) return null;

      let observedAt = null;
      if (time) {
        const parsedTime = new Date(time.endsWith("Z") ? time : `${time}Z`);
        if (!Number.isNaN(parsedTime.getTime())) observedAt = parsedTime.toISOString();
      }

      return {
        latitude: point.latitude,
        longitude: point.longitude,
        speed: Math.round(speed * 10) / 10,
        gust: gust === null ? null : Math.round(gust * 10) / 10,
        directionFrom: Math.round(normalizeBearing(directionFrom)),
        directionTo: Math.round(normalizeBearing(directionFrom + 180)),
        observedAt,
      };
    })
    .filter(Boolean);
}

export async function fetchCurrentWindGrid({ points, fetchImpl = fetch }) {
  if (!Array.isArray(points) || !points.length || points.length > 30) {
    throw new Error("La griglia del vento deve contenere da 1 a 30 punti.");
  }

  const params = new URLSearchParams({
    latitude: points.map((point) => point.latitude.toFixed(4)).join(","),
    longitude: points.map((point) => point.longitude.toFixed(4)).join(","),
    current: "wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    wind_speed_unit: "kmh",
    timezone: "UTC",
    forecast_days: "1",
  });
  const response = await fetchImpl(`https://api.open-meteo.com/v1/forecast?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);

  return parseCurrentWindGrid(await response.json(), points);
}

export function summarizeWind(samples) {
  const valid = samples.filter(
    (sample) => Number.isFinite(sample.speed) && Number.isFinite(sample.direction),
  );
  if (!valid.length) return null;

  let east = 0;
  let north = 0;
  let speedTotal = 0;
  let maxSpeed = 0;
  let maxGust = 0;

  for (const sample of valid) {
    const radians = (sample.direction * Math.PI) / 180;
    const weight = Math.max(sample.speed, 0.1);
    east += Math.sin(radians) * weight;
    north += Math.cos(radians) * weight;
    speedTotal += sample.speed;
    maxSpeed = Math.max(maxSpeed, sample.speed);
    if (Number.isFinite(sample.gust)) maxGust = Math.max(maxGust, sample.gust);
  }

  const windFromDegrees = normalizeBearing((Math.atan2(east, north) * 180) / Math.PI);
  const smokeToDegrees = normalizeBearing(windFromDegrees + 180);

  return {
    averageSpeed: Math.round((speedTotal / valid.length) * 10) / 10,
    maxSpeed: Math.round(maxSpeed * 10) / 10,
    maxGust: Math.round(maxGust * 10) / 10,
    windFromDegrees: Math.round(windFromDegrees),
    windFromLabel: compassLabel(windFromDegrees),
    smokeToDegrees: Math.round(smokeToDegrees),
    smokeToLabel: compassLabel(smokeToDegrees),
    sampleCount: valid.length,
  };
}

export function destinationPoint(latitude, longitude, bearingDegrees, distanceKm) {
  const angularDistance = distanceKm / EARTH_RADIUS_KM;
  const bearing = (bearingDegrees * Math.PI) / 180;
  const lat1 = (latitude * Math.PI) / 180;
  const lon1 = (longitude * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return [
    Math.round(((lat2 * 180) / Math.PI) * 100_000) / 100_000,
    Math.round(normalizeLongitude((lon2 * 180) / Math.PI) * 100_000) / 100_000,
  ];
}

function normalizeLongitude(value) {
  return ((value + 540) % 360) - 180;
}

export function buildSmokeTrack(latitude, longitude, samples) {
  const track = [[latitude, longitude]];
  let currentLat = latitude;
  let currentLon = longitude;

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    if (!Number.isFinite(sample.speed) || !Number.isFinite(sample.direction)) continue;

    const nextTime = samples[index + 1]?.time;
    const currentTime = new Date(sample.time).getTime();
    const nextMillis = nextTime ? new Date(nextTime).getTime() : currentTime + 3_600_000;
    const hours = Math.min(3, Math.max(0.25, (nextMillis - currentTime) / 3_600_000));
    const distanceKm = sample.speed * hours * SMOKE_DRIFT_FACTOR;
    [currentLat, currentLon] = destinationPoint(
      currentLat,
      currentLon,
      normalizeBearing(sample.direction + 180),
      distanceKm,
    );
    track.push([currentLat, currentLon]);
  }

  return track;
}

export function parseWindPayload(data, startAt, now = new Date()) {
  const times = data?.hourly?.time ?? [];
  const speeds = data?.hourly?.wind_speed_10m ?? [];
  const directions = data?.hourly?.wind_direction_10m ?? [];
  const gusts = data?.hourly?.wind_gusts_10m ?? [];
  const startMillis = new Date(startAt).getTime();
  const endMillis = now.getTime();

  return times
    .map((time, index) => ({
      time: new Date(time.endsWith("Z") ? time : `${time}Z`).toISOString(),
      speed: toNumber(speeds[index]),
      direction: toNumber(directions[index]),
      gust: toNumber(gusts[index]),
    }))
    .filter((sample) => {
      const time = new Date(sample.time).getTime();
      return (
        time >= startMillis &&
        time <= endMillis &&
        sample.speed !== null &&
        sample.direction !== null
      );
    });
}

export async function fetchWindHistory({
  latitude,
  longitude,
  startAt,
  now = new Date(),
  fetchImpl = fetch,
}) {
  const requestedStart = new Date(startAt);
  if (Number.isNaN(requestedStart.getTime())) throw new Error("Data iniziale non valida.");

  const oldest = new Date(now.getTime() - MAX_HISTORY_DAYS * 86_400_000);
  const effectiveStart = requestedStart < oldest ? oldest : requestedStart;
  const elapsedDays = Math.max(1, Math.ceil((now.getTime() - effectiveStart.getTime()) / 86_400_000) + 1);
  const pastDays = Math.min(MAX_HISTORY_DAYS, elapsedDays);
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    hourly: "wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    wind_speed_unit: "kmh",
    timezone: "UTC",
    past_days: String(pastDays),
    forecast_days: "1",
  });

  const response = await fetchImpl(`https://api.open-meteo.com/v1/forecast?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);

  const data = await response.json();
  const samples = parseWindPayload(data, effectiveStart, now);
  const summary = summarizeWind(samples);
  if (!summary) throw new Error("Storico del vento non disponibile per questo intervallo.");

  return {
    requestedStartAt: requestedStart.toISOString(),
    startAt: effectiveStart.toISOString(),
    endAt: now.toISOString(),
    truncated: requestedStart < oldest,
    units: {
      speed: data?.hourly_units?.wind_speed_10m ?? "km/h",
      direction: data?.hourly_units?.wind_direction_10m ?? "°",
    },
    summary,
    samples,
    smokeTrack: buildSmokeTrack(latitude, longitude, samples),
    methodology: {
      source: "Open-Meteo Forecast API · modelli meteorologici assimilati",
      smokeDirection: "direzione del vento invertita di 180°",
      track: "traiettoria indicativa a 10 m con fattore di deriva 0,30; non e un modello di dispersione",
    },
  };
}
