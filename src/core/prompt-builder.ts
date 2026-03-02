import type { DebateMode, ParticipantName, ProviderName } from '../types/debate.js';

// --- Interfaces ---

export interface PromptBuilders {
  systemPrompt: (provider: ProviderName, projectContext?: string, participants?: ProviderName[]) => string;
  openingPrompt: (question: string) => string;
  rebuttalPrompt: (opponentProvider: ParticipantName, opponentResponse: string) => string;
}

export type SynthesisPromptBuilder = (
  question: string,
  debateLog: Array<{ provider: ParticipantName; round: number; content: string }>
) => string;

export type ApplyPromptBuilder = (
  question: string,
  approach: string,
  approachLabel: string,
  executor: ProviderName,
  isSecondPass?: boolean
) => string;

const KNOWN_PROVIDER_LABELS: Record<string, string> = {
  codex: 'Codex',
  claude: 'Claude',
  gemini: 'Gemini',
  ollama: 'Ollama',
};

function providerLabel(provider: ProviderName): string {
  return KNOWN_PROVIDER_LABELS[provider] ?? provider;
}

function participantLabel(provider: ParticipantName): string {
  if (provider === 'user') return 'User';
  return providerLabel(provider);
}

function opponentOf(provider: ProviderName, participants?: ProviderName[]): ProviderName {
  if (participants) {
    return participants.find(p => p !== provider) ?? 'claude';
  }
  if (provider === 'codex') return 'claude';
  if (provider === 'claude') return 'codex';
  return 'codex';
}

export function buildDebaterSystemPrompt(
  provider: ProviderName,
  projectContext?: string,
  participants?: ProviderName[]
): string {
  const self = providerLabel(provider);
  const opponent = providerLabel(opponentOf(provider, participants));

  const lines = [
    `You are ${self}, participating in a structured debate with ${opponent}.`,
    '',
    'Rules:',
    '1. Present clear, well-reasoned arguments backed by evidence.',
    '2. When rebutting, directly address your opponent\'s points before presenting your own.',
    '3. Acknowledge valid points from your opponent when appropriate.',
    '4. Be concise but thorough. Aim for 200-400 words per response.',
    '5. Use a professional, respectful tone.',
    '6. Respond in the same language as the question.',
  ];

  if (projectContext) {
    lines.push('', '---', '', projectContext);
  }

  return lines.join('\n');
}

export function buildOpeningPrompt(question: string): string {
  return [
    'A user has asked the following question for debate:',
    '',
    `"${question}"`,
    '',
    'Please provide your initial answer to this question. Present your perspective clearly with supporting arguments.',
  ].join('\n');
}

export function buildRebuttalPrompt(
  opponentProvider: ParticipantName,
  opponentResponse: string
): string {
  const opponent = participantLabel(opponentProvider);
  return [
    `${opponent} has responded with the following argument:`,
    '',
    '---',
    opponentResponse,
    '---',
    '',
    'Please respond by:',
    '1. Addressing their key points (agree or rebut with evidence)',
    '2. Strengthening your own position',
    '3. Identifying any gaps or weaknesses in their reasoning',
  ].join('\n');
}

export function buildSynthesisPrompt(
  question: string,
  debateLog: Array<{ provider: ParticipantName; round: number; content: string }>
): string {
  const transcript = debateLog
    .map(
      (entry) =>
        `[Round ${entry.round} - ${participantLabel(entry.provider)}]\n${entry.content}`
    )
    .join('\n\n---\n\n');

  const hasUser = debateLog.some((e) => e.provider === 'user');
  const debateProviders = [...new Set(debateLog.filter(e => e.provider !== 'user').map(e => e.provider))];
  const providerLabels = debateProviders.map((p) => participantLabel(p as ParticipantName)).join(', ');
  const participants = hasUser ? `${providerLabels}, and the User` : providerLabels;

  return [
    `You are a fair and balanced judge reviewing a debate between ${participants}.`,
    '',
    `Original Question: "${question}"`,
    '',
    'Full Debate Transcript:',
    '',
    transcript,
    '',
    'Please provide a comprehensive synthesis:',
    '1. Summarize the key points of agreement between all sides.',
    '2. Highlight the most compelling arguments from each side.',
    '3. Identify areas where one side had stronger reasoning.',
    '4. Provide a final, balanced answer to the original question that incorporates the best insights from all perspectives.',
    '5. Respond in the same language as the original question.',
  ].join('\n');
}

import type { EvidenceSnapshot } from '../news/snapshot.js';

export function buildSynthesisPromptWithEvidence(
  question: string,
  debateLog: Array<{ provider: ParticipantName; round: number; content: string }>,
  snapshot?: EvidenceSnapshot,
): string {
  if (!snapshot) {
    return buildSynthesisPrompt(question, debateLog);
  }

  const evidenceSection = [
    '',
    '## 참고 증거 (Evidence Snapshot)',
    `수집 시각: ${snapshot.collectedAt} | 검색어: "${snapshot.query}" | ID: ${snapshot.id}`,
    '두 AI 모두 아래 동일한 기사를 참고했습니다.',
    '',
    ...snapshot.articles.map(
      (a) => `- [${a.source}] ${a.title} (${a.publishedAt})\n  요약: ${a.summary}\n  URL: ${a.url}`
    ),
    '',
    '## 합성 요구사항 (Evidence 모드)',
    '1. **출처 인용 강제**: 각 주장마다 근거 기사를 "[출처명, 날짜]" 형식으로 명시하시오.',
    '2. **시나리오 분리**: 단기(3개월), 중기(1년), 장기(3년+) 영향을 별도 섹션으로 구분하시오.',
    '3. **확신도 표기**: 각 예측에 높음/중간/낮음과 근거를 명시하시오.',
    '4. **반증 조건**: "X가 발생하면 이 분석은 달라진다"를 명시하시오.',
  ].join('\n');

  return buildSynthesisPrompt(question, debateLog) + evidenceSection;
}

// --- Plan Mode Prompts ---

export function buildPlanSystemPrompt(
  provider: ProviderName,
  projectContext?: string,
  participants?: ProviderName[]
): string {
  const self = providerLabel(provider);
  const opponent = providerLabel(opponentOf(provider, participants));

  const lines = [
    `You are ${self}, participating in an implementation planning discussion with ${opponent}.`,
    '',
    'Your goal is to produce a concrete, actionable implementation plan.',
    '',
    'Rules:',
    '1. Be specific: list exact file paths, function names, and code changes.',
    '2. Include implementation order and dependencies between changes.',
    '3. When rebutting, focus on technical feasibility, edge cases, and better alternatives.',
    '4. Acknowledge valid points and integrate them into an improved plan.',
    '5. Be concise but thorough. Aim for 300-500 words per response.',
    '6. Use a professional, respectful tone.',
    '7. Respond in the same language as the question.',
  ];

  if (projectContext) {
    lines.push('', '---', '', projectContext);
  }

  return lines.join('\n');
}

export function buildPlanOpeningPrompt(question: string): string {
  return [
    'A user wants the following feature implemented:',
    '',
    `"${question}"`,
    '',
    'Please propose a concrete implementation plan. Include:',
    '1. Files to create or modify (exact paths)',
    '2. Key code changes or snippets for each file',
    '3. Implementation sequence (what to do first, second, etc.)',
    '4. Testing strategy',
    '5. Potential risks or edge cases',
  ].join('\n');
}

export function buildPlanRebuttalPrompt(
  opponentProvider: ParticipantName,
  opponentResponse: string
): string {
  const opponent = participantLabel(opponentProvider);
  return [
    `${opponent} has proposed the following implementation plan:`,
    '',
    '---',
    opponentResponse,
    '---',
    '',
    'Please respond by:',
    '1. Evaluating their plan for technical correctness and completeness',
    '2. Identifying missing edge cases, potential bugs, or performance issues',
    '3. Suggesting specific improvements with code examples',
    '4. Proposing an improved plan that incorporates the best of both approaches',
  ].join('\n');
}

export function buildPlanSynthesisPrompt(
  question: string,
  debateLog: Array<{ provider: ParticipantName; round: number; content: string }>
): string {
  const transcript = debateLog
    .map(
      (entry) =>
        `[Round ${entry.round} - ${participantLabel(entry.provider)}]\n${entry.content}`
    )
    .join('\n\n---\n\n');

  const hasUser = debateLog.some((e) => e.provider === 'user');
  const debateProviders = [...new Set(debateLog.filter(e => e.provider !== 'user').map(e => e.provider))];
  const providerLabels = debateProviders.map((p) => participantLabel(p as ParticipantName)).join(', ');
  const participants = hasUser ? `${providerLabels}, and the User` : providerLabels;

  return [
    `You are a technical lead synthesizing an implementation plan from a discussion between ${participants}.`,
    '',
    `Feature Request: "${question}"`,
    '',
    'Discussion Transcript:',
    '',
    transcript,
    '',
    'Produce a unified, structured implementation plan with these sections:',
    '',
    '## Summary',
    'Brief overview of the agreed approach.',
    '',
    '## Files to Change',
    'List each file with the specific changes needed.',
    '',
    '## Implementation Sequence',
    'Ordered steps with dependencies.',
    '',
    '## Testing Strategy',
    'How to verify the implementation.',
    '',
    '## Risks & Mitigations',
    'Potential issues and how to handle them.',
    '',
    'Respond in the same language as the original question.',
  ].join('\n');
}

export function buildPlanApplyPrompt(
  question: string,
  approach: string,
  approachLabel: string,
  executor: ProviderName,
  isSecondPass?: boolean
): string {
  const toolGuidance =
    executor === 'codex'
      ? 'Directly modify files in the project to implement this plan.'
      : 'Use Edit, Write, Bash, and Read tools to directly modify files in the project.';

  if (isSecondPass) {
    return [
      'You are an AI agent tasked with verifying and completing an implementation.',
      '',
      `Original Request: "${question}"`,
      '',
      `Implementation Plan (${approachLabel}):`,
      '',
      '---',
      approach,
      '---',
      '',
      'A previous agent has already applied this plan to the codebase.',
      '',
      'Your task:',
      `1. ${toolGuidance}`,
      '2. Review what was implemented and verify correctness.',
      '3. Fix any bugs, missing pieces, or deviations from the plan.',
      '4. Ensure tests pass and code quality is maintained.',
      '5. Do not re-implement what is already correctly done.',
      '6. Respond in the same language as the original question.',
    ].join('\n');
  }

  return [
    'You are an AI agent tasked with implementing a plan on a codebase.',
    '',
    `Original Request: "${question}"`,
    '',
    `Implementation Plan (${approachLabel} — agreed upon by Codex and Claude):`,
    '',
    '---',
    approach,
    '---',
    '',
    'Instructions:',
    `1. ${toolGuidance}`,
    '2. Follow the implementation plan step by step.',
    '3. Implement all changes listed in the plan.',
    '4. Make focused changes — only what the plan specifies.',
    '5. Do not introduce unrelated modifications.',
    '6. Respond in the same language as the original question.',
  ].join('\n');
}

// --- Mode Constants & Factories ---

export const DEBATE_PROMPTS: PromptBuilders = {
  systemPrompt: buildDebaterSystemPrompt,
  openingPrompt: buildOpeningPrompt,
  rebuttalPrompt: buildRebuttalPrompt,
};

export const PLAN_PROMPTS: PromptBuilders = {
  systemPrompt: buildPlanSystemPrompt,
  openingPrompt: buildPlanOpeningPrompt,
  rebuttalPrompt: buildPlanRebuttalPrompt,
};

export function getPromptBuilders(mode: DebateMode): PromptBuilders {
  return mode === 'plan' ? PLAN_PROMPTS : DEBATE_PROMPTS;
}

export function getSynthesisPromptBuilder(mode: DebateMode): SynthesisPromptBuilder {
  return mode === 'plan' ? buildPlanSynthesisPrompt : buildSynthesisPrompt;
}

export function getApplyPromptBuilder(_mode: DebateMode): ApplyPromptBuilder {
  return buildPlanApplyPrompt;
}
