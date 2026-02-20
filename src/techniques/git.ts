// Git output compaction (RTK Technique #5)
// Compacts git diff, status, and log outputs

const GIT_COMMANDS = ['git diff', 'git status', 'git log', 'git show', 'git stash'];

export function isGitCommand(command: string): boolean {
  const cmdLower = command.toLowerCase();
  return GIT_COMMANDS.some((gc) => cmdLower.startsWith(gc));
}

export function compactDiff(output: string, maxLines: number = 50): string {
  const lines = output.split('\n');
  const result: string[] = [];
  let currentFile = '';
  let added = 0;
  let removed = 0;
  let inHunk = false;
  let hunkLines = 0;
  const maxHunkLines = 10;

  for (const line of lines) {
    if (result.length >= maxLines) {
      result.push('\n... (more changes truncated)');
      break;
    }

    // New file
    if (line.startsWith('diff --git')) {
      // Flush previous file stats
      if (currentFile && (added > 0 || removed > 0)) {
        result.push(`  +${added} -${removed}`);
      }

      // Extract filename
      const match = line.match(/diff --git a\/(.+) b\/(.+)/);
      currentFile = match ? match[2] : 'unknown';
      result.push(`\n📄 ${currentFile}`);
      added = 0;
      removed = 0;
      inHunk = false;
      continue;
    }

    // Hunk header
    if (line.startsWith('@@')) {
      inHunk = true;
      hunkLines = 0;
      const hunkInfo = line.match(/@@ .+ @@/)?.[0] || '@@';
      result.push(`  ${hunkInfo}`);
      continue;
    }

    // Hunk content
    if (inHunk) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        added++;
        if (hunkLines < maxHunkLines) {
          result.push(`  ${line}`);
          hunkLines++;
        }
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        removed++;
        if (hunkLines < maxHunkLines) {
          result.push(`  ${line}`);
          hunkLines++;
        }
      } else if (hunkLines < maxHunkLines && !line.startsWith('\\')) {
        if (hunkLines > 0) {
          result.push(`  ${line}`);
          hunkLines++;
        }
      }

      if (hunkLines === maxHunkLines) {
        result.push('  ... (truncated)');
        hunkLines++;
      }
    }
  }

  // Flush final file
  if (currentFile && (added > 0 || removed > 0)) {
    result.push(`  +${added} -${removed}`);
  }

  return result.join('\n');
}

interface StatusStats {
  staged: number;
  modified: number;
  untracked: number;
  conflicts: number;
  stagedFiles: string[];
  modifiedFiles: string[];
  untrackedFiles: string[];
}

export function compactStatus(output: string): string {
  const lines = output.split('\n');

  if (lines.length === 0 || (lines.length === 1 && lines[0].trim() === '')) {
    return 'Clean working tree';
  }

  const stats: StatusStats = {
    staged: 0,
    modified: 0,
    untracked: 0,
    conflicts: 0,
    stagedFiles: [],
    modifiedFiles: [],
    untrackedFiles: [],
  };

  let branchName = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Extract branch name from first line
    if (i === 0 && line.startsWith('On branch ')) {
      branchName = line.slice(10);
      continue;
    }

    // Skip empty lines and headers
    if (!line || line.length < 3) {
      continue;
    }

    // Parse porcelain format (XY filename)
    const status = line.slice(0, 2);
    const filename = line.slice(3);

    if (status === '??') {
      stats.untracked++;
      stats.untrackedFiles.push(filename);
    } else {
      const indexStatus = status[0];
      const worktreeStatus = status[1];

      if (['M', 'A', 'D', 'R', 'C'].includes(indexStatus)) {
        stats.staged++;
        stats.stagedFiles.push(filename);
      }

      if (indexStatus === 'U') {
        stats.conflicts++;
      }

      if (['M', 'D'].includes(worktreeStatus)) {
        stats.modified++;
        stats.modifiedFiles.push(filename);
      }
    }
  }

  // Build summary
  const result: string[] = [];
  if (branchName) {
    result.push(`📌 ${branchName}`);
  }

  if (stats.staged > 0) {
    result.push(`✅ Staged: ${stats.staged} files`);
    for (const file of stats.stagedFiles.slice(0, 5)) {
      result.push(`  ${file}`);
    }
    if (stats.stagedFiles.length > 5) {
      result.push(`  ... +${stats.stagedFiles.length - 5} more`);
    }
  }

  if (stats.modified > 0) {
    result.push(`📝 Modified: ${stats.modified} files`);
    for (const file of stats.modifiedFiles.slice(0, 5)) {
      result.push(`  ${file}`);
    }
    if (stats.modifiedFiles.length > 5) {
      result.push(`  ... +${stats.modifiedFiles.length - 5} more`);
    }
  }

  if (stats.untracked > 0) {
    result.push(`❓ Untracked: ${stats.untracked} files`);
    for (const file of stats.untrackedFiles.slice(0, 3)) {
      result.push(`  ${file}`);
    }
    if (stats.untrackedFiles.length > 3) {
      result.push(`  ... +${stats.untrackedFiles.length - 3} more`);
    }
  }

  if (stats.conflicts > 0) {
    result.push(`⚠️  Conflicts: ${stats.conflicts} files`);
  }

  return result.join('\n') || 'Clean working tree';
}

export function compactLog(output: string, limit: number = 20): string {
  const lines = output.split('\n');
  const result: string[] = [];

  for (let i = 0; i < Math.min(lines.length, limit); i++) {
    let line = lines[i];
    if (line.length > 80) {
      line = line.slice(0, 77) + '...';
    }
    result.push(line);
  }

  if (lines.length > limit) {
    result.push(`... +${lines.length - limit} more commits`);
  }

  return result.join('\n');
}

export function compactGitOutput(output: string, command: string): string | null {
  if (!isGitCommand(command)) {
    return null;
  }

  const cmdLower = command.toLowerCase();

  if (cmdLower.includes('diff')) {
    return compactDiff(output);
  }

  if (cmdLower.includes('status')) {
    return compactStatus(output);
  }

  if (cmdLower.includes('log')) {
    return compactLog(output);
  }

  // For other git commands, return as-is for now
  return null;
}
