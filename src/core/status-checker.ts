import { execSync } from 'node:child_process';
import { loadConfig, resolveCommands } from '../config/manager.js';

export interface ProviderStatus {
  provider: 'codex' | 'claude' | 'gemini';
  displayName: string;
  cliInstalled: boolean;
  cliBinary: string;
  cliVersion: string;
  configuredCommand: string;
}

function extractBinaryName(command: string): string {
  return command.trim().split(/\s+/)[0];
}

const isWindows = process.platform === 'win32';

function isCliInstalled(binary: string): boolean {
  try {
    const cmd = isWindows ? `where ${binary}` : `which ${binary}`;
    execSync(cmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getCliVersion(binary: string): string {
  try {
    return execSync(`${binary} --version`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    }).trim();
  } catch {
    return 'unknown';
  }
}

function checkProviderStatus(
  provider: 'codex' | 'claude' | 'gemini',
  displayName: string,
  command: string,
): ProviderStatus {
  const binary = extractBinaryName(command);
  const installed = isCliInstalled(binary);

  return {
    provider,
    displayName,
    cliInstalled: installed,
    cliBinary: binary,
    cliVersion: installed ? getCliVersion(binary) : '',
    configuredCommand: command,
  };
}

export function checkAllProviders(): ProviderStatus[] {
  const config = loadConfig();
  const { codexCommand, claudeCommand, geminiCommand } = resolveCommands(config);

  return [
    checkProviderStatus('codex', 'Codex (OpenAI)', codexCommand),
    checkProviderStatus('claude', 'Claude (Anthropic)', claudeCommand),
    checkProviderStatus('gemini', 'Gemini (Google)', geminiCommand),
  ];
}
