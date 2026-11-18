/*
 * Fire Danger app settings. This is the only file you should need to edit.
 *
 * Wired to the FireRestriction_Zones layer and the engine's v7 INTERNAL rating,
 * the same fields the Fire Management dashboard uses.
 *
 * To go live:
 *   1. Register the app in ArcGIS Online and paste the Client ID below (README, Step 3).
 *   2. Check portalUrl matches the address you see when signed in to ArcGIS Online.
 *   3. Set demo: false.
 */
window.FDA_CONFIG = {
  appTitle: "Fire Danger",
  agencyName: "Larimer County",

  // true = sample data from the Nov 18, 2026 dashboard; false = live data
  demo: false,

  // Your ArcGIS Online org address (used for sign-in)
  portalUrl: "https://larimer.maps.arcgis.com",

  // Client ID from the OAuth credentials item you create in ArcGIS Online
  oauthClientId: "dZsYlnB41C1qPB9g",

  // FireRestriction_Zones item. The app looks up the service URL from this ID.
  zonesItemId: "0e12da304d034822a1080b76006ded91",
  zonesLayerIndex: 0,          // layer FireRestriction_Zones_polygons
  zonesLayerUrl: "",           // optional: paste the full .../FeatureServer/0 URL to skip the lookup
  zonesWhere: "1=1",

  // id = what the app shows; layerId = value in the ZONE field
  zones: [
    { id: "238", layerId: 38, name: "Plains" },
    { id: "215", layerId: 35, name: "Foothills" },
    { id: "218", layerId: 33, name: "East Divide" }
  ],

  fields: {
    zone: "ZONE",
    level: "fdr7_internal_level",            // today's rating: Low ... Extreme
    ratio: "fdr7_internal_ratio",            // "× normal"
    drivers: "fdr7_internal_drivers",        // driver text; "snow on fuels" = snow on fuels
    flags: "fdr7_flags",                     // contains "snow on fuels" = snow at some stations
    runTs: "fdr7_run_ts",                    // engine run time (stale check and day names)
    dayLevelPattern: "fdr7_d{n}_internal",   // day 1-7 ratings (chart, tomorrow, peak, outlook)
    rfwToday: "rfw_today",
    rfwDay1: "rfw_day1",
    rfwDay2: "rfw_day2",
    rfwDay3: "rfw_day3",
    watchToday: "watch_today",
    watch3: "watch3",
    rfwStatus: "rfw_status_text",            // banner text when NWS has issued something
    chinook: "fdr7_chinook_strength"         // STRONG / MODERATE Chinook banner
  },

  forecastDay1IsTomorrow: true,              // fdr7_d1_internal = tomorrow

  // Same rule as the dashboard: no engine write in this many hours = stale
  staleAfterHours: 30
};
