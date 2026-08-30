// Hand-drawn chess piece silhouettes (original work), replacing Unicode chess
// glyphs — those render inconsistently across fonts/platforms (see
// docs/game/ux-guidelines.md's "Piece rendering" section) and were reported
// as looking crude. Each entry is the inner markup for a 0-100 x 0-100
// viewBox <svg>, sharing a common base/collar for a consistent piece family.
//
// Plain classic script — see the note in chess-engine.js for why this isn't
// an ES module.

const BASE = '<rect x="25" y="88" width="50" height="10" rx="3"/>';
const COLLAR = '<rect x="33" y="79" width="34" height="9"/>';

const PIECE_SVG_MARKUP = {
  K: `<rect x="47" y="7" width="6" height="15"/><rect x="41" y="12" width="18" height="6"/><path d="M 33 40 C 33 28 40 24 50 24 C 60 24 67 28 67 40 Z"/><path d="M 33 40 L 67 40 L 67 79 L 33 79 Z"/>${COLLAR}${BASE}`,
  Q: `<circle cx="36" cy="22" r="3.2"/><circle cx="50" cy="18" r="3.6"/><circle cx="64" cy="22" r="3.2"/><path d="M 32 42 L 36 24 L 43 34 L 50 20 L 57 34 L 64 24 L 68 42 Z"/><path d="M 32 42 L 68 42 L 67 79 L 33 79 Z"/>${COLLAR}${BASE}`,
  R: `<path d="M 33 41 L 33 22 L 40 22 L 40 28 L 47 28 L 47 22 L 53 22 L 53 28 L 60 28 L 60 22 L 67 22 L 67 41 Z"/><rect x="33" y="41" width="34" height="38"/>${COLLAR}${BASE}`,
  B: `<circle cx="50" cy="10" r="4"/><path d="M 50 17 C 40 21 36 32 38 42 L 62 42 C 64 32 60 21 50 17 Z"/><path d="M 33 42 L 67 42 L 67 79 L 33 79 Z"/><line x1="43" y1="26" x2="53" y2="34" stroke-width="3" stroke-linecap="round"/>${COLLAR}${BASE}`,
  N: `<path d="M 40 79 L 40 52 L 62 52 L 62 79 Z"/><path d="M 62 52 C 65 35 58 20 46 18 L 20 28 L 12 34 L 19 38 L 15 43 C 22 48 30 50 40 52 Z"/><polygon points="45,18 53,7 56,20"/>${COLLAR}${BASE}`,
  P: `<circle cx="50" cy="30" r="11"/><path d="M 41 41 L 59 41 L 67 79 L 33 79 Z"/>${COLLAR}${BASE}`,
};

globalThis.PIECE_SVG_MARKUP = PIECE_SVG_MARKUP;
