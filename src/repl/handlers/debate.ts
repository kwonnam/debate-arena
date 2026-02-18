import chalk from 'chalk';
import ora from 'ora';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import type {
  ApplyTarget,
  DebateMode,
  DebateOptions,
  DebateResult,
  ProviderName,
} from '../../types/debate.js';
import { createProviders, createApplyProvider } from '../../providers/factory.js';
import { DebateOrchestrator } from '../../core/orchestrator.js';
import { Applier } from '../../core/applier.js';
import { getApplyPromptBuilder, type ApplyPromptBuilder } from '../../core/prompt-builder.js';
import { loadConfig } from '../../config/manager.js';
import { showQuestion } from '../../ui/banner.js';
import { createPrettyCallbacks, createSilentCallbacks, renderResult } from '../../ui/renderer.js';
import { writeToken, endStream } from '../../ui/streamer.js';
import { collectProjectContext } from '../../core/project-context.js';
import { withSafeStdin } from '../tty-state.js';
import type { SessionState } from '../session.js';

type DebateModeArg = 'debate' | 'plan' | 'interactive';
type GitStatusCode = string;

interface GitSnapshot {
  readonly statusByPath: Map<string, GitStatusCode>;
}

interface ChangeEntry {
  readonly path: string;
  readonly beforeStatus: GitStatusCode | null;
  readonly afterStatus: GitStatusCode | null;
}

function runGit(args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function captureGitSnapshot(): GitSnapshot | null {
  const raw = runGit(['status', '--porcelain=v1', '--untracked-files=all']);
  if (raw === null) return null;

  const statusByPath = new Map<string, GitStatusCode>();
  const lines = raw.split('\n').filter((line) => line.trim().length > 0);

  for (const line of lines) {
    if (line.length < 4) continue;
    const status = line.slice(0, 2);
    const rawPath = line.slice(3).trim();
    const path = rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1) ?? rawPath : rawPath;
    statusByPath.set(path, status);
  }

  return { statusByPath };
}

function computeSnapshotDelta(before: GitSnapshot, after: GitSnapshot): ChangeEntry[] {
  const paths = new Set<string>([...before.statusByPath.keys(), ...after.statusByPath.keys()]);
  const changes: ChangeEntry[] = [];

  for (const path of paths) {
    const beforeStatus = before.statusByPath.get(path) ?? null;
    const afterStatus = after.statusByPath.get(path) ?? null;
    if (beforeStatus !== afterStatus) {
      changes.push({ path, beforeStatus, afterStatus });
    }
  }

  return changes.sort((a, b) => a.path.localeCompare(b.path));
}

function printNewFilePreview(paths: string[]): void {
  for (const path of paths) {
    try {
      const content = readFileSync(path, 'utf-8');
      const lines = content.split('\n');
      const preview = lines.slice(0, 80).join('\n');
      const truncated = lines.length > 80;

      console.log(chalk.bold(`\n--- New File: ${path} ---\n`));
      console.log(preview);
      if (truncated) {
        console.log(chalk.dim(`\n... (${lines.length - 80} more lines)\n`));
      } else {
        console.log('');
      }
    } catch {
      console.log(chalk.dim(`\n--- New File: ${path} (preview unavailable) ---\n`));
    }
  }
}

function printApplyChanges(before: GitSnapshot | null, after: GitSnapshot | null): void {
  if (!before || !after) {
    console.log(chalk.dim('\nCould not capture git diff for apply changes.\n'));
    return;
  }

  const delta = computeSnapshotDelta(before, after);
  if (delta.length === 0) {
    console.log(chalk.dim('\nNo code changes detected from this apply run.\n'));
    return;
  }

  console.log(chalk.bold('\nChanged by apply:\n'));
  for (const entry of delta) {
    const beforeLabel = entry.beforeStatus ?? '..';
    const afterLabel = entry.afterStatus ?? '..';
    console.log(`  ${beforeLabel} -> ${afterLabel}  ${entry.path}`);
  }

  const trackedPaths = delta
    .filter((entry) => entry.afterStatus !== null && !entry.afterStatus.startsWith('??'))
    .map((entry) => entry.path);
  const newUntracked = delta
    .filter((entry) => entry.afterStatus?.startsWith('??'))
    .map((entry) => entry.path);

  if (trackedPaths.length > 0) {
    const diff = runGit(['--no-pager', 'diff', '--', ...trackedPaths]) ?? '';
    if (diff.trim().length > 0) {
      const lines = diff.split('\n');
      const maxLines = 400;
      const output = lines.slice(0, maxLines).join('\n');

      console.log(chalk.bold('\n--- Code Diff ---\n'));
      console.log(output);

      if (lines.length > maxLines) {
        console.log(chalk.dim(`\n... diff truncated (${lines.length - maxLines} more lines)\n`));
      }
    }
  }

  if (newUntracked.length > 0) {
    printNewFilePreview(newUntracked);
  }
}

export async function handleDebate(
  topic: string,
  modeArg: DebateModeArg,
  session: SessionState,
): Promise<void> {
  const config = loadConfig();
  const format = session.format;
  const isPretty = format === 'pretty';

  const mode: DebateMode = modeArg === 'plan' ? 'plan' : 'debate';
  const isInteractive = modeArg === 'interactive';

  if (isPretty) {
    if (mode === 'plan') {
      console.log(chalk.bold.blue('\n  Mode: Implementation Planning\n'));
    }
    if (isInteractive) {
      console.log(chalk.bold.cyan('\n  Mode: Interactive 3-Way Debate (You + Codex + Claude)\n'));
    }
    showQuestion(topic);
  }

  const spinner = isPretty ? ora('Connecting to local agent CLIs...').start() : null;

  try {
    let projectContext: string | undefined;
    if (!session.noContext) {
      if (isPretty) {
        spinner?.start('Collecting project context...');
      }
      projectContext = await collectProjectContext({
        files: session.files.length > 0 ? [...session.files] : undefined,
      });
      if (projectContext) {
        spinner?.succeed('Project context collected');
      } else {
        spinner?.info('No project context found');
      }
    }

    if (isPretty && !spinner?.isSpinning) {
      spinner?.start('Connecting to local agent CLIs...');
    }

    const providers = createProviders();
    spinner?.succeed('Connected to local agent CLIs');

    const orchestrator = new DebateOrchestrator(providers.codex, providers.claude);
    const options: DebateOptions = {
      question: topic,
      rounds: session.rounds || config.defaultRounds,
      stream: session.stream,
      synthesis: true,
      judge: session.judge || config.defaultJudge,
      format,
      projectContext: projectContext || undefined,
      mode,
      interactive: isInteractive,
    };

    const callbacks = isPretty ? createPrettyCallbacks() : createSilentCallbacks();

    if (isInteractive) {
      const { input: inquirerInput } = await import('@inquirer/prompts');
      const { renderUserTurnStart, renderUserTurnEnd } = await import('../../ui/renderer.js');

      callbacks.onUserTurnStart = () => {
        if (isPretty) {
          renderUserTurnStart();
        }
      };

      callbacks.onUserInput = async () =>
        withSafeStdin(async () => {
          const response = await inquirerInput({
            message: 'Your response (press Enter to skip):',
          });
          return response;
        });

      callbacks.onUserTurnEnd = (content: string) => {
        if (isPretty) {
          renderUserTurnEnd(content);
        }
      };
    }

    const result = await orchestrator.run(options, callbacks);

    if (format !== 'pretty') {
      renderResult(result, format);
    } else {
      console.log('\nDebate complete.\n');
    }

    if (mode === 'plan' && isPretty) {
      const { select } = await import('@inquirer/prompts');

      const shouldProceed = await withSafeStdin(() =>
        select({
          message: 'Would you like to apply one of these plans now?',
          choices: [
            { name: 'Yes - choose a plan and apply it', value: true },
            { name: 'No - return to REPL', value: false },
          ],
        }),
      );

      if (shouldProceed) {
        await handleApply(topic, result, mode);
      }
    }
  } catch (error) {
    spinner?.fail('Error');
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error(`\n${chalk.red('Error:')} ${message}\n`);
  }
}

async function executeApply(
  question: string,
  approach: { text: string; label: string },
  executor: ProviderName,
  applyBuilder: ApplyPromptBuilder,
  isSecondPass: boolean,
): Promise<void> {
  const spinner = ora(`Applying with ${executor}...`).start();
  const beforeSnapshot = captureGitSnapshot();

  try {
    const provider = createApplyProvider(executor);
    const applier = new Applier(provider, executor, applyBuilder);

    spinner.stop();
    console.log(`\n--- Applying (${executor}${isSecondPass ? ' - verification pass' : ''}) ---\n`);

    for await (const token of applier.stream(question, approach.text, approach.label, isSecondPass)) {
      writeToken(token);
    }
    endStream();

    const afterSnapshot = captureGitSnapshot();
    printApplyChanges(beforeSnapshot, afterSnapshot);

    console.log(`\n${isSecondPass ? 'Verification' : 'Apply'} complete.\n`);
  } catch (error) {
    spinner.stop();
    const message = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error(`\nApply error: ${message}\n`);
  }
}

async function handleApply(
  question: string,
  result: DebateResult,
  mode: DebateMode,
): Promise<void> {
  const { select } = await import('@inquirer/prompts');

  const lastCodex = [...result.messages].reverse().find((m) => m.provider === 'codex');
  const lastClaude = [...result.messages].reverse().find((m) => m.provider === 'claude');

  type ApproachChoice = { text: string; label: string } | 'skip';

  const choices: Array<{ name: string; value: ApproachChoice }> = [];
  if (lastCodex) {
    choices.push({
      name: "Codex's approach",
      value: { text: lastCodex.content, label: "Codex's proposal" },
    });
  }
  if (lastClaude) {
    choices.push({
      name: "Claude's approach",
      value: { text: lastClaude.content, label: "Claude's proposal" },
    });
  }
  if (result.synthesis) {
    choices.push({
      name: mode === 'plan' ? 'Agreed plan (synthesis)' : 'Consensus (synthesis)',
      value: {
        text: result.synthesis,
        label: mode === 'plan' ? 'Agreed implementation plan' : 'Consensus from debate',
      },
    });
  }
  choices.push({ name: 'Skip', value: 'skip' as const });

  const approach: ApproachChoice = await withSafeStdin(() =>
    select({
      message:
        mode === 'plan'
          ? 'Which plan would you like to apply?'
          : 'Which approach would you like to apply?',
      choices,
    }),
  );

  if (approach === 'skip') return;

  const executorChoices: Array<{ name: string; value: ApplyTarget }> = [
    { name: 'Codex (execute changes)', value: 'codex' },
    { name: 'Claude (edit files)', value: 'claude' },
  ];
  if (mode === 'plan') {
    executorChoices.push({
      name: 'Both (Codex implements + Claude verifies)',
      value: 'both',
    });
  }

  const executor = await withSafeStdin(() =>
    select({
      message: 'Apply with which agent?',
      choices: executorChoices,
    }),
  );

  const applyBuilder = getApplyPromptBuilder(mode);

  if (executor === 'both') {
    await executeApply(question, approach, 'codex', applyBuilder, false);
    console.log(chalk.bold.yellow('\n--- Verification Pass ---\n'));
    await executeApply(question, approach, 'claude', applyBuilder, true);
  } else {
    await executeApply(question, approach, executor, applyBuilder, false);
  }
}
