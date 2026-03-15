# debate-arena 대시보드 워크벤치 정리

## 한 줄 정의

대시보드는 더 이상 "CLI 결과를 보는 화면"이 아니라, **질문 → 근거 → 토론 → 결론**을 하나의 흐름으로 연결하는 **근거 기반 의사결정 워크벤치**다.

## 현재 페이지 구성

- `/` : 허브 페이지
- `/project.html` : 로컬 기반 프로젝트 개선 + 신규 기획 토론
- `/news.html` : 뉴스 근거 수집과 뉴스 토론
- `/settings.html` : 역할 템플릿 YAML 편집

분리 이유는 단순하다.

- 프로젝트·기획은 로컬 실행 경로, 첨부 파일, 코드 문맥과 아이디어 브리프가 중심이다.
- 뉴스 토론은 검색어, 스냅샷, 기사 근거, 시장·정책 해석이 중심이다.
- 두 흐름을 같은 폼에서 섞으면 입력 부담이 커지고, 문맥도 불명확해진다.

## 현재 반영된 방향

### 1. 워크플로우를 페이지 단위로 분리했다

- 프로젝트·기획과 뉴스 토론을 서로 다른 페이지로 분리했다.
- 허브는 진입점만 담당하고, 실제 실행은 각 워크플로우 페이지가 맡는다.
- 각 페이지는 최근 세션 목록도 자기 워크플로우만 보여준다.

### 2. 질문과 기획 캔버스가 첫 진입점이다

- 각 페이지에서 사용자가 가장 먼저 보는 것은 시스템 옵션이 아니라 질문 입력이다.
- 자주 쓰는 질문 패턴은 템플릿 칩으로 제공해 진입 부담을 줄인다.
- 프로젝트 페이지는 질문이 없어도 아이디어 스튜디오 브리프를 채우면 자동으로 토론 질문을 구성한다.
- 라운드 수, timeout, judge, 실행 디렉터리 같은 파워유저 옵션은 `고급 설정` 안으로 이동한다.

### 3. 역할 템플릿은 YAML로 관리한다

- 참가자는 더 이상 단순 `provider A / provider B`가 아니다.
- 각 워크플로우는 **2~3인 역할 템플릿**을 읽어 역할별 슬롯을 렌더링한다.
- 템플릿은 YAML 파일에서 로드하고, 설정 페이지에서 직접 편집할 수 있다.

현재 규칙:

- 역할 수는 템플릿당 2개 또는 3개만 허용
- 뉴스 템플릿과 프로젝트·기획 템플릿을 분리
- 역할 정의는 `roleId`, `label`, `focus`, `instructions`, `requiredQuestions`, `defaultProvider`를 포함
- 같은 모델을 여러 역할에 반복 배치 가능

설정 파일 우선순위:

1. `FFM_ROLE_CONFIG`
2. `./debate-roles.yaml`
3. `~/.debate-arena/debate-roles.yaml`

### 4. News 흐름은 Evidence Builder를 중심으로 유지한다

- 뉴스 수집은 토론 전 단계의 근거 준비 단계로 배치했다.
- 선택된 스냅샷은 즉시 "근거 팩" 카드로 요약된다.
- 근거 팩은 최소한 다음 정보를 보여준다.
  - snapshot id
  - query
  - article count
  - sources
  - excluded count
- 근거 팩을 해제하는 액션도 같은 카드 안에 둔다.

추가 제약:

- 프로젝트·기획 페이지는 기본적으로 `codex / claude / gemini`를 사용하고, 자동 컨텍스트를 끈 기획 세션에서는 `ollama`도 허용
- 뉴스 페이지는 `ollama`를 포함한 전체 provider 허용
- 뉴스 페이지에서 `ollama`가 선택되면 모델 드롭다운을 함께 노출

### 5. 토론 관찰은 채팅 로그보다 의사결정 보드를 우선한다

- 실시간 스트림은 그대로 유지하되, 최신 라운드의 `summary / key issues / agreements / next focus`를 별도 보드에 보여준다.
- 사용자는 긴 텍스트를 모두 다시 읽지 않아도 현재 토론의 핵심이 무엇인지 바로 파악할 수 있다.
- 타임라인은 보조 레이어로 남겨 상태 변화를 빠르게 확인하게 한다.
- 프로젝트·기획 페이지와 뉴스 페이지 모두 라운드 탭을 누적해서 보여주며, 이전 라운드 보드를 다시 열 수 있다.

### 6. 세션은 컨텍스트 단위로 보인다

- 세션 카드와 상단 컨텍스트 패널에 다음 정보를 함께 노출한다.
  - participants
  - judge
  - execution cwd
  - 연결된 evidence pack
- 선택된 역할 라벨과 provider 조합도 함께 보인다.
- 이 변경으로 "어떤 질문이 어떤 작업공간과 어떤 근거 팩에 묶여 실행되었는가"를 대시보드에서 바로 확인할 수 있다.

### 7. 결론은 근거 팩과 함께 보인다

- synthesis 영역 옆에 연결된 evidence pack을 함께 배치했다.
- 기사별로 최소한 다음 정보를 노출한다.
  - source
  - domain
  - published date
  - summary
- 이 구성은 "결론은 나왔지만 근거가 무엇인지 보이지 않는" 상태를 줄이기 위한 MVP다.

## 구현 원칙

1. 브라우저는 로컬 AI CLI를 직접 실행하지 않는다.
2. 대시보드는 `src/core/*` 엔진의 소비자이며, 별도 실행 로직을 복제하지 않는다.
3. 세션 상태와 이벤트는 서버가 소유하고 대시보드는 이를 구독한다.
4. 근거 정보는 토론 전 단계와 결론 단계 양쪽에서 재사용 가능해야 한다.
5. 역할 템플릿 편집은 서버가 YAML 유효성 검사를 통과한 경우에만 저장된다.
6. 참가자 수는 UI와 서버 모두에서 2~3명으로 제한한다.

## 이번 변경에서 의도적으로 미룬 것

### Plan mode 전면 노출

현재 대시보드는 `run_debate` 계약만 안정적으로 다룬다. 따라서 `plan` 모드는 아직 메인 CTA로 올리지 않았다.

이유는 다음과 같다.

- pre-approval diff preview 이벤트가 없다
- `apply.confirm` / `apply.execute` 분리 계약이 없다
- session-bound cwd 실행 계약이 없다

즉, 지금 단계에서 필요한 것은 "Plan mode 버튼 추가"가 아니라 **preview와 승인 절차를 이벤트 계약으로 만드는 1.5단계 작업**이다.

## 다음 단계

### Phase 1.1

- 근거 팩 카드에 `topDomains`, 최신 기사 날짜를 더 명확히 노출
- source 신뢰도 시그널 추가
- evidence pack 정렬 기준을 UI에서 보여주기
- 설정 페이지에 YAML diff 또는 dry-run preview 추가

### Phase 1.5

- `apply.preview`
- `apply.confirm`
- `apply.execute`
- sessionId + cwd 바인딩

### Phase 2

- claim-level trace
- audit trail
- rollback 전략

## 관련 파일

- `dashboard/index.html`
- `dashboard/project.html`
- `dashboard/news.html`
- `dashboard/settings.html`
- `dashboard/app.js`
- `dashboard/styles.css`
- `src/roles/config.ts`
- `src/core/participants.ts`
- `src/core/session-store.ts`
- `src/core/orchestrator.ts`

## 요약

이번 대시보드 개편은 "화면 예쁘게 바꾸기"가 아니라, 제품의 중심을 **실시간 관전 UI**에서 **근거 기반 의사결정 워크벤치**로 옮기는 작업이다. 지금 단계의 핵심은 워크플로우를 페이지 단위로 분리하고, 2~3인 역할 템플릿을 YAML로 관리하며, 세션 컨텍스트와 근거 연결을 각 워크플로우에 맞게 닫는 데 있다.
