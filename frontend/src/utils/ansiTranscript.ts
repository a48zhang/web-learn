export type TerminalColor =
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'gray';

export interface TerminalSegment {
  text: string;
  bold?: boolean;
  color?: TerminalColor;
}

interface TerminalStyle {
  bold: boolean;
  color?: TerminalColor;
}

const ESCAPE_CHAR = '\x1b';
const VISIBLE_ESCAPE_CHAR = '\u241b';

function sameStyle(a: TerminalStyle, b: TerminalStyle): boolean {
  return a.bold === b.bold && a.color === b.color;
}

function styleToSegment(text: string, style: TerminalStyle): TerminalSegment {
  const segment: TerminalSegment = { text };
  if (style.bold) {
    segment.bold = true;
  }
  if (style.color) {
    segment.color = style.color;
  }
  return segment;
}

function mergeSegment(segments: TerminalSegment[], text: string, style: TerminalStyle): void {
  if (!text) return;

  const last = segments[segments.length - 1];
  if (last && sameStyle(segmentToStyle(last), style)) {
    last.text += text;
    return;
  }

  segments.push(styleToSegment(text, style));
}

function segmentToStyle(segment: TerminalSegment): TerminalStyle {
  return {
    bold: Boolean(segment.bold),
    color: segment.color,
  };
}

function normalizeColor(code: number): TerminalColor | undefined {
  switch (code) {
    case 30:
      return 'black';
    case 31:
      return 'red';
    case 32:
      return 'green';
    case 33:
      return 'yellow';
    case 34:
      return 'blue';
    case 35:
      return 'magenta';
    case 36:
      return 'cyan';
    case 37:
    case 90:
    case 97:
      return 'gray';
    case 91:
      return 'red';
    case 92:
      return 'green';
    case 93:
      return 'yellow';
    case 94:
      return 'blue';
    case 95:
      return 'magenta';
    case 96:
      return 'cyan';
    default:
      return undefined;
  }
}

function parseSgr(params: string, style: TerminalStyle): TerminalStyle {
  const nextStyle: TerminalStyle = { ...style };
  const rawCodes = params.length === 0 ? ['0'] : params.split(';');

  for (let index = 0; index < rawCodes.length; index += 1) {
    const rawCode = rawCodes[index];
    const code = rawCode === '' ? 0 : Number(rawCode);
    if (!Number.isFinite(code)) continue;

    if ((code === 38 || code === 48) && index + 1 < rawCodes.length) {
      const mode = Number(rawCodes[index + 1]);
      if (mode === 2) {
        index += 4;
        continue;
      }
      if (mode === 5) {
        index += 2;
        continue;
      }
    }

    if (code === 0) {
      nextStyle.bold = false;
      delete nextStyle.color;
      continue;
    }

    if (code === 1) {
      nextStyle.bold = true;
      continue;
    }

    if (code === 22) {
      nextStyle.bold = false;
      continue;
    }

    if (code === 39) {
      delete nextStyle.color;
      continue;
    }

    const color = normalizeColor(code);
    if (color) {
      nextStyle.color = color;
    }
  }

  return nextStyle;
}

function normalizeSegments(segments: TerminalSegment[]): TerminalSegment[] {
  const normalized: TerminalSegment[] = [];
  let newlineRun = 0;

  for (const segment of segments) {
    const style = segmentToStyle(segment);
    let text = '';

    for (const char of segment.text) {
      if (char === '\n') {
        newlineRun += 1;
        if (newlineRun <= 2) {
          text += char;
        }
        continue;
      }

      newlineRun = 0;
      text += char;
    }

    if (text) {
      mergeSegment(normalized, text, style);
    }
  }

  return normalized;
}

export function renderTerminalTranscript(raw: string): TerminalSegment[] {
  const segments: TerminalSegment[] = [];
  let style: TerminalStyle = { bold: false };
  let buffer = '';

  const flushBuffer = (): void => {
    if (!buffer) return;
    mergeSegment(segments, buffer, style);
    buffer = '';
  };

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];

    if (char === '\r') {
      if (raw[i + 1] === '\n') {
        i += 1;
      }
      buffer += '\n';
      continue;
    }

    if (char === '\n') {
      buffer += '\n';
      continue;
    }

    if (char === ESCAPE_CHAR || char === VISIBLE_ESCAPE_CHAR) {
      if (raw[i + 1] !== '[') {
        continue;
      }

      let end = i + 2;
      while (end < raw.length) {
        const codePoint = raw.charCodeAt(end);
        if (codePoint >= 0x40 && codePoint <= 0x7e) {
          break;
        }
        end += 1;
      }

      if (end >= raw.length) {
        break;
      }

      const command = raw[end];
      const params = raw.slice(i + 2, end);

      if (command === 'm') {
        flushBuffer();
        style = parseSgr(params, style);
      }

      i = end;
      continue;
    }

    buffer += char;
  }

  flushBuffer();
  return normalizeSegments(segments);
}

export function stripTerminalControls(raw: string): string {
  return renderTerminalTranscript(raw)
    .map((segment) => segment.text)
    .join('');
}
