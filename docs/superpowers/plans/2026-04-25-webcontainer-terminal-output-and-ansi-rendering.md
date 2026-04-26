# WebContainer Terminal Output And ANSI Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route WebContainer command output into the frontend terminal panel and render ANSI-heavy tool results in the chat as readable terminal transcripts.

**Architecture:** Add a bounded terminal output bus to `useTerminalStore`, then have the xterm hook subscribe to that bus and replay buffered output when the terminal opens. WebContainer install/dev processes and agent `run_command` output write raw chunks to the bus, while chat tool results keep their raw content and pass through a lightweight ANSI transcript renderer for display.

**Tech Stack:** React, TypeScript, Zustand, WebContainer API, xterm.js, Vitest, Testing Library.

---

## Scope And Constraints

- Keep `MAX_TOOL_LOOPS = 1000` unchanged.
- Keep the existing tool set and `run_command` allowlist unchanged.
- Keep WebContainer boot/install/dev lifecycle semantics unchanged except for where process output is displayed.
- Do not make browser console the primary sink for command stdout/stderr.
- Do not persist terminal output to the backend.
- Do not implement a full terminal emulator for chat results; xterm remains responsible for full terminal behavior.

## File Structure

- Modify `frontend/src/stores/useTerminalStore.ts`: add terminal output bus state, bounded buffer, sink registration, and cleanup actions.
- Create `frontend/src/stores/useTerminalStore.test.ts`: unit tests for buffering, truncation, sink fanout, and unregister behavior.
- Modify `frontend/src/hooks/useTerminal.ts`: register xterm as a terminal output bus sink, replay existing buffer, and unregister on close/unmount.
- Modify `frontend/src/hooks/useWebContainer.ts`: route registry setup, `npm install`, and dev server output to terminal bus instead of per-chunk `console.log`.
- Modify `frontend/src/agent/webcontainer.ts`: extend `wcSpawnCommand` with optional `cwd`, keep output collection, and call `onOutput` for each chunk.
- Modify `frontend/src/agent/tools/runCommand.ts`: write command header/output/exit details to the terminal bus while preserving raw tool result content.
- Create `frontend/src/utils/ansiTranscript.ts`: parse real ESC and visible `␛` CSI sequences into styled text segments, stripping cursor/control sequences.
- Create `frontend/src/utils/ansiTranscript.test.ts`: unit tests for stripping control sequences, SGR color/bold handling, and newline normalization.
- Create `frontend/src/components/ui/TerminalOutput.tsx`: reusable transcript display for tool results.
- Create `frontend/src/components/ui/TerminalOutput.test.tsx`: component tests that verify cleaned display and style classes.
- Modify `frontend/src/components/AgentChatContent.tsx`: replace raw tool result `<pre>` with `TerminalOutput`.
- Modify `frontend/src/components/AgentChatContent.test.tsx`: verify tool results render without raw ANSI/control glyphs.

## Task 1: Terminal Output Bus Store

**Files:**
- Modify: `frontend/src/stores/useTerminalStore.ts`
- Create: `frontend/src/stores/useTerminalStore.test.ts`

- [ ] **Step 1: Write failing store tests**

Create `frontend/src/stores/useTerminalStore.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTerminalStore } from './useTerminalStore';

describe('useTerminalStore terminal output bus', () => {
  beforeEach(() => {
    useTerminalStore.getState().clearOutputBuffer();
    useTerminalStore.setState({ isOpen: false, height: 250 });
  });

  it('appends output to a bounded buffer', () => {
    useTerminalStore.getState().appendOutput('hello');
    useTerminalStore.getState().appendOutput(' world');

    expect(useTerminalStore.getState().outputBuffer).toBe('hello world');
  });

  it('ignores empty output chunks', () => {
    useTerminalStore.getState().appendOutput('');

    expect(useTerminalStore.getState().outputBuffer).toBe('');
  });

  it('truncates old buffered output when the buffer exceeds the limit', () => {
    const longChunk = 'x'.repeat(70 * 1024);

    useTerminalStore.getState().appendOutput(longChunk);

    const buffer = useTerminalStore.getState().outputBuffer;
    expect(buffer.length).toBe(64 * 1024);
    expect(buffer).toBe(longChunk.slice(-64 * 1024));
  });

  it('writes new chunks to every registered sink', () => {
    const firstSink = vi.fn();
    const secondSink = vi.fn();

    useTerminalStore.getState().registerSink(firstSink);
    useTerminalStore.getState().registerSink(secondSink);
    useTerminalStore.getState().appendOutput('chunk');

    expect(firstSink).toHaveBeenCalledWith('chunk');
    expect(secondSink).toHaveBeenCalledWith('chunk');
  });

  it('does not write to a sink after unregister', () => {
    const sink = vi.fn();
    const unregister = useTerminalStore.getState().registerSink(sink);

    unregister();
    useTerminalStore.getState().appendOutput('after-close');

    expect(sink).not.toHaveBeenCalled();
  });

  it('clears only the output buffer', () => {
    const sink = vi.fn();
    useTerminalStore.getState().registerSink(sink);
    useTerminalStore.getState().appendOutput('old');

    useTerminalStore.getState().clearOutputBuffer();
    useTerminalStore.getState().appendOutput('new');

    expect(useTerminalStore.getState().outputBuffer).toBe('new');
    expect(sink).toHaveBeenLastCalledWith('new');
  });
});
```

- [ ] **Step 2: Run the focused failing test**

Run:

```bash
cd frontend && npm test -- src/stores/useTerminalStore.test.ts
```

Expected: FAIL because `outputBuffer`, `appendOutput`, `registerSink`, and `clearOutputBuffer` do not exist.

- [ ] **Step 3: Implement the store output bus**

Replace `frontend/src/stores/useTerminalStore.ts` with:

```typescript
import { create } from 'zustand';

const MAX_OUTPUT_BUFFER_LENGTH = 64 * 1024;

type TerminalSink = (data: string) => void;

interface TerminalState {
  isOpen: boolean;
  height: number;
  outputBuffer: string;
  setOpen: (open: boolean) => void;
  setHeight: (height: number) => void;
  appendOutput: (data: string) => void;
  registerSink: (sink: TerminalSink) => () => void;
  clearOutputBuffer: () => void;
}

const sinks = new Set<TerminalSink>();

function trimBuffer(buffer: string): string {
  if (buffer.length <= MAX_OUTPUT_BUFFER_LENGTH) return buffer;
  return buffer.slice(-MAX_OUTPUT_BUFFER_LENGTH);
}

export const useTerminalStore = create<TerminalState>((set) => ({
  isOpen: false,
  height: 250,
  outputBuffer: '',
  setOpen: (open) => set({ isOpen: open }),
  setHeight: (height) => set({ height }),
  appendOutput: (data) => {
    if (!data) return;

    set((state) => ({
      outputBuffer: trimBuffer(state.outputBuffer + data),
    }));

    for (const sink of sinks) {
      sink(data);
    }
  },
  registerSink: (sink) => {
    sinks.add(sink);
    return () => {
      sinks.delete(sink);
    };
  },
  clearOutputBuffer: () => set({ outputBuffer: '' }),
}));
```

- [ ] **Step 4: Run store tests**

Run:

```bash
cd frontend && npm test -- src/stores/useTerminalStore.test.ts
```

Expected: PASS.

- [ ] **Step 5: Typecheck the store change**

Run:

```bash
frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
```

Expected: PASS with no TypeScript errors.

## Task 2: xterm Subscription And Buffer Replay

**Files:**
- Modify: `frontend/src/hooks/useTerminal.ts`

- [ ] **Step 1: Add terminal store imports and cleanup refs**

Modify the imports and refs in `frontend/src/hooks/useTerminal.ts`:

```typescript
import { useRef, useState, useCallback, useEffect } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { useWebContainer } from './useWebContainer';
import { useTerminalStore } from '../stores/useTerminalStore';
```

Inside `useTerminal`, after `processRef`:

```typescript
  const unregisterSinkRef = useRef<(() => void) | null>(null);
```

- [ ] **Step 2: Register xterm as the bus sink after `terminal.open`**

In `open`, after setting `terminalRef.current` and `fitAddonRef.current`, add:

```typescript
    const { outputBuffer, registerSink } = useTerminalStore.getState();
    if (outputBuffer) {
      terminal.write(outputBuffer);
    }
    unregisterSinkRef.current = registerSink((data) => {
      terminal.write(data);
    });
```

Expected behavior: install/dev/agent output that happened before the terminal was opened is replayed once, and new bus output streams live into xterm.

- [ ] **Step 3: Unregister the sink in `close`**

At the start of `close`, before killing the process:

```typescript
    if (unregisterSinkRef.current) {
      unregisterSinkRef.current();
      unregisterSinkRef.current = null;
    }
```

- [ ] **Step 4: Unregister on unmount**

In the cleanup returned by the `useEffect`, before disposing `terminalRef.current`, add:

```typescript
      if (unregisterSinkRef.current) {
        unregisterSinkRef.current();
        unregisterSinkRef.current = null;
      }
```

- [ ] **Step 5: Run typecheck**

Run:

```bash
frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
```

Expected: PASS.

## Task 3: Route WebContainer Install And Dev Output To Terminal

**Files:**
- Modify: `frontend/src/hooks/useWebContainer.ts`

- [ ] **Step 1: Import the terminal store**

Add this import:

```typescript
import { useTerminalStore } from '../stores/useTerminalStore';
```

- [ ] **Step 2: Add a local terminal writer helper**

After `const serverReadyListeners = new Set<(url: string) => void>();`, add:

```typescript
function appendTerminalOutput(data: string): void {
  useTerminalStore.getState().appendOutput(data);
}

function writeTerminalHeader(label: string): void {
  appendTerminalOutput(`\r\n[${label}]\r\n`);
}
```

- [ ] **Step 3: Stream registry setup output to the terminal bus**

In `setupNpmRegistry`, replace the spawn/exit/log block with:

```typescript
    writeTerminalHeader('npm config set registry');
    const proc = await wc.spawn(
      'npm',
      ['config', 'set', 'registry', 'https://registry.npmmirror.com'],
      { cwd: '/home/project' }
    );
    proc.output.pipeTo(
      new WritableStream({
        write: appendTerminalOutput,
      })
    );
    await proc.exit;
    appendTerminalOutput('[npm config] registry set to https://registry.npmmirror.com\r\n');
```

Expected behavior: registry setup stdout/stderr is visible in the app terminal. There is no per-chunk `console.log` for command output.

- [ ] **Step 4: Stream `npm install` output to the terminal bus**

In `startDevServerInternal`, replace the install output block with:

```typescript
    writeTerminalHeader('npm install');
    const installProcess = await webcontainerInstance.spawn('npm', ['install'], { cwd: '/home/project' });
    installProcess.output.pipeTo(
      new WritableStream({
        write: appendTerminalOutput,
      })
    );
    const installExitCode = await installProcess.exit;
    appendTerminalOutput(`[npm install] exited with code ${installExitCode}\r\n`);
```

Keep the existing `catch` structure, and inside the `catch` add a terminal-facing message before the warning:

```typescript
    const message = err instanceof Error ? err.message : 'unknown error';
    appendTerminalOutput(`[npm install] failed: ${message}\r\n`);
    console.warn('npm install failed, continuing anyway:', err);
```

- [ ] **Step 5: Stream `npm run dev` output to the terminal bus**

In `startDevServerInternal`, replace the dev process output block with:

```typescript
    writeTerminalHeader('npm run dev');
    const devProcess = await webcontainerInstance.spawn('npm', ['run', 'dev', '--', '--host', 'localhost', '--port', '5173'], { cwd: '/home/project' });
    devProcess.output.pipeTo(
      new WritableStream({
        write: appendTerminalOutput,
      })
    );
```

Keep the existing `catch`, and add:

```typescript
    const message = err instanceof Error ? err.message : 'unknown error';
    appendTerminalOutput(`[npm run dev] failed: ${message}\r\n`);
    console.error('Failed to start dev server:', err);
```

- [ ] **Step 6: Verify install/dev routing compiles**

Run:

```bash
frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
```

Expected: PASS.

## Task 4: Route Agent Command Output To Terminal

**Files:**
- Modify: `frontend/src/agent/webcontainer.ts`
- Modify: `frontend/src/agent/tools/runCommand.ts`

- [ ] **Step 1: Extend `wcSpawnCommand` options without changing the allowlist**

In `frontend/src/agent/webcontainer.ts`, replace the options type:

```typescript
options?: { timeout?: number; onOutput?: (data: string) => void }
```

with:

```typescript
options?: { timeout?: number; cwd?: string; onOutput?: (data: string) => void }
```

Replace:

```typescript
  const process = await wc.spawn(command, args);
```

with:

```typescript
  const process = await wc.spawn(command, args, { cwd: options?.cwd ?? WC_PROJECT_DIR });
```

Expected behavior: commands continue to run under `/home/project` by default, with no allowlist expansion.

- [ ] **Step 2: Import terminal store in `runCommand`**

In `frontend/src/agent/tools/runCommand.ts`, add:

```typescript
import { useTerminalStore } from '../../stores/useTerminalStore';
```

- [ ] **Step 3: Add terminal formatting helpers**

In `frontend/src/agent/tools/runCommand.ts`, before `registerTool`, add:

```typescript
function appendTerminalOutput(data: string): void {
  useTerminalStore.getState().appendOutput(data);
}

function quoteCommandPart(part: string): string {
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(part)) return part;
  return JSON.stringify(part);
}
```

- [ ] **Step 4: Stream command execution to the terminal bus**

Inside the `try` block, replace:

```typescript
    const result = await wcSpawnCommand(cmd, cmdArgs);
    const text = result.output || '(no output)';
    return { content: text };
```

with:

```typescript
    const printableCommand = [cmd, ...cmdArgs].map(quoteCommandPart).join(' ');
    appendTerminalOutput(`\r\n[agent] $ ${printableCommand}\r\n`);
    const result = await wcSpawnCommand(cmd, cmdArgs, {
      onOutput: appendTerminalOutput,
    });
    appendTerminalOutput(`\r\n[agent] exited with code ${result.exitCode}\r\n`);
    const text = result.output || '(no output)';
    return { content: text };
```

Inside the `catch` block, before returning:

```typescript
    appendTerminalOutput(`\r\n[agent] command failed: ${message}\r\n`);
```

Expected behavior: the frontend terminal shows the command header, live output chunks, and final exit/failure status. The tool result returned to the agent remains the raw captured command output or error message.

- [ ] **Step 5: Run typecheck**

Run:

```bash
frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
```

Expected: PASS.

## Task 5: ANSI Transcript Parser

**Files:**
- Create: `frontend/src/utils/ansiTranscript.ts`
- Create: `frontend/src/utils/ansiTranscript.test.ts`

- [ ] **Step 1: Write failing parser tests**

Create `frontend/src/utils/ansiTranscript.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { renderTerminalTranscript, stripTerminalControls } from './ansiTranscript';

describe('ansiTranscript', () => {
  it('strips visible ESC cursor and clear-line controls', () => {
    expect(stripTerminalControls('␛[1G␛[0K\\␛[1G␛[0Knpm')).toBe('\\npm');
  });

  it('strips real ESC cursor and clear-line controls', () => {
    expect(stripTerminalControls('\x1b[1G\x1b[0Knpm')).toBe('npm');
  });

  it('preserves red SGR styling as a segment', () => {
    expect(renderTerminalTranscript('\x1b[31merror\x1b[39m ok')).toEqual([
      { text: 'error', color: 'red' },
      { text: ' ok' },
    ]);
  });

  it('preserves bold styling as a segment', () => {
    expect(renderTerminalTranscript('␛[1mnpm␛[22m error')).toEqual([
      { text: 'npm', bold: true },
      { text: ' error' },
    ]);
  });

  it('handles bright ANSI colors', () => {
    expect(renderTerminalTranscript('\x1b[94mcode\x1b[39m ENOENT')).toEqual([
      { text: 'code', color: 'blue' },
      { text: ' ENOENT' },
    ]);
  });

  it('normalizes carriage returns into readable newlines', () => {
    expect(stripTerminalControls('installing\rbuilding\r\nfinished')).toBe('installing\nbuilding\nfinished');
  });
});
```

- [ ] **Step 2: Run parser tests and confirm failure**

Run:

```bash
cd frontend && npm test -- src/utils/ansiTranscript.test.ts
```

Expected: FAIL because `ansiTranscript.ts` does not exist.

- [ ] **Step 3: Implement ANSI transcript utilities**

Create `frontend/src/utils/ansiTranscript.ts`:

```typescript
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

const CSI_PATTERN = /(?:\x1b|␛)\[([0-9;?]*)([@-~])/g;

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
```

- [ ] **Step 4: Run parser tests**

Run:

```bash
cd frontend && npm test -- src/utils/ansiTranscript.test.ts
```

Expected: PASS.

## Task 6: TerminalOutput UI Component

**Files:**
- Create: `frontend/src/components/ui/TerminalOutput.tsx`
- Create: `frontend/src/components/ui/TerminalOutput.test.tsx`

- [ ] **Step 1: Write failing component tests**

Create `frontend/src/components/ui/TerminalOutput.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TerminalOutput } from './TerminalOutput';

describe('TerminalOutput', () => {
  it('renders cleaned text without visible ESC controls', () => {
    render(<TerminalOutput value={'␛[1G␛[0K␛[1mnpm␛[22m ␛[31merror␛[39m'} />);

    expect(screen.getByText('npm')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
    expect(screen.queryByText(/␛\[1G/)).not.toBeInTheDocument();
  });

  it('applies error border styling when state is error', () => {
    const { container } = render(<TerminalOutput value={'failed'} state="error" />);

    expect(container.firstChild).toHaveClass('border-red-900/50');
  });
});
```

- [ ] **Step 2: Run component tests and confirm failure**

Run:

```bash
cd frontend && npm test -- src/components/ui/TerminalOutput.test.tsx
```

Expected: FAIL because `TerminalOutput.tsx` does not exist.

- [ ] **Step 3: Implement `TerminalOutput`**

Create `frontend/src/components/ui/TerminalOutput.tsx`:

```tsx
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
  const classes = [];
  if (segment.bold) classes.push('font-semibold');
  if (segment.color) classes.push(colorClassByName[segment.color]);
  return classes.join(' ');
}

export function TerminalOutput({ value, state = 'success' }: TerminalOutputProps) {
  const segments = renderTerminalTranscript(value);
  const isError = state === 'error';

  return (
    <div
      className={`p-2.5 bg-zinc-950/40 border rounded-[6px] text-[11px] font-mono overflow-x-auto custom-scrollbar ${
        isError ? 'border-red-900/50 text-red-400/90' : 'border-zinc-800/40 text-zinc-400'
      }`}
    >
      <div className="text-zinc-500 mb-1 font-sans text-[10px] tracking-wide uppercase">结果</div>
      <pre className="!m-0 !p-0 !bg-transparent whitespace-pre-wrap break-all leading-relaxed">
        {segments.map((segment, index) => (
          <span key={`${index}-${segment.text.slice(0, 8)}`} className={segmentClassName(segment)}>
            {segment.text}
          </span>
        ))}
      </pre>
    </div>
  );
}
```

- [ ] **Step 4: Run component tests**

Run:

```bash
cd frontend && npm test -- src/components/ui/TerminalOutput.test.tsx
```

Expected: PASS.

## Task 7: Integrate TerminalOutput Into Agent Chat

**Files:**
- Modify: `frontend/src/components/AgentChatContent.tsx`
- Modify: `frontend/src/components/AgentChatContent.test.tsx`

- [ ] **Step 1: Import `TerminalOutput`**

Add this import to `frontend/src/components/AgentChatContent.tsx`:

```typescript
import { TerminalOutput } from './ui/TerminalOutput';
```

- [ ] **Step 2: Replace raw tool result rendering**

Replace the `tool.result` block:

```tsx
                    {tool.result && (
                      <div className={`p-2.5 bg-zinc-950/40 border border-zinc-800/40 rounded-[6px] text-[11px] font-mono overflow-x-auto custom-scrollbar ${tool.state === 'error' ? 'text-red-400/90' : 'text-zinc-400'}`}>
                        <div className="text-zinc-500 mb-1 font-sans text-[10px] tracking-wide uppercase">结果</div>
                        <pre className="!m-0 !p-0 !bg-transparent whitespace-pre-wrap break-all leading-relaxed">
                          {tool.result}
                        </pre>
                      </div>
                    )}
```

with:

```tsx
                    {tool.result && (
                      <TerminalOutput value={tool.result} state={tool.state} />
                    )}
```

Expected behavior: tool args remain JSON in the existing `<pre>`, while tool results use ANSI-aware transcript rendering.

- [ ] **Step 3: Add chat integration test**

In `frontend/src/components/AgentChatContent.test.tsx`, add a test using the existing test harness patterns in that file. The assertion should verify this exact behavior:

```tsx
expect(screen.getByText('npm')).toBeInTheDocument();
expect(screen.getByText('error')).toBeInTheDocument();
expect(screen.queryByText(/␛\[1G/)).not.toBeInTheDocument();
```

Use a visible assistant message whose `tools` entry contains:

```typescript
{
  id: 'tool-ansi',
  name: 'run_command',
  args: { command: 'npm test' },
  result: '␛[1G␛[0K␛[1mnpm␛[22m ␛[31merror␛[39m code ENOENT',
  state: 'error',
}
```

- [ ] **Step 4: Run chat component tests**

Run:

```bash
cd frontend && npm test -- src/components/AgentChatContent.test.tsx src/components/ui/TerminalOutput.test.tsx
```

Expected: PASS.

## Task 8: Focused Verification And Manual Smoke Test

**Files:**
- Verify: all modified frontend files from Tasks 1-7

- [ ] **Step 1: Run all focused frontend tests**

Run:

```bash
cd frontend && npm test -- src/stores/useTerminalStore.test.ts src/utils/ansiTranscript.test.ts src/components/ui/TerminalOutput.test.tsx src/components/AgentChatContent.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run frontend typecheck**

Run:

```bash
frontend/node_modules/.bin/tsc --noEmit -p frontend/tsconfig.json
```

Expected: PASS.

- [ ] **Step 3: Start the frontend dev server if manual verification is requested**

Run:

```bash
cd frontend && npm run dev -- --host 127.0.0.1
```

Expected: Vite prints a local URL, usually `http://127.0.0.1:5173/`. Keep this process running only for the manual smoke test.

- [ ] **Step 4: Manual smoke test terminal output routing**

In the browser:

1. Open a project that contains `package.json`.
2. Open the app terminal panel.
3. Trigger WebContainer initialization and dev server start.
4. Confirm the terminal panel shows `[npm install]` and `[npm run dev]` sections with live process output.
5. In the agent chat, trigger a command such as `npm test` or `ls`.
6. Confirm the terminal panel shows `[agent] $ npm test` or `[agent] $ ls`, command output, and an exit line.
7. Confirm F12 console is not receiving stdout/stderr chunks for each command output line.

Expected: command output appears in the app terminal panel, not primarily in the browser console.

- [ ] **Step 5: Manual smoke test ANSI chat result rendering**

In the browser:

1. Trigger or inspect a `run_command` tool result containing npm-style ANSI output.
2. Confirm visible control text like `␛[1G`, `␛[0K`, `\x1b[31m`, or `\x1b[39m` is not displayed.
3. Confirm meaningful text such as `npm error code ENOENT` remains readable.
4. Confirm colored/bold fragments render without breaking line wrapping.

Expected: chat tool results are readable terminal transcripts.

## Self-Review Checklist

- Spec coverage: terminal bus, buffer replay, install/dev routing, agent command routing, ANSI transcript rendering, and chat integration are each mapped to a task.
- Placeholder scan: the plan avoids unresolved implementation placeholders; every code step includes concrete snippets or exact assertions.
- Type consistency: `TerminalSegment`, `renderTerminalTranscript`, `stripTerminalControls`, `TerminalOutput`, `appendOutput`, and `registerSink` names are consistent across tasks.
- Scope control: no task changes command allowlist, tool availability, backend persistence, or loop limits.
