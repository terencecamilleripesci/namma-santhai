/* ============================================================
   Namma Santhai — backend client.

   If a backend is configured AND reachable, the app runs on real
   server-side accounts (shared between devices). If not, it falls
   back to the on-device demo so the preview link never breaks.

   Set the backend URL by either:
     - editing API_BASE below, or
     - opening the app with ?api=https://your-backend/   (saved after)
   ============================================================ */
window.NS_API = (function () {
  "use strict";

  // Live trial backend. Because this is baked in, the plain app link works on
  // its own — no ?api= needed — so everyone shares the same accounts and
  // listings instead of each phone keeping its own private copy.
  var API_BASE = "https://raspberrypi.silverside-tench.ts.net:8443/nsapi";

  try {
    var q = new URLSearchParams(location.search).get("api");
    if (q) localStorage.setItem("ns_api_base", q.replace(/\/+$/, ""));
    // An ?api= override still wins, but a stale one saved from an earlier
    // session must not outrank a newer built-in default.
    var saved = localStorage.getItem("ns_api_base");
    if (q) API_BASE = q.replace(/\/+$/, "");
    else if (saved && localStorage.getItem("ns_api_pin") === "1") API_BASE = saved;
    if (q) localStorage.setItem("ns_api_pin", "1");
  } catch (e) {}

  var token = null;
  try { token = localStorage.getItem("ns_token"); } catch (e) {}

  function setToken(t) {
    token = t || null;
    try { t ? localStorage.setItem("ns_token", t) : localStorage.removeItem("ns_token"); } catch (e) {}
  }

  function url(p) { return API_BASE.replace(/\/+$/, "") + p; }

  function req(method, path, body) {
    var opts = { method: method, headers: {} };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    if (token) opts.headers["Authorization"] = "Bearer " + token;
    return fetch(url(path), opts).then(function (r) {
      return r.text().then(function (txt) {
        var data;
        // Never let an HTML error page explode as "Unexpected token <".
        try { data = txt ? JSON.parse(txt) : {}; }
        catch (e) { data = { error: { code: "bad_response", message: "Server error" } }; }
        if (!r.ok) {
          var err = new Error((data.error && data.error.message) || ("HTTP " + r.status));
          err.code = (data.error && data.error.code) || String(r.status);
          err.status = r.status;
          err.fields = (data.error && data.error.fields) || null;
          throw err;
        }
        return data;
      });
    });
  }

  return {
    get base() { return API_BASE; },
    get enabled() { return !!API_BASE; },
    get token() { return token; },
    setToken: setToken,
    setBase: function (b) {
      API_BASE = (b || "").replace(/\/+$/, "");
      try { localStorage.setItem("ns_api_base", API_BASE); } catch (e) {}
    },

    health: function () { return req("GET", "/api/health"); },
    // No OTP: a number is the whole login.
    signin: function (phone, name) { return req("POST", "/api/auth/signin", { phone: phone, name: name }); },
    me: function () { return req("GET", "/api/me"); },
    updateMe: function (patch) { return req("PATCH", "/api/me", patch); },
    logout: function () { return req("POST", "/api/auth/logout"); },
    deleteAccount: function () { return req("DELETE", "/api/me"); },
    adminElevate: function (secret) { return req("POST", "/api/admin/elevate", { secret: secret }); },
    adminStepDown: function () { return req("POST", "/api/admin/step-down"); },
    exportMe: function () { return req("GET", "/api/me/export"); },

    listings: function (params) {
      var qs = Object.keys(params || {}).filter(function (k) { return params[k] !== "" && params[k] != null; })
        .map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]); }).join("&");
      return req("GET", "/api/listings" + (qs ? "?" + qs : ""));
    },
    myListings: function () { return req("GET", "/api/listings/mine"); },
    listing: function (id) { return req("GET", "/api/listings/" + id); },
    createListing: function (d) { return req("POST", "/api/listings", d); },
    editListing: function (id, d) { return req("PATCH", "/api/listings/" + id, d); },
    deleteListing: function (id) { return req("DELETE", "/api/listings/" + id); },
    seller: function (id) { return req("GET", "/api/users/" + id); },

    pending: function () { return req("GET", "/api/admin/pending"); },
    approve: function (id) { return req("POST", "/api/admin/listings/" + id + "/approve"); },
    reject: function (id, reason) { return req("POST", "/api/admin/listings/" + id + "/reject", { reason: reason }); },

    conversations: function () { return req("GET", "/api/conversations"); },
    openConversation: function (lid) { return req("POST", "/api/conversations", { listing_id: lid }); },
    messages: function (cid) { return req("GET", "/api/conversations/" + cid + "/messages"); },
    sendMessage: function (cid, body) { return req("POST", "/api/conversations/" + cid + "/messages", { body: body }); },

    pushKey: function () { return req("GET", "/api/push/key"); },
    pushSubscribe: function (sub) { return req("POST", "/api/push/subscribe", sub); },
    pushUnsubscribe: function (ep) { return req("POST", "/api/push/unsubscribe", { endpoint: ep }); },
    pushTest: function () { return req("POST", "/api/push/test"); },

    notifications: function () { return req("GET", "/api/notifications"); },
    markRead: function () { return req("POST", "/api/notifications/read"); },

    mediaUrl: function (p) { return /^https?:/.test(p) ? p : url(p); }
  };
})();
