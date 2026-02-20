import { describe, it, expect } from 'vitest';
import { aggregateTestOutput, isTestCommand } from '../../src/techniques/test-output.ts';

describe('isTestCommand', () => {
  it('detects bun test', () => {
    expect(isTestCommand('bun test')).toBe(true);
  });

  it('detects cargo test', () => {
    expect(isTestCommand('cargo test')).toBe(true);
  });

  it('rejects non-test commands', () => {
    expect(isTestCommand('cargo build')).toBe(false);
  });
});

describe('aggregateTestOutput', () => {
  it('returns null for non-test commands', () => {
    expect(aggregateTestOutput('output', 'cargo build')).toBeNull();
  });

  it('returns compact summary for passing tests', () => {
    const output = 'Tests: 42 passed, 0 failed, 0 skipped';
    const result = aggregateTestOutput(output, 'bun test');
    expect(result).toContain('42 passed');
    expect(result).toContain('Test Results');
  });

  it('includes failure details when tests fail', () => {
    const output = `
test result: FAILED. 5 passed; 2 failed; 0 ignored

FAIL test-one
  expect(received).toBe(expected)
  
FAIL test-two
  assertion failed
    `.trim();

    const result = aggregateTestOutput(output, 'cargo test');
    expect(result).toContain('5 failed');
  });
});
