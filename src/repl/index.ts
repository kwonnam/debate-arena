import chalk from 'chalk';
import { showBanner } from '../ui/banner.js';
import { loadConfig } from '../config/manager.js';
import { parseInput, type ParsedCommand } from './parser.js';
import { createDefaultSession, type SessionState } from './session.js';
import { getHandler, isDebateCommand, runDebateFromSlash } from './registry.js';
import { handleDebate } from './handlers/debate.js';
import { inkPrompt } from '../ink/ink-prompt.js';
import { COMMAND_REGISTRY } from './command-meta.js';
import { resetTTYInputState } from './tty-state.js';
import type { CommandContext } from './registry.js';
import type { DebateMode } from '../types/debate.js';
import type { CliArgs } from './cli-args.js';
import { collectEvidence } from '../news/index.js';

declare const PKG_VERSION: string;

async function dispatchCommand(
  parsed: ParsedCommand,
  deps: { readonly session: SessionState },
): Promise<SessionState> {
  const { session } = deps;

  switch (parsed.kind) {
    case 'empty':
      return session;

    case 'debate': {
      await handleDebate(parsed.topic, parsed.mode, session);
      return session;
    }

    case 'slash': {
      const { command, args } = parsed;

      if (isDebateCommand(command) && args) {
        const result = await runDebateFromSlash(command, args, { session });
        return result.session;
      }

      const handler = getHandler(command);
      if (!handler) {
        console.log(chalk.yellow(`  Unknown command: /${command}. Type /help for available commands.`));
        return session;
      }

      const ctx: CommandContext = { session };
      const result = await handler(args, ctx);
      return result.session;
    }
  }
}

export async function startRepl(cliArgs?: CliArgs): Promise<void> {
  showBanner();
  console.log(chalk.dim(`  v${PKG_VERSION} Type /help for commands, /exit to quit.\n`));

  const config = loadConfig();
  let session = createDefaultSession({
    rounds: config.defaultRounds,
    judge: config.defaultJudge,
    format: config.defaultFormat,
    stream: config.stream,
    newsQuiet: cliArgs?.newsQuiet,
    newsMode: cliArgs?.newsMode,
  });

  // --news 또는 --news-snapshot 플래그 처리
  if (cliArgs?.news || cliArgs?.newsSnapshot) {
    const query = cliArgs.question ?? '';
    if (!query && !cliArgs.newsSnapshot) {
      console.log(chalk.yellow('  --news 플래그 사용 시 검색어가 필요합니다.'));
      console.log(chalk.dim('  예: ffm --news "Trump tariffs"\n'));
    } else {
      try {
        console.log(`  ${chalk.cyan('📰')} 뉴스 수집 중...\n`);
        const snapshot = await collectEvidence(query, {
          snapshotFile: cliArgs.newsSnapshot,
          quiet: cliArgs.newsQuiet,
        });
        if (!cliArgs.newsQuiet) {
          console.log(`  수집된 기사 (${snapshot.articles.length}건):`);
          snapshot.articles.forEach((a, i) => {
            console.log(`  ${i + 1}. [${a.source}] ${a.title}`);
          });
          console.log('');
        }
        console.log(`  ${chalk.green('✓')} 스냅샷 로드됨 (ID: ${snapshot.id})\n`);
        session = { ...session, snapshot };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.log(chalk.red(`  뉴스 수집 실패: ${msg}\n`));
        console.log(chalk.dim('  뉴스 없이 일반 토론으로 진행합니다.\n'));
      }
    }
  }

  let debateMode: DebateMode = 'debate';

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await inkPrompt({
      commands: COMMAND_REGISTRY,
      session: {
        rounds: session.rounds,
        judge: session.judge,
        format: session.format,
        stream: session.stream,
      },
      debateMode,
    });

    try {
      switch (result.kind) {
        case 'empty':
        case 'interrupt':
          continue;

        case 'eof':
          console.log(chalk.dim('\nGoodbye!\n'));
          process.exit(0);
          break;

        case 'mode-toggle':
          debateMode = debateMode === 'debate' ? 'plan' : 'debate';
          continue;

        case 'slash': {
          const line = result.args
            ? `/${result.command} ${result.args}`
            : `/${result.command}`;
          session = await dispatchCommand(parseInput(line, debateMode), { session });
          continue;
        }

        case 'line': {
          session = await dispatchCommand(parseInput(result.line, debateMode), { session });
          continue;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      console.error(`\n${chalk.red('Command error:')} ${message}\n`);
      resetTTYInputState();
    }
  }
}
