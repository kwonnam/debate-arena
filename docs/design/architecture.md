# fight-for-me 시스템 아키텍처 설계

> 대시보드 기능 추가 및 Ollama Cloud 연동을 위한 목표 아키텍처 정의

---

## 1. 전체 컴포넌트 다이어그램

현재 구조와 목표 구조 간의 전환을 보여주는 컴포넌트 맵.

### 현재 구조 (AS-IS)

```mermaid
graph TD
    subgraph CLI["CLI Layer"]
        REPL["REPL (src/repl/)"]
        InkUI["Ink UI (src/ink/ink-prompt.ts)"]
        Renderer["UI Renderer (src/ui/renderer.ts)"]
    end

    subgraph Core["Core Layer"]
        Orchestrator["DebateOrchestrator (src/core/orchestrator.ts)"]
        Context["DebateContext (src/core/context.ts)"]
        PromptBuilder["PromptBuilder (src/core/prompt-builder.ts)"]
        StatusChecker["StatusChecker (src/core/status-checker.ts)"]
    end

    subgraph Providers["Provider Layer"]
        Factory["Provider Factory (src/providers/factory.ts)"]
        CodexProv["CodexProvider"]
        ClaudeProv["ClaudeProvider"]
        GeminiProv["GeminiProvider"]
    end

    subgraph Config["Config Layer"]
        ConfigMgr["Config Manager (src/config/manager.ts)"]
        Defaults["Defaults (src/config/defaults.ts)"]
    end

    REPL --> Orchestrator
    InkUI --> Orchestrator
    Renderer --> Orchestrator
    Orchestrator --> Context
    Orchestrator --> PromptBuilder
    Orchestrator --> Factory
    Factory --> CodexProv
    Factory --> ClaudeProv
    Factory --> GeminiProv
    Orchestrator --> ConfigMgr
    ConfigMgr --> Defaults

    style CLI fill:#dbeafe,stroke:#3b82f6
    style Core fill:#dcfce7,stroke:#16a34a
    style Providers fill:#fef9c3,stroke:#ca8a04
    style Config fill:#f3e8ff,stroke:#9333ea
```

### 목표 구조 (TO-BE)

```mermaid
graph TD
    subgraph Presentation["Presentation Layer"]
        REPL["CLI REPL"]
        DashUI["Dashboard UI (Browser)"]
    end

    subgraph Transport["Transport Layer"]
        WS["WebSocket Server"]
        REST["HTTP REST API"]
        LocalServer["Local HTTP Server (Hono/Express)"]
    end

    subgraph Application["Application Layer (Headless Engine)"]
        Engine["DebateEngine (Headless Core)"]
        SessionStore["SessionStore (in-memory)"]
        EventBus["DebateEvent Bus (v1 Contract)"]
        StopLifecycle["Stop Lifecycle Manager"]
    end

    subgraph Providers["Provider Layer"]
        HttpBase["BaseHttpProvider (abstract)"]
        OllamaCompat["OllamaCompatProvider"]
        CliProviders["CLI Providers (Codex / Claude / Gemini)"]
        FutureProvider["Future HTTP Providers..."]
    end

    subgraph Config["Config Layer"]
        ConfigV2["Config Manager v2"]
        Migrator["v1→v2 Migrator"]
        SecretStore["Secret Store (env var → 0600 file fallback)"]
    end

    REPL --> Engine
    DashUI --> LocalServer
    LocalServer --> WS
    LocalServer --> REST
    WS --> EventBus
    REST --> SessionStore
    Engine --> EventBus
    Engine --> SessionStore
    Engine --> StopLifecycle
    Engine --> HttpBase
    Engine --> CliProviders
    HttpBase --> OllamaCompat
    HttpBase --> FutureProvider
    Engine --> ConfigV2
    ConfigV2 --> Migrator
    ConfigV2 --> SecretStore

    style Presentation fill:#dbeafe,stroke:#3b82f6
    style Transport fill:#fce7f3,stroke:#db2777
    style Application fill:#dcfce7,stroke:#16a34a
    style Providers fill:#fef9c3,stroke:#ca8a04
    style Config fill:#f3e8ff,stroke:#9333ea
```

---

## 2. 레이어드 아키텍처 다이어그램

각 레이어의 책임과 의존 방향을 명확히 정의한다.

```mermaid
graph TB
    subgraph L1["Presentation Layer"]
        CLI_REPL["CLI REPL\n(ffm 명령줄 인터페이스)"]
        DASH_UI["Dashboard UI\n(브라우저 기반 시각화)"]
    end

    subgraph L2["Transport Layer"]
        WS_TRANSPORT["WebSocket\n(실시간 이벤트 스트리밍)"]
        HTTP_REST["HTTP REST\n(세션 조회 / 모델 관리)"]
    end

    subgraph L3["Application Layer"]
        DEBATE_ENGINE["Debate Engine\n(Headless Core — UI 독립)"]
        SESSION_STORE["SessionStore\n(in-memory → SQLite optional)"]
        EVENT_CONTRACT["DebateEvent v1 Contract\n(round_started · agent_chunk · round_finished · synthesis_ready · error)"]
        STOP_MGR["Stop Lifecycle Manager\n(세션 중단 → 스트림 종료 → 프로세스 정리)"]
    end

    subgraph L4["Provider Layer"]
        HTTP_BASE["BaseHttpProvider\n(abstract: baseUrl · apiKey · timeout)"]
        OLLAMA_COMPAT["OllamaCompatProvider\n(OpenAI-compat HTTP 구현체)"]
        CLI_RUNNER["CLI Providers\n(CodexProvider · ClaudeProvider · GeminiProvider)"]
        FUTURE_HTTP["Future HTTP Providers\n(Anthropic-native · etc.)"]
    end

    subgraph L5["Storage Layer"]
        SESSION_MEM["SessionStore\n(in-memory 기본)"]
        EVENT_LOG["Append-only Event Log"]
        SQLITE_OPT["SQLite (선택적 영구 저장)"]
    end

    subgraph L6["Config Layer"]
        CONFIG_V2["Config Manager v2\n(버전 필드 포함)"]
        MIGRATOR["v1→v2 자동 마이그레이터\n(기존 ~/.ffm/config.json 하위 호환)"]
        SECRET["Secret Store\n(env var 우선 → 0600 파일 fallback → OS Keychain 선택)"]
    end

    L1 --> L2
    L2 --> L3
    L3 --> L4
    L3 --> L5
    L3 --> L6
    L4 --> HTTP_BASE
    HTTP_BASE --> OLLAMA_COMPAT
    HTTP_BASE --> FUTURE_HTTP

    style L1 fill:#dbeafe,stroke:#3b82f6
    style L2 fill:#fce7f3,stroke:#db2777
    style L3 fill:#dcfce7,stroke:#16a34a
    style L4 fill:#fef9c3,stroke:#ca8a04
    style L5 fill:#ffedd5,stroke:#ea580c
    style L6 fill:#f3e8ff,stroke:#9333ea
```

---

## 3. CLI ↔ Dashboard 상태 공유 흐름

CLI에서 시작한 토론 세션을 Dashboard가 실시간으로 수신하는 시퀀스.

```mermaid
sequenceDiagram
    actor User
    participant REPL as CLI REPL
    participant Engine as DebateEngine
    participant Store as SessionStore
    participant EventBus as EventBus (DebateEvent v1)
    participant WS as WebSocket Server
    participant Dash as Dashboard UI (Browser)

    User->>REPL: ffm "질문 입력"
    REPL->>Engine: run(DebateOptions)
    Engine->>Store: createSession(sessionId)
    Store-->>Engine: session created

    Note over Engine: Round 1 시작

    Engine->>EventBus: emit(round_started, round=1)
    EventBus->>Store: appendEvent(round_started)
    EventBus->>WS: broadcast(round_started)
    WS-->>Dash: { type: "round_started", round: 1 }

    loop 각 토큰 스트리밍
        Engine->>EventBus: emit(agent_chunk, provider, token)
        EventBus->>WS: broadcast(agent_chunk)
        WS-->>Dash: { type: "agent_chunk", provider, token }
        Dash->>Dash: 실시간 렌더링
    end

    Engine->>EventBus: emit(round_finished, round=1, content)
    EventBus->>Store: appendEvent(round_finished)
    EventBus->>WS: broadcast(round_finished)
    WS-->>Dash: { type: "round_finished", content }

    Note over Engine: Synthesis 단계

    Engine->>EventBus: emit(synthesis_ready, content)
    EventBus->>Store: appendEvent(synthesis_ready)
    EventBus->>WS: broadcast(synthesis_ready)
    WS-->>Dash: { type: "synthesis_ready", content }

    Note over Dash,WS: 재연결 시나리오

    Dash->>WS: 연결 끊김 감지 → 재연결
    Dash->>WS: GET /sessions/{sessionId}/events
    WS->>Store: getEvents(sessionId)
    Store-->>WS: 누적 이벤트 로그
    WS-->>Dash: 이벤트 히스토리 replay
    Dash->>Dash: 상태 복원 완료

    Note over REPL,Engine: 종료 시나리오

    User->>REPL: /stop
    REPL->>Engine: stop(sessionId)
    Engine->>Store: markSessionStopped(sessionId)
    Engine->>EventBus: emit(session_stopped)
    EventBus->>WS: broadcast(session_stopped)
    WS-->>Dash: { type: "session_stopped" }
    Engine->>WS: gracefulShutdown()
```

---

## 4. 컴포넌트 책임 요약

| 컴포넌트 | 위치 (목표) | 책임 |
|---|---|---|
| `DebateEngine` | `src/core/engine.ts` | UI 독립 토론 실행, 이벤트 발행 |
| `SessionStore` | `src/core/session-store.ts` | 세션 ID 기반 상태 저장, 이벤트 로그 |
| `EventBus` | `src/core/event-bus.ts` | DebateEvent v1 타입 계약, 구독자 관리 |
| `StopLifecycleManager` | `src/core/stop-lifecycle.ts` | 세션 중단 → 스트림 종료 → 프로세스 정리 순서 보장 |
| `BaseHttpProvider` | `src/providers/http-base.ts` | HTTP 기반 Provider 공통 추상 베이스 |
| `OllamaCompatProvider` | `src/providers/ollama-compat.ts` | OpenAI-compat API (Ollama Cloud) 구현체 |
| `LocalHttpServer` | `src/server/index.ts` | REST + WebSocket 서버 (localhost 바인딩) |
| `Config Manager v2` | `src/config/manager.ts` | v2 스키마 + v1 자동 마이그레이션 |
| `SecretStore` | `src/config/secret-store.ts` | API 키 보안 저장 (env → 파일 → OS keychain) |
| `Dashboard UI` | `dashboard/` | 브라우저 기반 실시간 토론 시각화 |

---

## 5. 보안 고려사항

- **로컬 바인딩**: HTTP 서버는 `127.0.0.1`에만 바인딩 (외부 노출 차단)
- **CORS/Origin 제한**: Dashboard 전용 Origin만 허용
- **로그 Redaction**: API 키, 에러 스택 트레이스에서 민감 정보 마스킹
- **에러 메시지 마스킹**: 외부로 노출되는 에러에 API 키 포함 금지
- **Secret Store 우선순위**: `$ENV_VAR` → `~/.ffm/credentials` (0600) → OS Keychain

---

*이 문서는 `docs/dashboard2.md` Final Synthesis를 기반으로 작성되었습니다.*