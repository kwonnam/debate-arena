import type { DebateMode, ProviderName } from '../types/debate.js';

// --- Interfaces ---

export interface PromptBuilders {
  systemPrompt: (provider: ProviderName, projectContext?: string) => string;
  openingPrompt: (question: string) => string;
  rebuttalPrompt: (opponentProvider: ProviderName, opponentResponse: string) => string;
}

export type SynthesisPromptBuilder = (
  question: string,
  debateLog: Array<{ provider: ProviderName; round: number; content: string }>
) => string;

export type ApplyPromptBuilder = (
  question: string,
  approach: string,
  approachLabel: string,
  executor: ProviderName,
  isSecondPass?: boolean
) => string;

const PROVIDER_LABELS: Record<ProviderName, string> = {
  codex: 'Codex',
  claude: 'Claude',
};

function opponentOf(provider: ProviderName): ProviderName {
  return provider === 'codex' ? 'claude' : 'codex';
}

export function buildDebaterSystemPrompt(
  provider: ProviderName,
  projectContext?: string
): string {
  const self = PROVIDER_LABELS[provider];
  const opponent = PROVIDER_LABELS[opponentOf(provider)];

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
  opponentProvider: ProviderName,
  opponentResponse: string
): string {
  const opponent = PROVIDER_LABELS[opponentProvider];
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

export function buildApplyPrompt(
  question: string,
  approach: string,
  approachLabel: string,
  executor: ProviderName,
  _isSecondPass?: boolean
): string {
  const toolGuidance =
    executor === 'codex'
      ? 'Directly modify files in the project to implement this approach.'
      : 'Use Edit, Write, Bash, and Read tools to directly modify files in the project.';

  return [
    `You are an AI agent tasked with applying a chosen approach to a codebase.`,
    '',
    `Original Question: "${question}"`,
    '',
    `Selected Approach (${approachLabel} — chosen by the user from a debate between Codex and Claude):`,
    '',
    '---',
    approach,
    '---',
    '',
    'Instructions:',
    `1. ${toolGuidance}`,
    '2. Follow the selected approach faithfully.',
    '3. Make minimal, focused changes — only what is necessary.',
    '4. Do not introduce unrelated modifications.',
    '5. Respond in the same language as the original question.',
  ].join('\n');
}

export function buildSynthesisPrompt(
  question: string,
  debateLog: Array<{ provider: ProviderName; round: number; content: string }>
): string {
  const transcript = debateLog
    .map(
      (entry) =>
        `[Round ${entry.round} - ${PROVIDER_LABELS[entry.provider]}]\n${entry.content}`
    )
    .join('\n\n---\n\n');

  return [
    'You are a fair and balanced judge reviewing a debate between Codex and Claude.',
    '',
    `Original Question: "${question}"`,
    '',
    'Full Debate Transcript:',
    '',
    transcript,
    '',
    'Please provide a comprehensive synthesis:',
    '1. Summarize the key points of agreement between both sides.',
    '2. Highlight the most compelling arguments from each side.',
    '3. Identify areas where one side had stronger reasoning.',
    '4. Provide a final, balanced answer to the original question that incorporates the best insights from both perspectives.',
    '5. Respond in the same language as the original question.',
  ].join('\n');
}

// --- Plan Mode Prompts ---

export function buildPlanSystemPrompt(
  provider: ProviderName,
  projectContext?: string
): string {
  const self = PROVIDER_LABELS[provider];
  const opponent = PROVIDER_LABELS[opponentOf(provider)];

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
  opponentProvider: ProviderName,
  opponentResponse: string
): string {
  const opponent = PROVIDER_LABELS[opponentProvider];
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
  debateLog: Array<{ provider: ProviderName; round: number; content: string }>
): string {
  const transcript = debateLog
    .map(
      (entry) =>
        `[Round ${entry.round} - ${PROVIDER_LABELS[entry.provider]}]\n${entry.content}`
    )
    .join('\n\n---\n\n');

  return [
    'You are a technical lead synthesizing an implementation plan from a discussion between Codex and Claude.',
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

export function getApplyPromptBuilder(mode: DebateMode): ApplyPromptBuilder {
  return mode === 'plan' ? buildPlanApplyPrompt : buildApplyPrompt;
}
