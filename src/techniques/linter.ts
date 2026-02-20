// Linter output aggregation (RTK Technique #10)
// Aggregates lint results by severity, rule, and file

interface LinterIssue {
  file: string;
  line: number;
  rule: string;
  severity: 'error' | 'warning';
}

const LINTER_COMMANDS = [
  'eslint',
  'tslint',
  'ruff',
  'pylint',
  'flake8',
  'mypy',
  'black --check',
  'rubocop',
  'golangci-lint',
  'clippy',
  'cargo clippy',
];

// Patterns for parsing linter output
const LINTER_PATTERNS: Record<string, RegExp[]> = {
  eslint: [
    /^(.+):(\d+):(\d+):\s+(error|warning)\s+(.+?)\s+(.+)$/, // file:line:col: severity message rule
    /^(.+):(\d+):(\d+):\s+(error|warning)\s+(.+)$/, // file:line:col: severity message
  ],
  ruff: [
    /^(.+):(\d+):(\d+):\s+([A-Z]\d+)\s+(.+)$/, // file:line:col: RULE message
  ],
  pylint: [
    /^(.+):(\d+):\s+([A-Z]\d+)\s*:\s*(.+)$/, // file:line: RULE: message
  ],
  flake8: [
    /^(.+):(\d+):(\d+):\s+([A-Z]\d+)\s+(.+)$/, // file:line:col: RULE message
  ],
  mypy: [
    /^(.+):(\d+):\s+(error|warning):\s+(.+)$/, // file:line: severity: message
  ],
  golangci: [
    /^(.+):(\d+):\s+(.+)$/, // file:line: message
  ],
};

export function isLinterCommand(command: string): boolean {
  const cmdLower = command.toLowerCase();
  return LINTER_COMMANDS.some((lc) => cmdLower.includes(lc.toLowerCase()));
}

function parseIssue(line: string, linterType: string): LinterIssue | null {
  const patterns = LINTER_PATTERNS[linterType] || LINTER_PATTERNS.eslint;

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      let severity: 'error' | 'warning' = 'warning';
      let rule = 'unknown';

      if (linterType === 'eslint') {
        severity = (match[4] || 'warning') as 'error' | 'warning';
        rule = match[6] || 'unknown';
      } else if (linterType === 'ruff') {
        rule = match[4];
        severity = /^E/.test(rule) ? 'error' : 'warning';
      } else if (linterType === 'pylint') {
        rule = match[3];
        severity = /^E/.test(rule) ? 'error' : 'warning';
      } else if (linterType === 'flake8') {
        rule = match[4];
        severity = /^E/.test(rule) ? 'error' : 'warning';
      } else if (linterType === 'mypy') {
        severity = (match[3] || 'warning') as 'error' | 'warning';
      }

      return {
        file: match[1],
        line: parseInt(match[2], 10),
        rule,
        severity,
      };
    }
  }

  return null;
}

function detectLinterType(command: string): string {
  const cmdLower = command.toLowerCase();
  if (cmdLower.includes('eslint')) return 'eslint';
  if (cmdLower.includes('ruff')) return 'ruff';
  if (cmdLower.includes('pylint')) return 'pylint';
  if (cmdLower.includes('flake8')) return 'flake8';
  if (cmdLower.includes('mypy')) return 'mypy';
  if (cmdLower.includes('golangci')) return 'golangci';
  return 'eslint'; // Default fallback
}

function compactPath(path: string, maxLength: number = 50): string {
  if (path.length <= maxLength) {
    return path;
  }

  const parts = path.split('/');
  if (parts.length <= 3) {
    return path;
  }

  return `${parts[0]}/.../${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
}

export function aggregateLinterOutput(output: string, command: string): string | null {
  if (!isLinterCommand(command)) {
    return null;
  }

  const linterType = detectLinterType(command);
  const lines = output.split('\n');
  const issues: LinterIssue[] = [];

  for (const line of lines) {
    const issue = parseIssue(line, linterType);
    if (issue) {
      issues.push(issue);
    }
  }

  if (issues.length === 0) {
    // Check for "no errors" messages
    if (output.match(/no\s+(errors|problems|issues)/i) || output.match(/clean|✓/)) {
      return `✓ ${linterType}: No issues found`;
    }
    return null; // Couldn't parse, passthrough
  }

  // Count by severity
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;

  // Group by rule
  const byRule: Record<string, number> = {};
  for (const issue of issues) {
    byRule[issue.rule] = (byRule[issue.rule] || 0) + 1;
  }

  // Group by file
  const byFile: Record<string, { count: number; rules: Record<string, number> }> = {};
  for (const issue of issues) {
    if (!byFile[issue.file]) {
      byFile[issue.file] = { count: 0, rules: {} };
    }
    byFile[issue.file].count++;
    byFile[issue.file].rules[issue.rule] = (byFile[issue.file].rules[issue.rule] || 0) + 1;
  }

  // Build output
  const result: string[] = [
    `${linterType}: ${errors} errors, ${warnings} warnings in ${Object.keys(byFile).length} files`,
    '═══════════════════════════════════════',
  ];

  // Top rules
  result.push('Top rules:');
  const sortedRules = Object.entries(byRule).sort((a, b) => b[1] - a[1]);
  for (const [rule, count] of sortedRules.slice(0, 10)) {
    result.push(`  ${rule} (${count}x)`);
  }
  if (sortedRules.length > 10) {
    result.push(`  ... +${sortedRules.length - 10} more`);
  }

  // Top files
  result.push('\nTop files:');
  const sortedFiles = Object.entries(byFile).sort((a, b) => b[1].count - a[1].count);
  for (const [file, data] of sortedFiles.slice(0, 10)) {
    const compact = compactPath(file);
    result.push(`  ${compact} (${data.count} issues)`);

    // Top 3 rules per file
    const sortedFileRules = Object.entries(data.rules).sort((a, b) => b[1] - a[1]);
    for (const [rule, count] of sortedFileRules.slice(0, 3)) {
      result.push(`    ${rule} (${count})`);
    }
    if (sortedFileRules.length > 3) {
      result.push(`    ... +${sortedFileRules.length - 3} more`);
    }
  }
  if (sortedFiles.length > 10) {
    result.push(`\n... +${sortedFiles.length - 10} more files`);
  }

  return result.join('\n');
}
