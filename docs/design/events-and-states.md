# 이벤트 흐름 & 상태 머신 설계

fight-for-me 토론 세션의 이벤트 계약, 상태 전이, 프로세스 종료 순서를 정의합니다.

---

## 1. DebateEvent 시퀀스 다이어그램

토론 세션에서 발생하는 이벤트의 전체 흐름을 나타냅니다.
현재 구현은 CLI 기반이며, 웹 대시보드 확장 시 `WebSocketServer`와 `DashboardUI` 컴포넌트가 추가됩니다.

```mermaid
sequenceDiagram
    participant Client as CLI / DashboardUI
    participant Engine as DebateEngine (Orchestrator)
    participant AgentA as AgentA (e.g. Claude)
    participant AgentB as AgentB (e.g. Codex)
    participant Store as SessionStore
    participant WS as WebSocketServer

    Note over Client,WS: 토론 시작

    Client->>Engine: run(options, callbacks)
    Engine->>Store: 세션 생성 (sessionId, options)
    Engine->>Client: onRoundStart(round=1, total=N)
    Engine-->>WS: emit round_started {sessionId, round, total}

    Note over Engine,AgentA: AgentA 턴 실행

    Engine->>AgentA: stream(messages)
    Engine->>Client: onTurnStart(providerA, 'opening')
    loop 스트리밍 청크
        AgentA-->>Engine: token chunk
        Engine->>Client: onToken(providerA, token)
        Engine-->>WS: emit agent_chunk {sessionId, provider, token}
        WS-->>Client: agent_chunk 이벤트
    end
    Engine->>Client: onTurnEnd(providerA, fullContent)
    Engine->>Store: addMessage({provider: A, round, phase, content})

    Note over Engine,AgentB: AgentB 턴 실행

    Engine->>AgentB: stream(messages)
    Engine->>Client: onTurnStart(providerB, 'opening')
    loop 스트리밍 청크
        AgentB-->>Engine: token chunk
        Engine->>Client: onToken(providerB, token)
        Engine-->>WS: emit agent_chunk {sessionId, provider, token}
        WS-->>Client: agent_chunk 이벤트
    end
    Engine->>Client: onTurnEnd(providerB, fullContent)
    Engine->>Store: addMessage({provider: B, round, phase, content})

    Note over Engine: 라운드 완료 → 다음 라운드 or 합산

    Engine-->>WS: emit round_finished {sessionId, round, messages}
    Engine->>Client: onRoundStart(round=2, total=N)

    Note over Engine: 모든 라운드 완료 → 합성 단계

    Engine->>Client: onSynthesisStart()
    Engine-->>WS: emit synthesis_ready {sessionId, status: 'started'}
    Engine->>AgentA: stream(synthesisPrompt)
    loop 합성 스트리밍
        AgentA-->>Engine: synthesis token
        Engine->>Client: onSynthesisToken(token)
        Engine-->>WS: emit agent_chunk {sessionId, provider: 'judge', token}
    end
    Engine->>Client: onSynthesisEnd(fullSynthesis)
    Engine-->>WS: emit synthesis_ready {sessionId, status: 'completed', content}
    Engine->>Store: 세션 완료 저장

    Note over Client,WS: 정상 완료

    alt 에러 발생 시
        AgentA-->>Engine: Error (API/timeout/rate-limit)
        Engine->>Engine: callWithRetry (최대 3회)
        Engine->>Client: onRetry(provider, attempt, maxAttempts, error)
        alt 재시도 소진
            Engine-->>WS: emit error {sessionId, provider, code, message}
            Engine->>Client: throw Error
        end
    end

    alt 취소 명령 수신 시
        Client->>Engine: AbortSignal.abort() / cancel()
        Engine->>AgentA: 스트림 중단
        Engine->>AgentB: 스트림 중단
        Engine-->>WS: emit cancelled {sessionId, reason: 'user_cancelled'}
        Engine->>Store: 세션 상태 = CANCELLED
        WS-->>Client: cancelled 이벤트
    end
```

---

## 2. 토론 세션 상태 머신

토론 세션 생명주기의 모든 상태와 전이를 정의합니다.

```mermaid
stateDiagram-v2
    [*] --> IDLE : 세션 초기화

    IDLE --> RUNNING : run() 호출 / round_started 이벤트

    RUNNING --> STREAMING : agent.stream() 시작 / agent_chunk 스트리밍 중
    STREAMING --> RUNNING : 턴 완료 (onTurnEnd) / 다음 provider 턴 또는 다음 라운드
    RUNNING --> ROUND_COMPLETE : 라운드 내 모든 턴 완료 / round_finished 이벤트

    ROUND_COMPLETE --> RUNNING : 다음 라운드 존재 / round_started 이벤트
    ROUND_COMPLETE --> SYNTHESIZING : 모든 라운드 완료 + synthesis=true / synthesis_ready(started)

    SYNTHESIZING --> COMPLETED : 합성 완료 / synthesis_ready(completed) + onSynthesisEnd
    RUNNING --> COMPLETED : 모든 라운드 완료 + synthesis=false

    note right of STREAMING
        스트리밍 중 agent_chunk 이벤트 발생
        각 토큰을 onToken 콜백으로 전달
        누적된 청크로 최종 content 구성
    end note

    note right of SYNTHESIZING
        Judge provider가 전체 대화를 합산
        synthesis_ready(started → completed) 전이
    end note

    RUNNING --> ERROR : API 오류 / rate-limit (재시도 소진)
    STREAMING --> ERROR : 스트림 끊김 / timeout
    SYNTHESIZING --> ERROR : 합성 API 오류

    ERROR --> RUNNING : 재시도 가능 (attempt < maxAttempts) / onRetry 콜백
    ERROR --> FAILED : 재시도 소진 / error 이벤트 emit

    RUNNING --> CANCELLING : AbortSignal.abort() 수신
    STREAMING --> CANCELLING : AbortSignal.abort() 수신
    ROUND_COMPLETE --> CANCELLING : cancel() 호출
    SYNTHESIZING --> CANCELLING : cancel() 호출

    CANCELLING --> CANCELLED : 진행 중 스트림 종료 완료 / cancelled 이벤트

    COMPLETED --> [*]
    FAILED --> [*]
    CANCELLED --> [*]
```

---

## 3. 프로세스 종료 순서 다이어그램

`/stop` 명령 수신 시 스코프에 따른 종료 처리 흐름을 나타냅니다.

```mermaid
flowchart TD
    A(["/stop 명령 수신"]) --> B{종료 스코프 판단}

    B -->|"스코프 1: 현재 토론 세션만"| C1[AbortSignal.abort 전파]
    B -->|"스코프 2: 로컬 서버 포함 전체 데몬"| C2[HTTP 서버 shutdown 요청]
    B -->|"스코프 3: 외부 spawn된 CLI 프로세스 포함"| C3[findProcesses 실행]

    C1 --> D1[진행 중 스트림 중단]
    D1 --> D2[고아 프로세스 정리\ncleanupTempFiles]
    D2 --> D3[세션 상태 = CANCELLED]
    D3 --> END1([토론 세션 종료 완료])

    C2 --> E1[새 연결 수락 중단]
    E1 --> E2[기존 SSE 채널 종료\ncancelled 이벤트 emit]
    E2 --> E3[진행 중 토론 세션 중단]
    E3 --> E4[WebSocket 연결 종료]
    E4 --> E5[HTTP 서버 close]
    E5 --> END2([서버 프로세스 종료])

    C3 --> F1{"--force 플래그?"}
    F1 -->|Yes| F2[SIGKILL 전송]
    F1 -->|No| F3[SIGTERM 전송]
    F2 --> F4[orphan temp 파일 정리\nfight-for-me-*.txt 삭제]
    F3 --> F4
    F4 --> F5[resetTTYInputState 호출]
    F5 --> END3([외부 프로세스 종료 완료])

    style A fill:#4a90d9,color:#fff
    style END1 fill:#27ae60,color:#fff
    style END2 fill:#27ae60,color:#fff
    style END3 fill:#27ae60,color:#fff
    style B fill:#f39c12,color:#fff
    style F1 fill:#e74c3c,color:#fff
```

---

## 4. DebateEvent v1 타입 정의

웹 대시보드 확장 시 WebSocket/SSE로 전송되는 이벤트 계약입니다.

```typescript
// DebateEvent v1 - 이벤트 타입 열거형
type DebateEventType =
  | 'round_started'    // 새 라운드 시작
  | 'agent_chunk'      // AI 에이전트 토큰 스트리밍 청크
  | 'round_finished'   // 라운드 완료
  | 'synthesis_ready'  // 합성(판정) 시작 또는 완료
  | 'cancelled'        // 세션 취소
  | 'error'            // 에러 발생

// 공통 이벤트 베이스
interface DebateEventBase {
  type: DebateEventType
  sessionId: string
  timestamp: number   // Unix ms
}

// round_started: 새 라운드가 시작될 때 발생
interface RoundStartedEvent extends DebateEventBase {
  type: 'round_started'
  payload: {
    round: number       // 현재 라운드 번호 (1-based)
    total: number       // 전체 라운드 수
    participants: [string, string]  // e.g. ['claude', 'codex']
  }
}

// agent_chunk: AI 에이전트가 토큰을 스트리밍할 때마다 발생
interface AgentChunkEvent extends DebateEventBase {
  type: 'agent_chunk'
  payload: {
    provider: string    // 'claude' | 'codex' | 'gemini' | 'judge'
    token: string       // 스트리밍 토큰 (누적 필요)
    round: number
    phase: 'opening' | 'rebuttal' | 'synthesis'
  }
}

// round_finished: 라운드 내 모든 참가자의 턴이 완료되었을 때 발생
interface RoundFinishedEvent extends DebateEventBase {
  type: 'round_finished'
  payload: {
    round: number
    messages: Array<{
      provider: string
      phase: 'opening' | 'rebuttal'
      content: string   // 전체 응답 텍스트
    }>
  }
}

// synthesis_ready: 합성(판정) 단계의 시작 또는 완료
interface SynthesisReadyEvent extends DebateEventBase {
  type: 'synthesis_ready'
  payload: {
    status: 'started' | 'completed'
    judge: string       // 판정 담당 provider
    content?: string    // status='completed' 시에만 포함
  }
}

// cancelled: 사용자 요청 또는 시스템에 의해 세션이 취소됨
interface CancelledEvent extends DebateEventBase {
  type: 'cancelled'
  payload: {
    reason: 'user_cancelled' | 'timeout' | 'server_shutdown'
    lastRound?: number  // 취소 시점의 마지막 완료 라운드
    lastProvider?: string  // 취소 시점에 응답 중이던 provider
  }
}

// error: 에러 발생 (재시도 소진 또는 복구 불가 오류)
interface ErrorEvent extends DebateEventBase {
  type: 'error'
  payload: {
    code: DebateErrorCode
    message: string
    provider?: string   // 에러를 발생시킨 provider (있는 경우)
    round?: number      // 에러 발생 라운드
    retryable: boolean  // 클라이언트 재시도 가능 여부
  }
}

// 에러 코드 분류 (에러 taxonomy)
type DebateErrorCode =
  | 'RATE_LIMIT_EXCEEDED'    // API rate limit (재시도 가능)
  | 'PROVIDER_TIMEOUT'       // AI 응답 타임아웃
  | 'PROVIDER_UNAVAILABLE'   // CLI/API 연결 불가
  | 'STREAM_INTERRUPTED'     // 스트림 중간 끊김
  | 'CONTEXT_TOO_LONG'       // 컨텍스트 길이 초과
  | 'AUTH_FAILED'            // 인증 실패
  | 'INTERNAL_ERROR'         // 내부 오케스트레이터 오류

// 유니온 타입 - 모든 이벤트
type DebateEvent =
  | RoundStartedEvent
  | AgentChunkEvent
  | RoundFinishedEvent
  | SynthesisReadyEvent
  | CancelledEvent
  | ErrorEvent

// 웹 대시보드 SSE/WebSocket 전송 형식
interface DebateEventEnvelope {
  event: DebateEvent
  sequence: number  // 세션 내 이벤트 순번 (재연결 시 resume 포인트)
}
```

---

## 5. 이벤트 흐름 요약 (정상 경로)

| 순서 | 이벤트 | 발신자 | 수신자 | 설명 |
|------|--------|--------|--------|------|
| 1 | `round_started` | DebateEngine | 모든 구독자 | 새 라운드 시작 알림 |
| 2 | `agent_chunk` (반복) | DebateEngine | 모든 구독자 | AgentA 토큰 스트리밍 |
| 3 | `agent_chunk` (반복) | DebateEngine | 모든 구독자 | AgentB 토큰 스트리밍 |
| 4 | `round_finished` | DebateEngine | 모든 구독자 | 라운드 완료 및 전체 메시지 |
| 5 | (2-4 반복) | — | — | 추가 라운드 반복 |
| 6 | `synthesis_ready(started)` | DebateEngine | 모든 구독자 | 합성 단계 시작 |
| 7 | `agent_chunk` (반복) | DebateEngine | 모든 구독자 | 합성 토큰 스트리밍 |
| 8 | `synthesis_ready(completed)` | DebateEngine | 모든 구독자 | 합성 완료 및 최종 내용 |

## 6. 취소 전파 규칙

```
취소 명령 수신
    ↓
AbortSignal.abort() 전파
    ↓
현재 실행 중인 provider 스트림 즉시 중단
    ↓
진행 중인 AsyncIterable for...await 루프 탈출
    ↓
cancelled 이벤트 emit (sessionId, reason, lastRound)
    ↓
orphan 프로세스 정리 (cleanupTempFiles)
    ↓
세션 상태 → CANCELLED
```

**취소 전파 스코프별 동작:**

| 스코프 | 대상 | 처리 방법 |
|--------|------|-----------|
| 세션만 | 현재 토론 세션 스트림 | `AbortSignal.abort()` |
| 데몬 전체 | HTTP 서버 + 모든 활성 세션 | `server.close()` + 모든 세션 취소 |
| CLI 프로세스 | 외부 spawn된 node 프로세스 | `SIGTERM` / `SIGKILL` |
