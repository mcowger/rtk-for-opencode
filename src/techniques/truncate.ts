export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  if (maxChars < 3) {
    return '...';
  }

  const truncated = text.slice(0, maxChars - 3);
  const omitted = text.length - (maxChars - 3);
  return `${truncated}\n... [truncated: ${omitted} chars omitted]`;
}
