import { describe, it, expect } from 'vitest';
import { stripAnsi, stripAnsiFast } from '../../src/techniques/ansi.ts';

describe('stripAnsi', () => {
  it('returns unchanged text without ANSI codes', () => {
    const text = 'Hello World';
    expect(stripAnsi(text)).toBe(text);
  });

  it('removes color codes', () => {
    const text = '\x1b[31mRed\x1b[0m Text';
    expect(stripAnsi(text)).toBe('Red Text');
  });

  it('removes bold codes', () => {
    const text = '\x1b[1mBold\x1b[22m Text';
    expect(stripAnsi(text)).toBe('Bold Text');
  });

  it('removes multiple codes', () => {
    const text = '\x1b[31m\x1b[1mRed Bold\x1b[0m\x1b[32m Green\x1b[0m';
    expect(stripAnsi(text)).toBe('Red Bold Green');
  });

  it('handles empty string', () => {
    expect(stripAnsi('')).toBe('');
  });

  it('handles complex real-world output', () => {
    const text = '\x1b[32m✓\x1b[0m \x1b[1msome test\x1b[0m\n\x1b[36m    in test.ts:42\x1b[0m';
    expect(stripAnsi(text)).toBe('✓ some test\n    in test.ts:42');
  });
});

describe('stripAnsiFast', () => {
  it('returns same result as stripAnsi', () => {
    const text = '\x1b[31mRed\x1b[0m Text';
    expect(stripAnsiFast(text)).toBe(stripAnsi(text));
  });

  it('bypasses regex for clean text', () => {
    const text = 'Hello World\nThis has no ANSI';
    expect(stripAnsiFast(text)).toBe(text);
  });
});
