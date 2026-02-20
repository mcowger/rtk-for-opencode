import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { loadConfig, DEFAULT_CONFIG, mergeConfig, FilterLevel } from '../src/config.ts';

describe('config', () => {
  const testDir = join(process.cwd(), '.memory', 'test-config');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('DEFAULT_CONFIG', () => {
    it('has expected defaults', () => {
      expect(DEFAULT_CONFIG.enabled).toBe(true);
      expect(DEFAULT_CONFIG.logSavings).toBe(true);
      expect(DEFAULT_CONFIG.techniques.ansiStripping).toBe(true);
      expect(DEFAULT_CONFIG.techniques.truncation.maxChars).toBe(10000);
      expect(DEFAULT_CONFIG.techniques.sourceCodeFiltering).toBe('minimal');
      expect(DEFAULT_CONFIG.techniques.smartTruncation.maxLines).toBe(200);
    });
  });

  describe('mergeConfig', () => {
    it('preserves base values when no override', () => {
      const result = mergeConfig(DEFAULT_CONFIG, {});
      expect(result).toEqual(DEFAULT_CONFIG);
    });

    it('overrides top-level values', () => {
      const result = mergeConfig(DEFAULT_CONFIG, { enabled: false });
      expect(result.enabled).toBe(false);
      expect(result.logSavings).toBe(true); // unchanged
    });

    it('merges nested technique config', () => {
      const result = mergeConfig(DEFAULT_CONFIG, {
        techniques: {
          ansiStripping: false,
        },
      });
      expect(result.techniques.ansiStripping).toBe(false);
      expect(result.techniques.buildOutputFiltering).toBe(true); // unchanged
    });

    it('deep merges truncation settings', () => {
      const result = mergeConfig(DEFAULT_CONFIG, {
        techniques: {
          truncation: { maxChars: 5000 },
        },
      });
      expect(result.techniques.truncation.maxChars).toBe(5000);
      expect(result.techniques.truncation.enabled).toBe(true); // unchanged
    });

    it('deep merges smartTruncation settings', () => {
      const result = mergeConfig(DEFAULT_CONFIG, {
        techniques: {
          smartTruncation: { maxLines: 100 },
        },
      });
      expect(result.techniques.smartTruncation.maxLines).toBe(100);
      expect(result.techniques.smartTruncation.enabled).toBe(true); // unchanged
    });
  });

  describe('loadConfig', () => {
    it('returns DEFAULT_CONFIG when config file does not exist', async () => {
      const config = await loadConfig(testDir);
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('loads custom config from file', async () => {
      const opencodeDir = join(testDir, '.opencode');
      await mkdir(opencodeDir, { recursive: true });
      await writeFile(
        join(opencodeDir, 'rtk-config.json'),
        JSON.stringify({ enabled: false, logSavings: false })
      );

      const config = await loadConfig(testDir);
      expect(config.enabled).toBe(false);
      expect(config.logSavings).toBe(false);
      expect(config.techniques.ansiStripping).toBe(true); // from defaults
    });

    it('merges nested technique settings from file', async () => {
      const opencodeDir = join(testDir, '.opencode');
      await mkdir(opencodeDir, { recursive: true });
      await writeFile(
        join(opencodeDir, 'rtk-config.json'),
        JSON.stringify({
          techniques: {
            sourceCodeFiltering: 'aggressive' as FilterLevel,
            truncation: { maxChars: 5000 },
          },
        })
      );

      const config = await loadConfig(testDir);
      expect(config.techniques.sourceCodeFiltering).toBe('aggressive');
      expect(config.techniques.truncation.maxChars).toBe(5000);
      expect(config.techniques.truncation.enabled).toBe(true); // from defaults
    });

    it('gracefully handles invalid JSON', async () => {
      const opencodeDir = join(testDir, '.opencode');
      await mkdir(opencodeDir, { recursive: true });
      await writeFile(join(opencodeDir, 'rtk-config.json'), 'invalid json');

      const config = await loadConfig(testDir);
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it('gracefully handles missing .opencode directory', async () => {
      const config = await loadConfig(testDir);
      expect(config).toEqual(DEFAULT_CONFIG);
    });
  });
});
