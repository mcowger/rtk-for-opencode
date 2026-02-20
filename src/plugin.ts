import type { Plugin } from '@opencode-ai/plugin';
import { loadConfig } from './config.ts';
import {
  getMetricsPath,
  appendMetric,
  formatSessionSummary,
  formatToastSummary,
  MetricRecord,
} from './metrics.ts';
import { stripAnsiFast } from './techniques/ansi.ts';
import { truncate } from './techniques/truncate.ts';
import {
  filterBuildOutput,
  aggregateTestOutput,
  aggregateLinterOutput,
  detectLanguage,
  filterMinimal,
  filterAggressive,
  smartTruncate,
  compactGitOutput,
  groupSearchResults,
} from './techniques/index.ts';

export const RtkPlugin: Plugin = async ({ directory, client }) => {
  const config = await loadConfig(directory);
  const sessionMetrics: MetricRecord[] = [];
  const idleTurnCounts = new Map<string, number>();
  const metricsPath = getMetricsPath(directory);
  const handledCommandError = '__RTK_COMMAND_HANDLED__';

  function resolveSessionID(value: { sessionID?: unknown; sessionId?: unknown }): string | null {
    if (typeof value.sessionID === 'string' && value.sessionID.length > 0) {
      return value.sessionID;
    }

    if (typeof value.sessionId === 'string' && value.sessionId.length > 0) {
      return value.sessionId;
    }

    return null;
  }

  type CommandConfig = {
    template: string;
    description: string;
  };

  type RuntimeConfig = {
    command?: Record<string, CommandConfig>;
  };

  if (!config.enabled) {
    return {};
  }

  async function recordAndLog(
    original: string,
    filtered: string,
    tool: string,
    technique: string,
    sessionId: string
  ): Promise<void> {
    const originalChars = original.length;
    const filteredChars = filtered.length;
    const savingsPercent =
      originalChars > 0
        ? Math.round(((originalChars - filteredChars) / originalChars) * 100 * 100) / 100
        : 0;

    const record: MetricRecord = {
      timestamp: new Date().toISOString(),
      sessionId,
      tool,
      technique,
      originalChars,
      filteredChars,
      savingsPercent,
    };

    sessionMetrics.push(record);

    if (config.logSavings && savingsPercent > 0) {
      await client.app.log({
        body: {
          service: 'rtk-plugin',
          level: 'info',
          message: `${technique}: ${savingsPercent.toFixed(1)}% savings (${originalChars} → ${filteredChars} chars)`,
          extra: { tool, technique, savingsPercent },
        },
      });
    }

    await appendMetric(record, metricsPath);
  }

  return {
    config: async (runtimeConfig) => {
      const cfg = runtimeConfig as RuntimeConfig;
      cfg.command ??= {};
      cfg.command.rtk = {
        template: '/rtk',
        description: 'Show RTK token savings summary for this session',
      };
    },

    'command.execute.before': async (input: {
      command: string;
      sessionID: string;
      arguments: string;
    }) => {
      if (input.command !== 'rtk') {
        return;
      }

      const sessionID = resolveSessionID(input);
      const records = sessionMetrics.filter((record) => record.sessionId === sessionID);

      await client.tui.showToast({
        body: {
          title: 'RTK Savings',
          message: formatToastSummary(records),
          variant: 'info',
        },
      });

      throw new Error(handledCommandError);
    },

    'tool.execute.after': async (input, output) => {
      // Guard: no output to process
      if (!output.output || typeof output.output !== 'string') {
        return;
      }

      const original = output.output;
      let result = original;
      let technique: string | null = null;

      try {
        // Phase 1: ANSI stripping (applies to all tools)
        if (config.techniques.ansiStripping) {
          const stripped = stripAnsiFast(result);
          if (stripped !== result) {
            result = stripped;
            technique = 'ansi-stripping';
          }
        }

        // Phase 2: Command-specific filters (bash tool only)
        const toolArgs = input as { args?: { command?: unknown; filePath?: unknown } };

        if (input.tool === 'bash' && toolArgs.args?.command) {
          const command = String(toolArgs.args.command);

          // Build output filtering
          if (config.techniques.buildOutputFiltering) {
            const filtered = filterBuildOutput(result, command);
            if (filtered !== null && filtered !== result) {
              result = filtered;
              technique = technique ? `${technique},build-filter` : 'build-filter';
            }
          }

          // Test output aggregation
          if (config.techniques.testOutputAggregation) {
            const filtered = aggregateTestOutput(result, command);
            if (filtered !== null && filtered !== result) {
              result = filtered;
              technique = technique ? `${technique},test-aggregate` : 'test-aggregate';
            }
          }

          // Linter output aggregation
          if (config.techniques.linterAggregation) {
            const filtered = aggregateLinterOutput(result, command);
            if (filtered !== null && filtered !== result) {
              result = filtered;
              technique = technique ? `${technique},linter-aggregate` : 'linter-aggregate';
            }
          }

          // Git compaction
          if (config.techniques.gitCompaction) {
            const filtered = compactGitOutput(result, command);
            if (filtered !== null && filtered !== result) {
              result = filtered;
              technique = technique ? `${technique},git-compact` : 'git-compact';
            }
          }

          // Search result grouping
          if (config.techniques.searchResultGrouping) {
            const filtered = groupSearchResults(result);
            if (filtered !== null && filtered !== result) {
              result = filtered;
              technique = technique ? `${technique},search-group` : 'search-group';
            }
          }
        }

        // Phase 3: Source code filtering (read tool only)
        if (input.tool === 'read' && toolArgs.args?.filePath) {
          const filePath = String(toolArgs.args.filePath);
          const language = detectLanguage(filePath);

          if (language !== 'unknown' && config.techniques.sourceCodeFiltering !== 'none') {
            // Apply source code filtering
            if (config.techniques.sourceCodeFiltering === 'minimal') {
              const filtered = filterMinimal(result, language);
              if (filtered !== result) {
                result = filtered;
                technique = technique ? `${technique},source-minimal` : 'source-minimal';
              }
            } else if (config.techniques.sourceCodeFiltering === 'aggressive') {
              const filtered = filterAggressive(result, language);
              if (filtered !== result) {
                result = filtered;
                technique = technique ? `${technique},source-aggressive` : 'source-aggressive';
              }
            }

            // Apply smart truncation
            if (config.techniques.smartTruncation.enabled) {
              const lines = result.split('\n');
              if (lines.length > config.techniques.smartTruncation.maxLines) {
                result = smartTruncate(result, config.techniques.smartTruncation.maxLines);
                technique = technique ? `${technique},smart-truncate` : 'smart-truncate';
              }
            }
          }
        }

        // Phase 1: Hard truncation (applies to all tools) - do this last
        if (
          config.techniques.truncation.enabled &&
          result.length > config.techniques.truncation.maxChars
        ) {
          result = truncate(result, config.techniques.truncation.maxChars);
          technique = technique ? `${technique},truncate` : 'truncate';
        }

        // Record if anything changed
        if (result !== original) {
          const sessionID = resolveSessionID(input);
          if (!sessionID) {
            return;
          }

          output.output = result;
          await recordAndLog(original, result, input.tool, technique || 'unknown', sessionID);
        }
      } catch (error) {
        // Tier 3 passthrough: log error but preserve original output
        await client.app.log({
          body: {
            service: 'rtk-plugin',
            level: 'warn',
            message: `Filter error for ${input.tool}: ${error instanceof Error ? error.message : String(error)}`,
          },
        });
      }
    },

    event: async ({ event }) => {
      if (event.type !== 'session.idle') {
        return;
      }

      const sessionID = resolveSessionID(
        event.properties as { sessionID?: unknown; sessionId?: unknown }
      );
      if (!sessionID) {
        return;
      }

      const sessionRecords = sessionMetrics.filter((record) => record.sessionId === sessionID);
      if (sessionRecords.length === 0) {
        return;
      }

      if (config.logSavings) {
        await client.app.log({
          body: {
            service: 'rtk-plugin',
            level: 'info',
            message: formatSessionSummary(sessionRecords),
          },
        });
      }

      const turns = (idleTurnCounts.get(sessionID) || 0) + 1;
      idleTurnCounts.set(sessionID, turns);

      if (config.showUpdateEvery > 0 && turns % config.showUpdateEvery === 0) {
        await client.tui.showToast({
          body: {
            title: 'RTK Savings',
            message: formatToastSummary(sessionRecords),
            variant: 'info',
          },
        });
      }
    },
  };
};

export default RtkPlugin;
