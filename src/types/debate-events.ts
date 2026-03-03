// DebateEvent v1 - 이벤트 타입 열거형
export type DebateEventType =
  | 'round_started'
  | 'agent_chunk'
  | 'round_finished'
  | 'synthesis_ready'
  | 'cancelled'
  | 'error'

// 공통 이벤트 베이스
export interface DebateEventBase {
  type: DebateEventType
  sessionId: string
  timestamp: number // Unix ms
}

// round_started
export interface RoundStartedEvent extends DebateEventBase {
  type: 'round_started'
  payload: {
    round: number
    total: number
    participants: [string, string]
  }
}

// agent_chunk
export interface AgentChunkEvent extends DebateEventBase {
  type: 'agent_chunk'
  payload: {
    provider: string
    token: string
    round: number
    phase: 'opening' | 'rebuttal' | 'synthesis'
  }
}

// round_finished
export interface RoundFinishedEvent extends DebateEventBase {
  type: 'round_finished'
  payload: {
    round: number
    messages: Array<{
      provider: string
      phase: 'opening' | 'rebuttal'
      content: string
    }>
  }
}

// synthesis_ready
export interface SynthesisReadyEvent extends DebateEventBase {
  type: 'synthesis_ready'
  payload: {
    status: 'started' | 'completed'
    judge: string
    content?: string
  }
}

// cancelled
export interface CancelledEvent extends DebateEventBase {
  type: 'cancelled'
  payload: {
    reason: 'user_cancelled' | 'timeout' | 'server_shutdown'
    lastRound?: number
    lastProvider?: string
  }
}

// error
export interface ErrorEvent extends DebateEventBase {
  type: 'error'
  payload: {
    code: DebateErrorCode
    message: string
    provider?: string
    round?: number
    retryable: boolean
  }
}

// 에러 코드 taxonomy
export type DebateErrorCode =
  | 'RATE_LIMIT_EXCEEDED'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_UNAVAILABLE'
  | 'STREAM_INTERRUPTED'
  | 'CONTEXT_TOO_LONG'
  | 'AUTH_FAILED'
  | 'INTERNAL_ERROR'

// 유니온 타입
export type DebateEvent =
  | RoundStartedEvent
  | AgentChunkEvent
  | RoundFinishedEvent
  | SynthesisReadyEvent
  | CancelledEvent
  | ErrorEvent

// WebSocket/SSE 전송 형식
export interface DebateEventEnvelope {
  event: DebateEvent
  sequence: number // 세션 내 이벤트 순번
  sessionId: string
  timestamp: number // Unix ms
}