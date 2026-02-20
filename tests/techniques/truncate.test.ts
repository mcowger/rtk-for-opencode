import { describe, it, expect } from 'vitest';
import { truncate } from '../../src/techniques/truncate.ts';

describe('truncate', () => {
  it('returns unchanged text when under limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('returns unchanged text at exact limit', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });

  it('truncates text over limit with ellipsis', () => {
    const result = truncate('hello world', 10);
    expect(result).toBe('hello w\n... [truncated: 4 chars omitted]');
  });

  it('returns truncation message for limit of 3', () => {
    const result = truncate('hello', 3);
    expect(result).toBe('\n... [truncated: 5 chars omitted]');
  });

  it('handles empty string', () => {
    expect(truncate('', 10)).toBe('');
  });

  it('shows correct omitted count', () => {
    const text = 'abcdefghijklmnopqrstuvwxyz';
    const result = truncate(text, 15);
    expect(result).toContain('... [truncated: 14 chars omitted]');
  });
});
