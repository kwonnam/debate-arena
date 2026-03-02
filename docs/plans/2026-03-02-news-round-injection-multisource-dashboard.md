# News Round Injection, Multi-Source & Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 뉴스 증거를 토론 라운드 프롬프트에 주입하고 (unified/split 모드), NewsAPI·RSS 멀티 소스를 추가하고, 대시보드에 News 탭을 만든다.

**Architecture:** 3개 Phase를 순차 진행. Phase 1은 `DebateContext`와 `prompt-builder.ts`를 확장해 라운드 프롬프트에 뉴스 컨텍스트를 삽입. Phase 2는 `NewsProvider` 인터페이스를 활용해 NewsAPI·RSS 구현체를 추가하고 `collectEvidence()`를 config 기반으로 교체. Phase 3은 Hono 서버에 `/api/snapshots` 라우트를 추가하고 대시보드 HTML에 News 탭 UI를 구현.

**Tech Stack:** TypeScript, Node.js, Hono, Brave Search API, NewsAPI.org, RSS (fetch + XML 파싱)

---

## Phase 1: 라운드 주입 모드 선택

### Task 1: `NewsMode` 타입 추가

**Files:**
- Modify: `src/types/debate.ts`

**Step 1: `NewsMode` 타입과 `DebateOptions.newsMode` 추가**

`src/types/debate.ts`에서 `DebateOptions` 인터페이스 아래에 추가:

```typescript
export type NewsMode = 'unified' | 'split';
```

`DebateOptions` 인터페이스에 필드 추가:
```typescript
  snapshot?: EvidenceSnapshot;
  newsMode?: NewsMode;   // ← 이 줄 추가 (snapshot 바로 아래)
```

**Step 2: 빌드 확인**

```bash
npm run build 2>&1 | tail -5
```
Expected: `Build success`

**Step 3: Commit**

```bash
git add src/types/debate.ts
git commit -m "feat: NewsMode 타입 추가 (unified | split)"
```

---

### Task 2: `SessionState`에 `newsMode` 추가

**Files:**
- Modify: `src/repl/session.ts`

**Step 1: `SessionState`에 `newsMode` 필드 추가**

`src/repl/session.ts`의 `SessionState` 인터페이스:
```typescript
import type { JudgeOption, OutputFormat, ProviderName, NewsMode } from '../types/debate.js';

export interface SessionState {
  // ... 기존 필드 유지
  readonly snapshot?: EvidenceSnapshot;
  readonly newsQuiet?: boolean;
  readonly newsMode?: NewsMode;  // ← 추가
}
```

`createDefaultSession`은 변경 불필요 (undefined이면 unified 동작).

**Step 2: 빌드 확인**

```bash
npm run build 2>&1 | tail -5
```

**Step 3: Commit**

```bash
git add src/repl/session.ts
git commit -m "feat: SessionState에 newsMode 필드 추가"
```

---

### Task 3: `prompt-builder.ts`에 라운드용 evidence 프롬프트 추가

**Files:**
- Modify: `src/core/prompt-builder.ts`
- Test: `src/core/prompt-builder.test.ts`

**Step 1: 실패하는 테스트 작성**

`src/core/prompt-builder.test.ts`에 추가:

```typescript
import { buildRoundEvidenceSection } from './prompt-builder.js';
import type { NewsArticle } from '../news/snapshot.js';

const mockArticles: NewsArticle[] = [
  {
    title: 'Test Article',
    source: 'Reuters',
    url: 'https://reuters.com/test',
    publishedAt: '2026-03-02',
    summary: 'Test summary',
    relevanceScore: 0.9,
  },
  {
    title: 'Second Article',
    source: 'Bloomberg',
    url: 'https://bloomberg.com/test',
    publishedAt: '2026-03-01',
    summary: 'Second summary',
    relevanceScore: 0.5,
  },
];

describe('buildRoundEvidenceSection', () => {
  it('unified 모드: 전체 기사를 반환한다', () => {
    const result = buildRoundEvidenceSection('unified', mockArticles);
    expect(result).toContain('Test Article');
    expect(result).toContain('Second Article');
    expect(result).toContain('unified');
  });

  it('split first: 상위 절반 기사만 반환한다', () => {
    const result = buildRoundEvidenceSection('split-first', mockArticles);
    expect(result).toContain('Test Article');
    expect(result).not.toContain('Second Article');
  });

  it('split second: 하위 절반 기사만 반환한다', () => {
    const result = buildRoundEvidenceSection('split-second', mockArticles);
    expect(result).not.toContain('Test Article');
    expect(result).toContain('Second Article');
  });
});
```

**Step 2: 테스트 실패 확인**

```bash
npm test 2>&1 | grep -A 5 "buildRoundEvidenceSection"
```
Expected: `buildRoundEvidenceSection is not a function` 같은 에러

**Step 3: `buildRoundEvidenceSection` 구현**

`src/core/prompt-builder.ts`에 `buildSynthesisPromptWithEvidence` 아래에 추가:

```typescript
export type RoundEvidenceMode = 'unified' | 'split-first' | 'split-second';

export function buildRoundEvidenceSection(
  mode: RoundEvidenceMode,
  articles: NewsArticle[],
): string {
  let selected: NewsArticle[];
  let label: string;

  if (mode === 'unified') {
    selected = articles;
    label = '양측 공통 증거 (unified)';
  } else {
    const half = Math.ceil(articles.length / 2);
    if (mode === 'split-first') {
      selected = articles.slice(0, half);
      label = '찬성 측 근거 (split)';
    } else {
      selected = articles.slice(half);
      label = '반대 측 근거 (split)';
    }
  }

  if (selected.length === 0) return '';

  const lines = [
    '',
    `## 참고 뉴스 (${label})`,
    '아래 기사를 근거로 활용하여 논증을 강화하십시오.',
    '',
    ...selected.map(
      (a) => `- [${a.source}] ${a.title} (${a.publishedAt})\n  요약: ${a.summary}`
    ),
    '',
  ];

  return lines.join('\n');
}
```

`src/core/prompt-builder.ts` 상단에 import 추가:
```typescript
import type { NewsArticle } from '../news/snapshot.js';
```

**Step 4: 테스트 통과 확인**

```bash
npm test 2>&1 | grep -E "PASS|FAIL|buildRoundEvidenceSection"
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/prompt-builder.ts src/core/prompt-builder.test.ts
git commit -m "feat: buildRoundEvidenceSection - 라운드용 뉴스 evidence 프롬프트"
```

---

### Task 4: `DebateContext`에 뉴스 주입 로직 추가

**Files:**
- Modify: `src/core/context.ts`

**Step 1: `DebateContext` 생성자에 `snapshot`과 `newsMode` 추가**

`src/core/context.ts`:

```typescript
import type { Message } from '../providers/types.js';
import type { DebateAttachment, DebateMessage, ParticipantName, ProviderName, NewsMode } from '../types/debate.js';
import { DEBATE_PROMPTS, type PromptBuilders, buildRoundEvidenceSection } from './prompt-builder.js';
import type { EvidenceSnapshot } from '../news/snapshot.js';

export class DebateContext {
  private messages: DebateMessage[] = [];
  private question: string;
  private projectContext?: string;
  private prompts: PromptBuilders;
  private attachments: DebateAttachment[];
  private participants?: ProviderName[];
  private snapshot?: EvidenceSnapshot;   // ← 추가
  private newsMode?: NewsMode;           // ← 추가

  constructor(
    question: string,
    projectContext?: string,
    prompts: PromptBuilders = DEBATE_PROMPTS,
    attachments: DebateAttachment[] = [],
    participants?: ProviderName[],
    snapshot?: EvidenceSnapshot,         // ← 추가
    newsMode?: NewsMode,                 // ← 추가
  ) {
    this.question = question;
    this.projectContext = projectContext;
    this.prompts = prompts;
    this.attachments = attachments;
    this.participants = participants;
    this.snapshot = snapshot;            // ← 추가
    this.newsMode = newsMode;            // ← 추가
  }
  // ... 나머지 메서드 유지
```

**Step 2: `buildOpeningMessage()`에 뉴스 컨텍스트 추가**

`private buildOpeningMessage()` 메서드를 아래와 같이 수정:

```typescript
private buildOpeningMessage(provider?: ProviderName): Message {
  let content = this.prompts.openingPrompt(this.question);

  if (this.snapshot && this.snapshot.articles.length > 0 && provider) {
    const mode = this.getEvidenceModeForProvider(provider);
    const evidenceSection = buildRoundEvidenceSection(mode, this.snapshot.articles);
    if (evidenceSection) {
      content += evidenceSection;
    }
  }

  return {
    role: 'user',
    content,
    attachments: this.attachments.length > 0 ? [...this.attachments] : undefined,
  };
}

private getEvidenceModeForProvider(provider: ProviderName): import('./prompt-builder.js').RoundEvidenceMode {
  if (!this.newsMode || this.newsMode === 'unified') return 'unified';
  const isFirst = !this.participants || this.participants[0] === provider;
  return isFirst ? 'split-first' : 'split-second';
}
```

`buildMessagesFor()`의 `buildOpeningMessage()` 호출 부분을 `buildOpeningMessage(provider)`로 변경 (3곳 모두):
- `result.push(this.buildOpeningMessage());` → `result.push(this.buildOpeningMessage(provider));`

**Step 3: 빌드 및 테스트 확인**

```bash
npm run build 2>&1 | tail -5 && npm test 2>&1 | tail -10
```
Expected: Build success + 테스트 PASS

**Step 4: Commit**

```bash
git add src/core/context.ts
git commit -m "feat: DebateContext에 뉴스 라운드 주입 (unified/split 모드)"
```

---

### Task 5: `DebateOrchestrator`에 `newsMode` 전달

**Files:**
- Modify: `src/core/orchestrator.ts`

**Step 1: `DebateContext` 생성 시 `snapshot`과 `newsMode` 전달**

`orchestrator.ts`의 `run()` 메서드에서 `DebateContext` 생성 부분:

```typescript
// Before:
const context = new DebateContext(
  options.question,
  options.projectContext,
  prompts,
  options.attachments ?? [],
  participants,
);

// After:
const context = new DebateContext(
  options.question,
  options.projectContext,
  prompts,
  options.attachments ?? [],
  participants,
  options.snapshot,      // ← 추가
  options.newsMode,      // ← 추가
);
```

**Step 2: 빌드 확인**

```bash
npm run build 2>&1 | tail -5
```

**Step 3: Commit**

```bash
git add src/core/orchestrator.ts
git commit -m "feat: Orchestrator에서 newsMode를 DebateContext로 전달"
```

---

### Task 6: `/news` 핸들러에 모드 선택 UX 추가

**Files:**
- Modify: `src/repl/handlers/news.ts`

**Step 1: 수집 완료 후 모드 선택 인터랙션 추가**

`src/repl/handlers/news.ts`의 `handleNews()` 함수에서 snapshot 저장 후 모드 선택 추가:

```typescript
import { select } from '@inquirer/prompts';
import type { NewsMode } from '../../types/debate.js';

// snapshot 저장 직후, return 전에 삽입:
let newsMode: NewsMode = 'unified';
try {
  newsMode = await select<NewsMode>({
    message: '뉴스 주입 모드를 선택하세요:',
    choices: [
      { name: '1. unified  — 양측 동일 기사 (기본값)', value: 'unified' },
      { name: '2. split    — 찬반 역할 분리', value: 'split' },
    ],
  });
} catch {
  // TTY 없는 환경이면 unified로 폴백
}

const updatedSession: SessionState = { ...session, snapshot, newsMode };
console.log(`  ${chalk.green('✓')} ${newsMode} 모드 설정됨. 다음 토론부터 적용됩니다.\n`);
```

**Step 2: 빌드 확인**

```bash
npm run build 2>&1 | tail -5
```

**Step 3: Commit**

```bash
git add src/repl/handlers/news.ts
git commit -m "feat: /news 핸들러에 unified/split 모드 선택 UX 추가"
```

---

### Task 7: `handleDebate()`에서 `newsMode` 전달 + `--news-mode` CLI 플래그

**Files:**
- Modify: `src/repl/handlers/debate.ts`
- Modify: `src/repl/cli-args.ts`
- Modify: `src/repl/index.ts`

**Step 1: `cli-args.ts`에 `--news-mode` 플래그 추가**

```typescript
export interface CliArgs {
  news?: boolean;
  newsQuiet?: boolean;
  newsSnapshot?: string;
  newsMode?: 'unified' | 'split';  // ← 추가
  question?: string;
}

// parseCliArgs()의 for 루프에 추가:
} else if (arg === '--news-mode' && (argv[i + 1] === 'unified' || argv[i + 1] === 'split')) {
  args.newsMode = argv[++i] as 'unified' | 'split';
}
```

**Step 2: `debate.ts`의 `DebateOptions`에 `newsMode` 전달**

`src/repl/handlers/debate.ts`의 options 객체:
```typescript
const options: DebateOptions = {
  // ... 기존 필드
  snapshot: session.snapshot,
  newsMode: session.newsMode,  // ← 추가
};
```

**Step 3: `index.ts`에서 `cliArgs.newsMode`를 session에 반영**

`src/repl/index.ts`의 `createDefaultSession` 호출부에:
```typescript
let session = createDefaultSession({
  rounds: config.defaultRounds,
  judge: config.defaultJudge,
  format: config.defaultFormat,
  stream: config.stream,
  newsQuiet: cliArgs?.newsQuiet,
  newsMode: cliArgs?.newsMode,  // ← 추가
});
```

**Step 4: 빌드 및 테스트 확인**

```bash
npm run build 2>&1 | tail -5 && npm test 2>&1 | tail -10
```

**Step 5: Phase 1 최종 Commit**

```bash
git add src/repl/handlers/debate.ts src/repl/cli-args.ts src/repl/index.ts
git commit -m "feat: Phase 1 완료 - 뉴스 라운드 주입 + unified/split 모드"
```

---

## Phase 2: 멀티 뉴스 소스 (NewsAPI + RSS)

### Task 8: `NewsApiProvider` 구현

**Files:**
- Create: `src/news/providers/newsapi.ts`
- Test: `src/news/providers/newsapi.test.ts`

**Step 1: 실패하는 테스트 작성**

`src/news/providers/newsapi.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NewsApiProvider } from './newsapi.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('NewsApiProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('API 응답을 NewsArticle 배열로 변환한다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        articles: [
          {
            title: 'Test Article',
            url: 'https://test.com',
            description: 'Test description',
            publishedAt: '2026-03-02T00:00:00Z',
            source: { name: 'Test Source' },
          },
        ],
      }),
    });

    const provider = new NewsApiProvider('test-key');
    const result = await provider.search('test query');

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Test Article');
    expect(result[0].source).toBe('Test Source');
  });

  it('API 키 없으면 에러를 던진다', () => {
    expect(() => new NewsApiProvider('')).toThrow('NEWS_API_KEY');
  });
});
```

**Step 2: 테스트 실패 확인**

```bash
npm test src/news/providers/newsapi.test.ts 2>&1 | tail -5
```

**Step 3: `NewsApiProvider` 구현**

`src/news/providers/newsapi.ts`:

```typescript
import type { NewsArticle } from '../snapshot.js';
import type { NewsProvider, SearchOptions } from './types.js';

const NEWSAPI_URL = 'https://newsapi.org/v2/everything';

interface NewsApiResponse {
  articles?: Array<{
    title: string;
    url: string;
    description?: string;
    publishedAt?: string;
    source?: { name?: string };
  }>;
}

export class NewsApiProvider implements NewsProvider {
  readonly name = 'NewsAPI';

  constructor(private apiKey: string) {
    if (!apiKey) throw new Error('NEWS_API_KEY is required');
  }

  async search(query: string, options?: SearchOptions): Promise<NewsArticle[]> {
    const params = new URLSearchParams({
      q: query,
      pageSize: String(options?.maxArticles ?? 10),
      language: options?.language ?? 'en',
      sortBy: 'publishedAt',
    });

    const response = await fetch(`${NEWSAPI_URL}?${params}`, {
      headers: { 'X-Api-Key': this.apiKey },
    });

    if (!response.ok) {
      throw new Error(`NewsAPI error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as NewsApiResponse;
    return (data.articles ?? []).map((a) => ({
      title: a.title,
      source: a.source?.name ?? 'NewsAPI',
      url: a.url,
      publishedAt: a.publishedAt ?? new Date().toISOString(),
      summary: a.description ?? '',
      relevanceScore: 0.7,
    }));
  }
}
```

**Step 4: 테스트 통과 확인**

```bash
npm test src/news/providers/newsapi.test.ts 2>&1 | tail -5
```
Expected: PASS

**Step 5: Commit**

```bash
git add src/news/providers/newsapi.ts src/news/providers/newsapi.test.ts
git commit -m "feat: NewsApiProvider - NewsAPI.org 연동"
```

---

### Task 9: `RssProvider` 구현

**Files:**
- Create: `src/news/providers/rss.ts`
- Test: `src/news/providers/rss.test.ts`

**Step 1: 실패하는 테스트 작성**

`src/news/providers/rss.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RssProvider } from './rss.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const RSS_XML = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>RSS Article</title>
      <link>https://example.com/article</link>
      <description>RSS description</description>
      <pubDate>Mon, 02 Mar 2026 00:00:00 +0000</pubDate>
    </item>
  </channel>
</rss>`;

describe('RssProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('RSS XML을 NewsArticle 배열로 파싱한다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => RSS_XML,
    });

    const provider = new RssProvider(['https://example.com/rss'], 'Test Feed');
    const result = await provider.search('any');

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('RSS Article');
    expect(result[0].url).toBe('https://example.com/article');
  });

  it('피드 fetch 실패 시 빈 배열을 반환한다', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const provider = new RssProvider(['https://bad-url.com/rss'], 'Bad Feed');
    const result = await provider.search('any');

    expect(result).toEqual([]);
  });
});
```

**Step 2: 테스트 실패 확인**

```bash
npm test src/news/providers/rss.test.ts 2>&1 | tail -5
```

**Step 3: `RssProvider` 구현 (경량 XML 파싱)**

`src/news/providers/rss.ts`:

```typescript
import type { NewsArticle } from '../snapshot.js';
import type { NewsProvider, SearchOptions } from './types.js';

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '';
}

function parseItems(xml: string): Array<{ title: string; link: string; description: string; pubDate: string }> {
  const items: Array<{ title: string; link: string; description: string; pubDate: string }> = [];
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    items.push({
      title: extractTag(item, 'title'),
      link: extractTag(item, 'link'),
      description: extractTag(item, 'description'),
      pubDate: extractTag(item, 'pubDate'),
    });
  }
  return items;
}

export class RssProvider implements NewsProvider {
  readonly name: string;

  constructor(
    private feedUrls: string[],
    name = 'RSS',
  ) {
    this.name = name;
  }

  async search(_query: string, options?: SearchOptions): Promise<NewsArticle[]> {
    const results = await Promise.allSettled(
      this.feedUrls.map((url) => this.fetchFeed(url, options?.maxArticles ?? 10))
    );

    return results
      .filter((r): r is PromiseFulfilledResult<NewsArticle[]> => r.status === 'fulfilled')
      .flatMap((r) => r.value);
  }

  private async fetchFeed(url: string, maxItems: number): Promise<NewsArticle[]> {
    const response = await fetch(url);
    if (!response.ok) return [];

    const xml = await response.text();
    const channelTitle = extractTag(xml, 'title') || 'RSS';
    const items = parseItems(xml).slice(0, maxItems);

    return items.map((item) => ({
      title: item.title,
      source: channelTitle,
      url: item.link,
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      summary: item.description.slice(0, 200),
      relevanceScore: 0.6,
    }));
  }
}
```

**Step 4: 테스트 통과 확인**

```bash
npm test src/news/providers/rss.test.ts 2>&1 | tail -5
```

**Step 5: Commit**

```bash
git add src/news/providers/rss.ts src/news/providers/rss.test.ts
git commit -m "feat: RssProvider - RSS 피드 파싱"
```

---

### Task 10: `collectEvidence()`를 config 기반으로 교체

**Files:**
- Modify: `src/news/index.ts`
- Modify: `src/config/defaults.ts`

**Step 1: `defaults.ts`에 news 설정 기본값 추가**

`src/config/defaults.ts`에서 export하는 defaults 객체에 추가:

```typescript
export const DEFAULT_NEWS_CONFIG = {
  providers: {
    brave:   { enabled: true },
    newsapi: { enabled: false, apiKeyEnvVar: 'NEWS_API_KEY' },
    rss:     { enabled: false, feeds: [] as string[] },
  },
  maxArticlesPerProvider: 10,
  deduplication: true,
};
```

**Step 2: `src/news/index.ts` 교체**

```typescript
import { BraveNewsProvider } from './providers/brave.js';
import { NewsApiProvider } from './providers/newsapi.js';
import { RssProvider } from './providers/rss.js';
import { EvidenceBuilder } from './evidence-builder.js';
import { writeSnapshot, readSnapshot } from './snapshot-io.js';
import type { EvidenceSnapshot } from './snapshot.js';
import type { NewsProvider, SearchOptions } from './providers/types.js';

export type { EvidenceSnapshot, SearchOptions };
export { readSnapshot, writeSnapshot };

export interface NewsOptions extends SearchOptions {
  quiet?: boolean;
  snapshotFile?: string;
  snapshotDir?: string;
}

interface NewsProviderConfig {
  brave?:   { enabled?: boolean };
  newsapi?: { enabled?: boolean; apiKeyEnvVar?: string };
  rss?:     { enabled?: boolean; feeds?: string[] };
}

function buildProviders(config?: NewsProviderConfig): NewsProvider[] {
  const providers: NewsProvider[] = [];

  const braveEnabled = config?.brave?.enabled !== false;
  if (braveEnabled) {
    const apiKey = process.env.BRAVE_API_KEY;
    if (apiKey) providers.push(new BraveNewsProvider(apiKey));
  }

  if (config?.newsapi?.enabled) {
    const envVar = config.newsapi.apiKeyEnvVar ?? 'NEWS_API_KEY';
    const apiKey = process.env[envVar];
    if (apiKey) providers.push(new NewsApiProvider(apiKey));
  }

  if (config?.rss?.enabled && config.rss.feeds && config.rss.feeds.length > 0) {
    providers.push(new RssProvider(config.rss.feeds));
  }

  return providers;
}

export async function collectEvidence(
  query: string,
  options?: NewsOptions & { providerConfig?: NewsProviderConfig },
): Promise<EvidenceSnapshot> {
  if (options?.snapshotFile) {
    return readSnapshot(options.snapshotFile);
  }

  const providers = buildProviders(options?.providerConfig);

  if (providers.length === 0) {
    throw new Error(
      'No news providers configured.\n' +
      'Set BRAVE_API_KEY or configure newsapi/rss in config.v2.json'
    );
  }

  const builder = new EvidenceBuilder(providers);
  const snapshot = await builder.build(query, options);

  await writeSnapshot(snapshot, options?.snapshotDir);
  return snapshot;
}
```

**Step 3: 빌드 및 테스트 확인**

```bash
npm run build 2>&1 | tail -5 && npm test 2>&1 | tail -10
```

**Step 4: `config.v2.example.json`에 news 섹션 추가**

`config.v2.example.json`의 최상위에 `"news"` 섹션 추가:

```json
"news": {
  "providers": {
    "brave":   { "enabled": true },
    "newsapi": { "enabled": false, "apiKeyEnvVar": "NEWS_API_KEY" },
    "rss": {
      "enabled": false,
      "feeds": [
        "https://feeds.reuters.com/reuters/topNews",
        "https://feeds.bbci.co.uk/news/rss.xml"
      ]
    }
  },
  "maxArticlesPerProvider": 10,
  "deduplication": true
}
```

**Step 5: Phase 2 최종 Commit**

```bash
git add src/news/index.ts src/config/defaults.ts config.v2.example.json
git commit -m "feat: Phase 2 완료 - NewsAPI·RSS 멀티 소스 + config 기반 provider 구성"
```

---

## Phase 3: 대시보드 News 탭

### Task 11: 서버에 `/api/snapshots` 라우트 추가

**Files:**
- Modify: `src/server/index.ts`

**Step 1: snapshot 관련 import 추가**

`src/server/index.ts` 상단에 추가:

```typescript
import { readdir, readFile, unlink } from 'node:fs/promises';
import { collectEvidence } from '../news/index.js';
import type { EvidenceSnapshot } from '../news/snapshot.js';
```

**Step 2: 4개 라우트 추가 (기존 라우트 아래에)**

Hono app 정의 부분에 추가:

```typescript
// GET /api/snapshots — 목록
app.get('/api/snapshots', async (c) => {
  const dir = './ffm-snapshots';
  try {
    const files = await readdir(dir);
    const snapshots = await Promise.all(
      files
        .filter((f) => f.endsWith('.json'))
        .map(async (f) => {
          const raw = await readFile(`${dir}/${f}`, 'utf-8');
          const snap = JSON.parse(raw) as EvidenceSnapshot;
          return {
            id: snap.id,
            query: snap.query,
            collectedAt: snap.collectedAt,
            articleCount: snap.articles.length,
            sources: snap.sources,
          };
        })
    );
    return c.json(snapshots.sort((a, b) => b.collectedAt.localeCompare(a.collectedAt)));
  } catch {
    return c.json([]);
  }
});

// GET /api/snapshots/:id — 상세
app.get('/api/snapshots/:id', async (c) => {
  const id = c.req.param('id');
  const filePath = `./ffm-snapshots/snap-${id}.json`;
  try {
    const raw = await readFile(filePath, 'utf-8');
    return c.json(JSON.parse(raw));
  } catch {
    return c.json({ error: 'Snapshot not found' }, 404);
  }
});

// POST /api/snapshots/collect — 수집
app.post('/api/snapshots/collect', async (c) => {
  const body = await c.req.json<{ query: string; sources?: string[] }>();
  if (!body.query) return c.json({ error: 'query is required' }, 400);
  try {
    const snapshot = await collectEvidence(body.query);
    return c.json({ id: snapshot.id, articleCount: snapshot.articles.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 500);
  }
});

// DELETE /api/snapshots/:id — 삭제
app.delete('/api/snapshots/:id', async (c) => {
  const id = c.req.param('id');
  const filePath = `./ffm-snapshots/snap-${id}.json`;
  try {
    await unlink(filePath);
    return c.json({ ok: true });
  } catch {
    return c.json({ error: 'Snapshot not found' }, 404);
  }
});
```

**Step 3: 빌드 확인**

```bash
npm run build 2>&1 | tail -5
```

**Step 4: Commit**

```bash
git add src/server/index.ts
git commit -m "feat: /api/snapshots 라우트 4개 추가 (목록·상세·수집·삭제)"
```

---

### Task 12: 대시보드 News 탭 UI 추가

**Files:**
- Modify: `dashboard/index.html`

**Step 1: 탭 버튼 추가**

`dashboard/index.html`에서 탭 네비게이션 부분을 찾아 News 탭 버튼 추가:

```html
<button class="tab-btn" data-tab="news">📰 News</button>
```

**Step 2: News 탭 패널 HTML 추가**

기존 탭 패널 아래에 추가:

```html
<div id="tab-news" class="tab-panel" style="display:none">
  <div class="panel">
    <h3>🔍 뉴스 수집</h3>
    <div class="form-row">
      <input id="news-query" type="text" placeholder="검색어 입력 (예: Trump tariffs)" style="flex:1" />
      <button id="news-collect-btn" class="btn-primary">수집</button>
    </div>
    <div id="news-collect-status" style="margin-top:8px;color:#888;font-size:13px"></div>
  </div>

  <div class="panel" style="margin-top:16px">
    <h3>📚 스냅샷 라이브러리</h3>
    <button id="news-refresh-btn" class="btn-secondary" style="margin-bottom:12px">새로고침</button>
    <div id="snapshot-list">로드 중...</div>
  </div>

  <!-- 기사 모달 -->
  <div id="snapshot-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:100">
    <div style="background:#1e1e1e;margin:40px auto;max-width:700px;padding:24px;border-radius:8px;max-height:80vh;overflow-y:auto">
      <h3 id="modal-title"></h3>
      <div id="modal-articles"></div>
      <button onclick="document.getElementById('snapshot-modal').style.display='none'" class="btn-secondary" style="margin-top:16px">닫기</button>
    </div>
  </div>
</div>
```

**Step 3: JavaScript 추가**

`dashboard/index.html`의 `<script>` 섹션에 추가:

```javascript
// ─── News Tab ───────────────────────────────────────
async function loadSnapshots() {
  const list = document.getElementById('snapshot-list');
  try {
    const res = await fetch('/api/snapshots');
    const snapshots = await res.json();
    if (snapshots.length === 0) {
      list.innerHTML = '<p style="color:#888">저장된 스냅샷이 없습니다.</p>';
      return;
    }
    list.innerHTML = snapshots.map(s => `
      <div class="snapshot-row" style="border:1px solid #333;border-radius:6px;padding:12px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong>${escapeHtml(s.query)}</strong>
            <span style="color:#888;margin-left:8px;font-size:12px">${s.collectedAt.slice(0,10)} · ${s.articleCount}건</span>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn-primary" onclick="useSnapshot('${s.id}','${escapeHtml(s.query)}')">토론에 사용</button>
            <button class="btn-secondary" onclick="viewSnapshot('${s.id}','${escapeHtml(s.query)}')">기사 보기</button>
            <button class="btn-danger" onclick="deleteSnapshot('${s.id}')">삭제</button>
          </div>
        </div>
      </div>
    `).join('');
  } catch {
    list.innerHTML = '<p style="color:#f00">스냅샷 로드 실패</p>';
  }
}

async function viewSnapshot(id, query) {
  const res = await fetch(`/api/snapshots/${id}`);
  const snap = await res.json();
  document.getElementById('modal-title').textContent = `"${query}" — ${snap.articles.length}건`;
  document.getElementById('modal-articles').innerHTML = snap.articles.map(a => `
    <div style="border-bottom:1px solid #333;padding:8px 0">
      <a href="${a.url}" target="_blank" style="color:#7eb6f0">${escapeHtml(a.title)}</a>
      <div style="color:#888;font-size:12px">[${escapeHtml(a.source)}] ${a.publishedAt.slice(0,10)}</div>
      <div style="font-size:13px;margin-top:4px">${escapeHtml(a.summary)}</div>
    </div>
  `).join('');
  document.getElementById('snapshot-modal').style.display = 'block';
}

async function deleteSnapshot(id) {
  if (!confirm('삭제할까요?')) return;
  await fetch(`/api/snapshots/${id}`, { method: 'DELETE' });
  loadSnapshots();
}

function useSnapshot(id, query) {
  // Command Gateway의 snapshotId 필드에 세팅 (대시보드 기존 폼 연동)
  const snapshotIdField = document.getElementById('input-snapshotId');
  if (snapshotIdField) snapshotIdField.value = id;
  // Debates 탭으로 이동
  document.querySelector('[data-tab="gateway"]')?.click();
  alert(`스냅샷 "${query}" 선택됨. 질문을 입력하고 Run Debate를 클릭하세요.`);
}

document.getElementById('news-collect-btn')?.addEventListener('click', async () => {
  const query = document.getElementById('news-query').value.trim();
  if (!query) return;
  const status = document.getElementById('news-collect-status');
  status.textContent = '수집 중...';
  try {
    const res = await fetch('/api/snapshots/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    status.textContent = `✓ ${data.articleCount}건 수집 완료 (ID: ${data.id})`;
    loadSnapshots();
  } catch (err) {
    status.textContent = `✗ 실패: ${err.message}`;
  }
});

document.getElementById('news-refresh-btn')?.addEventListener('click', loadSnapshots);

// News 탭 활성화 시 자동 로드
document.querySelector('[data-tab="news"]')?.addEventListener('click', loadSnapshots);
```

**Step 4: 빌드 확인**

```bash
npm run build 2>&1 | tail -5
```

**Step 5: Phase 3 최종 Commit**

```bash
git add dashboard/index.html
git commit -m "feat: Phase 3 완료 - 대시보드 News 탭 (스냅샷 라이브러리)"
```

---

## 수동 E2E 테스트 체크리스트

```
[ ] ffm > /news "Trump tariffs" → 기사 수집 → 모드 선택 프롬프트 표시
[ ] unified 선택 → 토론 질문 입력 → 라운드 프롬프트에 기사 포함 확인
[ ] split 선택 → 토론 → 첫 번째 참가자와 두 번째 참가자가 다른 기사 받는지 확인
[ ] NEWS_API_KEY 설정 후 config.v2.json newsapi.enabled=true → 수집 시 NewsAPI 결과 포함
[ ] RSS feeds 추가 → 수집 시 RSS 기사 포함
[ ] ffm > /dashboard → http://localhost:3847 → News 탭 확인
[ ] News 탭에서 수집 → 목록 표시 → 기사 보기 → 삭제 동작 확인
[ ] "토론에 사용" → Debates 탭으로 이동 → 토론 실행
```
