export const SARDINIA_BBOX = Object.freeze({
  west: 7.7,
  south: 38.7,
  east: 10.2,
  north: 41.4,
});

export const FIRMS_SOURCES = Object.freeze({
  viirs: ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"],
  modis: ["MODIS_NRT"],
  all: ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "MODIS_NRT"],
});

export const DEFAULT_REFRESH_SECONDS = 300;
export const DEFAULT_CACHE_TTL_MS = 300_000;
