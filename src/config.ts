import { readFile } from 'fs/promises';
import { resolve } from 'path';

export type FilterLevel = 'none' | 'minimal' | 'aggressive';

export interface RtkConfig {
  enabled: boolean;
  logSavings: boolean;
  showUpdateEvery: number;
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
  showUpdateEvery: 10,
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
  const rawShowUpdateEvery = override.showUpdateEvery;
  const showUpdateEvery =
    typeof rawShowUpdateEvery === 'number' && Number.isInteger(rawShowUpdateEvery)
      ? Math.max(0, rawShowUpdateEvery)
      : base.showUpdateEvery;

  return {
    ...base,
    ...override,
    showUpdateEvery,
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
