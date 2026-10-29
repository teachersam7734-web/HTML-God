/* game-core.js: fixed-timestep loop, input manager, versioned save. Classic script, no dependencies.
   window.GameCore = { Loop, Input, Save }  (also module.exports under Node, for pure tests)

   HTML-Sensei's own code, from the research lane's code-apps/game/core.js, with three fixes made while writing
   sensei-games (each has an assertion in test-game.mjs):
     1. pauseOnHidden:false used to pause on hidden and never resume; it now ignores visibility (and drops the gap).
     2. A key pressed and released between two fixed steps was lost; presses are now latched until sampled.
     3. Input.destroy() now removes its visibilitychange listener.

   verified: Windows 10, Node 24, installed Chrome 155 headless through Playwright 1.63, strict file:// (test-game.mjs):
             byte-identical state at 30, 60, 144 and 240 Hz and with jitter; stall clamp; hidden pause and resume
             without catch-up; edges, latched taps, diagonal, stuck keys, preventDefault rules, rebinding, toggle mode,
             pointer stick with capture, mocked gamepad; saves (reload, migration, corrupt, newer, blocked, autosave).
   not verified: real gamepads (navigator.getGamepads was mocked), real touch screens, Firefox and Safari. */
(function (root) {
  "use strict";

  /* ================= Loop: fixed timestep with accumulator and interpolation =================
     update(dt) runs at a constant `step` seconds, as many times as the wall clock demands.
     render(alpha) runs once per frame; alpha in [0,1) is how far we are into the next step.
     advance(ms) is the SAME code path the rAF callback uses, so tests can drive any frame pattern.
     Reduced motion: this loop is the game's simulation and must keep running under prefers-reduced-motion; the game
     itself turns off decorative motion (shake, flashes, camera bob, particles) and offers a slower speed. */
  function Loop(o) {
    this.step = o.step || 1 / 60;
    this.maxFrame = o.maxFrame || 0.25;          /* clamp one frame to 250 ms: no spiral of death after a stall */
    this.maxSteps = o.maxSteps || 10;            /* hard cap on steps per frame */
    this.update = o.update; this.render = o.render || function () {};
    this.onPause = o.onPause || function () {}; this.onResume = o.onResume || function () {};
    this.acc = 0; this.last = null; this.raf = 0; this.running = false; this.userPaused = false; this.autoPaused = false;
    this.steps = 0; this.frames = 0; this.dropped = 0; this.timeScale = 1;
    this.pauseOnHidden = o.pauseOnHidden !== false;
    this.pauseOnBlur = !!o.pauseOnBlur;
    var self = this;
    this._frame = function (now) { self.raf = requestAnimationFrame(self._frame); self.advance(now); };
    this._vis = function () {
      if (self.pauseOnHidden) { self._auto(document.hidden); return; }
      if (!document.hidden) { self.last = null; self.acc = 0; }  /* not pausing, but never replay the hidden gap */
    };
    this._blur = function () { if (self.pauseOnBlur) self._auto(true); };
    this._focus = function () { if (self.pauseOnBlur && !document.hidden) self._auto(false); };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this._vis);
      addEventListener("blur", this._blur); addEventListener("focus", this._focus);
    }
  }
  Loop.prototype.advance = function (nowMs) {
    if (this.last === null) { this.last = nowMs; this.render(this.acc / this.step); return; }
    var dt = (nowMs - this.last) / 1000; this.last = nowMs;
    if (this.userPaused || this.autoPaused) { this.render(this.acc / this.step); return; }
    if (dt > this.maxFrame) { this.dropped += dt - this.maxFrame; dt = this.maxFrame; }
    if (dt < 0) dt = 0;
    this.acc += dt * this.timeScale; var n = 0;
    while (this.acc >= this.step) {
      if (n >= this.maxSteps) { this.dropped += this.acc - this.step; this.acc = 0; break; }
      this.update(this.step); this.acc -= this.step; this.steps++; n++;
    }
    this.frames++; this.render(this.acc / this.step);
  };
  Loop.prototype.start = function () { if (this.running) return; this.running = true; this.last = null; this.raf = requestAnimationFrame(this._frame); };
  Loop.prototype.stop = function () { this.running = false; cancelAnimationFrame(this.raf); };
  Loop.prototype._auto = function (on) {
    if (on === this.autoPaused) return;
    this.autoPaused = on;
    if (!on) { this.last = null; this.acc = 0; }   /* resume without catch-up: drop the hidden time */
    (on ? this.onPause : this.onResume).call(this, "auto");
  };
  /* user pause: call from a key or button handler OUTSIDE update(), which does not run while paused */
  Loop.prototype.setPaused = function (p) { this.userPaused = p; if (!p) { this.last = null; this.acc = 0; } (p ? this.onPause : this.onResume).call(this, "user"); };
  Loop.prototype.setPauseOnBlur = function (v) { this.pauseOnBlur = !!v; if (!v && this.autoPaused && !document.hidden) this._auto(false); };
  Loop.prototype.destroy = function () {
    this.stop();
    if (typeof document !== "undefined") { document.removeEventListener("visibilitychange", this._vis); removeEventListener("blur", this._blur); removeEventListener("focus", this._focus); }
  };

  /* ================= Input: sampled once per fixed step ================= */
  function Input(el, o) {
    o = o || {};
    this.bind = Object.assign({ left: ["ArrowLeft", "KeyA"], right: ["ArrowRight", "KeyD"], up: ["ArrowUp", "KeyW"], down: ["ArrowDown", "KeyS"], jump: ["Space"], pause: ["Escape", "KeyP"] }, o.bind || {});
    this.dead = o.deadzone != null ? o.deadzone : 0.2;
    this.down = {}; this.raw = {}; this.latched = {}; this.stick = { x: 0, y: 0 }; this.phys = {};
    this.pressed = {}; this.released = {}; this.move = { x: 0, y: 0 };
    this.toggleMode = {}; this.toggled = {};
    var self = this, gameKeys = function () { var s = {}; Object.keys(self.bind).forEach(function (a) { self.bind[a].forEach(function (c) { s[c] = 1; }); }); return s; };
    /* key by e.code (physical position: WASD stays WASD on AZERTY), never by e.key */
    this._kd = function (e) {
      if (e.repeat) return; if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (gameKeys()[e.code]) { e.preventDefault(); self.raw[e.code] = true; self.latched[e.code] = true; }
    };
    this._ku = function (e) { if (self.raw[e.code]) { self.raw[e.code] = false; e.preventDefault(); } };
    /* a key held when the window loses focus never sends keyup: release everything (stuck-key trap) */
    this._clear = function () { self.raw = {}; self.latched = {}; self.stick = { x: 0, y: 0 }; self.pointerId = null; };
    this._vis = function () { if (document.hidden) self._clear(); };
    addEventListener("keydown", this._kd); addEventListener("keyup", this._ku); addEventListener("blur", this._clear);
    document.addEventListener("visibilitychange", this._vis);
    /* virtual stick: pointer anywhere on the element; capture so a drag leaving the canvas still tracks */
    this.pointerId = null; this.origin = null; this.radius = o.radius || 60;
    if (el) {
      el.addEventListener("pointerdown", function (e) { if (self.pointerId !== null) return; self.pointerId = e.pointerId; self.origin = { x: e.clientX, y: e.clientY }; try { el.setPointerCapture(e.pointerId); } catch (x) {} });
      el.addEventListener("pointermove", function (e) { if (e.pointerId !== self.pointerId) return; var dx = (e.clientX - self.origin.x) / self.radius, dy = (e.clientY - self.origin.y) / self.radius, m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } self.stick = { x: dx, y: dy }; });
      var up = function (e) { if (e.pointerId !== self.pointerId) return; self.pointerId = null; self.stick = { x: 0, y: 0 }; };
      el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    }
  }
  Input.prototype.isDown = function (a) { var self = this; return this.bind[a].some(function (c) { return self.raw[c]; }) || false; };
  Input.prototype._wasTapped = function (a) { var self = this; return this.bind[a].some(function (c) { return self.latched[c]; }); };
  /* sample(): call once at the START of each fixed update; gives edges that are true for exactly one step */
  Input.prototype.sample = function () {
    var self = this, actions = Object.keys(this.bind);
    var physPrev = this.phys || {}; this.down = {};
    var gp = (typeof navigator !== "undefined" && navigator.getGamepads && navigator.getGamepads()) || [], g = null;
    for (var i = 0; i < gp.length; i++) if (gp[i] && gp[i].connected) { g = gp[i]; break; }
    var ax = 0, ay = 0, pb = {};
    if (g) {
      /* radial deadzone with rescale, so the stick leaves 0 smoothly rather than jumping to the deadzone value */
      var x = g.axes[0] || 0, y = g.axes[1] || 0, m = Math.hypot(x, y);
      if (m > this.dead) { var k = (m - this.dead) / (1 - this.dead) / m; ax = x * k; ay = y * k; }
      pb.jump = !!(g.buttons[0] && g.buttons[0].pressed); pb.pause = !!(g.buttons[9] && g.buttons[9].pressed);
      if (g.buttons[14] && g.buttons[14].pressed) ax = -1; if (g.buttons[15] && g.buttons[15].pressed) ax = 1;   /* d-pad */
      if (g.buttons[12] && g.buttons[12].pressed) ay = -1; if (g.buttons[13] && g.buttons[13].pressed) ay = 1;
    }
    /* physical state: held now, or pressed since the last sample (a tap shorter than one step is not lost) */
    var tapped = {}, padPrev = this.padPrev || {};
    actions.forEach(function (a) { tapped[a] = self._wasTapped(a); self.down[a] = self.isDown(a) || !!pb[a] || tapped[a]; });
    this.latched = {}; this.padPrev = pb;
    this.phys = Object.assign({}, this.down);           /* edges come from THIS, so toggle mode cannot corrupt them */
    var kx = (this.isDown("right") ? 1 : 0) - (this.isDown("left") ? 1 : 0), ky = (this.isDown("down") ? 1 : 0) - (this.isDown("up") ? 1 : 0);
    var mx = kx + ax + this.stick.x, my = ky + ay + this.stick.y, mm = Math.hypot(mx, my);
    if (mm > 1) { mx /= mm; my /= mm; }                   /* diagonal is not faster */
    this.move = { x: mx, y: my };
    this.pressed = {}; this.released = {};
    /* pressed: a keydown arrived since the last sample, or a pad button went down; released: was down, is not now */
    actions.forEach(function (a) {
      self.pressed[a] = tapped[a] || (!!pb[a] && !padPrev[a]);
      self.released[a] = !!physPrev[a] && !self.isDown(a) && !pb[a] && !tapped[a];
    });
    /* accessibility: any action can be a toggle instead of a hold */
    actions.forEach(function (a) { if (self.toggleMode[a]) { if (self.pressed[a]) self.toggled[a] = !self.toggled[a]; self.down[a] = !!self.toggled[a]; } });
    return this;
  };
  Input.prototype.rebind = function (action, codes) { this.bind[action] = codes; };
  Input.prototype.destroy = function () {
    removeEventListener("keydown", this._kd); removeEventListener("keyup", this._ku); removeEventListener("blur", this._clear);
    document.removeEventListener("visibilitychange", this._vis);
  };

  /* ================= Save: versioned, migrating, never throws ================= */
  function Save(key, version, migrations, defaults) {
    var mem = null;
    this.key = key; this.version = version;
    this.load = function () {
      var raw = null;
      try { raw = mem != null ? mem : localStorage.getItem(key); } catch (e) { raw = mem; }
      if (!raw) return JSON.parse(JSON.stringify(defaults));
      try {
        var o = JSON.parse(raw); if (!o || typeof o !== "object" || typeof o.v !== "number") throw new Error("bad");
        while (o.v < version) { var m = migrations[o.v]; if (!m) throw new Error("no migration from " + o.v); o.data = m(o.data); o.v++; }
        if (o.v > version) throw new Error("saved by a newer build");     /* never silently downgrade */
        return Object.assign(JSON.parse(JSON.stringify(defaults)), o.data);
      } catch (e) { this.lastError = String(e.message || e); return JSON.parse(JSON.stringify(defaults)); }
    };
    this.save = function (data) {
      var s = JSON.stringify({ v: version, t: Date.now(), data: data });
      try { localStorage.setItem(key, s); mem = null; return true; } catch (e) { mem = s; return false; }
    };
    this.exportCode = function () { try { return mem != null ? mem : localStorage.getItem(key) || ""; } catch (e) { return mem || ""; } };
  }
  /* wire autosave to the events that DO fire on mobile; unload does not */
  Save.autosave = function (fn) {
    document.addEventListener("visibilitychange", function () { if (document.hidden) fn(); });
    addEventListener("pagehide", fn);
  };
  var api = { Loop: Loop, Input: Input, Save: Save };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.GameCore = api;
})(typeof window !== "undefined" ? window : null);
