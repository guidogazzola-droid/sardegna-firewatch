const SARDINIA_BOUNDS = [
  [38.7, 7.7],
  [41.4, 10.2],
];
const SARDINIA_CENTER = [40.02, 9.05];
const DEFAULT_REFRESH_SECONDS = 300;
const STORAGE_KEYS = {
  watch: "sardegna-firewatch-watch-v1",
  notifications: "sardegna-firewatch-notifications-v1",
  alerted: "sardegna-firewatch-alerted-v1",
};

const state = {
  map: null,
  pointLayer: null,
  watchLayer: null,
  markers: new Map(),
  effisLayers: {},
  fires: [],
  filteredFires: [],
  days: 1,
  sourceGroup: "viirs",
  confidence: new Set(["high", "nominal"]),
  refreshSeconds: DEFAULT_REFRESH_SECONDS,
  nextRefreshAt: null,
  refreshTimeout: null,
  countdownInterval: null,
  isRefreshing: false,
  firmsConfigured: false,
  hasLoadedOnce: false,
  currentFeedIds: new Set(),
  pickMode: false,
  watch: readJson(STORAGE_KEYS.watch, null),
  notificationsEnabled: readJson(STORAGE_KEYS.notifications, false),
  alertedIds: new Set(readJson(STORAGE_KEYS.alerted, [])),
  dismissedLimitedBanner: sessionStorage.getItem("firewatch-banner-dismissed") === "1",
  tileErrorShown: false,
};

const elements = {
  sidebar: document.querySelector("#sidebar"),
  sidebarToggle: document.querySelector("#sidebarToggle"),
  feedStatus: document.querySelector("#feedStatus"),
  feedStatusText: document.querySelector("#feedStatusText"),
  refreshButton: document.querySelector("#refreshButton"),
  lastRefresh: document.querySelector("#lastRefresh"),
  nextRefresh: document.querySelector("#nextRefresh"),
  systemBanner: document.querySelector("#systemBanner"),
  systemBannerText: document.querySelector("#systemBannerText"),
  systemBannerClose: document.querySelector("#systemBannerClose"),
  statTotal: document.querySelector("#statTotal"),
  statUrgent: document.querySelector("#statUrgent"),
  statLatest: document.querySelector("#statLatest"),
  statLatestNote: document.querySelector("#statLatestNote"),
  statFrp: document.querySelector("#statFrp"),
  visibleCount: document.querySelector("#visibleCount"),
  sourceSelect: document.querySelector("#sourceSelect"),
  periodButtons: [...document.querySelectorAll(".period-button")],
  confidenceInputs: [...document.querySelectorAll(".confidence-toggle input")],
  timelineChart: document.querySelector("#timelineChart"),
  timelineStart: document.querySelector("#timelineStart"),
  detectionsList: document.querySelector("#detectionsList"),
  detectionTemplate: document.querySelector("#detectionItemTemplate"),
  radiusInput: document.querySelector("#radiusInput"),
  radiusOutput: document.querySelector("#radiusOutput"),
  watchCount: document.querySelector("#watchCount"),
  watchStatus: document.querySelector("#watchStatus"),
  useLocationButton: document.querySelector("#useLocationButton"),
  pickOnMapButton: document.querySelector("#pickOnMapButton"),
  notificationButton: document.querySelector("#notificationButton"),
  clearWatchButton: document.querySelector("#clearWatchButton"),
  fitSardiniaButton: document.querySelector("#fitSardiniaButton"),
  pickHint: document.querySelector("#pickHint"),
  cancelPickButton: document.querySelector("#cancelPickButton"),
  mapHeadline: document.querySelector("#mapHeadline"),
  mapSubheadline: document.querySelector("#mapSubheadline"),
  toastContainer: document.querySelector("#toastContainer"),
};

init();

async function init() {
  if (!window.L) {
    showBanner("La libreria cartografica non è stata caricata. Verifica la connessione Internet e ricarica la pagina.");
    setFeedStatus("error", "Mappa non disponibile");
    return;
  }

  initMap();
  restoreWatchArea();
  bindEvents();
  updateNotificationButton();
  renderTimeline([]);
  registerServiceWorker();
  await refreshData({ manual: false });
  startCountdown();
}

function initMap() {
  state.map = L.map("map", {
    zoomControl: false,
    minZoom: 7,
    maxZoom: 17,
    maxBounds: [
      [38.2, 7.15],
      [41.85, 10.75],
    ],
    maxBoundsViscosity: 0.65,
    preferCanvas: true,
  });

  const street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  });
  const satellite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 18,
      attribution: "Tiles © Esri",
    },
  );
  const topographic = L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
    maxZoom: 17,
    attribution: "© OpenStreetMap contributors, SRTM | © OpenTopoMap",
  });

  street.addTo(state.map);
  state.map.fitBounds(SARDINIA_BOUNDS, { padding: [20, 20] });
  L.control.zoom({ position: "topright" }).addTo(state.map);

  state.pointLayer =
    typeof L.markerClusterGroup === "function"
      ? L.markerClusterGroup({
          maxClusterRadius: 45,
          showCoverageOnHover: false,
          spiderfyOnMaxZoom: true,
          disableClusteringAtZoom: 13,
        })
      : L.layerGroup();
  state.pointLayer.addTo(state.map);

  state.watchLayer = L.layerGroup().addTo(state.map);

  const range = effisDateRange();
  const today = dateInRome(0);
  const common = {
    format: "image/png",
    transparent: true,
    version: "1.1.1",
    tiled: true,
    attribution: "Copernicus EFFIS / European Commission",
  };

  state.effisLayers.viirs = L.tileLayer.wms("https://maps.effis.emergency.copernicus.eu/effis", {
    ...common,
    layers: "viirs.hs",
    time: range,
    opacity: 0.92,
  });
  state.effisLayers.modis = L.tileLayer.wms("https://maps.effis.emergency.copernicus.eu/effis", {
    ...common,
    layers: "modis.hs",
    time: range,
    opacity: 0.8,
  });
  state.effisLayers.burned = L.tileLayer.wms("https://maps.effis.emergency.copernicus.eu/gwis", {
    ...common,
    layers: "nrt.ba",
    time: range,
    opacity: 0.62,
  });
  state.effisLayers.fwi = L.tileLayer.wms("https://maps.effis.emergency.copernicus.eu/effis", {
    ...common,
    layers: "ecmwf007.fwi",
    time: today,
    opacity: 0.5,
  });

  state.effisLayers.viirs.addTo(state.map);
  Object.values(state.effisLayers).forEach((layer) => {
    layer.on("tileerror", () => {
      if (state.tileErrorShown) return;
      state.tileErrorShown = true;
      showToast(
        "Layer EFFIS temporaneamente lento",
        "La mappa di base resta disponibile; il servizio Copernicus potrebbe richiedere qualche secondo o non avere dati per l'intervallo.",
        "warning",
        7000,
      );
    });
  });

  L.control
    .layers(
      {
        Stradale: street,
        Satellite: satellite,
        Topografica: topographic,
      },
      {
        "Hotspot VIIRS · EFFIS": state.effisLayers.viirs,
        "Hotspot MODIS · EFFIS": state.effisLayers.modis,
        "Punti con dettagli · FIRMS": state.pointLayer,
        "Aree bruciate recenti · EFFIS": state.effisLayers.burned,
        "Pericolo incendio FWI · EFFIS": state.effisLayers.fwi,
      },
      { position: "topright", collapsed: true },
    )
    .addTo(state.map);

  state.map.on("click", (event) => {
    if (!state.pickMode) return;
    setPickMode(false);
    setWatchArea(event.latlng.lat, event.latlng.lng, "mappa");
  });

  state.map.on("overlayadd overlayremove", updateMapHeadline);
}

function bindEvents() {
  elements.refreshButton.addEventListener("click", () => refreshData({ manual: true }));
  elements.sourceSelect.addEventListener("change", () => {
    state.sourceGroup = elements.sourceSelect.value;
    refreshData({ manual: true });
  });

  elements.periodButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.days = Number.parseInt(button.dataset.days, 10);
      elements.periodButtons.forEach((item) => item.classList.toggle("active", item === button));
      refreshData({ manual: true });
    });
  });

  elements.confidenceInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) state.confidence.add(input.value);
      else state.confidence.delete(input.value);
      renderFilteredData();
    });
  });

  elements.radiusInput.addEventListener("input", () => {
    const radius = Number.parseInt(elements.radiusInput.value, 10);
    elements.radiusOutput.textContent = `${radius} km`;
    if (state.watch) {
      state.watch.radius = radius;
      persistWatch();
      renderWatchArea();
      updateWatchSummary();
    }
  });

  elements.useLocationButton.addEventListener("click", useCurrentLocation);
  elements.pickOnMapButton.addEventListener("click", () => setPickMode(!state.pickMode));
  elements.cancelPickButton.addEventListener("click", () => setPickMode(false));
  elements.notificationButton.addEventListener("click", requestNotifications);
  elements.clearWatchButton.addEventListener("click", clearWatchArea);
  elements.fitSardiniaButton.addEventListener("click", () => state.map.fitBounds(SARDINIA_BOUNDS, { padding: [20, 20] }));

  elements.systemBannerClose.addEventListener("click", () => {
    elements.systemBanner.hidden = true;
    state.dismissedLimitedBanner = true;
    sessionStorage.setItem("firewatch-banner-dismissed", "1");
  });

  elements.sidebarToggle.addEventListener("click", () => {
    elements.sidebar.classList.toggle("open");
  });

  document.addEventListener("click", (event) => {
    const weatherButton = event.target.closest("[data-weather-id]");
    if (weatherButton) loadWeather(weatherButton.dataset.weatherId, weatherButton);
  });

  window.addEventListener("resize", () => state.map?.invalidateSize());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.nextRefreshAt && Date.now() > state.nextRefreshAt) {
      refreshData({ manual: false });
    }
  });
}

async function refreshData({ manual }) {
  if (state.isRefreshing) return;
  state.isRefreshing = true;
  elements.refreshButton.classList.add("is-spinning");
  setFeedStatus("loading", "Aggiornamento in corso...");

  const previousIds = new Set(state.currentFeedIds);

  try {
    const response = await fetch(`/api/fires?days=${state.days}&sources=${encodeURIComponent(state.sourceGroup)}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || "Feed non disponibile");

    state.firmsConfigured = Boolean(payload.configured);
    state.fires = Array.isArray(payload.fires) ? payload.fires : [];
    state.refreshSeconds = Number(payload.refreshSeconds) || DEFAULT_REFRESH_SECONDS;
    state.currentFeedIds = new Set(state.fires.map((fire) => fire.id));

    refreshEffisLayers();
    renderFilteredData();
    updateLastRefresh(payload.generatedAt || new Date().toISOString());
    scheduleRefresh(state.refreshSeconds);

    if (state.firmsConfigured) {
      const sourceFailures = (payload.sourceStatus || []).filter((item) => !item.ok);
      if (sourceFailures.length) {
        setFeedStatus("limited", "NRT · alcune sorgenti non disponibili");
      } else {
        setFeedStatus("live", payload.cached ? "NRT · dati in cache" : "NRT · EFFIS + NASA FIRMS");
      }
      hideBanner();
    } else {
      setFeedStatus("limited", "EFFIS NRT · dettagli FIRMS disattivi");
      if (!state.dismissedLimitedBanner) showBanner(payload.message);
    }

    if (state.hasLoadedOnce) notifyNewNearbyFires(previousIds);
    state.hasLoadedOnce = true;

    if (manual) {
      showToast(
        "Dati aggiornati",
        state.firmsConfigured
          ? `${state.fires.length} rilevamenti puntuali nel periodo selezionato.`
          : "Layer EFFIS aggiornati. Per i dettagli puntuali configura la chiave FIRMS.",
        "success",
      );
    }
  } catch (error) {
    console.error(error);
    setFeedStatus("error", "Aggiornamento non riuscito");
    showBanner("Il feed puntuale non è disponibile in questo momento. I layer EFFIS già caricati possono restare consultabili.");
    showToast("Aggiornamento non riuscito", error.message, "error", 7000);
    scheduleRefresh(120);
  } finally {
    state.isRefreshing = false;
    elements.refreshButton.classList.remove("is-spinning");
  }
}

function renderFilteredData() {
  state.filteredFires = state.fires.filter((fire) => {
    const confidence = fire.confidence === "unknown" ? "low" : fire.confidence;
    return state.confidence.has(confidence);
  });

  renderMarkers(state.filteredFires);
  renderStats(state.filteredFires);
  renderTimeline(state.filteredFires);
  renderDetectionsList(state.filteredFires);
  updateWatchSummary();
  elements.visibleCount.textContent = `${state.filteredFires.length} visibili`;
}

function renderMarkers(fires) {
  state.pointLayer.clearLayers();
  state.markers.clear();

  for (const fire of fires) {
    const recentClass = fire.ageMinutes <= 180 && ["critical", "high"].includes(fire.severity) ? "is-recent" : "";
    const icon = L.divIcon({
      className: "fire-marker-shell",
      html: `<span class="fire-marker severity-${escapeHtml(fire.severity)} ${recentClass}"></span>`,
      iconSize: [24, 24],
      iconAnchor: [12, 22],
      popupAnchor: [0, -18],
    });

    const marker = L.marker([fire.latitude, fire.longitude], { icon, title: zoneLabel(fire.latitude, fire.longitude) });
    marker.bindPopup(buildPopupHtml(fire), { maxWidth: 290, minWidth: 250 });
    state.pointLayer.addLayer(marker);
    state.markers.set(fire.id, marker);
  }
}

function buildPopupHtml(fire) {
  const confidence = confidenceLabel(fire.confidence);
  const frp = Number.isFinite(fire.frp) ? `${formatNumber(fire.frp, 1)} MW` : "Non disponibile";
  const observed = formatRome(fire.observedAt, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const coordinates = `${fire.latitude.toFixed(5)}, ${fire.longitude.toFixed(5)}`;
  const osmUrl = `https://www.openstreetmap.org/?mlat=${fire.latitude}&mlon=${fire.longitude}#map=14/${fire.latitude}/${fire.longitude}`;

  return `
    <div class="fire-popup">
      <div class="fire-popup-header">
        <span class="fire-popup-badge">${escapeHtml(severityLabel(fire.severity))}</span>
        <strong>${escapeHtml(zoneLabel(fire.latitude, fire.longitude))}</strong>
      </div>
      <div class="fire-popup-grid">
        <div class="fire-popup-metric"><span>Osservato</span><strong>${escapeHtml(observed)}</strong></div>
        <div class="fire-popup-metric"><span>Affidabilità</span><strong>${escapeHtml(confidence)}</strong></div>
        <div class="fire-popup-metric"><span>Sensore</span><strong>${escapeHtml(fire.instrument || fire.source)}</strong></div>
        <div class="fire-popup-metric"><span>FRP</span><strong>${escapeHtml(frp)}</strong></div>
      </div>
      <div class="fire-popup-coordinates">Coordinate: ${coordinates} · ${escapeHtml(relativeAge(fire.observedAt))}</div>
      <div class="fire-popup-actions">
        <button type="button" data-weather-id="${fire.id}">Meteo locale</button>
        <a href="${osmUrl}" target="_blank" rel="noopener noreferrer">Apri mappa</a>
      </div>
      <div class="fire-popup-weather" id="weather-${fire.id}"></div>
    </div>`;
}

function renderStats(fires) {
  if (!state.firmsConfigured) {
    elements.statTotal.textContent = "—";
    elements.statUrgent.textContent = "—";
    elements.statLatest.textContent = "—";
    elements.statLatestNote.textContent = "Richiede chiave FIRMS";
    elements.statFrp.textContent = "—";
    return;
  }

  const urgent = fires.filter((fire) => ["critical", "high"].includes(fire.severity)).length;
  const latest = fires[0]?.observedAt;
  const frpValues = fires.map((fire) => fire.frp).filter(Number.isFinite);
  const maxFrp = frpValues.length ? Math.max(...frpValues) : null;

  elements.statTotal.textContent = String(fires.length);
  elements.statUrgent.textContent = String(urgent);
  elements.statLatest.textContent = latest
    ? formatRome(latest, { hour: "2-digit", minute: "2-digit" })
    : "—";
  elements.statLatestNote.textContent = latest
    ? formatRome(latest, { weekday: "short", day: "2-digit", month: "short" })
    : "Nessun rilevamento";
  elements.statFrp.textContent = maxFrp === null ? "—" : formatNumber(maxFrp, 0);
}

function renderTimeline(fires) {
  const bucketCount = 12;
  const totalMinutes = state.days * 24 * 60;
  const bucketMinutes = totalMinutes / bucketCount;
  const buckets = Array.from({ length: bucketCount }, () => 0);

  for (const fire of fires) {
    const age = Math.max(0, Number(fire.ageMinutes) || 0);
    if (age > totalMinutes) continue;
    const index = Math.max(0, bucketCount - 1 - Math.floor(age / bucketMinutes));
    buckets[index] += 1;
  }

  const max = Math.max(1, ...buckets);
  elements.timelineChart.replaceChildren();
  buckets.forEach((count) => {
    const bar = document.createElement("div");
    bar.className = "timeline-bar";
    bar.dataset.count = String(count);
    bar.style.height = `${Math.max(2, Math.round((count / max) * 66))}px`;
    bar.style.opacity = count ? "0.9" : "0.18";
    elements.timelineChart.append(bar);
  });
  elements.timelineStart.textContent = `−${state.days === 1 ? 24 : state.days * 24} h`;
}

function renderDetectionsList(fires) {
  elements.detectionsList.replaceChildren();

  if (!state.firmsConfigured) {
    elements.detectionsList.append(
      buildEmptyState(
        "Layer EFFIS attivo",
        "La mappa mostra gli hotspot come layer cartografico. Configura FIRMS_MAP_KEY nel server per elenco, valori e notifiche.",
      ),
    );
    return;
  }

  if (!fires.length) {
    elements.detectionsList.append(
      buildEmptyState(
        "Nessun punto nel filtro",
        "Non risultano rilevamenti puntuali FIRMS con l'intervallo e l'affidabilità selezionati. Controlla comunque i layer EFFIS e il bollettino regionale.",
      ),
    );
    return;
  }

  const fragment = document.createDocumentFragment();
  fires.slice(0, 40).forEach((fire) => {
    const item = elements.detectionTemplate.content.firstElementChild.cloneNode(true);
    item.dataset.severity = fire.severity;
    item.querySelector(".detection-zone").textContent = zoneLabel(fire.latitude, fire.longitude);
    const frp = Number.isFinite(fire.frp) ? ` · FRP ${formatNumber(fire.frp, 1)} MW` : "";
    item.querySelector(".detection-meta").textContent = `${fire.instrument} · ${confidenceLabel(fire.confidence)}${frp}`;
    item.querySelector(".detection-time").textContent = relativeAge(fire.observedAt);
    item.addEventListener("click", () => focusFire(fire.id));
    fragment.append(item);
  });
  elements.detectionsList.append(fragment);
}

function buildEmptyState(title, copy) {
  const container = document.createElement("div");
  container.className = "empty-state";
  container.innerHTML = `
    <div class="empty-state-icon">⌁</div>
    <strong>${escapeHtml(title)}</strong>
    <span>${escapeHtml(copy)}</span>`;
  return container;
}

function focusFire(id) {
  const marker = state.markers.get(id);
  if (!marker) return;
  const latlng = marker.getLatLng();
  state.map.flyTo(latlng, Math.max(state.map.getZoom(), 13), { duration: 0.7 });
  setTimeout(() => marker.openPopup(), 500);
  if (window.innerWidth <= 820) elements.sidebar.classList.remove("open");
}

async function loadWeather(fireId, button) {
  const fire = state.fires.find((item) => item.id === fireId);
  const target = document.querySelector(`#weather-${CSS.escape(fireId)}`);
  if (!fire || !target || button.disabled) return;

  button.disabled = true;
  button.textContent = "Caricamento...";
  target.textContent = "Recupero delle condizioni meteorologiche locali...";

  try {
    const response = await fetch(`/api/weather?lat=${fire.latitude}&lon=${fire.longitude}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload.ok || !payload.current) throw new Error(payload.error || "Meteo non disponibile");

    const current = payload.current;
    const temp = valueWithUnit(current.temperature_2m, payload.currentUnits?.temperature_2m);
    const humidity = valueWithUnit(current.relative_humidity_2m, payload.currentUnits?.relative_humidity_2m);
    const wind = valueWithUnit(current.wind_speed_10m, payload.currentUnits?.wind_speed_10m);
    const gusts = valueWithUnit(current.wind_gusts_10m, payload.currentUnits?.wind_gusts_10m);
    target.innerHTML = `<strong>Meteo:</strong> ${escapeHtml(temp)} · umidità ${escapeHtml(humidity)} · vento ${escapeHtml(wind)} · raffiche ${escapeHtml(gusts)}.`;
    button.textContent = "Meteo aggiornato";
  } catch (error) {
    target.textContent = error.message;
    button.textContent = "Riprova meteo";
    button.disabled = false;
  }
}

function restoreWatchArea() {
  if (!state.watch || !Number.isFinite(state.watch.lat) || !Number.isFinite(state.watch.lon)) {
    state.watch = null;
    elements.radiusOutput.textContent = `${elements.radiusInput.value} km`;
    updateWatchSummary();
    return;
  }

  const radius = clamp(Number(state.watch.radius) || 30, 5, 100);
  state.watch.radius = radius;
  elements.radiusInput.value = String(radius);
  elements.radiusOutput.textContent = `${radius} km`;
  renderWatchArea();
  updateWatchSummary();
}

function useCurrentLocation() {
  if (!navigator.geolocation) {
    showToast("Geolocalizzazione non supportata", "Scegli il punto direttamente sulla mappa.", "warning");
    return;
  }

  elements.useLocationButton.disabled = true;
  elements.useLocationButton.textContent = "Localizzazione...";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      elements.useLocationButton.disabled = false;
      elements.useLocationButton.innerHTML = locationButtonMarkup();
      const { latitude, longitude } = position.coords;
      if (!insideMonitoringArea(latitude, longitude)) {
        showToast(
          "Posizione fuori dall'area",
          "La posizione rilevata non è in Sardegna o nelle immediate vicinanze. Scegli un punto sulla mappa.",
          "warning",
        );
        return;
      }
      setWatchArea(latitude, longitude, "posizione del dispositivo");
      state.map.flyTo([latitude, longitude], 11, { duration: 0.7 });
    },
    (error) => {
      elements.useLocationButton.disabled = false;
      elements.useLocationButton.innerHTML = locationButtonMarkup();
      showToast("Posizione non disponibile", geolocationMessage(error), "warning", 6500);
    },
    { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
  );
}

function locationButtonMarkup() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z"></path><circle cx="12" cy="10" r="2"></circle></svg>La mia posizione`;
}

function setPickMode(enabled) {
  state.pickMode = enabled;
  elements.pickOnMapButton.classList.toggle("active", enabled);
  elements.pickHint.hidden = !enabled;
  state.map.getContainer().style.cursor = enabled ? "crosshair" : "";
  if (enabled && window.innerWidth <= 820) elements.sidebar.classList.remove("open");
}

function setWatchArea(lat, lon, source) {
  if (!insideMonitoringArea(lat, lon)) {
    showToast("Punto non valido", "Scegli una posizione in Sardegna o nelle immediate vicinanze.", "warning");
    return;
  }

  const radius = Number.parseInt(elements.radiusInput.value, 10) || 30;
  state.watch = { lat, lon, radius, source };
  state.fires.forEach((fire) => state.alertedIds.add(fire.id));
  persistAlertedIds();
  persistWatch();
  renderWatchArea();
  updateWatchSummary();
  showToast("Area sorvegliata impostata", `Raggio ${radius} km attorno al punto selezionato.`, "success");
}

function renderWatchArea() {
  state.watchLayer.clearLayers();
  if (!state.watch) return;

  const centerIcon = L.divIcon({
    className: "",
    html: '<div class="watch-center-icon"></div>',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
  L.marker([state.watch.lat, state.watch.lon], { icon: centerIcon, interactive: false }).addTo(state.watchLayer);
  L.circle([state.watch.lat, state.watch.lon], {
    radius: state.watch.radius * 1000,
    color: "#6aaefc",
    weight: 1.5,
    opacity: 0.85,
    fillColor: "#6aaefc",
    fillOpacity: 0.08,
    dashArray: "6 5",
    interactive: false,
  }).addTo(state.watchLayer);
}

function updateWatchSummary() {
  if (!state.watch) {
    elements.watchCount.textContent = "Non impostata";
    elements.watchStatus.textContent = "Nessuna area di sorveglianza configurata.";
    elements.clearWatchButton.disabled = true;
    return;
  }

  const nearby = state.fires
    .map((fire) => ({ fire, distance: haversineKm(state.watch.lat, state.watch.lon, fire.latitude, fire.longitude) }))
    .filter((item) => item.distance <= state.watch.radius);
  elements.watchCount.textContent = `${nearby.length} nel raggio`;
  elements.watchStatus.textContent = `Centro ${state.watch.lat.toFixed(4)}, ${state.watch.lon.toFixed(4)} · raggio ${state.watch.radius} km · ${nearby.length} rilevamenti puntuali nel feed corrente.`;
  elements.clearWatchButton.disabled = false;
}

function clearWatchArea() {
  state.watch = null;
  localStorage.removeItem(STORAGE_KEYS.watch);
  state.watchLayer.clearLayers();
  updateWatchSummary();
  showToast("Area rimossa", "La sorveglianza di prossimità è stata disattivata.", "success");
}

async function requestNotifications() {
  if (!("Notification" in window)) {
    showToast("Notifiche non supportate", "Il browser non espone le notifiche di sistema.", "warning");
    return;
  }

  if (!state.watch) {
    showToast("Imposta prima un'area", "Usa la posizione del dispositivo o scegli un punto sulla mappa.", "warning");
    return;
  }

  if (Notification.permission === "denied") {
    showToast(
      "Permesso bloccato",
      "Riabilita le notifiche dalle impostazioni del sito nel browser, poi riprova.",
      "warning",
      7000,
    );
    return;
  }

  const permission = await Notification.requestPermission();
  state.notificationsEnabled = permission === "granted";
  localStorage.setItem(STORAGE_KEYS.notifications, JSON.stringify(state.notificationsEnabled));
  updateNotificationButton();
  showToast(
    state.notificationsEnabled ? "Notifiche attive" : "Notifiche non attivate",
    state.notificationsEnabled
      ? "Gli avvisi verranno mostrati per nuovi hotspot vicini mentre il sito è aperto."
      : "Il browser non ha concesso il permesso.",
    state.notificationsEnabled ? "success" : "warning",
  );
}

function updateNotificationButton() {
  if (!("Notification" in window)) {
    elements.notificationButton.textContent = "Notifiche non supportate";
    elements.notificationButton.disabled = true;
    return;
  }

  if (Notification.permission === "granted" && state.notificationsEnabled) {
    elements.notificationButton.textContent = "Notifiche attive";
    elements.notificationButton.disabled = false;
  } else if (Notification.permission === "denied") {
    elements.notificationButton.textContent = "Notifiche bloccate";
    elements.notificationButton.disabled = false;
  } else {
    elements.notificationButton.textContent = "Attiva notifiche";
    elements.notificationButton.disabled = false;
  }
}

function notifyNewNearbyFires(previousIds) {
  if (!state.watch) return;

  const candidates = state.fires.filter((fire) => {
    if (previousIds.has(fire.id) || state.alertedIds.has(fire.id)) return false;
    if (fire.ageMinutes > 360 || fire.confidence === "low") return false;
    const distance = haversineKm(state.watch.lat, state.watch.lon, fire.latitude, fire.longitude);
    return distance <= state.watch.radius;
  });

  candidates.forEach((fire) => {
    const distance = haversineKm(state.watch.lat, state.watch.lon, fire.latitude, fire.longitude);
    state.alertedIds.add(fire.id);
    showToast(
      "Nuovo hotspot nell'area sorvegliata",
      `${zoneLabel(fire.latitude, fire.longitude)} · ${formatNumber(distance, 1)} km dal centro · ${confidenceLabel(fire.confidence)}.`,
      "warning",
      9000,
    );

    if (state.notificationsEnabled && Notification.permission === "granted") {
      const notification = new Notification("Sardegna FireWatch · nuovo hotspot", {
        body: `${zoneLabel(fire.latitude, fire.longitude)}, a ${formatNumber(distance, 1)} km dal punto sorvegliato.`,
        icon: "/icons/icon-192.png",
        tag: `fire-${fire.id}`,
      });
      notification.onclick = () => {
        window.focus();
        focusFire(fire.id);
        notification.close();
      };
    }
  });

  persistAlertedIds();
}

function persistAlertedIds() {
  const trimmed = [...state.alertedIds].slice(-500);
  state.alertedIds = new Set(trimmed);
  localStorage.setItem(STORAGE_KEYS.alerted, JSON.stringify(trimmed));
}

function persistWatch() {
  if (state.watch) localStorage.setItem(STORAGE_KEYS.watch, JSON.stringify(state.watch));
}

function refreshEffisLayers() {
  const range = effisDateRange();
  const today = dateInRome(0);
  const cacheBust = String(Date.now());
  state.effisLayers.viirs?.setParams({ time: range, cachebust: cacheBust }, false);
  state.effisLayers.modis?.setParams({ time: range, cachebust: cacheBust }, false);
  state.effisLayers.burned?.setParams({ time: range, cachebust: cacheBust }, false);
  state.effisLayers.fwi?.setParams({ time: today, cachebust: cacheBust }, false);
}

function updateMapHeadline() {
  const active = [];
  if (state.map.hasLayer(state.effisLayers.viirs)) active.push("VIIRS");
  if (state.map.hasLayer(state.effisLayers.modis)) active.push("MODIS");
  if (state.map.hasLayer(state.effisLayers.burned)) active.push("aree bruciate");
  if (state.map.hasLayer(state.effisLayers.fwi)) active.push("FWI");
  if (state.map.hasLayer(state.pointLayer) && state.firmsConfigured) active.push("punti FIRMS");

  elements.mapHeadline.textContent = active.length ? `Layer attivi: ${active.join(" · ")}` : "Nessun layer incendi attivo";
  elements.mapSubheadline.textContent = "Usa il controllo in alto a destra per modificare la visualizzazione";
}

function scheduleRefresh(seconds) {
  window.clearTimeout(state.refreshTimeout);
  state.nextRefreshAt = Date.now() + seconds * 1000;
  state.refreshTimeout = window.setTimeout(() => refreshData({ manual: false }), seconds * 1000);
}

function startCountdown() {
  window.clearInterval(state.countdownInterval);
  state.countdownInterval = window.setInterval(() => {
    if (!state.nextRefreshAt) {
      elements.nextRefresh.textContent = "--:--";
      return;
    }
    const remaining = Math.max(0, state.nextRefreshAt - Date.now());
    const minutes = Math.floor(remaining / 60_000);
    const seconds = Math.floor((remaining % 60_000) / 1000);
    elements.nextRefresh.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, 1000);
}

function updateLastRefresh(value) {
  elements.lastRefresh.textContent = formatRome(value, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function setFeedStatus(type, text) {
  elements.feedStatus.className = `status-pill status-${type}`;
  elements.feedStatusText.textContent = text;
}

function showBanner(message) {
  if (!message) return;
  elements.systemBannerText.textContent = message;
  elements.systemBanner.hidden = false;
  setTimeout(() => state.map?.invalidateSize(), 50);
}

function hideBanner() {
  elements.systemBanner.hidden = true;
}

function showToast(title, message, type = "info", duration = 4800) {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div></div>
    <div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span></div>
    <button type="button" aria-label="Chiudi">×</button>`;
  const remove = () => toast.remove();
  toast.querySelector("button").addEventListener("click", remove);
  elements.toastContainer.append(toast);
  window.setTimeout(remove, duration);
}

function buildClientStats(fires) {
  return {
    total: fires.length,
    urgent: fires.filter((fire) => ["critical", "high"].includes(fire.severity)).length,
  };
}

function zoneLabel(latitude, longitude) {
  const northSouth = latitude >= 40.58 ? "Nord" : latitude >= 39.58 ? "Centro" : "Sud";
  const eastWest = longitude >= 9.18 ? "est" : longitude <= 8.72 ? "ovest" : "interno";
  return `${northSouth}-${eastWest} Sardegna`;
}

function confidenceLabel(value) {
  return (
    {
      high: "Alta",
      nominal: "Nominale",
      low: "Bassa",
      unknown: "Non classificata",
    }[value] || "Non classificata"
  );
}

function severityLabel(value) {
  return (
    {
      critical: "Priorità molto alta",
      high: "Priorità alta",
      medium: "Priorità media",
      low: "Priorità bassa",
    }[value] || "Da verificare"
  );
}

function relativeAge(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "ora non disponibile";
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 2) return "adesso";
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h fa`;
  return `${Math.floor(hours / 24)} g fa`;
}

function formatRome(value, options) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    ...options,
  }).format(date);
}

function dateInRome(offsetDays) {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function effisDateRange() {
  const lookbackDays = Math.max(1, Number(state.days) || 1);
  return `${dateInRome(-lookbackDays)}/${dateInRome(0)}`;
}

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function valueWithUnit(value, unit) {
  if (!Number.isFinite(Number(value))) return "n.d.";
  return `${formatNumber(Number(value), 0)}${unit ? ` ${unit}` : ""}`;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const radius = 6371;
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function insideMonitoringArea(latitude, longitude) {
  return latitude >= 38.3 && latitude <= 41.8 && longitude >= 7.2 && longitude <= 10.7;
}

function geolocationMessage(error) {
  if (error.code === error.PERMISSION_DENIED) return "Il permesso di localizzazione è stato negato.";
  if (error.code === error.POSITION_UNAVAILABLE) return "Il dispositivo non riesce a determinare la posizione.";
  if (error.code === error.TIMEOUT) return "La richiesta di posizione è scaduta.";
  return "Errore durante la localizzazione.";
}

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("Service worker:", error));
}

// Kept for future dashboard extensions and testability in the browser console.
window.SardegnaFireWatch = {
  getState: () => ({
    firmsConfigured: state.firmsConfigured,
    fires: state.fires.length,
    visible: state.filteredFires.length,
    watch: state.watch,
    stats: buildClientStats(state.filteredFires),
  }),
  refresh: () => refreshData({ manual: true }),
  center: () => state.map?.setView(SARDINIA_CENTER, 8),
};
