# fight-for-me

**두 AI를 싸움 붙여서 최고의 답을 얻고 — 그 결과를 코드로 만드세요.**

[English](./README.md) | [npm](https://www.npmjs.com/package/fight-for-me) | [GitHub](https://github.com/Leekee0905/fight-for-me)

---

## 왜 AI 토론인가?

AI 하나는 *하나의* 관점만 줍니다. 하지만 진짜 엔지니어링 결정에는 트레이드오프, 반론, 스트레스 테스트가 필요합니다. **fight-for-me**는 Codex(OpenAI)와 Claude(Anthropic)를 구조화된 다중 라운드 토론에 붙여서 — 자동완성이 아닌, 검증된 답을 제공합니다.

> AI 하나는 의견. AI 둘의 토론은 검증.

---

## 세 가지 모드

### 1. Agent vs Agent — 구조화된 AI 토론

두 AI 에이전트가 여러 라운드에 걸쳐 서로 다른 입장에서 논쟁하고, 심판이 최선의 답을 종합합니다.

```bash
ffm "새 API에 REST와 GraphQL 중 무엇을 써야 할까?"
```

```
┌─────────────────────────────────────────────────┐
│  라운드 1                                       │
│  Codex: "REST가 더 단순하고 캐싱이 좋고..."     │
│  Claude: "GraphQL이 오버페칭을 줄여주고..."      │
│                                                 │
│  라운드 2                                       │
│  Codex: "하지만 GraphQL은 복잡성이..."           │
│  Claude: "스키마 우선 접근이 예방하는..."         │
│                                                 │
│  라운드 3                                       │
│  Codex: "이 케이스에서는 고려해볼 것이..."       │
│  Claude: "동의하지만, 또한 주목할 점은..."       │
│                                                 │
│  ✨ 종합                                        │
│  "퍼블릭 API에는 REST, 내부 API에는..."         │
└─────────────────────────────────────────────────┘
```

### 2. You + Agents — 인터랙티브 3자 토론

토론에 세 번째 참가자로 직접 뛰어드세요. 대화를 이끌고, 가정에 도전하고, 당신만 아는 도메인 컨텍스트를 제공하세요.

```bash
ffm "React에 가장 좋은 상태 관리는?" -i
```

```
┌─────────────────────────────────────────────────┐
│  라운드 1                                       │
│  Codex: "대규모 앱에는 Redux Toolkit이..."      │
│  Claude: "Zustand이 더 가볍고 단순한..."         │
│                                                 │
│  👤 나: "SSR 지원이 필요하고 팀이 주니어라서     │
│          단순함이 가장 중요해"                    │
│                                                 │
│  라운드 2                                       │
│  Codex: "SSR이 필요하다면 고려할 것은..."        │
│  Claude: "주니어 팀에게는 Zustand의 API가..."    │
│  ...                                            │
└─────────────────────────────────────────────────┘
```

### 3. Debate → Code — 플랜 모드

에이전트들이 코드를 *어떻게* 바꿀지 토론하고, 합의된 결론을 코드베이스에 바로 적용합니다. 토론에서 구현까지 한 흐름으로.

```bash
ffm "인증 모듈을 어떻게 리팩토링해야 할까?" --plan
```

```
┌─────────────────────────────────────────────────┐
│  토론: 리팩토링 전략에 대해 3라운드             │
│  ...                                            │
│  ✨ 합의: "JWT 로직을 서비스 레이어로 분리하고   │
│     리프레시 토큰 로테이션을 추가"               │
│                                                 │
│  코드베이스에 변경사항을 적용할까요? (y/n)       │
│  > Codex가 합의된 변경사항을 적용 중...          │
└─────────────────────────────────────────────────┘
```

---

<!-- TODO: 데모 GIF 추가 -->
<!-- ![demo](./assets/demo.gif) -->

## 빠른 시작

### 필수 조건

- [Node.js](https://nodejs.org/) >= 18
- [Codex CLI](https://github.com/openai/codex) 설치 및 설정 완료
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-cli) 설치 및 설정 완료

### 설치

```bash
npm install -g fight-for-me
```

### 기본 사용법

```bash
# 토론 시작
ffm "질문을 입력하세요"

# 5라운드 토론
ffm "Node.js ORM 비교" -r 5

# 참가자로 직접 참여
ffm "마이크로서비스 vs 모놀리스?" -i

# 토론 후 코드 변경 적용
ffm "이 모듈 리팩토링" --plan

# 파일을 컨텍스트로 포함
ffm "이 코드를 어떻게 개선할까?" --files src/index.ts src/utils.ts
```

---

## 옵션

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `-r, --rounds <n>` | 토론 라운드 수 | `3` |
| `-j, --judge <provider>` | 합의 심판: `codex`, `claude`, `both` | `claude` |
| `-f, --format <format>` | 출력 형식: `pretty`, `json`, `markdown` | `pretty` |
| `--plan` | 플랜 모드 (토론 → 코드 적용) | `false` |
| `-i, --interactive` | 세 번째 참가자로 참여 | `false` |
| `--no-stream` | 스트리밍 출력 비활성화 | - |
| `--no-synthesis` | 최종 합의 도출 건너뛰기 | - |
| `--no-context` | 프로젝트 컨텍스트 수집 비활성화 | - |
| `--files <paths...>` | 컨텍스트에 특정 파일 포함 | - |

## 명령어

| 명령어 | 설명 |
|--------|------|
| `ffm [question]` | 토론 시작 (기본) |
| `ffm config` | 설정 확인 또는 변경 |
| `ffm status` | 현재 상태 및 설정 표시 |
| `ffm stop` | 실행 중인 에이전트 프로세스 중지 |
| `ffm model` | AI 모델 설정 |

## REPL 명령어

인터랙티브 REPL에서 사용할 수 있는 명령어:

| 명령어 | 설명 |
|--------|------|
| `/plan <주제>` | 토론 후 코드 변경 적용 |
| `/join <주제>` | 인터랙티브 3자 토론 (나 + Codex + Claude). 별칭: `/i` |
| `/rounds <n>` | 토론 라운드 수 설정 |
| `/judge <provider>` | 심판 설정: `codex`, `claude`, `both` |
| `/format <format>` | 출력 형식: `pretty`, `json`, `markdown` |
| `/stream` | 스트리밍 출력 토글 |
| `/files <paths...>` | 컨텍스트 파일 설정 (현재 목록 교체) |
| `/context` | 프로젝트 컨텍스트 수집 토글. 별칭: `/nocontext` |
| `/model codex <name>` | Codex 모델 설정 (내장 모델 목록에서 선택) |
| `/model claude <name>` | Claude 모델 설정 (내장 모델 목록에서 선택) |
| `/model list` | 현재 설정된 모델 및 사용 가능 모델 표시 |
| `/config` | 영구 설정 관리 |
| `/status` | 에이전트 CLI 상태 확인 |
| `/stop` | 실행 중인 fight-for-me 프로세스 중지 |
| `/help` | 도움말 표시 |
| `/exit` | REPL 종료. 별칭: `/quit` |

## 설정

기본 설정은 `ffm config`로 변경할 수 있습니다:

| 설정 | 설명 | 기본값 |
|------|------|--------|
| `codexCommand` | Codex CLI 명령어 | `codex exec --skip-git-repo-check -` |
| `claudeCommand` | Claude CLI 명령어 | `claude -p` |
| `commandTimeoutMs` | 에이전트 명령어 타임아웃 (ms) | `180000` |
| `defaultRounds` | 기본 토론 라운드 수 | `3` |
| `defaultJudge` | 기본 심판 | `claude` |
| `defaultFormat` | 기본 출력 형식 | `pretty` |
| `stream` | 스트리밍 활성화 | `true` |
| `codexModel` | Codex 모델 오버라이드 | - |
| `claudeModel` | Claude 모델 오버라이드 | - |
| `claudeApplyCommand` | 플랜 모드용 Claude CLI 명령어 | `claude -p --allowedTools "Edit Write Bash Read"` |
| `applyTimeoutMs` | 적용 명령어 타임아웃 (ms) | `300000` |

## 작동 원리

```
  나
   │
   ▼
┌──────┐     ┌───────────────────────────────────┐
│ ffm  │────▶│         토론 엔진                  │
└──────┘     │                                     │
             │  ┌───────┐  라운드 N ┌────────┐    │
             │  │ Codex │◄────────►│ Claude │    │
             │  └───────┘          └────────┘    │
             │       │                  │         │
             │       ▼                  ▼         │
             │  ┌─────────────────────────────┐  │
             │  │    심판 (종합)               │  │
             │  └─────────────────────────────┘  │
             └───────────────┬───────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         Pretty 텍스트   JSON 출력    코드 변경
                                     (플랜 모드)
```

1. 질문이 **Codex**와 **Claude** 양쪽에 전달됩니다
2. 각 에이전트가 자신의 관점으로 응답합니다
3. N 라운드에 걸쳐 토론을 주고받습니다
4. 심판이 토론을 종합하여 최종 합의를 도출합니다
5. **플랜 모드**에서는 합의가 코드베이스에 직접 적용됩니다

## 라이선스

MIT
