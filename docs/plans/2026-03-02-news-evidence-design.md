# News Evidence Feature — Design Document

- **Date**: 2026-03-02
- **Status**: Approved
- **Author**: kwonnam

## Overview

뉴스 검색 및 영향 분석 기능을 ffm에 추가한다. 사용자가 이슈를 질문하면 관련 뉴스를 수집하고, 두 AI에게 동일한 증거를 주입한 후 출처 기반 영향 분석을 생성한다.

핵심 원칙: **코어 debate 엔진 보존 + opt-in 확장 + 재현 가능성 보장**

---

## Architecture

```
ffm "트럼프 관세" --news
         │
         ▼
  ┌─────────────────┐
  │  EvidenceBuilder │  ← Stage 1: 증거 수집·정제
  │  (news/index.ts) │
  └────────┬────────┘
           │  EvidenceSnapshot (JSON)
           ▼
  ┌─────────────────┐
  │  Orchestrator   │  ← 기존 코드, 스냅샷을 context로 주입 (양측 동일)
  └────────┬────────┘
           │  debate messages + snapshot
           ▼
  ┌─────────────────┐
  │  Synthesizer    │  ← Stage 2: 출처 인용·시나리오·확신도 강화
  └─────────────────┘
```

### New Files

```
src/news/
  providers/
    types.ts            # NewsProvider 인터페이스, SearchOptions
    brave.ts            # BraveNewsProvider 구현
  evidence-builder.ts   # 수집 → 중복제거 → Snapshot JSON
  snapshot.ts           # EvidenceSnapshot, NewsArticle 타입
  index.ts              # 진입점
```

### Modified Files

| File | Change |
|------|--------|
| `src/core/synthesizer.ts` | `snapshot?: EvidenceSnapshot` 파라미터 추가 |
| `src/core/orchestrator.ts` | 스냅샷 주입 로직 추가 |
| `src/core/prompt-builder.ts` | 뉴스 컨텍스트 프롬프트 섹션 추가 |
| `bin/cli.ts` | `--news`, `--news-quiet`, `--news-snapshot` 플래그 추가 |
| `src/repl/handlers/` | `/news` 커맨드 핸들러 추가 |

---

## Stage 1: Synthesizer Enhancement

### Goal
외부 증거를 깊이 처리하도록 합성 프롬프트를 강화한다.

### Prompt Addition (`src/core/prompt-builder.ts`)

Evidence가 있을 때 synthesis 프롬프트에 아래 섹션을 추가:

```
## 참고 증거 (Evidence Snapshot)
아래 기사들은 토론 전 수집된 고정 데이터입니다. 두 AI 모두 동일한 증거를 받았습니다.

- [Reuters] Trump tariffs: What we know (2026-02-28)
  요약: ...

## 합성 요구사항
1. 출처 인용 강제: 주장마다 근거 기사를 "[출처명, 날짜]" 형식으로 명시
2. 시나리오 분리: 단기(3개월), 중기(1년), 장기(3년+) 영향 구분
3. 확신도 표기: 각 예측에 높음/중간/낮음 및 근거 제시
4. 반증 조건: "X가 발생하면 이 분석은 달라진다" 명시
```

### API Change (`src/core/synthesizer.ts`)

```typescript
// Before
async generate(question: string, messages: DebateMessage[]): Promise<string>

// After (backward-compatible)
async generate(
  question: string,
  messages: DebateMessage[],
  snapshot?: EvidenceSnapshot
): Promise<string>
```

Evidence가 없으면 기존과 동일하게 동작 — 하위 호환성 유지.

---

## Stage 2: Evidence Snapshot Infrastructure

### `src/news/snapshot.ts`

```typescript
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
  sources: string[];
  articles: NewsArticle[];
  excludedCount: number;
}
```

### `src/news/providers/types.ts`

```typescript
export interface NewsProvider {
  name: string;
  search(query: string, options: SearchOptions): Promise<NewsArticle[]>;
}

export interface SearchOptions {
  maxArticles?: number;  // default: 10
  language?: string;     // default: 'en'
  freshness?: 'day' | 'week' | 'month';
}
```

### `src/news/evidence-builder.ts`

```typescript
export class EvidenceBuilder {
  constructor(private providers: NewsProvider[]) {}

  async build(query: string, options?: SearchOptions): Promise<EvidenceSnapshot> {
    // 1. 모든 provider에서 병렬 수집
    // 2. URL 기준 중복 제거
    // 3. relevanceScore 기준 정렬, 상위 N개 선택
    // 4. SHA-256 해시로 id 생성
    // 5. EvidenceSnapshot 반환
  }
}
```

### Snapshot Persistence

스냅샷은 `./ffm-snapshots/` 폴더에 자동 저장. `--news-snapshot <file>`로 재사용:

```bash
ffm "트럼프 관세" --news-snapshot ./ffm-snapshots/snap-abc123.json
```

---

## Stage 3: News Plugin & UX

### `src/news/providers/brave.ts`

- Brave Web Search API `/news` 엔드포인트 사용
- 환경변수: `BRAVE_API_KEY`
- `NewsProvider` 인터페이스 구현

### CLI Flags

```bash
ffm "질문" --news                          # 뉴스 수집 + 투명 공개 후 토론
ffm "질문" --news --news-quiet            # 수집하되 기사 목록 미표시
ffm "질문" --news-snapshot ./snap.json    # 기존 스냅샷 재사용
```

### REPL Command

```
ffm > /news 트럼프 관세 정책
```

토론 중 새 컨텍스트 주입. 다음 라운드부터 반영.

### Transparent Mode UX (default)

```
📰 뉴스 수집 중... (Brave Search)

수집된 기사 (8건):
  1. [Reuters] Trump tariffs: What we know - 2026-02-28
  2. [Bloomberg] Semiconductor stocks fall - 2026-02-27
  ...

토론을 시작할까요? (Y/n)
```

---

## Error Handling

| Situation | Behavior |
|-----------|----------|
| `BRAVE_API_KEY` 없음 | 오류 메시지 + 설정 가이드 출력 후 종료 |
| API rate limit / 네트워크 오류 | 1회 재시도 후 `--files`로 수동 주입 안내 |
| 기사 0건 수집 | 경고 후 뉴스 없이 일반 토론으로 폴백 |
| 스냅샷 파일 손상 | 파싱 오류 메시지 + 재수집 제안 |

**뉴스 기능 실패가 전체 토론을 막지 않도록 — 항상 폴백 동작 보장.**

---

## Testing Strategy

```
src/news/
  providers/
    brave.test.ts           # API 모킹, 응답 파싱 검증
  evidence-builder.test.ts  # 중복 제거, 정렬, 해시 생성 검증
  snapshot.test.ts          # 직렬화/역직렬화 검증
```

- `BraveNewsProvider`는 인터페이스로 분리돼 mock으로 쉽게 교체 가능
- 기존 debate 테스트는 `snapshot` 미전달로 변경 없이 통과

---

## Extensibility

새 뉴스 소스 추가 시 `NewsProvider` 인터페이스 구현 파일 하나만 추가:

```typescript
// src/news/providers/newsapi.ts
export class NewsApiProvider implements NewsProvider {
  name = 'NewsAPI';
  async search(query: string, options: SearchOptions): Promise<NewsArticle[]> { ... }
}
```

`EvidenceBuilder` 생성자에 주입하면 즉시 병렬 수집에 참여.

---

## Implementation Order

1. **Stage 1**: `synthesizer.ts` + `prompt-builder.ts` 수정 (하위 호환, 즉시 가치)
2. **Stage 2**: `src/news/` 인프라 구축 (타입, EvidenceBuilder, 스냅샷 저장)
3. **Stage 3**: `BraveNewsProvider` 구현 + CLI 플래그 + REPL 커맨드
