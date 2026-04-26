import { renderTerminalTranscript, type TerminalSegment } from '../../utils/ansiTranscript';

type ToolState = 'running' | 'success' | 'error';

interface TerminalOutputProps {
  value: string;
  state?: ToolState;
}

const colorClassByName: Record<NonNullable<TerminalSegment['color']>, string> = {
  black: 'text-zinc-500',
  red: 'text-red-400',
  green: 'text-emerald-400',
  yellow: 'text-yellow-300',
  blue: 'text-blue-300',
  magenta: 'text-fuchsia-300',
  cyan: 'text-cyan-300',
  gray: 'text-zinc-300',
};

function segmentClassName(segment: TerminalSegment): string {
  const classes: string[] = [];

  if (segment.bold) {
    classes.push('font-semibold');
  }

  if (segment.color) {
    classes.push(colorClassByName[segment.color]);
  }

  return classes.join(' ');
}

function panelStateClassName(state: ToolState): string {
  if (state === 'error') {
    return 'border-red-900/50 text-red-400/90';
  }

  if (state === 'running') {
    return 'border-blue-900/40 text-zinc-400';
  }

  return 'border-zinc-800/40 text-zinc-400';
}

export function TerminalOutput({ value, state = 'success' }: TerminalOutputProps) {
  const segments = renderTerminalTranscript(value);

  return (
    <div
      className={`p-2.5 bg-zinc-950/40 border rounded-[6px] text-[11px] font-mono overflow-x-auto custom-scrollbar ${
        panelStateClassName(state)
      }`}
    >
      <div className="mb-1 font-sans text-[10px] uppercase tracking-wide text-zinc-500">结果</div>
      <pre className="!m-0 !p-0 !bg-transparent whitespace-pre-wrap break-words leading-relaxed">{segments.map((segment, index) => (
        <span key={index} className={segmentClassName(segment)}>
          {segment.text}
        </span>
      ))}</pre>
    </div>
  );
}
