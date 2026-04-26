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

interface StyleState {
  bold: boolean;
  color?: TerminalColor;
}

const ANSI_COLOR_BY_CODE: Record<number, TerminalColor> = {
  30: 'black',
  31: 'red',
  32: 'green',
  33: 'yellow',
  34: 'blue',
  35: 'magenta',
  36: 'cyan',
  37: 'gray',
  90: 'gray',
  91: 'red',
  92: 'green',
  93: 'yellow',
  94: 'blue',
  95: 'magenta',
  96: 'cyan',
  97: 'gray',
};

const ESC = String.fromCharCode(27);
const CSI_PATTERN = new RegExp(`(?:${ESC}|␛)\\[([0-9;?]*)([@-~])`, 'g');

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n');
}

function applySgr(paramsText: string, state: StyleState): StyleState {
  const params = paramsText === '' ? [0] : paramsText.split(';').map((part) => Number(part || '0'));
  const next: StyleState = { ...state };

  for (const param of params) {
    if (param === 0) {
      next.bold = false;
      next.color = undefined;
    } else if (param === 1) {
      next.bold = true;
    } else if (param === 22) {
      next.bold = false;
    } else if (param === 39) {
      next.color = undefined;
    } else if (ANSI_COLOR_BY_CODE[param]) {
      next.color = ANSI_COLOR_BY_CODE[param];
    }
  }

  return next;
}

function pushText(segments: TerminalSegment[], text: string, state: StyleState): void {
  if (!text) return;
  const segment: TerminalSegment = { text };
  if (state.bold) segment.bold = true;
  if (state.color) segment.color = state.color;
  const previous = segments[segments.length - 1];
  if (previous && previous.bold === segment.bold && previous.color === segment.color) {
    previous.text += text;
    return;
  }
  segments.push(segment);
}

export function renderTerminalTranscript(raw: string): TerminalSegment[] {
  const normalized = normalizeLineEndings(raw);
  const segments: TerminalSegment[] = [];
  let state: StyleState = { bold: false };
  let cursor = 0;

  for (const match of normalized.matchAll(CSI_PATTERN)) {
    const index = match.index ?? 0;
    pushText(segments, normalized.slice(cursor, index), state);

    const paramsText = match[1] ?? '';
    const finalByte = match[2];
    if (finalByte === 'm') {
      state = applySgr(paramsText, state);
    }

    cursor = index + match[0].length;
  }

  pushText(segments, normalized.slice(cursor), state);
  return segments;
}

export function stripTerminalControls(raw: string): string {
  return renderTerminalTranscript(raw).map((segment) => segment.text).join('');
}
