// Source code filtering (RTK Technique #1)
// Filters source code files to remove comments and reduce token count

export type Language =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'rust'
  | 'go'
  | 'java'
  | 'c'
  | 'cpp'
  | 'unknown';

const LANGUAGE_EXTENSIONS: Record<string, Language> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.py': 'python',
  '.pyw': 'python',
  '.rs': 'rust',
  '.go': 'go',
  '.java': 'java',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.hpp': 'cpp',
  '.cc': 'cpp',
};

interface CommentPatterns {
  line?: string;
  blockStart?: string;
  blockEnd?: string;
  docComment?: string;
}

const COMMENT_PATTERNS: Record<Language, CommentPatterns> = {
  typescript: { line: '//', blockStart: '/*', blockEnd: '*/' },
  javascript: { line: '//', blockStart: '/*', blockEnd: '*/' },
  python: { line: '#', docComment: '"""' },
  rust: { line: '//', blockStart: '/*', blockEnd: '*/', docComment: '///' },
  go: { line: '//', blockStart: '/*', blockEnd: '*/' },
  java: { line: '//', blockStart: '/*', blockEnd: '*/' },
  c: { line: '//', blockStart: '/*', blockEnd: '*/' },
  cpp: { line: '//', blockStart: '/*', blockEnd: '*/' },
  unknown: {},
};

export function detectLanguage(filePath: string): Language {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return LANGUAGE_EXTENSIONS[ext] || 'unknown';
}

export function filterMinimal(content: string, language: Language): string {
  if (language === 'unknown') {
    return content;
  }

  const patterns = COMMENT_PATTERNS[language];
  const lines = content.split('\n');
  const result: string[] = [];
  let inBlockComment = false;
  let inDocstring = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Handle Python docstrings
    if (language === 'python' && patterns.docComment) {
      if (trimmed.startsWith(patterns.docComment)) {
        inDocstring = !inDocstring;
        result.push(line);
        continue;
      }
      if (inDocstring) {
        result.push(line);
        continue;
      }
    }

    // Handle block comments
    if (patterns.blockStart && trimmed.startsWith(patterns.blockStart)) {
      inBlockComment = true;
    }

    if (inBlockComment) {
      if (patterns.blockEnd && trimmed.endsWith(patterns.blockEnd)) {
        inBlockComment = false;
      }
      continue; // Skip block comment content
    }

    // Handle single-line comments
    if (patterns.line) {
      const commentIndex = line.indexOf(patterns.line);
      if (commentIndex >= 0) {
        // Preserve doc comments for Rust (///)
        if (language === 'rust' && line.trim().startsWith('///')) {
          result.push(line);
          continue;
        }
        // Remove the comment but keep the code before it
        const code = line.slice(0, commentIndex).trimEnd();
        if (code) {
          result.push(code);
        } else {
          // Empty line after removing comment
          result.push('');
        }
        continue;
      }
    }

    result.push(line);
  }

  // Normalize multiple blank lines to max 2
  let normalized = result.join('\n');
  normalized = normalized.replace(/\n{3,}/g, '\n\n');

  return normalized.trim();
}

export function filterAggressive(content: string, language: Language): string {
  // First apply minimal filtering
  const minimal = filterMinimal(content, language);

  if (language === 'unknown') {
    return minimal;
  }

  const lines = minimal.split('\n');
  const result: string[] = [];
  let braceDepth = 0;
  let inImplementation = false;

  // Patterns to preserve
  const importPattern =
    /^(?:use |import |from |require\(|#include|const .*= require\(|package |import\()/;
  const signaturePattern =
    /^(?:pub\s+)?(?:async\s+)?(?:fn|def|function|func|class|struct|enum|trait|interface|type)\s+\w+/;
  const exportPattern = /^(?:export\s+|module\s+|pub\s+)/;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines in aggressive mode
    if (!trimmed) {
      continue;
    }

    // Always keep imports/exports
    if (importPattern.test(trimmed) || exportPattern.test(trimmed)) {
      result.push(line);
      continue;
    }

    // Keep signatures
    if (signaturePattern.test(trimmed)) {
      result.push(line);
      inImplementation = true;
      braceDepth = 0;
      continue;
    }

    // Track brace depth for function bodies
    if (inImplementation) {
      const openBraces = (trimmed.match(/\{/g) || []).length;
      const closeBraces = (trimmed.match(/\}/g) || []).length;
      braceDepth += openBraces - closeBraces;

      // Keep opening brace
      if (trimmed === '{' || trimmed.endsWith('{')) {
        result.push('    // ...');
      }

      // Keep closing brace when we exit
      if (braceDepth <= 0 && trimmed === '}') {
        result.push(line);
        inImplementation = false;
      }

      continue;
    }

    // Keep constants and type definitions
    if (
      trimmed.startsWith('const ') ||
      trimmed.startsWith('static ') ||
      trimmed.startsWith('let ') ||
      trimmed.startsWith('pub const ') ||
      trimmed.startsWith('pub static ') ||
      trimmed.startsWith('type ')
    ) {
      result.push(line);
    }
  }

  return result.join('\n').trim();
}

// Patterns for "important" lines (signatures, imports, braces)
const IMPORTANT_PATTERNS = [
  /^(?:use |import |from |#include|package |const .*= require)/,
  /^(?:pub\s+)?(?:async\s+)?(?:fn|def|function|func|class|struct|enum|trait|interface|type)\s+\w+/,
  /^\{|\}$/,
  /^(?:export|module|pub)\s+/,
];

function isImportantLine(line: string): boolean {
  const trimmed = line.trim();
  return IMPORTANT_PATTERNS.some((p) => p.test(trimmed));
}

export function smartTruncate(content: string, maxLines: number): string {
  const lines = content.split('\n');
  if (lines.length <= maxLines) {
    return content;
  }

  const result: string[] = [];
  let keptLines = 0;
  let skippedSection = false;

  for (let i = 0; i < lines.length && keptLines < maxLines - 1; i++) {
    const line = lines[i];
    const isImportant = isImportantLine(line);

    // Keep important lines and first half of maxLines
    if (isImportant || keptLines < maxLines / 2) {
      if (skippedSection) {
        const omitted = i - result.length;
        result.push(`    // ... ${omitted} lines omitted`);
        skippedSection = false;
      }
      result.push(line);
      keptLines++;
    } else {
      skippedSection = true;
    }
  }

  // Add final truncation marker if needed
  if (result.length < lines.length) {
    const omitted = lines.length - result.length;
    result.push(`// ... ${omitted} more lines (total: ${lines.length})`);
  }

  return result.join('\n');
}
