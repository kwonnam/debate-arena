import chalk from 'chalk';
import { select } from '@inquirer/prompts';
import { collectEvidence } from '../../news/index.js';
import type { EvidenceKind, EvidenceSnapshot } from '../../news/snapshot.js';
import type { SearchLanguageScope } from '../../news/search-plan.js';
import type { SessionState } from '../session.js';
import type { NewsMode } from '../../types/debate.js';
import { loadConfigV2 } from '../../config/manager.js';
import { DEFAULT_NEWS_CONFIG } from '../../config/defaults.js';

export async function handleNews(
  args: string,
  session: SessionState,
): Promise<{ session: SessionState }> {
  return handleEvidenceCommand('news', args, session);
}

export async function handleWeb(
  args: string,
  session: SessionState,
): Promise<{ session: SessionState }> {
  return handleEvidenceCommand('web', args, session);
}

async function handleEvidenceCommand(
  kind: EvidenceKind,
  args: string,
  session: SessionState,
): Promise<{ session: SessionState }> {
  const parsed = parseEvidenceArgs(args);
  const query = parsed.query;

  if (!query) {
    console.log(`\n  Usage: /${kind} [--expand] [--lang input|ko|en|both] <query>`);
    console.log(`  Example: /${kind} --expand --lang both Trump tariffs semiconductor\n`);
    return { session };
  }

  const scopeLabel = kind === 'web' ? '웹 근거' : '뉴스';
  const scopeEmoji = kind === 'web' ? '🌐' : '📰';

  try {
    console.log(`\n  ${chalk.cyan(scopeEmoji)} ${scopeLabel} 수집 중... (Brave Search)\n`);
    const configV2 = loadConfigV2();
    const newsConfig = configV2.news ?? DEFAULT_NEWS_CONFIG;
    const snapshot = await collectEvidence(query, {
      kind,
      queryTransform: {
        mode: parsed.queryTransformMode,
        languageScope: parsed.queryLanguageScope,
      },
    }, newsConfig);

    if (!session.newsQuiet) {
      printSnapshot(snapshot);
    }

    console.log(`  ${chalk.green('✓')} 스냅샷 저장됨 (ID: ${snapshot.id})`);
    const searchPlanSummary = formatSearchPlanSummary(snapshot);
    if (searchPlanSummary) {
      console.log(`  ${chalk.gray(`검색 계획: ${searchPlanSummary}`)}`);
    }

    let newsMode: NewsMode = 'unified';
    try {
      newsMode = await select<NewsMode>({
        message: '근거 주입 모드를 선택하세요:',
        choices: [
          { name: 'unified  — 양측 동일 근거 (기본값)', value: 'unified' },
          { name: 'split    — 찬반 역할 분리', value: 'split' },
        ],
      });
    } catch {
      // Non-TTY fallback: use unified
    }

    const updatedSession: SessionState = { ...session, snapshot, newsMode };
    console.log(`  ${chalk.green('✓')} ${newsMode} 모드 설정됨. 다음 토론부터 적용됩니다.\n`);

    return { session: updatedSession };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`\n  ${chalk.red('✗')} ${scopeLabel} 수집 실패:\n  ${msg}\n`);
    return { session };
  }
}

function printSnapshot(snapshot: EvidenceSnapshot): void {
  const itemLabel = snapshot.kind === 'web' ? '수집된 웹 근거' : '수집된 기사';
  console.log(`  ${itemLabel} (${snapshot.articles.length}건):\n`);
  snapshot.articles.forEach((a, i) => {
    console.log(`  ${chalk.bold(String(i + 1))}. [${a.source}] ${a.title}`);
    console.log(`     ${chalk.gray(a.publishedAt)} — ${a.url}`);
  });
  console.log('');
}

function parseEvidenceArgs(args: string): {
  query: string;
  queryTransformMode: 'off' | 'expand';
  queryLanguageScope: SearchLanguageScope;
} {
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  let queryTransformMode: 'off' | 'expand' = 'off';
  let queryLanguageScope: SearchLanguageScope = 'input';
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index];
    if (token === '--expand') {
      queryTransformMode = 'expand';
      index += 1;
      continue;
    }
    if (token === '--lang' && isSearchLanguageScope(tokens[index + 1])) {
      queryLanguageScope = tokens[index + 1];
      index += 2;
      continue;
    }
    break;
  }

  return {
    query: tokens.slice(index).join(' '),
    queryTransformMode,
    queryLanguageScope,
  };
}

function isSearchLanguageScope(value: unknown): value is SearchLanguageScope {
  return value === 'input' || value === 'ko' || value === 'en' || value === 'both';
}

function formatSearchPlanSummary(snapshot: EvidenceSnapshot): string {
  const queries = snapshot.searchPlan?.queries ?? [];
  if (queries.length === 0) return '';

  return queries
    .map((query) => `${query.language?.toUpperCase() ?? 'AUTO'}: ${query.query}`)
    .join(' | ');
}
