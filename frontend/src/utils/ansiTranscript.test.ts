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

  it('keeps bold when truecolor payload contains zero values', () => {
    expect(renderTerminalTranscript('\x1b[1;38;2;255;0;0mtext')).toEqual([
      { text: 'text', bold: true },
    ]);
  });

  it('handles bright ANSI colors', () => {
    expect(renderTerminalTranscript('\x1b[94mcode\x1b[39m ENOENT')).toEqual([
      { text: 'code', color: 'blue' },
      { text: ' ENOENT' },
    ]);
  });

  it('skips 256-color payloads without corrupting later supported colors', () => {
    expect(renderTerminalTranscript('\x1b[38;5;196;31merror')).toEqual([
      { text: 'error', color: 'red' },
    ]);
  });

  it('normalizes carriage returns into readable newlines', () => {
    expect(stripTerminalControls('installing\rbuilding\r\nfinished')).toBe('installing\nbuilding\nfinished');
  });
});
