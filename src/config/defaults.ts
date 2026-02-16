export interface AppConfig {
  codexCommand: string;
  claudeCommand: string;
  commandTimeoutMs: number;
  defaultRounds: number;
  defaultJudge: 'codex' | 'claude' | 'both';
  defaultFormat: 'pretty' | 'json' | 'markdown';
  stream: boolean;
  codexModel: string;
  claudeModel: string;
  claudeApplyCommand: string;
  applyTimeoutMs: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  codexCommand: 'codex exec --skip-git-repo-check -',
  claudeCommand: 'claude -p',
  commandTimeoutMs: 180000,
  defaultRounds: 3,
  defaultJudge: 'claude',
  defaultFormat: 'pretty',
  stream: true,
  codexModel: '',
  claudeModel: '',
  claudeApplyCommand: 'claude -p --allowedTools "Edit Write Bash Read"',
  applyTimeoutMs: 300_000,
};
