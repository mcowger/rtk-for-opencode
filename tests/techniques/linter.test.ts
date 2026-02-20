import { describe, it, expect } from 'vitest';
import { aggregateLinterOutput, isLinterCommand } from '../../src/techniques/linter.ts';

describe('isLinterCommand', () => {
  it('detects eslint', () => {
    expect(isLinterCommand('npx eslint src/')).toBe(true);
  });

  it('detects ruff', () => {
    expect(isLinterCommand('ruff check .')).toBe(true);
  });

  it('rejects non-linter commands', () => {
    expect(isLinterCommand('cargo build')).toBe(false);
  });
});

describe('aggregateLinterOutput', () => {
  it('returns null for non-linter commands', () => {
    expect(aggregateLinterOutput('output', 'cargo build')).toBeNull();
  });

  it('returns success message for clean lint', () => {
    const output = '✓ No problems found';
    const result = aggregateLinterOutput(output, 'eslint .');
    expect(result).toContain('No issues found');
  });

  it('aggregates errors and warnings', () => {
    const output = `
src/main.ts:10:5: error Missing return type @typescript-eslint/explicit-function-return-type
src/main.ts:15:1: warning Unexpected console statement no-console
src/utils.ts:5:3: error No explicit any @typescript-eslint/no-explicit-any
    `.trim();

    const result = aggregateLinterOutput(output, 'eslint src/');
    expect(result).toContain('2 errors');
    expect(result).toContain('1 warnings');
    expect(result).toContain('Top rules');
  });
});
