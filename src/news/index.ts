import { BraveNewsProvider } from './providers/brave.js';
import { BraveWebProvider } from './providers/brave-web.js';
import { NewsApiProvider } from './providers/newsapi.js';
import { RssProvider } from './providers/rss.js';
import { EvidenceBuilder } from './evidence-builder.js';
import { writeSnapshot, readSnapshot } from './snapshot-io.js';
import { buildSearchPlan } from './query-transform.js';
import type { EvidenceKind, EvidenceSnapshot } from './snapshot.js';
import { normalizeEvidenceKind } from './snapshot.js';
import type { NewsProvider, SearchOptions } from './providers/types.js';
import type { NewsConfig } from '../config/defaults.js';
import type { QueryTransformOptions, SearchLanguageScope, QueryTransformMode, SearchPlan } from './search-plan.js';
import { DEFAULT_NEWS_CONFIG } from '../config/defaults.js';

export type { EvidenceSnapshot, SearchOptions };
export type { EvidenceKind };
export type { QueryTransformOptions, SearchLanguageScope, QueryTransformMode, SearchPlan };
export { readSnapshot, writeSnapshot };

export interface NewsOptions extends SearchOptions {
  quiet?: boolean;           // 기사 목록 미표시
  snapshotFile?: string;     // 기존 스냅샷 재사용
  snapshotDir?: string;      // 스냅샷 저장 폴더
  kind?: EvidenceKind;
  queryTransform?: QueryTransformOptions;
}

export function buildProvidersFromConfig(newsConfig: NewsConfig, kind: EvidenceKind = 'news'): NewsProvider[] {
  const providers: NewsProvider[] = [];
  const evidenceKind = normalizeEvidenceKind(kind);

  if (evidenceKind === 'web') {
    const apiKey = process.env.BRAVE_API_KEY ?? '';
    const braveWebEnabled = newsConfig.providers.braveWeb?.enabled ?? newsConfig.providers.brave.enabled;
    if (braveWebEnabled && apiKey) {
      providers.push(new BraveWebProvider(apiKey));
    }
    return providers;
  }

  if (newsConfig.providers.brave.enabled) {
    const apiKey = process.env.BRAVE_API_KEY ?? '';
    if (apiKey) {
      providers.push(new BraveNewsProvider(apiKey));
    }
  }

  if (newsConfig.providers.newsapi.enabled) {
    const apiKey = process.env.NEWS_API_KEY ?? '';
    if (apiKey) {
      providers.push(new NewsApiProvider(apiKey));
    }
  }

  if (newsConfig.providers.rss.enabled && newsConfig.providers.rss.feeds.length > 0) {
    providers.push(new RssProvider(newsConfig.providers.rss.feeds));
  }

  return providers;
}

export async function collectEvidence(
  query: string,
  options?: NewsOptions,
  newsConfig?: NewsConfig,
): Promise<EvidenceSnapshot> {
  // 기존 스냅샷 재사용
  if (options?.snapshotFile) {
    return readSnapshot(options.snapshotFile);
  }

  const cfg = newsConfig ?? DEFAULT_NEWS_CONFIG;
  const kind = normalizeEvidenceKind(options?.kind);
  const providers = buildProvidersFromConfig(cfg, kind);

  // 하위 호환: config가 없거나 provider가 없으면 Brave 단독 시도
  if (providers.length === 0) {
    const apiKey = process.env.BRAVE_API_KEY;
    if (!apiKey) {
      throw new Error(
        'BRAVE_API_KEY environment variable is required.\n' +
        'Get your free key at: https://api.search.brave.com\n' +
        'Then add to .env: BRAVE_API_KEY=your_key_here'
      );
    }
    providers.push(kind === 'web' ? new BraveWebProvider(apiKey) : new BraveNewsProvider(apiKey));
  }

  const maxArticles = cfg.maxArticlesPerProvider;
  const searchPlan = await buildSearchPlan(query, {
    ...options?.queryTransform,
    scope: kind,
  });
  const searchOptions: SearchOptions = {
    maxArticles: options?.maxArticles ?? maxArticles,
    language: options?.language,
    freshness: options?.freshness,
  };

  const builder = new EvidenceBuilder(providers);
  const snapshot = await builder.build(query, {
    ...searchOptions,
    kind,
    deduplication: cfg.deduplication,
    searchPlan,
  });

  // 자동 저장
  await writeSnapshot(snapshot, options?.snapshotDir);

  return snapshot;
}
