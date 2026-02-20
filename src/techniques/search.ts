// Search result grouping (RTK Technique #7)
// Groups grep/search results by file for compact display

interface SearchResult {
  file: string;
  lineNumber: number;
  content: string;
}

const SEARCH_COMMANDS = ['grep', 'rg', 'ag', 'ack', 'find'];

export function isSearchCommand(command: string): boolean {
  const cmdLower = command.toLowerCase();
  return SEARCH_COMMANDS.some((sc) => cmdLower.includes(sc));
}

// Parse grep output: file:line:content or file-line-content formats
function parseGrepResults(output: string): SearchResult[] {
  const results: SearchResult[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    // Standard grep format: file:line:content
    const match = line.match(/^(.+):(\d+):(.*)$/);
    if (match) {
      results.push({
        file: match[1],
        lineNumber: parseInt(match[2], 10),
        content: match[3],
      });
      continue;
    }

    // Alternative format with hyphen: file-line-content
    const altMatch = line.match(/^(.+)-(\d+)-(.*)$/);
    if (altMatch) {
      results.push({
        file: altMatch[1],
        lineNumber: parseInt(altMatch[2], 10),
        content: altMatch[3],
      });
    }
  }

  return results;
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

export function groupSearchResults(
  output: string,
  maxResults: number = 30,
  maxPerFile: number = 10
): string | null {
  // If output doesn't look like search results, return null
  if (!output.includes(':') || output.length < 50) {
    return null;
  }

  const results = parseGrepResults(output);

  if (results.length === 0) {
    // Couldn't parse, might not be search output
    return null;
  }

  // Group by file
  const byFile: Map<string, SearchResult[]> = new Map();
  for (const result of results) {
    if (!byFile.has(result.file)) {
      byFile.set(result.file, []);
    }
    byFile.get(result.file)?.push(result);
  }

  // Build output
  const files = Array.from(byFile.keys()).sort();
  const result: string[] = [`🔍 ${results.length} matches in ${files.length} files:\n`];

  let shown = 0;

  for (const file of files) {
    if (shown >= maxResults) {
      break;
    }

    const matches = byFile.get(file) || [];
    const compactFile = compactPath(file);
    result.push(`📄 ${compactFile} (${matches.length} matches):`);

    for (const match of matches.slice(0, maxPerFile)) {
      let content = match.content.trim();
      if (content.length > 70) {
        content = content.slice(0, 67) + '...';
      }
      result.push(`    ${match.lineNumber}: ${content}`);
      shown++;
    }

    if (matches.length > maxPerFile) {
      result.push(`  +${matches.length - maxPerFile} more`);
    }

    result.push('');
  }

  if (shown < results.length) {
    result.push(`... +${results.length - shown} more matches`);
  }

  return result.join('\n');
}
