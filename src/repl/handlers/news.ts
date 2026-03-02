import chalk from 'chalk';
import { collectEvidence } from '../../news/index.js';
import type { EvidenceSnapshot } from '../../news/snapshot.js';
import type { SessionState } from '../session.js';

export async function handleNews(
  args: string,
  session: SessionState,
): Promise<{ session: SessionState }> {
  const query = args.trim();

  if (!query) {
    console.log('\n  Usage: /news <query>');
    console.log('  Example: /news Trump tariffs semiconductor\n');
    return { session };
  }

  try {
    console.log(`\n  ${chalk.cyan('📰')} 뉴스 수집 중... (Brave Search)\n`);
    const snapshot = await collectEvidence(query);

    if (!session.newsQuiet) {
      printSnapshot(snapshot);
    }

    const updatedSession: SessionState = { ...session, snapshot };
    console.log(`  ${chalk.green('✓')} 스냅샷 저장됨 (ID: ${snapshot.id})`);
    console.log(`  다음 토론부터 이 증거가 사용됩니다.\n`);

    return { session: updatedSession };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`\n  ${chalk.red('✗')} 뉴스 수집 실패:\n  ${msg}\n`);
    return { session };
  }
}

function printSnapshot(snapshot: EvidenceSnapshot): void {
  console.log(`  수집된 기사 (${snapshot.articles.length}건):\n`);
  snapshot.articles.forEach((a, i) => {
    console.log(`  ${chalk.bold(String(i + 1))}. [${a.source}] ${a.title}`);
    console.log(`     ${chalk.gray(a.publishedAt)} — ${a.url}`);
  });
  console.log('');
}
