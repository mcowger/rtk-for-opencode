// RTK for OpenCode - Token reduction plugin
// Re-exports the plugin for npm consumers

export { RtkPlugin, default } from './plugin.ts';
export type { RtkConfig, FilterLevel } from './config.ts';
export type { MetricRecord } from './metrics.ts';

// Re-export technique functions for advanced users
export * from './techniques/index.ts';
