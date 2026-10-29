# Forms: validation, accessible errors and an honest submit

The recipe behind [../examples/form.html](../examples/form.html): a course sign-up form that works in one offline
file and on a hosted site, in English and Persian. Proved by [../scripts/test-form.mjs](../scripts/test-form.mjs)
(40 assertions) and by the gate with [../examples/form.steps.json](../examples/form.steps.json) (33 steps, strict
`file://`). HTML-Sensei's own code and words.

## 1. The submit decision

The first question for any form: where does the entry go when the person presses the button? A single offline file
has no server. Never show "Sent" or "Thank you, we will be in touch" when nothing left the device.

| Deliverable | What submit does | What the page must say | Profile |
|---|---|---|---|
| Offline single file (default) | validate, save the entry on this device (`localStorage`, guarded), then offer **copy**, **download** (a `.txt` Blob) and **open in my email app** (`mailto:` with subject and body) | "Saved on this device only. Nothing has been sent yet." The mailto note: "Nothing is sent until you press Send there." | `offline: true` |
| Offline file, storage blocked (private modes, sandboxed frames) | the same actions without the save | "Nothing was saved and nothing was sent. Copy or download your entry to keep it." | `offline: true` |
| Hosted page with an endpoint (`data-endpoint="https://..."`) | `fetch` POST with a JSON body, a sending state, success **only** on a 2xx answer, failure states that keep the entry and offer copy or download, a timeout | "Sending...", then "Sent: the server confirmed it", or "Not sent: <reason>. Your entry is still in the form." | `offline: false`, and a privacy note naming who receives the data |
| Hosted, a form service (Formspree, Basin, a Netlify form) | the same fetch path to the service's endpoint | name the service in the privacy note; it is a third party receiving personal data | `offline: false`, a ledger row for the service's terms |
| Hosted, no endpoint yet | treat it as offline: never wire a fake success while the server is "coming later" | as offline | |

Rules that do not change between rows:

- **No data in URLs.** `method="post"` on the `<form>` (so a script failure cannot fall back to a GET that puts every
  field in the address bar, the history and server logs), and the fetch sends a body, never a query string. The one
  exception is `mailto:`: the body is in that URL by design, it goes to the person's own mail app, not to a server.
- **No fake success.** The success text is written only after the thing it claims happened: the save returned, the
  server answered 2xx. A pending request shows a sending state, never success. A failure keeps everything typed.
- **One submit at a time.** While sending, the button is `aria-disabled="true"` (not `disabled`, which drops focus
  to `<body>`) and the handler ignores presses; `aria-busy="true"` on the form.
- **Say what happens before it happens**: an offline note under the heading, or for hosted pages the privacy line
  ("When you press Sign up, your entry is sent to the school's server").

## 2. Validation with native constraints and your own messages

```html
<form id="signup" method="post" novalidate data-endpoint="">
  <label for="f-name">Your name</label>
  <input id="f-name" name="name" type="text" autocomplete="name" required minlength="2" dir="auto"
         aria-describedby="f-name-err">
  <p class="err" id="f-name-err" hidden></p>
  ...
</form>
<div id="summary" role="alert" tabindex="-1"></div>   <!-- present from load, empty -->
<p id="status" role="status" aria-live="polite"></p>  <!-- present from load, empty -->
```

- `novalidate` turns off the browser's bubbles (unstyled, untranslatable, gone after a moment) but keeps the
  constraint API: `required`, `type="email"`, `minlength`, `pattern` still set `el.validity`, and `el.checkValidity()`
  still answers. Map each `validity` flag to your own message per language (`valueMissing`, `typeMismatch`,
  `tooShort`, `patternMismatch`).
- On submit: validate every field, set `aria-invalid="true"` or `"false"`, write the message into the element that
  `aria-describedby` already names, unhide it, move focus to the **first** invalid field, and fill the summary.
- The summary is a heading with the count and one link per problem; each link focuses its field (a click handler:
  a fragment link alone scrolls but does not move focus to an input). The region exists from load, so the change is
  announced.
- After the first try, a field re-validates on `blur` (`change` for selects and checkboxes), so fixing it clears its
  error without retyping everything. Before the first try, no errors: nobody wants red before they have typed.
- A hint (`Digits only`) is in `aria-describedby` too, before the error id.
- Errors carry a 2 px border and text, never colour alone; in forced colours the border becomes `Mark`.

## 3. Persian, RTL and digits

- One switch sets `lang` and `dir` on `<html>`; every label, hint, error, summary and status re-renders in the new
  language, including errors already on screen and the last status line (the field log: a status left in English
  after the switch was the one bug the gate could not see).
- Email, phone and other Latin-only fields keep `dir="ltr"` inside an RTL page; free text (name, message) uses
  `dir="auto"` so a Latin name in a Persian page and a Persian name in an English page both read correctly.
- People type Persian digits (U+06F0 to U+06F9) and Arabic-Indic digits (U+0660 to U+0669). Normalise to ASCII before
  validating, and drop spaces, hyphens, dots, brackets and a leading plus, so `۰۹۱۲ ۳۴۵ ۶۷۸۹` is `09123456789`:

  ```js
  const ascii = s => s.replace(/[۰-۹]/g, c => c.charCodeAt(0) - 0x06F0)
                      .replace(/[٠-٩]/g, c => c.charCodeAt(0) - 0x0660);
  const normTel = s => ascii(s).replace(/[\s().-]/g, '').replace(/^\+/, '');
  ```

  Use `type="tel"` with `inputmode="tel"` and a `pattern` for phone numbers, not `type="number"` (that is for
  quantities; it adds spinners and its handling of non-ASCII digits was not tested here).
- Counts in Persian text use Persian digits (`فرم ۴ مشکل دارد`).
- Fonts: the example uses the system stack and says so. A real Persian page embeds `sensei-typography`'s shipped
  Vazirmatn subset (`../../sensei-typography/assets/`).

## 4. Autocomplete tokens

| Field | `autocomplete` | Also |
|---|---|---|
| Full name | `name` (or `given-name` and `family-name` when split) | `dir="auto"` |
| Email | `email` | `type="email"`, `inputmode="email"`, `spellcheck="false"`, `dir="ltr"` |
| Phone | `tel` | `type="tel"`, `inputmode="tel"`, `dir="ltr"` |
| Postal address | `street-address`, `postal-code`, `country-name` | |
| Password, new | `new-password` | never in an offline single file's saved entry |
| One-time code | `one-time-code` | `inputmode="numeric"` |
| Free text, course choice | none needed | |

The tokens are from the HTML standard's autofill field names. Only `name`, `email` and `tel` ran in the example
(Chrome fills nothing in a fresh headless profile, so the tokens were checked as attributes, not as autofill).

## 5. Motion and states

- An invalid field may get a short nudge, only inside `@media (prefers-reduced-motion: no-preference)`; with the
  preference set, no animation runs at all (test-form checks `document.getAnimations()` is empty, and non-empty
  without the preference so the check means something).
- The status line clears, then writes about 80 ms later, so a repeated message is announced again.
- The button keeps its focus ring while busy; nothing moves the layout when the status appears (the line keeps a
  minimum height).

## 6. TRAPS

| # | Symptom | Cause | Fix | Found |
|---|---|---|---|---|
| 1 | `form.name` is an element, `form.email.value` works until someone adds a field called `action` or `submit` | named controls shadow form properties: an input named `name` is returned by `form.name`, hiding `HTMLFormElement.prototype.name` | read controls through `form.elements` (`form.elements.namedItem('name')`); never name a control `submit`, `action`, `method`, `reset` | tested (test-form section 7) |
| 2 | "Thank you" shown and nothing arrives | success written in the submit handler before (or without) the request; or an offline file with a fake send | success only after the save or a 2xx; offline pages say nothing was sent | design rule; tested (both modes) |
| 3 | Every field shows up in the address bar after a script error | `<form>` with no `method` submits as GET | `method="post"`; the fetch uses a body | tested (no query string in either mode) |
| 4 | "Sending..." flashes and disappears, the status is blank while waiting | the clear-then-write helper's delayed write of an empty string landed after the sending text | write the sending text through the same helper | found and fixed while writing this example |
| 5 | Focus lands on `<body>` while sending | `disabled` on the button that has focus | `aria-disabled="true"` and ignore presses | tested (field log, and here) |
| 6 | A Playwright test of "press again while sending" waits 15 s | Playwright treats `aria-disabled="true"` as disabled and waits for it to clear | `click({ force: true })` in that one test | found while writing test-form |
| 7 | The hosted form fails from `file://` or another origin | a JSON POST is not a simple request, so the browser sends a CORS preflight; the server must answer it | the endpoint allows the page's origin and `Content-Type`; a hosted page is served over https | reported (CORS rules); the routed test skips the real network |
| 8 | Errors in English after switching to Persian | messages rendered once at submit time | re-render errors, summary and status on every language switch | tested (test-form section 2) |
| 9 | A phone number typed in Persian digits is rejected | `pattern="[0-9]{7,15}"` matches ASCII digits only | normalise digits before validating | tested |
| 10 | The browser's own error bubble appears in the wrong language and vanishes | constraint validation without `novalidate` | `novalidate` plus your own messages from `validity` | tested |
| 11 | The error summary is not announced | the live region was created together with its message | the region exists, empty, from load | tested (field log, toast pattern) |
| 12 | Private-mode users lose the entry with no word | `localStorage.setItem` throws `SecurityError` | guard it; say nothing was saved; offer copy and download | tested (test-form section 4; the gate's blocked-storage check) |
| 13 | A long message is cut off in the mail app | `mailto:` URLs have practical length limits in mail apps | keep the copy and download paths; say the email path is for short entries | reported, not measured |

## 7. Verification

`node scripts/test-form.mjs`: 40 of 40 (Windows 10, Node 24.16, playwright-core 1.64.1, installed Chrome 156,
strict `file://`): validation and focus, the summary, Persian with RTL and both digit sets, the offline save with
copy (clipboard read back), download (file read back) and mailto, storage blocked, the hosted path with success
(201), a 500, no connection, one request per press, a POST body and no query string, reduced motion, the
`form.name` trap. The gate: `verify.mjs examples/form.html --steps examples/form.steps.json --strict`: PASS, 21 pass,
0 warn, 0 fail; axe 0 violations on mobile, desktop and dark; 8 focus stops with rings; forced colours; reflow at
320 px; blocked storage; 33 steps. The contact sheet was looked at (errors, saved, saved in Persian).

Not verified: a real endpoint and its CORS answers; Firefox, Safari, phones and real autofill; screen-reader speech;
whether a mail app opens from `mailto:` on the target devices.
