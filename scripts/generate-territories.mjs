import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { feature } from "topojson-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const topology = JSON.parse(
  readFileSync(resolve(rootDir, "node_modules/world-atlas/countries-50m.json"), "utf8"),
);
const geometries = topology.objects.countries.geometries;
const productPrefix = "com.guidogazzola.sardiniafirewatch.country";

const countries = [
  ["albania", "AL", "008", "Albania", "Albania"],
  ["andorra", "AD", "020", "Andorra", "Andorra"],
  ["austria", "AT", "040", "Austria", "Austria"],
  ["belarus", "BY", "112", "Bielorussia", "Belarus"],
  ["belgium", "BE", "056", "Belgio", "Belgium"],
  ["bosnia-herzegovina", "BA", "070", "Bosnia ed Erzegovina", "Bosnia and Herz."],
  ["bulgaria", "BG", "100", "Bulgaria", "Bulgaria"],
  ["croatia", "HR", "191", "Croazia", "Croatia"],
  ["cyprus", "CY", "196", "Cipro", "Cyprus"],
  ["czechia", "CZ", "203", "Cechia", "Czechia"],
  ["denmark", "DK", "208", "Danimarca", "Denmark"],
  ["estonia", "EE", "233", "Estonia", "Estonia"],
  ["finland", "FI", "246", "Finlandia", "Finland"],
  ["france", "FR", "250", "Francia", "France"],
  ["germany", "DE", "276", "Germania", "Germany"],
  ["greece", "GR", "300", "Grecia", "Greece"],
  ["hungary", "HU", "348", "Ungheria", "Hungary"],
  ["iceland", "IS", "352", "Islanda", "Iceland"],
  ["ireland", "IE", "372", "Irlanda", "Ireland"],
  ["italy", "IT", "380", "Italia", "Italy"],
  ["kosovo", "XK", null, "Kosovo", "Kosovo"],
  ["latvia", "LV", "428", "Lettonia", "Latvia"],
  ["liechtenstein", "LI", "438", "Liechtenstein", "Liechtenstein"],
  ["lithuania", "LT", "440", "Lituania", "Lithuania"],
  ["luxembourg", "LU", "442", "Lussemburgo", "Luxembourg"],
  ["malta", "MT", "470", "Malta", "Malta"],
  ["moldova", "MD", "498", "Moldova", "Moldova"],
  ["monaco", "MC", "492", "Monaco", "Monaco"],
  ["montenegro", "ME", "499", "Montenegro", "Montenegro"],
  ["netherlands", "NL", "528", "Paesi Bassi", "Netherlands"],
  ["north-macedonia", "MK", "807", "Macedonia del Nord", "Macedonia"],
  ["norway", "NO", "578", "Norvegia", "Norway"],
  ["poland", "PL", "616", "Polonia", "Poland"],
  ["portugal", "PT", "620", "Portogallo", "Portugal"],
  ["romania", "RO", "642", "Romania", "Romania"],
  ["russia", "RU", "643", "Russia", "Russia"],
  ["san-marino", "SM", "674", "San Marino", "San Marino"],
  ["serbia", "RS", "688", "Serbia", "Serbia"],
  ["slovakia", "SK", "703", "Slovacchia", "Slovakia"],
  ["slovenia", "SI", "705", "Slovenia", "Slovenia"],
  ["spain", "ES", "724", "Spagna", "Spain"],
  ["sweden", "SE", "752", "Svezia", "Sweden"],
  ["switzerland", "CH", "756", "Svizzera", "Switzerland"],
  ["turkey", "TR", "792", "Turchia", "Turkey"],
  ["ukraine", "UA", "804", "Ucraina", "Ukraine"],
  ["united-kingdom", "GB", "826", "Regno Unito", "United Kingdom"],
  ["vatican-city", "VA", "336", "Città del Vaticano", "Vatican"],
];

function geometryByReference(numericCode, naturalEarthName) {
  const match = numericCode
    ? geometries.find((geometry) => geometry.id === numericCode)
    : geometries.find((geometry) => geometry.properties?.name === naturalEarthName);
  if (!match) throw new Error(`Confine non trovato: ${naturalEarthName}`);
  return feature(topology, match).geometry;
}

function polygonBounds(polygon) {
  const coordinates = [];
  visitCoordinates(polygon, (coordinate) => coordinates.push(coordinate));
  const longitudes = coordinates.map(([longitude]) => longitude);
  const latitudes = coordinates.map(([, latitude]) => latitude);
  return {
    west: Math.min(...longitudes),
    south: Math.min(...latitudes),
    east: Math.max(...longitudes),
    north: Math.max(...latitudes),
  };
}

function visitCoordinates(value, callback) {
  if (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    callback(value);
    return;
  }
  if (Array.isArray(value)) value.forEach((item) => visitCoordinates(item, callback));
}

function asPolygons(geometry) {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

function asMultiPolygon(polygons) {
  return {
    type: "MultiPolygon",
    coordinates: polygons,
  };
}

function keepEuropeanComponents(geometry, territoryId) {
  if (!["france", "netherlands"].includes(territoryId)) return geometry;
  const polygons = asPolygons(geometry).filter((polygon) => {
    const bounds = polygonBounds(polygon);
    return (
      bounds.north >= 35 &&
      bounds.south <= 72 &&
      bounds.east >= -12 &&
      bounds.west <= 32
    );
  });
  return asMultiPolygon(polygons);
}

function completeCyprus(geometry) {
  const northCyprus = geometryByReference(null, "N. Cyprus");
  return asMultiPolygon([...asPolygons(geometry), ...asPolygons(northCyprus)]);
}

function deriveSardinia() {
  const italy = geometryByReference("380", "Italy");
  const sardinianPolygons = asPolygons(italy).filter((polygon) => {
    const bounds = polygonBounds(polygon);
    return (
      bounds.west >= 7.5 &&
      bounds.east <= 10.2 &&
      bounds.south >= 38.5 &&
      bounds.north <= 41.5
    );
  });
  return asMultiPolygon(sardinianPolygons);
}

function rounded(value) {
  return Math.round(value * 100_000) / 100_000;
}

function normalizeGeometry(geometry) {
  const normalized = structuredClone(geometry);
  visitCoordinates(normalized.coordinates, (coordinate) => {
    coordinate[0] = rounded(coordinate[0]);
    coordinate[1] = rounded(coordinate[1]);
  });
  return normalized;
}

function territoryRecord({
  id,
  countryCode,
  name,
  geometry,
  free = false,
  queryBounds,
}) {
  const normalizedGeometry = normalizeGeometry(geometry);
  const bounds = polygonBounds(normalizedGeometry.coordinates);
  const effectiveQueryBounds = queryBounds ?? bounds;
  return {
    id,
    countryCode,
    name,
    free,
    productId: free ? null : `${productPrefix}.${countryCode.toLowerCase()}`,
    bounds: Object.fromEntries(
      Object.entries(bounds).map(([key, value]) => [key, rounded(value)]),
    ),
    queryBounds: Object.fromEntries(
      Object.entries(effectiveQueryBounds).map(([key, value]) => [key, rounded(value)]),
    ),
    center: {
      latitude: rounded((bounds.south + bounds.north) / 2),
      longitude: rounded((bounds.west + bounds.east) / 2),
    },
    geometry: normalizedGeometry,
  };
}

const records = [
  territoryRecord({
    id: "sardinia",
    countryCode: "IT-SAR",
    name: "Sardegna",
    free: true,
    geometry: deriveSardinia(),
  }),
  ...countries.map(([id, countryCode, numericCode, italianName, naturalEarthName]) => {
    let geometry = geometryByReference(numericCode, naturalEarthName);
    if (id === "cyprus") geometry = completeCyprus(geometry);
    geometry = keepEuropeanComponents(geometry, id);
    const queryBounds =
      id === "russia"
        ? { west: 19, south: 41, east: 60, north: 82 }
        : undefined;
    return territoryRecord({
      id,
      countryCode,
      name: italianName,
      geometry,
      queryBounds,
    });
  }),
].sort((first, second) => {
  if (first.free) return -1;
  if (second.free) return 1;
  return first.name.localeCompare(second.name, "it");
});

const json = `${JSON.stringify(records)}\n`;
const outputs = [
  resolve(rootDir, "data/territories.json"),
  resolve(rootDir, "mobile/src/data/territories.json"),
];
for (const output of outputs) {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, json);
}

const territoryNames = Object.fromEntries(
  records.map((territory) => [
    territory.id,
    territory.id === "sardinia"
      ? {
          it: "Sardegna",
          en: "Sardinia",
          fr: "Sardaigne",
          de: "Sardinien",
        }
      : Object.fromEntries(
          ["it", "en", "fr", "de"].map((language) => [
            language,
            new Intl.DisplayNames([language], { type: "region" }).of(
              territory.countryCode,
            ) || territory.name,
          ]),
        ),
  ]),
);
writeFileSync(
  resolve(rootDir, "mobile/src/data/territory-names.json"),
  `${JSON.stringify(territoryNames, null, 2)}\n`,
);

const manifest = [
  "reference_name,product_id,type,swiss_target_price",
  ...records
    .filter((territory) => !territory.free)
    .map(
      (territory) =>
        `"SabettaPiro — ${territory.name}",${territory.productId},non-consumable,CHF 5.00`,
    ),
].join("\n");
writeFileSync(resolve(rootDir, "data/app-store-products.csv"), `${manifest}\n`);

const appStoreLocales = [
  {
    locale: "it",
    language: "it",
    description: () => "Mappe, incendi, meteo e avvisi",
  },
  {
    locale: "en-US",
    language: "en",
    description: () => "Maps, wildfires, weather and alerts",
  },
  {
    locale: "fr-FR",
    language: "fr",
    description: () => "Cartes, incendies, météo et alertes",
  },
  {
    locale: "de-DE",
    language: "de",
    description: () => "Karten, Brände, Wetter und Warnungen",
  },
];

function csvCell(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const localizationRows = [
  "product_id,locale,display_name,description",
  ...records
    .filter((territory) => !territory.free)
    .flatMap((territory) =>
      appStoreLocales.map(({ locale, language, description }) => {
        const displayName =
          new Intl.DisplayNames([language], { type: "region" }).of(
            territory.countryCode,
          ) || territory.name;
        const localizedDescription = description(displayName);
        if (localizedDescription.length > 45) {
          throw new Error(
            `Descrizione App Store troppo lunga (${locale}, ${territory.id}): ${localizedDescription}`,
          );
        }
        return [
          territory.productId,
          locale,
          displayName,
          localizedDescription,
        ]
          .map(csvCell)
          .join(",");
      }),
    ),
].join("\n");
writeFileSync(
  resolve(rootDir, "data/app-store-product-localizations.csv"),
  `${localizationRows}\n`,
);

console.log(`Generati ${records.length} territori (${records.length - 1} acquisti in-app).`);
