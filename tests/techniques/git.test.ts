import { describe, it, expect } from 'vitest';
import {
  compactDiff,
  compactStatus,
  compactLog,
  compactGitOutput,
  isGitCommand,
} from '../../src/techniques/git.ts';

describe('isGitCommand', () => {
  it('detects git diff', () => {
    expect(isGitCommand('git diff')).toBe(true);
  });

  it('detects git status', () => {
    expect(isGitCommand('git status')).toBe(true);
  });

  it('rejects non-git commands', () => {
    expect(isGitCommand('ls -la')).toBe(false);
  });
});

describe('compactDiff', () => {
  it('shows file names and stats', () => {
    const output = `diff --git a/src/file.ts b/src/file.ts
@@ -1,5 +1,5 @@
- old line
+ new line
 context
 context`;
    const result = compactDiff(output);
    expect(result).toContain('📄');
    expect(result).toContain('+1');
    expect(result).toContain('-1');
  });

  it('handles multiple files', () => {
    const output = `diff --git a/file1.ts b/file1.ts
@@ -1,2 +1,2 @@
- old
+ new
diff --git a/file2.ts b/file2.ts
@@ -5,3 +5,3 @@
- old2
+ new2`;
    const result = compactDiff(output);
    expect(result).toContain('file1.ts');
    expect(result).toContain('file2.ts');
  });
});

describe('compactStatus', () => {
  it('shows clean tree for empty status', () => {
    expect(compactStatus('')).toBe('Clean working tree');
  });

  it('shows staged files', () => {
    const output = `M  src/file.ts
A  src/new.ts`;
    const result = compactStatus(output);
    expect(result).toContain('Staged');
    expect(result).toContain('file.ts');
  });

  it('shows modified files', () => {
    const output = ` M src/file.ts
 M src/other.ts`;
    const result = compactStatus(output);
    expect(result).toContain('Modified');
  });
});

describe('compactLog', () => {
  it('truncates long lines', () => {
    const output = 'a'.repeat(100);
    const result = compactLog(output);
    expect(result).toContain('...');
  });

  it('limits to specified number of lines', () => {
    const output = Array(30).fill('commit message').join('\n');
    const result = compactLog(output, 10);
    expect(result).toContain('+20 more commits');
  });
});

describe('compactGitOutput', () => {
  it('routes diff commands to compactDiff', () => {
    const output = `diff --git a/file.ts b/file.ts
@@ -1 +1 @@
- old
+ new`;
    const result = compactGitOutput(output, 'git diff');
    expect(result).toContain('📄');
  });

  it('returns null for non-git commands', () => {
    expect(compactGitOutput('output', 'ls -la')).toBeNull();
  });
});
