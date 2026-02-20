export function stripAnsi(text: string): string {
  // Strip ANSI escape sequences
  // CSI sequences: \x1b[...m, \x1b[...K, etc
  // OSC sequences: \x1b]...\x07
  // Other common patterns
  /* eslint-disable no-control-regex */
  return (
    text
      // CSI sequences (most common: colors, styles)
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      // OSC sequences (titles, hyperlinks)
      .replace(/\x1b\][0-9;]*(?:\x07|\x1b\\)/g, '')
      // Some terminals use ESC] without the bracket for some sequences
      .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
  );
  /* eslint-enable no-control-regex */
}

export function stripAnsiFast(text: string): string {
  // Fast path: check if ANSI codes exist before regex
  if (!text.includes('\x1b')) {
    return text;
  }
  return stripAnsi(text);
}
