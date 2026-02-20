// Build output filtering (RTK Technique #6)
// Filters compilation noise from build commands

interface BuildStats {
  compiled: number;
  errors: string[][];
  warnings: string[];
}

const BUILD_COMMANDS = [
  'cargo build',
  'cargo check',
  'bun build',
  'npm run build',
  'yarn build',
  'pnpm build',
  'tsc',
  'make',
  'cmake',
  'gradle',
  'mvn',
  'go build',
  'go install',
  'python setup.py build',
  'pip install',
];

const SKIP_PATTERNS = [
  /^\s*Compiling\s+/,
  /^\s*Checking\s+/,
  /^\s*Downloading\s+/,
  /^\s*Downloaded\s+/,
  /^\s*Fetching\s+/,
  /^\s*Fetched\s+/,
  /^\s*Updating\s+/,
  /^\s*Updated\s+/,
  /^\s*Building\s+/,
  /^\s*Generated\s+/,
  /^\s*Creating\s+/,
  /^\s*Running\s+/,
];

const ERROR_START_PATTERNS = [
  /^error\[/, // Rust: error[E0000]
  /^error:/, // Generic: error:
  /^\[ERROR\]/, // Maven
  /^FAIL/, // Make
];

const WARNING_PATTERNS = [/^warning:/, /^\[WARNING\]/, /^warn:/];

function isSkipLine(line: string): boolean {
  return SKIP_PATTERNS.some((pattern) => pattern.test(line));
}

function isErrorStart(line: string): boolean {
  return ERROR_START_PATTERNS.some((pattern) => pattern.test(line));
}

function isWarning(line: string): boolean {
  return WARNING_PATTERNS.some((pattern) => pattern.test(line));
}

export function isBuildCommand(command: string): boolean {
  const cmdLower = command.toLowerCase();
  return BUILD_COMMANDS.some((bc) => cmdLower.includes(bc.toLowerCase()));
}

export function filterBuildOutput(output: string, command: string): string | null {
  if (!isBuildCommand(command)) {
    return null;
  }

  const lines = output.split('\n');
  const stats: BuildStats = {
    compiled: 0,
    errors: [],
    warnings: [],
  };

  let inErrorBlock = false;
  let currentError: string[] = [];
  let blankCount = 0;

  for (const line of lines) {
    // Count compilation progress lines
    if (line.match(/^\s*(Compiling|Checking|Building)\s+/)) {
      stats.compiled++;
      continue;
    }

    // Skip noise lines
    if (isSkipLine(line)) {
      continue;
    }

    // Handle errors
    if (isErrorStart(line)) {
      if (inErrorBlock && currentError.length > 0) {
        stats.errors.push([...currentError]);
      }
      inErrorBlock = true;
      currentError = [line];
      blankCount = 0;
      continue;
    }

    // Handle warnings
    if (isWarning(line)) {
      stats.warnings.push(line);
      continue;
    }

    // Continue error block
    if (inErrorBlock) {
      if (line.trim() === '') {
        blankCount++;
        if (blankCount >= 2 && currentError.length > 3) {
          stats.errors.push([...currentError]);
          inErrorBlock = false;
          currentError = [];
        } else {
          currentError.push(line);
        }
      } else if (line.match(/^\s/) || line.match(/^-->/)) {
        // Continuation: indented or location marker
        currentError.push(line);
        blankCount = 0;
      } else {
        // New non-indented line ends error block
        stats.errors.push([...currentError]);
        inErrorBlock = false;
        currentError = [];
      }
    }
  }

  // Flush final error
  if (inErrorBlock && currentError.length > 0) {
    stats.errors.push(currentError);
  }

  // Build result
  if (stats.errors.length === 0 && stats.warnings.length === 0) {
    return `✓ Build successful (${stats.compiled} units compiled)`;
  }

  const result: string[] = [];

  if (stats.errors.length > 0) {
    result.push(`❌ ${stats.errors.length} error(s):`);
    for (const error of stats.errors.slice(0, 5)) {
      result.push(...error.slice(0, 10)); // Limit error context
      if (error.length > 10) {
        result.push('  ...');
      }
    }
    if (stats.errors.length > 5) {
      result.push(`... and ${stats.errors.length - 5} more errors`);
    }
  }

  if (stats.warnings.length > 0) {
    result.push(`\n⚠️  ${stats.warnings.length} warning(s)`);
  }

  return result.join('\n');
}
