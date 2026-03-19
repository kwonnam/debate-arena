import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';
import type {
  DebateParticipantRole,
  DebateRoleConfig,
  DebateRoleTemplate,
  DebateRoleTemplateCollection,
  DebateRoleTemplateParticipantTemplate,
  RoleWorkflowKind,
} from '../types/roles.js';

const CONFIG_DIR = join(homedir(), '.debate-arena');
const HOME_ROLE_CONFIG_FILE = join(CONFIG_DIR, 'debate-roles.yaml');
const LOCAL_ROLE_CONFIG_FILE = join(process.cwd(), 'debate-roles.yaml');

export interface LoadedRoleConfig {
  path: string;
  raw: string;
  config: DebateRoleConfig;
}

const DEFAULT_ROLE_CONFIG_YAML = `version: 1
defaults:
  newsTemplateId: news-market-policy-legal
  projectTemplateId: project-ux-backend-qa
workflows:
  news:
    templates:
      - id: news-market-policy-legal
        label: 시장 · 정책 · 법률
        description: 시장 반응과 집행 가능성, 법적 제약을 함께 보는 3자 토론 템플릿입니다.
        recommendedJudge: claude
        participants:
          - roleId: market-analyst
            label: 주식 분석가
            focus: 상장사 영향, 밸류에이션, 단기/중기 투자 신호를 해석합니다.
            defaultProvider: codex
            instructions:
              - 단기와 중기 영향을 구분한다.
              - 수혜/피해 기업과 이유를 명확히 말한다.
            requiredQuestions:
              - 수혜/피해 업종은 어디인가?
              - 시장이 가장 빠르게 반응할 지표는 무엇인가?
          - roleId: policy-operator
            label: 정책·행정 관점
            focus: 실제 집행 가능성과 제도 설계, 현장 운영 리스크를 검토합니다.
            defaultProvider: claude
            instructions:
              - 발표와 실제 시행 사이의 간극을 지적한다.
              - 이해관계자와 집행 병목을 함께 본다.
          - roleId: legal-counsel
            label: 법률 관점
            focus: 규제 해석, 법적 제약, 분쟁 가능성을 짚습니다.
            defaultProvider: gemini
            instructions:
              - 법적 근거가 약한 추정은 구분해서 말한다.
              - 소송, 제재, 규정 충돌 가능성을 분리한다.
      - id: news-economy-politics
        label: 경제 · 정치 전략
        description: 거시경제와 정치적 지속 가능성을 중심으로 보는 2자 토론 템플릿입니다.
        recommendedJudge: claude
        participants:
          - roleId: macro-economist
            label: 경제 전문가
            focus: 금리, 경기, 산업 파급과 같은 거시 흐름을 해석합니다.
            defaultProvider: codex
            instructions:
              - 3개월, 1년, 3년 이상 구간을 나눠 설명한다.
          - roleId: political-strategist
            label: 정치 전략 관점
            focus: 여론, 이해관계자, 정책 지속 가능성을 검토합니다.
            defaultProvider: claude
            instructions:
              - 누가 이익을 얻고 누가 저항할지 설명한다.
      - id: news-stock-thesis-board
        label: 주가 전망 · 밸류에이션 · 기술적 흐름 · 뉴스 심리 · 리스크
        description: 개별 종목의 주가를 가치평가, 펀더멘털, 차트, 뉴스 심리, 리스크 관리 관점에서 함께 토의하는 5자 템플릿입니다.
        recommendedJudge: claude
        participants:
          - roleId: valuation-analyst
            label: 가치평가 애널리스트
            focus: 현재 가격이 반영한 기대와 적정 가치 범위를 추정합니다.
            defaultProvider: codex
            instructions:
              - bull, base, bear 시나리오별 적정 가치 범위를 제시한다.
              - 현재 가격이 어떤 성장률과 마진 가정을 선반영하는지 설명한다.
            requiredQuestions:
              - 현재 가격은 어떤 기대를 이미 반영하고 있는가?
              - 6개월, 12개월 기준 적정 가치 범위는 어디인가?
          - roleId: fundamentals-analyst
            label: 펀더멘털 애널리스트
            focus: 실적, 현금흐름, 가이던스, 경쟁 우위의 지속 가능성을 검토합니다.
            defaultProvider: claude
            instructions:
              - 매출 성장, 이익률, 현금흐름을 분리해서 해석한다.
              - 실적 개선이 일회성인지 구조적인지 구분한다.
            requiredQuestions:
              - 가장 중요한 펀더멘털 변수는 무엇인가?
              - 최근 실적과 가이던스는 추세를 강화하는가?
          - roleId: technical-analyst
            label: 기술적 흐름 애널리스트
            focus: 추세, 거래량, 지지·저항, 포지셔닝 신호를 해석합니다.
            defaultProvider: gemini
            instructions:
              - 추세와 이벤트성 급등락을 구분한다.
              - 지지선, 저항선, 거래량 변화를 함께 본다.
            requiredQuestions:
              - 지금 차트가 추세 지속인지 과열인지 무엇을 시사하는가?
              - 단기 트레이더가 주시할 가격대는 어디인가?
          - roleId: news-sentiment-analyst
            label: 뉴스 심리 애널리스트
            focus: 뉴스 흐름, 투자심리, 서사 변화가 가격에 주는 압력을 읽습니다.
            defaultProvider: codex
            instructions:
              - 호재/악재 기사 수보다 서사의 방향성과 강도를 본다.
              - 같은 뉴스라도 주가에 반영됐는지 여부를 구분한다.
            requiredQuestions:
              - 시장 서사는 어떤 방향으로 기울어 있는가?
              - 아직 과소반영된 촉매나 과대반응 구간이 있는가?
          - roleId: risk-manager
            label: 리스크 매니저
            focus: 하방 리스크, 무효화 조건, 포지션 관리와 관찰 지표를 정리합니다.
            defaultProvider: claude
            instructions:
              - 상승 논리보다 먼저 무효화 조건을 명확히 적는다.
              - 확인해야 할 지표와 손절/재평가 기준을 함께 제시한다.
            requiredQuestions:
              - 이 시나리오를 깨는 핵심 리스크는 무엇인가?
              - 앞으로 추적할 이벤트와 경고 신호는 무엇인가?
      - id: news-stock-bull-bear-risk
        label: 주가 전망 · Bull / Bear / Risk
        description: 강세론, 약세론, 리스크 관리 관점을 정면으로 붙여 예측을 압축하는 3자 템플릿입니다.
        recommendedJudge: claude
        participants:
          - roleId: bull-thesis
            label: Bull Thesis
            focus: 시장이 과소평가한 상방 논리와 재평가 촉매를 주장합니다.
            defaultProvider: codex
            instructions:
              - 상승 논리를 숫자와 촉매로 연결한다.
              - 언제까지 어떤 경로로 재평가될지 말한다.
            requiredQuestions:
              - 시장이 과소평가한 상방 요인은 무엇인가?
              - 어떤 촉매가 재평가를 만드는가?
          - roleId: bear-thesis
            label: Bear Thesis
            focus: 기대 과열, 밸류에이션 부담, 구조적 리스크를 중심으로 반론을 제기합니다.
            defaultProvider: gemini
            instructions:
              - 현재 기대와 밸류에이션이 왜 과도한지 설명한다.
              - 반례와 실패 사례를 먼저 든다.
            requiredQuestions:
              - 하방이 열리는 핵심 가정 붕괴는 무엇인가?
              - 시장이 과도하게 낙관하는 지점은 어디인가?
          - roleId: risk-manager
            label: 리스크 매니저
            focus: 양측 시나리오의 승부처, 확률, 추적 지표와 포지션 리스크를 정리합니다.
            defaultProvider: claude
            instructions:
              - bull/base/bear 가능성과 추적 지표를 함께 정리한다.
              - 확신보다 포지션 리스크와 무효화 조건을 우선시한다.
            requiredQuestions:
              - 지금 가장 합리적인 대응은 공격, 관망, 회피 중 무엇인가?
              - 어떤 가격·실적·뉴스 변화가 판단을 뒤집는가?
      - id: news-stock-event-reaction
        label: 실적·이벤트 반응 · Earnings / Industry / Flow / Portfolio
        description: 실적 발표, 제품 공개, 규제 뉴스 같은 개별 이벤트가 종목과 섹터에 미칠 영향을 토의하는 4자 템플릿입니다.
        recommendedJudge: claude
        participants:
          - roleId: earnings-analyst
            label: 실적 이벤트 애널리스트
            focus: 실적, 가이던스, 컨퍼런스콜 포인트가 기대 대비 어떤 차이를 만드는지 해석합니다.
            defaultProvider: codex
            instructions:
              - 컨센서스 대비 서프라이즈의 방향과 크기를 구분한다.
              - 숫자보다 더 중요한 코멘트 변화를 짚는다.
            requiredQuestions:
              - 이번 이벤트의 핵심 surprise는 무엇인가?
              - 다음 분기 기대가 상향 또는 하향될 가능성은?
          - roleId: industry-competition
            label: 업계·경쟁 구도 관점
            focus: 경쟁사, 공급망, 업계 구조 변화가 이벤트 해석을 어떻게 바꾸는지 봅니다.
            defaultProvider: claude
            instructions:
              - 단일 기업 뉴스라도 업계 전체 맥락으로 다시 해석한다.
              - 경쟁 우위가 강화되는지 약화되는지 구분한다.
            requiredQuestions:
              - 경쟁사 대비 해석 포인트는 무엇인가?
              - 업계 전체에 파급되는 2차 효과가 있는가?
          - roleId: flow-sentiment
            label: 수급·심리 관점
            focus: 수급, 포지셔닝, 투자심리 변화가 단기 주가 반응을 어떻게 증폭하는지 분석합니다.
            defaultProvider: gemini
            instructions:
              - 이벤트의 질과 시장 포지셔닝을 함께 본다.
              - 단기 과열과 중기 추세 전환을 구분한다.
            requiredQuestions:
              - 이번 뉴스가 단기 수급에 주는 압력은 어느 방향인가?
              - 이미 반영된 기대와 새롭게 생긴 기대를 어떻게 구분할 것인가?
          - roleId: portfolio-manager
            label: 포트폴리오 매니저
            focus: 위 논의를 종합해 지금 취할 행동과 관찰 지표를 결정합니다.
            defaultProvider: codex
            instructions:
              - buy/sell/hold보다 왜 지금 그 행동이 합리적인지 설명한다.
              - 관찰 지표와 재평가 시점을 반드시 적는다.
            requiredQuestions:
              - 지금 가장 합리적인 의사결정은 무엇인가?
              - 다음 체크포인트 전까지 반드시 봐야 할 지표는 무엇인가?
  project:
    templates:
      - id: project-ux-backend-qa
        label: UX · 디자이너 · 백엔드 · QA
        description: 사용자 흐름, 화면 구조, 구현 복잡도, 회귀 위험을 함께 검토하는 4자 토론 템플릿입니다.
        recommendedJudge: claude
        participants:
          - roleId: ux
            label: UX 전문가
            focus: 사용자 여정, 정보 구조, 인지 부하를 기준으로 개선안을 제시합니다.
            defaultProvider: codex
            instructions:
              - 사용자 과업 흐름이 어디서 끊기는지 먼저 설명한다.
              - 화면 추가보다 구조 단순화를 우선 검토한다.
            requiredQuestions:
              - 사용자가 가장 먼저 막히는 지점은 어디인가?
              - 정보 구조를 어떻게 다시 묶어야 하는가?
          - roleId: designer
            label: 프로덕트 디자이너
            focus: 화면 구조, 인터랙션, 시각적 계층, 상태 피드백을 기준으로 개선안을 설계합니다.
            defaultProvider: gemini
            instructions:
              - 사용자 과업을 실제 화면 변화와 컴포넌트 구조로 번역한다.
              - 빈 상태, 오류 상태, 전환 피드백까지 함께 본다.
            requiredQuestions:
              - 핵심 화면에서 무엇을 덜어내고 무엇을 강조해야 하는가?
              - 상태 변화와 피드백은 사용자에게 어떻게 보여야 하는가?
          - roleId: backend
            label: 백엔드 개발자
            focus: API, 상태 흐름, 운영 복잡도와 구현 비용을 검토합니다.
            defaultProvider: claude
            instructions:
              - 실제 구현 난이도와 운영 비용을 분리해서 말한다.
              - 추상적 제안보다 구체적인 변경 포인트를 제시한다.
          - roleId: qa
            label: QA
            focus: 회귀 위험, 검증 범위, 운영 관측성을 기준으로 판단합니다.
            defaultProvider: codex
            instructions:
              - 실패 시나리오와 필요한 테스트를 함께 제안한다.
      - id: project-ux-architecture
        label: UX · 디자이너 · 아키텍트
        description: 사용자 경험, 화면 구조, 시스템 경계를 함께 점검하는 3자 토론 템플릿입니다.
        recommendedJudge: claude
        participants:
          - roleId: ux
            label: UX 전문가
            focus: 사용자가 이해하기 쉬운 흐름과 우선순위를 설계합니다.
            defaultProvider: codex
            instructions:
              - 정보 구조와 용어 체계를 정리한다.
          - roleId: designer
            label: 프로덕트 디자이너
            focus: 화면 레이아웃, 인터랙션 흐름, 컴포넌트 책임을 정리합니다.
            defaultProvider: gemini
            instructions:
              - 정보 구조를 실제 화면 배치와 인터랙션으로 연결한다.
              - 시각적 우선순위와 컴포넌트 재사용 기준을 함께 정리한다.
          - roleId: architect
            label: 아키텍트
            focus: 경계 분리, 확장성, 코드 구조의 일관성을 검토합니다.
            defaultProvider: claude
            instructions:
              - 파일 경계와 책임 분리를 기준으로 판단한다.
      - id: project-product-discovery
        label: 제품 전략 · 사용자 문제 · MVP
        description: 새로운 기획을 발상하거나 다듬을 때 문제 정의, 가치 제안, 초기 실행 범위를 함께 검토하는 3자 토론 템플릿입니다.
        recommendedJudge: claude
        participants:
          - roleId: product-strategist
            label: 제품 전략가
            focus: 어떤 문제를 어떤 사용자에게 어떤 가치로 풀지 선명하게 정의합니다.
            defaultProvider: codex
            instructions:
              - 아이디어보다 사용자 문제와 차별점을 먼저 정리한다.
              - 버려야 할 범위와 집중할 핵심을 분리한다.
            requiredQuestions:
              - 이 아이디어가 해결하는 가장 중요한 문제는 무엇인가?
              - 지금 만들지 않아도 되는 기능은 무엇인가?
          - roleId: user-researcher
            label: 사용자 리서처
            focus: 대상 사용자, 사용 맥락, 초기 반응을 검증할 질문을 설계합니다.
            defaultProvider: claude
            instructions:
              - 사용자 세그먼트와 행동 변화를 구체적으로 묘사한다.
              - 가설과 확인해야 할 질문을 나눠 제시한다.
          - roleId: mvp-designer
            label: MVP 설계자
            focus: 가장 작은 출시 범위, 검증 실험, 구현 우선순위를 정리합니다.
            defaultProvider: gemini
            instructions:
              - 첫 릴리스와 이후 확장을 분리한다.
              - 빠르게 검증할 실험과 성공 기준을 함께 제안한다.
`;

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function resolveRoleConfigPath(): string {
  const override = process.env.DEBATE_ARENA_ROLE_CONFIG?.trim() || process.env.FFM_ROLE_CONFIG?.trim();
  if (override) {
    return override.startsWith('/') ? override : join(process.cwd(), override);
  }

  if (existsSync(LOCAL_ROLE_CONFIG_FILE)) {
    return LOCAL_ROLE_CONFIG_FILE;
  }

  return HOME_ROLE_CONFIG_FILE;
}

function readRoleConfigRaw(path: string): string {
  if (!existsSync(path)) {
    return DEFAULT_ROLE_CONFIG_YAML;
  }

  return readFileSync(path, 'utf-8');
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeRole(entry: unknown, templateId: string, index: number): DebateRoleTemplateParticipantTemplate {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`템플릿 ${templateId}의 role ${index + 1} 형식이 잘못되었습니다.`);
  }

  const role = entry as Record<string, unknown>;
  const id = asString(role.roleId) || asString(role.id);
  const label = asString(role.label);
  const focus = asString(role.focus);
  const defaultProvider = asString(role.defaultProvider) || asString(role.provider) || undefined;
  const instructions = Array.isArray(role.instructions)
    ? role.instructions.map(asString).filter(Boolean)
    : [];
  const requiredQuestions = Array.isArray(role.requiredQuestions)
    ? role.requiredQuestions.map(asString).filter(Boolean)
    : Array.isArray(role.required_questions)
      ? role.required_questions.map(asString).filter(Boolean)
      : [];

  if (!id || !label || !focus) {
    throw new Error(`템플릿 ${templateId}의 role ${index + 1}는 id, label, focus가 필요합니다.`);
  }

  return {
    roleId: id,
    label,
    focus,
    instructions,
    requiredQuestions,
    defaultProvider,
  };
}

function normalizeTemplate(entry: unknown, workflow: RoleWorkflowKind, index: number): DebateRoleTemplate {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`${workflow} 템플릿 ${index + 1} 형식이 잘못되었습니다.`);
  }

  const template = entry as Record<string, unknown>;
  const id = asString(template.id);
  const label = asString(template.label);
  const description = asString(template.description);
  const recommendedJudge = asString(template.recommendedJudge) || undefined;
  const rawRoles = Array.isArray(template.participants)
    ? template.participants
    : Array.isArray(template.roles)
      ? template.roles
      : [];
  const roles = rawRoles.map((role, roleIndex) => normalizeRole(role, id || `${workflow}-${index + 1}`, roleIndex));

  if (!id || !label || !description) {
    throw new Error(`${workflow} 템플릿 ${index + 1}는 id, label, description이 필요합니다.`);
  }
  if (roles.length < 2 || roles.length > 6) {
    throw new Error(`템플릿 ${id}는 역할이 2개 이상 6개 이하여야 합니다.`);
  }

  const uniqueRoleIds = new Set(roles.map((role) => role.roleId));
  if (uniqueRoleIds.size !== roles.length) {
    throw new Error(`템플릿 ${id}의 role id가 중복되었습니다.`);
  }

  return {
    id,
    label,
    description,
    recommendedJudge: recommendedJudge || undefined,
    participants: roles,
  };
}

function normalizeCollection(value: unknown, workflow: RoleWorkflowKind): DebateRoleTemplateCollection {
  const rawTemplates = value && typeof value === 'object' && Array.isArray((value as { templates?: unknown[] }).templates)
    ? (value as { templates: unknown[] }).templates
    : [];

  const templates = rawTemplates.map((template, index) => normalizeTemplate(template, workflow, index));
  if (templates.length === 0) {
    throw new Error(`${workflow} 워크플로우 템플릿이 비어 있습니다.`);
  }

  const uniqueTemplateIds = new Set(templates.map((template) => template.id));
  if (uniqueTemplateIds.size !== templates.length) {
    throw new Error(`${workflow} 템플릿 id가 중복되었습니다.`);
  }

  return { templates };
}

function normalizeConfig(parsed: unknown): DebateRoleConfig {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('역할 설정 YAML 루트 형식이 잘못되었습니다.');
  }

  const value = parsed as Record<string, unknown>;
  const version = Number(value.version);
  const workflows = value.workflows && typeof value.workflows === 'object'
    ? value.workflows as Record<string, unknown>
    : null;

  if (version !== 1) {
    throw new Error('역할 설정 YAML은 version: 1 이어야 합니다.');
  }
  if (!workflows) {
    throw new Error('workflows 섹션이 필요합니다.');
  }

  const config: DebateRoleConfig = {
    version: 1,
    defaults: value.defaults && typeof value.defaults === 'object'
      ? {
          newsTemplateId: asString((value.defaults as Record<string, unknown>).newsTemplateId) || undefined,
          projectTemplateId: asString((value.defaults as Record<string, unknown>).projectTemplateId) || undefined,
        }
      : undefined,
    workflows: {
      news: normalizeCollection(workflows.news, 'news'),
      project: normalizeCollection(workflows.project, 'project'),
    },
  };

  for (const workflow of ['news', 'project'] as const) {
    const defaultTemplateId = workflow === 'news'
      ? config.defaults?.newsTemplateId
      : config.defaults?.projectTemplateId;

    if (defaultTemplateId && !config.workflows[workflow].templates.some((template) => template.id === defaultTemplateId)) {
      throw new Error(`${workflow} 기본 템플릿 ${defaultTemplateId}를 찾을 수 없습니다.`);
    }
  }

  return config;
}

function parseRoleConfig(raw: string): DebateRoleConfig {
  try {
    return normalizeConfig(parse(raw));
  } catch (error) {
    const message = error instanceof Error ? error.message : '역할 설정 YAML을 해석하지 못했습니다.';
    throw new Error(message);
  }
}

export function loadRoleConfig(): LoadedRoleConfig {
  const path = resolveRoleConfigPath();
  const raw = readRoleConfigRaw(path);
  return {
    path,
    raw,
    config: parseRoleConfig(raw),
  };
}

export function saveRoleConfig(raw: string): LoadedRoleConfig {
  const path = resolveRoleConfigPath();
  const normalizedRaw = `${raw.trimEnd()}\n`;
  const config = parseRoleConfig(normalizedRaw);

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, normalizedRaw, 'utf-8');

  return {
    path,
    raw: normalizedRaw,
    config,
  };
}

export function getDefaultRoleConfigYaml(): string {
  return `${DEFAULT_ROLE_CONFIG_YAML.trimEnd()}\n`;
}

export function getRoleConfigTemplateDefaults(config: DebateRoleConfig): Record<RoleWorkflowKind, string> {
  return {
    news: config.defaults?.newsTemplateId || config.workflows.news.templates[0]?.id || '',
    project: config.defaults?.projectTemplateId || config.workflows.project.templates[0]?.id || '',
  };
}

export function buildParticipantRolePrompt(role: DebateParticipantRole): string {
  const lines = [
    `Role: ${role.roleLabel}`,
    `Primary focus: ${role.focus}`,
  ];

  if (role.instructions.length > 0) {
    lines.push('Role instructions:');
    lines.push(...role.instructions.map((instruction) => `- ${instruction}`));
  }

  if (role.requiredQuestions && role.requiredQuestions.length > 0) {
    lines.push('Required questions:');
    lines.push(...role.requiredQuestions.map((question) => `- ${question}`));
  }

  return lines.join('\n');
}
