import chalk from 'chalk';
import type {
  DebateCallbacks,
  DebateResult,
  ParticipantName,
  ProviderName,
} from '../types/debate.js';
import { endStream, writeToken } from './streamer.js';

const PROVIDER_STYLES: Record<ProviderName, { color: typeof chalk; label: string }> = {
  codex: { color: chalk.green, label: 'Codex' },
  claude: { color: chalk.magenta, label: 'Claude' },
};

const PARTICIPANT_STYLES: Record<ParticipantName, { color: typeof chalk; label: string }> = {
  codex: { color: chalk.green, label: 'Codex' },
  claude: { color: chalk.magenta, label: 'Claude' },
  user: { color: chalk.cyan, label: 'You' },
};

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
      const style = PROVIDER_STYLES[provider];
      const phaseLabel = phase === 'opening' ? 'Opening' : 'Rebuttal';
      console.log(style.color(`\n  ${style.label} - ${phaseLabel}\n`));
    },

    onToken(provider: ProviderName, token: string) {
      writeToken(PROVIDER_STYLES[provider].color(token));
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
      const label = PROVIDER_STYLES[provider].label;
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

export function renderMarkdownResult(result: DebateResult): void {
  let md = `# Debate: ${result.question}\n\n`;

  for (const msg of result.messages) {
    const label = PARTICIPANT_STYLES[msg.provider].label;
    const phase = msg.phase === 'opening' ? 'Opening' : 'Rebuttal';
    md += `## Round ${msg.round} - ${label} (${phase})\n\n${msg.content}\n\n---\n\n`;
  }

  if (result.synthesis) {
    md += `## Final Synthesis\n\n${result.synthesis}\n`;
  }

  console.log(md);
}

export function renderResult(result: DebateResult, format: string): void {
  if (format === 'json') {
    renderJsonResult(result);
  } else if (format === 'markdown') {
    renderMarkdownResult(result);
  }
}
