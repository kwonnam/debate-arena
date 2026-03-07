# DEBATE ARENA

**두 AI를 싸움 붙여서 최고의 답을 얻고 — 그 결과를 코드로 만드세요.**

[English](./README.md) | [npm](https://www.npmjs.com/package/debate-arena) | [GitHub](https://github.com/kwonnam/debate-arena)

---

## 왜 AI 토론인가?

AI 하나는 *하나의* 관점만 줍니다. 하지만 진짜 엔지니어링 결정에는 트레이드오프, 반론, 스트레스 테스트가 필요합니다. **DEBATE ARENA**는 Codex(OpenAI)와 Claude(Anthropic)를 구조화된 다중 라운드 토론에 붙여서 — 자동완성이 아닌, 검증된 답을 제공합니다.

> AI 하나는 의견. AI 둘의 토론은 검증.

---

## 세 가지 모드

### 1. Agent vs Agent — 구조화된 AI 토론

두 AI 에이전트가 여러 라운드에 걸쳐 서로 다른 입장에서 논쟁하고, 심판이 최선의 답을 종합합니다.

```bash
da "새 API에 REST와 GraphQL 중 무엇을 써야 할까?"
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
da "React에 가장 좋은 상태 관리는?" -i
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
da "인증 모듈을 어떻게 리팩토링해야 할까?" --plan
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

DEBATE ARENA는 AI CLI 도구를 내부적으로 호출합니다. 아래 중 최소 두 가지가 필요합니다.

#### 1. Node.js >= 18

```bash
# 버전 확인
node --version

# nvm으로 설치 (권장)
nvm install 18
nvm use 18
```

#### 2. Codex CLI (OpenAI)

```bash
npm install -g @openai/codex

# OpenAI API 키 설정
export OPENAI_API_KEY="sk-..."

# 설치 확인
codex --version
```

#### 3. Claude CLI (Anthropic)

```bash
# Claude Code 설치
npm install -g @anthropic-ai/claude-code

# 로그인
claude login

# 설치 확인
claude --version
```

#### 4. Gemini CLI (Google) — 선택 사항

```bash
npm install -g @google/gemini-cli

# 로그인
gemini auth login

# 설치 확인
gemini --version
```

---

### DEBATE ARENA 설치

#### 방법 A: npm으로 설치 (권장)

```bash
npm install -g debate-arena

# 설치 확인
da --version
```

#### 방법 B: 소스에서 빌드

```bash
# 저장소 클론
git clone https://github.com/kwonnam/debate-arena.git
cd debate-arena

# 의존성 설치
npm install

# 빌드
npm run build

# 직접 실행
node dist/bin/cli.js

# 또는 전역 링크 후 da 명령어로 실행
npm link
da
```

#### 방법 C: 로컬 패키지(`.tgz`)를 만들어 다른 환경에 설치

```bash
# 배포용 tarball 생성 (.release/ 디렉터리)
npm run package:local

# 생성된 .tgz 파일을 다른 머신으로 옮긴 뒤 설치
npm install -g ./debate-arena-*.tgz
```

---

### 기본 사용법

```bash
# 토론 시작 (단일 실행)
da "질문을 입력하세요"

# 5라운드 토론
da "Node.js ORM 비교" -r 5

# 참가자로 직접 참여
da "마이크로서비스 vs 모놀리스?" -i

# 토론 후 코드 변경 적용
da "이 모듈 리팩토링" --plan

# 파일을 컨텍스트로 포함
da "이 코드를 어떻게 개선할까?" --files src/index.ts src/utils.ts
```

---

### 인터랙티브 REPL

인자 없이 `da`를 실행하면 인터랙티브 REPL이 시작됩니다:

```bash
da
```

```
╔═══════════════════════════════════════╗
║                                       ║
║             FIGHT FOR ME              ║
║   AI Debate Arena - Codex vs Claude   ║
║                                       ║
╚═══════════════════════════════════════╝

  v0.5.2 Type /help for commands, /exit to quit.

da >
```

REPL 안에서는 슬래시 명령어를 사용합니다:

```bash
da > /status                                # 사용 가능한 에이전트 확인
da > /rounds 2                              # 2라운드로 설정
da > /participants codex gemini             # 참가자 변경
da > /join TypeScript를 써야 할까?          # 인터랙티브 토론 시작
da > /plan 인증 모듈을 리팩토링해줘         # 토론 후 코드 적용
da > /help                                  # 전체 명령어 보기
da > /exit                                  # 종료
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
| `--news [query]` | 토론 전 뉴스 증거 수집 | - |
| `--news-quiet` | 기사 목록 출력 생략 | - |
| `--news-snapshot <path>` | 기존 스냅샷 파일 재사용 | - |

## REPL 명령어

| 명령어 | 설명 |
|--------|------|
| `/plan <주제>` | 토론 후 코드 변경 적용 |
| `/join <주제>` | 인터랙티브 3자 토론 (나 + Codex + Claude). 별칭: `/i` |
| `/rounds <n>` | 토론 라운드 수 설정 |
| `/judge <provider>` | 심판 설정: `<provider-id>` 또는 `both` |
| `/format <format>` | 출력 형식: `pretty`, `json`, `markdown` |
| `/stream` | 스트리밍 출력 토글 |
| `/files <paths...>` | 컨텍스트 파일 설정 (현재 목록 교체) |
| `/context` | 프로젝트 컨텍스트 수집 토글. 별칭: `/nocontext` |
| `/participants <p1> <p2>` | provider id로 참가자 설정 (예: `ollama-local cloud-gpt`) |
| `/output <경로>` | 토론 내용을 마크다운 파일로 저장 |
| `/news <query>` | 뉴스 기사를 토론 증거로 수집 |
| `/model codex <name>` | Codex 모델 설정 |
| `/model claude <name>` | Claude 모델 설정 |
| `/model list` | 현재 설정된 모델 표시 |
| `/config` | 영구 설정 관리 |
| `/status` | 에이전트 CLI 상태 확인 |
| `/stop` | 실행 중인 debate-arena 프로세스 중지 |
| `/help` | 도움말 표시 |
| `/exit` | REPL 종료. 별칭: `/quit` |

## 뉴스 증거 (News Evidence)

DEBATE ARENA는 실시간 뉴스 기사를 수집해 토론 증거로 주입할 수 있습니다. AI들이 최신 실제 정보를 바탕으로 논쟁하게 됩니다.

### 지원 뉴스 provider

| Provider | 환경변수 | 비고 |
|----------|---------|------|
| **Brave Search** (기본) | `BRAVE_API_KEY` | brave.com/search/api 무료 티어 |
| **NewsAPI** | `NEWS_API_KEY` | newsapi.org |
| **RSS 피드** | — | 공개 RSS/Atom URL 지원 |

### 토론 전 뉴스 수집 (CLI)

```bash
# 뉴스 수집 후 토론
da "올해 Fed가 금리를 내릴까?" --news

# 기사 목록 출력 생략
da "AI가 일자리에 미치는 영향" --news --news-quiet

# 이전에 저장한 스냅샷 재사용
da "후속 질문" --news-snapshot ./ffm-snapshots/snap-abc123.json
```

### REPL에서 뉴스 수집

```bash
da > /news 연준 금리 인하 2026
# → 기사 수집 → 스냅샷 저장 → 다음 토론에 주입

da > 연준이 금리를 내릴까?
# → 수집된 기사를 증거로 AI들이 토론
```

### 뉴스 토론 모드

- **unified** — 모든 증거를 양측 참가자에게 동시 제공
- **split** — 각 참가자의 입장에 맞는 증거만 제공

### 대시보드 워크벤치

대시보드는 하나의 화면에 모든 기능을 섞지 않고, 허브와 두 개의 워크플로우 페이지로 나뉩니다.

- `/` : 허브 페이지
- `/project.html` : 로컬 프로젝트 개선 토론 전용
- `/news.html` : 뉴스 근거 수집 + 뉴스 토론 전용
- `/settings.html` : 역할 템플릿 YAML 편집

핵심 흐름:

- 프로젝트 개선 페이지는 로컬 작업 디렉터리와 첨부 파일을 기준으로 토론을 실행합니다.
- 뉴스 페이지는 근거 팩 수집, 스냅샷 선택, 라운드 보드, synthesis를 한 흐름으로 묶습니다.
- 두 페이지 모두 라운드별 요약 보드를 누적해서 보여주며, 이전 라운드도 다시 열람할 수 있습니다.

### 역할 템플릿과 YAML 설정

대시보드의 참가자는 고정 `participantA/B`가 아니라 **2~3인 역할 템플릿**으로 구성됩니다.

- 뉴스 토론: 경제, 시장, 정책, 법률 같은 역할 프리셋
- 프로젝트 개선: UX, 백엔드, 아키텍트, QA 같은 역할 프리셋
- 같은 모델을 여러 역할에 반복 배치할 수 있음

역할 템플릿은 다음 순서로 로드됩니다.

1. `FFM_ROLE_CONFIG`
2. `./debate-roles.yaml`
3. `~/.debate-arena/debate-roles.yaml`

설정 페이지에서는 YAML을 직접 수정하고 저장 전 미리보기를 확인할 수 있습니다.

주의:

- 역할 수는 템플릿당 2명 또는 3명만 허용됩니다.
- 프로젝트 개선 페이지는 CLI provider(`codex`, `claude`, `gemini`)만 허용합니다.
- 뉴스 페이지는 `ollama`를 포함한 전체 provider를 허용하며, Ollama 선택 시 모델 드롭다운이 함께 표시됩니다.

템플릿 스키마 핵심 필드:

- `id`, `label`, `description`
- `participants[]`
- 각 participant의 `roleId`, `label`, `focus`, `defaultProvider`, `instructions`, `requiredQuestions`

### config.v2.json 뉴스 설정

```json
{
  "news": {
    "providers": {
      "brave":   { "enabled": true },
      "newsapi": { "enabled": false },
      "rss":     { "enabled": true, "feeds": ["https://feeds.bbci.co.uk/news/rss.xml"] }
    },
    "maxArticlesPerProvider": 10,
    "deduplication": true
  }
}
```

```bash
export BRAVE_API_KEY="BSA..."
export NEWS_API_KEY="..."    # newsapi 활성화 시에만 필요
```

---

## 설정

기본 설정은 `da config` 또는 `~/.debate-arena/config.json`을 직접 편집해서 변경할 수 있습니다:

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

```bash
# 현재 설정 보기
da config list

# 설정 변경
da config set defaultRounds 5
da config set defaultJudge both
```

### 고급 Provider 설정 (`config.v2.json`)

여러 Ollama 프로필과 클라우드 모델을 동시에 쓰려면 다음 파일을 수정하세요:

`~/.debate-arena/config.v2.json`

로컬 테스트용으로 **현재 작업 디렉터리**의 파일도 지원합니다:

`./config.v2.json`

```json
{
  "version": 2,
  "providers": {
    "codex": {
      "type": "cli",
      "command": "codex exec --skip-git-repo-check -",
      "model": "default",
      "capabilities": { "supportsStreaming": true, "maxContextTokens": 128000 }
    },
    "claude": {
      "type": "cli",
      "command": "claude -p",
      "model": "default",
      "capabilities": { "supportsStreaming": true, "maxContextTokens": 200000 }
    },
    "gemini": {
      "type": "cli",
      "command": "gemini -p {prompt}",
      "model": "default",
      "capabilities": { "supportsStreaming": true, "maxContextTokens": 1000000 }
    },
    "ollama-local": {
      "type": "ollama-compat",
      "baseUrl": "http://127.0.0.1:11434",
      "model": "llama3.2",
      "capabilities": { "supportsStreaming": true, "maxContextTokens": 131072 }
    },
    "ollama-vision": {
      "type": "ollama-compat",
      "baseUrl": "http://127.0.0.1:11434",
      "model": "llava",
      "capabilities": { "supportsStreaming": true, "maxContextTokens": 131072 }
    },
    "ollama-cloud-qwen3-coder-next": {
      "type": "ollama-compat",
      "baseUrl": "https://ollama.com",
      "model": "qwen3-coder-next",
      "apiKeyEnvVar": "OLLAMA_API_KEY",
      "capabilities": { "supportsStreaming": true, "maxContextTokens": 262144 }
    },
    "ollama-cloud-glm-5": {
      "type": "ollama-compat",
      "baseUrl": "https://ollama.com",
      "model": "glm-5:cloud",
      "apiKeyEnvVar": "OLLAMA_API_KEY",
      "capabilities": { "supportsStreaming": true, "maxContextTokens": 262144 }
    },
    "ollama-cloud-kimi-k2-5": {
      "type": "ollama-compat",
      "baseUrl": "https://ollama.com",
      "model": "kimi-k2.5:cloud",
      "apiKeyEnvVar": "OLLAMA_API_KEY",
      "capabilities": { "supportsStreaming": true, "maxContextTokens": 262144 }
    }
  },
  "debate": {
    "defaultRounds": 3,
    "defaultJudge": "ollama-cloud-qwen3-coder-next",
    "defaultFormat": "pretty",
    "stream": true,
    "commandTimeoutMs": 180000,
    "applyTimeoutMs": 300000
  }
}
```

메모:
- provider id는 고유해야 합니다 (`ollama-local`, `ollama-cloud-qwen3-coder-next` 등).
- CLI provider(Codex/Claude/Gemini) 설정:
  - `type: "cli"`
  - `command`: 실제 실행 명령어
  - `model`: 선택. 비우거나 `default`면 CLI 기본 모델 사용
  - `model`을 지정했고 `command`에 `--model`이 없으면 da가 `--model <값>`을 자동 추가
- `ollama-compat` 타입은 로컬 Ollama와 OpenAI 호환 클라우드 엔드포인트 둘 다 사용 가능합니다.
- API 키 지정 방법:
  - Ollama Cloud용 `ollama_api_key` (또는 `ollamaApiKey`)
  - config에 `openai_api_key` (또는 `openaiApiKey`, `apiKey`) 직접 입력
  - `apiKeyEnvVar` + 환경변수 사용
- 이 프로젝트 기준 `baseUrl`은 `https://ollama.com`으로 설정하세요 (런타임이 `/v1/...`를 자동으로 붙임).
- Ollama Cloud는 일반적으로 `apiKeyEnvVar: "OLLAMA_API_KEY"` 사용을 권장합니다.
- 최신 클라우드 모델 목록: `https://ollama.com/search?c=cloud&o=newest`
- v2 설정 로드 우선순위:
  1. `FFM_CONFIG_V2` (설정된 경우)
  2. `./config.v2.json` (현재 디렉터리)
  3. `~/.debate-arena/config.v2.json`
- 대시보드 provider 드롭다운은 이 파일 기준으로 동적으로 갱신됩니다.
- 예시 파일: `config.v2.example.json`

## 트러블슈팅

### `/status`에서 에이전트가 사용 불가로 표시될 때

해당 CLI가 설치되지 않았거나 PATH에 없는 경우입니다. CLI를 설치하고 API 키를 설정하세요:

```bash
# PATH 확인
which codex
which claude
which gemini

# API 키 확인
echo $OPENAI_API_KEY    # Codex용
echo $ANTHROPIC_API_KEY # Claude용 (필요한 경우)
```

### 토론이 타임아웃될 때

명령어 타임아웃을 늘려보세요:

```bash
da config set commandTimeoutMs 300000
```

### 소스 실행 시 "Cannot find module" 오류

빌드를 먼저 실행했는지 확인하세요:

```bash
npm run build
node dist/bin/cli.js
```

파일 변경 시 자동 재빌드(개발 모드):

```bash
npm run dev   # 변경 감지 후 자동 재빌드
```

---

## 작동 원리

```
  나
   │
   ▼
┌──────┐     ┌───────────────────────────────────┐
│  da  │────▶│         토론 엔진                  │
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
