import { appendFile, mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';

export interface MetricRecord {
  timestamp: string;
  sessionId: string;
  tool: string;
  technique: string;
  originalChars: number;
  filteredChars: number;
  savingsPercent: number;
}

export function estimateTokens(text: string): number {
  // Approximate token count using whitespace and punctuation splitting
  // This is a rough approximation - actual LLM tokenizers vary
  const words = text.split(/[\s\p{P}]+/u).filter(Boolean);
  return Math.round(words.length * 0.75);
}

export function calculateSavings(originalChars: number, filteredChars: number): number {
  if (originalChars === 0) return 0;
  const savings = ((originalChars - filteredChars) / originalChars) * 100;
  return Math.round(savings * 100) / 100; // Round to 2 decimal places
}

export async function appendMetric(record: MetricRecord, metricsPath: string): Promise<void> {
  const dir = dirname(metricsPath);
  await mkdir(dir, { recursive: true });

  const line = JSON.stringify(record) + '\n';
  await appendFile(metricsPath, line, 'utf-8');
}

export function formatSessionSummary(records: MetricRecord[]): string {
  if (records.length === 0) {
    return 'RTK: No token savings this session';
  }

  const totalOriginal = records.reduce((sum, r) => sum + r.originalChars, 0);
  const totalFiltered = records.reduce((sum, r) => sum + r.filteredChars, 0);
  const totalSavings = calculateSavings(totalOriginal, totalFiltered);
  const byTechnique = records.reduce(
    (acc, r) => {
      if (!acc[r.technique]) {
        acc[r.technique] = { count: 0, original: 0, filtered: 0 };
      }
      acc[r.technique].count++;
      acc[r.technique].original += r.originalChars;
      acc[r.technique].filtered += r.filteredChars;
      return acc;
    },
    {} as Record<string, { count: number; original: number; filtered: number }>
  );

  let summary = `RTK Session Summary: ${totalSavings.toFixed(1)}% savings\n`;
  summary += `  Total: ${formatBytes(totalOriginal)} → ${formatBytes(totalFiltered)}\n`;
  summary += `  Techniques used:\n`;

  for (const [technique, data] of Object.entries(byTechnique)) {
    const pct = calculateSavings(data.original, data.filtered);
    summary += `    ${technique}: ${data.count}×, ${pct.toFixed(1)}% saved\n`;
  }

  return summary.trim();
}

function formatBytes(chars: number): string {
  if (chars < 1024) return `${chars} chars`;
  const kb = chars / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export function getMetricsPath(directory: string): string {
  return resolve(directory, '.memory', 'rtk-metrics.jsonl');
}
