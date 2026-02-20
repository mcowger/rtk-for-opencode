import { describe, it, expect } from 'vitest';
import {
  detectLanguage,
  filterMinimal,
  filterAggressive,
  smartTruncate,
  Language,
} from '../../src/techniques/source.ts';

describe('detectLanguage', () => {
  it('detects TypeScript files', () => {
    expect(detectLanguage('/path/to/file.ts')).toBe('typescript');
    expect(detectLanguage('/path/to/file.tsx')).toBe('typescript');
  });

  it('detects Python files', () => {
    expect(detectLanguage('script.py')).toBe('python');
  });

  it('detects Rust files', () => {
    expect(detectLanguage('main.rs')).toBe('rust');
  });

  it('returns unknown for unsupported extensions', () => {
    expect(detectLanguage('file.txt')).toBe('unknown');
    expect(detectLanguage('file.md')).toBe('unknown');
  });
});

describe('filterMinimal', () => {
  it('removes single-line comments', () => {
    const code = `const x = 1; // this is a comment
const y = 2;`;
    const result = filterMinimal(code, 'typescript');
    expect(result).not.toContain('// this is a comment');
    expect(result).toContain('const x = 1;');
    expect(result).toContain('const y = 2;');
  });

  it('removes block comments', () => {
    const code = `/* start
multi
line
end */
const x = 1;`;
    const result = filterMinimal(code, 'typescript');
    expect(result).not.toContain('multi');
    expect(result).toContain('const x = 1;');
  });

  it('preserves Python docstrings', () => {
    const code = `def func():
    """This is a docstring"""
    pass`;
    const result = filterMinimal(code, 'python');
    expect(result).toContain('"""This is a docstring"""');
  });

  it('removes Python hash comments', () => {
    const code = `x = 1  # comment
y = 2`;
    const result = filterMinimal(code, 'python');
    expect(result).not.toContain('# comment');
    expect(result).toContain('x = 1');
    expect(result).toContain('y = 2');
  });

  it('normalizes multiple blank lines', () => {
    const code = `line1



line2`;
    const result = filterMinimal(code, 'typescript');
    expect(result).not.toMatch(/\n\n\n/);
  });

  it('returns unchanged for unknown language', () => {
    const code = '// comment\nconst x = 1;';
    const result = filterMinimal(code, 'unknown' as Language);
    expect(result).toBe(code);
  });
});

describe('filterAggressive', () => {
  it('keeps only signatures and imports', () => {
    const code = `import { x } from './x';
// comment
function test() {
  console.log('hello');
  return 42;
}`;
    const result = filterAggressive(code, 'typescript');
    expect(result).toContain('import');
    expect(result).toContain('function test()');
    expect(result).not.toContain("console.log('hello')");
  });

  it('preserves constants', () => {
    const code = `const MAX_SIZE = 100;
function helper() {}
const x = 1;`;
    const result = filterAggressive(code, 'typescript');
    expect(result).toContain('const MAX_SIZE = 100;');
  });
});

describe('smartTruncate', () => {
  it('returns unchanged when under limit', () => {
    const code = 'line1\nline2\nline3';
    const result = smartTruncate(code, 5);
    expect(result).toBe(code);
  });

  it('truncates with marker when over limit', () => {
    const code = 'line1\nline2\nline3\nline4\nline5';
    const result = smartTruncate(code, 3);
    expect(result).toContain('...');
    expect(result).toContain('more lines');
  });

  it('preserves important lines', () => {
    const code = `import { x } from './x';






const y = 1;`;
    const result = smartTruncate(code, 5);
    expect(result).toContain('import');
  });
});
