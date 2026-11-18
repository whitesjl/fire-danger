/* Fire Danger phone app. Plain JavaScript, no build step. */
(function () {
  "use strict";

  var CFG = window.FDA_CONFIG || {};
  var F = CFG.fields || {};
  var STORE_DATA = "fda:data:v1";
  var STORE_AUTH = "fda:auth:v1";
  var STORE_PKCE = "fda:pkce:v1";
  var REFETCH_MS = 10 * 60 * 1000;

  var RATINGS = [
    { key: "low", label: "Low", abbr: "L", level: 1, cls: "r-low" },
    { key: "moderate", label: "Moderate", abbr: "M", level: 2, cls: "r-moderate" },
    { key: "high", label: "High", abbr: "H", level: 3, cls: "r-high" },
    { key: "very_high", label: "Very High", abbr: "VH", level: 4, cls: "r-veryhigh" },
    { key: "extreme", label: "Extreme", abbr: "E", level: 5, cls: "r-extreme" }
  ];

  var state = { data: null, loading: false, error: null, needsSignIn: false, offline: !navigator.onLine };
  var app = document.getElementById("app");

  // ---------- helpers ----------
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function blank(v) { return v === null || v === undefined || String(v).trim() === ""; }

  function rating(v) {
    if (blank(v)) return null;
    if (typeof v === "number" || /^\s*\d+(\.\d+)?\s*$/.test(String(v))) {
      var n = Math.round(Number(v));
      return RATINGS[Math.min(5, Math.max(1, n)) - 1];
    }
    var s = String(v).toLowerCase().replace(/[^a-z]/g, "");
    if (s.indexOf("extreme") === 0) return RATINGS[4];
    if (s.indexOf("veryhigh") === 0 || s === "vh") return RATINGS[3];
    if (s.indexOf("high") === 0 || s === "h") return RATINGS[2];
    if (s.indexOf("mod") === 0 || s === "m") return RATINGS[1];
    if (s.indexOf("low") === 0 || s === "l") return RATINGS[0];
    return null;
  }

  function outlook(v) {
    if (blank(v)) return null;
    var s = String(v).toLowerCase();
    if (s.indexOf("improv") >= 0) return { label: "Improving", icon: "▼", cls: "o-improving" };
    if (s.indexOf("wors") >= 0 || s.indexOf("increas") >= 0) return { label: "Worsening", icon: "▲", cls: "o-worsening" };
    if (s.indexOf("stab") >= 0) return { label: "Stable", icon: "▶", cls: "o-stable" };
    return { label: String(v), icon: "", cls: "o-stable" };
  }

  function bool(v) {
    if (blank(v)) return null;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v > 0;
    var s = String(v).toLowerCase().trim();
    if (["y", "yes", "true", "1", "snow", "snow on fuels"].indexOf(s) >= 0) return true;
    if (["n", "no", "false", "0", "none", "bare", "no snow"].indexOf(s) >= 0) return false;
    return s.indexOf("no ") !== 0 && s.indexOf("snow") >= 0;
  }

  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function dayLabel(v, long) {
    if (blank(v)) return "";
    if (typeof v === "number" && v > 100000000000) {
      var d = new Date(v), now = new Date(), tom = new Date(now.getTime() + 86400000);
      if (sameDay(d, now)) return "Today";
      if (sameDay(d, tom)) return long ? "Tomorrow" : "Tmrw";
      return long ? DAYS_LONG[d.getDay()] : DAYS[d.getDay()];
    }
    var s = String(v).trim();
    if (!long) {
      if (/^tomorrow/i.test(s)) return "Tmrw" + s.slice(8);
      for (var i = 0; i < 7; i++) {
        if (s.toLowerCase().indexOf(DAYS_LONG[i].toLowerCase()) === 0) return DAYS[i] + s.slice(DAYS_LONG[i].length);
      }
    }
    return s;
  }

  function chartDay(v) {
    if (typeof v === "number" && v > 100000000000) {
      var d = new Date(v);
      return sameDay(d, new Date()) ? "Today" : DAYS[d.getDay()];
    }
    return dayLabel(v, false);
  }

  function fmtTime(ms) {
    if (!ms) return "";
    var d = new Date(ms);
    var now = new Date();
    var t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (sameDay(d, now)) return "today " + t;
    return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) + " " + t;
  }

  function zoneKey(raw) {
    if (blank(raw)) return "";
    var s = String(raw).trim();
    var aliases = CFG.zoneIdAliases || {};
    return aliases[s] || s;
  }

  // ---------- demo data (from the Nov 18, 2026 dashboard) ----------
  function demoData() {
    var t = new Date(); t.setHours(6, 34, 0, 0);
    function days(list) { return list.map(function (p) { return { label: p[0], rating: rating(p[1]), peak: !!p[2] }; }); }
    return {
      fetchedAt: Date.now(),
      updated: t.getTime(),
      demo: true,
      zones: [
        { id: "238", name: "Plains", today: rating("High"), driver: "Drought (KBDI)", ratio: 1.4,
          tomorrow: rating("Moderate"), peak: rating("High"), peakDay: "Friday", outlook: outlook("Improving"), snow: false,
          alert: { kind: "redflag", label: "Warning", title: "RED FLAG WARNING until today 4:00 PM", detail: "" },
          days: days([["Thu", "Moderate"], ["Fri", "High", 1], ["Sat", "Moderate"], ["Sun", "Moderate"], ["Mon", "Low"], ["Tue", "Moderate"], ["Wed", "Low"]]) },
        { id: "215", name: "Foothills", today: rating("Extreme"), driver: "Chinook wind + Burning Index", ratio: 4.4,
          tomorrow: rating("High"), peak: rating("Very High"), peakDay: "Friday", outlook: outlook("Improving"), snow: false,
          alert: { kind: "chinook", label: "Chinook", title: "Strong Chinook wind", detail: "CWTi forecast. No NWS fire weather alerts." },
          days: days([["Thu", "High"], ["Fri", "Very High", 1], ["Sat", "High"], ["Sun", "Moderate"], ["Mon", "Moderate"], ["Tue", "Low"], ["Wed", "Low"]]) },
        { id: "218", name: "East Divide", today: rating("Low"), driver: "Snow on fuels", ratio: 0.6,
          tomorrow: rating("Low"), peak: rating("Low"), peakDay: "Tomorrow", peakMore: 6, outlook: outlook("Stable"), snow: true,
          alert: { kind: "chinook", label: "Chinook", title: "Strong Chinook wind", detail: "CWTi forecast. No NWS fire weather alerts." },
          days: days([["Thu", "Low"], ["Fri", "Low"], ["Sat", "Low"], ["Sun", "Low"], ["Mon", "Low"], ["Tue", "Low"], ["Wed", "Low"]]) }
      ]
    };
  }

  // ---------- ArcGIS sign-in (OAuth 2.0 with PKCE; no secret needed) ----------
  var Auth = {
    enabled: function () { return !blank(CFG.oauthClientId); },
    portal: function () { return String(CFG.portalUrl || "https://www.arcgis.com").replace(/\/+$/, ""); },
    redirectUri: function () { return location.origin + location.pathname; },
    load: function () { try { return JSON.parse(localStorage.getItem(STORE_AUTH)) || null; } catch (e) { return null; } },
    save: function (a) { try { localStorage.setItem(STORE_AUTH, JSON.stringify(a)); } catch (e) {} },
    clear: function () { try { localStorage.removeItem(STORE_AUTH); } catch (e) {} },

    b64url: function (bytes) {
      var s = ""; bytes = new Uint8Array(bytes);
      for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
      return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    },
    random: function (n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return Auth.b64url(a); },

    signIn: function () {
      var verifier = Auth.random(48), st = Auth.random(16);
      return crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)).then(function (hash) {
        try { localStorage.setItem(STORE_PKCE, JSON.stringify({ verifier: verifier, state: st })); } catch (e) {}
        var q = new URLSearchParams({
          client_id: CFG.oauthClientId, response_type: "code", redirect_uri: Auth.redirectUri(),
          code_challenge: Auth.b64url(hash), code_challenge_method: "S256", state: st
        });
        location.href = Auth.portal() + "/sharing/rest/oauth2/authorize?" + q.toString();
      });
    },

    tokenRequest: function (params) {
      return fetch(Auth.portal() + "/sharing/rest/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params).toString()
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j.error || !j.access_token) throw new Error((j.error && (j.error.message || j.error_description)) || "Sign-in failed");
        return j;
      });
    },

    store: function (j, prev) {
      var now = Date.now();
      var a = {
        access: j.access_token,
        expires: now + (Number(j.expires_in) || 1800) * 1000,
        refresh: j.refresh_token || (prev && prev.refresh) || null,
        refreshExpires: j.refresh_token ? now + (Number(j.refresh_token_expires_in) || 1209600) * 1000 : (prev && prev.refreshExpires) || 0,
        user: j.username || (prev && prev.user) || ""
      };
      Auth.save(a);
      return a;
    },

    handleRedirect: function () {
      var q = new URLSearchParams(location.search);
      if (!q.get("code") && !q.get("error")) return Promise.resolve(false);
      var saved = null;
      try { saved = JSON.parse(localStorage.getItem(STORE_PKCE)); } catch (e) {}
      try { localStorage.removeItem(STORE_PKCE); } catch (e) {}
      history.replaceState(null, "", location.pathname + location.hash);
      if (q.get("error")) return Promise.reject(new Error(q.get("error_description") || "Sign-in was cancelled"));
      if (!saved || saved.state !== q.get("state")) return Promise.reject(new Error("Sign-in could not be verified. Please try again."));
      return Auth.tokenRequest({
        grant_type: "authorization_code", client_id: CFG.oauthClientId, code: q.get("code"),
        redirect_uri: Auth.redirectUri(), code_verifier: saved.verifier
      }).then(function (j) { Auth.store(j); return true; });
    },

    // Returns a valid token, or null if the user has to sign in.
    token: function () {
      if (!Auth.enabled()) return Promise.resolve(null);
      var a = Auth.load();
      if (!a) return Promise.resolve(null);
      if (a.access && a.expires - 60000 > Date.now()) return Promise.resolve(a.access);
      if (a.refresh && a.refreshExpires > Date.now()) {
        return Auth.tokenRequest({ grant_type: "refresh_token", client_id: CFG.oauthClientId, refresh_token: a.refresh })
          .then(function (j) { return Auth.store(j, a).access; })
          .catch(function () { Auth.clear(); return null; });
      }
      Auth.clear();
      return Promise.resolve(null);
    }
  };

  function AuthNeeded() { this.name = "AuthNeeded"; this.message = "Sign-in needed"; }

  // ---------- live data ----------
  function query(url, where, token) {
    var q = new URLSearchParams({ where: where || "1=1", outFields: "*", returnGeometry: "false", f: "json" });
    if (token) q.set("token", token);
    return fetch(String(url).replace(/\/+$/, "") + "/query?" + q.toString(), { cache: "no-store" })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) throw new AuthNeeded();
        return r.json();
      })
      .then(function (j) {
        if (j.error) {
          if ([498, 499, 401, 403].indexOf(j.error.code) >= 0) throw new AuthNeeded();
          throw new Error(j.error.message || "Layer query failed");
        }
        return (j.features || []).map(function (f) { return f.attributes || {}; });
      });
  }

  function get(row, field) { return blank(field) ? null : row[field]; }

  function startOfDay(ms) { var d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function addDays(ms, n) { var d = new Date(ms); d.setDate(d.getDate() + n); return d.getTime(); }

  function untilText(ms) {
    if (typeof ms !== "number") return "";
    var d = new Date(ms), now = new Date(), t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (sameDay(d, now)) return "today " + t;
    if (sameDay(d, new Date(addDays(now.getTime(), 1)))) return "tomorrow " + t;
    return DAYS_LONG[d.getDay()] + " " + t;
  }

  function cleanDrivers(v) {
    if (blank(v) || String(v).trim() === "-") return "Near or below normal";
    var s = String(v).trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Same rules as the dashboard's "Combined NWS Alert Display + CWTi Chinook" banner
  function zoneAlert(r, fresh) {
    var on = function (f) { return Number(get(r, f)) === 1; };
    var nws = 0, alerts = [];
    if (on(F.rfwToday)) { nws = 3; alerts.push("RED FLAG WARNING"); }
    else if (on(F.rfwDay1) || on(F.rfwDay2) || on(F.rfwDay3)) { nws = Math.max(nws, 2); alerts.push("RED FLAG WARNING FORECAST"); }
    if (on(F.watchToday)) { nws = Math.max(nws, 2); alerts.push("FIRE WEATHER WATCH"); }
    else if (on(F.watch3)) { nws = Math.max(nws, 1); alerts.push("WATCH UPCOMING"); }

    var ch = fresh ? String(get(r, F.chinook) || "").trim().toUpperCase() : "";
    var chLevel = ch === "STRONG" ? 2 : ch === "MODERATE" ? 1 : 0;
    var chText = chLevel ? (ch === "STRONG" ? "Strong" : "Moderate") + " Chinook wind" : "";

    if (nws > 0) {
      var status = get(r, F.rfwStatus);
      var level = Math.max(nws, chLevel);
      return {
        kind: level >= 3 ? "redflag" : level === 2 ? "watch" : "monitor",
        label: nws === 3 ? "Warning" : nws === 2 ? "Watch" : "Monitor",
        title: blank(status) ? alerts.join(" | ") : String(status),
        detail: chText
      };
    }
    if (chLevel) {
      return { kind: chLevel === 2 ? "chinook" : "monitor", label: "Chinook", title: chText, detail: "CWTi forecast. No NWS fire weather alerts." };
    }
    return null;
  }

  // Same rule as the dashboard's 7-Day Planning Outlook card:
  // average of today + days 1-2 vs days 5-7, half a level either way
  function planningOutlook(todayR, days) {
    function avg(list) {
      var t = 0, n = 0;
      list.forEach(function (x) { if (x) { t += x.level; n++; } });
      return n ? t / n : null;
    }
    var e = avg([todayR, days[0] && days[0].rating, days[1] && days[1].rating]);
    var l = avg([days[4] && days[4].rating, days[5] && days[5].rating, days[6] && days[6].rating]);
    if (e === null || l === null) return null;
    var d = l - e;
    if (d >= 0.5) return outlook("worsening");
    if (d <= -0.5) return outlook("improving");
    return outlook("stable");
  }

  function buildZones(rows) {
    var staleMs = (CFG.staleAfterHours || 30) * 3600000;
    var offset = CFG.forecastDay1IsTomorrow === false ? 0 : 1;
    var newest = 0;

    var zones = (CFG.zones || []).map(function (z) {
      var r = rows.filter(function (x) { return String(get(x, F.zone)) === String(z.layerId); })[0];
      var base = { id: z.id, name: z.name, today: null, driver: "", ratio: null, tomorrow: null, peak: null, peakDay: null,
        outlook: null, snow: null, alert: null, days: [], stale: false };
      if (!r) { base.driver = "Zone not found in layer"; return base; }

      var run = get(r, F.runTs);
      if (typeof run === "number" && run > newest) newest = run;
      var fresh = typeof run === "number" && Date.now() - run <= staleMs;
      base.alert = zoneAlert(r, fresh);

      // Same rule as the dashboard: no engine write in 30+ hours = stale, show no rating
      if (!fresh) {
        base.stale = true;
        base.driver = "Stale - check engine run";
        return base;
      }

      base.today = rating(get(r, F.level));
      var rawDrivers = String(get(r, F.drivers) || "").trim().toLowerCase();
      base.driver = base.today ? cleanDrivers(get(r, F.drivers)) : "No current rating";
      // Snow: the engine's own snow decision, as on the dashboard
      if (rawDrivers === "snow on fuels") base.snow = true;
      else if (String(get(r, F.flags) || "").toLowerCase().indexOf("snow on fuels") >= 0) base.snow = "some";
      else base.snow = false;
      var ratio = get(r, F.ratio);
      base.ratio = blank(ratio) || isNaN(Number(ratio)) ? null : Number(ratio);

      var day0 = startOfDay(run);
      for (var n = 1; n <= 7; n++) {
        var date = addDays(day0, n - 1 + offset);
        base.days.push({ date: date, label: chartDay(date + 12 * 3600000), rating: rating(get(r, String(F.dayLevelPattern).replace("{n}", n))), peak: false });
      }
      var max = 0, first = -1, ties = 0;
      base.days.forEach(function (d, i) {
        if (!d.rating) return;
        if (d.rating.level > max) { max = d.rating.level; first = i; ties = 1; }
        else if (d.rating.level === max) ties++;
      });
      if (first >= 0) {
        base.days[first].peak = true;
        base.peak = base.days[first].rating;
        base.peakDay = base.days[first].date + 12 * 3600000;
        base.peakMore = ties - 1;
      }
      if (offset === 1) base.tomorrow = base.days[0].rating;
      base.outlook = planningOutlook(base.today, base.days);
      return base;
    });
    return { fetchedAt: Date.now(), updated: newest || null, demo: false, zones: zones };
  }

  var STORE_URL = "fda:layerurl:v1";
  function layerUrl(token) {
    if (!blank(CFG.zonesLayerUrl)) return Promise.resolve(String(CFG.zonesLayerUrl).replace(/\/+$/, ""));
    try { var c = localStorage.getItem(STORE_URL); if (c) return Promise.resolve(c); } catch (e) {}
    if (blank(CFG.zonesItemId)) return Promise.reject(new Error("Set zonesItemId or zonesLayerUrl in config.js."));
    var q = new URLSearchParams({ f: "json" });
    if (token) q.set("token", token);
    return fetch(Auth.portal() + "/sharing/rest/content/items/" + encodeURIComponent(CFG.zonesItemId) + "?" + q.toString())
      .then(function (res) { return res.json(); })
      .then(function (j) {
        if (j.error) { if ([498, 499, 403].indexOf(j.error.code) >= 0) throw new AuthNeeded(); throw new Error(j.error.message || "Couldn't look up the layer"); }
        if (!j.url) throw new Error("That ArcGIS item has no service URL.");
        var url = j.url.replace(/\/+$/, "");
        if (!/\/\d+$/.test(url)) url += "/" + (CFG.zonesLayerIndex || 0);
        try { localStorage.setItem(STORE_URL, url); } catch (e) {}
        return url;
      });
  }

  function fetchLive() {
    var tok;
    return Auth.token().then(function (token) {
      if (Auth.enabled() && !token) throw new AuthNeeded();
      tok = token;
      return layerUrl(token);
    }).then(function (url) {
      return query(url, CFG.zonesWhere, tok);
    }).then(function (rows) { return buildZones(rows); });
  }

  // ---------- cache ----------
  function loadCache() { try { return JSON.parse(localStorage.getItem(STORE_DATA)); } catch (e) { return null; } }
  function saveCache(d) { try { localStorage.setItem(STORE_DATA, JSON.stringify(d)); } catch (e) {} }

  function refresh() {
    if (state.loading) return;
    if (CFG.demo) { state.data = demoData(); render(); return; }
    state.loading = true; state.error = null; render();
    fetchLive().then(function (d) {
      state.data = d; state.needsSignIn = false; saveCache(d);
    }).catch(function (e) {
      if (e instanceof AuthNeeded) { state.needsSignIn = true; Auth.clear(); }
      else if (!navigator.onLine) state.error = "You're offline";
      else if (e instanceof TypeError) state.error = "Couldn't reach ArcGIS Online";
      else state.error = e.message || "Couldn't load the latest data";
    }).then(function () { state.loading = false; render(); });
  }

  // ---------- views ----------
  var ICON = {
    refresh: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>',
    chevron: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    back: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
    flag: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3v18h2v-7h11l-2-4.5L18 5H7V3z"/></svg>',
    wind: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h16a3 3 0 1 1-3 3"/><path d="M3 16h8"/></svg>',
    alert: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
    snow: '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v20"/><path d="M3.3 7l17.4 10"/><path d="M3.3 17L20.7 7"/></svg>'
  };

  function snowText(v, icon) {
    if (v === true) return (icon ? ICON.snow + " " : "") + "Snow on fuels";
    if (v === "some") return (icon ? ICON.snow + " " : "") + "Snow at some stations";
    return "No snow on fuels";
  }

  function chip(r, extra) {
    if (!r) return '<span class="chip r-none">—</span>';
    return '<span class="chip ' + r.cls + '">' + esc(r.label) + (extra ? " · " + esc(extra) : "") + "</span>";
  }

  function alertBanner(a, big) {
    if (!a) return "";
    var icon = a.kind === "redflag" ? ICON.flag : a.label === "Chinook" ? ICON.wind : ICON.alert;
    return '<div class="banner b-' + a.kind + (big ? " big" : "") + '">' + icon +
      '<div class="banner-text">' + (a.label ? '<span class="blabel">' + esc(a.label) + "</span>" : "") + "<strong>" + esc(a.title) + "</strong>" + (a.detail ? "<span>" + esc(a.detail) + "</span>" : "") + "</div></div>";
  }

  function header() {
    var d = state.data;
    var sub = d && d.updated ? "Calculated " + fmtTime(d.updated) : new Date().toLocaleDateString([], { weekday: "long", month: "short", day: "numeric", year: "numeric" });
    return '<header class="top"><div><div class="agency">' + esc(CFG.agencyName || "") + "</div><h1>" + esc(CFG.appTitle || "Fire Danger") +
      '</h1><div class="sub">' + esc(sub) + '</div></div><button class="icon-btn' + (state.loading ? " spinning" : "") +
      '" id="refresh" aria-label="Refresh">' + ICON.refresh + "</button></header>" + statusLine();
  }

  function statusLine() {
    var d = state.data, msgs = [];
    if (d && d.demo) msgs.push('<div class="status s-demo">Demo data from the Nov 18, 2026 dashboard. Not live.</div>');
    if (state.error && d) msgs.push('<div class="status s-warn">' + esc(state.error) + ". Showing data saved " + esc(fmtTime(d.fetchedAt)) + ".</div>");
    else if (d && !d.demo) {
      var age = Date.now() - (d.updated || d.fetchedAt);
      if (age > (CFG.staleAfterHours || 18) * 3600000) msgs.push('<div class="status s-warn">This data is from ' + esc(fmtTime(d.updated || d.fetchedAt)) + ". The morning run may not have finished.</div>");
    }
    return msgs.join("");
  }

  function card(z) {
    var t = z.today;
    var hero = '<div class="hero ' + (t ? t.cls : "r-none") + '"><div><span class="lbl">Today</span><span class="big">' +
      esc(t ? t.label : "No data") + "</span>" + (z.driver ? '<span class="drv">' + esc(z.driver) + "</span>" : "") + "</div>" +
      (z.ratio != null ? '<div class="ratio"><span>' + z.ratio.toFixed(1) + "×</span><small>normal</small></div>" : "") + "</div>";
    var cells = '<div class="cells">' +
      '<div><span class="lbl2">Tomorrow</span>' + chip(z.tomorrow) + "</div>" +
      '<div><span class="lbl2">7-day peak</span>' + chip(z.peak, dayLabel(z.peakDay, false)) + "</div>" +
      '<div><span class="lbl2">Outlook</span>' + (z.outlook ? '<span class="outlook ' + z.outlook.cls + '">' + esc((z.outlook.icon ? z.outlook.icon + " " : "") + z.outlook.label) + "</span>" : '<span class="outlook">—</span>') + "</div></div>";
    var snow = z.snow == null ? "" : '<div class="snow">' + snowText(z.snow, true) + "</div>";
    return '<a class="card" href="#/zone/' + encodeURIComponent(z.id) + '">' + alertBanner(z.alert) +
      '<div class="card-body"><div class="zone-row"><div><span class="zid">Zone ' + esc(z.id) + '</span><span class="zname">' + esc(z.name) +
      '</span></div><span class="more">Details' + ICON.chevron + "</span></div>" + hero + cells + snow + "</div></a>";
  }

  function homeView() {
    var d = state.data;
    if (!d) return header() + (state.loading ? '<p class="empty">Loading…</p>' : '<p class="empty">' + esc(state.error || "No data yet.") + "</p>");
    return header() + '<div class="cards">' + d.zones.map(card).join("") + "</div>" + footer();
  }

  function chart(z) {
    if (!z.days || !z.days.length) {
      return '<section class="panel"><h2>Coming days</h2><div class="tiles">' +
        '<div class="tile ' + (z.tomorrow ? z.tomorrow.cls : "r-none") + '"><span>Tomorrow</span><strong>' + esc(z.tomorrow ? z.tomorrow.label : "—") + "</strong></div>" +
        '<div class="tile peak ' + (z.peak ? z.peak.cls : "r-none") + '"><span>7-day peak' + (z.peakDay ? " · " + esc(dayLabel(z.peakDay, true)) : "") + "</span><strong>" + esc(z.peak ? z.peak.label : "—") + "</strong></div></div></section>";
    }
    var bars = z.days.map(function (d) {
      var lvl = d.rating ? d.rating.level : 0;
      return '<div class="col"><span class="abbr">' + esc(d.rating ? d.rating.abbr : "–") + '</span><div class="bar ' + (d.rating ? d.rating.cls : "r-none") +
        (d.peak ? " peak" : "") + '" style="height:' + (lvl * 24) + 'px" title="' + esc(d.label + ": " + (d.rating ? d.rating.label : "no data")) + '"></div></div>';
    }).join("");
    var labels = z.days.map(function (d) { return '<span class="' + (d.peak ? "pk" : "") + '">' + esc(d.label) + "</span>"; }).join("");
    var peakTxt = z.peak ? "Peak " + z.peak.label + (z.peakDay ? " · " + dayLabel(z.peakDay, false) : "") + (z.peakMore ? " (+" + z.peakMore + " more day" + (z.peakMore > 1 ? "s" : "") + ")" : "") : "";
    return '<section class="panel"><div class="panel-head"><h2>7-day outlook</h2><span class="muted">' + esc(peakTxt) + '</span></div>' +
      '<div class="chart" role="img" aria-label="' + esc(z.days.map(function (d) { return d.label + " " + (d.rating ? d.rating.label : "no data"); }).join(", ")) + '">' +
      '<div class="grid"><i style="bottom:24px"></i><i style="bottom:48px"></i><i style="bottom:72px"></i><i style="bottom:96px"></i><i style="bottom:120px"></i></div>' +
      '<div class="bars">' + bars + '</div></div><div class="day-labels">' + labels + '</div>' +
      '<p class="legend">L Low · M Moderate · H High · VH Very High · E Extreme</p>' +
      (state.data && state.data.demo ? '<p class="legend"><em>Sat–Wed are illustrative in demo mode.</em></p>' : "") + "</section>";
  }

  function detailView(id) {
    var d = state.data;
    var z = d && d.zones.filter(function (x) { return x.id === id; })[0];
    if (!z) { location.hash = ""; return homeView(); }
    var t = z.today;
    var ratio = "";
    if (z.ratio != null) {
      var pct = Math.min(100, (z.ratio / 5) * 100);
      ratio = '<section class="panel"><div class="panel-head"><h2>Fire danger vs normal</h2><span class="ratio-big">' + z.ratio.toFixed(1) + '×</span></div>' +
        '<div class="rbar"><div class="rfill ' + (t ? t.cls : "r-none") + '" style="width:' + pct + '%"></div><div class="rnorm"></div></div>' +
        '<div class="rlabels"><span>0×</span><span class="norm">Normal</span><span>5×</span></div></section>';
    }
    var facts = '<section class="panel facts"><div><span class="lbl2">7-day planning outlook</span><strong class="' + (z.outlook ? z.outlook.cls : "") + '">' +
      esc(z.outlook ? (z.outlook.icon ? z.outlook.icon + " " : "") + z.outlook.label : "—") + '</strong></div><div><span class="lbl2">Fuels</span><strong>' +
      (z.snow == null ? "—" : snowText(z.snow, false)) + "</strong></div></section>";
    var key = '<div class="key">' + RATINGS.map(function (r) { return '<span class="chip ' + r.cls + '">' + r.label + "</span>"; }).join("") + "</div>";
    return '<a class="back" href="#/">' + ICON.back + 'All zones</a>' +
      '<div class="dtitle"><span class="zid light">Zone ' + esc(z.id) + "</span><h1>" + esc(z.name) + "</h1></div>" + statusLine() +
      alertBanner(z.alert, true) +
      '<section class="hero-big ' + (t ? t.cls : "r-none") + '"><span class="lbl">Fire danger today</span><span class="huge">' + esc(t ? t.label : "No data") + "</span>" +
      (z.driver ? '<span class="drv">Driven by ' + esc(z.driver) + "</span>" : "") + "</section>" +
      ratio + chart(z) + facts + key + footer();
  }

  function signInView() {
    return header() + '<section class="panel signin"><h2>Sign in to see fire danger</h2><p>Use your county ArcGIS Online account. You\'ll stay signed in on this phone for about two weeks.</p>' +
      '<button class="primary" id="signin">Sign in with ArcGIS</button>' + (state.error ? '<p class="err">' + esc(state.error) + "</p>" : "") + "</section>";
  }

  function footer() {
    var a = Auth.enabled() ? Auth.load() : null;
    var bits = [];
    if (state.data && state.data.fetchedAt && !state.data.demo) bits.push("Checked " + esc(fmtTime(state.data.fetchedAt)));
    if (a && a.user) bits.push("Signed in as " + esc(a.user) + ' · <button class="link" id="signout">Sign out</button>');
    return bits.length ? '<footer class="foot">' + bits.join("<br>") + "</footer>" : "";
  }

  function render() {
    var m = location.hash.match(/^#\/zone\/(.+)$/);
    var html;
    if (state.needsSignIn && !state.data) html = signInView();
    else if (m) html = detailView(decodeURIComponent(m[1]));
    else html = homeView();
    if (state.needsSignIn && state.data) html = '<div class="status s-warn">Your sign-in expired. <button class="link" id="signin">Sign in again</button></div>' + html;
    app.innerHTML = html;
    var r = document.getElementById("refresh"); if (r) r.onclick = refresh;
    var s = document.getElementById("signin"); if (s) s.onclick = function () { Auth.signIn(); };
    var o = document.getElementById("signout"); if (o) o.onclick = function () { Auth.clear(); localStorage.removeItem(STORE_DATA); localStorage.removeItem(STORE_URL); state.data = null; state.needsSignIn = true; render(); };
  }

  // ---------- start ----------
  window.addEventListener("hashchange", function () { render(); window.scrollTo(0, 0); });
  window.addEventListener("online", function () { state.offline = false; refresh(); });
  window.addEventListener("offline", function () { state.offline = true; });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible" && state.data && Date.now() - state.data.fetchedAt > REFETCH_MS) refresh();
  });

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }

  if (!CFG.demo) state.data = loadCache();
  render();
  Auth.handleRedirect()
    .catch(function (e) { state.error = e.message; })
    .then(function () { refresh(); });
})();
