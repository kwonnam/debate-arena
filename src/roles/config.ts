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
  project:
    templates:
      - id: project-ux-backend-qa
        label: UX · 백엔드 · QA
        description: 사용자 흐름, 구현 복잡도, 회귀 위험을 함께 검토하는 3자 토론 템플릿입니다.
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
            defaultProvider: gemini
            instructions:
              - 실패 시나리오와 필요한 테스트를 함께 제안한다.
      - id: project-ux-architecture
        label: UX · 아키텍트
        description: 사용자 경험과 시스템 구조를 압축적으로 점검하는 2자 토론 템플릿입니다.
        recommendedJudge: claude
        participants:
          - roleId: ux
            label: UX 전문가
            focus: 사용자가 이해하기 쉬운 흐름과 우선순위를 설계합니다.
            defaultProvider: codex
            instructions:
              - 정보 구조와 용어 체계를 정리한다.
          - roleId: architect
            label: 아키텍트
            focus: 경계 분리, 확장성, 코드 구조의 일관성을 검토합니다.
            defaultProvider: claude
            instructions:
              - 파일 경계와 책임 분리를 기준으로 판단한다.
`;

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function resolveRoleConfigPath(): string {
  const override = process.env.FFM_ROLE_CONFIG?.trim();
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
  if (roles.length < 2 || roles.length > 3) {
    throw new Error(`템플릿 ${id}는 역할이 2개 또는 3개여야 합니다.`);
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
