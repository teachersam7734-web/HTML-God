/* engine.js: the HTML-Sensei course engine. Storage shim, six question types, grading, retry policy, versioned
   progress. Classic script, no modules and no dependencies, so it runs from file:// and inlines into one file.
   Exposes window.CourseEngine = { makeStore, mount, grade, makeProgress, esc, norm }.

   verified: Windows 10, Node 24, playwright-core 1.62.1 with installed Chrome 155, strict file:// (test-course.mjs):
             every question type answered by keyboard; axe-core clean in three states; feedback region is role=status
             before it has text; a retry never reveals the key; empty submit refused without using an attempt;
             progress survives a reload; the progress code round-trips and refuses garbage without writing; storage
             blocked (getter throws SecurityError) and storage full (setItem throws QuotaExceededError) each keep the
             course working from memory with a distinct cause; unversioned progress migrates to schema 1; progress
             from a newer schema is kept untouched and the session runs read-only in memory.
   not verified: Firefox and Safari; screen-reader speech; real phones and touch.
   Origin: code-apps/course/engine.js in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code), extended here with the storage
   cause words, a validated progress code and versioned progress, after Ultra Bookworm's Store (app/app.js in the owner's Ultra Bookworm project (not shipped)). */
(function () {
  "use strict";
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  /* ---------- storage: namespaced, never throws, falls back to memory ----------
     Chrome gives every file:// page ONE shared localStorage bucket, so keys carry the course's namespace. Firefox on
     file://, private modes and blocked site data throw on access ("blocked"); a write can throw later when the quota
     is reached ("full"). Either way the course keeps working from memory, and once a key lives in memory, memory is
     what get() reads (reading the stale stored value back was a real Ultra Bookworm bug). onFail is told once. */
  function makeStore(ns) {
    var backend = null, mem = {}, cause = "";
    try { localStorage.setItem("__t", "1"); localStorage.removeItem("__t"); backend = localStorage; } catch (e) { backend = null; cause = "blocked"; }
    var K = ns + ":";
    var api = {
      persistent: !!backend,
      cause: function () { return cause; },
      onFail: null,
      get: function (k, d) {
        try { var v = k in mem ? mem[k] : backend ? backend.getItem(K + k) : null; return v == null ? d : JSON.parse(v); } catch (e) { return d; }
      },
      set: function (k, v) {
        var s = JSON.stringify(v);
        if (!backend || k in mem) { mem[k] = s; if (!backend) return false; }
        try { backend.setItem(K + k, s); delete mem[k]; return true; }
        catch (e) {
          mem[k] = s;
          if (!cause) { cause = "full"; api.persistent = false; if (api.onFail) api.onFail(cause); }
          return false;
        }
      },
      /* a portable progress code, so a learner can move machines or outlast blocked storage */
      dump: function (keys) {
        var o = {}; keys.forEach(function (k) { o[k] = api.get(k, null); });
        return "CE1." + btoa(unescape(encodeURIComponent(JSON.stringify(o))));
      },
      /* throws on anything that is not a progress code, and then writes nothing */
      load: function (code) {
        var c = String(code || "").replace(/\s+/g, "").replace(/^CE1\./, "");
        var o = JSON.parse(decodeURIComponent(escape(atob(c))));
        if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("not a progress code");
        Object.keys(o).forEach(function (k) { api.set(k, o[k]); });
        return Object.keys(o).length;
      }
    };
    return api;
  }

  /* ---------- grading: each type returns {score 0..1, ok} ---------- */
  var norm = function (s) { return String(s).toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim(); };
  var grade = {
    mcq: function (q, r) { var ok = r === q.answer; return { score: ok ? 1 : 0, ok: ok }; },
    tfng: function (q, r) { var ok = r === q.answer; return { score: ok ? 1 : 0, ok: ok }; },
    multi: function (q, r) { /* partial credit with a penalty for wrong picks, floored at 0 */
      var a = q.answer, got = (r || []).slice().sort(), hit = got.filter(function (i) { return a.indexOf(i) >= 0; }).length, bad = got.length - hit;
      var s = Math.max(0, (hit - bad) / a.length); return { score: s, ok: s === 1 && bad === 0 };
    },
    gap: function (q, r) { var ok = q.answer.some(function (a) { return norm(a) === norm(r || ""); }); return { score: ok ? 1 : 0, ok: ok }; },
    order: function (q, r) { var ok = JSON.stringify(r) === JSON.stringify(q.answer); var n = 0; (r || []).forEach(function (v, i) { if (v === q.answer[i]) n++; }); return { score: n / q.answer.length, ok: ok }; },
    match: function (q, r) { var n = 0; q.pairs.forEach(function (p, i) { if (r && r[i] === p[1]) n++; }); return { score: n / q.pairs.length, ok: n === q.pairs.length }; }
  };

  /* ---------- renderers: build the control, return {read(), lock(), mark()} ---------- */
  var uid = 0;
  function groupOpen(q, id) {
    return '<fieldset class="q" data-type="' + q.type + '"><legend id="' + id + '-l">' + esc(q.prompt) + "</legend>";
  }
  var render = {
    mcq: function (q, host) {
      var id = "q" + ++uid;
      host.innerHTML = groupOpen(q, id) + q.options.map(function (o, i) {
        return '<label class="opt"><input type="radio" name="' + id + '" value="' + i + '"><span>' + esc(o) + "</span></label>";
      }).join("") + "</fieldset>";
      return {
        read: function () { var c = host.querySelector("input:checked"); return c ? +c.value : null; },
        lock: function () { host.querySelectorAll("input").forEach(function (i) { i.disabled = true; }); },
        mark: function (q) { host.querySelectorAll(".opt").forEach(function (l, i) { if (i === q.answer) l.insertAdjacentHTML("beforeend", '<span class="sr-only"> (correct answer)</span>'); }); }
      };
    },
    multi: function (q, host) {
      var id = "q" + ++uid;
      host.innerHTML = groupOpen(q, id) + q.options.map(function (o, i) {
        return '<label class="opt"><input type="checkbox" value="' + i + '"><span>' + esc(o) + "</span></label>";
      }).join("") + "</fieldset>";
      return {
        read: function () { return [].map.call(host.querySelectorAll("input:checked"), function (i) { return +i.value; }); },
        lock: function () { host.querySelectorAll("input").forEach(function (i) { i.disabled = true; }); },
        mark: function (q) { host.querySelectorAll(".opt").forEach(function (l, i) { if (q.answer.indexOf(i) >= 0) l.insertAdjacentHTML("beforeend", '<span class="sr-only"> (correct answer)</span>'); }); }
      };
    },
    gap: function (q, host) {
      var id = "q" + ++uid;
      host.innerHTML = '<div class="q" data-type="gap"><label for="' + id + '">' + esc(q.prompt) + '</label><input id="' + id + '" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"></div>';
      var inp = host.querySelector("input");
      return { read: function () { return inp.value; }, lock: function () { inp.readOnly = true; }, mark: function () {} };
    },
    order: function (q, host) {
      /* Drag is never the only way: each row has Move up and Move down buttons, and Alt+Arrow moves the focused row. */
      var id = "q" + ++uid, items = q.items.map(function (_, i) { return i; }).reverse();
      if (JSON.stringify(items) === JSON.stringify(q.answer)) items.push(items.shift());
      function paint(focusIdx) {
        host.innerHTML = '<fieldset class="q" data-type="order"><legend>' + esc(q.prompt) + '</legend><p class="hint" id="' + id + '-h">Use the buttons, or Alt with the arrow keys, to move an item.</p><ol aria-describedby="' + id + '-h">' +
          items.map(function (v) { return '<li data-v="' + v + '"><span class="t">' + esc(q.items[v]) + '</span> <button type="button" data-d="-1" aria-label="Move ' + esc(q.items[v]) + ' up">Up</button><button type="button" data-d="1" aria-label="Move ' + esc(q.items[v]) + ' down">Down</button></li>'; }).join("") +
          '</ol><div class="sr-only" aria-live="polite" id="' + id + '-live"></div></fieldset>';
        if (focusIdx != null) { var b = host.querySelectorAll("li")[focusIdx]; if (b) b.querySelector("button[data-d='" + (host._lastD || 1) + "']").focus(); }
      }
      function move(i, d) {
        var j = i + d; if (j < 0 || j >= items.length) return;
        var t = items[i]; items[i] = items[j]; items[j] = t; host._lastD = d; paint(j);
        host.querySelector("#" + id + "-live").textContent = q.items[t] + " moved to position " + (j + 1) + " of " + items.length;
      }
      paint();
      host.addEventListener("click", function (e) { var b = e.target.closest("button[data-d]"); if (!b || host.dataset.locked) return; move([].indexOf.call(host.querySelectorAll("li"), b.closest("li")), +b.dataset.d); });
      host.addEventListener("keydown", function (e) { if (!e.altKey || host.dataset.locked) return; var li = e.target.closest("li"); if (!li) return; var d = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0; if (!d) return; e.preventDefault(); move([].indexOf.call(host.querySelectorAll("li"), li), d); });
      return { read: function () { return items.slice(); }, lock: function () { host.dataset.locked = "1"; host.querySelectorAll("button").forEach(function (b) { b.disabled = true; }); }, mark: function () {} };
    },
    match: function (q, host) {
      /* Matching as one native <select> per row: works with every input method and every screen reader. */
      var id = "q" + ++uid, opts = q.pairs.map(function (p) { return p[1]; });
      host.innerHTML = '<fieldset class="q" data-type="match"><legend>' + esc(q.prompt) + "</legend>" + q.pairs.map(function (p, i) {
        return '<div class="row"><label for="' + id + "-" + i + '">' + esc(p[0]) + '</label><select id="' + id + "-" + i + '"><option value="">Choose</option>' + opts.map(function (o) { return "<option>" + esc(o) + "</option>"; }).join("") + "</select></div>";
      }).join("") + "</fieldset>";
      return { read: function () { return [].map.call(host.querySelectorAll("select"), function (s) { return s.value; }); }, lock: function () { host.querySelectorAll("select").forEach(function (s) { s.disabled = true; }); }, mark: function () {} };
    }
  };
  render.tfng = function (q, host) { return render.mcq({ type: "tfng", prompt: q.prompt, options: ["True", "False", "Not Given"], answer: q.answer }, host); };

  /* ---------- a question block: Check button, polite live feedback, explanation, retry policy ---------- */
  function mount(q, host, opts) {
    opts = opts || {};
    var box = document.createElement("div"); box.className = "qwrap";
    var body = document.createElement("div");
    var fb = document.createElement("div"); fb.className = "fb"; fb.setAttribute("role", "status"); /* the live region exists BEFORE it gets text */
    var btn = document.createElement("button"); btn.type = "button"; btn.className = "check"; btn.textContent = "Check answer";
    box.appendChild(body); box.appendChild(btn); box.appendChild(fb); host.appendChild(box);
    var ctl = render[q.type](q, body), tries = 0, result = null, maxTries = opts.attempts || 1;
    btn.addEventListener("click", function () {
      var r = ctl.read();
      var empty = r == null || r === "" || (Array.isArray(r) && !r.length) || (Array.isArray(r) && q.type === "match" && r.some(function (x) { return !x; }));
      if (empty) { fb.textContent = "Choose an answer first."; fb.className = "fb warn"; return; }
      tries++; result = grade[q.type](q, r); result.response = r; result.tries = tries;
      if (result.ok || tries >= maxTries) {
        ctl.lock(); ctl.mark(q); btn.disabled = true;
        fb.className = "fb " + (result.ok ? "ok" : "no");
        fb.textContent = (result.ok ? "Correct. " : "Not quite. ") + (q.explain || "");
        if (opts.onDone) opts.onDone(result);
      } else {
        fb.className = "fb warn"; fb.textContent = "Not quite. Try again (" + (maxTries - tries) + " left)."; /* never reveal the key on a retry */
      }
    });
    return { result: function () { return result; } };
  }

  /* ---------- progress: per lesson {status, score, tries, t}, stored as {schema, lessons} ----------
     opts.schema (default 1) is the shape this build writes; opts.migrate maps an older schema number to a function
     that returns the next one (unversioned data counts as schema 0). Progress from a NEWER build is never misread or
     overwritten: the session runs from memory and readOnly() is true, so the page can say so. */
  function makeProgress(store, lessons, passMark, opts) {
    opts = opts || {};
    var SCHEMA = opts.schema || 1, migrate = opts.migrate || {}, readOnly = false;
    var raw = store.get("progress", null), data = {};
    if (raw && typeof raw === "object") {
      var v = typeof raw.schema === "number" ? raw.schema : 0, body = v === 0 ? raw : raw.lessons || {};
      if (v > SCHEMA) { readOnly = true; data = JSON.parse(JSON.stringify(body)); }
      else {
        while (v < SCHEMA) { body = migrate[v] ? migrate[v](body) : body; v++; }
        data = body;
      }
    }
    function save() { if (!readOnly) store.set("progress", { schema: SCHEMA, lessons: data }); }
    if (raw && !readOnly && raw.schema !== SCHEMA) save();
    return {
      readOnly: function () { return readOnly; },
      get: function (id) { return data[id] || { status: "not attempted" }; },
      record: function (id, score) { var p = data[id] || { tries: 0 }; p.tries++; p.score = Math.max(p.score || 0, score); p.status = p.score >= passMark ? "passed" : "attempted"; p.t = Date.now(); data[id] = p; save(); return p; },
      course: function () {
        var ids = lessons.map(function (l) { return l.id; }), done = ids.filter(function (i) { return data[i] && data[i].status === "passed"; }).length;
        var avg = ids.reduce(function (s, i) { return s + ((data[i] && data[i].score) || 0); }, 0) / ids.length;
        return { done: done, total: ids.length, avg: avg, passed: done === ids.length, completed: ids.every(function (i) { return data[i]; }) };
      }
    };
  }
  window.CourseEngine = { makeStore: makeStore, mount: mount, grade: grade, makeProgress: makeProgress, esc: esc, norm: norm };
})();
