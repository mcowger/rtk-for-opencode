import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import type { PluginInput } from '@opencode-ai/plugin';
import { RtkPlugin } from '../src/plugin.ts';

describe('plugin', () => {
  const testDir = join(process.cwd(), '.memory', 'test-plugin');

  beforeEach(async () => {
    await mkdir(join(testDir, '.opencode'), { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('registers /rtk command via config hook', async () => {
    const client = {
      app: { log: vi.fn().mockResolvedValue(true) },
      tui: { showToast: vi.fn().mockResolvedValue(true) },
    };

    const hooks = await RtkPlugin({ directory: testDir, client } as unknown as PluginInput);
    expect(hooks.config).toBeDefined();

    const runtimeConfig: Record<string, unknown> = {};
    await hooks.config?.(runtimeConfig as never);

    const command = (runtimeConfig.command as Record<string, { template: string }>).rtk;
    expect(command).toBeDefined();
    expect(command.template).toBe('/rtk');
  });

  it('handles /rtk command without calling the model', async () => {
    const client = {
      app: { log: vi.fn().mockResolvedValue(true) },
      tui: { showToast: vi.fn().mockResolvedValue(true) },
    };

    const hooks = await RtkPlugin({ directory: testDir, client } as unknown as PluginInput);
    const commandBefore = (hooks as unknown as Record<string, unknown>)['command.execute.before'];
    expect(commandBefore).toBeDefined();

    await expect(
      (commandBefore as Function)({
        command: 'rtk',
        sessionID: 'ses_test',
        arguments: '',
      } as never)
    ).rejects.toThrow('__RTK_COMMAND_HANDLED__');

    expect(client.tui.showToast).toHaveBeenCalledTimes(1);
  });

  it('shows periodic toasts every N idle turns per session', async () => {
    await writeFile(
      join(testDir, '.opencode', 'rtk-config.json'),
      JSON.stringify({
        logSavings: false,
        showUpdateEvery: 2,
      })
    );

    const client = {
      app: { log: vi.fn().mockResolvedValue(true) },
      tui: { showToast: vi.fn().mockResolvedValue(true) },
    };

    const hooks = await RtkPlugin({ directory: testDir, client } as unknown as PluginInput);

    await hooks['tool.execute.after']?.(
      {
        tool: 'bash',
        sessionID: 'ses_a',
        callID: 'call_1',
        args: { command: 'echo hi' },
      } as never,
      {
        title: 'bash',
        output: '\u001b[31mhello\u001b[0m',
        metadata: {},
      } as never
    );

    await hooks.event?.({
      event: { type: 'session.idle', properties: { sessionID: 'ses_a' } },
    } as never);
    await hooks.event?.({
      event: { type: 'session.idle', properties: { sessionID: 'ses_b' } },
    } as never);
    await hooks.event?.({
      event: { type: 'session.idle', properties: { sessionID: 'ses_a' } },
    } as never);

    expect(client.tui.showToast).toHaveBeenCalledTimes(1);
  });
});
