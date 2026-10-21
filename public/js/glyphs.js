const svg = (body) =>
  `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${body}</svg>`;

// Pip glyphs replace each pip individually, so the face count stays readable.
export const PIP_GLYPHS = {
  pie: svg(
    '<path d="M12 3a9 9 0 1 0 9 9h-9z"/>' +
    '<path d="M14 1.5a8.5 8.5 0 0 1 8.5 8.5H14z" opacity=".65"/>',
  ),
};

// Face glyphs replace all pips of a face with a single symbol.
export const FACE_GLYPHS = {
  cross: svg('<path d="M10 2h4v6h6v4h-6v10h-4V12H4V8h6z"/>'),
  'cross-halo': svg(
    '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
    '<path d="M10.5 4h3v5h5v3h-5v8h-3v-8h-5V9h5z"/>',
  ),
  trinity: svg(
    '<path d="M12 2 22 20H2zm0 5.2L6.8 17h10.4z" fill-rule="evenodd"/>' +
    '<circle cx="12" cy="13.5" r="2.2"/>',
  ),
  sigil: svg(
    '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
    '<path d="M12 3.5 17 20 3.8 9.5h16.4L7 20z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
  ),
  crown: svg('<path d="M2 7l5 4 5-7 5 7 5-4-2 12H4zM4 20h16v2H4z"/>'),
  devil: svg(
    '<path d="M3 2c0 4 1.5 6 4 7.2C6.4 10.3 6 11.6 6 13c0 4.4 2.7 9 6 9s6-4.6 6-9c0-1.4-.4-2.7-1-3.8C19.5 8 21 6 21 2c-1.5 2.4-3.6 3.8-6 4.2A6.6 6.6 0 0 0 12 5.5c-1 0-2.1.3-3 .7C6.6 5.8 4.5 4.4 3 2z"/>' +
    '<path d="M8.5 12.5l2.5 1-2.3 1.2zM15.5 12.5l-2.5 1 2.3 1.2zM9.5 18c1.5 1 3.5 1 5 0" fill="none" stroke="var(--glyph-cut, #c22)" stroke-width="1.2" stroke-linecap="round"/>',
  ),
  portrait: svg(
    '<circle cx="12" cy="8" r="4.5"/>' +
    '<path d="M3.5 22c0-5 3.8-8 8.5-8s8.5 3 8.5 8z"/>' +
    '<path d="M7.5 6.5c1-3 8-3 9 0" fill="none" stroke="currentColor" stroke-width="2"/>',
  ),
  tooth: svg(
    '<path d="M7 2.5c-2.8 0-4.5 2.2-4.5 5 0 3 1.5 4.5 2 7.5.6 3.5 1.2 6.5 2.8 6.5 1.7 0 1.8-5.5 4.7-5.5s3 5.5 4.7 5.5c1.6 0 2.2-3 2.8-6.5.5-3 2-4.5 2-7.5 0-2.8-1.7-5-4.5-5-2 0-3 1-5 1s-3-1-5-1z"/>',
  ),
  molar: svg(
    '<path d="M5.5 3C3.5 3 2 4.6 2 7c0 2.6 1 4 1.5 6.5C4.2 17 4.5 21 6.3 21 8 21 8 16 9.5 16c.8 0 1.2 1 1.5 2.4.3 1.4.5 2.6 1 2.6s.7-1.2 1-2.6c.3-1.4.7-2.4 1.5-2.4 1.5 0 1.5 5 3.2 5 1.8 0 2.1-4 2.8-7.5C21 11 22 9.6 22 7c0-2.4-1.5-4-3.5-4-1.5 0-2.3.8-3.3.8S13.5 3 12 3s-2.2.8-3.2.8S7 3 5.5 3z"/>',
  ),
  sun: svg(
    '<circle cx="12" cy="12" r="5"/>' +
    '<path d="M12 1v4M12 19v4M1 12h4M19 12h4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M4.2 19.8 7 17M17 7l2.8-2.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  ),
  pearl: svg(
    '<circle cx="12" cy="12" r="7"/>' +
    '<circle cx="9.5" cy="9.5" r="2.2" fill="#fff" opacity=".85"/>',
  ),
};
