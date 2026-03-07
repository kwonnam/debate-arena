import chalk from 'chalk';
import type {
  DebateCallbacks,
  DebateResult,
  ParticipantName,
} from '../types/debate.js';
import type { DebateParticipant } from '../types/roles.js';
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

function debateParticipantStyle(participant: DebateParticipant): Style {
  const base = providerStyle(participant.provider);
  return {
    color: base.color,
    label: participant.label || base.label,
  };
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
  let streamedTurn = false;
  let streamedSynthesis = false;

  return {
    onRoundStart(round: number, total: number) {
      console.log(chalk.bold.yellow(`\n${ruleLine()}\n  Round ${round} of ${total}\n${ruleLine()}`));
    },

    onTurnStart(participant: DebateParticipant, phase: 'opening' | 'rebuttal') {
      const style = debateParticipantStyle(participant);
      const phaseLabel = phase === 'opening' ? 'Opening' : 'Rebuttal';
      streamedTurn = false;
      console.log(style.color(`\n  ${style.label} - ${phaseLabel}\n`));
    },

    onToken(participant: DebateParticipant, token: string) {
      streamedTurn = true;
      writeToken(debateParticipantStyle(participant).color(token));
    },

    onTurnEnd(participant: DebateParticipant, content: string) {
      if (!streamedTurn && content.trim()) {
        console.log(debateParticipantStyle(participant).color(content));
      }
      endStream();
      console.log('');
    },

    onSynthesisStart() {
      streamedSynthesis = false;
      console.log(chalk.bold.yellow(`\n${ruleLine()}\n  Final Synthesis\n${ruleLine()}`));
      console.log(chalk.cyan('\n  Judge is synthesizing...\n'));
    },

    onSynthesisToken(token: string) {
      streamedSynthesis = true;
      writeToken(chalk.white(token));
    },

    onSynthesisEnd(content: string) {
      if (!streamedSynthesis && content.trim()) {
        console.log(chalk.white(content));
      }
      endStream();
      console.log('');
    },

    onRetry(participant: DebateParticipant, attempt: number, maxAttempts: number) {
      const label = debateParticipantStyle(participant).label;
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
    const label = participantStyle(msg.label).label;
    const phase = msg.phase === 'opening' ? 'Opening' : 'Rebuttal';
    md += `## Round ${msg.round} - ${label} (${phase})\n\n${msg.content}\n\n---\n\n`;
  }

  for (const state of result.roundStates) {
    md += `## Round ${state.round} State\n\n${state.summary}\n\n`;
    if (state.keyIssues.length > 0) {
      md += `Key issues:\n${state.keyIssues.map((item) => `- ${item}`).join('\n')}\n\n`;
    }
    if (state.transcriptFallbackUsed) {
      md += `_Transcript fallback used._\n\n`;
    }
    md += '---\n\n';
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
