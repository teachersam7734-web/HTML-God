/* rive-mount.js: one safe way to put a Rive file on a page. CC0 (original code of this project).
 *
 *   const m = SenseiRive.mount(rive, canvas, { buffer, stateMachine: 'Main', onReady(m) {} });
 *   m.set('Level', 3); m.fire('Pop'); m.inputs(); m.play(); m.pause(); m.teardown();
 *
 * What it does, each from a trap:
 *   - names the state machine AT CONSTRUCTION, or stateMachineInputs() returns nothing;
 *   - enableRiveAssetCDN: false, so fonts and images hosted by Rive are never fetched at run time;
 *   - prefers-reduced-motion: reduce: no autoplay (the first frame is drawn); Rive has no switch of its own;
 *   - pauses when the canvas is off screen or the tab is hidden, resumes when both are back (only if it was playing);
 *   - resizeDrawingSurfaceToCanvas() on load and on every canvas resize (sharp at any device pixel ratio);
 *   - touches isPlaying only after onLoad (the 2.45 getter throws on an instance that has not loaded yet);
 *   - teardown() disconnects the observers and calls cleanup(), which frees the WASM memory.
 * The page still owns: the runtime choice (canvas-single, or canvas / canvas-lite / webgl2 with setWasmBinary and
 * setWasmFallbackUrl(null)), the canvas's role="img" and aria-label, and a keyboard path for pointer-driven inputs
 * (call m.set or m.fire from buttons or keys).
 *
 * verified: Windows 10, Chrome 155 headless, @rive-app canvas and canvas-single 2.45.0, with the .riv given to
 *           test-rive.mjs: inputs present after mount, reduced motion does not play, hidden tab pauses, teardown clean.
 * not verified: webgl2 through this wrapper; data binding (Rive marks state machine inputs deprecated in favour of
 *               data binding in the 2.45 type definitions); Safari and Firefox.
 */
(function (root) {
  function mount(rive, canvas, o) {
    o = o || {};
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var wantsPlay = o.autoplay !== false && !reduce;
    var onScreen = true, io = null, ro = null, r = null, loaded = false, userPaused = !wantsPlay;
    var api = {
      get rive() { return r; }, reduced: reduce,
      inputs: function () { return (o.stateMachine && r && r.stateMachineInputs(o.stateMachine)) || []; },
      set: function (name, v) { var i = api.inputs().find(function (x) { return x.name === name; }); if (i) i.value = v; return !!i; },
      fire: function (name) { var i = api.inputs().find(function (x) { return x.name === name; }); if (i && i.fire) i.fire(); return !!i; },
      play: function () { userPaused = false; sync(); }, pause: function () { userPaused = true; sync(); },
      isPlaying: function () { return !!(r && loaded && r.isPlaying); },
      teardown: function () { if (io) io.disconnect(); if (ro) ro.disconnect(); document.removeEventListener('visibilitychange', sync); if (r) r.cleanup(); r = null; loaded = false; }
    };
    function sync() {
      if (!r || !loaded) return;                   // Rive's isPlaying getter throws until the file has loaded
      var run = !userPaused && onScreen && !document.hidden;
      if (run && !r.isPlaying) r.play(); else if (!run && r.isPlaying) r.pause();
    }
    var opts = {
      canvas: canvas, autoplay: wantsPlay, enableRiveAssetCDN: false,
      layout: o.layout || new rive.Layout({ fit: o.fit || rive.Fit.Contain, alignment: rive.Alignment.Center }),
      onLoad: function () { loaded = true; r.resizeDrawingSurfaceToCanvas(); sync(); if (o.onReady) o.onReady(api); },
      onLoadError: function (e) { if (o.onError) o.onError(e); }
    };
    if (o.buffer) opts.buffer = o.buffer; else opts.src = o.src;
    if (o.artboard) opts.artboard = o.artboard;
    if (o.stateMachine) opts.stateMachines = o.stateMachine;   // instanced now, so its inputs exist
    r = new rive.Rive(opts);
    if ('IntersectionObserver' in root) { io = new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; sync(); }); io.observe(canvas); }
    if ('ResizeObserver' in root) { ro = new ResizeObserver(function () { if (r) r.resizeDrawingSurfaceToCanvas(); }); ro.observe(canvas); }
    document.addEventListener('visibilitychange', sync);
    return api;
  }
  root.SenseiRive = { mount: mount };
})(window);
