/* flip.js: FLIP (First, Last, Invert, Play) with the Web Animations API, no library. A classic script that defines
   window.flip, so it loads from a sibling file over strict file:// (a module import does not: browsers block module
   scripts from file:// origins) and can be pasted inline into a single file.

     flip(elements, mutate, { duration: 350, easing: 'cubic-bezier(.2,.8,.2,1)' }) -> Promise

   Interrupt-safe: "First" is read while any earlier FLIP is still running (getBoundingClientRect includes the
   transform, so it is where the element is on screen), then those animations are cancelled before the DOM changes.
   Animates transform only; scale distorts children and radii, so prefer moves, or counter-scale children.
   Under reduced motion it applies the change and animates nothing.

   verified: Windows 10, Node 24, Chrome headless via playwright-core 1.62: ../scripts/test-vt.mjs (the start transform
             equals the displacement, the end is none, an interrupted FLIP starts from the on-screen position with no
             jump, reduced motion animates nothing), from strict file://.
   not verified: Firefox and Safari; size changes with nested content (scale); hundreds of elements.
   Origin: code-interaction/flip.js in the HTML-Sensei build project's research notes (not shipped) (HTML-Sensei's own code, lane D2), made classic,
   interrupt-safe and reduced-motion aware here. */
(function(){
  function flip(elements, mutate, opts){
    opts = Object.assign({ duration: 350, easing: 'cubic-bezier(.2,.8,.2,1)' }, opts || {});
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { mutate(); return Promise.resolve(); }
    var first = new Map();
    elements.forEach(function(el){ first.set(el, el.getBoundingClientRect()); });            // First: on-screen boxes
    elements.forEach(function(el){ el.getAnimations().forEach(function(a){ if (a.id === 'flip') a.cancel(); }); });
    mutate();                                                                                // the DOM change
    var anims = [];
    elements.forEach(function(el){
      var a = first.get(el), b = el.getBoundingClientRect();                                 // Last
      var dx = a.left - b.left, dy = a.top - b.top, sx = a.width / b.width, sy = a.height / b.height;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.001 && Math.abs(sy - 1) < 0.001) return;
      var an = el.animate(
        [{ transformOrigin: '0 0', transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')' },
         { transformOrigin: '0 0', transform: 'none' }],
        { duration: opts.duration, easing: opts.easing });
      an.id = 'flip';                                                                        // Invert, then Play
      anims.push(an);
    });
    return Promise.all(anims.map(function(x){ return x.finished.catch(function(){}); }));
  }
  window.flip = flip;
})();
