# fight-for-me

[English](./README.md)

AI 토론 CLI - Codex와 Claude가 로컬 CLI를 통해 다중 라운드 토론을 벌입니다.

두 AI 에이전트가 당신의 질문에 대해 논쟁한 뒤, 합의를 도출합니다.
인터랙티브 모드로 직접 토론에 참여하여 3자 토론을 진행할 수도 있습니다.
선택적으로 결론을 코드베이스에 직접 적용할 수 있습니다.

## 필수 조건

- [Node.js](https://nodejs.org/) >= 18
- [Codex CLI](https://github.com/openai/codex) 설치 및 설정 완료
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-cli) 설치 및 설정 완료

## 설치

```bash
npm install -g fight-for-me
```

## 사용법

```bash
# 질문하기 (생략하면 대화형 프롬프트로 입력)
ffm "새 API에 REST와 GraphQL 중 무엇을 써야 할까?"

# 토론 라운드 수 지정
ffm "React에 가장 좋은 상태 관리는?" -r 5

# 구현 계획 모드 사용
ffm "인증 모듈을 어떻게 리팩토링해야 할까?" --plan

# 토론 결론을 코드베이스에 적용
ffm "사용자 폼에 입력 검증 추가" --apply

# 특정 에이전트로 적용
ffm "API 호출에 에러 핸들링 추가" --apply claude

# 양쪽 에이전트로 적용 (Codex가 구현, Claude가 검증)
ffm "캐싱 레이어 구현" --plan --apply both

# 제3의 참가자로 토론에 참여
ffm "React에 가장 좋은 상태 관리는?" -i

# 스트리밍 출력 비활성화
ffm "Node.js ORM 비교" --no-stream

# JSON 또는 Markdown으로 출력
ffm "최적의 테스트 전략은?" -f json
ffm "최적의 테스트 전략은?" -f markdown

# 특정 파일을 컨텍스트로 포함
ffm "이 코드를 어떻게 개선할까?" --files src/index.ts src/utils.ts

# 프로젝트 컨텍스트 수집 건너뛰기
ffm "일반적인 JS 질문" --no-context
```

## 명령어

| 명령어 | 설명 |
|--------|------|
| `ffm [question]` | 토론 시작 (기본 명령어) |
| `ffm config` | 설정 확인 또는 변경 |
| `ffm status` | 현재 상태 및 설정 표시 |
| `ffm stop` | 실행 중인 에이전트 프로세스 중지 |
| `ffm model` | AI 모델 설정 |

## 옵션

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `-r, --rounds <n>` | 토론 라운드 수 | `3` |
| `-j, --judge <provider>` | 합의 도출 심판: `codex`, `claude`, `both` | `claude` |
| `-f, --format <format>` | 출력 형식: `pretty`, `json`, `markdown` | `pretty` |
| `-a, --apply [provider]` | 결론 적용: `codex`, `claude`, `both` | - |
| `--plan` | 구현 계획 모드 사용 | `false` |
| `-i, --interactive` | 제3의 참가자로 토론 참여 | `false` |
| `--no-stream` | 스트리밍 출력 비활성화 | - |
| `--no-synthesis` | 최종 합의 도출 건너뛰기 | - |
| `--no-context` | 프로젝트 컨텍스트 수집 비활성화 | - |
| `--files <paths...>` | 컨텍스트에 특정 파일 포함 | - |

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
| `applyTimeoutMs` | 적용 명령어 타임아웃 (ms) | `300000` |

## 작동 방식

1. 질문이 Codex와 Claude 양쪽에 전달됩니다
2. 각 에이전트가 자신의 관점으로 응답합니다
3. 지정된 라운드 수만큼 토론을 주고받습니다
4. 심판(기본: Claude)이 토론을 종합하여 최종 합의를 도출합니다
5. 선택적으로, 결론을 지정된 에이전트가 코드베이스에 적용합니다

**인터랙티브 모드**(`-i`)에서는 제3의 참가자로 토론에 참여합니다 — 각 라운드가 끝난 후 직접 의견을 추가하거나, 토론 방향을 조정하거나, 다음 라운드 전에 에이전트에게 반론을 제기할 수 있습니다.

## 라이선스

MIT
