import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NewsConfig } from '../config/defaults.js';

// Mock providers before importing the module under test
vi.mock('./providers/brave.js', () => ({
  BraveNewsProvider: vi.fn().mockImplementation(() => ({
    name: 'Brave',
    search: vi.fn().mockResolvedValue([
      { title: 'Brave Article', source: 'Brave', url: 'https://brave.com/1', publishedAt: '2026-03-01', summary: 'brave', relevanceScore: 0.9 },
    ]),
  })),
}));

vi.mock('./providers/brave-web.js', () => ({
  BraveWebProvider: vi.fn().mockImplementation(() => ({
    name: 'Brave Web',
    search: vi.fn().mockResolvedValue([
      { title: 'Brave Web Result', source: 'Brave Web', url: 'https://brave.com/web', publishedAt: '2026-03-01', summary: 'web', relevanceScore: 0.85 },
    ]),
  })),
}));

vi.mock('./providers/newsapi.js', () => ({
  NewsApiProvider: vi.fn().mockImplementation(() => ({
    name: 'NewsAPI',
    search: vi.fn().mockResolvedValue([
      { title: 'NewsAPI Article', source: 'NewsAPI', url: 'https://newsapi.com/1', publishedAt: '2026-03-01', summary: 'newsapi', relevanceScore: 0.7 },
    ]),
  })),
}));

vi.mock('./providers/rss.js', () => ({
  RssProvider: vi.fn().mockImplementation(() => ({
    name: 'rss',
    search: vi.fn().mockResolvedValue([
      { title: 'RSS Article', source: 'rss', url: 'https://rss.com/1', publishedAt: '2026-03-01', summary: 'rss', relevanceScore: 0.5 },
    ]),
  })),
}));

vi.mock('./snapshot-io.js', () => ({
  writeSnapshot: vi.fn().mockResolvedValue(undefined),
  readSnapshot: vi.fn().mockResolvedValue({ id: 'snap1', query: 'test', articles: [], sources: [], collectedAt: '', excludedCount: 0 }),
}));

import { buildProvidersFromConfig, collectEvidence } from './index.js';
import { BraveNewsProvider } from './providers/brave.js';
import { BraveWebProvider } from './providers/brave-web.js';
import { NewsApiProvider } from './providers/newsapi.js';
import { RssProvider } from './providers/rss.js';

const braveOnlyConfig: NewsConfig = {
  providers: {
    brave: { enabled: true },
    braveWeb: { enabled: true },
    newsapi: { enabled: false },
    rss: { enabled: false, feeds: [] },
  },
  maxArticlesPerProvider: 10,
  deduplication: true,
};

const allProvidersConfig: NewsConfig = {
  providers: {
    brave: { enabled: true },
    braveWeb: { enabled: true },
    newsapi: { enabled: true },
    rss: { enabled: true, feeds: ['https://example.com/feed.xml'] },
  },
  maxArticlesPerProvider: 5,
  deduplication: true,
};

describe('buildProvidersFromConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BRAVE_API_KEY = 'test-brave-key';
    process.env.NEWS_API_KEY = 'test-newsapi-key';
  });

  it('brave만 enabled이면 BraveNewsProvider 1개 반환', () => {
    const providers = buildProvidersFromConfig(braveOnlyConfig);
    expect(providers).toHaveLength(1);
    expect(BraveNewsProvider).toHaveBeenCalledWith('test-brave-key');
  });

  it('모두 enabled이면 3개 provider 반환', () => {
    const providers = buildProvidersFromConfig(allProvidersConfig);
    expect(providers).toHaveLength(3);
    expect(BraveNewsProvider).toHaveBeenCalledOnce();
    expect(NewsApiProvider).toHaveBeenCalledOnce();
    expect(RssProvider).toHaveBeenCalledOnce();
  });

  it('BRAVE_API_KEY 없으면 brave provider 추가 안 함', () => {
    delete process.env.BRAVE_API_KEY;
    const providers = buildProvidersFromConfig(braveOnlyConfig);
    expect(providers).toHaveLength(0);
  });

  it('rss feeds가 비어있으면 RssProvider 추가 안 함', () => {
    const cfg: NewsConfig = {
      ...allProvidersConfig,
      providers: { ...allProvidersConfig.providers, rss: { enabled: true, feeds: [] } },
    };
    const providers = buildProvidersFromConfig(cfg);
    expect(RssProvider).not.toHaveBeenCalled();
  });

  it('NEWS_API_KEY 없으면 newsapi provider 추가 안 함', () => {
    delete process.env.NEWS_API_KEY;
    const cfg: NewsConfig = {
      ...braveOnlyConfig,
      providers: { ...braveOnlyConfig.providers, newsapi: { enabled: true } },
    };
    const providers = buildProvidersFromConfig(cfg);
    expect(NewsApiProvider).not.toHaveBeenCalled();
  });

  it('web evidence면 BraveWebProvider를 사용한다', () => {
    const providers = buildProvidersFromConfig(braveOnlyConfig, 'web');
    expect(providers).toHaveLength(1);
    expect(BraveWebProvider).toHaveBeenCalledWith('test-brave-key');
  });
});

describe('collectEvidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.BRAVE_API_KEY = 'test-brave-key';
    process.env.NEWS_API_KEY = 'test-newsapi-key';
  });

  it('snapshotFile 옵션이 있으면 readSnapshot을 사용한다', async () => {
    const { readSnapshot } = await import('./snapshot-io.js');
    const snapshot = await collectEvidence('query', { snapshotFile: '/tmp/snap.json' });
    expect(readSnapshot).toHaveBeenCalledWith('/tmp/snap.json');
    expect(snapshot.id).toBe('snap1');
  });

  it('config 기반으로 brave provider만 사용한다', async () => {
    const snapshot = await collectEvidence('query', undefined, braveOnlyConfig);
    expect(snapshot.articles.length).toBeGreaterThanOrEqual(1);
    expect(snapshot.sources).toContain('Brave');
  });

  it('config 없으면 기본 brave 동작 (BRAVE_API_KEY 필수)', async () => {
    delete process.env.BRAVE_API_KEY;
    await expect(collectEvidence('query')).rejects.toThrow('BRAVE_API_KEY');
  });

  it('writeSnapshot이 자동으로 호출된다', async () => {
    const { writeSnapshot } = await import('./snapshot-io.js');
    await collectEvidence('query', undefined, braveOnlyConfig);
    expect(writeSnapshot).toHaveBeenCalledOnce();
  });

  it('web evidence snapshot은 kind=web으로 저장한다', async () => {
    const snapshot = await collectEvidence('query', { kind: 'web' }, braveOnlyConfig);
    expect(snapshot.kind).toBe('web');
    expect(snapshot.sources).toContain('Brave Web');
  });
});
