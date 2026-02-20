import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import {
  estimateTokens,
  calculateSavings,
  appendMetric,
  formatSessionSummary,
  getMetricsPath,
  MetricRecord,
} from '../src/metrics.ts';

describe('metrics', () => {
  const testDir = join(process.cwd(), '.memory', 'test-metrics');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('estimateTokens', () => {
    it('returns 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('approximates tokens for simple text', () => {
      expect(estimateTokens('hello world')).toBe(2);
    });

    it('handles punctuation as word boundaries', () => {
      expect(estimateTokens('hello, world!')).toBe(2);
    });

    it('handles code with many tokens', () => {
      const code = 'function test() { return 42; }';
      expect(estimateTokens(code)).toBe(3);
    });
  });

  describe('calculateSavings', () => {
    it('returns 0 when original is 0', () => {
      expect(calculateSavings(0, 0)).toBe(0);
    });

    it('calculates 50% savings', () => {
      expect(calculateSavings(100, 50)).toBe(50);
    });

    it('calculates 0% savings when no change', () => {
      expect(calculateSavings(100, 100)).toBe(0);
    });

    it('handles fractional percentages', () => {
      expect(calculateSavings(100, 33)).toBe(67);
    });
  });

  describe('appendMetric', () => {
    it('creates file and directory if they do not exist', async () => {
      const metricsPath = join(testDir, 'subdir', 'metrics.jsonl');
      const record: MetricRecord = {
        timestamp: new Date().toISOString(),
        sessionId: 'test-1',
        tool: 'bash',
        technique: 'ansi-stripping',
        originalChars: 100,
        filteredChars: 80,
        savingsPercent: 20,
      };

      await appendMetric(record, metricsPath);

      const content = await readFile(metricsPath, 'utf-8');
      const parsed = JSON.parse(content.trim()) as MetricRecord;
      expect(parsed.sessionId).toBe('test-1');
      expect(parsed.technique).toBe('ansi-stripping');
    });

    it('appends multiple records as JSON lines', async () => {
      const metricsPath = join(testDir, 'metrics.jsonl');
      const record1: MetricRecord = {
        timestamp: new Date().toISOString(),
        sessionId: 'test-1',
        tool: 'bash',
        technique: 'ansi-stripping',
        originalChars: 100,
        filteredChars: 80,
        savingsPercent: 20,
      };
      const record2: MetricRecord = {
        timestamp: new Date().toISOString(),
        sessionId: 'test-1',
        tool: 'read',
        technique: 'source-filtering',
        originalChars: 500,
        filteredChars: 250,
        savingsPercent: 50,
      };

      await appendMetric(record1, metricsPath);
      await appendMetric(record2, metricsPath);

      const content = await readFile(metricsPath, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(2);

      const parsed1 = JSON.parse(lines[0]) as MetricRecord;
      expect(parsed1.technique).toBe('ansi-stripping');

      const parsed2 = JSON.parse(lines[1]) as MetricRecord;
      expect(parsed2.technique).toBe('source-filtering');
    });
  });

  describe('formatSessionSummary', () => {
    it('returns message when no records', () => {
      const summary = formatSessionSummary([]);
      expect(summary).toBe('RTK: No token savings this session');
    });

    it('summarizes a single record', () => {
      const records: MetricRecord[] = [
        {
          timestamp: '2024-01-01T00:00:00.000Z',
          sessionId: 'test',
          tool: 'bash',
          technique: 'ansi-stripping',
          originalChars: 1000,
          filteredChars: 800,
          savingsPercent: 20,
        },
      ];
      const summary = formatSessionSummary(records);
      expect(summary).toContain('20.0% savings');
      expect(summary).toContain('1000 chars');
      expect(summary).toContain('ansi-stripping');
    });

    it('aggregates multiple records by technique', () => {
      const records: MetricRecord[] = [
        {
          timestamp: '2024-01-01T00:00:00.000Z',
          sessionId: 'test',
          tool: 'bash',
          technique: 'ansi-stripping',
          originalChars: 1000,
          filteredChars: 800,
          savingsPercent: 20,
        },
        {
          timestamp: '2024-01-01T00:00:00.000Z',
          sessionId: 'test',
          tool: 'bash',
          technique: 'ansi-stripping',
          originalChars: 500,
          filteredChars: 400,
          savingsPercent: 20,
        },
      ];
      const summary = formatSessionSummary(records);
      expect(summary).toContain('ansi-stripping: 2');
    });
  });

  describe('getMetricsPath', () => {
    it('returns correct path', () => {
      const path = getMetricsPath('/project');
      expect(path).toBe('/project/.memory/rtk-metrics.jsonl');
    });
  });
});
