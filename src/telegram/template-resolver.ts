import { loadRoleConfig } from '../roles/config.js';
import type { DebateParticipant, DebateRoleTemplate, DebateRoleTemplateParticipantTemplate } from '../types/roles.js';

const DEFAULT_STOCK_TEMPLATE_ID = 'news-stock-bull-bear-risk';

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const item = value.trim();
    if (!item || seen.has(item)) {
      continue;
    }
    seen.add(item);
    result.push(item);
  }

  return result;
}

export function listStockTemplates(): DebateRoleTemplate[] {
  const loaded = loadRoleConfig();
  return loaded.config.workflows.news.templates.filter((template) => template.id.startsWith('news-stock-'));
}

export function resolveDefaultStockTemplateId(preferredTemplateId?: string): string {
  const templates = listStockTemplates();
  if (templates.length === 0) {
    throw new Error('No stock debate templates are configured.');
  }

  const preferred = preferredTemplateId?.trim();
  if (preferred && templates.some((template) => template.id === preferred)) {
    return preferred;
  }

  if (templates.some((template) => template.id === DEFAULT_STOCK_TEMPLATE_ID)) {
    return DEFAULT_STOCK_TEMPLATE_ID;
  }

  return templates[0].id;
}

export function resolveStockTemplate(templateId?: string): DebateRoleTemplate {
  const templates = listStockTemplates();
  const resolvedId = resolveDefaultStockTemplateId(templateId);
  const template = templates.find((entry) => entry.id === resolvedId);
  if (!template) {
    throw new Error(`Unknown stock debate template: ${resolvedId}`);
  }
  return template;
}

function providerIndexForRole(
  role: DebateRoleTemplateParticipantTemplate,
  roleIndex: number,
  providerIds: string[],
): number {
  if (providerIds.length === 1) {
    return 0;
  }

  const providerHint = String(role.defaultProvider ?? '').trim().toLowerCase();
  if ((providerHint === 'codex' || providerHint === 'ollama') && providerIds.length >= 1) {
    return 0;
  }
  if (providerHint === 'claude' && providerIds.length >= 2) {
    return 1;
  }
  if (providerHint === 'gemini' && providerIds.length >= 3) {
    return 2;
  }

  return roleIndex % providerIds.length;
}

export function buildTemplateParticipants(
  template: DebateRoleTemplate,
  ollamaProviderIds: string[],
): DebateParticipant[] {
  const providerIds = uniqueValues(ollamaProviderIds);
  if (providerIds.length === 0) {
    throw new Error('At least one Ollama provider must be configured for Telegram debates.');
  }

  return template.participants.map((role, index) => {
    const provider = providerIds[providerIndexForRole(role, index, providerIds)] ?? providerIds[0];
    return {
      id: `${template.id}-${role.roleId}`,
      provider,
      label: role.label,
      role: {
        roleId: role.roleId,
        roleLabel: role.label,
        focus: role.focus,
        instructions: [...role.instructions],
        requiredQuestions: role.requiredQuestions ? [...role.requiredQuestions] : [],
      },
    };
  });
}
