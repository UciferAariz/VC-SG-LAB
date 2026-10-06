/**
 * Shared SVG <defs>: metal gradients, brushed-steel noise, knurl patterns,
 * drop shadows. All lengths are in mm (the scene's user unit).
 */
import { svg } from './svgUtils';

export const MAT = {
  steelBeam: 'url(#mat-steel-beam)',
  steelSlider: 'url(#mat-steel-slider)',
  steelJaw: 'url(#mat-steel-jaw)',
  steelDark: 'url(#mat-steel-dark)',
  rod: 'url(#mat-rod)',
  knurl: 'url(#mat-knurl)',
  ridges: 'url(#mat-ridges)',
  brushed: 'url(#flt-brushed)',
  shadow: 'url(#flt-shadow)',
  contactShadow: 'url(#flt-contact)',
  bob: 'url(#mat-bob)',
  brass: 'url(#mat-brass)',
  brassV: 'url(#mat-brass-v)',
  wood: 'url(#mat-wood)',
  glass: 'url(#mat-glass)',
  aluminium: 'url(#mat-aluminium)',
  copper: 'url(#mat-copper)',
  enamel: 'url(#mat-enamel)',
  chromeV: 'url(#mat-chrome-v)',
  chromeH: 'url(#mat-chrome-h)',
  thimble: 'url(#mat-thimble)',
  diamondKnurl: 'url(#mat-diamond-knurl)',
  marble: 'url(#mat-marble)',
  cellV: 'url(#mat-cell-v)',
  cellH: 'url(#mat-cell-h)',
  cardboard: 'url(#mat-cardboard)',
} as const;

type Stop = [offset: number, color: string, opacity?: number];

function linear(id: string, stops: Stop[], vertical = true, extra: Record<string, string> = {}): SVGLinearGradientElement {
  return svg(
    'linearGradient',
    { id, x1: 0, y1: 0, x2: vertical ? 0 : 1, y2: vertical ? 1 : 0, ...extra },
    stops.map(([o, c, op]) => svg('stop', { offset: o, 'stop-color': c, 'stop-opacity': op ?? 1 })),
  );
}

/**
 * Brushed finish for MOVING parts: a fixed pattern of fine horizontal lines
 * (deterministic), far cheaper to repaint than a turbulence filter.
 */
function brushLines(): SVGPatternElement {
  let d = '';
  let x = 0.37;
  for (let i = 0; i < 46; i++) {
    x = (x * 9301 + 0.4927) % 1; // simple deterministic sequence
    const y = (i * 0.26 + x * 0.2).toFixed(3);
    const len = (6 + x * 30).toFixed(2);
    const start = ((x * 977) % 40).toFixed(2);
    d += `M${start} ${y}h${len}`;
  }
  return svg('pattern', { id: 'mat-brush-lines', width: 40, height: 12, patternUnits: 'userSpaceOnUse' }, [
    svg('path', { d, stroke: '#6b7580', 'stroke-width': 0.05, opacity: 0.55 }),
    svg('path', { d, stroke: '#ffffff', 'stroke-width': 0.04, opacity: 0.5, transform: 'translate(13 0.11)' }),
  ]);
}

/** Build the <defs> block used by every instrument scene. */
export function buildDefs(): SVGDefsElement {
  const defs = svg('defs');

  // Brushed stainless steel: 8 stops, light highlights, mid grey, blue-grey shadows.
  defs.append(
    linear('mat-steel-beam', [
      [0, '#eef1f4'],
      [0.08, '#c9ced4'],
      [0.22, '#dfe3e7'],
      [0.45, '#b9bfc6'],
      [0.62, '#cfd4d9'],
      [0.8, '#a7afb8'],
      [0.93, '#8e98a3'],
      [1, '#6f7a86'],
    ]),
    linear('mat-steel-slider', [
      [0, '#f4f6f8'],
      [0.1, '#d4d9de'],
      [0.3, '#e6e9ec'],
      [0.55, '#c3c9cf'],
      [0.75, '#d6dadf'],
      [0.9, '#a3abb4'],
      [1, '#7d8792'],
    ]),
    linear(
      'mat-steel-jaw',
      [
        [0, '#8d96a0'],
        [0.18, '#c6ccd2'],
        [0.4, '#e9ecef'],
        [0.6, '#cdd2d7'],
        [0.85, '#a1a9b2'],
        [1, '#7a838d'],
      ],
      false,
    ),
    linear('mat-steel-dark', [
      [0, '#9aa3ad'],
      [0.5, '#6c7681'],
      [1, '#4a535d'],
    ]),
    linear('mat-rod', [
      [0, '#fafbfc'],
      [0.35, '#c4cad0'],
      [0.7, '#8a939d'],
      [1, '#5b646e'],
    ]),
    // Objects
    linear('mat-brass', [
      [0, '#fff1b8'],
      [0.25, '#e8c25a'],
      [0.6, '#b8862a'],
      [1, '#6d4a12'],
    ]),
    linear(
      'mat-brass-v',
      [
        [0, '#6d4a12'],
        [0.2, '#b8862a'],
        [0.45, '#f6dc86'],
        [0.7, '#c99a36'],
        [1, '#6d4a12'],
      ],
      false,
    ),
    linear('mat-wood', [
      [0, '#c58b52'],
      [0.5, '#a86d3a'],
      [1, '#7c4c24'],
    ]),
    linear('mat-glass', [
      [0, '#d9f2ef', 0.55],
      [0.5, '#bfe6e1', 0.35],
      [1, '#9fd3cc', 0.55],
    ]),
    linear(
      'mat-aluminium',
      [
        [0, '#7f8890'],
        [0.15, '#c8ced3'],
        [0.5, '#eef0f2'],
        [0.85, '#b9c0c6'],
        [1, '#757e86'],
      ],
      false,
    ),
    linear('mat-copper', [
      [0, '#5a2a10'],
      [0.25, '#b8642e'],
      [0.45, '#ffd2a8'],
      [0.6, '#d07a3e'],
      [1, '#4d220c'],
    ]),
    linear('mat-enamel', [
      [0, '#3d5a9e'],
      [0.18, '#7f9be0'],
      [0.32, '#2b4687'],
      [0.75, '#1a2d5e'],
      [1, '#0d1838'],
    ]),
    linear('mat-chrome-v', [
      [0, '#6e7781'],
      [0.2, '#c9cfd5'],
      [0.45, '#f7f9fa'],
      [0.6, '#dfe3e7'],
      [0.85, '#9aa2ab'],
      [1, '#5d6670'],
    ]),
    linear(
      'mat-chrome-h',
      [
        [0, '#5d6670'],
        [0.3, '#d5dade'],
        [0.5, '#f7f9fa'],
        [0.7, '#cfd4d9'],
        [1, '#5d6670'],
      ],
      false,
    ),
    linear('mat-thimble', [
      [0, '#4f5862'],
      [0.12, '#9ea6af'],
      [0.35, '#e3e7ea'],
      [0.5, '#f6f8f9'],
      [0.65, '#e3e7ea'],
      [0.88, '#9ea6af'],
      [1, '#4f5862'],
    ]),
  );

  // Screw-gauge objects.
  defs.append(
    linear('mat-copper-h', [[0, '#5a2a10'], [0.28, '#c0703a'], [0.42, '#ffd9b5'], [0.58, '#d5814a'], [1, '#4d220c']], false),
    linear('mat-coin-edge', [[0, '#6f7780'], [0.45, '#eef1f3'], [1, '#7d868f']], false),
    linear('mat-slide', [[0, '#7fc8bd', 0.9], [0.5, '#d8f3ef', 0.55], [1, '#7fc8bd', 0.9]], false),
    linear('mat-paper', [[0, '#d9d4c7'], [0.5, '#fbf8f0'], [1, '#d9d4c7']], false),
    svg('radialGradient', { id: 'mat-ball', cx: 0.38, cy: 0.34, r: 0.72, fx: 0.32, fy: 0.28 }, [
      svg('stop', { offset: 0, 'stop-color': '#ffffff' }),
      svg('stop', { offset: 0.2, 'stop-color': '#dfe4e8' }),
      svg('stop', { offset: 0.6, 'stop-color': '#8d969f' }),
      svg('stop', { offset: 0.9, 'stop-color': '#4a525b' }),
      svg('stop', { offset: 1, 'stop-color': '#2f363d' }),
    ]),
  );

  // Everyday objects (vernier and screw gauge).
  defs.append(
    svg('radialGradient', { id: 'mat-marble', cx: 0.4, cy: 0.36, r: 0.7, fx: 0.3, fy: 0.26 }, [
      svg('stop', { offset: 0, 'stop-color': '#ffffff', 'stop-opacity': 0.95 }),
      svg('stop', { offset: 0.22, 'stop-color': '#d6f1f6', 'stop-opacity': 0.75 }),
      svg('stop', { offset: 0.7, 'stop-color': '#7cc3d2', 'stop-opacity': 0.7 }),
      svg('stop', { offset: 1, 'stop-color': '#2f6f80', 'stop-opacity': 0.95 }),
    ]),
    linear('mat-cell-v', [[0, '#0f3d22'], [0.22, '#2f8a52'], [0.45, '#7fd39c'], [0.7, '#2f8a52'], [1, '#0d331c']], false),
    linear('mat-cell-h', [[0, '#0d331c'], [0.25, '#2f8a52'], [0.45, '#7fd39c'], [0.7, '#2f8a52'], [1, '#0f3d22']]),
    linear('mat-cardboard', [[0, '#f3d27a'], [0.6, '#e7bd52'], [1, '#c9972f']]),
    linear('mat-graphite', [[0, '#1d2024'], [0.35, '#5b6168'], [0.5, '#9aa1a8'], [0.65, '#4b5157'], [1, '#17191c']], false),
    linear('mat-hair', [[0, '#120b06'], [0.4, '#4a3020'], [0.55, '#7a5638'], [1, '#160d07']], false),
    linear('mat-card', [[0, '#d9dee5'], [0.5, '#fbfcfd'], [1, '#d3d9e1']], false),
  );

  // Contact shadow: radial falloff instead of a blur filter.
  defs.append(
    svg('radialGradient', { id: 'mat-contact' }, [
      svg('stop', { offset: 0, 'stop-color': '#000', 'stop-opacity': 0.6 }),
      svg('stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': 0 }),
    ]),
  );

  // Pendulum bob: radial gradient for a polished sphere.
  defs.append(
    svg('radialGradient', { id: 'mat-bob', cx: 0.36, cy: 0.32, r: 0.75, fx: 0.32, fy: 0.28 }, [
      svg('stop', { offset: 0, 'stop-color': '#fffbe6' }),
      svg('stop', { offset: 0.18, 'stop-color': '#f2d27a' }),
      svg('stop', { offset: 0.55, 'stop-color': '#b98a2c' }),
      svg('stop', { offset: 0.85, 'stop-color': '#6b4a14' }),
      svg('stop', { offset: 1, 'stop-color': '#3d2a0a' }),
    ]),
  );

  // Brushed-metal noise: turbulence stretched horizontally, very low opacity.
  defs.append(
    svg('filter', { id: 'flt-brushed', x: 0, y: 0, width: 1, height: 1, 'color-interpolation-filters': 'sRGB' }, [
      svg('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.015 1.6', numOctaves: 2, seed: 7, result: 'noise' }),
      svg('feColorMatrix', { in: 'noise', type: 'matrix', values: '0 0 0 0 0.5  0 0 0 0 0.52  0 0 0 0 0.55  0 0 0 0.55 -0.1', result: 'tint' }),
      svg('feComposite', { in: 'tint', in2: 'SourceGraphic', operator: 'in', result: 'clipped' }),
      svg('feBlend', { in: 'clipped', in2: 'SourceGraphic', mode: 'multiply' }),
    ]),
  );

  // Soft drop shadow under the whole instrument onto the bench.
  defs.append(
    svg('filter', { id: 'flt-shadow', x: -0.1, y: -0.2, width: 1.2, height: 1.6 }, [
      svg('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: 2.2 }),
      svg('feOffset', { dx: 1.6, dy: 3.2, result: 'b' }),
      svg('feComponentTransfer', {}, [svg('feFuncA', { type: 'linear', slope: 0.45 })]),
      svg('feMerge', {}, [svg('feMergeNode'), svg('feMergeNode', { in: 'SourceGraphic' })]),
    ]),
    svg('filter', { id: 'flt-contact', x: -0.5, y: -0.5, width: 2, height: 2 }, [svg('feGaussianBlur', { stdDeviation: 0.6 })]),
  );

  // Knurled locking-screw head: crossed hatch.
  defs.append(
    svg('pattern', { id: 'mat-knurl', width: 0.9, height: 0.9, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(35)' }, [
      svg('rect', { width: 0.9, height: 0.9, fill: '#b7bec5' }),
      svg('path', { d: 'M0 0.45H0.9M0.45 0V0.9', stroke: '#59626c', 'stroke-width': 0.22 }),
    ]),
    // Thumb grip: vertical ridges.
    svg('pattern', { id: 'mat-ridges', width: 0.8, height: 4, patternUnits: 'userSpaceOnUse' }, [
      svg('rect', { width: 0.8, height: 4, fill: '#c3c9cf' }),
      svg('rect', { width: 0.3, height: 4, fill: '#6a737d' }),
      svg('rect', { x: 0.3, width: 0.12, height: 4, fill: '#eef1f3' }),
    ]),
    brushLines(),
    // Section hatching for cut-away objects.
    svg('pattern', { id: 'mat-section', width: 1.2, height: 1.2, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, [
      svg('path', { d: 'M0 0V1.2', stroke: '#3f8f86', 'stroke-width': 0.18 }),
    ]),
    // Ratchet: diamond knurl.
    svg('pattern', { id: 'mat-diamond-knurl', width: 1.1, height: 1.1, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, [
      svg('rect', { width: 1.1, height: 1.1, fill: '#c9ced3' }),
      svg('path', { d: 'M0 0H1.1M0 0V1.1', stroke: '#4e5761', 'stroke-width': 0.28 }),
    ]),
  );

  return defs;
}
