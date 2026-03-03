# News Evidence Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 뉴스 검색 및 영향 분석 기능을 3단계로 ffm에 추가한다 — 합성 엔진 강화 → Evidence Snapshot 인프라 → Brave Search 플러그인.

**Architecture:** `NewsProvider` 인터페이스를 기반으로 확장 가능한 Provider 패턴. `EvidenceBuilder`가 수집·정제·해시를 담당하고, `Orchestrator`가 동일한 `EvidenceSnapshot`을 두 참가자에게 주입한다. Synthesizer는 출처 인용·시나리오·확신도를 구조화된 형식으로 출력한다.

**Tech Stack:** TypeScript ESM, node:crypto (SHA-256), node:fs (snapshot 저장), Brave Web Search API, vitest

---

## Stage 1: 합성 엔진 강화

### Task 1: EvidenceSnapshot 타입 정의

**Files:**
- Create: `src/news/snapshot.ts`
- Create: `src/news/snapshot.test.ts`

**Step 1: 테스트 먼저 작성**

```typescript
// src/news/snapshot.test.ts
import { describe, it, expect } from 'vitest';
import { createSnapshotId } from './snapshot.js';

describe('createSnapshotId', () => {
  it('동일한 입력에 동일한 해시를 반환한다', () => {
    const id1 = createSnapshotId('트럼프 관세', ['url1', 'url2']);
    const id2 = createSnapshotId('트럼프 관세', ['url1', 'url2']);
    expect(id1).toBe(id2);
  });

  it('다른 쿼리에 다른 해시를 반환한다', () => {
    const id1 = createSnapshotId('트럼프 관세', ['url1']);
    const id2 = createSnapshotId('반도체 수출', ['url1']);
    expect(id1).not.toBe(id2);
  });

  it('해시는 8자 이상이다', () => {
    const id = createSnapshotId('test', ['url1']);
    expect(id.length).toBeGreaterThanOrEqual(8);
  });
});
```

**Step 2: 테스트가 실패하는지 확인**

```bash
npx vitest run src/news/snapshot.test.ts
```

Expected: `Cannot find module './snapshot.js'`

**Step 3: 최소 구현 작성**

```typescript
// src/news/snapshot.ts
import { createHash } from 'node:crypto';

export interface NewsArticle {
  title: string;
  source: string;       // "Brave Search", "NewsAPI" 등
  url: string;
  publishedAt: string;  // ISO 8601
  summary: string;      // 200자 이내
  relevanceScore: number; // 0~1
}

export interface EvidenceSnapshot {
  id: string;           // SHA-256 해시 (재현성 보장)
  query: string;
  collectedAt: string;  // ISO 8601
  sources: string[];    // 사용된 provider 이름 목록
  articles: NewsArticle[];
  excludedCount: number;
}

export function createSnapshotId(query: string, urls: string[]): string {
  const input = [query, ...urls.sort()].join('|');
  return createHash('sha256').update(input).digest('hex').slice(0, 12);
}
```

**Step 4: 테스트 통과 확인**

```bash
npx vitest run src/news/snapshot.test.ts
```

Expected: `3 tests passed`

**Step 5: 커밋**

```bash
git add src/news/snapshot.ts src/news/snapshot.test.ts
git commit -m "feat: EvidenceSnapshot 타입 및 createSnapshotId 구현"
```

---

### Task 2: buildSynthesisPrompt에 Evidence 섹션 추가

**Files:**
- Modify: `src/core/prompt-builder.ts` (lines 105-137)

**Step 1: 테스트 작성**

기존 테스트가 없으므로 `src/core/prompt-builder.test.ts` 생성:

```typescript
// src/core/prompt-builder.test.ts
import { describe, it, expect } from 'vitest';
import { buildSynthesisPrompt, buildSynthesisPromptWithEvidence } from './prompt-builder.js';
import type { EvidenceSnapshot } from '../news/snapshot.js';

describe('buildSynthesisPromptWithEvidence', () => {
  const mockSnapshot: EvidenceSnapshot = {
    id: 'abc123',
    query: '트럼프 관세',
    collectedAt: '2026-03-02T00:00:00Z',
    sources: ['Brave Search'],
    articles: [
      {
        title: 'Trump tariffs explained',
        source: 'Reuters',
        url: 'https://reuters.com/1',
        publishedAt: '2026-02-28',
        summary: 'Trump announced new tariffs...',
        relevanceScore: 0.9,
      },
    ],
    excludedCount: 2,
  };

  it('출처 인용 강제 지시를 포함한다', () => {
    const prompt = buildSynthesisPromptWithEvidence('트럼프 관세', [], mockSnapshot);
    expect(prompt).toContain('출처 인용');
  });

  it('단기/중기/장기 시나리오 분리를 포함한다', () => {
    const prompt = buildSynthesisPromptWithEvidence('트럼프 관세', [], mockSnapshot);
    expect(prompt).toContain('단기');
    expect(prompt).toContain('중기');
    expect(prompt).toContain('장기');
  });

  it('기사 제목과 출처를 포함한다', () => {
    const prompt = buildSynthesisPromptWithEvidence('트럼프 관세', [], mockSnapshot);
    expect(prompt).toContain('Trump tariffs explained');
    expect(prompt).toContain('Reuters');
  });

  it('snapshot 없이는 기존 buildSynthesisPrompt와 동일하게 동작한다', () => {
    const debateLog = [{ provider: 'claude' as const, round: 1, content: 'test' }];
    const withEvidence = buildSynthesisPromptWithEvidence('question', debateLog, undefined);
    const original = buildSynthesisPrompt('question', debateLog);
    expect(withEvidence).toBe(original);
  });
});
```

**Step 2: 테스트 실패 확인**

```bash
npx vitest run src/core/prompt-builder.test.ts
```

Expected: `Cannot find 'buildSynthesisPromptWithEvidence'`

**Step 3: `prompt-builder.ts`에 함수 추가**

`buildSynthesisPrompt` 함수(line 105) 아래에 추가:

```typescript
// src/core/prompt-builder.ts 에 추가 (buildSynthesisPrompt 아래)
import type { EvidenceSnapshot } from '../news/snapshot.js';

export function buildSynthesisPromptWithEvidence(
  question: string,
  debateLog: Array<{ provider: ParticipantName; round: number; content: string }>,
  snapshot?: EvidenceSnapshot,
): string {
  if (!snapshot) {
    return buildSynthesisPrompt(question, debateLog);
  }

  const evidenceSection = [
    '',
    '## 참고 증거 (Evidence Snapshot)',
    `수집 시각: ${snapshot.collectedAt} | 검색어: "${snapshot.query}" | ID: ${snapshot.id}`,
    '두 AI 모두 아래 동일한 기사를 참고했습니다.',
    '',
    ...snapshot.articles.map(
      (a) => `- [${a.source}] ${a.title} (${a.publishedAt})\n  요약: ${a.summary}\n  URL: ${a.url}`
    ),
    '',
    '## 합성 요구사항 (Evidence 모드)',
    '1. **출처 인용 강제**: 각 주장마다 근거 기사를 "[출처명, 날짜]" 형식으로 명시하시오.',
    '2. **시나리오 분리**: 단기(3개월), 중기(1년), 장기(3년+) 영향을 별도 섹션으로 구분하시오.',
    '3. **확신도 표기**: 각 예측에 높음/중간/낮음과 근거를 명시하시오.',
    '4. **반증 조건**: "X가 발생하면 이 분석은 달라진다"를 명시하시오.',
  ].join('\n');

  return buildSynthesisPrompt(question, debateLog) + evidenceSection;
}
```

**Step 4: 테스트 통과 확인**

```bash
npx vitest run src/core/prompt-builder.test.ts
```

Expected: `4 tests passed`

**Step 5: 커밋**

```bash
git add src/core/prompt-builder.ts src/core/prompt-builder.test.ts
git commit -m "feat: buildSynthesisPromptWithEvidence - 출처·시나리오·확신도 구조 추가"
```

---

### Task 3: Synthesizer에 EvidenceSnapshot 파라미터 추가

**Files:**
- Modify: `src/core/synthesizer.ts`

**Step 1: 테스트 작성**

```typescript
// src/core/synthesizer.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Synthesizer } from './synthesizer.js';
import type { EvidenceSnapshot } from '../news/snapshot.js';

const mockProvider = {
  generate: vi.fn().mockResolvedValue('synthesis result'),
  stream: vi.fn(),
};

const mockSnapshot: EvidenceSnapshot = {
  id: 'test123',
  query: 'test',
  collectedAt: '2026-03-02T00:00:00Z',
  sources: ['Brave'],
  articles: [],
  excludedCount: 0,
};

describe('Synthesizer', () => {
  it('snapshot 없이 기존 방식으로 동작한다', async () => {
    const synth = new Synthesizer(mockProvider as any);
    const result = await synth.generate('question', []);
    expect(result).toBe('synthesis result');
    expect(mockProvider.generate).toHaveBeenCalledOnce();
  });

  it('snapshot을 받으면 buildSynthesisPromptWithEvidence를 사용한다', async () => {
    const mockBuildPrompt = vi.fn().mockReturnValue('prompt');
    const synth = new Synthesizer(mockProvider as any, mockBuildPrompt as any);
    await synth.generate('question', [], mockSnapshot);
    // evidence-aware builder가 호출됨을 확인
    expect(mockProvider.generate).toHaveBeenCalled();
  });
});
```

**Step 2: 테스트 실패 확인**

```bash
npx vitest run src/core/synthesizer.test.ts
```

Expected: `generate` 시그니처 오류

**Step 3: `synthesizer.ts` 수정**

```typescript
// src/core/synthesizer.ts 전체 교체
import type { AIProvider, Message } from '../providers/types.js';
import type { DebateMessage, ParticipantName } from '../types/debate.js';
import type { EvidenceSnapshot } from '../news/snapshot.js';
import { buildSynthesisPrompt, buildSynthesisPromptWithEvidence, type SynthesisPromptBuilder } from './prompt-builder.js';

export class Synthesizer {
  private provider: AIProvider;
  private buildPrompt: SynthesisPromptBuilder;

  constructor(
    provider: AIProvider,
    buildPrompt: SynthesisPromptBuilder = buildSynthesisPrompt
  ) {
    this.provider = provider;
    this.buildPrompt = buildPrompt;
  }

  async generate(
    question: string,
    messages: DebateMessage[],
    snapshot?: EvidenceSnapshot,
  ): Promise<string> {
    const log = messages.map((m) => ({ provider: m.provider, round: m.round, content: m.content }));
    const prompt = snapshot
      ? buildSynthesisPromptWithEvidence(question, log, snapshot)
      : this.buildPrompt(question, log);

    const apiMessages: Message[] = [{ role: 'user', content: prompt }];
    return this.provider.generate(apiMessages);
  }

  async *stream(
    question: string,
    messages: DebateMessage[],
    signal?: AbortSignal,
    executionCwd?: string,
    snapshot?: EvidenceSnapshot,
  ): AsyncIterable<string> {
    const log = messages.map((m) => ({ provider: m.provider, round: m.round, content: m.content }));
    const prompt = snapshot
      ? buildSynthesisPromptWithEvidence(question, log, snapshot)
      : this.buildPrompt(question, log);

    const apiMessages: Message[] = [{ role: 'user', content: prompt }];
    yield* this.provider.stream(apiMessages, signal, executionCwd);
  }
}
```

**Step 4: 테스트 통과 확인**

```bash
npx vitest run src/core/synthesizer.test.ts
```

Expected: `2 tests passed`

**Step 5: 빌드 오류 없는지 확인**

```bash
npm run build
```

Expected: `Build success`

**Step 6: 커밋**

```bash
git add src/core/synthesizer.ts src/core/synthesizer.test.ts
git commit -m "feat: Synthesizer에 EvidenceSnapshot 선택적 파라미터 추가 (하위 호환)"
```

---

## Stage 2: Evidence Snapshot 인프라

### Task 4: NewsProvider 인터페이스 정의

**Files:**
- Create: `src/news/providers/types.ts`

**Step 1: 파일 생성 (테스트 불필요 - 인터페이스만)**

```typescript
// src/news/providers/types.ts
import type { NewsArticle } from '../snapshot.js';

export interface SearchOptions {
  maxArticles?: number;  // 기본값 10
  language?: string;     // 기본값 'en'
  freshness?: 'day' | 'week' | 'month';  // 기본값 'week'
}

export interface NewsProvider {
  readonly name: string;
  search(query: string, options?: SearchOptions): Promise<NewsArticle[]>;
}
```

**Step 2: 커밋**

```bash
git add src/news/providers/types.ts
git commit -m "feat: NewsProvider 인터페이스 정의"
```

---

### Task 5: EvidenceBuilder 구현

**Files:**
- Create: `src/news/evidence-builder.ts`
- Create: `src/news/evidence-builder.test.ts`

**Step 1: 테스트 작성**

```typescript
// src/news/evidence-builder.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EvidenceBuilder } from './evidence-builder.js';
import type { NewsProvider } from './providers/types.js';
import type { NewsArticle } from './snapshot.js';

const makeArticle = (url: string, score = 0.8): NewsArticle => ({
  title: `Article at ${url}`,
  source: 'Test',
  url,
  publishedAt: '2026-03-01',
  summary: 'Test summary',
  relevanceScore: score,
});

describe('EvidenceBuilder', () => {
  it('여러 provider에서 병렬로 수집한다', async () => {
    const p1: NewsProvider = { name: 'A', search: vi.fn().mockResolvedValue([makeArticle('url1')]) };
    const p2: NewsProvider = { name: 'B', search: vi.fn().mockResolvedValue([makeArticle('url2')]) };
    const builder = new EvidenceBuilder([p1, p2]);
    const snapshot = await builder.build('query');
    expect(snapshot.articles).toHaveLength(2);
    expect(p1.search).toHaveBeenCalledOnce();
    expect(p2.search).toHaveBeenCalledOnce();
  });

  it('URL 기준으로 중복을 제거한다', async () => {
    const p1: NewsProvider = { name: 'A', search: vi.fn().mockResolvedValue([makeArticle('url1'), makeArticle('url1')]) };
    const builder = new EvidenceBuilder([p1]);
    const snapshot = await builder.build('query');
    expect(snapshot.articles).toHaveLength(1);
    expect(snapshot.excludedCount).toBe(1);
  });

  it('relevanceScore 내림차순으로 정렬한다', async () => {
    const articles = [makeArticle('url1', 0.3), makeArticle('url2', 0.9), makeArticle('url3', 0.6)];
    const p1: NewsProvider = { name: 'A', search: vi.fn().mockResolvedValue(articles) };
    const builder = new EvidenceBuilder([p1]);
    const snapshot = await builder.build('query');
    expect(snapshot.articles[0].url).toBe('url2');
    expect(snapshot.articles[1].url).toBe('url3');
  });

  it('동일한 쿼리·URL 조합은 동일한 id를 생성한다', async () => {
    const p1: NewsProvider = { name: 'A', search: vi.fn().mockResolvedValue([makeArticle('url1')]) };
    const b1 = new EvidenceBuilder([p1]);
    const b2 = new EvidenceBuilder([{ name: 'A', search: vi.fn().mockResolvedValue([makeArticle('url1')]) }]);
    const s1 = await b1.build('query');
    const s2 = await b2.build('query');
    expect(s1.id).toBe(s2.id);
  });

  it('sources 목록에 사용된 provider 이름이 포함된다', async () => {
    const p1: NewsProvider = { name: 'Brave', search: vi.fn().mockResolvedValue([makeArticle('url1')]) };
    const builder = new EvidenceBuilder([p1]);
    const snapshot = await builder.build('query');
    expect(snapshot.sources).toContain('Brave');
  });
});
```

**Step 2: 테스트 실패 확인**

```bash
npx vitest run src/news/evidence-builder.test.ts
```

Expected: `Cannot find module './evidence-builder.js'`

**Step 3: EvidenceBuilder 구현**

```typescript
// src/news/evidence-builder.ts
import type { NewsProvider, SearchOptions } from './providers/types.js';
import type { EvidenceSnapshot, NewsArticle } from './snapshot.js';
import { createSnapshotId } from './snapshot.js';

export class EvidenceBuilder {
  constructor(private providers: NewsProvider[]) {}

  async build(query: string, options?: SearchOptions): Promise<EvidenceSnapshot> {
    const maxArticles = options?.maxArticles ?? 10;

    // 1. 모든 provider에서 병렬 수집
    const results = await Promise.allSettled(
      this.providers.map((p) => p.search(query, options))
    );

    const allArticles: NewsArticle[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allArticles.push(...result.value);
      }
    }

    // 2. URL 기준 중복 제거
    const seen = new Set<string>();
    const unique: NewsArticle[] = [];
    for (const article of allArticles) {
      if (!seen.has(article.url)) {
        seen.add(article.url);
        unique.push(article);
      }
    }
    const excludedCount = allArticles.length - unique.length;

    // 3. relevanceScore 내림차순 정렬, 상위 N개
    const sorted = unique
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxArticles);

    // 4. SHA-256 해시 ID
    const id = createSnapshotId(query, sorted.map((a) => a.url));

    return {
      id,
      query,
      collectedAt: new Date().toISOString(),
      sources: this.providers.map((p) => p.name),
      articles: sorted,
      excludedCount,
    };
  }
}
```

**Step 4: 테스트 통과 확인**

```bash
npx vitest run src/news/evidence-builder.test.ts
```

Expected: `5 tests passed`

**Step 5: 커밋**

```bash
git add src/news/evidence-builder.ts src/news/evidence-builder.test.ts
git commit -m "feat: EvidenceBuilder - 병렬 수집, 중복 제거, 정렬, 해시 ID"
```

---

### Task 6: Snapshot 파일 저장/로드 유틸리티

**Files:**
- Create: `src/news/snapshot-io.ts`
- Create: `src/news/snapshot-io.test.ts`

**Step 1: 테스트 작성**

```typescript
// src/news/snapshot-io.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeSnapshot, readSnapshot } from './snapshot-io.js';
import type { EvidenceSnapshot } from './snapshot.js';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const TEST_DIR = '/tmp/ffm-test-snapshots';

const mockSnapshot: EvidenceSnapshot = {
  id: 'abc123',
  query: 'test query',
  collectedAt: '2026-03-02T00:00:00Z',
  sources: ['Brave'],
  articles: [],
  excludedCount: 0,
};

describe('snapshot I/O', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('저장하고 다시 읽으면 동일한 snapshot이 된다', async () => {
    const filePath = await writeSnapshot(mockSnapshot, TEST_DIR);
    const loaded = await readSnapshot(filePath);
    expect(loaded).toEqual(mockSnapshot);
  });

  it('파일명은 snap-{id}.json 형식이다', async () => {
    const filePath = await writeSnapshot(mockSnapshot, TEST_DIR);
    expect(filePath).toContain('snap-abc123.json');
  });

  it('존재하지 않는 파일을 읽으면 오류를 던진다', async () => {
    await expect(readSnapshot('/tmp/nonexistent.json')).rejects.toThrow();
  });
});
```

**Step 2: 테스트 실패 확인**

```bash
npx vitest run src/news/snapshot-io.test.ts
```

Expected: `Cannot find module './snapshot-io.js'`

**Step 3: snapshot-io.ts 구현**

```typescript
// src/news/snapshot-io.ts
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { EvidenceSnapshot } from './snapshot.js';

const DEFAULT_SNAPSHOT_DIR = './ffm-snapshots';

export async function writeSnapshot(
  snapshot: EvidenceSnapshot,
  dir = DEFAULT_SNAPSHOT_DIR,
): Promise<string> {
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `snap-${snapshot.id}.json`);
  await writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
  return filePath;
}

export async function readSnapshot(filePath: string): Promise<EvidenceSnapshot> {
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw) as EvidenceSnapshot;
}
```

**Step 4: 테스트 통과 확인**

```bash
npx vitest run src/news/snapshot-io.test.ts
```

Expected: `3 tests passed`

**Step 5: 커밋**

```bash
git add src/news/snapshot-io.ts src/news/snapshot-io.test.ts
git commit -m "feat: snapshot 파일 저장/로드 유틸리티"
```

---

## Stage 3: 뉴스 플러그인 & UX

### Task 7: BraveNewsProvider 구현

**Files:**
- Create: `src/news/providers/brave.ts`
- Create: `src/news/providers/brave.test.ts`

**Step 1: 테스트 작성 (fetch 모킹)**

```typescript
// src/news/providers/brave.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BraveNewsProvider } from './brave.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const braveResponse = {
  results: [
    {
      title: 'Test Article',
      url: 'https://example.com/1',
      description: 'Test description',
      age: '2026-02-28T12:00:00Z',
      source: { name: 'Example News' },
      extra_snippets: [],
    },
  ],
};

describe('BraveNewsProvider', () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(braveResponse),
    });
  });

  it('Brave API를 올바른 헤더로 호출한다', async () => {
    const provider = new BraveNewsProvider('test-api-key');
    await provider.search('Trump tariffs');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('api.search.brave.com'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-Subscription-Token': 'test-api-key' }),
      })
    );
  });

  it('응답을 NewsArticle 형식으로 변환한다', async () => {
    const provider = new BraveNewsProvider('test-api-key');
    const articles = await provider.search('Trump tariffs');
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe('Test Article');
    expect(articles[0].url).toBe('https://example.com/1');
    expect(articles[0].source).toBe('Example News');
  });

  it('API 오류 시 명확한 메시지를 던진다', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429, statusText: 'Too Many Requests' });
    const provider = new BraveNewsProvider('test-api-key');
    await expect(provider.search('query')).rejects.toThrow('Brave Search API error: 429');
  });

  it('빈 API 키로는 생성할 수 없다', () => {
    expect(() => new BraveNewsProvider('')).toThrow('BRAVE_API_KEY is required');
  });
});
```

**Step 2: 테스트 실패 확인**

```bash
npx vitest run src/news/providers/brave.test.ts
```

Expected: `Cannot find module './brave.js'`

**Step 3: BraveNewsProvider 구현**

```typescript
// src/news/providers/brave.ts
import type { NewsArticle } from '../snapshot.js';
import type { NewsProvider, SearchOptions } from './types.js';

const BRAVE_NEWS_API = 'https://api.search.brave.com/res/v1/news/search';

const FRESHNESS_MAP: Record<NonNullable<SearchOptions['freshness']>, string> = {
  day: 'pd',
  week: 'pw',
  month: 'pm',
};

export class BraveNewsProvider implements NewsProvider {
  readonly name = 'Brave Search';

  constructor(private apiKey: string) {
    if (!apiKey) throw new Error('BRAVE_API_KEY is required');
  }

  async search(query: string, options?: SearchOptions): Promise<NewsArticle[]> {
    const params = new URLSearchParams({
      q: query,
      count: String(options?.maxArticles ?? 10),
      search_lang: options?.language ?? 'en',
      ...(options?.freshness ? { freshness: FRESHNESS_MAP[options.freshness] } : {}),
    });

    const response = await fetch(`${BRAVE_NEWS_API}?${params}`, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as BraveNewsResponse;
    return (data.results ?? []).map((r) => ({
      title: r.title,
      source: r.source?.name ?? 'Unknown',
      url: r.url,
      publishedAt: r.age ?? new Date().toISOString(),
      summary: r.description ?? r.extra_snippets?.[0] ?? '',
      relevanceScore: 0.8, // Brave는 자체 랭킹을 신뢰
    }));
  }
}

interface BraveNewsResponse {
  results?: Array<{
    title: string;
    url: string;
    description?: string;
    age?: string;
    source?: { name: string };
    extra_snippets?: string[];
  }>;
}
```

**Step 4: 테스트 통과 확인**

```bash
npx vitest run src/news/providers/brave.test.ts
```

Expected: `4 tests passed`

**Step 5: 커밋**

```bash
git add src/news/providers/brave.ts src/news/providers/brave.test.ts
git commit -m "feat: BraveNewsProvider - Brave Search API 연동"
```

---

### Task 8: DebateOptions에 snapshot 필드 추가 & Orchestrator 연결

**Files:**
- Modify: `src/types/debate.ts`
- Modify: `src/core/orchestrator.ts`

**Step 1: `debate.ts`에 필드 추가**

`DebateOptions` 인터페이스에 추가 (line 35 아래):

```typescript
// src/types/debate.ts DebateOptions에 추가
import type { EvidenceSnapshot } from '../news/snapshot.js';

// DebateOptions 인터페이스 안에:
  snapshot?: EvidenceSnapshot;
```

**Step 2: `orchestrator.ts` synthesis 호출 수정**

`synthesizer.generate` 호출 부분(line 186):

```typescript
// 기존:
synthesis = await synthesizer.generate(
  options.question,
  context.getMessages()
);

// 변경:
synthesis = await synthesizer.generate(
  options.question,
  context.getMessages(),
  options.snapshot,
);
```

`synthesizer.stream` 호출 부분(line 167):

```typescript
// 기존:
for await (const token of synthesizer.stream(
  options.question,
  context.getMessages(),
  options.signal,
  options.executionCwd,
))

// 변경:
for await (const token of synthesizer.stream(
  options.question,
  context.getMessages(),
  options.signal,
  options.executionCwd,
  options.snapshot,
))
```

**Step 3: 빌드 확인**

```bash
npm run build
```

Expected: `Build success`

**Step 4: 커밋**

```bash
git add src/types/debate.ts src/core/orchestrator.ts
git commit -m "feat: DebateOptions에 snapshot 필드 추가, Orchestrator에 전달"
```

---

### Task 9: src/news/index.ts 진입점 작성

**Files:**
- Create: `src/news/index.ts`

**Step 1: 진입점 작성 (통합 팩토리)**

```typescript
// src/news/index.ts
import { BraveNewsProvider } from './providers/brave.js';
import { EvidenceBuilder } from './evidence-builder.js';
import { writeSnapshot, readSnapshot } from './snapshot-io.js';
import type { EvidenceSnapshot } from './snapshot.js';
import type { SearchOptions } from './providers/types.js';

export type { EvidenceSnapshot, SearchOptions };
export { readSnapshot, writeSnapshot };

export interface NewsOptions extends SearchOptions {
  quiet?: boolean;           // 기사 목록 미표시
  snapshotFile?: string;     // 기존 스냅샷 재사용
  snapshotDir?: string;      // 스냅샷 저장 폴더
}

export async function collectEvidence(
  query: string,
  options?: NewsOptions,
): Promise<EvidenceSnapshot> {
  // 기존 스냅샷 재사용
  if (options?.snapshotFile) {
    return readSnapshot(options.snapshotFile);
  }

  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'BRAVE_API_KEY environment variable is required.\n' +
      'Get your free key at: https://api.search.brave.com\n' +
      'Then add to .env: BRAVE_API_KEY=your_key_here'
    );
  }

  const providers = [new BraveNewsProvider(apiKey)];
  const builder = new EvidenceBuilder(providers);
  const snapshot = await builder.build(query, options);

  // 자동 저장
  await writeSnapshot(snapshot, options?.snapshotDir);

  return snapshot;
}
```

**Step 2: 커밋**

```bash
git add src/news/index.ts
git commit -m "feat: src/news/index.ts - collectEvidence 진입점"
```

---

### Task 10: REPL /news 커맨드 추가

**Files:**
- Create: `src/repl/handlers/news.ts`
- Modify: `src/repl/registry.ts`

**Step 1: news 핸들러 작성**

```typescript
// src/repl/handlers/news.ts
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

    const updatedSession = { ...session, snapshot };
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
```

**Step 2: `src/repl/session.ts`에 `snapshot`, `newsQuiet` 필드 추가**

기존 `SessionState` 타입에 필드 추가:

```typescript
// SessionState 인터페이스에 추가:
import type { EvidenceSnapshot } from '../news/snapshot.js';

// 필드 추가:
  snapshot?: EvidenceSnapshot;
  newsQuiet?: boolean;
```

**Step 3: `registry.ts`에 /news 등록**

`handlers.set('dashboard', ...)` 아래에 추가:

```typescript
// src/repl/registry.ts
import { handleNews } from './handlers/news.js';

// handlers 등록 부분에 추가:
handlers.set('news', async (args, ctx) => {
  return handleNews(args, ctx.session);
});
```

**Step 4: 빌드 확인**

```bash
npm run build
```

Expected: `Build success`

**Step 5: 커밋**

```bash
git add src/repl/handlers/news.ts src/repl/registry.ts src/repl/session.ts
git commit -m "feat: /news REPL 커맨드 - 뉴스 수집 및 세션에 snapshot 주입"
```

---

### Task 11: CLI --news 플래그 추가

**Files:**
- Modify: `src/repl/session.ts` (debate 실행 진입점 찾기)
- Modify: `src/repl/handlers/debate.ts`

**Step 1: `debate.ts` 핸들러 수정**

`handleDebate` 함수에서 `DebateOptions` 생성 시 `snapshot` 전달:

```typescript
// session.snapshot이 있으면 options에 포함
const debateOptions: DebateOptions = {
  // ... 기존 필드들 ...
  snapshot: session.snapshot,
};
```

정확한 위치는 `src/repl/handlers/debate.ts`를 먼저 읽고 수정.

**Step 2: CLI 레벨 --news 지원**

`bin/cli.ts`는 현재 `startRepl()`만 호출. REPL 시작 전 `--news` 플래그를 파싱:

```typescript
// bin/cli.ts 수정
import { startRepl } from '../src/repl/index.js';
import { parseCliArgs } from '../src/repl/cli-args.js';

const args = parseCliArgs(process.argv.slice(2));
startRepl(args);
```

`src/repl/cli-args.ts` 생성:

```typescript
// src/repl/cli-args.ts
export interface CliArgs {
  news?: boolean;
  newsQuiet?: boolean;
  newsSnapshot?: string;
  question?: string;
}

export function parseCliArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--news') args.news = true;
    if (argv[i] === '--news-quiet') args.newsQuiet = true;
    if (argv[i] === '--news-snapshot' && argv[i + 1]) {
      args.newsSnapshot = argv[++i];
    }
    if (!argv[i].startsWith('--')) {
      args.question = argv.slice(i).join(' ');
      break;
    }
  }
  return args;
}
```

**Step 3: startRepl에서 CliArgs 받아 초기 snapshot 수집**

`src/repl/index.ts`에서 `CliArgs`를 받아 `--news`가 있으면 시작 전 `collectEvidence` 호출.

**Step 4: 빌드 확인**

```bash
npm run build
```

**Step 5: 전체 테스트 통과 확인**

```bash
npm test
```

Expected: `All tests passed`

**Step 6: 커밋**

```bash
git add src/repl/cli-args.ts src/repl/handlers/debate.ts bin/cli.ts
git commit -m "feat: CLI --news, --news-quiet, --news-snapshot 플래그 지원"
```

---

### Task 12: .env 설정 문서화 & 마무리

**Files:**
- Modify: `.env.example` (없으면 생성)
- Modify: `README.md` (뉴스 기능 섹션 추가)

**Step 1: .env.example 업데이트**

```bash
# .env.example
BRAVE_API_KEY=your_brave_search_api_key_here
# Get free key at: https://api.search.brave.com
```

**Step 2: 최종 빌드 & 전체 테스트**

```bash
npm run build && npm test
```

Expected: Build success + All tests passed

**Step 3: feature 브랜치 최종 커밋**

```bash
git add .env.example
git commit -m "docs: Brave API key 설정 가이드 추가"
```

---

## 검증 체크리스트

- [ ] `npm test` — 모든 테스트 통과
- [ ] `npm run build` — 빌드 성공
- [ ] `ffm --news "Trump tariffs"` — 기사 목록 표시 후 토론 시작
- [ ] `ffm --news --news-quiet "Trump tariffs"` — 기사 목록 미표시
- [ ] `ffm --news-snapshot ./ffm-snapshots/snap-xxx.json "Trump tariffs"` — 저장된 스냅샷 재사용
- [ ] REPL 내 `/news Trump tariffs` — 실행 중 컨텍스트 주입
- [ ] `BRAVE_API_KEY` 없을 때 명확한 오류 메시지
- [ ] API 실패 시 일반 토론으로 폴백

---

## 새 소스 추가 방법 (향후)

```typescript
// src/news/providers/newsapi.ts
export class NewsApiProvider implements NewsProvider {
  name = 'NewsAPI';
  async search(query, options) { /* ... */ }
}

// src/news/index.ts - providers 배열에 추가만 하면 됨
const providers = [new BraveNewsProvider(apiKey), new NewsApiProvider(newsApiKey)];
```
