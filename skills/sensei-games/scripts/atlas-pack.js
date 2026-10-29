/* Shelf atlas packer: rects in, positions + a "JSON hash" atlas (the format Phaser, PixiJS and TexturePacker all read) out.
   Works in the browser and in Node (UMD-lite). Adds `pad` transparent pixels around each frame and `extrude` edge pixels
   (drawn by the caller) so bilinear filtering and mip-mapping never bleed a neighbour into a sprite.
   pack([{name,w,h}], {maxW:1024, pad:2, pow2:true}) -> {w,h,frames:{name:{x,y,w,h}}, json}
   HTML-Sensei's own code, from the research lane's code-apps/game/atlas-pack.js.
   verified: Node 24 (no overlaps, 2 px gutters, power-of-two sheet, hash JSON) and in Chrome 155 feeding Phaser 4.2.1,
             PixiJS 8.22.0 and Kaplay 3001.0.19 (test-engines.mjs).
   not verified: packing quality for production atlases (a shelf packer filled 38 per cent of the sheet; use MaxRects). */
(function (root) {
  function pow2(n) { var p = 1; while (p < n) p <<= 1; return p; }
  function pack(items, o) {
    o = o || {}; var maxW = o.maxW || 1024, pad = o.pad == null ? 2 : o.pad, usePow2 = o.pow2 !== false;
    var list = items.map(function (it) { return { name: it.name, w: it.w, h: it.h }; }).sort(function (a, b) { return b.h - a.h || b.w - a.w || (a.name < b.name ? -1 : 1); });
    var x = pad, y = pad, rowH = 0, usedW = 0, frames = {};
    list.forEach(function (it) {
      if (it.w + pad * 2 > maxW) throw new Error("frame " + it.name + " wider than the sheet");
      if (x + it.w + pad > maxW) { x = pad; y += rowH + pad; rowH = 0; }
      frames[it.name] = { x: x, y: y, w: it.w, h: it.h };
      x += it.w + pad; rowH = Math.max(rowH, it.h); usedW = Math.max(usedW, x);
    });
    var w = usedW + pad - pad, h = y + rowH + pad;
    if (usePow2) { w = pow2(w); h = pow2(h); }
    var json = { frames: {}, meta: { app: "atlas-pack.js", version: "1", format: "RGBA8888", size: { w: w, h: h }, scale: "1" } };
    Object.keys(frames).forEach(function (k) {
      var f = frames[k];
      json.frames[k] = { frame: { x: f.x, y: f.y, w: f.w, h: f.h }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h }, sourceSize: { w: f.w, h: f.h } };
    });
    return { w: w, h: h, frames: frames, json: json };
  }
  /* draw a frame with extruded edges: call drawFn(ctx, x, y) for the frame, then replicate its border pixels outward by `ext` */
  function extrude(ctx, f, ext) {
    if (!ext) return;
    ctx.drawImage(ctx.canvas, f.x, f.y, f.w, 1, f.x, f.y - ext, f.w, ext);
    ctx.drawImage(ctx.canvas, f.x, f.y + f.h - 1, f.w, 1, f.x, f.y + f.h, f.w, ext);
    ctx.drawImage(ctx.canvas, f.x, f.y, 1, f.h, f.x - ext, f.y, ext, f.h);
    ctx.drawImage(ctx.canvas, f.x + f.w - 1, f.y, 1, f.h, f.x + f.w, f.y, ext, f.h);
  }
  var api = { pack: pack, extrude: extrude };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.AtlasPack = api;
})(typeof window !== "undefined" ? window : this);
