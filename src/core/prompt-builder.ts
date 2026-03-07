import type { DebateMode, DebateRoundState, ParticipantName, ProviderName } from '../types/debate.js';
import type { DebateParticipant } from '../types/roles.js';
import { buildParticipantRolePrompt } from '../roles/config.js';

// --- Interfaces ---

export interface PromptBuilders {
  systemPrompt: (participant: DebateParticipant, projectContext?: string, participants?: DebateParticipant[]) => string;
  openingPrompt: (question: string) => string;
  rebuttalPrompt: (opponentLabel: ParticipantName, opponentResponse: string) => string;
}

export type SynthesisPromptBuilder = (
  question: string,
  debateLog: Array<{ label: ParticipantName; round: number; content: string }>,
  roundStates?: DebateRoundState[],
) => string;

export type ApplyPromptBuilder = (
  question: string,
  approach: string,
  approachLabel: string,
  executor: ProviderName,
  isSecondPass?: boolean
) => string;

export type RoundStatePromptBuilder = (
  question: string,
  round: number,
  debateLog: Array<{ label: ParticipantName; round: number; content: string }>
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

function participantLabel(label: ParticipantName): string {
  if (label === 'user') return 'User';
  return label;
}

function buildOtherParticipantSummary(
  participant: DebateParticipant,
  participants?: DebateParticipant[],
): string {
  const others = (participants || []).filter((entry) => entry.id !== participant.id);
  if (others.length === 0) {
    return 'other specialist participants';
  }

  return others
    .map((entry) => `${entry.label} (${providerLabel(entry.provider)})`)
    .join(', ');
}

export function buildDebaterSystemPrompt(
  participant: DebateParticipant,
  projectContext?: string,
  participants?: DebateParticipant[]
): string {
  const self = participant.label;
  const provider = providerLabel(participant.provider);
  const otherParticipants = buildOtherParticipantSummary(participant, participants);
  const rolePrompt = buildParticipantRolePrompt(participant.role);

  const lines = [
    `You are ${self}, participating in a structured debate with ${otherParticipants}.`,
    `Your underlying model/provider is ${provider}.`,
    '',
    rolePrompt,
    '',
    'Rules:',
    '1. Present clear, well-reasoned arguments backed by evidence.',
    '2. When rebutting, directly address the strongest points from the other participants before presenting your own.',
    '3. Acknowledge valid points from the other participants when appropriate.',
    '4. Be concise but thorough. Aim for 200-400 words per response.',
    '5. Use a professional, respectful tone.',
    '6. Respond in the same language as the question.',
    '7. Stay inside your assigned role. Do not collapse into a generic neutral answer.',
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
  debateLog: Array<{ label: ParticipantName; round: number; content: string }>,
  roundStates: DebateRoundState[] = [],
): string {
  const transcript = debateLog
    .map(
      (entry) =>
        `[Round ${entry.round} - ${participantLabel(entry.label)}]\n${entry.content}`
    )
    .join('\n\n---\n\n');

  const hasUser = debateLog.some((e) => e.label === 'user');
  const debateProviders = [...new Set(debateLog.filter((e) => e.label !== 'user').map((e) => e.label))];
  const providerLabels = debateProviders.map((p) => participantLabel(p as ParticipantName)).join(', ');
  const participants = hasUser ? `${providerLabels}, and the User` : providerLabels;
  const roundStateSection = roundStates.length > 0
    ? [
        'Compressed Round States:',
        '',
        buildRoundStateSummaryPreamble(roundStates),
        '',
      ]
    : [];

  return [
    `You are a fair and balanced judge reviewing a debate between ${participants}.`,
    '',
    `Original Question: "${question}"`,
    '',
    ...roundStateSection,
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

export function buildRoundStatePrompt(
  question: string,
  round: number,
  debateLog: Array<{ label: ParticipantName; round: number; content: string }>
): string {
  const transcript = debateLog
    .map(
      (entry) =>
        `[Round ${entry.round} - ${participantLabel(entry.label)}]\n${entry.content}`
    )
    .join('\n\n---\n\n');

  return [
    'You are extracting a compact reusable state for the next debate round.',
    '',
    `Original Question: "${question}"`,
    `Completed Round: ${round}`,
    '',
    'Round Transcript:',
    '',
    transcript,
    '',
    'Return plain text using exactly these sections:',
    'SUMMARY: one concise paragraph',
    'ISSUES:',
    '- unresolved issue 1',
    '- unresolved issue 2',
    'AGREEMENTS:',
    '- agreement 1',
    'NEXT_FOCUS:',
    '- what the next round should focus on',
    'STOP_SUGGESTED: yes|no',
    'STOP_REASON: brief reason, or "none"',
    '',
    'Requirements:',
    '- Keep the output compact and factual.',
    '- Prefer unresolved disagreements over repeating the full transcript.',
    '- Use the same language as the debate.',
  ].join('\n');
}

export function buildRoundStateContextSection(states: DebateRoundState[]): string {
  const lines = [
    '## Debate State So Far',
    'Use this compressed state as the primary context. Avoid repeating settled points.',
    '',
  ];

  for (const state of states) {
    lines.push(`[Round ${state.round}]`);
    lines.push(`Summary: ${state.summary}`);

    if (state.keyIssues.length > 0) {
      lines.push('Key issues:');
      lines.push(...state.keyIssues.map((issue) => `- ${issue}`));
    }

    if (state.agreements.length > 0) {
      lines.push('Agreements:');
      lines.push(...state.agreements.map((item) => `- ${item}`));
    }

    if (state.nextFocus.length > 0) {
      lines.push('Next focus:');
      lines.push(...state.nextFocus.map((item) => `- ${item}`));
    }

    if (state.shouldSuggestStop) {
      lines.push(`Debate efficiency signal: consider concluding soon. Reason: ${state.stopReason ?? 'not specified'}`);
    }

    if (state.warning) {
      lines.push(`Warning: ${state.warning}`);
    }

    lines.push('');
  }

  return lines.join('\n').trim();
}

export function buildTranscriptFallbackSection(
  round: number,
  messages: Array<{ label: ParticipantName; content: string }>
): string {
  const transcript = messages
    .map((message) => `### ${participantLabel(message.label)}\n${message.content}`)
    .join('\n\n');

  return [
    `## Transcript Fallback For Round ${round}`,
    'Structured extraction was unavailable, so use this raw transcript for accuracy.',
    '',
    transcript,
  ].join('\n');
}

import type { EvidenceSnapshot, NewsArticle } from '../news/snapshot.js';

const MAX_ROUND_EVIDENCE_ARTICLES = 4;

export function buildSynthesisPromptWithEvidence(
  question: string,
  debateLog: Array<{ label: ParticipantName; round: number; content: string }>,
  snapshot?: EvidenceSnapshot,
  roundStates: DebateRoundState[] = [],
): string {
  if (!snapshot) {
    return buildSynthesisPrompt(question, debateLog, roundStates);
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

  return buildSynthesisPrompt(question, debateLog, roundStates) + evidenceSection;
}

// --- Plan Mode Prompts ---

export function buildPlanSystemPrompt(
  participant: DebateParticipant,
  projectContext?: string,
  participants?: DebateParticipant[]
): string {
  const self = participant.label;
  const provider = providerLabel(participant.provider);
  const otherParticipants = buildOtherParticipantSummary(participant, participants);
  const rolePrompt = buildParticipantRolePrompt(participant.role);

  const lines = [
    `You are ${self}, participating in an implementation planning discussion with ${otherParticipants}.`,
    `Your underlying model/provider is ${provider}.`,
    '',
    rolePrompt,
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
  debateLog: Array<{ label: ParticipantName; round: number; content: string }>,
  roundStates: DebateRoundState[] = [],
): string {
  const transcript = debateLog
    .map(
      (entry) =>
        `[Round ${entry.round} - ${participantLabel(entry.label)}]\n${entry.content}`
    )
    .join('\n\n---\n\n');

  const hasUser = debateLog.some((e) => e.label === 'user');
  const debateProviders = [...new Set(debateLog.filter((e) => e.label !== 'user').map((e) => e.label))];
  const providerLabels = debateProviders.map((p) => participantLabel(p as ParticipantName)).join(', ');
  const participants = hasUser ? `${providerLabels}, and the User` : providerLabels;
  const roundStateSection = roundStates.length > 0
    ? [
        'Compressed Discussion State:',
        '',
        buildRoundStateSummaryPreamble(roundStates),
        '',
      ]
    : [];

  return [
    `You are a technical lead synthesizing an implementation plan from a discussion between ${participants}.`,
    '',
    `Feature Request: "${question}"`,
    '',
    ...roundStateSection,
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

export type RoundEvidenceMode = 'unified' | 'split-first' | 'split-second';

export function buildRoundEvidenceSection(
  mode: RoundEvidenceMode,
  articles: NewsArticle[],
): string {
  if (articles.length === 0) return '';

  let selected: NewsArticle[];
  let label: string;

  if (mode === 'unified') {
    selected = articles;
    label = '양측 공통 증거 (unified)';
  } else {
    const half = Math.ceil(articles.length / 2);
    if (mode === 'split-first') {
      selected = articles.slice(0, half);
      label = '찬성 측 근거 (split)';
    } else {
      selected = articles.slice(half);
      label = '반대 측 근거 (split)';
    }
  }

  selected = selected.slice(0, MAX_ROUND_EVIDENCE_ARTICLES);
  if (selected.length === 0) return '';

  const lines = [
    '',
    `## 참고 뉴스 (${label})`,
    '아래 압축된 기사 메모를 근거로 활용하여 논증을 강화하십시오.',
    '',
    ...selected.map(
      (a) => `- [${a.source}] ${a.title} (${a.publishedAt})\n  요약: ${truncateText(a.summary, 160)}`
    ),
    '',
  ];

  if (articles.length > selected.length) {
    lines.push(`추가 기사 ${articles.length - selected.length}건은 컨텍스트 절약을 위해 생략되었습니다.`);
    lines.push('');
  }

  return lines.join('\n');
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

function buildRoundStateSummaryPreamble(roundStates: DebateRoundState[]): string {
  const lines: string[] = [];

  for (const state of roundStates) {
    lines.push(`[Round ${state.round}] ${state.summary}`);
    if (state.keyIssues.length > 0) {
      lines.push(`Issues: ${state.keyIssues.join(' | ')}`);
    }
    if (state.agreements.length > 0) {
      lines.push(`Agreements: ${state.agreements.join(' | ')}`);
    }
    if (state.nextFocus.length > 0) {
      lines.push(`Next focus: ${state.nextFocus.join(' | ')}`);
    }
    if (state.shouldSuggestStop) {
      lines.push(`Stop suggestion: yes${state.stopReason ? ` (${state.stopReason})` : ''}`);
    }
    if (state.warning) {
      lines.push(`Warning: ${state.warning}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}...`;
}
