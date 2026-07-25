# Sardinia FireWatch — third-party data and service register

_Last reviewed: 2026-07-25_

This document is an engineering compliance register, not a legal opinion. Every public release must re-check the linked official terms because providers can change licences, prices, quotas, attribution rules, and available products.

## Release gates

A production App Store build must not be released unless all entries marked **BLOCKED** have been resolved and evidence of the applicable account/plan is retained by the project owner.

| Source or service | Current use | Commercial release status | Required action |
|---|---|---:|---|
| NASA LANCE FIRMS | Active-fire and thermal-anomaly observations | ALLOWED WITH CONDITIONS | Use a valid FIRMS MAP_KEY, acknowledge NASA/FIRMS, preserve provenance, do not imply NASA endorsement, and respect transaction limits. |
| Copernicus EMS / EFFIS | Hotspots, recent burned areas, fire-weather layers | ALLOWED WITH CONDITIONS | Attribute Copernicus/EFFIS and the European Union; keep the information-only disclaimer; verify the terms of each requested layer, including any third-party component. |
| Open-Meteo weather API and data | Wind, cloud cover, weather history used in smoke-drift estimates | ALLOWED WITH COMMERCIAL CONFIGURATION | The production backend is configured for the customer endpoint and requires a commercial API key. Keep Open-Meteo and underlying-provider attribution and identify derived estimates as modified/derived data. |
| Apple MapKit / Apple Maps | Native satellite, hybrid, and street basemaps on iOS | ALLOWED WITH CONDITIONS | Use the system MapKit renderer, preserve Apple’s legal and attribution controls, and re-check the current Apple Developer agreements and Maps terms before release. |
| react-native-maps | React Native bridge to Apple MapKit | ALLOWED WITH CONDITIONS | Preserve the library’s MIT licence notice in distributed software documentation and verify compatibility with the targeted Expo/React Native release. |
| Natural Earth / world-atlas | Simplified country outlines used for territory selection and filtering | ALLOWED | Natural Earth data is public domain. State clearly that the operational outlines are not authoritative and do not express a position on disputed borders. |

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

**Commercial configuration**

The public free API is offered for non-commercial use. The production service
therefore uses the paid customer endpoint and passes the API key only from the
backend environment. A release must continue to verify one of the following:

1. a paid Open-Meteo customer endpoint and API key under the selected plan; or
2. a compliant self-hosted Open-Meteo deployment, including compliance with the server-code licence and all underlying data-provider attribution requirements.

The release guard must reject a commercial build if the customer endpoint or
API key is absent.

**Derived information**

The smoke track in Sardinia FireWatch is a project-generated estimate derived from wind data. It must be labelled as an indicative estimate, identify Open-Meteo and the relevant model/data providers, and state that the data were processed or modified. It is not a dispersion model or an emergency forecast.

## 4. Apple MapKit and react-native-maps

**Official sources**

- Apple Maps developer overview: https://developer.apple.com/maps/
- MapKit documentation: https://developer.apple.com/documentation/mapkit
- Apple Maps terms: https://www.apple.com/legal/internet-services/maps/
- react-native-maps project: https://github.com/react-native-maps/react-native-maps

**Implementation requirements**

- Do not cover, hide, crop, or replace the legal and attribution controls rendered by MapKit.
- Keep application controls and legends away from the lower map area reserved for system notices.
- Use the native Apple provider on iOS; no ArcGIS token, remote style document, third-party tile endpoint, or JavaScript fallback is required.
- Preserve the react-native-maps MIT licence notice.
- Re-test native linking, map rendering, annotations, overlays, and attribution on the actual release build and supported iOS versions.

## 5. Derived analytics owned by the project

Sardinia FireWatch may own original code, interface design, and independently created calculations, but it does not acquire ownership of upstream observations or map content.

Derived outputs must retain enough provenance to identify:

- upstream source(s);
- observation/model time;
- processing method;
- whether the result is observed, modelled, or estimated;
- limitations and uncertainty.

The current smoke-drift track is explicitly an indicative project calculation based on wind at 10 m with a simplified drift factor. It must never be described as a prediction of fire spread or as an official plume-dispersion result.

## 6. Territory boundaries

Country outlines are generated from Natural Earth data distributed through
world-atlas. They are simplified for display, API bounding and point filtering.
They are not cadastral boundaries, legal determinations or statements on
sovereignty. Product copy must call them operational map territories and should
not claim official border accuracy.

## Release checklist

Before every App Store submission:

- [ ] Re-open every official terms link above and record the review date.
- [ ] Confirm the Open-Meteo commercial endpoint or compliant self-host is active.
- [ ] Confirm the release build uses Apple MapKit on iOS and requires no third-party basemap credential.
- [ ] Confirm Apple’s legal and attribution controls remain visible and unobstructed.
- [ ] Confirm FIRMS MAP_KEY ownership and transaction limits.
- [ ] Confirm enabled EFFIS layers and their product-specific metadata/terms.
- [ ] Verify all source and derived-data notices in the app.
- [ ] Verify the privacy policy covers server requests, location use, diagnostics, and notification identifiers.
- [ ] Confirm marketing text does not imply endorsement by NASA, the EU, Apple, Open-Meteo, or public authorities.
