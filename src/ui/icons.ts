/** Inline SVG icons (no icon fonts, SPEC §2). 24×24, stroke = currentColor. */

const wrap = (body: string) =>
  `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  zoomIn: wrap('<circle cx="11" cy="11" r="7"/><path d="M11 8v6M8 11h6M21 21l-4.5-4.5"/>'),
  zoomOut: wrap('<circle cx="11" cy="11" r="7"/><path d="M8 11h6M21 21l-4.5-4.5"/>'),
  reset: wrap('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
  fit: wrap('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  focus: wrap('<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>'),
  lock: wrap('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  unlock: wrap('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>'),
  loupe: wrap('<circle cx="10" cy="10" r="6"/><path d="M14.5 14.5 21 21"/><path d="M8 10h4M10 8v4"/>'),
  pin: wrap('<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v8"/>'),
  left: wrap('<path d="M15 5l-7 7 7 7"/>'),
  right: wrap('<path d="M9 5l7 7-7 7"/>'),
  info: wrap('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  rotate: wrap('<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>'),
  copy: wrap('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
  dice: wrap('<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/>'),
  fine: wrap('<path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/>'),
  close: wrap('<path d="M7 12h10M10 8l-4 4 4 4M14 8l4 4-4 4"/>'),
  open: wrap('<path d="M3 12h7M14 12h7M7 8l-4 4 4 4M17 8l4 4-4 4"/>'),
  up: wrap('<path d="M5 15l7-7 7 7"/>'),
  down: wrap('<path d="M5 9l7 7 7-7"/>'),
  ratchet: wrap('<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M6 8l12 4M6 12l12 4M6 16l12-8"/>'),
  along: wrap('<path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4"/>'),
  next: wrap('<path d="M9 5l7 7-7 7"/>'),
  prev: wrap('<path d="M15 5l-7 7 7 7"/>'),
  play: wrap('<path d="M7 4l13 8-13 8z"/>'),
  fullscreen: wrap('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  present: wrap('<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M12 16v4M8 20h8"/>'),
  check: wrap('<path d="M5 12l5 5 9-10"/>'),
  print: wrap('<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>'),
  download: wrap('<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>'),
  record: wrap('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3" fill="currentColor"/>'),
  trash: wrap('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
};
