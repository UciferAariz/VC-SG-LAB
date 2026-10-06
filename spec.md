# Coding Agent Prompt — Virtual Vernier Callipers & Screw Gauge Lab

> **How to use:** Put this file in the project root as `SPEC.md` and tell your coding agent:
> *"Read SPEC.md fully. Follow the milestones in order and stop at each checkpoint to show me results."*
> The app runs **locally on a laptop only** and is shown on a projector or TV over HDMI. It is not hosted anywhere.

---

## 0. Your role and how to work

You are a senior front-end engineer with strong physics knowledge, building an educational simulator for Indian Class 11/12 students (CBSE/NCERT, NEET/JEE level). The output is a **realistic, interactive, physically exact virtual lab** for two instruments:

1. **Vernier Callipers**
2. **Screw Gauge (Micrometer)**

Working rules:
- **Physics correctness comes first, realism second, polish third.** A beautiful instrument that gives a wrong reading is a failure.
- Build in the **milestone order** in Section 16. At every checkpoint, stop, run the tests, and report results before moving on.
- Keep the **physics/reading logic** in pure, framework-free, fully unit-tested modules. Rendering and UI only *consume* that logic and never re-implement it.
- When something in this spec is ambiguous, pick the option that matches **NCERT Class 11 Physics (Chapter: Units and Measurements) and the NCERT Lab Manual**. Write the assumption in `DECISIONS.md`.
- Do not use photos, scans, or copied artwork of real instruments. Draw everything yourself in SVG.

---

## 1. Project overview

**Purpose:** Let a student practise taking readings exactly as in a real school lab, including least count, zero error, corrections, and error analysis. A teacher should also be able to project it in class as a demo.

**Where it runs:** **Locally only.** It runs on the presenter's laptop and is displayed on a classroom projector or TV connected by **HDMI** (mirrored or extended display). It is **not hosted on any website**, and must work with **no internet connection at all**.

**Primary users:**
- **Main use:** the presenter running a live demo on a laptop, projected over HDMI (typical projector resolutions 1280×720, 1024×768, or 1920×1080; low contrast; audience sitting far away, so text must be large)
- Laptop users with mouse, trackpad, and keyboard
- Secondary: phones and tablets on the same Wi-Fi, if opened via the laptop's local network address (keep the layout responsive, but this is not the priority)

**Success looks like:**
- A student can measure a randomly sized object, write readings into a table, apply zero correction, and compute mean absolute error and percentage error. The app checks every step.
- An examiner looking at the instrument cannot find a geometric or sign-convention mistake.

---

## 2. Tech stack and constraints

- **Build tool:** Vite
- **Language:** TypeScript (strict mode)
- **UI:** Vanilla TS with small, well-structured components. **No React/Vue/Angular.** A tiny reactive store written by you is fine.
- **Rendering:** **SVG** for both instruments, generated programmatically from the physics model. Use SVG `<defs>` for gradients, filters, patterns, and clip paths.
- **Styling:** Plain CSS with CSS custom properties (design tokens). No Tailwind.
- **Testing:** Vitest for unit tests, plus `fast-check` for property-based tests. Optional: Playwright for a few end-to-end smoke tests.
- **Audio:** Web Audio API, with clicks synthesised in code. No audio files.
- **No backend, no database, no login, no analytics, no cookies, no third-party trackers.**
- **Bundle budget:** under 300 KB gzipped JS+CSS total (excluding fonts). First load under 1 MB.
- **Fonts:** One sans-serif UI font plus one condensed font for engraved scale numerals. Self-host them or use a system stack. No icon fonts; use inline SVG icons.
- **Browser support:** Latest Chrome, Edge, Firefox, Safari, Chrome Android, Safari iOS.
- **Fully offline:** zero network requests at runtime. No CDN scripts, no Google Fonts, no remote images. Bundle and self-host everything (fonts included).
- **Output:** `npm run build` produces a static `/dist` with **relative asset paths** (Vite `base: './'`), so it works when served locally by `npm run preview` or any simple local static server.

---

## 3. Repository structure

```
/
├─ SPEC.md                  (this file)
├─ DECISIONS.md             (your assumptions & choices)
├─ README.md                (install, run locally, test, projector setup)
├─ index.html               (landing page)
├─ vernier.html
├─ screw-gauge.html
├─ notes.html               (physics notes page)
├─ src/
│  ├─ core/                 (PURE LOGIC — no DOM imports allowed)
│  │  ├─ units.ts
│  │  ├─ rng.ts             (seeded PRNG)
│  │  ├─ vernier/
│  │  │  ├─ config.ts
│  │  │  ├─ geometry.ts
│  │  │  ├─ reading.ts
│  │  │  └─ zeroError.ts
│  │  ├─ screw/
│  │  │  ├─ config.ts
│  │  │  ├─ geometry.ts
│  │  │  ├─ reading.ts
│  │  │  ├─ zeroError.ts
│  │  │  └─ mechanics.ts    (ratchet, over-tightening, backlash)
│  │  ├─ objects.ts         (measurable objects + imperfections)
│  │  ├─ errors.ts          (error analysis + propagation)
│  │  └─ sigfig.ts          (rounding & significant figures)
│  ├─ render/
│  │  ├─ svgUtils.ts
│  │  ├─ materials.ts       (gradients, textures, filters)
│  │  ├─ vernierView.ts
│  │  ├─ screwView.ts
│  │  ├─ magnifier.ts
│  │  └─ objectsView.ts
│  ├─ ui/
│  │  ├─ store.ts
│  │  ├─ controls/          (sliders, toggles, segmented controls)
│  │  ├─ readoutPanel.ts
│  │  ├─ practiceMode.ts
│  │  ├─ experimentMode.ts
│  │  ├─ guidedMode.ts
│  │  ├─ presentationMode.ts
│  │  ├─ observationTable.ts
│  │  ├─ errorWorkings.ts
│  │  └─ export.ts          (CSV + print)
│  ├─ input/
│  │  ├─ pointer.ts         (unified mouse/touch/pen)
│  │  ├─ keyboard.ts
│  │  └─ gestures.ts        (pinch-zoom, pan, rotate-drag)
│  ├─ audio/sfx.ts
│  └─ styles/
├─ tests/
│  ├─ vernier.reading.test.ts
│  ├─ vernier.zeroError.test.ts
│  ├─ vernier.geometry.test.ts
│  ├─ screw.reading.test.ts
│  ├─ screw.zeroError.test.ts
│  ├─ screw.mechanics.test.ts
│  ├─ errors.test.ts
│  ├─ sigfig.test.ts
│  └─ property.test.ts
└─ public/
```

**Hard rule:** Nothing in `src/core/` may import from `render/`, `ui/`, `input/`, or touch `window`/`document`. Enforce this with an ESLint `no-restricted-imports` rule.

---

## 4. Shared physics conventions (READ CAREFULLY)

### 4.1 Units and numbers
- **All internal lengths are in millimetres (mm), stored as floating-point numbers.**
- Display units can be toggled: **mm** or **cm**. Vernier defaults to **cm** (NCERT practice). Screw gauge defaults to **mm**.
- Never accumulate floating-point drift in readings. Compute readings from integer division counts:
  `reading = (mainCount × MSD) + (coincidingDiv × LC)`.
  Format with a fixed number of decimals derived from the LC. Use a `formatLength(valueMm, unit, lc)` helper.
- Use a tolerance `EPS = 1e-9` for floating comparisons.

### 4.2 True value vs. reading
- Every instrument has a **true continuous position** (for example, true jaw gap 23.4718 mm).
- The **reading** is what a careful student would record: quantised by choosing the **best-coinciding division**.
- **Never snap the true position to the least count.** The scales must look exactly as they would at that true position, including slightly imperfect coincidence.
- In answer-check views, show three values: *true value* (6 decimals, labelled "simulator's hidden true value"), *correct observed reading*, and *correct corrected reading*.

### 4.3 Zero error sign convention (NCERT)
- **Zero error (ZE)** is the reading shown when the jaws/faces are closed with nothing between them.
- **Zero correction = −ZE.**
- **Corrected reading = Observed reading − ZE.**
- These rules must be identical everywhere: logic, readout, practice explanations, notes page, and exported files.

### 4.4 Randomness
- Use a **seeded PRNG** (for example mulberry32 or sfc32) in `core/rng.ts`.
- Each session gets a seed, shown in Settings as a short code (for example `K7Q2-9F`). A student or teacher can type a seed to reproduce the exact same objects and zero errors. This lets a whole class work on identical data.
- Never use `Math.random()` inside `core/`.

---

## 5. Instrument 1 — Vernier Callipers

### 5.1 Configurations

| Preset | Main scale division (MSD) | Vernier divisions N | N VSD = ? MSD | Least count |
|---|---|---|---|---|
| **Standard (default)** | 1 mm | 10 | 9 | **0.1 mm** |
| Fine-20 | 1 mm | 20 | 19 | 0.05 mm |
| Fine-50 | 1 mm | 50 | 49 | 0.02 mm |
| Spread-20 (advanced) | 1 mm | 20 | 39 | 0.05 mm |

General formulas, for a vernier where N VSD span `(γN − 1)` MSD, with spread factor γ = 1 or 2:
- `VSD = (γN − 1) × MSD / N`
- `LC = γ × MSD − VSD = MSD / N`

Store each config as `{ msd, n, gamma }` and derive everything else. **No hard-coded LCs.**

**Main scale range:** 0 to 15 cm (150 mm). Numbers appear every 10 mm (0, 1, 2 … 15, in cm). Tick heights: 1 mm short, 5 mm medium, 10 mm long.
**Vernier scale numbering:** For N = 10, label 0–10 on every division. For N = 20, label every 2nd division as 0, 1, 2 … 10. For N = 50, label every 5th division as 0, 1 … 10. This matches real instruments.

### 5.2 Geometry (`core/vernier/geometry.ts`)
Let `x` = position of the **vernier zero mark** relative to the **main-scale zero mark** (mm).
- Without zero error: `x = gap` (jaw opening).
- With zero error `e` (mm): `x = gap + e`.

Positions:
- Main scale mark `m` (integer ≥ 0) is at `m × MSD`.
- Vernier mark `k` (0 … N) is at `x + k × VSD`.

Export pure functions:
- `mainTicks(range)`: returns positions, heights, and labels
- `vernierTicks(x, config)`: returns positions, heights, and labels
- `coincidenceMisalignment(x, k, config)`: returns the signed distance from vernier mark k to the nearest main mark

### 5.3 Reading algorithm (`core/vernier/reading.ts`)
```
M      = floor(x / MSD + EPS)            // main scale reading (in MSD units)
f      = x/MSD − M                       // fractional part, 0 ≤ f < 1
k      = round(f × N)                    // coinciding vernier division
if k == N: M = M + 1; k = 0              // edge case: rounds to the next mm
reading = M × MSD + k × LC
```
- Also return `misalignment[k]` for k − 1, k, and k + 1 so the UI can highlight the best line and explain *why* the neighbours are worse.
- Prove in a code comment that `round(f × N)` gives the line of minimum misalignment for the `γ = 1` case, and handle `γ = 2` by searching all k for the minimum `|misalignment|`. The search method must be the source of truth, with the formula used only as a cross-check in tests.

Return type:
```ts
interface VernierReading {
  msrMm: number;          // M × MSD
  vsr: number;            // k (coinciding division)
  lcMm: number;
  observedMm: number;     // msr + vsr × lc
  misalignments: { k: number; deltaMm: number }[];
}
```

### 5.4 Zero error (`core/vernier/zeroError.ts`)
When the jaws are closed (`gap = 0`), `x = e`.
- **Positive ZE:** vernier zero is to the **right** of main zero (`e > 0`). If vernier division `n` coincides, then `ZE = +n × LC`.
- **Negative ZE:** vernier zero is to the **left** of main zero (`e < 0`). If vernier division `n` coincides, then `ZE = −(N − n) × LC`.
- Check: the general algorithm in 5.3 already gives this. For `e = −0.3 mm`, N = 10: `M = −1, f = 0.7, k = 7, reading = −1 + 0.7 = −0.3 mm = −(10 − 7) × 0.1`. Add this as a test.

Zero-error settings: **None** / **Random positive** / **Random negative** / **Random (either sign)** / **Custom** (enter the number of divisions and the sign).
- Random magnitudes are a whole number of LCs, 1 to 6, plus a tiny random sub-LC offset (±0.15 LC). This keeps coincidence realistic but unambiguous.
- **Rendering for negative ZE:** the main scale has **no marks left of 0**, but the steel beam continues a little to the left so the vernier zero can sit there visibly.

### 5.5 Physical parts and what each measures

| Part | Measures | Reading source |
|---|---|---|
| Outer (lower) jaws | External diameter / length | Same scales |
| Inner (upper) jaws | Internal diameter | Same scales (assume jaws designed so inner = outer gap; document this) |
| Depth rod | Depth | Same scales; rod length beyond the beam end = gap |

- The depth rod slides out of the end of the beam as the jaws open. Render it.
- The **locking screw** on top of the vernier toggles the lock. When locked, the slider cannot move, and the screw head shows a slight rotation animation.

### 5.6 Objects for the vernier (`core/objects.ts`)
Each object has a true size drawn from the seeded RNG within a realistic range, **plus imperfection** so repeated readings vary realistically.

| Object | Measure | True size range | Imperfection model |
|---|---|---|---|
| Pendulum bob (sphere) | External diameter | 15.00–25.00 mm | Slight ellipsoid: diameter depends on orientation, ±0.05–0.15 mm |
| Solid cylinder | Diameter and length | Ø 12–25 mm, L 25–60 mm | Small taper along the length (±0.05 mm) |
| Beaker/calorimeter | Internal diameter (inner jaws), depth (depth rod) | ID 40–60 mm, depth 50–80 mm | Slight out-of-roundness ±0.1 mm |
| Rectangular block | Length, breadth, height | 10–60 mm each | Small non-parallel faces ±0.05 mm |

- **Repositioning:** a "Rotate / reposition" button (and a drag gesture on the object) changes the object's orientation or measuring point. This changes the true value within its imperfection band. This is how a student gets genuinely different readings for error analysis.
- **Collision:** jaws stop on contact. Dragging past contact clamps `gap = objectSize(orientation)`. Inner jaws stop on the inner wall. The depth rod stops at the beaker base.
- The object must be visibly *gripped*: draw it in front of or behind the jaws with correct layering, and a small contact shadow.
- Allow measuring with **no object** (to check zero error).

### 5.7 Interaction (vernier)
- **Drag** the thumb-grip or anywhere on the vernier slider to move it. Use Pointer Events (unified mouse, touch, pen) with `setPointerCapture`.
- **Fine control:**
  - Arrow keys: ±0.01 mm. Shift+Arrow: ±1 mm. Alt+Arrow: ±0.001 mm.
  - On touch: a "fine mode" toggle reduces drag sensitivity 10× (finger movement maps to one-tenth the jaw movement).
  - An on-screen fine-adjust nudge button pair (◀ ▶) with press-and-hold auto-repeat.
- **Inertia:** none. Real callipers don't coast. Add only a subtle friction feel (motion follows the pointer with a 1–2 frame smoothing at most).
- **Magnifier:** a circular loupe (4×, 6×, or 8×) that follows the vernier region. It can be pinned or moved by dragging. It must render from the **same SVG model** (re-use the same `<symbol>`/group, scaled), not a bitmap screenshot, so it stays crisp.
- **Highlight aids (toggleable, OFF in Practice mode):** colour the coinciding line pair, and show a thin vertical guide through it.

---

## 6. Instrument 2 — Screw Gauge (Micrometer)

### 6.1 Configurations

| Preset | Pitch | Circular divisions N | Least count | Linear scale marks |
|---|---|---|---|---|
| **Standard (default)** | 0.5 mm | 50 | **0.01 mm** | mm above datum line, half-mm below |
| Alt-A | 1.0 mm | 100 | 0.01 mm | mm above datum line only |
| Fine | 0.5 mm | 100 | 0.005 mm | as Standard |

`LC = pitch / N`. Store as `{ pitch, n }` and derive the rest.

**Range:** 0–25 mm. Linear-scale numbers every 5 mm (0, 5, 10, 15, 20, 25).

### 6.2 Geometry and kinematics (`core/screw/geometry.ts`)
- `s` = true gap between the anvil face and the spindle face (mm).
- `e` = zero error offset (mm).
- **Effective scale position:** `p = s + e`.
- **Thimble rotation:** `θ = (p / pitch) × 360°`.
- **Thimble edge position along the sleeve** = `p` (the thimble's bevelled edge moves with the spindle).
- **Linear scale visibility:** marks at positions `≤ p` are uncovered. Marks beyond the thimble edge are hidden under the thimble. Clip them with an SVG clipPath at the thimble edge.

**Circular scale rendering (realistic cylinder projection):**
- The thimble is a cylinder of radius `R` viewed side-on. Division `j` sits at angle `φ_j = (j / N) × 360° − θ`, measured from the datum (reference) line.
- Screen vertical offset from the datum line: `y = −R × sin(φ_j)` (negative is up). Mark is visible only if `cos(φ_j) > 0.08` (front half).
- Tick **apparent spacing compresses** toward the top and bottom edges. Tick stroke width and opacity scale with `cos(φ_j)`. Numbers are foreshortened vertically with `scaleY(cos φ_j)`.
- **Direction convention (must hold):** on the visible face, **numbers increase going upward**. Opening the gauge (increasing `s`) makes the thimble surface move **downward** past the datum line, so higher numbers arrive at the line. This is what makes the NCERT rule work: *zero of the circular scale BELOW the datum line means POSITIVE zero error.* Write a test for this direction (see Section 14).
- Number every 5th division (0, 5, 10 … 45 for N = 50). Major ticks every 5, mid ticks optional, minor every 1.

### 6.3 Reading algorithm (`core/screw/reading.ts`)
```
r      = p / pitch                       // revolutions from zero
R0     = floor(r + EPS)                  // whole revolutions
c      = round((r − R0) × N)             // circular scale reading
if c == N: R0 = R0 + 1; c = 0
PSR    = R0 × pitch                      // pitch scale reading
reading = PSR + c × LC
```
Return:
```ts
interface ScrewReading {
  psrMm: number;
  csr: number;
  lcMm: number;
  observedMm: number;
  csrFraction: number;   // (r − R0) × N, unrounded; for "estimate" explanations
}
```
**Pitch-scale trap to explain in the UI:** with pitch 0.5 mm, if the half-mm mark (lower side) is visible, the PSR includes +0.5 mm. The Practice-mode explanation must call this out explicitly. It is the #1 student mistake.

### 6.4 Zero error (`core/screw/zeroError.ts`)
With faces touching (`s = 0`), `p = e`.
- **Positive ZE:** circular scale zero lies **below** the datum line. The datum line reads division `n`, so `ZE = +n × LC`. The thimble edge is just past the linear-scale zero (the zero mark is fully visible).
- **Negative ZE:** circular scale zero lies **above** the datum line. The datum line reads division `n`, so `ZE = −(N − n) × LC`. The thimble edge slightly covers the linear-scale zero mark.
- The general algorithm already handles this. For `e = −0.04 mm`, N = 50, pitch 0.5: `r = −0.08, R0 = −1, c = round(0.92 × 50) = 46`, giving `reading = −0.5 + 0.46 = −0.04 mm = −(50 − 46) × 0.01`. Make this a test.
- Settings: same as the vernier (None / Random + / Random − / Random ± / Custom). Random magnitude is 1–8 divisions, plus a ±0.15-division sub-offset.

### 6.5 Mechanics (`core/screw/mechanics.ts`)
Model the following as pure functions or a small state machine, fully tested:

1. **Contact:** the spindle cannot pass the object surface. The gap is clamped at `objectThickness(point)`.
2. **Turning the thimble directly past contact (over-tightening):**
   - Extra rotation beyond contact compresses the reading via a stiff spring model:
     `compression = min(maxCompression, k_c × extraAngle)`, with `maxCompression` ≈ 0.02 mm (soft wire) or 0.005 mm (steel ball).
   - The reading drops below the true value, simulating a real error. Show a subtle visual: the wire flattens slightly.
   - On release, there is no spring-back (the student must back off manually), which matches real behaviour closely enough.
3. **Ratchet:** turning via the ratchet knob drives the spindle normally until contact. At contact, the ratchet **slips**: rotation continues visually on the ratchet only, the thimble stops, a click sound plays every 18° of slip, and a haptic tick fires on mobile if available. No compression occurs.
4. **Backlash (advanced toggle, default OFF):** when the rotation direction reverses, the first `b` degrees of rotation turn the thimble without moving the spindle. Here `b` is random, 3°–12° (≈ 0.004–0.017 mm at pitch 0.5). The readout must still show the thimble's *actual* scale position, which is what a student would read, so the reading becomes wrong by up to `b` worth of travel. Teach this: "always approach the final reading in the same direction."
5. **Lock lever:** freezes the spindle and thimble.

### 6.6 Objects for the screw gauge

| Object | Measure | True size range | Imperfection |
|---|---|---|---|
| Copper wire | Diameter | 0.30–1.50 mm | Ovality ±0.005–0.015 mm (depends on angle), taper along length ±0.01 mm |
| Thin metal sheet / coin | Thickness | 0.50–2.00 mm | Thickness varies with position ±0.01 mm |
| Glass slide | Thickness | 0.90–1.30 mm | ±0.005 mm |
| Steel ball bearing | Diameter | 3.000–8.000 mm | ±0.002 mm |
| Paper stack (fun) | Thickness of N sheets | 0.08–0.12 mm per sheet × N | ±0.003 mm |

- **Reposition controls for the wire:** "Move along wire" (changes measuring point along the length) and "Rotate 90°" (measures the perpendicular diameter). The NCERT procedure says to take readings at different points and in two perpendicular directions. Support exactly that, and record the direction (∥ or ⊥) in the observation table.

### 6.7 Interaction (screw gauge)
- **Rotate the thimble:**
  - Vertical drag on the thimble face: 1 px = a configurable angle (default 1.5°). Fine mode = 0.15°/px.
  - Mouse wheel: 1 notch = 1 circular division. Shift+wheel = 10 divisions.
  - Keyboard: ↑/↓ = 1 division, PageUp/PageDown = 1 full turn, Shift+↑/↓ = 0.1 division.
- **Ratchet knob:** drag or wheel on the ratchet to drive it, with slip behaviour as in 6.5.
- **Quick "open wide" control** for convenience: animate to a target gap so students don't spin 50 turns by hand. Disable it in Practice mode when it would reveal values.
- **Magnifier** on the datum line / thimble edge region (same rules as the vernier: vector, not bitmap).

---

## 7. Error analysis module (`core/errors.ts`, `core/sigfig.ts`)

### 7.1 Required computations
Given n corrected readings `a₁ … aₙ`:
1. **Mean:** `ā = Σaᵢ / n`
2. **Absolute error of each reading:** `|Δaᵢ| = |ā − aᵢ|`
3. **Mean absolute error:** `Δā = Σ|Δaᵢ| / n`
4. **Relative error:** `δa = Δā / ā`
5. **Percentage error:** `δa × 100 %`
6. **Optional (toggle):** sample standard deviation `σ`, with a note that it is beyond NCERT scope.

### 7.2 Reporting rule (state it explicitly in the UI)
- **The final uncertainty cannot be smaller than the least count.** Reported error `= max(Δā, LC)`.
- Round the reported error to the decimal place of the LC. Round the mean to the same decimal place.
- Final format: `a = (ā ± Δa) unit`, for example `d = (2.73 ± 0.01) mm`.
- Always show **both** the raw computed values (more decimals, labelled "working") and the final rounded result.
- Write the rounding rule in `DECISIONS.md` and the notes page.

### 7.3 Error propagation (derived quantities)
Implement and show step-by-step working with symbols, then numbers:

| Quantity | Formula | Relative error |
|---|---|---|
| Volume of sphere | V = (4/3)πr³ = (π/6)d³ | ΔV/V = 3 Δd/d |
| Volume of cylinder | V = (π/4)d²L | ΔV/V = 2 Δd/d + ΔL/L |
| Wire cross-section | A = (π/4)d² | ΔA/A = 2 Δd/d |
| Volume of block | V = l·b·h | ΔV/V = Δl/l + Δb/b + Δh/h |
| Internal volume of beaker | V = (π/4)D²h | ΔV/V = 2 ΔD/D + Δh/h |

Use **maximum-error (additive) propagation**, as in NCERT.

### 7.4 Significant figures (`core/sigfig.ts`)
- `roundToDecimals`, `roundToSigFigs`, `countSigFigs(string)` (handles trailing zeros in decimal strings correctly).
- Never let JS float formatting leak through (no `2.7300000000000004`). All displayed numbers go through the formatter.

---

## 8. Modes

### 8.1 Explore mode (default)
- Free play. Live **readout panel** shows: config, LC, MSR/PSR, coinciding VSR/CSR, observed reading, ZE, zero correction, corrected reading, and the true value (togglable, hidden by default).
- Every readout row has an ⓘ tooltip explaining the term in one sentence.

### 8.2 Practice mode
- The readout is hidden. A random object and a random zero error are generated (seeded).
- The student enters values field by field:
  - Step 1: LC (only the first time per config)
  - Step 2: Zero error (with jaws closed). The student closes the jaws first.
  - Step 3: MSR/PSR, then VSR/CSR, then the observed reading
  - Step 4: Corrected reading
- **Checking:**
  - Exact match with the correct quantised value: ✅
  - Within ±1 LC on the coinciding division: 🟡 "Close. Look again at which line coincides best." Highlight the k−1, k, k+1 candidates in the magnifier with their misalignments.
  - Otherwise: ❌ with a targeted hint based on *which* mistake was made. Detect these specific mistakes:
    - Sign error in zero error
    - Added the zero error instead of subtracting it
    - Used the division *number* instead of division × LC
    - Missed the half-mm mark on the screw gauge (an error of exactly 0.5 mm)
    - Used N − n instead of n (or the reverse) for zero error
    - Unit confusion (mm vs. cm, an error of ×10)
- After 3 attempts, show a **step-by-step worked solution** with the relevant lines highlighted on the instrument.
- Score/streak counter stored in memory only (no persistence required).

### 8.3 Experiment mode (for the project)
- The student picks an object and a quantity (for example "wire diameter").
- **Step 1:** determine LC (guided).
- **Step 2:** determine zero error (close the jaws or faces, read, record).
- **Step 3:** take **at least 5 readings** (configurable 3–10), repositioning between readings. The app **warns** if the student records two readings without repositioning.
- **Observation table auto-fills from the instrument** when the student clicks "Record reading", but also allows **manual entry mode**, where the student types values and the app validates each.
  - Vernier columns: `S.No | MSR (cm) | VSR (n) | n × LC (cm) | Observed (cm) | Corrected (cm)`
  - Screw gauge columns: `S.No | Direction (∥/⊥) | PSR (mm) | CSR (n) | n × LC (mm) | Observed (mm) | Corrected (mm)`
- **Step 4:** error analysis, auto-computed with full step-by-step workings (Section 7). Each step can be expanded or collapsed.
- **Step 5 (optional):** derived quantity with error propagation.
- **Export:**
  - **CSV** of the observation table plus results
  - **Print / Save as PDF** view: clean A4 layout with the header **"Riz Lab"** (nothing else in the header), then title, aim, apparatus, LC, zero error, observation table, calculations, result, and precautions, styled like a school practical file. Use a print stylesheet; no PDF library is needed.
  - **"Copy result"** button giving a plain-text summary.

### 8.4 Guided "Find the least count" and "Find the pitch" activities
- **Vernier:** zoom to the scale. The student counts how many VSD equal how many MSD (interactive highlight as they hover), then computes LC = MSD/N.
- **Screw gauge:** the student rotates the thimble exactly one full turn from a marked start and observes the linear distance moved (= pitch). Then the student counts circular divisions and computes LC = pitch/N.

### 8.5 Presentation / Demo mode (for classroom projection)
- Fullscreen button (Fullscreen API).
- High-contrast theme, all text ≥ 24 px, readout docked large on the right.
- **Auto-demo:** a scripted animation that opens the jaws, inserts an object, closes, magnifies, highlights the coinciding line, and walks through the reading with captions. Space bar = next step, Backspace = previous step. Provide one script per instrument covering: LC → zero error → reading → correction.
- Keyboard shortcut `P` toggles presentation mode.
- **Built for HDMI projection:**
  - Layout fits exactly in 1280×720 and 1920×1080 with no scrolling; also handle 1024×768 (4:3) projectors.
  - Works on an **extended display**: if the browser window is on the projector, everything must still scale correctly (use viewport units, not fixed pixel sizes tied to the laptop screen).
  - Projectors wash out colour and thin lines: in this mode, thicken scale ticks by ~1.5×, raise contrast of the engraved marks, and make coinciding-line highlights bold and thick.
  - Hide the mouse cursor after 3 seconds of no movement; show it again on movement.
  - A small clicker-friendly control set: Space / → / PageDown = next step, Backspace / ← / PageUp = previous step (so a USB presentation clicker works).

---

## 9. Layout and UI

### 9.1 Landing page (`index.html`)
- Title: "Virtual Physics Lab — Vernier Callipers & Screw Gauge"
- Two large cards with a small static SVG illustration of each instrument and a one-line description
- Links: Physics Notes, How to Use, About
- Footer: only the text **"Riz Lab"**. No name, class, school, or links.

### 9.2 Instrument page layout
- **Desktop (≥ 1024 px):** instrument canvas takes the left ~70 %. The right side panel holds tabs for **Readout · Mode · Objects · Settings**.
- **Tablet (600–1023 px):** canvas on top, panel below as tabs.
- **Phone (< 600 px):**
  - Canvas fills the width. The vernier is long, so default the view to the jaw and scale region with the zoom level fitted to show ~4 cm of scale. The student can pan and zoom.
  - The panel becomes a **bottom sheet** with 3 snap heights (peek / half / full).
  - Floating fine-adjust buttons sit bottom-right, sized for thumbs (≥ 48 px).
  - Show a soft "rotate to landscape for the best view" hint once (dismissible), but the app must be fully usable in portrait.
- **Canvas controls:** zoom in/out buttons, "Reset view", "Fit instrument", "Focus on scale". Pinch-zoom and two-finger pan on touch. Ctrl/⌘+wheel zoom on desktop. Zoom range 0.5×–12×.

### 9.3 Settings panel
- Instrument preset (Section 5.1 / 6.1 tables)
- Display unit (mm / cm)
- Zero error mode
- Backlash on/off (screw gauge)
- Highlight aids on/off
- Sound on/off, haptics on/off
- Theme: Light / Dark / High-contrast
- Seed: show, copy, enter new, randomise
- Language: English (structure i18n strings in one file so Hindi can be added later)

---

## 10. Visual realism specification

The instruments must look like real, well-made lab instruments, not flat diagrams.

### 10.1 Vernier callipers
- **Material:** brushed stainless steel. Use a linear gradient with 6–8 stops (light-grey highlights, mid-grey, subtle blue-grey shadows) plus an SVG `feTurbulence` noise filter at very low opacity, stretched horizontally for a brushed look.
- **Engraving:** scale marks and numbers in near-black (`#1a1a1a`) with a 0.3 px lighter offset "highlight" below each mark, so they look cut into the metal.
- **Bevels:** the vernier slider has a bevelled edge where it meets the main scale (thin highlight line plus thin shadow line). The vernier scale edge must be **sharp and exactly aligned** with the main scale edge (marks touch the boundary).
- **Jaws:** realistic shapes. Outer jaws are long, tapering to a knife edge. Inner jaws are short and pointed. Show a slight shadow cast by the slider onto the beam.
- **Locking screw:** knurled cylinder head with a hatched pattern.
- **Thumb grip:** ridged/knurled pattern.
- **Text:** engraved on the beam in small text: **"Riz Lab"** followed by the least count (for example "Riz Lab  0.1 mm"). Engrave **"Riz Lab"** on the screw gauge frame too. No other names or brands anywhere.
- **Shadows:** one soft drop shadow under the whole instrument onto the "lab bench" background.
- **Background:** subtle lab-bench surface (dark slate or wooden texture via gradient and noise). Keep it low-contrast so the instrument stands out.

### 10.2 Screw gauge
- **Frame:** U-shaped, enamel-painted (deep blue or black). Gradient for curvature, with a specular highlight streak.
- **Anvil and spindle:** polished steel cylinders with bright specular highlights and clean flat faces.
- **Sleeve:** satin chrome cylinder with the horizontal **datum line** engraved along it. Linear scale marks above (mm) and below (half-mm) the line.
- **Thimble:** satin chrome. The bevelled front edge is visible as a thin ellipse band. Circular scale marks follow the cylinder projection in 6.2. Add a **vertical shading gradient** for roundness (bright in the middle, darker at top and bottom).
- **Ratchet:** knurled cylinder (diamond knurl pattern) with a slight end-cap shine.
- **Lock lever:** small lever on the frame with two visible states.
- **Object rendering:** copper wire with a coppery gradient and a fine specular line. A coin or sheet with a metallic edge. A glass slide that is translucent with a light blue-green edge tint.

### 10.3 Global visual rules
- All scales must be **pixel-crisp at every zoom**: vector only, `shape-rendering="geometricPrecision"` for curves, `crispEdges` for straight ticks when that looks better at 1×.
- Tick positions are computed from the model each frame (or cached per config and translated). **Never hand-place ticks.**
- **Dark theme:** the instruments stay realistic metal. Only the background and UI chrome change.
- **Reduced motion:** respect `prefers-reduced-motion` (disable auto-demo animations, use instant transitions).

---

## 11. Audio and haptics
- Synthesise with Web Audio:
  - Ratchet slip: short, high, dry click (≈ 3 ms noise burst through a band-pass at ~3 kHz)
  - Jaw contact: soft low "tock"
  - Lock toggle: small mechanical click
  - Correct answer: gentle two-note chime. Wrong answer: soft low blip.
- Audio starts only after the first user interaction (autoplay policy). Global mute toggle.
- Haptics: `navigator.vibrate(5)` on ratchet clicks and contact, where supported, with a toggle.

---

## 12. Accessibility
- Everything is operable by keyboard. Visible focus rings.
- The instrument canvas group is focusable, with `role="slider"`, `aria-valuemin/max/now`, and `aria-valuetext` that reads out the current reading (in Explore mode) or the gap description (in Practice mode, without giving away the answer).
- The readout uses an `aria-live="polite"` region, throttled to avoid spam.
- Colour is never the only signal for coincidence highlights. Also use thickness and a marker.
- Contrast: UI text meets WCAG AA. High-contrast theme meets AAA for text.
- Touch targets ≥ 44 × 44 px.

---

## 13. Performance
- Target **60 fps** while dragging on a mid-range Android phone (for example a 2022 Snapdragon 6-series).
- Techniques:
  - Pre-build static SVG (main scale ticks, beam, frame) once per config. On drag, only update `transform` attributes of moving groups.
  - The thimble's circular scale is the exception (it re-projects each frame). Only render the visible ±90° of ticks, reuse DOM nodes in a pool, and update attributes in a single rAF callback.
  - Use `will-change: transform` on moving groups. Avoid layout thrash; batch DOM reads before writes.
  - The magnifier uses `<use href="#…">` with a scale transform, not a second full render.
- **Projector target:** smooth 60 fps on an ordinary school/home laptop (integrated graphics) driving a 1920×1080 or 1280×720 external display over HDMI.
- Lighthouse (run locally against `npm run preview`, desktop profile): Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95.

---

## 14. Testing requirements

### 14.1 Unit tests: Vernier
| # | Config | Input | Expected |
|---|---|---|---|
| V1 | 10/9, LC 0.1 | gap 23.47 mm, e = 0 | MSR 23 mm, VSR 5, observed 23.5 mm |
| V2 | 10/9 | gap 23.96 mm | MSR 24 mm, VSR 0, observed 24.0 mm (k = N rollover) |
| V3 | 10/9 | gap 0, e = +0.30 mm | ZE = +0.3 mm (n = 3) |
| V4 | 10/9 | gap 0, e = −0.30 mm | ZE = −0.3 mm (n = 7, −(10−7)×0.1) |
| V5 | 10/9 | e = +0.3, gap 41.3 | observed 41.6, corrected 41.3 |
| V6 | 10/9 | e = −0.3, gap 41.9 | observed 41.6, corrected 41.9 |
| V7 | 20/19, LC 0.05 | gap 12.37 mm | VSR 7, observed 12.35 mm |
| V8 | 50/49, LC 0.02 | gap 7.531 mm | VSR 27, observed 7.54 mm |
| V9 | Spread 20/39 | gap 12.37 mm | Same reading as V7 (spread scale, same LC) |
| V10 | any | gap at exact half-LC boundary | Deterministic tie-break (round half up); documented |

### 14.2 Unit tests: Vernier geometry
- G1: For each config, the distance from vernier mark 0 to mark N equals `(γN − 1) × MSD` exactly (within EPS).
- G2: The misalignment of the chosen coinciding line is ≤ LC/2 for all x in [0, 150] (property test, 10,000 samples).
- G3: The search-based coincidence and the formula-based coincidence agree for γ = 1 (property test).

### 14.3 Unit tests: Screw gauge
| # | Config | Input | Expected |
|---|---|---|---|
| S1 | 0.5/50 | s = 2.734 mm | PSR 2.5 mm, CSR 23, observed 2.73 mm |
| S2 | 0.5/50 | s = 2.996 mm | PSR 3.0 mm, CSR 0, observed 3.00 mm (rollover) |
| S3 | 0.5/50 | s = 0, e = +0.04 | ZE +0.04 mm; circular zero is BELOW the datum line (check the sign of the rendered y-offset of division 0) |
| S4 | 0.5/50 | s = 0, e = −0.04 | ZE −0.04 mm; datum reads 46; circular zero is ABOVE the datum line |
| S5 | 1.0/100 | s = 5.678 mm | PSR 5 mm, CSR 68, observed 5.68 mm |
| S6 | 0.5/100, LC 0.005 | s = 1.2345 mm | PSR 1.0, CSR 47, observed 1.235 mm |
| S7 | 0.5/50 | s = 0.5 mm exactly | PSR 0.5, CSR 0 (half-mm mark case) |
| S8 | direction | increasing s | the datum-line reading increases AND the circular scale's visible marks move DOWNWARD on screen |

### 14.4 Unit tests: Mechanics
- M1: Ratchet at contact: further ratchet rotation leaves the gap unchanged and emits slip events every 18°.
- M2: Thimble over-tighten: extra rotation reduces the reading monotonically, capped at `maxCompression`.
- M3: Backlash: reversing direction produces a dead zone of exactly `b` degrees; continuing in the same direction produces none.
- M4: The lock prevents any change in gap.

### 14.5 Unit tests: Error analysis and sig figs
- E1: Readings `[2.73, 2.74, 2.72, 2.73, 2.75]` mm, LC 0.01 → mean 2.734, |Δaᵢ| = [0.004, 0.006, 0.014, 0.004, 0.016], Δā = 0.0088, relative 0.003219, percentage ≈ 0.32 %. Reported: **(2.73 ± 0.01) mm** (Δā < LC, so LC is used).
- E2: Readings `[2.10, 2.13, 2.08, 2.16, 2.12]` cm → mean 2.118, Δā = 0.0216, reported (2.12 ± 0.02) cm.
- E3: Sphere, d = (2.12 ± 0.02) cm → ΔV/V = 3 × 0.02/2.12 ≈ 2.83 %.
- E4: Wire area, d = (0.52 ± 0.01) mm → ΔA/A = 2 × 0.01/0.52 ≈ 3.85 %.
- E5: Formatting never outputs float artefacts. A property test formats 10,000 random readings and asserts the string has the exact expected number of decimals.
- E6: `countSigFigs("0.0500") = 3`, `countSigFigs("2.30") = 3`, `countSigFigs("100") = 1` (document the ambiguity).

### 14.6 Practice-mode mistake detection tests
For each listed mistake in 8.2, construct the student's wrong answer and assert that the correct hint category is returned.

### 14.7 Visual verification (manual checkpoint, with screenshots)
At each milestone, produce screenshots at 1280×720, 1920×1080 (projector sizes) and 375 px wide (phone, secondary) of:
- Vernier closed with no ZE, +ZE, −ZE (magnified)
- Vernier measuring a bob, magnified at the coincidence
- Screw gauge closed with +ZE and −ZE (magnified at the datum line)
- Screw gauge measuring a wire, with the half-mm mark visible

Include in the report a sentence for each screenshot stating what the correct reading is and confirming that the image matches it.

---

## 15. Build and run locally (no hosting)
- `npm run dev` for local development, `npm run test` for unit tests, `npm run build` for the static output in `/dist`, `npm run preview` to serve the build locally.
- Add **one-click start scripts** in the project root so the presenter doesn't need to type commands on the day:
  - `start-lab.bat` (Windows) and `start-lab.sh` (macOS/Linux): build if `/dist` is missing, start `vite preview` on a fixed port (for example 4173), and open the default browser at `http://localhost:4173`.
- The built `/dist` must also work when served by any simple local static server (relative paths, no absolute URLs).
- **Do not** add any hosting/deploy config (no Vercel, Netlify, GitHub Pages workflows), no service worker, no web manifest, no Open Graph tags. A favicon (a tiny calliper icon you draw) is fine.
- README sections:
  - Install Node.js and run `npm install` once (while online)
  - Start the lab (double-click the start script, or the npm commands)
  - **Projector checklist:** connect HDMI → choose Duplicate (mirror) or Extend → open the app in the browser on the projector screen → press `F11` for browser fullscreen → press `P` for Presentation mode → test that text is readable from the back of the room
  - Troubleshooting: port already in use, browser not opening, display scaling looks wrong on the projector (check OS display scale at 100–125 %)

---

## 16. Milestones (STOP at each checkpoint)

1. **M1 — Core logic.** Implement `core/` modules (rng, units, sigfig, vernier, screw, mechanics, errors, objects) with all tests in Section 14.1–14.6.
   **Checkpoint:** show the test output (all passing) and the contents of `DECISIONS.md`.
2. **M2 — Vernier rendering.** Static and interactive vernier with drag, keyboard, lock, magnifier, zero error, and objects. Explore mode only.
   **Checkpoint:** screenshots from 14.7 (vernier set) plus a short screen recording or GIF of dragging.
3. **M3 — Screw gauge rendering.** Thimble projection, linear scale clipping, ratchet, backlash, lock, objects, magnifier. Explore mode only.
   **Checkpoint:** screenshots from 14.7 (screw set), plus confirmation that test S8's direction convention is visible on screen.
4. **M4 — Modes.** Practice (with mistake detection), Experiment (tables, error analysis, propagation, export), Guided LC/pitch activities.
   **Checkpoint:** walk through one full Experiment for each instrument and attach the printed A4 output.
5. **M5 — Presentation mode, landing page, notes page, theming, audio, haptics, accessibility.**
   **Checkpoint:** Lighthouse scores, a keyboard-only run-through report, and screenshots of Presentation mode at 1280×720 and 1920×1080.
6. **M6 — Polish, performance, offline check, start scripts, README.**
   **Checkpoint:** production build size report, proof that the app runs with Wi-Fi turned off (no network requests in DevTools), the start scripts working, and the final README.

---

## 17. Physics notes page (`notes.html`)
Write clear, student-friendly notes (NCERT-aligned) with small inline SVG diagrams:
- Need for precise instruments (metre scale vs. vernier vs. screw gauge)
- Vernier: principle, LC derivation, how to read, zero error (+/− with diagrams), corrected reading, worked examples
- Screw gauge: principle (screw motion), pitch, LC, how to read (including the half-mm mark), zero error (+/−), backlash, the ratchet, worked examples
- Errors: systematic vs. random, least count error, absolute / mean absolute / relative / percentage error, rules for reporting, propagation (sum, product, power)
- Precautions list for both instruments
- A "Common exam traps" box: sign of zero error, adding instead of subtracting, forgetting the half-mm mark, unit slips, reporting more decimals than the LC allows

---

## 18. Definition of done
- [ ] All unit and property tests pass. Coverage of `src/core/` ≥ 95 %.
- [ ] Every reading shown anywhere in the UI comes from `core/` functions.
- [ ] Zero-error sign conventions match NCERT in logic, rendering, explanations, notes, and exports.
- [ ] The vernier N divisions span exactly (γN − 1) MSD at every zoom level (verified visually and by test).
- [ ] The screw gauge circular scale direction matches 6.2, so "zero below the datum line" means positive ZE.
- [ ] Still usable on a 360 px-wide phone (secondary priority).
- [ ] Works fully with keyboard only.
- [ ] Practice mode detects all six listed mistake types.
- [ ] Experiment mode exports a correct CSV and a clean A4 print page.
- [ ] Presentation mode is readable on a projector (≥ 24 px text, high contrast).
- [ ] Runs fully offline from the laptop: zero network requests at runtime.
- [ ] Looks correct and readable on a projector at 1280×720 and 1920×1080 over HDMI.
- [ ] One-click start scripts work on Windows and macOS/Linux.
- [ ] Lighthouse (local, desktop) scores: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95.
- [ ] The only branding anywhere is "Riz Lab".
- [ ] README explains install, run locally, test, and the projector checklist.

---

## 19. Do NOT
- ❌ Snap the jaw/spindle position to multiples of the LC.
- ❌ Hand-place or hard-code tick positions or LC values.
- ❌ Use raster images of scales (blurry when zoomed) or photos of real instruments.
- ❌ Put physics logic inside rendering or UI code.
- ❌ Use `Math.random()` in `core/`.
- ❌ Show more decimals than the LC justifies in final results.
- ❌ Add the zero error to the observed reading. (Corrected = Observed − ZE.)
- ❌ Use real brand names or logos on the instruments.
- ❌ Add tracking, analytics, ads, or cookies.
- ❌ Use any framework (React/Vue/etc.) or a heavy 3D library. This is SVG-first by design.

---

## 20. Branding and hosting (fixed, nothing to fill)
- **Branding:** the only name that appears anywhere (instruments, landing page, footer, print header, page titles) is **"Riz Lab"**. No personal name, class, school, website, or links.
- **Hosting:** none. The app runs locally on the laptop and is shown on a projector or TV over HDMI.
