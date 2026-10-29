# Brief: Climate science basics, Year 9

## 1. Request
I want to create an interactive course about the basics of climate science for my Year 9 students, in English and Persian.

## 2. Reading
Reading this as: an interactive science course for Year 9 students (13 to 14), with a living-planet language,
leaning toward deep ocean blue and sunlit amber / a rounded geometric sans with Vazirmatn for Persian / cinematic
motion. Memorable element: a glowing 3D Earth whose atmosphere thickens as the lessons add greenhouse gases.

## 3. Profile
- deliverable: course
- offline: true
- languages: ["en","fa"]
- rtl: true
- motion: cinematic
- licence_mode: personal
- react: false
- widths: [375, 768, 1440]
- budget: null

## 4. Purpose and audience
Goal: students understand the greenhouse effect, the carbon cycle, the evidence for warming, its impacts and the main
solutions, and can explain each in their own words. Primary action: finish each lesson and its quiz. Audience: Year 9,
mixed ability, little prior knowledge; a teacher sets lessons as class starters or homework.

## 5. Content and sources
The teacher shares the unit's syllabus and two worksheets (to be dropped into `materials/`); lessons follow their
order and wording. Gaps are written from well-established introductory sources, each listed in a coverage ledger
(HTML-Master learning design) with every invented example marked for the teacher to check.

## 6. Brand and assets
No school brand rules. Colours and type are designed for the subject. Fonts: Vazirmatn for Persian (OFL, shipped with
`sensei-typography`), a Latin face chosen in direction, both embedded and subset. The 3D Earth and its atmosphere are
built in code; no third-party models.

## 7. Look and feel
Explore three looks first and let the teacher pick: a living planet (glowing globe over a dark sky), a bright science
notebook, and a bold game style. Avoid glass panels behind long reading text.

## 8. Motion and media
Cinematic: a turnable 3D Earth, one animated explanatory scene per lesson (heat in, heat trapped, carbon moving),
gentle sounds for right and wrong answers, with a mute button and captions. Every animated system has a calm,
still version under reduced motion.

## 9. Interactivity
Six lessons of about ten minutes. Each lesson: a short quiz with explained answers that teach the rule, review cards
that come back over the following days, then a final quiz and a certificate with the student's name. Progress saved
on the device, surviving blocked storage with a progress code.

## 10. Delivery and devices
One offline file handed out on the class drive and USB sticks; opens with no internet. Target devices: school
laptops, tablets, phones and the classroom projector. Tested at 375, 768 and 1440 pixels wide.

## 11. Languages and accessibility
English and Persian, with a language switch; Persian is right to left with Persian digits where natural. Built in for
everyone: keyboard use, screen reader labels, strong contrast, forced colours and a calm mode.

## 12. Licences
Personal and classroom use. Every font, library and sound gets a ledger row; no never-ship or ideas-only sources.

## 13. Limits
No size limit. Deadline: none given.

## 14. Decisions log
- deliverable: course (source: request)
- audience: Year 9 students (source: request)
- languages: English and Persian, right to left (source: request)
- licence mode: personal, classroom use (source: request)
- materials: teacher shares syllabus and worksheets (source: answer)
- size: 6 lessons of about 10 minutes (source: answer)
- practice: quizzes, review cards, final quiz and certificate, progress on the device (source: answer)
- look: show three looks first (source: answer)
- delivery: one offline file (source: answer)
- extras: 3D Earth, animated scenes, gentle sounds (source: answer)
- devices: all, tested at phone, tablet and laptop widths (source: answer)
- accessibility: built in for everyone (source: default)
- size limit: none (source: default)

## 15. Routing plan
- Skills: html-sensei, sensei-direction, sensei-tokens-theming, sensei-courses, sensei-typography (Persian and RTL), sensei-3d, sensei-motion-ui, sensei-audio, sensei-single-file, sensei-verify
- Agents: sensei-art-director (three looks, then tokens), sensei-course-builder (lessons, engines, persistence, certificate), sensei-3d-engineer (the Earth), sensei-sound-designer (answer sounds), sensei-reviewer (design, accessibility, licences)
- From GOAT HTML: references/learning-apps.md (course skeleton, flashcards), references/case-studies.md (Ultra Bookworm lessons)
- From HTML-Master: references/05-learning-design.md (coverage ledger, outcomes, misconceptions), references/04-motion-3d.md (deterministic teaching clock for the lesson scenes)
- Slice first: lesson 1 complete in both languages, with its 3D Earth scene, quiz and saved progress, under reduced motion too
- Verify: verify.mjs on the packed file in strict file:// at 375, 768 and 1440, with a steps file walking a lesson, its quiz and the language switch; test-course.mjs and validate-lessons.mjs on the lesson data; not verifiable here: real school devices, Firefox and Safari, screen reader speech
