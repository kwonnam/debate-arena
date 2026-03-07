import type { DebateParticipant, ProviderName } from '../types/roles.js';

const DEFAULT_PROVIDER_SEQUENCE: ProviderName[] = ['codex', 'claude'];

const KNOWN_PROVIDER_LABELS: Record<string, string> = {
  codex: 'Codex',
  claude: 'Claude',
  gemini: 'Gemini',
  ollama: 'Ollama',
};

function providerLabel(provider: string): string {
  return KNOWN_PROVIDER_LABELS[provider] ?? provider;
}

function slugify(value: string): string {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function buildDefaultParticipant(provider: ProviderName, index: number): DebateParticipant {
  const label = providerLabel(provider);
  return {
    id: `${slugify(provider) || 'participant'}-${index + 1}`,
    provider,
    label,
    role: {
      roleId: slugify(provider) || `participant-${index + 1}`,
      roleLabel: label,
      focus: `${label}의 일반적인 관점에서 질문에 답합니다.`,
      instructions: [],
    },
  };
}

function normalizeProvidedParticipant(input: DebateParticipant, index: number): DebateParticipant {
  const provider = String(input.provider || '').trim().toLowerCase();
  const roleId = String(input.role?.roleId || input.id || `participant-${index + 1}`).trim();
  const roleLabel = String(input.role?.roleLabel || input.label || providerLabel(provider)).trim() || `Participant ${index + 1}`;

  return {
    id: String(input.id || roleId || `participant-${index + 1}`).trim() || `participant-${index + 1}`,
    provider,
    label: String(input.label || roleLabel).trim() || roleLabel,
    role: {
      roleId,
      roleLabel,
      focus: String(input.role?.focus || '').trim() || `${roleLabel} 관점에서 질문에 답합니다.`,
      instructions: Array.isArray(input.role?.instructions)
        ? input.role.instructions.map((item) => String(item).trim()).filter(Boolean)
        : [],
      requiredQuestions: Array.isArray(input.role?.requiredQuestions)
        ? input.role.requiredQuestions.map((item) => String(item).trim()).filter(Boolean)
        : [],
    },
  };
}

function ensureUniqueLabels(participants: DebateParticipant[]): DebateParticipant[] {
  const counts = new Map<string, number>();

  return participants.map((participant) => {
    const current = counts.get(participant.label) ?? 0;
    counts.set(participant.label, current + 1);

    if (current === 0) {
      return participant;
    }

    return {
      ...participant,
      label: `${participant.label} ${current + 1}`,
    };
  });
}

export function normalizeDebateParticipants(
  input?: Array<ProviderName | DebateParticipant>,
): DebateParticipant[] {
  const raw = Array.isArray(input) && input.length > 0 ? input : DEFAULT_PROVIDER_SEQUENCE;
  const participants = raw.map((item, index) =>
    typeof item === 'string'
      ? buildDefaultParticipant(String(item).trim().toLowerCase(), index)
      : normalizeProvidedParticipant(item, index)
  );

  if (participants.length < 2 || participants.length > 3) {
    throw new Error('Debate participants must contain 2 to 3 entries.');
  }

  for (const [index, participant] of participants.entries()) {
    if (!participant.provider) {
      throw new Error(`Participant ${index + 1} is missing a provider.`);
    }
  }

  return ensureUniqueLabels(participants);
}
