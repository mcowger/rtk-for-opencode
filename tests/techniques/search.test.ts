import { describe, it, expect } from 'vitest';
import { groupSearchResults, isSearchCommand } from '../../src/techniques/search.ts';

describe('isSearchCommand', () => {
  it('detects grep', () => {
    expect(isSearchCommand('grep pattern')).toBe(true);
  });

  it('detects rg (ripgrep)', () => {
    expect(isSearchCommand('rg pattern')).toBe(true);
  });

  it('rejects non-search commands', () => {
    expect(isSearchCommand('ls -la')).toBe(false);
  });
});

describe('groupSearchResults', () => {
  it('returns null for non-search output', () => {
    expect(groupSearchResults('hello world')).toBeNull();
  });

  it('groups results by file', () => {
    const output = `src/file1.ts:10:const x = 1;
src/file1.ts:20:const y = 2;
src/file2.ts:5:const z = 3;`;
    const result = groupSearchResults(output);
    expect(result).toContain('file1.ts');
    expect(result).toContain('file2.ts');
    expect(result).toContain('2 matches');
  });

  it('compacts file paths', () => {
    const output = `very/long/path/to/the/actual/project/source/components/feature/module.ts:1:const content = 'value';`;
    const result = groupSearchResults(output);
    expect(result).not.toBeNull();
    if (result) {
      expect(result).toContain('...');
    }
  });

  it('limits matches per file', () => {
    const lines = Array(20)
      .fill(0)
      .map((_, i) => `src/file.ts:${i + 1}:content`)
      .join('\n');
    const result = groupSearchResults(lines);
    expect(result).toContain('+10 more');
  });
});
