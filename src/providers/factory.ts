import type { AIProvider } from './types.js';
import type { ProviderName } from '../types/debate.js';
import { CodexProvider } from './codex.js';
import { ClaudeProvider } from './claude.js';
import { loadConfig, resolveCommands } from '../config/manager.js';

export interface ProviderPair {
  codex: AIProvider;
  claude: AIProvider;
}

export function createProviders(): ProviderPair {
  const config = loadConfig();
  const commands = resolveCommands(config);

  if (!commands.codexCommand.trim() || !commands.claudeCommand.trim()) {
    throw new Error(
      'Codex or Claude command is not configured. Run "fight-for-me config list" and set codexCommand / claudeCommand.'
    );
  }

  return {
    codex: new CodexProvider(commands.codexCommand, commands.commandTimeoutMs),
    claude: new ClaudeProvider(commands.claudeCommand, commands.commandTimeoutMs),
  };
}

export function createApplyProvider(providerName: ProviderName): AIProvider {
  const config = loadConfig();
  const commands = resolveCommands(config);

  if (providerName === 'codex') {
    return new CodexProvider(commands.codexCommand, commands.applyTimeoutMs);
  }
  return new ClaudeProvider(commands.claudeApplyCommand, commands.applyTimeoutMs);
}
