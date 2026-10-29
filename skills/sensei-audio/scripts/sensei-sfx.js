/*! sensei-sfx.js: procedural and sample SFX engine for single-file HTML (Web Audio only, no dependencies).
 *  Original code for HTML-Sensei, public domain (CC0) for reuse.
 *  Works on a live AudioContext and on an OfflineAudioContext (pass { ctx }), which is how it is tested.
 *
 *  SenseiSFX.create({ ctx, storageKey, startMuted, seed, calmSkip, reducedMotion })
 *    seed           every random choice (typewriter pitch, sample jitter, the noise buffer) comes from one seeded
 *                   generator, so two renders with the same seed are identical
 *    calmSkip       names that are not played when reduced motion is on (default: whoosh, whooshDown, impact);
 *                   their caption and flash still fire, confirmations still sound
 *    reducedMotion  true or false to force it; default: the prefers-reduced-motion media query
 *  verified: Windows 10, Chrome 155 headless (scripts/test-audio.mjs): every sound renders offline starting and ending
 *            at zero with no sample jump above 0.2; mute gives silence, volume 0.25 gives a quarter of the RMS; pan -1
 *            is left only; the look-ahead scheduler is exact with no late step; captions reach the live region; the
 *            same seed renders identical samples; calmSkip silences whooshes under reduced motion.
 *  not verified: audible quality (no listening here); Safari, Firefox, iOS (ringer switch, touchend unlock); real
 *                autoplay suspension (automated browsers carry user activation from navigation).
 *  Adapted from code-media/audio/sensei-sfx.js in the HTML-Sensei build project's research notes (not shipped) (original to this project); the seeded
 *  generator, calmSkip and reducedMotion are new here.
 */
(function (root) {
  'use strict';

  function createSFX(opts) {
    opts = opts || {};
    var storageKey = opts.storageKey || 'sensei-sfx';
    var injected = !!opts.ctx;            // tests: an OfflineAudioContext is injected
    var ctx = opts.ctx || null;
    var master = null, comp = null, noiseBuf = null;
    var samples = Object.create(null);
    var lastPlayed = Object.create(null); // per-sound cooldown (avoid machine-gun)
    var state = { volume: 0.8, muted: false };
    var announcer = null;
    var seed = (opts.seed == null ? 22222 : opts.seed) >>> 0;
    function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }   // seeded: deterministic
    var calmSkip = opts.calmSkip || ['whoosh', 'whooshDown', 'impact'];
    function calm() {
      if (opts.reducedMotion != null) return !!opts.reducedMotion;
      try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
    }

    // ---- persisted user preference (never assume storage works) ----
    try {
      var saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved) { state.volume = saved.volume; state.muted = !!saved.muted; }
    } catch (e) {}
    if (opts.startMuted) state.muted = true;
    function persist() { try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (e) {} }

    // ---- context + master chain ----
    function ensure() {
      if (ctx) return ctx;
      var AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC({ latencyHint: 'interactive' });
      build();
      return ctx;
    }
    function build() {
      master = ctx.createGain();
      master.gain.value = state.muted ? 0 : state.volume;
      // a gentle compressor so stacked sounds do not clip. Note: DynamicsCompressorNode adds automatic make-up gain
      // (tested: a 0.1 sine came out at 0.246 through threshold -30, ratio 20), so it also lifts quiet sounds; every
      // level measured in test-audio.mjs (loudest peak 0.71) includes it. It is not a brick-wall limiter.
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10; comp.knee.value = 12; comp.ratio.value = 8;
      comp.attack.value = 0.003; comp.release.value = 0.15;
      master.connect(comp); comp.connect(ctx.destination);
      // one second of white noise, reused by every noise-based sound
      var n = ctx.sampleRate | 0;
      noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = rnd() * 2 - 1;
    }
    if (injected) build();

    // Autoplay policy: a context is "suspended" until a user gesture. Resume on the first one.
    // iOS Safari needs resume() inside touchend (not touchstart); click/keydown cover the rest.
    function unlockOnGesture(target) {
      target = target || (root.document && root.document);
      if (!target) return;
      var evs = ['pointerup', 'touchend', 'click', 'keydown'];
      function go() {
        ensure();
        var p = ctx.resume && ctx.resume();
        function done() { if (ctx.state === 'running') evs.forEach(function (e) { target.removeEventListener(e, go, true); }); }
        if (p && p.then) p.then(done, function () {}); else done();
      }
      evs.forEach(function (e) { target.addEventListener(e, go, true); });
    }

    // ---- envelope helper: exponential ramps cannot reach 0 or start at 0 ----
    function env(g, t, peak, atk, dec, hold, rel) {
      var P = g.gain, floor = 0.0001;
      P.cancelScheduledValues(t);
      P.setValueAtTime(floor, t);
      P.exponentialRampToValueAtTime(Math.max(peak, floor), t + atk);
      P.setValueAtTime(Math.max(peak, floor), t + atk + hold);
      P.exponentialRampToValueAtTime(floor, t + atk + hold + dec + (rel || 0));
      return t + atk + hold + dec + (rel || 0);
    }
    function out(node, o) {
      var dest = master;
      if (o && o.pan && ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = o.pan; node.connect(p); p.connect(dest); return; }
      node.connect(dest);
    }
    function tone(o, t, type, f0, f1, peak, dur, pan) {
      var os = ctx.createOscillator(), g = ctx.createGain();
      os.type = type; os.frequency.setValueAtTime(f0, t);
      if (f1 && f1 !== f0) os.frequency.exponentialRampToValueAtTime(f1, t + dur);
      var end = env(g, t, peak, 0.004, dur, 0, 0.01);
      os.connect(g); out(g, { pan: pan });
      os.start(t); os.stop(end + 0.02);
      return end;
    }
    function noise(t, dur, peak, filt, f0, f1, q, pan) {
      var src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      var f = ctx.createBiquadFilter(); f.type = filt; f.Q.value = q || 1;
      f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      var g = ctx.createGain();
      var end = env(g, t, peak, dur * 0.35, dur * 0.65, 0, 0.02);
      src.connect(f); f.connect(g); out(g, { pan: pan });
      src.start(t); src.stop(end + 0.02);
      return end;
    }

    // ---- the synthesised library: each returns the time the sound ends ----
    var lib = {
      click: function (t, o) { return tone(o, t, 'square', 1800, 700, 0.18, 0.035, o.pan); },
      tick: function (t, o) { return tone(o, t, 'triangle', 2400, 2000, 0.12, 0.02, o.pan); },
      pop: function (t, o) { return tone(o, t, 'sine', 520, 160, 0.4, 0.09, o.pan); },
      toggleOn: function (t, o) { tone(o, t, 'sine', 600, 600, 0.22, 0.07, o.pan); return tone(o, t + 0.07, 'sine', 900, 900, 0.22, 0.09, o.pan); },
      toggleOff: function (t, o) { tone(o, t, 'sine', 900, 900, 0.22, 0.07, o.pan); return tone(o, t + 0.07, 'sine', 600, 600, 0.22, 0.09, o.pan); },
      whoosh: function (t, o) { return noise(t, o.dur || 0.45, 0.35, 'bandpass', 300, 5200, 1.2, o.pan); },
      whooshDown: function (t, o) { return noise(t, o.dur || 0.45, 0.35, 'bandpass', 5200, 300, 1.2, o.pan); },
      chime: function (t, o) { // additive bell: inharmonic partials decay at different rates
        var base = o.freq || 880, end = t, P = [[1, 1, 1.4], [2.76, 0.45, 0.9], [5.4, 0.2, 0.5], [8.93, 0.08, 0.3]];
        P.forEach(function (p) { end = Math.max(end, tone(o, t, 'sine', base * p[0], base * p[0], 0.25 * p[1], p[2], o.pan)); });
        return end;
      },
      success: function (t, o) { var e = 0; [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { e = lib.chime(t + i * 0.085, { freq: f, pan: o.pan }); }); return e; },
      error: function (t, o) { tone(o, t, 'sawtooth', 220, 180, 0.2, 0.12, o.pan); return tone(o, t + 0.13, 'sawtooth', 165, 120, 0.2, 0.2, o.pan); },
      impact: function (t, o) { var a = tone(o, t, 'sine', 140, 38, 0.8, 0.35, o.pan); return Math.max(a, noise(t, 0.18, 0.4, 'lowpass', 3000, 200, 0.7, o.pan)); },
      type: function (t, o) { return noise(t, 0.03, 0.2, 'highpass', 1500 + rnd() * 1500, 4000, 1, o.pan); }
    };

    // ---- public API ----
    var api = {
      get ctx() { return ctx; },
      get state() { return { volume: state.volume, muted: state.muted, ctx: ctx && ctx.state }; },
      ensure: ensure, unlockOnGesture: unlockOnGesture, library: lib, env: env,

      setVolume: function (v) { state.volume = Math.min(1, Math.max(0, v)); apply(); persist(); },
      setMuted: function (m) { state.muted = !!m; apply(); persist(); },
      toggleMute: function () { api.setMuted(!state.muted); return state.muted; },

      // play(name, { when, pan, rate, gain, cooldown, caption, flash })
      // `caption` is written to an aria-live region and `flash` receives a visual cue, so sound is never the only feedback.
      play: function (name, o) {
        o = o || {};
        if (!ensure()) return 0;
        if (o.caption) announce(o.caption);
        if (typeof o.flash === 'function') o.flash();
        if (state.muted) return 0;
        if (calm() && calmSkip.indexOf(name) >= 0) return 0;         // reduced motion: drop the motion sounds
        var now = ctx.currentTime, t = o.when != null ? o.when : now + 0.005;
        var cd = o.cooldown != null ? o.cooldown : 0.03;
        if (!injected && t - (lastPlayed[name] || -1) < cd && o.when == null) return 0;
        lastPlayed[name] = t;
        if (samples[name]) return playSample(name, t, o);
        if (!lib[name]) throw new Error('unknown sound: ' + name);
        return lib[name](t, o);
      },
      loadSample: function (name, data) { // data: ArrayBuffer | base64 string | data: URI
        ensure();
        var ab = typeof data === 'string' ? b64ToBuf(data.replace(/^data:[^,]*,/, '')) : data;
        return ctx.decodeAudioData(ab).then(function (b) { samples[name] = b; return b; });
      },
      // Look-ahead scheduler: JS timers only wake us; every sound is placed on the audio clock.
      scheduler: function (stepFn, bpm, stepsPerBeat) {
        var spb = stepsPerBeat || 4, stepDur = 60 / bpm / spb, nextT = 0, step = 0, timer = null, ahead = 0.1, tick = 25;
        function pump() {
          while (nextT < ctx.currentTime + ahead) { stepFn(step, nextT); nextT += stepDur; step++; }
        }
        return {
          start: function (at) { ensure(); nextT = at != null ? at : ctx.currentTime + 0.05; step = 0; pump(); timer = setInterval(pump, tick); },
          stop: function () { clearInterval(timer); },
          pumpOnce: pump, stepDur: stepDur
        };
      },
      // Fire a visual callback when the sound is actually heard (output latency compensated).
      atHeard: function (audioTime, fn) {
        var lat = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
        (function loop() {
          if (ctx.currentTime - lat >= audioTime) return fn();
          root.requestAnimationFrame(loop);
        })();
      },
      attachAnnouncer: function (el) { announcer = el; },
      suspendWhenHidden: function () {
        root.document.addEventListener('visibilitychange', function () {
          if (!ctx) return;
          if (root.document.hidden) ctx.suspend(); else if (!state.muted) ctx.resume();
        });
      }
    };

    function apply() {
      if (!master) return;
      // setTargetAtTime avoids zipper noise on volume changes
      master.gain.setTargetAtTime(state.muted ? 0 : state.volume, ctx.currentTime, 0.015);
    }
    function announce(text) {
      if (!announcer && root.document) {
        announcer = root.document.createElement('div');
        announcer.setAttribute('role', 'status'); announcer.setAttribute('aria-live', 'polite');
        announcer.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden';
        root.document.body.appendChild(announcer);
      }
      if (announcer) { announcer.textContent = ''; setTimeout(function () { announcer.textContent = text; }, 30); }
    }
    function playSample(name, t, o) {
      var src = ctx.createBufferSource(); src.buffer = samples[name];
      var rate = (o.rate || 1) * (o.jitter ? 1 + (rnd() * 2 - 1) * o.jitter : 1);
      src.playbackRate.value = rate;
      var g = ctx.createGain(); g.gain.value = o.gain == null ? 1 : o.gain;
      src.connect(g); out(g, { pan: o.pan });
      src.start(t);
      return t + samples[name].duration / rate;
    }
    function b64ToBuf(b64) {
      var bin = atob(b64), u = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return u.buffer;
    }
    api._master = function () { return master; };
    return api;
  }

  root.SenseiSFX = { create: createSFX };
  if (typeof module !== 'undefined') module.exports = root.SenseiSFX;
})(typeof window !== 'undefined' ? window : globalThis);
