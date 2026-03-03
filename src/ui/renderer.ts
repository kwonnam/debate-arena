import chalk from 'chalk';
import type {
  DebateCallbacks,
  DebateResult,
  ParticipantName,
  ProviderName,
} from '../types/debate.js';
import { endStream, writeToken } from './streamer.js';

type Style = { color: typeof chalk; label: string };

const KNOWN_PROVIDER_STYLES: Record<string, Style> = {
  codex: { color: chalk.green, label: 'Codex' },
  claude: { color: chalk.magenta, label: 'Claude' },
  gemini: { color: chalk.blue, label: 'Gemini' },
  ollama: { color: chalk.yellow, label: 'Ollama' },
};

const DYNAMIC_STYLE_PALETTE: ReadonlyArray<typeof chalk> = [
  chalk.cyan,
  chalk.yellow,
  chalk.blue,
  chalk.magenta,
  chalk.green,
];

function hashText(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function providerLabel(provider: string): string {
  const known = KNOWN_PROVIDER_STYLES[provider];
  if (known) return known.label;
  return provider;
}

function providerStyle(provider: string): Style {
  const known = KNOWN_PROVIDER_STYLES[provider];
  if (known) return known;

  const color = DYNAMIC_STYLE_PALETTE[hashText(provider) % DYNAMIC_STYLE_PALETTE.length] ?? chalk.white;
  return {
    color,
    label: providerLabel(provider),
  };
}

function participantStyle(provider: ParticipantName): Style {
  if (provider === 'user') {
    return { color: chalk.cyan, label: 'You' };
  }
  return providerStyle(provider);
}

function ruleLine(): string {
  return '-'.repeat(50);
}

export function renderUserTurnStart(): void {
  console.log(chalk.cyan(`\n  You - Your Turn\n`));
}

export function renderUserTurnEnd(content: string): void {
  if (content.trim() === '') {
    console.log(chalk.dim('  (skipped)\n'));
  } else {
    console.log(chalk.cyan(content));
    console.log('');
  }
}

export function createPrettyCallbacks(): DebateCallbacks {
  return {
    onRoundStart(round: number, total: number) {
      console.log(chalk.bold.yellow(`\n${ruleLine()}\n  Round ${round} of ${total}\n${ruleLine()}`));
    },

    onTurnStart(provider: ProviderName, phase: 'opening' | 'rebuttal') {
      const style = providerStyle(provider);
      const phaseLabel = phase === 'opening' ? 'Opening' : 'Rebuttal';
      console.log(style.color(`\n  ${style.label} - ${phaseLabel}\n`));
    },

    onToken(provider: ProviderName, token: string) {
      writeToken(providerStyle(provider).color(token));
    },

    onTurnEnd() {
      endStream();
      console.log('');
    },

    onSynthesisStart() {
      console.log(chalk.bold.yellow(`\n${ruleLine()}\n  Final Synthesis\n${ruleLine()}`));
      console.log(chalk.cyan('\n  Judge is synthesizing...\n'));
    },

    onSynthesisToken(token: string) {
      writeToken(chalk.white(token));
    },

    onSynthesisEnd() {
      endStream();
      console.log('');
    },

    onRetry(provider: ProviderName, attempt: number, maxAttempts: number) {
      const label = providerStyle(provider).label;
      console.log(chalk.yellow(`\n  ${label} failed. Retrying (${attempt}/${maxAttempts})...\n`));
    },
  };
}

export function createSilentCallbacks(): DebateCallbacks {
  return {
    onRoundStart() {},
    onTurnStart() {},
    onToken() {},
    onTurnEnd() {},
    onSynthesisStart() {},
    onSynthesisToken() {},
    onSynthesisEnd() {},
    onRetry() {},
  };
}

export function renderJsonResult(result: DebateResult): void {
  console.log(JSON.stringify(result, null, 2));
}

export function buildMarkdownContent(result: DebateResult): string {
  let md = `# Debate: ${result.question}\n\n`;

  for (const msg of result.messages) {
    const label = participantStyle(msg.provider).label;
    const phase = msg.phase === 'opening' ? 'Opening' : 'Rebuttal';
    md += `## Round ${msg.round} - ${label} (${phase})\n\n${msg.content}\n\n---\n\n`;
  }

  if (result.synthesis) {
    md += `## Final Synthesis\n\n${result.synthesis}\n`;
  }

  return md;
}

export function renderMarkdownResult(result: DebateResult): void {
  console.log(buildMarkdownContent(result));
}

export function renderResult(result: DebateResult, format: string): void {
  if (format === 'json') {
    renderJsonResult(result);
  } else if (format === 'markdown') {
    renderMarkdownResult(result);
  }
}
