import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import type { ApplyTarget, DebateMode, DebateOptions, DebateResult, JudgeOption, OutputFormat, ProviderName } from '../../types/debate.js';
import { createProviders, createApplyProvider } from '../../providers/factory.js';
import { DebateOrchestrator } from '../../core/orchestrator.js';
import { Applier } from '../../core/applier.js';
import { getApplyPromptBuilder, type ApplyPromptBuilder } from '../../core/prompt-builder.js';
import { loadConfig } from '../../config/manager.js';
import { showBanner, showQuestion } from '../../ui/banner.js';
import { createPrettyCallbacks, createSilentCallbacks, renderResult } from '../../ui/renderer.js';
import { writeToken, endStream } from '../../ui/streamer.js';
import { collectProjectContext } from '../../core/project-context.js';

export function registerDebateCommand(program: Command): void {
  program
    .argument('[question]', 'The question to debate')
    .option('-r, --rounds <number>', 'Number of debate rounds', '3')
    .option('--no-stream', 'Disable streaming output')
    .option('--no-synthesis', 'Skip final synthesis')
    .option('-j, --judge <provider>', 'Judge for synthesis: codex, claude, both', 'claude')
    .option('-f, --format <format>', 'Output format: pretty, json, markdown', 'pretty')
    .option('--no-context', 'Disable project context collection')
    .option('--files <paths...>', 'Include specific files in project context')
    .option('-a, --apply [provider]', 'Apply conclusions to codebase (codex, claude, or both)')
    .option('--plan', 'Use implementation planning debate mode')
    .action(async (question: string | undefined, opts: Record<string, unknown>) => {
      if (!question) {
        const { input } = await import('@inquirer/prompts');
        question = await input({ message: 'What would you like the agents to debate?' });
      }

      if (!question || question.trim() === '') {
        console.error('Error: Please provide a question.');
        process.exit(1);
      }

      const config = loadConfig();
      const format = (opts.format as OutputFormat) || config.defaultFormat;
      const isPretty = format === 'pretty';

      const mode: DebateMode = opts.plan ? 'plan' : 'debate';

      if (isPretty) {
        showBanner();
        if (mode === 'plan') {
          console.log(chalk.bold.blue('  Mode: Implementation Planning\n'));
        }
        showQuestion(question);
      }

      const spinner = isPretty ? ora('Connecting to local agent CLIs...').start() : null;

      try {
        let projectContext: string | undefined;
        if (opts.context !== false) {
          if (isPretty) {
            spinner?.start('Collecting project context...');
          }
          projectContext = await collectProjectContext({
            files: opts.files as string[] | undefined,
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
          question,
          rounds: parseInt(opts.rounds as string, 10) || config.defaultRounds,
          stream: opts.stream !== false,
          synthesis: opts.synthesis !== false,
          judge: (opts.judge as JudgeOption) || config.defaultJudge,
          format,
          projectContext: projectContext || undefined,
          mode,
        };

        const callbacks = isPretty ? createPrettyCallbacks() : createSilentCallbacks();
        const result = await orchestrator.run(options, callbacks);

        if (format !== 'pretty') {
          renderResult(result, format);
        } else {
          console.log('\nDebate complete.\n');
        }

        if (opts.apply) {
          await handleApply(question, result, opts.apply as string | true, mode);
        }
      } catch (error) {
        spinner?.fail('Error');
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error(`\nError: ${message}\n`);
        process.exit(1);
      }
    });
}

async function executeApply(
  question: string,
  approach: { text: string; label: string },
  executor: ProviderName,
  applyBuilder: ApplyPromptBuilder,
  isSecondPass: boolean
): Promise<void> {
  const spinner = ora(`Applying with ${executor}...`).start();

  try {
    const provider = createApplyProvider(executor);
    const applier = new Applier(provider, executor, applyBuilder);

    spinner.stop();
    console.log(`\n--- Applying (${executor}${isSecondPass ? ' — verification pass' : ''}) ---\n`);

    for await (const token of applier.stream(question, approach.text, approach.label, isSecondPass)) {
      writeToken(token);
    }
    endStream();

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
  applyOpt: string | true,
  mode: DebateMode
): Promise<void> {
  const { select } = await import('@inquirer/prompts');

  // Step 1: 접근 방식 선택
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
      value: { text: result.synthesis, label: mode === 'plan' ? 'Agreed implementation plan' : 'Consensus from debate' },
    });
  }
  choices.push({ name: 'Skip', value: 'skip' as const });

  const approach: ApproachChoice = await select({
    message: mode === 'plan' ? 'Which plan would you like to apply?' : 'Which approach would you like to apply?',
    choices,
  });

  if (approach === 'skip') return;

  // Step 2: 실행 에이전트 선택
  let executor: ApplyTarget;

  if (applyOpt === 'codex' || applyOpt === 'claude' || applyOpt === 'both') {
    executor = applyOpt;
  } else {
    const executorChoices: Array<{ name: string; value: ApplyTarget }> = [
      { name: 'Codex (execute changes)', value: 'codex' },
      { name: 'Claude (edit files)', value: 'claude' },
    ];
    if (mode === 'plan') {
      executorChoices.push({
        name: 'Both (Codex implements → Claude verifies)',
        value: 'both',
      });
    }

    executor = await select({
      message: 'Apply with which agent?',
      choices: executorChoices,
    });
  }

  // Step 3: Apply 실행
  const applyBuilder = getApplyPromptBuilder(mode);

  if (executor === 'both') {
    await executeApply(question, approach, 'codex', applyBuilder, false);
    console.log(chalk.bold.yellow('\n--- Verification Pass ---\n'));
    await executeApply(question, approach, 'claude', applyBuilder, true);
  } else {
    await executeApply(question, approach, executor, applyBuilder, false);
  }
}
