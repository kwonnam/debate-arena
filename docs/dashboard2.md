# Debate: docs/design/ 의 문서들을 보고 대시보드를 설계하는 방안에 대해서 논의해줘

## Round 1 - Codex (Opening)

제 초기 입장은 명확합니다. 이 대시보드는 “예쁜 UI”보다 **DebateEvent 계약을 중심으로 한 관측(Observability) 계층**으로 설계해야 합니다. `docs/design/README.md`와 `architecture.md`가 공통으로 강조하는 Headless-Core-First 원칙에 맞춰, UI는 `DebateEngine`의 소비자여야 하고 엔진 로직을 침범하면 안 됩니다.

근거는 세 가지입니다.  
1) `architecture.md`의 TO-BE 구조는 Presentation(대시보드)와 Application(엔진)을 분리하고, 중간에 REST/WS 전송 계층을 둡니다. 이 분리가 있어야 CLI와 대시보드가 동일 엔진을 재사용합니다.  
2) `events-and-states.md`는 `round_started → agent_chunk → round_finished → synthesis_ready` 이벤트 시퀀스와 상태머신(RUNNING/STREAMING/SYNTHESIZING/CANCELLED)을 명시합니다. 즉, 화면 상태는 컴포넌트 내부 상태가 아니라 이벤트/상태머신으로 구동해야 레이스 컨디션과 재연결 복원 문제가 줄어듭니다.  
3) `roadmap-and-providers.md`는 Gate 기반 병렬 개발을 요구합니다. 계약 테스트, SessionStore, config v2 마이그레이터가 먼저 고정되어야 Track A(Provider)와 Track B(Dashboard 서버)가 안전하게 병렬 진행됩니다.

그래서 설계 방안은 다음이 합리적입니다.  
- 실시간 채널: WS로 `DebateEventEnvelope(sequence 포함)` 스트리밍.  
- 복원 채널: REST `GET /sessions/{id}/events`로 재연결 replay.  
- UI 정보구조: (a) 세션 목록/상태, (b) 라운드 타임라인+에이전트 스트림, (c) synthesis/오류/취소 로그.  
- 운영 안전장치: localhost 바인딩, CORS allowlist, API 키 redaction, `error` 이벤트 표준 코드화.  

요약하면, 이 대시보드는 “채팅창”이 아니라 **이벤트 소싱 기반 세션 모니터**로 가야 문서들과 가장 일관되고, 이후 Ollama Cloud 확장에도 안정적입니다.


---

## Round 1 - Claude (Opening)

Codex의 핵심 주장인 "Headless-Core-First + 이벤트 소싱 기반 세션 모니터"는 `architecture.md`와 `events-and-states.md`에 명확히 근거를 두고 있어 동의합니다. 하지만 **"세션 모니터"라는 프레이밍이 설계 문서의 목표 범위를 절반밖에 담지 못한다는 점**을 지적해야 합니다.

---

## 반론: 대시보드는 모니터가 아니라 Control Plane이어야 합니다

`roadmap-and-providers.md` Section 3을 보면 Phase 3 통합 항목에 **모델 등록 UX**가 명시되어 있습니다:

> CLI와 대시보드 두 경로 모두 동일한 `ConfigManager v2` → `ProviderFactory` 경로를 공유

이는 대시보드가 단순 "토론 시각화"를 넘어, 사용자가 Ollama Cloud 및 OpenAI-compat Provider의 URL과 API 키를 입력하고 `POST /api/models`로 등록하는 **설정 제어 인터페이스**를 포함해야 함을 의미합니다. Codex가 제안한 (a)~(c) 세 영역은 모두 읽기(read) 전용이지만, 대시보드에는 **쓰기(write) 경로**, 즉 Provider 등록과 세션 중단(`/stop`)이 반드시 포함됩니다.

따라서 정보 구조는 4개 영역으로 설계해야 합니다:

| 영역 | 성격 | 핵심 이벤트/API |
|---|---|---|
| 세션 목록 + 상태 | 읽기 | `GET /sessions` |
| 라운드 타임라인 + 에이전트 스트림 | 읽기(실시간) | WS `agent_chunk` |
| Synthesis / 에러 / 취소 로그 | 읽기 | `GET /sessions/{id}/events` replay |
| **Provider 등록 + 모델 관리** | **쓰기** | `POST /api/models`, `SecretStore` |

---

## 로드맵 순서에 대한 보완

Codex는 WS 스트리밍을 핵심 채널로 강조했지만, `roadmap-and-providers.md`의 Gantt를 보면 **Phase 2B(Track B)는 Hono HTTP 서버 + 대시보드 뼈대**로 시작하고, WebSocket은 **Phase 3(통합) 첫 항목**입니다. 즉, REST API 골격이 먼저 검증되어야 WS 레이어를 안전하게 올릴 수 있습니다. 설계 순서는 REST-first가 문서와 더 정확히 정렬됩니다.

---

## Codex 논거의 공백: in-memory SessionStore 재시작 UX

`events-and-states.md`의 재연결 시나리오는 `GET /sessions/{id}/events`로 히스토리를 replay하는 것을 정의하지만, in-memory SessionStore는 **서버 재시작 시 모든 세션이 소멸**됩니다. Codex의 설계에서는 이 엣지 케이스에서 사용자가 빈 대시보드를 마주할 때 어떻게 안내받는지가 빠져 있습니다. Phase 3 SQLite 마이그레이션이 선택 사항이 아니라 **사용성 요구사항**이 될 수 있음을 설계 초기부터 고려해야 합니다.

---

결론적으로, Codex의 이벤트 계약 중심 관측 계층은 필요조건이지만 충분조건은 아닙니다. 대시보드는 **이벤트 소싱 모니터 + Provider 제어판**의 이중 역할로 설계될 때 비로소 문서가 정의한 세 가지 목표(로컬 시각화, Ollama Cloud 연동, CLI 호환)를 모두 충족합니다.


---

## Round 2 - Codex (Rebuttal)

Claude의 반론에서 **두 가지는 타당**합니다.  
첫째, 대시보드가 읽기 전용이면 문서 목표(특히 Ollama Cloud 연동)를 충족하지 못합니다. `roadmap-and-providers.md`의 Phase 3 `모델 등록 UX`는 분명한 쓰기 경로 요구입니다.  
둘째, 구현 순서상 Track B에서 Hono REST 뼈대를 먼저 세우는 점도 맞습니다.

다만, 당신의 결론인 “세션 모니터 프레이밍은 절반만 담는다”는 과장입니다. `docs/design/README.md`의 핵심 원칙은 **Headless-Core-First**이고, `architecture.md`는 DebateEngine/EventBus를 중심에 두며 REST/WS를 transport로 둡니다. 즉 대시보드의 본체는 여전히 **이벤트 계약 기반 관측 모델**이고, 모델 등록/중단은 그 위에 얹는 **제어 기능**입니다. “모니터 vs 컨트롤”의 이분법보다 “관측 중심 + 제어 확장”이 문서와 더 정합적입니다.

또한 “REST-first가 더 정확하다”는 주장도 범위를 구분해야 합니다. 개발 순서는 REST-first가 맞지만, 런타임 토론 UX의 핵심 채널은 `events-and-states.md`가 정의한 `agent_chunk` 스트리밍이며 이는 WS/SSE 계열 이벤트 흐름을 전제합니다. 정확한 표현은 **Implementation: REST-first, Runtime semantics: Event-first** 입니다.

내 입장을 보강하면 설계는 2-plane이 적절합니다.  
1. Observability Plane: 세션 목록, 라운드 타임라인, synthesis/error replay (`GET /sessions`, `GET /sessions/{id}/events`, WS).  
2. Control Plane: 모델 등록/검증, 세션 중단 (`POST /api/models`, `/stop` lifecycle).  
핵심은 두 plane 모두 같은 Application Core(`ConfigManager v2 -> ProviderFactory`, `StopLifecycle`)를 공유하되, UI에서는 권한/보안 경계를 분리하는 것입니다.

Claude 논리의 공백도 있습니다.  
1. SQLite를 “선택이 아닌 필수”로 밀었지만 문서상 `SQLite migration (선택)`입니다. 필수는 영속화가 아니라 **재시작 UX 명시**입니다.  
2. 쓰기 경로를 강조하면서도 권한 모델, redaction, `/stop` 스코프 계약을 구체화하지 않았습니다.  
3. CLI 호환의 핵심인 v1->v2 마이그레이션 리스크를 제어 평면 설계에 연결하지 않았습니다.


---

## Round 2 - Claude (Rebuttal)

Codex의 마지막 반론에서 핵심 수정 사항을 수용하면서도, 남은 설계 공백을 더 날카롭게 짚겠습니다.

---

## 수용: 2-Plane 프레이밍이 더 정확합니다

"모니터 vs 컨트롤"의 이분법 대신 **Observability Plane + Control Plane이 같은 Application Core를 공유**한다는 모델이 문서와 더 정합적입니다. 이 표현을 채택합니다. 또한 SQLite를 "필수"로 밀었던 부분도 과장이었음을 인정합니다. 문서는 `선택`으로 명시하며, 실제 설계 요구사항은 **재시작 UX를 명시적으로 처리하는 것**이 맞습니다.

---

## 보강: 2-Plane의 진짜 설계 문제는 경계 계약입니다

Codex의 2-plane 모델이 놓친 것이 있습니다. **두 Plane이 같은 Application Core를 공유할 때, 누가 언제 쓰기를 허용하는지가 API 설계 시점에 고정되지 않으면** Control Plane이 Observability Plane의 실시간 스트림을 오염시킵니다.

구체적으로, `POST /api/models`로 Provider를 추가하는 동시에 WS로 `round_started` 이벤트가 흐르는 상황에서 `ProviderFactory` 재초기화가 진행 중인 라운드 스트리밍에 어떤 영향을 주는지가 설계 문서에 정의되지 않았습니다. 이것은 보안 경계가 아니라 **상태 불변성 계약**의 문제입니다. 설계 초기부터 "모델 등록은 세션 없는 유휴 상태에서만 허용" 같은 명시적 제약이 필요합니다.

---

## Codex 논거의 추가 공백: CLI 호환의 구체적 진입점

v1→v2 마이그레이션 리스크를 언급했지만, 대시보드가 Control Plane 역할을 할 때 CLI와 대시보드가 **동일한 `ConfigManager v2`를 동시에 변경하는 충돌 시나리오**가 여전히 해소되지 않았습니다. 파일 기반 config라면 파일 락이 필요하고, 메모리 기반이라면 IPC가 필요합니다. 2-plane 모델만으로는 이 조율 메커니즘이 자동으로 결정되지 않습니다.

---

## 최종 수렴: 설계 결정이 필요한 3가지

논쟁을 계속하기보다 두 입장이 공통으로 요구하는 구체적 결정을 명확히 하는 것이 생산적입니다:

1. **상태 불변성 계약**: Control Plane 쓰기는 유휴 세션에서만 허용할지, 아니면 핫 리로드를 지원할지
2. **재시작 UX 처리**: in-memory SessionStore 소멸 시 빈 대시보드가 아닌 명시적 안내 상태 설계
3. **ConfigManager 공유 조율**: CLI-대시보드 동시 접근 시 단일 writer 보장 메커니즘

이 세 결정이 없으면 어떤 아키텍처 프레이밍도 구현 단계에서 임시방편으로 채워질 것입니다.


---

## Round 3 - Codex (Rebuttal)

핵심 지적 3개는 동의합니다. 특히 `상태 불변성 계약`, `재시작 UX 명시`, `ConfigManager 동시 접근 조율`은 설계 초기에 못 박아야 합니다. 이 점은 `events-and-states.md`의 상태머신과 `roadmap-and-providers.md`의 통합 단계 리스크와 정확히 맞닿아 있습니다.

다만 “모델 등록은 유휴 상태에서만 허용”은 과도한 제약입니다. 제가 제안하는 계약은 더 정밀합니다.

1. 세션 불변성: `run()` 시점에 `provider snapshot`(provider id + config version)을 세션 메타데이터로 고정합니다.  
2. 제어 쓰기 허용: `POST /api/models`는 레지스트리만 갱신하고, 이미 RUNNING인 세션에는 영향이 없습니다.  
3. 적용 시점 분리: 새/변경 provider는 “다음 세션부터” 적용합니다. 핫스왑은 명시적으로 지원할 때만 별도 플래그로 엽니다.

이렇게 하면 Observability Plane의 실시간 스트림(`agent_chunk`)은 오염되지 않으면서 Control Plane 쓰기도 막지 않습니다. 문서의 병렬 개발/통합 의도와도 정합적입니다.

동시성도 2-plane만으로 해결된다고 보지 않습니다. 그래서 `ConfigManager v2`에 단일 writer 규칙을 명시해야 합니다: lockfile(또는 단일 서버 경유) + 버전 기반 CAS(`expectedVersion`) + 충돌 시 `409` 재시도. 이건 CLI/대시보드 공용 진입점 원칙을 실제 동작으로 만드는 최소 계약입니다.

당신 논리의 약점은 두 가지입니다.  
1. “idle-only write”가 문서 목표(운영 중 제어 UX) 대비 지나치게 보수적입니다.  
2. 쓰기 충돌은 짚었지만, 이벤트 일관성 핵심인 `DebateEventEnvelope.sequence` 기반 재생/중복제거 규칙까지는 연결하지 못했습니다.

결론적으로, 최적안은 당신의 3개 결정 축을 채택하되, 정책은 **global idle lock**이 아니라 **session immutability + deferred activation + versioned config writes**로 구체화하는 것입니다.


---

## Round 3 - Claude (Rebuttal)

## 수용: Session Immutability + Deferred Activation이 더 우월합니다

Codex의 수정 제안을 채택합니다. "idle-only write" 제약은 제가 과도하게 보수적이었고, **provider snapshot 고정 + 다음 세션 적용 + versioned CAS**가 운영 중 제어 UX와 스트림 안정성을 동시에 만족합니다. 이 모델이 문서의 Phase 3 통합 의도와 더 잘 정렬됩니다.

`DebateEventEnvelope.sequence` 연결도 정확한 지적이었습니다. 제가 쓰기 충돌만 짚고 이벤트 재생 규칙까지 연결하지 못한 것은 공백이었습니다.

---

## Codex 제안의 남은 공백: "Pending Config" UI 상태

Deferred activation 모델에서 `POST /api/models`가 성공하면 레지스트리는 갱신되지만 현재 실행 중인 세션에는 반영되지 않습니다. 이때 대시보드는 **현재 유효한 config**와 **다음 세션에 적용될 pending config**를 동시에 보여줘야 합니다.

Codex의 제안에는 이 "Pending Config" 상태를 어떤 데이터 모델로 표현하고, Observability Plane의 세션 뷰와 어떻게 분리해 렌더링할지가 빠져 있습니다. 단순히 409 CAS 재시도만으로는 UI가 이 이중 상태를 표현하는 방법이 자동으로 결정되지 않습니다.

---

## Sequence 기반 재생과 Plane 소유권 문제

`DebateEventEnvelope.sequence`를 재생/중복제거에 쓴다면, **재연결 시 어떤 Plane이 cursor를 관리하는지**가 새로운 질문입니다. Observability Plane의 WS 클라이언트가 마지막 수신 `sequence`를 기억하고 `GET /sessions/{id}/events?from=N`으로 replay를 요청하는 책임은 자연스럽게 클라이언트 측에 귀속됩니다. 그러나 Control Plane의 쓰기 작업이 event sequence에 삽입되는지(예: `model_registered` 이벤트), 아니면 별도 채널로 분리되는지가 명시되지 않으면 replay 시 이벤트 순서가 모호해집니다.

---

## 합의된 설계 결정 3+1

세 가지 결정에 더해 이제 네 번째가 필요합니다:

| # | 결정 사항 | 합의 내용 |
|---|---|---|
| 1 | 상태 불변성 계약 | Session snapshot + deferred activation |
| 2 | 재시작 UX | 명시적 "세션 없음" 안내 상태 |
| 3 | ConfigManager 조율 | Single writer + versioned CAS + 409 retry |
| **4** | **Pending Config UI 상태** | **현재 config / pending config 이중 뷰 데이터 모델 설계 필요** |

이 네 번째 결정 없이는 Control Plane이 완성되지 않습니다.


---

## Round 4 - Codex (Rebuttal)

핵심 두 지점은 동의합니다.  
첫째, `Pending Config`를 UI에서 1급 상태로 다뤄야 한다는 점은 맞습니다. `roadmap-and-providers.md`의 “CLI/대시보드 공통 `ConfigManager v2` 경로”를 실제 UX로 풀면, 사용자는 “지금 적용값”과 “다음 세션 적용 예정값”을 동시에 봐야 합니다.  
둘째, 재연결 커서 책임을 명시해야 한다는 지적도 타당합니다.

다만 `sequence` 소유권 문제는 Claude가 약간 섞어 설명했습니다. `events-and-states.md`의 `DebateEventEnvelope.sequence`는 본질적으로 **세션 스트림 불변성**을 위한 축입니다. 그래서 `model_registered` 같은 Control 이벤트를 같은 시퀀스에 넣으면 세션 재생 의미가 오염됩니다.

제안은 다음처럼 더 명확합니다.

1. `Observability Plane` 이벤트는 세션 범위로 유지:  
`GET /sessions/{id}/events?fromSequence=N`, WS도 session-scoped sequence 사용.
2. `Control Plane`은 별도 revision 로그 사용:  
`GET /api/config/events?fromRevision=R` 또는 `GET /api/config/state`.
3. UI는 이중 상태 모델 채택:  
`activeConfigVersion`, `pendingConfigVersion`, `pendingStatus(validating|ready|failed)`, `effectivePolicy(next_session)`.
4. `POST /api/models`는 `expectedVersion` + idempotency key로 처리하고, 성공 시 “pending/ready”를 명시 반환.

Claude 논리의 남은 공백도 있습니다.

1. `Pending Config`를 제기했지만 `pending -> active` 전이 조건(검증 실패/덮어쓰기/superseded)까지는 정의하지 않았습니다.  
2. 커서 책임을 말했지만, 클라이언트/서버 중 누가 “최종 정합성 기준(authoritative replay)”인지를 고정하지 않았습니다.  
3. CLI 호환 관점에서 `/status`나 `/config`가 active/pending을 어떻게 동일하게 노출할지 연결이 빠졌습니다.

결론적으로 합의안은 유지됩니다: **session immutability + deferred activation + versioned CAS**를 기반으로, 여기에 **plane별 로그 분리와 pending 상태 모델**을 추가하면 설계가 닫힙니다.


---

## Round 4 - Claude (Rebuttal)

## 수용: Plane별 로그 분리가 설계를 닫습니다

Codex의 핵심 수정을 채택합니다. `model_registered`를 세션 시퀀스에 섞으면 replay 의미가 오염된다는 지적이 정확합니다. **Observability Plane은 session-scoped sequence, Control Plane은 별도 revision 로그**로 분리하는 것이 `events-and-states.md`의 불변성 원칙과 정합적입니다. 4-field pending 모델(`activeConfigVersion`, `pendingConfigVersion`, `pendingStatus`, `effectivePolicy`)도 구체적이고 수용합니다.

---

## Codex가 지적한 공백 3개를 채웁니다

**1. pending → active 전이 조건**

```
validating  →  ready | failed
ready       →  active (다음 session.run() 시 자동 승격)
             → superseded (새 POST가 오면 덮어쓰기)
failed      →  사용자 명시 수정 전 유지
```

승격 트리거는 `session.run()` 진입 시점에 `ConfigManager.commit(pendingVersion)`을 호출하는 것이 가장 단순합니다. 이 시점이 "세션 스냅샷 고정" 계약과 자연스럽게 결합됩니다.

**2. Authoritative replay 기준**

서버가 권위적 소스입니다. 클라이언트는 마지막 수신 sequence를 로컬에 보관하고 `?fromSequence=N`으로 요청하지만, 서버가 실제 이벤트 저장소를 소유합니다. 클라이언트 cursor는 힌트일 뿐이며 서버는 항상 gap을 채웁니다.

**3. CLI /status · /config 호환**

CLI의 `/status`와 `/config`는 동일한 `ConfigManager v2.read()`를 호출하고 active/pending을 함께 출력하면 됩니다:

```
active:  claude@3-opus  (v12)
pending: ollama-compat  (v13, ready → applies at next session)
```

---

## Codex 제안의 남은 공백: Validation 의미론

4-field 모델에서 `pendingStatus: validating`이 정확히 무엇을 검증하는지가 미정입니다. 두 가지 중 하나를 선택해야 합니다:

- **Syntactic validation**: config 스키마 검사만 (빠르지만 런타임 실패 가능)
- **Connectivity validation**: provider endpoint에 실제 ping (느리지만 안전)

이 선택이 없으면 `pendingStatus: failed`의 원인이 모호해져 사용자가 오류를 진단할 수 없습니다. `roadmap-and-providers.md`의 Gate 기반 병렬 개발 원칙상 **Provider 계약 테스트가 Gate 조건**이므로, connectivity validation이 문서와 더 정합적입니다. 단, 비동기로 처리하고 결과를 `GET /api/config/state`로 폴링하거나 별도 WS 이벤트(`config_validation_result`)로 푸시해야 합니다.

---

## 최종 합의 결정 테이블

| # | 결정 사항 | 합의 내용 |
|---|---|---|
| 1 | 상태 불변성 | Session snapshot + deferred activation (session.run()에서 승격) |
| 2 | 재시작 UX | 명시적 "세션 없음" 안내 상태 |
| 3 | ConfigManager 조율 | Single writer + versioned CAS + 409 retry |
| 4 | Pending Config UI | 4-field 모델 + pending→active 전이 조건 정의 |
| **5** | **Validation 의미론** | **Connectivity validation (비동기) + config_validation_result 이벤트** |

이 다섯 결정이 고정되면 Observability Plane + Control Plane 설계가 완결됩니다.


---

## Round 5 - Codex (Rebuttal)

핵심 쟁점에 대해선 대부분 합의합니다.  
`events-and-states.md` 기준으로 세션 스트림 불변성을 지키려면 `session-scoped sequence`와 `config revision log` 분리는 필수이고, `architecture.md`의 Core 공유 원칙과도 일치합니다. 또한 `active/pending` 이중 상태를 명시해야 Control Plane UX가 닫힌다는 점도 타당합니다.

다만 Validation 의미론은 Claude 안을 그대로 고정하면 운영성이 떨어집니다. `roadmap-and-providers.md`의 Gate 취지는 “계약 검증 가능성”이지 “항상 실시간 네트워크 ping 성공”이 아닙니다. 따라서 저는 다음처럼 강화합니다.

1. `pendingStatus`를 2축으로 분리  
`schemaStatus(valid|invalid)` + `connectivityStatus(unknown|ok|fail)`  
스키마 유효성은 동기 필수, 연결성 검증은 비동기 권장. 오프라인/사설망 환경에서도 등록 자체는 가능해야 합니다.

2. 승격 규칙을 원자적으로 고정  
`session.run()` 진입 시 `commitIfVersion(expectedPendingVersion)` CAS로 승격하고, 성공 시 snapshot 고정. 동시 시작 경쟁에서도 단일 승격만 허용합니다.

3. 비동기 검증 결과의 stale write 방지  
`config_validation_result`는 반드시 `version`과 `requestId`를 포함하고, 현재 pending version과 다르면 폐기해야 합니다. 그렇지 않으면 superseded된 검증 결과가 UI를 오염시킵니다.

Claude 논리의 남은 공백은 세 가지입니다.  
1. `commit(pendingVersion)` 제안에 동시성 원자성 정의가 없습니다.  
2. connectivity 실패 시 정책(등록 거부 vs 다음 세션 시도 허용)이 빠져 있습니다.  
3. 재생 규칙에서 서버 authoritative는 맞지만, API가 `nextSequence/hasGap` 같은 복구 메타를 주지 않으면 클라이언트가 일관 복구를 보장하기 어렵습니다.

결론적으로 최종안은 유지됩니다: `session immutability + deferred activation + versioned CAS`를 축으로, Validation을 2축 상태로 분해하고 stale-result 차단 계약까지 포함해야 설계가 실제 운영에서 안전해집니다.


---

## Round 5 - Claude (Rebuttal)

## 수용: 2축 Validation + Stale-Result 차단이 더 견고합니다

Codex의 핵심 수정 세 가지를 모두 채택합니다.

`schemaStatus(valid|invalid)` + `connectivityStatus(unknown|ok|fail)` 분리는 오프라인/사설망 환경에서도 등록을 허용해야 한다는 운영 현실을 정확히 반영합니다. 단일 `pendingStatus`보다 훨씬 진단 가능합니다. `config_validation_result`에 `version + requestId`를 포함해 superseded 결과를 폐기하는 stale-write 차단 계약도 필수이며 수용합니다.

---

## Codex가 지적한 공백 3개를 채웁니다

**1. `commitIfVersion` 원자성 정의**

```
commitIfVersion(expectedPendingVersion):
  - ConfigManager 내부에서 단일 mutex 보호
  - 조건: currentPending.version === expectedPendingVersion AND schemaStatus === valid
  - 성공 → activeVersion = pending, pendingVersion = null, snapshot 고정
  - 실패 → 409 반환, session.run() 중단
```

동시 세션 시작 경쟁은 mutex + CAS 조합으로 단일 승격만 허용합니다.

**2. Connectivity 실패 시 정책**

`connectivityStatus=fail`이어도 등록은 허용하되, `session.run()` 진입 시 경고를 노출하고 사용자 명시 확인(`--force` 또는 UI 확인 다이얼로그) 없이는 승격을 차단합니다. "등록 거부"가 아닌 "승격 게이트"로 처리하면 오프라인 pre-registration과 런타임 안전성을 동시에 확보할 수 있습니다.

**3. Replay API에 `nextSequence/hasGap` 추가**

```
GET /sessions/{id}/events?fromSequence=N
→ { events: [...], nextSequence: M, hasGap: false }
```

`hasGap: true`이면 클라이언트는 전체 재생을 요청합니다. 서버 authoritative 원칙과 결합해 클라이언트가 gap 여부를 독립 추론할 필요가 없습니다.

---

## Codex 제안의 남은 공백: Connectivity 타임아웃과 승격 경합

2축 모델에서 해소되지 않은 시나리오가 있습니다. **`connectivityStatus=unknown`(검증 진행 중) 상태에서 `session.run()`이 호출되면 어떻게 됩니까?** 검증이 완료되기 전에 승격이 일어나면 `connectivityStatus`가 영구히 `unknown`으로 스냅샷에 고정됩니다.

두 가지 선택이 필요합니다:
- **차단 정책**: `unknown` 상태에서는 승격을 대기(timeout 필요)
- **낙관적 정책**: `unknown`으로 승격하고, 이후 결과를 세션 메타에 사후 기록

`roadmap-and-providers.md`의 Gate 원칙상 계약 검증 가능성을 중시하므로, **차단 + 타임아웃(예: 10초) + timeout 시 `connectivityStatus=unknown`으로 승격** 순서가 문서와 더 정합적입니다.

---

## 최종 합의 결정 테이블 (6개)

| # | 결정 사항 | 합의 내용 |
|---|---|---|
| 1 | 상태 불변성 | Session snapshot + deferred activation |
| 2 | 재시작 UX | 명시적 "세션 없음" 안내 상태 |
| 3 | ConfigManager 조율 | Single writer + mutex CAS + 409 retry |
| 4 | Pending Config UI | 4-field 모델 + pending→active 전이 조건 |
| 5 | Validation 의미론 | 2축(schema/connectivity) + stale-result 차단 |
| **6** | **Connectivity 타임아웃 정책** | **unknown 상태 승격 시 차단/낙관적 선택 + timeout 정의** |

이 여섯 결정이 고정되면 두 Plane 설계는 운영 환경에서 닫힙니다.


---

## Final Synthesis

`docs/design/` 문서들을 바탕으로 한 대시보드 설계 방안에 대하여 Codex와 Claude가 나눈 5라운드 간의 심도 있는 토론을 종합하여 다음과 같이 정리합니다.

### 1. 양측의 주요 합의 사항 (Key Points of Agreement)

양측은 대시보드가 단순한 시각화 도구를 넘어 시스템의 안정성과 확장성을 담보하는 핵심 계층이 되어야 한다는 점에 합의하며 다음의 설계 원칙을 도출했습니다.

*   **2-Plane 아키텍처:** 대시보드는 실시간 이벤트를 관측하는 **Observability Plane**과 모델/설정을 관리하는 **Control Plane**의 이중 구조로 설계됩니다.
*   **Headless-Core-First:** CLI와 대시보드는 동일한 Application Core(`DebateEngine`, `ConfigManager`)를 공유하며, REST/WS 전송 계층을 통해서만 통신합니다.
*   **세션 불변성 및 지연 활성화 (Session Immutability & Deferred Activation):** 진행 중인 토론의 안정성을 위해 세션 시작 시점의 설정을 스냅샷으로 고정하며, 변경된 설정은 "다음 세션"부터 적용됩니다.
*   **상태 중심 UI:** 대시보드는 자체 상태가 아닌 서버의 `DebateEvent` 시퀀스와 상태머신을 기반으로 구동되어 재연결 및 복구 시 일관성을 유지합니다.
*   **동시성 제어:** Config 파일 접근 시 Single Writer Rule, Mutex 기반 CAS(Compare-And-Swap), 409 Retry 메커니즘을 적용하여 CLI와 대시보드 간의 충돌을 방지합니다.

### 2. 각 사이드별 가장 설득력 있는 논거 (Compelling Arguments)

*   **Codex (기술적 견고성 및 데이터 무결성):**
    *   "이벤트 소싱 기반 세션 모니터"라는 개념을 통해 UI와 엔진 간의 완벽한 분리를 주장했습니다.
    *   특히, 세션 범위의 이벤트 시퀀스와 전역 설정 리비전 로그를 분리해야 한다는 논거는 시스템의 재현성(Reproducibility)을 확보하는 데 매우 결정적이었습니다.
    *   비동기 검증 결과가 늦게 도착할 경우 발생할 수 있는 'Stale Write' 문제를 버전 체크로 해결해야 한다는 점을 짚어 운영 안정성을 높였습니다.

*   **Claude (사용자 경험 및 기능적 완결성):**
    *   단순 모니터링을 넘어 Provider 등록 및 모델 관리를 포함하는 "Control Plane"으로의 확장 필요성을 제기했습니다.
    *   설계 문서의 목표(Ollama Cloud 연동 등)를 달성하기 위해 쓰기(Write) 경로 설계가 필수적임을 입증했습니다.
    *   지연 활성화 모델에서 사용자가 겪을 혼란을 방지하기 위해 "Active vs Pending" 이중 상태 UI 모델의 필요성을 강조하여 UX의 구체성을 더했습니다.

### 3. 더 강력한 논거를 보여준 영역 (Areas of Stronger Reasoning)

*   **Codex**는 **아키텍처의 불변성과 동시성 설계** 영역에서 압도적인 논리를 보여주었습니다. 특히 세션 스트림 오염 방지를 위한 로그 채널 분리나, CAS를 활용한 원자적 승격 규칙 정의 등은 실제 구현 시 발생할 수 있는 치명적인 레이스 컨디션을 예방하는 핵심 통찰이었습니다.
*   **Claude**는 **도메인 요구사항 해석과 예외 상황 처리** 영역에서 더 기여했습니다. 설계 문서에 명시된 Phase별 로드맵을 근거로 REST-first 접근법을 제안하고, 인메모리 저장소의 휘발성에 따른 '재시작 UX' 대응 필요성을 제기하는 등 사용자 관점의 완결성을 끌어올렸습니다.

### 4. 최종 종합 설계안 (Final Balanced Answer)

토론의 결과를 종합한 최적의 대시보드 설계 방안은 다음과 같습니다.

#### [아키텍처]
*   **Core:** 공통 `ConfigManager` 및 `DebateEngine` 사용.
*   **Transport:** 실시간 스트리밍은 WebSocket(`DebateEvent`), 히스토리 복구는 REST API(`replay`) 사용.
*   **Log 분리:** 세션 이벤트(Sequence 기반)와 설정 변경 로그(Revision 기반)를 별도 채널로 관리하여 데이터 무결성 보장.

#### [데이터 및 상태 관리]
*   **Session Immutability:** `session.run()` 호출 시 현재의 Config를 스냅샷으로 고정.
*   **Promotion Logic:** 설정 변경 시 즉시 적용하지 않고 'Pending' 상태로 보관하며, 다음 세션 시작 시점에 원자적(Atomic)으로 'Active'로 승격.
*   **Validation:** 2축 검증 적용 (스키마 유효성-동기 / 연결성 확인-비동기). 비동기 결과는 버전 체크를 통해 Stale Write 차단.

#### [UI/UX 구성]
*   **Observability View:** 세션 목록, 라운드 타임라인, 에이전트 스트림, Replay 지원 로그.
*   **Control View:** Provider 등록/수정, 모델 관리, 'Active'와 'Pending' 설정을 동시에 보여주는 이중 상태 뷰.
*   **Resilience UI:** 서버 재시작 시의 명시적 안내 상태 및 재연결 시 서버 Authoritative Cursor 기반의 자동 갭 채우기(Gap-fill).

#### [동시성 및 보안]
*   **Concurrency:** Lockfile 및 버전 기반 CAS를 통한 단일 Writer 보장.
*   **Security:** API 키 Redaction 처리 및 Localhost/CORS 허용 리스트 관리.

### 5. 결론
본 설계는 `docs/design/`이 지향하는 **Headless-Core-First** 원칙을 충실히 따르면서도, 실무 운영에서 발생할 수 있는 **동시성, 상태 불변성, 비동기 검증** 문제를 정교한 이벤트 계약으로 해결합니다. 대시보드는 단순한 뷰어가 아니라, 엔진의 상태를 안전하게 제어하고 관측하는 **신뢰할 수 있는 제어판(Control Plane)** 역할을 수행하게 될 것입니다.

