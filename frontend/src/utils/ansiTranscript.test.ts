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
