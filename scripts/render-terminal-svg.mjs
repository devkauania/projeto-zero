// render-terminal-svg.mjs — turn captured terminal output (with ANSI SGR
// colour codes) into a static SVG "screenshot". Pure function, no
// dependencies. Used by scripts/record-demo.mjs; it renders only the bytes
// it is given and never adds text of its own apart from the window title.
//
// Supported: SGR 0/1/2/7/22/27/39/49, 30-37, 90-97, 40-47, 100-107.
// Other escape sequences (cursor show/hide, erase line, ...) are dropped.
// Long lines are wrapped at `cols`, the way a terminal of that width would.

const PALETTE = {
  fg: "#e6edf3",
  bg: "#0d1117",
  dim: "#8b949e",
  colors: [
    "#484f58", // black
    "#ff7b72", // red
    "#3fb950", // green
    "#d29922", // yellow
    "#58a6ff", // blue
    "#bc8cff", // magenta
    "#39c5cf", // cyan
    "#b1bac4", // white
  ],
  bright: [
    "#6e7681",
    "#ffa198",
    "#56d364",
    "#e3b341",
    "#79c0ff",
    "#d2a8ff",
    "#56d4dd",
    "#ffffff",
  ],
};

const ESC_RE = /\x1b\[([0-9;?]*)([A-Za-z])/g;

function defaultStyle() {
  return { fg: null, bg: null, bold: false, dim: false, inverse: false };
}

function applySgr(style, params) {
  const codes = params === "" ? [0] : params.split(";").map(Number);
  for (const c of codes) {
    if (c === 0) Object.assign(style, defaultStyle());
    else if (c === 1) style.bold = true;
    else if (c === 2) style.dim = true;
    else if (c === 7) style.inverse = true;
    else if (c === 22) { style.bold = false; style.dim = false; }
    else if (c === 27) style.inverse = false;
    else if (c === 39) style.fg = null;
    else if (c === 49) style.bg = null;
    else if (c >= 30 && c <= 37) style.fg = PALETTE.colors[c - 30];
    else if (c >= 90 && c <= 97) style.fg = PALETTE.bright[c - 90];
    else if (c >= 40 && c <= 47) style.bg = PALETTE.colors[c - 40];
    else if (c >= 100 && c <= 107) style.bg = PALETTE.bright[c - 100];
  }
}

/**
 * Split ANSI text into lines of styled cells: [{ ch, style }].
 * Carriage returns rewind to column 0 (later text overwrites earlier text).
 */
export function parseAnsi(text, cols) {
  const lines = [[]];
  let col = 0;
  const style = defaultStyle();
  let i = 0;
  const put = (ch) => {
    if (col >= cols) {
      lines.push([]);
      col = 0;
    }
    const line = lines[lines.length - 1];
    line[col] = { ch, style: { ...style } };
    col++;
  };
  while (i < text.length) {
    ESC_RE.lastIndex = i;
    const m = text[i] === "\x1b" ? ESC_RE.exec(text) : null;
    if (m && m.index === i) {
      if (m[2] === "m") applySgr(style, m[1]);
      i = ESC_RE.lastIndex;
      continue;
    }
    const cp = text.codePointAt(i);
    const ch = String.fromCodePoint(cp);
    i += ch.length;
    if (ch === "\n") {
      lines.push([]);
      col = 0;
    } else if (ch === "\r") {
      col = 0;
    } else if (ch === "\t") {
      do put(" "); while (col % 8 !== 0);
    } else if (cp >= 0x20) {
      put(ch);
    }
  }
  while (lines.length > 0 && lines[lines.length - 1].length === 0) lines.pop();
  return lines.map((l) => Array.from(l, (c) => c ?? { ch: " ", style: defaultStyle() }));
}

/** Strip every escape sequence: the plain-text view of the same capture. */
export function stripAnsi(text) {
  return text.replace(ESC_RE, "").replace(/\r(?!\n)/g, "");
}

function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sameStyle(a, b) {
  return (
    a.fg === b.fg && a.bg === b.bg && a.bold === b.bold &&
    a.dim === b.dim && a.inverse === b.inverse
  );
}

/**
 * Render ANSI text to an SVG string.
 * @param {string} text   captured output, ANSI codes allowed
 * @param {{cols?: number, title?: string, fontSize?: number}} [opts]
 */
export function renderTerminalSvg(text, opts = {}) {
  const cols = opts.cols ?? 100;
  const fontSize = opts.fontSize ?? 14;
  const charW = fontSize * 0.6;
  const lineH = Math.round(fontSize * 1.45);
  const padX = 20;
  const top = 44;
  const lines = parseAnsi(text, cols);
  const width = Math.ceil(padX * 2 + cols * charW);
  const height = top + lines.length * lineH + 20;

  const bgRects = [];
  const textRows = [];
  lines.forEach((cells, row) => {
    const baseline = top + row * lineH + Math.round(fontSize * 1.0);
    const spans = [];
    let start = 0;
    while (start < cells.length) {
      let end = start + 1;
      while (end < cells.length && sameStyle(cells[end].style, cells[start].style)) end++;
      const st = cells[start].style;
      const chars = cells.slice(start, end).map((c) => c.ch).join("");
      let fg = st.fg ?? (st.dim ? PALETTE.dim : PALETTE.fg);
      let bg = st.bg;
      if (st.inverse) {
        const f = fg;
        fg = bg ?? PALETTE.bg;
        bg = f;
      }
      if (bg) {
        bgRects.push(
          `<rect x="${(padX + start * charW).toFixed(1)}" y="${top + row * lineH}" ` +
            `width="${((end - start) * charW).toFixed(1)}" height="${lineH}" fill="${bg}"/>`
        );
      }
      if (chars.trim() !== "") {
        // textLength pins every run to the cell grid, whatever monospace
        // font the viewer ends up with (their glyph widths differ).
        const attrs = [
          `x="${(padX + start * charW).toFixed(1)}"`,
          `textLength="${((end - start) * charW).toFixed(1)}"`,
          `lengthAdjust="spacing"`,
          `fill="${fg}"`,
        ];
        if (st.bold) attrs.push(`font-weight="bold"`);
        if (st.dim && !st.fg) attrs.push(`opacity="0.9"`);
        spans.push(`<tspan ${attrs.join(" ")}>${esc(chars)}</tspan>`);
      }
      start = end;
    }
    if (spans.length > 0) {
      textRows.push(`<text y="${baseline}">${spans.join("")}</text>`);
    }
  });

  const title = opts.title ? esc(opts.title) : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title || "terminal output"}">`,
    `<style>text{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;font-size:${fontSize}px;white-space:pre}</style>`,
    `<rect width="${width}" height="${height}" rx="10" fill="${PALETTE.bg}"/>`,
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10" fill="none" stroke="#30363d"/>`,
    `<circle cx="22" cy="20" r="6" fill="#ff5f56"/><circle cx="42" cy="20" r="6" fill="#ffbd2e"/><circle cx="62" cy="20" r="6" fill="#27c93f"/>`,
    title
      ? `<text x="${width / 2}" y="25" text-anchor="middle" fill="${PALETTE.dim}" style="font-size:12px">${title}</text>`
      : "",
    ...bgRects,
    `<g xml:space="preserve">`,
    ...textRows,
    `</g>`,
    `</svg>`,
    "",
  ].join("\n");
}
