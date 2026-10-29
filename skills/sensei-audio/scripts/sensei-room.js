/*! sensei-room.js: sound in one room. A small palette of synthesised materials (glass, wood, air, sub) that all
 *  share one reverb, with the send set by distance, a ceiling on every peak, and sound driven from continuous curves.
 *  Original code for HTML-Sensei, public domain (CC0) for reuse. Web Audio only, no dependencies.
 *
 *  const room = SenseiRoom.create(ctx, { t60: 1.1, predelay: 0.012, ceilingDb: -8, wetTrim: 1, seed: 7, destination })
 *  room.glass(t, { dist: 0.3, freq: 1800, gain: 1 })   wood(t, o)   sub(t, o)   air(t, { dur, dist, from, to })
 *  room.airFromCurve(t, speeds, dur, o)   a whoosh whose loudness and brightness follow an array (camera speed, drag speed)
 *  room.bus(dist)                         a GainNode to connect your own source into, sent to the room by distance
 *  room.impulse                           the AudioBuffer of the synthetic room (for tests)
 *
 *  The ideas (and nothing else) come from the onetake film skill's sound notes (ideas only, no code taken; its
 *  licence is recorded in references/sources-and-licences.md): raw sines read as chiptune, so real objects get inharmonic partials plus a short noise transient;
 *  one sound per event is a slot machine, so use fewer events than beats; every sound shares a single room (about
 *  1.1 s T60, 12 ms pre-delay, send 15 to 70 per cent by distance); palette peaks at -8 dBFS; drive sound from
 *  continuous curves. The partial ratios, envelopes and the impulse generator are this project's own.
 *  verified: Windows 10, Chrome 155 headless, OfflineAudioContext (scripts/test-audio.mjs): the impulse falls by 60 dB
 *            (within 3 dB) at its T60; every material starts and ends at zero, peaks at or under the ceiling, and
 *            carries more tail energy at distance 1 than at distance 0; airFromCurve follows its curve (louder where
 *            the curve is high); the same seed gives the same impulse.
 *  not verified: how it sounds (no listening was possible here: tune by ear on real speakers and headphones);
 *                Safari and Firefox.
 */
(function (root) {
  'use strict';

  function create(ctx, opts) {
    opts = opts || {};
    var t60 = opts.t60 || 1.1, predelay = opts.predelay == null ? 0.012 : opts.predelay;
    var ceiling = Math.pow(10, (opts.ceilingDb == null ? -8 : opts.ceilingDb) / 20);
    var seed = (opts.seed == null ? 7 : opts.seed) >>> 0;
    function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }

    // ---- the room: exponentially decaying noise, darker as it decays (high frequencies die first) ----
    var sr = ctx.sampleRate, len = Math.ceil((predelay + t60 * 1.15) * sr);
    var ir = ctx.createBuffer(2, len, sr);
    for (var ch = 0; ch < 2; ch++) {
      var d = ir.getChannelData(ch), lp = 0;
      for (var i = Math.floor(predelay * sr); i < len; i++) {
        var t = i / sr - predelay;
        var amp = Math.pow(10, -3 * t / t60);              // -60 dB at t = t60
        var k = 0.15 + 0.8 * Math.min(1, t / t60);          // one-pole low-pass that closes over time
        var a = 1 - k;
        lp += a * ((rnd() * 2 - 1) - lp);
        d[i] = lp * amp * Math.sqrt((2 - a) / a);           // keep the level: the filter alone would steepen the decay
      }
    }
    // Unit energy per channel, normalize off: then wetTrim 1 means the room returns about the energy it is sent.
    // (normalize = true applies the browser's own calibration, which left the room almost silent here: under 0.2 per
    // cent of a far sound's energy in its tail, measured.)
    for (var c2 = 0; c2 < 2; c2++) {
      var x = ir.getChannelData(c2), e = 0;
      for (var j = 0; j < x.length; j++) e += x[j] * x[j];
      var s = 1 / Math.sqrt(e || 1); for (j = 0; j < x.length; j++) x[j] *= s;
    }
    var verb = ctx.createConvolver(); verb.normalize = false; verb.buffer = ir;
    // No DynamicsCompressorNode as a "limiter": it adds automatic make-up gain (a 0.1 sine came out at 0.246 with
    // threshold -30, tested), so it raises quiet sounds. The ceiling is kept by level design instead: partial levels
    // are normalised to the ceiling, the impulse has unit energy, and wetTrim (default 1) scales the room.
    var out = ctx.createGain(); out.gain.value = 1;
    var wetTrim = ctx.createGain(); wetTrim.gain.value = opts.wetTrim == null ? 1 : opts.wetTrim;
    verb.connect(wetTrim); wetTrim.connect(out); out.connect(opts.destination || ctx.destination);

    // A source at distance 0 is dry and close; at 1 it is quieter and mostly room. Send 15 to 70 per cent.
    function bus(dist) {
      dist = Math.min(1, Math.max(0, dist || 0));
      var input = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain();
      dry.gain.value = 1 - 0.55 * dist; wet.gain.value = 0.15 + 0.55 * dist;
      input.connect(dry); input.connect(wet); dry.connect(out); wet.connect(verb);
      return input;
    }
    function env(param, t, peak, atk, dec) {             // exponential: never from or to zero
      param.setValueAtTime(0.0001, t);
      param.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t + atk);
      param.exponentialRampToValueAtTime(0.0001, t + atk + dec);
      return t + atk + dec;
    }
    function partial(dest, t, f, peak, dec) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(f, t);
      var end = env(g.gain, t, peak, 0.002, dec);
      o.connect(g); g.connect(dest); o.start(t); o.stop(end + 0.02);
      return end;
    }
    var noiseBuf = (function () {
      var b = ctx.createBuffer(1, sr, sr), x = b.getChannelData(0);
      for (var i = 0; i < x.length; i++) x[i] = rnd() * 2 - 1;
      return b;
    })();
    function transient(dest, t, type, f, q, peak, dur) {
      var s = ctx.createBufferSource(); s.buffer = noiseBuf;
      var flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
      var g = ctx.createGain(); var end = env(g.gain, t, peak, 0.001, dur);
      s.connect(flt); flt.connect(g); g.connect(dest); s.start(t); s.stop(end + 0.02);
      return end;
    }
    // inharmonic partials (ratio, level, decay seconds) plus a noise transient: a struck object, not a beep
    function struck(t, o, base, parts, tr) {
      var total = tr[3]; parts.forEach(function (p) { total += p[1]; });
      var dest = bus(o.dist), gain = (o.gain == null ? 1 : o.gain) * ceiling / total, end = t;
      parts.forEach(function (p) { end = Math.max(end, partial(dest, t, base * p[0], gain * p[1], p[2])); });
      return Math.max(end, transient(dest, t, tr[0], tr[1], tr[2], gain * tr[3], tr[4]));
    }
    var api = {
      impulse: ir, bus: bus, input: out,
      glass: function (t, o) { o = o || {}; return struck(t, o, o.freq || 1800, [[1, 0.5, 0.9], [2.32, 0.28, 0.6], [4.25, 0.16, 0.35], [6.63, 0.08, 0.2]], ['highpass', 4000, 0.7, 0.25, 0.008]); },
      wood: function (t, o) { o = o || {}; return struck(t, o, o.freq || 220, [[1, 0.55, 0.12], [2.57, 0.3, 0.07], [4.1, 0.14, 0.04]], ['bandpass', 1200, 1.4, 0.45, 0.012]); },
      sub: function (t, o) {
        o = o || {}; var dest = bus(o.dist), os = ctx.createOscillator(), g = ctx.createGain();
        os.type = 'sine'; os.frequency.setValueAtTime(o.from || 72, t); os.frequency.exponentialRampToValueAtTime(o.to || 44, t + 0.35);
        var end = env(g.gain, t, (o.gain == null ? 1 : o.gain) * ceiling * 0.95, 0.006, 0.42);
        os.connect(g); g.connect(dest); os.start(t); os.stop(end + 0.02); return end;
      },
      air: function (t, o) {
        o = o || {}; var dur = o.dur || 0.5, dest = bus(o.dist);
        var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
        var flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.Q.value = 1.1;
        flt.frequency.setValueAtTime(o.from || 400, t); flt.frequency.exponentialRampToValueAtTime(o.to || 2400, t + dur);
        var g = ctx.createGain(); var end = env(g.gain, t, (o.gain == null ? 1 : o.gain) * ceiling * 0.7, dur * 0.4, dur * 0.6);
        s.connect(flt); flt.connect(g); g.connect(dest); s.start(t); s.stop(end + 0.02); return end;
      },
      // speeds: numbers 0..1 sampled evenly over dur (normalise your curve first). Loudness and brightness follow it.
      airFromCurve: function (t, speeds, dur, o) {
        o = o || {}; var dest = bus(o.dist), n = speeds.length;
        var gains = new Float32Array(n + 2), freqs = new Float32Array(n + 2);
        gains[0] = gains[n + 1] = 0.0001; freqs[0] = freqs[n + 1] = 300;              // start and end silent
        for (var i = 0; i < n; i++) { var v = Math.min(1, Math.max(0, speeds[i])); gains[i + 1] = Math.max(0.0001, v * ceiling * 0.7); freqs[i + 1] = 300 + v * 3200; }
        var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
        var flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.Q.value = 1.1;
        var g = ctx.createGain(); g.gain.value = 0.0001;
        g.gain.setValueCurveAtTime(gains, t, dur); flt.frequency.setValueCurveAtTime(freqs, t, dur);
        s.connect(flt); flt.connect(g); g.connect(dest); s.start(t); s.stop(t + dur + 0.02); return t + dur;
      },
    };
    return api;
  }

  root.SenseiRoom = { create: create };
  if (typeof module !== 'undefined') module.exports = root.SenseiRoom;
})(typeof window !== 'undefined' ? window : globalThis);
