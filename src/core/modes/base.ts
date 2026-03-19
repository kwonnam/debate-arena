import type { DebateMode } from '../../types/debate.js';

export type DebateGoal = 'explore' | 'validate' | 'design' | 'implement';
export type DebateArtifactKind = 'memo' | 'verdict' | 'adr' | 'plan';

export interface DebateModeArtifact {
  kind: DebateArtifactKind;
  label: string;
  plainLanguageLabel: string;
  sections: string[];
}

export interface DebateModeDefinition {
  id: DebateMode;
  label: string;
  sessionWord: string;
  goal: DebateGoal;
  goalLabel: string;
  protocolLabel: string;
  processLabel: string;
  conclusionLabel: string;
  roundStateLabel: string;
  decisionBoardLabel: string;
  openingLabel: string;
  rebuttalLabel: string;
  filePrefix: string;
  artifact: DebateModeArtifact;
}

export function defineMode(definition: DebateModeDefinition): DebateModeDefinition {
  return definition;
}
