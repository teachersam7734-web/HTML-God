/* lms.js: one small interface over SCORM 1.2, SCORM 2004 and cmi5 (xAPI). Classic script, no dependencies.
   window.LMS.connect() -> Promise<session>; session = { kind, resume:{location, suspend, entry, mastery}, limits,
   progress({location, suspend, scoreRaw, scoreMin, scoreMax, completed, passed}), finish(suspend) }.
   kind is 'cmi5' (all five launch parameters in the query), else 'scorm2004' (API_1484_11 up the parent chain or the
   opener's), else 'scorm12' (API), else 'none' (standalone: the same file runs with no LMS and progress() is a no-op).

   verified: Windows 10, Node 24, playwright-core 1.62.1, installed Chrome 155, against strict mock LMSs that enforce
             call order and data-model formats and limits (test-lms.mjs): API found through a parent frame; Initialize
             first, one Terminate last with Commit before it, nothing after; 2004 score.scaled 0.8000 and an ISO 8601
             session time; 1.2 passed is never overwritten by a later completed; reopening a finished attempt does not
             downgrade it; oversized suspend_data refused client-side; a cross-origin parent degrades to standalone
             with no exception; cmi5 fetches the token once, reads LMS.LaunchData, merges the LMS context template,
             sends initialized, passed, completed, terminated once each, Basic auth and the version header on every call,
             to an LRS on another origin.
   not verified: any real LMS or LRS (SCORM Cloud, Moodle, Canvas); cmi5 launchMode Browse and Review (LaunchData is
             read, only the context template is used); 1.2 mastery_score is read but not acted on; the cmi5 token is
             not cached, so a reload of the launch URL cannot re-fetch it (the fetch URL is single-use).
   Origin: code-apps/course/lms.js in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code). */
(function () {
  "use strict";

  /* ---- SCORM API discovery: parent chain (max 500 hops), then the opener's chain ---- */
  function findApi(win, name) {
    var n = 0;
    while (win && n++ < 500) {
      try { if (win[name]) return win[name]; } catch (e) { return null; } /* cross-origin parent: give up quietly */
      if (win.parent === win) break;
      win = win.parent;
    }
    return null;
  }
  function discover(name) {
    var a = null;
    try { a = findApi(window, name); } catch (e) {}
    if (!a) { try { if (window.opener) a = findApi(window.opener, name); } catch (e) {} }
    return a;
  }

  /* ---- time formats ---- */
  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = "0" + n; return n; }
  function scorm12Time(ms) { /* CMITimespan HH:MM:SS.SS (hours may exceed 2 digits, max 9999) */
    var s = ms / 1000, h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = (s % 60).toFixed(2);
    return pad(h, 4) + ":" + pad(m) + ":" + (sec.length < 5 ? "0" + sec : sec);
  }
  function iso8601Duration(ms) { /* PT#H#M#.##S */
    var s = ms / 1000, h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
    return "PT" + h + "H" + m + "M" + (s % 60).toFixed(2) + "S";
  }

  /* ---- SCORM 2004 and 1.2 sessions ---- */
  function scormSession(api, v2004) {
    var t0 = Date.now(), live = true, decided = false;
    var init = v2004 ? api.Initialize("") : api.LMSInitialize("");
    if (String(init) !== "true") return null;
    var get = function (k) { return v2004 ? api.GetValue(k) : api.LMSGetValue(k); };
    var set = function (k, val) { var r = v2004 ? api.SetValue(k, String(val)) : api.LMSSetValue(k, String(val)); return String(r) === "true"; };
    var commit = function () { return String(v2004 ? api.Commit("") : api.LMSCommit("")) === "true"; };
    var P = v2004 ? { loc: "cmi.location", susp: "cmi.suspend_data", raw: "cmi.score.raw", min: "cmi.score.min", max: "cmi.score.max", entry: "cmi.entry", mastery: "cmi.scaled_passing_score" }
                  : { loc: "cmi.core.lesson_location", susp: "cmi.suspend_data", raw: "cmi.core.score.raw", min: "cmi.core.score.min", max: "cmi.core.score.max", entry: "cmi.core.entry", mastery: "cmi.student_data.mastery_score" };
    var resume = { location: get(P.loc) || "", suspend: get(P.susp) || "", entry: get(P.entry) || "", mastery: get(P.mastery) || "" };
    var status = v2004 ? get("cmi.completion_status") : get("cmi.core.lesson_status");
    /* never downgrade a finished attempt when the learner re-opens the course */
    var already = v2004 ? (status === "completed" || get("cmi.success_status") === "passed") : (status === "passed" || status === "completed");
    if (!already) set(v2004 ? "cmi.completion_status" : "cmi.core.lesson_status", "incomplete");
    commit();
    var self = {
      kind: v2004 ? "scorm2004" : "scorm12", resume: resume, limits: { suspend: v2004 ? 64000 : 4096, location: v2004 ? 1000 : 255 },
      progress: function (o) {
        if (!live) return false;
        if (o.location != null) set(P.loc, String(o.location).slice(0, self.limits.location));
        if (o.suspend != null) {
          if (o.suspend.length > self.limits.suspend) { if (window.console) console.warn("suspend_data too long for this SCORM version: " + o.suspend.length); }
          else set(P.susp, o.suspend);
        }
        if (o.scoreRaw != null) {
          set(P.min, o.scoreMin != null ? o.scoreMin : 0); set(P.max, o.scoreMax != null ? o.scoreMax : 100); set(P.raw, o.scoreRaw);
          if (v2004) set("cmi.score.scaled", Math.max(-1, Math.min(1, (o.scoreRaw - (o.scoreMin || 0)) / ((o.scoreMax != null ? o.scoreMax : 100) - (o.scoreMin || 0)))).toFixed(4));
        }
        if (v2004) {
          if (o.completed != null) set("cmi.completion_status", o.completed ? "completed" : "incomplete");
          if (o.passed != null) set("cmi.success_status", o.passed ? "passed" : "failed");
        } else {
          /* 1.2 has ONE status field: passed/failed win over completed, and 'completed' must not overwrite 'passed' */
          if (o.passed != null) { set("cmi.core.lesson_status", o.passed ? "passed" : "failed"); decided = true; }
          else if (o.completed && !decided && !(already && status === "passed")) set("cmi.core.lesson_status", "completed");
        }
        return commit();
      },
      finish: function (suspend) {
        if (!live) return; live = false;
        var ms = Date.now() - t0;
        if (v2004) { set("cmi.session_time", iso8601Duration(ms)); set("cmi.exit", suspend ? "suspend" : "normal"); }
        else { set("cmi.core.session_time", scorm12Time(ms)); set("cmi.core.exit", suspend ? "suspend" : ""); }
        commit(); if (v2004) api.Terminate(""); else api.LMSFinish("");
      }
    };
    return self;
  }

  /* ---- cmi5 / xAPI ---- */
  function uuid() { return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, function (c) { return (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4)).toString(16); }); }
  var V = { initialized: "http://adlnet.gov/expapi/verbs/initialized", completed: "http://adlnet.gov/expapi/verbs/completed", passed: "http://adlnet.gov/expapi/verbs/passed", failed: "http://adlnet.gov/expapi/verbs/failed", terminated: "http://adlnet.gov/expapi/verbs/terminated" };
  function cmi5Session(q) {
    var endpoint = q.endpoint.replace(/\/?$/, "/"), actor = JSON.parse(q.actor), reg = q.registration, activityId = q.activityId, t0 = Date.now(), auth = null, sessionId = uuid(), sent = {}, launch = null;
    var H = function () { return { "Content-Type": "application/json", "X-Experience-API-Version": "1.0.3", Authorization: "Basic " + auth }; };
    function stmt(verb, result) {
      var s = { id: uuid(), actor: actor, verb: { id: V[verb], display: { "en-US": verb } }, object: { id: activityId, objectType: "Activity" }, timestamp: new Date().toISOString(),
        context: { registration: reg, contextActivities: { category: [{ id: "https://w3id.org/xapi/cmi5/context/categories/cmi5" }] }, extensions: { "https://w3id.org/xapi/cmi5/context/extensions/sessionid": sessionId } } };
      if (launch && launch.contextTemplate) { /* merge the LMS's template: it may add grouping and extensions that must be kept */
        var ct = launch.contextTemplate; if (ct.contextActivities && ct.contextActivities.grouping) s.context.contextActivities.grouping = ct.contextActivities.grouping;
        if (ct.extensions) Object.keys(ct.extensions).forEach(function (k) { s.context.extensions[k] = ct.extensions[k]; });
      }
      if (result) s.result = result;
      return fetch(endpoint + "statements", { method: "POST", headers: H(), body: JSON.stringify(s), keepalive: true });
    }
    /* the fetch URL is single-use: call it exactly once, keep the token */
    var ready = fetch(q.fetch, { method: "POST" }).then(function (r) { return r.json(); }).then(function (j) {
      auth = j["auth-token"];
      return fetch(endpoint + "activities/state?stateId=LMS.LaunchData&activityId=" + encodeURIComponent(activityId) + "&agent=" + encodeURIComponent(JSON.stringify(actor)) + "&registration=" + encodeURIComponent(reg), { headers: H() });
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (ld) { launch = ld; return stmt("initialized"); });
    var self = {
      kind: "cmi5", resume: { location: "", suspend: "" }, ready: ready,
      progress: function (o) {
        return ready.then(function () {
          var out = [];
          var res = {}; if (o.scoreRaw != null) { var min = o.scoreMin || 0, max = o.scoreMax != null ? o.scoreMax : 100; res.score = { scaled: (o.scoreRaw - min) / (max - min), raw: o.scoreRaw, min: min, max: max }; }
          /* order matters: passed|failed, then completed; each at most once per session */
          if (o.passed != null && !sent.pf) { sent.pf = 1; out.push(stmt(o.passed ? "passed" : "failed", Object.assign({ success: !!o.passed }, res, { duration: iso8601Duration(Date.now() - t0) }))); }
          if (o.completed && !sent.c) { sent.c = 1; out.push(stmt("completed", { completion: true, duration: iso8601Duration(Date.now() - t0) })); }
          return Promise.all(out);
        });
      },
      finish: function () { if (sent.t) return Promise.resolve(); sent.t = 1; return ready.then(function () { return stmt("terminated", { duration: iso8601Duration(Date.now() - t0) }); }); }
    };
    return self;
  }

  var none = { kind: "none", resume: { location: "", suspend: "" }, progress: function () { return false; }, finish: function () {} };
  window.LMS = {
    scorm12Time: scorm12Time, iso8601Duration: iso8601Duration, discover: discover,
    connect: function () {
      var qs = new URLSearchParams(location.search);
      if (qs.get("endpoint") && qs.get("fetch") && qs.get("actor") && qs.get("registration") && qs.get("activityId")) {
        var s = cmi5Session({ endpoint: qs.get("endpoint"), fetch: qs.get("fetch"), actor: qs.get("actor"), registration: qs.get("registration"), activityId: qs.get("activityId") });
        return s.ready.then(function () { return s; });
      }
      var a2004 = discover("API_1484_11"), s = a2004 && scormSession(a2004, true);
      if (s) return Promise.resolve(s);
      var a12 = discover("API"); s = a12 && scormSession(a12, false);
      return Promise.resolve(s || none);
    }
  };
})();
