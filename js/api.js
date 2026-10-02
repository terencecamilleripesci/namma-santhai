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

  var API_BASE = "";                       // <-- set to the funnel URL when live

  try {
    var q = new URLSearchParams(location.search).get("api");
    if (q) localStorage.setItem("ns_api_base", q.replace(/\/+$/, ""));
    API_BASE = localStorage.getItem("ns_api_base") || API_BASE;
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

    notifications: function () { return req("GET", "/api/notifications"); },
    markRead: function () { return req("POST", "/api/notifications/read"); },

    mediaUrl: function (p) { return /^https?:/.test(p) ? p : url(p); }
  };
})();
