/* player.js: the "player half" of a film page. Add it to the interactive version of a seek page (a lesson, a deck,
 * a hero); the renderer never runs it, because it does nothing when the URL has ?render (render.mjs adds that).
 *
 *   <script src="player.js"></script>
 *   <script>SenseiPlayer.mount({ stage: '#stage', audio: 'narration.mp3', captions: CUES, poster: 'end' });</script>
 *
 * - Clock: while audio plays, t = audio.currentTime (the picture can never drift from the sound); without audio, t
 *   advances with requestAnimationFrame. The film's seek(t) stays pure; only this script owns a clock.
 * - Controls: native buttons and a range input (keyboard and screen-reader ready), time readout, captions line.
 * - Reduced motion: no autoplay; the poster frame (default the last frame, or a time) is shown; playing stays the
 *   user's choice. Pauses when the tab is hidden.
 * - The stage is scaled to fit its container width.
 *
 * verified: headless Chrome 155 on Windows 10 via Playwright (examples/player.html: controls present, play advances t,
 *           scrub seeks, ?render mounts nothing, reduced-motion emulation shows the poster and does not play).
 * not verified: real audio output and audio-as-clock drift on a device (automation grants autoplay, so the policy
 *           path cannot be tested headlessly); Safari and Firefox; screen-reader announcements.
 * Original HTML-Sensei code. The audio-as-clock and ?render split follow the Battle-of-Austerlitz-Film architecture
 * (no licence: idea only, nothing copied).
 */
(function (root) {
  'use strict';
  function mount(o = {}) {
    if (new URLSearchParams(location.search).has('render')) return null;
    const stage = typeof o.stage === 'string' ? document.querySelector(o.stage) : o.stage;
    const seek = root.__seek || root.seek || root.renderFrame, meta = root.__meta || {};
    const dur = meta.dur, reduce = root.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const posterT = o.poster === 'start' ? 0 : typeof o.poster === 'number' ? o.poster : Math.max(0, dur - 1 / (meta.fps || 30));

    const wrap = document.createElement('div'); wrap.className = 'sp-wrap';
    stage.parentNode.insertBefore(wrap, stage); wrap.appendChild(stage);
    const ui = document.createElement('div'); ui.className = 'sp-ui';
    ui.innerHTML = '<button type="button" class="sp-play" aria-label="Play">Play</button>' +
      '<input class="sp-scrub" type="range" min="0" step="0.001" aria-label="Position in the film">' +
      '<span class="sp-time" aria-hidden="true"></span>';
    const cap = document.createElement('p'); cap.className = 'sp-cap';
    wrap.appendChild(ui); wrap.appendChild(cap);
    const btn = ui.querySelector('.sp-play'), scrub = ui.querySelector('.sp-scrub'), time = ui.querySelector('.sp-time');
    scrub.max = String(dur);
    const css = document.createElement('style');
    css.textContent = '.sp-wrap{position:relative;width:100%;overflow:hidden}.sp-wrap>:first-child{transform-origin:0 0}' +
      '.sp-ui{display:flex;gap:.75rem;align-items:center;padding:.5rem;font:14px system-ui,sans-serif}.sp-scrub{flex:1}' +
      '.sp-cap{min-height:1.5em;margin:.25rem .5rem;font:18px/1.4 system-ui,sans-serif}';
    document.head.appendChild(css);
    const audio = o.audio ? Object.assign(new Audio(o.audio), { preload: 'auto' }) : null;

    let t = 0, playing = false, last = 0, raf = 0;
    const fit = () => { const k = wrap.clientWidth / (meta.w || stage.offsetWidth); stage.style.transform = `scale(${k})`; wrap.style.height = (meta.h || stage.offsetHeight) * k + 'px'; };
    const show = v => {
      t = Math.max(0, Math.min(dur, v)); seek(t); scrub.value = String(t);
      time.textContent = `${t.toFixed(1)} / ${dur.toFixed(1)} s`;
      const c = (o.captions || []).find(x => t >= x.t && t < x.end); cap.textContent = c ? c.text : '';
    };
    const tick = now => {
      if (!playing) return;
      const next = audio && !audio.paused ? audio.currentTime : t + (now - last) / 1000;
      last = now; show(next);
      if (t >= dur) { pause(); return; }
      raf = requestAnimationFrame(tick);
    };
    function play() {
      if (t >= dur) show(0);
      playing = true; btn.textContent = 'Pause'; btn.setAttribute('aria-label', 'Pause');
      if (audio) { audio.currentTime = t; audio.play().catch(() => {}); }
      last = performance.now(); raf = requestAnimationFrame(tick);
    }
    function pause() {
      playing = false; cancelAnimationFrame(raf); btn.textContent = 'Play'; btn.setAttribute('aria-label', 'Play');
      if (audio) audio.pause();
    }
    btn.addEventListener('click', () => (playing ? pause() : play()));
    scrub.addEventListener('input', () => { show(+scrub.value); if (audio) audio.currentTime = t; });
    document.addEventListener('visibilitychange', () => { if (document.hidden && playing) pause(); });
    root.addEventListener('resize', fit);
    Promise.resolve(root.__ready).then(() => {
      fit(); show(reduce ? posterT : 0);
      if (!reduce && o.autoplay) play();
    });
    return { play, pause, seek: show, get t() { return t; }, get playing() { return playing; }, reduce };
  }
  root.SenseiPlayer = { mount };
})(window);
