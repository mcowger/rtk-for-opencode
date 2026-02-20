import { describe, it, expect } from 'vitest';
import { filterBuildOutput, isBuildCommand } from '../../src/techniques/build.ts';

describe('isBuildCommand', () => {
  it('detects cargo build', () => {
    expect(isBuildCommand('cargo build')).toBe(true);
  });

  it('detects bun build', () => {
    expect(isBuildCommand('bun build ./src')).toBe(true);
  });

  it('detects npm run build', () => {
    expect(isBuildCommand('npm run build')).toBe(true);
  });

  it('rejects non-build commands', () => {
    expect(isBuildCommand('ls -la')).toBe(false);
    expect(isBuildCommand('cat file.txt')).toBe(false);
  });
});

describe('filterBuildOutput', () => {
  it('returns null for non-build commands', () => {
    const output = 'some output';
    expect(filterBuildOutput(output, 'ls -la')).toBeNull();
  });

  it('returns compact success for clean build', () => {
    const output = `
Compiling mycrate v1.0.0
Downloading some-dep v0.1.0
Compiling some-dep v0.1.0
Finished dev [unoptimized + debuginfo] target(s) in 2.5s
    `.trim();

    const result = filterBuildOutput(output, 'cargo build');
    expect(result).toContain('✓ Build successful');
    expect(result).toContain('2 units');
  });

  it('preserves error messages', () => {
    const output = `
Compiling mycrate v1.0.0
error[E0000]: something went wrong
  --> src/main.rs:10:5
   |
10 |     let x = undefined;
   |     ^^^^^^^^^^^^^^^^^ not found

error: could not compile
    `.trim();

    const result = filterBuildOutput(output, 'cargo build');
    expect(result).toContain('❌ 2 error(s)');
    expect(result).toContain('something went wrong');
  });
});
