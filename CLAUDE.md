# Claude Code Power Pack 설정

Boris Cherny(Claude Code 창시자) 팁 + skills.sh 해커톤 우승작 기반 올인원 플러그인

## 핵심 마인드셋
**Claude Code는 시니어가 아니라 똑똑한 주니어 개발자다.**
- 작업을 작게 쪼갤수록 결과물이 좋아진다
- "인증 기능 만들어줘" ❌
- "로그인 폼 만들고, JWT 생성하고, 리프레시 토큰 구현해줘" ✅

## 프롬프팅 베스트 프랙티스

### 1. Plan 모드 먼저 (가장 중요!)
```
Shift+Tab → Plan 모드 토글
복잡한 작업은 Plan 모드에서 계획 → 확정 후 구현
```

### 2. 구체적인 프롬프트
```
❌ "버튼 만들어줘"
✅ "파란색 배경에 흰 글씨, 호버하면 진한 파란색,
    클릭하면 /auth/login API 호출하는 버튼 만들어줘."
```

### 3. 에이전트 체이닝
```
복잡한 작업 → /plan → 구현 → /review → /verify
```

## 컨텍스트 관리 (핵심!)

**컨텍스트는 신선한 우유. 시간이 지나면 상한다.**

### 규칙
- 토큰 80-100k 넘기 전에 리셋 (200k 가능하지만 품질 저하)
- 3-5개 작업마다 컨텍스트 정리
- /compact 3번 후 /clear

### 컨텍스트 관리 패턴
```
작업 → /compact → 작업 → /compact → 작업 → /compact
→ /handoff (HANDOFF.md 생성) → /clear → 새 세션
```

## 워크플로우 스킬 (15개)
| 스킬 | 용도 |
|------|------|
| `/plan` | 작업 계획 수립 |
| `/spec` | SPEC 기반 개발 - 심층 인터뷰 |
| `/spec-verify` | 명세서 기반 구현 검증 |
| `/frontend` | 빅테크 스타일 UI 개발 |
| `/commit-push-pr` | 커밋→푸시→PR |
| `/verify` | 테스트, 린트, 빌드 검증 |
| `/review` | 코드 리뷰 |
| `/simplify` | 코드 단순화 |
| `/tdd` | 테스트 주도 개발 |
| `/build-fix` | 빌드 에러 수정 |
| `/handoff` | HANDOFF.md 생성 |
| `/compact-guide` | 컨텍스트 관리 가이드 |
| `/techdebt` | 기술 부채 정리 |
| `/analyze-parallel` | 병렬 에이전트 코드 분석 |
| `/worktree` | git worktree 병렬 작업 설정 |

## 에이전트 (9개)
| 에이전트 | 용도 |
|----------|------|
| `planner` | 복잡한 기능 계획 |
| `frontend-developer` | 빅테크 스타일 UI 구현 |
| `code-reviewer` | 코드 품질/보안 리뷰 |
| `architect` | 아키텍처 설계 |
| `security-reviewer` | 보안 취약점 분석 |
| `tdd-guide` | TDD 방식 안내 |
| `junior-mentor` | 주니어 학습 멘토 |
| `stitch-developer` | Stitch UI 전문가 |
| `parallel-analyzer` | 병렬 코드 분석 오케스트레이터 |

## 기술 스킬 (10개)

### Frontend
| 스킬 | 용도 |
|------|------|
| `react-patterns` | React 19 전체 패턴 |
| `vercel-react-best-practices` | React/Next.js 성능 최적화 |
| `typescript-advanced-types` | 고급 타입 시스템 |
| `shadcn-ui` | shadcn/ui 컴포넌트 |
| `tailwind-design-system` | Tailwind CSS 디자인 시스템 |
| `ui-ux-pro-max` | UI/UX 종합 가이드 |

### Backend
| 스킬 | 용도 |
|------|------|
| `fastapi-templates` | FastAPI 템플릿 |
| `api-design-principles` | REST/GraphQL API 설계 |
| `async-python-patterns` | Python 비동기 패턴 |
| `python-testing-patterns` | pytest 테스트 패턴 |

## 에이전트 팀 (Agent Teams) - 실험적 기능

**Opus 4.6과 함께 도입된 멀티 에이전트 협업 시스템**

리드 에이전트가 여러 팀원(teammate)을 스폰하여 병렬로 작업하고, 서로 직접 메시지를 주고받으며 자율적으로 조율하는 구조.

### 활성화 방법
`settings.json`에 추가:
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

### 서브에이전트 vs 에이전트 팀
| | 서브에이전트 | 에이전트 팀 |
|---|---|---|
| **통신** | 메인 에이전트에만 결과 반환 | 팀원끼리 직접 메시지 교환 |
| **조율** | 메인 에이전트가 관리 | 공유 작업 목록으로 자율 조율 |
| **적합한 작업** | 결과만 중요한 포커스 작업 | 토론/협업이 필요한 복잡 작업 |
| **토큰 비용** | 낮음 | 높음 (각 팀원이 별도 인스턴스) |

### 팀 구조
| 요소 | 역할 |
|------|------|
| **Team Lead** | 팀 생성, 작업 배정, 결과 종합 |
| **Teammates** | 독립 Claude 인스턴스로 할당 업무 수행 |
| **Task List** | 공유 작업 목록 (의존성 추적) |
| **Mailbox** | 에이전트 간 직접 메시징 |

### 디스플레이 모드
```json
// settings.json
{
  "teammateMode": "in-process"  // 또는 "tmux"
}
```
- **in-process**: 메인 터미널에서 모든 팀원 관리 (기본값)
- **tmux/iTerm2**: 각 팀원이 별도 패널에 표시

### 키보드 단축키
| 키 | 동작 |
|----|------|
| `Shift+Up/Down` | 팀원 선택/메시지 전송 |
| `Enter` | 팀원 세션 보기 |
| `Escape` | 중단 |
| `Ctrl+T` | 작업 목록 토글 |
| `Shift+Tab` | delegate 모드 (리더 조정 전용) |
| `Ctrl+B` | 현재 작업 백그라운드로 전환 |

### 사용 패턴

**멀티 관점 설계:**
```
CLI 도구를 설계하는 에이전트 팀을 만들어줘:
- UX 담당 팀원
- 기술 아키텍처 담당 팀원
- 비판적 관점 (devil's advocate) 팀원
```

**병렬 코드 리뷰:**
```
PR #142를 리뷰하는 에이전트 팀을 만들어줘:
- 보안 관점 리뷰어
- 성능 영향 리뷰어
- 테스트 커버리지 리뷰어
```

**경쟁 가설 디버깅:**
```
앱 연결 끊김 버그를 조사하는 5명 팀원을 스폰해줘.
서로 가설을 반박하면서 토론하도록 해줘.
```

**교차 계층 구현:**
```
에이전트 팀으로 병렬 구현해줘:
- 프론트엔드 담당
- 백엔드 API 담당
- 테스트 작성 담당
```

### 주의사항
- **파일 충돌 방지**: 각 팀원이 서로 다른 파일을 담당하도록 분리
- **작업 크기**: 팀원당 5-6개 작업이 최적
- **순차 작업에는 부적합**: 병렬 가능한 독립 업무에만 사용
- **세션 재개 불가**: in-process 팀원은 `/resume`으로 복원 안 됨
- **팀 중첩 불가**: 팀원이 자체 팀을 만들 수 없음
- **정리**: 항상 리드에게 `Clean up the team` 요청

### 에이전트 팀 vs 기존 병렬 방식 선택 가이드
```
단순 병렬 분석 → 서브에이전트 (use subagents)
독립 브랜치 작업 → git worktree
토론/협업 필요 → 에이전트 팀
코드 리뷰 병렬화 → 에이전트 팀
가설 검증 디버깅 → 에이전트 팀
```

## 고급 활용법

### 병렬 작업 (git worktree)

**스킬 사용:**
```
/worktree create feat-login         # feature/feat-login worktree 생성
/worktree create fix-bug hotfix     # hotfix/fix-bug worktree 생성
/worktree cleanup                   # 정리
```

**수동 설정:**
```bash
git worktree add ../project-feat -b feature/login
git worktree add ../project-fix -b fix/bug
# 각 터미널에서 claude 실행
```

**병렬 작업 패턴:**
- Feature + Hotfix 동시 진행
- 여러 Feature 동시 개발
- PR 리뷰 + 개발 동시 진행

### 병렬 에이전트 코드 분석

**방법 1: 서브에이전트 (결과만 필요할 때)**
```
"use subagents를 사용해서 이 코드베이스를 병렬로 분석해줘:
- architect: 전체 아키텍처 분석
- security-reviewer: 보안 취약점 검사
- code-reviewer: 코드 품질 리뷰"
```

**방법 2: 에이전트 팀 (토론/교차 검증이 필요할 때)**
```
"에이전트 팀을 만들어서 코드베이스를 분석해줘:
- 아키텍트: 전체 구조 분석
- 보안 리뷰어: 취약점 검사
- 코드 리뷰어: 품질 리뷰
서로 발견한 내용을 공유하고 검증하도록 해줘"
```

**구역별 병렬 분석 (대규모 프로젝트):**
```
"use subagents를 사용해서 병렬로 분석해줘:
- 에이전트 1: src/api/ 폴더 분석
- 에이전트 2: src/components/ 폴더 분석
- 에이전트 3: src/utils/ 폴더 분석"
```

**또는 스킬 사용:**
```
/analyze-parallel
```

### 검토 강화 프롬프트
- "이 변경사항을 엄격히 검토해줘"
- "이게 작동한다는 걸 증명해봐"
- "우아한 솔루션으로 다시 구현해"

## 코딩 스타일
- 코드는 간결하고 읽기 쉽게
- 불변성 패턴 사용 (뮤테이션 금지)
- 함수 50줄 이하, 파일 800줄 이하

## 금지 사항
- main/master 브랜치에 직접 push 금지
- .env 파일이나 민감한 정보 커밋 금지
- 하드코딩된 API 키/시크릿 금지
- console.log 커밋 금지

## 커밋 메시지 형식
```
[타입] 제목

본문 (선택)

Co-Authored-By: Claude <noreply@anthropic.com>
```
타입: feat, fix, docs, style, refactor, test, chore

## SPEC 기반 개발 (Thariq 워크플로우)

**대규모 기능 개발 시 권장** - Anthropic 엔지니어 Thariq의 방식

### 핵심 원칙
- **컨텍스트 분리**: 인터뷰 세션 != 구현 세션
- **사용자 컨트롤**: 40개+ 질문으로 방향 직접 결정
- **상세 문서화**: 다음 세션에서 바로 실행 가능

### 워크플로우
```
세션 1: 인터뷰
/spec -> AskUserQuestion으로 심층 인터뷰 -> SPEC.md 생성

세션 2: 구현 (새 세션)
"SPEC.md 읽고 구현해줘"

세션 3: 검증
/spec-verify -> 서브에이전트가 명세서 대비 검증 -> 피드백 반영
```
