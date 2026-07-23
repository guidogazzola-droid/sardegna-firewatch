# Sardinia FireWatch — third-party data and service register

_Last reviewed: 2026-07-23_

This document is an engineering compliance register, not a legal opinion. Every public release must re-check the linked official terms because providers can change licences, prices, quotas, attribution rules, and available products.

## Release gates

A production App Store build must not be released unless all entries marked **BLOCKED** have been resolved and evidence of the applicable account/plan is retained by the project owner.

| Source or service | Current use | Commercial release status | Required action |
|---|---|---:|---|
| NASA LANCE FIRMS | Active-fire and thermal-anomaly observations | ALLOWED WITH CONDITIONS | Use a valid FIRMS MAP_KEY, acknowledge NASA/FIRMS, preserve provenance, do not imply NASA endorsement, and respect transaction limits. |
| Copernicus EMS / EFFIS | Hotspots, recent burned areas, fire-weather layers | ALLOWED WITH CONDITIONS | Attribute Copernicus/EFFIS and the European Union; keep the information-only disclaimer; verify the terms of each requested layer, including any third-party component. |
| Open-Meteo weather API and data | Wind, cloud cover, weather history used in smoke-drift estimates | **BLOCKED FOR PAID RELEASE UNTIL CONFIGURED** | The public free API is restricted to non-commercial use. Before a paid App Store release, configure a commercial Open-Meteo endpoint/API key or a compliant self-hosted instance. Keep Open-Meteo and underlying-provider attribution and identify derived estimates as modified/derived data. |
| ArcGIS Basemap Styles service | Satellite, topographic, and street basemaps | **BLOCKED UNTIL CONFIGURED** | Use an ArcGIS Location Platform or ArcGIS Online account, a restricted access token, and an applicable billing plan. Display Esri attribution and all data-provider attribution returned by the style. Do not call undocumented public tile endpoints directly. |
| MapLibre React Native | Native map rendering library | ALLOWED WITH CONDITIONS | Preserve the library licence notices in the distributed software documentation. MapLibre does not grant rights to third-party map data. |

## 1. NASA LANCE FIRMS

**Official sources**

- Data use and citation guidance: https://www.earthdata.nasa.gov/engage/open-data-services-software/data-use-policy
- FIRMS service: https://firms.modaps.eosdis.nasa.gov/
- MAP_KEY and transaction limits: https://firms.modaps.eosdis.nasa.gov/api/map_key/

**Use in Sardinia FireWatch**

- MODIS and VIIRS active-fire/thermal-anomaly observations.
- The app must describe these records as observations or thermal anomalies, not automatically as confirmed fires.

**Attribution and notices**

Suggested concise attribution:

> Active-fire and thermal-anomaly data: NASA LANCE FIRMS (MODIS/VIIRS).

The app and marketing material must not suggest NASA endorsement. Source, sensor, observation time, and confidence/provenance fields should be retained whenever practical.

## 2. Copernicus EMS / EFFIS

**Official sources**

- CEMS terms and conditions: https://mapping.emergency.copernicus.eu/terms-and-conditions/
- EFFIS data and services: https://forest-fire.emergency.copernicus.eu/applications/data-and-services

**Use in Sardinia FireWatch**

- EFFIS hotspot and fire-weather map layers.
- Where a layer incorporates third-party information, the metadata and product-specific terms must be checked before enabling that layer in a commercial release.

**Attribution and notices**

Suggested concise attribution:

> Contains information from the Copernicus Emergency Management Service / EFFIS, European Union.

CEMS information is supplied without warranty and for information purposes. Sardinia FireWatch must preserve its own warning that it is not an official emergency service.

## 3. Open-Meteo

**Official sources**

- Terms: https://open-meteo.com/en/terms
- Pricing and commercial API information: https://open-meteo.com/en/pricing

**Important commercial restriction**

The public free API is offered for non-commercial use. A paid App Store app is a commercial use. Therefore production weather requests must use one of the following before release:

1. a paid Open-Meteo customer endpoint and API key under the selected plan; or
2. a compliant self-hosted Open-Meteo deployment, including compliance with the server-code licence and all underlying data-provider attribution requirements.

Development and internal TestFlight testing may use the public endpoint only while the project remains non-commercial and within the published limits.

**Derived information**

The smoke track in Sardinia FireWatch is a project-generated estimate derived from wind data. It must be labelled as an indicative estimate, identify Open-Meteo and the relevant model/data providers, and state that the data were processed or modified. It is not a dispersion model or an emergency forecast.

## 4. ArcGIS Basemap Styles

**Official sources**

- Basemap Styles service: https://developers.arcgis.com/rest/basemap-styles/
- Attribution requirements: https://developers.arcgis.com/documentation/esri-and-data-attribution/
- Licensing overview: https://developers.arcgis.com/javascript/latest/licensing/

**Implementation requirements**

- Authenticate through the documented Basemap Styles service.
- Restrict the token to the intended application and services where supported.
- Monitor usage and billing.
- Display `Powered by Esri` plus all provider attribution contained in the returned style/metadata.
- Keep attribution visible near the map or available through the map attribution control in accordance with Esri guidance.

The application must not use raw `server.arcgisonline.com` tile URLs as an undocumented substitute for an authenticated commercial basemap service.

## 5. Derived analytics owned by the project

Sardinia FireWatch may own original code, interface design, and independently created calculations, but it does not acquire ownership of upstream observations or map content.

Derived outputs must retain enough provenance to identify:

- upstream source(s);
- observation/model time;
- processing method;
- whether the result is observed, modelled, or estimated;
- limitations and uncertainty.

The current smoke-drift track is explicitly an indicative project calculation based on wind at 10 m with a simplified drift factor. It must never be described as a prediction of fire spread or as an official plume-dispersion result.

## Release checklist

Before every App Store submission:

- [ ] Re-open every official terms link above and record the review date.
- [ ] Confirm the Open-Meteo commercial endpoint or compliant self-host is active.
- [ ] Confirm the ArcGIS account, restricted token, attribution rendering, and billing settings.
- [ ] Confirm FIRMS MAP_KEY ownership and transaction limits.
- [ ] Confirm enabled EFFIS layers and their product-specific metadata/terms.
- [ ] Verify all source and derived-data notices in the app.
- [ ] Verify the privacy policy covers server requests, location use, diagnostics, and notification identifiers.
- [ ] Confirm marketing text does not imply endorsement by NASA, the EU, Esri, Open-Meteo, or public authorities.
