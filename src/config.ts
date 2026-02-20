import { readFile } from 'fs/promises';
import { resolve } from 'path';

export type FilterLevel = 'none' | 'minimal' | 'aggressive';

export interface RtkConfig {
  enabled: boolean;
  logSavings: boolean;
  techniques: {
    ansiStripping: boolean;
    truncation: { enabled: boolean; maxChars: number };
    sourceCodeFiltering: FilterLevel;
    smartTruncation: { enabled: boolean; maxLines: number };
    testOutputAggregation: boolean;
    buildOutputFiltering: boolean;
    gitCompaction: boolean;
    searchResultGrouping: boolean;
    linterAggregation: boolean;
  };
}

export const DEFAULT_CONFIG: RtkConfig = {
  enabled: true,
  logSavings: true,
  techniques: {
    ansiStripping: true,
    truncation: { enabled: true, maxChars: 10000 },
    sourceCodeFiltering: 'minimal',
    smartTruncation: { enabled: true, maxLines: 200 },
    testOutputAggregation: true,
    buildOutputFiltering: true,
    gitCompaction: true,
    searchResultGrouping: true,
    linterAggregation: true,
  },
};

export function mergeConfig(base: RtkConfig, override: Partial<RtkConfig>): RtkConfig {
  return {
    ...base,
    ...override,
    techniques: {
      ...base.techniques,
      ...(override.techniques || {}),
      truncation: {
        ...base.techniques.truncation,
        ...(override.techniques?.truncation || {}),
      },
      smartTruncation: {
        ...base.techniques.smartTruncation,
        ...(override.techniques?.smartTruncation || {}),
      },
    },
  };
}

export async function loadConfig(directory: string): Promise<RtkConfig> {
  const configPath = resolve(directory, '.opencode', 'rtk-config.json');

  try {
    const content = await readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content) as Partial<RtkConfig>;
    return mergeConfig(DEFAULT_CONFIG, parsed);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      // Config file doesn't exist, use defaults
      return DEFAULT_CONFIG;
    }
    // For any other error (parse error, permission denied, etc.), log warning and use defaults
    return DEFAULT_CONFIG;
  }
}
