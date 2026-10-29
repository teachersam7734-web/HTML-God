# Interview bank

The questions the Router may ask, by deliverable type, each in plain words with why it matters, its default, its
options and the brief or profile field it fills. The Router picks from here; it never asks all of them.

## 1. Rules for every interview

1. **At most 10 questions in total**, across every round. Fewer is better: ask only what changes the build and cannot
   be inferred.
2. **Never ask what the request already answered** (section 9 lists what a request usually settles). Write those
   answers into the brief's decisions log as `source: request`.
3. **Order from most to least decisive**: what it is and who it is for, then the material, then the look, then the
   rest.
4. **Plain words.** No field knowledge assumed. If a word in the question would need explaining to a newcomer
   (offline, hosted, right to left, licence, accessibility, 3D, LMS), the explanation from section 3 comes first.
5. **Every question states its default**, in the form "If you have no preference, I will ...". The default is the
   best-quality, most exciting choice that fits the content.
6. **Technical but critical**: two or three plain sentences first, then the question asking the user's opinion.
7. **With the AskUserQuestion tool**: at most 4 questions per call, 2 to 4 options each, the recommended option first
   with "(Recommended)" at the end of its label, a short header of up to 12 characters; the tool always offers a free
   text answer, so never add an "Other" option. At most 3 rounds. Put the explanations for that round's technical
   questions in the message just before the call, numbered to match the questions, and keep each question to one
   sentence.
8. **Without the tool**: one numbered message, each question on its own line, the default after it, the explanation
   before it.
9. **Nothing technical as an option label.** "One file you can email" beats "single-file offline build".
10. **Never downgrade by default** because of the machine the work is built on. Ask about the devices the audience
    uses; judge by those.

## 2. The core questions

These fit every deliverable. Type sections (4 to 12) say which to use and add their own.

| ID | Question (plain words) | Why it matters | Default ("If you have no preference, I will ...") | Options | Fills |
|---|---|---|---|---|---|
| C1 | What is it, in one sentence, and what should a visitor do or feel at the end? | the one goal every choice serves | "... take the goal from your request" | free text | `brief.purpose`, `brief.primary_action` |
| C2 | Who will use it, and how much do they already know about the topic? | tone, density, how much is explained | "... write for a curious newcomer" | newcomers; people who know the basics; experts; mixed | `brief.audience` |
| C3 | Do you have material for it: text, documents, links, images, a logo? How would you like to share them? (explanation E6) | real content beats invented content; the source decides accuracy | "... write the content myself from your request and mark anything I invented" | I will share files or links next; write it for me from my request; a mix | `brief.sources`, `brief.assets` |
| C4 | Which look should it have? (section 5 for the named looks) | the single largest effect on how it feels | "... design three different looks from your subject and show them side by side, so you pick before I build" | show me three looks first (Recommended); one of the named looks; match my brand | `brief.look`, direction exploration on or off |
| C5 | Do you have brand colours, fonts or a style guide I must follow? (E6) | brand invariants are never explored over | "... choose colours and fonts from the subject" | yes, I will share them; only a logo; no, choose for me | `brief.brand` |
| C6 | How much movement do you want? | sets the motion level the hooks and skills read | "... make it cinematic: rich, purposeful motion, with a calm version for people whose devices ask for less motion" | cinematic (Recommended); lively but light; calm and still | `profile.motion` |
| C7 | Should it include any of these: 3D objects, a hologram, video, sound, hand-drawn animation? (E2, E9) | each adds a specialist and its checks | "... add the one that best serves the subject (often 3D or a shader scene for a hero), and no sound unless you want it" | 3D or hologram; video or animation; sound; none of these | `brief.media` |
| C8 | What can people do in it: answer quizzes, fill in a form, scroll through a story, play, filter data? | interactivity decides the engines | "... include what the type normally needs (section 4 onwards)" | type-specific | `brief.interactivity` |
| C9 | Which languages, and is any of them written right to left, such as Persian or Arabic? (E4) | fonts, layout direction and checks | "... English only" | English only (Recommended when the request is in English); English and another language; another language only | `profile.languages`, `profile.rtl` |
| C10 | How will people get it: one file you send or put on a USB stick, or a website at an address? (E1, E8) | the biggest technical fork: what may load from the internet | "... make one file that works with no internet, and tell you how to put it online later if you want" | one file, works offline (Recommended); a website I will host; both | `profile.offline`, `profile.deliverable` |
| C11 | Which devices must it work well on: phones, tablets, laptops, a big screen or projector, older computers? (E3) | the target device decides what effects are safe; never the machine it is built on | "... make it work on phones, tablets and laptops, and test at phone, tablet and laptop widths" | all of them (Recommended); mostly phones; mostly computers; a big screen or projector | `profile.verify.widths`, `brief.devices` |
| C12 | Is it for sale or for a business, or only personal or classroom use? (E5) | some free code and media may not be used commercially | "... treat it as commercial, the safe side" | commercial or business (Recommended); personal or classroom | `profile.licence_mode` |
| C13 | Does anyone using it rely on a screen reader, keyboard only, large text or reduced motion? (E7) | accessibility is built in anyway; this decides how far the checks go | "... build it in for everyone: keyboard, screen reader, contrast, reduced motion" | build it in (Recommended); someone specific needs it, I will explain | `brief.accessibility` |
| C14 | Is there a deadline, a size limit, or anything it must not do? | limits the user chooses; no size limit by default | "... aim for the best quality with no size limit" | no limits (Recommended); there is a limit, I will say | `brief.limits`, `profile.budget` |

`profile.budget` stays `null` unless the user asks for a size limit in their own words.

## 3. Plain explanations for technical but critical topics

Say the explanation, then ask. Two or three sentences each.

| ID | Topic | Say this first |
|---|---|---|
| E1 | One offline file or a hosted website | "There are two ways to deliver this. One file works like a document: you can email it, put it on a USB stick or upload it to a course system, and it opens with no internet. A website lives at an address, is easy to update and share by link, but needs somewhere to host it." |
| E2 | Sound | "Sound can make it feel alive: soft clicks, a chime when something is right, or music. Browsers only play sound after the person clicks or taps once, and there is always a mute button; anything said aloud also appears as text." |
| E3 | Phones, tablets and older laptops | "Rich effects such as 3D and moving light need a capable device. I design for the devices your audience actually uses, not for the computer I build on, and every effect has a calm fallback for devices that cannot run it or people who ask for less motion." |
| E4 | Languages and right-to-left text | "Some languages, such as Persian and Arabic, are written from right to left, which flips the whole layout and needs fonts that join the letters properly. If any language reads right to left, I build the layout for it from the start rather than adding it later." |
| E5 | Third-party code, fonts, images and their licences | "Much good code, fonts and images are free, but each comes with a licence that says how it may be used; some forbid selling or redistributing. I keep a list of every outside piece and its licence, and choose only pieces that allow your use." |
| E6 | Logo, brand colours, fonts and source material | "If you have a logo, brand colours, fonts or documents, I use them exactly instead of inventing. You can drop files into the project folder, paste text, or give links; the logo is best as SVG or a large PNG." |
| E7 | Accessibility | "Accessibility means people can use it with a keyboard, a screen reader, larger text, or with motion turned down. I build that in for everyone by default; tell me if someone specific needs more." |
| E8 | How it will be shared | "Where it ends up changes how it is built: an email attachment, a course system (an LMS), a USB stick at an event, or a link on social media each have their own limits. Tell me where, and I build for that." |
| E9 | 3D, holograms and shader scenes | "3D objects, holograms and moving light scenes are drawn live by the device's graphics chip, which makes them striking. They need a fallback still image for devices that cannot draw them, which I include." |
| E10 | A course system (LMS) and saving progress | "A course can save each learner's progress on their own device, or report scores to a learning system such as Moodle or Canvas through a standard package (SCORM or cmi5). If you have a learning system, say which; otherwise progress stays on the learner's device." |
| E11 | Where dashboard data comes from | "A dashboard can show a snapshot of data built into the file, or read fresh data from a link each time it opens. A snapshot works offline and is simple; live data needs the data source to stay available." |
| E12 | What a form does when sent | "A form in a file with no website behind it cannot send messages by itself. It can save the answers on the device, let the person copy or download them, or open their email; a hosted page can send them to a service you choose." |
| E13 | A presenter view and a PDF | "A deck can open a second window just for you, with notes and a timer, while the audience sees the slides. It can also print to a PDF with one slide per page for handouts." |
| E14 | A video file | "A motion graphic can stay a page that plays in a browser, or be rendered into an MP4 video file you can post anywhere. Rendering takes longer, but the video looks the same on every device." |
| E15 | Third-party components that cannot be redistributed | "Some of the best-looking components (for example React Bits) may be used in your project but not given away as a pack. I fetch them into your project with their notice and keep them out of anything shared as a template." |

## 4. Single HTML file (a page, an exhibit, a one-off experience)

Order: C1, C2, C3, C4, C7, C10 (only if the request did not say "single file"; it usually did), C9, C11, C6, C14.
Type-specific:

| ID | Question | Why | Default | Options | Fills |
|---|---|---|---|---|---|
| S1 | Is there one moment you want people to remember? | the one memorable element gets the boldness | "... choose it from your subject" | free text | `brief.memorable` |

Routing: direction, tokens-theming, typography, motion-ui, single-file, verify; plus the media from C7; GOAT
starter-lite or starter-rich as the shell.

## 5. Named looks to offer (plain words)

From `sensei-direction`'s catalogue and GOAT HTML's presets. Offer at most three in one question, chosen to suit the
subject, plus "show me three looks first" as the recommended option.

| Name | Say it like this |
|---|---|
| Dark cinematic | near-black stage, glowing light, like the opening of a film |
| Hologram HUD | cyan light and instruments over a dark sky, a projected object |
| Ember library | warm near-black with firelight and texture |
| Golden dusk | deep indigo with gold, a storybook evening |
| Swiss statement | white, one strong colour, very large type, calm and clear |
| Paper editorial | cream paper, serif headings, like a fine magazine |
| Neo-brutalist | bold colours, thick black outlines, confident and playful |
| Soft pastel | gentle colours, rounded shapes, friendly |
| Blueprint | blue drafting paper, white line drawings that draw themselves |
| Paper collage | cut paper pieces assembled into a picture, stop-motion feel |
| Retro terminal | green or amber text on black, like an old computer |

## 6. Landing page

Order: C1, C3, C4, C5, C7, then L1, C10, C9, C11, C12. Type-specific:

| ID | Question | Why | Default | Options | Fills |
|---|---|---|---|---|---|
| L1 | What should a visitor do on the page: sign up, buy, book, download, contact you? And what happens when they do? (E12) | the call to action and the form shape the page | "... one clear button that leads to a sign-up form, which saves the entry on the device and lets the visitor email it, until you connect a service" | sign up or waitlist; buy or book; contact me; just read and remember | `brief.primary_action`, `brief.form` |
| L2 | Do you have proof to show: customer quotes, logos of clients, numbers, press? | proof sections only with real proof | "... leave out proof sections rather than invent them" | yes, I will share it; no | `brief.proof` |

Routing: direction, tokens-theming, landing-hero, typography, motion-ui, scroll, pointer, ui-components (form),
verify; hero media from C7 (3d, shaders-vfx, holograms, lottie-rive-video); GOAT design.md overlays.

## 7. Website (several pages)

Order: C1, C3, W1, C4, C5, C10 (usually hosted), C7, C9, C11, C12. Type-specific:

| ID | Question | Why | Default | Options | Fills |
|---|---|---|---|---|---|
| W1 | Which pages should it have? | the structure and the navigation | "... home, about, the main offer, and contact" | free text, or: home plus three pages (Recommended); a single long page; many pages, I will list them | `brief.pages` |
| W2 | Will you change the content often yourself? | decides whether a simple editing setup is worth it | "... keep each page's text in one clear place you can edit" | rarely; often | `brief.editing` |

Routing: direction, tokens-theming, landing-hero, ui-components, transitions (cross-page morphs), scroll,
typography, single-file (file versus site), verify with `--mode both`.

## 8. Interactive course

Order: C1, C2, C3, K1, C4, K2 (E10), C9, C7, C10, C13. Type-specific:

| ID | Question | Why | Default | Options | Fills |
|---|---|---|---|---|---|
| K1 | Roughly how big is it: how many lessons or how long should it take? | scope and structure | "... size it from your material, about 5 to 10 short lessons" | a short module (under an hour); a course of 5 to 15 lessons; a large course | `brief.scope` |
| K2 | How should learners practise and be checked: quizzes, flashcards, a final test, a certificate? Should results go to a learning system? (E10) | question engines, review and LMS packaging | "... quizzes in every lesson with explained answers, spaced review cards, a final test and a certificate, progress saved on the learner's device" | quizzes and review (Recommended); quizzes, final test and certificate; report to my learning system | `brief.assessment`, `brief.lms` |

Routing: direction, tokens-theming, courses, typography, motion-ui, audio, single-file, verify; HTML-Master
05-learning-design for the lesson plan and coverage ledger, 06-book-media-state when a book or PDF is included, 04
teaching scenes; agents `sensei-course-builder`, `sensei-art-director`, `sensei-reviewer`.

## 9. Presentation

Order: C1, C2, C3, P1, C4, C5, P2 (E13), C7, C9, C10. Type-specific:

| ID | Question | Why | Default | Options | Fills |
|---|---|---|---|---|---|
| P1 | Will you present it live to a room, share it to be read alone, or both? And roughly how many slides or minutes? | live decks need a presenter view and big type; read-alone decks need more text | "... a live deck of about 12 to 20 slides with speaker notes" | presented live (Recommended); read alone; both | `brief.presenting`, `brief.scope` |
| P2 | Would you like a presenter window with notes and a timer, and a PDF for handouts? (E13) | presenter view and print are built in or not | "... include both" | both (Recommended); presenter view only; PDF only; neither | `brief.presenter`, `brief.pdf` |

Routing: direction, presentations, typography, transitions, motion-ui, single-file, verify; GOAT presentations.md
content patterns; agent `sensei-deck-builder`.

## 10. Dashboard

Order: C1, C2, D1 (E11), D2, C4, C10, C11, C9, C13, C14. Type-specific:

| ID | Question | Why | Default | Options | Fills |
|---|---|---|---|---|---|
| D1 | Where does the data come from: a file you have (spreadsheet, CSV), a live link, or should I make sample data? (E11) | the data contract and offline behaviour | "... build the data into the file as a snapshot, and show where to swap in fresh data" | I will share a file (Recommended); a live link; sample data for now | `brief.data` |
| D2 | Which three questions should the dashboard answer at a glance? | chart forms follow questions | "... pick the three most useful from the data" | free text | `brief.questions` |

Routing: direction, tokens-theming, dataviz, single-file, verify; GOAT dashboards-reports for KPI cards and print;
agent `sensei-dataviz-engineer`. Motion stays calmer here by design: default `lively`, never decorative over live
charts.

## 11. Game

Order: C1, G1, C2, C4, C7 (sound defaults to on for games), G2, C11, C10, C9, C13. Type-specific:

| ID | Question | Why | Default | Options | Fills |
|---|---|---|---|---|---|
| G1 | What kind of game, and how does a round work: what does the player do, how do they win or lose? | the rules are the engine | "... a short arcade round with a score, three lives and rising difficulty" | arcade action; puzzle; quiz game; story or adventure | `brief.game` |
| G2 | How will people play: keyboard, mouse or touch, a game controller? Should it save progress? | input and save engines | "... keyboard, touch and controller, with progress saved on the device" | all of them (Recommended); keyboard and mouse; touch only | `brief.input`, `brief.saves` |

Routing: direction, games, audio, motion-ui, single-file, verify; GOAT tools-games and canvas-2d for hand-rolled
effects; agents `sensei-game-engineer`, `sensei-sound-designer`.

## 12. Motion graphic or film

Order: C1, F1, C3, C4, F2 (E14), C7 (sound and music), C5, C9, C14. Type-specific:

| ID | Question | Why | Default | Options | Fills |
|---|---|---|---|---|---|
| F1 | How long, and where will it be shown: social media, a website hero, a presentation, a screen at an event? | duration, shape (wide, square, tall) and pace | "... a 20 to 30 second wide film" | social (tall or square); website or deck (wide); event screen | `brief.duration`, `brief.format` |
| F2 | Should it be a video file (MP4) you can post anywhere, or a page that plays in a browser, or both? (E14) | the render pipeline | "... both: a page that plays and a rendered MP4" | both (Recommended); MP4 only; page only | `profile.deliverable` (`film` when an MP4 is wanted) |

Routing: direction, motion-graphics, video-pipeline, audio, typography; handmade-animation for a drawn look;
agents `sensei-motion-director`, `sensei-film-renderer`, `sensei-sound-designer`.

## 13. Tool (calculator, converter, generator, kiosk)

Order: C1, T1, C2, C4, C10, C11, C9, C13. Type-specific:

| ID | Question | Why | Default | Options | Fills |
|---|---|---|---|---|---|
| T1 | What goes in and what comes out? For example: numbers in, a chart out; text in, a formatted page out. | the pure transform the tool is built around | "... design it from your request" | free text | `brief.transform` |
| T2 | Should it remember the last inputs, or let people share a link with their inputs filled in? | storage and address state | "... remember on the device and offer a share link" | both (Recommended); neither | `brief.state` |

Routing: GOAT tools-games (it owns this genre), ui-components, direction, tokens-theming, motion-ui, single-file,
verify. A kiosk adds GOAT's attract loop and touch lockdown.

## 14. What a request usually settles already

| The request says | Already answered | Do not ask |
|---|---|---|
| "single HTML file", "one file", "offline", "email it", "USB" | `offline: true`, delivery | C10 |
| "website", "site", "online", "at my domain" | `offline: false`, `deliverable: site` | C10 (ask only whether a single offline copy is also wanted, if it matters) |
| "course", "lessons", "e-learning", "module" | `deliverable: course` | what it is |
| "presentation", "deck", "slides", "talk", "pitch" | `deliverable: deck` | what it is |
| "dashboard", "charts", "report" | `deliverable: dashboard` | what it is |
| "game" | `deliverable: game` | what it is |
| "motion graphic", "promo video", "sting", "intro video", "MP4" | `deliverable: film` | what it is; F2 when "MP4" was said |
| "landing page", "sign-up page", "product page" | `deliverable: single-file` unless hosting is named | what it is |
| a named audience ("for nurses", "for my Year 9 class") | audience | C2 |
| a named look ("dark", "Swiss", "playful", "like Apple") | look direction | C4 (still offer three variants within it, as the explore method does) |
| a named language ("in Persian", "bilingual English and Arabic") | languages, RTL | C9 |
| "for my company", "to sell", "client" | `licence_mode: commercial` | C12 |
| "for my class", "personal", "a gift" | `licence_mode: personal` | C12 |
| "no animation", "calm", "minimal" | `motion: calm` | C6 |
| attached files, a pasted outline | sources | C3 (ask only how to treat gaps) |

## 15. From answers to fields

Every answer, inferred value and default goes into the brief (`brief-template.md`): the value in its section, and one
line in the decisions log with its source (`request`, `answer`, `inferred`, `default`). Profile values go into the
brief's Profile section in the exact allowed values: `deliverable` (`single-file`, `site`, `deck`, `course`,
`dashboard`, `game`, `film`, `component`), `offline` (`true`, `false`), `languages` (a JSON list of language codes),
`rtl`, `motion` (`cinematic`, `lively`, `calm`), `licence_mode` (`commercial`, `personal`), `react` (`true` only when
the project already uses React), `widths`, `budget` (`null` unless asked).
