import type { ProviderName, WorkflowKind } from './debate.js';

export type RoleWorkflowKind = Extract<WorkflowKind, 'news' | 'project'>;

export interface DebateRoleTemplateParticipantTemplate {
  roleId: string;
  label: string;
  focus: string;
  instructions: string[];
  requiredQuestions?: string[];
  defaultProvider?: ProviderName;
}

export interface DebateRoleTemplate {
  id: string;
  label: string;
  description: string;
  recommendedJudge?: ProviderName | 'both';
  participants: DebateRoleTemplateParticipantTemplate[];
}

export interface DebateRoleTemplateCollection {
  templates: DebateRoleTemplate[];
}

export interface DebateRoleConfig {
  version: 1;
  defaults?: {
    newsTemplateId?: string;
    projectTemplateId?: string;
  };
  workflows: Record<RoleWorkflowKind, DebateRoleTemplateCollection>;
}

export interface DebateParticipantRole {
  roleId: string;
  roleLabel: string;
  focus: string;
  instructions: string[];
  requiredQuestions?: string[];
}

export interface DebateParticipant {
  id: string;
  provider: ProviderName;
  label: string;
  role: DebateParticipantRole;
}
