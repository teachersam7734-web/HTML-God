# Text in a 3D scene

Sources: `domain-3d-assets-pipeline.md` in the HTML-Sensei build project's research notes (not shipped) section 4, and the runs for this skill (troika-three-text
0.52.5, three 0.186.1, Chrome 155 with SwiftShader).

## First rule

Text that carries information is HTML: selectable, translatable, read by assistive technology, sharp at every zoom.
3D text is decoration or a title, and its words are repeated in HTML (an `aria-label` on the canvas at least).

## The five routes

| Route | Shaping (joined scripts, bidi) | Sharpness | Offline | Use for |
|---|---|---|---|---|
| HTML over the canvas (`pointer-events: none`) | browser, correct | perfect | yes | body copy, anything that must be read |
| `CSS3DRenderer` (HTML placed in 3D) | browser, correct | perfect | yes (three addon) | panels and cards in a scene; not tested here |
| Canvas-texture label (`examples/label-canvas.html`) | **browser, correct (tested with Persian)** | softens at a distance | yes | titles and labels, **every Persian or Arabic label** |
| troika-three-text SDF (`examples/text3d.html`) | Latin fine; **Persian drawn unjoined here** | crisp at any distance | yes, with the settings below | Latin titles that move in depth |
| `TextGeometry` plus `FontLoader` (extruded) | none | geometry | yes, with an inline typeface JSON (fonts are no longer in the npm package) | chunky Latin titles only; never Persian or Arabic |

MSDF atlases suit a fixed vocabulary; not tested here.

## troika-three-text offline

```js
T.configureTextBuilder({ useWorker: true, unicodeFontsURL: 'about:blank#' });   // the fallback resolver never reaches its CDN
const url = URL.createObjectURL(new Blob([fontBytes], { type: 'font/ttf' }));
const t = new T.Text(); t.text = 'HOLOGRAM 3D'; t.font = url;              // always pass a font, or missing glyphs are looked up online
t.fontSize = .8; t.anchorX = 'center'; t.anchorY = 'middle';
scene.add(t); t.sync(() => render());
```

Results (rerun for this skill): TTF and WOFF from blob URLs work, with and without the worker; **WOFF2 fails** with
`woff2 fonts not supported`. Convert once with fontTools (`TTFont(path).flavor = None`, then save; reading WOFF2 needs
`brotli`) and embed TTF (24 KB for one Latin weight of Chakra Petch) or WOFF (14 KB).

### Persian and Arabic: a correction to the research

The 3D lane reported that troika joined Persian into contextual forms. Rerun for this skill, with the lane's own page
and with this skill's page, using a system Arial TTF as a local test font (its GSUB table has `init`, `medi`, `fina`):
the right-to-left order was correct but **the letters were drawn in their isolated forms**, and troika logged
`unsupported GPOS table LookupType 8 format 3` and `LookupType 1 format 2`. Screenshots inspected. Whether another
font or troika version joins correctly was not tested. Until it is proven on the exact font, Persian and Arabic in 3D
go through the browser: the canvas-texture label or HTML.

## Canvas-texture label (browser shaping)

```js
const face = new FontFace('LabelFont', fontBytes.buffer);
document.fonts.add(await face.load());                     // draw only after the face loads
const c = document.createElement('canvas'); c.width = 2048; c.height = 512;
const g = c.getContext('2d'); g.scale(2, 2);               // 2x for sharpness
g.font = '600 88px LabelFont'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
g.fillText('یک نیم کتاب، سلام دنیا', 512, 128);
const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
const label = new T.Mesh(new T.PlaneGeometry(4, 1), new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
```

Tested: Persian joined correctly, gate passed. Use a free font with Persian coverage (Vazirmatn under SIL OFL is the
research's suggestion, stated from memory there: confirm its licence file when you pick it). Diacritics beyond the
test string were not checked.
