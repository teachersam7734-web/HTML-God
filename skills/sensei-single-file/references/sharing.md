# Sharing: a file or a site, and what differs between them

Source: `domain-deployment-sharing.md` in the HTML-Sensei build project's research notes (not shipped); `scripts/test-protocols.mjs` (raw output:
`protocol-matrix.json`) and `scripts/test-sw.mjs`, both re-run while writing this skill. Nothing was deployed or
published: host limits below come from vendor documentation or summaries and say so. Publishing needs the owner's
explicit approval every time.

## Choose the deliverable first (the profile's `deliverable`)

| Situation | Deliver |
|---|---|
| Email, USB, LMS upload, "open it offline", an archive | one file, verified in strict `file://` |
| Public page, shareable URL, analytics, updates, search | a static site over HTTPS |
| Both | build once, produce both (`dist/` and `dist/standalone.html`); run the gate with `--mode both` |
| Larger than a host's per-file limit | the file stays a file; the site splits media out of the HTML |

Do not inline when the user wants a site that updates, when one asset is shared by many pages, or when phone users on
slow connections are the audience and a hosted copy exists.

## file:// against http:// (the same probe page, installed Chrome, no file-access flag)

| Probe | `file://` | `http://127.0.0.1` | plain `http://` host (insecure) |
|---|---|---|---|
| `isSecureContext` | true | true | **false** |
| `<script type="module" src>` | **does not run** | runs | runs |
| `fetch('sibling')`, `instantiateStreaming` | **Failed to fetch** | works | works |
| `new Worker('w.js')` | **SecurityError** | works | works |
| `new Worker(blobUrl)` | works | works | works |
| `import('./mod.js')` | **fails** | works | works |
| XHR of a sibling | **fails** | works | works |
| sibling `<img>` into a canvas, then `getImageData` | **tainted** | readable | readable |
| service worker | **fails to register** | works | **`navigator.serviceWorker` undefined** |
| `localStorage`, `indexedDB`, Web Audio, WebGL2 | work | work | work |
| `crypto.subtle`, `randomUUID`, clipboard, `mediaDevices` | present | present | **missing** |
| `SharedArrayBuffer` | no | no | no (needs COOP and COEP; the gate's `--isolated` serves them) |
| cross-document view transition | **worked** | worked | not run |

Consequences: a single file must be self-contained in the strict sense (modules bundled to an IIFE, binaries in the
asset table, workers from Blob URLs, images as data or Blob URLs, never by path). A LAN demo over plain http loses
crypto, clipboard and camera while `localhost` keeps them. `file://` has no HTTP cache, no headers, no CSP and no
charset header. `localStorage` on `file://` is tied to the file's path: a moved or renamed course starts empty, so offer
export and import of progress (moving was not tested).

## Static hosts (not deployed here)

| Host | What the sources say | Status |
|---|---|---|
| GitHub Pages | site about 1 GB; repository pushes blocked above 100 MB (secondhand); **no custom headers**, so no COOP and COEP | documentation summaries |
| Cloudflare Pages | **25 MiB per file**; 20,000 files per site free, 100,000 paid; `_headers` file | vendor documentation via search |
| Netlify, Vercel | per-file limits not established; build and bandwidth quotas; Vercel's free tier is non-commercial per the summary found | check the vendor page |
| Drive, Dropbox, chat apps | show HTML as text or in a restricted viewer; they do not run it | reported |

```
GitHub Pages: push the folder, Settings > Pages > deploy from a branch; add .nojekyll
Cloudflare Pages: npx wrangler pages deploy ./dist
Netlify: npx netlify deploy --dir=dist --prod        Vercel: npx vercel --prod
```

None of these were executed. Headers where the host allows them: COOP and COEP for SharedArrayBuffer and WASM threads;
`Cache-Control: no-cache` on the HTML and long `immutable` on hashed assets.

## Service workers (site only)

`test-sw.mjs`, re-run here: a cache-first worker served the page with the network cut; after the page changed but the
worker did not, the user still saw the old page; changing the cache name (`v1` to `v2`) installed, activated with
`skipWaiting` and `clients.claim`, deleted the old cache and showed the new page. Rules: secure context only (it cannot
register from `file://`, and is absent on plain http), so a single file cannot be a PWA (offline is already its nature);
cache-first for assets, network-first or stale-while-revalidate for HTML, a cache name that changes every release, an
"update available" prompt for apps with state. Guard registration:
`if ('serviceWorker' in navigator && location.protocol.startsWith('http'))`. A manifest cannot usefully be inlined.

## Phones and big files (not verified here)

Desktop Chrome needed about the file size plus a 400 MB baseline for 83 to 200 MB files (measured). Phone browsers have
far less memory and kill tabs; in-app viewers (messaging, email previews, cloud drives) may refuse local HTML or block
scripts. Tell the user: open the file in the system browser from the Files app, keep big media lazy, and for a phone
audience host the site and keep the file as the archive or desktop copy. Say plainly that this was not verified on a
phone, and do not shrink the deliverable on that basis alone (owner rule). Top-level navigation to a `data:` URL is
capped (about 2 MB in Chromium per engine documentation, not tested): never share a page as a data URL. Data URI
maximum length per engine (MDN, not tested): Chromium and Firefox 512 MB, Safari 2 GB, older Firefox 32 MB.

## Traps

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | Passes in a test, fails for users | `--allow-file-access-from-files` or `--disable-web-security` in the test | strict mode (the gate's default) | tested |
| 2 | Hosted users see an old page forever | cache-first worker with an unchanged cache name | version the cache name every release | tested |
| 3 | Service worker missing | registered on `file://` or plain http | guard; sites only | tested |
| 4 | Crypto, clipboard, camera gone on a LAN demo | plain http is not a secure context | HTTPS; `localhost` only counts locally | tested |
| 5 | Cross-document transition missing in Firefox | not shipped there per the sources | progressive enhancement; same-document transitions in one file | reported |
| 6 | SharedArrayBuffer unavailable on GitHub Pages | no custom headers there | another host | reported |
| 7 | Upload rejected | Cloudflare Pages 25 MiB per file | the file stays a file; split media for the site | reported |
| 8 | Progress lost | `localStorage` is scoped to the origin or file path | export and import progress | reported |
| 9 | Old hosted HTML | long `Cache-Control` on an unhashed `index.html` | no-cache on HTML | reported |
| 10 | Offline gate fails | analytics, web fonts or embeds from third parties | embed or drop them; the gate fails them in offline mode | tested |
