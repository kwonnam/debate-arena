# News Round Injection & Multi-Source & Dashboard — Design Document

- **Date**: 2026-03-02
- **Status**: Approved
- **Author**: kwonnam

## Overview

세 가지 기능을 순차적으로 구현한다:

1. **Phase 1**: 뉴스를 토론 라운드 프롬프트에 주입 + unified/split 모드 선택
2. **Phase 2**: NewsAPI + RSS 멀티 소스 지원
3. **Phase 3**: 대시보드 News 탭 (스냅샷 라이브러리 관리)

핵심 원칙: **기존 debate 엔진 하위 호환 유지 + opt-in 확장 + 각 Phase 독립 배포 가능**

---

## Phase 1: 라운드 주입 모드 선택

### 현재 vs 변경

```
현재:  뉴스 snapshot → [synthesis 프롬프트에만]
변경:  뉴스 snapshot → [라운드 프롬프트에도] + [synthesis 프롬프트]
```

### 새 타입

```typescript
// src/types/debate.ts
type NewsMode = 'unified' | 'split';

interface DebateOptions {
  // ... 기존 필드
  newsMode?: NewsMode;  // default: 'unified'
}
```

### 모드 동작

- **unified**: 양측 참가자가 동일한 기사 목록을 라운드 프롬프트에서 받음
- **split**: 첫 번째 참가자 → relevanceScore 상위 절반 (찬성 근거), 두 번째 참가자 → 하위 절반 (반대 근거)

### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/types/debate.ts` | `NewsMode` 타입, `DebateOptions.newsMode` 추가 |
| `src/core/context.ts` | `DebateContext`에 `snapshot`, `newsMode` 필드 추가; `buildMessagesFor()`에서 라운드 프롬프트에 뉴스 컨텍스트 삽입 |
| `src/core/prompt-builder.ts` | `buildRoundPromptWithEvidence(mode, articles)` 추가 |
| `src/repl/session.ts` | `SessionState.newsMode: NewsMode` 추가 (default: `'unified'`) |
| `src/repl/handlers/news.ts` | 수집 완료 후 unified/split 모드 선택 인터랙션 추가 |
| `src/repl/cli-args.ts` | `--news-mode <unified|split>` 플래그 추가 |
| `src/repl/command-meta.ts` | `/news-mode` 커맨드 메타 추가 (선택) |

### UX 흐름

```bash
# REPL
ffm > /news Trump tariffs
# 📰 뉴스 수집 중... (Brave Search)
# ✓ 8건 수집 완료
# 뉴스 주입 모드: (1) unified - 양측 동일  (2) split - 찬반 분리
# > 2
# ✓ split 모드 설정됨. 다음 토론부터 적용됩니다.

# CLI 플래그
ffm --news "Trump tariffs" --news-mode split "Impact on semiconductor chips?"
```

### Prompt 구조 (unified)

```
[기존 라운드 프롬프트]

## 참고 뉴스 (Evidence - unified)
아래 기사는 양측이 동일하게 받은 증거입니다.

1. [Reuters] Trump tariffs: What we know (2026-02-28)
   요약: ...
2. [Bloomberg] Semiconductor stocks fall (2026-02-27)
   요약: ...
```

### Prompt 구조 (split — 첫 번째 참가자)

```
[기존 라운드 프롬프트]

## 참고 뉴스 (Evidence - 찬성 측 근거)
아래 기사는 귀하의 입장을 지지하는 근거로 제공됩니다.

1. [Reuters] ...
```

---

## Phase 2: 멀티 뉴스 소스 (NewsAPI + RSS)

### 신규 파일

**`src/news/providers/newsapi.ts`**
- NewsAPI.org `/v2/everything` 엔드포인트
- 환경변수: `NEWS_API_KEY`
- `NewsProvider` 인터페이스 구현

**`src/news/providers/rss.ts`**
- `config.v2.json`에 등록된 RSS URL 목록 fetch
- Node.js 내장 `fetch` + 경량 XML 파싱 (외부 라이브러리 없음)
- `NewsProvider` 인터페이스 구현

### `config.v2.json` 확장

```json
{
  "news": {
    "providers": {
      "brave":   { "enabled": true },
      "newsapi": { "enabled": true, "apiKeyEnvVar": "NEWS_API_KEY" },
      "rss": {
        "enabled": true,
        "feeds": [
          "https://feeds.reuters.com/reuters/topNews",
          "https://feeds.bbci.co.uk/news/rss.xml"
        ]
      }
    },
    "maxArticlesPerProvider": 10,
    "deduplication": true
  }
}
```

### `collectEvidence()` 변경

```typescript
// 현재: Brave 하드코딩
const providers = [new BraveNewsProvider(apiKey)];

// 변경: config 기반 동적 구성
const providers = buildProvidersFromConfig(newsConfig);
// 활성화된 provider 병렬 수집 → 중복 제거(URL 기준) → relevanceScore 정렬
```

### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/news/providers/newsapi.ts` | 신규 |
| `src/news/providers/rss.ts` | 신규 |
| `src/news/index.ts` | `buildProvidersFromConfig()` 추가, config 기반 provider 구성 |
| `src/config/defaults.ts` | `news` 설정 기본값 추가 |
| `config.v2.example.json` | `news` 섹션 예시 추가 |

---

## Phase 3: 대시보드 News 탭

### UI 레이아웃

```
┌─────────────────────────────────────────────────────┐
│  [Debates] [Sessions] [Live] [Timeline] [📰 News]  │
└─────────────────────────────────────────────────────┘

[📰 News 탭]
┌──────────────────────────────────────────────────────┐
│  🔍 뉴스 수집                                        │
│  Query: [                              ] [수집]      │
│  Mode:  ○ unified  ● split                          │
│  Source: ☑ Brave  ☑ NewsAPI  ☑ RSS                  │
├──────────────────────────────────────────────────────┤
│  📚 스냅샷 라이브러리                                │
│                                                      │
│  ● snap-abc123  "Trump tariffs"  2026-03-02  8건    │
│    [토론에 사용] [기사 보기] [삭제]                  │
│                                                      │
│  ○ snap-def456  "AI regulation"  2026-03-01  12건   │
│    [토론에 사용] [기사 보기] [삭제]                  │
└──────────────────────────────────────────────────────┘
```

### 서버 API (Hono)

| Method | Endpoint | 설명 |
|--------|----------|------|
| `GET` | `/api/snapshots` | 저장된 스냅샷 목록 반환 |
| `GET` | `/api/snapshots/:id` | 스냅샷 상세 (기사 목록 포함) |
| `POST` | `/api/snapshots/collect` | 뉴스 수집 후 저장 |
| `DELETE` | `/api/snapshots/:id` | 스냅샷 삭제 |

`POST /api/snapshots/collect` 요청 body:
```json
{
  "query": "Trump tariffs",
  "newsMode": "split",
  "sources": ["brave", "newsapi", "rss"]
}
```

### 토론 연결 흐름

1. News 탭에서 스냅샷 선택 → "토론에 사용" 클릭
2. Command Gateway의 `snapshotId` 필드 자동 세팅
3. `run_debate` 실행 시 서버가 스냅샷 로드 → `DebateOptions.snapshot` 주입

### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/server/index.ts` | `/api/snapshots` 라우트 4개 추가 |
| `dashboard/index.html` | News 탭 UI 추가 (수집 폼 + 스냅샷 라이브러리) |
| `src/core/session-store.ts` | 스냅샷 파일 경로 연동 유틸 추가 |

---

## Error Handling

| 상황 | 동작 |
|------|------|
| provider 일부 실패 | 성공한 provider 결과만 사용, 경고 출력 |
| 전체 수집 실패 | 경고 후 뉴스 없이 일반 토론 폴백 |
| split 모드 기사 0건 | unified로 자동 강등 후 안내 |
| RSS XML 파싱 오류 | 해당 피드 건너뜀, 나머지 계속 수집 |
| 스냅샷 파일 손상 | 파싱 오류 메시지 + 재수집 제안 |

---

## 구현 순서

1. **Phase 1** — `context.ts` + `prompt-builder.ts` + 모드 선택 UX
2. **Phase 2** — `newsapi.ts` + `rss.ts` + config 동적 구성
3. **Phase 3** — 서버 API 4개 + 대시보드 News 탭 UI
