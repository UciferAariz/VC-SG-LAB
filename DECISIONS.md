# DECISIONS.md

Assumptions and choices made where SPEC.md was silent or ambiguous. The tiebreaker throughout is NCERT Class 11 Physics, Units and Measurements, plus the NCERT Lab Manual.

---

## Architecture

**D1. Practice-mode answer checking lives in `src/core/practice.ts`, not `ui/`.**
Mistake detection is physics logic: it needs the correct values, the zero-error rule and the LC. SPEC §3 says such logic must be pure and tested, and §14.6 asks for tests of it. So `ui/practiceMode.ts` will only convert typed input into mm and turn the returned `MistakeCode` into a hint string.

**D2. Shared zero-error code is in `src/core/zeroCommon.ts`.**
Both instruments use the same NCERT rule (Corrected = Observed − ZE), the same ZE settings, and the same "n vs N − n" description. `vernier/zeroError.ts` and `screw/zeroError.ts` are thin wrappers over it.

**D3. Readings are integer least counts internally.**
Every reading carries `counts` (an integer number of LCs). For example, the vernier reading is M·N + k, and corrected = observed counts − ZE counts. Values in mm come only from `countsToMm()`, so float drift cannot build up (SPEC §4.1).

---

## Vernier

**D4. Coincidence search is the source of truth; ties go to the higher line (round half up, SPEC V10).**
`findCoincidence` checks every mark k = 0…N. When two lines are equally misaligned (within EPS × LC), the larger k wins. The cross-check formula uses `floor(v + 0.5 + EPS)`, so both methods treat ties the same way (property test G3). Marks 0 and N always coincide together because they are a whole number of MSD apart. "k = N" is reported as k = 0 with M + 1.

**D5. Reading from the coinciding pair.**
If vernier mark k meets main mark m_c, then M = m_c − γk and the reading is M·MSD + k·LC. This works for both γ = 1 and γ = 2 (the spread vernier). The proof is in the header comment of `vernier/reading.ts`.

**D6. No main-scale marks left of 0.**
For a negative zero error, a vernier mark that sits left of 0 is compared against mark 0, since no mark exists further left. The search does **not** clamp at the 150 mm end, because the scale is treated as continuing there. Instead the jaw opening is limited so the whole vernier stays over the engraved scale:
`maxGap = 150 − (γN − 1)·MSD − 2 mm`, giving Standard 139 mm, Fine-20 129 mm, Fine-50 99 mm, Spread-20 109 mm.

**D7. Inner jaws read the same as the outer jaws.**
The jaws are assumed to be designed so the inner-jaw gap equals the outer-jaw gap (SPEC §5.5). The depth rod sticks out past the beam end by exactly the gap.

**D8. Vernier tick heights.**
- Marks 0, N/2 and N are long.
- Labelled marks (every N/10) are medium.
- All other marks are short.

For N = 10 that means 0, 5 and 10 are long and the rest medium.

**D9. Collision clamp.**
- Outer jaws: gap ≥ object size.
- Inner jaws and depth rod: gap ≤ internal size.
- Always 0 ≤ gap ≤ maxGap.

---

## Screw gauge

**D10. Circular-scale labels.**
- N = 50: every 5th division is labelled and major.
- N = 100: every 10th division is labelled and major, with mid-length ticks every 5. Labelling every 5th on a 100-division thimble would crowd it.

**D11. Thimble edge and the sleeve marks.**
A sleeve mark exactly at the thimble edge (p = mark) counts as **uncovered**. This is what makes S7 (s = 0.5 → PSR 0.5, CSR 0) consistent with the picture.

**D12. `halfMmVisible`** is true when pitch = 0.5 and an odd number of whole revolutions has been made (R0 > 0). Practice mode uses it for the "half-mm trap" explanation.

**D13. Backlash model: a "play" element.**
The scale position is p = s + e + slack, with 0 ≤ slack ≤ w and w = b/360 × pitch.
- Turning to close takes slack to 0 before the spindle moves.
- Turning to open takes slack to w before the spindle moves.

So a gauge that is always **closed onto** the object reads correctly, and a reading taken while opening is high by up to w. A newly created gauge starts with slack = 0. b is drawn at random from 3°–12° when backlash is turned on.

**D14. Over-tightening.**
- k_c = maxCompression / 45°, so the cap is reached after 45° of attempted over-rotation.
- The thimble really turns only by the squash. The screw is stiff, so further attempted rotation beyond the cap does nothing.
- There is no spring-back. Turning back to open relieves the squash 1:1.
- maxCompression per object: wire 0.02 mm, sheet/coin 0.008 mm, glass slide 0.002 mm, steel ball 0.005 mm, paper stack 0.03 mm, human hair 0.006 mm, razor blade 0.001 mm, sewing needle 0.001 mm, pencil lead 0.004 mm, plastic ID card 0.01 mm.

**D15. Ratchet.**
- It slips only when closing at contact.
- Clicks are counted from the cumulative slip angle: one per 18° boundary crossed. A single large turn can therefore produce several clicks.
- Opening through the ratchet always drives the spindle.

---

## Zero error

**D16. Custom zero error** is entered as a magnitude in divisions plus a sign, so |ZE| = divisions × LC. A ±0.15-LC sub-offset is still added so the coincidence looks realistic. The NCERT "n" (the coinciding division) is derived from it: n = d for positive and n = N − d for negative.

**D17. `ZeroErrorInfo.n`** is always the division that coincides (vernier) or sits on the datum line (screw) when the instrument is closed. This holds for both signs, so the UI can say "n = 7, ZE = −(10 − 7) × 0.1".

---

## Numbers, rounding, error analysis

**D18. General rounding is half away from zero** (2.675 → 2.68, −2.675 → −2.68). Float noise is removed first by re-reading at 12 significant figures. All display goes through `formatFixed`, which builds the string from an integer, so outputs like "2.7300000000000004" and "-0.00" cannot appear.

**D19. Final result rule (SPEC §7.2).**
- Reported error = max(Δā, LC), rounded normally to the LC's decimal place. If Δā ≥ LC, rounding cannot take it below LC.
- The mean is rounded to the same decimal place.
- Relative and percentage errors use the raw (working) Δā and ā.
- `reportedPercentError` uses the rounded values.

**D20. Derived quantities** (V, A) use NCERT maximum-error propagation.
- The absolute error is rounded to 1 significant figure, or 2 if its first digit is 1.
- The value is rounded to the same decimal place.
- Example: d = (2.12 ± 0.02) cm gives V = (4.99 ± 0.14) cm³.

**D21. `countSigFigs` conventions.**
- Leading zeros are never significant.
- Trailing zeros after a decimal point are significant.
- Trailing zeros in an integer written without a point are treated as **not** significant ("100" → 1). Write "100." or "1.00e2" for 3.
- Zero ("0.00") counts as 1.

**D22. SPEC test E2 contains an arithmetic slip.**
For [2.10, 2.13, 2.08, 2.16, 2.12] the absolute errors are 0.018, 0.012, 0.038, 0.042, 0.002. Their sum is 0.112, so **Δā = 0.0224**, not 0.0216. The test asserts 0.0224. The reported result, (2.12 ± 0.02) cm, is unchanged.

---

## Practice mode (mistake detection)

**D23. Check order:** exact → specific mistake → close → unknown.
- "Close" means within ±1 LC, or ±1 division for the VSR/CSR box, where 0 and N − 1 count as neighbours.
- "Close" is applied to the ZE, observed and corrected boxes.
- Specific mistakes are checked first so that a ±1-LC coincidence cannot hide one.

**D24. Mistake definitions** (all values compared in mm; the UI converts from the box's unit):

| Code | Detected when |
|---|---|
| `sign-ze` | ZE answer = −ZE. Or a negative ZE read as positive using the coinciding n (e.g. +0.7 for −0.3), or the reverse. |
| `n-vs-N-minus-n` | Correct sign but used the other rule: +(N − n)·LC for a positive ZE, −n·LC for a negative ZE. Also detected in the corrected reading. |
| `added-ze` | Corrected = observed + ZE. Checked against both the true values and the student's own earlier answers. |
| `division-number` | Observed = MSR + n (mm box) or MSR(cm) + n (cm box). Or ZE = ±n or ±(N − n). Or n × LC typed into the VSR box. |
| `half-mm` | Screw gauge with pitch 0.5 only: the answer is off by exactly 0.5 mm. |
| `unit` | The answer is exactly ×10 or ÷10 of the correct value. |

---

## Objects and randomness

**D25. Imperfection model.**
For every dimension: `size = nominal + A·cos(2(angle − φ)) + T·(2·along − 1)`.
- A (orientation term) and T (taper / non-parallel faces) are drawn once per object.
- "Rotate / reposition" draws a new angle and measuring point.
- For a sheet or coin the angle acts as the second position coordinate.
- The paper stack has 20–100 sheets.

**D25a. Everyday objects.** Sizes follow the real article, so the readings look familiar to students.
- Vernier: glass marble d 14–17 mm (out of round by up to 0.08 mm); AA cell d 13.9–14.4 mm, L 49.8–50.4 mm including the + button (IEC R6); hollow brass tube D 18–26 mm, wall 1.2–2.5 mm (d with the inner jaws), L 40–70 mm; matchbox 47–53 × 34–38 × 14–17 mm (cardboard, faces bow by up to 0.1 mm).
- Screw gauge: human hair d 0.05–0.11 mm (oval, so rotating it matters); double-edge razor blade t 0.09–0.11 mm; sewing needle d 0.6–0.9 mm; pencil lead 0.5 / 0.7 / 0.9 refills (0.57 / 0.7 / 0.9 mm ± 0.02 mm); plastic ID card t 0.74–0.80 mm (ISO/IEC 7810: 0.76 mm).
- Derived quantities: marble → sphere volume; AA cell → cylinder volume; tube → internal volume (π/4)d²L; matchbox → block volume; hair, needle, lead → cross-sectional area (π/4)d². Blade and card have none.
- Hair, needle and lead use *Move to another point*; only the copper wire has the NCERT ∥/⊥ procedure.

**D26. Seeds** are 30-bit integers shown as 6 Crockford base-32 characters, e.g. `K7Q2-9F`.
- Case, spaces and dashes are ignored. I and L read as 1, O reads as 0.
- Any other text, such as "class 11B", is hashed into a valid seed, so every input is reproducible.
- Each subsystem uses `rng.fork(label)`, so the objects a class sees do not depend on how many numbers other features have drawn.

---

## M2: vernier rendering (Explore mode)

**D27. The inner (upper) jaws cross over.**
For "inner reading = outer reading" (D7) to hold geometrically:
- The fixed inner jaw's measuring knife edge faces **left** at x = 0, and its tip sits just right of zero.
- The moving inner jaw's knife edge faces **right** at x = gap, and its tip sits just left of it.

When closed, the two tips overlap. The moving jaw is drawn in front, as on real callipers where the upper jaws are stepped in thickness. With a beaker, the knife edges touch the inner walls exactly at x = 0 and x = D.

**D28. No blur or noise filters on anything that moves.**
Profiling in Chrome at 1920×1080 showed the cost:
- A drop-shadow filter on the whole instrument cut dragging to about 42 fps.
- The brushed-steel turbulence on the slider cost a further amount on its own.

Chrome repaints the whole SVG each frame, so filters are re-run each frame. Now:
- Shadows are three offset, faint silhouettes.
- Contact shadows use radial gradients.
- The slider's brushed finish is a fixed line pattern.
- Only the static beam keeps the `feTurbulence` brushed texture.

Result: 60 fps at 1280×720 and 1920×1080. With 4× CPU throttling the median frame is still 16.7 ms.

**D29. The loupe magnifies relative to the current view.**
It shows the live scene through `<use href="#vernier-scene">`, scaled by view scale × 4/6/8, so it stays vector-sharp. Its centre sits on the focus point.
- In **follow** mode the focus keeps a fixed offset from the vernier zero.
- In **pinned** mode it stays at a fixed point on the beam.

Dragging the lens moves the focus. The highlight aids are part of the scene, so they also appear magnified.

**D30. The highlight aid recolours the coinciding marks at their real length and width.**
It also adds triangle markers beyond the tick ends and a hairline guide. An earlier, thicker bar hid the coincidence it was meant to show.

**D31. Keyboard shortcuts.**
- Arrow, PageUp and PageDown keys move the slider only while the instrument has focus. Elsewhere they drive tabs and radio groups.
- Letter shortcuts (L lock, M magnifier, +/− zoom, F fit, S focus on scale, 0 reset view) work anywhere on the page except while typing in a field. A presenter doesn't have to click the instrument first.

**D32. Beaker drawings are cut-away sections.**
- For internal diameter, the beaker is shown upside down over the upper jaws, and only its lower 38 mm is drawn, with a break line.
- For depth, it lies on its side with its rim against the beam end. The rod enters near the wall, as you would do it for real.

**D33. URL parameters** (for teachers and the screenshot scripts) open a ready-made setup, for example:
`vernier.html?seed=K7Q2-9F&ze=custom&zeDiv=3&zeSign=-&gap=0&lo=auto&mag=4`

| Parameter | Values |
|---|---|
| `preset` | Vernier preset |
| `unit` | Display unit |
| `ze` | `none`, `pos`, `neg`, `rand` or `custom` |
| `zeDiv`, `zeSign` | Custom zero error |
| `gap` | Jaw gap in mm |
| `obj`, `dim` | Object and dimension |
| `touch=1` | Close onto the object |
| `mag` | Loupe magnification |
| `loupe` | Loupe on or off |
| `lo` | Loupe offset in mm, or `auto` for the coinciding line |
| `aids` | Highlight aids on or off |
| `true` | Show the true value |
| `view` | `fit` or `scale` |
| `theme` | Colour theme |

**D34. Phone layout.**
Below 600 px the panel is a bottom sheet with three snap heights: peek (104 px, shows the tabs), half (50 % of the screen) and full (88 %). Drag the handle, or tap or press it to cycle. Choosing a tab while peeking opens it half-way. Between 600 and 1023 px the panel stacks under the canvas. A dismissible "rotate to landscape" hint shows once on phones held upright.

## Revised spec: local-only, "Riz Lab"

**D35. Local and offline only.**
- Vite uses `base: './'` and a fixed preview port of 4173.
- There is no hosting configuration, service worker, manifest or Open Graph tags.
- Fonts are system stacks: no web-font downloads, no CDN.
- The smoke test confirms zero external network requests.

**D36. Branding.** The only name used is "Riz Lab": in the page header, the page titles, the beam engraving ("Riz Lab  0.1 mm") and the landing page footer.

---

## M3: screw gauge rendering

**D37. Drawing layout.** The anvil face is at x = 0 and the spindle face at x = s. The linear-scale zero is at x = 46 mm, and the thimble's bevelled edge sits at 46 + p (p = s + e + backlash slack). The sleeve ends at 74 mm, so it is always hidden under the 30 mm thimble across the whole 0–25 mm range.

**D38. Sleeve marks are hidden by an SVG clipPath at exactly the thimble edge.** A mark exactly at the edge shows its left half. For a negative zero error the edge sits slightly left of the zero mark, so the mark is "slightly covered" (SPEC §6.4).

**D39. Circular scale nodes are pooled.** One `<line>` per visible division and one `<text>` per visible label are reused every frame. Positions, stroke widths (0.3 + 0.7 cos φ) and opacities are re-set from `circularMarks()`; labels are foreshortened with `scale(1, cos φ)`.

**D40. Rotation is shown by the knurls.** The grip band on the thimble and the ratchet's diamond knurl shift downward as the gauge opens, matching the surface direction of S8. The ratchet's visual angle is the thimble angle plus the accumulated slip, so it visibly keeps turning while slipping.

**D41. Input mapping (SPEC §6.7).**
- Dragging the thimble or ratchet down opens the gauge: pulling the surface down moves the marks down. 1 px = 1.5°, or 0.15° in Fine mode.
- Wheel: 100 px of scroll (one mouse notch) = 1 division; Shift = 10. Small trackpad deltas accumulate.
- Keys: ↑/→ open, ↓/← close; R turns the ratchet 18° to close, Shift+R to open; O opens the gauge.

**D42. "Open" never reveals a size in hidden modes.** In Explore it goes to object size + 0.6 mm, or 5 mm with nothing in the gauge. In Practice and Experiment it goes to a fixed 15 mm, which is more than any object.

**D43. Recording is refused while the object is squashed.** In Practice and Experiment an over-tightened reading cannot be entered or recorded; the student is told to back off and close with the ratchet. Explore shows the squash in the readout (Spindle row) and flashes a warning once.

**D44. Loupe position on the screw gauge.** The loupe sits above and to the right of its focus (the datum line just right of the thimble edge), so it never hides the thimble or the lock lever.

## M4: modes

**D45. One adapter, shared modes.** Each page implements `LabAdapter` (`src/ui/lab.ts`): a snapshot built from core results plus a few actions. Practice, Experiment, Guided and Presentation are written once and serve both instruments.

**D46. Practice rounds are seeded.** Round r uses `fork("practice:<instrument>:<r>")` to choose the object, the dimension and a custom zero error of 1–6 (vernier) or 1–8 (screw) divisions with a random sign. A whole class with the same seed gets the same sequence. The zero error is set while the jaws are open; the student must close them to read it. Answers are checked against the instrument's state at the moment of checking. The corrected reading is checked against the state frozen when the reading step was completed. While values are hidden, the zero-error setting is disabled.

**D47. Scoring.** A field answered correctly at the first attempt adds 1 to the score and the streak; any wrong attempt resets the streak. After 3 wrong attempts the answer and a worked solution are shown, and the lines used are highlighted on the instrument.

**D48. Experiment rules.**
- The least count is found first (N, then span or pitch, then LC).
- The zero error is recorded with nothing in the jaws.
- A reading can be recorded only when the jaws touch the object and nothing is squashed. Recording twice without repositioning warns first ("Record anyway").
- Manual mode checks every typed value with core/practice and adds the row only when all are correct.
- Analysis uses the corrected readings in the display unit (cm for the vernier, mm for the screw gauge).
- The derived quantity uses the reported mean ± reported error of each finished quantity. A cylinder or block therefore needs each dimension measured ("Measure another quantity of this object").
- Paper, sheet and slide have no derived quantity.

**D49. Panel table vs. record.** In the side panel the "n × LC" column shows only the product, to fit seven columns. The CSV and the A4 sheet show the full "n × LC = value".

**D50. Print = browser print.** "Print / Save as PDF" fills a hidden `#print-sheet` and calls `window.print()`. A print stylesheet shows only that sheet on A4, headed "Riz Lab". No PDF library is used. The CSV has a UTF-8 BOM so Excel shows ∥, ⊥ and − correctly.

**D51. Guided activities.** For the vernier, the slider is placed with its zero exactly on the 10 mm mark and locked, so hovering or tapping the scale cannot move it. For the screw gauge, the pitch answer is accepted only after the thimble has turned one turn, to within half a division.

## M5: presentation, pages, accessibility

**D52. Presentation mode.**
- It uses the high-contrast theme and restores the previous theme on exit; the saved preference is not changed. The header, dock and tabs are hidden.
- The readout shows the reading rows only, label above value, at 24 px or more.
- The drawing area ends above the caption bar, so the bar never hides the instrument.
- On projector-sized screens the demo zooms the whole view onto the scales instead of using the small loupe.
- Each demo step sets the instrument up from scratch, so Back always works.
- Clicker presses add up immediately, even while a step is still animating.
- Captions reuse Practice mode's worked solutions, so the wording matches.

**D53. Page shortcuts and focus.** Letter shortcuts work everywhere except in typing targets: text and number boxes, selects and textareas. Radios, checkboxes and buttons are not typing targets, so P works with a setting focused.

**D54. Touch targets.** Every control's hit area is at least 44 × 44 px. The ⓘ buttons are 44 px with negative margins, so the readout stays compact. A switch's whole label row is clickable.

**D55. Notes diagrams are computed.** The figures on `notes.html` are drawn from core geometry, and their captions come from core reading functions, so the notes cannot disagree with the simulator. The screw figures are drawn at 2× along the axis so the half-mm marks are clear.

**D56. Preferences** (theme, sound, haptics) are kept in `localStorage` on the laptop, so they carry across pages. Nothing is sent anywhere, and no cookies are used.

## M6: polish

**D57. Start scripts.**
- `start-lab.bat` and `start-lab.sh` install packages only if `node_modules` is missing (which needs internet once), and build only if `dist/` is missing.
- They serve with `vite preview` on port 4173 (strict) and open the browser two seconds later.
- `NO_BROWSER=1` skips opening the browser (used for testing).

**D58. Drag performance.** The screw gauge reuses its highlight nodes. The lock button is rebuilt only when its state changes, not on every frame.
