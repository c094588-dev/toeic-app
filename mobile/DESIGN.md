# Wordnote UI — design review

## Direction

A quiet editorial vocabulary notebook: paper tones, ink green, serif English typography and lime accents. The overlapping `a / あ` circles express the connection between English and Japanese. Native views create the artwork and speaker icons; no images, font downloads or new runtime dependencies are required.

The same type hierarchy, spacing, colors and controls apply to home, level selection, flashcards, quiz and results. Home adapts at 760px. Learning content stays at a readable maximum width. Light and dark appearances follow the device setting.

## Review rounds

1. Established the visual system and redesigned every screen. Browser review found that the mobile hero artwork overlapped the Japanese description.
2. Removed the overlap, reduced the mobile artwork and progress panel, and refined 320px typography. Review found awkward wrapping in the level heading and overly long action labels.
3. Shortened those labels, adapted the English word size to the available width, replaced the sound symbol with a consistent speaker icon, and fixed the quiz's next action to the bottom after answering. Corrected the progress fill color on the dark collection panel.

## Verified

- Browser previews at 320px and 390px and a desktop viewport; light and dark appearances.
- Meaning reveal through the lower blank area, word and example translations, and independent pronunciation controls. Clicking pronunciation leaves the same word and card counter visible; audio quality still needs a real iPhone check.
- Marking a word mastered advances to the next card and restores the saved count after reload.
- Complete ten-question quiz flow through feedback, the fixed next button and results.
- Eight learning/data tests, TypeScript check, and web, iOS and Android bundle exports.
- Calculated text contrast: light primary 12.75:1, light secondary 4.59:1; dark primary 15.16:1, dark secondary 8.26:1.
- Motion respects the system's reduced-motion preference in code. This preference and native VoiceOver/TalkBack were not exercised on physical devices.

## Review criteria

Use visual coherence, original art direction, clear navigation, reading comfort, useful interaction and technical execution as review dimensions. The [Webby judging criteria](https://www.webbyawards.com/judging-criteria/) informed this review. This is an internal design review, not an award result or an independent jury score.
