export interface AppConfig {
  codexCommand: string;
  claudeCommand: string;
  geminiCommand: string;
  commandTimeoutMs: number;
  defaultRounds: number;
  defaultJudge: string;
  defaultFormat: 'pretty' | 'json' | 'markdown';
  stream: boolean;
  codexModel: string;
  claudeModel: string;
  geminiModel: string;
  claudeApplyCommand: string;
  applyTimeoutMs: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  codexCommand: 'codex exec --skip-git-repo-check -',
  claudeCommand: 'claude -p',
  geminiCommand: 'gemini -p {prompt}',
  commandTimeoutMs: 180000,
  defaultRounds: 3,
  defaultJudge: 'claude',
  defaultFormat: 'pretty',
  stream: true,
  codexModel: '',
  claudeModel: '',
  geminiModel: '',
  claudeApplyCommand: 'claude -p --allowedTools "Edit Write Bash Read"',
  applyTimeoutMs: 300_000,
};

// --- ConfigV2 (기존 AppConfig는 유지) ---

export interface ProviderCapabilities {
  supportsStreaming: boolean;
  maxContextTokens: number;
}

export interface ProviderConfig {
  type: 'ollama-compat' | 'anthropic' | 'cli';
  baseUrl?: string;
  apiKeyEnvVar?: string;   // 환경변수 이름 (평문 저장 금지)
  apiKey?: string;         // 테스트/로컬 용도 (권장: env var)
  openaiApiKey?: string;   // cloud provider 편의 alias
  openai_api_key?: string; // cloud provider 편의 alias (snake_case)
  ollamaApiKey?: string;   // ollama cloud key alias
  ollama_api_key?: string; // ollama cloud key alias (snake_case)
  command?: string;        // CLI 타입 전용
  model: string;
  capabilities: ProviderCapabilities;
}

export interface DebateConfig {
  defaultRounds: number;
  defaultJudge: string;
  defaultFormat: 'pretty' | 'json' | 'markdown';
  stream: boolean;
  commandTimeoutMs: number;
  applyTimeoutMs: number;
}

export interface DashboardConfig {
  port: number;    // default: 3847
  host: string;   // default: '127.0.0.1'
  corsOrigin: string[];
}

export interface NewsProviderConfig {
  brave: { enabled: boolean };
  newsapi: { enabled: boolean };
  rss: { enabled: boolean; feeds: string[] };
}

export interface NewsConfig {
  providers: NewsProviderConfig;
  maxArticlesPerProvider: number;
  deduplication: boolean;
}

export interface ConfigV2 {
  version: 2;
  providers: Record<string, ProviderConfig>;
  defaultProvider?: string;
  debate: DebateConfig;
  dashboard?: DashboardConfig;
  news?: NewsConfig;
}

export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  port: 3847,
  host: '127.0.0.1',
  corsOrigin: ['http://localhost:3847'],
};

export const DEFAULT_NEWS_CONFIG: NewsConfig = {
  providers: {
    brave: { enabled: true },
    newsapi: { enabled: false },
    rss: { enabled: false, feeds: [] },
  },
  maxArticlesPerProvider: 10,
  deduplication: true,
};
