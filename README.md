# Riz Lab: Virtual Vernier Callipers & Screw Gauge

A virtual physics lab for Class 11/12 (CBSE / NCERT, NEET / JEE level). It runs **on your laptop only** and is shown on a projector or TV over HDMI. Once installed, it needs **no internet**.

What it does:

- **Vernier callipers and screw gauge** that read exactly like the real instruments: least count, zero error (NCERT signs), corrected readings.
- **Practice** mode, which checks every step and recognises common mistakes.
- **Experiment** mode: observation table, error analysis, derived quantities, CSV and a printable A4 practical record.
- **Presentation** mode for the projector: large text, high contrast, and a step-by-step demo you can drive with a USB clicker.
- **Physics notes** page.

## 1. Install (once, while online)

1. Install **Node.js 20 or newer** from <https://nodejs.org> (the "LTS" version).
2. Open this folder and double-click the start script (see below). The first run downloads the packages it needs. Or run `npm install` in this folder yourself.

After that, the lab works with Wi-Fi turned off.

## 2. Start the lab

**Easiest:** double-click

- **Windows:** `start-lab.bat`
- **macOS / Linux:** `start-lab.sh` (on Linux you may need to run `./start-lab.sh` from a terminal)

The script builds the lab if needed, starts it at **http://localhost:4173**, and opens your browser. Keep its window open while you teach; close it to stop the lab.

**With commands:**

| Command | What it does |
|---|---|
| `npm start` | Serve the built lab at http://localhost:4173 and open the browser |
| `npm run build` | Build the static site into `dist/` (relative paths, works from any local static server) |
| `npm run preview` | Serve `dist/` at http://localhost:4173 |
| `npm run dev` | Development server at http://localhost:5173 |
| `npm run test` | Unit and property tests |
| `npm run coverage` | Tests plus a coverage report for `src/core/` (threshold 95 %) |
| `npm run lint` / `npm run typecheck` | Code checks |

## 3. Projector checklist

1. Connect the HDMI cable to the projector or TV.
2. Choose **Duplicate** (mirror) or **Extend** in your display settings (Windows: <kbd>Win</kbd> + <kbd>P</kbd>; macOS: System Settings → Displays).
3. Start the lab and open it in the browser **on the projector screen**. If you are extending, drag the browser window onto the projector.
4. Press <kbd>F11</kbd> (Windows) or <kbd>Ctrl</kbd> + <kbd>Cmd</kbd> + <kbd>F</kbd> (macOS) for browser fullscreen.
5. Open an instrument and press <kbd>P</kbd> for **Presentation mode**.
6. Walk to the back of the room and check the text is readable. If it is too small, set the display scale to 100–125 % (see Troubleshooting) or press <kbd>Ctrl</kbd> + <kbd>+</kbd> in the browser.

**Clicker / keyboard in Presentation mode:** <kbd>Space</kbd>, <kbd>→</kbd> or <kbd>PageDown</kbd> for the next step; <kbd>Backspace</kbd>, <kbd>←</kbd> or <kbd>PageUp</kbd> to go back; <kbd>P</kbd> to leave. The mouse pointer hides after 3 seconds without movement. Each demo walks through least count → zero error → reading → correction.

## 4. Using the instruments

| | Vernier callipers | Screw gauge |
|---|---|---|
| Move | Drag the slider. **Fine** makes a drag move 10× less. Hold ◀ ▶ to nudge. | Drag the thimble up or down, or scroll over it (1 notch = 1 division, <kbd>Shift</kbd> = 10). Hold ▲ ▼ to turn. |
| Keys (click the instrument first) | <kbd>←</kbd> <kbd>→</kbd> 0.01 mm, <kbd>Shift</kbd> 1 mm, <kbd>Alt</kbd> 0.001 mm | <kbd>↑</kbd> <kbd>↓</kbd> 1 division, <kbd>Shift</kbd> 0.1 division, <kbd>PageUp</kbd> / <kbd>PageDown</kbd> 1 turn |
| Close gently | **Close jaws** | **Ratchet** button or <kbd>R</kbd> (it clicks and slips at contact) |
| Lock | Click the locking screw, or <kbd>L</kbd> | Click the lock lever, or <kbd>L</kbd> |

**Both instruments:**

- <kbd>M</kbd> toggles the magnifier. Drag the lens to move it, pin it, and choose 4×, 6× or 8× in Settings.
- <kbd>+</kbd> / <kbd>−</kbd> zoom, <kbd>F</kbd> fits the whole instrument, <kbd>S</kbd> focuses on the scale, <kbd>0</kbd> resets the view.
- Drag the bench to pan; <kbd>Ctrl</kbd> + scroll to zoom.

**Objects tab:** choose what to measure. True sizes are hidden.

- Vernier callipers: pendulum bob, solid cylinder, beaker / calorimeter, rectangular block, glass marble, AA cell, hollow brass tube (outer and inner diameter, length), and matchbox.
- Screw gauge: copper wire, metal sheet / coin, glass slide, steel ball bearing, paper stack, human hair, razor blade, sewing needle, pencil lead, and plastic ID card.

Reposition the object between readings so the readings genuinely differ. For a wire, use *Move along wire* and *Rotate 90°* for the ∥ and ⊥ directions.

**Settings tab:**

- Instrument type and display unit (mm or cm).
- Zero error: none, random +, random −, random either sign, or custom.
- Backlash (screw gauge, advanced).
- Highlight aids, magnifier, and show the hidden true value.
- Theme (light, dark, high contrast), sound and vibration.
- **Session seed:** everyone who types the same seed gets the same objects and zero errors, so a whole class can work on identical data.

**Mode tab:**

- **Explore:** free play with the live readout. Every row has an ⓘ explanation.
- **Practice:** the readout is hidden. Enter LC, zero error, the scale readings and the corrected reading. Mistakes such as the wrong zero-error sign, adding the zero error, using n instead of n × LC, missing the half-mm mark, n vs N − n, and unit slips get a targeted hint. After 3 tries a worked solution is shown.
- **Experiment:** least count → zero error → 3–10 readings → error analysis → derived quantity. Then **Download CSV**, **Print / Save as PDF** (an A4 practical record), or **Copy result**.
- **Find the least count / Find the pitch:** guided activities.
- **Presentation:** same as <kbd>P</kbd>.

**Teacher links:** add `?seed=K7Q2-9F` to an instrument page's address to fix the data. Add `&mode=practice` (or `experiment`, `guided`) to open straight into a mode.

## 5. Troubleshooting

- **"Port 4173 is already in use" / the script window closes at once.** The lab is probably already running in another window: use that one, or close it and start again. Another program may also be using port 4173; restart the laptop to free it.
- **The browser did not open.** Open any browser and go to **http://localhost:4173** yourself.
- **"Node.js is not installed".** Install it from nodejs.org (while online), then run the start script again.
- **Everything looks too big or too small on the projector.** Check the operating system's display scale for the projector screen and set it to **100–125 %**:
  - Windows: Settings → System → Display → Scale.
  - macOS: System Settings → Displays.
  
  Then reload the page. <kbd>Ctrl</kbd> + <kbd>0</kbd> resets the browser zoom.
- **Colours look washed out on the projector.** Use Presentation mode (<kbd>P</kbd>) or the High-contrast theme in Settings.
- **No sound.** Sound starts after your first click or key press (browser rule). Check Settings → Sound and the laptop volume.

## 6. For maintainers

```
src/core/      pure physics (no DOM), fully tested: readings, zero error, mechanics, objects, errors, practice checks
src/render/    SVG drawing: materials, vernier and screw views, objects, loupe, viewport
src/ui/        store, page models, modes (practice, experiment, guided, presentation), exports, strings (i18n.ts)
src/input/     pointer drag, pan/zoom gestures, keyboard maps
src/audio/     synthesised sound effects (Web Audio)
src/pages/     page entry points (landing, vernier, screw gauge, notes)
scripts/       dev-only checks: screenshots, smoke tests, walkthroughs, performance, offline, Lighthouse helpers
docs/checkpoints/  milestone screenshots, recordings, printed A4 samples and reports
```

- Design assumptions and conventions are in `DECISIONS.md`; the specification is `spec.md`.
- All user-facing text is in `src/ui/i18n.ts`, ready for a second language.
- Dev scripts use the locally installed Chrome or Edge, for example `node scripts/smoke-screw.mjs http://localhost:5173`.
- **Online copy:** <https://riz-lab.web.app> (Firebase Hosting; the older <https://storage.googleapis.com/vernier-lab-bccad6de/index.html> is kept up to date too). Every push to `main` on GitHub runs `cloudbuild.yaml` on Google Cloud Build (trigger `VGSGLAB`, runs as service account `vc-sg-lab-deploy`): tests, build, then upload of `dist/` to the bucket and to Firebase Hosting. A failing test stops the upload, so the site keeps the last good version.

The only name used anywhere in the app is **Riz Lab**.
